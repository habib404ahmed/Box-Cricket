-- ==============================================================================
-- UNIBOX LEAGUE 2026 - SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase Dashboard: SQL Editor -> New query -> Run
-- ==============================================================================

-- 1. Create Players Table
create table if not exists public.players (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    full_name text not null,
    enrollment_no text not null unique,
    department text not null,
    email text not null unique,
    gender text not null,
    player_role text not null,
    certificate_name text,
    certificate_data text,
    photo_data text,
    password_hash text,
    status text default 'Registered' not null
);

-- Migration for existing tables:
alter table public.players add column if not exists password_hash text;
alter table public.players add column if not exists certificate_data text;

-- 2. Create Index for Fast Queries
create index if not exists idx_players_email on public.players (email);
create index if not exists idx_players_enrollment on public.players (enrollment_no);
create index if not exists idx_players_dept on public.players (department);

-- 3. Enable Row Level Security (RLS)
alter table public.players enable row level security;

-- 4. Create Public Access Policies (Allows public registration and read for tournament portal)
-- Allow anyone to insert a registration record
create policy "Allow public player registration" 
    on public.players 
    for insert 
    with check (true);

-- Allow public to view registered players
create policy "Allow public read access to players" 
    on public.players 
    for select 
    using (true);

-- Allow public update (for photo/status updates)
create policy "Allow public player updates" 
    on public.players 
    for update 
    using (true);

-- Allow public delete (for admin panel deletions)
create policy "Allow public player delete" 
    on public.players 
    for delete 
    using (true);

-- ==============================================================================
-- 5. ADMIN AUTHENTICATION TABLE
-- ==============================================================================
create table if not exists public.admins (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    username text not null unique,
    email text not null unique,
    password_hash text not null,
    role text default 'Lead Coordinator' not null
);

-- Enable RLS for admins
alter table public.admins enable row level security;

-- Allow read on admins for authentication
create policy "Allow read on admins for authentication" 
    on public.admins 
    for select 
    using (true);

-- Seed Default Coordinator Account (Username: admin | Password: admin2026)
insert into public.admins (username, email, password_hash, role)
values ('admin', 'admin@unibox.com', '819ad992a50989f76e1e5fe6d2167e370dabae02fb8ac8b0add58c6a23134f23', 'Lead Coordinator')
on conflict (username) do nothing;

-- ==============================================================================
-- 6. PLAYER AUCTION COLUMNS MIGRATION
-- ==============================================================================
alter table public.players add column if not exists base_price numeric default 0;
alter table public.players add column if not exists sold_price numeric default 0;
alter table public.players add column if not exists sold_to_team text;
alter table public.players add column if not exists auction_status text default 'Upcoming';

-- ==============================================================================
-- 7. TOURNAMENT TEAMS & BUDGET TABLE
-- ==============================================================================
create table if not exists public.teams (
    id text primary key,
    name text not null,
    department text not null,
    logo text not null,
    color text default '#a3e635' not null,
    total_budget numeric default 1000 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure default column value is updated for existing tables
alter table public.teams alter column total_budget set default 1000;

-- Enable RLS for teams
alter table public.teams enable row level security;

-- Allow public read access to teams
create policy "Allow public read teams" 
    on public.teams 
    for select 
    using (true);

-- Allow public insert/update to teams
create policy "Allow public update teams" 
    on public.teams 
    for update 
    using (true);

create policy "Allow public insert teams" 
    on public.teams 
    for insert 
    with check (true);

create policy "Allow public delete teams" 
    on public.teams 
    for delete 
    using (true);

-- Seed Default University Department Franchises (Purse: 1000 Points each)
insert into public.teams (id, name, department, logo, color, total_budget)
values 
    ('team-btech', 'B.Tech Titans', 'B.Tech', '⚡', '#38bdf8', 1000),
    ('team-bca', 'BCA Blasters', 'BCA', '🏏', '#a3e635', 1000),
    ('team-bba', 'BBA Bulls', 'BBA', '🐂', '#fbbf24', 1000),
    ('team-mca', 'MCA Mavericks', 'MCA', '🦅', '#34d399', 1000),
    ('team-mba', 'MBA Monarchs', 'MBA', '👑', '#c084fc', 1000)
on conflict (id) do update set
    name = excluded.name,
    department = excluded.department,
    logo = excluded.logo,
    color = excluded.color,
    total_budget = excluded.total_budget;

-- Update existing records that have default 100 to 1000
update public.teams set total_budget = 1000 where total_budget = 100;

-- Team Owner Columns Migration (Supports Franchise Owner Authentication & Profiles)
alter table public.teams add column if not exists owner_name text;
alter table public.teams add column if not exists owner_email text;
alter table public.teams add column if not exists password_hash text;
alter table public.teams add column if not exists owner_phone text;
alter table public.teams add column if not exists status text default 'Active';

create index if not exists idx_teams_owner_email on public.teams (owner_email);

-- ==============================================================================
-- 8. RELOAD SUPABASE POSTGREST SCHEMA CACHE
-- ==============================================================================
-- Forces Supabase PostgREST to immediately discover newly added columns & tables
notify pgrst, 'reload schema';
