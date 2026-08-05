using System;
using System.Net.Http;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Yomic.Core.Services
{
    public class TrackerIds
    {
        public string? MyAnimeListId { get; set; }
        public string? AniListId { get; set; }
        public string? MangaUpdatesId { get; set; }
    }

    public static class MangaDexResolverService
    {
        private static readonly HttpClient _client;

        static MangaDexResolverService()
        {
            _client = new HttpClient();
            _client.Timeout = TimeSpan.FromSeconds(10); // Fail fast (10s) if request hangs/stalls
            _client.DefaultRequestHeaders.Add("User-Agent", "Yomic-Desktop/1.0.0 (https://github.com/ArisaAkiyama/yomic)");
        }

        public static async Task<TrackerIds?> ResolveTrackerIdsFromUrlAsync(string url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;

            try
            {
                // 1. Extract 36-character UUID from the URL
                var match = Regex.Match(url, @"([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", RegexOptions.IgnoreCase);
                if (!match.Success) return null;

                string uuid = match.Groups[1].Value;

                // 2. Query direct MangaDex single manga endpoint
                string apiEntryUrl = $"https://api.mangadex.org/manga/{uuid}";
                var response = await _client.GetAsync(apiEntryUrl);
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                var root = Newtonsoft.Json.Linq.JObject.Parse(json);
                var links = root["data"]?["attributes"]?["links"];
                if (links == null) return null;

                return new TrackerIds
                {
                    MyAnimeListId = links["mal"]?.ToString(),
                    AniListId = links["al"]?.ToString(),
                    MangaUpdatesId = links["mu"]?.ToString()
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDexResolver] Direct URL lookup failed: {ex.Message}");
                return null;
            }
        }

        public static async Task<TrackerIds?> ResolveTrackerIdsAsync(string localTitle)
        {
            if (string.IsNullOrWhiteSpace(localTitle)) return null;

            try
            {
                // 1. Normalize local title (remove translation flags, chapter info, etc.)
                string cleanedTitle = NormalizeTitle(localTitle);
                if (string.IsNullOrWhiteSpace(cleanedTitle)) return null;
                
                // 2. Query MangaDex search API
                string url = $"https://api.mangadex.org/manga?title={Uri.EscapeDataString(cleanedTitle)}&limit=5";
                var response = await _client.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;
                
                var json = await response.Content.ReadAsStringAsync();
                var root = Newtonsoft.Json.Linq.JObject.Parse(json);
                var data = root["data"];
                if (data == null || !data.HasValues) return null;

                // 3. Select the best match using string similarity
                var bestMatch = FindBestMatch(data, cleanedTitle);
                if (bestMatch == null) return null;

                // 4. Extract external tracker IDs from the links attribute
                var attributes = bestMatch["attributes"];
                var links = attributes?["links"];
                if (links == null) return null;

                return new TrackerIds
                {
                    MyAnimeListId = links["mal"]?.ToString(),
                    AniListId = links["al"]?.ToString(),
                    MangaUpdatesId = links["mu"]?.ToString()
                };
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[MangaDexResolver] Error: {ex.Message}");
                return null;
            }
        }

        private static string NormalizeTitle(string title)
        {
            // Remove common suffix strings like "Bahasa Indonesia", "Indo", chapter markers, and punctuation
            string cleaned = System.Text.RegularExpressions.Regex.Replace(title, 
                @"(?i)(bahasa\s+indonesia|indo|chapter\s+\d+|ch\.\d+|[-:|()[\]])", "")
                .Trim();

            // Replace multiple spaces with a single space
            return System.Text.RegularExpressions.Regex.Replace(cleaned, @"\s+", " ");
        }

        private static Newtonsoft.Json.Linq.JToken? FindBestMatch(Newtonsoft.Json.Linq.JToken data, string localTitle)
        {
            double maxSimilarity = 0.0;
            Newtonsoft.Json.Linq.JToken? best = null;

            foreach (var item in data)
            {
                var attrs = item["attributes"];
                
                // Check English title
                var titleEn = attrs?["title"]?["en"]?.ToString();
                if (titleEn != null)
                {
                    double sim = CalculateSimilarity(localTitle, titleEn);
                    if (sim > maxSimilarity)
                    {
                        maxSimilarity = sim;
                        best = item;
                    }
                }

                // Check other titles / Alt titles
                var altTitles = attrs?["altTitles"];
                if (altTitles != null)
                {
                    foreach (var alt in altTitles)
                    {
                        foreach (var prop in alt.Children<Newtonsoft.Json.Linq.JProperty>())
                        {
                            var altVal = prop.Value?.ToString();
                            if (altVal != null)
                            {
                                double sim = CalculateSimilarity(localTitle, altVal);
                                if (sim > maxSimilarity)
                                {
                                    maxSimilarity = sim;
                                    best = item;
                                }
                            }
                        }
                    }
                }
            }

            // Require at least 70% match similarity threshold
            return maxSimilarity >= 0.70 ? best : null;
        }

        private static double CalculateSimilarity(string s, string t)
        {
            if (string.IsNullOrEmpty(s)) return string.IsNullOrEmpty(t) ? 1.0 : 0.0;
            if (string.IsNullOrEmpty(t)) return 0.0;

            s = s.ToLowerInvariant();
            t = t.ToLowerInvariant();

            int n = s.Length;
            int m = t.Length;
            int[,] d = new int[n + 1, m + 1];

            for (int i = 0; i <= n; d[i, 0] = i++) { }
            for (int j = 0; j <= m; d[0, j] = j++) { }

            for (int i = 1; i <= n; i++)
            {
                for (int j = 1; j <= m; j++)
                {
                    int cost = (t[j - 1] == s[i - 1]) ? 0 : 1;
                    d[i, j] = Math.Min(Math.Min(d[i - 1, j] + 1, d[i, j - 1] + 1), d[i - 1, j - 1] + cost);
                }
            }
            return 1.0 - ((double)d[n, m] / Math.Max(n, m));
        }
    }
}
