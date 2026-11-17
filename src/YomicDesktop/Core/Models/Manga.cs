using System;
using System.Collections.Generic;

namespace Yomic.Core.Models
{
    public class Manga
    {
        public long Id { get; set; }
        public long Source { get; set; }
        public string Url { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        
        public string? Artist { get; set; }
        public string? Author { get; set; }
        public string? Description { get; set; }
        public List<string>? Genre { get; set; }
        public int Status { get; set; }
        public string? ThumbnailUrl { get; set; }
        
        public bool Favorite { get; set; }
        public long LastUpdate { get; set; } // Epoch
        public long LastViewed { get; set; } // Epoch
        public long NextUpdate { get; set; } // Epoch
        public bool Initialized { get; set; }

        // Viewer & Filter flags (Bitmask)
        public long ViewerFlags { get; set; }
        public long ChapterFlags { get; set; }
        public long CoverLastModified { get; set; }
        public long DateAdded { get; set; }

        // HTTP Caching Headers
        public string? ResponseETag { get; set; }
        public string? ResponseLastModified { get; set; }

        // Relationships
        public virtual ICollection<Chapter> Chapters { get; set; } = new List<Chapter>();
        public virtual ICollection<History> History { get; set; } = new List<History>();
        public virtual ICollection<Category> Categories { get; set; } = new List<Category>();
        public virtual ICollection<MangaTrack> Tracks { get; set; } = new List<MangaTrack>();

        // Constants (from Mihon)
        public const int UNKNOWN = 0;
        public const int ONGOING = 1;
        public const int COMPLETED = 2;
        public const int LICENSED = 3;
        public const int PUBLISHING_FINISHED = 4;
        public const int CANCELLED = 5;
        public const int ON_HIATUS = 6;

        // Flags
        public const long MASK_HAS_NEW_CHAPTERS = 1L << 60;

        [System.ComponentModel.DataAnnotations.Schema.NotMapped]
        public bool HasNewChapters
        {
            get => (ViewerFlags & MASK_HAS_NEW_CHAPTERS) != 0;
            set
            {
                if (value)
                    ViewerFlags |= MASK_HAS_NEW_CHAPTERS;
                else
                    ViewerFlags &= ~MASK_HAS_NEW_CHAPTERS;
            }
        }
    }
}
