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

const THREAT_CONFIG = {
  High:   { color: "#8a1f1f", bg: "#8a1f1f15", label: "HIGH THREAT" },
  Medium: { color: "#8a5a1f", bg: "#8a5a1f12", label: "MEDIUM" },
  Low:    { color: "#1f5a32", bg: "#1f5a3212", label: "LOW THREAT" },
};

function threatScore(level: string): number {
  if (level === "High") return 5;
  if (level === "Medium") return 3;
  return 1;
}

function priceScore(range: string): number {
  const nums = range.match(/\d+/g);
  if (!nums || nums.length < 1) return 3;
  const avg = nums.map(Number).reduce((a, b) => a + b, 0) / nums.length;
  if (avg < 300) return 5;
  if (avg < 400) return 4;
  if (avg < 500) return 3;
  if (avg < 650) return 2;
  return 1;
}

function promotionScore(promo: string): number {
  if (!promo || promo === "No active promotions found") return 1;
  if (/\d+%/.test(promo)) return 5;
  return 3;
}

function RadarChart({ competitor }: { competitor: CompetitorData }) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const r = 28;
  const axes = 5;
  const scores = [
    priceScore(competitor.price_range),
    threatScore(competitor.threat_level),
    promotionScore(competitor.promotions),
    3,
    competitor.type.toLowerCase().includes("local") ? 4 : 2,
  ];

  function getPoint(index: number, score: number) {
    const angle = (Math.PI * 2 * index) / axes - Math.PI / 2;
    const dist = (score / 5) * r;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  }

  const gridLevels = [1, 2, 3, 4, 5];

  const axisLines = Array.from({ length: axes }, (_, i) => {
    const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
    return {
      x2: cx + r * Math.cos(angle),
      y2: cy + r * Math.sin(angle),
    };
  });

  const points = scores.map((s, i) => getPoint(i, s));
  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(" ");

  const gridPolygons = gridLevels.map((level) => {
    const pts = Array.from({ length: axes }, (_, i) => {
      const angle = (Math.PI * 2 * i) / axes - Math.PI / 2;
      const dist = (level / 5) * r;
      return `${cx + dist * Math.cos(angle)},${cy + dist * Math.sin(angle)}`;
    });
    return pts.join(" ");
  });

  const threatColor = THREAT_CONFIG[competitor.threat_level]?.color ?? "#8a5a1f";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="#e6e4dd" strokeWidth="0.5" />
      ))}
      {axisLines.map((line, i) => (
        <line key={i} x1={cx} y1={cy} x2={line.x2} y2={line.y2} stroke="#e6e4dd" strokeWidth="0.5" />
      ))}
      <polygon points={polygonPoints} fill={threatColor} fillOpacity="0.15" stroke={threatColor} strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={threatColor} />
      ))}
    </svg>
  );
}

function BulletPoints({ text, color = "var(--ink)" }: { text: string; color?: string }) {
  const raw = text ?? "";
  const parts = raw
    .split(/;\s*|(?<=\.)\s+(?=[A-Z])/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      {parts.map((point, i) => (
        <li key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
          <span style={{ color, fontSize: "0.6rem", marginTop: "0.2rem", flexShrink: 0 }}>▸</span>
          <span style={{ fontSize: "0.72rem", color, fontFamily: "var(--font-outfit)", lineHeight: 1.5 }}>
            {point}
          </span>
        </li>
      ))}
    </ul>
  );
}

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
      setExpandedBranch(json.results?.[0]?.branch ?? null);
    } catch {
      setError("Network error — try again.");
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
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1rem", color: "var(--ink)" }}>
            Market Intelligence
          </p>
          <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", marginTop: "0.15rem" }}>
            Local competitors · All 6 branches · {remaining !== null ? `${remaining} scan${remaining !== 1 ? "s" : ""} left this week` : "Max 2 scans/week"}
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
                {new Date(generatedAt).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })}
              </p>
            )}
          </div>

          {error && (
            <div style={{ padding: "0.75rem 1rem", background: "var(--paper-2)", border: "1px solid var(--line)", marginBottom: "1rem" }}>
              <p style={{ fontSize: "0.78rem", color: "var(--warn)" }}>{error}</p>
            </div>
          )}

          {loading && (
            <div style={{ padding: "3rem", textAlign: "center" }}>
              <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1.1rem", color: "var(--muted)" }}>
                Running deep scan across {selectedBranch === "All" ? "all 6 branches" : selectedBranch}...
              </p>
              <p className="label" style={{ color: "var(--muted)", marginTop: "0.5rem", fontSize: "0.55rem" }}>60–90 seconds</p>
            </div>
          )}

          {!loading && displayResults && displayResults.map((branchResult) => (
            <div key={branchResult.branch} style={{ marginBottom: "1rem", border: "1px solid var(--line)" }}>

              {/* Branch header */}
              <button
                onClick={() => setExpandedBranch(expandedBranch === branchResult.branch ? null : branchResult.branch)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.875rem 1.25rem", background: "var(--paper-2)", border: "none", cursor: "pointer",
                  borderBottom: expandedBranch === branchResult.branch ? "1px solid var(--line)" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
                  <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ink)" }}>
                    {branchResult.branch}
                  </p>
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.5rem" }}>{branchResult.mall}</p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {(["High", "Medium", "Low"] as const).map((level) => {
                    const count = branchResult.competitors.filter((c) => c.threat_level === level).length;
                    if (!count) return null;
                    return (
                      <span key={level} style={{
                        fontFamily: "var(--font-outfit)", fontSize: "0.5rem", letterSpacing: "0.1em",
                        padding: "0.2rem 0.5rem", textTransform: "uppercase",
                        background: THREAT_CONFIG[level].bg,
                        color: THREAT_CONFIG[level].color,
                        fontWeight: 600,
                      }}>
                        {count} {level}
                      </span>
                    );
                  })}
                  <span style={{ color: "var(--muted)", fontSize: "0.7rem", marginLeft: "0.25rem" }}>
                    {expandedBranch === branchResult.branch ? "▾" : "▸"}
                  </span>
                </div>
              </button>

              {expandedBranch === branchResult.branch && (
                <>
                  {/* Owner strategic note */}
                  {branchResult.owner_note && (
                    <div style={{ padding: "1rem 1.5rem", background: "var(--ink)", borderBottom: "1px solid var(--line)", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                      <span style={{ color: "var(--vip)", fontSize: "1rem", flexShrink: 0, marginTop: "0.1rem" }}>✦</span>
                      <div>
                        <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--vip)", marginBottom: "0.4rem" }}>
                          Owner&apos;s Strategic Note
                        </p>
                        <p style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontSize: "0.88rem", color: "var(--paper)", lineHeight: 1.65, maxWidth: "72ch" }}>
                          {branchResult.owner_note.split(/(?<=\.)\s+/).slice(0, 2).join(" ")}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Competitor grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {branchResult.competitors.map((comp) => {
                      const cfg = THREAT_CONFIG[comp.threat_level];
                      return (
                        <div
                          key={comp.name}
                          style={{
                            padding: "1rem",
                            borderRight: "1px solid var(--line)",
                            borderBottom: "1px solid var(--line)",
                            borderTop: `2px solid ${cfg.color}`,
                          }}
                        >
                          {/* Header: name + radar */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontFamily: "var(--font-outfit)", fontSize: "0.75rem", fontWeight: 600, color: "var(--ink)", marginBottom: "0.15rem" }}>
                                {comp.name}
                              </p>
                              <span style={{
                                fontFamily: "var(--font-outfit)", fontSize: "0.48rem", letterSpacing: "0.1em",
                                textTransform: "uppercase", padding: "0.15rem 0.4rem",
                                background: cfg.bg, color: cfg.color, fontWeight: 600,
                              }}>
                                {cfg.label}
                              </span>
                            </div>
                            <RadarChart competitor={comp} />
                          </div>

                          {/* Price */}
                          <div style={{ marginBottom: "0.6rem", paddingBottom: "0.6rem", borderBottom: "1px solid var(--line)" }}>
                            <p className="label" style={{ color: "var(--muted)", fontSize: "0.48rem", marginBottom: "0.15rem" }}>PRICE RANGE</p>
                            <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "0.9rem", color: "var(--ink)" }}>
                              {comp.price_range}
                            </p>
                          </div>

                          {/* Promotions — only shown when active */}
                          {comp.promotions && comp.promotions !== "No active promotions found" && (
                            <div style={{ marginBottom: "0.6rem", padding: "0.4rem 0.5rem", background: "#8a5a1f08", border: "1px solid #8a5a1f30" }}>
                              <p className="label" style={{ color: "var(--warn)", fontSize: "0.48rem", marginBottom: "0.2rem" }}>⚡ ACTIVE PROMOTION</p>
                              <p style={{ fontSize: "0.7rem", color: "var(--warn)", fontFamily: "var(--font-outfit)", lineHeight: 1.4 }}>
                                {comp.promotions.split(/[.;]/)[0].trim()}
                              </p>
                            </div>
                          )}

                          {/* Strengths */}
                          <div style={{ marginBottom: "0.6rem" }}>
                            <p className="label" style={{ color: "var(--muted)", fontSize: "0.48rem", marginBottom: "0.35rem" }}>THEIR STRENGTHS</p>
                            <BulletPoints text={comp.strengths} color="var(--ink)" />
                          </div>

                          {/* Exploit this */}
                          <div style={{ padding: "0.5rem", background: "#1f5a3210", border: "1px solid #1f5a3230" }}>
                            <p className="label" style={{ color: "var(--good)", fontSize: "0.48rem", marginBottom: "0.3rem" }}>▸ EXPLOIT THIS</p>
                            <BulletPoints text={comp.weaknesses} color="var(--good)" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ))}

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
