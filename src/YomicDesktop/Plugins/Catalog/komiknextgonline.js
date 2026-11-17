/**
 * Yomic Extension: Komik Next G Online (komiknextgonline)
 * Ported from Keiyoushi id extensions-source (src/id/komiknextgonline)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Komik Next G Online",
    baseUrl: "https://komiknextgonline.com",
    apiUrl: "https://komiknextgonline.com",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Anak di Komik Next G Online",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komiknextgonline/res/mipmap-xxhdpi/ic_launcher.png",
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

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/comic/page/" + p + "/";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let wrappers = doc.querySelectorAll("span.comic-thumbnail-wrapper");
        let items = [];

        for (let w of wrappers) {
            let img = w.querySelector("img");
            let a = w.querySelector("a");
            if (img && a) {
                let rawTitle = img.attr("alt") || "";
                let title = rawTitle.replace(/\s+cover$/i, "").trim();
                let href = a.absUrl("href") || a.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                items.push({
                    title: title || "Komik Next G",
                    url: rel,
                    thumbnailUrl: img.absUrl("src"),
                    status: 0
                });
            }
        }
        return { items: items, totalPages: items.length >= 10 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        return this.getPopularManga(page);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/?s=" + encodeURIComponent(query || "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let doc = Html.parse(res.body, url);
        let entries = doc.querySelectorAll("#left-content ul#comic-list li.comic, #left-content article.comic");
        let items = [];

        for (let item of entries) {
            let titleEl = item.querySelector(".comic-title, .entry-title");
            let a = item.querySelector("a");
            let img = item.querySelector("img");
            if (titleEl && a) {
                let title = titleEl.text().replace(/^#\d+\.\s*/, "").trim();
                let href = a.absUrl("href") || a.attr("href") || "";
                let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                items.push({
                    title: title,
                    url: rel,
                    thumbnailUrl: img ? img.absUrl("src") : "",
                    status: 0
                });
            }
        }
        return { items: items, totalPages: 1 };
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
        let ogTitle = doc.querySelector("meta[property=\"og:title\"]");
        let ogDesc = doc.querySelector("meta[property=\"og:description\"]");
        let ogImg = doc.querySelector("meta[property=\"og:image\"]");

        let rawTitle = ogTitle ? ogTitle.attr("content") : "";
        let title = rawTitle.split(" - ")[0].trim();

        return {
            title: title || "Komik",
            url: url,
            thumbnailUrl: ogImg ? ogImg.absUrl("content") : "",
            author: "Mizan",
            status: 2,
            description: ogDesc ? ogDesc.attr("content") : "",
            genre: ["Kids", "Comedy"]
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        let date = "";
        if (res && res.body) {
            let doc = Html.parse(res.body, fullUrl);
            let pubTime = doc.querySelector("meta[property=\"article:published_time\"]");
            if (pubTime) date = pubTime.attr("content");
        }
        return [{
            name: "Chapter 1",
            url: url,
            uploadDate: date
        }];
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("div#spliced-comic img");
        let list = [];

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src) list.push(src);
        }
        return list;
    }
};