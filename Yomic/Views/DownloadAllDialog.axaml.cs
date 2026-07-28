using Avalonia.Controls;
using Avalonia.Interactivity;
using Yomic.ViewModels;

namespace Yomic.Views
{
    public partial class DownloadAllDialog : Window
    {
        public DownloadAllDialog()
        {
            InitializeComponent();
        }

        private DownloadAllDialogInfo _info = null!;

        public DownloadAllDialog(DownloadAllDialogInfo info) : this()
        {
            _info = info;
            MangaTitleText.Text = info.MangaTitle;
            TotalCountText.Text = info.TotalChapters.ToString();
            MissingCountText.Text = info.NotDownloadedCount.ToString();
            UnreadCountText.Text = info.UnreadNotDownloadedCount.ToString();
            UnreadOption.IsEnabled = info.UnreadNotDownloadedCount > 0;

            NotDownloadedOption.IsCheckedChanged += OnOptionChanged;
            UnreadOption.IsCheckedChanged += OnOptionChanged;
            
            UpdateWarningVisibility();
        }

        private void OnOptionChanged(object? sender, RoutedEventArgs e)
        {
            UpdateWarningVisibility();
        }

        private void UpdateWarningVisibility()
        {
            int toDownload = UnreadOption.IsChecked == true ? _info.UnreadNotDownloadedCount : _info.NotDownloadedCount;
            BulkWarningBorder.IsVisible = toDownload > 20;
        }

        private void OnCancelClick(object? sender, RoutedEventArgs e)
        {
            Close(null);
        }

        private void OnStartClick(object? sender, RoutedEventArgs e)
        {
            var mode = UnreadOption.IsChecked == true
                ? DownloadAllMode.UnreadNotDownloaded
                : DownloadAllMode.NotDownloaded;

            Close(mode);
        }
    }
}
