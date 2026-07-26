using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reactive;
using System.Threading.Tasks;
using Yomic.Core.Services;
using Yomic.Core.Models;
using ReactiveUI;
using Avalonia.Threading;
using System.Collections.Generic;
using Avalonia.Controls;

namespace Yomic.ViewModels
{
    public class UpdatesViewModel : ViewModelBase, IDisposable
    {
        private readonly LibraryService _libraryService;
        private readonly NetworkService _networkService;
        private readonly SourceManager _sourceManager;


        private ObservableCollection<UpdatesGroupParams> _groupedUpdates = new();
        public ObservableCollection<UpdatesGroupParams> GroupedUpdates
        {
            get => _groupedUpdates;
            set 
            {
                this.RaiseAndSetIfChanged(ref _groupedUpdates, value);
                this.RaisePropertyChanged(nameof(HasItems));
                this.RaisePropertyChanged(nameof(UpdatesCount));
            }
        }

        public bool HasItems => GroupedUpdates.Count > 0;
        public int UpdatesCount => GroupedUpdates.Sum(g => g.Items.Count);
        
        private bool _isEmpty;
        public bool IsEmpty
        {
            get => _isEmpty;
            set => this.RaiseAndSetIfChanged(ref _isEmpty, value);
        }

        private bool _isOffline;
        public bool IsOffline
        {
            get => _isOffline;
            set => this.RaiseAndSetIfChanged(ref _isOffline, value);
        }

        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<ChapterItem, Unit> OpenChapterCommand { get; }
        public ReactiveCommand<Unit, Unit> GoToLibraryCommand { get; }

        private readonly DownloadService _downloadService;
        private readonly ImageCacheService _imageCacheService;
        private readonly MainWindowViewModel _mainVM;

        public UpdatesViewModel(LibraryService libraryService, NetworkService networkService, SourceManager sourceManager, DownloadService downloadService, ImageCacheService imageCacheService, MainWindowViewModel mainVM)
        {
            _libraryService = libraryService;
            _networkService = networkService;
            _sourceManager = sourceManager;
            _downloadService = downloadService;
            _imageCacheService = imageCacheService;
            _mainVM = mainVM;

            // Offline Logic
            IsOffline = !_networkService.IsOnline;
            _networkService.StatusChanged += (s, isOnline) =>
            {
                Dispatcher.UIThread.Post(() => IsOffline = !isOnline);
            };

            GroupedUpdates = new ObservableCollection<UpdatesGroupParams>();
            RefreshCommand = ReactiveCommand.CreateFromTask(RefreshUpdatesAsync);
            OpenChapterCommand = ReactiveCommand.CreateFromTask<ChapterItem>(OpenChapter);
            GoToLibraryCommand = ReactiveCommand.Create(() => _mainVM.GoToLibrary());
            MarkPrevReadCommand = ReactiveCommand.CreateFromTask<ChapterItem>(MarkPreviousReadAsync);
            
            // Subscribe to Background Updates
            _libraryService.UpdatesFound += async (sender, count) => 
            {
                Dispatcher.UIThread.Post(async () => 
                {
                    await LoadUpdatesAsync();
                    if (count > 0)
                    {
                         _mainVM.NotificationVM.Show($"Found {count} new chapters!");
                    }
                });
            };

            ClearUpdatesCommand = ReactiveCommand.CreateFromTask(ClearUpdatesAsync);

            _ = LoadUpdatesAsync();
        }

        public ReactiveCommand<Unit, Unit> ClearUpdatesCommand { get; }

        public async Task ClearUpdatesAsync()
        {
            // 1. Optimistic UI Update: Clear immediately
            Dispatcher.UIThread.Post(() =>
            {
                GroupedUpdates.Clear();
                IsEmpty = true;
                this.RaisePropertyChanged(nameof(UpdatesCount));
                this.RaisePropertyChanged(nameof(HasItems));
            });

            // 2. Background DB Update
            try
            {
                await _libraryService.ClearAllUpdatesAsync();
            }
            catch (Exception ex)
            {
                // Log only, don't revert UI because the user intention was to clear the view.
                System.Diagnostics.Debug.WriteLine($"[UpdatesVM] Error clearing updates from DB: {ex}");
            }
        }



        public ReactiveCommand<ChapterItem, Unit> MarkPrevReadCommand { get; }

        private async Task MarkPreviousReadAsync(ChapterItem item)
        {
            if (item.MangaRef == null) return;
            
            try
            {
                var chapters = await _libraryService.GetRecentChaptersAsync(500); // Re-fetching is expensive but safe.
                var thisChapter = chapters.FirstOrDefault(c => c.Url == item.Url);
                
                if (thisChapter != null)
                {
                     await _libraryService.MarkChaptersBeforeAsReadAsync(item.MangaRef, thisChapter.ChapterNumber);
                     // Refresh
                     await LoadUpdatesAsync();
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[UpdatesVM] Error marking prev read: {ex}");
            }
        }

        private async Task OpenChapter(ChapterItem item)
        {
            // Let's resolve the full manga first
            if (item.MangaRef != null)
            {
                // Create minimal object safely using standard helper
                var mangaItem = MangaItem.FromCoreManga(item.MangaRef);
                
                // Go to detail first (safe)
                _mainVM.GoToDetail(mangaItem);
            }
        }

        private bool _isLibraryEmpty;
        public bool IsLibraryEmpty
        {
            get => _isLibraryEmpty;
            set => this.RaiseAndSetIfChanged(ref _isLibraryEmpty, value);
        }

        public async Task LoadUpdatesAsync()
        {
            try
            {
                // Check if library is empty first
                var libraryItems = await _libraryService.GetLibraryMangaAsync();
                Dispatcher.UIThread.Post(() => IsLibraryEmpty = libraryItems.Count == 0);

                // Check if library is empty first (Optimized)
                var libraryCount = await _libraryService.GetLibraryCountAsync();
                
                if (libraryCount == 0)
                {
                    IsLibraryEmpty = true;
                    IsEmpty = true;
                    return;
                }
                
                IsLibraryEmpty = false;
                var chapters = await _libraryService.GetRecentChaptersAsync(100); // Get last 100 updates
                
                if (chapters.Count == 0)
                {
                    Dispatcher.UIThread.Post(() => IsEmpty = true);
                    return;
                }

                // Group by actual Upload Date (or fallback to Fetch Date) for accurate UI timeline
                var groups = chapters
                    .GroupBy(c => GetTimeHeaderKey(c.DateUpload > 0 ? c.DateUpload : c.DateFetch))
                    // To ensure the headers output in correct chronological order:
                    .OrderBy(g => 
                    {
                        switch(g.Key) {
                            case "Today": return 0;
                            case "Yesterday": return 1;
                            case "This Week": return 2;
                            case "This Month": return 3;
                            default: return 4;
                        }
                    })
                    .Select(g => new UpdatesGroupParams
                    {
                        Header = GetLocalizedTimeHeader(g.Key),
                        // Within each timeframe group, deduplicate by Manga, preferring the most recently uploaded
                        Items = new ObservableCollection<ChapterItem>(g
                            .GroupBy(c => c.MangaId)
                            .Select(mg => 
                            {
                                 var sorted = mg.OrderByDescending(c => c.DateUpload > 0 ? c.DateUpload : c.DateFetch).ToList();
                                 var c = sorted[0];
                                 var actualDate = c.DateUpload > 0 ? c.DateUpload : c.DateFetch;
                                 var item = new ChapterItem(null, null, null, null, null) 
                                 {
                                    Title = c.Name,
                                    Url = c.Url,
                                    MangaRef = c.Manga,
                                    Date = GetTimeAgo(actualDate),
                                    FullDateString = DateTimeOffset.FromUnixTimeMilliseconds(actualDate).ToLocalTime().ToString("dddd, d MMMM yyyy – hh:mm tt"),
                                    DateUpload = actualDate,
                                    IsRead = c.Read,
                                    IsDownloaded = c.IsDownloaded,
                                    IsNewRelease = c.IsNew,
                                    AdditionalChaptersCount = sorted.Count - 1
                                 };
                                 return item;
                            })
                            .OrderByDescending(item => item.DateUpload)
                            .ToList())
                    })
                    .ToList();

                Dispatcher.UIThread.Post(() =>
                {
                    GroupedUpdates = new ObservableCollection<UpdatesGroupParams>(groups);
                    IsEmpty = GroupedUpdates.Count == 0;
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[UpdatesVM] Error loading: {ex}");
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

        private string GetTimeHeaderKey(long dateFetch)
        {
            var date = DateTimeOffset.FromUnixTimeMilliseconds(dateFetch);
            var now = DateTimeOffset.Now;
            
            if (date.Date == now.Date) return "Today";
            if (date.Date == now.AddDays(-1).Date) return "Yesterday";
            if (date > now.AddDays(-7)) return "This Week";
            if (date > now.AddDays(-30)) return "This Month";
            return "Older";
        }

        private string GetLocalizedTimeHeader(string key)
        {
            switch (key)
            {
                case "Today": return GetResourceString("String.TimeHeader.Today", "Today");
                case "Yesterday": return GetResourceString("String.TimeHeader.Yesterday", "Yesterday");
                case "This Week": return GetResourceString("String.TimeHeader.ThisWeek", "This Week");
                case "This Month": return GetResourceString("String.TimeHeader.ThisMonth", "This Month");
                default: return GetResourceString("String.TimeHeader.Older", "Older");
            }
        }

        private string GetTimeAgo(long dateFetch)
        {
            if (dateFetch <= 0) return GetResourceString("String.TimeAgo.Unknown", "Unknown");

            var date = DateTimeOffset.FromUnixTimeMilliseconds(dateFetch);
            var now = DateTimeOffset.Now;

            // Failsafe for Unix Epoch 1970 dates (which are near 0 but might be slightly shifted by timezone)
            if (date.Year <= 1970) return GetResourceString("String.TimeAgo.Unknown", "Unknown");
            
            var diff = now - date;
            
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
            {
                var val = (int)diff.TotalDays;
                return string.Format(GetResourceString("String.TimeAgo.Days", "{0}d ago"), val);
            }
        }

        private bool _isRefreshing;
        public bool IsRefreshing
        {
            get => _isRefreshing;
            set => this.RaiseAndSetIfChanged(ref _isRefreshing, value);
        }

        private string _statusMessage = "";
        public string StatusMessage
        {
            get => _statusMessage;
            set => this.RaiseAndSetIfChanged(ref _statusMessage, value);
        }

        private async Task RefreshUpdatesAsync()
        {
             if (IsRefreshing) return;
             IsRefreshing = true;
             StatusMessage = "Checking for updates...";
             
             try
             {
                 var progress = new Progress<(int current, int total)>(p => 
                 {
                     Dispatcher.UIThread.Post(() => 
                     {
                         StatusMessage = $"Updating {p.current} of {p.total}...";
                     });
                 });

                 // Trigger Library Update
                 int newChapters = await _libraryService.UpdateAllLibraryMangaAsync(_sourceManager, progress);
                 
                 await LoadUpdatesAsync();
                 
                 if (newChapters > 0)
                 {
                     StatusMessage = $"Found {newChapters} new chapters!";
                 }
                 else
                 {
                     StatusMessage = "Library is up to date.";
                 }
                 
                 // Clear message after delay
                 await Task.Delay(3000);
                 if (!IsRefreshing) StatusMessage = ""; 
             }
             finally
             {
                 IsRefreshing = false;
             }
        }

        public void Dispose()
        {
            if (GroupedUpdates != null)
            {
                foreach (var group in GroupedUpdates)
                {
                    group.Items?.Clear();
                }
                GroupedUpdates.Clear();
            }

            System.Diagnostics.Debug.WriteLine("[UpdatesVM] Disposed and memory references cleared.");
        }
    }
    
    // Helper Class for Grouping
    public class UpdatesGroupParams
    {
        public string Header { get; set; } = "";
        public ObservableCollection<ChapterItem> Items { get; set; } = new();
    }
}
