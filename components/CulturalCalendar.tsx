"use client";

import { useState, useEffect } from "react";
import type { CulturalEvent, Branch } from "@/lib/types";
import { getSeedEvents } from "@/lib/cultural-seeds";
import { refreshCulturalEvents } from "@/app/actions/cultural";

interface CulturalCalendarProps {
  branch: Branch | "All";
  clientEvents: { name: string; date: string; eventType: string; branch: Branch }[];
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}


export default function CulturalCalendar({ branch, clientEvents }: CulturalCalendarProps) {
  const [culturalEvents, setCulturalEvents] = useState<CulturalEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"upcoming" | "cultural" | "clients">("upcoming");

  useEffect(() => {
    setCulturalEvents(getSeedEvents());
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const updated = await refreshCulturalEvents();
      setCulturalEvents(updated);
    } finally {
      setRefreshing(false);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Filter cultural events by branch + upcoming
  const filteredCultural = culturalEvents
    .filter((e) => {
      const d = daysUntil(e.date);
      if (d < -1) return false; // exclude past (keep yesterday for pickup reminders)
      if (branch !== "All" && !e.branches.includes(branch as Branch)) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Client events upcoming
  const filteredClientEvents = clientEvents
    .filter((e) => {
      const d = daysUntil(e.date);
      if (d < 0) return false;
      if (branch !== "All" && e.branch !== branch) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Combined upcoming (next 90 days)
  type CalEvent =
    | { kind: "cultural"; event: CulturalEvent }
    | { kind: "client"; event: { name: string; date: string; eventType: string; branch: Branch } };

  const upcoming: CalEvent[] = [
    ...filteredCultural.filter((e) => daysUntil(e.date) <= 90).map((e) => ({ kind: "cultural" as const, event: e })),
    ...filteredClientEvents.filter((e) => daysUntil(e.date) <= 90).map((e) => ({ kind: "client" as const, event: e })),
  ].sort((a, b) => a.event.date.localeCompare(b.event.date));

  const urgencyColor = (days: number) => {
    if (days <= 7) return "var(--danger)";
    if (days <= 30) return "var(--warn)";
    return "var(--muted)";
  };

  const VIEWS = [
    { id: "upcoming", label: "Upcoming" },
    { id: "cultural", label: "Cultural" },
    { id: "clients", label: "Client events" },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="label px-3 py-1.5"
              style={{
                border: "1px solid",
                borderColor: view === v.id ? "var(--ink)" : "var(--line)",
                background: view === v.id ? "var(--ink)" : "transparent",
                color: view === v.id ? "var(--paper)" : "var(--muted)",
                cursor: "pointer",
                fontSize: "0.58rem",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          className="btn btn-ghost"
          disabled={refreshing}
          style={{ fontSize: "0.6rem" }}
        >
          {refreshing ? "Refreshing..." : "↺ Refresh via AI"}
        </button>
      </div>

      {/* UPCOMING */}
      {view === "upcoming" && (
        <div className="flex flex-col gap-0">
          {upcoming.length === 0 && (
            <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
              No events in the next 90 days for this branch.
            </p>
          )}
          {upcoming.map((item, i) => {
            const days = daysUntil(item.event.date);
            const isClient = item.kind === "client";

            return (
              <div
                key={i}
                className="flex items-start gap-4 py-4"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                {/* Date column */}
                <div
                  className="flex flex-col items-center flex-shrink-0"
                  style={{ width: "3rem" }}
                >
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontFamily: "Cormorant Garamond, serif",
                      fontWeight: 300,
                      lineHeight: 1,
                      color: urgencyColor(days),
                    }}
                  >
                    {new Date(item.event.date).getDate()}
                  </span>
                  <span className="label" style={{ fontSize: "0.5rem", color: "var(--muted)" }}>
                    {new Date(item.event.date).toLocaleDateString("en-CA", { month: "short" })}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                      {isClient
                        ? (item.event as { name: string }).name
                        : (item.event as CulturalEvent).name}
                    </span>
                    <span
                      className="tag"
                      style={{
                        color: isClient ? "var(--warn)" : "var(--muted)",
                        borderColor: isClient ? "var(--warn)" : "var(--line)",
                        fontSize: "0.5rem",
                      }}
                    >
                      {isClient ? (item.event as { eventType: string }).eventType : "Cultural"}
                    </span>
                  </div>
                  {!isClient && (item.event as CulturalEvent).description && (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      {(item.event as CulturalEvent).description}
                    </p>
                  )}
                  {isClient && (
                    <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                      {(item.event as { branch: Branch }).branch}
                    </p>
                  )}
                  {!isClient && (
                    <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                      {(item.event as CulturalEvent).branches.join(" · ")}
                    </p>
                  )}
                </div>

                {/* Days countdown */}
                <div className="flex flex-col items-end flex-shrink-0">
                  <span
                    className="label"
                    style={{ color: urgencyColor(days), fontSize: "0.6rem" }}
                  >
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days}d`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CULTURAL */}
      {view === "cultural" && (
        <div className="flex flex-col gap-0">
          {filteredCultural.map((event) => {
            const days = daysUntil(event.date);
            return (
              <div
                key={event.id}
                className="flex items-start gap-4 py-4"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: "3rem" }}>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontFamily: "Cormorant Garamond, serif",
                      fontWeight: 300,
                      lineHeight: 1,
                      color: urgencyColor(days),
                    }}
                  >
                    {new Date(event.date).getDate()}
                  </span>
                  <span className="label" style={{ fontSize: "0.5rem", color: "var(--muted)" }}>
                    {new Date(event.date).toLocaleDateString("en-CA", { month: "short" })}
                  </span>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>{event.name}</span>
                  {event.description && (
                    <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{event.description}</p>
                  )}
                  <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                    {event.branches.join(" · ")}
                  </p>
                </div>
                <span className="label" style={{ color: urgencyColor(days), fontSize: "0.6rem" }}>
                  {days === 0 ? "Today" : days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* CLIENT EVENTS */}
      {view === "clients" && (
        <div className="flex flex-col gap-0">
          {filteredClientEvents.length === 0 && (
            <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
              No upcoming client events for this branch.
            </p>
          )}
          {filteredClientEvents.map((event, i) => {
            const days = daysUntil(event.date);
            return (
              <div
                key={i}
                className="flex items-center gap-4 py-4"
                style={{ borderBottom: "1px solid var(--line)" }}
              >
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: "3rem" }}>
                  <span
                    style={{
                      fontSize: "1.5rem",
                      fontFamily: "Cormorant Garamond, serif",
                      fontWeight: 300,
                      lineHeight: 1,
                      color: urgencyColor(days),
                    }}
                  >
                    {new Date(event.date).getDate()}
                  </span>
                  <span className="label" style={{ fontSize: "0.5rem", color: "var(--muted)" }}>
                    {new Date(event.date).toLocaleDateString("en-CA", { month: "short" })}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 flex-1">
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>{event.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="tag" style={{ color: "var(--warn)", borderColor: "var(--warn)", fontSize: "0.5rem" }}>
                      {event.eventType}
                    </span>
                    <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                      {event.branch}
                    </span>
                  </div>
                </div>
                <span className="label" style={{ color: urgencyColor(days), fontSize: "0.6rem" }}>
                  {days === 0 ? "Today" : `${days}d`}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
