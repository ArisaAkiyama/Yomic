var source = {
    name: "MangaDex",
    iconUrl: "https://www.google.com/s2/favicons?domain=mangadex.org&sz=128",
    baseUrl: "https://mangadex.org",
    apiUrl: "https://api.mangadex.org",
    uploadsUrl: "https://uploads.mangadex.org",
    language: "en",
    selectedLanguage: "en",
    version: "1.0.3",
    description: "MangaDex extension implemented in JavaScript using the official MangaDex API",
    author: "DesktopKomik",
    iconBackground: "#ff6740",
    iconForeground: "#ffffff",
    isNsfw: false,
    isHasMorePages: true,
    requiresProxy: true,

    pageSize: 14,
    chapterPageSize: 100,

    getPopularManga: function(page) {
        let lang = this.getSelectedLanguage();
        if (lang === "id") {
            let byChapter = this.getMangaByTranslatedChapterFeed(page, "id", "followedCount");
            if (byChapter && byChapter.items && byChapter.items.length > 0) {
                return byChapter;
            }
        }
        return this.getMangaPage(page, {
            "order[followedCount]": "desc"
        });
    },

    getLatestUpdates: function(page) {
        let lang = this.getSelectedLanguage();
        let byChapter = this.getMangaByTranslatedChapterFeed(page, lang, "readableAt");
        if (byChapter && byChapter.items && byChapter.items.length > 0) {
            return byChapter;
        }
        return this.getMangaPage(page, {
            "order[latestUploadedChapter]": "desc"
        });
    },

    getMangaByTranslatedChapterFeed: function(page, lang, sortMode) {
        let currentPage = Math.max(1, page || 1);
        let chapLimit = 64;
        let chapOffset = (currentPage - 1) * 32;
        let chapParams = {
            limit: chapLimit,
            offset: chapOffset,
            "translatedLanguage[]": lang,
            "contentRating[]": ["safe", "suggestive", "erotica"],
            "includeFutureUpdates": "0",
            "order[readableAt]": "desc"
        };

        let chapJson = this.getJson(this.apiUrl + "/chapter" + this.toQuery(chapParams));
        if (!chapJson || !chapJson.data || chapJson.data.length === 0) {
            return null;
        }

        let uniqueMangaIds = [];
        let seen = {};
        for (let i = 0; i < chapJson.data.length; i++) {
            let rels = chapJson.data[i].relationships || [];
            for (let j = 0; j < rels.length; j++) {
                if (rels[j].type === "manga" && rels[j].id && !seen[rels[j].id]) {
                    seen[rels[j].id] = true;
                    uniqueMangaIds.push(rels[j].id);
                    if (uniqueMangaIds.length >= this.pageSize) break;
                }
            }
            if (uniqueMangaIds.length >= this.pageSize) break;
        }

        if (uniqueMangaIds.length === 0) {
            return null;
        }

        let mangaParams = {
            limit: uniqueMangaIds.length,
            "ids[]": uniqueMangaIds,
            "includes[]": "cover_art",
            "contentRating[]": ["safe", "suggestive", "erotica"]
        };
        if (sortMode === "followedCount") {
            mangaParams["order[followedCount]"] = "desc";
        } else {
            mangaParams["order[latestUploadedChapter]"] = "desc";
        }

        let mangaJson = this.getJson(this.apiUrl + "/manga" + this.toQuery(mangaParams));
        if (!mangaJson || !mangaJson.data || mangaJson.data.length === 0) {
            return null;
        }

        return {
            items: mangaJson.data.map(manga => this.parseManga(manga)),
            totalPages: currentPage + 1
        };
    },

    getSearchManga: function(query, page) {
        let params = {
            "order[relevance]": "desc"
        };
        if (query && query.trim() !== "") {
            params.title = query.trim();
        }
        return this.getMangaPage(page, params);
    },

    getMangaList: function(page, status, genre, type, sort) {
        let hasFilter = (status && status > 0) ||
                        (genre && (!Array.isArray(genre) || genre.length > 0)) ||
                        (type && (!Array.isArray(type) || type.length > 0));
        let isLatest = typeof sort === "string" && sort.toLowerCase() === "latest";

        if (!hasFilter) {
            if (isLatest) {
                return this.getLatestUpdates(page);
            }
            return this.getPopularManga(page);
        }

        let params = {};
        if (isLatest) {
            params["order[latestUploadedChapter]"] = "desc";
        } else {
            params["order[followedCount]"] = "desc";
        }

        if (status === 1) {
            params["status[]"] = "ongoing";
        } else if (status === 2) {
            params["status[]"] = "completed";
        } else if (status === 3) {
            params["status[]"] = "hiatus";
        } else if (status === 4) {
            params["status[]"] = "cancelled";
        }

        let includedTags = [];
        if (genre) {
            let arr = Array.isArray(genre) ? genre : [genre];
            for (let i = 0; i < arr.length; i++) {
                let uuid = this.tagIds[arr[i]];
                if (uuid) {
                    includedTags.push(uuid);
                }
            }
        }

        if (type) {
            let arr = Array.isArray(type) ? type : [type];
            let originalLanguages = [];
            for (let i = 0; i < arr.length; i++) {
                let fmt = arr[i];
                if (fmt === "Manga") {
                    originalLanguages.push("ja");
                } else if (fmt === "Manhwa") {
                    originalLanguages.push("ko");
                } else if (fmt === "Manhua") {
                    originalLanguages.push("zh");
                    originalLanguages.push("zh-hk");
                } else if (fmt === "Webtoon") {
                    includedTags.push("e197df38-d0e7-43b5-9b09-2842d0c326dd");
                }
            }
            if (originalLanguages.length > 0) {
                params["originalLanguage[]"] = originalLanguages;
            }
        }

        if (includedTags.length > 0) {
            params["includedTags[]"] = includedTags;
        }

        return this.getMangaPage(page, params);
    },

    getMangaPage: function(page, extraParams) {
        let currentPage = Math.max(1, page || 1);
        let params = {
            limit: this.pageSize,
            offset: (currentPage - 1) * this.pageSize,
            "availableTranslatedLanguage[]": this.getSelectedLanguage(),
            "includes[]": "cover_art",
            "contentRating[]": ["safe", "suggestive", "erotica"]
        };

        for (let key in extraParams) {
            params[key] = extraParams[key];
        }

        let json = this.getJson(this.apiUrl + "/manga" + this.toQuery(params));
        if (!json || !json.data) {
            return { items: [], totalPages: currentPage };
        }

        let total = typeof json.total === "number" ? json.total : ((currentPage - 1) * this.pageSize + json.data.length);
        return {
            items: json.data.map(manga => this.parseManga(manga)),
            totalPages: Math.max(1, Math.ceil(total / this.pageSize))
        };
    },

    getMangaDetails: function(url) {
        let id = this.extractId(url);
        if (!id) return {};

        let json = this.getJson(this.apiUrl + "/manga/" + encodeURIComponent(id) + this.toQuery({
            "includes[]": ["cover_art", "author", "artist"]
        }));
        if (!json || !json.data) return {};

        let manga = json.data;
        let attr = manga.attributes || {};
        let authors = this.getRelationshipNames(manga, "author");
        let artists = this.getRelationshipNames(manga, "artist");
        let authorText = authors.length > 0 ? authors.join(", ") : artists.join(", ");

        return {
            title: this.pickLocalized(attr.title) || this.getBestAltTitle(attr.altTitles) || "",
            url: "/title/" + manga.id,
            thumbnailUrl: this.getCoverUrl(manga),
            author: authorText,
            status: this.mapStatus(attr.status),
            description: this.pickLocalized(attr.description) || "",
            genre: this.getTags(attr.tags),
            source: this.id
        };
    },

    getChapterList: function(mangaUrl) {
        let mangaId = this.extractId(mangaUrl);
        if (!mangaId) return [];

        let offset = 0;
        let chapters = [];
        let total = 1;

        while (offset < total && offset < 10000) {
            let json = this.getJson(this.apiUrl + "/manga/" + encodeURIComponent(mangaId) + "/feed" + this.toQuery({
                limit: this.chapterPageSize,
                offset: offset,
                "translatedLanguage[]": this.getSelectedLanguage(),
                "contentRating[]": ["safe", "suggestive", "erotica"],
                "includeFutureUpdates": "0",
                "order[chapter]": "desc",
                "order[volume]": "desc"
            }));

            if (!json || !json.data) break;
            total = typeof json.total === "number" ? json.total : json.data.length;

            for (let i = 0; i < json.data.length; i++) {
                let chapter = json.data[i];
                let attr = chapter.attributes || {};
                let chapterNumber = attr.chapter || "";
                let title = attr.title || "";
                let name = chapterNumber ? "Chapter " + chapterNumber : "Chapter";
                if (title) {
                    name += " - " + title;
                }

                chapters.push({
                    name: name,
                    url: "/chapter/" + chapter.id,
                    dateUpload: this.parseDate(attr.publishAt || attr.createdAt || attr.updatedAt)
                });
            }

            if (json.data.length === 0) break;
            offset += json.data.length;
        }

        return chapters;
    },

    getPageList: function(chapterUrl) {
        let chapterId = this.extractId(chapterUrl);
        if (!chapterId) return [];

        let json = this.getJson(this.apiUrl + "/at-home/server/" + encodeURIComponent(chapterId));
        if (!json || !json.chapter) return [];

        let baseUrl = json.baseUrl || "";
        let hash = json.chapter.hash || "";
        let useDataSaver = json.chapter.dataSaver && json.chapter.dataSaver.length > 0;
        let qualityPath = useDataSaver ? "data-saver" : "data";
        let files = useDataSaver ? json.chapter.dataSaver : (json.chapter.data || []);
        let pages = [];

        for (let i = 0; i < files.length; i++) {
            pages.push(baseUrl + "/" + qualityPath + "/" + hash + "/" + files[i] + "|Referer=https://mangadex.org&Origin=https://mangadex.org");
        }

        return pages;
    },

    parseManga: function(manga) {
        let attr = manga.attributes || {};
        return {
            title: this.pickLocalized(attr.title) || this.getBestAltTitle(attr.altTitles) || "",
            url: "/title/" + manga.id,
            thumbnailUrl: this.getCoverUrl(manga),
            status: this.mapStatus(attr.status),
            source: this.id
        };
    },

    getCoverUrl: function(manga) {
        let coverFile = "";
        let relationships = manga.relationships || [];
        for (let i = 0; i < relationships.length; i++) {
            let rel = relationships[i];
            if (rel.type === "cover_art" && rel.attributes && rel.attributes.fileName) {
                coverFile = rel.attributes.fileName;
                break;
            }
        }

        if (!coverFile) return "";
        return this.uploadsUrl + "/covers/" + manga.id + "/" + coverFile + ".256.jpg";
    },

    getRelationshipNames: function(manga, type) {
        let names = [];
        let relationships = manga.relationships || [];
        for (let i = 0; i < relationships.length; i++) {
            let rel = relationships[i];
            if (rel.type === type && rel.attributes && rel.attributes.name) {
                names.push(rel.attributes.name);
            }
        }
        return names;
    },

    getTags: function(tags) {
        let result = [];
        tags = tags || [];
        for (let i = 0; i < tags.length; i++) {
            let name = this.pickLocalized((tags[i].attributes || {}).name);
            if (name) result.push(name);
        }
        return result;
    },

    pickLocalized: function(values) {
        if (!values) return "";
        let language = this.getSelectedLanguage();
        return values[language] || values.en || values["en-us"] || values.ja || values["ja-ro"] || values.ko || values["ko-ro"] || values.zh || values["zh-ro"] || this.firstValue(values);
    },

    getSelectedLanguage: function() {
        let language = (this.selectedLanguage || "en").toLowerCase();
        return language === "id" ? "id" : "en";
    },

    getBestAltTitle: function(altTitles) {
        altTitles = altTitles || [];
        for (let i = 0; i < altTitles.length; i++) {
            let value = this.pickLocalized(altTitles[i]);
            if (value) return value;
        }
        return "";
    },

    firstValue: function(obj) {
        for (let key in obj) {
            if (obj[key]) return obj[key];
        }
        return "";
    },

    mapStatus: function(status) {
        status = (status || "").toLowerCase();
        if (status === "ongoing") return 1;
        if (status === "completed") return 2;
        if (status === "hiatus") return 3;
        if (status === "cancelled") return 4;
        return 0;
    },

    extractId: function(url) {
        if (!url) return "";
        let clean = url.split("?")[0].replace(this.baseUrl, "");
        let parts = clean.split("/").filter(x => x && x.trim() !== "");
        if (parts.length >= 2 && (parts[0] === "title" || parts[0] === "chapter")) {
            return parts[1];
        }
        return parts.length > 0 ? parts[parts.length - 1] : "";
    },

    parseDate: function(value) {
        if (!value) return 0;
        let time = Date.parse(value);
        return isNaN(time) ? 0 : time;
    },

    getJson: function(url) {
        let response = fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });
        if (response.status < 200 || response.status >= 300) return null;
        return JSON.parse(response.body);
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
    },

    genres: [
        "4-Koma", "Action", "Adaptation", "Adventure", "Animals", "Anthology", "Award Winning",
        "Boys' Love", "Comedy", "Cooking", "Crime", "Crossdressing", "Delinquents", "Demons", 
        "Doujinshi", "Drama", "Fan Colored", "Fantasy", "Full Color", "Genderswap", "Ghosts", 
        "Girls' Love", "Gore", "Gyaru", "Harem", "Historical", "Horror", "Incest", "Isekai", 
        "Loli", "Long Strip", "Mafia", "Magic", "Magical Girls", "Martial Arts", "Mecha", 
        "Medical", "Military", "Monster Girls", "Monsters", "Music", "Mystery", "Ninja", 
        "Office Workers", "Official Colored", "Oneshot", "Philosophical", "Police", "Post-Apocalyptic", 
        "Psychological", "Reincarnation", "Reverse Harem", "Romance", "Samurai", "School Life", 
        "Sci-Fi", "Self-Published", "Sexual Violence", "Shota", "Slice of Life", "Sports", 
        "Superhero", "Supernatural", "Survival", "Thriller", "Time Travel", "Tragedy", 
        "Vampires", "Video Games", "Virtual Reality", "Web Comic", "Wuxia", "Zombies"
    ],

    formats: [
        "Manga", "Manhwa", "Manhua", "Webtoon"
    ],

    tagIds: {
        "4-Koma": "b11fda93-8f1d-4bef-b2ed-8803d3733170",
        "Action": "391b0423-d847-456f-aff0-8b0cfc03066b",
        "Adaptation": "f4122d1c-3b44-44d0-9936-ff7502c39ad3",
        "Adventure": "87cc87cd-a395-47af-b27a-93258283bbc6",
        "Animals": "3de8c75d-8ee3-48ff-98ee-e20a65c86451",
        "Anthology": "51d83883-4103-437c-b4b1-731cb73d786c",
        "Award Winning": "0a39b5a1-b235-4886-a747-1d05d216532d",
        "Boys' Love": "5920b825-4181-4a17-beeb-9918b0ff7a30",
        "Comedy": "4d32cc48-9f00-4cca-9b5a-a839f0764984",
        "Cooking": "ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869",
        "Crime": "5ca48985-9a9d-4bd8-be29-80dc0303db72",
        "Crossdressing": "9ab53f92-3eed-4e9b-903a-917c86035ee3",
        "Delinquents": "da2d50ca-3018-4cc0-ac7a-6b7d472a29ea",
        "Demons": "39730448-9a5f-48a2-85b0-a70db87b1233",
        "Doujinshi": "b13b2a48-c720-44a9-9c77-39c9979373fb",
        "Drama": "b9af3a63-f058-46de-a9a0-e0c13906197a",
        "Fan Colored": "7b2ce280-79ef-4c09-9b58-12b7c23a9b78",
        "Fantasy": "cdc58593-87dd-415e-bbc0-2ec27bf404cc",
        "Full Color": "f5ba408b-0e7a-484d-8d49-4e9125ac96de",
        "Genderswap": "2bd2e8d0-f146-434a-9b51-fc9ff2c5fe6a",
        "Ghosts": "3bb26d85-09d5-4d2e-880c-c34b974339e9",
        "Girls' Love": "a3c67850-4684-404e-9b7f-c69850ee5da6",
        "Gore": "b29d6a3d-1569-4e7a-8caf-7557bc92cd5d",
        "Gyaru": "fad12b5e-68ba-460e-b933-9ae8318f5b65",
        "Harem": "aafb99c1-7f60-43fa-b75f-fc9502ce29c7",
        "Historical": "33771934-028e-4cb3-8744-691e866a923e",
        "Horror": "cdad7e68-1419-41dd-bdce-27753074a640",
        "Incest": "5bd0e105-4481-44ca-b6e7-7544da56b1a3",
        "Isekai": "ace04997-f6bd-436e-b261-779182193d3d",
        "Loli": "2d1f5d56-a1e5-4d0d-a961-2193588b08ec",
        "Long Strip": "3e2b8dae-350e-4ab8-a8ce-016e844b9f0d",
        "Mafia": "85daba54-a71c-4554-8a28-9901a8b0afad",
        "Magic": "a1f53773-c69a-4ce5-8cab-fffcd90b1565",
        "Magical Girls": "81c836c9-914a-4eca-981a-560dad663e73",
        "Martial Arts": "799c202e-7daa-44eb-9cf7-8a3c0441531e",
        "Mecha": "50880a9d-5440-4732-9afb-8f457127e836",
        "Medical": "c8cbe35b-1b2b-4a3f-9c37-db84c4514856",
        "Military": "ac72833b-c4e9-4878-b9db-6c8a4a99444a",
        "Monster Girls": "dd1f77c5-dea9-4e2b-97ae-224af09caf99",
        "Monsters": "36fd93ea-e8b8-445e-b836-358f02b3d33d",
        "Music": "f42fbf9e-188a-447b-9fdc-f19dc1e4d685",
        "Mystery": "ee968100-4191-4968-93d3-f82d72be7e46",
        "Ninja": "489dd859-9b61-4c37-af75-5b18e88daafc",
        "Office Workers": "92d6d951-ca5e-429c-ac78-451071cbf064",
        "Official Colored": "320831a8-4026-470b-94f6-8353740e6f04",
        "Oneshot": "0234a31e-a729-4e28-9d6a-3f87c4966b9e",
        "Philosophical": "b1e97889-25b4-4258-b28b-cd7f4d28ea9b",
        "Police": "df33b754-73a3-4c54-80e6-1a74a8058539",
        "Post-Apocalyptic": "9467335a-1b83-4497-9231-765337a00b96",
        "Psychological": "3b60b75c-a2d7-4860-ab56-05f391bb889c",
        "Reincarnation": "0bc90acb-ccc1-44ca-a34a-b9f3a73259d0",
        "Reverse Harem": "65761a2a-415e-47f3-bef2-a9dababba7a6",
        "Romance": "423e2eae-a7a2-4a8b-ac03-a8351462d71d",
        "Samurai": "81183756-1453-4c81-aa9e-f6e1b63be016",
        "School Life": "caaa44eb-cd40-4177-b930-79d3ef2afe87",
        "Sci-Fi": "256c8bd9-4904-4360-bf4f-508a76d67183",
        "Self-Published": "891cf039-b895-47f0-9229-bef4c96eccd4",
        "Sexual Violence": "97893a4c-12af-4dac-b6be-0dffb353568e",
        "Shota": "ddefd648-5140-4e5f-ba18-4eca4071d19b",
        "Slice of Life": "e5301a23-ebd9-49dd-a0cb-2add944c7fe9",
        "Sports": "69964a64-2f90-4d33-beeb-f3ed2875eb4c",
        "Superhero": "7064a261-a137-4d3a-8848-2d385de3a99c",
        "Supernatural": "eabc5b4c-6aff-42f3-b657-3e90cbd00b75",
        "Survival": "5fff9cde-849c-4d78-aab0-0d52b2ee1d25",
        "Thriller": "07251805-a27e-4d59-b488-f0bfbec15168",
        "Time Travel": "292e862b-2d17-4062-90a2-0356caa4ae27",
        "Tragedy": "f8f62932-27da-4fe4-8ee1-6779a8c5edba",
        "Vampires": "d7d1730f-6eb0-4ba6-9437-602cac38664c",
        "Video Games": "9438db5a-7e2a-4ac0-b39e-e0d95a34b8a8",
        "Virtual Reality": "8c86611e-fab7-4986-9dec-d1a2f44acdd5",
        "Web Comic": "e197df38-d0e7-43b5-9b09-2842d0c326dd",
        "Wuxia": "acc803a4-c95a-4c22-86fc-eb6b582d82a2",
        "Zombies": "631ef465-9aba-4afb-b0fc-ea10efe274a8"
    }
};
