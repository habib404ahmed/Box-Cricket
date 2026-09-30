// ==============================================================================
// Sunstone Premier League 2026 - Franchise Owner Dashboard Controller
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. AUTHENTICATION GUARD
    const sessionRaw = localStorage.getItem('unibox_team_owner_session') || sessionStorage.getItem('unibox_team_owner_session');
    if (!sessionRaw) {
        window.location.replace('/team/login');
        return;
    }

    let session = null;
    try {
        session = JSON.parse(sessionRaw);
    } catch (e) {
        localStorage.removeItem('unibox_team_owner_session');
        sessionStorage.removeItem('unibox_team_owner_session');
        window.location.replace('/team/login');
        return;
    }

    if (!session || !session.email) {
        localStorage.removeItem('unibox_team_owner_session');
        sessionStorage.removeItem('unibox_team_owner_session');
        window.location.replace('/team/login');
        return;
    }

    // Central Tournament Capacity
    const MAX_SQUAD_SIZE = 10;

    // Centralized State
    const teamState = {
        currentTeam: null,
        currentSquad: [],
        allTournamentPlayers: [],
        activeTab: 'squad',
        isSyncing: false,
        lastSyncStateSig: '',
        lastOwnerDataSig: '',
        isFirstLoad: true
    };

    let currentTeam = null;
    let currentSquad = [];
    let allTournamentPlayers = [];
    let activeTab = 'squad'; // 'squad' or 'auction'

    // DOM Elements
    const headerLogo = document.getElementById('header-team-logo');
    const headerName = document.getElementById('header-team-name');
    const headerDept = document.getElementById('header-team-dept');
    const headerOwner = document.getElementById('header-owner-name');
    const ambientGlow = document.getElementById('team-ambient-glow');

    const hudLeftover = document.getElementById('hud-leftover-balance');
    const hudSpent = document.getElementById('hud-spent-amount');
    const hudTotal = document.getElementById('hud-total-budget');
    const hudBar = document.getElementById('hud-budget-bar');
    const hudSquadCount = document.getElementById('hud-squad-count');
    const hudAvgPrice = document.getElementById('hud-avg-price');
    const hudTopBid = document.getElementById('hud-top-bid');
    const tabSquadBadge = document.getElementById('tab-squad-badge');

    const countBatters = document.getElementById('count-batters');
    const countBowlers = document.getElementById('count-bowlers');
    const countAllrounders = document.getElementById('count-allrounders');
    const countKeepers = document.getElementById('count-keepers');
    const countFielders = document.getElementById('count-fielders');

    const squadGrid = document.getElementById('squad-grid');
    const emptySquadBox = document.getElementById('empty-squad-box');
    const auctionFeedList = document.getElementById('auction-feed-list');
    const poolGrid = document.getElementById('pool-grid');
    const poolRoleFilter = document.getElementById('pool-role-filter');

    const viewTabSquad = document.getElementById('view-tab-squad');
    const viewTabAuction = document.getElementById('view-tab-auction');
    const viewSquadContainer = document.getElementById('view-squad-container');
    const viewAuctionContainer = document.getElementById('view-auction-container');
    const refreshBtn = document.getElementById('refresh-squad-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const logoutBtn = document.getElementById('owner-logout-btn');
    const switchToAuctionBtn = document.getElementById('switch-to-auction-btn');

    /**
     * Extracts Google Drive file ID from URLs or raw file IDs
     */
    function extractDriveFileId(str) {
        if (!str || typeof str !== 'string') return '';
        str = str.trim();
        const m1 = str.match(/\/file\/d\/([a-zA-Z0-9_-]{15,})/i);
        if (m1) return m1[1];
        const m2 = str.match(/[?&]id=([a-zA-Z0-9_-]{15,})/i);
        if (m2) return m2[1];
        const m3 = str.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{15,})/i);
        if (m3) return m3[1];
        const m4 = str.match(/\/open\?id=([a-zA-Z0-9_-]{15,})/i);
        if (m4) return m4[1];
        if (/^[a-zA-Z0-9_-]{20,60}$/.test(str)) return str;
        return '';
    }

    /**
     * Generates an array of fallback candidate image URLs for a team logo
     */
    function getTeamLogoCandidates(team) {
        if (!team) return [];
        const rawId = team.logo_file_id || team.logoFileId || '';
        const rawUrl = team.logo_file_url || team.logoFileUrl || (typeof team.logo === 'string' && (team.logo.startsWith('http') || team.logo.startsWith('data:') || team.logo.startsWith('/')) ? team.logo : '');

        const driveId = extractDriveFileId(rawId) || extractDriveFileId(rawUrl) || extractDriveFileId(team.logo);
        const candidates = [];

        if (driveId) {
            candidates.push(`https://lh3.googleusercontent.com/d/${driveId}`);
            candidates.push(`https://drive.google.com/thumbnail?id=${driveId}&sz=w500`);
            candidates.push(`https://drive.google.com/uc?export=view&id=${driveId}`);
            candidates.push(`https://drive.google.com/uc?id=${driveId}`);
        } else if (rawUrl && (rawUrl.startsWith('http') || rawUrl.startsWith('data:') || rawUrl.startsWith('/'))) {
            candidates.push(rawUrl);
        }

        return candidates;
    }

    /**
     * Renders team logo element with resilient multi-tier fallback
     */
    function renderTeamLogo(container, team) {
        if (!container || !team) return;
        const candidates = getTeamLogoCandidates(team);
        const emoji = (team.logo && !team.logo.startsWith('http') && !team.logo.startsWith('data:') && !team.logo.startsWith('/')) ? team.logo : '🏏';

        if (candidates.length > 0) {
            const teamName = team.team_name || team.name || 'Team Logo';
            container.innerHTML = `<img src="${candidates[0]}" alt="${teamName}" class="w-full h-full object-contain p-1 rounded-xl" data-cand-idx="0" referrerpolicy="no-referrer">`;
            const img = container.querySelector('img');
            if (img) {
                img.onerror = function() {
                    let idx = parseInt(this.getAttribute('data-cand-idx') || '0', 10);
                    idx++;
                    if (idx < candidates.length) {
                        this.setAttribute('data-cand-idx', idx);
                        this.src = candidates[idx];
                    } else {
                        this.onerror = null;
                        container.innerHTML = `<span class="text-xl sm:text-2xl">${emoji}</span>`;
                    }
                };
            }
        } else {
            container.innerHTML = `<span class="text-xl sm:text-2xl">${emoji}</span>`;
        }
    }

    // Progressive Shell Render: Show known session info immediately
    if (session.teamName && headerName) headerName.textContent = session.teamName;
    if (session.ownerName && headerOwner) headerOwner.textContent = session.ownerName;
    if (headerLogo && (session.logo_file_url || session.logo_file_id || (session.logo && session.logo.startsWith('http')))) {
        renderTeamLogo(headerLogo, {
            logo_file_url: session.logo_file_url,
            logo_file_id: session.logo_file_id,
            logo: session.logo,
            team_name: session.teamName
        });
    }

    // 2. LOGOUT HANDLER
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                localStorage.removeItem('unibox_team_owner_session');
                sessionStorage.removeItem('unibox_team_owner_session');
            } catch (err) {}
            window.location.replace('/team/login');
        });
    }

    // 3. TAB SWITCHING
    function setTab(tab) {
        activeTab = tab;
        teamState.activeTab = tab;
        if (tab === 'squad') {
            viewTabSquad.className = 'px-5 py-2.5 rounded-2xl text-xs font-black transition-all bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 cursor-pointer';
            viewTabAuction.className = 'px-5 py-2.5 rounded-2xl text-xs font-bold transition-all text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer';
            viewSquadContainer.classList.remove('hidden');
            viewAuctionContainer.classList.add('hidden');
        } else {
            viewTabAuction.className = 'px-5 py-2.5 rounded-2xl text-xs font-black transition-all bg-lime-400 text-slate-950 shadow-lg shadow-lime-400/20 cursor-pointer';
            viewTabSquad.className = 'px-5 py-2.5 rounded-2xl text-xs font-bold transition-all text-slate-400 hover:text-white bg-slate-900 border border-slate-800 cursor-pointer';
            viewAuctionContainer.classList.remove('hidden');
            viewSquadContainer.classList.add('hidden');
            renderAuctionWatcherView();
        }
    }

    if (viewTabSquad) viewTabSquad.addEventListener('click', () => setTab('squad'));
    if (viewTabAuction) viewTabAuction.addEventListener('click', () => setTab('auction'));
    if (switchToAuctionBtn) switchToAuctionBtn.addEventListener('click', () => setTab('auction'));

    if (poolRoleFilter) {
        poolRoleFilter.addEventListener('change', () => renderPoolAthletes());
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            if (refreshIcon) refreshIcon.classList.add('animate-spin');
            await loadFranchiseData(true);
            setTimeout(() => refreshIcon?.classList.remove('animate-spin'), 400);
            showToast('Franchise data refreshed!', 'info');
        });
    }

    // Render lightweight skeleton cards while loading initial squad
    function renderSquadSkeletons() {
        if (!squadGrid || teamState.currentSquad.length > 0) return;
        squadGrid.innerHTML = [1, 2, 3].map(() => `
            <div class="rounded-3xl bg-slate-900/60 border border-slate-800 p-5 space-y-4 animate-pulse shadow-xl">
                <div class="flex items-start gap-3.5 mb-3">
                    <div class="w-14 h-14 rounded-2xl bg-slate-800 shrink-0"></div>
                    <div class="min-w-0 flex-1 space-y-2">
                        <div class="h-4 bg-slate-800 rounded w-3/4"></div>
                        <div class="h-3 bg-slate-800 rounded w-1/2"></div>
                    </div>
                </div>
                <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <div class="h-5 bg-slate-800 rounded w-20"></div>
                    <div class="h-4 bg-slate-800 rounded w-24"></div>
                </div>
            </div>
        `).join('');
    }

    // 4. LOAD FRANCHISE DATA & SQUAD (Smart Real-Time Auto Sync with zero DOM churn)
    async function loadFranchiseData(force = false) {
        if (!window.UniBoxDb && !window.GoogleTourneyApi) return;
        if (teamState.isSyncing) return;
        if (!force && document.hidden) return;

        teamState.isSyncing = true;
        try {
            // Lightweight 1-second check: verify sync state signature before fetching full datasets
            if (!force && window.GoogleTourneyApi && typeof window.GoogleTourneyApi.getSyncState === 'function') {
                const syncRes = await window.GoogleTourneyApi.getSyncState();
                if (syncRes && syncRes.success && syncRes.data) {
                    const sig = `${syncRes.data.teamsCount}_${syncRes.data.playersCount}_${syncRes.data.lastUpdated}`;
                    if (sig === teamState.lastSyncStateSig) {
                        return; // Zero changes in Google Sheets, 0 network overhead, 0 DOM manipulation!
                    }
                    teamState.lastSyncStateSig = sig;
                }
            }

            // Parallel fetch of teams and players (Requirement 7)
            const [teamsResult, playersResult] = await Promise.all([
                (window.GoogleTourneyApi && window.GoogleTourneyApi.isConfigured())
                    ? window.GoogleTourneyApi.getTeams()
                    : (window.UniBoxDb ? window.UniBoxDb.getAllTeams() : Promise.resolve({ data: [] })),
                (window.GoogleTourneyApi && window.GoogleTourneyApi.isConfigured())
                    ? window.GoogleTourneyApi.getPlayers()
                    : (window.UniBoxDb ? window.UniBoxDb.getAllPlayers() : Promise.resolve({ data: [] }))
            ]);

            const allT = Array.isArray(teamsResult?.data) ? teamsResult.data : [];
            const email = (session.email || '').trim().toLowerCase();
            const teamId = (session.teamId || '').trim();

            let team = null;
            if (teamId) {
                team = allT.find(t => String(t.id).trim().toLowerCase() === teamId.toLowerCase());
            }
            if (!team && email) {
                team = allT.find(t => t.owner_email && t.owner_email.toLowerCase() === email);
            }
            if (!team && session.teamName) {
                team = allT.find(t => (t.name || t.team_name || '').toLowerCase() === session.teamName.toLowerCase());
            }

            if (!team) return;

            // Cache logo in session if resolved
            if (team.logo_file_url || team.logo_file_id) {
                try {
                    const sess = JSON.parse(localStorage.getItem('unibox_team_owner_session') || '{}');
                    sess.logo_file_id = team.logo_file_id || sess.logo_file_id || '';
                    sess.logo_file_url = team.logo_file_url || sess.logo_file_url || '';
                    sess.logo = team.logo || sess.logo || '';
                    localStorage.setItem('unibox_team_owner_session', JSON.stringify(sess));
                    sessionStorage.setItem('unibox_team_owner_session', JSON.stringify(sess));
                } catch (e) {}
            }

            teamState.currentTeam = team;
            teamState.currentSquad = team.squad || [];
            currentTeam = team;
            currentSquad = team.squad || [];

            teamState.allTournamentPlayers = (playersResult && playersResult.data) || [];
            allTournamentPlayers = teamState.allTournamentPlayers;

            const currentSig = JSON.stringify({
                id: team.id,
                name: team.team_name || team.name,
                purse: team.purse,
                spent: team.total_spent,
                leftover: team.remaining_purse,
                squadCount: (team.squad || []).length,
                squad: (team.squad || []).map(p => ({ id: p.id, sold_price: p.sold_price })),
                poolCount: teamState.allTournamentPlayers.length
            });

            if (force || currentSig !== teamState.lastOwnerDataSig) {
                teamState.lastOwnerDataSig = currentSig;
                renderHeader();
                renderHUD();
                renderSquadGrid();
                if (teamState.activeTab === 'auction') {
                    renderAuctionWatcherView();
                }
            }
        } catch (err) {
            console.error('Failed to load franchise data:', err);
        } finally {
            teamState.isSyncing = false;
            teamState.isFirstLoad = false;
        }
    }

    // 5. RENDER HEADER
    function renderHeader() {
        if (!currentTeam) return;

        if (headerLogo) {
            renderTeamLogo(headerLogo, currentTeam);
        }
        if (headerName) headerName.textContent = currentTeam.team_name || currentTeam.name || 'My Franchise';
        if (headerDept) {
            const dept = currentTeam.department || '';
            const code = currentTeam.short_name || '';
            headerDept.textContent = dept && code && dept !== code ? `${dept} • ${code}` : (dept || code || 'SPL');
        }
        if (headerOwner) headerOwner.textContent = currentTeam.owner_name || session.ownerName || 'Franchise Owner';

        // Update ambient glow color if custom color specified
        if (ambientGlow && currentTeam.color) {
            ambientGlow.style.backgroundColor = `${currentTeam.color}15`;
        }
    }

    // 6. RENDER LIVE PURSE HUD & STATS
    function renderHUD() {
        if (!currentTeam) return;

        const leftover = Number(currentTeam.leftover_balance ?? currentTeam.remaining_purse ?? 1000);
        const total = Number(currentTeam.total_budget ?? currentTeam.purse ?? 1000);
        const spent = Number(currentTeam.spent ?? currentTeam.total_spent ?? 0);
        const squadCount = currentSquad.length;

        if (hudLeftover) hudLeftover.textContent = `${leftover.toFixed(1)} Pts`;
        if (hudSpent) hudSpent.textContent = `${spent.toFixed(1)} Pts`;
        if (hudTotal) hudTotal.textContent = `${total.toFixed(1)} Pts`;
        if (hudSquadCount) hudSquadCount.textContent = squadCount;
        if (tabSquadBadge) tabSquadBadge.textContent = squadCount;

        const hudSquadSlots = document.getElementById('hud-squad-slots');
        const availableSlots = Math.max(0, MAX_SQUAD_SIZE - squadCount);
        if (hudSquadSlots) {
            hudSquadSlots.textContent = squadCount >= MAX_SQUAD_SIZE 
                ? 'Squad Full' 
                : `${availableSlots} Slots Available (Max ${MAX_SQUAD_SIZE})`;
        }

        // Progress bar
        const pctUsed = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
        if (hudBar) {
            hudBar.style.width = `${pctUsed}%`;
            if (pctUsed > 85) {
                hudBar.className = 'h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-700';
            } else {
                hudBar.className = 'h-full bg-gradient-to-r from-lime-400 to-emerald-400 rounded-full transition-all duration-700';
            }
        }

        // Average and Top Bid
        if (squadCount > 0) {
            const avg = (spent / squadCount).toFixed(1);
            if (hudAvgPrice) hudAvgPrice.textContent = `${avg} Pts`;

            const topPlayer = [...currentSquad].sort((a, b) => (Number(b.sold_price) || 0) - (Number(a.sold_price) || 0))[0];
            if (hudTopBid && topPlayer) {
                hudTopBid.textContent = `${topPlayer.full_name || topPlayer.name} (${topPlayer.sold_price} Pts)`;
            }
        } else {
            if (hudAvgPrice) hudAvgPrice.textContent = `0 Pts`;
            if (hudTopBid) hudTopBid.textContent = `None`;
        }

        // Squad Composition Counts
        let bCount = 0, bowlCount = 0, arCount = 0, wkCount = 0, fCount = 0;
        currentSquad.forEach(p => {
            const r = (p.player_role || '').toLowerCase();
            if (r.includes('bat')) bCount++;
            else if (r.includes('bowl')) bowlCount++;
            else if (r.includes('round')) arCount++;
            else if (r.includes('keeper') || r.includes('wk')) wkCount++;
            else fCount++;
        });

        if (countBatters) countBatters.textContent = bCount;
        if (countBowlers) countBowlers.textContent = bowlCount;
        if (countAllrounders) countAllrounders.textContent = arCount;
        if (countKeepers) countKeepers.textContent = wkCount;
        if (countFielders) countFielders.textContent = fCount;
    }

    // 7. RENDER MY SQUAD GRID
    function renderSquadGrid() {
        if (!squadGrid) return;

        if (!currentSquad.length) {
            squadGrid.innerHTML = '';
            if (emptySquadBox) emptySquadBox.classList.remove('hidden');
            return;
        }

        if (emptySquadBox) emptySquadBox.classList.add('hidden');

        squadGrid.innerHTML = currentSquad.map((player, idx) => {
            const name = player.full_name || player.name || 'Athlete';
            const roll = player.enrollment_no || '---';
            const dept = player.department || '---';
            const role = player.player_role || 'All-Rounder';
            const price = Number(player.sold_price) || 0;
            const photo = player.photo_file_url || player.photo_data || player.photo || null;
            const certName = player.certificate_name || player.certificate || '';
            const certData = player.certificate_file_url || player.certificate_data || null;
            const hasCert = Boolean(certData || (certName && certName !== 'None' && certName !== 'None attached'));

            // Role badge styling
            let roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700">${role}</span>`;
            if (role === 'All-Rounder') {
                roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-lime-400/10 text-lime-400 border border-lime-400/20">⚡ ${role}</span>`;
            } else if (role === 'Batter' || role === 'Batsman') {
                roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-400/10 text-sky-400 border border-sky-400/20">🏏 ${role}</span>`;
            } else if (role === 'Bowler') {
                roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-400/10 text-teal-400 border border-teal-400/20">🎯 ${role}</span>`;
            } else if (role === 'Wicketkeeper') {
                roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">🧤 ${role}</span>`;
            } else if (role === 'Fielder') {
                roleBadge = `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">🛡️ ${role}</span>`;
            }

            return `
                <div class="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition-all shadow-xl flex flex-col justify-between">
                    <div>
                        <!-- Header: Photo & Identity -->
                        <div class="flex items-start gap-3.5 mb-3">
                            <div class="w-14 h-14 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center text-xl shadow-inner">
                                ${photo 
                                    ? `<img src="${photo}" alt="${name}" loading="lazy" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\'text-slate-500 font-bold\'>${name.charAt(0)}</span>';">` 
                                    : `<span class="text-slate-500 font-bold">${name.charAt(0)}</span>`}
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center justify-between gap-1 mb-0.5">
                                    <h4 class="font-bold text-white text-sm truncate">${name}</h4>
                                    <span class="text-[10px] font-mono text-slate-500">#${idx + 1}</span>
                                </div>
                                <p class="text-xs font-mono text-slate-400 truncate">${roll}</p>
                                <p class="text-[11px] text-slate-500 truncate">${dept}</p>
                            </div>
                        </div>

                        <!-- Role & Certificate -->
                        <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                            <div>${roleBadge}</div>
                            ${hasCert ? `
                                <button onclick="viewAthleteCert('${player.email}')" class="text-[11px] font-bold text-lime-400 hover:text-lime-300 underline cursor-pointer">
                                    View Certificate
                                </button>
                            ` : `<span class="text-[11px] text-slate-600">No proof doc</span>`}
                        </div>
                    </div>

                    <!-- Acquired Price Footer -->
                    <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between bg-slate-950/60 -mx-5 -mb-5 p-4 rounded-b-3xl">
                        <span class="text-xs text-slate-400 font-semibold">Purchase Price:</span>
                        <span class="font-mono font-black text-lime-400 text-sm">${price.toFixed(1)} Points</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 8. RENDER LIVE AUCTION WATCHER VIEW
    function renderAuctionWatcherView() {
        renderRecentlySoldFeed();
        renderPoolAthletes();
    }

    function renderRecentlySoldFeed() {
        if (!auctionFeedList) return;

        const soldPlayers = allTournamentPlayers.filter(p => p.auction_status === 'Sold' || Boolean(p.sold_to_team));

        if (!soldPlayers.length) {
            auctionFeedList.innerHTML = `
                <div class="p-4 rounded-2xl bg-slate-950 text-center text-xs text-slate-500 border border-slate-800/60">
                    No players sold in the auction yet. Live bidding stream will display deals here!
                </div>
            `;
            return;
        }

        auctionFeedList.innerHTML = soldPlayers.slice(0, 8).map(player => {
            const isOurTeam = currentTeam && (player.sold_to_team === currentTeam.name || player.sold_to_team_id === currentTeam.id);
            const teamBadgeClass = isOurTeam 
                ? 'bg-lime-400/20 text-lime-400 border-lime-400/40 font-black' 
                : 'bg-slate-800 text-slate-300 border-slate-700';

            return `
                <div class="p-3.5 rounded-2xl ${isOurTeam ? 'bg-lime-400/5 border border-lime-400/30' : 'bg-slate-950 border border-slate-800/80'} flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-3 min-w-0">
                        <span class="text-base">${isOurTeam ? '👑' : '🏆'}</span>
                        <div class="min-w-0">
                            <span class="font-bold text-white block truncate">${player.full_name || player.name}</span>
                            <span class="text-[11px] text-slate-400">${player.player_role || 'Athlete'} • ${player.department || '---'}</span>
                        </div>
                    </div>
                    <div class="text-right shrink-0 flex items-center gap-2">
                        <span class="px-2.5 py-1 rounded-xl text-[11px] font-bold border ${teamBadgeClass}">
                            ${player.sold_to_team || 'Franchise'}
                        </span>
                        <span class="font-mono font-black text-white text-xs">${Number(player.sold_price || 0).toFixed(1)} Pts</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderPoolAthletes() {
        if (!poolGrid) return;

        const roleFilter = poolRoleFilter ? poolRoleFilter.value : 'ALL';
        const available = allTournamentPlayers.filter(p => {
            const isUpcoming = p.auction_status !== 'Sold' && !p.sold_to_team;
            const matchesRole = roleFilter === 'ALL' || p.player_role === roleFilter;
            return isUpcoming && matchesRole;
        });

        if (!available.length) {
            poolGrid.innerHTML = `
                <div class="col-span-full py-8 text-center text-xs text-slate-500">
                    No available athletes matching this filter.
                </div>
            `;
            return;
        }

        poolGrid.innerHTML = available.map(player => {
            const name = player.full_name || player.name || 'Athlete';
            const role = player.player_role || 'All-Rounder';
            const basePrice = Number(player.base_price) || (window.UniBoxDb ? window.UniBoxDb.getDefaultBasePriceForRole(role) : 15);

            return `
                <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 space-y-2 hover:border-slate-700 transition-all">
                    <div class="flex items-center justify-between gap-1">
                        <span class="font-bold text-white text-xs truncate">${name}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-900 text-slate-400">${role}</span>
                    </div>
                    <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                        <span>Base Price:</span>
                        <span class="font-mono font-bold text-lime-400">${basePrice.toFixed(1)} Pts</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 9. CERTIFICATE VIEWER MODAL
    window.viewAthleteCert = (email) => {
        const player = currentSquad.find(p => p.email === email);
        if (!player) return;

        const modal = document.getElementById('cert-viewer-modal');
        const title = document.getElementById('cert-modal-title');
        const img = document.getElementById('cert-modal-img');
        const pdf = document.getElementById('cert-modal-pdf');
        const empty = document.getElementById('cert-modal-empty');

        if (title) title.textContent = `${player.full_name || player.name} — Sports Document`;

        const certData = player.certificate_data || localStorage.getItem(`unibox_cert_${player.email}`);

        img.classList.add('hidden');
        pdf.classList.add('hidden');
        empty.classList.add('hidden');

        if (certData) {
            if (certData.startsWith('data:application/pdf') || certData.endsWith('.pdf')) {
                pdf.src = certData;
                pdf.classList.remove('hidden');
            } else {
                img.src = certData;
                img.classList.remove('hidden');
            }
        } else {
            empty.classList.remove('hidden');
        }

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    };

    document.getElementById('close-cert-btn')?.addEventListener('click', () => {
        const modal = document.getElementById('cert-viewer-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        const pdf = document.getElementById('cert-modal-pdf');
        if (pdf) pdf.src = '';
    });

    // 10. REALTIME AUCTION SYNCHRONIZATION
    if (window.UniBoxDb && window.UniBoxDb.subscribeToAuctionUpdates) {
        window.UniBoxDb.subscribeToAuctionUpdates(async (event) => {
            console.log('⚡ Team Owner Dashboard received live auction event:', event);

            if (event.type === 'PLAYER_PURCHASED') {
                const isOurPurchase = currentTeam && (event.teamId === currentTeam.id || event.teamName === currentTeam.name);
                if (isOurPurchase) {
                    showToast(`🎉 Squad Acquisition! Purchased for ${event.soldPrice} Points!`, 'success');
                } else {
                    showToast(`Deal Alert: Player acquired by ${event.teamName} for ${event.soldPrice} Pts`, 'info');
                }
                await loadFranchiseData();
            } else if (event.type === 'PLAYER_PURCHASE_REVOKED') {
                const isOurRefund = currentTeam && (event.refundedTeam === currentTeam.name);
                if (isOurRefund) {
                    showToast(`Purchase revoked. ${event.refundedPrice} Points restored to your purse!`, 'info');
                }
                await loadFranchiseData();
            } else if (event.type === 'TEAM_BUDGET_UPDATED') {
                if (currentTeam && event.teamId === currentTeam.id) {
                    showToast(`Franchise budget updated to ${event.totalBudget} Points`, 'info');
                }
                await loadFranchiseData();
            } else if (event.type === 'PLAYER_REGISTERED' || event.type === 'ROLE_BASE_PRICES_UPDATED' || event.type === 'SUPABASE_REALTIME') {
                await loadFranchiseData();
            }
        });
    }

    // Toast notifications
    let toastTimer = null;
    function showToast(msg, type = 'success') {
        const toast = document.getElementById('owner-toast');
        const icon = document.getElementById('owner-toast-icon');
        const text = document.getElementById('owner-toast-text');
        if (!toast) return;

        if (toastTimer) clearTimeout(toastTimer);

        text.textContent = msg;
        if (type === 'success') {
            toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-lime-400 text-lime-400 text-xs font-bold';
            icon.textContent = '✓';
        } else {
            toast.className = 'fixed bottom-6 right-6 z-50 transform translate-y-0 opacity-100 transition-all duration-300 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl bg-slate-900 border border-sky-400 text-sky-400 text-xs font-bold';
            icon.textContent = 'ℹ';
        }

        toastTimer = setTimeout(() => {
            toast.classList.add('translate-y-20', 'opacity-0');
        }, 3500);
    }

    // Progressive Shell Render: Show skeletons immediately before network returns
    renderSquadSkeletons();

    // Initial progressive load
    loadFranchiseData(true);

    // Smart 1-Second Background Auto-Sync
    let teamRefreshTimer = null;
    function startTeamAutoSync() {
        if (teamRefreshTimer) clearInterval(teamRefreshTimer);
        teamRefreshTimer = setInterval(async () => {
            try {
                await loadFranchiseData(false);
            } catch (e) {}
        }, 1000);
    }

    function stopTeamAutoSync() {
        if (teamRefreshTimer) {
            clearInterval(teamRefreshTimer);
            teamRefreshTimer = null;
        }
    }

    startTeamAutoSync();

    // Pause polling when tab is inactive/hidden to conserve battery and CPU
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopTeamAutoSync();
        } else {
            loadFranchiseData(false);
            startTeamAutoSync();
        }
    });

    window.addEventListener('beforeunload', () => {
        stopTeamAutoSync();
    });
});

