using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Yomic.Migrations
{
    /// <inheritdoc />
    public partial class AddMangaTracks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MangaTrackers");

            migrationBuilder.CreateTable(
                name: "Tracks",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MangaId = table.Column<long>(type: "INTEGER", nullable: false),
                    TrackerName = table.Column<string>(type: "TEXT", nullable: false),
                    RemoteId = table.Column<long>(type: "INTEGER", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    LastChapterRead = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalChapters = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tracks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Tracks_Mangas_MangaId",
                        column: x => x.MangaId,
                        principalTable: "Mangas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_MangaId",
                table: "Tracks",
                column: "MangaId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Tracks");

            migrationBuilder.CreateTable(
                name: "MangaTrackers",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MangaId = table.Column<long>(type: "INTEGER", nullable: false),
                    LastChapterRead = table.Column<int>(type: "INTEGER", nullable: false),
                    RemoteId = table.Column<string>(type: "TEXT", nullable: false),
                    Score = table.Column<int>(type: "INTEGER", nullable: false),
                    SyncStatus = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    TotalChapters = table.Column<int>(type: "INTEGER", nullable: false),
                    TrackerType = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MangaTrackers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MangaTrackers_Mangas_MangaId",
                        column: x => x.MangaId,
                        principalTable: "Mangas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MangaTrackers_MangaId",
                table: "MangaTrackers",
                column: "MangaId");
        }
    }
}
