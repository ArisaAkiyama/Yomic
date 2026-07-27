using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Yomic.Core.Data;
using Yomic.Core.Models;
using System.Linq;

namespace Yomic.Core.Services
{
    public class LibraryService
    {
        // Event triggered when new chapters are found
        public event EventHandler<int>? UpdatesFound;

        public async Task<List<Manga>> GetLibraryMangaAsync()
        {
            using var context = new MangaDbContext();
            return await context.Mangas
                                .Include(m => m.Chapters)
                                .Include(m => m.Categories)
                                .Where(m => m.Favorite)
                                .OrderBy(m => m.Title)
                                .ToListAsync();
        }

        public async Task<List<Manga>> GetHistoryMangaAsync()
        {
            using var context = new MangaDbContext();
            // Fetch non-favorite items that have been read/viewed
            return await context.Mangas
                                .Include(m => m.Chapters)
                                .Where(m => !m.Favorite && m.LastViewed > 0)
                                .OrderByDescending(m => m.LastViewed)
                                .ToListAsync();
        }

        public async Task<int> GetLibraryCountAsync()
        {
            using var context = new MangaDbContext();
            return await context.Mangas.CountAsync(m => m.Favorite);
        }

        public async Task<Manga?> GetMangaAsync(long id)
        {
            using var context = new MangaDbContext();
            return await context.Mangas
                .Include(m => m.Chapters)
                .FirstOrDefaultAsync(m => m.Id == id);
        }

        public async Task<Manga?> GetMangaByUrlAsync(string url, long sourceId)
        {
            using var context = new MangaDbContext();
            return await context.Mangas
                .Include(m => m.Chapters)
                .FirstOrDefaultAsync(m => m.Url == url && m.Source == sourceId);
        }

        public async Task AddToLibraryAsync(Manga manga, int chapterCount = 0)
        {
            try
            {
                // Sanitize Title (Remove "Komik " or "Manga " prefix if present)
                if (!string.IsNullOrEmpty(manga.Title))
                {
                    string originalTitle = manga.Title;
                    if (originalTitle.StartsWith("Komik ", StringComparison.OrdinalIgnoreCase))
                        manga.Title = originalTitle.Substring(6).Trim();
                    else if (originalTitle.StartsWith("Manga ", StringComparison.OrdinalIgnoreCase))
                        manga.Title = originalTitle.Substring(6).Trim();
                }

                LogService.Info("Library", $"Saving to database: {manga.Title}");

                using var context = new MangaDbContext();
                
                // Check if exists
                var existing = await context.Mangas.Include(m => m.Categories).FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
                if (existing != null)
                {
                    existing.Favorite = true;
                    // Update other fields
                    existing.Title = manga.Title;
                    existing.ThumbnailUrl = manga.ThumbnailUrl;
                    existing.Author = manga.Author;
                    existing.Artist = manga.Artist;
                    existing.Genre = manga.Genre;
                    existing.Status = manga.Status;
                    existing.Description = manga.Description;
                    existing.Initialized = true;
                    
                    // Assign default category if it has no categories yet
                    if (existing.Categories.Count == 0)
                    {
                        var defaultCat = await context.Categories.FirstOrDefaultAsync(c => c.IsDefault);
                        if (defaultCat != null)
                        {
                            existing.Categories.Add(defaultCat);
                        }
                    }

                    context.Update(existing);
                    LogService.Info("Library", $"Updated existing manga: {manga.Title}");
                }
                else
                {
                    manga.Favorite = true;
                    manga.DateAdded = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    
                    // Assign default category
                    var defaultCat = await context.Categories.FirstOrDefaultAsync(c => c.IsDefault);
                    if (defaultCat != null)
                    {
                        manga.Categories.Add(defaultCat);
                    }

                    await context.Mangas.AddAsync(manga);
                    LogService.Success("Library", $"Added new manga: {manga.Title}");
                }
                
                await context.SaveChangesAsync();
                LogService.Debug("Library", "Saved changes to DB.");
            }
            catch (Exception ex)
            {
                LogService.Error("Library", "Error adding to library", ex);
            }
        }

        public async Task UpdateHistoryAsync(Manga manga)
        {
            try
            {
                using var context = new MangaDbContext();
                
                // Check if exists
                var existing = await context.Mangas.FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
                
                if (existing != null)
                {
                    existing.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    // Update details — always update ThumbnailUrl if a new valid one is provided
                    if (!string.IsNullOrEmpty(manga.ThumbnailUrl) && existing.ThumbnailUrl != manga.ThumbnailUrl) 
                    {
                        LogService.Debug("LibraryService", $"Updating cover for {manga.Title}");
                        existing.ThumbnailUrl = manga.ThumbnailUrl;
                    }
                    if (!string.IsNullOrEmpty(manga.Title) && manga.Title != "Unknown") 
                    {
                        existing.Title = manga.Title;
                    }
                    
                    context.Update(existing);
                }
                else
                {
                    // Add new non-favorite entry
                    manga.Favorite = false;
                    manga.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    manga.DateAdded = 0; // Not added to library
                    manga.Initialized = false; // Details might be partial
                    
                    await context.Mangas.AddAsync(manga);
                }
                
                await context.SaveChangesAsync();
                LogService.Info("Library", $"History updated for: {manga.Title}");
            }
            catch (Exception ex)
            {
                LogService.Error("Library", "Error updating history", ex);
            }
        }

        public async Task MarkMangaAsSeenAsync(long mangaId)
        {
            using var context = new MangaDbContext();
            var manga = await context.Mangas.FindAsync(mangaId);
            if (manga != null && manga.HasNewChapters)
            {
                manga.HasNewChapters = false;
                await context.SaveChangesAsync();
            }
        }
        public async Task MarkMangaAsSeenAsync(string url, long sourceId)
        {
            var manga = await GetMangaByUrlAsync(url, sourceId);
            if (manga != null)
            {
                await MarkMangaAsSeenAsync(manga.Id);
            }
        }
        public async Task RemoveFromLibraryAsync(Manga manga, bool deleteFiles = false)
        {
             try
             {
                 using var context = new MangaDbContext();
                 Manga? existing = null;

                 // Prioritize ID lookup if available
                 if (manga.Id > 0)
                 {
                     existing = await context.Mangas.FindAsync(manga.Id);
                 }
                 
                 // Fallback to URL lookup if ID not found or invalid
                 if (existing == null)
                 {
                     existing = await context.Mangas.FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
                 }

                 if (existing != null)
                 {
                     existing.Favorite = false;
                     context.Update(existing);
                     await context.SaveChangesAsync();
                     
                     LogService.Info("Library", $"Removed from library (Unfavorited): {existing.Title}");
                     
                     if (deleteFiles)
                     {
                         await DeleteMangaFilesInternalAsync(context, existing);
                         await context.SaveChangesAsync();
                     }
                 }
             }
             catch (Exception ex)
             {
                 LogService.Error("LibraryService", $"Error removing manga from library: {ex.Message}", ex);
             }
        }

        public async Task DeleteMangaDownloadsAsync(Manga manga)
        {
             using var context = new MangaDbContext();
             Manga? existing = null;
             if (manga.Id > 0)
             {
                 existing = await context.Mangas.FindAsync(manga.Id);
             }
             if (existing == null)
             {
                 existing = await context.Mangas.FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
             }

             if (existing != null)
             {
                 await DeleteMangaFilesInternalAsync(context, existing);
                 await context.SaveChangesAsync();
             }
        }

        private async Task DeleteMangaFilesInternalAsync(MangaDbContext context, Manga existing)
        {
             try 
             {
                var mangaDir = DownloadPathService.GetMangaDirectory(existing);

                if (System.IO.Directory.Exists(mangaDir))
                {
                    System.IO.Directory.Delete(mangaDir, true);
                    LogService.Success("Library", $"Deleted files for: {existing.Title}");
                }

                // Mark all chapters as not downloaded in the DB
                var dbChapters = await context.Chapters.Where(c => c.MangaId == existing.Id && c.IsDownloaded).ToListAsync();

                // Fallback for "Unknown" title bug
                var fallbackDir = System.IO.Path.Combine(DownloadPathService.GetSourceDirectory(existing.Source), "Unknown");
                if (System.IO.Directory.Exists(fallbackDir))
                {
                    foreach (var c in dbChapters)
                    {
                        var safeChap = DownloadPathService.SanitizePathSegment(c.Name);
                        var hashedChap = DownloadPathService.GetChapterDirectoryName(c.Name, c.Url);
                        foreach (var chapDir in new[]
                        {
                            System.IO.Path.Combine(fallbackDir, hashedChap),
                            System.IO.Path.Combine(fallbackDir, hashedChap + DownloadPathService.TempSuffix),
                            System.IO.Path.Combine(fallbackDir, safeChap),
                            System.IO.Path.Combine(fallbackDir, safeChap + DownloadPathService.TempSuffix)
                        })
                        {
                            if (System.IO.Directory.Exists(chapDir)) System.IO.Directory.Delete(chapDir, true);
                        }
                    }
                    // Clean up Unknown folder if empty
                    try { if (!System.IO.Directory.EnumerateFileSystemEntries(fallbackDir).Any()) System.IO.Directory.Delete(fallbackDir, false); } catch { }
                }

                foreach (var c in dbChapters)
                {
                    c.IsDownloaded = false;
                }
                context.Chapters.UpdateRange(dbChapters);
             }
             catch (Exception ex)
             {
                 LogService.Warning("Library", $"Error deleting files: {ex.Message}");
             }
        }

        public async Task DeleteChapterDownloadAsync(Manga manga, Chapter chapter)
        {
            try
            {
                // 1. Update DB First (to prevent "Ghost" downloaded status if file delete succeeds but DB fails)
                using var context = new MangaDbContext();
                var dbManga = await context.Mangas.FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
                if (dbManga != null)
                {
                    var dbChapter = await context.Chapters.FirstOrDefaultAsync(c => c.MangaId == dbManga.Id && c.Url == chapter.Url);
                    if (dbChapter != null)
                    {
                        dbChapter.IsDownloaded = false;
                        context.Update(dbChapter);
                        await context.SaveChangesAsync();
                    }
                }

                // 2. Delete files
                var deleted = false;
                var safeMangaTitle = DownloadPathService.SanitizePathSegment(manga.Title ?? "Unknown");
                var safeChapterName = DownloadPathService.SanitizePathSegment(chapter.Name);
                var hashedChapterName = DownloadPathService.GetChapterDirectoryName(chapter.Name, chapter.Url);
                var sourceDir = DownloadPathService.GetSourceDirectory(manga.Source);
                var mangaDirs = new[]
                {
                    DownloadPathService.GetMangaDirectory(manga),
                    System.IO.Path.Combine(sourceDir, safeMangaTitle),
                    System.IO.Path.Combine(sourceDir, "Unknown")
                };

                foreach (var mangaDir in mangaDirs.Distinct())
                {
                    foreach (var chapterDir in new[]
                    {
                        System.IO.Path.Combine(mangaDir, hashedChapterName),
                        System.IO.Path.Combine(mangaDir, hashedChapterName + DownloadPathService.TempSuffix),
                        System.IO.Path.Combine(mangaDir, safeChapterName),
                        System.IO.Path.Combine(mangaDir, safeChapterName + DownloadPathService.TempSuffix)
                    })
                    {
                        if (System.IO.Directory.Exists(chapterDir))
                        {
                            System.IO.Directory.Delete(chapterDir, true);
                            deleted = true;
                        }
                    }
                }

                if (deleted)
                {
                    LogService.Success("Library", $"Deleted chapter download: {chapter.Name}");
                }
            }
            catch (Exception ex)
            {
                LogService.Error("Library", "Error deleting chapter download", ex);
            }
        }

        // Global lock for Database writes to prevent SQLite "database is locked" errors during parallel updates
        private static readonly System.Threading.SemaphoreSlim _dbLock = new(1, 1);
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<long, System.Threading.SemaphoreSlim> _sourceSemaphores = new();

        public async Task<int> UpdateChaptersAsync(Manga manga, List<Chapter> chapters, bool isInitialLoad = false, bool skipPrune = false)
        {
            try
            {
                using var context = new MangaDbContext();
                var dbManga = await context.Mangas
                    .Include(m => m.Chapters)
                    .FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
                
                if (dbManga != null)
                {
                    long now = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    int newCount = SyncChaptersInternal(context, dbManga, chapters, isInitialLoad, skipPrune, now);
                    UpdateMangaUpdateSchedule(dbManga, now);
                    await context.SaveChangesAsync();
                    return newCount;
                }
                return 0;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error updating chapters: {ex}");
                return 0;
            }
        }

        private int SyncChaptersInternal(MangaDbContext context, Manga dbManga, List<Chapter> chapters, bool isInitialLoad, bool skipPrune, long now)
        {
            // FIX: Duplicate URL Crash (ArgumentException)
            var allDbChapters = dbManga.Chapters.ToList();
            var dbChaptersDict = new Dictionary<string, Chapter>();
            var duplicatesToRemove = new List<Chapter>();

            foreach (var group in allDbChapters.GroupBy(c => c.Url))
            {
                var list = group.OrderByDescending(c => c.IsDownloaded).ThenByDescending(c => c.Id).ToList();
                dbChaptersDict[group.Key] = list[0];
                
                if (list.Count > 1)
                {
                    duplicatesToRemove.AddRange(list.Skip(1));
                }
            }

            if (duplicatesToRemove.Any())
            {
                LogService.Debug("LibraryService", $"Cleaning up {duplicatesToRemove.Count} duplicate chapters for {dbManga.Title}");
                context.Chapters.RemoveRange(duplicatesToRemove);
                foreach (var dup in duplicatesToRemove)
                {
                    dbManga.Chapters.Remove(dup);
                }
            }

            var newChapters = new List<Chapter>();
            bool isEmptyLibrary = dbManga.Chapters.Count == 0;
            var sourceUrls = new HashSet<string>();
            var uniqueIncoming = chapters.GroupBy(c => c.Url).Select(g => g.First()).ToList();

            float maxExistingNum = 0;
            long maxExistingDate = 0;
            if (!isInitialLoad && !isEmptyLibrary && dbManga.Chapters.Any())
            {
                maxExistingNum = dbManga.Chapters.Max(c => c.ChapterNumber);
                maxExistingDate = dbManga.Chapters.Max(c => c.DateUpload);
            }

            foreach (var ch in uniqueIncoming)
            {
                sourceUrls.Add(ch.Url);
                
                if (dbChaptersDict.TryGetValue(ch.Url, out var existingChapter))
                {
                    if (existingChapter.Name != ch.Name)
                    {
                        existingChapter.Name = ch.Name;
                    }
                    if (existingChapter.ChapterNumber < 0 && ch.ChapterNumber >= 0)
                    {
                        existingChapter.ChapterNumber = ch.ChapterNumber;
                    }
                    if (existingChapter.DateUpload == 0 && ch.DateUpload > 0)
                    {
                        existingChapter.DateUpload = ch.DateUpload;
                    }
                }
                else
                {
                    ch.Id = 0;
                    ch.MangaId = dbManga.Id;
                    ch.DateFetch = (isInitialLoad || isEmptyLibrary) ? 0 : now; 

                    if (!isInitialLoad && !isEmptyLibrary)
                    {
                        bool isHigherNumber = ch.ChapterNumber > maxExistingNum;
                        bool isNewerDate = ch.DateUpload > 0 && maxExistingDate > 0 && ch.DateUpload > maxExistingDate;
                        bool isNewPart = !dbChaptersDict.ContainsKey(ch.Url) && (maxExistingNum > 0 || maxExistingDate > 0);

                        if (isHigherNumber || isNewerDate || isNewPart)
                        {
                            ch.IsNew = true;
                            dbManga.HasNewChapters = true;
                        }
                        else 
                        {
                            ch.IsNew = false;
                        }
                    }
                    else
                    {
                        ch.IsNew = false;
                    }
                    
                    newChapters.Add(ch);
                    dbManga.Chapters.Add(ch); // Make sure it's added to tracking collection
                }
            }

            // PRUNE MISSING (Fix Ghost Chapters)
            int prunedCount = 0;
            if (!skipPrune && !isInitialLoad)
            {
                var missingChapters = dbManga.Chapters.Where(c => !sourceUrls.Contains(c.Url)).ToList();
                
                foreach (var missing in missingChapters)
                {
                    if (!missing.IsDownloaded)
                    {
                        context.Chapters.Remove(missing);
                        dbManga.Chapters.Remove(missing);
                        prunedCount++;
                    }
                }
            }

            if (newChapters.Count > 0)
            {
                context.Chapters.AddRange(newChapters);
                LogService.Info("Library", $"SYNC: {newChapters.Count} new, {prunedCount} pruned (skipPrune={skipPrune}), {dbManga.Chapters.Count} in DB.");
            }
            else if (prunedCount > 0)
            {
                LogService.Info("Library", $"SYNC: {prunedCount} ghost chapters removed.");
            }

            return newChapters.Count;
        }

        private void UpdateMangaUpdateSchedule(Manga dbManga, long now)
        {
            dbManga.LastUpdate = now;
            
            if (dbManga.Chapters == null || dbManga.Chapters.Count == 0) return;

            var chaptersWithDates = dbManga.Chapters
                .Select(c => new { Chapter = c, Date = c.DateUpload > 0 ? c.DateUpload : c.DateFetch })
                .Where(x => x.Date > 0)
                .OrderByDescending(x => x.Date)
                .Take(20)
                .ToList();

            if (chaptersWithDates.Count == 0) return;

            // 1. Group chapters into Release Batches (chapters within 18 hours of each other belong to 1 batch)
            const long ClusterThresholdMs = 18L * 3600L * 1000L;
            var batchTimestamps = new List<long>();
            long currentBatchTime = chaptersWithDates[0].Date;
            batchTimestamps.Add(currentBatchTime);

            for (int i = 1; i < chaptersWithDates.Count; i++)
            {
                long uploadTime = chaptersWithDates[i].Date;
                if (Math.Abs(currentBatchTime - uploadTime) >= ClusterThresholdMs)
                {
                    currentBatchTime = uploadTime;
                    batchTimestamps.Add(currentBatchTime);
                }
            }

            // 2. Calculate intervals between consecutive release batches & quantize cycle
            long quantizedCycleMs = 7L * 86400L * 1000L; // Default weekly (7 days)

            if (batchTimestamps.Count >= 2)
            {
                var diffs = new List<long>();
                for (int i = 0; i < batchTimestamps.Count - 1; i++)
                {
                    long diff = batchTimestamps[i] - batchTimestamps[i + 1];
                    if (diff > 0 && diff < 31536000000L) // Less than 1 year
                    {
                        diffs.Add(diff);
                    }
                }

                if (diffs.Count > 0)
                {
                    diffs.Sort();
                    long medianDiff = diffs[diffs.Count / 2];
                    if (diffs.Count % 2 == 0)
                    {
                        medianDiff = (diffs[(diffs.Count / 2) - 1] + diffs[diffs.Count / 2]) / 2;
                    }

                    double days = TimeSpan.FromMilliseconds(medianDiff).TotalDays;
                    if (days <= 2.5)
                        quantizedCycleMs = 1L * 86400L * 1000L;       // Daily (1 day)
                    else if (days <= 10.5)
                        quantizedCycleMs = 7L * 86400L * 1000L;      // Weekly (7 days)
                    else if (days <= 21.0)
                        quantizedCycleMs = 14L * 86400L * 1000L;     // Bi-Weekly (14 days)
                    else
                        quantizedCycleMs = 30L * 86400L * 1000L;     // Monthly (30 days)
                }
            }

            // 3. Project NextUpdate forward from the latest release batch
            long latestRelease = batchTimestamps[0];
            long nextUpdate = latestRelease + quantizedCycleMs;

            while (nextUpdate <= now)
            {
                nextUpdate += quantizedCycleMs;
            }

            dbManga.NextUpdate = nextUpdate;
        }


        public async Task<List<Chapter>> GetRecentChaptersAsync(int limit = 50)
        {
            try
            {
                using var context = new MangaDbContext();
                // Get chapters fetched recently (DateFetch > 0), from Favorite mangas
                // We need to Includes Manga to get Title/Cover
                var recent = await context.Chapters
                    .Include(c => c.Manga)
                    .Where(c => c.Manga.Favorite && c.DateFetch > 0)
                    .OrderByDescending(c => c.DateFetch)
                    .Take(limit)
                    .ToListAsync();
                    
                return recent;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error fetching recent chapters: {ex}");
                return new List<Chapter>();
            }
        }

        public async Task UpdateChapterDownloadStatusAsync(long chapterId, bool isDownloaded)
        {
            using var context = new MangaDbContext();
            var chapter = await context.Chapters.FindAsync(chapterId);
            if (chapter != null)
            {
                chapter.IsDownloaded = isDownloaded;
                await context.SaveChangesAsync();
            }
        }

        public async Task UpdateChapterDownloadStatusByUrlAsync(string chapterUrl, bool isDownloaded)
        {
            using var context = new MangaDbContext();
            var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
            if (chapter != null)
            {
                chapter.IsDownloaded = isDownloaded;
                await context.SaveChangesAsync();
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Updated download status for: {chapter.Name}");
            }
        }

        public async Task SetChapterReadStatusAsync(string chapterUrl, bool isRead, long sourceId = 0, string mangaUrl = "", string chapterTitle = "", float chapterNumber = -1)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
                
                if (chapter != null)
                {
                    chapter.Read = isRead;
                    if (isRead) chapter.IsNew = false; // Clear "New" badge when read

                    var manga = await context.Mangas.FirstOrDefaultAsync(m => m.Id == chapter.MangaId);
                    if (manga != null)
                    {
                        manga.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    }

                    await context.SaveChangesAsync();
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Set chapter read status to {isRead}: {chapter.Name}");
                }
                else if (isRead && sourceId > 0 && !string.IsNullOrEmpty(mangaUrl)) 
                {
                    // Fallback: Chapter doesn't exist (Online reading), create it ONLY if marking as Read
                     var manga = await context.Mangas.FirstOrDefaultAsync(m => m.Url == mangaUrl && m.Source == sourceId);
                     if (manga != null)
                     {
                         manga.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                         var newChapter = new Chapter
                         {
                             MangaId = manga.Id,
                             Url = chapterUrl,
                             Name = chapterTitle,
                             ChapterNumber = chapterNumber,
                             Read = true,
                             DateFetch = DateTimeOffset.Now.ToUnixTimeMilliseconds(),
                             DateUpload = 0 // Unknown
                         };
                         await context.Chapters.AddAsync(newChapter);
                         await context.SaveChangesAsync();
                         System.Diagnostics.Debug.WriteLine($"[LibraryService] Created and marked online chapter as read: {chapterTitle}");
                     }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error setting read status: {ex}");
            }
        }

        public async Task SaveLastPageReadAsync(string chapterUrl, int pageIndex)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
                if (chapter != null)
                {
                    chapter.LastPageRead = pageIndex;
                    var manga = await context.Mangas.FirstOrDefaultAsync(m => m.Id == chapter.MangaId);
                    if (manga != null)
                    {
                        manga.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    }
                    await context.SaveChangesAsync();
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Saved scroll position ({pageIndex}) for chapter: {chapter.Name}");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error saving scroll position: {ex}");
            }
        }

        public void SaveLastPageRead(string chapterUrl, long value)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = context.Chapters.FirstOrDefault(c => c.Url == chapterUrl);
                if (chapter != null)
                {
                    chapter.LastPageRead = value;
                    var manga = context.Mangas.FirstOrDefault(m => m.Id == chapter.MangaId);
                    if (manga != null)
                    {
                        manga.LastViewed = DateTimeOffset.Now.ToUnixTimeMilliseconds();
                    }
                    context.SaveChanges();
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Saved scroll position ({value}) for chapter: {chapter.Name}");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error saving scroll position: {ex}");
            }
        }

        public async Task<int> GetLastPageReadAsync(string chapterUrl)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
                if (chapter != null)
                {
                    return (int)chapter.LastPageRead;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error reading scroll position: {ex}");
            }
            return 0;
        }

        public async Task<long> GetLastPageReadRawAsync(string chapterUrl)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
                if (chapter != null)
                {
                    return chapter.LastPageRead;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error reading scroll position: {ex}");
            }
            return 0;
        }

        public async Task SetChapterBookmarkStatusAsync(string chapterUrl, bool isBookmarked, long sourceId = 0, string mangaUrl = "", string chapterTitle = "", float chapterNumber = -1)
        {
            try
            {
                using var context = new MangaDbContext();
                var chapter = await context.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);
                
                if (chapter != null)
                {
                    chapter.Bookmark = isBookmarked;
                    await context.SaveChangesAsync();
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Set chapter bookmark status to {isBookmarked}: {chapter.Name}");
                }
                else if (isBookmarked && sourceId > 0 && !string.IsNullOrEmpty(mangaUrl)) 
                {
                    // Fallback: Chapter doesn't exist, create it ONLY if marking as Bookmarked
                     var manga = await context.Mangas.FirstOrDefaultAsync(m => m.Url == mangaUrl && m.Source == sourceId);
                     if (manga != null)
                     {
                         var newChapter = new Chapter
                         {
                             MangaId = manga.Id,
                             Url = chapterUrl,
                             Name = chapterTitle,
                             ChapterNumber = chapterNumber,
                             Bookmark = true,
                             DateFetch = DateTimeOffset.Now.ToUnixTimeMilliseconds(),
                             DateUpload = 0
                         };
                         await context.Chapters.AddAsync(newChapter);
                         await context.SaveChangesAsync();
                         System.Diagnostics.Debug.WriteLine($"[LibraryService] Created and marked online chapter as bookmarked: {chapterTitle}");
                     }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error setting bookmark status: {ex}");
            }
        }

        public async Task MarkChaptersAsReadAsync(Manga manga)
        {
            using var context = new MangaDbContext();
            Manga? existing = null;
            
            if (manga.Id > 0) existing = await context.Mangas.Include(m => m.Chapters).FirstOrDefaultAsync(m => m.Id == manga.Id);
            
            if (existing == null)
            {
                existing = await context.Mangas.Include(m => m.Chapters)
                                       .FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
            }
            
            if (existing != null && existing.Chapters != null)
            {
                foreach (var ch in existing.Chapters)
                {
                    ch.Read = true;
                }
                existing.HasNewChapters = false;
                await context.SaveChangesAsync();
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Marked all chapters read for: {existing.Title}");
            }
        }

        public async Task MarkChaptersAsUnreadAsync(Manga manga)
        {
            using var context = new MangaDbContext();
            Manga? existing = null;
            
            if (manga.Id > 0) existing = await context.Mangas.Include(m => m.Chapters).FirstOrDefaultAsync(m => m.Id == manga.Id);
            
            if (existing == null)
            {
                existing = await context.Mangas.Include(m => m.Chapters)
                                       .FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);
            }
            
            if (existing != null && existing.Chapters != null)
            {
                foreach (var ch in existing.Chapters)
                {
                    ch.Read = false;
                }
                await context.SaveChangesAsync();
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Marked all chapters UNREAD for: {existing.Title}");
            }
        }

        public async Task MarkChaptersBeforeAsReadAsync(Manga manga, float chapterNumber)
        {
             try
             {
                 using var context = new MangaDbContext();
                 // Find Manga ID first
                 var dbManga = await context.Mangas.FirstOrDefaultAsync(m => m.Id == manga.Id || (m.Url == manga.Url && m.Source == manga.Source));

                 if (dbManga != null)
                 {
                     // Get all unread chapters strictly before this number
                     var chapters = await context.Chapters
                         .Where(c => c.MangaId == dbManga.Id && c.ChapterNumber < chapterNumber && !c.Read)
                         .ToListAsync();
                     
                     if (chapters.Any())
                     {
                         foreach(var c in chapters) c.Read = true;
                         await context.SaveChangesAsync();
                         System.Diagnostics.Debug.WriteLine($"[LibraryService] Marked {chapters.Count} previous chapters as read for {dbManga.Title}");
                     }
                 }
             }
             catch (Exception ex)
             {
                 System.Diagnostics.Debug.WriteLine($"[LibraryService] Error marking chapters before as read: {ex.Message}");
             }
        }

        public Task<int> UpdateAllLibraryMangaAsync(SourceManager sourceManager, IProgress<(int current, int total)>? progress = null)
        {
            return UpdateAllLibraryMangaAsync(sourceManager, false, progress);
        }

        public async Task<int> UpdateAllLibraryMangaAsync(SourceManager sourceManager, bool forceRefresh, IProgress<(int current, int total)>? progress = null)
        {
            Yomic.Core.Sources.HttpSource.SilenceLogs = true;
            LogService.Info("LibraryService", $"Starting parallel library update (force={forceRefresh})...");
            int updatedCount = 0;
            try
            {
                var libraryManga = await GetLibraryMangaAsync();
                
                // Cleanup static semaphores for sources no longer in the library
                var currentSources = new HashSet<long>(libraryManga.Select(m => m.Source));
                var keysToRemove = _sourceSemaphores.Keys.Where(k => !currentSources.Contains(k)).ToList();
                foreach (var key in keysToRemove)
                {
                    if (_sourceSemaphores.TryRemove(key, out var sem))
                    {
                        sem.Dispose();
                    }
                }
                
                // Filter out manga that belong to any category marked as UpdateExcluded
                libraryManga = libraryManga.Where(m => !m.Categories.Any(c => c.UpdateExcluded)).ToList();

                // Smart Update Logic
                var settings = new SettingsService();
                if (settings.UseSmartUpdate && !forceRefresh)
                {
                    long nowMs = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                    libraryManga = libraryManga.Where(m => 
                    {
                        // 1. Always update if it has 0 chapters or is not initialized
                        if (m.Chapters.Count == 0 || !m.Initialized) return true;

                        // 2. Completed / Inactive statuses: check at most once a month (30 days)
                        bool isInactiveStatus = m.Status == Manga.COMPLETED || 
                                                m.Status == Manga.CANCELLED || 
                                                m.Status == Manga.PUBLISHING_FINISHED || 
                                                m.Status == Manga.LICENSED;
                        if (isInactiveStatus)
                        {
                            long oneMonthMs = 30L * 24L * 60L * 60L * 1000L;
                            return (nowMs - m.LastUpdate) > oneMonthMs;
                        }

                        // 3. Reader-Activity Interval Heuristics
                        long timeSinceLastUpdate = nowMs - m.LastUpdate;
                        long checkInterval = 12L * 60L * 60L * 1000L; // Default: 12 hours
                        
                        long timeSinceLastRead = nowMs - m.LastViewed;
                        if (m.LastViewed == 0)
                        {
                            // Never read: check at most once every 7 days
                            checkInterval = 7L * 24L * 60L * 60L * 1000L;
                        }
                        else if (timeSinceLastRead > 30L * 24L * 60L * 60L * 1000L)
                        {
                            // Not read in 30 days: check at most once every 7 days
                            checkInterval = 7L * 24L * 60L * 60L * 1000L;
                        }
                        else if (timeSinceLastRead > 7L * 24L * 60L * 60L * 1000L)
                        {
                            // Not read in 7 days: check at most once every 3 days
                            checkInterval = 3L * 24L * 60L * 60L * 1000L;
                        }

                        // Skip if we checked it too recently based on activity interval
                        if (timeSinceLastUpdate < checkInterval) return false;

                        // 4. Adaptive Release (NextUpdate check)
                        // If we have a predicted NextUpdate and we are not close to it (margin of 6 hours), skip.
                        if (m.NextUpdate > 0 && nowMs < (m.NextUpdate - 6L * 60L * 60L * 1000L))
                        {
                            return false;
                        }

                        return true;
                    })
                    // Prioritize active manga (descending by LastUpdate)
                    .OrderByDescending(m => m.LastUpdate)
                    .ToList();
                    
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Smart Update Active: Filtered down to {libraryManga.Count} active manga.");
                }

                int totalManga = libraryManga.Count;
                if (totalManga == 0) return 0;
                
                int currentManga = 0;
                
                // Process in parallel using a global semaphore and per-source semaphores
                using var globalSemaphore = new System.Threading.SemaphoreSlim(20);
                var completedBatch = new List<(Manga manga, Manga? freshManga, List<Chapter>? chapters)>();
                var batchLock = new object();
                int totalNewChapters = 0;

                var tasks = libraryManga.Select(async manga =>
                {
                    await globalSemaphore.WaitAsync();
                    var sourceSemaphore = _sourceSemaphores.GetOrAdd(manga.Source, _ => new System.Threading.SemaphoreSlim(3));
                    await sourceSemaphore.WaitAsync();
                    
                    Manga? freshManga = null;
                    List<Chapter>? chapters = null;
                    try
                    {
                        var source = sourceManager.GetSource(manga.Source);
                        if (source != null)
                        {
                            // Stagger requests per-source with a custom delay based on the source's limit
                            int delayMs = source.RateLimitDelayMs;
                            if (delayMs > 0)
                            {
                                int variance = delayMs / 4;
                                int actualDelay = delayMs + Random.Shared.Next(-variance, variance);
                                await Task.Delay(Math.Max(50, actualDelay));
                            }

                            if (forceRefresh)
                            {
                                try
                                {
                                    freshManga = await source.GetMangaDetailsAsync(manga.Url);
                                }
                                catch (Exception ex)
                                {
                                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Error updating metadata for {manga.Title}: {ex.Message}");
                                }
                            }

                            chapters = await source.GetChapterListAsync(manga.Url);
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[LibraryService] Error updating {manga.Title}: {ex.Message}");
                    }
                    finally
                    {
                        int completed = System.Threading.Interlocked.Increment(ref currentManga);
                        PrintConsoleProgress(completed, totalManga);
                        progress?.Report((completed, totalManga));
                        
                        sourceSemaphore.Release();
                        globalSemaphore.Release();
                    }

                    var result = (manga, freshManga, chapters);
                    List<(Manga manga, Manga? freshManga, List<Chapter>? chapters)>? batchToWrite = null;
                    lock (batchLock)
                    {
                        completedBatch.Add(result);
                        if (completedBatch.Count >= 20)
                        {
                            batchToWrite = completedBatch.ToList();
                            completedBatch.Clear();
                        }
                    }
                    if (batchToWrite != null)
                    {
                        int newCount = await SaveLibraryUpdateBatchAsync(batchToWrite, forceRefresh);
                        System.Threading.Interlocked.Add(ref totalNewChapters, newCount);
                    }
                    
                    return result;
                });

                await Task.WhenAll(tasks);

                // Write any remaining leftovers
                if (completedBatch.Count > 0)
                {
                    int newCount = await SaveLibraryUpdateBatchAsync(completedBatch, forceRefresh);
                    totalNewChapters += newCount;
                }
                
                updatedCount = totalNewChapters;

                LogService.Info("LibraryService", $"Update complete. Total new: {updatedCount}");
                
                // Notify subscribers (e.g. UpdatesViewModel)
                UpdatesFound?.Invoke(this, updatedCount);
                
                return updatedCount;
            }
            catch (Exception ex)
            {
                 LogService.Error("LibraryService", $"Error in UpdateAllLibraryMangaAsync: {ex.Message}", ex);
            }
            finally
            {
                 Yomic.Core.Sources.HttpSource.SilenceLogs = false;
            }
            return updatedCount;
        }

        private void PrintConsoleProgress(int current, int total)
        {
            int barWidth = 20;
            int filled = total == 0 ? 0 : (int)((double)current / total * barWidth);
            string bar = new string('█', filled) + new string('░', barWidth - filled);
            int percent = total == 0 ? 0 : (int)((double)current / total * 100);
            
            Console.Write($"\r[LibraryService] Updating... [{bar}] {current}/{total} ({percent}%)");
            if (current == total)
            {
                Console.WriteLine();
            }
        }

        private async Task<int> SaveLibraryUpdateBatchAsync(List<(Manga manga, Manga? freshManga, List<Chapter>? chapters)> batch, bool forceRefresh)
        {
            int batchNewChaptersCount = 0;
            await _dbLock.WaitAsync();
            try
            {
                using var context = new MangaDbContext();
                var urls = batch.Select(b => b.manga.Url).ToList();
                var dbMangas = await context.Mangas
                    .Include(m => m.Chapters)
                    .Where(m => m.Favorite && urls.Contains(m.Url))
                    .ToListAsync();
                
                var dbMangaDict = dbMangas.ToDictionary(m => (m.Url, m.Source));
                long now = DateTimeOffset.Now.ToUnixTimeMilliseconds();

                foreach (var (manga, freshManga, chapters) in batch)
                {
                    if (chapters == null) continue;

                    if (dbMangaDict.TryGetValue((manga.Url, manga.Source), out var dbManga))
                    {
                        // 1. Update metadata if forceRefresh
                        if (forceRefresh && freshManga != null)
                        {
                            dbManga.Title = freshManga.Title;
                            dbManga.Author = freshManga.Author;
                            dbManga.Description = freshManga.Description;
                            dbManga.Genre = freshManga.Genre;
                            dbManga.Status = freshManga.Status;
                            if (!string.IsNullOrEmpty(freshManga.ThumbnailUrl))
                            {
                                dbManga.ThumbnailUrl = freshManga.ThumbnailUrl;
                            }

                            // Sync local copy properties
                            manga.Title = freshManga.Title;
                            manga.Author = freshManga.Author;
                            manga.Description = freshManga.Description;
                            manga.Genre = freshManga.Genre;
                            manga.Status = freshManga.Status;
                            if (!string.IsNullOrEmpty(freshManga.ThumbnailUrl))
                            {
                                manga.ThumbnailUrl = freshManga.ThumbnailUrl;
                            }
                        }

                        int newCount = SyncChaptersInternal(context, dbManga, chapters, false, false, now);
                        batchNewChaptersCount += newCount;
                        UpdateMangaUpdateSchedule(dbManga, now);
                    }
                }
                
                await context.SaveChangesAsync();
            }
            finally
            {
                _dbLock.Release();
            }
            return batchNewChaptersCount;
        }

        public async Task ClearDatabaseAsync()
        {
            try
            {
                using var context = new MangaDbContext();
                await context.Database.EnsureDeletedAsync();
                await context.Database.EnsureCreatedAsync();
                System.Diagnostics.Debug.WriteLine("[LibraryService] Database cleared and recreated.");

                // Also delete downloaded files
                var appData = System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData);
                var downloadsFolder = System.IO.Path.Combine(appData, "Yomic", "Downloads");
                var coversFolder = System.IO.Path.Combine(appData, "Yomic", "covers");

                if (System.IO.Directory.Exists(downloadsFolder))
                {
                    System.IO.Directory.Delete(downloadsFolder, true);
                    System.Diagnostics.Debug.WriteLine("[LibraryService] Downloads folder deleted.");
                }

                if (System.IO.Directory.Exists(coversFolder))
                {
                    System.IO.Directory.Delete(coversFolder, true);
                    System.Diagnostics.Debug.WriteLine("[LibraryService] Covers cache folder deleted.");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error clearing database: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Clears the read status of all chapters without deleting any data.
        /// </summary>
        public async Task ClearAllReadHistoryAsync()
        {
            try
            {
                using var context = new MangaDbContext();
                var readChapters = await context.Chapters.Where(c => c.Read).ToListAsync();
                
                foreach (var chapter in readChapters)
                {
                    chapter.Read = false;
                }
                
                await context.SaveChangesAsync();
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Cleared read status for {readChapters.Count} chapters.");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error clearing read history: {ex.Message}");
                throw;
            }
        }

        public async Task ClearAllUpdatesAsync()
        {
            await _dbLock.WaitAsync();
            try
            {
                using var context = new MangaDbContext();
                // "Updates" are defined as chapters with DateFetch > 0 in GetRecentChaptersAsync
                
                var recentChapters = await context.Chapters
                    .Where(c => c.DateFetch > 0 || c.IsNew)
                    .ToListAsync();
                
                if (recentChapters.Any())
                {
                    foreach (var chapter in recentChapters)
                    {
                        chapter.DateFetch = 0;
                        chapter.IsNew = false;
                    }
                    await context.SaveChangesAsync();
                    System.Diagnostics.Debug.WriteLine($"[LibraryService] Cleared updates for {recentChapters.Count} chapters.");
                }

                // We only reset HasNewChapters if ALL chapters' IsNew flags are stripped
                // If there are still new chapters from today, we keep the flag
                var allRemainingNewChapters = await context.Chapters.AnyAsync(c => c.IsNew);
                
                if (!allRemainingNewChapters)
                {
                    var mangasWithUpdates = await context.Mangas
                        .Where(m => (m.ViewerFlags & Manga.MASK_HAS_NEW_CHAPTERS) != 0)
                        .ToListAsync();
                    
                    if (mangasWithUpdates.Any())
                    {
                        foreach (var m in mangasWithUpdates) m.HasNewChapters = false;
                        await context.SaveChangesAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[LibraryService] Error clearing all updates: {ex}");
                throw;
            }
            finally
            {
                _dbLock.Release();
            }
        }

        #region Category Management

        public async Task<List<Category>> GetCategoriesAsync()
        {
            using var context = new MangaDbContext();
            return await context.Categories
                                .OrderBy(c => c.SortOrder)
                                .ToListAsync();
        }

        public async Task AddCategoryAsync(Category category)
        {
            using var context = new MangaDbContext();
            // Assign next sort order
            int maxOrder = 0;
            if (await context.Categories.AnyAsync())
            {
                maxOrder = await context.Categories.MaxAsync(c => c.SortOrder);
            }
            category.SortOrder = maxOrder + 1;

            if (category.IsDefault)
            {
                // Reset other default categories
                var defaults = await context.Categories.Where(c => c.IsDefault).ToListAsync();
                foreach (var d in defaults) d.IsDefault = false;
            }

            await context.Categories.AddAsync(category);
            await context.SaveChangesAsync();
        }

        public async Task UpdateCategoryAsync(Category category)
        {
            using var context = new MangaDbContext();
            var existing = await context.Categories.FindAsync(category.Id);
            if (existing != null)
            {
                existing.Name = category.Name;
                existing.Color = category.Color;
                
                if (category.IsDefault && !existing.IsDefault)
                {
                    // Reset other default categories
                    var defaults = await context.Categories.Where(c => c.IsDefault && c.Id != category.Id).ToListAsync();
                    foreach (var d in defaults) d.IsDefault = false;
                    existing.IsDefault = true;
                }
                else if (!category.IsDefault && existing.IsDefault)
                {
                    existing.IsDefault = false;
                }

                context.Categories.Update(existing);
                await context.SaveChangesAsync();
            }
        }

        public async Task DeleteCategoryAsync(long categoryId)
        {
            using var context = new MangaDbContext();
            var category = await context.Categories.FindAsync(categoryId);
            if (category != null)
            {
                context.Categories.Remove(category);
                await context.SaveChangesAsync();
            }
        }

        public async Task UpdateCategoryOrderAsync(List<long> categoryIds)
        {
            try
            {
                using var context = new MangaDbContext();
                var categories = await context.Categories.Where(c => categoryIds.Contains(c.Id)).ToListAsync();
                var categoryDict = categories.ToDictionary(c => c.Id);
                for (int i = 0; i < categoryIds.Count; i++)
                {
                    var id = categoryIds[i];
                    if (categoryDict.TryGetValue(id, out var cat))
                    {
                        cat.SortOrder = i + 1;
                        context.Categories.Update(cat);
                    }
                }
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                LogService.Error("LibraryService", $"Error updating category order: {ex.Message}", ex);
            }
        }

        public async Task<Category?> GetDefaultCategoryAsync()
        {
            using var context = new MangaDbContext();
            return await context.Categories.FirstOrDefaultAsync(c => c.IsDefault);
        }

        public async Task SetDefaultCategoryAsync(long categoryId)
        {
            using var context = new MangaDbContext();
            var categories = await context.Categories.ToListAsync();
            foreach (var c in categories)
            {
                c.IsDefault = (c.Id == categoryId);
                context.Categories.Update(c);
            }
            await context.SaveChangesAsync();
        }

        public async Task SetCategoryExcludeAsync(long categoryId, bool isExcluded)
        {
            using var context = new MangaDbContext();
            var category = await context.Categories.FindAsync(categoryId);
            if (category != null)
            {
                category.UpdateExcluded = isExcluded;
                context.Categories.Update(category);
                await context.SaveChangesAsync();
            }
        }

        public async Task SetMangaCategoriesAsync(string mangaUrl, long sourceId, List<long> categoryIds)
        {
            using var context = new MangaDbContext();
            var manga = await context.Mangas
                                     .Include(m => m.Categories)
                                     .FirstOrDefaultAsync(m => m.Url == mangaUrl && m.Source == sourceId);
            
            if (manga != null)
            {
                manga.Categories.Clear();
                if (categoryIds != null && categoryIds.Any())
                {
                    var selectedCategories = await context.Categories
                                                          .Where(c => categoryIds.Contains(c.Id))
                                                          .ToListAsync();
                    foreach (var cat in selectedCategories)
                    {
                        manga.Categories.Add(cat);
                    }
                }
                context.Update(manga);
                await context.SaveChangesAsync();
            }
        }

        public async Task<List<long>> GetMangaCategoryIdsAsync(string mangaUrl, long sourceId)
        {
            using var context = new MangaDbContext();
            var manga = await context.Mangas
                                     .Include(m => m.Categories)
                                     .FirstOrDefaultAsync(m => m.Url == mangaUrl && m.Source == sourceId);
            return manga?.Categories.Select(c => c.Id).ToList() ?? new List<long>();
        }

        #endregion
    }
}
