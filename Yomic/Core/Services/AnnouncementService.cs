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

        private readonly SettingsService _settingsService;
        private readonly NetworkService? _networkService;
        private System.Threading.Timer? _realtimeTimer;
        private string? _lastFetchedId;
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

        public async Task<List<Announcement>> FetchAnnouncementsAsync()
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
                    MustRevalidate = true
                };

                // Append timestamp to bypass GitHub CDN edge caching for real-time updates
                string urlWithTimestamp = $"{ANNOUNCEMENTS_RAW_URL}?t={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
                var response = await client.GetStringAsync(urlWithTimestamp);
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
                LogService.Info("AnnouncementService", $"Successfully fetched {list.Count} announcements from GitHub.");
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
