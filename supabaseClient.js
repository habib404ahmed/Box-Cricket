// ==============================================================================
// UniBox League 2026 - Supabase Client Connector & Database Operations
// ==============================================================================

// 1. CONFIGURATION
// Replace the values below with your project credentials from:
// Supabase Dashboard -> Project Settings -> API
const SUPABASE_URL = 'https://mhlhzfzxvlshmbcwtvkt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HVAXt2IGvOtqZhruw2qY1g_Ttzirbuk';

// Clean base URL (strips any trailing /rest/v1 or slashes if accidentally present)
const cleanUrl = (SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

// Check if actual credentials have been provided
const isConfigured = () => {
    return cleanUrl && 
           cleanUrl !== 'YOUR_SUPABASE_PROJECT_URL' &&
           SUPABASE_ANON_KEY && 
           SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
};

// 2. INITIALIZE CLIENT
let supabaseClient = null;
try {
    if (isConfigured() && window.supabase) {
        supabaseClient = window.supabase.createClient(cleanUrl, SUPABASE_ANON_KEY);
        console.log('⚡ Connected to Supabase Project:', cleanUrl);
    } else {
        console.info('ℹ️ Supabase credentials not yet configured in supabaseClient.js. Running in local session mode.');
    }
} catch (err) {
    console.warn('Supabase initialization error:', err);
}

// 3. DEFAULT ROLE BASE PRICES (In Points)
// Batsman: 20 Points, Bowler: 5 Points, All-Rounder: 15 Points, etc.
const DEFAULT_ROLE_BASE_PRICES = {
    'Batter': 20,
    'Batsman': 20,
    'Bowler': 5,
    'All-Rounder': 15,
    'Wicketkeeper': 10,
    'Fielder': 5
};

// 4. DEFAULT TOURNAMENT TEAMS (Purse: 1000 Points each)
const DEFAULT_TEAMS = [
    { id: 'team-btech', name: 'B.Tech Titans', department: 'B.Tech', logo: '⚡', color: '#38bdf8', total_budget: 1000 },
    { id: 'team-bca', name: 'BCA Blasters', department: 'BCA', logo: '🏏', color: '#a3e635', total_budget: 1000 },
    { id: 'team-bba', name: 'BBA Bulls', department: 'BBA', logo: '🐂', color: '#fbbf24', total_budget: 1000 },
    { id: 'team-mca', name: 'MCA Mavericks', department: 'MCA', logo: '🦅', color: '#34d399', total_budget: 1000 },
    { id: 'team-mba', name: 'MBA Monarchs', department: 'MBA', logo: '👑', color: '#c084fc', total_budget: 1000 }
];

// BroadcastChannel for instant multi-tab zero-latency realtime synchronization
const auctionChannel = (typeof window !== 'undefined' && typeof window.BroadcastChannel !== 'undefined')
    ? new BroadcastChannel('unibox_auction_sync')
    : null;

// 5. DATABASE & AUCTION HELPER METHODS
const UniBoxDb = {
    isReady: () => isConfigured() && supabaseClient !== null,
    supabaseClient,

    // Cryptographic Password Hashing (Salted SHA-256 via native Web Crypto API)
    hashPassword: async (password) => {
        if (!password) return '';
        try {
            const salt = 'unibox_league_2026_salt_';
            const encoder = new TextEncoder();
            const data = encoder.encode(salt + password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (err) {
            console.error('Hashing failed:', err);
            return password;
        }
    },

    // --- AUCTION SETTINGS & ROLE BASE PRICES ---
    getRoleBasePrices: () => {
        try {
            const stored = localStorage.getItem('unibox_role_base_prices');
            if (stored) return { ...DEFAULT_ROLE_BASE_PRICES, ...JSON.parse(stored) };
        } catch (e) {}
        return { ...DEFAULT_ROLE_BASE_PRICES };
    },

    saveRoleBasePrices: (prices) => {
        const merged = { ...DEFAULT_ROLE_BASE_PRICES, ...prices };
        localStorage.setItem('unibox_role_base_prices', JSON.stringify(merged));
        UniBoxDb.broadcastAuctionEvent({ type: 'ROLE_BASE_PRICES_UPDATED', prices: merged });
        return merged;
    },

    getDefaultBasePriceForRole: (role, customPrices = null) => {
        const prices = customPrices || UniBoxDb.getRoleBasePrices();
        if (!role) return Number(prices['All-Rounder'] || 15);
        const normalized = String(role).trim();
        
        // 1. Direct case-insensitive key match
        for (const [key, val] of Object.entries(prices)) {
            if (key.toLowerCase() === normalized.toLowerCase()) {
                return Number(val);
            }
        }
        
        // 2. Keyword matching
        const lower = normalized.toLowerCase();
        if (lower.includes('bat')) return Number(prices['Batter'] || prices['Batsman'] || 20);
        if (lower.includes('bowl')) return Number(prices['Bowler'] || 5);
        if (lower.includes('keeper') || lower.includes('wk')) return Number(prices['Wicketkeeper'] || 10);
        if (lower.includes('field')) return Number(prices['Fielder'] || 5);
        if (lower.includes('round')) return Number(prices['All-Rounder'] || 15);
        return Number(prices['Fielder'] || 5);
    },

    // Update individual player's base price
    updatePlayerBasePrice: async (playerIdOrEmail, basePrice) => {
        const numPrice = Math.max(0, Number(basePrice) || 0);

        // Update local cache
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        if (!auctionCache[playerIdOrEmail]) auctionCache[playerIdOrEmail] = {};
        auctionCache[playerIdOrEmail].base_price = numPrice;
        localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));

        // Update local players list if stored
        const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        const idx = localPlayers.findIndex(p => p.id === playerIdOrEmail || p.email === playerIdOrEmail);
        if (idx >= 0) {
            localPlayers[idx].base_price = numPrice;
            localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
        }

        // Update Supabase if available
        if (UniBoxDb.isReady()) {
            try {
                const query = typeof playerIdOrEmail === 'string' && playerIdOrEmail.includes('@')
                    ? supabaseClient.from('players').update({ base_price: numPrice }).eq('email', playerIdOrEmail)
                    : supabaseClient.from('players').update({ base_price: numPrice }).eq('id', playerIdOrEmail);
                const { error } = await query;
                if (error && error.code !== '42703') console.warn('Supabase base_price update warning:', error);
            } catch (err) {
                console.warn('Supabase base_price update skipped:', err);
            }
        }

        UniBoxDb.broadcastAuctionEvent({
            type: 'PLAYER_BASE_PRICE_UPDATED',
            playerId: playerIdOrEmail,
            basePrice: numPrice
        });

        return { success: true, base_price: numPrice };
    },

    // --- TEAMS & LIVE BUDGET PURSE MANAGEMENT ---
    getAllTeams: async (providedPlayers = null) => {
        let teams = [];
        try {
            const storedTeams = localStorage.getItem('unibox_teams');
            if (storedTeams) {
                teams = JSON.parse(storedTeams);
                // Migrate existing cached teams from previous default of 100 to 1000
                if (Array.isArray(teams)) {
                    let updated = false;
                    teams.forEach(t => {
                        if (t.total_budget === 100) {
                            t.total_budget = 1000;
                            updated = true;
                        }
                    });
                    if (updated) {
                        localStorage.setItem('unibox_teams', JSON.stringify(teams));
                    }
                }
            }
        } catch (e) {}

        const deletedIds = JSON.parse(localStorage.getItem('unibox_deleted_teams') || '[]');
        if (!teams || teams.length === 0) {
            teams = DEFAULT_TEAMS.filter(t => !deletedIds.includes(t.id)).map(t => ({ ...t }));
            localStorage.setItem('unibox_teams', JSON.stringify(teams));
        } else if (deletedIds.length > 0) {
            teams = teams.filter(t => !deletedIds.includes(t.id));
        }

        // Attempt Supabase fetch if available
        if (UniBoxDb.isReady()) {
            try {
                const fetchPromise = supabaseClient.from('teams').select('*').order('name');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Teams fetch timed out')), 5000)
                );
                const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
                if (!error && Array.isArray(data) && data.length > 0) {
                    const localTeams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
                    const registry = JSON.parse(localStorage.getItem('unibox_team_owners_registry') || '{}');
                    const session = UniBoxDb.getTeamOwnerSession();

                    teams = data
                        .filter(t => !deletedIds.includes(t.id))
                        .map(t => {
                        const localMatch = localTeams.find(lt => lt.id === t.id || (lt.name && lt.name.toLowerCase() === t.name.toLowerCase()));
                        const regMatch = registry[t.id] || registry[t.name.toLowerCase()] || (session && (session.teamId === t.id || session.teamName?.toLowerCase() === t.name.toLowerCase()) ? registry[session.email] : null);

                        const rawBudget = Number(t.total_budget);
                        const budgetVal = (rawBudget === 100 || !rawBudget) ? 1000 : rawBudget;

                        return {
                            id: t.id,
                            name: t.name,
                            department: t.department,
                            logo: t.logo || '🏏',
                            color: t.color || '#a3e635',
                            total_budget: budgetVal,
                            owner_name: t.owner_name || localMatch?.owner_name || regMatch?.owner_name || (session && session.teamId === t.id ? session.ownerName : null),
                            owner_email: t.owner_email || localMatch?.owner_email || regMatch?.owner_email || (session && session.teamId === t.id ? session.email : null),
                            owner_phone: t.owner_phone || localMatch?.owner_phone || regMatch?.owner_phone || null,
                            password_hash: t.password_hash || localMatch?.password_hash || regMatch?.password_hash || null,
                            status: t.status || localMatch?.status || 'Active'
                        };
                    });

                    // Preserve any local custom teams not yet in Supabase
                    localTeams.forEach(lt => {
                        if (!teams.some(t => t.id === lt.id) && !deletedIds.includes(lt.id)) {
                            teams.push(lt);
                        }
                    });

                    // Ensure default league franchises are present unless explicitly deleted
                    DEFAULT_TEAMS.forEach(dt => {
                        if (!teams.some(t => t.id === dt.id || (t.name && t.name.toLowerCase() === dt.name.toLowerCase())) && !deletedIds.includes(dt.id)) {
                            teams.push({ ...dt, spent: 0, leftover_balance: dt.total_budget, squad: [] });
                        }
                    });

                    localStorage.setItem('unibox_teams', JSON.stringify(teams));
                }
            } catch (err) {}
        }

        // Fetch players to calculate spent & leftover balance for each team
        let players = providedPlayers;
        if (!players || !Array.isArray(players) || players.length === 0) {
            if (typeof allPlayers !== 'undefined' && Array.isArray(allPlayers) && allPlayers.length > 0) {
                players = allPlayers;
            } else {
                const { data } = await UniBoxDb.getAllPlayers();
                players = data;
            }
        }

        const enrichedTeams = teams.map(team => {
            const teamName = (team.name || '').trim().toLowerCase();
            const teamId = (team.id || '').trim().toLowerCase();

            const teamSquad = (players || []).filter(p => {
                const soldTeam = (p.sold_to_team || '').trim().toLowerCase();
                const soldTeamId = (p.sold_to_team_id || '').trim().toLowerCase();
                return (soldTeam && (soldTeam === teamName || soldTeam === teamId)) ||
                       (soldTeamId && (soldTeamId === teamId || soldTeamId === teamName));
            });

            const spent = teamSquad.reduce((sum, p) => sum + (Number(p.sold_price) || 0), 0);
            const rawBudget = Number(team.total_budget);
            const totalBudget = (rawBudget === 100 || !rawBudget) ? 1000 : rawBudget;
            const leftover = Math.max(0, totalBudget - spent);

            return {
                ...team,
                total_budget: totalBudget,
                spent: spent,
                leftover_balance: leftover,
                squad: teamSquad,
                squad_count: teamSquad.length
            };
        });

        return { data: enrichedTeams, error: null };
    },

    updateTeamBudget: async (teamId, newBudget) => {
        const budgetNum = Math.max(0, Number(newBudget) || 1000);
        let teams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
        const idx = teams.findIndex(t => t.id === teamId);
        if (idx >= 0) {
            teams[idx].total_budget = budgetNum;
            localStorage.setItem('unibox_teams', JSON.stringify(teams));
        }

        if (UniBoxDb.isReady()) {
            try {
                await supabaseClient.from('teams').update({ total_budget: budgetNum }).eq('id', teamId);
            } catch (e) {}
        }

        UniBoxDb.broadcastAuctionEvent({ type: 'TEAM_BUDGET_UPDATED', teamId, totalBudget: budgetNum });
        return { success: true, total_budget: budgetNum };
    },

    // Delete a specific team / franchise permanently
    deleteTeam: async (teamId) => {
        if (!teamId) return { success: false, error: 'Team ID is required.' };

        // 1. Remove from local unibox_teams
        let teams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
        const targetTeam = teams.find(t => t.id === teamId);
        const teamName = targetTeam ? targetTeam.name : null;
        teams = teams.filter(t => t.id !== teamId);
        localStorage.setItem('unibox_teams', JSON.stringify(teams));

        // Track in deleted IDs list so DEFAULT_TEAMS doesn't re-seed it
        const deletedIds = JSON.parse(localStorage.getItem('unibox_deleted_teams') || '[]');
        if (!deletedIds.includes(teamId)) {
            deletedIds.push(teamId);
            localStorage.setItem('unibox_deleted_teams', JSON.stringify(deletedIds));
        }

        // 2. Remove from team owners registry
        const registry = JSON.parse(localStorage.getItem('unibox_team_owners_registry') || '{}');
        delete registry[teamId];
        if (teamName) {
            delete registry[teamName.toLowerCase()];
        }
        localStorage.setItem('unibox_team_owners_registry', JSON.stringify(registry));

        // 3. Release any players assigned to this team
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        Object.keys(auctionCache).forEach(k => {
            if (auctionCache[k].sold_to_team_id === teamId || (teamName && auctionCache[k].sold_to_team === teamName)) {
                delete auctionCache[k].sold_to_team;
                delete auctionCache[k].sold_to_team_id;
                delete auctionCache[k].sold_price;
                auctionCache[k].auction_status = 'Upcoming';
            }
        });
        localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));

        let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        localPlayers.forEach(p => {
            if (p.sold_to_team_id === teamId || (teamName && p.sold_to_team === teamName)) {
                delete p.sold_to_team;
                delete p.sold_to_team_id;
                delete p.sold_price;
                p.auction_status = 'Upcoming';
            }
        });
        localStorage.setItem('unibox_players', JSON.stringify(localPlayers));

        // 4. Delete from Supabase if connected
        if (UniBoxDb.isReady()) {
            try {
                // Delete the team record
                const { error: delError } = await supabaseClient.from('teams').delete().eq('id', teamId);
                if (delError) console.warn('Supabase delete team warning:', delError);

                // Release squad players from this team
                if (teamName) {
                    await supabaseClient.from('players')
                        .update({ sold_to_team: null, sold_price: 0, auction_status: 'Upcoming' })
                        .eq('sold_to_team', teamName);
                }
            } catch (err) {
                console.error('Supabase team delete error:', err);
            }
        }

        // 5. Broadcast auction event across tabs/windows
        UniBoxDb.broadcastAuctionEvent({ type: 'TEAM_DELETED', teamId });
        return { success: true, teamId };
    },

    // --- FRANCHISE TEAM OWNER AUTHENTICATION & PORTAL METHODS ---
    registerTeamOwner: async (ownerData) => {
        const { ownerName, email, password, phone, teamMode, existingTeamId, customTeamName, department, logo, color } = ownerData;

        if (!ownerName || !email || !password) {
            return { success: false, error: 'Owner name, email, and password are required.' };
        }

        const normalizedEmail = email.trim().toLowerCase();
        const passwordHash = await UniBoxDb.hashPassword(password);

        // Fetch current teams
        let currentTeams = JSON.parse(localStorage.getItem('unibox_teams') || '[]');
        if (!currentTeams.length) {
            currentTeams = DEFAULT_TEAMS.map(t => ({ ...t }));
        }

        // Check if an owner with this email already exists
        const emailExists = currentTeams.some(t => t.owner_email && t.owner_email.toLowerCase() === normalizedEmail);
        if (emailExists) {
            return { success: false, error: 'A franchise owner is already registered with this email address.' };
        }

        let targetTeam = null;

        if (teamMode === 'claim') {
            const teamIdx = currentTeams.findIndex(t => t.id === existingTeamId);
            if (teamIdx === -1) {
                return { success: false, error: 'Selected franchise was not found.' };
            }
            if (currentTeams[teamIdx].owner_email) {
                return { success: false, error: `The ${currentTeams[teamIdx].name} franchise has already been claimed by another owner.` };
            }

            currentTeams[teamIdx] = {
                ...currentTeams[teamIdx],
                owner_name: ownerName.trim(),
                owner_email: normalizedEmail,
                owner_phone: phone ? phone.trim() : null,
                password_hash: passwordHash,
                status: 'Active'
            };
            targetTeam = currentTeams[teamIdx];
        } else {
            // Custom franchise
            if (!customTeamName || !department) {
                return { success: false, error: 'Team name and department are required for custom franchise registration.' };
            }

            const nameExists = currentTeams.some(t => t.name.toLowerCase() === customTeamName.trim().toLowerCase());
            if (nameExists) {
                return { success: false, error: 'A franchise with this name already exists in the tournament.' };
            }

            const slug = customTeamName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');
            const customId = `team-${slug}-${Date.now().toString().slice(-4)}`;

            const initialBudget = Number(ownerData.budget) || 1000;
            targetTeam = {
                id: customId,
                name: customTeamName.trim(),
                department: department.trim(),
                logo: logo || '🏆',
                color: color || '#a3e635',
                total_budget: initialBudget,
                spent: 0,
                leftover_balance: initialBudget,
                squad: [],
                owner_name: ownerName.trim(),
                owner_email: normalizedEmail,
                owner_phone: phone ? phone.trim() : null,
                password_hash: passwordHash,
                status: 'Active',
                created_at: new Date().toISOString()
            };
            currentTeams.push(targetTeam);
        }

        localStorage.setItem('unibox_teams', JSON.stringify(currentTeams));

        // Sync to Supabase if ready
        if (UniBoxDb.isReady()) {
            try {
                const teamPayload = {
                    id: targetTeam.id,
                    name: targetTeam.name,
                    department: targetTeam.department,
                    logo: targetTeam.logo,
                    color: targetTeam.color,
                    total_budget: targetTeam.total_budget,
                    owner_name: targetTeam.owner_name,
                    owner_email: targetTeam.owner_email,
                    owner_phone: targetTeam.owner_phone,
                    password_hash: targetTeam.password_hash,
                    status: targetTeam.status
                };

                let { error: sbError } = await supabaseClient.from('teams').upsert([teamPayload], { onConflict: 'id' });
                if (sbError && (sbError.code === 'PGRST204' || sbError.message?.includes('schema cache') || sbError.code === '42703')) {
                    const basicPayload = {
                        id: targetTeam.id,
                        name: targetTeam.name,
                        department: targetTeam.department,
                        logo: targetTeam.logo,
                        color: targetTeam.color,
                        total_budget: targetTeam.total_budget
                    };
                    await supabaseClient.from('teams').upsert([basicPayload], { onConflict: 'id' });
                }
            } catch (err) {
                console.warn('Supabase team upsert fallback to local storage:', err);
            }
        }

        // Persist to team owners registry for resilient cross-tab and offline recovery
        try {
            const registry = JSON.parse(localStorage.getItem('unibox_team_owners_registry') || '{}');
            const regData = {
                owner_name: targetTeam.owner_name,
                owner_email: normalizedEmail,
                owner_phone: targetTeam.owner_phone,
                password_hash: passwordHash,
                team_id: targetTeam.id,
                team_name: targetTeam.name
            };
            registry[targetTeam.id] = regData;
            registry[targetTeam.name.toLowerCase()] = regData;
            registry[normalizedEmail] = regData;
            localStorage.setItem('unibox_team_owners_registry', JSON.stringify(registry));
        } catch (e) {}

        // Set session
        const sessionData = {
            email: normalizedEmail,
            ownerName: targetTeam.owner_name,
            teamId: targetTeam.id,
            teamName: targetTeam.name,
            timestamp: Date.now()
        };
        localStorage.setItem('unibox_team_owner_session', JSON.stringify(sessionData));

        // Broadcast registration event
        UniBoxDb.broadcastAuctionEvent({
            type: 'TEAM_OWNER_REGISTERED',
            team: targetTeam,
            ownerEmail: normalizedEmail
        });

        return { success: true, team: targetTeam, error: null };
    },

    loginTeamOwner: async (email, password) => {
        if (!email || !password) {
            return { success: false, error: 'Email and password are required.' };
        }

        const normalizedEmail = email.trim().toLowerCase();
        const inputHash = await UniBoxDb.hashPassword(password);

        // Fetch all teams
        const { data: teams } = await UniBoxDb.getAllTeams();
        const registry = JSON.parse(localStorage.getItem('unibox_team_owners_registry') || '{}');
        const regEntry = registry[normalizedEmail];

        let team = teams.find(t => t.owner_email && t.owner_email.toLowerCase() === normalizedEmail);
        if (!team && regEntry) {
            team = teams.find(t => t.id === regEntry.team_id || t.name.toLowerCase() === (regEntry.team_name || '').toLowerCase());
            if (team) {
                team.owner_name = team.owner_name || regEntry.owner_name;
                team.owner_email = team.owner_email || regEntry.owner_email;
                team.password_hash = team.password_hash || regEntry.password_hash;
            }
        }

        if (!team) {
            return { success: false, error: 'No franchise owner found with this email. Please register first.' };
        }

        if (team.password_hash && team.password_hash !== inputHash) {
            return { success: false, error: 'Incorrect password. Please verify your credentials.' };
        }

        // Set session
        const sessionData = {
            email: normalizedEmail,
            ownerName: team.owner_name || regEntry?.owner_name || 'Franchise Owner',
            teamId: team.id,
            teamName: team.name,
            timestamp: Date.now()
        };
        localStorage.setItem('unibox_team_owner_session', JSON.stringify(sessionData));

        return { success: true, team, error: null };
    },

    getTeamOwnerSession: () => {
        try {
            const raw = localStorage.getItem('unibox_team_owner_session');
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    },

    logoutTeamOwner: () => {
        localStorage.removeItem('unibox_team_owner_session');
    },

    getTeamByOwnerEmail: async (email) => {
        if (!email) return { data: null, error: 'Email is required' };
        const { data: teams } = await UniBoxDb.getAllTeams();
        const team = teams.find(t => t.owner_email && t.owner_email.toLowerCase() === email.trim().toLowerCase());
        return { data: team || null, error: team ? null : 'Franchise not found' };
    },

    // --- PURCHASE ATHLETE WITH REALTIME LEFTOVER BALANCE DEDUCTION ---
    purchasePlayer: async (params) => {
        const playerIdOrEmail = params.playerIdOrEmail || params.playerId;
        const teamId = params.teamId;
        const soldPrice = params.soldPrice;
        const numPrice = Number(soldPrice);
        if (isNaN(numPrice) || numPrice <= 0) {
            throw new Error('Please enter a valid purchase price.');
        }

        // Fetch current teams to check leftover balance
        const { data: teams } = await UniBoxDb.getAllTeams();
        const targetTeam = teams.find(t => t.id === teamId || t.name === teamId);
        if (!targetTeam) {
            throw new Error('Selected team was not found.');
        }

        if (numPrice > targetTeam.leftover_balance) {
            throw new Error(`Insufficient budget! ${targetTeam.name} has only ${targetTeam.leftover_balance} Points remaining, but purchase price is ${numPrice} Points.`);
        }

        // Update local auction cache
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        if (!auctionCache[playerIdOrEmail]) auctionCache[playerIdOrEmail] = {};
        auctionCache[playerIdOrEmail].sold_price = numPrice;
        auctionCache[playerIdOrEmail].sold_to_team = targetTeam.name;
        auctionCache[playerIdOrEmail].sold_to_team_id = targetTeam.id;
        auctionCache[playerIdOrEmail].auction_status = 'Sold';
        localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));

        // Also update local unibox_players
        const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        const pIdx = localPlayers.findIndex(p => p.id === playerIdOrEmail || p.email === playerIdOrEmail);
        if (pIdx >= 0) {
            localPlayers[pIdx].sold_price = numPrice;
            localPlayers[pIdx].sold_to_team = targetTeam.name;
            localPlayers[pIdx].sold_to_team_id = targetTeam.id;
            localPlayers[pIdx].auction_status = 'Sold';
            localPlayers[pIdx].status = 'Approved';
            localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
        }

        // Update in Supabase
        if (UniBoxDb.isReady()) {
            try {
                const targetField = typeof playerIdOrEmail === 'string' && playerIdOrEmail.includes('@') ? 'email' : 'id';
                const { error: updateErr } = await supabaseClient.from('players').update({
                    sold_price: numPrice,
                    sold_to_team: targetTeam.name,
                    auction_status: 'Sold',
                    status: 'Approved'
                }).eq(targetField, playerIdOrEmail);

                if (updateErr) {
                    // Fallback to update status if auction columns are not yet added in Supabase
                    await supabaseClient.from('players').update({ status: 'Approved' }).eq(targetField, playerIdOrEmail);
                }
            } catch (err) {
                console.warn('Supabase player purchase update skipped (cached locally):', err);
            }
        }

        // Instant Realtime Broadcast to all open tabs and windows
        const updatedSpent = (Number(targetTeam.spent) || 0) + numPrice;
        const updatedBalance = Math.max(0, targetTeam.leftover_balance - numPrice);
        UniBoxDb.broadcastAuctionEvent({
            type: 'PLAYER_PURCHASED',
            playerId: playerIdOrEmail,
            teamId: targetTeam.id,
            teamName: targetTeam.name,
            soldPrice: numPrice,
            newLeftoverBalance: updatedBalance
        });

        return {
            success: true,
            team: { ...targetTeam, spent: updatedSpent, leftover_balance: updatedBalance },
            player: { id: playerIdOrEmail, sold_to_team: targetTeam.name, sold_price: numPrice, auction_status: 'Sold' }
        };
    },

    // --- REVOKE / REFUND ATHLETE PURCHASE ---
    revokePlayerPurchase: async (playerIdOrEmail) => {
        // Update local auction cache
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        let refundedTeam = null;
        let refundedPrice = 0;
        if (auctionCache[playerIdOrEmail]) {
            refundedTeam = auctionCache[playerIdOrEmail].sold_to_team;
            refundedPrice = Number(auctionCache[playerIdOrEmail].sold_price) || 0;
            delete auctionCache[playerIdOrEmail].sold_price;
            delete auctionCache[playerIdOrEmail].sold_to_team;
            delete auctionCache[playerIdOrEmail].sold_to_team_id;
            auctionCache[playerIdOrEmail].auction_status = 'Upcoming';
        }
        localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));

        // Update local unibox_players
        const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        const pIdx = localPlayers.findIndex(p => p.id === playerIdOrEmail || p.email === playerIdOrEmail);
        if (pIdx >= 0) {
            refundedTeam = refundedTeam || localPlayers[pIdx].sold_to_team;
            refundedPrice = refundedPrice || (Number(localPlayers[pIdx].sold_price) || 0);
            delete localPlayers[pIdx].sold_price;
            delete localPlayers[pIdx].sold_to_team;
            delete localPlayers[pIdx].sold_to_team_id;
            localPlayers[pIdx].auction_status = 'Upcoming';
            localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
        }

        // Supabase update
        if (UniBoxDb.isReady()) {
            try {
                const query = typeof playerIdOrEmail === 'string' && playerIdOrEmail.includes('@')
                    ? supabaseClient.from('players').update({
                        sold_price: null,
                        sold_to_team: null,
                        auction_status: 'Upcoming'
                    }).eq('email', playerIdOrEmail)
                    : supabaseClient.from('players').update({
                        sold_price: null,
                        sold_to_team: null,
                        auction_status: 'Upcoming'
                    }).eq('id', playerIdOrEmail);
                await query;
            } catch (err) {}
        }

        // Broadcast refund event
        UniBoxDb.broadcastAuctionEvent({
            type: 'PLAYER_PURCHASE_REVOKED',
            playerId: playerIdOrEmail,
            refundedTeam,
            refundedPrice
        });

        return { success: true, refundedTeam, refundedPrice };
    },

    // Realtime Event Broadcaster
    broadcastAuctionEvent: (eventData) => {
        const payload = { ...eventData, timestamp: Date.now() };
        if (auctionChannel) {
            try { auctionChannel.postMessage(payload); } catch (e) {}
        }
        if (typeof window !== 'undefined') {
            if (typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
                try {
                    window.dispatchEvent(new CustomEvent('unibox_auction_update', { detail: payload }));
                } catch (e) {}
            }
            try {
                localStorage.setItem('unibox_last_auction_sync', JSON.stringify(payload));
            } catch (e) {}
        }
    },

    // Realtime Subscriber
    subscribeToAuctionUpdates: (callback) => {
        if (typeof window === 'undefined') return () => {};

        const handleMessage = (data) => {
            if (typeof callback === 'function') callback(data);
        };

        if (auctionChannel) {
            auctionChannel.onmessage = (e) => handleMessage(e.data);
        }

        const windowListener = (e) => handleMessage(e.detail);
        window.addEventListener('unibox_auction_update', windowListener);

        const storageListener = (e) => {
            if (e.key === 'unibox_last_auction_sync' && e.newValue) {
                try { handleMessage(JSON.parse(e.newValue)); } catch (err) {}
            }
        };
        window.addEventListener('storage', storageListener);

        // Supabase Realtime channel subscription if available
        let sbSub = null;
        if (UniBoxDb.isReady() && supabaseClient) {
            try {
                sbSub = supabaseClient
                    .channel('public:players_realtime')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, (payload) => {
                        handleMessage({ type: 'SUPABASE_REALTIME', payload });
                    })
                    .subscribe();
            } catch (err) {}
        }

        return () => {
            window.removeEventListener('unibox_auction_update', windowListener);
            window.removeEventListener('storage', storageListener);
            if (sbSub && supabaseClient) supabaseClient.removeChannel(sbSub);
        };
    },

    // --- ATHLETE REGISTRATION & PROFILE METHODS ---
    savePlayer: async (playerData) => {
        const roleBasePrice = UniBoxDb.getDefaultBasePriceForRole(playerData.player_role);
        const resolvedBasePrice = playerData.base_price !== undefined ? Number(playerData.base_price) : roleBasePrice;

        // 1. Immediately cache auction metadata (base_price, auction_status) locally
        try {
            const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
            const cacheEntry = {
                base_price: resolvedBasePrice,
                auction_status: playerData.auction_status || 'Upcoming'
            };
            if (playerData.email) {
                auctionCache[playerData.email] = { ...(auctionCache[playerData.email] || {}), ...cacheEntry };
            }
            if (playerData.enrollment_no) {
                auctionCache[playerData.enrollment_no] = { ...(auctionCache[playerData.enrollment_no] || {}), ...cacheEntry };
            }
            localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));
        } catch (e) {
            console.warn('Failed to cache auction metadata locally:', e);
        }

        // 2. Prepare comprehensive local player record
        const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        const existingIdx = localPlayers.findIndex(p => p.email === playerData.email || p.enrollment_no === playerData.enrollment_no);
        const record = {
            ...playerData,
            base_price: resolvedBasePrice,
            auction_status: playerData.auction_status || 'Upcoming',
            status: playerData.status || 'Registered'
        };
        if (existingIdx >= 0) {
            localPlayers[existingIdx] = { ...localPlayers[existingIdx], ...record };
        } else {
            localPlayers.push({ ...record, id: 'local_' + Date.now(), created_at: new Date().toISOString() });
        }
        localStorage.setItem('unibox_players', JSON.stringify(localPlayers));

        if (!UniBoxDb.isReady()) {
            UniBoxDb.broadcastAuctionEvent({ type: 'PLAYER_REGISTERED', player: record });
            return { data: record, error: null, source: 'localStorage' };
        }

        try {
            const payload = {
                full_name: playerData.name,
                enrollment_no: playerData.enrollment_no,
                department: playerData.department,
                email: playerData.email,
                gender: playerData.gender,
                player_role: playerData.player_role,
                certificate_name: playerData.certificate_name || playerData.certificate || null,
                certificate_data: playerData.certificate_data || null,
                photo_data: playerData.photo_data || null,
                password_hash: playerData.password_hash || null,
                base_price: resolvedBasePrice,
                auction_status: 'Upcoming',
                status: 'Registered'
            };

            let data = null;
            let error = null;
            let attempts = 0;
            const maxAttempts = 6;

            while (attempts < maxAttempts) {
                attempts++;
                const res = await supabaseClient
                    .from('players')
                    .upsert([payload], { onConflict: 'email' })
                    .select();
                data = res.data;
                error = res.error;

                if (!error) {
                    break; // Successfully inserted/updated
                }

                // If duplicate registration (unique constraint violation), stop and return error
                if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('violates unique constraint')) {
                    return { data: null, error, source: 'supabase' };
                }

                // Check for missing column / schema cache errors
                const msg = (error.message || '').toLowerCase();
                const isSchemaError = error.code === '42703' ||
                    error.code === 'PGRST204' ||
                    error.code === 'PGRST100' ||
                    msg.includes('schema cache') ||
                    msg.includes('could not find the') ||
                    msg.includes('column') ||
                    msg.includes('does not exist');

                if (isSchemaError) {
                    // Extract offending column name from error message if possible
                    const match = error.message?.match(/Could not find the '([^']+)' column/i) ||
                                  error.message?.match(/column ["']?([^"'\s]+)["']? does not exist/i);
                    if (match && match[1] && payload.hasOwnProperty(match[1])) {
                        delete payload[match[1]];
                        continue;
                    }

                    // Fallback to removing optional columns in order of likelihood
                    if (payload.auction_status !== undefined) {
                        delete payload.auction_status;
                        continue;
                    }
                    if (payload.base_price !== undefined) {
                        delete payload.base_price;
                        continue;
                    }
                    if (payload.certificate_data !== undefined) {
                        delete payload.certificate_data;
                        continue;
                    }
                    if (payload.password_hash !== undefined) {
                        delete payload.password_hash;
                        continue;
                    }
                    if (payload.photo_data !== undefined) {
                        delete payload.photo_data;
                        continue;
                    }
                }

                // Unrecognized error that cannot be resolved by stripping columns
                break;
            }

            if (error) {
                console.warn('Supabase upsert failed, continuing with local storage fallback:', error);
                // Unique constraint error should still be reported
                if (error.code === '23505' || error.message?.includes('duplicate key')) {
                    return { data: null, error, source: 'supabase' };
                }
                return { data: record, error: null, source: 'localStorageFallback' };
            }

            const finalRecord = { ...record, ...(data?.[0] || {}) };
            UniBoxDb.broadcastAuctionEvent({ type: 'PLAYER_REGISTERED', player: finalRecord });
            return { data: finalRecord, error: null, source: 'supabase' };
        } catch (error) {
            console.error('Failed to save player to Supabase, used local record fallback:', error);
            UniBoxDb.broadcastAuctionEvent({ type: 'PLAYER_REGISTERED', player: record });
            return { data: record, error: null, source: 'localStorageFallback' };
        }
    },

    // Fetch player profile by email
    getPlayerByEmail: async (email) => {
        let player = null;
        if (!UniBoxDb.isReady()) {
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            player = localPlayers.find(p => p.email.toLowerCase() === email.toLowerCase());
        } else {
            try {
                const { data, error } = await supabaseClient
                    .from('players')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle();
                if (error) throw error;
                player = data;
            } catch (error) {
                console.error('Failed to fetch player from Supabase:', error);
                const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
                player = localPlayers.find(p => p.email.toLowerCase() === email.toLowerCase());
            }
        }

        if (player) {
            const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
            const cached = auctionCache[player.id] || auctionCache[player.email] || {};
            const role = player.player_role || 'All-Rounder';
            const defaultBase = UniBoxDb.getDefaultBasePriceForRole(role);

            player = {
                ...player,
                base_price: (player.base_price !== undefined && player.base_price !== null)
                    ? Number(player.base_price) 
                    : (cached.base_price !== undefined ? Number(cached.base_price) : defaultBase),
                sold_price: (player.sold_price !== undefined && player.sold_price !== null)
                    ? Number(player.sold_price) 
                    : (cached.sold_price !== undefined ? Number(cached.sold_price) : null),
                sold_to_team: cached.sold_to_team || player.sold_to_team || null,
                sold_to_team_id: cached.sold_to_team_id || player.sold_to_team_id || null,
                auction_status: (cached.sold_to_team || player.sold_to_team) ? 'Sold' : (cached.auction_status || player.auction_status || 'Upcoming')
            };
        }

        return { data: player, error: null };
    },

    // Fetch all registered players
    getAllPlayers: async () => {
        let players = [];
        if (!UniBoxDb.isReady()) {
            players = JSON.parse(localStorage.getItem('unibox_players') || '[]');
        } else {
            try {
                const fetchPromise = supabaseClient
                    .from('players')
                    .select('*')
                    .order('created_at', { ascending: false });

                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Supabase request timed out after 6000ms')), 6000)
                );

                const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

                if (error) throw error;
                players = Array.isArray(data) ? data : [];
            } catch (error) {
                console.warn('Failed to fetch all players from Supabase, using local fallback:', error);
                players = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            }

            // Merge local players not yet reflected in Supabase
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            localPlayers.forEach(lp => {
                const lpEmail = (lp.email || '').toLowerCase();
                const lpEnr = (lp.enrollment_no || '').toLowerCase();
                if (!players.some(p => (p.email && p.email.toLowerCase() === lpEmail) || (p.enrollment_no && p.enrollment_no.toLowerCase() === lpEnr))) {
                    players.push(lp);
                }
            });
        }

        // Overlay auction cache (base_price, sold_price, sold_to_team, auction_status)
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        const rolePrices = UniBoxDb.getRoleBasePrices();

        players = players.map(player => {
            const id = player.id || player.email;
            const cached = auctionCache[id] || auctionCache[player.email] || {};
            const role = player.player_role || 'All-Rounder';
            const defaultPrice = UniBoxDb.getDefaultBasePriceForRole(role, rolePrices);

            return {
                ...player,
                base_price: (player.base_price !== undefined && player.base_price !== null)
                    ? Number(player.base_price)
                    : (cached.base_price !== undefined ? Number(cached.base_price) : defaultPrice),
                sold_price: (player.sold_price !== undefined && player.sold_price !== null)
                    ? Number(player.sold_price)
                    : (cached.sold_price !== undefined ? Number(cached.sold_price) : null),
                sold_to_team: cached.sold_to_team || player.sold_to_team || null,
                sold_to_team_id: cached.sold_to_team_id || player.sold_to_team_id || null,
                auction_status: (cached.sold_to_team || player.sold_to_team) ? 'Sold' : (cached.auction_status || player.auction_status || 'Upcoming')
            };
        });

        return { data: players, error: null };
    },

    // Update player clearance status
    updatePlayerStatus: async (playerIdOrEmail, newStatus) => {
        if (!UniBoxDb.isReady()) {
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            const idx = localPlayers.findIndex(p => p.id === playerIdOrEmail || p.email === playerIdOrEmail);
            if (idx >= 0) {
                localPlayers[idx].status = newStatus;
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            }
            return { success: true, source: 'localStorage' };
        }

        try {
            const query = typeof playerIdOrEmail === 'string' && playerIdOrEmail.includes('@')
                ? supabaseClient.from('players').update({ status: newStatus }).eq('email', playerIdOrEmail)
                : supabaseClient.from('players').update({ status: newStatus }).eq('id', playerIdOrEmail);

            const { data, error } = await query.select();
            if (error) throw error;
            return { data, error: null, source: 'supabase' };
        } catch (error) {
            console.error('Failed to update player status in Supabase:', error);
            return { data: null, error, source: 'supabase' };
        }
    },

    // Update player photo
    updatePlayerPhoto: async (email, photoData) => {
        if (!UniBoxDb.isReady()) {
            const localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            const idx = localPlayers.find(p => p.email === email);
            if (idx) {
                idx.photo_data = photoData;
                localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            }
            return { success: true, source: 'localStorage' };
        }

        try {
            const { data, error } = await supabaseClient
                .from('players')
                .update({ photo_data: photoData })
                .eq('email', email)
                .select();

            if (error) throw error;
            return { data, error: null, source: 'supabase' };
        } catch (error) {
            console.error('Failed to update player photo in Supabase:', error);
            return { data: null, error, source: 'supabase' };
        }
    },

    // Delete player registration
    deletePlayer: async (playerIdOrEmail) => {
        // Also remove from auction cache
        const auctionCache = JSON.parse(localStorage.getItem('unibox_auction_players_cache') || '{}');
        delete auctionCache[playerIdOrEmail];
        localStorage.setItem('unibox_auction_players_cache', JSON.stringify(auctionCache));

        if (!UniBoxDb.isReady()) {
            let localPlayers = JSON.parse(localStorage.getItem('unibox_players') || '[]');
            localPlayers = localPlayers.filter(p => p.id !== playerIdOrEmail && p.email !== playerIdOrEmail);
            localStorage.setItem('unibox_players', JSON.stringify(localPlayers));
            return { success: true, source: 'localStorage' };
        }

        try {
            const query = typeof playerIdOrEmail === 'string' && playerIdOrEmail.includes('@')
                ? supabaseClient.from('players').delete().eq('email', playerIdOrEmail).select()
                : supabaseClient.from('players').delete().eq('id', playerIdOrEmail).select();

            const { data, error } = await query;
            if (error) throw error;
            return { success: true, error: null, source: 'supabase' };
        } catch (error) {
            console.error('Failed to delete player from Supabase:', error);
            return { success: false, error, source: 'supabase' };
        }
    },

    // Admin Coordinator Authentication
    adminLogin: async (identifier, password) => {
        const inputHash = await UniBoxDb.hashPassword(password);
        const trimmed = (identifier || '').trim();

        if (UniBoxDb.isReady()) {
            try {
                const isEmail = trimmed.includes('@');
                const query = isEmail
                    ? supabaseClient.from('admins').select('*').eq('email', trimmed).maybeSingle()
                    : supabaseClient.from('admins').select('*').eq('username', trimmed).maybeSingle();

                const { data, error } = await query;
                if (!error && data) {
                    if (data.password_hash === inputHash) {
                        return { success: true, admin: data, error: null, source: 'supabase' };
                    } else {
                        return { success: false, error: 'Incorrect coordinator password.', source: 'supabase' };
                    }
                }
            } catch (err) {
                console.warn('Supabase admin lookup failed, falling back:', err);
            }
        }

        // Built-in Authorized Coordinator Fallback Verification
        const defaultHash = '819ad992a50989f76e1e5fe6d2167e370dabae02fb8ac8b0add58c6a23134f23';
        if ((trimmed.toLowerCase() === 'admin' || trimmed.toLowerCase() === 'admin@unibox.com') && inputHash === defaultHash) {
            return {
                success: true,
                admin: { username: 'admin', email: 'admin@unibox.com', role: 'Lead Coordinator' },
                error: null,
                source: 'default'
            };
        }

        return { success: false, error: 'Invalid coordinator username or password.', source: 'auth' };
    }
};

// Export to window
if (typeof window !== 'undefined') {
    window.UniBoxDb = UniBoxDb;
}

