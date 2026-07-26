var source = {
    name: "Komiku",
    baseUrl: "https://komiku.org",
    apiUrl: "https://api.komiku.org",
    language: "id",
    version: "1.0.0",
    description: "Komiku extension implemented in JavaScript using Jint Engine",
    author: "DesktopKomik",
    iconBackground: "#2E7D32",
    iconForeground: "#FFFFFF",
    isNsfw: false,
    isHasMorePages: true,

    getPopularManga: function(page) {
        return this.getApiMangaPage(page, "?orderby=meta_value_num", 9999);
    },

    getLatestUpdates: function(page) {
        return this.getApiMangaPage(page, "?orderby=modified", 9999);
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

        for (let sourcePage = firstApiPage; collected.length < appPageSize && sourcePage <= sourceTotalPages; sourcePage++) {
            let pageResult = this.getRawApiMangaPage(sourcePage, queryString, sourceTotalPages);
            sourceTotalPages = pageResult.totalPages;

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
            totalPages: Math.max(page, Math.ceil(sourceTotalPages * apiPageSize / appPageSize))
        };
    },

    getRawApiMangaPage: function(page, queryString, estimatedPages) {
        let url = `${this.apiUrl}/manga`;
        if (page > 1) {
            url += `/page/${page}`;
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

    getMangaList: function(page, status) {
        if (status === 1 || status === 2 || status === 4) {
            return this.getStatusMangaList(page, status);
        }
        return this.getPopularManga(page);
    },

    getStatusMangaList: function(page, status) {
        let statusParam = status === 1 ? "ongoing" : "end";
        let queryString = `?statusmanga=${statusParam}&orderby=meta_value_num`;
        
        let result = this.getApiMangaPage(page, queryString, 9999);
        
        if (result && result.items) {
            for (let i = 0; i < result.items.length; i++) {
                result.items[i].status = status;
            }
        }
        
        return result;
    },

    getMangaDetails: function(url) {
        let fullUrl = this.baseUrl + url;
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

        let titleEl = doc.querySelector("h1");
        return {
            title: titleEl ? titleEl.text() : "",
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
        let chapters = [];
        
        let rows = doc.querySelectorAll("#Daftar_Chapter tr");
        for (let row of rows) {
            if (row.querySelector("td.judulseries")) {
                let a = row.querySelector("a");
                if (a) {
                    let href = a.attr("href");
                    let relativeUrl = href;
                    if (href.startsWith(this.baseUrl)) {
                        relativeUrl = href.substring(this.baseUrl.length);
                    }
                    
                    let name = a.text();
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
        let fullUrl = this.baseUrl + chapterUrl;
        let response = fetch(fullUrl);
        if (response.status !== 200) return [];

        let doc = Html.parse(response.body, fullUrl);
        let pages = [];
        let imgEls = doc.querySelectorAll("#Baca_Komik img");
        for (let img of imgEls) {
            let src = img.absUrl("src");
            if (!src) src = img.attr("src");
            if (src) {
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
                    title: titleEl.text(),
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
                    title: titleEl.text().trim(),
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
    }
};
