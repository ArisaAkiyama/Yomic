/**
 * Yomic Extension: Mangalay (mangalay)
 * Ported from Keiyoushi id extensions-source (src/id/mangalay)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Mangalay",
    baseUrl: "http://mangalay.blogspot.com",
    apiUrl: "http://mangalay.blogspot.com",
    language: "id",
    version: "1.0.0",
    description: "Koleksi Baca Komik di Mangalay",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mangalay/res/mipmap-xxhdpi/ic_launcher.png",
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

    cachedList: null,

    fetchIndex: function() {
        if (this.cachedList) return this.cachedList;
        let url = this.baseUrl + "/2013/04/daftar-baca-komik_20.html";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, url);
        let tables = doc.querySelectorAll(".post-body table");
        let list = [];
        for (let table of tables) {
            let a = table.querySelector("a");
            let titleEl = table.querySelector(".tr-caption");
            let img = table.querySelector("img");
            if (a) {
                let href = a.absUrl("href") || a.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                list.push({
                    title: titleEl ? titleEl.text().trim() : (a.text().trim() || "Komik"),
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        this.cachedList = list;
        return this.cachedList;
    },

    getPopularManga: function(page) {
        let items = this.fetchIndex();
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let items = this.fetchIndex();
        return { items: items, totalPages: 1 };
    },

    getSearchManga: function(query, page) {
        let list = this.fetchIndex();
        let q = (query || "").toLowerCase().trim();
        let items = list.filter(m => m.title.toLowerCase().includes(q));
        return { items: items, totalPages: 1 };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h3.post-title, h1.entry-title");

        return {
            title: titleEl ? titleEl.text().trim() : "Komik",
            url: url,
            thumbnailUrl: "",
            author: "",
            status: 2,
            description: "",
            genre: ["Manga"]
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chLinks = doc.querySelectorAll(".post-body span > a");
        let chs = [];

        for (let a of chLinks) {
            let b = a.querySelector("b");
            let href = a.absUrl("href") || a.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
            chs.push({
                name: b ? b.text().trim() : a.text().trim(),
                url: rel,
                uploadDate: ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll(".separator img");
        let list = [];

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src) list.push(src);
        }
        return list;
    }
};