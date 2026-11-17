/**
 * Yomic Extension: Ikiru (ikiru)
 * Ported from Keiyoushi id extensions-source (src/id/ikiru)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Ikiru",
    baseUrl: "https://09.ikiru.wtf",
    apiUrl: "https://09.ikiru.wtf",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa Terjemahan Bahasa Indonesia di Ikiru",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/ikiru/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/api/public/library/search?sortBy=popular&sort=desc&page=" + p;
        return this.parseSearchApi(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/api/public/library/search?sortBy=updated&sort=desc&page=" + p;
        return this.parseSearchApi(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/api/public/library/search?query=" + encodeURIComponent(query || "") + "&page=" + p;
        return this.parseSearchApi(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseSearchApi: function(url, page) {
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let json = JSON.parse(res.body);
        let data = json.data || {};
        let list = data.mangas || data.project || [];
        let items = [];

        for (let m of list) {
            let slug = m.slug || "";
            if (!slug) continue;
            let thumb = m.featuredImage || m.cover || m.thumbnail || "";
            if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + "/" + thumb.replace(/^\//, "");
            items.push({
                title: (m.title || slug).trim(),
                url: "/manga/" + encodeURIComponent(slug),
                thumbnailUrl: thumb,
                status: 0
            });
        }
        let totalPages = page || 1;
        if (data.total && list.length > 0) {
            if ((page || 1) * list.length < data.total) totalPages = (page || 1) + 1;
        }
        return { items: items, totalPages: totalPages };
    },

    getMangaDetails: function(url) {
        let slug = decodeURIComponent(url.replace("/manga/", "").replace(/^\//, "").replace(/\/$/, ""));
        let apiUrl = this.baseUrl + "/api/public/manga/" + encodeURIComponent(slug);
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let json = JSON.parse(res.body);
        let d = json.data || {};
        let title = d.title || slug;
        let thumb = d.cover || "";
        if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + "/" + thumb.replace(/^\//, "");

        let author = d.author || "";
        let genres = [];
        if (Array.isArray(d.genres)) {
            genres = d.genres.map(function(g) { return typeof g === "object" ? g.name : g; });
        }

        let status = 0;
        let s = (d.status || "").toLowerCase();
        if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
        else if (s.includes("completed") || s.includes("tamat")) status = 2;

        return {
            title: title.trim(),
            url: url,
            thumbnailUrl: thumb,
            author: author,
            status: status,
            description: (d.synopsis || "").trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slug = decodeURIComponent(url.replace("/manga/", "").replace(/^\//, "").replace(/\/$/, ""));
        let apiUrl = this.baseUrl + "/api/public/manga/" + encodeURIComponent(slug);
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        let json = JSON.parse(res.body);
        let d = json.data || {};
        let chs = (d.chapters && d.chapters.chapters) ? d.chapters.chapters : (d.chapters || []);
        let chapters = [];

        for (let ch of chs) {
            let chSlug = ch.slug || ch.chapterSlug || ch.id || "";
            let name = ch.title || ch.name || ("Chapter " + (ch.chapterNumber || ""));
            chapters.push({
                name: name.trim(),
                url: "/chapter/" + encodeURIComponent(slug) + "/" + encodeURIComponent(chSlug),
                uploadDate: ch.date || ""
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("img[src*='cdn.ikiru.id'], .chapter-image img, #reader img, img.chapter-img");
        let pages = [];
        let seen = {};

        for (let img of imgs) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src && !seen[src]) {
                seen[src] = true;
                pages.push(src);
            }
        }
        return pages;
    }
};
