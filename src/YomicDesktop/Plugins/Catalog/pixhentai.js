var source = {
    name: "Pix Hentai",
    baseUrl: "https://pixhentai.com",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/pixhentai/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Pix Hentai Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#311042",
    iconForeground: "#d8b4fe",
    isNsfw: true,
    isHasMorePages: true,
    pageSize: 12,
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


    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        let targetGenre = gList.length > 0 && gList[0] !== "Semua" ? gList[0] : "";
        if (targetGenre) {
            let url = `${this.baseUrl}/category/${encodeURIComponent(targetGenre.toLowerCase())}/page/${p}/`;
            return this.parseMangaList(url, p);
        }
        return this.getPopularManga(page);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = p > 1 ? `${this.baseUrl}/page/${p}/` : this.baseUrl;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        return this.getPopularManga(page);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        let p = page || 1;
        let url = `${this.baseUrl}/${p > 1 ? 'page/' + p + '/' : ''}?s=${encodeURIComponent(query)}`;
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll("article.blog-entry, article.search-entry, article");

        let items = [];
        let seen = {};

        for (let el of elements) {
            let linkEl = el.querySelector("h2.blog-entry-title a, h2.search-entry-title a, h2 a, h3 a");
            if (!linkEl) continue;

            let href = linkEl.absUrl("href") || linkEl.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let title = linkEl.text().trim();
            let imgEl = el.querySelector("div.thumbnail img, .thumbnail img, img");
            let thumb = imgEl ? (imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) {
                rel = href.substring(this.baseUrl.length);
            }

            items.push({
                title: title,
                url: rel,
                thumbnailUrl: thumb
            });
        }

        let hasNext = doc.querySelector("ul.page-numbers li a.next") !== null;
        return {
            items: items,
            totalPages: hasNext ? (page + 1) : page
        };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : (this.baseUrl + url);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return {};

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector(".entry-title, h1.entry-title, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let imgEl = doc.querySelector("div.thumbnail img, .thumbnail img, .entry-content img");
        let thumb = imgEl ? (imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "") : "";

        let descEl = doc.querySelector("div.entry-content p, div.entry-content");
        let description = descEl ? descEl.text().trim() : "";

        let genres = [];
        let genreEls = doc.querySelectorAll("li.meta-cat a, li.meta-category a, a[rel=category]");
        for (let g of genreEls) {
            let gt = g.text().trim();
            if (gt && !genres.includes(gt)) genres.push(gt);
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumb,
            author: "",
            status: 2, // OceanWP posts are standalone oneshots/completed chapters
            description: description,
            genre: genres
        };
    },

    getChapterList: function(mangaUrl) {
        // OceanWP posts are self-contained chapter posts
        return [{
            name: "Chapter 1",
            url: mangaUrl,
            dateUpload: 0
        }];
    },

    getPageList: function(chapterUrl) {
        let fullUrl = chapterUrl.startsWith("http") ? chapterUrl : (this.baseUrl + chapterUrl);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let imgEls = doc.querySelectorAll("div.entry-content img, article img");

        let pages = [];
        for (let img of imgEls) {
            let src = img.absUrl("data-src") || img.absUrl("data-lazy-src") || img.absUrl("src") || img.attr("src") || "";
            src = src.trim();
            if (src && !src.includes("histats") && !src.includes("ads") && !pages.includes(src)) {
                pages.push(src);
            }
        }

        return pages;
    }
};
