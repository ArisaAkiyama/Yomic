/**
 * Yomic Extension: CosmicScans (cosmicscansid)
 * Ported from Keiyoushi id extensions-source (src/id/cosmicscansid)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "CosmicScans",
    baseUrl: "https://04.cosmicscans.to",
    apiUrl: "https://cdncid.csmcscns.id/v1/manga",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manhwa & Manga di CosmicScans",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/cosmicscansid/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 24,
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
        let url = this.apiUrl + "/filter?limit=24&order_by=popular";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/series/" + item.slug,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: (json.cursor && json.cursor.hasNext) ? 2 : 1 };
    },

    getLatestUpdates: function(page) {
        let url = this.apiUrl + "/filter?limit=24&order_by=update";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/series/" + item.slug,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: (json.cursor && json.cursor.hasNext) ? 2 : 1 };
    },

    getSearchManga: function(query, page) {
        let url = this.apiUrl + "/search?limit=48&q=" + encodeURIComponent(query || "");
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/series/" + item.slug,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: 1 };
    },

        getMangaList: function(page, status, genre, type, sort) {
        let order = (sort === "latest") ? "update" : "popular";
        let url = this.apiUrl + "/filter?limit=24&order_by=" + order;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/series/" + item.slug,
            thumbnailUrl: item.cover,
            status: 0
        }));
        return { items: items, totalPages: (json.cursor && json.cursor.hasNext) ? 2 : 1 };
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/series/", "").replace("/manga/", "").replace(/^\/+|\/+$/g, "");
        let durl = this.apiUrl + "/mangaDetail/" + slug;
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };

        let status = 0;
        let st = (d.status || "").toLowerCase();
        if (st === "ongoing") status = 1;
        else if (st === "completed" || st === "complete") status = 2;
        else if (st.includes("hiatus") || st.includes("hold")) status = 3;

        return {
            title: d.title || "",
            url: url,
            thumbnailUrl: d.cover || "",
            author: d.author || "",
            status: status,
            description: d.sinopsis || (d.type ? "Type: " + d.type : ""),
            genre: d.genre || []
        };
    },

    getChapterList: function(url) {
        let slug = url.replace("/series/", "").replace("/manga/", "").replace(/^\/+|\/+$/g, "");
        let durl = this.apiUrl + "/mangaDetail/" + slug;
        let res = this.requestUrl(durl);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let d = json.data;
        if (!d || !d.chapters) return [];

        return d.chapters.filter(c => !c.redirect_link).map(ch => ({
            name: "Chapter " + ch.chapterNum,
            url: "/chapter/" + ch.slug,
            uploadDate: ch.time || ""
        }));
    },

    getPageList: function(url) {
        let slug = url.substring(url.lastIndexOf("/") + 1);
        let rurl = this.apiUrl + "/readingPage/" + slug;
        let res = this.requestUrl(rurl);
        if (!res || res.status !== 200 || !res.body) return [];
        let json = JSON.parse(res.body);
        let count = (json.data && json.data.pageCount) ? json.data.pageCount : 0;
        let pages = [];
        for (let i = 0; i < count; i++) {
            pages.push("https://cosmicscans.invalid/" + slug + "/" + i);
        }
        return pages;
    }
};