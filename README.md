<img src="static/img/logo.svg" width="100" alt="Nexus Social"/>
# ✦ Nexus Social

> *Find your people.*

A full-stack real-time social media platform built with Flask, Supabase, and Socket.IO. Features unique sequential Nexus IDs, real-time group and direct messaging, friend requests, media uploads, and more.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python + Flask |
| Real-time | Flask-SocketIO + Supabase Realtime |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email confirmation) |
| Storage | Supabase Storage (media uploads) |
| Deploy | Railway |

---

## Features

- 🪪 **Sequential Nexus IDs** — every user gets a unique #000001-style ID, permanent forever
- 🔍 **User search** — find people by @username or groups by code (e.g. `FT15-X4`)
- 👥 **Friends** — send/accept friend requests; auto-friend on message request acceptance
- 💬 **Real-time DMs** — live direct messages with seen receipts, typing indicators, media
- 🌐 **Real-time Group Chat** — live group messaging, member list, group roles (owner/admin/member)
- 🆔 **Smart Group IDs** — e.g. "Friends Together" → `FT15-X4` (initials + letter count + random suffix)
- 🌍 **Country flags** — only the flag emoji is shown publicly, not the country name
- 📸 **Media uploads** — images and video up to 20MB via Supabase Storage
- 🔔 **Notifications** — friend requests, message requests, group alerts, system announcements
- 📝 **Posts & Feed** — create posts with media, like, comment, repost
- 🗑️ **Account deletion** — users can permanently delete their own account
- 🚨 **Report system** — report users/messages, feeds directly into admin panel

---

## Project Structure

```
nexus-social/
├── app.py                  # Flask app + Socket.IO + all API routes
├── schema.sql              # Full Supabase database schema — run this first
├── requirements.txt
├── Procfile                # Railway deployment
├── .env.example
├── templates/
│   ├── landing.html        # Public landing page
│   ├── auth.html           # Login / Register
│   └── app.html            # Main SPA shell
└── static/
    ├── css/
    │   ├── main.css        # Shared styles (landing, auth)
    │   └── app.css         # App styles (feed, chat, groups, profile)
    └── js/
        ├── api.js          # Fetch helpers
        ├── socket.js       # Socket.IO init + event listeners
        ├── ui.js           # Shared UI utilities, search, modals, toasts
        ├── feed.js         # Home feed, posts, composer
        ├── messages.js     # DMs, conversations, real-time chat
        ├── groups.js       # Group discovery, group chat, real-time
        ├── notifications.js
        ├── profile.js      # Profile view + edit
        ├── app.js          # App bootstrap + routing
        ├── auth.js         # Register/Login form handling
        └── landing.js      # Landing page parallax
```

---

## Setup Guide

### 1. Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Name it `nexus-social`, choose a region close to you, set a strong DB password
3. Wait for it to provision (~2 minutes)
4. Go to **SQL Editor** → paste the entire contents of `schema.sql` → click **Run**
5. Go to **Storage** → create a bucket called `media` → set it to **Public**
6. Go to **Authentication → Email Templates** → customise your confirmation email to mention Nexus Social
7. Copy your credentials from **Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` key → `SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY`

### 2. Make Yourself #000001 (Owner)

**This is the critical step.** After running `schema.sql`:

1. Register your account on the live site first (or via Supabase Auth directly)
2. In **Supabase → SQL Editor**, run:
   ```sql
   -- Verify your nexus_id is 000001
   SELECT id, nexus_id, username, full_name FROM users ORDER BY created_at LIMIT 5;
   ```
3. Your account will automatically be `#000001` because `generate_nexus_id()` counts existing users + 1. As the first user, you get 1 → zero-padded to `000001`.
4. Then add yourself to the admins table:
   ```sql
   INSERT INTO public.admins (user_id, role, granted_by)
   SELECT id, 'super_admin', id FROM public.users WHERE nexus_id = '000001';
   ```

### 3. Local Development

```bash
git clone https://github.com/YOUR_USERNAME/nexus-social
cd nexus-social
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in your .env values
python app.py
# Visit http://localhost:5000
```

### 4. Deploy to Railway

1. Push your code to a **GitHub repo** (make sure `.env` is in `.gitignore`)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your `nexus-social` repo
4. Go to **Variables** → add all four from your `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
   - `SECRET_KEY` (generate one: `python -c "import secrets; print(secrets.token_hex(32))"`)
5. Railway auto-detects the `Procfile` and deploys
6. Your site goes live at `https://nexus-social-xxxx.up.railway.app`

---

## Environment Variables

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (admin operations) |
| `SECRET_KEY` | Flask session secret — generate a random string |

---

## About the Group ID System

Group IDs are generated from the group name:
- Take the first letter of each word (capitalised)
- Count total letters across all words
- Add a 2-character random suffix for uniqueness

**Example:** `Friends Together` → `F` + `T` + `15` letters + `-X4` = **`FT15-X4`**

If the suffix collides with an existing group, a new one is generated automatically.

---

Built by Ken (Stain) · @stainprojectss · linktr.ee/iamevanss
