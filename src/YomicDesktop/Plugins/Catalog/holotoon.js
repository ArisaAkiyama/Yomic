/**
 * Yomic Extension: Holotoon (holotoon)
 * Ported from Keiyoushi id extensions-source (src/id/holotoon)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Holotoon",
    baseUrl: "https://holodek.run",
    apiUrl: "https://holodek.run",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Webtoon & Manhwa di Holotoon",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/holotoon/res/mipmap-xxhdpi/ic_launcher.png",
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
        if (!reqHeaders["Sec-CH-UA"]) {
            reqHeaders["Sec-CH-UA"] = "\"Chromium\";v=\"124\", \"Google Chrome\";v=\"124\", \"Not.A/Brand\";v=\"99\"";
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
        let grids = doc.querySelectorAll("div.grid");
        let container = null;
        for (let i = grids.length - 1; i >= 0; i--) {
            if (grids[i].querySelector("a[href^='/comic/']")) {
                container = grids[i];
                break;
            }
        }
        if (!container) return [];

        let cards = container.querySelectorAll("a.group[href^='/comic/']");
        let list = [];
        let seen = {};
        for (let card of cards) {
            let href = card.attr("href");
            if (!href || seen[href]) continue;
            seen[href] = true;
            let titleEl = card.querySelector("h3");
            let img = card.querySelector("img");
            if (titleEl) {
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                list.push({
                    title: titleEl.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? (img.absUrl("data-src") || img.absUrl("src")) : "",
                    status: 0
                });
            }
        }
        return list;
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/browse?sort=popular&media=comic" + (p > 1 ? "&page=" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/browse?sort=latest&media=comic" + (p > 1 ? "&page=" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/browse?sort=latest&media=comic&q=" + encodeURIComponent(query || "") + (p > 1 ? "&page=" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
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
        let titleEl = doc.querySelector("h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let cover = "";
        for (let img of doc.querySelectorAll("img")) {
            if ((img.attr("alt") || "").trim().toLowerCase() === title.toLowerCase()) {
                cover = img.absUrl("src") || img.absUrl("data-src") || "";
                break;
            }
        }

        let descEl = doc.querySelector("#synopsis-wrapper div[data-sr], div[class*=description], div.prose");
        let desc = descEl ? descEl.text().trim() : "";

        let genres = [];
        for (let a of doc.querySelectorAll("a[href*='genre=']")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: cover,
            author: "",
            status: 0,
            description: desc,
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chEls = doc.querySelectorAll("a[href^='/read/'][data-chapter]");
        let chs = [];

        for (let a of chEls) {
            let rawCh = a.attr("data-chapter") || "";
            let label = a.querySelector("span.font-semibold");
            let sub = a.querySelector("span.truncate");
            let name = label ? label.text().trim() : ("Chapter " + rawCh);
            if (sub && sub.text().trim()) name += " - " + sub.text().trim().replace(/^—\s*/, "");
            let timeEl = a.querySelector("span.text-right, span[class*=tabular-nums]:last-child");
            let href = a.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: name,
                url: rel,
                uploadDate: timeEl ? timeEl.text().trim() : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);

        let imgs = doc.querySelectorAll("#reader-pages img");
        if (imgs.length === 0) {
            imgs = doc.querySelectorAll("main img[src*='/image/comic/'], main img[data-src*='/image/comic/']");
        }

        let list = [];
        let seen = {};
        for (let img of imgs) {
            let src = img.absUrl("src") || img.absUrl("data-src") || "";
            if (src && !seen[src] && !src.includes("header") && !src.includes("footer")) {
                seen[src] = true;
                list.push(src);
            }
        }
        return list;
    }
};