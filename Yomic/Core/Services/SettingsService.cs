using System;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Yomic.Core.Services
{
    public class SettingsService
    {
        private readonly string _settingsFilePath;

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

        public bool SecureScreen { get; set; } = false;
        public bool UpdateOnStart { get; set; } = false;
        public int AutoUpdateIntervalHours { get; set; } = 0; // 0 = Disabled
        public bool CheckAppUpdateOnStart { get; set; } = true;
        public bool IsFirstRun { get; set; } = true;
        public int LibrarySortMode { get; set; } = 0; // 0=TitleAsc, 1=TitleDesc, 2=DateModified
        public bool ShowNsfwSources { get; set; } = false;
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
                    LastBackupSize = LastBackupSize
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
        }
    }
}
