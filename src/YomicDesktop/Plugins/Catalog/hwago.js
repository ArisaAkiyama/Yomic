var source = {
    name: "Hwago",
    baseUrl: "https://01.hwago.com",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/hwago/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Hwago Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#082f49",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 24,
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
        let sortParam = (sort === "latest") ? "latest" : "popular";
        let url = `${this.baseUrl}/all-series?sort=${sortParam}&lang=id&page=${p}`;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        return this.parseMangaList(url, p);
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/all-series?sort=popular&lang=id&page=${p}`;
        return this.parseMangaList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.baseUrl}/all-series?sort=latest&lang=id&page=${p}`;
        return this.parseMangaList(url, p);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        let p = page || 1;
        let url = `${this.baseUrl}/browse?q=${encodeURIComponent(query)}&sort=latest&lang=id&page=${p}`;
        return this.parseMangaList(url, p);
    },

    parseMangaList: function(url, page) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let doc = Html.parse(res.body, url);
        let elements = doc.querySelectorAll("a[href*='/comic/']");

        let items = [];
        let seen = {};

        for (let el of elements) {
            let img = el.querySelector("img");
            if (!img) continue;

            let href = el.absUrl("href") || el.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let title = img.attr("alt") || el.text().trim();
            if (!title) continue;

            let thumb = img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "";
            let rel = href;
            if (href.startsWith(this.baseUrl)) {
                rel = href.substring(this.baseUrl.length);
            }

            items.push({
                title: title.trim(),
                url: rel,
                thumbnailUrl: thumb
            });
        }

        let hasNext = doc.querySelector(`a[href*='page=${page + 1}']`) !== null;
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
        let titleEl = doc.querySelector("h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let imgEl = doc.querySelector("aside img[src*='/cover'], aside img");
        let thumb = imgEl ? (imgEl.absUrl("src") || imgEl.attr("src") || "") : "";

        let descEl = doc.querySelector("p.text-sm, div[data-sr]");
        let description = "";
        if (descEl) {
            if (descEl.attr("data-sr")) {
                try { description = atob(descEl.attr("data-sr")).trim(); } catch (e) {}
            }
            if (!description) description = descEl.text().trim();
        }

        let author = "";
        for (let div of doc.querySelectorAll("aside div, .series-info div, div")) {
            let spans = div.querySelectorAll("span");
            if (spans.length >= 2 && spans[0].text().toLowerCase().includes("author")) {
                author = spans[spans.length - 1].text().trim();
                break;
            }
        }

        let status = 0;
        for (let div of doc.querySelectorAll("aside div, .series-info div, div")) {
            let txt = div.text().toLowerCase();
            if (txt.includes("status")) {
                if (txt.includes("ongoing") || txt.includes("berjalan")) { status = 1; break; }
                else if (txt.includes("completed") || txt.includes("tamat")) { status = 2; break; }
            }
        }

        let genres = [];
        let genreEls = doc.querySelectorAll("a[href*='genre=']");
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
        let chapterEls = doc.querySelectorAll("a[href*='/read/'][data-chapter], a[href*='/read/']");

        let chapters = [];
        let seen = {};

        for (let a of chapterEls) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let nameEl = a.querySelector("span.text-sm, span[class*='font-semibold']");
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
        let imgEls = doc.querySelectorAll("img[alt^='Page '], .reader img, main img");

        let pages = [];
        for (let img of imgEls) {
            let src = img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "";
            src = src.trim();
            if (src && !src.includes("/api/image/p/") && !src.includes("histats") && !pages.includes(src)) {
                pages.push(src);
            }
        }

        return pages;
    }
};
