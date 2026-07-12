using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;

namespace Yomic.Core.Services
{
    public class BackupService
    {
        private readonly string _appDataFolder;
        private readonly string _dbPath;
        private readonly string _settingsPath;
        private readonly string _coversFolder;

        public BackupService()
        {
            var folder = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _appDataFolder = Path.Combine(folder, "Yomic");
            _dbPath = Path.Combine(_appDataFolder, "manga.db");
            _settingsPath = Path.Combine(_appDataFolder, "settings.json");
            _coversFolder = Path.Combine(_appDataFolder, "covers");
        }

        public Task<bool> CreateBackupAsync(string destinationPath)
        {
            return Task.Run(() =>
            {
                string? tempDb = null;
                try
                {
                    // Create a temporary zip file
                    string tempZipPath = Path.Combine(Path.GetTempPath(), $"YomicBackup_{Guid.NewGuid()}.zip");

                    if (File.Exists(tempZipPath))
                        File.Delete(tempZipPath);

                    using (var archive = ZipFile.Open(tempZipPath, ZipArchiveMode.Create))
                    {
                        // Add manga.db
                        if (File.Exists(_dbPath))
                        {
                            // Create a temporary copy of the DB to avoid lock issues
                            tempDb = Path.Combine(Path.GetTempPath(), $"manga_{Guid.NewGuid()}.db");
                            File.Copy(_dbPath, tempDb, true);
                            archive.CreateEntryFromFile(tempDb, "manga.db", CompressionLevel.Fastest);
                        }

                        // Add settings.json
                        if (File.Exists(_settingsPath))
                        {
                            archive.CreateEntryFromFile(_settingsPath, "settings.json", CompressionLevel.Fastest);
                        }

                    }

                    // Delete the temp DB copy now that the archive is closed and unlocked
                    if (tempDb != null && File.Exists(tempDb))
                    {
                        try { File.Delete(tempDb); } catch { /* ignore cleanup errors */ }
                    }

                    // Move the temp zip to the final destination
                    if (File.Exists(destinationPath))
                        File.Delete(destinationPath);
                    
                    File.Move(tempZipPath, destinationPath);
                    return true;
                }
                catch (Exception ex)
                {
                    LogService.Error("BackupService", "Error creating backup", ex);
                    // Ensure cleanup of temp DB copy in case of exception
                    if (tempDb != null && File.Exists(tempDb))
                    {
                        try { File.Delete(tempDb); } catch { }
                    }
                    return false;
                }
            });
        }

        public Task<bool> RestoreBackupAsync(string sourceZipPath)
        {
            return Task.Run(() =>
            {
                try
                {
                    if (!File.Exists(sourceZipPath))
                        return false;

                    // Extract only necessary files directly
                    bool restoredDb = false;
                    bool restoredSettings = false;

                    using (var archive = ZipFile.OpenRead(sourceZipPath))
                    {
                        var dbEntry = archive.GetEntry("manga.db");
                        if (dbEntry != null)
                        {
                            if (File.Exists(_dbPath))
                            {
                                // Clear connection pools to release any file locks held by EF Core / SQLite
                                Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
                                File.Delete(_dbPath);
                            }
                            dbEntry.ExtractToFile(_dbPath, true);
                            restoredDb = true;
                        }

                        var settingsEntry = archive.GetEntry("settings.json");
                        if (settingsEntry != null)
                        {
                            if (File.Exists(_settingsPath))
                                File.Delete(_settingsPath);
                            
                            settingsEntry.ExtractToFile(_settingsPath, true);
                            restoredSettings = true;
                        }
                    }

                    return restoredDb || restoredSettings;
                }
                catch (Exception ex)
                {
                    LogService.Error("BackupService", "Error restoring backup", ex);
                    return false;
                }
            });
        }
    }
}
