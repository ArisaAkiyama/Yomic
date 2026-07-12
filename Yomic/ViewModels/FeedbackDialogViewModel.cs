using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reactive;
using System.Threading.Tasks;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using ReactiveUI;
using Avalonia.Media.Imaging;

namespace Yomic.ViewModels
{
    public enum FeedbackCategory
    {
        BugReport,
        FeatureRequest,
        General,
        Question
    }

    public class FeedbackDialogViewModel : ViewModelBase
    {
        private string _feedbackText = string.Empty;
        public string FeedbackText
        {
            get => _feedbackText;
            set
            {
                this.RaiseAndSetIfChanged(ref _feedbackText, value);
                this.RaisePropertyChanged(nameof(CanSubmit));
                this.RaisePropertyChanged(nameof(CharacterCountText));
            }
        }

        public string CharacterCountText => $"{FeedbackText.Length}/1000";

        private FeedbackCategory _selectedCategory = FeedbackCategory.BugReport;
        public FeedbackCategory SelectedCategory
        {
            get => _selectedCategory;
            set => this.RaiseAndSetIfChanged(ref _selectedCategory, value);
        }

        public IReadOnlyList<FeedbackCategory> FeedbackCategories { get; } = Enum.GetValues<FeedbackCategory>();

        private bool _isSending;
        public bool IsSending
        {
            get => _isSending;
            set => this.RaiseAndSetIfChanged(ref _isSending, value);
        }

        public bool CanSubmit => !string.IsNullOrWhiteSpace(FeedbackText) && FeedbackText.Length <= 1000 && !IsSending;

        public ReactiveCommand<Avalonia.Controls.Window, Unit> CancelCommand { get; }
        public ReactiveCommand<Avalonia.Controls.Window, Unit> SubmitCommand { get; }
        public ReactiveCommand<Unit, Unit> AttachScreenshotCommand { get; }
        public ReactiveCommand<FeedbackScreenshotAttachment, Unit> RemoveScreenshotCommand { get; }

        public const int MaxScreenshotCount = 3;
        public Func<int, Task<IReadOnlyList<FeedbackScreenshotAttachment>>>? OpenScreenshotPickerAsync { get; set; }

        public ObservableCollection<FeedbackScreenshotAttachment> ScreenshotAttachments { get; } = new();
        public bool HasScreenshot => ScreenshotAttachments.Count > 0;
        public bool CanAttachMoreScreenshots => ScreenshotAttachments.Count < MaxScreenshotCount;
        public string AttachScreenshotText => HasScreenshot ? $"Attach Screenshot ({ScreenshotAttachments.Count}/{MaxScreenshotCount})" : "Attach Screenshot";

        private readonly Action<string, NotificationType>? _showNotificationCallback;

        public FeedbackDialogViewModel(Action<string, NotificationType>? showNotificationCallback = null)
        {
            _showNotificationCallback = showNotificationCallback;

            CancelCommand = ReactiveCommand.Create<Avalonia.Controls.Window>(window =>
            {
                window?.Close();
            });

            SubmitCommand = ReactiveCommand.CreateFromTask<Avalonia.Controls.Window>(async window =>
            {
                IsSending = true;
                this.RaisePropertyChanged(nameof(CanSubmit));
                
                try
                {
                    var success = await SendEmailAsync(FeedbackText);
                    if (success)
                    {
                        window?.Close();
                    }
                }
                finally
                {
                    IsSending = false;
                    this.RaisePropertyChanged(nameof(CanSubmit));
                }
            }, this.WhenAnyValue(x => x.CanSubmit));

            AttachScreenshotCommand = ReactiveCommand.CreateFromTask(async () =>
            {
                if (OpenScreenshotPickerAsync == null)
                {
                    _showNotificationCallback?.Invoke("Screenshot picker is not available.", NotificationType.Error);
                    return;
                }

                var remainingSlots = MaxScreenshotCount - ScreenshotAttachments.Count;
                if (remainingSlots <= 0)
                {
                    _showNotificationCallback?.Invoke($"You can attach up to {MaxScreenshotCount} screenshots.", NotificationType.Error);
                    return;
                }

                var attachments = await OpenScreenshotPickerAsync(remainingSlots);
                if (attachments.Count > 0)
                {
                    foreach (var attachment in attachments.Take(remainingSlots))
                    {
                        ScreenshotAttachments.Add(attachment);
                    }

                    RaiseScreenshotStateChanged();
                    _showNotificationCallback?.Invoke($"{attachments.Count} screenshot(s) attached.", NotificationType.Success);
                }
            });

            RemoveScreenshotCommand = ReactiveCommand.Create<FeedbackScreenshotAttachment>(attachment =>
            {
                ScreenshotAttachments.Remove(attachment);
                RaiseScreenshotStateChanged();
            });
        }

        public void ShowPickerError(string message)
        {
            _showNotificationCallback?.Invoke(message, NotificationType.Error);
        }

        private void RaiseScreenshotStateChanged()
        {
            this.RaisePropertyChanged(nameof(HasScreenshot));
            this.RaisePropertyChanged(nameof(CanAttachMoreScreenshots));
            this.RaisePropertyChanged(nameof(AttachScreenshotText));
        }

        private async Task<bool> SendEmailAsync(string text)
        {
            try
            {
                // Google Apps Script Web App URL
                string url = "https://script.google.com/macros/s/AKfycby_qcMGyle2jYmxGmhf3j_L1VcYsyVcy8iBdxfnXzAf5zruVKttJ3FHe8w52XOUVNHi/exec";

                if (url == "YOUR_GOOGLE_APPS_SCRIPT_URL_HERE")
                {
                    _showNotificationCallback?.Invoke("Feedback URL is not configured.", NotificationType.Error);
                    return false;
                }

                var attachments = ScreenshotAttachments.Select(attachment => new
                {
                    fileName = attachment.FileName,
                    name = attachment.FileName,
                    contentType = attachment.ContentType,
                    mimeType = attachment.ContentType,
                    base64 = attachment.Base64Data,
                    data = attachment.Base64Data
                }).ToArray();

                var screenshot = attachments.FirstOrDefault();

                var payload = new
                {
                    message = text,
                    category = SelectedCategory.ToString(),
                    hasScreenshot = attachments.Length > 0,
                    screenshot,
                    attachment = screenshot,
                    attachments,
                    imageBase64 = screenshot?.base64,
                    imageName = screenshot?.fileName,
                    imageContentType = screenshot?.contentType,
                    screenshotFileName = screenshot?.fileName,
                    screenshotContentType = screenshot?.contentType,
                    screenshotBase64 = screenshot?.base64
                };

                string jsonPayload = JsonSerializer.Serialize(payload);

                // Disable auto-redirect to prevent HttpClient from converting POST to GET on a 302 redirect
                using (var handler = new HttpClientHandler { AllowAutoRedirect = false })
                using (var client = new HttpClient(handler))
                {
                    var content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");
                    var response = await client.PostAsync(url, content);

                    // Google Apps Script redirects with 302 Found to script.googleusercontent.com on success
                    bool isSuccess = response.IsSuccessStatusCode;
                    
                    if (response.StatusCode == System.Net.HttpStatusCode.Redirect || 
                        response.StatusCode == System.Net.HttpStatusCode.Found ||
                        response.StatusCode == System.Net.HttpStatusCode.MovedPermanently)
                    {
                        var redirectLocation = response.Headers.Location?.ToString();
                        isSuccess = !string.IsNullOrWhiteSpace(redirectLocation) &&
                                    redirectLocation.Contains("script.googleusercontent.com", StringComparison.OrdinalIgnoreCase);
                    }

                    if (isSuccess)
                    {
                        Console.WriteLine("[Feedback] Google Apps Script sent successfully!");
                        _showNotificationCallback?.Invoke("Feedback sent successfully! Thank you.", NotificationType.Success);
                        return true;
                    }
                    else
                    {
                        string errorResponse = await response.Content.ReadAsStringAsync();
                        Console.WriteLine($"[Feedback] Google Apps Script error: {response.StatusCode} - {errorResponse}");
                        _showNotificationCallback?.Invoke("Failed to send feedback. Please try again later.", NotificationType.Error);
                        return false;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Feedback] Error sending via Google Apps Script: {ex.Message}");
                _showNotificationCallback?.Invoke("An error occurred while sending feedback.", NotificationType.Error);
                return false;
            }
        }
    }

    public class FeedbackScreenshotAttachment
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = "image/png";
        public string Base64Data { get; set; } = string.Empty;
        public Bitmap? Thumbnail { get; set; }
    }
}
