var source = {
    name: "Natsu",
    baseUrl: "https://natsu.one",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/natsu/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Natsu Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#064e3b",
    iconForeground: "#10b981",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    mirrorUrls: [],

    requestUrl: function(url, options) {
        let res = fetch(url, options || {});
        if ((!res || res.status !== 200) && this.mirrorUrls && this.mirrorUrls.length > 0) {
            for (let mirror of this.mirrorUrls) {
                let mirrorReq = url.replace(this.baseUrl, mirror);
                if (mirrorReq !== url) {
                    let altRes = fetch(mirrorReq, options || {});
                    if (altRes && altRes.status === 200) {
                        return altRes;
                    }
                }
            }
        }
        return res;
    },

    getJson: function(url) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return null;
        try {
            return JSON.parse(res.body);
        } catch (e) {
            return null;
        }
    },


    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let order = (sort === "latest") ? "orderby=date&order=desc" : "orderby=modified&order=desc";
        let url = `${this.baseUrl}/wp-json/wp/v2/manga?_embed&per_page=${this.pageSize}&page=${p}&${order}`;
        return this.parseWpJson(url, p);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/wp-json/wp/v2/manga?_embed&per_page=${this.pageSize}&page=${p}`;
        return this.parseWpJson(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/wp-json/wp/v2/manga?_embed&per_page=${this.pageSize}&page=${p}&orderby=date&order=desc`;
        return this.parseWpJson(url, p);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        let p = page || 1;
        let url = `${this.baseUrl}/wp-json/wp/v2/manga?_embed&per_page=${this.pageSize}&page=${p}&search=${encodeURIComponent(query)}`;
        return this.parseWpJson(url, p);
    },

    parseWpJson: function(url, page) {
        let json = this.getJson(url);
        if (!json || !Array.isArray(json)) return { items: [], totalPages: page || 1 };

        let items = [];
        for (let item of json) {
            let slug = item.slug;
            let title = (item.title && item.title.rendered) ? item.title.rendered.trim() : (slug || "");
            
            let thumb = "";
            if (item._embedded && item._embedded['wp:featuredmedia'] && item._embedded['wp:featuredmedia'][0]) {
                thumb = item._embedded['wp:featuredmedia'][0].source_url || "";
            }

            items.push({
                title: title,
                url: `/manga/${slug}/`,
                thumbnailUrl: thumb
            });
        }

        return {
            items: items,
            totalPages: items.length >= this.pageSize ? (page + 1) : page
        };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : (this.baseUrl + url);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return {};

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.entry-title, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let imgEl = doc.querySelector(".thumb img, .entry-content img, article img");
        let thumb = imgEl ? (imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "") : "";

        let descEl = doc.querySelector(".entry-content p, .synopsis, #synopsis");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEl = doc.querySelector(".author a");
        if (authorEl) author = authorEl.text().trim();

        let status = 0;
        let statusEl = doc.querySelector(".status");
        if (statusEl) {
            let s = statusEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;
        }

        for (let sp of doc.querySelectorAll("span")) {
            let txt = sp.text().toLowerCase();
            if (!author && txt.includes("author")) {
                let nxt = sp.nextElementSibling;
                if (nxt) author = nxt.text().trim();
            }
            if (status === 0 && txt.includes("status")) {
                let nxt = sp.nextElementSibling;
                let s = (nxt ? nxt.text() : txt).toLowerCase();
                if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
                else if (s.includes("completed") || s.includes("tamat")) status = 2;
            }
        }

        let genres = [];
        let genreEls = doc.querySelectorAll("a[rel=tag], .genre-list a");
        for (let g of genreEls) {
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

    getChapterList: function(mangaUrl) {
        let fullUrl = mangaUrl.startsWith("http") ? mangaUrl : (this.baseUrl + mangaUrl);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let chapterEls = doc.querySelectorAll("#gallery-list a, .chapter-list a, ul.clstyle li a, a[href*='/read/']");

        let chapters = [];
        let seen = {};

        for (let a of chapterEls) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let name = a.text().trim();
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chapters.push({
                name: name || "Chapter",
                url: rel,
                dateUpload: 0
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let fullUrl = chapterUrl.startsWith("http") ? chapterUrl : (this.baseUrl + chapterUrl);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let imgEls = doc.querySelectorAll("section[data-image-data] img, #image-container img, .reading-content img, .entry-content img");

        let pages = [];
        for (let img of imgEls) {
            let src = img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "";
            src = src.trim();
            if (src && !pages.includes(src)) {
                pages.push(src);
            }
        }

        return pages;
    }
};
