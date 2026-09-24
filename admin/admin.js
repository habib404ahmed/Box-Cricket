// ==============================================================================
// UniBox League 2026 - Tournament Admin Command Center Controller
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

// Initialize Admin Dashboard with lifecycle check
let isDashboardInitialized = false;
async function initAdminDashboard() {
    if (isDashboardInitialized) return;
    isDashboardInitialized = true;

    initDbStatus();
    bindEventListeners();
    initRealtimeAuctionSync();

    // Independent parallel loaders — one failure must not block the other
    await Promise.allSettled([
        loadRosterData(true),
        loadTeamsData()
    ]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminDashboard);
} else {
    // DOM already loaded or interactive
    initAdminDashboard();
}

// 1. Connection Status Badge
function initDbStatus() {
    const dbStatusBadge = document.getElementById('db-status-badge');
    const dbStatusText = document.getElementById('db-status-text');

    if (window.UniBoxDb && window.UniBoxDb.isReady()) {
        dbStatusText.textContent = 'Supabase Live';
        dbStatusBadge.classList.remove('hidden');
    } else {
        dbStatusText.textContent = 'Local Storage Mode';
        dbStatusBadge.classList.remove('hidden');
    }
}

// 2. Load Teams Data & Live Leftover Balance HUD
async function loadTeamsData(providedPlayers = null) {
    try {
        if (window.UniBoxDb) {
            const { data } = await window.UniBoxDb.getAllTeams(providedPlayers || allPlayers);
            allTeams = Array.isArray(data) ? data : [];
        } else {
            allTeams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
        }
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
    if (!teamsHudContainer) return;

    if (!allTeams.length) {
        teamsHudContainer.innerHTML = `<div class="col-span-full py-6 text-center text-slate-400 text-xs bg-[#08111F]/50 rounded-2xl border border-sky-950/60">No franchise balances available</div>`;
        return;
    }

    teamsHudContainer.innerHTML = allTeams.map(team => {
        const total = Number(team.total_budget) || 1000;
        const spent = Number(team.spent) || 0;
        const leftover = Math.max(0, total - spent);
        const spentPct = Math.min(100, (spent / total) * 100);
        const squadCount = team.squad_count || (team.squad ? team.squad.length : 0);

        return `
            <div onclick="openTeamSquadModal('${team.id}')"
                class="group p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-lime-400/40 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between shadow-lg hover:shadow-lime-400/5">
                
                <!-- Team Card Header -->
                <div>
                    <div class="flex items-center justify-between gap-2 mb-2">
                        <span class="text-xl p-1.5 rounded-xl bg-slate-900 border border-slate-800 shrink-0 group-hover:scale-110 transition-transform">${team.logo || '🏏'}</span>
                        <div class="flex items-center gap-1.5">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-slate-900 text-slate-400 border border-slate-800">
                                ${team.department}
                            </span>
                            <button type="button" onclick="event.stopPropagation(); handleDeleteTeam('${team.id}')"
                                class="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/15 transition-all cursor-pointer opacity-70 group-hover:opacity-100"
                                title="Delete ${team.name}">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                    </div>
                    <h4 class="font-black text-white text-sm uppercase truncate group-hover:text-lime-400 transition-colors">${team.name}</h4>
                    <div class="mt-1 flex items-center gap-1.5 text-[11px] truncate">
                        <span class="text-amber-400 text-xs">👑</span>
                        <span class="${team.owner_name ? 'text-amber-300 font-semibold' : 'text-slate-500 font-normal'} truncate">
                            ${team.owner_name ? team.owner_name : 'No Owner Claimed'}
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

// 3. Load Athletes from Supabase / UniBoxDb
async function loadRosterData(showSpinner = true) {
    if (showSpinner && !allPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-3">
                        <div class="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-xs text-slate-400 font-medium">Fetching tournament athletes from Supabase...</p>
                    </div>
                </td>
            </tr>
        `;
    }

    if (refreshIcon) refreshIcon.classList.add('animate-spin');

    try {
        if (window.UniBoxDb) {
            const { data, error } = await window.UniBoxDb.getAllPlayers();
            if (error) throw error;
            allPlayers = Array.isArray(data) ? data : [];
        } else {
            allPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        }

        updateMetrics();
        applyFilters();
        // Update teams HUD with newly loaded players without duplicate network query
        loadTeamsData(allPlayers);
    } catch (err) {
        console.error('Error loading roster data:', err);
        showToast('Error loading roster data. Check database connection.', 'error');
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="py-12 text-center">
                    <div class="max-w-md mx-auto p-6 rounded-2xl bg-[#08111F]/90 border border-rose-500/30 text-center space-y-3">
                        <span class="text-3xl">⚠️</span>
                        <h3 class="text-sm font-bold text-slate-200">Unable to Load Athletes</h3>
                        <p class="text-xs text-slate-400">We couldn't retrieve tournament data from the database.</p>
                        <p class="text-[11px] font-mono text-slate-500">${err?.message || 'Connection failed'}</p>
                        <button type="button" onclick="loadRosterData(true)" class="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5 mx-auto">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                            Try Again
                        </button>
                    </div>
                </td>
            </tr>
        `;
    } finally {
        if (refreshIcon) {
            setTimeout(() => refreshIcon.classList.remove('animate-spin'), 400);
        }
    }
}

// 4. Compute and Update KPI Metrics
function updateMetrics() {
    const total = allPlayers.length;
    const approved = allPlayers.filter(p => p.status === 'Approved').length;
    const pending = allPlayers.filter(p => p.status === 'Registered' || !p.status).length;
    const depts = new Set(allPlayers.map(p => (p.department || '').trim()).filter(Boolean));

    statTotal.textContent = total;
    statApproved.textContent = approved;
    statPending.textContent = pending;
    statDepts.textContent = depts.size;

    const approvedPct = total > 0 ? (approved / total) * 100 : 0;
    const pendingPct = total > 0 ? (pending / total) * 100 : 0;

    statApprovedBar.style.width = `${approvedPct}%`;
    statPendingBar.style.width = `${pendingPct}%`;
}

// 5. Filtering and Search Logic
function applyFilters() {
    const query = (searchInput?.value || '').toLowerCase().trim();
    const dept = deptFilter?.value || 'ALL';
    const role = roleFilter?.value || 'ALL';
    const status = statusFilter?.value || 'ALL';
    const auction = auctionFilter?.value || 'ALL';

    filteredPlayers = allPlayers.filter(player => {
        const name = (player.full_name || player.name || '').toLowerCase();
        const roll = (player.enrollment_no || '').toLowerCase();
        const email = (player.email || '').toLowerCase();
        const playerDept = (player.department || '').toLowerCase();
        const playerRole = player.player_role || '';
        const playerStatus = player.status || 'Registered';
        const playerAuctionStatus = player.auction_status || (player.sold_to_team ? 'Sold' : 'Upcoming');

        // Search match
        const matchesQuery = !query || 
            name.includes(query) || 
            roll.includes(query) || 
            email.includes(query) || 
            playerDept.includes(query);

        // Department match
        const matchesDept = dept === 'ALL' || (player.department || '').toUpperCase() === dept.toUpperCase();

        // Role match
        const matchesRole = role === 'ALL' || playerRole === role;

        // Status match
        const matchesStatus = status === 'ALL' || 
            (status === 'Registered' && (playerStatus === 'Registered' || !playerStatus)) ||
            playerStatus === status;

        // Auction match
        const matchesAuction = auction === 'ALL' || playerAuctionStatus === auction;

        return matchesQuery && matchesDept && matchesRole && matchesStatus && matchesAuction;
    });

    renderRosterTable();
    updateTableSummary();
}

// 6. Render Dynamic Roster Table Rows
function renderRosterTable() {
    if (!allPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <span class="text-3xl">📋</span>
                        <p class="text-sm font-bold text-slate-300">No athletes found</p>
                        <p class="text-xs text-slate-500">No athlete registrations have been submitted to the tournament yet.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    if (!filteredPlayers.length) {
        rosterTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="py-12 text-center text-slate-500">
                    <div class="flex flex-col items-center justify-center gap-2">
                        <span class="text-3xl">🔍</span>
                        <p class="text-sm font-bold text-slate-300">No matching athletes found</p>
                        <p class="text-xs text-slate-500">Try adjusting your search or clear the filters.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    rosterTableBody.innerHTML = filteredPlayers.map(player => {
        const id = player.id || player.email;
        const name = player.full_name || player.name || 'Athlete';
        const email = player.email || '---';
        const enrollment = player.enrollment_no || '---';
        const department = player.department || '---';
        const role = player.player_role || 'All-Rounder';
        const photo = player.photo_data || player.photo || '';
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

        // Avatar Image or Fallback initials
        const avatarHtml = photo
            ? `<img src="${photo}" alt="${name}" class="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0">`
            : `<div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">${name.substring(0, 2).toUpperCase()}</div>`;

        // Purchase / Refund Action Button
        let purchaseActionBtn = '';
        if (isSold) {
            purchaseActionBtn = `
                <button type="button" onclick="handleRevokePurchase('${id}')"
                    class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer font-bold text-xs flex items-center gap-1"
                    title="Revoke Player Sale & Refund Team Balance">
                    <span>↩️</span> <span class="hidden xl:inline">Refund</span>
                </button>
            `;
        } else {
            purchaseActionBtn = `
                <button type="button" onclick="openPurchaseModal('${id}')"
                    class="p-2 rounded-lg bg-gradient-to-r from-lime-400/20 to-emerald-400/20 hover:from-lime-400 hover:to-emerald-400 text-lime-400 hover:text-slate-950 border border-lime-400/30 transition-all cursor-pointer font-black text-xs flex items-center gap-1 shadow-sm"
                    title="Purchase Athlete for Franchise">
                    <span>🔨</span> <span class="hidden xl:inline">Sell</span>
                </button>
            `;
        }

        return `
            <tr class="hover:bg-slate-900/80 transition-colors group">
                <!-- Athlete Profile -->
                <td class="py-4 px-6">
                    <div class="flex items-center gap-3">
                        ${avatarHtml}
                        <div class="overflow-hidden">
                            <p class="font-bold text-white text-sm truncate group-hover:text-lime-400 transition-colors cursor-pointer" onclick="openAthleteModal('${id}')">${name}</p>
                            <p class="text-xs text-slate-500 font-mono truncate">${email}</p>
                        </div>
                    </div>
                </td>

                <!-- Enrollment ID -->
                <td class="py-4 px-3 font-mono text-xs text-slate-300">
                    <span class="bg-slate-950 px-2 py-1 rounded-md border border-slate-800 font-bold">${enrollment}</span>
                </td>

                <!-- Department -->
                <td class="py-4 px-3">
                    <span class="text-xs font-semibold text-slate-300">${department}</span>
                </td>

                <!-- Playing Role -->
                <td class="py-4 px-3">
                    ${roleBadge}
                </td>

                <!-- Base Price -->
                <td class="py-4 px-3">
                    ${basePriceHtml}
                </td>

                <!-- Clearance Status -->
                <td class="py-4 px-3">
                    ${statusBadge}
                </td>

                <!-- Auction Status -->
                <td class="py-4 px-4">
                    ${auctionBadge}
                </td>

                <!-- Actions -->
                <td class="py-4 px-6 text-right no-print">
                    <div class="flex items-center justify-end gap-1.5">
                        <!-- Purchase / Refund Button -->
                        ${purchaseActionBtn}

                        <!-- Quick Approve -->
                        <button type="button" onclick="handleStatusUpdate('${id}', 'Approved')"
                            class="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer" title="Approve Athlete">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        </button>

                        <!-- Quick Reject -->
                        <button type="button" onclick="handleStatusUpdate('${id}', 'Rejected')"
                            class="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all cursor-pointer" title="Reject Athlete">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <!-- View Modal -->
                        <button type="button" onclick="openAthleteModal('${id}')"
                            class="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all cursor-pointer" title="Inspect Full Record">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </button>

                        <!-- Delete -->
                        <button type="button" onclick="handleDeletePlayer('${id}')"
                            class="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer" title="Delete Registration">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
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
        if (player.certificate_data || hasCertDoc) {
            modalViewCertBtn.classList.remove('hidden');
            modalViewCertBtn.onclick = () => openCertViewerModal(certName, player.certificate_data);
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

    if (player.photo_data) {
        modalPhoto.src = player.photo_data;
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
    const status = activeModalPlayer.status || 'Registered';

    if (status === 'Approved') {
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 mb-1';
        modalStatusBadge.textContent = 'Approved for Matchday';
    } else if (status === 'Rejected') {
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-400/10 text-rose-400 border border-rose-400/20 mb-1';
        modalStatusBadge.textContent = 'Clearance Rejected';
    } else {
        modalStatusBadge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20 mb-1';
        modalStatusBadge.textContent = 'Pending Clearance';
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
    if (player.photo_data) {
        photoImg.src = player.photo_data;
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

function handleDeleteTeamFromModal() {
    if (activeSquadTeamId) {
        handleDeleteTeam(activeSquadTeamId);
    }
}

async function handleDeleteTeam(teamId) {
    const team = allTeams.find(t => t.id === teamId);
    if (!team) return;

    const squadCount = team.squad_count || (team.squad ? team.squad.length : 0);
    const squadWarning = squadCount > 0 
        ? `\n\n⚠️ NOTE: This team currently has ${squadCount} athlete(s) in its squad. Deleting this franchise will automatically release all squad members back to the "Upcoming" auction pool.` 
        : '';

    if (!confirm(`Are you sure you want to permanently delete the franchise "${team.name}" (${team.department})?${squadWarning}\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        if (window.UniBoxDb && window.UniBoxDb.deleteTeam) {
            const res = await window.UniBoxDb.deleteTeam(teamId);
            if (!res.success) {
                throw new Error(res.error || 'Failed to delete team');
            }
        }

        closeTeamSquadModal();
        await Promise.all([loadTeamsData(), loadRosterData()]);
        showToast(`Franchise "${team.name}" was successfully deleted!`, 'success');
    } catch (err) {
        console.error('Delete team error:', err);
        showToast(`Failed to delete team: ${err.message || 'Unknown error'}`, 'error');
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
    const headers = ['Full Name', 'Enrollment No', 'Department', 'Email', 'Gender', 'Role', 'Base Points', 'Auction Status', 'Sold To Team', 'Purchase Points', 'Clearance Status', 'Registration Date'];

    const rows = dataToExport.map(p => [
        `"${(p.full_name || p.name || '').replace(/"/g, '""')}"`,
        `"${(p.enrollment_no || '').replace(/"/g, '""')}"`,
        `"${(p.department || '').replace(/"/g, '""')}"`,
        `"${(p.email || '').replace(/"/g, '""')}"`,
        `"${(p.gender || '').replace(/"/g, '""')}"`,
        `"${(p.player_role || '').replace(/"/g, '""')}"`,
        `"${(p.base_price !== undefined ? p.base_price : '')}"`,
        `"${(p.auction_status || (p.sold_to_team ? 'Sold' : 'Upcoming'))}"`,
        `"${(p.sold_to_team || '')}"`,
        `"${(p.sold_price !== undefined && p.sold_price !== null ? p.sold_price : '')}"`,
        `"${(p.status || 'Registered')}"`,
        `"${(p.created_at || new Date().toISOString())}"`
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
    searchInput?.addEventListener('input', applyFilters);
    deptFilter?.addEventListener('change', applyFilters);
    roleFilter?.addEventListener('change', applyFilters);
    statusFilter?.addEventListener('change', applyFilters);
    auctionFilter?.addEventListener('change', applyFilters);
    refreshBtn?.addEventListener('click', () => loadRosterData(true));
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAthleteModal();
            closeBasePriceModal();
            closePurchaseModal();
            closeEditBasePriceModal();
            closeTeamSquadModal();
            closeCertViewerModal();
        }
    });
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
        openCertViewerModal(player.certificate_name || player.certificate || 'Sports Certificate', player.certificate_data);
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
window.adminLogout = adminLogout;

