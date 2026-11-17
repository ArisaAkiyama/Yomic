var source = {
    name: "Mangabat",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/en/mangabat/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://www.mangabats.com",
    language: "en",
    version: "1.0.4",
    description: "Mangabat English extension implemented in JavaScript using HTML parsing and MangaBox endpoints",
    author: "DesktopKomik",
    iconBackground: "#111827",
    iconForeground: "#facc15",
    isNsfw: false,
    isHasMorePages: true,

    chapterPageSize: 1000,

    getPopularManga: function(page) {
        return this.getMangaPage("/genre/all?filter=7&page=" + Math.max(1, page || 1));
    },

    getLatestUpdates: function(page) {
        return this.getMangaPage("/manga-list/latest-manga?page=" + Math.max(1, page || 1));
    },

    getSearchManga: function(query, page) {
        page = Math.max(1, page || 1);
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        return this.getMangaPage("/search/story/" + this.normalizeSearchQuery(query) + "?page=" + page);
    },

    getMangaList: function(page, status, genre, type) {
        page = Math.max(1, page || 1);
        
        let genreSlug = "all";
        
        // Prioritize genre filter (which now includes Manga, Manhwa, Manhua)
        if (genre) {
            let arr = Array.isArray(genre) ? genre : [genre];
            if (arr.length > 0) {
                genreSlug = this.mapGenreToSlug(arr[0]);
            }
        } 

        let state = "all";
        let forcedStatus = 0;
        if (status === 1) {
            state = "ongoing";
            forcedStatus = 1;
        } else if (status === 2) {
            state = "completed";
            forcedStatus = 2;
        }

        let path = "/genre/" + genreSlug + "?state=" + state + "&type=topview&page=" + page;
        return this.getMangaPage(path, forcedStatus);
    },

    getMangaPage: function(path, forcedStatus) {
        let url = this.absoluteUrl(path);
        let html = this.getHtml(url);
        if (!html || this.isBlockedHtml(html)) return { items: [], totalPages: 1 };

        let document = Html.parse(html, url);
        let cards = document.querySelectorAll("div.truyen-list > div.list-truyen-item-wrap, div.comic-list > div.list-comic-item-wrap, .panel_story_list .story_item, div.list-truyen-item-wrap, div.list-comic-item-wrap");
        let items = [];
        let seen = {};

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let link = card.querySelector("h3 a, a[href*='/manga/']");
            if (!link) continue;

            let href = link.absUrl("href");
            if (!href || seen[href]) continue;

            // Skip navigation links like "/genre/all" or "/manga-list"
            if (href.indexOf("/genre/") !== -1 || href.indexOf("/manga-list") !== -1) continue;

            seen[href] = true;

            let title = this.cleanText(link.text()) || this.titleFromUrl(href);
            let lowerTitle = title.toLowerCase();
            if (lowerTitle === "all" || lowerTitle === "latest" || lowerTitle === "latest updates" || lowerTitle === "latest manga") continue;

            if (lowerTitle === "tales of demons and gods") {
                title = "Tales of Demons and Gods";
            }

            let img = card.querySelector("img");
            items.push({
                title: title,
                url: this.relativeUrl(href),
                thumbnailUrl: img ? img.absUrl("src") : "",
                status: forcedStatus || this.extractCardStatus(card.outerHtml()),
                source: this.id
            });
        }

        return {
            items: items,
            totalPages: this.extractTotalPages(html, this.currentPageFromPath(path))
        };
    },

    getMangaDetails: function(url) {
        let absUrl = this.absoluteUrl(url);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return {};

        let document = Html.parse(html, absUrl);
        let info = document.querySelector("div.comic-info-section, div.manga-info-top, div.panel-story-info");
        let title = "";
        let thumbnailUrl = "";
        let author = "";
        let status = 0;
        let genre = [];

        if (info) {
            title = this.textOf(info, "h1, h2");
            thumbnailUrl = this.attrAbsOf(info, "div.manga-info-pic img, span.info-image img, img", "src");
            author = this.extractInfoValue(info.outerHtml(), "author") || this.extractInfoLinks(info.outerHtml(), "author").join(", ");
            status = this.mapStatus(this.extractInfoValue(info.outerHtml(), "status"));
            genre = this.extractInfoLinks(info.outerHtml(), "genres");
        }

        if (!title) {
            title = this.textOf(document, "h1, h2") || this.titleFromUrl(absUrl);
        }
        if (!thumbnailUrl) {
            thumbnailUrl = this.attrAbsOf(document, "div.manga-info-pic img, span.info-image img, img", "src");
        }
        if (status === 0) {
            status = this.mapStatus(this.extractInfoValue(html, "status"));
        }
        if (genre.length === 0) {
            genre = this.extractInfoLinks(html, "genres");
        }

        let descriptionNode = document.querySelector("div#noidungm, div#panel-story-info-description, div#contentBox");
        let description = descriptionNode ? this.cleanDescription(descriptionNode.text(), title) : "";
        let altName = this.extractAlternativeName(document, html);
        if (altName) {
            description = description ? description + "\n\nAlternative Name: " + altName : "Alternative Name: " + altName;
        }

        if (title.toLowerCase() === "tales of demons and gods") {
            title = "Tales of Demons and Gods";
        }

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
        let slug = this.extractMangaSlug(mangaUrl);
        let chapters = [];

        // 1. Try API first (Mangabat's dynamic chapter endpoint)
        if (slug) {
            let offset = 0;
            while (offset < 10000) {
                let apiUrl = this.baseUrl + "/api/manga/" + encodeURIComponent(slug) + "/chapters?limit=" + this.chapterPageSize + "&offset=" + offset;
                let json = this.getJson(apiUrl);
                if (!json || !json.data || !json.data.chapters || json.data.chapters.length === 0) break;

                let data = json.data;
                for (let i = 0; i < data.chapters.length; i++) {
                    let chapter = data.chapters[i];
                    chapters.push({
                        name: chapter.chapter_name || chapter.name || "Chapter",
                        url: this.relativeUrl(this.baseUrl + "/manga/" + slug + "/" + chapter.chapter_slug),
                        dateUpload: this.parseDate(chapter.updated_at || chapter.updatedAt || "")
                    });
                }

                if (!data.pagination || data.pagination.has_more !== true) break;
                offset += this.chapterPageSize;
            }
        }

        if (chapters.length > 0) return chapters;

        // 2. Fallback to HTML parsing if API is unavailable
        let absUrl = this.absoluteUrl(mangaUrl);
        let html = this.getHtml(absUrl);

        if (html && !this.isBlockedHtml(html)) {
            let re = /<a\b[^>]+href=["'](https?:\/\/[^"']*\/chapter-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let match;
            let seen = {};
            while ((match = re.exec(html)) !== null) {
                let href = match[1];
                if (!href || seen[href] || href.indexOf("/chapter-") === -1) continue;

                let rawName = match[2].replace(/<[^>]+>/g, "");
                let cleanName = this.cleanText(rawName);
                let lowerName = cleanName.toLowerCase();

                // Skip header navigation links like "Start Reading" and "Newest Chapter"
                if (lowerName === "start reading" || lowerName === "newest chapter") continue;

                seen[href] = true;
                chapters.push({
                    name: cleanName || this.titleFromUrl(href),
                    url: this.relativeUrl(href),
                    dateUpload: 0
                });
            }
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let absUrl = this.absoluteUrl(chapterUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];

        let scripts = this.extractScriptText(html);
        let cdns = this.extractArray(scripts, /cdns\s*=\s*\[([^\]]+)\]/);
        let backups = this.extractArray(scripts, /backupImage\s*=\s*\[([^\]]+)\]/);
        let chapterImages = this.extractArray(scripts, /chapterImages\s*=\s*\[([^\]]+)\]/);
        let bases = cdns.concat(backups);
        let pages = [];

        if (chapterImages.length > 0 && bases.length > 0) {
            let base = bases[0].replace(/\/+$/, "");
            for (let i = 0; i < chapterImages.length; i++) {
                pages.push(base + "/" + chapterImages[i].replace(/^\/+/, "") + "|Referer=" + this.baseUrl + "/");
            }
            return pages;
        }

        let document = Html.parse(html, absUrl);
        let images = document.querySelectorAll("div.container-chapter-reader > img, .container-chapter-reader img, img");
        let seen = {};
        for (let i = 0; i < images.length; i++) {
            let src = images[i].absUrl("src");
            if (!src || seen[src]) continue;
            seen[src] = true;
            pages.push(src + "|Referer=" + this.baseUrl + "/");
        }

        return pages;
    },

    hasNextPage: function(document, html) {
        if (document.querySelector("div.group_page, div.group-page a:not([href]) + a, a.page_select + a, a.page-select + a")) return true;
        return /page[-_ ]?(?:select|current)[\s\S]{0,120}<a\b/i.test(html) || /Next/i.test(html);
    },

    extractTotalPages: function(html, currentPage) {
        let maxPage = Math.max(1, currentPage || 1);
        let re = /[?&](?:amp;)?page=(\d+)/gi;
        let match;
        while ((match = re.exec(html || "")) !== null) {
            let page = parseInt(match[1]);
            if (!isNaN(page) && page > maxPage) maxPage = page;
        }
        return maxPage;
    },

    extractCardStatus: function(html) {
        return this.mapStatus(this.stripHtml(this.matchFirst(html, /(?:Status|status)\s*:?<\/[^>]+>\s*<[^>]+>([^<]+)/i)));
    },

    extractInfoValue: function(html, key) {
        let re1 = new RegExp("<li[^>]*>\\s*[^<]*" + key + "[^<]*[\\s\\S]*?<a[^>]*>([\\s\\S]*?)<\\/a>", "i");
        let re2 = new RegExp("<td[^>]*>\\s*[^<]*" + key + "[^<]*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>", "i");
        let re3 = new RegExp("<p[^>]*>\\s*" + key + "\\(s\\)\\s*:?\\s*<\\/p>\\s*([\\s\\S]*?)\\s*<p[^>]*>", "i");
        let re4 = new RegExp("<p[^>]*>\\s*" + key + "\\s*:?\\s*<\\/p>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>", "i");
        return this.stripHtml(this.matchFirst(html, re1) || this.matchFirst(html, re2) || this.matchFirst(html, re3) || this.matchFirst(html, re4));
    },

    extractInfoLinks: function(html, key) {
        let block = this.matchFirst(html, new RegExp("<li[^>]*>\\s*[^<]*" + key + "[^<]*([\\s\\S]*?)<\\/li>", "i")) ||
            this.matchFirst(html, new RegExp("<td[^>]*>\\s*[^<]*" + key + "[^<]*<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>", "i")) ||
            this.matchFirst(html, /<div[^>]+class=["'][^"']*genre-list[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
        let values = [];
        let re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = re.exec(block || "")) !== null) {
            let text = this.stripHtml(match[1]);
            if (text) values.push(text);
        }
        if (values.length === 0 && block) {
            let text = this.stripHtml(block);
            if (text) values.push(text);
        }
        return values;
    },

    extractAlternativeName: function(document, html) {
        let node = document.querySelector(".story-alternative, tr h2");
        if (node) return this.cleanText(node.text());
        return this.stripHtml(this.matchFirst(html, /Alternative Name:\s*([\s\S]*?)<\/(?:div|td|tr)>/i));
    },

    extractScriptText: function(html) {
        let output = "";
        let re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
        let match;
        while ((match = re.exec(html || "")) !== null) {
            if (match[1].indexOf("cdns") !== -1 || match[1].indexOf("chapterImages") !== -1 || match[1].indexOf("backupImage") !== -1) {
                output += "\n" + match[1];
            }
        }
        return output;
    },

    extractArray: function(text, regex) {
        let match = regex.exec(text || "");
        if (!match) return [];
        return match[1]
            .split(",")
            .map(x => x.trim().replace(/^["']|["']$/g, "").replace(/\\\//g, "/").replace(/\/+$/, ""))
            .filter(x => x);
    },

    extractMangaSlug: function(url) {
        let clean = this.relativeUrl(this.absoluteUrl(url)).split("?")[0].split("#")[0];
        let parts = clean.split("/").filter(x => x);
        if (parts.length >= 2 && parts[0] === "manga") return parts[1];
        return parts.length > 0 ? parts[parts.length - 1] : "";
    },

    normalizeSearchQuery: function(query) {
        let str = (query || "").toLowerCase();
        str = str.replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a");
        str = str.replace(/[èéẹẻẽêềếệểễ]/g, "e");
        str = str.replace(/[ìíịỉĩ]/g, "i");
        str = str.replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o");
        str = str.replace(/[ùúụủũưừứựửữ]/g, "u");
        str = str.replace(/[ỳýỵỷỹ]/g, "y");
        str = str.replace(/đ/g, "d");
        str = str.replace(/[!@%^*()+<>\?\/,\.:;'"&#[\]~\-$ _=]+/g, "_");
        str = str.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
        return str;
    },

    currentPageFromPath: function(path) {
        let match = /[?&]page=(\d+)/.exec(path || "");
        return match ? Math.max(1, parseInt(match[1])) : 1;
    },

    mapStatus: function(status) {
        status = (status || "").toLowerCase();
        if (status.indexOf("ongoing") !== -1) return 1;
        if (status.indexOf("completed") !== -1 || status.indexOf("complete") !== -1) return 2;
        return 0;
    },

    titleFromUrl: function(url) {
        let parts = (url || "").split("?")[0].split("/").filter(x => x);
        return this.cleanText((parts.length ? parts[parts.length - 1] : "").replace(/[-_]/g, " "));
    },

    attrAbsOf: function(root, selector, attr) {
        let node = root.querySelector(selector);
        return node ? node.absUrl(attr) : "";
    },

    textOf: function(root, selector) {
        let node = root.querySelector(selector);
        return node ? this.cleanText(node.text()) : "";
    },

    cleanDescription: function(value, title) {
        value = this.cleanText(value || "");
        if (title) {
            value = value.replace(new RegExp("^" + this.escapeRegex(title) + "\\s+summary:\\s*", "i"), "");
        }
        return value;
    },

    stripHtml: function(value) {
        return this.cleanText((value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
    },

    cleanText: function(value) {
        return this.decodeHtml((value || "").replace(/\s+/g, " ").trim());
    },

    decodeHtml: function(value) {
        return (value || "")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, "\"")
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ");
    },

    matchFirst: function(text, regex) {
        let match = regex.exec(text || "");
        return match ? match[1] : "";
    },

    escapeRegex: function(value) {
        return (value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    },

    parseDate: function(value) {
        if (!value) return 0;
        let time = Date.parse(value);
        return isNaN(time) ? 0 : time;
    },

    isBlockedHtml: function(html) {
        html = (html || "").toLowerCase();
        return html.indexOf("just a moment") !== -1 || html.indexOf("enable javascript and cookies") !== -1 || html.indexOf("internet-positif") !== -1;
    },

    absoluteUrl: function(url) {
        if (!url) return this.baseUrl;
        if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
        return this.baseUrl + (url.charAt(0) === "/" ? url : "/" + url);
    },

    relativeUrl: function(url) {
        if (!url) return "";
        return url.indexOf(this.baseUrl) === 0 ? url.substring(this.baseUrl.length) : url;
    },

    getHtml: function(url) {
        let response = fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                "Referer": this.baseUrl + "/"
            }
        });
        if (response.status < 200 || response.status >= 300) return "";
        return response.body;
    },

    getJson: function(url) {
        let response = fetch(url, {
            headers: {
                "Accept": "application/json",
                "Referer": this.baseUrl + "/"
            }
        });
        if (response.status < 200 || response.status >= 300) return null;
        return JSON.parse(response.body);
    },

    mapGenreToSlug: function(genre) {
        return (genre || "").toLowerCase().trim()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "");
    },

    genres: [
        "Action", "Adult", "Adventure", "Comedy", "Cooking", "Doujinshi", "Drama", "Ecchi", "Fantasy", 
        "Gender Bender", "Harem", "Historical", "Horror", "Isekai", "Josei", "Loli", "Martial Arts", 
        "Mature", "Mecha", "Medical", "Mystery", "One Shot", "Psychological", "Romance", "School Life", 
        "Sci-Fi", "Seinen", "Shoujo", "Shoujo Ai", "Shounen", "Shounen Ai", "Slice of Life", "Smut", 
        "Sports", "Supernatural", "Tragedy", "Webtoons", "Yaoi", "Yuri",
        "Manga", "Manhwa", "Manhua"
    ]
};
