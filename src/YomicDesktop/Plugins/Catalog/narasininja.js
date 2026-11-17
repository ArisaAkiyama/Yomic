/**
 * Yomic Extension: Narasi Ninja (narasininja)
 * Ported from Keiyoushi id extensions-source (src/id/narasininja)
 * Pure JavaScript compatible with Jint 4.5.0 + AngleSharp 1.10.1
 */

var source = {
    name: "Narasi Ninja",
    baseUrl: "https://narasininja.net",
    apiUrl: "https://narasininja.net",
    language: "id",
    version: "1.0.0",
    description: "Baca Komik Manga & Manhwa di Narasi Ninja",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/narasininja/res/mipmap-xxhdpi/ic_launcher.png",
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

    csrfToken: null,

    getCsrfToken: function() {
        if (this.csrfToken) return this.csrfToken;
        try {
            let res = this.requestUrl(this.baseUrl + "/komik");
            if (res && res.body) {
                let m = res.body.match(/name="csrf-token"\s+content="([^"]+)"/);
                if (m) {
                    this.csrfToken = m[1];
                    return this.csrfToken;
                }
            }
        } catch (e) {}
        return "";
    },

        fetchFilter: function(page, query, status, type, order) {
        let token = this.getCsrfToken();
        let reqHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "X-CSRF-TOKEN": token,
            "X-Requested-With": "XMLHttpRequest",
            "Referer": this.baseUrl + "/komik",
            "Content-Type": "application/x-www-form-urlencoded"
        };
        let p = page || 1;
        let statusStr = "";
        if (status === 1) statusStr = "ongoing";
        else if (status === 2) statusStr = "completed";
        
        let typeStr = "";
        if (type) {
            typeStr = Array.isArray(type) ? type[0].toLowerCase() : String(type).toLowerCase();
        }
        
        let orderStr = order || "";
        let body = "search=" + encodeURIComponent(query || "") + "&status=" + encodeURIComponent(statusStr) + "&type=" + encodeURIComponent(typeStr) + "&order=" + encodeURIComponent(orderStr);
        let res = fetch(this.baseUrl + "/komik/filter?page=" + p, {
            method: "POST",
            headers: reqHeaders,
            body: body
        });
        if (!res || res.status !== 200 || !res.body) return { items: [], totalPages: p };
        let json = JSON.parse(res.body);
        let list = json.data || [];
        let items = list.map(item => ({
            title: item.title,
            url: "/komik/" + item.slug,
            thumbnailUrl: this.baseUrl + "/storage/comic/image-bg/" + item.slug + ".jpg",
            status: 0
        }));
        let meta = json.meta || {};
        return { items: items, totalPages: (meta.current_page < meta.last_page) ? p + 1 : p };
    },

    

    getPopularManga: function(page) {
        return this.fetchFilter(page, "");
    },

    getLatestUpdates: function(page) {
        return this.fetchFilter(page, "");
    },

    getSearchManga: function(query, page) {
        return this.fetchFilter(page, query);
    },

    getMangaList: function(page, status, genre, type, sort) {
        let order = (sort === "latest") ? "update" : "popular";
        return this.fetchFilter(page, "", status, type, order);
    },

    

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) {
            return { title: "", url: url, thumbnailUrl: "", author: "", status: 0, description: "", genre: [] };
        }
        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("h1.entry-title");
        let thumbEl = doc.querySelector(".thumb img");
        let descEl = doc.querySelector(".entry-content.entry-content-single p");

        let author = "";
        let status = 0;
        let rows = doc.querySelectorAll(".infotable tr");
        for (let row of rows) {
            let txt = row.text().toLowerCase();
            let lastTd = row.querySelector("td:last-child");
            let val = lastTd ? lastTd.text().trim() : "";
            if (txt.includes("author") && val && val !== "-") author = val;
            if (txt.includes("status") && val) {
                let v = val.toLowerCase();
                if (v.includes("ongoing")) status = 1;
                else if (v.includes("completed") || v.includes("tamat")) status = 2;
            }
        }

        let genres = [];
        for (let a of doc.querySelectorAll(".seriestugenre a")) {
            let g = a.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: titleEl ? titleEl.text().trim() : "",
            url: url,
            thumbnailUrl: thumbEl ? thumbEl.absUrl("src") : "",
            author: author,
            status: status,
            description: descEl ? descEl.text().trim() : "",
            genre: genres
        };
    },

    getChapterList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let chEls = doc.querySelectorAll("#chapterlist li, .eplister li");
        let chs = [];

        for (let li of chEls) {
            let a = li.querySelector("a");
            if (!a) continue;
            let nameEl = li.querySelector(".chapternum");
            let name = nameEl ? nameEl.text().trim() : a.text().trim();
            let dateEl = li.querySelector(".chapterdate");
            let href = a.absUrl("href") || a.attr("href") || "";
            let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;

            chs.push({
                name: name,
                url: rel,
                uploadDate: dateEl ? dateEl.text().trim() : ""
            });
        }
        return chs;
    },

    getPageList: function(url) {
        let fullUrl = url.startsWith("http") ? url : this.baseUrl + url;
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];
        let doc = Html.parse(res.body, fullUrl);
        let imgs = doc.querySelectorAll("#readerarea img.ts-main-image, #readerarea img");
        let list = [];
        let seen = {};

        for (let img of imgs) {
            let src = img.absUrl("src") || img.absUrl("data-src") || img.attr("src") || "";
            if (src && !seen[src] && !src.includes("banner") && !src.includes("iklan")) {
                seen[src] = true;
                list.push(src);
            }
        }
        return list;
    }
};