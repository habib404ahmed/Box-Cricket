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
    'logo_file_id',
    'logo_file_url',
    'purse',
    'total_spent',
    'remaining_purse',
    'player_count',
    'status',
    'created_at'
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
  var auctionSheet = getOrCreateSheet(CONFIG.SHEETS.AUCTION, HEADERS.AUCTION);
  var settingsSheet = getOrCreateSheet(CONFIG.SHEETS.SETTINGS, HEADERS.SETTINGS);

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
      sheets: [CONFIG.SHEETS.PLAYERS, CONFIG.SHEETS.TEAMS, CONFIG.SHEETS.AUCTION, CONFIG.SHEETS.SETTINGS]
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

      case 'createTeam':
        result = apiCreateTeam(payload);
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
  if (lastRow <= 1) {
    setupTournament();
    lastRow = sheet.getLastRow();
  }

  var numCols = HEADERS.TEAMS.length;
  var values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  var teams = [];

  // Read players to compute live squad and spent balance accurately
  var playersRes = apiGetPlayers();
  var allPlayers = playersRes.data || [];

  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var team = {};
    for (var j = 0; j < numCols; j++) {
      team[HEADERS.TEAMS[j]] = row[j];
    }

    var teamName = String(team.team_name || '').trim().toLowerCase();
    var teamId = String(team.id || '').trim().toLowerCase();

    // Find squad from Players sheet
    var squad = allPlayers.filter(function(p) {
      var soldTeam = String(p.sold_to_team || '').trim().toLowerCase();
      return soldTeam && (soldTeam === teamName || soldTeam === teamId);
    });

    var spent = squad.reduce(function(sum, p) {
      return sum + (Number(p.sold_price) || 0);
    }, 0);

    var purse = Number(team.purse) || 1000;
    var remaining = Math.max(0, purse - spent);

    team.name = team.team_name;
    team.total_budget = purse;
    team.spent = spent;
    team.spent_points = spent;
    team.remaining_purse = remaining;
    team.leftover_balance = remaining;
    team.squad = squad;
    team.squad_count = squad.length;
    team.player_count = squad.length;

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
  var confirmation = String(payload.confirmation || '').trim().toUpperCase();
  if (confirmation !== 'DELETE' && confirmation !== 'DELETE ALL') {
    return {
      success: false,
      error: 'Security verification failed: Confirmation must be "DELETE" to execute bulk deletion.'
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

  // Update athlete_count in Settings sheet
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

  Logger.log('[DELETE ALL] All athletes cleared from Google Sheets.');
  return {
    success: true,
    deleted_count: deletedCount,
    count: deletedCount,
    message: 'All athlete registration records deleted successfully from Google Sheets.'
  };
}

/**
 * STEP 23 — TEAMS MANAGEMENT
 */
function apiCreateTeam(payload) {
  var teamName = String(payload.team_name || payload.name || '').trim();
  if (!teamName) return { success: false, error: 'Team name is required.' };

  var shortName = String(payload.short_name || teamName.substring(0, 4).toUpperCase()).trim();
  var purse = Number(payload.purse || payload.total_budget || 1000);
  var teamId = payload.id || ('team-' + teamName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + new Date().getTime().toString().slice(-4));

  var sheet = getOrCreateSheet(CONFIG.SHEETS.TEAMS, HEADERS.TEAMS);
  var now = new Date().toISOString();

  sheet.appendRow([
    teamId,
    teamName,
    shortName,
    payload.logo_file_id || '',
    payload.logo_file_url || '',
    purse,
    0, // total_spent
    purse, // remaining_purse
    0, // player_count
    'Active',
    now
  ]);

  return { success: true, teamId: teamId, message: 'Franchise team created.' };
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

  // Update Players sheet: status = Approved, auction_status = Sold, sold_to_team = team_name, sold_price = soldPrice
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('status') + 1).setValue('Approved');
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('auction_status') + 1).setValue('Sold');
  playersSheet.getRange(pRowIdx, HEADERS.PLAYERS.indexOf('sold_to_team') + 1).setValue(targetTeam.team_name);
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
    targetTeam.team_name,
    'Sold',
    soldPrice,
    targetTeam.team_name,
    new Date().toISOString()
  ]);

  Logger.log('[AUCTION] Athlete ' + playerId + ' sold to ' + targetTeam.team_name + ' for ' + soldPrice);

  return {
    success: true,
    player: { id: playerId, sold_to_team: targetTeam.team_name, sold_price: soldPrice, auction_status: 'Sold' },
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
      var tName = String(tRow[HEADERS.TEAMS.indexOf('team_name')]).trim().toLowerCase();

      if (tName === soldTeamName.toLowerCase()) {
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
