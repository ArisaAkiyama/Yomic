using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Text.Json.Nodes;

namespace Yomic.Core.Services
{
    public class UpdateService : IDisposable
    {
        private const string GITHUB_API_URL = "https://api.github.com/repos/ArisaAkiyama/yomic/releases/latest";
        public static string CURRENT_VERSION
        {
            get
            {
                var ver = Assembly.GetExecutingAssembly().GetName().Version;
                if (ver == null || (ver.Major == 1 && ver.Minor == 0 && ver.Build == 0))
                    return "2.1.0";
                return ver.ToString(3);
            }
        }

        public class UpdateInfo
        {
            public bool IsUpdateAvailable { get; set; }
            public string CurrentVersion { get; set; } = CURRENT_VERSION;
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

        public void StartRealtimeMonitoring(int intervalMinutes = 60)
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
                using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
                client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");

                var response = await client.GetStringAsync(GITHUB_API_URL);
                var json = JsonNode.Parse(response);

                string latestVersionTag = json?["tag_name"]?.ToString() ?? string.Empty;
                string downloadUrl = json?["html_url"]?.ToString() ?? string.Empty; // Fallback
                string body = json?["body"]?.ToString() ?? string.Empty;
                string publishedAt = json?["published_at"]?.ToString() ?? string.Empty;

                // Parse exe assets
                if (json?["assets"] is JsonArray assets)
                {
                    foreach (var asset in assets)
                    {
                        var url = asset?["browser_download_url"]?.ToString();
                        var name = asset?["name"]?.ToString();
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
                string cleanLatest = latestVersionTag.TrimStart('v', 'V');
                string cleanCurrent = CURRENT_VERSION.TrimStart('v', 'V');

                if (Version.TryParse(cleanLatest, out var latest) && Version.TryParse(cleanCurrent, out var current))
                {
                    if (latest > current)
                    {
                        return new UpdateInfo
                        {
                            IsUpdateAvailable = true,
                            CurrentVersion = CURRENT_VERSION,
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
                    CurrentVersion = CURRENT_VERSION,
                    LatestVersion = string.IsNullOrEmpty(latestVersionTag) ? CURRENT_VERSION : latestVersionTag,
                    DownloadUrl = downloadUrl,
                    ReleaseNotes = body,
                    PublishedAt = publishedAt
                };
            }
            catch (Exception ex)
            {
                LogService.Warning("UpdateService", $"Update check failed: {ex.Message}");
                return new UpdateInfo
                {
                    IsUpdateAvailable = false,
                    CurrentVersion = CURRENT_VERSION,
                    LatestVersion = CURRENT_VERSION
                };
            }
        }

        public async Task<bool> DownloadAndInstallUpdateAsync(string downloadUrl, Action<double>? onProgress = null)
        {
            if (string.IsNullOrWhiteSpace(downloadUrl))
                return false;

            if (!downloadUrl.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    Process.Start(new ProcessStartInfo { FileName = downloadUrl, UseShellExecute = true });
                    return true;
                }
                catch
                {
                    return false;
                }
            }

            try
            {
                var tempPath = Path.Combine(Path.GetTempPath(), "Yomic_Update.exe");
                if (File.Exists(tempPath))
                {
                    try { File.Delete(tempPath); } catch { }
                }

                using (var client = new HttpClient())
                {
                    client.DefaultRequestHeaders.UserAgent.ParseAdd("Yomic-Desktop-App");
                    using var response = await client.GetAsync(downloadUrl, HttpCompletionOption.ResponseHeadersRead);
                    response.EnsureSuccessStatusCode();
                    var totalBytes = response.Content.Headers.ContentLength ?? -1L;
                    var canValidProgress = totalBytes > 0;

                    using var contentStream = await response.Content.ReadAsStreamAsync();
                    using var fileStream = new FileStream(tempPath, FileMode.Create, FileAccess.Write, FileShare.None, 8192, true);
                    var totalRead = 0L;
                    var buffer = new byte[8192];
                    int read;
                    while ((read = await contentStream.ReadAsync(buffer, 0, buffer.Length)) > 0)
                    {
                        await fileStream.WriteAsync(buffer, 0, read);
                        totalRead += read;
                        if (canValidProgress)
                        {
                            onProgress?.Invoke((double)totalRead / totalBytes * 100.0);
                        }
                    }
                }

                await Task.Delay(500);

                var startInfo = new ProcessStartInfo
                {
                    FileName = tempPath,
                    UseShellExecute = true,
                    Arguments = "/SILENT /SUPPRESSMSGBOXES /NORESTART"
                };

                var process = Process.Start(startInfo);
                if (process != null)
                {
                    Application.Current?.Dispatcher.Invoke(() => Application.Current.Shutdown());
                    return true;
                }
                return false;
            }
            catch (Exception ex)
            {
                LogService.Error("UpdateService", $"Download and install update failed: {ex.Message}", ex);
                try
                {
                    Process.Start(new ProcessStartInfo { FileName = downloadUrl, UseShellExecute = true });
                }
                catch { }
                return false;
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
