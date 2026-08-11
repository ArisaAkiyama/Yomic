using Avalonia.Controls;
using System;
using System.Reactive.Linq;
using System.Reactive;
using Avalonia.VisualTree;

namespace Yomic.Views
{
    public partial class SourceFeedView : UserControl
    {
        public SourceFeedView()
        {
            InitializeComponent();
            
            // Listen to scroll changes on both grid and list view mode list boxes to save the scroll offset
            MangaListBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);
            MangaListModeBox.AddHandler(ScrollViewer.ScrollChangedEvent, OnScrollChanged);

            Loaded += OnViewLoaded;
        }

        private double _targetScrollOffset = -1;

        private void OnViewLoaded(object? sender, EventArgs e)
        {
            if (DataContext is ViewModels.SourceFeedViewModel vm && vm.SavedScrollOffset > 0)
            {
                _targetScrollOffset = vm.SavedScrollOffset;
            }
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            if (e.Source is ScrollViewer sv && DataContext is ViewModels.SourceFeedViewModel vm)
            {
                if (_targetScrollOffset > 0)
                {
                    double maxScroll = Math.Max(0, sv.Extent.Height - sv.Viewport.Height);
                    if (maxScroll > 0)
                    {
                        sv.Offset = new Avalonia.Vector(sv.Offset.X, Math.Min(_targetScrollOffset, maxScroll));
                        if (Math.Abs(sv.Offset.Y - _targetScrollOffset) < 5 || sv.Offset.Y >= maxScroll - 1)
                        {
                            _targetScrollOffset = -1;
                        }
                    }
                    return;
                }

                // Save the current vertical scroll position in the ViewModel
                vm.SavedScrollOffset = sv.Offset.Y;

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
            // Handled directly inside OnScrollChanged layout updates
        }
    }
}
