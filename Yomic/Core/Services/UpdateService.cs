using System;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using System.Diagnostics;
using System.Reflection;

namespace Yomic.Core.Services
{
    public class UpdateService : IDisposable
    {
        private const string GITHUB_API_URL = "https://api.github.com/repos/ArisaAkiyama/yomic/releases/latest";
        public static string CURRENT_VERSION => Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0";

        public class UpdateInfo
        {
            public bool IsUpdateAvailable { get; set; }
            public string LatestVersion { get; set; } = string.Empty;
            public string DownloadUrl { get; set; } = string.Empty;
            public string ReleaseNotes { get; set; } = string.Empty;
            public string PublishedAt { get; set; } = string.Empty;
        }

        public event EventHandler<UpdateInfo>? UpdateAvailableDetected;

        private System.Threading.Timer? _realtimeTimer;
        private string? _lastNotifiedTag;
        private bool _isChecking;
        private bool _disposed;

        public void StartRealtimeMonitoring(int intervalMinutes = 3)
        {
            if (_realtimeTimer != null) return;

            var period = TimeSpan.FromMinutes(Math.Max(1, intervalMinutes));
            // Trigger first check after 3 seconds, then periodically every period
            _realtimeTimer = new System.Threading.Timer(async _ => await PerformPeriodicCheckAsync(), null, TimeSpan.FromSeconds(3), period);
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
                var info = await CheckForUpdatesAsync();
                if (info.IsUpdateAvailable && !string.Equals(_lastNotifiedTag, info.LatestVersion, StringComparison.OrdinalIgnoreCase))
                {
                    _lastNotifiedTag = info.LatestVersion;
                    UpdateAvailableDetected?.Invoke(this, info);
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[UpdateService] Realtime polling check error: {ex.Message}");
            }
            finally
            {
                _isChecking = false;
            }
        }

        public async Task<UpdateInfo> CheckForUpdatesAsync()
        {
            try
            {
                using var client = new HttpClient();
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");

                var response = await client.GetStringAsync(GITHUB_API_URL);
                var json = JObject.Parse(response);

                string latestVersionTag = json["tag_name"]?.ToString() ?? string.Empty;
                string downloadUrl = json["html_url"]?.ToString() ?? string.Empty; // Fallback
                string body = json["body"]?.ToString() ?? string.Empty;
                string publishedAt = json["published_at"]?.ToString() ?? string.Empty;

                // Parse exe assets
                var assets = json["assets"] as JArray;
                if (assets != null)
                {
                    foreach (var asset in assets)
                    {
                        var url = asset["browser_download_url"]?.ToString();
                        var name = asset["name"]?.ToString();
                        if (!string.IsNullOrEmpty(url) && 
                            !string.IsNullOrEmpty(name) && 
                            name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                        {
                            downloadUrl = url;
                            break;
                        }
                    }
                }

                // Clean up version string (remove 'v' prefix if present)
                string cleanLatest = latestVersionTag.TrimStart('v');
                string cleanCurrent = CURRENT_VERSION.TrimStart('v');

                if (Version.TryParse(cleanLatest, out var latest) && Version.TryParse(cleanCurrent, out var current))
                {
                    if (latest > current)
                    {
                        return new UpdateInfo
                        {
                            IsUpdateAvailable = true,
                            LatestVersion = latestVersionTag,
                            DownloadUrl = downloadUrl,
                            ReleaseNotes = body,
                            PublishedAt = publishedAt
                        };
                    }
                }

                return new UpdateInfo
                {
                    IsUpdateAvailable = false,
                    LatestVersion = latestVersionTag,
                    ReleaseNotes = body,
                    PublishedAt = publishedAt
                };
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[UpdateService] Update check failed: {ex.Message}");
                return new UpdateInfo { IsUpdateAvailable = false };
            }
        }

        public void ResetLastNotifiedTag()
        {
            _lastNotifiedTag = null;
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            StopRealtimeMonitoring();
        }
    }
}
