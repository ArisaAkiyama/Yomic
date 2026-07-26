using System.Collections.ObjectModel;
using System.Linq;
using ReactiveUI;
using System.Reactive;
using System.IO;
using Avalonia.Media.Imaging;
using System.Net.Http;
using System;
using Avalonia.Controls;

namespace Yomic.ViewModels
{
    public class DownloadItemViewModel : ViewModelBase, IDisposable
    {
        private readonly Core.Services.DownloadRequest _request;
        public Core.Services.DownloadRequest Request => _request;
        
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
        
        public string Title => _request.Manga.Title ?? "Unknown Manga";
        public string ChapterName => _request.Chapter.Name;
        
        public string Status
        {
            get
            {
                var raw = _request.Status;
                if (string.IsNullOrEmpty(raw)) return string.Empty;
                if (raw.StartsWith("Retrying"))
                {
                    var localizedRetrying = GetResourceString("String.Status.Retrying", "Retrying");
                    var suffix = raw.Substring(8);
                    return $"{localizedRetrying}{suffix}";
                }
                return GetResourceString("String.Status." + raw, raw);
            }
        }
        
        public int Progress => _request.Progress;
        
        public string StatusColor => _request.Status switch 
        {
            "Downloading" => "#0078D7",
            "Completed" => "#A6E3A1",
            "Error" => "#F38BA8",
            "Paused" => "#F9E2AF",
            "Queued" => "#CDD6F4",
            _ => "#6C7086"
        };

        public bool IsActive => _request.Status == "Downloading";
        public bool ShowProgress => _request.Status == "Downloading" || _request.Status == "Paused";
        public bool IsIndeterminate => IsActive && Progress == 0;
        
        // Commands
        public System.Windows.Input.ICommand CancelCommand { get; }
        public ReactiveCommand<Unit, Unit> ExportCommand { get; }
        public ReactiveCommand<Unit, Unit> OpenChapterCommand { get; }

        public DownloadItemViewModel(Core.Services.DownloadRequest request, Core.Services.DownloadService service, MainWindowViewModel mainVM)
        {
            _request = request;
            CancelCommand = ReactiveCommand.Create(() => service.Cancel(request));
            
            OpenChapterCommand = ReactiveCommand.Create(() => 
            {
                var chapterItem = new ChapterItem(null, null, null, null, null)
                {
                    Title = _request.Chapter.Name,
                    Url = _request.Chapter.Url,
                    ChapterNumber = _request.Chapter.ChapterNumber,
                    MangaRef = _request.Manga,
                    IsDownloaded = _request.Status == "Completed"
                };

                mainVM.GoToReader(chapterItem, new System.Collections.Generic.List<ChapterItem> { chapterItem }, _request.Manga.Source, _request.Manga.Title ?? "", _request.Manga.Url ?? "", false, _request.Manga.ThumbnailUrl ?? "");
            });
            
            ExportCommand = ReactiveCommand.CreateFromTask(async () => 
            {
                try
                {
                    var path = await service.ExportToCbz(request);
                    mainVM.ShowNotification($"Saved to: {Path.GetFileName(path)}");
                    
                    // Optional: Open folder?
                }
                catch (Exception ex)
                {
                    mainVM.ShowNotification($"Export Failed: {ex.Message}");
                }
            });
        }
        
        // Helper to refresh UI
        public void RaisePropertyChanges()
        {
            this.RaisePropertyChanged(nameof(Status));
            this.RaisePropertyChanged(nameof(Progress));
            this.RaisePropertyChanged(nameof(StatusColor));
            this.RaisePropertyChanged(nameof(IsActive));
            this.RaisePropertyChanged(nameof(ShowProgress));
            this.RaisePropertyChanged(nameof(IsIndeterminate));
        }

        public void Dispose()
        {
            // No cover bitmap to dispose anymore
        }
    }

    public class DownloadsViewModel : ViewModelBase, IDisposable
    {
        private readonly MainWindowViewModel _mainViewModel;
        private readonly Core.Services.DownloadService _downloadService;



        public ObservableCollection<DownloadItemViewModel> QueuedItems { get; set; } = new();

        private bool _hasDownloads;
        public bool HasDownloads
        {
            get => _hasDownloads;
            set => this.RaiseAndSetIfChanged(ref _hasDownloads, value);
        }

        public int QueueCount => QueuedItems.Count(x => x.Status != "Completed" && x.Status != "Error" && x.Status != "Cancelled");
        public bool HasQueue => QueueCount > 0;

        public ReactiveCommand<Unit, Unit> ResumeAllCommand { get; }
        public ReactiveCommand<Unit, Unit> PauseAllCommand { get; }
        public ReactiveCommand<Unit, Unit> ClearCompletedCommand { get; }

        public DownloadsViewModel(MainWindowViewModel mainViewModel, Core.Services.DownloadService downloadService)
        {
            _mainViewModel = mainViewModel;
            _downloadService = downloadService;
            
            ResumeAllCommand = ReactiveCommand.Create(() => _downloadService.Resume());
            PauseAllCommand = ReactiveCommand.Create(() => _downloadService.Pause());
            ClearCompletedCommand = ReactiveCommand.Create(() => _downloadService.ClearCompleted());

            // Subscribe to events
            _downloadService.QueueChanged += OnQueueChanged;
            _downloadService.ProgressChanged += OnProgressChanged;
            _downloadService.StatusChanged += OnStatusChanged;
            _downloadService.IsDownloadingChanged += (s, isDownloading) => 
            {
                 Avalonia.Threading.Dispatcher.UIThread.Post(() => _mainViewModel.IsDownloading = isDownloading);
            };
            
            RefreshList();
        }

        private void OnQueueChanged(object? sender, Core.Services.DownloadRequest e)
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(RefreshList);
        }

        private void OnStatusChanged(object? sender, Core.Services.DownloadRequest e)
        {
             Avalonia.Threading.Dispatcher.UIThread.Post(() => 
             {
                 var item = QueuedItems.FirstOrDefault(x => x.Title == e.Manga.Title && x.ChapterName == e.Chapter.Name);
                 
                 // If cancelled, remove from list to simulate "Delete" behavior
                 if (e.Status == "Cancelled")
                 {
                     if (item != null) QueuedItems.Remove(item);
                     UpdateState();
                     return;
                 }

                 item?.RaisePropertyChanges();
                 this.RaisePropertyChanged(nameof(QueueCount));
                 this.RaisePropertyChanged(nameof(HasQueue));
                 
                 // Also check global status
                 if (e.Status == "Completed")
                 {
                     _mainViewModel.ShowNotification($"Downloaded: {e.Chapter.Name}");
                 }
                 
                 // Removed Manual IsDownloading calculation (Handled by Service Event)
             });
        }

        private void OnProgressChanged(object? sender, Core.Services.DownloadRequest e)
        {
            Avalonia.Threading.Dispatcher.UIThread.Post(() => 
            {
                var item = QueuedItems.FirstOrDefault(x => x.Title == e.Manga.Title && x.ChapterName == e.Chapter.Name);
                item?.RaisePropertyChanges();
                
                if (e.Status == "Downloading")
                {
                    _mainViewModel.DownloadProgress = e.Progress;
                }
            });
        }

        private void RefreshList()
        {
            var sourceList = _downloadService.AllDownloads.Where(x => x.Status != "Cancelled").ToList();
            
            // 1. Remove items not in source
            for (int i = QueuedItems.Count - 1; i >= 0; i--)
            {
                if (!sourceList.Contains(QueuedItems[i].Request))
                {
                    QueuedItems.RemoveAt(i);
                }
            }

            // 2. Add or Reorder
            for (int i = 0; i < sourceList.Count; i++)
            {
                var req = sourceList[i];
                if (i < QueuedItems.Count && QueuedItems[i].Request == req)
                {
                    continue; // Match
                }

                var existing = QueuedItems.FirstOrDefault(x => x.Request == req);
                if (existing != null)
                {
                    // Move
                    int oldIndex = QueuedItems.IndexOf(existing);
                    QueuedItems.Move(oldIndex, i);
                }
                else
                {
                    // Insert
                    QueuedItems.Insert(i, new DownloadItemViewModel(req, _downloadService, _mainViewModel));
                }
            }
            
            UpdateState();
            this.RaisePropertyChanged(nameof(QueueCount));
            this.RaisePropertyChanged(nameof(HasQueue));
        }

        private void UpdateState()
        {
            HasDownloads = QueuedItems.Any();
            this.RaisePropertyChanged(nameof(QueueCount));
            this.RaisePropertyChanged(nameof(HasQueue));
        }

        public void Dispose()
        {
            _downloadService.QueueChanged -= OnQueueChanged;
            _downloadService.ProgressChanged -= OnProgressChanged;
            _downloadService.StatusChanged -= OnStatusChanged;
            
            QueuedItems.Clear();

            System.Diagnostics.Debug.WriteLine("[DownloadsVM] Disposed and memory references cleared.");
        }
    }
}
