using System;
using System.Collections.Concurrent;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Yomic.Core.Services
{
    /// <summary>
    /// Non-blocking, thread-safe asynchronous logging service writing to %LOCALAPPDATA%\Yomic\yomic.log.
    /// Automatically rotates log files when exceeding 2 MB.
    /// </summary>
    public static class LogService
    {
        public static string LogFilePath { get; } = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Yomic", "yomic.log");

        private static readonly BlockingCollection<string> _logQueue = new(new ConcurrentQueue<string>(), 4096);
        private static readonly object _fileLock = new();
        private const long MaxFileSizeBytes = 2 * 1024 * 1024; // 2 MB

        static LogService()
        {
            EnsureDirectory();
            Task.Factory.StartNew(ProcessLogQueue, TaskCreationOptions.LongRunning);
        }

        private static void EnsureDirectory()
        {
            try
            {
                var dir = Path.GetDirectoryName(LogFilePath);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                {
                    Directory.CreateDirectory(dir);
                }
            }
            catch { }
        }

        private static void ProcessLogQueue()
        {
            foreach (var line in _logQueue.GetConsumingEnumerable())
            {
                try
                {
                    lock (_fileLock)
                    {
                        EnsureDirectory();
                        if (File.Exists(LogFilePath))
                        {
                            var info = new FileInfo(LogFilePath);
                            if (info.Length >= MaxFileSizeBytes)
                            {
                                var backupPath = LogFilePath + ".1";
                                if (File.Exists(backupPath)) File.Delete(backupPath);
                                File.Move(LogFilePath, backupPath);
                            }
                        }
                        File.AppendAllText(LogFilePath, line + Environment.NewLine, Encoding.UTF8);
                    }
                }
                catch { }
            }
        }

        private static void Enqueue(string level, string tag, string message, Exception? ex = null)
        {
            var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
            var formatted = ex != null
                ? $"[{timestamp}] [{level}] [{tag}] {message}{Environment.NewLine}{ex}"
                : $"[{timestamp}] [{level}] [{tag}] {message}";

            System.Diagnostics.Debug.WriteLine(formatted);
            _logQueue.TryAdd(formatted);
        }

        public static bool ClearLogs()
        {
            try
            {
                lock (_fileLock)
                {
                    var dir = Path.GetDirectoryName(LogFilePath);
                    if (dir != null && Directory.Exists(dir))
                    {
                        foreach (var file in Directory.GetFiles(dir, "yomic*.log*"))
                        {
                            try { File.Delete(file); } catch { }
                        }
                    }
                }
                Info("LogService", "Logs reset / cleared successfully.");
                return true;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Failed to clear log: {ex.Message}");
                return false;
            }
        }

        public static void Debug(string tag, string message) => Enqueue("DBG", tag, message);
        public static void Info(string tag, string message) => Enqueue("INF", tag, message);
        public static void Warning(string tag, string message) => Enqueue("WRN", tag, message);
        public static void Error(string tag, string message) => Enqueue("ERR", tag, message);
        public static void Error(string tag, string message, Exception ex) => Enqueue("ERR", tag, message, ex);
        public static void Success(string tag, string message) => Enqueue("INF", tag, $"[OK] {message}");

        public static void CloseAndFlush()
        {
            // Flush remaining items up to 500ms
            var sw = System.Diagnostics.Stopwatch.StartNew();
            while (_logQueue.Count > 0 && sw.ElapsedMilliseconds < 500)
            {
                Thread.Sleep(15);
            }
        }
    }
}
