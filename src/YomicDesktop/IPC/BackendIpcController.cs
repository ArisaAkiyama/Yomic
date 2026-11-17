using System;

using System.Collections.Concurrent;

using System.Collections.Generic;

using System.Diagnostics;

using System.Globalization;

using System.IO;

using System.Linq;

using System.Security.Cryptography;

using System.Text;

using System.Text.Json;

using System.Text.RegularExpressions;

using System.Threading;

using System.Threading.Tasks;

using System.Windows;

using System.Windows.Threading;

using Microsoft.EntityFrameworkCore;

using Microsoft.Win32;

using Yomic.Core.Data;

using Yomic.Core.Helpers;

using Yomic.Core.Models;

using Yomic.Core.Services;

using Yomic.Core.Sources;

namespace YomicDesktop.IPC

{

    public class BackendIpcController : IDisposable

    {

        private readonly Window _ownerWindow;

        private readonly Dispatcher _dispatcher;

        private readonly Action<string> _sendToWebUi;

        public SettingsService SettingsService { get; }

        public NetworkService NetworkService { get; }

        public SourceManager SourceManager { get; }

        public SourceStatusService SourceStatusService { get; }

        public ExtensionRepositoryService ExtensionRepoService { get; }

        public LibraryService LibraryService { get; }

        public DownloadService DownloadService { get; }

        public BackupService BackupService { get; }

        public MyAnimeListService MalService { get; }

        public AnnouncementService AnnouncementService { get; }

        public UpdateService UpdateService { get; }

        public WebResourceImageProxy ImageProxy { get; }

        // In-memory cache of manga discovered in Source Catalog Feeds (id -> Manga model)

        private readonly ConcurrentDictionary<string, Manga> _discoveredManga = new(StringComparer.OrdinalIgnoreCase);

        private static readonly ConcurrentDictionary<string, int> _chapterTotalPagesCache = new(StringComparer.OrdinalIgnoreCase);

        private static readonly ConcurrentDictionary<long, int> _mangaLastTotalPagesCache = new();

        private static readonly ConcurrentDictionary<string, long> _chapterLastPageReadCache = new(StringComparer.OrdinalIgnoreCase);

        private DateTime _lastDownloadEventPush = DateTime.MinValue;

        private int _isSyncingLibrary = 0;

        private static readonly (string Bg, string Primary, string Secondary)[] CoverPalettes =

        {

            ("#071426", "#0066CC", "#38BDF8"),

            ("#0F172A", "#2563EB", "#60A5FA"),

            ("#111827", "#0284C7", "#7DD3FC"),

            ("#081C24", "#0D9488", "#2DD4BF"),

            ("#17153B", "#4F46E5", "#818CF8"),

            ("#1E1B4B", "#6366F1", "#A5B4FC")

        };

        public BackendIpcController(Window ownerWindow, Action<string> sendToWebUi)

        {

            _ownerWindow = ownerWindow;

            _dispatcher = ownerWindow.Dispatcher;

            _sendToWebUi = sendToWebUi;

            using (var initDb = new MangaDbContext())

            {

                initDb.Database.EnsureCreated();

                MangaDbContext.EnsureMangaColumnsExist(initDb);

            }

            SettingsService = new SettingsService();
            JsMangaSource.SelectedLanguage = string.Equals(SettingsService.MangaDexLanguage, "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en";

            NetworkService = new NetworkService(SettingsService);

            SourceManager = new SourceManager();

            SourceStatusService = new SourceStatusService(SourceManager, SettingsService, NetworkService);

            ExtensionRepoService = new ExtensionRepositoryService(SourceManager, SettingsService, SourceStatusService);

            LibraryService = new LibraryService();

            DownloadService = new DownloadService(SourceManager, LibraryService, NetworkService);

            BackupService = new BackupService();

            MalService = new MyAnimeListService(SettingsService);

            AnnouncementService = new AnnouncementService(SettingsService, NetworkService);

            UpdateService = new UpdateService();

            ImageProxy = new WebResourceImageProxy(_dispatcher, NetworkService, SourceManager, SettingsService);

            // Wire real-time events to WebUI

            AnnouncementService.NewAnnouncementDetected += (_, list) =>
            {
                PushEvent("event:announcements-updated", new
                {
                    announcements = MapAnnouncementsToDtos(list),
                    hasUnread = AnnouncementService.HasUnreadAnnouncements(),
                    isNewAlert = true
                });
            };

            AnnouncementService.AnnouncementsUpdated += (_, list) =>
            {
                PushEvent("event:announcements-updated", new
                {
                    announcements = MapAnnouncementsToDtos(list),
                    hasUnread = AnnouncementService.HasUnreadAnnouncements(),
                    isNewAlert = false
                });
            };

            UpdateService.UpdateAvailableDetected += (_, info) =>
            {
                PushEvent("event:app-update-available", new
                {
                    isUpdateAvailable = info.IsUpdateAvailable,
                    currentVersion = info.CurrentVersion,
                    latestVersion = info.LatestVersion,
                    downloadUrl = info.DownloadUrl,
                    releaseNotes = info.ReleaseNotes,
                    publishedAt = info.PublishedAt
                });
            };

            AnnouncementService.StartRealtimeMonitoring(15);
            if (SettingsService.CheckAppUpdateOnStart)
            {
                UpdateService.StartRealtimeMonitoring(60);
            }

            if (MalService.IsConnected && string.IsNullOrWhiteSpace(SettingsService.MalUsername))
            {
                _ = Task.Run(async () => await MalService.FetchUserProfileNameAsync());
            }

            if (SettingsService.MaxCacheSizeMb > 0)
            {
                _ = Task.Run(() => CleanupReaderCache(SettingsService.MaxCacheSizeMb));
            }

            SourceStatusService.SourceStatusUpdated += OnSourceStatusUpdated;
            SourceStatusService.SourceCheckProgress += (current, total) =>
            {
                PushEvent("event:source-check-progress", new
                {
                    active = current < total,
                    current,
                    total
                });
            };

            DownloadService.ProgressChanged += OnDownloadProgressChanged;

            DownloadService.StatusChanged += OnDownloadStatusChanged;

            DownloadService.QueueChanged += OnDownloadQueueChanged;

            _ = Task.Run(async () =>

            {

                await SourceIdMigrationService.RunIfNeededAsync(SourceManager);

            });

        }

        private void PushEvent(string type, object? payload)

        {

            try

            {

                var msg = new IpcResponseEnvelope

                {

                    Type = type,

                    Ok = true,

                    Payload = payload

                };

                var json = JsonSerializer.Serialize(msg);

                _dispatcher.InvokeAsync(() => _sendToWebUi(json));

            }

            catch (Exception ex)

            {

                LogService.Debug("IPC", $"Failed to push event {type}: {ex.Message}");

            }

        }

        private void OnSourceStatusUpdated(long sourceId, SourceStatus status, string tooltip)

        {

            PushEvent("event:source-status", new

            {

                sourceId,

                status = ExtensionRepositoryService.MapStatusToString(status),

                tooltip

            });

        }

        private void OnDownloadProgressChanged(object? sender, DownloadRequest req)

        {

            var now = DateTime.UtcNow;

            if ((now - _lastDownloadEventPush).TotalMilliseconds < 180 && req.Progress < 100)

                return;

            _lastDownloadEventPush = now;

            PushEvent("event:downloads-updated", GetDownloadsQueueList());

        }

        private void OnDownloadStatusChanged(object? sender, DownloadRequest req)

        {

            PushEvent("event:downloads-updated", GetDownloadsQueueList());

        }

        private void OnDownloadQueueChanged(object? sender, DownloadRequest req)

        {

            PushEvent("event:downloads-updated", GetDownloadsQueueList());

        }

        public async Task<bool> TryHandleMessageAsync(string rawJson)

        {

            IpcEnvelope? env;

            try

            {

                env = JsonSerializer.Deserialize<IpcEnvelope>(rawJson);

            }

            catch

            {

                return false;

            }

            if (env == null || string.IsNullOrWhiteSpace(env.Type))

                return false;

            if (env.Type.StartsWith("ui:", StringComparison.OrdinalIgnoreCase))

                return false; // Handled by MainWindow directly

            var reqId = env.RequestId;

            var type = env.Type;

            var payload = env.Payload;

            _ = Task.Run(async () =>

            {

                try

                {

                    object? result = await DispatchRequestAsync(type, payload);

                    SendResponse(type, reqId, true, result, null);

                }

                catch (Exception ex)

                {

                    LogService.Error("IPC", $"Error handling {type}", ex);

                    SendResponse(type, reqId, false, null, ex.Message);

                }

            });

            return true;

        }

        private void SendResponse(string type, string? requestId, bool ok, object? payload, string? error)

        {

            if (string.IsNullOrEmpty(requestId)) return;

            var resp = new IpcResponseEnvelope

            {

                Type = $"{type}:response",

                RequestId = requestId,

                Ok = ok,

                Error = error,

                Payload = payload

            };

            var json = JsonSerializer.Serialize(resp);

            _dispatcher.InvokeAsync(() => _sendToWebUi(json));

        }

        private async Task<object?> DispatchRequestAsync(string type, JsonElement? payload)

        {

            return type switch

            {

                "backend:bootstrap" => await BuildBootstrapAsync(),

                // 1. EKSTENSI (EXTENSIONS)

                "ext:list" => await GetExtensionsDtosAsync(GetBool(payload, "forceRefresh") || GetBool(payload, "refreshRemote")),

                "ext:install" => await HandleInstallExtensionAsync(GetString(payload, "id")),

                "ext:update" => await HandleInstallExtensionAsync(GetString(payload, "id")),

                "ext:uninstall" => await HandleUninstallExtensionAsync(GetString(payload, "id")),

                "ext:verify-cloudflare" => await HandleVerifyCloudflareAsync(GetString(payload, "id"), GetString(payload, "baseUrl")),

                "ext:install-manual" => await HandleManualPluginInstallAsync(),

                // 2. JELAJAHI SUMBER (BROWSE & SOURCE CATALOG FEED)

                "browse:refresh-status" => await HandleRefreshSourceStatusAsync(),

                "source:fetch-feed" => await HandleFetchSourceFeedAsync(payload),

                // 3. MANGA DETAIL & CHAPTER MANAGEMENT

                "manga:get-detail" => await HandleGetMangaDetailAsync(payload),

                "manga:toggle-library" => await HandleToggleLibraryAsync(payload),

                "manga:toggle-bookmark" => await HandleToggleBookmarkAsync(payload),

                "manga:mark-chapters" => await HandleMarkChaptersAsync(payload),

                // 4. READER (PEMBACA KOMIK)

                "reader:get-pages" => await HandleGetReaderPagesAsync(payload),

                "reader:save-progress" => await HandleSaveReaderProgressAsync(payload),

                // 5. PUSTAKA (LIBRARY) & KATEGORI

                "library:get-list" => await GetLibraryAndHistoryMangaDtosAsync(),

                "library:sync-all" => await HandleSyncLibraryAsync(GetBool(payload, "forceRefresh", true)),

                "library:get-categories" => await HandleGetCategoriesAsync(),

                "library:add-category" => await HandleAddCategoryAsync(GetString(payload, "name")),

                "library:delete-category" => await HandleDeleteCategoryAsync(GetLong(payload, "categoryId")),

                "library:set-manga-categories" => await HandleSetMangaCategoriesAsync(payload),

                "library:get-statistics" => await LibraryService.GetReadingStatisticsAsync(),

                // 6. PEMBARUAN (UPDATES)

                "updates:get-list" => await GetActivityUpdatesDtosAsync(),

                "updates:clear-all" => await HandleClearAllUpdatesAsync(),

                "updates:mark-all-read" => await HandleMarkAllUpdatesReadAsync(),

                // 7. RIWAYAT (HISTORY)

                "history:get-list" => await GetHistoryMangaDtosAsync(),

                "history:remove-item" => await HandleRemoveHistoryItemAsync(GetString(payload, "mangaId")),

                "history:clear-all" => await HandleClearAllHistoryAsync(),

                // 8. UNDUHAN (DOWNLOADS)

                "downloads:get-list" => GetDownloadsQueueList(),

                "downloads:enqueue" => await HandleEnqueueDownloadAsync(payload),

                "downloads:toggle-pause" => HandleTogglePauseDownload(payload),

                "downloads:pause-all" => HandlePauseAllDownloads(),

                "downloads:resume-all" => HandleResumeAllDownloads(),

                "downloads:cancel" => await HandleCancelDownloadAsync(payload),

                "downloads:clear-completed" => HandleClearCompletedDownloads(),

                "downloads:delete-chapter" => await HandleDeleteChapterDownloadAsync(payload),

                "downloads:delete-manga" => await HandleDeleteMangaDownloadsAsync(GetString(payload, "mangaId")),

                // 9. PENGATURAN, CADANGAN, PENGUMUMAN & MYANIMELIST

                "announcements:get-list" => await HandleGetAnnouncementsAsync(GetBool(payload, "force")),

                "announcements:mark-read" => HandleMarkAnnouncementRead(GetString(payload, "id")),

                "settings:update" => HandleUpdateSetting(payload),

                "settings:refresh-covers" => await HandleRefreshLibraryCoversAsync(),

                "settings:clear-cache" => await HandleClearImageCacheAsync(),

                "settings:clear-non-library" => await HandleClearNonLibraryCacheAsync(),

                "settings:export-logs" => await HandleExportLogsAsync(),

                "settings:reset-all" => HandleResetSettings(),

                "data:clear-all" => await HandleClearAllDataAsync(),

                "backup:create" => await HandleCreateBackupAsync(),

                "backup:restore" => await HandleRestoreBackupAsync(),

                "mal:toggle-connect" => await HandleMalToggleConnectAsync(),

                "mal:search" => await HandleMalSearchAsync(GetString(payload, "query")),

                "mal:get-track" => await HandleMalGetTrackAsync(payload),

                "mal:save-track" => await HandleMalSaveTrackAsync(payload),

                "mal:unbind-track" => await HandleMalUnbindTrackAsync(GetString(payload, "mangaId")),

                "app:check-update" => await HandleCheckAppUpdateAsync(),

                "app:install-update" => await HandleInstallAppUpdateAsync(GetString(payload, "downloadUrl")),

                "feedback:submit" => await HandleSubmitFeedbackAsync(payload),

                _ => null

            };

        }

        /* =========================================================================

         * BOOTSTRAP & MAPPING HELPERS

         * ========================================================================= */

        public async Task<AppBootstrapDto> BuildBootstrapAsync()

        {

            var extensionsTask = GetExtensionsDtosAsync(false);

            var mangasTask = GetLibraryAndHistoryMangaDtosAsync();

            var updatesTask = GetActivityUpdatesDtosAsync();

            var categoriesTask = LibraryService.GetCategoriesAsync();

            var announcementsTask = AnnouncementService.CachedAnnouncements.Count > 0
                ? Task.FromResult(AnnouncementService.CachedAnnouncements)
                : AnnouncementService.FetchAnnouncementsAsync(false);

            await Task.WhenAll(extensionsTask, mangasTask, updatesTask, categoriesTask, announcementsTask);

            var announcements = await announcementsTask;
            var categories = await categoriesTask;

            return new AppBootstrapDto

            {

                MangaList = await mangasTask,

                ActivityUpdates = await updatesTask,

                Downloads = GetDownloadsQueueList(),

                Extensions = await extensionsTask,

                Categories = MapCategoriesToDtos(categories),

                Settings = BuildSettingsDictionary(),

                Announcements = MapAnnouncementsToDtos(announcements),

                HasUnreadAnnouncements = AnnouncementService.HasUnreadAnnouncements()

            };

        }

        private static List<CategoryDto> MapCategoriesToDtos(IEnumerable<Category> list)
        {
            return list.Select(c => new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Color = c.Color,
                SortOrder = c.SortOrder,
                IsDefault = c.IsDefault,
                UpdateExcluded = c.UpdateExcluded
            }).ToList();
        }

        private static List<AnnouncementDto> MapAnnouncementsToDtos(IEnumerable<Announcement> list)
        {
            return list.Select(a => new AnnouncementDto
            {
                Id = a.Id,
                Title = a.Title,
                Body = a.Body,
                Date = a.Date,
                Type = a.Type,
                Url = a.Url,
                HasUrl = a.HasUrl,
                TypeDisplay = a.TypeDisplay,
                BadgeBackground = a.BadgeBackground
            }).ToList();
        }

        private bool IsEn => string.Equals(SettingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase);

        private string L(string id, string en) => IsEn ? en : id;

        private Dictionary<string, object?> BuildSettingsDictionary()
        {
            string lastBackupText = !string.IsNullOrWhiteSpace(SettingsService.LastBackupTime)
                ? (!string.IsNullOrWhiteSpace(SettingsService.LastBackupSize)
                    ? L($"Cadangan terakhir: {SettingsService.LastBackupTime} ({SettingsService.LastBackupSize})", $"Last backup: {SettingsService.LastBackupTime} ({SettingsService.LastBackupSize})")
                    : L($"Cadangan terakhir: {SettingsService.LastBackupTime}", $"Last backup: {SettingsService.LastBackupTime}"))
                : L("Siap dicadangkan (.yomicbackup)", "Ready to back up (.yomicbackup)");

            string malUser = MalService.IsConnected
                ? (!string.IsNullOrWhiteSpace(SettingsService.MalUsername) ? SettingsService.MalUsername : "MyAnimeList User")
                : "";

            return new Dictionary<string, object?>

            {

                ["defaultReaderMode"] = SettingsService.DefaultReaderMode switch

                {

                    1 => "single",

                    2 => "dual",

                    _ => "webtoon"

                },

                ["readingDirection"] = string.IsNullOrWhiteSpace(SettingsService.ReadingDirection) ? "ltr" : SettingsService.ReadingDirection,

                ["readerFitMode"] = string.IsNullOrWhiteSpace(SettingsService.ReaderFitMode) ? "fit-width" : SettingsService.ReaderFitMode,

                ["isDarkMode"] = SettingsService.IsDarkMode,

                ["autoDarkReader"] = SettingsService.AutoDarkReader,

                ["showNsfw"] = SettingsService.ShowNsfwSources,

                ["blurExplicitCovers"] = SettingsService.SecureScreen,

                ["dohProvider"] = SettingsService.DnsOverHttpsProvider switch

                {

                    1 => "Cloudflare (1.1.1.1)",

                    2 => "Google (8.8.8.8)",

                    3 => "AdGuard (94.140.14.14)",

                    _ => "Nonaktif"

                },

                ["downloadsFolder"] = DownloadPathService.BaseDirectory,

                ["dbSizeText"] = CalculateStorageSizeText(),

                ["lastBackupText"] = lastBackupText,

                ["isMalConnected"] = MalService.IsConnected,

                ["malConnectedUser"] = malUser,

                ["autoSyncTracker"] = SettingsService.AutoSyncTracker,

                ["preloadNextChapter"] = SettingsService.PreloadNextChapter,

                ["autoDownloadNextChapter"] = SettingsService.AutoDownloadNextChapter,

                ["skipFilteredChapters"] = SettingsService.SkipFilteredChapters,

                ["maxReaderCacheSize"] = SettingsService.MaxCacheSizeMb switch
                {
                    250 => "250MB",
                    1024 => "1GB",
                    2048 => "2GB",
                    _ => "500MB"
                },

                ["showUnreadBadges"] = SettingsService.ShowUnreadBadges,
                ["appLanguage"] = string.Equals(SettingsService.AppLanguage, "en", StringComparison.OrdinalIgnoreCase) ? "en" : "id",
                ["mangaDexLanguage"] = string.Equals(SettingsService.MangaDexLanguage, "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en",
                ["enableImageOptimization"] = SettingsService.EnableImageOptimization,
                ["enableAutoCropBorders"] = SettingsService.EnableAutoCropBorders,
                ["maxImageDimension"] = SettingsService.MaxImageDimension,
                ["enableImageSharpening"] = SettingsService.EnableImageSharpening,

                ["autoSyncStartup"] = SettingsService.UpdateOnStart,

                ["smartUpdate"] = SettingsService.UseSmartUpdate,

                ["backgroundUpdateInterval"] = SettingsService.AutoUpdateIntervalHours switch
                {
                    0 => "off",
                    6 => "6h",
                    12 => "12h",
                    24 => "24h",
                    _ => "12h"
                },

                ["isOfflineMode"] = SettingsService.IsOfflineMode,

                ["sourceStatusInterval"] = SettingsService.SourceStatusRefreshIntervalMinutes switch

                {

                    0 => "off",

                    15 => "15m",

                    30 => "30m",

                    60 => "1h",

                    _ => "30m"

                },

                ["customHotkeys"] = ParseCustomHotkeys(SettingsService.CustomHotkeysJson)

            };

        }

        private static Dictionary<string, string> ParseCustomHotkeys(string json)
        {
            if (!string.IsNullOrWhiteSpace(json))
            {
                try
                {
                    var map = JsonSerializer.Deserialize<Dictionary<string, string>>(json);
                    if (map != null) return map;
                }
                catch { }
            }
            return new Dictionary<string, string>();
        }

        private static string CalculateStorageSizeText()

        {

            try

            {

                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

                var yomicDir = Path.Combine(localAppData, "Yomic");

                if (!Directory.Exists(yomicDir)) return "0.0 MB";

                long bytes = 0;

                var coversDir = Path.Combine(yomicDir, "covers");

                if (Directory.Exists(coversDir))

                {

                    bytes += new DirectoryInfo(coversDir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);

                }

                var cacheDir = Path.Combine(yomicDir, "Cache");

                if (Directory.Exists(cacheDir))

                {

                    bytes += new DirectoryInfo(cacheDir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);

                }

                double mb = bytes / (1024.0 * 1024.0);

                return $"{mb:0.1} MB";

            }

            catch

            {

                return "0.0 MB";

            }

        }

        private static string MakeMangaFrontendId(Manga m)

        {

            if (m.Id > 0) return $"db-{m.Id}";

            var hashBytes = MD5.HashData(Encoding.UTF8.GetBytes($"{m.Source}:{m.Url}"));

            var hex = Convert.ToHexString(hashBytes).ToLowerInvariant()[..12];

            return $"src-{m.Source}-{hex}";

        }

        private MangaDto MapMangaToDto(Manga m, bool includeChapters = false)

        {

            var id = MakeMangaFrontendId(m);

            _discoveredManga[id] = m;

            var src = SourceManager.GetSource(m.Source);

            string sourceName = src?.Name?.Replace("Yomic:", "", StringComparison.OrdinalIgnoreCase).Trim() ?? "Sumber Komik";

            var chapters = m.Chapters?.ToList() ?? new List<Chapter>();

            var naturalComparer = new NaturalStringComparer(descending: true);

            var sortedChapters = chapters

                .OrderByDescending(c => c.ChapterNumber)

                .ThenBy(c => c.Name, naturalComparer)

                .ToList();

            int totalCh = sortedChapters.Count;

            int unreadCount = sortedChapters.Count(c => !c.Read);

            int downloadedCount = 0;

            foreach (var ch in sortedChapters)

            {

                bool isDl = ch.IsDownloaded || DownloadPathService.IsChapterDownloaded(m, ch);

                ch.IsDownloaded = isDl;

                if (isDl) downloadedCount++;

            }

            var lastReadChObj = sortedChapters.FirstOrDefault(c => c.Read || c.LastPageRead > 0)

                                ?? sortedChapters.LastOrDefault();

            float lastReadChNum = lastReadChObj != null && lastReadChObj.ChapterNumber > 0

                ? lastReadChObj.ChapterNumber

                : (totalCh > 0 ? 1 : 1);

            int lastReadTotalPages = 0;
            if (lastReadChObj != null && !string.IsNullOrEmpty(lastReadChObj.Url) && _chapterTotalPagesCache.TryGetValue(lastReadChObj.Url, out int cachedPages))
            {
                lastReadTotalPages = cachedPages;
            }
            else if (_mangaLastTotalPagesCache.TryGetValue(m.Id, out int cachedMangaPages))
            {
                lastReadTotalPages = cachedMangaPages;
            }

            int lastReadPage = 1;
            if (lastReadChObj != null && lastReadChObj.LastPageRead > 0)
            {
                long rawVal = lastReadChObj.LastPageRead;
                if (rawVal > 1000)
                {
                    if (lastReadTotalPages > 0)
                    {
                        lastReadPage = (int)Math.Clamp(Math.Ceiling((rawVal / 1_000_000.0) * lastReadTotalPages), 1, lastReadTotalPages);
                    }
                    else
                    {
                        lastReadPage = 1;
                    }
                }
                else
                {
                    lastReadPage = (int)rawVal;
                }
            }

            var genres = m.Genre?.Where(g => !string.IsNullOrWhiteSpace(g)).Distinct().ToList() ?? new List<string>();

            string type = DetectComicType(genres, sourceName, m.Url);

            string statusStr = m.Status == Manga.COMPLETED || m.Status == Manga.PUBLISHING_FINISHED

                ? "Completed"

                : "Ongoing";

            string category = "reading";

            if (statusStr == "Completed" && unreadCount == 0 && totalCh > 0)

                category = "completed";

            else if (totalCh > 0 && unreadCount == totalCh && m.LastViewed == 0)

                category = "plan";

            var (rating, cleanSynopsis) = ExtractRatingAndCleanDescription(m.Description);

            uint paletteHash = (uint)Math.Abs(m.Title?.GetHashCode() ?? 0);

            var pal = CoverPalettes[paletteHash % CoverPalettes.Length];

            var track = m.Tracks?.FirstOrDefault();

            var dto = new MangaDto

            {

                Id = id,

                DbId = m.Id,

                SourceId = m.Source,

                Url = m.Url,

                Title = string.IsNullOrWhiteSpace(m.Title) ? "Tanpa Judul" : m.Title,

                AltTitle = sourceName,

                Author = string.IsNullOrWhiteSpace(m.Author) ? "Unknown" : m.Author,

                Artist = string.IsNullOrWhiteSpace(m.Artist) ? (string.IsNullOrWhiteSpace(m.Author) ? "Studio" : m.Author) : m.Artist,

                Status = statusStr,

                Type = type,

                Rating = rating,

                UnreadCount = unreadCount,

                DownloadedCount = downloadedCount,

                TotalChapters = totalCh,

                LastReadChapter = lastReadChNum,

                LastReadChapterUrl = lastReadChObj?.Url ?? string.Empty,

                LastReadPage = lastReadPage,

                LastReadTotalPages = lastReadTotalPages,

                LastReadTimeAgo = FormatRelativeTime(m.LastViewed),

                LastViewedEpoch = m.LastViewed,

                LastUpdateEpoch = m.LastUpdate,

                SourceName = sourceName,

                Category = category,

                CategoryIds = m.Categories?.Select(c => c.Id).ToList() ?? new List<long>(),

                Genres = genres.Count > 0 ? genres : new List<string> { type, "Action" },

                Synopsis = string.IsNullOrWhiteSpace(cleanSynopsis)
                    ? L("Klik Segarkan untuk memuat sinopsis dan daftar bab terbaru dari sumber.", "Click Refresh to load the latest synopsis and chapter list from the source.")
                    : cleanSynopsis,

                CoverPalette = new[] { pal.Bg, pal.Primary, pal.Secondary },

                CoverAccent = pal.Primary,

                CoverUrl = WebResourceImageProxy.BuildCoverProxyUrl(m.Id, m.ThumbnailUrl, m.Source),

                RawCoverUrl = m.ThumbnailUrl ?? string.Empty,

                InLibrary = m.Favorite,

                MalTracked = track != null,

                MalId = track?.RemoteId ?? 0,

                MalTitle = track?.Title ?? string.Empty,

                MalStatus = track?.Status ?? "reading",

                MalScore = (int)(track?.Score ?? 9)

            };

            if (includeChapters || sortedChapters.Count > 0)

            {

                int fallbackNum = sortedChapters.Count;

                dto.Chapters = sortedChapters.Select((c, idx) =>

                {

                    float num = c.ChapterNumber > 0 ? c.ChapterNumber : Math.Max(1, fallbackNum - idx);

                    return new ChapterDto

                    {

                        Id = c.Id > 0 ? c.Id : idx + 1,

                        DbId = c.Id,

                        Number = (float)Math.Round(num, 2),

                        Title = CleanChapterSubTitle(c.Name, num),

                        Url = c.Url,

                        ReleaseDate = c.DateUpload > 0 ? FormatRelativeDate(c.DateUpload) : "Tersedia",

                        DateUpload = c.DateUpload,

                        IsRead = c.Read,

                        IsDownloaded = c.IsDownloaded,

                        IsBookmarked = c.Bookmark,

                        LastPageRead = (int)c.LastPageRead,

                        Scanlator = c.Scanlator

                    };

                }).ToList();

            }

            return dto;

        }

        private static string CleanChapterSubTitle(string rawName, float chNum)

        {

            if (string.IsNullOrWhiteSpace(rawName)) return string.Empty;

            var cleaned = Regex.Replace(rawName, @"^(?:Chapter|Ch\.?|Bab|Episode|Ep\.?)\s*[0-9]+(?:\.[0-9]+)?\s*[-:–—]?\s*", "", RegexOptions.IgnoreCase).Trim();

            if (string.Equals(cleaned, rawName, StringComparison.OrdinalIgnoreCase))

            {

                var numStr = chNum.ToString(CultureInfo.InvariantCulture);

                if (rawName.Contains(numStr)) return string.Empty;

            }

            return cleaned;

        }

        private static (double Rating, string CleanDescription) ExtractRatingAndCleanDescription(string? description)
        {
            if (string.IsNullOrWhiteSpace(description))
                return (0.0, string.Empty);

            var match = Regex.Match(description, @"Rating:\s*([0-9.]+)(/10)?", RegexOptions.IgnoreCase);
            if (match.Success && double.TryParse(match.Groups[1].Value, NumberStyles.Any, CultureInfo.InvariantCulture, out double val))
            {
                var cleaned = description.Replace(match.Value, "").Trim();
                cleaned = Regex.Replace(cleaned, @"\r?\n\r?\n+", "\n\n");
                return (Math.Clamp(val, 1.0, 10.0), cleaned);
            }

            return (0.0, description.Trim());
        }

        private static string DetectComicType(List<string> genres, string sourceName, string url)
        {
            if (genres.Any(g => g.Contains("Manhwa", StringComparison.OrdinalIgnoreCase))) return "Manhwa";
            if (genres.Any(g => g.Contains("Manhua", StringComparison.OrdinalIgnoreCase))) return "Manhua";
            if (genres.Any(g => g.Contains("Manga", StringComparison.OrdinalIgnoreCase))) return "Manga";

            if (sourceName.Contains("Manhwa", StringComparison.OrdinalIgnoreCase) || url.Contains("manhwa", StringComparison.OrdinalIgnoreCase))
                return "Manhwa";
            if (sourceName.Contains("Manhua", StringComparison.OrdinalIgnoreCase) || url.Contains("manhua", StringComparison.OrdinalIgnoreCase))
                return "Manhua";
            if (sourceName.Contains("Manga", StringComparison.OrdinalIgnoreCase) || url.Contains("manga", StringComparison.OrdinalIgnoreCase))
                return "Manga";

            return "Manga";
        }

        private static string FormatRelativeTime(long epochMs)

        {

            if (epochMs <= 0) return "Belum dibaca";

            try

            {

                var dt = DateTimeOffset.FromUnixTimeMilliseconds(epochMs).LocalDateTime;

                var diff = DateTime.Now - dt;

                if (diff.TotalMinutes < 1) return "Baru saja";

                if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes} menit lalu";

                if (diff.TotalHours < 24 && DateTime.Now.Date == dt.Date) return $"{(int)diff.TotalHours} jam lalu";

                if (DateTime.Now.Date.AddDays(-1) == dt.Date) return "Kemarin";

                if (diff.TotalDays < 7) return $"{(int)diff.TotalDays} hari lalu";

                return dt.ToString("dd MMM yyyy", new CultureInfo("id-ID"));

            }

            catch

            {

                return "Baru saja";

            }

        }

        private static string FormatRelativeDate(long epochMs)

        {

            if (epochMs <= 0) return "Tersedia";

            try

            {

                // Some sources return seconds instead of ms

                if (epochMs < 10_000_000_000L) epochMs *= 1000L;

                var dt = DateTimeOffset.FromUnixTimeMilliseconds(epochMs).LocalDateTime;

                var diff = DateTime.Now - dt;

                if (diff.TotalHours < 1) return "Baru saja";

                if (diff.TotalHours < 24) return $"{(int)diff.TotalHours} jam lalu";

                if (diff.TotalDays < 7) return $"{(int)diff.TotalDays} hari lalu";

                return dt.ToString("dd MMM yyyy", new CultureInfo("id-ID"));

            }

            catch

            {

                return "Tersedia";

            }

        }

        /* =========================================================================

         * 1. EKSTENSI (EXTENSIONS)

         * ========================================================================= */

        private async Task<List<ExtensionDto>> GetExtensionsDtosAsync(bool forceRefresh)

        {

            var list = await ExtensionRepoService.GetExtensionsListAsync(forceRefresh);

            var sources = SourceManager.GetSources();

            return list.Select(ext =>

            {

                var src = ext.SourceId != 0 ? sources.FirstOrDefault(s => s.Id == ext.SourceId) : null;

                var filterable = src as IFilterableMangaSource;

                return new ExtensionDto

                {

                    Id = ext.Id,

                    Pkg = ext.Pkg,

                    SourceId = ext.SourceId,

                    Name = ext.Name,

                    Lang = ext.Lang,

                    Version = ext.Version,

                    IsNsfw = ext.IsNsfw,

                    Installed = ext.Installed,

                    HasUpdate = ext.HasUpdate,

                    IsCloudflareProtected = ext.IsCloudflareProtected,

                    FileSizeText = ext.FileSizeText,

                    BaseUrl = ext.BaseUrl,

                    AccentColor = ext.AccentColor,

                    IconUrl = ext.IconUrl,

                    Status = ext.Status,

                    SupportsStatusFilter = filterable?.SupportsStatusFilter ?? false,

                    SupportsGenreFilter = filterable?.SupportsGenreFilter ?? false,

                    AvailableGenres = filterable?.AvailableGenres ?? new List<string>(),

                    SupportsFormatFilter = filterable?.SupportsFormatFilter ?? false,

                    AvailableFormats = filterable?.AvailableFormats ?? new List<string>()

                };

            }).ToList();

        }

        private async Task<List<ExtensionDto>> HandleInstallExtensionAsync(string id)

        {

            var (success, msg) = await ExtensionRepoService.InstallOrUpdateAsync(id, pct =>

            {

                PushEvent("event:ext-progress", new { id, progress = pct });

            });

            if (!success)
            {
                LogService.Error("BackendIpc", $"Failed to install extension {id}: {msg}");
            }

            return await GetExtensionsDtosAsync(false);

        }

        private async Task<List<ExtensionDto>> HandleUninstallExtensionAsync(string id)

        {

            ExtensionRepoService.UninstallExtension(id);

            return await GetExtensionsDtosAsync(false);

        }

        private async Task<object> HandleVerifyCloudflareAsync(string id, string baseUrl)

        {

            string targetUrl = baseUrl;

            if (string.IsNullOrWhiteSpace(targetUrl))

            {

                var exts = await ExtensionRepoService.GetExtensionsListAsync(false);

                targetUrl = exts.FirstOrDefault(e => e.Id == id)?.BaseUrl ?? string.Empty;

            }

            if (string.IsNullOrWhiteSpace(targetUrl))

            {

                return new { success = false, verified = false, message = "URL sumber tidak ditemukan." };

            }

            try

            {

                var (ua, cookies) = await CloudflareBypassService.Instance.SolveInteractiveAsync(targetUrl);

                bool solved = cookies != null && cookies.Count > 0;

                _ = SourceStatusService.CheckAllSourcesAsync();

                return new

                {

                    success = solved,

                    verified = solved,
                    message = solved
                        ? L($"Verifikasi Cloudflare untuk {targetUrl} berhasil!", $"Cloudflare verification for {targetUrl} succeeded!")
                        : L($"Sesi browser verifikasi {targetUrl} selesai.", $"Browser verification session for {targetUrl} finished.")
                };
            }
            catch (Exception ex)
            {
                return new { success = false, verified = false, message = L($"Gagal memverifikasi Cloudflare: {ex.Message}", $"Failed to verify Cloudflare: {ex.Message}") };
            }
        }

        private async Task<object> HandleManualPluginInstallAsync()
        {
            string? selectedFile = null;
            await _dispatcher.InvokeAsync(() =>
            {
                var dlg = new OpenFileDialog
                {
                    Title = L("Pilih Berkas Plugin Ekstensi Yomic (.js)", "Select Yomic Extension Plugin File (.js)"),
                    Filter = "JavaScript Plugin (*.js)|*.js"
                };
                if (dlg.ShowDialog(_ownerWindow) == true)
                {
                    selectedFile = dlg.FileName;
                }
            });

            if (string.IsNullOrWhiteSpace(selectedFile))
            {
                return new { success = false, cancelled = true, message = L("Pemasangan dibatalkan.", "Installation cancelled.") };
            }

            var src = SourceManager.InstallPlugin(selectedFile);
            var extensions = await GetExtensionsDtosAsync(false);
            string installMsg = L("Berkas plugin .js tidak valid.", "Invalid .js plugin file.");
            if (src != null)
            {
                if (src.IsNsfw && !SettingsService.ShowNsfwSources)
                {
                    installMsg = L(
                        $"Plugin {src.Name} (18+) berhasil dipasang. Aktifkan 'Tampilkan Sumber Dewasa (18+)' di Pengaturan untuk menampilkannya.",
                        $"Plugin {src.Name} (18+) installed. Enable 'Show Adult Sources (18+)' in Settings to display it.");
                }
                else
                {
                    installMsg = L($"Plugin {src.Name} berhasil dipasang.", $"Plugin {src.Name} installed.");
                }
            }

            return new
            {
                success = src != null,
                cancelled = false,
                message = installMsg,
                extensions
            };

        }

        /* =========================================================================

         * 2. JELAJAHI SUMBER (BROWSE & SOURCE CATALOG FEED)

         * ========================================================================= */

        private async Task<List<ExtensionDto>> HandleRefreshSourceStatusAsync()

        {

            await SourceStatusService.CheckAllSourcesAsync();

            return await GetExtensionsDtosAsync(false);

        }

        private async Task<SourceFeedResultDto> HandleFetchSourceFeedAsync(JsonElement? payload)

        {

            long sourceId = GetLong(payload, "sourceId");

            string extId = GetString(payload, "extId");

            string pkg = GetString(payload, "pkg");

            string sourceName = GetString(payload, "sourceName");

            int page = Math.Max(1, GetInt(payload, "page", 1));

            string sort = GetString(payload, "sort", "popular");

            string query = GetString(payload, "query").Trim();

            string statusFilter = GetString(payload, "status", "all");

            string typeFilter = GetString(payload, "type", "all");

            string genreFilter = GetString(payload, "genre", "Semua");

            IMangaSource? source = null;

            // 1. Try matching by sourceName / pkg / extId first (exact string match, immune to float rounding)

            if (!string.IsNullOrEmpty(sourceName))

            {

                source = SourceManager.GetSourceByName(sourceName);

            }

            if (source == null && !string.IsNullOrEmpty(pkg))

            {

                source = SourceManager.GetSourceByName(pkg);

            }

            if (source == null && !string.IsNullOrEmpty(extId))

            {

                source = SourceManager.GetSourceByName(extId);

            }

            // 2. Try matching by sourceId (with +/- 2048 float precision loss tolerance)

            if (source == null && sourceId != 0)

            {

                source = SourceManager.GetSource(sourceId);

            }

            // 3. Try from extension repository catalog

            if (source == null && (!string.IsNullOrEmpty(extId) || !string.IsNullOrEmpty(pkg)))

            {

                var exts = await ExtensionRepoService.GetExtensionsListAsync(false);

                var matchedExt = exts.FirstOrDefault(e =>

                    string.Equals(e.Id, extId, StringComparison.OrdinalIgnoreCase) ||

                    string.Equals(e.Pkg, pkg, StringComparison.OrdinalIgnoreCase) ||

                    (!string.IsNullOrEmpty(sourceName) && string.Equals(e.Name, sourceName, StringComparison.OrdinalIgnoreCase)));

                if (matchedExt != null && matchedExt.SourceId != 0)

                {

                    source = SourceManager.GetSource(matchedExt.SourceId);

                }

            }

            if (source == null)
            {
                LogService.Warning("BackendIpc", $"[source:fetch-feed] No matching source found for sourceId={sourceId}, extId='{extId}', pkg='{pkg}', sourceName='{sourceName}'");
                return new SourceFeedResultDto { Page = page, TotalPages = 1, HasMore = false };
            }

            if (!SettingsService.ShowNsfwSources && (source.IsNsfw || ExtensionRepositoryService.IsAdultIndicator(source.Name, source.Description, source.BaseUrl)))
            {
                LogService.Info("BackendIpc", $"[source:fetch-feed] Blocked NSFW source '{source.Name}' because ShowNsfwSources is disabled.");
                return new SourceFeedResultDto { SourceId = source.Id, Page = page, TotalPages = 1, HasMore = false, Items = new List<MangaDto>() };
            }

            int statusCode = statusFilter.Equals("Ongoing", StringComparison.OrdinalIgnoreCase)

                ? 1

                : statusFilter.Equals("Completed", StringComparison.OrdinalIgnoreCase)

                    ? 2

                    : 0;

            List<string>? genresList = !string.IsNullOrWhiteSpace(genreFilter) && !genreFilter.Equals("Semua", StringComparison.OrdinalIgnoreCase)

                ? new List<string> { genreFilter }

                : null;

            List<string>? formatsList = !string.IsNullOrWhiteSpace(typeFilter) && !typeFilter.Equals("all", StringComparison.OrdinalIgnoreCase)

                ? new List<string> { typeFilter }

                : null;

            string reqMdLang = GetString(payload, "mangaDexLanguage");
            if (!string.IsNullOrWhiteSpace(reqMdLang))
            {
                string normMd = string.Equals(reqMdLang.Trim(), "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en";
                if (!string.Equals(SettingsService.MangaDexLanguage, normMd, StringComparison.OrdinalIgnoreCase))
                {
                    SettingsService.MangaDexLanguage = normMd;
                    SettingsService.Save();
                }
                JsMangaSource.SelectedLanguage = normMd;
            }
            else
            {
                JsMangaSource.SelectedLanguage = string.Equals(SettingsService.MangaDexLanguage, "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en";
            }

            List<Manga> rawItems;

            int totalPages = page;

            if (!string.IsNullOrWhiteSpace(query))
            {
                rawItems = await source.GetSearchMangaAsync(query, page);
                totalPages = rawItems.Count > 0 ? page + 1 : page;
            }
            else if (source is IFilterableMangaSource filterableSrc)
            {
                if (statusCode != 0 || genresList != null || formatsList != null)
                {
                    var res = await filterableSrc.GetMangaListAsync(page, statusCode, genresList, formatsList, sort);
                    rawItems = res.Items;
                    totalPages = res.TotalPages;
                }
                else if (sort.Equals("latest", StringComparison.OrdinalIgnoreCase))
                {
                    var res = await filterableSrc.GetLatestMangaAsync(page);
                    rawItems = res.Items;
                    totalPages = res.TotalPages;
                }
                else
                {
                    var res = await filterableSrc.GetMangaListAsync(page);
                    rawItems = res.Items;
                    totalPages = res.TotalPages;
                }
            }
            else
            {
                rawItems = await source.GetPopularMangaAsync(page);
                totalPages = rawItems.Count > 0 ? page + 1 : page;
            }

            if (!SettingsService.ShowNsfwSources)
            {
                rawItems = rawItems.Where(m =>
                {
                    if (ExtensionRepositoryService.IsAdultIndicator(m.Title, m.Description, m.Url)) return false;
                    if (m.Genre != null && m.Genre.Any(g => ExtensionRepositoryService.IsAdultIndicator(g))) return false;
                    return true;
                }).ToList();
            }

            // Cross-reference with SQLite DB so existing Library/History manga keep their DB ID and InLibrary status

            using var db = new MangaDbContext();

            var urls = rawItems.Select(m => m.Url).Where(u => !string.IsNullOrEmpty(u)).ToList();

            var dbMatches = await db.Mangas

                .Include(m => m.Chapters)

                .Where(m => m.Source == source.Id && urls.Contains(m.Url))

                .ToDictionaryAsync(m => m.Url, StringComparer.OrdinalIgnoreCase);

            var dtos = new List<MangaDto>();

            foreach (var item in rawItems)

            {

                item.Source = source.Id;

                if (dbMatches.TryGetValue(item.Url, out var dbManga))

                {

                    if (string.IsNullOrEmpty(dbManga.ThumbnailUrl) && !string.IsNullOrEmpty(item.ThumbnailUrl))

                    {

                        dbManga.ThumbnailUrl = item.ThumbnailUrl;

                    }

                    dtos.Add(MapMangaToDto(dbManga, includeChapters: false));

                }

                else

                {

                    dtos.Add(MapMangaToDto(item, includeChapters: false));

                }

            }

            return new SourceFeedResultDto

            {

                SourceId = source.Id,

                Page = page,

                TotalPages = Math.Max(page, totalPages),

                HasMore = page < totalPages || (rawItems.Count >= 12 && source.IsHasMorePages),

                Items = dtos

            };

        }

        /* =========================================================================

         * 3. MANGA DETAIL & CHAPTER MANAGEMENT

         * ========================================================================= */

        private async Task<Manga?> ResolveMangaAsync(string mangaId, string? url = null, long sourceId = 0)

        {

            using var db = new MangaDbContext();

            // 1. Direct DB lookup by "db-{id}"

            if (!string.IsNullOrEmpty(mangaId) && mangaId.StartsWith("db-", StringComparison.OrdinalIgnoreCase) &&

                long.TryParse(mangaId.AsSpan(3), out long dbId))

            {

                var byId = await db.Mangas

                    .Include(m => m.Chapters)

                    .Include(m => m.Categories)

                    .Include(m => m.Tracks)

                    .FirstOrDefaultAsync(m => m.Id == dbId);

                if (byId != null) return byId;

            }

            // 2. Check in-memory discovered manga cache (from feed or search)

            if (_discoveredManga.TryGetValue(mangaId, out var cached))

            {

                url ??= cached.Url;

                if (sourceId == 0) sourceId = cached.Source;

                // Check if this specific manga for this specific source exists in DB

                if (!string.IsNullOrEmpty(cached.Url))

                {

                    var byUrlAndSource = await db.Mangas

                        .Include(m => m.Chapters)

                        .Include(m => m.Categories)

                        .Include(m => m.Tracks)

                        .FirstOrDefaultAsync(m => m.Url == cached.Url && (m.Source == cached.Source || Math.Abs(m.Source - cached.Source) < 2048));

                    if (byUrlAndSource != null) return byUrlAndSource;

                }

                // If not in DB yet, return the cached manga directly (never let title collision hijack it!)

                return cached;

            }

            // 3. Lookup by URL if provided

            if (!string.IsNullOrEmpty(url))

            {

                var byUrlQuery = db.Mangas

                    .Include(m => m.Chapters)

                    .Include(m => m.Categories)

                    .Include(m => m.Tracks);

                var byUrl = sourceId != 0

                    ? await byUrlQuery.FirstOrDefaultAsync(m => m.Url == url && (m.Source == sourceId || Math.Abs(m.Source - sourceId) < 2048))

                    : null;

                byUrl ??= await byUrlQuery.FirstOrDefaultAsync(m => m.Url == url);

                if (byUrl != null) return byUrl;

            }

            // 4. Last-resort fallback match by Title or slug in DB (ONLY if cached was null and source matches)

            if (!string.IsNullOrEmpty(mangaId) && !mangaId.StartsWith("src-", StringComparison.OrdinalIgnoreCase))

            {

                var normalizedId = mangaId.Replace("-", " ").Trim();

                var byTitleOrSlug = await db.Mangas

                    .Include(m => m.Chapters)

                    .Include(m => m.Categories)

                    .Include(m => m.Tracks)

                    .FirstOrDefaultAsync(m =>

                        (sourceId == 0 || m.Source == sourceId || Math.Abs(m.Source - sourceId) < 2048) &&

                        ((m.Title != null && (m.Title == mangaId || m.Title.ToLower() == normalizedId.ToLower())) ||

                         (m.Url != null && (m.Url.Contains(mangaId) || m.Url.Trim('/').EndsWith(mangaId)))));

                if (byTitleOrSlug != null) return byTitleOrSlug;

            }

            return null;

        }

        private IMangaSource? ResolveSourceSafely(long sourceId, string? url = null, string? chapterUrl = null, Manga? manga = null, string? sourceName = null)

        {

            // 1. Try by sourceName if provided

            if (!string.IsNullOrEmpty(sourceName))

            {

                var byName = SourceManager.GetSourceByName(sourceName);

                if (byName != null) return byName;

            }

            var source = sourceId != 0 ? SourceManager.GetSource(sourceId) : null;

            if (source != null) return source;

            var allSources = SourceManager.GetSources();

            if (allSources.Count == 0) return null;

            // 2. Try legacy ID map

            if (sourceId == 3639673976007021568L)

            {

                source = allSources.FirstOrDefault(s => s.Name.Contains("Kiryuu", StringComparison.OrdinalIgnoreCase));

            }

            else if (sourceId == -3406828676302900168L)

            {

                source = allSources.FirstOrDefault(s => s.Name.Contains("Komiku", StringComparison.OrdinalIgnoreCase));

            }

            // 3. Try URL match

            string? checkUrl = !string.IsNullOrEmpty(chapterUrl) ? chapterUrl : (!string.IsNullOrEmpty(url) ? url : manga?.Url);

            if (source == null && !string.IsNullOrEmpty(checkUrl))

            {

                source = allSources.FirstOrDefault(s =>

                    !string.IsNullOrEmpty(s.BaseUrl) &&

                    (checkUrl.Contains(s.BaseUrl, StringComparison.OrdinalIgnoreCase) ||

                     (Uri.TryCreate(s.BaseUrl, UriKind.Absolute, out var u) && checkUrl.Contains(u.Host, StringComparison.OrdinalIgnoreCase))));

                if (source == null)

                {

                    if (checkUrl.Contains("/ch/", StringComparison.OrdinalIgnoreCase) || checkUrl.Contains("komiku", StringComparison.OrdinalIgnoreCase))

                    {

                        source = allSources.FirstOrDefault(s => s.Name.Contains("Komiku", StringComparison.OrdinalIgnoreCase));

                    }

                    else if (checkUrl.Contains("kiryuu", StringComparison.OrdinalIgnoreCase))

                    {

                        source = allSources.FirstOrDefault(s => s.Name.Contains("Kiryuu", StringComparison.OrdinalIgnoreCase));

                    }

                }

            }

            if (source != null && manga != null && manga.Source != source.Id)

            {

                manga.Source = source.Id;

                if (manga.Id > 0)

                {

                    _ = Task.Run(async () =>

                    {

                        try

                        {

                            using var db = new MangaDbContext();

                            var dbManga = await db.Mangas.FindAsync(manga.Id);

                            if (dbManga != null)

                            {

                                dbManga.Source = source.Id;

                                await db.SaveChangesAsync();

                            }

                        }

                        catch { }

                    });

                }

            }

            return source;

        }

        private async Task<MangaDto?> HandleGetMangaDetailAsync(JsonElement? payload)

        {

            string mangaId = GetString(payload, "mangaId");

            string url = GetString(payload, "url");

            long sourceId = GetLong(payload, "sourceId");

            string sourceName = GetString(payload, "sourceName");

            bool forceRefresh = GetBool(payload, "forceRefresh");

            var manga = await ResolveMangaAsync(mangaId, url, sourceId);

            if (manga == null) return null;

            JsMangaSource.SelectedLanguage = string.Equals(SettingsService.MangaDexLanguage, "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en";
            var source = ResolveSourceSafely(sourceId != 0 ? sourceId : manga.Source, manga.Url, manga: manga, sourceName: sourceName);
            bool isMangaDex = (source?.Name?.Contains("MangaDex", StringComparison.OrdinalIgnoreCase) ?? false) ||
                              sourceName.Contains("MangaDex", StringComparison.OrdinalIgnoreCase) ||
                              (manga.Url != null && manga.Url.StartsWith("/title/", StringComparison.OrdinalIgnoreCase));

            bool needsRemoteFetch = forceRefresh || isMangaDex || manga.Chapters == null || manga.Chapters.Count == 0 || string.IsNullOrWhiteSpace(manga.Description);

            if (needsRemoteFetch && !SettingsService.IsOfflineMode)

            {

                // source already resolved above

                if (source != null && !string.IsNullOrEmpty(manga.Url))

                {

                    try

                    {

                        var detailsTask = source.GetMangaDetailsAsync(manga.Url);

                        var chaptersTask = source.GetChapterListAsync(manga.Url);

                        await Task.WhenAll(detailsTask, chaptersTask);

                        var details = await detailsTask;

                        var remoteChapters = await chaptersTask;

                        if (details != null)

                        {

                            if (!string.IsNullOrWhiteSpace(details.Title)) manga.Title = details.Title;

                            if (!string.IsNullOrWhiteSpace(details.Author)) manga.Author = details.Author;

                            if (!string.IsNullOrWhiteSpace(details.Artist)) manga.Artist = details.Artist;

                            if (!string.IsNullOrWhiteSpace(details.Description)) manga.Description = details.Description;

                            if (details.Genre != null && details.Genre.Count > 0) manga.Genre = details.Genre;

                            if (details.Status > 0) manga.Status = details.Status;

                            if (!string.IsNullOrWhiteSpace(details.ThumbnailUrl)) manga.ThumbnailUrl = details.ThumbnailUrl;

                            manga.Initialized = true;

                        }

                        if (remoteChapters != null && remoteChapters.Count > 0)

                        {

                            if (manga.Id > 0)

                            {

                                using (var db = new MangaDbContext())

                                {

                                    var dbManga = await db.Mangas.FindAsync(manga.Id);

                                    if (dbManga != null)

                                    {

                                        if (!string.IsNullOrWhiteSpace(manga.Title)) dbManga.Title = manga.Title;

                                        if (!string.IsNullOrWhiteSpace(manga.Author)) dbManga.Author = manga.Author;

                                        if (!string.IsNullOrWhiteSpace(manga.Artist)) dbManga.Artist = manga.Artist;

                                        if (!string.IsNullOrWhiteSpace(manga.Description)) dbManga.Description = manga.Description;

                                        if (manga.Genre != null && manga.Genre.Count > 0) dbManga.Genre = manga.Genre;

                                        if (manga.Status > 0) dbManga.Status = manga.Status;

                                        if (!string.IsNullOrWhiteSpace(manga.ThumbnailUrl)) dbManga.ThumbnailUrl = manga.ThumbnailUrl;

                                        dbManga.Initialized = true;

                                        await db.SaveChangesAsync();

                                    }

                                }

                                await LibraryService.UpdateChaptersAsync(manga, remoteChapters, isInitialLoad: !manga.Favorite && !isMangaDex);

                                manga = await ResolveMangaAsync($"db-{manga.Id}") ?? manga;

                            }

                            else

                            {

                                // Ensure it's saved in DB as non-favorite so chapters and reading progress persist seamlessly

                                using (var db = new MangaDbContext())

                                {

                                    var existing = await db.Mangas.Include(m => m.Chapters)

                                        .FirstOrDefaultAsync(m => m.Url == manga.Url && m.Source == manga.Source);

                                    if (existing == null)

                                    {

                                        manga.LastUpdate = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                                        db.Mangas.Add(manga);

                                        await db.SaveChangesAsync();

                                    }

                                    else

                                    {

                                        manga.Id = existing.Id;

                                    }

                                }

                                await LibraryService.UpdateChaptersAsync(manga, remoteChapters, isInitialLoad: !isMangaDex);

                                manga = await ResolveMangaAsync($"db-{manga.Id}") ?? manga;

                            }

                        }

                    }

                    catch (Exception ex)

                    {

                        LogService.Warning("MangaDetail", $"Failed to fetch remote details for {manga.Title}: {ex.Message}");

                    }

                }

            }

            return MapMangaToDto(manga, includeChapters: true);

        }

        private async Task<object?> HandleToggleLibraryAsync(JsonElement? payload)

        {

            string mangaId = GetString(payload, "mangaId");

            var manga = await ResolveMangaAsync(mangaId);

            if (manga == null) return null;

            if (manga.Favorite)

            {

                await LibraryService.RemoveFromLibraryAsync(manga, deleteFiles: false);

                manga.Favorite = false;

            }

            else

            {

                await LibraryService.AddToLibraryAsync(manga);

                if (manga.Chapters != null && manga.Chapters.Count > 0)

                {

                    await LibraryService.UpdateChaptersAsync(manga, manga.Chapters.ToList(), isInitialLoad: true);

                }

                manga.Favorite = true;

            }

            var updated = await ResolveMangaAsync($"db-{manga.Id}", manga.Url, manga.Source) ?? manga;

            return MapMangaToDto(updated, includeChapters: true);

        }

        private async Task<object?> HandleToggleBookmarkAsync(JsonElement? payload)

        {

            string mangaId = GetString(payload, "mangaId");

            string chapterUrl = GetString(payload, "chapterUrl");

            float chapterNumber = GetFloat(payload, "chapterNumber");

            var manga = await ResolveMangaAsync(mangaId);

            if (manga == null) return null;

            var matchedCh = manga.Chapters?.FirstOrDefault(c =>

                (!string.IsNullOrEmpty(chapterUrl) && string.Equals(c.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)) ||

                Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f);

            if (string.IsNullOrEmpty(chapterUrl))

            {

                chapterUrl = matchedCh?.Url ?? string.Empty;

            }

            bool hasExplicitBookmark = payload.HasValue && payload.Value.ValueKind == JsonValueKind.Object &&

                                       payload.Value.TryGetProperty("isBookmarked", out _);

            bool isBookmarked = hasExplicitBookmark

                ? GetBool(payload, "isBookmarked")

                : !(matchedCh?.Bookmark ?? false);

            if (!string.IsNullOrEmpty(chapterUrl))

            {

                await LibraryService.SetChapterBookmarkStatusAsync(

                    chapterUrl,

                    isBookmarked,

                    manga.Source,

                    manga.Url,

                    $"Chapter {chapterNumber}",

                    chapterNumber);

            }

            return new { ok = true, isBookmarked };

        }

        private async Task<MangaDto?> HandleMarkChaptersAsync(JsonElement? payload)
        {
            string mangaId = GetString(payload, "mangaId");
            string mode = GetString(payload, "mode");
            float chapterNumber = GetFloat(payload, "chapterNumber");
            string mangaUrl = GetString(payload, "mangaUrl");
            long sourceId = GetLong(payload, "sourceId");

            var manga = await ResolveMangaAsync(mangaId, mangaUrl, sourceId);
            if (manga == null) return null;

            if (mode == "all-read")
            {
                await LibraryService.MarkChaptersAsReadAsync(manga);
            }
            else if (mode == "all-unread")
            {
                await LibraryService.MarkChaptersAsUnreadAsync(manga);
            }
            else if (mode == "before-read")
            {
                await LibraryService.MarkChaptersBeforeAsReadAsync(manga, chapterNumber);
            }
            else if (mode == "single-read" || mode == "single-unread")
            {
                bool isRead = mode == "single-read";
                string chUrl = GetString(payload, "chapterUrl");
                if (string.IsNullOrEmpty(chUrl))
                {
                    var targetCh = manga.Chapters?.FirstOrDefault(c => Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f);
                    chUrl = targetCh?.Url ?? string.Empty;
                }
                if (!string.IsNullOrEmpty(chUrl))
                {
                    await LibraryService.SetChapterReadStatusAsync(
                        chUrl,
                        isRead,
                        manga.Source,
                        manga.Url,
                        $"Chapter {chapterNumber}",
                        chapterNumber);
                }
            }

            var refreshed = await ResolveMangaAsync($"db-{manga.Id}", manga.Url, manga.Source) ?? manga;
            return MapMangaToDto(refreshed, includeChapters: true);
        }

        /* =========================================================================

         * 4. READER (PEMBACA KOMIK)

         * ========================================================================= */

        private async Task<ReaderPagesResultDto> HandleGetReaderPagesAsync(JsonElement? payload)

        {

            string mangaId = GetString(payload, "mangaId");

            string chapterUrl = GetString(payload, "chapterUrl");

            float chapterNumber = GetFloat(payload, "chapterNumber", 1);

            string mangaUrl = GetString(payload, "mangaUrl");

            long sourceId = GetLong(payload, "sourceId");

            string sourceName = GetString(payload, "sourceName");

            bool forceRefresh = GetBool(payload, "forceRefresh", false);

            var manga = await ResolveMangaAsync(mangaId, mangaUrl, sourceId);

            long resolvedSourceId = sourceId != 0 ? sourceId : manga?.Source ?? 0;

            var source = ResolveSourceSafely(resolvedSourceId, manga?.Url ?? mangaUrl, chapterUrl, manga, sourceName);

            if (source != null) resolvedSourceId = source.Id;

            // If manga was resolved but chapters are empty, dynamically fetch chapters from source

            if (manga != null && (manga.Chapters == null || manga.Chapters.Count == 0) &&

                source != null && !string.IsNullOrEmpty(manga.Url) && !SettingsService.IsOfflineMode)

            {

                try

                {

                    var fetchedChapters = await source.GetChapterListAsync(manga.Url);

                    if (fetchedChapters != null && fetchedChapters.Count > 0)

                    {

                        manga.Chapters = fetchedChapters;

                        if (manga.Id > 0)

                        {

                            using var db = new MangaDbContext();

                            var dbManga = await db.Mangas.Include(m => m.Chapters).FirstOrDefaultAsync(m => m.Id == manga.Id);

                            if (dbManga != null)

                            {

                                await LibraryService.UpdateChaptersAsync(dbManga, fetchedChapters.ToList(), isInitialLoad: false);

                            }

                        }

                    }

                }

                catch { }

            }

            Chapter? chapter = null;

            if (manga?.Chapters != null && manga.Chapters.Count > 0)

            {

                chapter = manga.Chapters.FirstOrDefault(c =>

                    (!string.IsNullOrEmpty(chapterUrl) && string.Equals(c.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)) ||

                    Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f);

                if (chapter == null)

                {

                    chapter = manga.Chapters.FirstOrDefault(c => Math.Abs(c.ChapterNumber - chapterNumber) < 1.0f) ?? manga.Chapters.First();

                }

            }

            string targetChUrl = chapter?.Url ?? chapterUrl;

            string chTitle = chapter?.Name ?? $"Chapter {chapterNumber}";

            string frontendMangaId = manga != null ? MakeMangaFrontendId(manga) : mangaId;

            long savedRaw = 0;
            if (!string.IsNullOrEmpty(targetChUrl))
            {
                savedRaw = await LibraryService.GetLastPageReadRawAsync(targetChUrl, manga?.Id ?? 0, chapterNumber);
            }
            if (savedRaw <= 0 && chapter != null && chapter.LastPageRead > 0)
            {
                savedRaw = chapter.LastPageRead;
            }
            if (savedRaw <= 0)
            {
                if (!string.IsNullOrEmpty(targetChUrl) && _chapterLastPageReadCache.TryGetValue(targetChUrl, out long cachedRaw))
                {
                    savedRaw = cachedRaw;
                }
                else if (_chapterLastPageReadCache.TryGetValue($"{mangaId}_{chapterNumber}", out long cachedNum))
                {
                    savedRaw = cachedNum;
                }
                else if (!string.IsNullOrEmpty(mangaUrl) && _chapterLastPageReadCache.TryGetValue($"{mangaUrl}_{chapterNumber}", out long cachedUrlNum))
                {
                    savedRaw = cachedUrlNum;
                }
            }

            double savedScrollPercent = 0;
            int savedPage = 1;
            if (savedRaw > 1000) // Percentage (Webtoon, exact Yomic v1 formula)
            {
                savedScrollPercent = savedRaw / 1_000_000.0;
            }
            else if (savedRaw > 0) // Page index (Paged/Dual)
            {
                savedPage = (int)savedRaw;
            }

            // Record LastViewed immediately when opening Reader so History (Riwayat) stays up-to-date

            if (manga != null && manga.Id > 0)

            {

                try

                {

                    using var db = new MangaDbContext();

                    var dbManga = await db.Mangas.FindAsync(manga.Id);

                    if (dbManga != null)

                    {

                        dbManga.LastViewed = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                        await db.SaveChangesAsync();

                    }

                }

                catch { }

            }

            // 1. Check Offline Downloaded Files First

            if (manga != null && chapter != null)

            {

                var localDir = DownloadPathService.FindCompletedChapterDirectory(manga, chapter);

                if (!string.IsNullOrEmpty(localDir))

                {

                    var localFiles = DownloadPathService.GetReadableFiles(localDir);

                    if (localFiles.Count > 0)
                    {
                        int totalPages = localFiles.Count;
                        int resolvedPage = savedPage;
                        if (savedScrollPercent > 0 && totalPages > 0)
                        {
                            resolvedPage = (int)(savedScrollPercent * Math.Max(1, totalPages - 1)) + 1;
                            resolvedPage = Math.Clamp(resolvedPage, 1, totalPages);
                        }

                        return new ReaderPagesResultDto
                        {
                            MangaId = frontendMangaId,
                            ChapterUrl = targetChUrl,
                            ChapterNumber = chapter.ChapterNumber > 0 ? chapter.ChapterNumber : chapterNumber,
                            ChapterTitle = chTitle,
                            IsOffline = true,
                            LastPageRead = resolvedPage,
                            ScrollPercent = savedScrollPercent,
                            Pages = localFiles.Select(f => WebResourceImageProxy.BuildPageProxyUrl(f, manga.Source, isLocalFile: true)).ToList()
                        };
                    }

                }

            }

            // 2. Fetch Online from IMangaSource

            if (!SettingsService.IsOfflineMode)

            {

                // If targetChUrl is still empty and we have a source + mangaUrl, fetch chapter list directly

                if (string.IsNullOrEmpty(targetChUrl) && source != null && !string.IsNullOrEmpty(mangaUrl))

                {

                    try

                    {

                        var chList = await source.GetChapterListAsync(mangaUrl);

                        if (chList != null && chList.Count > 0)

                        {

                            var match = chList.FirstOrDefault(c => Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f) ?? chList.First();

                            targetChUrl = match.Url;

                            chTitle = match.Name ?? chTitle;

                        }

                    }

                    catch { }

                }

                if (source != null && !string.IsNullOrEmpty(targetChUrl))

                {

                    try

                    {

                        var rawPages = await source.GetPageListAsync(targetChUrl);

                        var proxiedPages = rawPages

                            .Where(p => !string.IsNullOrWhiteSpace(p))

                            .Select(p => WebResourceImageProxy.BuildPageProxyUrl(p, resolvedSourceId, isLocalFile: false, force: forceRefresh))

                            .ToList();

                        if (proxiedPages.Count > 0)

                        {

                            // Auto-download next chapter if enabled in Settings

                            if (SettingsService.AutoDownloadNextChapter && manga?.Chapters != null)

                            {

                                var nextCh = manga.Chapters

                                    .Where(c => c.ChapterNumber > chapterNumber)

                                    .OrderBy(c => c.ChapterNumber)

                                    .FirstOrDefault();

                                if (nextCh != null && !DownloadPathService.IsChapterDownloaded(manga, nextCh))

                                {

                                    DownloadService.QueueDownload(manga, nextCh);

                                }

                            }

                            int totalPages = proxiedPages.Count;
                            int resolvedPage = savedPage;
                            if (savedScrollPercent > 0 && totalPages > 0)
                            {
                                resolvedPage = (int)(savedScrollPercent * Math.Max(1, totalPages - 1)) + 1;
                                resolvedPage = Math.Clamp(resolvedPage, 1, totalPages);
                            }

                            return new ReaderPagesResultDto
                            {
                                MangaId = frontendMangaId,
                                ChapterUrl = targetChUrl,
                                ChapterNumber = chapter?.ChapterNumber > 0 ? chapter.ChapterNumber : chapterNumber,
                                ChapterTitle = chTitle,
                                IsOffline = false,
                                LastPageRead = resolvedPage,
                                ScrollPercent = savedScrollPercent,
                                Pages = proxiedPages
                            };
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[HandleGetReaderPagesAsync] Error fetching pages from source: {ex.Message}");
                    }
                }
            }

            return new ReaderPagesResultDto
            {
                MangaId = frontendMangaId,
                ChapterUrl = targetChUrl,
                ChapterNumber = chapterNumber,
                ChapterTitle = chTitle,
                IsOffline = SettingsService.IsOfflineMode,
                LastPageRead = savedPage,
                ScrollPercent = savedScrollPercent,
                Pages = new List<string>()
            };

        }

        private async Task<object> HandleSaveReaderProgressAsync(JsonElement? payload)
        {
            string mangaId = GetString(payload, "mangaId");
            string chapterUrl = GetString(payload, "chapterUrl");
            float chapterNumber = GetFloat(payload, "chapterNumber", 1);
            string mangaUrl = GetString(payload, "mangaUrl");
            long sourceId = GetLong(payload, "sourceId");
            int currentPage = Math.Max(1, GetInt(payload, "currentPage", 1));
            int totalPages = Math.Max(1, GetInt(payload, "totalPages", 1));
            string mode = GetString(payload, "mode");
            double scrollPercent = GetDouble(payload, "scrollPercent", -1.0);
            bool isCompleted = GetBool(payload, "completed") || (totalPages > 1 && currentPage >= totalPages) || (scrollPercent >= 0.995);
            bool markRead = GetBool(payload, "isRead") || isCompleted;
            int sessionReadSeconds = Math.Clamp(GetInt(payload, "sessionReadSeconds", 0), 0, 300);

            long storedValue = 0;
            if (string.Equals(mode, "webtoon", StringComparison.OrdinalIgnoreCase) && scrollPercent >= 0)
            {
                if (scrollPercent >= 0.995) scrollPercent = 0;
                storedValue = (long)(scrollPercent * 1_000_000L);
            }
            else
            {
                storedValue = isCompleted ? 0 : currentPage;
            }

            var manga = await ResolveMangaAsync(mangaId, mangaUrl, sourceId);
            if (manga == null) return new { ok = false };

            if (string.IsNullOrEmpty(chapterUrl))
            {
                chapterUrl = manga.Chapters?.FirstOrDefault(c => Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f)?.Url ?? string.Empty;
            }

            if (!string.IsNullOrEmpty(chapterUrl))
            {
                _chapterLastPageReadCache[chapterUrl] = storedValue;
            }
            if (chapterNumber > 0)
            {
                _chapterLastPageReadCache[$"{mangaId}_{chapterNumber}"] = storedValue;
                if (!string.IsNullOrEmpty(mangaUrl))
                {
                    _chapterLastPageReadCache[$"{mangaUrl}_{chapterNumber}"] = storedValue;
                }
            }

            if (!string.IsNullOrEmpty(chapterUrl) || (manga != null && manga.Id > 0))
            {
                if (totalPages > 1 && !string.IsNullOrEmpty(chapterUrl))
                {
                    _chapterTotalPagesCache[chapterUrl] = totalPages;
                }
                if (manga != null && manga.Id > 0 && totalPages > 1)
                {
                    _mangaLastTotalPagesCache[manga.Id] = totalPages;
                }

                await LibraryService.SaveLastPageReadAsync(chapterUrl, storedValue, manga?.Id ?? 0, chapterNumber);

                if (markRead && manga != null)
                {
                    await LibraryService.SetChapterReadStatusAsync(
                        chapterUrl,
                        true,
                        manga.Source,
                        manga.Url,
                        $"Chapter {chapterNumber}",
                        chapterNumber);

                    // Auto-mark previous chapters as read in database
                    await LibraryService.MarkChaptersBeforeAsReadAsync(manga, chapterNumber);
                }

                // Update Manga.LastViewed & History entry + Auto-sync MAL Tracker when chapter completed
                try
                {
                    using var db = new MangaDbContext();
                    long now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                    if (manga != null && manga.Id > 0)

                    {

                        var dbManga = await db.Mangas.FindAsync(manga.Id);

                        if (dbManga != null)

                        {

                            dbManga.LastViewed = now;

                        }

                    }

                    var dbCh = await db.Chapters.FirstOrDefaultAsync(c => c.Url == chapterUrl);

                    if (dbCh != null)

                    {

                        var hist = await db.History.FirstOrDefaultAsync(h => h.ChapterId == dbCh.Id);

                        long deltaMs = sessionReadSeconds * 1000L;

                        if (hist != null)

                        {

                            hist.MangaId = dbCh.MangaId;

                            hist.LastRead = now;

                            if (deltaMs > 0)

                            {

                                long baseMs = hist.TimeRead > 0 && hist.TimeRead < 1000 ? hist.TimeRead * 1000L : hist.TimeRead;

                                hist.TimeRead = baseMs + deltaMs;

                            }

                        }

                        else

                        {

                            db.History.Add(new History

                            {

                                ChapterId = dbCh.Id,

                                MangaId = dbCh.MangaId,

                                LastRead = now,

                                TimeRead = deltaMs

                            });

                        }

                    }

                    await db.SaveChangesAsync();

                    if (markRead && manga != null && manga.Id > 0)

                    {

                        var track = await db.Tracks.FirstOrDefaultAsync(t => t.MangaId == manga.Id && t.TrackerName == "MyAnimeList");

                        if (track != null && (int)chapterNumber > track.LastChapterRead)

                        {

                            track.LastChapterRead = (int)chapterNumber;

                            await db.SaveChangesAsync();

                            if (SettingsService.AutoSyncTracker && MalService.IsConnected && track.RemoteId > 0)

                            {

                                _ = MalService.UpdateMangaStatusAsync(track.RemoteId, track.Status, track.LastChapterRead, (int)track.Score);

                            }

                        }

                    }

                }

                catch { }

                // Preload Next Chapter when within 3 pages of the end of current chapter (Tahap 4.4)

                if (SettingsService.PreloadNextChapter && !SettingsService.IsOfflineMode && currentPage >= Math.Max(1, totalPages - 2) && manga?.Chapters != null)

                {

                    var nextCh = manga.Chapters

                        .Where(c => c.ChapterNumber > chapterNumber)

                        .OrderBy(c => c.ChapterNumber)

                        .FirstOrDefault();

                    if (nextCh != null && !string.IsNullOrEmpty(nextCh.Url))

                    {

                        var source = ResolveSourceSafely(manga.Source, manga.Url, manga: manga);

                        if (source != null)

                        {

                            _ = Task.Run(async () =>

                            {

                                try { await source.GetPageListAsync(nextCh.Url); } catch { }

                            });

                        }

                    }

                }

            }

            return new { ok = true };

        }

        /* =========================================================================

         * 5. PUSTAKA & RIWAYAT (LIBRARY & HISTORY LIST)

         * ========================================================================= */

        private async Task<List<MangaDto>> GetLibraryAndHistoryMangaDtosAsync()

        {

            using var db = new MangaDbContext();

            var mangas = await db.Mangas

                .AsNoTracking()

                .Include(m => m.Chapters)

                .Include(m => m.Categories)

                .Include(m => m.Tracks)

                .Where(m => m.Favorite || m.LastViewed > 0)

                .OrderByDescending(m => m.LastViewed)

                .ThenByDescending(m => m.LastUpdate)

                .ToListAsync();

            return mangas.Select(m => MapMangaToDto(m, includeChapters: true)).ToList();

        }

        private async Task<List<MangaDto>> GetHistoryMangaDtosAsync()

        {

            using var db = new MangaDbContext();

            var mangas = await db.Mangas

                .AsNoTracking()

                .Include(m => m.Chapters)

                .Include(m => m.Categories)

                .Include(m => m.Tracks)

                .Where(m => m.LastViewed > 0)

                .OrderByDescending(m => m.LastViewed)

                .ToListAsync();

            return mangas.Select(m => MapMangaToDto(m, includeChapters: true)).ToList();

        }

        private async Task<List<CategoryDto>> HandleGetCategoriesAsync()
        {
            var categories = await LibraryService.GetCategoriesAsync();
            return MapCategoriesToDtos(categories);
        }

        private async Task<List<CategoryDto>> HandleAddCategoryAsync(string name)

        {

            if (!string.IsNullOrWhiteSpace(name))

            {

                await LibraryService.AddCategoryAsync(new Category { Name = name.Trim() });

            }

            var categories = await LibraryService.GetCategoriesAsync();
            return MapCategoriesToDtos(categories);

        }

        private async Task<List<CategoryDto>> HandleDeleteCategoryAsync(long categoryId)

        {

            await LibraryService.DeleteCategoryAsync(categoryId);

            var categories = await LibraryService.GetCategoriesAsync();
            return MapCategoriesToDtos(categories);

        }

        private async Task<object> HandleSetMangaCategoriesAsync(JsonElement? payload)
        {
            var mangaId = GetString(payload, "mangaId");
            var mangaUrl = GetString(payload, "mangaUrl");
            var sourceId = GetLong(payload, "sourceId");

            var manga = await ResolveMangaAsync(mangaId, mangaUrl, sourceId);
            if (manga == null)
            {
                return new { ok = false, error = "Manga tidak ditemukan" };
            }

            var categoryIds = new List<long>();
            if (payload.HasValue && payload.Value.TryGetProperty("categoryIds", out var catProp) && catProp.ValueKind == JsonValueKind.Array)
            {
                foreach (var el in catProp.EnumerateArray())
                {
                    if (el.TryGetInt64(out var cid))
                    {
                        categoryIds.Add(cid);
                    }
                }
            }

            await LibraryService.SetMangaCategoriesAsync(manga.Url, manga.Source, categoryIds);
            return new { ok = true, mangaId, categoryIds };
        }

        private async Task<object> HandleSyncLibraryAsync(bool forceRefresh)

        {

            if (Interlocked.CompareExchange(ref _isSyncingLibrary, 1, 0) != 0)

            {

                return new { alreadyRunning = true };

            }

            try

            {

                var progress = new Progress<(int current, int total)>(p =>

                {

                    PushEvent("event:library-sync-progress", new

                    {

                        active = true,

                        current = p.current,

                        total = p.total

                    });

                });

                int newChaptersCount = await LibraryService.UpdateAllLibraryMangaAsync(SourceManager, forceRefresh, progress);

                var mangaList = await GetLibraryAndHistoryMangaDtosAsync();

                var activityUpdates = await GetActivityUpdatesDtosAsync();

                return new

                {

                    newChaptersCount,

                    mangaList,

                    activityUpdates

                };

            }

            finally

            {

                Interlocked.Exchange(ref _isSyncingLibrary, 0);

            }

        }

        /* =========================================================================

         * 6. PEMBARUAN (UPDATES)

         * ========================================================================= */

        private async Task<List<ActivityUpdateDto>> GetActivityUpdatesDtosAsync()

        {

            var recentChapters = await LibraryService.GetRecentChaptersAsync(300);

            var result = new List<ActivityUpdateDto>();

            // Group by MangaId + Date bucket so multiple chapters fetched on the same day collapse cleanly with (+N bab)

            var grouped = recentChapters

                .Where(c => c.Manga != null)

                .GroupBy(c => new

                {

                    c.MangaId,

                    DayBucket = DateTimeOffset.FromUnixTimeMilliseconds(c.DateFetch > 0 ? c.DateFetch : DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()).LocalDateTime.Date

                });

            foreach (var grp in grouped)

            {

                var ordered = grp.OrderByDescending(c => c.ChapterNumber).ToList();

                var latest = ordered.First();

                var manga = latest.Manga;

                var src = SourceManager.GetSource(manga.Source);

                string sourceName = src?.Name?.Replace("Yomic:", "", StringComparison.OrdinalIgnoreCase).Trim() ?? "Sumber Komik";

                // Target chapter for reading: prioritize the earliest UNREAD chapter in this batch (anti-spoiler)
                var unreadInBatch = ordered.Where(c => !c.Read).OrderBy(c => c.ChapterNumber).ToList();
                var targetChapter = unreadInBatch.FirstOrDefault() ?? ordered.Last();

                result.Add(new ActivityUpdateDto

                {

                    Id = $"upd-{latest.Id}",

                    MangaId = MakeMangaFrontendId(manga),

                    MangaTitle = manga.Title,

                    ChapterNumber = (float)Math.Round(targetChapter.ChapterNumber > 0 ? targetChapter.ChapterNumber : 1, 2),

                    ChapterTitle = CleanChapterSubTitle(targetChapter.Name, targetChapter.ChapterNumber),

                    ChapterUrl = targetChapter.Url,

                    SourceName = sourceName,

                    TimeAgo = FormatRelativeTime(latest.DateFetch),

                    DateFetch = latest.DateFetch,

                    IsNew = ordered.Any(c => !c.Read),

                    ExtraChaptersCount = Math.Max(0, ordered.Count - 1),

                    CoverUrl = WebResourceImageProxy.BuildCoverProxyUrl(manga.Id, manga.ThumbnailUrl, manga.Source),

                    FirstUnreadChapterNumber = (float)Math.Round(targetChapter.ChapterNumber > 0 ? targetChapter.ChapterNumber : 1, 2),

                    FirstUnreadChapterTitle = CleanChapterSubTitle(targetChapter.Name, targetChapter.ChapterNumber),

                    FirstUnreadChapterUrl = targetChapter.Url

                });

            }

            return result.OrderByDescending(u => u.DateFetch).ToList();

        }

        private async Task<object> HandleClearAllUpdatesAsync()

        {

            await LibraryService.ClearAllUpdatesAsync();

            return new { ok = true };

        }

        private async Task<object> HandleMarkAllUpdatesReadAsync()

        {

            int count = await LibraryService.MarkAllUpdatesReadAsync();

            return new { ok = true, count };

        }

        /* =========================================================================

         * 7. RIWAYAT (HISTORY)

         * ========================================================================= */

        private async Task<object> HandleRemoveHistoryItemAsync(string mangaId)

        {

            var manga = await ResolveMangaAsync(mangaId);

            if (manga != null && manga.Id > 0)

            {

                using var db = new MangaDbContext();

                var dbManga = await db.Mangas.FindAsync(manga.Id);

                if (dbManga != null)

                {

                    dbManga.LastViewed = 0;

                    var chIds = await db.Chapters.Where(c => c.MangaId == dbManga.Id).Select(c => c.Id).ToListAsync();

                    var histRows = await db.History.Where(h => chIds.Contains(h.ChapterId)).ToListAsync();

                    db.History.RemoveRange(histRows);

                    await db.SaveChangesAsync();

                }

            }

            return new { ok = true };

        }

        private async Task<object> HandleClearAllHistoryAsync()
        {
            await LibraryService.ClearAllReadHistoryAsync();

            using (var db = new MangaDbContext())
            {
                var viewedMangas = await db.Mangas.Where(m => m.LastViewed > 0).ToListAsync();
                foreach (var m in viewedMangas)
                {
                    m.LastViewed = 0;
                }

                var partialChapters = await db.Chapters.Where(c => c.LastPageRead > 0).ToListAsync();
                foreach (var ch in partialChapters)
                {
                    ch.LastPageRead = 0;
                }

                db.History.RemoveRange(db.History);
                await db.SaveChangesAsync();
            }

            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var readerCacheDir = Path.Combine(localAppData, "Yomic", "Cache", "Reader");
                if (Directory.Exists(readerCacheDir))
                {
                    Directory.Delete(readerCacheDir, true);
                    Directory.CreateDirectory(readerCacheDir);
                }

                SourceManager.ClearAllCache();
                await NetworkService.ResetConnectionsAsync();
                GC.Collect();
                GC.WaitForPendingFinalizers();
                GC.Collect();
            }
            catch { }

            var updatedMangas = await GetLibraryAndHistoryMangaDtosAsync();
            return new
            {
                ok = true,
                dbSizeText = CalculateStorageSizeText(),
                mangaList = updatedMangas
            };
        }

        /* =========================================================================
         * 8. UNDUHAN (DOWNLOADS)
         * ========================================================================= */

        private static string FormatDirectorySize(string dirPath)
        {
            try
            {
                if (!Directory.Exists(dirPath)) return "Tersimpan";
                var dirInfo = new DirectoryInfo(dirPath);
                long bytes = dirInfo.EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);
                if (bytes <= 0)
                {
                    int fileCount = dirInfo.EnumerateFiles("*", SearchOption.AllDirectories).Count();
                    return fileCount > 0 ? $"{fileCount} hal." : "Tersimpan";
                }
                if (bytes < 1024 * 1024)
                {
                    double kb = bytes / 1024.0;
                    return $"{kb:0.0} KB";
                }
                double mb = bytes / (1024.0 * 1024.0);
                return $"{mb:0.1} MB";
            }
            catch
            {
                return "Tersimpan";
            }
        }

        private List<DownloadQueueDto> GetDownloadsQueueList()
        {
            var all = DownloadService.AllDownloads.ToList();
            return all.Select((req, idx) =>
            {
                var src = SourceManager.GetSource(req.Manga.Source);
                string sourceName = src?.Name?.Replace("Yomic:", "", StringComparison.OrdinalIgnoreCase).Trim() ?? "Sumber Komik";

                string mappedStatus = req.Status switch
                {
                    "Downloading" => "downloading",
                    "Completed" => "completed",
                    "Paused" => "paused",
                    _ => "queued"
                };

                string speedText = mappedStatus switch
                {
                    "downloading" => req.Status.StartsWith("Retrying") ? req.Status : $"{req.Progress}% • Mengunduh...",
                    "paused" => "Dijeda",
                    "completed" => "Tersimpan",
                    _ => "Dalam Antrean"
                };

                string sizeText;
                if (mappedStatus == "completed")
                {
                    var dir = DownloadPathService.FindCompletedChapterDirectory(req.Manga, req.Chapter);
                    sizeText = !string.IsNullOrEmpty(dir) && Directory.Exists(dir)
                        ? FormatDirectorySize(dir)
                        : "Tersimpan";
                }
                else
                {
                    sizeText = $"{req.Progress}%";
                }

                float chNum = req.Chapter.ChapterNumber > 0 ? req.Chapter.ChapterNumber : 1;

                return new DownloadQueueDto
                {
                    Id = $"dl-{ComputeShortHash(req.Chapter.Url)}",
                    MangaId = MakeMangaFrontendId(req.Manga),
                    MangaTitle = req.Manga.Title,
                    ChapterLabel = !string.IsNullOrWhiteSpace(req.Chapter.Name) ? req.Chapter.Name : $"Chapter {chNum}",
                    ChapterNumber = chNum,
                    ChapterUrl = req.Chapter.Url,
                    CoverUrl = WebResourceImageProxy.BuildCoverProxyUrl(req.Manga.Id, req.Manga.ThumbnailUrl, req.Manga.Source),
                    SourceName = sourceName,
                    ProgressPercent = Math.Clamp(req.Progress, 0, 100),
                    SpeedText = speedText,
                    SizeText = sizeText,
                    Status = mappedStatus
                };
            }).ToList();
        }

        private async Task<List<DownloadQueueDto>> HandleEnqueueDownloadAsync(JsonElement? payload)

        {

            string mangaId = GetString(payload, "mangaId");

            string chapterUrl = GetString(payload, "chapterUrl");

            float chapterNumber = GetFloat(payload, "chapterNumber", -1);

            string mode = GetString(payload, "mode", "single"); // single | all | unread

            var manga = await ResolveMangaAsync(mangaId);

            if (manga == null || manga.Chapters == null)

                return GetDownloadsQueueList();

            if (mode == "all")

            {

                foreach (var ch in manga.Chapters.OrderBy(c => c.ChapterNumber))

                {

                    if (!DownloadPathService.IsChapterDownloaded(manga, ch))

                    {

                        DownloadService.QueueDownload(manga, ch);

                    }

                }

            }

            else if (mode == "unread")

            {

                foreach (var ch in manga.Chapters.Where(c => !c.Read).OrderBy(c => c.ChapterNumber))

                {

                    if (!DownloadPathService.IsChapterDownloaded(manga, ch))

                    {

                        DownloadService.QueueDownload(manga, ch);

                    }

                }

            }

            else

            {

                var ch = manga.Chapters.FirstOrDefault(c =>

                    (!string.IsNullOrEmpty(chapterUrl) && string.Equals(c.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)) ||

                    Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f);

                if (ch != null)

                {

                    DownloadService.QueueDownload(manga, ch);

                }

            }

            return GetDownloadsQueueList();

        }

        private List<DownloadQueueDto> HandleTogglePauseDownload(JsonElement? payload)

        {

            string id = GetString(payload, "id");

            string chapterUrl = GetString(payload, "chapterUrl");

            var req = DownloadService.AllDownloads.FirstOrDefault(r =>

                $"dl-{ComputeShortHash(r.Chapter.Url)}" == id ||

                (!string.IsNullOrEmpty(chapterUrl) && string.Equals(r.Chapter.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)));

            if (req != null)

            {

                if (req.Status == "Paused")

                    DownloadService.Resume(req);

                else

                    DownloadService.Pause(req);

            }

            return GetDownloadsQueueList();

        }

        private List<DownloadQueueDto> HandlePauseAllDownloads()

        {

            DownloadService.Pause();

            return GetDownloadsQueueList();

        }

        private List<DownloadQueueDto> HandleResumeAllDownloads()

        {

            DownloadService.Resume();

            return GetDownloadsQueueList();

        }

        private async Task<List<DownloadQueueDto>> HandleCancelDownloadAsync(JsonElement? payload)
        {
            string id = GetString(payload, "id");
            string chapterUrl = GetString(payload, "chapterUrl");

            var req = DownloadService.AllDownloads.FirstOrDefault(r =>
                $"dl-{ComputeShortHash(r.Chapter.Url)}" == id ||
                (!string.IsNullOrEmpty(chapterUrl) && string.Equals(r.Chapter.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)));

            if (req != null)
            {
                if (req.Status == "Completed" || (req.Manga != null && req.Chapter != null && DownloadPathService.IsChapterDownloaded(req.Manga, req.Chapter)))
                {
                    try
                    {
                        var dir = DownloadPathService.FindCompletedChapterDirectory(req.Manga, req.Chapter);
                        if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                        {
                            Directory.Delete(dir, true);
                        }
                    }
                    catch { }

                    if (req.Chapter != null)
                    {
                        req.Chapter.IsDownloaded = false;
                        if (!string.IsNullOrEmpty(req.Chapter.Url))
                        {
                            await LibraryService.UpdateChapterDownloadStatusByUrlAsync(req.Chapter.Url, false);
                        }
                    }
                }

                DownloadService.Cancel(req);
            }

            return GetDownloadsQueueList();
        }

        private List<DownloadQueueDto> HandleClearCompletedDownloads()
        {
            DownloadService.ClearCompleted();
            return GetDownloadsQueueList();
        }

        private async Task<object> HandleDeleteChapterDownloadAsync(JsonElement? payload)
        {
            string mangaId = GetString(payload, "mangaId");
            string chapterUrl = GetString(payload, "chapterUrl");
            float chapterNumber = GetFloat(payload, "chapterNumber", -1);

            var manga = await ResolveMangaAsync(mangaId);
            if (manga?.Chapters != null)
            {
                var ch = manga.Chapters.FirstOrDefault(c =>
                    (!string.IsNullOrEmpty(chapterUrl) && string.Equals(c.Url, chapterUrl, StringComparison.OrdinalIgnoreCase)) ||
                    Math.Abs(c.ChapterNumber - chapterNumber) < 0.01f);

                if (ch != null)
                {
                    var dir = DownloadPathService.FindCompletedChapterDirectory(manga, ch);
                    if (!string.IsNullOrEmpty(dir) && Directory.Exists(dir))
                    {
                        try { Directory.Delete(dir, true); } catch { }
                    }
                    ch.IsDownloaded = false;
                    await LibraryService.UpdateChapterDownloadStatusByUrlAsync(ch.Url, false);

                    // Sinkronisasi dengan antrean DownloadService agar hilang dari daftar unduhan
                    var matchReq = DownloadService.AllDownloads.FirstOrDefault(r =>
                        string.Equals(r.Chapter.Url, ch.Url, StringComparison.OrdinalIgnoreCase) ||
                        (r.Manga?.Id == manga.Id && Math.Abs(r.Chapter.ChapterNumber - ch.ChapterNumber) < 0.01f));
                    if (matchReq != null)
                    {
                        DownloadService.Cancel(matchReq);
                    }
                }
            }
            return new { ok = true, downloads = GetDownloadsQueueList() };
        }

        private async Task<object> HandleDeleteMangaDownloadsAsync(string mangaId)
        {
            var manga = await ResolveMangaAsync(mangaId);
            if (manga != null)
            {
                var mangaDir = DownloadPathService.GetMangaDirectory(manga);
                if (Directory.Exists(mangaDir))
                {
                    try { Directory.Delete(mangaDir, true); } catch { }
                }
                if (manga.Chapters != null)
                {
                    foreach (var ch in manga.Chapters)
                    {
                        ch.IsDownloaded = false;
                        await LibraryService.UpdateChapterDownloadStatusByUrlAsync(ch.Url, false);
                    }
                }

                // Sinkronisasi dengan antrean DownloadService untuk seluruh bab komik terkait
                var mangaReqs = DownloadService.AllDownloads
                    .Where(r => r.Manga?.Id == manga.Id || (r.Manga?.Url != null && r.Manga.Url == manga.Url))
                    .ToList();
                foreach (var mr in mangaReqs)
                {
                    DownloadService.Cancel(mr);
                }
            }
            return new { ok = true, downloads = GetDownloadsQueueList() };
        }

        /* =========================================================================

         * 9. PENGATURAN, CADANGAN, PENGUMUMAN & MYANIMELIST

         * ========================================================================= */

        private async Task<object> HandleGetAnnouncementsAsync(bool force)
        {
            var list = await AnnouncementService.FetchAnnouncementsAsync(force);
            return new
            {
                announcements = MapAnnouncementsToDtos(list),
                hasUnread = AnnouncementService.HasUnreadAnnouncements()
            };
        }

        private object HandleMarkAnnouncementRead(string id)
        {
            if (string.IsNullOrWhiteSpace(id) && AnnouncementService.CachedAnnouncements.Count > 0)
            {
                id = AnnouncementService.CachedAnnouncements[0].Id;
            }
            if (!string.IsNullOrWhiteSpace(id))
            {
                AnnouncementService.MarkAsRead(id);
            }
            return new
            {
                ok = true,
                hasUnread = AnnouncementService.HasUnreadAnnouncements()
            };
        }

        private Dictionary<string, object?> HandleUpdateSetting(JsonElement? payload)

        {

            string key = GetString(payload, "key");

            if (payload == null || !payload.Value.TryGetProperty("value", out var valElem))

                return BuildSettingsDictionary();

            switch (key)

            {

                case "defaultReaderMode":

                {

                    var str = valElem.GetString();

                    SettingsService.DefaultReaderMode = str switch

                    {

                        "single" => 1,

                        "dual" => 2,

                        _ => 0

                    };

                    break;

                }

                case "readingDirection":

                {

                    var str = valElem.GetString();
                    if (!string.IsNullOrWhiteSpace(str))
                    {
                        SettingsService.ReadingDirection = str;
                    }

                    break;

                }

                case "readerFitMode":
                {
                    var str = valElem.GetString();
                    if (!string.IsNullOrWhiteSpace(str))
                    {
                        SettingsService.ReaderFitMode = str;
                    }
                    break;
                }

                case "isDarkMode":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        bool isDark = valElem.GetBoolean();
                        SettingsService.IsDarkMode = isDark;
                        _dispatcher.InvokeAsync(() =>
                        {
                            if (_ownerWindow is MainWindow mw)
                            {
                                mw.ApplyTitleBarTheme(isDark);
                            }
                        });
                    }
                    break;
                }

                case "autoDarkReader":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.AutoDarkReader = valElem.GetBoolean();
                    }
                    break;
                }

                case "maxReaderCacheSize":
                {
                    var str = valElem.GetString() ?? "500MB";
                    int mbValue = str switch
                    {
                        "250MB" => 250,
                        "500MB" => 500,
                        "1GB" => 1024,
                        "2GB" => 2048,
                        _ => 500
                    };
                    SettingsService.MaxCacheSizeMb = mbValue;
                    _ = Task.Run(() => CleanupReaderCache(mbValue));
                    break;
                }

                case "showNsfw":
                {
                    SettingsService.ShowNsfwSources = valElem.GetBoolean();
                    SettingsService.SaveImmediate();
                    break;
                }

                case "blurExplicitCovers":

                {

                    SettingsService.SecureScreen = valElem.GetBoolean();

                    break;

                }

                case "dohProvider":

                {

                    var str = valElem.GetString() ?? "";

                    SettingsService.DnsOverHttpsProvider = str.Contains("Cloudflare") ? 1

                        : str.Contains("Google") ? 2

                        : str.Contains("AdGuard") ? 3

                        : 0;

                    _ = NetworkService.ResetConnectionsAsync();

                    break;

                }

                case "preloadNextChapter":

                {

                    SettingsService.PreloadNextChapter = valElem.GetBoolean();

                    break;

                }

                case "autoDownloadNextChapter":

                {

                    SettingsService.AutoDownloadNextChapter = valElem.GetBoolean();

                    break;

                }

                case "skipFilteredChapters":

                {

                    SettingsService.SkipFilteredChapters = valElem.GetBoolean();

                    break;

                }

                case "showUnreadBadges":

                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.ShowUnreadBadges = valElem.GetBoolean();
                    }
                    break;

                }

                case "autoSyncStartup":

                {

                    SettingsService.UpdateOnStart = valElem.GetBoolean();

                    break;

                }

                case "smartUpdate":

                {

                    SettingsService.UseSmartUpdate = valElem.GetBoolean();

                    break;

                }

                case "backgroundUpdateInterval":
                {
                    var str = valElem.GetString() ?? "12h";
                    int hours = str switch
                    {
                        "off" => 0,
                        "6h" => 6,
                        "12h" => 12,
                        "24h" => 24,
                        _ => 12
                    };
                    SettingsService.AutoUpdateIntervalHours = hours;
                    _ = Task.Run(() => AutoUpdateTaskService.RegisterOrUpdateTask(hours));
                    break;
                }

                case "isOfflineMode":

                {

                    SettingsService.IsOfflineMode = valElem.GetBoolean();

                    break;

                }

                case "sourceStatusInterval":

                {

                    var str = valElem.GetString() ?? "30m";

                    SettingsService.SourceStatusRefreshIntervalMinutes = str switch

                    {

                        "off" => 0,

                        "15m" => 15,

                        "1h" => 60,

                        _ => 30

                    };

                    break;

                }

                case "autoSyncTracker":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.AutoSyncTracker = valElem.GetBoolean();
                    }
                    break;
                }

                case "enableImageOptimization":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.EnableImageOptimization = valElem.GetBoolean();
                    }
                    break;
                }

                case "enableAutoCropBorders":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.EnableAutoCropBorders = valElem.GetBoolean();
                    }
                    break;
                }

                case "maxImageDimension":
                {
                    if (valElem.TryGetInt32(out int maxDim))
                    {
                        SettingsService.MaxImageDimension = maxDim;
                    }
                    break;
                }

                case "enableImageSharpening":
                {
                    if (valElem.ValueKind == JsonValueKind.True || valElem.ValueKind == JsonValueKind.False)
                    {
                        SettingsService.EnableImageSharpening = valElem.GetBoolean();
                    }
                    break;
                }

                case "appLanguage":
                {
                    if (valElem.ValueKind == JsonValueKind.String)
                    {
                        var lang = valElem.GetString()?.Trim().ToLowerInvariant();
                        SettingsService.AppLanguage = lang == "en" ? "en" : "id";
                    }
                    break;
                }

                case "mangaDexLanguage":
                {
                    if (valElem.ValueKind == JsonValueKind.String)
                    {
                        var lang = valElem.GetString()?.Trim().ToLowerInvariant();
                        string normalized = lang == "id" ? "id" : "en";
                        SettingsService.MangaDexLanguage = normalized;
                        JsMangaSource.SelectedLanguage = normalized;
                        SourceManager.ClearAllCache();
                    }
                    break;
                }

                case "customHotkeys":
                {
                    if (valElem.ValueKind == JsonValueKind.String)
                    {
                        SettingsService.CustomHotkeysJson = valElem.GetString() ?? "";
                    }
                    else
                    {
                        SettingsService.CustomHotkeysJson = valElem.GetRawText();
                    }
                    break;
                }

            }

            SettingsService.Save();

            return BuildSettingsDictionary();

        }

        private static void CleanupReaderCache(int maxMb)
        {
            if (maxMb <= 0) return;

            try
            {
                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var readerCachePath = Path.Combine(localAppData, "Yomic", "Cache", "Reader");

                if (!Directory.Exists(readerCachePath)) return;

                var dirInfo = new DirectoryInfo(readerCachePath);
                var files = dirInfo.GetFiles("*", SearchOption.AllDirectories)
                                   .OrderBy(f => f.LastWriteTimeUtc)
                                   .ToList();

                long totalBytes = files.Sum(f => f.Length);
                long maxBytes = (long)maxMb * 1024 * 1024;

                if (totalBytes > maxBytes)
                {
                    long bytesToDelete = totalBytes - maxBytes;
                    long deletedBytes = 0;

                    foreach (var file in files)
                    {
                        if (deletedBytes >= bytesToDelete) break;
                        try
                        {
                            long len = file.Length;
                            file.Delete();
                            deletedBytes += len;
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Warning("Cache", $"Cleanup reader cache error: {ex.Message}");
            }
        }

        private async Task<object> HandleRefreshLibraryCoversAsync()
        {
            try
            {
                await Task.Run(() =>
                {
                    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                    var coversDir = Path.Combine(localAppData, "Yomic", "covers");
                    if (Directory.Exists(coversDir))
                    {
                        foreach (var file in Directory.GetFiles(coversDir, "*", SearchOption.AllDirectories))
                        {
                            try { File.Delete(file); } catch { }
                        }
                    }

                    SourceManager.ClearAllCache();
                    GC.Collect();
                    GC.WaitForPendingFinalizers();
                });

                long cacheBust = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                var mangaList = await GetLibraryAndHistoryMangaDtosAsync();
                foreach (var m in mangaList)
                {
                    if (!string.IsNullOrWhiteSpace(m.CoverUrl))
                    {
                        string sep = m.CoverUrl.Contains('?') ? "&" : "?";
                        m.CoverUrl = $"{m.CoverUrl}{sep}t={cacheBust}";
                    }
                }

                return new
                {
                    ok = true,
                    mangaList,
                    dbSizeText = CalculateStorageSizeText()
                };
            }
            catch (Exception ex)
            {
                LogService.Error("Settings", "Failed to refresh library covers", ex);
                return new { ok = false, error = ex.Message };
            }
        }

        private async Task<object> HandleClearImageCacheAsync()

        {

            try

            {
                await Task.Run(() =>
                {
                    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

                    var cacheDir = Path.Combine(localAppData, "Yomic", "Cache");
                    if (Directory.Exists(cacheDir))
                    {
                        try
                        {
                            Directory.Delete(cacheDir, true);
                        }
                        catch
                        {
                            foreach (var f in Directory.GetFiles(cacheDir, "*", SearchOption.AllDirectories))
                            {
                                try { File.Delete(f); } catch { }
                            }
                        }
                        try { Directory.CreateDirectory(Path.Combine(cacheDir, "Reader")); } catch { }
                    }

                    var coversDir = Path.Combine(localAppData, "Yomic", "covers");
                    if (Directory.Exists(coversDir))
                    {
                        foreach (var f in Directory.GetFiles(coversDir, "*", SearchOption.AllDirectories))
                        {
                            try { File.Delete(f); } catch { }
                        }
                    }

                    SourceManager.ClearAllCache();
                });

                await NetworkService.ResetConnectionsAsync();

                GC.Collect();
                GC.WaitForPendingFinalizers();
                GC.Collect();

            }

            catch { }

            return new { ok = true, dbSizeText = CalculateStorageSizeText() };

        }

        private async Task<object> HandleClearNonLibraryCacheAsync()
        {
            await LibraryService.ClearNonLibraryMangasAsync();
            _discoveredManga.Clear();
            return new { ok = true, dbSizeText = CalculateStorageSizeText() };
        }

        private async Task<object> HandleExportLogsAsync()
        {
            string? destPath = null;
            await _dispatcher.InvokeAsync(() =>
            {
                var dlg = new SaveFileDialog
                {
                    Title = "Ekspor Log Aplikasi Yomic",
                    Filter = "Log File (*.log)|*.log",
                    FileName = $"yomic_diagnostic_{DateTime.Now:yyyyMMdd_HHmm}.log"
                };
                if (dlg.ShowDialog(_ownerWindow) == true)
                {
                    destPath = dlg.FileName;
                }
            });

            if (string.IsNullOrWhiteSpace(destPath))
                return new { ok = false, cancelled = true };

            LogService.CloseAndFlush();

            if (File.Exists(LogService.LogFilePath))
            {
                File.Copy(LogService.LogFilePath, destPath, overwrite: true);
            }
            else
            {
                await File.WriteAllTextAsync(destPath, "Yomic Log File\r\n");
            }

            return new { ok = true, cancelled = false, path = destPath };
        }

        private Dictionary<string, object?> HandleResetSettings()
        {
            SettingsService.Reset();
            JsMangaSource.SelectedLanguage = string.Equals(SettingsService.MangaDexLanguage, "id", StringComparison.OrdinalIgnoreCase) ? "id" : "en";
            SettingsService.SaveImmediate();
            AutoUpdateTaskService.RegisterOrUpdateTask(SettingsService.AutoUpdateIntervalHours);
            _ = NetworkService.ResetConnectionsAsync();
            return BuildSettingsDictionary();
        }

        private async Task<object> HandleClearAllDataAsync()
        {
            try
            {
                // 0. Cancel active downloads
                try
                {
                    DownloadService.Pause();
                    foreach (var req in DownloadService.AllDownloads.ToList())
                    {
                        DownloadService.Cancel(req);
                    }
                    DownloadService.ClearCompleted();
                }
                catch { }

                // 1. Clear Library (DB + Downloads + Covers)
                Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
                await LibraryService.ClearDatabaseAsync();

                var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                var cacheDir = Path.Combine(localAppData, "Yomic", "Cache");
                if (Directory.Exists(cacheDir))
                {
                    try { Directory.Delete(cacheDir, true); } catch { }
                }
                var queueFile = Path.Combine(localAppData, "Yomic", "downloads_queue.json");
                if (File.Exists(queueFile))
                {
                    try { File.Delete(queueFile); } catch { }
                }

                // 2. Clear Extensions (Plugins + Cache)
                SourceManager.ClearAllCache();
                SourceManager.DeleteAllUserPlugins();
                _discoveredManga.Clear();

                // 3. Clear Settings
                SettingsService.Reset();
                SettingsService.SaveImmediate();
                AutoUpdateTaskService.RegisterOrUpdateTask(SettingsService.AutoUpdateIntervalHours);
                _ = NetworkService.ResetConnectionsAsync();

                // 4. Wait 3 seconds, schedule automatic restart, and exit current application
                _ = Task.Run(async () =>
                {
                    await Task.Delay(3000);
                    try
                    {
                        var exePath = Environment.ProcessPath;
                        if (!string.IsNullOrEmpty(exePath) && File.Exists(exePath))
                        {
                            var startInfo = new System.Diagnostics.ProcessStartInfo
                            {
                                FileName = "cmd.exe",
                                Arguments = $"/c timeout /t 1 /nobreak >nul & start \"\" \"{exePath}\"",
                                CreateNoWindow = true,
                                UseShellExecute = false,
                                WindowStyle = System.Diagnostics.ProcessWindowStyle.Hidden,
                                WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
                            };
                            System.Diagnostics.Process.Start(startInfo);
                        }
                    }
                    catch (Exception ex)
                    {
                        LogService.Error("BackendIpc", "Error scheduling auto-restart", ex);
                    }

                    try
                    {
                        _dispatcher.Invoke(() =>
                        {
                            System.Windows.Application.Current?.Shutdown();
                        });
                    }
                    catch { }
                    Environment.Exit(0);
                });

                return new
                {
                    ok = true,
                    message = L("Semua data berhasil dihapus. Aplikasi akan dimuat ulang otomatis dalam 3 detik.", "All data cleared. The application will automatically reload in 3 seconds.")
                };
            }
            catch (Exception ex)
            {
                LogService.Error("BackendIpc", "Error clearing all data", ex);
                return new
                {
                    ok = false,
                    message = L($"Gagal menghapus data: {ex.Message}", $"Failed to clear data: {ex.Message}")
                };
            }
        }

        private async Task<object> HandleCreateBackupAsync()
        {
            string? destPath = null;
            await _dispatcher.InvokeAsync(() =>
            {
                var dlg = new SaveFileDialog
                {
                    Title = L("Simpan Cadangan Yomic (.yomicbackup)", "Save Yomic Backup (.yomicbackup)"),
                    Filter = "Yomic Backup (*.yomicbackup)|*.yomicbackup|ZIP Archive (*.zip)|*.zip",
                    FileName = $"YomicBackup_{DateTime.Now:yyyyMMdd_HHmm}.yomicbackup"
                };
                if (dlg.ShowDialog(_ownerWindow) == true)
                {
                    destPath = dlg.FileName;
                }
            });

            if (string.IsNullOrWhiteSpace(destPath))
                return new { ok = false, saved = false, cancelled = true };

            SettingsService.SaveImmediate();
            bool success = await BackupService.CreateBackupAsync(destPath);
            string formattedTime = DateTime.Now.ToString("dd MMM yyyy, HH:mm");
            string formattedSize = "";

            if (success && File.Exists(destPath))
            {
                var fileInfo = new FileInfo(destPath);
                double kb = fileInfo.Length / 1024.0;
                formattedSize = kb > 1024 ? $"{(kb / 1024.0):F2} MB" : $"{kb:F0} KB";

                SettingsService.LastBackupTime = formattedTime;
                SettingsService.LastBackupSize = formattedSize;
                SettingsService.SaveImmediate();
            }

            return new
            {
                ok = success,
                saved = success,
                cancelled = false,
                lastBackupText = success
                    ? (!string.IsNullOrEmpty(formattedSize)
                        ? L($"Cadangan terakhir: {formattedTime} ({formattedSize})", $"Last backup: {formattedTime} ({formattedSize})")
                        : L($"Cadangan terakhir: {formattedTime}", $"Last backup: {formattedTime}"))
                    : L("Gagal membuat cadangan", "Failed to create backup")
            };
        }

        private async Task<object> HandleRestoreBackupAsync()
        {
            string? srcPath = null;
            await _dispatcher.InvokeAsync(() =>
            {
                var dlg = new OpenFileDialog
                {
                    Title = "Pilih Berkas Cadangan Yomic (.yomicbackup)",
                    Filter = "Yomic Backup (*.yomicbackup;*.zip)|*.yomicbackup;*.zip"
                };
                if (dlg.ShowDialog(_ownerWindow) == true)
                {
                    srcPath = dlg.FileName;
                }
            });

            if (string.IsNullOrWhiteSpace(srcPath))
                return new { ok = false, restored = false, cancelled = true };

            bool success = await BackupService.RestoreBackupAsync(srcPath);
            if (success)
            {
                SettingsService.Reload();
                AutoUpdateTaskService.RegisterOrUpdateTask(SettingsService.AutoUpdateIntervalHours);
                _ = NetworkService.ResetConnectionsAsync();

                using var restoreDb = new MangaDbContext();
                MangaDbContext.EnsureMangaColumnsExist(restoreDb);
            }

            var bootstrap = await BuildBootstrapAsync();
            return new
            {
                ok = success,
                restored = success,
                cancelled = false,
                bootstrap
            };
        }

        private async Task<Dictionary<string, object?>> HandleMalToggleConnectAsync()

        {

            if (MalService.IsConnected)

            {

                MalService.Disconnect();

                return BuildSettingsDictionary();

            }

            // Start PKCE OAuth flow with local HttpListener callback on port 49152 (mirroring Yomic v1)
            try
            {
                string verifier = MyAnimeListService.GenerateCodeVerifier();
                string authUrl = MalService.GetAuthorizationUrl(verifier);
                const string redirectUri = "http://127.0.0.1:49152/";

                using var listener = new System.Net.HttpListener();
                listener.Prefixes.Add(redirectUri);
                listener.Start();

                Process.Start(new ProcessStartInfo(authUrl) { UseShellExecute = true });

                var listenTask = listener.GetContextAsync();
                var timeoutTask = Task.Delay(TimeSpan.FromMinutes(2));

                var completedTask = await Task.WhenAny(listenTask, timeoutTask);
                if (completedTask == timeoutTask)
                {
                    try { listener.Stop(); } catch { }
                    LogService.Warning("MyAnimeList", "MyAnimeList OAuth login timed out after 2 minutes.");
                    return BuildSettingsDictionary();
                }

                var context = await listenTask;
                var request = context.Request;
                var response = context.Response;

                string? code = request.QueryString["code"];

                byte[] buffer = Encoding.UTF8.GetBytes(
                    "<html><head><meta charset=\"utf-8\"><title>Yomic Auth</title>" +
                    "<style>body { font-family: sans-serif; text-align: center; padding: 50px; background: #11111b; color: #cdd6f4; } h2 { color: #a6e3a1; }</style>" +
                    (IsEn
                        ? "</head><body><h2>Login Successful!</h2><p>MyAnimeList authorization succeeded. You may close this browser window now and return to Yomic.</p></body></html>"
                        : "</head><body><h2>Login Sukses!</h2><p>Otorisasi MyAnimeList berhasil. Anda dapat menutup jendela browser ini sekarang dan kembali ke aplikasi Yomic.</p></body></html>"));
                response.ContentLength64 = buffer.Length;
                await response.OutputStream.WriteAsync(buffer, 0, buffer.Length);
                response.OutputStream.Close();
                listener.Stop();

                if (!string.IsNullOrEmpty(code))
                {
                    bool success = await MalService.AuthenticateAsync(code, verifier);
                    if (success)
                    {
                        await MalService.FetchUserProfileNameAsync();
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", $"OAuth connection error: {ex.Message}", ex);
            }

            return BuildSettingsDictionary();

        }

        private async Task<object> HandleCheckAppUpdateAsync()
        {
            var info = await UpdateService.CheckForUpdatesAsync();
            return new
            {
                isUpdateAvailable = info.IsUpdateAvailable,
                currentVersion = info.CurrentVersion,
                latestVersion = info.LatestVersion,
                downloadUrl = info.DownloadUrl,
                releaseNotes = info.ReleaseNotes,
                publishedAt = info.PublishedAt
            };
        }

        private async Task<object> HandleInstallAppUpdateAsync(string downloadUrl)
        {
            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                var info = await UpdateService.CheckForUpdatesAsync();
                downloadUrl = info.DownloadUrl;
            }

            if (string.IsNullOrWhiteSpace(downloadUrl))
            {
                return new { ok = false, error = L("URL unduhan pembaruan tidak ditemukan.", "Update download URL not found.") };
            }

            bool ok = await UpdateService.DownloadAndInstallUpdateAsync(downloadUrl, progress =>
            {
                PushEvent("event:app-update-progress", new { progress = Math.Round(progress, 1) });
            });

            return new { ok };
        }

        private async Task<object> HandleMalSearchAsync(string query)
        {
            if (!MalService.IsConnected)
            {
                return new { ok = false, error = L("Akun MyAnimeList belum terhubung. Silakan hubungkan di menu Pengaturan.", "MyAnimeList account is not connected. Please connect it in Settings.") };
            }

            if (string.IsNullOrWhiteSpace(query))
            {
                return new { ok = true, results = new List<MalSearchResultDto>() };
            }

            var results = await MalService.SearchMangaAsync(query.Trim());
            var dtoList = results.Select(r => new MalSearchResultDto
            {
                Id = r.Id,
                Title = r.Title,
                CoverUrl = r.CoverUrl
            }).ToList();

            return new { ok = true, results = dtoList };
        }

        private async Task<object> HandleMalGetTrackAsync(JsonElement? payload)
        {
            string mangaId = GetString(payload, "mangaId");
            long remoteId = GetLong(payload, "remoteId", 0);
            var manga = await ResolveMangaAsync(mangaId);
            if (manga == null || manga.Id <= 0 || remoteId <= 0)
            {
                return new { ok = false, error = L("Parameter pelacakan tidak valid.", "Invalid tracking parameters.") };
            }

            if (!MalService.IsConnected)
            {
                return new { ok = false, error = L("Akun MyAnimeList belum terhubung.", "MyAnimeList account is not connected.") };
            }

            var remoteTrack = await MalService.FetchMangaStatusAsync(remoteId, manga.Id);
            if (remoteTrack == null)
            {
                return new { ok = false, error = L("Gagal mengambil data dari MyAnimeList.", "Failed to fetch data from MyAnimeList.") };
            }

            return new
            {
                ok = true,
                track = new
                {
                    remoteId = remoteTrack.RemoteId,
                    title = remoteTrack.Title,
                    totalChapters = remoteTrack.TotalChapters,
                    status = remoteTrack.Status,
                    score = remoteTrack.Score,
                    lastChapterRead = remoteTrack.LastChapterRead
                }
            };
        }

        private async Task<object> HandleMalSaveTrackAsync(JsonElement? payload)
        {
            string mangaId = GetString(payload, "mangaId");
            string status = GetString(payload, "status", "reading");
            int chaptersRead = GetInt(payload, "chaptersRead", 0);
            int score = GetInt(payload, "score", 0);
            long remoteId = GetLong(payload, "remoteId", 0);
            string malTitle = GetString(payload, "malTitle");

            var manga = await ResolveMangaAsync(mangaId);
            if (manga == null || manga.Id <= 0) return new { ok = false, error = "Komik tidak ditemukan." };

            using var db = new MangaDbContext();
            var track = await db.Tracks.FirstOrDefaultAsync(t => t.MangaId == manga.Id && t.TrackerName == "MyAnimeList");

            if (track == null)
            {
                if (remoteId <= 0)
                {
                    return new { ok = false, error = "Pilih entri manga MyAnimeList terlebih dahulu." };
                }

                track = new MangaTrack
                {
                    MangaId = manga.Id,
                    TrackerName = "MyAnimeList",
                    RemoteId = remoteId,
                    Title = !string.IsNullOrWhiteSpace(malTitle) ? malTitle : manga.Title,
                    TotalChapters = manga.Chapters?.Count ?? 0,
                    Status = status,
                    LastChapterRead = chaptersRead,
                    Score = score
                };
                db.Tracks.Add(track);
            }
            else
            {
                if (remoteId > 0)
                {
                    track.RemoteId = remoteId;
                }
                if (!string.IsNullOrWhiteSpace(malTitle))
                {
                    track.Title = malTitle;
                }
                track.Status = status;
                track.LastChapterRead = chaptersRead;
                track.Score = score;
            }

            await db.SaveChangesAsync();

            if (MalService.IsConnected && track.RemoteId > 0)
            {
                await MalService.UpdateMangaStatusAsync(track.RemoteId, status, chaptersRead, score);
            }

            return new
            {
                ok = true,
                track = new
                {
                    remoteId = track.RemoteId,
                    title = track.Title,
                    status = track.Status,
                    score = track.Score,
                    lastChapterRead = track.LastChapterRead
                }
            };
        }

        private async Task<object> HandleMalUnbindTrackAsync(string mangaId)

        {

            var manga = await ResolveMangaAsync(mangaId);

            if (manga != null && manga.Id > 0)

            {

                using var db = new MangaDbContext();

                var tracks = await db.Tracks.Where(t => t.MangaId == manga.Id).ToListAsync();

                db.Tracks.RemoveRange(tracks);

                await db.SaveChangesAsync();

            }

            return new { ok = true };

        }

        private async Task<object> HandleSubmitFeedbackAsync(JsonElement? payload)
        {
            var message = GetString(payload, "message").Trim();
            var category = GetString(payload, "category", "bug").Trim();
            var categoryLabel = GetString(payload, "categoryLabel", "Laporan Bug").Trim();
            var screenshotBase64 = GetString(payload, "screenshotBase64").Trim();
            var screenshotName = GetString(payload, "screenshotName").Trim();
            var screenshotMimeType = GetString(payload, "screenshotMimeType").Trim();
            var hasScreenshot = !string.IsNullOrWhiteSpace(screenshotBase64);

            if (string.IsNullOrWhiteSpace(message))
            {
                return new { ok = false, error = "Silakan tuliskan deskripsi masukan Anda terlebih dahulu." };
            }

            if (message.Length > 10000)
            {
                return new { ok = false, error = "Deskripsi masukan terlalu panjang (maksimal 10.000 karakter)." };
            }

            var url = SettingsService.FeedbackWebhookUrl;
            if (string.IsNullOrWhiteSpace(url) || url == "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE")
            {
                url = SettingsService.DefaultFeedbackWebhookUrl;
            }

            try
            {
                var appVersion = UpdateService.CURRENT_VERSION;
                var osVersion = $"{Environment.OSVersion.VersionString} ({System.Runtime.InteropServices.RuntimeInformation.OSArchitecture})";
                var language = SettingsService.AppLanguage;
                var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture);

                var requestBody = new
                {
                    targetOwnerEmail = "info.yomic@gmail.com",
                    spreadsheetName = "Yomic - Masukan Pengguna",
                    timestamp,
                    category,
                    categoryLabel,
                    message,
                    appVersion,
                    osVersion,
                    language,
                    hasScreenshot,
                    screenshotName,
                    screenshotMimeType,
                    screenshotBase64
                };

                var jsonPayload = JsonSerializer.Serialize(requestBody);

                using var handler = new System.Net.Http.HttpClientHandler { AllowAutoRedirect = false };
                using var client = new System.Net.Http.HttpClient(handler)
                {
                    Timeout = TimeSpan.FromSeconds(35)
                };

                using var content = new System.Net.Http.StringContent(jsonPayload, Encoding.UTF8, "application/json");
                var response = await client.PostAsync(url, content);

                bool isSuccess = response.IsSuccessStatusCode;
                if (response.StatusCode == System.Net.HttpStatusCode.Redirect ||
                    response.StatusCode == System.Net.HttpStatusCode.Found ||
                    response.StatusCode == System.Net.HttpStatusCode.MovedPermanently ||
                    response.StatusCode == System.Net.HttpStatusCode.SeeOther ||
                    response.StatusCode == System.Net.HttpStatusCode.TemporaryRedirect)
                {
                    var redirectLocation = response.Headers.Location?.ToString();
                    isSuccess = !string.IsNullOrWhiteSpace(redirectLocation) &&
                                redirectLocation.Contains("script.googleusercontent.com", StringComparison.OrdinalIgnoreCase);
                }

                if (isSuccess)
                {
                    SettingsService.LastFeedbackDate = DateTime.Today.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
                    SettingsService.Save();
                    LogService.Info("Feedback", $"Feedback ({categoryLabel}) sent to Google Spreadsheet (info.yomic@gmail.com).");
                    return new { ok = true };
                }

                var errorResponse = await response.Content.ReadAsStringAsync();
                LogService.Error("Feedback", $"Google Apps Script Spreadsheet error: {response.StatusCode} - {errorResponse}");
                return new { ok = false, error = L("Gagal mengirim masukan ke Google Spreadsheet. Silakan coba lagi nanti.", "Failed to send feedback to Google Spreadsheet. Please try again later.") };
            }
            catch (Exception ex)
            {
                LogService.Error("Feedback", "Error sending feedback to Google Spreadsheet", ex);
                return new { ok = false, error = L("Gagal terhubung ke server Google Spreadsheet. Periksa koneksi internet Anda.", "Failed to connect to Google Spreadsheet server. Check your internet connection.") };
            }
        }

        /* =========================================================================

         * JSON PAYLOAD EXTRACTORS

         * ========================================================================= */

        private static string ComputeShortHash(string input)

        {

            var bytes = MD5.HashData(Encoding.UTF8.GetBytes(input ?? string.Empty));

            return Convert.ToHexString(bytes).ToLowerInvariant()[..10];

        }

        private static string GetString(JsonElement? elem, string prop, string defaultVal = "")

        {

            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&

                elem.Value.TryGetProperty(prop, out var v))

            {

                if (v.ValueKind == JsonValueKind.String) return v.GetString() ?? defaultVal;

                if (v.ValueKind == JsonValueKind.Number) return v.GetRawText();

            }

            return defaultVal;

        }

        private static int GetInt(JsonElement? elem, string prop, int defaultVal = 0)

        {

            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&

                elem.Value.TryGetProperty(prop, out var v))

            {

                if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out int i)) return i;

                if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out int s)) return s;

            }

            return defaultVal;

        }

        private static long GetLong(JsonElement? elem, string prop, long defaultVal = 0)

        {

            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&

                elem.Value.TryGetProperty(prop, out var v))

            {

                if (v.ValueKind == JsonValueKind.Number && v.TryGetInt64(out long l)) return l;

                if (v.ValueKind == JsonValueKind.String && long.TryParse(v.GetString(), out long s)) return s;

            }

            return defaultVal;

        }

        private static float GetFloat(JsonElement? elem, string prop, float defaultVal = 0f)
        {
            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&
                elem.Value.TryGetProperty(prop, out var v))
            {
                if (v.ValueKind == JsonValueKind.Number && v.TryGetSingle(out float f)) return f;
                if (v.ValueKind == JsonValueKind.String && float.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out float s)) return s;
            }
            return defaultVal;
        }

        private static double GetDouble(JsonElement? elem, string prop, double defaultVal = 0.0)
        {
            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&
                elem.Value.TryGetProperty(prop, out var v))
            {
                if (v.ValueKind == JsonValueKind.Number && v.TryGetDouble(out double d)) return d;
                if (v.ValueKind == JsonValueKind.String && double.TryParse(v.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out double s)) return s;
            }
            return defaultVal;
        }

        private static bool GetBool(JsonElement? elem, string prop, bool defaultVal = false)

        {

            if (elem.HasValue && elem.Value.ValueKind == JsonValueKind.Object &&

                elem.Value.TryGetProperty(prop, out var v))

            {

                if (v.ValueKind == JsonValueKind.True) return true;

                if (v.ValueKind == JsonValueKind.False) return false;

            }

            return defaultVal;

        }

        public void Dispose()

        {

            try

            {

                DownloadService.SaveQueueSynchronously();

                AnnouncementService.Dispose();

                UpdateService.Dispose();

                SourceStatusService.Dispose();

                NetworkService.Dispose();

                LogService.CloseAndFlush();

            }

            catch { }

        }

    }

}

