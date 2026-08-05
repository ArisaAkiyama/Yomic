using ReactiveUI;
using System;
using Yomic.Core.Models;
using System.Linq;
using System.Reactive;
using System.Collections.Generic;
using Avalonia.Media.Imaging;
using Avalonia.Threading;
using Yomic.Core.Services;
using Yomic.Core.Helpers;
using Avalonia.Collections;
using Avalonia.Controls;

namespace Yomic.ViewModels
{
    public enum ChapterFilterMode
    {
        All,
        Unread,
        Bookmarked
    }

    public class ChapterItem : ReactiveObject
    {
        // ... (existing code)
        public string Title { get; set; } = string.Empty;
        public float ChapterNumber { get; set; }
        public string Url { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string FullDateString { get; set; } = string.Empty;
        public long DateUpload { get; set; }
        private bool _isRead;
        public bool IsRead 
        { 
            get => _isRead; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _isRead, value);
                // Auto-clear NEW badge when marked as Read
                if (value && IsNewRelease) IsNewRelease = false;
            }
        }

        private bool _bookmark;
        public bool Bookmark
        {
            get => _bookmark;
            set => this.RaiseAndSetIfChanged(ref _bookmark, value);
        }

        private bool _isNewRelease;
        public bool IsNewRelease 
        { 
            get => _isNewRelease; 
            set => this.RaiseAndSetIfChanged(ref _isNewRelease, value); 
        }

        private bool _isLastRead;
        public bool IsLastRead 
        { 
            get => _isLastRead; 
            set => this.RaiseAndSetIfChanged(ref _isLastRead, value); 
        }
        public Manga? MangaRef { get; set; }
        
        private int _additionalChaptersCount;
        public int AdditionalChaptersCount
        {
            get => _additionalChaptersCount;
            set
            {
                this.RaiseAndSetIfChanged(ref _additionalChaptersCount, value);
                this.RaisePropertyChanged(nameof(HasAdditionalChapters));
                this.RaisePropertyChanged(nameof(AdditionalChaptersText));
            }
        }
        
        public bool HasAdditionalChapters => AdditionalChaptersCount > 0;

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

        public string AdditionalChaptersText
        {
            get
            {
                var format = GetResourceString("String.AdditionalChaptersFormat", "+{0} more");
                return string.Format(format, AdditionalChaptersCount);
            }
        }

        private bool _isDownloaded;
        public bool IsDownloaded
        {
            get => _isDownloaded;
            set => this.RaiseAndSetIfChanged(ref _isDownloaded, value);
        }

        private bool _isDownloading;
        public bool IsDownloading
        {
            get => _isDownloading;
            set => this.RaiseAndSetIfChanged(ref _isDownloading, value);
        }

        private bool _isDeleting;
        public bool IsDeleting
        {
            get => _isDeleting;
            set => this.RaiseAndSetIfChanged(ref _isDeleting, value);
        }

        public ReactiveCommand<Unit, Unit> DownloadCommand { get; }
        public ReactiveCommand<Unit, Unit> DeleteCommand { get; }
        
        // Context Menu Commands
        public ReactiveCommand<Unit, Unit> MarkAsReadCommand { get; }
        public ReactiveCommand<Unit, Unit> MarkAsUnreadCommand { get; }
        public ReactiveCommand<Unit, Unit> MarkPreviousAsReadCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleBookmarkCommand { get; }

        public ChapterItem(Action? downloadAction, Action? deleteAction, 
                           Func<System.Threading.Tasks.Task>? markReadAction, 
                           Func<System.Threading.Tasks.Task>? markUnreadAction, 
                           Func<System.Threading.Tasks.Task>? markPreviousAction,
                           Func<System.Threading.Tasks.Task>? toggleBookmarkAction = null)
        {
            var canDownload = this.WhenAnyValue(x => x.IsDownloaded, downloaded => !downloaded);
            DownloadCommand = ReactiveCommand.Create(downloadAction ?? (() => { }), canDownload);

            var canDelete = this.WhenAnyValue(x => x.IsDownloaded);
            DeleteCommand = ReactiveCommand.Create(deleteAction ?? (() => { }), canDelete);
            
            MarkAsReadCommand = ReactiveCommand.CreateFromTask(markReadAction ?? (() => System.Threading.Tasks.Task.CompletedTask));
            MarkAsUnreadCommand = ReactiveCommand.CreateFromTask(markUnreadAction ?? (() => System.Threading.Tasks.Task.CompletedTask));
            MarkPreviousAsReadCommand = ReactiveCommand.CreateFromTask(markPreviousAction ?? (() => System.Threading.Tasks.Task.CompletedTask));
            ToggleBookmarkCommand = ReactiveCommand.CreateFromTask(toggleBookmarkAction ?? (() => System.Threading.Tasks.Task.CompletedTask));
        }
    }

    // Header item for virtualization
    public class MangaDetailHeader { public MangaDetailViewModel ViewModel { get; } public MangaDetailHeader(MangaDetailViewModel vm) => ViewModel = vm; }

    public enum DownloadAllMode
    {
        NotDownloaded,
        UnreadNotDownloaded,
        ExportZipPdf,
        ExportZipPdfUnread
    }

    public class DownloadAllDialogInfo
    {
        public string MangaTitle { get; set; } = string.Empty;
        public int TotalChapters { get; set; }
        public int NotDownloadedCount { get; set; }
        public int UnreadNotDownloadedCount { get; set; }
    }

    public class MangaDetailViewModel : ViewModelBase, IDisposable
    {
        // ... (existing properties)
        public string Title { get; set; } = string.Empty;
        
        // Collection for UI (Header + Chapters)
        // Collection for UI (Header + Chapters)
        // DisplayItems defined below as AvaloniaList
        public long SourceId => _model?.Source ?? 0;
        public string SourceName => _sourceManager?.GetSource(SourceId)?.Name ?? "Unknown";
        public string Url => _model?.Url ?? string.Empty;
        public string SourceIconUrl => _sourceManager?.GetSource(SourceId)?.IconUrl ?? string.Empty;

        private Avalonia.Media.Imaging.Bitmap? _sourceIconBitmap;
        public Avalonia.Media.Imaging.Bitmap? SourceIconBitmap
        {
            get => _sourceIconBitmap;
            set => this.RaiseAndSetIfChanged(ref _sourceIconBitmap, value);
        }
        
        private string _author = "Loading...";
        public string Author { get => _author; set => this.RaiseAndSetIfChanged(ref _author, value); }
        
        private string _status = "";
        public string Status { get => _status; set => this.RaiseAndSetIfChanged(ref _status, value); }
        
        private string _description = "Loading details...";
        public string Description 
        { 
            get => _description; 
            set 
            { 
                this.RaiseAndSetIfChanged(ref _description, value); 
                ParseRatingFromDescription();
            } 
        }

        private double? _rating;
        public double? Rating
        {
            get => _rating;
            set
            {
                this.RaiseAndSetIfChanged(ref _rating, value);
                this.RaisePropertyChanged(nameof(HasRating));
                this.RaisePropertyChanged(nameof(Star1Char));
                this.RaisePropertyChanged(nameof(Star2Char));
                this.RaisePropertyChanged(nameof(Star3Char));
                this.RaisePropertyChanged(nameof(Star4Char));
                this.RaisePropertyChanged(nameof(Star5Char));
                this.RaisePropertyChanged(nameof(RatingText));
            }
        }

        public bool HasRating => Rating.HasValue && Rating.Value > 0;
        
        public string RatingText => Rating.HasValue ? Rating.Value.ToString("0.0") : "";

        public string Star1Char => GetStarChar(0);
        public string Star2Char => GetStarChar(1);
        public string Star3Char => GetStarChar(2);
        public string Star4Char => GetStarChar(3);
        public string Star5Char => GetStarChar(4);

        private string GetStarChar(int index)
        {
            if (!Rating.HasValue) return ""; // Empty overlay
            double score = Rating.Value / 2.0; // scale 10 to 5
            double diff = score - index;

            if (diff >= 0.75) return "M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z"; // Filled star overlay
            if (diff >= 0.25) return "M12 1a.993 .993 0 0 1 .823 .443l.067 .116l2.852 5.781l6.38 .925c.741 .108 1.08 .94 .703 1.526l-.07 .095l-.078 .086l-4.624 4.499l1.09 6.355a1.001 1.001 0 0 1 -1.249 1.135l-.101 -.035l-.101 -.046l-5.693 -3l-5.706 3c-.105 .055 -.212 .09 -.32 .106l-.106 .01a1.003 1.003 0 0 1 -1.038 -1.06l.013 -.11l1.09 -6.355l-4.623 -4.5a1.001 1.001 0 0 1 .328 -1.647l.113 -.036l.114 -.023l6.379 -.925l2.853 -5.78a.968 .968 0 0 1 .904 -.56zm0 3.274v12.476a1 1 0 0 1 .239 .029l.115 .036l.112 .05l4.363 2.299l-.836 -4.873a1 1 0 0 1 .136 -.696l.07 -.099l.082 -.09l3.546 -3.453l-4.891 -.708a1 1 0 0 1 -.62 -.344l-.073 -.097l-.06 -.106l-2.183 -4.424z"; // Half star overlay
            return ""; // Empty overlay
        }

        private void ParseRatingFromDescription()
        {
            if (string.IsNullOrEmpty(_description))
            {
                Rating = null;
                return;
            }

            var match = System.Text.RegularExpressions.Regex.Match(_description, @"Rating:\s*([0-9.]+)(/10)?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (match.Success)
            {
                if (double.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out double val))
                {
                    Rating = val;
                    var cleaned = _description.Replace(match.Value, "").Trim();
                    cleaned = System.Text.RegularExpressions.Regex.Replace(cleaned, @"\r?\n\r?\n+", "\n\n");
                    _description = cleaned;
                    this.RaisePropertyChanged(nameof(Description));
                    return;
                }
            }
            Rating = null;
        }

        private bool _inLibrary;
        public bool InLibrary { get => _inLibrary; set => this.RaiseAndSetIfChanged(ref _inLibrary, value); }
        
        public List<string> Tags { get; set; } = new();
        
        private List<string> _genres = new();
        public List<string> Genres 
        { 
            get => _genres; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _genres, value);
                this.RaisePropertyChanged(nameof(IsMatureContent));
                this.RaisePropertyChanged(nameof(MatureWarningText));
                this.RaisePropertyChanged(nameof(MatureWarningColor));
                this.RaisePropertyChanged(nameof(IsExplicitContent));
            }
        }
        
        public string? ThumbnailUrl => _model?.ThumbnailUrl;
        
        // RED - Explicit/dangerous content (18+)
        private static readonly HashSet<string> ExplicitGenres = new(StringComparer.OrdinalIgnoreCase)
        {
            "Mature", "Adult", "Smut", "Hentai", "Ecchi", 
            "Gore", "Guro", "R-18", "18+"
        };
        
        // YELLOW - Adult target demographics (softer warning)
        private static readonly HashSet<string> AdultTargetGenres = new(StringComparer.OrdinalIgnoreCase)
        {
            "Seinen", "Josei"
        };
        
        public bool IsExplicitContent => Genres.Any(g => ExplicitGenres.Contains(g));
        public bool IsMatureContent => Genres.Any(g => ExplicitGenres.Contains(g) || AdultTargetGenres.Contains(g));
        
        public string MatureWarningText 
        {
            get
            {
                // Prioritize explicit genres first
                var explicitGenre = Genres.FirstOrDefault(g => ExplicitGenres.Contains(g));
                if (explicitGenre != null) return explicitGenre;
                
                var adultGenre = Genres.FirstOrDefault(g => AdultTargetGenres.Contains(g));
                if (adultGenre != null) return adultGenre;
                
                return "18+";
            }
        }
        
        // Return color based on content type: Red for explicit, Yellow for adult target
        public string MatureWarningColor => IsExplicitContent ? "#F38BA8" : "#F9E2AF";
        
        private List<ChapterItem> _chapters = new();
        public List<ChapterItem> Chapters 
        {
            get => _chapters;
            set 
            {
                this.RaiseAndSetIfChanged(ref _chapters, value);
                UpdateDisplayItems();
            }
        }

        private ChapterFilterMode _chapterFilter = ChapterFilterMode.All;
        public ChapterFilterMode ChapterFilter
        {
            get => _chapterFilter;
            set
            {
                this.RaiseAndSetIfChanged(ref _chapterFilter, value);
                this.RaisePropertyChanged(nameof(IsFilterAll));
                this.RaisePropertyChanged(nameof(IsFilterUnread));
                this.RaisePropertyChanged(nameof(IsFilterBookmarked));
                UpdateDisplayItems();
            }
        }

        public bool IsFilterAll => ChapterFilter == ChapterFilterMode.All;
        public bool IsFilterUnread => ChapterFilter == ChapterFilterMode.Unread;
        public bool IsFilterBookmarked => ChapterFilter == ChapterFilterMode.Bookmarked;

        public IEnumerable<ChapterItem> FilteredChapters
        {
            get
            {
                if (_chapters == null) return Enumerable.Empty<ChapterItem>();
                
                return _chapters.Where(c => 
                {
                    if (ChapterFilter == ChapterFilterMode.Unread) return !c.IsRead;
                    if (ChapterFilter == ChapterFilterMode.Bookmarked) return c.Bookmark;
                    return true;
                });
            }
        }

        public int VisibleChaptersCount => FilteredChapters.Count();

        public AvaloniaList<ChapterItem> FilteredChaptersList { get; } = new();

        private void UpdateDisplayItems()
        {
            if (_chapters == null) return;

            var filteredChapters = FilteredChapters.ToList();

            // Synchronize FilteredChaptersList with filteredChapters
            // This prevents scroll jumps by avoiding Clear() / Reset
            
            int displayIdx = 0;
            int chapterIdx = 0;

            while (chapterIdx < filteredChapters.Count)
            {
                if (displayIdx < FilteredChaptersList.Count)
                {
                    // Existing slot: Replace if different
                    if (FilteredChaptersList[displayIdx] != filteredChapters[chapterIdx])
                    {
                        FilteredChaptersList[displayIdx] = filteredChapters[chapterIdx];
                    }
                    displayIdx++;
                }
                else
                {
                    // Append remaining
                    FilteredChaptersList.Add(filteredChapters[chapterIdx]);
                    displayIdx++;
                }
                chapterIdx++;
            }

            // Remove excess items if FilteredChaptersList is longer than needed
            if (displayIdx < FilteredChaptersList.Count)
            {
                FilteredChaptersList.RemoveRange(displayIdx, FilteredChaptersList.Count - displayIdx);
            }
            
            this.RaisePropertyChanged(nameof(VisibleChaptersCount));
        }

        public ReactiveCommand<Unit, Unit> ToggleLibraryCommand { get; }
        public ReactiveCommand<Unit, Unit> DownloadAllCommand { get; }
        public ReactiveCommand<Unit, Unit> DeleteAllDownloadsCommand { get; }
        public ReactiveCommand<Unit, Unit> StartReadingCommand { get; }
        public ReactiveCommand<ChapterItem?, Unit> ResumeReadingCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenWebViewCommand { get; }
        public ReactiveCommand<string, Unit> SetChapterFilterCommand { get; }

        public bool HasDownloadedChapters => Chapters != null && Chapters.Any(c => c.IsDownloaded);
        
        private bool _isBypassing;
        public bool IsBypassing
        {
            get => _isBypassing;
            set => this.RaiseAndSetIfChanged(ref _isBypassing, value);
        }

        private string _bypassMessage = string.Empty;
        public string BypassMessage
        {
            get => _bypassMessage;
            set => this.RaiseAndSetIfChanged(ref _bypassMessage, value);
        }

        // Context Menu Commands moved to ChapterItem

        private readonly Core.Models.Manga _model;
        private readonly LibraryService _libraryService;
        private readonly NetworkService _networkService;
        private readonly DownloadService _downloadService;
        public Func<DownloadAllDialogInfo, System.Threading.Tasks.Task<DownloadAllMode?>>? ShowDownloadAllDialogAsync { get; set; }
        
        private bool _isOnline = true;
        public bool IsOnline { get => _isOnline; set => this.RaiseAndSetIfChanged(ref _isOnline, value); }
        
        private bool _isLoadingChapters = true;
        public bool IsLoadingChapters { get => _isLoadingChapters; set => this.RaiseAndSetIfChanged(ref _isLoadingChapters, value); }

        public bool IsOfflineAndNotDownloaded => !IsOnline && !InLibrary;

        // Synopsis Expand/Collapse
        private bool _isSynopsisExpanded;
        public bool IsSynopsisExpanded 
        { 
            get => _isSynopsisExpanded; 
            set => this.RaiseAndSetIfChanged(ref _isSynopsisExpanded, value); 
        }
        public ReactiveCommand<Unit, Unit> ToggleSynopsisCommand { get; }

        // Start/Resume Button Properties
        private bool _hasStartedReading;
        public bool HasStartedReading 
        { 
            get => _hasStartedReading; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _hasStartedReading, value);
                this.RaisePropertyChanged(nameof(ResumeButtonText));
                this.RaisePropertyChanged(nameof(CanResume));
            }
        }
        
        private string _lastReadChapterTitle = string.Empty;
        public string LastReadChapterTitle 
        { 
            get => _lastReadChapterTitle; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _lastReadChapterTitle, value);
            }
        }

        private ChapterItem? _nextChapterToRead;
        public ChapterItem? NextChapterToRead 
        { 
            get => _nextChapterToRead; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _nextChapterToRead, value);
                this.RaisePropertyChanged(nameof(ResumeButtonText));
                this.RaisePropertyChanged(nameof(CanResume));
            }
        }

        /// <summary>
        /// Text displayed on the Resume button with chapter info (e.g., "Resume Ch. 5")
        /// </summary>
        /// <summary>
        /// Text displayed on the Resume button with chapter info (e.g., "Resume Ch. 5")
        /// </summary>
        public string ResumeButtonText => NextChapterToRead != null 
            ? $"{(HasStartedReading ? "Resume" : "Start")} {NextChapterToRead.Title}" 
            : (HasStartedReading ? "Resume" : "Start Reading");

        /// <summary>
        /// Whether Resume button should be visible/enabled (only if user has read history)
        /// </summary>
        private TrackerIds? _trackerIds;
        public TrackerIds? TrackerIds
        {
            get => _trackerIds;
            set => this.RaiseAndSetIfChanged(ref _trackerIds, value);
        }

        private bool _isResolvingTrackers;
        public bool IsResolvingTrackers
        {
            get => _isResolvingTrackers;
            set => this.RaiseAndSetIfChanged(ref _isResolvingTrackers, value);
        }

        private bool _hasTrackerIds;
        public bool HasTrackerIds
        {
            get => _hasTrackerIds;
            set => this.RaiseAndSetIfChanged(ref _hasTrackerIds, value);
        }

        public bool IsMyAnimeListVisible => TrackerIds?.MyAnimeListId != null && !string.IsNullOrEmpty(TrackerIds.MyAnimeListId);
        public bool IsAniListVisible => TrackerIds?.AniListId != null && !string.IsNullOrEmpty(TrackerIds.AniListId);
        public bool IsMangaUpdatesVisible => TrackerIds?.MangaUpdatesId != null && !string.IsNullOrEmpty(TrackerIds.MangaUpdatesId);

        public string MyAnimeListUrl => TrackerIds?.MyAnimeListId != null ? $"https://myanimelist.net/manga/{TrackerIds.MyAnimeListId}" : string.Empty;
        public string AniListUrl => TrackerIds?.AniListId != null ? $"https://anilist.co/manga/{TrackerIds.AniListId}" : string.Empty;
        public string MangaUpdatesUrl => TrackerIds?.MangaUpdatesId != null ? $"https://www.mangaupdates.com/series.html?id={TrackerIds.MangaUpdatesId}" : string.Empty;

        public ReactiveCommand<string, Unit> OpenTrackerLinkCommand { get; }

        public bool CanResume => HasStartedReading;

        private readonly Core.Services.ImageCacheService _imageCacheService;
        private readonly MangaItem _sourceItem; // Store source item for realtime update

        private readonly MainWindowViewModel _mainVM;
        private readonly SourceManager _sourceManager; // Store SourceManager

        // Sorting
        private bool _sortAscending = false; // Default: Newest First (Descending)
        public bool SortAscending
        {
            get => _sortAscending;
            set
            {
                this.RaiseAndSetIfChanged(ref _sortAscending, value);
                SortChapters();
            }
        }
        
        public ReactiveCommand<Unit, Unit> ToggleSortCommand { get; }

        public MangaDetailViewModel(MangaItem item, MainWindowViewModel mainVM, SourceManager sourceManager, LibraryService libraryService, NetworkService networkService, DownloadService downloadService, ImageCacheService imageCacheService)
        {
            _mainVM = mainVM;
            _sourceManager = sourceManager; // Store it
            _model = new Core.Models.Manga 
            { 
                Source = item.SourceId, 
                Url = item.MangaUrl, 
                Title = item.Title,
                ThumbnailUrl = item.CoverUrl
            };
            _libraryService = libraryService;
            _networkService = networkService;
            _downloadService = downloadService;
            _imageCacheService = imageCacheService; // Store injected service
            _sourceItem = item; // Store reference to source item

            IsOnline = _networkService.IsOnline;
            _networkService.StatusChanged += (s, online) => 
            {
                Dispatcher.UIThread.Post(() => 
                {
                    IsOnline = online;
                    this.RaisePropertyChanged(nameof(IsOfflineAndNotDownloaded));
                });
            };

            Title = item.Title;
            _ = LoadSourceIcon();
            
            ToggleLibraryCommand = ReactiveCommand.CreateFromTask(ToggleLibrary);
            RefreshCommand = ReactiveCommand.CreateFromTask(RefreshAsync);
            DownloadAllCommand = ReactiveCommand.CreateFromTask(ConfirmDownloadAllChapters);
            DeleteAllDownloadsCommand = ReactiveCommand.CreateFromTask(DeleteAllDownloadedChaptersAsync);
            StartReadingCommand = ReactiveCommand.Create(StartReading);
            ResumeReadingCommand = ReactiveCommand.Create<ChapterItem?>(ResumeReading);
            OpenWebViewCommand = ReactiveCommand.CreateFromTask(async () => 
            {
                var url = _model.Url;
                if (string.IsNullOrEmpty(url)) return;

                // If URL is relative, prepend BaseUrl from source
                if (!url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    var source = _sourceManager.GetSource(SourceId);
                    if (source != null)
                    {
                        var baseUrl = source.BaseUrl.TrimEnd('/');
                        if (!url.StartsWith("/")) url = "/" + url;
                        url = baseUrl + url;
                    }
                }

                if (string.IsNullOrEmpty(url)) return;

                try
                {
                    Console.WriteLine($"[MangaDetailVM] Opening external browser for {Title} ({url})...");
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[MangaDetailVM] Error opening external browser: {ex.Message}");
                }
            });
            SetChapterFilterCommand = ReactiveCommand.Create<string>(SetChapterFilter);

            // Subscribe to Cloudflare bypass status updates
            CloudflareBypassService.Instance.OnStatusUpdate += (msg) =>
            {
                Dispatcher.UIThread.Post(() =>
                {
                    BypassMessage = msg;
                });
            };

            OpenTrackerLinkCommand = ReactiveCommand.Create<string>(url =>
            {
                if (string.IsNullOrEmpty(url)) return;
                try
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = url,
                        UseShellExecute = true
                    });
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[MangaDetailVM] Error opening tracker: {ex.Message}");
                }
            });

            ToggleSortCommand = ReactiveCommand.Create(() => { SortAscending = !SortAscending; });
            ToggleSynopsisCommand = ReactiveCommand.Create(() => { IsSynopsisExpanded = !IsSynopsisExpanded; });

            UpdateDisplayItems(); // Init header

            // Subscribe to Download Status Changes
            _downloadService.StatusChanged += OnDownloadStatusChanged;

            // Fire and forget load & tracker resolution
            System.Threading.Tasks.Task.Run(async () => await LoadDetails(item, sourceManager));
            System.Threading.Tasks.Task.Run(async () => await ResolveTrackersAsync(item.Title));
        }

        private async System.Threading.Tasks.Task ResolveTrackersAsync(string title)
        {
            Dispatcher.UIThread.Post(() => IsResolvingTrackers = true);
            try
            {
                var ids = await MangaDexResolverService.ResolveTrackerIdsAsync(title);
                Dispatcher.UIThread.Post(() =>
                {
                    TrackerIds = ids;
                    HasTrackerIds = ids != null && (!string.IsNullOrEmpty(ids.MyAnimeListId) || !string.IsNullOrEmpty(ids.AniListId) || !string.IsNullOrEmpty(ids.MangaUpdatesId));
                    this.RaisePropertyChanged(nameof(IsMyAnimeListVisible));
                    this.RaisePropertyChanged(nameof(IsAniListVisible));
                    this.RaisePropertyChanged(nameof(IsMangaUpdatesVisible));
                    this.RaisePropertyChanged(nameof(MyAnimeListUrl));
                    this.RaisePropertyChanged(nameof(AniListUrl));
                    this.RaisePropertyChanged(nameof(MangaUpdatesUrl));
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] ResolveTrackers failed: {ex.Message}");
            }
            finally
            {
                Dispatcher.UIThread.Post(() => IsResolvingTrackers = false);
            }
        }

        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }

        private async System.Threading.Tasks.Task RefreshAsync()
        {
             IsLoadingChapters = true; // Show loading immediately
             
             // Create a fresh item from current model state to capture any URL updates
             var currentItem = new MangaItem 
             {
                 Title = _model.Title,
                 MangaUrl = _model.Url,
                 SourceId = _model.Source,
                 CoverUrl = _model.ThumbnailUrl,
             };
             
             // Pass true to FORCE refresh (bypass cache)
             await LoadDetails(currentItem, _sourceManager, forceRefresh: true);
             
             this.RaisePropertyChanged(nameof(ThumbnailUrl));
             _mainVM.ShowNotification("Manga updated");
        }

        private void OnDownloadStatusChanged(object? sender, Core.Services.DownloadRequest e)
        {
            Dispatcher.UIThread.Post(() =>
            {
                // Find matching chapter
                // Note: e.Manga.Url matches _model.Url (series)
                if (e.Manga.Url != _model.Url) return;

                var item = Chapters.FirstOrDefault(c => c.Url == e.Chapter.Url);
                if (item != null)
                {
                    if (e.Status == "Completed")
                    {
                        item.IsDownloaded = true;
                        item.IsDownloading = false;
                        this.RaisePropertyChanged(nameof(HasDownloadedChapters));
                    }
                    else if (e.Status == "Cancelled" || e.Status == "Error")
                    {
                        item.IsDownloaded = false;
                        item.IsDownloading = false;
                    }
                    else if (e.Status == "Downloading" || e.Status == "Queued")
                    {
                        item.IsDownloading = true;
                    }
                    // For "Paused" or others, keep current state (likely Downloading=true)
                }
            });
        }
        
        // Fallback removed/updated to prevent compile error if used elsewhere (unlikely)
        // Kept private or removed would be better, but assuming it's not used externally except via GoToDetail.

        private async System.Threading.Tasks.Task ToggleLibrary()
        {
             if (InLibrary)
             {
                 await _libraryService.RemoveFromLibraryAsync(_model);
                 InLibrary = false;
                 _mainVM.ShowNotification("Removed from Library");
             }
             else
             {
                 await _libraryService.AddToLibraryAsync(_model, Chapters?.Count ?? 0);
                 InLibrary = true;
                 _mainVM.ShowNotification("Added to Library");
                 
                 // Save chapters to DB immediately for offline access
                 if (Chapters != null && Chapters.Count > 0)
                 {
                     var dbChapters = Chapters.Select(c => new Core.Models.Chapter 
                     {
                          Name = c.Title,
                          Url = c.Url,
                          DateUpload = c.DateUpload,
                          // Date is display string, original DateUpload unavailable in VM Item?
                          // Wait, ChapterItem doesn't store DateUpload (long).
                          // It stores string "Date". 
                          // If we save 0, sorting might be weird offline.
                          // But UpdateChaptersAsync checks existing URL. 
                          // Ideally we should have DateUpload in ChapterItem or _model.
                          // For now, let's just save Name/Url.
                          // OR better: In LoadDetails we have proper DateUpload, maybe we can fetch from source again?
                          // No, we should use what we have.
                          // Actually, UpdateChaptersAsync merge logic will keep existing if URL matches.
                          // But for NEW library item, we want to popluate.
                          // The source of truth was LoadDetails.
                          // Let's assume 0 is fine or try to parse locally if really needed, but usually 0 is fine for list.
                     }).ToList();
                     
                     await _libraryService.UpdateChaptersAsync(_model, dbChapters, isInitialLoad: false);
                 }


             }
        }



        private async System.Threading.Tasks.Task LoadDetails(MangaItem item, SourceManager sourceManager, bool forceRefresh = false)
        {
            Console.WriteLine($"[MangaDetailVM] LoadDetails called for '{item.Title}' Url: '{item.MangaUrl}' Source: '{item.SourceId}' Force: {forceRefresh}");
            IsLoadingChapters = true;
            try 
            {
                // Check local DB first
                var existing = await _libraryService.GetMangaByUrlAsync(item.MangaUrl, item.SourceId);
                
                if (existing != null)
                {
                    // Update History (Async) for Library Items
                    await _libraryService.UpdateHistoryAsync(new Manga 
                    { 
                        Url = item.MangaUrl, 
                        Source = item.SourceId,
                        Title = item.Title, // Update title if valid
                        ThumbnailUrl = item.CoverUrl
                    });

                    Dispatcher.UIThread.Post(() => 
                    {
                        InLibrary = existing.Favorite;
                        _model.Id = existing.Id; // Sync ID
                        
                        // Load data from DB immediately (Cached)
                        if (!string.IsNullOrEmpty(existing.Description)) Description = existing.Description!;
                        if (!string.IsNullOrEmpty(existing.Author)) Author = existing.Author!;
                        if (existing.Genre != null) Genres = existing.Genre;
                        
                        Status = StatusToString(existing.Status);
                    });

                    if (existing.Chapters != null && existing.Chapters.Count > 0)
                    {
                        var vmChapters = existing.Chapters.OrderByDescending(c => c.ChapterNumber).Select(ch => {
                            // Create minimal chapter for download request & disk check
                            var chapterModel = new Core.Models.Chapter { Name = ch.Name, Url = ch.Url, ChapterNumber = ch.ChapterNumber };
                            
                            // Check filesystem to verify if files actually exist on disk
                            bool isDownloaded = DownloadPathService.IsChapterDownloaded(existing, chapterModel);
                            ch.IsDownloaded = isDownloaded; // Sync DB entity state

                            ChapterItem? item = null;
                            item = new ChapterItem(
                                () => QueueDownload(chapterModel), 
                                () => DeleteChapterDownload(chapterModel, ch.Url),
                                () => MarkChapterAsRead(item!),
                                () => MarkChapterAsUnread(item!),
                                () => MarkPreviousAsRead(item!),
                                () => ToggleChapterBookmark(item!))
                            {
                                Title = ch.Name,
                                ChapterNumber = ch.ChapterNumber,
                                Url = ch.Url,
                                Date = ch.DateUpload > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(ch.DateUpload).ToString("dd MMM yyyy") : "", 
                                DateUpload = ch.DateUpload,
                                IsRead = ch.Read,
                                IsNewRelease = ch.IsNew,
                                IsDownloaded = isDownloaded
                            };
                            return item;
                        }).ToList(); 
                        
                        // Apply Natural Sort (Background Thread)
                        var comparer = new NaturalStringComparer(!SortAscending);
                        var sortedChapters = vmChapters.OrderBy(x => x.Title, comparer).ToList();
                        
                        var hasStartedReading = sortedChapters.Any(c => c.IsRead);
                        var lastRead = sortedChapters.FirstOrDefault(c => c.IsRead);
                        var lastReadTitle = lastRead?.Title ?? string.Empty;

                        Dispatcher.UIThread.Post(() => 
                        {
                            Chapters = sortedChapters;
                            HasStartedReading = hasStartedReading;
                            LastReadChapterTitle = lastReadTitle;

                            // Calculate Next Chapter (Ascending Sort)
                            var ascComparer = new NaturalStringComparer(false);
                            var sortAsc = vmChapters.OrderBy(x => x.Title, ascComparer).ToList();
                            
                            if (lastRead != null)
                            {
                                var idx = sortAsc.IndexOf(lastRead);
                                if (idx >= 0 && idx < sortAsc.Count - 1)
                                {
                                    NextChapterToRead = sortAsc[idx + 1];
                                }
                                else
                                {
                                    NextChapterToRead = lastRead; // End of series or just re-read last
                                }
                            }
                            else
                            {
                                NextChapterToRead = sortAsc.FirstOrDefault();
                            }
                            
                            this.RaisePropertyChanged(nameof(ResumeButtonText));
                            this.RaisePropertyChanged(nameof(CanResume));
                            
                            // Only hide loading if NOT adhering to forceRefresh
                            if (!forceRefresh) IsLoadingChapters = false;
                        });
                    }
                    else
                    {
                         // Only hide loading if NOT adhering to forceRefresh
                         if (!forceRefresh) Dispatcher.UIThread.Post(() => IsLoadingChapters = false);
                    }
                    
                    // ONLY return early if we have chapters cached AND it's in the library. 
                    // CRITICAL FIX: Also check if metadata is complete. If "Unknown" author or default description, FORCE UPDATE.
                    bool isMetadataIncomplete = 
                        (existing.Title == "Unknown") ||
                        (existing.Author == "Unknown" || existing.Author == "Loading...") || 
                        (existing.Description == "Loading details..." || string.IsNullOrEmpty(existing.Description));

                    // IF FORCE REFRESH IS TRUE, WE SKIP THIS RETURN BLOCK AND FETCH ONLINE
                    if (existing.Favorite && existing.Chapters != null && existing.Chapters.Count > 0 && !isMetadataIncomplete && !forceRefresh)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Loaded {existing.Chapters.Count} chapters from DB (Library) for: {item.Title}");

                        return;
                    }
                    
                    // No chapters cached, or History item, OR metadata incomplete - fall through to fetch online if connected
                    System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Fetching online for: {item.Title} (InLibrary: {existing.Favorite}, Incomplete: {isMetadataIncomplete}, Force: {forceRefresh})");
                }
                
                // If we get here, we need to fetch chapters online (either not in DB, or in DB without chapters)
                if (!IsOnline)
                {
                     Dispatcher.UIThread.Post(() => { Description = "Offline Mode: Cannot load chapters."; IsLoadingChapters = false; });
                     return;
                }
                
                // Fetch fresh data from source
                var source = sourceManager.GetSource(item.SourceId);
                if (source == null) 
                {
                    Dispatcher.UIThread.Post(() => { Description = "Source not found."; IsLoadingChapters = false; });
                    return;
                }

                // 1. Fetch Details
                var manga = await source.GetMangaDetailsAsync(item.MangaUrl);
                
                // Update local model with fresh data from Source
                _model.Title = manga.Title; // Critical: Use cleaned/full title from details
                _model.Author = manga.Author;
                _model.Status = manga.Status;
                _model.Description = manga.Description;
                _model.Genre = manga.Genre;
                
                // FORCE Update Thumbnail from Source if available, even if we have one
                if (!string.IsNullOrEmpty(manga.ThumbnailUrl)) 
                {
                    System.Console.WriteLine($"[MangaDetailVM] Fresh cover from source: {manga.ThumbnailUrl}");
                    _model.ThumbnailUrl = manga.ThumbnailUrl;
                }
                

                
                Dispatcher.UIThread.Post(() => 
                {
                    Title = manga.Title;
                    Author = manga.Author ?? "Unknown";
                    Description = manga.Description ?? "No description.";
                    Status = StatusToString(manga.Status);
                    Genres = manga.Genre ?? new List<string>();
                    
                    // Notify ThumbnailUrl changed
                    this.RaisePropertyChanged(nameof(ThumbnailUrl));
                });

                // 2. Fetch Chapters
                var chapters = await source.GetChapterListAsync(item.MangaUrl);
                System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Fetched {chapters.Count} chapters from API");

                // Update History (Async) for Online/Non-Library items
                manga.Source = item.SourceId; // Ensure Source ID is set
                
                // CRITICAL FIX: URL Persistence Logic
                // If in Library, we MUST preserve the original URL (Database Key).
                // If NOT in Library, we trust the SOURCE's returned URL (it might be a redirect/slug change).
                if (existing != null)
                {
                    manga.Url = item.MangaUrl; // Force keep original URL key
                }
                else
                {
                    // Allow source to dictate new URL (Redirect handling)
                    // If source didn't return URL (unlikely), fallback to item.MangaUrl
                    if (string.IsNullOrEmpty(manga.Url)) manga.Url = item.MangaUrl;
                    
                    // Update model URL immediately so subsequent refreshes use the new URL
                    _model.Url = manga.Url; 
                }
                
                // Fallback: If details parsing failed to get cover (e.g. lazy load), use the one we have from Browse/Search
                if (string.IsNullOrEmpty(manga.ThumbnailUrl) && !string.IsNullOrEmpty(item.CoverUrl))
                {
                    manga.ThumbnailUrl = item.CoverUrl;
                }

                // Force update history with the FRESH details (including new Cover)
                // This ensures the DB gets the new high-quality cover if it was using the fallback
                await _libraryService.UpdateHistoryAsync(manga);
                
                if (_model.Id == 0 && manga.Id > 0)
                {
                    _model.Id = manga.Id; // Sync ID so chapters can be saved!
                }

                // Auto-update DB if in library (NOW we have chapter count)
                if (InLibrary)
                {
                     await _libraryService.AddToLibraryAsync(_model, chapters.Count);
                }
                
                // Sync chapters to DB always (for Library AND History caching)
                if (_model.Id > 0)
                {
                    var dbChapters = chapters.Select(c => new Core.Models.Chapter 
                    {
                         Name = c.Name,
                         Url = c.Url,
                         DateUpload = c.DateUpload,
                         ChapterNumber = c.ChapterNumber 
                    }).ToList();
                    
                    await _libraryService.UpdateChaptersAsync(_model, dbChapters, skipPrune: false);

                    System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Synced {dbChapters.Count} chapters to DB (Cache)");
                }
                
                {
                    var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    // CRITICAL: If manga exists in library, use the SAVED title for path generation
                    // This ensures we check the same folder where we downloaded files
                    var titleForPath = existing != null ? existing.Title : manga.Title;
                    var safeMangaTitle = string.Join("_", titleForPath.Split(System.IO.Path.GetInvalidFileNameChars()));
                    
                    var vmChapters = new List<ChapterItem>();
                    foreach(var ch in chapters)
                    {
                        // Check if existing to get download/read status
                        var dbChapter = existing?.Chapters?.FirstOrDefault(x => x.Url == ch.Url);
                        var dbRead = dbChapter?.Read ?? ch.Read; // Prefer DB read status

                        // Always verify filesystem to check if files actually exist on disk
                        var downloadedCheckChapter = new Core.Models.Chapter
                        {
                            Name = ch.Name,
                            Url = ch.Url,
                            ChapterNumber = ch.ChapterNumber
                        };
                        bool isDownloaded = DownloadPathService.IsChapterDownloaded(_model, downloadedCheckChapter);
                        if (dbChapter != null)
                        {
                            dbChapter.IsDownloaded = isDownloaded;
                        }

                        // Create minimal chapter for download request
                        var chapterModel = new Core.Models.Chapter { Name = ch.Name, Url = ch.Url };
                        
                        // Smart IsNewRelease detection
                        bool isNewRelease = false;
                        if (existing != null)
                        {
                            if (dbChapter != null)
                            {
                                isNewRelease = dbChapter.IsNew;
                            }
                            else
                            {
                                float maxExistingNum = (existing.Chapters != null && existing.Chapters.Any()) ? existing.Chapters.Max(c => c.ChapterNumber) : 0;
                                long maxExistingDate = (existing.Chapters != null && existing.Chapters.Any()) ? existing.Chapters.Max(c => c.DateUpload) : 0;

                                bool isHigherNumber = ch.ChapterNumber > maxExistingNum;
                                bool isNewerDate = ch.DateUpload > 0 && maxExistingDate > 0 && ch.DateUpload > maxExistingDate;
                                
                                isNewRelease = isHigherNumber || isNewerDate;
                            }
                        }
                        else
                        {
                            isNewRelease = ch.DateUpload > 0 && (DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeMilliseconds(ch.DateUpload)).TotalDays <= 3;
                        }

                        ChapterItem? newOnlineItem = null;
                        newOnlineItem = new ChapterItem(
                             () => QueueDownload(chapterModel), 
                             () => DeleteChapterDownload(chapterModel, ch.Url),
                             () => MarkChapterAsRead(newOnlineItem!),
                             () => MarkChapterAsUnread(newOnlineItem!),
                             () => MarkPreviousAsRead(newOnlineItem!),
                             () => ToggleChapterBookmark(newOnlineItem!))
                        {
                            Title = ch.Name,
                            ChapterNumber = ch.ChapterNumber,
                            Url = ch.Url,
                            Date = DateTimeOffset.FromUnixTimeMilliseconds(ch.DateUpload).ToString("dd MMM yyyy"),
                            DateUpload = ch.DateUpload,
                            IsRead = dbRead,
                            IsNewRelease = isNewRelease,
                            IsDownloaded = isDownloaded
                        };
                        vmChapters.Add(newOnlineItem);
                    }

                    
                    // Apply Natural Sort (Background Thread)
                    var comparer = new NaturalStringComparer(!SortAscending);
                    var sortedChapters = vmChapters.OrderBy(x => x.Title, comparer).ToList();

                    Dispatcher.UIThread.Post(() => 
                    {
                        Chapters = sortedChapters;
                    Status = StatusToString(manga.Status);
                    IsLoadingChapters = false;
                });
                }
            }
            catch (System.Exception ex)
            {
                 Dispatcher.UIThread.Post(() => 
                 {
                    if (!IsOnline) Description = "Offline Mode: " + ex.Message;
                    else Description = $"Error loading details: {ex.Message}";
                    IsLoadingChapters = false;
                 });
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

        private string StatusToString(int status) => status switch
        {
            1 => GetResourceString("String.Status.Ongoing", "Ongoing"),
            2 => GetResourceString("String.Status.Completed", "Completed"),
            3 => GetResourceString("String.Status.Licensed", "Licensed"),
            4 => GetResourceString("String.Status.PublishingFinished", "Publishing Finished"),
            5 => GetResourceString("String.Status.Cancelled", "Cancelled"),
            6 => GetResourceString("String.Status.Hiatus", "Hiatus"),
            _ => GetResourceString("String.Status.Unknown", "Unknown")
        };

        private async System.Threading.Tasks.Task MarkChapterAsRead(ChapterItem item)
        {
            if (item == null) return;
            item.IsRead = true; // Visual Feedback
            await _libraryService.SetChapterReadStatusAsync(item.Url, true, _model.Source, _model.Url, item.Title, item.ChapterNumber);
            
            // Update Stats
            if (InLibrary && _model.Id > 0)
            {
                // Optionally update LastRead of manga
                // We let LibraryService handle history update if needed, but simple read mark usually implies history update
                // Re-trigger history update just in case
            }
        }

        private async System.Threading.Tasks.Task MarkChapterAsUnread(ChapterItem item)
        {
            if (item == null) return;
            item.IsRead = false; // Visual Feedback
            await _libraryService.SetChapterReadStatusAsync(item.Url, false);
        }

        private async System.Threading.Tasks.Task MarkPreviousAsRead(ChapterItem item)
        {
            if (item == null) return;
            
            // Logic: Mark all chapters *older* than this one.
            // Depending on sort order, we need to be careful. 
            // Safer to iterate the full list and verify Chapter Number or Index.
            
            // Assuming "Previous" means "Chapters with lower number" (Context: Reading forward)
            // Or "Chapters below this in the list"?
            // Usually "Mark Previous" means "Old chapters".
            
            var targetNumber = item.ChapterNumber;
            // If ChapterNumber is invalid (-1), try to use List Index (everything below current)
            
            bool useIndex = targetNumber <= 0;
            int limitIndex = Chapters.IndexOf(item);
            if (limitIndex < 0) return;

            var toUpdate = new List<ChapterItem>();

            // If Sorted Descending (Default): Old chapters are at the BOTTOM (Higher Index)
            // If Sorted Ascending: Old chapters are at the TOP (Lower Index)

            if (!SortAscending) // Descending (Newest Top)
            {
                 // Previous = Older = Below in list = Index > limitIndex
                 toUpdate = Chapters.Where((c, i) => i > limitIndex && !c.IsRead).ToList();
            }
            else // Ascending (Oldest Top)
            {
                 // Previous = Older = Above in list = Index < limitIndex
                 toUpdate = Chapters.Where((c, i) => i < limitIndex && !c.IsRead).ToList();
            }

            foreach (var ch in toUpdate)
            {
                ch.IsRead = true; // Instant Visual Feedback
            }

            // Batch DB Update
            await System.Threading.Tasks.Task.Run(async () => 
            {
                foreach(var ch in toUpdate)
                {
                   await _libraryService.SetChapterReadStatusAsync(ch.Url, true, _model.Source, _model.Url, ch.Title, ch.ChapterNumber);
                }
            });
        }

        private async System.Threading.Tasks.Task ToggleChapterBookmark(ChapterItem item)
        {
            if (item == null) return;
            item.Bookmark = !item.Bookmark; // Visual Feedback
            await _libraryService.SetChapterBookmarkStatusAsync(item.Url, item.Bookmark, _model.Source, _model.Url, item.Title, item.ChapterNumber);
            
            if (ChapterFilter == ChapterFilterMode.Bookmarked)
            {
                UpdateDisplayItems();
            }
        }

        // --- Downloading ---
        private void QueueDownload(Core.Models.Chapter chapter)
        {
             // Ensure model has ID if possible
             if (_model.Id == 0)
             {
                 // Must be in library to download? Not necessarily but good for persistence
                 // For now allow downloading temp
             }
             
             _downloadService.QueueDownload(_model, chapter);
             
             // Update UI status immediately to show spinner
             var item = Chapters.FirstOrDefault(x => x.Url == chapter.Url);
             if (item != null) item.IsDownloading = true;
        }
        
        private async void DeleteChapterDownload(Core.Models.Chapter chapter, string chapterUrl)
        {
            var item = Chapters.FirstOrDefault(x => x.Url == chapterUrl);
            if (item == null) return;

            try
            {
                 item.IsDeleting = true;
                 // Simulate small delay for animation if needed, or just await the real task
                 await System.Threading.Tasks.Task.Delay(500); // Visual feedback
                 
                 await _libraryService.DeleteChapterDownloadAsync(_model, chapter);
                 item.IsDownloaded = false;
                 this.RaisePropertyChanged(nameof(HasDownloadedChapters));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Error deleting chapter: {ex}");
                // Revert UI if failed
                item.IsDownloaded = true;
            }
            finally
            {
                item.IsDeleting = false;
            }
        }

        private async System.Threading.Tasks.Task DeleteAllDownloadedChaptersAsync()
        {
            if (Chapters == null) return;
            var downloaded = Chapters.Where(c => c.IsDownloaded).ToList();
            if (downloaded.Count == 0)
            {
                _mainVM.ShowNotification("No downloaded chapters to delete.", NotificationType.Info);
                return;
            }

            _mainVM.ShowNotification($"Deleting {downloaded.Count} downloaded chapter(s)...", NotificationType.Info);

            int deletedCount = 0;
            foreach (var item in downloaded)
            {
                try
                {
                    item.IsDeleting = true;
                    var chapterModel = new Core.Models.Chapter { Name = item.Title, Url = item.Url };
                    await _libraryService.DeleteChapterDownloadAsync(_model, chapterModel);
                    item.IsDownloaded = false;
                    deletedCount++;
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Error deleting chapter {item.Title}: {ex}");
                }
                finally
                {
                    item.IsDeleting = false;
                }
            }

            this.RaisePropertyChanged(nameof(HasDownloadedChapters));
            _mainVM.ShowNotification($"Successfully deleted {deletedCount} downloaded chapter(s).", NotificationType.Success);
        }
        
        /// <summary>
        /// Navigate to reader starting from Chapter 1 (first available chapter).
        /// This always starts from the beginning regardless of reading history.
        /// </summary>
        private void StartReading()
        {
            if (Chapters == null || Chapters.Count == 0) 
            {
                _mainVM.ShowNotification("No chapters available to read.", NotificationType.Error);
                return;
            }

            // Chapters are typically ordered descending (newest first), so Chapter 1 is at the end
            var firstChapter = Chapters.LastOrDefault();

            if (firstChapter == null)
            {
                _mainVM.ShowNotification("Chapter 1 is not available.", NotificationType.Error);
                return;
            }

            System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] StartReading: Opening first chapter '{firstChapter.Title}'");
            var chaptersToPass = _mainVM.SettingsService?.SkipFilteredChapters == true ? FilteredChapters.ToList() : Chapters;
            _mainVM.GoToReader(firstChapter, chaptersToPass, SourceId, Title, Url, IsExplicitContent, ThumbnailUrl ?? "");
        }

        private void SetChapterFilter(string filter)
        {
            if (Enum.TryParse<ChapterFilterMode>(filter, true, out var mode))
            {
                ChapterFilter = mode;
            }
        }

        /// <summary>
        /// Resume reading from the last read chapter.
        /// If no reading history exists, this will behave like StartReading.
        /// </summary>
        private void ResumeReading(ChapterItem? targetChapter)
        {
            if (Chapters == null || Chapters.Count == 0)
            {
                _mainVM.ShowNotification("No chapters available to read.", NotificationType.Error);
                return;
            }

            // Fallback if binding failed or null passed
            if (targetChapter == null)
            {
                // Logic replication (just in case)
                // Default to first chapter
                targetChapter = NextChapterToRead ?? Chapters.OrderBy(c => c.Title, new NaturalStringComparer(false)).FirstOrDefault();
            }

            if (targetChapter != null)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] ResumeReading: Opening chapter '{targetChapter.Title}'");
                var chaptersToPass = _mainVM.SettingsService?.SkipFilteredChapters == true ? FilteredChapters.ToList() : Chapters;
                _mainVM.GoToReader(targetChapter, chaptersToPass, SourceId, Title, Url, IsExplicitContent, ThumbnailUrl ?? "");
            }
        }

        /// <summary>
        /// Refreshes the read state of chapters after returning from reader.
        /// Updates HasStartedReading and individual chapter IsRead flags.
        /// </summary>
        public void RefreshReadState()
        {
            System.Threading.Tasks.Task.Run(async () =>
            {
                try
                {
                    // Query database for latest read status
                    var manga = await _libraryService.GetMangaByUrlAsync(Url, SourceId);
                    if (manga?.Chapters == null || manga.Chapters.Count == 0) return;

                    // Create lookup of read chapters
                    var readChapterUrls = manga.Chapters
                        .Where(c => c.Read)
                        .Select(c => c.Url)
                        .ToHashSet();

                    Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                    {
                        // Update individual chapter IsRead flags
                        foreach (var chapter in Chapters)
                        {
                            if (readChapterUrls.Contains(chapter.Url) && !chapter.IsRead)
                            {
                                chapter.IsRead = true;
                            }
                        }

                        // Update HasStartedReading and LastReadChapterTitle
                        HasStartedReading = Chapters.Any(c => c.IsRead);
                        
                        // Find the last read chapter for visual cue
                        var lastRead = Chapters.FirstOrDefault(c => c.IsRead);
                        LastReadChapterTitle = lastRead?.Title ?? string.Empty;

                        // Calculate Next Chapter (Ascending Sort)
                        var ascComparer = new NaturalStringComparer(false);
                        var sortAsc = Chapters.OrderBy(x => x.Title, ascComparer).ToList();
                        
                        if (lastRead != null)
                        {
                            var idx = sortAsc.IndexOf(lastRead);
                            if (idx >= 0 && idx < sortAsc.Count - 1)
                            {
                                NextChapterToRead = sortAsc[idx + 1];
                            }
                            else
                            {
                                NextChapterToRead = lastRead; // End of series
                            }
                        }
                        else
                        {
                            NextChapterToRead = sortAsc.FirstOrDefault();
                        }
                        
                        this.RaisePropertyChanged(nameof(ResumeButtonText));
                        this.RaisePropertyChanged(nameof(CanResume));
                    });
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] RefreshReadState failed: {ex.Message}");
                }
            });
        }

        private async System.Threading.Tasks.Task ConfirmDownloadAllChapters()
        {
            if (Chapters == null || Chapters.Count == 0)
            {
                _mainVM.ShowNotification("No chapters available to download.", NotificationType.Error);
                return;
            }

            var info = new DownloadAllDialogInfo
            {
                MangaTitle = Title,
                TotalChapters = Chapters.Count,
                NotDownloadedCount = Chapters.Count(c => !c.IsDownloaded),
                UnreadNotDownloadedCount = Chapters.Count(c => !c.IsDownloaded && !c.IsRead)
            };

            if (info.NotDownloadedCount == 0)
            {
                _mainVM.ShowNotification("All chapters are already downloaded.", NotificationType.Info);
                return;
            }

            var mode = ShowDownloadAllDialogAsync == null
                ? DownloadAllMode.NotDownloaded
                : await ShowDownloadAllDialogAsync(info);

            if (mode == null)
            {
                return;
            }

            if (mode == DownloadAllMode.ExportZipPdf || mode == DownloadAllMode.ExportZipPdfUnread)
            {
                var targetChapters = mode == DownloadAllMode.ExportZipPdfUnread
                    ? Chapters.Where(c => !c.IsRead).ToList()
                    : Chapters.ToList();

                ExportSelectedChaptersToZipPdfAsync(targetChapters);
                return;
            }

            DownloadAllChapters(mode.Value);
        }

        private async void ExportSelectedChaptersToZipPdfAsync(List<ChapterItem> chapters)
        {
            if (chapters == null || chapters.Count == 0) return;

            int exportedCount = 0;
            var chaptersToQueue = new List<ChapterItem>();

            foreach (var chapter in chapters)
            {
                var chapterModel = new Core.Models.Chapter { Name = chapter.Title, Url = chapter.Url };
                var chapterFolder = Core.Services.DownloadPathService.FindCompletedChapterDirectory(_model, chapterModel)
                    ?? Core.Services.DownloadPathService.GetChapterDirectory(_model, chapterModel);

                bool hasLocalImages = System.IO.Directory.Exists(chapterFolder) &&
                    System.IO.Directory.GetFiles(chapterFolder).Any(f =>
                    {
                        var ext = System.IO.Path.GetExtension(f);
                        return ext.Equals(".jpg", StringComparison.OrdinalIgnoreCase) ||
                               ext.Equals(".jpeg", StringComparison.OrdinalIgnoreCase) ||
                               ext.Equals(".png", StringComparison.OrdinalIgnoreCase) ||
                               ext.Equals(".webp", StringComparison.OrdinalIgnoreCase) ||
                               ext.Equals(".avif", StringComparison.OrdinalIgnoreCase);
                    });

                if (hasLocalImages)
                {
                    try
                    {
                        await Core.Services.PdfExportService.ExportChapterImagesToZipPdfAsync(Title, chapter.Title, chapterFolder);
                        exportedCount++;
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] PDF export error for {chapter.Title}: {ex.Message}");
                    }
                }
                else
                {
                    chaptersToQueue.Add(chapter);
                }
            }

            if (chaptersToQueue.Count > 0)
            {
                _mainVM.ShowNotification($"Downloading {chaptersToQueue.Count} chapter(s)... PDF (.zip) will be generated automatically upon completion.", NotificationType.Info);

                foreach (var chapter in chaptersToQueue)
                {
                    var chapterModel = new Core.Models.Chapter { Name = chapter.Title, Url = chapter.Url };
                    _downloadService.QueueDownload(_model, chapterModel);
                    chapter.IsDownloading = true;

                    EventHandler<Core.Services.DownloadRequest>? handler = null;
                    handler = async (s, req) =>
                    {
                        if (req.Manga.Url == _model.Url && req.Chapter.Url == chapter.Url && req.Status == "Completed")
                        {
                            _downloadService.StatusChanged -= handler;
                            var completedFolder = Core.Services.DownloadPathService.FindCompletedChapterDirectory(_model, req.Chapter)
                                ?? Core.Services.DownloadPathService.GetChapterDirectory(_model, req.Chapter);

                            if (System.IO.Directory.Exists(completedFolder))
                            {
                                try
                                {
                                    await Core.Services.PdfExportService.ExportChapterImagesToZipPdfAsync(Title, chapter.Title, completedFolder);
                                    _mainVM.ShowNotification($"Exported {chapter.Title} (PDF) inside Downloads/Yomic_Exports/{Title}.zip!", NotificationType.Success);
                                }
                                catch (Exception exExp)
                                {
                                    System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Auto PDF export failed: {exExp.Message}");
                                }
                            }
                        }
                    };
                    _downloadService.StatusChanged += handler;
                }
            }
            else if (exportedCount > 0)
            {
                _mainVM.ShowNotification($"Successfully exported {exportedCount} chapter(s) (PDF) inside Downloads/Yomic_Exports/{Title}.zip!", NotificationType.Success);
            }
        }

        private void DownloadAllChapters(DownloadAllMode mode)
        {
            System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] DownloadAll called. Total chapters: {Chapters.Count}, Mode: {mode}");

            var chaptersToDownload = mode switch
            {
                DownloadAllMode.UnreadNotDownloaded => Chapters.Where(c => !c.IsDownloaded && !c.IsRead).ToList(),
                _ => Chapters.Where(c => !c.IsDownloaded).ToList()
            };

            if (chaptersToDownload.Count == 0)
            {
                _mainVM.ShowNotification("No matching chapters to download.", NotificationType.Info);
                return;
            }

            System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Chapters to download: {chaptersToDownload.Count}");

            foreach (var chapter in chaptersToDownload)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDetailVM] Queueing: {chapter.Title}");
                var chapterModel = new Core.Models.Chapter { Name = chapter.Title, Url = chapter.Url };
                _downloadService.QueueDownload(_model, chapterModel);
                chapter.IsDownloading = true;
            }

            _mainVM.ShowNotification($"{chaptersToDownload.Count} chapter(s) added to download queue.", NotificationType.Success);
        }


        private void SortChapters()
        {
            if (Chapters == null || Chapters.Count == 0) return;

            IsLoadingChapters = true;
            var currentChapters = Chapters.ToList();
            var ascending = SortAscending;

            System.Threading.Tasks.Task.Run(() => 
            {
                var comparer = new NaturalStringComparer(!ascending);
                var sorted = currentChapters.OrderBy(x => x.Title, comparer).ToList();
                
                Dispatcher.UIThread.Post(() => 
                {
                    Chapters = sorted;
                    IsLoadingChapters = false;
                });
            });
        }
        private async System.Threading.Tasks.Task LoadSourceIcon()
        {
            var iconUrl = SourceIconUrl;
            if (string.IsNullOrEmpty(iconUrl)) return;

            // Check memory cache
            var cached = _imageCacheService.GetImage(iconUrl);
            if (cached != null)
            {
                SourceIconBitmap = cached;
                return;
            }

            if (!IsOnline) return;

            // Download
            try
            {
                using var client = _networkService.CreateOptimizedHttpClient();
                var data = await client.GetByteArrayAsync(iconUrl);
                using var stream = new System.IO.MemoryStream(data);
                var bitmap = new Avalonia.Media.Imaging.Bitmap(stream);
                
                _imageCacheService.AddImage(iconUrl, bitmap);
                
                Avalonia.Threading.Dispatcher.UIThread.Post(() => SourceIconBitmap = bitmap);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to load source icon: {ex.Message}");
            }
        }

        public void Dispose()
        {
            // Release large bitmap references
            SourceIconBitmap = null;
            
            if (_chapters != null)
            {
                foreach (var chapter in _chapters)
                {
                    chapter.MangaRef = null;
                }
                _chapters.Clear();
            }

            FilteredChaptersList?.Clear();            
            System.Diagnostics.Debug.WriteLine("[MangaDetailVM] Disposed and memory references cleared.");
        }
    }
}
