using Avalonia.Controls;
using Avalonia.Platform.Storage;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Yomic.ViewModels;

namespace Yomic.Views
{
    public partial class FeedbackDialog : Window
    {
        private const long MaxScreenshotBytes = 5 * 1024 * 1024;

        public FeedbackDialog()
        {
            InitializeComponent();
        }

        protected override void OnDataContextChanged(EventArgs e)
        {
            base.OnDataContextChanged(e);

            if (DataContext is FeedbackDialogViewModel vm)
            {
                vm.OpenScreenshotPickerAsync = PickScreenshotsAsync;
            }
        }

        private async System.Threading.Tasks.Task<IReadOnlyList<FeedbackScreenshotAttachment>> PickScreenshotsAsync(int remainingSlots)
        {
            var files = await StorageProvider.OpenFilePickerAsync(new FilePickerOpenOptions
            {
                Title = "Attach Screenshot",
                AllowMultiple = true,
                FileTypeFilter = new[]
                {
                    new FilePickerFileType("Images")
                    {
                        Patterns = new[] { "*.png", "*.jpg", "*.jpeg", "*.webp" },
                        MimeTypes = new[] { "image/png", "image/jpeg", "image/webp" }
                    }
                }
            });

            if (files.Count == 0)
            {
                return Array.Empty<FeedbackScreenshotAttachment>();
            }

            var attachments = new List<FeedbackScreenshotAttachment>();
            var selectedFiles = files.Take(remainingSlots);

            if (files.Count > remainingSlots && DataContext is FeedbackDialogViewModel limitVm)
            {
                limitVm.ShowPickerError($"Only {remainingSlots} more screenshot(s) can be attached.");
            }

            foreach (var file in selectedFiles)
            {
                await using var stream = await file.OpenReadAsync();
                using var memory = new MemoryStream();
                await stream.CopyToAsync(memory);

                if (memory.Length > MaxScreenshotBytes)
                {
                    if (DataContext is FeedbackDialogViewModel vm)
                    {
                        vm.ShowPickerError($"{file.Name} is too large. Please choose images under 5 MB.");
                    }

                    continue;
                }

                memory.Position = 0;
                Avalonia.Media.Imaging.Bitmap? thumbnail = null;
                try
                {
                    thumbnail = Avalonia.Media.Imaging.Bitmap.DecodeToWidth(memory, 60);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Feedback] Failed to decode thumbnail: {ex.Message}");
                }

                attachments.Add(new FeedbackScreenshotAttachment
                {
                    FileName = file.Name,
                    ContentType = GetContentType(file.Name),
                    Base64Data = Convert.ToBase64String(memory.ToArray()),
                    Thumbnail = thumbnail
                });
            }

            return attachments;
        }

        private static string GetContentType(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();
            return extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".webp" => "image/webp",
                _ => "image/png"
            };
        }
    }
}
