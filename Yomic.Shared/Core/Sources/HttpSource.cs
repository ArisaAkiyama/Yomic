using System;
using System.Net.Http;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Net;
using Yomic.Core.Services;
using Polly;
using Polly.Retry;

namespace Yomic.Core.Sources
{
    public abstract class HttpSource : IMangaSource
    {
        public static bool SilenceLogs { get; set; } = false;

        /// <summary>
        /// Unique stable ID generated from the class name.
        /// This ensures no collision between extensions from different developers.
        /// </summary>
        public virtual long Id => GenerateStableId();
        
        private long GenerateStableId()
        {
            var name = GetType().FullName ?? GetType().Name;
            var bytes = System.Text.Encoding.UTF8.GetBytes(name);
            return (long)System.IO.Hashing.XxHash64.HashToUInt64(bytes);
        }
        
        public abstract string Name { get; }
        public abstract string BaseUrl { get; }
        public virtual string Language => "EN"; // Default to EN
        public virtual bool IsHasMorePages => true;
        public virtual int RateLimitDelayMs => 1000;
        
        public virtual string Version => "1.0.0";
        public virtual string IconUrl => "";
        public virtual string Description => "Manga Source";
        public virtual string Author => "Unknown";
        public virtual string IconBackground => "#313244";
        public virtual string IconForeground => "#FF9900";
        
        // DoH Client for bootstrapping resolution
        private static readonly HttpClient _dohClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };

        // Dynamic client management
        private HttpClient? _client;
        protected readonly CookieContainer _cookieContainer = new CookieContainer();
        
        /// <summary>
        /// Public accessor for cookie container, allowing external cookie injection (e.g., after Cloudflare CAPTCHA solving).
        /// </summary>
        public CookieContainer CookieContainer => _cookieContainer;
        
        /// <summary>
        /// Override to true in sources that require VPN proxy.
        /// Default is false, meaning most sources use direct connection with DoH.
        /// </summary>
        public virtual bool RequiresProxy => false;
        
        // Property that gets/creates HttpClient
        protected HttpClient Client
        {
            get
            {
                if (_client == null)
                {
                    _client = CreateHttpClient();
                    
                    // Re-apply extension-specific configuration (headers, etc.)
                    ConfigureClient(_client);
                    
                    if (!SilenceLogs) Console.WriteLine("[HttpSource] HttpClient created");
                }
                
                return _client;
            }
        }

        /// <summary>
        /// Virtual method for extensions to configure the HttpClient with custom headers.
        /// Called every time the HttpClient is created/recreated.
        /// </summary>
        protected virtual void ConfigureClient(HttpClient client)
        {
            // Base implementation - extensions can override to add Origin, Referer, etc.
        }

        protected HttpSource()
        {
            // Client will be created lazily on first access via the Client property
        }
        
        private HttpClient CreateHttpClient()
        {
            SocketsHttpHandler handler = new SocketsHttpHandler
            {
                ConnectCallback = async (context, token) =>
                {
                    var host = context.DnsEndPoint.Host;
                    System.Net.IPAddress? ipAddress = null;
                    var logBuilder = new System.Text.StringBuilder();

                    // List of DoH providers (IPv4)
                    var dohQueries = new[]
                    {
                        (Provider: "https://8.8.8.8/resolve?name={0}&type=A", Type: "IPv4"), // Direct IP
                        (Provider: "https://cloudflare-dns.com/dns-query?name={0}&type=A", Type: "IPv4"),
                        (Provider: "https://dns.google/resolve?name={0}&type=A", Type: "IPv4"),
                    };

                    foreach (var (template, type) in dohQueries)
                    {
                        try
                        {
                            string dohUrl = string.Format(template, host);
                            var request = new HttpRequestMessage(HttpMethod.Get, dohUrl);
                            request.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/dns-json"));
                            
                            var response = await _dohClient.SendAsync(request, token);
                            if (response.IsSuccessStatusCode)
                            {
                                var json = await response.Content.ReadAsStringAsync(token);
                                var obj = Newtonsoft.Json.Linq.JObject.Parse(json);
                                var answers = obj["Answer"];
                                
                                if (answers != null)
                                {
                                    foreach (var ans in answers)
                                    {
                                        var ipStr = ans["data"]?.ToString();
                                        if (System.Net.IPAddress.TryParse(ipStr, out var parsedIp))
                                        {
                                            ipAddress = parsedIp;
                                            logBuilder.AppendLine($"[DoH] Resolved {host} ({type}) via {dohUrl} -> {ipAddress}");
                                            break; 
                                        }
                                    }
                                    
                                    if (ipAddress != null) break;
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            logBuilder.AppendLine($"[DoH] Failed {template}: {ex.Message}");
                        }
                    }

                    if (ipAddress == null)
                    {
                        logBuilder.AppendLine("[DoH] All providers failed. Falling back to System DNS.");
                        var entry = await System.Net.Dns.GetHostEntryAsync(host, token);
                        ipAddress = entry.AddressList.FirstOrDefault();
                    }
                    
                    if (!SilenceLogs) System.Diagnostics.Debug.WriteLine(logBuilder.ToString());
                    if (ipAddress == null) 
                    {
                        if (!SilenceLogs) Console.WriteLine($"[DoH] FAILED resolving {host}!");
                        throw new Exception($"Could not resolve host: {host}\nLogs:\n{logBuilder}");
                    }

                    var socket = new System.Net.Sockets.Socket(System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
                    try
                    {
                        await socket.ConnectAsync(ipAddress, context.DnsEndPoint.Port, token);
                        var networkStream = new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
                        return new DpiBypassStream(networkStream);
                    }
                    catch
                    {
                        socket.Dispose();
                        throw;
                    }
                },
                SslOptions = new System.Net.Security.SslClientAuthenticationOptions
                {
                    RemoteCertificateValidationCallback = (sender, cert, chain, errors) =>
                    {
                        if (errors == System.Net.Security.SslPolicyErrors.None) return true;
                        if (cert != null)
                        {
                            var subject = cert.Subject;
                            if (subject.Contains("ryzukomik", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("komikcast", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("komiku", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("shinigami", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("kiryuu", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("komikindo", StringComparison.OrdinalIgnoreCase) ||
                                subject.Contains("mangaku", StringComparison.OrdinalIgnoreCase))
                            {
                                return true;
                            }
                        }
                        return false;
                    },
                    EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
                },
                PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                AutomaticDecompression = System.Net.DecompressionMethods.All,
                UseCookies = true,
                CookieContainer = _cookieContainer
            };
            
            var client = new HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(15); // Increased timeout for proxy
            
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
            client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
            
            return client;
        }

        public abstract Task<List<Models.Manga>> GetPopularMangaAsync(int page);
        public abstract Task<List<Models.Manga>> GetSearchMangaAsync(string query, int page);
        public abstract Task<Models.Manga> GetMangaDetailsAsync(string url);
        public abstract Task<List<Models.Chapter>> GetChapterListAsync(string mangaUrl);
        public abstract Task<List<string>> GetPageListAsync(string chapterUrl);

        protected async Task<string> GetStringAsync(string url)
        {
            try
            {
                return await GetStringAsyncInternal(url);
            }
            catch (Exception ex)
            {
                WriteToLog($"Request Error ({ex.GetType().Name}): {ex.Message}");
                if (ex is HttpRequestException httpEx && httpEx.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    WriteToLog("404 Not Found. Skipping Cloudflare Fallback.");
                    throw; // Don't try to bypass cloudflare for 404s, it will just time out
                }
                WriteToLog("Attempting Cloudflare/Puppeteer Fallback...");
                
                // FAST PATH: If user already solved CAPTCHA via WebView, skip Steps 1-2 and go directly to headless fetch
                if (CloudflareBypassService.Instance.HasPreSolvedCookies)
                {
                    WriteToLog("Pre-solved cookies detected! Skipping to HEADLESS BROWSER FETCH...");
                    return await CloudflareBypassService.Instance.GetContentAsync(url);
                }

                try
                {
                    // Strategy 1: Update Tokens and Retry HTTP
                    WriteToLog($"Step 1: Fetching Tokens via Headless Browser from {BaseUrl}...");
                    var (ua, cookies) = await CloudflareBypassService.Instance.GetTokensAsync(BaseUrl);
                    
                    if (!string.IsNullOrEmpty(ua)) Client.DefaultRequestHeaders.UserAgent.ParseAdd(ua);
                    if (cookies != null && cookies.Count > 0)
                    {
                         // _cookieContainer = new CookieContainer(); // Cannot reassign readonly
                         var targetHost = new Uri(BaseUrl).Host;
                         foreach (var kv in cookies)
                         {
                             _cookieContainer.Add(new System.Net.Cookie(kv.Key, kv.Value, "/", targetHost));
                         }
                    }

                    // Retry Internal
                    WriteToLog("Step 2: Retrying HTTP Request with new tokens...");
                    return await GetStringAsyncInternal(url);
                }
                catch (Exception retryEx)
                {
                     WriteToLog($"HTTP Retry Failed: {retryEx.Message}");
                     WriteToLog("Step 3: Switching to HEADLESS BROWSER FETCH (Slow but Reliable)");
                     
                     // Strategy 2: Fetch Content directly via Puppeteer
                     return await CloudflareBypassService.Instance.GetContentAsync(url);
                }
            }
        }

        private static readonly ResiliencePipeline _httpRetryPipeline = new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                ShouldHandle = new PredicateBuilder().Handle<HttpRequestException>()
                                                     .Handle<TaskCanceledException>()
                                                     .Handle<TimeoutException>(),
                MaxRetryAttempts = 3,
                Delay = TimeSpan.FromMilliseconds(500),
                BackoffType = DelayBackoffType.Exponential,
                UseJitter = true,
                OnRetry = args =>
                {
                    if (!SilenceLogs) Console.WriteLine($"[Polly Retry #{args.AttemptNumber}] Network glitch: {args.Outcome.Exception?.Message}. Retrying in {args.RetryDelay.TotalMilliseconds:F0}ms...");
                    return default;
                }
            })
            .Build();

        private async Task<string> GetStringAsyncInternal(string url)
        {
            return await _httpRetryPipeline.ExecuteAsync(async (context) =>
            {
                // Ensure Referer is set to BaseUrl (Important for hotlink protection/anti-bot)
                if (Client.DefaultRequestHeaders.Referrer == null)
                {
                    try { Client.DefaultRequestHeaders.Referrer = new Uri(BaseUrl); } catch { }
                }

                WriteToLog($"Downloading: {url}");
                var response = await Client.GetAsync(url);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    var preview = new string(errorContent.Take(200).ToArray());
                    WriteToLog($"Failed: {response.StatusCode}. Content: {preview}..."); 
                    throw new HttpRequestException($"Request failed with {response.StatusCode}", null, response.StatusCode); 
                }
                
                WriteToLog($"Success! ({response.Content.Headers.ContentLength} bytes)");
                return await response.Content.ReadAsStringAsync();
            });
        }

        private void WriteToLog(string message)
        {
            if (SilenceLogs) return;
            string log = $"[{DateTime.Now:HH:mm:ss}] [HttpSource] {message}";
            Console.WriteLine(log);
        }

        protected Task<string> ForceBrowserFetchAsync(string url)
        {
            return ForceBrowserFetchAsync(url, null);
        }

        protected async Task<string> ForceBrowserFetchAsync(string url, string? waitForSelector = null)
        {
              WriteToLog($"FORCING HEADLESS BROWSER FETCH for: {url} (Wait: {waitForSelector ?? "None"})");
              return await CloudflareBypassService.Instance.GetContentAsync(url, waitForSelector);
         }
    }

    public class DpiBypassStream : Stream
    {
        private readonly Stream _innerStream;
        private volatile bool _isFirstWrite = true;

        public DpiBypassStream(Stream innerStream)
        {
            _innerStream = innerStream;
        }

        public override bool CanRead => _innerStream.CanRead;
        public override bool CanSeek => _innerStream.CanSeek;
        public override bool CanWrite => _innerStream.CanWrite;
        public override long Length => _innerStream.Length;
        public override long Position
        {
            get => _innerStream.Position;
            set => _innerStream.Position = value;
        }

        public override void Flush() => _innerStream.Flush();
        public override Task FlushAsync(CancellationToken cancellationToken) => _innerStream.FlushAsync(cancellationToken);

        public override int Read(byte[] buffer, int offset, int count) => _innerStream.Read(buffer, offset, count);
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken) => _innerStream.ReadAsync(buffer, offset, count, cancellationToken);
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default) => _innerStream.ReadAsync(buffer, cancellationToken);

        public override long Seek(long offset, SeekOrigin origin) => _innerStream.Seek(offset, origin);
        public override void SetLength(long value) => _innerStream.SetLength(value);

        public override void Write(byte[] buffer, int offset, int count)
        {
            if (_isFirstWrite && count > 5 && buffer[offset] == 0x16)
            {
                _isFirstWrite = false;
                _innerStream.Write(buffer, offset, 5);
                _innerStream.Flush();
                _innerStream.Write(buffer, offset + 5, count - 5);
            }
            else
            {
                _innerStream.Write(buffer, offset, count);
            }
        }

        public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            if (_isFirstWrite && count > 5 && buffer[offset] == 0x16)
            {
                _isFirstWrite = false;
                await _innerStream.WriteAsync(buffer.AsMemory(offset, 5), cancellationToken);
                await _innerStream.FlushAsync(cancellationToken);
                await _innerStream.WriteAsync(buffer.AsMemory(offset + 5, count - 5), cancellationToken);
            }
            else
            {
                await _innerStream.WriteAsync(buffer.AsMemory(offset, count), cancellationToken);
            }
        }

        public override async ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (_isFirstWrite && buffer.Length > 5 && buffer.Span[0] == 0x16)
            {
                _isFirstWrite = false;
                await _innerStream.WriteAsync(buffer.Slice(0, 5), cancellationToken);
                await _innerStream.FlushAsync(cancellationToken);
                await _innerStream.WriteAsync(buffer.Slice(5), cancellationToken);
            }
            else
            {
                await _innerStream.WriteAsync(buffer, cancellationToken);
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _innerStream.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
