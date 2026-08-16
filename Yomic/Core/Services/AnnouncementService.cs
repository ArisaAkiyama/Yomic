using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Yomic.Core.Models;

namespace Yomic.Core.Services
{
    public class AnnouncementService : IDisposable
    {
        private const string COMMITS_ATOM_URL = "https://github.com/ArisaAkiyama/yomic/commits/master.atom";
        private const string ANNOUNCEMENTS_RAW_FALLBACK_URL = "https://raw.githubusercontent.com/ArisaAkiyama/yomic/master/announcements.json";
        private const string ANNOUNCEMENTS_RAW_COMMIT_TEMPLATE = "https://raw.githubusercontent.com/ArisaAkiyama/yomic/{0}/announcements.json";

        private readonly SettingsService _settingsService;
        private readonly NetworkService? _networkService;
        private System.Threading.Timer? _realtimeTimer;
        private string? _lastFetchedId;
        private string? _lastFetchedCommitSha;
        private bool _isChecking;
        private bool _disposed;

        public List<Announcement> CachedAnnouncements { get; private set; } = new();

        public event EventHandler<List<Announcement>>? NewAnnouncementDetected;
        public event EventHandler<List<Announcement>>? AnnouncementsUpdated;

        public AnnouncementService(SettingsService settingsService, NetworkService? networkService = null)
        {
            _settingsService = settingsService;
            _networkService = networkService;
        }

        public void StartRealtimeMonitoring(int intervalMinutes = 1)
        {
            if (_realtimeTimer != null) return;

            var period = TimeSpan.FromMinutes(Math.Max(1, intervalMinutes));
            // Trigger first check almost immediately (500ms), then periodically every minute
            _realtimeTimer = new System.Threading.Timer(async _ => await PerformPeriodicCheckAsync(), null, TimeSpan.FromMilliseconds(500), period);
        }

        public void StopRealtimeMonitoring()
        {
            _realtimeTimer?.Dispose();
            _realtimeTimer = null;
        }

        private async Task PerformPeriodicCheckAsync()
        {
            if (_isChecking || _disposed) return;
            _isChecking = true;

            try
            {
                await CheckForNewAsync();
            }
            catch (Exception ex)
            {
                LogService.Error("AnnouncementService", $"Polling check error: {ex.Message}", ex);
            }
            finally
            {
                _isChecking = false;
            }
        }

        private async Task<string?> GetLatestCommitShaAsync(HttpClient client)
        {
            try
            {
                // Atom feed is updated instantly upon git push and has NO rate limits unlike GitHub REST API
                string atomUrl = $"{COMMITS_ATOM_URL}?t={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                var atomXml = await client.GetStringAsync(atomUrl);

                if (!string.IsNullOrWhiteSpace(atomXml))
                {
                    // Match either <id>tag:github.com,2008:Grit::Commit/SHA</id> or href=".../commit/SHA"
                    var match = Regex.Match(atomXml, @"Commit/([a-f0-9]{40})", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        return match.Groups[1].Value;
                    }

                    match = Regex.Match(atomXml, @"/commit/([a-f0-9]{40})", RegexOptions.IgnoreCase);
                    if (match.Success)
                    {
                        return match.Groups[1].Value;
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Warning("AnnouncementService", $"Could not fetch commit atom feed: {ex.Message}");
            }

            return null;
        }

        public async Task<List<Announcement>> FetchAnnouncementsAsync(bool force = false)
        {
            try
            {
                using var client = _networkService != null 
                    ? _networkService.CreateOptimizedHttpClient() 
                    : new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
                
                client.Timeout = TimeSpan.FromSeconds(8);
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                client.DefaultRequestHeaders.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue
                {
                    NoCache = true,
                    NoStore = true,
                    MustRevalidate = true,
                    MaxAge = TimeSpan.Zero
                };
                client.DefaultRequestHeaders.TryAddWithoutValidation("Pragma", "no-cache");

                // Step 1: Query Git Atom Feed to get latest commit SHA (0-delay, No REST API rate limits)
                string? latestCommitSha = await GetLatestCommitShaAsync(client);

                // If commit SHA is unchanged and we already have cached announcements, no need to re-download json
                if (!force && !string.IsNullOrEmpty(latestCommitSha) && string.Equals(latestCommitSha, _lastFetchedCommitSha, StringComparison.OrdinalIgnoreCase) && CachedAnnouncements.Count > 0)
                {
                    LogService.Info("AnnouncementService", $"Commit SHA unchanged ({latestCommitSha.Substring(0, 7)}). Announcements are up-to-date ({CachedAnnouncements.Count} items).");
                    return CachedAnnouncements;
                }

                // Step 2: Fetch raw JSON using Commit SHA (Bypasses Fastly 5-minute CDN cache completely because SHA is unique)
                string targetUrl;
                if (!string.IsNullOrEmpty(latestCommitSha))
                {
                    targetUrl = string.Format(ANNOUNCEMENTS_RAW_COMMIT_TEMPLATE, latestCommitSha);
                    _lastFetchedCommitSha = latestCommitSha;
                }
                else
                {
                    targetUrl = $"{ANNOUNCEMENTS_RAW_FALLBACK_URL}?t={DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
                }

                LogService.Info("AnnouncementService", $"Fetching announcements from: {targetUrl}");
                var response = await client.GetStringAsync(targetUrl);
                var jArray = JArray.Parse(response);

                var list = new List<Announcement>();
                foreach (var item in jArray)
                {
                    var announcement = new Announcement
                    {
                        Id = item["id"]?.ToString() ?? string.Empty,
                        Title = item["title"]?.ToString() ?? string.Empty,
                        Body = item["body"]?.ToString() ?? string.Empty,
                        Date = item["date"]?.ToString() ?? string.Empty,
                        Type = item["type"]?.ToString() ?? "info",
                        Url = item["url"]?.ToString() ?? string.Empty
                    };

                    if (!string.IsNullOrWhiteSpace(announcement.Id))
                    {
                        list.Add(announcement);
                    }
                }

                CachedAnnouncements = list;
                LogService.Info("AnnouncementService", $"Successfully fetched {list.Count} announcements from GitHub (Commit: {(latestCommitSha != null && latestCommitSha.Length >= 7 ? latestCommitSha.Substring(0, 7) : "fallback")}).");
                AnnouncementsUpdated?.Invoke(this, list);
                return list;
            }
            catch (Exception ex)
            {
                LogService.Error("AnnouncementService", $"Fetch announcements error: {ex.Message}", ex);
                return CachedAnnouncements;
            }
        }

        public async Task CheckForNewAsync()
        {
            try
            {
                var announcements = await FetchAnnouncementsAsync();

                if (announcements.Count > 0)
                {
                    var latest = announcements[0];
                    var lastReadId = _settingsService.LastReadAnnouncementId;

                    if (!string.IsNullOrEmpty(latest.Id) && !string.Equals(latest.Id, lastReadId, StringComparison.OrdinalIgnoreCase))
                    {
                        if (!string.Equals(_lastFetchedId, latest.Id, StringComparison.OrdinalIgnoreCase))
                        {
                            _lastFetchedId = latest.Id;
                            LogService.Info("AnnouncementService", $"New announcement detected: {latest.Title} (ID: {latest.Id})");
                            NewAnnouncementDetected?.Invoke(this, announcements);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Error("AnnouncementService", $"CheckForNew error: {ex.Message}", ex);
            }
        }

        public void MarkAsRead(string latestId)
        {
            if (string.IsNullOrWhiteSpace(latestId)) return;

            _settingsService.LastReadAnnouncementId = latestId;
            _settingsService.Save();
            LogService.Info("AnnouncementService", $"Marked announcement as read: {latestId}");
        }

        public bool HasUnreadAnnouncements()
        {
            if (CachedAnnouncements.Count == 0) return false;
            var latestId = CachedAnnouncements[0].Id;
            var isUnread = !string.IsNullOrEmpty(latestId) && !string.Equals(latestId, _settingsService.LastReadAnnouncementId, StringComparison.OrdinalIgnoreCase);
            LogService.Info("AnnouncementService", $"Unread check: Latest ID='{latestId}', Last Read ID='{_settingsService.LastReadAnnouncementId}', HasUnread={isUnread}");
            return isUnread;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            StopRealtimeMonitoring();
        }
    }
}
