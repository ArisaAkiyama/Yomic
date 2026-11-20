package id.yomic.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.model.DailyActivityStatItem
import id.yomic.mobile.model.GenreStatItem
import id.yomic.mobile.model.ReadingStatistics
import id.yomic.mobile.ui.i18n.yomicStrings
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.ui.theme.YomicThemeTokens
import kotlin.math.sqrt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReadingInsightsScreen(
    stats: ReadingStatistics,
    onBack: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    val s = yomicStrings
    var selectedDayIndex by remember { mutableIntStateOf(stats.dailyActivity.lastIndex.coerceAtLeast(0)) }

    val hours = stats.totalReadingMinutes / 60
    val mins = stats.totalReadingMinutes % 60
    val timeText = if (hours > 0) "${hours}${if (s.isEn) "h" else "j"} ${mins}${if (s.isEn) "m" else "m"}" else "${mins} ${if (s.isEn) "min" else "mnt"}"
    val completionText = "${"%.1f".format(stats.completionRatePercent).removeSuffix(".0")}%"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(tokens.canvas)
    ) {
        TopAppBar(
            colors = TopAppBarDefaults.topAppBarColors(containerColor = tokens.canvas),
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(YomicIcons.ArrowBack, contentDescription = "Back", tint = tokens.inkPrimary, modifier = Modifier.size(21.dp))
                }
            },
            title = {
                Text(s.navInsights, style = MaterialTheme.typography.titleLarge, color = tokens.inkPrimary)
            }
        )

        LazyColumn(
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            // 1. 2x2 Architectural Metric Cards (Equal row heights)
            item {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(IntrinsicSize.Min),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        InsightMetricCard(
                            icon = YomicIcons.Library,
                            label = s.statsLibraryCollection,
                            value = stats.totalLibraryManga.toString(),
                            unit = if (s.isEn) "series" else "komik",
                            meta = "${stats.completedMangaCount} ${if (s.isEn) "done" else "tamat"} · ${stats.readingMangaCount} ${if (s.isEn) "reading" else "dibaca"}",
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                        InsightMetricCard(
                            icon = YomicIcons.CheckCircle,
                            label = s.statsChaptersRead,
                            value = stats.totalChaptersRead.toString(),
                            unit = if (s.isEn) "ch." else "bab",
                            badge = completionText,
                            progress = (stats.completionRatePercent / 100f).coerceIn(0f, 1f),
                            meta = "${stats.totalChaptersRead} / ${stats.totalLibraryChapters}",
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(IntrinsicSize.Min),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        InsightMetricCard(
                            icon = YomicIcons.Fire,
                            label = s.statsDailyStreak,
                            value = stats.currentStreakDays.toString(),
                            unit = if (s.isEn) "days" else "hari",
                            meta = "${s.longestRecord} ${stats.longestStreakDays} ${if (s.isEn) "days" else "hari"} · ${stats.activeDaysCount} ${if (s.isEn) "active" else "aktif"}",
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                        InsightMetricCard(
                            icon = YomicIcons.Clock,
                            label = s.statsReadingTime,
                            value = timeText,
                            unit = "",
                            meta = "${stats.totalDownloadedChapters} ${if (s.isEn) "offline ch." else "bab offline"}",
                            modifier = Modifier.weight(1f).fillMaxHeight()
                        )
                    }
                }
            }

            // 2. 14-Day Reading Activity Chart (Interactive Bar Chart)
            item {
                val maxCh = stats.dailyActivity.maxOfOrNull { it.chaptersRead }?.coerceAtLeast(1) ?: 1
                val total14 = stats.dailyActivity.sumOf { it.chaptersRead }
                val activeDay = stats.dailyActivity.getOrNull(selectedDayIndex)

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.surface)
                        .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(s.statsLast14Days, style = MaterialTheme.typography.titleSmall, color = tokens.inkPrimary)
                            if (activeDay != null) {
                                Text(
                                    text = "${formatHumanDate(activeDay.fullDate)} · ${activeDay.chaptersRead} ${if (s.isEn) "chapters" else "bab"} (~${activeDay.minutesRead} ${if (s.isEn) "min" else "mnt"})",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = tokens.accent
                                )
                            }
                        }
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(tokens.accentTint)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text("$total14 ${if (s.isEn) "ch" else "bab"}", color = tokens.accent, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                        }
                    }

                    // 14-Column Damped-Scale Vertical Bars (mirrors updates-history.ts sqrt damping)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(145.dp),
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        verticalAlignment = Alignment.Bottom
                    ) {
                        stats.dailyActivity.forEachIndexed { idx, day ->
                            val isSelected = idx == selectedDayIndex
                            val isToday = idx == stats.dailyActivity.lastIndex
                            val ratio = if (day.chaptersRead > 0) {
                                (sqrt(day.chaptersRead.toFloat()) / sqrt(maxCh.toFloat())).coerceIn(0.14f, 1f)
                            } else 0f

                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .fillMaxHeight()
                                    .clip(RoundedCornerShape(6.dp))
                                    .clickable { selectedDayIndex = idx },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Bottom
                            ) {
                                if (day.chaptersRead > 0) {
                                    Text(
                                        text = day.chaptersRead.toString(),
                                        color = if (isSelected || isToday) tokens.accent else tokens.inkMuted,
                                        fontSize = 9.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Spacer(Modifier.height(3.dp))
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .weight(1f),
                                    contentAlignment = Alignment.BottomCenter
                                ) {
                                    if (day.chaptersRead > 0) {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth(0.75f)
                                                .fillMaxHeight(ratio)
                                                .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                                .background(
                                                    when {
                                                        isSelected -> tokens.accent
                                                        isToday -> tokens.accentVivid
                                                        else -> tokens.accent.copy(alpha = 0.45f)
                                                    }
                                                )
                                        )
                                    } else {
                                        Box(
                                            modifier = Modifier
                                                .fillMaxWidth(0.55f)
                                                .height(3.dp)
                                                .clip(RoundedCornerShape(2.dp))
                                                .background(tokens.borderSubtle)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(5.dp))
                                Text(
                                    text = if (idx % 3 == 0 || isToday) day.dateLabel.take(2) else "",
                                    color = if (isToday) tokens.accent else tokens.inkMuted,
                                    fontSize = 9.sp
                                )
                            }
                        }
                    }
                }
            }

            // 3. Library Genre Breakdown Panel
            item {
                val maxGenreCount = stats.topGenres.maxOfOrNull { it.mangaCount }?.coerceAtLeast(1) ?: 1
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(tokens.surface)
                        .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text(s.statsGenreBreakdown, style = MaterialTheme.typography.titleSmall, color = tokens.inkPrimary)
                    stats.topGenres.forEachIndexed { idx, g ->
                        val ratio = (g.mangaCount.toFloat() / maxGenreCount).coerceIn(0.08f, 1f)
                        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Text(
                                        text = "%02d".format(idx + 1),
                                        color = tokens.inkMuted,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                    Text(g.genre, color = tokens.inkPrimary, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                                }
                                Text(
                                    text = "${g.mangaCount} ${if (s.isEn) "series" else "komik"} · ${g.chaptersRead} ch",
                                    color = tokens.inkMuted,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                            LinearProgressIndicator(
                                progress = { ratio },
                                color = tokens.accent,
                                trackColor = tokens.surfaceAlt,
                                gapSize = 0.dp,
                                drawStopIndicator = {},
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(5.dp)
                                    .clip(RoundedCornerShape(99.dp))
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InsightMetricCard(
    icon: ImageVector,
    label: String,
    value: String,
    unit: String,
    meta: String,
    badge: String? = null,
    progress: Float? = null,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(tokens.surface)
            .border(0.8.dp, tokens.borderSubtle, RoundedCornerShape(14.dp))
            .padding(13.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = tokens.accent, modifier = Modifier.size(15.dp))
                Text(label, color = tokens.inkSecondary, fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold)
            }
            if (badge != null) {
                Text(badge, color = tokens.accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(value, color = tokens.inkPrimary, style = MaterialTheme.typography.headlineMedium)
            if (unit.isNotBlank()) {
                Text(unit, color = tokens.inkMuted, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(bottom = 3.dp))
            }
        }
        if (progress != null) {
            LinearProgressIndicator(
                progress = { progress },
                color = tokens.accent,
                trackColor = tokens.surfaceAlt,
                gapSize = 0.dp,
                drawStopIndicator = {},
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .clip(RoundedCornerShape(99.dp))
            )
        } else {
            Spacer(Modifier.weight(1f))
        }
        Text(meta, color = tokens.inkMuted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
    }
}

private fun formatHumanDate(iso: String): String {
    val parts = iso.split("-")
    if (parts.size != 3) return iso
    val months = listOf("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")
    val mIdx = (parts[1].toIntOrNull() ?: 1) - 1
    val day = parts[2].toIntOrNull()?.toString() ?: parts[2]
    val month = months.getOrElse(mIdx) { parts[1] }
    return "$day $month ${parts[0]}"
}

@Preview(name = "Reading Insights Dark", showBackground = true, widthDp = 390, heightDp = 820)
@Composable
fun ReadingInsightsPreview() {
    val sampleStats = ReadingStatistics(
        totalLibraryManga = 8,
        readingMangaCount = 5,
        completedMangaCount = 2,
        unreadMangaCount = 1,
        totalChaptersRead = 84,
        totalLibraryChapters = 115,
        completionRatePercent = 73.0f,
        totalDownloadedChapters = 12,
        currentStreakDays = 7,
        longestStreakDays = 11,
        totalReadingMinutes = 210,
        activeDaysCount = 12,
        topGenres = listOf(
            GenreStatItem("Action", 6, 62),
            GenreStatItem("Fantasy", 5, 51),
            GenreStatItem("Adventure", 4, 44),
            GenreStatItem("Comedy", 3, 30)
        ),
        dailyActivity = listOf(
            DailyActivityStatItem("07/11", "2026-11-07", 4, 10),
            DailyActivityStatItem("08/11", "2026-11-08", 0, 0),
            DailyActivityStatItem("09/11", "2026-11-09", 7, 18),
            DailyActivityStatItem("10/11", "2026-11-10", 12, 30),
            DailyActivityStatItem("11/11", "2026-11-11", 5, 13),
            DailyActivityStatItem("12/11", "2026-11-12", 8, 20),
            DailyActivityStatItem("13/11", "2026-11-13", 14, 35),
            DailyActivityStatItem("14/11", "2026-11-14", 6, 15),
            DailyActivityStatItem("15/11", "2026-11-15", 9, 23),
            DailyActivityStatItem("16/11", "2026-11-16", 11, 28),
            DailyActivityStatItem("17/11", "2026-11-17", 4, 10),
            DailyActivityStatItem("18/11", "2026-11-18", 8, 20),
            DailyActivityStatItem("19/11", "2026-11-19", 6, 15),
            DailyActivityStatItem("20/11", "2026-11-20", 10, 25)
        )
    )
    YomicTheme(darkTheme = true) {
        ReadingInsightsScreen(stats = sampleStats, onBack = {})
    }
}
