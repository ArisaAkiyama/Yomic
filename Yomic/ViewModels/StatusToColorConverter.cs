using System;
using System.Globalization;
using System.Linq;
using Avalonia.Data.Converters;
using Avalonia.Media;
using Avalonia.Controls;

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
        private static string GetResourceString(string key, string defaultValue)
        {
            if (Avalonia.Application.Current != null && Avalonia.Application.Current.TryFindResource(key, out var res))
            {
                if (res is string str)
                {
                    return str;
                }
            }
            return defaultValue;
        }

        public static readonly IValueConverter BoolToHeartIcon = 
            new FuncValueConverter<bool, string>(b => b ? "M6.979 3.074a6 6 0 0 1 4.988 1.425l.037 .033l.034 -.03a6 6 0 0 1 4.733 -1.44l.246 .036a6 6 0 0 1 3.364 10.008l-.18 .185l-.048 .041l-7.45 7.379a1 1 0 0 1 -1.313 .082l-.094 -.082l-7.493 -7.422a6 6 0 0 1 3.176 -10.215z" : "M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572"); // Filled : Outline
            
        public static readonly IValueConverter BoolToHeartColor = 
            new FuncValueConverter<bool, IBrush>(b => b ? Brushes.Red : Brushes.White);
            
        public static readonly IValueConverter BoolToLibraryText = 
            new FuncValueConverter<bool, string>(b => b ? GetResourceString("String.InLibrary", "In Library") : GetResourceString("String.AddToLibrary", "Add to Library"));
            
        public static readonly IValueConverter BoolToOpacity = 
            new FuncValueConverter<bool, double>(b => b ? 0.5 : 1.0); // Read = 0.5, Unread = 1.0
            
        public static readonly IValueConverter SortToString = 
            new FuncValueConverter<bool, string>(b => b ? GetResourceString("String.Sort.OldestFirst", "Oldest First") : GetResourceString("String.Sort.NewestFirst", "Newest First"));
            
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
                    "BugReport" => GetResourceString("String.Feedback.Category.BugReport", "Bug Report"),
                    "FeatureRequest" => GetResourceString("String.Feedback.Category.FeatureRequest", "Feature Request"),
                    "General" => GetResourceString("String.General", "General"),
                    "Question" => GetResourceString("String.Feedback.Category.Question", "Question"),
                    _ => str ?? string.Empty
                };
            });

        public static readonly IMultiValueConverter BoolToExpandText = 
            new FuncMultiValueConverter<object, string>(values => 
            {
                if (values != null && values.Count() > 0 && values.First() is bool isExpanded)
                    return isExpanded ? "M6 15l6 -6l6 6" : "M6 9l6 6l6 -6"; // ChevronUp : ChevronDown
                return "M6 9l6 6l6 -6";
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
                if (!string.IsNullOrEmpty(g))
                {
                    if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return new SolidColorBrush(Color.Parse("#D93025")); // Red
                    
                    if (YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return new SolidColorBrush(Color.Parse("#FFB800")); // Yellow/Amber
                }
                
                return new SolidColorBrush(Color.Parse("#18FFFFFF")); // Frosted Glass White
            });

        public static readonly IValueConverter GenreToBorder =
            new FuncValueConverter<string, IBrush>(g => 
            {
                if (!string.IsNullOrEmpty(g))
                {
                    if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return new SolidColorBrush(Color.Parse("#D93025"));
                        
                    if (YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return new SolidColorBrush(Color.Parse("#FFB800"));
                }
                    
                return new SolidColorBrush(Color.Parse("#45FFFFFF")); // Glossy White Rim Border
            });

        public static readonly IValueConverter GenreToForeground =
            new FuncValueConverter<string, IBrush>(g => 
            {
                if (!string.IsNullOrEmpty(g))
                {
                    // Red background -> White text
                    if (RedGenres.Any(rg => rg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return Brushes.White;
                    
                    // Yellow background -> Black text
                    if (YellowGenres.Any(yg => yg.Equals(g, StringComparison.OrdinalIgnoreCase)))
                        return new SolidColorBrush(Color.Parse("#1F1F1F"));
                }
                
                // Default background -> White text matching white glass border & back button
                return Brushes.White;
            });

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is int statusInt)
            {
                return statusInt switch
                {
                    1 => new SolidColorBrush(Color.Parse("#E53935")),    // Red
                    2 => new SolidColorBrush(Color.Parse("#0078D7")),  // Blue
                    5 => new SolidColorBrush(Color.Parse("#0066B8")),     // Darker Blue
                    6 => new SolidColorBrush(Color.Parse("#EF4444")),  // Red
                    _ => new SolidColorBrush(Color.Parse("#6B7280"))
                };
            }

            if (value is string status)
            {
                if (status.StartsWith("Ongoing", StringComparison.OrdinalIgnoreCase) || 
                    status.StartsWith("Berjalan", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#E53935"));    // Red
                
                if (status.StartsWith("Completed", StringComparison.OrdinalIgnoreCase) || 
                    status.StartsWith("Selesai", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#0078D7"));  // Blue
                
                if (status.StartsWith("Hiatus", StringComparison.OrdinalIgnoreCase) || 
                    status.StartsWith("Jeda", StringComparison.OrdinalIgnoreCase))
                    return new SolidColorBrush(Color.Parse("#0066B8"));     // Darker Blue
                
                if (status.StartsWith("Cancelled", StringComparison.OrdinalIgnoreCase) || 
                    status.StartsWith("Dibatalkan", StringComparison.OrdinalIgnoreCase))
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
