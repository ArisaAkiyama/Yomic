using System;
using System.Net.NetworkInformation;
using System.Threading;
using System.Threading.Tasks;
using System.Linq;
using System.ComponentModel;
using System.Text.Json.Nodes;


namespace Yomic.Core.Services
{
    public class NetworkService : INotifyPropertyChanged, IDisposable
    {
        public event PropertyChangedEventHandler? PropertyChanged;
        private void RaisePropertyChanged(string propName) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propName));
        private bool _isOnline = true;
        public bool IsOnline
        {
            get => _isOnline;
            set { if (_isOnline != value) { _isOnline = value; RaisePropertyChanged(nameof(IsOnline)); } }
        }

        public bool IsInternetAvailable => IsOnline;

        public event EventHandler<bool>? StatusChanged;
        
        private Timer? _pollingTimer;
        private readonly System.Net.Http.HttpClient _connectivityClient;
        
        // Debounce/Grace period settings
        private int _consecutiveFailures = 0;
        private const int FailureThreshold = 1; // Instant offline detection on failure
        private const int PollingIntervalSeconds = 20; // Safe 20s periodic check (OS events handle instant changes)

        private readonly SettingsService _settingsService;

        public NetworkService(SettingsService settingsService)
        {
            _settingsService = settingsService;
            
            _connectivityClient = new System.Net.Http.HttpClient 
            { 
                Timeout = TimeSpan.FromSeconds(3) // Fast 3s HTTP timeout
            };
            _connectivityClient.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

            // Initial check
            _ = CheckConnectivityAsync();

            // Hook into OS network availability & address changes for immediate detection
            NetworkChange.NetworkAvailabilityChanged += (s, e) =>
            {
                if (!e.IsAvailable)
                {
                    SetOnlineStatus(false);
                }
                else
                {
                    _ = CheckConnectivityAsync();
                }
            };

            NetworkChange.NetworkAddressChanged += (s, e) =>
            {
                _ = CheckConnectivityAsync();
            };

            // Hook into Settings Offline Mode
            _settingsService.OfflineModeChanged += (isOffline) => 
            {
                _ = CheckConnectivityAsync();
            };
            
            // Start polling timer
            _pollingTimer = new Timer(async _ => 
            {
                await CheckConnectivityAsync();
            }, null, TimeSpan.FromSeconds(PollingIntervalSeconds), TimeSpan.FromSeconds(PollingIntervalSeconds));
        }

        // Fallback constructor for designer
        public NetworkService() : this(new SettingsService()) { }

        private int _signalLevel = 3; // Default 3 (Full)
        public int SignalLevel
        {
            get => _signalLevel;
            set
            {
                if (_signalLevel != value)
                {
                    _signalLevel = value;
                    Task.Run(() =>
                    {
                        RaisePropertyChanged(nameof(SignalLevel));
                        RaisePropertyChanged(nameof(IsWifiLevel0));
                        RaisePropertyChanged(nameof(IsWifiLevel1));
                        RaisePropertyChanged(nameof(IsWifiLevel2));
                        RaisePropertyChanged(nameof(IsWifiLevel3));
                        RaisePropertyChanged(nameof(StatusTooltipText));
                    });
                }
            }
        }

        public bool IsWifiLevel0 => IsOnline && SignalLevel == 0;
        public bool IsWifiLevel1 => IsOnline && SignalLevel == 1;
        public bool IsWifiLevel2 => IsOnline && SignalLevel == 2;
        public bool IsWifiLevel3 => IsOnline && SignalLevel >= 3;

        private long _currentPingMs = 0;
        public long CurrentPingMs
        {
            get => _currentPingMs;
            set
            {
                _currentPingMs = value;
                Task.Run(() => RaisePropertyChanged(nameof(StatusTooltipText)));
            }
        }

        public string StatusTooltipText
        {
            get
            {
                if (!IsOnline) return "Offline (Diskonisi / Network Disconnected)";
                string quality = SignalLevel switch
                {
                    0 => "Weak Signal",
                    1 => "Fair Signal",
                    2 => "Good Signal",
                    _ => "Excellent Connection"
                };
                return CurrentPingMs > 0 ? $"Online ({quality} - {CurrentPingMs}ms)" : $"Online ({quality})";
            }
        }

        private async Task TriggerOnlineWaveAnimationAsync(int targetLevel)
        {
            try
            {
                for (int lvl = 0; lvl <= targetLevel; lvl++)
                {
                    SignalLevel = lvl;
                    await Task.Delay(100);
                }
            }
            catch { }
        }

        private void SetOnlineStatus(bool online, int newSignalLevel = 3)
        {
            Task.Run(() =>
            {
                bool wasOffline = !IsOnline;
                if (IsOnline != online)
                {
                    IsOnline = online;
                    StatusChanged?.Invoke(this, online);
                    LogService.Info("Network", $"Status changed: {(online ? "Online" : "Offline / Disconnected")}");
                    
                    if (online && wasOffline)
                    {
                        _ = TriggerOnlineWaveAnimationAsync(newSignalLevel);
                    }
                }
                else if (online)
                {
                    SignalLevel = newSignalLevel;
                }
            });
        }

        public async Task<bool> CheckConnectivityAsync()
        {
            // 1. Enforce Offline Mode from Settings
            if (_settingsService.IsOfflineMode)
            {
                SetOnlineStatus(false);
                return false; 
            }

            // 2. Instant OS level check: Is any network interface active?
            if (!NetworkInterface.GetIsNetworkAvailable())
            {
                SetOnlineStatus(false);
                return false;
            }

            try
            {
                var sw = System.Diagnostics.Stopwatch.StartNew();
                using var response = await _connectivityClient.GetAsync("http://clients3.google.com/generate_204");
                sw.Stop();
                var isConnected = response.IsSuccessStatusCode;
                
                if (isConnected)
                {
                    Interlocked.Exchange(ref _consecutiveFailures, 0);
                    long rtt = sw.ElapsedMilliseconds;
                    CurrentPingMs = rtt;

                    // Calculate Signal Level based on Latency / Network Quality
                    int level = rtt switch
                    {
                        < 80 => 3,   // Excellent (0-80ms) -> wifi.svg (full)
                        < 180 => 2,  // Good (80-180ms)    -> wifi-2.svg
                        < 350 => 1,  // Fair (180-350ms)   -> wifi-1.svg
                        _ => 0       // Weak (>350ms)      -> wifi-0.svg
                    };

                    SetOnlineStatus(true, level);
                    return true;
                }
                else
                {
                    var currentFailures = Interlocked.Increment(ref _consecutiveFailures);
                    if (currentFailures >= FailureThreshold)
                    {
                        SetOnlineStatus(false);
                    }
                    return IsOnline;
                }
            }
            catch (Exception)
            {
                // Fallback: Ping Google DNS 8.8.8.8 with 1.5s timeout
                try 
                {
                    using var ping = new System.Net.NetworkInformation.Ping();
                    var reply = await ping.SendPingAsync("8.8.8.8", 1500);
                    if (reply.Status == System.Net.NetworkInformation.IPStatus.Success)
                    {
                        Interlocked.Exchange(ref _consecutiveFailures, 0);
                        long rtt = reply.RoundtripTime;
                        CurrentPingMs = rtt;

                        int level = rtt switch
                        {
                            < 80 => 3,
                            < 180 => 2,
                            < 350 => 1,
                            _ => 0
                        };

                        SetOnlineStatus(true, level);
                        return true;
                    }
                } 
                catch { }

                var currentFailures = Interlocked.Increment(ref _consecutiveFailures);
                if (currentFailures >= FailureThreshold)
                {
                    SetOnlineStatus(false);
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
                     // Custom connection logic to use DoH resolved IP with fallback and per-attempt timeout
                     ConnectCallback = async (context, token) =>
                     {
                         var host = context.DnsEndPoint.Host;
                         var candidateIps = new List<System.Net.IPAddress>();
                         
                         if (dohProvider == 0)
                         {
                             // If DoH is disabled, just use System DNS directly
                             try
                             {
                                 var hostAddresses = await System.Net.Dns.GetHostAddressesAsync(host, token);
                                 candidateIps.AddRange(hostAddresses);
                             }
                             catch { }
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
                                         var obj = JsonNode.Parse(json);
                                         var answers = obj?["Answer"] as JsonArray;
                                         
                                         if (answers != null)
                                         {
                                             foreach (var ans in answers)
                                             {
                                                 var ipStr = ans?["data"]?.ToString();
                                                 if (System.Net.IPAddress.TryParse(ipStr, out var parsedIp) && !candidateIps.Contains(parsedIp))
                                                 {
                                                     candidateIps.Add(parsedIp);
                                                 }
                                             }
                                             
                                             if (candidateIps.Count > 0) break;
                                         }
                                     }
                                 }
                                 catch (Exception ex)
                                 {
                                     LogService.Debug("NetworkService", $"DoH query failed: {ex.Message}");
                                 }
                             }

                             // Append system DNS addresses as fallback candidates
                             try
                             {
                                 var hostAddresses = await System.Net.Dns.GetHostAddressesAsync(host, token);
                                 foreach (var ip in hostAddresses)
                                 {
                                     if (!candidateIps.Contains(ip))
                                     {
                                         candidateIps.Add(ip);
                                     }
                                 }
                             }
                             catch { }
                         }

                         if (candidateIps.Count == 0) throw new Exception($"Could not resolve host: {host}");

                         Exception? lastConnectEx = null;
                         foreach (var ip in candidateIps)
                         {
                             var socket = new System.Net.Sockets.Socket(ip.AddressFamily, System.Net.Sockets.SocketType.Stream, System.Net.Sockets.ProtocolType.Tcp);
                             try
                             {
                                 using var attemptCts = CancellationTokenSource.CreateLinkedTokenSource(token);
                                 attemptCts.CancelAfter(TimeSpan.FromSeconds(3)); // 3s cap per IP attempt to quickly bypass unresponsive routes

                                 await socket.ConnectAsync(ip, context.DnsEndPoint.Port, attemptCts.Token);
                                 return new System.Net.Sockets.NetworkStream(socket, ownsSocket: true);
                             }
                             catch (Exception ex)
                             {
                                 socket.Dispose();
                                 lastConnectEx = ex;
                                 if (token.IsCancellationRequested) throw;
                             }
                         }

                         throw lastConnectEx ?? new Exception($"Failed to connect to any resolved IP for {host}");
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

