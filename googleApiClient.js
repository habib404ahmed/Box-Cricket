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

    // Tournament Limits
    const MAX_FRANCHISES = 8;
    const MAX_SQUAD_SIZE = 10;

    // Secret key for privileged admin requests
    const ADMIN_SECRET_KEY = 'SPL2026_ADMIN_SECURE_AUTH_TOKEN_KEY';

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

        // Find active squad from players list (exclude Rejected, Pending, Unassigned, Deleted athletes)
        const tNameLower = resolvedName.toLowerCase();
        const tIdLower = resolvedId.toLowerCase();
        const rawSquad = Array.isArray(t.squad) ? t.squad : (allPlayers || []).filter(p => {
            const soldTeam = String(p.sold_to_team || '').trim().toLowerCase();
            return soldTeam && (soldTeam === tNameLower || soldTeam === tIdLower);
        });
        const squad = rawSquad.filter(p => {
            const isSold = String(p.auction_status || '').trim().toLowerCase() === 'sold';
            const isNotRejected = String(p.status || '').trim().toLowerCase() !== 'rejected';
            return isSold && isNotRejected;
        });

        const spent = Number(t.spent ?? t.total_spent ?? (squad.reduce((sum, p) => sum + (Number(p.sold_price) || 0), 0)));
        const remaining = Math.max(0, purse - spent);
        const count = squad.length;

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

    let _inFlightGetRequests = new Map();
    let _cachedPlayers = null;
    let _cachedTeams = null;

    /**
     * Executes GET request to Google Apps Script Web App
     */
    async function getApi(action, queryParams = {}, timeoutMs = 45000, retries = 1) {
        if (!isConfigured()) {
            console.error(`[API ERROR] action=${action} status=0 error=Google Apps Script Web App URL not configured`);
            return {
                configured: false,
                success: false,
                error: 'Google Apps Script Web App URL not configured yet in googleApiClient.js.'
            };
        }

        const actionName = action || 'unknown';
        console.log(`[API] Request started: action=${actionName}`);

        // Attach session_token if available (Section 8)
        let token = queryParams.session_token;
        if (!token && typeof window !== 'undefined') {
            try {
                const raw = sessionStorage.getItem('unibox_admin_session') || localStorage.getItem('unibox_admin_session');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed && parsed.session_token) token = parsed.session_token;
                }
            } catch (e) {}
        }

        const params = new URLSearchParams({
            action,
            ...(token ? { session_token: token } : {}),
            ...queryParams
        });
        const endpoint = `${GOOGLE_SCRIPT_WEB_APP_URL}?${params.toString()}`;

        // In-flight deduplication for identical concurrent GET queries
        if (_inFlightGetRequests.has(endpoint)) {
            return await _inFlightGetRequests.get(endpoint);
        }

        const reqPromise = (async () => {
            for (let attempt = 1; attempt <= retries + 1; attempt++) {
                const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
                let timeoutId = null;
                if (controller && timeoutMs > 0) {
                    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                }

                let response = null;
                try {
                    response = await fetch(endpoint, {
                        method: 'GET',
                        mode: 'cors',
                        redirect: 'follow',
                        cache: 'no-cache',
                        signal: controller ? controller.signal : undefined
                    });

                    if (timeoutId) clearTimeout(timeoutId);

                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                    }

                    const rawText = await response.text();
                    let json;
                    try {
                        json = JSON.parse(rawText);
                        const countVal = Array.isArray(json.data) ? json.data.length : (typeof json.count === 'number' ? json.count : 'N/A');
                        console.log(`[API] action=${actionName} status=${response.status} responseType=json success=${json.success} count=${countVal}`);
                    } catch (parseErr) {
                        console.warn(`[API ERROR] action=${actionName} status=${response.status} error=Invalid JSON response (len: ${rawText.length}) attempt=${attempt}`);
                        // If Apps Script returned non-JSON (e.g. transient Maestro container HTML page), retry once if attempts remain
                        if (attempt <= retries) {
                            await new Promise(r => setTimeout(r, 1200));
                            continue;
                        }
                        throw new Error('Invalid JSON response from Google Apps Script Web App.');
                    }
                    return { configured: true, ...json };
                } catch (err) {
                    if (timeoutId) clearTimeout(timeoutId);
                    const isTimeout = err.name === 'AbortError' || (err.message && err.message.toLowerCase().includes('timeout'));
                    const errMsg = isTimeout ? `Request timed out (${Math.round(timeoutMs/1000)}s).` : (err.message || String(err));
                    console.error(`[API ERROR] action=${actionName} status=${response ? response.status : (isTimeout ? 408 : 0)} error=${errMsg} attempt=${attempt}`);

                    if (attempt <= retries && !isTimeout) {
                        await new Promise(r => setTimeout(r, 1200));
                        continue;
                    }

                    return {
                        configured: true,
                        success: false,
                        isTimeout: Boolean(isTimeout),
                        error: errMsg
                    };
                }
            }
        })();

        _inFlightGetRequests.set(endpoint, reqPromise);
        try {
            return await reqPromise;
        } finally {
            _inFlightGetRequests.delete(endpoint);
        }
    }

    /**
     * Executes POST request to Google Apps Script Web App
     * Note: Sends body as text/plain JSON to avoid browser CORS preflight blocks with Google Apps Script
     * Features 45-second timeout guard and safe text-to-JSON parsing
     */
    async function postApi(action, payload = {}, timeoutMs = 45000) {
        if (!isConfigured()) {
            console.error(`[API ERROR] action=${action} status=0 error=Google Apps Script Web App URL not configured`);
            return {
                configured: false,
                success: false,
                error: 'Google Apps Script Web App URL not configured yet in googleApiClient.js.'
            };
        }

        const actionName = action || 'unknown';
        console.log(`[API] Request started: action=${actionName}`);

        // Determine caller role and secure admin token based strictly on authenticated admin session
        let callerRole = payload.role;
        let adminToken = payload.admin_token;
        let adminActor = payload.actor;
        let sessionToken = payload.session_token;

        if (typeof window !== 'undefined') {
            try {
                const rawAdminSession = sessionStorage.getItem('unibox_admin_session') || localStorage.getItem('unibox_admin_session');
                if (rawAdminSession) {
                    const sessionObj = JSON.parse(rawAdminSession);
                    if (sessionObj && (sessionObj.session_token || sessionObj.admin_token || sessionObj.role)) {
                        callerRole = 'ADMIN';
                        sessionToken = sessionObj.session_token || sessionToken;
                        adminToken = sessionObj.session_token || sessionObj.admin_token || ADMIN_SECRET_KEY;
                        adminActor = sessionObj.username || sessionObj.email || 'admin';
                    }
                }
            } catch (e) {}
        }

        if (!callerRole) {
            callerRole = 'FRANCHISE_OWNER';
        }

        const enrichedPayload = {
            action,
            role: callerRole,
            ...(sessionToken ? { session_token: sessionToken } : {}),
            ...(adminToken ? { admin_token: adminToken, actor: adminActor } : {}),
            ...payload
        };
        const requestBody = JSON.stringify(enrichedPayload);

        const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
        let timeoutId = null;
        if (controller && timeoutMs > 0) {
            timeoutId = setTimeout(() => {
                controller.abort();
            }, timeoutMs);
        }

        let response = null;
        try {
            response = await fetch(GOOGLE_SCRIPT_WEB_APP_URL, {
                method: 'POST',
                mode: 'cors',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: requestBody,
                signal: controller ? controller.signal : undefined
            });

            if (timeoutId) clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            // Safe text extraction before JSON parsing (Requirement 12)
            const rawText = await response.text();

            let json;
            try {
                json = JSON.parse(rawText);
                console.log(`[API] action=${actionName} status=${response.status} responseType=json success=${json.success}`);
            } catch (parseErr) {
                console.error(`[API ERROR] action=${actionName} status=${response.status} error=Invalid JSON response (len: ${rawText.length})`);
                throw new Error('Invalid JSON response from Google Apps Script Web App.');
            }

            return { configured: true, ...json };
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            const isTimeout = err.name === 'AbortError' || (err.message && err.message.toLowerCase().includes('timeout'));
            const errMsg = isTimeout
                ? `Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`
                : (err.message || String(err));
            console.error(`[API ERROR] action=${actionName} status=${response ? response.status : (isTimeout ? 408 : 0)} error=${errMsg}`);
            return {
                configured: true,
                success: false,
                isTimeout: Boolean(isTimeout),
                error: errMsg
            };
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

        // --- 1-SECOND LIGHTWEIGHT SYNC STATE (Requirement 8) ---
        getSyncState: async () => {
            if (!isConfigured()) return { success: false, configured: false };
            return await getApi('getSyncState', {}, 15000);
        },

        // --- PLAYERS (READ) ---
        getPlayers: async () => {
            if (isConfigured()) {
                try {
                    const res = await getApi('getPlayers', {}, 45000);
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

                        _cachedPlayers = normalized;

                        try {
                            localStorage.setItem('unibox_players', JSON.stringify(normalized));
                        } catch (e) {}
                        return { success: true, data: normalized, error: null, source: 'google_sheets' };
                    } else if (res && res.error) {
                        console.error('[PLAYERS] GoogleTourneyApi getPlayers error:', res.error);
                        if (_cachedPlayers && _cachedPlayers.length > 0) {
                            return { success: false, data: _cachedPlayers, isFallback: true, error: res.error, isTimeout: res.isTimeout, source: 'cache_fallback' };
                        }
                        return { success: false, data: [], error: res.error, isTimeout: res.isTimeout, source: 'error' };
                    }
                } catch (apiErr) {
                    console.error('[PLAYERS] getPlayers network error:', apiErr);
                    if (_cachedPlayers && _cachedPlayers.length > 0) {
                        return { success: false, data: _cachedPlayers, isFallback: true, error: apiErr.message || String(apiErr), source: 'cache_fallback' };
                    }
                    return { success: false, data: [], error: apiErr.message || String(apiErr), source: 'network_error' };
                }
            }

            // Fallback when not configured
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const normalized = (Array.isArray(localPlayers) ? localPlayers : []).map(normalizePlayer).filter(Boolean);
                _cachedPlayers = normalized;
                return { success: !isConfigured(), data: normalized, error: isConfigured() ? 'Failed to retrieve players from Google Sheets' : null, source: 'cache' };
            } catch (e) {
                return { success: false, data: [], error: 'Failed to retrieve athletes', source: 'cache' };
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

        // Fast & lightweight athlete count for public portal hero & counters
        getAthleteCount: async (statusFilter = null) => {
            if (_cachedPlayers && _cachedPlayers.length > 0) {
                if (!statusFilter || statusFilter === 'ALL') {
                    return { count: _cachedPlayers.length, success: true, source: 'cache' };
                }
                const filtered = _cachedPlayers.filter(p => String(p.status || '').toLowerCase() === String(statusFilter).toLowerCase());
                return { count: filtered.length, success: true, source: 'cache' };
            }
            try {
                const syncRes = await GoogleTourneyApi.getSyncState();
                if (syncRes && syncRes.success && syncRes.data && syncRes.data.playersCount !== undefined) {
                    if (!statusFilter || statusFilter === 'ALL') {
                        return { count: syncRes.data.playersCount, success: true, source: 'google_sheets' };
                    }
                }
            } catch (e) {}

            const pRes = await GoogleTourneyApi.getPlayers();
            const list = pRes.data || [];
            if (!statusFilter || statusFilter === 'ALL') {
                return { count: list.length, success: true, source: 'google_sheets' };
            }
            const filtered = list.filter(p => String(p.status || '').toLowerCase() === String(statusFilter).toLowerCase());
            return { count: filtered.length, success: true, source: 'google_sheets' };
        },

        // --- ADMIN AUTHENTICATION ---

        /**
         * Login as Admin via Google Apps Script + Sheets.
         * Sends username + password to GAS. Returns a session token on success.
         * Password is NEVER stored in browser storage.
         */
        adminLogin: async (username, password) => {
            if (!username || !password) {
                return { success: false, authenticated: false, error: 'Username and password are required.' };
            }
            if (!isConfigured()) {
                return { success: false, authenticated: false, error: 'Google Apps Script backend not configured.' };
            }
            try {
                const res = await postApi('loginAdmin', { username: String(username).trim(), password: String(password) }, 45000);
                if (!res.success || !res.authenticated) {
                    return { success: false, authenticated: false, error: res.error || 'Invalid Admin credentials.' };
                }
                return {
                    success: true,
                    authenticated: true,
                    session_token: res.session_token,
                    admin: res.admin
                };
            } catch (err) {
                return { success: false, authenticated: false, error: 'Authentication server unavailable. Please try again.' };
            }
        },

        loginAdmin: function(username, password) {
            return this.adminLogin(username, password);
        },

        /**
         * Validate an existing Admin session token with the server.
         */
        validateAdminSession: async (sessionToken) => {
            if (!sessionToken || !isConfigured()) {
                return { success: false, authenticated: false, error: 'SESSION_EXPIRED' };
            }
            try {
                const res = await postApi('validateAdminSession', { session_token: sessionToken }, 30000);
                return res;
            } catch (err) {
                return { success: false, authenticated: false, error: 'SERVER_ERROR' };
            }
        },

        /**
         * Logout Admin — invalidates the server-side session.
         */
        logoutAdmin: async (sessionToken) => {
            if (!sessionToken || !isConfigured()) return { success: true };
            try {
                await postApi('logoutAdmin', { session_token: sessionToken }, 10000);
            } catch (e) {}
            return { success: true };
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

            if (!isConfigured()) {
                return {
                    success: false,
                    error: 'Unable to connect to tournament database: Please deploy the Google Apps Script Web App and configure GOOGLE_SCRIPT_WEB_APP_URL in googleApiClient.js.',
                    data: null
                };
            }

            // PERFORMANCE FIX: Strip large Base64 file payloads from the registration request.
            // Sending photo + certificate data (1-5MB each) bloats the POST body causing
            // Google Apps Script to spend 30-60s on Drive uploads during registration, which
            // makes the frontend timeout and hang. Instead:
            //   1. Register core data instantly (~2-5s round trip)
            //   2. Upload files in background after success (non-blocking)
            const photoData = playerData.photo_data || null;
            const certData = playerData.certificate_data || null;
            const certNameBg = playerData.certificate_name || playerData.certificate || null;

            const payload = {
                ...playerData,
                department: dept,
                mobile_number: rawPhone,
                phone: rawPhone,
                photo_data: null,        // stripped — uploaded in background
                certificate_data: null   // stripped — uploaded in background
            };

            // Use 60s timeout: generous for GAS cold starts, without file payloads
            const res = await postApi('registerPlayer', payload, 60000);
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

            // BACKGROUND: Upload photo and certificate after registration succeeds (fire-and-forget).
            // These do NOT block the UI — the athlete is already on the dashboard.
            // Fulfils requirements 4, 5, 6, 7, 8, 9, 10, 14.
            if (photoData || certData) {
                // Capture identity now — never look up from closure to avoid wrong-athlete uploads (Req 10)
                const bgPlayerId = normalized.id;
                const bgEmail    = normalized.email;
                const bgCertName = certNameBg || 'Sports Certificate';
                // Req 9: track pending uploads so UI can show status and retry
                const pendingUploads = [];
                if (photoData)  pendingUploads.push({ type: 'photo',       data: photoData });
                if (certData)   pendingUploads.push({ type: 'certificate', data: certData  });

                // Notify the dashboard that uploads are starting (Req 9 — non-blocking status)
                try {
                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                        window.dispatchEvent(new CustomEvent('spl:bg_upload_start', {
                            detail: { playerId: bgPlayerId, email: bgEmail, uploads: pendingUploads.map(u => u.type) }
                        }));
                    }
                } catch (e) {}

                (async () => {
                    const results = {};

                    // --- Photo Upload ---
                    if (photoData) {
                        try {
                            const photoRes = await postApi('uploadPhoto', {
                                file_data: photoData,
                                player_id: bgPlayerId,
                                email: bgEmail
                            }, 90000);

                            if (photoRes.success && photoRes.file_url) {
                                results.photo = { success: true, file_url: photoRes.file_url, file_id: photoRes.file_id };

                                // Update localStorage cache (Req 14 — dashboard will refresh)
                                try {
                                    const cached = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                                    const pi = cached.findIndex(p => p.email === bgEmail);
                                    if (pi >= 0) {
                                        cached[pi].photo_file_url = photoRes.file_url;
                                        cached[pi].photo_file_id  = photoRes.file_id || '';
                                        cached[pi].photo_data     = photoRes.file_url;
                                        cached[pi].photo          = photoRes.file_url;
                                        localStorage.setItem('unibox_players', JSON.stringify(cached));
                                    }
                                    const cp = JSON.parse(localStorage.getItem('unibox_cached_profile') || '{}');
                                    if (cp.email === bgEmail) {
                                        cp.photo_file_url = photoRes.file_url;
                                        cp.photo_file_id  = photoRes.file_id || '';
                                        cp.photo_data     = photoRes.file_url;
                                        cp.photo          = photoRes.file_url;
                                        localStorage.setItem('unibox_cached_profile', JSON.stringify(cp));
                                    }
                                } catch (e) {}

                                // Req 14: Fire event so dashboard can refresh photo without page reload
                                try {
                                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                                        window.dispatchEvent(new CustomEvent('spl:bg_upload_done', {
                                            detail: { type: 'photo', playerId: bgPlayerId, email: bgEmail, file_url: photoRes.file_url }
                                        }));
                                    }
                                } catch (e) {}
                            } else {
                                results.photo = { success: false, error: photoRes.error || 'Photo upload failed.' };
                            }
                        } catch (photoErr) {
                            results.photo = { success: false, error: photoErr.message };
                            console.warn('[REGISTRATION] Background photo upload failed (non-fatal):', photoErr.message);
                        }
                    }

                    // --- Certificate Upload ---
                    if (certData) {
                        try {
                            const certRes = await postApi('uploadCertificate', {
                                file_data: certData,
                                player_id: bgPlayerId,
                                email: bgEmail,
                                certificate_name: bgCertName
                            }, 90000);

                            if (certRes.success && certRes.file_url) {
                                results.certificate = { success: true, file_url: certRes.file_url, file_id: certRes.file_id };

                                // Update localStorage cache
                                try {
                                    const cached = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                                    const pi = cached.findIndex(p => p.email === bgEmail);
                                    if (pi >= 0) {
                                        cached[pi].certificate_file_url = certRes.file_url;
                                        cached[pi].certificate_file_id  = certRes.file_id || '';
                                        cached[pi].certificate_data     = certRes.file_url;
                                        localStorage.setItem('unibox_players', JSON.stringify(cached));
                                    }
                                    const cp = JSON.parse(localStorage.getItem('unibox_cached_profile') || '{}');
                                    if (cp.email === bgEmail) {
                                        cp.certificate_file_url = certRes.file_url;
                                        cp.certificate_file_id  = certRes.file_id || '';
                                        cp.certificate_data     = certRes.file_url;
                                        localStorage.setItem('unibox_cached_profile', JSON.stringify(cp));
                                    }
                                } catch (e) {}

                                // Req 14: Fire event so dashboard can refresh cert link
                                try {
                                    if (typeof window !== 'undefined' && window.dispatchEvent) {
                                        window.dispatchEvent(new CustomEvent('spl:bg_upload_done', {
                                            detail: { type: 'certificate', playerId: bgPlayerId, email: bgEmail, file_url: certRes.file_url, cert_name: bgCertName }
                                        }));
                                    }
                                } catch (e) {}
                            } else {
                                results.certificate = { success: false, error: certRes.error || 'Certificate upload failed.' };
                            }
                        } catch (certErr) {
                            results.certificate = { success: false, error: certErr.message };
                            console.warn('[REGISTRATION] Background cert upload failed (non-fatal):', certErr.message);
                        }
                    }

                    // Req 9: Fire final status event (UI can show "upload complete" or "upload failed + retry")
                    const anyFailed = Object.values(results).some(r => !r.success);
                    try {
                        if (typeof window !== 'undefined' && window.dispatchEvent) {
                            window.dispatchEvent(new CustomEvent('spl:bg_upload_complete', {
                                detail: { playerId: bgPlayerId, email: bgEmail, results, anyFailed }
                            }));
                        }
                    } catch (e) {}
                })();
            }

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

        // --- BULK ATHLETE APPROVAL (POST) ---
        approvePlayers: async (playerIds) => {
            if (!Array.isArray(playerIds) || playerIds.length === 0) {
                return { success: true, data: { approvedCount: 0, skippedCount: 0, notFoundCount: 0 } };
            }
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const res = await postApi('approvePlayers', { playerIds: playerIds, player_ids: playerIds });
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to bulk approve athletes in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const idSet = new Set(playerIds.map(x => String(x).toLowerCase()));
                localPlayers.forEach(p => {
                    const pid = String(p.id || p.original_id || '').toLowerCase();
                    const pemail = String(p.email || '').toLowerCase();
                    if (idSet.has(pid) || idSet.has(pemail)) {
                        if (String(p.status || '').toLowerCase() !== 'rejected') {
                            p.status = 'Approved';
                        }
                    }
                });
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            } catch (e) {}

            return { success: true, data: res.data || { approvedCount: playerIds.length, skippedCount: 0, notFoundCount: 0 } };
        },

        approveAllPlayers: async () => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const res = await postApi('approveAllPlayers', {});
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to approve all pending athletes in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                localPlayers.forEach(p => {
                    const s = String(p.status || '').toLowerCase();
                    if (s !== 'approved' && s !== 'rejected') {
                        p.status = 'Approved';
                    }
                });
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            } catch (e) {}

            return { success: true, data: res.data || { approvedCount: 0, skippedCount: 0 } };
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

        // --- ATHLETE STATUS: UNAPPROVE (ADMIN ONLY) ---
        unapprovePlayer: async (playerIdOrEmail) => {
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const query = String(playerIdOrEmail).trim();
            const cleanId = query.replace(/-D\d+$/, '').trim();

            const res = await postApi('unapprovePlayer', { playerId: cleanId, id: cleanId, player_id: cleanId });
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to unapprove athlete in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const p = localPlayers.find(x => x.id === query || x.original_id === cleanId || x.email === query);
                if (p) {
                    p.status = 'Pending';
                    localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
                }
            } catch (e) {}

            return { success: true, status: 'Pending', data: res.data || { playerId: cleanId, status: 'Pending' } };
        },

        // --- BULK ATHLETE UNAPPROVAL (ADMIN ONLY) ---
        unapprovePlayers: async (playerIds) => {
            if (!Array.isArray(playerIds) || playerIds.length === 0) {
                return { success: true, data: { unapprovedCount: 0, skippedCount: 0, blockedSold: 0, notFoundCount: 0 } };
            }
            if (!isConfigured()) {
                return { success: false, error: 'Google backend is not configured yet.' };
            }
            const res = await postApi('unapprovePlayers', { playerIds: playerIds, player_ids: playerIds });
            if (!res.success) {
                return { success: false, error: res.error || 'Failed to bulk unapprove athletes in Google Sheets.' };
            }

            // Update local cache on successful Google Sheets write
            try {
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                const idSet = new Set(playerIds.map(x => String(x).toLowerCase()));
                localPlayers.forEach(p => {
                    const pid = String(p.id || p.original_id || '').toLowerCase();
                    const pemail = String(p.email || '').toLowerCase();
                    if (idSet.has(pid) || idSet.has(pemail)) {
                        p.status = 'Pending';
                    }
                });
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            } catch (e) {}

            return { success: true, data: res.data || { unapprovedCount: playerIds.length } };
        },

        updatePlayerStatus: async (playerIdOrEmail, status) => {
            const cleanStatus = String(status || '').trim();
            if (cleanStatus.toLowerCase() === 'approved') {
                return await window.GoogleTourneyApi.approvePlayer(playerIdOrEmail);
            } else if (cleanStatus.toLowerCase() === 'rejected') {
                return await window.GoogleTourneyApi.rejectPlayer(playerIdOrEmail);
            } else if (cleanStatus.toLowerCase() === 'pending' || cleanStatus.toLowerCase() === 'registered') {
                return await window.GoogleTourneyApi.unapprovePlayer(playerIdOrEmail);
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
            let fetchSuccess = false;
            let fetchError = null;
            let fetchTimeout = false;

            if (isConfigured()) {
                const res = await getApi('getTeams', { skipSquadCalc: 'true' }, 45000);
                if (res && res.success && Array.isArray(res.data)) {
                    // Respect the authoritative Google Sheet team roster directly (even if 0 teams)
                    teams = res.data;
                    source = 'google_sheets';
                    fetchSuccess = true;
                } else if (res) {
                    fetchError = res.error || 'Failed to retrieve franchises';
                    fetchTimeout = Boolean(res.isTimeout);
                }
            }

            if (!teams.length && !isConfigured()) {
                try {
                    const stored = localStorage.getItem('unibox_teams');
                    if (stored) teams = JSON.parse(stored);
                } catch (e) {}

                if (!teams || !Array.isArray(teams)) {
                    teams = [];
                }
            }

            // Calculate spent & squad from in-memory / provided players — NEVER trigger a separate network fetch!
            let players = providedPlayers;
            if (!players || !Array.isArray(players) || players.length === 0) {
                if (_cachedPlayers && _cachedPlayers.length > 0) {
                    players = _cachedPlayers;
                } else {
                    try {
                        players = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                    } catch (e) {
                        players = [];
                    }
                }
            }

            const enriched = teams.map(t => normalizeTeam(t, players)).filter(Boolean);
            if (fetchSuccess) {
                _cachedTeams = enriched;
                try {
                    localStorage.setItem('unibox_teams', JSON.stringify(enriched));
                } catch (e) {}
                return { success: true, data: enriched, error: null, source: 'google_sheets' };
            }

            if (_cachedTeams && _cachedTeams.length > 0) {
                return { success: false, data: _cachedTeams, isFallback: true, error: fetchError, isTimeout: fetchTimeout, source: 'cache_fallback' };
            }

            return {
                success: !isConfigured(),
                data: enriched,
                error: fetchError || (isConfigured() ? 'Failed to retrieve teams' : null),
                isTimeout: fetchTimeout,
                source: source
            };
        },

        // --- FRANCHISE REGISTRATION & CREATION (POST) ---
        createTeam: async (franchiseData) => {
            if (!isConfigured()) {
                return {
                    success: false,
                    error: 'Unable to connect to tournament database. Please try again.'
                };
            }

            // Critical Security: Verify Admin session before calling createTeam
            let adminSession = null;
            try {
                const raw = sessionStorage.getItem('unibox_admin_session') || localStorage.getItem('unibox_admin_session');
                if (raw) adminSession = JSON.parse(raw);
            } catch (e) {}

            if (!adminSession) {
                return {
                    success: false,
                    error: 'Unauthorized: Admin session required to create a franchise.'
                };
            }

            const clientRequestId = 'req_team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
            const teamPayload = {
                team_name: franchiseData.team_name || franchiseData.name,
                name: franchiseData.team_name || franchiseData.name,
                short_name: franchiseData.short_name || (franchiseData.team_name || '').substring(0, 4).toUpperCase(),
                owner_name: franchiseData.owner_name,
                owner_email: franchiseData.owner_email || franchiseData.email,
                email: franchiseData.owner_email || franchiseData.email,
                password: franchiseData.password || franchiseData.rawPassword,
                rawPassword: franchiseData.password || franchiseData.rawPassword,
                purse: Number(franchiseData.purse) || 1000,
                budget: Number(franchiseData.purse) || 1000,
                logo: franchiseData.logo || '🏏',
                department: franchiseData.department || franchiseData.short_name || 'Campus',
                role: 'ADMIN',
                admin_token: adminSession.admin_token || ADMIN_SECRET_KEY,
                actor: adminSession.username || adminSession.email || 'admin',
                request_id: clientRequestId
            };

            // Call createTeam directly for single fast network roundtrip (Requirement 3 & 7)
            let res = await postApi('createTeam', teamPayload, 25000);

            // Fallback to registerFranchise if createTeam is unknown on an alternative deployment
            if (!res || (!res.success && res.error && res.error.includes('Unknown POST action'))) {
                res = await postApi('registerFranchise', teamPayload, 25000);
            }

            if (!res || !res.success) {
                return {
                    success: false,
                    isTimeout: Boolean(res?.isTimeout),
                    error: res?.error || 'Unable to connect to tournament database. Please try again.'
                };
            }

            // Normalizes team object across both { teamId: "..." } and { data: { team: {...} } } responses
            const rawTeam = res.data?.team || res.team || res.data || {};
            const createdTeam = {
                id: rawTeam.id || res.teamId || res.team_id || ('SPL-TEAM-' + Date.now().toString().slice(-4)),
                team_name: rawTeam.team_name || rawTeam.name || teamPayload.team_name,
                name: rawTeam.name || rawTeam.team_name || teamPayload.team_name,
                short_name: rawTeam.short_name || teamPayload.short_name,
                owner_name: rawTeam.owner_name || teamPayload.owner_name,
                owner_email: rawTeam.owner_email || teamPayload.owner_email,
                purse: Number(rawTeam.purse || teamPayload.purse || 1000),
                total_budget: Number(rawTeam.total_budget || rawTeam.purse || teamPayload.purse || 1000),
                total_spent: 0,
                spent: 0,
                remaining_purse: Number(rawTeam.remaining_purse || rawTeam.purse || teamPayload.purse || 1000),
                leftover_balance: Number(rawTeam.leftover_balance || rawTeam.purse || teamPayload.purse || 1000),
                player_count: 0,
                squad_count: 0,
                squad: [],
                status: 'Active',
                logo: rawTeam.logo || teamPayload.logo || '🏏',
                created_at: rawTeam.created_at || new Date().toISOString()
            };

            // Update in-memory cache and localStorage immediately (Requirement 12)
            try {
                let localTeams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
                if (!localTeams.some(t => t.id === createdTeam.id || (t.team_name && t.team_name.toLowerCase() === createdTeam.team_name.toLowerCase()))) {
                    localTeams.push(createdTeam);
                    localStorage.setItem('unibox_teams', JSON.stringify(localTeams));
                }
                if (_cachedTeams) {
                    if (!_cachedTeams.some(t => t.id === createdTeam.id)) {
                        _cachedTeams.push(createdTeam);
                    }
                }
            } catch (e) {}

            return {
                success: true,
                data: { team: createdTeam },
                team: createdTeam,
                teamId: createdTeam.id,
                message: res.message || 'Franchise team created successfully.'
            };
        },

        registerFranchise: async (franchiseData) => {
            return await GoogleTourneyApi.createTeam(franchiseData);
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

            // Client-side squad size check
            if (_cachedTeams && _cachedTeams.length) {
                const targetTeam = _cachedTeams.find(t => t.id === teamId || t.name === teamId);
                if (targetTeam && (Number(targetTeam.squad_count) >= MAX_SQUAD_SIZE || (targetTeam.squad && targetTeam.squad.length >= MAX_SQUAD_SIZE))) {
                    throw new Error('Squad limit reached. A franchise can contain a maximum of ' + MAX_SQUAD_SIZE + ' players.');
                }
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

        // --- BASE PRICE MANAGEMENT ---
        getDefaultBasePriceForRole: (role, customPrices = null) => {
            const prices = customPrices || GoogleTourneyApi.getRoleBasePrices();
            const cleanRole = String(role || '').trim();
            return Number(prices[cleanRole] ?? 15);
        },

        getRoleBasePrices: () => {
            const defaults = {
                'Batsman': 15,
                'Bowler': 15,
                'All-Rounder': 20,
                'Wicket Keeper': 15,
                'Wicketkeeper': 15,
                'Captain': 25
            };
            try {
                const stored = localStorage.getItem('unibox_role_base_prices');
                if (stored) return { ...defaults, ...JSON.parse(stored) };
            } catch (e) {}
            return defaults;
        },

        saveRoleBasePrices: (prices) => {
            try {
                localStorage.setItem('unibox_role_base_prices', JSON.stringify(prices));
                return true;
            } catch (e) {
                return false;
            }
        },

        updatePlayerBasePrice: async (playerIdOrEmail, basePrice) => {
            const num = Number(basePrice);
            if (isNaN(num) || num < 0) throw new Error('Invalid base price value');
            if (isConfigured()) {
                const res = await postApi('updatePlayer', { id: playerIdOrEmail, base_price: num });
                if (!res.success) throw new Error(res.error || 'Failed to update base price in Google Sheets');
            }
            if (_cachedPlayers && _cachedPlayers.length) {
                const p = _cachedPlayers.find(x => x.id === playerIdOrEmail || x.email === playerIdOrEmail);
                if (p) p.base_price = num;
            }
            return { success: true };
        },

        uploadCertificate: async (base64Data, filenamePrefix = 'cert') => {
            if (!isConfigured()) {
                return { success: true, file_id: 'local_cert_' + Date.now(), file_url: base64Data };
            }
            return await postApi('uploadCertificate', { certificate_data: base64Data, prefix: filenamePrefix });
        }
    };

    // Expose constants to GoogleTourneyApi
    GoogleTourneyApi.MAX_FRANCHISES = MAX_FRANCHISES;
    GoogleTourneyApi.MAX_SQUAD_SIZE = MAX_SQUAD_SIZE;

    // Expose to window
    window.MAX_FRANCHISES = MAX_FRANCHISES;
    window.MAX_SQUAD_SIZE = MAX_SQUAD_SIZE;
    window.GoogleTourneyApi = GoogleTourneyApi;
    if (typeof window !== 'undefined' && !window.UniBoxDb) {
        window.UniBoxDb = GoogleTourneyApi;
    }

})(typeof window !== 'undefined' ? window : this);
