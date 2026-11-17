using Microsoft.EntityFrameworkCore;
using Yomic.Core.Models;
using System.Linq;
using System.Collections.Generic;
using System.Data.Common;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Yomic.Core.Data
{
    public class MangaDbContext : DbContext
    {
        public DbSet<Manga> Mangas { get; set; } = null!;
        public DbSet<Chapter> Chapters { get; set; } = null!;
        public DbSet<History> History { get; set; } = null!;
        public DbSet<Category> Categories { get; set; } = null!;
        public DbSet<MangaTrack> Tracks { get; set; } = null!;

        private static bool _hasLoggedPath = false;
        private static bool _columnsEnsured = false;

        public static void EnsureMangaColumnsExist(DbContext context)
        {
            if (_columnsEnsured) return;
            try
            {
                using var conn = context.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) conn.Open();
                using var cmd = conn.CreateCommand();
                cmd.CommandText = "PRAGMA table_info(Mangas);";
                using var reader = cmd.ExecuteReader();
                var cols = new HashSet<string>(System.StringComparer.OrdinalIgnoreCase);
                while (reader.Read())
                {
                    if (reader.FieldCount > 1) cols.Add(reader.GetString(1));
                }
                reader.Close();

                if (cols.Count > 0)
                {
                    if (!cols.Contains("ResponseETag"))
                    {
                        using var alter = conn.CreateCommand();
                        alter.CommandText = "ALTER TABLE Mangas ADD COLUMN ResponseETag TEXT;";
                        alter.ExecuteNonQuery();
                        System.Diagnostics.Debug.WriteLine("[DbContext] Added column ResponseETag to Mangas.");
                    }
                    if (!cols.Contains("ResponseLastModified"))
                    {
                        using var alter = conn.CreateCommand();
                        alter.CommandText = "ALTER TABLE Mangas ADD COLUMN ResponseLastModified TEXT;";
                        alter.ExecuteNonQuery();
                        System.Diagnostics.Debug.WriteLine("[DbContext] Added column ResponseLastModified to Mangas.");
                    }
                    _columnsEnsured = true;
                }
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[DbContext] EnsureMangaColumnsExist error: {ex.Message}");
            }
        }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            var folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData);
            var path = System.IO.Path.Combine(folder, "Yomic");
            if (!System.IO.Directory.Exists(path))
            {
                System.IO.Directory.CreateDirectory(path);
            }
            var dbPath = System.IO.Path.Combine(path, "manga.db");
            
            // Log path for debugging once
            if (!_hasLoggedPath)
            {
                System.Diagnostics.Debug.WriteLine($"[DbContext] Database Path: {dbPath}");
                _hasLoggedPath = true;
            }
            
            optionsBuilder.UseSqlite($"Data Source={dbPath};Cache=Shared;Default Timeout=10");
            optionsBuilder.AddInterceptors(new SqlitePragmaInterceptor());
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Manga -> Chapters (One-to-Many)
            modelBuilder.Entity<Chapter>()
                .HasOne(c => c.Manga)
                .WithMany(m => m.Chapters)
                .HasForeignKey(c => c.MangaId)
                .OnDelete(DeleteBehavior.Cascade);

            // History -> Chapter (One-to-One or Many-to-One? Usually history tracks a chapter read event)
            modelBuilder.Entity<History>()
                .HasOne(h => h.Chapter)
                .WithMany()
                .HasForeignKey(h => h.ChapterId);

            // Genre Conversion
            modelBuilder.Entity<Manga>()
                .Property(e => e.Genre)
                .HasConversion(
                    v => v == null ? string.Empty : string.Join(",", v),
                    v => string.IsNullOrEmpty(v) ? new System.Collections.Generic.List<string>() : v.Split(',', System.StringSplitOptions.RemoveEmptyEntries).ToList());

            // Category Mapping
            modelBuilder.Entity<Category>(entity =>
            {
                entity.HasKey(c => c.Id);
                entity.Property(c => c.Name).IsRequired();
            });

            // Many-to-Many: Manga <-> Category
            modelBuilder.Entity<Manga>()
                .HasMany(m => m.Categories)
                .WithMany(c => c.Mangas)
                .UsingEntity<Dictionary<string, object>>(
                    "MangaCategory",
                    r => r.HasOne<Category>().WithMany().HasForeignKey("CategoryId").OnDelete(DeleteBehavior.Cascade),
                    l => l.HasOne<Manga>().WithMany().HasForeignKey("MangaId").OnDelete(DeleteBehavior.Cascade),
                    je =>
                    {
                        je.HasKey("MangaId", "CategoryId");
                    });
                
            // MangaTrack -> Manga (One-to-Many)
            modelBuilder.Entity<MangaTrack>()
                .HasOne(t => t.Manga)
                .WithMany(m => m.Tracks)
                .HasForeignKey(t => t.MangaId)
                .OnDelete(DeleteBehavior.Cascade);
                
            base.OnModelCreating(modelBuilder);
        }
    }

    public class SqlitePragmaInterceptor : DbConnectionInterceptor
    {
        public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-10000; PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=10000;";
            command.ExecuteNonQuery();
        }

        public override async Task ConnectionOpenedAsync(DbConnection connection, ConnectionEndEventData eventData, CancellationToken cancellationToken = default)
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA cache_size=-10000; PRAGMA temp_store=MEMORY; PRAGMA busy_timeout=10000;";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }
}
