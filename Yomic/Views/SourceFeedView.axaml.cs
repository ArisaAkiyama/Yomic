using Avalonia.Controls;
using System;
using System.Reactive.Linq;
using System.Reactive;
using Avalonia.VisualTree;

namespace Yomic.Views
{
    public partial class SourceFeedView : UserControl
    {
        private double _targetScrollOffset = -1;

        public SourceFeedView()
        {
            InitializeComponent();
            
            // Listen to scroll changes on both grid and list view mode list boxes to save the scroll offset
            MangaListBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);
            MangaListModeBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);

            Loaded += OnViewLoaded;
        }

        private void OnViewLoaded(object? sender, EventArgs e)
        {
            RestoreScrollPosition();
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            if (e.Source is ScrollViewer sv && DataContext is ViewModels.SourceFeedViewModel vm)
            {
                // If we are currently restoring the scroll offset
                if (_targetScrollOffset > 0)
                {
                    // Only apply offset if the scroll viewer layout has initialized with valid extent height
                    if (sv.Extent.Height > sv.Viewport.Height)
                    {
                        sv.Offset = new Avalonia.Vector(sv.Offset.X, _targetScrollOffset);
                        
                        // Check if we successfully reached the target or hit the scroll boundary
                        double maxScroll = Math.Max(0, sv.Extent.Height - sv.Viewport.Height);
                        if (Math.Abs(sv.Offset.Y - _targetScrollOffset) < 1.5 || sv.Offset.Y >= maxScroll - 1.5)
                        {
                            _targetScrollOffset = -1; // Finished restoring
                            System.Diagnostics.Debug.WriteLine($"[Scroll] Finished restoring scroll offset to: {sv.Offset.Y}");
                        }
                    }
                    return; // Skip saving the offset during restoration
                }

                // Save the current vertical scroll position in the ViewModel, but only if the view is attached
                if (this.IsAttachedToVisualTree() && sv.IsAttachedToVisualTree() && sv.Extent.Height > sv.Viewport.Height)
                {
                    vm.SavedScrollOffset = sv.Offset.Y;
                }

                // Infinite Scroll Logic (only for the active ListBox grid when pagination is hidden)
                var activeBox = vm.IsListView ? MangaListModeBox : MangaListBox;
                if (sender == activeBox)
                {
                    // Trigger when close to bottom (e.g., 500px buffer)
                    if (sv.Offset.Y >= sv.Extent.Height - sv.Viewport.Height - 500)
                    {
                        if (vm.HasNextPage && !vm.IsLoading && !vm.IsPaginationVisible)
                        {
                            System.Diagnostics.Debug.WriteLine("[Scroll] Triggering Next Page!");
                            vm.NextPageCommand.Execute(System.Reactive.Unit.Default).Subscribe(System.Reactive.Observer.Create<System.Reactive.Unit>(_ => { }));
                        }
                    }
                }
            }
        }

        private void RestoreScrollPosition()
        {
            if (DataContext is ViewModels.SourceFeedViewModel vm && vm.SavedScrollOffset > 0)
            {
                _targetScrollOffset = vm.SavedScrollOffset;
                
                var listBox = vm.IsListView ? MangaListModeBox : MangaListBox;
                if (listBox != null)
                {
                    // Try immediate restore
                    var sv = listBox.FindDescendantOfType<ScrollViewer>();
                    if (sv != null && sv.Extent.Height > sv.Viewport.Height)
                    {
                        sv.Offset = new Avalonia.Vector(sv.Offset.X, _targetScrollOffset);
                        double maxScroll = Math.Max(0, sv.Extent.Height - sv.Viewport.Height);
                        if (Math.Abs(sv.Offset.Y - _targetScrollOffset) < 1.5 || sv.Offset.Y >= maxScroll - 1.5)
                        {
                            _targetScrollOffset = -1;
                        }
                    }
                }
            }
        }
    }
}
