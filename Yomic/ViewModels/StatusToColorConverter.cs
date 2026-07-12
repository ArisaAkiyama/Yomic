using System;
using System.Globalization;
using System.Linq;
using Avalonia.Data.Converters;
using Avalonia.Media;

namespace Yomic.ViewModels
{
    public class StatusToColorConverter : IValueConverter
    {
        public static readonly StatusToColorConverter Instance = new();
        
        public static readonly IValueConverter StatusToVisibility = 
            new FuncValueConverter<int, bool>(s => s != 0);
            
        public static readonly IValueConverter ToUpperConverter =
            new FuncValueConverter<string, string>(s => s?.ToUpperInvariant() ?? string.Empty);
        
        // Static instances for specific conversions
        public static readonly IValueConverter BoolToHeartIcon = 
            new FuncValueConverter<bool, string>(b => b ? "\uEB52" : "\uEB51"); // Filled : Outline
            
        public static readonly IValueConverter BoolToHeartColor = 
            new FuncValueConverter<bool, IBrush>(b => b ? Brushes.Red : Brushes.White);
            
        public static readonly IValueConverter BoolToLibraryText = 
            new FuncValueConverter<bool, string>(b => b ? "In Library" : "Add to Library");
            
        public static readonly IValueConverter BoolToOpacity = 
            new FuncValueConverter<bool, double>(b => b ? 0.5 : 1.0); // Read = 0.5, Unread = 1.0
            
        public static readonly IValueConverter SortToString = 
            new FuncValueConverter<bool, string>(b => b ? "Oldest First" : "Newest First");
            
        // Unread indicator: IsRead=true -> Opacity 0 (hide), IsRead=false -> Opacity 1 (show)
        public static readonly IValueConverter UnreadToOpacity = 
            new FuncValueConverter<bool, double>(isRead => isRead ? 0.0 : 1.0);
        
        // Language filter: Selected=1.0, Unselected=0.35
        public static readonly IValueConverter BoolToFullOpacity = 
            new FuncValueConverter<bool, double>(b => b ? 1.0 : 0.35);
            
        public static readonly IValueConverter FeedbackCategoryToString = 
            new FuncValueConverter<object, string>(cat => 
            {
                if (cat == null) return string.Empty;
                var str = cat.ToString();
                return str switch
                {
                    "BugReport" => "Bug Report",
                    "FeatureRequest" => "Feature Request",
                    "General" => "General",
                    "Question" => "Question",
                    _ => str
                };
            });

        public static readonly IMultiValueConverter BoolToExpandText = 
            new FuncMultiValueConverter<object, string>(values => 
            {
                if (values != null && values.Count() > 0 && values.First() is bool isExpanded)
                    return isExpanded ? "\uE70E" : "\uE70D"; // ChevronUp : ChevronDown
                return "\uE70D";
            });

        public static readonly IMultiValueConverter StringEqualityConverter = 
            new FuncMultiValueConverter<object?, bool>(values => 
            {
                if (values != null && values.Count() >= 2)
                {
                    var val1 = values.ElementAtOrDefault(0)?.ToString();
                    var val2 = values.ElementAtOrDefault(1)?.ToString();
                    return string.Equals(val1, val2, StringComparison.OrdinalIgnoreCase);
                }
                return false;
            });

        // Genre Styling Categories
        private static readonly string[] RedGenres = { "Ecchi", "Hentai", "Gore", "Graphic Violence", "Disturbing" };
        private static readonly string[] YellowGenres = { "Mature", "Adult", "Smut", "Harem", "Psychological", "Sexual Content", "Horror", "Seinen", "Josei" };

        public static readonly IValueConverter GenreToBackground =
            new FuncValueConverter<string, IBrush>(g => 
            {
                if (string.IsNullOrEmpty(g)) return new SolidColorBrush(Color.Parse("#20FFFFFF"));
                
                if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                    return new SolidColorBrush(Color.Parse("#D93025")); // Red
                
                if (YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                    return new SolidColorBrush(Color.Parse("#FFB800")); // Yellow/Amber
                
                return new SolidColorBrush(Color.Parse("#20FFFFFF")); // Default
            });

        public static readonly IValueConverter GenreToBorder =
            new FuncValueConverter<string, IBrush>(g => 
            {
                if (string.IsNullOrEmpty(g)) return new SolidColorBrush(Color.Parse("#30FFFFFF"));
                
                if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                    return new SolidColorBrush(Color.Parse("#D93025"));
                    
                if (YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                    return new SolidColorBrush(Color.Parse("#FFB800"));
                    
                return new SolidColorBrush(Color.Parse("#30FFFFFF"));
            });

        public static readonly IValueConverter GenreToForeground =
            new FuncValueConverter<string, IBrush>(g => 
            {
                if (string.IsNullOrEmpty(g)) return new SolidColorBrush(Color.Parse("#EEF"));
                
                // Use White text for both categories for high contrast in dark theme
                if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)) ||
                    YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                    return Brushes.White;
                
                return new SolidColorBrush(Color.Parse("#EEF"));
            });

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is string status)
            {
                if (status.StartsWith("Ongoing", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#E53935"));    // Red
                if (status.StartsWith("Completed", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#0078D7"));  // Blue
                if (status.StartsWith("Hiatus", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#0066B8"));     // Darker Blue
                if (status.StartsWith("Cancelled", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#EF4444"));  // Red
                
                return new SolidColorBrush(Color.Parse("#6B7280"));              // Gray for Unknown
            }
            return new SolidColorBrush(Color.Parse("#6B7280"));
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
