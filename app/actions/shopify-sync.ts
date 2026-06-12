"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { DEFAULT_TENANT } from "@/lib/types";

/* Manual Shopify catalog sync (admin button — no cron until the first run
   has been reviewed).

   Shopify semantics: variant.price = what the customer pays NOW;
   variant.compare_at_price = the original price when discounted.
   Mapping into our tables:
     products.price      = compare_at_price ?? price   (regular price)
     products.sale_price = compare_at_price ? price : null
   Manual rows are never touched: synced rows carry source='shopify' and
   upsert on shopify_handle; shopify-sourced deals are regenerated per run. */

const SHOP_URL = "https://epicmenswear.ca/products.json";

interface ShopifyVariant {
  price: string;
  compare_at_price: string | null;
  available: boolean;
}

interface ShopifyProduct {
  title: string;
  handle: string;
  product_type: string;
  vendor: string;
  variants: ShopifyVariant[];
}

export interface SyncResult {
  ok: boolean;
  message: string;
  productsSynced?: number;
  onSale?: number;
  dealsCreated?: number;
}

function mapCategory(productType: string): string {
  const t = productType.toLowerCase();
  if (t.includes("suit")) return "Suit";
  if (t.includes("tux")) return "Tuxedo";
  if (t.includes("shirt")) return "Dress Shirt";
  if (t.includes("coat") || t.includes("blazer")) return "Sports Coat";
  if (t.includes("shoe") || t.includes("boot")) return "Footwear";
  return productType.trim() || "Other";
}

export async function syncShopifyCatalog(): Promise<SyncResult> {
  await requireRole("admin");

  // ── Fetch all pages ────────────────────────────────────────────────────
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${SHOP_URL}?limit=250&page=${page}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      if (page === 1) return { ok: false, message: `Shopify fetch failed (HTTP ${res.status})` };
      break;
    }
    const json = (await res.json()) as { products?: ShopifyProduct[] };
    const batch = json.products ?? [];
    all.push(...batch);
    if (batch.length < 250) break;
  }
  if (!all.length) return { ok: false, message: "Shopify returned no products" };

  // ── Map to catalog rows ────────────────────────────────────────────────
  const now = new Date().toISOString();
  const rows = all
    .map((p) => {
      const v = p.variants.find((x) => x.available) ?? p.variants[0];
      if (!v) return null;
      const current = parseFloat(v.price);
      const compareAt = v.compare_at_price ? parseFloat(v.compare_at_price) : null;
      if (!Number.isFinite(current)) return null;
      const onSale = compareAt != null && compareAt > current;
      return {
        tenant_id: DEFAULT_TENANT,
        name: p.title,
        brand: p.vendor?.trim() || null,
        category: mapCategory(p.product_type),
        price: onSale ? compareAt! : current,
        sale_price: onSale ? current : null,
        active: p.variants.some((x) => x.available),
        source: "shopify",
        shopify_handle: p.handle,
        updated_at: now,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const db = getSupabaseAdmin();
  const { error: upsertError } = await db
    .from("products")
    .upsert(rows, { onConflict: "tenant_id,shopify_handle" });
  if (upsertError) {
    if (/does not exist/i.test(upsertError.message)) {
      return { ok: false, message: "Catalog tables missing — run migration 0003 first." };
    }
    return { ok: false, message: `Product upsert failed: ${upsertError.message}` };
  }

  // ── Regenerate shopify-sourced deals (grouped by vendor × category) ────
  const groups = new Map<string, { brand: string | null; category: string; pcts: number[] }>();
  for (const r of rows) {
    if (r.sale_price == null) continue;
    const pct = Math.round((1 - r.sale_price / r.price) * 100);
    if (pct <= 0) continue;
    const key = `${r.brand ?? ""}|${r.category}`;
    if (!groups.has(key)) groups.set(key, { brand: r.brand, category: r.category, pcts: [] });
    groups.get(key)!.pcts.push(pct);
  }

  await db.from("deals").delete().eq("tenant_id", DEFAULT_TENANT).eq("source", "shopify");

  const dealRows = Array.from(groups.values()).map((g) => {
    const avg = Math.round(g.pcts.reduce((s, p) => s + p, 0) / g.pcts.length);
    return {
      tenant_id: DEFAULT_TENANT,
      label: `Website sale: ${[g.brand, g.category].filter(Boolean).join(" ")} (~${avg}% off, ${g.pcts.length} item${g.pcts.length !== 1 ? "s" : ""})`,
      discount_type: "percent",
      discount_value: avg,
      applies_to_brand: g.brand,
      applies_to_category: g.category,
      starts_on: null,
      ends_on: null,
      active: true,
      source: "shopify",
      updated_at: now,
    };
  });

  if (dealRows.length) {
    const { error: dealError } = await db.from("deals").insert(dealRows);
    if (dealError) return { ok: false, message: `Deal insert failed: ${dealError.message}` };
  }

  const onSale = rows.filter((r) => r.sale_price != null).length;
  return {
    ok: true,
    message: `Synced ${rows.length} products (${onSale} on sale) and ${dealRows.length} website deals.`,
    productsSynced: rows.length,
    onSale,
    dealsCreated: dealRows.length,
  };
}
