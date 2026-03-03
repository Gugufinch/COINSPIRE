# Coinspire V4.3 — Deployment Guide

## Architecture
- **Frontend**: Vite + React (static site on Render)
- **Database**: Supabase (PostgreSQL + auth)
- **Hosting**: Render (free static site)

## Step 1: Supabase Setup

### 1a. Create Tables
Go to Supabase → SQL Editor → Run this:

```sql
-- User data storage (replaces window.storage)
CREATE TABLE user_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint: one row per user
CREATE UNIQUE INDEX idx_user_data_user_id ON user_data(user_id);

-- PIN storage  
CREATE TABLE user_pins (
  user_id TEXT PRIMARY KEY,
  pin TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Row Level Security (optional but recommended)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;

-- Allow all operations (simple auth via PIN, not Supabase auth)
CREATE POLICY "Allow all" ON user_data FOR ALL USING (true);
CREATE POLICY "Allow all" ON user_pins FOR ALL USING (true);
```

### 1b. Get Your Credentials
Go to Supabase → Settings → API:
- Copy **Project URL** (e.g., `https://xxxxx.supabase.co`)
- Copy **anon/public key** (starts with `eyJ...`)

### 1c. Create `.env` file
In your project root:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Step 2: GitHub Setup

```bash
cd coinspire-app
git init
git remote add origin https://github.com/YOUR_USERNAME/coinspire.git
git add .
git commit -m "Coinspire V4.3 - initial deploy"
git push -u origin main
```

## Step 3: Render Setup

1. Go to render.com → New → **Static Site**
2. Connect your GitHub repo
3. Settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Deploy!

Your app will be at `https://coinspire-xxxx.onrender.com`

## Step 4: Custom Domain (Optional)
In Render → Settings → Custom Domains → Add your domain

## How It Works
- Greg and Sarah each have isolated data via `user_id` (greg/sarah)
- PIN authentication happens against Supabase `user_pins` table
- All financial data stored in `user_data` table as JSONB
- Static site = free tier on Render
- Supabase free tier = 500MB database, unlimited API calls
