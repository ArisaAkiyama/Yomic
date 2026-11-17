var source = {
    name: "VoraToon",
    baseUrl: "https://13.voratoon.com",
    apiUrl: "https://13.voratoon.com",
    iconUrl: "https://13.voratoon.com/logo/voratoon-icon-512.png",
    language: "id",
    version: "1.2.0",
    description: "Baca Komik Online Bahasa Indonesia - Manga, Manhwa, Manhua Terbaru",
    author: "DesktopKomik",
    iconBackground: "#ea580c",
    iconForeground: "#ffffff",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 30,
    lastRequiresVerification: false,

    genres: [
        "Action", "Adult", "Adventure", "Comedy", "Cooking", "Crime", "Demons", "Drama", "Ecchi",
        "Fantasy", "Game", "Gender Bender", "Gore", "Harem", "Historical", "Horror",
        "Isekai", "Josei", "Magic", "Martial Arts", "Mature", "Mecha", "Military",
        "Music", "Mystery", "One Shot", "Overpowered", "Parody", "Police", "Psychological",
        "Reincarnation", "Romance", "Samurai", "School Life", "Sci-Fi", "Seinen",
        "Shoujo", "Shounen", "Slice of Life", "Sports", "Super Power", "Supernatural",
        "Survival", "Suspense", "Thriller", "Time Travel", "Tragedy", "Vampire", "Webtoon"
    ],

    mapStatus: function(statusStr) {
        if (!statusStr) return 0;
        let s = String(statusStr).toLowerCase().trim();
        if (s === "ongoing" || s === "on going") return 1;
        if (s === "completed" || s === "complete") return 2;
        if (s === "cancelled" || s === "canceled") return 5;
        if (s === "hiatus") return 6;
        return 0;
    },

    extractJsonValue: function(text, key, fromIndex) {
        if (!text) return null;
        let startFrom = fromIndex || 0;
        let normalKey = '"' + key + '":';
        let escapedKey = '\\"' + key + '\\":';
        let idx = text.indexOf(normalKey, startFrom);
        let isEscaped = false;
        let keyLen = normalKey.length;

        if (idx === -1) {
            idx = text.indexOf(escapedKey, startFrom);
            isEscaped = true;
            keyLen = escapedKey.length;
        }
        if (idx === -1) return null;

        let valStart = idx + keyLen;
        while (valStart < text.length && /\s/.test(text[valStart])) {
            valStart++;
        }
        if (valStart >= text.length) return null;

        let openChar = text[valStart];
        if (openChar !== '{' && openChar !== '[') return null;
        let closeChar = openChar === '{' ? '}' : ']';

        let depth = 0;
        let inString = false;
        let i = valStart;

        while (i < text.length) {
            let ch = text[i];
            if (isEscaped) {
                // Inside escaped RSC JSON string: \" marks string boundaries, \\\" is escaped quote inside string
                if (ch === '\\' && i + 1 < text.length) {
                    let next = text[i + 1];
                    if (next === '"') {
                        inString = !inString;
                        i += 2;
                        continue;
                    }
                    if (next === '\\') {
                        i += 2;
                        continue;
                    }
                }
            } else {
                if (ch === '\\' && inString) {
                    i += 2;
                    continue;
                }
                if (ch === '"') {
                    inString = !inString;
                    i++;
                    continue;
                }
            }

            if (!inString) {
                if (ch === openChar) depth++;
                else if (ch === closeChar) {
                    depth--;
                    if (depth === 0) {
                        let raw = text.substring(valStart, i + 1);
                        if (isEscaped) {
                            raw = raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                        }
                        try {
                            return { value: JSON.parse(raw), endIndex: i + 1 };
                        } catch (e) {
                            return null;
                        }
                    }
                }
            }
            i++;
        }
        return null;
    },

    extractRscChunk: function(text, refVal) {
        if (!text || !refVal) return null;
        if (typeof refVal !== "string") return null;
        if (!refVal.startsWith("$")) return refVal;
        let id = refVal.substring(1);
        let prefix = id + ":";
        let idx = text.indexOf("\n" + prefix);
        if (idx !== -1) idx += 1;
        else if (text.startsWith(prefix)) idx = 0;
        else {
            idx = text.indexOf(prefix + "T");
            if (idx === -1) return null;
        }

        let afterPrefix = idx + prefix.length;
        // Next.js RSC text chunks are prefixed with T<hex_len>, (not necessarily newline-terminated)
        let head = text.substring(afterPrefix, afterPrefix + 24);
        let tMatch = head.match(/^T([0-9a-fA-F]+),/);
        if (tMatch) {
            let len = parseInt(tMatch[1], 16);
            let start = afterPrefix + tMatch[0].length;
            return text.substring(start, start + len);
        }

        let lineEnd = text.indexOf("\n", afterPrefix);
        return (lineEnd === -1 ? text.substring(afterPrefix) : text.substring(afterPrefix, lineEnd)).trim();
    },

    formatCover: function(cover) {
        if (!cover) return "";
        if (!cover.startsWith("http")) {
            cover = "https://cvr.voratoon.id/prod/" + cover.replace(/^\/+/, "");
        }
        return cover + "|Referer=" + this.baseUrl + "/";
    },

    parseSeriesList: function(text, page) {
        if (!text) return { items: [], totalPages: page || 1 };

        let items = [];
        let totalPages = page || 1;

        let seriesRes = this.extractJsonValue(text, "series");
        if (seriesRes && Array.isArray(seriesRes.value)) {
            let seriesArr = seriesRes.value;
            for (let i = 0; i < seriesArr.length; i++) {
                let item = seriesArr[i];
                let d = item.data || item.$attributes || item;
                let title = d.title || d.name || "";
                let slug = d.slug || (item.id ? String(item.id) : "");
                if (title && slug) {
                    items.push({
                        title: title.trim(),
                        url: "/series/" + slug,
                        thumbnailUrl: this.formatCover(d.coverImage || ""),
                        status: this.mapStatus(d.status)
                    });
                }
            }

            let metaRes = this.extractJsonValue(text, "seriesMeta", seriesRes.endIndex);
            if (metaRes && metaRes.value) {
                let meta = metaRes.value;
                if (meta.lastPage) {
                    totalPages = meta.lastPage;
                } else if (meta.total) {
                    totalPages = Math.ceil(meta.total / 30);
                }
            }
        }

        // Fallback: If RSC parsing found nothing, fallback to HTML regex
        if (items.length === 0) {
            let re = /<a[^>]+href=["'](\/series\/[^"'\/]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
            let m;
            let seen = {};
            while ((m = re.exec(text)) !== null) {
                let href = m[1];
                let inner = m[2];
                if (seen[href]) continue;

                let titleMatch = inner.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)/i) || inner.match(/alt="([^"]+)"/i);
                let title = titleMatch ? titleMatch[1].trim() : "";
                let imgMatch = inner.match(/src="([^"]+)"/i) || inner.match(/data-src="([^"]+)"/i);
                let cover = imgMatch ? imgMatch[1] : "";

                if (title && href) {
                    seen[href] = true;
                    items.push({
                        title: title.replace(/&#x27;/g, "'").replace(/&amp;/g, "&"),
                        url: href,
                        thumbnailUrl: cover ? (cover + "|Referer=" + this.baseUrl + "/") : "",
                        status: 1
                    });
                }
            }
            if (items.length > 0) {
                totalPages = items.length >= 20 ? page + 1 : page;
            }
        }

        return {
            items: items,
            totalPages: Math.max(1, totalPages)
        };
    },

    getPopularManga: function(page) {
        page = Math.max(1, page || 1);
        let url = this.baseUrl + "/browse?sort=popular&page=" + page;
        let res = this.fetchRsc(url);
        if (!res || res.status !== 200) {
            res = this.fetchApi(url, "GET");
        }
        if (res && res.status === 200) {
            return this.parseSeriesList(res.body, page);
        }
        return { items: [], totalPages: page };
    },

    getLatestUpdates: function(page) {
        page = Math.max(1, page || 1);
        let url = this.baseUrl + "/browse?sort=new&page=" + page;
        let res = this.fetchRsc(url);
        if (!res || res.status !== 200) {
            res = this.fetchApi(url, "GET");
        }
        if (res && res.status === 200) {
            return this.parseSeriesList(res.body, page);
        }
        return { items: [], totalPages: page };
    },

    getSearchManga: function(query, page) {
        page = Math.max(1, page || 1);
        let q = (query || "").trim();
        let url = this.baseUrl + "/browse?page=" + page;
        if (q) {
            url += "&q=" + encodeURIComponent(q);
        }
        let res = this.fetchRsc(url);
        if (!res || res.status !== 200) {
            res = this.fetchApi(url, "GET");
        }
        if (res && res.status === 200) {
            return this.parseSeriesList(res.body, page);
        }
        return { items: [], totalPages: page };
    },

    getMangaList: function(page, status, genre, type, sort) {
        page = Math.max(1, page || 1);
        let url = this.baseUrl + "/browse?page=" + page;

        if (sort && typeof sort === "string" && sort.trim()) {
            let s = sort.trim().toLowerCase();
            if (s === "latest") s = "new";
            url += "&sort=" + encodeURIComponent(s);
        }

        if (status === 2 || status === "Completed" || status === "completed") {
            url += "&status=completed";
        } else if (status === 1 || status === "Ongoing" || status === "ongoing") {
            url += "&status=ongoing";
        } else if (status === 6 || status === "Hiatus" || status === "hiatus") {
            url += "&status=hiatus";
        } else if (status === 5 || status === "Cancelled" || status === "cancelled") {
            url += "&status=cancelled";
        }

        if (genre && Array.isArray(genre) && genre.length > 0) {
            let lowerGenres = genre.map(function(g) { return String(g).trim().toLowerCase(); }).filter(Boolean);
            if (lowerGenres.length > 0) {
                url += "&genre=" + encodeURIComponent(lowerGenres.join(","));
            }
        } else if (typeof genre === "string" && genre.trim()) {
            url += "&genre=" + encodeURIComponent(genre.trim().toLowerCase());
        }

        if (type && Array.isArray(type) && type.length > 0) {
            let lowerTypes = type.map(function(t) { return String(t).trim().toLowerCase(); }).filter(Boolean);
            if (lowerTypes.length > 0) {
                url += "&format=" + encodeURIComponent(lowerTypes.join(","));
            }
        } else if (typeof type === "string" && type.trim()) {
            url += "&format=" + encodeURIComponent(type.trim().toLowerCase());
        }

        let res = this.fetchRsc(url);
        if (!res || res.status !== 200) {
            res = this.fetchApi(url, "GET");
        }
        if (res && res.status === 200) {
            return this.parseSeriesList(res.body, page);
        }
        return { items: [], totalPages: page };
    },

    getMangaDetails: function(mangaUrl) {
        let absUrl = mangaUrl.startsWith("http") ? mangaUrl : (this.baseUrl + (mangaUrl.startsWith("/") ? "" : "/") + mangaUrl);
        let res = this.fetchRsc(absUrl);
        if (!res || res.status !== 200) {
            res = this.fetchApi(absUrl, "GET");
        }
        if (!res || res.status !== 200) {
            return { title: "Unknown", url: mangaUrl, status: 0 };
        }

        let body = res.body || "";

        // 1. Try RSC "series" payload (array or object)
        let seriesRes = this.extractJsonValue(body, "series");
        if (seriesRes && seriesRes.value) {
            let item = Array.isArray(seriesRes.value) ? seriesRes.value[0] : seriesRes.value;
            if (item) {
                let d = item.data || item;
                let title = d.title || d.name || "Unknown";
                let author = d.author || "Unknown";
                let status = this.mapStatus(d.status);
                let desc = d.synopsis || "";
                let genres = (d.genres || []).map(function(g) { return (g.data && g.data.name) || g.name || ""; }).filter(Boolean);
                return {
                    title: title.trim(),
                    url: mangaUrl,
                    thumbnailUrl: this.formatCover(d.coverImage || ""),
                    author: author,
                    status: status,
                    description: desc,
                    genre: genres
                };
            }
        }

        // 2. Fallback: ld+json
        let ldRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
        let m;
        while ((m = ldRegex.exec(body)) !== null) {
            try {
                let data = JSON.parse(m[1]);
                let items = Array.isArray(data) ? data : [data];
                for (let i = 0; i < items.length; i++) {
                    let it = items[i];
                    if (it["@type"] === "ComicSeries") {
                        let title = it.name || "Unknown";
                        let cover = it.image || "";
                        let author = (it.author && (it.author.name || it.author)) || "Unknown";
                        let desc = it.description || "";
                        let genres = Array.isArray(it.genre) ? it.genre : (it.genre ? [it.genre] : []);
                        return {
                            title: title.trim(),
                            url: mangaUrl,
                            thumbnailUrl: cover ? (cover + "|Referer=" + this.baseUrl + "/") : "",
                            author: author,
                            status: 1,
                            description: desc,
                            genre: genres
                        };
                    }
                }
            } catch (e) {}
        }

        return { title: "Unknown", url: mangaUrl, status: 0 };
    },

    getChapterList: function(mangaUrl) {
        let absUrl = mangaUrl.startsWith("http") ? mangaUrl : (this.baseUrl + (mangaUrl.startsWith("/") ? "" : "/") + mangaUrl);
        let res = this.fetchRsc(absUrl);
        if (!res || res.status !== 200) {
            res = this.fetchApi(absUrl, "GET");
        }
        if (!res || res.status !== 200) return [];

        let body = res.body || "";
        let slug = this.extractSlug(mangaUrl);
        let chapters = [];

        // 1. Try RSC "chapters" array (pick the longest array, since series[0].chapters only holds 5 preview chapters)
        let bestList = null;
        let searchPos = 0;
        while (true) {
            let chRes = this.extractJsonValue(body, "chapters", searchPos);
            if (!chRes) break;
            if (Array.isArray(chRes.value)) {
                if (!bestList || chRes.value.length > bestList.length) {
                    bestList = chRes.value;
                }
            }
            searchPos = chRes.endIndex;
        }
        if (bestList && bestList.length > 0) {
            let list = bestList;
            let seen = {};
            for (let i = 0; i < list.length; i++) {
                let ch = list[i];
                let d = ch.data || {};
                let idx = (d.index !== undefined && d.index !== null) ? d.index : ch.chapterIndex;
                if (idx === undefined || idx === null) continue;
                let num = parseFloat(idx);
                let formattedIdx = String(num).replace(/\.0$/, "");
                let chUrl = "/series/" + slug + "/chapter/" + formattedIdx;
                if (seen[chUrl]) continue;
                seen[chUrl] = true;

                let name = d.title ? ("Chapter " + formattedIdx + ": " + d.title.trim()) : ("Chapter " + formattedIdx);
                let dateStr = ch.createdAt || ch.updatedAt || "";
                let parsedDate = dateStr ? Date.parse(dateStr) : 0;

                chapters.push({
                    name: name,
                    url: chUrl,
                    chapterNumber: isNaN(num) ? 0 : num,
                    dateUpload: isNaN(parsedDate) ? 0 : parsedDate
                });
            }
        }

        // 2. Fallback: HTML anchor regex
        if (chapters.length === 0) {
            let escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let chRegex = new RegExp('<a[^>]+href=["\'](/series/' + escapedSlug + '/chapter/([0-9]+(?:\\.[0-9]+)?))["\'][^>]*>([\\s\\S]*?)</a>', 'gi');
            let seen = {};
            let m;

            while ((m = chRegex.exec(body)) !== null) {
                let chUrl = m[1];
                let chNum = parseFloat(m[2]);
                let inner = m[3] || "";

                if (seen[chUrl]) continue;
                seen[chUrl] = true;

                let titleMatch = inner.match(/class="[^"]*chapter-number[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
                let name = "";
                if (titleMatch) {
                    name = titleMatch[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
                }
                if (!name) {
                    name = "Chapter " + chNum;
                }

                chapters.push({
                    name: name,
                    url: chUrl,
                    chapterNumber: isNaN(chNum) ? 0 : chNum,
                    dateUpload: 0
                });
            }
        }

        if (chapters.length > 1 && chapters[0].chapterNumber < chapters[1].chapterNumber) {
            chapters.sort(function(a, b) {
                return b.chapterNumber - a.chapterNumber;
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        this.lastRequiresVerification = false;
        let absUrl = chapterUrl.startsWith("http") ? chapterUrl : (this.baseUrl + (chapterUrl.startsWith("/") ? "" : "/") + chapterUrl);
        let res = this.fetchRsc(absUrl);
        if (!res || res.status !== 200) {
            res = this.fetchApi(absUrl, "GET");
        }
        if (!res || res.status !== 200) return [];

        let body = res.body || "";

        // 1. Try RSC "chapter" object
        let chRes = this.extractJsonValue(body, "chapter");
        if (chRes && chRes.value) {
            let ch = chRes.value;
            let imgs = (ch.data && Array.isArray(ch.data.images)) ? ch.data.images : [];
            if (imgs.length > 0) {
                return imgs.map(function(u) { return u + "|Referer=" + this.baseUrl + "/"; }.bind(this));
            }

            // 2. If images[] is empty and pagesTicket is present, call unlockChapterPages Server Action
            if (ch.pagesTicket) {
                let ticket = this.extractRscChunk(body, ch.pagesTicket);
                if (ticket) {
                    let unlockRes = this.fetchApi(absUrl, "POST", {
                        "Accept": "text/x-component",
                        "Next-Action": "60d1bbcd5ae753b54be8a4ecf238a7ed44beb27311"
                    }, JSON.stringify([ticket]));

                    if (unlockRes && unlockRes.status === 200 && unlockRes.body) {
                        let uBody = unlockRes.body;
                        let uImgRes = this.extractJsonValue(uBody, "images");
                        if (uImgRes && Array.isArray(uImgRes.value) && uImgRes.value.length > 0) {
                            return uImgRes.value.map(function(u) { return u + "|Referer=" + this.baseUrl + "/"; }.bind(this));
                        }
                        if (uBody.indexOf('"reason":"challenge"') !== -1 || uBody.indexOf('\\"reason\\":\\"challenge\\"') !== -1) {
                            this.lastRequiresVerification = true;
                            return [];
                        }
                    }
                }
            }
        }

        // 3. Fallback: data-chapter-page attributes
        let pageRegex = /data-chapter-page=["'](https?:\/\/[^"']+)["']/gi;
        let pages = [];
        let seen = {};
        let m;

        while ((m = pageRegex.exec(body)) !== null) {
            let url = m[1].replace(/&amp;/g, "&");
            if (!seen[url]) {
                seen[url] = true;
                pages.push(url + "|Referer=" + this.baseUrl + "/");
            }
        }

        if (pages.length > 0) return pages;

        // 4. Fallback: match cdn.voratoon.com image URLs
        let cdnRegex = /https?:\/\/(?:cdn\.voratoon\.com|cdn\.uqni\.net)\/[^\x00-\x1f"'<>\s\\]+\.(?:jpg|jpeg|png|webp)/gi;
        let matches = body.match(cdnRegex) || [];

        for (let i = 0; i < matches.length; i++) {
            let u = matches[i].replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
            if (u.includes("/logo/") || u.includes("/icons/") || u.includes("/ads/") || u.includes("/cover/") || u.includes("/background/")) continue;
            if (!seen[u]) {
                seen[u] = true;
                pages.push(u + "|Referer=" + this.baseUrl + "/");
            }
        }

        return pages;
    },

    extractSlug: function(url) {
        let clean = url.replace(/\/+$/, "");
        let parts = clean.split("/");
        if (parts.length > 0) {
            let last = parts[parts.length - 1];
            if (last === "chapter" && parts.length > 2) {
                return parts[parts.length - 3];
            }
            if (parts.length > 2 && parts[parts.length - 2] === "chapter") {
                return parts[parts.length - 3];
            }
            return last;
        }
        return url;
    },

    fetchRsc: function(url) {
        return this.fetchApi(url, "GET", { "RSC": "1" });
    },

    fetchApi: function(url, method, extraHeaders, body) {
        try {
            let headers = {
                "Origin": this.baseUrl,
                "Referer": this.baseUrl + "/",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            };
            if (extraHeaders) {
                for (let k in extraHeaders) {
                    headers[k] = extraHeaders[k];
                }
            }
            let opts = {
                method: method || "GET",
                headers: headers
            };
            if (body !== undefined && body !== null) {
                opts.body = body;
            }
            return fetch(url, opts);
        } catch (e) {
            return null;
        }
    }
};
