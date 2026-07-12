using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Reactive;
using ReactiveUI;
using Yomic.Core.Sources;
using Yomic.Core.Models;
using System.Linq;
using System.Reactive.Linq;
using Yomic.Core.Services;
using Avalonia.Media.Imaging;
using Avalonia.Platform;

namespace Yomic.ViewModels
{
    public enum SourceStatusFilterMode
    {
        All,
        Ongoing,
        Completed
    }

    public class SourceFeedViewModel : ViewModelBase, IDisposable
    {
        private readonly IMangaSource _source;
        private readonly MainWindowViewModel _mainVm;
        private readonly SourceManager _sourceManager;
        private readonly ImageCacheService _imageCacheService;
        private readonly List<MangaItem> _allMangaItems = new();
        private readonly ConcurrentDictionary<string, int> _statusCache = new();
        private const int FilteredPageSize = 14;
        
        private readonly Bitmap? _gbFlag;
        private readonly Bitmap? _idFlag;
        
        private string _searchText = "";
        public string SearchText 
        { 
            get => _searchText; 
            set => this.RaiseAndSetIfChanged(ref _searchText, value); 
        }

        private bool _isLoading;
        public bool IsLoading
        {
            get => _isLoading;
            set 
            {
                this.RaiseAndSetIfChanged(ref _isLoading, value);
                this.RaisePropertyChanged(nameof(IsPaginationVisible));
            }
        }

        private string? _errorMessage;
        public string? ErrorMessage
        {
            get => _errorMessage;
            set => this.RaiseAndSetIfChanged(ref _errorMessage, value);
        }

        private bool _hasError;
        public bool HasError
        {
            get => _hasError;
            set => this.RaiseAndSetIfChanged(ref _hasError, value);
        }

        private bool _isMangaDexBlocked;
        public bool IsMangaDexBlocked
        {
            get => _isMangaDexBlocked;
            set 
            {
                this.RaiseAndSetIfChanged(ref _isMangaDexBlocked, value);
                this.RaisePropertyChanged(nameof(IsPaginationVisible));
            }
        }

        private bool _isRefreshing;
        public bool IsRefreshing
        {
            get => _isRefreshing;
            set => this.RaiseAndSetIfChanged(ref _isRefreshing, value);
        }

        // IsBusy: Controls the full-screen blocking overlay (Initial Load, Refresh, Search)
        // Does NOT track background pagination (infinite scroll)
        private bool _isBusy;
        public bool IsBusy
        {
            get => _isBusy;
            set => this.RaiseAndSetIfChanged(ref _isBusy, value);
        }

        public ReactiveCommand<Unit, Unit> OpenSettingsCommand { get; }

        // Pagination Properties
        private int _currentPage = 1;
        public int CurrentPage
        {
            get => _currentPage;
            set => this.RaiseAndSetIfChanged(ref _currentPage, value);
        }

        private int _totalPages = 1;
        public int TotalPages
        {
            get => _totalPages;
            set => this.RaiseAndSetIfChanged(ref _totalPages, value);
        }

        public string PageInfo => $"Page {CurrentPage} of {TotalPages}";
        public bool HasPrevPage => CurrentPage > 1;
        public bool HasNextPage => CurrentPage < TotalPages;
        
        private string _targetPageInput = "";
        public string TargetPageInput
        {
            get => _targetPageInput;
            set => this.RaiseAndSetIfChanged(ref _targetPageInput, value);
        }

        public ObservableCollection<MangaItem> MangaList { get; } = new();
        public bool IsSourceEmpty => MangaList.Count == 0;

        public ReactiveCommand<Unit, Unit> SearchCommand { get; }
        public ReactiveCommand<MangaItem, Unit> OpenMangaCommand { get; }
        public ReactiveCommand<Unit, Unit> BackCommand { get; }
        public ReactiveCommand<Unit, Unit> PrevPageCommand { get; }
        public ReactiveCommand<Unit, Unit> NextPageCommand { get; }
        public ReactiveCommand<Unit, Unit> GoToPageCommand { get; }
        public ReactiveCommand<Unit, Unit> LatestModeCommand { get; }
        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<SourceStatusFilterMode, Unit> SetStatusFilterCommand { get; }

        public string SourceName => _source.Name;

        private SourceStatusFilterMode _selectedStatusFilter = SourceStatusFilterMode.All;
        public SourceStatusFilterMode SelectedStatusFilter
        {
            get => _selectedStatusFilter;
            set
            {
                if (_selectedStatusFilter == value) return;

                this.RaiseAndSetIfChanged(ref _selectedStatusFilter, value);
                this.RaisePropertyChanged(nameof(IsStatusFilterActive));
                this.RaisePropertyChanged(nameof(StatusFilterText));
                this.RaisePropertyChanged(nameof(IsStatusAllSelected));
                this.RaisePropertyChanged(nameof(IsStatusOngoingSelected));
                this.RaisePropertyChanged(nameof(IsStatusCompletedSelected));
                CurrentPage = 1;
                _ = LoadMangaList(append: false, forceRefresh: true);
            }
        }

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

        public class FormatFilterItem : ReactiveObject
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
        public bool IsGenreFilterVisible => AvailableGenres.Count > 0;
        public ReactiveCommand<Unit, Unit> ClearGenreFilterCommand { get; }

        public ObservableCollection<FormatFilterItem> AvailableFormats { get; } = new();
        public bool IsFormatFilterVisible => AvailableFormats.Count > 0;
        public ReactiveCommand<Unit, Unit> ClearFormatFilterCommand { get; }

        public bool IsStatusFilterActive => SelectedStatusFilter != SourceStatusFilterMode.All;
        public bool IsAnyFilterActive => IsStatusFilterActive || AvailableGenres.Any(g => g.IsSelected) || AvailableFormats.Any(f => f.IsSelected);
        
        public string StatusFilterText => SelectedStatusFilter switch
        {
            SourceStatusFilterMode.Ongoing => "Ongoing",
            SourceStatusFilterMode.Completed => "Completed",
            _ => "Status"
        };
        public bool IsStatusAllSelected => SelectedStatusFilter == SourceStatusFilterMode.All;
        public bool IsStatusOngoingSelected => SelectedStatusFilter == SourceStatusFilterMode.Ongoing;
        public bool IsStatusCompletedSelected => SelectedStatusFilter == SourceStatusFilterMode.Completed;
        
        // Show English flag indicator for MangaDex source
        public bool IsMangaDex => _source.Name.Contains("MangaDex", System.StringComparison.OrdinalIgnoreCase);

        // Show/Hide Status filter depending on source capabilities
        public bool IsStatusFilterVisible => true;
        
        // MangaDex Language Toggle (EN/ID)
        private bool _isEnglish = true; // Default: English
        public bool IsEnglish
        {
            get => _isEnglish;
            set
            {
                this.RaiseAndSetIfChanged(ref _isEnglish, value);
                this.RaisePropertyChanged(nameof(LanguageFlag));
                this.RaisePropertyChanged(nameof(LanguageCode));
                this.RaisePropertyChanged(nameof(LanguageFlagBitmap));
            }
        }
        
        public string LanguageFlag => IsEnglish ? "🇬🇧" : "🇮🇩";
        public string LanguageCode => IsEnglish ? "EN" : "ID";
        public Bitmap? LanguageFlagBitmap => IsEnglish ? _gbFlag : _idFlag;
        public ReactiveCommand<Unit, Unit> ToggleLanguageCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleViewModeCommand { get; }

        public string IconColor => !string.IsNullOrEmpty(_source.IconBackground) ? _source.IconBackground : "#333333";
        public string IconForeground => !string.IsNullOrEmpty(_source.IconForeground) ? _source.IconForeground : "White";
        public string IconText => !string.IsNullOrEmpty(_source.Name) ? _source.Name.Substring(0, 1) : "?";
        
        private Bitmap? _iconBitmap;
        public Bitmap? IconBitmap
        {
            get => _iconBitmap;
            set => this.RaiseAndSetIfChanged(ref _iconBitmap, value);
        }

        private bool _isLatestMode = false; // Default: Directory Mode (false) vs Pustaka Mode (true)
        public bool IsLatestMode 
        { 
            get => _isLatestMode; 
            set => this.RaiseAndSetIfChanged(ref _isLatestMode, value); 
        }
        public bool IsPaginationVisible => !_isLatestMode && !IsMangaDexBlocked && !IsLoading;

        private bool _isListView;
        public bool IsListView
        {
            get => _isListView;
            set => this.RaiseAndSetIfChanged(ref _isListView, value);
        }

        private readonly NetworkService _networkService;
        private readonly Core.Services.SettingsService _settingsService;
        
        public SourceFeedViewModel(IMangaSource source, MainWindowViewModel mainVm, SourceManager sourceManager, ImageCacheService imageCacheService, NetworkService networkService, Core.Services.SettingsService settingsService)
        {
            _source = source;
            _mainVm = mainVm;
            _settingsService = settingsService;
            _isListView = _settingsService.LibraryIsListView;
            _sourceManager = sourceManager;
            _imageCacheService = imageCacheService;
            _networkService = networkService; // Store for usage

            try
            {
                _gbFlag = new Bitmap(AssetLoader.Open(new Uri("avares://Yomic/Assets/Flags/gb.png")));
                _idFlag = new Bitmap(AssetLoader.Open(new Uri("avares://Yomic/Assets/Flags/id.png")));
            }
            catch (Exception ex)
            {
                LogService.Error("SourceFeedVM", "Failed to load flag icons", ex);
                // Fallback or handle nulls if necessary, but for now we assume assets exist
            }

            if (!string.IsNullOrEmpty(_source.IconUrl))
            {
                _ = LoadIconAsync();
            }

            SearchCommand = ReactiveCommand.CreateFromTask(async () => await PerformSearch());
            OpenMangaCommand = ReactiveCommand.Create<MangaItem>(OpenManga);
            
            ClearGenreFilterCommand = ReactiveCommand.Create(() =>
            {
                foreach (var g in AvailableGenres)
                    g.IsSelected = false;
                this.RaisePropertyChanged(nameof(IsAnyFilterActive));
                CurrentPage = 1;
                _ = LoadMangaList(append: false, forceRefresh: true);
            });

            ClearFormatFilterCommand = ReactiveCommand.Create(() =>
            {
                foreach (var f in AvailableFormats)
                    f.IsSelected = false;
                this.RaisePropertyChanged(nameof(IsAnyFilterActive));
                CurrentPage = 1;
                _ = LoadMangaList(append: false, forceRefresh: true);
            });

            if (_source is IFilterableMangaSource filterable)
            {
                if (filterable.SupportsGenreFilter)
                {
                    foreach (var genre in filterable.AvailableGenres)
                    {
                        var genreItem = new GenreFilterItem { Name = genre };
                        genreItem.PropertyChanged += (s, e) =>
                        {
                            if (e.PropertyName == nameof(GenreFilterItem.IsSelected))
                            {
                                this.RaisePropertyChanged(nameof(IsAnyFilterActive));
                                CurrentPage = 1;
                                _ = LoadMangaList(append: false, forceRefresh: true);
                            }
                        };
                        AvailableGenres.Add(genreItem);
                    }
                }

                if (filterable.SupportsFormatFilter)
                {
                    foreach (var format in filterable.AvailableFormats)
                    {
                        var formatItem = new FormatFilterItem { Name = format };
                        formatItem.PropertyChanged += (s, e) =>
                        {
                            if (e.PropertyName == nameof(FormatFilterItem.IsSelected))
                            {
                                this.RaisePropertyChanged(nameof(IsAnyFilterActive));
                                CurrentPage = 1;
                                _ = LoadMangaList(append: false, forceRefresh: true);
                            }
                        };
                        AvailableFormats.Add(formatItem);
                    }
                }
            }
            
            MangaList.CollectionChanged += (s, e) => this.RaisePropertyChanged(nameof(IsSourceEmpty));

            BackCommand = ReactiveCommand.Create(() => 
            { 
                // Clear all cache for this source when leaving
                ClearSourceCache();
                _mainVm.GoToBrowse(); 
            });
            OpenSettingsCommand = ReactiveCommand.Create(() => { _mainVm.GoToSettings(); });


            // Refresh: Force reload ignoring cache
            RefreshCommand = ReactiveCommand.CreateFromTask(async () => 
            {
                IsRefreshing = true;
                try 
                {
                    // In Latest mode, always reset to page 1 so refresh shows the newest content
                    if (_isLatestMode)
                    {
                        CurrentPage = 1;
                    }
                    // Invalidate all pages for this source+mode to avoid stale cached pages on scroll
                    string cachePrefix = $"{_source.Id}:v14:";
                    _sourceManager.InvalidateCache(cachePrefix);
                    await LoadMangaList(append: false, forceRefresh: true);
                }
                finally
                {
                    IsRefreshing = false;
                }
            });

            // Latest Updates Toggle
            LatestModeCommand = ReactiveCommand.Create(() => 
            {
                IsLatestMode = !IsLatestMode;
                CurrentPage = 1;
                this.RaisePropertyChanged(nameof(IsPaginationVisible));
                _ = LoadMangaList(append: false);
            });

            SetStatusFilterCommand = ReactiveCommand.Create<SourceStatusFilterMode>(mode =>
            {
                SelectedStatusFilter = mode;
            });

            // MangaDex Language Toggle (EN/ID)
            ToggleLanguageCommand = ReactiveCommand.Create(() =>
            {
                IsEnglish = !IsEnglish;
                
                // Set MangaDexSource.SelectedLanguage via reflection (extension loaded dynamically)
                var newLang = IsEnglish ? "en" : "id";
                var sourceType = _source.GetType();
                var langProp = sourceType.GetProperty("SelectedLanguage", System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static);
                if (langProp != null)
                {
                    langProp.SetValue(null, newLang);
                    LogService.Info("SourceFeed", $"Set MangaDex language to: {newLang}");
                }
                else
                {
                    LogService.Warning("SourceFeed", $"Could not find SelectedLanguage property on {sourceType.Name}");
                }
                
                // Invalidate ALL caches for this source to force fresh data with new language
                _sourceManager.InvalidateAllCachesForSource(_source.Id);
                
                // Clear current list for immediate visual feedback
                ClearMangaItems();
                
                CurrentPage = 1;
                // Force refresh to bypass any remaining cache
                _ = LoadMangaList(append: false, forceRefresh: true);
            });

            ToggleViewModeCommand = ReactiveCommand.Create(() => 
            {
                IsListView = !IsListView;
                _settingsService.LibraryIsListView = IsListView;
                _settingsService.Save();
            });

            PrevPageCommand = ReactiveCommand.Create(() => 
            {
                if (HasPrevPage)
                {
                    CurrentPage--;
                    _ = LoadMangaList();
                }
            });
            
            NextPageCommand = ReactiveCommand.Create(() => 
            {
                if (HasNextPage)
                {
                    CurrentPage++;
                    _ = LoadMangaList(append: _isLatestMode); // Append if in Latest Mode (Infinite Scroll)
                }
            });

            GoToPageCommand = ReactiveCommand.Create(() => 
            {
                if (int.TryParse(TargetPageInput, out int target))
                {
                    // Clamp to valid bounds
                    if (target < 1) target = 1;
                    if (target > TotalPages) target = TotalPages;
                    
                    if (CurrentPage != target)
                    {
                        CurrentPage = target;
                        _ = LoadMangaList(append: false); // Direct jump replaces content
                    }
                }
                TargetPageInput = ""; // Clear input after go
            });

            // Initial Load (Fire and forget safely)
            System.Threading.Tasks.Task.Run(async () => await LoadMangaList(append: false));

            // Auto-retry when network status changes to online and we are blocked
            _networkService.StatusChanged += (s, isOnline) =>
            {
                if (isOnline && IsMangaDexBlocked)
                {
                    LogService.Debug("SourceFeedVM", "Network recovered while blocked. Auto-refreshing...");
                    Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                    {
                        RefreshCommand.Execute().Subscribe();
                    });
                }
            };
        }

        private async Task LoadPopular()
        {
            CurrentPage = 1;
            await LoadMangaList(append: false);
        }

        private System.Threading.CancellationTokenSource? _cts;

        private async Task PerformSearch()
        {
            var query = SearchText; // Capture current query at start
            
            if (string.IsNullOrWhiteSpace(query))
            {
                await LoadPopular();
                return;
            }

            // Cancel previous image loads (Popular list or previous search)
            _cts?.Cancel();
            _cts = new System.Threading.CancellationTokenSource();
            var token = _cts.Token;

            MonitorLoadingSpeed();
            IsLoading = true;
            IsBusy = true; // Block UI for search
            HasError = false;
            ErrorMessage = null;

            // Reset pagination for search
            CurrentPage = 1;
            TotalPages = 1; // Search results are currently flat 1-page lists in most sources
            
            // Only clear if query is still valid
            if (SearchText != query) return;
            
            Avalonia.Threading.Dispatcher.UIThread.Post(ClearMangaItems);
            
            this.RaisePropertyChanged(nameof(PageInfo));
            this.RaisePropertyChanged(nameof(HasPrevPage));
            this.RaisePropertyChanged(nameof(HasNextPage));

            LogService.Debug("SourceFeedVM", $"Searching for: {query}");

            // Try Cache for Search
            string cacheKey = $"SEARCH:{_source.Id}:{query}:{CurrentPage}";
            var cached = _sourceManager.GetCachedResult(cacheKey);
            if (cached != null)
            {
                LogService.Debug("SourceFeedVM", $"Search Cache Hit: {cacheKey}");
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    ReplaceMangaItems(cached.Items.Select(m => ConvertToVm(m, token)));
                    IsLoading = false;
                    IsBusy = false;
                });
                return;
            }

            try
            {
                var mangas = await _source.GetSearchMangaAsync(query, 1);
                
                // STALENESS CHECK: If user typed more while we were waiting, discard result
                if (SearchText != query) 
                {
                     LogService.Debug("SourceFeedVM", $"Discarding stale result for '{query}' (Current: '{SearchText}')");
                     return;
                }

                // Cache Search Results
                _sourceManager.SetCachedResult(cacheKey, mangas, 1);

                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    if (mangas.Count == 0)
                    {
                        // Maybe show "No results" message? For now just empty list.
                        ErrorMessage = "No results found.";
                        // HasError = true; // Optional
                    }

                    ReplaceMangaItems(mangas.Select(m => ConvertToVm(m, token)));
                });
            }
            catch (System.Exception ex)
            {
                // STALENESS CHECK
                if (SearchText != query) return;

                System.Diagnostics.Debug.WriteLine($"[SourceFeedVM] Error searching: {ex}");
                ErrorMessage = $"Search failed: {ex.Message}";
                HasError = true;
            }
            finally
            {
                // Only turn off loading if we are the latest query
                if (SearchText == query)
                {
                    IsLoading = false;
                    IsBusy = false;
                }
            }
        }
        
        private void OpenManga(MangaItem item)
        {
            // For now, we just open details. 
            // In future, we need to pass the REAL Manga object, not just the display item.
            _mainVm.GoToDetail(item);
        }

        private string GetCacheKey()
        {
             // Key format: "SourceId:Page:Mode" [Search is handled separately]
             return $"{_source.Id}:v14:{CurrentPage}:{IsLatestMode}";
        }

        private async Task LoadMangaList(bool append = false, bool forceRefresh = false)
        {
            if (IsLoading) return; // Prevent double trigger

            var selectedGenres = AvailableGenres.Where(g => g.IsSelected).Select(g => g.Name).ToList();
            var selectedFormats = AvailableFormats.Where(f => f.IsSelected).Select(f => f.Name).ToList();
            if ((SelectedStatusFilter != SourceStatusFilterMode.All || selectedGenres.Count > 0 || selectedFormats.Count > 0) && !append && !_isLatestMode)
            {
                await LoadFilteredMangaList(forceRefresh);
                return;
            }
            
            // Cancel previous image loads if we are resetting list
            if (!append)
            {
                _cts?.Cancel();
                _cts = new System.Threading.CancellationTokenSource();
            }
            var token = _cts?.Token ?? System.Threading.CancellationToken.None;

            MonitorLoadingSpeed();
            IsLoading = true;
            if (!append) IsBusy = true; // Block UI on initial load or full refresh, but NOT on append
            HasError = false;
            ErrorMessage = null;
            IsMangaDexBlocked = false; // Reset blocking flag behavior
            
            if (!append)
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(ClearMangaItems);
            }
            
            string modeName = _isLatestMode ? "Latest Updates (Pustaka)" : "Directory";
            string cacheKey = GetCacheKey();
            
            System.Diagnostics.Debug.WriteLine($"[SourceFeedVM] LoadMangaList started for {_source.Name} [{modeName}], Page {CurrentPage}, Append: {append}, Key: {cacheKey}");
            
            // CHECK CACHE (Only if not appending and not forcing refresh)
            
            if (!forceRefresh && !append) 
            {
                var cached = _sourceManager.GetCachedResult(cacheKey);
                if (cached != null)
                {
                     System.Diagnostics.Debug.WriteLine($"[SourceFeedVM] Cache Hit for {cacheKey}");
                     Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                     {
                        TotalPages = cached.TotalPages;
                        this.RaisePropertyChanged(nameof(PageInfo));
                        this.RaisePropertyChanged(nameof(HasPrevPage));
                        this.RaisePropertyChanged(nameof(HasNextPage));
                        
                        ReplaceMangaItems(cached.Items.Select(m => ConvertToVm(m, token)));
                        IsLoading = false;
                        IsBusy = false;
                     });
                     
                     // Helper: Pre-fill next page if list is small in Latest Mode
                     if (_isLatestMode && cached.Items.Count < 20 && HasNextPage)
                     {
                         // Trigger next page logic
                          Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                          {
                             // Explicitly use Unit.Default and Observer
                             NextPageCommand.Execute(System.Reactive.Unit.Default)
                                            .Subscribe(System.Reactive.Observer.Create<System.Reactive.Unit>(_ => { }));
                          });
                     }
                     return;
                }
            }

            try
            {
                // Use IFilterableMangaSource if supported
                if (_source is IFilterableMangaSource filterable)
                {
                    System.Collections.Generic.List<Manga> items;
                    int totalPages;
                    if (_isLatestMode)
                    {
                        (items, totalPages) = await filterable.GetLatestMangaAsync(CurrentPage);
                    }
                    else
                    {
                        (items, totalPages) = await filterable.GetMangaListAsync(CurrentPage);
                    }
                    
                    // Update Cache
                    _sourceManager.SetCachedResult(cacheKey, items, totalPages);
                    
                    Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                    {
                        TotalPages = totalPages;
                        this.RaisePropertyChanged(nameof(PageInfo));
                        this.RaisePropertyChanged(nameof(HasPrevPage));
                        this.RaisePropertyChanged(nameof(HasNextPage));
                        
                        AddMangaItems(items.Select(m => ConvertToVm(m, token)), append);
                    });
                    
                    LogService.Debug("SourceFeedVM", $"Fetched {items.Count} items, Total Pages: {totalPages}");
                }
                else
                {
                    // Fallback for other sources
                    var mangas = await _source.GetPopularMangaAsync(CurrentPage);
                    Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                    {
                        if (mangas.Count == 0)
                        {
                            TotalPages = CurrentPage; // Hit the end!
                        }
                        else
                        {
                            TotalPages = _source.IsHasMorePages ? 999 : CurrentPage;
                        }
                        
                        this.RaisePropertyChanged(nameof(PageInfo));
                        this.RaisePropertyChanged(nameof(HasPrevPage));
                        this.RaisePropertyChanged(nameof(HasNextPage));

                        AddMangaItems(mangas.Select(m => ConvertToVm(m, token)), append);
                    });
                    
                    LogService.Debug("SourceFeedVM", $"Fetched {mangas.Count} items, Total Pages: {TotalPages}");
                }
            }

            catch (System.Exception ex)
            {
                LogService.Error("SourceFeedVM", $"Error loading manga list: {ex.Message}", ex);
                var innerMsg = ex.InnerException != null ? $"\nDetails: {ex.InnerException.Message}" : "";
                ErrorMessage = $"Failed to load content: {ex.Message}{innerMsg}";
                HasError = true;

                // 2. Detection Logic (Error Case)
                if (IsMangaDex && _networkService.IsOnline)
                {
                    IsMangaDexBlocked = true;
                }
            }
            finally
            {
                IsLoading = false;
                if (!append) IsBusy = false;
                LogService.Debug("SourceFeedVM", $"LoadMangaList finished. IsLoading = {IsLoading}");

                // 3. Detection Logic (Empty List Case) behavior
                // REMOVED: Do not assume empty list means blocked. It could just be no results.

                // PRE-FILL Logic: If in Latest Mode (Infinite Scroll) and list is small, load next page automatically
                // This ensures enough content to enable scrolling
                if (_isLatestMode && MangaList.Count < 20 && HasNextPage)
                {
                     LogService.Debug("SourceFeedVM", $"Pre-filling: List count {MangaList.Count} is low. Loading Page {CurrentPage + 1}...");
                     // Trigger Next Page Command safely on UI thread
                     Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                     {
                        // Explicitly use Unit.Default and Observer
                        NextPageCommand.Execute(System.Reactive.Unit.Default)
                                       .Subscribe(System.Reactive.Observer.Create<System.Reactive.Unit>(_ => { }));
                     });
                }
            }
        }

        private async Task LoadFilteredMangaList(bool forceRefresh = false)
        {
            _cts?.Cancel();
            _cts = new System.Threading.CancellationTokenSource();
            var token = _cts.Token;
            var filter = SelectedStatusFilter;
            var targetPage = Math.Max(1, CurrentPage);
            var requiredMatches = targetPage * FilteredPageSize;
            var skip = (targetPage - 1) * FilteredPageSize;
            var matched = new List<MangaItem>();
            var sourcePage = 1;
            var sourceTotalPages = TotalPages > 1 ? TotalPages : 999;

            MonitorLoadingSpeed();
            IsLoading = true;
            IsBusy = true;
            HasError = false;
            ErrorMessage = null;
            IsMangaDexBlocked = false;

            Avalonia.Threading.Dispatcher.UIThread.Post(ClearMangaItems);

            try
            {
                var selectedGenres = AvailableGenres.Where(g => g.IsSelected).Select(g => g.Name).ToList();
                var selectedFormats = AvailableFormats.Where(f => f.IsSelected).Select(f => f.Name).ToList();

                if (_source is IFilterableMangaSource serverFilterable)
                {
                    if (serverFilterable.SupportsStatusFilter || serverFilterable.SupportsGenreFilter || serverFilterable.SupportsFormatFilter)
                    {
                        var status = GetStatusValue(filter);
                        var cacheKey = $"{_source.Id}:v14:{targetPage}:{filter}:{string.Join(",", selectedGenres)}:{string.Join(",", selectedFormats)}";
                        List<Manga> sourceItems;
                        int totalPages;

                        var cached = !forceRefresh ? _sourceManager.GetCachedResult(cacheKey) : null;
                        if (cached != null)
                        {
                            sourceItems = cached.Items;
                            totalPages = cached.TotalPages;
                        }
                        else
                        {
                            (sourceItems, totalPages) = await serverFilterable.GetMangaListAsync(targetPage, status, 
                                selectedGenres.Count > 0 ? selectedGenres : null,
                                selectedFormats.Count > 0 ? selectedFormats : null);
                            _sourceManager.SetCachedResult(cacheKey, sourceItems, totalPages);
                        }

                        token.ThrowIfCancellationRequested();

                        if (filter != SelectedStatusFilter)
                        {
                            return;
                        }

                        // We optionally filter locally just in case the source returned some wrong items,
                        // but we DO NOT try to enforce FilteredPageSize by fetching more pages,
                        // because the source is already paginating for us.
                        var filteredPageItems = sourceItems
                            .Where(m => MatchesStatusFilter(m.Status, filter) || m.Status == Manga.UNKNOWN)
                            .Select(m => ConvertToVm(m, token))
                            .ToList();

                        Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                        {
                            _allMangaItems.Clear();
                            _allMangaItems.AddRange(filteredPageItems);
                            MangaList.Clear();
                            foreach (var item in filteredPageItems)
                            {
                                MangaList.Add(item);
                            }

                            TotalPages = totalPages;
                            this.RaisePropertyChanged(nameof(PageInfo));
                            this.RaisePropertyChanged(nameof(HasPrevPage));
                            this.RaisePropertyChanged(nameof(HasNextPage));
                            this.RaisePropertyChanged(nameof(IsSourceEmpty));

                            if (filteredPageItems.Count == 0)
                            {
                                ErrorMessage = $"No {StatusFilterText.ToLowerInvariant()} manga found on this page.";
                            }
                        });
                        return;
                    }
                }

                while (matched.Count < requiredMatches && sourcePage <= sourceTotalPages)
                {
                    token.ThrowIfCancellationRequested();

                    var cacheKey = $"{_source.Id}:v14:{sourcePage}:{IsLatestMode}";
                    List<Manga> sourceItems;
                    int totalPages;

                    var cached = !forceRefresh ? _sourceManager.GetCachedResult(cacheKey) : null;
                    if (cached != null)
                    {
                        sourceItems = cached.Items;
                        totalPages = cached.TotalPages;
                    }
                    else
                    {
                        if (_source is IFilterableMangaSource filterable)
                        {
                            (sourceItems, totalPages) = await filterable.GetMangaListAsync(sourcePage);
                        }
                        else
                        {
                            sourceItems = await _source.GetPopularMangaAsync(sourcePage);
                            totalPages = sourceItems.Count == 0 ? sourcePage : (_source.IsHasMorePages ? 999 : sourcePage);
                        }

                        _sourceManager.SetCachedResult(cacheKey, sourceItems, totalPages);
                    }

                    sourceTotalPages = totalPages;
                    if (sourceItems.Count == 0)
                    {
                        break;
                    }

                    var pageItems = sourceItems.Select(m => ConvertToVm(m, token)).ToList();
                    await EnsureStatusesAsync(pageItems);
                    matched.AddRange(pageItems.Where(item => 
                        MatchesStatusFilter(item, filter) && 
                        (selectedGenres.Count == 0 || selectedGenres.All(g => item.Genres != null && item.Genres.Any(x => string.Equals(x, g, StringComparison.OrdinalIgnoreCase))))
                    ));

                    sourcePage++;
                }

                if (filter != SelectedStatusFilter)
                {
                    return;
                }

                var pageItemsToShow = matched
                    .Skip(skip)
                    .Take(FilteredPageSize)
                    .ToList();

                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    _allMangaItems.Clear();
                    _allMangaItems.AddRange(pageItemsToShow);
                    MangaList.Clear();
                    foreach (var item in pageItemsToShow)
                    {
                        MangaList.Add(item);
                    }

                    TotalPages = Math.Max(targetPage, sourceTotalPages);
                    this.RaisePropertyChanged(nameof(PageInfo));
                    this.RaisePropertyChanged(nameof(HasPrevPage));
                    this.RaisePropertyChanged(nameof(HasNextPage));
                    this.RaisePropertyChanged(nameof(IsSourceEmpty));

                    if (pageItemsToShow.Count == 0)
                    {
                        ErrorMessage = $"No {StatusFilterText.ToLowerInvariant()} manga found on this page.";
                    }
                });
            }
            catch (OperationCanceledException)
            {
            }
            catch (Exception ex)
            {
                LogService.Error("SourceFeedVM", $"Error loading filtered manga list: {ex.Message}", ex);
                ErrorMessage = $"Failed to load filtered content: {ex.Message}";
                HasError = true;
            }
            finally
            {
                IsLoading = false;
                IsBusy = false;
            }
        }

        private MangaItem ConvertToVm(Manga m, System.Threading.CancellationToken token = default)
        {
            var vm = new MangaItem
            {
                Title = m.Title,
                CoverUrl = m.ThumbnailUrl,
                SourceId = _source.Id,
                MangaUrl = m.Url,
                LastUpdate = m.LastUpdate,
                Status = m.Status
            };
            
            if (_statusCache.TryGetValue(GetStatusCacheKey(vm.MangaUrl), out var cachedStatus) && cachedStatus != Manga.UNKNOWN)
            {
                vm.Status = cachedStatus;
            }

            return vm;
        }

        private void ClearMangaItems()
        {
            _allMangaItems.Clear();
            MangaList.Clear();
            this.RaisePropertyChanged(nameof(IsSourceEmpty));
        }

        private void ReplaceMangaItems(IEnumerable<MangaItem> items)
        {
            _allMangaItems.Clear();
            _allMangaItems.AddRange(items);
            _ = ApplyStatusFilterAsync();
        }

        private void AddMangaItems(IEnumerable<MangaItem> items, bool append)
        {
            if (!append)
            {
                _allMangaItems.Clear();
            }

            foreach (var item in items)
            {
                if (!append || !_allMangaItems.Any(x => x.MangaUrl == item.MangaUrl))
                {
                    _allMangaItems.Add(item);
                }
            }

            _ = ApplyStatusFilterAsync();
        }

        private async Task ApplyStatusFilterAsync()
        {
            var filter = SelectedStatusFilter;
            var snapshot = _allMangaItems.ToList();

            if (filter != SourceStatusFilterMode.All)
            {
                await EnsureStatusesAsync(snapshot);
            }

            if (filter != SelectedStatusFilter)
            {
                return;
            }

            var filtered = snapshot.Where(item => MatchesStatusFilter(item, filter)).ToList();
            if (filter != SourceStatusFilterMode.All)
            {
                filtered = filtered.Take(FilteredPageSize).ToList();
            }

            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                MangaList.Clear();
                foreach (var item in filtered)
                {
                    MangaList.Add(item);
                }
                this.RaisePropertyChanged(nameof(IsSourceEmpty));
            });
        }

        private async Task EnsureStatusesAsync(List<MangaItem> items)
        {
            var targets = items
                .Where(item => item.Status == Manga.UNKNOWN && !string.IsNullOrWhiteSpace(item.MangaUrl))
                .ToList();

            if (targets.Count == 0)
            {
                return;
            }

            using var semaphore = new System.Threading.SemaphoreSlim(4);
            var tasks = targets.Select(async item =>
            {
                var cacheKey = GetStatusCacheKey(item.MangaUrl);
                if (_statusCache.TryGetValue(cacheKey, out var cachedStatus))
                {
                    if (cachedStatus != Manga.UNKNOWN)
                    {
                        await Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(() => item.Status = cachedStatus);
                    }
                    return;
                }

                await semaphore.WaitAsync();
                try
                {
                    var details = await _source.GetMangaDetailsAsync(item.MangaUrl);
                    var status = details.Status;
                    _statusCache[cacheKey] = status;

                    if (status != Manga.UNKNOWN)
                    {
                        await Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(() => item.Status = status);
                    }
                }
                catch (Exception ex)
                {
                    _statusCache[cacheKey] = Manga.UNKNOWN;
                    LogService.Warning("SourceFeedVM", $"Could not resolve status for {item.Title}: {ex.Message}");
                }
                finally
                {
                    semaphore.Release();
                }
            });

            await Task.WhenAll(tasks);
        }

        private static bool MatchesStatusFilter(MangaItem item, SourceStatusFilterMode filter)
        {
            return MatchesStatusFilter(item.Status, filter);
        }

        private static bool MatchesStatusFilter(int status, SourceStatusFilterMode filter)
        {
            return filter switch
            {
                SourceStatusFilterMode.Ongoing => status == Manga.ONGOING,
                SourceStatusFilterMode.Completed => status == Manga.COMPLETED || status == Manga.PUBLISHING_FINISHED,
                _ => true
            };
        }

        private static int GetStatusValue(SourceStatusFilterMode filter)
        {
            return filter switch
            {
                SourceStatusFilterMode.Ongoing => Manga.ONGOING,
                SourceStatusFilterMode.Completed => Manga.COMPLETED,
                _ => Manga.UNKNOWN
            };
        }

        private string GetStatusCacheKey(string mangaUrl)
        {
            return $"{_source.Id}:{mangaUrl}";
        }

        private bool _hasShownVpnTip = false;

        private void MonitorLoadingSpeed()
        {
            if (_hasShownVpnTip || !IsMangaDex) return;

            Task.Delay(8000).ContinueWith(t => 
            {
                if (IsLoading && _networkService.IsOnline)
                {
                     Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                     {
                         if (IsLoading && !_hasShownVpnTip) // Double check
                         {
                             _mainVm.ShowNotification("Loading taking too long? Try enabling DNS over HTTPS in Settings.", NotificationType.Warning);
                             _hasShownVpnTip = true;
                         }
                     });
                }
            });
        }

        /// <summary>
        /// Clears all cache (images and data) for the current source.
        /// Called when navigating back to free up memory.
        /// </summary>
        private void ClearSourceCache()
        {
            try
            {
                // 1. Clear image cache for this source
                _imageCacheService.ClearForSource(_source.BaseUrl);
                
                // 2. Clear data cache from SourceManager
                _sourceManager.InvalidateAllCachesForSource(_source.Id);
                
                // 3. Clear MangaList
                MangaList.Clear();
                
                // Force GC to reclaim memory
                GC.Collect(0, GCCollectionMode.Optimized);
                
                LogService.Info("SourceFeed", $"Cleared cache for source: {_source.Name}");
            }
            catch (Exception ex)
            {
                LogService.Error("SourceFeed", $"Error clearing cache: {ex.Message}", ex);
            }
        }

        public void Dispose()
        {
            // Fully purge source cache and bitmaps when disposed
            ClearSourceCache();
            _cts?.Cancel();
            _cts?.Dispose();
            
            _gbFlag?.Dispose();
            _idFlag?.Dispose();

            System.Diagnostics.Debug.WriteLine("[SourceFeedVM] Disposed and memory references cleared.");
        }

        private async Task LoadIconAsync()
        {
            var url = _source.IconUrl;
            if (string.IsNullOrEmpty(url)) return;

            try
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                var iconsDir = System.IO.Path.Combine(appData, "Yomic", "Icons");
                if (!System.IO.Directory.Exists(iconsDir)) System.IO.Directory.CreateDirectory(iconsDir);

                var iconFile = System.IO.Path.Combine(iconsDir, $"{_source.Id}.png");
                byte[] bytes;

                if (System.IO.File.Exists(iconFile))
                {
                    bytes = await System.IO.File.ReadAllBytesAsync(iconFile);
                }
                else
                {
                    if (_source is Core.Sources.HttpSource httpSource && httpSource.CookieContainer.Count > 0)
                    {
                        using var handler = new System.Net.Http.HttpClientHandler 
                        { 
                            CookieContainer = httpSource.CookieContainer,
                            UseCookies = true
                        };
                        using var client = new System.Net.Http.HttpClient(handler);
                        client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36");
                        bytes = await client.GetByteArrayAsync(url);
                    }
                    else
                    {
                        using var optClient = _networkService.CreateOptimizedHttpClient();
                        bytes = await optClient.GetByteArrayAsync(url);
                    }
                    await System.IO.File.WriteAllBytesAsync(iconFile, bytes);
                }

                using var stream = new System.IO.MemoryStream(bytes);
                var bitmap = new Bitmap(stream);
                
                Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                {
                    IconBitmap = bitmap;
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[SourceFeedVM] Icon load failed for {_source.Name}: {ex.Message}");
            }
        }
    }
}
