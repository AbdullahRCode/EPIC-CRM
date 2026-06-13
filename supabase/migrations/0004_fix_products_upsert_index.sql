-- ============================================================================
-- EPIC Menswear CRM — Migration 0004: fix Shopify upsert conflict target
-- The 0003 index was partial (where shopify_handle is not null), which
-- ON CONFLICT (tenant_id, shopify_handle) cannot use as an arbiter.
-- A full unique index works: NULLs are distinct, so manual rows
-- (shopify_handle = null) are unaffected and unlimited.
-- ============================================================================

drop index if exists products_shopify_handle;

create unique index if not exists products_shopify_handle
  on products (tenant_id, shopify_handle);
