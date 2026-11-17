/**
 * Yomic Extension: KoronaxScan (koronaxscan)
 * Ported from Keiyoushi id extensions-source (src/id/koronaxscan)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "KoronaxScan",
    baseUrl: "https://project.koronaxscan.my.id",
    apiUrl: "https://asw.koronaxscan.my.id",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Terjemahan KoronaxScan",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/koronaxscan/res/mipmap-xxhdpi/ic_launcher.png",
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

    normalizeUrl: function(url) {
        if (!url) return "";
        return url.startsWith("/") ? this.apiUrl + url : url;
    },

    fetchAllMangas: function() {
        let res = this.requestUrl(this.apiUrl + "/api/mangas");
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let list = json.data || [];
        return list.filter(item => item.project && (item.available || "all") === "all");
    },

    getPopularManga: function(page) {
        let list = this.fetchAllMangas();
        list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        let items = list.map(item => ({
            title: item.title,
            url: "/" + item.slug,
            thumbnailUrl: this.normalizeUrl(item.cover_image_url),
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let list = this.fetchAllMangas();
        let items = list.map(item => ({
            title: item.title,
            url: "/" + item.slug,
            thumbnailUrl: this.normalizeUrl(item.cover_image_url),
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getSearchManga: function(query, page) {
        let list = this.fetchAllMangas();
        let q = (query || "").toLowerCase();
        let filtered = list.filter(item => {
            let t = (item.title || "").toLowerCase();
            let alt = (item.title_alt || "").toLowerCase();
            return t.includes(q) || alt.includes(q);
        });
        let items = filtered.map(item => ({
            title: item.title,
            url: "/" + item.slug,
            thumbnailUrl: this.normalizeUrl(item.cover_image_url),
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

        getMangaList: function(page, status, genre, type, sort) {
        let list = this.fetchAllMangas();
        if (status === 1) {
            list = list.filter(item => (item.status || "").toLowerCase() === "ongoing");
        } else if (status === 2) {
            list = list.filter(item => (item.status || "").toLowerCase() === "completed");
        }
        if (sort !== "latest") {
            list.sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        }
        let items = list.map(item => ({
            title: item.title,
            url: "/" + item.slug,
            thumbnailUrl: this.normalizeUrl(item.cover_image_url),
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/detail/", "").replace(/^\/+|\/+$/g, "");
        let res = this.requestUrl(this.apiUrl + "/api/mangas/" + slug);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };

        let status = 0;
        let st = (d.status || "").toLowerCase();
        if (st === "ongoing") status = 1;
        else if (st === "completed") status = 2;
        else if (st === "hiatus") status = 3;

        let desc = d.description || "";
        if (d.title_alt) desc += "\n\nAlternative title:\n- " + d.title_alt;

        let genres = [];
        if (d.type) genres.push(d.type);
        if (Array.isArray(d.genres)) {
            for (let g of d.genres) if (g.name) genres.push(g.name);
        }

        return {
            title: d.title || "",
            url: url,
            thumbnailUrl: this.normalizeUrl(d.cover_image_url),
            author: d.author || "",
            status: status,
            description: desc.trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slug = url.replace("/detail/", "").replace(/^\/+|\/+$/g, "");
        let res = this.requestUrl(this.apiUrl + "/api/mangas/" + slug);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d || !d.chapters) return [];

        return d.chapters.map(ch => {
            let numStr = String(ch.chapter_number).replace(/\.0$/, "");
            return {
                name: (ch.isPremium ? "🔒 " : "") + "Chapter " + numStr,
                url: "/" + d.slug + "/" + numStr,
                uploadDate: ch.createdAt || ""
            };
        });
    },

    getPageList: function(url) {
        let parts = url.replace(/^\/+|\/+$/g, "").split("/");
        let slug = parts[0];
        let number = parts[1];
        let res = this.requestUrl(this.apiUrl + "/api/mangas/" + slug + "/chapter/" + number);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let pages = json.pages || [];
        return pages.map(p => this.normalizeUrl(p.image_url));
    }
};