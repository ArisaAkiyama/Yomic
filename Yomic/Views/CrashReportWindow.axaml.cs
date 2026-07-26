using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;
using Yomic.ViewModels;
using System;

namespace Yomic.Views
{
    public partial class CrashReportWindow : Window
    {
        public CrashReportWindow()
        {
            InitializeComponent();
        }

        public CrashReportWindow(string logData) : this()
        {
            var textBox = this.FindControl<TextBox>("LogTextBox");
            if (textBox != null)
            {
                textBox.Text = logData;
            }
        }

        private void InitializeComponent()
        {
            AvaloniaXamlLoader.Load(this);
        }

        private async void OnSendFeedbackClick(object? sender, RoutedEventArgs e)
        {
            var textBox = this.FindControl<TextBox>("LogTextBox");
            string crashLog = textBox?.Text ?? string.Empty;

            if (!string.IsNullOrEmpty(crashLog))
            {
                var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
                if (clipboard != null)
                {
                    await clipboard.SetTextAsync(crashLog);
                }
            }

            var settingsService = new Yomic.Core.Services.SettingsService();
            var feedbackVM = new FeedbackDialogViewModel(settingsService)
            {
                FeedbackText = "Saya mengalami crash. Berikut log kejadian:\n\n" + crashLog
            };

            var dialog = new FeedbackDialog
            {
                DataContext = feedbackVM
            };

            await dialog.ShowDialog(this);
        }

        private void OnOkClick(object? sender, RoutedEventArgs e)
        {
            Close();
        }

        private void OnCancelClick(object? sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
