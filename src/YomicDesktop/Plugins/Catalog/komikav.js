/**
 * Yomic Extension: Komik AV (komikav)
 * Ported from Keiyoushi id extensions-source (src/id/komikav)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Komik AV",
    baseUrl: "https://komikav.net",
    apiUrl: "https://komikav.net",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga & Manhwa Terlengkap di Komik AV",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komikav/res/mipmap-xxhdpi/ic_launcher.png",
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

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/popular/?page=" + (p * 3);
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/?page=" + (p * 3);
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/search/" + encodeURIComponent(query || "") + "/?page=" + (p * 3);
        return this.parseMangaList(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll("a[href^='/manga/'], a.relative.overflow-hidden");
        let items = [];
        let seen = {};

        for (let el of elements) {
            let href = el.absUrl("href") || el.attr("href") || "";
            if (!href || seen[href] || !href.includes("/manga/")) continue;
            seen[href] = true;

            let img = el.querySelector("img");
            let title = img ? (img.attr("alt") || "") : "";
            if (!title) title = el.text().trim();
            if (!title) continue;

            let thumb = img ? (img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "") : "";
            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }
        return { items: items, totalPages: (page || 1) + 1 };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.font-kghappy, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let img = doc.querySelector("meta[property='og:image']");
        let thumb = img ? img.attr("content") : "";

        let descEl = doc.querySelector("div.mt-4.w-full > p, p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        for (let p of doc.querySelectorAll("p")) {
            if (p.text().toLowerCase().includes("author")) {
                let nxt = p.nextElementSibling;
                if (nxt) author = nxt.text().trim();
            }
        }

        let status = 0;
        let sEl = doc.querySelector("div.rounded-r-full");
        if (sEl) {
            let s = sEl.text().toLowerCase();
            if (s.includes("on-going") || s.includes("ongoing")) status = 1;
            else if (s.includes("end") || s.includes("completed")) status = 2;
        }

        let genres = [];
        for (let a of doc.querySelectorAll("a[href^='/tax/genre/']")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumb,
            author: author,
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let rows = doc.querySelectorAll("a[href*='/chapter-']");
        let chapters = [];
        let seen = {};

        for (let a of rows) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let p = a.querySelector("p");
            let name = p ? p.text().trim() : a.text().trim();

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            chapters.push({
                name: name,
                url: rel,
                uploadDate: ""
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("img.imgku, #reader img, .chapter-img img");
        let pages = [];
        let seen = {};

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src && !seen[src]) {
                seen[src] = true;
                pages.push(src);
            }
        }
        return pages;
    }
};
