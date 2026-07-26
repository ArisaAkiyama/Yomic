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

        private static bool _hasLoggedPath = false;

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
