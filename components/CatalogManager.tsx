"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getProducts,
  getDeals,
  saveProduct,
  deleteProduct,
  saveDeal,
  deleteDeal,
  type Product,
  type Deal,
  type ProductInput,
  type DealInput,
} from "@/app/actions/catalog";
import { syncShopifyCatalog } from "@/app/actions/shopify-sync";

/* Admin-only product & deals catalog manager (rendered inside Settings,
   which middleware already restricts to admins; every action re-checks
   the role server-side). */

const CATEGORIES = ["Suit", "Sports Coat", "Dress Shirt", "Tuxedo", "Footwear", "Accessories", "Other"];

const emptyProduct: ProductInput = {
  name: "",
  brand: "",
  category: "Suit",
  price: 0,
  sale_price: null,
  active: true,
};

const emptyDeal: DealInput = {
  label: "",
  discount_type: "percent",
  discount_value: 10,
  applies_to_brand: null,
  applies_to_category: null,
  starts_on: null,
  ends_on: null,
  active: true,
};

export default function CatalogManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [productForm, setProductForm] = useState<ProductInput | null>(null);
  const [dealForm, setDealForm] = useState<DealInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  async function runShopifySync() {
    setSyncing(true);
    setSyncMsg("");
    try {
      const result = await syncShopifyCatalog();
      setSyncMsg(result.message);
      if (result.ok) await load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [p, d] = await Promise.all([getProducts(), getDeals()]);
      setProducts(p.products);
      setDeals(d.deals);
      setReady(p.ready && d.ready);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitProduct() {
    if (!productForm) return;
    setSaving(true);
    setError("");
    try {
      await saveProduct(productForm);
      setProductForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitDeal() {
    if (!dealForm) return;
    setSaving(true);
    setError("");
    try {
      await saveDeal(dealForm);
      setDealForm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="label" style={{ fontSize: "0.6rem" }}>Loading catalog…</p>;

  if (!ready) {
    return (
      <div style={{ border: "1px solid var(--warn)", background: "#8a5a1f0d", padding: "1rem" }}>
        <p className="label" style={{ color: "var(--warn)", fontSize: "0.6rem" }}>
          Catalog tables not found — run supabase/migrations/0003_products_deals.sql, then reload.
        </p>
      </div>
    );
  }

  const dealScope = (d: Deal) =>
    [d.applies_to_brand, d.applies_to_category].filter(Boolean).join(" · ") || "Everything";

  const dealValue = (d: Deal) =>
    d.discount_type === "percent" ? `${d.discount_value}% off` : `$${d.discount_value} off`;

  return (
    <div className="flex flex-col gap-8">
      {/* Shopify sync — manual trigger; review results before any cron */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="btn" style={{ fontSize: "0.6rem" }} disabled={syncing} onClick={runShopifySync}>
          {syncing ? "Syncing from epicmenswear.ca…" : "↻ Sync from Shopify"}
        </button>
        {syncMsg && (
          <span className="label" style={{ fontSize: "0.55rem", color: syncMsg.startsWith("Synced") ? "var(--good)" : "var(--warn)" }}>
            {syncMsg}
          </span>
        )}
      </div>

      {error && <p className="label" style={{ color: "var(--danger)", fontSize: "0.6rem" }}>{error}</p>}

      {/* ── Products ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="label" style={{ color: "var(--ink)" }}>Products ({products.length})</p>
          <button className="btn btn-ghost" style={{ fontSize: "0.6rem" }} onClick={() => setProductForm({ ...emptyProduct })}>
            + Add product
          </button>
        </div>

        {productForm && (
          <div className="flex flex-col gap-3 p-4 mb-3" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
            <input className="input-line" placeholder="Product name *" value={productForm.name}
              onChange={(e) => setProductForm((f) => f && { ...f, name: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <input className="input-line" placeholder="Brand" value={productForm.brand ?? ""}
                onChange={(e) => setProductForm((f) => f && { ...f, brand: e.target.value })} />
              <select className="input-line" value={productForm.category}
                onChange={(e) => setProductForm((f) => f && { ...f, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input className="input-line" type="number" placeholder="Price *" value={productForm.price || ""}
                onChange={(e) => setProductForm((f) => f && { ...f, price: Number(e.target.value) })} />
              <input className="input-line" type="number" placeholder="Sale price (optional)" value={productForm.sale_price ?? ""}
                onChange={(e) => setProductForm((f) => f && { ...f, sale_price: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 label" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={productForm.active}
                onChange={(e) => setProductForm((f) => f && { ...f, active: e.target.checked })}
                style={{ accentColor: "var(--ink)" }} />
              Active
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" style={{ fontSize: "0.6rem" }} disabled={saving} onClick={submitProduct}>
                {saving ? "Saving…" : productForm.id ? "Save changes" : "Add product"}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "0.6rem" }} onClick={() => setProductForm(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="scroll-list" style={{ maxHeight: 360 }}>
          {products.length === 0 && (
            <p className="label px-4 py-4" style={{ fontSize: "0.6rem" }}>No products yet — seed via migration 0003 or add manually.</p>
          )}
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line)", opacity: p.active ? 1 : 0.45 }}>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{p.name}</p>
                <p className="label" style={{ fontSize: "0.5rem" }}>
                  {[p.brand, p.category].filter(Boolean).join(" · ")} ·{" "}
                  <span style={{ color: p.source === "shopify" ? "var(--good)" : "var(--muted)" }}>{p.source}</span>
                  {!p.active && " · inactive"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="stat-num">
                  {p.sale_price != null ? (
                    <>
                      <span style={{ textDecoration: "line-through", opacity: 0.5, marginRight: "0.4rem" }}>${p.price}</span>
                      <span style={{ color: "var(--good)" }}>${p.sale_price}</span>
                    </>
                  ) : (
                    <>${p.price}</>
                  )}
                </span>
                <button className="label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem" }}
                  onClick={() => setProductForm({ id: p.id, name: p.name, brand: p.brand ?? "", category: p.category, price: p.price, sale_price: p.sale_price, active: p.active })}>
                  Edit
                </button>
                <button className="label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.55rem" }}
                  onClick={async () => { if (confirm(`Delete "${p.name}"?`)) { await deleteProduct(p.id); load(); } }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Deals ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="label" style={{ color: "var(--ink)" }}>Deals ({deals.length})</p>
          <button className="btn btn-ghost" style={{ fontSize: "0.6rem" }} onClick={() => setDealForm({ ...emptyDeal })}>
            + Add deal
          </button>
        </div>

        {dealForm && (
          <div className="flex flex-col gap-3 p-4 mb-3" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
            <input className="input-line" placeholder="Deal label * (e.g. Wedding season — 15% off suits)" value={dealForm.label}
              onChange={(e) => setDealForm((f) => f && { ...f, label: e.target.value })} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <select className="input-line" value={dealForm.discount_type}
                onChange={(e) => setDealForm((f) => f && { ...f, discount_type: e.target.value as "percent" | "amount" })}>
                <option value="percent">% off</option>
                <option value="amount">$ off</option>
              </select>
              <input className="input-line" type="number" placeholder="Value *" value={dealForm.discount_value || ""}
                onChange={(e) => setDealForm((f) => f && { ...f, discount_value: Number(e.target.value) })} />
              <input className="input-line" placeholder="Brand (blank = any)" value={dealForm.applies_to_brand ?? ""}
                onChange={(e) => setDealForm((f) => f && { ...f, applies_to_brand: e.target.value || null })} />
              <select className="input-line" value={dealForm.applies_to_category ?? ""}
                onChange={(e) => setDealForm((f) => f && { ...f, applies_to_category: e.target.value || null })}>
                <option value="">Any category</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <div>
                <p className="label" style={{ fontSize: "0.5rem", marginBottom: "0.2rem" }}>Starts</p>
                <input className="input-line" type="date" value={dealForm.starts_on ?? ""}
                  onChange={(e) => setDealForm((f) => f && { ...f, starts_on: e.target.value || null })} />
              </div>
              <div>
                <p className="label" style={{ fontSize: "0.5rem", marginBottom: "0.2rem" }}>Ends</p>
                <input className="input-line" type="date" value={dealForm.ends_on ?? ""}
                  onChange={(e) => setDealForm((f) => f && { ...f, ends_on: e.target.value || null })} />
              </div>
            </div>
            <label className="flex items-center gap-2 label" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={dealForm.active}
                onChange={(e) => setDealForm((f) => f && { ...f, active: e.target.checked })}
                style={{ accentColor: "var(--ink)" }} />
              Active
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary" style={{ fontSize: "0.6rem" }} disabled={saving} onClick={submitDeal}>
                {saving ? "Saving…" : dealForm.id ? "Save changes" : "Add deal"}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: "0.6rem" }} onClick={() => setDealForm(null)}>Cancel</button>
            </div>
          </div>
        )}

        <div className="scroll-list" style={{ maxHeight: 300 }}>
          {deals.length === 0 && (
            <p className="label px-4 py-4" style={{ fontSize: "0.6rem" }}>No deals yet.</p>
          )}
          {deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--line)", opacity: d.active ? 1 : 0.45 }}>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{d.label}</p>
                <p className="label" style={{ fontSize: "0.5rem" }}>
                  {dealScope(d)}
                  {d.starts_on || d.ends_on ? ` · ${d.starts_on ?? "…"} → ${d.ends_on ?? "…"}` : " · always on"}
                  {" · "}
                  <span style={{ color: d.source === "shopify" ? "var(--good)" : "var(--muted)" }}>{d.source}</span>
                  {!d.active && " · inactive"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="stat-num" style={{ color: "var(--good)" }}>{dealValue(d)}</span>
                <button className="label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem" }}
                  onClick={() => setDealForm({ id: d.id, label: d.label, discount_type: d.discount_type, discount_value: d.discount_value, applies_to_brand: d.applies_to_brand, applies_to_category: d.applies_to_category, starts_on: d.starts_on, ends_on: d.ends_on, active: d.active })}>
                  Edit
                </button>
                <button className="label" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.55rem" }}
                  onClick={async () => { if (confirm(`Delete "${d.label}"?`)) { await deleteDeal(d.id); load(); } }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
