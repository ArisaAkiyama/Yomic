using ReactiveUI;
using System;
using System.Reactive;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;

namespace Yomic.ViewModels
{
    public static class MathConverters
    {
        public static Avalonia.Data.Converters.IValueConverter AddOne { get; } = 
            new Avalonia.Data.Converters.FuncValueConverter<int, string>(val => (val + 1).ToString());
            
        public static Avalonia.Data.Converters.IValueConverter SubtractOne { get; } = 
            new Avalonia.Data.Converters.FuncValueConverter<int, int>(val => Math.Max(0, val - 1));
            
        public static Avalonia.Data.Converters.IValueConverter FitScale { get; } = 
            new Avalonia.Data.Converters.FuncValueConverter<double, double>(val => val * 0.98);
    }

    public enum ReaderMode
    {
        Webtoon,
        Single,
        Double
    }

    public class PageViewModel : ReactiveObject, IDisposable
    {
        public string Url { get; }
        private readonly Core.Services.NetworkService _networkService;
        private readonly System.Net.Http.HttpClient _client;
        private System.Threading.CancellationToken _cancellationToken;
        
        // Limit concurrent image downloads globally (Max 4 downloads at once for Mihon-like speed)
        private static readonly System.Threading.SemaphoreSlim _downloadThrottle = new(4, 4);
        
        private Avalonia.Media.Imaging.Bitmap? _image;
        public Avalonia.Media.Imaging.Bitmap? Image
        {
            get => _image;
            set => this.RaiseAndSetIfChanged(ref _image, value);
        }

        private bool _isLoading = true;
        public bool IsLoading
        {
            get => _isLoading;
            set => this.RaiseAndSetIfChanged(ref _isLoading, value);
        }

        private string _error = string.Empty;
        public string Error
        {
            get => _error;
            set => this.RaiseAndSetIfChanged(ref _error, value);
        }

        private double _blurRadius;
        public double BlurRadius
        {
            get => _blurRadius;
            set => this.RaiseAndSetIfChanged(ref _blurRadius, value);
        }

        public ReactiveCommand<Unit, Unit> RetryCommand { get; }

        private bool _isLoaded = false;

        public PageViewModel(string url, Core.Services.NetworkService networkService, System.Net.Http.HttpClient client, bool shouldBlur = false, System.Threading.CancellationToken cancellationToken = default)
        {
            Url = url;
            _networkService = networkService;
            _client = client;
            _cancellationToken = cancellationToken;
            if (shouldBlur) BlurRadius = 40; // Strong Blur
            
            RetryCommand = ReactiveCommand.Create(() => 
            {
                Error = string.Empty;
                IsLoading = true;
                _isLoaded = true;
                _ = LoadImageAsync();
            });
            // Lazy Loading: Do not call Load() here.
        }

        public async void Load()
        {
            if (_isLoaded) return;
            _isLoaded = true;
            try
            {
                await LoadImageAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PageVM] Error loading page: {ex.Message}");
            }
        }

        public void Dispose()
        {
            if (_image != null)
            {
                _image.Dispose();
                _image = null;
            }
        }

        public event EventHandler? ImageLoaded;

        private async System.Threading.Tasks.Task LoadImageAsync()
        {
            bool semaphoreAcquired = false;
            try
            {
                _cancellationToken.ThrowIfCancellationRequested();
                
                // --- Disk Cache Logic Setup ---
                var cacheDir = ReaderViewModel.CacheDir;
                
                // Create a clean hash for the URL to use as filename
                var hashBytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(Url));
                var hashString = Convert.ToHexString(hashBytes).Replace("-", "").ToLowerInvariant();
                var cacheFilePath = System.IO.Path.Combine(cacheDir, hashString + ".cache");

                // Check Disk Cache First
                if (System.IO.File.Exists(cacheFilePath))
                {
                    try
                    {
                        using var stream = System.IO.File.OpenRead(cacheFilePath);
                        // Load original image quality as requested, size will be restricted by UI
                        var bitmap = new Avalonia.Media.Imaging.Bitmap(stream);
                        
                        Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                        {
                            Image = bitmap;
                            IsLoading = false;
                            ImageLoaded?.Invoke(this, EventArgs.Empty);
                        });
                        return; // Successfully loaded from cache, skip network!
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[PageVM] Corrupted cache file: {ex.Message}");
                        try { System.IO.File.Delete(cacheFilePath); } catch { } // Delete corrupted file
                    }
                }

                // Local File (Fallback for local readers)
                if (!Url.StartsWith("http"))
                {
                    if (System.IO.File.Exists(Url))
                    {
                         using var stream = System.IO.File.OpenRead(Url);
                         var bitmap = new Avalonia.Media.Imaging.Bitmap(stream);
                         
                         Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                         {
                             Image = bitmap;
                             IsLoading = false;
                             ImageLoaded?.Invoke(this, EventArgs.Empty);
                         });
                         return;
                    }
                }

                // Check Network for Remote URL
                // If offline and remote URL, fail fast
                // But we shouldn't reach here if offline logic is correct in ReaderVM

                // Wait for concurrency limit
                await _downloadThrottle.WaitAsync(_cancellationToken);
                semaphoreAcquired = true;
                
                _cancellationToken.ThrowIfCancellationRequested();
                    
                    string requestUrl = Url;
                    var customHeaders = new Dictionary<string, string>();
                
                // Parse Custom Headers: url|Key=Value|Key2=Value2 or url|Key=Value&Key2=Value2
                if (Url.Contains("|"))
                {
                    var parts = Url.Split(new[] { '|', '&' }, StringSplitOptions.RemoveEmptyEntries);
                    requestUrl = parts[0];
                    for (int j = 1; j < parts.Length; j++)
                    {
                        var pair = parts[j].Split(new[] { '=' }, 2);
                        if (pair.Length == 2)
                        {
                            customHeaders[pair[0].Trim()] = pair[1].Trim();
                        }
                    }
                }
                
                // Avalonia Bitmap does not natively support AVIF on all platforms.
                // Transparently proxy AVIF images through wsrv.nl to convert them to webp (except gmbr.pro which blocks wsrv.nl).
                if (requestUrl.Contains(".avif", StringComparison.OrdinalIgnoreCase) && !requestUrl.Contains("gmbr.pro") && !requestUrl.Contains("kacu.gmbr"))
                {
                    requestUrl = $"https://wsrv.nl/?url={Uri.EscapeDataString(requestUrl)}&output=webp";
                }
                
                // System.Diagnostics.Debug.WriteLine($"[PageVM] Fetching: {requestUrl}");
                // System.Diagnostics.Debug.WriteLine($"[PageVM] Headers: {string.Join(", ", customHeaders.Select(kv => $"{kv.Key}={kv.Value}"))}");
                
                // Use Shared HttpClient (Proxy Aware + Default Headers)
                var client = _client;
                
                // Construct Request
                var req = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, requestUrl);
                
                // Add Referer header
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
                    try 
                    {
                        req.Headers.Referrer = new Uri(new Uri(requestUrl).GetLeftPart(UriPartial.Authority));
                    }
                    catch { /* Ignore if invalid */ }
                }
                
                // Add Origin header (critical for some CDNs)
                if (customHeaders.ContainsKey("Origin"))
                {
                    req.Headers.TryAddWithoutValidation("Origin", customHeaders["Origin"]);
                }
                
                if (customHeaders.ContainsKey("User-Agent"))
                {
                    req.Headers.UserAgent.TryParseAdd(customHeaders["User-Agent"]);
                }
                else if (customHeaders.ContainsKey("UserAgent"))
                {
                    req.Headers.UserAgent.TryParseAdd(customHeaders["UserAgent"]);
                }
                
                // Inject Cloudflare bypass cookies if this is an nHentai image
                if (requestUrl.Contains("nhentai.net") && Yomic.Core.Services.CloudflareBypassService.Instance != null)
                {
                    var relevantCookies = Yomic.Core.Services.CloudflareBypassService.Instance.SavedCookies
                        .Where(c => new Uri(requestUrl).Host.Contains(c.Domain.Trim('.')))
                        .ToList();

                    if (relevantCookies.Count > 0)
                    {
                        var cookieString = string.Join("; ", relevantCookies.Select(c => $"{c.Name}={c.Value}"));
                        req.Headers.Add("Cookie", cookieString);
                    }

                    if (!string.IsNullOrEmpty(Yomic.Core.Services.CloudflareBypassService.Instance.BypassUserAgent))
                    {
                        req.Headers.Remove("User-Agent");
                        req.Headers.TryAddWithoutValidation("User-Agent", Yomic.Core.Services.CloudflareBypassService.Instance.BypassUserAgent);
                    }
                }
                
                // CRITICAL: Add Sec-Fetch-* headers that Chrome sends for image requests
                // These Client Hints are used by CDNs to verify requests come from real browsers
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "image");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "no-cors");
                req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "cross-site");
                req.Headers.TryAddWithoutValidation("Sec-Ch-Ua", "\"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\", \"Not_A Brand\";v=\"8\"");
                req.Headers.TryAddWithoutValidation("Sec-Ch-Ua-Mobile", "?0");
                req.Headers.TryAddWithoutValidation("Sec-Ch-Ua-Platform", "\"Windows\"");
                
                // Accept header for images
                req.Headers.TryAddWithoutValidation("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

                byte[] data;
                var response = await client.SendAsync(req, _cancellationToken);
                
                if (!response.IsSuccessStatusCode)
                {
                    if (response.StatusCode == System.Net.HttpStatusCode.Forbidden || requestUrl.Contains("gmbr.pro"))
                    {
                        var refHeader = customHeaders.ContainsKey("Referer") ? customHeaders["Referer"] : "https://www.manhwaindo.my/";
                        var curlData = await DownloadPageWithCurlAsync(requestUrl, refHeader, _cancellationToken);
                        if (curlData != null && curlData.Length > 0)
                        {
                            data = curlData;
                            goto ProcessPageData;
                        }
                    }
                    throw new Exception($"HTTP {response.StatusCode} {response.ReasonPhrase}");
                }
                
                _cancellationToken.ThrowIfCancellationRequested();
                data = await response.Content.ReadAsByteArrayAsync(_cancellationToken);

            ProcessPageData:
                
                // Log first few bytes to detect if it's the placeholder
                if (data.Length > 20)
                {
                    // System.Diagnostics.Debug.WriteLine($"[PageVM] First 20 bytes: {BitConverter.ToString(data.Take(20).ToArray())}");
                }
                
                using var remoteStream = new System.IO.MemoryStream(data);
                
                // Load original image quality as requested, size will be restricted by UI
                var remoteBitmap = new Avalonia.Media.Imaging.Bitmap(remoteStream);
                
                // Save to Disk Cache in background so we don't block the UI thread
                _ = System.Threading.Tasks.Task.Run(() => 
                {
                    try
                    {
                        System.IO.File.WriteAllBytes(cacheFilePath, data);
                    }
                    catch { /* Ignore IO errors for cache */ }
                });
                
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    Image = remoteBitmap;
                    IsLoading = false;
                    ImageLoaded?.Invoke(this, EventArgs.Empty);
                });
            }
            catch (Exception ex)
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                    Error = "Failed: " + ex.Message;
                    IsLoading = false;
                });
            }
            finally
            {
                if (semaphoreAcquired)
                {
                    _downloadThrottle.Release();
                }
            }
        }

        private static async System.Threading.Tasks.Task<byte[]?> DownloadPageWithCurlAsync(string url, string? referer, System.Threading.CancellationToken ct)
        {
            try
            {
                var tempFile = System.IO.Path.Combine(System.IO.Path.GetTempPath(), Guid.NewGuid().ToString("N") + ".tmp");
                var refUrl = !string.IsNullOrEmpty(referer) ? referer : "https://www.manhwaindo.my/";
                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "curl.exe",
                    Arguments = $"-s -f -k -A \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36\" -H \"Referer: {refUrl}\" \"{url}\" -o \"{tempFile}\"",
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var proc = System.Diagnostics.Process.Start(psi);
                if (proc != null)
                {
                    await proc.WaitForExitAsync(ct);
                    if (proc.ExitCode == 0 && System.IO.File.Exists(tempFile))
                    {
                        var bytes = await System.IO.File.ReadAllBytesAsync(tempFile, ct);
                        try { System.IO.File.Delete(tempFile); } catch { }
                        return bytes;
                    }
                    try { if (System.IO.File.Exists(tempFile)) System.IO.File.Delete(tempFile); } catch { }
                }
            }
            catch { }
            return null;
        }
    }

    public class ReaderViewModel : ViewModelBase, IDisposable
    {
        public static readonly string CacheDir = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), 
            "Yomic", "Cache", "Reader");

        private readonly MainWindowViewModel _mainViewModel;
        private readonly Core.Services.SourceManager? _sourceManager;
        private readonly Core.Services.NetworkService _networkService;
        private readonly Core.Services.LibraryService? _libraryService;
        private readonly Core.Services.SettingsService _settingsService;
        private ChapterItem? _currentChapter;
        private List<ChapterItem>? _allChapters;
        private int _currentChapterIndex;
        private System.Threading.CancellationTokenSource _cts = new();
        private readonly System.Reactive.Disposables.CompositeDisposable _disposables = new();

        private string _title = "";
        public string Title
        {
            get => _title;
            set => this.RaiseAndSetIfChanged(ref _title, value);
        }

        private string _chapterTitle = "";
        public string ChapterTitle
        {
            get => _chapterTitle;
            set => this.RaiseAndSetIfChanged(ref _chapterTitle, value);
        }

        public ObservableCollection<PageViewModel> Pages { get; } = new();

        private bool _isNextChapterPreloaded = false;

        private int _currentPageIndex;
        public int CurrentPageIndex
        {
            get => _currentPageIndex;
            set 
            {
                this.RaiseAndSetIfChanged(ref _currentPageIndex, value);
                this.RaisePropertyChanged(nameof(CurrentPage));
                this.RaisePropertyChanged(nameof(CurrentPageRight));
                this.RaisePropertyChanged(nameof(CurrentPageLeft));
                // Mihon-style: preload pages around the current viewport
                PreloadAroundIndex(value);

                // Smart Next-Chapter Preloading
                if (_settingsService != null && _settingsService.PreloadNextChapter && Pages.Count > 0 && value >= Pages.Count - 4)
                {
                    _ = System.Threading.Tasks.Task.Run(() => PreloadNextChapterAsync());
                }
            }
        }
        
        public PageViewModel? CurrentPage => Pages.Count > _currentPageIndex && _currentPageIndex >= 0 ? Pages[_currentPageIndex] : null;
        public PageViewModel? CurrentPageRight => Pages.Count > _currentPageIndex && _currentPageIndex >= 0 ? Pages[_currentPageIndex] : null;
        public PageViewModel? CurrentPageLeft => Pages.Count > _currentPageIndex + 1 && _currentPageIndex + 1 >= 0 ? Pages[_currentPageIndex + 1] : null;

        public ReactiveCommand<Unit, Unit> BackCommand { get; }
        
        private bool _isListAscending = false;
        public bool HasNextChapter => _allChapters != null && (_isListAscending ? _currentChapterIndex < _allChapters.Count - 1 : _currentChapterIndex > 0);
        public bool HasPrevChapter => _allChapters != null && (_isListAscending ? _currentChapterIndex > 0 : _currentChapterIndex < _allChapters.Count - 1);
        private int NextChapterIndex => _isListAscending ? _currentChapterIndex + 1 : _currentChapterIndex - 1;
        private int PrevChapterIndex => _isListAscending ? _currentChapterIndex - 1 : _currentChapterIndex + 1;
        
        public bool IsOnline => _networkService.IsOnline;

        
        private readonly long _sourceId;
        private readonly string _mangaTitle;
        private readonly string _mangaUrl;
        private readonly string? _mangaThumbnail;
        private readonly bool _isNsfwContent;
        private readonly System.Net.Http.HttpClient _sharedHttpClient;

        public ReaderViewModel(MainWindowViewModel mainViewModel, Core.Services.SourceManager? sourceManager, 
                               ChapterItem? chapter, System.Collections.Generic.List<ChapterItem>? allChapters, 
                               Core.Services.NetworkService? networkService,
                Core.Services.LibraryService? libraryService = null,
                Core.Services.SettingsService? settingsService = null,
                long sourceId = 3, string mangaTitle = "", string mangaUrl = "", bool isNsfw = false, string mangaThumbnail = "")
        {
            _mainViewModel = mainViewModel;
            _sourceManager = sourceManager;
            _currentChapter = chapter;
            _allChapters = allChapters;
            _networkService = networkService ?? new Core.Services.NetworkService();
            _libraryService = libraryService;
            _settingsService = settingsService ?? new Core.Services.SettingsService();
            _currentMode = (ReaderMode)Math.Clamp(_settingsService.DefaultReaderMode, 0, 2);
            _sourceId = sourceId;
            _mangaTitle = mangaTitle;
            _mangaUrl = mangaUrl;
            _mangaThumbnail = mangaThumbnail;
            _isNsfwContent = isNsfw;

            // Pre-create cache directory once
            System.IO.Directory.CreateDirectory(CacheDir);

            _sharedHttpClient = _networkService.CreateOptimizedHttpClient();

            // Find current chapter index in the list
            if (_allChapters != null && chapter != null)
            {
                _currentChapterIndex = _allChapters.FindIndex(c => c.Url == chapter.Url);
                if (_currentChapterIndex < 0) _currentChapterIndex = 0; // Fallback
                
                if (_allChapters.Count > 1)
                {
                    var comparer = new Core.Helpers.NaturalStringComparer();
                    _isListAscending = comparer.Compare(_allChapters[0].Title, _allChapters[_allChapters.Count - 1].Title) < 0;
                }
                System.Diagnostics.Debug.WriteLine($"[ReaderVM] Chapter Index: {_currentChapterIndex} of {_allChapters.Count}, Ascending: {_isListAscending}");
            }
            
            if (chapter != null && _sourceManager != null)
            {
                ChapterTitle = chapter.Title;
                // If Title prop is not set, set it
                if (string.IsNullOrEmpty(Title) && !string.IsNullOrEmpty(mangaTitle)) Title = mangaTitle;
                
                // Mark as read immediately
                _ = MarkCurrentChapterAsReadAsync();
                
                System.Threading.Tasks.Task.Run(() => LoadPages(false));
            }

            BackCommand = ReactiveCommand.Create(() => 
            {
                SaveProgress();
                if (CustomBackAction != null) CustomBackAction();
                else _mainViewModel.GoBack();
            });

            NextPageCommand = ReactiveCommand.Create(() => 
            {
                 int step = CurrentMode == ReaderMode.Double ? 2 : 1;
                 if (CurrentPageIndex < Pages.Count - step)
                 {
                     CurrentPageIndex += step;
                     // Ensure the current page(s) is loaded immediately for Paged mode
                     if (CurrentMode == ReaderMode.Double)
                     {
                         if (CurrentPageRight != null) CurrentPageRight.Load();
                         if (CurrentPageLeft != null) CurrentPageLeft.Load();
                     }
                     else
                     {
                         if (CurrentPage != null) CurrentPage.Load();
                     }
                 }
                 else if (HasNextChapter) SwitchToChapter(_allChapters![NextChapterIndex], NextChapterIndex, false); // Next Chapter -> Page 0
            });
            PrevPageCommand = ReactiveCommand.Create(() => 
            {
                 int step = CurrentMode == ReaderMode.Double ? 2 : 1;
                 if (CurrentPageIndex > 0)
                 {
                     CurrentPageIndex = Math.Max(0, CurrentPageIndex - step);
                     // Ensure the current page(s) is loaded immediately for Paged mode
                     if (CurrentMode == ReaderMode.Double)
                     {
                         if (CurrentPageRight != null) CurrentPageRight.Load();
                         if (CurrentPageLeft != null) CurrentPageLeft.Load();
                     }
                     else
                     {
                         if (CurrentPage != null) CurrentPage.Load();
                     }
                 }
                 else if (HasPrevChapter) SwitchToChapter(_allChapters![PrevChapterIndex], PrevChapterIndex, true); // Prev Chapter -> Last Page
            });
            
            NextPageOnlyCommand = ReactiveCommand.Create(() => 
            {
                 int step = CurrentMode == ReaderMode.Double ? 2 : 1;
                 if (CurrentPageIndex < Pages.Count - step)
                 {
                     CurrentPageIndex += step;
                     if (CurrentMode == ReaderMode.Double)
                     {
                         if (CurrentPageRight != null) CurrentPageRight.Load();
                         if (CurrentPageLeft != null) CurrentPageLeft.Load();
                     }
                     else
                     {
                         if (CurrentPage != null) CurrentPage.Load();
                     }
                 }
            });
            
            PrevPageOnlyCommand = ReactiveCommand.Create(() => 
            {
                 int step = CurrentMode == ReaderMode.Double ? 2 : 1;
                 if (CurrentPageIndex > 0)
                 {
                     CurrentPageIndex = Math.Max(0, CurrentPageIndex - step);
                     if (CurrentMode == ReaderMode.Double)
                     {
                         if (CurrentPageRight != null) CurrentPageRight.Load();
                         if (CurrentPageLeft != null) CurrentPageLeft.Load();
                     }
                     else
                     {
                         if (CurrentPage != null) CurrentPage.Load();
                     }
                 }
            });

            ToggleMenuCommand = ReactiveCommand.Create(() => 
            { 
                bool newState = !IsMenuVisible; // If any is visible, hide all. If none, show all.
                IsMenuVisible = newState;
            });
            
            SetModeCommand = ReactiveCommand.Create<ReaderMode>(mode => 
            {
                CurrentMode = mode;
                if (_settingsService != null)
                {
                    _settingsService.DefaultReaderMode = (int)mode;
                    _settingsService.Save();
                }
            });
            
            NextChapterCommand = ReactiveCommand.Create(() => 
            {
                 if (HasNextChapter) SwitchToChapter(_allChapters![NextChapterIndex], NextChapterIndex, false);
            });
            
            PrevChapterCommand = ReactiveCommand.Create(() => 
            {
                 if (HasPrevChapter) SwitchToChapter(_allChapters![PrevChapterIndex], PrevChapterIndex, false);
            });
            
            // Zoom Logic
            ZoomInCommand = ReactiveCommand.Create(() => ZoomScale = Math.Min(2.0, ZoomScale + 0.25));
            ZoomOutCommand = ReactiveCommand.Create(() => ZoomScale = Math.Max(0.5, ZoomScale - 0.25));
            ResetZoomCommand = ReactiveCommand.Create(() => ZoomScale = 1.0);
            
            // Fullscreen Toggle
            ToggleFullscreenCommand = ReactiveCommand.Create(() =>
            {
                IsFullscreen = !IsFullscreen;
            });
            
            // Sync with MainViewModel
            _disposables.Add(_mainViewModel.WhenAnyValue(x => x.IsFullscreen)
                          .Subscribe(_ => this.RaisePropertyChanged(nameof(IsFullscreen))));

            // Refresh (reload current chapter pages)
            RefreshCommand = ReactiveCommand.Create(() =>
            {
                // Cancel ongoing downloads
                _cts.Cancel();
                _cts.Dispose();
                _cts = new System.Threading.CancellationTokenSource();
                
                _isNextChapterPreloaded = false;

                // Clear error message by restoring original chapter title
                if (_currentChapter != null)
                    ChapterTitle = _currentChapter.Title;

                {
                    foreach (var p in Pages) p.Dispose();
                    Pages.Clear();
                    System.Threading.Tasks.Task.Run(() => LoadPages(false));
                }
            });

            ToggleBookmarkCommand = ReactiveCommand.CreateFromTask(async () =>
            {
                if (_currentChapter != null && _libraryService != null)
                {
                    _currentChapter.Bookmark = !_currentChapter.Bookmark;
                    
                    await _libraryService.SetChapterBookmarkStatusAsync(
                        _currentChapter.Url,
                        _currentChapter.Bookmark,
                        _sourceId,
                        _mangaUrl,
                        _currentChapter.Title,
                        -1
                    );
                }
            });

            RotateCommand = ReactiveCommand.Create(() =>
            {
                RotationAngle = (RotationAngle + 90) % 360;
            });

            // Scroll Logic
            ScrollUpCommand = ReactiveCommand.Create(() => RequestScroll?.Invoke(this, -1));
            ScrollDownCommand = ReactiveCommand.Create(() => RequestScroll?.Invoke(this, 1));
        }

        // Zoom Properties
        private double _zoomScale = 1.0;
        public double ZoomScale
        {
            get => _zoomScale;
            set
            {
                this.RaiseAndSetIfChanged(ref _zoomScale, value);
                this.RaisePropertyChanged(nameof(WebtoonWidth));
            }
        }

        public double WebtoonWidth => 800 * ZoomScale;

        public ReactiveCommand<Unit, double> ZoomInCommand { get; }
        public ReactiveCommand<Unit, double> ZoomOutCommand { get; }
        public ReactiveCommand<Unit, double> ResetZoomCommand { get; }

        public ReactiveCommand<Unit, Unit> NextPageCommand { get; }
        public ReactiveCommand<Unit, Unit> PrevPageCommand { get; }
        public ReactiveCommand<Unit, Unit> NextPageOnlyCommand { get; }
        public ReactiveCommand<Unit, Unit> PrevPageOnlyCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleMenuCommand { get; }
        
        public ReactiveCommand<ReaderMode, Unit> SetModeCommand { get; }
        public ReactiveCommand<Unit, Unit> NextChapterCommand { get; }
        public ReactiveCommand<Unit, Unit> PrevChapterCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleFullscreenCommand { get; }
        public ReactiveCommand<Unit, Unit> RefreshCommand { get; }
        public ReactiveCommand<Unit, Unit> ToggleBookmarkCommand { get; }
        public ReactiveCommand<Unit, Unit> RotateCommand { get; }
        
        public ReactiveCommand<Unit, Unit> ScrollUpCommand { get; }
        public ReactiveCommand<Unit, Unit> ScrollDownCommand { get; }
        
        // Tracks exact scroll percentage (0.0-1.0) for Webtoon mode — set by the View in OnScrollChanged
        public double CurrentScrollPercent { get; set; }

        // Event for View to handle scrolling
        public event EventHandler<int>? RequestScroll; // int: 1 for down, -1 for up
#pragma warning disable CS0067
        public event EventHandler<int>? RequestScrollToPage;
#pragma warning restore CS0067
        public event EventHandler<double>? RequestScrollToPercent;

        public bool IsFullscreen
        {
            get => _mainViewModel.IsFullscreen;
            set => _mainViewModel.IsFullscreen = value;
        }

        private int _rotationAngle = 0;
        public int RotationAngle
        {
            get => _rotationAngle;
            set => this.RaiseAndSetIfChanged(ref _rotationAngle, value);
        }

        private bool _isHeaderVisible = true;
        public bool IsHeaderVisible { get => _isHeaderVisible; set => this.RaiseAndSetIfChanged(ref _isHeaderVisible, value); }

        private bool _isFooterVisible = true;
        public bool IsFooterVisible { get => _isFooterVisible; set => this.RaiseAndSetIfChanged(ref _isFooterVisible, value); }
        
        // Backward compatibility / Master Toggle
        public bool IsMenuVisible
        {
            get => _isHeaderVisible || _isFooterVisible;
            set
            {
                IsHeaderVisible = value;
                IsFooterVisible = value;
                this.RaisePropertyChanged(nameof(IsMenuVisible));
            }
        }

        private ReaderMode _currentMode = ReaderMode.Webtoon;
        public ReaderMode CurrentMode 
        { 
            get => _currentMode; 
            set 
            {
                this.RaiseAndSetIfChanged(ref _currentMode, value); 
                this.RaisePropertyChanged(nameof(IsWebtoon));
                this.RaisePropertyChanged(nameof(IsPaged));
                this.RaisePropertyChanged(nameof(IsDualPage));
            }
        }
        
        public bool IsWebtoon => CurrentMode == ReaderMode.Webtoon;
        public bool IsPaged => CurrentMode == ReaderMode.Single;
        public bool IsDualPage => CurrentMode == ReaderMode.Double;
        
        public Action? CustomBackAction { get; set; }

        // Number of pages to preload ahead/behind the current viewport
        // Mihon uses a generous buffer so the user never sees "Loading..."
        private const int PRELOAD_AHEAD = 6;
        private const int PRELOAD_BEHIND = 2;

        /// <summary>
        /// Mihon-style viewport-priority preloading.
        /// Phase 1: Immediately load pages in the viewport area (current ± buffer).
        /// Phase 2: Then kick off a background task that loads ALL remaining pages
        ///          outward from the viewport, so they are ready when the user scrolls.
        /// This is exactly how Mihon works — all pages load eventually, but the
        /// viewport pages get absolute priority.
        /// </summary>
        public void PreloadAroundIndex(int centerIndex)
        {
            if (Pages.Count == 0) return;

            int start = Math.Max(0, centerIndex - PRELOAD_BEHIND);
            int end = Math.Min(Pages.Count - 1, centerIndex + PRELOAD_AHEAD);

            // Phase 1: Load the current page FIRST (highest priority)
            if (centerIndex >= 0 && centerIndex < Pages.Count)
            {
                Pages[centerIndex].Load();
            }

            // Phase 1b: Then preload nearby pages (viewport buffer)
            for (int i = start; i <= end; i++)
            {
                if (i != centerIndex)
                {
                    Pages[i].Load();
                }
            }

            // Phase 2: Background-load ALL remaining pages outward from viewport
            // This ensures that even far-away pages are eventually loaded,
            // just like Mihon. The concurrency limiter (SemaphoreSlim) ensures
            // viewport pages still get served first since they were queued earlier.
            var token = _cts.Token;
            var allPages = Pages.ToList();
            _ = System.Threading.Tasks.Task.Run(async () =>
            {
                try
                {
                    // Load outward from center: center+7, center-3, center+8, center-4, ...
                    for (int offset = PRELOAD_AHEAD + 1; offset < allPages.Count; offset++)
                    {
                        if (token.IsCancellationRequested) break;

                        int ahead = centerIndex + offset;
                        int behind = centerIndex - offset;

                        var toLoad = new List<PageViewModel>();
                        if (ahead < allPages.Count) toLoad.Add(allPages[ahead]);
                        if (behind >= 0 && behind < allPages.Count) toLoad.Add(allPages[behind]);

                        if (toLoad.Count > 0)
                        {
                            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                            {
                                foreach (var p in toLoad) p.Load();
                            });
                        }

                        // Small yield to let viewport pages get priority in the semaphore queue
                        await System.Threading.Tasks.Task.Delay(30, token).ConfigureAwait(false);
                    }
                }
                catch (OperationCanceledException)
                {
                    // Suppress cancellation exceptions
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ReaderVM] Error in preloading: {ex.Message}");
                }
            });
        }

        public void Dispose()
        {
            _disposables.Dispose();
            // Cancel all ongoing downloads
            _cts.Cancel();
            
            // Dispose all pages
            foreach (var page in Pages)
            {
                page.Dispose();
            }
            Pages.Clear();

            _sharedHttpClient?.Dispose();
            
            _cts.Dispose();
            System.Diagnostics.Debug.WriteLine("[ReaderVM] Disposed.");

            // Run cache cleanup asynchronously when leaving reader
            if (_settingsService != null)
            {
                var maxCacheSize = _settingsService.MaxCacheSizeMb;
                System.Threading.Tasks.Task.Run(() => SettingsViewModel.CleanupReaderCache(maxCacheSize));
            }
        }

        private async System.Threading.Tasks.Task MarkCurrentChapterAsReadAsync()
        {
            if (_currentChapter == null || _libraryService == null) return;
            
            try
            {
                // Update UI optimistically
                _currentChapter.IsRead = true;
                
                // Persist to DB
                // Pass extra info to support Online/Non-Library persistance
                string mangaUrlForDb = _mangaUrl;
                if (string.IsNullOrEmpty(mangaUrlForDb) && _sourceId > 0 && !string.IsNullOrEmpty(_currentChapter.Url))
                {
                    // Fallback infer from ChapterURL if we really have to, but hopefully _mangaUrl is set
                    // Assuming standard format like /manga/slug/chapter/slug
                    // This is risky, so relying on passed arg is best.
                }

                await _libraryService.SetChapterReadStatusAsync(
                    _currentChapter.Url, 
                    true,
                    _sourceId, 
                    _mangaUrl, 
                    _currentChapter.Title, 
                    -1 // Chapter number parsing is complex, skipping for now
                );

                // Auto-sync progress to MyAnimeList
                if (_mainViewModel.MyAnimeListService.IsConnected)
                {
                    _ = System.Threading.Tasks.Task.Run(async () =>
                    {
                        try
                        {
                            var manga = await _libraryService.GetMangaByUrlAsync(_mangaUrl, _sourceId);
                            if (manga != null)
                            {
                                using var db = new Core.Data.MangaDbContext();
                                var track = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                    db.Tracks, t => t.MangaId == manga.Id && t.TrackerName == "MyAnimeList");
                                    
                                if (track != null)
                                {
                                    int currentChapterNum = (int)Math.Floor(_currentChapter.ChapterNumber);
                                    if (currentChapterNum > track.LastChapterRead)
                                    {
                                        string status = track.Status;
                                        if (track.TotalChapters > 0 && currentChapterNum >= track.TotalChapters)
                                        {
                                            status = "completed";
                                        }

                                        bool ok = await _mainViewModel.MyAnimeListService.UpdateMangaStatusAsync(
                                            track.RemoteId, status, currentChapterNum, track.Score);
                                            
                                        if (ok)
                                        {
                                            var dbTrack = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                                                db.Tracks, t => t.Id == track.Id);
                                            if (dbTrack != null)
                                            {
                                                dbTrack.LastChapterRead = currentChapterNum;
                                                dbTrack.Status = status;
                                                await db.SaveChangesAsync();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            System.Diagnostics.Debug.WriteLine($"[ReaderVM] MAL auto-sync error: {ex.Message}");
                        }
                    });
                }
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ReaderVM] Failed to mark as read: {ex.Message}");
            }
        }

        // Correct position for LoadPages
        private async System.Threading.Tasks.Task LoadPages(bool startAtLastPage = false)
        {
            if (_sourceManager == null || _currentChapter == null) return;
            
            // Calculate Blur Status
            bool shouldBlur = _mainViewModel.SettingsService.SecureScreen && _isNsfwContent;
            
            // Check if Downloaded
            if (_currentChapter.IsDownloaded)
            {
                try
                {
                    var manga = new Core.Models.Manga
                    {
                        Title = _mangaTitle,
                        Url = _mangaUrl,
                        Source = _sourceId,
                        ThumbnailUrl = _mangaThumbnail
                    };
                    var chapter = new Core.Models.Chapter
                    {
                        Name = _currentChapter.Title,
                        Url = _currentChapter.Url,
                        ChapterNumber = _currentChapter.ChapterNumber
                    };
                    var chapterDir = Core.Services.DownloadPathService.FindCompletedChapterDirectory(manga, chapter);
                    
                    if (!string.IsNullOrEmpty(chapterDir) && System.IO.Directory.Exists(chapterDir))
                    {
                        var files = Core.Services.DownloadPathService.GetReadableFiles(chapterDir).ToList();
                            
                        if (files.Count > 0)
                        {
                            int targetIndex = startAtLastPage ? Math.Max(0, files.Count - 1) : 0;
                            double targetPercent = -1;
                            if (!startAtLastPage && _libraryService != null)
                            {
                                long savedRaw = await _libraryService.GetLastPageReadRawAsync(_currentChapter.Url);
                                if (savedRaw > 0)
                                {
                                    if (savedRaw > 1000) // Percentage (Webtoon)
                                    {
                                        targetPercent = savedRaw / 1_000_000.0;
                                        targetIndex = (int)(targetPercent * Math.Max(1, files.Count - 1));
                                    }
                                    else // Page index (Paged/Dual)
                                    {
                                        targetIndex = (int)savedRaw;
                                        targetPercent = (double)targetIndex / Math.Max(1, files.Count - 1);
                                    }
                                    targetIndex = Math.Clamp(targetIndex, 0, files.Count - 1);
                                }
                            }
                            double capturedPercent = targetPercent;

                            Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                            {
                                Pages.Clear();
                                foreach(var file in files)
                                {
                                    var pvm = new PageViewModel(file, _networkService, _sharedHttpClient, shouldBlur);
                                    pvm.PropertyChanged += (s, e) => {
                                        if (e.PropertyName == nameof(PageViewModel.IsLoading)) {
                                            PrintConsoleReaderProgress();
                                        }
                                    };
                                    Pages.Add(pvm);
                                }
                                CurrentPageIndex = targetIndex;
                                if (IsWebtoon)
                                {
                                    if (capturedPercent > 0)
                                        RequestScrollToPercent?.Invoke(this, capturedPercent);
                                    else
                                        RequestScrollToPercent?.Invoke(this, 0); // Always trigger restore flow for fade-in
                                }
                            });
                            return; // Loaded from disk, exit
                        }
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[ReaderVM] Error loading from disk: {ex}");
                }
            }
            
            if (!IsOnline)
            {
                Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                {
                     Pages.Clear();
                     ChapterTitle = "OFFLINE: Requires Internet Connection";
                });
                return;
            }

            // Remote Load
            var source = _sourceManager.GetSource(_sourceId); 
            if (source != null)
            {
                try 
                {
                    var urls = await source.GetPageListAsync(_currentChapter.Url);
                    
                    int targetIndex = startAtLastPage ? Math.Max(0, urls.Count - 1) : 0;
                    double targetPercent = -1;
                    if (!startAtLastPage && _libraryService != null)
                    {
                        long savedRaw = await _libraryService.GetLastPageReadRawAsync(_currentChapter.Url);
                        if (savedRaw > 0)
                        {
                            if (savedRaw > 1000) // Percentage (Webtoon)
                            {
                                targetPercent = savedRaw / 1_000_000.0;
                                targetIndex = (int)(targetPercent * Math.Max(1, urls.Count - 1));
                            }
                            else // Page index (Paged/Dual)
                            {
                                targetIndex = (int)savedRaw;
                                targetPercent = (double)targetIndex / Math.Max(1, urls.Count - 1);
                            }
                            targetIndex = Math.Clamp(targetIndex, 0, urls.Count - 1);
                        }
                    }
                    double capturedPercent = targetPercent;

                    // Capture token before switching to UI thread, because _cts might get disposed while waiting in the UI thread queue.
                    var token = _cts.Token;
                    Avalonia.Threading.Dispatcher.UIThread.Post(() => 
                    {
                        if (token.IsCancellationRequested) return;
                        
                        Pages.Clear();
                        if (urls.Count > 0)
                        {
                            foreach(var url in urls)
                            {
                                var pvm = new PageViewModel(url, _networkService, _sharedHttpClient, shouldBlur, token);
                                pvm.PropertyChanged += (s, e) => {
                                    if (e.PropertyName == nameof(PageViewModel.IsLoading)) {
                                        PrintConsoleReaderProgress();
                                    }
                                };
                                Pages.Add(pvm);
                            }
                            CurrentPageIndex = targetIndex;
                            
                            // Mihon-style: Only preload pages around the current viewport position
                            // instead of eagerly loading ALL pages sequentially.
                            // This ensures the visible page loads instantly, with nearby pages buffered.
                            PreloadAroundIndex(CurrentPageIndex);

                            if (IsWebtoon)
                            {
                                if (capturedPercent > 0)
                                    RequestScrollToPercent?.Invoke(this, capturedPercent);
                                else
                                    RequestScrollToPercent?.Invoke(this, 0); // Always trigger restore flow for fade-in
                            }
                        }
                        else
                        {
                             ChapterTitle = "Error: No pages found.";
                        }
                    });
                }
                catch (Exception ex)
                {
                     Avalonia.Threading.Dispatcher.UIThread.Post(() => ChapterTitle = "Error: " + ex.Message);
                }
            }
        }

        private void PrintConsoleReaderProgress()
        {
            int total = Pages.Count;
            if (total == 0) return;
            int loaded = Pages.Count(p => !p.IsLoading);
            
            int barWidth = 20;
            int filled = (int)((double)loaded / total * barWidth);
            string bar = new string('█', filled) + new string('░', barWidth - filled);
            int percent = (int)((double)loaded / total * 100);
            
            Console.Write($"\r[ReaderVM] Loading Pages... [{bar}] {loaded}/{total} ({percent}%)");
            if (loaded == total)
            {
                Console.WriteLine();
            }
        }

        /// <summary>
        /// Switches to a new chapter in-place (for standalone windows)
        /// </summary>
        private void SwitchToChapter(ChapterItem newChapter, int newIndex, bool startAtLastPage)
        {
            SaveProgress();

            // Cancel ongoing downloads before switching
            _cts.Cancel();
            _cts.Dispose();
            _cts = new System.Threading.CancellationTokenSource();
            
            _isNextChapterPreloaded = false;
            _currentChapter = newChapter;
            _currentChapterIndex = newIndex;
            
            // Dispose previous pages to free up RAM *before* loading new ones
            foreach(var p in Pages) p.Dispose();
            Pages.Clear();

            // Update UI
            ChapterTitle = newChapter.Title;
            
            // Notify property changes for navigation button states
            this.RaisePropertyChanged(nameof(HasPrevChapter));
            this.RaisePropertyChanged(nameof(HasNextChapter));
            
            // Mark the new chapter as read
            _ = MarkCurrentChapterAsReadAsync();
            
            // Reload pages
            System.Threading.Tasks.Task.Run(() => LoadPages(startAtLastPage));
        }

        private async System.Threading.Tasks.Task PreloadNextChapterAsync()
        {
            if (_isNextChapterPreloaded) return;
            _isNextChapterPreloaded = true;

            if (_settingsService == null) return;
            if (!HasNextChapter) return;
            if (_allChapters == null || _sourceManager == null) return;

            var nextChapter = _allChapters[NextChapterIndex];
            var nextChapterUrl = nextChapter.Url;

            // Trigger Auto Download if enabled
            if (_settingsService.AutoDownloadNextChapter && _mainViewModel?.DownloadService != null)
            {
                System.Diagnostics.Debug.WriteLine($"[ReaderVM] Auto downloading next chapter: {nextChapter.Title}");
                var manga = new Core.Models.Manga
                {
                    Title = _mangaTitle,
                    Url = _mangaUrl,
                    Source = _sourceId,
                    ThumbnailUrl = _mangaThumbnail
                };
                var nextChapterModel = new Core.Models.Chapter
                {
                    Name = nextChapter.Title,
                    Url = nextChapter.Url,
                    ChapterNumber = nextChapter.ChapterNumber
                };
                _mainViewModel.DownloadService.QueueDownload(manga, nextChapterModel);
            }

            if (!_settingsService.PreloadNextChapter) return;

            System.Diagnostics.Debug.WriteLine($"[Preload] Starting background preload for next chapter: {nextChapter.Title}");

            try
            {
                var source = _sourceManager.GetSource(_sourceId);
                if (source == null) return;

                // Step 1: Get pages
                var urls = await source.GetPageListAsync(nextChapterUrl).ConfigureAwait(false);
                if (urls == null || urls.Count == 0) return;

                System.Diagnostics.Debug.WriteLine($"[Preload] Found {urls.Count} pages to preload.");

                // Step 2: Download each page in the background
                var cacheDir = CacheDir;

                var client = _sharedHttpClient;

                foreach (var url in urls)
                {
                    try
                    {
                        // Parse Custom Headers if url contains referer/headers
                        string requestUrl = url;
                        var customHeaders = new Dictionary<string, string>();
                        if (url.Contains("|"))
                        {
                            var parts = url.Split('|', 2);
                            requestUrl = parts[0];
                            if (parts.Length > 1)
                            {
                                var headers = parts[1].Split('&');
                                foreach (var header in headers)
                                {
                                    var pair = header.Split('=', 2);
                                    if (pair.Length == 2)
                                    {
                                        customHeaders[pair[0].Trim()] = pair[1].Trim();
                                    }
                                }
                            }
                        }

                        // Check hash and cache path
                        var hashBytes = System.Security.Cryptography.MD5.HashData(System.Text.Encoding.UTF8.GetBytes(url));
                        var hashString = Convert.ToHexString(hashBytes).Replace("-", "").ToLowerInvariant();
                        var cacheFilePath = System.IO.Path.Combine(cacheDir, hashString + ".cache");

                        // Skip if already in cache
                        if (System.IO.File.Exists(cacheFilePath))
                        {
                            continue;
                        }

                        // Download image
                        var req = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, requestUrl);
                        if (customHeaders.ContainsKey("Referer"))
                        {
                            req.Headers.Referrer = new Uri(customHeaders["Referer"]);
                        }
                        else
                        {
                            try 
                            {
                                req.Headers.Referrer = new Uri(new Uri(requestUrl).GetLeftPart(UriPartial.Authority));
                            }
                            catch { /* Ignore if invalid */ }
                        }
                        
                        if (customHeaders.ContainsKey("Origin"))
                        {
                            req.Headers.TryAddWithoutValidation("Origin", customHeaders["Origin"]);
                        }
                        
                        if (customHeaders.ContainsKey("User-Agent"))
                        {
                            req.Headers.UserAgent.TryParseAdd(customHeaders["User-Agent"]);
                        }

                        req.Headers.TryAddWithoutValidation("Sec-Fetch-Dest", "image");
                        req.Headers.TryAddWithoutValidation("Sec-Fetch-Mode", "no-cors");
                        req.Headers.TryAddWithoutValidation("Sec-Fetch-Site", "cross-site");
                        req.Headers.TryAddWithoutValidation("Sec-Ch-Ua", "\"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\", \"Not_A Brand\";v=\"8\"");
                        req.Headers.TryAddWithoutValidation("Sec-Ch-Ua-Mobile", "?0");
                        req.Headers.TryAddWithoutValidation("Sec-Ch-Ua-Platform", "\"Windows\"");
                        req.Headers.TryAddWithoutValidation("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8");

                        // Cookie injection for Cloudflare bypass if needed
                        if (requestUrl.Contains("nhentai.net") && Yomic.Core.Services.CloudflareBypassService.Instance != null)
                        {
                            var relevantCookies = Yomic.Core.Services.CloudflareBypassService.Instance.SavedCookies
                                .Where(c => new Uri(requestUrl).Host.Contains(c.Domain.Trim('.')))
                                .ToList();

                            if (relevantCookies.Count > 0)
                            {
                                var cookieString = string.Join("; ", relevantCookies.Select(c => $"{c.Name}={c.Value}"));
                                req.Headers.Add("Cookie", cookieString);
                            }

                            if (!string.IsNullOrEmpty(Yomic.Core.Services.CloudflareBypassService.Instance.BypassUserAgent))
                            {
                                req.Headers.Remove("User-Agent");
                                req.Headers.TryAddWithoutValidation("User-Agent", Yomic.Core.Services.CloudflareBypassService.Instance.BypassUserAgent);
                            }
                        }

                        var response = await client.SendAsync(req).ConfigureAwait(false);
                        if (response.IsSuccessStatusCode)
                        {
                            var data = await response.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                            await System.IO.File.WriteAllBytesAsync(cacheFilePath, data).ConfigureAwait(false);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[Preload] Error preloading page {url}: {ex.Message}");
                    }
                }
                System.Diagnostics.Debug.WriteLine($"[Preload] Completed background preload for next chapter: {nextChapter.Title}");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[Preload] Failed to preload next chapter: {ex.Message}");
            }
        }

        private void SaveProgress()
        {
            if (_currentChapter == null || _libraryService == null || Pages.Count == 0) return;
            try
            {
                long storedValue = 0;
                if (IsWebtoon)
                {
                    double scrollPercent = CurrentScrollPercent;
                    // Reset if at the very end of the chapter
                    if (scrollPercent >= 0.995) scrollPercent = 0;
                    // Encode as percent * 1,000,000 so we can distinguish from legacy page indices
                    storedValue = (long)(scrollPercent * 1_000_000L);
                }
                else
                {
                    int pageIndex = CurrentPageIndex;
                    // For Dual/Paged mode, if they reached the end (last page or last page in dual), reset to 0
                    int threshold = IsDualPage ? Pages.Count - 2 : Pages.Count - 1;
                    if (pageIndex >= threshold)
                    {
                        pageIndex = 0;
                    }
                    storedValue = pageIndex;
                }
                _libraryService.SaveLastPageRead(_currentChapter.Url, storedValue);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[ReaderVM] Failed to save progress: {ex.Message}");
            }
        }
    }
}
