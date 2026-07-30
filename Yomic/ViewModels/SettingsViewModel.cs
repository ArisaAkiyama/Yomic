using ReactiveUI;
using System.Reactive;
using System;
using System.IO;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using System.Reactive.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
namespace Yomic.ViewModels
{
    public class SettingsViewModel : ViewModelBase
    {
        public string AppVersion => $"v{System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString(3)}";

        private readonly MainWindowViewModel _mainViewModel;

        public enum UpdateStatus
        {
            Idle,
            Checking,
            UpdateAvailable,
            Downloading,
            Installing,
            Failed,
            UpToDate
        }

        private UpdateStatus _updateState = UpdateStatus.Idle;
        public UpdateStatus UpdateState
        {
            get => _updateState;
            set 
            {
                this.RaiseAndSetIfChanged(ref _updateState, value);
                this.RaisePropertyChanged(nameof(UpdateStatusText));
                this.RaisePropertyChanged(nameof(IsUpdateActionEnabled));
                this.RaisePropertyChanged(nameof(IsDownloadingUpdate));
                this.RaisePropertyChanged(nameof(IsUpdateAvailableStyle));
            }
        }

        public bool IsDownloadingUpdate => UpdateState == UpdateStatus.Downloading;
        public bool IsUpdateAvailableStyle => UpdateState == UpdateStatus.UpdateAvailable || UpdateState == UpdateStatus.Failed;

        private double _downloadProgress;
        public double DownloadProgress
        {
            get => _downloadProgress;
            set 
            {
                this.RaiseAndSetIfChanged(ref _downloadProgress, value);
                this.RaisePropertyChanged(nameof(UpdateStatusText));
            }
        }

        private string _latestVersion = "";
        public string LatestVersion
        {
            get => _latestVersion;
            set => this.RaiseAndSetIfChanged(ref _latestVersion, value);
        }

        private string _downloadUrl = "";

        private string GetResourceString(string key, string defaultValue)
        {
            if (Avalonia.Application.Current != null && Avalonia.Application.Current.TryFindResource(key, out var res))
            {
                if (res is string str)
                {
                    return str;
                }
            }
            return defaultValue;
        }

        public string UpdateStatusText
        {
            get
            {
                return UpdateState switch
                {
                    UpdateStatus.Checking => GetResourceString("String.UpdateChecking", "Checking..."),
                    UpdateStatus.UpdateAvailable => GetResourceString("String.UpdateAvailable", "Update Available"),
                    UpdateStatus.Downloading => $"{GetResourceString("String.UpdateDownloading", "Downloading Update")} ({Math.Round(DownloadProgress)}%)",
                    UpdateStatus.Installing => GetResourceString("String.UpdateInstalling", "Installing..."),
                    UpdateStatus.Failed => GetResourceString("String.UpdateFailed", "Update Failed (Retry)"),
                    UpdateStatus.UpToDate => GetResourceString("String.UpdateUpToDate", "You are up to date!"),
                    _ => GetResourceString("String.UpdateCheck", "Check for Updates")
                };
            }
        }

        public bool IsUpdateActionEnabled => UpdateState != UpdateStatus.Checking && UpdateState != UpdateStatus.Downloading && UpdateState != UpdateStatus.Installing;

        // Events for Backup/Restore File Dialogs
        public event Action? RequestBackupDialog;
        public event Action? RequestRestoreDialog;
        public event Action? RequestClearDataDialog;
        public event Action? RequestClearHistoryDialog;

        // General
        private bool _isDarkMode = true;
        public bool IsDarkMode
        {
            get => _isDarkMode;
            set => this.RaiseAndSetIfChanged(ref _isDarkMode, value);
        }

        private bool _isThemeChanging;
        public bool IsThemeChanging
        {
            get => _isThemeChanging;
            set => this.RaiseAndSetIfChanged(ref _isThemeChanging, value);
        }

        public event Action<string>? RequestLanguageRestartConfirmation;

        private int _appLanguageIndex;
        public int AppLanguageIndex
        {
            get => _appLanguageIndex;
            set => this.RaiseAndSetIfChanged(ref _appLanguageIndex, value);
        }

        private bool _isOfflineMode;
        public bool IsOfflineMode
        {
            get => _isOfflineMode;
            set => this.RaiseAndSetIfChanged(ref _isOfflineMode, value);
        }

        private string _lastBackupInfo = "";
        public string LastBackupInfo
        {
            get => _lastBackupInfo;
            set => this.RaiseAndSetIfChanged(ref _lastBackupInfo, value);
        }

        private bool _checkAppUpdateOnStart;
        public bool CheckAppUpdateOnStart
        {
            get => _checkAppUpdateOnStart;
            set => this.RaiseAndSetIfChanged(ref _checkAppUpdateOnStart, value);
        }

        private bool _showNsfwSources;
        public bool ShowNsfwSources
        {
            get => _showNsfwSources;
            set => this.RaiseAndSetIfChanged(ref _showNsfwSources, value);
        }

        private int _dnsOverHttpsProvider;
        public int DnsOverHttpsProvider
        {
            get => _dnsOverHttpsProvider;
            set => this.RaiseAndSetIfChanged(ref _dnsOverHttpsProvider, value);
        }

        // Security
        private bool _secureScreen;
        public bool SecureScreen
        {
            get => _secureScreen;
            set => this.RaiseAndSetIfChanged(ref _secureScreen, value);
        }

        // QoL Settings
        private bool _preloadNextChapter;
        public bool PreloadNextChapter
        {
            get => _preloadNextChapter;
            set => this.RaiseAndSetIfChanged(ref _preloadNextChapter, value);
        }

        public bool AutoDownloadNextChapter
        {
            get => _settingsService.AutoDownloadNextChapter;
            set
            {
                if (_settingsService.AutoDownloadNextChapter != value)
                {
                    _settingsService.AutoDownloadNextChapter = value;
                    _settingsService.Save();
                    this.RaisePropertyChanged();
                }
            }
        }

        public bool SkipFilteredChapters
        {
            get => _settingsService.SkipFilteredChapters;
            set
            {
                if (_settingsService.SkipFilteredChapters != value)
                {
                    _settingsService.SkipFilteredChapters = value;
                    _settingsService.Save();
                    this.RaisePropertyChanged();
                }
            }
        }

        private bool _readerPerformanceMode;
        public bool ReaderPerformanceMode
        {
            get => _readerPerformanceMode;
            set => this.RaiseAndSetIfChanged(ref _readerPerformanceMode, value);
        }

        private int _maxCacheSizeIndex;
        public int MaxCacheSizeIndex
        {
            get => _maxCacheSizeIndex;
            set => this.RaiseAndSetIfChanged(ref _maxCacheSizeIndex, value);
        }

        // Library
        private bool _updateOnStart;
        public bool UpdateOnStart
        {
            get => _updateOnStart;
            set => this.RaiseAndSetIfChanged(ref _updateOnStart, value);
        }

        private int _autoUpdateIntervalIndex;
        public int AutoUpdateIntervalIndex
        {
            get => _autoUpdateIntervalIndex;
            set => this.RaiseAndSetIfChanged(ref _autoUpdateIntervalIndex, value);
        }

        private bool _useSmartUpdate;
        public bool UseSmartUpdate
        {
            get => _useSmartUpdate;
            set => this.RaiseAndSetIfChanged(ref _useSmartUpdate, value);
        }



        private readonly Core.Services.LibraryService _libraryService;
        private readonly Core.Services.SettingsService _settingsService;
        private readonly Core.Services.SourceManager _sourceManager;
        private readonly Core.Services.NetworkService _networkService;
        private readonly Core.Services.BackupService _backupService;
        
        public ReactiveCommand<Unit, Unit> ClearAllDataCommand { get; }
        public ReactiveCommand<Unit, Unit> ClearReadHistoryCommand { get; }
        public ReactiveCommand<Unit, Unit> ClearCacheCookiesCommand { get; }
        public ReactiveCommand<Unit, Unit> BackupDataCommand { get; }
        public ReactiveCommand<Unit, Unit> RestoreDataCommand { get; }
        public ReactiveCommand<Unit, Unit> CheckForUpdatesCommand { get; }
        public ReactiveCommand<Unit, Unit> VisitWebsiteCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenTrakteerCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenTwitterCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenGitHubCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenFacebookCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenInstagramCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenTikTokCommand { get; }
        public ReactiveCommand<Unit, Unit> SyncLibraryCommand { get; }
        public ReactiveCommand<Unit, Unit> RefreshLibraryCoversCommand { get; }
        public ReactiveCommand<Unit, Unit> OptimizeDatabaseCommand { get; }
        public ReactiveCommand<Unit, Unit> ExportLogsCommand { get; }

        private readonly Core.Services.UpdateService _updateService;

        private async void CheckForUpdates()
        {
            if (UpdateState == UpdateStatus.UpdateAvailable || UpdateState == UpdateStatus.Failed)
            {
                await DownloadAndInstallUpdateAsync();
                return;
            }

            UpdateState = UpdateStatus.Checking;
            _mainViewModel.ShowNotification("Checking for updates...", NotificationType.Info);
            try
            {
                var updateInfo = await _updateService.CheckForUpdatesAsync();
                if (updateInfo.IsUpdateAvailable)
                {
                    _mainViewModel.LatestUpdateInfo = updateInfo;
                    LatestVersion = updateInfo.LatestVersion;
                    _downloadUrl = updateInfo.DownloadUrl;
                    UpdateState = UpdateStatus.UpdateAvailable;
                    await _mainViewModel.PromptUpdateDialogAsync(updateInfo);
                }
                else
                {
                    UpdateState = UpdateStatus.UpToDate;
                    _mainViewModel.ShowNotification("You are using the latest version.", NotificationType.Success);
                    await Task.Delay(3000);
                    if (UpdateState == UpdateStatus.UpToDate)
                    {
                        UpdateState = UpdateStatus.Idle;
                    }
                }
            }
            catch (Exception ex)
            {
                UpdateState = UpdateStatus.Failed;
                _mainViewModel.ShowNotification($"Update check failed: {ex.Message}", NotificationType.Error);
            }
        }

        private async Task DownloadAndInstallUpdateAsync()
        {
            if (string.IsNullOrEmpty(_downloadUrl) || UpdateState == UpdateStatus.Downloading) return;

            if (!_downloadUrl.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            {
                 try { System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = _downloadUrl, UseShellExecute = true }); } catch { }
                 UpdateState = UpdateStatus.Idle;
                 return;
            }

            UpdateState = UpdateStatus.Downloading;
            DownloadProgress = 0;

            try
            {
                var tempPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "Yomic_Update.exe");
                
                if (System.IO.File.Exists(tempPath))
                {
                    try { System.IO.File.Delete(tempPath); } catch { }
                }
                
                using (var client = new System.Net.Http.HttpClient())
                {
                    using (var response = await client.GetAsync(_downloadUrl, System.Net.Http.HttpCompletionOption.ResponseHeadersRead))
                    {
                        response.EnsureSuccessStatusCode();
                        var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                        var canValidProgress = totalBytes != -1L;

                        using (var contentStream = await response.Content.ReadAsStreamAsync())
                        {
                            using (var fileStream = new System.IO.FileStream(tempPath, System.IO.FileMode.Create, System.IO.FileAccess.Write, System.IO.FileShare.None, 8192, true))
                            {
                                var totalRead = 0L;
                                var buffer = new byte[8192];
                                var isMoreToRead = true;

                                do
                                {
                                    var read = await contentStream.ReadAsync(buffer, 0, buffer.Length);
                                    if (read == 0)
                                    {
                                        isMoreToRead = false;
                                    }
                                    else
                                    {
                                        await fileStream.WriteAsync(buffer, 0, read);
                                        totalRead += read;
                                        if (canValidProgress)
                                        {
                                            DownloadProgress = (double)totalRead / totalBytes * 100;
                                        }
                                    }
                                }
                                while (isMoreToRead);
                            }
                        }
                    }
                }

                UpdateState = UpdateStatus.Installing;
                await Task.Delay(1000);

                var startInfo = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = tempPath,
                    UseShellExecute = true,
                    Arguments = "/SILENT /SUPPRESSMSGBOXES /NORESTART"
                };

                var process = System.Diagnostics.Process.Start(startInfo);
                
                if (process != null)
                {
                    if (Avalonia.Application.Current?.ApplicationLifetime is Avalonia.Controls.ApplicationLifetimes.IClassicDesktopStyleApplicationLifetime desktop)
                    {
                        desktop.Shutdown();
                    }
                }
                else
                {
                     UpdateState = UpdateStatus.Failed;
                     _mainViewModel.ShowNotification("Installation failed to start.", NotificationType.Error);
                }
            }
            catch (Exception ex)
            {
                UpdateState = UpdateStatus.Failed;
                _mainViewModel.ShowNotification($"Download failed: {ex.Message}", NotificationType.Error);
                try 
                { 
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = _downloadUrl, UseShellExecute = true }); 
                } catch { }
            }
        }

        private void VisitWebsite()
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "https://yomic.vercel.app/",
                    UseShellExecute = true
                };
                System.Diagnostics.Process.Start(psi);
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open website: {ex.Message}");
            }
        }

        private void OpenTrakteer()
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://trakteer.id/ArisaAkiyama", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open Trakteer: {ex.Message}");
            }
        }

        private void OpenTwitter()
        {
            try
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://x.com/ArisaAkiyama", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open Twitter: {ex.Message}");
            }
        }

        private void OpenGitHub()
        {
            try
            {
                 System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://github.com/ArisaAkiyama", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open GitHub: {ex.Message}");
            }
        }

        private void OpenFacebook()
        {
            try
            {
                 System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://web.facebook.com/febianrizaarzewiniga", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open Facebook: {ex.Message}");
            }
        }

        private void OpenInstagram()
        {
            try
            {
                 System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://www.instagram.com/febianriza.a/", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open Instagram: {ex.Message}");
            }
        }

        private void OpenTikTok()
        {
            try
            {
                 System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo { FileName = "https://www.tiktok.com/@arisaakiyama", UseShellExecute = true });
            }
            catch (Exception ex)
            {
                 _mainViewModel.ShowNotification($"Could not open TikTok: {ex.Message}");
            }
        }

        public void RevertLanguageSelection()
        {
            string reverted = _settingsService.AppLanguage == "id" ? "en" : "id";
            _settingsService.AppLanguage = reverted;
            _settingsService.Save();
            AppLanguageIndex = reverted == "id" ? 1 : 0;
        }

        public SettingsViewModel(MainWindowViewModel mainViewModel, Core.Services.LibraryService libraryService, Core.Services.SettingsService settingsService, Core.Services.SourceManager sourceManager, Core.Services.NetworkService networkService)
        {
            _mainViewModel = mainViewModel;
            _libraryService = libraryService;
            _settingsService = settingsService;
            _sourceManager = sourceManager;
            _networkService = networkService;
            _updateService = new Core.Services.UpdateService();
            _backupService = new Core.Services.BackupService();
            
            // Load settings
            _isDarkMode = _settingsService.IsDarkMode;
            _isOfflineMode = _settingsService.IsOfflineMode;
            _appLanguageIndex = _settingsService.AppLanguage == "id" ? 1 : 0;
            _secureScreen = _settingsService.SecureScreen;
            _updateOnStart = _settingsService.UpdateOnStart;
            _useSmartUpdate = _settingsService.UseSmartUpdate;
            _autoUpdateIntervalIndex = _settingsService.AutoUpdateIntervalHours switch
            {
                6 => 1,
                12 => 2,
                24 => 3,
                _ => 0
            };
            _checkAppUpdateOnStart = _settingsService.CheckAppUpdateOnStart;
            _showNsfwSources = _settingsService.ShowNsfwSources;
            _dnsOverHttpsProvider = _settingsService.DnsOverHttpsProvider;
            _preloadNextChapter = _settingsService.PreloadNextChapter;
            _readerPerformanceMode = _settingsService.ReaderPerformanceMode;
            _maxCacheSizeIndex = _settingsService.MaxCacheSizeMb switch
            {
                250 => 1,
                500 => 2,
                1000 => 3,
                2000 => 4,
                _ => 0
            };
            
            ClearAllDataCommand = ReactiveCommand.Create(() => RequestClearDataDialog?.Invoke());
            ClearReadHistoryCommand = ReactiveCommand.Create(() => RequestClearHistoryDialog?.Invoke());
            ClearCacheCookiesCommand = ReactiveCommand.CreateFromTask(ClearCacheCookiesAsync);
            CheckForUpdatesCommand = ReactiveCommand.Create(CheckForUpdates);
            BackupDataCommand = ReactiveCommand.Create(RequestBackup);
            RestoreDataCommand = ReactiveCommand.Create(RequestRestore);
            VisitWebsiteCommand = ReactiveCommand.Create(VisitWebsite);
            OpenTrakteerCommand = ReactiveCommand.Create(OpenTrakteer);
            OpenTwitterCommand = ReactiveCommand.Create(OpenTwitter);
            OpenGitHubCommand = ReactiveCommand.Create(OpenGitHub);
            OpenFacebookCommand = ReactiveCommand.Create(OpenFacebook);
            OpenInstagramCommand = ReactiveCommand.Create(OpenInstagram);
            OpenTikTokCommand = ReactiveCommand.Create(OpenTikTok);
            SyncLibraryCommand = ReactiveCommand.CreateFromTask(SyncLibraryAsync);
            RefreshLibraryCoversCommand = ReactiveCommand.CreateFromTask(RefreshLibraryCoversAsync);
            OptimizeDatabaseCommand = ReactiveCommand.CreateFromTask(OptimizeDatabaseAsync);
            ExportLogsCommand = ReactiveCommand.CreateFromTask(ExportLogsAsync);

            // Load DB stats on init
            System.Threading.Tasks.Task.Run(LoadDbStatsAsync);

            // Load shared startup update info if available
            if (_mainViewModel.LatestUpdateInfo != null && _mainViewModel.LatestUpdateInfo.IsUpdateAvailable)
            {
                _latestVersion = _mainViewModel.LatestUpdateInfo.LatestVersion;
                _downloadUrl = _mainViewModel.LatestUpdateInfo.DownloadUrl;
                _updateState = UpdateStatus.UpdateAvailable;
            }
            
            this.WhenAnyValue(x => x.IsDarkMode)
                .Subscribe(async x => { 
                    IsThemeChanging = true;
                    _settingsService.IsDarkMode = x; 
                    _settingsService.Save(); 
                    if (Application.Current != null)
                    {
                        if (_mainViewModel.RequestThemeChange != null)
                        {
                            _mainViewModel.RequestThemeChange.Invoke(x);
                        }
                        else
                        {
                            Application.Current.RequestedThemeVariant = x ? Avalonia.Styling.ThemeVariant.Dark : Avalonia.Styling.ThemeVariant.Light;
                        }
                    }
                    await Task.Delay(550);
                    IsThemeChanging = false;
                });
            this.WhenAnyValue(x => x.IsOfflineMode)
                .Skip(1)
                .Subscribe(x => { 
                    _settingsService.IsOfflineMode = x; 
                    _settingsService.Save();
                    
                    if (x) _mainViewModel.ShowNotification("Offline Mode Enabled", NotificationType.Error);
                    else _mainViewModel.ShowNotification("Offline Mode Disabled", NotificationType.Success);
                });
            this.WhenAnyValue(x => x.AppLanguageIndex)
                .Skip(1)
                .Subscribe(x => {
                    string lang = x == 1 ? "id" : "en";
                    if (_settingsService.AppLanguage != lang)
                    {
                        _settingsService.AppLanguage = lang;
                        _settingsService.Save();
                        RequestLanguageRestartConfirmation?.Invoke(lang);
                    }
                });
            this.WhenAnyValue(x => x.CheckAppUpdateOnStart)
                .Subscribe(x => { _settingsService.CheckAppUpdateOnStart = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.ShowNsfwSources)
                .Subscribe(x => { _settingsService.ShowNsfwSources = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.DnsOverHttpsProvider)
                .Subscribe(x => { _settingsService.DnsOverHttpsProvider = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.SecureScreen)
                .Subscribe(x => { _settingsService.SecureScreen = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.UpdateOnStart)
                .Subscribe(x => { _settingsService.UpdateOnStart = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.UseSmartUpdate)
                .Subscribe(x => { _settingsService.UseSmartUpdate = x; _settingsService.Save(); });
                
            this.WhenAnyValue(x => x.AutoUpdateIntervalIndex)
                .Subscribe(index => 
                {
                    int hours = index switch
                    {
                        1 => 6,
                        2 => 12,
                        3 => 24,
                        _ => 0
                    };
                    _settingsService.AutoUpdateIntervalHours = hours;
                    _settingsService.Save();
                    Core.Services.AutoUpdateTaskService.RegisterOrUpdateTask(hours);
                });
            this.WhenAnyValue(x => x.PreloadNextChapter)
                .Subscribe(x => { _settingsService.PreloadNextChapter = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.AutoDownloadNextChapter)
                .Subscribe(x => { _settingsService.AutoDownloadNextChapter = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.ReaderPerformanceMode)
                .Subscribe(x => { _settingsService.ReaderPerformanceMode = x; _settingsService.Save(); });
            this.WhenAnyValue(x => x.MaxCacheSizeIndex)
                .Subscribe(x => {
                    int mbValue = x switch
                    {
                        1 => 250,
                        2 => 500,
                        3 => 1000,
                        4 => 2000,
                        _ => 0
                    };
                    _settingsService.MaxCacheSizeMb = mbValue;
                    _settingsService.Save();
                    System.Threading.Tasks.Task.Run(() => CleanupReaderCache(mbValue));
                });
            
            RefreshLastBackupInfo();
        }

        // ─── Advanced: DB Stats ───────────────────────────────────────────────────

        private string _dbStatsManga = "–";
        public string DbStatsManga
        {
            get => _dbStatsManga;
            set => this.RaiseAndSetIfChanged(ref _dbStatsManga, value);
        }

        private string _dbStatsChapters = "–";
        public string DbStatsChapters
        {
            get => _dbStatsChapters;
            set => this.RaiseAndSetIfChanged(ref _dbStatsChapters, value);
        }

        private string _dbStatsHistory = "–";
        public string DbStatsHistory
        {
            get => _dbStatsHistory;
            set => this.RaiseAndSetIfChanged(ref _dbStatsHistory, value);
        }

        private string _dbStatsSize = "–";
        public string DbStatsSize
        {
            get => _dbStatsSize;
            set => this.RaiseAndSetIfChanged(ref _dbStatsSize, value);
        }

        private bool _isOptimizingDb;
        public bool IsOptimizingDb
        {
            get => _isOptimizingDb;
            set => this.RaiseAndSetIfChanged(ref _isOptimizingDb, value);
        }

        private async Task LoadDbStatsAsync()
        {
            try
            {
                using var context = new Core.Data.MangaDbContext();
                var mangaCount = await context.Mangas
                    .Where(m => m.Favorite)
                    .CountAsync();
                var chapCount   = await context.Chapters.CountAsync();
                var histCount   = await context.History.CountAsync();

                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var dbPath  = System.IO.Path.Combine(appData, "Yomic", "manga.db");
                var dbSize  = System.IO.File.Exists(dbPath)
                    ? ExtensionsViewModel.FormatBytes(new System.IO.FileInfo(dbPath).Length)
                    : "N/A";

                DbStatsManga    = mangaCount.ToString("N0");
                DbStatsChapters = chapCount.ToString("N0");
                DbStatsHistory  = histCount.ToString("N0");
                DbStatsSize     = dbSize;
            }
            catch (Exception ex)
            {
                Core.Services.LogService.Error("SettingsViewModel", "LoadDbStats failed", ex);
            }
        }

        private async Task OptimizeDatabaseAsync()
        {
            if (IsOptimizingDb) return;
            IsOptimizingDb = true;
            _mainViewModel.ShowNotification("Optimizing database…", NotificationType.Info);
            try
            {
                await Task.Run(async () =>
                {
                    var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    var dbPath  = System.IO.Path.Combine(appData, "Yomic", "manga.db");
                    using var conn = new Microsoft.Data.Sqlite.SqliteConnection($"Data Source={dbPath}");
                    await conn.OpenAsync();
                    foreach (var sql in new[]
                    {
                        "PRAGMA wal_checkpoint(TRUNCATE);",
                        "VACUUM;",
                        "REINDEX;",
                        "ANALYZE;"
                    })
                    {
                        using var cmd = conn.CreateCommand();
                        cmd.CommandText = sql;
                        await cmd.ExecuteNonQueryAsync();
                    }
                });
                _mainViewModel.ShowNotification("Database optimized!", NotificationType.Success);
                await LoadDbStatsAsync();
            }
            catch (Exception ex)
            {
                Core.Services.LogService.Error("SettingsViewModel", "OptimizeDatabase failed", ex);
                _mainViewModel.ShowNotification("Failed to optimize database.", NotificationType.Error);
            }
            finally
            {
                IsOptimizingDb = false;
            }
        }

        // ─── Advanced: Export Logs ────────────────────────────────────────────────

        public event Action? RequestExportLogsDialog;

        private Task ExportLogsAsync()
        {
            RequestExportLogsDialog?.Invoke();
            return Task.CompletedTask;
        }

        public async Task ProcessExportLogsAsync(string destinationPath)
        {
            try
            {
                var logPath = Core.Services.LogService.LogFilePath;
                if (!System.IO.File.Exists(logPath))
                {
                    _mainViewModel.ShowNotification("No log file found to export.", NotificationType.Error);
                    return;
                }
                await Task.Run(() => System.IO.File.Copy(logPath, destinationPath, overwrite: true));
                _mainViewModel.ShowNotification("Log exported successfully!", NotificationType.Success);
            }
            catch (Exception ex)
            {
                Core.Services.LogService.Error("SettingsViewModel", "ExportLogs failed", ex);
                _mainViewModel.ShowNotification("Failed to export log.", NotificationType.Error);
            }
        }


        private void RequestBackup()
        {
            RequestBackupDialog?.Invoke();
        }

        private void RequestRestore()
        {
            RequestRestoreDialog?.Invoke();
        }

        private void RefreshLastBackupInfo()
        {
            if (string.IsNullOrEmpty(_settingsService.LastBackupTime))
            {
                LastBackupInfo = GetResourceString("String.NeverBackedUp", "Never backed up");
            }
            else
            {
                LastBackupInfo = $"{GetResourceString("String.LastBackup", "Last backup")}: {_settingsService.LastBackupTime} ({_settingsService.LastBackupSize})";
            }
        }

        private async Task ClearCacheCookiesAsync()
        {
            _mainViewModel.ShowNotification("Clearing cache and connections...", NotificationType.Info);
            
            // Clear image cache, cover disk cache, source feed cache, and reader page cache.
            _mainViewModel.ImageCacheService.Clear();
            _mainViewModel.SecureImageService.ClearDiskCache();
            _sourceManager.ClearAllCache();
            ClearReaderCache();
            
            // Reset network connections and DNS cache
            await _networkService.ResetConnectionsAsync();
            
            // Call GC to aggressively free memory held by bitmaps
            GC.Collect();
            
            _mainViewModel.ShowNotification("Cache & Cookies cleared successfully!", NotificationType.Success);
        }

        private static void ClearReaderCache()
        {
            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var cacheDir = Path.Combine(appData, "Yomic", "Cache", "Reader");
                if (!Directory.Exists(cacheDir)) return;

                Directory.Delete(cacheDir, recursive: true);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[CacheCleanup] Error clearing reader cache: {ex.Message}");
            }
        }

        private bool _isBackingUp;
        public bool IsBackingUp
        {
            get => _isBackingUp;
            set => this.RaiseAndSetIfChanged(ref _isBackingUp, value);
        }

        private bool _isRestoring;
        public bool IsRestoring
        {
            get => _isRestoring;
            set => this.RaiseAndSetIfChanged(ref _isRestoring, value);
        }

        private bool _isRefreshingCovers;
        public bool IsRefreshingCovers
        {
            get => _isRefreshingCovers;
            set => this.RaiseAndSetIfChanged(ref _isRefreshingCovers, value);
        }

        public async System.Threading.Tasks.Task ProcessBackupAsync(string path)
        {
            if (IsBackingUp) return;
            IsBackingUp = true;
            try
            {
                _mainViewModel.ShowNotification("Creating backup...", NotificationType.Info);
                bool success = await _backupService.CreateBackupAsync(path);
                if (success)
                {
                    _mainViewModel.ShowNotification("Backup created successfully!", NotificationType.Success);
                    try
                    {
                        var fileInfo = new System.IO.FileInfo(path);
                        _settingsService.LastBackupTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
                        _settingsService.LastBackupSize = ExtensionsViewModel.FormatBytes(fileInfo.Length);
                        _settingsService.Save();
                        RefreshLastBackupInfo();
                    }
                    catch (Exception ex)
                    {
                        Core.Services.LogService.Error("SettingsViewModel", "Error updating last backup metadata", ex);
                    }
                }
                else
                {
                    _mainViewModel.ShowNotification("Failed to create backup.", NotificationType.Error);
                }
            }
            finally
            {
                IsBackingUp = false;
            }
        }

        public async System.Threading.Tasks.Task ProcessRestoreAsync(string path)
        {
            if (IsRestoring) return;
            IsRestoring = true;
            try
            {
                _mainViewModel.ShowNotification("Restoring backup...", NotificationType.Info);
                bool success = await _backupService.RestoreBackupAsync(path);
                if (success)
                {
                    _mainViewModel.ShowNotification("Restore completed! Please restart the app manually.", NotificationType.Success);
                }
                else
                {
                    _mainViewModel.ShowNotification("Failed to restore backup.", NotificationType.Error);
                }
            }
            finally
            {
                IsRestoring = false;
            }
        }

        public async System.Threading.Tasks.Task ProcessClearDataAsync()
        {
            try
            {
                // 1. Clear Library (DB + Downloads + Covers)
                await _libraryService.ClearDatabaseAsync();
                
                // 2. Clear Extensions (Plugins + JSON + Cache)
                _sourceManager.ClearAllCache();
                _sourceManager.DeleteAllUserPlugins();

                // 3. Clear Settings
                _settingsService.Reset();

                // Show notification via MainViewModel
                _mainViewModel.ShowNotification("All data cleared successfully. Application will close in 3 seconds.");
                
                // Wait and Exit
                await System.Threading.Tasks.Task.Delay(3000);
                System.Environment.Exit(0);
            }
            catch (System.Exception ex)
            {
                 _mainViewModel.ShowNotification($"Error clearing data: {ex.Message}");
            }
        }

        public async System.Threading.Tasks.Task ProcessClearHistoryAsync()
        {
            try
            {
                // Clear all chapter read status from database
                await _libraryService.ClearAllReadHistoryAsync();
                
                // Clear cache and cookies
                await ClearCacheCookiesAsync();
                
                _mainViewModel.ShowNotification("Read history & cache cleared successfully!", NotificationType.Success);
            }
            catch (System.Exception ex)
            {
                _mainViewModel.ShowNotification($"Error clearing read history & cache: {ex.Message}");
            }
        }
        private bool _isSyncingLibrary;
        public bool IsSyncingLibrary
        {
            get => _isSyncingLibrary;
            set => this.RaiseAndSetIfChanged(ref _isSyncingLibrary, value);
        }

        private async System.Threading.Tasks.Task SyncLibraryAsync()
        {
            if (IsSyncingLibrary) return;
            IsSyncingLibrary = true;
            _mainViewModel.ShowNotification("Syncing library chapters...", NotificationType.Info);

            try
            {
                int newCount = await _libraryService.UpdateAllLibraryMangaAsync(_sourceManager);
                if (newCount > 0)
                    _mainViewModel.ShowNotification($"Library Sync Complete: Found {newCount} new chapters!", NotificationType.Success);
                else
                    _mainViewModel.ShowNotification("Library Sync Complete: No new chapters found.", NotificationType.Info);
            }
            catch (Exception ex)
            {
                _mainViewModel.ShowNotification($"Sync failed: {ex.Message}", NotificationType.Error);
            }
            finally
            {
                 IsSyncingLibrary = false;
            }
        }

        public static void CleanupReaderCache(int maxCacheSizeMb)
        {
            if (maxCacheSizeMb <= 0) return; // Disabled

            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var cacheDir = Path.Combine(appData, "Yomic", "Cache", "Reader");
                if (!Directory.Exists(cacheDir)) return;

                var di = new DirectoryInfo(cacheDir);
                var files = di.GetFiles("*.cache");
                if (files.Length == 0) return;

                // Sort by last write time ascending (oldest first)
                var sortedFiles = files.OrderBy(f => f.LastWriteTime).ToList();

                long currentSize = sortedFiles.Sum(f => f.Length);
                long maxSize = (long)maxCacheSizeMb * 1024 * 1024;

                if (currentSize > maxSize)
                {
                    long deletedSize = 0;
                    int deletedCount = 0;
                    foreach (var file in sortedFiles)
                    {
                        if (currentSize - deletedSize <= maxSize)
                            break;

                        try
                        {
                            long len = file.Length;
                            file.Delete();
                            deletedSize += len;
                            deletedCount++;
                        }
                        catch
                        {
                            // File might be locked/in use, skip it
                        }
                    }
                    System.Diagnostics.Debug.WriteLine($"[CacheCleanup] Removed {deletedCount} files ({(deletedSize / (1024.0 * 1024.0)):F2} MB). Current size: {((currentSize - deletedSize) / (1024.0 * 1024.0)):F2} MB.");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[CacheCleanup] Error cleaning cache: {ex.Message}");
            }
        }

        private async Task RefreshLibraryCoversAsync()
        {
            if (IsRefreshingCovers) return;
            IsRefreshingCovers = true;
            try
            {
                _mainViewModel.ShowNotification("Refreshing library covers...", NotificationType.Info);
                
                // 1. Clear cover cache in memory and on disk
                _mainViewModel.ImageCacheService.Clear();
                _mainViewModel.SecureImageService.ClearDiskCache();
                
                // 2. Force reload covers on Library UI
                await _mainViewModel.LibraryVM.RefreshLibraryCoversForceAsync();
                
                // 3. Collect garbage
                GC.Collect();
                
                _mainViewModel.ShowNotification("Library covers refreshed successfully!", NotificationType.Success);
            }
            finally
            {
                IsRefreshingCovers = false;
            }
        }
    }
}
