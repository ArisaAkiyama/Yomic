using System.Collections.Generic;
using System.Threading.Tasks;
using Yomic.Core.Models;

namespace Yomic.Core.Sources
{
    public interface IFilterableMangaSource
    {
        bool SupportsStatusFilter => false;
        bool SupportsGenreFilter => false;
        List<string> AvailableGenres => new List<string>();

        /// <summary>
        /// Get latest updated manga (paginated).
        /// </summary>
        Task<(List<Manga> Items, int TotalPages)> GetLatestMangaAsync(int page);

        /// <summary>
        /// Get full directory of manga (paginated).
        /// </summary>
        Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page);

        // Server-side filtering support with backwards compatibility
        Task<(List<Manga> Items, int TotalPages)> GetLatestMangaAsync(int page, int status) => GetLatestMangaAsync(page);
        Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status) => GetMangaListAsync(page);
        Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status, List<string>? genres) => GetMangaListAsync(page, status);
        
        bool SupportsFormatFilter => false;
        List<string> AvailableFormats => new List<string>();
        Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status, List<string>? genres, List<string>? formats) => GetMangaListAsync(page, status, genres);
    }
}
