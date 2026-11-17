var source = {
    name: "NgamenKomik",
    baseUrl: "https://ngamenkomik05.blogspot.com",
    apiUrl: "https://ngamenkomik05.blogspot.com",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/ngamenkomik/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "NgamenKomik Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#18181b",
    iconForeground: "#22c55e",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 14,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],
    mirrorUrls: [],
    chapterCategory: "Chapter",

    requestUrl: function(url, options) {
        let res = fetch(url, options || {});
        if ((!res || res.status !== 200) && this.mirrorUrls && this.mirrorUrls.length > 0) {
            for (let mirror of this.mirrorUrls) {
                let mirrorReq = url.replace(this.baseUrl, mirror);
                if (mirrorReq !== url) {
                    let altRes = fetch(mirrorReq, options || {});
                    if (altRes && altRes.status === 200) {
                        return altRes;
                    }
                }
            }
        }
        return res;
    },

    getJson: function(url) {
        let res = this.requestUrl(url);
        if (!res || res.status !== 200 || !res.body) return null;
        try {
            return JSON.parse(res.body);
        } catch (e) {
            return null;
        }
    },

    getPopularManga: function(page) {
        return this.getBloggerMangaPage(page, "Series", null, "published");
    },

    getLatestUpdates: function(page) {
        return this.getBloggerMangaPage(page, "Series", null, "updated");
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        return this.getBloggerMangaPage(page, "Series", query, null);
    },

    getBloggerMangaPage: function(page, label, query, orderby) {
        const appPageSize = this.pageSize || 14;
        let startIndex = (Math.max(1, page || 1) - 1) * appPageSize + 1;
        let url = `${this.apiUrl}/feeds/posts/default`;
        if (label) {
            url += `/-/${encodeURIComponent(label)}`;
        }
        url += `?alt=json&start-index=${startIndex}&max-results=${appPageSize}`;
        if (query) {
            url += `&q=${encodeURIComponent(query)}`;
        }
        if (orderby) {
            url += `&orderby=${encodeURIComponent(orderby)}`;
        }

        let json = this.getJson(url);
        if (!json || !json.feed) return { items: [], totalPages: page || 1 };

        let entries = json.feed.entry || [];
        let totalResults = (json.feed.openSearch$totalResults && json.feed.openSearch$totalResults.$t) ? parseInt(json.feed.openSearch$totalResults.$t) : 0;
        let totalPages = totalResults > 0 ? Math.ceil(totalResults / appPageSize) : (page + 1);

        let items = [];
        for (let entry of entries) {
            let title = (entry.title && entry.title.$t) ? entry.title.$t.trim() : "";
            let href = "";
            let links = entry.link || [];
            for (let link of links) {
                if (link.rel === "alternate") {
                    href = link.href;
                    break;
                }
            }

            let relativeUrl = href;
            if (href.startsWith(this.baseUrl)) {
                relativeUrl = href.substring(this.baseUrl.length);
            }

            let thumbnailUrl = "";
            if (entry.media$thumbnail && entry.media$thumbnail.url) {
                thumbnailUrl = entry.media$thumbnail.url;
                thumbnailUrl = thumbnailUrl.replace(/\/s[0-9]+(-c)?\//, "/w400/");
            }

            let status = 0;
            let categories = entry.category || [];
            for (let cat of categories) {
                let term = (cat.term || "").toLowerCase();
                if (term === "ongoing" || term === "on going") {
                    status = 1;
                    break;
                } else if (term === "completed" || term === "tamat" || term === "end") {
                    status = 2;
                    break;
                }
            }

            if (relativeUrl) {
                items.push({
                    title: title || "Manga",
                    url: relativeUrl,
                    thumbnailUrl: thumbnailUrl,
                    status: status
                });
            }
        }

        return {
            items: items,
            totalPages: Math.max(page || 1, totalPages)
        };
    },

    getMangaList: function(page, status, genre, type) {
        let label = "Series";
        if (status === 1) {
            label = "Ongoing";
        } else if (status === 2 || status === 4) {
            label = "Completed";
        }
        if (genre) {
            let g = Array.isArray(genre) ? genre[0] : genre;
            if (g) label = g;
        }
        return this.getBloggerMangaPage(page, label);
    },

    getMangaDetails: function(url) {
        let fullUrl = url.startsWith("http") ? url : (this.baseUrl + url);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return {};

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("article header h1, main h1, .post-title, header.entry-header h1, h1.title");
        let title = titleEl ? titleEl.text().trim() : "";

        let thumbnailEl = doc.querySelector(".grid figure img, .animefull img, .thumb img, aside figure img, article img");
        let thumbnailUrl = "";
        if (thumbnailEl) {
            thumbnailUrl = thumbnailEl.absUrl("src") || thumbnailEl.attr("src") || "";
            thumbnailUrl = thumbnailUrl.replace(/\/s[0-9]+(-c)?\//, "/w400/").replace(/=s[0-9]+[^/?]*/, "=s0");
        }

        let description = "";
        let synopsisEl = doc.querySelector("#synopsis, .synopsis, .wd-full p, .entry-content p, article p");
        if (synopsisEl) {
            description = synopsisEl.text().trim();
        }

        let author = "";
        let status = 0;

        let statusEl = doc.querySelector("span[data-status], span[data-bg], aside.s1 div.y6x11p a[data], span[data-perfect-post='status']");
        if (statusEl) {
            let s = statusEl.text().toLowerCase();
            if (s.includes("ongoing") || s.includes("on going")) status = 1;
            else if (s.includes("completed") || s.includes("tamat") || s.includes("end")) status = 2;
        }
        if (status === 0) {
            for (let el of doc.querySelectorAll(".imptdt")) {
                if (el.text().toLowerCase().includes("status")) {
                    let s = el.text().toLowerCase();
                    if (s.includes("ongoing") || s.includes("on going")) status = 1;
                    else if (s.includes("completed") || s.includes("tamat") || s.includes("end")) status = 2;
                    break;
                }
            }
        }

        let authorEl = doc.querySelector("span#author, span[data-perfect-post='author']");
        if (authorEl) {
            author = authorEl.text().trim();
        } else {
            for (let el of doc.querySelectorAll("dl, .extra-info .y6x11p")) {
                let txt = el.text().toLowerCase();
                if (txt.includes("author") || txt.includes("pengarang")) {
                    let dd = el.querySelector("dd, span.dt");
                    if (dd) { author = dd.text().trim(); break; }
                }
            }
        }

        let genres = [];
        let genreEls = doc.querySelectorAll("a[rel=tag], .mt-15 a.label, .mgen a, aside dl a[rel=tag]");
        for (let el of genreEls) {
            let g = el.text().trim();
            if (g && !genres.includes(g)) genres.push(g);
        }

        return {
            title: title,
            url: url,
            thumbnailUrl: thumbnailUrl,
            author: author,
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(mangaUrl) {
        let fullUrl = mangaUrl.startsWith("http") ? mangaUrl : (this.baseUrl + mangaUrl);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let doc = Html.parse(res.body, fullUrl);
        let titleEl = doc.querySelector("article header h1, main h1, .post-title, header.entry-header h1, h1.title");
        let title = titleEl ? titleEl.text().trim() : "";

        // Detect chapter feed label
        let label = title;
        let match = res.body.match(/clwd\.run\(['"]([^'"]+)['"]\)/);
        if (match && match[1]) {
            label = match[1].trim();
        } else {
            let labelMatch = res.body.match(/label\s*=\s*['"]([^'"]+)['"]/);
            if (labelMatch && labelMatch[1]) {
                label = labelMatch[1].trim();
            }
        }

        // Also check if doc has direct chapter list element (e.g. Tooncubus ul.series-chapterlist)
        let directChapters = doc.querySelectorAll("ul.series-chapterlist div.flexch-infoz, ul.clstyle li");
        if (directChapters && directChapters.length > 0) {
            let chapters = [];
            for (let el of directChapters) {
                let a = el.querySelector("a");
                let span = el.querySelector("span, .chapternum");
                if (a) {
                    let href = a.absUrl("href") || a.attr("href");
                    let name = span ? span.text().trim() : (a.text().trim() || "Chapter");
                    let rel = href.startsWith(this.baseUrl) ? href.substring(this.baseUrl.length) : href;
                    chapters.push({
                        name: name,
                        url: rel,
                        dateUpload: 0
                    });
                }
            }
            if (chapters.length > 0) return chapters;
        }

        if (!label) return [];

        let feedUrl = `${this.apiUrl}/feeds/posts/default/-/${encodeURIComponent(label)}?alt=json&max-results=500`;
        let json = this.getJson(feedUrl);
        if (!json || !json.feed) return [];

        let entries = json.feed.entry || [];
        let chapters = [];
        let chCat = this.chapterCategory || "Chapter";

        for (let entry of entries) {
            let categories = entry.category || [];
            let isChapter = false;
            for (let cat of categories) {
                if (cat.term === chCat || cat.term === "Chapter" || (cat.term && cat.term.toLowerCase().includes("chapter"))) {
                    isChapter = true;
                    break;
                }
            }
            if (!isChapter) continue;

            let titleSub = (entry.title && entry.title.$t) ? entry.title.$t.trim() : "";
            let href = "";
            let links = entry.link || [];
            for (let link of links) {
                if (link.rel === "alternate") {
                    href = link.href;
                    break;
                }
            }

            let relativeUrl = href;
            if (href.startsWith(this.baseUrl)) {
                relativeUrl = href.substring(this.baseUrl.length);
            }

            let dateUpload = 0;
            if (entry.published && entry.published.$t) {
                dateUpload = new Date(entry.published.$t).getTime();
            }

            if (relativeUrl) {
                chapters.push({
                    name: titleSub || "Chapter",
                    url: relativeUrl,
                    dateUpload: dateUpload
                });
            }
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let fullUrl = chapterUrl.startsWith("http") ? chapterUrl : (this.baseUrl + chapterUrl);
        let res = this.requestUrl(fullUrl);
        if (!res || res.status !== 200 || !res.body) return [];

        let pages = [];

        // 1. Check raw textarea if present (Inazumanga / ReYume)
        if (false || res.body.includes("id=\"zeist-raw-data\"")) {
            let m = res.body.match(/<textarea[^>]*id=["']zeist-raw-data["'][^>]*>([\s\S]*?)<\/textarea>/i);
            if (m && m[1]) {
                let subDoc = Html.parse(m[1], fullUrl);
                let imgs = subDoc.querySelectorAll("img[src], img[data-src]");
                for (let img of imgs) {
                    let src = img.absUrl("src") || img.attr("src") || img.attr("data-src");
                    if (src) pages.push(src);
                }
                if (pages.length > 0) return this.cleanPageUrls(pages);
            }
        }

        // 2. Check script containing chapterImage config (UlasComic)
        if (false || res.body.includes("chapterImage")) {
            let imgMatches = res.body.match(/"(https?:\/\/[^"']+\.(?:jpe?g|png|webp)[^"']*)"/gi);
            if (imgMatches && imgMatches.length > 0) {
                for (let match of imgMatches) {
                    let clean = match.replace(/^"|"$/g, '').replace(/\\\//g, '/');
                    if (!clean.includes("favicon") && !clean.includes("logo") && !clean.includes("avatar")) {
                        pages.push(clean);
                    }
                }
                if (pages.length > 0) return this.cleanPageUrls(pages);
            }
        }

        // 3. Standard DOM parsing
        let doc = Html.parse(res.body, fullUrl);
        let imgEls = doc.querySelectorAll("div.check-box div.separator img, div.check-box center img, #reader img, .reader img, #post-body div.separator img, .post-body div.separator img, div.separator img, div.separator a[href*='googleusercontent.com'], div.separator a[href*='bp.blogspot.com']");

        for (let img of imgEls) {
            let src = img.absUrl("src") || img.attr("src") || img.attr("data-src") || img.absUrl("href") || img.attr("href");
            if (src && !src.includes("histats.com") && !src.includes("ads") && !src.includes("pixel.wp.com")) {
                pages.push(src);
            }
        }

        return this.cleanPageUrls(pages);
    },

    cleanPageUrls: function(pages) {
        let results = [];
        for (let p of pages) {
            let clean = p.replace(/\/[swh]\d+[\w-]*\/([^/]+)$/, "/s0/$1")
                         .replace(/=[swh]\d+[^/?]*($|\?)/i, "=s0$1")
                         .replace(/\/[swh]\d+[^/]*\//i, "/s0/");
            if (!results.includes(clean)) results.push(clean);
        }
        return results;
    }
};
