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
                        using var fileStream = File.OpenRead(file);
                        using var originalBitmap = SKBitmap.Decode(fileStream);
                        if (originalBitmap == null) continue;

                        // Downscale if width > 1440px to preserve crisp 4K readability while saving 90% PDF storage
                        int maxW = 1440;
                        int width = originalBitmap.Width;
                        int height = originalBitmap.Height;

                        SKBitmap bitmapToUse = originalBitmap;
                        bool isScaled = false;

                        if (width > maxW)
                        {
                            int targetW = maxW;
                            int targetH = (int)((double)height / width * targetW);
                            var scaled = originalBitmap.Resize(new SKImageInfo(targetW, targetH), SKSamplingOptions.Default);
                            if (scaled != null)
                            {
                                bitmapToUse = scaled;
                                isScaled = true;
                            }
                        }

                        try
                        {
                            // Encode to Jpeg at 80% quality for maximum PDF stream compression
                            using var data = bitmapToUse.Encode(SKEncodedImageFormat.Jpeg, 80);
                            using var compressedImage = data != null ? SKImage.FromEncodedData(data) : null;

                            if (compressedImage != null)
                            {
                                using var canvas = pdfDocument.BeginPage(compressedImage.Width, compressedImage.Height);
                                canvas.DrawImage(compressedImage, 0, 0, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.None));
                                pdfDocument.EndPage();
                            }
                        }
                        finally
                        {
                            if (isScaled) bitmapToUse.Dispose();
                        }
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
            var exportFolder = Path.Combine(userDownloads, "Yomic_Exports");
            if (!Directory.Exists(exportFolder)) Directory.CreateDirectory(exportFolder);

            var zipPath = Path.Combine(exportFolder, $"{safeTitle}.zip");
            var tempPdfPath = Path.Combine(Path.GetTempPath(), $"Yomic_Chapter_Pdf_{Guid.NewGuid():N}.pdf");

            try
            {
                // 1. Generate single chapter PDF
                await CreatePdfFromImageFolderAsync(chapterFolder, tempPdfPath);

                // 2. Open or Create ZipArchive in Update mode
                using (var zipStream = new FileStream(zipPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
                using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Update))
                {
                    var pdfEntryName = $"{safeChapter}.pdf";

                    // Delete existing entry if present to overwrite cleanly
                    var existingEntry = archive.GetEntry(pdfEntryName);
                    existingEntry?.Delete();

                    // Create new entry and copy PDF bytes
                    var newEntry = archive.CreateEntry(pdfEntryName, CompressionLevel.Optimal);
                    using var entryStream = newEntry.Open();
                    using var pdfStream = File.OpenRead(tempPdfPath);
                    await pdfStream.CopyToAsync(entryStream);
                }

                return zipPath;
            }
            finally
            {
                try { if (File.Exists(tempPdfPath)) File.Delete(tempPdfPath); } catch { }
            }
        }
    }
}
