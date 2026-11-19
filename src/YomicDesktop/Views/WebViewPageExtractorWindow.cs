using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

namespace YomicDesktop.Views
{
    /// <summary>
    /// WebView2 page extractor that runs off-screen initially so automatic challenges finish silently
    /// without flashing ads or popups, and reveals itself centered only if interactive verification is needed.
    /// </summary>
    public sealed class WebViewPageExtractorWindow : Window
    {
        private static readonly SemaphoreSlim _modalLock = new(1, 1);
        private static CoreWebView2Environment? _sharedEnv;
        private static readonly SemaphoreSlim _envLock = new(1, 1);
        private static readonly TimeSpan BackgroundGracePeriod = TimeSpan.FromSeconds(8);

        private const string InteractivePromptCheckScript = """
            (() => {
                const notice = document.querySelector('[data-reader-control]:not([hidden]) [role="status"], [role="status"]');
                if (notice && notice.offsetParent !== null && /verifikasi|verify|challenge|captcha/i.test(notice.textContent || '')) {
                    return true;
                }
                const title = (document.title || '').toLowerCase();
                return title.includes('just a moment') || title.includes('attention required');
            })()
            """;

        private readonly WebView2 _webView;
        private readonly DispatcherTimer _pollTimer;
        private readonly TaskCompletionSource<List<string>> _tcs = new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly string _targetUrl;
        private readonly string _extractScript;
        private readonly Window? _hostOwner;
        private readonly DateTime _startedAtUtc = DateTime.UtcNow;
        private readonly TimeSpan _timeout = TimeSpan.FromSeconds(90);

        private bool _isPollingTick;
        private bool _isCompleted;
        private bool _isRevealed;

        private WebViewPageExtractorWindow(
            Window? owner,
            string targetUrl,
            string sourceName,
            string extractScript,
            bool startHidden,
            Func<string, string, string> localize)
        {
            _hostOwner = owner;
            _targetUrl = targetUrl;
            _extractScript = extractScript;

            if (owner != null && owner.IsLoaded)
            {
                Owner = owner;
                owner.Closing += OnOwnerClosing;
            }

            Title = localize(
                $"Verifikasi & Muat Halaman — {sourceName}",
                $"Verify & Load Pages — {sourceName}");
            Width = 960;
            Height = 720;
            MinWidth = 640;
            MinHeight = 480;
            ShowInTaskbar = false;
            WindowStartupLocation = WindowStartupLocation.Manual;
            Background = new SolidColorBrush(Color.FromRgb(15, 23, 42));

            if (startHidden)
            {
                // Keep HWND active off-screen without stealing focus so WebView2/Turnstile execute normally.
                ShowActivated = false;
                Left = -32000;
                Top = -32000;
                _isRevealed = false;
            }
            else
            {
                ShowActivated = true;
                CenterOnOwnerOrScreen();
                _isRevealed = true;
            }

            var rootGrid = new Grid();
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            rootGrid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });

            var headerBorder = new Border
            {
                Background = new SolidColorBrush(Color.FromRgb(30, 41, 59)),
                BorderBrush = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                BorderThickness = new Thickness(0, 0, 0, 1),
                Padding = new Thickness(14, 10, 14, 10)
            };

            var headerPanel = new DockPanel { LastChildFill = true };
            var cancelBtn = new Button
            {
                Content = localize("Tutup", "Close"),
                Padding = new Thickness(14, 6, 14, 6),
                Margin = new Thickness(12, 0, 0, 0),
                Background = new SolidColorBrush(Color.FromRgb(51, 65, 85)),
                Foreground = Brushes.White,
                BorderThickness = new Thickness(0),
                Cursor = System.Windows.Input.Cursors.Hand
            };
            cancelBtn.Click += (_, _) => FinishAndClose(new List<string>());
            DockPanel.SetDock(cancelBtn, Dock.Right);
            headerPanel.Children.Add(cancelBtn);

            var statusText = new TextBlock
            {
                Text = localize(
                    "Selesaikan verifikasi di bawah jika diminta. Jendela ini akan tertutup otomatis saat gambar bab terdeteksi.",
                    "Complete verification below if prompted. This window will close automatically once chapter images are detected."),
                Foreground = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                FontSize = 13,
                VerticalAlignment = VerticalAlignment.Center,
                TextWrapping = TextWrapping.Wrap
            };
            headerPanel.Children.Add(statusText);
            headerBorder.Child = headerPanel;
            Grid.SetRow(headerBorder, 0);
            rootGrid.Children.Add(headerBorder);

            _webView = new WebView2
            {
                DefaultBackgroundColor = System.Drawing.Color.FromArgb(15, 23, 42)
            };
            Grid.SetRow(_webView, 1);
            rootGrid.Children.Add(_webView);

            Content = rootGrid;

            _pollTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(500)
            };
            _pollTimer.Tick += OnPollTimerTick;

            Loaded += OnWindowLoaded;
            Closed += OnWindowClosed;
        }

        public static async Task<List<string>> ExtractPagesAsync(
            Window? owner,
            Dispatcher dispatcher,
            string chapterUrl,
            string sourceName,
            string? readySelector,
            string? customExtractScript,
            Func<string, string, string> localize,
            bool startHidden = true)
        {
            if (string.IsNullOrWhiteSpace(chapterUrl) || dispatcher == null)
            {
                return new List<string>();
            }

            await _modalLock.WaitAsync();
            try
            {
                string script = !string.IsNullOrWhiteSpace(customExtractScript)
                    ? customExtractScript
                    : BuildDefaultExtractScript(readySelector);

                WebViewPageExtractorWindow? win = null;
                await dispatcher.InvokeAsync(() =>
                {
                    win = new WebViewPageExtractorWindow(owner, chapterUrl, sourceName, script, startHidden, localize);
                    win.Show();
                });

                if (win == null) return new List<string>();
                return await win._tcs.Task;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WebViewPageExtractorWindow] Error: {ex.Message}");
                return new List<string>();
            }
            finally
            {
                _modalLock.Release();
            }
        }

        private void CenterOnOwnerOrScreen()
        {
            if (_hostOwner != null && _hostOwner.IsLoaded && _hostOwner.WindowState != WindowState.Minimized)
            {
                double ownerLeft = _hostOwner.Left;
                double ownerTop = _hostOwner.Top;
                double ownerWidth = _hostOwner.ActualWidth > 0 ? _hostOwner.ActualWidth : _hostOwner.Width;
                double ownerHeight = _hostOwner.ActualHeight > 0 ? _hostOwner.ActualHeight : _hostOwner.Height;
                Left = ownerLeft + Math.Max(0, (ownerWidth - Width) / 2);
                Top = ownerTop + Math.Max(0, (ownerHeight - Height) / 2);
                return;
            }

            Rect workArea = SystemParameters.WorkArea;
            Left = workArea.Left + Math.Max(0, (workArea.Width - Width) / 2);
            Top = workArea.Top + Math.Max(0, (workArea.Height - Height) / 2);
        }

        private void RevealToUser()
        {
            if (_isRevealed || _isCompleted) return;
            _isRevealed = true;
            CenterOnOwnerOrScreen();
            Activate();
        }

        private static string BuildDefaultExtractScript(string? readySelector)
        {
            string selector = string.IsNullOrWhiteSpace(readySelector)
                ? "img[data-chapter-page], [data-reader-chapter-id] img"
                : readySelector;
            string escapedSelector = selector.Replace("\\", "\\\\").Replace("'", "\\'");
            return $$"""
                (() => {
                    const imgs = Array.from(document.querySelectorAll('{{escapedSelector}}'))
                        .map(img => img.getAttribute('data-chapter-page') || img.getAttribute('data-src') || img.src)
                        .filter(src => src && (src.startsWith('http://') || src.startsWith('https://')));
                    return imgs.length > 0 ? Array.from(new Set(imgs)) : null;
                })()
                """;
        }

        private static async Task<CoreWebView2Environment> GetOrCreateEnvironmentAsync()
        {
            if (_sharedEnv != null) return _sharedEnv;
            await _envLock.WaitAsync();
            try
            {
                if (_sharedEnv != null) return _sharedEnv;
                string userDataFolder = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "YomicV2",
                    "WebView2VerifyData");
                Directory.CreateDirectory(userDataFolder);
                var options = new CoreWebView2EnvironmentOptions("--disable-background-timer-throttling --disable-renderer-backgrounding")
                {
                    Language = "id-ID"
                };
                _sharedEnv = await CoreWebView2Environment.CreateAsync(null, userDataFolder, options);
                return _sharedEnv;
            }
            finally
            {
                _envLock.Release();
            }
        }

        private async void OnWindowLoaded(object sender, RoutedEventArgs e)
        {
            try
            {
                var env = await GetOrCreateEnvironmentAsync();
                await _webView.EnsureCoreWebView2Async(env);
                if (_isCompleted) return;

                _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
                _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
                _webView.CoreWebView2.Navigate(_targetUrl);
                _pollTimer.Start();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WebViewPageExtractorWindow] WebView2 init failed: {ex.Message}");
                FinishAndClose(new List<string>());
            }
        }

        private async void OnPollTimerTick(object? sender, EventArgs e)
        {
            if (_isCompleted || _isPollingTick) return;

            TimeSpan elapsed = DateTime.UtcNow - _startedAtUtc;
            if (elapsed > _timeout)
            {
                FinishAndClose(new List<string>());
                return;
            }
            if (_webView.CoreWebView2 == null) return;

            _isPollingTick = true;
            try
            {
                string raw = await _webView.CoreWebView2.ExecuteScriptAsync(_extractScript);
                var pages = ParseScriptImageResult(raw);
                if (pages.Count > 0)
                {
                    FinishAndClose(pages);
                    return;
                }

                if (!_isRevealed)
                {
                    bool shouldReveal = elapsed >= BackgroundGracePeriod;
                    if (!shouldReveal)
                    {
                        string promptRaw = await _webView.CoreWebView2.ExecuteScriptAsync(InteractivePromptCheckScript);
                        if (string.Equals(promptRaw?.Trim(), "true", StringComparison.OrdinalIgnoreCase))
                        {
                            shouldReveal = true;
                        }
                    }

                    if (shouldReveal)
                    {
                        RevealToUser();
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[WebViewPageExtractorWindow] Poll error: {ex.Message}");
            }
            finally
            {
                _isPollingTick = false;
            }
        }

        private static List<string> ParseScriptImageResult(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw) || raw == "null" || raw == "undefined")
            {
                return new List<string>();
            }

            try
            {
                using var doc = JsonDocument.Parse(raw);
                JsonElement root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.String)
                {
                    string? inner = root.GetString();
                    if (string.IsNullOrWhiteSpace(inner)) return new List<string>();
                    return JsonSerializer.Deserialize<List<string>>(inner)?
                        .Where(u => !string.IsNullOrWhiteSpace(u) && (u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
                        .Distinct(StringComparer.Ordinal)
                        .ToList() ?? new List<string>();
                }
                if (root.ValueKind == JsonValueKind.Array)
                {
                    return root.EnumerateArray()
                        .Where(el => el.ValueKind == JsonValueKind.String)
                        .Select(el => el.GetString()!)
                        .Where(u => !string.IsNullOrWhiteSpace(u) && (u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)))
                        .Distinct(StringComparer.Ordinal)
                        .ToList();
                }
            }
            catch
            {
                // Ignore incomplete DOM polling responses
            }

            return new List<string>();
        }

        private void OnOwnerClosing(object? sender, CancelEventArgs e)
        {
            FinishAndClose(new List<string>());
        }

        private void FinishAndClose(List<string> pages)
        {
            if (_isCompleted) return;
            _isCompleted = true;
            _pollTimer.Stop();
            _tcs.TrySetResult(pages);
            try
            {
                if (IsVisible) Close();
            }
            catch
            {
                // Ignore if already closing
            }
        }

        private void OnWindowClosed(object? sender, EventArgs e)
        {
            _pollTimer.Stop();
            if (_hostOwner != null)
            {
                _hostOwner.Closing -= OnOwnerClosing;
            }
            try
            {
                _webView.Dispose();
            }
            catch
            {
                // Ignore WebView2 dispose error on close
            }
            if (!_isCompleted)
            {
                _isCompleted = true;
                _tcs.TrySetResult(new List<string>());
            }
        }
    }
}
