using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;

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
        public event Action<int>? SourceStatusRefreshIntervalMinutesChanged;

        private int _sourceStatusRefreshIntervalMinutes = 30; // Default 30 minutes
        public int SourceStatusRefreshIntervalMinutes
        {
            get => _sourceStatusRefreshIntervalMinutes;
            set
            {
                if (_sourceStatusRefreshIntervalMinutes != value)
                {
                    _sourceStatusRefreshIntervalMinutes = value;
                    SourceStatusRefreshIntervalMinutesChanged?.Invoke(value);
                }
            }
        }

        public bool SecureScreen { get; set; } = false;
        public bool UpdateOnStart { get; set; } = false;
        public int AutoUpdateIntervalHours { get; set; } = 12; // 0 = Disabled, default 12h
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
        public bool EnableImageOptimization { get; set; } = true;
        public bool EnableAutoCropBorders { get; set; } = false;
        public int MaxImageDimension { get; set; } = 2160;
        public bool EnableImageSharpening { get; set; } = false;
        public bool UseSmartUpdate { get; set; } = true;
        public bool LibraryIsListView { get; set; } = false;
        public bool AutoDownloadNextChapter { get; set; } = false;
        public bool SkipFilteredChapters { get; set; } = false;
        public string LastBackupTime { get; set; } = "";
        public string LastBackupSize { get; set; } = "";
        public string MangaDexLanguage { get; set; } = "en";
        public int DefaultReaderMode { get; set; } = 0; // 0=Webtoon, 1=Single Page, 2=Dual Page
        public string ReadingDirection { get; set; } = "ltr"; // "ltr" | "rtl"
        public string ReaderFitMode { get; set; } = "fit-width"; // "fit-width" | "fit-height" | "original"
        public bool AutoDarkReader { get; set; } = true;
        public bool ShowUnreadBadges { get; set; } = true;
        public bool AutoSyncTracker { get; set; } = true;
        public string AppLanguage { get; set; } = "id";
        public string LastFeedbackDate { get; set; } = "";
        public string FeedbackWebhookUrl { get; set; } = DefaultFeedbackWebhookUrl;

        public const string DefaultFeedbackWebhookUrl = "https://script.google.com/macros/s/AKfycbxRe38pavuutQibdL5bYSvR2xKXumHU6A_4cnrGh0zA_FxAsX6usetRSRhohHS9gZ-fZg/exec";
        
        public static string OfficialDefaultExtensionRepo => "https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/repo/index.min.json";
        
        // MyAnimeList Tokens
        public string MalAccessToken { get; set; } = "";
        public string MalRefreshToken { get; set; } = "";
        public long MalTokenExpiresAt { get; set; } = 0;
        public string MalUsername { get; set; } = "";

        public string LastReadAnnouncementId { get; set; } = "";
        public string CustomHotkeysJson { get; set; } = "";

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
                        AutoUpdateIntervalHours = settings.AutoUpdateIntervalHours;
                        CheckAppUpdateOnStart = settings.CheckAppUpdateOnStart;
                        IsFirstRun = settings.IsFirstRun;
                        LibrarySortMode = settings.LibrarySortMode;
                        ShowNsfwSources = settings.ShowNsfwSources;
                        DnsOverHttpsProvider = settings.DnsOverHttpsProvider;
                        PreloadNextChapter = settings.PreloadNextChapter;
                        MaxCacheSizeMb = settings.MaxCacheSizeMb;
                        ReaderPerformanceMode = settings.ReaderPerformanceMode;
                        EnableImageOptimization = settings.EnableImageOptimization;
                        EnableAutoCropBorders = settings.EnableAutoCropBorders;
                        MaxImageDimension = settings.MaxImageDimension > 0 ? settings.MaxImageDimension : 2160;
                        EnableImageSharpening = settings.EnableImageSharpening;
                        UseSmartUpdate = settings.UseSmartUpdate;
                        LibraryIsListView = settings.LibraryIsListView;
                        AutoDownloadNextChapter = settings.AutoDownloadNextChapter;
                        SkipFilteredChapters = settings.SkipFilteredChapters;
                        LastBackupTime = settings.LastBackupTime ?? "";
                        LastBackupSize = settings.LastBackupSize ?? "";
                        MangaDexLanguage = settings.MangaDexLanguage ?? "en";
                        DefaultReaderMode = settings.DefaultReaderMode;
                        ReadingDirection = string.IsNullOrWhiteSpace(settings.ReadingDirection) ? "ltr" : settings.ReadingDirection;
                        ReaderFitMode = string.IsNullOrWhiteSpace(settings.ReaderFitMode) ? "fit-width" : settings.ReaderFitMode;
                        AutoDarkReader = settings.AutoDarkReader;
                        ShowUnreadBadges = settings.ShowUnreadBadges;
                        AutoSyncTracker = settings.AutoSyncTracker;
                        AppLanguage = string.IsNullOrWhiteSpace(settings.AppLanguage) ? "id" : settings.AppLanguage;
                        LastFeedbackDate = settings.LastFeedbackDate ?? "";
                        FeedbackWebhookUrl = string.IsNullOrWhiteSpace(settings.FeedbackWebhookUrl) ||
                                             settings.FeedbackWebhookUrl.Contains("AKfycby_qcMGyle2jYmxGmhf3j_L1VcYsyVcy8iBdxfnXzAf5zruVKttJ3FHe8w52XOUVNHi", StringComparison.OrdinalIgnoreCase) ||
                                             settings.FeedbackWebhookUrl.Contains("AKfycbwuIPT0bwyrpQoIvcrEdyfnaDSSI98UjZSzFnd1EtzJUVIVW45RTmsPLHztJ5wGRf3tkg", StringComparison.OrdinalIgnoreCase)
                            ? DefaultFeedbackWebhookUrl
                            : settings.FeedbackWebhookUrl;
                        MalAccessToken = UnprotectSecret(settings.MalAccessToken);
                        MalRefreshToken = UnprotectSecret(settings.MalRefreshToken);
                        MalTokenExpiresAt = settings.MalTokenExpiresAt;
                        MalUsername = settings.MalUsername ?? "";
                        LastReadAnnouncementId = settings.LastReadAnnouncementId ?? "";
                        CustomHotkeysJson = settings.CustomHotkeysJson ?? "";
                        if (settings.SourceStatusRefreshIntervalMinutes >= 0)
                        {
                            SourceStatusRefreshIntervalMinutes = settings.SourceStatusRefreshIntervalMinutes;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Error loading settings", ex);
            }
        }

        public void Reload()
        {
            lock (_saveLock)
            {
                _saveTimer?.Dispose();
                _saveTimer = null;
                Load();
            }
        }

        public void SaveImmediate()
        {
            lock (_saveLock)
            {
                _saveTimer?.Dispose();
                _saveTimer = null;
                SaveInternal();
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
                    AutoUpdateIntervalHours = AutoUpdateIntervalHours,
                    CheckAppUpdateOnStart = CheckAppUpdateOnStart,
                    IsFirstRun = IsFirstRun,
                    LibrarySortMode = LibrarySortMode,
                    ShowNsfwSources = ShowNsfwSources,
                    DnsOverHttpsProvider = DnsOverHttpsProvider,
                    PreloadNextChapter = PreloadNextChapter,
                    MaxCacheSizeMb = MaxCacheSizeMb,
                    ReaderPerformanceMode = ReaderPerformanceMode,
                    EnableImageOptimization = EnableImageOptimization,
                    EnableAutoCropBorders = EnableAutoCropBorders,
                    MaxImageDimension = MaxImageDimension,
                    EnableImageSharpening = EnableImageSharpening,
                    UseSmartUpdate = UseSmartUpdate,
                    LibraryIsListView = LibraryIsListView,
                    AutoDownloadNextChapter = AutoDownloadNextChapter,
                    SkipFilteredChapters = SkipFilteredChapters,
                    LastBackupTime = LastBackupTime,
                    LastBackupSize = LastBackupSize,
                    MangaDexLanguage = MangaDexLanguage,
                    DefaultReaderMode = DefaultReaderMode,
                    ReadingDirection = ReadingDirection,
                    ReaderFitMode = ReaderFitMode,
                    AutoDarkReader = AutoDarkReader,
                    ShowUnreadBadges = ShowUnreadBadges,
                    AutoSyncTracker = AutoSyncTracker,
                    AppLanguage = AppLanguage,
                    LastFeedbackDate = LastFeedbackDate,
                    FeedbackWebhookUrl = FeedbackWebhookUrl,
                    MalAccessToken = ProtectSecret(MalAccessToken),
                    MalRefreshToken = ProtectSecret(MalRefreshToken),
                    MalTokenExpiresAt = MalTokenExpiresAt,
                    MalUsername = MalUsername,
                    LastReadAnnouncementId = LastReadAnnouncementId,
                    CustomHotkeysJson = CustomHotkeysJson,
                    SourceStatusRefreshIntervalMinutes = SourceStatusRefreshIntervalMinutes
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
                AutoUpdateIntervalHours = 12;
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
                ReadingDirection = "ltr";
                ReaderFitMode = "fit-width";
                AutoDarkReader = true;
                ShowUnreadBadges = true;
                AutoSyncTracker = true;
                AppLanguage = "id";
                LastFeedbackDate = "";
                FeedbackWebhookUrl = DefaultFeedbackWebhookUrl;
                SourceStatusRefreshIntervalMinutes = 30;
                MalAccessToken = "";
                MalRefreshToken = "";
                MalTokenExpiresAt = 0;
                MalUsername = "";
                LastReadAnnouncementId = "";
                CustomHotkeysJson = "";
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Error resetting settings", ex);
            }
        }

        private const string DpapiPrefix = "dpapi:";
        private const int CRYPTPROTECT_UI_FORBIDDEN = 0x1;

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct DATA_BLOB
        {
            public int cbData;
            public IntPtr pbData;
        }

        [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CryptProtectData(
            ref DATA_BLOB pDataIn,
            string? szDataDescr,
            IntPtr pOptionalEntropy,
            IntPtr pvReserved,
            IntPtr pPromptStruct,
            int dwFlags,
            out DATA_BLOB pDataOut);

        [DllImport("crypt32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool CryptUnprotectData(
            ref DATA_BLOB pDataIn,
            IntPtr ppszDataDescr,
            IntPtr pOptionalEntropy,
            IntPtr pvReserved,
            IntPtr pPromptStruct,
            int dwFlags,
            out DATA_BLOB pDataOut);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr LocalFree(IntPtr hMem);

        private static string ProtectSecret(string? plainText)
        {
            if (string.IsNullOrEmpty(plainText)) return string.Empty;
            if (plainText.StartsWith(DpapiPrefix, StringComparison.Ordinal)) return plainText;

            byte[] inputBytes = Encoding.UTF8.GetBytes(plainText);
            IntPtr inPtr = Marshal.AllocHGlobal(inputBytes.Length);
            try
            {
                Marshal.Copy(inputBytes, 0, inPtr, inputBytes.Length);
                var inBlob = new DATA_BLOB { cbData = inputBytes.Length, pbData = inPtr };
                if (CryptProtectData(ref inBlob, "YomicOAuth", IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, CRYPTPROTECT_UI_FORBIDDEN, out var outBlob))
                {
                    try
                    {
                        byte[] encrypted = new byte[outBlob.cbData];
                        Marshal.Copy(outBlob.pbData, encrypted, 0, outBlob.cbData);
                        return DpapiPrefix + Convert.ToBase64String(encrypted);
                    }
                    finally
                    {
                        if (outBlob.pbData != IntPtr.Zero) LocalFree(outBlob.pbData);
                    }
                }
            }
            catch { }
            finally
            {
                Marshal.FreeHGlobal(inPtr);
            }
            return plainText;
        }

        private static string UnprotectSecret(string? storedValue)
        {
            if (string.IsNullOrEmpty(storedValue)) return string.Empty;
            if (!storedValue.StartsWith(DpapiPrefix, StringComparison.Ordinal)) return storedValue;

            try
            {
                byte[] cipherBytes = Convert.FromBase64String(storedValue.Substring(DpapiPrefix.Length));
                IntPtr inPtr = Marshal.AllocHGlobal(cipherBytes.Length);
                try
                {
                    Marshal.Copy(cipherBytes, 0, inPtr, cipherBytes.Length);
                    var inBlob = new DATA_BLOB { cbData = cipherBytes.Length, pbData = inPtr };
                    if (CryptUnprotectData(ref inBlob, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, CRYPTPROTECT_UI_FORBIDDEN, out var outBlob))
                    {
                        try
                        {
                            byte[] decrypted = new byte[outBlob.cbData];
                            Marshal.Copy(outBlob.pbData, decrypted, 0, outBlob.cbData);
                            return Encoding.UTF8.GetString(decrypted);
                        }
                        finally
                        {
                            if (outBlob.pbData != IntPtr.Zero) LocalFree(outBlob.pbData);
                        }
                    }
                }
                finally
                {
                    Marshal.FreeHGlobal(inPtr);
                }
            }
            catch { }
            return string.Empty;
        }

        // Helper class for serialization
        private class SettingsModel
        {
            public bool IsDarkMode { get; set; }
            public bool IsOfflineMode { get; set; }
            public bool SecureScreen { get; set; }
            public bool UpdateOnStart { get; set; }
            public int AutoUpdateIntervalHours { get; set; } = 12;
            public bool CheckAppUpdateOnStart { get; set; } = true;
            public bool IsFirstRun { get; set; }
            public int LibrarySortMode { get; set; }
            public bool ShowNsfwSources { get; set; }
            public int DnsOverHttpsProvider { get; set; } = 2;
            public bool PreloadNextChapter { get; set; } = true;
            public int MaxCacheSizeMb { get; set; } = 500;
            public bool ReaderPerformanceMode { get; set; } = false;
        public bool EnableImageOptimization { get; set; } = true;
        public bool EnableAutoCropBorders { get; set; } = false;
        public int MaxImageDimension { get; set; } = 2160;
        public bool EnableImageSharpening { get; set; } = false;
            public bool UseSmartUpdate { get; set; } = true;
            public bool LibraryIsListView { get; set; } = false;
            public bool AutoDownloadNextChapter { get; set; } = false;
            public bool SkipFilteredChapters { get; set; } = false;
            public string LastBackupTime { get; set; } = "";
            public string LastBackupSize { get; set; } = "";
            public string MangaDexLanguage { get; set; } = "en";
            public int DefaultReaderMode { get; set; } = 0;
            public string ReadingDirection { get; set; } = "ltr";
            public string ReaderFitMode { get; set; } = "fit-width";
            public bool AutoDarkReader { get; set; } = true;
            public bool ShowUnreadBadges { get; set; } = true;
            public bool AutoSyncTracker { get; set; } = true;
            public string AppLanguage { get; set; } = "id";
            public string LastFeedbackDate { get; set; } = "";
            public string FeedbackWebhookUrl { get; set; } = DefaultFeedbackWebhookUrl;
            public int SourceStatusRefreshIntervalMinutes { get; set; } = 30;

            // MyAnimeList Tokens
            public string MalAccessToken { get; set; } = "";
            public string MalRefreshToken { get; set; } = "";
            public long MalTokenExpiresAt { get; set; } = 0;
            public string MalUsername { get; set; } = "";

            public string LastReadAnnouncementId { get; set; } = "";
        public string CustomHotkeysJson { get; set; } = "";
        }
    }
}
