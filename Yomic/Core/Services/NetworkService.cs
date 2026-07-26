using System;
using System.Net.NetworkInformation;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using ReactiveUI;
using Avalonia.Threading;

namespace Yomic.Core.Services
{
    public class NetworkService : ReactiveObject, IDisposable
    {
        private bool _isOnline = true;
        public bool IsOnline
        {
            get => _isOnline;
            set => this.RaiseAndSetIfChanged(ref _isOnline, value);
        }

        public bool IsInternetAvailable => IsOnline;

        public event EventHandler<bool>? StatusChanged;
        
        private Timer? _pollingTimer;
        private readonly System.Net.Http.HttpClient _connectivityClient;
        
        // Debounce/Grace period settings
        private int _consecutiveFailures = 0;
        private const int FailureThreshold = 3; // Ditingkatkan agar lebih kebal lag spike
        private const int PollingIntervalSeconds = 60; // Cek setiap 60 detik agar tidak spam

        private readonly SettingsService _settingsService;

        public NetworkService(SettingsService settingsService)
        {
            _settingsService = settingsService;
            
            _connectivityClient = new System.Net.Http.HttpClient 
            { 
                Timeout = TimeSpan.FromSeconds(5) // Toleransi waktu tunggu dinaikkan ke 5 detik
            };
            _connectivityClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            // Initial check
            _ = CheckConnectivityAsync();

            // Hook into network availability changes (backup)
            // Hook into network availability changes
            NetworkChange.NetworkAvailabilityChanged += (s, e) =>
            {
                if (!e.IsAvailable)
                {
                    // OS reports network lost - Go offline immediately irrespective of threshold
                    Dispatcher.UIThread.Post(() => 
                    {
                        if (IsOnline)
                        {
                            IsOnline = false;
                            StatusChanged?.Invoke(this, false);
                             Interlocked.Exchange(ref _consecutiveFailures, FailureThreshold); // Sync failure count
                            LogService.Warning("Network", "Immediate Offline via OS Event.");
                        }
                    });
                }
                else
                {
                    // Network became available - verify actual internet connectivity
                    _ = CheckConnectivityAsync();
                }
            };

            // Hook into Settings Offline Mode
            _settingsService.OfflineModeChanged += (isOffline) => 
            {
                // Trigger immediate check to update status
                _ = CheckConnectivityAsync();
            };
            
            // Start polling (keep generic lambda for Timer)
            _pollingTimer = new Timer(async _ => 
            {
                await CheckConnectivityAsync();
            }, null, TimeSpan.FromSeconds(PollingIntervalSeconds), TimeSpan.FromSeconds(PollingIntervalSeconds));
        }

        // Fallback constructor for designer if needed, but better to enforce DI
        public NetworkService() : this(new SettingsService()) { }

        public async Task<bool> CheckConnectivityAsync()
        {
            // 1. Enforce Offline Mode from Settings
            if (_settingsService.IsOfflineMode)
            {
                if (IsOnline)
                {
                    IsOnline = false;
                    StatusChanged?.Invoke(this, false);
                    LogService.Info("Network", "Forced Offline via Settings.");
                }
                return false; 
            }

            try
            {
                // Use a lightweight HTTP check (204 No Content is fastest)
                using var response = await _connectivityClient.GetAsync("http://clients3.google.com/generate_204");
                var isConnected = response.IsSuccessStatusCode;
                
                if (isConnected)
                {
                    // Success: reset failure counter and immediately go online
                    Interlocked.Exchange(ref _consecutiveFailures, 0);
                    
                    if (!IsOnline)
                    {
                        IsOnline = true;
                        StatusChanged?.Invoke(this, true);
                        LogService.Success("Network", "Status changed: Online (recovered)");
                    }
                }
                else
                {
                    // Failure: increment counter
                     var currentFailures = Interlocked.Increment(ref _consecutiveFailures);
                     LogService.Debug("Network", $"Connectivity check failed. Consecutive failures: {currentFailures}/{FailureThreshold}");
                    
                    // Only go offline if threshold exceeded
                     if (Volatile.Read(ref _consecutiveFailures) >= FailureThreshold && IsOnline)
                    {
                        IsOnline = false;
                        StatusChanged?.Invoke(this, false);
                        LogService.Warning("Network", $"Status changed: Offline (after {FailureThreshold} failures)");
                    }
                }
                
                return IsOnline;
            }
            catch (Exception ex)
            {
                // Fallback: Jika HTTP gagal (mungkin masalah DNS/Proxy), coba Ping langsung ke IP Google
                try 
                {
                    using var ping = new System.Net.NetworkInformation.Ping();
                    var reply = await ping.SendPingAsync("8.8.8.8", 2000);
                    if (reply.Status == System.Net.NetworkInformation.IPStatus.Success)
                    {
                        Interlocked.Exchange(ref _consecutiveFailures, 0);
                        if (!IsOnline)
                        {
                            IsOnline = true;
                            StatusChanged?.Invoke(this, true);
                            LogService.Success("Network", "Status changed: Online (recovered via Ping fallback)");
                        }
                        return true;
                    }
                } 
                catch { }

                // Jika Ping juga gagal, maka benar-benar dihitung sebagai kegagalan
                var currentFailures = Interlocked.Increment(ref _consecutiveFailures);
                LogService.Debug("Network", $"Check exception: {ex.Message}. Consecutive failures: {currentFailures}/{FailureThreshold}");
                
                if (Volatile.Read(ref _consecutiveFailures) >= FailureThreshold && IsOnline)
                {
                    IsOnline = false;
                    StatusChanged?.Invoke(this, false);
                    LogService.Warning("Network", $"Status changed: Offline (exception, after {FailureThreshold} failures)");
                }
                return false;
            }
        }

        /// <summary>
        /// Creates an HttpClient with DNS-over-HTTPS (DoH) support to bypass ISP blocking.
        /// Uses SOCKS5 proxy when sing-box VPN is running.
        /// </summary>
        public System.Net.Http.HttpClient CreateOptimizedHttpClient()
        {
             if (_settingsService.IsOfflineMode)
             {
                 throw new System.Net.WebException("Application is in Offline Mode.");
             }

             System.Net.Http.HttpMessageHandler handler;
             int dohProvider = _settingsService.DnsOverHttpsProvider;

             if (dohProvider == 0 && OperatingSystem.IsWindows())
             {
                 handler = new System.Net.Http.WinHttpHandler
                 {
                     AutomaticDecompression = System.Net.DecompressionMethods.All,
                     EnableMultipleHttp2Connections = true,
                     SendTimeout = TimeSpan.FromSeconds(60),
                     ReceiveDataTimeout = TimeSpan.FromSeconds(60)
                 };
             }
             else
             {
                 handler = new System.Net.Http.SocketsHttpHandler
                 {
                     // Custom connection logic to use DoH resolved IP
                     ConnectCallback = async (context, token) =>
                     {
                         var host = context.DnsEndPoint.Host;
                         System.Net.IPAddress? ipAddress = null;
                         
                         if (dohProvider == 0)
                         {
                             // If DoH is disabled, just fallback immediately
                             var entry = await System.Net.Dns.GetHostEntryAsync(host, token);
                             ipAddress = entry.AddressList.FirstOrDefault();
                         }
                         else
                         {
                             // List of DoH providers (IPv4)
                             string[] dohQueries = dohProvider switch
                             {
                                 1 => new[] { "https://1.1.1.1/dns-query?name={0}&type=A", "https://cloudflare-dns.com/dns-query?name={0}&type=A" }, // Cloudflare
                                 2 => new[] { "https://8.8.8.8/resolve?name={0}&type=A", "https://dns.google/resolve?name={0}&type=A" }, // Google
                                 3 => new[] { "https://dns.adguard-dns.com/resolve?name={0}&type=A", "https://94.140.14.14/resolve?name={0}&type=A" }, // AdGuard
                                 _ => new[] { "https://8.8.8.8/resolve?name={0}&type=A" } // Fallback
                             };
                         
                             using var dohClient = new System.Net.Http.HttpClient { Timeout = TimeSpan.FromSeconds(2) };

                             foreach (var template in dohQueries)
                             {
                                 try
                                 {
                                     string dohUrl = string.Format(template, host);
                                     var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, dohUrl);
                                     request.Headers.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/dns-json"));
                                     
                                     var response = await dohClient.SendAsync(request, token);
                                     if (response.IsSuccessStatusCode)
                                     {
                                         var json = await response.Content.ReadAsStringAsync(token);
                                         var obj = Newtonsoft.Json.Linq.JObject.Parse(json);
                                         var answers = obj["Answer"];
                                         
                                         if (answers != null)
                                         {
                                             foreach (var ans in answers)
                                             {
                                                 var ipStr = ans["data"]?.ToString();
                                                 if (System.Net.IPAddress.TryParse(ipStr, out var parsedIp))
                                                 {
                                                     ipAddress = parsedIp;
                                                     break; 
                                                 }
                                             }
                                             
                                             if (ipAddress != null) break;
                                         }
                                     }
                                 }
                                 catch (Exception ex)
                                 {
                                     LogService.Debug("NetworkService", $"DoH query failed: {ex.Message}");
                                 }
                             }
                         }

                         // Fallback to standard DNS
                         if (ipAddress == null)
                         {
                             var entry = await System.Net.Dns.GetHostEntryAsync(host, token);
                             ipAddress = entry.AddressList.FirstOrDefault();
                         }
                         
                         if (ipAddress == null) throw new Exception($"Could not resolve host: {host}");

                         var socket = new System.Net.Sockets.Socket(System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
                         try
                         {
                             await socket.ConnectAsync(ipAddress, context.DnsEndPoint.Port, token);
                             return new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
                         }
                         catch
                         {
                             socket.Dispose();
                             throw;
                         }
                     },
                     SslOptions = new System.Net.Security.SslClientAuthenticationOptions
                     {
                         RemoteCertificateValidationCallback = (sender, cert, chain, errors) =>
                         {
                             if (errors == System.Net.Security.SslPolicyErrors.None) return true;
                             if (cert != null)
                             {
                                 var subject = cert.Subject;
                                 if (subject.Contains("ryzukomik", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("komikcast", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("komiku", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("shinigami", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("kiryuu", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("komikindo", StringComparison.OrdinalIgnoreCase) ||
                                     subject.Contains("mangaku", StringComparison.OrdinalIgnoreCase))
                                 {
                                     return true;
                                 }
                             }
                             return false;
                         },
                         EnabledSslProtocols = System.Security.Authentication.SslProtocols.Tls12 | System.Security.Authentication.SslProtocols.Tls13
                     },
                     PooledConnectionLifetime = TimeSpan.FromMinutes(2),
                     AutomaticDecompression = System.Net.DecompressionMethods.All,
                     UseCookies = true
                 };
             }
            
            var client = new System.Net.Http.HttpClient(handler);
            client.Timeout = TimeSpan.FromSeconds(60);
            
            // Add required headers
            client.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            client.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8");
            client.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.9");
            
            return client;
        }
        
        /// <summary>
        /// Resets all network connections by flushing DNS cache and triggering connectivity check.
        /// Call this when switching VPN on/off to ensure fresh connections.
        /// </summary>
        public async Task ResetConnectionsAsync()
        {
            try
            {
                LogService.Info("Network", "Resetting connections...");
                
                // Flush Windows DNS cache (requires cmd)
                try
                {
                    var psi = new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = "ipconfig",
                        Arguments = "/flushdns",
                        UseShellExecute = false,
                        CreateNoWindow = true,
                        RedirectStandardOutput = true
                    };
                    using var process = System.Diagnostics.Process.Start(psi);
                    process?.WaitForExit(3000);
                    LogService.Info("Network", "DNS cache flushed");
                }
                catch (Exception ex)
                {
                    LogService.Warning("Network", $"DNS flush failed (non-critical): {ex.Message}");
                }
                
                // Reset failure counter
                Interlocked.Exchange(ref _consecutiveFailures, 0);
                
                // Wait a moment for network to stabilize
                await Task.Delay(500);
                
                // Force connectivity check
                await CheckConnectivityAsync();
                
                // Raise event for UI to refresh
                ConnectionReset?.Invoke(this, EventArgs.Empty);
                
                LogService.Info("Network", "Connections reset complete");
            }
            catch (Exception ex)
            {
                LogService.Error("Network", "Error resetting connections", ex);
            }
        }
        
        /// <summary>
        /// Event raised when connections are reset. UI can subscribe to refresh data.
        /// </summary>
        public event EventHandler? ConnectionReset;
        public void Dispose()
        {
            _pollingTimer?.Dispose();
            _connectivityClient?.Dispose();
        }
    }
}
