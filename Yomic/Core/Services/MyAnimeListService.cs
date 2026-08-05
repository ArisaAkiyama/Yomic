using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using Yomic.Core.Models;
using System.Security.Cryptography;

namespace Yomic.Core.Services
{
    public class MyAnimeListService
    {
        private const string ClientId = "2178a6ea66e6d2c4356ab0fd4d298ce4"; // Public client ID for Yomic desktop client
        private const string RedirectUri = "http://127.0.0.1:49152/";
        private const string TokenUrl = "https://myanimelist.net/v1/oauth2/token";
        
        private readonly SettingsService _settingsService;
        private readonly HttpClient _httpClient;

        public MyAnimeListService(SettingsService settingsService)
        {
            _settingsService = settingsService;
            _httpClient = new HttpClient();
        }

        public bool IsConnected => !string.IsNullOrEmpty(_settingsService.MalAccessToken);

        public string GetAuthorizationUrl(string codeChallenge)
        {
            return $"https://myanimelist.net/v1/oauth2/authorize?response_type=code" +
                   $"&client_id={ClientId}" +
                   $"&code_challenge={codeChallenge}" +
                   $"&code_challenge_method=plain" +
                   $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}";
        }

        public static string GenerateCodeVerifier()
        {
            // Generate a secure 128 character alphanumeric string
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
            var randomBytes = new byte[128];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(randomBytes);
            }
            var result = new StringBuilder(128);
            foreach (var b in randomBytes)
            {
                result.Append(chars[b % chars.Length]);
            }
            return result.ToString();
        }

        public async Task<bool> AuthenticateAsync(string authCode, string codeVerifier)
        {
            try
            {
                var values = new Dictionary<string, string>
                {
                    { "client_id", ClientId },
                    { "grant_type", "authorization_code" },
                    { "code", authCode },
                    { "code_verifier", codeVerifier },
                    { "redirect_uri", RedirectUri }
                };

                var content = new FormUrlEncodedContent(values);
                var response = await _httpClient.PostAsync(TokenUrl, content);

                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    LogService.Error("MyAnimeList", $"Token exchange failed: {err}");
                    return false;
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                _settingsService.MalAccessToken = root.GetProperty("access_token").GetString() ?? "";
                _settingsService.MalRefreshToken = root.GetProperty("refresh_token").GetString() ?? "";
                var expiresIn = root.GetProperty("expires_in").GetInt64();
                _settingsService.MalTokenExpiresAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + (expiresIn * 1000);
                _settingsService.Save();

                LogService.Success("MyAnimeList", "Successfully authenticated with MyAnimeList!");
                return true;
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", "Authentication exception", ex);
                return false;
            }
        }

        public void Disconnect()
        {
            _settingsService.MalAccessToken = "";
            _settingsService.MalRefreshToken = "";
            _settingsService.MalTokenExpiresAt = 0;
            _settingsService.Save();
            LogService.Info("MyAnimeList", "Disconnected account.");
        }

        private async Task EnsureValidTokenAsync()
        {
            if (!IsConnected) return;

            // Refresh token 5 minutes before it expires
            var now = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (now + 300000 >= _settingsService.MalTokenExpiresAt)
            {
                await RefreshTokenAsync();
            }
        }

        private async Task<bool> RefreshTokenAsync()
        {
            try
            {
                LogService.Info("MyAnimeList", "Refreshing Access Token...");
                var values = new Dictionary<string, string>
                {
                    { "client_id", ClientId },
                    { "grant_type", "refresh_token" },
                    { "refresh_token", _settingsService.MalRefreshToken }
                };

                var content = new FormUrlEncodedContent(values);
                var response = await _httpClient.PostAsync(TokenUrl, content);

                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    LogService.Error("MyAnimeList", $"Token refresh failed: {err}");
                    return false;
                }

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                _settingsService.MalAccessToken = root.GetProperty("access_token").GetString() ?? "";
                _settingsService.MalRefreshToken = root.GetProperty("refresh_token").GetString() ?? "";
                var expiresIn = root.GetProperty("expires_in").GetInt64();
                _settingsService.MalTokenExpiresAt = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() + (expiresIn * 1000);
                _settingsService.Save();

                LogService.Success("MyAnimeList", "Token refreshed successfully.");
                return true;
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", "Token refresh exception", ex);
                return false;
            }
        }

        private async Task<HttpRequestMessage> CreateAuthenticatedRequestAsync(HttpMethod method, string url)
        {
            await EnsureValidTokenAsync();

            var req = new HttpRequestMessage(method, url);
            req.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _settingsService.MalAccessToken);
            return req;
        }

        // Search Manga on MyAnimeList
        public async Task<List<MalSearchResult>> SearchMangaAsync(string query)
        {
            var results = new List<MalSearchResult>();
            if (!IsConnected) return results;

            try
            {
                var url = $"https://api.myanimelist.net/v2/manga?q={Uri.EscapeDataString(query)}&limit=10&fields=main_picture";
                var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, url);
                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode) return results;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("data", out var dataArray))
                {
                    foreach (var item in dataArray.EnumerateArray())
                    {
                        var node = item.GetProperty("node");
                        var id = node.GetProperty("id").GetInt64();
                        var title = node.GetProperty("title").GetString() ?? "";
                        string? coverUrl = null;
                        if (node.TryGetProperty("main_picture", out var pictureObj))
                        {
                            coverUrl = pictureObj.GetProperty("medium").GetString();
                        }

                        results.Add(new MalSearchResult
                        {
                            Id = id,
                            Title = title,
                            CoverUrl = coverUrl
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", "Search exception", ex);
            }

            return results;
        }

        // Fetch User List Status for a specific MAL Manga ID
        public async Task<MangaTrack?> FetchMangaStatusAsync(long malId, long localMangaId)
        {
            if (!IsConnected) return null;

            try
            {
                var url = $"https://api.myanimelist.net/v2/manga/{malId}?fields=my_list_status,num_chapters";
                var request = await CreateAuthenticatedRequestAsync(HttpMethod.Get, url);
                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                var root = doc.RootElement;

                var title = root.GetProperty("title").GetString() ?? "";
                var totalChapters = root.TryGetProperty("num_chapters", out var chaptersProp) ? chaptersProp.GetInt32() : 0;
                
                string status = "reading";
                int score = 0;
                int readChapters = 0;

                if (root.TryGetProperty("my_list_status", out var myStatusObj))
                {
                    status = myStatusObj.TryGetProperty("status", out var sProp) ? sProp.GetString() ?? "reading" : "reading";
                    score = myStatusObj.TryGetProperty("score", out var scProp) ? scProp.GetInt32() : 0;
                    readChapters = myStatusObj.TryGetProperty("num_chapters_read", out var numProp) ? numProp.GetInt32() : 0;
                }

                return new MangaTrack
                {
                    MangaId = localMangaId,
                    RemoteId = malId,
                    Title = title,
                    TotalChapters = totalChapters,
                    Status = status,
                    Score = score,
                    LastChapterRead = readChapters
                };
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", "Fetch status exception", ex);
                return null;
            }
        }

        // Update User List Status for a Manga on MyAnimeList
        public async Task<bool> UpdateMangaStatusAsync(long malId, string status, int numChaptersRead, int score)
        {
            if (!IsConnected) return false;

            try
            {
                var url = $"https://api.myanimelist.net/v2/manga/{malId}/my_list_status";
                var request = await CreateAuthenticatedRequestAsync(HttpMethod.Patch, url);

                var values = new Dictionary<string, string>
                {
                    { "status", status },
                    { "num_chapters_read", numChaptersRead.ToString() },
                    { "score", score.ToString() }
                };

                request.Content = new FormUrlEncodedContent(values);
                var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    var err = await response.Content.ReadAsStringAsync();
                    LogService.Error("MyAnimeList", $"Update list status failed: {err}");
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                LogService.Error("MyAnimeList", "Update status exception", ex);
                return false;
            }
        }
    }

    public class MalSearchResult
    {
        public long Id { get; set; }
        public string Title { get; set; } = "";
        public string? CoverUrl { get; set; }
    }
}
