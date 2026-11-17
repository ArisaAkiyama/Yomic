using System.Collections.Generic;

namespace Yomic.Core.Models
{
    public class Category
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Color { get; set; } = "#FFFFFF"; // Hex color representation
        public int SortOrder { get; set; }
        public bool IsDefault { get; set; }
        public bool UpdateExcluded { get; set; }

        // Relationships
        public virtual ICollection<Manga> Mangas { get; set; } = new List<Manga>();
    }
}
