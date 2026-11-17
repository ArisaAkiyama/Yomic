using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using YomicDesktop.Interop;
using YomicDesktop.IPC;

namespace YomicDesktop;

public partial class MainWindow : Window
{
    private const string VirtualHostName = "app.yomic.local";
    private const string MaximizeGeometryData = "M 0.5,0.5 L 9.5,0.5 L 9.5,9.5 L 0.5,9.5 Z";
    private const string RestoreGeometryData = "M 2.5,2.5 L 2.5,0.5 L 9.5,0.5 L 9.5,7.5 L 7.5,7.5 M 0.5,2.5 L 7.5,2.5 L 7.5,9.5 L 0.5,9.5 Z";

    // Windows Standard Light Brushes (Clean Native Title Bar)
    private static readonly SolidColorBrush StandardTitleBg = new(Color.FromRgb(255, 255, 255));       // #FFFFFF
    private static readonly SolidColorBrush StandardTitleBorder = new(Color.FromRgb(229, 229, 229));   // #E5E5E5
    private static readonly SolidColorBrush StandardPrimaryInk = new(Color.FromRgb(31, 31, 31));        // #1F1F1F
    private static readonly SolidColorBrush StandardSecondaryInk = new(Color.FromRgb(31, 31, 31));     // #1F1F1F
    private static readonly SolidColorBrush LightCaptionHoverBg = new(Color.FromRgb(229, 229, 229));   // #E5E5E5
    private static readonly SolidColorBrush LightCaptionPressedBg = new(Color.FromRgb(202, 202, 202)); // #CACACA

    // Antigravity Carbon-Dark Title Bar Brushes
    private static readonly SolidColorBrush AntigravityTitleBg = new(Color.FromRgb(10, 10, 10));       // #0A0A0A
    private static readonly SolidColorBrush AntigravityCanvasBg = new(Color.FromRgb(16, 16, 16));      // #101010
    private static readonly SolidColorBrush AntigravityTitleBorder = new(Color.FromRgb(34, 34, 34));   // #222222
    private static readonly SolidColorBrush AntigravityPrimaryInk = new(Color.FromRgb(244, 244, 245)); // #F4F4F5
    private static readonly SolidColorBrush AntigravitySecondaryInk = new(Color.FromRgb(161, 161, 170)); // #A1A1AA
    private static readonly SolidColorBrush DarkCaptionHoverBg = new(Color.FromRgb(36, 36, 36));       // #242424
    private static readonly SolidColorBrush DarkCaptionPressedBg = new(Color.FromRgb(50, 50, 50));     // #323232

    // Ocean Breeze Light Brushes
    private static readonly SolidColorBrush OceanTitleBg = new(Color.FromRgb(243, 248, 252));       // #F3F8FC
    private static readonly SolidColorBrush OceanTitleBorder = new(Color.FromRgb(223, 236, 246));   // #DFECF6
    private static readonly SolidColorBrush OceanPrimaryInk = new(Color.FromRgb(11, 25, 44));       // #0B192C
    private static readonly SolidColorBrush OceanSecondaryInk = new(Color.FromRgb(71, 96, 122));    // #47607A
    private static readonly SolidColorBrush OceanMutedInk = new(Color.FromRgb(124, 147, 171));      // #7C93AB
    private static readonly SolidColorBrush OceanPillBg = new(Color.FromRgb(224, 242, 254));        // #E0F2FE
    private static readonly SolidColorBrush OceanPillBorder = new(Color.FromRgb(186, 230, 253));    // #BAE6FD
    private static readonly SolidColorBrush OceanAccentFg = new(Color.FromRgb(0, 102, 204));        // #0066CC

    // Deep-Ocean Dark Reader Brushes (Neutral Dark Aligned)
    private static readonly SolidColorBrush ReaderTitleBg = new(Color.FromRgb(10, 10, 10));          // #0A0A0A
    private static readonly SolidColorBrush ReaderTitleBorder = new(Color.FromRgb(34, 34, 34));     // #222222
    private static readonly SolidColorBrush ReaderPrimaryInk = new(Color.FromRgb(232, 242, 255));   // #E8F2FF
    private static readonly SolidColorBrush ReaderSecondaryInk = new(Color.FromRgb(148, 176, 208)); // #94B0D0
    private static readonly SolidColorBrush ReaderMutedInk = new(Color.FromRgb(100, 130, 166));     // #6482A6
    private static readonly SolidColorBrush ReaderPillBg = new(Color.FromRgb(15, 34, 58));          // #0F223A
    private static readonly SolidColorBrush ReaderPillBorder = new(Color.FromRgb(29, 62, 102));     // #1D3E66
    private static readonly SolidColorBrush ReaderAccentFg = new(Color.FromRgb(56, 189, 248));      // #38BDF8

    private bool _isFullscreen;
    private WindowState _preFullscreenState = WindowState.Normal;
    private BackendIpcController? _backendController;

    public MainWindow()
    {
        InitializeComponent();
        AdaptWindowToMonitorWorkArea();

        SourceInitialized += OnSourceInitialized;
        Loaded += OnLoaded;
        StateChanged += OnWindowStateChanged;
        _backendController = new BackendIpcController(this, SendRawJsonToWebUi);
        Closed += (_, _) => _backendController?.Dispose();
    }

    private void AdaptWindowToMonitorWorkArea()
    {
        Rect workArea = SystemParameters.WorkArea;
        double targetWidth = Math.Round(Math.Clamp(workArea.Width * 0.88, MinWidth, workArea.Width - 24));
        double targetHeight = Math.Round(Math.Clamp(workArea.Height * 0.88, MinHeight, workArea.Height - 24));

        Width = targetWidth;
        Height = targetHeight;
        Left = Math.Max(workArea.Left, workArea.Left + Math.Round((workArea.Width - targetWidth) / 2.0));
        Top = Math.Max(workArea.Top, workArea.Top + Math.Round((workArea.Height - targetHeight) / 2.0));
    }

    private void OnSourceInitialized(object? sender, EventArgs e)
    {
        bool initialDark = _backendController?.SettingsService.IsDarkMode ?? false;
        ApplyTitleBarTheme(initialDark);
        UpdateTitleBarStateVisuals();
    }

    private void OnWindowStateChanged(object? sender, EventArgs e)
    {
        UpdateTitleBarStateVisuals();
    }

    private void UpdateTitleBarStateVisuals()
    {
        if (_isFullscreen)
        {
            RootLayoutGrid.Margin = new Thickness(0);
            TitleBarRow.Height = new GridLength(0);
            MainWindowChrome.CaptionHeight = 0;
            MainWindowChrome.ResizeBorderThickness = new Thickness(0);
            return;
        }

        TitleBarRow.Height = new GridLength(32);
        MainWindowChrome.CaptionHeight = 32;
        MainWindowChrome.ResizeBorderThickness = new Thickness(6);

        if (WindowState == WindowState.Maximized)
        {
            RootLayoutGrid.Margin = new Thickness(7);
            MaxRestoreIconPath.Data = Geometry.Parse(RestoreGeometryData);
        }
        else
        {
            RootLayoutGrid.Margin = new Thickness(0);
            MaxRestoreIconPath.Data = Geometry.Parse(MaximizeGeometryData);
        }
    }

    public void ApplyTitleBarTheme(bool isDark, string? contextSubtitle = null)
    {
        NativeMethods.ApplyWindowFrameTheme(this, useDarkMode: isDark);

        RootLayoutGrid.Background = isDark ? AntigravityCanvasBg : Brushes.White;
        Background = isDark ? AntigravityCanvasBg : Brushes.White;
        TitleBarBorder.Background = isDark ? AntigravityTitleBg : StandardTitleBg;
        TitleBarBorder.BorderBrush = isDark ? AntigravityTitleBorder : StandardTitleBorder;

        TitleBarAppNameText.Foreground = isDark ? AntigravityPrimaryInk : StandardPrimaryInk;

        TitleBarAppNameText.Text = "Yomic";
        Title = "Yomic";

        Brush captionFg = isDark ? AntigravitySecondaryInk : StandardSecondaryInk;
        MinimizeCaptionBtn.Foreground = captionFg;
        MaxRestoreCaptionBtn.Foreground = captionFg;
        CloseCaptionBtn.Foreground = captionFg;

        Resources["CaptionBtnHoverBg"] = isDark ? DarkCaptionHoverBg : LightCaptionHoverBg;
        Resources["CaptionBtnPressedBg"] = isDark ? DarkCaptionPressedBg : LightCaptionPressedBg;
        Resources["CaptionBtnHoverFg"] = isDark ? Brushes.White : Brushes.Black;

        if (YomicWebView != null)
        {
            YomicWebView.DefaultBackgroundColor = isDark
                ? System.Drawing.Color.FromArgb(255, 16, 16, 16)
                : System.Drawing.Color.White;
        }
    }

    public void ToggleFullscreen(bool? forceState = null)
    {
        bool nextState = forceState ?? !_isFullscreen;
        if (_isFullscreen == nextState)
        {
            return;
        }

        _isFullscreen = nextState;

        if (_isFullscreen)
        {
            _preFullscreenState = WindowState;
            WindowState = WindowState.Normal;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            MainWindowChrome.CaptionHeight = 0;
            MainWindowChrome.ResizeBorderThickness = new Thickness(0);
            WindowState = WindowState.Maximized;
        }
        else
        {
            WindowState = WindowState.Normal;
            WindowStyle = WindowStyle.SingleBorderWindow;
            ResizeMode = ResizeMode.CanResize;
            MainWindowChrome.CaptionHeight = 32;
            MainWindowChrome.ResizeBorderThickness = new Thickness(6);
            WindowState = _preFullscreenState;
        }

        UpdateTitleBarStateVisuals();
        _ = SendMessageToWebUiAsync(new
        {
            type = "host:fullscreen-changed",
            isFullscreen = _isFullscreen
        });
    }

    private void OnWindowPreviewKeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.F11)
        {
            e.Handled = true;
            ToggleFullscreen();
        }
        else if (e.Key == Key.Escape && _isFullscreen)
        {
            e.Handled = true;
            ToggleFullscreen(false);
        }
    }

    private void OnMinimizeButtonClick(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void OnMaximizeRestoreButtonClick(object sender, RoutedEventArgs e)
    {
        if (_isFullscreen)
        {
            ToggleFullscreen(false);
            return;
        }

        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void OnCloseButtonClick(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            await InitializeWebViewAsync();
        }
        catch (Exception ex)
        {
            bool isEn = !string.Equals(System.Globalization.CultureInfo.CurrentUICulture.TwoLetterISOLanguageName, "id", StringComparison.OrdinalIgnoreCase);
            MessageBox.Show(
                isEn ? $"Failed to load Yomic v2 WebView2 engine:\n{ex.Message}" : $"Gagal memuat mesin WebView2 Yomic v2:\n{ex.Message}",
                "Yomic v2",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private static string ResolveWebUiDirectory()
    {
        string outputWebUi = Path.Combine(AppContext.BaseDirectory, "WebUI");
        if (Directory.Exists(outputWebUi) && File.Exists(Path.Combine(outputWebUi, "index.html")))
        {
            return outputWebUi;
        }

        // Fallback to project source folder during development
        DirectoryInfo? dir = new(AppContext.BaseDirectory);
        while (dir is not null)
        {
            string candidate = Path.Combine(dir.FullName, "WebUI");
            if (Directory.Exists(candidate) && File.Exists(Path.Combine(candidate, "index.html")))
            {
                return candidate;
            }
            dir = dir.Parent;
        }

        return outputWebUi;
    }

    private async Task InitializeWebViewAsync()
    {
        string userDataFolder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "YomicV2",
            "WebView2Data");

        Directory.CreateDirectory(userDataFolder);

        string browserArgs = string.Join(" ",
        [
            "--enable-smooth-scrolling",
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding"
        ]);

        var envOptions = new CoreWebView2EnvironmentOptions(browserArgs)
        {
            Language = "id-ID"
        };

        CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(
            browserExecutableFolder: null,
            userDataFolder: userDataFolder,
            options: envOptions);

        await YomicWebView.EnsureCoreWebView2Async(environment);

        CoreWebView2 coreWv = YomicWebView.CoreWebView2;
        coreWv.Settings.AreDefaultContextMenusEnabled = false;
        coreWv.Settings.IsStatusBarEnabled = false;
        coreWv.Settings.IsZoomControlEnabled = false;
        coreWv.Settings.IsWebMessageEnabled = true;

        string webUiFolder = ResolveWebUiDirectory();
        coreWv.SetVirtualHostNameToFolderMapping(
            VirtualHostName,
            webUiFolder,
            CoreWebView2HostResourceAccessKind.Allow);

        _backendController?.ImageProxy.Attach(coreWv);
        coreWv.WebMessageReceived += OnWebMessageReceived;
        coreWv.NavigationCompleted += OnWebViewNavigationCompleted;
                // Build and inject preload bootstrap state BEFORE document runs its scripts!
        try
        {
            if (_backendController != null)
            {
                var preloadPayload = await _backendController.BuildBootstrapAsync();
                string preloadJson = JsonSerializer.Serialize(preloadPayload, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                });
                await coreWv.AddScriptToExecuteOnDocumentCreatedAsync($"window.__YOMIC_PRELOAD__ = {preloadJson};");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[WebView2] Preload injection failed: {ex.Message}");
        }

        coreWv.Navigate($"https://{VirtualHostName}/index.html");
    }

    private async void OnWebViewNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        string[] args = Environment.GetCommandLineArgs();
        int darkIdx = Array.FindIndex(args, a => string.Equals(a, "--capture-dark-ui", StringComparison.OrdinalIgnoreCase));
        if (darkIdx >= 0 && darkIdx + 1 < args.Length && YomicWebView.CoreWebView2 is not null)
        {
            string outDir = args[darkIdx + 1];
            Directory.CreateDirectory(outDir);
            CoreWebView2 wv = YomicWebView.CoreWebView2;

            await Task.Delay(800);
            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"settings\"]')?.click();");
            await Task.Delay(450);

            // Ensure dark mode is ON
            await wv.ExecuteScriptAsync("if (!window.yomicApp?.settings.isDarkMode) { document.querySelector('[data-toggle-setting=\"isDarkMode\"]')?.click(); }");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_dark_settings.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"library\"]')?.click();");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_dark_library.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"browse\"]')?.click();");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_dark_browse.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"extensions\"]')?.click();");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_dark_extensions.png"));

            Close();
            return;
        }

        int idx = Array.FindIndex(args, a => string.Equals(a, "--capture-ui", StringComparison.OrdinalIgnoreCase));
        if (idx >= 0 && idx + 1 < args.Length && YomicWebView.CoreWebView2 is not null)
        {
            string outDir = args[idx + 1];
            Directory.CreateDirectory(outDir);
            CoreWebView2 wv = YomicWebView.CoreWebView2;

            await Task.Delay(700);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_library.png"));

            // Test and capture sidebar collapse toggle
            await wv.ExecuteScriptAsync("document.getElementById('btnToggleSidebar')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_sidebar_collapsed.png"));
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_library_minimal_header.png"));

            // Test inline library search textbox
            await wv.ExecuteScriptAsync("const inp = document.getElementById('librarySearchInput'); if (inp) { inp.value = 'Solo'; inp.dispatchEvent(new Event('input')); }");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_search_popup.png"));
            await wv.ExecuteScriptAsync("document.getElementById('btnClearLibSearch')?.click();");
            await Task.Delay(350);

            // Test and capture tabbed filter popover
            await wv.ExecuteScriptAsync("document.getElementById('btnToggleLibFlyout')?.click();");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_library_tabbed_filter.png"));
            await wv.ExecuteScriptAsync("document.getElementById('btnCloseLibFilterModal')?.click() || document.getElementById('btnApplyLibFilter')?.click();");
            await Task.Delay(300);

            // Test and capture modern Clean Floating Toast notification
            await wv.ExecuteScriptAsync("window.yomicApp?.showToast('Pustaka selesai diperbarui.');");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_toast_verify.png"));

            await wv.ExecuteScriptAsync("document.getElementById('btnToggleSidebar')?.click();");
            await Task.Delay(400);

            await wv.ExecuteScriptAsync("document.querySelector('[data-open-detail]')?.click();");
            await Task.Delay(500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_detail.png"));

            // Test and capture deslopped Tracking Status modal dialog
            await wv.ExecuteScriptAsync("document.getElementById('btnOpenTrackerPopup')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_tracker_modal_deslopped.png"));
            await wv.ExecuteScriptAsync("document.getElementById('btnCloseMalTracker')?.click();");
            await Task.Delay(300);

            // Scroll down to view the clean unified chapter list
            await wv.ExecuteScriptAsync("document.querySelector('.view-scroll-area')?.scrollTo(0, 480);");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_detail_chapters.png"));

            // Test scroll persistence: click bookmark on Chapter 34 and download on Chapter 33
            await wv.ExecuteScriptAsync("document.querySelector('[data-toggle-bookmark=\"34\"]')?.click();");
            await Task.Delay(250);
            // await wv.ExecuteScriptAsync("document.querySelector('[data-dl-single-ch=\"33\"]')?.click();");
            await Task.Delay(250);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_detail_chapters_after_click.png"));

            await wv.ExecuteScriptAsync("const btn = document.querySelector('[data-read-ch=\"42\"]'); if (btn) btn.click(); else window.yomicApp?.openReader('one-piece', 1198);");
            await Task.Delay(3500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader.png"));

            // Test and capture chapter dropdown
            await wv.ExecuteScriptAsync("document.getElementById('btnReaderChapterDropdown')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader_ch_dropdown.png"));
            await wv.ExecuteScriptAsync("document.body.click();");
            await Task.Delay(200);

            // Test and capture reader reading mode flyout
            await wv.ExecuteScriptAsync("document.getElementById('btnReaderModeFlyout')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader_mode_flyout.png"));
            await wv.ExecuteScriptAsync("document.body.click();");
            await Task.Delay(200);

            // Test and capture reader zoom flyout
            await wv.ExecuteScriptAsync("document.getElementById('btnReaderZoomFlyout')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader_zoom_flyout.png"));
            await wv.ExecuteScriptAsync("document.body.click();");
            await Task.Delay(200);

            // Test and capture reader in Fullscreen mode
            Dispatcher.Invoke(() => ToggleFullscreen(true));
            await Task.Delay(600);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader_fullscreen.png"));
            Dispatcher.Invoke(() => ToggleFullscreen(false));
            await Task.Delay(400);

            await wv.ExecuteScriptAsync("document.getElementById('btnCloseReader')?.click();");
            await Task.Delay(350);

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"updates\"]')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_updates.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"history\"]')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_history.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"downloads\"]')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_downloads.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"browse\"]')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_browse.png"));

            // Test and capture animated expandable search in Browse view
            await wv.ExecuteScriptAsync("document.getElementById('btnToggleBrowseSearch')?.click();");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_browse_search_expanded.png"));

            // Test and capture clean borderless empty state
            await wv.ExecuteScriptAsync("{ const inp = document.getElementById('browseSearchInput'); if (inp) { inp.value = 'xyztidakada'; inp.dispatchEvent(new Event('input')); } }");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_browse_empty_state.png"));

            await wv.ExecuteScriptAsync("document.getElementById('btnClearBrowseSearch')?.click();");
            await Task.Delay(200);

            await wv.ExecuteScriptAsync("document.querySelector('[data-open-source=\"komiku\"]')?.click();");
            await Task.Delay(2500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_feed.png"));

            // Test and capture Infinite Scroll auto-load on scroll down
            await wv.ExecuteScriptAsync("const c = document.getElementById('viewContainer'); if (c) { c.scrollTop = c.scrollHeight; c.dispatchEvent(new Event('scroll')); }");
            await Task.Delay(2500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_feed_infinite_scroll.png"));

            await wv.ExecuteScriptAsync("document.getElementById('btnToggleSourceFilter')?.click();");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_feed_filter.png"));

            // Test and capture Genre tab in the filter modal
            await wv.ExecuteScriptAsync(@"document.querySelector(""[data-source-flyout-tab='genre']"")?.click();");
            await Task.Delay(300);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_feed_filter_genre.png"));

            // Close filter modal via Selesai button
            await wv.ExecuteScriptAsync("document.getElementById('btnApplySourceFilterModal')?.click();");
            await Task.Delay(300);

            await wv.ExecuteScriptAsync("const inp = document.getElementById('sourceCatalogSearchInput'); if (inp) { inp.value = 'one piece'; inp.dispatchEvent(new Event('input')); }");
            await Task.Delay(500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_feed_search_modal.png"));

            await wv.ExecuteScriptAsync("document.getElementById('btnClearSourceSearch')?.click();");
            await Task.Delay(1500);

            // Test clicking a real manga from the source catalog and reading a real chapter!
            await wv.ExecuteScriptAsync("document.querySelector('.manga-card')?.click();");
            await Task.Delay(3500);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_source_manga_detail.png"));

            await wv.ExecuteScriptAsync("document.querySelector('[data-read-ch]')?.click();");
            await Task.Delay(4000);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_reader_real_comic.png"));

            await wv.ExecuteScriptAsync("document.getElementById('btnCloseReader')?.click();");
            await Task.Delay(400);
            await wv.ExecuteScriptAsync("document.getElementById('btnBackFromDetail')?.click() || document.querySelector('.manga-detail-back-btn')?.click();");
            await Task.Delay(300);

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"extensions\"]')?.click();");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_extensions.png"));

            // Test and capture clean borderless empty state in Extensions view (matching Jelajahi Sumber)
            await wv.ExecuteScriptAsync("{ const inp = document.getElementById('extSearchInput'); if (inp) { inp.value = 'kj'; inp.dispatchEvent(new Event('input')); } }");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_extensions_empty_state.png"));

            // Reset extension search via reset button
            await wv.ExecuteScriptAsync("document.getElementById('btnResetExtFilter')?.click();");
            await Task.Delay(300);

            await wv.ExecuteScriptAsync("document.querySelector('[data-nav=\"settings\"]')?.click();");
            await Task.Delay(450);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings.png"));

            await wv.ExecuteScriptAsync("document.querySelector('.view-scroll-area')?.scrollTo(0, 360);");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings_mid.png"));

            await wv.ExecuteScriptAsync("document.querySelector('.view-scroll-area')?.scrollTo(0, 99999);");
            await Task.Delay(400);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings_bottom.png"));

            // Test and capture clicking "Jaringan" tab
            await wv.ExecuteScriptAsync("document.querySelector('[data-set-tab=\"network\"]')?.click();");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings_network.png"));

            // Test and capture clicking "Pembaca" tab
            await wv.ExecuteScriptAsync("document.querySelector('[data-set-tab=\"reader\"]')?.click();");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings_reader.png"));

            // Test and capture clicking "Data & Cadangan" tab
            await wv.ExecuteScriptAsync("document.querySelector('[data-set-tab=\"storage\"]')?.click();");
            await Task.Delay(350);
            await CaptureWebViewPngAsync(wv, Path.Combine(outDir, "yomic_v2_settings_storage.png"));

            // Reset back to "Semua"
            await wv.ExecuteScriptAsync("document.querySelector('[data-set-tab=\"all\"]')?.click();");
            await Task.Delay(300);

            Close();
        }
    }

    private static async Task CaptureWebViewPngAsync(CoreWebView2 wv, string filePath)
    {
        using FileStream fs = File.Create(filePath);
        await wv.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            string rawJson = e.TryGetWebMessageAsString();
            if (string.IsNullOrWhiteSpace(rawJson))
            {
                return;
            }

            if (_backendController is not null && !rawJson.Contains("\"ui:", StringComparison.Ordinal))
            {
                _ = _backendController.TryHandleMessageAsync(rawJson);
                return;
            }

            using JsonDocument doc = JsonDocument.Parse(rawJson);
            JsonElement root = doc.RootElement;
            string? type = root.TryGetProperty("type", out JsonElement typeProp)
                ? typeProp.GetString()
                : null;

            switch (type)
            {
                case "ui:theme-changed":
                {
                    string? modeStr = root.TryGetProperty("mode", out JsonElement modeProp)
                        ? modeProp.GetString()
                        : null;
                    bool isDark = string.Equals(modeStr, "antigravity-dark", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(modeStr, "reader-dark", StringComparison.OrdinalIgnoreCase) ||
                                  string.Equals(modeStr, "dark", StringComparison.OrdinalIgnoreCase);
                    string? subtitle = root.TryGetProperty("subtitle", out JsonElement subProp)
                        ? subProp.GetString()
                        : null;
                    Dispatcher.Invoke(() => ApplyTitleBarTheme(isDark, subtitle));
                    break;
                }

                case "ui:toggle-fullscreen":
                {
                    bool? force = root.TryGetProperty("value", out JsonElement valProp) &&
                                  (valProp.ValueKind == JsonValueKind.True || valProp.ValueKind == JsonValueKind.False)
                        ? valProp.GetBoolean()
                        : null;
                    Dispatcher.Invoke(() => ToggleFullscreen(force));
                    break;
                }

                case "ui:open-external":
                {
                    string? url = root.TryGetProperty("url", out JsonElement urlProp)
                        ? urlProp.GetString()
                        : null;
                    if (!string.IsNullOrWhiteSpace(url) &&
                        Uri.TryCreate(url, UriKind.Absolute, out Uri? uri) &&
                        (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp))
                    {
                        Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
                    }
                    break;
                }

                case "ui:open-folder":
                {
                    string? folderPath = root.TryGetProperty("path", out JsonElement pathProp)
                        ? pathProp.GetString()
                        : null;

                    string targetDir;
                    if (!string.IsNullOrWhiteSpace(folderPath) && Directory.Exists(folderPath))
                    {
                        targetDir = folderPath;
                    }
                    else
                    {
                        targetDir = Yomic.Core.Services.DownloadPathService.BaseDirectory; // default downloads dir
                            // Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                            // "Yomic",
                            // "Downloads"
                        // );
                    }

                    if (!Directory.Exists(targetDir))
                    {
                        Directory.CreateDirectory(targetDir);
                    }

                    Process.Start(new ProcessStartInfo
                    {
                        FileName = "explorer.exe",
                        Arguments = $"\"{targetDir}\"",
                        UseShellExecute = true
                    });
                    break;
                }
            }
        }
        catch
        {
            // Ignore malformed IPC messages
        }
    }

    private void SendRawJsonToWebUi(string rawJson)
    {
        if (YomicWebView.CoreWebView2 is null)
        {
            return;
        }

        try
        {
            YomicWebView.CoreWebView2.PostWebMessageAsString(rawJson);
        }
        catch
        {
            // Ignore transient WebView2 errors
        }
    }

    private async Task SendMessageToWebUiAsync(object payload)
    {
        if (YomicWebView.CoreWebView2 is null)
        {
            return;
        }

        try
        {
            string json = JsonSerializer.Serialize(payload);
            await YomicWebView.CoreWebView2.ExecuteScriptAsync(
                $"window.__yomicHostReceiver && window.__yomicHostReceiver({json});");
        }
        catch
        {
            // Ignore transient script errors
        }
    }
}
