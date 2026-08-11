using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using Avalonia.Controls;
using Avalonia.Interactivity;
using Yomic.Core.Services;

namespace Yomic.Views
{
    public class ExtensionRepoItemViewModel
    {
        public string Name { get; set; } = "";
        public string Url { get; set; } = "";
        public bool IsOfficial { get; set; }
    }

    public partial class ExtensionReposDialog : Window
    {
        private readonly SettingsService? _settingsService;
        private readonly ObservableCollection<ExtensionRepoItemViewModel> _items = new();

        public ExtensionReposDialog()
        {
            InitializeComponent();
            _settingsService = App.SettingsService;
            RefreshList();
        }

        private void RefreshList()
        {
            _items.Clear();
            if (_settingsService != null)
            {
                var repos = _settingsService.GetAllExtensionRepos();
                foreach (var r in repos)
                {
                    bool isOfficial = r.Equals(SettingsService.OfficialDefaultExtensionRepo, StringComparison.OrdinalIgnoreCase);
                    _items.Add(new ExtensionRepoItemViewModel
                    {
                        Name = isOfficial ? "Official Yomic Repository" : GetHostName(r),
                        Url = r,
                        IsOfficial = isOfficial
                    });
                }
            }
            var control = this.FindControl<ItemsControl>("ReposControl");
            if (control != null)
            {
                control.ItemsSource = _items;
            }
        }

        private static string GetHostName(string url)
        {
            try
            {
                var uri = new Uri(url);
                return uri.Host;
            }
            catch
            {
                return "Custom Repository";
            }
        }

        private void OnAddRepoClick(object? sender, RoutedEventArgs e)
        {
            var textBox = this.FindControl<TextBox>("RepoUrlTextBox");
            if (textBox != null && !string.IsNullOrWhiteSpace(textBox.Text))
            {
                string url = textBox.Text.Trim();
                if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
                {
                    url = "https://" + url;
                }

                if (_settingsService != null && _settingsService.AddExtensionRepo(url))
                {
                    textBox.Text = "";
                    RefreshList();
                }
            }
        }

        private void OnDeleteRepoClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is ExtensionRepoItemViewModel item)
            {
                if (_settingsService != null && !item.IsOfficial)
                {
                    _settingsService.RemoveExtensionRepo(item.Url);
                    RefreshList();
                }
            }
        }

        private void OnResetClick(object? sender, RoutedEventArgs e)
        {
            if (_settingsService != null)
            {
                _settingsService.ResetExtensionRepos();
                RefreshList();
            }
        }

        private void OnCloseClick(object? sender, RoutedEventArgs e)
        {
            Close();
        }
    }
}
