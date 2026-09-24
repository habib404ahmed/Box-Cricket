// ==============================================================================
// UniBox League 2026 - Franchise Owner Dashboard Controller
// ==============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // 1. AUTHENTICATION GUARD
    const sessionRaw = localStorage.getItem('unibox_team_owner_session') || sessionStorage.getItem('unibox_team_owner_session');
    if (!sessionRaw) {
        const p = window.location.pathname || '';
        let target = 'login.html';
        if (p.endsWith('/team')) {
            target = p + '/login.html';
        } else if (p.includes('/team/')) {
            target = p.substring(0, p.indexOf('/team/') + 6) + 'login.html';
        } else {
            target = '/team/login.html';
        }
        window.location.replace(target);
        return;
    }

    let session = null;
    try {
        session = JSON.parse(sessionRaw);
    } catch (e) {
        localStorage.removeItem('unibox_team_owner_session');
        sessionStorage.removeItem('unibox_team_owner_session');
        const p = window.location.pathname || '';
        let target = 'login.html';
        if (p.endsWith('/team')) {
            target = p + '/login.html';
        } else if (p.includes('/team/')) {
            target = p.substring(0, p.indexOf('/team/') + 6) + 'login.html';
        } else {
            target = '/team/login.html';
        }
        window.location.replace(target);
        return;
    }

    if (!session || !session.email) {
        const p = window.location.pathname || '';
        let target = 'login.html';
        if (p.endsWith('/team')) {
            target = p + '/login.html';
        } else if (p.includes('/team/')) {
            target = p.substring(0, p.indexOf('/team/') + 6) + 'login.html';
        } else {
            target = '/team/login.html';
        }
        window.location.replace(target);
        return;
    }

    // State Variables
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

    // 2. LOGOUT HANDLER
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            try {
                localStorage.removeItem('unibox_team_owner_session');
                sessionStorage.removeItem('unibox_team_owner_session');
            } catch (err) {}
            const p = window.location.pathname || '';
            let target = 'login.html';
            if (p.endsWith('/team')) {
                target = p + '/login.html';
            } else if (p.includes('/team/')) {
                target = p.substring(0, p.indexOf('/team/') + 6) + 'login.html';
            } else {
                target = '/team/login.html';
            }
            window.location.href = target;
        });
    }

    // 3. TAB SWITCHING
    function setTab(tab) {
        activeTab = tab;
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
            await loadFranchiseData();
            setTimeout(() => refreshIcon?.classList.remove('animate-spin'), 400);
            showToast('Franchise data refreshed!', 'info');
        });
    }

    // 4. LOAD FRANCHISE DATA & SQUAD
    async function loadFranchiseData() {
        if (!window.UniBoxDb) return;

        try {
            // Fetch all teams with computed leftover budgets
            const { data: teams } = await window.UniBoxDb.getAllTeams();
            const email = session.email.toLowerCase();

            // Find this owner's team
            let team = teams.find(t => t.owner_email && t.owner_email.toLowerCase() === email);

            // Fallback match by teamId or teamName if owner_email not matched yet
            if (!team && session.teamId) {
                team = teams.find(t => t.id === session.teamId);
            }
            if (!team && session.teamName) {
                team = teams.find(t => t.name.toLowerCase() === session.teamName.toLowerCase());
            }

            if (!team) {
                console.warn('Franchise not found for owner session:', session);
                return;
            }

            currentTeam = team;
            currentSquad = team.squad || [];

            // Also fetch all tournament players for the live auction watcher
            const { data: allPlayers } = await window.UniBoxDb.getAllPlayers();
            allTournamentPlayers = allPlayers || [];

            // Render components
            renderHeader();
            renderHUD();
            renderSquadGrid();
            if (activeTab === 'auction') {
                renderAuctionWatcherView();
            }
        } catch (err) {
            console.error('Failed to load franchise data:', err);
        }
    }

    // 5. RENDER HEADER
    function renderHeader() {
        if (!currentTeam) return;

        if (headerLogo) headerLogo.textContent = currentTeam.logo || '🏏';
        if (headerName) headerName.textContent = currentTeam.name;
        if (headerDept) headerDept.textContent = currentTeam.department;
        if (headerOwner) headerOwner.textContent = currentTeam.owner_name || session.ownerName || 'Franchise Owner';

        // Update ambient glow color if custom color specified
        if (ambientGlow && currentTeam.color) {
            ambientGlow.style.backgroundColor = `${currentTeam.color}15`;
        }
    }

    // 6. RENDER LIVE PURSE HUD & STATS
    function renderHUD() {
        if (!currentTeam) return;

        const leftover = Number(currentTeam.leftover_balance) || 0;
        const total = Number(currentTeam.total_budget) || 100;
        const spent = Number(currentTeam.spent) || 0;
        const squadCount = currentSquad.length;

        if (hudLeftover) hudLeftover.textContent = `${leftover.toFixed(1)} Pts`;
        if (hudSpent) hudSpent.textContent = `${spent.toFixed(1)} Pts`;
        if (hudTotal) hudTotal.textContent = `${total.toFixed(1)} Pts`;
        if (hudSquadCount) hudSquadCount.textContent = squadCount;
        if (tabSquadBadge) tabSquadBadge.textContent = squadCount;

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
            const photo = player.photo_data || null;
            const certName = player.certificate_name || player.certificate || '';
            const certData = player.certificate_data || null;
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
                                    ? `<img src="${photo}" alt="${name}" class="w-full h-full object-cover">` 
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

    // Initial load
    await loadFranchiseData();
});
