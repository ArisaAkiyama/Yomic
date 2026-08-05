namespace Yomic.Core.Models
{
    public class MangaTracker
    {
        public long Id { get; set; }
        
        public long MangaId { get; set; } // Local Manga ID
        public virtual Manga? Manga { get; set; } // EF Core relationship

        public string TrackerType { get; set; } = "MAL"; // Failsafe for AniList, etc.
        public string RemoteId { get; set; } = string.Empty; // MAL Manga ID resolved from MangaDex
        public string Title { get; set; } = string.Empty; // MAL Manga Title resolved from MangaDex
        public int LastChapterRead { get; set; }
        public int TotalChapters { get; set; }
        public string SyncStatus { get; set; } = "reading"; // reading, completed, plan_to_read
        public int Score { get; set; } // Personal rating 1-10
    }
}
