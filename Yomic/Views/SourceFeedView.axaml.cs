using Avalonia.Controls;
using System;
using System.Reactive;
using Avalonia.VisualTree;
using Avalonia.Threading;

namespace Yomic.Views
{
    public partial class SourceFeedView : UserControl
    {
        private DispatcherTimer? _restoreTimer;
        private double _targetScrollOffset = -1;
        private int _restoreAttempts = 0;

        public SourceFeedView()
        {
            InitializeComponent();
            
            // Save scroll position changes in both grid mode and list mode
            MangaListBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);
            MangaListModeBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);

            DataContextChanged += OnDataContextChanged;
        }

        private void OnDataContextChanged(object? sender, EventArgs e)
        {
            // Stop any running restore timer when DataContext changes
            StopRestoreTimer();

            if (DataContext is ViewModels.SourceFeedViewModel vm && vm.SavedScrollOffset > 0)
            {
                _targetScrollOffset = vm.SavedScrollOffset;
                _restoreAttempts = 0;
                StartRestoreTimer();
            }
        }

        private void StartRestoreTimer()
        {
            _restoreTimer = new DispatcherTimer(DispatcherPriority.Background)
            {
                Interval = TimeSpan.FromMilliseconds(50)
            };
            _restoreTimer.Tick += OnRestoreTimerTick;
            _restoreTimer.Start();
        }

        private void StopRestoreTimer()
        {
            if (_restoreTimer != null)
            {
                _restoreTimer.Stop();
                _restoreTimer.Tick -= OnRestoreTimerTick;
                _restoreTimer = null;
            }
            _targetScrollOffset = -1;
            _restoreAttempts = 0;
        }

        private void OnRestoreTimerTick(object? sender, EventArgs e)
        {
            _restoreAttempts++;

            // Give up after ~2 seconds (40 attempts × 50ms)
            if (_restoreAttempts > 40)
            {
                StopRestoreTimer();
                return;
            }

            if (DataContext is not ViewModels.SourceFeedViewModel vm)
            {
                StopRestoreTimer();
                return;
            }

            var listBox = vm.IsListView ? MangaListModeBox : MangaListBox;
            var sv = listBox?.FindDescendantOfType<ScrollViewer>();

            if (sv == null) return;

            double maxScroll = sv.Extent.Height - sv.Viewport.Height;

            // Wait until the list has rendered enough content to scroll to our target
            if (maxScroll >= _targetScrollOffset - 10)
            {
                sv.Offset = new Avalonia.Vector(sv.Offset.X, _targetScrollOffset);
                System.Diagnostics.Debug.WriteLine($"[Scroll] Restored position to {_targetScrollOffset}px after {_restoreAttempts} attempts");
                StopRestoreTimer();
            }
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            // Skip saving scroll position while we are in the middle of restoring it
            if (_targetScrollOffset > 0) return;

            if (e.Source is ScrollViewer sv && DataContext is ViewModels.SourceFeedViewModel vm)
            {
                // Save the current vertical scroll position in the ViewModel
                vm.SavedScrollOffset = sv.Offset.Y;

                // Infinite Scroll Logic (only for the active ListBox when pagination is hidden i.e. Latest mode)
                var activeBox = vm.IsListView ? MangaListModeBox : MangaListBox;
                if (sender == activeBox)
                {
                    if (sv.Offset.Y >= sv.Extent.Height - sv.Viewport.Height - 500)
                    {
                        if (vm.HasNextPage && !vm.IsLoading && !vm.IsPaginationVisible)
                        {
                            System.Diagnostics.Debug.WriteLine("[Scroll] Triggering Next Page!");
                            vm.NextPageCommand.Execute(Unit.Default).Subscribe(System.Reactive.Observer.Create<Unit>(_ => { }));
                        }
                    }
                }
            }
        }
    }
}
