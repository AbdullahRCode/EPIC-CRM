"use client";

import { useState } from "react";
import { BRANCHES, type Branch } from "@/lib/types";

interface CompetitorData {
  name: string;
  type: string;
  location: string;
  promotions?: string;
  price_range?: string;
  social_activity?: string;
  notable?: string;
  error?: boolean;
}

interface BranchResult {
  branch: string;
  mall: string;
  competitors: CompetitorData[];
  generated_at: string;
}

interface CompetitorIntelProps {
  ownerMode: boolean;
  activeBranch: Branch | "All";
}

export default function CompetitorIntel({ ownerMode, activeBranch }: CompetitorIntelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BranchResult[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [selectedBranch, setSelectedBranch] = useState<Branch | "All">(
    activeBranch === "All" ? "All" : activeBranch
  );

  if (!ownerMode) return null;

  async function fetchIntel() {
    setLoading(true);
    setError("");
    try {
      const branch = selectedBranch === "All" ? "all" : selectedBranch;
      const res = await fetch(`/api/competitor?branch=${encodeURIComponent(branch)}`);
      const json = await res.json();

      if (res.status === 429) {
        setError(json.error ?? "Rate limit reached.");
        return;
      }

      if (!res.ok) {
        setError(json.error ?? "Failed to fetch competitor data.");
        return;
      }

      setResults(json.results ?? []);
      setGeneratedAt(json.generated_at ?? null);
      setRemaining(json.generations_remaining ?? null);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-CA", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  const displayResults = results
    ? selectedBranch === "All"
      ? results
      : results.filter((r) => r.branch === selectedBranch)
    : null;

  return (
    <div style={{ borderTop: "1px solid var(--line)", marginTop: "2rem" }}>

      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div>
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1rem", color: "var(--ink)" }}>
            Market Intelligence
          </p>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.15rem", fontSize: "0.55rem" }}>
            Local competitors · All 6 branches · Max 2 scans/week
          </p>
        </div>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div style={{ paddingBottom: "2rem" }}>

          {/* Controls */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}>
            <select
              className="input-line"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value as Branch | "All")}
              style={{ fontSize: "0.7rem", minWidth: "10rem" }}
            >
              <option value="All">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <button
              className="btn btn-primary"
              onClick={fetchIntel}
              disabled={loading}
              style={{ fontSize: "0.6rem", letterSpacing: "0.15em" }}
            >
              {loading ? "Scanning competitors..." : "↻ Generate Report"}
            </button>

            {remaining !== null && (
              <p className="label" style={{ color: remaining === 0 ? "var(--danger)" : "var(--muted)", fontSize: "0.55rem" }}>
                {remaining} scan{remaining !== 1 ? "s" : ""} remaining this week
              </p>
            )}

            {generatedAt && (
              <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", marginLeft: "auto" }}>
                Last scan: {formatDate(generatedAt)}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "0.75rem 1rem",
              background: "var(--paper-2)",
              border: "1px solid var(--line)",
              marginBottom: "1rem",
            }}>
              <p style={{ fontSize: "0.78rem", color: "var(--warn)" }}>{error}</p>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
                Scanning local competitors across all branches...
              </p>
              <p className="label" style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.55rem" }}>
                This may take 30–60 seconds
              </p>
            </div>
          )}

          {/* Results */}
          {!loading && displayResults && displayResults.map((branchResult) => (
            <div key={branchResult.branch} style={{ marginBottom: "2rem" }}>

              {/* Branch header */}
              <div style={{
                borderBottom: "1px solid var(--line)",
                paddingBottom: "0.5rem",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
              }}>
                <div>
                  <p style={{
                    fontFamily: "var(--font-outfit)",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--ink)",
                  }}>
                    {branchResult.branch}
                  </p>
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginTop: "0.1rem" }}>
                    {branchResult.mall}
                  </p>
                </div>
                <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>
                  {branchResult.competitors.length} competitors scanned
                </p>
              </div>

              {/* Competitor cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 0,
              }}>
                {branchResult.competitors.map((comp) => (
                  <div
                    key={comp.name}
                    style={{
                      border: "1px solid var(--line)",
                      padding: "1rem",
                    }}
                  >
                    <div style={{ marginBottom: "0.75rem", paddingBottom: "0.5rem", borderBottom: "1px solid var(--line)" }}>
                      <p style={{
                        fontFamily: "var(--font-outfit)",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "var(--ink)",
                        letterSpacing: "0.05em",
                      }}>
                        {comp.name}
                      </p>
                      <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginTop: "0.1rem" }}>
                        {comp.type}
                      </p>
                    </div>

                    {[
                      { label: "Promotions", value: comp.promotions, highlight: comp.promotions !== "None found" && !!comp.promotions },
                      { label: "Price range", value: comp.price_range },
                      { label: "Social", value: comp.social_activity },
                      { label: "Notable", value: comp.notable },
                    ].map(({ label, value, highlight }) => (
                      value && value !== "—" && (
                        <div key={label} style={{ marginBottom: "0.6rem" }}>
                          <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", marginBottom: "0.15rem" }}>
                            {label.toUpperCase()}
                          </p>
                          <p style={{
                            fontSize: "0.75rem",
                            color: highlight ? "var(--warn)" : "var(--ink)",
                            fontFamily: "var(--font-outfit)",
                            lineHeight: 1.5,
                          }}>
                            {value}
                          </p>
                        </div>
                      )
                    ))}

                    {comp.error && (
                      <p style={{ fontSize: "0.7rem", color: "var(--muted)", fontStyle: "italic" }}>
                        Could not fetch — try again
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Empty state */}
          {!loading && !displayResults && !error && (
            <div style={{ padding: "2rem", textAlign: "center" }}>
              <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.95rem" }}>
                Select a branch and tap Generate Report to scan local competitors.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
