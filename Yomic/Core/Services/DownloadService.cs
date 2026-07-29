using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Avalonia.Threading;
using Yomic.Core.Models;
using Yomic.ViewModels; // For notification presumably, or just independent

namespace Yomic.Core.Services
{
    public class DownloadRequest
    {
        public Manga Manga { get; set; } = default!;
        public Chapter Chapter { get; set; } = default!;
        public int Progress { get; set; }
        public string Status { get; set; } = "Queued";
        public int RetryCount { get; set; } = 0;
        
        [System.Text.Json.Serialization.JsonIgnore]
        public CancellationTokenSource CancellationTokenSource { get; set; } = new();
    }

    public class DownloadService
    {
        private readonly SourceManager _sourceManager;
        private readonly LibraryService _libraryService;
        private readonly NetworkService _networkService;
        private readonly string _downloadBaseDir;

        // Queue management - using List + lock for proper removal support
        private readonly List<DownloadRequest> _queue = new();
        private readonly object _queueLock = new();
        private readonly List<DownloadRequest> _history = new(); // Completed or Error
        private readonly object _historyLock = new(); // Thread lock
        private DownloadRequest? _currentDownload;
        private volatile bool _isProcessing;
        private volatile bool _isPaused;
        private System.Threading.Timer? _saveDebounceTimer;
        private readonly object _debounceLock = new();
        private static readonly TimeSpan PageListTimeout = TimeSpan.FromSeconds(45);
        private static readonly TimeSpan PageDownloadTimeout = TimeSpan.FromSeconds(30);

        // Events
        public event EventHandler<DownloadRequest>? QueueChanged;
        public event EventHandler<DownloadRequest>? ProgressChanged;
        public event EventHandler<DownloadRequest>? StatusChanged;
        public event EventHandler<bool>? IsDownloadingChanged;

        public bool IsDownloading => _currentDownload != null;

        public IEnumerable<DownloadRequest> AllDownloads
        {
            get
            {
                List<DownloadRequest> historySnapshot;
                lock (_historyLock)
                {
                    historySnapshot = _history.ToList();
                }

                List<DownloadRequest> queueSnapshot;
                lock (_queueLock)
                {
                    queueSnapshot = _queue.ToList();
                }

                return historySnapshot
                    .Concat(_currentDownload != null ? new[] { _currentDownload } : Array.Empty<DownloadRequest>())
                    .Concat(queueSnapshot);
            }
        }

        public DownloadService(SourceManager sourceManager, LibraryService libraryService, NetworkService networkService)
        {
            _sourceManager = sourceManager;
            _libraryService = libraryService;
            _networkService = networkService;
            
            // Base directory: AppData/Yomic/Downloads
            _downloadBaseDir = DownloadPathService.BaseDirectory;
            if (!Directory.Exists(_downloadBaseDir))
                Directory.CreateDirectory(_downloadBaseDir);
            
            LoadQueue();
        }

        private void SaveQueue()
        {
            lock (_debounceLock)
            {
                _saveDebounceTimer?.Dispose();
                _saveDebounceTimer = new System.Threading.Timer(_ => 
                {
                    lock (_debounceLock)
                    {
                        SaveQueueInternal();
                    }
                }, null, 500, System.Threading.Timeout.Infinite);
            }
        }

        private void SaveQueueInternal()
        {
            try
            {
                var options = new System.Text.Json.JsonSerializerOptions 
                { 
                    WriteIndented = true,
                    ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
                };
                
                // Save both Queue and History (only active history, maybe?)
                // Actually, let's just save the Queue + Active Download
                // History is less critical, but good for UX. Let's save all.
                
                List<DownloadRequest> historySnapshot;
                lock (_historyLock)
                {
                    historySnapshot = _history.ToList();
                }

                List<DownloadRequest> queueSnapshot;
                lock (_queueLock)
                {
                    queueSnapshot = _queue.ToList();
                }

                var data = new 
                {
                    Queue = queueSnapshot,
                    History = historySnapshot,
                    Current = _currentDownload
                };
                
                string json = System.Text.Json.JsonSerializer.Serialize(data, options);
                string path = Path.Combine(_downloadBaseDir, "queue_v2.json");
                File.WriteAllText(path, json);
            }
            catch (Exception ex)
            {
                LogService.Error("Download", $"Error saving queue: {ex.Message}");
            }
        }

        private void LoadQueue()
        {
            try
            {
                string path = Path.Combine(_downloadBaseDir, "queue_v2.json");
                if (!File.Exists(path)) return;

                string json = File.ReadAllText(path);
                var options = new System.Text.Json.JsonSerializerOptions 
                { 
                    PropertyNameCaseInsensitive = true,
                    ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles 
                };
                
                var data = System.Text.Json.JsonSerializer.Deserialize<QueueData>(json, options);
                
                if (data != null)
                {
                    if (data.Current != null && data.Current.Status == "Downloading")
                    {
                        // Reset status to queued if it was interrupted
                        data.Current.Status = "Queued";
                        data.Current.CancellationTokenSource = new CancellationTokenSource();
                        lock (_queueLock)
                        {
                            _queue.Add(data.Current);
                        }
                    }
                    
                    if (data.Queue != null)
                    {
                        lock (_queueLock)
                        {
                            foreach(var item in data.Queue)
                            {
                                item.CancellationTokenSource = new CancellationTokenSource(); // Recreate CTS
                                if (item.Status == "Downloading") item.Status = "Queued"; // Reset interrupted
                                _queue.Add(item);
                            }
                        }
                    }

                    if (data.History != null)
                    {
                        lock (_historyLock)
                        {
                            _history.AddRange(data.History);
                        }
                    }
                    
                    // Trigger update
                    QueueChanged?.Invoke(this, new DownloadRequest());
                }
            }
            catch (Exception ex)
            {
                LogService.Error("Download", $"Error loading queue: {ex.Message}");
            }
        }
        
        private class QueueData
        {
            public List<DownloadRequest>? Queue { get; set; }
            public List<DownloadRequest>? History { get; set; }
            public DownloadRequest? Current { get; set; }
        }

        public void QueueDownload(Manga manga, Chapter chapter)
        {
            lock (_queueLock)
            {
                if (DownloadPathService.IsChapterDownloaded(manga, chapter))
                    return;

                // Check if already in queue or downloading (use Url for identification, not Id)
                if (_queue.Any(x => x.Chapter.Url == chapter.Url) || _currentDownload?.Chapter.Url == chapter.Url)
                    return;

                var request = new DownloadRequest
                {
                    Manga = manga,
                    Chapter = chapter,
                    Status = "Queued"
                };

                _queue.Add(request);
                SaveQueue(); // Save
                QueueChanged?.Invoke(this, request);
            }

            ProcessQueue();
        }

        private readonly object _processingLock = new();

        private void ProcessQueue()
        {
            DownloadRequest? requestToStart = null;

            lock (_processingLock)
            {
                if (_isProcessing || _isPaused) return;

                lock (_queueLock)
                {
                    // Find first non-cancelled item in queue
                    var request = _queue.FirstOrDefault(x => !x.CancellationTokenSource.IsCancellationRequested);
                    if (request != null)
                    {
                        _queue.Remove(request);
                        _isProcessing = true; // CLAIMED
                        _currentDownload = request;
                        requestToStart = request;
                    }
                }
            }

            if (requestToStart != null)
            {
                SaveQueue(); // Save (Dequeued) Update UI state
                IsDownloadingChanged?.Invoke(this, true); 
                
                requestToStart.Status = "Downloading";
                StatusChanged?.Invoke(this, requestToStart);

                // Run async in background (fire and forget from void method perspective)
                _ = ExecuteDownloadAsync(requestToStart);
            }
        }

        private async Task ExecuteDownloadAsync(DownloadRequest request)
        {
            int maxRetries = 3;
            bool success = false;
            
            try
            {
                while (!success && !request.CancellationTokenSource.IsCancellationRequested)
                {
                    try
                    {
                        await DownloadChapterAsync(request);
                        success = true; // Exit loop
                    }
                    catch (Exception ex)
                    {
                        if (request.RetryCount < maxRetries)
                        {
                             request.RetryCount++;
                             request.Status = $"Retrying ({request.RetryCount}/{maxRetries})...";
                             StatusChanged?.Invoke(this, request);
                             
                             LogService.Warning("Download", $"Retry {request.RetryCount} for {request.Chapter.Name}");
                             await Task.Delay(2000 * request.RetryCount, request.CancellationTokenSource.Token); 
                        }
                        else
                        {
                            // Final failure
                            request.Status = "Error";
                            LogService.Error("Download", $"Max retries exceeded: {ex.Message}");
                            StatusChanged?.Invoke(this, request);
                            break; // Exit loop to finally
                        }
                    }
                }
            }
            finally
            {
                // Completion Logic
                if (request.Status == "Completed" || request.Status == "Error" || request.Status == "Cancelled")
                {
                    lock (_historyLock)
                    {
                        _history.Add(request);
                    }
                }
                else if (request.Status == "Paused")
                {
                    // Re-enqueue for later
                    request.CancellationTokenSource = new CancellationTokenSource(); // Reset token for next run
                    lock (_queueLock)
                    {
                        _queue.Add(request);
                    }
                    QueueChanged?.Invoke(this, request);
                }
                
                // Release Lock and Continue
                lock (_processingLock)
                {
                    _currentDownload = null;
                    _isProcessing = false; // RELEASED
                }

                IsDownloadingChanged?.Invoke(this, false); 
                SaveQueue(); // Save (History updated)
                
                // Trigger next item
                ProcessQueue();
            }
        }

        private async Task DownloadChapterAsync(DownloadRequest request)
        {
            try 
            {
                LogService.Info("Download", $"Starting: {request.Chapter.Name}");
                LogService.Debug("Download", $"Source ID: {request.Manga.Source}, URL: {request.Chapter.Url}");
                
                var source = _sourceManager.GetSource(request.Manga.Source);
                if (source == null)
                {
                    LogService.Error("Download", $"Source not found for ID {request.Manga.Source}");
                    throw new Exception("Source not found");
                }
                LogService.Debug("Download", $"Using source: {source.Name}");

                // 1. Get Pages
                var pages = await WithTimeout(
                    source.GetPageListAsync(request.Chapter.Url),
                    PageListTimeout,
                    request.CancellationTokenSource.Token,
                    $"Fetching page list timed out after {PageListTimeout.TotalSeconds:0} seconds.");
                LogService.Info("Download", $"Fetched {pages?.Count ?? 0} pages");
                
                if (pages == null || pages.Count == 0)
                {
                    LogService.Error("Download", "No pages found in chapter!");
                    throw new Exception("No pages found in chapter");
                }
                
                // Log first few page URLs for debugging
                if (pages.Count > 0)
                {
                    LogService.Debug("Download", $"First page: {pages[0].Substring(0, Math.Min(60, pages[0].Length))}...");
                }
                
                // 2. Prepare directories. Write to a temp folder first, then promote to final only after validation.
                var chapterDir = DownloadPathService.GetChapterDirectory(request.Manga, request.Chapter);
                var tempChapterDir = DownloadPathService.GetChapterTempDirectory(request.Manga, request.Chapter);
                LogService.Debug("Download", $"Temp dir: {tempChapterDir}");
                LogService.Debug("Download", $"Final dir: {chapterDir}");

                if (DownloadPathService.IsChapterDownloaded(request.Manga, request.Chapter))
                {
                    request.Progress = 100;
                    request.Status = "Completed";
                    request.Chapter.IsDownloaded = true;
                    StatusChanged?.Invoke(this, request);
                    await _libraryService.UpdateChapterDownloadStatusByUrlAsync(request.Chapter.Url, true);
                    return;
                }

                Directory.CreateDirectory(tempChapterDir);
                foreach (var partFile in Directory.GetFiles(tempChapterDir, "*.part"))
                {
                    TryDeleteFile(partFile);
                }

                // 3. Download Images (Parallel with limit)
                int total = pages.Count;
                int completed = 0;
                int failedCount = 0;
                
                // Use Optimized Client with DoH
                using var client = _networkService.CreateOptimizedHttpClient();
                client.Timeout = Timeout.InfiniteTimeSpan;
                
                // Construct full Referer URL from source BaseUrl
                string refererUrl = source.BaseUrl;
                try
                {
                    if (request.Chapter.Url.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                    {
                        refererUrl = request.Chapter.Url;
                    }
                    else
                    {
                        refererUrl = source.BaseUrl.TrimEnd('/') + request.Chapter.Url;
                    }
                    // Will set referrer per-request
                }
                catch (Exception ex)
                {
                    LogService.Warning("Download", $"Referer initialization warning: {ex.Message}");
                }
                
                // Use semaphore to limit concurrent downloads (4 at a time for speed)
                using var semaphore = new System.Threading.SemaphoreSlim(4);
                var downloadTasks = new List<Task>();
                
                LogService.Info("Download", $"Downloading {total} pages...");

                for (int i = 0; i < total; i++)
                {
                    int index = i; // Capture for closure
                    var pageUrl = pages[i];
                    
                    downloadTasks.Add(Task.Run(async () =>
                    {
                        var acquiredSemaphore = false;
                        try
                        {
                            await semaphore.WaitAsync(request.CancellationTokenSource.Token);
                            acquiredSemaphore = true;

                            if (request.CancellationTokenSource.IsCancellationRequested) return;
                            
                            // Parse Headers
                            string requestUrl = pageUrl;
                            var customHeaders = new Dictionary<string, string>();
                            if (pageUrl.Contains("|"))
                            {
                                var parts = pageUrl.Split(new[] { '|', '&' }, StringSplitOptions.RemoveEmptyEntries);
                                requestUrl = parts[0];
                                for (int j = 1; j < parts.Length; j++)
                                {
                                    var pair = parts[j].Split(new[] { '=' }, 2);
                                    if (pair.Length == 2) customHeaders[pair[0].Trim()] = pair[1].Trim();
                                }
                            }

                            var ext = Path.GetExtension(requestUrl).Split('?')[0];
                            if (string.IsNullOrEmpty(ext)) ext = ".jpg";
                            var filePath = Path.Combine(tempChapterDir, $"{index:D3}{ext}");
                            var tempFilePath = filePath + ".part";

                            // Atomic Check: If final file exists, it's done. 
                            if (!File.Exists(filePath))
                            {
                                // Per-page retry loop (max 3 attempts)
                                const int maxPageRetries = 3;
                                int pageRetry = 0;
                                bool pageSuccess = false;
                                
                                while (!pageSuccess && pageRetry < maxPageRetries)
                                {
                                    try
                                    {
                                        if (request.CancellationTokenSource.IsCancellationRequested) return;

                                        using var pageCts = CancellationTokenSource.CreateLinkedTokenSource(request.CancellationTokenSource.Token);
                                        pageCts.CancelAfter(PageDownloadTimeout);

                                        try
                                        {
                                            var req = new HttpRequestMessage(HttpMethod.Get, requestUrl);
                                            if (customHeaders.ContainsKey("Referer"))
                                            {
                                                var customRef = customHeaders["Referer"];
                                                if (customRef != "none" && customRef != "null")
                                                {
                                                    req.Headers.Referrer = new Uri(customRef);
                                                }
                                            }
                                            else
                                            {
                                                req.Headers.Referrer = new Uri(refererUrl);
                                            }

                                            if (customHeaders.ContainsKey("User-Agent")) req.Headers.UserAgent.TryParseAdd(customHeaders["User-Agent"]);
                                            else if (customHeaders.ContainsKey("UserAgent")) req.Headers.UserAgent.TryParseAdd(customHeaders["UserAgent"]);
                                            else req.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

                                            using var response = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, pageCts.Token);
                                            response.EnsureSuccessStatusCode();
                                            var data = await response.Content.ReadAsByteArrayAsync(pageCts.Token);

                                            if (data.Length == 0)
                                            {
                                                throw new IOException("Downloaded page is empty.");
                                            }

                                            // Write to .part file first
                                            await File.WriteAllBytesAsync(tempFilePath, data, pageCts.Token);

                                            // Atomic Rename (Move)
                                            File.Move(tempFilePath, filePath, overwrite: true);
                                            pageSuccess = true;
                                        }
                                        catch (OperationCanceledException) when (!request.CancellationTokenSource.IsCancellationRequested)
                                        {
                                            throw new TimeoutException($"Page timed out after {PageDownloadTimeout.TotalSeconds:0} seconds.");
                                        }
                                    }
                                    catch (Exception retryEx)
                                    {
                                        TryDeleteFile(tempFilePath);
                                        pageRetry++;
                                        if (pageRetry < maxPageRetries)
                                        {
                                            LogService.Debug("Download", $"Page {index} retry {pageRetry}/{maxPageRetries}: {retryEx.Message}");
                                            try
                                            {
                                                await Task.Delay(1000 * pageRetry, request.CancellationTokenSource.Token); // Exponential backoff
                                            }
                                            catch (OperationCanceledException) when (request.CancellationTokenSource.IsCancellationRequested)
                                            {
                                                return;
                                            }
                                        }
                                        else
                                        {
                                            throw; // Re-throw to outer catch
                                        }
                                    }
                                }
                            }

                            // Update Progress (thread-safe increment)
                            int current = Interlocked.Increment(ref completed);
                            request.Progress = (int)((double)current / total * 100);
                            ProgressChanged?.Invoke(this, request);
                        }
                        catch (Exception ex)
                        {
                            Interlocked.Increment(ref failedCount);
                            LogService.Warning("Download", $"Page {index} failed after retries: {ex.Message}");
                        }
                        finally
                        {
                            if (acquiredSemaphore)
                            {
                                semaphore.Release();
                            }
                        }
                    }));
                }

                await Task.WhenAll(downloadTasks);
                
                if (request.CancellationTokenSource.IsCancellationRequested)
                {
                    if (request.Status != "Paused") request.Status = "Cancelled";
                    // If Paused, it keeps "Paused" status set in Pause()
                }

                if (request.Status == "Paused")
                {
                    return;
                }

                if (request.Status == "Cancelled")
                {
                    try { if (Directory.Exists(tempChapterDir)) Directory.Delete(tempChapterDir, true); } catch { }
                    return;
                }

                if (failedCount > 0)
                {
                    // Throw to trigger retry in ExecuteDownloadAsync
                    throw new Exception($"{failedCount} pages failed to download. Retrying chapter..."); 
                }

                var downloadedFiles = DownloadPathService.GetReadableFiles(tempChapterDir, includeTempDirectory: true);
                if (downloadedFiles.Count < total)
                {
                    throw new Exception($"Only {downloadedFiles.Count}/{total} pages downloaded. Retrying chapter...");
                }

                // 4. Mark Complete
                // Only if NOT Cancelled/Paused
                if (request.Status != "Cancelled" && request.Status != "Paused")
                {
                    if (Directory.Exists(chapterDir))
                    {
                        Directory.Delete(chapterDir, true);
                    }

                    Directory.Move(tempChapterDir, chapterDir);

                    request.Status = "Completed";
                    request.Chapter.IsDownloaded = true;
                    StatusChanged?.Invoke(this, request);

                    // 5. Update DB (use URL since ID might be 0 for dynamic chapters)
                    await _libraryService.UpdateChapterDownloadStatusByUrlAsync(request.Chapter.Url, true);
                    
                    LogService.Success("Download", $"Completed: {request.Chapter.Name}");
                }
            }
            catch (Exception ex)
            {
                 // If cancelled/paused, we might catch TaskCanceledException here or generic Exception
                 if (request.Status == "Paused" || request.Status == "Cancelled") 
                 {
                     // Expected interrupt
                 }
                 else
                 {
                   LogService.Error("Download", $"Chapter download failed", ex);
                   throw;
                 }
            }
        }

        private static async Task<T> WithTimeout<T>(Task<T> task, TimeSpan timeout, CancellationToken cancellationToken, string timeoutMessage)
        {
            // Prevent unobserved task exceptions on the original task if it faults after timeout
            _ = task.ContinueWith(t => { _ = t.Exception; }, TaskContinuationOptions.OnlyOnFaulted);

            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var timeoutTask = Task.Delay(timeout, timeoutCts.Token);
            var completedTask = await Task.WhenAny(task, timeoutTask);

            if (completedTask == task)
            {
                timeoutCts.Cancel();
                try
                {
                    await timeoutTask;
                }
                catch
                {
                    // Suppress TaskCanceledException of timeoutTask
                }
                return await task;
            }

            if (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(cancellationToken);
            }

            throw new TimeoutException(timeoutMessage);
        }

        private static void TryDeleteFile(string path)
        {
            try
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }
            catch
            {
                // Best-effort cleanup only.
            }
        }

        public void Pause()
        {
            _isPaused = true;
            
            // Cancel current download if active
            lock (_processingLock)
            {
                if (_currentDownload != null && _currentDownload.Status == "Downloading")
                {
                    _currentDownload.Status = "Paused"; // Mark as Paused so excution logic knows it's not a cancellation
                    _currentDownload.CancellationTokenSource.Cancel();
                    StatusChanged?.Invoke(this, _currentDownload);
                }
            }
            
            // Visually update queued items to Paused
            lock (_queueLock)
            {
                foreach(var item in _queue)
                {
                     if (item.Status == "Queued")
                     {
                         item.Status = "Paused";
                         StatusChanged?.Invoke(this, item);
                     }
                }
            }
        }

        public void Resume()
        {
            _isPaused = false;
            
            // Re-queue items that were Paused (if any are just stuck in Paused state in Queue)
            lock (_queueLock)
            {
                foreach(var item in _queue)
                {
                     if (item.Status == "Paused")
                     {
                         item.Status = "Queued";
                         StatusChanged?.Invoke(this, item);
                     }
                }
            }
            
            ProcessQueue();
        }

        public void ClearCompleted()
        {
            lock (_historyLock)
            {
                _history.RemoveAll(x => x.Status == "Completed" || x.Status == "Cancelled" || x.Status == "Error");
            }
            // Notify?
            QueueChanged?.Invoke(this, new DownloadRequest()); // Trigger refresh
            SaveQueue(); // Save
        }

        public void Cancel(DownloadRequest request)
        {
            // If it's current
            if (_currentDownload == request)
            {
                request.Status = "Cancelled";
                StatusChanged?.Invoke(this, request); // Update UI
                request.CancellationTokenSource.Cancel();
                // It will be handled in catch/finally
                return;
            }
            
            // Try to remove from history
            bool removedFromHistory = false;
            lock (_historyLock)
            {
                if (_history.Contains(request))
                {
                     _history.Remove(request);
                     removedFromHistory = true;
                }
            }
            
            if (removedFromHistory)
            {
                QueueChanged?.Invoke(this, request);
                SaveQueue();
                return;
            }
            
            // Try to remove from queue
            bool removedFromQueue = false;
            lock (_queueLock)
            {
                if (_queue.Contains(request))
                {
                    _queue.Remove(request);
                    removedFromQueue = true;
                }
            }
            
            if (removedFromQueue)
            {
                request.Status = "Cancelled";
                request.CancellationTokenSource.Cancel();
                QueueChanged?.Invoke(this, request);
                SaveQueue();
            }
        }
    }
}
