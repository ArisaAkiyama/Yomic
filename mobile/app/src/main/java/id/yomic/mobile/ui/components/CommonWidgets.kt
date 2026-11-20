package id.yomic.mobile.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.yomic.mobile.R
import id.yomic.mobile.model.ServerStatus
import id.yomic.mobile.model.SourceLang
import id.yomic.mobile.model.SyncProgressState
import id.yomic.mobile.ui.theme.YomicIcons
import id.yomic.mobile.ui.theme.YomicThemeTokens

private fun resolveSourceIconRes(nameOrId: String): Int? =
    when (nameOrId.trim().lowercase()) {
        "kiryuu" -> R.drawable.src_kiryuu
        "komiku" -> R.drawable.src_komiku
        "mangabat" -> R.drawable.src_mangabat
        "mangadex" -> R.drawable.src_mangadex
        "softkomik" -> R.drawable.src_softkomik
        "westmanga" -> R.drawable.src_westmanga
        "aarlas" -> R.drawable.src_aarlas
        "bacakomik" -> R.drawable.src_bacakomik
        "komikindo" -> R.drawable.src_komikindo
        "shinigami" -> R.drawable.src_shinigami
        "voratoon" -> R.drawable.src_voratoon
        "mangafire" -> R.drawable.src_mangafire
        "weebcentral" -> R.drawable.src_weebcentral
        "doujindesu" -> R.drawable.src_doujindesu
        else -> null
    }

@Composable
fun SourceAvatarBadge(
    name: String,
    accentColorHex: Long,
    size: Dp = 40.dp,
    modifier: Modifier = Modifier
) {
    val iconRes = resolveSourceIconRes(name)
    val shape = RoundedCornerShape(size * 0.24f)
    if (iconRes != null) {
        Box(
            modifier = modifier
                .size(size)
                .clip(shape)
                .background(YomicThemeTokens.colors.surfaceAlt),
            contentAlignment = Alignment.Center
        ) {
            Image(
                painter = painterResource(id = iconRes),
                contentDescription = name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }
        return
    }

    val bg = Color(accentColorHex)
    val initials = name.trim().take(2).uppercase()
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(bg),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initials,
            color = Color.White,
            fontWeight = FontWeight.ExtraBold,
            fontSize = (size.value * 0.36f).sp,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
fun ServerStatusIndicator(
    status: ServerStatus,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    when (status) {
        ServerStatus.ONLINE -> {
            // Healthy sources need no indicator (clean signal-to-noise ratio)
            return
        }
        ServerStatus.WARNING -> {
            Row(
                modifier = modifier
                    .clip(RoundedCornerShape(99.dp))
                    .background(tokens.amberBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(tokens.amber))
                Text(
                    text = "Cloudflare",
                    color = tokens.amber,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        ServerStatus.OFFLINE -> {
            Row(
                modifier = modifier
                    .clip(RoundedCornerShape(99.dp))
                    .background(tokens.roseBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(tokens.rose))
                Text(
                    text = "Offline",
                    color = tokens.rose,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
        ServerStatus.CHECKING -> {
            Box(
                modifier = modifier
                    .size(9.dp)
                    .clip(CircleShape)
                    .background(tokens.inkMuted)
            )
        }
    }
}

@Composable
fun LangBadgeChip(
    lang: SourceLang,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    val label = when (lang) {
        SourceLang.ID -> "ID"
        SourceLang.EN -> "EN"
        SourceLang.ALL -> "MULTI"
    }
    val bg = when (lang) {
        SourceLang.ID -> Color(0x22CE1126)
        SourceLang.EN -> Color(0x222563EB)
        SourceLang.ALL -> Color(0x220D9488)
    }
    val fg = when (lang) {
        SourceLang.ID -> if (tokens.isDark) Color(0xFFFCA5A5) else Color(0xFFB91C1C)
        SourceLang.EN -> if (tokens.isDark) Color(0xFF93C5FD) else Color(0xFF1D4ED8)
        SourceLang.ALL -> if (tokens.isDark) Color(0xFF5EEAD4) else Color(0xFF0F766E)
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(5.dp))
            .background(bg)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = label,
            color = fg,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun InlineSearchInput(
    query: String,
    placeholder: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(end = 12.dp)
            .height(42.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(tokens.surfaceAlt)
            .border(1.dp, tokens.borderSubtle, RoundedCornerShape(12.dp))
            .padding(start = 12.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = YomicIcons.Search,
            contentDescription = null,
            tint = tokens.inkMuted,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(8.dp))
        Box(
            modifier = Modifier.weight(1f),
            contentAlignment = Alignment.CenterStart
        ) {
            if (query.isEmpty()) {
                Text(
                    text = placeholder,
                    color = tokens.inkMuted,
                    style = MaterialTheme.typography.bodyMedium
                )
            }
            BasicTextField(
                value = query,
                onValueChange = onQueryChange,
                singleLine = true,
                textStyle = MaterialTheme.typography.bodyMedium.copy(color = tokens.inkPrimary),
                cursorBrush = SolidColor(tokens.accent),
                modifier = Modifier.fillMaxWidth()
            )
        }
        IconButton(onClick = onClose, modifier = Modifier.size(28.dp)) {
            Icon(
                imageVector = YomicIcons.Close,
                contentDescription = "Close",
                tint = tokens.inkSecondary,
                modifier = Modifier.size(16.dp)
            )
        }
    }
}

@Composable
fun SyncProgressBanner(
    progress: SyncProgressState,
    label: String,
    modifier: Modifier = Modifier
) {
    if (!progress.active) return
    val tokens = YomicThemeTokens.colors
    val ratio = (progress.current.toFloat() / progress.total.coerceAtLeast(1)).coerceIn(0f, 1f)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(tokens.surfaceAlt)
            .border(1.dp, tokens.borderSubtle, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 9.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                color = tokens.inkPrimary,
                style = MaterialTheme.typography.labelLarge
            )
            Text(
                text = "(${progress.current}/${progress.total})",
                color = tokens.accent,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold
            )
        }
        LinearProgressIndicator(
            progress = { ratio },
            color = tokens.accent,
            trackColor = tokens.borderSubtle,
            gapSize = 0.dp,
            drawStopIndicator = {},
            modifier = Modifier
                .fillMaxWidth()
                .height(4.dp)
                .clip(RoundedCornerShape(99.dp))
        )
    }
}

@Composable
fun YomicEmptyState(
    icon: ImageVector,
    title: String,
    description: String,
    primaryActionLabel: String? = null,
    onPrimaryAction: (() -> Unit)? = null,
    secondaryActionLabel: String? = null,
    onSecondaryAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val tokens = YomicThemeTokens.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(68.dp)
                .clip(RoundedCornerShape(18.dp))
                .background(tokens.surfaceAlt),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = tokens.inkMuted,
                modifier = Modifier.size(34.dp)
            )
        }
        Spacer(Modifier.height(16.dp))
        Text(
            text = title,
            color = tokens.inkPrimary,
            style = MaterialTheme.typography.titleMedium,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(6.dp))
        Text(
            text = description,
            color = tokens.inkSecondary,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center
        )
        if (primaryActionLabel != null && onPrimaryAction != null) {
            Spacer(Modifier.height(18.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    onClick = onPrimaryAction,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = tokens.accent,
                        contentColor = tokens.onAccent
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(primaryActionLabel, color = tokens.onAccent)
                }
                if (secondaryActionLabel != null && onSecondaryAction != null) {
                    OutlinedButton(
                        onClick = onSecondaryAction,
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text(secondaryActionLabel, color = tokens.inkPrimary)
                    }
                }
            }
        }
    }
}

@Composable
fun YomicConfirmDialog(
    title: String,
    message: String,
    confirmText: String,
    cancelText: String,
    isDanger: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    val tokens = YomicThemeTokens.colors
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = tokens.surface,
        titleContentColor = tokens.inkPrimary,
        textContentColor = tokens.inkSecondary,
        title = { Text(title, fontWeight = FontWeight.Bold) },
        text = { Text(message, style = MaterialTheme.typography.bodyMedium) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (isDanger) tokens.rose else tokens.accent,
                    contentColor = if (isDanger) Color.White else tokens.onAccent
                ),
                shape = RoundedCornerShape(9.dp)
            ) {
                Text(confirmText, color = if (isDanger) Color.White else tokens.onAccent)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(cancelText, color = tokens.inkSecondary)
            }
        }
    )
}
