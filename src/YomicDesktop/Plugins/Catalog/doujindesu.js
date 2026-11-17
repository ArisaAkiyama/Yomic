/**
 * Yomic Extension: Doujindesu (doujindesu)
 * Ported from Keiyoushi id extensions-source (src/id/doujindesu)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Doujindesu",
    baseUrl: "https://doujin.desu.xxx",
    apiUrl: "https://doujin.desu.xxx",
    language: "id",
    version: "1.0.0",
    description: "Baca Manga & Doujinshi Hentai Terjemahan Bahasa Indonesia di Doujindesu",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/doujindesu/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: true,
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

    apiBase: "https://doujin.desu.xxx/api",
    appSecret: "dfdf72051dbfdc7d76889ebd31324e74",

    decrypt: function(encryptedHex) {
        if (!encryptedHex) return null;
        let salt = "doujindesu-scrapers-cannot-read-this-super-secret-salt-2026-v2";
        let t = Math.floor(Date.now() / 3600000);
        let timeSteps = [t, t - 1, t + 1];

        let HEX = {};
        for (let n = 0; n < 256; n++) {
            HEX[(n < 16 ? "0" : "") + n.toString(16)] = n;
        }

        let hexLen = encryptedHex.length;
        for (let s = 0; s < timeSteps.length; s++) {
            try {
                let text = salt + "_" + timeSteps[s];
                let a = 0;
                for (let i = 0; i < text.length; i++) {
                    a = ((a << 5) - a + text.charCodeAt(i)) | 0;
                }
                let l = a !== 0 ? Math.abs(a) : 123456789;
                let key = "";
                for (let i = 0; i < 32; i++) {
                    l = (l * 1664525 + 1013904223) % 4294967296;
                    key += String.fromCharCode(33 + (l % 93));
                }

                let d = 42;
                let keyLen = key.length;
                let decoded = [];
                for (let i = 0; i < hexLen; i += 2) {
                    let b = HEX[encryptedHex.substr(i, 2)];
                    let idx = i >> 1;
                    decoded.push(String.fromCharCode((b ^ key.charCodeAt(idx % keyLen) ^ (idx * 13) ^ d) & 0xFF));
                    d = (d + b) % 256;
                }
                let raw = decoded.join("");
                let res = decodeURIComponent(escape(raw));
                if (res && (res.charCodeAt(0) === 91 || res.charCodeAt(0) === 123)) {
                    return res;
                }
            } catch (e) {}
        }
        return null;
    },

    requestApi: function(url) {
        let headers = {
            "Accept": "application/json",
            "x-app-secret": this.appSecret
        };
        let res = this.requestUrl(url, headers);
        if (!res || res.status !== 200 || !res.body) return null;

        let body = res.body.trim();
        if (body.startsWith("{") && (body.includes('"_enc_resp_"') || body.includes('"encrypted"'))) {
            try {
                let enc = JSON.parse(body);
                let hex = enc._enc_resp_ || enc.encrypted;
                if (hex) {
                    let dec = this.decrypt(hex);
                    if (dec) return JSON.parse(dec);
                }
            } catch (e) {}
        }
        try {
            return JSON.parse(body);
        } catch (e) {
            return null;
        }
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let offset = (p - 1) * 5;
        let url = this.apiBase + "/manga?limit=5&offset=" + offset + "&sort=rating";
        return this.parseJsonList(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let offset = (p - 1) * 5;
        let url = this.apiBase + "/manga?limit=5&offset=" + offset + "&sort=latest_chapter";
        return this.parseJsonList(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let offset = (p - 1) * 5;
        let url = this.apiBase + "/manga?limit=5&offset=" + offset + "&search=" + encodeURIComponent(query || "");
        return this.parseJsonList(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseJsonList: function(url, page) {
        let json = this.requestApi(url);
        if (!json) return { items: [], totalPages: page || 1 };

        let list = Array.isArray(json) ? json : (json.data || json.mangaList || []);
        let items = [];

        for (let m of list) {
            let slug = m.slug || m.mangaSlug || "";
            if (!slug) continue;
            let title = m.title || m.name || slug;
            let thumb = m.cover_url || m.thumbnail || m.cover || m.thumb || "";
            if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + (thumb.startsWith("/") ? "" : "/") + thumb;

            items.push({
                title: title.trim(),
                url: "/manga/" + slug,
                thumbnailUrl: thumb,
                status: 0
            });
        }
        return { items: items, totalPages: (page || 1) + 1 };
    },

    getMangaDetails: function(url) {
        let slug = url.replace("/manga/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/manga/" + slug;
        let m = this.requestApi(apiUrl);
        if (!m) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let title = m.title || m.name || slug;
        let thumb = m.thumbnail || m.cover || "";
        if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + (thumb.startsWith("/") ? "" : "/") + thumb;

        let author = m.author || m.artist || "";
        let genres = m.genres || m.tags || [];
        if (Array.isArray(genres)) {
            genres = genres.map(function(g) { return typeof g === "object" ? (g.name || g.slug) : g; });
        } else {
            genres = [];
        }

        let status = 0;
        let s = (m.status || "").toLowerCase();
        if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
        else if (s.includes("completed") || s.includes("tamat")) status = 2;

        return {
            title: title.trim(),
            url: url,
            thumbnailUrl: thumb,
            author: author,
            status: status,
            description: (m.description || m.synopsis || "").trim(),
            genre: genres
        };
    },

    getChapterList: function(url) {
        let slug = url.replace("/manga/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/manga/" + slug;
        let m = this.requestApi(apiUrl);
        if (!m || !m.chapters) return [];

        let chapters = [];
        for (let ch of m.chapters) {
            let chId = ch.id || ch.chapterId || ch.slug || "";
            let name = ch.title || ch.name || ("Chapter " + (ch.chapterNumber || ""));
            chapters.push({
                name: name.trim(),
                url: "/reader/" + chId,
                uploadDate: ch.date || ""
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let chId = url.replace("/reader/", "").replace(/^\//, "").replace(/\/$/, "");
        let apiUrl = this.apiBase + "/chapters/" + chId;
        let json = this.requestApi(apiUrl);
        if (!json) return [];

        let pages = json.pages || json.images || [];
        let result = [];
        for (let p of pages) {
            let img = typeof p === "object" ? (p.url || p.src) : p;
            if (img) result.push(img);
        }
        return result;
    }
};
