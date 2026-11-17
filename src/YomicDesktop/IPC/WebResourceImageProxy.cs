using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Yomic.Core.Services;

namespace YomicDesktop.IPC
{
    /// <summary>
    /// Handles https://img.yomic.local/* requests inside WebView2 for Manga Covers, Reader Pages, and Extension Icons.
    /// Automatically injects Referer, User-Agent, Sec-Fetch-*, Cloudflare cookies, DoH/DPI bypass, disk caching, and AES-256-CBC decryption.
    /// </summary>
    public class WebResourceImageProxy
    {
        private readonly Dispatcher _dispatcher;
        private readonly NetworkService _networkService;
        private readonly SourceManager _sourceManager;
        private readonly SettingsService? _settingsService;
        private readonly ImageProcessingService _imageProcessor;
        private readonly string _coversDir;
        private readonly string _readerCacheDir;
        private readonly string _iconsDir;

        private static readonly SemaphoreSlim _pageDownloadThrottle = new(4, 4);
        private static readonly SemaphoreSlim _coverDownloadThrottle = new(8, 8);

        public WebResourceImageProxy(
            Dispatcher dispatcher,
            NetworkService networkService,
            SourceManager sourceManager,
            SettingsService? settingsService = null,
            ImageProcessingService? imageProcessor = null)
        {
            _dispatcher = dispatcher;
            _networkService = networkService;
            _sourceManager = sourceManager;
            _settingsService = settingsService;
            _imageProcessor = imageProcessor ?? ImageProcessingService.Instance;

            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _coversDir = Path.Combine(localAppData, "Yomic", "covers");
            _readerCacheDir = Path.Combine(localAppData, "Yomic", "Cache", "Reader");

            var roamingAppData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            _iconsDir = Path.Combine(roamingAppData, "Yomic", "Icons");

            Directory.CreateDirectory(_coversDir);
            Directory.CreateDirectory(_readerCacheDir);
            Directory.CreateDirectory(_iconsDir);
        }

        public static string BuildCoverProxyUrl(long mangaId, string? rawUrl, long sourceId = 0)
        {
            if (string.IsNullOrWhiteSpace(rawUrl)) return string.Empty;
            if (rawUrl.StartsWith("https://img.yomic.local/", StringComparison.OrdinalIgnoreCase) ||
                rawUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                return rawUrl;
            }
            return $"https://img.yomic.local/cover?mangaId={mangaId}&sourceId={sourceId}&url={Uri.EscapeDataString(rawUrl)}";
        }

        public static string BuildPageProxyUrl(string rawUrlOrLocalPath, long sourceId = 0, bool isLocalFile = false, bool force = false)
        {
            if (string.IsNullOrWhiteSpace(rawUrlOrLocalPath)) return string.Empty;
            if (isLocalFile || (!rawUrlOrLocalPath.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                                !rawUrlOrLocalPath.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
            {
                return $"https://img.yomic.local/page?local={Uri.EscapeDataString(rawUrlOrLocalPath)}";
            }
            var forceParam = force ? "&force=1" : string.Empty;
            return $"https://img.yomic.local/page?sourceId={sourceId}&url={Uri.EscapeDataString(rawUrlOrLocalPath)}{forceParam}";
        }

        public static string BuildIconProxyUrl(string pkg, string? rawUrl = null)
        {
            if (string.IsNullOrWhiteSpace(pkg)) return string.Empty;
            if (!string.IsNullOrWhiteSpace(rawUrl) && rawUrl.StartsWith("https://img.yomic.local/", StringComparison.OrdinalIgnoreCase))
            {
                return rawUrl;
            }
            var urlParam = !string.IsNullOrWhiteSpace(rawUrl) ? $"&url={Uri.EscapeDataString(rawUrl)}" : string.Empty;
            return $"https://img.yomic.local/icon?pkg={Uri.EscapeDataString(pkg)}{urlParam}";
        }

        public void Attach(CoreWebView2 webView)
        {
            webView.AddWebResourceRequestedFilter("https://img.yomic.local/*", CoreWebView2WebResourceContext.All);
            webView.WebResourceRequested += OnWebResourceRequested;
        }

        private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
        {
            if (sender is not CoreWebView2 webView) return;
            var uriStr = e.Request.Uri;
            if (!uriStr.StartsWith("https://img.yomic.local/", StringComparison.OrdinalIgnoreCase)) return;

            var deferral = e.GetDeferral();
            _ = HandleRequestAsync(webView, e, uriStr, deferral);
        }

        private async Task HandleRequestAsync(
            CoreWebView2 webView,
            CoreWebView2WebResourceRequestedEventArgs e,
            string uriStr,
            CoreWebView2Deferral deferral)
        {
            try
            {
                var uri = new Uri(uriStr);
                var query = ParseQueryString(uri.Query);
                var path = uri.AbsolutePath.Trim('/').ToLowerInvariant();

                byte[]? bytes = null;
                string contentType = "image/jpeg";

                if (path == "cover")
                {
                    query.TryGetValue("url", out var rawUrl);
                    query.TryGetValue("mangaId", out var mangaIdStr);
                    query.TryGetValue("sourceId", out var srcIdStr);
                    long.TryParse(mangaIdStr, out long mangaId);
                    long.TryParse(srcIdStr, out long sourceId);

                    if (!string.IsNullOrWhiteSpace(rawUrl))
                    {
                        bytes = await FetchCoverBytesAsync(mangaId, rawUrl, sourceId);
                        contentType = DetectContentType(bytes, rawUrl);
                    }
                }
                else if (path == "page")
                {
                    query.TryGetValue("crop", out var cropStr);
                    query.TryGetValue("sharpen", out var sharpenStr);
                    query.TryGetValue("opt", out var optStr);

                    bool shouldCrop = cropStr == "1" || (cropStr != "0" && (_settingsService?.EnableAutoCropBorders ?? false));
                    bool shouldSharpen = sharpenStr == "1" || (sharpenStr != "0" && (_settingsService?.EnableImageSharpening ?? false));
                    bool shouldOpt = optStr == "1" || (optStr != "0" && (_settingsService?.EnableImageOptimization ?? true));
                    int maxDim = _settingsService?.MaxImageDimension ?? 2160;

                    if (query.TryGetValue("local", out var localPath) && !string.IsNullOrWhiteSpace(localPath))
                    {
                        if (IsAllowedLocalImagePath(localPath) && File.Exists(localPath))
                        {
                            bytes = await File.ReadAllBytesAsync(localPath);
                            contentType = DetectContentType(bytes, localPath);
                            if (bytes != null && bytes.Length > 0 && (shouldCrop || shouldSharpen || shouldOpt))
                            {
                                var opts = new ImageProcessingOptions
                                {
                                    EnableOptimization = shouldOpt,
                                    AutoCropBorders = shouldCrop,
                                    EnableSharpening = shouldSharpen,
                                    MaxDimension = maxDim
                                };
                                bytes = _imageProcessor.ProcessPage(bytes, opts);
                                contentType = DetectContentType(bytes, "page.webp");
                            }
                        }
                    }
                    else if (query.TryGetValue("url", out var rawPageUrl) && !string.IsNullOrWhiteSpace(rawPageUrl))
                    {
                        query.TryGetValue("sourceId", out var srcIdStr);
                        long.TryParse(srcIdStr, out long sourceId);
                        query.TryGetValue("force", out var forceStr);
                        bool force = forceStr == "1";
                        bytes = await FetchPageBytesAsync(rawPageUrl, sourceId, shouldCrop, shouldSharpen, shouldOpt, maxDim, force);
                        contentType = DetectContentType(bytes, "page.webp");
                    }
                }
                else if (path == "icon")
                {
                    query.TryGetValue("pkg", out var pkg);
                    query.TryGetValue("url", out var iconUrl);
                    if (!string.IsNullOrWhiteSpace(pkg) || !string.IsNullOrWhiteSpace(iconUrl))
                    {
                        bytes = await FetchIconBytesAsync(pkg ?? "ext", iconUrl);
                        contentType = DetectContentType(bytes, iconUrl ?? "icon.png");
                    }
                }

                await _dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        if (bytes != null && bytes.Length > 0)
                        {
                            var ms = new MemoryStream(bytes);
                            var headers = $"Content-Type: {contentType}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: public, max-age=86400";
                            e.Response = webView.Environment.CreateWebResourceResponse(ms, 200, "OK", headers);
                        }
                        else
                        {
                            e.Response = webView.Environment.CreateWebResourceResponse(Stream.Null, 404, "Not Found", "Access-Control-Allow-Origin: *");
                        }
                    }
                    finally
                    {
                        deferral.Complete();
                    }
                });
            }
            catch (Exception ex)
            {
                LogService.Debug("ImageProxy", $"Error serving {uriStr}: {ex.Message}");
                await _dispatcher.InvokeAsync(() =>
                {
                    try
                    {
                        e.Response = webView.Environment.CreateWebResourceResponse(Stream.Null, 500, "Internal Error", "Access-Control-Allow-Origin: *");
                    }
                    catch { }
                    finally
                    {
                        deferral.Complete();
                    }
                });
            }
        }

        private async Task<byte[]?> FetchCoverBytesAsync(long mangaId, string rawUrl, long sourceId)
        {
            // 1. Check local covers directory by mangaId or URL MD5
            if (mangaId > 0)
            {
                var idFile = Path.Combine(_coversDir, $"{mangaId}.jpg");
                if (File.Exists(idFile))
                {
                    try { return await File.ReadAllBytesAsync(idFile); } catch { }
                }
                var idFileAlt = Path.Combine(_coversDir, $"cover_{mangaId}.jpg");
                if (File.Exists(idFileAlt))
                {
                    try { return await File.ReadAllBytesAsync(idFileAlt); } catch { }
                }
            }

            var urlHash = ComputeMd5Hex(rawUrl);
            var cachedPath = Path.Combine(_coversDir, $"url_{urlHash}.cache");
            if (File.Exists(cachedPath))
            {
                try { return await File.ReadAllBytesAsync(cachedPath); } catch { }
            }

            // If rawUrl is a local file path
            if (!rawUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !rawUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase) &&
                IsAllowedLocalImagePath(rawUrl) &&
                File.Exists(rawUrl))
            {
                return await File.ReadAllBytesAsync(rawUrl);
            }

            await _coverDownloadThrottle.WaitAsync();
            try
            {
                var data = await DownloadImageWithHeadersAsync(rawUrl, sourceId);
                if (data != null && data.Length > 0)
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await File.WriteAllBytesAsync(cachedPath, data);
                            if (mangaId > 0)
                            {
                                var idFile = Path.Combine(_coversDir, $"{mangaId}.jpg");
                                if (!File.Exists(idFile))
                                {
                                    await File.WriteAllBytesAsync(idFile, data);
                                }
                            }
                        }
                        catch { }
                    });
                }
                return data;
            }
            finally
            {
                _coverDownloadThrottle.Release();
            }
        }

        private async Task<byte[]?> FetchPageBytesAsync(
            string rawUrl,
            long sourceId,
            bool shouldCrop,
            bool shouldSharpen,
            bool shouldOpt,
            int maxDim,
            bool force = false)
        {
            if (!rawUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !rawUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                if (IsAllowedLocalImagePath(rawUrl) && File.Exists(rawUrl))
                {
                    return await File.ReadAllBytesAsync(rawUrl);
                }
                return null;
            }

            var urlHash = ComputeMd5Hex(rawUrl);
            var cacheKey = $"{urlHash}_{(shouldCrop ? "c1" : "c0")}_{(shouldSharpen ? "s1" : "s0")}_{(shouldOpt ? "o1" : "o0")}_{maxDim}";
            var cacheFilePath = Path.Combine(_readerCacheDir, $"{cacheKey}.cache");

            if (!force && File.Exists(cacheFilePath))
            {
                try
                {
                    var cached = await File.ReadAllBytesAsync(cacheFilePath);
                    if (cached.Length > 0) return cached;
                }
                catch { }
            }

            // Check if we already have the raw downloaded image on disk
            byte[]? rawBytes = null;
            var rawFilePath = Path.Combine(_readerCacheDir, $"{urlHash}.raw");
            if (!force && File.Exists(rawFilePath))
            {
                try
                {
                    rawBytes = await File.ReadAllBytesAsync(rawFilePath);
                }
                catch { }
            }

            // If not found locally, download from source
            if (rawBytes == null || rawBytes.Length == 0)
            {
                await _pageDownloadThrottle.WaitAsync();
                try
                {
                    rawBytes = await DownloadImageWithHeadersAsync(rawUrl, sourceId);
                    if (rawBytes != null && rawBytes.Length > 0)
                    {
                        _ = Task.Run(async () =>
                        {
                            try { await File.WriteAllBytesAsync(rawFilePath, rawBytes); } catch { }
                        });
                    }
                }
                finally
                {
                    _pageDownloadThrottle.Release();
                }
            }

            if (rawBytes == null || rawBytes.Length == 0) return null;

            byte[] result = rawBytes;
            if (shouldCrop || shouldSharpen || shouldOpt)
            {
                var opts = new ImageProcessingOptions
                {
                    EnableOptimization = shouldOpt,
                    AutoCropBorders = shouldCrop,
                    EnableSharpening = shouldSharpen,
                    MaxDimension = maxDim
                };
                result = _imageProcessor.ProcessPage(rawBytes, opts);
            }

            _ = Task.Run(async () =>
            {
                try { await File.WriteAllBytesAsync(cacheFilePath, result); } catch { }
            });

            return result;
        }

        private async Task<byte[]?> FetchIconBytesAsync(string pkg, string? iconUrl)
        {
            var safeName = string.Join("_", pkg.Split(Path.GetInvalidFileNameChars()));

            // 1. Check bundled Plugins/Catalog/icons/{safeName}.png
            var bundledCatalogIcon = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "Catalog", "icons", $"{safeName}.png");
            if (File.Exists(bundledCatalogIcon))
            {
                try { return await File.ReadAllBytesAsync(bundledCatalogIcon); } catch { }
            }

            // 2. Check bundled Plugins/icons/{safeName}.png
            var bundledPluginsIcon = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "icons", $"{safeName}.png");
            if (File.Exists(bundledPluginsIcon))
            {
                try { return await File.ReadAllBytesAsync(bundledPluginsIcon); } catch { }
            }

            // 3. Check AppData cache %AppData%/Yomic/Icons/{safeName}.png
            var iconPath = Path.Combine(_iconsDir, $"{safeName}.png");
            if (File.Exists(iconPath))
            {
                try { return await File.ReadAllBytesAsync(iconPath); } catch { }
            }

            // 4. Download from remote URL if provided
            if (!string.IsNullOrWhiteSpace(iconUrl))
            {
                var data = await DownloadImageWithHeadersAsync(iconUrl, 0);
                if (data != null && data.Length > 0)
                {
                    try { await File.WriteAllBytesAsync(iconPath, data); } catch { }
                    return data;
                }
            }

            return null;
        }

        private async Task<byte[]?> DownloadImageWithHeadersAsync(string rawUrl, long sourceId)
        {
            string requestUrl = rawUrl;
            var customHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (rawUrl.Contains('|'))
            {
                var parts = rawUrl.Split('|', StringSplitOptions.RemoveEmptyEntries);
                requestUrl = parts[0].Trim();
                for (int i = 1; i < parts.Length; i++)
                {
                    var pair = parts[i].Split('=', 2);
                    if (pair.Length == 2)
                    {
                        customHeaders[pair[0].Trim()] = pair[1].Trim();
                    }
                }
            }

            var req = new HttpRequestMessage(HttpMethod.Get, requestUrl)
            {
                Version = HttpVersion.Version20,
                VersionPolicy = HttpVersionPolicy.RequestVersionOrLower
            };

            // Referer header
            if (customHeaders.TryGetValue("Referer", out var customRef))
            {
                if (!string.Equals(customRef, "none", StringComparison.OrdinalIgnoreCase) &&
                    !string.Equals(customRef, "null", StringComparison.OrdinalIgnoreCase) &&
                    Uri.TryCreate(customRef, UriKind.Absolute, out var refUri))
                {
                    req.Headers.Referrer = refUri;
                }
            }
            else
            {
                var src = sourceId != 0 ? _sourceManager.GetSource(sourceId) : null;
                if (src != null && !string.IsNullOrEmpty(src.BaseUrl) && Uri.TryCreate(src.BaseUrl, UriKind.Absolute, out var srcUri))
                {
                    req.Headers.Referrer = srcUri;
                }
                else if (Uri.TryCreate(requestUrl, UriKind.Absolute, out var reqUri))
                {
                    req.Headers.Referrer = new Uri(reqUri.GetLeftPart(UriPartial.Authority) + "/");
                }
            }

            if (customHeaders.TryGetValue("Origin", out var originVal))
            {
                req.Headers.TryAddWithoutValidation("Origin", originVal);
            }

            if (customHeaders.TryGetValue("User-Agent", out var ua1))
            {
                req.Headers.UserAgent.TryParseAdd(ua1);
            }
            else if (customHeaders.TryGetValue("UserAgent", out var ua2))
            {
                req.Headers.UserAgent.TryParseAdd(ua2);
            }
            else
            {
                req.Headers.UserAgent.TryParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
            }

            // Inject Cloudflare cookies if present for host
            if (CloudflareBypassService.Instance != null && Uri.TryCreate(requestUrl, UriKind.Absolute, out var targetUri))
            {
                var relevantCookies = CloudflareBypassService.Instance.SavedCookies
                    .Where(c => targetUri.Host.Contains(c.Domain.Trim('.'), StringComparison.OrdinalIgnoreCase))
                    .ToList();

                if (relevantCookies.Count > 0)
                {
                    var cookieHeader = string.Join("; ", relevantCookies.Select(c => $"{c.Name}={c.Value}"));
                    req.Headers.TryAddWithoutValidation("Cookie", cookieHeader);
                }

                if (!string.IsNullOrEmpty(CloudflareBypassService.Instance.BypassUserAgent) &&
                    requestUrl.Contains("nhentai", StringComparison.OrdinalIgnoreCase))
                {
                    req.Headers.Remove("User-Agent");
                    req.Headers.TryAddWithoutValidation("User-Agent", CloudflareBypassService.Instance.BypassUserAgent);
                }
            }

            if (requestUrl.Contains("mangamillion", StringComparison.OrdinalIgnoreCase))
            {
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "empty");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "cors");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "same-site");
                req.Headers.TryAddWithoutValidation("Origin", "https://mangamillion.shueisha.co.jp");
            }
            else
            {
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "image");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "no-cors");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "cross-site");
            }

            req.Headers.TryAddWithoutValidation("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

            byte[]? data = null;
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(25));
            using var client = _networkService.CreateOptimizedHttpClient();
            using var response = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode == HttpStatusCode.Forbidden || requestUrl.Contains("gmbr.pro", StringComparison.OrdinalIgnoreCase))
                {
                    var refHeader = req.Headers.Referrer?.ToString() ?? "https://www.manhwaindo.my/";
                    data = await DownloadWithCurlFallbackAsync(requestUrl, refHeader, cts.Token);
                }
                if (data == null || data.Length == 0)
                {
                    return null;
                }
            }
            else
            {
                data = await response.Content.ReadAsByteArrayAsync(cts.Token);
            }

            // Decrypt AES-256-CBC if key and IV are passed in customHeaders (e.g. MangaMillion)
            if (data != null && data.Length > 0 &&
                customHeaders.TryGetValue("AesKey", out var aesKey) &&
                customHeaders.TryGetValue("AesIv", out var aesIv))
            {
                data = DecryptAes256Cbc(data, aesKey, aesIv);
            }

            return data;
        }

        private bool IsAllowedLocalImagePath(string candidatePath)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(candidatePath)) return false;
                string fullPath = Path.GetFullPath(candidatePath);

                string downloadsRoot = Path.GetFullPath(DownloadPathService.BaseDirectory);
                string coversRoot = Path.GetFullPath(_coversDir);
                string cacheRoot = Path.GetFullPath(_readerCacheDir);
                string iconsRoot = Path.GetFullPath(_iconsDir);
                string bundledPluginsRoot = Path.GetFullPath(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins"));

                bool inAllowedDir =
                    fullPath.StartsWith(downloadsRoot, StringComparison.OrdinalIgnoreCase) ||
                    fullPath.StartsWith(coversRoot, StringComparison.OrdinalIgnoreCase) ||
                    fullPath.StartsWith(cacheRoot, StringComparison.OrdinalIgnoreCase) ||
                    fullPath.StartsWith(iconsRoot, StringComparison.OrdinalIgnoreCase) ||
                    fullPath.StartsWith(bundledPluginsRoot, StringComparison.OrdinalIgnoreCase);

                if (!inAllowedDir) return false;

                string ext = Path.GetExtension(fullPath);
                return ext.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".webp", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".gif", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".bmp", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".avif", StringComparison.OrdinalIgnoreCase) ||
                       ext.Equals(".cache", StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private static async Task<byte[]?> DownloadWithCurlFallbackAsync(string url, string referer, CancellationToken ct)
        {
            try
            {
                if (!Uri.TryCreate(url, UriKind.Absolute, out var validUri) ||
                    (validUri.Scheme != Uri.UriSchemeHttp && validUri.Scheme != Uri.UriSchemeHttps))
                {
                    return null;
                }

                string safeReferer = (referer ?? string.Empty).Replace("\r", string.Empty).Replace("\n", string.Empty);

                var psi = new ProcessStartInfo
                {
                    FileName = "curl.exe",
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                psi.ArgumentList.Add("-s");
                psi.ArgumentList.Add("-L");
                psi.ArgumentList.Add("--max-time");
                psi.ArgumentList.Add("20");
                psi.ArgumentList.Add("-H");
                psi.ArgumentList.Add($"Referer: {safeReferer}");
                psi.ArgumentList.Add("-A");
                psi.ArgumentList.Add("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
                psi.ArgumentList.Add(validUri.AbsoluteUri);

                using var proc = Process.Start(psi);
                if (proc == null) return null;
                using var ms = new MemoryStream();
                await proc.StandardOutput.BaseStream.CopyToAsync(ms, ct);
                await proc.WaitForExitAsync(ct);
                return ms.Length > 0 ? ms.ToArray() : null;
            }
            catch
            {
                return null;
            }
        }

        private static byte[] DecryptAes256Cbc(byte[] cipherText, string keyHex, string ivHex)
        {
            try
            {
                byte[] key = Convert.FromHexString(keyHex);
                byte[] iv = Convert.FromHexString(ivHex);
                using var aes = Aes.Create();
                aes.Key = key;
                aes.IV = iv;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                using var decryptor = aes.CreateDecryptor();
                return decryptor.TransformFinalBlock(cipherText, 0, cipherText.Length);
            }
            catch
            {
                return cipherText;
            }
        }

        private static string DetectContentType(byte[]? bytes, string urlOrPath)
        {
            if (bytes != null && bytes.Length >= 12)
            {
                // PNG: 89 50 4E 47
                if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
                    return "image/png";
                // JPEG: FF D8 FF
                if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
                    return "image/jpeg";
                // GIF: 47 49 46 38
                if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x38)
                    return "image/gif";
                // WEBP: RIFF....WEBP
                if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[2] == 0x46 && bytes[3] == 0x46 &&
                    bytes[8] == 0x57 && bytes[9] == 0x45 && bytes[10] == 0x42 && bytes[11] == 0x50)
                    return "image/webp";
                // AVIF: ....ftypavif
                if (bytes[4] == 0x66 && bytes[5] == 0x74 && bytes[6] == 0x79 && bytes[7] == 0x70)
                    return "image/avif";
            }

            if (urlOrPath.Contains(".png", StringComparison.OrdinalIgnoreCase)) return "image/png";
            if (urlOrPath.Contains(".webp", StringComparison.OrdinalIgnoreCase)) return "image/webp";
            if (urlOrPath.Contains(".avif", StringComparison.OrdinalIgnoreCase)) return "image/avif";
            if (urlOrPath.Contains(".gif", StringComparison.OrdinalIgnoreCase)) return "image/gif";
            if (urlOrPath.Contains(".svg", StringComparison.OrdinalIgnoreCase)) return "image/svg+xml";
            return "image/jpeg";
        }

        private static string ComputeMd5Hex(string input)
        {
            var bytes = MD5.HashData(Encoding.UTF8.GetBytes(input));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        private static Dictionary<string, string> ParseQueryString(string query)
        {
            var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(query)) return dict;
            var trimmed = query.TrimStart('?');
            foreach (var part in trimmed.Split('&', StringSplitOptions.RemoveEmptyEntries))
            {
                var kv = part.Split('=', 2);
                var key = Uri.UnescapeDataString(kv[0]);
                var val = kv.Length > 1 ? Uri.UnescapeDataString(kv[1]) : string.Empty;
                dict[key] = val;
            }
            return dict;
        }
    }
}
