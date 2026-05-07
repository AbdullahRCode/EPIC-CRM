"use client";

import { useState } from "react";
import type { DailySummaryData } from "@/lib/types";

interface DailySummaryProps {
  ownerMode: boolean;
}

export default function DailySummary({ ownerMode }: DailySummaryProps) {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [branchOpen, setBranchOpen] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/summary", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Summary generation failed.");
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — check server logs.");
    } finally {
      setLoading(false);
    }
  }

  const urgencyColor = (u: "high" | "medium" | "low") =>
    u === "high" ? "var(--danger)" : u === "medium" ? "var(--warn)" : "var(--muted)";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <p className="section-title" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: 0 }}>
          Daily <em>summary</em>
        </p>
        <button
          onClick={generate}
          className="btn btn-ghost"
          disabled={loading}
        >
          {loading ? "Generating..." : data ? "↺ Refresh" : "Generate"}
        </button>
      </div>

      <div style={{ borderBottom: "1px solid var(--line)" }} />

      {error && (
        <p className="label" style={{ color: "var(--danger)" }}>{error}</p>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "1rem" }}>
            No summary yet
          </p>
          <p className="label" style={{ color: "var(--muted)" }}>
            Generate a structured AI briefing of today&apos;s activity
          </p>
          <button onClick={generate} className="btn btn-primary">Generate summary</button>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center">
          <span className="label" style={{ color: "var(--muted)" }}>Analysing branch activity...</span>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-6">
          {/* Today summary */}
          <div>
            <p className="label mb-2">Today</p>
            <p style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>{data.today_summary}</p>
          </div>

          {/* Action items */}
          {data.action_items?.length > 0 && (
            <div>
              <p className="label mb-3">Action items</p>
              <div className="flex flex-col gap-2">
                {data.action_items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: "1px solid var(--line)" }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: urgencyColor(item.urgency),
                        flexShrink: 0,
                        marginTop: 6,
                      }}
                    />
                    <p style={{ fontSize: "0.85rem", flex: 1 }}>{item.label}</p>
                    <span className="label" style={{ color: urgencyColor(item.urgency), fontSize: "0.55rem", flexShrink: 0 }}>
                      {item.urgency}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Branch breakdown — collapsible */}
          {data.branch_reads?.length > 0 && (
            <div>
              <button
                onClick={() => setBranchOpen((o) => !o)}
                className="flex items-center justify-between w-full"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                <p className="label" style={{ color: "var(--ink)" }}>Branch breakdown</p>
                <span className="label" style={{ color: "var(--muted)" }}>
                  {branchOpen ? "▲" : "▼"}
                </span>
              </button>
              {branchOpen && (
                <div className="flex flex-col gap-3 mt-3 fade-in">
                  {data.branch_reads.map((br, i) => (
                    <div
                      key={i}
                      className="py-3"
                      style={{ borderBottom: "1px solid var(--line)" }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="label" style={{ color: "var(--ink)" }}>{br.branch}</span>
                        {br.highlight && (
                          <span className="label" style={{ color: "var(--vip)", fontSize: "0.55rem" }}>
                            {br.highlight}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{br.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tomorrow outlook — gold accent */}
          <div
            className="p-4"
            style={{ borderLeft: "3px solid var(--vip)", background: "#d4ad5308" }}
          >
            <p className="label mb-2" style={{ color: "var(--vip)" }}>Tomorrow&apos;s outlook</p>
            <p style={{ fontSize: "0.85rem" }}>{data.tomorrow_outlook}</p>
          </div>

          {/* Owner-only: weekly target + trend */}
          {ownerMode && (
            <>
              <div
                className="p-4"
                style={{ borderLeft: "3px solid var(--good)", background: "#1f5a3208" }}
              >
                <p className="label mb-1" style={{ color: "var(--good)" }}>Weekly target</p>
                <p style={{ fontSize: "0.9rem", fontWeight: 500, marginBottom: "0.25rem" }}>
                  {data.weekly_target?.goal}
                </p>
                <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  {data.weekly_target?.rationale}
                </p>
              </div>

              <div>
                <p className="label mb-2">Trend observation</p>
                <p style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--muted)" }}>
                  {data.trend_observation}
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
