using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reactive;
using ReactiveUI;
using Avalonia.Media.Imaging;
using Avalonia.Platform;
using System.Net.Http;
using System.IO;
using Yomic.Core.Services;
using Yomic.Core.Sources;
using Yomic.Core.Models; // Added as per instruction

namespace Yomic.ViewModels
{
    public class ExtensionItem : ViewModelBase, IDisposable
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
        public string Version { get; set; } = "1.0";
        /// <summary>Mihon-style integer version code. Higher = newer. e.g. 1.0.3 → 103</summary>
        public int VersionCode { get; set; } = 100;
        /// <summary>Mihon-style package name (= JS filename without .js). e.g. "kiryuu"</summary>
        public string Pkg { get; set; } = "";
        /// <summary>Source names from sources[] array in index.min.json</summary>
        public string[] SourceNames { get; set; } = Array.Empty<string>();
        public string Language { get; set; } = "EN";
        private string _iconText = "E";
        public string IconText
        {
            get => _iconText;
            set => this.RaiseAndSetIfChanged(ref _iconText, value);
        }
        public string IconColor { get; set; } = "#0078D7";
        public string IconBackground { get; set; } = "#313244";
        public string Description { get; set; } = "";
        public string? FilePath { get; set; } // Path for uninstalled extensions
        public string? DownloadUrl { get; set; } // Raw URL from GitHub (built from pkg)

        private string _fileSizeText = "";
        public string FileSizeText
        {
            get => _fileSizeText;
            set
            {
                this.RaiseAndSetIfChanged(ref _fileSizeText, value);
                this.RaisePropertyChanged(nameof(HasFileSize));
            }
        }

        public bool HasFileSize => !string.IsNullOrEmpty(FileSizeText);

        private bool _hasUpdate;
        public bool HasUpdate
        {
            get => _hasUpdate;
            set => this.RaiseAndSetIfChanged(ref _hasUpdate, value);
        }

        private string _updateBadgeText = "Pembaruan Baru";
        public string UpdateBadgeText
        {
            get => _updateBadgeText;
            set => this.RaiseAndSetIfChanged(ref _updateBadgeText, value);
        }

        private string? _remoteCommitDateText;
        public string? RemoteCommitDateText
        {
            get => _remoteCommitDateText;
            set => this.RaiseAndSetIfChanged(ref _remoteCommitDateText, value);
        }

        public string? RemoteDownloadUrl { get; set; }
        public DateTime? LocalWriteTimeUtc { get; set; }
        
        // Multi-Language Support
        public ObservableCollection<Bitmap> LanguageFlags { get; } = new();

        private Bitmap? _iconBitmap;
        public Bitmap? IconBitmap
        {
            get => _iconBitmap;
            set => this.RaiseAndSetIfChanged(ref _iconBitmap, value);
        }

        private bool _isLoadingIcon;
        public bool IsLoadingIcon
        {
            get => _isLoadingIcon;
            set => this.RaiseAndSetIfChanged(ref _isLoadingIcon, value);
        }

        private bool _isInstalled;
        public bool IsInstalled
        {
            get => _isInstalled;
            set => this.RaiseAndSetIfChanged(ref _isInstalled, value);
        }

        private bool _isInstalling;
        public bool IsInstalling
        {
            get => _isInstalling;
            set => this.RaiseAndSetIfChanged(ref _isInstalling, value);
        }

        private bool _isDownloading;
        public bool IsDownloading
        {
            get => _isDownloading;
            set => this.RaiseAndSetIfChanged(ref _isDownloading, value);
        }

        private double _downloadProgress;
        public double DownloadProgress
        {
            get => _downloadProgress;
            set => this.RaiseAndSetIfChanged(ref _downloadProgress, value);
        }

        private string _downloadProgressText = "Downloading...";
        public string DownloadProgressText
        {
            get => _downloadProgressText;
            set => this.RaiseAndSetIfChanged(ref _downloadProgressText, value);
        }

        public bool CanVerify { get; set; }

        public IMangaSource? SourceInstance { get; set; }
        public bool IsSystem { get; set; } // Bundled (Program Files) plugin
        public bool IsNsfw { get; set; }

        public void Dispose()
        {
            if (_iconBitmap != null)
            {
                _iconBitmap.Dispose();
                _iconBitmap = null;
            }
            // Dispose flags
            foreach (var flag in LanguageFlags)
            {
                flag.Dispose();
            }
            LanguageFlags.Clear();
            
            SourceInstance = null;
        }
    }

    public class ExtensionsViewModel : ViewModelBase, IDisposable
    {
        private readonly SourceManager _sourceManager;
        private readonly MainWindowViewModel _mainVM;
        private static readonly HttpClient _httpClient = new HttpClient();

        public static string FormatBytes(long bytes)
        {
            if (bytes <= 0) return "";
            string[] suffixes = { "B", "KB", "MB", "GB" };
            int counter = 0;
            decimal number = bytes;
            while (Math.Round(number / 1024) >= 1 && counter < suffixes.Length - 1)
            {
                number /= 1024;
                counter++;
            }
            return string.Format("{0:0.#} {1}", number, suffixes[counter]);
        }
        
        // Language detection is now handled by 'lang' field in index.min.json (Mihon-style)
        // IndonesianExtensions hashset removed — no longer needed.
        
        private List<ExtensionItem> _allExtensionsCache = new();
        public ObservableCollection<ExtensionItem> FilteredExtensions { get; } = new();
        public ObservableCollection<ExtensionItem> InstalledExtensions { get; } = new();
        public ObservableCollection<ExtensionItem> AvailableExtensions { get; } = new();

        public int InstalledCount => InstalledExtensions.Count;
        public int AvailableCount => AvailableExtensions.Count;
        public bool HasInstalledExtensions => InstalledExtensions.Count > 0;
        public bool HasAvailableExtensions => AvailableExtensions.Count > 0;

        private string _searchText = "";
        public string SearchText
        {
            get => _searchText;
            set 
            {
                this.RaiseAndSetIfChanged(ref _searchText, value);
                FilterExtensions();
            }
        }

        public ObservableCollection<LanguageFilterItem> AvailableLanguages { get; } = new()
        {
            new LanguageFilterItem { Name = "All", Code = "ALL" },
            new LanguageFilterItem { Name = "Bahasa Indonesia", Code = "ID" },
            new LanguageFilterItem { Name = "English", Code = "EN" }
        };

        private LanguageFilterItem? _selectedLanguageFilterItem;
        public LanguageFilterItem? SelectedLanguageFilterItem
        {
            get => _selectedLanguageFilterItem;
            set
            {
                this.RaiseAndSetIfChanged(ref _selectedLanguageFilterItem, value);
                SelectedLanguageFilter = value?.Code ?? "ALL";
            }
        }

        private string _selectedLanguageFilter = "ALL";
        public string SelectedLanguageFilter
        {
            get => _selectedLanguageFilter;
            set
            {
                this.RaiseAndSetIfChanged(ref _selectedLanguageFilter, value);
                var match = AvailableLanguages.FirstOrDefault(x => x.Code == value);
                if (match != null && SelectedLanguageFilterItem != match)
                    SelectedLanguageFilterItem = match;
                FilterExtensions();
            }
        }

        public ReactiveCommand<string, Unit> SetLanguageFilterCommand { get; }

        public ReactiveCommand<ExtensionItem, Unit> ToggleInstallCommand { get; }
        public ReactiveCommand<ExtensionItem, Unit> VerifyExtensionCommand { get; }
        public ReactiveCommand<Unit, Unit> AddExtensionCommand { get; }

        private bool _hasNoInstalledExtensions;
        public bool HasNoInstalledExtensions
        {
            get => _hasNoInstalledExtensions;
            set => this.RaiseAndSetIfChanged(ref _hasNoInstalledExtensions, value);
        }

        private bool _isOffline;
        public bool IsOffline
        {
            get => _isOffline;
            set => this.RaiseAndSetIfChanged(ref _isOffline, value);
        }

        public ReactiveCommand<ExtensionItem, Unit> DownloadExtensionCommand { get; }
        public ReactiveCommand<ExtensionItem, Unit> UpdateExtensionCommand { get; }
        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }

        public ExtensionsViewModel(MainWindowViewModel mainVM, SourceManager sourceManager)
        {
            _mainVM = mainVM;
            _sourceManager = sourceManager;
            
            // Initial State
            IsOffline = !_mainVM.NetworkService.IsOnline;

            // Subscribe to Network Changes
            _mainVM.NetworkService.StatusChanged += (s, isOnline) =>
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    IsOffline = !isOnline;
                    if (isOnline)
                    {
                        _ = FetchRemoteExtensionsAsync();
                    }
                });
            };

            ToggleInstallCommand = ReactiveCommand.Create<ExtensionItem>(ToggleInstall);
            VerifyExtensionCommand = ReactiveCommand.Create<ExtensionItem>(VerifyExtension);
            AddExtensionCommand = ReactiveCommand.Create(AddExtension);
            DownloadExtensionCommand = ReactiveCommand.Create<ExtensionItem>(DownloadExtension);
            UpdateExtensionCommand = ReactiveCommand.Create<ExtensionItem>(UpdateExtension);
            RefreshCommand = ReactiveCommand.CreateFromTask(RefreshExtensionsAsync);
            
            SetLanguageFilterCommand = ReactiveCommand.Create<string>(lang =>
            {
                SelectedLanguageFilter = lang;
            });
            
            LoadExtensions();
            _ = FetchRemoteExtensionsAsync();

            if (_mainVM.SettingsService != null)
            {
                _mainVM.SettingsService.ShowNsfwSourcesChanged += (show) =>
                {
                    Avalonia.Threading.Dispatcher.UIThread.Post(() => FilterExtensions());
                };
            }
        }

        private bool _isFetchingRemote;

        public async System.Threading.Tasks.Task PreloadRemoteExtensionsAsync()
        {
            await FetchRemoteExtensionsAsync(force: false);
        }

        private static string GetLocalIndexCachePath()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            var dir = System.IO.Path.Combine(appData, "Yomic");
            if (!System.IO.Directory.Exists(dir)) System.IO.Directory.CreateDirectory(dir);
            return System.IO.Path.Combine(dir, "extensions_index.json");
        }

        private void LoadLocalIndexCache()
        {
            try
            {
                var cachePath = GetLocalIndexCachePath();
                if (System.IO.File.Exists(cachePath))
                {
                    string jsonText = System.IO.File.ReadAllText(cachePath);
                    if (!string.IsNullOrWhiteSpace(jsonText))
                    {
                        ParseAndAddIndexJson(jsonText);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load local index cache: {ex.Message}");
            }
        }

        private void ParseAndAddIndexJson(string jsonText)
        {
            if (string.IsNullOrWhiteSpace(jsonText)) return;
            try
            {
                var files = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(jsonText);
                if (files.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var file in files.EnumerateArray())
                    {
                        var name = file.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                        if (string.IsNullOrWhiteSpace(name)) continue;

                        AddRemoteJsExtension(file);
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to parse index JSON: {ex.Message}");
            }
        }

        private static readonly HttpClient _extensionClient = new HttpClient(new SocketsHttpHandler
        {
            AllowAutoRedirect = true,
            AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
            ConnectTimeout = TimeSpan.FromSeconds(5),
            MaxConnectionsPerServer = 20,
            ConnectCallback = ExtensionConnectCallback // Mihon-style DoH resolution to bypass ISP DNS blocking!
        })
        {
            Timeout = System.Threading.Timeout.InfiniteTimeSpan
        };

        private static async System.Threading.Tasks.ValueTask<System.IO.Stream> ExtensionConnectCallback(SocketsHttpConnectionContext context, System.Threading.CancellationToken cancellationToken)
        {
            var host = context.DnsEndPoint.Host;
            var port = context.DnsEndPoint.Port;
            System.Net.IPAddress? ipAddress = null;

            if (System.Net.IPAddress.TryParse(host, out var directIp))
            {
                ipAddress = directIp;
            }
            else
            {
                // 1. Try Cloudflare DoH (Bypasses ISP Port 53 DNS blocking)
                try
                {
                    using var dohClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
                    dohClient.DefaultRequestHeaders.Accept.ParseAdd("application/dns-json");
                    var json = await dohClient.GetStringAsync($"https://1.1.1.1/dns-query?name={Uri.EscapeDataString(host)}&type=A", cancellationToken).ConfigureAwait(false);
                    using var doc = System.Text.Json.JsonDocument.Parse(json);
                    if (doc.RootElement.TryGetProperty("Answer", out var answerArr) && answerArr.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        foreach (var item in answerArr.EnumerateArray())
                        {
                            if (item.TryGetProperty("data", out var dataProp) && System.Net.IPAddress.TryParse(dataProp.GetString(), out var parsedIp))
                            {
                                ipAddress = parsedIp;
                                break;
                            }
                        }
                    }
                }
                catch { }

                // 2. Try Google DoH (Fallback)
                if (ipAddress == null)
                {
                    try
                    {
                        using var dohClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
                        var json = await dohClient.GetStringAsync($"https://dns.google/resolve?name={Uri.EscapeDataString(host)}&type=A", cancellationToken).ConfigureAwait(false);
                        using var doc = System.Text.Json.JsonDocument.Parse(json);
                        if (doc.RootElement.TryGetProperty("Answer", out var answerArr) && answerArr.ValueKind == System.Text.Json.JsonValueKind.Array)
                        {
                            foreach (var item in answerArr.EnumerateArray())
                            {
                                if (item.TryGetProperty("data", out var dataProp) && System.Net.IPAddress.TryParse(dataProp.GetString(), out var parsedIp))
                                {
                                    ipAddress = parsedIp;
                                    break;
                                }
                            }
                        }
                    }
                    catch { }
                }

                // 3. System DNS fallback
                if (ipAddress == null)
                {
                    var addrs = await System.Net.Dns.GetHostAddressesAsync(host, cancellationToken).ConfigureAwait(false);
                    ipAddress = addrs.FirstOrDefault(a => a.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork) ?? addrs.FirstOrDefault();
                }
            }

            if (ipAddress == null) throw new Exception($"Could not resolve host {host}");

            var socket = new System.Net.Sockets.Socket(ipAddress.AddressFamily, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
            socket.NoDelay = true;
            try
            {
                await socket.ConnectAsync(new System.Net.IPEndPoint(ipAddress, port), cancellationToken).ConfigureAwait(false);
                return new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
            }
            catch
            {
                socket.Dispose();
                throw;
            }
        }

        private static readonly HttpClient _iconClient = new HttpClient(new SocketsHttpHandler
        {
            AllowAutoRedirect = true,
            AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate,
            ConnectTimeout = TimeSpan.FromSeconds(3),
            MaxConnectionsPerServer = 10
        })
        {
            Timeout = System.Threading.Timeout.InfiniteTimeSpan
        };

        private static async System.Threading.Tasks.Task<string?> FetchStringNativeAsync(string url, int timeoutMs = 8000)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Yomic/1.7");
                request.Headers.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue { NoCache = true, NoStore = true };
                request.Headers.TryAddWithoutValidation("Pragma", "no-cache");

                using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromMilliseconds(timeoutMs));
                using var response = await _extensionClient.SendAsync(request, cts.Token).ConfigureAwait(false);
                if (response.IsSuccessStatusCode)
                {
                    return await response.Content.ReadAsStringAsync(cts.Token).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException)
            {
                System.Diagnostics.Debug.WriteLine($"[NativeFetch] Timeout ({timeoutMs}ms) for {url}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[NativeFetch] Failed {url}: {ex.Message}");
            }
            return null;
        }

        private async System.Threading.Tasks.Task FetchRemoteExtensionsAsync(bool force = false)
        {
            if (IsOffline) return;
            if (_isFetchingRemote && !force) return;
            _isFetchingRemote = true;

            try
            {
                if (force)
                {
                    try
                    {
                        var cachePath = GetLocalIndexCachePath();
                        if (System.IO.File.Exists(cachePath)) System.IO.File.Delete(cachePath);
                    }
                    catch { }
                }

                // Run network fetch on background threadpool worker (Mihon-style Dispatchers.IO)
                // to prevent Avalonia UI SynchronizationContext deadlocks!
                await System.Threading.Tasks.Task.Run(async () =>
                {
                    string? responseText = null;

                    var guid = Guid.NewGuid().ToString("N");
                    var urlsToTry = new[]
                    {
                        $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/repo/index.min.json?t={DateTime.UtcNow.Ticks}_{guid}",
                        $"https://raw.githack.com/ArisaAkiyama/extension-yomic/repo/index.min.json?t={DateTime.UtcNow.Ticks}_{guid}",
                        $"https://cdn.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@repo/index.min.json?t={DateTime.UtcNow.Ticks}_{guid}",
                        $"https://fastly.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@repo/index.min.json?t={DateTime.UtcNow.Ticks}_{guid}",
                        $"https://ghproxy.net/https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/repo/index.min.json?t={DateTime.UtcNow.Ticks}_{guid}"
                    };

                    foreach (var url in urlsToTry)
                    {
                        System.Diagnostics.Debug.WriteLine($"[ExtensionsVM] Trying index URL: {url}");
                        responseText = await FetchStringNativeAsync(url, 8000).ConfigureAwait(false);
                        if (!string.IsNullOrWhiteSpace(responseText) && responseText.TrimStart().StartsWith("["))
                        {
                            System.Diagnostics.Debug.WriteLine($"[ExtensionsVM] index.min.json fetched OK ({responseText.Length} bytes)");
                            break;
                        }
                    }

                    if (string.IsNullOrEmpty(responseText))
                    {
                        System.Diagnostics.Debug.WriteLine("[ExtensionsVM] All index URLs failed, using embedded fallback.");
                        return;
                    }

                    Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                    {
                        ParseAndAddIndexJson(responseText);
                        FilterExtensions();
                    });

                    try
                    {
                        System.IO.File.WriteAllText(GetLocalIndexCachePath(), responseText);
                    }
                    catch { }
                }).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to fetch remote extensions: {ex.Message}");
            }
            finally
            {
                _isFetchingRemote = false;
            }
        }

        private Version ParseVersion(string? verStr)
        {
            if (string.IsNullOrWhiteSpace(verStr)) return new Version(1, 0, 0);
            var clean = verStr.TrimStart('v', 'V').Trim();
            if (Version.TryParse(clean, out var parsed))
            {
                return parsed;
            }
            if (Version.TryParse(clean + ".0", out var parsed2))
            {
                return parsed2;
            }
            return new Version(1, 0, 0);
        }

        /// <summary>
        /// Converts a semver string to a Mihon-style integer version code.
        /// e.g. "1.0.3" -> 103, "1.9.0" -> 190, "2.1.0" -> 210
        /// </summary>
        private static int VersionStringToCode(string? version)
        {
            if (string.IsNullOrWhiteSpace(version)) return 100;
            var clean = version.TrimStart('v', 'V').Trim();
            var parts = clean.Split('.');
            int major = parts.Length > 0 && int.TryParse(parts[0], out var ma) ? ma : 1;
            int minor = parts.Length > 1 && int.TryParse(parts[1], out var mi) ? mi : 0;
            int patch = parts.Length > 2 && int.TryParse(parts[2], out var pa) ? pa : 0;
            return major * 100 + minor * 10 + patch;
        }

        // FetchRemoteJsExtensionsFromFolderAsync removed — was GitHub REST API (rate-limited).
        // Replaced by Mihon-style static index.min.json from branch 'repo'.

        private void AddRemoteJsExtension(System.Text.Json.JsonElement file)
        {
            // ── Mihon-style index.min.json format ──
            // Required fields: name, pkg, lang, code (int), version, nsfw (0/1), sources[]
            // Download URL is built from pkg: raw.githubusercontent.com/.../main/{pkg}.js

            // Support both old format (name ends with .js) and new Mihon-style format (pkg field)
            var pkg = file.TryGetProperty("pkg", out var pkgProp) ? pkgProp.GetString() : null;
            var nameRaw = file.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;

            // Determine clean display name and pkg identifier
            string cleanName;
            string pkgId;
            if (!string.IsNullOrWhiteSpace(pkg))
            {
                // Mihon-style: pkg = "kiryuu", name = "Kiryuu"
                pkgId = pkg;
                cleanName = !string.IsNullOrWhiteSpace(nameRaw) ? nameRaw : pkg;
            }
            else if (!string.IsNullOrWhiteSpace(nameRaw) && nameRaw.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
            {
                // Legacy format: name = "kiryuu.js" (old index.json)
                pkgId = nameRaw.Replace(".js", "", StringComparison.OrdinalIgnoreCase);
                cleanName = pkgId;
            }
            else
            {
                return; // Skip unrecognized entries
            }

            if (string.IsNullOrWhiteSpace(pkgId)) return;

            // Read Mihon-style fields
            int remoteCode = 0;
            if (file.TryGetProperty("code", out var codeProp) && codeProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                remoteCode = codeProp.GetInt32();

            var remoteVersion = file.TryGetProperty("version", out var vProp) ? vProp.GetString() : null;

            int nsfwFlag = 0;
            if (file.TryGetProperty("nsfw", out var nsfwProp) && nsfwProp.ValueKind == System.Text.Json.JsonValueKind.Number)
                nsfwFlag = nsfwProp.GetInt32();

            string lang = file.TryGetProperty("lang", out var langProp) ? (langProp.GetString() ?? "en") : "en";

            // Parse sources[] array
            var sourceNames = new System.Collections.Generic.List<string>();
            if (file.TryGetProperty("sources", out var sourcesProp) && sourcesProp.ValueKind == System.Text.Json.JsonValueKind.Array)
            {
                foreach (var src in sourcesProp.EnumerateArray())
                {
                    if (src.TryGetProperty("name", out var srcName))
                        sourceNames.Add(srcName.GetString() ?? "");
                }
            }

            // Build download URL from pkg field (Mihon-style: files stay in main branch)
            var downloadUrl = file.TryGetProperty("download_url", out var dlProp) ? dlProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                downloadUrl = $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{pkgId}.js";
            }

            // ── UPDATE DETECTION (Mihon-style: integer code comparison) ──
            var existing = _allExtensionsCache.FirstOrDefault(x =>
                x.Pkg.Equals(pkgId, StringComparison.OrdinalIgnoreCase) ||
                x.Name.Equals(cleanName, StringComparison.OrdinalIgnoreCase) ||
                (x.FilePath != null && x.FilePath.EndsWith(pkgId + ".js", StringComparison.OrdinalIgnoreCase)));

            if (existing != null)
            {
                if (string.IsNullOrEmpty(existing.RemoteDownloadUrl))
                    existing.RemoteDownloadUrl = downloadUrl;

                // Always sync IsNsfw flag from the latest remote index
                existing.IsNsfw = nsfwFlag == 1 || cleanName.Contains("nhentai", StringComparison.OrdinalIgnoreCase);

                // Mihon-style: compare integer code (higher = newer)
                if (remoteCode > 0 && existing.VersionCode > 0)
                {
                    bool isNewer = remoteCode > existing.VersionCode;
                    existing.HasUpdate = isNewer;
                    if (isNewer)
                    {
                        existing.RemoteCommitDateText = !string.IsNullOrEmpty(remoteVersion) ? $"v{remoteVersion}" : $"code {remoteCode}";
                        LogService.Info("ExtensionsVM", $"[Mihon] Update for {existing.Name}: local code={existing.VersionCode}, remote code={remoteCode} (v{remoteVersion})");
                    }
                }
                else
                {
                    // Fallback to semver string comparison
                    var rVer = ParseVersion(remoteVersion);
                    var lVer = ParseVersion(existing.Version);
                    existing.HasUpdate = rVer > lVer;
                    if (existing.HasUpdate)
                        existing.RemoteCommitDateText = !string.IsNullOrEmpty(remoteVersion) ? $"v{remoteVersion}" : null;
                }
                return;
            }

            // ── NEW EXTENSION ENTRY ──
            long stableId;
            try
            {
                var hashName = "JS_" + pkgId + "_" + lang;
                var hash = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(hashName));
                stableId = BitConverter.ToInt64(hash, 0);
            }
            catch
            {
                stableId = pkgId.GetHashCode();
            }

            // Convert version code to display version if not provided
            string displayVersion = !string.IsNullOrWhiteSpace(remoteVersion) ? remoteVersion : "Latest";

            var extItem = new ExtensionItem
            {
                Id = stableId,
                Name = cleanName,
                Pkg = pkgId,
                VersionCode = remoteCode > 0 ? remoteCode : 100,
                Version = displayVersion,
                Language = lang,
                Description = sourceNames.Count > 0 ? string.Join(", ", sourceNames) : "Available on GitHub",
                IsInstalled = false,
                DownloadUrl = downloadUrl,
                RemoteDownloadUrl = downloadUrl,
                IconText = cleanName.Length > 0 ? cleanName.Substring(0, 1) : "?",
                IsNsfw = nsfwFlag == 1 || cleanName.Contains("nhentai", StringComparison.OrdinalIgnoreCase),
                SourceNames = sourceNames.ToArray()
            };

            LoadLanguageFlags(extItem);
            _ = LoadFaviconFromRemoteJsAsync(extItem);
            _allExtensionsCache.Add(extItem);
        }

        private async void VerifyExtension(ExtensionItem item)
        {
            if (item.SourceInstance is not ICloudflareBypassable bypassable) return;
            
            _mainVM.ShowNotification($"Verifying {item.Name}...", NotificationType.Info);
            try
            {
                await bypassable.InitializeBrowserAsync();
                _mainVM.ShowNotification($"{item.Name} Verified!", NotificationType.Success);
            }
            catch (Exception ex)
            {
                _mainVM.ShowNotification($"Verification failed: {ex.Message}", NotificationType.Error);
            }
        }
        
        public bool HasExtensions => FilteredExtensions.Count > 0;

        private void UpdateEmptyState()
        {
            // Empty state if NO extensions are installed (checking cache mostly, or filtered list?)
            // Usually empty state in UI means "No results found" or "No installed extensions overall"
            // Let's base it on Filtered List count for "No Results" 
            // OR base it on Installed Count for "No installed".
            // The UI logic seemed to check "HasExtensions" (Count > 0 of list).
            this.RaisePropertyChanged(nameof(HasExtensions));
        }

        private void LoadExtensions()
        {
            foreach (var item in _allExtensionsCache)
            {
                item.Dispose();
            }
            _allExtensionsCache.Clear();
            var activeSources = _sourceManager.GetSources();
            foreach (var source in activeSources)
            {
                bool canVerify = source is ICloudflareBypassable;
                
                // Branding Logic (Dynamic)
                string iconBg = source.IconBackground;
                string iconFg = source.IconForeground;
                string iconTxt = !string.IsNullOrEmpty(source.Name) ? source.Name.Substring(0, 1) : "?";

                // Use source metadata
                var extItem = new ExtensionItem
                {
                    Id = source.Id,
                    Name = source.Name,
                    Version = source.Version, // Dynamic Version
                    // Mihon-style: convert installed version string to integer code for update detection
                    VersionCode = VersionStringToCode(source.Version),
                    Pkg = System.IO.Path.GetFileNameWithoutExtension(_sourceManager.GetSourcePath(source.Id) ?? source.Name.ToLowerInvariant()),
                    Language = source.Language,
                    IconText = iconTxt,
                    IconColor = iconFg,
                    IconBackground = iconBg,
                    Description = !string.IsNullOrEmpty(source.Description) ? source.Description : $"{source.Name} Source",
                    
                    // IsInstalled = TRUE if in AppData/ProgramFiles, FALSE if just loaded from a temporary path
                    IsInstalled = _sourceManager.IsInstalledSource(source.Id),
                    FilePath = _sourceManager.GetSourcePath(source.Id),
                    
                    SourceInstance = source,
                    CanVerify = canVerify,
                    IsNsfw = source.IsNsfw || source.Name.Contains("nhentai", StringComparison.OrdinalIgnoreCase)
                };



                // If NOT installed, show path in description
                if (!extItem.IsInstalled)
                {
                    var path = _sourceManager.GetSourcePath(source.Id);
                    if (!string.IsNullOrEmpty(path))
                    {
                        extItem.Description = "Loaded from: " + System.IO.Path.GetFileName(path);
                    }
                }
                
                // Load Icon from URL if provided by Source
                if (!string.IsNullOrEmpty(source.IconUrl))
                {
                     _ = LoadIconAsync(extItem, source.IconUrl);
                }
                else if (!string.IsNullOrEmpty(source.BaseUrl) && Uri.TryCreate(source.BaseUrl, UriKind.Absolute, out var uri))
                {
                     _ = LoadIconAsync(extItem, $"https://www.google.com/s2/favicons?domain={uri.Host}&sz=128");
                }
                
                LoadLanguageFlags(extItem);

                _allExtensionsCache.Add(extItem);
            }
            
            LoadLocalIndexCache();
            FilterExtensions();
        }

        private void FilterExtensions()
        {
            InstalledExtensions.Clear();
            AvailableExtensions.Clear();
            FilteredExtensions.Clear();
            
            var query = _searchText?.Trim();
            var showNsfw = _mainVM.SettingsService.ShowNsfwSources;
            var list = string.IsNullOrEmpty(query) 
                ? _allExtensionsCache 
                : _allExtensionsCache.Where(x => x.Name.Contains(query, StringComparison.OrdinalIgnoreCase)).ToList();

            if (!showNsfw)
            {
                list = list.Where(x => !x.IsNsfw).ToList();
            }

            // Apply Language Filter
            if (!string.IsNullOrEmpty(SelectedLanguageFilter) && SelectedLanguageFilter != "ALL")
            {
                list = list.Where(x => 
                    x.Language != null && (
                        x.Language.Equals(SelectedLanguageFilter, StringComparison.OrdinalIgnoreCase) ||
                        x.Language.Equals("global", StringComparison.OrdinalIgnoreCase)
                    )
                ).ToList();
            }

            // Grouping/Sorting
            var installed = list.Where(x => x.IsInstalled).OrderBy(x => x.Name).ToList();
            var available = list.Where(x => !x.IsInstalled).OrderBy(x => x.Name).ToList();
            
            foreach(var item in installed)
            {
                InstalledExtensions.Add(item);
                FilteredExtensions.Add(item);
            }
            
            foreach(var item in available)
            {
                AvailableExtensions.Add(item);
                FilteredExtensions.Add(item);
            }
            
            this.RaisePropertyChanged(nameof(InstalledCount));
            this.RaisePropertyChanged(nameof(AvailableCount));
            this.RaisePropertyChanged(nameof(HasInstalledExtensions));
            this.RaisePropertyChanged(nameof(HasAvailableExtensions));
            
            UpdateEmptyState();
        }

        // Delegate for View to hook into
        public System.Func<System.Threading.Tasks.Task<Avalonia.Platform.Storage.IStorageFile?>>? OpenFilePickerAsync { get; set; }

        private bool _isBusy;
        public bool IsBusy
        {
            get => _isBusy;
            set => this.RaiseAndSetIfChanged(ref _isBusy, value);
        }

        private async void AddExtension()
        {
            if (OpenFilePickerAsync == null) return;

            try
            {
                var file = await OpenFilePickerAsync();
                if (file == null) return;

                IsBusy = true;
                
                // Simulate a small delay so the user SEES the loading if it's too fast
                await System.Threading.Tasks.Task.Delay(500);

                var path = file.Path.LocalPath;
                string fileName = System.IO.Path.GetFileName(path);
                if (!fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
                {
                    _mainVM.ShowNotification("Only JS extensions can be installed.", NotificationType.Error);
                    return;
                }

                _mainVM.ShowNotification($"Installing {fileName}...", NotificationType.Info);

                // INSTALL PERSISTENTLY (Copy to AppData/Plugins and Load)
                var loadedSource = await System.Threading.Tasks.Task.Run(() => _sourceManager.InstallPlugin(path));
                
                if (loadedSource != null)
                {
                     // Refresh list to show new item
                     LoadExtensions(); // Reloads list, new item will appear as "Installed"
                     // Bug Fix: Repopulate available extensions list (was missing, causing all
                     // available extensions to disappear after installing a local plugin)
                     _ = FetchRemoteExtensionsAsync();
                     _mainVM.ShowNotification($"{loadedSource.Name} installed successfully!", NotificationType.Success);
                }
                else
                {
                    _mainVM.ShowNotification("Failed to install extension.", NotificationType.Error);
                }
            }
            catch (System.Exception ex)
            {
                _mainVM.ShowNotification($"Install Error: {ex.Message}", NotificationType.Error);
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async void DownloadExtension(ExtensionItem item)
        {
            if (string.IsNullOrEmpty(item.DownloadUrl)) return;
            if (item.IsDownloading) return;

            item.IsDownloading = true;
            item.DownloadProgress = 0;
            item.DownloadProgressText = "Mengunduh...";
            _mainVM.ShowNotification($"Mengunduh {item.Name}...", NotificationType.Info);

            string? tempPath = null;
            try
            {
                var fileName = System.IO.Path.GetFileName(item.DownloadUrl);
                if (string.IsNullOrEmpty(fileName) || !fileName.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
                {
                    fileName = $"{item.Name}.js";
                }

                // Mihon-style download URLs — static files only, no GitHub REST API
                var pkgFileName = !string.IsNullOrEmpty(item.Pkg) ? $"{item.Pkg}.js" : fileName;
                var urlsToTry = new[]
                {
                    // 1. Primary: raw GitHub (main branch — where .js files live)
                    item.DownloadUrl ?? $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}",
                    // 2. jsDelivr CDN Mirror
                    $"https://cdn.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@main/{pkgFileName}",
                    // 3. Fastly jsDelivr Mirror
                    $"https://fastly.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@main/{pkgFileName}",
                    // 4. GitHack Raw Mirror
                    $"https://raw.githack.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}",
                    // 5. GHProxy Mirror (Anti-ISP Blocking)
                    $"https://ghproxy.net/https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}"
                };

                string? jsContent = null;
                foreach (var url in urlsToTry)
                {
                    jsContent = await FetchStringNativeAsync(url, 8000).ConfigureAwait(false);
                    if (!string.IsNullOrWhiteSpace(jsContent)) break;
                }

                if (string.IsNullOrWhiteSpace(jsContent))
                {
                    _mainVM.ShowNotification($"Gagal mengunduh {item.Name}. Periksa koneksi internet.", NotificationType.Error);
                    return;
                }

                tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), fileName);
                System.IO.File.WriteAllText(tempPath, jsContent, System.Text.Encoding.UTF8);

                // Install the downloaded JS extension
                var loadedSource = await System.Threading.Tasks.Task.Run(() => _sourceManager.InstallPlugin(tempPath));
                
                if (loadedSource != null)
                {
                     LoadExtensions();
                     await FetchRemoteExtensionsAsync();
                     _mainVM.ShowNotification($"{loadedSource.Name} berhasil terpasang!", NotificationType.Success);
                }
                else
                {
                    _mainVM.ShowNotification("Gagal memasang ekstensi.", NotificationType.Error);
                }
            }
            catch (Exception ex)
            {
                _mainVM.ShowNotification($"Download Error: {ex.Message}", NotificationType.Error);
            }
            finally
            {
                if (!string.IsNullOrEmpty(tempPath))
                {
                    try { if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath); } catch { }
                }

                item.IsDownloading = false;
                item.DownloadProgressText = "Mengunduh...";
            }
        }

        private async System.Threading.Tasks.Task RefreshExtensionsAsync()
        {
            _mainVM.ShowNotification("Memeriksa pembaruan ekstensi...", NotificationType.Info);
            LoadExtensions();
            await FetchRemoteExtensionsAsync(force: true);
            _mainVM.ShowNotification("Pemeriksaan ekstensi selesai!", NotificationType.Success);
        }

        // _githubCommitCache removed — commit date checking replaced by Mihon-style integer code comparison.
        // CheckExtensionUpdatesAsync removed — use FetchRemoteExtensionsAsync(force: true) directly (called by RefreshCommand).

        private async void UpdateExtension(ExtensionItem item)
        {
            if (item == null) return;
            var fileName = item.Name.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ? item.Name : $"{item.Name}.js";
            
            item.IsInstalling = true;
            item.DownloadProgress = 0;
            item.DownloadProgressText = "Memperbarui...";

            try
            {
                _mainVM.ShowNotification($"Memperbarui {item.Name}...", NotificationType.Info);

                // Mihon-style update URLs — static files only, no GitHub REST API
                var pkgFileName = !string.IsNullOrEmpty(item.Pkg) ? $"{item.Pkg}.js" : fileName;
                var urlsToTry = new[]
                {
                    // 1. Primary: raw GitHub (main branch — where .js files live)
                    item.RemoteDownloadUrl ?? $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}",
                    // 2. jsDelivr CDN Mirror
                    $"https://cdn.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@main/{pkgFileName}",
                    // 3. Fastly jsDelivr Mirror
                    $"https://fastly.jsdelivr.net/gh/ArisaAkiyama/extension-yomic@main/{pkgFileName}",
                    // 4. GitHack Raw Mirror
                    $"https://raw.githack.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}",
                    // 5. GHProxy Mirror (Anti-ISP Blocking)
                    $"https://ghproxy.net/https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{pkgFileName}"
                };

                string? jsCode = null;
                foreach (var url in urlsToTry)
                {
                    jsCode = await FetchStringNativeAsync(url, 8000).ConfigureAwait(false);
                    if (!string.IsNullOrWhiteSpace(jsCode)) break;
                }

                if (string.IsNullOrWhiteSpace(jsCode))
                {
                    _mainVM.ShowNotification($"Pembaruan gagal untuk {item.Name}: Gagal mengunduh script", NotificationType.Error);
                    return;
                }

                var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                var pluginsDir = Path.Combine(appData, "Yomic", "Plugins");
                if (!Directory.Exists(pluginsDir)) Directory.CreateDirectory(pluginsDir);

                var localPath = Path.Combine(pluginsDir, fileName);
                await File.WriteAllTextAsync(localPath, jsCode);

                // Reload instance in SourceManager
                var newSource = new JsMangaSource(localPath);
                _sourceManager.AddSource(newSource);

                item.Version = newSource.Version;
                item.VersionCode = VersionStringToCode(newSource.Version);
                item.SourceInstance = newSource;
                item.FilePath = localPath;
                item.IsInstalled = true;
                item.HasUpdate = false;
                item.LocalWriteTimeUtc = File.GetLastWriteTimeUtc(localPath);

                _mainVM.ShowNotification($"{item.Name} v{newSource.Version} updated successfully!", NotificationType.Success);
                FilterExtensions();
            }
            catch (Exception ex)
            {
                _mainVM.ShowNotification($"Update failed for {item.Name}: {ex.Message}", NotificationType.Error);
            }
            finally
            {
                item.IsInstalling = false;
            }
        }

        private async void ToggleInstall(ExtensionItem item)
        {
            if (item.IsInstalled)
            {
                // Uninstall (Delete file if it is an installed user plugin, or just remove from list if temp)
                item.IsInstalling = true;
                try
                {
                    await System.Threading.Tasks.Task.Delay(1000);
                    _sourceManager.RemoveSource(item.Id);
                    LoadExtensions();
                    _ = FetchRemoteExtensionsAsync();
                    _mainVM.ShowNotification($"{item.Name} removed.", NotificationType.Success);
                }
                catch (Exception ex)
                {
                    _mainVM.ShowNotification($"Failed to uninstall {item.Name}: {ex.Message}", NotificationType.Error);
                }
                finally
                {
                    // Bug Fix: Always reset IsInstalling so button is not stuck in loading state
                    item.IsInstalling = false;
                }
            }
        }

        private static string GetKnownDomainForExtension(string cleanName)
        {
            var name = cleanName.ToLowerInvariant();
            return name switch
            {
                "aarlas" => "aarlas.com",
                "ainzscansid" => "ainzscans.id",
                "astralscans" => "astralscans.com",
                "bacakomik" => "bacakomik.co",
                "bacami" => "bacami.id",
                "comicazen" => "comicazen.com",
                "cosmicscansid" => "cosmicscans.id",
                "dailysuka" => "dailysuka.com",
                "dojingnet" => "dojing.net",
                "doujindesu" => "doujindesu.tv",
                "doujindesuunoriginal" => "doujindesu.tv",
                "doujinku" => "doujinku.net",
                "dreamteamsscans" => "dreamteams.id",
                "hentaicrot" => "hentaicrot.com",
                "holotoon" => "holotoon.net",
                "hwago" => "hwago.org",
                "inazumanga" => "inazumanga.com",
                "izanamiscans" => "izanamiscans.org",
                "kanzenin" => "kanzenin.xyz",
                "kiryuu" => "kiryuu.id",
                "komikav" => "komikav.com",
                "komikcast" => "komikcast.cz",
                "komikdewasa" => "komikdewasa.org",
                "komikdewasaart" => "komikdewasa.art",
                "komikhwa" => "komikhwa.com",
                "komikindo" => "komikindo.tv",
                "komikindoco" => "komikindo.co",
                "komikindoid" => "komikindo.id",
                "komiknesia" => "komiknesia.com",
                "komiknextgonline" => "komiknextg.online",
                "komikstation" => "komikstation.co",
                "komiktap" => "komiktap.me",
                "komiku" => "komiku.id",
                "komikucc" => "komiku.cc",
                "komikucom" => "komiku.com",
                "komikzoid" => "komikzoid.com",
                "kumapoi" => "kumapoi.me",
                "kumopoi" => "kumopoi.me",
                "kuromanga" => "kuromanga.com",
                "lepoytl" => "lepoytl.com",
                "lianscans" => "lianscans.my.id",
                "lumoskomik" => "lumoskomik.com",
                "luvyaa" => "luvyaa.com",
                "maid" => "maid.my.id",
                "maidmanga" => "maid.my.id",
                "mangacan" => "mangacanblog.com",
                "mangakuri" => "mangakuri.net",
                "mangalay" => "mangalay.com",
                "mangasusu" => "mangasusu.co",
                "mangatale" => "mangatale.co",
                "manhwadesu" => "manhwadesu.org",
                "manhwahana" => "manhwahana.com",
                "manhwaindo" => "manhwaindo.id",
                "manhwalandmom" => "manhwaland.mom",
                "manhwalistid" => "manhwalist.id",
                "manhwalistorg" => "manhwalist.org",
                "medusascans" => "medusascans.com",
                "mgkomik" => "mgkomik.com",
                "mihentai" => "mihentai.com",
                "mikoroku" => "mikoroku.web.id",
                "narasininja" => "narasininja.com",
                "natsu" => "natsu.id",
                "ngamenkomik" => "ngamenkomik.com",
                "ngomik" => "ngomik.net",
                "noromax" => "noromax.com",
                "okyykomik" => "okyykomik.my.id",
                "omicaso" => "omicaso.com",
                "otascans" => "otascans.com",
                "pixhentai" => "pixhentai.com",
                "pornhwa18" => "pornhwa18.com",
                "pramramadhan" => "pramramadhan.com",
                "riztranslation" => "riztranslation.com",
                "roseveil" => "roseveil.org",
                "sasangeyou" => "sasangeyou.com",
                "sektedoujin" => "sektedoujin.cc",
                "sektekomik" => "sektekomik.biz",
                "shinigami" => "shinigamiscans.com",
                "shirakami" => "shirakami.id",
                "shirodoujin" => "shirodoujin.com",
                "shiyurasub" => "shiyurasub.com",
                "siimanga" => "siimanga.com",
                "softkomik" => "softkomik.com",
                "soulscans" => "soulscans.my.id",
                "themanga" => "themanga.net",
                "tooncubus" => "tooncubus.com",
                "ulascomic" => "ulascomic.com",
                "westmanga" => "westmanga.info",
                "yubikiri" => "yubikiri.id",
                "weebcentral" => "weebcentral.com",
                "mangabat" => "h.mangabat.com",
                "mangafire" => "mangafire.to",
                "mangadex" => "mangadex.org",
                "nhentai" => "nhentai.net",
                _ => $"{name}.com"
            };
        }

        private async System.Threading.Tasks.Task LoadFaviconFromRemoteJsAsync(ExtensionItem item)
        {
            if (string.IsNullOrEmpty(item.Name)) return;
            try
            {
                var domain = GetKnownDomainForExtension(item.Name);
                if (!string.IsNullOrEmpty(domain))
                {
                    await LoadIconAsync(item, $"https://www.google.com/s2/favicons?domain={domain}&sz=128");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load favicon for {item.Name}: {ex.Message}");
            }
        }

        private async System.Threading.Tasks.Task LoadIconAsync(ExtensionItem item, string url)
        {
            item.IsLoadingIcon = true;
            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                var iconsDir = System.IO.Path.Combine(appData, "Yomic", "Icons");
                if (!System.IO.Directory.Exists(iconsDir)) System.IO.Directory.CreateDirectory(iconsDir);

                var iconFile = System.IO.Path.Combine(iconsDir, $"{item.Id}.png");
                byte[] bytes;

                if (System.IO.File.Exists(iconFile))
                {
                    bytes = await System.IO.File.ReadAllBytesAsync(iconFile);
                }
                else
                {
                    using var cts = new System.Threading.CancellationTokenSource(TimeSpan.FromSeconds(4));
                    bytes = await _iconClient.GetByteArrayAsync(url, cts.Token);
                    await System.IO.File.WriteAllBytesAsync(iconFile, bytes);
                }

                using var stream = new MemoryStream(bytes);
                var bitmap = new Bitmap(stream);
                
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    item.IconBitmap = bitmap;
                    item.IconText = ""; 
                });
            }
            catch (Exception ex)
            {
                // Silently swallow favicon 404/timeout errors
                System.Diagnostics.Debug.WriteLine($"[ExtensionsVM] Icon load skipped for {item.Name}: {ex.Message}");
            }
            finally
            {
                item.IsLoadingIcon = false;
            }
        }
        
        private void LoadLanguageFlags(ExtensionItem item)
        {
             // Clear existing
             item.LanguageFlags.Clear();

             // Logic for Global / Multi-Language Sources
             if (item.Name.Equals("MangaDex", StringComparison.OrdinalIgnoreCase) || item.Language.Equals("global", StringComparison.OrdinalIgnoreCase))
             {
                 AddFlag(item, "id.png");
                 AddFlag(item, "gb.png");
                 return;
             }

             // Logic for Single Language Sources
             if (item.Language.Equals("id", StringComparison.OrdinalIgnoreCase))
             {
                 AddFlag(item, "id.png");
             }
             else if (item.Language.Equals("en", StringComparison.OrdinalIgnoreCase) || 
                      item.Language.Equals("gb", StringComparison.OrdinalIgnoreCase))
             {
                 AddFlag(item, "gb.png");
             }
        }

        private void AddFlag(ExtensionItem item, string fileName)
        {
            try
            {
                var uri = new Uri($"avares://Yomic/Assets/Flags/{fileName}");
                if (AssetLoader.Exists(uri))
                {
                    using var stream = AssetLoader.Open(uri);
                    item.LanguageFlags.Add(new Bitmap(stream));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load flag {fileName}: {ex.Message}");
            }
        }

        public void Dispose()
        {
            foreach (var item in _allExtensionsCache)
            {
                item.Dispose();
            }
            _allExtensionsCache.Clear();
            FilteredExtensions.Clear();

            System.Diagnostics.Debug.WriteLine("[ExtensionsVM] Disposed and memory references cleared.");
        }
    }
}
