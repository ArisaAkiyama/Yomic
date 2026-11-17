/**
 * Yomic Extension: Wurmz (wurmz)
 * Ported from Keiyoushi id extensions-source (src/id/wurmz)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Wurmz",
    baseUrl: "https://wurmz.net",
    apiUrl: "https://wurmz.net",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa Terjemahan Bahasa Indonesia di Wurmz",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/wurmz/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/semua-komik?sort=popular_all&page=" + p;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/semua-komik?sort=update&page=" + p;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/semua-komik?q=" + encodeURIComponent(query || "") + "&page=" + p;
        return this.parseMangaList(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let sortParam = (sort === "latest") ? "update" : "popular_all";
        let url = this.baseUrl + "/semua-komik?sort=" + sortParam + "&page=" + p;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        for (let g of gList) {
            if (g && g !== "Semua") {
                url += "&genre=" + encodeURIComponent(g.toLowerCase());
            }
        }
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll("article.comic-card, .comic-card");
        let items = [];

        for (let card of cards) {
            let link = card.querySelector("a[href*='/detail/']");
            if (!link) continue;
            let href = link.absUrl("href") || link.attr("href") || "";
            let h2 = card.querySelector("h2");
            let title = h2 ? h2.text().trim() : (link.attr("aria-label") || link.text().trim());
            if (!href || !title) continue;

            let img = card.querySelector("img");
            let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }

        let totalPages = page || 1;
        for (let a of doc.querySelectorAll("a")) {
            if (a.text().includes("Berikutnya") || a.text().includes("Next")) {
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

        let body = res.body;
        let jsonLdMatch = body.match(/\{"@context":"https:\/\/schema\.org","@type":"ComicSeries".*?\}(?=[0-9a-f]+:|[\r\n]|$)/s);
        let title = "";
        let thumb = "";
        let desc = "";
        let author = "";
        let genres = [];

        if (jsonLdMatch) {
            try {
                let ld = JSON.parse(jsonLdMatch[0]);
                title = ld.name || "";
                thumb = ld.image || "";
                desc = ld.description || "";
                if (ld.author) author = typeof ld.author === "object" ? ld.author.name : ld.author;
                if (ld.genre) genres = Array.isArray(ld.genre) ? ld.genre : [ld.genre];
            } catch (e) {}
        }

        let doc = Html.parse(body, fullUrl);
        if (!title) {
            let tEl = doc.querySelector("h1");
            if (tEl) title = tEl.text().trim();
        }
        if (!thumb) {
            let img = doc.querySelector(".cover-image img, img");
            if (img) thumb = img.absUrl("src") || img.attr("src") || "";
        }

        let status = 0;
        let sMatch = body.match(/"className":"status-badge","children":"([^"]+)"/);
        let s = sMatch ? sMatch[1].toLowerCase() : "";
        if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
        else if (s.includes("tamat") || s.includes("completed")) status = 2;

        return {
            title: title,
            url: url,
            thumbnailUrl: thumb,
            author: author,
            status: status,
            description: desc,
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let body = res.body;
        let chMatch = body.match(/"chapters"\s*:\s*(\[.*?\])/s);
        if (chMatch) {
            try {
                let list = JSON.parse(chMatch[1]);
                let chapters = [];
                for (let ch of list) {
                    let chUrl = ch.url || ch.link || ("/chapter/" + ch.id);
                    chapters.push({
                        name: (ch.title || ch.name || ("Chapter " + ch.number)).trim(),
                        url: chUrl,
                        uploadDate: ch.date || ""
                    });
                }
                return chapters;
            } catch (e) {}
        }

        let doc = Html.parse(body, fullUrl);
        let chapters = [];
        for (let a of doc.querySelectorAll("a[href*='/chapter/'], a.chapter-link")) {
            let href = a.absUrl("href") || a.attr("href") || "";
            let name = a.text().trim();
            if (href && name) {
                let rel = href;
                if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);
                chapters.push({ name: name, url: rel, uploadDate: "" });
            }
        }
        return chapters;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let body = res.body;
        let match = body.match(/"images"\s*:\s*(\[.*?\])/s);
        if (match) {
            try {
                let imgs = JSON.parse(match[1]);
                return imgs;
            } catch (e) {}
        }

        let doc = Html.parse(body, fullUrl);
        let pages = [];
        for (let img of doc.querySelectorAll(".reader-container img, #reader img, img.chapter-image")) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src && !pages.includes(src)) pages.push(src);
        }
        return pages;
    }
};
