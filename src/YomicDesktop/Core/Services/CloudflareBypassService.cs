using System;
using System.Threading.Tasks;
using PuppeteerSharp;
using System.Linq;
using System.Collections.Generic;

namespace Yomic.Core.Services
{
    public class CloudflareBypassService
    {
        private static CloudflareBypassService? _instance;
        public static CloudflareBypassService Instance => _instance ??= new CloudflareBypassService();

        private IBrowser? _browser;
        private string? _userAgent;
        private Dictionary<string, string> _cookies = new Dictionary<string, string>();
        
        // Store full cookie data (with domain info) from interactive sessions
        private List<CookieParam> _savedCookieParams = new List<CookieParam>();

        private readonly System.Threading.SemaphoreSlim _initLock = new System.Threading.SemaphoreSlim(1, 1);


        public IReadOnlyList<CookieParam> SavedCookies => _savedCookieParams;
        public string? BypassUserAgent => _userAgent;

        public event Action<string>? OnStatusUpdate;
        
        /// <summary>
        /// Returns true if cookies were captured from an interactive WebView session.
        /// </summary>
        public bool HasPreSolvedCookies => _savedCookieParams.Count > 0;
        
        /// <summary>
        /// Expose the underlying browser for advanced page manipulation by extensions.
        /// </summary>
        public IBrowser? GetBrowser() => _browser;
        
        /// <summary>
        /// Injects previously saved cookies into a Puppeteer page before navigation.
        /// This is critical for reusing cf_clearance cookies from interactive CAPTCHA solving.
        /// </summary>
        private async Task InjectSavedCookiesAsync(IPage page, string url)
        {
            if (_savedCookieParams.Count > 0)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Injecting {_savedCookieParams.Count} pre-solved cookies...");
                await page.SetCookieAsync(_savedCookieParams.ToArray());
            }
        }

        public async Task InitializeAsync()
        {
            if (_browser != null) return;

            await _initLock.WaitAsync();
            try 
            {
                if (_browser != null) return;

                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var downloadPath = System.IO.Path.Combine(appData, "Yomic", "puppeteer");
                
                if (!System.IO.Directory.Exists(downloadPath))
                    System.IO.Directory.CreateDirectory(downloadPath);

                Console.WriteLine($"[CloudflareService] Initializing Puppeteer at: {downloadPath}");

                // Determine if we need to download browser
                var browserFetcher = new BrowserFetcher(new BrowserFetcherOptions { Path = downloadPath });
                var revisionInfo = await browserFetcher.DownloadAsync(); // Downloads default revision and returns info

                var exePath = browserFetcher.GetExecutablePath(revisionInfo.BuildId);
                
                if (!System.IO.File.Exists(exePath))
                {
                     Console.WriteLine("[CloudflareService] Chrome executable not found after download attempt.");
                     // Retry logic or fail gracefully could go here, but Puppeteer usually throws.
                }

                _browser = await Puppeteer.LaunchAsync(new LaunchOptions
                {
                    Headless = true, 
                    ExecutablePath = exePath,
                    Args = new[] 
                    { 
                        "--no-sandbox", 
                        "--disable-setuid-sandbox",
                        "--disable-infobars",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-features=IsolateOrigins,site-per-process",
                        "--enable-features=EncryptedClientHello", 
                        "--dns-over-https-url=https://cloudflare-dns.com/dns-query", 
                        "--ignore-certificate-errors", 
                        "--ignore-ssl-errors",
                        "--allow-running-insecure-content",
                        "--window-size=1920,1080",
                        "--disable-dev-shm-usage"
                    }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CloudflareService] CRITICAL INIT ERROR: {ex.Message}");
                Console.WriteLine(ex.StackTrace);
                throw; // Rethrow to ensure caller knows, but logged first
            }
            finally
            {
                _initLock.Release();
            }
        }

        public async Task<(string? UserAgent, Dictionary<string, string> Cookies)> GetTokensAsync(string url)
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Launching Browser...");
            await InitializeAsync();

            using var page = await _browser!.NewPageAsync();
            
            // STEALTH: Mask webdriver property
            await page.EvaluateFunctionOnNewDocumentAsync(@"() => {
                // Hide webdriver
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                // Hide automation flags
                delete navigator.__proto__.webdriver;
                // Mock plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                // Mock languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
                // Mock permissions
                const originalQuery = window.navigator.permissions.query;
                window.navigator.permissions.query = (parameters) => (
                    parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
                );
                // Mock chrome runtime
                window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
                // Override toString for functions that check native code
                const origToString = Function.prototype.toString;
                Function.prototype.toString = function() {
                    if (this === Function.prototype.toString) return 'function toString() { [native code] }';
                    return origToString.call(this);
                };
            }");

            await page.SetUserAgentAsync("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

            // Navigate and Wait
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Navigating to {url}...");
            
            // Inject pre-solved cookies before navigation
            await InjectSavedCookiesAsync(page, url);
            
            await page.GoToAsync(url, new NavigationOptions { Timeout = 60000, WaitUntil = new[] { WaitUntilNavigation.DOMContentLoaded } });

            // Give initial page time to load scripts
            await Task.Delay(3000);

            int retries = 0;
            while (retries < 6)
            {
                try
                {
                    var title = await page.GetTitleAsync();
                    var content = await page.GetContentAsync();

                    if (!content.Contains("Just a moment") && !title.Contains("Just a moment") && !content.Contains("Enable JavaScript") && !content.Contains("Checking your browser"))
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Challenge Solved!");
                        break;
                    }
                }
                catch (Exception navEx)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Navigation context shifted: {navEx.Message}");
                }
                
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Waiting for Cloudflare Challenge... ({retries+1}/6)");
                await Task.Delay(5000);
                retries++;
            }

            // Extract Tokens
            _userAgent = await page.EvaluateExpressionAsync<string>("navigator.userAgent");
            var cookies = await page.GetCookiesAsync(url);
            
            _cookies.Clear();
            foreach (var c in cookies)
            {
                _cookies[c.Name] = c.Value;
            }

            return (_userAgent, _cookies);
        }

        public async Task<string> GetContentAsync(string url, string? waitForSelector = null)
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Fetching content directly: {url}");
            await InitializeAsync();
            using var page = await _browser!.NewPageAsync();
            
            // STEALTH: Mask webdriver property
            await page.EvaluateFunctionOnNewDocumentAsync(@"() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                delete navigator.__proto__.webdriver;
                window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
            }");

            await page.SetUserAgentAsync(_userAgent ?? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
            
            // Navigate
            // Relaxed wait condition to prevent timeouts on ad-heavy pages
            // If waitForSelector is provided, we can be more aggressive with initial navigation
            var waitCondition = waitForSelector != null ? WaitUntilNavigation.DOMContentLoaded : WaitUntilNavigation.DOMContentLoaded;
            
            // Inject pre-solved cookies before navigation
            await InjectSavedCookiesAsync(page, url);
            
            await page.GoToAsync(url, new NavigationOptions { Timeout = 60000, WaitUntil = new[] { waitCondition } });
            
            if (!string.IsNullOrEmpty(waitForSelector))
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Waiting for selector: {waitForSelector}...");
                try 
                {
                    await page.WaitForSelectorAsync(waitForSelector, new WaitForSelectorOptions { Timeout = 10000 });
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Selector found!");
                }
                catch 
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Selector '{waitForSelector}' timed out. Returning current content.");
                }
            }

            // Return content (usually JSON if we are hitting API)
             int retries = 0;
             while (retries < 8)
             {
                 try 
                 {
                     var content = await page.GetContentAsync();
                     
                     // Check for Cloudflare challenge
                     if (!string.IsNullOrEmpty(content) && 
                         !content.Contains("Just a moment") && 
                         !content.Contains("Enable JavaScript") &&
                          !content.Contains("Checking your browser"))
                     {
                         Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Content Retrieved! (Length: {content.Length})");
                         
                         var currCookies = await page.GetCookiesAsync(url);
                         _cookies.Clear();
                         _savedCookieParams.Clear();
                         foreach (var c in currCookies)
                         {
                             _cookies[c.Name] = c.Value;
                             _savedCookieParams.Add(new CookieParam
                             {
                                 Name = c.Name,
                                 Value = c.Value,
                                 Domain = c.Domain,
                                 Path = c.Path,
                                 Secure = c.Secure,
                                 HttpOnly = c.HttpOnly,
                                 Expires = c.Expires
                             });
                         }
                         _userAgent = await page.EvaluateExpressionAsync<string>("navigator.userAgent");

                         return content;
                     }
                     else 
                     {
                         Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Still seeing Cloudflare/Loading... ({retries+1}/8)");
                     }
                 }
                 catch (Exception ex)
                 {
                     Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] GetContent failed: {ex.Message}. Retrying...");
                     // If context destroyed, it means page reloaded. Wait for it to settle.
                 }

                 await Task.Delay(3000);
                 retries++;
             }
             
             try 
             {
                 return await page.GetContentAsync() ?? string.Empty;
             }
             catch 
             {
                 return string.Empty;
             }
        }

        /// <summary>
        /// Opens a VISIBLE browser window so the user can manually solve Cloudflare Turnstile CAPTCHA.
        /// After solving, cookies and user-agent are captured and returned.
        /// </summary>
        public async Task<(string? UserAgent, Dictionary<string, string> Cookies)> SolveInteractiveAsync(string url)
        {
            OnStatusUpdate?.Invoke("Opening Browser...");
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Opening VISIBLE browser for manual CAPTCHA solving: {url}");
            
            // Use a separate visible browser (non-headless) for interactive solving
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var downloadPath = System.IO.Path.Combine(appData, "Yomic", "puppeteer");
            
            if (!System.IO.Directory.Exists(downloadPath))
                System.IO.Directory.CreateDirectory(downloadPath);

            var fetcher = new BrowserFetcher(new BrowserFetcherOptions { Path = downloadPath });
            var revisionInfo = await fetcher.DownloadAsync();
            var exePath = revisionInfo.GetExecutablePath();

            IBrowser? visibleBrowser = null;
            try
            {
                visibleBrowser = await Puppeteer.LaunchAsync(new LaunchOptions
                {
                    Headless = false, // VISIBLE window for user interaction
                    ExecutablePath = exePath,
                    Args = new[]
                    {
                        "--no-sandbox",
                        "--disable-setuid-sandbox",
                        "--disable-infobars",
                        "--disable-blink-features=AutomationControlled",
                        "--disable-features=IsolateOrigins,site-per-process",
                        "--window-size=1100,800",
                        "--disable-dev-shm-usage"
                    },
                    DefaultViewport = new ViewPortOptions { Width = 1100, Height = 800 }
                });

                var page = (await visibleBrowser.PagesAsync()).FirstOrDefault() ?? await visibleBrowser.NewPageAsync();

                // STEALTH: Apply same patches
                await page.EvaluateFunctionOnNewDocumentAsync(@"() => {
                    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                    delete navigator.__proto__.webdriver;
                    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
                    window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
                }");

                await page.SetUserAgentAsync("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");

                // Navigate to the URL
                await page.GoToAsync(url, new NavigationOptions { Timeout = 60000, WaitUntil = new[] { WaitUntilNavigation.DOMContentLoaded } });

                OnStatusUpdate?.Invoke("Waiting for CAPTCHA...");
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Visible browser opened. Waiting for user to solve CAPTCHA...");

                // Poll until challenge is solved or browser is closed (max 2 minutes)
                var solved = false;
                for (int i = 0; i < 150; i++) // 150 * 2s = 5 minutes max
                {
                    await Task.Delay(2000);

                    try
                    {
                        // Check if browser was closed by user
                        if (visibleBrowser.IsClosed || page.IsClosed)
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Browser was closed by user.");
                            break;
                        }

                        var title = await page.GetTitleAsync();
                        var content = await page.GetContentAsync();
                        var currentUrl = page.Url;
                        bool isLoginPage = currentUrl.Contains("/login", StringComparison.OrdinalIgnoreCase) || 
                                           currentUrl.Contains("wp-login", StringComparison.OrdinalIgnoreCase) || 
                                           currentUrl.Contains("/register", StringComparison.OrdinalIgnoreCase);

                        if (!content.Contains("Just a moment") && 
                            !title.Contains("Just a moment") && 
                            !content.Contains("Enable JavaScript") &&
                            !content.Contains("Checking your browser") &&
                            !isLoginPage &&
                            content.Length > 500) // Must have actual content
                        {
                            OnStatusUpdate?.Invoke("CAPTCHA Solved!");
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] CAPTCHA Solved! Extracting tokens...");
                            solved = true;
                            break;
                        }
                        else if (isLoginPage)
                        {
                            OnStatusUpdate?.Invoke("Please log in...");
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Poll error: {ex.Message}");
                        // If browser closed, the exception will be caught here
                        if (visibleBrowser.IsClosed) break;
                    }
                }

                if (solved)
                {
                    // Wait for page to fully load and all cookies to settle
                    OnStatusUpdate?.Invoke("Extracting tokens...");
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Challenge solved. Waiting 5s for page to fully load and cookies to settle...");
                    await Task.Delay(5000);
                    
                    // Reload the page to ensure Cloudflare sets all cookies (cf_clearance, __cf_bm, etc.)
                    try 
                    {
                        await page.ReloadAsync(new NavigationOptions { Timeout = 15000, WaitUntil = new[] { WaitUntilNavigation.DOMContentLoaded } });
                        await Task.Delay(3000); // Wait for cookies after reload
                    }
                    catch { /* Reload failed, continue with existing cookies */ }

                    // Extract tokens
                    _userAgent = await page.EvaluateExpressionAsync<string>("navigator.userAgent");
                    var cookies = await page.GetCookiesAsync(url);

                    _cookies.Clear();
                    _savedCookieParams.Clear();
                    
                    foreach (var c in cookies)
                    {
                        _cookies[c.Name] = c.Value;
                        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer]   Cookie: {c.Name} = {c.Value.Substring(0, Math.Min(20, c.Value.Length))}... (Domain: {c.Domain})");
                        
                        // Save full cookie params for injection into headless pages
                        _savedCookieParams.Add(new CookieParam
                        {
                            Name = c.Name,
                            Value = c.Value,
                            Domain = c.Domain,
                            Path = c.Path,
                            Secure = c.Secure,
                            HttpOnly = c.HttpOnly,
                            Expires = c.Expires
                        });
                    }

                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Captured {_cookies.Count} cookies (saved for headless reuse) and UA: {_userAgent?.Substring(0, Math.Min(50, _userAgent?.Length ?? 0))}...");
                    
                    // Keep browser open briefly so user can see the loaded page with favicon
                    OnStatusUpdate?.Invoke("Success!");
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] Browser will close in 5 seconds...");
                    await Task.Delay(5000);
                    
                    return (_userAgent, new Dictionary<string, string>(_cookies));
                }
                else
                {
                    OnStatusUpdate?.Invoke("Timeout or Browser closed.");
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [Puppeteer] CAPTCHA was NOT solved (timeout or browser closed).");
                    return (null, new Dictionary<string, string>());
                }
            }
            finally
            {
                // Always close the visible browser
                if (visibleBrowser != null && !visibleBrowser.IsClosed)
                {
                    try { await visibleBrowser.CloseAsync(); } catch { }
                    try { await visibleBrowser.DisposeAsync(); } catch { }
                }
            }
        }

        public async Task DisposeAsync()
        {
            if (_browser != null)
            {
                await _browser.CloseAsync();
                await _browser.DisposeAsync();
                _browser = null;
            }
        }
    }
}
