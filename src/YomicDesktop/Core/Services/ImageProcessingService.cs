using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using SkiaSharp;

namespace Yomic.Core.Services
{
    public class ImageProcessingOptions
    {
        public bool EnableOptimization { get; set; } = true;
        public bool AutoCropBorders { get; set; } = false;
        public int MaxDimension { get; set; } = 2160;
        public bool EnableSharpening { get; set; } = false;
        public int JpegQuality { get; set; } = 88;
        public int WebpQuality { get; set; } = 85;
        public SKEncodedImageFormat OutputFormat { get; set; } = SKEncodedImageFormat.Webp;
    }

    /// <summary>
    /// High-performance 2D image processing engine for Manga/Webtoon reading,
    /// powered by SkiaSharp (Google Skia native SIMD engine).
    /// </summary>
    public class ImageProcessingService
    {
        private static ImageProcessingService? _instance;
        public static ImageProcessingService Instance => _instance ??= new ImageProcessingService();

        public ImageProcessingService() { }

        /// <summary>
        /// Processes a manga/webtoon page: auto-crops borders, smart-downscales oversized 4K assets,
        /// and optionally enhances sharpness. Returns optimized compressed bytes.
        /// Falls back cleanly to original bytes if processing fails or format is unsupported.
        /// </summary>
        public byte[] ProcessPage(byte[] rawBytes, ImageProcessingOptions? options = null)
        {
            if (rawBytes == null || rawBytes.Length == 0) return Array.Empty<byte>();

            options ??= new ImageProcessingOptions();
            if (!options.EnableOptimization && !options.AutoCropBorders && !options.EnableSharpening)
            {
                return rawBytes;
            }

            try
            {
                using var codec = SKCodec.Create(new SKMemoryStream(rawBytes));
                if (codec == null)
                {
                    // Not a codec Skia directly decodes (e.g., animated gif or raw avif if missing codec), return as is
                    return rawBytes;
                }

                var info = codec.Info;
                // If it's already an optimal size and no cropping or sharpening is requested, skip re-encoding
                bool needsResize = options.MaxDimension > 0 && (info.Width > options.MaxDimension || info.Height > options.MaxDimension);
                if (!needsResize && !options.AutoCropBorders && !options.EnableSharpening)
                {
                    return rawBytes;
                }

                using var originalBitmap = SKBitmap.Decode(codec);
                if (originalBitmap == null) return rawBytes;

                SKBitmap currentBitmap = originalBitmap;
                bool isCurrentBitmapDisposible = false;

                try
                {
                    // 1. Auto-Crop Borders (Whitespace / Letterboxing)
                    if (options.AutoCropBorders)
                    {
                        var cropped = DetectAndCropBorders(currentBitmap);
                        if (cropped != null && cropped != currentBitmap)
                        {
                            if (isCurrentBitmapDisposible) currentBitmap.Dispose();
                            currentBitmap = cropped;
                            isCurrentBitmapDisposible = true;
                        }
                    }

                    // 2. Smart Downscale (Cap at maxDimension, e.g., 2160px for high-DPI desktop displays)
                    if (options.MaxDimension > 0 && (currentBitmap.Width > options.MaxDimension || currentBitmap.Height > options.MaxDimension))
                    {
                        var resized = DownscaleProportionally(currentBitmap, options.MaxDimension);
                        if (resized != null && resized != currentBitmap)
                        {
                            if (isCurrentBitmapDisposible) currentBitmap.Dispose();
                            currentBitmap = resized;
                            isCurrentBitmapDisposible = true;
                        }
                    }

                    // 3. Image Enhancement / Sharpening (Optional)
                    if (options.EnableSharpening)
                    {
                        var sharpened = ApplySharpeningFilter(currentBitmap);
                        if (sharpened != null && sharpened != currentBitmap)
                        {
                            if (isCurrentBitmapDisposible) currentBitmap.Dispose();
                            currentBitmap = sharpened;
                            isCurrentBitmapDisposible = true;
                        }
                    }

                    // 4. Encode to optimized stream
                    using var image = SKImage.FromBitmap(currentBitmap);
                    var format = options.OutputFormat;
                    int quality = format == SKEncodedImageFormat.Webp ? options.WebpQuality : options.JpegQuality;

                    using var encodedData = image.Encode(format, quality);
                    if (encodedData != null && encodedData.Size > 0)
                    {
                        return encodedData.ToArray();
                    }

                    // Fallback to JPEG if WebP encoding failed
                    using var jpegData = image.Encode(SKEncodedImageFormat.Jpeg, options.JpegQuality);
                    if (jpegData != null && jpegData.Size > 0)
                    {
                        return jpegData.ToArray();
                    }

                    return rawBytes;
                }
                finally
                {
                    if (isCurrentBitmapDisposible)
                    {
                        currentBitmap.Dispose();
                    }
                }
            }
            catch (Exception ex)
            {
                LogService.Debug("ImageProcessingService", $"Page processing bypassed due to error: {ex.Message}");
                return rawBytes;
            }
        }

        /// <summary>
        /// Detects uniform whitespace or black border margins around the image and crops them.
        /// Caps maximum crop at 18% per side to prevent accidentally cutting into panels.
        /// </summary>
        public SKBitmap? DetectAndCropBorders(SKBitmap bitmap, int tolerance = 18)
        {
            int width = bitmap.Width;
            int height = bitmap.Height;
            if (width < 200 || height < 200) return null; // Skip tiny images / icons

            int maxCropX = (int)(width * 0.18f);
            int maxCropY = (int)(height * 0.18f);

            // Sample corner colors to determine border background (typically white or black)
            var cTopLeft = bitmap.GetPixel(4, 4);
            var cTopRight = bitmap.GetPixel(width - 5, 4);
            var cBottomLeft = bitmap.GetPixel(4, height - 5);
            var cBottomRight = bitmap.GetPixel(width - 5, height - 5);

            bool isWhiteBorder = (cTopLeft.Red > 235 && cTopLeft.Green > 235 && cTopLeft.Blue > 235) ||
                                (cTopRight.Red > 235 && cTopRight.Green > 235 && cTopRight.Blue > 235);

            bool isBlackBorder = (cTopLeft.Red < 20 && cTopLeft.Green < 20 && cTopLeft.Blue < 20) ||
                                (cTopRight.Red < 20 && cTopRight.Green < 20 && cTopRight.Blue < 20);

            if (!isWhiteBorder && !isBlackBorder) return null; // No uniform border detected

            Func<SKColor, bool> isBorderColor = isWhiteBorder
                ? (c) => c.Red >= (255 - tolerance) && c.Green >= (255 - tolerance) && c.Blue >= (255 - tolerance)
                : (c) => c.Red <= tolerance && c.Green <= tolerance && c.Blue <= tolerance;

            int top = 0;
            int bottom = height - 1;
            int left = 0;
            int right = width - 1;

            // Scan Top
            for (int y = 0; y < maxCropY; y++)
            {
                int borderCount = 0;
                int sampleStep = Math.Max(1, width / 40);
                int samples = 0;
                for (int x = 0; x < width; x += sampleStep)
                {
                    samples++;
                    if (isBorderColor(bitmap.GetPixel(x, y))) borderCount++;
                }
                if ((float)borderCount / samples >= 0.96f) top = y;
                else break;
            }

            // Scan Bottom
            for (int y = height - 1; y >= height - maxCropY; y--)
            {
                int borderCount = 0;
                int sampleStep = Math.Max(1, width / 40);
                int samples = 0;
                for (int x = 0; x < width; x += sampleStep)
                {
                    samples++;
                    if (isBorderColor(bitmap.GetPixel(x, y))) borderCount++;
                }
                if ((float)borderCount / samples >= 0.96f) bottom = y;
                else break;
            }

            // Scan Left
            for (int x = 0; x < maxCropX; x++)
            {
                int borderCount = 0;
                int sampleStep = Math.Max(1, height / 40);
                int samples = 0;
                for (int y = 0; y < height; y += sampleStep)
                {
                    samples++;
                    if (isBorderColor(bitmap.GetPixel(x, y))) borderCount++;
                }
                if ((float)borderCount / samples >= 0.96f) left = x;
                else break;
            }

            // Scan Right
            for (int x = width - 1; x >= width - maxCropX; x--)
            {
                int borderCount = 0;
                int sampleStep = Math.Max(1, height / 40);
                int samples = 0;
                for (int y = 0; y < height; y += sampleStep)
                {
                    samples++;
                    if (isBorderColor(bitmap.GetPixel(x, y))) borderCount++;
                }
                if ((float)borderCount / samples >= 0.96f) right = x;
                else break;
            }

            int newWidth = right - left + 1;
            int newHeight = bottom - top + 1;

            // Only crop if meaningful margin was trimmed (at least 12 pixels total)
            if (newWidth > 100 && newHeight > 100 && (newWidth < width - 12 || newHeight < height - 12))
            {
                var cropRect = SKRectI.Create(left, top, newWidth, newHeight);
                var cropped = new SKBitmap(newWidth, newHeight, bitmap.ColorType, bitmap.AlphaType);
                using var canvas = new SKCanvas(cropped);
                canvas.DrawBitmap(bitmap, cropRect, SKRect.Create(0, 0, newWidth, newHeight));
                return cropped;
            }

            return null;
        }

        /// <summary>
        /// Proportional downscaler with high-quality bicubic sampling.
        /// </summary>
        public SKBitmap? DownscaleProportionally(SKBitmap bitmap, int maxDimension)
        {
            if (bitmap.Width <= maxDimension && bitmap.Height <= maxDimension) return null;

            double ratio = Math.Min((double)maxDimension / bitmap.Width, (double)maxDimension / bitmap.Height);
            int targetWidth = Math.Max(1, (int)(bitmap.Width * ratio));
            int targetHeight = Math.Max(1, (int)(bitmap.Height * ratio));

            var info = new SKImageInfo(targetWidth, targetHeight, bitmap.ColorType, bitmap.AlphaType);
            var resized = new SKBitmap(info);

            using var canvas = new SKCanvas(resized);
            using var paint = new SKPaint
            {
                FilterQuality = SKFilterQuality.High,
                IsAntialias = true
            };
            canvas.DrawBitmap(bitmap, new SKRect(0, 0, targetWidth, targetHeight), paint);
            return resized;
        }

        /// <summary>
        /// Applies a mild 3x3 unsharp mask filter to sharpen text dialogs and line art.
        /// </summary>
        public SKBitmap? ApplySharpeningFilter(SKBitmap bitmap)
        {
            var info = new SKImageInfo(bitmap.Width, bitmap.Height, bitmap.ColorType, bitmap.AlphaType);
            var sharpened = new SKBitmap(info);

            // 3x3 Sharpen kernel matrix
            float[] kernel = new float[]
            {
                 0.0f, -0.35f,  0.0f,
                -0.35f,  2.40f, -0.35f,
                 0.0f, -0.35f,  0.0f
            };

            using var canvas = new SKCanvas(sharpened);
            using var paint = new SKPaint();
            using var filter = SKImageFilter.CreateMatrixConvolution(
                new SKSizeI(3, 3),
                kernel,
                1.0f,
                0.0f,
                new SKPointI(1, 1),
                SKShaderTileMode.Clamp,
                false);

            paint.ImageFilter = filter;
            canvas.DrawBitmap(bitmap, 0, 0, paint);
            return sharpened;
        }

        /// <summary>
        /// Stitches a series of vertical webtoon strip chunks into a single seamless image.
        /// </summary>
        public byte[]? StitchWebtoonPages(IEnumerable<byte[]> pageChunks, int targetWidth = 0)
        {
            var bitmaps = new List<SKBitmap>();
            try
            {
                foreach (var chunk in pageChunks)
                {
                    if (chunk == null || chunk.Length == 0) continue;
                    var bmp = SKBitmap.Decode(chunk);
                    if (bmp != null) bitmaps.Add(bmp);
                }

                if (bitmaps.Count == 0) return null;
                if (bitmaps.Count == 1) return ProcessPage(pageChunks.First());

                int maxWidth = bitmaps.Max(b => b.Width);
                if (targetWidth > 0) maxWidth = Math.Min(maxWidth, targetWidth);

                int totalHeight = 0;
                foreach (var b in bitmaps)
                {
                    double scale = (double)maxWidth / b.Width;
                    totalHeight += (int)(b.Height * scale);
                }

                var stitched = new SKBitmap(maxWidth, totalHeight);
                using (var canvas = new SKCanvas(stitched))
                {
                    canvas.Clear(SKColors.White);
                    int currentY = 0;
                    foreach (var b in bitmaps)
                    {
                        double scale = (double)maxWidth / b.Width;
                        int scaledH = (int)(b.Height * scale);
                        var destRect = new SKRect(0, currentY, maxWidth, currentY + scaledH);
                        canvas.DrawBitmap(b, destRect);
                        currentY += scaledH;
                    }
                }

                using var image = SKImage.FromBitmap(stitched);
                using var data = image.Encode(SKEncodedImageFormat.Webp, 85);
                stitched.Dispose();
                return data?.ToArray();
            }
            finally
            {
                foreach (var b in bitmaps) b.Dispose();
            }
        }
    }
}
