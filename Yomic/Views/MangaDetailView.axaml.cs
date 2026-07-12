using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.VisualTree;
using Yomic.ViewModels;

namespace Yomic.Views
{
    public partial class MangaDetailView : UserControl
    {
        private ScrollViewer? _scrollViewer;
        private Border? _stickyHeader;
        private Grid? _chaptersDivider;

        public MangaDetailView()
        {
            InitializeComponent();
        }

        protected override void OnAttachedToVisualTree(VisualTreeAttachmentEventArgs e)
        {
            base.OnAttachedToVisualTree(e);
            InitializeStickyHeader();
            this.LayoutUpdated += OnLayoutUpdated;
        }

        protected override void OnDetachedFromVisualTree(VisualTreeAttachmentEventArgs e)
        {
            base.OnDetachedFromVisualTree(e);
            this.LayoutUpdated -= OnLayoutUpdated;
            if (_scrollViewer != null)
            {
                _scrollViewer.ScrollChanged -= OnScrollChanged;
                _scrollViewer = null;
            }
        }

        private void OnLayoutUpdated(object? sender, System.EventArgs e)
        {
            InitializeStickyHeader();
        }

        private void InitializeStickyHeader()
        {
            // Get the outer ScrollViewer (MainScrollViewer), not the inner ListBox's one
            if (_scrollViewer == null)
            {
                _scrollViewer = this.FindControl<ScrollViewer>("MainScrollViewer");
                if (_scrollViewer != null)
                {
                    _scrollViewer.ScrollChanged += OnScrollChanged;
                }
            }

            if (_stickyHeader == null)
            {
                _stickyHeader = this.FindControl<Border>("StickyHeader");
            }

            if (_chaptersDivider == null)
            {
                _chaptersDivider = this.FindControl<Grid>("ChaptersDivider");
            }
        }

        private void OnScrollChanged(object? sender, ScrollChangedEventArgs e)
        {
            UpdateStickyHeaderVisibility();
        }

        private void UpdateStickyHeaderVisibility()
        {
            if (_scrollViewer == null || _stickyHeader == null) return;

            if (_chaptersDivider == null)
            {
                _stickyHeader.IsVisible = false;
                return;
            }

            // Translate the ChaptersDivider position relative to this UserControl
            var relativePoint = _chaptersDivider.TranslatePoint(new Point(0, 0), this);
            if (relativePoint != null)
            {
                // Show sticky header once the chapter divider scrolls above the top of the view
                bool shouldBeSticky = relativePoint.Value.Y <= 15;
                _stickyHeader.IsVisible = shouldBeSticky;
            }
            else
            {
                _stickyHeader.IsVisible = false;
            }
        }

        protected override void OnDataContextChanged(System.EventArgs e)
        {
            base.OnDataContextChanged(e);

            if (DataContext is MangaDetailViewModel vm)
            {
                vm.ShowDownloadAllDialogAsync = ShowDownloadAllDialogAsync;
            }
        }

        private async System.Threading.Tasks.Task<DownloadAllMode?> ShowDownloadAllDialogAsync(DownloadAllDialogInfo info)
        {
            if (this.VisualRoot is not Window owner)
            {
                return DownloadAllMode.NotDownloaded;
            }

            var dialog = new DownloadAllDialog(info);
            return await dialog.ShowDialog<DownloadAllMode?>(owner);
        }

        private void OnSynopsisToggleClick(object? sender, RoutedEventArgs e)
        {
            if (_scrollViewer == null) return;

            // Preserve the current scroll offset before the synopsis layout changes
            var currentOffset = _scrollViewer.Offset;

            // After layout recalculates (synopsis expands/collapses), restore scroll position
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                _scrollViewer.Offset = currentOffset;
                UpdateStickyHeaderVisibility();
            }, Avalonia.Threading.DispatcherPriority.Render);
        }

        private void OnBackClick(object? sender, RoutedEventArgs e)
        {
            if (this.VisualRoot is MainWindow mainWindow &&
                mainWindow.DataContext is MainWindowViewModel vm)
            {
                vm.GoBack();
            }
        }

        private void OnReadClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is ChapterItem chapter &&
                this.VisualRoot is MainWindow mainWindow &&
                mainWindow.DataContext is MainWindowViewModel vm)
            {
                System.Collections.Generic.List<ChapterItem>? chapters = null;
                long sourceId = 3;
                string title = "";

                if (this.DataContext is MangaDetailViewModel detailVm)
                {
                    chapters = detailVm.Chapters;
                    sourceId = detailVm.SourceId;
                    title = detailVm.Title;
                    vm.GoToReader(chapter, chapters, sourceId, title, detailVm.Url, detailVm.IsExplicitContent, detailVm.ThumbnailUrl ?? "");
                }
                else
                {
                    vm.GoToReader(chapter, chapters, sourceId, title, "", false, "");
                }
            }
        }
    }
}
