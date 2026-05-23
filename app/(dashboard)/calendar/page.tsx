"use client";

import { useEffect, useState } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import CulturalCalendar from "@/components/CulturalCalendar";

export default function CalendarPage() {
  const { branch } = useBranchOwner();
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

  // Extract client events for calendar
  const clientEvents = clients
    .filter((c) => c.event_date && (c.events ?? []).length > 0)
    .map((c) => ({
      name: c.name,
      date: c.event_date!,
      eventType: (c.events ?? [])[0] ?? "Other",
      branch: c.branch,
    }));

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Calendar</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          Upcoming client events & cultural milestones
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="label" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      ) : (
        <div className="px-6 py-6">
          <CulturalCalendar branch={branch} clientEvents={clientEvents} />
        </div>
      )}
    </div>
  );
}
