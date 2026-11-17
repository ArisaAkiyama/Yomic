/**
 * Yomic Extension: MyNimeku (mynimeku)
 * Ported from Keiyoushi id extensions-source (src/id/mynimeku)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "MyNimeku",
    baseUrl: "https://www.mynimeku.com",
    apiUrl: "https://www.mynimeku.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga, Manhwa, Manhua Lengkap di MyNimeku",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mynimeku/res/mipmap-xxhdpi/ic_launcher.png",
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
        let pageSeg = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/full-list/mix/o:popular~t:DOUJINSHI,MANGA,MANHUA,MANHWA,ONE-SHOT/" + pageSeg;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let pageSeg = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/latest-komik/" + pageSeg;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let pageSeg = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/full-list/mix/j:" + encodeURIComponent(query || "") + "~o:popular~t:DOUJINSHI,MANGA,MANHUA,MANHWA,ONE-SHOT/" + pageSeg;
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
        let cards = doc.querySelectorAll("article.mynimeku-update-feed__item, article.mynimeku-mix-feed__item, article");
        let items = [];
        let seen = {};

        for (let card of cards) {
            let link = card.querySelector("a[href*='/komik/'], a");
            if (!link) continue;
            let href = link.absUrl("href") || link.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let tEl = card.querySelector("a[class*='__series-title'], h3, h2, .title");
            let title = link.attr("aria-label") || link.attr("title") || (tEl ? tEl.text().trim() : "") || link.text().trim();
            if (!title) continue;

            let img = card.querySelector("img");
            let thumb = img ? (img.absUrl("data-lazy-src") || img.absUrl("src") || img.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }

        let totalPages = page || 1;
        for (let a of doc.querySelectorAll("a.is-arrow, .pagination a")) {
            if (a.text().toLowerCase().includes("next") || a.text().includes("»")) {
                totalPages = (page || 1) + 1;
                break;
            }
        }
        return { items: items, totalPages: totalPages };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.komik-series-hero__title, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let img = doc.querySelector(".komik-series-hero__cover img, img");
        let thumb = img ? (img.absUrl("data-lazy-src") || img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector(".komik-series-entry, .entry-content, p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let status = 0;
        for (let tr of doc.querySelectorAll("table.komik-series-table tr, table tr")) {
            let th = tr.querySelector("th");
            let td = tr.querySelector("td");
            if (th && td) {
                let label = th.text().toLowerCase();
                let val = td.text().trim();
                if (label.includes("author") || label.includes("pengarang")) author = val;
                if (label.includes("status")) {
                    let s = val.toLowerCase();
                    if (s.includes("on-going") || s.includes("ongoing")) status = 1;
                    else if (s.includes("completed") || s.includes("tamat")) status = 2;
                }
            }
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".komik-series-taxonomy__terms a, .genre a")) {
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
        let rows = doc.querySelectorAll("div.komik-series-chapter-row, .chapter-list a, a.komik-series-chapter-item");
        let chapters = [];

        for (let row of rows) {
            let a = row.querySelector("a.komik-series-chapter-item") || (row.tagName.toLowerCase() === "a" ? row : null);
            if (!a) continue;
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href) continue;

            let tEl = a.querySelector(".komik-series-chapter-item__title") || a;
            let name = tEl.text().replace(/\s*Bahasa Indonesia$/i, "").trim();

            let dEl = a.querySelector(".komik-series-chapter-item__date");
            let date = dEl ? dEl.text().trim() : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            chapters.push({
                name: name,
                url: rel,
                uploadDate: date
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("div.komik-reader-content img, #reader img, .reader img");
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
