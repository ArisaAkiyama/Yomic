using System;
using System.IO;

namespace Yomic.Core.Services
{
    /// <summary>
    /// Centralized logging service with colored console output and file output.
    /// Yellow = Warning, Red = Error, Cyan = Info, White = Debug
    /// </summary>
    public static class LogService
    {
        private static readonly object _lock = new();

        public static string LogFilePath { get; } = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Yomic", "yomic.log");

        static LogService()
        {
            // Ensure log directory exists
            var dir = Path.GetDirectoryName(LogFilePath);
            if (dir != null && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            // Rotate log: keep only the last 2 MB
            try
            {
                if (File.Exists(LogFilePath) && new FileInfo(LogFilePath).Length > 2 * 1024 * 1024)
                    File.WriteAllText(LogFilePath, string.Empty);
            }
            catch { /* ignore rotation errors */ }
        }

        public static void Debug(string tag, string message)
        {
            WriteLog(ConsoleColor.Gray, "DEBUG", tag, message);
        }
        
        public static void Info(string tag, string message)
        {
            WriteLog(ConsoleColor.Cyan, "INFO", tag, message);
        }
        
        public static void Warning(string tag, string message)
        {
            WriteLog(ConsoleColor.Yellow, "WARN", tag, message);
        }
        
        public static void Error(string tag, string message)
        {
            WriteLog(ConsoleColor.Red, "ERROR", tag, message);
        }
        
        public static void Error(string tag, string message, Exception ex)
        {
            WriteLog(ConsoleColor.Red, "ERROR", tag, $"{message}: {ex.Message}");
            if (ex.StackTrace != null)
            {
                WriteLog(ConsoleColor.DarkRed, "TRACE", tag, ex.StackTrace);
            }
        }
        
        public static void Success(string tag, string message)
        {
            WriteLog(ConsoleColor.Green, "OK", tag, message);
        }
        
        private static void WriteLog(ConsoleColor color, string level, string tag, string message)
        {
            lock (_lock)
            {
                var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
                var logLine   = $"[{timestamp}] [{level}] [{tag}] {message}";

                // ── Console output ────────────────────────────────────────────
                var originalColor = Console.ForegroundColor;
                Console.ForegroundColor = ConsoleColor.DarkGray;
                Console.Write($"[{timestamp}] ");
                Console.ForegroundColor = color;
                Console.Write($"[{level}] ");
                Console.ForegroundColor = ConsoleColor.White;
                Console.Write($"[{tag}] ");
                Console.ForegroundColor = color;
                Console.WriteLine(message);
                Console.ForegroundColor = originalColor;

                // ── IDE Debug output ──────────────────────────────────────────
                System.Diagnostics.Debug.WriteLine(logLine);

                // ── File output ───────────────────────────────────────────────
                try
                {
                    File.AppendAllText(LogFilePath, logLine + Environment.NewLine);
                }
                catch { /* ignore file write errors */ }
            }
        }
    }
}
