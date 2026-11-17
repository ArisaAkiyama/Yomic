using System;
using System.IO;
using System.IO.Compression;
using System.Text;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Yomic.Core.Data;

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

        private static void FlushSqliteWalCheckpoint()
        {
            try
            {
                using var context = new MangaDbContext();
                using var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open)
                {
                    conn.Open();
                }
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "PRAGMA wal_checkpoint(TRUNCATE);";
                cmd.ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                LogService.Warning("BackupService", $"WAL checkpoint warning: {ex.Message}");
            }
        }

        private static string CreateSanitizedSettingsJson(string settingsFilePath)
        {
            var rawJson = File.ReadAllText(settingsFilePath);
            try
            {
                var node = JsonNode.Parse(rawJson) as JsonObject;
                if (node != null)
                {
                    // Strip OAuth tokens so backup archives are safe to share across machines/users
                    node["MalAccessToken"] = "";
                    node["MalRefreshToken"] = "";
                    node["MalTokenExpiresAt"] = 0;
                    return node.ToJsonString(new System.Text.Json.JsonSerializerOptions { WriteIndented = true });
                }
            }
            catch { }
            return rawJson;
        }

        public Task<bool> CreateBackupAsync(string destinationPath)
        {
            return Task.Run(() =>
            {
                string? tempDb = null;
                try
                {
                    // Flush SQLite WAL journal into manga.db before copying
                    FlushSqliteWalCheckpoint();

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

                        // Add sanitized settings.json (without sensitive OAuth tokens)
                        if (File.Exists(_settingsPath))
                        {
                            var sanitizedJson = CreateSanitizedSettingsJson(_settingsPath);
                            var settingsEntry = archive.CreateEntry("settings.json", CompressionLevel.Fastest);
                            using var entryStream = settingsEntry.Open();
                            var bytes = Encoding.UTF8.GetBytes(sanitizedJson);
                            entryStream.Write(bytes, 0, bytes.Length);
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
                            var walPath = _dbPath + "-wal";
                            var shmPath = _dbPath + "-shm";
                            if (File.Exists(walPath)) { try { File.Delete(walPath); } catch { } }
                            if (File.Exists(shmPath)) { try { File.Delete(shmPath); } catch { } }

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
