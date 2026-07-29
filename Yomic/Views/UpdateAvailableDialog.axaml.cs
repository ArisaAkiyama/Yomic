using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Media;
using Yomic.Core.Services;

namespace Yomic.Views
{
    public partial class UpdateAvailableDialog : Window
    {
        private string _downloadUrl = string.Empty;

        public UpdateAvailableDialog()
        {
            InitializeComponent();
        }

        public static async Task<bool> ShowDialogAsync(Window owner, UpdateService.UpdateInfo updateInfo)
        {
            var dialog = new UpdateAvailableDialog();
            dialog.PopulateData(updateInfo);
            await dialog.ShowDialog(owner);
            return dialog.Tag is bool result && result;
        }

        public void PopulateData(UpdateService.UpdateInfo updateInfo)
        {
            _downloadUrl = updateInfo.DownloadUrl;
            TagText.Text = $"New version: {updateInfo.LatestVersion}";
            CurrentVersionText.Text = $"Current: v{UpdateService.CURRENT_VERSION}";

            PopulateMarkdownReleaseNotes(updateInfo.ReleaseNotes);
        }

        private void PopulateMarkdownReleaseNotes(string markdownText)
        {
            ReleaseNotesContainer.Children.Clear();

            if (string.IsNullOrWhiteSpace(markdownText))
            {
                ReleaseNotesContainer.Children.Add(new TextBlock
                {
                    Text = "No release notes provided for this version.",
                    FontStyle = FontStyle.Italic,
                    Foreground = Brushes.Gray,
                    FontSize = 13
                });
                return;
            }

            var lines = markdownText.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            foreach (var rawLine in lines)
            {
                var line = rawLine.TrimEnd();
                if (string.IsNullOrWhiteSpace(line)) continue;

                // Headers (# Header)
                if (line.StartsWith("# "))
                {
                    ReleaseNotesContainer.Children.Add(new TextBlock
                    {
                        Text = line.Substring(2).Trim(),
                        FontSize = 16,
                        FontWeight = FontWeight.Bold,
                        Foreground = Brushes.White,
                        Margin = new Avalonia.Thickness(0, 8, 0, 4)
                    });
                }
                else if (line.StartsWith("## "))
                {
                    ReleaseNotesContainer.Children.Add(new TextBlock
                    {
                        Text = line.Substring(3).Trim(),
                        FontSize = 14,
                        FontWeight = FontWeight.Bold,
                        Foreground = Brushes.White,
                        Margin = new Avalonia.Thickness(0, 6, 0, 2)
                    });
                }
                else if (line.StartsWith("### "))
                {
                    ReleaseNotesContainer.Children.Add(new TextBlock
                    {
                        Text = line.Substring(4).Trim(),
                        FontSize = 13,
                        FontWeight = FontWeight.SemiBold,
                        Foreground = Brushes.LightGray,
                        Margin = new Avalonia.Thickness(0, 4, 0, 2)
                    });
                }
                // Bullet points (- Poin or * Poin)
                else if (line.StartsWith("- ") || line.StartsWith("* "))
                {
                    var itemPanel = new StackPanel
                    {
                        Orientation = Avalonia.Layout.Orientation.Horizontal,
                        Spacing = 6,
                        Margin = new Avalonia.Thickness(8, 2, 0, 2)
                    };
                    itemPanel.Children.Add(new TextBlock
                    {
                        Text = "•",
                        Foreground = SolidColorBrush.Parse("#0078D4"),
                        FontWeight = FontWeight.Bold,
                        FontSize = 13
                    });
                    itemPanel.Children.Add(new TextBlock
                    {
                        Text = line.Substring(2).Trim(),
                        FontSize = 13,
                        Foreground = SolidColorBrush.Parse("#CCCCCC"),
                        TextWrapping = TextWrapping.Wrap
                    });
                    ReleaseNotesContainer.Children.Add(itemPanel);
                }
                // Standard Text
                else
                {
                    ReleaseNotesContainer.Children.Add(new TextBlock
                    {
                        Text = line,
                        FontSize = 13,
                        Foreground = SolidColorBrush.Parse("#CCCCCC"),
                        TextWrapping = TextWrapping.Wrap,
                        Margin = new Avalonia.Thickness(0, 2, 0, 2)
                    });
                }
            }
        }

        private void OnUpdateClick(object? sender, RoutedEventArgs e)
        {
            if (!string.IsNullOrEmpty(_downloadUrl))
            {
                try
                {
                    Process.Start(new ProcessStartInfo(_downloadUrl) { UseShellExecute = true });
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[UpdateDialog] Open URL failed: {ex.Message}");
                }
            }

            Tag = true; // User clicked update
            Close();
        }

        private void OnCancelClick(object? sender, RoutedEventArgs e)
        {
            Tag = false; // User clicked cancel
            Close();
        }
    }
}
