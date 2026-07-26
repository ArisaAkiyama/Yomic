using System;
using System.IO;
using Serilog;

namespace Yomic.Core.Services
{
    /// <summary>
    /// Non-blocking, ultra-fast asynchronous logging service backed by Serilog + Serilog.Sinks.Async.
    /// File and console output are handled strictly on background threads to prevent UI stutter.
    /// </summary>
    public static class LogService
    {
        public static string LogFilePath { get; } = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Yomic", "yomic.log");

        static LogService()
        {
            // Ensure log directory exists
            var dir = Path.GetDirectoryName(LogFilePath);
            if (dir != null && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            // Configure Serilog with Async Sinks for non-blocking file & console I/O
            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Async(a => a.Console(outputTemplate: "[{Timestamp:HH:mm:ss.fff}] [{Level:u3}] [{Tag}] {Message:lj}{NewLine}{Exception}"))
                .WriteTo.Async(a => a.File(
                    LogFilePath,
                    outputTemplate: "[{Timestamp:HH:mm:ss.fff}] [{Level:u3}] [{Tag}] {Message:lj}{NewLine}{Exception}",
                    fileSizeLimitBytes: 2 * 1024 * 1024,
                    rollOnFileSizeLimit: true,
                    retainedFileCountLimit: 3))
                .CreateLogger();
        }

        public static void Debug(string tag, string message)
        {
            Log.ForContext("Tag", tag).Debug("{Message}", message);
        }
        
        public static void Info(string tag, string message)
        {
            Log.ForContext("Tag", tag).Information("{Message}", message);
        }
        
        public static void Warning(string tag, string message)
        {
            Log.ForContext("Tag", tag).Warning("{Message}", message);
        }
        
        public static void Error(string tag, string message)
        {
            Log.ForContext("Tag", tag).Error("{Message}", message);
        }
        
        public static void Error(string tag, string message, Exception ex)
        {
            Log.ForContext("Tag", tag).Error(ex, "{Message}", message);
        }
        
        public static void Success(string tag, string message)
        {
            Log.ForContext("Tag", tag).Information("[OK] {Message}", message);
        }

        public static void CloseAndFlush()
        {
            Log.CloseAndFlush();
        }
    }
}
