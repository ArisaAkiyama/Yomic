using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Yomic.Core.Models;

namespace Yomic.Core.Services
{
    public class AnnouncementService : IDisposable
    {
        private const string ANNOUNCEMENTS_RAW_URL = "https://raw.githubusercontent.com/ArisaAkiyama/yomic/master/announcements.json";
        private const string GITHUB_COMMITS_API_URL = "https://api.github.com/repos/ArisaAkiyama/yomic/commits/master";

        private readonly SettingsService _settingsService;
        private System.Threading.Timer? _realtimeTimer;
        private string? _lastCommitSha;
        private bool _isChecking;
        private bool _disposed;

        public List<Announcement> CachedAnnouncements { get; private set; } = new();

        public event EventHandler<List<Announcement>>? NewAnnouncementDetected;
        public event EventHandler<List<Announcement>>? AnnouncementsUpdated;

        public AnnouncementService(SettingsService settingsService)
        {
            _settingsService = settingsService;
        }

        public void StartRealtimeMonitoring(int intervalMinutes = 10)
        {
            if (_realtimeTimer != null) return;

            var period = TimeSpan.FromMinutes(Math.Max(1, intervalMinutes));
            // Trigger first check after 5 seconds, then periodically
            _realtimeTimer = new System.Threading.Timer(async _ => await PerformPeriodicCheckAsync(), null, TimeSpan.FromSeconds(5), period);
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
                Debug.WriteLine($"[AnnouncementService] Polling check error: {ex.Message}");
            }
            finally
            {
                _isChecking = false;
            }
        }

        public async Task<List<Announcement>> FetchAnnouncementsAsync()
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                // Disable cache by setting Cache-Control
                client.DefaultRequestHeaders.CacheControl = new System.Net.Http.Headers.CacheControlHeaderValue
                {
                    NoCache = true,
                    NoStore = true
                };

                var response = await client.GetStringAsync(ANNOUNCEMENTS_RAW_URL);
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
                AnnouncementsUpdated?.Invoke(this, list);
                return list;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AnnouncementService] Fetch announcements error: {ex.Message}");
                return CachedAnnouncements;
            }
        }

        public async Task CheckForNewAsync()
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");

                string latestSha = string.Empty;
                try
                {
                    var commitJsonStr = await client.GetStringAsync(GITHUB_COMMITS_API_URL);
                    var commitObj = JObject.Parse(commitJsonStr);
                    latestSha = commitObj["sha"]?.ToString() ?? string.Empty;
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[AnnouncementService] Commit SHA check error: {ex.Message}");
                }

                // If SHA hasn't changed and we already have cache, skip download
                if (!string.IsNullOrEmpty(latestSha) && string.Equals(_lastCommitSha, latestSha, StringComparison.OrdinalIgnoreCase) && CachedAnnouncements.Count > 0)
                {
                    return;
                }

                _lastCommitSha = latestSha;
                var announcements = await FetchAnnouncementsAsync();

                if (announcements.Count > 0)
                {
                    var latest = announcements[0];
                    var lastReadId = _settingsService.LastReadAnnouncementId;

                    if (!string.IsNullOrEmpty(latest.Id) && !string.Equals(latest.Id, lastReadId, StringComparison.OrdinalIgnoreCase))
                    {
                        NewAnnouncementDetected?.Invoke(this, announcements);
                    }
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AnnouncementService] CheckForNew error: {ex.Message}");
            }
        }

        public void MarkAsRead(string latestId)
        {
            if (string.IsNullOrWhiteSpace(latestId)) return;

            _settingsService.LastReadAnnouncementId = latestId;
            _settingsService.Save();
        }

        public bool HasUnreadAnnouncements()
        {
            if (CachedAnnouncements.Count == 0) return false;
            var latestId = CachedAnnouncements[0].Id;
            return !string.IsNullOrEmpty(latestId) && !string.Equals(latestId, _settingsService.LastReadAnnouncementId, StringComparison.OrdinalIgnoreCase);
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            StopRealtimeMonitoring();
        }
    }
}
