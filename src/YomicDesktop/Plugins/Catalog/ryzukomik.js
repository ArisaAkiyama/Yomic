var source = {
    name: "Ryzukomik",
    baseUrl: "https://baca.ryzukomik.space",
    iconUrl: "https://www.google.com/s2/favicons?domain=baca.ryzukomik.space&sz=128",
    apiUrl: "https://baca.ryzukomik.space",
    language: "id",
    version: "2.0.8",
    description: "Ryzukomik Indonesian manga extension (new domain)",
    author: "DesktopKomik",
    iconBackground: "#0a0a0a",
    iconForeground: "#ea580c",
    isNsfw: false,
    isHasMorePages: true,

    cleanTitle: function(title) {
        return title.replace(/^(?:-\s*|komik\s+)+/i, '').trim();
    },

    // -------------------------
    // POPULAR MANGA (ki-browse AJAX API)
    // API: GET /ki-browse?ajax=1&page={page}
    // Response: { st, pg: { pg, tt, nx, pr }, dt: [ { jd, sl, gm, tp, wr, rt } ] }
    // -------------------------
    getPopularManga: function(page) {
        return this.getMangaList(page, 0, null, null);
    },

    // -------------------------
    // LATEST UPDATES (ki-browse AJAX API)
    // -------------------------
    getLatestUpdates: function(page) {
        return this.getMangaList(page, 0, null, null);
    },

    // -------------------------
    // SEARCH
    // API: GET /ki-browse?ajax=1&s={query}&page={page}
    // -------------------------
    getSearchManga: function(query, page) {
        let currentPage = Math.max(1, page || 1);
        query = (query || "").trim();
        if (!query) return this.getMangaList(currentPage, 0, null, null);

        let url = this.apiUrl + "/ki-browse?ajax=1&s=" + encodeURIComponent(query) + "&page=" + currentPage;
        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: currentPage };

        let json = JSON.parse(response.body);
        return this.parseKiBrowseResponse(json, currentPage);
    },

    // -------------------------
    // MANGA LIST
    // API: GET /ki-browse?ajax=1&genre={genre}&page={page}
    // -------------------------
    getMangaList: function(page, status, genres, formats) {
        let currentPage = Math.max(1, page || 1);
        let url = this.apiUrl + "/ki-browse?ajax=1&page=" + currentPage;

        if (status === 1) {
            url += "&status=Ongoing";
        } else if (status === 2) {
            url += "&status=Completed";
        }

        if (genres) {
            let genreSlug = "";
            if (Array.isArray(genres) && genres.length > 0) {
                genreSlug = genres[0];
            } else if (typeof genres === 'string') {
                genreSlug = genres;
            }
            genreSlug = genreSlug.toLowerCase().trim().replace(/\s+/g, "-");
            if (genreSlug) {
                if (genreSlug === "gore" || genreSlug === "ecchi" || genreSlug === "sexual-violence") {
                    url += "&konten=" + encodeURIComponent(genreSlug);
                } else {
                    url += "&genre=" + encodeURIComponent(genreSlug);
                }
            }
        }

        if (formats && Array.isArray(formats) && formats.length > 0) {
            let targetType = formats[0];
            if (targetType) {
                url += "&type=" + encodeURIComponent(targetType);
            }
        }

        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: currentPage };

        let json = JSON.parse(response.body);
        return this.parseKiBrowseResponse(json, currentPage);
    },

    // Parse /ki-browse AJAX JSON response
    // dt item: { jd: title, sl: slug, gm: thumbnail, tp: type, wr: ongoing, rt: rating }
    parseKiBrowseResponse: function(json, currentPage) {
        let items = [];
        let dt = json.dt || [];
        let pg = json.pg || {};

        for (let item of dt) {
            let title = item.jd || "";
            let slug = item.sl || "";
            let thumbnailUrl = item.gm || "";
            if (!title || !slug) continue;

            items.push({
                title: title,
                url: "/komik/" + slug,
                thumbnailUrl: thumbnailUrl,
                _tp: item.tp || ""
            });
        }

        let totalPages = (pg.tt && pg.tt > 0) ? pg.tt : currentPage;
        if (pg.nx === true && totalPages <= currentPage) {
            totalPages = currentPage + 1;
        }

        return { items: items, totalPages: totalPages };
    },

    // -------------------------
    // MANGA DETAILS
    // URL: /komik/{slug}
    // Uses LD+JSON for description, meta for author/genre
    // -------------------------
    getMangaDetails: function(url) {
        let cleanUrl = url;
        if (cleanUrl.startsWith("/komi/")) {
            cleanUrl = cleanUrl.replace("/komi/", "/");
        }
        let fullUrl = this.baseUrl + cleanUrl;
        let response = fetch(fullUrl);
        if (response.status !== 200) return {};

        let html = response.body;

        // Title: h1
        let titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
        let title = titleMatch ? titleMatch[1].trim() : "";

        // Thumbnail: first jpg/png from komikindo or similar CDN
        let thumbMatch = html.match(/<img[^>]+src="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp)[^"]*)"[^>]*alt="[^"]*"/i);
        let thumbnailUrl = thumbMatch ? thumbMatch[1] : "";

        // Description from LD+JSON (most reliable)
        let description = "";
        let ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]+?)<\/script>/);
        if (ldJsonMatch) {
            try {
                let ldData = JSON.parse(ldJsonMatch[1]);
                if (ldData.description) description = ldData.description;
            } catch(e) {}
        }

        // Author from LD+JSON
        let author = "";
        if (ldJsonMatch) {
            try {
                let ldData = JSON.parse(ldJsonMatch[1]);
                if (ldData.author && ldData.author.name) author = ldData.author.name;
            } catch(e) {}
        }

        // Status: look for "Berjalan" or "Tamat" near the Status label
        let status = 0;
        let statusMatch = html.match(/Status<\/span>\s*<span[^>]*>([^<]+)<\/span>/i);
        if (statusMatch) {
            let statusStr = statusMatch[1].toLowerCase();
            if (statusStr.includes("berjalan") || statusStr.includes("ongoing")) {
                status = 1;
            } else if (statusStr.includes("tamat") || statusStr.includes("completed")) {
                status = 2;
            }
        }

        // Genres: /ki-browse?genre=... links
        let genres = [];
        let genreMatches = html.matchAll(/href="\/ki-browse\?genre=([^"]+)"[^>]*>([^<]+)<\/a>/g);
        for (let m of genreMatches) {
            genres.push(m[2].trim());
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

    // -------------------------
    // CHAPTER LIST
    // URL: /komik/{slug}  
    // Chapter links: a.chapter-item with href="/chapter/{slug-chapter-N}/"
    // -------------------------
    getChapterList: function(mangaUrl) {
        let cleanUrl = mangaUrl;
        if (cleanUrl.startsWith("/komi/")) {
            cleanUrl = cleanUrl.replace("/komi/", "/");
        }
        let fullUrl = this.baseUrl + cleanUrl;
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let html = response.body;

        // Chapter links: href="/chapter/..." class="chapter-item"
        let chapters = [];
        let chapterMatches = html.matchAll(/href="(\/chapter\/[^"]+)"[^>]*class="chapter-item[^"]*"[\s\S]*?ch-title[^>]*>([^<]+)<[\s\S]*?(?:ch-date[^>]*>([^<]+)<)?/g);

        for (let m of chapterMatches) {
            let chUrl = m[1];
            let chTitle = m[2].trim();
            let chDate = m[3] ? m[3].trim() : "";
            let dateUpload = chDate ? this.parseRelativeDate(chDate) : 0;

            chapters.push({
                name: chTitle,
                url: chUrl,
                dateUpload: dateUpload
            });
        }

        // Fallback: simple href + ch-title pattern
        if (chapters.length === 0) {
            let doc = Html.parse(html, fullUrl);
            let chapterListDiv = doc.querySelector("#chapterList");
            if (chapterListDiv) {
                let aTags = chapterListDiv.querySelectorAll("a.chapter-item");
                for (let a of aTags) {
                    let titleEl = a.querySelector(".ch-title");
                    let chTitle = titleEl ? titleEl.text().trim() : a.text().trim();
                    let relUrl = a.attr("href");

                    let dateUpload = 0;
                    let dateEl = a.querySelector(".ch-date");
                    if (dateEl) {
                        dateUpload = this.parseRelativeDate(dateEl.text().trim());
                    }

                    if (relUrl) {
                        chapters.push({
                            name: chTitle,
                            url: relUrl,
                            dateUpload: dateUpload
                        });
                    }
                }
            }
        }

        return chapters;
    },

    // -------------------------
    // PAGE LIST (images)
    // URL: /chapter/{chapter-slug}/
    // Images in JS variable: const originalImages = ["url1","url2",...]
    // -------------------------
    getPageList: function(chapterUrl) {
        // Ensure no double slash
        let chUrl = chapterUrl;
        if (chUrl.startsWith("/chapter/")) {
            chUrl = this.baseUrl + chUrl;
        } else if (!chUrl.startsWith("http")) {
            chUrl = this.baseUrl + "/" + chUrl;
        }

        let response = fetch(chUrl);
        if (response.status !== 200) return [];

        let pages = [];

        // Primary: originalImages variable
        let match = response.body.match(/(?:const|var|let)\s+originalImages\s*=\s*(\[[^\]]+\])/);
        if (match && match[1]) {
            try {
                let raw = match[1].replace(/\\\/\//g, "//").replace(/\\\//g, "/");
                pages = JSON.parse(raw);
            } catch(e) {}
        }

        // Fallback: DOM parsing
        if (pages.length === 0) {
            let doc = Html.parse(response.body, chUrl);
            let readerDiv = doc.querySelector("#reader-vertical") || doc.querySelector("#chap-img");
            if (readerDiv) {
                let imgEls = readerDiv.querySelectorAll("img");
                for (let img of imgEls) {
                    let src = img.absUrl("src") || img.attr("src");
                    if (src) pages.push(src);
                }
            }
        }

        return pages.map(function(p) { return p + "|Referer=none"; });
    },

    parseRelativeDate: function(text) {
        text = text.toLowerCase();
        let now = Date.now();
        let num = parseInt(text.replace(/[^0-9]/g, "")) || 0;
        if (num === 0) return now;

        if (text.includes("detik") || text.includes("sec")) {
            return now - (num * 1000);
        } else if (text.includes("menit") || text.includes("min")) {
            return now - (num * 60 * 1000);
        } else if (text.includes("jam") || text.includes("hour")) {
            return now - (num * 60 * 60 * 1000);
        } else if (text.includes("hari") || text.includes("day")) {
            return now - (num * 24 * 60 * 60 * 1000);
        } else if (text.includes("minggu") || text.includes("week")) {
            return now - (num * 7 * 24 * 60 * 60 * 1000);
        } else if (text.includes("bulan") || text.includes("month")) {
            return now - (num * 30 * 24 * 60 * 60 * 1000);
        }
        return now;
    },

    genres: [
        "4-Koma", "Action", "Adult", "Adventure", "Comedy", "Demons", "Drama", "Ecchi", 
        "Fantasy", "Game", "Gender Bender", "Gore", "Harem", "Historical", "Horror", 
        "Isekai", "Josei", "Loli", "Magic", "Martial Arts", "Mature", "Mecha", 
        "Military", "Music", "Mystery", "Psychological", "Romance", "School Life", 
        "Sci-Fi", "Seinen", "Shota", "Shoujo", "Shounen", "Slice of Life", "Sports", 
        "Super Power", "Supernatural", "Thriller", "Tragedy", "Vampire", "Yuri"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua"
    ]
};
