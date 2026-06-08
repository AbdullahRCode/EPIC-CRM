"use client";

import { useState } from "react";
import { BRANCHES, type Branch } from "@/lib/types";

interface CompetitorData {
  name: string;
  type: string;
  price_range: string;
  promotions: string;
  strengths: string;
  weaknesses: string;
  threat_level: "High" | "Medium" | "Low";
}

interface BranchResult {
  branch: string;
  mall: string;
  competitors: CompetitorData[];
  owner_note: string;
  generated_at: string;
}

interface Props {
  ownerMode: boolean;
  activeBranch: Branch | "All";
}

const THREAT_COLORS: Record<string, string> = {
  High: "var(--danger)",
  Medium: "var(--warn)",
  Low: "var(--good)",
};

export default function CompetitorIntel({ ownerMode }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BranchResult[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<Branch | "All">("All");
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  if (!ownerMode) return null;

  async function fetchIntel() {
    setLoading(true);
    setError("");
    try {
      const branch = selectedBranch === "All" ? "all" : selectedBranch;
      const res = await fetch(`/api/competitor?branch=${encodeURIComponent(branch)}`);
      const json = await res.json();
      if (res.status === 429) { setError(json.error ?? "Rate limit reached."); return; }
      if (!res.ok) { setError(json.error ?? "Failed to fetch."); return; }
      setResults(json.results ?? []);
      setGeneratedAt(json.generated_at ?? null);
      setRemaining(json.generations_remaining ?? null);
      setExpandedBranch((json.results?.[0]?.branch) ?? null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const displayResults = results
    ? selectedBranch === "All" ? results : results.filter((r) => r.branch === selectedBranch)
    : null;

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: "2rem" }}>

      {/* Section header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 0", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div>
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1rem", color: "var(--ink)" }}>Market Intelligence</p>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.15rem", fontSize: "0.55rem" }}>
            Local competitor analysis · All 6 branches · {remaining !== null ? `${remaining} scan${remaining !== 1 ? "s" : ""} remaining this week` : "Max 2 scans/week"}
          </p>
        </div>
        <span style={{ color: "var(--muted)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ paddingBottom: "2rem" }}>

          {/* Controls */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center", marginBottom: "1.5rem" }}>
            <select
              className="input-line"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value as Branch | "All")}
              style={{ fontSize: "0.7rem", minWidth: "10rem" }}
            >
              <option value="All">All Branches</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>

            <button
              className="btn btn-primary"
              onClick={fetchIntel}
              disabled={loading}
              style={{ fontSize: "0.6rem", letterSpacing: "0.15em" }}
            >
              {loading ? "Scanning..." : "↻ Generate Report"}
            </button>

            {generatedAt && (
              <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginLeft: "auto" }}>
                Last scan: {new Date(generatedAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: "0.75rem 1rem", background: "var(--paper-2)", border: "1px solid var(--line)", marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--warn)" }}>{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1.1rem", color: "var(--muted)" }}>
                Scanning competitors across {selectedBranch === "All" ? "all 6 branches" : selectedBranch}...
              </p>
              <p className="label" style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.55rem" }}>
                Running deep intelligence scan — 30–90 seconds
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && displayResults && displayResults.map((branchResult) => (
            <div key={branchResult.branch} style={{ marginBottom: "1.5rem", border: "1px solid var(--line)" }}>

              {/* Branch tab header */}
              <button
                onClick={() => setExpandedBranch(expandedBranch === branchResult.branch ? null : branchResult.branch)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "1rem 1.25rem", background: "var(--paper-2)", border: "none", cursor: "pointer",
                  borderBottom: expandedBranch === branchResult.branch ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "1rem" }}>
                  <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink)" }}>
                    {branchResult.branch}
                  </p>
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>{branchResult.mall}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {(["High", "Medium", "Low"] as const).map((level) => {
                    const count = branchResult.competitors.filter((c) => c.threat_level === level).length;
                    if (!count) return null;
                    return (
                      <span key={level} style={{
                        fontFamily: "var(--font-outfit)", fontSize: "0.5rem", letterSpacing: "0.1em",
                        textTransform: "uppercase", color: THREAT_COLORS[level], fontWeight: 600,
                      }}>
                        {count} {level}
                      </span>
                    );
                  })}
                  <span style={{ color: "var(--muted)", fontSize: "0.7rem" }}>{expandedBranch === branchResult.branch ? "▾" : "▸"}</span>
                </div>
              </button>

              {expandedBranch === branchResult.branch && (
                <div>
                  {/* Owner's Strategic Note */}
                  {branchResult.owner_note && (
                    <div style={{ padding: "1.25rem 1.5rem", background: "var(--ink)", borderBottom: "1px solid var(--line)" }}>
                      <p style={{
                        fontFamily: "var(--font-outfit)", fontSize: "0.5rem", letterSpacing: "0.2em",
                        textTransform: "uppercase", color: "var(--vip)", marginBottom: "0.6rem",
                      }}>
                        ✦ Owner&apos;s Strategic Note
                      </p>
                      <p style={{
                        fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic",
                        fontSize: "0.95rem", color: "var(--paper)", lineHeight: 1.7,
                      }}>
                        {branchResult.owner_note}
                      </p>
                    </div>
                  )}

                  {/* Competitor cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 0 }}>
                    {branchResult.competitors.map((comp) => (
                      <div key={comp.name} style={{ borderRight: "1px solid var(--line)", borderBottom: "1px solid var(--line)", padding: "1.25rem" }}>

                        {/* Header */}
                        <div style={{ marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.75rem", fontWeight: 600, color: "var(--ink)" }}>{comp.name}</p>
                            <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginTop: "0.1rem" }}>{comp.type}</p>
                          </div>
                          <span style={{
                            fontFamily: "var(--font-outfit)", fontSize: "0.5rem", letterSpacing: "0.1em",
                            textTransform: "uppercase", color: THREAT_COLORS[comp.threat_level],
                            fontWeight: 600, flexShrink: 0, marginLeft: "0.5rem",
                          }}>
                            {comp.threat_level}
                          </span>
                        </div>

                        {/* Price range */}
                        <div style={{ marginBottom: "0.75rem" }}>
                          <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginBottom: "0.2rem" }}>PRICE RANGE</p>
                          <p style={{ fontSize: "0.85rem", color: "var(--ink)", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>{comp.price_range}</p>
                        </div>

                        {/* Promotions */}
                        <div style={{ marginBottom: "0.75rem" }}>
                          <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginBottom: "0.2rem" }}>PROMOTIONS</p>
                          <p style={{
                            fontSize: "0.75rem", lineHeight: 1.5,
                            color: comp.promotions === "No active promotions found" ? "var(--muted)" : "var(--warn)",
                            fontFamily: "var(--font-outfit)",
                          }}>{comp.promotions}</p>
                        </div>

                        {/* Strengths */}
                        <div style={{ marginBottom: "0.75rem" }}>
                          <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginBottom: "0.2rem" }}>THEIR STRENGTHS</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--ink)", fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>{comp.strengths}</p>
                        </div>

                        {/* Weaknesses */}
                        <div>
                          <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginBottom: "0.2rem" }}>EXPLOIT THIS</p>
                          <p style={{ fontSize: "0.75rem", color: "var(--good)", fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>{comp.weaknesses}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Empty state */}
          {!loading && !displayResults && !error && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "1rem" }}>
                Select a branch and generate your competitive intelligence report.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
