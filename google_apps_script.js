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
    SETTINGS: 'Settings'
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
  // Tournament has exactly 8 franchise teams
  DEFAULT_TEAMS: [
    { id: 'team-titans', team_name: 'B.Tech Titans', short_name: 'TITANS', purse: 1000, logo: '⚡' },
    { id: 'team-blasters', team_name: 'BCA Blasters', short_name: 'BLASTERS', purse: 1000, logo: '🏏' },
    { id: 'team-bulls', team_name: 'BBA Bulls', short_name: 'BULLS', purse: 1000, logo: '🐂' },
    { id: 'team-strikers', team_name: 'Sunstone Strikers', short_name: 'STRIKERS', purse: 1000, logo: '🔥' },
    { id: 'team-warriors', team_name: 'Campus Warriors', short_name: 'WARRIORS', purse: 1000, logo: '⚔️' },
    { id: 'team-knights', team_name: 'Royal Knights', short_name: 'KNIGHTS', purse: 1000, logo: '🛡️' },
    { id: 'team-kings', team_name: 'Super Kings', short_name: 'KINGS', purse: 1000, logo: '👑' },
    { id: 'team-challengers', team_name: 'Premier Challengers', short_name: 'CHALLENGERS', purse: 1000, logo: '🏆' }
  ]
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
  var needed = ['owner_name', 'owner_email'];
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

  // 2. Initialize Teams sheet with the 8 official tournament franchises if empty
  if (teamsSheet.getLastRow() <= 1) {
    var now = new Date().toISOString();
    CONFIG.DEFAULT_TEAMS.forEach(function(team) {
      teamsSheet.appendRow([
        team.id,
        team.team_name,
        team.short_name,
        '', // owner_name
        '', // owner_email
        '', // logo_file_id
        '', // logo_file_url
        team.purse,
        0,  // total_spent
        team.purse, // remaining_purse
        0,  // player_count
        'Active',
        now
      ]);
    });
    Logger.log('[SETUP] Seeded 8 tournament teams in Teams sheet.');
  }

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
      if (k.toLowerCase().includes('pass') || k.toLowerCase().includes('secret')) {
        logPayload[k] = '[HIDDEN]';
      } else if (k === 'photo_data' || k === 'certificate_data') {
        logPayload[k] = '[BASE64_DATA_LENGTH_' + String(payload[k]).length + ']';
      } else {
        logPayload[k] = payload[k];
      }
    }
    Logger.log('[POST] Action: ' + action + ' | Payload: ' + JSON.stringify(logPayload));

    // Requirements 13, 14, 15: Role-based Authorization for Privileged Admin Actions
    var PRIVILEGED_ACTIONS = [
      'createTeam', 'createFranchise', 'registerFranchise', 'updateTeam', 'deleteTeam',
      'deleteAllPlayers', 'deletePlayer', 'deletePlayers', 'approvePlayer', 'approvePlayers', 'approveAllPlayers',
      'rejectPlayer', 'assignPlayer', 'sellPlayer', 'removePlayerFromTeam', 'updatePurse', 'updateAuction',
      'purchasePlayer', 'revokePlayerPurchase'
    ];

    if (PRIVILEGED_ACTIONS.indexOf(action) !== -1) {
      if (payload.role === 'FRANCHISE_OWNER') {
        Logger.log('[AUTH] Blocked unauthorized privileged action: ' + action + ' by FRANCHISE_OWNER');
        return createJsonResponse({ success: false, error: 'Unauthorized' });
      }
    }

    var result;
    switch (action) {
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

      case 'registerFranchise':
      case 'createFranchise':
      case 'createTeam':
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
        result = apiPurchasePlayer(payload);
        break;

      case 'revokePlayerPurchase':
        result = apiRevokePlayerPurchase(payload);
        break;

      case 'uploadPhoto':
        result = apiUploadFile(payload, CONFIG.FOLDERS.PHOTOS, 'athlete_photo');
        break;

      case 'uploadCertificate':
        result = apiUploadFile(payload, CONFIG.FOLDERS.CERTIFICATES, 'athlete_cert');
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

  return {
    success: true,
    data: {
      playersCount: playersCount,
      playersLastRow: playersLastRow,
      teamsCount: teamsCount,
      teamsLastRow: teamsLastRow,
      auctionLastRow: auctionLastRow,
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

    // Find squad from Players sheet
    var squad = allPlayers.filter(function(p) {
      var soldTeam = String(p.sold_to_team || '').trim().toLowerCase();
      return soldTeam && (soldTeam === tNameLower || soldTeam === tIdLower);
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
 * STEP 10, 11, 12, 13, 14 — ATHLETE REGISTRATION
 * Server-side branch validation, mobile number preservation, Drive file storage
 */
function apiRegisterPlayer(payload) {
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
          settingsSheet.getRange(s + 2, 2).setValue(nextIndex);
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
  var ownerName = String(payload.owner_name || payload.ownerName || '').trim();
  var ownerEmail = String(payload.owner_email || payload.email || '').trim().toLowerCase();
  var teamName = String(payload.team_name || payload.customTeamName || payload.name || '').trim();
  var rawPassword = String(payload.password || payload.rawPassword || '');
  var passwordHash = String(payload.password_hash || '');
  var department = String(payload.department || payload.branch || 'B.Tech').trim();
  var logo = String(payload.logo || '🏏').trim();
  var purse = Number(payload.purse || payload.budget || payload.total_budget || 1000);

  if (!ownerName) return { success: false, error: 'Owner name is required.' };
  if (!ownerEmail || ownerEmail.indexOf('@') === -1) return { success: false, error: 'A valid email address is required.' };
  if (!rawPassword && !passwordHash) return { success: false, error: 'Password is required.' };
  if (!teamName) return { success: false, error: 'Franchise team name is required.' };

  var ss = getSpreadsheet();
  var teamsSheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var authSheet = getOrCreateSheet(CONFIG.SHEETS.FRANCHISE_AUTH, HEADERS.FRANCHISE_AUTH);

  var teamsHeaders = ensureTeamSheetHeaders(teamsSheet);

  // 1. Check for duplicate team name or owner in Teams
  var lastRowTeams = teamsSheet.getLastRow();
  var lastColTeams = teamsSheet.getLastColumn();
  var existingTeamIds = [];

  if (lastRowTeams > 1) {
    var teamValues = teamsSheet.getRange(2, 1, lastRowTeams - 1, lastColTeams).getValues();
    var idColIdx = teamsHeaders.indexOf('id');
    var nameColIdx = teamsHeaders.indexOf('team_name');
    var ownerEmailColIdx = teamsHeaders.indexOf('owner_email');

    for (var i = 0; i < teamValues.length; i++) {
      var row = teamValues[i];
      if (idColIdx !== -1 && row[idColIdx]) {
        existingTeamIds.push(String(row[idColIdx]).trim());
      }
      if (nameColIdx !== -1 && String(row[nameColIdx]).trim().toLowerCase() === teamName.toLowerCase()) {
        return { success: false, error: 'A franchise with this name already exists in the tournament.' };
      }
      if (ownerEmailColIdx !== -1 && String(row[ownerEmailColIdx]).trim().toLowerCase() === ownerEmail) {
        return { success: false, error: 'A franchise owner is already registered with this email address.' };
      }
    }
  }

  // Requirement 3: Maximum of 8 franchises allowed in the tournament
  if (existingTeamIds.length >= 8) {
    return { success: false, error: 'Maximum of 8 franchises allowed.' };
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
        if (String(authValues[a][authEmailIdx]).trim().toLowerCase() === ownerEmail) {
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
    else if (col === 'owner_name') teamRow.push(ownerName);
    else if (col === 'owner_email') teamRow.push(ownerEmail);
    else if (col === 'logo_file_id') teamRow.push('');
    else if (col === 'logo_file_url' || col === 'logo') teamRow.push(logo);
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
    owner_name: ownerName,
    owner_email: ownerEmail,
    purse: purse,
    total_budget: purse,
    total_spent: 0,
    spent: 0,
    remaining_purse: purse,
    leftover_balance: purse,
    player_count: 0,
    squad_count: 0,
    squad: [],
    department: department,
    logo: logo,
    status: 'Active',
    created_at: now
  };

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

  // Fallback: If not in Franchise_Auth yet, check Teams sheet for matching owner_email
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

  if (!matchedAuth && !matchedTeam) {
    return { success: false, error: 'No franchise owner found with this email. Please register first.' };
  }

  var finalTeam = matchedTeam || {
    id: matchedAuth ? matchedAuth.team_id : '',
    team_name: 'Franchise Team',
    name: 'Franchise Team',
    owner_name: matchedAuth ? matchedAuth.owner_name : '',
    owner_email: email
  };

  var ownerName = (matchedAuth && matchedAuth.owner_name) || finalTeam.owner_name || 'Franchise Owner';
  var teamId = finalTeam.id || (matchedAuth ? matchedAuth.team_id : '');
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

function apiUpdateTeam(payload) {
  var teamId = payload.id || '';
  if (!teamId) return { success: false, error: 'Team ID is required.' };

  var sheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success: false, error: 'Team not found.' };

  var values = sheet.getRange(2, 1, lastRow - 1, HEADERS.TEAMS.length).getValues();
  var idIdx = HEADERS.TEAMS.indexOf('id');

  for (var i = 0; i < values.length; i++) {
    if (String(values[i][idIdx]).trim() === teamId) {
      var rowNum = i + 2;
      for (var k in payload) {
        var colIdx = HEADERS.TEAMS.indexOf(k);
        if (colIdx !== -1) {
          sheet.getRange(rowNum, colIdx + 1).setValue(payload[k]);
        }
      }
      return { success: true, message: 'Franchise team updated in Google Sheet.' };
    }
  }

  return { success: false, error: 'Team not found.' };
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

  var remaining = targetTeam.purse - targetTeam.total_spent;
  if (soldPrice > remaining) {
    return {
      success: false,
      error: 'Insufficient purse balance! ' + targetTeam.team_name + ' has only ' + remaining + ' Points remaining.'
    };
  }

  // 2. Locate Player & Update Sold Information
  var pValues = playersSheet.getRange(2, 1, Math.max(1, playersSheet.getLastRow() - 1), HEADERS.PLAYERS.length).getValues();
  var pRowIdx = -1;
  var playerName = '';

  for (var p = 0; p < pValues.length; p++) {
    var row = pValues[p];
    var rowId = String(row[HEADERS.PLAYERS.indexOf('id')]).trim();
    var rowEmail = String(row[HEADERS.PLAYERS.indexOf('email')]).trim().toLowerCase();

    if (rowId === playerId || rowEmail === playerId.toLowerCase()) {
      pRowIdx = p + 2;
      playerName = row[HEADERS.PLAYERS.indexOf('full_name')];
      break;
    }
  }

  if (pRowIdx === -1) {
    return { success: false, error: 'Athlete record not found in database.' };
  }

  // Update Players sheet: status = Approved, auction_status = Sold, sold_to_team = team ID (Requirement 10)
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('status') + 1).setValue('Approved');
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('auction_status') + 1).setValue('Sold');
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_to_team') + 1).setValue(targetTeam.id);
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_price') + 1).setValue(soldPrice);

  // Update Teams sheet: total_spent, remaining_purse, player_count
  var newSpent = targetTeam.total_spent + soldPrice;
  var newRemaining = Math.max(0, targetTeam.purse - newSpent);
  var newCount = targetTeam.player_count + 1;

  teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('total_spent') + 1).setValue(newSpent);
  teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('remaining_purse') + 1).setValue(newRemaining);
  teamsSheet.getRange(teamRowIdx, HEADERS.TEAMS.indexOf('player_count') + 1).setValue(newCount);

  // Record in Auction sheet
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

  Logger.log('[AUCTION] Athlete ' + playerId + ' sold to ' + targetTeam.team_name + ' (' + targetTeam.id + ') for ' + soldPrice);

  return {
    success: true,
    player: { id: playerId, sold_to_team: targetTeam.id, sold_price: soldPrice, auction_status: 'Sold' },
    team: { id: targetTeam.id, team_name: targetTeam.team_name, spent: newSpent, leftover_balance: newRemaining, player_count: newCount },
    message: 'Player successfully purchased by ' + targetTeam.team_name + ' for ' + soldPrice + ' Points.'
  };
}

/**
 * STEP 24 — REVOKE ATHLETE PURCHASE
 */
function apiRevokePlayerPurchase(payload) {
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
}
