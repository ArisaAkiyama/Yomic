var source = {
    name: "Mangapoi",
    baseUrl: "https://mangapoi.io",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mangapoi/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Mangapoi Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#18181b",
    iconForeground: "#fb923c",
    isNsfw: true,
    isHasMorePages: true,
    pageSize: 20,
    searchPath: "advanced-search",
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
        let params = [];
        if (status === 1) params.push("status=ongoing");
        else if (status === 2) params.push("status=completed");
        
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            params.push("type=" + encodeURIComponent(tStr.toLowerCase()));
        }
        
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        for (let g of gList) {
            if (g && g !== "Semua") {
                params.push("genre[]=" + encodeURIComponent(g.toLowerCase()));
            }
        }
        
        let sortParam = (sort === "latest") ? "update" : "popular";
        params.push("order=" + sortParam);
        
        let url = `${this.baseUrl}/${this.searchPath}/page/${p}/?${params.join("&")}`;
        return this.parseMangaList(url, p);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/${this.searchPath}/page/${p}/?order=popular`;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/${this.searchPath}/page/${p}/?order=update`;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        let p = page || 1;
        let url = `${this.baseUrl}/${this.searchPath}/page/${p}/?title=${encodeURIComponent(query)}`;
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll("div.flexbox2-item, div.flexbox-item");

        let items = [];
        let seen = {};

        for (let el of elements) {
            let linkEl = el.querySelector("div.flexbox2-content a, div.flexbox-content a, a");
            let titleEl = el.querySelector("div.flexbox2-title > span, .series-title, h4, h3");
            if (!linkEl || !titleEl) continue;

            let href = linkEl.absUrl("href") || linkEl.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let title = titleEl.text().trim();
            let imgEl = el.querySelector("img");
            let thumb = "";
            if (imgEl) {
                thumb = imgEl.absUrl("data-lazy-src") || imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "";
            }

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

        let hasNext = doc.querySelector("div.pagination .next, .next.page-numbers") !== null;
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
        let titleEl = doc.querySelector(".series-title h2, .series-title h1, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let imgEl = doc.querySelector(".series-thumb img, .thumb img");
        let thumb = "";
        if (imgEl) {
            thumb = imgEl.absUrl("data-lazy-src") || imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "";
        }

        let descEl = doc.querySelector("div.series-synops, .series-synopsis");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let status = 0;
        let statusEl = doc.querySelector(".series-infoz .status");
        if (statusEl) {
            let s = statusEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat") || s.includes("end")) status = 2;
        }

        for (let li of doc.querySelectorAll(".series-infolist li")) {
            let txt = li.text().toLowerCase();
            if (txt.includes("author") || txt.includes("mangaka")) {
                let sp = li.querySelector("span");
                if (sp) author = sp.text().trim();
            }
            if (status === 0 && txt.includes("status")) {
                let sp = li.querySelector("span");
                let s = (sp ? sp.text() : txt).toLowerCase();
                if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
                else if (s.includes("completed") || s.includes("tamat") || s.includes("end")) status = 2;
            }
        }

        let genres = [];
        let genreEls = doc.querySelectorAll("div.series-genres a, .series-genres a");
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
        let chapterEls = doc.querySelectorAll("ul.series-chapterlist div.flexch-infoz a, ul.series-chapterlist li a");

        let chapters = [];
        let seen = {};

        for (let a of chapterEls) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let nameEl = a.querySelector("span");
            let name = nameEl ? nameEl.text().trim() : a.text().trim();
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
        let imgEls = doc.querySelectorAll("div.reader-area img:not(noscript img), .reader-area img");

        let pages = [];
        for (let img of imgEls) {
            let src = img.absUrl("data-src") || img.absUrl("data-lazy-src") || img.absUrl("src") || img.attr("src") || "";
            src = src.replace(/\\/g, '').trim();
            if (src && !src.includes("histats") && !src.includes("ads") && !pages.includes(src)) {
                pages.push(src);
            }
        }

        return pages;
    }
};
