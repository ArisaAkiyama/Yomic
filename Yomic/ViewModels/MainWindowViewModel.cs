using ReactiveUI;
using System;
using System.Reactive;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using Avalonia.Controls;

namespace Yomic.ViewModels
{
    // Model sederhana untuk satu komik
    public class MangaItem : ViewModelBase
    {
        public string Title { get; set; } = string.Empty;
        public string? CoverUrl { get; set; } 
        public long LastViewed { get; set; } // For "Last Read" sorting 

        private string? _unreadCount;
        public string? UnreadCount 
        {
            get => _unreadCount;
            set 
            {
                this.RaiseAndSetIfChanged(ref _unreadCount, value);
                this.RaisePropertyChanged(nameof(HasUnreadContent));
            }
        }

        public string? LastReadTime { get; set; }
        private int _status;
        public int Status
        {
            get => _status;
            set
            {
                this.RaiseAndSetIfChanged(ref _status, value);
                this.RaisePropertyChanged(nameof(StatusString));
            }
        } // 1=Ongoing, 2=Completed, 5=Hiatus, 6=Cancelled
        public int ChapterCount { get; set; } // Total chapters count
        public System.Collections.Generic.List<string> Genres { get; set; } = new();
        public System.Collections.Generic.List<long> CategoryIds { get; set; } = new();

        private bool _hasDownloadedChapters;
        public bool HasDownloadedChapters
        {
            get => _hasDownloadedChapters;
            set => this.RaiseAndSetIfChanged(ref _hasDownloadedChapters, value);
        }

        private int _downloadedCount;
        public int DownloadedCount
        {
            get => _downloadedCount;
            set
            {
                this.RaiseAndSetIfChanged(ref _downloadedCount, value);
                this.RaisePropertyChanged(nameof(IsDownloadedBadgeVisible));
            }
        }

        public bool IsDownloadedBadgeVisible => DownloadedCount > 0;

        public bool HasUnreadContent => !string.IsNullOrEmpty(UnreadCount) && UnreadCount != "0";

        private bool _isNewBadgeVisible;
        public bool IsNewBadgeVisible
        {
            get => _isNewBadgeVisible;
            set
            {
                this.RaiseAndSetIfChanged(ref _isNewBadgeVisible, value);
                this.RaisePropertyChanged(nameof(HasNewChapters));
            }
        }
        
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

        public string StatusString 
        {
            get
            {
                return Status switch
                {
                    1 => GetResourceString("String.Status.Ongoing", "Ongoing"),
                    2 => GetResourceString("String.Status.Completed", "Completed"),
                    3 => GetResourceString("String.Status.Licensed", "Licensed"),
                    4 => GetResourceString("String.Status.PublishingFinished", "Publishing Finished"),
                    5 => GetResourceString("String.Status.Cancelled", "Cancelled"),
                    6 => GetResourceString("String.Status.Hiatus", "Hiatus"),
                    _ => GetResourceString("String.Status.Unknown", "Unknown")
                };
            }
        }
        
        // Context for Fetching Details
        public long SourceId { get; set; }
        public string? SourceName { get; set; }
        public string MangaUrl { get; set; } = string.Empty; // This corresponds to Manga.Url (ID)
        
        private bool _isTracked;
        public bool IsTracked
        {
            get => _isTracked;
            set => this.RaiseAndSetIfChanged(ref _isTracked, value);
        }

        private Avalonia.Media.Imaging.Bitmap? _sourceIcon;
        [System.Text.Json.Serialization.JsonIgnore]
        public Avalonia.Media.Imaging.Bitmap? SourceIcon
        {
            get
            {
                if (_sourceIcon == null && SourceId != 0)
                {
                    try
                    {
                        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                        var iconFile = System.IO.Path.Combine(appData, "Yomic", "Icons", $"{SourceId}.png");
                        if (System.IO.File.Exists(iconFile))
                        {
                            var bytes = System.IO.File.ReadAllBytes(iconFile);
                            using var ms = new System.IO.MemoryStream(bytes);
                            _sourceIcon = new Avalonia.Media.Imaging.Bitmap(ms);
                        }
                    }
                    catch
                    {
                        // Fallback
                    }
                }
                return _sourceIcon;
            }
        }
        
        // Formatted Last Update String
        public long LastUpdate { get; set; }
        
        public string LastUpdateString 
        { 
            get 
            {
                if (LastUpdate == 0) return "";
                var time = DateTimeOffset.FromUnixTimeMilliseconds(LastUpdate);
                var diff = DateTimeOffset.Now - time;
                
                if (diff.TotalMinutes < 1) return GetResourceString("String.TimeAgo.JustNow", "Just now");
                if (diff.TotalMinutes < 60)
                {
                    var val = (int)Math.Max(1, diff.TotalMinutes);
                    return string.Format(GetResourceString("String.TimeAgo.Minutes", "{0}m ago"), val);
                }
                if (diff.TotalHours < 24)
                {
                    var val = (int)diff.TotalHours;
                    return string.Format(GetResourceString("String.TimeAgo.Hours", "{0}h ago"), val);
                }
                if (diff.TotalDays < 7)
                {
                    var val = (int)diff.TotalDays;
                    return string.Format(GetResourceString("String.TimeAgo.Days", "{0}d ago"), val);
                }
                return time.ToString("dd MMM yyyy");
            }
        }

        public bool HasNewChapters 
        {
            get => _isNewBadgeVisible;
            set
            {
                this.RaiseAndSetIfChanged(ref _isNewBadgeVisible, value);
                this.RaisePropertyChanged(nameof(IsNewBadgeVisible));
            }
        }

        public string Description { get; set; } = string.Empty;

        // Helper to Create from Core Model safely
        public static MangaItem FromCoreManga(Core.Models.Manga m)
        {
            return new MangaItem
            {
                Title = m.Title,
                CoverUrl = m.ThumbnailUrl,
                SourceId = m.Source,
                MangaUrl = m.Url,

                Status = m.Status,
                ChapterCount = m.Chapters?.Count ?? 0,
                Genres = m.Genre ?? new(),
                LastUpdate = m.LastUpdate,
                LastViewed = m.LastViewed, // Map from Core
                HasNewChapters = m.HasNewChapters, // Map from Core
                IsTracked = m.Tracks?.Count > 0 // Map from Core
            };
        }
    }

    public class MainWindowViewModel : ViewModelBase
    {
        public NotificationViewModel NotificationVM { get; } = new NotificationViewModel();
        private Core.Services.UpdateService.UpdateInfo? _latestUpdateInfo;
        public Core.Services.UpdateService.UpdateInfo? LatestUpdateInfo
        {
            get => _latestUpdateInfo;
            set => this.RaiseAndSetIfChanged(ref _latestUpdateInfo, value);
        }

        public Action? RequestFeedbackDialog;
        public Action<bool>? RequestThemeChange;

        private readonly Core.Services.UpdateService _updateService = new Core.Services.UpdateService();
        private bool _isUpdateDialogOpen;
        public Func<Core.Services.UpdateService.UpdateInfo, Task<bool>>? ShowUpdateDialogAsync { get; set; }
        public Core.Services.UpdateService UpdateService => _updateService;

        private readonly Core.Services.AnnouncementService _announcementService;
        public Core.Services.AnnouncementService AnnouncementService => _announcementService;

        private bool _hasNewAnnouncement;
        public bool HasNewAnnouncement
        {
            get => _hasNewAnnouncement;
            set => this.RaiseAndSetIfChanged(ref _hasNewAnnouncement, value);
        }

        public Func<Task>? ShowAnnouncementDialogAsync { get; set; }
        private bool _isAnnouncementDialogOpen;

        public async Task PromptAnnouncementDialogAsync()
        {
            if (_isAnnouncementDialogOpen) return;
            _isAnnouncementDialogOpen = true;
            try
            {
                if (ShowAnnouncementDialogAsync != null)
                {
                    await ShowAnnouncementDialogAsync.Invoke();
                }
            }
            finally
            {
                _isAnnouncementDialogOpen = false;
            }
        }

        private void SetupAnnouncementService()
        {
            _announcementService.NewAnnouncementDetected += (s, announcements) =>
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(async () =>
                {
                    HasNewAnnouncement = true;
                    await PromptAnnouncementDialogAsync();
                });
            };

            _announcementService.AnnouncementsUpdated += (s, announcements) =>
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    HasNewAnnouncement = _announcementService.HasUnreadAnnouncements();
                });
            };

            _announcementService.StartRealtimeMonitoring(3);
        }

        public void MarkAnnouncementsAsRead(string latestId)
        {
            _announcementService.MarkAsRead(latestId);
            HasNewAnnouncement = false;
        }

        private void SetupUpdateService()
        {
            _updateService.UpdateAvailableDetected += (s, info) =>
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(async () =>
                {
                    await PromptUpdateDialogAsync(info);
                });
            };

            if (_settingsService.CheckAppUpdateOnStart)
            {
                _updateService.StartRealtimeMonitoring(3);
            }
        }

        public async Task PromptUpdateDialogAsync(Core.Services.UpdateService.UpdateInfo updateInfo)
        {
            if (_isUpdateDialogOpen || updateInfo == null || !updateInfo.IsUpdateAvailable) return;
            _isUpdateDialogOpen = true;
            try
            {
                LatestUpdateInfo = updateInfo;
                if (ShowUpdateDialogAsync != null)
                {
                    await ShowUpdateDialogAsync.Invoke(updateInfo);
                }
            }
            finally
            {
                _isUpdateDialogOpen = false;
            }
        }

        private ViewModelBase? _currentPage;
        public ViewModelBase? CurrentPage
        {
            get => _currentPage;
            set 
            {
                this.RaiseAndSetIfChanged(ref _currentPage, value);
                this.RaisePropertyChanged(nameof(IsReaderMode));
                this.RaisePropertyChanged(nameof(IsLibraryActive));
                this.RaisePropertyChanged(nameof(IsUpdatesActive));
                this.RaisePropertyChanged(nameof(IsUpcomingActive));
                this.RaisePropertyChanged(nameof(IsHistoryActive));
                this.RaisePropertyChanged(nameof(IsDownloadsActive));
                this.RaisePropertyChanged(nameof(IsBrowseActive));
                this.RaisePropertyChanged(nameof(IsExtensionsActive));
                this.RaisePropertyChanged(nameof(IsSettingsActive));
            }
        }

        // True when CurrentPage is ReaderViewModel (used to hide sidebar)
        public bool IsReaderMode => _currentPage is ReaderViewModel;

        public bool IsLibraryActive => _currentPage == _libraryVM && _libraryVM != null;
        public bool IsUpdatesActive => _currentPage == _updatesVM && _updatesVM != null;
        public bool IsUpcomingActive => _currentPage == _upcomingVM && _upcomingVM != null;
        public bool IsHistoryActive => _currentPage == _historyVM && _historyVM != null;
        public bool IsDownloadsActive => _currentPage == _downloadsVM && _downloadsVM != null;
        public bool IsBrowseActive => _currentPage == _browseVM && _browseVM != null;
        public bool IsExtensionsActive => _currentPage == _extensionsVM && _extensionsVM != null;
        public bool IsSettingsActive => _currentPage == _settingsVM && _settingsVM != null;

        private LibraryViewModel? _libraryVM;
        public LibraryViewModel LibraryVM 
        { 
            get => _libraryVM ??= new LibraryViewModel(this, _libraryService, _networkService, _imageCacheService, _settingsService);
        }

        private readonly Core.Services.SourceManager _sourceManager;
        public Core.Services.SourceManager SourceManager => _sourceManager;
        
        private readonly Core.Services.LibraryService _libraryService;
        private readonly Core.Services.NetworkService _networkService;
        private readonly Core.Services.DownloadService _downloadService;
        private System.Threading.CancellationTokenSource? _cleanupCts;

        public Core.Services.NetworkService NetworkService => _networkService;

        public Core.Services.DownloadService DownloadService => _downloadService;
        
        private readonly Core.Services.SettingsService _settingsService;
        public Core.Services.SettingsService SettingsService => _settingsService;
        
        public Core.Services.LibraryService LibraryService => _libraryService;
        
        private readonly Core.Services.ImageCacheService _imageCacheService;
        public Core.Services.ImageCacheService ImageCacheService => _imageCacheService;

        private readonly Core.Services.SecureImageService _secureImageService;
        public Core.Services.SecureImageService SecureImageService => _secureImageService;

        private readonly Core.Services.SourceStatusService _sourceStatusService;
        public Core.Services.SourceStatusService SourceStatusService => _sourceStatusService;

        private Core.Services.MyAnimeListService? _myAnimeListService;
        public Core.Services.MyAnimeListService MyAnimeListService => _myAnimeListService ??= new Core.Services.MyAnimeListService(_settingsService);

        private bool _isPaneOpen = false;
        public bool IsPaneOpen
        {
            get => _isPaneOpen;
            set => this.RaiseAndSetIfChanged(ref _isPaneOpen, value);
        }
        
        private bool _isFullscreen = false;
        public bool IsFullscreen
        {
            get => _isFullscreen;
            set => this.RaiseAndSetIfChanged(ref _isFullscreen, value);
        }

        private bool _isDialogOverlayVisible;
        public bool IsDialogOverlayVisible
        {
            get => _isDialogOverlayVisible;
            set => this.RaiseAndSetIfChanged(ref _isDialogOverlayVisible, value);
        }

        public ReactiveCommand<System.Reactive.Unit, System.Reactive.Unit> TogglePaneCommand { get; }

        public MainWindowViewModel(Core.Services.SourceManager sourceManager, 
                                   Core.Services.LibraryService libraryService, 
                                   Core.Services.NetworkService networkService,
                                   Core.Services.DownloadService downloadService,
                                   Core.Services.SettingsService settingsService,
                                   Core.Services.ImageCacheService imageCacheService,
                                   Core.Services.SecureImageService secureImageService,
                                   Core.Services.SourceStatusService sourceStatusService)
        {
            _sourceManager = sourceManager;
            _libraryService = libraryService;
            _networkService = networkService;
            _downloadService = downloadService;
            _settingsService = settingsService;
            _imageCacheService = imageCacheService;
            _secureImageService = secureImageService;
            _sourceStatusService = sourceStatusService;
            _announcementService = new Core.Services.AnnouncementService(_settingsService);
            
            // Subscribe to Network Status
            _networkService.StatusChanged += (s, isOnline) =>
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    if (isOnline)
                         NotificationVM.Show("You are back online.", NotificationType.Success);
                    else
                         NotificationVM.Show("You are offline. Check your connection.", NotificationType.Error);
                });
            };

            TogglePaneCommand = ReactiveCommand.Create(() => { IsPaneOpen = !IsPaneOpen; });
            CheckFirstRun();
            SetupUpdateService();
            SetupAnnouncementService();
        }

        // Default constructor for Designer Preview (Optional, but good practice)
        public MainWindowViewModel() 
        {
            _sourceManager = new Core.Services.SourceManager(); // Fallback for designer
            _libraryService = new Core.Services.LibraryService();
            _settingsService = new Core.Services.SettingsService();
            _networkService = new Core.Services.NetworkService(_settingsService);
            _sourceStatusService = new Core.Services.SourceStatusService(_sourceManager, _settingsService, _networkService);
            _downloadService = new Core.Services.DownloadService(_sourceManager, _libraryService, _networkService);
            _imageCacheService = new Core.Services.ImageCacheService();
            _secureImageService = new Core.Services.SecureImageService(_networkService, _imageCacheService);
            _announcementService = new Core.Services.AnnouncementService(_settingsService);
            TogglePaneCommand = ReactiveCommand.Create(() => { IsPaneOpen = !IsPaneOpen; });
            CheckFirstRun();
            SetupAnnouncementService();
        }

        // Navigation History
        private readonly System.Collections.Generic.Stack<ViewModelBase> _navigationStack = new();

        public void GoBack()
        {
            if (_navigationStack.Count > 0)
            {
                // Dispose the page we are EXITING with delay to avoid visual flash
                DisposeDelayed(CurrentPage);

                CurrentPage = _navigationStack.Pop();
                
                // Refresh library when navigating back to it
                if (CurrentPage == LibraryVM)
                {
                    // Delay refresh to allow page transition animation to finish smoothly
                    _ = System.Threading.Tasks.Task.Run(async () => 
                    {
                        await System.Threading.Tasks.Task.Delay(400);
                        await LibraryVM.RefreshLibrary();
                    });
                }
                
                // Refresh read state when returning to manga detail
                if (CurrentPage is MangaDetailViewModel detailVM)
                {
                    // Delay refresh to allow page transition animation to finish smoothly
                    _ = System.Threading.Tasks.Task.Run(async () => 
                    {
                        await System.Threading.Tasks.Task.Delay(400);
                        detailVM.RefreshReadState();
                    });
                }
            }
            else
            {
                // Default fallback
                GoToLibrary();
            }
        }

        public void GoToDetail(MangaItem item)
        {
            if (item == null) return;
            
            // Mark manga as seen in memory & DB when opening detail page
            item.HasNewChapters = false;
            item.IsNewBadgeVisible = false;
            _ = _libraryService.MarkMangaAsSeenAsync(item.MangaUrl, item.SourceId);

            if (CurrentPage != null) _navigationStack.Push(CurrentPage);
            CurrentPage = new MangaDetailViewModel(item, this, _sourceManager, _libraryService, _networkService, _downloadService, _imageCacheService);
        }

        private bool IsMainTabViewModel(ViewModelBase? page)
        {
            if (page == null) return false;
            return page == _libraryVM || page == _browseVM || page == _settingsVM ||
                   page == _updatesVM || page == _upcomingVM || page == _historyVM ||
                   page == _downloadsVM || page == _extensionsVM || page == _welcomeVM;
        }

        public void GoToLibrary()
        {
            if (CurrentPage != LibraryVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = LibraryVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
            }
            Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = LibraryVM.RefreshLibrary());
        }

        public void GoToReader(ChapterItem? chapter = null, System.Collections.Generic.List<ChapterItem>? allChapters = null, long sourceId = 3, string mangaTitle = "", string mangaUrl = "", bool isNsfw = false, string mangaThumbnail = "")
        {
            if (CurrentPage != null) _navigationStack.Push(CurrentPage);
            CurrentPage = new ReaderViewModel(this, _sourceManager, chapter, allChapters, _networkService, _libraryService, _settingsService, sourceId, mangaTitle, mangaUrl, isNsfw, mangaThumbnail);
        }

        private BrowseViewModel? _browseVM;
        public BrowseViewModel BrowseVM
        {
            get => _browseVM ??= new BrowseViewModel(this, _sourceManager, _networkService, _sourceStatusService);
        }

        public void GoToBrowse()
        {
            if (CurrentPage != BrowseVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = BrowseVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
            }
        }

        private SettingsViewModel? _settingsVM;
        public SettingsViewModel SettingsVM
        {
            get => _settingsVM ??= new SettingsViewModel(this, _libraryService, _settingsService, _sourceManager, _networkService);
        }

        public void GoToSettings()
        {
            if (CurrentPage != SettingsVM)
            {
                var oldPage = CurrentPage;
                CurrentPage = SettingsVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
            }
        }

        private UpdatesViewModel? _updatesVM;
        public UpdatesViewModel UpdatesVM
        {
            get => _updatesVM ??= new UpdatesViewModel(_libraryService, _networkService, _sourceManager, _downloadService, _imageCacheService, this);
        }

        public void GoToUpdates()
        {
            if (CurrentPage != UpdatesVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = UpdatesVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
                Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = UpdatesVM.LoadUpdatesAsync());
            }
        }

        private UpcomingViewModel? _upcomingVM;
        public UpcomingViewModel UpcomingVM
        {
            get => _upcomingVM ??= new UpcomingViewModel(_libraryService, this);
        }

        public void GoToUpcoming()
        {
            if (CurrentPage != UpcomingVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = UpcomingVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
                Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = UpcomingVM.LoadUpcomingAsync());
            }
        }

        private HistoryViewModel? _historyVM;
        public HistoryViewModel HistoryVM
        {
            get => _historyVM ??= new HistoryViewModel(_libraryService, _networkService, _sourceManager, _settingsService, this);
        }

        public void GoToHistory()
        {
            if (CurrentPage != HistoryVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = HistoryVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
                Avalonia.Threading.Dispatcher.UIThread.Post(() => _ = HistoryVM.LoadHistory());
            }
        }

        public void RefreshHistory()
        {
            if (_historyVM != null)
            {
                _ = _historyVM.LoadHistory();
            }
        }

        private DownloadsViewModel? _downloadsVM;
        public DownloadsViewModel DownloadsVM
        {
            get => _downloadsVM ??= new DownloadsViewModel(this, _downloadService);
        }

        public void GoToDownloads()
        {
            if (CurrentPage != DownloadsVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = DownloadsVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
            }
        }

        private ExtensionsViewModel? _extensionsVM;
        public ExtensionsViewModel ExtensionsVM
        {
            get => _extensionsVM ??= new ExtensionsViewModel(this, _sourceManager);
        }

        public void GoToExtensions()
        {
            if (CurrentPage != ExtensionsVM)
            {
                var oldPage = CurrentPage;
                ClearStack();
                CurrentPage = ExtensionsVM;
                if (oldPage != null && !IsMainTabViewModel(oldPage))
                {
                    DisposeDelayed(oldPage);
                }
            }
        }

        public void ShowNotification(string message, NotificationType type = NotificationType.Info)
        {
            NotificationVM.Show(message, type);
        }

        private WelcomeViewModel? _welcomeVM;
        public WelcomeViewModel WelcomeVM
        {
            get => _welcomeVM ??= new WelcomeViewModel(this);
        }

        // Read from settings
        public bool IsFirstRun 
        { 
            get => _settingsService.IsFirstRun;
            set 
            {
                if (_settingsService.IsFirstRun != value)
                {
                    _settingsService.IsFirstRun = value;
                    _settingsService.Save();
                    this.RaisePropertyChanged();
                }
            }
        } 

        public void CheckFirstRun()
        {
            if (IsFirstRun)
            {
                CurrentPage = WelcomeVM;
            }
            else
            {
                CurrentPage = LibraryVM;
            }
        }

        public async Task RunStartupTasksAsync()
        {
            if (IsFirstRun) return;

            // Preload available remote extensions in background so they are instantly ready when opening Extensions view
            _ = Task.Run(async () =>
            {
                try
                {
                    await Task.Delay(300);
                    await ExtensionsVM.PreloadRemoteExtensionsAsync();
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[Startup] Extension preload error: {ex.Message}");
                }
            });

            // App Update Check
            if (_settingsService.CheckAppUpdateOnStart)
            {
                try
                {
                    var updateInfo = await _updateService.CheckForUpdatesAsync();
                    if (updateInfo.IsUpdateAvailable)
                    {
                        await PromptUpdateDialogAsync(updateInfo);
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[Update] Startup check failed: {ex.Message}");
                }
            }

            // Check if we need to update library on startup
            if (_settingsService.UpdateOnStart)
            {
                ShowNotification("Updating library...");
                LibraryVM.IsRefreshing = true;
                try
                {
                    int count = await _libraryService.UpdateAllLibraryMangaAsync(_sourceManager);
                    if (count > 0)
                    {
                        ShowNotification($"Library updated: {count} manga refreshed.");
                        // Refresh library view
                        _ = LibraryVM.RefreshLibrary();
                    }
                }
                finally
                {
                    LibraryVM.IsRefreshing = false;
                }
            }
        }

        public void CompleteOnboarding()
        {
            IsFirstRun = false;
            GoToLibrary();
        }

        private bool _isDownloading;
        public bool IsDownloading
        {
            get => _isDownloading;
            set => this.RaiseAndSetIfChanged(ref _isDownloading, value);
        }

        private int _downloadProgress;
        public int DownloadProgress
        {
            get => _downloadProgress;
            set => this.RaiseAndSetIfChanged(ref _downloadProgress, value);
        }

        private async void DisposeDelayed(ViewModelBase? page)
        {
            if (page == null || IsMainTabViewModel(page) || page is not IDisposable disposable) return;
            
            // Give the UI enough time to detach (300ms is snappier than 500ms)
            await Task.Delay(300);
            
            try 
            {
                disposable.Dispose();
                
                // Debounce memory cleanup
                _cleanupCts?.Cancel();
                _cleanupCts = new System.Threading.CancellationTokenSource();
                var token = _cleanupCts.Token;

                System.Diagnostics.Debug.WriteLine("[MainWindowVM] RAM Optimization scheduled...");
                
                // Run cleanup asynchronously after 1.5 seconds of inactivity
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await Task.Delay(1500, token);
                        if (token.IsCancellationRequested) return;
                        CleanupMemory();
                    }
                    catch (TaskCanceledException) {}
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindowVM] Error during delayed disposal: {ex.Message}");
            }
        }

        private void ClearStack()
        {
            while (_navigationStack.Count > 0)
            {
                var page = _navigationStack.Pop();
                if (page is IDisposable d) d.Dispose();
            }
        }

        private void CleanupMemory()
        {
            try
            {
                // Use WorkingSet64 to measure ACTUAL process RAM usage as shown in Task Manager.
                // GC.GetTotalMemory() only measures managed heap (~34MB) and is blind to the 
                // hundreds of MB of unmanaged native memory used by Skia/Avalonia bitmap buffers.
                long memoryUsed = System.Diagnostics.Process.GetCurrentProcess().WorkingSet64;
                if (memoryUsed > 200 * 1024 * 1024) // Trigger cleanup if RAM > 200MB
                {
                    // 1. Clear memory caches (Thread-safe ConcurrentDictionary)
                    _imageCacheService.Clear();
                    
                    // 2. Force Aggressive Garbage Collection asynchronously on a background thread
                    // to prevent UI freezing during navigation transitions.
                    Task.Run(() =>
                    {
                        try
                        {
                            GC.Collect(2, GCCollectionMode.Forced, true);
                            GC.WaitForPendingFinalizers();
                            GC.Collect(2, GCCollectionMode.Forced, true);
                            System.Diagnostics.Debug.WriteLine("[MainWindowVM] Asynchronous GC completed.");
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[MainWindowVM] GC error: {ex.Message}");
                        }
                    });
                    
                    System.Diagnostics.Debug.WriteLine($"[MainWindowVM] RAM Optimization triggered (WorkingSet: {memoryUsed / 1024 / 1024}MB): Cache cleared and async GC scheduled.");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[MainWindowVM] RAM Optimization skipped (WorkingSet: {memoryUsed / 1024 / 1024}MB is below threshold).");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MainWindowVM] Cleanup error: {ex.Message}");
            }
        }
    }
}
