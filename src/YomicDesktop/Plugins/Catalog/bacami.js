/**
 * Yomic Extension: Bacami (bacami)
 * Ported from Keiyoushi id extensions-source (src/id/bacami)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Bacami",
    baseUrl: "https://v1.bacami.site",
    apiUrl: "https://v1.bacami.site",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga Online di Bacami",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/bacami/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    requestUrl: function(url, headers) {
        let reqHeaders = headers || {};
        if (!reqHeaders["User-Agent"]) {
            reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        }
        if (!reqHeaders["Referer"]) {
            reqHeaders["Referer"] = this.baseUrl + "/";
        }
        try {
            return fetch(url, { headers: reqHeaders });
        } catch (e) {
            return null;
        }
    },

    parseCards: function(doc) {
        let articles = doc.querySelectorAll("article.genre-card");
        let list = [];
        for (let article of articles) {
            let titleEl = article.querySelector("div.genre-info > a");
            let a = article.querySelector("div.genre-cover > a");
            let img = article.querySelector("div.genre-cover > a > img");
            if (titleEl && a) {
                let href = a.absUrl("href") || a.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                list.push({
                    title: titleEl.text().trim(),
                    url: rel,
                    thumbnailUrl: img ? (img.absUrl("data-src") || img.absUrl("src")) : "",
                    status: 0
                });
            }
        }
        return list;
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/custom-search/orderby/score" + (p > 1 ? "/page/" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/custom-search/orderby/latest" + (p > 1 ? "/page/" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/search/" + encodeURIComponent(query || "") + (p > 1 ? "/page/" + p : "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let items = this.parseCards(doc);
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let doc = Html.parse(res.body, fullUrl);
        let content = doc.querySelector("#komik > section.manga-content");
        if (!content) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let titleEl = content.querySelector("header > h1");
        let title = titleEl ? titleEl.text().replace(/Bahasa Indonesia$/i, "").trim() : "Manga";
        let imgEl = content.querySelector("figure .image-wrap img");
        let descEl = content.querySelector("p.manga-description");
        let altEl = content.querySelector("p.manga-altname");

        let author = "";
        let infoItems = content.querySelectorAll(".info-item");
        for (let item of infoItems) {
            if (item.text().toLowerCase().includes("author")) {
                let val = item.querySelector(".info-value");
                if (val) author = val.text().trim();
            }
        }

        let genres = [];
        for (let a of content.querySelectorAll("nav > span > a")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        let status = 0;
        if (doc.querySelector(".hot-tag, .project-tag")) status = 1;
        else if (doc.querySelector(".tamat-tag")) status = 2;

        let desc = descEl ? descEl.text().trim() : "";
        if (altEl && altEl.text().trim()) desc += "\n\nAlternative Title: " + altEl.text().trim();

        return {
            title: title,
            url: url,
            thumbnailUrl: imgEl ? (imgEl.absUrl("data-src") || imgEl.absUrl("src")) : "",
            author: author,
            status: status,
            description: desc.trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chLinks = doc.querySelectorAll("ol.chapter-list > li a.ch-link");
        let chDates = doc.querySelectorAll("ol.chapter-list > li span.ch-date");
        let chs = [];

        for (let i = 0; i < chLinks.length; i++) {
            let rawName = chLinks[i].text().trim();
            let cleanName = rawName.includes("-") ? rawName.substring(rawName.lastIndexOf("-") + 1).trim() : rawName;
            let href = chLinks[i].absUrl("href") || chLinks[i].attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: cleanName || rawName,
                url: rel,
                uploadDate: chDates[i] ? chDates[i].text().trim() : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let match = res.body.match(/imageUrls:\s*(\[[^\]]+\])/);
        if (match) {
            try {
                return JSON.parse(match[1]);
            } catch (e) {}
        }
        return [];
    }
};