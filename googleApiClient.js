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
     * Normalizes a player record with strict type conversions (Step 1, 2, 3, 9, 10).
     * Prevents any runtime exceptions like (player.enrollment_no || "").toLowerCase is not a function.
     */
    function normalizePlayer(player) {
        if (!player || typeof player !== 'object') return null;

        const id = String(player.id ?? player.original_id ?? "").trim();
        const createdAt = String(player.created_at ?? "").trim() || new Date().toISOString();
        const fullName = String(player.full_name ?? player.name ?? "").trim();
        // Step 2: enrollment_no MUST ALWAYS be a string
        const enrollment = String(player.enrollment_no ?? "").trim();
        const dept = String(player.department ?? player.branch ?? "").trim();
        const email = String(player.email ?? "").trim().toLowerCase();
        // Step 9: mobile_number MUST ALWAYS be a string
        const mobile = String(player.mobile_number ?? player.phone ?? "").trim();
        const gender = String(player.gender ?? "Male").trim();
        const role = String(player.player_role ?? player.role ?? "All-Rounder").trim();
        const status = String(player.status ?? "Registered").trim();
        // Step 10: base_price and sold_price numeric
        const basePrice = Number(player.base_price ?? 0) || 15;
        const soldTo = String(player.sold_to_team ?? "").trim();
        const soldPrice = (player.sold_price !== undefined && player.sold_price !== null && player.sold_price !== '' && !isNaN(Number(player.sold_price)))
            ? Number(player.sold_price)
            : null;
        const auctionStatus = (soldTo || soldPrice) ? 'Sold' : String(player.auction_status ?? "Upcoming").trim();
        const photoId = String(player.photo_file_id ?? "").trim();
        const photoUrl = String(player.photo_file_url ?? player.photo_data ?? player.photo ?? "").trim();
        const certId = String(player.certificate_file_id ?? "").trim();
        const certUrl = String(player.certificate_file_url ?? player.certificate_data ?? "").trim();
        const certName = String(player.certificate_name ?? player.certificate ?? (certUrl ? "Attached Document" : "None attached")).trim();

        return {
            id: id || ('ath_' + (email || Date.now()).replace(/[^a-zA-Z0-9]/g, '_')),
            original_id: String(player.original_id ?? id).trim(),
            created_at: createdAt,
            full_name: fullName,
            name: fullName,
            enrollment_no: enrollment,
            department: dept,
            branch: dept,
            email: email,
            mobile_number: mobile,
            phone: mobile,
            gender: gender,
            player_role: role,
            role: role,
            status: status,
            base_price: basePrice,
            auction_status: auctionStatus,
            sold_to_team: soldTo,
            sold_price: soldPrice,
            photo_file_id: photoId,
            photo_file_url: photoUrl,
            photo_data: photoUrl,
            photo: photoUrl,
            certificate_file_id: certId,
            certificate_file_url: certUrl,
            certificate_data: certUrl,
            certificate_name: certName,
            certificate: certName
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
            owner_name: (t.owner_name && String(t.owner_name).trim() && String(t.owner_name).trim() !== 'undefined' && String(t.owner_name).trim() !== 'null') ? String(t.owner_name).trim() : '',
            owner_email: (t.owner_email && String(t.owner_email).trim() && String(t.owner_email).trim() !== 'undefined' && String(t.owner_email).trim() !== 'null') ? String(t.owner_email).trim().toLowerCase() : '',
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
                try {
                    const res = await getApi('getPlayers');
                    if (res && res.success && Array.isArray(res.data)) {
                        const seenIds = new Map();
                        const normalized = res.data.map(p => {
                            const norm = normalizePlayer(p);
                            if (!norm) return null;
                            const baseId = norm.id;
                            const count = (seenIds.get(baseId) || 0) + 1;
                            seenIds.set(baseId, count);
                            if (count > 1) {
                                norm.id = `${baseId}-D${count}`;
                            }
                            return norm;
                        }).filter(Boolean);

                        try {
                            localStorage.setItem('unibox_players', JSON.stringify(normalized));
                        } catch (e) {}
                        return { success: true, data: normalized, error: null, source: 'google_sheets' };
                    } else if (res && res.error) {
                        console.error('[PLAYERS] GoogleTourneyApi getPlayers error:', res.error);
                    }
                } catch (apiErr) {
                    console.error('[PLAYERS] getPlayers network error:', apiErr);
                }
            }

            // Fallback
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const normalized = (Array.isArray(localPlayers) ? localPlayers : []).map(normalizePlayer).filter(Boolean);
                return { success: true, data: normalized, error: null, source: 'cache' };
            } catch (e) {
                return { success: true, data: [], error: null, source: 'cache' };
            }
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
            const cleanId = query.replace(/-D\d+$/, '').trim();
            let pEmail = '';
            let pEnroll = '';
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const found = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
                if (found) {
                    pEmail = found.email || '';
                    pEnroll = found.enrollment_no || '';
                }
            } catch (e) {}

            const payload = query.includes('@')
                ? { email: query, id: cleanId, original_id: cleanId, enrollment_no: pEnroll }
                : { id: cleanId, original_id: cleanId, email: pEmail, enrollment_no: pEnroll };

            const res = await postApi('approvePlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to approve athlete in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const p = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
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
            const cleanId = query.replace(/-D\d+$/, '').trim();
            let pEmail = '';
            let pEnroll = '';
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const found = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
                if (found) {
                    pEmail = found.email || '';
                    pEnroll = found.enrollment_no || '';
                }
            } catch (e) {}

            const payload = query.includes('@')
                ? { email: query, id: cleanId, original_id: cleanId, enrollment_no: pEnroll }
                : { id: cleanId, original_id: cleanId, email: pEmail, enrollment_no: pEnroll };

            const res = await postApi('rejectPlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to reject athlete in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const p = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
                if (p) {
                    p.status = 'Rejected';
                    localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
                }
            } catch (e) {}

            return { success: true, status: 'Rejected' };
        },

        updatePlayerStatus: async (playerIdOrEmail, status) => {
            const cleanStatus = String(status || '').trim();
            if (cleanStatus.toLowerCase() === 'approved') {
                return await window.GoogleTourneyApi.approvePlayer(playerIdOrEmail);
            } else if (cleanStatus.toLowerCase() === 'rejected') {
                return await window.GoogleTourneyApi.rejectPlayer(playerIdOrEmail);
            }
            return await window.GoogleTourneyApi.updatePlayer({ id: playerIdOrEmail, status: cleanStatus });
        },

        // --- ATHLETE DELETION ---
        deletePlayer: async (playerIdOrEmail) => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const query = String(playerIdOrEmail).trim();
            const cleanId = query.replace(/-D\d+$/, '').trim();
            let pEmail = '';
            let pEnroll = '';
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const found = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
                if (found) {
                    pEmail = found.email || '';
                    pEnroll = found.enrollment_no || '';
                }
            } catch (e) {}

            const payload = query.includes('@')
                ? { email: query, id: cleanId, original_id: cleanId, enrollment_no: pEnroll }
                : { id: cleanId, original_id: cleanId, email: pEmail, enrollment_no: pEnroll };

            const res = await postApi('deletePlayer', payload);
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to delete athlete from Google Sheets.' };
            }

            try {
                let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                localPlayers = localPlayers.filter(p => p.id !== query && p.original_id !== cleanId && p.email !== query);
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
            const cleanConf = String(confirmation || '').trim();
            // Step 2 & 19: Strict verification — only exactly "DELETE" is valid
            if (cleanConf !== 'DELETE') {
                return { success: false, error: 'Confirmation word must be exactly "DELETE".' };
            }

            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }

            const res = await postApi('deleteAllPlayers', { confirmation: 'DELETE' });
            if (!res || !res.success) {
                return { success: false, error: res?.error || 'Failed to bulk delete athletes from Google Sheets.' };
            }

            try {
                localStorage.setItem('unibox_players', '[]');
                localStorage.removeItem('unibox_auction_players_cache');
            } catch (e) {}

            const deletedCount = Number(res.data?.deletedCount ?? res.deletedCount ?? res.deleted_count ?? res.count ?? 0);
            return {
                success: true,
                data: {
                    deletedCount: deletedCount
                },
                deletedCount: deletedCount,
                message: res.message || 'All athlete registration records deleted successfully from Google Sheets.'
            };
        },

        // --- TEAMS (READ & WRITE) ---
        getTeams: async (providedPlayers = null) => {
            let teams = [];
            let source = 'cache';

            if (isConfigured()) {
                const res = await getApi('getTeams');
                if (res.success && Array.isArray(res.data)) {
                    // Respect the authoritative Google Sheet team roster directly
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

            return { success: true, data: enriched, error: null, source: source };
        },

        // --- FRANCHISE REGISTRATION & CREATION (POST) ---
        registerFranchise: async (franchiseData) => {
            if (!isConfigured()) {
                return {
                    success: false,
                    error: 'Unable to connect to tournament database. Please try again.'
                };
            }

            let res = await postApi('registerFranchise', franchiseData);
            if (!res || !res.success) {
                // If remote Apps Script has not been updated with registerFranchise yet, fall back to createTeam
                if (res && res.error && res.error.includes('Unknown POST action')) {
                    const fallbackRes = await postApi('createTeam', {
                        team_name: franchiseData.team_name,
                        short_name: franchiseData.short_name || franchiseData.team_name?.substring(0, 4).toUpperCase(),
                        purse: Number(franchiseData.purse) || 1000,
                        owner_name: franchiseData.owner_name,
                        owner_email: franchiseData.owner_email || franchiseData.email
                    });
                    if (fallbackRes && fallbackRes.success) {
                        res = {
                            success: true,
                            data: {
                                team: {
                                    id: fallbackRes.teamId || ('SPL-TEAM-' + Date.now().toString().slice(-4)),
                                    team_name: franchiseData.team_name,
                                    name: franchiseData.team_name,
                                    short_name: franchiseData.short_name || franchiseData.team_name?.substring(0, 4).toUpperCase(),
                                    owner_name: franchiseData.owner_name,
                                    owner_email: franchiseData.owner_email || franchiseData.email,
                                    purse: Number(franchiseData.purse) || 1000,
                                    total_budget: Number(franchiseData.purse) || 1000,
                                    total_spent: 0,
                                    spent: 0,
                                    remaining_purse: Number(franchiseData.purse) || 1000,
                                    leftover_balance: Number(franchiseData.purse) || 1000,
                                    player_count: 0,
                                    squad_count: 0,
                                    squad: [],
                                    status: 'Active',
                                    created_at: new Date().toISOString()
                                },
                                owner: {
                                    owner_name: franchiseData.owner_name,
                                    owner_email: franchiseData.owner_email || franchiseData.email,
                                    team_id: fallbackRes.teamId
                                }
                            }
                        };
                    }
                }
            }

            if (!res || !res.success) {
                return {
                    success: false,
                    error: res?.error || 'Unable to connect to tournament database. Please try again.'
                };
            }

            // Sync with Google Sheets immediately
            await GoogleTourneyApi.getTeams();

            return {
                success: true,
                data: res.data,
                team: res.data?.team,
                owner: res.data?.owner,
                message: res.message || 'Franchise registered successfully.'
            };
        },

        // Alias for franchise team creation
        createTeam: async (teamData) => {
            return await GoogleTourneyApi.registerFranchise(teamData);
        },

        // --- FRANCHISE AUTHENTICATION (POST) ---
        loginFranchise: async (email, password) => {
            if (!isConfigured()) {
                return {
                    success: false,
                    error: 'Unable to connect to tournament database. Please try again.'
                };
            }

            let res = await postApi('loginFranchise', { email, password });
            if (!res || !res.success) {
                if (res && res.error && res.error.includes('Unknown POST action')) {
                    // Fallback to Google Sheets Teams list verification
                    const teamsRes = await GoogleTourneyApi.getTeams();
                    const allTeams = teamsRes.data || [];
                    const normEmail = email.trim().toLowerCase();
                    const matchedTeam = allTeams.find(t => (t.owner_email && t.owner_email.toLowerCase() === normEmail));
                    if (matchedTeam) {
                        res = {
                            success: true,
                            data: {
                                team_id: matchedTeam.id,
                                teamId: matchedTeam.id,
                                owner_name: matchedTeam.owner_name || 'Franchise Owner',
                                ownerName: matchedTeam.owner_name || 'Franchise Owner',
                                owner_email: normEmail,
                                email: normEmail,
                                team_name: matchedTeam.name || matchedTeam.team_name,
                                teamName: matchedTeam.name || matchedTeam.team_name,
                                team: matchedTeam
                            }
                        };
                    }
                }
            }

            if (!res || !res.success) {
                return {
                    success: false,
                    error: res?.error || 'Authentication failed. Please verify credentials.'
                };
            }

            return {
                success: true,
                data: res.data,
                team: res.data?.team,
                message: res.message || 'Authenticated successfully.'
            };
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
                const deletedSet = new Set(JSON.parse(localStorage.getItem('unibox_deleted_teams') || '[]'));
                deletedSet.add(cleanId);
                localStorage.setItem('unibox_deleted_teams', JSON.stringify([...deletedSet]));

                let teams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
                teams = teams.filter(t => String(t.id).trim() !== cleanId && String(t.team_name || t.name).trim() !== cleanId);
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
