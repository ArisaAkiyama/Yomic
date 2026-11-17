/**
 * Yomic Extension: Riztranslation (riztranslation)
 * Ported from Keiyoushi id extensions-source (src/id/riztranslation)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Riztranslation",
    baseUrl: "https://riztranslation.pages.dev",
    apiUrl: "https://uefnaojxivvxeamljskn.supabase.co/rest/v1",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga Terjemahan Riztranslation",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/riztranslation/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],

    apikey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZm5hb2p4aXZ2eGVhbWxqc2tuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc3MTU5MjksImV4cCI6MjA2MzI5MTkyOX0._lEBN5puTvATwtYodg4zbcoTwg0ss3j2BebD8WoHt9A",

    requestUrl: function(url, headers) {
        let reqHeaders = headers || {};
        if (!reqHeaders["User-Agent"]) {
            reqHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
        }
        if (!reqHeaders["apikey"]) {
            reqHeaders["apikey"] = this.apikey;
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
        let offset = (p - 1) * 20;
        let url = this.apiUrl + "/Book?select=id,judul,cover&type=not.ilike.*novel*&order=id.desc&offset=" + offset + "&limit=20";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let books = JSON.parse(res.body) || [];
        let items = books.map(b => ({
            title: b.judul,
            url: "/detail/" + b.id,
            thumbnailUrl: b.cover,
            status: 0
        }));
        return { items: items, totalPages: items.length === 20 ? p + 1 : p };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let offset = (p - 1) * 30;
        let url = this.apiUrl + "/Chapter?select=bookId,Book!inner(id,judul,cover)&Book.type=not.ilike.*novel*&order=created_at.desc&offset=" + offset + "&limit=30";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let chapters = JSON.parse(res.body) || [];
        let seen = {};
        let items = [];
        for (let ch of chapters) {
            if (!ch.Book || seen[ch.Book.id]) continue;
            seen[ch.Book.id] = true;
            items.push({
                title: ch.Book.judul,
                url: "/detail/" + ch.Book.id,
                thumbnailUrl: ch.Book.cover,
                status: 0
            });
        }
        return { items: items, totalPages: chapters.length === 30 ? p + 1 : p };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let offset = (p - 1) * 20;
        let url = this.apiUrl + "/Book?select=id,judul,cover&type=not.ilike.*novel*&judul=ilike.*" + encodeURIComponent(query || "") + "*&order=updated_at.desc&offset=" + offset + "&limit=20";
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };
        let books = JSON.parse(res.body) || [];
        let items = books.map(b => ({
            title: b.judul,
            url: "/detail/" + b.id,
            thumbnailUrl: b.cover,
            status: 0
        }));
        return { items: items, totalPages: items.length === 20 ? p + 1 : p };
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let bookId = url.replace("/detail/", "").replace("/view/", "").replace(/^\/+|\/+$/g, "");
        let bookUrl = this.apiUrl + "/Book?select=*%2Cgenres%3A_BookGenre%28genre%3AGenre%28*%29%29&type=not.ilike.*novel*&id=eq." + bookId;
        let res = this.requestUrl(bookUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let books = JSON.parse(res.body) || [];
        if (books.length === 0) return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        let b = books[0];

        let status = 0;
        let st = (b.status || "").toLowerCase();
        if (st === "ongoing") status = 1;
        else if (st.includes("complete")) status = 2;

        let genres = [];
        if (Array.isArray(b.genres)) {
            for (let item of b.genres) {
                if (item && item.genre && item.genre.nama) genres.push(item.genre.nama);
            }
        }

        return {
            title: b.judul || "",
            url: url,
            thumbnailUrl: b.cover || "",
            author: b.author || "",
            status: status,
            description: b.synopsis || "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let bookId = url.replace("/detail/", "").replace("/view/", "").replace(/^\/+|\/+$/g, "");
        let chUrl = this.apiUrl + "/Chapter?select=id,bookId,chapter,nama,created_at&bookId=eq." + bookId + "&order=chapter.desc";
        let res = this.requestUrl(chUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let chs = JSON.parse(res.body) || [];

        return chs.map(ch => ({
            name: ch.nama ? ch.nama : ("Chapter " + ch.chapter),
            url: "/view/" + ch.id,
            uploadDate: ch.created_at || ""
        }));
    },

    getPageList: function(url) {
        let chId = url.replace("/view/", "").replace(/^\/+|\/+$/g, "");
        let apiUrl = this.apiUrl + "/Chapter?select=id,bookId,isigambar&id=eq." + chId;
        let res = this.requestUrl(apiUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let chapters = JSON.parse(res.body) || [];
        if (chapters.length === 0 || !chapters[0].isigambar) return [];

        try {
            return JSON.parse(chapters[0].isigambar);
        } catch (e) {
            return [];
        }
    }
};