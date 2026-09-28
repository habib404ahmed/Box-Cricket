// ==============================================================================
// Sunstone Premier League 2026 - Tournament Admin Command Center Controller
// ==============================================================================

let allPlayers = [];
let filteredPlayers = [];
let allTeams = [];
let activeModalPlayer = null;
let activePurchasePlayer = null;
let activeEditBasePlayer = null;
let activeSquadTeamId = null;

// DOM Elements
const rosterTableBody = document.getElementById('roster-table-body');
const searchInput = document.getElementById('filter-search');
const deptFilter = document.getElementById('filter-dept');
const roleFilter = document.getElementById('filter-role');
const statusFilter = document.getElementById('filter-status');
const auctionFilter = document.getElementById('filter-auction');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const exportCsvBtn = document.getElementById('export-csv-btn');
const tableSummaryCount = document.getElementById('table-summary-count');
const teamsHudContainer = document.getElementById('teams-hud-container');

// KPI Counter Elements
const statTotal = document.getElementById('stat-total');
const statApproved = document.getElementById('stat-approved');
const statPending = document.getElementById('stat-pending');
const statDepts = document.getElementById('stat-depts');
const statApprovedBar = document.getElementById('stat-approved-bar');
const statPendingBar = document.getElementById('stat-pending-bar');

// Modal Elements
const athleteModal = document.getElementById('athlete-modal');
const modalPhoto = document.getElementById('modal-photo');
const modalPhotoPlaceholder = document.getElementById('modal-photo-placeholder');
const modalName = document.getElementById('modal-name');
const modalEmail = document.getElementById('modal-email');
const modalEnrollment = document.getElementById('modal-enrollment');
const modalPhone = document.getElementById('modal-phone');
const modalDept = document.getElementById('modal-dept');
const modalGender = document.getElementById('modal-gender');
const modalRole = document.getElementById('modal-role');
const modalBasePrice = document.getElementById('modal-base-price');
const modalAuctionStatus = document.getElementById('modal-auction-status');
const modalSoldBadgeContainer = document.getElementById('modal-sold-badge-container');
const modalPurchaseBtn = document.getElementById('modal-purchase-btn');
const modalCert = document.getElementById('modal-cert');
const modalCreated = document.getElementById('modal-created');
const modalStatusBadge = document.getElementById('modal-status-badge');
const modalApproveBtn = document.getElementById('modal-approve-btn');
const modalRejectBtn = document.getElementById('modal-reject-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn');

// Toast Elements
const toastBanner = document.getElementById('toast-banner');
const toastIcon = document.getElementById('toast-icon');
const toastMessage = document.getElementById('toast-message');

// ==============================================================================
// ADMIN CENTRALIZED IN-MEMORY STATE (Requirement 4)
// ==============================================================================
const adminState = {
    players: [],
    teams: [],
    auction: {},
    stats: {
        totalRegistered: 0,
        verifiedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        auctionCount: 0,
        totalFranchises: 0
    },
    lastSyncTimestamp: null,
    isInitialLoaded: false,
    playersSignature: '',
    teamsSignature: '',
    lastFullSyncTime: 0
};

let syncGeneration = 0;
let adminRefreshInterval = null;
let isRefreshingAdminData = false;
let isDeletingTeam = false;
let isDeletingAllPlayers = false;
let isCreatingFranchise = false;
let lastDeleteAllTimestamp = 0;
let lastPlayersSignature = '';
let lastTeamsSignature = '';

// Bulk Athlete Selection & Approval State
let selectedAthleteIds = new Set();
let isBulkApproving = false;
const recentlyApprovedPlayerIds = new Map(); // id/email (lowercase) -> timestamp

// Helper to determine if an athlete is eligible for approval (Pending / Registered / empty)
function isAthleteEligibleForApproval(player) {
    if (!player) return false;
    const s = String(player.status || 'Registered').trim().toLowerCase();
    return s !== 'approved' && s !== 'rejected';
}

// Guard set against deleted teams resurrection from in-flight/stale background polls
const pendingOrDeletedTeamIds = new Set(
    (function() {
        try {
            return JSON.parse(localStorage.getItem('unibox_deleted_teams') || '[]').map(id => String(id).trim());
        } catch (e) {
            return [];
        }
    })()
);

// Skeletons for independent, non-blocking section rendering (Requirement 3)
function renderRosterSkeletonRows() {
    return Array.from({ length: 5 }).map(() => `
        <tr class="animate-pulse">
            <td class="p-4"><div class="w-4 h-4 bg-slate-800/80 rounded"></div></td>
            <td class="p-4"><div class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-slate-800/80 shrink-0"></div><div class="space-y-1.5"><div class="w-28 h-3.5 bg-slate-800/80 rounded"></div><div class="w-20 h-2.5 bg-slate-800/40 rounded"></div></div></div></td>
            <td class="p-4"><div class="w-24 h-5 bg-slate-800/80 rounded-lg"></div></td>
            <td class="p-4"><div class="w-20 h-5 bg-slate-800/80 rounded-lg"></div></td>
            <td class="p-4"><div class="w-16 h-5 bg-slate-800/80 rounded-full"></div></td>
            <td class="p-4"><div class="w-16 h-5 bg-slate-800/80 rounded-md"></div></td>
            <td class="p-4"><div class="w-20 h-7 bg-slate-800/80 rounded-xl"></div></td>
        </tr>
    `).join('');
}

function renderTeamsSkeletonCards() {
    return Array.from({ length: 5 }).map(() => `
        <div class="p-4 rounded-2xl bg-[#08111F]/50 border border-sky-950/60 animate-pulse space-y-3">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-slate-800/80"></div>
                <div class="space-y-1"><div class="w-20 h-3 bg-slate-800/80 rounded"></div><div class="w-14 h-2.5 bg-slate-800/40 rounded"></div></div>
            </div>
            <div class="space-y-1.5"><div class="w-full h-2 bg-slate-800/80 rounded-full"></div><div class="w-24 h-2.5 bg-slate-800/80 rounded"></div></div>
        </div>
    `).join('');
}

// Live Status Badge Indicator (Requirement 14)
function updateLiveStatus(status, extraText = '') {
    const dbStatusBadge = document.getElementById('db-status-badge');
    const dbStatusText = document.getElementById('db-status-text');
    if (!dbStatusBadge || !dbStatusText) return;

    dbStatusBadge.classList.remove('hidden');

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (status === 'live') {
        dbStatusBadge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08111F] border border-emerald-500/30 text-[11px] font-bold text-emerald-400';
        dbStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 inline-block mr-1"></span> LIVE • ${timeStr}`;
    } else if (status === 'syncing') {
        dbStatusBadge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08111F] border border-sky-500/30 text-[11px] font-bold text-sky-400';
        dbStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400 animate-pulse inline-block mr-1"></span> SYNCING...`;
    } else if (status === 'connection_issue') {
        dbStatusBadge.className = 'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#08111F] border border-amber-500/30 text-[11px] font-bold text-amber-400';
        dbStatusText.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400 inline-block mr-1"></span> ⚠ CONNECTION ISSUE`;
    }
}

// Initialize Admin Dashboard with non-blocking parallel shell (Requirement 2 & 3)
let isDashboardInitialized = false;
async function initAdminDashboard() {
    if (isDashboardInitialized) return;
    isDashboardInitialized = true;

    initDbStatus();
    bindEventListeners();
    initRealtimeAuctionSync();

    // Show non-blocking skeleton loaders immediately (Requirement 3)
    if (rosterTableBody && !allPlayers.length) {
        rosterTableBody.innerHTML = renderRosterSkeletonRows();
    }
    if (teamsHudContainer && !allTeams.length) {
        teamsHudContainer.innerHTML = renderTeamsSkeletonCards();
    }

    // Parallel Initial Data Load (Requirement 2)
    try {
        const playersPromise = (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getPlayers === 'function')
            ? window.GoogleTourneyApi.getPlayers()
            : (window.UniBoxDb ? window.UniBoxDb.getAllPlayers() : Promise.resolve({ data: [] }));

        const teamsPromise = (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getTeams === 'function')
            ? window.GoogleTourneyApi.getTeams()
            : (window.UniBoxDb ? window.UniBoxDb.getAllTeams() : Promise.resolve({ data: [] }));

        const [playersRes, teamsRes] = await Promise.allSettled([playersPromise, teamsPromise]);

        // Process Players
        if (playersRes.status === 'fulfilled' && playersRes.value && (playersRes.value.success || Array.isArray(playersRes.value.data))) {
            const raw = Array.isArray(playersRes.value.data) ? playersRes.value.data : [];
            const normalized = raw.map(normalizePlayer).filter(Boolean);
            adminState.players = normalized;
            allPlayers = normalized;
            window.allPlayers = allPlayers;
            adminState.playersSignature = computePlayersSignature(allPlayers);
            lastPlayersSignature = adminState.playersSignature;
        }

        // Process Teams
        if (teamsRes.status === 'fulfilled' && teamsRes.value && (teamsRes.value.success || Array.isArray(teamsRes.value.data))) {
            const rawTeams = Array.isArray(teamsRes.value.data) ? teamsRes.value.data : [];
            const filteredTeams = rawTeams.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
            adminState.teams = filteredTeams;
            allTeams = filteredTeams;
            adminState.teamsSignature = computeTeamsSignature(allTeams);
            lastTeamsSignature = adminState.teamsSignature;
        }

        adminState.lastFullSyncTime = Date.now();
        adminState.isInitialLoaded = true;

        // Render UI sections immediately from single in-memory state
        updateMetrics();
        applyFilters();
        renderTeamBalanceHUD();
        updateLiveStatus('live');
    } catch (initErr) {
        console.error('[ADMIN INIT] Error during initial parallel load:', initErr);
        updateLiveStatus('connection_issue');
    }

    // Start background auto-refresh every 1 second (1000ms)
    startAutoRefresh();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminDashboard);
} else {
    initAdminDashboard();
}

// Tab Visibility optimization: Pause polling when hidden, immediate sync when visible (Requirement 31)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (adminState.isInitialLoaded) {
            refreshAdminData(false);
        }
    }
});

// Central player normalizer conforming to Step 3 specification
function normalizePlayer(player) {
    if (!player || typeof player !== 'object') return null;

    const id = String(player?.id ?? player?.original_id ?? "").trim();
    const createdAt = String(player?.created_at ?? "").trim() || new Date().toISOString();
    const fullName = String(player?.full_name ?? player?.name ?? "").trim();
    const enrollment = String(player?.enrollment_no ?? "").trim();
    const department = String(player?.department ?? player?.branch ?? "").trim();
    const email = String(player?.email ?? "").trim();
    const mobile = String(player?.mobile_number ?? player?.phone ?? "").trim();
    const gender = String(player?.gender ?? "Male").trim();
    const playerRole = String(player?.player_role ?? player?.role ?? "All-Rounder").trim();
    let status = String(player?.status ?? "Registered").trim();

    // Protect newly approved athletes from stale in-flight 1s background polling
    const pid = id.toLowerCase();
    const pemail = email.toLowerCase();
    if (
        (pid && recentlyApprovedPlayerIds.has(pid) && Date.now() - recentlyApprovedPlayerIds.get(pid) < 15000) ||
        (pemail && recentlyApprovedPlayerIds.has(pemail) && Date.now() - recentlyApprovedPlayerIds.get(pemail) < 15000)
    ) {
        status = 'Approved';
    }

    const basePrice = Number(player?.base_price ?? 0) || 15;
    const soldTo = String(player?.sold_to_team ?? "").trim();
    const soldPrice = (player?.sold_price !== undefined && player?.sold_price !== null && player?.sold_price !== '' && !isNaN(Number(player?.sold_price)))
        ? Number(player?.sold_price)
        : null;
    const auctionStatus = (soldTo || (soldPrice !== null && soldPrice > 0)) ? 'Sold' : String(player?.auction_status ?? "Upcoming").trim();
    const photoId = String(player?.photo_file_id ?? "").trim();
    const photoUrl = String(player?.photo_file_url ?? player?.photo_data ?? player?.photo ?? "").trim();
    const certId = String(player?.certificate_file_id ?? "").trim();
    const certUrl = String(player?.certificate_file_url ?? player?.certificate_data ?? player?.certificate ?? "").trim();
    const certName = String(player?.certificate_name ?? (certUrl ? "Attached Document" : "None attached")).trim();

    return {
        id: id || ('ath_' + (email || Date.now()).replace(/[^a-zA-Z0-9]/g, '_')),
        original_id: String(player?.original_id ?? id).trim(),
        created_at: createdAt,
        full_name: fullName,
        name: fullName,
        enrollment_no: enrollment,
        department: department,
        branch: department,
        email: email,
        mobile_number: mobile,
        phone: mobile,
        gender: gender,
        player_role: playerRole,
        role: playerRole,
        status: status,
        base_price: basePrice,
        auction_status: auctionStatus,
        sold_to_team: soldTo,
        sold_price: soldPrice,
        photo_file_id: photoId,
        photo_file_url: photoUrl,
        photo_data: photoUrl,
        certificate_file_id: certId,
        certificate_file_url: certUrl,
        certificate_name: certName
    };
}

function computePlayersSignature(players) {
    if (!Array.isArray(players)) return '';
    return JSON.stringify(players.map(p => ({
        id: p.id,
        email: p.email,
        status: p.status,
        base_price: p.base_price,
        sold_price: p.sold_price,
        sold_to_team: p.sold_to_team,
        sold_to_team_id: p.sold_to_team_id,
        auction_status: p.auction_status,
        photo_data: p.photo_data ? p.photo_data.substring(0, 30) : null,
        certificate_name: p.certificate_name
    })));
}

function computeTeamsSignature(teams) {
    if (!Array.isArray(teams)) return '';
    return JSON.stringify(teams.map(t => ({
        id: t.id,
        name: t.name || t.team_name,
        owner_name: t.owner_name,
        total_budget: t.total_budget || t.purse,
        spent_points: t.spent_points || t.spent,
        remaining_purse: t.remaining_purse,
        squad_count: t.squad_count
    })));
}

// 1. FAST BACKGROUND AUTO-REFRESH CONTROLLER (Requirement 7, 8, 9, 10, 11)
async function refreshAdminData(forceRender = false) {
    if (isRefreshingAdminData || isDeletingAllPlayers || isCreatingFranchise || isBulkApproving) return;
    if (document.visibilityState === 'hidden') return;
    if (Date.now() - lastDeleteAllTimestamp < 4000) return;

    isRefreshingAdminData = true;
    const currentGeneration = ++syncGeneration;

    try {
        const now = Date.now();
        const timeSinceFullSync = now - (adminState.lastFullSyncTime || 0);

        // Fast-path: Check lightweight metadata syncState (Requirement 8)
        let syncState = null;
        if (!forceRender && window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getSyncState === 'function') {
            const syncRes = await window.GoogleTourneyApi.getSyncState();
            if (syncRes && syncRes.success && syncRes.data) {
                syncState = syncRes.data;
            }
        }

        // If syncState matches our in-memory counts and not due for periodic 15s check: zero network download!
        if (syncState && !forceRender && timeSinceFullSync < 15000) {
            const expectedPlayersCount = syncState.playersCount;
            const expectedTeamsCount = syncState.teamsCount;

            const currentPlayersCount = adminState.players.length;
            const currentTeamsCount = adminState.teams.length;

            if (expectedPlayersCount === currentPlayersCount && expectedTeamsCount === currentTeamsCount) {
                // Zero changes! Do not download full datasets, zero DOM work!
                updateLiveStatus('live');
                return;
            }
        }

        // Changed detected or verification due: download only what is needed in parallel
        const needPlayers = forceRender || !syncState || syncState.playersCount !== adminState.players.length || timeSinceFullSync >= 15000;
        const needTeams = forceRender || !syncState || syncState.teamsCount !== adminState.teams.length || timeSinceFullSync >= 15000;

        let playersPromise = needPlayers
            ? (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getPlayers === 'function' ? window.GoogleTourneyApi.getPlayers() : window.UniBoxDb?.getAllPlayers())
            : Promise.resolve({ success: true, data: adminState.players });

        let teamsPromise = needTeams
            ? (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getTeams === 'function' ? window.GoogleTourneyApi.getTeams(allPlayers) : window.UniBoxDb?.getAllTeams(allPlayers))
            : Promise.resolve({ success: true, data: adminState.teams });

        const [playersRes, teamsRes] = await Promise.allSettled([playersPromise, teamsPromise]);

        // Discard stale out-of-order response (Requirement 11)
        if (currentGeneration !== syncGeneration) return;

        adminState.lastFullSyncTime = now;
        let hasPlayersChanged = false;

        // Ingest players if fetched
        if (playersRes.status === 'fulfilled' && playersRes.value && (playersRes.value.success || Array.isArray(playersRes.value.data))) {
            const rawPlayers = Array.isArray(playersRes.value.data) ? playersRes.value.data : [];
            // Guard against stale response during delete-all
            if (Date.now() - lastDeleteAllTimestamp < 4000 && allPlayers.length === 0 && rawPlayers.length > 0) {
                return;
            }

            const newPlayers = rawPlayers.map(normalizePlayer).filter(Boolean);
            const newSig = computePlayersSignature(newPlayers);

            if (forceRender || newSig !== adminState.playersSignature) {
                adminState.playersSignature = newSig;
                lastPlayersSignature = newSig;
                adminState.players = newPlayers;
                allPlayers = newPlayers;
                window.allPlayers = allPlayers;
                hasPlayersChanged = true;
                updateMetrics();
                applyFilters();
            }
        }

        // Ingest teams if fetched
        if (teamsRes.status === 'fulfilled' && teamsRes.value && (teamsRes.value.success || Array.isArray(teamsRes.value.data))) {
            const rawTeams = Array.isArray(teamsRes.value.data) ? teamsRes.value.data : [];
            const newTeams = rawTeams.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
            const newTeamSig = computeTeamsSignature(newTeams);

            if (forceRender || hasPlayersChanged || newTeamSig !== adminState.teamsSignature) {
                adminState.teamsSignature = newTeamSig;
                lastTeamsSignature = newTeamSig;
                adminState.teams = newTeams;
                allTeams = newTeams;
                renderTeamBalanceHUD();
            }
        }

        updateLiveStatus('live');
    } catch (err) {
        console.warn('[BACKGROUND REFRESH] Error refreshing admin data:', err);
        updateLiveStatus('connection_issue');
    } finally {
        isRefreshingAdminData = false;
    }
}

function startAutoRefresh() {
    if (adminRefreshInterval) clearInterval(adminRefreshInterval);
    adminRefreshInterval = setInterval(refreshAdminData, 1000);
}

function stopAutoRefresh() {
    if (adminRefreshInterval) {
        clearInterval(adminRefreshInterval);
        adminRefreshInterval = null;
    }
}

// 2. Connection Status Badge
function initDbStatus() {
    updateLiveStatus('live');
}

// 3. Load Teams Data & Live Leftover Balance HUD
async function loadTeamsData(providedPlayers = null) {
    try {
        if (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getTeams === 'function') {
            const res = await window.GoogleTourneyApi.getTeams(providedPlayers || allPlayers);
            if (res.success && Array.isArray(res.data)) {
                allTeams = res.data.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
                adminState.teams = allTeams;
            }
        } else if (window.UniBoxDb) {
            const { data } = await window.UniBoxDb.getAllTeams(providedPlayers || allPlayers);
            const rawTeams = Array.isArray(data) ? data : [];
            allTeams = rawTeams.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
            adminState.teams = allTeams;
        } else {
            const rawTeams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
            allTeams = rawTeams.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
            adminState.teams = allTeams;
        }
        lastTeamsSignature = computeTeamsSignature(allTeams);
        adminState.teamsSignature = lastTeamsSignature;
        renderTeamBalanceHUD();
    } catch (err) {
        console.error('Error loading team data:', err);
        renderTeamBalanceError(err);
    }
}

function renderTeamBalanceError(err) {
    if (!teamsHudContainer) return;
    teamsHudContainer.innerHTML = `
        <div class="col-span-full py-6 px-4 text-center rounded-2xl bg-[#08111F]/80 border border-rose-500/30 text-rose-400">
            <div class="text-xl mb-1">⚠️</div>
            <p class="text-xs font-bold text-slate-200">Unable to Load Franchise Balances</p>
            <p class="text-[11px] text-slate-400 mt-1 mb-3">${err?.message || "Failed to retrieve tournament franchise data."}</p>
            <button type="button" onclick="loadTeamsData()" class="btn-primary text-xs px-3.5 py-1.5 inline-flex items-center gap-1.5 mx-auto">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                Try Again
            </button>
        </div>
    `;
}

// Render the 5 Franchise Balance Cards with live leftover purse reflection
function renderTeamBalanceHUD() {
    // Keep count badge and KPI metric updated in real-time
    const countBadge = document.getElementById('franchise-count-badge');
    if (countBadge) {
        countBadge.textContent = `${allTeams.length} / 8 Active`;
    }
    if (statDepts) {
        statDepts.textContent = allTeams.length;
    }

    // Exactly 8 Franchises limit (Requirement 3)
    const createBtn = document.getElementById('btn-create-franchise');
    if (createBtn) {
        if (allTeams.length >= 8) {
            createBtn.disabled = true;
            createBtn.innerHTML = `<span>🔒 8 / 8 FRANCHISES</span>`;
            createBtn.title = 'Maximum of 8 franchises reached';
            createBtn.className = 'text-xs font-black text-slate-400 bg-slate-800/80 border border-slate-700 px-4 py-2.5 rounded-xl cursor-not-allowed opacity-60 uppercase tracking-wider flex items-center gap-2 shadow-none';
        } else {
            createBtn.disabled = false;
            createBtn.innerHTML = `<span>➕ Create Franchise (${allTeams.length}/8)</span>`;
            createBtn.title = 'Create a new franchise';
            createBtn.className = 'text-xs font-black text-slate-950 bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shadow-sm uppercase tracking-wider';
        }
    }

    if (!teamsHudContainer) return;

    if (!allTeams.length) {
        teamsHudContainer.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 text-xs bg-[#08111F]/50 rounded-2xl border border-sky-950/60">No franchises yet.</div>`;
        return;
    }

    teamsHudContainer.innerHTML = allTeams.map(team => {
        const total = Number(team.purse ?? team.total_budget ?? 1000);
        const spent = Number(team.spent ?? team.total_spent ?? 0);
        const leftover = Math.max(0, total - spent);
        const spentPct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
        const squadCount = team.squad_count ?? (team.squad ? team.squad.length : (team.player_count ?? 0));
        
        const rawOwner = team.owner_name ? String(team.owner_name).trim() : '';
        const ownerName = (rawOwner && rawOwner !== 'undefined' && rawOwner !== 'null') ? rawOwner : 'No Owner Claimed';
        
        const teamName = team.team_name || team.name || 'Franchise Team';
        const rawShort = team.short_name || team.department;
        const shortName = (rawShort && String(rawShort).trim() && String(rawShort).trim() !== 'undefined' && String(rawShort).trim() !== 'null') 
            ? String(rawShort).trim() 
            : 'SPL';

        return `
            <div onclick="openTeamSquadModal('${team.id}')"
                class="group p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-lime-400/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-lime-400/5">
                
                <!-- Team Card Header -->
                <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xl p-1.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0 group-hover:scale-110 transition-transform">${team.logo || '🏏'}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-900 text-slate-400 border border-slate-800">
                                ${shortName}
                            </span>
                            <button type="button" data-team-id="${team.id}" onclick="event.stopPropagation(); handleDeleteTeam('${team.id}', this)"
                                class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Delete ${teamName}">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </div>
                    <h4 class="font-black text-white text-sm uppercase truncate group-hover:text-lime-400 transition-colors">${teamName}</h4>
                    <div class="mt-1 flex items-center gap-1.5 text-[11px] truncate">
                        <span class="text-amber-400 text-xs">👑</span>
                        <span class="${ownerName !== 'No Owner Claimed' ? 'text-amber-300 font-semibold' : 'text-slate-500 font-normal'} truncate">
                            ${ownerName}
                        </span>
                    </div>
                </div>

                <!-- Leftover Balance KPI -->
                <div class="my-3">
                    <p class="text-[10px] uppercase font-bold tracking-wider text-slate-500">Leftover Balance</p>
                    <div class="flex items-baseline gap-1 mt-0.5">
                        <span class="text-2xl font-black text-emerald-400 font-mono tracking-tight">${leftover.toFixed(1)}</span>
                        <span class="text-xs text-slate-400 font-bold">Pts</span>
                    </div>
                </div>

                <!-- Budget Bar & Stats -->
                <div>
                    <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800/80 mb-2">
                        <div class="bg-gradient-to-r from-lime-400 to-emerald-400 h-full transition-all duration-500" style="width: ${100 - spentPct}%"></div>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                        <span>Spent: ${spent.toFixed(1)} Pts</span>
                        <span class="text-slate-400 font-bold">👥 ${squadCount}/7</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Helper to display error card if loading fails
function renderPlayerLoadError(err) {
    rosterTableBody.innerHTML = `
        <tr>
            <td colspan="6" class="py-12 text-center">
                <div class="max-w-md mx-auto p-6 rounded-2xl bg-[#08111F]/90 border border-rose-500/30 text-center space-y-3">
                    <span class="text-3xl">⚠️</span>
                    <h3 class="text-sm font-bold text-slate-200">Unable to Load Athletes</h3>
                    <p class="text-xs text-slate-400">We couldn't retrieve tournament data from Google Sheets.</p>
                    <p class="text-[11px] font-mono text-slate-500">${err?.message || 'Connection failed'}</p>
                    <button type="button" onclick="loadRosterData(true)" class="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 mx-auto">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                        Try Again
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// 3. Load Athletes from Google Sheets / GoogleTourneyApi (Step 15, 16, 17)
async function loadRosterData(showSpinner = true) {
    if (showSpinner && !allPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-3">
                        <div class="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-xs text-slate-400 font-medium">Fetching tournament athletes from Google Sheets...</p>
                    </div>
                </td>
            </tr>
        `;
    }

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    try {
        let playersData = [];
        // Step 17: Google Sheets is authoritative
        if (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getPlayers === 'function') {
            const resp = await window.GoogleTourneyApi.getPlayers();
            if (!resp || !resp.success) {
                throw new Error(resp?.error || 'Failed to retrieve athletes from Google Sheets');
            }
            playersData = Array.isArray(resp.data) ? resp.data : [];
        } else if (window.UniBoxDb) {
            const { data, error } = await window.UniBoxDb.getAllPlayers();
            if (error) throw error;
            playersData = Array.isArray(data) ? data : [];
        } else {
            playersData = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        }

        allPlayers = playersData.map(normalizePlayer).filter(Boolean);
        window.allPlayers = allPlayers;

        updateMetrics();
        applyFilters();
        lastPlayersSignature = computePlayersSignature(allPlayers);
        // Update teams HUD with newly loaded players without duplicate network query
        loadTeamsData(allPlayers);
    } catch (err) {
        console.error('Error loading roster data:', err);
        showToast('Error loading roster data. Check Google Sheets connection.', 'error');
        renderPlayerLoadError(err);
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove('animate-spin'), 400);
        }
    }
}

// 4. Compute and Update KPI Metrics (Step 8, 9)
function updateMetrics() {
    const total = allPlayers.length;
    const approved = allPlayers.filter(p => String(p.status || '').trim().toLowerCase() === 'approved').length;
    const pending = allPlayers.filter(isAthleteEligibleForApproval).length;
    const depts = new Set(allPlayers.map(p => String(p.department || '').trim()).filter(Boolean));

    statTotal.textContent = total;
    statApproved.textContent = approved;
    statPending.textContent = pending;
    statDepts.textContent = allTeams.length > 0 ? allTeams.length : depts.size;

    const approvedPct = total > 0 ? (approved / total) * 100 : 0;
    const pendingPct = total > 0 ? (pending / total) * 100 : 0;

    statApprovedBar.style.width = `${approvedPct}%`;
    statPendingBar.style.width = `${pendingPct}%`;

    // Dynamic Approve All button state (Requirement 4, 17)
    const approveAllBtn = document.getElementById('approve-all-players-btn');
    const approveAllLabel = document.getElementById('approve-all-btn-label');
    if (approveAllBtn) {
        if (pending === 0) {
            approveAllBtn.disabled = true;
            approveAllBtn.classList.add('opacity-40', 'cursor-not-allowed');
            approveAllBtn.classList.remove('hover:bg-emerald-600', 'cursor-pointer');
            approveAllBtn.title = 'No athletes pending approval';
        } else {
            approveAllBtn.disabled = false;
            approveAllBtn.classList.remove('opacity-40', 'cursor-not-allowed');
            approveAllBtn.classList.add('hover:bg-emerald-600', 'cursor-pointer');
            approveAllBtn.title = `Approve All ${pending} Pending Athletes`;
        }
    }
    if (approveAllLabel) {
        approveAllLabel.textContent = pending > 0 ? `✓ Approve All (${pending})` : '✓ Approve All';
    }
}

// 5. Filtering and Search Logic (Step 4, 5, 6, 7, 8)
function applyFilters() {
    const query = String(searchInput?.value || '').trim().toLowerCase();
    const dept = String(deptFilter?.value || 'ALL').trim().toUpperCase();
    const role = String(roleFilter?.value || 'ALL').trim();
    const status = String(statusFilter?.value || 'ALL').trim();
    const auction = String(auctionFilter?.value || 'ALL').trim();

    filteredPlayers = allPlayers.filter(player => {
        // Safe string normalization for all player properties
        const name = String(player.full_name || player.name || '').toLowerCase();
        const roll = String(player.enrollment_no || '').toLowerCase();
        const email = String(player.email || '').toLowerCase();
        const phone = String(player.mobile_number || player.phone || '').toLowerCase();
        const playerDept = String(player.department || '').toLowerCase();
        const playerRole = String(player.player_role || player.role || '');
        const playerStatus = String(player.status || 'Registered');
        const playerAuctionStatus = String(player.auction_status || (player.sold_to_team ? 'Sold' : 'Upcoming'));

        // Search match (Step 5: name, roll, email, phone, dept)
        const matchesQuery = !query || 
            name.includes(query) || 
            roll.includes(query) || 
            email.includes(query) || 
            phone.includes(query) ||
            playerDept.includes(query);

        // Department match (Step 6)
        const matchesDept = dept === 'ALL' || String(player.department || '').trim().toUpperCase() === dept;

        // Role match (Step 7)
        const matchesRole = role === 'ALL' || playerRole.toLowerCase() === role.toLowerCase();

        // Status match (Step 8)
        const rawStatus = playerStatus.toLowerCase();
        const matchesStatus = status === 'ALL' || 
            (status === 'Registered' && (rawStatus === 'registered' || rawStatus === 'pending' || !rawStatus)) ||
            rawStatus === status.toLowerCase();

        // Auction match
        const matchesAuction = auction === 'ALL' || playerAuctionStatus.toLowerCase() === auction.toLowerCase();

        return matchesQuery && matchesDept && matchesRole && matchesStatus && matchesAuction;
    });

    renderRosterTable();
    updateTableSummary();
    updateSelectAllCheckboxState();
    updateBulkToolbar();
}

// Update table footer summary count (Step 10)
function updateTableSummary() {
    if (tableSummaryCount) {
        tableSummaryCount.textContent = `Showing ${filteredPlayers.length} athlete${filteredPlayers.length === 1 ? '' : 's'}`;
    }
}

// 6. Render Dynamic Roster Table Rows
function renderRosterTable() {
    if (!allPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <span class="text-3xl">📋</span>
                        <p class="text-sm font-bold text-slate-300">NO ATHLETES REGISTERED</p>
                        <p class="text-xs text-slate-500">There are currently no registered athletes.</p>
                    </div>
                </td>
            </tr>
        `;
        updateSelectAllCheckboxState();
        updateBulkToolbar();
        return;
    }

    if (!filteredPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <span class="text-3xl">🔍</span>
                        <p class="text-sm font-bold text-slate-300">No matching athletes found</p>
                        <p class="text-xs text-slate-500">Try adjusting your search or clear the filters.</p>
                    </div>
                </td>
            </tr>
        `;
        updateSelectAllCheckboxState();
        updateBulkToolbar();
        return;
    }

    rosterTableBody.innerHTML = filteredPlayers.map(player => {
        const id = player.id || player.email;
        const name = player.full_name || player.name || 'Athlete';
        const email = player.email || '---';
        const enrollment = player.enrollment_no || '---';
        const department = player.department || '---';
        const role = player.player_role || 'All-Rounder';
        const photo = player.photo_file_url || player.photo_data || player.photo || '';
        const status = player.status || 'Registered';
        const defaultRolePrice = window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(role) : 15;
        const basePrice = (player.base_price !== undefined && player.base_price !== null) ? Number(player.base_price) : defaultRolePrice;
        const isSold = player.auction_status === 'Sold' || Boolean(player.sold_to_team);
        const soldTeam = player.sold_to_team || '';
        const soldPrice = player.sold_price !== undefined && player.sold_price !== null ? Number(player.sold_price) : null;

        // Status pill classes
        let statusBadge = '';
        if (status === 'Approved') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Approved
            </span>`;
        } else if (status === 'Rejected') {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Rejected
            </span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Registered
            </span>`;
        }

        // Role badge
        let roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">${role}</span>`;
        if (role === 'All-Rounder') {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20">⚡ ${role}</span>`;
        } else if (role === 'Batter' || role === 'Batsman') {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-400/10 text-sky-400 border border-sky-400/20">🏏 ${role}</span>`;
        } else if (role === 'Bowler') {
            roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-400/10 text-teal-400 border border-teal-400/20">🎯 ${role}</span>`;
        }

        // Auction Status Badge
        let auctionBadge = '';
        if (isSold) {
            auctionBadge = `
                <div class="flex items-center gap-1.5">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-400/10 text-emerald-400 border border-emerald-400/30">
                        🏆 Sold: ${soldTeam} (${soldPrice} Pts)
                    </span>
                </div>
            `;
        } else {
            auctionBadge = `
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-950 text-slate-400 border border-slate-800">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span> Available
                </span>
            `;
        }

        // Base Price Element with Quick Edit
        const basePriceHtml = `
            <div class="flex items-center gap-1.5">
                <span class="font-mono font-bold text-lime-400 text-xs bg-lime-400/5 px-2 py-1 rounded-md border border-lime-400/20">
                    ${basePrice.toFixed(1)} Pts
                </span>
                <button type="button" onclick="openEditBasePriceModal('${id}')"
                    class="text-slate-500 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors" title="Edit Base Price">
                    ✏️
                </button>
            </div>
        `;

        // Avatar Image with Lazy Loading & Fallback initials (Requirement 24)
        const avatarHtml = photo
            ? `<img src="${photo}" alt="${name}" loading="lazy" class="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.classList.remove('hidden');"><div class="hidden w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">${name.substring(0, 2).toUpperCase()}</div>`
            : `<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">${name.substring(0, 2).toUpperCase()}</div>`;

        // Purchase / Refund Action Button (Premium sports-management control style)
        let purchaseActionBtn = '';
        if (isSold) {
            purchaseActionBtn = `
                <button type="button" onclick="handleRevokePurchase('${id}')"
                    class="px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/30 hover:border-purple-400/60 hover:shadow-[0_0_14px_rgba(168,85,247,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-bold text-xs flex items-center gap-1 shrink-0"
                    title="Refund Purchase" aria-label="Refund Purchase">
                    <span class="text-xs">↩️</span>
                    <span class="text-[11px] font-bold">Refund</span>
                </button>
            `;
        } else {
            purchaseActionBtn = `
                <button type="button" onclick="openPurchaseModal('${id}')"
                    class="px-2.5 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 border border-sky-500/30 hover:border-sky-400/60 hover:shadow-[0_0_14px_rgba(56,189,248,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer font-bold text-xs flex items-center gap-1 shrink-0"
                    title="Sell Athlete" aria-label="Sell Athlete">
                    <span class="text-xs">🔨</span>
                    <span class="text-[11px] font-bold">Sell</span>
                </button>
            `;
        }

        // Approval Workflow Controls (Based on database state)
        // STATE 1: Registered / Pending -> Show [ ✓ APPROVE ] and [ ✕ REJECT ]
        // STATE 2: Approved -> Mutually exclusive, both disappear
        // STATE 3: Rejected -> Mutually exclusive, both disappear
        const rawStatus = String(status || 'Registered').trim().toLowerCase();
        const isApproved = rawStatus === 'approved';
        const isRejected = rawStatus === 'rejected';
        let approvalControls = '';

        if (!isApproved && !isRejected) {
            approvalControls = `
                <!-- Quick Approve -->
                <button type="button" onclick="handleStatusUpdate('${id}', 'Approved')"
                    class="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-[0_0_14px_rgba(16,185,129,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                    title="Approve Athlete" aria-label="Approve Athlete">
                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-[11px] font-bold">Approve</span>
                </button>

                <!-- Quick Reject -->
                <button type="button" onclick="handleStatusUpdate('${id}', 'Rejected')"
                    class="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-400/60 hover:shadow-[0_0_14px_rgba(245,158,11,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                    title="Reject Athlete" aria-label="Reject Athlete">
                    <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span class="text-[11px] font-bold">Reject</span>
                </button>
            `;
        }

        const viewActionBtn = `
            <button type="button" onclick="openAthleteModal('${id}')"
                class="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 hover:shadow-[0_0_14px_rgba(148,163,184,0.25)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                title="View Athlete" aria-label="View Athlete">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            </button>
        `;

        const deleteActionBtn = `
            <button type="button" onclick="handleDeletePlayer('${id}')"
                class="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-400/60 hover:shadow-[0_0_14px_rgba(244,63,94,0.35)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0"
                title="Delete Athlete" aria-label="Delete Athlete">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        `;

        const isEligible = isAthleteEligibleForApproval(player);
        const isChecked = selectedAthleteIds.has(id);
        const checkboxCol = isEligible
            ? `<td class="py-3.5 px-3 sm:px-4 text-center w-12 no-print">
                <input type="checkbox"
                    data-player-id="${id}"
                    ${isChecked ? 'checked' : ''}
                    onchange="handleSelectAthlete(this)"
                    class="athlete-row-checkbox w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-400 focus:ring-offset-0 cursor-pointer transition-all">
               </td>`
            : `<td class="py-3.5 px-3 sm:px-4 text-center w-12 no-print">
                <input type="checkbox" disabled
                    class="w-4 h-4 rounded border-slate-800 bg-slate-950/50 text-slate-700 opacity-20 cursor-not-allowed"
                    title="Already ${status}">
               </td>`;

        return `
            <tr class="hover:bg-slate-900/70 transition-colors group">
                <!-- Athlete Checkbox (Requirement 1) -->
                ${checkboxCol}

                <!-- Athlete Profile & Academic Info -->
                <td class="py-3.5 px-4 sm:px-6">
                    <div class="flex items-center gap-3 min-w-[240px] sm:min-w-[280px]">
                        ${avatarHtml}
                        <div class="min-w-0 flex-1">
                            <p class="font-bold text-white text-sm truncate group-hover:text-lime-400 transition-colors cursor-pointer" onclick="openAthleteModal('${id}')" title="Click to view ${name}">${name}</p>
                            <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                                    ${enrollment}
                                </span>
                                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-800/50 text-sky-400">
                                    ${department}
                                </span>
                            </div>
                            <p class="text-[11px] text-slate-500 font-mono truncate mt-0.5">${email}</p>
                        </div>
                    </div>
                </td>

                <!-- Playing Role -->
                <td class="py-3.5 px-3 whitespace-nowrap">
                    ${roleBadge}
                </td>

                <!-- Base Price -->
                <td class="py-3.5 px-3 whitespace-nowrap">
                    ${basePriceHtml}
                </td>

                <!-- Clearance Status -->
                <td class="py-3.5 px-3 whitespace-nowrap">
                    ${statusBadge}
                </td>

                <!-- Auction Status -->
                <td class="py-3.5 px-3 whitespace-nowrap">
                    ${auctionBadge}
                </td>

                <!-- Actions (Sticky Right Column) -->
                <td class="py-3.5 px-4 sm:px-6 text-right sticky right-0 bg-[#08111F] group-hover:bg-[#0c182c] transition-colors z-10 shadow-[-12px_0_16px_rgba(0,0,0,0.45)] border-l border-sky-950/70 w-[240px] min-w-[240px] whitespace-nowrap no-print">
                    <div class="flex items-center justify-end gap-1.5 flex-nowrap">
                        ${purchaseActionBtn}
                        ${approvalControls}
                        ${viewActionBtn}
                        ${deleteActionBtn}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateSelectAllCheckboxState();
    updateBulkToolbar();
}

function updateTableSummary() {
    if (tableSummaryCount) {
        tableSummaryCount.textContent = `Showing ${filteredPlayers.length} of ${allPlayers.length} athletes`;
    }
}

// 7. Action Handlers: Update Clearance Status
async function handleStatusUpdate(playerId, newStatus) {
    try {
        const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
        const playerName = player ? (player.full_name || player.name) : 'Athlete';

        if (newStatus === 'Approved') {
            const cleanId = String(playerId).toLowerCase();
            recentlyApprovedPlayerIds.set(cleanId, Date.now());
            if (player?.original_id) recentlyApprovedPlayerIds.set(String(player.original_id).toLowerCase(), Date.now());
            if (player?.email) recentlyApprovedPlayerIds.set(String(player.email).toLowerCase(), Date.now());
            selectedAthleteIds.delete(playerId);
            if (player?.id) selectedAthleteIds.delete(player.id);
            if (player?.email) selectedAthleteIds.delete(player.email);
        }

        if (window.UniBoxDb) {
            await window.UniBoxDb.updatePlayerStatus(playerId, newStatus);
        }

        if (player) {
            player.status = newStatus;
        }

        updateMetrics();
        applyFilters();

        if (activeModalPlayer && (activeModalPlayer.id === playerId || activeModalPlayer.email === playerId)) {
            activeModalPlayer.status = newStatus;
            updateModalBadges();
        }

        showToast(`${playerName} marked as ${newStatus}!`, 'success');
    } catch (err) {
        console.error('Error updating player status:', err);
        showToast('Failed to update status in database', 'error');
    }
}

// 8. Action Handlers: Delete Player
async function handleDeletePlayer(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    const playerName = player ? (player.full_name || player.name) : 'Athlete';

    if (!confirm(`Are you sure you want to delete the registration record for ${playerName}? This action cannot be undone.`)) {
        return;
    }

    try {
        if (window.UniBoxDb) {
            await window.UniBoxDb.deletePlayer(playerId);
        }

        allPlayers = allPlayers.filter(p => p.id !== playerId && p.email !== playerId);
        updateMetrics();
        applyFilters();
        await loadTeamsData();

        if (activeModalPlayer && (activeModalPlayer.id === playerId || activeModalPlayer.email === playerId)) {
            closeAthleteModal();
        }

        showToast(`Registration for ${playerName} deleted.`, 'info');
    } catch (err) {
        console.error('Error deleting player:', err);
        showToast('Failed to delete player from database', 'error');
    }
}

// 9. Athlete Inspection Modal
function openAthleteModal(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    if (!player) return;

    activeModalPlayer = player;

    modalName.textContent = player.full_name || player.name || '---';
    modalEmail.textContent = player.email || '---';
    modalEnrollment.textContent = player.enrollment_no || '---';
    if (modalPhone) modalPhone.textContent = player.mobile_number || player.phone || '---';
    modalDept.textContent = player.department || '---';
    modalGender.textContent = player.gender || '---';
    modalRole.textContent = player.player_role || '---';
    modalCert.textContent = player.certificate_name || player.certificate || 'None attached';

    const defaultRolePrice = window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(player.player_role) : 15;
    const basePrice = (player.base_price !== undefined && player.base_price !== null) ? Number(player.base_price) : defaultRolePrice;
    modalBasePrice.textContent = `${basePrice.toFixed(1)} Pts`;

    const editPriceBtn = document.getElementById('modal-edit-price-btn');
    if (editPriceBtn) {
        editPriceBtn.onclick = () => openEditBasePriceModal(player.id || player.email);
    }

    const isSold = player.auction_status === 'Sold' || Boolean(player.sold_to_team);
    if (isSold) {
        modalAuctionStatus.textContent = `Sold to ${player.sold_to_team} (${player.sold_price} Pts)`;
        modalAuctionStatus.className = 'text-emerald-400 font-bold mt-0.5 text-xs';
        if (modalPurchaseBtn) modalPurchaseBtn.classList.add('hidden');
    } else {
        modalAuctionStatus.textContent = 'Upcoming / Available in Auction';
        modalAuctionStatus.className = 'text-slate-300 font-semibold mt-0.5 text-xs';
        if (modalPurchaseBtn) {
            modalPurchaseBtn.classList.remove('hidden');
            modalPurchaseBtn.onclick = () => {
                closeAthleteModal();
                openPurchaseModal(player.id || player.email);
            };
        }
    }

    const modalViewCertBtn = document.getElementById('modal-view-cert-btn');
    if (modalViewCertBtn) {
        const certName = player.certificate_name || player.certificate || '';
        const hasCertDoc = certName && certName !== 'None' && certName !== 'None attached';
        const certData = player.certificate_file_url || player.certificate_data;
        if (certData || hasCertDoc) {
            modalViewCertBtn.classList.remove('hidden');
            modalViewCertBtn.onclick = () => openCertViewerModal(certName, certData);
        } else {
            modalViewCertBtn.classList.add('hidden');
        }
    }

    if (player.created_at) {
        const dateObj = new Date(player.created_at);
        modalCreated.textContent = dateObj.toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } else {
        modalCreated.textContent = 'Session Record';
    }

    const modalPhotoSrc = player.photo_file_url || player.photo_data || player.photo;
    if (modalPhotoSrc) {
        modalPhoto.src = modalPhotoSrc;
        modalPhoto.classList.remove('hidden');
        modalPhotoPlaceholder.classList.add('hidden');
    } else {
        modalPhoto.src = '';
        modalPhoto.classList.add('hidden');
        modalPhotoPlaceholder.classList.remove('hidden');
    }

    updateModalBadges();

    athleteModal.classList.remove('hidden');
    athleteModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function updateModalBadges() {
    if (!activeModalPlayer) return;
    const rawStatus = String(activeModalPlayer.status || 'Registered').trim().toLowerCase();
    const isApproved = rawStatus === 'approved';
    const isRejected = rawStatus === 'rejected';

    const modalApproveBtn = document.getElementById('modal-approve-btn');
    const modalRejectBtn = document.getElementById('modal-reject-btn');
    const modalApprovedBadge = document.getElementById('modal-approved-badge');
    const modalRejectedBadge = document.getElementById('modal-rejected-badge');

    if (isApproved) {
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 mb-1';
        modalStatusBadge.textContent = 'Approved for Matchday';
        if (modalApproveBtn) modalApproveBtn.classList.add('hidden');
        if (modalRejectBtn) modalRejectBtn.classList.add('hidden');
        if (modalApprovedBadge) modalApprovedBadge.classList.remove('hidden');
        if (modalRejectedBadge) modalRejectedBadge.classList.add('hidden');
    } else if (isRejected) {
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20 mb-1';
        modalStatusBadge.textContent = 'Clearance Rejected';
        if (modalApproveBtn) modalApproveBtn.classList.add('hidden');
        if (modalRejectBtn) modalRejectBtn.classList.add('hidden');
        if (modalApprovedBadge) modalApprovedBadge.classList.add('hidden');
        if (modalRejectedBadge) modalRejectedBadge.classList.remove('hidden');
    } else {
        // Pending / Registered
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 mb-1';
        modalStatusBadge.textContent = 'Pending Clearance';
        if (modalApproveBtn) modalApproveBtn.classList.remove('hidden');
        if (modalRejectBtn) modalRejectBtn.classList.remove('hidden');
        if (modalApprovedBadge) modalApprovedBadge.classList.add('hidden');
        if (modalRejectedBadge) modalRejectedBadge.classList.add('hidden');
    }
}

function closeAthleteModal() {
    activeModalPlayer = null;
    athleteModal.classList.add('hidden');
    athleteModal.classList.remove('flex');
    document.body.style.overflow = '';
}

// ==============================================================================
// 10. ROLE BASE PRICE CONFIGURATION (Batsman 20 Pts, Bowler 5 Pts, etc.)
// ==============================================================================
function openBasePriceModal() {
    const modal = document.getElementById('base-price-modal');
    if (!modal || !window.UniBoxDb) return;

    const prices = window.UniBoxDb.getRoleBasePrices();
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined) el.value = val;
    };

    setVal('price-batter', prices['Batter'] || prices['Batsman'] || 20);
    setVal('price-bowler', prices['Bowler'] || 5);
    setVal('price-allrounder', prices['All-Rounder'] || 15);
    setVal('price-wicketkeeper', prices['Wicketkeeper'] || 10);
    setVal('price-fielder', prices['Fielder'] || 5);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeBasePriceModal() {
    const modal = document.getElementById('base-price-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.style.overflow = '';
}

function handleSaveBasePrices(e) {
    e.preventDefault();
    if (!window.UniBoxDb) return;

    const newPrices = {
        'Batter': Number(document.getElementById('price-batter')?.value) || 20,
        'Batsman': Number(document.getElementById('price-batter')?.value) || 20,
        'Bowler': Number(document.getElementById('price-bowler')?.value) || 5,
        'All-Rounder': Number(document.getElementById('price-allrounder')?.value) || 15,
        'Wicketkeeper': Number(document.getElementById('price-wicketkeeper')?.value) || 10,
        'Fielder': Number(document.getElementById('price-fielder')?.value) || 5
    };

    window.UniBoxDb.saveRoleBasePrices(newPrices);
    closeBasePriceModal();
    showToast('Role base prices updated! (Batsman: ' + newPrices.Batter + ' Pts, Bowler: ' + newPrices.Bowler + ' Pts)', 'success');
    loadRosterData(false);
}

// Bulk apply role base prices to all players
async function applyRolePricesToAllPlayers() {
    if (!confirm('Apply role-based base prices to all athletes in the roster?')) return;
    const prices = window.UniBoxDb.getRoleBasePrices();

    for (const player of allPlayers) {
        const role = player.player_role || 'All-Rounder';
        const rolePrice = window.UniBoxDb.getDefaultBasePriceForRole(role, prices);
        await window.UniBoxDb.updatePlayerBasePrice(player.id || player.email, rolePrice);
        player.base_price = rolePrice;
    }

    closeBasePriceModal();
    renderRosterTable();
    showToast('Applied role base prices to all athletes!', 'success');
}

// ==============================================================================
// 11. INDIVIDUAL ATHLETE BASE PRICE QUICK EDIT
// ==============================================================================
function openEditBasePriceModal(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    if (!player) return;

    activeEditBasePlayer = player;
    const modal = document.getElementById('edit-base-price-modal');
    const nameEl = document.getElementById('edit-base-player-name');
    const inputEl = document.getElementById('edit-base-price-input');

    const defaultRoleBase = window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(player.player_role) : 15;
    if (inputEl) inputEl.value = (player.base_price !== undefined && player.base_price !== null) ? Number(player.base_price) : defaultRoleBase;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    inputEl?.focus();
}

function closeEditBasePriceModal() {
    activeEditBasePlayer = null;
    const modal = document.getElementById('edit-base-price-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleSavePlayerBasePrice(e) {
    e.preventDefault();
    if (!activeEditBasePlayer || !window.UniBoxDb) return;

    const inputVal = Number(document.getElementById('edit-base-price-input')?.value);
    if (isNaN(inputVal) || inputVal < 0) {
        showToast('Please enter a valid base price', 'error');
        return;
    }

    const playerId = activeEditBasePlayer.id || activeEditBasePlayer.email;
    await window.UniBoxDb.updatePlayerBasePrice(playerId, inputVal);

    activeEditBasePlayer.base_price = inputVal;
    if (activeModalPlayer && (activeModalPlayer.id === playerId || activeModalPlayer.email === playerId)) {
        modalBasePrice.textContent = `${inputVal.toFixed(1)} Pts`;
    }

    closeEditBasePriceModal();
    renderRosterTable();
    showToast(`Base price for ${activeEditBasePlayer.full_name || activeEditBasePlayer.name} updated to ${inputVal} Points!`, 'success');
}

// ==============================================================================
// 12. LIVE AUCTION PLAYER PURCHASE & REALTIME LEFTOVER BALANCE REFLECTION
// ==============================================================================
function openPurchaseModal(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    if (!player) return;

    // Check if player is approved
    if (player.status !== 'Approved') {
        if (!confirm(`${player.full_name || player.name} is currently "${player.status || 'Pending'}". Do you want to approve this athlete and proceed to purchase?`)) {
            return;
        }
        handleStatusUpdate(playerId, 'Approved');
    }

    activePurchasePlayer = player;
    const modal = document.getElementById('purchase-modal');

    // Populate athlete details
    document.getElementById('purchase-player-name').textContent = player.full_name || player.name;
    document.getElementById('purchase-player-dept').textContent = player.department || '---';
    document.getElementById('purchase-player-role').textContent = player.player_role || 'Athlete';

    const basePrice = player.base_price !== undefined ? Number(player.base_price) : 20;
    document.getElementById('purchase-player-base').textContent = `${basePrice.toFixed(1)} Pts`;

    const photoImg = document.getElementById('purchase-player-photo');
    const avatarIcon = document.getElementById('purchase-player-avatar');
    const purchasePhotoSrc = player.photo_file_url || player.photo_data || player.photo;
    if (purchasePhotoSrc) {
        photoImg.src = purchasePhotoSrc;
        photoImg.classList.remove('hidden');
        avatarIcon.classList.add('hidden');
    } else {
        photoImg.src = '';
        photoImg.classList.add('hidden');
        avatarIcon.classList.remove('hidden');
    }

    // Populate Team Selector with current live leftover balances
    const teamSelect = document.getElementById('purchase-team-select');
    teamSelect.innerHTML = `<option value="" disabled selected>Choose a franchise...</option>` + allTeams.map(t => {
        const ownerTag = t.owner_name ? ` [Owner: ${t.owner_name}]` : '';
        return `<option value="${t.id}">${t.logo} ${t.name}${ownerTag} (Leftover Purse: ${t.leftover_balance.toFixed(1)} Points)</option>`;
    }).join('');

    // Pre-select first team if available
    if (allTeams.length > 0) {
        teamSelect.selectedIndex = 1;
    }

    // Set default purchase price = base price
    const priceInput = document.getElementById('purchase-price-input');
    if (priceInput) {
        priceInput.min = basePrice;
        priceInput.value = basePrice;
    }

    updatePurchaseBalancePreview();

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closePurchaseModal() {
    activePurchasePlayer = null;
    const modal = document.getElementById('purchase-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.style.overflow = '';
}

// Dynamic Real-time Calculation Preview as User Types or Selects Team
function updatePurchaseBalancePreview() {
    if (!activePurchasePlayer) return;

    const teamSelect = document.getElementById('purchase-team-select');
    const priceInput = document.getElementById('purchase-price-input');
    const curBalEl = document.getElementById('preview-current-balance');
    const dedEl = document.getElementById('preview-deduction');
    const newBalEl = document.getElementById('preview-new-balance');
    const errorEl = document.getElementById('purchase-error-msg');
    const submitBtn = document.getElementById('purchase-submit-btn');

    const selectedTeamId = teamSelect.value;
    const team = allTeams.find(t => t.id === selectedTeamId);
    const purchasePrice = Number(priceInput.value) || 0;
    const basePrice = activePurchasePlayer.base_price !== undefined ? Number(activePurchasePlayer.base_price) : 20;

    errorEl.classList.add('hidden');
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    if (!team) {
        curBalEl.textContent = '---';
        dedEl.textContent = `${purchasePrice.toFixed(1)} Points`;
        newBalEl.textContent = '---';
        return;
    }

    const currentBalance = team.leftover_balance;
    const newBalance = currentBalance - purchasePrice;

    curBalEl.textContent = `${currentBalance.toFixed(1)} Points`;
    dedEl.textContent = `- ${purchasePrice.toFixed(1)} Points`;
    newBalEl.textContent = `${newBalance.toFixed(1)} Points`;

    if (purchasePrice < basePrice) {
        errorEl.textContent = `⚠️ Price cannot be lower than player's base price of ${basePrice} Points.`;
        errorEl.classList.remove('hidden');
        newBalEl.className = 'text-rose-400 text-sm font-black font-mono';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else if (newBalance < 0) {
        errorEl.textContent = `⚠️ Insufficient budget! ${team.name} only has ${currentBalance.toFixed(1)} Points remaining.`;
        errorEl.classList.remove('hidden');
        newBalEl.className = 'text-rose-400 text-sm font-black font-mono';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
        newBalEl.className = 'text-emerald-400 text-sm font-black font-mono';
    }
}

// Execute player purchase and reflect balance in real time
async function handleExecutePurchase(e) {
    e.preventDefault();
    if (!activePurchasePlayer || !window.UniBoxDb) return;

    const teamSelect = document.getElementById('purchase-team-select');
    const priceInput = document.getElementById('purchase-price-input');
    const teamId = teamSelect.value;
    const soldPrice = Number(priceInput.value);
    const playerId = activePurchasePlayer.id || activePurchasePlayer.email;
    const playerName = activePurchasePlayer.full_name || activePurchasePlayer.name;

    try {
        const result = await window.UniBoxDb.purchasePlayer({
            playerIdOrEmail: playerId,
            teamId: teamId,
            soldPrice: soldPrice
        });

        // Update local player object
        activePurchasePlayer.auction_status = 'Sold';
        activePurchasePlayer.sold_to_team = result.team.name;
        activePurchasePlayer.sold_to_team_id = result.team.id;
        activePurchasePlayer.sold_price = soldPrice;
        activePurchasePlayer.status = 'Approved';

        closePurchaseModal();

        // Refresh teams and table immediately for real-time reflection
        await loadTeamsData();
        renderRosterTable();

        showToast(`🎉 ${playerName} purchased by ${result.team.name} for ${soldPrice} Points! Remaining Purse: ${result.team.leftover_balance.toFixed(1)} Points`, 'success');
    } catch (err) {
        console.error('Purchase failed:', err);
        showToast(err.message || 'Failed to complete player purchase', 'error');
    }
}

// Revoke purchase & refund team balance in real time
async function handleRevokePurchase(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    const playerName = player ? (player.full_name || player.name) : 'Athlete';
    const teamName = player?.sold_to_team || 'the franchise';
    const price = player?.sold_price || 0;

    if (!confirm(`Are you sure you want to revoke the purchase of ${playerName}? ${price} Points will be immediately refunded to ${teamName}'s leftover balance.`)) {
        return;
    }

    try {
        if (window.UniBoxDb) {
            await window.UniBoxDb.revokePlayerPurchase(playerId);
        }

        if (player) {
            player.auction_status = 'Upcoming';
            delete player.sold_to_team;
            delete player.sold_to_team_id;
            delete player.sold_price;
        }

        await loadTeamsData();
        renderRosterTable();
        showToast(`Sale revoked. ${price} Points refunded to ${teamName}!`, 'info');
    } catch (err) {
        console.error('Revoke failed:', err);
        showToast('Failed to revoke purchase', 'error');
    }
}

// ==============================================================================
// 13. TEAM SQUAD INSPECTION MODAL
// ==============================================================================
function openTeamSquadModal(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team) return;

    activeSquadTeamId = teamId;
    const modal = document.getElementById('team-squad-modal');
    document.getElementById('team-squad-logo').textContent = team.logo || '🏏';
    document.getElementById('team-squad-name').textContent = team.name;
    const ownerMeta = team.owner_name ? ` • 👑 Owner: ${team.owner_name}` : '';
    document.getElementById('team-squad-meta').textContent = `${team.department} Franchise • ${team.squad_count || 0} Players Acquired${ownerMeta}`;

    document.getElementById('team-stat-purse').textContent = `${team.total_budget.toFixed(1)} Pts`;
    document.getElementById('team-stat-spent').textContent = `${team.spent.toFixed(1)} Pts`;
    document.getElementById('team-stat-balance').textContent = `${team.leftover_balance.toFixed(1)} Pts`;

    const squadBody = document.getElementById('team-squad-table-body');
    const squad = team.squad || [];

    if (!squad.length) {
        squadBody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500">No players acquired by ${team.name} yet.</td></tr>`;
    } else {
        squadBody.innerHTML = squad.map(p => {
            const pName = p.full_name || p.name || 'Athlete';
            const pRole = p.player_role || 'All-Rounder';
            const pBase = Number(p.base_price || 0).toFixed(1);
            const pSold = Number(p.sold_price || 0).toFixed(1);
            const pId = p.id || p.email;

            return `
                <tr class="hover:bg-slate-900/60">
                    <td class="py-3 px-4 font-bold text-white">${pName}</td>
                    <td class="py-3 px-3 text-slate-400">${pRole}</td>
                    <td class="py-3 px-3 font-mono text-slate-400">${pBase} Pts</td>
                    <td class="py-3 px-3 font-mono font-bold text-lime-400">${pSold} Pts</td>
                    <td class="py-3 px-4 text-right">
                        <button type="button" onclick="closeTeamSquadModal(); handleRevokePurchase('${pId}')"
                            class="text-xs text-rose-400 hover:text-rose-300 font-semibold underline">
                            Release
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeTeamSquadModal() {
    const modal = document.getElementById('team-squad-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    activeSquadTeamId = null;
    document.body.style.overflow = '';
}

function handleDeleteTeamFromModal(btnElement = null) {
    if (activeSquadTeamId) {
        handleDeleteTeam(activeSquadTeamId, btnElement || document.getElementById('team-modal-delete-btn'));
    }
}

async function handleDeleteTeam(rawTeamId, btnElement = null) {
    // Step 7: Prevent duplicate / concurrent delete requests
    if (isDeletingTeam) {
        console.warn('A franchise deletion is already in progress.');
        return;
    }

    const teamId = (btnElement && btnElement.dataset && btnElement.dataset.teamId) || rawTeamId;
    if (!teamId) {
        showToast('Missing team ID for deletion.', 'error');
        return;
    }

    const cleanTeamId = String(teamId).trim();
    // Step 4: Robust ID matching (string-safe)
    const team = allTeams.find(t => 
        String(t.id).trim() === cleanTeamId || 
        String(t.name).trim().toLowerCase() === cleanTeamId.toLowerCase()
    );

    if (!team) {
        showToast(`Team not found with ID: ${cleanTeamId}`, 'error');
        return;
    }

    const squadCount = Number(team.squad_count || (team.squad ? team.squad.length : 0));
    // Safety check: Block deletion if team has players assigned
    if (squadCount > 0) {
        const errMsg = 'Cannot delete a team that has players assigned to it.';
        showToast(errMsg, 'error');
        alert(`Cannot delete franchise "${team.name}" because it currently has ${squadCount} athlete(s) assigned to it.\n\nPlease release all squad members back to the auction pool before deleting the franchise.`);
        return;
    }

    if (!confirm(`Are you sure you want to permanently delete the franchise "${team.name}"?\n\nThis will remove the team from the Google Sheets database.`)) {
        return;
    }

    // Step 7: Prevent Double Click & show small loading state on button
    const targetBtn = btnElement || document.querySelector(`button[data-team-id="${team.id}"]`) || document.getElementById('team-modal-delete-btn');
    const originalBtnHtml = targetBtn ? targetBtn.innerHTML : '';
    if (targetBtn) {
        targetBtn.disabled = true;
        targetBtn.style.pointerEvents = 'none';
        targetBtn.innerHTML = `<span class="inline-block w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin"></span>`;
    }

    isDeletingTeam = true;

    try {
        let res;
        if (window.GoogleTourneyApi && window.GoogleTourneyApi.isConfigured()) {
            res = await window.GoogleTourneyApi.deleteTeam(team.id || cleanTeamId);
        } else if (window.UniBoxDb && window.UniBoxDb.deleteTeam) {
            res = await window.UniBoxDb.deleteTeam(team.id || cleanTeamId);
        }

        if (res && res.success === false) {
            throw new Error(res.error || 'Failed to delete franchise team from Google Sheets.');
        }

        // ==============================================================================
        // SUCCESS: IMMEDIATELY UPDATE FRONTEND STATE & DOM (NO PAGE RELOAD)
        // ==============================================================================

        // 1. Register ID in the guard set so ongoing/in-flight 1s polling cannot revive it (Step 10)
        pendingOrDeletedTeamIds.add(String(team.id).trim());
        if (cleanTeamId) pendingOrDeletedTeamIds.add(cleanTeamId);

        try {
            const deletedSet = new Set(JSON.parse(localStorage.getItem('unibox_deleted_teams') || '[]'));
            deletedSet.add(String(team.id).trim());
            if (cleanTeamId) deletedSet.add(cleanTeamId);
            localStorage.setItem('unibox_deleted_teams', JSON.stringify([...deletedSet]));
        } catch (e) {}

        // 2. Immediately remove from local state (Step 2 & 3)
        allTeams = allTeams.filter(t => 
            String(t.id).trim() !== String(team.id).trim() && 
            String(t.id).trim() !== cleanTeamId
        );

        try {
            localStorage.setItem('unibox_teams', JSON.stringify(allTeams));
        } catch (e) {}

        // 3. Immediately re-render franchise cards (0ms DOM update, Step 2 & 5)
        lastTeamsSignature = computeTeamsSignature(allTeams);
        renderTeamBalanceHUD();

        // 4. Close squad modal only if open for this specific deleted team (Step 8)
        if (activeSquadTeamId && (String(activeSquadTeamId).trim() === String(team.id).trim() || String(activeSquadTeamId).trim() === cleanTeamId)) {
            closeTeamSquadModal();
        }

        // 5. Update count KPI immediately (Step 9)
        if (statDepts) {
            statDepts.textContent = allTeams.length;
        }

        showToast(`Franchise "${team.name}" deleted successfully`, 'success');

        // 6. Background verification against Google Sheets (Step 3 & 6)
        refreshTeamsInBackground();

    } catch (err) {
        console.error('Delete team failed:', err);
        showToast(err.message || 'Unable to delete franchise', 'error');
        alert(err.message || 'Unable to delete franchise');

        // Restore button state on error
        if (targetBtn) {
            targetBtn.disabled = false;
            targetBtn.style.pointerEvents = '';
            targetBtn.innerHTML = originalBtnHtml;
        }
    } finally {
        isDeletingTeam = false;
    }
}

// Step 6: Background verification that reconciles with Google Sheets
async function refreshTeamsInBackground() {
    try {
        let latestTeams = [];
        if (window.GoogleTourneyApi && window.GoogleTourneyApi.isConfigured()) {
            const latest = await window.GoogleTourneyApi.getTeams(allPlayers);
            if (latest && latest.success !== false && Array.isArray(latest.data)) {
                latestTeams = latest.data;
            }
        } else if (window.UniBoxDb) {
            const { data } = await window.UniBoxDb.getAllTeams(allPlayers);
            if (Array.isArray(data)) {
                latestTeams = data;
            }
        }

        if (latestTeams.length > 0) {
            // Keep local UI: filter out any deleted teams
            allTeams = latestTeams.filter(t => !pendingOrDeletedTeamIds.has(String(t.id).trim()));
            try {
                localStorage.setItem('unibox_teams', JSON.stringify(allTeams));
            } catch (e) {}
            lastTeamsSignature = computeTeamsSignature(allTeams);
            renderTeamBalanceHUD();
            if (statDepts) statDepts.textContent = allTeams.length;
        }
    } catch (error) {
        console.warn('Background team refresh failed:', error);
        // Keep the already-updated UI. Do not restore the deleted team because of a temporary refresh failure.
    }
}

// ==============================================================================
// 14. REALTIME SYNC LISTENER (Multi-Tab & Cross-Client Sync)
// ==============================================================================
function initRealtimeAuctionSync() {
    if (!window.UniBoxDb || !window.UniBoxDb.subscribeToAuctionUpdates) return;

    window.UniBoxDb.subscribeToAuctionUpdates(async (event) => {
        console.log('⚡ Realtime auction event received:', event);
        await loadTeamsData();
        await loadRosterData(false);
    });
}

// ==============================================================================
// 15. EXPORT CSV & TOAST & LOGOUT
// ==============================================================================
function exportRosterToCsv() {
    if (!allPlayers.length) {
        showToast('No athlete data available to export.', 'info');
        return;
    }

    const dataToExport = filteredPlayers.length ? filteredPlayers : allPlayers;
    const headers = ['Full Name', 'Enrollment No', 'Phone', 'Department', 'Email', 'Gender', 'Role', 'Base Points', 'Auction Status', 'Sold To Team', 'Purchase Points', 'Clearance Status', 'Registration Date'];

    const rows = dataToExport.map(p => [
        `"${String(p.full_name || p.name || '').replace(/"/g, '""')}"`,
        `"${String(p.enrollment_no || '').replace(/"/g, '""')}"`,
        `"${String(p.mobile_number || p.phone || '').replace(/"/g, '""')}"`,
        `"${String(p.department || '').replace(/"/g, '""')}"`,
        `"${String(p.email || '').replace(/"/g, '""')}"`,
        `"${String(p.gender || '').replace(/"/g, '""')}"`,
        `"${String(p.player_role || p.role || '').replace(/"/g, '""')}"`,
        `"${(p.base_price !== undefined ? p.base_price : '')}"`,
        `"${String(p.auction_status || (p.sold_to_team ? 'Sold' : 'Upcoming'))}"`,
        `"${String(p.sold_to_team || '')}"`,
        `"${(p.sold_price !== undefined && p.sold_price !== null ? p.sold_price : '')}"`,
        `"${String(p.status || 'Registered')}"`,
        `"${String(p.created_at || new Date().toISOString())}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unibox_tournament_roster_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`Exported ${dataToExport.length} athlete records to CSV!`, 'success');
}

let toastTimeout = null;
function showToast(message, type = 'success') {
    if (!toastBanner) return;

    if (toastTimeout) clearTimeout(toastTimeout);
    toastMessage.textContent = message;

    if (type === 'success') {
        toastBanner.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-emerald-500/40 text-emerald-400';
        toastIcon.textContent = '✓';
    } else if (type === 'error') {
        toastBanner.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-rose-500/40 text-rose-400';
        toastIcon.textContent = '✕';
    } else {
        toastBanner.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-lime-500/40 text-lime-400';
        toastIcon.textContent = 'ℹ';
    }

    toastTimeout = setTimeout(() => {
        toastBanner.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}

function bindEventListeners() {
    let searchDebounceTimer = null;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(applyFilters, 180);
    });
    deptFilter?.addEventListener('change', applyFilters);
    roleFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    auctionFilter?.addEventListener('change', applyFilters);
    refreshBtn?.addEventListener('click', () => refreshAdminData(true));
    exportCsvBtn?.addEventListener('click', exportRosterToCsv);

    modalApproveBtn?.addEventListener('click', () => {
        if (activeModalPlayer) {
            handleStatusUpdate(activeModalPlayer.id || activeModalPlayer.email, 'Approved');
        }
    });

    modalRejectBtn?.addEventListener('click', () => {
        if (activeModalPlayer) {
            handleStatusUpdate(activeModalPlayer.id || activeModalPlayer.email, 'Rejected');
        }
    });

    modalDeleteBtn?.addEventListener('click', () => {
        if (activeModalPlayer) {
            handleDeletePlayer(activeModalPlayer.id || activeModalPlayer.email);
        }
    });

    const logoutBtn = document.getElementById('admin-logout-btn');
    logoutBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        adminLogout();
    });

    const bulkDeleteBtn = document.getElementById('delete-all-players-btn');
    bulkDeleteBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        openBulkDeleteModal();
    });

    const bulkInput = document.getElementById('bulk-delete-confirmation-input');
    const bulkSubmit = document.getElementById('bulk-delete-submit-btn');
    if (bulkInput && bulkSubmit) {
        bulkInput.addEventListener('input', () => {
            // Step 2 & 19: Only exactly 'DELETE' (case-sensitive) enables the button
            const isMatch = bulkInput.value.trim() === 'DELETE';
            bulkSubmit.disabled = !isMatch;
            if (isMatch) {
                bulkSubmit.classList.remove('cursor-not-allowed', 'opacity-50');
                bulkSubmit.classList.add('hover:bg-rose-500', 'cursor-pointer');
            } else {
                bulkSubmit.classList.add('cursor-not-allowed', 'opacity-50');
                bulkSubmit.classList.remove('hover:bg-rose-500', 'cursor-pointer');
            }
        });

        bulkInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !bulkSubmit.disabled) {
                e.preventDefault();
                handleExecuteBulkDelete();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAthleteModal();
            closeBasePriceModal();
            closePurchaseModal();
            closeEditBasePriceModal();
            closeTeamSquadModal();
            closeCertViewerModal();
            closeBulkDeleteModal();
        }
    });
}

// ==============================================================================
// 16. BULK DELETE ATHLETES (Admin Command Center - Google Sheets Backend)
// ==============================================================================
function openBulkDeleteModal() {
    const modal = document.getElementById('bulk-delete-modal');
    const countEl = document.getElementById('bulk-delete-count');
    const inputEl = document.getElementById('bulk-delete-confirmation-input');
    const submitBtn = document.getElementById('bulk-delete-submit-btn');

    if (!modal) return;

    if (countEl) countEl.textContent = allPlayers.length;
    if (inputEl) {
        inputEl.value = '';
        setTimeout(() => inputEl.focus(), 100);
    }
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('cursor-not-allowed', 'opacity-50');
        submitBtn.classList.remove('hover:bg-rose-500', 'cursor-pointer');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
}

function closeBulkDeleteModal() {
    const modal = document.getElementById('bulk-delete-modal');
    if (!modal) return;

    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
}

async function handleExecuteBulkDelete() {
    const inputEl = document.getElementById('bulk-delete-confirmation-input');
    const confVal = inputEl ? inputEl.value.trim() : '';

    // Step 2 & 19: Strict safety confirmation — must be exactly "DELETE"
    if (confVal !== 'DELETE') {
        showToast('Please type DELETE exactly to confirm', 'error');
        return;
    }

    const submitBtn = document.getElementById('bulk-delete-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Deleting...</span>
        `;
    }

    isDeletingAllPlayers = true;

    try {
        const totalToDelete = allPlayers.length;

        // Step 3, 4, 21: Call GoogleTourneyApi.deleteAllPlayers('DELETE') directly
        let deleteRes = null;
        if (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.deleteAllPlayers === 'function') {
            deleteRes = await window.GoogleTourneyApi.deleteAllPlayers('DELETE');
            if (!deleteRes || !deleteRes.success) {
                throw new Error(deleteRes?.error || 'Failed to delete all athletes from Google Sheets');
            }
        } else if (window.UniBoxDb && window.UniBoxDb.deleteAllPlayers) {
            deleteRes = await window.UniBoxDb.deleteAllPlayers('DELETE');
            if (!deleteRes || !deleteRes.success) {
                throw new Error(deleteRes?.error || 'Failed to delete all athletes');
            }
        } else {
            throw new Error('Google Sheets backend is not connected');
        }

        // Step 13: Mark timestamp to prevent stale in-flight polls from restoring data
        lastDeleteAllTimestamp = Date.now();

        // Step 10 & 11: Clear frontend player state immediately
        allPlayers = [];
        filteredPlayers = [];
        window.allPlayers = [];
        lastPlayersSignature = computePlayersSignature([]);

        try {
            localStorage.setItem('unibox_players', '[]');
            localStorage.removeItem('unibox_auction_players_cache');
        } catch (e) {}

        // Immediate UI updates
        updateMetrics();
        applyFilters();
        await loadTeamsData([]);

        closeBulkDeleteModal();
        const deletedNum = deleteRes?.data?.deletedCount ?? deleteRes?.deletedCount ?? totalToDelete;
        showToast(`Successfully deleted all ${deletedNum} athlete records from Google Sheets!`, 'success');

        // Step 13: Perform a fresh query to confirm backend is empty
        try {
            if (window.GoogleTourneyApi) {
                const fresh = await window.GoogleTourneyApi.getPlayers();
                if (fresh && Array.isArray(fresh.data)) {
                    allPlayers = fresh.data.map(normalizePlayer).filter(Boolean);
                    window.allPlayers = allPlayers;
                    lastPlayersSignature = computePlayersSignature(allPlayers);
                    updateMetrics();
                    applyFilters();
                }
            }
        } catch (syncErr) {
            console.warn('Post-delete verification sync notice:', syncErr);
        }
    } catch (err) {
        console.error('Bulk delete error:', err);
        showToast(`Unable to delete athletes: ${err.message || 'Database error'}`, 'error');
    } finally {
        isDeletingAllPlayers = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete All Athletes</span>
            `;
        }
    }
}

function adminLogout() {
    try {
        sessionStorage.removeItem('unibox_admin_session');
        localStorage.removeItem('unibox_admin_session');
    } catch (e) {}

    const p = window.location.pathname || '';
    let target = 'login.html';
    if (p.endsWith('/admin')) {
        target = p + '/login.html';
    } else if (p.includes('/admin/')) {
        target = p.substring(0, p.indexOf('/admin/') + 7) + 'login.html';
    } else {
        target = '/admin/login.html';
    }
    window.location.href = target;
}

function openCertViewerModal(name, data) {
    const modal = document.getElementById('cert-viewer-modal');
    const title = document.getElementById('cert-viewer-title');
    const sub = document.getElementById('cert-viewer-sub');
    const img = document.getElementById('cert-viewer-img');
    const pdf = document.getElementById('cert-viewer-pdf');
    const empty = document.getElementById('cert-viewer-empty');
    const dlLink = document.getElementById('cert-download-link');

    if (!modal) return;

    title.textContent = name || 'Sports Certificate';
    sub.textContent = data ? 'Verified Athlete Document Proof' : 'No preview available';

    img.classList.add('hidden');
    pdf.classList.add('hidden');
    empty.classList.add('hidden');

    if (data) {
        dlLink.href = data;
        dlLink.classList.remove('hidden');

        if (data.startsWith('data:application/pdf') || data.endsWith('.pdf')) {
            pdf.src = data;
            pdf.classList.remove('hidden');
        } else {
            img.src = data;
            img.classList.remove('hidden');
        }
    } else {
        dlLink.classList.add('hidden');
        empty.classList.remove('hidden');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
}

function closeCertViewerModal() {
    const modal = document.getElementById('cert-viewer-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    const pdf = document.getElementById('cert-viewer-pdf');
    if (pdf) pdf.src = '';
    document.body.classList.remove('overflow-hidden');
}

function openCertViewerFromRow(playerId) {
    const player = allPlayers.find(p => (p.id === playerId || p.email === playerId));
    if (player) {
        openCertViewerModal(player.certificate_name || player.certificate || 'Sports Certificate', player.certificate_file_url || player.certificate_data);
    }
}

// ===== CREATE FRANCHISE MODAL CONTROLLER =====
function openCreateFranchiseModal() {
    const modal = document.getElementById('modal-create-franchise');
    if (!modal) return;
    isCreatingFranchise = false;
    const alertBox = document.getElementById('create-franchise-alert');
    if (alertBox) alertBox.classList.add('hidden');
    
    // Clear / reset inputs
    const form = document.getElementById('create-franchise-form');
    if (form) form.reset();
    const logoInput = document.getElementById('new-team-logo');
    if (logoInput) logoInput.value = '🏏';
    const purseInput = document.getElementById('new-team-purse');
    if (purseInput) purseInput.value = '1000';

    const submitBtn = document.getElementById('btn-submit-create-franchise');
    const submitBtnText = document.getElementById('btn-submit-create-franchise-text');
    const spinner = document.getElementById('create-franchise-spinner');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
    }
    if (submitBtnText) submitBtnText.textContent = 'Create Franchise & Credentials';
    if (spinner) spinner.classList.add('hidden');

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');
    
    setTimeout(() => {
        document.getElementById('new-team-name')?.focus();
    }, 100);
}

function closeCreateFranchiseModal() {
    isCreatingFranchise = false;
    const modal = document.getElementById('modal-create-franchise');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

async function handleCreateFranchiseSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (isCreatingFranchise) return;

    const alertBox = document.getElementById('create-franchise-alert');
    const alertText = document.getElementById('create-franchise-alert-text');
    const alertIcon = document.getElementById('create-franchise-alert-icon');
    const spinner = document.getElementById('create-franchise-spinner');
    const submitBtn = document.getElementById('btn-submit-create-franchise');
    const submitBtnText = document.getElementById('btn-submit-create-franchise-text');

    const showAlert = (msg, isSuccess = false) => {
        if (!alertBox || !alertText) return;
        alertBox.className = isSuccess 
            ? 'p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
            : 'p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 bg-rose-500/15 border border-rose-500/30 text-rose-300';
        if (alertIcon) alertIcon.textContent = isSuccess ? '✅' : '⚠️';
        alertText.textContent = msg;
        alertBox.classList.remove('hidden');
    };

    const teamName = document.getElementById('new-team-name')?.value?.trim();
    const shortName = document.getElementById('new-team-short')?.value?.trim()?.toUpperCase();
    const ownerName = document.getElementById('new-team-owner-name')?.value?.trim();
    const ownerEmail = document.getElementById('new-team-owner-email')?.value?.trim()?.toLowerCase();
    const password = document.getElementById('new-team-password')?.value;
    const logo = document.getElementById('new-team-logo')?.value?.trim() || '🏏';
    const purse = Number(document.getElementById('new-team-purse')?.value) || 1000;

    if (!teamName || !shortName || !ownerName || !ownerEmail || !password) {
        showAlert('Please complete all required fields.');
        return;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.');
        return;
    }

    if (allTeams.length >= 8) {
        showAlert('Maximum of 8 franchises allowed.');
        return;
    }

    // Set loading state (Requirements 8 & 9)
    isCreatingFranchise = true;
    if (spinner) spinner.classList.remove('hidden');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    }
    if (submitBtnText) submitBtnText.textContent = 'Creating...';
    if (alertBox) alertBox.classList.add('hidden');

    try {
        if (!window.GoogleTourneyApi || !window.GoogleTourneyApi.isConfigured()) {
            showAlert('Tournament database is not configured. Please verify connection.');
            return;
        }

        const payload = {
            team_name: teamName,
            name: teamName,
            short_name: shortName,
            department: shortName,
            owner_name: ownerName,
            owner_email: ownerEmail,
            email: ownerEmail,
            password: password,
            logo: logo,
            purse: purse,
            role: 'ADMIN'
        };

        const res = await window.GoogleTourneyApi.createTeam(payload);
        
        let createdTeam = null;
        let isSuccess = Boolean(res && res.success);

        // Verification on timeout (Requirements 6, 7 & 21)
        // If request timed out, check whether Google Sheets write actually succeeded before showing error
        if (!isSuccess && res?.isTimeout) {
            console.warn('[CREATE FRANCHISE] Request timed out. Verifying with Google Sheets...');
            if (submitBtnText) submitBtnText.textContent = 'Verifying with Google Sheets...';
            try {
                const checkRes = await window.GoogleTourneyApi.getTeams();
                const fetchedTeams = Array.isArray(checkRes?.data) ? checkRes.data : [];
                const matched = fetchedTeams.find(t => 
                    (t.team_name && t.team_name.trim().toLowerCase() === teamName.toLowerCase()) ||
                    (t.owner_email && t.owner_email.trim().toLowerCase() === ownerEmail)
                );
                if (matched) {
                    isSuccess = true;
                    createdTeam = matched;
                    console.log('[CREATE FRANCHISE] Team verified in Google Sheets despite timeout:', matched.id);
                }
            } catch (checkErr) {
                console.error('[CREATE FRANCHISE] Verification check failed:', checkErr);
            }
        }

        if (!isSuccess) {
            const errorMsg = res?.isTimeout
                ? 'Unable to confirm franchise creation. Please check the Admin panel and Google Sheets before trying again.'
                : (res?.error || 'Failed to create franchise in Google Sheets.');
            showAlert(errorMsg);
            if (submitBtnText) submitBtnText.textContent = 'Creation Failed';
            return;
        }

        createdTeam = createdTeam || res.data?.team || res.team || res.data || {
            id: 'SPL-TEAM-' + Date.now().toString().slice(-4),
            team_name: teamName,
            name: teamName,
            short_name: shortName,
            owner_name: ownerName,
            owner_email: ownerEmail,
            logo: logo,
            purse: purse,
            total_budget: purse,
            total_spent: 0,
            spent: 0,
            remaining_purse: purse,
            leftover_balance: purse,
            player_count: 0,
            squad_count: 0,
            status: 'Active'
        };

        // Requirement 8: Set button text on success
        if (submitBtnText) submitBtnText.textContent = '✓ Created Successfully';
        showAlert(`Franchise "${teamName}" created successfully!`, true);

        // Requirement 11 & 17: Immediately update Admin state and render HUD without waiting
        if (createdTeam && !allTeams.some(t => t.id === createdTeam.id || (t.team_name && t.team_name.toLowerCase() === teamName.toLowerCase()))) {
            allTeams.push(createdTeam);
        }
        renderTeamBalanceHUD();

        // Close modal immediately and show toast
        closeCreateFranchiseModal();
        showToast(`✓ FRANCHISE CREATED: "${teamName}" (Login ID: ${ownerEmail})`, 'success');

        // Requirement 10 & 11: Background team refresh WITHOUT awaiting it!
        setTimeout(() => {
            loadTeamsData();
        }, 600);

    } catch (err) {
        console.error('Error creating franchise:', err);
        showAlert(err.message || 'Unable to connect to tournament database. Please try again.');
        if (submitBtnText) submitBtnText.textContent = 'Creation Failed';
    } finally {
        isCreatingFranchise = false;
        if (spinner) spinner.classList.add('hidden');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
        }
        setTimeout(() => {
            if (submitBtnText && submitBtnText.textContent !== 'Creating...') {
                submitBtnText.textContent = 'Create Franchise & Credentials';
            }
        }, 1200);
    }
}

// ==============================================================================
// BULK ATHLETE APPROVAL SYSTEM CONTROLLER
// ==============================================================================

function updateSelectAllCheckboxState() {
    const selectAllChk = document.getElementById('select-all-athletes-chk');
    if (!selectAllChk) return;

    const visibleEligible = filteredPlayers.filter(isAthleteEligibleForApproval);
    if (visibleEligible.length === 0) {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = false;
        selectAllChk.disabled = true;
        return;
    }

    selectAllChk.disabled = false;
    let selectedVisibleCount = 0;
    for (const p of visibleEligible) {
        const pid = p.id || p.email;
        if (selectedAthleteIds.has(pid)) {
            selectedVisibleCount++;
        }
    }

    if (selectedVisibleCount === 0) {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = false;
    } else if (selectedVisibleCount === visibleEligible.length) {
        selectAllChk.checked = true;
        selectAllChk.indeterminate = false;
    } else {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = true;
    }
}

function handleSelectAllAthletes(headerChk) {
    const visibleEligible = filteredPlayers.filter(isAthleteEligibleForApproval);
    const shouldSelect = headerChk ? headerChk.checked : false;

    visibleEligible.forEach(p => {
        const pid = p.id || p.email;
        if (shouldSelect) {
            selectedAthleteIds.add(pid);
        } else {
            selectedAthleteIds.delete(pid);
        }
    });

    document.querySelectorAll('.athlete-row-checkbox').forEach(cb => {
        const pid = cb.getAttribute('data-player-id');
        cb.checked = selectedAthleteIds.has(pid);
    });

    updateSelectAllCheckboxState();
    updateBulkToolbar();
}

function handleSelectAthlete(chk) {
    if (!chk) return;
    const pid = chk.getAttribute('data-player-id');
    if (!pid) return;

    if (chk.checked) {
        selectedAthleteIds.add(pid);
    } else {
        selectedAthleteIds.delete(pid);
    }

    updateSelectAllCheckboxState();
    updateBulkToolbar();
}

function updateBulkToolbar() {
    const toolbar = document.getElementById('bulk-athletes-toolbar');
    const badge = document.getElementById('bulk-selected-badge');
    const countLabel = document.getElementById('bulk-selected-count');
    const approveBtn = document.getElementById('bulk-approve-selected-btn');

    // Only count selected athletes that are currently present and eligible
    const validSelected = Array.from(selectedAthleteIds).filter(id => {
        const p = allPlayers.find(x => (x.id || x.email) === id);
        return p && isAthleteEligibleForApproval(p);
    });

    selectedAthleteIds = new Set(validSelected);
    const count = selectedAthleteIds.size;

    if (badge) badge.textContent = count;
    if (countLabel) countLabel.textContent = `${count} SELECTED`;
    if (approveBtn) approveBtn.disabled = count === 0;

    if (toolbar) {
        if (count > 0) {
            toolbar.classList.remove('hidden');
            toolbar.classList.add('flex');
        } else {
            toolbar.classList.add('hidden');
            toolbar.classList.remove('flex');
        }
    }
}

function clearAthleteSelection() {
    selectedAthleteIds.clear();
    document.querySelectorAll('.athlete-row-checkbox').forEach(cb => {
        cb.checked = false;
    });
    updateSelectAllCheckboxState();
    updateBulkToolbar();
}

function openApproveSelectedModal() {
    const validSelected = Array.from(selectedAthleteIds).filter(id => {
        const p = allPlayers.find(x => (x.id || x.email) === id);
        return p && isAthleteEligibleForApproval(p);
    });

    if (validSelected.length === 0) {
        showToast('No eligible athletes selected for approval.', 'warning');
        return;
    }

    const countElem = document.getElementById('approve-selected-confirm-count');
    if (countElem) {
        countElem.textContent = `${validSelected.length} selected athlete${validSelected.length === 1 ? '' : 's'}`;
    }

    const modal = document.getElementById('modal-approve-selected');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    document.body.classList.add('overflow-hidden');
}

function closeApproveSelectedModal() {
    const modal = document.getElementById('modal-approve-selected');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

async function handleConfirmApproveSelected() {
    if (isBulkApproving) return;
    const selectedIds = Array.from(selectedAthleteIds);
    if (!selectedIds.length) {
        closeApproveSelectedModal();
        return;
    }

    isBulkApproving = true;
    const submitBtn = document.getElementById('confirm-approve-selected-submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            <span>Approving ${selectedIds.length}...</span>
        `;
    }

    try {
        let res;
        if (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.approvePlayers === 'function') {
            res = await window.GoogleTourneyApi.approvePlayers(selectedIds);
        } else {
            res = { success: true, data: { approvedCount: selectedIds.length, skippedCount: 0, notFoundCount: 0 } };
        }

        if (!res || !res.success) {
            showToast(res?.error || 'Unable to approve athletes. Please try again.', 'error');
            return;
        }

        const data = res.data || {};
        const approvedCount = Number(data.approvedCount ?? selectedIds.length);
        const skippedCount = Number(data.skippedCount ?? 0);
        const notFoundCount = Number(data.notFoundCount ?? 0);

        // Immediate UI Update (Requirement 5, 11)
        const idSet = new Set(selectedIds.map(x => String(x).toLowerCase()));
        allPlayers.forEach(p => {
            const pid = String(p.id || p.original_id || '').toLowerCase();
            const pemail = String(p.email || '').toLowerCase();
            if (idSet.has(pid) || idSet.has(pemail)) {
                if (String(p.status || '').toLowerCase() !== 'rejected') {
                    p.status = 'Approved';
                    recentlyApprovedPlayerIds.set(p.id.toLowerCase(), Date.now());
                    if (p.original_id) recentlyApprovedPlayerIds.set(String(p.original_id).toLowerCase(), Date.now());
                    if (p.email) recentlyApprovedPlayerIds.set(String(p.email).toLowerCase(), Date.now());
                }
            }
        });

        // Audit Logging (Requirement 20)
        console.log('[AUDIT] Admin Action: BULK_APPROVE', {
            target: 'selected',
            count: approvedCount,
            skipped: skippedCount,
            notFound: notFoundCount,
            timestamp: new Date().toISOString()
        });

        // Clear selection (Requirement 13)
        clearAthleteSelection();
        closeApproveSelectedModal();

        updateMetrics();
        applyFilters();

        if (skippedCount > 0 || notFoundCount > 0) {
            showToast(`Approved: ${approvedCount} | Skipped: ${skippedCount} | Failed: ${notFoundCount}`, 'info');
        } else {
            showToast(`Successfully approved ${approvedCount} athlete${approvedCount === 1 ? '' : 's'}!`, 'success');
        }

        // Background synchronization with Google Sheets (Requirement 11, 21)
        setTimeout(() => {
            refreshAdminData(true);
        }, 1200);

    } catch (err) {
        console.error('Bulk approve selected error:', err);
        showToast('Unable to approve athletes. Please try again.', 'error');
    } finally {
        isBulkApproving = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

function openApproveAllModal() {
    const pendingAthletes = allPlayers.filter(isAthleteEligibleForApproval);
    const count = pendingAthletes.length;

    if (count === 0) {
        showToast('No athletes pending approval.', 'info');
        return;
    }

    const countElem = document.getElementById('approve-all-confirm-count');
    if (countElem) {
        countElem.textContent = `${count} athlete${count === 1 ? '' : 's'}`;
    }

    const modal = document.getElementById('modal-approve-all');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
    document.body.classList.add('overflow-hidden');
}

function closeApproveAllModal() {
    const modal = document.getElementById('modal-approve-all');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.body.classList.remove('overflow-hidden');
}

async function handleConfirmApproveAll() {
    if (isBulkApproving) return;

    const pendingAthletes = allPlayers.filter(isAthleteEligibleForApproval);
    if (!pendingAthletes.length) {
        closeApproveAllModal();
        showToast('No athletes pending approval.', 'info');
        return;
    }

    isBulkApproving = true;
    const submitBtn = document.getElementById('confirm-approve-all-submit-btn');
    const originalText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            <span>Approving...</span>
        `;
    }

    try {
        let res;
        if (window.GoogleTourneyApi && typeof window.GoogleTourneyApi.approveAllPlayers === 'function') {
            res = await window.GoogleTourneyApi.approveAllPlayers();
        } else {
            res = { success: true, data: { approvedCount: pendingAthletes.length, skippedCount: 0 } };
        }

        if (!res || !res.success) {
            showToast(res?.error || 'Unable to approve athletes. Please try again.', 'error');
            return;
        }

        const data = res.data || {};
        const approvedCount = Number(data.approvedCount ?? pendingAthletes.length);
        const skippedCount = Number(data.skippedCount ?? 0);

        // Immediate UI Update (Requirement 8, 9, 11)
        allPlayers.forEach(p => {
            if (isAthleteEligibleForApproval(p)) {
                p.status = 'Approved';
                recentlyApprovedPlayerIds.set(p.id.toLowerCase(), Date.now());
                if (p.original_id) recentlyApprovedPlayerIds.set(String(p.original_id).toLowerCase(), Date.now());
                if (p.email) recentlyApprovedPlayerIds.set(String(p.email).toLowerCase(), Date.now());
            }
        });

        // Audit Logging (Requirement 20)
        console.log('[AUDIT] Admin Action: BULK_APPROVE', {
            target: 'all',
            count: approvedCount,
            skipped: skippedCount,
            timestamp: new Date().toISOString()
        });

        clearAthleteSelection();
        closeApproveAllModal();

        updateMetrics();
        applyFilters();

        showToast(`Approved all ${approvedCount} pending athlete${approvedCount === 1 ? '' : 's'}!`, 'success');

        // Background synchronization with Google Sheets (Requirement 11, 21)
        setTimeout(() => {
            refreshAdminData(true);
        }, 1200);

    } catch (err) {
        console.error('Approve all error:', err);
        showToast('Unable to approve athletes. Please try again.', 'error');
    } finally {
        isBulkApproving = false;
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    }
}

// Global Exports
window.openAthleteModal = openAthleteModal;
window.closeAthleteModal = closeAthleteModal;
window.handleStatusUpdate = handleStatusUpdate;
window.handleDeletePlayer = handleDeletePlayer;
window.openBasePriceModal = openBasePriceModal;
window.closeBasePriceModal = closeBasePriceModal;
window.handleSaveBasePrices = handleSaveBasePrices;
window.applyRolePricesToAllPlayers = applyRolePricesToAllPlayers;
window.openEditBasePriceModal = openEditBasePriceModal;
window.closeEditBasePriceModal = closeEditBasePriceModal;
window.handleSavePlayerBasePrice = handleSavePlayerBasePrice;
window.openPurchaseModal = openPurchaseModal;
window.closePurchaseModal = closePurchaseModal;
window.updatePurchaseBalancePreview = updatePurchaseBalancePreview;
window.handleExecutePurchase = handleExecutePurchase;
window.handleRevokePurchase = handleRevokePurchase;
window.openTeamSquadModal = openTeamSquadModal;
window.closeTeamSquadModal = closeTeamSquadModal;
window.handleDeleteTeam = handleDeleteTeam;
window.handleDeleteTeamFromModal = handleDeleteTeamFromModal;
window.openCertViewerModal = openCertViewerModal;
window.closeCertViewerModal = closeCertViewerModal;
window.openCertViewerFromRow = openCertViewerFromRow;
window.openBulkDeleteModal = openBulkDeleteModal;
window.closeBulkDeleteModal = closeBulkDeleteModal;
window.handleExecuteBulkDelete = handleExecuteBulkDelete;
window.openCreateFranchiseModal = openCreateFranchiseModal;
window.closeCreateFranchiseModal = closeCreateFranchiseModal;
window.handleCreateFranchiseSubmit = handleCreateFranchiseSubmit;
window.handleSelectAthlete = handleSelectAthlete;
window.handleSelectAllAthletes = handleSelectAllAthletes;
window.clearAthleteSelection = clearAthleteSelection;
window.openApproveSelectedModal = openApproveSelectedModal;
window.closeApproveSelectedModal = closeApproveSelectedModal;
window.handleConfirmApproveSelected = handleConfirmApproveSelected;
window.openApproveAllModal = openApproveAllModal;
window.closeApproveAllModal = closeApproveAllModal;
window.handleConfirmApproveAll = handleConfirmApproveAll;
window.loadRosterData = loadRosterData;
window.adminLogout = adminLogout;
window.refreshAdminData = refreshAdminData;
window.startAutoRefresh = startAutoRefresh;
window.stopAutoRefresh = stopAutoRefresh;
window.adminState = adminState;
window.initAdminDashboard = initAdminDashboard;

