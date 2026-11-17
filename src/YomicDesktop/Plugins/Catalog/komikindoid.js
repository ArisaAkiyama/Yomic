/**
 * Yomic Extension: KomikIndoID (komikindoid)
 * Ported from Keiyoushi id extensions-source (src/id/komikindoid)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "KomikIndoID",
    baseUrl: "https://komikindo.ch",
    apiUrl: "https://komikindo.ch",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga & Manhwa Terjemahan Bahasa Indonesia di KomikIndoID",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komikindoid/res/mipmap-xxhdpi/ic_launcher.png",
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
        let path = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/daftar-manga/" + path + "?order=popular";
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let path = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/daftar-manga/" + path + "?order=update";
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let path = p > 1 ? "page/" + p + "/" : "";
        let url = this.baseUrl + "/daftar-manga/" + path + "?title=" + encodeURIComponent(query || "");
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
        let elements = doc.querySelectorAll("div.animepost, div.animpost, .film-list .animepost");
        let items = [];
        let seen = {};

        for (let el of elements) {
            let link = el.querySelector("a[href*='/komik/']");
            if (!link) continue;
            let href = link.absUrl("href") || link.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let titleEl = el.querySelector(".title h4, .tt h4, h4, .title");
            let title = titleEl ? titleEl.text().trim() : (link.attr("title") || "").trim();
            if (!title) continue;

            let img = el.querySelector("img");
            let thumb = img ? (img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "") : "";

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
        let nextEl = doc.querySelector(".pagination a.next, .hpage a.r, a.next.page-numbers");
        if (nextEl) totalPages = (page || 1) + 1;

        return { items: items, totalPages: totalPages };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.entry-title, #breadcrumbs li:last-child span, .infoanime h1");
        let title = titleEl ? titleEl.text().replace(/^Komik\s+/i, "").trim() : "";

        let imgEl = doc.querySelector(".thumb img, .infoanime .thumb img");
        let thumb = imgEl ? (imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "") : "";

        let descEl = doc.querySelector("div.desc .entry-content, .entry-content-single, div.desc p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let status = 0;
        let genres = [];

        for (let sp of doc.querySelectorAll(".infox .spe span")) {
            let txt = sp.text().toLowerCase();
            if (txt.includes("author") || txt.includes("pengarang")) {
                let notB = sp.querySelector(":not(b)");
                author = notB ? notB.text().trim() : sp.text().replace(/^[^:]+:/, "").trim();
            }
            if (txt.includes("status")) {
                if (txt.includes("ongoing") || txt.includes("berjalan")) status = 1;
                else if (txt.includes("completed") || txt.includes("tamat")) status = 2;
            }
        }

        for (let a of doc.querySelectorAll(".genre-info a, .infox .genre-info a")) {
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
        let rows = doc.querySelectorAll("#chapter_list li, .chapter-list li, ul.cl li");
        let chapters = [];

        for (let row of rows) {
            let a = row.querySelector(".lchx a, a[href*='/chapter-'], a");
            if (!a) continue;
            let href = a.absUrl("href") || a.attr("href") || "";
            let name = a.text().trim();
            if (!href || !name) continue;

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            let dateEl = row.querySelector(".dt a, .dt, .chapterdate");
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
        let images = doc.querySelectorAll("#readerarea img, div.chapter-content img, .entry-content img");
        let pages = [];
        let seen = {};

        for (let img of images) {
            let p = img.parentElement;
            if (p && p.tagName.toLowerCase() === "noscript") continue;
            let src = img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "";
            if (src && !seen[src] && !src.includes("ads") && !src.includes("banner")) {
                seen[src] = true;
                pages.push(src);
            }
        }
        return pages;
    }
};
