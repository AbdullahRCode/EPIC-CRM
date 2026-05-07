"use client";

import type { Client, Branch } from "@/lib/types";
import { BRANCHES, deriveTags } from "@/lib/types";

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
  const visibleBranches = !ownerMode && activeBranch !== "All"
    ? [activeBranch as Branch]
    : BRANCHES;

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

  const maxClients = Math.max(...stats.map((s) => s.total), 1);
  const maxSpend = Math.max(...stats.map((s) => s.totalSpend), 1);

  return (
    <div className="flex flex-col gap-6">
      <p className="section-title">Branch comparison</p>

      <div className="flex flex-col gap-5">
        {stats.map((stat) => {
          const clientPct = (stat.total / maxClients) * 100;
          const spendPct = (stat.totalSpend / maxSpend) * 100;
          const returningRate = stat.total ? Math.round((stat.returning / stat.total) * 100) : 0;

          return (
            <div key={stat.branch} className="flex flex-col gap-2">
              <div className="flex items-start justify-between flex-wrap gap-1">
                <span className="label" style={{ color: "var(--ink)", letterSpacing: "0.15em" }}>
                  {stat.branch}
                </span>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="label" style={{ color: "var(--muted)" }}>
                    {stat.total} clients
                  </span>
                  <span className="label" style={{ color: "var(--vip)" }}>
                    {stat.vip} VIP
                  </span>
                  <span className="label" style={{ color: "var(--good)" }}>
                    {returningRate}% returning
                  </span>
                </div>
              </div>

              {/* Client count bar */}
              <div className="flex items-center gap-3">
                <span className="label" style={{ width: "4rem", textAlign: "right", color: "var(--muted)", fontSize: "0.55rem" }}>
                  Clients
                </span>
                <div style={{ flex: 1, height: 6, background: "var(--line)", position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${clientPct}%`,
                      background: "var(--ink)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
              </div>

              {/* Spend bar */}
              <div className="flex items-center gap-3">
                <span className="label" style={{ width: "4rem", textAlign: "right", color: "var(--muted)", fontSize: "0.55rem" }}>
                  Revenue
                </span>
                <div style={{ flex: 1, height: 4, background: "var(--line)", position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      height: "100%",
                      width: `${spendPct}%`,
                      background: "var(--vip)",
                      transition: "width 0.4s ease",
                    }}
                  />
                </div>
                <span className="label" style={{ color: "var(--vip)", fontSize: "0.6rem" }}>
                  ${stat.totalSpend.toLocaleString()}
                </span>
              </div>

              {/* Alterations indicator */}
              {stat.alterationsActive > 0 && (
                <p className="label" style={{ color: "var(--warn)", fontSize: "0.55rem", marginLeft: "4.75rem" }}>
                  {stat.alterationsActive} active alteration{stat.alterationsActive !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
