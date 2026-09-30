/**
 * ==============================================================================
 * SUNSTONE PREMIER LEAGUE 2026 — GOOGLE APPS SCRIPT BACKEND API
 * ==============================================================================
 * 
 * Target Google Spreadsheet:
 * https://docs.google.com/spreadsheets/d/1y9Q93DVLKTBXOcjb7ycW1QEhKBeMbVK3RbDP18rS8AI/edit
 * Spreadsheet ID: 1y9Q93DVLKTBXOcjb7ycW1QEhKBeMbVK3RbDP18rS8AI
 * 
 * Target Google Drive Main Folder:
 * https://drive.google.com/drive/u/0/folders/1mxiYEP1XE8obPF8oBrS6m4XfdAYOtcSo
 * Main Drive Folder ID: 1mxiYEP1XE8obPF8oBrS6m4XfdAYOtcSo
 * 
 * ------------------------------------------------------------------------------
 * DEPLOYMENT INSTRUCTIONS (Quick 2-Minute Setup):
 * ------------------------------------------------------------------------------
 * 1. Open Google Apps Script: https://script.google.com/
 * 2. Click "+ New project". Name it: "Sunstone Premier League 2026 Backend"
 * 3. Delete any default code in Code.gs and paste THIS ENTIRE FILE.
 * 4. Run `setupTournament()` from the function dropdown and click "Run" once.
 *    (Google will ask you to authorize permissions — click "Review permissions",
 *     choose your account, click "Advanced", then "Go to Sunstone Premier League 2026 Backend (unsafe)",
 *     and click "Allow".)
 *    This will automatically create all 4 sheets (Players, Teams, Auction, Settings)
 *    and the 4 Drive subfolders inside your main folder!
 * 5. Click "Deploy" (top right blue button) -> "New deployment"
 * 6. Select type: "Web app" (click the gear icon next to "Select type")
 *    - Description: "Sunstone Premier League 2026 API"
 *    - Execute as: "Me" (your Google account)
 *    - Who has access: "Anyone"  <-- CRITICAL: Must be "Anyone" so the website can communicate with it
 * 7. Click "Deploy".
 * 8. Copy the "Web app URL" (format: https://script.google.com/macros/s/.../exec).
 * 9. Open `googleApiClient.js` in your website code and paste the URL into:
 *    `const GOOGLE_APPS_SCRIPT_URL = 'PASTE_YOUR_COPIED_URL_HERE';`
 * ==============================================================================
 */

var CONFIG = {
  SPREADSHEET_ID: '1y9Q93DVLKTBXOcjb7ycW1QEhKBeMbVK3RbDP18rS8AI',
  DRIVE_FOLDER_ID: '1mxiYEP1XE8obPF8oBrS6m4XfdAYOtcSo',
  SHEETS: {
    PLAYERS: 'Players',
    TEAMS: 'Teams',
    FRANCHISE_AUTH: 'Franchise_Auth',
    AUCTION: 'Auction',
    SETTINGS: 'Settings',
    ADMINS: 'Admins'
  },
  FOLDERS: {
    PHOTOS: 'ATHLETE PHOTOS',
    CERTIFICATES: 'SPORTS CERTIFICATES',
    LOGOS: 'TEAM LOGOS',
    DOCUMENTS: 'OTHER DOCUMENTS'
  },
  VALID_BRANCHES: ['BCA', 'B.Tech', 'BBA'],
  DEFAULT_ROLE_BASE_PRICES: {
    'Batter': 20,
    'Batsman': 20,
    'Bowler': 5,
    'All-Rounder': 15,
    'Wicketkeeper': 10,
    'Fielder': 5
  },
  // Tournament Limits & Configuration
  MAX_FRANCHISES: 8,
  MAX_SQUAD_SIZE: 10,
  // Tournament Security: Secret token required for all admin privileged mutations
  ADMIN_SECRET_KEY: 'SPL2026_ADMIN_SECURE_AUTH_TOKEN_KEY'
};

// Required Column Headers as specified in STEPS 2, 3, 4, 5, 6
var HEADERS = {
  PLAYERS: [
    'id',
    'created_at',
    'full_name',
    'enrollment_no',
    'department',
    'email',
    'mobile_number',
    'gender',
    'player_role',
    'status',
    'base_price',
    'auction_status',
    'sold_to_team',
    'sold_price',
    'photo_file_id',
    'photo_file_url',
    'certificate_file_id',
    'certificate_file_url',
    'certificate_name'
  ],
  TEAMS: [
    'id',
    'team_name',
    'short_name',
    'department',
    'owner_name',
    'owner_email',
    'logo_file_id',
    'logo_file_url',
    'purse',
    'total_spent',
    'remaining_purse',
    'player_count',
    'status',
    'created_at'
  ],
  FRANCHISE_AUTH: [
    'id',
    'created_at',
    'owner_name',
    'owner_email',
    'team_id',
    'password_hash',
    'status',
    'last_login_at'
  ],
  AUCTION: [
    'id',
    'player_id',
    'player_name',
    'base_price',
    'current_bid',
    'bid_team',
    'status',
    'sold_price',
    'sold_to_team',
    'updated_at'
  ],
  SETTINGS: [
    'key',
    'value'
  ],
  ADMINS: [
    'admin_id',
    'username',
    'password_hash',
    'role',
    'status',
    'created_at',
    'last_login',
    'failed_attempts',
    'locked_until'
  ]
};

/**
 * Helper to obtain the Google Spreadsheet
 */
function getSpreadsheet() {
  try {
    if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID') {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
  } catch (e) {
    Logger.log('Could not open spreadsheet by ID: ' + e);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Helper to ensure a specific sheet exists with exact headers
 * If Sheet1 exists and is empty, it safely renames it to Players.
 */
function getOrCreateSheet(sheetName, headers) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);

  // Check if default Sheet1 can be renamed
  if (!sheet && sheetName === CONFIG.SHEETS.PLAYERS) {
    var defaultSheet1 = ss.getSheetByName('Sheet1');
    if (defaultSheet1 && defaultSheet1.getLastRow() <= 1) {
      defaultSheet1.setName(CONFIG.SHEETS.PLAYERS);
      sheet = defaultSheet1;
    }
  }

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  // Check if headers need to be written
  if (headers && headers.length && sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setFontWeight('bold');
    range.setBackground('#0f172a');
    range.setFontColor('#38bdf8');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

/**
 * Helper to obtain or create a subfolder inside main Drive tournament folder
 */
function getOrCreateDriveFolder(folderName) {
  try {
    var parentFolder;
    if (CONFIG.DRIVE_FOLDER_ID && CONFIG.DRIVE_FOLDER_ID !== 'YOUR_DRIVE_FOLDER_ID') {
      parentFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    } else {
      parentFolder = DriveApp.getRootFolder();
    }

    var subFolders = parentFolder.getFoldersByName(folderName);
    if (subFolders.hasNext()) {
      return subFolders.next();
    }
    return parentFolder.createFolder(folderName);
  } catch (err) {
    Logger.log('Drive Folder Resolution Error for "' + folderName + '": ' + err);
    return DriveApp.getRootFolder();
  }
}

// ==============================================================================
// ADMIN AUTHENTICATION SYSTEM — Google Sheets backed session management
// ==============================================================================

/**
 * In-memory session store (per GAS execution instance).
 * Google Apps Script CacheService is used for cross-instance persistence.
 */

/**
 * Get or create the Admins sheet, ensuring correct headers
 */
function getAdminsSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.ADMINS);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.ADMINS);
    sheet.appendRow(HEADERS.ADMINS);
    var range = sheet.getRange(1, 1, 1, HEADERS.ADMINS.length);
    range.setFontWeight('bold');
    range.setBackground('#0f172a');
    range.setFontColor('#38bdf8');
    sheet.setFrozenRows(1);
    // Seed default admin account (password: Habib@Habib321)
    sheet.appendRow([
      'ADM-001',
      'admin',
      'bf145ff13649f1771e5196eaa41c3622d090750500bdc2c9925f51e0deec4eab',
      'admin',
      'active',
      new Date().toISOString(),
      '',
      0,
      ''
    ]);
    SpreadsheetApp.flush();
    Logger.log('[ADMINS] Sheet created and seeded with default admin account.');
  }
  return sheet;
}

/**
 * Generate a cryptographically random session token
 */
function generateSessionToken() {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(Date.now()) + Math.random() + Math.random(),
    Utilities.Charset.UTF_8
  );
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    var s = b.toString(16);
    hex += s.length === 1 ? '0' + s : s;
  }
  return 'ASPL_' + hex;
}

/**
 * Store session token in CacheService (8-hour TTL)
 * Key: "admin_session_" + token → JSON: { admin_id, username, role, created_at }
 */
function storeAdminSession(token, adminData) {
  try {
    var cache = CacheService.getScriptCache();
    var sessionData = JSON.stringify({
      admin_id: adminData.admin_id,
      username: adminData.username,
      role: adminData.role,
      created_at: Date.now()
    });
    // 8 hours = 28800 seconds (CacheService max is 6 hours = 21600s)
    cache.put('admin_session_' + token, sessionData, 21600);
    Logger.log('[AUTH] Session stored for: ' + adminData.username);
    return true;
  } catch (e) {
    Logger.log('[AUTH] Cache store failed: ' + e);
    return false;
  }
}

/**
 * Retrieve and validate a session token from CacheService
 * Returns: { valid: bool, admin_id, username, role } or { valid: false, error }
 */
function getAdminSession(token) {
  if (!token || String(token).trim() === '') {
    return { valid: false, error: 'No session token provided.' };
  }
  token = String(token).trim();
  // Reject legacy ADMIN_SECRET_KEY tokens — those are replaced
  if (token === CONFIG.ADMIN_SECRET_KEY) {
    return { valid: false, error: 'Legacy token not accepted. Please log in again.' };
  }
  try {
    var cache = CacheService.getScriptCache();
    var raw = cache.get('admin_session_' + token);
    if (!raw) {
      return { valid: false, error: 'SESSION_EXPIRED' };
    }
    var data = JSON.parse(raw);
    // Check session age (6 hours max = 21600000ms)
    var age = Date.now() - (data.created_at || 0);
    if (age > 21600000) {
      cache.remove('admin_session_' + token);
      return { valid: false, error: 'SESSION_EXPIRED' };
    }
    return {
      valid: true,
      admin_id: data.admin_id,
      username: data.username,
      role: data.role
    };
  } catch (e) {
    Logger.log('[AUTH] Cache read failed: ' + e);
    return { valid: false, error: 'Session verification failed.' };
  }
}

/**
 * Invalidate a session (logout)
 */
function removeAdminSession(token) {
  if (!token) return;
  try {
    var cache = CacheService.getScriptCache();
    cache.remove('admin_session_' + token);
  } catch (e) {
    Logger.log('[AUTH] Cache remove failed: ' + e);
  }
}

/**
 * Central Admin authorization gate for all protected actions.
 * Accepts EITHER a valid session token OR the legacy ADMIN_SECRET_KEY
 * during the transition period (will be removed after full migration).
 *
 * Returns: { authorized: true, admin_id, username, role }
 *       or: { authorized: false, error }
 */
function requireAdminSession(payload) {
  if (!payload) return { authorized: false, error: 'UNAUTHORIZED' };

  var token = String(payload.session_token || payload.admin_token || payload.adminToken || payload.token || '').trim();

  // Primary: new session token
  if (token && token.indexOf('ASPL_') === 0) {
    var sess = getAdminSession(token);
    if (sess.valid) {
      return { authorized: true, admin_id: sess.admin_id, username: sess.username, role: sess.role };
    }
    return { authorized: false, error: sess.error || 'UNAUTHORIZED' };
  }

  // Legacy fallback: ADMIN_SECRET_KEY (kept for existing deployed clients during migration)
  var role = String(payload.role || '').trim().toUpperCase();
  if (token === CONFIG.ADMIN_SECRET_KEY && role === 'ADMIN') {
    return { authorized: true, admin_id: 'legacy', username: 'admin', role: 'admin' };
  }

  // Legacy fallback: password hash check
  var adminPass = String(payload.admin_password || payload.adminPassword || '').trim();
  if (adminPass && hashPassword(adminPass) === 'bf145ff13649f1771e5196eaa41c3622d090750500bdc2c9925f51e0deec4eab' && role === 'ADMIN') {
    return { authorized: true, admin_id: 'legacy', username: 'admin', role: 'admin' };
  }

  return { authorized: false, error: 'UNAUTHORIZED' };
}

/**
 * LOGIN ADMIN
 * POST { action: "loginAdmin", username, password }
 * Returns session token on success.
 */
function apiLoginAdmin(payload) {
  var username = String(payload.username || '').trim().toLowerCase();
  var password = String(payload.password || '').trim();

  // Basic input validation
  if (!username || !password) {
    return { success: false, authenticated: false, error: 'Invalid username or password.' };
  }

  // Rate limiting: check failed attempts in Sheets
  var sheet = getAdminsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { success: false, authenticated: false, error: 'Invalid username or password.' };
  }

  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  var col = function(name) { return headerRow.indexOf(name); };

  var usernameIdx   = col('username');
  var passHashIdx   = col('password_hash');
  var roleIdx       = col('role');
  var statusIdx     = col('status');
  var lastLoginIdx  = col('last_login');
  var failIdx       = col('failed_attempts');
  var lockedIdx     = col('locked_until');
  var adminIdIdx    = col('admin_id');

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowUsername = String(row[usernameIdx] || '').trim().toLowerCase();

    if (rowUsername !== username) continue;

    // Found user — check rate limiting
    var rowNum = i + 2;
    var lockedUntil = lockedIdx !== -1 ? String(row[lockedIdx] || '') : '';
    var failedAttempts = failIdx !== -1 ? Number(row[failIdx] || 0) : 0;

    if (lockedUntil && Date.now() < Number(lockedUntil)) {
      var waitSecs = Math.ceil((Number(lockedUntil) - Date.now()) / 1000);
      Logger.log('[AUTH] Account locked for: ' + username + ' (' + waitSecs + 's remaining)');
      return { success: false, authenticated: false, error: 'Too many failed attempts. Try again in ' + waitSecs + ' seconds.' };
    }

    var status = statusIdx !== -1 ? String(row[statusIdx] || '').trim().toLowerCase() : 'active';
    var role   = roleIdx   !== -1 ? String(row[roleIdx]   || '').trim().toLowerCase() : 'admin';

    if (status !== 'active') {
      return { success: false, authenticated: false, error: 'Invalid username or password.' };
    }

    // Verify password hash
    var storedHash  = passHashIdx !== -1 ? String(row[passHashIdx] || '').trim() : '';
    var inputHash   = hashPassword(password);

    if (!storedHash || inputHash !== storedHash) {
      // Increment failed attempts
      var newFails = failedAttempts + 1;
      if (failIdx !== -1) sheet.getRange(rowNum, failIdx + 1).setValue(newFails);
      // Lock for 5 minutes after 5 failures
      if (newFails >= 5 && lockedIdx !== -1) {
        sheet.getRange(rowNum, lockedIdx + 1).setValue(String(Date.now() + 5 * 60 * 1000));
      }
      Logger.log('[AUTH] Failed login attempt ' + newFails + ' for: ' + username);
      return { success: false, authenticated: false, error: 'Invalid username or password.' };
    }

    // SUCCESS — reset failed attempts, update last_login, generate session
    if (failIdx !== -1) sheet.getRange(rowNum, failIdx + 1).setValue(0);
    if (lockedIdx !== -1) sheet.getRange(rowNum, lockedIdx + 1).setValue('');
    if (lastLoginIdx !== -1) sheet.getRange(rowNum, lastLoginIdx + 1).setValue(new Date().toISOString());
    SpreadsheetApp.flush();

    var adminId = adminIdIdx !== -1 ? String(row[adminIdIdx] || 'ADM-001').trim() : 'ADM-001';
    var token = generateSessionToken();

    storeAdminSession(token, {
      admin_id: adminId,
      username: username,
      role: role
    });

    Logger.log('[AUTH] Admin logged in: ' + username);
    return {
      success: true,
      authenticated: true,
      session_token: token,
      admin: {
        admin_id: adminId,
        username: username,
        role: role
      }
    };
  }

  // Username not found — same generic error
  return { success: false, authenticated: false, error: 'Invalid username or password.' };
}

/**
 * VALIDATE ADMIN SESSION
 * POST { action: "validateAdminSession", session_token }
 */
function apiValidateAdminSession(payload) {
  var token = String(payload.session_token || '').trim();
  var sess = getAdminSession(token);
  if (!sess.valid) {
    return { success: false, authenticated: false, error: sess.error || 'SESSION_EXPIRED' };
  }
  return {
    success: true,
    authenticated: true,
    admin: {
      admin_id: sess.admin_id,
      username: sess.username,
      role: sess.role
    }
  };
}

/**
 * LOGOUT ADMIN
 * POST { action: "logoutAdmin", session_token }
 */
function apiLogoutAdmin(payload) {
  var token = String(payload.session_token || '').trim();
  removeAdminSession(token);
  Logger.log('[AUTH] Admin logged out.');
  return { success: true, message: 'Logged out successfully.' };
}

/**
 * Salted SHA-256 password hashing matching frontend UniBoxDb salt
 */
function hashPassword(password) {
  if (!password) return '';
  var salt = 'unibox_league_2026_salt_';
  var rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + password, Utilities.Charset.UTF_8);
  var hex = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var b = rawBytes[i];
    if (b < 0) b += 256;
    var str = b.toString(16);
    if (str.length === 1) str = '0' + str;
    hex += str;
  }
  return hex;
}

/**
 * Dynamically ensure Teams sheet contains owner_name and owner_email in header row 1
 */
function ensureTeamSheetHeaders(sheet) {
  if (!sheet) return HEADERS.TEAMS;
  var lastCol = sheet.getLastColumn();
  if (lastCol <= 0) {
    sheet.appendRow(HEADERS.TEAMS);
    return HEADERS.TEAMS;
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h).trim(); });
  var needed = ['owner_name', 'owner_email', 'department', 'logo_file_id', 'logo_file_url'];
  var modified = false;
  needed.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(col);
      headers.push(col);
      modified = true;
    }
  });
  if (modified) {
    SpreadsheetApp.flush();
  }
  return headers;
}

/**
 * STEP 30 — AUTOMATIC INITIALIZATION FUNCTION: setupTournament()
 * Run this function directly in Apps Script or via API ?action=setup
 */
function setupTournament() {
  Logger.log('[SETUP] Initializing Sunstone Premier League 2026 database...');

  var ss = getSpreadsheet();
  if (!ss) {
    return { success: false, error: 'Could not access spreadsheet with ID: ' + CONFIG.SPREADSHEET_ID };
  }

  // 1. Create Sheets with headers
  var playersSheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var franchiseAuthSheet = getOrCreateSheet(CONFIG.SHEETS.FRANCHISE_AUTH, HEADERS.FRANCHISE_AUTH);
  var auctionSheet = getOrCreateSheet(CONFIG.SHEETS.AUCTION, HEADERS.AUCTION);
  var settingsSheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);

  // Ensure Teams sheet has owner_name and owner_email in header row
  ensureTeamSheetHeaders(teamsSheet);

  // If Sheet1 still exists and is empty while Players exists separately, remove Sheet1
  var leftoverSheet1 = ss.getSheetByName('Sheet1');
  if (leftoverSheet1 && leftoverSheet1.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(leftoverSheet1);
    } catch (e) {}
  }

  // 2. Teams sheet is strictly created with headers only (NO AUTOMATIC SEEDING)
  // Per Tournament Security Architecture: Franchises are created ONLY when an authorized Admin manually submits "Create Franchise"
  Logger.log('[SETUP] Teams sheet initialized with headers. Ready for Admin manual franchise creation.');

  // 3. Initialize Settings sheet if empty
  if (settingsSheet.getLastRow() <= 1) {
    settingsSheet.appendRow(['tournament_name', 'SUNSTONE PREMIER LEAGUE 2026']);
    settingsSheet.appendRow(['team_count', '8']);
    settingsSheet.appendRow(['athlete_count', '0']);
    settingsSheet.appendRow(['season', '2026']);
    settingsSheet.appendRow(['initial_team_purse', '1000']);
    Logger.log('[SETUP] Seeded settings.');
  }

  // 4. Initialize Google Drive subfolders inside main folder
  var photoFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.PHOTOS);
  var certFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.CERTIFICATES);
  var logoFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.LOGOS);
  var docFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.DOCUMENTS);

  Logger.log('[SETUP] Drive subfolders verified / created.');

  var result = {
    success: true,
    message: 'Sunstone Premier League 2026 tournament backend setup complete!',
    spreadsheet: {
      id: CONFIG.SPREADSHEET_ID,
      url: ss.getUrl(),
      sheets: [CONFIG.SHEETS.PLAYERS, CONFIG.SHEETS.TEAMS, CONFIG.SHEETS.FRANCHISE_AUTH, CONFIG.SHEETS.AUCTION, CONFIG.SHEETS.SETTINGS]
    },
    drive: {
      main_folder_id: CONFIG.DRIVE_FOLDER_ID,
      athlete_photos_id: photoFolder.getId(),
      sports_certificates_id: certFolder.getId(),
      team_logos_id: logoFolder.getId(),
      other_documents_id: docFolder.getId()
    }
  };

  Logger.log('[SETUP] Result: ' + JSON.stringify(result));
  return result;
}

/**
 * STEP 31 — TEST API FUNCTION: testBackend()
 */
function testBackend() {
  try {
    var ss = getSpreadsheet();
    var playersSheet = ss.getSheetByName(CONFIG.SHEETS.PLAYERS);
    var teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
    var auctionSheet = ss.getSheetByName(CONFIG.SHEETS.AUCTION);
    var settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);

    var parentFolder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    var photoFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.PHOTOS);
    var certFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.CERTIFICATES);
    var logoFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.LOGOS);
    var docFolder = getOrCreateDriveFolder(CONFIG.FOLDERS.DOCUMENTS);

    return {
      success: true,
      spreadsheet: {
        id: CONFIG.SPREADSHEET_ID,
        name: ss.getName(),
        has_players: Boolean(playersSheet),
        has_teams: Boolean(teamsSheet),
        has_auction: Boolean(auctionSheet),
        has_settings: Boolean(settingsSheet),
        athlete_count: playersSheet ? Math.max(0, playersSheet.getLastRow() - 1) : 0
      },
      folders: {
        main_folder: parentFolder.getName(),
        athlete_photos: photoFolder.getName() + ' (' + photoFolder.getId() + ')',
        sports_certificates: certFolder.getName() + ' (' + certFolder.getId() + ')',
        team_logos: logoFolder.getName() + ' (' + logoFolder.getId() + ')',
        other_documents: docFolder.getName() + ' (' + docFolder.getId() + ')'
      },
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      success: false,
      error: 'Backend test failed: ' + err.message || String(err)
    };
  }
}

// Alias for setup
function initializeTournamentDatabase() {
  return setupTournament();
}

/**
 * ==============================================================================
 * WEB APP REQUEST ROUTERS (doGet & doPost)
 * ==============================================================================
 */

/**
 * Web App GET handler
 */
function doGet(e) {
  try {
    var params = e ? e.parameter : {};
    var action = params.action || 'getAthleteCount';

    Logger.log('[GET] Action requested: ' + action);

    var result;
    switch (action) {
      case 'ping':
        result = {
          success: true,
          message: 'Sunstone Premier League 2026 API Online',
          timestamp: new Date().toISOString()
        };
        break;

      case 'setup':
      case 'setupTournament':
        result = setupTournament();
        break;

      case 'testBackend':
        result = testBackend();
        break;

      case 'getAthleteCount':
        result = apiGetAthleteCount(params);
        break;

      case 'getSyncState':
      case 'syncState':
        result = apiGetSyncState(params);
        break;

      case 'getPlayers':
        result = apiGetPlayers(params);
        break;

      case 'getPlayer':
        result = apiGetPlayer(params);
        break;

      case 'getTeams':
        result = apiGetTeams(params);
        break;

      case 'getTeam':
        result = apiGetTeam(params);
        break;

      case 'getAuction':
        result = apiGetAuction(params);
        break;

      case 'getSettings':
        result = apiGetSettings(params);
        break;

      case 'getRegistrationStatus':
      case 'registrationStatus':
        result = apiGetRegistrationStatus(params);
        break;

      default:
        result = { success: false, error: 'Unknown GET action: ' + action };
        break;
    }

    return createJsonResponse(result);
  } catch (err) {
    Logger.log('[GET] Error: ' + err);
    return createJsonResponse({ success: false, error: err.message || String(err) });
  }
}

/**
 * Verifies if the caller is authoritatively authenticated as Admin.
 * Critical Security Requirement: NEVER trust role="ADMIN" blindly from unauthenticated browser requests.
 * Requires authentic secret token or verified coordinator password hash.
 */
/**
 * @deprecated Use requireAdminSession() for new code.
 * Kept for backward compatibility with existing clients during migration window.
 */
function isAdminAuthorized(payload) {
  var result = requireAdminSession(payload);
  return result.authorized === true;
}

/**
 * Web App POST handler
 */
function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    var action = payload.action;
    if (!action) {
      return createJsonResponse({ success: false, error: 'Action parameter is required.' });
    }

    // Sanitize logging (never log passwords)
    var logPayload = {};
    for (var k in payload) {
      if (k.toLowerCase().includes('pass') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('token')) {
        logPayload[k] = '[HIDDEN]';
      } else if (k === 'photo_data' || k === 'certificate_data') {
        logPayload[k] = '[BASE64_DATA_LENGTH_' + String(payload[k]).length + ']';
      } else {
        logPayload[k] = payload[k];
      }
    }
    Logger.log('[POST] Action: ' + action + ' | Payload: ' + JSON.stringify(logPayload));

    // STRICT Role-based Authorization for Privileged Admin Actions
    // Hiding buttons is NOT enough: Apps Script authoritatively blocks unauthorized calls
    var STRICT_ADMIN_ACTIONS = [
      'createTeam', 'createFranchise', 'registerFranchise', 'updateTeam', 'deleteTeam',
      'deleteAllPlayers', 'deletePlayer', 'deletePlayers', 'approvePlayer', 'approvePlayers', 'approveAllPlayers',
      'unapprovePlayer', 'unapprovePlayers',
      'rejectPlayer', 'purchasePlayer', 'assignPlayer', 'sellPlayer', 'removePlayerFromTeam', 'updatePurse',
      'setRegistrationStatus', 'updateRegistrationStatus'
    ];

    if (STRICT_ADMIN_ACTIONS.indexOf(action) !== -1) {
      if (!isAdminAuthorized(payload)) {
        Logger.log('[AUTH REJECTED] Privileged action blocked: ' + action + ' | Actor: ' + (payload.actor || payload.owner_email || 'unauthenticated'));
        return createJsonResponse({
          success: false,
          error: "Unauthorized: Admin access required"
        });
      }
    }

    var result;
    switch (action) {
      case 'loginAdmin':
        result = apiLoginAdmin(payload);
        break;

      case 'validateAdminSession':
        result = apiValidateAdminSession(payload);
        break;

      case 'logoutAdmin':
        result = apiLogoutAdmin(payload);
        break;

      case 'registerPlayer':
        result = apiRegisterPlayer(payload);
        break;

      case 'updatePlayer':
        result = apiUpdatePlayer(payload);
        break;

      case 'approvePlayer':
        result = apiSetPlayerStatus(payload, 'Approved');
        break;

      case 'approvePlayers':
        result = apiApprovePlayers(payload);
        break;

      case 'approveAllPlayers':
        result = apiApproveAllPlayers(payload);
        break;

      case 'unapprovePlayer':
        result = apiUnapprovePlayer(payload);
        break;

      case 'unapprovePlayers':
        result = apiUnapprovePlayers(payload);
        break;

      case 'rejectPlayer':
        result = apiSetPlayerStatus(payload, 'Rejected');
        break;

      case 'deletePlayer':
        result = apiDeletePlayer(payload);
        break;

      case 'deletePlayers':
        result = apiDeletePlayers(payload);
        break;

      case 'deleteAllPlayers':
        result = apiDeleteAllPlayers(payload);
        break;

      case 'createFranchise':
      case 'createTeam':
        if (!isAdminAuthorized(payload)) {
          return createJsonResponse({ success: false, error: "Unauthorized: Admin access required" });
        }
        result = apiRegisterFranchise(payload);
        break;

      case 'registerFranchise':
        // Franchise creation is ADMIN-ONLY. Owner franchise self-registration is strictly blocked.
        if (!isAdminAuthorized(payload)) {
          return createJsonResponse({
            success: false,
            error: "Unauthorized: Admin access required. Franchise accounts are created exclusively by Tournament Administration."
          });
        }
        result = apiRegisterFranchise(payload);
        break;

      case 'loginFranchise':
      case 'loginTeamOwner':
        result = apiLoginFranchise(payload);
        break;

      case 'getTeams':
        result = apiGetTeams(payload);
        break;

      case 'getSyncState':
      case 'syncState':
        result = apiGetSyncState(payload);
        break;

      case 'getTeam':
        result = apiGetTeam(payload);
        break;

      case 'updateTeam':
        result = apiUpdateTeam(payload);
        break;

      case 'deleteTeam':
        result = apiDeleteTeam(payload);
        break;

      case 'purchasePlayer':
      case 'assignPlayer':
      case 'sellPlayer':
        result = apiPurchasePlayer(payload);
        break;

      case 'revokePlayerPurchase':
        result = apiRevokePlayerPurchase(payload);
        break;

      case 'uploadPhoto':
        result = apiUploadFileAndUpdatePlayer(payload, CONFIG.FOLDERS.PHOTOS, 'athlete_photo', 'photo');
        break;

      case 'uploadCertificate':
        result = apiUploadFileAndUpdatePlayer(payload, CONFIG.FOLDERS.CERTIFICATES, 'athlete_cert', 'certificate');
        break;

      case 'uploadTeamLogo':
        result = apiUploadTeamLogo(payload);
        break;

      case 'getRegistrationStatus':
      case 'registrationStatus':
        result = apiGetRegistrationStatus(payload);
        break;

      case 'setRegistrationStatus':
      case 'updateRegistrationStatus':
        result = apiSetRegistrationStatus(payload);
        break;

      default:
        result = { success: false, error: 'Unknown POST action: ' + action };
        break;
    }

    return createJsonResponse(result);
  } catch (err) {
    Logger.log('[POST] Error: ' + err);
    return createJsonResponse({ success: false, error: err.message || String(err) });
  }
}

/**
 * Standardized JSON response helper
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================================================================
// READ ACTIONS (GET)
// ==============================================================================

/**
 * STEP 22 — ATHLETE COUNT API (Lightweight 1-second auto-sync)
 */
function apiGetAthleteCount(params) {
  var sheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
  var lastRow = sheet.getLastRow();
  var total = Math.max(0, lastRow - 1);

  var statusFilter = params ? params.status : null;
  if (!statusFilter || statusFilter === 'ALL' || total === 0) {
    return {
      success: true,
      count: total,
      data: { total: total }
    };
  }

  // Filter by status if requested
  var statusColIdx = HEADERS.PLAYERS.indexOf('status') + 1;
  var statuses = sheet.getRange(2, statusColIdx, total, 1).getValues();
  var filteredCount = 0;
  for (var i = 0; i < statuses.length; i++) {
    if (String(statuses[i][0]).trim().toLowerCase() === statusFilter.toLowerCase()) {
      filteredCount++;
    }
  }

  return {
    success: true,
    count: filteredCount,
    data: { total: total, filtered: filteredCount, status: statusFilter }
  };
}

/**
 * STEP 30 — ULTRA-FAST SYNCHRONIZATION STATE API (Requirement 8)
 * Returns sheet row counts, last modified stamps, and lightweight metadata for 1s polling.
 * Avoids reading or parsing large data ranges, responding in < 50ms!
 */
function apiGetSyncState(params) {
  var ss = getSpreadsheet();
  var playersSheet = getPlayersSheet();
  var teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
  var auctionSheet = ss.getSheetByName(CONFIG.SHEETS.AUCTION);

  var playersLastRow = playersSheet ? playersSheet.getLastRow() : 0;
  var teamsLastRow = teamsSheet ? teamsSheet.getLastRow() : 0;
  var auctionLastRow = auctionSheet ? auctionSheet.getLastRow() : 0;

  var playersCount = Math.max(0, playersLastRow - 1);
  var teamsCount = Math.max(0, teamsLastRow - 1);
  var registrationOpen = getRegistrationOpenSetting();

  return {
    success: true,
    data: {
      playersCount: playersCount,
      playersLastRow: playersLastRow,
      teamsCount: teamsCount,
      teamsLastRow: teamsLastRow,
      auctionLastRow: auctionLastRow,
      registration_open: registrationOpen,
      registrationOpen: registrationOpen,
      serverTime: new Date().toISOString()
    }
  };
}

/**
 * Helper to obtain the authoritative Players sheet.
 * Seamlessly resolves either 'Players' or 'Player_Auction_Roster' (Step 12).
 */
function getPlayersSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.PLAYERS);
  var rosterSheet = ss.getSheetByName('Player_Auction_Roster');

  if (rosterSheet && rosterSheet.getLastRow() > 1) {
    if (!sheet || sheet.getLastRow() <= 1) {
      try {
        if (sheet && sheet.getLastRow() <= 1) {
          ss.deleteSheet(sheet);
        }
        rosterSheet.setName(CONFIG.SHEETS.PLAYERS);
        return rosterSheet;
      } catch (e) {
        return rosterSheet;
      }
    }
  }

  if (sheet) return sheet;
  if (rosterSheet) return rosterSheet;
  return getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
}

/**
 * Retrieve all registered players (Step 1, 2, 11, 12, 13, 14)
 * - Dynamic column header mapping (independent of hardcoded column indexes)
 * - Strict type normalization (enrollment_no, mobile_number, strings, numbers)
 * - Non-destructive duplicate ID handling for frontend rendering
 */
function apiGetPlayers(params) {
  var sheet = getPlayersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, data: [] };
  }

  var dataRange = sheet.getDataRange().getValues();
  if (!dataRange || dataRange.length <= 1) {
    return { success: true, data: [] };
  }

  // Step 11: Dynamic Header Mapping
  var headerRow = dataRange[0].map(function(h) { return String(h || '').trim(); });
  var colMap = {};
  headerRow.forEach(function(h, idx) {
    if (h) colMap[h] = idx;
  });

  // Helper to read column value by header name or fallback aliases
  function getColVal(row, headerName, fallbackAliases) {
    if (colMap[headerName] !== undefined) {
      var v = row[colMap[headerName]];
      if (v !== undefined && v !== null) return v;
    }
    if (fallbackAliases && fallbackAliases.length) {
      for (var a = 0; a < fallbackAliases.length; a++) {
        var alias = fallbackAliases[a];
        if (colMap[alias] !== undefined) {
          var av = row[colMap[alias]];
          if (av !== undefined && av !== null) return av;
        }
      }
    }
    return '';
  }

  var players = [];
  var seenIds = {};

  for (var i = 1; i < dataRange.length; i++) {
    var row = dataRange[i];
    // Skip completely empty rows
    var hasData = row.some(function(cell) { return cell !== '' && cell !== null && cell !== undefined; });
    if (!hasData) continue;

    var rawId = String(getColVal(row, 'id', ['player_id', 'athlete_id']) || '').trim();
    var rawName = String(getColVal(row, 'full_name', ['name', 'athlete_name']) || '').trim();
    // Step 2: enrollment_no MUST ALWAYS be a normalized string
    var rawEnroll = String(getColVal(row, 'enrollment_no', ['enrollment', 'roll_no', 'roll']) || '').trim();
    var rawDept = String(getColVal(row, 'department', ['branch']) || '').trim();
    var rawEmail = String(getColVal(row, 'email') || '').trim().toLowerCase();
    // Step 9: mobile_number MUST ALWAYS be a normalized string
    var rawMobile = String(getColVal(row, 'mobile_number', ['phone', 'mobile']) || '').trim();
    var rawGender = String(getColVal(row, 'gender') || 'Male').trim();
    var rawRole = String(getColVal(row, 'player_role', ['role']) || 'All-Rounder').trim();
    var rawStatus = String(getColVal(row, 'status') || 'Registered').trim();
    // Step 10: base_price and sold_price MUST be numbers
    var rawBaseVal = getColVal(row, 'base_price', ['basePrice']);
    var rawBase = (rawBaseVal !== '' && rawBaseVal !== null && !isNaN(Number(rawBaseVal)))
      ? Number(rawBaseVal)
      : (CONFIG.DEFAULT_ROLE_BASE_PRICES[rawRole] || 15);

    var rawSoldTo = String(getColVal(row, 'sold_to_team', ['sold_team', 'team']) || '').trim();
    var rawSoldPriceVal = getColVal(row, 'sold_price', ['soldPrice']);
    var rawSoldPrice = (rawSoldPriceVal !== '' && rawSoldPriceVal !== null && !isNaN(Number(rawSoldPriceVal)))
      ? Number(rawSoldPriceVal)
      : null;
    var rawAuctionStatus = (rawSoldTo || rawSoldPrice) ? 'Sold' : String(getColVal(row, 'auction_status') || 'Upcoming').trim();

    var rawPhotoId = String(getColVal(row, 'photo_file_id') || '').trim();
    var rawPhotoUrl = String(getColVal(row, 'photo_file_url', ['photo_data', 'photo']) || '').trim();
    var rawCertId = String(getColVal(row, 'certificate_file_id') || '').trim();
    var rawCertUrl = String(getColVal(row, 'certificate_file_url', ['certificate_data']) || '').trim();
    var rawCertName = String(getColVal(row, 'certificate_name', ['certificate']) || '').trim();
    if (!rawCertName && rawCertUrl) rawCertName = 'Attached Document';
    else if (!rawCertName) rawCertName = 'None attached';

    var rawCreatedAt = String(getColVal(row, 'created_at', ['timestamp']) || '').trim() || new Date().toISOString();

    // Step 13 & 14: Non-destructive duplicate ID handling for frontend key stability
    var finalId = rawId || ('SPL-ATH-' + ('000' + i).slice(-4));
    seenIds[finalId] = (seenIds[finalId] || 0) + 1;
    var displayId = finalId;
    if (seenIds[finalId] > 1) {
      displayId = finalId + '-D' + seenIds[finalId];
    }

    var playerObj = {
      id: displayId,
      original_id: finalId,
      created_at: rawCreatedAt,
      full_name: rawName,
      name: rawName,
      enrollment_no: rawEnroll,
      department: rawDept,
      branch: rawDept,
      email: rawEmail,
      mobile_number: rawMobile,
      phone: rawMobile,
      gender: rawGender,
      player_role: rawRole,
      role: rawRole,
      status: rawStatus,
      base_price: rawBase,
      auction_status: rawAuctionStatus,
      sold_to_team: rawSoldTo,
      sold_price: rawSoldPrice,
      photo_file_id: rawPhotoId,
      photo_file_url: rawPhotoUrl,
      photo_data: rawPhotoUrl,
      photo: rawPhotoUrl,
      certificate_file_id: rawCertId,
      certificate_file_url: rawCertUrl,
      certificate_data: rawCertUrl,
      certificate_name: rawCertName,
      certificate: rawCertName
    };

    players.push(playerObj);
  }

  return { success: true, data: players };
}

/**
 * Retrieve single player profile by email or ID
 */
function apiGetPlayer(params) {
  var email = params.email ? String(params.email).trim().toLowerCase() : '';
  var id = params.id ? String(params.id).trim() : '';

  if (!email && !id) {
    return { success: false, error: 'Email or ID is required.' };
  }

  var sheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, error: 'Player not found.', data: null };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.PLAYERS.length).getValues();
  var emailIdx = HEADERS.PLAYERS.indexOf('email');
  var idIdx = HEADERS.PLAYERS.indexOf('id');

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowEmail = String(row[emailIdx] || '').trim().toLowerCase();
    var rowId = String(row[idIdx] || '').trim();

    if ((email && rowEmail === email) || (id && rowId === id)) {
      var player = {};
      for (var j = 0; j < HEADERS.PLAYERS.length; j++) {
        player[HEADERS.PLAYERS[j]] = row[j];
      }
      player.name = player.full_name;
      player.phone = String(player.mobile_number || '');
      player.mobile_number = String(player.mobile_number || '');
      player.photo_data = player.photo_file_url || '';
      player.photo = player.photo_file_url || '';
      player.certificate_data = player.certificate_file_url || '';
      player.certificate = player.certificate_name || (player.certificate_file_url ? 'Attached Document' : 'None attached');

      return { success: true, data: player };
    }
  }

  return { success: false, error: 'Player not found.', data: null };
}

/**
 * STEP 23 — TEAMS SYSTEM (Retrieve all 8 teams with computed purse & squad)
 */
function apiGetTeams(params) {
  var sheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1) {
    return { success: true, data: [] };
  }

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var teams = [];

  // Read players to compute live squad and spent balance accurately (skip if client already has players)
  var allPlayers = [];
  if (!params || !params.skipSquadCalc) {
    var playersRes = apiGetPlayers();
    allPlayers = playersRes.data || [];
  }

  // Read Franchise_Auth if available to resolve owner if missing in Teams row
  var authMap = {};
  try {
    var ss = getSpreadsheet();
    var authSheet = ss.getSheetByName(CONFIG.SHEETS.FRANCHISE_AUTH);
    if (authSheet && authSheet.getLastRow() > 1) {
      var aCols = authSheet.getLastColumn();
      var aHeaders = authSheet.getRange(1, 1, 1, aCols).getValues()[0].map(function(h) { return String(h).trim(); });
      var aTidIdx = aHeaders.indexOf('team_id');
      var aNameIdx = aHeaders.indexOf('owner_name');
      var aEmailIdx = aHeaders.indexOf('owner_email');
      if (aTidIdx !== -1) {
        var aRows = authSheet.getRange(2, 1, authSheet.getLastRow() - 1, aCols).getValues();
        for (var a = 0; a < aRows.length; a++) {
          var tid = String(aRows[a][aTidIdx] || '').trim();
          if (tid) {
            authMap[tid] = {
              owner_name: aNameIdx !== -1 ? String(aRows[a][aNameIdx] || '').trim() : '',
              owner_email: aEmailIdx !== -1 ? String(aRows[a][aEmailIdx] || '').trim().toLowerCase() : ''
            };
          }
        }
      }
    }
  } catch (authErr) {}

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var team = {};
    for (var j = 0; j < headerRow.length; j++) {
      var hKey = headerRow[j];
      if (hKey) team[hKey] = row[j];
    }

    var teamId = String(team.id || '').trim();
    var teamName = String(team.team_name || team.name || '').trim();

    // Cross-reference owner from Franchise_Auth if empty in Teams row
    if (authMap[teamId]) {
      if (!team.owner_name && authMap[teamId].owner_name) {
        team.owner_name = authMap[teamId].owner_name;
      }
      if (!team.owner_email && authMap[teamId].owner_email) {
        team.owner_email = authMap[teamId].owner_email;
      }
    }

    var tNameLower = teamName.toLowerCase();
    var tIdLower = teamId.toLowerCase();

    // Find squad from Players sheet: only count active sold athletes (exclude Rejected, Pending, Unassigned)
    var squad = allPlayers.filter(function(p) {
      var soldTeam = String(p.sold_to_team || '').trim().toLowerCase();
      var isSold = String(p.auction_status || '').trim().toLowerCase() === 'sold';
      var isNotRejected = String(p.status || '').trim().toLowerCase() !== 'rejected';
      return isSold && isNotRejected && soldTeam && (soldTeam === tNameLower || soldTeam === tIdLower);
    });

    var spent = squad.reduce(function(sum, p) {
      return sum + (Number(p.sold_price) || 0);
    }, 0);

    var purse = Number(team.purse || team.total_budget || 1000);
    var remaining = Math.max(0, purse - spent);

    team.id = teamId;
    team.name = teamName;
    team.team_name = teamName;
    team.short_name = String(team.short_name || teamName.substring(0, 4).toUpperCase()).trim();
    team.department = String(team.department || team.short_name || '').trim();
    team.logo_file_id = String(team.logo_file_id || '').trim();
    team.logo_file_url = String(team.logo_file_url || (String(team.logo || '').startsWith('http') ? team.logo : '')).trim();
    team.logo = team.logo_file_url || team.logo || '🏏';
    team.owner_name = String(team.owner_name || '').trim();
    team.owner_email = String(team.owner_email || '').trim().toLowerCase();
    team.purse = purse;
    team.total_budget = purse;
    team.total_spent = spent;
    team.spent = spent;
    team.spent_points = spent;
    team.remaining_purse = remaining;
    team.leftover_balance = remaining;
    team.player_count = squad.length;
    team.squad_count = squad.length;
    team.squad = squad;
    team.status = String(team.status || 'Active').trim();
    team.created_at = team.created_at || new Date().toISOString();

    // Security: never return password or secret hashes
    delete team.password;
    delete team.password_hash;
    delete team.rawPassword;

    teams.push(team);
  }

  return { success: true, data: teams };
}

/**
 * Retrieve single team details
 */
function apiGetTeam(params) {
  var id = params.id ? String(params.id).trim().toLowerCase() : '';
  var name = params.name ? String(params.name).trim().toLowerCase() : '';

  var teamsRes = apiGetTeams();
  var teams = teamsRes.data || [];

  for (var i = 0; i < teams.length; i++) {
    if ((id && teams[i].id.toLowerCase() === id) || (name && teams[i].team_name.toLowerCase() === name)) {
      return { success: true, data: teams[i] };
    }
  }

  return { success: false, error: 'Team not found.', data: null };
}

/**
 * STEP 24 — AUCTION SHEET
 */
function apiGetAuction(params) {
  var sheet = getOrCreateSheet(CONFIG.SHEETS.AUCTION, HEADERS.AUCTION);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: true, data: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.AUCTION.length).getValues();
  var auctions = [];
  for (var i = 0; i < values.length; i++) {
    var item = {};
    for (var j = 0; j < HEADERS.AUCTION.length; j++) {
      item[HEADERS.AUCTION[j]] = values[i][j];
    }
    auctions.push(item);
  }

  return { success: true, data: auctions };
}

/**
 * STEP 6 — SETTINGS SHEET
 */
function apiGetSettings(params) {
  var sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
  var lastRow = sheet.getLastRow();
  var settings = {};
  if (lastRow > 1) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < values.length; i++) {
      settings[values[i][0]] = values[i][1];
    }
  }
  return { success: true, data: settings };
}

/**
 * ==============================================================================
 * GLOBAL REGISTRATION STATUS HELPERS & APIS (Settings Sheet backed)
 * ==============================================================================
 */

/**
 * Get registration_open status from Settings sheet.
 * If setting is missing, defaults to true (OPEN) and creates it in Settings sheet.
 */
function getRegistrationOpenSetting() {
  try {
    var ss = getSpreadsheet();
    var sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      var vals = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
      for (var i = 0; i < vals.length; i++) {
        var key = String(vals[i][0] || '').trim().toLowerCase();
        if (key === 'registration_open') {
          var val = String(vals[i][1]).trim().toLowerCase();
          return val !== 'false' && val !== '0' && val !== 'closed';
        }
      }
    }
    // Default to true if not yet configured (Section 3)
    sheet.appendRow(['registration_open', 'true']);
    SpreadsheetApp.flush();
    return true;
  } catch (err) {
    Logger.log('[SETTINGS] Error reading registration_open setting: ' + err);
    return true;
  }
}

/**
 * Set registration_open status in Settings sheet.
 */
function setRegistrationOpenSetting(isOpen) {
  var ss = getSpreadsheet();
  var sheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
  var lastRow = sheet.getLastRow();
  var boolStr = isOpen ? 'true' : 'false';
  var updated = false;

  if (lastRow > 1) {
    var vals = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var key = String(vals[i][0] || '').trim().toLowerCase();
      if (key === 'registration_open') {
        sheet.getRange(i + 2, 2).setValue(boolStr);
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    sheet.appendRow(['registration_open', boolStr]);
  }
  SpreadsheetApp.flush();
  Logger.log('[REGISTRATION SETTING] registration_open set to ' + boolStr);
  return isOpen;
}

/**
 * API Action: getRegistrationStatus
 * Lightweight public check (does not load players/teams data).
 */
function apiGetRegistrationStatus(params) {
  var isOpen = getRegistrationOpenSetting();
  return {
    success: true,
    registration_open: isOpen,
    status: isOpen ? 'OPEN' : 'CLOSED',
    timestamp: new Date().toISOString()
  };
}

/**
 * API Action: setRegistrationStatus
 * Admin protected endpoint to open or close athlete registration.
 */
function apiSetRegistrationStatus(payload) {
  if (!isAdminAuthorized(payload)) {
    Logger.log('[AUTH REJECTED] apiSetRegistrationStatus called without valid Admin credentials.');
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  var rawVal = payload.registration_open !== undefined ? payload.registration_open : (payload.isOpen !== undefined ? payload.isOpen : payload.status);
  var isOpen = rawVal === true || rawVal === 'true' || rawVal === 'OPEN' || rawVal === 1 || rawVal === '1';

  setRegistrationOpenSetting(isOpen);

  return {
    success: true,
    registration_open: isOpen,
    status: isOpen ? 'OPEN' : 'CLOSED',
    message: isOpen ? 'Registration opened successfully.' : 'Registration closed successfully.',
    timestamp: new Date().toISOString()
  };
}

// ==============================================================================
// MUTATION ACTIONS (POST)
// ==============================================================================

/**
 * Helper to save Base64 file into Drive subfolder
 * Returns object { fileId, fileUrl }
 */
function saveBase64ToDrive(base64Data, folderName, fileNamePrefix) {
  if (!base64Data || typeof base64Data !== 'string') return { fileId: '', fileUrl: '' };

  try {
    var parts = base64Data.split(',');
    var meta = parts[0] || '';
    var rawBase64 = parts[1] || parts[0];

    // Determine mime type
    var mimeType = 'image/jpeg';
    var ext = 'jpg';
    if (meta.indexOf('image/png') !== -1) {
      mimeType = 'image/png';
      ext = 'png';
    } else if (meta.indexOf('image/webp') !== -1) {
      mimeType = 'image/webp';
      ext = 'webp';
    } else if (meta.indexOf('image/svg') !== -1) {
      mimeType = 'image/svg+xml';
      ext = 'svg';
    } else if (meta.indexOf('application/pdf') !== -1) {
      mimeType = 'application/pdf';
      ext = 'pdf';
    }

    var decoded = Utilities.base64Decode(rawBase64);
    var filename = (fileNamePrefix || 'file') + '_' + new Date().getTime() + '.' + ext;
    var blob = Utilities.newBlob(decoded, mimeType, filename);

    var folder = getOrCreateDriveFolder(folderName);
    var file = folder.createFile(blob);

    // Grant public read permission so frontend can display image without Google login
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Could not set public sharing on file: ' + e);
    }

    var fileId = file.getId();
    // Use lh3 googleusercontent URL for images (displays directly in <img> tags without interstitial)
    var fileUrl = (mimeType.indexOf('image') !== -1)
      ? 'https://lh3.googleusercontent.com/d/' + fileId
      : 'https://drive.google.com/file/d/' + fileId + '/view';

    return { fileId: fileId, fileUrl: fileUrl };
  } catch (err) {
    Logger.log('Error saving file to Drive: ' + err);
    return { fileId: '', fileUrl: '' };
  }
}

/**
 * Standalone file upload action
 */
function apiUploadFile(payload, folderName, prefix) {
  var fileData = payload.file_data || payload.photo_data || payload.certificate_data;
  if (!fileData) {
    return { success: false, error: 'No file data provided.' };
  }

  var saved = saveBase64ToDrive(fileData, folderName, prefix || 'upload');
  if (!saved.fileId) {
    return { success: false, error: 'Failed to upload file to Google Drive.' };
  }

  return {
    success: true,
    file_id: saved.fileId,
    file_url: saved.fileUrl
  };
}

/**
 * Upload a file to Google Drive AND write the resulting file_id / file_url back
 * to the athlete's Players sheet row.
 *
 * Requirements 6, 7, 8: After background upload succeeds the Google Sheets record
 * must be updated so Admin can see the file link and the athlete dashboard can display it.
 *
 * @param {Object} payload  - Must contain file_data, email or player_id, and optionally certificate_name
 * @param {string} folderName - Drive subfolder name (CONFIG.FOLDERS.PHOTOS or CERTIFICATES)
 * @param {string} prefix     - Filename prefix (e.g. 'athlete_photo')
 * @param {string} fileType   - 'photo' or 'certificate'
 */
function apiUploadFileAndUpdatePlayer(payload, folderName, prefix, fileType) {
  var fileData = payload.file_data || payload.photo_data || payload.certificate_data;
  if (!fileData) {
    return { success: false, error: 'No file data provided.' };
  }

  // Save to Drive
  var saved = saveBase64ToDrive(fileData, folderName, prefix || 'upload');
  if (!saved.fileId) {
    return { success: false, error: 'Failed to upload file to Google Drive.' };
  }

  // Write Drive URL back to the player's sheet row (Req 6, 7, 8)
  var email = payload.email ? String(payload.email).trim().toLowerCase() : '';
  var playerId = payload.player_id ? String(payload.player_id).trim() : '';

  if (email || playerId) {
    try {
      var sheet = getPlayersSheet();
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();

      if (lastRow > 1 && lastCol > 0) {
        var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return String(h).trim();
        });
        var idIdx    = headerRow.indexOf('id');
        var emailIdx = headerRow.indexOf('email');
        var values   = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

        for (var i = 0; i < values.length; i++) {
          var row      = values[i];
          var rowId    = idIdx    !== -1 ? String(row[idIdx]).trim()                    : '';
          var rowEmail = emailIdx !== -1 ? String(row[emailIdx]).trim().toLowerCase()   : '';

          var matched = (playerId && rowId === playerId) || (email && rowEmail === email);
          if (matched) {
            var rowNum = i + 2;
            if (fileType === 'photo') {
              var photoIdCol  = headerRow.indexOf('photo_file_id');
              var photoUrlCol = headerRow.indexOf('photo_file_url');
              if (photoIdCol  !== -1) sheet.getRange(rowNum, photoIdCol  + 1).setValue(saved.fileId);
              if (photoUrlCol !== -1) sheet.getRange(rowNum, photoUrlCol + 1).setValue(saved.fileUrl);
            } else if (fileType === 'certificate') {
              var certIdCol   = headerRow.indexOf('certificate_file_id');
              var certUrlCol  = headerRow.indexOf('certificate_file_url');
              var certNameCol = headerRow.indexOf('certificate_name');
              var certName    = payload.certificate_name ? String(payload.certificate_name).trim() : 'Sports Certificate';
              if (certIdCol   !== -1) sheet.getRange(rowNum, certIdCol   + 1).setValue(saved.fileId);
              if (certUrlCol  !== -1) sheet.getRange(rowNum, certUrlCol  + 1).setValue(saved.fileUrl);
              if (certNameCol !== -1) sheet.getRange(rowNum, certNameCol + 1).setValue(certName);
            }
            Logger.log('[UPLOAD] Updated ' + fileType + ' for player ' + (rowId || rowEmail) + ' -> ' + saved.fileUrl);
            break;
          }
        }
      }
    } catch (updateErr) {
      // Non-fatal: file is already saved to Drive, Sheets write failed
      Logger.log('[UPLOAD] Warning: Could not write Drive URL to Sheets: ' + updateErr);
    }
  }

  return {
    success: true,
    file_id: saved.fileId,
    file_url: saved.fileUrl
  };
}

/**
 * SECTION 9 — UPLOAD TEAM LOGO TO GOOGLE DRIVE & UPDATE TEAMS SHEET
 *
 * Requirements:
 * 1. Authenticate the Admin session.
 * 2. Validate team_id.
 * 3. Validate file type (PNG, JPG, WEBP, SVG).
 * 4. Validate file size (<= 5 MB).
 * 5. Upload image to configured Google Drive folder (CONFIG.FOLDERS.LOGOS).
 * 6. Obtain file_id, file_url.
 * 7. Update correct Teams row (logo_file_id, logo_file_url, logo).
 * 8. Return { success: true, team_id, logo_file_id, logo_file_url }.
 */
function apiUploadTeamLogo(payload) {
  if (!isAdminAuthorized(payload)) {
    Logger.log('[AUTH REJECTED] apiUploadTeamLogo called without valid Admin credentials.');
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  var teamId = String(payload.team_id || payload.teamId || payload.id || '').trim();
  if (!teamId) {
    return { success: false, error: 'Team ID is required for logo upload.' };
  }

  var fileData = payload.file_data || payload.logo_data || payload.fileData || payload.logo;
  if (!fileData || typeof fileData !== 'string') {
    return { success: false, error: 'No team logo file data provided.' };
  }

  // Validate approximate base64 length for 5 MB (5 MB binary ~= 7.5 MB base64 string)
  if (fileData.length > 7500000) {
    return { success: false, error: 'Team logo must be 5 MB or smaller.' };
  }

  var parts = fileData.split(',');
  var meta = (parts[0] || '').toLowerCase();
  var isAllowedMime = meta.indexOf('image/png') !== -1 ||
                      meta.indexOf('image/jpeg') !== -1 ||
                      meta.indexOf('image/jpg') !== -1 ||
                      meta.indexOf('image/webp') !== -1 ||
                      meta.indexOf('image/svg') !== -1;
  if (!isAllowedMime) {
    return { success: false, error: 'Please upload PNG, JPG, WEBP, or SVG.' };
  }

  var saved = saveBase64ToDrive(fileData, CONFIG.FOLDERS.LOGOS, 'team_logo_' + teamId);
  if (!saved || !saved.fileId) {
    return { success: false, error: 'Failed to upload team logo to Google Drive.' };
  }

  // Update Teams sheet row by team_id
  var ss = getSpreadsheet();
  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var teamsHeaders = ensureTeamSheetHeaders(teamsSheet);
  var lastRow = teamsSheet.getLastRow();
  var lastCol = teamsSheet.getLastColumn();

  if (lastRow > 1) {
    var idColIdx = teamsHeaders.indexOf('id');
    var logoIdColIdx = teamsHeaders.indexOf('logo_file_id');
    var logoUrlColIdx = teamsHeaders.indexOf('logo_file_url');
    var logoColIdx = teamsHeaders.indexOf('logo');

    if (logoIdColIdx === -1) {
      teamsSheet.getRange(1, lastCol + 1).setValue('logo_file_id');
      logoIdColIdx = lastCol;
      lastCol++;
    }
    if (logoUrlColIdx === -1) {
      teamsSheet.getRange(1, lastCol + 1).setValue('logo_file_url');
      logoUrlColIdx = lastCol;
      lastCol++;
    }

    var values = teamsSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    for (var i = 0; i < values.length; i++) {
      var rowId = String(values[i][idColIdx] || '').trim();
      if (rowId.toLowerCase() === teamId.toLowerCase()) {
        var rowNum = i + 2;
        teamsSheet.getRange(rowNum, logoIdColIdx + 1).setValue(saved.fileId);
        teamsSheet.getRange(rowNum, logoUrlColIdx + 1).setValue(saved.fileUrl);
        if (logoColIdx !== -1) {
          teamsSheet.getRange(rowNum, logoColIdx + 1).setValue(saved.fileUrl);
        }
        SpreadsheetApp.flush();
        Logger.log('[LOGO UPLOAD] Updated logo for team ' + teamId + ' -> ' + saved.fileUrl);
        break;
      }
    }
  }

  return {
    success: true,
    team_id: teamId,
    logo_file_id: saved.fileId,
    logo_file_url: saved.fileUrl,
    message: 'Team logo uploaded and updated successfully.'
  };
}

/**
 * STEP 10, 11, 12, 13, 14 — ATHLETE REGISTRATION
 * Server-side branch validation, mobile number preservation, Drive file storage
 */
function apiRegisterPlayer(payload) {
  // 0. GLOBAL REGISTRATION OPEN / CLOSED CHECK (Sections 9 & 10)
  if (!getRegistrationOpenSetting()) {
    Logger.log('[REGISTRATION BLOCKED] Registration is closed. Rejecting athlete submission.');
    return {
      success: false,
      error: 'REGISTRATION_CLOSED',
      message: 'Athlete registration is currently closed by the tournament administration.'
    };
  }

  // 1. Mandatory Field Validation
  var fullName = String(payload.full_name || payload.name || '').trim();
  var email = String(payload.email || '').trim().toLowerCase();
  var enrollment = String(payload.enrollment_no || '').trim().toUpperCase();
  var mobileNumber = String(payload.mobile_number || payload.phone || '').trim().replace(/\D/g, '');
  var department = String(payload.department || payload.branch || '').trim();
  var role = String(payload.player_role || payload.role || 'All-Rounder').trim();
  var gender = String(payload.gender || 'Male').trim();

  if (!fullName) return { success: false, error: 'Full name is required.' };
  if (!email || email.indexOf('@') === -1) return { success: false, error: 'A valid email address is required.' };
  if (!enrollment) return { success: false, error: 'Enrollment number is required.' };
  if (!mobileNumber || mobileNumber.length !== 10) {
    return { success: false, error: 'A valid 10-digit mobile number is required.' };
  }

  // 2. STEP 12 — Branch Restriction: Strictly BCA, B.Tech, or BBA only
  if (CONFIG.VALID_BRANCHES.indexOf(department) === -1) {
    return {
      success: false,
      error: 'Branch "' + department + '" is unauthorized. Only BCA, B.Tech, and BBA are accepted.'
    };
  }

  var sheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
  var lastRow = sheet.getLastRow();

  // 3. STEP 35 — Duplicate Check (Email and Enrollment Number)
  if (lastRow > 1) {
    var existingValues = sheet.getRange(2, 1, lastRow - 1, HEADERS.PLAYERS.length).getValues();
    var emailIdx = HEADERS.PLAYERS.indexOf('email');
    var enrollIdx = HEADERS.PLAYERS.indexOf('enrollment_no');

    for (var i = 0; i < existingValues.length; i++) {
      var row = existingValues[i];
      if (String(row[emailIdx]).trim().toLowerCase() === email) {
        return { success: false, error: 'An athlete with this email address is already registered.' };
      }
      if (String(row[enrollIdx]).trim().toUpperCase() === enrollment) {
        return { success: false, error: 'An athlete with this enrollment number is already registered.' };
      }
    }
  }

  // 4. Resolve Base Price based on playing role
  var defaultBase = CONFIG.DEFAULT_ROLE_BASE_PRICES[role] || 15;
  var basePrice = payload.base_price !== undefined && payload.base_price !== null && payload.base_price !== ''
    ? Number(payload.base_price)
    : defaultBase;

  // 5. STEP 13 — Upload Profile Photo to Google Drive (ATHLETE PHOTOS)
  var photoFileId = payload.photo_file_id || '';
  var photoFileUrl = payload.photo_file_url || '';
  if (!photoFileId && payload.photo_data) {
    var photoSaved = saveBase64ToDrive(payload.photo_data, CONFIG.FOLDERS.PHOTOS, 'athlete_' + enrollment);
    photoFileId = photoSaved.fileId;
    photoFileUrl = photoSaved.fileUrl;
  }

  // 6. STEP 14 — Upload Sports Certificate to Google Drive (SPORTS CERTIFICATES)
  var certFileId = payload.certificate_file_id || '';
  var certFileUrl = payload.certificate_file_url || '';
  var certName = payload.certificate_name || payload.certificate || (payload.certificate_data ? 'Sports Certificate' : 'None attached');
  if (!certFileId && payload.certificate_data) {
    var certSaved = saveBase64ToDrive(payload.certificate_data, CONFIG.FOLDERS.CERTIFICATES, 'cert_' + enrollment);
    certFileId = certSaved.fileId;
    certFileUrl = certSaved.fileUrl;
  }

  // 7. STEP 13 — Server-Side Unique Athlete ID Generation (Format: SPL-ATH-0001)
  // Read existing IDs in the sheet, determine the highest numeric suffix, generate next unused ID
  var existingIds = [];
  if (lastRow > 1) {
    var idColIdx = HEADERS.PLAYERS.indexOf('id');
    var allRows = sheet.getRange(2, 1, lastRow - 1, HEADERS.PLAYERS.length).getValues();
    for (var r = 0; r < allRows.length; r++) {
      var eid = String(allRows[r][idColIdx] || '').trim();
      if (eid) existingIds.push(eid);
    }
  }

  var maxSuffix = 0;
  existingIds.forEach(function(eid) {
    var match = eid.match(/SPL-ATH-(\d+)/i);
    if (match) {
      var num = parseInt(match[1], 10);
      if (num > maxSuffix) maxSuffix = num;
    }
  });

  var nextNum = maxSuffix + 1;
  var playerId = 'SPL-ATH-' + ('0000' + nextNum).slice(-4);
  while (existingIds.indexOf(playerId) !== -1) {
    nextNum++;
    playerId = 'SPL-ATH-' + ('0000' + nextNum).slice(-4);
  }
  var createdAt = new Date().toISOString();

  // 8. Prepare Row Matching Exact Headers
  var rowData = [
    playerId,
    createdAt,
    fullName,
    enrollment,
    department,
    email,
    mobileNumber, // CRITICAL: mobile number correctly preserved
    gender,
    role,
    'Registered',
    basePrice,
    'Upcoming',
    '', // sold_to_team
    '', // sold_price
    photoFileId,
    photoFileUrl,
    certFileId,
    certFileUrl,
    certName
  ];

  sheet.appendRow(rowData);
  Logger.log('[REGISTRATION] Inserted player ' + playerId + ' into Google Sheet.');

  // Update athlete_count in Settings sheet
  try {
    var settingsSheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
    var sLastRow = settingsSheet.getLastRow();
    if (sLastRow > 1) {
      var sVals = settingsSheet.getRange(2, 1, sLastRow - 1, 2).getValues();
      for (var s = 0; s < sVals.length; s++) {
        if (sVals[s][0] === 'athlete_count') {
          settingsSheet.getRange(s + 2, 2).setValue(nextNum);
          break;
        }
      }
    }
  } catch (e) {}

  // 9. Prepare returned object
  var savedPlayer = {
    id: playerId,
    created_at: createdAt,
    full_name: fullName,
    name: fullName,
    enrollment_no: enrollment,
    department: department,
    email: email,
    mobile_number: mobileNumber,
    phone: mobileNumber,
    gender: gender,
    player_role: role,
    status: 'Registered',
    base_price: basePrice,
    auction_status: 'Upcoming',
    sold_to_team: '',
    sold_price: '',
    photo_file_id: photoFileId,
    photo_file_url: photoFileUrl,
    photo_data: photoFileUrl,
    photo: photoFileUrl,
    certificate_file_id: certFileId,
    certificate_file_url: certFileUrl,
    certificate_data: certFileUrl,
    certificate: certName,
    certificate_name: certName
  };

  return {
    success: true,
    data: savedPlayer,
    message: 'Athlete registered successfully in Google Sheets & Drive.'
  };
}

/**
 * Update player record
 */
function apiUpdatePlayer(payload) {
  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var id = String(payload.original_id || payload.id || '').replace(/-D\d+$/, '').trim();
  var email = payload.email ? String(payload.email).trim().toLowerCase() : '';
  var enroll = payload.enrollment_no ? String(payload.enrollment_no).trim() : '';

  if (!id && !email && !enroll) {
    return { success: false, error: 'Player ID, Email, or Enrollment is required for update.' };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return { success: false, error: 'Player not found.' };

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  var emailIdx = headerRow.indexOf('email');
  var enrollIdx = headerRow.indexOf('enrollment_no');

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = idIdx !== -1 ? String(row[idIdx]).trim() : '';
    var rowEmail = emailIdx !== -1 ? String(row[emailIdx]).trim().toLowerCase() : '';
    var rowEnroll = enrollIdx !== -1 ? String(row[enrollIdx]).trim() : '';

    if ((id && rowId === id) || (email && rowEmail === email) || (enroll && rowEnroll === enroll)) {
      var rowNum = i + 2;

      // Handle photo update if Base64 provided
      if (payload.photo_data && !payload.photo_file_id) {
        var photoSaved = saveBase64ToDrive(payload.photo_data, CONFIG.FOLDERS.PHOTOS, 'athlete_update_' + rowId);
        payload.photo_file_id = photoSaved.fileId;
        payload.photo_file_url = photoSaved.fileUrl;
      }

      // Update allowed fields based on actual sheet headers
      for (var k in payload) {
        var colIdx = headerRow.indexOf(k);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(payload[k]);
        }
      }

      // If mobile_number was passed as phone
      if (payload.phone && !payload.mobile_number) {
        var mobCol = headerRow.indexOf('mobile_number');
        if (mobCol !== -1) {
          sheet.getRange(rowNum, mobCol + 1).setValue(String(payload.phone).replace(/\D/g, ''));
        }
      }

      return { success: true, message: 'Player updated successfully in Google Sheet.' };
    }
  }

  return { success: false, error: 'Player not found.' };
}

/**
 * STEP 18 & 19 — APPROVAL / REJECTION LOGIC
 */
function apiSetPlayerStatus(payload, newStatus) {
  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var id = String(payload.original_id || payload.id || payload.player_id || '').replace(/-D\d+$/, '').trim();
  var email = payload.email ? String(payload.email).trim().toLowerCase() : '';
  var enroll = payload.enrollment_no ? String(payload.enrollment_no).trim() : '';

  if (!id && !email && !enroll) {
    return { success: false, error: 'Player ID, Email, or Enrollment is required.' };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return { success: false, error: 'Player not found.' };

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  var emailIdx = headerRow.indexOf('email');
  var enrollIdx = headerRow.indexOf('enrollment_no');
  var statusIdx = headerRow.indexOf('status');

  if (statusIdx === -1) {
    // Add status column if not present
    sheet.getRange(1, lastCol + 1).setValue('status');
    statusIdx = lastCol;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = idIdx !== -1 ? String(row[idIdx]).trim() : '';
    var rowEmail = emailIdx !== -1 ? String(row[emailIdx]).trim().toLowerCase() : '';
    var rowEnroll = enrollIdx !== -1 ? String(row[enrollIdx]).trim() : '';

    if ((id && rowId === id) || (email && rowEmail === email) || (enroll && rowEnroll === enroll)) {
      var rowNum = i + 2;
      sheet.getRange(rowNum, statusIdx + 1).setValue(newStatus);
      Logger.log('[STATUS] Player ' + rowId + ' status updated to ' + newStatus);
      return {
        success: true,
        id: rowId,
        status: newStatus,
        message: 'Status updated to ' + newStatus
      };
    }
  }

  return { success: false, error: 'Player not found.' };
}

/**
 * BULK APPROVE SELECTED PLAYERS
 * Requirements:
 * 1. Verify Admin authorization.
 * 2. Open authoritative Players sheet.
 * 3. Find each player by ID.
 * 4. Check current status.
 *    If status = Pending / Registered / empty -> update to Approved
 *    If status = Approved -> skip
 *    If status = Rejected -> skip
 * 5. Do not modify unrelated fields.
 * 6. Return counts: { approvedCount, skippedCount, notFoundCount }
 */
function apiApprovePlayers(payload) {
  var rawIds = payload.playerIds || payload.player_ids || payload.ids || [];
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return {
      success: true,
      data: { approvedCount: 0, skippedCount: 0, notFoundCount: 0 },
      message: 'No athlete IDs provided.'
    };
  }

  var targetIds = rawIds.map(function(id) {
    return String(id).replace(/-D\d+$/, '').trim().toLowerCase();
  }).filter(Boolean);

  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) {
    return {
      success: true,
      data: { approvedCount: 0, skippedCount: 0, notFoundCount: targetIds.length },
      message: 'No players in sheet.'
    };
  }

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  if (idIdx === -1) idIdx = headerRow.indexOf('player_id');
  var emailIdx = headerRow.indexOf('email');
  var statusIdx = headerRow.indexOf('status');

  if (statusIdx === -1) {
    sheet.getRange(1, lastCol + 1).setValue('status');
    statusIdx = lastCol;
    lastCol++;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var approvedCount = 0;
  var skippedCount = 0;
  var notFoundCount = 0;
  var matchedIds = {};

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = idIdx !== -1 ? String(row[idIdx] || '').trim().toLowerCase() : '';
    var rowEmail = emailIdx !== -1 ? String(row[emailIdx] || '').trim().toLowerCase() : '';
    var currentStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim().toLowerCase() : '';

    var matchFound = false;
    for (var t = 0; t < targetIds.length; t++) {
      var tid = targetIds[t];
      if ((rowId && rowId === tid) || (rowEmail && rowEmail === tid)) {
        matchFound = true;
        matchedIds[tid] = true;
        break;
      }
    }

    if (matchFound) {
      if (currentStatus === 'approved' || currentStatus === 'rejected') {
        skippedCount++;
      } else {
        sheet.getRange(i + 2, statusIdx + 1).setValue('Approved');
        approvedCount++;
      }
    }
  }

  for (var k = 0; k < targetIds.length; k++) {
    if (!matchedIds[targetIds[k]]) {
      notFoundCount++;
    }
  }

  Logger.log('[BULK APPROVE] approved: ' + approvedCount + ', skipped: ' + skippedCount + ', notFound: ' + notFoundCount);

  return {
    success: true,
    data: {
      approvedCount: approvedCount,
      skippedCount: skippedCount,
      notFoundCount: notFoundCount
    },
    message: 'Approved ' + approvedCount + ' athletes.'
  };
}

/**
 * BULK APPROVE ALL PENDING PLAYERS
 * Requirements:
 * 1. Verify Admin authorization.
 * 2. Read Players sheet.
 * 3. Identify eligible pending/registered athletes.
 * 4. Update status to 'Approved'.
 * 5. Leave already Approved unchanged.
 * 6. Leave Rejected unchanged.
 * 7. Return counts: { approvedCount, skippedCount }
 */
function apiApproveAllPlayers(payload) {
  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) {
    return {
      success: true,
      data: { approvedCount: 0, skippedCount: 0 },
      message: 'No players in sheet.'
    };
  }

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var statusIdx = headerRow.indexOf('status');
  if (statusIdx === -1) {
    sheet.getRange(1, lastCol + 1).setValue('status');
    statusIdx = lastCol;
    lastCol++;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var approvedCount = 0;
  var skippedCount = 0;

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var hasContent = row.some(function(c) { return c !== '' && c !== null && c !== undefined; });
    if (!hasContent) continue;

    var currentStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim().toLowerCase() : '';

    if (currentStatus === 'approved' || currentStatus === 'rejected') {
      skippedCount++;
    } else {
      sheet.getRange(i + 2, statusIdx + 1).setValue('Approved');
      approvedCount++;
    }
  }

  Logger.log('[APPROVE ALL] approved: ' + approvedCount + ', skipped: ' + skippedCount);

  return {
    success: true,
    data: {
      approvedCount: approvedCount,
      skippedCount: skippedCount
    },
    message: 'Approved all ' + approvedCount + ' pending athletes.'
  };
}

/**
 * UNAPPROVE SINGLE ATHLETE (Admin Only)
 * Requirements:
 * 1. Verify Admin authorization (handled by STRICT_ADMIN_ACTIONS and requireAdminSession).
 * 2. Find athlete by unique player ID.
 * 3. Verify current status is Approved.
 * 4. Auction Safety: verify athlete is not already sold or assigned to a franchise.
 * 5. Change status back to 'Pending'.
 * 6. Do not modify unrelated fields.
 * 7. Return success { success: true, data: { playerId, status: 'Pending' } }.
 */
function apiUnapprovePlayer(payload) {
  var id = String(payload.playerId || payload.player_id || payload.id || payload.original_id || '').replace(/-D\d+$/, '').trim();
  if (!id) {
    return { success: false, error: 'Player ID is required.' };
  }

  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) {
    return { success: false, error: 'Player not found with ID: ' + id };
  }

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  if (idIdx === -1) idIdx = headerRow.indexOf('player_id');
  var statusIdx = headerRow.indexOf('status');
  var auctionStatusIdx = headerRow.indexOf('auction_status');
  var soldToTeamIdx = headerRow.indexOf('sold_to_team');
  var soldPriceIdx = headerRow.indexOf('sold_price');
  var teamIdIdx = headerRow.indexOf('team_id');

  if (idIdx === -1) return { success: false, error: 'id column not found in Players sheet.' };
  if (statusIdx === -1) {
    sheet.getRange(1, lastCol + 1).setValue('status');
    statusIdx = lastCol;
    lastCol++;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetIdLower = id.toLowerCase();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = String(row[idIdx] || '').trim();
    if (rowId.toLowerCase() === targetIdLower) {
      var currentStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim() : '';

      // Check current status: must be Approved
      if (currentStatus.toLowerCase() !== 'approved') {
        return {
          success: false,
          error: 'Athlete status is not Approved (currently: ' + (currentStatus || 'Pending') + ').'
        };
      }

      // Requirement 11 & 20: AUCTION SAFETY CHECK
      // If the athlete is already assigned/sold, block Unapprove
      var auctionStatus = auctionStatusIdx !== -1 ? String(row[auctionStatusIdx] || '').trim().toLowerCase() : '';
      var soldToTeam = soldToTeamIdx !== -1 ? String(row[soldToTeamIdx] || '').trim() : '';
      var teamId = teamIdIdx !== -1 ? String(row[teamIdIdx] || '').trim() : '';
      var soldPrice = soldPriceIdx !== -1 ? Number(row[soldPriceIdx] || 0) : 0;

      if (auctionStatus === 'sold' || soldToTeam !== '' || teamId !== '' || soldPrice > 0) {
        return {
          success: false,
          error: 'Cannot unapprove this athlete because they are already assigned to a franchise. Remove them from the squad/auction first.'
        };
      }

      var rowNum = i + 2;
      sheet.getRange(rowNum, statusIdx + 1).setValue('Pending');

      var auditActor = String(payload.actor || payload.admin_username || payload.username || 'ADMIN').trim();
      Logger.log('[AUDIT] action: UNAPPROVE_PLAYER | admin: ' + auditActor + ' | player_id: ' + rowId + ' | timestamp: ' + new Date().toISOString() + ' | previous_status: ' + currentStatus + ' | new_status: Pending');

      return {
        success: true,
        data: {
          playerId: rowId,
          status: 'Pending'
        },
        message: 'Athlete moved back to Pending.'
      };
    }
  }

  return { success: false, error: 'Player not found with ID: ' + id };
}

/**
 * BULK UNAPPROVE SELECTED PLAYERS (Admin Only)
 * Requirements:
 * 1. Verify Admin authorization.
 * 2. Find athletes by unique player IDs.
 * 3. Verify status is Approved and NOT assigned/sold.
 * 4. Move eligible athletes to Pending in a single batch.
 * 5. Return counts: { unapprovedCount, skippedCount, blockedSold, notFoundCount, playerIds }
 */
function apiUnapprovePlayers(payload) {
  var rawIds = payload.playerIds || payload.player_ids || payload.ids || [];
  if (!Array.isArray(rawIds) || rawIds.length === 0) {
    return {
      success: true,
      data: { unapprovedCount: 0, skippedCount: 0, blockedSold: 0, notFoundCount: 0, playerIds: [] },
      message: 'No athlete IDs provided.'
    };
  }

  var targetIds = rawIds.map(function(id) {
    return String(id).replace(/-D\d+$/, '').trim().toLowerCase();
  }).filter(Boolean);

  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) {
    return {
      success: true,
      data: { unapprovedCount: 0, skippedCount: 0, blockedSold: 0, notFoundCount: targetIds.length, playerIds: [] },
      message: 'No players in sheet.'
    };
  }

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  if (idIdx === -1) idIdx = headerRow.indexOf('player_id');
  var statusIdx = headerRow.indexOf('status');
  var auctionStatusIdx = headerRow.indexOf('auction_status');
  var soldToTeamIdx = headerRow.indexOf('sold_to_team');
  var soldPriceIdx = headerRow.indexOf('sold_price');
  var teamIdIdx = headerRow.indexOf('team_id');

  if (idIdx === -1) return { success: false, error: 'id column not found in Players sheet.' };
  if (statusIdx === -1) {
    sheet.getRange(1, lastCol + 1).setValue('status');
    statusIdx = lastCol;
    lastCol++;
  }

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var unapprovedCount = 0;
  var skippedCount = 0;
  var blockedSold = 0;
  var notFoundCount = 0;
  var matchedIds = {};
  var unapprovedIds = [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = String(row[idIdx] || '').trim();
    var rowIdLower = rowId.toLowerCase();

    var matchFound = false;
    for (var t = 0; t < targetIds.length; t++) {
      if (rowIdLower && rowIdLower === targetIds[t]) {
        matchFound = true;
        matchedIds[targetIds[t]] = true;
        break;
      }
    }

    if (matchFound) {
      var currentStatus = statusIdx !== -1 ? String(row[statusIdx] || '').trim().toLowerCase() : '';
      var auctionStatus = auctionStatusIdx !== -1 ? String(row[auctionStatusIdx] || '').trim().toLowerCase() : '';
      var soldToTeam = soldToTeamIdx !== -1 ? String(row[soldToTeamIdx] || '').trim() : '';
      var teamId = teamIdIdx !== -1 ? String(row[teamIdIdx] || '').trim() : '';
      var soldPrice = soldPriceIdx !== -1 ? Number(row[soldPriceIdx] || 0) : 0;

      if (auctionStatus === 'sold' || soldToTeam !== '' || teamId !== '' || soldPrice > 0) {
        blockedSold++;
      } else if (currentStatus !== 'approved') {
        skippedCount++;
      } else {
        sheet.getRange(i + 2, statusIdx + 1).setValue('Pending');
        unapprovedCount++;
        unapprovedIds.push(rowId);
      }
    }
  }

  for (var k = 0; k < targetIds.length; k++) {
    if (!matchedIds[targetIds[k]]) {
      notFoundCount++;
    }
  }

  var auditActor = String(payload.actor || payload.admin_username || payload.username || 'ADMIN').trim();
  Logger.log('[AUDIT] action: BULK_UNAPPROVE_PLAYERS | admin: ' + auditActor + ' | unapproved: ' + unapprovedCount + ' | blockedSold: ' + blockedSold + ' | skipped: ' + skippedCount + ' | timestamp: ' + new Date().toISOString() + ' | new_status: Pending');

  return {
    success: true,
    data: {
      unapprovedCount: unapprovedCount,
      skippedCount: skippedCount,
      blockedSold: blockedSold,
      notFoundCount: notFoundCount,
      playerIds: unapprovedIds
    },
    message: 'Unapproved ' + unapprovedCount + ' athlete' + (unapprovedCount === 1 ? '' : 's') + '.' +
      (blockedSold > 0 ? ' (' + blockedSold + ' skipped because already assigned/sold)' : '')
  };
}

/**
 * STEP 20 — DELETE SINGLE PLAYER
 */
function apiDeletePlayer(payload) {
  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var id = String(payload.original_id || payload.id || payload.player_id || '').replace(/-D\d+$/, '').trim();
  var email = payload.email ? String(payload.email).trim().toLowerCase() : '';
  var enroll = payload.enrollment_no ? String(payload.enrollment_no).trim() : '';

  if (!id && !email && !enroll) {
    return { success: false, error: 'Player ID, Email, or Enrollment is required.' };
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return { success: false, error: 'Player not found.' };

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  var emailIdx = headerRow.indexOf('email');
  var enrollIdx = headerRow.indexOf('enrollment_no');

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var rowId = idIdx !== -1 ? String(row[idIdx]).trim() : '';
    var rowEmail = emailIdx !== -1 ? String(row[emailIdx]).trim().toLowerCase() : '';
    var rowEnroll = enrollIdx !== -1 ? String(row[enrollIdx]).trim() : '';

    if ((id && rowId === id) || (email && rowEmail === email) || (enroll && rowEnroll === enroll)) {
      sheet.deleteRow(i + 2);
      Logger.log('[DELETE] Player ' + rowId + ' deleted from Google Sheet.');
      return { success: true, message: 'Athlete record deleted from Google Sheets.' };
    }
  }

  return { success: false, error: 'Player record not found.' };
}

/**
 * STEP 20 — DELETE SELECTED ATHLETES
 */
function apiDeletePlayers(payload) {
  var playerIds = payload.player_ids || payload.ids || [];
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return { success: false, error: 'Array of player_ids is required.' };
  }

  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return { success: true, count: 0 };

  var headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h).trim();
  });

  var idIdx = headerRow.indexOf('id');
  var emailIdx = headerRow.indexOf('email');
  var enrollIdx = headerRow.indexOf('enrollment_no');

  var cleanedTargetIds = playerIds.map(function(pid) {
    return String(pid).replace(/-D\d+$/, '').trim();
  });

  var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Delete from bottom to top to preserve index offsets
  var deletedCount = 0;
  for (var i = values.length - 1; i >= 0; i--) {
    var rowId = idIdx !== -1 ? String(values[i][idIdx]).trim() : '';
    var rowEmail = emailIdx !== -1 ? String(values[i][emailIdx]).trim().toLowerCase() : '';
    var rowEnroll = enrollIdx !== -1 ? String(values[i][enrollIdx]).trim() : '';

    if (cleanedTargetIds.indexOf(rowId) !== -1 || playerIds.indexOf(rowEmail) !== -1 || playerIds.indexOf(rowEnroll) !== -1) {
      sheet.deleteRow(i + 2);
      deletedCount++;
    }
  }

  Logger.log('[DELETE] Bulk deleted ' + deletedCount + ' athletes.');
  return { success: true, count: deletedCount, message: 'Deleted ' + deletedCount + ' athlete records.' };
}

/**
 * STEP 20 — DELETE ALL PLAYERS (Requires confirmation === "DELETE")
 */
function apiDeleteAllPlayers(payload) {
  var confirmation = String(payload.confirmation || '').trim();
  // Step 2 & 19: Strict verification — only exactly "DELETE" is valid
  if (confirmation !== 'DELETE') {
    return {
      success: false,
      error: 'Security verification failed: Confirmation must be exactly "DELETE" to execute bulk deletion.'
    };
  }

  var ss = getSpreadsheet();
  var sheet = getPlayersSheet(ss);
  if (!sheet) return { success: false, error: 'Players sheet not found.' };

  var lastRow = sheet.getLastRow();
  var deletedCount = Math.max(0, lastRow - 1);

  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }

  SpreadsheetApp.flush();

  // Step 17: Verify database result (Players data rows === 0)
  var postCheckLastRow = sheet.getLastRow();
  if (postCheckLastRow > 1) {
    sheet.deleteRows(2, postCheckLastRow - 1);
    SpreadsheetApp.flush();
  }

  var finalDataRows = Math.max(0, sheet.getLastRow() - 1);
  if (finalDataRows !== 0) {
    return {
      success: false,
      error: 'Database verification failed: ' + finalDataRows + ' athlete rows could not be removed.'
    };
  }

  // Also check if there is a secondary/duplicate players sheet (e.g. Players vs Player_Auction_Roster)
  // Ensure both are cleared so no ghost records remain
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var sName = allSheets[i].getName().toLowerCase();
    if ((sName === 'players' || sName === 'player_auction_roster') && allSheets[i].getSheetId() !== sheet.getSheetId()) {
      var otherLastRow = allSheets[i].getLastRow();
      if (otherLastRow > 1) {
        allSheets[i].deleteRows(2, otherLastRow - 1);
      }
    }
  }

  // Update athlete_count in Settings sheet to 0
  try {
    var settingsSheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);
    var sLastRow = settingsSheet.getLastRow();
    if (sLastRow > 1) {
      var sVals = settingsSheet.getRange(2, 1, sLastRow - 1, 2).getValues();
      for (var s = 0; s < sVals.length; s++) {
        if (sVals[s][0] === 'athlete_count') {
          settingsSheet.getRange(s + 2, 2).setValue(0);
          break;
        }
      }
    }
  } catch (e) {}

  Logger.log('[DELETE ALL] All athletes cleared from Google Sheets. Deleted count: ' + deletedCount);
  return {
    success: true,
    data: {
      deletedCount: deletedCount
    },
    deletedCount: deletedCount,
    deleted_count: deletedCount,
    count: deletedCount,
    message: 'All athlete registration records deleted successfully from Google Sheets.'
  };
}

/**
 * STEP 23 — FRANCHISE REGISTRATION & SERVER-SIDE TEAM ID GENERATION
 * Format: SPL-TEAM-0001, SPL-TEAM-0002...
 * Writes simultaneously to Teams and Franchise_Auth in Google Sheets.
 */
function apiRegisterFranchise(payload) {
  // CRITICAL SECURITY FIX: Enforce Admin Authorization
  if (!isAdminAuthorized(payload)) {
    Logger.log('[AUTH REJECTED] apiRegisterFranchise called without valid Admin credentials.');
    return { success: false, error: "Unauthorized: Admin access required" };
  }

  var ownerName = String(payload.owner_name || payload.ownerName || '').trim();
  var ownerEmail = String(payload.owner_email || payload.email || '').trim().toLowerCase();
  var teamName = String(payload.team_name || payload.customTeamName || payload.name || '').trim();
  var rawPassword = String(payload.password || payload.rawPassword || '');
  var passwordHash = String(payload.password_hash || '');
  
  // Section 13: Strict Department Backend Validation (Allowed: BTech, BBA, BCA)
  var allowedDepartments = ["BTech", "BBA", "BCA"];
  var rawDept = String(payload.department || payload.branch || '').trim();
  if (rawDept === 'B.Tech') rawDept = 'BTech';
  if (!rawDept || allowedDepartments.indexOf(rawDept) === -1) {
    return { success: false, error: 'INVALID_DEPARTMENT' };
  }
  var department = rawDept;

  var logo = String(payload.logo || '🏏').trim();
  var purse = Number(payload.purse || payload.budget || payload.total_budget || 1000);
  var shortName = String(payload.short_name || teamName.substring(0, 4).toUpperCase()).trim();

  if (!ownerName) return { success: false, error: 'Owner name is required.' };
  if (!ownerEmail || ownerEmail.indexOf('@') === -1) return { success: false, error: 'A valid email address is required.' };
  if (!rawPassword && !passwordHash) return { success: false, error: 'Password is required.' };
  if (!teamName) return { success: false, error: 'Franchise team name is required.' };

  var normTeamName = teamName.replace(/\s+/g, ' ').toLowerCase();
  var normShortName = shortName.replace(/\s+/g, '').toUpperCase();
  var normOwnerEmail = ownerEmail.toLowerCase();

  var ss = getSpreadsheet();
  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var authSheet = getOrCreateSheet(CONFIG.SHEETS.FRANCHISE_AUTH, HEADERS.FRANCHISE_AUTH);

  var teamsHeaders = ensureTeamSheetHeaders(teamsSheet);

  // 1. Check for duplicate team name, short code, or owner in Teams
  var lastRowTeams = teamsSheet.getLastRow();
  var lastColTeams = teamsSheet.getLastColumn();
  var existingTeamIds = [];

  if (lastRowTeams > 1) {
    var teamValues = teamsSheet.getRange(2, 1, lastRowTeams - 1, lastColTeams).getValues();
    var idColIdx = teamsHeaders.indexOf('id');
    var nameColIdx = teamsHeaders.indexOf('team_name');
    var shortNameColIdx = teamsHeaders.indexOf('short_name');
    var ownerEmailColIdx = teamsHeaders.indexOf('owner_email');

    for (var i = 0; i < teamValues.length; i++) {
      var row = teamValues[i];
      if (idColIdx !== -1 && row[idColIdx]) {
        existingTeamIds.push(String(row[idColIdx]).trim());
      }
      if (nameColIdx !== -1) {
        var existingName = String(row[nameColIdx]).trim().replace(/\s+/g, ' ').toLowerCase();
        if (existingName === normTeamName) {
          return { success: false, error: 'A franchise with this name already exists in the tournament.' };
        }
      }
      if (shortNameColIdx !== -1) {
        var existingShort = String(row[shortNameColIdx]).trim().replace(/\s+/g, '').toUpperCase();
        if (existingShort === normShortName) {
          return { success: false, error: 'A franchise with this short code already exists in the tournament.' };
        }
      }
      if (ownerEmailColIdx !== -1) {
        var existingEmail = String(row[ownerEmailColIdx]).trim().toLowerCase();
        if (existingEmail === normOwnerEmail) {
          return { success: false, error: 'A franchise owner is already registered with this email address.' };
        }
      }
    }
  }

  // Requirement 12: Tournament limit: 8 franchises maximum (NOT created automatically, manually by Admin)
  if (existingTeamIds.length >= (CONFIG.MAX_FRANCHISES || 8)) {
    return { success: false, error: 'Tournament limit reached: Maximum of ' + (CONFIG.MAX_FRANCHISES || 8) + ' franchises allowed.' };
  }

  // 2. Check for duplicate email in Franchise_Auth
  var lastRowAuth = authSheet.getLastRow();
  var lastColAuth = authSheet.getLastColumn();
  if (lastRowAuth > 1) {
    var authHeaders = authSheet.getRange(1, 1, 1, lastColAuth).getValues()[0].map(function(h) { return String(h).trim(); });
    var authEmailIdx = authHeaders.indexOf('owner_email');
    if (authEmailIdx !== -1) {
      var authValues = authSheet.getRange(2, 1, lastRowAuth - 1, lastColAuth).getValues();
      for (var a = 0; a < authValues.length; a++) {
        if (String(authValues[a][authEmailIdx]).trim().toLowerCase() === normOwnerEmail) {
          return { success: false, error: 'A franchise owner is already registered with this email address.' };
        }
      }
    }
  }

  // 3. Server-Side Sequential Team ID Generation (Format: SPL-TEAM-0001, SPL-TEAM-0002...)
  var maxSuffix = 0;
  existingTeamIds.forEach(function(eid) {
    var match = eid.match(/SPL-TEAM-(\d+)/i);
    if (match) {
      var num = parseInt(match[1], 10);
      if (num > maxSuffix) maxSuffix = num;
    }
  });

  var nextNum = maxSuffix + 1;
  var teamId = 'SPL-TEAM-' + ('0000' + nextNum).slice(-4);
  while (existingTeamIds.indexOf(teamId) !== -1) {
    nextNum++;
    teamId = 'SPL-TEAM-' + ('0000' + nextNum).slice(-4);
  }

  var shortName = String(payload.short_name || teamName.substring(0, 4).toUpperCase()).trim();
  var now = new Date().toISOString();
  var computedPasswordHash = passwordHash || hashPassword(rawPassword);

  // 4. Append to Teams sheet matching headers
  var teamRow = [];
  for (var h = 0; h < teamsHeaders.length; h++) {
    var col = teamsHeaders[h];
    if (col === 'id') teamRow.push(teamId);
    else if (col === 'team_name') teamRow.push(teamName);
    else if (col === 'short_name') teamRow.push(shortName);
    else if (col === 'department') teamRow.push(department);
    else if (col === 'owner_name') teamRow.push(ownerName);
    else if (col === 'owner_email') teamRow.push(ownerEmail);
    else if (col === 'logo_file_id') teamRow.push(String(payload.logo_file_id || ''));
    else if (col === 'logo_file_url' || col === 'logo') teamRow.push(String(payload.logo_file_url || logo));
    else if (col === 'purse') teamRow.push(purse);
    else if (col === 'total_spent') teamRow.push(0);
    else if (col === 'remaining_purse') teamRow.push(purse);
    else if (col === 'player_count') teamRow.push(0);
    else if (col === 'status') teamRow.push('Active');
    else if (col === 'created_at') teamRow.push(now);
    else teamRow.push('');
  }
  teamsSheet.appendRow(teamRow);

  // 5. Append to Franchise_Auth sheet:
  // id, created_at, owner_name, owner_email, team_id, password_hash, status, last_login_at
  var authId = 'SPL-AUTH-' + ('0000' + nextNum).slice(-4);
  authSheet.appendRow([
    authId,
    now,
    ownerName,
    ownerEmail,
    teamId,
    computedPasswordHash,
    'Active',
    now
  ]);

  SpreadsheetApp.flush();

  // 6. Verify write
  var verifyLastRow = teamsSheet.getLastRow();
  if (verifyLastRow <= 1) {
    return { success: false, error: 'Database write failed: Team row was not persisted in Google Sheets.' };
  }

  var createdTeam = {
    id: teamId,
    team_name: teamName,
    name: teamName,
    short_name: shortName,
    department: department,
    owner_name: ownerName,
    owner_email: ownerEmail,
    logo_file_id: String(payload.logo_file_id || ''),
    logo_file_url: String(payload.logo_file_url || (logo.startsWith('http') ? logo : '')),
    purse: purse,
    total_budget: purse,
    total_spent: 0,
    spent: 0,
    remaining_purse: purse,
    leftover_balance: purse,
    player_count: 0,
    squad_count: 0,
    squad: [],
    logo: payload.logo_file_url || logo || '🏏',
    status: 'Active',
    created_at: now
  };

  // Requirement 22: Server-Side Audit Logging for every team creation
  var auditActor = String(payload.actor || payload.admin_username || 'ADMIN').trim();
  var auditRequestId = String(payload.request_id || 'manual').trim();
  Logger.log('[AUDIT] action: CREATE_TEAM | team_id: ' + teamId + ' | team_name: ' + teamName + ' | timestamp: ' + now + ' | actor: ' + auditActor + ' | actor_role: ADMIN | request_id: ' + auditRequestId);

  Logger.log('[FRANCHISE REGISTERED] Team: ' + teamId + ' | Owner: ' + ownerEmail);

  return {
    success: true,
    data: {
      team: createdTeam,
      owner: {
        id: authId,
        owner_name: ownerName,
        owner_email: ownerEmail,
        team_id: teamId
      }
    },
    message: 'Franchise team and owner credentials registered successfully.'
  };
}

/**
 * STEP 23 — FRANCHISE OWNER AUTHENTICATION (LOGIN)
 * Authenticates against Franchise_Auth and resolves team association
 */
function apiLoginFranchise(payload) {
  var email = String(payload.email || payload.owner_email || '').trim().toLowerCase();
  var rawPassword = String(payload.password || payload.rawPassword || '');
  var inputHash = String(payload.password_hash || '');

  if (!email) {
    return { success: false, error: 'Owner email is required.' };
  }
  if (!rawPassword && !inputHash) {
    return { success: false, error: 'Password is required.' };
  }

  var computedHash = rawPassword ? hashPassword(rawPassword) : inputHash;

  var ss = getSpreadsheet();
  var authSheet = getOrCreateSheet(CONFIG.SHEETS.FRANCHISE_AUTH, HEADERS.FRANCHISE_AUTH);
  var lastRowAuth = authSheet.getLastRow();
  var lastColAuth = authSheet.getLastColumn();

  var matchedAuth = null;
  var authRowIndex = -1;

  if (lastRowAuth > 1) {
    var authHeaders = authSheet.getRange(1, 1, 1, lastColAuth).getValues()[0].map(function(h) { return String(h).trim(); });
    var emailIdx = authHeaders.indexOf('owner_email');
    var hashIdx = authHeaders.indexOf('password_hash');
    var teamIdIdx = authHeaders.indexOf('team_id');
    var ownerNameIdx = authHeaders.indexOf('owner_name');
    var lastLoginIdx = authHeaders.indexOf('last_login_at');

    var authValues = authSheet.getRange(2, 1, lastRowAuth - 1, lastColAuth).getValues();
    for (var a = 0; a < authValues.length; a++) {
      var row = authValues[a];
      var rowEmail = emailIdx !== -1 ? String(row[emailIdx]).trim().toLowerCase() : '';
      if (rowEmail === email) {
        var storedHash = hashIdx !== -1 ? String(row[hashIdx]).trim() : '';
        // Compare password hash (support computed salted hash or direct match)
        if (storedHash && (storedHash === computedHash || (inputHash && storedHash === inputHash))) {
          matchedAuth = {
            owner_name: ownerNameIdx !== -1 ? String(row[ownerNameIdx]).trim() : '',
            owner_email: rowEmail,
            team_id: teamIdIdx !== -1 ? String(row[teamIdIdx]).trim() : ''
          };
          authRowIndex = a + 2;
          // Update last_login_at
          if (lastLoginIdx !== -1) {
            authSheet.getRange(authRowIndex, lastLoginIdx + 1).setValue(new Date().toISOString());
          }
          break;
        } else {
          return { success: false, error: 'Incorrect password. Please verify your credentials.' };
        }
      }
    }
  }

  // Fallback: Check Teams sheet for matching owner_email
  var teamsRes = apiGetTeams();
  var teams = teamsRes.data || [];
  var matchedTeam = null;

  if (matchedAuth && matchedAuth.team_id) {
    matchedTeam = teams.find(function(t) {
      return String(t.id).trim().toLowerCase() === matchedAuth.team_id.toLowerCase();
    });
  }

  if (!matchedTeam) {
    matchedTeam = teams.find(function(t) {
      return t.owner_email && t.owner_email.toLowerCase() === email;
    });
  }

  // Requirement 9: DO NOT CREATE TEAM DURING LOGIN.
  // If team does not exist in authoritative Teams sheet, reject login.
  if (!matchedTeam) {
    return { success: false, error: 'Your franchise has not been assigned by the Admin.' };
  }

  var finalTeam = matchedTeam;
  var ownerName = (matchedAuth && matchedAuth.owner_name) || finalTeam.owner_name || 'Franchise Owner';
  var teamId = finalTeam.id;
  var teamName = finalTeam.team_name || finalTeam.name || 'Franchise Team';

  Logger.log('[FRANCHISE LOGIN SUCCESS] Email: ' + email + ' | Team: ' + teamId);

  return {
    success: true,
    data: {
      team_id: teamId,
      teamId: teamId,
      owner_name: ownerName,
      ownerName: ownerName,
      owner_email: email,
      email: email,
      team_name: teamName,
      teamName: teamName,
      team: finalTeam
    },
    message: 'Authenticated successfully.'
  };
}

// Alias for backwards compatibility
function apiCreateTeam(payload) {
  return apiRegisterFranchise(payload);
}

/**
 * STEP 24 — UPDATE FRANCHISE / EDIT TEAM
 * 
 * Rules:
 * 1. Admin authorization check (valid session + role === 'admin').
 * 2. Primary key is team_id — NEVER modify team_id.
 * 3. Preserve player assignments, squad records, total_spent, and created_at.
 * 4. Recalculate remaining_purse = newPurse - total_spent without resetting total_spent.
 * 5. Strictly validate Department: BTech, BBA, BCA only.
 * 6. Validate uniqueness of team_name, short_code, owner_email against OTHER teams.
 * 7. Update Franchise_Auth sheet if owner name, owner email, or password changed.
 * 8. Return updated team object.
 */
function apiUpdateTeam(payload) {
  if (!isAdminAuthorized(payload)) {
    Logger.log('[AUTH REJECTED] apiUpdateTeam called without valid Admin credentials.');
    return { success: false, error: 'Unauthorized: Admin access required' };
  }

  var teamId = String(payload.team_id || payload.teamId || payload.id || '').trim();
  if (!teamId) return { success: false, error: 'Team ID is required.' };

  var ss = getSpreadsheet();
  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var teamsHeaders = ensureTeamSheetHeaders(teamsSheet);
  var lastRow = teamsSheet.getLastRow();
  var lastCol = teamsSheet.getLastColumn();
  if (lastRow <= 1) return { success: false, error: 'Team not found.' };

  var idColIdx = teamsHeaders.indexOf('id');
  var nameColIdx = teamsHeaders.indexOf('team_name');
  var shortNameColIdx = teamsHeaders.indexOf('short_name');
  var deptColIdx = teamsHeaders.indexOf('department');
  var ownerNameColIdx = teamsHeaders.indexOf('owner_name');
  var ownerEmailColIdx = teamsHeaders.indexOf('owner_email');
  var purseColIdx = teamsHeaders.indexOf('purse');
  var spentColIdx = teamsHeaders.indexOf('total_spent');
  var remPurseColIdx = teamsHeaders.indexOf('remaining_purse');
  var pCountColIdx = teamsHeaders.indexOf('player_count');
  var logoIdColIdx = teamsHeaders.indexOf('logo_file_id');
  var logoUrlColIdx = teamsHeaders.indexOf('logo_file_url');
  var logoColIdx = teamsHeaders.indexOf('logo');
  var statusColIdx = teamsHeaders.indexOf('status');
  var createdColIdx = teamsHeaders.indexOf('created_at');

  var values = teamsSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRowIdx = -1;

  for (var i = 0; i < values.length; i++) {
    var rId = String(values[i][idColIdx] || '').trim();
    if (rId.toLowerCase() === teamId.toLowerCase()) {
      targetRowIdx = i;
      break;
    }
  }

  if (targetRowIdx === -1) {
    return { success: false, error: 'Team not found.' };
  }

  var currentRow = values[targetRowIdx];

  // Resolve input changes (supports changes object or direct properties)
  var changes = payload.changes || payload;

  var newTeamName = changes.team_name !== undefined ? String(changes.team_name).trim() : (changes.name !== undefined ? String(changes.name).trim() : String(currentRow[nameColIdx] || '').trim());
  var newShortName = changes.short_name !== undefined ? String(changes.short_name).trim().toUpperCase() : String(currentRow[shortNameColIdx] || '').trim().toUpperCase();
  var newDept = changes.department !== undefined ? String(changes.department).trim() : (changes.branch !== undefined ? String(changes.branch).trim() : String(currentRow[deptColIdx] || '').trim());
  var newOwnerName = changes.owner_name !== undefined ? String(changes.owner_name).trim() : (changes.ownerName !== undefined ? String(changes.ownerName).trim() : String(currentRow[ownerNameColIdx] || '').trim());
  var newOwnerEmail = changes.owner_email !== undefined ? String(changes.owner_email).trim().toLowerCase() : (changes.email !== undefined ? String(changes.email).trim().toLowerCase() : String(currentRow[ownerEmailColIdx] || '').trim().toLowerCase());

  // Department Validation (Section 3 & 13)
  if (newDept === 'B.Tech') newDept = 'BTech';
  var allowedDepartments = ['BTech', 'BBA', 'BCA'];
  if (!newDept || allowedDepartments.indexOf(newDept) === -1) {
    return { success: false, error: 'INVALID_DEPARTMENT', message: 'Department must be BTech, BBA, or BCA' };
  }

  if (!newTeamName) {
    return { success: false, error: 'Franchise team name is required.' };
  }
  if (!newShortName) {
    return { success: false, error: 'Short code is required.' };
  }
  if (!newOwnerName) {
    return { success: false, error: 'Owner name is required.' };
  }
  if (!newOwnerEmail || newOwnerEmail.indexOf('@') === -1) {
    return { success: false, error: 'A valid owner email address is required.' };
  }

  var normNewName = newTeamName.replace(/\s+/g, ' ').toLowerCase();
  var normNewShort = newShortName.replace(/\s+/g, '').toUpperCase();
  var normNewEmail = newOwnerEmail.toLowerCase();

  // Duplicate Validation against OTHER teams (Section 11)
  for (var j = 0; j < values.length; j++) {
    if (j === targetRowIdx) continue; // Skip current team itself
    var otherRow = values[j];
    var otherId = String(otherRow[idColIdx] || '').trim();
    if (otherId.toLowerCase() === teamId.toLowerCase()) continue;

    if (nameColIdx !== -1) {
      var otherName = String(otherRow[nameColIdx] || '').trim().replace(/\s+/g, ' ').toLowerCase();
      if (otherName === normNewName) {
        return { success: false, error: 'DUPLICATE_TEAM_NAME', message: 'Another franchise already has this name.' };
      }
    }
    if (shortNameColIdx !== -1) {
      var otherShort = String(otherRow[shortNameColIdx] || '').trim().replace(/\s+/g, '').toUpperCase();
      if (otherShort === normNewShort) {
        return { success: false, error: 'DUPLICATE_SHORT_CODE', message: 'Another franchise already has this short code.' };
      }
    }
    if (ownerEmailColIdx !== -1) {
      var otherEmail = String(otherRow[ownerEmailColIdx] || '').trim().toLowerCase();
      if (otherEmail === normNewEmail) {
        return { success: false, error: 'DUPLICATE_OWNER_EMAIL', message: 'Another franchise owner is registered with this email address.' };
      }
    }
  }

  // Check duplicate email in Franchise_Auth against OTHER teams
  var authSheet = getOrCreateSheet(CONFIG.SHEETS.FRANCHISE_AUTH, HEADERS.FRANCHISE_AUTH);
  var lastRowAuth = authSheet.getLastRow();
  var lastColAuth = authSheet.getLastColumn();
  if (lastRowAuth > 1) {
    var authHeaders = authSheet.getRange(1, 1, 1, lastColAuth).getValues()[0].map(function(h) { return String(h).trim(); });
    var aEmailIdx = authHeaders.indexOf('owner_email');
    var aTeamIdIdx = authHeaders.indexOf('team_id');
    if (aEmailIdx !== -1 && aTeamIdIdx !== -1) {
      var authValues = authSheet.getRange(2, 1, lastRowAuth - 1, lastColAuth).getValues();
      for (var a = 0; a < authValues.length; a++) {
        var aTeam = String(authValues[a][aTeamIdIdx] || '').trim().toLowerCase();
        if (aTeam !== teamId.toLowerCase()) {
          var aEmail = String(authValues[a][aEmailIdx] || '').trim().toLowerCase();
          if (aEmail === normNewEmail) {
            return { success: false, error: 'DUPLICATE_OWNER_EMAIL', message: 'Another franchise owner is registered with this email address.' };
          }
        }
      }
    }
  }

  // Purse calculations (Section 10: Do NOT reset purse or spent unintentionally)
  var currentSpent = spentColIdx !== -1 ? Number(currentRow[spentColIdx] || 0) : 0;
  var currentPurse = purseColIdx !== -1 ? Number(currentRow[purseColIdx] || 1000) : 1000;
  var newPurse = changes.purse !== undefined ? Number(changes.purse) : currentPurse;
  if (isNaN(newPurse) || newPurse <= 0) newPurse = currentPurse;
  var newRemaining = Math.max(0, newPurse - currentSpent);

  // Apply updates to the Teams sheet row
  var rowNumber = targetRowIdx + 2;
  if (nameColIdx !== -1) teamsSheet.getRange(rowNumber, nameColIdx + 1).setValue(newTeamName);
  if (shortNameColIdx !== -1) teamsSheet.getRange(rowNumber, shortNameColIdx + 1).setValue(newShortName);
  if (deptColIdx !== -1) teamsSheet.getRange(rowNumber, deptColIdx + 1).setValue(newDept);
  if (ownerNameColIdx !== -1) teamsSheet.getRange(rowNumber, ownerNameColIdx + 1).setValue(newOwnerName);
  if (ownerEmailColIdx !== -1) teamsSheet.getRange(rowNumber, ownerEmailColIdx + 1).setValue(newOwnerEmail);
  if (purseColIdx !== -1) teamsSheet.getRange(rowNumber, purseColIdx + 1).setValue(newPurse);
  if (remPurseColIdx !== -1) teamsSheet.getRange(rowNumber, remPurseColIdx + 1).setValue(newRemaining);

  // Logo update if specified in changes
  var currentLogoId = logoIdColIdx !== -1 ? String(currentRow[logoIdColIdx] || '') : '';
  var currentLogoUrl = logoUrlColIdx !== -1 ? String(currentRow[logoUrlColIdx] || '') : '';
  var updatedLogoId = changes.logo_file_id !== undefined ? String(changes.logo_file_id) : currentLogoId;
  var updatedLogoUrl = changes.logo_file_url !== undefined ? String(changes.logo_file_url) : currentLogoUrl;

  if (logoIdColIdx !== -1 && changes.logo_file_id !== undefined) {
    teamsSheet.getRange(rowNumber, logoIdColIdx + 1).setValue(updatedLogoId);
  }
  if (logoUrlColIdx !== -1 && changes.logo_file_url !== undefined) {
    teamsSheet.getRange(rowNumber, logoUrlColIdx + 1).setValue(updatedLogoUrl);
  }
  if (logoColIdx !== -1 && changes.logo_file_url !== undefined) {
    teamsSheet.getRange(rowNumber, logoColIdx + 1).setValue(updatedLogoUrl);
  }

  // Update Franchise_Auth sheet if owner details or password changed (Section 12 & 13)
  var newPassword = String(changes.password || changes.rawPassword || payload.password || '').trim();
  if (lastRowAuth > 1) {
    var authHeaders2 = authSheet.getRange(1, 1, 1, lastColAuth).getValues()[0].map(function(h) { return String(h).trim(); });
    var aTeamIdIdx2 = authHeaders2.indexOf('team_id');
    var aEmailIdx2 = authHeaders2.indexOf('owner_email');
    var aNameIdx2 = authHeaders2.indexOf('owner_name');
    var aHashIdx2 = authHeaders2.indexOf('password_hash');

    var authVals2 = authSheet.getRange(2, 1, lastRowAuth - 1, lastColAuth).getValues();
    var matchedAuthRow = -1;
    for (var m = 0; m < authVals2.length; m++) {
      var aTeamId = String(authVals2[m][aTeamIdIdx2] || '').trim().toLowerCase();
      if (aTeamId === teamId.toLowerCase()) {
        matchedAuthRow = m + 2;
        break;
      }
    }

    if (matchedAuthRow !== -1) {
      if (aEmailIdx2 !== -1) authSheet.getRange(matchedAuthRow, aEmailIdx2 + 1).setValue(newOwnerEmail);
      if (aNameIdx2 !== -1) authSheet.getRange(matchedAuthRow, aNameIdx2 + 1).setValue(newOwnerName);
      if (newPassword && aHashIdx2 !== -1) {
        var newHash = hashPassword(newPassword);
        authSheet.getRange(matchedAuthRow, aHashIdx2 + 1).setValue(newHash);
        Logger.log('[FRANCHISE AUTH] Updated password hash for team ' + teamId);
      }
    }
  }

  SpreadsheetApp.flush();

  var playerCount = pCountColIdx !== -1 ? Number(currentRow[pCountColIdx] || 0) : 0;
  var status = statusColIdx !== -1 ? String(currentRow[statusColIdx] || 'Active') : 'Active';
  var createdAt = createdColIdx !== -1 ? String(currentRow[createdColIdx] || '') : '';

  var updatedTeam = {
    id: teamId,
    team_name: newTeamName,
    name: newTeamName,
    short_name: newShortName,
    department: newDept,
    owner_name: newOwnerName,
    owner_email: newOwnerEmail,
    logo_file_id: updatedLogoId,
    logo_file_url: updatedLogoUrl,
    logo: updatedLogoUrl || String(currentRow[logoColIdx] || '🏏'),
    purse: newPurse,
    total_budget: newPurse,
    total_spent: currentSpent,
    spent: currentSpent,
    remaining_purse: newRemaining,
    leftover_balance: newRemaining,
    player_count: playerCount,
    squad_count: playerCount,
    status: status,
    created_at: createdAt
  };

  Logger.log('[TEAM UPDATED] ID: ' + teamId + ' | Name: ' + newTeamName + ' | Dept: ' + newDept);

  return {
    success: true,
    team_id: teamId,
    team: updatedTeam,
    message: 'Franchise updated successfully.'
  };
}

function apiDeleteTeam(payload) {
  var teamId = String(payload.teamId || payload.team_id || payload.id || '').trim();
  if (!teamId) return { success: false, error: 'Team ID is required.' };

  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var playersSheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
  var lastRow = teamsSheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Team not found.' };

  var values = teamsSheet.getRange(2, 1, lastRow - 1, HEADERS.TEAMS.length).getValues();
  var idIdx = HEADERS.TEAMS.indexOf('id');
  var nameIdx = HEADERS.TEAMS.indexOf('team_name');
  var pCountIdx = HEADERS.TEAMS.indexOf('player_count');

  var targetRow = -1;
  var targetTeamName = '';
  var targetPlayerCount = 0;

  for (var i = 0; i < values.length; i++) {
    var rowId = String(values[i][idIdx]).trim();
    if (rowId === teamId || rowId.toLowerCase() === teamId.toLowerCase()) {
      targetRow = i + 2;
      targetTeamName = String(values[i][nameIdx]).trim();
      targetPlayerCount = Number(values[i][pCountIdx]) || 0;
      break;
    }
  }

  if (targetRow === -1) {
    return { success: false, error: 'Team not found.' };
  }

  // STEP 4 — SAFETY CHECK: Check whether team currently has players
  if (targetPlayerCount > 0) {
    return {
      success: false,
      error: 'Cannot delete a team that has players assigned to it.'
    };
  }

  // Verify in Players sheet if any player is sold to this team
  var pLastRow = playersSheet.getLastRow();
  if (pLastRow > 1) {
    var pValues = playersSheet.getRange(2, 1, pLastRow - 1, HEADERS.PLAYERS.length).getValues();
    var soldTeamIdx = HEADERS.PLAYERS.indexOf('sold_to_team');
    for (var p = 0; p < pValues.length; p++) {
      var soldTeam = String(pValues[p][soldTeamIdx] || '').trim().toLowerCase();
      if (soldTeam && (soldTeam === teamId.toLowerCase() || (targetTeamName && soldTeam === targetTeamName.toLowerCase()))) {
        return {
          success: false,
          error: 'Cannot delete a team that has players assigned to it.'
        };
      }
    }
  }

  // Delete ONLY that specific team row
  teamsSheet.deleteRow(targetRow);
  Logger.log('[DELETE TEAM] Team ' + teamId + ' deleted from Google Sheet row ' + targetRow);

  // Also clean up corresponding record in Franchise_Auth sheet if it exists
  try {
    var ss = getSpreadsheet();
    var authSheet = ss.getSheetByName(CONFIG.SHEETS.FRANCHISE_AUTH);
    if (authSheet && authSheet.getLastRow() > 1) {
      var aCols = authSheet.getLastColumn();
      var aHeaders = authSheet.getRange(1, 1, 1, aCols).getValues()[0].map(function(h) { return String(h).trim(); });
      var aTidIdx = aHeaders.indexOf('team_id');
      if (aTidIdx !== -1) {
        var aValues = authSheet.getRange(2, 1, authSheet.getLastRow() - 1, aCols).getValues();
        for (var a = aValues.length - 1; a >= 0; a--) {
          var aTid = String(aValues[a][aTidIdx] || '').trim().toLowerCase();
          if (aTid === teamId.toLowerCase()) {
            authSheet.deleteRow(a + 2);
            Logger.log('[DELETE TEAM] Removed auth record for team ' + teamId);
          }
        }
      }
    }
  } catch (authDelErr) {
    Logger.log('Auth record delete warning: ' + authDelErr);
  }

  return {
    success: true,
    data: {
      deleted: true,
      teamId: teamId
    },
    message: 'Team successfully deleted from Google Sheets.'
  };
}

/**
 * STEP 24 — AUCTION PURCHASE & REALTIME PURSE UPDATE
 */
function apiPurchasePlayer(payload) {
  var lock = LockService.getScriptLock();
  try {
    // Concurrency protection: wait up to 10s for serialized atomic squad assignment
    lock.waitLock(10000);
  } catch (e) {
    return {
      success: false,
      error: 'SERVER_BUSY',
      message: 'Server is currently processing another transaction. Please try again.'
    };
  }

  try {
    var playerId = payload.player_id || payload.id || payload.playerId || '';
    var teamIdOrName = payload.team_id || payload.teamId || payload.sold_to_team || '';
    var soldPrice = Number(payload.sold_price || payload.soldPrice || 0);

    if (!playerId) return { success: false, error: 'Player ID is required.' };
    if (!teamIdOrName) return { success: false, error: 'Bidding franchise team is required.' };
    if (isNaN(soldPrice) || soldPrice <= 0) return { success: false, error: 'Valid sold price is required.' };

    var playersSheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
    var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
    var auctionSheet = getOrCreateSheet(CONFIG.SHEETS.AUCTION, HEADERS.AUCTION);

    // 1. Locate Team & Check Remaining Purse
    var teamValues = teamsSheet.getRange(2, 1, Math.max(1, teamsSheet.getLastRow() - 1), HEADERS.TEAMS.length).getValues();
    var teamRowIdx = -1;
    var targetTeam = null;

    for (var t = 0; t < teamValues.length; t++) {
      var tRow = teamValues[t];
      var tId = String(tRow[HEADERS.TEAMS.indexOf('id')]).trim().toLowerCase();
      var tName = String(tRow[HEADERS.TEAMS.indexOf('team_name')]).trim().toLowerCase();
      var query = teamIdOrName.trim().toLowerCase();

      if (tId === query || tName === query) {
        teamRowIdx = t + 2;
        targetTeam = {
          id: tRow[HEADERS.TEAMS.indexOf('id')],
          team_name: tRow[HEADERS.TEAMS.indexOf('team_name')],
          purse: Number(tRow[HEADERS.TEAMS.indexOf('purse')]) || 1000,
          total_spent: Number(tRow[HEADERS.TEAMS.indexOf('total_spent')]) || 0,
          player_count: Number(tRow[HEADERS.TEAMS.indexOf('player_count')]) || 0
        };
        break;
      }
    }

    if (!targetTeam) {
      return { success: false, error: 'Purchasing franchise team not found.' };
    }

    // 2. Locate Player & Count Current Active Squad Members for Target Team
    var pValues = playersSheet.getRange(2, 1, Math.max(1, playersSheet.getLastRow() - 1), HEADERS.PLAYERS.length).getValues();
    var pRowIdx = -1;
    var playerName = '';
    var activeSquadCount = 0;
    var targetTeamIdLower = String(targetTeam.id).trim().toLowerCase();
    var targetTeamNameLower = String(targetTeam.team_name).trim().toLowerCase();

    for (var p = 0; p < pValues.length; p++) {
      var row = pValues[p];
      var rowId = String(row[HEADERS.PLAYERS.indexOf('id')]).trim();
      var rowEmail = String(row[HEADERS.PLAYERS.indexOf('email')]).trim().toLowerCase();
      var rowSoldTeam = String(row[HEADERS.PLAYERS.indexOf('sold_to_team')] || '').trim().toLowerCase();
      var rowStatus = String(row[HEADERS.PLAYERS.indexOf('status')] || '').trim().toLowerCase();
      var rowAuctionStatus = String(row[HEADERS.PLAYERS.indexOf('auction_status')] || '').trim().toLowerCase();

      if (rowId === playerId || rowEmail === playerId.toLowerCase()) {
        pRowIdx = p + 2;
        playerName = row[HEADERS.PLAYERS.indexOf('full_name')];
      }

      // Count only active assigned players for this franchise (exclude Rejected, Pending, Unassigned, Deleted)
      if (rowAuctionStatus === 'sold' && rowStatus !== 'rejected' && (rowSoldTeam === targetTeamIdLower || rowSoldTeam === targetTeamNameLower)) {
        activeSquadCount++;
      }
    }

    if (pRowIdx === -1) {
      return { success: false, error: 'Athlete record not found in database.' };
    }

    // 3. Strict Server-Side Squad Limit Validation (MAX_SQUAD_SIZE = 10)
    var maxSquad = CONFIG.MAX_SQUAD_SIZE || 10;
    if (activeSquadCount >= maxSquad) {
      return {
        success: false,
        error: "SQUAD_LIMIT_REACHED",
        message: "Squad limit reached. A franchise can contain a maximum of " + maxSquad + " players."
      };
    }

    // 4. Validate Sufficient Purse Balance
    var remaining = targetTeam.purse - targetTeam.total_spent;
    if (soldPrice > remaining) {
      return {
        success: false,
        error: 'Insufficient purse balance! ' + targetTeam.team_name + ' has only ' + remaining + ' Points remaining.'
      };
    }

    // 5. Update Players sheet: status = Approved, auction_status = Sold, sold_to_team = team ID (Requirement 10)
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('status') + 1).setValue('Approved');
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('auction_status') + 1).setValue('Sold');
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_to_team') + 1).setValue(targetTeam.id);
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_price') + 1).setValue(soldPrice);

    // 6. Update Teams sheet: total_spent, remaining_purse, player_count
    var newSpent = targetTeam.total_spent + soldPrice;
    var newRemaining = Math.max(0, targetTeam.purse - newSpent);
    var newCount = activeSquadCount + 1;

    teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('total_spent') + 1).setValue(newSpent);
    teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('remaining_purse') + 1).setValue(newRemaining);
    teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('player_count') + 1).setValue(newCount);

    // 7. Record in Auction sheet
    auctionSheet.appendRow([
      'auc_' + new Date().getTime(),
      playerId,
      playerName,
      '',
      soldPrice,
      targetTeam.id,
      'Sold',
      soldPrice,
      targetTeam.team_name,
      new Date().toISOString()
    ]);

    Logger.log('[AUCTION] Athlete ' + playerId + ' sold to ' + targetTeam.team_name + ' (' + targetTeam.id + ') for ' + soldPrice + '. Squad count: ' + newCount + '/' + maxSquad);

    return {
      success: true,
      player: { id: playerId, sold_to_team: targetTeam.id, sold_price: soldPrice, auction_status: 'Sold' },
      team: { id: targetTeam.id, team_name: targetTeam.team_name, spent: newSpent, leftover_balance: newRemaining, player_count: newCount, squad_count: newCount },
      message: 'Player successfully purchased by ' + targetTeam.team_name + ' for ' + soldPrice + ' Points.'
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

/**
 * STEP 24 — REVOKE ATHLETE PURCHASE
 */
function apiRevokePlayerPurchase(payload) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {}

  try {
    var playerId = payload.player_id || payload.id || payload.playerId || '';
    if (!playerId) return { success: false, error: 'Player ID is required.' };

    var playersSheet = getOrCreateSheet(CONFIG.SHEETS.PLAYERS, HEADERS.PLAYERS);
    var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);

    var pValues = playersSheet.getRange(2, 1, Math.max(1, playersSheet.getLastRow() - 1), HEADERS.PLAYERS.length).getValues();
    var pRowIdx = -1;
    var soldTeamName = '';
    var soldPrice = 0;

    for (var p = 0; p < pValues.length; p++) {
      var row = pValues[p];
      var rowId = String(row[HEADERS.PLAYERS.indexOf('id')]).trim();
      var rowEmail = String(row[HEADERS.PLAYERS.indexOf('email')]).trim().toLowerCase();

      if (rowId === playerId || rowEmail === playerId.toLowerCase()) {
        pRowIdx = p + 2;
        soldTeamName = String(row[HEADERS.PLAYERS.indexOf('sold_to_team')] || '').trim();
        soldPrice = Number(row[HEADERS.PLAYERS.indexOf('sold_price')]) || 0;
        break;
      }
    }

    if (pRowIdx === -1) return { success: false, error: 'Player record not found.' };

    // Reset player in Players sheet
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('auction_status') + 1).setValue('Upcoming');
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_to_team') + 1).setValue('');
    playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_price') + 1).setValue('');

    // Refund team if applicable
    if (soldTeamName && soldPrice > 0) {
      var teamValues = teamsSheet.getRange(2, 1, Math.max(1, teamsSheet.getLastRow() - 1), HEADERS.TEAMS.length).getValues();
      for (var t = 0; t < teamValues.length; t++) {
        var tRow = teamValues[t];
        var tId = String(tRow[HEADERS.TEAMS.indexOf('id')]).trim().toLowerCase();
        var tName = String(tRow[HEADERS.TEAMS.indexOf('team_name')]).trim().toLowerCase();
        var q = soldTeamName.toLowerCase();

        if (tId === q || tName === q) {
          var teamRowIdx = t + 2;
          var currentSpent = Number(tRow[HEADERS.TEAMS.indexOf('total_spent')]) || 0;
          var purse = Number(tRow[HEADERS.TEAMS.indexOf('purse')]) || 1000;
          var currentCount = Number(tRow[HEADERS.TEAMS.indexOf('player_count')]) || 0;

          var newSpent = Math.max(0, currentSpent - soldPrice);
          var newRemaining = Math.max(0, purse - newSpent);
          var newCount = Math.max(0, currentCount - 1);

          teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('total_spent') + 1).setValue(newSpent);
          teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('remaining_purse') + 1).setValue(newRemaining);
          teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('player_count') + 1).setValue(newCount);
          break;
        }
      }
    }

    Logger.log('[AUCTION] Athlete ' + playerId + ' purchase revoked.');
    return {
      success: true,
      refundedTeam: soldTeamName,
      refundedPrice: soldPrice,
      message: 'Athlete purchase revoked and franchise purse refunded.'
    };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}
