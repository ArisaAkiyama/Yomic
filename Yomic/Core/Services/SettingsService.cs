using System;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Yomic.Core.Services
{
    public class SettingsService
    {
        private readonly string _settingsFilePath;
        private System.Threading.Timer? _saveTimer;
        private readonly object _saveLock = new();

        public bool IsDarkMode { get; set; } = true;
        
        private bool _isOfflineMode = false;
        public bool IsOfflineMode 
        { 
            get => _isOfflineMode;
            set
            {
                if (_isOfflineMode != value)
                {
                    _isOfflineMode = value;
                    OfflineModeChanged?.Invoke(value);
                }
            }
        }
        
        public event Action<bool>? OfflineModeChanged;
        public event Action<bool>? ShowNsfwSourcesChanged;

        public bool SecureScreen { get; set; } = false;
        public bool UpdateOnStart { get; set; } = false;
        public int AutoUpdateIntervalHours { get; set; } = 0; // 0 = Disabled
        public bool CheckAppUpdateOnStart { get; set; } = true;
        public bool IsFirstRun { get; set; } = true;
        public int LibrarySortMode { get; set; } = 4; // 4=LastReadDesc (Recently Read)

        private bool _showNsfwSources = false;
        public bool ShowNsfwSources
        {
            get => _showNsfwSources;
            set
            {
                if (_showNsfwSources != value)
                {
                    _showNsfwSources = value;
                    ShowNsfwSourcesChanged?.Invoke(value);
                }
            }
        }
        public int DnsOverHttpsProvider { get; set; } = 2; // 0=None, 1=Cloudflare, 2=Google, 3=AdGuard
        public bool PreloadNextChapter { get; set; } = true;
        public int MaxCacheSizeMb { get; set; } = 500;
        public bool ReaderPerformanceMode { get; set; } = false;
        public bool UseSmartUpdate { get; set; } = true;
        public bool LibraryIsListView { get; set; } = false;
        public bool AutoDownloadNextChapter { get; set; } = false;
        public bool SkipFilteredChapters { get; set; } = false;
        public string LastBackupTime { get; set; } = "";
        public string LastBackupSize { get; set; } = "";
        public string MangaDexLanguage { get; set; } = "en";
        public int DefaultReaderMode { get; set; } = 0; // 0=Webtoon, 1=Single Page, 2=Dual Page
        public string AppLanguage { get; set; } = "en";
        public string LastFeedbackDate { get; set; } = "";
        
        public System.Collections.Generic.List<string> CustomExtensionRepos { get; set; } = new();
        public event Action? ExtensionReposChanged;

        public static string OfficialDefaultExtensionRepo => "https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/repo/index.min.json";

        public System.Collections.Generic.List<string> GetAllExtensionRepos()
        {
            var repos = new System.Collections.Generic.List<string> { OfficialDefaultExtensionRepo };
            if (CustomExtensionRepos != null)
            {
                foreach (var r in CustomExtensionRepos)
                {
                    if (!string.IsNullOrWhiteSpace(r) && !repos.Any(x => x.Equals(r.Trim(), StringComparison.OrdinalIgnoreCase)))
                    {
                        repos.Add(r.Trim());
                    }
                }
            }
            return repos;
        }

        public bool AddExtensionRepo(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return false;
            url = url.Trim();
            if (CustomExtensionRepos == null) CustomExtensionRepos = new();
            if (url.Equals(OfficialDefaultExtensionRepo, StringComparison.OrdinalIgnoreCase)) return false;
            if (CustomExtensionRepos.Any(x => x.Equals(url, StringComparison.OrdinalIgnoreCase))) return false;
            
            CustomExtensionRepos.Add(url);
            Save();
            ExtensionReposChanged?.Invoke();
            return true;
        }

        public bool RemoveExtensionRepo(string url)
        {
            if (string.IsNullOrWhiteSpace(url) || CustomExtensionRepos == null) return false;
            bool removed = CustomExtensionRepos.RemoveAll(r => r.Equals(url.Trim(), StringComparison.OrdinalIgnoreCase)) > 0;
            if (removed)
            {
                Save();
                ExtensionReposChanged?.Invoke();
            }
            return removed;
        }

        public void ResetExtensionRepos()
        {
            if (CustomExtensionRepos != null && CustomExtensionRepos.Count > 0)
            {
                CustomExtensionRepos.Clear();
                Save();
                ExtensionReposChanged?.Invoke();
            }
        }

        public SettingsService()
        {
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var appDir = Path.Combine(appData, "Yomic");
            if (!Directory.Exists(appDir))
            {
                Directory.CreateDirectory(appDir);
            }
            _settingsFilePath = Path.Combine(appDir, "settings.json");
            
            Load();
        }

        public void Load()
        {
            try
            {
                if (File.Exists(_settingsFilePath))
                {
                    var json = File.ReadAllText(_settingsFilePath);
                    var settings = JsonSerializer.Deserialize<SettingsModel>(json);
                    
                    if (settings != null)
                    {
                        IsDarkMode = settings.IsDarkMode;
                        IsOfflineMode = settings.IsOfflineMode;
                        SecureScreen = settings.SecureScreen;
                        UpdateOnStart = settings.UpdateOnStart;
                        CheckAppUpdateOnStart = settings.CheckAppUpdateOnStart;
                        IsFirstRun = settings.IsFirstRun;
                        LibrarySortMode = settings.LibrarySortMode;
                        ShowNsfwSources = settings.ShowNsfwSources;
                        DnsOverHttpsProvider = settings.DnsOverHttpsProvider;
                        PreloadNextChapter = settings.PreloadNextChapter;
                        MaxCacheSizeMb = settings.MaxCacheSizeMb;
                        ReaderPerformanceMode = settings.ReaderPerformanceMode;
                        UseSmartUpdate = settings.UseSmartUpdate;
                        LibraryIsListView = settings.LibraryIsListView;
                        AutoDownloadNextChapter = settings.AutoDownloadNextChapter;
                        SkipFilteredChapters = settings.SkipFilteredChapters;
                        LastBackupTime = settings.LastBackupTime ?? "";
                        LastBackupSize = settings.LastBackupSize ?? "";
                        MangaDexLanguage = settings.MangaDexLanguage ?? "en";
                        DefaultReaderMode = settings.DefaultReaderMode;
                        AppLanguage = settings.AppLanguage ?? "en";
                        LastFeedbackDate = settings.LastFeedbackDate ?? "";
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Error loading settings", ex);
            }
        }

        public void Save()
        {
            lock (_saveLock)
            {
                _saveTimer?.Dispose();
                _saveTimer = new System.Threading.Timer(_ => 
                {
                    lock (_saveLock)
                    {
                        SaveInternal();
                    }
                }, null, 300, System.Threading.Timeout.Infinite);
            }
        }

        private void SaveInternal()
        {
            try
            {
                var settings = new SettingsModel
                {
                    IsDarkMode = IsDarkMode,
                    IsOfflineMode = IsOfflineMode,
                    SecureScreen = SecureScreen,
                    UpdateOnStart = UpdateOnStart,
                    CheckAppUpdateOnStart = CheckAppUpdateOnStart,
                    IsFirstRun = IsFirstRun,
                    LibrarySortMode = LibrarySortMode,
                    ShowNsfwSources = ShowNsfwSources,
                    DnsOverHttpsProvider = DnsOverHttpsProvider,
                    PreloadNextChapter = PreloadNextChapter,
                    MaxCacheSizeMb = MaxCacheSizeMb,
                    ReaderPerformanceMode = ReaderPerformanceMode,
                    UseSmartUpdate = UseSmartUpdate,
                    LibraryIsListView = LibraryIsListView,
                    AutoDownloadNextChapter = AutoDownloadNextChapter,
                    SkipFilteredChapters = SkipFilteredChapters,
                    LastBackupTime = LastBackupTime,
                    LastBackupSize = LastBackupSize,
                    MangaDexLanguage = MangaDexLanguage,
                    DefaultReaderMode = DefaultReaderMode,
                    AppLanguage = AppLanguage,
                    LastFeedbackDate = LastFeedbackDate
                };

                var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_settingsFilePath, json);
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Error saving settings", ex);
            }
        }

        public void Reset()
        {
            try
            {
                if (File.Exists(_settingsFilePath))
                {
                    File.Delete(_settingsFilePath);
                }

                // Reset properties to default
                IsDarkMode = true;
                IsOfflineMode = false;
                SecureScreen = false;
                UpdateOnStart = false;
                CheckAppUpdateOnStart = true;
                IsFirstRun = true;
                LibrarySortMode = 0;
                ShowNsfwSources = false;
                DnsOverHttpsProvider = 2;
                PreloadNextChapter = true;
                MaxCacheSizeMb = 500;
                ReaderPerformanceMode = false;
                UseSmartUpdate = true;
                LibraryIsListView = false;
                AutoDownloadNextChapter = false;
                SkipFilteredChapters = false;
                LastBackupTime = "";
                LastBackupSize = "";
                DefaultReaderMode = 0;
                AppLanguage = "en";
                LastFeedbackDate = "";
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Error resetting settings", ex);
            }
        }

        // Helper class for serialization
        private class SettingsModel
        {
            public bool IsDarkMode { get; set; }
            public bool IsOfflineMode { get; set; }
            public bool SecureScreen { get; set; }
            public bool UpdateOnStart { get; set; }
            public bool CheckAppUpdateOnStart { get; set; }
            public bool IsFirstRun { get; set; }
            public int LibrarySortMode { get; set; }
            public bool ShowNsfwSources { get; set; }
            public int DnsOverHttpsProvider { get; set; } = 2;
            public bool PreloadNextChapter { get; set; } = true;
            public int MaxCacheSizeMb { get; set; } = 500;
            public bool ReaderPerformanceMode { get; set; } = false;
            public bool UseSmartUpdate { get; set; } = true;
            public bool LibraryIsListView { get; set; } = false;
            public bool AutoDownloadNextChapter { get; set; } = false;
            public bool SkipFilteredChapters { get; set; } = false;
            public string LastBackupTime { get; set; } = "";
            public string LastBackupSize { get; set; } = "";
            public string MangaDexLanguage { get; set; } = "en";
            public int DefaultReaderMode { get; set; } = 0;
            public string AppLanguage { get; set; } = "en";
            public string LastFeedbackDate { get; set; } = "";
        }
    }
}
