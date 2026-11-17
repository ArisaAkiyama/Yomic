/**
 * Yomic Extension: TheManga (themanga)
 * Ported from Keiyoushi id extensions-source (src/id/themanga)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "TheManga",
    baseUrl: "https://themanga.site",
    apiUrl: "https://themanga.site",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa di TheManga",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/themanga/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/?q=&sort=popular&page=" + p;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll("a.card, a.manga-card");
        let items = [];
        for (let card of cards) {
            let titleEl = card.querySelector(".card-title");
            let img = card.querySelector("img");
            let href = card.attr("href") || "";
            if (titleEl && href) {
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                items.push({
                    title: titleEl.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/?q=&sort=latest_update&page=" + p;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll("a.card, a.manga-card");
        let items = [];
        for (let card of cards) {
            let titleEl = card.querySelector(".card-title");
            let img = card.querySelector("img");
            let href = card.attr("href") || "";
            if (titleEl && href) {
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                items.push({
                    title: titleEl.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/explore?q=" + encodeURIComponent(query || "") + "&page=" + p;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll("a.card, a.manga-card");
        let items = [];
        for (let card of cards) {
            let titleEl = card.querySelector(".card-title");
            let img = card.querySelector("img");
            let href = card.attr("href") || "";
            if (titleEl && href) {
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                items.push({
                    title: titleEl.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let order = (sort === "latest") ? "latest" : "popular";
        let url = `${this.baseUrl}/explore?order=${order}&page=${p}`;
        return this.parseGrid(url, p);
    },

    getMangaDetails: function(url) {
        let fullUrl = (url.startsWith("http") ? url : this.baseUrl + url) + "?all=1";
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector(".hero-title");
        let coverEl = doc.querySelector(".hero-cover img");
        let synEl = doc.querySelector(".synopsis-text");
        let statusEl = doc.querySelector(".hero-status-badge");

        let author = "";
        let metaItems = doc.querySelectorAll(".meta-item");
        for (let item of metaItems) {
            let lbl = item.querySelector(".meta-item-label");
            let val = item.querySelector(".meta-item-value");
            if (lbl && val && lbl.text().toLowerCase().includes("author")) {
                author = val.text().trim();
            }
        }

        let status = 0;
        if (statusEl) {
            let st = statusEl.text().toLowerCase();
            if (st.includes("ongoing")) status = 1;
            else if (st.includes("completed")) status = 2;
        }

        let genres = [];
        for (let pill of doc.querySelectorAll(".meta-pill-row .meta-pill")) {
            let g = pill.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: titleEl ? titleEl.text().trim() : "",
            url: url,
            thumbnailUrl: coverEl ? coverEl.absUrl("src") : "",
            author: author,
            status: status,
            description: synEl ? synEl.text().trim() : "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = (url.startsWith("http") ? url : this.baseUrl + url) + "?all=1";
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chEls = doc.querySelectorAll(".chapter-row");
        let chs = [];

        for (let row of chEls) {
            let chTitle = row.querySelector(".chapter-title");
            let timeEl = row.querySelector("[data-local-time]");
            let href = row.attr("data-href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: chTitle ? chTitle.text().trim() : "Chapter",
                url: rel,
                uploadDate: timeEl ? timeEl.attr("data-local-time") : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("img.page-img");
        let list = [];

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src) list.push(src);
        }
        return list;
    }
};