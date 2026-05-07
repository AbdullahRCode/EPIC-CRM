"use client";

import { useState, useEffect, useCallback } from "react";
import type { Client, Branch, ClientTag } from "@/lib/types";
import { deriveTags } from "@/lib/types";
import { getClients } from "@/app/actions/clients";
import ClientModal from "./ClientModal";
import AISearchPanel from "./AISearchPanel";
import VoiceCommand from "./VoiceCommand";
import PhotoIntake from "./PhotoIntake";

const TAG_FILTERS: ClientTag[] = ["VIP", "Returning", "Cold", "Events", "Alterations", "Special Order", "Follow-up"];

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
  const now = Date.now();
  const diff = (now - last.getTime()) / 86400000;
  if (range === "today") return diff < 1;
  if (range === "week") return diff <= 7;
  if (range === "month") return diff <= 30;
  return true;
}

export default function ClientList({ initialBranch }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [branch, setBranch] = useState<Branch | "All">(initialBranch);
  const [tagFilter, setTagFilter] = useState<ClientTag | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [textSearch, setTextSearch] = useState("");
  const [aiResultIds, setAiResultIds] = useState<string[] | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showPhoto, setShowPhoto] = useState(false);

  const loadClients = useCallback(async (b: Branch | "All") => {
    setLoading(true);
    try {
      const data = await getClients(b === "All" ? undefined : b);
      setClients(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients(branch);
  }, [branch, loadClients]);

  // Sync branch from header (listen to storage event)
  useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === "epic-branch" && e.newValue) {
        setBranch(e.newValue as Branch | "All");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const filtered = clients.filter((c) => {
    if (aiResultIds !== null) return aiResultIds.includes(c.id);

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

  // Keep AI result order
  const sorted = aiResultIds
    ? filtered.sort((a, b) => aiResultIds.indexOf(a.id) - aiResultIds.indexOf(b.id))
    : filtered;

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

  function handleVoiceApply(action: { type: string; clientId: string; params: Record<string, string> }) {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== action.clientId) return c;
        if (action.type === "update_alteration_status") {
          return { ...c, alteration_status: action.params.status as Client["alteration_status"], updated_at: new Date().toISOString() };
        }
        if (action.type === "update_order_status") {
          return { ...c, special_order_status: action.params.status as Client["special_order_status"], updated_at: new Date().toISOString() };
        }
        if (action.type === "add_follow_up") {
          return { ...c, follow_up: { needed: true, reason: action.params.reason ?? "" }, updated_at: new Date().toISOString() };
        }
        if (action.type === "remove_follow_up") {
          return { ...c, follow_up: { needed: false }, updated_at: new Date().toISOString() };
        }
        return c;
      })
    );
  }

  const DATE_RANGES = [
    { label: "Today", value: "today" as DateRange },
    { label: "This week", value: "week" as DateRange },
    { label: "This month", value: "month" as DateRange },
    { label: "All time", value: "all" as DateRange },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="px-6 py-4 flex flex-col gap-4"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        {/* AI search */}
        <AISearchPanel
          branch={branch}
          onResults={(ids) => setAiResultIds(ids)}
          onClear={() => setAiResultIds(null)}
        />

        {/* Text search + actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <input
            className="input-line flex-1"
            style={{ minWidth: "8rem", maxWidth: "16rem" }}
            placeholder="Name, phone, email..."
            value={textSearch}
            onChange={(e) => setTextSearch(e.target.value)}
          />

          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowVoice(true)}
              className="btn btn-ghost"
              title="Voice command"
            >
              ◎ Voice
            </button>
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

        {/* Tag filters */}
        <div className="flex flex-wrap gap-1.5">
          {TAG_FILTERS.map((tag) => {
            const active = tagFilter === tag;
            const cls = `tag tag-${tag.toLowerCase().replace(/ /g, "-")}`;
            return (
              <button
                key={tag}
                onClick={() => setTagFilter(active ? null : tag)}
                className={cls}
                style={{
                  cursor: "pointer",
                  opacity: active ? 1 : 0.5,
                  background: active ? undefined : "transparent",
                  border: "1px solid currentColor",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count / stats bar */}
      <div
        className="px-6 py-2 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <span className="label" style={{ color: "var(--muted)" }}>
          {loading ? "Loading..." : (
            <>
              {sorted.length} client{sorted.length !== 1 ? "s" : ""}
              {" · "}
              ${sorted.reduce((s, c) => s + totalSpend(c), 0).toLocaleString()} revenue
              {" · "}
              {sorted.filter((c) => deriveTags(c).includes("VIP")).length} VIP
              {aiResultIds !== null && " — AI search active"}
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
            disabled={aiResultIds !== null}
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
            <p className="font-serif" style={{ fontSize: "1.1rem", fontStyle: "italic", color: "var(--muted)" }}>
              No entries found
            </p>
            <button onClick={openNew} className="btn btn-primary">+ New entry</button>
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
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid var(--line)" }}
                  onClick={() => openEdit(client)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {/* Avatar */}
                  <div className={`avatar ${isVip ? "avatar-vip" : ""}`}>
                    {initials(client.name)}
                  </div>

                  {/* Info */}
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>{client.name}</span>
                      <div className="flex gap-1 flex-wrap">
                        {tags.slice(0, 3).map((tag) => (
                          <span key={tag} className={`tag tag-${tag.toLowerCase().replace(/ /g, "-")}`}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="label" style={{ color: "var(--muted)" }}>{client.branch}</span>
                      <span className="label" style={{ color: "var(--muted)" }}>Last: {lastVisitStr}</span>
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-1">
                    {spend > 0 && (
                      <span className="label" style={{ color: isVip ? "var(--vip)" : "var(--ink)" }}>
                        ${spend.toLocaleString()}
                      </span>
                    )}
                    {client.alteration_status && client.alteration_status !== "Picked up" && (
                      <span
                        className="label"
                        style={{
                          color: client.alteration_status === "Ready" ? "var(--good)" : "var(--muted)",
                          fontSize: "0.55rem",
                        }}
                      >
                        Alt: {client.alteration_status}
                      </span>
                    )}
                    {client.special_order_status && client.special_order_status !== "Picked up" && (
                      <span
                        className="label"
                        style={{
                          color: client.special_order_status === "Arrived" ? "var(--good)" : "var(--muted)",
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
      </div>

      {/* Modals */}
      {showModal && (
        <ClientModal
          client={selectedClient}
          defaultBranch={branch !== "All" ? branch : undefined}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {showVoice && (
        <VoiceCommand
          clients={clients}
          onApply={handleVoiceApply}
          onClose={() => setShowVoice(false)}
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
