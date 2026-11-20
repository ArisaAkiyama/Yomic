using System;

using System.Collections.Generic;

using System.IO;

using System.Linq;

using System.Net;

using System.Net.Http;

using System.Net.Sockets;

using System.Text.Json;

using System.Text.Json.Serialization;

using System.Text.RegularExpressions;

using System.Threading;

using System.Threading.Tasks;

using Yomic.Core.Sources;

namespace Yomic.Core.Services

{

    public class ExtensionSourceDto

    {

        [JsonPropertyName("name")]

        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("lang")]

        public string Lang { get; set; } = string.Empty;

        [JsonPropertyName("id")]

        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("baseUrl")]

        public string BaseUrl { get; set; } = string.Empty;

    }

    public class ExtensionEntryDto

    {

        [JsonPropertyName("name")]

        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("pkg")]

        public string Pkg { get; set; } = string.Empty;

        [JsonPropertyName("apk")]

        public string Apk { get; set; } = string.Empty;

        [JsonPropertyName("lang")]

        public string Lang { get; set; } = string.Empty;

        [JsonPropertyName("code")]

        public int VersionCode { get; set; }

        [JsonPropertyName("version")]

        public string Version { get; set; } = string.Empty;

        [JsonPropertyName("nsfw")]

        public int Nsfw { get; set; }

        [JsonPropertyName("icon")]

        public string IconUrl { get; set; } = string.Empty;

        [JsonPropertyName("sources")]

        public List<ExtensionSourceDto>? Sources { get; set; }

    }

    public class ExtensionFullState

    {

        public string Id { get; set; } = string.Empty;

        public string Pkg { get; set; } = string.Empty;

        public string ScriptFileName { get; set; } = string.Empty;

        public long SourceId { get; set; }

        public string Name { get; set; } = string.Empty;

        public string Version { get; set; } = string.Empty;

        public int VersionCode { get; set; }

        public string Lang { get; set; } = "ID";

        public bool IsNsfw { get; set; }

        public bool Installed { get; set; }

        public bool HasUpdate { get; set; }

        public bool IsCloudflareProtected { get; set; }

        public string BaseUrl { get; set; } = string.Empty;

        public string AccentColor { get; set; } = "#2563EB";

        public string FileSizeText { get; set; } = string.Empty;

        public string IconUrl { get; set; } = string.Empty;

        public string Status { get; set; } = "online";

    }

    public class ExtensionRepositoryService

    {

        private readonly SourceManager _sourceManager;

        private readonly SettingsService _settingsService;

        private readonly SourceStatusService _statusService;

        private readonly HttpClient _httpClient;

        private const string RepoOwner = "ArisaAkiyama";

        private const string RepoName = "extension-yomic";

        private const string RepoBranch = "repo";

        private const string MainBranch = "main";

        private List<ExtensionEntryDto> _cachedRepoEntries = new();

        private static readonly string[] AccentPalette =

        {

            "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706",

            "#0891B2", "#4F46E5", "#DB2777", "#0D9488", "#EA580C"

        };

        public ExtensionRepositoryService(

            SourceManager sourceManager,

            SettingsService settingsService,

            SourceStatusService statusService)

        {

            _sourceManager = sourceManager;

            _settingsService = settingsService;

            _statusService = statusService;

            var handler = new SocketsHttpHandler

            {

                AutomaticDecompression = DecompressionMethods.All,

                ConnectTimeout = TimeSpan.FromSeconds(10),

                PooledConnectionLifetime = TimeSpan.FromMinutes(2),

                ConnectCallback = async (context, token) =>

                {

                    var host = context.DnsEndPoint.Host;

                    var port = context.DnsEndPoint.Port;

                    IPAddress[]? addresses = null;

                    try

                    {

                        using var dnsClient = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };

                        dnsClient.DefaultRequestHeaders.Add("Accept", "application/dns-json");

                        var dohUrl = $"https://1.1.1.1/dns-query?name={Uri.EscapeDataString(host)}&type=A";

                        var dnsResp = await dnsClient.GetStringAsync(dohUrl, token);

                        using var doc = JsonDocument.Parse(dnsResp);

                        if (doc.RootElement.TryGetProperty("Answer", out var answers))

                        {

                            var ipList = new List<IPAddress>();

                            foreach (var ans in answers.EnumerateArray())

                            {

                                if (ans.TryGetProperty("type", out var t) && t.GetInt32() == 1 &&

                                    ans.TryGetProperty("data", out var d))

                                {

                                    var ipStr = d.GetString();

                                    if (!string.IsNullOrEmpty(ipStr) && IPAddress.TryParse(ipStr, out var parsedIp))

                                    {

                                        ipList.Add(parsedIp);

                                    }

                                }

                            }

                            if (ipList.Count > 0) addresses = ipList.ToArray();

                        }

                    }

                    catch { }

                    if (addresses == null || addresses.Length == 0)

                    {

                        addresses = await Dns.GetHostAddressesAsync(host, token);

                    }

                    var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };

                    try

                    {

                        await socket.ConnectAsync(addresses, port, token);

                        return new NetworkStream(socket, ownsSocket: true);

                    }

                    catch

                    {

                        socket.Dispose();

                        throw;

                    }

                }

            };

            _httpClient = new HttpClient(handler)

            {

                Timeout = TimeSpan.FromSeconds(15)

            };

            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Yomic/2.0");

            _httpClient.DefaultRequestHeaders.Accept.ParseAdd("application/json, text/plain, */*");

        }

        private string GetCacheFilePath()

        {

            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);

            var dir = Path.Combine(appData, "Yomic");

            Directory.CreateDirectory(dir);

            return Path.Combine(dir, "extensions_index.json");

        }

        private string GetBundledCatalogDir()

        {

            return Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "Catalog");

        }

        private static string CleanExtensionName(string rawName)

        {

            if (string.IsNullOrWhiteSpace(rawName)) return string.Empty;

            var cleaned = rawName.Replace("Yomic:", "", StringComparison.OrdinalIgnoreCase).Trim();

            cleaned = Regex.Replace(cleaned, @"\s*\([A-Za-z]+\)\s*$", "").Trim();

            return cleaned;

        }

        public static bool IsAdultIndicator(params string?[] candidates)
        {
            if (candidates == null) return false;
            foreach (var c in candidates)
            {
                if (string.IsNullOrWhiteSpace(c)) continue;
                var low = c.ToLowerInvariant();
                if (low.Contains("18+") || low.Contains("dewasa") || low.Contains("hentai") ||
                    low.Contains("doujin") || low.Contains("smut") || low.Contains("crot") ||
                    low.Contains("porn") || low.Contains("xxx") || low.Contains("ecchi") ||
                    low.Contains("eromanga") || low.Contains("nhentai") || low.Contains("nekopoi") ||
                    low.Contains("mangapoi") || low.Contains("kumapoi") || low.Contains("kumopoi") ||
                    low.Contains("mangasusu") || low.Contains("r-18") || low.Contains("r18") ||
                    low.Contains("mature") || low.Contains("adult") || low.Contains("guro") ||
                    low.Contains("yaoi") || low.Contains("yuri"))
                {
                    return true;
                }
            }
            return false;
        }

        private static int CalculateVersionCode(string version)

        {

            if (string.IsNullOrEmpty(version)) return 1;

            var cleanVer = version.TrimStart('v', 'V').Trim();

            var parts = cleanVer.Split('.');

            if (parts.Length >= 2 &&

                int.TryParse(parts[0], out int major) &&

                int.TryParse(parts[1], out int minor))

            {

                int patch = 0;

                if (parts.Length >= 3) int.TryParse(parts[2], out patch);

                return (major * 100) + (minor * 10) + patch;

            }

            return 1;

        }

        private static string NormalizeLang(string? rawLang)

        {

            if (string.IsNullOrWhiteSpace(rawLang)) return "ID";

            var upper = rawLang.Trim().ToUpperInvariant();

            if (upper == "ID" || upper == "IN") return "ID";

            if (upper == "EN") return "EN";

            return "ALL";

        }

        private static string PickAccentColor(string key)

        {

            if (string.IsNullOrEmpty(key)) return AccentPalette[0];

            uint hash = 2166136261;

            foreach (char c in key)

            {

                hash ^= c;

                hash *= 16777619;

            }

            return AccentPalette[hash % AccentPalette.Length];

        }

        private string GetPluginFileSizeText(string? scriptFileName, string? fallbackName = null)

        {

            try

            {

                var pluginsDir = SourceManager.GetUserPluginsDirectory();

                if (!Directory.Exists(pluginsDir)) return string.Empty;

                if (!string.IsNullOrEmpty(scriptFileName))

                {

                    var exactPath = Path.Combine(pluginsDir, scriptFileName);

                    if (File.Exists(exactPath))

                    {

                        double kb = new FileInfo(exactPath).Length / 1024.0;

                        return $"{kb:0.#} KB";

                    }

                }

                if (!string.IsNullOrEmpty(fallbackName))

                {

                    var cleanTarget = CleanExtensionName(fallbackName);

                    foreach (var file in Directory.GetFiles(pluginsDir, "*.js"))

                    {

                        var fileNameNoExt = Path.GetFileNameWithoutExtension(file);

                        if (string.Equals(fileNameNoExt, cleanTarget, StringComparison.OrdinalIgnoreCase) ||

                            cleanTarget.Replace(" ", "").Contains(fileNameNoExt, StringComparison.OrdinalIgnoreCase))

                        {

                            double kb = new FileInfo(file).Length / 1024.0;

                            return $"{kb:0.#} KB";

                        }

                    }

                }

                // Also check bundled catalog size if not installed yet

                if (!string.IsNullOrEmpty(scriptFileName))

                {

                    var catalogPath = Path.Combine(GetBundledCatalogDir(), scriptFileName);

                    if (File.Exists(catalogPath))

                    {

                        double kb = new FileInfo(catalogPath).Length / 1024.0;

                        return $"{kb:0.#} KB";

                    }

                }

            }

            catch { }

            return string.Empty;

        }

        private async Task<List<ExtensionEntryDto>> LoadBundledCatalogEntriesAsync()
        {
            var bundledIndexCandidates = new[]
            {
                Path.Combine(GetBundledCatalogDir(), "index.min.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "Catalog", "index.min.json"),
                Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Plugins", "index.min.json")
            };

            foreach (var bundledIndex in bundledIndexCandidates)
            {
                if (File.Exists(bundledIndex))
                {
                    try
                    {
                        var json = await File.ReadAllTextAsync(bundledIndex);
                        var parsed = JsonSerializer.Deserialize<List<ExtensionEntryDto>>(json);
                        if (parsed != null && parsed.Count > 0)
                        {
                            return parsed;
                        }
                    }
                    catch { }
                }
            }

            return new List<ExtensionEntryDto>();
        }

        private static List<ExtensionEntryDto> MergeCatalogEntries(
            List<ExtensionEntryDto>? primary,
            List<ExtensionEntryDto>? secondary)
        {
            var map = new Dictionary<string, ExtensionEntryDto>(StringComparer.OrdinalIgnoreCase);

            void Upsert(ExtensionEntryDto item, bool overwrite)
            {
                if (item == null) return;
                string key = !string.IsNullOrWhiteSpace(item.Pkg)
                    ? item.Pkg.Trim()
                    : (!string.IsNullOrWhiteSpace(item.Apk) ? Path.GetFileNameWithoutExtension(item.Apk) : CleanExtensionName(item.Name));
                if (string.IsNullOrWhiteSpace(key)) return;

                if (!map.TryGetValue(key, out var existing))
                {
                    map[key] = item;
                }
                else if (overwrite || item.VersionCode >= existing.VersionCode)
                {
                    map[key] = item;
                }
            }

            if (secondary != null)
            {
                foreach (var item in secondary) Upsert(item, overwrite: false);
            }
            if (primary != null)
            {
                foreach (var item in primary) Upsert(item, overwrite: true);
            }

            return map.Values.OrderBy(e => CleanExtensionName(e.Name), StringComparer.OrdinalIgnoreCase).ToList();
        }

        public async Task<List<ExtensionEntryDto>> FetchCatalogEntriesAsync(bool forceOnline = false)
        {
            var cachePath = GetCacheFilePath();

            // 1. In-memory cache
            if (!forceOnline && _cachedRepoEntries.Count > 0)
            {
                return _cachedRepoEntries;
            }

            var bundledEntries = await LoadBundledCatalogEntriesAsync();

            // 2. User AppData disk cache (merged with bundled catalog so all 100+ extensions are always available)
            if (!forceOnline && File.Exists(cachePath))
            {
                try
                {
                    var cachedJson = await File.ReadAllTextAsync(cachePath);
                    var parsed = JsonSerializer.Deserialize<List<ExtensionEntryDto>>(cachedJson);
                    if (parsed != null && parsed.Count > 0)
                    {
                        _cachedRepoEntries = MergeCatalogEntries(parsed, bundledEntries);
                        return _cachedRepoEntries;
                    }
                }
                catch { }
            }

            // 3. Fast local bundled catalog (Plugins/Catalog/index.min.json)
            if (!forceOnline && bundledEntries.Count > 0)
            {
                _cachedRepoEntries = bundledEntries;
                return _cachedRepoEntries;
            }

            // 4. Try online mirrors if forcing online or if no local catalog exists
            if (!_settingsService.IsOfflineMode)
            {
                string cacheBuster = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
                string[] indexUrls =
                {
                    $"https://cdn.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{MainBranch}/index.min.json?t={cacheBuster}",
                    $"https://cdn.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{RepoBranch}/index.min.json?t={cacheBuster}",
                    $"https://fastly.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{MainBranch}/index.min.json?t={cacheBuster}",
                    $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{MainBranch}/index.min.json?t={cacheBuster}",
                    $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{RepoBranch}/index.min.json?t={cacheBuster}"
                };

                foreach (var url in indexUrls)
                {
                    try
                    {
                        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                        var response = await _httpClient.GetAsync(url, cts.Token);
                        if (response.IsSuccessStatusCode)
                        {
                            var json = await response.Content.ReadAsStringAsync(cts.Token);
                            var parsed = JsonSerializer.Deserialize<List<ExtensionEntryDto>>(json);
                            if (parsed != null && parsed.Count > 0)
                            {
                                _cachedRepoEntries = MergeCatalogEntries(parsed, bundledEntries);
                                try
                                {
                                    var mergedJson = JsonSerializer.Serialize(_cachedRepoEntries);
                                    await File.WriteAllTextAsync(cachePath, mergedJson);
                                }
                                catch { }
                                return _cachedRepoEntries;
                            }
                        }
                    }
                    catch { }
                }
            }

            if (_cachedRepoEntries.Count == 0 && bundledEntries.Count > 0)
            {
                _cachedRepoEntries = bundledEntries;
            }

            return _cachedRepoEntries;
        }

        public async Task<List<ExtensionFullState>> GetExtensionsListAsync(bool forceRefresh = false)

        {

            var entries = await FetchCatalogEntriesAsync(forceRefresh);

            var installedSources = _sourceManager.GetSources();

            var showNsfw = _settingsService.ShowNsfwSources;

            var result = new List<ExtensionFullState>();

            var installedMatchIds = new HashSet<long>();

            foreach (var entry in entries)

            {

                var cleanName = CleanExtensionName(entry.Name);

                var scriptFile = !string.IsNullOrEmpty(entry.Apk)
                    ? entry.Apk
                    : $"{entry.Pkg.Split('.').LastOrDefault() ?? cleanName.ToLowerInvariant()}.js";

                // Match against installed IMangaSource
                var installedMatch = installedSources.FirstOrDefault(s =>
                    string.Equals(CleanExtensionName(s.Name), cleanName, StringComparison.OrdinalIgnoreCase) ||
                    (entry.Sources != null && entry.Sources.Any(es =>
                        string.Equals(es.Name, s.Name, StringComparison.OrdinalIgnoreCase) ||
                        (!string.IsNullOrEmpty(es.BaseUrl) && string.Equals(es.BaseUrl.TrimEnd('/'), s.BaseUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase)))));

                if (installedMatch != null)
                {
                    installedMatchIds.Add(installedMatch.Id);
                }

                bool isNsfw = entry.Nsfw == 1 || (installedMatch != null && installedMatch.IsNsfw) || IsAdultIndicator(entry.Name, cleanName, entry.Pkg, entry.Apk, entry.Sources?.FirstOrDefault()?.Name, entry.Sources?.FirstOrDefault()?.BaseUrl);
                if (isNsfw && !showNsfw) continue;

                bool isInstalled = installedMatch != null;

                bool hasUpdate = false;

                string displayVersion = $"v{entry.Version.TrimStart('v', 'V')}";

                long sourceId = 0;

                string baseUrl = entry.Sources?.FirstOrDefault()?.BaseUrl ?? string.Empty;

                bool isCfProtected = false;

                string statusStr = "online";

                if (installedMatch != null)

                {

                    installedMatchIds.Add(installedMatch.Id);

                    sourceId = installedMatch.Id;

                    baseUrl = installedMatch.BaseUrl;

                    int installedCode = CalculateVersionCode(installedMatch.Version);

                    hasUpdate = entry.VersionCode > installedCode;

                    displayVersion = hasUpdate

                        ? $"v{installedMatch.Version.TrimStart('v', 'V')} → v{entry.Version.TrimStart('v', 'V')}"

                        : $"v{installedMatch.Version.TrimStart('v', 'V')}";

                    var st = _statusService.GetStatus(installedMatch.Id).Status;

                    statusStr = MapStatusToString(st);

                    isCfProtected = installedMatch is ICloudflareBypassable || (installedMatch is HttpSource hs && hs.RequiresProxy) || st == SourceStatus.Warning;

                }

                string extId = !string.IsNullOrEmpty(entry.Pkg)

                    ? entry.Pkg

                    : Path.GetFileNameWithoutExtension(scriptFile);

                result.Add(new ExtensionFullState

                {

                    Id = extId,

                    Pkg = entry.Pkg,

                    ScriptFileName = scriptFile,

                    SourceId = sourceId,

                    Name = cleanName,

                    Version = displayVersion,

                    VersionCode = entry.VersionCode,

                    Lang = NormalizeLang(entry.Lang),

                    IsNsfw = isNsfw,

                    Installed = isInstalled,

                    HasUpdate = hasUpdate,

                    IsCloudflareProtected = isCfProtected,

                    BaseUrl = baseUrl,

                    AccentColor = PickAccentColor(cleanName),

                    FileSizeText = GetPluginFileSizeText(scriptFile, cleanName),

                    IconUrl = YomicDesktop.IPC.WebResourceImageProxy.BuildIconProxyUrl(entry.Pkg,
                        !string.IsNullOrEmpty(entry.IconUrl) ? entry.IconUrl
                        : (entry.Pkg == "luvyaa" || entry.Pkg == "mangafire" || entry.Pkg == "softkomik")
                            ? $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{MainBranch}/icons/{entry.Pkg}.png"
                            : installedMatch != null && !string.IsNullOrEmpty(installedMatch.IconUrl)
                                ? installedMatch.IconUrl
                                : !string.IsNullOrEmpty(baseUrl) && Uri.TryCreate(baseUrl, UriKind.Absolute, out var bUri)
                                    ? $"https://www.google.com/s2/favicons?domain={bUri.Host}&sz=128"
                                    : string.Empty),

                    Status = statusStr

                });

            }

            // Include any custom/local JS plugins that are installed in %APPDATA%\Yomic\Plugins but not in index.min.json

            foreach (var src in installedSources)

            {

                if (installedMatchIds.Contains(src.Id)) continue;

                var cleanName = CleanExtensionName(src.Name);
                bool isNsfw = src.IsNsfw;
                if (!isNsfw)
                {
                    var matchEntry = entries.FirstOrDefault(e =>
                        string.Equals(CleanExtensionName(e.Name), cleanName, StringComparison.OrdinalIgnoreCase) ||
                        (e.Sources != null && e.Sources.Any(es =>
                            string.Equals(es.Name, src.Name, StringComparison.OrdinalIgnoreCase) ||
                            (!string.IsNullOrEmpty(es.BaseUrl) && string.Equals(es.BaseUrl.TrimEnd('/'), src.BaseUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase)))));
                    if (matchEntry != null && matchEntry.Nsfw == 1) isNsfw = true;
                }
                if (!isNsfw)
                {
                    isNsfw = IsAdultIndicator(cleanName, src.Name, src.Description, src.BaseUrl);
                }

                if (isNsfw && !showNsfw) continue;

                var st = _statusService.GetStatus(src.Id).Status;

                bool isCf = src is ICloudflareBypassable || (src is HttpSource hs2 && hs2.RequiresProxy) || st == SourceStatus.Warning;

                result.Add(new ExtensionFullState

                {

                    Id = $"local.{src.Id}",

                    Pkg = $"local.{src.Id}",

                    ScriptFileName = $"{cleanName.ToLowerInvariant().Replace(" ", "")}.js",

                    SourceId = src.Id,

                    Name = cleanName,

                    Version = $"v{src.Version.TrimStart('v', 'V')}",

                    VersionCode = CalculateVersionCode(src.Version),

                    Lang = NormalizeLang(src.Language),

                    IsNsfw = isNsfw,

                    Installed = true,

                    HasUpdate = false,

                    IsCloudflareProtected = isCf,

                    BaseUrl = src.BaseUrl,

                    AccentColor = PickAccentColor(cleanName),

                    FileSizeText = GetPluginFileSizeText(null, cleanName),

                    IconUrl = YomicDesktop.IPC.WebResourceImageProxy.BuildIconProxyUrl(
                        cleanName.ToLowerInvariant().Replace(" ", ""),
                        (!string.IsNullOrEmpty(src.IconUrl) && !src.IconUrl.Contains("softkomik.com") && !src.IconUrl.EndsWith("favicon.ico")) ? src.IconUrl
                        : (src.Id.ToString().ToLowerInvariant().Contains("softkomik") || cleanName.ToLowerInvariant().Contains("softkomik"))
                            ? $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{MainBranch}/icons/softkomik.png"
                            : !string.IsNullOrEmpty(src.IconUrl) ? src.IconUrl : string.Empty),

                    Status = MapStatusToString(st)

                });

            }

            return result

                .OrderByDescending(x => x.Installed)

                .ThenByDescending(x => x.HasUpdate)

                .ThenBy(x => x.Name)

                .ToList();

        }

        public static string MapStatusToString(SourceStatus status)

        {

            return status switch

            {

                SourceStatus.Online => "online",

                SourceStatus.Warning => "warning",

                SourceStatus.Offline => "offline",

                SourceStatus.Checking => "checking",

                _ => "online"

            };

        }

        public async Task<(bool Success, string Message)> InstallOrUpdateAsync(string idOrPkg, Action<int>? onProgress = null)

        {

            try

            {

                var entries = await FetchCatalogEntriesAsync(false);

                var entry = entries.FirstOrDefault(e =>

                    string.Equals(e.Pkg, idOrPkg, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals(Path.GetFileNameWithoutExtension(e.Apk), idOrPkg, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals(CleanExtensionName(e.Name), idOrPkg, StringComparison.OrdinalIgnoreCase));

                string scriptFileName = entry?.Apk ?? (idOrPkg.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ? idOrPkg : $"{idOrPkg}.js");

                if (string.IsNullOrEmpty(scriptFileName) && entry != null)
                {
                    scriptFileName = $"{entry.Pkg.Split('.').Last()}.js";
                }

                string cleanFileName = Path.GetFileName(scriptFileName);
                string langFolder = string.Equals(entry?.Lang, "en", StringComparison.OrdinalIgnoreCase) ? "en" : "id";

                onProgress?.Invoke(15);

                string? jsContent = null;

                // 1. Try downloading from GitHub / CDN mirrors if online (supports src/{lang}/{file}.js and root {file}.js)
                if (!_settingsService.IsOfflineMode)
                {
                    string cb = DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString();
                    string[] scriptUrls =
                    {
                        $"https://cdn.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{MainBranch}/src/{langFolder}/{cleanFileName}?t={cb}",
                        $"https://fastly.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{MainBranch}/src/{langFolder}/{cleanFileName}?t={cb}",
                        $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{MainBranch}/src/{langFolder}/{cleanFileName}?t={cb}",
                        $"https://cdn.jsdelivr.net/gh/{RepoOwner}/{RepoName}@{MainBranch}/{cleanFileName}?t={cb}",
                        $"https://raw.githubusercontent.com/{RepoOwner}/{RepoName}/{MainBranch}/{cleanFileName}?t={cb}"
                    };

                    foreach (var url in scriptUrls)
                    {
                        try
                        {
                            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(8));
                            var resp = await _httpClient.GetAsync(url, cts.Token);
                            if (resp.IsSuccessStatusCode)
                            {
                                var text = await resp.Content.ReadAsStringAsync(cts.Token);
                                if (!string.IsNullOrWhiteSpace(text) && !text.TrimStart().StartsWith("<!DOCTYPE", StringComparison.OrdinalIgnoreCase))
                                {
                                    jsContent = text;
                                    break;
                                }
                            }
                        }
                        catch { }
                    }
                }

                onProgress?.Invoke(65);

                // 2. Fallback to bundled Plugins/Catalog/{cleanFileName}
                if (string.IsNullOrWhiteSpace(jsContent))
                {
                    var bundledCandidates = new[]
                    {
                        Path.Combine(GetBundledCatalogDir(), "src", langFolder, cleanFileName),
                        Path.Combine(GetBundledCatalogDir(), cleanFileName)
                    };
                    foreach (var bundledScriptPath in bundledCandidates)
                    {
                        if (File.Exists(bundledScriptPath))
                        {
                            jsContent = await File.ReadAllTextAsync(bundledScriptPath);
                            break;
                        }
                    }
                }

                scriptFileName = cleanFileName;

                if (string.IsNullOrWhiteSpace(jsContent))

                {
                    bool isEn = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                    return (false, isEn ? $"Failed to download script file {scriptFileName}." : $"Gagal mengunduh berkas skrip {scriptFileName}.");
                }

                var pluginsDir = SourceManager.GetUserPluginsDirectory();

                Directory.CreateDirectory(pluginsDir);

                // Remove old matching script if updating

                if (entry != null)

                {

                    var cleanName = CleanExtensionName(entry.Name);

                    var existingSrc = _sourceManager.GetSources().FirstOrDefault(s =>

                        string.Equals(CleanExtensionName(s.Name), cleanName, StringComparison.OrdinalIgnoreCase));

                    if (existingSrc != null)

                    {

                        _sourceManager.RemoveSource(existingSrc.Id);

                    }

                }

                var targetPath = Path.Combine(pluginsDir, scriptFileName);

                await File.WriteAllTextAsync(targetPath, jsContent);

                onProgress?.Invoke(90);

                bool installed = _sourceManager.InstallPlugin(targetPath) != null;

                onProgress?.Invoke(100);

                if (installed)

                {

                    var displayName = entry != null ? CleanExtensionName(entry.Name) : Path.GetFileNameWithoutExtension(scriptFileName);
                    bool isEn = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                    return (true, isEn ? $"Extension {displayName} installed." : $"Ekstensi {displayName} berhasil dipasang.");
                }

                bool isEnInvalid = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                return (false, isEnInvalid ? $"Invalid script {scriptFileName}." : $"Skrip {scriptFileName} tidak valid.");
            }
            catch (Exception ex)
            {
                LogService.Error("ExtensionRepo", $"Failed to install extension {idOrPkg}", ex);
                bool isEnErr = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                return (false, isEnErr ? $"Failed to install extension: {ex.Message}" : $"Gagal memasang ekstensi: {ex.Message}");
            }

        }

        public (bool Success, string Message) UninstallExtension(string idOrPkg)

        {

            try

            {

                var entries = _cachedRepoEntries;

                var entry = entries.FirstOrDefault(e =>

                    string.Equals(e.Pkg, idOrPkg, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals(CleanExtensionName(e.Name), idOrPkg, StringComparison.OrdinalIgnoreCase));

                string cleanTarget = entry != null ? CleanExtensionName(entry.Name) : idOrPkg;

                var installedSrc = _sourceManager.GetSources().FirstOrDefault(s =>

                    string.Equals(CleanExtensionName(s.Name), cleanTarget, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals($"local.{s.Id}", idOrPkg, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals(s.Id.ToString(), idOrPkg, StringComparison.OrdinalIgnoreCase));

                if (installedSrc != null)

                {

                    _sourceManager.RemoveSource(installedSrc.Id);

                }

                var pluginsDir = SourceManager.GetUserPluginsDirectory();

                if (entry != null && !string.IsNullOrEmpty(entry.Apk))

                {

                    var apkPath = Path.Combine(pluginsDir, entry.Apk);

                    if (File.Exists(apkPath))

                    {

                        File.Delete(apkPath);

                    }

                }

                bool isEnUninst = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                return (true, isEnUninst ? $"Extension {cleanTarget} uninstalled." : $"Ekstensi {cleanTarget} berhasil dicopot.");
            }
            catch (Exception ex)
            {
                LogService.Error("ExtensionRepo", $"Failed to uninstall {idOrPkg}", ex);
                bool isEnUninstErr = string.Equals(_settingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);
                return (false, isEnUninstErr ? $"Failed to uninstall extension: {ex.Message}" : $"Gagal mencopot ekstensi: {ex.Message}");
            }

        }

    }

}

