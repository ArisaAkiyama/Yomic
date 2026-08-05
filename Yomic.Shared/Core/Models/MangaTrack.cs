using System;

namespace Yomic.Core.Models
{
    public class MangaTrack
    {
        public long Id { get; set; }                  // Primary Key
        public long MangaId { get; set; }             // Foreign Key to local Manga
        public string TrackerName { get; set; } = "MyAnimeList";
        
        public long RemoteId { get; set; }            // Manga ID on MAL
        public string Title { get; set; } = "";       // Title on MAL
        
        public int LastChapterRead { get; set; }      // Last chapter read synced
        public int TotalChapters { get; set; }        // Total chapters from MAL
        
        public string Status { get; set; } = "reading"; // reading, completed, on_hold, dropped, plan_to_read
        public int Score { get; set; }                // User score (0-10)
        
        // Navigation properties
        public virtual Manga? Manga { get; set; }
    }
}
