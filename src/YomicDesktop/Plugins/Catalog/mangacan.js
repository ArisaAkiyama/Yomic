var source = {
    name: "Manga Can",
    baseUrl: "https://mangacanblog.com",
    apiUrl: "https://mangacanblog.com",
    mirrorUrls: ['https://mangacanblog.com'],
    currentMirrorIndex: 0,
    mangaUrlDirectory: "",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga Bahasa Indonesia gratis terupdate di Manga Can Blog",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mangacan/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#14532d",
    iconForeground: "#4ade80",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,

    genres: [
        "Action", "Adult", "Adventure", "Comedy", "Cooking", "Crime", "Cultivation",
        "Demon", "Demons", "Drama", "Ecchi", "Fantasy", "Game", "Gender Bender",
        "Gore", "Harem", "Historical", "Horror", "Isekai", "Josei", "Magic",
        "Martial Arts", "Mature", "Mecha", "Medical", "Military", "Music", "Mystery",
        "Psychological", "Reincarnation", "Romance", "School", "School Life", "Sci-Fi",
        "Seinen", "Shoujo", "Shounen", "Slice of Life", "Smut", "Sports", "Super Power",
        "Supernatural", "Survival", "Thriller", "Time Travel", "Tragedy", "Webtoon"
    ],

    formats: ["Manga", "Manhwa", "Manhua"],

    requestUrl: function(url) {
        for (var i = 0; i < this.mirrorUrls.length; i++) {
            var activeBase = this.mirrorUrls[(this.currentMirrorIndex + i) % this.mirrorUrls.length];
            var testUrl = url;
            if (testUrl.startsWith(this.baseUrl) && activeBase !== this.baseUrl) {
                testUrl = activeBase + testUrl.substring(this.baseUrl.length);
            }

            try {
                var res = fetch(testUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": activeBase + "/",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
                    }
                });
                if (res && res.status === 200 && res.body) {
                    if (activeBase !== this.baseUrl) {
                        this.baseUrl = activeBase;
                        this.apiUrl = activeBase;
                        this.currentMirrorIndex = (this.currentMirrorIndex + i) % this.mirrorUrls.length;
                    }
                    return res;
                }
            } catch (err) {
                log("Fetch error for " + testUrl + ": " + err);
            }
        }

        return fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": this.baseUrl + "/"
            }
        });
    },

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

        return this.getSeriesPage(page, "", statusStr, genre, type, "popular");
    },

    getSeriesPage: function(page, query, status, genre, type, order) {
        page = Math.max(1, page || 1);
        let path = this.mangaUrlDirectory ? this.mangaUrlDirectory + "/" : "/";
        let url = this.baseUrl + path;

        let params = [];
        if (page > 1) {
            params.push("page=" + page);
        }
        if (query) {
            params.push("s=" + encodeURIComponent(query));
        }
        if (status) {
            params.push("status=" + encodeURIComponent(status));
        }
        if (type) {
            let typeStr = Array.isArray(type) ? type[0] : String(type);
            params.push("type=" + encodeURIComponent(typeStr.toLowerCase()));
        }
        if (order) {
            params.push("order=" + encodeURIComponent(order));
        }

        if (genre) {
            let arr = Array.isArray(genre) ? genre : [genre];
            for (let i = 0; i < arr.length; i++) {
                let g = arr[i].toLowerCase().trim().replace(/\s+/g, "-").replace(/'/g, "");
                if (g) params.push("genre%5B%5D=" + encodeURIComponent(g));
            }
        }

        if (params.length > 0) {
            url += "?" + params.join("&");
        }

        let response = this.requestUrl(url);
        if (response.status !== 200 || !response.body) return { items: [], totalPages: page };

        let doc = Html.parse(response.body, url);
        let cards = doc.querySelectorAll("div.bsx, div.utao, div.animposx, div.manga-item");
        let items = [];

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let linkEl = card.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href");
            if (!href || href === "#") continue;

            let relativeUrl = href;
            if (href.startsWith(this.baseUrl)) {
                relativeUrl = href.substring(this.baseUrl.length);
            }

            let title = linkEl.attr("title");
            if (!title) {
                let ttEl = card.querySelector(".tt, .title, h4, h2");
                if (ttEl) title = ttEl.text().trim();
            }
            if (!title) title = linkEl.text().trim();

            let imgs = card.querySelectorAll("img");
            let imgEl = null;
            for (let j = 0; j < imgs.length; j++) {
                let s = (imgs[j].attr("data-src") || imgs[j].attr("src") || "").toLowerCase();
                if (s && !s.includes("/flags/") && !s.includes(".svg") && !s.startsWith("data:image/svg")) {
                    imgEl = imgs[j];
                    break;
                }
            }
            if (!imgEl && imgs.length > 0) imgEl = imgs[imgs.length - 1];

            let thumbnailUrl = "";
            if (imgEl) {
                let dataSrc = imgEl.attr("data-src") || imgEl.attr("data-lazy-src") || imgEl.attr("data-cfsrc") || "";
                let src = imgEl.attr("src") || "";
                thumbnailUrl = (dataSrc && (!src || src.startsWith("data:"))) ? dataSrc : (src || dataSrc);

                if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
                    if (thumbnailUrl.startsWith("//")) {
                        thumbnailUrl = "https:" + thumbnailUrl;
                    } else if (thumbnailUrl.startsWith("/")) {
                        thumbnailUrl = this.baseUrl + thumbnailUrl;
                    }
                }
            }

            let statusVal = 0;
            let statusEl = card.querySelector(".status, .epxs, .mg_status");
            if (statusEl) {
                let sText = statusEl.text().toLowerCase();
                let sClass = statusEl.attr("class") || "";
                if (sText.includes("ongoing") || sClass.includes("ongoing")) statusVal = 1;
                else if (sText.includes("completed") || sClass.includes("completed")) statusVal = 2;
            }

            items.push({
                title: title.trim(),
                url: relativeUrl,
                thumbnailUrl: thumbnailUrl,
                coverUrl: thumbnailUrl,
                status: statusVal
            });
        }

        let isFiltered = Boolean(query || status || genre || type);
        let nextEl = doc.querySelector(".hpage a, .hpage a.r, .pagination a.next, a.next, a.next.page-numbers");
        let totalPages = (nextEl || items.length >= this.pageSize) ? page + 1 : page;

        return {
            items: items,
            totalPages: totalPages
        };
    },

    getMangaDetails: function(url) {
        let fullUrl = this.baseUrl + url;
        let response = this.requestUrl(fullUrl);
        if (response.status !== 200 || !response.body) return {};

        let doc = Html.parse(response.body, fullUrl);

        let titleEl = doc.querySelector("h1.entry-title, h1, .ts-breadcrumb li:last-child span");
        let title = titleEl ? titleEl.text().trim() : "";

        let thumbEl = doc.querySelector(".thumb img, img.wp-post-image, .infomanga > div[itemprop=image] img");
        let thumbnailUrl = "";
        if (thumbEl) {
            let dataSrc = thumbEl.attr("data-src") || thumbEl.attr("data-lazy-src") || thumbEl.attr("data-cfsrc") || "";
            let src = thumbEl.attr("src") || "";
            thumbnailUrl = (dataSrc && (!src || src.startsWith("data:"))) ? dataSrc : (src || dataSrc);
            if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
                if (thumbnailUrl.startsWith("//")) thumbnailUrl = "https:" + thumbnailUrl;
                else if (thumbnailUrl.startsWith("/")) thumbnailUrl = this.baseUrl + thumbnailUrl;
            }
        }

        let descEl = doc.querySelector(".entry-content, div[itemprop='description'], .desc, .synopsis, .infox .desc");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEls = doc.querySelectorAll(".tsinfo .imethod, .infotable tr, .spe span, .fmed");
        for (let i = 0; i < authorEls.length; i++) {
            let txt = authorEls[i].text();
            if (txt.includes("Author") || txt.includes("Pengarang") || txt.includes("Komikus")) {
                author = txt.replace(/Author|Pengarang|Komikus|:|;/gi, "").trim();
                break;
            }
        }

        let status = 0;
        let bodyText = response.body.toLowerCase();
        if (bodyText.includes("status: ongoing") || bodyText.includes("status ongoing") || bodyText.includes(">ongoing<")) {
            status = 1;
        } else if (bodyText.includes("status: completed") || bodyText.includes("status completed") || bodyText.includes(">completed<")) {
            status = 2;
        } else if (bodyText.includes("status: hiatus") || bodyText.includes("status hiatus")) {
            status = 3;
        }

        let genres = [];
        let genreEls = doc.querySelectorAll(".mgen a, .genres-container a, a[rel='tag'], .seriestugenre a, div.gnr a");
        for (let i = 0; i < genreEls.length; i++) {
            let gText = genreEls[i].text().trim();
            if (gText && genres.indexOf(gText) === -1) {
                genres.push(gText);
            }
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumbnailUrl,
            author: author,
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(mangaUrl) {
        let fullUrl = this.baseUrl + mangaUrl;
        let response = this.requestUrl(fullUrl);
        if (response.status !== 200 || !response.body) return [];

        let doc = Html.parse(response.body, fullUrl);
        let items = doc.querySelectorAll("#chapterlist ul li, .eplister ul li, ul.cl-ul li, div.bxcl li, div.cl li");
        let chapters = [];

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let linkEl = item.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href");
            if (!href || href === "#") continue;

            let relativeUrl = href;
            if (href.startsWith(this.baseUrl)) {
                relativeUrl = href.substring(this.baseUrl.length);
            }

            let nameEl = item.querySelector(".chapternum, .lch a");
            let name = nameEl ? nameEl.text().trim() : linkEl.text().trim();

            let dateEl = item.querySelector(".chapterdate, time");
            let dateUpload = 0;
            if (dateEl) {
                let dateStr = dateEl.text().trim();
                if (dateStr) {
                    let parsedDate = Date.parse(dateStr);
                    if (!isNaN(parsedDate)) {
                        dateUpload = parsedDate;
                    }
                }
            }

            chapters.push({
                name: name,
                url: relativeUrl,
                dateUpload: dateUpload
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let fullUrl = this.baseUrl + chapterUrl;
        let response = this.requestUrl(fullUrl);
        if (response.status !== 200 || !response.body) return [];

        let pages = [];

        // 1. Try ts_reader JS script parsing
        let match = response.body.match(/ts_reader\.run\((.*?)\);/);
        if (match && match[1]) {
            try {
                let json = JSON.parse(match[1]);
                if (json && json.sources && json.sources.length > 0 && json.sources[0].images) {
                    let imgs = json.sources[0].images;
                    for (let i = 0; i < imgs.length; i++) {
                        if (imgs[i]) pages.push(imgs[i]);
                    }
                    if (pages.length > 0) return pages;
                }
            } catch (e) {}
        }

        // 2. Fallback to HTML DOM parsing
        let doc = Html.parse(response.body, fullUrl);
        let imgEls = doc.querySelectorAll("#readerarea img, div.images img, div#readerarea img, img.ts-main-image, center img.ts-main-image, center img");
        for (let i = 0; i < imgEls.length; i++) {
            let img = imgEls[i];
            let src = img.absUrl("src");
            if (!src) src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src");
            if (src && !src.includes("pebaikan.png") && !src.includes("readerarea.svg") && !src.includes("/flags/") && !src.includes("akhir_baru.png") && !src.includes("icon.png") && !src.startsWith("data:image/svg")) {
                pages.push(src.trim());
            }
        }

        return pages;
    }
};
