/**
 * Yomic Extension: Shinigami (shinigami)
 * Ported from Keiyoushi id extensions-source (src/id/shinigami)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Shinigami",
    baseUrl: "https://11.shinigami.asia",
    apiUrl: "https://11.shinigami.asia",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga, Manhwa, Manhua Bahasa Indonesia di Shinigami",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/shinigami/res/mipmap-xxhdpi/ic_launcher.png",
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

    apiBase: "https://api.shngm.io",

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/v1/manga/list?page=" + p + "&page_size=30&sort=popularity";
        return this.parseApiList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/v1/manga/list?page=" + p + "&page_size=30&sort=latest";
        return this.parseApiList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.apiBase + "/v1/manga/list?page=" + p + "&page_size=30&q=" + encodeURIComponent(query || "");
        return this.parseApiList(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        let p = page || 1;
        let sortParam = (sort === "latest") ? "latest" : "popularity";
        let url = this.apiBase + "/v1/manga/list?page=" + p + "&page_size=30&sort=" + sortParam;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2) url += "&status=completed";
        if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            url += "&type=" + encodeURIComponent(tStr.toLowerCase());
        }
        let gList = Array.isArray(genre) ? genre : (genre ? [genre] : []);
        for (let g of gList) {
            if (g && g !== "Semua") {
                url += "&genre=" + encodeURIComponent(g);
            }
        }
        return this.parseApiList(url, p);
    },

    parseApiList: function(url, page) {
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let json = JSON.parse(res.body);
        let items = [];
        let data = json.data || [];
        for (let obj of data) {
            let id = obj.manga_id || obj.mangaId || "";
            if (!id) continue;
            let thumb = obj.cover_portrait_url || obj.cover_image_url || obj.thumbnail || "";
            items.push({
                title: (obj.title || "").trim(),
                url: "/series/" + id,
                thumbnailUrl: thumb,
                status: obj.status === 1 ? 1 : (obj.status === 2 ? 2 : 0)
            });
        }
        let totalPages = 1;
        if (json.meta && json.meta.totalPage) totalPages = json.meta.totalPage;
        return { items: items, totalPages: totalPages };
    },

    getMangaDetails: function(url) {
        let mangaId = url.replace("/series/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/v1/manga/detail/" + mangaId;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let json = JSON.parse(res.body);
        let d = json.data || {};
        let author = "";
        let genreList = [];
        if (d.taxonomy) {
            if (d.taxonomy.Author && d.taxonomy.Author.length > 0) {
                author = d.taxonomy.Author.map(function(x) { return x.name; }).join(", ");
            }
            if (d.taxonomy.Genre) {
                for (let g of d.taxonomy.Genre) {
                    if (g.name && !genreList.includes(g.name)) genreList.push(g.name);
                }
            }
            if (d.taxonomy.Format) {
                for (let f of d.taxonomy.Format) {
                    if (f.name && !genreList.includes(f.name)) genreList.push(f.name);
                }
            }
        }

        let status = 0;
        if (d.status === 1) status = 1; // Ongoing
        else if (d.status === 2) status = 2; // Completed

        let desc = d.description || "";
        if (d.altTitle) desc += "\n\nAlternatif: " + d.altTitle;

        return {
            title: (d.title || "").trim(),
            url: url,
            thumbnailUrl: d.thumbnail || "",
            author: author,
            status: status,
            description: desc.trim(),
            genre: genreList
        };
    },

    getChapterList: function(url) {
        let mangaId = url.replace("/series/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/v1/chapter/" + mangaId + "/list?page_size=3000";
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        let json = JSON.parse(res.body);
        let list = json.data || json.chapterList || [];
        let chapters = [];
        for (let obj of list) {
            let chId = obj.chapterId || "";
            if (!chId) continue;
            let name = "Chapter " + (obj.name || "").toString().replace(/\.0$/, "");
            if (obj.title) name += " " + obj.title;
            chapters.push({
                name: name.trim(),
                url: "/chapter/" + chId,
                uploadDate: obj.date || ""
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let chId = url.replace("/chapter/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/v1/chapter/detail/" + chId;
        let res = this.requestUrl(apiUrl, { "Accept": "application/json" });
        if (!res || res.status !== 200 || !res.body) return [];

        let json = JSON.parse(res.body);
        let pages = [];
        let pl = (json.data && json.data.pageList) ? json.data.pageList : null;
        if (pl && pl.chapterPage && pl.chapterPage.pages) {
            let base = pl.baseUrl || "";
            let path = pl.chapterPage.path || "";
            for (let img of pl.chapterPage.pages) {
                pages.push(base + path + img);
            }
        }
        return pages;
    }
};
