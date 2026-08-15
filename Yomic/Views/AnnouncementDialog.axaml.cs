using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Avalonia.Layout;
using Avalonia.Media;
using Yomic.Core.Models;
using Yomic.ViewModels;

namespace Yomic.Views
{
    public partial class AnnouncementDialog : Window
    {
        private MainWindowViewModel? _viewModel;

        public AnnouncementDialog()
        {
            InitializeComponent();
            Opened += OnDialogOpened;
        }

        private async void OnDialogOpened(object? sender, EventArgs e)
        {
            if (_viewModel != null && _viewModel.AnnouncementService.CachedAnnouncements.Count == 0)
            {
                await LoadAndPopulateAnnouncementsAsync();
            }
        }

        public static async Task ShowDialogAsync(Window owner, MainWindowViewModel viewModel)
        {
            var dialog = new AnnouncementDialog
            {
                _viewModel = viewModel
            };

            // If we already have cached announcements, render them immediately before showing window (0ms delay)
            if (viewModel.AnnouncementService.CachedAnnouncements.Count > 0)
            {
                dialog.PopulateAnnouncements(viewModel.AnnouncementService.CachedAnnouncements);
                dialog.AnnouncementsScrollViewer.IsVisible = true;
                dialog.LoadingContainer.IsVisible = false;
                dialog.EmptyContainer.IsVisible = false;

                var latest = viewModel.AnnouncementService.CachedAnnouncements[0];
                if (!string.IsNullOrEmpty(latest.Id))
                {
                    viewModel.MarkAnnouncementsAsRead(latest.Id);
                }
            }
            else
            {
                dialog.LoadingContainer.IsVisible = true;
                dialog.AnnouncementsScrollViewer.IsVisible = false;
                dialog.EmptyContainer.IsVisible = false;
            }

            await dialog.ShowDialog(owner);
        }

        private async Task LoadAndPopulateAnnouncementsAsync(bool forceRefresh = false)
        {
            if (_viewModel == null) return;

            LoadingContainer.IsVisible = true;
            EmptyContainer.IsVisible = false;
            AnnouncementsScrollViewer.IsVisible = false;

            List<Announcement> announcements;
            if (forceRefresh || _viewModel.AnnouncementService.CachedAnnouncements.Count == 0)
            {
                announcements = await _viewModel.AnnouncementService.FetchAnnouncementsAsync();
            }
            else
            {
                announcements = _viewModel.AnnouncementService.CachedAnnouncements;
            }

            LoadingContainer.IsVisible = false;

            if (announcements == null || announcements.Count == 0)
            {
                EmptyContainer.IsVisible = true;
                AnnouncementsScrollViewer.IsVisible = false;
            }
            else
            {
                EmptyContainer.IsVisible = false;
                AnnouncementsScrollViewer.IsVisible = true;
                PopulateAnnouncements(announcements);

                // Mark the latest announcement as read
                if (announcements.Count > 0 && !string.IsNullOrEmpty(announcements[0].Id))
                {
                    _viewModel.MarkAnnouncementsAsRead(announcements[0].Id);
                }
            }
        }

        private void PopulateAnnouncements(List<Announcement> announcements)
        {
            AnnouncementsContainer.Children.Clear();

            foreach (var item in announcements)
            {
                var card = CreateAnnouncementCard(item);
                AnnouncementsContainer.Children.Add(card);
            }
        }

        private Border CreateAnnouncementCard(Announcement announcement)
        {
            var cardBorder = new Border
            {
                Background = GetResourceBrush("PrimaryBackground", "#1E1E1E"),
                BorderBrush = GetResourceBrush("SeparatorBrush", "#333333"),
                BorderThickness = new Thickness(1),
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(14),
                Margin = new Thickness(0, 0, 0, 4)
            };

            var mainGrid = new Grid
            {
                RowDefinitions = new RowDefinitions("Auto, Auto, Auto, Auto")
            };

            // 1. Header: Pill Type + Date
            var headerGrid = new Grid
            {
                ColumnDefinitions = new ColumnDefinitions("Auto, *, Auto"),
                Margin = new Thickness(0, 0, 0, 8)
            };

            // Badge Pill
            string typeLabel = announcement.Type?.ToUpperInvariant() switch
            {
                "WARNING" => "PERINGATAN",
                "ERROR" => "PENTING",
                _ => "INFO"
            };

            string badgeBgColor = announcement.BadgeBackground;
            var badgeBorder = new Border
            {
                Background = SolidColorBrush.Parse(badgeBgColor),
                CornerRadius = new CornerRadius(4),
                Padding = new Thickness(6, 2),
                HorizontalAlignment = HorizontalAlignment.Left
            };
            badgeBorder.Child = new TextBlock
            {
                Text = typeLabel,
                FontSize = 10,
                FontWeight = FontWeight.Bold,
                Foreground = Brushes.White
            };
            Grid.SetColumn(badgeBorder, 0);
            headerGrid.Children.Add(badgeBorder);

            // Date Text
            if (!string.IsNullOrWhiteSpace(announcement.Date))
            {
                var dateBlock = new TextBlock
                {
                    Text = announcement.Date,
                    FontSize = 11,
                    Foreground = GetResourceBrush("SecondaryText", "#888888"),
                    VerticalAlignment = VerticalAlignment.Center
                };
                Grid.SetColumn(dateBlock, 2);
                headerGrid.Children.Add(dateBlock);
            }

            Grid.SetRow(headerGrid, 0);
            mainGrid.Children.Add(headerGrid);

            // 2. Title
            var titleBlock = new TextBlock
            {
                Text = announcement.Title,
                FontSize = 15,
                FontWeight = FontWeight.Bold,
                Foreground = GetResourceBrush("PrimaryText", "#FFFFFF"),
                TextWrapping = TextWrapping.Wrap,
                Margin = new Thickness(0, 0, 0, 6)
            };
            Grid.SetRow(titleBlock, 1);
            mainGrid.Children.Add(titleBlock);

            // 3. Body Text (Simple Markdown Line Renderer)
            var bodyContainer = new StackPanel
            {
                Spacing = 4,
                Margin = new Thickness(0, 0, 0, announcement.HasUrl ? 8 : 0)
            };
            RenderSimpleMarkdown(bodyContainer, announcement.Body);
            Grid.SetRow(bodyContainer, 2);
            mainGrid.Children.Add(bodyContainer);

            // 4. Action URL Button (if available)
            if (announcement.HasUrl)
            {
                var actionButton = new Button
                {
                    Content = "Buka Tautan Terkait",
                    Background = SolidColorBrush.Parse("#1A0078D4"),
                    Foreground = SolidColorBrush.Parse("#0078D4"),
                    FontSize = 12,
                    FontWeight = FontWeight.SemiBold,
                    Padding = new Thickness(12, 6),
                    CornerRadius = new CornerRadius(4),
                    Cursor = new Avalonia.Input.Cursor(Avalonia.Input.StandardCursorType.Hand),
                    HorizontalAlignment = HorizontalAlignment.Left
                };

                actionButton.Click += (s, e) =>
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo(announcement.Url) { UseShellExecute = true });
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[AnnouncementDialog] Failed to open URL: {ex.Message}");
                    }
                };

                Grid.SetRow(actionButton, 3);
                mainGrid.Children.Add(actionButton);
            }

            cardBorder.Child = mainGrid;
            return cardBorder;
        }

        private void RenderSimpleMarkdown(StackPanel container, string markdownText)
        {
            if (string.IsNullOrWhiteSpace(markdownText)) return;

            var lines = markdownText.Split(new[] { "\r\n", "\n" }, StringSplitOptions.None);
            foreach (var rawLine in lines)
            {
                var line = rawLine.TrimEnd();
                if (string.IsNullOrWhiteSpace(line)) continue;

                if (line.StartsWith("- ") || line.StartsWith("* "))
                {
                    var itemPanel = new StackPanel
                    {
                        Orientation = Orientation.Horizontal,
                        Spacing = 6,
                        Margin = new Thickness(6, 1, 0, 1)
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
                        Foreground = GetResourceBrush("SecondaryText", "#CCCCCC"),
                        TextWrapping = TextWrapping.Wrap
                    });
                    container.Children.Add(itemPanel);
                }
                else
                {
                    container.Children.Add(new TextBlock
                    {
                        Text = line,
                        FontSize = 13,
                        Foreground = GetResourceBrush("SecondaryText", "#CCCCCC"),
                        TextWrapping = TextWrapping.Wrap,
                        Margin = new Thickness(0, 1, 0, 1)
                    });
                }
            }
        }

        private IBrush GetResourceBrush(string resourceKey, string fallbackHex)
        {
            if (Application.Current != null && Application.Current.TryFindResource(resourceKey, out var res))
            {
                if (res is IBrush brush) return brush;
            }
            return SolidColorBrush.Parse(fallbackHex);
        }

        private async void OnRefreshClick(object? sender, RoutedEventArgs e)
        {
            await LoadAndPopulateAnnouncementsAsync(forceRefresh: true);
        }

        private void OnCloseClick(object? sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
