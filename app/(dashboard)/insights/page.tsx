"use client";

import { useEffect, useState } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import BranchBars from "@/components/BranchBars";
import TrendChart from "@/components/TrendChart";
import DailySummary from "@/components/DailySummary";
import { deriveTags } from "@/lib/types";

export default function InsightsPage() {
  const { branch, ownerMode } = useBranchOwner();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await getClients(branch === "All" ? undefined : branch as Branch);
        setClients(data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [branch]);

  // Compute quick stats
  const totalClients = clients.length;
  const vipCount = clients.filter((c) => deriveTags(c).includes("VIP")).length;
  const coldCount = clients.filter((c) => deriveTags(c).includes("Cold")).length;
  const followUpCount = clients.filter((c) => c.follow_up?.needed).length;
  const totalRevenue = clients.reduce(
    (s, c) => s + (c.visits ?? []).reduce((vs, v) => vs + (v.spend ?? 0), 0),
    0
  );
  const alterationsReady = clients.filter((c) => c.alteration_status === "Ready").length;
  const ordersArrived = clients.filter((c) => c.special_order_status === "Arrived").length;

  const STATS = [
    { label: "Total clients", value: totalClients },
    { label: "VIP", value: vipCount, color: "var(--vip)" },
    { label: "Cold (90d+)", value: coldCount, color: "var(--muted)" },
    { label: "Follow-ups", value: followUpCount, color: "var(--danger)" },
    { label: "Revenue", value: `$${totalRevenue.toLocaleString()}`, color: "var(--good)" },
    { label: "Alt. ready", value: alterationsReady, color: "var(--good)" },
    { label: "Orders arrived", value: ordersArrived, color: "var(--good)" },
  ];

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Insights</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          {branch === "All" ? "All branches" : branch} — performance at a glance
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="label" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      ) : (
        <div className="px-6 py-6 flex flex-col gap-10">
          {/* Quick stats */}
          <div
            className="grid gap-0"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              border: "1px solid var(--line)",
            }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 p-4"
                style={{
                  borderRight: i < STATS.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <span
                  className="font-serif"
                  style={{ fontSize: "1.6rem", fontWeight: 400, color: stat.color ?? "var(--ink)" }}
                >
                  {stat.value}
                </span>
                <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          {/* Branch comparison */}
          <BranchBars clients={clients} />

          {/* 6-month trend */}
          <TrendChart clients={clients} />

          {/* AI daily summary */}
          <DailySummary ownerMode={ownerMode} />
        </div>
      )}
    </div>
  );
}
