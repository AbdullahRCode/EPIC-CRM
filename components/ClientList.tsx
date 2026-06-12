"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Client, Branch, ClientTag } from "@/lib/types";
import { deriveTags } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import { useBranchOwner } from "@/lib/branch-context";
import ClientModal from "./ClientModal";
import PhotoIntake from "./PhotoIntake";
import AnonymousSales from "./AnonymousSales";
import { getAnonymousSales, type AnonymousSale } from "@/app/actions/anonymous";
import { todayStr, parseDateLocal } from "@/lib/dates";

type DateRange = "today" | "week" | "month" | "all";

interface ClientListProps {
  initialBranch: Branch | "All";
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function totalSpend(client: Client) {
  return (client.visits ?? []).reduce((s, v) => s + (v.spend ?? 0), 0);
}

function lastVisitDate(client: Client): Date | null {
  const visits = client.visits ?? [];
  if (!visits.length) return null;
  return visits
    .map((v) => new Date(v.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

function inDateRange(client: Client, range: DateRange): boolean {
  if (range === "all") return true;
  const last = lastVisitDate(client);
  if (!last) return false;
  const diff = (Date.now() - last.getTime()) / 86400000;
  if (range === "today") return diff < 1;
  if (range === "week") return diff <= 7;
  if (range === "month") return diff <= 30;
  return true;
}

const TAG_OPTIONS: { label: string; value: ClientTag }[] = [
  { label: "VIP ($1000+ spend)", value: "VIP" },
  { label: "Returning (2+ visits)", value: "Returning" },
  { label: "Alterations (active)", value: "Alterations" },
  { label: "Follow-up needed", value: "Follow-up" },
  { label: "Cold (90+ days)", value: "Cold" },
  { label: "Special Order (active)", value: "Special Order" },
  { label: "Events upcoming", value: "Events" },
  { label: "Inquiries", value: "Inquiry" },
];

const DATE_RANGES = [
  { label: "Today", value: "today" as DateRange },
  { label: "This week", value: "week" as DateRange },
  { label: "This month", value: "month" as DateRange },
  { label: "All time", value: "all" as DateRange },
];

export default function ClientList({ initialBranch }: ClientListProps) {
  const { ownerMode } = useBranchOwner();
  const [clients, setClients] = useState<Client[]>([]);
  const [anonSales, setAnonSales] = useState<AnonymousSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<Branch | "All">(initialBranch);
  const [tagFilter, setTagFilter] = useState<ClientTag | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [textSearch, setTextSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const loadClients = useCallback(async (b: Branch | "All") => {
    setLoading(true);
    try {
      const [data, anon] = await Promise.all([
        getClients(b === "All" ? undefined : b),
        getAnonymousSales(b === "All" ? undefined : b, todayStr()),
      ]);
      setClients(data);
      setAnonSales(anon);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients(branch);
  }, [branch, loadClients]);

  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === "epic-branch" && e.newValue) {
        setBranch(e.newValue as Branch | "All");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const sorted = clients.filter((c) => {
    const tags = deriveTags(c);
    if (tagFilter && !tags.includes(tagFilter)) return false;
    if (!inDateRange(c, dateRange)) return false;
    if (textSearch.trim()) {
      const q = textSearch.toLowerCase();
      const match =
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email ?? "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  function openNew() {
    setSelectedClient(undefined);
    setShowModal(true);
  }

  function openEdit(client: Client) {
    setSelectedClient(client);
    setShowModal(true);
  }

  function handleSave(saved: Client) {
    setClients((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setShowModal(false);
  }

  function handleDelete(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id));
  }

  // Upcoming events (next 90 days) from loaded client data
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const in90 = new Date(now.getTime() + 90 * 86400000);
    return clients
      .filter((c) => c.event_date && c.events.length > 0)
      .map((c) => ({
        client: c,
        eventDate: parseDateLocal(c.event_date!),
        eventType: c.events[0],
      }))
      .filter((e) => e.eventDate >= now && e.eventDate <= in90)
      .sort((a, b) => a.eventDate.getTime() - b.eventDate.getTime())
      .slice(0, 5);
  }, [clients]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="px-4 sm:px-6 py-4 flex flex-col gap-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {/* Text search + filter dropdown + action buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="flex gap-2 flex-1 min-w-0">
            <input
              className="input-line flex-1"
              style={{ minWidth: 0 }}
              placeholder="Name, phone, email..."
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
            />
            <select
              className="input-line flex-shrink-0"
              style={{ minWidth: "8rem", maxWidth: "12rem", fontSize: "0.75rem" }}
              value={tagFilter ?? ""}
              onChange={(e) =>
                setTagFilter(e.target.value ? (e.target.value as ClientTag) : null)
              }
            >
              <option value="">All clients</option>
              {TAG_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowPhoto(true)}
              className="btn btn-ghost"
              title="Photo intake"
            >
              ↑ Photo
            </button>
            <button onClick={openNew} className="btn btn-primary">
              + New entry
            </button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div
        className="px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-y-1"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="label" style={{ color: "var(--muted)" }}>
          {loading ? (
            "Loading..."
          ) : (
            <>
              {sorted.length} client{sorted.length !== 1 ? "s" : ""}
              {" · "}${sorted.reduce((s, c) => s + totalSpend(c), 0).toLocaleString()} revenue
              {" · "}
              {sorted.filter((c) => deriveTags(c).includes("VIP")).length} VIP
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="label">Period</span>
          <select
            className="input-line"
            style={{ fontSize: "0.65rem", minWidth: "6.5rem" }}
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
          >
            {DATE_RANGES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Client rows */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span className="label" style={{ color: "var(--muted)" }}>Loading the logbook...</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p
              className="font-serif"
              style={{ fontSize: "1.1rem", fontStyle: "italic", color: "var(--muted)" }}
            >
              No entries found
            </p>
            <button onClick={openNew} className="btn btn-primary">
              + New entry
            </button>
          </div>
        ) : (
          <div>
            {sorted.map((client) => {
              const tags = deriveTags(client);
              const spend = totalSpend(client);
              const isVip = tags.includes("VIP");
              const lastVisit = lastVisitDate(client);
              const lastVisitStr = lastVisit
                ? lastVisit.toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                : "No visits";

              return (
                <div
                  key={client.id}
                  className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--line)" }}
                  onClick={() => openEdit(client)}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--paper-2)")
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* Avatar */}
                  <div className={`avatar ${isVip ? "avatar-vip" : ""}`}>
                    {initials(client.name)}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="truncate"
                        style={{ fontSize: "0.9rem", fontWeight: 500, maxWidth: "12rem" }}
                      >
                        {client.name}
                      </span>
                      <div className="flex gap-1 flex-wrap">
                        {tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className={`tag tag-${tag.toLowerCase().replace(/ /g, "-")}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <span
                        className="label hidden sm:block"
                        style={{ color: "var(--muted)" }}
                      >
                        {client.branch}
                      </span>
                      <span className="label" style={{ color: "var(--muted)" }}>
                        {lastVisitStr}
                      </span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {spend > 0 && (
                      <span
                        className="label"
                        style={{ color: isVip ? "var(--vip)" : "var(--ink)" }}
                      >
                        ${spend.toLocaleString()}
                      </span>
                    )}
                    {client.alteration_status &&
                      client.alteration_status !== "Picked up" && (
                        <span
                          className="label"
                          style={{
                            color:
                              client.alteration_status === "Ready"
                                ? "var(--good)"
                                : "var(--muted)",
                            fontSize: "0.55rem",
                          }}
                        >
                          Alt: {client.alteration_status}
                        </span>
                      )}
                    {client.special_order_status &&
                      client.special_order_status !== "Picked up" && (
                        <span
                          className="label"
                          style={{
                            color:
                              client.special_order_status === "Arrived"
                                ? "var(--good)"
                                : "var(--muted)",
                            fontSize: "0.55rem",
                          }}
                        >
                          Order: {client.special_order_status}
                        </span>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Today's anonymous sales — inline rows */}
        {!loading && anonSales.length > 0 && (
          <div>
            <div className="px-4 sm:px-6 py-2" style={{ borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
              <span className="label" style={{ color: "var(--muted)", fontSize: "0.5rem", letterSpacing: "0.15em" }}>
                ANONYMOUS SALES · TODAY
              </span>
            </div>
            {anonSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4"
                style={{
                  borderBottom: "1px solid var(--line)",
                  background: "var(--paper-2)",
                  borderLeft: "3px solid var(--line)",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "var(--line)", display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="5" r="3" fill="var(--muted)" />
                    <path d="M2 14c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="var(--muted)" strokeWidth="1.5" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <span style={{ fontStyle: "italic", color: "var(--muted)", fontSize: "0.85rem", fontFamily: "var(--font-serif)" }}>
                    Anonymous Sale
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>{sale.branch}</span>
                    <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                      {new Date(sale.sale_date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: "1rem", color: "var(--ink)", flexShrink: 0 }}>
                  ${sale.total_amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Calendar strip — upcoming events */}
        {!loading && (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            <button
              onClick={() => setCalendarOpen((o) => !o)}
              className="flex items-center gap-2 w-full px-4 sm:px-6 py-3"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span className="label" style={{ color: "var(--muted)" }}>
                {calendarOpen ? "▾" : "▸"} Upcoming Events
              </span>
              {upcomingEvents.length > 0 && (
                <span
                  className="label"
                  style={{
                    color: "var(--warn)",
                    fontSize: "0.55rem",
                    marginLeft: "auto",
                  }}
                >
                  {upcomingEvents.length} in next 90 days
                </span>
              )}
            </button>

            {calendarOpen && (
              <div className="px-4 sm:px-6 pb-6">
                <p
                  className="font-serif mb-3"
                  style={{ fontSize: "1rem", fontStyle: "italic", color: "var(--ink)" }}
                >
                  Upcoming Events
                </p>
                {upcomingEvents.length === 0 ? (
                  <p className="label" style={{ color: "var(--muted)" }}>
                    No upcoming events in the next 3 months
                  </p>
                ) : (
                  <div className="flex flex-col">
                    {upcomingEvents.map(({ client, eventDate, eventType }) => (
                      <div
                        key={client.id}
                        className="flex items-center justify-between py-3 cursor-pointer"
                        style={{ borderBottom: "1px solid var(--line)" }}
                        onClick={() => openEdit(client)}
                      >
                        <div className="flex flex-col gap-0.5">
                          <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>
                            {client.name}
                          </span>
                          <span className="label" style={{ color: "var(--warn)" }}>
                            {eventType}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="label" style={{ color: "var(--ink)" }}>
                            {eventDate.toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span
                            className="label hidden sm:block"
                            style={{ color: "var(--muted)", fontSize: "0.55rem" }}
                          >
                            {client.branch}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Anonymous sales */}
        {!loading && (
          <div className="px-4 sm:px-6">
            <AnonymousSales ownerMode={ownerMode} branch={branch} />
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ClientModal
          client={selectedClient}
          defaultBranch={branch !== "All" ? branch : undefined}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onUpdated={(saved) =>
            // Inline field edits in the detail view: sync the row, keep it open
            setClients((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
          }
          onDelete={handleDelete}
        />
      )}

      {showPhoto && (
        <PhotoIntake
          onImport={(newClients) => {
            setClients((prev) => [...newClients, ...prev]);
            setShowPhoto(false);
          }}
          onClose={() => setShowPhoto(false)}
          defaultBranch={branch !== "All" ? branch : undefined}
        />
      )}
    </div>
  );
}
