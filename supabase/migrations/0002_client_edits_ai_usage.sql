-- ============================================================================
-- EPIC Menswear CRM — Migration 0002: edit history + AI usage caps
-- ⚠️  PROPOSED — review before running in the Supabase SQL editor.
-- The app code ships with graceful fallbacks, so deploying code before
-- running this migration is safe (features activate once tables exist).
-- ============================================================================

-- ── Field-level edit history (who changed what, when) ──────────────────────
create table if not exists client_edits (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'epic-menswear',
  client_id text not null,
  field text not null,
  old_value text,
  new_value text,
  edited_by text not null,          -- session email/name (server-derived)
  edited_at timestamptz default now()
);

create index if not exists client_edits_client on client_edits (client_id, edited_at desc);

alter table client_edits enable row level security;
-- No policies: service-role server actions only (deny-by-default like clients/comms).

-- ── AI usage counters (per user, per feature, per store-local day) ─────────
create table if not exists ai_usage (
  tenant_id text not null default 'epic-menswear',
  user_id text not null,
  feature text not null,            -- 'search' | 'summary' | 'photo' | 'note' | 'email'
  usage_date date not null,
  count int not null default 0,
  primary key (tenant_id, user_id, feature, usage_date)
);

alter table ai_usage enable row level security;
-- No policies: service-role only.

-- Atomic increment-and-check; returns the new count so the caller can
-- compare against its limit.
create or replace function increment_ai_usage(
  p_tenant_id text,
  p_user_id text,
  p_feature text,
  p_usage_date date
) returns int
language sql
security definer
set search_path = public
as $$
  insert into ai_usage (tenant_id, user_id, feature, usage_date, count)
  values (p_tenant_id, p_user_id, p_feature, p_usage_date, 1)
  on conflict (tenant_id, user_id, feature, usage_date)
    do update set count = ai_usage.count + 1
  returning count;
$$;

revoke execute on function increment_ai_usage(text, text, text, date) from anon, public;
grant  execute on function increment_ai_usage(text, text, text, date) to authenticated, service_role;
