/**
 * Yomic Extension: MikoRoku (mikoroku)
 * Ported from Keiyoushi id extensions-source (src/id/mikoroku)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "MikoRoku",
    baseUrl: "https://mikoroku.com",
    apiUrl: "https://raw.githubusercontent.com/moemaomao/mymangadata/main/all-manga.json",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga Bahasa Indonesia di MikoRoku",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mikoroku/res/mipmap-xxhdpi/ic_launcher.png",
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

    cachedCatalog: null,

    fetchCatalog: function() {
        if (this.cachedCatalog) return this.cachedCatalog;
        try {
            let res = this.requestUrl(this.apiUrl);
            if (!res || res.status !== 200 || !res.body) return [];
            this.cachedCatalog = JSON.parse(res.body) || [];
            return this.cachedCatalog;
        } catch (e) {
            return [];
        }
    },

    getPopularManga: function(page) {
        let list = this.fetchCatalog();
        let sorted = list.slice().sort((a, b) => (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0));
        let items = sorted.map(item => ({
            title: item.title,
            url: "/detail.html?slug=" + item.slug,
            thumbnailUrl: item.img,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let list = this.fetchCatalog();
        let items = list.map(item => ({
            title: item.title,
            url: "/detail.html?slug=" + item.slug,
            thumbnailUrl: item.img,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getSearchManga: function(query, page) {
        let list = this.fetchCatalog();
        let q = (query || "").toLowerCase();
        let filtered = list.filter(item => {
            let t = (item.title || "").toLowerCase();
            let alt = (item.altTitle || "").toLowerCase();
            return t.includes(q) || alt.includes(q);
        });
        let items = filtered.map(item => ({
            title: item.title,
            url: "/detail.html?slug=" + item.slug,
            thumbnailUrl: item.img,
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
        let slugMatch = url.match(/slug=([^&]+)/);
        let slug = slugMatch ? slugMatch[1] : url.replace(/^\/+|\/+$/g, "");
        let list = this.fetchCatalog();
        let item = list.find(m => m.slug === slug);
        if (!item) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let status = 0;
        let st = (item.status || "").toLowerCase();
        if (st.includes("ongoing")) status = 1;
        else if (st.includes("completed")) status = 2;

        let genres = Array.isArray(item.genres) ? item.genres : (item.genres ? [item.genres] : []);

        return {
            title: item.title || "",
            url: url,
            thumbnailUrl: item.img || "",
            author: item.author || "",
            status: status,
            description: item.desc || "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slugMatch = url.match(/slug=([^&]+)/);
        let slug = slugMatch ? slugMatch[1] : url.replace(/^\/+|\/+$/g, "");
        let list = this.fetchCatalog();
        let item = list.find(m => m.slug === slug);
        if (!item) return [];

        let chs = [];
        try {
            let feedUrl = "https://www.mikodrive.my.id/feeds/posts/default?alt=json&max-results=50&q=" + encodeURIComponent(item.title);
            let res = this.requestUrl(feedUrl);
            if (res && res.status === 200 && res.body) {
                let json = JSON.parse(res.body);
                let entries = (json.feed && json.feed.entry) ? json.feed.entry : [];
                for (let entry of entries) {
                    let title = entry.title && entry.title.$t ? entry.title.$t : "";
                    let links = entry.link || [];
                    let chUrl = "";
                    for (let l of links) {
                        if (l.rel === "alternate") {
                            chUrl = l.href;
                            break;
                        }
                    }
                    if (chUrl) {
                        chs.push({
                            name: title,
                            url: chUrl,
                            uploadDate: entry.published && entry.published.$t ? entry.published.$t : ""
                        });
                    }
                }
            }
        } catch (e) {}

        if (chs.length === 0) {
            chs.push({
                name: "Chapter 1",
                url: "/detail.html?slug=" + slug,
                uploadDate: ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        if (!url.startsWith("http")) return [];
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, url);
        let imgs = doc.querySelectorAll(".post-body img, .entry-content img, article img");
        let list = [];
        let seen = {};
        for (let img of imgs) {
            let src = img.absUrl("src") || img.absUrl("data-src") || "";
            if (src && !seen[src] && !src.includes("icon") && !src.includes("banner")) {
                seen[src] = true;
                list.push(src);
            }
        }
        return list;
    }
};