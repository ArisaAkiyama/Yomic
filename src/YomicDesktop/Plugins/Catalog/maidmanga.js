var source = {
    name: "MaidManga",
    baseUrl: "https://www.maid.my.id",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/maidmanga/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.5",
    description: "MaidManga Indonesian extension implemented in JavaScript using ZManga/WordPress pages",
    author: "DesktopKomik",
    iconBackground: "#1f2937",
    iconForeground: "#60a5fa",
    isNsfw: false,
    isHasMorePages: true,

    getPopularManga: function(page) {
        return this.getAdvancedSearchPage(page, { order: "popular" }, 0);
    },

    getLatestUpdates: function(page) {
        page = Math.max(1, page || 1);
        return this.getMangaPage(page === 1 ? "/" : "/page/" + page + "/", page, 0);
    },

    getSearchManga: function(query, page) {
        page = Math.max(1, page || 1);
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);

        let path = page === 1
            ? "/?s=" + encodeURIComponent(query)
            : "/page/" + page + "/?s=" + encodeURIComponent(query);
        return this.getMangaPage(path, page, 0);
    },

    getMangaList: function(page, status, genre, type) {
        let params = { order: "popular" };
        let forcedStatus = 0;

        // 1. Status Filter
        if (status === 1) {
            params.status = "ongoing";
            forcedStatus = 1;
        } else if (status === 2) {
            params.status = "completed";
            forcedStatus = 2;
        }

        // 2. Genre Filter
        if (genre) {
            let arr = [];
            if (Array.isArray(genre)) {
                arr = genre;
            } else if (genre.length !== undefined && typeof genre !== 'string') {
                for (let i = 0; i < genre.length; i++) {
                    arr.push(genre[i]);
                }
            } else {
                arr = [genre];
            }
            
            let genreSlugs = [];
            for (let i = 0; i < arr.length; i++) {
                let name = arr[i].toLowerCase().trim().replace(/\s+/g, "-");
                if (name) genreSlugs.push(name);
            }
            if (genreSlugs.length > 0) {
                params["genre[]"] = genreSlugs;
            }
        }

        // 3. Format/Type Filter
        if (type) {
            let arr = [];
            if (Array.isArray(type)) {
                arr = type;
            } else if (type.length !== undefined && typeof type !== 'string') {
                for (let i = 0; i < type.length; i++) {
                    arr.push(type[i]);
                }
            } else {
                arr = [type];
            }

            // MaidManga accepts Manga, Manhwa, Manhua, One-shot, Doujin as type
            if (arr.length > 0) {
                params.type = arr[0];
            }
        }

        return this.getAdvancedSearchPage(page, params, forcedStatus);
    },

    getAdvancedSearchPage: function(page, params, forcedStatus) {
        page = Math.max(1, page || 1);
        let query = this.toQuery(params || {});
        let path = page === 1
            ? "/advanced-search/" + query
            : "/advanced-search/page/" + page + "/" + query;
        return this.getMangaPage(path, page, forcedStatus || 0);
    },

    getMangaPage: function(path, currentPage, forcedStatus) {
        let url = this.absoluteUrl(path);
        let html = this.getHtml(url);
        if (!html || this.isBlockedHtml(html)) return { items: [], totalPages: 1 };

        let document = Html.parse(html, url);
        let items = this.parseCards(document, forcedStatus || 0);
        return {
            items: items,
            totalPages: this.extractTotalPages(document, html, currentPage || 1)
        };
    },

    getMangaDetails: function(url) {
        let absUrl = this.absoluteUrl(url);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return {};

        let document = Html.parse(html, absUrl);
        let infoHtml = this.outerHtmlOf(document, ".series-info, .series-infoz, .series-infobox");
        let title = this.textOf(document, ".series-titlex h2, .series-title h2, h1, h2")
            || this.extractMetaContent(html, "og:title").replace(/\s+Bahasa\s+Indonesia.*$/i, "")
            || this.titleFromUrl(absUrl);
        let thumbnailUrl = this.attrAbsOf(document, ".series-thumb img, .series-cover img, img.wp-post-image", "data-lazy-src")
            || this.attrAbsOf(document, ".series-thumb img, .series-cover img, img.wp-post-image", "data-src")
            || this.attrAbsOf(document, ".series-thumb img, .series-cover img, img.wp-post-image", "src")
            || this.extractMetaContent(html, "og:image");
        let status = this.mapStatus(
            this.textOf(document, ".series-infoz.block .status, .series-infoz .status, .status") ||
            this.extractDetailStatus(html) ||
            this.extractMetaContent(html, "description") ||
            this.extractInfoValue(infoHtml, "Status")
        );
        let author = this.extractInfoValue(infoHtml, "Author") || this.extractRawInfoValue(html, "Author");
        let genre = this.extractGenreLinks(document);
        let description = this.textOf(document, ".series-synops, .series-synopsis, .entry-content")
            || this.extractSynopsisFromHtml(html)
            || this.extractMetaContent(html, "description");
        let published = this.extractInfoValue(infoHtml, "Published") || this.extractRawInfoValue(html, "Published");
        let totalChapter = this.extractInfoValue(infoHtml, "Total Chapter") || this.extractRawInfoValue(html, "Total Chapter");

        if (published) description = this.appendLine(description, "Published: " + published);
        if (totalChapter) description = this.appendLine(description, "Total Chapter: " + totalChapter);

        return {
            title: title,
            url: this.relativeUrl(absUrl),
            thumbnailUrl: thumbnailUrl,
            author: author,
            status: status,
            description: description,
            genre: genre,
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        let absUrl = this.absoluteUrl(mangaUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];

        let regexChapters = this.extractChaptersFromHtml(html);
        if (regexChapters.length > 0) return regexChapters;

        let document = Html.parse(html, absUrl);
        let links = document.querySelectorAll(".series-chapterlist a[href], ul.series-chapterlist a[href], .chapters a[href]");
        let chapters = [];
        let seen = {};

        for (let i = 0; i < links.length; i++) {
            let link = links[i];
            let href = link.absUrl("href");
            if (!href || seen[href]) continue;
            seen[href] = true;

            let rawText = this.cleanText(link.text());
            let dateText = this.cleanText(this.textOf(link, ".date, time"));
            let name = rawText;
            if (dateText) name = this.cleanText(name.replace(dateText, ""));
            if (!name) name = this.cleanText(link.attr("title")) || this.titleFromUrl(href);

            chapters.push({
                name: name,
                url: this.relativeUrl(href),
                dateUpload: this.parseDate(dateText)
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let absUrl = this.absoluteUrl(chapterUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];

        let document = Html.parse(html, absUrl);
        let root = document.querySelector(".entry-content, .post-content, .reader-area, article, main") || document;
        let images = root.querySelectorAll("img");
        let pages = [];
        let seen = {};

        for (let i = 0; i < images.length; i++) {
            let img = images[i];
            let src = img.absUrl("data-src") || img.absUrl("data-lazy-src") || img.absUrl("src");
            if (!this.isReaderImage(src, img)) continue;
            if (seen[src]) continue;
            seen[src] = true;
            pages.push(src + "|Referer=" + this.baseUrl + "/&Origin=" + this.baseUrl);
        }

        if (pages.length === 0) {
            pages = this.extractReaderImagesFromHtml(html);
        }

        return pages;
    },

    parseCards: function(document, forcedStatus) {
        let cards = document.querySelectorAll(".flexbox2-item, .flexbox3-item, .flexbox4-item, .searchbox, article");
        let items = [];
        let seen = {};

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let link = card.querySelector("a[href*='/manga/']");
            if (!link) continue;

            let href = link.absUrl("href");
            if (!href || seen[href]) continue;
            seen[href] = true;

            let img = card.querySelector("img");
            let title = this.textOf(card, ".flexbox2-title .title, .flexbox3-title .title, .flexbox4-title .title, .searchbox-title, .title a, h2 a, h3 a")
                || this.cleanText(link.attr("title"))
                || (img ? this.cleanText(img.attr("alt")) : "")
                || this.titleFromUrl(href);
            let thumb = img ? (img.absUrl("data-src") || img.absUrl("data-lazy-src") || img.absUrl("src")) : "";
            let status = forcedStatus || this.extractCardStatus(card);

            items.push({
                title: title,
                url: this.relativeUrl(href),
                thumbnailUrl: thumb,
                author: this.textOf(card, ".studio"),
                status: status,
                description: this.textOf(card, ".synops"),
                genre: this.extractCardGenres(card),
                source: this.id
            });
        }

        return items;
    },

    extractCardStatus: function(card) {
        let statusText = this.textOf(card, ".status");
        if (!statusText) {
            let season = this.textOf(card, ".season");
            if (/\bend\b|\bcomplete\b|\bcompleted\b/i.test(season)) return 2;
        }
        return this.mapStatus(statusText);
    },

    extractCardGenres: function(card) {
        let links = card.querySelectorAll(".genres a");
        let genres = [];
        for (let i = 0; i < links.length; i++) {
            let value = this.cleanText(links[i].text());
            if (value) genres.push(value);
        }
        return genres;
    },

    extractGenreLinks: function(document) {
        let links = document.querySelectorAll(".series-genres a, .genres a");
        let genres = [];
        let seen = {};
        for (let i = 0; i < links.length; i++) {
            let value = this.cleanText(links[i].text());
            if (!value || seen[value]) continue;
            seen[value] = true;
            genres.push(value);
        }
        return genres;
    },

    extractChaptersFromHtml: function(html) {
        html = html || "";
        let block = this.matchFirst(html, /<ul[^>]+class=["'][^"']*series-chapterlist[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i);
        if (!block) block = html;

        let chapters = [];
        let seen = {};
        let re = /<a\b([^>]*href=["'][^"']*(?:-chapter-|chapter-)[^"']*["'][^>]*)>([\s\S]{0,800}?)<\/a>/gi;
        let match;
        while ((match = re.exec(block)) !== null) {
            let attrs = match[1] || "";
            let inner = match[2] || "";
            let href = this.htmlDecode(this.matchFirst(attrs, /href=["']([^"']+)["']/i));
            if (!this.isChapterUrl(href) || seen[href]) continue;
            seen[href] = true;

            let title = this.htmlDecode(this.matchFirst(attrs, /title=["']([^"']*)["']/i));
            let dateText = this.stripHtml(this.matchFirst(inner, /<span[^>]+class=["'][^"']*date[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
            let name = this.stripHtml(inner.replace(/<span[^>]+class=["'][^"']*date[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, " "));
            if (!/^chapter\b/i.test(name)) {
                let nameMatch = this.matchFirst(inner, /Chapter\s*[^<]+/i);
                name = this.cleanText(nameMatch);
            }
            if (!name) {
                name = this.cleanChapterTitle(title);
            }
            if (!name) {
                name = this.chapterTitleFromUrl(href);
            }

            chapters.push({
                name: name,
                url: this.relativeUrl(href),
                dateUpload: this.parseDate(dateText)
            });
        }

        return chapters;
    },

    isChapterUrl: function(url) {
        return /^https?:\/\/www\.maid\.my\.id\/[^?#]+(?:-chapter-|chapter-)[^?#]*\/?$/i.test(url || "");
    },

    extractDetailStatus: function(html) {
        return this.stripHtml(this.matchFirst(html, /<span[^>]+class=["'][^"']*\bstatus\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
    },

    extractMetaContent: function(html, key) {
        let escaped = this.escapeRegex(key);
        let re = new RegExp("<meta\\b(?=[^>]*(?:property|name)=[\"']" + escaped + "[\"'])[^>]*content=[\"']([^\"']*)[\"'][^>]*>", "i");
        return this.cleanText(this.htmlDecode(this.matchFirst(html || "", re)));
    },

    extractRawInfoValue: function(html, key) {
        let escaped = this.escapeRegex(key);
        let re = new RegExp("<li[^>]*>\\s*<b[^>]*>\\s*" + escaped + "\\s*<\\/b>\\s*<span[^>]*>([\\s\\S]*?)<\\/span>\\s*<\\/li>", "i");
        return this.stripHtml(this.matchFirst(html || "", re));
    },

    extractSynopsisFromHtml: function(html) {
        return this.stripHtml(this.matchFirst(html || "", /<div[^>]+class=["'][^"']*series-synops[^"']*["'][^>]*>([\s\S]*?)<\/div>/i));
    },

    extractTotalPages: function(document, html, currentPage) {
        let total = Math.max(1, currentPage || 1);
        let links = document.querySelectorAll(".pagination a.page-numbers, .pagination .page-numbers");
        for (let i = 0; i < links.length; i++) {
            let textNumber = parseInt(this.cleanText(links[i].text()), 10);
            if (!isNaN(textNumber) && textNumber > total) total = textNumber;

            let href = links[i].attr("href") || "";
            let pageMatch = href.match(/\/page\/(\d+)\//i);
            if (pageMatch) total = Math.max(total, parseInt(pageMatch[1], 10));
        }

        let re = /\/page\/(\d+)\//gi;
        let match;
        while ((match = re.exec(html || "")) !== null) {
            total = Math.max(total, parseInt(match[1], 10));
        }

        return Math.max(1, total);
    },

    extractReaderImagesFromHtml: function(html) {
        let pages = [];
        let seen = {};
        let re = /<img\b[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["'][^>]*>/gi;
        let match;
        while ((match = re.exec(html || "")) !== null) {
            let src = this.htmlDecode(match[1]);
            if (!this.isReaderImageUrl(src) || seen[src]) continue;
            seen[src] = true;
            pages.push(src + "|Referer=" + this.baseUrl + "/&Origin=" + this.baseUrl);
        }
        return pages;
    },

    isReaderImage: function(src, img) {
        if (!this.isReaderImageUrl(src)) return false;
        let text = ((img.attr("alt") || "") + " " + (img.attr("title") || "") + " " + (img.attr("class") || "")).toLowerCase();
        return !/(avatar|logo|maid|discord|donasi|trakteer|histats|counter|bookmark)/i.test(text);
    },

    isReaderImageUrl: function(src) {
        if (!src) return false;
        if (!/^https?:\/\//i.test(src)) return false;
        if (/(avatar|gravatar|logo|cropped-logo|discord|donasi|trakteer|histats|counter|banner|wp-content\/themes|wp-content\/plugins)/i.test(src)) return false;
        return /(imgbox\.com|\/wp-content\/uploads\/|blogspot\.com|blogger\.googleusercontent\.com)/i.test(src);
    },

    extractInfoValue: function(html, key) {
        if (!html) return "";
        let block = this.matchFirst(html, new RegExp("<li[^>]*>[\\s\\S]*?<b[^>]*>\\s*" + key + "\\s*<\\/b>[\\s\\S]*?<span[^>]*>([\\s\\S]*?)<\\/span>[\\s\\S]*?<\\/li>", "i"));
        if (!block) {
            block = this.matchFirst(html, new RegExp(key + "\\s*:?\\s*<\\/[^>]+>\\s*<[^>]+>([\\s\\S]*?)<\\/", "i"));
        }
        return this.stripHtml(block);
    },

    mapStatus: function(status) {
        status = (status || "").toLowerCase();
        if (status.indexOf("ongoing") >= 0 || status.indexOf("on going") >= 0) return 1;
        if (status.indexOf("complete") >= 0 || status.indexOf("end") >= 0) return 2;
        if (status.indexOf("hiatus") >= 0) return 3;
        if (status.indexOf("cancel") >= 0) return 4;
        return 0;
    },

    parseDate: function(value) {
        value = this.cleanText(value);
        if (!value) return 0;

        let months = {
            "jan": 0, "januari": 0, "january": 0,
            "feb": 1, "februari": 1, "february": 1,
            "mar": 2, "maret": 2, "march": 2,
            "apr": 3, "april": 3,
            "mei": 4, "may": 4,
            "jun": 5, "juni": 5, "june": 5,
            "jul": 6, "juli": 6, "july": 6,
            "agu": 7, "agustus": 7, "august": 7,
            "sep": 8, "september": 8,
            "okt": 9, "oktober": 9, "october": 9,
            "nov": 10, "november": 10,
            "des": 11, "desember": 11, "december": 11
        };
        let match = value.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
        if (match) {
            let month = months[match[1].toLowerCase()];
            if (month !== undefined) return new Date(parseInt(match[3], 10), month, parseInt(match[2], 10)).getTime();
        }

        let time = Date.parse(value);
        return isNaN(time) ? 0 : time;
    },

    getHtml: function(url) {
        let response = fetch(url);
        if (response.status < 200 || response.status >= 300) return "";
        return response.body;
    },

    isBlockedHtml: function(html) {
        return /just a moment|checking your browser|cloudflare ray id|access denied|internet-positif/i.test(html || "");
    },

    absoluteUrl: function(path) {
        if (!path) return this.baseUrl + "/";
        if (/^https?:\/\//i.test(path)) return path;
        if (path.charAt(0) !== "/") path = "/" + path;
        return this.baseUrl + path;
    },

    relativeUrl: function(url) {
        if (!url) return "";
        return url.replace(this.baseUrl, "");
    },

    toQuery: function(params) {
        let parts = [];
        for (let key in params) {
            let value = params[key];
            if (value === undefined || value === null || value === "") continue;
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value[i]));
                }
            } else {
                parts.push(encodeURIComponent(key) + "=" + encodeURIComponent(value));
            }
        }
        return parts.length > 0 ? "?" + parts.join("&") : "";
    },

    textOf: function(root, selector) {
        if (!root) return "";
        let node = root.querySelector(selector);
        return node ? this.cleanText(node.text()) : "";
    },

    attrAbsOf: function(root, selector, attr) {
        if (!root) return "";
        let node = root.querySelector(selector);
        return node ? node.absUrl(attr) : "";
    },

    outerHtmlOf: function(root, selector) {
        if (!root) return "";
        let node = root.querySelector(selector);
        return node ? node.outerHtml() : "";
    },

    appendLine: function(text, line) {
        text = this.cleanText(text);
        line = this.cleanText(line);
        if (!line) return text;
        return text ? text + "\n\n" + line : line;
    },

    cleanChapterTitle: function(title) {
        title = this.cleanText(title)
            .replace(/\s*bahasa\s+indonesia\s*$/i, "")
            .replace(/^.+?\s+(Chapter\s+)/i, "$1");
        return title;
    },

    chapterTitleFromUrl: function(url) {
        let slug = (url || "").split("?")[0].replace(/\/$/, "");
        slug = slug.substring(slug.lastIndexOf("/") + 1);
        let match = slug.match(/chapter-([^/]+?)(?:-bahasa|-indo|-indonesia|$)/i);
        if (!match) return this.titleFromUrl(url);
        return "Chapter " + match[1].replace(/-/g, " ");
    },

    titleFromUrl: function(url) {
        let clean = (url || "").split("?")[0].replace(/\/$/, "");
        let slug = clean.substring(clean.lastIndexOf("/") + 1);
        return slug.replace(/-/g, " ").replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
    },

    matchFirst: function(text, regex) {
        let match = regex.exec(text || "");
        return match ? match[1] : "";
    },

    escapeRegex: function(value) {
        return (value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },

    stripHtml: function(value) {
        return this.cleanText(this.htmlDecode((value || "").replace(/<[^>]+>/g, " ")));
    },

    cleanText: function(value) {
        return this.htmlDecode(value || "").replace(/\s+/g, " ").trim();
    },

    htmlDecode: function(value) {
        return (value || "")
            .replace(/&#038;/g, "&")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, "\"")
            .replace(/&#039;/g, "'")
            .replace(/&nbsp;/g, " ")
            .replace(/&hellip;/g, "...");
    },

    genres: [
        "4-Koma", "Action", "Adult", "Adventure", "Blue Archive", "Comedy", "Crossdressing", "Demons",
        "Drama", "Ecchi", "Fantasy", "Game", "Gender bender", "Genderswap", "Gore", "Harem",
        "Historical", "Horror", "Isekai", "Josei", "Loli", "Magic", "Martial Arts", "Mature",
        "Mecha", "Military", "Monster Girls", "Music", "Mystery", "Office Worker", "One Shot",
        "Parody", "Phschological", "Police", "Psychological", "Romance", "Romcom", "School",
        "School Life", "Sci-Fi", "Seinen", "Seinin", "Shota", "Shotacon", "Shoujo", "Shoujo Ai",
        "Shounen", "Shounen Ai", "Slice of Life", "Smut", "Sports", "Super Power", "Supernatural",
        "Survival", "Thriller", "Time Travel", "Tragedy", "Vampire", "Webtoons", "Yuri"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua", "One-shot", "Doujin"
    ]
};
