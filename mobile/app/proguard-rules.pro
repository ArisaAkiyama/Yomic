# Yomic Mobile — Minimalist ProGuard / R8 Rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.compose.runtime.Composable <methods>;
}
-dontwarn kotlinx.coroutines.**
