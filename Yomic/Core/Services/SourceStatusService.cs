using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Yomic.Core.Sources;

namespace Yomic.Core.Services
{
    public enum SourceStatus
    {
        Unknown = 0,
        Checking = 1,
        Online = 2,
        Warning = 3,
        Offline = 4
    }

    public class SourceStatusRecord
    {
        public SourceStatus Status { get; set; } = SourceStatus.Unknown;
        public string Tooltip { get; set; } = "Status belum diperiksa";
        public DateTime LastChecked { get; set; } = DateTime.MinValue;
    }

    public class SourceStatusService : IDisposable
    {
        private readonly SourceManager _sourceManager;
        private readonly SettingsService _settingsService;
        private readonly NetworkService _networkService;
        private readonly string _cacheFilePath;
        private readonly SemaphoreSlim _semaphore = new(3, 3); // Max 3 concurrent pings
        private readonly ConcurrentDictionary<long, SourceStatusRecord> _cache = new();
        private readonly object _fileLock = new();
        private System.Threading.Timer? _periodicTimer;
        private CancellationTokenSource? _cts;
        private bool _isDisposed;

        public event Action<long, SourceStatus, string>? SourceStatusUpdated;

        public SourceStatusService(SourceManager sourceManager, SettingsService settingsService, NetworkService networkService)
        {
            _sourceManager = sourceManager ?? throw new ArgumentNullException(nameof(sourceManager));
            _settingsService = settingsService ?? throw new ArgumentNullException(nameof(settingsService));
            _networkService = networkService ?? throw new ArgumentNullException(nameof(networkService));

            var appData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            var appDir = Path.Combine(appData, "Yomic");
            if (!Directory.Exists(appDir))
            {
                Directory.CreateDirectory(appDir);
            }
            _cacheFilePath = Path.Combine(appDir, "source_status_cache.json");

            LoadCacheFromDisk();

            _settingsService.SourceStatusRefreshIntervalMinutesChanged += OnIntervalSettingChanged;
            _sourceManager.OnSourcesChanged += OnSourcesListChanged;

            StartBackgroundLoop();
        }

        public SourceStatusRecord GetStatus(long sourceId)
        {
            if (_cache.TryGetValue(sourceId, out var record))
            {
                return record;
            }
            return new SourceStatusRecord();
        }

        public void StartBackgroundLoop()
        {
            _periodicTimer?.Dispose();

            int intervalMinutes = _settingsService.SourceStatusRefreshIntervalMinutes;
            if (intervalMinutes <= 0) intervalMinutes = 5;

            // Trigger immediate check, then repeat every interval
            _periodicTimer = new System.Threading.Timer(_ =>
            {
                _ = CheckAllSourcesAsync();
            }, null, TimeSpan.FromSeconds(2), TimeSpan.FromMinutes(intervalMinutes));
        }

        private void OnIntervalSettingChanged(int minutes)
        {
            StartBackgroundLoop();
        }

        private void OnSourcesListChanged()
        {
            _ = CheckAllSourcesAsync();
        }

        public async Task CheckAllSourcesAsync()
        {
            if (_settingsService.IsOfflineMode) return;

            var sources = _sourceManager.GetSources();
            if (!sources.Any()) return;

            _cts?.Cancel();
            _cts = new CancellationTokenSource();
            var token = _cts.Token;

            var tasks = sources.Select(source => CheckSingleSourceAsync(source, token));
            await Task.WhenAll(tasks);
        }

        public async Task CheckSingleSourceAsync(IMangaSource source, CancellationToken ct = default)
        {
            if (source == null || string.IsNullOrWhiteSpace(source.BaseUrl)) return;

            // Update state to Checking
            NotifyStatus(source.Id, SourceStatus.Checking, "Memeriksa koneksi...");

            try
            {
                await _semaphore.WaitAsync(ct);
                try
                {
                    if (ct.IsCancellationRequested)
                    {
                        var lastStatus = GetStatus(source.Id);
                        NotifyStatus(source.Id, lastStatus.Status, lastStatus.Tooltip);
                        return;
                    }

                    if (_settingsService.IsOfflineMode)
                    {
                        NotifyStatus(source.Id, SourceStatus.Offline, "Mode Offline Aktif");
                        return;
                    }

                    using var client = _networkService.CreateOptimizedHttpClient();
                    client.Timeout = TimeSpan.FromSeconds(10); // 10-second timeout allowance

                    SourceStatus status;
                    string tooltip;

                    var baseResult = await PingUrlAsync(client, source.BaseUrl, ct);
                    status = baseResult.Status;
                    tooltip = baseResult.Tooltip;

                    // Fallback check ApiUrl if BaseUrl is Offline and ApiUrl is specified
                    if (status == SourceStatus.Offline && !string.IsNullOrWhiteSpace(source.ApiUrl) && !source.ApiUrl.Equals(source.BaseUrl, StringComparison.OrdinalIgnoreCase))
                    {
                        var apiResult = await PingUrlAsync(client, source.ApiUrl, ct);
                        if (apiResult.Status != SourceStatus.Offline)
                        {
                            status = apiResult.Status;
                            tooltip = apiResult.Status == SourceStatus.Online 
                                ? $"Online (API {source.ApiUrl} terhubung)" 
                                : apiResult.Tooltip;
                        }
                    }

                    var record = new SourceStatusRecord
                    {
                        Status = status,
                        Tooltip = tooltip,
                        LastChecked = DateTime.Now
                    };

                    _cache[source.Id] = record;
                    SaveCacheToDisk();

                    NotifyStatus(source.Id, status, tooltip);
                }
                finally
                {
                    _semaphore.Release();
                }
            }
            catch (OperationCanceledException)
            {
                var lastStatus = GetStatus(source.Id);
                NotifyStatus(source.Id, lastStatus.Status, lastStatus.Tooltip);
            }
            catch (Exception ex)
            {
                var record = new SourceStatusRecord
                {
                    Status = SourceStatus.Offline,
                    Tooltip = $"Offline ({ex.Message})",
                    LastChecked = DateTime.Now
                };
                _cache[source.Id] = record;
                SaveCacheToDisk();
                NotifyStatus(source.Id, SourceStatus.Offline, record.Tooltip);
            }
        }

        private void NotifyStatus(long sourceId, SourceStatus status, string tooltip)
        {
            SourceStatusUpdated?.Invoke(sourceId, status, tooltip);
        }

        private void LoadCacheFromDisk()
        {
            lock (_fileLock)
            {
                try
                {
                    if (File.Exists(_cacheFilePath))
                    {
                        var json = File.ReadAllText(_cacheFilePath);
                        var data = JsonSerializer.Deserialize<Dictionary<long, SourceStatusRecord>>(json);
                        if (data != null)
                        {
                            foreach (var kvp in data)
                            {
                                _cache[kvp.Key] = kvp.Value;
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    LogService.Error("SourceStatusService", "Failed to load status cache", ex);
                }
            }
        }

        private async Task<(SourceStatus Status, string Tooltip)> PingUrlAsync(System.Net.Http.HttpClient client, string targetUrl, CancellationToken ct)
        {
            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, targetUrl);
                request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

                using var response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
                int statusCode = (int)response.StatusCode;

                if (response.IsSuccessStatusCode || statusCode == 301 || statusCode == 302 || statusCode == 307 || statusCode == 308)
                {
                    return (SourceStatus.Online, $"Online ({targetUrl} terhubung)");
                }
                else if (statusCode == 403 || statusCode == 429)
                {
                    return (SourceStatus.Warning, $"Warning (HTTP {statusCode} / Cloudflare - butuh bypass)");
                }
                else
                {
                    return (SourceStatus.Offline, $"Offline (HTTP {statusCode})");
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                return (SourceStatus.Offline, $"Offline ({ex.Message})");
            }
        }

        private void SaveCacheToDisk()
        {
            lock (_fileLock)
            {
                try
                {
                    var dict = _cache.ToDictionary(k => k.Key, v => v.Value);
                    var json = JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });
                    string tempPath = _cacheFilePath + ".tmp";
                    File.WriteAllText(tempPath, json);
                    File.Move(tempPath, _cacheFilePath, overwrite: true);
                }
                catch (Exception ex)
                {
                    LogService.Error("SourceStatusService", "Failed to save status cache", ex);
                }
            }
        }

        public void Dispose()
        {
            if (_isDisposed) return;
            _isDisposed = true;

            _settingsService.SourceStatusRefreshIntervalMinutesChanged -= OnIntervalSettingChanged;
            _sourceManager.OnSourcesChanged -= OnSourcesListChanged;

            _periodicTimer?.Dispose();
            _cts?.Cancel();
            _cts?.Dispose();
            _semaphore.Dispose();
        }
    }
}
