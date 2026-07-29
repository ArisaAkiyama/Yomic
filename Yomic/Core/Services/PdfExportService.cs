using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Threading.Tasks;
using SkiaSharp;
using Yomic.Core.Helpers;

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
                        canvas.DrawBitmap(bitmap, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
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
            var safeTitle = DownloadPathService.SanitizePathSegment(mangaTitle);
            var safeChapter = DownloadPathService.SanitizePathSegment(chapterName);

            var userDownloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            var exportFolder = Path.Combine(userDownloads, "Yomic_Exports", safeTitle);
            if (!Directory.Exists(exportFolder)) Directory.CreateDirectory(exportFolder);

            var tempDir = Path.Combine(Path.GetTempPath(), "Yomic_Pdf_Temp_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);

            try
            {
                var pdfFileName = $"{safeTitle} - {safeChapter}.pdf";
                var tempPdfPath = Path.Combine(tempDir, pdfFileName);

                await CreatePdfFromImageFolderAsync(chapterFolder, tempPdfPath);

                var zipFileName = $"{safeChapter}.zip";
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
}
