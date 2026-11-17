/**
 * Yomic Extension: Comicaso (comicaso)
 * Ported from Keiyoushi id extensions-source (src/id/comicaso)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Comicaso",
    baseUrl: "https://v3.comicaso.pro",
    apiUrl: "https://v3.comicaso.pro",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa di Comicaso",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/comicaso/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    requestUrl: function(url, headers) {
        let reqHeaders = headers || {};
        if (!reqHeaders["User-Agent"]) {
            reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        }
        if (!reqHeaders["X-Comicaso-Platform"]) {
            reqHeaders["X-Comicaso-Platform"] = "web";
        }
        if (!reqHeaders["Referer"]) {
            reqHeaders["Referer"] = this.baseUrl + "/";
        }
        try {
            return fetch(url, { headers: reqHeaders });
        } catch (e) {
            return null;
        }
    },

    getPopularManga: function(page) {
        let url = this.baseUrl + "/api/trending.php?period=all&limit=60";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/" + (item.source || "all") + "/" + item.slug,
            thumbnailUrl: item.thumbnail,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let offset = (p - 1) * 60;
        let url = this.baseUrl + "/api/home.php?source=all&q=&mode=update&type=all&limit=60&offset=" + offset;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/" + (item.source || "all") + "/" + item.slug,
            thumbnailUrl: item.thumbnail,
            status: 0
        }));
        return { items: items, totalPages: json.has_more ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let offset = (p - 1) * 60;
        let url = this.baseUrl + "/api/home.php?source=all&q=" + encodeURIComponent(query || "") + "&mode=update&type=all&limit=60&offset=" + offset;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/" + (item.source || "all") + "/" + item.slug,
            thumbnailUrl: item.thumbnail,
            status: 0
        }));
        return { items: items, totalPages: json.has_more ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let clean = url.replace(/^\/+|\/+$/g, "");
        let parts = clean.split("/");
        let source = parts[0] || "all";
        let slug = parts[1] || parts[0];
        let apiUrl = this.baseUrl + "/api/manga.php?source=" + source + "&slug=" + slug + "&platform=web";
        let res = this.requestUrl(apiUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };

        let desc = d.synopsis || "";
        if (d.alternative) desc += "\n\nAlternative: " + d.alternative;

        let status = 0;
        let st = (d.status || "").toLowerCase();
        if (st.includes("on-going") || st.includes("ongoing")) status = 1;
        else if (st.includes("end") || st.includes("completed")) status = 2;

        return {
            title: d.title || "",
            url: url,
            thumbnailUrl: d.thumbnail || "",
            author: d.author || "",
            status: status,
            description: desc.trim(),
            genre: d.genres || []
        };
    },

    getChapterList: function(url) {
        let clean = url.replace(/^\/+|\/+$/g, "");
        let parts = clean.split("/");
        let source = parts[0] || "all";
        let slug = parts[1] || parts[0];
        let apiUrl = this.baseUrl + "/api/manga.php?source=" + source + "&slug=" + slug + "&platform=web";
        let res = this.requestUrl(apiUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d || !d.chapters) return [];

        return d.chapters.map(ch => ({
            name: ch.title || "Chapter",
            url: "/" + source + "/" + d.slug + "/" + ch.slug + "?token=" + ch.chapter_token,
            uploadDate: ch.date ? new Date(ch.date * 1000).toISOString() : ""
        }));
    },

    getPageList: function(url) {
        let tokenParts = url.split("?token=");
        let token = tokenParts[1] || "";
        let pathParts = tokenParts[0].replace(/^\/+|\/+$/g, "").split("/");
        let source = pathParts[0] || "all";
        let manga = pathParts[1] || "";
        let chapter = pathParts[2] || "";

        let apiUrl = this.baseUrl + "/api/chapter.php?source=" + source + "&manga=" + manga + "&chapter=" + chapter + "&token=" + token;
        let res = this.requestUrl(apiUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let images = (json.data && json.data.images) ? json.data.images : [];
        return images;
    }
};