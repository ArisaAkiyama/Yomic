using System;
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

                vm.RequestLanguageRestartConfirmation -= OpenLanguageRestartConfirmation;
                vm.RequestLanguageRestartConfirmation += OpenLanguageRestartConfirmation;
            }
        }

        private static readonly Avalonia.Platform.Storage.FilePickerFileType ZipFileType = new("Zip Archive (*.zip)")
        {
            Patterns = new[] { "*.zip" },
            MimeTypes = new[] { "application/zip", "application/x-zip-compressed" }
        };

        private async void OpenBackupDialog()
        {
            var topLevel = TopLevel.GetTopLevel(this);
            if (topLevel == null) return;

            var file = await topLevel.StorageProvider.SaveFilePickerAsync(new Avalonia.Platform.Storage.FilePickerSaveOptions
            {
                Title = GetResourceString("String.Dialog.BackupSaveTitle", "Save Yomic Backup"),
                SuggestedFileName = $"Yomic_Backup_{DateTime.Now:yyyy-MM-dd_HHmmss}.zip",
                DefaultExtension = "zip",
                FileTypeChoices = new[]
                {
                    ZipFileType,
                    Avalonia.Platform.Storage.FilePickerFileTypes.All
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

        private string GetResourceString(string key, string defaultValue)
        {
            if (this.TryFindResource(key, out var res) && res is string str)
            {
                return str;
            }
            return defaultValue;
        }

        private async void OpenRestoreDialog()
        {
            if (this.VisualRoot is Window parentWindow)
            {
                var title = GetResourceString("String.Dialog.RestoreTitle", "Restore Backup");
                var message = GetResourceString("String.Dialog.RestoreMsg", "Restoring a backup will replace all your current database, library, and settings. Make sure you have a recent backup if needed. Do you want to continue?");
                var dialog = new ConfirmDialog(title, message);
                
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
                Title = GetResourceString("String.Dialog.RestorePickerTitle", "Restore Yomic Backup"),
                AllowMultiple = false,
                FileTypeFilter = new[]
                {
                    ZipFileType,
                    Avalonia.Platform.Storage.FilePickerFileTypes.All
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
                var title = GetResourceString("String.Dialog.ClearDataTitle", "Clear All Data");
                var message = GetResourceString("String.Dialog.ClearDataMsg", "Are you absolutely sure you want to reset all data? This action is irreversible and will delete your entire local library and settings.");
                var dialog = new ConfirmDialog(title, message);
                
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
                var title = GetResourceString("String.Dialog.ClearHistoryTitle", "Clear Read History & Cache");
                var message = GetResourceString("String.Dialog.ClearHistoryMsg", "Are you sure you want to clear your reading history and image cache? All chapters will be marked as unread and memory will be freed up.");
                var dialog = new ConfirmDialog(title, message);
                
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

        private async void OpenLanguageRestartConfirmation(string selectedLang)
        {
            if (this.VisualRoot is Window parentWindow)
            {
                var title = parentWindow.FindResource("String.RestartRequired") as string ?? "Restart Required";
                var message = parentWindow.FindResource("String.RestartMessage") as string ?? "The application needs to restart to apply the new language. Do you want to restart now?";

                var dialog = new ConfirmDialog(title, message);

                var mainVM = parentWindow.DataContext as Yomic.ViewModels.MainWindowViewModel;
                if (mainVM != null) mainVM.IsDialogOverlayVisible = true;

                var result = await dialog.ShowDialog<bool>(parentWindow);

                if (mainVM != null) mainVM.IsDialogOverlayVisible = false;

                if (result)
                {
                    var processPath = System.Environment.ProcessPath;
                    if (!string.IsNullOrEmpty(processPath))
                    {
                        System.Diagnostics.Process.Start(processPath);
                        System.Environment.Exit(0);
                    }
                }
                else
                {
                    if (DataContext is Yomic.ViewModels.SettingsViewModel vm)
                    {
                        vm.RevertLanguageSelection();
                    }
                }
            }
        }
    }
}
