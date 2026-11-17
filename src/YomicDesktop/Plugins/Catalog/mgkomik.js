/**
 * Yomic Extension: MG Komik (mgkomik)
 * Ported from Keiyoushi id extensions-source (src/id/mgkomik)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "MG Komik",
    baseUrl: "https://web1.mgkomik.cc",
    apiUrl: "https://web1.mgkomik.cc",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga & Manhwa Bahasa Indonesia Terlengkap di MG Komik",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mgkomik/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/komik/?filter=&order_by=trending&page=" + p;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/komik/?filter=&order_by=latest&page=" + p;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/search/?q=" + encodeURIComponent(query || "") + "&page=" + p;
        return this.parseMangaList(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let order = (sort === "latest") ? "latest" : "trending";
        let url = this.baseUrl + "/komik/?filter=&order_by=" + order + "&page=" + p;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        for (let g of gList) {
            if (g && g !== "Semua") {
                url += "&genre=" + encodeURIComponent(g.toLowerCase().replace(/\s+/g, "-"));
            }
        }
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll(".manga-card, div.manga-card, a.manga-card");
        let items = [];
        let seen = {};

        for (let card of cards) {
            let link = card.querySelector("a[href]") || (card.tagName.toLowerCase() === "a" ? card : null);
            if (!link) continue;
            let href = link.absUrl("href") || link.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let img = card.querySelector("img.manga-cover, img");
            let title = img ? (img.attr("alt") || "") : "";
            if (!title) {
                let tEl = card.querySelector(".manga-title, h3, h4");
                if (tEl) title = tEl.text().trim();
            }
            if (!title) continue;

            let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({
                title: title,
                url: rel,
                thumbnailUrl: thumb,
                status: 0
            });
        }

        let totalPages = page || 1;
        for (let a of doc.querySelectorAll(".pagination a.page-link, .pagination a")) {
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
        let titleEl = doc.querySelector(".manga-title, h1.entry-title, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let img = doc.querySelector("img.manga-cover-large, img.manga-cover, .thumb img");
        let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector("#sinopsisContainer p, .manga-description p, div.desc p");
        let description = descEl ? descEl.text().trim() : "";

        let status = 0;
        let statusEl = doc.querySelector(".status-Ongoing, .status-ongoing, .status-Completed, .status-completed, .status");
        if (statusEl) {
            let s = statusEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;
        }

        let genres = [];
        for (let g of doc.querySelectorAll(".genre-tag, .genres a")) {
            let gt = g.text().trim();
            if (gt && !genres.includes(gt)) genres.push(gt);
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumb,
            author: "",
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
        let rows = doc.querySelectorAll("#chapterList .chapter-list-item, .chapter-list li, ul.cl li");
        let chapters = [];

        for (let row of rows) {
            let a = row.querySelector("a.chapter-link, a");
            if (!a) continue;
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href) continue;

            let num = a.querySelector(".chapter-number");
            let name = num ? num.text().trim() : a.text().trim();

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            let dateEl = a.querySelector(".chapter-date");
            let date = dateEl ? dateEl.text().trim() : "";

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
        let imgs = doc.querySelectorAll(".reading-content img[src], #readerarea img, .entry-content img");
        let pages = [];
        let seen = {};

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src && !seen[src] && !src.includes("banner") && !src.includes("ads")) {
                seen[src] = true;
                pages.push(src);
            }
        }
        return pages;
    }
};
