-- ============================================================
-- NEXUS SOCIAL — SUPABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- USERS
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  nexus_id text unique not null,
  email text unique not null,
  username text unique not null,
  full_name text not null,
  age integer,
  gender text,
  pronouns text,
  sexuality text,
  country text,
  avatar_url text,
  bio text default '',
  personal_links jsonb default '[]',
  is_suspended boolean default false,
  suspended_until timestamptz,
  is_banned boolean default false,
  can_create_groups boolean default true,
  created_at timestamptz default now()
);

-- FRIENDSHIPS
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade,
  receiver_id uuid references public.users(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique(sender_id, receiver_id)
);

-- MESSAGE REQUESTS
create table public.message_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade,
  receiver_id uuid references public.users(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz default now(),
  unique(sender_id, receiver_id)
);

-- DIRECT MESSAGES
create table public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete cascade,
  receiver_id uuid references public.users(id) on delete cascade,
  content text,
  media_url text,
  seen boolean default false,
  created_at timestamptz default now()
);

-- POSTS
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  content text,
  media_url text,
  likes_count integer default 0,
  comments_count integer default 0,
  created_at timestamptz default now()
);

-- POST LIKES
create table public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- GROUPS
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  group_code text unique not null,
  banner_emoji text default '💬',
  owner_id uuid references public.users(id) on delete set null,
  member_count integer default 1,
  created_at timestamptz default now()
);

-- GROUP MEMBERS
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role text default 'member' check (role in ('owner','admin','member')),
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

-- GROUP MESSAGES
create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  sender_id uuid references public.users(id) on delete set null,
  content text,
  media_url text,
  created_at timestamptz default now()
);

-- NOTIFICATIONS
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  type text not null,
  content text not null,
  meta jsonb default '{}',
  read boolean default false,
  created_at timestamptz default now()
);

-- REPORTS
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  reported_user_id uuid references public.users(id) on delete set null,
  reported_message_id uuid,
  type text not null,
  message text default '',
  status text default 'pending' check (status in ('pending','resolved','dismissed')),
  created_at timestamptz default now()
);

-- ADMINS TABLE
create table public.admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users(id) on delete cascade,
  role text default 'moderator' check (role in ('super_admin','admin','moderator')),
  granted_by uuid references public.users(id),
  created_at timestamptz default now()
);

-- PLATFORM SETTINGS
create table public.platform_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- Default settings
insert into public.platform_settings (key, value) values
  ('groups_enabled', 'true'),
  ('registrations_enabled', 'true'),
  ('media_uploads_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('dm_enabled', 'true');

-- ─── FUNCTIONS ────────────────────────────────────────────────────────────────

-- Increment likes
create or replace function increment_likes(post_id uuid)
returns void language sql as $$
  update posts set likes_count = likes_count + 1 where id = post_id;
$$;

-- Decrement likes
create or replace function decrement_likes(post_id uuid)
returns void language sql as $$
  update posts set likes_count = greatest(likes_count - 1, 0) where id = post_id;
$$;

-- Get conversations (latest DM per conversation partner)
create or replace function get_conversations(p_user_id uuid)
returns table (
  other_user_id uuid,
  other_username text,
  other_full_name text,
  other_avatar_url text,
  other_country text,
  last_message text,
  last_message_time timestamptz,
  unread_count bigint
) language sql as $$
  with all_messages as (
    select
      case when sender_id = p_user_id then receiver_id else sender_id end as partner_id,
      content,
      created_at,
      case when receiver_id = p_user_id and not seen then 1 else 0 end as is_unread
    from direct_messages
    where sender_id = p_user_id or receiver_id = p_user_id
  ),
  latest as (
    select partner_id, max(created_at) as last_time
    from all_messages
    group by partner_id
  )
  select
    u.id,
    u.username,
    u.full_name,
    u.avatar_url,
    u.country,
    am.content,
    latest.last_time,
    sum(am.is_unread)
  from latest
  join all_messages am on am.partner_id = latest.partner_id and am.created_at = latest.last_time
  join users u on u.id = latest.partner_id
  group by u.id, u.username, u.full_name, u.avatar_url, u.country, am.content, latest.last_time
  order by latest.last_time desc;
$$;

-- ─── RLS POLICIES ─────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- Users: readable by all authenticated, writable by self
create policy "users_select" on public.users for select using (auth.role() = 'authenticated');
create policy "users_update" on public.users for update using (auth.uid() = id);

-- Posts: readable by all, insertable by owner
create policy "posts_select" on public.posts for select using (auth.role() = 'authenticated');
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);

-- DMs: only visible to sender/receiver
create policy "dm_select" on public.direct_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);
create policy "dm_insert" on public.direct_messages for insert with check (auth.uid() = sender_id);

-- Group messages: members only
create policy "gm_select" on public.group_messages for select using (
  exists (select 1 from group_members where group_id = group_messages.group_id and user_id = auth.uid())
);
create policy "gm_insert" on public.group_messages for insert with check (
  exists (select 1 from group_members where group_id = group_messages.group_id and user_id = auth.uid())
  and auth.uid() = sender_id
);

-- Notifications: own only
create policy "notif_select" on public.notifications for select using (auth.uid() = user_id);

-- ─── REALTIME ─────────────────────────────────────────────────────────────────

-- Enable realtime for messaging tables
alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.direct_messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.group_members;
