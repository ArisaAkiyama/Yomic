using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia; // Added for VisualTreeAttachmentEventArgs
using Avalonia.VisualTree;
using Avalonia.Threading; // Added for DispatcherTimer
using Avalonia.Media.Imaging;
using Yomic.ViewModels;
using System;
using System.IO;
using System.Linq;

namespace Yomic.Views
{
    public partial class ReaderView : UserControl
    {
        private ScrollViewer? _mainScroll;
        // Scroll restoration: stores the target percent (0.0-1.0) while anchoring; -1 = inactive
        private double _targetRestorePercent = -1;
        private int _stableExtentCount = 0;
        private DispatcherTimer? _restoreTimer; // Fallback to always reveal content after timeout
        private ReaderViewModel? _oldVm;
        private ScrollViewer? MainScroll 
        {
            get 
            {
                if (_mainScroll != null) return _mainScroll;
                var listBox = this.FindControl<ListBox>("MainListBox");
                if (listBox != null)
                {
                    _mainScroll = listBox.GetVisualDescendants().OfType<ScrollViewer>().FirstOrDefault();
                }
                return _mainScroll;
            }
        }

        public ReaderView()
        {
            InitializeComponent();
            
            // Register Slider pointer events with handledEventsToo: true to ensure we catch them
            var slider = this.FindControl<Avalonia.Controls.Slider>("ProgressSlider");
            if (slider != null)
            {
                slider.AddHandler(PointerPressedEvent, OnSliderPointerPressed, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
                slider.AddHandler(PointerReleasedEvent, OnSliderPointerReleased, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
            }

            // Focusable needs to be true for KeyDown to work
            this.AttachedToVisualTree += OnAttachedToVisualTree;
            this.DataContextChanged += OnDataContextChanged;
            

            // Fix for "Jumping to top":
            // We use AddHandler with handledEventsToo: true to ensure we capture events.
            this.AddHandler(PointerMovedEvent, OnRootPointerMoved, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
            
            // Custom Scroll Speed Handler
            // ScrollViewer consumes the event by default, so we need handledEventsToo: true
            this.AddHandler(PointerWheelChangedEvent, OnReaderPointerWheelChanged, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);

            // Pan / Drag Handlers
            // Pan / Drag Handlers
            var mainListBox = this.FindControl<ListBox>("MainListBox");
            if (mainListBox != null)
            {
                mainListBox.AddHandler(PointerPressedEvent, OnPanPointerPressed, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
                mainListBox.AddHandler(PointerReleasedEvent, OnPanPointerReleased, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
                mainListBox.AddHandler(PointerMovedEvent, OnPanPointerMoved, Avalonia.Interactivity.RoutingStrategies.Tunnel | Avalonia.Interactivity.RoutingStrategies.Bubble, true);
            }
            
            // AutoScroll Timer
            _autoScrollTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(16) // ~60fps
            };
            _autoScrollTimer.Tick += OnAutoScrollTick;
        }

        private void OnDataContextChanged(object? sender, EventArgs e)
        {
            if (_oldVm != null)
            {
                _oldVm.RequestScroll -= OnScrollRequested;
                _oldVm.RequestScrollToPage -= OnScrollToPageRequested;
                _oldVm.RequestScrollToPercent -= OnScrollToPercentRequested;
                _oldVm.Pages.CollectionChanged -= OnPagesCollectionChanged;
                _oldVm.PropertyChanged -= OnViewModelPropertyChanged;
            }

            if (DataContext is ReaderViewModel vm)
            {
                vm.RequestScroll += OnScrollRequested;
                vm.RequestScrollToPage += OnScrollToPageRequested;
                vm.RequestScrollToPercent += OnScrollToPercentRequested;
                vm.Pages.CollectionChanged += OnPagesCollectionChanged;
                vm.PropertyChanged += OnViewModelPropertyChanged;
                _oldVm = vm;

                // Instantly hide on open so user never flashes the cover page
                var mainListBox = this.FindControl<ListBox>("MainListBox");
                if (mainListBox != null) mainListBox.Opacity = 0;
            }
            else
            {
                _oldVm = null;
            }
        }

        private void OnViewModelPropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(ReaderViewModel.CurrentMode))
            {
                Dispatcher.UIThread.Post(() =>
                {
                    if (DataContext is ReaderViewModel vm)
                    {
                        var mainListBox = this.FindControl<ListBox>("MainListBox");
                        if (mainListBox != null)
                        {
                            if (vm.IsWebtoon)
                            {
                                // Show the Webtoon list box when switching to Webtoon mode
                                mainListBox.Opacity = 1;
                                CancelScrollAnchor(); // Clear percentage restoration anchors

                                // Sync scroll position to match current page index from single/dual mode
                                if (vm.CurrentPageIndex >= 0 && vm.CurrentPageIndex < vm.Pages.Count)
                                {
                                    mainListBox.ScrollIntoView(vm.Pages[vm.CurrentPageIndex]);
                                }
                            }
                            else
                            {
                                // Reset to 0 when switching away to preserve hidden state for next open
                                mainListBox.Opacity = 0;
                            }
                        }
                    }
                });
            }
        }

        private void OnPagesCollectionChanged(object? sender, System.Collections.Specialized.NotifyCollectionChangedEventArgs e)
        {
            if (e.Action == System.Collections.Specialized.NotifyCollectionChangedAction.Reset)
            {
                Dispatcher.UIThread.Post(() =>
                {
                    var mainListBox = this.FindControl<ListBox>("MainListBox");
                    if (mainListBox != null)
                    {
                        mainListBox.Opacity = 0;
                    }
                });
            }
        }

        // Restore to a specific page index (legacy / paged-mode fallback)
        private void OnScrollToPageRequested(object? sender, int pageIndex)
        {
            Dispatcher.UIThread.Post(() =>
            {
                if (DataContext is ReaderViewModel vm && vm.IsWebtoon)
                {
                    var mainListBox = this.FindControl<ListBox>("MainListBox");
                    if (mainListBox != null && pageIndex >= 0 && pageIndex < vm.Pages.Count)
                    {
                        mainListBox.ScrollIntoView(vm.Pages[pageIndex]);
                    }
                }
            }, DispatcherPriority.Loaded);
        }

        // Restore to an exact scroll percentage — the accurate path for Webtoon mode
        private void OnScrollToPercentRequested(object? sender, double targetPercent)
        {
            Dispatcher.UIThread.Post(() =>
            {
                if (DataContext is ReaderViewModel vm && vm.IsWebtoon)
                {
                    // Use Opacity=0 (not IsVisible=false) so the ListBox still participates
                    // in layout and emits ScrollChanged events — needed for the anchor to release.
                    var mainListBox = this.FindControl<ListBox>("MainListBox");
                    if (mainListBox != null) mainListBox.Opacity = 0;

                    _targetRestorePercent = targetPercent;
                    _stableExtentCount = 0;
                    ApplyPercentScrollRestore();

                    // Fallback: always reveal content after 1s even if extent never stabilizes
                    _restoreTimer?.Stop();
                    _restoreTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1.0) };
                    _restoreTimer.Tick += (s, e) =>
                    {
                        _restoreTimer?.Stop();
                        _restoreTimer = null;
                        ReleaseScrollAnchor();
                    };
                    _restoreTimer.Start();
                }
            }, DispatcherPriority.Loaded);
        }

        private void ApplyPercentScrollRestore()
        {
            if (MainScroll == null || _targetRestorePercent < 0) return;
            double maxScroll = Math.Max(0, MainScroll.Extent.Height - MainScroll.Viewport.Height);
            double targetY = _targetRestorePercent * maxScroll;
            MainScroll.Offset = new Vector(MainScroll.Offset.X, targetY);
        }

        // Called when anchor naturally stabilizes — show content at the correct position
        private void ReleaseScrollAnchor()
        {
            _restoreTimer?.Stop();
            _restoreTimer = null;
            ApplyPercentScrollRestore();
            _targetRestorePercent = -1;

            // Sync page indicator and scroll percent to the actual restored position
            if (DataContext is ReaderViewModel vm && MainScroll != null && vm.Pages.Count > 0)
            {
                double maxScroll = Math.Max(1, MainScroll.Extent.Height - MainScroll.Viewport.Height);
                double actualPercent = Math.Clamp(MainScroll.Offset.Y / maxScroll, 0.0, 1.0);
                int estimatedIndex = Math.Clamp((int)(actualPercent * (vm.Pages.Count - 1)), 0, vm.Pages.Count - 1);
                vm.CurrentScrollPercent = actualPercent;
                vm.CurrentPageIndex = estimatedIndex;
                vm.PreloadAroundIndex(estimatedIndex);
            }

            var mainListBox = this.FindControl<ListBox>("MainListBox");
            if (mainListBox != null) mainListBox.Opacity = 1;
        }

        // Called when user manually interacts before anchor releases
        private void CancelScrollAnchor()
        {
            if (_targetRestorePercent < 0) return;
            _restoreTimer?.Stop();
            _restoreTimer = null;
            _targetRestorePercent = -1;
            var mainListBox = this.FindControl<ListBox>("MainListBox");
            if (mainListBox != null) mainListBox.Opacity = 1;
        }

        private void OnScrollRequested(object? sender, int direction)
        {
            // direction: 1 = Down, -1 = Up
            Dispatcher.UIThread.Post(() =>
            {
                if (DataContext is ReaderViewModel vm)
                {
                    if (vm.IsWebtoon)
                    {
                        if (MainScroll != null)
                        {
                            double offset = MainScroll.Viewport.Height * 0.9 * direction;
                            MainScroll.Offset = new Vector(MainScroll.Offset.X, MainScroll.Offset.Y + offset);
                        }
                    }
                    else
                    {
                        // Paged Mode Scrolling (if zoomed)
                        var pagedScroll = vm.IsDualPage ? this.FindControl<ScrollViewer>("DualPagedScroll") : this.FindControl<ScrollViewer>("PagedScroll");
                        if (pagedScroll != null)
                        {
                            double offset = pagedScroll.Viewport.Height * 0.9 * direction;
                            pagedScroll.Offset = new Vector(pagedScroll.Offset.X, pagedScroll.Offset.Y + offset);
                        }
                    }
                }
            });
        }

        private void OnReaderPointerWheelChanged(object? sender, PointerWheelEventArgs e)
        {
            CancelScrollAnchor(); // User manually scrolled — release restore anchor
            if (DataContext is ReaderViewModel vm && vm.IsWebtoon && MainScroll != null)
            {
                // Multiplier for faster scrolling (Adjust custom speed here)
                double speedMultiplier = 3.0;
                
                // e.Delta.Y is usually 1.0 or -1.0 per tick
                double offsetChange = -e.Delta.Y * 50 * speedMultiplier; 
                
                // Apply new offset
                MainScroll.Offset = new Avalonia.Vector(MainScroll.Offset.X, MainScroll.Offset.Y + offsetChange);
                
                // Mark event as handled to prevent default slow scrolling
                e.Handled = true;
            }
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            
            if (DataContext is ReaderViewModel vm)
            {
                if (e.Key == Key.Right)
                {
                    if (vm.IsWebtoon)
                        vm.NextChapterCommand.Execute().Subscribe(_ => { });
                    else if (vm.IsDualPage)
                        vm.PrevPageCommand.Execute().Subscribe(_ => { }); // Manga Mode: Right is Previous Page/Chapter
                    else
                        vm.NextPageCommand.Execute().Subscribe(_ => { });
                        
                    e.Handled = true;
                }
                else if (e.Key == Key.Left)
                {
                    if (vm.IsWebtoon)
                        vm.PrevChapterCommand.Execute().Subscribe(_ => { });
                    else if (vm.IsDualPage)
                        vm.NextPageCommand.Execute().Subscribe(_ => { }); // Manga Mode: Left is Next Page/Chapter
                    else
                        vm.PrevPageCommand.Execute().Subscribe(_ => { });

                    e.Handled = true;
                }
                else if (e.Key == Key.Space)
                {
                    if (vm.IsWebtoon && MainScroll != null)
                    {
                        double scrollAmount = MainScroll.Viewport.Height * 0.9;
                        MainScroll.Offset = new Avalonia.Vector(MainScroll.Offset.X, MainScroll.Offset.Y + scrollAmount);
                    }
                    else if (!vm.IsWebtoon)
                    {
                        var pagedScroll = vm.IsDualPage ? this.FindControl<ScrollViewer>("DualPagedScroll") : this.FindControl<ScrollViewer>("PagedScroll");
                        if (pagedScroll != null)
                        {
                            double scrollAmount = pagedScroll.Viewport.Height * 0.9;
                            pagedScroll.Offset = new Avalonia.Vector(pagedScroll.Offset.X, pagedScroll.Offset.Y + scrollAmount);
                        }
                    }
                    e.Handled = true;
                }
                else if (e.Key == Key.F || e.Key == Key.F11)
                {
                    vm.ToggleFullscreenCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.Escape)
                {
                    if (vm.IsFullscreen)
                    {
                        vm.ToggleFullscreenCommand.Execute().Subscribe(_ => { });
                    }
                    else
                    {
                        vm.BackCommand.Execute().Subscribe(_ => { });
                    }
                    e.Handled = true;
                }
                else if (e.Key == Key.R)
                {
                    vm.RotateCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.OemPlus || e.Key == Key.Add)
                {
                    vm.ZoomInCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.OemMinus || e.Key == Key.Subtract)
                {
                    vm.ZoomOutCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.H)
                {
                    vm.ToggleMenuCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.D1 || e.Key == Key.NumPad1)
                {
                    vm.SetModeCommand.Execute(Yomic.ViewModels.ReaderMode.Webtoon).Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.D2 || e.Key == Key.NumPad2)
                {
                    vm.SetModeCommand.Execute(Yomic.ViewModels.ReaderMode.Single).Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.D3 || e.Key == Key.NumPad3)
                {
                    vm.SetModeCommand.Execute(Yomic.ViewModels.ReaderMode.Double).Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.B && e.KeyModifiers.HasFlag(KeyModifiers.Control))
                {
                    vm.ToggleBookmarkCommand.Execute().Subscribe(_ => { });
                    e.Handled = true;
                }
                else if (e.Key == Key.Down)
                {
                    double scrollAmount = 150; // Adjust scroll speed here
                    if (vm.IsWebtoon && MainScroll != null)
                    {
                        MainScroll.Offset = new Avalonia.Vector(MainScroll.Offset.X, MainScroll.Offset.Y + scrollAmount);
                    }
                    else if (!vm.IsWebtoon)
                    {
                        var pagedScroll = vm.IsDualPage ? this.FindControl<ScrollViewer>("DualPagedScroll") : this.FindControl<ScrollViewer>("PagedScroll");
                        if (pagedScroll != null)
                        {
                            pagedScroll.Offset = new Avalonia.Vector(pagedScroll.Offset.X, pagedScroll.Offset.Y + scrollAmount);
                        }
                    }
                    e.Handled = true;
                }
                else if (e.Key == Key.Up)
                {
                    double scrollAmount = 150; // Adjust scroll speed here
                    if (vm.IsWebtoon && MainScroll != null)
                    {
                        MainScroll.Offset = new Avalonia.Vector(MainScroll.Offset.X, Math.Max(0, MainScroll.Offset.Y - scrollAmount));
                    }
                    else if (!vm.IsWebtoon)
                    {
                        var pagedScroll = vm.IsDualPage ? this.FindControl<ScrollViewer>("DualPagedScroll") : this.FindControl<ScrollViewer>("PagedScroll");
                        if (pagedScroll != null)
                        {
                            pagedScroll.Offset = new Avalonia.Vector(pagedScroll.Offset.X, Math.Max(0, pagedScroll.Offset.Y - scrollAmount));
                        }
                    }
                    e.Handled = true;
                }
            }
        }

        private void OnBackClick(object? sender, RoutedEventArgs e)
        {
            if (this.VisualRoot is ReaderWindow readerWindow)
            {
                readerWindow.Close();
            }
            else if (DataContext is ReaderViewModel vm)
            {
                vm.BackCommand.Execute().Subscribe(_ => { });
            }
        }

        // Check if user is interacting with slider to prevent loop
        private bool _isDraggingSlider = false;

        private void OnSliderPointerPressed(object? sender, PointerPressedEventArgs e)
        {
            _isDraggingSlider = true;
            CancelScrollAnchor(); // User manually interacted — release anchor
        }

        private void OnSliderPointerReleased(object? sender, PointerReleasedEventArgs e)
        {
            _isDraggingSlider = false;
        }

        private void OnSliderValueChanged(object? sender, Avalonia.Controls.Primitives.RangeBaseValueChangedEventArgs e)
        {
            if (DataContext is ReaderViewModel vm && vm.IsWebtoon && _isDraggingSlider)
            {
                // User dragged slider -> Scroll to position
                // Mapping: 0 to (Count-1)  ->  0 to MaxScroll
                
                int maxIndex = Math.Max(1, vm.Pages.Count - 1);
                var percent = e.NewValue / maxIndex;
                
                if (MainScroll != null)
                {
                    double maxScroll = Math.Max(0, MainScroll.Extent.Height - MainScroll.Viewport.Height);
                    var offset = percent * maxScroll;
                    MainScroll.Offset = new Avalonia.Vector(MainScroll.Offset.X, offset);
                }
            }
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            if (_isDraggingSlider) return; // Don't fight the user

            if (DataContext is ReaderViewModel vm && vm.IsWebtoon)
            {
                if (MainScroll == null || MainScroll.Extent.Height <= 0) return;

                double maxScroll = Math.Max(1, MainScroll.Extent.Height - MainScroll.Viewport.Height);
                double percent = MainScroll.Offset.Y / maxScroll;
                percent = Math.Clamp(percent, 0.0, 1.0);

                // Always track current scroll percent so SaveProgress() can capture it
                vm.CurrentScrollPercent = percent;

                // Percent-based restore anchor: keep reapplying target Y while images expand the extent
                if (_targetRestorePercent >= 0)
                {
                    if (e.ExtentDelta.Y != 0)
                    {
                        // Extent grew (images loading) — re-apply percent offset, reset stability counter
                        ApplyPercentScrollRestore();
                        _stableExtentCount = 0;
                    }
                    else
                    {
                        _stableExtentCount++;

                        // Smart early release: check if pages around target are done loading
                        int targetIdx = (int)(_targetRestorePercent * Math.Max(1, vm.Pages.Count - 1));
                        targetIdx = Math.Clamp(targetIdx, 0, vm.Pages.Count - 1);
                        bool nearPagesLoaded = true;
                        for (int i = Math.Max(0, targetIdx - 1); i <= Math.Min(vm.Pages.Count - 1, targetIdx + 2); i++)
                        {
                            if (vm.Pages[i].IsLoading) { nearPagesLoaded = false; break; }
                        }

                        // Release if near-target images are loaded, OR extent has been stable for 5+ events
                        if (nearPagesLoaded || _stableExtentCount >= 5)
                        {
                            ReleaseScrollAnchor();
                        }
                    }
                    return; // Don't sync slider/page-index during restore
                }

                // Sync Scroll -> Slider Index
                // Mapping: 0 to MaxScroll -> 0 to (Count-1)
                var estimatedIndex = (int)(percent * (vm.Pages.Count - 1));

                // Clamp Index
                if (vm.Pages.Count > 0)
                {
                    estimatedIndex = Math.Clamp(estimatedIndex, 0, vm.Pages.Count - 1);

                    if (vm.CurrentPageIndex != estimatedIndex)
                    {
                        vm.CurrentPageIndex = estimatedIndex;
                    }

                    // Mihon-style: trigger preload around the visible viewport
                    vm.PreloadAroundIndex(estimatedIndex);
                }
            }
        }

        private void OnRootPointerMoved(object? sender, PointerEventArgs e)
        {
            if (DataContext is ReaderViewModel vm)
            {
                var point = e.GetPosition(this);
                var height = this.Bounds.Height;
                
                // --- Footer Logic ---
                // Strict trigger (50px from bottom) to show
                // Relaxed threshold (150px from bottom) to keep open
                double bottomThresh = vm.IsFooterVisible ? 150.0 : 50.0;
                bool showFooter = (point.Y > height - bottomThresh);
                
                if (vm.IsFooterVisible != showFooter)
                {
                    vm.IsFooterVisible = showFooter;
                }

                // --- Header Logic ---
                // Strict trigger (50px from top) to show
                // Relaxed threshold (80px from top) to keep open
                double topThresh = vm.IsHeaderVisible ? 80.0 : 50.0;
                bool showHeader = (point.Y < topThresh);

                if (vm.IsHeaderVisible != showHeader)
                {
                    vm.IsHeaderVisible = showHeader;
                }
            }
        }


        // --- Drag / Pan / AutoScroll Support ---
        private bool _isPanning = false;
        private bool _isAutoScrolling = false;
        private Point _lastPanPosition;
        
        // AutoScroll Vars
        private DispatcherTimer _autoScrollTimer;
        private Point _autoScrollAnchorPosition;
        private double _autoScrollSpeedY = 0;
        private Canvas? _autoScrollCanvas;
        private Border? _autoScrollAnchor;

        private void OnPanPointerPressed(object? sender, PointerPressedEventArgs e)
        {
            CancelScrollAnchor(); // User manually dragged — release anchor
            var props = e.GetCurrentPoint(this).Properties;
            if (!props.IsLeftButtonPressed || MainScroll == null) return;

            // Ignore if source is ScrollBar or its children (Thumb, Track, etc.)
            if (e.Source is Visual visual && visual.FindAncestorOfType<Avalonia.Controls.Primitives.ScrollBar>(true) != null)
                return;
            
            if (DataContext is ReaderViewModel vm && vm.ZoomScale <= 1.05)
            {
                // --- AUTO SCROLL MODE (Zoom <= 100%) ---
                _isAutoScrolling = true;
                
                // Clamp Anchor Position to avoid overlapping scrollbar or edges
                var rawPos = e.GetPosition(this);
                double horizontalMargin = 60; // More margin for right side (scrollbar)
                double verticalMargin = 40;
                
                double clampedX = Math.Clamp(rawPos.X, verticalMargin, this.Bounds.Width - horizontalMargin);
                double clampedY = Math.Clamp(rawPos.Y, verticalMargin, this.Bounds.Height - verticalMargin);
                
                _autoScrollAnchorPosition = new Point(clampedX, clampedY);
                
                // Show Anchor
                if (_autoScrollCanvas == null) _autoScrollCanvas = this.FindControl<Canvas>("AutoScrollCanvas");
                if (_autoScrollAnchor == null) _autoScrollAnchor = this.FindControl<Border>("AutoScrollAnchor");
                
                if (_autoScrollCanvas != null && _autoScrollAnchor != null)
                {
                    _autoScrollCanvas.IsVisible = true;
                    // Position the anchor centered on the click (clamped)
                    Canvas.SetLeft(_autoScrollAnchor, _autoScrollAnchorPosition.X);
                    Canvas.SetTop(_autoScrollAnchor, _autoScrollAnchorPosition.Y);
                }
                
                // Capture pointer
                if (sender is Control control) e.Pointer.Capture(control);
                
                // Start Timer
                _autoScrollSpeedY = 0;
                _autoScrollTimer.Start();
                this.Cursor = new Cursor(StandardCursorType.SizeNorthSouth); // North-South Arrows
            }
            else
            {
                // --- PAN MODE (Zoom > 100%) ---
                _isPanning = true;
                _lastPanPosition = e.GetPosition(this);
                
                if (sender is Control control) e.Pointer.Capture(control);
                this.Cursor = new Cursor(StandardCursorType.SizeAll); // Hand/All Arrows
            }
        }

        private void OnPanPointerReleased(object? sender, PointerReleasedEventArgs e)
        {
            if (_isAutoScrolling)
            {
                _isAutoScrolling = false;
                _autoScrollTimer.Stop();
                _autoScrollSpeedY = 0;
                
                if (_autoScrollCanvas != null) _autoScrollCanvas.IsVisible = false;
                
                e.Pointer.Capture(null);
                this.Cursor = Cursor.Default;
            }
            else if (_isPanning)
            {
                _isPanning = false;
                e.Pointer.Capture(null);
                this.Cursor = Cursor.Default;
            }
        }

        private void OnPanPointerMoved(object? sender, PointerEventArgs e)
        {
            if (MainScroll == null) return;

            if (_isAutoScrolling)
            {
                var currentPosition = e.GetPosition(this);
                
                // Calculate Speed based on distance from Anchor
                // Deadzone of 20px
                double dy = currentPosition.Y - _autoScrollAnchorPosition.Y;
                
                if (Math.Abs(dy) < 20)
                {
                    _autoScrollSpeedY = 0;
                }
                else
                {
                    // Linear speed scaling: (Distance - Deadzone) * Multiplier
                    // Adjust multiplier for sensitivity
                    double val = (dy > 0) ? (dy - 20) : (dy + 20);
                    _autoScrollSpeedY = val * 0.5; // Multiplier
                }
            }
            else if (_isPanning)
            {
                var currentPosition = e.GetPosition(this);
                var delta = _lastPanPosition - currentPosition; 

                // Apply new offset
                MainScroll.Offset = new Vector(MainScroll.Offset.X + delta.X, MainScroll.Offset.Y + delta.Y);
                
                _lastPanPosition = currentPosition;
            }
        }
        
        private void OnAutoScrollTick(object? sender, EventArgs e)
        {
            if (_isAutoScrolling && MainScroll != null && Math.Abs(_autoScrollSpeedY) > 0.1)
            {
                 MainScroll.Offset = new Vector(MainScroll.Offset.X, MainScroll.Offset.Y + _autoScrollSpeedY);
            }
        }
        
        private void OnAttachedToVisualTree(object? sender, VisualTreeAttachmentEventArgs e)
        {
            // Force focus so key events work immediately
            Dispatcher.UIThread.Post(() => 
            {
                this.Focus();
                // Also try to find a child to focus if this fails, but this should work since Focusable=True
            }, DispatcherPriority.Input);
        }
        


    }
}
