var source = {
    name: "WeebCentral",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/en/weebcentral/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://weebcentral.com",
    language: "en",
    version: "1.0.3",
    description: "WeebCentral English extension implemented in JavaScript using WeebCentral lightweight endpoints",
    author: "DesktopKomik",
    iconBackground: "#1f2937",
    iconForeground: "#ffffff",
    isNsfw: false,
    isHasMorePages: true,

    pageSize: 14,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],
    fetchLimit: 32,
    knownTotalItems: 10450,
    knownStatusTotals: {
        Ongoing: 4640,
        Complete: 5671
    },

    getPopularManga: function(page) {
        return this.getSearchPage(page, "", {
            sort: "Popularity",
            order: "Descending"
        });
    },

    getLatestUpdates: function(page) {
        return this.getSearchPage(page, "", {
            sort: "Latest Updates",
            order: "Descending"
        });
    },

    getSearchManga: function(query, page) {
        return this.getSearchPage(page, query || "", {
            sort: query && query.trim() !== "" ? "Best Match" : "Popularity",
            order: "Descending"
        });
    },

    getMangaList: function(page, status) {
        let params = {
            sort: "Popularity",
            order: "Descending"
        };

        if (status === 1) {
            params.included_status = "Ongoing";
        } else if (status === 2) {
            params.included_status = "Complete";
        }

        return this.getSearchPage(page, "", params);
    },

    getSearchPage: function(page, query, extraParams) {
        let currentPage = Math.max(1, page || 1);
        let params = {
            text: this.cleanSearchQuery(query || ""),
            limit: this.fetchLimit,
            offset: (currentPage - 1) * this.pageSize,
            display_mode: "Full Display",
            official: "Any",
            anime: "Any",
            adult: "Any"
        };

        for (let key in extraParams) {
            params[key] = extraParams[key];
        }

        let html = this.getHtml(this.baseUrl + "/search/data" + this.toQuery(params));
        if (!html) return { items: [], totalPages: currentPage };

        let document = Html.parse(html, this.baseUrl);
        let cards = document.querySelectorAll("article.bg-base-300");
        let items = [];
        let seen = {};

        for (let i = 0; i < cards.length; i++) {
            let card = cards[i];
            let link = card.querySelector("a[href*='/series/']");
            if (!link) continue;

            let absUrl = link.absUrl("href");
            if (!absUrl || seen[absUrl]) continue;
            seen[absUrl] = true;

            let title = this.extractTitleFromCard(link);
            if (!title) title = this.titleFromUrl(absUrl);
            let thumbnailUrl = this.extractImage(link);

            items.push({
                title: title,
                url: this.relativeUrl(absUrl),
                thumbnailUrl: thumbnailUrl,
                status: this.extractStatusFromCardHtml(card.outerHtml()),
                source: this.id
            });

            if (items.length >= this.pageSize) break;
        }

        let totalPages = this.getTotalPages(query, extraParams, currentPage, html);

        return {
            items: items,
            totalPages: totalPages
        };
    },

    getMangaDetails: function(url) {
        let html = this.getHtml(this.absoluteUrl(url));
        if (!html) return {};

        let document = Html.parse(html, this.absoluteUrl(url));
        let title = this.textOf(document, "h1");
        if (!title) title = this.metaContent(document, "meta[property='og:title']").replace(" | Weeb Central", "");

        let thumbnailUrl = this.metaContent(document, "meta[property='og:image']");
        if (!thumbnailUrl) thumbnailUrl = this.extractImage(document);

        return {
            title: title,
            url: this.relativeUrl(this.absoluteUrl(url)),
            thumbnailUrl: thumbnailUrl,
            author: this.extractLabelLinks(html, "Author").join(", "),
            status: this.mapStatus(this.extractLabelText(html, "Status")),
            description: this.extractDescription(document, html),
            genre: this.extractGenres(html),
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        let clean = this.relativeUrl(this.absoluteUrl(mangaUrl)).split("?")[0];
        let parts = clean.split("/").filter(x => x);
        if (parts.length < 2) return [];

        let listUrl = this.baseUrl + "/series/" + parts[1] + "/full-chapter-list";
        let html = this.getHtml(listUrl);
        if (!html) return [];

        let document = Html.parse(html, this.baseUrl);
        let links = document.querySelectorAll("a[href*='/chapters/']");
        let chapters = [];
        let seen = {};

        for (let i = 0; i < links.length; i++) {
            let link = links[i];
            let absUrl = link.absUrl("href");
            if (!absUrl || seen[absUrl]) continue;
            seen[absUrl] = true;

            let nameNode = link.querySelector("span.flex > span");
            let name = nameNode ? nameNode.text() : link.text();
            let timeNode = link.querySelector("time[datetime]");
            chapters.push({
                name: this.cleanText(name || "Chapter"),
                url: this.relativeUrl(absUrl),
                dateUpload: this.parseDate(timeNode ? timeNode.attr("datetime") : "")
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let imagesUrl = this.absoluteUrl(chapterUrl).split("?")[0] + "/images?is_prev=False&reading_style=long_strip";
        let html = this.getHtml(imagesUrl);
        if (!html) return [];

        let document = Html.parse(html, this.baseUrl);
        let images = document.querySelectorAll("section[x-data] img, img");
        let pages = [];
        let seen = {};

        for (let i = 0; i < images.length; i++) {
            let src = images[i].absUrl("src");
            if (!src || seen[src]) continue;
            seen[src] = true;
            pages.push(src + "|Referer=" + this.baseUrl + "&Origin=" + this.baseUrl);
        }

        return pages;
    },

    extractTitleFromCard: function(link) {
        let tooltip = link.querySelector("[data-tip]");
        if (tooltip) {
            let value = tooltip.attr("data-tip");
            if (value && !this.isMetadataTip(value)) return this.cleanText(value);
        }

        let titleNodes = link.querySelectorAll("div");
        for (let i = titleNodes.length - 1; i >= 0; i--) {
            let text = this.cleanText(titleNodes[i].text());
            if (text && !this.isMetadataTip(text) && text.length < 160) return text;
        }

        return "";
    },

    extractImage: function(root) {
        let source = root.querySelector("source[srcset*='/cover/normal/']");
        if (!source) source = root.querySelector("source[srcset]");
        if (source) {
            let srcset = source.attr("srcset").split(" ")[0];
            if (srcset) return this.absoluteUrl(srcset.replace("/small/", "/normal/"));
        }

        let image = root.querySelector("img[src]");
        return image ? image.absUrl("src").replace("/fallback/", "/normal/").replace(".jpg", ".webp") : "";
    },

    extractStatusFromCardHtml: function(html) {
        let status = this.matchFirst(html, /<strong>\s*Status:\s*<\/strong>\s*<span>([^<]+)<\/span>/i);
        return this.mapStatus(status);
    },

    extractDescription: function(document, html) {
        let meta = this.metaContent(document, "meta[name='description']");
        let desc = this.matchFirst(html, /<strong>\s*Description\s*<\/strong>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
        desc = this.stripHtml(desc);
        if (desc) return desc.replace("NOTE: ", "\n\nNOTE: ");
        return meta.replace(/^Read\s+/i, "").replace(/\s+online for free at Weeb Central$/i, "");
    },

    extractGenres: function(html) {
        let block = this.matchFirst(html, /<strong>\s*(?:Tag\(s\)|Tags?)\s*:\s*<\/strong>([\s\S]*?)<\/(?:div|li)>/i);
        let links = this.extractLinksText(block);
        if (links.length > 0) return links;

        let text = this.stripHtml(block);
        if (!text) return [];
        return text.split(",").map(x => this.cleanText(x)).filter(x => x);
    },

    extractLabelText: function(html, label) {
        return this.cleanText(this.stripHtml(this.matchFirst(html, new RegExp("<strong>\\s*" + label + "\\s*:?\\s*<\\/strong>([\\s\\S]*?)<\\/(?:li|div)>", "i"))));
    },

    extractLabelLinks: function(html, label) {
        let block = this.matchFirst(html, new RegExp("<strong>\\s*" + label + "(?:\\(s\\))?\\s*:?\\s*<\\/strong>([\\s\\S]*?)<\\/(?:li|div)>", "i"));
        let links = this.extractLinksText(block);
        return links.length > 0 ? links : (this.stripHtml(block) ? [this.stripHtml(block)] : []);
    },

    extractLinksText: function(html) {
        let result = [];
        if (!html) return result;
        let re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
        let match;
        while ((match = re.exec(html)) !== null) {
            let text = this.stripHtml(match[1]);
            if (text) result.push(text);
        }
        return result;
    },

    metaContent: function(document, selector) {
        let meta = document.querySelector(selector);
        return meta ? meta.attr("content") : "";
    },

    textOf: function(document, selector) {
        let node = document.querySelector(selector);
        return node ? this.cleanText(node.text()) : "";
    },

    mapStatus: function(status) {
        status = (status || "").toLowerCase();
        if (status.indexOf("ongoing") !== -1) return 1;
        if (status.indexOf("complete") !== -1 || status.indexOf("completed") !== -1) return 2;
        if (status.indexOf("hiatus") !== -1) return 3;
        if (status.indexOf("cancel") !== -1) return 4;
        return 0;
    },

    isMetadataTip: function(value) {
        value = (value || "").toLowerCase();
        return value === "manga" || value === "manhwa" || value === "manhua" || value === "oel" ||
            value === "official translation" || value === "anime adaptation";
    },

    titleFromUrl: function(url) {
        let clean = url.split("?")[0].split("/").filter(x => x);
        let slug = clean.length > 0 ? clean[clean.length - 1] : "";
        return this.cleanText(slug.replace(/-/g, " "));
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

    cleanSearchQuery: function(query) {
        return (query || "").replace(/[!#:(),-]/g, " ").replace(/\s+/g, " ").trim();
    },

    cleanText: function(value) {
        return this.decodeHtml((value || "").replace(/\s+/g, " ").trim());
    },

    stripHtml: function(value) {
        return this.cleanText((value || "").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
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

    parseDate: function(value) {
        if (!value) return 0;
        let time = Date.parse(value);
        return isNaN(time) ? 0 : time;
    },

    getTotalPages: function(query, extraParams, currentPage, html) {
        query = (query || "").trim();
        if (query === "" && extraParams) {
            let known = this.getKnownTotalItems(extraParams);
            if (known > 0) {
                return Math.max(currentPage, Math.ceil(known / this.pageSize));
            }
        }

        let hasNext = html.indexOf("View More Results") !== -1 || html.indexOf("hx-get=") !== -1;
        return hasNext ? currentPage + 1 : currentPage;
    },

    getKnownTotalItems: function(extraParams) {
        if (extraParams && extraParams.included_status && this.knownStatusTotals[extraParams.included_status] > 0) {
            return this.knownStatusTotals[extraParams.included_status];
        }
        return this.knownTotalItems;
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
    }
};
