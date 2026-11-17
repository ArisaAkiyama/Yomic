var source = {
    name: "Komikzoid",
    baseUrl: "https://01.komikzoid.id",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komikzoid/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Komikzoid Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#1f2937",
    iconForeground: "#818cf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 18,
    mirrorUrls: ["https://komikzoid.id"],

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
        let sortParam = (sort === "latest") ? "update" : "view";
        let url = `${this.baseUrl}/manga?page=${p}&sort=${sortParam}`;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        return this.parseMangaList(url, p);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/manga?page=${p}&sort=view`;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/manga?page=${p}&sort=update`;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        let p = page || 1;
        let url = `${this.baseUrl}/manga?page=${p}&search=${encodeURIComponent(query)}`;
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll(".product__page__content .product__item, .product__item");

        let items = [];
        let seen = {};

        for (let el of elements) {
            let linkEl = el.querySelector("a.img-link, a");
            let titleEl = el.querySelector("h5 a, h5");
            if (!linkEl || !titleEl) continue;

            let href = linkEl.absUrl("href") || linkEl.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let title = titleEl.text().trim();
            let bgEl = el.querySelector(".set-bg");
            let thumb = "";
            if (bgEl && bgEl.attr("data-setbg")) {
                thumb = bgEl.attr("data-setbg").split('?')[0];
            } else {
                let img = el.querySelector("img");
                if (img) thumb = img.absUrl("src") || img.attr("src") || "";
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

        let hasNext = doc.querySelector(".fa-angle-right, a.next") !== null;
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
        let content = doc.querySelector(".anime__details__content");
        if (!content) return {};

        let title = content.querySelector("h3") ? content.querySelector("h3").text().trim() : "";
        let author = content.querySelector("h3 + span") ? content.querySelector("h3 + span").text().trim() : "";
        let description = content.querySelector("p") ? content.querySelector("p").text().trim() : "";

        let bgEl = doc.querySelector(".anime__details__pic, .set-bg");
        let thumb = "";
        if (bgEl && bgEl.attr("data-setbg")) {
            thumb = bgEl.attr("data-setbg").split('?')[0];
        }

        let status = 0;
        let genres = [];
        for (let li of content.querySelectorAll("li")) {
            let txt = li.text().toLowerCase();
            if (txt.includes("status")) {
                if (txt.includes("ongoing")) status = 1;
                else if (txt.includes("complete")) status = 2;
            }
            if (txt.includes("genre")) {
                for (let a of li.querySelectorAll("a")) {
                    let gt = a.text().trim();
                    if (gt && !genres.includes(gt)) genres.push(gt);
                }
            }
        }
        for (let a of content.querySelectorAll(".anime__details__tags a")) {
            let gt = a.text().trim();
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
        let chapterEls = doc.querySelectorAll(".anime__details__episodes a");

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
        let imgEls = doc.querySelectorAll("#chapter-image img, .chapter-image img, .reader-area img");

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
