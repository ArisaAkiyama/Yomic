var source = {
    name: "KomikStation",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komikstation/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://komikstation.org",
    apiUrl: "https://komikstation.org",
    language: "id",
    version: "1.0.8",
    description: "Baca komik Manga, Manhwa, dan Manhua Bahasa Indonesia dari KomikStation",
    author: "DesktopKomik",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 30,

    genres: [
        "Action", "Adult", "Adventure", "Boys' Love", "Comedy", "Cooking", "Crime",
        "Cultivation", "Demon", "Demons", "Drama", "Ecchi", "Fantasy", "Game",
        "Gender Bender", "Girls' Love", "Gore", "Harem", "Historical", "Horror",
        "Isekai", "Josei", "Magic", "Martial Arts", "Mature", "Mecha", "Medical",
        "Military", "Music", "Mystery", "One-Shot", "Psychological", "Reincarnation",
        "Romance", "School", "School Life", "Sci-Fi", "Seinen", "Shoujo", "Shoujo Ai",
        "Shounen", "Shounen Ai", "Slice of Life", "Smut", "Sports", "Super Power",
        "Supernatural", "Survival", "Thriller", "Time Travel", "Tragedy", "Vampire",
        "Webtoon", "Wuxia", "Yaoi", "Yuri"
    ],

    formats: ["Manga", "Manhwa", "Manhua", "Comic", "Novel"],

    typeMap: {
        "Manga": "manga",
        "Manhwa": "manhwa",
        "Manhua": "manhua",
        "Comic": "comic",
        "Novel": "novel"
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

        return this.getSeriesPage(page, "", statusStr, genre, type, "");
    },

    getSeriesPage: function(page, query, status, genre, type, order) {
        page = Math.max(1, page || 1);
        let url = `${this.baseUrl}/manga/`;

        let params = [];
        if (page > 1) {
            params.push("page=" + page);
        }
        if (query) params.push("s=" + encodeURIComponent(query));
        if (status) params.push("status=" + encodeURIComponent(status));

        if (type) {
            let arr = [];
            if (Array.isArray(type)) arr = type;
            else if (type.length !== undefined && typeof type !== 'string') {
                for (let i = 0; i < type.length; i++) arr.push(type[i]);
            } else arr = [type];

            for (let i = 0; i < arr.length; i++) {
                let val = this.typeMap[arr[i]] || arr[i].toLowerCase();
                params.push("type=" + encodeURIComponent(val));
            }
        }

        if (order) {
            params.push("order=" + encodeURIComponent(order));
        }

        if (genre) {
            let arr = [];
            if (Array.isArray(genre)) arr = genre;
            else if (genre.length !== undefined && typeof genre !== 'string') {
                for (let i = 0; i < genre.length; i++) arr.push(genre[i]);
            } else arr = [genre];

            for (let i = 0; i < arr.length; i++) {
                let slug = arr[i].toLowerCase().trim().replace(/\s+/g, "-").replace(/'/g, "");
                if (slug) {
                    params.push("genre%5B%5D=" + encodeURIComponent(slug));
                }
            }
        }

        if (params.length > 0) {
            url += "?" + params.join("&");
        }

        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: page };

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
                let ttEl = card.querySelector(".tt, .title");
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

                if (dataSrc && (!src || src.startsWith("data:"))) {
                    thumbnailUrl = dataSrc;
                } else if (src && !src.startsWith("data:")) {
                    thumbnailUrl = src;
                } else {
                    thumbnailUrl = dataSrc || src;
                }

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
        let totalPages = 313;
        if (isFiltered) {
            let nextEl = doc.querySelector(".hpage a, .hpage a.r, .pagination a.next, a.next, a.next.page-numbers");
            totalPages = (nextEl || items.length >= this.pageSize) ? page + 1 : page;
        }

        return {
            items: items,
            totalPages: totalPages
        };
    },

    getMangaDetails: function(url) {
        let fullUrl = this.baseUrl + url;
        let response = fetch(fullUrl);
        if (response.status !== 200) return {};

        let doc = Html.parse(response.body, fullUrl);

        let titleEl = doc.querySelector("h1.entry-title, h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let thumbEl = doc.querySelector(".thumb img, img.wp-post-image");
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

        let descEl = doc.querySelector(".entry-content, div[itemprop='description'], .desc, .synopsis");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEls = doc.querySelectorAll(".tsinfo .imethod, .infotable tr, .spe span");
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
        let genreEls = doc.querySelectorAll(".mgen a, .genres-container a, a[rel='tag']");
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
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let items = doc.querySelectorAll("#chapterlist ul li, .eplister ul li, ul.cl-ul li");
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

            let nameEl = item.querySelector(".chapternum");
            let name = nameEl ? nameEl.text().trim() : linkEl.text().trim();

            let dateEl = item.querySelector(".chapterdate");
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
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

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
        let imgEls = doc.querySelectorAll("#readerarea img");
        for (let i = 0; i < imgEls.length; i++) {
            let img = imgEls[i];
            let src = img.absUrl("src");
            if (!src) src = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src");
            if (src && !src.includes("pebaikan.png")) {
                pages.push(src.trim());
            }
        }

        return pages;
    }
};
