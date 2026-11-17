// WestManga Extension
var source = {
    name: "WestManga",
    baseUrl: "https://v1.westmanga.my",
    apiUrl: "https://v1.westmanga.my",
    mirrorUrls: ["https://v1.westmanga.my", "https://v1.westmanga.top"],
    currentMirrorIndex: 0,
    language: "id",
    version: "1.2.0",
    description: "West Manga extension implemented in JavaScript using Jint Engine",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/westmanga/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0d0f12",
    iconForeground: "#FFFFFF",
    isNsfw: false,
    isHasMorePages: true,
    cachedToken: null,
    tokenExpiresAt: 0,

    getVisitToken: function() {
        var nowSec = Math.floor(Date.now() / 1000);
        if (this.cachedToken && nowSec < (this.tokenExpiresAt - 60)) {
            return this.cachedToken;
        }

        for (var i = 0; i < this.mirrorUrls.length; i++) {
            var candidateBase = this.mirrorUrls[(this.currentMirrorIndex + i) % this.mirrorUrls.length];
            var tokenUrl = candidateBase + "/api/visit-token";
            try {
                var res = fetch(tokenUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": candidateBase + "/",
                        "Origin": candidateBase,
                        "Accept": "application/json, text/plain, */*"
                    }
                });

                if (res.status === 200 && res.body) {
                    var data = JSON.parse(res.body);
                    if (data && data.token) {
                        this.cachedToken = data.token;
                        this.tokenExpiresAt = data.expires_at || (nowSec + 3600);
                        this.baseUrl = candidateBase;
                        this.apiUrl = candidateBase;
                        this.currentMirrorIndex = (this.currentMirrorIndex + i) % this.mirrorUrls.length;
                        return this.cachedToken;
                    }
                }
            } catch (err) {
                log("WestManga error fetching token from " + candidateBase + ": " + err);
            }
        }

        return this.cachedToken || "";
    },

    requestApi: function(path, queryParams) {
        var token = this.getVisitToken();
        var fullPath = path + (queryParams || "");

        for (var attempt = 0; attempt < this.mirrorUrls.length; attempt++) {
            var activeBase = this.mirrorUrls[(this.currentMirrorIndex + attempt) % this.mirrorUrls.length];
            var url = activeBase + fullPath;

            try {
                var res = fetch(url, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": activeBase + "/",
                        "Origin": activeBase,
                        "Accept": "application/json, text/plain, */*",
                        "X-WM-Visit": token
                    }
                });

                if (res.status === 200) {
                    return JSON.parse(res.body);
                }

                // If unauthorized or token error (401/403), invalidate token and try once more on same mirror
                if ((res.status === 401 || res.status === 403) && attempt === 0) {
                    this.cachedToken = null;
                    token = this.getVisitToken();
                    res = fetch(url, {
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                            "Referer": activeBase + "/",
                            "Origin": activeBase,
                            "Accept": "application/json, text/plain, */*",
                            "X-WM-Visit": token
                        }
                    });
                    if (res.status === 200) {
                        return JSON.parse(res.body);
                    }
                }

                log("WestManga request to " + url + " returned status " + res.status);
            } catch (e) {
                log("WestManga request error on " + url + ": " + e);
            }

            // Switch to mirror
            this.currentMirrorIndex = (this.currentMirrorIndex + 1) % this.mirrorUrls.length;
            this.baseUrl = this.mirrorUrls[this.currentMirrorIndex];
            this.apiUrl = this.baseUrl;
        }

        return null;
    },

    ensureAbsoluteUrl: function(url) {
        if (!url) return "";
        if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) {
            return url;
        }
        if (url.indexOf("/") === 0) {
            return this.baseUrl + url;
        }
        return this.baseUrl + "/" + url;
    },

    getPopularManga: function(page) {
        return this.getApiMangaPage(page, "&orderBy=Popular");
    },

    getLatestUpdates: function(page) {
        return this.getApiMangaPage(page, "&orderBy=Update");
    },

    getSearchManga: function(query, page) {
        var params = "";
        if (query && query.trim() !== "") {
            params += "&q=" + encodeURIComponent(query);
        }
        return this.getApiMangaPage(page, params);
    },

    getMangaList: function(page, status, genre, type) {
        var params = "";

        // 1. Status Filter
        if (status === 1) {
            params += "&status=Ongoing";
        } else if (status === 2 || status === 4) {
            params += "&status=Completed";
        }

        // 2. Genre Filter
        if (genre) {
            var arr = [];
            if (Array.isArray(genre)) {
                arr = genre;
            } else if (genre.length !== undefined && typeof genre !== "string") {
                for (var i = 0; i < genre.length; i++) {
                    arr.push(genre[i]);
                }
            } else {
                arr = [genre];
            }

            for (var i = 0; i < arr.length; i++) {
                var gVal = arr[i];
                var id = this.genreMap[gVal];
                if (id !== undefined) {
                    params += "&genre%5B%5D=" + id;
                }
            }
        }

        // 3. Format/Type Filter (mapped to Country code in WestManga API)
        if (type) {
            var tArr = [];
            if (Array.isArray(type)) {
                tArr = type;
            } else if (type.length !== undefined && typeof type !== "string") {
                for (var i = 0; i < type.length; i++) {
                    tArr.push(type[i]);
                }
            } else {
                tArr = [type];
            }

            for (var i = 0; i < tArr.length; i++) {
                var t = tArr[i];
                if (t === "Manga") params += "&country=JP";
                else if (t === "Manhwa") params += "&country=KR";
                else if (t === "Manhua") params += "&country=CN";
            }
        }

        if (params !== "") {
            return this.getApiMangaPage(page, params);
        }

        return this.getPopularManga(page);
    },

    getApiMangaPage: function(page, params) {
        var appPageSize = 14;
        var apiPageSize = 20;
        var startIndex = (Math.max(1, page) - 1) * appPageSize;
        var firstApiPage = Math.floor(startIndex / apiPageSize) + 1;
        var offset = startIndex % apiPageSize;
        var collected = [];
        var sourceTotalPages = 500;

        for (var sourcePage = firstApiPage; collected.length < appPageSize && sourcePage <= sourceTotalPages; sourcePage++) {
            var pageResult = this.getRawApiMangaPage(sourcePage, params);
            sourceTotalPages = pageResult.totalPages;

            var items = pageResult.items;
            if (sourcePage === firstApiPage && offset > 0) {
                items = items.slice(offset);
            }

            collected = collected.concat(items);
            if (pageResult.items.length === 0) {
                break;
            }
        }

        if (collected.length === 0) {
            return { items: [], totalPages: page };
        }

        return {
            items: collected.slice(0, appPageSize),
            totalPages: Math.max(page, Math.ceil(sourceTotalPages * apiPageSize / appPageSize))
        };
    },

    getRawApiMangaPage: function(page, params) {
        var path = "/api/contents";
        var query = "?page=" + page + "&per_page=20&type=Comic" + (params || "");

        var json = this.requestApi(path, query);
        if (!json || !json.data) {
            return { items: [], totalPages: page };
        }

        var data = json.data || [];
        var paginator = json.paginator || {};
        var lastPage = paginator.last_page || page;

        var items = [];
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            var mangaStatus = 0;
            if (item.status) {
                var statusStr = item.status.toLowerCase();
                if (statusStr.indexOf("ongoing") !== -1) mangaStatus = 1;
                else if (statusStr.indexOf("completed") !== -1 || statusStr.indexOf("end") !== -1) mangaStatus = 2;
            }
            items.push({
                title: item.title,
                url: "/manga/" + item.slug + "/",
                thumbnailUrl: this.ensureAbsoluteUrl(item.cover),
                status: mangaStatus
            });
        }

        return {
            items: items,
            totalPages: lastPage
        };
    },

    getMangaDetails: function(url) {
        var parts = url.split("/");
        var slug = "";
        for (var i = parts.length - 1; i >= 0; i--) {
            if (parts[i] && parts[i] !== "manga") {
                slug = parts[i];
                break;
            }
        }
        if (!slug) slug = parts[2] || parts[1];

        var path = "/api/comic/" + slug;
        var json = this.requestApi(path, "");
        if (!json || !json.data) return {};

        var data = json.data;
        var status = 0;
        if (data.status) {
            var s = data.status.toLowerCase();
            if (s.indexOf("ongoing") !== -1) status = 1;
            else if (s.indexOf("completed") !== -1 || s.indexOf("end") !== -1) status = 2;
            else if (s.indexOf("hiatus") !== -1) status = 6;
        }

        var genres = [];
        if (data.country === "JP" || data.country_id === "JP") genres.push("Manga");
        else if (data.country === "CN" || data.country_id === "CN") genres.push("Manhua");
        else if (data.country === "KR" || data.country_id === "KR") genres.push("Manhwa");

        if (data.color === true) genres.push("Colored");

        if (data.genres && Array.isArray(data.genres)) {
            for (var i = 0; i < data.genres.length; i++) {
                var g = data.genres[i];
                var name = typeof g === "object" ? (g.name || g.title) : g;
                if (name) genres.push(name);
            }
        }

        var description = "";
        if (data.synopsis) {
            description += data.synopsis.replace(/<[^>]+>/g, "").trim();
        }
        if (data.alternative_name) {
            if (description !== "") description += "\n\n";
            description += "Alternative Name: " + data.alternative_name.trim();
        }

        return {
            title: data.title || "",
            url: url,
            thumbnailUrl: this.ensureAbsoluteUrl(data.cover),
            author: data.author || "",
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(url) {
        var parts = url.split("/");
        var slug = "";
        for (var i = parts.length - 1; i >= 0; i--) {
            if (parts[i] && parts[i] !== "manga") {
                slug = parts[i];
                break;
            }
        }
        if (!slug) slug = parts[2] || parts[1];

        var path = "/api/comic/" + slug;
        var json = this.requestApi(path, "");
        if (!json || !json.data || !json.data.chapters) return [];

        var chapters = [];
        var rawChapters = json.data.chapters;
        for (var i = 0; i < rawChapters.length; i++) {
            var ch = rawChapters[i];
            var dateUpload = 0;
            if (ch.updated_at && ch.updated_at.time) {
                dateUpload = ch.updated_at.time * 1000;
            } else if (ch.created_at && ch.created_at.time) {
                dateUpload = ch.created_at.time * 1000;
            }
            var numStr = ch.number !== undefined ? ch.number.toString() : (i + 1).toString();
            var chName = ch.title ? ("Chapter " + numStr + " - " + ch.title) : ("Chapter " + numStr);

            chapters.push({
                name: chName,
                url: "/" + ch.slug + "/",
                dateUpload: dateUpload
            });
        }
        return chapters;
    },

    getPageList: function(chapterUrl) {
        var parts = chapterUrl.split("/").filter(function(p) { return p && p.trim() !== ""; });
        var slug = parts.length > 0 ? parts[parts.length - 1] : chapterUrl;

        var path = "/api/v/" + slug;
        var json = this.requestApi(path, "");
        if (!json || !json.data || !json.data.images) {
            path = "/api/view/" + slug;
            json = this.requestApi(path, "");
        }

        if (!json || !json.data) return [];
        var rawImages = json.data.images || json.data;
        if (!Array.isArray(rawImages)) return [];

        var result = [];
        for (var i = 0; i < rawImages.length; i++) {
            var img = rawImages[i];
            var imgUrl = typeof img === "object" ? (img.url || img.image || img.src) : img;
            if (imgUrl) {
                result.push(this.ensureAbsoluteUrl(imgUrl));
            }
        }
        return result;
    },

    genres: [
        "Action", "Adult", "Adventure", "Comedy", "Cooking", "Demons", "Drama", "Ecchi", "Fantasy", "Game", 
        "Gender Bender", "Genderswap", "Gore", "Harem", "Historical", "Horror", "Isekai", "Josei", "Magic", 
        "Martial arts", "Mature", "Mecha", "Monsters", "Mystery", "Psychological", "Reincarnation", "Romance", 
        "School life", "Sci fi", "Seinen", "Shoujo", "Shoujo Ai", "Shounen", "Slice of Life", "Sports", 
        "Supernatural", "Thriller", "Tragedy", "Vampire"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua"
    ],

    genreMap: {
        "Action": 13,
        "Adult": 19,
        "Adventure": 4,
        "Comedy": 5,
        "Cooking": 54,
        "Demons": 64,
        "Drama": 6,
        "Ecchi": 14,
        "Fantasy": 7,
        "Game": 36,
        "Gender Bender": 149,
        "Genderswap": 157,
        "Gore": 56,
        "Harem": 17,
        "Historical": 44,
        "Horror": 211,
        "Isekai": 20,
        "Josei": 164,
        "Magic": 65,
        "Martial arts": 8,
        "Mature": 16,
        "Mecha": 22,
        "Monsters": 91,
        "Mystery": 30,
        "Psychological": 23,
        "Reincarnation": 57,
        "Romance": 15,
        "School life": 9,
        "Sci fi": 33,
        "Seinen": 18,
        "Shoujo": 110,
        "Shoujo Ai": 113,
        "Shounen": 10,
        "Slice of Life": 11,
        "Sports": 103,
        "Supernatural": 34,
        "Thriller": 170,
        "Tragedy": 92,
        "Vampire": 160
    }
};
