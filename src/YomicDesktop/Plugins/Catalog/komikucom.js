/**
 * Yomic Extension: Komiku.com (komikucom)
 * Ported from Keiyoushi id extensions-source (src/id/komikucom)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Komiku.com",
    baseUrl: "https://01.komiku.asia",
    apiUrl: "https://01.komiku.asia",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa Terlengkap di Komiku.com",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komikucom/res/mipmap-xxhdpi/ic_launcher.png",
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

    apiBase: "https://01.komiku.asia/api/v2",

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/comics?sort=popular&page=" + p;
        return this.parseApi(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/comics?sort=update&page=" + p;
        return this.parseApi(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.apiBase + "/comics/search?q=" + encodeURIComponent(query || "") + "&page=" + p;
        return this.parseApi(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let sortParam = (sort === "latest") ? "update" : "popular";
        let url = this.apiBase + "/comics?sort=" + sortParam + "&page=" + p;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        return this.parseApi(url, p);
    },

    parseApi: function(url, page) {
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        try {
            let json = JSON.parse(res.body);
            let list = Array.isArray(json) ? json : (json.items || json.data || []);
            let items = [];
            for (let c of list) {
                let slug = c.slug || "";
                if (!slug) continue;
                items.push({
                    title: (c.title || slug).trim(),
                    url: "/manga/" + slug + "___" + (c.id || ""),
                    thumbnailUrl: c.cover || c.thumbnail || "",
                    status: 0
                });
            }
            let totalPages = page || 1;
            if (json.totalPages) totalPages = json.totalPages;
            return { items: items, totalPages: totalPages };
        } catch (e) {
            return { items: [], totalPages: page || 1 };
        }
    },

    getMangaDetails: function(url) {
        let parts = url.replace("/manga/", "").split("___");
        let slug = parts[0];
        let apiUrl = this.apiBase + "/comics/" + slug;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        try {
            let d = JSON.parse(res.body);
            let status = 0;
            let s = (d.status || "").toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;

            return {
                title: (d.title || slug).trim(),
                url: url,
                thumbnailUrl: d.cover || "",
                author: d.author || "",
                status: status,
                description: (d.synopsis || d.description || "").trim(),
                genre: d.genres || []
            };
        } catch (e) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
    },

    getChapterList: function(url) {
        let parts = url.replace("/manga/", "").split("___");
        let slug = parts[0];
        let comicId = parts[1];
        if (!comicId) {
            let detRes = this.requestUrl(this.apiBase + "/comics/" + slug, { "Accept": "application/json" });
            if (detRes && detRes.body) {
                try { comicId = JSON.parse(detRes.body).id; } catch (e) {}
            }
        }
        if (!comicId) return [];

        let apiUrl = this.apiBase + "/comics/" + comicId + "/chapters";
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        try {
            let list = JSON.parse(res.body);
            let chapters = [];
            for (let ch of list) {
                chapters.push({
                    name: (ch.title || ("Chapter " + (ch.chapterNumber || ""))).trim(),
                    url: "/" + comicId + "/" + ch.id,
                    uploadDate: ch.date || ""
                });
            }
            return chapters;
        } catch (e) {
            return [];
        }
    },

    getPageList: function(url) {
        let parts = url.split("/").filter(function(x) { return x.length > 0; });
        let comicId = parts[0];
        let chId = parts[1];
        let apiUrl = this.apiBase + "/comics/" + comicId + "/chapters/id/" + chId;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        try {
            let json = JSON.parse(res.body);
            let images = json.images || json.pages || [];
            return images.map(function(img) { return typeof img === "object" ? img.url : img; });
        } catch (e) {
            return [];
        }
    }
};
