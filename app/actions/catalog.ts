"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { DEFAULT_TENANT, type Client } from "@/lib/types";
import { todayStr } from "@/lib/dates";
import { parseCategory } from "@/lib/products";

/* Product & deals catalog — admin manages, owner can read (for deal
   suggestions). All access through the service-role client (RLS deny-by-
   default once migration 0003 runs). Every read tolerates the tables not
   existing yet. */

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  price: number;
  sale_price: number | null;
  active: boolean;
  source: "manual" | "shopify";
  shopify_handle: string | null;
}

export interface Deal {
  id: string;
  label: string;
  discount_type: "percent" | "amount";
  discount_value: number;
  applies_to_brand: string | null;
  applies_to_category: string | null;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  source: "manual" | "shopify";
}

export type ProductInput = Omit<Product, "id" | "source" | "shopify_handle"> & { id?: string };
export type DealInput = Omit<Deal, "id" | "source"> & { id?: string };

function catalogMissing(message: string): boolean {
  return /does not exist|relation .* not/i.test(message);
}

export async function getProducts(): Promise<{ products: Product[]; ready: boolean }> {
  await requireRole("admin", "owner");
  const { data, error } = await getSupabaseAdmin()
    .from("products")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("category")
    .order("price", { ascending: false });
  if (error) {
    if (catalogMissing(error.message)) return { products: [], ready: false };
    throw new Error(error.message);
  }
  return { products: (data ?? []) as Product[], ready: true };
}

export async function getDeals(): Promise<{ deals: Deal[]; ready: boolean }> {
  await requireRole("admin", "owner");
  const { data, error } = await getSupabaseAdmin()
    .from("deals")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("updated_at", { ascending: false });
  if (error) {
    if (catalogMissing(error.message)) return { deals: [], ready: false };
    throw new Error(error.message);
  }
  return { deals: (data ?? []) as Deal[], ready: true };
}

/** Deals valid today (active + within date window). Owner/admin. */
export async function getActiveDeals(): Promise<Deal[]> {
  const { deals } = await getDeals();
  const today = todayStr();
  return deals.filter(
    (d) =>
      d.active &&
      (!d.starts_on || d.starts_on <= today) &&
      (!d.ends_on || d.ends_on >= today)
  );
}

/* ── Best-deal suggestions for a client's calendar event ──────────────────
   Cross-references today's active deals against the event type and the
   client's purchase history. Admin/owner only (calendar is dashboard-side). */

export interface DealSuggestion {
  label: string;
  value: string; // "15% off" / "$50 off"
  reason: string;
}

const EVENT_CATEGORIES: Record<string, string[]> = {
  Wedding: ["Suit", "Tuxedo", "Accessories"],
  Prom: ["Suit", "Tuxedo"],
  Grad: ["Suit", "Dress Shirt"],
  Funeral: ["Suit"],
  Work: ["Suit", "Dress Shirt", "Sports Coat"],
  Other: [],
};

export async function getDealSuggestions(
  clientId: string,
  eventType: string
): Promise<{ suggestions: DealSuggestion[]; ready: boolean }> {
  await requireRole("admin", "owner");

  const { data: client } = await getSupabaseAdmin()
    .from("clients")
    .select("name, visits, events, measurements")
    .eq("id", clientId)
    .eq("tenant_id", DEFAULT_TENANT)
    .single();

  const { deals, ready } = await getDeals();
  if (!ready) return { suggestions: [], ready: false };

  const today = todayStr();
  const active = deals.filter(
    (d) =>
      d.active &&
      (!d.starts_on || d.starts_on <= today) &&
      (!d.ends_on || d.ends_on >= today)
  );
  if (!active.length) return { suggestions: [], ready: true };

  const visits = ((client as Pick<Client, "visits"> | null)?.visits ?? []) as Client["visits"];
  const historyText = visits.map((v) => v.items ?? "").join(" · ").toLowerCase();
  const historyCategories = new Set(
    visits.flatMap((v) => (v.items?.trim() ? [parseCategory(v.items)] : []))
  );
  const eventCategories = EVENT_CATEGORIES[eventType] ?? [];

  const fmtValue = (d: Deal) =>
    d.discount_type === "percent" ? `${d.discount_value}% off` : `$${d.discount_value} off`;

  const scored = active
    .map((d) => {
      let score = 0;
      const reasons: string[] = [];

      if (d.applies_to_category && eventCategories.includes(d.applies_to_category)) {
        score += 3;
        reasons.push(`fits an upcoming ${eventType.toLowerCase()}`);
      }
      if (d.applies_to_brand && historyText.includes(d.applies_to_brand.toLowerCase())) {
        score += 2;
        reasons.push(`they've bought ${d.applies_to_brand} before`);
      }
      if (d.applies_to_category && historyCategories.has(d.applies_to_category)) {
        score += 1;
        reasons.push(`matches their purchase history`);
      }
      if (!d.applies_to_brand && !d.applies_to_category) {
        score += 1;
        reasons.push("applies storewide");
      }

      return { deal: d, score, reasons };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return {
    ready: true,
    suggestions: scored.map((s) => ({
      label: s.deal.label,
      value: fmtValue(s.deal),
      reason: s.reasons.join("; "),
    })),
  };
}

export async function saveProduct(input: ProductInput): Promise<void> {
  await requireRole("admin");
  if (!input.name?.trim()) throw new Error("Product name is required");
  if (typeof input.price !== "number" || input.price < 0 || input.price > 100000)
    throw new Error("Price must be 0–100,000");
  if (input.sale_price != null && (input.sale_price < 0 || input.sale_price > input.price))
    throw new Error("Sale price must be below the regular price");

  const row = {
    tenant_id: DEFAULT_TENANT,
    name: input.name.trim(),
    brand: input.brand?.trim() || null,
    category: input.category?.trim() || "Other",
    price: input.price,
    sale_price: input.sale_price,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  };

  const db = getSupabaseAdmin();
  const { error } = input.id
    ? await db.from("products").update(row).eq("id", input.id).eq("tenant_id", DEFAULT_TENANT)
    : await db.from("products").insert({ ...row, source: "manual" });
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  await requireRole("admin");
  const { error } = await getSupabaseAdmin()
    .from("products")
    .delete()
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);
  if (error) throw new Error(error.message);
}

export async function saveDeal(input: DealInput): Promise<void> {
  await requireRole("admin");
  if (!input.label?.trim()) throw new Error("Deal label is required");
  if (input.discount_type !== "percent" && input.discount_type !== "amount")
    throw new Error("Discount type must be percent or amount");
  if (
    typeof input.discount_value !== "number" ||
    input.discount_value <= 0 ||
    (input.discount_type === "percent" && input.discount_value > 90)
  )
    throw new Error("Discount must be positive (percent capped at 90)");

  const row = {
    tenant_id: DEFAULT_TENANT,
    label: input.label.trim(),
    discount_type: input.discount_type,
    discount_value: input.discount_value,
    applies_to_brand: input.applies_to_brand?.trim() || null,
    applies_to_category: input.applies_to_category?.trim() || null,
    starts_on: input.starts_on || null,
    ends_on: input.ends_on || null,
    active: input.active ?? true,
    updated_at: new Date().toISOString(),
  };

  const db = getSupabaseAdmin();
  const { error } = input.id
    ? await db.from("deals").update(row).eq("id", input.id).eq("tenant_id", DEFAULT_TENANT)
    : await db.from("deals").insert({ ...row, source: "manual" });
  if (error) throw new Error(error.message);
}

export async function deleteDeal(id: string): Promise<void> {
  await requireRole("admin");
  const { error } = await getSupabaseAdmin()
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);
  if (error) throw new Error(error.message);
}
