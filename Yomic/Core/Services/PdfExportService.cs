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
                        using var data = SKData.Create(fileStream);
                        using var image = SKImage.FromEncodedData(data);
                        if (image == null) continue;

                        SKImage imageToDraw = image;
                        bool needsDispose = false;

                        var ext = Path.GetExtension(file).ToLowerInvariant();
                        // If file is PNG/BMP or over 1.5MB, re-encode to high quality JPEG (85%) to compress PDF drastically
                        if (ext == ".png" || ext == ".bmp" || fileStream.Length > 1500 * 1024)
                        {
                            using var bitmap = SKBitmap.FromImage(image);
                            using var encoded = bitmap.Encode(SKEncodedImageFormat.Jpeg, 85);
                            if (encoded != null)
                            {
                                var compressedImg = SKImage.FromEncodedData(encoded);
                                if (compressedImg != null)
                                {
                                    imageToDraw = compressedImg;
                                    needsDispose = true;
                                }
                            }
                        }

                        try
                        {
                            using var canvas = pdfDocument.BeginPage(imageToDraw.Width, imageToDraw.Height);
                            canvas.DrawImage(imageToDraw, 0, 0);
                            pdfDocument.EndPage();
                        }
                        finally
                        {
                            if (needsDispose) imageToDraw.Dispose();
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
