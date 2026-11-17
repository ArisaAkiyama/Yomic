var source = {
    name: "OkyyKomik",
    baseUrl: "https://www.okyykomik.my.id",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/okyykomik/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.1",
    description: "OkyyKomik Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#0f172a",
    iconForeground: "#38bdf8",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,

    getPopularManga: function(page) {
        return this.getMangaFeed("Series", page);
    },

    getLatestUpdates: function(page) {
        return this.getMangaFeed("Series", page);
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);

        // 1. Try Blogger JSON search feed
        let startIndex = (Math.max(1, page || 1) - 1) * this.pageSize + 1;
        let feedUrl = this.baseUrl + "/feeds/posts/summary?q=" + encodeURIComponent(query) + "&alt=json&max-results=" + this.pageSize + "&start-index=" + startIndex;
        let json = this.getJson(feedUrl);

        if (json && json.feed && json.feed.entry) {
            let entries = json.feed.entry;
            let items = [];
            let seen = {};

            for (let i = 0; i < entries.length; i++) {
                let e = entries[i];
                let categories = (e.category || []).map(c => c.term);

                // Filter for series posts
                if (!categories.includes("Series")) continue;

                let links = e.link || [];
                let alt = links.find(l => l.rel === "alternate");
                let href = alt ? alt.href : "";
                if (!href || seen[href]) continue;
                seen[href] = true;

                let title = (e.title && e.title["$t"]) ? e.title["$t"] : this.titleFromUrl(href);
                let media = e["media$thumbnail"] ? e["media$thumbnail"].url.replace(/\/s\d+(-c)?\//, "/w340/") : "";

                if (!media) {
                    media = this.fetchCoverFromDetail(href);
                }

                items.push({
                    title: title,
                    url: this.relativeUrl(href),
                    thumbnailUrl: media,
                    source: this.id
                });
            }

            if (items.length > 0) {
                return { items: items, totalPages: 10 };
            }
        }

        // 2. Fallback to HTML label parsing
        let htmlUrl = this.baseUrl + "/search?q=" + encodeURIComponent(query);
        return this.parseMangaCardsFromHtml(htmlUrl);
    },

    getMangaList: function(page, status, genre, type) {
        let label = "Series";
        if (genre) {
            let arr = Array.isArray(genre) ? genre : [genre];
            if (arr.length > 0) label = arr[0];
        } else if (type) {
            let tStr = Array.isArray(type) ? type[0] : String(type);
            label = tStr;
        }
        return this.getMangaFeed(label, page);
    },

    getMangaFeed: function(label, page) {
        page = Math.max(1, page || 1);
        let startIndex = (page - 1) * this.pageSize + 1;
        let feedUrl = this.baseUrl + "/feeds/posts/summary/-/" + encodeURIComponent(label) + "?alt=json&max-results=" + this.pageSize + "&start-index=" + startIndex;
        let json = this.getJson(feedUrl);

        if (json && json.feed && json.feed.entry) {
            let entries = json.feed.entry;
            let items = [];
            for (let i = 0; i < entries.length; i++) {
                let e = entries[i];
                let links = e.link || [];
                let alt = links.find(l => l.rel === "alternate");
                let href = alt ? alt.href : "";
                if (!href) continue;

                let title = (e.title && e.title["$t"]) ? e.title["$t"] : this.titleFromUrl(href);
                let media = e["media$thumbnail"] ? e["media$thumbnail"].url.replace(/\/s\d+(-c)?\//, "/w340/") : "";

                if (!media) {
                    media = this.fetchCoverFromDetail(href);
                }

                items.push({
                    title: title,
                    url: this.relativeUrl(href),
                    thumbnailUrl: media,
                    source: this.id
                });
            }

            return {
                items: items,
                totalPages: 50
            };
        }

        // Fallback HTML label parsing
        let htmlUrl = this.baseUrl + "/search/label/" + encodeURIComponent(label) + "?max-results=" + this.pageSize;
        return this.parseMangaCardsFromHtml(htmlUrl);
    },

    parseMangaCardsFromHtml: function(url) {
        let html = this.getHtml(url);
        let items = [];
        if (!html) return { items: [], totalPages: 1 };

        let re = /<label\b[^>]*data-img=["']([^"']+)["'][^>]*data-title=["']([^"']+)["'][^>]*data-url=["']([^"']+)["']/gi;
        let match;
        let seen = {};

        while ((match = re.exec(html)) !== null) {
            let img = match[1].replace(/\/w\d+\//, "/w340/");
            let title = match[2];
            let href = match[3];

            if (seen[href]) continue;
            seen[href] = true;

            items.push({
                title: title,
                url: this.relativeUrl(href),
                thumbnailUrl: img,
                source: this.id
            });
        }

        return { items: items, totalPages: 10 };
    },

    fetchCoverFromDetail: function(href) {
        let html = this.getHtml(href);
        if (!html) return "";
        let match = html.match(/itemprop=["']image["']\s+src=["']([^"']+)["']/) || html.match(/data-img=["']([^"']+)["']/);
        return match ? match[1].replace(/\/w\d+\//, "/w340/") : "";
    },

    getMangaDetails: function(url) {
        let absUrl = this.absoluteUrl(url);
        let html = this.getHtml(absUrl);
        if (!html) return {};

        let document = Html.parse(html, absUrl);
        let titleNode = document.querySelector("h1, h2, meta[property='og:title']");
        let title = titleNode ? this.cleanText(titleNode.text() || titleNode.attr("content")) : this.titleFromUrl(absUrl);

        let bookmarkLabel = document.querySelector("label[data-title]");
        if (bookmarkLabel) {
            let bmTitle = bookmarkLabel.attr("data-title");
            if (bmTitle) title = bmTitle;
        }

        let thumbnailUrl = this.attrAbsOf(document, "img[itemprop='image'], .gta-series img", "src");

        let author = this.textOf(document, "#extra-info > dl:nth-child(2) dd, dl:nth-child(2) dd");
        let artist = this.textOf(document, "#extra-info > dl:nth-child(3) dd, dl:nth-child(3) dd");
        if (artist && author && artist !== author) {
            author = author + " / " + artist;
        }

        let descriptionNode = document.querySelector("#noidungm, .synopsis, meta[name='description']");
        let description = descriptionNode ? this.cleanText(descriptionNode.text() || descriptionNode.attr("content")) : "";

        let genres = [];
        let genreNodes = document.querySelectorAll(".genre-info a, a[href*='/search/label/']");
        for (let i = 0; i < genreNodes.length; i++) {
            let txt = this.cleanText(genreNodes[i].text());
            if (txt && txt !== "Series" && txt !== "Project" && txt !== "ProjectOkyy" && txt !== "Chapter") {
                genres.push(txt);
            }
        }

        let statusStr = html.toLowerCase();
        let status = 0;
        if (statusStr.indexOf("ongoing") !== -1) status = 1;
        else if (statusStr.indexOf("completed") !== -1 || statusStr.indexOf("tamat") !== -1) status = 2;

        return {
            title: title,
            url: this.relativeUrl(absUrl),
            thumbnailUrl: thumbnailUrl,
            author: author,
            status: status,
            description: description,
            genre: genres,
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        let absUrl = this.absoluteUrl(mangaUrl);
        let html = this.getHtml(absUrl);
        let chapters = [];

        if (!html) return [];

        let document = Html.parse(html, absUrl);

        // 1. Try extracting series category/title label to fetch chapters from Blogger Feed API
        let categoryName = "";
        let bookmarkLabel = document.querySelector("label[data-title]");
        if (bookmarkLabel) {
            categoryName = bookmarkLabel.attr("data-title");
        }
        if (!categoryName) {
            let metaTitle = document.querySelector("meta[property='og:title']");
            if (metaTitle) categoryName = metaTitle.attr("content");
        }
        if (!categoryName) {
            let h1 = document.querySelector("h1, h2");
            if (h1) categoryName = h1.text();
        }

        let mainTitle = this.cleanText(categoryName);

        if (mainTitle) {
            let feedUrl = this.baseUrl + "/feeds/posts/summary/-/" + encodeURIComponent(mainTitle) + "?alt=json&max-results=150";
            let json = this.getJson(feedUrl);
            if (json && json.feed && json.feed.entry) {
                let entries = json.feed.entry;
                for (let i = 0; i < entries.length; i++) {
                    let e = entries[i];
                    let links = e.link || [];
                    let alt = links.find(l => l.rel === "alternate");
                    let href = alt ? alt.href : "";
                    if (!href || href === absUrl) continue;

                    let chTitle = (e.title && e.title["$t"]) ? e.title["$t"] : this.titleFromUrl(href);
                    let cleanedName = this.cleanChapterName(chTitle, mainTitle);
                    if (!cleanedName) continue;

                    let published = e.published ? Date.parse(e.published["$t"]) : 0;

                    chapters.push({
                        name: cleanedName,
                        url: this.relativeUrl(href),
                        dateUpload: published || 0
                    });
                }

                if (chapters.length > 0) return chapters;
            }
        }

        // 2. Fallback to HTML chapter links parsing
        let links = document.querySelectorAll("#clist a, .clist a, #chapter a, .chapter-list a, div.eps a, a[href*='.html']");
        let seen = {};
        for (let i = 0; i < links.length; i++) {
            let a = links[i];
            let href = a.absUrl("href");
            if (!href || seen[href] || href === absUrl || href.indexOf("/search") !== -1) continue;
            let txt = this.cleanText(a.text());
            let cleanedName = this.cleanChapterName(txt, mainTitle);
            if (!cleanedName || cleanedName.toLowerCase() === "read more" || cleanedName.toLowerCase() === "baca sekarang") continue;

            seen[href] = true;
            chapters.push({
                name: cleanedName,
                url: this.relativeUrl(href),
                dateUpload: 0
            });
        }

        return chapters;
    },

    cleanChapterName: function(rawName, mainTitle) {
        let name = this.cleanText(rawName);
        let lowerName = name.toLowerCase();
        let lowerTitle = (mainTitle || "").toLowerCase().trim();

        if (lowerTitle && lowerName.startsWith(lowerTitle)) {
            name = name.substring(lowerTitle.length).trim();
            name = name.replace(/^[:\-\s]+/, "").trim();
        }

        if (!name || lowerName === lowerTitle) {
            return "";
        }

        return name;
    },

    getPageList: function(chapterUrl) {
        let absUrl = this.absoluteUrl(chapterUrl);
        let html = this.getHtml(absUrl);
        let pages = [];

        if (!html) return [];

        let document = Html.parse(html, absUrl);
        let images = document.querySelectorAll("#reader img, .reader img, div.separator img, #post-body img");
        let seen = {};

        for (let i = 0; i < images.length; i++) {
            let img = images[i];
            let src = img.absUrl("src") || img.absUrl("data-src");
            if (!src || seen[src]) continue;

            // Skip logo, icon, or banner images
            if (src.indexOf("logo") !== -1 || src.indexOf("favicon") !== -1 || src.indexOf("banner") !== -1) continue;

            seen[src] = true;
            pages.push(src + "|Referer=" + this.baseUrl + "/");
        }

        return pages;
    },

    titleFromUrl: function(url) {
        let parts = (url || "").split("?")[0].split("/").filter(x => x);
        let slug = parts.length ? parts[parts.length - 1].replace(/\.html$/, "") : "";
        return this.cleanText(slug.replace(/[-_]/g, " "));
    },

    textOf: function(root, selector) {
        let node = root.querySelector(selector);
        return node ? this.cleanText(node.text() || node.attr("content")) : "";
    },

    attrAbsOf: function(root, selector, attr) {
        let node = root.querySelector(selector);
        return node ? node.absUrl(attr) : "";
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
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
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                "Referer": this.baseUrl + "/"
            }
        });
        if (response.status < 200 || response.status >= 300) return null;
        try {
            return JSON.parse(response.body);
        } catch(e) {
            return null;
        }
    },

    genres: [
        "Action", "Adventure", "Comedy", "Drama", "Ecchi", "Fantasy", "Historical",
        "Horror", "Isekai", "Josei", "Martial Arts", "Mecha", "Mystery", "Psychological",
        "Romance", "School Life", "Sci-Fi", "Seinen", "Shoujo", "Shounen", "Slice of Life",
        "Sports", "Supernatural", "Tragedy", "Wuxia", "Manga", "Manhwa", "Manhua"
    ]
};
