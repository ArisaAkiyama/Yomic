var source = {
    name: "Luvyaa",
    baseUrl: "https://v4.luvyaa.co",
    apiUrl: "https://v4.luvyaa.co",
    iconUrl: "https://raw.githubusercontent.com/ArisaAkiyama/extension-yomic/main/icons/luvyaa.png",
    language: "id",
    version: "1.0.1",
    description: "Baca komik Bahasa Indonesia dari Luvyaa",
    author: "DesktopKomik",
    iconBackground: "#d20f39",
    iconForeground: "#ffffff",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 18,

    genres: [
        "Action", "Adaptation", "Adult", "Adventure", "Age Gap", "BDSM", "Childhood Friends",
        "Comedy", "Cooking", "Crime", "Demon", "Demons", "Drama", "Ecchi", "Fantasy",
        "Full Color", "Game", "Gender Bender", "Gore", "Harem", "Hentai", "Historical",
        "Horror", "Isekai", "Josei", "Josei(W)", "Kids", "Magic", "Manga", "Manhwa",
        "Martial Arts", "Mature", "Mecha", "Medical", "Military", "Modern Romance",
        "Mystery", "NTR", "Office Workers", "Psychological", "Regression", "Reincarnation",
        "Revenge", "Reverse Harem", "Rofan", "Romance", "Royal family", "Royalty",
        "School", "School Life", "Sci-fi", "Seinen", "Seinen(M)", "Shoujo", "Shoujo Ai",
        "Shoujo(G)", "Shounen", "Slice of Life", "Smut", "Sports", "Super Power",
        "Supernatural", "Thriler", "Thriller", "Time Travel", "Tragedy", "Transmigration",
        "Villainess", "Webtoon", "Webtoons", "Yaoi", "Yaoi(BL)", "Yuri"
    ],

    formats: ["Manga", "Manhwa", "Manhua", "Comic", "Novel"],

    genreMap: {
        "Action": "4", "Adaptation": "1843", "Adult": "50", "Adventure": "111", "Age Gap": "2097",
        "BDSM": "2188", "Childhood Friends": "2055", "Comedy": "5", "Cooking": "705", "Crime": "1454",
        "Demon": "1119", "Demons": "818", "Drama": "10", "Ecchi": "83", "Fantasy": "6",
        "Full Color": "1049", "Game": "881", "Gender Bender": "90", "Gore": "670", "Harem": "29",
        "Hentai": "2089", "Historical": "35", "Horror": "93", "Isekai": "599", "Josei": "25",
        "Josei(W)": "1866", "Kids": "2154", "Magic": "569", "Manga": "4901", "Manhwa": "4866",
        "Martial Arts": "109", "Mature": "33", "Mecha": "597", "Medical": "893", "Military": "647",
        "Modern Romance": "1900", "Mystery": "12", "NTR": "2135", "Office Workers": "2119",
        "Psychological": "36", "Regression": "1844", "Reincarnation": "581", "Revenge": "1845",
        "Reverse Harem": "1894", "Rofan": "1326", "Romance": "19", "Royal family": "2099",
        "Royalty": "1846", "School": "1153", "School Life": "20", "Sci-fi": "133", "Seinen": "81",
        "Seinen(M)": "2183", "Shoujo": "43", "Shoujo Ai": "1002", "Shoujo(G)": "2056", "Shounen": "58",
        "Slice of Life": "14", "Smut": "51", "Sports": "659", "Super Power": "924", "Supernatural": "8",
        "Thriler": "1455", "Thriller": "816", "Time Travel": "1847", "Tragedy": "37", "Transmigration": "1984",
        "Villainess": "2251", "Webtoon": "1842", "Webtoons": "605", "Yaoi": "66", "Yaoi(BL)": "76", "Yuri": "1224"
    },

    typeMap: {
        "Manga": "manga",
        "Manhwa": "manhwa",
        "Manhua": "manhua",
        "Comic": "comic",
        "Novel": "novel"
    },

    getPopularManga: function(page) {
        return this.getDirectoryPage(page, "", "", null, null, "popular");
    },

    getLatestUpdates: function(page) {
        return this.getDirectoryPage(page, "", "", null, null, "update");
    },

    getSearchManga: function(query, page) {
        return this.getDirectoryPage(page, query || "", "", null, null, "");
    },

    getMangaList: function(page, status, genre, type) {
        let statusStr = "";
        if (status === 1) statusStr = "ongoing";
        else if (status === 2) statusStr = "completed";
        else if (status === 3) statusStr = "hiatus";

        return this.getDirectoryPage(page, "", statusStr, genre, type, "");
    },

    getDirectoryPage: function(page, query, status, genre, type, order) {
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
                let id = this.genreMap[arr[i]];
                if (id) {
                    params.push("genre%5B%5D=" + id);
                }
            }
        }

        if (params.length > 0) {
            url += "?" + params.join("&");
        }

        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: page };

        let doc = Html.parse(response.body, url);
        let cards = doc.querySelectorAll("div.bsx, div.utao, div.animposx");
        let items = [];

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let linkEl = card.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href");
            if (!href) continue;

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

            let imgEl = card.querySelector("img");
            let thumbnailUrl = "";
            if (imgEl) {
                thumbnailUrl = imgEl.absUrl("src");
                if (!thumbnailUrl) thumbnailUrl = imgEl.attr("src") || "";
                if (!thumbnailUrl) thumbnailUrl = imgEl.attr("data-src") || "";
            }

            let statusVal = 0;
            let statusEl = card.querySelector(".status, .epxs");
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
                status: statusVal
            });
        }

        let isFiltered = Boolean(query || status || genre || type);
        let totalPages = 309;
        if (isFiltered) {
            let nextEl = doc.querySelector("a.next.page-numbers, .pagination a.next");
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

        let titleEl = doc.querySelector("h1.entry-title");
        let title = titleEl ? titleEl.text().trim() : "";

        let thumbEl = doc.querySelector(".thumb img, img.wp-post-image");
        let thumbnailUrl = thumbEl ? (thumbEl.absUrl("src") || thumbEl.attr("src") || "") : "";

        let descEl = doc.querySelector(".entry-content, div[itemprop='description'], .desc, .synopsis");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEls = doc.querySelectorAll(".tsinfo .imethod, .infotable tr, .spe span");
        for (let i = 0; i < authorEls.length; i++) {
            let txt = authorEls[i].text();
            if (txt.includes("Author") || txt.includes("Pengarang")) {
                author = txt.replace(/Author|Pengarang|:|;/gi, "").trim();
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
        let items = doc.querySelectorAll("#chapterlist ul li, ul.cl-ul li, div.eplister ul li");
        let chapters = [];

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let linkEl = item.querySelector("a");
            if (!linkEl) continue;

            let href = linkEl.attr("href");
            if (!href) continue;

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
            if (!src) src = img.attr("src") || img.attr("data-src");
            if (src && !src.includes("pebaikan.png")) {
                pages.push(src);
            }
        }

        return pages;
    }
};
