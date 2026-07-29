using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using SkiaSharp;

namespace Yomic.Core.Services
{
    public static class PdfExportService
    {
        public static Task<string> CreatePdfFromImageFolderAsync(string chapterFolder, string outputPdfPath)
        {
            return Task.Run(() =>
            {
                var imageExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif", ".avif"
                };

                var files = Directory.GetFiles(chapterFolder)
                    .Where(f => imageExtensions.Contains(Path.GetExtension(f)))
                    .OrderBy(f => f, new NaturalStringComparer())
                    .ToList();

                if (files.Count == 0) throw new InvalidOperationException("No image pages found in chapter folder.");

                using var outputStream = File.Create(outputPdfPath);
                using var pdfDocument = SKDocument.CreatePdf(outputStream);

                foreach (var file in files)
                {
                    try
                    {
                        using var bitmap = SKBitmap.Decode(file);
                        if (bitmap == null) continue;

                        using var canvas = pdfDocument.BeginPage(bitmap.Width, bitmap.Height);
                        using var paint = new SKPaint { IsAntialias = true, FilterQuality = SKFilterQuality.High };
                        canvas.DrawBitmap(bitmap, 0, 0, paint);
                        pdfDocument.EndPage();
                    }
                    catch
                    {
                        // Skip unreadable image page
                    }
                }

                pdfDocument.Close();
                return outputPdfPath;
            });
        }

        public static async Task<string> ExportChapterImagesToZipPdfAsync(string mangaTitle, string chapterName, string chapterFolder)
        {
            var userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            var exportFolder = Path.Combine(userDownloads, "Yomic_Exports");
            if (!Directory.Exists(exportFolder)) Directory.CreateDirectory(exportFolder);

            var safeTitle = DownloadPathService.SanitizePathSegment(mangaTitle);
            var safeChapter = DownloadPathService.SanitizePathSegment(chapterName);
            var tempDir = Path.Combine(Path.GetTempPath(), "Yomic_Pdf_Temp_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            try
            {
                var pdfFileName = $"{safeTitle} - {safeChapter}.pdf";
                var tempPdfPath = Path.Combine(tempDir, pdfFileName);

                await CreatePdfFromImageFolderAsync(chapterFolder, tempPdfPath);

                var zipFileName = $"{safeTitle} - {safeChapter}.zip";
                var destZipPath = Path.Combine(exportFolder, zipFileName);

                if (File.Exists(destZipPath)) File.Delete(destZipPath);
                ZipFile.CreateFromDirectory(tempDir, destZipPath);

                return destZipPath;
            }
            finally
            {
                try { Directory.Delete(tempDir, true); } catch { }
            }
        }
    }

    public class NaturalStringComparer : IComparer<string>
    {
        public int Compare(string? x, string? y)
        {
            if (x == null && y == null) return 0;
            if (x == null) return -1;
            if (y == null) return 1;

            string nameX = Path.GetFileNameWithoutExtension(x);
            string nameY = Path.GetFileNameWithoutExtension(y);

            var regex = new Regex(@"\d+|\D+");
            var tokensX = regex.Matches(nameX).Select(m => m.Value).ToArray();
            var tokensY = regex.Matches(nameY).Select(m => m.Value).ToArray();

            for (int i = 0; i < Math.Min(tokensX.Length, tokensY.Length); i++)
            {
                var tokenX = tokensX[i];
                var tokenY = tokensY[i];

                if (int.TryParse(tokenX, out int numX) && int.TryParse(tokenY, out int numY))
                {
                    int cmp = numX.CompareTo(numY);
                    if (cmp != 0) return cmp;
                }
                else
                {
                    int cmp = string.Compare(tokenX, tokenY, StringComparison.OrdinalIgnoreCase);
                    if (cmp != 0) return cmp;
                }
            }

            return tokensX.Length.CompareTo(tokensY.Length);
        }
    }
}
