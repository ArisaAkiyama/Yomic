package id.yomic.mobile.ui.theme

import android.app.Activity
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

@Immutable
data class YomicExtendedColors(
    val isDark: Boolean,
    val navBar: Color,
    val canvas: Color,
    val surface: Color,
    val surfaceAlt: Color,
    val elevated: Color,
    val accent: Color,
    val onAccent: Color,
    val accentVivid: Color,
    val accentTint: Color,
    val accentTintStrong: Color,
    val inkPrimary: Color,
    val inkSecondary: Color,
    val inkMuted: Color,
    val borderSubtle: Color,
    val borderStrong: Color,
    val emerald: Color,
    val emeraldBg: Color,
    val amber: Color,
    val amberBg: Color,
    val rose: Color,
    val roseBg: Color
)

private val LightExtendedColors = YomicExtendedColors(
    isDark = false,
    navBar = LightBgNavBar,
    canvas = LightBgCanvas,
    surface = LightBgSurface,
    surfaceAlt = LightBgSurfaceAlt,
    elevated = LightBgElevated,
    accent = LightOceanPrimary,
    onAccent = LightOnAccent,
    accentVivid = LightOceanVivid,
    accentTint = LightOceanTint,
    accentTintStrong = LightOceanTintStrong,
    inkPrimary = LightInkPrimary,
    inkSecondary = LightInkSecondary,
    inkMuted = LightInkMuted,
    borderSubtle = LightBorderSubtle,
    borderStrong = LightBorderStrong,
    emerald = LightStatusEmerald,
    emeraldBg = LightStatusEmeraldBg,
    amber = LightStatusAmber,
    amberBg = LightStatusAmberBg,
    rose = LightStatusRose,
    roseBg = LightStatusRoseBg
)

private val DarkExtendedColors = YomicExtendedColors(
    isDark = true,
    navBar = DarkBgNavBar,
    canvas = DarkBgCanvas,
    surface = DarkBgSurface,
    surfaceAlt = DarkBgSurfaceAlt,
    elevated = DarkBgElevated,
    accent = DarkBluePrimary,
    onAccent = DarkOnAccent,
    accentVivid = DarkBlueVivid,
    accentTint = DarkBlueTint,
    accentTintStrong = DarkBlueTintStrong,
    inkPrimary = DarkInkPrimary,
    inkSecondary = DarkInkSecondary,
    inkMuted = DarkInkMuted,
    borderSubtle = DarkBorderSubtle,
    borderStrong = DarkBorderStrong,
    emerald = DarkStatusEmerald,
    emeraldBg = DarkStatusEmeraldBg,
    amber = DarkStatusAmber,
    amberBg = DarkStatusAmberBg,
    rose = DarkStatusRose,
    roseBg = DarkStatusRoseBg
)

private val YomicLightColorScheme = lightColorScheme(
    primary = LightOceanPrimary,
    onPrimary = LightOnAccent,
    primaryContainer = LightOceanTint,
    onPrimaryContainer = LightOceanPrimary,
    secondary = LightOceanVivid,
    onSecondary = Color.White,
    secondaryContainer = LightOceanTint,
    onSecondaryContainer = LightInkPrimary,
    background = LightBgCanvas,
    onBackground = LightInkPrimary,
    surface = LightBgCanvas,
    onSurface = LightInkPrimary,
    surfaceVariant = LightBgSurface,
    onSurfaceVariant = LightInkSecondary,
    surfaceContainer = LightBgSurface,
    surfaceContainerLow = LightBgCanvas,
    surfaceContainerHigh = LightBgSurfaceAlt,
    surfaceContainerHighest = LightBgElevated,
    outline = LightBorderStrong,
    outlineVariant = LightBorderSubtle,
    error = LightStatusRose,
    onError = Color.White,
    errorContainer = LightStatusRoseBg,
    onErrorContainer = LightStatusRose
)

private val YomicDarkColorScheme = darkColorScheme(
    primary = DarkBluePrimary,
    onPrimary = DarkOnAccent,
    primaryContainer = DarkBgSurfaceAlt,
    onPrimaryContainer = DarkInkPrimary,
    secondary = DarkBlueVivid,
    onSecondary = DarkOnAccent,
    secondaryContainer = DarkBgSurfaceAlt,
    onSecondaryContainer = DarkInkPrimary,
    background = DarkBgCanvas,
    onBackground = DarkInkPrimary,
    surface = DarkBgCanvas,
    onSurface = DarkInkPrimary,
    surfaceVariant = DarkBgSurface,
    onSurfaceVariant = DarkInkSecondary,
    surfaceContainer = DarkBgSurface,
    surfaceContainerLow = DarkBgNavBar,
    surfaceContainerHigh = DarkBgSurfaceAlt,
    surfaceContainerHighest = DarkBgElevated,
    outline = DarkBorderStrong,
    outlineVariant = DarkBorderSubtle,
    error = DarkStatusRose,
    onError = Color.White,
    errorContainer = Color(0xFF3A121D),
    onErrorContainer = DarkStatusRose
)

val LocalYomicColors = staticCompositionLocalOf { LightExtendedColors }

object YomicThemeTokens {
    val colors: YomicExtendedColors
        @Composable get() = LocalYomicColors.current
}

@Composable
fun YomicTheme(
    darkTheme: Boolean,
    pureBlack: Boolean = false,
    content: @Composable () -> Unit
) {
    val extendedColors = when {
        darkTheme && pureBlack -> DarkExtendedColors.copy(
            navBar = Color.Black,
            canvas = Color.Black,
            surface = Color(0xFF0C0C0C),
            surfaceAlt = Color(0xFF141414)
        )
        darkTheme -> DarkExtendedColors
        else -> LightExtendedColors
    }
    val colorScheme = when {
        darkTheme && pureBlack -> YomicDarkColorScheme.copy(
            background = Color.Black,
            surface = Color.Black,
            surfaceVariant = Color(0xFF0C0C0C),
            surfaceContainer = Color(0xFF0C0C0C),
            surfaceContainerLow = Color.Black
        )
        darkTheme -> YomicDarkColorScheme
        else -> YomicLightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !darkTheme
            controller.isAppearanceLightNavigationBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalYomicColors provides extendedColors) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = YomicTypography,
            content = content
        )
    }
}
