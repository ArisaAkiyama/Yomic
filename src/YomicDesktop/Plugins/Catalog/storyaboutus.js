/**
 * Yomic Extension: Story About Us (storyaboutus)
 * Ported from Keiyoushi id extensions-source (src/id/storyaboutus)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Story About Us",
    baseUrl: "https://storyabout-us.com",
    apiUrl: "https://storyabout-us.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Story About Us",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/storyaboutus/res/mipmap-xxhdpi/ic_launcher.png",
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

    getPopularManga: function(page) {
        let url = this.baseUrl + "/api/manga";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let list = JSON.parse(res.body) || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/" + item.id,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        return this.getPopularManga(page);
    },

    getSearchManga: function(query, page) {
        let url = this.baseUrl + "/api/manga";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let list = JSON.parse(res.body) || [];
        let q = (query || "").toLowerCase().trim();
        let filtered = list.filter(item => (item.title || "").toLowerCase().includes(q));
        let items = filtered.map(item => ({
            title: item.title,
            url: "/" + item.id,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let id = url.replace(/^\/+|\/+$/g, "");
        let durl = this.baseUrl + "/api/manga/" + id;
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let d = JSON.parse(res.body);
        if (!d) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };

        let status = 0;
        let st = (d.status || "").toLowerCase();
        if (st === "ongoing") status = 1;
        else if (st === "completed") status = 2;

        return {
            title: d.title || "",
            url: url,
            thumbnailUrl: d.cover || "",
            author: d.author || "",
            status: status,
            description: d.summary || "",
            genre: Array.isArray(d.genres) ? d.genres : []
        };
    },

    getChapterList: function(url) {
        let id = url.replace(/^\/+|\/+$/g, "");
        let durl = this.baseUrl + "/api/manga/" + id;
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) return [];
        let d = JSON.parse(res.body);
        if (!d || !d.chapters) return [];

        let sorted = d.chapters.slice().sort((a, b) => (b.number || 0) - (a.number || 0));
        return sorted.map(ch => ({
            name: "Chapter " + (ch.number || ch.chapter || ""),
            url: ch.url || ("https://cdn.storyabout-us.com/" + ch.key),
            uploadDate: ch.uploaded_at ? new Date(ch.uploaded_at).toISOString() : ""
        }));
    },

    getPageList: function(url) {
        return [url.startsWith("http") ? url : ("https://cdn.storyabout-us.com/" + url)];
    }
};