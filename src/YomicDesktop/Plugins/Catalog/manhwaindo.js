var source = {
    name: "ManhwaIndo",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/manhwaindo/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://www.manhwaindo.my",
    language: "id",
    version: "1.1.4",
    description: "Baca Manhwa, Manga, dan Manhua Bahasa Indonesia dari ManhwaIndo (MangaThemesia)",
    author: "DesktopKomik",
    iconBackground: "#0d1b2a",
    iconForeground: "#ff6b35",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 18,

    // -- MangaThemesia: manga series directory is /series/
    mangaUrlDirectory: "/series/",

    genres: [
        "Action", "Adult", "Adventure", "Boys Love", "Comedy",
        "Cooking", "Crime", "Cultivation", "Demons", "Drama", "Ecchi",
        "Fantasy", "Game", "Gender Bender", "Girls Love", "Gore", "Harem",
        "Historical", "Horror", "Isekai", "Josei", "Loli", "Magic",
        "Martial Arts", "Mature", "Mecha", "Medical", "Military",
        "Monster Girls", "Music", "Mystery", "Office Worker", "One Shot",
        "Parody", "Police", "Psychological", "Reincarnation", "Romance",
        "Romcom", "School", "School Life", "Sci-Fi", "Seinen",
        "Shoujo", "Shoujo Ai", "Shounen", "Shounen Ai", "Slice of Life",
        "Smut", "Sports", "Super Power", "Supernatural", "Survival",
        "Thriller", "Time Travel", "Tragedy", "Vampire", "Webtoon",
        "Wuxia", "Xianxia", "Yaoi", "Yuri", "Zombie",
        "Reverse Harem", "Dungeon", "System", "Tower", "Leveling",
        "Apocalypse", "Regression", "Transmigration", "Awakening", "Hunter"
    ],

    formats: ["Manga", "Manhwa", "Manhua", "Webtoon", "Novel"],

    typeMap: {
        "Manga": "Manga",
        "Manhwa": "Manhwa",
        "Manhua": "Manhua",
        "Webtoon": "Webtoon",
        "Novel": "Novel"
    },

    // ── Entry Points ─────────────────────────────────────────────────────────

    getPopularManga: function(page) {
        return this.getSeriesPage(page, "", "", null, null, "popular");
    },

    getLatestUpdates: function(page) {
        return this.getSeriesPage(page, "", "", null, null, "update");
    },

    getSearchManga: function(query, page) {
        return this.getSeriesPage(page, query || "", "", null, null, "");
    },

    getMangaList: function(page, status, genre, type) {
        let statusStr = "";
        if (status === 1) statusStr = "ongoing";
        else if (status === 2) statusStr = "completed";
        else if (status === 3) statusStr = "hiatus";
        return this.getSeriesPage(page, "", statusStr, genre, type, "");
    },

    // ── Manga Listing ─────────────────────────────────────────────────────────

    getSeriesPage: function(page, query, status, genre, type, order) {
        page = Math.max(1, page || 1);

        // MangaThemesia: /series/ is the manga directory
        let url = this.baseUrl + this.mangaUrlDirectory;
        let params = [];

        if (page > 1) params.push("page=" + page);
        if (query) params.push("s=" + encodeURIComponent(query));
        if (status) params.push("status=" + encodeURIComponent(status));
        if (order) params.push("order=" + encodeURIComponent(order));

        if (type) {
            let arr = Array.isArray(type) ? type : [type];
            for (let i = 0; i < arr.length; i++) {
                let val = this.typeMap[arr[i]] || arr[i];
                params.push("type=" + encodeURIComponent(val));
            }
        }

        if (genre) {
            let arr = Array.isArray(genre) ? genre : [genre];
            for (let i = 0; i < arr.length; i++) {
                let slug = arr[i].toLowerCase().trim().replace(/\s+/g, "-").replace(/'/g, "");
                if (slug) params.push("genre%5B%5D=" + encodeURIComponent(slug));
            }
        }

        if (params.length > 0) url += "?" + params.join("&");

        let response = this.fetchPage(url);
        if (!response || response.status !== 200) return { items: [], totalPages: page };

        let doc = Html.parse(response.body, url);
        let cards = doc.querySelectorAll("div.bsx");
        let items = [];

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let linkEl = card.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href") || "";
            if (!href || !href.includes("/series/")) continue;

            let relativeUrl = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            let title = linkEl.attr("title") || "";
            if (!title) {
                let ttEl = card.querySelector(".tt, .bigor .tt, h2");
                if (ttEl) title = ttEl.text().trim();
            }

            let thumbnailUrl = this.extractThumbnail(card);

            let statusVal = 0;
            let typnEl = card.querySelector(".limit .type, .epxs, .status");
            if (typnEl) {
                let s = (typnEl.text() || "").toLowerCase();
                if (s.includes("ongoing") || s.includes("berlangsung")) statusVal = 1;
                else if (s.includes("completed") || s.includes("selesai") || s.includes("tamat")) statusVal = 2;
                else if (s.includes("hiatus")) statusVal = 3;
            }

            items.push({ title: title.trim(), url: relativeUrl, thumbnailUrl: thumbnailUrl, status: statusVal });
        }

        // Detect next page & total pages
        let totalPages = page;
        let pageElements = doc.querySelectorAll(".pagination .page-numbers, .pagination a, .page-numbers");
        if (pageElements && pageElements.length > 0) {
            for (let i = 0; i < pageElements.length; i++) {
                let txt = pageElements[i].text().trim();
                let p = parseInt(txt);
                if (!isNaN(p) && p > totalPages) {
                    totalPages = p;
                }
            }
        }

        if (totalPages === page) {
            let nextEl = doc.querySelector("a.next, a[rel='next'], .hpage a.r");
            totalPages = (nextEl || items.length >= this.pageSize) ? page + 1 : page;
        }

        return { items: items, totalPages: totalPages };
    },

    // ── Manga Details ─────────────────────────────────────────────────────────

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let response = this.fetchPage(fullUrl);
        if (!response || response.status !== 200) return {};

        let doc = Html.parse(response.body, fullUrl);

        // Title
        let title = "";
        let titleEl = doc.querySelector("h1.entry-title, .entry-title, h1");
        if (titleEl) title = titleEl.text().trim().replace(/\s*Bahasa Indonesia.*/i, "").trim();

        // Thumbnail
        let thumbnailUrl = this.extractThumbnail(doc);

        // Description
        let descEl = doc.querySelector(".entry-content, .desc, .synopsis");
        let description = descEl ? descEl.text().trim() : "";

        // Author
        let author = "";
        let infoEls = doc.querySelectorAll(".tsinfo .imptdt, .spe span, .infotable tr td");
        for (let i = 0; i < infoEls.length; i++) {
            let txt = infoEls[i].text() || "";
            if (/(Author|Pengarang|Komikus)/i.test(txt)) {
                author = txt.replace(/(Author|Pengarang|Komikus)\s*:?\s*/i, "").trim();
                break;
            }
        }

        // Status
        let status = 0;
        let statusEl = doc.querySelector(".tsinfo .imptdt:last-child, .status");
        let statusTxt = statusEl ? statusEl.text().toLowerCase() : "";
        if (!statusTxt) statusTxt = (response.body || "").toLowerCase();
        if (statusTxt.includes("ongoing") || statusTxt.includes("on going")) status = 1;
        else if (statusTxt.includes("completed") || statusTxt.includes("tamat")) status = 2;
        else if (statusTxt.includes("hiatus")) status = 3;

        // Genres
        let genres = [];
        let genreEls = doc.querySelectorAll(".mgen a, .genre-info a, a[rel='tag']");
        for (let i = 0; i < genreEls.length; i++) {
            let g = genreEls[i].text().trim();
            if (g && genres.indexOf(g) === -1) genres.push(g);
        }

        return { title: title, url: url, thumbnailUrl: thumbnailUrl, author: author, status: status, description: description, genre: genres };
    },

    // ── Chapter List ──────────────────────────────────────────────────────────

    getChapterList: function(mangaUrl) {
        let fullUrl = mangaUrl.startsWith("http") ? mangaUrl : this.baseUrl + mangaUrl;
        let response = this.fetchPage(fullUrl);
        if (!response || response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        // MangaThemesia: #chapterlist ul li > .eph-num > a
        let items = doc.querySelectorAll("#chapterlist li, .eplister li");
        let chapters = [];
        let seen = {};

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let linkEl = item.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href") || "";
            if (!href || href === "#" || seen[href]) continue;
            seen[href] = true;

            // MangaThemesia chapter URLs are flat: /manga-slug-chapter-N/
            let relativeUrl = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            let nameEl = item.querySelector(".chapternum");
            let name = nameEl ? nameEl.text().trim() : linkEl.text().trim().replace(/\s+/g, " ").trim();

            let dateUpload = 0;
            let dateEl = item.querySelector(".chapterdate");
            if (dateEl) {
                dateUpload = this.parseIdDate(dateEl.text().trim());
            }

            if (name) chapters.push({ name: name, url: relativeUrl, dateUpload: dateUpload });
        }

        return chapters;
    },

    // ── Page List ─────────────────────────────────────────────────────────────

    getPageList: function(chapterUrl) {
        let fullUrl = chapterUrl.startsWith("http") ? chapterUrl : this.baseUrl + chapterUrl;
        let response = this.fetchPage(fullUrl);
        if (!response || response.status !== 200) return [];

        let pages = [];
        let referer = this.baseUrl + "/";

        // 1. MangaThemesia: ts_reader.run({...})
        let match = (response.body || "").match(/ts_reader\.run\((\{[\s\S]*?\})\);/);
        if (match && match[1]) {
            try {
                let json = JSON.parse(match[1]);
                if (json && json.sources && json.sources.length > 0) {
                    let imgs = json.sources[0].images || [];
                    for (let i = 0; i < imgs.length; i++) {
                        if (imgs[i]) {
                            let imgUrl = this.toHttps(imgs[i]);
                            pages.push(imgUrl + "|Referer=" + referer);
                        }
                    }
                    if (pages.length > 0) return pages;
                }
            } catch (e) {}
        }

        // 2. Fallback: #readerarea img
        let doc = Html.parse(response.body, fullUrl);
        let imgEls = doc.querySelectorAll("#readerarea img, .entry-content img");
        let seen = {};
        for (let i = 0; i < imgEls.length; i++) {
            let img = imgEls[i];
            let src = img.absUrl("src") || img.attr("data-src") || img.attr("data-lazy-src") || "";
            if (!src || seen[src]) continue;
            seen[src] = true;
            let imgUrl = this.toHttps(src.trim());
            pages.push(imgUrl + "|Referer=" + referer);
        }

        return pages;
    },

    // ── Helpers ───────────────────────────────────────────────────────────────

    fetchPage: function(url) {
        try {
            let response = fetch(url);
            return response;
        } catch(e) {
            return null;
        }
    },

    toHttps: function(url) {
        if (!url) return url;
        if (url.startsWith("http://")) return "https://" + url.substring(7);
        return url;
    },

    extractThumbnail: function(root) {
        if (!root) return "";
        let imgs = root.querySelectorAll(".thumb img, .cover img, .series-thumb img, img[fifu-featured], .ts-post-image, img.wp-post-image, img");
        for (let i = 0; i < imgs.length; i++) {
            let img = imgs[i];
            let src = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("data-cfsrc") || img.attr("src") || "";
            if (!src || src.startsWith("data:image/svg") || src.includes(".svg") || src.includes("logo_manhwaindo") || src.includes("site-logo") || src.includes("header-logo")) continue;
            let fullUrl = this.toHttps(src.startsWith("//") ? "https:" + src : (!src.startsWith("http") ? this.baseUrl + src : src));
            return fullUrl + "|Referer=" + this.baseUrl + "/";
        }
        return "";
    },

    parseIdDate: function(value) {
        if (!value) return 0;
        value = value.trim();
        let months = {
            "januari": 0, "jan": 0, "january": 0,
            "februari": 1, "feb": 1, "february": 1,
            "maret": 2, "mar": 2, "march": 2,
            "april": 3, "apr": 3,
            "mei": 4, "may": 4,
            "juni": 5, "jun": 5, "june": 5,
            "juli": 6, "jul": 6, "july": 6,
            "agustus": 7, "agu": 7, "august": 7, "aug": 7,
            "september": 8, "sep": 8,
            "oktober": 9, "okt": 9, "october": 9, "oct": 9,
            "november": 10, "nov": 10,
            "desember": 11, "des": 11, "december": 11, "dec": 11
        };
        // "2 Desember 2025" or "December 2, 2025"
        let m1 = value.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
        if (m1) {
            let mon = months[m1[2].toLowerCase()];
            if (mon !== undefined) return new Date(parseInt(m1[3]), mon, parseInt(m1[1])).getTime();
        }
        let m2 = value.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
        if (m2) {
            let mon = months[m2[1].toLowerCase()];
            if (mon !== undefined) return new Date(parseInt(m2[3]), mon, parseInt(m2[2])).getTime();
        }
        let t = Date.parse(value);
        return isNaN(t) ? 0 : t;
    }
};
