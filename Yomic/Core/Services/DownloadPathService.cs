using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Yomic.Core.Models;

namespace Yomic.Core.Services
{
    public static class DownloadPathService
    {
        public const string TempSuffix = ".tmp";

        private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"
        };

        public static string BaseDirectory
        {
            get
            {
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                return Path.Combine(appData, "Yomic", "Downloads");
            }
        }

        public static string GetSourceDirectory(long sourceId)
        {
            return Path.Combine(BaseDirectory, sourceId.ToString());
        }

        public static string GetMangaDirectory(Manga manga)
        {
            return Path.Combine(GetSourceDirectory(manga.Source), SanitizePathSegment(manga.Title ?? "Unknown"));
        }

        public static string GetChapterDirectory(Manga manga, Chapter chapter)
        {
            return Path.Combine(GetMangaDirectory(manga), GetChapterDirectoryName(chapter.Name, chapter.Url));
        }

        public static string GetChapterTempDirectory(Manga manga, Chapter chapter)
        {
            return GetChapterDirectory(manga, chapter) + TempSuffix;
        }

        public static string? FindCompletedChapterDirectory(Manga manga, Chapter chapter)
        {
            var mangaDir = GetMangaDirectory(manga);
            foreach (var chapterDir in GetChapterDirectoryCandidates(mangaDir, chapter.Name, chapter.Url))
            {
                if (IsCompletedChapterDirectory(chapterDir))
                {
                    return chapterDir;
                }

                var tempDir = chapterDir + TempSuffix;
                if (Directory.Exists(tempDir) && GetReadableFiles(tempDir, includeTempDirectory: true).Count > 0)
                {
                    try
                    {
                        if (!Directory.Exists(chapterDir))
                        {
                            Directory.Move(tempDir, chapterDir);
                            if (IsCompletedChapterDirectory(chapterDir))
                            {
                                return chapterDir;
                            }
                        }
                    }
                    catch { }

                    return tempDir;
                }
            }

            var fallbackMangaDir = Path.Combine(GetSourceDirectory(manga.Source), "Unknown");
            foreach (var chapterDir in GetChapterDirectoryCandidates(fallbackMangaDir, chapter.Name, chapter.Url))
            {
                if (IsCompletedChapterDirectory(chapterDir))
                {
                    return chapterDir;
                }

                var tempDir = chapterDir + TempSuffix;
                if (Directory.Exists(tempDir) && GetReadableFiles(tempDir, includeTempDirectory: true).Count > 0)
                {
                    try
                    {
                        if (!Directory.Exists(chapterDir))
                        {
                            Directory.Move(tempDir, chapterDir);
                            if (IsCompletedChapterDirectory(chapterDir))
                            {
                                return chapterDir;
                            }
                        }
                    }
                    catch { }

                    return tempDir;
                }
            }

            return null;
        }

        public static bool IsChapterDownloaded(Manga manga, Chapter chapter)
        {
            return FindCompletedChapterDirectory(manga, chapter) != null;
        }

        public static bool HasAnyDownloadedChapter(Manga manga)
        {
            var mangaDir = GetMangaDirectory(manga);
            if (!Directory.Exists(mangaDir))
            {
                return false;
            }

            try
            {
                return Directory.EnumerateDirectories(mangaDir)
                    .Any(d => !d.EndsWith(TempSuffix, StringComparison.OrdinalIgnoreCase) && IsCompletedChapterDirectory(d));
            }
            catch
            {
                return false;
            }
        }

        public static int GetDownloadedChaptersCount(Manga manga)
        {
            var mangaDir = GetMangaDirectory(manga);
            if (!Directory.Exists(mangaDir))
            {
                return 0;
            }

            try
            {
                return Directory.EnumerateDirectories(mangaDir)
                    .Count(d => !d.EndsWith(TempSuffix, StringComparison.OrdinalIgnoreCase) && IsCompletedChapterDirectory(d));
            }
            catch
            {
                return 0;
            }
        }

        public static IReadOnlyList<string> GetReadableFiles(string chapterDir, bool includeTempDirectory = false)
        {
            if (!Directory.Exists(chapterDir))
            {
                return Array.Empty<string>();
            }

            if (!includeTempDirectory && chapterDir.EndsWith(TempSuffix, StringComparison.OrdinalIgnoreCase))
            {
                var tempFiles = Directory.GetFiles(chapterDir)
                    .Where(IsReadablePageFile)
                    .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (tempFiles.Count > 0) return tempFiles;
                return Array.Empty<string>();
            }

            return Directory.GetFiles(chapterDir)
                .Where(IsReadablePageFile)
                .OrderBy(f => f, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public static string SanitizePathSegment(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return "Unknown";
            }

            var sanitized = string.Join("_", value.Split(Path.GetInvalidFileNameChars()));
            sanitized = sanitized.Trim().TrimEnd('.');
            return string.IsNullOrWhiteSpace(sanitized) ? "Unknown" : sanitized;
        }

        public static string GetChapterDirectoryName(string chapterName, string chapterUrl)
        {
            var sanitized = SanitizePathSegment(chapterName);
            var hash = ShortHash(chapterUrl);
            var maxBaseLength = Math.Max(1, 120 - hash.Length - 1);
            if (sanitized.Length > maxBaseLength)
            {
                sanitized = sanitized[..maxBaseLength].TrimEnd('.', ' ');
            }

            return $"{sanitized}_{hash}";
        }

        private static IEnumerable<string> GetChapterDirectoryCandidates(string mangaDir, string chapterName, string chapterUrl)
        {
            yield return Path.Combine(mangaDir, GetChapterDirectoryName(chapterName, chapterUrl));
            yield return Path.Combine(mangaDir, SanitizePathSegment(chapterName));
        }

        private static bool IsCompletedChapterDirectory(string chapterDir)
        {
            return Directory.Exists(chapterDir) && GetReadableFiles(chapterDir).Count > 0;
        }

        private static bool IsReadablePageFile(string path)
        {
            var extension = Path.GetExtension(path);
            return !extension.Equals(".part", StringComparison.OrdinalIgnoreCase)
                && !extension.Equals(TempSuffix, StringComparison.OrdinalIgnoreCase)
                && ImageExtensions.Contains(extension);
        }

        private static string ShortHash(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                value = "missing-url";
            }

            var bytes = MD5.HashData(Encoding.UTF8.GetBytes(value));
            return Convert.ToHexString(bytes).ToLowerInvariant()[..6];
        }
    }
}
