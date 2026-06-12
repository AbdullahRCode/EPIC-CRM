-- ============================================================================
-- EPIC Menswear CRM — Migration 0003: product & deals catalog
-- ⚠️  PROPOSED — review before running in the Supabase SQL editor.
-- App code falls back to the legacy hardcoded price list until this runs.
-- ============================================================================

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'epic-menswear',
  name text not null,
  brand text,
  category text not null default 'Other',
  price numeric not null,
  sale_price numeric,                    -- null = not on sale
  active boolean not null default true,
  source text not null default 'manual', -- 'manual' | 'shopify'
  shopify_handle text,                   -- upsert key for synced rows
  updated_at timestamptz default now()
);

create index if not exists products_tenant on products (tenant_id, active);
create unique index if not exists products_shopify_handle
  on products (tenant_id, shopify_handle) where shopify_handle is not null;

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'epic-menswear',
  label text not null,
  discount_type text not null default 'percent',  -- 'percent' | 'amount'
  discount_value numeric not null,
  applies_to_brand text,                          -- null = any brand
  applies_to_category text,                       -- null = any category
  starts_on date,
  ends_on date,
  active boolean not null default true,
  source text not null default 'manual',          -- 'manual' | 'shopify'
  updated_at timestamptz default now()
);

create index if not exists deals_tenant on deals (tenant_id, active);

alter table products enable row level security;
alter table deals    enable row level security;
-- No policies: service-role server actions only (consistent with 0001/0002).

-- ── Seed: the price list previously hardcoded in the AI prompts ─────────────
insert into products (name, brand, category, price) values
  ('Carlo Lusso Full Suit',        'Carlo Lusso',      'Suit',        250),
  ('Calvin Klein Jacket',          'Calvin Klein',     'Suit',        350),
  ('Calvin Klein Pants',           'Calvin Klein',     'Suit',        175),
  ('Calvin Klein Full Suit',       'Calvin Klein',     'Suit',        450),
  ('Tommy Hilfiger Suit',          'Tommy Hilfiger',   'Suit',        475),
  ('Giorgio Fiorelli Suit',        'Giorgio Fiorelli', 'Suit',        350),
  ('Mantoni Suit',                 'Mantoni',          'Suit',        400),
  ('Bertolini Suit',               'Bertolini',        'Suit',        375),
  ('Renoir Suit',                  'Renoir',           'Suit',        300),
  ('Sports Coat (entry)',          null,               'Sports Coat', 150),
  ('Sports Coat (premium)',        null,               'Sports Coat', 350),
  ('Dress Shirt (entry)',          null,               'Dress Shirt',  60),
  ('Dress Shirt (premium)',        null,               'Dress Shirt', 120),
  ('Accessories — ties & belts',   null,               'Accessories',  20)
on conflict do nothing;
