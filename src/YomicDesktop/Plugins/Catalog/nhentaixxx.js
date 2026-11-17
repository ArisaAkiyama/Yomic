var source = {
    name: "NHentai.xxx",
    baseUrl: "https://nhentai.xxx",
    language: "en",
    version: "1.0.2",
    description: "Read English and Japanese doujinshi from NHentai.xxx",
    author: "DesktopKomik",
    iconUrl: "https://www.google.com/s2/favicons?domain=nhentai.xxx&sz=128",
    iconBackground: "#111111",
    iconForeground: "#ed2553",
    isNsfw: true,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],
    isHasMorePages: true,

    getPopularManga: function(page) {
        return this.getDualLanguagePage(page, true);
    },

    getLatestUpdates: function(page) {
        return this.getDualLanguagePage(page, false);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getLatestUpdates(page);
        return this.getGalleryPage("/search/?key=" + encodeURIComponent(query) + "&page=" + Math.max(1, page || 1), ["1", "2"]);
    },

    getMangaList: function(page, status) {
        if (status === 1) {
            return { items: [], totalPages: 1 };
        }
        return this.getLatestUpdates(page);
    },

    getDualLanguagePage: function(page, popular) {
        page = Math.max(1, page || 1);
        let suffix = popular ? "popular/?page=" + page : "?page=" + page;
        let english = this.getGalleryPage("/language/english/" + suffix);
        let japanese = this.getGalleryPage("/language/japanese/" + suffix);
        return {
            items: this.interleaveItems(english.items, japanese.items),
            totalPages: Math.max(english.totalPages || page, japanese.totalPages || page)
        };
    },

    getGalleryPage: function(path, allowedLanguages) {
        let url = this.absoluteUrl(path);
        let html = this.getHtml(url);
        if (!html || this.isBlockedHtml(html)) return { items: [], totalPages: this.currentPageFromPath(path) };

        let document = Html.parse(html, url);
        let cards = document.querySelectorAll(".galleries_box .gallery_item, .gallery_item");
        let items = [];
        let seen = {};

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            if (allowedLanguages && allowedLanguages.length) {
                let lang = card.attr("data-languages");
                if (allowedLanguages.indexOf(lang) === -1) continue;
            }
            let link = card.querySelector("a[href*='/g/']");
            if (!link) continue;

            let href = link.absUrl("href");
            if (!href || seen[href]) continue;
            seen[href] = true;

            let img = card.querySelector("img");
            items.push({
                title: this.cleanText(this.textOf(card, ".caption") || link.attr("title") || this.titleFromUrl(href)),
                url: this.relativeUrl(href),
                thumbnailUrl: img ? (img.absUrl("data-src") || img.absUrl("src")) : "",
                status: 2,
                source: this.id
            });
        }

        return {
            items: items,
            totalPages: this.extractTotalPages(html, this.currentPageFromPath(path))
        };
    },

    interleaveItems: function(first, second) {
        let items = [];
        let max = Math.max(first ? first.length : 0, second ? second.length : 0);
        for (let i = 0; i < max; i++) {
            if (first && i < first.length) items.push(first[i]);
            if (second && i < second.length) items.push(second[i]);
        }
        return items;
    },

    getMangaDetails: function(url) {
        let absUrl = this.absoluteUrl(url);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return {};

        let document = Html.parse(html, absUrl);
        let title = this.textOf(document, ".gallery_top .info h1, h1") || this.titleFromUrl(absUrl);
        let altTitle = this.textOf(document, ".gallery_top .info h2");
        let artists = this.extractInfoValues(html, "Artists").join(", ");
        let tags = this.extractInfoValues(html, "Tags");
        let category = this.extractInfoValues(html, "Category");
        let languages = this.extractInfoValues(html, "Languages");
        let pages = this.stripHtml(this.matchFirst(html, /<span[^>]+class=["'][^"']*tag_name pages[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));
        let uploaded = this.stripHtml(this.matchFirst(html, /<span[^>]+class=["'][^"']*uploaded[^"']*["'][^>]*>([\s\S]*?)<\/span>/i));

        let descriptionParts = [];
        if (altTitle) descriptionParts.push("Alternative title: " + altTitle);
        if (pages) descriptionParts.push("Pages: " + pages);
        if (uploaded) descriptionParts.push("Uploaded: " + uploaded);
        if (languages.length) descriptionParts.push("Languages: " + languages.join(", "));
        if (category.length) descriptionParts.push("Category: " + category.join(", "));

        return {
            title: title,
            url: this.relativeUrl(absUrl),
            thumbnailUrl: this.attrAbsOf(document, ".gallery_top .cover img, .cover img", "data-src") || this.attrAbsOf(document, ".gallery_top .cover img, .cover img", "src"),
            author: artists,
            status: 2,
            description: descriptionParts.join("\n"),
            genre: tags,
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        return [{
            name: "Read",
            url: this.relativeUrl(this.absoluteUrl(mangaUrl)),
            dateUpload: 0
        }];
    },

    getPageList: function(chapterUrl) {
        let absUrl = this.absoluteUrl(chapterUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];

        let server = this.matchFirst(html, /id=["']load_server["'][^>]+value=["']([^"']+)/i) ||
            this.matchFirst(html, /id=["']server_id["'][^>]+value=["']([^"']+)/i);
        let dir = this.matchFirst(html, /id=["']load_dir["'][^>]+value=["']([^"']+)/i) ||
            this.matchFirst(html, /id=["']image_dir["'][^>]+value=["']([^"']+)/i);
        let galleryId = this.matchFirst(html, /id=["']load_id["'][^>]+value=["']([^"']+)/i) ||
            this.matchFirst(html, /id=["']gallery_id["'][^>]+value=["']([^"']+)/i);
        let totalPages = parseInt(this.matchFirst(html, /id=["']load_pages["'][^>]+value=["'](\d+)/i) ||
            this.matchFirst(html, /<span[^>]+class=["'][^"']*tag_name pages[^"']*["'][^>]*>(\d+)<\/span>/i));

        let fileMeta = this.extractFileMeta(html);
        let pages = [];
        let seen = {};

        if (server && dir && galleryId && totalPages > 0) {
            let host = "https://i" + server + ".nhentaimg.com";
            for (let i = 1; i <= totalPages; i++) {
                let ext = this.extensionFromMeta(fileMeta["" + i] || "");
                let pageUrl = host + "/" + dir + "/" + galleryId + "/" + i + "." + ext;
                pages.push(pageUrl + "|Referer=" + absUrl);
            }
            return pages;
        }

        let re = /https?:\/\/[^"'<>\s]+nhentaimg\.com\/[^"'<>\s]+\.(?:jpg|jpeg|png|webp)(?:\?[^"'<>\s]*)?/gi;
        let match;
        while ((match = re.exec(html)) !== null) {
            let imageUrl = this.decodeHtml(match[0]).replace(/\\\//g, "/");
            if (imageUrl.indexOf("/thumb.") !== -1 || imageUrl.indexOf("t.") !== -1 || seen[imageUrl]) continue;
            seen[imageUrl] = true;
            pages.push(imageUrl + "|Referer=" + absUrl);
        }

        return pages;
    },

    extractFileMeta: function(html) {
        let json = this.matchFirst(html, /parseJSON\('([\s\S]*?)'\)/i);
        if (!json) return {};
        try {
            json = json.replace(/\\'/g, "'");
            let parsed = JSON.parse(json);
            return parsed && parsed.fl ? parsed.fl : {};
        } catch (e) {
            return {};
        }
    },

    extensionFromMeta: function(meta) {
        let type = (meta || "").split(",")[0];
        if (type === "p") return "png";
        if (type === "g") return "gif";
        if (type === "j") return "jpg";
        return "webp";
    },

    extractInfoValues: function(html, label) {
        let block = this.matchFirst(html, new RegExp("<li[^>]+class=[\"'][^\"']*tags[^\"']*[\"'][^>]*>\\s*<span[^>]+class=[\"']text[\"'][^>]*>\\s*" + label + "\\s*<\\/span>([\\s\\S]*?)<\\/li>", "i"));
        let values = [];
        let re = /<span[^>]+class=["'][^"']*tag_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;
        let match;
        while ((match = re.exec(block || "")) !== null) {
            let value = this.stripHtml(match[1]);
            if (value) values.push(value);
        }
        return values;
    },

    extractTotalPages: function(html, currentPage) {
        let maxPage = Math.max(1, currentPage || 1);
        let re = /(?:[?&](?:amp;)?page=|\/page\/)(\d+)/gi;
        let match;
        while ((match = re.exec(html || "")) !== null) {
            let page = parseInt(match[1]);
            if (!isNaN(page) && page > maxPage) maxPage = page;
        }
        return maxPage;
    },

    currentPageFromPath: function(path) {
        let match = /[?&]page=(\d+)/.exec(path || "");
        return match ? Math.max(1, parseInt(match[1])) : 1;
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
            .replace(/&#039;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ");
    },

    matchFirst: function(text, regex) {
        let match = regex.exec(text || "");
        return match ? match[1] : "";
    },

    isBlockedHtml: function(html) {
        html = (html || "").toLowerCase();
        return html.indexOf("just a moment") !== -1 ||
            html.indexOf("checking your browser") !== -1 ||
            html.indexOf("cloudflare ray id") !== -1 ||
            html.indexOf("internet-positif") !== -1;
    },

    absoluteUrl: function(url) {
        if (!url) return this.baseUrl;
        if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
        if (url.indexOf("//") === 0) return "https:" + url;
        return this.baseUrl + (url.charAt(0) === "/" ? url : "/" + url);
    },

    relativeUrl: function(url) {
        if (!url) return "";
        return url.indexOf(this.baseUrl) === 0 ? url.substring(this.baseUrl.length) : url;
    },

    getHtml: function(url) {
        let response = fetch(url, {
            headers: {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": this.baseUrl + "/"
            }
        });
        if (response.status < 200 || response.status >= 300) return "";
        return response.body;
    }
};
