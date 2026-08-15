using System;

namespace Yomic.Core.Models
{
    public class Announcement
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public string Type { get; set; } = "info"; // "info", "warning", "error"
        public string Url { get; set; } = string.Empty;

        // Visual helper properties
        public bool HasUrl => !string.IsNullOrWhiteSpace(Url);
        public bool IsWarning => string.Equals(Type, "warning", StringComparison.OrdinalIgnoreCase);
        public bool IsError => string.Equals(Type, "error", StringComparison.OrdinalIgnoreCase);
        public bool IsInfo => !IsWarning && !IsError;

        public string BadgeBackground => Type?.ToLowerInvariant() switch
        {
            "warning" => "#F59E0B",
            "error" => "#EF4444",
            _ => "#0078D4"
        };
    }
}
