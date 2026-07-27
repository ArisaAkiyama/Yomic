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

                // Filter active library manga (excluding completed/cancelled series)
                var upcomingManga = libraryManga
                    .Where(m => m.Status != Manga.COMPLETED && m.Status != Manga.CANCELLED && m.Chapters != null && m.Chapters.Count > 0)
                    .OrderBy(m => m.NextUpdate > 0 ? m.NextUpdate : long.MaxValue)
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
                        float maxChap = 0;
                        foreach (var ch in m.Chapters)
                        {
                            float num = ch.ChapterNumber;
                            if (num <= 0)
                            {
                                num = ParseChapterNumberFromName(ch.Name);
                            }
                            if (num > maxChap) maxChap = num;
                        }

                        if (maxChap <= 0) maxChap = m.Chapters.Count;

                        if (maxChap > 0)
                        {
                            float nextChapNum = (float)Math.Floor(maxChap) + 1;
                            string formattedNext = nextChapNum.ToString("0.#", System.Globalization.CultureInfo.InvariantCulture);
                            waitingFor = $"{GetResourceString("String.WaitingForChapter", "Waiting for Chapter")} {formattedNext}";
                        }
                        else
                        {
                            waitingFor = GetResourceString("String.WaitingForNewChapter", "Waiting for New Chapter");
                        }

                        var chaptersWithDates = m.Chapters
                            .Select(c => new { Chapter = c, Date = c.DateUpload > 0 ? c.DateUpload : c.DateFetch })
                            .Where(x => x.Date > 0)
                            .OrderByDescending(x => x.Date)
                            .Take(20)
                            .ToList();

                        if (chaptersWithDates.Count > 0)
                        {
                            const long ClusterThresholdMs = 18L * 3600L * 1000L;
                            var batchTimestamps = new List<long>();
                            long currentBatchTime = chaptersWithDates[0].Date;
                            batchTimestamps.Add(currentBatchTime);

                            for (int i = 1; i < chaptersWithDates.Count; i++)
                            {
                                long uploadTime = chaptersWithDates[i].Date;
                                if (Math.Abs(currentBatchTime - uploadTime) >= ClusterThresholdMs)
                                {
                                    currentBatchTime = uploadTime;
                                    batchTimestamps.Add(currentBatchTime);
                                }
                            }

                            long quantizedCycleMs = 7L * 86400L * 1000L; // Default weekly (7 days)
                            frequency = GetResourceString("String.Weekly", "Weekly");

                            if (batchTimestamps.Count >= 2)
                            {
                                var diffs = new List<long>();
                                for (int i = 0; i < batchTimestamps.Count - 1; i++)
                                {
                                    long diff = batchTimestamps[i] - batchTimestamps[i + 1];
                                    if (diff > 0 && diff < 31536000000L) diffs.Add(diff);
                                }
                                if (diffs.Count > 0)
                                {
                                    diffs.Sort();
                                    long medianDiff = diffs[diffs.Count / 2];
                                    if (diffs.Count % 2 == 0) medianDiff = (diffs[(diffs.Count / 2) - 1] + diffs[diffs.Count / 2]) / 2;

                                    double days = TimeSpan.FromMilliseconds(medianDiff).TotalDays;
                                    if (days <= 2.5)
                                    {
                                        quantizedCycleMs = 1L * 86400L * 1000L;
                                        frequency = GetResourceString("String.Daily", "Daily");
                                    }
                                    else if (days <= 10.5)
                                    {
                                        quantizedCycleMs = 7L * 86400L * 1000L;
                                        frequency = GetResourceString("String.Weekly", "Weekly");
                                    }
                                    else if (days <= 21.0)
                                    {
                                        quantizedCycleMs = 14L * 86400L * 1000L;
                                        frequency = GetResourceString("String.BiWeekly", "Bi-Weekly");
                                    }
                                    else
                                    {
                                        quantizedCycleMs = 30L * 86400L * 1000L;
                                        frequency = GetResourceString("String.Monthly", "Monthly");
                                    }
                                }
                            }

                            long latestRelease = batchTimestamps[0];
                            long calculatedNext = latestRelease + quantizedCycleMs;

                            bool isIrregular = (now - latestRelease) > (quantizedCycleMs * 3);
                            if (isIrregular)
                            {
                                frequency = GetResourceString("String.Irregular", "Irregular");
                            }

                            while (calculatedNext <= now)
                            {
                                calculatedNext += quantizedCycleMs;
                            }

                            long previousSlot = calculatedNext - quantizedCycleMs;
                            if (!isIrregular && previousSlot > latestRelease && previousSlot <= now)
                            {
                                realNextUpdate = previousSlot;
                            }
                            else
                            {
                                realNextUpdate = calculatedNext;
                            }
                        }
                    }

                    // Sync realNextUpdate back to Database if it changed or was uninitialized
                    if (m.NextUpdate != realNextUpdate && realNextUpdate > 0)
                    {
                        m.NextUpdate = realNextUpdate;
                        _ = _libraryService.UpdateNextUpdateEpochAsync(m.Id, realNextUpdate);
                    }

                    var isOverdue = realNextUpdate > 0 && realNextUpdate < now;
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
                    var date = realNextUpdate > 0 ? DateTimeOffset.FromUnixTimeMilliseconds(realNextUpdate).ToLocalTime() : DateTimeOffset.Now;
                    
                    if (realNextUpdate <= 0)
                    {
                        groupName = "Upcoming";
                        item.ReleaseFrequency = GetResourceString("String.Unknown", "Unknown");
                        item.EstimatedRelease = GetResourceString("String.UnknownSchedule", "Unknown Schedule");
                    }
                    else if (isOverdue)
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

        private static float ParseChapterNumberFromName(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return 0f;
            
            var match = System.Text.RegularExpressions.Regex.Match(name, @"(?i)(?:ch\.|chapter|ep\.|episode|bab)\s*(\d+(\.\d+)?)");
            if (match.Success && float.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float parsed))
            {
                return parsed;
            }

            var fallbackMatch = System.Text.RegularExpressions.Regex.Match(name, @"\d+(\.\d+)?");
            if (fallbackMatch.Success && float.TryParse(fallbackMatch.Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float parsedFallback))
            {
                return parsedFallback;
            }

            return 0f;
        }
    }
}
