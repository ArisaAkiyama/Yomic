/**
 * Yomic Extension: BacaKomik.pics (bacakomikpics)
 * Ported from Keiyoushi id extensions-source (src/id/bacakomikpics)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "BacaKomik.pics",
    baseUrl: "https://bacakomik.pics",
    apiUrl: "https://bacakomik.pics",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Online Bahasa Indonesia di BacaKomik.pics",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/bacakomikpics/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/komik-populer/";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };

        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll(".grid a.card, a.card");
        let items = [];
        for (let c of cards) {
            let href = c.absUrl("href") || c.attr("href") || "";
            let titleEl = c.querySelector(".card-title, h2, h3, .title");
            let title = titleEl ? titleEl.text().trim() : "";
            let img = c.querySelector("img");
            let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";
            if (href && title) {
                let rel = href;
                if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);
                items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
            }
        }
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/wp-json/wp/v2/komik_series?per_page=20&page=" + p + "&_embed=wp:featuredmedia&orderby=modified&order=desc";
        return this.parseWpSeries(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/wp-json/wp/v2/komik_series?per_page=20&page=" + p + "&_embed=wp:featuredmedia&search=" + encodeURIComponent(query || "");
        return this.parseWpSeries(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseWpSeries: function(url, page) {
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let json = JSON.parse(res.body);
        let items = [];
        for (let s of json) {
            let title = (s.title && s.title.rendered) ? s.title.rendered : (s.slug || "");
            let link = s.link || ("/series/" + s.slug + "/");
            let thumb = "";
            if (s._embedded && s._embedded["wp:featuredmedia"] && s._embedded["wp:featuredmedia"].length > 0) {
                thumb = s._embedded["wp:featuredmedia"][0].source_url || "";
            }
            let rel = link;
            if (link.startsWith(this.baseUrl)) rel = link.substring(this.baseUrl.length);
            items.push({ title: title.trim(), url: rel, thumbnailUrl: thumb, status: 0 });
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
        let info = doc.querySelector(".series-info, article");
        let titleEl = doc.querySelector(".series-info h1, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let img = doc.querySelector(".series-thumb img, img.thumb");
        let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector(".sinopsis p, .entry-content, p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let status = 0;
        let genres = [];

        for (let a of doc.querySelectorAll("a.genre-link, .genre-link")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        for (let str of doc.querySelectorAll("strong, b")) {
            let txt = str.text().toLowerCase();
            if (txt.includes("author") || txt.includes("pengarang")) {
                let p = str.parentElement;
                if (p) author = p.text().replace(/^[^:]+:/, "").trim();
            }
            if (txt.includes("status")) {
                let p = str.parentElement;
                let sTxt = (p ? p.text() : txt).toLowerCase();
                if (sTxt.includes("ongoing") || sTxt.includes("berjalan")) status = 1;
                else if (sTxt.includes("completed") || sTxt.includes("tamat")) status = 2;
            }
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

        let body = res.body;
        let match = body.match(/chapterData\s*=\s*(\[.*?\]);/s);
        let chapters = [];

        if (match) {
            try {
                let data = JSON.parse(match[1]);
                for (let ch of data) {
                    let chUrl = ch.url || "";
                    let rel = chUrl;
                    if (chUrl.startsWith(this.baseUrl)) rel = chUrl.substring(this.baseUrl.length);
                    chapters.push({
                        name: (ch.title || "Chapter").trim(),
                        url: rel,
                        uploadDate: ""
                    });
                }
                return chapters;
            } catch (e) {}
        }

        let doc = Html.parse(body, fullUrl);
        for (let a of doc.querySelectorAll("a[href*='/chapter-'], .chapter-link, .chapter-list a")) {
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

        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll(".viewer-komik img, #reader img, .chapter-content img");
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
