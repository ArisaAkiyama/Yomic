package id.yomic.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import id.yomic.mobile.ui.i18n.LocalStrings
import id.yomic.mobile.ui.i18n.stringsFor
import id.yomic.mobile.ui.navigation.YomicAppShell
import id.yomic.mobile.ui.theme.YomicTheme
import id.yomic.mobile.viewmodel.YomicViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val viewModel: YomicViewModel = viewModel()
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()

            CompositionLocalProvider(LocalStrings provides stringsFor(uiState.settings.appLanguage)) {
                YomicTheme(
                    darkTheme = uiState.settings.isDarkMode,
                    pureBlack = uiState.settings.pureBlackDarkMode
                ) {
                    YomicAppShell(state = uiState, viewModel = viewModel)
                }
            }
        }
    }
}
