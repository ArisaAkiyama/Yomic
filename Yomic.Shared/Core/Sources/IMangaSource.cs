using System.Collections.Generic;
using System.Threading.Tasks;
using Yomic.Core.Models;

namespace Yomic.Core.Sources
{
    public interface IMangaSource
    {
        long Id { get; }
        string Name { get; }
        string BaseUrl { get; }
        string Language { get; } // e.g. "EN", "ID"
        bool IsHasMorePages { get; } // For pagination check
        bool IsNsfw => false; // Default interface method so it doesn't break existing extensions
        int RateLimitDelayMs => 1000; // Jeda waktu per request (ms) untuk menghindari ban IP

        
        // Metadata
        string Version { get; }
        string IconUrl { get; }
        string Description { get; }
        string Author { get; }
        string IconBackground { get; } // Hex Color
        string IconForeground { get; } // Hex Color

        // Fetching
        Task<List<Manga>> GetPopularMangaAsync(int page);
        Task<List<Manga>> GetSearchMangaAsync(string query, int page);
        
        // Contextual Details
        Task<Manga> GetMangaDetailsAsync(string url);
        Task<List<Chapter>> GetChapterListAsync(string mangaUrl);
        Task<List<string>> GetPageListAsync(string chapterUrl);
    }
}
