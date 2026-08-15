using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.ReactiveUI; // Added for WhenAnyValue
using ReactiveUI; // Added for WhenAnyValue
using Yomic.ViewModels;
using Yomic.Core.Services;
using Avalonia.Animation;
using Avalonia.Animation.Easings;
using Avalonia.Media.Imaging;
using Avalonia.Styling;
using System;
using System.Threading.Tasks;

namespace Yomic.Views
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            DataContextChanged += OnDataContextChanged;
            Opened += OnOpened;
        }

        private async void OnOpened(object? sender, EventArgs e)
        {
            if (DataContext is MainWindowViewModel vm)
            {
                await vm.RunStartupTasksAsync();
            }
        }

        private void OnDataContextChanged(object? sender, EventArgs e)
        {
            if (DataContext is MainWindowViewModel vm)
            {
                // Sync WindowState when ViewModel.IsFullscreen changes (e.g., from ReaderView)
                vm.WhenAnyValue(x => x.IsFullscreen)
                  .Subscribe(isFullscreen =>
                  {
                      SetFullscreen(vm, isFullscreen);
                  });


                // Subscribe to Feedback Dialog Request
                vm.RequestFeedbackDialog -= ShowFeedbackDialog;
                vm.RequestFeedbackDialog += ShowFeedbackDialog;

                // Subscribe to Theme Change Request
                vm.RequestThemeChange -= OnThemeChangeRequested;
                vm.RequestThemeChange += OnThemeChangeRequested;

                // Subscribe to Update Dialog Request
                vm.ShowUpdateDialogAsync = async (updateInfo) =>
                {
                    return await UpdateAvailableDialog.ShowDialogAsync(this, updateInfo);
                };
            }
        }

        private async void OnThemeChangeRequested(bool isDark)
        {
            await CrossfadeThemeChangeAsync(isDark);
        }

        private async Task CrossfadeThemeChangeAsync(bool isDark)
        {
            if (Avalonia.Application.Current == null) return;
            var themeVariant = isDark ? ThemeVariant.Dark : ThemeVariant.Light;
            if (Avalonia.Application.Current.RequestedThemeVariant == themeVariant) return;

            try
            {
                // 1. Capture screenshot of old theme
                var pixelSize = new Avalonia.PixelSize((int)Bounds.Width, (int)Bounds.Height);
                using var bitmap = new RenderTargetBitmap(pixelSize, new Avalonia.Vector(96, 96));
                bitmap.Render(this);

                // 2. Set the image overlay and make it visible
                ThemeTransitionOverlay.Source = bitmap;
                ThemeTransitionOverlay.Opacity = 1;
                ThemeTransitionOverlay.IsVisible = true;

                // Reset scale
                var scaleTransform = ThemeTransitionOverlay.RenderTransform as Avalonia.Media.ScaleTransform;
                if (scaleTransform == null)
                {
                    scaleTransform = new Avalonia.Media.ScaleTransform(1, 1);
                    ThemeTransitionOverlay.RenderTransform = scaleTransform;
                }
                scaleTransform.ScaleX = 1.0;
                scaleTransform.ScaleY = 1.0;

                // 3. Change theme underneath
                Avalonia.Application.Current.RequestedThemeVariant = themeVariant;

                // 4. Wait for Avalonia to apply resources and render the new theme
                await Avalonia.Threading.Dispatcher.UIThread.InvokeAsync(() => { }, Avalonia.Threading.DispatcherPriority.Render);

                // 5. Animate fade out and scale
                var easing = new ExponentialEaseOut();
                var duration = TimeSpan.FromMilliseconds(500);
                
                // If transitioning to Light (isDark = false), overlay expands (simulating light revealing)
                // If transitioning to Dark (isDark = true), overlay shrinks (simulating dark engulfing)
                double targetScale = isDark ? 0.96 : 1.04;

                var opacityAnimation = new Animation
                {
                    Duration = duration,
                    Easing = easing,
                    FillMode = FillMode.Forward,
                    Children =
                    {
                        new KeyFrame { Cue = new Cue(0d), Setters = { new Setter(Image.OpacityProperty, 1.0d) } },
                        new KeyFrame { Cue = new Cue(1d), Setters = { new Setter(Image.OpacityProperty, 0.0d) } }
                    }
                };

                var scaleXAnimation = new Animation
                {
                    Duration = duration,
                    Easing = easing,
                    FillMode = FillMode.Forward,
                    Children =
                    {
                        new KeyFrame { Cue = new Cue(0d), Setters = { new Setter(Avalonia.Media.ScaleTransform.ScaleXProperty, 1.0d) } },
                        new KeyFrame { Cue = new Cue(1d), Setters = { new Setter(Avalonia.Media.ScaleTransform.ScaleXProperty, targetScale) } }
                    }
                };

                var scaleYAnimation = new Animation
                {
                    Duration = duration,
                    Easing = easing,
                    FillMode = FillMode.Forward,
                    Children =
                    {
                        new KeyFrame { Cue = new Cue(0d), Setters = { new Setter(Avalonia.Media.ScaleTransform.ScaleYProperty, 1.0d) } },
                        new KeyFrame { Cue = new Cue(1d), Setters = { new Setter(Avalonia.Media.ScaleTransform.ScaleYProperty, targetScale) } }
                    }
                };

                await Task.WhenAll(
                    opacityAnimation.RunAsync(ThemeTransitionOverlay),
                    scaleXAnimation.RunAsync(ThemeTransitionOverlay),
                    scaleYAnimation.RunAsync(ThemeTransitionOverlay)
                );
            }
            finally
            {
                // 6. Cleanup
                ThemeTransitionOverlay.IsVisible = false;
                ThemeTransitionOverlay.Source = null;
                if (ThemeTransitionOverlay.RenderTransform is Avalonia.Media.ScaleTransform st)
                {
                    st.ScaleX = 1.0;
                    st.ScaleY = 1.0;
                }
            }
        }


        private async void ShowFeedbackDialog()
        {
            if (DataContext is MainWindowViewModel mainVM)
            {
                var dialog = new FeedbackDialog
                {
                    DataContext = new Yomic.ViewModels.FeedbackDialogViewModel(mainVM.SettingsService, mainVM.ShowNotification)
                };

                mainVM.IsDialogOverlayVisible = true;
                await dialog.ShowDialog(this);
                mainVM.IsDialogOverlayVisible = false;
            }
        }

        protected override void OnKeyDown(Avalonia.Input.KeyEventArgs e)
        {
            base.OnKeyDown(e);

            if (DataContext is MainWindowViewModel vm)
            {
                // Forward Arrow Keys to ReaderViewModel if active
                if (vm.CurrentPage is ReaderViewModel readerVM)
                {
                    if (e.Key == Avalonia.Input.Key.Right)
                    {
                        if (readerVM.IsWebtoon)
                            readerVM.NextChapterCommand.Execute().Subscribe(_ => { });
                        else if (readerVM.IsDualPage)
                            readerVM.PrevPageCommand.Execute().Subscribe(_ => { });
                        else
                            readerVM.NextPageCommand.Execute().Subscribe(_ => { });
                            
                        e.Handled = true;
                        return;
                    }
                    else if (e.Key == Avalonia.Input.Key.Left)
                    {
                        if (readerVM.IsWebtoon)
                            readerVM.PrevChapterCommand.Execute().Subscribe(_ => { });
                        else if (readerVM.IsDualPage)
                            readerVM.NextPageCommand.Execute().Subscribe(_ => { });
                        else
                            readerVM.PrevPageCommand.Execute().Subscribe(_ => { });
    
                        e.Handled = true;
                        return;
                    }
                    else if (e.Key == Avalonia.Input.Key.Space)
                    {
                        readerVM.ToggleMenuCommand.Execute().Subscribe(_ => { });
                        e.Handled = true;
                        return;
                    }
                    else if (e.Key == Avalonia.Input.Key.PageUp)
                    {
                         readerVM.ScrollUpCommand.Execute().Subscribe(_ => { });
                         e.Handled = true;
                         return;
                    }
                    else if (e.Key == Avalonia.Input.Key.PageDown)
                    {
                         readerVM.ScrollDownCommand.Execute().Subscribe(_ => { });
                         e.Handled = true;
                         return;
                    }
                }

                if (e.Key == Avalonia.Input.Key.F11)
                {
                    ToggleFullscreen(vm);
                    e.Handled = true;
                }
                else if (e.Key == Avalonia.Input.Key.Escape && vm.IsFullscreen)
                {
                    // Only exit fullscreen if currently in fullscreen
                    SetFullscreen(vm, false);
                    e.Handled = true;
                }
                else if (e.KeyModifiers == Avalonia.Input.KeyModifiers.Control && e.Key == Avalonia.Input.Key.R)
                {
                    // Ctrl+R for Reload
                    OnReloadClick(this, new RoutedEventArgs());
                    e.Handled = true;
                }
            }
        }

        private void ToggleFullscreen(MainWindowViewModel vm)
        {
            bool newState = !vm.IsFullscreen;
            SetFullscreen(vm, newState);
        }

        private Avalonia.Controls.WindowState _previousWindowState = Avalonia.Controls.WindowState.Normal;

        private void SetFullscreen(MainWindowViewModel vm, bool isFullscreen)
        {
            vm.IsFullscreen = isFullscreen;
            
            if (isFullscreen)
            {
                if (WindowState != Avalonia.Controls.WindowState.FullScreen)
                {
                    _previousWindowState = WindowState;
                }

                // Strict Fullscreen Mode: Remove borders, padding, and transparency
                SystemDecorations = SystemDecorations.None;
                WindowState = Avalonia.Controls.WindowState.FullScreen;
                Padding = new Avalonia.Thickness(0);
                Background = Avalonia.Media.Brushes.Black;
                ExtendClientAreaToDecorationsHint = false; // Disable custom chrome to remove potential top bar reservation
            }
            else
            {
                // Restore previous State
                SystemDecorations = SystemDecorations.Full;
                WindowState = _previousWindowState == Avalonia.Controls.WindowState.FullScreen ? Avalonia.Controls.WindowState.Normal : _previousWindowState;
                Padding = new Avalonia.Thickness(0); // WindowState=Maximized style handle this via XAML, but standard is 0 for Normal
                Background = Avalonia.Media.Brushes.Transparent;
                ExtendClientAreaToDecorationsHint = true;
            }
        }

        private void OnLibraryClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToLibrary();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private void OnBrowseClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToBrowse();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }



        private void OnSettingsClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToSettings();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private async void OnAnnouncementClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    await vm.ToggleAnnouncementPanelAsync();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Announcement Panel Error: {ex}");
            }
        }

        private void OnCloseAnnouncementPanelClick(object? sender, RoutedEventArgs e)
        {
            if (DataContext is MainWindowViewModel vm)
            {
                vm.CloseAnnouncementPanel();
            }
        }

        private void OnAnnouncementItemClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is Core.Models.Announcement item && DataContext is MainWindowViewModel vm)
            {
                vm.SelectAnnouncement(item);
            }
        }

        private void OnFeedbackClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    // Trigger the dialog event
                    vm.RequestFeedbackDialog?.Invoke();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Feedback Error: {ex}");
            }
        }

        private void OnHistoryClick(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
        {
            if (DataContext is ViewModels.MainWindowViewModel vm)
            {
                vm.GoToHistory();
            }
        }

        private void OnDownloadsClick(object? sender, RoutedEventArgs e)
        {
             try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToDownloads();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private void OnUpdatesClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToUpdates();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private void OnUpcomingClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToUpcoming();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private void OnExtensionsClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    vm.GoToExtensions();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Navigation Error: {ex}");
            }
        }

        private void OnReloadClick(object? sender, RoutedEventArgs e)
        {
            try
            {
                if (DataContext is MainWindowViewModel vm)
                {
                    // Check connectivity first
                    _ = vm.NetworkService.CheckConnectivityAsync();
                    
                    // If Library page, refresh it
                    if (vm.CurrentPage == vm.LibraryVM)
                    {
                        _ = vm.LibraryVM.RefreshLibrary();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Reload Error: {ex}");
            }
        }
    }
}
