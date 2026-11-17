using System;

namespace Yomic.Core.Models
{
    public class Chapter
    {
        public long Id { get; set; }
        public long MangaId { get; set; }
        
        public string Url { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public float ChapterNumber { get; set; }
        
        public long DateUpload { get; set; } // Epoch
        public long DateFetch { get; set; }
        
        public bool Read { get; set; }
        public bool Bookmark { get; set; }
        public long LastPageRead { get; set; }
        public bool IsDownloaded { get; set; }
        public bool IsNew { get; set; } // New Release Badge
        
        public string? Scanlator { get; set; }
        
        // Navigation (Foreign Key)
        public virtual Manga Manga { get; set; } = null!;
    }
}
