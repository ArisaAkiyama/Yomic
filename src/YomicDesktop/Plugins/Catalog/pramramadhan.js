/**
 * Yomic Extension: Pramramadhan (pramramadhan)
 * Ported from Keiyoushi id extensions-source (src/id/pramramadhan)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Pramramadhan",
    baseUrl: "https://01.pramramadhan.my.id",
    apiUrl: "https://01.pramramadhan.my.id",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Online di Pramramadhan",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/pramramadhan/res/mipmap-xxhdpi/ic_launcher.png",
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
        let cards = doc.querySelectorAll("a.result-card");
        let list = [];
        for (let card of cards) {
            let titleEl = card.querySelector("div.result-title");
            let img = card.querySelector("div.result-cover img");
            if (titleEl) {
                let href = card.absUrl("href") || card.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                list.push({
                    title: titleEl.text().trim(),
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
        let url = this.baseUrl + "/search.php?sort=popular&page=" + p;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/search.php?sort=newest&page=" + p;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/search.php?q=" + encodeURIComponent(query || "") + "&page=" + p;
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
        let titleEl = doc.querySelector("h1.series-title");
        let coverEl = doc.querySelector("div.series-cover img");
        let descEl = doc.querySelector("p.series-desc");

        let author = "";
        let status = 0;
        let tagRows = doc.querySelectorAll(".tag-row");
        for (let row of tagRows) {
            let lbl = row.querySelector(".tag-label");
            let pill = row.querySelector(".tag-pill");
            if (lbl && pill) {
                let txt = lbl.text().toLowerCase();
                let val = pill.text().trim();
                if (txt.includes("author")) author = val;
                if (txt.includes("status")) {
                    let sv = val.toLowerCase();
                    if (sv.includes("ongoing")) status = 1;
                    else if (sv.includes("completed")) status = 2;
                }
            }
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".tag-row .tag-list a.tag-pill")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: titleEl ? titleEl.text().trim() : "",
            url: url,
            thumbnailUrl: coverEl ? coverEl.absUrl("src") : "",
            author: author,
            status: status,
            description: descEl ? descEl.text().trim() : "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chEls = doc.querySelectorAll("div.chapter-grid a.chapter-card");
        let chs = [];

        for (let card of chEls) {
            let titleText = card.querySelector("div.chapter-title");
            let sub = card.querySelector("div.chapter-sub");
            let time = card.querySelector("div.chapter-time");
            let name = titleText ? titleText.text().trim() : "Chapter";
            if (sub && sub.text().trim()) name += " - " + sub.text().trim();
            let href = card.absUrl("href") || card.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: name,
                url: rel,
                uploadDate: time ? time.text().trim() : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("div.reader-container img.page");
        let list = [];

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src) list.push(src);
        }
        return list;
    }
};