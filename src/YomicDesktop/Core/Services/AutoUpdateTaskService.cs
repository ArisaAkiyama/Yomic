using System;
using System.Diagnostics;

namespace Yomic.Core.Services
{
    public static class AutoUpdateTaskService
    {
        private const string TaskName = "Yomic_Background_AutoUpdate";

        public static void RegisterOrUpdateTask(int intervalHours)
        {
            try
            {
                // Unregister existing task first to ensure clean state
                UnregisterTask();

                if (intervalHours <= 0)
                {
                    // Disabled, so we just stop here
                    LogService.Info("AutoUpdateTask", "Background task disabled/removed.");
                    return;
                }

                string exePath = Process.GetCurrentProcess().MainModule?.FileName ?? "";
                if (string.IsNullOrEmpty(exePath) || !exePath.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
                {
                    LogService.Warning("AutoUpdateTask", "Cannot register task: Executable path is invalid or not an .exe.");
                    return;
                }

                // Register new task using schtasks
                // /sc HOURLY /mo <interval>
                string command = $"/create /tn \"{TaskName}\" /tr \"\\\"{exePath}\\\" --background-update\" /sc HOURLY /mo {intervalHours} /f";

                var processInfo = new ProcessStartInfo
                {
                    FileName = "schtasks.exe",
                    Arguments = command,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                using var process = Process.Start(processInfo);
                process?.WaitForExit();

                if (process?.ExitCode == 0)
                {
                    LogService.Info("AutoUpdateTask", $"Successfully registered task for every {intervalHours} hours.");
                }
                else
                {
                    string error = process?.StandardError.ReadToEnd() ?? "Unknown error";
                    LogService.Warning("AutoUpdateTask", $"Failed to register task: {error}");
                }
            }
            catch (Exception ex)
            {
                LogService.Error("AutoUpdateTask", $"Error managing task: {ex.Message}", ex);
            }
        }

        private static void UnregisterTask()
        {
            try
            {
                var processInfo = new ProcessStartInfo
                {
                    FileName = "schtasks.exe",
                    Arguments = $"/delete /tn \"{TaskName}\" /f",
                    CreateNoWindow = true,
                    UseShellExecute = false
                };

                using var process = Process.Start(processInfo);
                process?.WaitForExit();
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AutoUpdateTask] Error removing task: {ex.Message}");
            }
        }
    }
}
