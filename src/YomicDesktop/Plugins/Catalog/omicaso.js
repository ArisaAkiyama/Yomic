/**
 * Yomic Extension: Omicaso (omicaso)
 * Ported from Keiyoushi id extensions-source (src/id/omicaso)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Omicaso",
    baseUrl: "https://omicaso.org",
    apiUrl: "https://omicaso.org",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga di Omicaso",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/omicaso/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/api/manga.php?page=1&limit=20&mode=all&sort=popular";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = (json.sections && json.sections.trending && json.sections.trending.all) ? json.sections.trending.all : (json.items || []);
        let items = list.map(item => ({
            title: item.title,
            url: "/manga.php?slug=" + item.slug,
            thumbnailUrl: item.thumbnail || item.cover,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/api/manga.php?page=" + p + "&limit=20&mode=all&sort=updated";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let json = JSON.parse(res.body);
        let list = json.items || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/manga.php?slug=" + item.slug,
            thumbnailUrl: item.thumbnail || item.cover,
            status: 0
        }));
        return { items: items, totalPages: json.hasMore ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/api/manga.php?page=" + p + "&limit=20&mode=all&q=" + encodeURIComponent(query || "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let json = JSON.parse(res.body);
        let list = json.items || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/manga.php?slug=" + item.slug,
            thumbnailUrl: item.thumbnail || item.cover,
            status: 0
        }));
        return { items: items, totalPages: json.hasMore ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/manga.php?slug=", "").replace(/^\/+|\/+$/g, "");
        let durl = this.baseUrl + "/manga.php?slug=" + slug + "&order=desc";
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let doc = Html.parse(res.body, durl);
        let titleEl = doc.querySelector("h1");
        let posterEl = doc.querySelector(".detail-poster img");
        let descEl = doc.querySelector(".synopsis-box p");
        let altEl = doc.querySelector(".detail-alt-title");

        let desc = descEl ? descEl.text().trim() : "";
        if (altEl && altEl.text().trim()) desc += "\n\nAlternative Name: " + altEl.text().trim();

        let author = "";
        let status = 0;
        let statRows = doc.querySelectorAll(".detail-stat-grid div");
        for (let row of statRows) {
            let span = row.querySelector("span");
            let strong = row.querySelector("strong");
            if (span && strong) {
                let st = span.text().toLowerCase();
                let val = strong.text().trim();
                if (st.includes("author")) author = val;
                if (st.includes("status")) {
                    let sv = val.toLowerCase();
                    if (sv.includes("ongoing")) status = 1;
                    else if (sv.includes("completed")) status = 2;
                }
            }
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".detail-rating-line a")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: titleEl ? titleEl.text().trim() : "",
            url: url,
            thumbnailUrl: posterEl ? posterEl.absUrl("src") : "",
            author: author,
            status: status,
            description: desc.trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slug = url.replace("/manga.php?slug=", "").replace(/^\/+|\/+$/g, "");
        let durl = this.baseUrl + "/manga.php?slug=" + slug + "&order=desc";
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, durl);
        let chEls = doc.querySelectorAll("a.chapter-row");
        let chs = [];

        for (let a of chEls) {
            let strong = a.querySelector("strong");
            let time = a.querySelector("time");
            let href = a.absUrl("href") || a.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: strong ? strong.text().trim() : "Chapter",
                url: rel,
                uploadDate: time ? time.attr("datetime") : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("img[data-reader-image]");
        let list = [];

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src) list.push(src);
        }
        return list;
    }
};