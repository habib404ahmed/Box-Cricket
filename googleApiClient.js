/**
 * ==============================================================================
 * SUNSTONE PREMIER LEAGUE 2026 — GOOGLE BACKEND CLIENT BRIDGE
 * ==============================================================================
 * Connects the web application to Google Sheets & Google Drive via Google Apps Script.
 * 
 * Target Spreadsheet: 1y9Q93DVLKTBXOcjb7ycW1QEhKBeMbVK3RbDP18rS8AI
 * Target Drive Folder: 1mxiYEP1XE8obPF8oBrS6m4XfdAYOtcSo
 * ==============================================================================
 */

(function(window) {
    'use strict';

    // 1. CONFIGURATION
    // Deployed Google Apps Script Web App URL for Sunstone Premier League 2026
    let GOOGLE_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbznL9oh8LYvcviVBYIwFISPWjjtPdXjr7VVAIN2DxupbNGXjVN-rXXkESIqaj4B0QFrMA/exec';

    // Allow override via localStorage or window global
    try {
        const localOverride = localStorage.getItem('google_script_web_app_url');
        if (localOverride && localOverride.startsWith('https://script.google.com/')) {
            GOOGLE_SCRIPT_WEB_APP_URL = localOverride.trim();
        }
    } catch (e) {}

    if (window.SUNSTONE_GOOGLE_API_URL && window.SUNSTONE_GOOGLE_API_URL.startsWith('https://script.google.com/')) {
        GOOGLE_SCRIPT_WEB_APP_URL = window.SUNSTONE_GOOGLE_API_URL.trim();
    }

    const isConfigured = () => {
        return Boolean(
            GOOGLE_SCRIPT_WEB_APP_URL && 
            GOOGLE_SCRIPT_WEB_APP_URL.startsWith('https://script.google.com/macros/s/') &&
            !GOOGLE_SCRIPT_WEB_APP_URL.includes('YOUR_GOOGLE_APPS_SCRIPT')
        );
    };

    // 8 Tournament Franchise Teams (Matches Step 11: exactly 8 teams)
    const DEFAULT_8_TEAMS = [
        { id: 'team-titans', name: 'B.Tech Titans', team_name: 'B.Tech Titans', short_name: 'TITANS', department: 'B.Tech', logo: '⚡', color: '#38bdf8', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-blasters', name: 'BCA Blasters', team_name: 'BCA Blasters', short_name: 'BLASTERS', department: 'BCA', logo: '🏏', color: '#a3e635', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-bulls', name: 'BBA Bulls', team_name: 'BBA Bulls', short_name: 'BULLS', department: 'BBA', logo: '🐂', color: '#fbbf24', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-strikers', name: 'Sunstone Strikers', team_name: 'Sunstone Strikers', short_name: 'STRIKERS', department: 'Campus', logo: '🔥', color: '#f97316', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-warriors', name: 'Campus Warriors', team_name: 'Campus Warriors', short_name: 'WARRIORS', department: 'Campus', logo: '⚔️', color: '#ef4444', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-knights', name: 'Royal Knights', team_name: 'Royal Knights', short_name: 'KNIGHTS', department: 'Campus', logo: '🛡️', color: '#8b5cf6', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-kings', name: 'Super Kings', team_name: 'Super Kings', short_name: 'KINGS', department: 'Campus', logo: '👑', color: '#eab308', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' },
        { id: 'team-challengers', name: 'Premier Challengers', team_name: 'Premier Challengers', short_name: 'CHALLENGERS', department: 'Campus', logo: '🏆', color: '#06b6d4', purse: 1000, total_budget: 1000, spent: 0, leftover_balance: 1000, squad_count: 0, status: 'Active' }
    ];

    /**
     * Normalizes a player record so both camelCase, snake_case, Google Drive URLs,
     * and mobile_number/phone are consistently accessible.
     */
    function normalizePlayer(p) {
        if (!p || typeof p !== 'object') return null;

        const resolvedPhone = String(p.mobile_number || p.phone || '').trim();
        const resolvedName = p.full_name || p.name || '';
        const resolvedPhoto = p.photo_file_url || p.photo_data || p.photo || '';
        const resolvedCertUrl = p.certificate_file_url || p.certificate_data || '';
        const resolvedCertName = p.certificate_name || p.certificate || (resolvedCertUrl ? 'Attached Document' : 'None attached');

        return {
            ...p,
            id: p.id || ('ath_' + (p.email || 'id').replace(/[^a-zA-Z0-9]/g, '_')),
            name: resolvedName,
            full_name: resolvedName,
            phone: resolvedPhone,
            mobile_number: resolvedPhone,
            department: p.department || p.branch || '',
            enrollment_no: p.enrollment_no || '',
            email: p.email ? p.email.trim().toLowerCase() : '',
            gender: p.gender || 'Male',
            player_role: p.player_role || p.role || 'All-Rounder',
            status: p.status || 'Registered',
            base_price: (p.base_price !== undefined && p.base_price !== null && p.base_price !== '') ? Number(p.base_price) : 15,
            sold_price: (p.sold_price !== undefined && p.sold_price !== null && p.sold_price !== '') ? Number(p.sold_price) : null,
            sold_to_team: p.sold_to_team || null,
            auction_status: (p.sold_to_team || p.sold_price) ? 'Sold' : (p.auction_status || 'Upcoming'),
            photo_file_id: p.photo_file_id || '',
            photo_file_url: p.photo_file_url || '',
            photo_data: resolvedPhoto,
            photo: resolvedPhoto,
            certificate_file_id: p.certificate_file_id || '',
            certificate_file_url: resolvedCertUrl,
            certificate_data: resolvedCertUrl,
            certificate: resolvedCertName,
            certificate_name: resolvedCertName,
            created_at: p.created_at || new Date().toISOString()
        };
    }

    /**
     * Normalizes a franchise team record so numeric purse/spent fields,
     * squads, logo, and department/short_name are safe without ever rendering undefined/NaN.
     */
    function normalizeTeam(t, allPlayers = []) {
        if (!t || typeof t !== 'object') return null;

        const resolvedId = String(t.id || '').trim();
        const resolvedName = String(t.team_name || t.name || '').trim();
        const resolvedShort = String(t.short_name || t.shortName || '').trim();
        const resolvedLogo = t.logo_file_url || t.logo || '🏏';
        const purse = Number(t.purse ?? t.total_budget ?? 1000);

        // Find squad from players list if not provided
        const tNameLower = resolvedName.toLowerCase();
        const tIdLower = resolvedId.toLowerCase();
        const squad = Array.isArray(t.squad) ? t.squad : (allPlayers || []).filter(p => {
            const soldTeam = String(p.sold_to_team || '').trim().toLowerCase();
            return soldTeam && (soldTeam === tNameLower || soldTeam === tIdLower);
        });

        const spent = Number(t.spent ?? t.total_spent ?? (squad.reduce((sum, p) => sum + (Number(p.sold_price) || 0), 0)));
        const remaining = Math.max(0, purse - spent);
        const count = Number(t.player_count ?? squad.length);

        return {
            id: resolvedId,
            team_name: resolvedName,
            name: resolvedName,
            short_name: resolvedShort || resolvedName.substring(0, 4).toUpperCase(),
            department: t.department || resolvedShort || 'SPL',
            logo_file_id: t.logo_file_id || '',
            logo_file_url: t.logo_file_url || '',
            logo: resolvedLogo,
            purse: purse,
            total_budget: purse,
            total_spent: spent,
            spent: spent,
            spent_points: spent,
            remaining_purse: remaining,
            leftover_balance: remaining,
            player_count: count,
            squad_count: count,
            squad: squad,
            owner_name: t.owner_name || '',
            status: t.status || 'Active',
            created_at: t.created_at || new Date().toISOString()
        };
    }

    /**
     * Executes GET request to Google Apps Script Web App
     */
    async function getApi(action, queryParams = {}) {
        if (!isConfigured()) {
            return {
                configured: false,
                success: false,
                error: 'Google Apps Script Web App URL not configured yet in googleApiClient.js.'
            };
        }

        const params = new URLSearchParams({ action, ...queryParams });
        const endpoint = `${GOOGLE_SCRIPT_WEB_APP_URL}?${params.toString()}`;

        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                mode: 'cors',
                redirect: 'follow',
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            return { configured: true, ...json };
        } catch (err) {
            console.warn(`[GOOGLE API] GET ${action} failed:`, err);
            return { configured: true, success: false, error: err.message || String(err) };
        }
    }

    /**
     * Executes POST request to Google Apps Script Web App
     * Note: Sends body as text/plain JSON to avoid browser CORS preflight blocks with Google Apps Script
     */
    async function postApi(action, payload = {}) {
        if (!isConfigured()) {
            return {
                configured: false,
                success: false,
                error: 'Google Apps Script Web App URL not configured yet in googleApiClient.js.'
            };
        }

        const requestBody = JSON.stringify({ action, ...payload });

        try {
            const response = await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: requestBody
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            return { configured: true, ...json };
        } catch (err) {
            console.error(`[GOOGLE API] POST ${action} failed:`, err);
            return { configured: true, success: false, error: err.message || String(err) };
        }
    }

    // ==============================================================================
    // PUBLIC API FACADE
    // ==============================================================================
    const GoogleTourneyApi = {
        isConfigured,
        getWebAppUrl: () => GOOGLE_SCRIPT_WEB_APP_URL,
        setWebAppUrl: (url) => {
            if (url && typeof url === 'string') {
                GOOGLE_SCRIPT_WEB_APP_URL = url.trim();
                try {
                    localStorage.setItem('google_script_web_app_url', GOOGLE_SCRIPT_WEB_APP_URL);
                } catch (e) {}
                return true;
            }
            return false;
        },

        // --- 1-SECOND ATHLETE COUNT SYNC ---
        getAthleteCount: async (statusFilter = null) => {
            if (isConfigured()) {
                const params = statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {};
                const res = await getApi('getAthleteCount', params);
                if (res.success && typeof res.count === 'number') {
                    return { count: res.count, error: null, source: 'google_sheets' };
                }
            }

            // Fallback: If not yet deployed or error, read from active players storage
            try {
                let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                if (statusFilter && statusFilter !== 'ALL') {
                    localPlayers = localPlayers.filter(p => (p.status || '').toLowerCase() === statusFilter.toLowerCase());
                }
                return { count: localPlayers.length, error: null, source: 'cache' };
            } catch (e) {
                return { count: 0, error: null, source: 'cache' };
            }
        },

        // --- PLAYERS (READ) ---
        getPlayers: async () => {
            if (isConfigured()) {
                const res = await getApi('getPlayers');
                if (res.success && Array.isArray(res.data)) {
                    const normalized = res.data.map(normalizePlayer);
                    try {
                        localStorage.setItem('unibox_players', JSON.stringify(normalized));
                    } catch (e) {}
                    return { data: normalized, error: null, source: 'google_sheets' };
                }
            }

            // Fallback
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]').map(normalizePlayer);
            return { data: localPlayers, error: null, source: 'cache' };
        },

        getPlayer: async (emailOrId) => {
            if (!emailOrId) return { data: null, error: 'Email or ID is required.' };
            const query = String(emailOrId).trim();
            const isEmail = query.includes('@');

            if (isConfigured()) {
                const params = isEmail ? { email: query } : { id: query };
                const res = await getApi('getPlayer', params);
                if (res.success && res.data) {
                    const normalized = normalizePlayer(res.data);
                    return { data: normalized, error: null, source: 'google_sheets' };
                }
            }

            // Fallback
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            const found = localPlayers.find(p => 
                (p.id && p.id === query) || 
                (p.email && p.email.toLowerCase() === query.toLowerCase())
            );
            return { data: found ? normalizePlayer(found) : null, error: found ? null : 'Athlete not found', source: 'cache' };
        },

        // --- ATHLETE REGISTRATION (POST) ---
        registerPlayer: async (playerData) => {
            // Frontend validation: Branch restriction strictly BCA, B.Tech, BBA
            const VALID_BRANCHES = ['BCA', 'B.Tech', 'BBA'];
            const dept = String(playerData.department || playerData.branch || '').trim();
            if (!VALID_BRANCHES.includes(dept)) {
                return {
                    success: false,
                    error: `Invalid branch "${dept}". Only BCA, B.Tech, and BBA are accepted.`,
                    data: null
                };
            }

            // Validate mobile number: exactly 10 digits
            const rawPhone = String(playerData.mobile_number || playerData.phone || '').replace(/\D/g, '');
            if (!rawPhone || rawPhone.length !== 10) {
                return {
                    success: false,
                    error: 'A valid 10-digit mobile number is required.',
                    data: null
                };
            }

            const payload = {
                ...playerData,
                department: dept,
                mobile_number: rawPhone,
                phone: rawPhone
            };

            if (!isConfigured()) {
                return {
                    success: false,
                    error: 'Unable to connect to tournament database: Please deploy the Google Apps Script Web App and configure GOOGLE_SCRIPT_WEB_APP_URL in googleApiClient.js.',
                    data: null
                };
            }

            const res = await postApi('registerPlayer', payload);
            if (!res.success) {
                return {
                    success: false,
                    error: res.error || 'Failed to register athlete in Google Sheets.',
                    data: null
                };
            }

            const normalized = normalizePlayer(res.data);
            // Cache verified record for instant reads
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const idx = localPlayers.findIndex(p => p.email === normalized.email);
                if (idx >= 0) localPlayers[idx] = normalized;
                else localPlayers.unshift(normalized);
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
                localStorage.setItem('unibox_phone_' + normalized.email.toLowerCase(), rawPhone);
            } catch (e) {}

            return { success: true, data: normalized, error: null, source: 'google_sheets' };
        },

        // --- ATHLETE STATUS: APPROVE / REJECT ---
        approvePlayer: async (playerIdOrEmail) => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const query = String(playerIdOrEmail).trim();
            const payload = query.includes('@') ? { email: query } : { id: query };
            const res = await postApi('approvePlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to approve athlete in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const p = localPlayers.find(x => x.id === playerIdOrEmail || x.email === playerIdOrEmail);
                if (p) {
                    p.status = 'Approved';
                    localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
                }
            } catch (e) {}

            return { success: true, status: 'Approved' };
        },

        rejectPlayer: async (playerIdOrEmail) => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const query = String(playerIdOrEmail).trim();
            const payload = query.includes('@') ? { email: query } : { id: query };
            const res = await postApi('rejectPlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to reject athlete in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const p = localPlayers.find(x => x.id === playerIdOrEmail || x.email === playerIdOrEmail);
                if (p) {
                    p.status = 'Rejected';
                    localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
                }
            } catch (e) {}

            return { success: true, status: 'Rejected' };
        },

        // --- ATHLETE DELETION ---
        deletePlayer: async (playerIdOrEmail) => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const query = String(playerIdOrEmail).trim();
            const payload = query.includes('@') ? { email: query } : { id: query };
            const res = await postApi('deletePlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to delete athlete from Google Sheets.' };
            }

            try {
                let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                localPlayers = localPlayers.filter(p => p.id !== playerIdOrEmail && p.email !== playerIdOrEmail);
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            } catch (e) {}

            return { success: true };
        },

        deletePlayers: async (idsArray) => {
            if (!Array.isArray(idsArray) || idsArray.length === 0) {
                return { success: true, count: 0 };
            }

            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }

            const res = await postApi('deletePlayers', { player_ids: idsArray });
            if (!res.success) {
                return { success: false, error: res.error || 'Bulk delete failed in Google Sheets.' };
            }

            try {
                let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                localPlayers = localPlayers.filter(p => !idsArray.includes(p.id) && !idsArray.includes(p.email));
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            } catch (e) {}

            return { success: true, count: idsArray.length };
        },

        deleteAllPlayers: async (confirmation = 'DELETE') => {
            const cleanConf = String(confirmation || '').trim().toUpperCase();
            if (cleanConf !== 'DELETE' && cleanConf !== 'DELETE ALL') {
                return { success: false, error: 'Confirmation word DELETE is required.' };
            }

            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }

            const res = await postApi('deleteAllPlayers', { confirmation: 'DELETE' });
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to bulk delete athletes from Google Sheets.' };
            }

            try {
                localStorage.setItem('unibox_players', '[]');
                localStorage.removeItem('unibox_auction_players_cache');
            } catch (e) {}

            return { success: true };
        },

        // --- TEAMS (READ & WRITE) ---
        getTeams: async (providedPlayers = null) => {
            let teams = [];
            let source = 'cache';

            if (isConfigured()) {
                const res = await getApi('getTeams');
                if (res.success && Array.isArray(res.data)) {
                    // Respect the authoritative Google Sheet team roster directly (do NOT force 8 teams)
                    teams = res.data;
                    source = 'google_sheets';
                }
            }

            if (!teams.length && !isConfigured()) {
                try {
                    const stored = localStorage.getItem('unibox_teams');
                    if (stored) teams = JSON.parse(stored);
                } catch (e) {}

                if (!teams || teams.length === 0) {
                    teams = DEFAULT_8_TEAMS.map(t => ({ ...t }));
                }
            }

            // Calculate spent & squad from players
            let players = providedPlayers;
            if (!players || !Array.isArray(players) || players.length === 0) {
                const { data } = await GoogleTourneyApi.getPlayers();
                players = data;
            }

            const enriched = teams.map(t => normalizeTeam(t, players)).filter(Boolean);

            try {
                localStorage.setItem('unibox_teams', JSON.stringify(enriched));
            } catch (e) {}

            return { data: enriched, error: null, source: source };
        },

        // --- FRANCHISE TEAM DELETION (POST) ---
        deleteTeam: async (teamId) => {
            if (!teamId) {
                return { success: false, error: 'Missing team ID' };
            }

            const cleanId = String(teamId).trim();

            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }

            const res = await postApi('deleteTeam', {
                action: 'deleteTeam',
                teamId: cleanId,
                team_id: cleanId,
                id: cleanId
            });

            if (!res.success) {
                return {
                    success: false,
                    error: res.error || 'Failed to delete franchise team from Google Sheets.'
                };
            }

            // Remove from local cache on confirmed Google Sheets deletion
            try {
                let teams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
                teams = teams.filter(t => t.id !== cleanId && t.team_name !== cleanId);
                localStorage.setItem('unibox_teams', JSON.stringify(teams));
            } catch (e) {}

            return {
                success: true,
                data: res.data || { deleted: true, teamId: cleanId }
            };
        },

        // --- AUCTION PURCHASE & REVOCATION ---
        purchasePlayer: async (params) => {
            const playerId = params.playerIdOrEmail || params.playerId || params.id;
            const teamId = params.teamId || params.sold_to_team;
            const soldPrice = Number(params.soldPrice || params.sold_price);

            if (isNaN(soldPrice) || soldPrice <= 0) {
                throw new Error('Please enter a valid purchase price.');
            }

            if (isConfigured()) {
                const res = await postApi('purchasePlayer', {
                    player_id: playerId,
                    team_id: teamId,
                    sold_price: soldPrice
                });

                if (!res.success) {
                    throw new Error(res.error || 'Failed to complete player purchase in Google Sheets.');
                }
            }

            // Sync local cache
            const { data: teams } = await GoogleTourneyApi.getTeams();
            const targetTeam = teams.find(t => t.id === teamId || t.name === teamId);

            return {
                success: true,
                team: targetTeam,
                player: { id: playerId, sold_to_team: targetTeam ? targetTeam.name : teamId, sold_price: soldPrice, auction_status: 'Sold' }
            };
        },

        revokePlayerPurchase: async (playerId) => {
            if (isConfigured()) {
                const res = await postApi('revokePlayerPurchase', { player_id: playerId });
                if (!res.success) {
                    throw new Error(res.error || 'Failed to revoke purchase in Google Sheets.');
                }
            }
            return { success: true };
        },

        // --- FILE UPLOADS TO GOOGLE DRIVE ---
        uploadPhoto: async (base64Data, filenamePrefix = 'athlete') => {
            if (!isConfigured()) {
                // Provisional data URL
                return { success: true, file_id: 'local_img_' + Date.now(), file_url: base64Data };
            }
            return await postApi('uploadPhoto', { photo_data: base64Data, prefix: filenamePrefix });
        },

        uploadCertificate: async (base64Data, filenamePrefix = 'cert') => {
            if (!isConfigured()) {
                return { success: true, file_id: 'local_cert_' + Date.now(), file_url: base64Data };
            }
            return await postApi('uploadCertificate', { certificate_data: base64Data, prefix: filenamePrefix });
        }
    };

    // Expose to window
    window.GoogleTourneyApi = GoogleTourneyApi;

})(typeof window !== 'undefined' ? window : this);
