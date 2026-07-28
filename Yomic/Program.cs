using Avalonia;
using Avalonia.ReactiveUI;
using System;

namespace Yomic;

class Program
{
    // Initialization code. Don't use any Avalonia, third-party APIs or any
    // SynchronizationContext-reliant code before AppMain is called: things aren't initialized
    // yet and stuff might break.
    [STAThread]
    public static void Main(string[] args)
    {
        try
        {
            if (args != null && Array.Exists(args, a => a.Equals("--background-update", StringComparison.OrdinalIgnoreCase)))
            {
                // Run Headless Update
                System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(System.Console.Out));
                System.Diagnostics.Trace.AutoFlush = true;
                
                System.Diagnostics.Debug.WriteLine("[Background] Starting headless background library update...");
                
                // Initialize core services manually
                var settingsService = new Core.Services.SettingsService();
                var networkService = new Core.Services.NetworkService(settingsService);
                var sourceManager = new Core.Services.SourceManager();
                var libraryService = new Core.Services.LibraryService();
                
                // Block until complete
                var task = libraryService.UpdateAllLibraryMangaAsync(sourceManager);
                task.Wait();
                
                int updated = task.Result;
                System.Diagnostics.Debug.WriteLine($"[Background] Finished. {updated} new chapters found.");
                
                return; // Exit without building Avalonia app
            }

            // Redirect Debug.WriteLine to Console
            System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(System.Console.Out));
            System.Diagnostics.Trace.AutoFlush = true;

            BuildAvaloniaApp()
                .StartWithClassicDesktopLifetime(args ?? Array.Empty<string>());
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex.ToString());
            throw;
        }
    }

    // Avalonia configuration, don't remove; also used by visual designer.
    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace()
            .UseReactiveUI();
}
