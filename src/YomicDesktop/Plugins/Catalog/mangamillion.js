var source = {
    name: "MangaMillion",
    baseUrl: "https://mangamillion.shueisha.co.jp",
    iconUrl: "https://www.google.com/s2/favicons?domain=shueisha.co.jp&sz=128",
    apiUrl: "https://api.mangamillion.shueisha.co.jp",
    language: "en",
    version: "1.0.0",
    description: "Official Shueisha MANGA MILLION - 400+ titles FREE in 100+ languages",
    author: "DesktopKomik",
    iconBackground: "#e60026",
    iconForeground: "#ffffff",
    isNsfw: false,
    isHasMorePages: false,
    pageSize: 24,

    token: null,

    genres: [
        "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
        "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Sports",
        "Supernatural", "Thriller"
    ],

    getPopularManga: function(page) {
        return this.getMangaListInternal(page, "TOTAL_VIEW_COUNT", "");
    },

    getLatestUpdates: function(page) {
        return this.getMangaListInternal(page, "UPDATED_AT", "");
    },

    getSearchManga: function(query, page) {
        return this.getMangaListInternal(page, "", query || "");
    },

    getMangaList: function(page, status, genre, type) {
        return this.getMangaListInternal(page, "TOTAL_VIEW_COUNT", "");
    },

    getMangaListInternal: function(page, order, query) {
        let url = this.apiUrl + "/api/manga_list?service_language=en&avif_enable=false";
        if (query && query.trim()) {
            url = this.apiUrl + "/api/search?service_language=en&avif_enable=false&keyword=" + encodeURIComponent(query.trim());
        } else if (order) {
            url += "&order=" + encodeURIComponent(order);
        }

        let response = this.fetchApi(url, "GET");
        if (!response || response.status !== 200) return { items: [], totalPages: 1 };

        let body = response.body || "";
        let allItems = [];
        let seen = {};

        let matches = body.match(/https:\/\/img\.mangamillion\.shueisha\.co\.jp\/jpn\/image\/original_title_cover\/(\d+)\.webp[^\x00-\x1f"'\s]*\x1a[\x01-\x7f]([^\x00-\x1f\x7f-\xff]+)/g) || [];
        for (let i = 0; i < matches.length; i++) {
            let fullStr = matches[i];
            let m = fullStr.match(/(https:\/\/img\.mangamillion\.shueisha\.co\.jp\/jpn\/image\/original_title_cover\/(\d+)\.webp[^\x00-\x1f"'\s]*)\x1a[\x01-\x7f]([^\x00-\x1f\x7f-\xff]+)/);
            if (!m) continue;
            let fullCoverUrl = m[1];
            let id = m[2];
            let titleName = m[3].trim();
            if (titleName.includes('"')) {
                titleName = titleName.split('"')[0].trim();
            }
            titleName = titleName.replace(/^[^a-zA-Z0-9#]+/, '').trim();

            if (!seen[id] && titleName && titleName.length > 1) {
                seen[id] = true;
                allItems.push({
                    title: titleName,
                    url: "/en/title/" + id,
                    thumbnailUrl: fullCoverUrl + "|Referer=" + this.baseUrl + "/",
                    status: 1
                });
            }
        }

        // Fallback for any items without clean title match
        let coverMatches = body.match(/https:\/\/img\.mangamillion\.shueisha\.co\.jp\/jpn\/image\/original_title_cover\/(\d+)\.webp[^\x00-\x1f"'\s]*/g) || [];
        for (let i = 0; i < coverMatches.length; i++) {
            let fullCoverUrl = coverMatches[i];
            let idMatch = fullCoverUrl.match(/original_title_cover\/(\d+)\./);
            if (!idMatch) continue;
            let id = idMatch[1];
            if (!seen[id]) {
                seen[id] = true;
                allItems.push({
                    title: "Manga #" + id,
                    url: "/en/title/" + id,
                    thumbnailUrl: fullCoverUrl + "|Referer=" + this.baseUrl + "/",
                    status: 1
                });
            }
        }

        let currentPage = page && page > 0 ? page : 1;
        let perPage = this.pageSize || 24;
        let totalPages = Math.max(1, Math.ceil(allItems.length / perPage));

        let start = (currentPage - 1) * perPage;
        let pagedItems = allItems.slice(start, start + perPage);

        return { items: pagedItems, totalPages: totalPages };
    },

    getMangaDetails: function(mangaUrl) {
        let titleId = this.extractTitleId(mangaUrl);

        // Fetch HTML page first for clean title, author, cover, description
        let htmlRes = this.fetchApi(this.baseUrl + "/en/title/" + titleId, "GET");
        if (htmlRes && htmlRes.status === 200) {
            let html = htmlRes.body || "";
            let titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
            let titleTag = titleTagMatch ? titleTagMatch[1] : "";

            let titleName = "";
            let author = "";
            if (titleTag.includes(" - ")) {
                let parts = titleTag.split(" - ");
                titleName = parts[0].trim();
                if (parts[1]) author = parts[1].split("|")[0].trim();
            }

            let ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
            let coverUrl = ogImageMatch ? ogImageMatch[1].replace(/&amp;/g, '&') : "";

            let metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
            let description = metaDescMatch ? metaDescMatch[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"') : "";

            if (titleName) {
                return {
                    title: titleName,
                    url: mangaUrl,
                    thumbnailUrl: coverUrl ? (coverUrl + "|Referer=" + this.baseUrl + "/") : "",
                    author: author || "Unknown",
                    status: 1,
                    description: description,
                    genre: ["Manga", "Shueisha"]
                };
            }
        }

        return { title: "Manga #" + titleId, url: mangaUrl, status: 1 };
    },

    getChapterList: function(mangaUrl) {
        let titleId = this.extractTitleId(mangaUrl);
        let token = this.ensureToken();

        let url = this.apiUrl + "/api/chapter_list?service_language=en&avif_enable=false&original_title_id=" + titleId + "&translated_language=en";
        let response = this.fetchApi(url, "GET", token);
        if (!response || response.status !== 200) return [];

        let body = response.body || "";
        let chapters = [];
        let seen = {};

        for (let i = 0; i < body.length - 20; i++) {
            if (body.charCodeAt(i) === 0x12) {
                let len = body.charCodeAt(i + 1);
                if (len > 1 && len < 150 && i + 2 + len < body.length) {
                    let name = body.substring(i + 2, i + 2 + len).trim();

                    if (name.length > 0 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(name)) {
                        let p = i + 2 + len;
                        if (p < body.length && body.charCodeAt(p) === 0x18) {
                            p++;
                            let chapId = 0;
                            let shift = 0;
                            while (p < body.length) {
                                let b = body.charCodeAt(p++);
                                chapId |= (b & 0x7f) << shift;
                                if ((b & 0x80) === 0) break;
                                shift += 7;
                            }

                            if (chapId > 0 && !seen[chapId]) {
                                seen[chapId] = true;
                                chapters.push({
                                    name: name,
                                    url: "/en/title/" + titleId + "/chapter/" + chapId,
                                    dateUpload: 0,
                                    chapterNumber: chapters.length + 1
                                });
                            }
                        }
                    }
                }
            }
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let chapterId = this.extractChapterId(chapterUrl);
        let token = this.ensureToken();

        let url = this.apiUrl + "/api/viewer?service_language=en&avif_enable=false&translated_chapter_id=" + chapterId + "&quality=high";
        let response = this.fetchApi(url, "GET", token);
        if (!response || response.status !== 200) return [];

        let body = response.body || "";

        let keyMatch = body.match(/[0-9a-fA-F]{64}/);
        let aesKey = keyMatch ? keyMatch[0] : "";

        let bodyNoKey = aesKey ? body.replace(aesKey, "") : body;
        let ivMatch = bodyNoKey.match(/[0-9a-fA-F]{32}/);
        let aesIv = ivMatch ? ivMatch[0] : "";

        let imgUrls = body.match(/https:\/\/img\.mangamillion[^\x00-\x1f"'<]+/g) || [];
        let pages = [];
        let seen = {};

        for (let i = 0; i < imgUrls.length; i++) {
            let rawUrl = imgUrls[i];
            if (!seen[rawUrl]) {
                seen[rawUrl] = true;
                let pageStr = rawUrl + "|Referer=" + this.baseUrl + "/";
                if (aesKey && aesIv) {
                    pageStr += "|AesKey=" + aesKey + "|AesIv=" + aesIv;
                }
                pages.push(pageStr);
            }
        }

        return pages;
    },

    // ── Helper Utilities ─────────────────────────────────────────────────────

    ensureToken: function() {
        if (this.token) return this.token;
        let url = this.apiUrl + "/api/register?service_language=en";
        let response = this.fetchApi(url, "POST");
        if (response && response.status === 200) {
            let body = response.body || "";
            let strs = this.extractStrings(body);
            for (let i = 0; i < strs.length; i++) {
                let s = strs[i];
                if (s.length > 20 && /^[A-Za-z0-9_\-]+$/.test(s)) {
                    this.token = s;
                    return this.token;
                }
            }
            let match = body.match(/[A-Za-z0-9_\-]{30,}/);
            if (match) {
                this.token = match[0];
                return this.token;
            }
        }
        return "";
    },

    extractTitleId: function(url) {
        let match = (url || "").match(/\/title\/(\d+)/);
        return match ? match[1] : "1";
    },

    extractChapterId: function(url) {
        let match = (url || "").match(/\/chapter\/(\d+)/);
        return match ? match[1] : "1";
    },

    extractStrings: function(text) {
        let results = [];
        let i = 0;
        while (i < text.length - 2) {
            let code = text.charCodeAt(i);
            if ((code & 0x07) === 2) {
                let len = 0;
                let shift = 0;
                let j = i + 1;
                while (j < text.length) {
                    let b = text.charCodeAt(j++);
                    len |= (b & 0x7f) << shift;
                    if ((b & 0x80) === 0) break;
                    shift += 7;
                }
                if (len > 1 && len < 10000 && j + len <= text.length) {
                    let slice = text.substring(j, j + len);
                    let nonPrint = 0;
                    for (let k = 0; k < slice.length; k++) {
                        let c = slice.charCodeAt(k);
                        if (c < 0x20 && c !== 0x0a && c !== 0x0d) nonPrint++;
                    }
                    if (nonPrint < slice.length * 0.1) {
                        if (slice.length > 2) results.push(slice);
                    }
                }
            }
            i++;
        }
        return results;
    },

    fetchApi: function(url, method, token) {
        try {
            let headers = {
                "Origin": this.baseUrl,
                "Referer": this.baseUrl + "/",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            };
            if (token) {
                headers["Access-Token"] = token;
            }
            return fetch(url, {
                method: method || "GET",
                headers: headers
            });
        } catch (e) {
            return null;
        }
    }
};
