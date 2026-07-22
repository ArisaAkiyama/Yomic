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
        public string? DownloadUrl { get; set; } // Raw URL from GitHub

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
        
        private static readonly HashSet<string> IndonesianExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            "luvyaa", "aarlas", "ainzscansid", "astralscans", "bacakomik", 
            "bacami", "comicazen", "cosmicscansid", "dailysuka", 
            "dojingnet", "doujindesu", "doujindesuunoriginal", "doujinku", "dreamteamsscans", 
            "hentaicrot", "holotoon", "hwago", "inazumanga", "izanamiscans", 
            "kanzenin", "kiryuu", "klikmanga", "komikav", "komikcast", 
            "komikdewasa", "komikdewasaart", "komikhwa", "komikindo", "komikindoco", 
            "komikindoid", "komiknesia", "komiknextgonline", "komikstation", "komiktap", 
            "komiku", "komikucc", "komikucom", "komikzoid", "kumapoi", 
            "kumopoi", "kuromanga", "lepoytl", "lianscans", "lumoskomik", 
            "maid", "maidmanga", "mangacan", "mangakuri", "mangalay", "mangasusu", 
            "mangatale", "manhwadesu", "manhwahana", "manhwaindo", "manhwalandmom", 
            "manhwalistid", "manhwalistorg", "medusascans", "mgkomik", "mihentai", 
            "mikoroku", "narasininja", "natsu", "ngamenkomik", "ngomik", 
            "noromax", "okyykomik", "omicaso", "otascans", "pixhentai", 
            "pornhwa18", "pramramadhan", "riztranslation", "roseveil", "sasangeyou", 
            "sektedoujin", "sektekomik", "shinigami", "shirakami", "shirodoujin", 
            "shiyurasub", "siimanga", "softkomik", "soulscans", "themanga", 
            "tooncubus", "ulascomic", "westmanga", "yubikiri"
        };
        
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

        private async System.Threading.Tasks.Task FetchRemoteExtensionsAsync()
        {
            if (IsOffline) return;

            try
            {
                if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
                {
                    _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                }

                string? responseText = null;
                try
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/repos/ArisaAkiyama/extension-yomic/contents");
                    using var res = await _httpClient.SendAsync(req);
                    if (res.IsSuccessStatusCode)
                    {
                        responseText = await res.Content.ReadAsStringAsync();
                    }
                }
                catch { }

                // Fallback to raw.githubusercontent.com index.json if REST API is rate-limited (403)
                if (string.IsNullOrEmpty(responseText))
                {
                    try
                    {
                        responseText = await _httpClient.GetStringAsync("https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/index.json");
                    }
                    catch { }
                }

                if (string.IsNullOrEmpty(responseText)) return;

                var files = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(responseText);
                
                if (files.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    foreach (var file in files.EnumerateArray())
                    {
                        var type = file.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;
                        var name = file.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
                        if (string.IsNullOrWhiteSpace(name)) continue;

                        if (string.Equals(type, "file", StringComparison.OrdinalIgnoreCase) || string.IsNullOrEmpty(type))
                        {
                            AddRemoteJsExtension(file);
                        }
                        else if (string.Equals(type, "dir", StringComparison.OrdinalIgnoreCase) &&
                                 !name.Equals("icons", StringComparison.OrdinalIgnoreCase))
                        {
                            await FetchRemoteJsExtensionsFromFolderAsync(name);
                        }
                    }
                    FilterExtensions();
                    _ = CheckExtensionUpdatesAsync();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to fetch remote extensions: {ex.Message}");
            }
        }

        private async System.Threading.Tasks.Task FetchRemoteJsExtensionsFromFolderAsync(string folderName)
        {
            try
            {
                var url = $"https://api.github.com/repos/ArisaAkiyama/extension-yomic/contents/{Uri.EscapeDataString(folderName)}";
                var response = await _httpClient.GetStringAsync(url);
                var files = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.JsonElement>(response);
                if (files.ValueKind != System.Text.Json.JsonValueKind.Array) return;

                foreach (var file in files.EnumerateArray())
                {
                    AddRemoteJsExtension(file);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to fetch JS extensions from {folderName}: {ex.Message}");
            }
        }

        private void AddRemoteJsExtension(System.Text.Json.JsonElement file)
        {
            var type = file.TryGetProperty("type", out var typeProp) ? typeProp.GetString() : null;
            var name = file.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : null;
            if (!string.Equals(type, "file", StringComparison.OrdinalIgnoreCase) ||
                string.IsNullOrWhiteSpace(name) ||
                !name.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            var downloadUrl = file.TryGetProperty("download_url", out var downloadProp) ? downloadProp.GetString() : null;
            if (string.IsNullOrWhiteSpace(downloadUrl)) return;

            var cleanName = name
                .Replace("Yomic.Extensions.", "", StringComparison.OrdinalIgnoreCase)
                .Replace(".js", "", StringComparison.OrdinalIgnoreCase);

            var existing = _allExtensionsCache.FirstOrDefault(x =>
                x.Name.Equals(cleanName, StringComparison.OrdinalIgnoreCase) ||
                (x.DownloadUrl != null && x.DownloadUrl.Equals(downloadUrl, StringComparison.OrdinalIgnoreCase)) ||
                (x.FilePath != null && x.FilePath.EndsWith(name, StringComparison.OrdinalIgnoreCase)));
            if (existing != null)
            {
                if (string.IsNullOrEmpty(existing.RemoteDownloadUrl)) existing.RemoteDownloadUrl = downloadUrl;

                var commitDateStr = file.TryGetProperty("last_commit_date", out var dProp) ? dProp.GetString() : null;
                if (!string.IsNullOrEmpty(commitDateStr) && DateTime.TryParse(commitDateStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal, out DateTime remoteCommitUtc))
                {
                    DateTime localTimeUtc = DateTime.MinValue;
                    var localPath = existing.FilePath ?? _sourceManager.GetSourcePath(existing.Id);
                    if (!string.IsNullOrEmpty(localPath) && File.Exists(localPath))
                    {
                        localTimeUtc = File.GetLastWriteTimeUtc(localPath);
                    }

                    if (remoteCommitUtc > localTimeUtc.AddSeconds(5))
                    {
                        existing.HasUpdate = true;
                        existing.RemoteCommitDateText = remoteCommitUtc.ToLocalTime().ToString("dd MMM yyyy HH:mm");
                        LogService.Info("ExtensionsVM", $"Update available for {existing.Name} ({name}) via index.json! Remote Commit: {remoteCommitUtc.ToLocalTime()}, Local file: {localTimeUtc.ToLocalTime()}");
                    }
                }
                return;
            }

            string lowerName = cleanName.ToLower();
            string lang = "en";
            if (IndonesianExtensions.Contains(lowerName) ||
                lowerName.Contains("komik") ||
                lowerName.Contains("indo"))
                lang = "id";
            else if (lowerName == "mangadex" || lowerName == "nhentai")
                lang = "global";

            long stableId;
            try
            {
                var hashName = "JS_" + cleanName + "_" + lang;
                var hash = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(hashName));
                stableId = BitConverter.ToInt64(hash, 0);
            }
            catch
            {
                stableId = cleanName.GetHashCode();
            }

            long size = 0;
            if (file.TryGetProperty("size", out var sizeProp) && sizeProp.ValueKind == System.Text.Json.JsonValueKind.Number)
            {
                size = sizeProp.GetInt64();
            }

            var extItem = new ExtensionItem
            {
                Id = stableId,
                Name = cleanName,
                Description = "Available on GitHub",
                IsInstalled = false,
                DownloadUrl = downloadUrl,
                IconText = cleanName.Substring(0, 1),
                Version = "Latest",
                Language = lang,
                FileSizeText = size > 0 ? FormatBytes(size) : "",
                IsNsfw = cleanName.Contains("nhentai", StringComparison.OrdinalIgnoreCase)
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
            // Bug Fix: Guard against double-click / concurrent download
            if (item.IsDownloading) return;

            item.IsDownloading = true;
            item.DownloadProgress = 0;
            item.DownloadProgressText = "Downloading 0%";
            _mainVM.ShowNotification($"Downloading {item.Name}...", NotificationType.Info);

            try
            {
                if (!item.DownloadUrl.EndsWith(".js", StringComparison.OrdinalIgnoreCase))
                {
                    _mainVM.ShowNotification("Only JS extensions are supported from GitHub.", NotificationType.Error);
                    return;
                }

                var tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"{item.Name}.js");
                
                if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
                {
                    _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                }
                
                using (var response = await _httpClient.GetAsync(item.DownloadUrl, HttpCompletionOption.ResponseHeadersRead))
                {
                    response.EnsureSuccessStatusCode();
                    
                    var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                    using var stream = await response.Content.ReadAsStreamAsync();
                    using var fileStream = new System.IO.FileStream(tempPath, System.IO.FileMode.Create, System.IO.FileAccess.Write, System.IO.FileShare.None, 8192, true);
                    
                    var buffer = new byte[8192];
                    long totalRead = 0;
                    int read;
                    
                    while ((read = await stream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, read);
                        totalRead += read;
                        
                        if (totalBytes != -1)
                        {
                            var progress = (double)totalRead / totalBytes;
                            item.DownloadProgress = progress;
                            item.DownloadProgressText = $"Downloading {(int)(progress * 100)}%";
                        }
                        else
                        {
                            item.DownloadProgressText = $"Downloading {totalRead / 1024} KB";
                        }
                    }
                }

                // Install the downloaded JS extension
                var loadedSource = await System.Threading.Tasks.Task.Run(() => _sourceManager.InstallPlugin(tempPath));
                
                if (loadedSource != null)
                {
                     LoadExtensions();
                     await FetchRemoteExtensionsAsync(); // Refresh remote list to catch any others
                     _mainVM.ShowNotification($"{loadedSource.Name} installed successfully!", NotificationType.Success);
                }
                else
                {
                    _mainVM.ShowNotification("Failed to install downloaded extension.", NotificationType.Error);
                }
            }
            catch (Exception ex)
            {
                _mainVM.ShowNotification($"Download Error: {ex.Message}", NotificationType.Error);
            }
            finally
            {
                // Bug Fix: Always cleanup temp file to avoid disk bloat
                var tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"{item.Name}.js");
                try { if (System.IO.File.Exists(tempPath)) System.IO.File.Delete(tempPath); } catch { }

                item.IsDownloading = false;
                item.DownloadProgressText = "Downloading...";
            }
        }

        private async System.Threading.Tasks.Task RefreshExtensionsAsync()
        {
            _mainVM.ShowNotification("Memeriksa pembaruan ekstensi...", NotificationType.Info);
            LoadExtensions();
            await FetchRemoteExtensionsAsync();
            _mainVM.ShowNotification("Pemeriksaan ekstensi selesai!", NotificationType.Success);
        }

        private static readonly Dictionary<string, (DateTime commitUtc, DateTime cachedAt)> _githubCommitCache = new(StringComparer.OrdinalIgnoreCase);
        private bool _isRateLimitedNoticeShown = false;

        private async System.Threading.Tasks.Task CheckExtensionUpdatesAsync()
        {
            if (IsOffline) return;

            var installedItems = _allExtensionsCache.Where(x => x.IsInstalled).ToList();
            if (installedItems.Count == 0) return;

            foreach (var item in installedItems)
            {
                try
                {
                    // Fix: Extract exact filename from DownloadUrl if available, or convert name to lowercase .js
                    string fileName = "";
                    if (!string.IsNullOrEmpty(item.RemoteDownloadUrl))
                    {
                        var uri = new Uri(item.RemoteDownloadUrl);
                        var relativePath = uri.AbsolutePath;
                        var mainIdx = relativePath.IndexOf("/main/", StringComparison.OrdinalIgnoreCase);
                        fileName = mainIdx != -1 ? relativePath.Substring(mainIdx + 6) : System.IO.Path.GetFileName(uri.AbsolutePath);
                    }
                    else if (!string.IsNullOrEmpty(item.DownloadUrl))
                    {
                        var uri = new Uri(item.DownloadUrl);
                        var relativePath = uri.AbsolutePath;
                        var mainIdx = relativePath.IndexOf("/main/", StringComparison.OrdinalIgnoreCase);
                        fileName = mainIdx != -1 ? relativePath.Substring(mainIdx + 6) : System.IO.Path.GetFileName(uri.AbsolutePath);
                    }
                    else
                    {
                        fileName = item.Name.ToLower() + ".js";
                    }

                    DateTime remoteCommitUtc = DateTime.MinValue;
                    bool isCached = _githubCommitCache.TryGetValue(fileName, out var cachedInfo) && (DateTime.UtcNow - cachedInfo.cachedAt).TotalMinutes < 15;

                    if (isCached)
                    {
                        remoteCommitUtc = cachedInfo.commitUtc;
                    }
                    else
                    {
                        var url = $"https://api.github.com/repos/ArisaAkiyama/extension-yomic/commits?path={Uri.EscapeDataString(fileName)}&per_page=1";
                        
                        if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
                        {
                            _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                        }

                        using var req = new HttpRequestMessage(HttpMethod.Get, url);
                        using var res = await _httpClient.SendAsync(req);
                        
                        if (res.StatusCode == System.Net.HttpStatusCode.Forbidden)
                        {
                            if (!_isRateLimitedNoticeShown)
                            {
                                _isRateLimitedNoticeShown = true;
                                _mainVM.ShowNotification("Batas permintaan GitHub (rate limit) tercapai. Coba lagi nanti.", NotificationType.Warning);
                            }
                            break;
                        }

                        if (!res.IsSuccessStatusCode) continue;

                        var responseText = await res.Content.ReadAsStringAsync();
                        using var doc = System.Text.Json.JsonDocument.Parse(responseText);
                        
                        if (doc.RootElement.ValueKind == System.Text.Json.JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                        {
                            var firstCommit = doc.RootElement[0];
                            if (firstCommit.TryGetProperty("commit", out var commitObj) &&
                                commitObj.TryGetProperty("committer", out var committerObj) &&
                                committerObj.TryGetProperty("date", out var dateProp))
                            {
                                var dateStr = dateProp.GetString();
                                if (!string.IsNullOrEmpty(dateStr) && DateTime.TryParse(dateStr, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AdjustToUniversal, out remoteCommitUtc))
                                {
                                    _githubCommitCache[fileName] = (remoteCommitUtc, DateTime.UtcNow);
                                }
                                else
                                {
                                    continue;
                                }
                            }
                            else
                            {
                                continue;
                            }
                        }
                        else
                        {
                            continue;
                        }
                    }

                    DateTime localTimeUtc = DateTime.MinValue;
                    var localPath = item.FilePath ?? _sourceManager.GetSourcePath(item.Id);
                    if (!string.IsNullOrEmpty(localPath) && File.Exists(localPath))
                    {
                        localTimeUtc = File.GetLastWriteTimeUtc(localPath);
                    }

                    // Compare remote commit date vs local file write time
                    if (remoteCommitUtc > localTimeUtc.AddSeconds(5))
                    {
                        item.HasUpdate = true;
                        item.RemoteCommitDateText = remoteCommitUtc.ToLocalTime().ToString("dd MMM yyyy HH:mm");
                        if (string.IsNullOrEmpty(item.RemoteDownloadUrl))
                        {
                            item.RemoteDownloadUrl = $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{fileName}";
                        }

                        LogService.Info("ExtensionsVM", $"Update available for {item.Name} ({fileName})! GitHub Commit: {remoteCommitUtc.ToLocalTime()}, Local file write time: {localTimeUtc.ToLocalTime()}");
                    }
                    else
                    {
                        item.HasUpdate = false;
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Failed to check updates for {item.Name}: {ex.Message}");
                }
            }

            Avalonia.Threading.Dispatcher.UIThread.Post(() => FilterExtensions());
        }

        private async void UpdateExtension(ExtensionItem item)
        {
            if (item == null) return;
            var fileName = item.Name.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ? item.Name : $"{item.Name}.js";
            var downloadUrl = item.RemoteDownloadUrl ?? $"https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/{fileName}";

            item.IsInstalling = true;
            item.DownloadProgress = 0;
            item.DownloadProgressText = "Updating...";

            try
            {
                _mainVM.ShowNotification($"Updating {item.Name}...", NotificationType.Info);

                if (!_httpClient.DefaultRequestHeaders.UserAgent.Any())
                {
                    _httpClient.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                }

                var jsCode = await _httpClient.GetStringAsync(downloadUrl);
                if (string.IsNullOrWhiteSpace(jsCode))
                {
                    _mainVM.ShowNotification($"Update failed for {item.Name}: Empty script", NotificationType.Error);
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

        private async System.Threading.Tasks.Task LoadFaviconFromRemoteJsAsync(ExtensionItem item)
        {
            if (string.IsNullOrEmpty(item.DownloadUrl)) return;
            item.IsLoadingIcon = true;
            try
            {
                using var optClient = _mainVM.NetworkService.CreateOptimizedHttpClient();
                var script = await optClient.GetStringAsync(item.DownloadUrl);
                
                var matchIcon = System.Text.RegularExpressions.Regex.Match(script, @"iconUrl:\s*['""](.*?)['""]");
                if (matchIcon.Success && !string.IsNullOrEmpty(matchIcon.Groups[1].Value))
                {
                    await LoadIconAsync(item, matchIcon.Groups[1].Value);
                    return;
                }

                var matchBaseUrl = System.Text.RegularExpressions.Regex.Match(script, @"baseUrl:\s*['""](.*?)['""]");
                if (matchBaseUrl.Success && !string.IsNullOrEmpty(matchBaseUrl.Groups[1].Value))
                {
                    var baseUrl = matchBaseUrl.Groups[1].Value;
                    if (Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri))
                    {
                        var domain = uri.Host;
                        await LoadIconAsync(item, $"https://www.google.com/s2/favicons?domain={domain}&sz=128");
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load favicon for {item.Name}: {ex.Message}");
            }
            finally
            {
                item.IsLoadingIcon = false;
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
                    using var optClient = _mainVM.NetworkService.CreateOptimizedHttpClient();
                    bytes = await optClient.GetByteArrayAsync(url);
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
                System.Diagnostics.Debug.WriteLine($"[ExtensionsVM] Icon load failed: {ex.Message}");
            }
            finally
            {
                item.IsLoadingIcon = false;
            }
        }

        private void LoadDefaultExtensionIcon(ExtensionItem item)
        {
            try
            {
                var uri = new Uri("avares://Yomic/Assets/Icons/WindowsIcons/extensions.ico");
                if (AssetLoader.Exists(uri))
                {
                    using var stream = AssetLoader.Open(uri);
                    item.IconBitmap = new Bitmap(stream);
                    item.IconText = "";
                    item.IconBackground = "Transparent";
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load default extension icon: {ex.Message}");
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
