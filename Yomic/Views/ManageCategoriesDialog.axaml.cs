using Avalonia;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Media;
using ReactiveUI;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using Yomic.Core.Models;
using Yomic.Core.Services;

namespace Yomic.Views
{
    public class CategoryItemViewModel : ReactiveObject
    {
        public long Id { get; set; }
        
        private string _name = string.Empty;
        public string Name
        {
            get => _name;
            set => this.RaiseAndSetIfChanged(ref _name, value);
        }

        private string _color = "#0078D4";
        public string Color
        {
            get => _color;
            set
            {
                this.RaiseAndSetIfChanged(ref _color, value);
                this.RaisePropertyChanged(nameof(ColorBrush));
            }
        }

        private bool _isDefault;
        public bool IsDefault
        {
            get => _isDefault;
            set
            {
                this.RaiseAndSetIfChanged(ref _isDefault, value);
                this.RaisePropertyChanged(nameof(StarIcon));
                this.RaisePropertyChanged(nameof(StarColor));
                this.RaisePropertyChanged(nameof(StarFill));
                this.RaisePropertyChanged(nameof(StarStroke));
            }
        }

        private bool _isUpdateExcluded;
        public bool IsUpdateExcluded
        {
            get => _isUpdateExcluded;
            set
            {
                this.RaiseAndSetIfChanged(ref _isUpdateExcluded, value);
                this.RaisePropertyChanged(nameof(ExcludeIcon));
                this.RaisePropertyChanged(nameof(ExcludeColor));
                this.RaisePropertyChanged(nameof(ExcludeToolTip));
            }
        }

        public IBrush ColorBrush => Brush.Parse(Color);
        public string StarIcon => IsDefault ? "M8.243 7.34l-6.38 .925l-.113 .023a1 1 0 0 0 -.44 1.684l4.622 4.499l-1.09 6.355l-.013 .11a1 1 0 0 0 1.464 .944l5.706 -3l5.693 3l.1 .046a1 1 0 0 0 1.352 -1.1l-1.091 -6.355l4.624 -4.5l.078 -.085a1 1 0 0 0 -.633 -1.62l-6.38 -.926l-2.852 -5.78a1 1 0 0 0 -1.794 0l-2.853 5.78z" : "M12 17.75l-6.172 3.245l1.179 -6.873l-5 -4.867l6.9 -1l3.086 -6.253l3.086 6.253l6.9 1l-5 4.867l1.179 6.873l-6.158 -3.245"; // Filled vs hollow star
        public string StarColor => IsDefault ? "#FFB900" : "#7A7A7A"; // Gold vs grey
        public string StarFill => IsDefault ? StarColor : "Transparent";
        public string StarStroke => IsDefault ? "Transparent" : StarColor;
        
        public string ExcludeIcon => IsUpdateExcluded ? "M18 6l-12 12 M6 6l12 12" : "M5 12l5 5l10 -10"; // Cancel (X) vs CheckMark
        public string ExcludeColor => IsUpdateExcluded ? "#F87171" : "#107C41"; // Red if excluded, Green if included
        public string ExcludeToolTip => IsUpdateExcluded ? "Updates Paused (Click to Resume)" : "Updates Active (Click to Pause)";
    }

    public partial class ManageCategoriesDialog : Window
    {
        private readonly LibraryService _libraryService;
        private readonly ObservableCollection<CategoryItemViewModel> _categories = new();
        private CategoryItemViewModel? _editingItem;
        private string _selectedColor = "#0078D4";
        private readonly List<Border> _paletteColorBorders = new();

        private static readonly string[] PaletteColors = new[]
        {
            "#0078D4", // Blue
            "#00B7C3", // Teal
            "#107C41", // Green
            "#FFB900", // Yellow
            "#D83B01", // Orange
            "#E81123", // Red
            "#E3008C", // Pink
            "#5C2D91", // Purple
            "#B4A0FF", // Lavender
            "#7A7A7A"  // Gray
        };

        public ManageCategoriesDialog()
        {
            InitializeComponent();
            _libraryService = new LibraryService();
        }

        public ManageCategoriesDialog(LibraryService libraryService) : this()
        {
            _libraryService = libraryService;
            
            var control = this.FindControl<ItemsControl>("CategoriesControl");
            if (control != null)
            {
                control.ItemsSource = _categories;
            }

            PopulatePalette();
            _ = LoadCategoriesAsync();
        }

        private async Task LoadCategoriesAsync()
        {
            var dbCategories = await _libraryService.GetCategoriesAsync();
            
            Avalonia.Threading.Dispatcher.UIThread.Post(() =>
            {
                _categories.Clear();
                foreach (var c in dbCategories)
                {
                    _categories.Add(new CategoryItemViewModel
                    {
                        Id = c.Id,
                        Name = c.Name,
                        Color = c.Color,
                        IsDefault = c.IsDefault,
                        IsUpdateExcluded = c.UpdateExcluded
                    });
                }

                var emptyState = this.FindControl<TextBlock>("EmptyStateText");
                if (emptyState != null)
                {
                    emptyState.IsVisible = !_categories.Any();
                }

                ValidateInput();
            });
        }

        private void PopulatePalette()
        {
            var palette = this.FindControl<WrapPanel>("ColorsPalette");
            if (palette == null) return;

            foreach (var colorHex in PaletteColors)
            {
                var innerCircle = new Border
                {
                    Width = 14,
                    Height = 14,
                    CornerRadius = new CornerRadius(7),
                    Background = Brush.Parse(colorHex)
                };

                var border = new Border
                {
                    Width = 24,
                    Height = 24,
                    CornerRadius = new CornerRadius(12),
                    BorderThickness = new Avalonia.Thickness(2),
                    BorderBrush = Brushes.Transparent,
                    Padding = new Avalonia.Thickness(2),
                    Child = innerCircle,
                    Margin = new Avalonia.Thickness(4, 0),
                    Cursor = new Cursor(StandardCursorType.Hand)
                };

                if (colorHex == _selectedColor)
                {
                    border.BorderBrush = GetThemeBrush("PrimaryText", Brushes.White);
                }

                border.PointerPressed += (s, e) =>
                {
                    SelectColor(colorHex, border);
                };

                palette.Children.Add(border);
                _paletteColorBorders.Add(border);
            }
        }

        private void SelectColor(string colorHex, Border border)
        {
            _selectedColor = colorHex;
            foreach (var b in _paletteColorBorders)
            {
                b.BorderBrush = Brushes.Transparent;
            }
            border.BorderBrush = GetThemeBrush("PrimaryText", Brushes.White);
        }

        private void OnCloseClick(object? sender, RoutedEventArgs e)
        {
            Close();
        }

        private async void OnActionClick(object? sender, RoutedEventArgs e)
        {
            var input = this.FindControl<TextBox>("CategoryNameInput");
            if (input == null || string.IsNullOrWhiteSpace(input.Text)) return;

            string name = input.Text.Trim();

            // Double check for duplicates
            bool nameExists = _categories.Any(c => 
                c.Name.Equals(name, StringComparison.OrdinalIgnoreCase) && 
                (_editingItem == null || c.Id != _editingItem.Id));
            if (nameExists) return;

            if (_editingItem == null)
            {
                // Create Mode
                var newCat = new Category
                {
                    Name = name,
                    Color = _selectedColor,
                    IsDefault = false
                };
                await _libraryService.AddCategoryAsync(newCat);
            }
            else
            {
                // Edit Mode
                var updated = new Category
                {
                    Id = _editingItem.Id,
                    Name = name,
                    Color = _selectedColor,
                    IsDefault = _editingItem.IsDefault
                };
                await _libraryService.UpdateCategoryAsync(updated);
                ResetEditMode();
            }

            input.Text = string.Empty;
            await LoadCategoriesAsync();
        }

        private void OnCancelEditClick(object? sender, RoutedEventArgs e)
        {
            ResetEditMode();
        }

        private void ResetEditMode()
        {
            _editingItem = null;
            
            var title = this.FindControl<TextBlock>("PaneTitle");
            if (title != null) title.Text = GetResourceString("String.Category.CreateCategory", "Create Category");

            var button = this.FindControl<Button>("ActionButton");
            if (button != null) button.Content = GetResourceString("String.Add", "Add");

            var cancelBtn = this.FindControl<Button>("CancelEditButton");
            if (cancelBtn != null) cancelBtn.IsVisible = false;

            var input = this.FindControl<TextBox>("CategoryNameInput");
            if (input != null) input.Text = string.Empty;

            // Reset palette selection to first color
            if (_paletteColorBorders.Any())
            {
                SelectColor(PaletteColors[0], _paletteColorBorders[0]);
            }

            ValidateInput();
        }

        private async void OnDefaultClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                // Toggle default
                long targetId = item.IsDefault ? 0 : item.Id; // If clicked active default, turn off
                await _libraryService.SetDefaultCategoryAsync(targetId);
                await LoadCategoriesAsync();
            }
        }

        private async void OnExcludeClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                // Toggle exclude
                item.IsUpdateExcluded = !item.IsUpdateExcluded;
                await _libraryService.SetCategoryExcludeAsync(item.Id, item.IsUpdateExcluded);
            }
        }

        private void OnEditRowClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                _editingItem = item;
                
                var title = this.FindControl<TextBlock>("PaneTitle");
                if (title != null) title.Text = GetResourceString("String.Category.EditCategory", "Edit Category");

                var button = this.FindControl<Button>("ActionButton");
                if (button != null) button.Content = GetResourceString("String.Save", "Save");

                var cancelBtn = this.FindControl<Button>("CancelEditButton");
                if (cancelBtn != null) cancelBtn.IsVisible = true;

                var input = this.FindControl<TextBox>("CategoryNameInput");
                if (input != null)
                {
                    input.Text = item.Name;
                    input.Focus();
                    input.SelectAll();
                }

                // Select current color in palette
                var border = _paletteColorBorders.FirstOrDefault(b => 
                    b.Child is Border inner && 
                    inner.Background is SolidColorBrush sc && 
                    sc.Color.ToString().Equals(Brush.Parse(item.Color).ToString(), StringComparison.OrdinalIgnoreCase));
                if (border != null)
                {
                    SelectColor(item.Color, border);
                }

                ValidateInput();
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

        private async void OnDeleteRowClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                var title = GetResourceString("String.Dialog.DeleteCategoryTitle", "Delete Category");
                var format = GetResourceString("String.Dialog.DeleteCategoryMsg", "Are you sure you want to delete the category \"{0}\"? Mangas in this category will not be deleted.");
                var message = string.Format(format, item.Name);
                
                var dialog = new ConfirmDialog(title, message);

                bool confirmed = await dialog.ShowDialog<bool>(this);
                if (confirmed)
                {
                    if (_editingItem != null && _editingItem.Id == item.Id)
                    {
                        ResetEditMode();
                    }
                    await _libraryService.DeleteCategoryAsync(item.Id);
                    await LoadCategoriesAsync();
                }
            }
        }

        private async void OnUpClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                int index = _categories.IndexOf(item);
                if (index > 0)
                {
                    _categories.Move(index, index - 1);
                    await SaveOrderAsync();
                }
            }
        }

        private async void OnDownClick(object? sender, RoutedEventArgs e)
        {
            if (sender is Button btn && btn.DataContext is CategoryItemViewModel item)
            {
                int index = _categories.IndexOf(item);
                if (index < _categories.Count - 1)
                {
                    _categories.Move(index, index + 1);
                    await SaveOrderAsync();
                }
            }
        }

        private async Task SaveOrderAsync()
        {
            var ids = _categories.Select(x => x.Id).ToList();
            await _libraryService.UpdateCategoryOrderAsync(ids);
        }

        private IBrush GetThemeBrush(string key, IBrush defaultBrush)
        {
            if (Application.Current != null && Application.Current.TryFindResource(key, out var res) && res is IBrush brush)
            {
                return brush;
            }
            return defaultBrush;
        }

        private void OnNameInputPropertyChanged(object? sender, AvaloniaPropertyChangedEventArgs e)
        {
            if (e.Property == TextBox.TextProperty)
            {
                ValidateInput();
            }
        }

        private void OnNameInputKeyDown(object? sender, KeyEventArgs e)
        {
            var actionBtn = this.FindControl<Button>("ActionButton");
            if (e.Key == Key.Enter && actionBtn != null && actionBtn.IsEnabled)
            {
                OnActionClick(sender, new RoutedEventArgs());
                e.Handled = true;
            }
        }

        private void ValidateInput()
        {
            var input = this.FindControl<TextBox>("CategoryNameInput");
            var warning = this.FindControl<TextBlock>("WarningTextBlock");
            var actionBtn = this.FindControl<Button>("ActionButton");
            
            if (input == null || warning == null || actionBtn == null) return;

            string name = input.Text?.Trim() ?? string.Empty;
            if (string.IsNullOrEmpty(name))
            {
                warning.IsVisible = false;
                actionBtn.IsEnabled = false;
                return;
            }

            bool nameExists = _categories.Any(c => 
                c.Name.Equals(name, StringComparison.OrdinalIgnoreCase) && 
                (_editingItem == null || c.Id != _editingItem.Id));

            if (nameExists)
            {
                warning.Text = "A category with this name already exists.";
                warning.IsVisible = true;
                actionBtn.IsEnabled = false;
            }
            else
            {
                warning.IsVisible = false;
                actionBtn.IsEnabled = true;
            }
        }
    }
}
