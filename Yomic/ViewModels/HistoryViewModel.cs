using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reactive;
using System.Threading.Tasks;
using Yomic.Core.Services;
using ReactiveUI;
using Avalonia.Threading;
using Yomic.Core.Models;
using System.Collections.Generic;
using System.Net.Http;
using System.IO;
using Avalonia.Media.Imaging;
using Microsoft.EntityFrameworkCore;
using Avalonia.Controls;

namespace Yomic.ViewModels
{
    public class HistoryViewModel : ViewModelBase, IDisposable
    {
        private readonly LibraryService _libraryService;
        private readonly NetworkService _networkService;
        private readonly SourceManager _sourceManager;
        private readonly SettingsService _settingsService;

        private ObservableCollection<MangaItem> _historyItems = new();
        public ObservableCollection<MangaItem> HistoryItems
        {
            get => _historyItems;
            set => this.RaiseAndSetIfChanged(ref _historyItems, value);
        }

        private bool _hasItems;
        public bool HasItems
        {
            get => _hasItems;
            set => this.RaiseAndSetIfChanged(ref _hasItems, value);
        }

        private bool _isOffline;
        public bool IsOffline
        {
            get => _isOffline;
            set => this.RaiseAndSetIfChanged(ref _isOffline, value);
        }

        private bool _isRefreshing;
        public bool IsRefreshing
        {
            get => _isRefreshing;
            set => this.RaiseAndSetIfChanged(ref _isRefreshing, value);
        }

        private bool _isListView;
        public bool IsListView
        {
            get => _isListView;
            set => this.RaiseAndSetIfChanged(ref _isListView, value);
        }

        private bool _isLoadingMore;
        public bool IsLoadingMore
        {
            get => _isLoadingMore;
            set => this.RaiseAndSetIfChanged(ref _isLoadingMore, value);
        }

        private bool _hasMoreItems = true;
        public bool HasMoreItems
        {
            get => _hasMoreItems;
            set => this.RaiseAndSetIfChanged(ref _hasMoreItems, value);
        }

        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<Unit, Unit> ClearHistoryCommand { get; }
        public ReactiveCommand<MangaItem, Unit> RemoveHistoryItemCommand { get; }
        public ReactiveCommand<MangaItem, Unit> OpenMangaCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleViewModeCommand { get; }
        public ReactiveCommand<Unit, Unit> LoadMoreCommand { get; }

        private readonly MainWindowViewModel _mainVM;

        public HistoryViewModel(LibraryService libraryService, NetworkService networkService, SourceManager sourceManager, SettingsService settingsService, MainWindowViewModel mainVM)
        {
            _libraryService = libraryService;
            _networkService = networkService;
            _sourceManager = sourceManager;
            _settingsService = settingsService;
            _mainVM = mainVM;

            _isListView = _settingsService.LibraryIsListView;

            HistoryItems = new ObservableCollection<MangaItem>();

            // Offline Logic
            IsOffline = !_networkService.IsOnline;
            _networkService.StatusChanged += (s, isOnline) =>
            {
                Dispatcher.UIThread.Post(() => IsOffline = !isOnline);
            };

            RefreshCommand = ReactiveCommand.CreateFromTask(async () => 
            {
                IsRefreshing = true;
                try 
                {
                    if (IsOffline)
                    {
                        await LoadHistory();
                    }
                    else
                    {
                        // Global Update requested by user
                        try 
                        {
                            LogService.Debug("History", "Refreshing global updates...");
                            await _libraryService.UpdateAllLibraryMangaAsync(_sourceManager);
                        }
                        catch (Exception ex)
                        {
                             System.Diagnostics.Debug.WriteLine($"[HistoryVM] Global update error: {ex}");
                        }
                        finally
                        {
                            await LoadHistory();
                        }
                    }
                }
                finally
                {
                    IsRefreshing = false;
                }
            });
            LoadMoreCommand = ReactiveCommand.CreateFromTask(LoadMoreHistoryAsync);
            ClearHistoryCommand = ReactiveCommand.CreateFromTask(ClearHistoryAsync);
            RemoveHistoryItemCommand = ReactiveCommand.CreateFromTask<MangaItem>(RemoveHistoryItemAsync);
            
            ToggleViewModeCommand = ReactiveCommand.Create(() => 
            {
                IsListView = !IsListView;
                _settingsService.LibraryIsListView = IsListView;
                _settingsService.Save();
            });
            
            OpenMangaCommand = ReactiveCommand.CreateFromTask<MangaItem>(async item => 
            {
                item.IsNewBadgeVisible = false;
                System.Console.WriteLine($"[HistoryVM] Opening manga: {item.Title}, Cover: {item.CoverUrl}");
                
                // 1. Update DB timestamp
                var manga = new Yomic.Core.Models.Manga 
                {
                    Url = item.MangaUrl,
                    Source = item.SourceId,
                    Title = item.Title,
                    ThumbnailUrl = item.CoverUrl // Note: This might be stale if UI is stale
                };
                await _libraryService.UpdateHistoryAsync(manga);

                // 2. Navigate
                Dispatcher.UIThread.Post(() => _mainVM.GoToDetail(item));
                
                // 3. Local UI Update (Move to top)
                Dispatcher.UIThread.Post(() => 
                {
                    var existing = HistoryItems.FirstOrDefault(x => x.MangaUrl == item.MangaUrl && x.SourceId == item.SourceId);
                    if (existing != null)
                    {
                        HistoryItems.Remove(existing);
                        existing.LastReadTime = "Just now";
                        // If we have a valid cover in item, use it, otherwise keep existing
                        if (!string.IsNullOrEmpty(item.CoverUrl)) existing.CoverUrl = item.CoverUrl;
                        
                        HistoryItems.Insert(0, existing);
                        HasItems = true;
                    }
                });
            });
            
            // Initial load
            _ = LoadHistory();
        }

        public async Task RemoveHistoryItemAsync(MangaItem item)
        {
            if (item == null) return;
            
            try 
            {
                 // 1. Update DB first
                 using var context = new Yomic.Core.Data.MangaDbContext();
                 await context.Database.ExecuteSqlRawAsync("UPDATE Mangas SET LastViewed = 0 WHERE Url = {0} AND Source = {1}", item.MangaUrl, item.SourceId);

                 // 2. Remove from local list after a tiny delay to let ContextMenu close 
                 // This prevents "PlatformImpl is null" error in Avalonia
                 await Task.Delay(100);
                 Dispatcher.UIThread.Post(() => 
                 {
                    HistoryItems.Remove(item);
                    HasItems = HistoryItems.Count > 0;
                 });
            }
            catch (Exception ex)
            {
                 System.Diagnostics.Debug.WriteLine($"[HistoryVM] Error removing item: {ex}");
            }
        }

        public async Task ClearHistoryAsync()
        {
            try
            {
                using var context = new Yomic.Core.Data.MangaDbContext();
                // Execute raw SQL for performance or batch update
                // We just want to set LastViewed = 0 for all items
                await context.Database.ExecuteSqlRawAsync("UPDATE Mangas SET LastViewed = 0 WHERE LastViewed > 0");
                
                Dispatcher.UIThread.Post(() =>
                {
                    HistoryItems.Clear();
                    HasItems = false;
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[HistoryVM] Error clearing history: {ex}");
            }
        }

        private async Task LoadMoreHistoryAsync()
        {
            if (IsLoadingMore || !HasMoreItems) return;
            IsLoadingMore = true;
            try
            {
                int pageSize = 18;
                using var context = new Yomic.Core.Data.MangaDbContext();
                var query = context.Mangas
                    .Include(m => m.Chapters)
                    .Where(m => m.LastViewed > 0)
                    .OrderByDescending(m => m.LastViewed)
                    .Skip(HistoryItems.Count)
                    .Take(pageSize);

                var history = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(query);

                Dispatcher.UIThread.Post(() =>
                {
                    foreach (var m in history)
                    {
                        if (HistoryItems.Any(x => x.MangaUrl == m.Url && x.SourceId == m.Source))
                            continue;

                        int unread = m.Chapters?.Count(c => !c.Read) ?? 0;
                        string? unreadString = unread > 0 ? unread.ToString() : null;

                        var item = new MangaItem
                        {
                            Title = m.Title,
                            CoverUrl = m.ThumbnailUrl,
                            SourceId = m.Source,
                            MangaUrl = m.Url,
                            LastReadTime = GetTimeAgo(m.LastViewed),
                            Status = m.Status,
                            ChapterCount = m.Chapters?.Count ?? 0,
                            UnreadCount = unreadString,
                        };
                        if (unread > 0) item.IsNewBadgeVisible = true;
                        
                        HistoryItems.Add(item);
                    }
                    HasMoreItems = history.Count == pageSize;
                    HasItems = HistoryItems.Count > 0;
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[HistoryVM] Error loading more history: {ex}");
            }
            finally
            {
                IsLoadingMore = false;
            }
        }

        public async Task LoadHistory()
        {
            try
            {
                using var context = new Yomic.Core.Data.MangaDbContext();
                // Include Chapters for UnreadCount
                var query = context.Mangas
                    .Include(m => m.Chapters)
                    .Where(m => m.LastViewed > 0)
                    .OrderByDescending(m => m.LastViewed)
                    .Take(50);

                var history = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.ToListAsync(query);

                Dispatcher.UIThread.Post(() =>
                {
                    var newList = new System.Collections.Generic.List<MangaItem>();
                    foreach (var m in history)
                    {
                        if (m.Title.Contains("Jujutsu")) System.Console.WriteLine($"[HistoryVM] Loading {m.Title} with Cover: {m.ThumbnailUrl}");
                        
                        int unread = m.Chapters?.Count(c => !c.Read) ?? 0;
                        string? unreadString = unread > 0 ? unread.ToString() : null;

                        var item = new MangaItem
                        {
                            Title = m.Title,
                            CoverUrl = m.ThumbnailUrl,
                            SourceId = m.Source,
                            MangaUrl = m.Url,
                            LastReadTime = GetTimeAgo(m.LastViewed),
                            Status = m.Status,
                            ChapterCount = m.Chapters?.Count ?? 0,
                            UnreadCount = unreadString,
                        };
                        if (unread > 0) item.IsNewBadgeVisible = true;
                        
                        newList.Add(item);
                    }

                    // Atomic swap approach
                    HistoryItems.Clear();
                    foreach (var item in newList) HistoryItems.Add(item);
                    
                    HasItems = HistoryItems.Count > 0;
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[HistoryVM] Error loading history: {ex}");
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

        private string GetTimeAgo(long dateFetch)
        {
            if (dateFetch <= 0) return GetResourceString("String.TimeAgo.Unknown", "Unknown");
            var date = DateTimeOffset.FromUnixTimeMilliseconds(dateFetch);
            var diff = DateTimeOffset.Now - date;
            
            if (diff.TotalMinutes < 1) return GetResourceString("String.TimeAgo.JustNow", "Just now");
            if (diff.TotalMinutes < 60)
            {
                var val = (int)diff.TotalMinutes;
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
            return date.ToString("MMM dd");
        }

        public void Dispose()
        {
            // 1. Clear local items
            if (HistoryItems != null)
            {
                HistoryItems.Clear();
            }

            HasItems = false;
            System.Diagnostics.Debug.WriteLine("[HistoryVM] Disposed and history items cleared.");
        }
    }
}
