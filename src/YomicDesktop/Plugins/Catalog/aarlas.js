var source = {
    name: "Aarlas",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/aarlas/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://www.arlas.online",
    apiUrl: "https://www.arlas.online",
    language: "id",
    version: "1.0.0",
    description: "Aarlas extension implemented in JavaScript using Jint Engine",
    author: "DesktopKomik",
    iconBackground: "#ff0080",
    iconForeground: "#FFFFFF",
    isNsfw: false,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],
    isHasMorePages: true,

    getPopularManga: function(page) {
        return this.getBloggerMangaPage(page, "Series", null, "published");
    },

    getLatestUpdates: function(page) {
        return this.getBloggerMangaPage(page, "Series", null, "updated");
    },

    getSearchManga: function(query, page) {
        return this.getBloggerMangaPage(page, "Series", query);
    },

    getBloggerMangaPage: function(page, label, query, orderby) {
        const appPageSize = 14;
        let startIndex = (Math.max(1, page) - 1) * appPageSize + 1;
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

        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: page };

        let json = JSON.parse(response.body);
        let entries = json.feed.entry || [];
        let totalResults = parseInt(json.feed.openSearch$totalResults.$t) || 0;
        let totalPages = Math.ceil(totalResults / appPageSize);

        let items = [];
        for (let entry of entries) {
            let title = entry.title.$t;
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
            if (entry.media$thumbnail) {
                thumbnailUrl = entry.media$thumbnail.url;
                thumbnailUrl = thumbnailUrl.replace(/\/s[0-9]+(-c)?\//, "/w300/");
            }

            let status = 0;
            let categories = entry.category || [];
            for (let cat of categories) {
                let term = (cat.term || "").toLowerCase();
                if (term === "ongoing") {
                    status = 1;
                    break;
                } else if (term === "completed") {
                    status = 2;
                    break;
                }
            }

            items.push({
                title: title,
                url: relativeUrl,
                thumbnailUrl: thumbnailUrl,
                status: status
            });
        }

        return {
            items: items,
            totalPages: Math.max(page, totalPages)
        };
    },

    getMangaList: function(page, status) {
        if (status === 1) {
            return this.getBloggerMangaPage(page, "Ongoing");
        } else if (status === 2 || status === 4) {
            return this.getBloggerMangaPage(page, "Completed");
        }
        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let fullUrl = this.baseUrl + url;
        let response = fetch(fullUrl);
        if (response.status !== 200) return {};

        let doc = Html.parse(response.body, fullUrl);
        
        let titleEl = doc.querySelector("article.oh.a2 header h1");
        let title = titleEl ? titleEl.text().trim() : "";
        
        let thumbnailEl = doc.querySelector("div.grid div.a1 figure img");
        let thumbnailUrl = thumbnailEl ? thumbnailEl.absUrl("src") : "";

        let description = "";
        let synopsisEl = doc.querySelector("#synopsis");
        if (synopsisEl) {
            description += synopsisEl.text().trim();
        }

        let author = "";
        let status = 0; // Unknown=0, Ongoing=1, Completed=2
        
        let statusEl = doc.querySelector("aside.s1 div.y6x11p a[data]");
        if (statusEl) {
            let statusStr = statusEl.text().toLowerCase();
            if (statusStr.includes("ongoing") || statusStr.includes("on going")) {
                status = 1;
            } else if (statusStr.includes("completed") || statusStr.includes("end") || statusStr.includes("tamat")) {
                status = 2;
            }
        }

        let extraInfoRows = doc.querySelectorAll("#extra-info .y6x11p");
        for (let row of extraInfoRows) {
            let text = row.text();
            if (text.includes("Author")) {
                let valEl = row.querySelector("span.dt");
                if (valEl) {
                    author = valEl.text().trim();
                }
            }
        }

        let genres = [];
        let genreEls = doc.querySelectorAll("article.oh.a2 div.mt-15 a.label");
        for (let el of genreEls) {
            genres.push(el.text().trim());
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
        let fullUrl = this.baseUrl + mangaUrl;
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let titleEl = doc.querySelector("article.oh.a2 header h1");
        if (!titleEl) return [];
        let title = titleEl.text().trim();

        let label = title;
        let match = response.body.match(/clwd\.run\(['"]([^'"]+)['"]\)/);
        if (match && match[1]) {
            label = match[1].trim();
        }

        let feedUrl = `${this.apiUrl}/feeds/posts/default/-/${encodeURIComponent(label)}?alt=json&max-results=500`;
        let feedResponse = fetch(feedUrl);
        if (feedResponse.status !== 200) return [];

        let json = JSON.parse(feedResponse.body);
        let entries = json.feed.entry || [];
        
        let chapters = [];
        for (let entry of entries) {
            let categories = entry.category || [];
            let isChapter = false;
            for (let cat of categories) {
                if (cat.term === "Chapter") {
                    isChapter = true;
                    break;
                }
            }
            if (!isChapter) continue;

            let titleSub = entry.title.$t;
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

            chapters.push({
                name: titleSub,
                url: relativeUrl,
                dateUpload: dateUpload
            });
        }
        return chapters;
    },

    getPageList: function(chapterUrl) {
        let fullUrl = this.baseUrl + chapterUrl;
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let pages = [];
        
        let imgEls = doc.querySelectorAll("div.check-box div.separator img");
        if (imgEls.length === 0) {
            imgEls = doc.querySelectorAll("div[data=imageProtection] div.separator img");
        }
        if (imgEls.length === 0) {
            imgEls = doc.querySelectorAll("#post-body div.separator img");
        }
        if (imgEls.length === 0) {
            imgEls = doc.querySelectorAll(".post-body div.separator img");
        }
        if (imgEls.length === 0) {
            imgEls = doc.querySelectorAll("div.separator img");
        }

        for (let img of imgEls) {
            let src = img.absUrl("src");
            if (!src) src = img.attr("src");
            if (src) {
                pages.push(src);
            }
        }
        return pages;
    }
};
