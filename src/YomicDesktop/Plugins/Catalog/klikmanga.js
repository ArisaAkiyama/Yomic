var source = {
    name: "KlikManga",
    baseUrl: "https://klikmanga.org",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/klikmanga/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "KlikManga Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    mangaSubString: "manga",
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
        let queryParams = ["s=", "post_type=wp-manga"];
        
        if (status === 1) {
            queryParams.push("status[]=on-going");
        } else if (status === 2) {
            queryParams.push("status[]=end");
        }
        
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        for (let g of gList) {
            if (g && g !== "Semua") {
                queryParams.push("genre[]=" + encodeURIComponent(g.toLowerCase().replace(/\s+/g, "-")));
            }
        }
        
        let sortParam = "views";
        if (sort === "latest") sortParam = "latest";
        else if (sort === "rating") sortParam = "rating";
        else if (sort === "alphabet") sortParam = "alphabet";
        else if (sort === "new") sortParam = "new-manga";
        queryParams.push("m_orderby=" + sortParam);
        
        let pagePath = p > 1 ? `page/${p}/` : "";
        let url = `${this.baseUrl}/${pagePath}?${queryParams.join("&")}`;
        return this.parseMangaList(url, p);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/${this.mangaSubString}/${p > 1 ? 'page/' + p + '/' : ''}?m_orderby=views`;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/${this.mangaSubString}/${p > 1 ? 'page/' + p + '/' : ''}?m_orderby=latest`;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        let p = page || 1;
        let url = `${this.baseUrl}/${p > 1 ? 'page/' + p + '/' : ''}?s=${encodeURIComponent(query)}&post_type=wp-manga`;
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll("div.page-item-detail, div.manga__item, .slider__item, div.badge-pos-1, .c-tabs-item__content");

        let items = [];
        let seen = {};

        for (let el of elements) {
            let titleEl = el.querySelector(".post-title h1 a, .post-title h3 a, .post-title h4 a, .post-title a, h3 a, h5 a");
            if (!titleEl) continue;

            let href = titleEl.absUrl("href") || titleEl.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let title = titleEl.text().trim();
            let imgEl = el.querySelector("img");
            let thumb = "";
            if (imgEl) {
                thumb = imgEl.absUrl("data-src") || imgEl.absUrl("data-lazy-src") || imgEl.absUrl("src") || imgEl.attr("src") || "";
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

        let hasNext = doc.querySelector("div.nav-previous, a.next, .pagination-next, .wp-pagenavi .nextpostslink") !== null;
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
        let titleEl = doc.querySelector(".post-title h1, h1.entry-title, .post-title h3, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let imgEl = doc.querySelector(".summary_image img, .summary_image figure img, .post-thumb img");
        let thumb = "";
        if (imgEl) {
            thumb = imgEl.absUrl("data-src") || imgEl.absUrl("src") || imgEl.attr("src") || "";
        }
        if (!thumb) {
            let metaImg = doc.querySelector("meta[property='og:image']");
            if (metaImg) thumb = metaImg.attr("content");
        }

        let descEl = doc.querySelector(".manga-excerpt, .summary__content, .description-summary, div.c-page__content p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEl = doc.querySelector(".author-content a, .author a");
        if (authorEl) author = authorEl.text().trim();

        let status = 0;
        let statusEl = doc.querySelector(".post-status .summary-content");
        if (!statusEl) {
            for (let sh of doc.querySelectorAll(".post-content_item, .summary-item-wrap, div.summary-heading")) {
                if (sh.text().toLowerCase().includes("status")) {
                    statusEl = sh.querySelector("+ div, .summary-content") || sh.nextElementSibling;
                    break;
                }
            }
        }
        if (statusEl) {
            let s = statusEl.text().toLowerCase();
            if (s.includes("on-going") || s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat") || s.includes("selesai")) status = 2;
        }

        let genres = [];
        let genreEls = doc.querySelectorAll(".genres-content a, .genres a");
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
        let chapterEls = doc.querySelectorAll("li.wp-manga-chapter a, ul.main li a, li.chapter-li a");

        // If chapters are loaded via ajax in Madara
        if (!chapterEls || chapterEls.length === 0) {
            let cleanUrl = fullUrl.replace(/\/$/, '');
            let ajaxUrl = cleanUrl + "/ajax/chapters/";
            let ajaxRes = this.requestUrl(ajaxUrl, { method: "POST" });
            if (ajaxRes && ajaxRes.status === 200 && ajaxRes.body) {
                let ajaxDoc = Html.parse(ajaxRes.body, fullUrl);
                chapterEls = ajaxDoc.querySelectorAll("li.wp-manga-chapter a, ul.main li a");
            }
        }

        let chapters = [];
        let seen = {};

        for (let a of chapterEls) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || href === "#" || seen[href]) continue;
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
        let imgEls = doc.querySelectorAll("div.page-break img, .reading-content img, .entry-content img, div.text-left img");

        let pages = [];
        for (let img of imgEls) {
            let src = "";
            if (false && img.attr("data-aesir")) {
                try {
                    let b64 = img.attr("data-aesir");
                    // Simple atob or decoded
                    src = atob(b64).trim();
                } catch (e) {}
            }
            if (!src) {
                src = img.absUrl("data-src") || img.absUrl("data-lazy-src") || img.absUrl("src") || img.attr("src") || "";
            }
            src = src.trim();
            if (src && !src.includes("histats") && !src.includes("ads") && !pages.includes(src)) {
                pages.push(src);
            }
        }

        return pages;
    }
};
