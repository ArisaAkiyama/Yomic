var source = {
    id: 3639673976007021338,
    name: "Kiryuu",
    baseUrl: "https://v7.kiryuu.to",
    apiUrl: "https://v7.kiryuu.to/wp-json/wp/v2",
    language: "id",
    version: "1.0.3",
    description: "Baca komik Bahasa Indonesia dari Kiryuu",
    author: "DesktopKomik",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/kiryuu/res/mipmap-xxhdpi/ic_launcher.png",
    iconBackground: "#3b0764",
    iconForeground: "#f5d0fe",
    isNsfw: false,
    isHasMorePages: true,

    pageSize: 24,
    unclassifiedMangaCount: 8,

    getPopularManga: function(page) {
        return this.getRestMangaPage(page, "", this.resolveTotalItems(0));
    },

    getLatestUpdates: function(page) {
        return this.getRestMangaPage(page, "&orderby=modified", this.resolveTotalItems(0));
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);
        return this.getRestMangaPage(page, "&search=" + encodeURIComponent(query));
    },

    getMangaList: function(page, status, genre, type) {
        let extraQuery = "";
        let isFiltered = false;

        // 1. Status Filter
        if (status === 1) {
            extraQuery += "&manga-status=8684";
        } else if (status === 2) {
            extraQuery += "&manga-status=8680";
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
            
            let genreIds = [];
            for (let i = 0; i < arr.length; i++) {
                let id = this.genreMap[arr[i]];
                if (id) genreIds.push(id);
            }
            if (genreIds.length > 0) {
                extraQuery += "&genre=" + genreIds.join(",");
                isFiltered = true;
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

            let typeIds = [];
            for (let i = 0; i < arr.length; i++) {
                let id = this.typeMap[arr[i]];
                if (id) typeIds.push(id);
            }
            if (typeIds.length > 0) {
                extraQuery += "&manga-type=" + typeIds.join(",");
                isFiltered = true;
            }
        }

        if (extraQuery) {
            // Only pass totalItems estimate if we are only filtering by status and not doing complex multi-filtering
            let totalItems = (!isFiltered && (status === 1 || status === 2)) ? this.resolveTotalItems(status) : 0;
            return this.getRestMangaPage(page, extraQuery, totalItems);
        }
        return this.getPopularManga(page);
    },

    getRestMangaPage: function(page, extraQuery, totalItems) {
        page = Math.max(1, page || 1);
        let url = this.apiUrl + "/manga?per_page=" + this.pageSize + "&page=" + page + "&_embed=wp:featuredmedia" + (extraQuery || "");
        let data = this.getJson(url);
        if (!data || !data.length) return { items: [], totalPages: page };

        let items = [];
        for (let i = 0; i < data.length; i++) {
            let manga = data[i];
            let link = manga.link || "";
            items.push({
                title: this.cleanText(this.valueAt(manga, ["title", "rendered"]) || this.titleFromUrl(link)),
                url: this.relativeUrl(link),
                thumbnailUrl: this.extractEmbeddedCover(manga),
                status: this.extractPostStatus(manga),
                source: this.id
            });
        }

        return {
            items: items,
            totalPages: totalItems ? Math.max(1, Math.ceil(totalItems / this.pageSize)) : (items.length >= this.pageSize ? page + 1 : page)
        };
    },

    getMangaDetails: function(url) {
        let absUrl = this.absoluteUrl(url);
        let slug = this.extractMangaSlug(absUrl);
        let data = this.getJson(this.apiUrl + "/manga?slug=" + encodeURIComponent(slug) + "&_embed=wp:featuredmedia");
        let manga = data && data.length ? data[0] : null;

        if (manga) {
            return {
                title: this.cleanText(this.valueAt(manga, ["title", "rendered"]) || this.titleFromUrl(absUrl)),
                url: this.relativeUrl(manga.link || absUrl),
                thumbnailUrl: this.extractEmbeddedCover(manga),
                author: "",
                status: this.extractPostStatus(manga),
                description: this.stripHtml(this.valueAt(manga, ["content", "rendered"]) || this.valueAt(manga, ["excerpt", "rendered"]) || ""),
                genre: this.extractClassListValues(manga.class_list || [], "genre-"),
                source: this.id
            };
        }

        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return {};
        let doc = Html.parse(html, absUrl);
        return {
            title: this.textOf(doc, "h1") || this.titleFromUrl(absUrl),
            url: this.relativeUrl(absUrl),
            thumbnailUrl: this.attrAbsOf(doc, "article img.wp-post-image, img.wp-post-image", "src"),
            author: "",
            status: this.mapStatus(this.matchFirst(html, /status-([a-z-]+)/i)),
            description: this.stripHtml(this.matchFirst(html, /<div[^>]+data-slot="panel"[^>]*>([\s\S]*?)<div id="chapter-list"/i)),
            genre: [],
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        let mangaId = this.extractMangaId(mangaUrl);
        if (!mangaId) return this.parseChapterListFromDetail(mangaUrl);

        let url = this.baseUrl + "/wp-admin/admin-ajax.php?manga_id=" + encodeURIComponent(mangaId) + "&page=1&action=chapter_list";
        let html = this.getHtml(url);
        let chapters = this.parseChapterListHtml(html, url);
        return chapters.length ? chapters : this.parseChapterListFromDetail(mangaUrl);
    },

    getPageList: function(chapterUrl) {
        let absUrl = this.absoluteUrl(chapterUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];

        let doc = Html.parse(html, absUrl);
        let container = doc.querySelector("section[data-image-data], #readerarea, .readerarea");
        let images = container ? container.querySelectorAll("img") : doc.querySelectorAll("main img, #readerarea img");
        
        let pages = [];
        let seen = {};
        for (let i = 0; i < images.length; i++) {
            let src = images[i].absUrl("src") || images[i].absUrl("data-src") || images[i].absUrl("data-lazy-src");
            if (!src) continue;
            
            let urlLower = src.toLowerCase();
            if (urlLower.indexOf("logo-kiryuu") !== -1 || urlLower.indexOf("cropped-logo") !== -1) continue;
            if (urlLower.indexOf("banner-kiryuu") !== -1 || (urlLower.indexOf("kiryuu.io") !== -1 && urlLower.indexOf("cdn.kiryuu.io") === -1)) continue;
            if (urlLower.indexOf("avatar") !== -1 || urlLower.indexOf("gravatar.com") !== -1) continue;

            if (!seen[src]) {
                seen[src] = true;
                pages.push(src + "|Referer=" + absUrl);
            }
        }

        if (pages.length === 0) {
            let main = this.matchFirst(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || html;
            let re = /https?:\/\/[^"'<>\s]+\.(?:jpg|jpeg|png|webp|avif)(?:\?[^"'<>\s]*)?/gi;
            let match;
            while ((match = re.exec(main)) !== null) {
                let imageUrl = this.decodeHtml(match[0]).replace(/\\\//g, "/");
                if (this.isReaderImage(imageUrl) && !seen[imageUrl]) {
                    seen[imageUrl] = true;
                    pages.push(imageUrl + "|Referer=" + absUrl);
                }
            }
        }

        return pages;
    },

    parseChapterListFromDetail: function(mangaUrl) {
        let absUrl = this.absoluteUrl(mangaUrl);
        let html = this.getHtml(absUrl);
        if (!html || this.isBlockedHtml(html)) return [];
        let chapters = this.parseChapterListHtml(html, absUrl);
        return this.uniqueChapters(chapters);
    },

    parseChapterListHtml: function(html, baseUrl) {
        let chapters = [];
        let re = /<a\b[^>]+href=["']([^"']*\/manga\/[^"']*\/chapter-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
        let match;

        while ((match = re.exec(html || "")) !== null) {
            let href = this.decodeHtml(match[1]).trim();
            let name = this.extractChapterName(match[2]) || this.titleFromUrl(href);
            if (!href || !name) continue;
            chapters.push({
                name: name,
                url: this.relativeUrl(this.toAbsolute(href, baseUrl)),
                dateUpload: this.parseDate(this.extractDateNear(html, match.index))
            });
        }

        return this.uniqueChapters(chapters);
    },

    uniqueChapters: function(chapters) {
        let seen = {};
        let out = [];
        for (let i = 0; i < chapters.length; i++) {
            let chapter = chapters[i];
            if (!chapter.url || seen[chapter.url]) continue;
            seen[chapter.url] = true;
            out.push(chapter);
        }
        return out;
    },

    resolveTotalItems: function(status) {
        let terms = this.getJson(this.apiUrl + "/manga-status?per_page=100&_fields=id,count,slug");
        if (!terms || !terms.length) {
            if (status === 1) return 8033;
            if (status === 2) return 677;
            return 8750;
        }

        let total = 0;
        let ongoing = 0;
        let completed = 0;
        for (let i = 0; i < terms.length; i++) {
            let count = terms[i].count || 0;
            let slug = terms[i].slug || "";
            total += count;
            if (slug === "ongoing") ongoing = count;
            if (slug === "completed") completed = count;
        }

        if (status === 1) return ongoing;
        if (status === 2) return completed;
        return total + this.unclassifiedMangaCount;
    },

    extractMangaId: function(mangaUrl) {
        let absUrl = this.absoluteUrl(mangaUrl);
        let slug = this.extractMangaSlug(absUrl);
        if (!slug) return 0;
        let data = this.getJson(this.apiUrl + "/manga?slug=" + encodeURIComponent(slug) + "&_fields=id");
        return data && data.length && data[0].id ? data[0].id : 0;
    },

    extractEmbeddedCover: function(manga) {
        let media = this.valueAt(manga, ["_embedded", "wp:featuredmedia"]);
        if (media && media.length) {
            let item = media[0];
            return this.valueAt(item, ["media_details", "sizes", "card-thumbnail", "source_url"]) ||
                this.valueAt(item, ["media_details", "sizes", "medium", "source_url"]) ||
                item.source_url || "";
        }
        return "";
    },

    extractPostStatus: function(manga) {
        let classes = manga.class_list || [];
        for (let i = 0; i < classes.length; i++) {
            let status = this.mapStatus(classes[i]);
            if (status !== 0) return status;
        }
        return 0;
    },

    extractClassListValues: function(classes, prefix) {
        let values = [];
        let seen = {};
        for (let i = 0; i < classes.length; i++) {
            let value = classes[i] || "";
            if (value.indexOf(prefix) !== 0) continue;
            value = this.cleanText(value.substring(prefix.length).replace(/-/g, " "));
            if (value && !seen[value]) {
                seen[value] = true;
                values.push(value);
            }
        }
        return values;
    },

    extractDateNear: function(html, index) {
        let block = (html || "").substring(index, Math.min((html || "").length, index + 1200));
        return this.matchFirst(block, /<time[^>]+datetime=["']([^"']+)["']/i);
    },

    extractChapterName: function(anchorHtml) {
        let name = this.stripHtml(this.matchFirst(anchorHtml, /<span\b[^>]*>([\s\S]*?)<\/span>/i));
        if (!name) name = this.stripHtml(anchorHtml);
        return name.replace(/\s+(?:\d+\s+)?(?:second|minute|hour|day|week|month|year)s?\s+ago\s*$/i, "").trim();
    },

    isReaderImage: function(url) {
        url = (url || "").toLowerCase();
        if (url.indexOf(".gif") !== -1) return false;
        if (url.indexOf("logo-kiryuu") !== -1 || url.indexOf("cropped-logo") !== -1) return false;
        if (url.indexOf("banner-kiryuu") !== -1 || (url.indexOf("kiryuu.io") !== -1 && url.indexOf("cdn.kiryuu.io") === -1)) return false;
        if (url.indexOf("/wp-content/uploads/") !== -1 && url.indexOf("cdn.uqni.net") === -1 && url.indexOf("yuucdn.com") === -1) return false;
        return url.indexOf("cdn.uqni.net") !== -1 || url.indexOf("yuucdn.com") !== -1 || url.indexOf("cdn.kiryuu.io") !== -1 || url.indexOf("/uploads/") !== -1 || url.indexOf("/img/") !== -1;
    },

    extractMangaSlug: function(url) {
        let clean = this.relativeUrl(this.absoluteUrl(url)).split("?")[0].split("#")[0];
        let match = /\/manga\/([^\/]+)/i.exec(clean);
        return match ? match[1] : "";
    },

    titleFromUrl: function(url) {
        let parts = (url || "").split("?")[0].split("/").filter(x => x);
        return this.cleanText((parts.length ? parts[parts.length - 1] : "").replace(/\.\d+$/g, "").replace(/[-_]/g, " "));
    },

    mapStatus: function(status) {
        status = (status || "").toLowerCase();
        if (status.indexOf("ongoing") !== -1) return 1;
        if (status.indexOf("complete") !== -1 || status.indexOf("completed") !== -1 || status.indexOf("end") !== -1) return 2;
        return 0;
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
            .replace(/\\u0026/g, "&")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, "\"")
            .replace(/&#039;/g, "'")
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ");
    },

    valueAt: function(obj, path) {
        let current = obj;
        for (let i = 0; i < path.length; i++) {
            if (current === null || current === undefined) return "";
            current = current[path[i]];
        }
        return current === null || current === undefined ? "" : current;
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
        return this.baseUrl + (url.charAt(0) === "/" ? url : "/" + url);
    },

    toAbsolute: function(url, base) {
        if (!url) return "";
        url = url.trim();
        if (url.indexOf("http://") === 0 || url.indexOf("https://") === 0) return url;
        if (url.indexOf("//") === 0) return "https:" + url;
        return this.absoluteUrl(url);
    },

    relativeUrl: function(url) {
        if (!url) return "";
        return url.indexOf(this.baseUrl) === 0 ? url.substring(this.baseUrl.length) : url;
    },

    getHtml: function(url) {
        let response = fetch(url);
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

    genres: [
        "4-Koma", "Action", "Adaptation", "Adult", "Adventure", "Animals", "Anthology", "Antihero", 
        "apocalypse", "Award Winning", "Beasts", "Bodyswap", "Boys' Love", "Bully", "Cartoon", 
        "Childhood Friends", "Comedy", "Comic", "Cooking", "Crime", "Crossdressing", "Dance", 
        "Dark Fantasy", "Delinquent", "Delinquents", "Dementia", "Demon", "Demons", "Doujinshi", 
        "Drama", "Dungeons", "Ecchi", "Emperor's daughter", "Entertainment", "Fan-Colored", 
        "Fantas", "Fantasy", "Fetish", "Full Color", "Game", "Games", "Gang", "Gender Bender", 
        "Genderswap", "Ghosts", "Girls", "Girls' Love", "gore", "gorre", "Gyaru", "Harem", 
        "Hentai", "Hero", "Historical", "Horror", "Imageset", "Incest", "Isekai", "Josei", 
        "Josei(W)", "Kids", "Leveling", "Loli", "Lolicon", "Long Strip", "Mafia", "Magi", 
        "Magic", "Magical Girls", "Martial Art", "Martial Arts", "Mature", "Mecha", "Medical", 
        "Military", "Mirror", "Modern", "Monster Girls", "Monsters", "Murim", "Music", 
        "Mystery", "Necromancer", "Ninja", "Non-human", "Office Workers", "Official Colored", 
        "One-Shot", "Oneshot", "Overpowered", "Parody", "Pets", "Philosophical", "Police", 
        "Post-Apocalyptic", "Project", "Psychological", "Regression", "Reincarnation", "Revenge",
        "Reverse Harem", "Reverse Isekai", "Romance", "Royalty", "School", "School Life", 
        "Sci-fi", "Seinen", "Seinen(M)", "Seinin", "Sexual Violence", "Shotacon", "Shoujo", 
        "Shoujo Ai", "Shoujo(G)", "Shounen", "Shounen Ai", "Shounen(B)", "Shounn", "Showbiz", 
        "Slice of Life", "Smut", "Space", "Sport", "Sports", "Super Power", "Superhero", 
        "Supernatural", "Supranatural", "Survival", "System", "Thriller", "Time Travel", 
        "Traditional Games", "Tragedy", "Transmigration", "Vampire", "Vampires", "Video Games", 
        "Villainess", "Violence", "Virtual Reality", "Web Comic", "Webtoon", "Webtoons", 
        "Wuxia", "Xianxia", "Xuanhuan", "Yaoi", "Yuri", "Zombies"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua", "Webtoon", "Comic", "Mangatoon", "Novel"
    ],

    genreMap: {
        "4-Koma": 2400, "Action": 2, "Adaptation": 3475, "Adult": 128, "Adventure": 3, "Animals": 8050,
        "Anthology": 4701, "Antihero": 8431, "apocalypse": 20525, "Award Winning": 7613, "Beasts": 8555,
        "Bodyswap": 8052, "Boys' Love": 7695, "Bully": 6565, "Cartoon": 8053, "Childhood Friends": 8171,
        "Comedy": 14, "Comic": 8054, "Cooking": 1372, "Crime": 5175, "Crossdressing": 5820, "Dance": 7980,
        "Dark Fantasy": 6264, "Delinquent": 6566, "Delinquents": 7578, "Dementia": 8055, "Demon": 5464,
        "Demons": 37, "Doujinshi": 902, "Drama": 11, "Dungeons": 8056, "Ecchi": 66, "Emperor's daughter": 8087,
        "Entertainment": 20392, "Fan-Colored": 8088, "Fantas": 8462, "Fantasy": 4, "Fetish": 8057,
        "Full Color": 4460, "Game": 1494, "Games": 4242, "Gang": 6848, "Gender Bender": 84, "Genderswap": 5614,
        "Ghosts": 7600, "Girls": 7669, "Girls' Love": 6119, "gore": 2167, "gorre": 6286, "Gyaru": 6343,
        "Harem": 23, "Hentai": 21217, "Hero": 7497, "Historical": 24, "Horror": 67, "Imageset": 8058,
        "Incest": 5620, "Isekai": 15, "Josei": 78, "Josei(W)": 7675, "Kids": 8017, "Leveling": 3434,
        "Loli": 1315, "Lolicon": 852, "Long Strip": 5623, "Mafia": 7599, "Magi": 7330, "Magic": 38,
        "Magical Girls": 5569, "Martial Art": 1720, "Martial Arts": 18, "Mature": 30, "Mecha": 329,
        "Medical": 1709, "Military": 3510, "Mirror": 6850, "Modern": 4376, "Monster Girls": 5657,
        "Monsters": 5656, "Murim": 5587, "Music": 2024, "Mystery": 7, "Necromancer": 4377, "Ninja": 8059,
        "Non-human": 8060, "Office Workers": 7614, "Official Colored": 5777, "One-Shot": 3956,
        "Oneshot": 3419, "Overpowered": 4378, "Parody": 3872, "Pets": 4379, "Philosophical": 6455,
        "Police": 4975, "Post-Apocalyptic": 6122, "Project": 5840, "Psychological": 92, "Regression": 5862,
        "Reincarnation": 40, "Revenge": 7676, "Reverse Harem": 7655, "Reverse Isekai": 8061, "Romance": 8,
        "Royalty": 7671, "School": 1194, "School Life": 12, "Sci-fi": 49, "Seinen": 19, "Seinen(M)": 7677,
        "Seinin": 5182, "Sexual Violence": 5622, "Shotacon": 1519, "Shoujo": 9, "Shoujo Ai": 240,
        "Shoujo(G)": 7672, "Shounen": 5, "Shounen Ai": 97, "Shounen(B)": 7673, "Shounn": 6500,
        "Showbiz": 8015, "Slice of Life": 20, "Smut": 1070, "Space": 8062, "Sport": 8010, "Sports": 166,
        "Super Power": 3613, "Superhero": 4479, "Supernatural": 21, "Supranatural": 5599, "Survival": 5886,
        "System": 3493, "Thriller": 1124, "Time Travel": 6056, "Traditional Games": 8063, "Tragedy": 36,
        "Transmigration": 8051, "Vampire": 4024, "Vampires": 5617, "Video Games": 5616, "Villainess": 7150,
        "Violence": 5660, "Virtual Reality": 5615, "Web Comic": 5626, "Webtoon": 7674, "Webtoons": 701,
        "Wuxia": 378, "Xianxia": 20177, "Xuanhuan": 8064, "Yaoi": 903, "Yuri": 224, "Zombies": 5877
    },

    typeMap: {
        "Manga": 8683, "Manhwa": 8679, "Manhua": 8687, "Webtoon": 7674, "Comic": 11540,
        "Mangatoon": 21390, "Novel": 12658
    }
};
