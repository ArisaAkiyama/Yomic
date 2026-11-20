package id.yomic.mobile.data

import id.yomic.mobile.model.ActivityUpdateItem
import id.yomic.mobile.model.AnnouncementItem
import id.yomic.mobile.model.CategoryItem
import id.yomic.mobile.model.ChapterItem
import id.yomic.mobile.model.DailyActivityStatItem
import id.yomic.mobile.model.DownloadQueueItem
import id.yomic.mobile.model.DownloadStatus
import id.yomic.mobile.model.ExtensionItem
import id.yomic.mobile.model.MalSearchResult
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.MangaStatus
import id.yomic.mobile.model.MangaType
import id.yomic.mobile.model.ServerStatus
import id.yomic.mobile.model.SourceLang
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object DemoDataRepository {

    private const val DAY_MS = 86_400_000L

    fun createCategories(): List<CategoryItem> = listOf(
        CategoryItem(id = 1, name = "Sedang Dibaca", sortOrder = 1),
        CategoryItem(id = 2, name = "Manhwa", sortOrder = 2),
        CategoryItem(id = 3, name = "Favorit", sortOrder = 3),
        CategoryItem(id = 4, name = "Tamat", sortOrder = 4)
    )

    fun createExtensions(): List<ExtensionItem> = listOf(
        // Installed (matching Yomic Desktop screenshots)
        ExtensionItem("kiryuu", "Kiryuu", "v1.0.3", SourceLang.ID, "https://v7.kiryuu.to", installed = true, accentColorHex = 0xFF0EA5E9, status = ServerStatus.ONLINE),
        ExtensionItem("komiku", "Komiku", "v1.0.1", SourceLang.ID, "https://komiku.org", installed = true, accentColorHex = 0xFF2563EB, status = ServerStatus.ONLINE),
        ExtensionItem("mangabat", "Mangabat", "v1.0.4", SourceLang.EN, "https://www.mangabats.com", installed = true, hasUpdate = true, accentColorHex = 0xFF10B981, status = ServerStatus.ONLINE),
        ExtensionItem("mangadex", "MangaDex", "v1.0.3", SourceLang.ALL, "https://mangadex.org", installed = true, accentColorHex = 0xFFFF6740, status = ServerStatus.ONLINE),
        ExtensionItem("softkomik", "Softkomik", "v1.11.2", SourceLang.ID, "https://softkomik.app", installed = true, isCloudflareProtected = true, accentColorHex = 0xFF38BDF8, status = ServerStatus.WARNING),
        ExtensionItem("westmanga", "WestManga", "v1.2.0", SourceLang.ID, "https://v1.westmanga.my", installed = true, accentColorHex = 0xFFEF4444, status = ServerStatus.ONLINE),
        // Available in repo (mirrors Plugins/Catalog)
        ExtensionItem("aarlas", "Aarlas", "v1.0.0", SourceLang.ID, "https://aarlas.id", installed = false, accentColorHex = 0xFF0284C7),
        ExtensionItem("bacakomik", "BacaKomik", "v1.4.2", SourceLang.ID, "https://bacakomik.my", installed = false, accentColorHex = 0xFF6366F1),
        ExtensionItem("komikindo", "KomikIndo", "v1.2.8", SourceLang.ID, "https://komikindo.ch", installed = false, accentColorHex = 0xFF8B5CF6),
        ExtensionItem("shinigami", "Shinigami", "v1.5.0", SourceLang.ID, "https://shinigami.asia", installed = false, isCloudflareProtected = true, accentColorHex = 0xFFEC4899),
        ExtensionItem("voratoon", "Voratoon", "v1.1.0", SourceLang.ID, "https://voratoon.com", installed = false, accentColorHex = 0xFF14B8A6),
        ExtensionItem("mangafire", "MangaFire", "v1.3.1", SourceLang.EN, "https://mangafire.to", installed = false, accentColorHex = 0xFFF97316),
        ExtensionItem("weebcentral", "WeebCentral", "v1.0.7", SourceLang.EN, "https://weebcentral.com", installed = false, accentColorHex = 0xFF06B6D4),
        ExtensionItem("doujindesu", "Doujindesu", "v1.0.9", SourceLang.ID, "https://doujindesu.tv", installed = false, accentColorHex = 0xFFE11D48, isNsfw = true)
    )

    private fun generateChapters(
        prefix: String,
        latestNumber: Int,
        count: Int,
        readUpTo: Int,
        downloadedSet: Set<Int> = emptySet(),
        bookmarkedSet: Set<Int> = emptySet(),
        scanlator: String = "Yomic Scans",
        titles: Map<Int, String> = emptyMap()
    ): List<ChapterItem> {
        val list = mutableListOf<ChapterItem>()
        for (i in 0 until count) {
            val num = latestNumber - i
            if (num <= 0) break
            val relDate = when (i) {
                0 -> "2 jam lalu"
                1 -> "2 hari lalu"
                2 -> "1 minggu lalu"
                else -> "${i + 1} minggu lalu"
            }
            list += ChapterItem(
                id = "${prefix}_ch_$num",
                number = num.toDouble(),
                title = titles[num] ?: "",
                releaseDate = relDate,
                isRead = num <= readUpTo,
                isBookmarked = num in bookmarkedSet,
                isDownloaded = num in downloadedSet,
                totalPages = 12 + (num % 7),
                lastPageRead = if (num == readUpTo) 9 else 1,
                scanlator = scanlator
            )
        }
        return list
    }

    fun createMangaList(): List<MangaItem> {
        val now = System.currentTimeMillis()
        return listOf(
            MangaItem(
                id = "kaoru-hana",
                title = "Kaoru Hana wa Rin to Saku",
                altTitle = "The Fragrant Flower Blooms with Dignity",
                author = "Saka Mikami",
                artist = "Saka Mikami",
                status = MangaStatus.ONGOING,
                type = MangaType.MANGA,
                sourceId = "komiku",
                sourceName = "Komiku",
                lang = SourceLang.ID,
                rating = 9.1,
                lastReadChapter = 205.0,
                lastReadPage = 14,
                lastReadTotalPages = 20,
                lastReadTimeAgo = "46 menit lalu",
                lastViewedEpoch = now - 2_760_000L,
                lastUpdateEpoch = now - 7_200_000L,
                inLibrary = true,
                isFavorite = true,
                categoryIds = listOf(1, 3),
                malTracked = true,
                malId = 144267,
                malTitle = "Kaoru Hana wa Rin to Saku",
                malStatus = "Reading",
                malScore = 9,
                malChaptersRead = 205,
                synopsis = "Di balik dua sekolah menengah yang saling bermusuhan, Chidori High yang dipenuhi siswa berandalan dan Kikyo Girls' Academy yang prestisius, Rintaro yang bertubuh tinggi dan berwajah garang bertemu Kaoruko di toko kue keluarganya. Pertemuan hangat ini perlahan meruntuhkan prasangka di antara kedua dunia mereka.",
                genres = listOf("Romance", "Drama", "Comedy", "Shounen", "Slice of Life"),
                coverPalette = Triple(0xFF1E1B4B, 0xFF6366F1, 0xFFF472B6),
                chapters = generateChapters(
                    prefix = "kh",
                    latestNumber = 207,
                    count = 18,
                    readUpTo = 205,
                    downloadedSet = setOf(205, 206, 207),
                    bookmarkedSet = setOf(206, 200),
                    scanlator = "Komiku",
                    titles = mapOf(
                        207 to "Bunga yang Mekar di Sore Hari",
                        206 to "Janji di Depan Toko Kue",
                        205 to "Langkah Kecil Rintaro"
                    )
                )
            ),
            MangaItem(
                id = "sakamoto-days",
                title = "Sakamoto Days",
                altTitle = "SAKAMOTO DAYS",
                author = "Yuto Suzuki",
                artist = "Yuto Suzuki",
                status = MangaStatus.ONGOING,
                type = MangaType.MANGA,
                sourceId = "komiku",
                sourceName = "Komiku",
                lang = SourceLang.ID,
                rating = 8.9,
                lastReadChapter = 281.0,
                lastReadPage = 18,
                lastReadTotalPages = 19,
                lastReadTimeAgo = "3 jam lalu",
                lastViewedEpoch = now - 10_800_000L,
                lastUpdateEpoch = now - 14_400_000L,
                inLibrary = true,
                isFavorite = true,
                categoryIds = listOf(1, 3),
                malTracked = true,
                malId = 131334,
                malTitle = "Sakamoto Days",
                malStatus = "Reading",
                malScore = 9,
                malChaptersRead = 281,
                synopsis = "Taro Sakamoto pernah menjadi pembunuh bayaran paling ditakuti di dunia bawah tanah. Namun demi cinta pada pandangan pertama, ia pensiun, menikah, menjadi ayah, dan kini mengelola toko kelontong sederhana—sampai masa lalunya kembali mengejar.",
                genres = listOf("Action", "Comedy", "Shounen"),
                coverPalette = Triple(0xFF450A0A, 0xFFDC2626, 0xFFFBBF24),
                chapters = generateChapters(
                    prefix = "sd",
                    latestNumber = 284,
                    count = 16,
                    readUpTo = 281,
                    downloadedSet = setOf(282, 283),
                    bookmarkedSet = setOf(284),
                    scanlator = "Komiku",
                    titles = mapOf(
                        284 to "Serangan Mendadak Order",
                        283 to "Aturan Toko Sakamoto",
                        282 to "Peluru Terakhir"
                    )
                )
            ),
            MangaItem(
                id = "solo-leveling",
                title = "Solo Leveling",
                altTitle = "Na Honjaman Level Up",
                author = "Chugong",
                artist = "DUBU (REDICE Studio)",
                status = MangaStatus.COMPLETED,
                type = MangaType.MANHWA,
                sourceId = "kiryuu",
                sourceName = "Kiryuu",
                lang = SourceLang.ID,
                rating = 9.0,
                lastReadChapter = 200.0,
                lastReadPage = 22,
                lastReadTotalPages = 22,
                lastReadTimeAgo = "Kemarin",
                lastViewedEpoch = now - DAY_MS,
                lastUpdateEpoch = now - (DAY_MS * 10),
                inLibrary = true,
                isFavorite = true,
                categoryIds = listOf(2, 3, 4),
                malTracked = true,
                malStatus = "Completed",
                malScore = 9,
                malChaptersRead = 200,
                synopsis = "Sepuluh tahun setelah Gerbang dimensi terbuka, Sung Jin-Woo yang dikenal sebagai Hunter terlemah di seluruh umat manusia memperoleh Sistem misterius yang memungkinkannya naik level tanpa batas dan membangkitkan pasukan bayangan.",
                genres = listOf("Action", "Fantasy", "Adventure"),
                coverPalette = Triple(0xFF071426, 0xFF1D4ED8, 0xFF38BDF8),
                chapters = generateChapters(
                    prefix = "sl",
                    latestNumber = 200,
                    count = 15,
                    readUpTo = 200,
                    downloadedSet = setOf(198, 199, 200),
                    bookmarkedSet = setOf(200),
                    scanlator = "Kiryuu Team",
                    titles = mapOf(
                        200 to "Epilog: Sang Raja Bayangan",
                        199 to "Pertarungan Terakhir",
                        198 to "Bangkitlah (Arise)"
                    )
                )
            ),
            MangaItem(
                id = "orv",
                title = "Omniscient Reader's Viewpoint",
                altTitle = "Jeonjijeok Dokja Sijeom",
                author = "Sing Shong",
                artist = "Sleepy-C",
                status = MangaStatus.ONGOING,
                type = MangaType.MANHWA,
                sourceId = "kiryuu",
                sourceName = "Kiryuu",
                lang = SourceLang.ID,
                rating = 9.3,
                lastReadChapter = 248.0,
                lastReadPage = 8,
                lastReadTotalPages = 16,
                lastReadTimeAgo = "Kemarin",
                lastViewedEpoch = now - (DAY_MS + 3_600_000L),
                lastUpdateEpoch = now - 21_600_000L,
                inLibrary = true,
                isFavorite = true,
                categoryIds = listOf(1, 2, 3),
                malTracked = false,
                synopsis = "Kim Dokja hanyalah pekerja kantoran biasa yang menjadi satu-satunya pembaca setia novel web 'Three Ways to Survive the Apocalypse'. Saat bab terakhir selesai ia baca, dunia nyata seketika berubah persis seperti skenario novel tersebut.",
                genres = listOf("Action", "Fantasy", "Adventure", "Sci-Fi"),
                coverPalette = Triple(0xFF082F49, 0xFF0284C7, 0xFF67E8F9),
                chapters = generateChapters(
                    prefix = "orv",
                    latestNumber = 252,
                    count = 16,
                    readUpTo = 248,
                    downloadedSet = setOf(249),
                    scanlator = "Kiryuu Team",
                    titles = mapOf(
                        252 to "Skenario Tersembunyi Konstelasi",
                        251 to "Raja Tanpa Tahta",
                        250 to "Panggung Para Dokkaebi"
                    )
                )
            ),
            MangaItem(
                id = "one-piece",
                title = "One Piece",
                altTitle = "ワンピース",
                author = "Eiichiro Oda",
                artist = "Eiichiro Oda",
                status = MangaStatus.ONGOING,
                type = MangaType.MANGA,
                sourceId = "mangadex",
                sourceName = "MangaDex",
                lang = SourceLang.EN,
                rating = 9.5,
                lastReadChapter = 1196.0,
                lastReadPage = 11,
                lastReadTotalPages = 17,
                lastReadTimeAgo = "2 hari lalu",
                lastViewedEpoch = now - (DAY_MS * 2),
                lastUpdateEpoch = now - (DAY_MS - 3_600_000L),
                inLibrary = true,
                isFavorite = true,
                categoryIds = listOf(1, 3),
                malTracked = true,
                malId = 13,
                malTitle = "One Piece",
                malStatus = "Reading",
                malScore = 10,
                malChaptersRead = 1196,
                synopsis = "Monkey D. Luffy berlayar melintasi Grand Line bersama kru Bajak Laut Topi Jerami demi menemukan harta karun legendaris One Piece dan mewujudkan mimpinya menjadi Raja Bajak Laut.",
                genres = listOf("Action", "Adventure", "Fantasy", "Shounen"),
                coverPalette = Triple(0xFF172554, 0xFF0066CC, 0xFF60A5FA),
                chapters = generateChapters(
                    prefix = "op",
                    latestNumber = 1198,
                    count = 14,
                    readUpTo = 1196,
                    bookmarkedSet = setOf(1198),
                    scanlator = "TCB / MangaDex",
                    titles = mapOf(
                        1198 to "Pulau Para Monster",
                        1197 to "Rahasia Elbaf",
                        1196 to "Tekad Para Raksasa"
                    )
                )
            ),
            MangaItem(
                id = "frieren",
                title = "Sousou no Frieren",
                altTitle = "Frieren: Beyond Journey's End",
                author = "Kanehito Yamada",
                artist = "Tsukasa Abe",
                status = MangaStatus.ONGOING,
                type = MangaType.MANGA,
                sourceId = "mangadex",
                sourceName = "MangaDex",
                lang = SourceLang.EN,
                rating = 9.4,
                lastReadChapter = 136.0,
                lastReadPage = 6,
                lastReadTotalPages = 18,
                lastReadTimeAgo = "3 hari lalu",
                lastViewedEpoch = now - (DAY_MS * 3),
                lastUpdateEpoch = now - (DAY_MS * 2),
                inLibrary = true,
                isFavorite = false,
                categoryIds = listOf(1),
                malTracked = false,
                synopsis = "Setelah petualangan sepuluh tahun mengalahkan Raja Iblis, penyihir elf Frieren menyadari betapa singkatnya usia manusia. Ia memulai perjalanan baru menuju utara demi lebih memahami hati manusia dan mengenang rekan-rekan lamanya.",
                genres = listOf("Adventure", "Drama", "Fantasy"),
                coverPalette = Triple(0xFF0F2922, 0xFF059669, 0xFF6EE7B7),
                chapters = generateChapters(
                    prefix = "fr",
                    latestNumber = 140,
                    count = 14,
                    readUpTo = 136,
                    scanlator = "Kirei Cake",
                    titles = mapOf(
                        140 to "Ibu Kota Kekaisaran",
                        139 to "Sihir Bunga Biru"
                    )
                )
            ),
            MangaItem(
                id = "eleceed",
                title = "Eleceed",
                altTitle = "일렉시드",
                author = "Son Jeho",
                artist = "ZHENA",
                status = MangaStatus.ONGOING,
                type = MangaType.MANHWA,
                sourceId = "softkomik",
                sourceName = "Softkomik",
                lang = SourceLang.ID,
                rating = 8.8,
                lastReadChapter = 330.0,
                lastReadPage = 1,
                lastReadTotalPages = 15,
                lastReadTimeAgo = "",
                lastViewedEpoch = 0L,
                lastUpdateEpoch = now - (DAY_MS * 3),
                inLibrary = true,
                isFavorite = false,
                categoryIds = listOf(2),
                malTracked = false,
                synopsis = "Jiwoo adalah pemuda berhati lembut dengan refleks super cepat yang gemar menyelamatkan kucing jalanan. Hidupnya berubah total setelah ia menolong seekor kucing gendut yang ternyata adalah tubuh sementara Kayden, Awakener terkuat di dunia.",
                genres = listOf("Action", "Comedy", "Supernatural"),
                coverPalette = Triple(0xFF3B0764, 0xFF7C3AED, 0xFFC084FC),
                chapters = generateChapters(
                    prefix = "el",
                    latestNumber = 336,
                    count = 12,
                    readUpTo = 324,
                    scanlator = "Softkomik"
                )
            ),
            MangaItem(
                id = "blue-lock",
                title = "Blue Lock",
                altTitle = "ブルーロック",
                author = "Muneyuki Kaneshiro",
                artist = "Yusuke Nomura",
                status = MangaStatus.ONGOING,
                type = MangaType.MANGA,
                sourceId = "westmanga",
                sourceName = "WestManga",
                lang = SourceLang.ID,
                rating = 8.7,
                lastReadChapter = 290.0,
                lastReadPage = 5,
                lastReadTotalPages = 16,
                lastReadTimeAgo = "4 hari lalu",
                lastViewedEpoch = now - (DAY_MS * 4),
                lastUpdateEpoch = now - (DAY_MS * 4),
                inLibrary = false,
                isFavorite = false,
                synopsis = "Demi menciptakan striker egois terhebat yang mampu membawa Jepang menjuarai Piala Dunia, proyek fasilitas pelatihan ekstrem bernama Blue Lock mengumpulkan 300 penyerang SMA terbaik untuk saling mengeliminasi.",
                genres = listOf("Sports", "Drama", "Shounen"),
                coverPalette = Triple(0xFF0A192F, 0xFF1D4ED8, 0xFF22D3EE),
                chapters = generateChapters(prefix = "bl", latestNumber = 294, count = 12, readUpTo = 290, scanlator = "WestManga")
            ),
            MangaItem(
                id = "martial-peak",
                title = "Martial Peak",
                altTitle = "Wu Lian Dian Feng",
                author = "Momo",
                artist = "Pikapi",
                status = MangaStatus.COMPLETED,
                type = MangaType.MANHUA,
                sourceId = "komiku",
                sourceName = "Komiku",
                lang = SourceLang.ID,
                rating = 8.4,
                lastReadChapter = 1.0,
                lastReadPage = 1,
                lastReadTotalPages = 14,
                lastReadTimeAgo = "",
                lastViewedEpoch = 0L,
                lastUpdateEpoch = now - (DAY_MS * 5),
                inLibrary = false,
                isFavorite = false,
                synopsis = "Perjalanan menuju puncak seni bela diri adalah jalan yang sunyi dan panjang. Yang Kai, murid rendahan dari High Heaven Pavilion, menemukan buku hitam misterius yang membuka takdirnya menembus batas dunia kultivasi.",
                genres = listOf("Action", "Adventure", "Fantasy", "Martial Arts"),
                coverPalette = Triple(0xFF422006, 0xFFD97706, 0xFFFDE047),
                chapters = generateChapters(prefix = "mp", latestNumber = 3800, count = 10, readUpTo = 0, scanlator = "Komiku")
            ),
            MangaItem(
                id = "dungeon-meshi",
                title = "Dungeon Meshi",
                altTitle = "Delicious in Dungeon",
                author = "Ryoko Kui",
                artist = "Ryoko Kui",
                status = MangaStatus.COMPLETED,
                type = MangaType.MANGA,
                sourceId = "mangabat",
                sourceName = "Mangabat",
                lang = SourceLang.EN,
                rating = 9.2,
                lastReadChapter = 97.0,
                lastReadPage = 24,
                lastReadTotalPages = 24,
                lastReadTimeAgo = "5 hari lalu",
                lastViewedEpoch = now - (DAY_MS * 5),
                lastUpdateEpoch = now - (DAY_MS * 15),
                inLibrary = true,
                isFavorite = false,
                categoryIds = listOf(4),
                malTracked = true,
                malStatus = "Completed",
                malScore = 9,
                malChaptersRead = 97,
                synopsis = "Ketika adik Laios ditelan oleh Naga Merah jauh di dalam labirin bawah tanah, kelompok petualangnya yang kehabisan perbekalan memutuskan satu-satunya cara bertahan hidup: memasak monster dungeon menjadi hidangan lezat.",
                genres = listOf("Adventure", "Comedy", "Fantasy"),
                coverPalette = Triple(0xFF27180C, 0xFFB45309, 0xFFFDBA74),
                chapters = generateChapters(prefix = "dm", latestNumber = 97, count = 10, readUpTo = 97, scanlator = "EHScans")
            )
        )
    }

    fun createInitialUpdates(): List<ActivityUpdateItem> {
        val now = System.currentTimeMillis()
        return listOf(
            ActivityUpdateItem(
                id = "upd-1",
                mangaId = "kaoru-hana",
                mangaTitle = "Kaoru Hana wa Rin to Saku",
                chapterNumber = 207.0,
                chapterTitle = "Bunga yang Mekar di Sore Hari",
                sourceName = "Komiku",
                lang = SourceLang.ID,
                timeAgo = "2 jam lalu",
                dateFetchEpoch = now - 7_200_000L,
                isNew = true,
                extraChaptersCount = 1
            ),
            ActivityUpdateItem(
                id = "upd-2",
                mangaId = "sakamoto-days",
                mangaTitle = "Sakamoto Days",
                chapterNumber = 284.0,
                chapterTitle = "Serangan Mendadak Order",
                sourceName = "Komiku",
                lang = SourceLang.ID,
                timeAgo = "4 jam lalu",
                dateFetchEpoch = now - 14_400_000L,
                isNew = true,
                extraChaptersCount = 2
            ),
            ActivityUpdateItem(
                id = "upd-3",
                mangaId = "orv",
                mangaTitle = "Omniscient Reader's Viewpoint",
                chapterNumber = 252.0,
                chapterTitle = "Skenario Tersembunyi Konstelasi",
                sourceName = "Kiryuu",
                lang = SourceLang.ID,
                timeAgo = "6 jam lalu",
                dateFetchEpoch = now - 21_600_000L,
                isNew = true,
                extraChaptersCount = 3
            ),
            ActivityUpdateItem(
                id = "upd-4",
                mangaId = "one-piece",
                mangaTitle = "One Piece",
                chapterNumber = 1198.0,
                chapterTitle = "Pulau Para Monster",
                sourceName = "MangaDex",
                lang = SourceLang.EN,
                timeAgo = "Kemarin",
                dateFetchEpoch = now - DAY_MS,
                isNew = true,
                extraChaptersCount = 1
            ),
            ActivityUpdateItem(
                id = "upd-5",
                mangaId = "frieren",
                mangaTitle = "Sousou no Frieren",
                chapterNumber = 140.0,
                chapterTitle = "Ibu Kota Kekaisaran",
                sourceName = "MangaDex",
                lang = SourceLang.EN,
                timeAgo = "2 hari lalu",
                dateFetchEpoch = now - (DAY_MS * 2),
                isNew = false
            )
        )
    }

    fun createInitialDownloads(): List<DownloadQueueItem> = listOf(
        DownloadQueueItem(
            id = "dl-1",
            mangaId = "orv",
            mangaTitle = "Omniscient Reader's Viewpoint",
            chapterLabel = "Chapter 252",
            chapterNumber = 252.0,
            sourceName = "Kiryuu",
            progressPercent = 64,
            speedText = "3.4 MB/s",
            sizeText = "18.2 MB",
            status = DownloadStatus.DOWNLOADING
        ),
        DownloadQueueItem(
            id = "dl-2",
            mangaId = "sakamoto-days",
            mangaTitle = "Sakamoto Days",
            chapterLabel = "Chapter 284",
            chapterNumber = 284.0,
            sourceName = "Komiku",
            progressPercent = 28,
            speedText = "Dijeda",
            sizeText = "14.6 MB",
            status = DownloadStatus.PAUSED
        ),
        DownloadQueueItem(
            id = "dl-3",
            mangaId = "kaoru-hana",
            mangaTitle = "Kaoru Hana wa Rin to Saku",
            chapterLabel = "Chapter 207",
            chapterNumber = 207.0,
            sourceName = "Komiku",
            progressPercent = 100,
            speedText = "",
            sizeText = "12.4 MB",
            status = DownloadStatus.COMPLETED
        ),
        DownloadQueueItem(
            id = "dl-4",
            mangaId = "solo-leveling",
            mangaTitle = "Solo Leveling",
            chapterLabel = "Chapter 200",
            chapterNumber = 200.0,
            sourceName = "Kiryuu",
            progressPercent = 100,
            speedText = "",
            sizeText = "21.8 MB",
            status = DownloadStatus.COMPLETED
        )
    )

    fun createAnnouncements(): List<AnnouncementItem> = listOf(
        AnnouncementItem(
            id = "2026-11-yomic-mobile-preview",
            title = "Selamat Datang di Yomic Mobile (Native Android)",
            date = "2026-11-20",
            typeLabel = "Rilis Baru",
            isUnread = true,
            content = "Halo pembaca setia Yomic!\n\nYomic kini hadir dalam bentuk aplikasi Android Native berbasis Kotlin & Jetpack Compose Material 3 dengan gaya navigasi 5-tab ala Mihon/Tachiyomi yang ringan dan responsif.\n\nSorotan UI Mobile:\n• Tema Oceanic Light & Antigravity Carbon Dark khas Yomic\n• Pembaca layar penuh dengan 3 mode (Webtoon, Halaman Tunggal, Dua Halaman) + Tap Zones & Pinch Zoom\n• Filter & Kategori lewat Bottom Sheet yang ramah satu tangan\n• Dashboard Statistik Membaca 14 hari & dukungan bilingual ID / EN instan."
        ),
        AnnouncementItem(
            id = "2026-08-15-komikcast-shutdown-v2",
            title = "Pemberitahuan Penutupan Resmi Server Komikcast",
            date = "2026-08-15",
            typeLabel = "Info",
            isUnread = false,
            content = "Halo pembaca setia Yomic,\n\nKami ingin menyampaikan informasi bahwa sumber komik Komikcast telah resmi menghentikan operasional server dan situs web mereka secara permanen karena kendala kritis yang tidak dapat dipulihkan.\n\nInformasi Penting:\n• Ekstensi dan chapter dari sumber Komikcast tidak lagi dapat diakses melalui aplikasi.\n• Proyek terjemahan yang belum selesai dikabarkan akan dilanjutkan melalui Voratoon.\n• Silakan gunakan menu Jelajahi → Ekstensi untuk menemukan sumber alternatif lainnya yang tersedia di Yomic."
        ),
        AnnouncementItem(
            id = "2026-08-15-welcome-v2",
            title = "Selamat Datang di Papan Pengumuman Yomic!",
            date = "2026-08-15",
            typeLabel = "Info",
            isUnread = false,
            content = "Halo Teman-teman Pembaca & Komunitas Yomic,\n\nMelalui papan pengumuman ini, Anda akan mendapatkan informasi berkala mengenai catatan rilis, status server ekstensi komik, serta berita penting seputar ekosistem Yomic.\n\nTerima kasih atas dukungan dan masukan Anda!"
        )
    )

    fun createBaseDailyActivity(): List<DailyActivityStatItem> {
        val sampleCounts = listOf(4, 0, 7, 12, 3, 0, 6, 9, 15, 5, 8, 11, 6, 9)
        val cal = Calendar.getInstance()
        val labelFmt = SimpleDateFormat("dd/MM", Locale.getDefault())
        val fullFmt = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

        return (13 downTo 0).mapIndexed { index, daysAgo ->
            val d = (cal.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -daysAgo) }
            val ch = sampleCounts[index]
            DailyActivityStatItem(
                dateLabel = labelFmt.format(d.time),
                fullDate = fullFmt.format(d.time),
                chaptersRead = ch,
                minutesRead = if (ch > 0) (ch * 2.5f).toInt().coerceAtLeast(1) else 0
            )
        }
    }

    fun searchMalCatalog(query: String): List<MalSearchResult> {
        val catalog = listOf(
            MalSearchResult(144267, "Kaoru Hana wa Rin to Saku", "Manga", 0, 8.85, 0xFF6366F1),
            MalSearchResult(131334, "Sakamoto Days", "Manga", 0, 8.28, 0xFFDC2626),
            MalSearchResult(121496, "Solo Leveling", "Manhwa", 200, 8.66, 0xFF2563EB),
            MalSearchResult(132214, "Omniscient Reader's Viewpoint", "Manhwa", 0, 8.79, 0xFF0EA5E9),
            MalSearchResult(132215, "Omniscient Reader (Light Novel)", "Novel", 551, 9.04, 0xFF0284C7),
            MalSearchResult(13, "One Piece", "Manga", 0, 9.22, 0xFF1D4ED8),
            MalSearchResult(126287, "Sousou no Frieren", "Manga", 0, 8.77, 0xFF059669),
            MalSearchResult(131910, "Eleceed", "Manhwa", 0, 8.46, 0xFF7C3AED),
            MalSearchResult(114745, "Blue Lock", "Manga", 0, 8.34, 0xFF0369A1),
            MalSearchResult(108914, "Martial Peak", "Manhua", 3800, 7.51, 0xFFD97706),
            MalSearchResult(85781, "Dungeon Meshi", "Manga", 97, 8.65, 0xFFB45309)
        )
        val q = query.trim().lowercase()
        if (q.isEmpty()) return catalog.take(6)
        val tokens = q.split(Regex("\\s+")).filter { it.length >= 2 }
        val matched = catalog.filter { entry ->
            val lower = entry.title.lowercase()
            lower.contains(q) || (tokens.isNotEmpty() && tokens.any { lower.contains(it) })
        }
        return if (matched.isNotEmpty()) {
            matched
        } else {
            val clean = query.trim().replaceFirstChar { it.uppercase() }
            listOf(
                MalSearchResult(
                    id = 150000 + (q.hashCode().let { if (it < 0) -it else it } % 45000),
                    title = clean,
                    mediaType = "Manga",
                    chapters = 0,
                    score = 8.15,
                    accentColorHex = 0xFF2E51A2
                )
            )
        }
    }
}
