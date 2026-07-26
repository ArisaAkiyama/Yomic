using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Yomic.ViewModels;
using System.Collections.Generic;
using System;
using System.Threading.Tasks;
using System.Linq;
using System.Reactive.Linq;
using Avalonia.Controls.Primitives;
using Avalonia.VisualTree;

namespace Yomic.Views
{
    public partial class LibraryView : UserControl
    {
        private IDisposable? _scrollSubscription;

        public LibraryView()
        {
            InitializeComponent();
            DataContextChanged += OnDataContextChanged;
            AttachedToVisualTree += (_, _) => AttachLazyLoading();
            DetachedFromVisualTree += (_, _) => DetachLazyLoading();
        }

        private void AttachLazyLoading()
        {
            DetachLazyLoading();

            var scrollViewer = this.FindControl<ScrollViewer>("LibraryScrollViewer");
            if (scrollViewer == null) return;

            _scrollSubscription = Observable
                .FromEventPattern<ScrollChangedEventArgs>(
                    h => scrollViewer.ScrollChanged += h,
                    h => scrollViewer.ScrollChanged -= h)
                .Throttle(TimeSpan.FromMilliseconds(120))
                .Subscribe(_ => Avalonia.Threading.Dispatcher.UIThread.Post(() => TryLoadMore(scrollViewer)));
        }

        private void TryLoadMore(ScrollViewer scrollViewer)
        {
            if (DataContext is not LibraryViewModel vm || vm.IsLoadingMore || !vm.HasMoreItems) return;

            var remaining = scrollViewer.Extent.Height - scrollViewer.Viewport.Height - scrollViewer.Offset.Y;
            if (remaining <= 700)
            {
                vm.LoadMoreCommand.Execute().Subscribe();
            }
        }

        private void DetachLazyLoading()
        {
            _scrollSubscription?.Dispose();
            _scrollSubscription = null;
        }

        private void OnDataContextChanged(object? sender, EventArgs e)
        {
            if (DataContext is LibraryViewModel vm)
            {
                vm.ConfirmDeleteFromDiskAsync = ShowDeleteFromDiskWarningAsync;
                vm.ConfirmDeleteDownloadsAsync = ShowDeleteDownloadsWarningAsync;
                vm.RequestManageCategoriesAsync = ShowManageCategoriesDialogAsync;
                vm.RequestEditMangaCategoriesAsync = ShowCategorySelectionDialogAsync;
            }
        }

        private string GetResourceString(string key, string defaultValue)
        {
            if (this.TryFindResource(key, out var res) && res is string str)
            {
                return str;
            }
            return defaultValue;
        }

        private async Task<bool> ShowDeleteFromDiskWarningAsync(MangaItem item)
        {
            var owner = TopLevel.GetTopLevel(this) as Window;
            var title = GetResourceString("String.Dialog.DeleteDiskTitle", "Delete from Disk");
            var format = GetResourceString("String.Dialog.DeleteDiskMsg", "This will remove \"{0}\" from your library and permanently delete its downloaded chapters from disk. This action cannot be undone.");
            var message = string.Format(format, item.Title);
            
            var dialog = new ConfirmDialog(title, message);

            return owner != null && await dialog.ShowDialog<bool>(owner);
        }

        private async Task<bool> ShowDeleteDownloadsWarningAsync(MangaItem item)
        {
            var owner = TopLevel.GetTopLevel(this) as Window;
            var title = GetResourceString("String.Dialog.DeleteDownloadsTitle", "Delete All Downloads");
            var format = GetResourceString("String.Dialog.DeleteDownloadsMsg", "This will permanently delete all downloaded chapters of \"{0}\" from disk. The manga will remain in your library. This action cannot be undone.");
            var message = string.Format(format, item.Title);
            
            var dialog = new ConfirmDialog(title, message);

            return owner != null && await dialog.ShowDialog<bool>(owner);
        }

        private async Task ShowManageCategoriesDialogAsync()
        {
            var owner = TopLevel.GetTopLevel(this) as Window;
            if (owner != null && DataContext is LibraryViewModel vm)
            {
                var dialog = new ManageCategoriesDialog(new Core.Services.LibraryService());
                await dialog.ShowDialog(owner);
                
                // Refresh categories in VM
                await vm.LoadCategoriesAsync();
            }
        }

        private async Task ShowCategorySelectionDialogAsync(MangaItem item)
        {
            var owner = TopLevel.GetTopLevel(this) as Window;
            if (owner != null && DataContext is LibraryViewModel vm)
            {
                var libraryService = new Core.Services.LibraryService();
                var allCategories = await libraryService.GetCategoriesAsync();
                var currentCheckedIds = await libraryService.GetMangaCategoryIdsAsync(item.MangaUrl, item.SourceId);
                
                var dialog = new CategorySelectionDialog(allCategories, currentCheckedIds);
                var result = await dialog.ShowDialog<List<long>>(owner);
                
                if (result != null)
                {
                    await libraryService.SetMangaCategoriesAsync(item.MangaUrl, item.SourceId, result);
                    
                    // Update UI model
                    item.CategoryIds = result;
                    
                    // Re-filter the view
                    vm.FilterLibrary();
                }
            }
        }

        private Point _dragStartPos;
        private bool _isPressed;

        private void OnMangaCardPointerPressed(object? sender, PointerPressedEventArgs e)
        {
            var pointerProperties = e.GetCurrentPoint(sender as Visual).Properties;
            if (pointerProperties.IsLeftButtonPressed)
            {
                _dragStartPos = e.GetPosition(this);
                _isPressed = true;
            }
        }

        private async void OnMangaCardPointerMoved(object? sender, PointerEventArgs e)
        {
            if (_isPressed && e.GetCurrentPoint(sender as Visual).Properties.IsLeftButtonPressed)
            {
                var currentPos = e.GetPosition(this);
                var deltaX = Math.Abs(currentPos.X - _dragStartPos.X);
                var deltaY = Math.Abs(currentPos.Y - _dragStartPos.Y);
                
                if (deltaX > 8 || deltaY > 8)
                {
                    _isPressed = false;
                    
                    if (sender is Border border && border.DataContext is MangaItem item)
                    {
                        var dragData = new DataObject();
                        dragData.Set("MangaItem", item);
                        
                        await DragDrop.DoDragDrop(e, dragData, DragDropEffects.Move);
                    }
                }
            }
        }

        private void OnMangaCardPointerReleased(object? sender, PointerReleasedEventArgs e)
        {
            _isPressed = false;
        }

        private void OnTabDragOver(object? sender, DragEventArgs e)
        {
            if (e.Data.Contains("MangaItem"))
            {
                e.DragEffects = DragDropEffects.Move;
            }
            else
            {
                e.DragEffects = DragDropEffects.None;
            }
            e.Handled = true;
        }

        private async void OnTabDrop(object? sender, DragEventArgs e)
        {
            if (e.Data.Contains("MangaItem") && sender is Border border && border.DataContext is CategoryTabItem tab)
            {
                var mangaItem = e.Data.Get("MangaItem") as MangaItem;
                if (mangaItem != null)
                {
                    if (DataContext is LibraryViewModel vm)
                    {
                        await vm.AddMangaToCategoryAsync(mangaItem, tab.Id);
                    }
                }
            }
            e.Handled = true;
        }
        
        private void OnMangaCardPressed(object? sender, PointerPressedEventArgs e)
        {
            var point = e.GetCurrentPoint(this);
            if (point.Properties.IsLeftButtonPressed)
            {
                if (sender is Border border && border.Tag is MangaItem item)
                {
                    if (DataContext is LibraryViewModel vm)
                    {
                        vm.OpenMangaCommand.Execute(item).Subscribe(_ => { });
                    }
                }
            }
        }

        private void OnOverlayDismiss(object? sender, PointerPressedEventArgs e)
        {
            if (DataContext is LibraryViewModel vm)
            {
                vm.IsFilterVisible = false;
            }
        }

        private void ScrollTabsLeft_Click(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
        {
            var sv = this.FindControl<ScrollViewer>("SourceTabsScrollViewer");
            if (sv != null)
            {
                var newOffset = Math.Max(0, sv.Offset.X - 200);
                sv.Offset = new Avalonia.Vector(newOffset, sv.Offset.Y);
            }
        }

        private void ScrollTabsRight_Click(object? sender, Avalonia.Interactivity.RoutedEventArgs e)
        {
            var sv = this.FindControl<ScrollViewer>("SourceTabsScrollViewer");
            if (sv != null)
            {
                var newOffset = Math.Min(sv.Extent.Width - sv.Viewport.Width, sv.Offset.X + 200);
                if (newOffset > 0)
                {
                    sv.Offset = new Avalonia.Vector(newOffset, sv.Offset.Y);
                }
            }
        }
    }
}
