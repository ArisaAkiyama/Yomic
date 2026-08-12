using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using System.Linq;
using System.Threading;
using System.Collections.Concurrent;
using Jint;
using Jint.Native;
using Jint.Native.Array;
using Jint.Native.Object;
using Yomic.Core.Models;

namespace Yomic.Core.Sources
{
    public class JsMangaSource : HttpSource, IFilterableMangaSource
    {
        private readonly string _scriptPath;
        private string _name = "";
        private string _baseUrl = "";
        private string _apiUrl = "";
        private string _language = "EN";
        private string _version = "1.0.0";
        private string _description = "JS Manga Source";
        private string _author = "Unknown";
        private string _iconUrl = "";
        private string _iconBackground = "#313244";
        private string _iconForeground = "#FF9900";
        private bool _isNsfw = false;
        private bool _isHasMorePages = true;
        private bool _requiresProxy = false;
        private string? _userAgent = null;

        private static readonly SemaphoreSlim _globalExecutionLimit = new(14, 14);
        private readonly ConcurrentQueue<Engine> _enginePool = new();
        private string _scriptCode = "";
        private bool _supportsStatusFilter;
        private long _id;
        private List<string> _availableGenres = new();
        private List<string> _availableFormats = new();

        private static volatile string _selectedLanguage = "en";
        public static string SelectedLanguage
        {
            get => _selectedLanguage;
            set => _selectedLanguage = value;
        }

        public override string Name => _name;
        public override string BaseUrl => _baseUrl;
        public override string ApiUrl => _apiUrl;
        public override string Language => _language;
        public override string Version => _version;
        public override string Description => _description;
        public override string Author => _author;
        public override string IconUrl => _iconUrl;
        public override string IconBackground => _iconBackground;
        public override string IconForeground => _iconForeground;
        public bool IsNsfw => _isNsfw;
        public override bool IsHasMorePages => _isHasMorePages;
        public bool SupportsStatusFilter => _supportsStatusFilter;
        public bool SupportsGenreFilter => _availableGenres.Count > 0;
        public List<string> AvailableGenres => _availableGenres;
        public bool SupportsFormatFilter => _availableFormats.Count > 0;
        public List<string> AvailableFormats => _availableFormats;
        public override bool RequiresProxy => _requiresProxy;

        protected override void ConfigureClient(System.Net.Http.HttpClient client)
        {
            base.ConfigureClient(client);
            if (!string.IsNullOrEmpty(_userAgent))
            {
                client.DefaultRequestHeaders.UserAgent.Clear();
                client.DefaultRequestHeaders.UserAgent.ParseAdd(_userAgent);
            }
        }

        public JsMangaSource(string scriptPath)
        {
            _scriptPath = scriptPath;
            Initialize();
        }

        private void Initialize()
        {
            _scriptCode = File.ReadAllText(_scriptPath);
            var engine = CreateEngine();
            _supportsStatusFilter = engine.Invoke("__hasMethod", "getMangaList").AsBoolean();

            // Read metadata properties from the "source" object
            var sourceObj = engine.GetValue("source");
            if (sourceObj != null && sourceObj.IsObject())
            {
                var obj = sourceObj.AsObject();
                
                if (obj.HasProperty("name")) _name = obj.Get("name").AsString();
                if (obj.HasProperty("baseUrl")) _baseUrl = obj.Get("baseUrl").AsString();
                if (obj.HasProperty("apiUrl")) _apiUrl = obj.Get("apiUrl").AsString();
                if (obj.HasProperty("language")) _language = obj.Get("language").AsString();
                if (obj.HasProperty("version")) _version = obj.Get("version").AsString();
                if (obj.HasProperty("description")) _description = obj.Get("description").AsString();
                if (obj.HasProperty("author")) _author = obj.Get("author").AsString();
                if (obj.HasProperty("iconUrl")) _iconUrl = obj.Get("iconUrl").AsString();
                
                if (string.IsNullOrEmpty(_iconUrl) && !string.IsNullOrEmpty(_baseUrl))
                {
                    if (Uri.TryCreate(_baseUrl, UriKind.Absolute, out var uri))
                    {
                        _iconUrl = $"https://www.google.com/s2/favicons?domain={uri.Host}&sz=128";
                    }
                }
                if (obj.HasProperty("iconBackground")) _iconBackground = obj.Get("iconBackground").AsString();
                if (obj.HasProperty("iconForeground")) _iconForeground = obj.Get("iconForeground").AsString();
                if (obj.HasProperty("isHasMorePages")) _isHasMorePages = obj.Get("isHasMorePages").AsBoolean();
                if (obj.HasProperty("isNsfw")) _isNsfw = obj.Get("isNsfw").AsBoolean();
                if (obj.HasProperty("requiresProxy")) _requiresProxy = obj.Get("requiresProxy").AsBoolean();
                if (obj.HasProperty("userAgent")) _userAgent = obj.Get("userAgent").AsString();

                if (string.IsNullOrEmpty(_userAgent) && (_name.Contains("MangaDex", StringComparison.OrdinalIgnoreCase) || _baseUrl.Contains("mangadex.org", StringComparison.OrdinalIgnoreCase)))
                {
                    _userAgent = "Yomic/1.0.3";
                }

                if (obj.HasProperty("genres"))
                {
                    _availableGenres = ParseStringListFromJs(obj.Get("genres"));
                }
                if (obj.HasProperty("formats"))
                {
                    _availableFormats = ParseStringListFromJs(obj.Get("formats"));
                }

                var idVal = obj.Get("id");
                if (idVal.IsNumber())
                {
                    _id = (long)idVal.AsNumber();
                }
                else
                {
                    _id = GenerateStableId();
                }
            }
            else
            {
                throw new Exception("Script does not define a global 'source' object.");
            }
        }

        private Engine CreateEngine()
        {
            var engine = new Engine(cfg => cfg
                .TimeoutInterval(TimeSpan.FromSeconds(30))
                .MaxStatements(200_000));

            engine.SetValue("fetch", new Func<string, JsValue, JsResponse>(FetchUrl));
            engine.SetValue("Html", new
            {
                parse = new Func<string, string, JsDocument>(HtmlParser.parse)
            });
            engine.SetValue("log", new Action<object>(o => {
                if (!SilenceLogs) Console.WriteLine($"[JS Extension Log] {o}");
            }));

            engine.Execute(_scriptCode);
            engine.Execute($"if (typeof source === 'object' && source !== null) {{ source.selectedLanguage = '{_selectedLanguage}'; }}");
            engine.Execute(@"
                globalThis.__callMethod = function(methodName, ...args) {
                    return source[methodName].apply(source, args);
                };
                globalThis.__hasMethod = function(methodName) {
                    return typeof source === 'object' && source !== null && typeof source[methodName] === 'function';
                };
            ");

            return engine;
        }

        private Engine RentEngine()
        {
            if (_enginePool.TryDequeue(out var engine))
            {
                // IMPORTANT: Always refresh selectedLanguage before reuse.
                // The engine pool caches engines, so if user changes language,
                // old engines from the pool still have the previous language.
                engine.Execute($"if (typeof source === 'object' && source !== null) {{ source.selectedLanguage = '{_selectedLanguage}'; }}");
                return engine;
            }
            return CreateEngine();
        }

        private void ReturnEngine(Engine engine)
        {
            if (_enginePool.Count < 2)
            {
                _enginePool.Enqueue(engine);
            }
        }

        private async Task<T> ExecuteJsAsync<T>(Func<Engine, T> action)
        {
            await _globalExecutionLimit.WaitAsync();
            var engine = RentEngine();
            try
            {
                return await Task.Run(() =>
                {
                    return action(engine);
                });
            }
            finally
            {
                ReturnEngine(engine);
                _globalExecutionLimit.Release();
            }
        }

        private long GenerateStableId()
        {
            var hashName = "JS_" + Name + "_" + Language;
            var hash = System.Security.Cryptography.MD5.HashData(
                System.Text.Encoding.UTF8.GetBytes(hashName));
            return BitConverter.ToInt64(hash, 0);
        }

        private JsResponse FetchUrl(string url, JsValue options)
        {
            try
            {
                var method = HttpMethod.Get;
                var headers = new Dictionary<string, string>();
                string? postBody = null;

                if (options != null && options.IsObject())
                {
                    var opts = options.AsObject();
                    var mVal = opts.Get("method");
                    if (mVal.IsString())
                    {
                        var mStr = mVal.AsString().ToUpper();
                        if (mStr == "POST") method = HttpMethod.Post;
                    }

                    var hVal = opts.Get("headers");
                    if (hVal.IsObject())
                    {
                        var hObj = hVal.AsObject();
                        foreach (var key in hObj.GetOwnPropertyKeys())
                        {
                            var keyStr = key.AsString();
                            var valStr = hObj.Get(keyStr).AsString();
                            headers[keyStr] = valStr;
                        }
                    }

                    var bVal = opts.Get("body");
                    if (bVal.IsString())
                    {
                        postBody = bVal.AsString();
                    }
                }

                // If it's a GET and no custom headers, check media type or binary bytes cleanly
                if (method == HttpMethod.Get && headers.Count == 0)
                {
                    var responseNoHead = Task.Run(() => Client.GetAsync(url)).GetAwaiter().GetResult();
                    var bytesNoHead = Task.Run(() => responseNoHead.Content.ReadAsByteArrayAsync()).GetAwaiter().GetResult();
                    var mediaTypeNoHead = responseNoHead.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() ?? "";
                    string content;
                    if (mediaTypeNoHead.Contains("protobuf") || mediaTypeNoHead.Contains("octet-stream") || bytesNoHead.Contains((byte)0))
                    {
                        content = System.Text.Encoding.Latin1.GetString(bytesNoHead);
                    }
                    else
                    {
                        content = System.Text.Encoding.UTF8.GetString(bytesNoHead);
                    }
                    return new JsResponse { body = content, status = (int)responseNoHead.StatusCode };
                }

                // Otherwise make a custom request using our client
                var request = new HttpRequestMessage(method, url)
                {
                    Version = System.Net.HttpVersion.Version20,
                    VersionPolicy = System.Net.Http.HttpVersionPolicy.RequestVersionExact
                };
                foreach (var h in headers)
                {
                    request.Headers.TryAddWithoutValidation(h.Key, h.Value);
                }
                if (postBody != null)
                {
                    request.Content = new StringContent(postBody, System.Text.Encoding.UTF8, "application/json");
                }

                var response = Task.Run(() => Client.SendAsync(request)).GetAwaiter().GetResult();
                var responseBytes = Task.Run(() => response.Content.ReadAsByteArrayAsync()).GetAwaiter().GetResult();
                var mediaType = response.Content.Headers.ContentType?.MediaType?.ToLowerInvariant() ?? "";
                string bodyText;
                if (mediaType.Contains("protobuf") || mediaType.Contains("octet-stream") || responseBytes.Contains((byte)0))
                {
                    bodyText = System.Text.Encoding.Latin1.GetString(responseBytes);
                }
                else
                {
                    bodyText = System.Text.Encoding.UTF8.GetString(responseBytes);
                }
                Console.WriteLine($"[JsMangaSource.FetchUrl] {method} {url} -> Status {(int)response.StatusCode}, Bytes {responseBytes.Length}");
                return new JsResponse { body = bodyText, status = (int)response.StatusCode };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[JsMangaSource] Fetch failed for {url}. Error: {ex}");
                return new JsResponse { body = ex.Message, status = 500 };
            }
        }
        
        public override long Id => _id;

        public override async Task<List<Manga>> GetPopularMangaAsync(int page)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getPopularManga").AsBoolean();
                if (!hasMethod) return new List<Manga>();

                var jsResult = engine.Invoke("__callMethod", "getPopularManga", page);
                return ParseMangaListFromJs(jsResult);
            });
        }

        public override async Task<List<Manga>> GetSearchMangaAsync(string query, int page)
        {
            return await ExecuteJsAsync(engine =>
            {
                var methodName = "getSearchManga";
                var hasMethod = engine.Invoke("__hasMethod", methodName).AsBoolean();
                if (!hasMethod)
                {
                    methodName = "searchManga";
                    hasMethod = engine.Invoke("__hasMethod", methodName).AsBoolean();
                }

                if (!hasMethod) return new List<Manga>();

                var jsResult = engine.Invoke("__callMethod", methodName, query, page);
                return ParseMangaListFromJs(jsResult);
            });
        }

        private (List<Manga> Items, int TotalPages) ParsePagedMangaListFromJs(Jint.Native.JsValue jsResult, int currentPage)
        {
            if (jsResult.IsArray())
            {
                var items = ParseMangaListFromJs(jsResult);
                return (items, items.Count > 0 ? currentPage + 1 : currentPage);
            }
            else if (jsResult.IsObject())
            {
                var obj = jsResult.AsObject();
                var itemsJs = obj.Get("items");
                var items = itemsJs.IsArray() ? ParseMangaListFromJs(itemsJs) : new List<Manga>();
                
                var totalPagesJs = obj.Get("totalPages");
                int totalPages = totalPagesJs.IsNumber() ? (int)totalPagesJs.AsNumber() : (items.Count > 0 ? currentPage + 1 : currentPage);
                
                return (items, totalPages);
            }
            return (new List<Manga>(), currentPage);
        }

        public async Task<(List<Manga> Items, int TotalPages)> GetLatestMangaAsync(int page)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getLatestUpdates").AsBoolean();
                if (!hasMethod) return (new List<Manga>(), page);

                var jsResult = engine.Invoke("__callMethod", "getLatestUpdates", page);
                return ParsePagedMangaListFromJs(jsResult, page);
            });
        }

        public async Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getPopularManga").AsBoolean();
                if (!hasMethod) return (new List<Manga>(), page);

                var jsResult = engine.Invoke("__callMethod", "getPopularManga", page);
                return ParsePagedMangaListFromJs(jsResult, page);
            });
        }

        public async Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status)
        {
            return await GetMangaListAsync(page, status, null, null);
        }

        public async Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status, List<string>? genres)
        {
            return await GetMangaListAsync(page, status, genres, null);
        }

        public async Task<(List<Manga> Items, int TotalPages)> GetMangaListAsync(int page, int status, List<string>? genres, List<string>? formats)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasFilteredMethod = engine.Invoke("__hasMethod", "getMangaList").AsBoolean();
                if (hasFilteredMethod)
                {
                    var genresJs = genres != null ? JsValue.FromObject(engine, genres.ToArray()) : JsValue.Undefined;
                    var formatsJs = formats != null ? JsValue.FromObject(engine, formats.ToArray()) : JsValue.Undefined;
                    var jsResult = engine.Invoke("__callMethod", "getMangaList", page, status, genresJs, formatsJs);
                    return ParsePagedMangaListFromJs(jsResult, page);
                }

                var hasMethod = engine.Invoke("__hasMethod", "getPopularManga").AsBoolean();
                if (!hasMethod) return (new List<Manga>(), page);

                var fallbackResult = engine.Invoke("__callMethod", "getPopularManga", page);
                return ParsePagedMangaListFromJs(fallbackResult, page);
            });
        }

        public override async Task<Manga> GetMangaDetailsAsync(string url)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getMangaDetails").AsBoolean();
                if (!hasMethod) return new Manga();

                var jsResult = engine.Invoke("__callMethod", "getMangaDetails", url);
                if (jsResult.IsObject())
                {
                    var obj = jsResult.AsObject();
                    var thumbUrl = GetSafeString(obj, "thumbnailUrl");
                    if (!string.IsNullOrEmpty(thumbUrl) && !string.IsNullOrEmpty(_userAgent) && !thumbUrl.Contains("|UserAgent="))
                    {
                        thumbUrl += $"|UserAgent={_userAgent}";
                    }

                    return new Manga
                    {
                        Title = GetSafeString(obj, "title"),
                        Url = GetSafeString(obj, "url"),
                        ThumbnailUrl = thumbUrl,
                        Author = GetSafeString(obj, "author"),
                        Status = (int)GetSafeNumber(obj, "status"),
                        Description = GetSafeString(obj, "description"),
                        Genre = ParseStringListFromJs(obj.Get("genre").IsUndefined() ? obj.Get("genres") : obj.Get("genre")),
                        Source = Id
                    };
                }
                return new Manga();
            });
        }

        public override async Task<List<Chapter>> GetChapterListAsync(string mangaUrl)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getChapterList").AsBoolean();
                if (!hasMethod) return new List<Chapter>();

                var jsResult = engine.Invoke("__callMethod", "getChapterList", mangaUrl);
                var list = new List<Chapter>();
                if (jsResult.IsArray())
                {
                    var arr = jsResult.AsArray();
                    for (int i = 0; i < arr.Length; i++)
                    {
                        var obj = arr.Get(i).AsObject();
                        var name = GetSafeString(obj, "name", GetSafeString(obj, "title"));
                        
                        var jsNumVal = obj.Get("chapterNumber");
                        if (jsNumVal.IsUndefined()) jsNumVal = obj.Get("chapter");
                        
                        float chapterNumber = -1;
                        if (jsNumVal.IsNumber())
                        {
                            chapterNumber = (float)jsNumVal.AsNumber();
                        }
                        else if (jsNumVal.IsString() && float.TryParse(jsNumVal.AsString(), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float parsedJsNum))
                        {
                            chapterNumber = parsedJsNum;
                        }
                        else
                        {
                            chapterNumber = ParseChapterNumber(name);
                        }

                        list.Add(new Chapter
                        {
                            Name = name,
                            Url = GetSafeString(obj, "url"),
                            DateUpload = (long)GetSafeNumber(obj, "dateUpload"),
                            ChapterNumber = chapterNumber
                        });
                    }
                }
                return list;
            });
        }

        public override async Task<List<string>> GetPageListAsync(string chapterUrl)
        {
            return await ExecuteJsAsync(engine =>
            {
                var hasMethod = engine.Invoke("__hasMethod", "getPageList").AsBoolean();
                if (!hasMethod) return new List<string>();

                var jsResult = engine.Invoke("__callMethod", "getPageList", chapterUrl);
                return ParseStringListFromJs(jsResult, true);
            });
        }

        private List<Manga> ParseMangaListFromJs(JsValue jsResult)
        {
            var list = new List<Manga>();
            var target = jsResult;
            if (jsResult.IsObject() && !jsResult.IsArray())
            {
                var obj = jsResult.AsObject();
                var itemsVal = obj.Get("items");
                if (itemsVal.IsArray())
                {
                    target = itemsVal;
                }
            }

            if (target.IsArray())
            {
                var arr = target.AsArray();
                for (int i = 0; i < arr.Length; i++)
                {
                    var item = arr.Get(i);
                    if (item.IsObject())
                    {
                        var obj = item.AsObject();
                        var thumbUrl = GetSafeString(obj, "thumbnailUrl");
                        if (!string.IsNullOrEmpty(thumbUrl) && !string.IsNullOrEmpty(_userAgent) && !thumbUrl.Contains("|UserAgent="))
                        {
                            thumbUrl += $"|UserAgent={_userAgent}";
                        }

                        list.Add(new Manga
                        {
                            Title = GetSafeString(obj, "title"),
                            Url = GetSafeString(obj, "url"),
                            ThumbnailUrl = thumbUrl,
                            Status = obj.Get("status").IsNumber() ? (int)obj.Get("status").AsNumber() : Manga.UNKNOWN,
                            Source = Id
                        });
                    }
                }
            }
            return list;
        }

        private List<string> ParseStringListFromJs(JsValue jsResult, bool isUrlList = false)
        {
            var list = new List<string>();
            if (jsResult.IsArray())
            {
                var arr = jsResult.AsArray();
                for (int i = 0; i < arr.Length; i++)
                {
                    var pageUrl = GetSafeString(arr.Get(i));
                    if (isUrlList && !string.IsNullOrEmpty(pageUrl) && !string.IsNullOrEmpty(_userAgent) && !pageUrl.Contains("|UserAgent="))
                    {
                        pageUrl += $"|UserAgent={_userAgent}";
                    }
                    list.Add(pageUrl);
                }
            }
            return list;
        }

        private static string GetSafeString(JsValue value, string defaultValue = "")
        {
            return value.IsString() ? value.AsString() : defaultValue;
        }

        private static string GetSafeString(ObjectInstance obj, string propertyName, string defaultValue = "")
        {
            if (obj == null) return defaultValue;
            var val = obj.Get(propertyName);
            return val.IsString() ? val.AsString() : defaultValue;
        }

        private static double GetSafeNumber(ObjectInstance obj, string propertyName, double defaultValue = 0)
        {
            if (obj == null) return defaultValue;
            var val = obj.Get(propertyName);
            return val.IsNumber() ? val.AsNumber() : defaultValue;
        }

        private static readonly System.Text.RegularExpressions.Regex _chapterNumberRegex = 
            new(@"\b(?:ch|chapter|chap|chp)\.?\s*([0-9]+(?:\.[0-9]+)?)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        public static float ParseChapterNumber(string name)
        {
            if (string.IsNullOrEmpty(name)) return -1;
            
            var match = _chapterNumberRegex.Match(name);
            if (match.Success && float.TryParse(match.Groups[1].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float num))
            {
                return num;
            }
            
            // Fallback: try to find any decimal number in the string
            var numbers = System.Text.RegularExpressions.Regex.Matches(name, @"([0-9]+(?:\.[0-9]+)?)");
            if (numbers.Count > 0 && float.TryParse(numbers[0].Value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out float fallbackNum))
            {
                return fallbackNum;
            }
            
            return -1;
        }
    }
}
