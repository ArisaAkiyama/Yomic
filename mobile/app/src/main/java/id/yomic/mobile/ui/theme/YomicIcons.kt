package id.yomic.mobile.ui.theme

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp

/**
 * 1:1 Mirror of Yomic Desktop v2 Solar Linear/Bold SVG Icons (src/YomicDesktop/WebUI/ts/icons.ts).
 * Rendered natively via Jetpack Compose PathParser with zero external icon-pack bloat.
 */
object YomicIcons {

    private data class VectorPathSpec(
        val pathData: String,
        val filled: Boolean = false,
        val stroked: Boolean = true,
        val strokeWidth: Float = 1.5f,
        val evenOdd: Boolean = false
    )

    private fun buildSolarIcon(name: String, vararg specs: VectorPathSpec): ImageVector =
        ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            for (spec in specs) {
                addPath(
                    pathData = addPathNodes(spec.pathData),
                    pathFillType = if (spec.evenOdd) PathFillType.EvenOdd else PathFillType.NonZero,
                    fill = if (spec.filled) SolidColor(Color.Black) else null,
                    stroke = if (spec.stroked) SolidColor(Color.Black) else null,
                    strokeLineWidth = if (spec.stroked) spec.strokeWidth else 0f,
                    strokeLineCap = StrokeCap.Round,
                    strokeLineJoin = StrokeJoin.Round
                )
            }
        }.build()

    // Desktop: 'book-open-line'
    val Library: ImageVector by lazy {
        buildSolarIcon(
            "Library",
            VectorPathSpec("M4 8C4 5.17157 4 3.75736 4.87868 2.87868C5.75736 2 7.17157 2 10 2H14C16.8284 2 18.2426 2 19.1213 2.87868C20 3.75736 20 5.17157 20 8V16C20 18.8284 20 20.2426 19.1213 21.1213C18.2426 22 16.8284 22 14 22H10C7.17157 22 5.75736 22 4.87868 21.1213C4 20.2426 4 18.8284 4 16V8Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M19.9997 16H7.89749C6.96751 16 6.50253 16 6.12103 16.1022C5.08575 16.3796 4.29986 17.1212 4.02246 18.1564", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 7H16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 10.5H13", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M19.9239 19H8", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'book-open-line'
    val LibraryFilled: ImageVector by lazy {
        buildSolarIcon(
            "LibraryFilled",
            VectorPathSpec("M4 8C4 5.17157 4 3.75736 4.87868 2.87868C5.75736 2 7.17157 2 10 2H14C16.8284 2 18.2426 2 19.1213 2.87868C20 3.75736 20 5.17157 20 8V16C20 18.8284 20 20.2426 19.1213 21.1213C18.2426 22 16.8284 22 14 22H10C7.17157 22 5.75736 22 4.87868 21.1213C4 20.2426 4 18.8284 4 16V8Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M19.9997 16H7.89749C6.96751 16 6.50253 16 6.12103 16.1022C5.08575 16.3796 4.29986 17.1212 4.02246 18.1564", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 7H16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 10.5H13", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M19.9239 19H8", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'refresh-line'
    val Updates: ImageVector by lazy {
        buildSolarIcon(
            "Updates",
            VectorPathSpec("M18.364 8.04928L17.6569 7.34217C14.5327 4.21798 9.46734 4.21798 6.34315 7.34217C3.21895 10.4664 3.21895 15.5317 6.34315 18.6559C9.46734 21.7801 14.5327 21.7801 17.6569 18.6559C19.4737 16.8391 20.234 14.3658 19.9377 11.9995M18.364 3.80664V8.04928H14.1213", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'history-line'
    val History: ImageVector by lazy {
        buildSolarIcon(
            "History",
            VectorPathSpec("M12 8V12L14.5 14.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M4.33776 6.87052L5.60414 5.60414C9.10115 2.10713 14.7996 2.13576 18.3319 5.6681C21.8642 9.20044 21.8929 14.8988 18.3959 18.3959C14.8988 21.8929 9.20044 21.8642 5.6681 18.3319C3.57589 16.2397 2.71285 13.3876 3.08355 10.6831M4.32497 4.32497L4.33776 6.87052L6.88331 6.88331", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'compass-3-line'
    val Browse: ImageVector by lazy {
        buildSolarIcon(
            "Browse",
            VectorPathSpec("M 2.0,12.0 A 10.0,10.0 0 1,0 22.0,12.0 A 10.0,10.0 0 1,0 2.0,12.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M13.024 14.5601C10.7142 15.484 9.5593 15.946 8.89964 15.4977C8.74324 15.3914 8.60834 15.2565 8.50206 15.1001C8.0538 14.4405 8.51575 13.2856 9.43967 10.9758C9.63673 10.4831 9.73527 10.2368 9.90474 10.0435C9.94792 9.99429 9.99429 9.94792 10.0435 9.90474C10.2368 9.73527 10.4831 9.63673 10.9758 9.43966C13.2856 8.51575 14.4405 8.0538 15.1001 8.50206C15.2565 8.60834 15.3914 8.74324 15.4977 8.89964C15.946 9.5593 15.484 10.7142 14.5601 13.024C14.363 13.5166 14.2645 13.763 14.095 13.9562C14.0518 14.0055 14.0055 14.0518 13.9562 14.095C13.763 14.2645 13.5166 14.363 13.024 14.5601Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'widget-2-linear'
    val Extensions: ImageVector by lazy {
        buildSolarIcon(
            "Extensions",
            VectorPathSpec("M 5.0,3.0 H 9.0 A 2.0,2.0 0 0,1 11.0,5.0 V 9.0 A 2.0,2.0 0 0,1 9.0,11.0 H 5.0 A 2.0,2.0 0 0,1 3.0,9.0 V 5.0 A 2.0,2.0 0 0,1 5.0,3.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 15.0,3.0 H 19.0 A 2.0,2.0 0 0,1 21.0,5.0 V 9.0 A 2.0,2.0 0 0,1 19.0,11.0 H 15.0 A 2.0,2.0 0 0,1 13.0,9.0 V 5.0 A 2.0,2.0 0 0,1 15.0,3.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 15.0,13.0 H 19.0 A 2.0,2.0 0 0,1 21.0,15.0 V 19.0 A 2.0,2.0 0 0,1 19.0,21.0 H 15.0 A 2.0,2.0 0 0,1 13.0,19.0 V 15.0 A 2.0,2.0 0 0,1 15.0,13.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 5.0,13.0 H 9.0 A 2.0,2.0 0 0,1 11.0,15.0 V 19.0 A 2.0,2.0 0 0,1 9.0,21.0 H 5.0 A 2.0,2.0 0 0,1 3.0,19.0 V 15.0 A 2.0,2.0 0 0,1 5.0,13.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'more-horizontal'
    val More: ImageVector by lazy {
        buildSolarIcon(
            "More",
            VectorPathSpec("M 3.25,12.0 A 1.75,1.75 0 1,0 6.75,12.0 A 1.75,1.75 0 1,0 3.25,12.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 10.25,12.0 A 1.75,1.75 0 1,0 13.75,12.0 A 1.75,1.75 0 1,0 10.25,12.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 17.25,12.0 A 1.75,1.75 0 1,0 20.75,12.0 A 1.75,1.75 0 1,0 17.25,12.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'more-vertical'
    val MoreVert: ImageVector by lazy {
        buildSolarIcon(
            "MoreVert",
            VectorPathSpec("M 10.25,5.0 A 1.75,1.75 0 1,0 13.75,5.0 A 1.75,1.75 0 1,0 10.25,5.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 10.25,12.0 A 1.75,1.75 0 1,0 13.75,12.0 A 1.75,1.75 0 1,0 10.25,12.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 10.25,19.0 A 1.75,1.75 0 1,0 13.75,19.0 A 1.75,1.75 0 1,0 10.25,19.0 Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'search-line'
    val Search: ImageVector by lazy {
        buildSolarIcon(
            "Search",
            VectorPathSpec("M 4.0,11.0 A 7.0,7.0 0 1,0 18.0,11.0 A 7.0,7.0 0 1,0 4.0,11.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M16 16L21 21", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'filter'
    val Filter: ImageVector by lazy {
        buildSolarIcon(
            "Filter",
            VectorPathSpec("M19 3H5C3.58579 3 2.87868 3 2.43934 3.4122C2 3.8244 2 4.48782 2 5.81466V6.50448C2 7.54232 2 8.06124 2.2596 8.49142C2.5192 8.9216 2.99347 9.18858 3.94202 9.72255L6.85504 11.3624C7.49146 11.7206 7.80967 11.8998 8.03751 12.0976C8.51199 12.5095 8.80408 12.9935 8.93644 13.5872C9 13.8722 9 14.2058 9 14.8729L9 17.5424C9 18.452 9 18.9067 9.25192 19.2613C9.50385 19.6158 9.95128 19.7907 10.8462 20.1406C12.7248 20.875 13.6641 21.2422 14.3321 20.8244C15 20.4066 15 19.4519 15 17.5424V14.8729C15 14.2058 15 13.8722 15.0636 13.5872C15.1959 12.9935 15.488 12.5095 15.9625 12.0976C16.1903 11.8998 16.5085 11.7206 17.145 11.3624L20.058 9.72255C21.0065 9.18858 21.4808 8.9216 21.7404 8.49142C22 8.06124 22 7.54232 22 6.50448V5.81466C22 4.48782 22 3.8244 21.5607 3.4122C21.1213 3 20.4142 3 19 3Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'arrow-up-down-line'
    val Sort: ImageVector by lazy {
        buildSolarIcon(
            "Sort",
            VectorPathSpec("M16 18L16 6M12 10.125L16 6L20 10.125", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 6L8 18M4 13.875L8 18L12 13.875", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'layout-grid'
    val Grid: ImageVector by lazy {
        buildSolarIcon(
            "Grid",
            VectorPathSpec("M2.5 6.5C2.5 4.61438 2.5 3.67157 3.08579 3.08579C3.67157 2.5 4.61438 2.5 6.5 2.5C8.38562 2.5 9.32843 2.5 9.91421 3.08579C10.5 3.67157 10.5 4.61438 10.5 6.5V17.5C10.5 19.3856 10.5 20.3284 9.91421 20.9142C9.32843 21.5 8.38562 21.5 6.5 21.5C4.61438 21.5 3.67157 21.5 3.08579 20.9142C2.5 20.3284 2.5 19.3856 2.5 17.5V6.5Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M13.5 15.5C13.5 13.6144 13.5 12.6716 14.0858 12.0858C14.6716 11.5 15.6144 11.5 17.5 11.5C19.3856 11.5 20.3284 11.5 20.9142 12.0858C21.5 12.6716 21.5 13.6144 21.5 15.5V17.5C21.5 19.3856 21.5 20.3284 20.9142 20.9142C20.3284 21.5 19.3856 21.5 17.5 21.5C15.6144 21.5 14.6716 21.5 14.0858 20.9142C13.5 20.3284 13.5 19.3856 13.5 17.5V15.5Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M13.5 5.5C13.5 4.56812 13.5 4.10218 13.6522 3.73463C13.8552 3.24458 14.2446 2.85523 14.7346 2.65224C15.1022 2.5 15.5681 2.5 16.5 2.5H18.5C19.4319 2.5 19.8978 2.5 20.2654 2.65224C20.7554 2.85523 21.1448 3.24458 21.3478 3.73463C21.5 4.10218 21.5 4.56812 21.5 5.5C21.5 6.43188 21.5 6.89782 21.3478 7.26537C21.1448 7.75542 20.7554 8.14477 20.2654 8.34776C19.8978 8.5 19.4319 8.5 18.5 8.5H16.5C15.5681 8.5 15.1022 8.5 14.7346 8.34776C14.2446 8.14477 13.8552 7.75542 13.6522 7.26537C13.5 6.89782 13.5 6.43188 13.5 5.5Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'list'
    val ListView: ImageVector by lazy {
        buildSolarIcon(
            "ListView",
            VectorPathSpec("M20 7L4 7", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M15 12L4 12", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M9 17H4", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'chart-2-linear'
    val Insights: ImageVector by lazy {
        buildSolarIcon(
            "Insights",
            VectorPathSpec("M3 20H21", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 6.0,10.0 H 7.5 A 1.0,1.0 0 0,1 8.5,11.0 V 16.0 A 1.0,1.0 0 0,1 7.5,17.0 H 6.0 A 1.0,1.0 0 0,1 5.0,16.0 V 11.0 A 1.0,1.0 0 0,1 6.0,10.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 11.25,5.0 H 12.75 A 1.0,1.0 0 0,1 13.75,6.0 V 16.0 A 1.0,1.0 0 0,1 12.75,17.0 H 11.25 A 1.0,1.0 0 0,1 10.25,16.0 V 6.0 A 1.0,1.0 0 0,1 11.25,5.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 16.5,8.0 H 18.0 A 1.0,1.0 0 0,1 19.0,9.0 V 16.0 A 1.0,1.0 0 0,1 18.0,17.0 H 16.5 A 1.0,1.0 0 0,1 15.5,16.0 V 9.0 A 1.0,1.0 0 0,1 16.5,8.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'download-2-line'
    val Download: ImageVector by lazy {
        buildSolarIcon(
            "Download",
            VectorPathSpec("M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M12 3V16M8 11.625L12 16L16 11.625", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'download-done'
    val DownloadDone: ImageVector by lazy {
        buildSolarIcon(
            "DownloadDone",
            VectorPathSpec("M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8.5 10.5L11 13L16 7.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'bookmark'
    val Bookmark: ImageVector by lazy {
        buildSolarIcon(
            "Bookmark",
            VectorPathSpec("M21 16.0909V11.0975C21 6.80891 21 4.6646 19.682 3.3323C18.364 2 16.2426 2 12 2C7.75736 2 5.63604 2 4.31802 3.3323C3 4.6646 3 6.80891 3 11.0975V16.0909C3 19.1875 3 20.7358 3.73411 21.4123C4.08421 21.735 4.52615 21.9377 4.99692 21.9915C5.98402 22.1045 7.13673 21.0849 9.44216 19.0458C10.4612 18.1445 10.9708 17.6938 11.5603 17.5751C11.8506 17.5166 12.1494 17.5166 12.4397 17.5751C13.0292 17.6938 13.5388 18.1445 14.5578 19.0458C16.8633 21.0849 18.016 22.1045 19.0031 21.9915C19.4739 21.9377 19.9158 21.735 20.2659 21.4123C21 20.7358 21 19.1875 21 16.0909Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M15 6H9", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'bookmark-bold'
    val BookmarkFilled: ImageVector by lazy {
        buildSolarIcon(
            "BookmarkFilled",
            VectorPathSpec("M21 11.0975V16.0909C21 19.1875 21 20.7358 20.2659 21.4123C19.9158 21.735 19.4739 21.9377 19.0031 21.9915C18.016 22.1045 16.8633 21.0849 14.5578 19.0458C13.5388 18.1445 13.0292 17.6938 12.4397 17.5751C12.1494 17.5166 11.8506 17.5166 11.5603 17.5751C10.9708 17.6938 10.4612 18.1445 9.44216 19.0458C7.13673 21.0849 5.98402 22.1045 4.99692 21.9915C4.52615 21.9377 4.08421 21.735 3.73411 21.4123C3 20.7358 3 19.1875 3 16.0909V11.0975C3 6.80891 3 4.6646 4.31802 3.3323C5.63604 2 7.75736 2 12 2C16.2426 2 18.364 2 19.682 3.3323C21 4.6646 21 6.80891 21 11.0975ZM8.25 6C8.25 5.58579 8.58579 5.25 9 5.25H15C15.4142 5.25 15.75 5.58579 15.75 6C15.75 6.41421 15.4142 6.75 15 6.75H9C8.58579 6.75 8.25 6.41421 8.25 6Z", filled = true, stroked = false, strokeWidth = 1.5f, evenOdd = true)
        )
    }

    // Desktop: 'play-linear'
    val Play: ImageVector by lazy {
        buildSolarIcon(
            "Play",
            VectorPathSpec("M20.4086 9.35258C22.5305 10.5065 22.5305 13.4935 20.4086 14.6474L7.59662 21.6145C5.53435 22.736 3 21.2763 3 18.9671L3 5.0329C3 2.72368 5.53435 1.26402 7.59661 2.38548L20.4086 9.35258Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'pause-linear'
    val Pause: ImageVector by lazy {
        buildSolarIcon(
            "Pause",
            VectorPathSpec("M2 6C2 4.11438 2 3.17157 2.58579 2.58579C3.17157 2 4.11438 2 6 2C7.88562 2 8.82843 2 9.41421 2.58579C10 3.17157 10 4.11438 10 6V18C10 19.8856 10 20.8284 9.41421 21.4142C8.82843 22 7.88562 22 6 22C4.11438 22 3.17157 22 2.58579 21.4142C2 20.8284 2 19.8856 2 18V6Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M14 6C14 4.11438 14 3.17157 14.5858 2.58579C15.1716 2 16.1144 2 18 2C19.8856 2 20.8284 2 21.4142 2.58579C22 3.17157 22 4.11438 22 6V18C22 19.8856 22 20.8284 21.4142 21.4142C20.8284 22 19.8856 22 18 22C16.1144 22 15.1716 22 14.5858 21.4142C14 20.8284 14 19.8856 14 18V6Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'arrow-left-linear'
    val ArrowBack: ImageVector by lazy {
        buildSolarIcon(
            "ArrowBack",
            VectorPathSpec("M20 12H4M10 18L4 12L10 6", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'arrow-right-linear'
    val ArrowForward: ImageVector by lazy {
        buildSolarIcon(
            "ArrowForward",
            VectorPathSpec("M4 12H20M14 18L20 12L14 6", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'alt-arrow-down-linear'
    val ChevronDown: ImageVector by lazy {
        buildSolarIcon(
            "ChevronDown",
            VectorPathSpec("M19 9L12 15L5 9", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'alt-arrow-up-linear'
    val ChevronUp: ImageVector by lazy {
        buildSolarIcon(
            "ChevronUp",
            VectorPathSpec("M19 15L12 9L5 15", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'alt-arrow-right-linear'
    val ChevronRight: ImageVector by lazy {
        buildSolarIcon(
            "ChevronRight",
            VectorPathSpec("M9 5L15 12L9 19", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'close'
    val Close: ImageVector by lazy {
        buildSolarIcon(
            "Close",
            VectorPathSpec("M18 6L6 18M6 6L18 18", filled = false, stroked = true, strokeWidth = 1.75f, evenOdd = false)
        )
    }

    // Desktop: 'check'
    val Check: ImageVector by lazy {
        buildSolarIcon(
            "Check",
            VectorPathSpec("M4 12.9L7.14286 16.5L15 7.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M20 7.5625L11.4283 16.5625L11 16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'check-circle-linear'
    val CheckCircle: ImageVector by lazy {
        buildSolarIcon(
            "CheckCircle",
            VectorPathSpec("M 2.0,12.0 A 10.0,10.0 0 1,0 22.0,12.0 A 10.0,10.0 0 1,0 2.0,12.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8.5 12.5L10.5 14.5L15.5 9.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'delete-bin-line'
    val Trash: ImageVector by lazy {
        buildSolarIcon(
            "Trash",
            VectorPathSpec("M20.5001 6H3.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M18.8332 8.5L18.3732 15.3991C18.1962 18.054 18.1077 19.3815 17.2427 20.1907C16.3777 21 15.0473 21 12.3865 21H11.6132C8.95235 21 7.62195 21 6.75694 20.1907C5.89194 19.3815 5.80344 18.054 5.62644 15.3991L5.1665 8.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M9.5 11L10 16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M14.5 11L14 16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M6.5 6C6.55588 6 6.58382 6 6.60915 5.99936C7.43259 5.97849 8.15902 5.45491 8.43922 4.68032C8.44784 4.65649 8.45667 4.62999 8.47434 4.57697L8.57143 4.28571C8.65431 4.03708 8.69575 3.91276 8.75071 3.8072C8.97001 3.38607 9.37574 3.09364 9.84461 3.01877C9.96213 3 10.0932 3 10.3553 3H13.6447C13.9068 3 14.0379 3 14.1554 3.01877C14.6243 3.09364 15.03 3.38607 15.2493 3.8072C15.3043 3.91276 15.3457 4.03708 15.4286 4.28571L15.5257 4.57697C15.5433 4.62992 15.5522 4.65651 15.5608 4.68032C15.841 5.45491 16.5674 5.97849 17.3909 5.99936C17.4162 6 17.4441 6 17.5 6", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'plus'
    val Plus: ImageVector by lazy {
        buildSolarIcon(
            "Plus",
            VectorPathSpec("M12 4V20M20 12L4 12", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'minus'
    val Minus: ImageVector by lazy {
        buildSolarIcon(
            "Minus",
            VectorPathSpec("M20 12L4 12", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'settings-3-line'
    val Settings: ImageVector by lazy {
        buildSolarIcon(
            "Settings",
            VectorPathSpec("M 9.0,12.0 A 3.0,3.0 0 1,0 15.0,12.0 A 3.0,3.0 0 1,0 9.0,12.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M13.7654 2.15224C13.3978 2 12.9319 2 12 2C11.0681 2 10.6022 2 10.2346 2.15224C9.74457 2.35523 9.35522 2.74458 9.15223 3.23463C9.05957 3.45834 9.0233 3.7185 9.00911 4.09799C8.98826 4.65568 8.70226 5.17189 8.21894 5.45093C7.73564 5.72996 7.14559 5.71954 6.65219 5.45876C6.31645 5.2813 6.07301 5.18262 5.83294 5.15102C5.30704 5.08178 4.77518 5.22429 4.35436 5.5472C4.03874 5.78938 3.80577 6.1929 3.33983 6.99993C2.87389 7.80697 2.64092 8.21048 2.58899 8.60491C2.51976 9.1308 2.66227 9.66266 2.98518 10.0835C3.13256 10.2756 3.3397 10.437 3.66119 10.639C4.1338 10.936 4.43789 11.4419 4.43786 12C4.43783 12.5581 4.13375 13.0639 3.66118 13.3608C3.33965 13.5629 3.13248 13.7244 2.98508 13.9165C2.66217 14.3373 2.51966 14.8691 2.5889 15.395C2.64082 15.7894 2.87379 16.193 3.33973 17C3.80568 17.807 4.03865 18.2106 4.35426 18.4527C4.77508 18.7756 5.30694 18.9181 5.83284 18.8489C6.07289 18.8173 6.31632 18.7186 6.65204 18.5412C7.14547 18.2804 7.73556 18.27 8.2189 18.549C8.70224 18.8281 8.98826 19.3443 9.00911 19.9021C9.02331 20.2815 9.05957 20.5417 9.15223 20.7654C9.35522 21.2554 9.74457 21.6448 10.2346 21.8478C10.6022 22 11.0681 22 12 22C12.9319 22 13.3978 22 13.7654 21.8478C14.2554 21.6448 14.6448 21.2554 14.8477 20.7654C14.9404 20.5417 14.9767 20.2815 14.9909 19.902C15.0117 19.3443 15.2977 18.8281 15.781 18.549C16.2643 18.2699 16.8544 18.2804 17.3479 18.5412C17.6836 18.7186 17.927 18.8172 18.167 18.8488C18.6929 18.9181 19.2248 18.7756 19.6456 18.4527C19.9612 18.2105 20.1942 17.807 20.6601 16.9999C21.1261 16.1929 21.3591 15.7894 21.411 15.395C21.4802 14.8691 21.3377 14.3372 21.0148 13.9164C20.8674 13.7243 20.6602 13.5628 20.3387 13.3608C19.8662 13.0639 19.5621 12.558 19.5621 11.9999C19.5621 11.4418 19.8662 10.9361 20.3387 10.6392C20.6603 10.4371 20.8675 10.2757 21.0149 10.0835C21.3378 9.66273 21.4803 9.13087 21.4111 8.60497C21.3592 8.21055 21.1262 7.80703 20.6602 7C20.1943 6.19297 19.9613 5.78945 19.6457 5.54727C19.2249 5.22436 18.693 5.08185 18.1671 5.15109C17.9271 5.18269 17.6837 5.28136 17.3479 5.4588C16.8545 5.71959 16.2644 5.73002 15.7811 5.45096C15.2977 5.17191 15.0117 4.65566 14.9909 4.09794C14.9767 3.71848 14.9404 3.45833 14.8477 3.23463C14.6448 2.74458 14.2554 2.35523 13.7654 2.15224Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'bell-linear'
    val Bell: ImageVector by lazy {
        buildSolarIcon(
            "Bell",
            VectorPathSpec("M18.7491 9.70957V9.00496C18.7491 5.13623 15.7274 2 12 2C8.27256 2 5.25087 5.13623 5.25087 9.00496V9.70957C5.25087 10.5552 5.00972 11.3818 4.5578 12.0854L3.45036 13.8095C2.43882 15.3843 3.21105 17.5249 4.97036 18.0229C9.57274 19.3257 14.4273 19.3257 19.0296 18.0229C20.789 17.5249 21.5612 15.3843 20.5496 13.8095L19.4422 12.0854C18.9903 11.3818 18.7491 10.5552 18.7491 9.70957Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'chat-round-line-linear'
    val Feedback: ImageVector by lazy {
        buildSolarIcon(
            "Feedback",
            VectorPathSpec("M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 13.5997 2.37562 15.1116 3.04346 16.4525C3.22094 16.8088 3.28001 17.2161 3.17712 17.6006L2.58151 19.8267C2.32295 20.793 3.20701 21.677 4.17335 21.4185L6.39939 20.8229C6.78393 20.72 7.19121 20.7791 7.54753 20.9565C8.88837 21.6244 10.4003 22 12 22Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 10.5H16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 14H13.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'global-linear'
    val Globe: ImageVector by lazy {
        buildSolarIcon(
            "Globe",
            VectorPathSpec("M22 12C22 13.3132 21.7413 14.6136 21.2388 15.8268C20.7362 17.0401 19.9997 18.1425 19.0711 19.0711C18.1425 19.9997 17.0401 20.7362 15.8268 21.2388C14.6136 21.7413 13.3132 22 12 22C10.6868 22 9.38642 21.7413 8.17317 21.2388C6.95991 20.7362 5.85752 19.9997 4.92893 19.0711C4.00035 18.1425 3.26375 17.0401 2.7612 15.8268C2.25866 14.6136 2 13.3132 2 12C2 10.6868 2.25866 9.38642 2.76121 8.17316C3.26375 6.95991 4.00035 5.85752 4.92893 4.92893C5.85752 4.00035 6.95991 3.26375 8.17317 2.7612C9.38642 2.25866 10.6868 2 12 2C13.3132 2 14.6136 2.25866 15.8268 2.76121C17.0401 3.26375 18.1425 4.00035 19.0711 4.92893C19.9997 5.85752 20.7362 6.95991 21.2388 8.17317C21.7413 9.38642 22 10.6868 22 12L22 12Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M16 12C16 13.3132 15.8965 14.6136 15.6955 15.8268C15.4945 17.0401 15.1999 18.1425 14.8284 19.0711C14.457 19.9997 14.016 20.7362 13.5307 21.2388C13.0454 21.7413 12.5253 22 12 22C11.4747 22 10.9546 21.7413 10.4693 21.2388C9.98396 20.7362 9.54301 19.9997 9.17157 19.0711C8.80014 18.1425 8.5055 17.0401 8.30448 15.8268C8.10346 14.6136 8 13.3132 8 12C8 10.6868 8.10346 9.38642 8.30448 8.17316C8.5055 6.95991 8.80014 5.85752 9.17157 4.92893C9.54301 4.00035 9.98396 3.26375 10.4693 2.7612C10.9546 2.25866 11.4747 2 12 2C12.5253 2 13.0454 2.25866 13.5307 2.76121C14.016 3.26375 14.457 4.00035 14.8284 4.92893C15.1999 5.85752 15.4945 6.95991 15.6955 8.17317C15.8965 9.38642 16 10.6868 16 12L16 12Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M2 12H22", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'wifi-off'
    val WifiOff: ImageVector by lazy {
        buildSolarIcon(
            "WifiOff",
            VectorPathSpec("M 2.0,2.0 L 22.0,22.0", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8.5 16.5a5 5 0 0 1 7 0", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M2 8.82a15 15 0 0 1 4.18-2.64", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M10.66 5c4.01-.36 8.14.9 11.34 3.82", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M16.85 11.25a10 10 0 0 1 2.22 1.68", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M5 13a10 10 0 0 1 5.24-2.76", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M 11.0,19.5 A 1.0,1.0 0 1,0 13.0,19.5 A 1.0,1.0 0 1,0 11.0,19.5 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'sliders'
    val Sliders: ImageVector by lazy {
        buildSolarIcon(
            "Sliders",
            VectorPathSpec("M9.5 14C11.1569 14 12.5 15.3431 12.5 17C12.5 18.6568 11.1569 20 9.5 20C7.84315 20 6.5 18.6568 6.5 17C6.5 15.3431 7.84315 14 9.5 14Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M14.5 3.99998C12.8431 3.99998 11.5 5.34312 11.5 6.99998C11.5 8.65683 12.8431 9.99998 14.5 9.99998C16.1569 9.99998 17.5 8.65683 17.5 6.99998C17.5 5.34312 16.1569 3.99998 14.5 3.99998Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M15 16.9585L22 16.9585", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M9 6.9585L2 6.9585", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M2 16.9585L4 16.9585", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M22 6.9585L20 6.9585", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'zoom-in'
    val ZoomIn: ImageVector by lazy {
        buildSolarIcon(
            "ZoomIn",
            VectorPathSpec("M 4.0,11.0 A 7.0,7.0 0 1,0 18.0,11.0 A 7.0,7.0 0 1,0 4.0,11.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M8 11H14M11 8V14M16 16L21 21", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'fire-linear'
    val Fire: ImageVector by lazy {
        buildSolarIcon(
            "Fire",
            VectorPathSpec("M12 21C16.4183 21 20 17.6421 20 13.5C20 10.5 18 7.5 15.5 5.5C15.5 8 14 9.5 12.5 9.5C12.5 6.5 11 3.5 8.5 2C8.5 5.5 4 8.5 4 13.5C4 17.6421 7.58172 21 12 21Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M12 21C13.933 21 15.5 19.433 15.5 17.5C15.5 15.8 14.2 14.2 12 12.5C9.8 14.2 8.5 15.8 8.5 17.5C8.5 19.433 10.067 21 12 21Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'clock-circle-linear'
    val Clock: ImageVector by lazy {
        buildSolarIcon(
            "Clock",
            VectorPathSpec("M 2.0,12.0 A 10.0,10.0 0 1,0 22.0,12.0 A 10.0,10.0 0 1,0 2.0,12.0 Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M12 8V12L14.5 14.5", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'danger-triangle-linear'
    val Warning: ImageVector by lazy {
        buildSolarIcon(
            "Warning",
            VectorPathSpec("M5.31171 10.7615C8.23007 5.58716 9.68925 3 12 3C14.3107 3 15.7699 5.58716 18.6883 10.7615L19.0519 11.4063C21.4771 15.7061 22.6897 17.856 21.5937 19.428C20.4978 21 17.7864 21 12.3637 21H11.6363C6.21356 21 3.50217 21 2.40626 19.428C1.31034 17.856 2.52291 15.7061 4.94805 11.4063L5.31171 10.7615Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M12 8V13", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M12 16H12.0001", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: 'layers-minimalistic-linear'
    val Layers: ImageVector by lazy {
        buildSolarIcon(
            "Layers",
            VectorPathSpec("M4.97883 9.68508C2.99294 8.89073 2 8.49355 2 8C2 7.50645 2.99294 7.10927 4.97883 6.31492L7.7873 5.19153C9.77318 4.39718 10.7661 4 12 4C13.2339 4 14.2268 4.39718 16.2127 5.19153L19.0212 6.31492C21.0071 7.10927 22 7.50645 22 8C22 8.49355 21.0071 8.89073 19.0212 9.68508L16.2127 10.8085C14.2268 11.6028 13.2339 12 12 12C10.7661 12 9.77318 11.6028 7.7873 10.8085L4.97883 9.68508Z", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M22 12C22 12 21.0071 12.8907 19.0212 13.6851L16.2127 14.8085C14.2268 15.6028 13.2339 16 12 16C10.7661 16 9.77318 15.6028 7.7873 14.8085L4.97883 13.6851C2.99294 12.8907 2 12 2 12", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false),
            VectorPathSpec("M22 16C22 16 21.0071 16.8907 19.0212 17.6851L16.2127 18.8085C14.2268 19.6028 13.2339 20 12 20C10.7661 20 9.77318 19.6028 7.7873 18.8085L4.97883 17.6851C2.99294 16.8907 2 16 2 16", filled = false, stroked = true, strokeWidth = 1.5f, evenOdd = false)
        )
    }

    // Desktop: index.html Tutorial (?) icon
    val Help: ImageVector by lazy {
        buildSolarIcon(
            "Help",
            VectorPathSpec("M 2,12 A 10,10 0 1,0 22,12 A 10,10 0 1,0 2,12 Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 17L12.01 17", filled = false, stroked = true, strokeWidth = 1.75f)
        )
    }

    // Mobile Updates tab starburst (!) matched to Solar 1.5f stroke
    val NewReleases: ImageVector by lazy {
        buildSolarIcon(
            "NewReleases",
            VectorPathSpec("M12 2.6L14.9 5.0L18.6 5.4L19.0 9.1L21.4 12.0L19.0 14.9L18.6 18.6L14.9 19.0L12.0 21.4L9.1 19.0L5.4 18.6L5.0 14.9L2.6 12.0L5.0 9.1L5.4 5.4L9.1 5.0Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 8.2V12.8", filled = false, stroked = true, strokeWidth = 1.65f),
            VectorPathSpec("M12 15.8V16.0", filled = false, stroked = true, strokeWidth = 1.9f)
        )
    }

    // Solar-style Moon (Dark Mode toggle)
    val Moon: ImageVector by lazy {
        buildSolarIcon(
            "Moon",
            VectorPathSpec("M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Tag (Categories)
    val Tag: ImageVector by lazy {
        buildSolarIcon(
            "Tag",
            VectorPathSpec("M4 11.8V6.2C4 4.98 4.98 4 6.2 4H11.8C12.38 4 12.94 4.23 13.35 4.64L19.36 10.65C20.21 11.5 20.21 12.88 19.36 13.73L13.73 19.36C12.88 20.21 11.5 20.21 10.65 19.36L4.64 13.35C4.23 12.94 4 12.38 4 11.8Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M8.5 8.5L8.55 8.5", filled = false, stroked = true, strokeWidth = 2.0f)
        )
    }

    // Desktop icon: info-circle-linear
    val Info: ImageVector by lazy {
        buildSolarIcon(
            "Info",
            VectorPathSpec("M 2 12 A 10 10 0 1 0 22 12 A 10 10 0 1 0 2 12 Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 17V11", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 8H12.01", filled = false, stroked = true, strokeWidth = 1.8f)
        )
    }

    // Solar-style Gallery / Image attachment icon
    val ImageAttach: ImageVector by lazy {
        buildSolarIcon(
            "ImageAttach",
            VectorPathSpec("M2 12C2 7.28595 2 4.92893 3.46447 3.46447C4.92893 2 7.28595 2 12 2C16.714 2 19.0711 2 20.5355 3.46447C22 4.92893 22 7.28595 22 12C22 16.714 22 19.0711 20.5355 20.5355C19.0711 22 16.714 22 12 22C7.28595 22 4.92893 22 3.46447 20.5355C2 19.0711 2 16.714 2 12Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M16 10C17.1046 10 18 9.10457 18 8C18 6.89543 17.1046 6 16 6C14.8954 6 14 6.89543 14 8C14 9.10457 14.8954 10 16 10Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M2 14.5L6.5 10.5C7.3 9.8 8.5 9.8 9.3 10.5L14 15", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12.5 13.5L14.5 11.8C15.3 11.1 16.5 11.1 17.3 11.8L22 16", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Shield (Security & Privacy)
    val Shield: ImageVector by lazy {
        buildSolarIcon(
            "Shield",
            VectorPathSpec("M12 2.5L4 5.8V11.2C4 16.2 7.4 20.4 12 21.8C16.6 20.4 20 16.2 20 11.2V5.8L12 2.5Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M9.5 12L11.2 13.7L14.8 10.1", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Storage / Data (Database cylinder)
    val Storage: ImageVector by lazy {
        buildSolarIcon(
            "Storage",
            VectorPathSpec("M4 6C4 4.34 7.58 3 12 3C16.42 3 20 4.34 20 6C20 7.66 16.42 9 12 9C7.58 9 4 7.66 4 6Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M4 6V12C4 13.66 7.58 15 12 15C16.42 15 20 13.66 20 12V6", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M4 12V18C4 19.66 7.58 21 12 21C16.42 21 20 19.66 20 18V12", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Incognito (Hat & Glasses)
    val Incognito: ImageVector by lazy {
        buildSolarIcon(
            "Incognito",
            VectorPathSpec("M3 11H21", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M6 11L7.8 5.4C8.1 4.5 8.9 4 9.8 4H14.2C15.1 4 15.9 4.5 16.2 5.4L18 11", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M 5 16.5 A 2.5 2.5 0 1 0 10 16.5 A 2.5 2.5 0 1 0 5 16.5 Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M 14 16.5 A 2.5 2.5 0 1 0 19 16.5 A 2.5 2.5 0 1 0 14 16.5 Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M10 16.5H14", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Palette (Appearance)
    val Palette: ImageVector by lazy {
        buildSolarIcon(
            "Palette",
            VectorPathSpec("M12 2.5C6.75 2.5 2.5 6.75 2.5 12C2.5 17.25 6.75 21.5 12 21.5C13.38 21.5 14.5 20.38 14.5 19C14.5 18.38 14.26 17.81 13.88 17.38C13.52 16.96 13.3 16.42 13.3 15.83C13.3 14.55 14.34 13.5 15.62 13.5H17.5C19.71 13.5 21.5 11.71 21.5 9.5C21.5 5.44 17.25 2.5 12 2.5Z", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M7.5 10.5H7.51", filled = false, stroked = true, strokeWidth = 2.1f),
            VectorPathSpec("M10.5 7.5H10.51", filled = false, stroked = true, strokeWidth = 2.1f),
            VectorPathSpec("M14.5 7.5H14.51", filled = false, stroked = true, strokeWidth = 2.1f),
            VectorPathSpec("M17.2 10.2H17.21", filled = false, stroked = true, strokeWidth = 2.1f)
        )
    }

    // Solar-style Open Book (Reader)
    val BookOpen: ImageVector by lazy {
        buildSolarIcon(
            "BookOpen",
            VectorPathSpec("M12 6.5C10.5 5.2 8.2 4.5 5.5 4.5C4.4 4.5 3.5 4.7 3 5V18.5C3.6 18.2 4.5 18 5.5 18C8.2 18 10.5 18.7 12 20", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 6.5C13.5 5.2 15.8 4.5 18.5 4.5C19.6 4.5 20.5 4.7 21 5V18.5C20.4 18.2 19.5 18 18.5 18C15.8 18 13.5 18.7 12 20", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M12 6.5V20", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }

    // Solar-style Chain Link (Tracking / Account Linking)
    val Link: ImageVector by lazy {
        buildSolarIcon(
            "Link",
            VectorPathSpec("M10 13 A 5 5 0 0 0 17.54 13.54 L 20.54 10.54 A 5 5 0 0 0 13.46 3.46 L 11.75 5.17", filled = false, stroked = true, strokeWidth = 1.6f),
            VectorPathSpec("M14 11 A 5 5 0 0 0 6.46 10.46 L 3.46 13.46 A 5 5 0 0 0 10.54 20.54 L 12.24 18.84", filled = false, stroked = true, strokeWidth = 1.6f)
        )
    }

    // Solar-style Code Brackets (Advanced)
    val Code: ImageVector by lazy {
        buildSolarIcon(
            "Code",
            VectorPathSpec("M8.5 8L4 12L8.5 16", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M15.5 8L20 12L15.5 16", filled = false, stroked = true, strokeWidth = 1.5f),
            VectorPathSpec("M13.5 5.5L10.5 18.5", filled = false, stroked = true, strokeWidth = 1.5f)
        )
    }
}
