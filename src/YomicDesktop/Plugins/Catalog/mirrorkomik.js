/**
 * Yomic Extension: MirrorKomik (mirrorkomik)
 * Ported from Keiyoushi id extensions-source (src/id/mirrorkomik)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "MirrorKomik",
    baseUrl: "https://mirrorkomik.info",
    apiUrl: "https://mirrorkomik.info",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga, Manhwa, Manhua Subtitle Indonesia di MirrorKomik",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/mirrorkomik/res/mipmap-xxhdpi/ic_launcher.png",
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
        let url = this.baseUrl + "/loadmore-type?type=Komik&page=" + p;
        return this.parseLoadMore(url, p);
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = this.baseUrl + "/loadmore-type?type=Komik&page=" + p;
        return this.parseLoadMore(url, p);
    },

    getSearchManga: function(query, page) {
        let p = page || 1;
        let url = this.baseUrl + "/loadmore-search?keyword=" + encodeURIComponent(query || "");
        return this.parseLoadMore(url, p);
    },

        getMangaList: function(page, status, genre, type, sort) {
        if (sort === "latest") {
            return this.getLatestUpdates(page);
        }
        return this.getPopularManga(page);
    },

    parseLoadMore: function(url, page) {
        let res = this.requestUrl(url, { "X-Requested-With": "XMLHttpRequest" });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: page || 1 };

        let html = res.body;
        try {
            let json = JSON.parse(res.body);
            if (json.html) html = json.html;
        } catch (e) {}

        let doc = Html.parse(html, this.baseUrl);
        let cards = doc.querySelectorAll("a.komik-card, .bsx > a, article a");
        let items = [];
        let seen = {};

        for (let c of cards) {
            let href = c.absUrl("href") || c.attr("href") || "";
            if (!href || seen[href]) continue;
            seen[href] = true;

            let tEl = c.querySelector("h3, .tt, .title");
            let title = tEl ? tEl.text().trim() : c.text().trim();
            let img = c.querySelector("img");
            let thumb = img ? (img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "") : "";

            let rel = href;
            if (href.startsWith(this.baseUrl)) rel = href.substring(this.baseUrl.length);

            items.push({ title: title, url: rel, thumbnailUrl: thumb, status: 0 });
        }
        return { items: items, totalPages: (page || 1) + 1 };
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.entry-title, h1");
        let title = titleEl ? titleEl.text().replace(/\s*Bahasa Indonesia$/i, "").trim() : "";

        let img = doc.querySelector(".thumb img, .series-thumb img");
        let thumb = img ? (img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "") : "";

        let descEl = doc.querySelector(".entry-content[itemprop=description], .entry-content p, .desc p");
        let description = descEl ? descEl.text().trim() : "";

        let author = "";
        for (let fmed of doc.querySelectorAll(".fmed, .infox .spe span")) {
            let txt = fmed.text().toLowerCase();
            if (txt.includes("author") || txt.includes("pengarang")) {
                let sp = fmed.querySelector("span");
                author = sp ? sp.text().trim() : fmed.text().replace(/^[^:]+:/, "").trim();
            }
        }

        let status = 0;
        let sEl = doc.querySelector(".tsinfo .imptdt, .status");
        if (sEl) {
            let s = sEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("berjalan")) status = 1;
            else if (s.includes("completed") || s.includes("tamat")) status = 2;
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".mgen a, .genres a")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
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
        let list = doc.querySelectorAll("#chapterlist li, .chapter-list li");
        let chapters = [];

        for (let li of list) {
            let a = li.querySelector("a");
            if (!a) continue;
            let href = a.absUrl("href") || a.attr("href") || "";
            let nameEl = li.querySelector(".chapternum") || a;
            let name = nameEl.text().trim();
            if (!href || !name) continue;

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

        let doc = Html.parse(res.body, fullUrl);
        let thisch = doc.querySelector("#thisch");
        if (thisch && thisch.attr("data-token")) {
            let token = thisch.attr("data-token");
            let tokenUrl = this.baseUrl + "/chapter/listchap," + token;
            let tokenRes = this.requestUrl(tokenUrl, { "X-Requested-With": "XMLHttpRequest", "Referer": fullUrl });
            if (tokenRes && tokenRes.status === 200 && tokenRes.body) {
                try {
                    let imgs = JSON.parse(tokenRes.body);
                    let pages = [];
                    for (let img of imgs) {
                        if (img.includes("/public/img/") && !img.includes("/public/img/Users/")) continue;
                        if (img.includes("/media/")) img = "https://i0.wp.com/" + img.replace(/^https?:\/\//, "");
                        pages.push(img);
                    }
                    if (pages.length > 0) return pages;
                } catch (e) {}
            }
        }

        let pages = [];
        for (let img of doc.querySelectorAll("#readerarea img, .reading-content img")) {
            let src = img.absUrl("data-src") || img.absUrl("src") || img.attr("src") || "";
            if (src && !pages.includes(src)) pages.push(src);
        }
        return pages;
    }
};
