using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace YomicDesktop.IPC
{
    public class IpcEnvelope
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("payload")]
        public System.Text.Json.JsonElement? Payload { get; set; }
    }

    public class IpcResponseEnvelope
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;

        [JsonPropertyName("requestId")]
        public string? RequestId { get; set; }

        [JsonPropertyName("ok")]
        public bool Ok { get; set; } = true;

        [JsonPropertyName("error")]
        public string? Error { get; set; }

        [JsonPropertyName("payload")]
        public object? Payload { get; set; }
    }

    public class ChapterDto
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("dbId")]
        public long DbId { get; set; }

        [JsonPropertyName("number")]
        public float Number { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("releaseDate")]
        public string ReleaseDate { get; set; } = string.Empty;

        [JsonPropertyName("dateUpload")]
        public long DateUpload { get; set; }

        [JsonPropertyName("isRead")]
        public bool IsRead { get; set; }

        [JsonPropertyName("isDownloaded")]
        public bool IsDownloaded { get; set; }

        [JsonPropertyName("isBookmarked")]
        public bool IsBookmarked { get; set; }

        [JsonPropertyName("lastPageRead")]
        public int LastPageRead { get; set; }

        [JsonPropertyName("scanlator")]
        public string? Scanlator { get; set; }
    }

    public class MangaDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("dbId")]
        public long DbId { get; set; }

        [JsonPropertyName("sourceId")]
        public long SourceId { get; set; }

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("altTitle")]
        public string AltTitle { get; set; } = string.Empty;

        [JsonPropertyName("author")]
        public string Author { get; set; } = "Unknown";

        [JsonPropertyName("artist")]
        public string Artist { get; set; } = "Studio";

        [JsonPropertyName("status")]
        public string Status { get; set; } = "Ongoing";

        [JsonPropertyName("type")]
        public string Type { get; set; } = "Manga";

        [JsonPropertyName("rating")]
        public double Rating { get; set; } = 0.0;

        [JsonPropertyName("unreadCount")]
        public int UnreadCount { get; set; }

        [JsonPropertyName("downloadedCount")]
        public int DownloadedCount { get; set; }

        [JsonPropertyName("totalChapters")]
        public int TotalChapters { get; set; }

        [JsonPropertyName("lastReadChapter")]
        public float LastReadChapter { get; set; } = 1;

        [JsonPropertyName("lastReadChapterUrl")]
        public string LastReadChapterUrl { get; set; } = string.Empty;

        [JsonPropertyName("lastReadPage")]
        public int LastReadPage { get; set; } = 1;

        [JsonPropertyName("lastReadTotalPages")]
        public int LastReadTotalPages { get; set; } = 15;

        [JsonPropertyName("lastReadTimeAgo")]
        public string LastReadTimeAgo { get; set; } = "Belum dibaca";

        [JsonPropertyName("lastViewedEpoch")]
        public long LastViewedEpoch { get; set; }

        [JsonPropertyName("lastUpdateEpoch")]
        public long LastUpdateEpoch { get; set; }

        [JsonPropertyName("sourceName")]
        public string SourceName { get; set; } = string.Empty;

        [JsonPropertyName("category")]
        public string Category { get; set; } = "reading";

        [JsonPropertyName("categoryIds")]
        public List<long> CategoryIds { get; set; } = new();

        [JsonPropertyName("genres")]
        public List<string> Genres { get; set; } = new();

        [JsonPropertyName("synopsis")]
        public string Synopsis { get; set; } = string.Empty;

        [JsonPropertyName("coverPalette")]
        public string[] CoverPalette { get; set; } = { "#071426", "#0066CC", "#38BDF8" };

        [JsonPropertyName("coverAccent")]
        public string CoverAccent { get; set; } = "#0066CC";

        [JsonPropertyName("coverUrl")]
        public string CoverUrl { get; set; } = string.Empty;

        [JsonPropertyName("rawCoverUrl")]
        public string RawCoverUrl { get; set; } = string.Empty;

        [JsonPropertyName("inLibrary")]
        public bool InLibrary { get; set; }

        [JsonPropertyName("malTracked")]
        public bool MalTracked { get; set; }

        [JsonPropertyName("malId")]
        public long MalId { get; set; }

        [JsonPropertyName("malTitle")]
        public string MalTitle { get; set; } = string.Empty;

        [JsonPropertyName("malStatus")]
        public string MalStatus { get; set; } = "reading";

        [JsonPropertyName("malScore")]
        public int MalScore { get; set; } = 0;

        [JsonPropertyName("chapters")]
        public List<ChapterDto> Chapters { get; set; } = new();
    }

    public class MalSearchResultDto
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("coverUrl")]
        public string? CoverUrl { get; set; }
    }

    public class ActivityUpdateDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("mangaId")]
        public string MangaId { get; set; } = string.Empty;

        [JsonPropertyName("mangaTitle")]
        public string MangaTitle { get; set; } = string.Empty;

        [JsonPropertyName("chapterNumber")]
        public float ChapterNumber { get; set; }

        [JsonPropertyName("chapterTitle")]
        public string ChapterTitle { get; set; } = string.Empty;

        [JsonPropertyName("chapterUrl")]
        public string ChapterUrl { get; set; } = string.Empty;

        [JsonPropertyName("sourceName")]
        public string SourceName { get; set; } = string.Empty;

        [JsonPropertyName("timeAgo")]
        public string TimeAgo { get; set; } = string.Empty;

        [JsonPropertyName("dateFetch")]
        public long DateFetch { get; set; }

        [JsonPropertyName("isNew")]
        public bool IsNew { get; set; }

        [JsonPropertyName("extraChaptersCount")]
        public int ExtraChaptersCount { get; set; }

        [JsonPropertyName("coverUrl")]
        public string CoverUrl { get; set; } = string.Empty;

        [JsonPropertyName("firstUnreadChapterNumber")]
        public float FirstUnreadChapterNumber { get; set; }

        [JsonPropertyName("firstUnreadChapterTitle")]
        public string FirstUnreadChapterTitle { get; set; } = string.Empty;

        [JsonPropertyName("firstUnreadChapterUrl")]
        public string FirstUnreadChapterUrl { get; set; } = string.Empty;
    }

    public class DownloadQueueDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("mangaId")]
        public string MangaId { get; set; } = string.Empty;

        [JsonPropertyName("mangaTitle")]
        public string MangaTitle { get; set; } = string.Empty;

        [JsonPropertyName("chapterLabel")]
        public string ChapterLabel { get; set; } = string.Empty;

        [JsonPropertyName("chapterNumber")]
        public float ChapterNumber { get; set; }

        [JsonPropertyName("chapterUrl")]
        public string ChapterUrl { get; set; } = string.Empty;

        [JsonPropertyName("coverUrl")]
        public string CoverUrl { get; set; } = string.Empty;

        [JsonPropertyName("sourceName")]
        public string SourceName { get; set; } = string.Empty;

        [JsonPropertyName("progressPercent")]
        public int ProgressPercent { get; set; }

        [JsonPropertyName("speedText")]
        public string SpeedText { get; set; } = string.Empty;

        [JsonPropertyName("sizeText")]
        public string SizeText { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "queued";
    }

    public class ExtensionDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("pkg")]
        public string Pkg { get; set; } = string.Empty;

        [JsonPropertyName("sourceId")]
        public long SourceId { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("lang")]
        public string Lang { get; set; } = "ID";

        [JsonPropertyName("version")]
        public string Version { get; set; } = string.Empty;

        [JsonPropertyName("isNsfw")]
        public bool IsNsfw { get; set; }

        [JsonPropertyName("installed")]
        public bool Installed { get; set; }

        [JsonPropertyName("hasUpdate")]
        public bool HasUpdate { get; set; }

        [JsonPropertyName("isCloudflareProtected")]
        public bool IsCloudflareProtected { get; set; }

        [JsonPropertyName("fileSizeText")]
        public string FileSizeText { get; set; } = string.Empty;

        [JsonPropertyName("baseUrl")]
        public string BaseUrl { get; set; } = string.Empty;

        [JsonPropertyName("accentColor")]
        public string AccentColor { get; set; } = "#2563EB";

        [JsonPropertyName("iconUrl")]
        public string IconUrl { get; set; } = string.Empty;

        [JsonPropertyName("status")]
        public string Status { get; set; } = "online";

        [JsonPropertyName("supportsStatusFilter")]
        public bool SupportsStatusFilter { get; set; }

        [JsonPropertyName("supportsGenreFilter")]
        public bool SupportsGenreFilter { get; set; }

        [JsonPropertyName("availableGenres")]
        public List<string> AvailableGenres { get; set; } = new();

        [JsonPropertyName("supportsFormatFilter")]
        public bool SupportsFormatFilter { get; set; }

        [JsonPropertyName("availableFormats")]
        public List<string> AvailableFormats { get; set; } = new();
    }

    public class AnnouncementDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("body")]
        public string Body { get; set; } = string.Empty;

        [JsonPropertyName("date")]
        public string Date { get; set; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; set; } = "info";

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("hasUrl")]
        public bool HasUrl { get; set; }

        [JsonPropertyName("typeDisplay")]
        public string TypeDisplay { get; set; } = "Info";

        [JsonPropertyName("badgeBackground")]
        public string BadgeBackground { get; set; } = "#0078D4";
    }

    public class CategoryDto
    {
        [JsonPropertyName("id")]
        public long Id { get; set; }

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("color")]
        public string Color { get; set; } = "#FFFFFF";

        [JsonPropertyName("sortOrder")]
        public int SortOrder { get; set; }

        [JsonPropertyName("isDefault")]
        public bool IsDefault { get; set; }

        [JsonPropertyName("updateExcluded")]
        public bool UpdateExcluded { get; set; }
    }

    public class AppBootstrapDto
    {
        [JsonPropertyName("mangaList")]
        public List<MangaDto> MangaList { get; set; } = new();

        [JsonPropertyName("activityUpdates")]
        public List<ActivityUpdateDto> ActivityUpdates { get; set; } = new();

        [JsonPropertyName("downloads")]
        public List<DownloadQueueDto> Downloads { get; set; } = new();

        [JsonPropertyName("extensions")]
        public List<ExtensionDto> Extensions { get; set; } = new();

        [JsonPropertyName("categories")]
        public List<CategoryDto> Categories { get; set; } = new();

        [JsonPropertyName("settings")]
        public Dictionary<string, object?> Settings { get; set; } = new();

        [JsonPropertyName("announcements")]
        public List<AnnouncementDto> Announcements { get; set; } = new();

        [JsonPropertyName("hasUnreadAnnouncements")]
        public bool HasUnreadAnnouncements { get; set; }
    }

    public class SourceFeedResultDto
    {
        [JsonPropertyName("sourceId")]
        public long SourceId { get; set; }

        [JsonPropertyName("page")]
        public int Page { get; set; }

        [JsonPropertyName("totalPages")]
        public int TotalPages { get; set; }

        [JsonPropertyName("hasMore")]
        public bool HasMore { get; set; }

        [JsonPropertyName("items")]
        public List<MangaDto> Items { get; set; } = new();
    }

    public class ReaderPagesResultDto
    {
        [JsonPropertyName("mangaId")]
        public string MangaId { get; set; } = string.Empty;

        [JsonPropertyName("chapterUrl")]
        public string ChapterUrl { get; set; } = string.Empty;

        [JsonPropertyName("chapterNumber")]
        public float ChapterNumber { get; set; }

        [JsonPropertyName("chapterTitle")]
        public string ChapterTitle { get; set; } = string.Empty;

        [JsonPropertyName("isOffline")]
        public bool IsOffline { get; set; }

        [JsonPropertyName("lastPageRead")]
        public int LastPageRead { get; set; } = 1;

        [JsonPropertyName("scrollPercent")]
        public double ScrollPercent { get; set; } = 0;

        [JsonPropertyName("pages")]
        public List<string> Pages { get; set; } = new();
    }

    public class GenreStatDto
    {
        [JsonPropertyName("genre")]
        public string Genre { get; set; } = string.Empty;

        [JsonPropertyName("mangaCount")]
        public int MangaCount { get; set; }

        [JsonPropertyName("chaptersRead")]
        public int ChaptersRead { get; set; }

        [JsonPropertyName("percentage")]
        public double Percentage { get; set; }
    }

    public class DailyActivityStatDto
    {
        [JsonPropertyName("dateLabel")]
        public string DateLabel { get; set; } = string.Empty;

        [JsonPropertyName("fullDate")]
        public string FullDate { get; set; } = string.Empty;

        [JsonPropertyName("chaptersRead")]
        public int ChaptersRead { get; set; }

        [JsonPropertyName("minutesRead")]
        public int MinutesRead { get; set; }
    }

    public class ReadingStatisticsDto
    {
        [JsonPropertyName("totalLibraryManga")]
        public int TotalLibraryManga { get; set; }

        [JsonPropertyName("readingMangaCount")]
        public int ReadingMangaCount { get; set; }

        [JsonPropertyName("completedMangaCount")]
        public int CompletedMangaCount { get; set; }

        [JsonPropertyName("unreadMangaCount")]
        public int UnreadMangaCount { get; set; }

        [JsonPropertyName("totalChaptersRead")]
        public int TotalChaptersRead { get; set; }

        [JsonPropertyName("totalLibraryChapters")]
        public int TotalLibraryChapters { get; set; }

        [JsonPropertyName("completionRatePercent")]
        public double CompletionRatePercent { get; set; }

        [JsonPropertyName("totalDownloadedChapters")]
        public int TotalDownloadedChapters { get; set; }

        [JsonPropertyName("totalBookmarkedChapters")]
        public int TotalBookmarkedChapters { get; set; }

        [JsonPropertyName("currentStreakDays")]
        public int CurrentStreakDays { get; set; }

        [JsonPropertyName("longestStreakDays")]
        public int LongestStreakDays { get; set; }

        [JsonPropertyName("totalReadingMinutes")]
        public int TotalReadingMinutes { get; set; }

        [JsonPropertyName("activeDaysCount")]
        public int ActiveDaysCount { get; set; }

        [JsonPropertyName("topGenres")]
        public List<GenreStatDto> TopGenres { get; set; } = new();

        [JsonPropertyName("dailyActivity")]
        public List<DailyActivityStatDto> DailyActivity { get; set; } = new();
    }
}
