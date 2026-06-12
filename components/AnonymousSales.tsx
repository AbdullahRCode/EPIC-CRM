"use client";

import { useState, useEffect, useCallback } from "react";
import { getAnonymousSales, addAnonymousSale, deleteAnonymousSale, type AnonymousSale } from "@/app/actions/anonymous";
import { BRANCHES, type Branch } from "@/lib/types";
import { todayStr as localToday } from "@/lib/dates";

interface Props {
  ownerMode: boolean;
  branch: Branch | "All";
  employeeBranch?: string;
}

interface SaleItem {
  item: string;
  amount: number;
}

export default function AnonymousSales({ ownerMode, branch, employeeBranch }: Props) {
  const [open, setOpen] = useState(false);
  const [sales, setSales] = useState<AnonymousSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterDate, setFilterDate] = useState(localToday());

  const defaultBranch = (employeeBranch ?? (branch === "All" ? BRANCHES[0] : branch)) as Branch;

  const [form, setForm] = useState({
    branch: defaultBranch,
    items: [{ item: "", amount: 0 }] as SaleItem[],
    staff: "",
    notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAnonymousSales(
        branch === "All" ? undefined : branch,
        filterDate || undefined
      );
      setSales(data);
    } finally {
      setLoading(false);
    }
  }, [branch, filterDate]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { item: "", amount: 0 }] }));
  }

  function updateItem(index: number, field: keyof SaleItem, value: string | number) {
    setForm((f) => {
      const items = [...f.items];
      items[index] = { ...items[index], [field]: value };
      return { ...f, items };
    });
  }

  function removeItem(index: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    const validItems = form.items.filter((i) => i.item.trim() && parseFloat(String(i.amount)) > 0);
    if (!validItems.length) return;
    setSaving(true);
    try {
      await addAnonymousSale({
        branch: form.branch,
        items: validItems,
        staff: form.staff || undefined,
        notes: form.notes || undefined,
      });
      setForm({
        branch: form.branch,
        items: [{ item: "", amount: 0 }],
        staff: "",
        notes: "",
      });
      setShowForm(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this sale entry?")) return;
    await deleteAnonymousSale(id);
    load();
  }

  const totalRevenue = sales.reduce((s, sale) => s + (sale.total_amount ?? 0), 0);
  const todayStr = localToday();
  const todaySales = sales.filter((s) => s.sale_date === todayStr);
  const todayRevenue = todaySales.reduce((s, sale) => s + (sale.total_amount ?? 0), 0);

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: "1rem" }}>

      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "1.25rem 0",
          background: "none", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <div>
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1rem", color: "var(--ink)" }}>
            Anonymous Sales
          </p>
          <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", marginTop: "0.15rem" }}>
            Walk-in purchases with no client info · Revenue still tracked
          </p>
        </div>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ paddingBottom: "2rem" }}>

          {/* Stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 0, marginBottom: "1.25rem",
          }}>
            {[
              { label: "Today's sales", value: todaySales.length },
              { label: "Today's revenue", value: `$${todayRevenue.toLocaleString()}` },
              { label: `Total (${filterDate ? "filtered" : "all"})`, value: `$${totalRevenue.toLocaleString()}` },
            ].map((stat, i) => (
              <div key={stat.label} style={{
                border: "1px solid var(--line)",
                borderLeft: i === 0 ? "1px solid var(--line)" : "none",
                padding: "0.875rem 1rem",
              }}>
                <p style={{
                  fontFamily: "var(--font-serif)", fontStyle: "italic",
                  fontSize: "1.4rem", color: "var(--ink)", lineHeight: 1,
                }}>
                  {stat.value}
                </p>
                <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginTop: "0.2rem" }}>
                  {stat.label.toUpperCase()}
                </p>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1rem" }}>
            <input
              className="input-line"
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ fontSize: "0.75rem" }}
            />
            <button
              className="btn btn-ghost"
              onClick={() => setFilterDate("")}
              style={{ fontSize: "0.6rem" }}
            >
              All dates
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm((s) => !s)}
              style={{ fontSize: "0.6rem", letterSpacing: "0.15em", marginLeft: "auto" }}
            >
              + Log Anonymous Sale
            </button>
          </div>

          {/* Add sale form */}
          {showForm && (
            <div style={{
              border: "1px solid var(--line)",
              padding: "1.25rem",
              marginBottom: "1.25rem",
              background: "var(--paper-2)",
            }}>
              <p className="label" style={{ color: "var(--ink)", marginBottom: "1rem", fontSize: "0.6rem" }}>
                NEW ANONYMOUS SALE
              </p>

              {/* Branch — only if owner */}
              {ownerMode && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Branch</label>
                  <select
                    className="input-line"
                    value={form.branch}
                    onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}
                    style={{ fontSize: "0.75rem" }}
                  >
                    {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}

              {/* Items */}
              <div style={{ marginBottom: "0.75rem" }}>
                <label className="label" style={{ display: "block", marginBottom: "0.5rem", color: "var(--muted)", fontSize: "0.55rem" }}>Items sold</label>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", alignItems: "center" }}>
                    <input
                      className="input-line"
                      placeholder="Item (e.g. Carlo Lusso black suit)"
                      value={item.item}
                      onChange={(e) => updateItem(i, "item", e.target.value)}
                      style={{ flex: 2, fontSize: "0.8rem" }}
                    />
                    <input
                      className="input-line"
                      type="number"
                      placeholder="$"
                      value={item.amount || ""}
                      onChange={(e) => updateItem(i, "amount", parseFloat(e.target.value) || 0)}
                      style={{ flex: 1, fontSize: "0.8rem" }}
                    />
                    {form.items.length > 1 && (
                      <button
                        onClick={() => removeItem(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1rem", padding: "0 0.25rem" }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  className="btn btn-ghost"
                  onClick={addItem}
                  style={{ fontSize: "0.6rem", marginTop: "0.25rem" }}
                >
                  + Add item
                </button>
              </div>

              {/* Staff + notes */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Staff name</label>
                  <input
                    className="input-line"
                    placeholder="Who made the sale?"
                    value={form.staff}
                    onChange={(e) => setForm((f) => ({ ...f, staff: e.target.value }))}
                    style={{ fontSize: "0.8rem" }}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Notes (optional)</label>
                  <input
                    className="input-line"
                    placeholder="Any extra notes"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    style={{ fontSize: "0.8rem" }}
                  />
                </div>
              </div>

              {/* Total preview */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>TOTAL</p>
                <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1.2rem", color: "var(--ink)" }}>
                  ${form.items.reduce((s, i) => s + (i.amount || 0), 0).toFixed(2)}
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: "0.6rem" }}>
                  {saving ? "Saving..." : "Save Sale"}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)} style={{ fontSize: "0.6rem" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Sales list */}
          {loading ? (
            <p className="label" style={{ color: "var(--muted)", padding: "1rem 0" }}>Loading...</p>
          ) : sales.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic", padding: "1rem 0" }}>
              No anonymous sales logged{filterDate ? ` for ${new Date(filterDate + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}` : ""}.
            </p>
          ) : (
            <div>
              {sales.map((sale) => (
                <div
                  key={sale.id}
                  style={{
                    borderBottom: "1px solid var(--line)",
                    padding: "0.875rem 0",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "1rem",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.3rem" }}>
                      <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.75rem", color: "var(--muted)" }}>
                        Anonymous
                      </p>
                      <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                        {sale.branch}
                      </span>
                      <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                        {new Date(sale.sale_date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                      </span>
                      {sale.staff && (
                        <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                          {sale.staff}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {(sale.items as SaleItem[]).map((item, i) => (
                        <span key={i} style={{
                          fontSize: "0.72rem", color: "var(--ink)",
                          fontFamily: "var(--font-outfit)",
                          background: "var(--paper-2)",
                          border: "1px solid var(--line)",
                          padding: "0.15rem 0.5rem",
                        }}>
                          {item.item} · ${item.amount}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexShrink: 0 }}>
                    <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1rem", color: "var(--ink)" }}>
                      ${sale.total_amount}
                    </p>
                    {ownerMode && (
                      <button
                        onClick={() => handleDelete(sale.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.7rem", padding: "0.25rem" }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
