-- ═══════════════════════════════════════════════════════════════
-- Coinspire — Supabase Row Level Security (RLS) Setup
-- ═══════════════════════════════════════════════════════════════
--
-- Problem: Coinspire uses PIN-based auth (not Supabase Auth), so we
-- cannot use auth.uid() in RLS policies. The anon key is in the
-- browser bundle, which means anyone can open the dev console and
-- run `supabase.from('user_data').select('*')` to read EVERYONE's
-- financial data. This script closes that hole.
--
-- Strategy: each user_data / user_pins row carries a per-user
-- access_token (a long random string). The browser keeps the token
-- in localStorage alongside the PIN, and EVERY query must pass it.
-- RLS enforces the match server-side, so a snooper without the token
-- gets nothing — even with the anon key.
--
-- Trade-off: this is access-token security, not full auth. A user
-- with physical access to another user's device can still read the
-- token from localStorage. For multi-tenant safety on shared devices
-- you would migrate to Supabase Auth (sign in with email/magic link),
-- which is the recommended long-term path.
--
-- Run this in the Supabase SQL editor for your project.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. Add access_token columns
-- ─────────────────────────────────────────────
alter table public.user_data
  add column if not exists access_token text;
alter table public.user_pins
  add column if not exists access_token text;

-- Backfill existing rows with random tokens (so legacy rows are not
-- locked out before the client is updated to send tokens).
update public.user_data
   set access_token = encode(gen_random_bytes(32), 'hex')
 where access_token is null;
update public.user_pins
   set access_token = encode(gen_random_bytes(32), 'hex')
 where access_token is null;

-- Make the columns NOT NULL once backfilled.
alter table public.user_data alter column access_token set not null;
alter table public.user_pins alter column access_token set not null;

-- Index for fast lookups on (user_id, access_token).
create index if not exists user_data_id_token_idx
  on public.user_data (user_id, access_token);
create index if not exists user_pins_id_token_idx
  on public.user_pins (user_id, access_token);


-- ─────────────────────────────────────────────
-- 2. Enable RLS
-- ─────────────────────────────────────────────
alter table public.user_data  enable row level security;
alter table public.user_pins  enable row level security;

-- Drop any existing permissive policies (clean slate).
drop policy if exists "user_data_anon_all" on public.user_data;
drop policy if exists "user_pins_anon_all" on public.user_pins;


-- ─────────────────────────────────────────────
-- 3. Read policies — require token match
-- ─────────────────────────────────────────────
-- Reads require the client to filter by user_id AND access_token.
-- A query without the token returns 0 rows.

create policy "user_data_select_with_token"
  on public.user_data for select
  using (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );

create policy "user_pins_select_with_token"
  on public.user_pins for select
  using (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );

-- Alternative (simpler, requires client to pass token in WHERE clause):
-- create policy "user_data_select_via_filter"
--   on public.user_data for select
--   using (true);  -- and rely on client to .eq('access_token', token)
-- This is less safe because a forgotten filter exposes everything.


-- ─────────────────────────────────────────────
-- 4. Write policies — same token gate
-- ─────────────────────────────────────────────
create policy "user_data_upsert_with_token"
  on public.user_data for insert
  with check (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );

create policy "user_data_update_with_token"
  on public.user_data for update
  using (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );

create policy "user_pins_upsert_with_token"
  on public.user_pins for insert
  with check (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );

create policy "user_pins_update_with_token"
  on public.user_pins for update
  using (
    access_token = coalesce(current_setting('request.headers', true)::json->>'x-coinspire-token', '__missing__')
  );


-- ─────────────────────────────────────────────
-- 5. New-user signup helper
-- ─────────────────────────────────────────────
-- A SECURITY DEFINER function lets a new user create their first row
-- (PIN + access_token) without already having a token. It returns the
-- generated token; the client stores it in localStorage and sends it
-- via the x-coinspire-token header on every subsequent request.

create or replace function public.coinspire_signup(
  p_user_id text,
  p_pin text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  -- Reject if user_id already taken.
  if exists (select 1 from public.user_pins where user_id = p_user_id) then
    raise exception 'user_id_taken';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.user_pins (user_id, pin, access_token)
       values (p_user_id, p_pin, v_token);

  -- Empty data row so updates work without a prior insert.
  insert into public.user_data (user_id, data, access_token, updated_at)
       values (p_user_id, '{}'::jsonb, v_token, now());

  return v_token;
end;
$$;

revoke all on function public.coinspire_signup(text, text) from public;
grant execute on function public.coinspire_signup(text, text) to anon, authenticated;


-- ─────────────────────────────────────────────
-- 6. PIN-verify helper (returns token if PIN matches)
-- ─────────────────────────────────────────────
-- Without this, an attacker could brute-force PINs over the network.
-- Encapsulating the check in a SECURITY DEFINER function lets us add
-- rate limiting later (per IP / per user_id) without touching RLS.

create or replace function public.coinspire_login(
  p_user_id text,
  p_pin text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  select access_token into v_token
    from public.user_pins
   where user_id = p_user_id
     and pin = p_pin
   limit 1;

  if v_token is null then
    -- Constant-ish delay to discourage brute force.
    perform pg_sleep(0.25);
    return null;
  end if;

  return v_token;
end;
$$;

revoke all on function public.coinspire_login(text, text) from public;
grant execute on function public.coinspire_login(text, text) to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════
-- CLIENT CHANGES NEEDED IN src/App.jsx
-- ═══════════════════════════════════════════════════════════════
--
-- 1. Update the supabase client init to send the token header on
--    every request after login:
--
--      let SESSION_TOKEN = null;
--      const supabase = createClient(supabaseUrl, supabaseKey, {
--        global: {
--          headers: () => SESSION_TOKEN
--            ? { 'x-coinspire-token': SESSION_TOKEN }
--            : {}
--        }
--      });
--
-- 2. Replace the existing PIN-set/PIN-check code in LoginScreen with
--    the new RPC calls:
--
--      // signup (first PIN)
--      const { data: token } = await supabase.rpc('coinspire_signup', {
--        p_user_id: user, p_pin: pin
--      });
--      SESSION_TOKEN = token;
--      localStorage.setItem('coinspire_token_' + user, token);
--
--      // login
--      const { data: token } = await supabase.rpc('coinspire_login', {
--        p_user_id: user, p_pin: pin
--      });
--      if (!token) { setError(true); return; }
--      SESSION_TOKEN = token;
--      localStorage.setItem('coinspire_token_' + user, token);
--
-- 3. On Lock / logout: SESSION_TOKEN = null;
--
-- 4. On account reset: also delete the token from localStorage.
--
-- ═══════════════════════════════════════════════════════════════
-- POST-DEPLOY VERIFICATION
-- ═══════════════════════════════════════════════════════════════
--   1. Open the deployed site as user A, complete a save.
--   2. Open in a new private window as user B (Dylan).
--   3. In Dylan's dev console:
--        await window.supabase
--          .from('user_data')
--          .select('*')
--          .eq('user_id', 'greg')
--          .single();
--      Expected: { data: null, error: null }
--      (Without the token header, RLS returns no rows.)
--   4. Confirm Dylan's normal app usage still works (his own header
--      gets sent, his own row is readable).
-- ═══════════════════════════════════════════════════════════════
