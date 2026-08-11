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

        private void OnViewLoaded(object? sender, EventArgs e)
        {
            RestoreScrollPosition();
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            if (e.Source is ScrollViewer sv && DataContext is ViewModels.SourceFeedViewModel vm)
            {
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
            if (DataContext is ViewModels.SourceFeedViewModel vm && vm.SavedScrollOffset > 0)
            {
                var listBox = vm.IsListView ? MangaListModeBox : MangaListBox;
                if (listBox != null)
                {
                    // Restore offset using low priority Dispatcher post to ensure the layout has settled
                    Avalonia.Threading.Dispatcher.UIThread.Post(() =>
                    {
                        var sv = listBox.FindDescendantOfType<ScrollViewer>();
                        if (sv != null)
                        {
                            sv.Offset = new Avalonia.Vector(sv.Offset.X, vm.SavedScrollOffset);
                            System.Diagnostics.Debug.WriteLine($"[Scroll] Restored scroll offset to: {vm.SavedScrollOffset}");
                        }
                    }, Avalonia.Threading.DispatcherPriority.Loaded);
                }
            }
        }
    }
}
