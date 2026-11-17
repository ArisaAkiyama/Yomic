/**
 * Yomic Extension: KumoPoi (kumopoi)
 * Ported from Keiyoushi id extensions-source (src/id/kumopoi)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "KumoPoi",
    baseUrl: "https://beta.kumopoi.com",
    apiUrl: "https://api.kumopoi.com/api/v1",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Dewasa di KumoPoi",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/kumopoi/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: true,
    isHasMorePages: true,
    pageSize: 20,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    requestUrl: function(url, headers) {
        let reqHeaders = headers || {};
        if (!reqHeaders["User-Agent"]) {
            reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
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

    normalizeCover: function(c) {
        if (!c) return "";
        return c.startsWith("http") ? c : "https://api.kumopoi.com" + c;
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.apiUrl + "/comics?page=" + p + "&limit=20&sort=popular";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = (json.data && json.data.data) ? json.data.data : [];
        let items = list.map(item => ({
            title: item.title,
            url: "/comic/" + item.slug,
            thumbnailUrl: this.normalizeCover(item.coverMedium || item.cover || item.coverSmall),
            status: 0
        }));
        let meta = (json.data && json.data.meta) ? json.data.meta : {};
        return { items: items, totalPages: (meta.page < meta.totalPages) ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.apiUrl + "/comics?page=" + p + "&limit=20&sort=latest";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = (json.data && json.data.data) ? json.data.data : [];
        let items = list.map(item => ({
            title: item.title,
            url: "/comic/" + item.slug,
            thumbnailUrl: this.normalizeCover(item.coverMedium || item.cover || item.coverSmall),
            status: 0
        }));
        let meta = (json.data && json.data.meta) ? json.data.meta : {};
        return { items: items, totalPages: (meta.page < meta.totalPages) ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.apiUrl + "/comics?page=" + p + "&limit=20&search=" + encodeURIComponent(query || "") + "&sort=latest";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = (json.data && json.data.data) ? json.data.data : [];
        let items = list.map(item => ({
            title: item.title,
            url: "/comic/" + item.slug,
            thumbnailUrl: this.normalizeCover(item.coverMedium || item.cover || item.coverSmall),
            status: 0
        }));
        let meta = (json.data && json.data.meta) ? json.data.meta : {};
        return { items: items, totalPages: (meta.page < meta.totalPages) ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/comic/", "").replace(/^\/+|\/+$/g, "");
        let res = this.requestUrl(this.apiUrl + "/comics/" + slug);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };

        let status = 0;
        let st = (d.status || "").toUpperCase();
        if (st === "ONGOING") status = 1;
        else if (st === "END" || st === "COMPLETED") status = 2;

        let genres = (d.genres || []).map(g => g.name).filter(Boolean);

        return {
            title: d.title || "",
            url: url,
            thumbnailUrl: this.normalizeCover(d.coverMedium || d.cover || d.coverSmall),
            author: d.author || "",
            status: status,
            description: d.description || "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slug = url.replace("/comic/", "").replace(/^\/+|\/+$/g, "");
        let res = this.requestUrl(this.apiUrl + "/comics/" + slug);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d || !d.chapters) return [];

        return d.chapters.map(ch => ({
            name: (ch.isLocked ? "🔒 " : "") + "Chapter " + ch.number + (ch.title ? " - " + ch.title : ""),
            url: "/comic/" + slug + "/chapter/" + ch.number + "#" + ch.id,
            uploadDate: ch.publishedAt || ""
        }));
    },

    getPageList: function(url) {
        let parts = url.split("#");
        let chId = parts[1] || "";
        if (!chId) return [];

        let apiUrl = "https://api.kumopoi.com/api/v1/chapters/" + chId + "/pages";
        let res = this.requestUrl(apiUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let pages = (json.data && json.data.pages) ? json.data.pages : [];
        return pages.map(p => this.apiUrl + "/media/chapter/deliver?token=" + encodeURIComponent(p.token));
    }
};