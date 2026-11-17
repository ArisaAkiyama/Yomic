using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Yomic.Core.Data;
using Yomic.Core.Sources;

namespace Yomic.Core.Services
{
    /// <summary>
    /// One-time migration service to fix Manga.Source IDs after transitioning
    /// from non-deterministic string.GetHashCode() to deterministic SHA256-based IDs.
    /// </summary>
    public static class SourceIdMigrationService
    {
        private static readonly string MigrationFlagFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Yomic", "source_id_migration_v1.done");

        public static async Task RunIfNeededAsync(SourceManager sourceManager)
        {
            try
            {
                var sources = sourceManager.GetSources();
                if (sources.Count == 0)
                {
                    LogService.Info("SourceIdMigration", "No sources loaded yet, skipping migration for now.");
                    return;
                }

                var validSourceIds = new HashSet<long>(sources.Select(s => s.Id));

                using var db = new MangaDbContext();
                var allManga = await db.Mangas.ToListAsync();

                var orphanedManga = allManga.Where(m => !validSourceIds.Contains(m.Source)).ToList();

                if (orphanedManga.Count == 0)
                {
                    LogService.Info("SourceIdMigration", "All manga have valid Source IDs. Marking migration as done.");
                    MarkMigrationDone();
                    return;
                }

                LogService.Info("SourceIdMigration", $"Found {orphanedManga.Count} manga with outdated Source IDs. Remapping...");

                var domainMap = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
                foreach (var src in sources)
                {
                    if (!string.IsNullOrEmpty(src.BaseUrl) && Uri.TryCreate(src.BaseUrl, UriKind.Absolute, out var baseUri))
                    {
                        var host = NormalizeDomain(baseUri.Host);
                        domainMap[host] = src.Id;
                    }
                }

                var keywordFallbacks = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    { "komikcast", "komikcast" },
                    { "komiku", "komiku" },
                    { "kiryuu", "kiryuu" },
                    { "shinigami", "shinigami" },
                    { "maid", "maid" },
                    { "bacakomik", "bacakomik" },
                    { "westmanga", "westmanga" },
                    { "mgkomik", "mgkomik" },
                    { "mangadex", "mangadex" },
                    { "mangabat", "mangabat" },
                    { "manganato", "mangabat" },
                    { "mangakakalot", "mangabat" },
                    { "nhentai", "nhentai" },
                    { "weebcentral", "weebcentral" },
                    { "manhwaindo", "manhwaindo" },
                    { "softkomik", "softkomik" },
                };

                int fixedCount = 0;
                foreach (var manga in orphanedManga)
                {
                    long? matchedSourceId = null;

                    // 1. Direct legacy v1 ID mapping
                    if (manga.Source == 3639673976007021568L)
                    {
                        var kiryuuSrc = sources.FirstOrDefault(s => s.Name.Contains("Kiryuu", StringComparison.OrdinalIgnoreCase));
                        if (kiryuuSrc != null) matchedSourceId = kiryuuSrc.Id;
                    }
                    else if (manga.Source == -3406828676302900168L)
                    {
                        var komikuSrc = sources.FirstOrDefault(s => s.Name.Contains("Komiku", StringComparison.OrdinalIgnoreCase));
                        if (komikuSrc != null) matchedSourceId = komikuSrc.Id;
                    }

                    // 2. Domain matching
                    if (matchedSourceId == null && !string.IsNullOrEmpty(manga.Url) && Uri.TryCreate(manga.Url, UriKind.Absolute, out var mangaUri))
                    {
                        var mangaHost = NormalizeDomain(mangaUri.Host);
                        if (domainMap.TryGetValue(mangaHost, out var idByDomain))
                        {
                            matchedSourceId = idByDomain;
                        }
                    }

                    // 3. Keyword / URL pattern matching
                    if (matchedSourceId == null && !string.IsNullOrEmpty(manga.Url))
                    {
                        foreach (var kv in keywordFallbacks)
                        {
                            if (manga.Url.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                            {
                                var matchingSrc = sources.FirstOrDefault(s =>
                                    s.Name.Contains(kv.Value, StringComparison.OrdinalIgnoreCase) ||
                                    s.BaseUrl.Contains(kv.Value, StringComparison.OrdinalIgnoreCase));

                                if (matchingSrc != null)
                                {
                                    matchedSourceId = matchingSrc.Id;
                                    break;
                                }
                            }
                        }

                        if (matchedSourceId == null)
                        {
                            if (manga.Url.Contains("/manga/", StringComparison.OrdinalIgnoreCase))
                            {
                                var fallbackKiryuu = sources.FirstOrDefault(s => s.Name.Contains("Kiryuu", StringComparison.OrdinalIgnoreCase));
                                if (fallbackKiryuu != null) matchedSourceId = fallbackKiryuu.Id;
                            }
                        }
                    }

                    if (matchedSourceId.HasValue)
                    {
                        long oldId = manga.Source;
                        manga.Source = matchedSourceId.Value;
                        fixedCount++;
                        LogService.Info("SourceIdMigration", $"Remapped '{manga.Title}': {oldId} -> {matchedSourceId.Value}");
                    }
                    else
                    {
                        LogService.Warning("SourceIdMigration", $"Could not remap '{manga.Title}' (URL: {manga.Url}, OldSource: {manga.Source})");
                    }
                }

                if (fixedCount > 0)
                {
                    await db.SaveChangesAsync();
                    LogService.Success("SourceIdMigration", $"Successfully migrated {fixedCount}/{orphanedManga.Count} manga Source IDs.");
                }

                if (fixedCount == orphanedManga.Count)
                {
                    MarkMigrationDone();
                }
            }
            catch (Exception ex)
            {
                LogService.Error("SourceIdMigration", "Error during Source ID migration", ex);
            }
        }

        private static string NormalizeDomain(string host)
        {
            if (host.StartsWith("www.", StringComparison.OrdinalIgnoreCase))
                host = host.Substring(4);
            return host.ToLowerInvariant();
        }

        private static void MarkMigrationDone()
        {
            try
            {
                var dir = Path.GetDirectoryName(MigrationFlagFile);
                if (!string.IsNullOrEmpty(dir))
                    Directory.CreateDirectory(dir);
                File.WriteAllText(MigrationFlagFile, DateTime.UtcNow.ToString("O"));
            }
            catch { }
        }
    }
}
