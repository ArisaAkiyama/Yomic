using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Yomic.Core.Data;

namespace Yomic.Core.Services
{
    /// <summary>
    /// Migrates old hardcoded Source IDs to new hash-based IDs.
    /// This is a one-time migration that runs on app startup.
    /// </summary>
    public static class SourceIdMigrationService
    {
        private const string MigrationCompletedKey = "SourceIdMigrationV1Completed";

        // Old hardcoded IDs -> New class names for hash generation
        private static readonly Dictionary<long, string> OldIdToClassName = new()
        {
            { 3, "Yomic.Extensions.Komiku.KomikuSource" },
            { 4, "Yomic.Extensions.KomikCast.KomikCastSource" },
            { 6, "Yomic.Extensions.Mangabats.MangabatsSource" },
            { 20, "Yomic.Extensions.Kiryuu.KiryuuSource" }
        };

        /// <summary>
        /// Runs the migration if it hasn't been completed yet.
        /// Should be called on app startup before loading extensions.
        /// </summary>
        public static void RunMigrationIfNeeded()
        {
            try
            {
                // Check if migration already completed
                var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                var appDir = System.IO.Path.Combine(appData, "Yomic");
                var migrationFlagFile = System.IO.Path.Combine(appDir, "source_id_migration_v1.done");

                if (System.IO.File.Exists(migrationFlagFile))
                {
                    return;
                }

                LogService.Info("Migration", "Starting Source ID migration...");

                // Build mapping from old IDs to new hash-based IDs
                var idMapping = new Dictionary<long, long>();
                foreach (var kvp in OldIdToClassName)
                {
                    var newId = GenerateHashId(kvp.Value);
                    idMapping[kvp.Key] = newId;
                    LogService.Debug("Migration", $"{kvp.Value}: {kvp.Key} -> {newId}");
                }

                // Update database
                using (var db = new MangaDbContext())
                {
                    db.Database.Migrate();
                    int updatedCount = 0;
                    var mangas = db.Mangas.ToList();
                    
                    foreach (var manga in mangas)
                    {
                        if (idMapping.TryGetValue(manga.Source, out var newId))
                        {
                            manga.Source = newId;
                            updatedCount++;
                        }
                    }

                    if (updatedCount > 0)
                    {
                        db.SaveChanges();
                        LogService.Success("Migration", $"Updated {updatedCount} manga records.");
                    }
                    else
                    {
                        LogService.Info("Migration", "No manga records needed migration.");
                    }
                }

                // Mark migration as complete
                if (!System.IO.Directory.Exists(appDir))
                    System.IO.Directory.CreateDirectory(appDir);
                System.IO.File.WriteAllText(migrationFlagFile, DateTime.UtcNow.ToString("o"));
                
                LogService.Success("Migration", "Source ID migration completed successfully.");
            }
            catch (Exception ex)
            {
                LogService.Error("Migration", "Migration failed", ex);
                // Don't throw - allow app to continue even if migration fails
            }
        }

        /// <summary>
        /// Generates a stable ID from a class name using MD5 hash.
        /// This must match the logic in HttpSource.GenerateStableId()
        /// </summary>
        private static long GenerateHashId(string className)
        {
            var hash = MD5.HashData(Encoding.UTF8.GetBytes(className));
            return BitConverter.ToInt64(hash, 0);
        }
    }
}
