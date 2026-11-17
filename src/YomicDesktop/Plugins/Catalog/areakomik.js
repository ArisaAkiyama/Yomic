/**
 * Yomic Extension: Area Komik (areakomik)
 * Ported from Keiyoushi id extensions-source (src/id/areakomik)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Area Komik",
    baseUrl: "https://areakomik.com",
    apiUrl: "https://areakomik.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa Terpopuler di Area Komik",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/areakomik/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: true,
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
        let path = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/komik-terpopuler/" + path;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let path = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/" + path;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/?s=" + encodeURIComponent(query || "") + (p > 1 ? "&paged=" + p : "");
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
        let cards = doc.querySelectorAll("article.komik-card, .komik-card");
        let items = [];

        for (let card of cards) {
            let link = card.querySelector("a[href*='/series/'], a");
            if (!link) continue;
            let href = link.absUrl("href") || link.attr("href") || "";
            if (!href) continue;

            let img = card.querySelector("img");
            let title = (img ? img.attr("alt") : "") || link.attr("title") || card.querySelector("h3, h2, .card-title, .title");
            if (typeof title === "object" && title) title = title.text().trim();
            if (!title) title = link.text().trim();
            if (!title) continue;

            let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }

        let totalPages = page || 1;
        if (doc.querySelector("a.next.page-numbers, .next.page-numbers")) totalPages = (page || 1) + 1;

        return { items: items, totalPages: totalPages };
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

        let img = doc.querySelector(".series-thumb > img, .series-thumb img, img");
        let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector("#lin-sinopsis p, #lin-sinopsis, .sinopsis p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let status = 0;
        for (let item of doc.querySelectorAll(".meta-item")) {
            let txt = item.text().toLowerCase();
            if (txt.includes("author") || txt.includes("pengarang")) {
                author = item.text().replace(/^[^:]+:/, "").trim();
            }
            if (txt.includes("status")) {
                if (txt.includes("ongoing") || txt.includes("berjalan")) status = 1;
                else if (txt.includes("completed") || txt.includes("tamat")) status = 2;
            }
        }

        let genres = [];
        for (let g of doc.querySelectorAll(".genre-list a.genre-tag, .genre-tag")) {
            let gt = g.text().trim();
            if (gt && !genres.includes(gt)) genres.push(gt);
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
        let rows = doc.querySelectorAll("#chapter-grid-container .chapter-row, .chapter-row, .chapter-list a");
        let chapters = [];

        for (let row of rows) {
            let a = row.querySelector("a.chapter-link") || (row.tagName.toLowerCase() === "a" ? row : null);
            if (!a) continue;
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href) continue;

            let num = row.querySelector(".chap-num");
            let name = num ? num.text().trim() : a.text().trim();

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
        let imgs = doc.querySelectorAll(".chapter-content img.chapter-img, .chapter-content img, #reader img");
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
