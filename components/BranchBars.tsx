"use client";

import { useState } from "react";
import type { Client, Branch } from "@/lib/types";
import { BRANCHES, deriveTags } from "@/lib/types";

const BRANCH_COLORS: Record<string, string> = {
  "Victoria": "#2C5F8A",
  "Surrey - Guildford": "#d4ad53",
  "Surrey - Central City": "#1f5a32",
  "Burnaby": "#8a5a1f",
  "Tsawwassen Mills": "#6b6b66",
  "Calgary": "#8a1f1f",
};

const CIRCUMFERENCE = 2 * Math.PI * 30; // ≈ 188.5

interface BranchBarsProps {
  clients: Client[];
  ownerMode: boolean;
  activeBranch: Branch | "All";
}

interface BranchStat {
  branch: Branch;
  total: number;
  vip: number;
  returning: number;
  totalSpend: number;
  alterationsActive: number;
}

export default function BranchBars({ clients, ownerMode, activeBranch }: BranchBarsProps) {
  const [hoveredBranch, setHoveredBranch] = useState<Branch | null>(null);

  const visibleBranches =
    !ownerMode && activeBranch !== "All" ? [activeBranch as Branch] : BRANCHES;

  const stats: BranchStat[] = visibleBranches.map((branch) => {
    const bc = clients.filter((c) => c.branch === branch);
    const vip = bc.filter((c) => deriveTags(c).includes("VIP")).length;
    const returning = bc.filter((c) => deriveTags(c).includes("Returning")).length;
    const totalSpend = bc.reduce(
      (s, c) => s + (c.visits ?? []).reduce((vs, v) => vs + (v.spend ?? 0), 0),
      0
    );
    const alterationsActive = bc.filter(
      (c) => (c.alterations ?? []).length > 0 && c.alteration_status !== "Picked up"
    ).length;
    return { branch, total: bc.length, vip, returning, totalSpend, alterationsActive };
  });

  const totalAllRevenue = stats.reduce((s, st) => s + st.totalSpend, 0);

  return (
    <div
      className="branch-bars-container"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: 0,
      }}
    >
      {stats.map((stat) => {
        const color = BRANCH_COLORS[stat.branch] ?? "var(--ink)";
        const revenuePct =
          totalAllRevenue > 0 ? (stat.totalSpend / totalAllRevenue) * 100 : 0;
        const dashFill = (revenuePct / 100) * CIRCUMFERENCE;
        const isHovered = hoveredBranch === stat.branch;

        return (
          <div
            key={stat.branch}
            onMouseEnter={() => setHoveredBranch(stat.branch)}
            onMouseLeave={() => setHoveredBranch(null)}
            style={{
              border: "1px solid var(--line)",
              borderTop: isHovered ? `2px solid ${color}` : "1px solid var(--line)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
              background: isHovered ? "var(--paper-2)" : "var(--paper)",
              transition: "background 0.2s, border-top 0.15s",
              cursor: "default",
            }}
          >
            {/* Branch name */}
            <p
              style={{
                fontFamily: "var(--font-outfit), system-ui, sans-serif",
                fontSize: "0.6rem",
                fontWeight: 500,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color,
                textAlign: "center",
                alignSelf: "stretch",
              }}
            >
              {stat.branch}
            </p>

            {/* SVG circular ring */}
            <svg viewBox="0 0 80 80" width={80} height={80}>
              {/* Background track */}
              <circle
                cx={40} cy={40} r={30}
                fill="none"
                stroke="var(--line)"
                strokeWidth={6}
              />
              {/* Foreground arc — starts from 12 o'clock */}
              <circle
                cx={40} cy={40} r={30}
                fill="none"
                stroke={color}
                strokeWidth={6}
                strokeDasharray={`${dashFill} ${CIRCUMFERENCE}`}
                strokeLinecap="round"
                style={{ transformOrigin: "40px 40px", transform: "rotate(-90deg)" }}
              />
              {/* Center percentage */}
              <text
                x={40} y={44}
                textAnchor="middle"
                fontFamily="Cormorant Garamond, Georgia, serif"
                fontWeight={400}
                fontSize={14}
                fill="var(--ink)"
              >
                {revenuePct > 0 && revenuePct < 1
                  ? "<1%"
                  : `${Math.round(revenuePct)}%`}
              </text>
            </svg>

            {/* Revenue */}
            <p
              className="font-serif"
              style={{ fontSize: "1.1rem", fontWeight: 400, color: "var(--ink)" }}
            >
              ${stat.totalSpend.toLocaleString()}
            </p>

            {/* Client count + VIP */}
            <div className="flex items-center gap-3">
              <span className="label" style={{ color: "var(--muted)" }}>
                {stat.total} client{stat.total !== 1 ? "s" : ""}
              </span>
              {stat.vip > 0 && (
                <span className="label" style={{ color: "var(--vip)" }}>
                  {stat.vip} VIP
                </span>
              )}
            </div>

            {/* Alteration indicator */}
            {stat.alterationsActive > 0 && (
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--warn)",
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span className="label" style={{ color: "var(--warn)", fontSize: "0.55rem" }}>
                  {stat.alterationsActive} alteration{stat.alterationsActive !== 1 ? "s" : ""}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
