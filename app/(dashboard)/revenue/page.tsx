"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getRevenueIntelligence, type RevenueIntelligence } from "@/app/actions/revenue";
import { useBranchOwner } from "@/lib/branch-context";
import CountUp from "@/components/CountUp";

/* Revenue Intelligence — admin/owner only. The server action enforces the
   role; this page just renders (employees never reach the dashboard at all). */

export default function RevenuePage() {
  const { role } = useBranchOwner();
  const [data, setData] = useState<RevenueIntelligence | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getRevenueIntelligence()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"));
  }, []);

  const fmtWeek = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

  const delta = (now: number, prev: number) => {
    if (prev === 0) return now > 0 ? "new" : "—";
    const pct = Math.round(((now - prev) / prev) * 100);
    return `${pct > 0 ? "+" : ""}${pct}%`;
  };

  const deltaColor = (now: number, prev: number) =>
    now >= prev ? "var(--good)" : "var(--danger)";

  const maxWeekly = data ? Math.max(1, ...data.weekly.map((w) => w.revenue)) : 1;

  return (
    <div className="overflow-y-auto lb-page" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-4 sm:px-6 pt-5 pb-3 page-band">
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Revenue</em>
        </h1>
        <p className="label mt-1">
          Revenue intelligence · all branches · {role === "admin" ? "admin" : "owner"} view
        </p>
      </div>

      {error && (
        <p className="label px-6 py-8" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {!data && !error && (
        <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel-row flex items-center px-4" style={{ border: "1px solid var(--line)" }}>
              <div className="skel-bar" style={{ width: `${30 + i * 15}%` }} />
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="px-4 sm:px-6 py-5 flex flex-col gap-7" style={{ maxWidth: 960 }}>

          {/* Period comparison */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 lb-card" style={{ margin: 0 }}>
            {[
              { label: "This week", value: data.thisWeek, prev: data.lastWeek },
              { label: "Last week", value: data.lastWeek },
              { label: "This month", value: data.thisMonth, prev: data.lastMonth },
              { label: "Last month", value: data.lastMonth },
            ].map((s) => (
              <div key={s.label} style={{ padding: "1.25rem 1rem", borderRight: "1px solid var(--line)" }}>
                <CountUp
                  className="stat-num"
                  prefix="$"
                  value={s.value}
                />
                {s.prev !== undefined && (
                  <span className="label" style={{ marginLeft: "0.5rem", fontSize: "0.55rem", color: deltaColor(s.value, s.prev) }}>
                    {delta(s.value, s.prev)}
                  </span>
                )}
                <p className="label" style={{ fontSize: "0.55rem", marginTop: "0.35rem" }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* 8-week trend */}
          <div>
            <p className="section-title">Eight-week trend</p>
            <div className="lb-card flex items-end gap-2 px-4 pt-6 pb-2" style={{ margin: 0, height: 180 }}>
              {data.weekly.map((w) => (
                <div key={w.weekStart} className="flex flex-col items-center gap-1" style={{ flex: 1, minWidth: 0 }}>
                  <span className="label" style={{ fontSize: "0.5rem" }}>
                    {w.revenue > 0 ? `$${Math.round(w.revenue / 100) / 10}k` : ""}
                  </span>
                  <div
                    style={{
                      width: "60%",
                      height: Math.max(2, (w.revenue / maxWeekly) * 110),
                      background: "var(--ink)",
                      opacity: w.revenue === 0 ? 0.15 : 0.85,
                      transition: "height 0.4s ease",
                    }}
                  />
                  <span className="label" style={{ fontSize: "0.45rem", whiteSpace: "nowrap" }}>{fmtWeek(w.weekStart)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Branch breakdown */}
          <div>
            <p className="section-title">Revenue by branch</p>
            <div className="scroll-list" style={{ maxHeight: 280 }}>
              {data.byBranch.map((b, i) => (
                <div key={b.branch} className="flex items-center justify-between px-4 py-3 lb-row" style={{ borderBottom: "1px solid var(--line)" }}>
                  <div>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink)" }}>
                      {i === 0 && <span style={{ color: "var(--vip)", marginRight: "0.3rem" }}>✦</span>}
                      {b.branch}
                    </p>
                    <p className="label" style={{ fontSize: "0.5rem" }}>{b.sales} sale{b.sales !== 1 ? "s" : ""}</p>
                  </div>
                  <CountUp className="stat-num" prefix="$" value={b.revenue} />
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <p className="section-title">Revenue by category</p>
            {data.byCategory.length === 0 ? (
              <p className="label">No itemised sales yet — log items on visits and walk-in sales.</p>
            ) : (
              <div className="scroll-rail">
                {data.byCategory.map((c, i) => (
                  <div key={c.category} style={{ padding: "1rem", borderTop: i === 0 ? "2px solid var(--vip)" : "2px solid transparent", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <p className="font-serif" style={{ fontSize: "0.95rem", fontStyle: "italic" }}>{c.category}</p>
                    <p className="stat-num" style={{ fontSize: "1.3rem", lineHeight: 1 }}>${c.revenue.toLocaleString()}</p>
                    <p className="label" style={{ fontSize: "0.5rem", marginTop: "auto", paddingTop: "0.4rem" }}>
                      {c.sales} sale{c.sales !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top products */}
          <div>
            <p className="section-title">Top products</p>
            {data.topProducts.length === 0 ? (
              <p className="label">No itemised sales yet.</p>
            ) : (
              <div className="scroll-list" style={{ maxHeight: 320 }}>
                {data.topProducts.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between gap-3 px-4 py-3 lb-row" style={{ borderBottom: "1px solid var(--line)" }}>
                    <div className="min-w-0">
                      <p className="truncate" style={{ fontSize: "0.85rem", color: "var(--ink)", textTransform: "capitalize" }}>
                        {i === 0 && <span style={{ color: "var(--vip)", marginRight: "0.3rem" }}>✦</span>}
                        {p.name}
                      </p>
                      <p className="label" style={{ fontSize: "0.5rem" }}>{p.sales} sale{p.sales !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="stat-num" style={{ flexShrink: 0 }}>${p.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top staff */}
          <div>
            <p className="section-title">Top salespeople</p>
            {data.topStaff.length === 0 ? (
              <p className="label">Log staff names on visits and walk-in sales to build this ranking.</p>
            ) : (
              <div className="scroll-list" style={{ maxHeight: 320 }}>
                {data.topStaff.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 px-4 py-3 lb-row" style={{ borderBottom: "1px solid var(--line)" }}>
                    <div>
                      <p style={{ fontSize: "0.85rem", color: "var(--ink)", textTransform: "capitalize" }}>
                        {i === 0 && <span style={{ color: "var(--vip)", marginRight: "0.3rem" }}>✦</span>}
                        {s.name}
                      </p>
                      <p className="label" style={{ fontSize: "0.5rem" }}>{s.sales} sale{s.sales !== 1 ? "s" : ""}</p>
                    </div>
                    <CountUp className="stat-num" prefix="$" value={s.revenue} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Lifetime line */}
          <p className="label" style={{ fontSize: "0.55rem", paddingBottom: "1.5rem" }}>
            All-time: <span className="stat-num">${data.totalRevenue.toLocaleString()}</span> across{" "}
            <span className="stat-num">{data.totalSales.toLocaleString()}</span> recorded sales
          </p>
        </div>
      )}
    </div>
  );
}
