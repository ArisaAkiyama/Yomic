using Avalonia;
using Avalonia.Controls.ApplicationLifetimes;
using Avalonia.Markup.Xaml;
using Yomic.ViewModels;
using Yomic.Views;
using Yomic.Core.Services;
using Microsoft.EntityFrameworkCore;

namespace Yomic
{
    public partial class App : Application
    {
        public static SettingsService? SettingsService { get; private set; }
        public App()
        {
            // Catch unhandled exceptions
            System.AppDomain.CurrentDomain.UnhandledException += (sender, args) =>
            {
                if (args.ExceptionObject as System.Exception is System.Exception ex)
                {
                    HandleCrash(ex);
                }
            };

            // Catch unobserved task exceptions
            System.Threading.Tasks.TaskScheduler.UnobservedTaskException += (sender, args) =>
            {
                // Mark as observed so background task cancellations (e.g. Puppeteer, HTTP, GC finalizers) do not crash the app
                args.SetObserved();

                var baseEx = args.Exception?.GetBaseException();
                if (baseEx != null)
                {
                    Yomic.Core.Services.LogService.Warning("Global", $"UnobservedTaskException (background): {baseEx.Message}");
                }
            };

            // Catch ReactiveUI unhandled exceptions
            ReactiveUI.RxApp.DefaultExceptionHandler = System.Reactive.Observer.Create<System.Exception>(ex =>
            {
                HandleCrash(ex);
            });
        }

        private static void HandleCrash(System.Exception ex)
        {
            try
            {
                Yomic.Core.Services.LogService.Error("Global", "Unhandled Exception", ex);

                var appData = System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData);
                var appDir = System.IO.Path.Combine(appData, "Yomic");
                if (!System.IO.Directory.Exists(appDir))
                {
                    System.IO.Directory.CreateDirectory(appDir);
                }
                var crashFilePath = System.IO.Path.Combine(appDir, "crash.txt");
                
                System.IO.File.WriteAllText(crashFilePath, $"Date: {System.DateTime.Now}\nMessage: {ex.Message}\n\nStack Trace:\n{ex.StackTrace}");
                
                var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
                if (!string.IsNullOrEmpty(exePath))
                {
                    System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                    {
                        FileName = exePath,
                        Arguments = "--show-crash",
                        UseShellExecute = true
                    });
                }
            }
            catch (System.Exception writeEx)
            {
                System.Console.WriteLine($"Failed to write crash dump: {writeEx.Message}");
            }
            finally
            {
                System.Environment.Exit(1);
            }
        }

        public override void Initialize()
        {
            AvaloniaXamlLoader.Load(this);
        }

        public override void OnFrameworkInitializationCompleted()
        {
            if (ApplicationLifetime is IClassicDesktopStyleApplicationLifetime desktop)
            {
                // Check if --show-crash argument is present
                if (desktop.Args != null && System.Array.Exists(desktop.Args, a => a.Equals("--show-crash", System.StringComparison.OrdinalIgnoreCase)))
                {
                    string crashData = string.Empty;
                    try
                    {
                        var appData = System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData);
                        var crashFilePath = System.IO.Path.Combine(appData, "Yomic", "crash.txt");
                        if (System.IO.File.Exists(crashFilePath))
                        {
                            crashData = System.IO.File.ReadAllText(crashFilePath);
                        }
                    }
                    catch (System.Exception ex)
                    {
                        crashData = $"Failed to load crash details: {ex.Message}";
                    }

                    // Load localized resources
                    var settingsServiceTemp = new Core.Services.SettingsService();
                    RequestedThemeVariant = settingsServiceTemp.IsDarkMode ? Avalonia.Styling.ThemeVariant.Dark : Avalonia.Styling.ThemeVariant.Light;
                    var langTemp = settingsServiceTemp.AppLanguage ?? "en";
                    var localeUriTemp = new System.Uri($"avares://Yomic/Assets/Locales/Locale.{langTemp}.axaml");
                    try
                    {
                        var dict = (Avalonia.Controls.ResourceDictionary)Avalonia.Markup.Xaml.AvaloniaXamlLoader.Load(localeUriTemp);
                        Resources.MergedDictionaries.Add(dict);
                    }
                    catch {}

                    desktop.MainWindow = new Views.CrashReportWindow(crashData);
                    base.OnFrameworkInitializationCompleted();
                    return;
                }

                // Run Source ID migration before loading extensions
                // This ensures old hardcoded IDs are updated to new hash-based IDs
                Core.Services.SourceIdMigrationService.RunMigrationIfNeeded();
                
                var sourceManager = new Core.Services.SourceManager();
                // Load persisted JS extensions - auto-loaded in constructor.
                
                var settingsService = new Core.Services.SettingsService();
                SettingsService = settingsService;

                // Load localized ResourceDictionary
                var lang = settingsService.AppLanguage ?? "en";
                var localeUri = new System.Uri($"avares://Yomic/Assets/Locales/Locale.{lang}.axaml");
                try
                {
                    var dict = (Avalonia.Controls.ResourceDictionary)Avalonia.Markup.Xaml.AvaloniaXamlLoader.Load(localeUri);
                    Resources.MergedDictionaries.Add(dict);
                    
                    // Set standard thread cultures for localized dates and formatting
                    var cultureInfo = lang == "id" ? new System.Globalization.CultureInfo("id-ID") : new System.Globalization.CultureInfo("en-US");
                    System.Globalization.CultureInfo.DefaultThreadCurrentCulture = cultureInfo;
                    System.Globalization.CultureInfo.DefaultThreadCurrentUICulture = cultureInfo;
                    System.Threading.Thread.CurrentThread.CurrentCulture = cultureInfo;
                    System.Threading.Thread.CurrentThread.CurrentUICulture = cultureInfo;
                }
                catch (System.Exception ex)
                {
                    Yomic.Core.Services.LogService.Error("App", $"Failed to load language dictionary: {ex.Message}", ex);
                }
                
                // Initialize MangaDex language from persisted settings
                Core.Sources.JsMangaSource.SelectedLanguage = settingsService.MangaDexLanguage;
                
                var libraryService = new Core.Services.LibraryService();
                var networkService = new Core.Services.NetworkService(settingsService);
                var sourceStatusService = new Core.Services.SourceStatusService(sourceManager, settingsService, networkService);
                var downloadService = new Core.Services.DownloadService(sourceManager, libraryService, networkService);
                var imageCacheService = new Core.Services.ImageCacheService();
                var secureImageService = new Core.Services.SecureImageService(networkService, imageCacheService);
                
                // Static Injection for Attached Property
                Yomic.Views.Helpers.SecureImageLoader.Service = secureImageService;
                
                // Apply Theme
                RequestedThemeVariant = settingsService.IsDarkMode ? Avalonia.Styling.ThemeVariant.Dark : Avalonia.Styling.ThemeVariant.Light;
                
                // Ensure Database is Created
                using (var context = new Core.Data.MangaDbContext())
                {
                    try
                    {
                        context.Database.Migrate();
                        context.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-10000; PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=10000;");
                        System.Diagnostics.Debug.WriteLine($"[App] Database migrated & WAL mode applied successfully.");
                    }
                    catch (System.Exception ex)
                    {
                        // 1. Handle "Duplicate Column" (Migration mismatch)
                        if (ex.Message.Contains("duplicate column name") && ex.Message.Contains("LastViewed"))
                        {
                            System.Diagnostics.Debug.WriteLine($"[App] 'LastViewed' column exists. Syncing migration history...");
                            try
                            {
                                string fixHistory = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20260123075531_AddLastViewedToManga', '9.0.0');";
                                context.Database.ExecuteSqlRaw(fixHistory);
                            }
                            catch { /* Ignore if already in history */ }
                        }
                        // 2. Handle "Table Already Exists" (InitialCreate mismatch)
                        else if (ex.Message.Contains("already exists"))
                        {
                            System.Diagnostics.Debug.WriteLine($"[App] Migration conflict logic...");
                            try
                            {
                                string insertSql = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20260121005426_InitialCreate', '9.0.0');";
                                context.Database.ExecuteSqlRaw(insertSql);
                                
                                // Retry migration
                                context.Database.Migrate();
                                System.Diagnostics.Debug.WriteLine($"[App] Database repaired.");
                            }
                            catch (System.Exception recoverEx) 
                            {
                                // If retry fails specifically due to LastViewed
                                if (recoverEx.Message.Contains("duplicate column name"))
                                {
                                     try
                                     {
                                         string fixHistory = "INSERT INTO __EFMigrationsHistory (MigrationId, ProductVersion) VALUES ('20260123075531_AddLastViewedToManga', '9.0.0');";
                                         context.Database.ExecuteSqlRaw(fixHistory);
                                         System.Diagnostics.Debug.WriteLine($"[App] Recovered from duplicate column error.");
                                     }
                                     catch {}
                                }
                                else
                                {
                                    System.Diagnostics.Debug.WriteLine($"[App] Failed to recover DB: {recoverEx.Message}");
                                }
                            }
                        }
                    }
                }

                desktop.MainWindow = new MainWindow
                {
                    DataContext = new MainWindowViewModel(sourceManager, libraryService, networkService, downloadService, settingsService, imageCacheService, secureImageService, sourceStatusService),
                };

                desktop.Exit += (s, e) =>
                {
                    try
                    {
                        downloadService.SaveQueueSynchronously();
                        System.Diagnostics.Debug.WriteLine("[App] Download queue saved successfully on shutdown.");
                    }
                    catch (System.Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[App] Failed to save queue on exit: {ex.Message}");
                    }
                };

                // Check for app updates asynchronously in background if enabled in Settings
                if (System.OperatingSystem.IsWindows() && settingsService.CheckAppUpdateOnStart)
                {
                    try
                    {
                        AutoUpdaterDotNET.AutoUpdater.ShowSkipButton = false;
                        AutoUpdaterDotNET.AutoUpdater.ShowRemindLaterButton = true;
                        AutoUpdaterDotNET.AutoUpdater.Start("https://raw.githubusercontent.com/ArisaAkiyama/yomic/main/update.xml");
                    }
                    catch (System.Exception ex)
                    {
                        Yomic.Core.Services.LogService.Warning("AutoUpdater", $"Failed to check for updates: {ex.Message}");
                    }
                }
            }

            base.OnFrameworkInitializationCompleted();
        }
    }
}
