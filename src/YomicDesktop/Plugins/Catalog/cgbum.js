/**
 * Yomic Extension: CGBUM (cgbum)
 * Ported from Keiyoushi id extensions-source (src/id/cgbum)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "CGBUM",
    baseUrl: "https://cgbum.com",
    apiUrl: "https://cgbum.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa di CGBUM",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/cgbum/res/mipmap-xxhdpi/ic_launcher.png",
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

    parseCards: function(doc) {
        let articles = doc.querySelectorAll("article.comic-card");
        let list = [];
        for (let article of articles) {
            let link = article.querySelector("h3.comic-card-title a");
            let img = article.querySelector("img");
            if (link) {
                let href = link.absUrl("href") || link.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                list.push({
                    title: link.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        return list;
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/daftar-komik?page=" + p + "&sort=views";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/daftar-komik?page=" + p + "&sort=latest";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/cari?q=" + encodeURIComponent(query || "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
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
        let btn = doc.querySelector("button[data-title]");
        let title = btn ? btn.attr("data-title") : (doc.querySelector("h1") ? doc.querySelector("h1").text().trim() : "Komik");

        let coverEl = doc.querySelector(".comic-cover img");
        let synEl = doc.querySelector(".synopsis-content");
        let altEl = doc.querySelector("p.comic-alt-title");
        let badgeEl = doc.querySelector(".comic-cover .badge-status");

        let author = "";
        let metaRows = doc.querySelectorAll(".meta-row");
        for (let row of metaRows) {
            let lbl = row.querySelector(".meta-label");
            let val = row.querySelector(".meta-value");
            if (lbl && val && lbl.text().toLowerCase().includes("author")) {
                author = val.text().trim();
            }
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".comic-genres a.genre-pill")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        let status = 0;
        if (badgeEl) {
            let b = badgeEl.text().toLowerCase();
            if (b.includes("ongoing")) status = 1;
            else if (b.includes("tamat") || b.includes("completed")) status = 2;
        }

        let desc = synEl ? synEl.text().trim() : "";
        if (altEl && altEl.text().trim()) desc += "\n\nJudul alternatif: " + altEl.text().trim();

        return {
            title: title,
            url: url,
            thumbnailUrl: coverEl ? coverEl.absUrl("src") : "",
            author: author,
            status: status,
            description: desc.trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chEls = doc.querySelectorAll(".chapter-grid a.ch-grid-item");
        let chs = [];

        for (let a of chEls) {
            let href = a.absUrl("href") || a.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
            chs.push({
                name: a.text().trim(),
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
        let divs = doc.querySelectorAll("div.page-container[data-url]");
        let list = [];

        for (let div of divs) {
            let src = div.absUrl("data-url") || div.attr("data-url") || "";
            if (src) list.push(src);
        }
        return list;
    }
};