/**
 * Yomic Extension: Ryukomik (ryukomik)
 * Ported from Keiyoushi id extensions-source (src/id/ryukomik)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Ryukomik",
    baseUrl: "https://ryukomik.my.id",
    apiUrl: "https://ryukomik.my.id",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Online Bahasa Indonesia Gratis di Ryukomik",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/ryukomik/res/mipmap-xxhdpi/ic_launcher.png",
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

    apiBase: "https://api.ryukomik.web.id",

    getPopularManga: function(page) {
        let p = page || 1;
        let url = this.apiBase + "/komiku/list?page=" + p;
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (res && res.status === 200 && res.body) {
            try {
                let json = JSON.parse(res.body);
                let items = [];
                for (let d of (json.data || [])) {
                    let link = d.link || d.url || "";
                    let slug = link ? link.replace(/\/$/, "").split("/").pop() : (d.slug || d.endpoint || "");
                    if (!slug) continue;
                    let thumb = d.image || d.thumb || "";
                    if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + "/" + thumb.replace(/^\//, "");
                    items.push({
                        title: (d.title || slug).trim(),
                        url: "/komik/komiku/" + slug,
                        thumbnailUrl: thumb,
                        status: 0
                    });
                }
                let totalPages = p;
                if (json.meta && json.meta.totalPages) totalPages = json.meta.totalPages;
                return { items: items, totalPages: totalPages };
            } catch (e) {}
        }
        return this.getLatestUpdates(page);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl;
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: 1 };

        let doc = Html.parse(res.body, url);
        let cards = doc.querySelectorAll("a.rk-cover-card[href*='/komik/'], a[href*='/komik/']");
        let items = [];
        let seen = {};

        for (let c of cards) {
            let href = c.absUrl("href") || c.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let img = c.querySelector("img");
            let title = img ? (img.attr("alt") || "") : "";
            if (!title) {
                let pEl = c.querySelector("p");
                if (pEl) title = pEl.text().trim();
            }
            if (!title) continue;

            let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";
            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }
        return { items: items, totalPages: 1 };
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.apiBase + "/komiku/search?q=" + encodeURIComponent(query || "");
        let res = this.requestUrl(url, { "Accept": "application/json" });
        if (res && res.status === 200 && res.body) {
            try {
                let json = JSON.parse(res.body);
                let items = [];
                for (let d of (json.data || [])) {
                    let link = d.link || d.url || "";
                    let slug = link ? link.replace(/\/$/, "").split("/").pop() : (d.slug || d.endpoint || "");
                    if (!slug) continue;
                    let thumb = d.image || d.thumb || "";
                    if (thumb && !thumb.startsWith("http")) thumb = this.baseUrl + "/" + thumb.replace(/^\//, "");
                    items.push({
                        title: (d.title || slug).trim(),
                        url: "/komik/komiku/" + slug,
                        thumbnailUrl: thumb,
                        status: 0
                    });
                }
                return { items: items, totalPages: 1 };
            } catch (e) {}
        }
        return { items: [], totalPages: 1 };
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
        let titleEl = doc.querySelector("h1");
        let title = titleEl ? titleEl.text().trim() : "";

        let img = doc.querySelector("div.rk-shell img[alt=Poster], div.rk-shell div.flex-shrink-0 img, img");
        let thumb = img ? (img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector("p.text-sm.leading-relaxed, div.rk-shell p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        let authorEl = doc.querySelector("div.rk-shell span.truncate");
        if (authorEl && authorEl.text().trim() !== "-") author = authorEl.text().trim();

        let genres = [];
        for (let a of doc.querySelectorAll("a[href*='/genre/'], span.rk-chip")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        let status = 0;
        let sEl = doc.querySelector("div.rk-shell div.flex.gap-3 span:last-child");
        if (sEl) {
            let s = sEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumb,
            author: author,
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let links = doc.querySelectorAll("a[href*='/chapter/']");
        let chapters = [];
        let seen = {};

        for (let a of links) {
            let href = a.absUrl("href") || a.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let nameEl = a.querySelector("span.font-medium, span") || a;
            let name = nameEl.text().trim();

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            chapters.push({
                name: name,
                url: rel,
                uploadDate: ""
            });
        }
        return chapters;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let body = res.body;
        let match = body.match(/\bimages\b\s*:\s*(\[[^\]]+\])/i) || body.match(/"images"\s*:\s*(\[[^\]]+\])/i);
        if (match) {
            try {
                let list = JSON.parse(match[1]);
                let pages = [];
                for (let img of list) {
                    if (img.startsWith("http")) pages.push(img);
                    else pages.push(this.baseUrl + "/" + img.replace(/^\//, ""));
                }
                if (pages.length > 0) return pages;
            } catch (e) {}
        }

        let doc = Html.parse(body, fullUrl);
        let pages = [];
        for (let img of doc.querySelectorAll("img[src*='/chapter/'], #reader img, .chapter-img")) {
            let src = img.absUrl("src") || img.attr("src") || "";
            if (src && !pages.includes(src)) pages.push(src);
        }
        return pages;
    }
};
