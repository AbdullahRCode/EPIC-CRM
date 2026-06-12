-- ============================================================================
-- EPIC Menswear CRM — Security migration (roles, anonymous sales, RLS)
-- ⚠️  REVIEW BEFORE RUNNING — run in the Supabase SQL editor as one script.
-- After running: every user must sign out and back in to refresh their JWT.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles into app_metadata (only service role can write app_metadata).
--    Adjust emails/branches to match your real staff before running.
-- ----------------------------------------------------------------------------
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'admin', 'branch', 'All')
where email = 'abdullah@logorhythmx.com';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'owner', 'branch', 'All')
where email = 'demo@epicmenswear.ca';

-- Everyone else becomes an employee. Assign real branches per user afterwards:
--   update auth.users set raw_app_meta_data = raw_app_meta_data
--     || jsonb_build_object('branch', 'Victoria') where email = '...';
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', 'employee')
where coalesce(raw_app_meta_data->>'role', '') not in ('admin', 'owner');

-- ----------------------------------------------------------------------------
-- 2. anonymous_sales table + atomic accumulation RPC
-- ----------------------------------------------------------------------------
create table if not exists anonymous_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'epic-menswear',
  branch text not null,
  sale_date date not null,
  items jsonb not null default '[]',
  total_amount numeric not null default 0,
  staff text,
  notes text,
  created_at timestamptz default now()
);

create unique index if not exists anonymous_sales_branch_day
  on anonymous_sales (tenant_id, branch, sale_date);

-- SECURITY DEFINER so the authenticated (anon-key) server client can call it
-- even with RLS enabled below.
create or replace function add_anonymous_sale(
  p_tenant_id text,
  p_branch text,
  p_sale_date date,
  p_items jsonb,
  p_total numeric,
  p_staff text,
  p_notes text
) returns void
language sql
security definer
set search_path = public
as $$
  insert into anonymous_sales (tenant_id, branch, sale_date, items, total_amount, staff, notes)
  values (p_tenant_id, p_branch, p_sale_date, p_items, p_total, p_staff, p_notes)
  on conflict (tenant_id, branch, sale_date) do update
    set items        = anonymous_sales.items || excluded.items,
        total_amount = anonymous_sales.total_amount + excluded.total_amount,
        staff        = coalesce(excluded.staff, anonymous_sales.staff),
        notes        = coalesce(excluded.notes, anonymous_sales.notes);
$$;

-- Only signed-in users may call it; block anonymous visitors.
revoke execute on function add_anonymous_sale(text, text, date, jsonb, numeric, text, text) from anon, public;
grant  execute on function add_anonymous_sale(text, text, date, jsonb, numeric, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY — the critical fix (Finding S1).
--    Strategy: lock the tables completely for anon + authenticated clients.
--    All app reads/writes go through server actions using the SERVICE ROLE key
--    (which bypasses RLS). The public anon key then grants nothing.
--    NOTE: requires SUPABASE_SERVICE_ROLE_KEY to be set in Vercel BEFORE
--    deploying the matching code (lib/supabase.ts no longer falls back to anon).
-- ----------------------------------------------------------------------------
alter table clients          enable row level security;
alter table comms            enable row level security;
alter table anonymous_sales  enable row level security;

-- Deny-by-default: RLS with no policies = no access for anon/authenticated.
-- Read access for signed-in staff is intentionally NOT granted here because
-- the app routes every query through the service-role server client.

-- anonymous_sales reads happen via the anon-key server client today; grant
-- signed-in users read so the dashboard keeps working:
drop policy if exists "authenticated read anonymous_sales" on anonymous_sales;
create policy "authenticated read anonymous_sales"
  on anonymous_sales for select
  to authenticated
  using (tenant_id = 'epic-menswear');

drop policy if exists "owner/admin delete anonymous_sales" on anonymous_sales;
create policy "owner/admin delete anonymous_sales"
  on anonymous_sales for delete
  to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') in ('owner', 'admin'));
