var source = {
    name: "Soul Scans",
    baseUrl: "https://v1.soulscans.asia",
    apiUrl: "https://v1.soulscans.asia/api",
    iconUrl: "https://raw.githubusercontent.com/keiyoushi/extensions-source/main/src/id/soulscans/res/mipmap-xxhdpi/ic_launcher.png",
    language: "id",
    version: "1.0.0",
    description: "Soul Scans Indonesian extension implemented in JavaScript.",
    author: "DesktopKomik",
    iconBackground: "#022c22",
    iconForeground: "#34d399",
    isNsfw: false,
    isHasMorePages: true,
    pageSize: 20,
    genres: ['Action', 'Adult', 'Adventure', 'Comedy', 'Cooking', 'Crime', 'Cultivation', 'Demon', 'Demons', 'Drama', 'Ecchi', 'Fantasy', 'Game', 'Gender Bender', 'Gore', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Magic', 'Martial Arts', 'Mature', 'Mecha', 'Medical', 'Military', 'Music', 'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School', 'School Life', 'Sci-Fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Smut', 'Sports', 'Super Power', 'Supernatural', 'Survival', 'Thriller', 'Time Travel', 'Tragedy', 'Webtoon'],
    formats: ['Manga', 'Manhwa', 'Manhua'],
    urlLayout: "LEGACY_COMIC",
    mirrorUrls: [],

    requestUrl: function(url, options) {
        let res = fetch(url, options || {});
        if ((!res || res.status !== 200) && this.mirrorUrls && this.mirrorUrls.length > 0) {
            for (let mirror of this.mirrorUrls) {
                let mirrorReq = url.replace(this.apiUrl, mirror + "/api").replace(this.baseUrl, mirror);
                if (mirrorReq !== url) {
                    let altRes = fetch(mirrorReq, options || {});
                    if (altRes && altRes.status === 200) {
                        return altRes;
                    }
                }
            }
        }
        return res;
    },

    getJson: function(url) {
        let res = this.requestUrl(url, {
            headers: {
                "Accept": "application/json"
            }
        });
        if (!res || res.status !== 200 || !res.body) return null;
        try {
            return JSON.parse(res.body);
        } catch (e) {
            return null;
        }
    },

    getMangaPath: function(slug) {
        if (this.urlLayout === "LEGACY_COMIC") {
            return "/comic/" + slug;
        } else if (this.urlLayout === "LEGACY_SERIES") {
            return "/series/" + slug;
        } else {
            return "/" + slug;
        }
    },

    getChapterPath: function(seriesSlug, chapterSlug) {
        return "/comic/" + seriesSlug + "/chapter/" + chapterSlug;
    },

    getPopularManga: function(page) {
        let p = page || 1;
        let url = `${this.apiUrl}/search?type=COMIC&limit=${this.pageSize}&page=${p}&sort=views&order=desc`;
        let json = this.getJson(url);
        if (!json || !json.data) return { items: [], totalPages: p };

        let items = [];
        for (let item of json.data) {
            let slug = item.slug;
            let title = (item.title || "").trim();
            let thumb = item.poster_image_url || "";
            if (slug) {
                items.push({
                    title: title || "Manga",
                    url: this.getMangaPath(slug),
                    thumbnailUrl: thumb
                });
            }
        }

        let totalPages = json.total_pages || (items.length >= this.pageSize ? p + 1 : p);
        return {
            items: items,
            totalPages: Math.max(p, totalPages)
        };
    },

    getLatestUpdates: function(page) {
        let p = page || 1;
        let url = `${this.apiUrl}/comic/home-sections?sections=latest_comic_updates&updateLimit=240`;
        let json = this.getJson(url);
        if (!json || !json.latest_comic_updates) return this.getPopularManga(page);

        let items = [];
        for (let item of json.latest_comic_updates) {
            let slug = item.slug;
            let title = (item.title || "").trim();
            let thumb = item.poster_image_url || "";
            if (slug) {
                items.push({
                    title: title || "Manga",
                    url: this.getMangaPath(slug),
                    thumbnailUrl: thumb
                });
            }
        }

        return {
            items: items,
            totalPages: 1
        };
    },

    getSearchManga: function(query, page) {
        query = (query || "").trim();
        if (!query) return this.getPopularManga(page);

        let p = page || 1;
        let url = `${this.apiUrl}/search?type=COMIC&limit=${this.pageSize}&page=${p}&q=${encodeURIComponent(query)}`;
        let json = this.getJson(url);
        if (!json || !json.data) return { items: [], totalPages: p };

        let items = [];
        for (let item of json.data) {
            let slug = item.slug;
            let title = (item.title || "").trim();
            let thumb = item.poster_image_url || "";
            if (slug) {
                items.push({
                    title: title || "Manga",
                    url: this.getMangaPath(slug),
                    thumbnailUrl: thumb
                });
            }
        }

        let totalPages = json.total_pages || (items.length >= this.pageSize ? p + 1 : p);
        return {
            items: items,
            totalPages: Math.max(p, totalPages)
        };
    },

    getMangaList: function(page, status, genre, type) {
        let p = page || 1;
        let url = `${this.apiUrl}/search?type=COMIC&limit=${this.pageSize}&page=${p}`;
        if (status === 1) url += "&status=ongoing";
        else if (status === 2 || status === 4) url += "&status=completed";

        if (genre) {
            let g = Array.isArray(genre) ? genre[0] : genre;
            if (g) url += "&genre=" + encodeURIComponent(g);
        }
        if (type) {
            let t = Array.isArray(type) ? type[0] : type;
            if (t) url += "&comic_type=" + encodeURIComponent(t);
        }

        let json = this.getJson(url);
        if (!json || !json.data) return { items: [], totalPages: p };

        let items = [];
        for (let item of json.data) {
            let slug = item.slug;
            let title = (item.title || "").trim();
            let thumb = item.poster_image_url || "";
            if (slug) {
                items.push({
                    title: title || "Manga",
                    url: this.getMangaPath(slug),
                    thumbnailUrl: thumb
                });
            }
        }

        let totalPages = json.total_pages || (items.length >= this.pageSize ? p + 1 : p);
        return {
            items: items,
            totalPages: Math.max(p, totalPages)
        };
    },

    getMangaDetails: function(url) {
        let slug = url.replace(/\/$/, '').split('/').pop();
        let apiUrl = `${this.apiUrl}/series/comic/${slug}`;
        let detail = this.getJson(apiUrl);
        if (!detail) return {};

        let status = 0;
        let s = (detail.comic_status || "").toLowerCase();
        if (s === "ongoing") status = 1;
        else if (s === "completed") status = 2;

        let genres = [];
        if (detail.primary_genre) genres.push(detail.primary_genre);
        if (detail.genres && Array.isArray(detail.genres)) {
            for (let g of detail.genres) {
                if (g.name && !genres.includes(g.name)) genres.push(g.name);
            }
        }

        let description = detail.synopsis || "";
        description = description.replace(/<[^>]+>/g, '').trim();

        return {
            title: (detail.title || "").trim(),
            url: url,
            thumbnailUrl: detail.poster_image_url || "",
            author: detail.author_name || "",
            artist: detail.artist_name || "",
            status: status,
            description: description,
            genre: genres
        };
    },

    getChapterList: function(mangaUrl) {
        let slug = mangaUrl.replace(/\/$/, '').split('/').pop();
        let apiUrl = `${this.apiUrl}/series/comic/${slug}`;
        let detail = this.getJson(apiUrl);
        if (!detail || !detail.units || !Array.isArray(detail.units)) return [];

        let chapters = [];
        let seriesSlug = detail.slug || slug;

        for (let u of detail.units) {
            let chSlug = u.slug;
            let chNum = u.number || "";
            let chTitle = u.title;
            let name = "Chapter " + chNum;
            if (false && chTitle) {
                name += " - " + chTitle;
            }

            let dateUpload = u.created_at ? new Date(u.created_at).getTime() : 0;
            chapters.push({
                name: name,
                url: this.getChapterPath(seriesSlug, chSlug),
                dateUpload: dateUpload
            });
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let clean = chapterUrl.replace(/^\//, '').replace(/\/$/, '');
        let parts = clean.split('/chapter/');
        if (parts.length < 2) return [];

        let seriesSlug = parts[0].split('/').pop();
        let chapterSlug = parts[1];

        let apiUrl = `${this.apiUrl}/series/comic/${seriesSlug}/chapter/${chapterSlug}`;
        let json = this.getJson(apiUrl);
        if (!json || !json.chapter || !json.chapter.pages) return [];

        let pages = [];
        let rawPages = json.chapter.pages;

        for (let i = 0; i < rawPages.length; i++) {
            let p = rawPages[i];
            let img = p.image_url;
            if (!img) continue;

            if (false) {
                let filename = img.split('/').pop().split('?')[0];
                if (/^999(?:-\d+)?\.jpe?g$/i.test(filename) ||
                    /^997(?:-\d+)?\.jpe?g$/i.test(filename) ||
                    /^00\.0\.jpg$/i.test(filename) ||
                    /^00\.1\.jpg$/i.test(filename) ||
                    /^995\.jpg$/i.test(filename)) {
                    continue;
                }
            }

            // Full resolution blogger image
            let fullImg = img.replace(/=[swh]\d+[^/?]*($|\?)/i, "=s0$1")
                             .replace(/\/[swh]\d+[^/]*\//i, "/s0/");

            // Clean resizing params
            fullImg = fullImg.replace(/[?&](?:w|width|resize)=[^&]*/g, '');

            pages.push(fullImg);
        }

        return pages;
    }
};
