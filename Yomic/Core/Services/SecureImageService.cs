using System;
using System.IO;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using System.Linq;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using PuppeteerSharp;
using System.Threading;

namespace Yomic.Core.Services
{
    public class SecureImageService
    {
        private readonly NetworkService _networkService;
        private readonly ImageCacheService _imageCacheService;
        private readonly string _cacheFolder;
        private HttpClient? _sharedClient;
        private static readonly SemaphoreSlim _downloadSemaphore = new SemaphoreSlim(3, 3);

        public SecureImageService(NetworkService networkService, ImageCacheService imageCacheService)
        {
            _networkService = networkService;
            _imageCacheService = imageCacheService;
            
            _networkService.ConnectionReset += (s, e) => {
                var oldClient = _sharedClient;
                _sharedClient = null;
                oldClient?.Dispose();
            };
            
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _cacheFolder = Path.Combine(appData, "Yomic", "covers");
            
            if (!Directory.Exists(_cacheFolder))
            {
                Directory.CreateDirectory(_cacheFolder);
            }
        }

        public async Task<Bitmap?> LoadImageAsync(string url, string? referer = null, int? decodeWidth = null)
        {
            if (string.IsNullOrEmpty(url)) return null;

            string? userAgent = null;

            // Handle URL|Referer= and URL|UserAgent= syntax
            // Example: https://url.com/image.jpg|Referer=xyz|UserAgent=abc
            if (url.Contains("|"))
            {
                var parts = url.Split(new[] { "|" }, StringSplitOptions.RemoveEmptyEntries);
                url = parts[0];

                for (int i = 1; i < parts.Length; i++)
                {
                    if (parts[i].StartsWith("Referer="))
                        referer = parts[i].Substring("Referer=".Length);
                    else if (parts[i].StartsWith("UserAgent="))
                        userAgent = parts[i].Substring("UserAgent=".Length);
                }
            }

            // Avalonia Bitmap does not natively support AVIF on all platforms.
            // Transparently proxy AVIF images through wsrv.nl to convert them to webp.
            if (url.Contains(".avif", StringComparison.OrdinalIgnoreCase))
            {
                url = $"https://wsrv.nl/?url={Uri.EscapeDataString(url)}&output=webp";
            }

            // 1. Check Memory Cache
            var cached = _imageCacheService.GetImage(url);
            if (cached != null) return cached;

            // 2. Generate Cache Key
            string cacheKey = GenerateCacheKey(url);
            string cachePath = Path.Combine(_cacheFolder, cacheKey);

            // 3. Check Disk Cache
            if (File.Exists(cachePath))
            {
                try
                {
                    using var stream = File.OpenRead(cachePath);
                    var bitmap = decodeWidth.HasValue 
                        ? Bitmap.DecodeToWidth(stream, decodeWidth.Value)
                        : new Bitmap(stream);
                    _imageCacheService.AddImage(url, bitmap);
                    return bitmap;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[SecureImageService] Corrupt cache {cacheKey}: {ex.Message}");
                    try { File.Delete(cachePath); } catch { }
                }
            }

            // 4. Download
            return await DownloadAndCacheAsync(url, cachePath, referer, userAgent, decodeWidth);
        }

        public void ClearDiskCache()
        {
            try
            {
                _imageCacheService.Clear();
                if (!Directory.Exists(_cacheFolder)) return;

                foreach (var file in Directory.GetFiles(_cacheFolder))
                {
                    try { File.Delete(file); } catch { }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SecureImageService] Error clearing disk cache: {ex.Message}");
            }
        }

        private async Task<Bitmap?> DownloadAndCacheAsync(string url, string cachePath, string? referer, string? userAgent, int? decodeWidth)
        {
            await _downloadSemaphore.WaitAsync();
            try
            {
                var client = _sharedClient ??= _networkService.CreateOptimizedHttpClient();
                var req = new HttpRequestMessage(HttpMethod.Get, url);

                // Apply custom User-Agent if provided
                if (!string.IsNullOrEmpty(userAgent))
                {
                    req.Headers.Remove("User-Agent");
                    req.Headers.TryAddWithoutValidation("User-Agent", userAgent);
                }
                
                // Smart Referer
                if (!string.IsNullOrEmpty(referer))
                {
                    req.Headers.Referrer = new Uri(referer);
                    // System.Diagnostics.Debug.WriteLine($"[SecureImageService] Using provided referer: {referer}");
                }
                else
                {
                    // Fallback heuristics based on image URL domain
                    if (url.Contains("komikcast")) req.Headers.Referrer = new Uri("https://komikcast.ch/");
                    else if (url.Contains("mangabats") || url.Contains("2xstorage.com") || url.Contains("waitst.com")) req.Headers.Referrer = new Uri("https://www.mangabats.com/");
                    else if (url.Contains("weebcentral")) req.Headers.Referrer = new Uri("https://weebcentral.com/");
                    else if (url.Contains("komiku") || url.Contains("img.komiku")) req.Headers.Referrer = new Uri("https://komiku.org/");
                    else
                    {
                        // Use the image URL's own origin as referer
                        try
                        {
                            var uri = new Uri(url);
                            req.Headers.Referrer = new Uri($"{uri.Scheme}://{uri.Host}/");
                        }
                        catch
                        {
                            req.Headers.Referrer = new Uri("https://komiku.org/");
                        }
                    }
                }

                try
                {
                    var targetDomain = new Uri(url).Host;
                    
                    // Inject Cloudflare bypass cookies if any exist for this domain
                    var relevantCookies = CloudflareBypassService.Instance.SavedCookies
                        .Where(c => targetDomain.Contains(c.Domain.Trim('.')))
                        .ToList();

                    if (relevantCookies.Count > 0)
                    {
                        var cookieString = string.Join("; ", relevantCookies.Select(c => $"{c.Name}={c.Value}"));
                        req.Headers.Add("Cookie", cookieString);
                    }
                    
                    
                    // Override User-Agent if we bypassed recently 
                    if (relevantCookies.Count > 0 && !string.IsNullOrEmpty(CloudflareBypassService.Instance.BypassUserAgent))
                    {
                        req.Headers.Remove("User-Agent");
                        req.Headers.TryAddWithoutValidation("User-Agent", CloudflareBypassService.Instance.BypassUserAgent);
                    }
                }
                catch (Exception cookieEx)
                {
                    System.Diagnostics.Debug.WriteLine($"[SecureImageService] Cookie Injection Error: {cookieEx.Message}");
                }

                using var response = await client.SendAsync(req);
                if (!response.IsSuccessStatusCode)
                {
                    System.Diagnostics.Debug.WriteLine($"[SecureImageService] Failed {response.StatusCode} for {url}");
                    return null;
                }

                var data = await response.Content.ReadAsByteArrayAsync();
                if (data.Length == 0) return null;

                // Save to Disk
                await File.WriteAllBytesAsync(cachePath, data);

                // Load to Memory
                using var ms = new MemoryStream(data);
                var bitmap = decodeWidth.HasValue
                    ? Bitmap.DecodeToWidth(ms, decodeWidth.Value)
                    : new Bitmap(ms);
                _imageCacheService.AddImage(url, bitmap);
                
                return bitmap;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SecureImageService] Download error: {ex.Message}");
                return null;
            }
            finally
            {
                _downloadSemaphore.Release();
            }
        }

        private string GenerateCacheKey(string url)
        {
            using var md5 = MD5.Create();
            var inputBytes = Encoding.ASCII.GetBytes(url);
            var hashBytes = md5.ComputeHash(inputBytes);
            
            var sb = new StringBuilder();
            for (int i = 0; i < hashBytes.Length; i++) sb.Append(hashBytes[i].ToString("X2"));

            string ext = ".jpg";
            try 
            {
                var uriPath = new Uri(url).AbsolutePath;
                var possibleExt = Path.GetExtension(uriPath);
                if (!string.IsNullOrEmpty(possibleExt)) ext = possibleExt;
            }
            catch { }

            return $"{sb}{ext}";
        }
    }
}
