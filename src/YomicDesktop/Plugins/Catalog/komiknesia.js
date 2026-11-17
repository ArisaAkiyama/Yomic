/**
 * Yomic Extension: KomikNesia (komiknesia)
 * Ported from Keiyoushi id extensions-source (src/id/komiknesia)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "KomikNesia",
    baseUrl: "https://v2.komiknesiaku.com",
    apiUrl: "https://v2.komiknesiaku.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga & Manhwa Terjemahan Bahasa Indonesia di KomikNesia",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komiknesia/res/mipmap-xxhdpi/ic_launcher.png",
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
        if (!reqHeaders["Referer"]) {
            reqHeaders["Referer"] = this.baseUrl + "/";
        }
        try {
            return fetch(url, { headers: reqHeaders });
        } catch (e) {
            return null;
        }
    },

    apiBase: "https://api-be.komiknesia.my.id/api",

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/contents?page=" + p + "&orderBy=popular";
        return this.parseApi(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/contents?page=" + p;
        return this.parseApi(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.apiBase + "/contents?page=" + p + "&q=" + encodeURIComponent(query || "");
        return this.parseApi(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseApi: function(url, page) {
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        try {
            let json = JSON.parse(res.body);
            let data = json.data || [];
            let items = [];
            for (let m of data) {
                let slug = m.slug || m.id || "";
                if (!slug) continue;
                items.push({
                    title: (m.title || slug).trim(),
                    url: "/komik/" + slug,
                    thumbnailUrl: m.cover || m.thumbnail || "",
                    status: 0
                });
            }
            let totalPages = page || 1;
            if (json.meta && json.meta.totalPages) totalPages = json.meta.totalPages;
            return { items: items, totalPages: totalPages };
        } catch (e) {
            return { items: [], totalPages: page || 1 };
        }
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/komik/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/comic/" + slug;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        try {
            let json = JSON.parse(res.body);
            let d = json.data || {};
            let status = 0;
            let s = (d.status || "").toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;

            return {
                title: (d.title || slug).trim(),
                url: url,
                thumbnailUrl: d.cover || d.thumbnail || "",
                author: d.author || "",
                status: status,
                description: (d.synopsis || d.description || "").trim(),
                genre: d.genres ? d.genres.map(function(g) { return g.name || g; }) : []
            };
        } catch (e) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
    },

    getChapterList: function(url) {
        let slug = url.replace("/komik/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/comic/" + slug;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        try {
            let json = JSON.parse(res.body);
            let d = json.data || {};
            let chs = d.chapters || [];
            let chapters = [];
            for (let ch of chs) {
                let chSlug = ch.slug || ch.id || "";
                chapters.push({
                    name: (ch.title || ch.name || ("Chapter " + (ch.chapter || ""))).trim(),
                    url: "/view/" + chSlug,
                    uploadDate: ch.date || ""
                });
            }
            return chapters;
        } catch (e) {
            return [];
        }
    },

    getPageList: function(url) {
        let chSlug = url.replace("/view/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/chapters/slug/" + chSlug;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        try {
            let json = JSON.parse(res.body);
            let d = json.data || {};
            return d.images || [];
        } catch (e) {
            return [];
        }
    }
};
