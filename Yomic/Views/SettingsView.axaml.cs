using Avalonia.Controls;

namespace Yomic.Views
{
    public partial class SettingsView : UserControl
    {
        public SettingsView()
        {
            InitializeComponent();
            this.DataContextChanged += OnDataContextChanged;
        }

        private void OnDataContextChanged(object? sender, System.EventArgs e)
        {
            if (DataContext is Yomic.ViewModels.SettingsViewModel vm)
            {
                vm.RequestBackupDialog -= OpenBackupDialog;
                vm.RequestBackupDialog += OpenBackupDialog;

                vm.RequestRestoreDialog -= OpenRestoreDialog;
                vm.RequestRestoreDialog += OpenRestoreDialog;

                vm.RequestClearDataDialog -= OpenClearDataDialog;
                vm.RequestClearDataDialog += OpenClearDataDialog;

                vm.RequestClearHistoryDialog -= OpenClearHistoryDialog;
                vm.RequestClearHistoryDialog += OpenClearHistoryDialog;

                vm.RequestExportLogsDialog -= OpenExportLogsDialog;
                vm.RequestExportLogsDialog += OpenExportLogsDialog;
            }
        }

        private async void OpenBackupDialog()
        {
            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel == null) return;

            var file = await topLevel.StorageProvider.SaveFilePickerAsync(new Avalonia.Platform.Storage.FilePickerSaveOptions
            {
                Title = "Save Yomic Backup",
                DefaultExtension = "yomicbk",
                FileTypeChoices = new[]
                {
                    new Avalonia.Platform.Storage.FilePickerFileType("Yomic Backup") { Patterns = new[] { "*.yomicbk" } },
                    new Avalonia.Platform.Storage.FilePickerFileType("Zip Archive") { Patterns = new[] { "*.zip" } },
                    new Avalonia.Platform.Storage.FilePickerFileType("All Files") { Patterns = new[] { "*.*" } }
                }
            });

            if (file != null)
            {
                if (DataContext is Yomic.ViewModels.SettingsViewModel vm)
                {
                    await vm.ProcessBackupAsync(file.Path.LocalPath);
                }
            }
        }

        private async void OpenRestoreDialog()
        {
            if (this.VisualRoot is Window parentWindow)
            {
                var dialog = new ConfirmDialog("Restore Backup", "Restoring a backup will replace all your current database, library, and settings. Make sure you have a recent backup if needed. Do you want to continue?");
                
                var mainVM = parentWindow.DataContext as Yomic.ViewModels.MainWindowViewModel;
                if (mainVM != null) mainVM.IsDialogOverlayVisible = true;

                var result = await dialog.ShowDialog<bool>(parentWindow);

                if (mainVM != null) mainVM.IsDialogOverlayVisible = false;

                if (!result) return;
            }

            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel == null) return;

            var files = await topLevel.StorageProvider.OpenFilePickerAsync(new Avalonia.Platform.Storage.FilePickerOpenOptions
            {
                Title = "Restore Yomic Backup",
                AllowMultiple = false,
                FileTypeFilter = new[]
                {
                    new Avalonia.Platform.Storage.FilePickerFileType("Yomic Backup") { Patterns = new[] { "*.yomicbk" } },
                    new Avalonia.Platform.Storage.FilePickerFileType("Zip Archive") { Patterns = new[] { "*.zip" } },
                    new Avalonia.Platform.Storage.FilePickerFileType("All Files") { Patterns = new[] { "*.*" } }
                }
            });

            if (files != null && files.Count > 0)
            {
                if (DataContext is Yomic.ViewModels.SettingsViewModel vm)
                {
                    await vm.ProcessRestoreAsync(files[0].Path.LocalPath);
                }
            }
        }


        private async void OpenClearDataDialog()
        {
            if (this.VisualRoot is Window parentWindow)
            {
                var dialog = new ConfirmDialog("Clear All Data", "Are you absolutely sure you want to reset all data? This action is irreversible and will delete your entire local library and settings.");
                
                var mainVM = parentWindow.DataContext as Yomic.ViewModels.MainWindowViewModel;
                if (mainVM != null) mainVM.IsDialogOverlayVisible = true;

                var result = await dialog.ShowDialog<bool>(parentWindow);

                if (mainVM != null) mainVM.IsDialogOverlayVisible = false;

                if (result && DataContext is Yomic.ViewModels.SettingsViewModel vm)
                {
                    await vm.ProcessClearDataAsync();
                }
            }
        }

        private async void OpenClearHistoryDialog()
        {
            if (this.VisualRoot is Window parentWindow)
            {
                var dialog = new ConfirmDialog("Clear Read History & Cache", "Are you sure you want to clear your reading history and image cache? All chapters will be marked as unread and memory will be freed up.");
                
                var mainVM = parentWindow.DataContext as Yomic.ViewModels.MainWindowViewModel;
                if (mainVM != null) mainVM.IsDialogOverlayVisible = true;

                var result = await dialog.ShowDialog<bool>(parentWindow);

                if (mainVM != null) mainVM.IsDialogOverlayVisible = false;

                if (result && DataContext is Yomic.ViewModels.SettingsViewModel vm)
                {
                    await vm.ProcessClearHistoryAsync();
                }
            }
        }
        private async void OpenExportLogsDialog()
        {
            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel == null) return;

            var file = await topLevel.StorageProvider.SaveFilePickerAsync(new Avalonia.Platform.Storage.FilePickerSaveOptions
            {
                Title = "Export Yomic Logs",
                SuggestedFileName = $"yomic-log-{System.DateTime.Now:yyyyMMdd-HHmmss}.log",
                DefaultExtension = "log",
                FileTypeChoices = new[]
                {
                    new Avalonia.Platform.Storage.FilePickerFileType("Log File") { Patterns = new[] { "*.log", "*.txt" } },
                    new Avalonia.Platform.Storage.FilePickerFileType("All Files") { Patterns = new[] { "*.*" } }
                }
            });

            if (file != null && DataContext is Yomic.ViewModels.SettingsViewModel vm)
            {
                await vm.ProcessExportLogsAsync(file.Path.LocalPath);
            }
        }
    }
}
