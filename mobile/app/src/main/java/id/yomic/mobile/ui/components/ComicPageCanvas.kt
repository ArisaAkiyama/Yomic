package id.yomic.mobile.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.model.MangaItem
import id.yomic.mobile.model.MangaType

/**
 * Stylized native Compose manga/webtoon page canvas for offline UI verification.
 * Renders distinct panel layouts, dramatic speed lines, and speech bubbles per page index.
 */
@Composable
fun ComicPageCanvas(
    manga: MangaItem,
    chapterNumber: String,
    chapterTitle: String,
    pageIndex: Int,
    totalPages: Int,
    sharpened: Boolean = false,
    autoCrop: Boolean = false,
    modifier: Modifier = Modifier
) {
    val isWebtoonColor = manga.type == MangaType.MANHWA || manga.type == MangaType.MANHUA
    val accent = Color(manga.coverPalette.third)
    val primary = Color(manga.coverPalette.second)
    val deep = Color(manga.coverPalette.first)

    val pageBg = if (isWebtoonColor) Color(0xFF0E131D) else Color(0xFFF6F6F2)
    val inkColor = if (isWebtoonColor) Color(0xFFF1F5F9) else Color(0xFF111827)
    val strokeColor = if (isWebtoonColor) Color(0xFF334155) else Color(0xFF18181B)
    val borderWidth = if (sharpened) 2.2f else 1.4f
    val outerPad = if (autoCrop) 4.dp else 14.dp

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(if (isWebtoonColor) 0.62f else 0.70f)
            .background(pageBg)
            .padding(outerPad)
    ) {
        if (pageIndex == 1) {
            // Chapter Splash Cover Page
            Canvas(modifier = Modifier.fillMaxSize()) {
                drawRoundRect(
                    brush = Brush.verticalGradient(
                        colors = if (isWebtoonColor) {
                            listOf(primary.copy(alpha = 0.85f), deep, Color(0xFF070A10))
                        } else {
                            listOf(Color(0xFFECECE6), Color(0xFFDCDCD4))
                        }
                    ),
                    cornerRadius = CornerRadius(14f, 14f)
                )
                // Action speedlines radiating from center
                val cx = size.width * 0.5f
                val cy = size.height * 0.42f
                for (angleDeg in 0 until 360 step 15) {
                    val rad = Math.toRadians(angleDeg.toDouble())
                    val rStart = size.width * 0.22f
                    val rEnd = size.width * 0.72f
                    drawLine(
                        color = (if (isWebtoonColor) accent else Color(0xFF18181B)).copy(alpha = 0.14f),
                        start = Offset(cx + (kotlin.math.cos(rad) * rStart).toFloat(), cy + (kotlin.math.sin(rad) * rStart).toFloat()),
                        end = Offset(cx + (kotlin.math.cos(rad) * rEnd).toFloat(), cy + (kotlin.math.sin(rad) * rEnd).toFloat()),
                        strokeWidth = if (angleDeg % 30 == 0) 2.5f else 1.2f
                    )
                }
                drawRoundRect(
                    color = strokeColor,
                    cornerRadius = CornerRadius(14f, 14f),
                    style = Stroke(width = borderWidth * 1.4f)
                )
            }
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.SpaceBetween,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(99.dp))
                        .background(if (isWebtoonColor) Color(0x66000000) else Color(0xFF18181B))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "${manga.sourceName.uppercase()} • CHAPTER $chapterNumber",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp
                    )
                }

                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = manga.title,
                        color = inkColor,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        lineHeight = 27.sp
                    )
                    if (chapterTitle.isNotBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(
                            text = "“$chapterTitle”",
                            color = if (isWebtoonColor) accent else Color(0xFF3F3F46),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Text(
                    text = "YOMIC MOBILE READER • PAGE $pageIndex / $totalPages",
                    color = inkColor.copy(alpha = 0.55f),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 0.8.sp
                )
            }
        } else {
            // Dynamic Multi-Panel Comic Page Layout
            Column(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Panel 1 (Wide Cinematic Panel)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1.1f)
                        .clip(RoundedCornerShape(6.dp))
                        .border(borderWidth.dp, strokeColor, RoundedCornerShape(6.dp))
                        .background(
                            if (isWebtoonColor) {
                                Brush.linearGradient(listOf(deep, primary.copy(alpha = 0.55f)))
                            } else {
                                Brush.linearGradient(listOf(Color(0xFFE7E7E0), Color(0xFFFDFDFB)))
                            }
                        )
                        .padding(14.dp)
                ) {
                    // Stylized Speech Bubble
                    Box(
                        modifier = Modifier
                            .align(if (pageIndex % 2 == 0) Alignment.TopEnd else Alignment.TopStart)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color.White)
                            .border(1.3.dp, Color(0xFF18181B), RoundedCornerShape(16.dp))
                            .padding(horizontal = 12.dp, vertical = 7.dp)
                    ) {
                        Text(
                            text = when (pageIndex % 4) {
                                0 -> "Tunggu... aura ini semakin kuat!"
                                1 -> "Kita tidak boleh mundur sekarang."
                                2 -> "Jadi ini rahasia di balik gerbang itu..."
                                else -> "Bersiaplah untuk babak berikutnya!"
                            },
                            color = Color(0xFF111827),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    Text(
                        text = "PANEL ${(pageIndex - 1) * 3 + 1}",
                        color = inkColor.copy(alpha = 0.35f),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.BottomStart)
                    )
                }

                // Panel 2 & 3 (Split Duo Panels)
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .weight(if (pageIndex % 2 == 0) 1.25f else 0.85f)
                            .fillMaxSize()
                            .clip(RoundedCornerShape(6.dp))
                            .border(borderWidth.dp, strokeColor, RoundedCornerShape(6.dp))
                            .background(if (isWebtoonColor) Color(0xFF161F30) else Color(0xFFEEEEEC))
                            .padding(10.dp)
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            drawCircle(
                                color = (if (isWebtoonColor) accent else Color(0xFF18181B)).copy(alpha = 0.16f),
                                radius = size.minDimension * 0.32f,
                                center = Offset(size.width * 0.5f, size.height * 0.5f)
                            )
                        }
                        Text(
                            text = "PANEL ${(pageIndex - 1) * 3 + 2}",
                            color = inkColor.copy(alpha = 0.4f),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.align(Alignment.BottomStart)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .weight(if (pageIndex % 2 == 0) 0.85f else 1.25f)
                            .fillMaxSize()
                            .clip(RoundedCornerShape(6.dp))
                            .border(borderWidth.dp, strokeColor, RoundedCornerShape(6.dp))
                            .background(if (isWebtoonColor) deep.copy(alpha = 0.85f) else Color(0xFFE2E2DC))
                            .padding(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .align(Alignment.Center)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color.White)
                                .border(1.2.dp, Color(0xFF18181B), RoundedCornerShape(12.dp))
                                .padding(horizontal = 10.dp, vertical = 5.dp)
                        ) {
                            Text(
                                text = "SFX: WHOOSH!",
                                color = Color(0xFF111827),
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }

                // Panel 4 (Bottom Wide Narrative Panel)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(0.9f)
                        .clip(RoundedCornerShape(6.dp))
                        .border(borderWidth.dp, strokeColor, RoundedCornerShape(6.dp))
                        .background(
                            if (isWebtoonColor) Color(0xFF111827) else Color(0xFFF3F3EE)
                        )
                        .padding(12.dp)
                ) {
                    Text(
                        text = "${manga.title} • Ch. $chapterNumber",
                        color = inkColor.copy(alpha = 0.65f),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.align(Alignment.TopStart)
                    )
                    Text(
                        text = "$pageIndex / $totalPages",
                        color = if (isWebtoonColor) accent else Color(0xFF18181B),
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.BottomEnd)
                    )
                }
            }
        }
    }
}
