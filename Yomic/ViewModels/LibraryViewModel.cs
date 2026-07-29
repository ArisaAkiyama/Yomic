using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Reactive;
using ReactiveUI;
using System.Threading.Tasks;
using Avalonia.Media.Imaging;
using System.Net.Http;
using System.IO;
using System.Linq;
using System;
using System.Reactive.Linq;

namespace Yomic.ViewModels
{
    public enum LibrarySortMode
    {
        TitleAsc,     // A-Z
        TitleDesc,    // Z-A
        DateModified, // Most recent first
        UnreadCountDesc, // Most unread first
        LastReadDesc  // Recently read first
    }

    public enum LibraryFilterMode
    {
        All,
        UnreadOnly,
        OngoingOnly,
        CompletedOnly,
        DownloadedOnly
    }

    public class CategoryTabItem : ReactiveObject
    {
        public long Id { get; set; } // -1 = All, -2 = Uncategorized, >0 = Custom
        public string Name { get; set; } = string.Empty;
        
        private string _color = "#FFFFFF";
        public string Color
        {
            get => _color;
            set
            {
                this.RaiseAndSetIfChanged(ref _color, value);
                this.RaisePropertyChanged(nameof(ColorBrush));
                this.RaisePropertyChanged(nameof(BackgroundBrush));
                this.RaisePropertyChanged(nameof(ForegroundBrush));
            }
        }

        private bool _isSelected;
        public bool IsSelected
        {
            get => _isSelected;
            set
            {
                this.RaiseAndSetIfChanged(ref _isSelected, value);
                this.RaisePropertyChanged(nameof(BackgroundBrush));
                this.RaisePropertyChanged(nameof(ForegroundBrush));
            }
        }

        public bool ShowColorDot => Id > 0;
        public string ColorBrush => Color;

        // Glassmorphic frosted glass style depending on IsSelected
        public string BackgroundBrush => IsSelected ? "#22FFFFFF" : "#10FFFFFF";
        public string BorderBrush => IsSelected ? "#55FFFFFF" : "#30FFFFFF";
        
        public string ForegroundBrush => IsSelected ? "White" : "#CCCCCC";
    }

    public class LibraryViewModel : ViewModelBase, IDisposable
    {
        private static readonly string _cacheFolder;
        private readonly EventHandler<bool> _statusChangedHandler;
        
        private List<MangaItem> _allItems = new(); // Store all items offline
        public ObservableCollection<MangaItem> LibraryItems { get; set; } = new();

        private readonly MainWindowViewModel _mainVM;
        private readonly Core.Services.LibraryService _libraryService;
        private readonly Core.Services.ImageCacheService _imageCacheService;
        private readonly Core.Services.SettingsService _settingsService;
        
        private List<MangaItem> _currentFilteredItems = new();
        private int _loadedCount = 0;
        private const int PageSize = 30;

        private bool _isLoadingMore;
        public bool IsLoadingMore
        {
            get => _isLoadingMore;
            set => this.RaiseAndSetIfChanged(ref _isLoadingMore, value);
        }

        private bool _isListView;
        public bool IsListView
        {
            get => _isListView;
            set
            {
                this.RaiseAndSetIfChanged(ref _isListView, value);
                this.RaisePropertyChanged(nameof(ShowGridView));
                this.RaisePropertyChanged(nameof(ShowListView));
            }
        }

        private bool _hasMoreItems;
        public bool HasMoreItems
        {
            get => _hasMoreItems;
            set => this.RaiseAndSetIfChanged(ref _hasMoreItems, value);
        }

        public ReactiveCommand<Unit, Unit> LoadMoreCommand { get; }

        static LibraryViewModel()
        {
            // Setup cache folder
            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _cacheFolder = Path.Combine(appData, "Yomic", "covers");
            if (!Directory.Exists(_cacheFolder))
            {
                Directory.CreateDirectory(_cacheFolder);
            }
        }

        private string _searchText = string.Empty;
        public string SearchText
        {
            get => _searchText;
            set => this.RaiseAndSetIfChanged(ref _searchText, value);
        }

        private string _selectedSourceFilter = "All";
        public string SelectedSourceFilter
        {
            get => _selectedSourceFilter;
            set
            {
                this.RaiseAndSetIfChanged(ref _selectedSourceFilter, value);
                FilterLibrary();
            }
        }

        public class LibrarySourceFilterItem : ReactiveObject
        {
            public string Name { get; set; } = string.Empty;
            public string Id { get; set; } = string.Empty;
            
            private Avalonia.Media.Imaging.Bitmap? _iconBitmap;
            public Avalonia.Media.Imaging.Bitmap? IconBitmap
            {
                get => _iconBitmap;
                set => this.RaiseAndSetIfChanged(ref _iconBitmap, value);
            }

            public string IconText { get; set; } = string.Empty;
            public string IconColor { get; set; } = "White";
            public string IconForeground { get; set; } = "Black";
        }

        public ObservableCollection<LibrarySourceFilterItem> AvailableSources { get; } = new ObservableCollection<LibrarySourceFilterItem>();

        public class GenreFilterItem : ReactiveObject
        {
            public string Name { get; set; } = string.Empty;
            
            private bool _isSelected;
            public bool IsSelected
            {
                get => _isSelected;
                set => this.RaiseAndSetIfChanged(ref _isSelected, value);
            }
        }

        public ObservableCollection<GenreFilterItem> AvailableGenres { get; } = new();

        public System.Windows.Input.ICommand ClearGenreFilterCommand { get; }

        public ObservableCollection<CategoryTabItem> CategoryTabs { get; } = new();

        private CategoryTabItem? _selectedCategoryTab;
        public CategoryTabItem? SelectedCategoryTab
        {
            get => _selectedCategoryTab;
            set
            {
                if (value != _selectedCategoryTab)
                {
                    if (_selectedCategoryTab != null) _selectedCategoryTab.IsSelected = false;
                    this.RaiseAndSetIfChanged(ref _selectedCategoryTab, value);
                    if (_selectedCategoryTab != null) _selectedCategoryTab.IsSelected = true;
                    
                    FilterLibrary();
                }
            }
        }

        private bool _hasCategories;
        public bool HasCategories
        {
            get => _hasCategories;
            set => this.RaiseAndSetIfChanged(ref _hasCategories, value);
        }

        private bool _isLibraryEmpty;
        public bool IsLibraryEmpty
        {
             get => _isLibraryEmpty;
             set => this.RaiseAndSetIfChanged(ref _isLibraryEmpty, value);
        }

        private bool _hasNoResults;
        public bool HasNoResults
        {
             get => _hasNoResults;
             set => this.RaiseAndSetIfChanged(ref _hasNoResults, value);
        }

        private bool _isEmpty;
        public bool IsEmpty
        {
             get => _isEmpty;
             set => this.RaiseAndSetIfChanged(ref _isEmpty, value);
        }

        private bool _isRefreshing;
        public bool IsRefreshing
        {
             get => _isRefreshing;
             set
             {
                 this.RaiseAndSetIfChanged(ref _isRefreshing, value);
                 this.RaisePropertyChanged(nameof(ShowGridView));
                 this.RaisePropertyChanged(nameof(ShowListView));
             }
        }

        public bool ShowGridView => !IsListView && !IsLoading && !IsRefreshing;
        public bool ShowListView => IsListView && !IsLoading && !IsRefreshing;

        // Commands
        public ReactiveCommand<MangaItem, Unit> OpenMangaCommand { get; }
        public ReactiveCommand<Unit, Unit> GoToBrowseCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenFilterCommand { get; }
        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<MangaItem, Unit> MarkAsReadCommand { get; }
        public ReactiveCommand<MangaItem, Unit> MarkAsUnreadCommand { get; }
        public ReactiveCommand<MangaItem, Unit> RemoveMangaCommand { get; }
        public ReactiveCommand<MangaItem, Unit> DeleteMangaCommand { get; }
        public ReactiveCommand<MangaItem, Unit> DeleteMangaDownloadsCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleViewModeCommand { get; }

        private bool _isFilterVisible;
        public bool IsFilterVisible
        {
            get => _isFilterVisible;
            set => this.RaiseAndSetIfChanged(ref _isFilterVisible, value);
        }

        private LibrarySortMode _selectedSortMode = LibrarySortMode.TitleAsc;
        public LibrarySortMode SelectedSortMode
        {
            get => _selectedSortMode;
            set
            {
                this.RaiseAndSetIfChanged(ref _selectedSortMode, value);
                FilterLibrary();
            }
        }

        private LibraryFilterMode _selectedFilterMode = LibraryFilterMode.All;
        public LibraryFilterMode SelectedFilterMode
        {
            get => _selectedFilterMode;
            set
            {
                this.RaiseAndSetIfChanged(ref _selectedFilterMode, value);
                FilterLibrary();
            }
        }

        public ReactiveCommand<LibrarySortMode, Unit> SetSortModeCommand { get; }
        public ReactiveCommand<LibraryFilterMode, Unit> SetFilterModeCommand { get; }
        public ReactiveCommand<string, Unit> SetSourceFilterCommand { get; }
        public Func<MangaItem, Task<bool>>? ConfirmDeleteFromDiskAsync { get; set; }
        public Func<MangaItem, Task<bool>>? ConfirmDeleteDownloadsAsync { get; set; }

        public ReactiveCommand<Unit, Unit> ManageCategoriesCommand { get; }
        public ReactiveCommand<MangaItem, Unit> EditMangaCategoriesCommand { get; }

        public Func<Task>? RequestManageCategoriesAsync { get; set; }
        public Func<MangaItem, Task>? RequestEditMangaCategoriesAsync { get; set; }

        // Helper for UI
        public bool HasItems => LibraryItems.Count > 0;
        
        private readonly Core.Services.NetworkService _networkService;
        
        private bool _isOnline = true;
        public bool IsOnline
        {
            get => _isOnline;
            set => this.RaiseAndSetIfChanged(ref _isOnline, value);
        }

        public LibraryViewModel(MainWindowViewModel mainViewModel, 
                                Core.Services.LibraryService libraryService, 
                                Core.Services.NetworkService networkService,
                                Core.Services.ImageCacheService imageCacheService,
                                Core.Services.SettingsService settingsService)
        {
            _mainVM = mainViewModel;
            _libraryService = libraryService;
            _networkService = networkService;
            _imageCacheService = imageCacheService;
            _settingsService = settingsService;

            // Load persisted sort preference
            _selectedSortMode = (LibrarySortMode)_settingsService.LibrarySortMode;
            _isListView = _settingsService.LibraryIsListView;

            // Throttled search (300ms debounce)
            this.WhenAnyValue(x => x.SearchText)
                .Throttle(TimeSpan.FromMilliseconds(300))
                .ObserveOn(RxApp.MainThreadScheduler)
                .Subscribe(_ => FilterLibrary());

            // Bind to NetworkService
            IsOnline = _networkService.IsOnline;
            _statusChangedHandler = (s, online) => 
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    var wasOffline = !IsOnline;
                    IsOnline = online;
                    
                    // Auto-reload when coming back online
                    if (wasOffline && online)
                    {
                        System.Diagnostics.Debug.WriteLine("[LibraryVM] Internet reconnected - auto-reloading...");
                        _ = RefreshLibrary();
                    }
                });
            };
            _networkService.StatusChanged += _statusChangedHandler;

            OpenMangaCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                // Clear the badge in UI immediately
                item.HasNewChapters = false;
                
                // Clear the badge in DB
                _ = _libraryService.MarkMangaAsSeenAsync(item.MangaUrl, item.SourceId);

                mainViewModel.GoToDetail(item);
            });

            GoToBrowseCommand = ReactiveCommand.Create(() => 
            {
                mainViewModel.GoToBrowse();
            });

            LoadMoreCommand = ReactiveCommand.CreateFromTask(LoadMoreLibraryAsync);

            OpenFilterCommand = ReactiveCommand.Create(() => 
            {
                IsFilterVisible = !IsFilterVisible;
            });

            ToggleViewModeCommand = ReactiveCommand.Create(() => 
            {
                IsListView = !IsListView;
                _settingsService.LibraryIsListView = IsListView;
                _settingsService.Save();
            });

            MarkAsReadCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                var manga = new Core.Models.Manga { Url = item.MangaUrl, Source = item.SourceId };
                await _libraryService.MarkChaptersAsReadAsync(manga);
                
                // UI Update
                item.UnreadCount = null;
                item.HasNewChapters = false;
            });

            // COMMAND: Mark as Unread (Clear Read Story)
            MarkAsUnreadCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                var manga = new Core.Models.Manga { Url = item.MangaUrl, Source = item.SourceId };
                await _libraryService.MarkChaptersAsUnreadAsync(manga);
                
                // Update UI: Restore Unread Count
                var dbManga = await _libraryService.GetMangaByUrlAsync(item.MangaUrl, item.SourceId);
                if (dbManga != null && dbManga.Chapters != null)
                {
                    int unread = dbManga.Chapters.Count; // Since all are unread now
                    Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                    {
                        item.UnreadCount = unread > 0 ? unread.ToString() : null;
                    });
                }
            });

            RemoveMangaCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                var manga = new Core.Models.Manga { Url = item.MangaUrl, Source = item.SourceId };
                await _libraryService.RemoveFromLibraryAsync(manga, deleteFiles: false);
                
                // UI Update - Delayed to let ContextMenu close
                await Task.Delay(100);
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    _allItems.Remove(item);
                    LibraryItems.Remove(item);
                    IsEmpty = LibraryItems.Count == 0;
                    this.RaisePropertyChanged(nameof(HasItems));
                });
            });
            
            DeleteMangaCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                var confirmed = ConfirmDeleteFromDiskAsync == null || await ConfirmDeleteFromDiskAsync(item);
                if (!confirmed)
                {
                    return;
                }

                var manga = new Core.Models.Manga { Url = item.MangaUrl, Source = item.SourceId };
                await _libraryService.RemoveFromLibraryAsync(manga, deleteFiles: true);
                
                // UI Update - Delayed to let ContextMenu close
                await Task.Delay(100);
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    _allItems.Remove(item);
                    LibraryItems.Remove(item);
                    IsEmpty = LibraryItems.Count == 0;
                    this.RaisePropertyChanged(nameof(HasItems));
                });
            });

            DeleteMangaDownloadsCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                var confirmed = ConfirmDeleteDownloadsAsync == null || await ConfirmDeleteDownloadsAsync(item);
                if (!confirmed)
                {
                    return;
                }

                var manga = new Core.Models.Manga { Url = item.MangaUrl, Source = item.SourceId };
                await _libraryService.DeleteMangaDownloadsAsync(manga);

                // UI Update: Clear download count and hide badge in real-time
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    item.DownloadedCount = 0;
                    item.HasDownloadedChapters = false;
                });
            });

            // Manual Refresh Button - Force reload covers from network
            RefreshCommand = ReactiveCommand.CreateFromTask(async () =>
            {
                if (IsOnline)
                {
                    await ForceRefreshLibrary();
                }
            });

            // Sort Mode Command
            SetSortModeCommand = ReactiveCommand.Create<LibrarySortMode>(mode =>
            {
                SelectedSortMode = mode;
                // Persist to settings
                _settingsService.LibrarySortMode = (int)mode;
                _settingsService.Save();
            });

            // Filter Mode Command
            SetFilterModeCommand = ReactiveCommand.Create<LibraryFilterMode>(mode =>
            {
                SelectedFilterMode = mode;
            });

            ManageCategoriesCommand = ReactiveCommand.CreateFromTask(async () =>
            {
                if (RequestManageCategoriesAsync != null)
                {
                    await RequestManageCategoriesAsync();
                }
            });

            EditMangaCategoriesCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item =>
            {
                if (RequestEditMangaCategoriesAsync != null)
                {
                    await RequestEditMangaCategoriesAsync(item);
                }
            });

            // Source Filter Command
            SetSourceFilterCommand = ReactiveCommand.Create<string>(source =>
            {
                SelectedSourceFilter = source;
            });

            ClearGenreFilterCommand = ReactiveCommand.Create(() =>
            {
                foreach (var g in AvailableGenres)
                {
                    g.IsSelected = false;
                }
                FilterLibrary();
            });
            
            // Initial load
            _ = RefreshLibrary();
        }

        private bool _isLoading;
        public bool IsLoading
        {
            get => _isLoading;
            set
            {
                this.RaiseAndSetIfChanged(ref _isLoading, value);
                this.RaisePropertyChanged(nameof(ShowGridView));
                this.RaisePropertyChanged(nameof(ShowListView));
            }
        }

        public async Task RefreshLibrary()
        {
            IsLoading = true;
            try
            {
                await LoadCategoriesAsync();
                Yomic.Core.Services.LogService.Info("LibraryVM", "Soft refresh (cached images)...");
                var mangas = await _libraryService.GetLibraryMangaAsync();
                Yomic.Core.Services.LogService.Info("LibraryVM", $"Found {mangas.Count} items in DB.");
                
                await MergeLibraryItems(mangas, forceDownload: false);

                Yomic.Core.Services.LogService.Info("LibraryVM", $"UI Updated. Items: {LibraryItems.Count}");
            }
            catch (System.Exception ex)
            {
                Yomic.Core.Services.LogService.Error("LibraryVM", "Error loading library", ex);
            }
            finally
            {
                IsLoading = false;
            }
        }

        public async Task ForceRefreshLibrary()
        {
            IsRefreshing = true;
            try
            {
                if (IsOnline)
                {
                    Yomic.Core.Services.LogService.Info("LibraryVM", "Checking for latest updates from sources...");
                    await _libraryService.UpdateAllLibraryMangaAsync(_mainVM.SourceManager, forceRefresh: true);
                }

                Yomic.Core.Services.LogService.Info("LibraryVM", "Hard refresh (redownload covers)...");
                var mangas = await _libraryService.GetLibraryMangaAsync();
                
                await MergeLibraryItems(mangas, forceDownload: true);
            }
            finally
            {
                IsRefreshing = false;
            }
        }

        public async Task RefreshLibraryCoversForceAsync()
        {
            foreach (var item in _allItems)
            {
                var originalUrl = item.CoverUrl;
                item.CoverUrl = null;
                await Task.Delay(5);
                item.CoverUrl = originalUrl;
            }
        }
        
        private async Task MergeLibraryItems(List<Core.Models.Manga> mangas, bool forceDownload)
        {
             // Create Lookup for New State
             var newMangaDict = mangas.ToDictionary(m => m.Url + "|" + m.Source);
             
             // 1. Remove deleted items from _allItems
             var toRemove = new List<MangaItem>();
             foreach (var existing in _allItems)
             {
                 var key = existing.MangaUrl + "|" + existing.SourceId;
                 if (!newMangaDict.ContainsKey(key))
                 {
                     toRemove.Add(existing);
                 }
             }
             foreach (var item in toRemove) _allItems.Remove(item);
             
             // 2. Add or Update items
             var allItemsDict = _allItems.ToDictionary(x => x.MangaUrl + "|" + x.SourceId);
             foreach (var m in mangas)
             {
                 var key = m.Url + "|" + m.Source;
                 allItemsDict.TryGetValue(key, out var existingItem);
                 
                 // Calculate Unread Count
                 int unread = m.Chapters?.Count(c => !c.Read) ?? 0;
                 string? unreadString = unread > 0 ? unread.ToString() : null;
                 
                 int downloadedCount = Core.Services.DownloadPathService.GetDownloadedChaptersCount(m);
                 bool hasDownloaded = downloadedCount > 0;

                 if (existingItem != null)
                 {
                      // Update existing
                      if (existingItem.Title != m.Title) existingItem.Title = m.Title;
                      if (existingItem.UnreadCount != unreadString) existingItem.UnreadCount = unreadString;
                      if (existingItem.HasNewChapters != m.HasNewChapters) existingItem.HasNewChapters = m.HasNewChapters;
                       
                      if (existingItem.CoverUrl != m.ThumbnailUrl)
                      {
                          existingItem.CoverUrl = m.ThumbnailUrl;
                      }

                      if (existingItem.Status != m.Status) existingItem.Status = m.Status;
                      if (existingItem.LastViewed != m.LastViewed) existingItem.LastViewed = m.LastViewed;
                      if (existingItem.LastUpdate != m.LastUpdate) existingItem.LastUpdate = m.LastUpdate;
                      if (string.IsNullOrEmpty(existingItem.SourceName)) existingItem.SourceName = _mainVM.SourceManager.GetSource(m.Source)?.Name;
                      if (existingItem.HasDownloadedChapters != hasDownloaded) existingItem.HasDownloadedChapters = hasDownloaded;
                      if (existingItem.DownloadedCount != downloadedCount) existingItem.DownloadedCount = downloadedCount;
                      
                      // Sync category IDs
                      existingItem.CategoryIds = m.Categories?.Select(c => c.Id).ToList() ?? new List<long>();
                      
                      // Sync genres
                      if (m.Genre != null) 
                      {
                          existingItem.Genres = new List<string>(m.Genre);
                      }
                 }
                 else
                 {
                      // Add New
                      var newItem = new MangaItem
                      {
                           Title = m.Title,
                           CoverUrl = m.ThumbnailUrl,
                           SourceId = m.Source,
                           SourceName = _mainVM.SourceManager.GetSource(m.Source)?.Name,
                           MangaUrl = m.Url,
                           UnreadCount = unreadString,
                           Status = m.Status,
                           LastViewed = m.LastViewed,
                           LastUpdate = m.LastUpdate,
                           HasDownloadedChapters = hasDownloaded,
                           DownloadedCount = downloadedCount,
                           CategoryIds = m.Categories?.Select(c => c.Id).ToList() ?? new List<long>(),
                           Genres = m.Genre != null ? new List<string>(m.Genre) : new List<string>()
                      };
                      newItem.HasNewChapters = m.HasNewChapters;
                      
                      _allItems.Add(newItem);
                 }
             }
             
             // 3. Update AvailableSources
             var sourceIds = _allItems
                 .Select(x => x.SourceId)
                 .Distinct()
                 .ToList();

             var desiredSources = new List<LibrarySourceFilterItem> 
             { 
                 new LibrarySourceFilterItem { Name = "All", Id = "All", IconText = "ALL" } 
             };
             
             foreach (var id in sourceIds)
             {
                 var s = _mainVM.SourceManager.GetSource(id);
                 if (s != null)
                 {
                     var item = new LibrarySourceFilterItem 
                     { 
                         Name = s.Name, 
                         Id = s.Id.ToString(),
                         IconText = !string.IsNullOrEmpty(s.Name) ? s.Name.Substring(0, 1) : "?",
                         IconColor = !string.IsNullOrEmpty(s.IconBackground) ? s.IconBackground : "White",
                         IconForeground = !string.IsNullOrEmpty(s.IconForeground) ? s.IconForeground : "Black"
                     };
                     
                     var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                     var iconsDir = System.IO.Path.Combine(appData, "Yomic", "Icons");
                     var iconFile = System.IO.Path.Combine(iconsDir, $"{s.Id}.png");
                     if (System.IO.File.Exists(iconFile))
                     {
                         try {
                             var bytes = System.IO.File.ReadAllBytes(iconFile);
                             using var ms = new System.IO.MemoryStream(bytes);
                             item.IconBitmap = new Avalonia.Media.Imaging.Bitmap(ms);
                             item.IconText = "";
                         } catch { }
                     }
                     
                     desiredSources.Add(item);
                 }
             }
             desiredSources = desiredSources.OrderBy(x => x.Name == "All" ? 0 : 1).ThenBy(x => x.Name).ToList();

             // Extract all unique genres from _allItems on background thread
             var allExtractedGenres = _allItems
                 .Where(x => x.Genres != null)
                 .SelectMany(x => x.Genres)
                 .Where(g => !string.IsNullOrWhiteSpace(g))
                 .Select(g => g.Trim())
                 .Where(g => !string.Equals(g, "Manga", StringComparison.OrdinalIgnoreCase))
                 .Distinct(StringComparer.OrdinalIgnoreCase)
                 .OrderBy(g => g)
                 .ToList();

             // Post collection updates to UI Thread
             Avalonia.Threading.Dispatcher.UIThread.Post(() => 
             {
                 // Sync
                 var toRemoveSource = AvailableSources.Where(s => !desiredSources.Any(d => d.Name == s.Name)).ToList();
                 foreach (var s in toRemoveSource) AvailableSources.Remove(s);

                 foreach (var s in desiredSources)
                 {
                     if (!AvailableSources.Any(x => x.Name == s.Name)) AvailableSources.Add(s);
                 }

                 // Fix Order natively
                 for (int i = 0; i < desiredSources.Count; i++)
                 {
                     if (AvailableSources[i].Name != desiredSources[i].Name)
                     {
                         var oldItem = AvailableSources.FirstOrDefault(x => x.Name == desiredSources[i].Name);
                         if (oldItem != null)
                         {
                             var oldIndex = AvailableSources.IndexOf(oldItem);
                             AvailableSources.Move(oldIndex, i);
                         }
                     }
                 }

                  if (!AvailableSources.Any(x => x.Name == SelectedSourceFilter))
                  {
                      SelectedSourceFilter = "All";
                  }
                  else
                  {
                       // FilterLibrary() is called below or skipped if source filter changed
                  }

                  // Sync AvailableGenres
                  var toRemoveGenre = AvailableGenres.Where(g => !allExtractedGenres.Contains(g.Name, StringComparer.OrdinalIgnoreCase)).ToList();
                  foreach (var g in toRemoveGenre) AvailableGenres.Remove(g);

                  foreach (var g in allExtractedGenres)
                  {
                      if (!AvailableGenres.Any(x => string.Equals(x.Name, g, StringComparison.OrdinalIgnoreCase)))
                      {
                          var genreItem = new GenreFilterItem { Name = g };
                          // Auto filter on selection change
                          genreItem.WhenAnyValue(x => x.IsSelected)
                              .Skip(1)
                              .Subscribe(_ => FilterLibrary());
                              
                          AvailableGenres.Add(genreItem);
                      }
                  }
                  
                  // Sort AvailableGenres natively
                  var sortedGenres = AvailableGenres.OrderBy(g => g.Name).ToList();
                  for (int i = 0; i < sortedGenres.Count; i++)
                  {
                      if (AvailableGenres[i].Name != sortedGenres[i].Name)
                      {
                          var oldItem = AvailableGenres.FirstOrDefault(x => x.Name == sortedGenres[i].Name);
                          if (oldItem != null)
                          {
                              var oldIndex = AvailableGenres.IndexOf(oldItem);
                              AvailableGenres.Move(oldIndex, i);
                          }
                      }
                  }

                  FilterLibrary();
              });
        }

        public void FilterLibrary()
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() => 
            {
                 var query = _allItems.AsEnumerable();

                 // 1. Apply Search
                 if (!string.IsNullOrWhiteSpace(SearchText))
                 {
                     query = query.Where(x => x.Title.Contains(SearchText, StringComparison.OrdinalIgnoreCase));
                 }

                 // 2. Apply Source Filter
                  if (!string.IsNullOrEmpty(SelectedSourceFilter) && SelectedSourceFilter != "All")
                  {
                      var sourceItem = AvailableSources.FirstOrDefault(s => s.Name == SelectedSourceFilter);
                      if (sourceItem != null && long.TryParse(sourceItem.Id, out long selectedSourceId))
                      {
                          query = query.Where(x => x.SourceId == selectedSourceId);
                      }
                      else
                      {
                          query = query.Where(x => string.Equals(x.SourceName, SelectedSourceFilter, StringComparison.OrdinalIgnoreCase));
                      }
                  }

                 // 2b. Apply Category Filter
                 if (HasCategories && SelectedCategoryTab != null)
                 {
                     if (SelectedCategoryTab.Id == -2) // Uncategorized
                     {
                         query = query.Where(x => x.CategoryIds == null || x.CategoryIds.Count == 0);
                      }
                      else if (SelectedCategoryTab.Id > 0) // Custom category
                      {
                          query = query.Where(x => x.CategoryIds != null && x.CategoryIds.Contains(SelectedCategoryTab.Id));
                      }
                 }

                 // 2c. Apply Filter
                 query = SelectedFilterMode switch
                 {
                     LibraryFilterMode.UnreadOnly => query.Where(x => !string.IsNullOrEmpty(x.UnreadCount) && x.UnreadCount != "0"),
                     LibraryFilterMode.OngoingOnly => query.Where(x => x.Status == 1),
                     LibraryFilterMode.CompletedOnly => query.Where(x => x.Status == 2),
                     LibraryFilterMode.DownloadedOnly => query.Where(x => x.HasDownloadedChapters),
                     _ => query
                 };

                 // 2d. Apply Genre Filter (AND logic)
                 var selectedGenres = AvailableGenres.Where(g => g.IsSelected).Select(g => g.Name).ToList();
                 if (selectedGenres.Count > 0)
                 {
                     query = query.Where(x => x.Genres != null && selectedGenres.All(g => 
                         x.Genres.Any(xg => string.Equals(xg.Trim(), g, StringComparison.OrdinalIgnoreCase))));
                 }

                 // 3. Apply Sort
                 IEnumerable<MangaItem> sorted = SelectedSortMode switch
                 {
                     LibrarySortMode.TitleAsc => query.OrderBy(x => x.Title),
                     LibrarySortMode.TitleDesc => query.OrderByDescending(x => x.Title),
                     LibrarySortMode.DateModified => query.OrderByDescending(x => x.LastUpdate > 0 ? x.LastUpdate : x.LastViewed).ThenBy(x => x.Title),
                     LibrarySortMode.UnreadCountDesc => query.OrderByDescending(x => int.TryParse(x.UnreadCount, out int c) ? c : 0).ThenBy(x => x.Title),
                     LibrarySortMode.LastReadDesc => query.OrderByDescending(x => x.LastViewed).ThenBy(x => x.Title),
                     _ => query.OrderBy(x => x.Title)
                 };
                       
                 var source = sorted.ToList();
                 _currentFilteredItems = source;
                 
                 IsLoadingMore = false;
                 HasMoreItems = source.Count > PageSize;

                 var initialPage = source.Take(PageSize).ToList();
                 _loadedCount = initialPage.Count;

                 // Smart Sync for ObservableCollection using HashSet lookup for O(1) contains check
                 var initialPageSet = new HashSet<MangaItem>(initialPage);
                 var toRemove = LibraryItems.Where(i => !initialPageSet.Contains(i)).ToList();
                 foreach(var item in toRemove) LibraryItems.Remove(item);
                 
                 // Use an in-memory shadow list to avoid slow index scans on the Avalonia UI ObservableCollection
                 var shadowList = LibraryItems.ToList();
                 for (int i = 0; i < initialPage.Count; i++)
                 {
                     var item = initialPage[i];
                     int existingIndex = shadowList.IndexOf(item);
                     
                     if (existingIndex == -1)
                     {
                         LibraryItems.Insert(i, item);
                         shadowList.Insert(i, item);
                     }
                     else if (existingIndex != i)
                     {
                         LibraryItems.Move(existingIndex, i);
                         shadowList.RemoveAt(existingIndex);
                         shadowList.Insert(i, item);
                     }
                 }
                 
                 IsLibraryEmpty = _allItems.Count == 0;
                 IsEmpty = LibraryItems.Count == 0;
                 HasNoResults = !IsLibraryEmpty && IsEmpty;

                 this.RaisePropertyChanged(nameof(HasItems));
            });
        }

        private async Task LoadMoreLibraryAsync()
        {
            if (IsLoadingMore || !HasMoreItems) return;

            IsLoadingMore = true;
            try
            {
                await Task.Delay(50); // Small delay to let UI breathe
                
                var nextPage = _currentFilteredItems.Skip(_loadedCount).Take(PageSize).ToList();
                
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    foreach (var item in nextPage)
                    {
                        LibraryItems.Add(item);
                    }
                    _loadedCount += nextPage.Count;
                    HasMoreItems = _loadedCount < _currentFilteredItems.Count;
                });
            }
            finally
            {
                IsLoadingMore = false;
            }
        }

        #region Category Tabs Loading & DND

        public async Task LoadCategoriesAsync()
        {
            var categories = await _libraryService.GetCategoriesAsync();
            
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                var prevSelectedId = SelectedCategoryTab?.Id ?? -1;
                
                CategoryTabs.Clear();
                
                if (categories.Any())
                {
                    // Add "All" tab
                    CategoryTabs.Add(new CategoryTabItem { Id = -1, Name = "All", Color = "Transparent" });
                    
                    // Add "Default/Uncategorized" tab
                    CategoryTabs.Add(new CategoryTabItem { Id = -2, Name = "Default", Color = "Transparent" });
                    
                    // Add custom categories
                    foreach (var c in categories)
                    {
                        CategoryTabs.Add(new CategoryTabItem 
                        { 
                            Id = c.Id, 
                            Name = c.Name, 
                            Color = c.Color 
                        });
                    }
                    
                    HasCategories = true;
                }
                else
                {
                    HasCategories = false;
                }
                
                // Restore selection or select first
                var toSelect = CategoryTabs.FirstOrDefault(t => t.Id == prevSelectedId) ?? CategoryTabs.FirstOrDefault();
                SelectedCategoryTab = toSelect;
            });
        }

        public async Task AddMangaToCategoryAsync(MangaItem item, long categoryId)
        {
            try
            {
                if (categoryId == -2)
                {
                    // Clear categories (put back to Uncategorized)
                    await _libraryService.SetMangaCategoriesAsync(item.MangaUrl, item.SourceId, new List<long>());
                    item.CategoryIds.Clear();
                    FilterLibrary();
                    return;
                }
                
                var categoryIds = await _libraryService.GetMangaCategoryIdsAsync(item.MangaUrl, item.SourceId);
                if (!categoryIds.Contains(categoryId))
                {
                    categoryIds.Add(categoryId);
                    await _libraryService.SetMangaCategoriesAsync(item.MangaUrl, item.SourceId, categoryIds);
                    
                    if (!item.CategoryIds.Contains(categoryId))
                    {
                        item.CategoryIds.Add(categoryId);
                    }
                    
                    FilterLibrary();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Error adding manga to category: {ex}");
            }
        }

        #endregion
        public void Dispose()
        {
            if (_networkService != null && _statusChangedHandler != null)
            {
                _networkService.StatusChanged -= _statusChangedHandler;
            }
        }
    }
}
