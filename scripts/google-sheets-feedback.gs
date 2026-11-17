/**
 * ============================================================================
 * YOMIC V2 - GOOGLE SPREADSHEET FEEDBACK RECEIVER (Tanpa DriveApp - Bebas Blokir OAuth)
 * ============================================================================
 * Akun Google Drive Tujuan : info.yomic@gmail.com
 * Nama File Spreadsheet    : Yomic - Masukan Pengguna
 *
 * CARA PALING MUDAH & BEBAS ERROR "Access is denied":
 * 1. Buka Google Drive / Google Sheets akun info.yomic@gmail.com
 *    lalu buat Spreadsheet baru bernama: "Yomic - Masukan Pengguna"
 * 2. Di dalam Spreadsheet tersebut, klik menu atas:
 *    Ekstensi (Extensions) -> Apps Script
 * 3. Hapus kode bawaan di Kode.gs, lalu tempel (paste) seluruh kode ini & tekan Ctrl + S.
 * 4. Klik tombol biru "Terapkan" (Deploy) -> "Deployment baru" (New deployment):
 *    - Pilih jenis : Aplikasi web (Web app)
 *    - Jalankan sebagai : Saya (info.yomic@gmail.com)
 *    - Siapa yang memiliki akses : Siapa saja (Anyone)
 * 5. Saat muncul jendela izin Google:
 *    - Pilih akun info.yomic@gmail.com
 *    - Klik tulisan kecil "Lanjutan" (Advanced) di kiri bawah
 *    - Klik "Buka Project ... (tidak aman)" (Go to ... unsafe)
 *    - Klik "Lanjutkan" / "Izinkan" (Allow)
 * ============================================================================
 */

const TARGET_OWNER_EMAIL = 'info.yomic@gmail.com';
const SPREADSHEET_NAME = 'Yomic - Masukan Pengguna';
const SHEET_NAME = 'Masukan';
const SCREENSHOT_FOLDER_NAME = 'Yomic - Screenshot Masukan';

// Opsional: Jika dibuka dari script.google.com biasa (bukan dari menu Ekstensi Spreadsheet),
// Anda juga bisa menempelkan ID Spreadsheet dari URL Google Sheets Anda di sini:
const CUSTOM_SPREADSHEET_ID = '';

/**
 * Menangani pengiriman masukan (HTTP POST) dari aplikasi desktop Yomic v2.
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const data = JSON.parse(rawBody);

    const message = String(data.message || '').trim();
    if (!message) {
      return createJsonResponse_({
        ok: false,
        error: 'Deskripsi masukan tidak boleh kosong.'
      });
    }

    const categoryCode = String(data.category || 'bug').trim();
    const categoryLabel = String(data.categoryLabel || mapCategoryLabel_(categoryCode)).trim();
    const appVersion = String(data.appVersion || '2.0.0').trim();
    const osVersion = String(data.osVersion || 'Windows').trim();
    const language = String(data.language || 'id').trim();
    const screenshotBase64 = String(data.screenshotBase64 || '').trim();
    const screenshotName = String(data.screenshotName || 'screenshot.png').trim();
    const screenshotMimeType = String(data.screenshotMimeType || 'image/png').trim();

    let screenshotCellValue = '-';
    if (screenshotBase64) {
      screenshotCellValue = saveScreenshotToDrive_(screenshotBase64, screenshotName, screenshotMimeType);
    }

    const sheetInfo = getOrCreateFeedbackSheet_();
    const sheet = sheetInfo.sheet;

    const timestamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');

    sheet.appendRow([
      timestamp,
      categoryLabel,
      categoryCode,
      message,
      appVersion,
      osVersion,
      language,
      screenshotCellValue
    ]);

    return createJsonResponse_({
      ok: true,
      owner: TARGET_OWNER_EMAIL,
      spreadsheetId: sheetInfo.spreadsheetId,
      spreadsheetUrl: sheetInfo.spreadsheetUrl,
      timestamp: timestamp
    });
  } catch (err) {
    return createJsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menangani pengecekan status endpoint (HTTP GET) melalui browser.
 */
function doGet() {
  try {
    const sheetInfo = getOrCreateFeedbackSheet_();
    return createJsonResponse_({
      ok: true,
      service: 'Yomic v2 Feedback Google Spreadsheet Service',
      owner: TARGET_OWNER_EMAIL,
      spreadsheetName: SPREADSHEET_NAME,
      spreadsheetUrl: sheetInfo.spreadsheetUrl
    });
  } catch (err) {
    return createJsonResponse_({
      ok: false,
      error: String(err && err.message ? err.message : err)
    });
  }
}

/**
 * Fungsi inisialisasi manual untuk membuat tabel header biru di Spreadsheet.
 */
function setupSpreadsheet() {
  const info = getOrCreateFeedbackSheet_();
  Logger.log('Spreadsheet berhasil disiapkan untuk: ' + TARGET_OWNER_EMAIL);
  Logger.log('URL Spreadsheet: ' + info.spreadsheetUrl);
}

/**
 * Membuka Spreadsheet aktif (atau membuat baru di Google Drive info.yomic@gmail.com)
 * TANPA menggunakan DriveApp agar tidak memicu blokir izin OAuth Google Drive penuh.
 */
function getOrCreateFeedbackSheet_() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheet = null;

  // 1. Jika script dibuka langsung dari dalam Google Spreadsheet (Ekstensi -> Apps Script)
  try {
    spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  } catch (_) {
    spreadsheet = null;
  }

  // 2. Cek jika CUSTOM_SPREADSHEET_ID diisi manual
  if (!spreadsheet && CUSTOM_SPREADSHEET_ID) {
    try {
      spreadsheet = SpreadsheetApp.openById(CUSTOM_SPREADSHEET_ID);
    } catch (_) {
      spreadsheet = null;
    }
  }

  // 3. Cek dari ScriptProperties yang tersimpan sebelumnya
  if (!spreadsheet) {
    const savedId = props.getProperty('YOMIC_FEEDBACK_SPREADSHEET_ID');
    if (savedId) {
      try {
        spreadsheet = SpreadsheetApp.openById(savedId);
      } catch (_) {
        spreadsheet = null;
      }
    }
  }

  // 4. Buat Spreadsheet baru di Google Drive info.yomic@gmail.com menggunakan SpreadsheetApp saja
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    props.setProperty('YOMIC_FEEDBACK_SPREADSHEET_ID', spreadsheet.getId());
  }

  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    if (sheet) {
      sheet.setName(SHEET_NAME);
    } else {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }
  }

  if (sheet.getLastRow() === 0) {
    const headers = [
      'Waktu (WIB)',
      'Jenis Masukan',
      'Kode Kategori',
      'Deskripsi Masukan',
      'Versi Aplikasi',
      'Sistem Operasi',
      'Bahasa UI',
      'Tangkapan Layar'
    ];
    sheet.appendRow(headers);

    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#0066CC');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);

    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 200);
    sheet.setColumnWidth(3, 120);
    sheet.setColumnWidth(4, 480);
    sheet.setColumnWidth(5, 110);
    sheet.setColumnWidth(6, 220);
    sheet.setColumnWidth(7, 90);
    sheet.setColumnWidth(8, 320);
  } else if (sheet.getLastColumn() < 8) {
    const col8Header = sheet.getRange(1, 8);
    col8Header.setValue('Tangkapan Layar');
    col8Header.setBackground('#0066CC');
    col8Header.setFontColor('#FFFFFF');
    col8Header.setFontWeight('bold');
    sheet.setColumnWidth(8, 320);
  }

  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    sheet: sheet
  };
}

function saveScreenshotToDrive_(dataUrlOrBase64, fileName, mimeType) {
  try {
    let base64Data = dataUrlOrBase64;
    let detectedMime = mimeType || 'image/png';
    const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrlOrBase64);
    if (match) {
      detectedMime = match[1];
      base64Data = match[2];
    }

    const bytes = Utilities.base64Decode(base64Data);
    const safeName = (fileName || 'screenshot.png').replace(/[^\w.\-]+/g, '_');
    const stampedName = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd_HHmmss') + '_' + safeName;
    const blob = Utilities.newBlob(bytes, detectedMime, stampedName);

    const folders = DriveApp.getFoldersByName(SCREENSHOT_FOLDER_NAME);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(SCREENSHOT_FOLDER_NAME);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    return 'Gagal simpan gambar: ' + String(err && err.message ? err.message : err);
  }
}

function mapCategoryLabel_(code) {
  switch (String(code || '').toLowerCase()) {
    case 'bug':
    case 'bugreport':
      return 'Laporan Bug';
    case 'feature':
    case 'featurerequest':
      return 'Permintaan Fitur';
    case 'extension':
      return 'Kendala Ekstensi & Sumber';
    case 'performance':
      return 'Performa & Jaringan';
    case 'general':
      return 'Saran Umum';
    default:
      return code || 'Saran Umum';
  }
}

function createJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
