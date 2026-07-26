using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reactive;
using System.Threading.Tasks;
using Yomic.Core.Services;
using Yomic.Core.Models;
using ReactiveUI;
using Avalonia.Threading;
using Avalonia.Controls;
using System.Collections.Generic;

namespace Yomic.ViewModels
{
    public class UpcomingGroup
    {
        public string Header { get; set; } = string.Empty;
        public ObservableCollection<UpcomingItem> Items { get; set; } = new();
    }

    public class UpcomingItem : ViewModelBase
    {
        public Manga MangaRef { get; set; } = null!;
        public string Title => MangaRef.Title;
        public string? CoverUrl => MangaRef.ThumbnailUrl;
        
        public string EstimatedRelease { get; set; } = string.Empty;
        public long NextUpdateEpoch { get; set; }

        public string ReleaseFrequency { get; set; } = string.Empty;
        public string WaitingForChapter { get; set; } = string.Empty;
        public bool IsOverdue { get; set; }
        public bool IsSeverelyOverdue { get; set; }
        
        // Command parameters
        public ReactiveCommand<UpcomingItem, Unit>? OpenMangaCommand { get; set; }
    }

    public class UpcomingViewModel : ViewModelBase
    {
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

        private readonly LibraryService _libraryService;
        private readonly MainWindowViewModel _mainVM;

        private ObservableCollection<UpcomingGroup> _groupedUpcoming = new();
        public ObservableCollection<UpcomingGroup> GroupedUpcoming
        {
            get => _groupedUpcoming;
            set 
            {
                this.RaiseAndSetIfChanged(ref _groupedUpcoming, value);
                this.RaisePropertyChanged(nameof(HasItems));
                this.RaisePropertyChanged(nameof(UpcomingCount));
            }
        }

        public bool HasItems => GroupedUpcoming.Count > 0;
        public int UpcomingCount => GroupedUpcoming.Sum(g => g.Items.Count);

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
            set => this.RaiseAndSetIfChanged(ref _isRefreshing, value);
        }

        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<UpcomingItem, Unit> OpenMangaCommand { get; }

        public UpcomingViewModel(LibraryService libraryService, MainWindowViewModel mainVM)
        {
            _libraryService = libraryService;
            _mainVM = mainVM;

            RefreshCommand = ReactiveCommand.CreateFromTask(LoadUpcomingAsync);
            OpenMangaCommand = ReactiveCommand.CreateFromTask<UpcomingItem>(OpenMangaAsync);

            _ = LoadUpcomingAsync();
        }

        public async Task LoadUpcomingAsync()
        {
            if (IsRefreshing) return;
            IsRefreshing = true;
            try
            {
                var libraryManga = await _libraryService.GetLibraryMangaAsync();
                var now = DateTimeOffset.Now.ToUnixTimeMilliseconds();

                // Filter out manga that have NextUpdate and are not completed/cancelled
                var upcomingManga = libraryManga
                    .Where(m => m.NextUpdate > 0 && m.Status != Manga.COMPLETED && m.Status != Manga.CANCELLED)
                    .OrderBy(m => m.NextUpdate)
                    .ToList();

                var grouped = new Dictionary<string, List<UpcomingItem>>();
                
                var todayEnd = new DateTimeOffset(DateTimeOffset.Now.Date.AddDays(1)).ToUnixTimeMilliseconds();
                var tomorrowEnd = new DateTimeOffset(DateTimeOffset.Now.Date.AddDays(2)).ToUnixTimeMilliseconds();
                var nextWeekEnd = new DateTimeOffset(DateTimeOffset.Now.Date.AddDays(7)).ToUnixTimeMilliseconds();

                foreach (var m in upcomingManga)
                {
                    // Calculate Frequency & Waiting For
                    string frequency = GetResourceString("String.Unknown", "Unknown");
                    string waitingFor = GetResourceString("String.WaitingForNewChapter", "Waiting for New Chapter");
                    
                    long realNextUpdate = m.NextUpdate;
                    if (m.Chapters.Count > 0)
                    {
                        var recentChapters = m.Chapters.Where(c => c.DateUpload > 0).OrderByDescending(c => c.DateUpload).Take(10).ToList();
                        if (recentChapters.Count > 0)
                        {
                            float maxChap = m.Chapters.Max(c => c.ChapterNumber);
                            if (maxChap <= 0)
                            {
                                float maxParsed = 0;
                                foreach (var ch in m.Chapters)
                                {
                                    var match = System.Text.RegularExpressions.Regex.Match(ch.Name, @"(?i)(?:ch\.|chapter|ep\.|episode)\s*(\d+(\.\d+)?)");
                                    if (match.Success && float.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float parsed))
                                    {
                                        if (parsed > maxParsed) maxParsed = parsed;
                                    }
                                    else
                                    {
                                        var fallbackMatch = System.Text.RegularExpressions.Regex.Match(ch.Name, @"\d+(\.\d+)?");
                                        if (fallbackMatch.Success && float.TryParse(fallbackMatch.Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float parsedFallback))
                                        {
                                            if (parsedFallback > maxParsed) maxParsed = parsedFallback;
                                        }
                                    }
                                }
                                
                                if (maxParsed > 0)
                                    maxChap = maxParsed;
                                else
                                    maxChap = m.Chapters.Count;
                            }
                            
                            if (maxChap > 0)
                                waitingFor = $"{GetResourceString("String.WaitingForChapter", "Waiting for Chapter")} {maxChap + 1}";
                            else
                                waitingFor = GetResourceString("String.WaitingForNewChapter", "Waiting for New Chapter");
                        }
                        if (recentChapters.Count >= 3)
                        {
                            var diffs = new List<long>();
                            for (int i = 0; i < recentChapters.Count - 1; i++)
                            {
                                long diff = recentChapters[i].DateUpload - recentChapters[i + 1].DateUpload;
                                if (diff > 0 && diff < 31536000000) diffs.Add(diff);
                            }
                            if (diffs.Count > 0)
                            {
                                diffs.Sort();
                                long medianDiff = diffs[diffs.Count / 2];
                                if (diffs.Count % 2 == 0) medianDiff = (diffs[(diffs.Count / 2) - 1] + diffs[diffs.Count / 2]) / 2;
                                
                                realNextUpdate = recentChapters[0].DateUpload + medianDiff;
                                
                                double days = TimeSpan.FromMilliseconds(medianDiff).TotalDays;
                                if (days <= 2.5) frequency = GetResourceString("String.Daily", "Daily");
                                else if (days <= 9.5) frequency = GetResourceString("String.Weekly", "Weekly");
                                else if (days <= 16.5) frequency = GetResourceString("String.BiWeekly", "Bi-Weekly");
                                else if (days <= 35) frequency = GetResourceString("String.Monthly", "Monthly");
                                else frequency = GetResourceString("String.Irregular", "Irregular");
                            }
                        }
                    }

                    var isOverdue = realNextUpdate < now;
                    var daysOverdue = isOverdue ? (int)TimeSpan.FromMilliseconds(now - realNextUpdate).TotalDays : 0;

                    var item = new UpcomingItem
                    {
                        MangaRef = m,
                        NextUpdateEpoch = realNextUpdate,
                        ReleaseFrequency = frequency,
                        WaitingForChapter = waitingFor,
                        IsOverdue = isOverdue,
                        IsSeverelyOverdue = isOverdue && daysOverdue > 180,
                        OpenMangaCommand = OpenMangaCommand
                    };

                    string groupName;
                    var date = DateTimeOffset.FromUnixTimeMilliseconds(realNextUpdate).ToLocalTime();
                    
                    if (isOverdue)
                    {
                        groupName = "Overdue";
                        item.EstimatedRelease = $"{daysOverdue} {GetResourceString("String.DaysOverdue", "days overdue")}";
                    }
                    else if (realNextUpdate < nextWeekEnd)
                    {
                        groupName = "Due Soon";
                        if (realNextUpdate < todayEnd)
                            item.EstimatedRelease = $"{GetResourceString("String.TodayAt", "Today at")} " + date.ToString("hh:mm tt");
                        else if (realNextUpdate < tomorrowEnd)
                            item.EstimatedRelease = $"{GetResourceString("String.TomorrowAt", "Tomorrow at")} " + date.ToString("hh:mm tt");
                        else
                            item.EstimatedRelease = date.ToString("dddd, MMM dd");
                    }
                    else
                    {
                        groupName = "Upcoming";
                        item.EstimatedRelease = date.ToString("MMM dd, yyyy");
                    }

                    if (!grouped.ContainsKey(groupName))
                    {
                        grouped[groupName] = new List<UpcomingItem>();
                    }
                    grouped[groupName].Add(item);
                }

                // Sorting the groups logically (Overdue at the bottom)
                var groupOrder = new[] { "Due Soon", "Upcoming", "Overdue" };
                
                Dispatcher.UIThread.Post(() =>
                {
                    GroupedUpcoming.Clear();
                    foreach (var groupName in groupOrder)
                    {
                        if (grouped.ContainsKey(groupName))
                        {
                            var sortedItems = groupName == "Overdue"
                                ? grouped[groupName].OrderByDescending(i => i.NextUpdateEpoch)
                                : grouped[groupName].OrderBy(i => i.NextUpdateEpoch);

                            string localizedHeader = groupName switch
                            {
                                "Due Soon" => GetResourceString("String.Group.DueSoon", "Due Soon"),
                                "Upcoming" => GetResourceString("String.Group.Upcoming", "Upcoming"),
                                "Overdue" => GetResourceString("String.Group.Overdue", "Overdue"),
                                _ => groupName
                            };

                            GroupedUpcoming.Add(new UpcomingGroup
                            {
                                Header = localizedHeader,
                                Items = new ObservableCollection<UpcomingItem>(sortedItems)
                            });
                        }
                    }

                    IsEmpty = !GroupedUpcoming.Any();
                    this.RaisePropertyChanged(nameof(HasItems));
                    this.RaisePropertyChanged(nameof(UpcomingCount));
                });
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[UpcomingVM] Error loading upcoming manga: {ex}");
            }
            finally
            {
                Dispatcher.UIThread.Post(() => IsRefreshing = false);
            }
        }

        private async Task OpenMangaAsync(UpcomingItem item)
        {
            if (item?.MangaRef == null) return;
            
            // Map Manga to MainWindow MangaItem
            var mangaItem = new MangaItem
            {
                Title = item.MangaRef.Title,
                CoverUrl = item.MangaRef.ThumbnailUrl,
                Status = item.MangaRef.Status,
                ChapterCount = item.MangaRef.Chapters.Count,
                MangaUrl = item.MangaRef.Url,
                SourceId = item.MangaRef.Source
            };

            _mainVM.GoToDetail(mangaItem);
            await Task.CompletedTask;
        }
    }
}
