var source = {
    name: "Komiku",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/komiku/res/mipmap-xxhdpi/ic_launcher.png",
    baseUrl: "https://komiku.org",
    apiUrl: "https://api.komiku.org",
    language: "id",
    version: "1.0.1",
    description: "Komiku extension implemented in JavaScript using Jint Engine",
    author: "DesktopKomik",
    iconBackground: "#2E7D32",
    iconForeground: "#FFFFFF",
    isNsfw: false,
    isHasMorePages: true,

    getPopularManga: function(page) {
        return this.getApiMangaPage(page, "?orderby=meta_value_num", 752);
    },

    getLatestUpdates: function(page) {
        return this.getApiMangaPage(page, "?orderby=modified", 500);
    },

    getSearchManga: function(query, page) {
        let queryString = "";
        if (query && query.trim() !== "") {
            queryString = `?s=${encodeURIComponent(query)}`;
        }
        return this.getApiMangaPage(page, queryString, 50);
    },

    getApiMangaPage: function(page, queryString, estimatedPages) {
        const appPageSize = 14;
        const apiPageSize = 10;
        let startIndex = (Math.max(1, page) - 1) * appPageSize;
        let firstApiPage = Math.floor(startIndex / apiPageSize) + 1;
        let offset = startIndex % apiPageSize;
        let collected = [];
        let sourceTotalPages = estimatedPages || 500;
        let sourceTotalItems = sourceTotalPages * apiPageSize;

        for (let sourcePage = firstApiPage; collected.length < appPageSize && sourcePage <= sourceTotalPages; sourcePage++) {
            let pageResult = this.getRawApiMangaPage(sourcePage, queryString, sourceTotalPages);
            sourceTotalPages = pageResult.totalPages;
            sourceTotalItems = sourceTotalPages * apiPageSize;

            let items = pageResult.items;
            if (sourcePage === firstApiPage && offset > 0) {
                items = items.slice(offset);
            }

            collected = collected.concat(items);
            if (pageResult.items.length === 0) {
                break;
            }
        }

        return {
            items: collected.slice(0, appPageSize),
            totalPages: Math.max(1, Math.ceil(sourceTotalItems / appPageSize))
        };
    },

    getRawApiMangaPage: function(page, queryString, estimatedPages) {
        let url = `${this.apiUrl}/manga`;
        if (page > 1) {
            url += `/page/${page}/`;
        }
        url += queryString || "";
        
        let response = fetch(url);
        if (response.status !== 200) return { items: [], totalPages: page };
        
        let doc = Html.parse(response.body, url);
        let items = this.parseMangaList(doc);
        
        // Komiku uses infinite scroll, so exact total pages is not provided.
        let hasNext = doc.querySelector("[hx-get]") != null;
        let total = hasNext ? Math.max(page + 1, estimatedPages || 500) : page;
        
        return {
            items: items,
            totalPages: total
        };
    },


    getMangaList: function(page, status, genre, type) {
        let params = [];
        let isFiltered = false;

        // 1. Status Filter
        if (status === 1) {
            params.push("statusmanga=ongoing");
        } else if (status === 2) {
            params.push("statusmanga=end");
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

            let genresQuery = arr.map(g => g.toLowerCase().replace(/\s+/g, "-")).filter(Boolean);
            if (genresQuery.length > 0) {
                params.push("genre=" + encodeURIComponent(genresQuery.join(",")));
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

            let typesQuery = arr.map(t => t.toLowerCase()).filter(Boolean);
            if (typesQuery.length > 0) {
                params.push("tipe=" + encodeURIComponent(typesQuery.join(",")));
                isFiltered = true;
            }
        }

        if (params.length > 0) {
            let queryString = "?" + params.join("&") + "&orderby=meta_value_num";
            
            // Use exact probed values for estimated pages
            let estimatedPages = 752;
            if (status === 1) {
                estimatedPages = 651;
            } else if (status === 2) {
                estimatedPages = 58;
            }
            if (isFiltered) {
                estimatedPages = 50; // Filtered lists usually have much fewer pages
            }
            
            let result = this.getApiMangaPage(page, queryString, estimatedPages);
            if (result && result.items && (status === 1 || status === 2)) {
                for (let i = 0; i < result.items.length; i++) {
                    result.items[i].status = status;
                }
            }
            return result;
        }

        return this.getPopularManga(page);
    },

    getMangaDetails: function(url) {
        let fullUrl = url.indexOf('http') === 0 ? url : (this.baseUrl + (url.charAt(0) === '/' ? url : '/' + url));
        let response = fetch(fullUrl);
        if (response.status !== 200) return {};

        let doc = Html.parse(response.body, fullUrl);
        
        // Description
        let description = "";
        let sinopsisEl = doc.querySelector("#Sinopsis > p");
        if (sinopsisEl) {
            description += sinopsisEl.text();
        }
        
        let rows = doc.querySelectorAll("table.inftable tr");
        let author = "";
        let status = 0; // Unknown=0, Ongoing=1, Completed=2
        let genres = [];
        let thumbnailEl = doc.querySelector("div.ims > img");
        let thumbnailUrl = thumbnailEl ? thumbnailEl.absUrl("src") : "";

        for (let row of rows) {
            let cells = row.querySelectorAll("td");
            if (cells.length >= 2) {
                let key = cells[0].text();
                let val = cells[1].text();
                if (key.includes("Judul Indonesia")) {
                    if (val.trim() !== "") {
                        description += "\n\nJudul Indonesia: " + val.trim();
                    }
                } else if (key.includes("Pengarang") || key.includes("Komikus") || key.includes("Author")) {
                    author = val.trim();
                } else if (key.includes("Status")) {
                    let statusStr = val.trim().toLowerCase();
                    if (statusStr.includes("ongoing") || statusStr.includes("on going")) {
                        status = 1;
                    } else if (statusStr.includes("end") || statusStr.includes("completed")) {
                        status = 2;
                    }
                }
            }
        }

        // Genres
        let genreEls = doc.querySelectorAll("ul.genre li.genre a span");
        for (let el of genreEls) {
            genres.push(el.text());
        }

        let titleEl = doc.querySelector("h1 span[itemprop='name']") || doc.querySelector("h1");
        let title = this.cleanTitle(titleEl ? titleEl.text() : "");

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

    cleanTitle: function(title) {
        if (!title) return "";
        let clean = title.trim();
        // Remove "Komik " or "Manga/Manhwa/Manhua " prefix
        clean = clean.replace(/^(?:komik|manga|manhwa|manhua)\s+/i, "");
        // Remove trailing " Indo", " Bahasa Indonesia", " Sub Indo"
        clean = clean.replace(/\s+(?:indo|bahasa indonesia|sub indo)$/i, "");
        return clean.trim();
    },

    getChapterList: function(mangaUrl) {
        let fullUrl = mangaUrl.indexOf('http') === 0 ? mangaUrl : (this.baseUrl + (mangaUrl.charAt(0) === '/' ? mangaUrl : '/' + mangaUrl));
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let chapters = [];
        
        let rows = doc.querySelectorAll("tbody#daftarChapter tr, #Daftar_Chapter tr, #Chapter tr, tr");
        for (let row of rows) {
            let judulEl = row.querySelector("td.judulseries");
            if (judulEl) {
                let a = judulEl.querySelector("a");
                if (a) {
                    let href = a.attr("href");
                    let relativeUrl = href;
                    if (href && href.startsWith(this.baseUrl)) {
                        relativeUrl = href.substring(this.baseUrl.length);
                    }
                    
                    let name = a.text().trim();
                    let dateUpload = 0;
                    
                    let dateEl = row.querySelector("td.tanggalseries");
                    if (dateEl) {
                        dateUpload = this.parseDate(dateEl.text());
                    }
                    
                    chapters.push({
                        name: name,
                        url: relativeUrl,
                        dateUpload: dateUpload
                    });
                }
            }
        }
        return chapters;
    },

    getPageList: function(chapterUrl) {
        let fullUrl = chapterUrl.indexOf('http') === 0 ? chapterUrl : (this.baseUrl + (chapterUrl.charAt(0) === '/' ? chapterUrl : '/' + chapterUrl));
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let pages = [];
        let imgEls = doc.querySelectorAll("#Baca_Komik img, div.content-wrap img.klazy, img.klazy");
        for (let img of imgEls) {
            let src = img.absUrl("data-src") || img.absUrl("src") || img.attr("data-src") || img.attr("src");
            if (src && !src.includes("komiku-promosi") && !src.includes("banner") && !src.includes("iklan")) {
                pages.push(src);
            }
        }
        return pages;
    },

    parseMangaList: function(doc) {
        let mangas = [];
        let items = doc.querySelectorAll("div.bge");
        for (let item of items) {
            let titleEl = item.querySelector("h3");
            let aEl = item.querySelector("a");
            let imgEl = item.querySelector("img");
            
            if (titleEl && aEl) {
                let href = aEl.attr("href");
                let relativeUrl = href;
                if (href.startsWith(this.baseUrl)) {
                    relativeUrl = href.substring(this.baseUrl.length);
                }
                
                mangas.push({
                    title: this.cleanTitle(titleEl.text()),
                    url: relativeUrl,
                    thumbnailUrl: imgEl ? imgEl.absUrl("src") : ""
                });
            }
        }
        return mangas;
    },

    parseDirectoryMangaList: function(doc) {
        let mangas = [];
        let items = doc.querySelectorAll("article.manga-card");
        for (let item of items) {
            let titleEl = item.querySelector("h4 a");
            let aEl = item.querySelector("a");
            let imgEl = item.querySelector("img");
            let metaEl = item.querySelector("p.meta");

            if (titleEl && aEl) {
                let href = aEl.attr("href");
                let relativeUrl = href;
                if (href.startsWith(this.baseUrl)) {
                    relativeUrl = href.substring(this.baseUrl.length);
                }

                let status = 0;
                let metaText = metaEl ? metaEl.text().toLowerCase() : "";
                if (metaText.includes("status: ongoing")) {
                    status = 1;
                } else if (metaText.includes("status: end") || metaText.includes("status: tamat") || metaText.includes("status: completed")) {
                    status = 2;
                }

                let thumbnailUrl = "";
                if (imgEl) {
                    thumbnailUrl = imgEl.absUrl("data-src");
                    if (!thumbnailUrl) thumbnailUrl = imgEl.absUrl("src");
                }

                mangas.push({
                    title: this.cleanTitle(titleEl.text()),
                    url: relativeUrl,
                    thumbnailUrl: thumbnailUrl,
                    status: status
                });
            }
        }
        return mangas;
    },

    parseTotalPages: function(doc, currentPage) {
        let pageInfoEls = doc.querySelectorAll(".page-info");
        for (let el of pageInfoEls) {
            let text = el.text();
            let match = text.match(/Halaman\s+\d+\s+dari\s+(\d+)/i);
            if (match) {
                return parseInt(match[1]);
            }
        }

        let maxPage = currentPage;
        let links = doc.querySelectorAll(".pagination a");
        for (let link of links) {
            let text = link.text().trim();
            let value = parseInt(text);
            if (!isNaN(value) && value > maxPage) {
                maxPage = value;
            }
        }
        return maxPage;
    },

    parseDate: function(dateStr) {
        if (!dateStr) return 0;
        dateStr = dateStr.trim();
        
        if (dateStr.includes("lalu")) {
            let parts = dateStr.split(" ");
            let val = parseInt(parts[0]);
            let unit = parts[1];
            
            let date = new Date();
            if (unit === "jam") {
                date.setHours(date.getHours() - val);
            } else if (unit === "menit") {
                date.setMinutes(date.getMinutes() - val);
            } else if (unit === "detik") {
                // Keep current
            }
            return date.getTime();
        } else {
            let parts = dateStr.split("/");
            if (parts.length === 3) {
                let day = parseInt(parts[0]);
                let month = parseInt(parts[1]) - 1;
                let year = parseInt(parts[2]);
                let date = new Date(year, month, day);
                return date.getTime();
            }
        }
        return 0;
    },

    genres: [
        "Academy", "Action", "Adaptation", "Adult", "Adventure", "apocalypse", "Beasts", "Blacksmith",
        "Comedy", "Comic", "Cooking", "Crime", "Crossdressing", "Dark Fantasy", "Demon", "Demons",
        "Doujinshi", "Drama", "Ecchi", "Entertainment", "Fantasy", "Fight", "Game", "Gender Bender",
        "Genderswap", "Genius", "Ghosts", "Gore", "Gyaru", "Harem", "Hentai", "Historical",
        "Horror", "Isekai", "Josei", "Knight", "Long Strip", "Magic", "Magical Girls", "Manga",
        "Mangatoon", "Manhwa", "Martial Art", "Martial Arts", "Mature", "MC Rebirth", "Mecha",
        "Medical", "Military", "Monster", "Monster girls", "Monsters", "Murim", "Music",
        "Mystery", "Office Workers", "One Shot", "Oneshot", "Police", "Psychological", "Regression",
        "Reincarnation", "Revenge", "Romance", "School", "School life", "Sci-fi", "Seinen",
        "Sexual Violence", "Shotacon", "Shoujo", "Shoujo Ai", "Shoujo(G)", "Shounen", "Shounen Ai",
        "Slice of Life", "Slow Life", "Smut", "Sport", "Sports", "Strategy", "Super Power",
        "Supernatural", "Survival", "Sword Fight", "Sword Master", "Swormanship", "System",
        "Thriller", "Time Travel", "Tragedy", "Trauma", "Vampire", "Video Games", "Villainess",
        "Violence", "Web Comic", "Webtoon", "Webtoons", "Xianxia", "Xuanhuan", "Yuri"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua"
    ]
};
