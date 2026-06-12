"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo } from "react";
import type { Client, Branch } from "@/lib/types";
import { getClients, updateClient } from "@/app/actions/clients";
import { getUserProfile, type UserProfile } from "@/lib/user-role";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { deriveTags } from "@/lib/types";
import ClientModal from "@/components/ClientModal";
import PhotoIntake from "@/components/PhotoIntake";
import { addAnonymousSale } from "@/app/actions/anonymous";
import { todayStr } from "@/lib/dates";

type FilterTab = "all" | "followup" | "altready" | "vip";

interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

interface ConfirmState {
  client: Client;
}

export default function IntakePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [markingReady, setMarkingReady] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showAnon, setShowAnon] = useState(false);
  const [anonItems, setAnonItems] = useState([{ item: "", amount: "" }]);
  const [anonSaving, setAnonSaving] = useState(false);

  useEffect(() => {
    getUserProfile().then(async (p) => {
      if (!p) {
        router.push("/login");
        return;
      }
      if (p.role === "owner" || p.role === "admin") {
        router.push("/");
        return;
      }
      setProfile(p);
      const all = await getClients();
      setClients(all.filter((c) => c.branch === p.branch));
      setLoading(false);
    });
  }, [router]);

  async function refreshClients(branch: string) {
    const all = await getClients();
    setClients(all.filter((c) => c.branch === branch));
  }

  function addToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }

  async function handleMarkReady(client: Client) {
    setConfirm(null);
    setMarkingReady(client.id);
    try {
      const updated = await updateClient(client.id, {
        name: client.name,
        phone: client.phone,
        email: client.email,
        branch: client.branch,
        events: client.events ?? [],
        event_date: client.event_date,
        event_note: client.event_note,
        alterations: client.alterations ?? [],
        alteration_note: client.alteration_note,
        alteration_status: "Ready",
        special_order: client.special_order,
        special_order_status: client.special_order_status,
        follow_up: client.follow_up ?? { needed: false },
        measurements: client.measurements,
        visits: client.visits ?? [],
      });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      addToast(`${client.name}'s alterations marked Ready.`);
    } catch {
      addToast("Failed to update alteration status.", "error");
    } finally {
      setMarkingReady(null);
    }
  }

  function closeAnonOverlay() {
    setShowAnon(false);
    setAnonItems([{ item: "", amount: "" }]);
  }

  async function handleAnonSave() {
    if (!profile) return;
    const validItems = anonItems
      .filter((i) => i.item.trim() && parseFloat(i.amount) > 0)
      .map((i) => ({ item: i.item.trim(), amount: parseFloat(i.amount) }));
    if (!validItems.length) return;
    setAnonSaving(true);
    try {
      await addAnonymousSale({ branch: profile.branch, items: validItems, staff: profile.name });
      addToast("Sale logged");
      closeAnonOverlay();
    } catch {
      addToast("Failed to log sale.", "error");
    } finally {
      setAnonSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const today = todayStr();
  const todayCount = clients.filter((c) =>
    (c.visits ?? []).some((v) => v.date === today)
  ).length;
  const followUpCount = clients.filter((c) => c.follow_up?.needed).length;
  const altReadyCount = clients.filter((c) => c.alteration_status === "Ready").length;

  const visible = useMemo(() => {
    let list = clients;
    if (filter === "followup") list = list.filter((c) => c.follow_up?.needed);
    else if (filter === "altready") list = list.filter((c) => c.alteration_status === "Ready");
    else if (filter === "vip") list = list.filter((c) => deriveTags(c).includes("VIP"));

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
      );
    }

    return [...list].sort((a, b) => {
      const aDate = (a.visits ?? []).at(-1)?.date ?? a.created_at;
      const bDate = (b.visits ?? []).at(-1)?.date ?? b.created_at;
      return bDate.localeCompare(aDate);
    });
  }, [clients, filter, search]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p className="label" style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  const FILTER_TABS: { value: FilterTab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "followup", label: "Follow-ups" },
    { value: "altready", label: "Alt. Ready" },
    { value: "vip", label: "VIP" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)", display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--line)", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <svg viewBox="0 0 180 36" height="32" width="160" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
          <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
          <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
          <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.7rem", color: "var(--ink)" }}>{profile.name}</p>
            <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>{profile.branch}</p>
          </div>
          <button
            onClick={handleSignOut}
            style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.55rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)", background: "none", border: "none", cursor: "pointer", padding: "0.5rem" }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "0.75rem 1.5rem", display: "flex", gap: "2.5rem", flexShrink: 0 }}>
        <div>
          <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "1.3rem", fontWeight: 600, color: "var(--ink)", lineHeight: 1 }}>{todayCount}</p>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.2rem" }}>Today</p>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "1.3rem", fontWeight: 600, color: "var(--danger)", lineHeight: 1 }}>{followUpCount}</p>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.2rem" }}>Follow-ups</p>
        </div>
        <div>
          <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "1.3rem", fontWeight: 600, color: "var(--good)", lineHeight: 1 }}>{altReadyCount}</p>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.2rem" }}>Alt. Ready</p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "0.75rem 1.5rem", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <input
          className="input-line"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: "1 1 180px", minWidth: 140, fontSize: "0.78rem" }}
        />
        <div style={{ display: "flex" }}>
          {FILTER_TABS.map((tab, idx) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className="label"
              style={{
                padding: "0.45rem 0.85rem",
                background: filter === tab.value ? "var(--ink)" : "transparent",
                color: filter === tab.value ? "var(--paper)" : "var(--muted)",
                border: "1px solid var(--line)",
                borderRight: idx < FILTER_TABS.length - 1 ? "none" : "1px solid var(--line)",
                cursor: "pointer",
                letterSpacing: "0.12em",
                fontSize: "0.6rem",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary label"
          onClick={() => { setSelectedClient(null); setShowModal(true); }}
          style={{ fontSize: "0.65rem", padding: "0.5rem 1rem", letterSpacing: "0.15em" }}
        >
          + New Entry
        </button>
        <button
          className="btn label"
          onClick={() => setShowAnon(true)}
          style={{ whiteSpace: "nowrap", fontSize: "0.6rem", padding: "0.5rem 1rem" }}
        >
          + Anon Sale
        </button>
        <button
          className="btn label"
          onClick={() => setShowPhoto(true)}
          style={{ fontSize: "0.65rem", padding: "0.5rem 1rem", letterSpacing: "0.15em" }}
        >
          Photo Intake
        </button>
      </div>

      {/* Client list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 1.5rem 2rem" }}>
        {visible.length === 0 ? (
          <p style={{ marginTop: "3rem", textAlign: "center", fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic", fontFamily: "var(--font-outfit), system-ui" }}>
            {search || filter !== "all" ? "No clients match this filter." : "No clients yet. Add the first entry."}
          </p>
        ) : (
          visible.map((client) => {
            const tags = deriveTags(client);
            const lastVisit = (client.visits ?? []).at(-1);
            const needsMarkReady =
              client.alteration_status === "Received" || client.alteration_status === "In progress";
            return (
              <div
                key={client.id}
                style={{ borderBottom: "1px solid var(--line)", padding: "0.9rem 0", display: "flex", alignItems: "center", gap: "1rem", cursor: "pointer" }}
                onClick={() => { setSelectedClient(client); setShowModal(true); }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.9rem", color: "var(--ink)", fontWeight: 500 }}>
                      {client.name}
                    </p>
                    {tags.includes("VIP") && (
                      <span className="label" style={{ fontSize: "0.5rem", color: "var(--vip)", letterSpacing: "0.2em" }}>VIP</span>
                    )}
                    {client.follow_up?.needed && (
                      <span className="label" style={{ fontSize: "0.5rem", color: "var(--danger)", letterSpacing: "0.15em" }}>FOLLOW-UP</span>
                    )}
                  </div>
                  <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.7rem", color: "var(--muted)", marginTop: "0.15rem" }}>
                    {client.phone}
                    {lastVisit && (
                      <> &middot; {new Date(lastVisit.date + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</>
                    )}
                    {client.alteration_status && (
                      <>
                        {" "}&middot;{" "}
                        <span style={{ color: client.alteration_status === "Ready" ? "var(--good)" : "var(--warn)" }}>
                          {client.alteration_status}
                        </span>
                      </>
                    )}
                  </p>
                </div>
                {needsMarkReady && (
                  <button
                    className="btn label"
                    onClick={(e) => { e.stopPropagation(); setConfirm({ client }); }}
                    disabled={markingReady === client.id}
                    style={{ fontSize: "0.55rem", padding: "0.4rem 0.75rem", letterSpacing: "0.12em", flexShrink: 0, borderColor: "var(--good)", color: "var(--good)" }}
                  >
                    {markingReady === client.id ? "…" : "Alteration Ready"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }}
          onClick={() => setConfirm(null)}
        >
          <div
            style={{ background: "var(--paper)", border: "1px solid var(--line)", padding: "2rem", maxWidth: 360, width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.9rem", color: "var(--ink)", marginBottom: "0.5rem" }}>
              Mark alterations ready?
            </p>
            <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.78rem", color: "var(--muted)", marginBottom: "1.5rem" }}>
              {confirm.client.name}&rsquo;s alterations will be marked <strong>Ready for pickup</strong>.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                className="btn label"
                onClick={() => setConfirm(null)}
                style={{ fontSize: "0.65rem", letterSpacing: "0.12em" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary label"
                onClick={() => handleMarkReady(confirm.client)}
                style={{ fontSize: "0.65rem", letterSpacing: "0.12em" }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notifications */}
      <div style={{ position: "fixed", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: "0.5rem", zIndex: 70, pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: t.type === "error" ? "var(--danger)" : "var(--ink)",
              color: "var(--paper)",
              padding: "0.6rem 1.2rem",
              fontFamily: "var(--font-outfit), system-ui",
              fontSize: "0.75rem",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* New / edit client modal */}
      {showModal && (
        <ClientModal
          client={selectedClient ?? undefined}
          defaultBranch={profile.branch as Branch}
          onClose={() => { setShowModal(false); setSelectedClient(null); }}
          onSaved={async () => {
            setShowModal(false);
            setSelectedClient(null);
            await refreshClients(profile.branch);
            addToast("Client saved.");
          }}
        />
      )}

      {/* Anonymous sale overlay */}
      {showAnon && profile && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
          onClick={closeAnonOverlay}
        >
          <div
            style={{ background: "var(--paper)", border: "1px solid var(--line)", padding: "1.5rem", maxWidth: 420, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p className="label" style={{ color: "var(--ink)", fontSize: "0.6rem" }}>
                ANONYMOUS SALE · {profile.branch.toUpperCase()}
              </p>
              <button onClick={closeAnonOverlay} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", color: "var(--muted)" }}>×</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
              {anonItems.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    className="input-line"
                    placeholder="Item (e.g. black suit)"
                    value={item.item}
                    onChange={(e) => {
                      const next = [...anonItems];
                      next[i] = { ...next[i], item: e.target.value };
                      setAnonItems(next);
                    }}
                    style={{ flex: 2, fontSize: "0.8rem" }}
                    autoFocus={i === 0}
                  />
                  <input
                    className="input-line"
                    type="number"
                    placeholder="$"
                    value={item.amount}
                    onChange={(e) => {
                      const next = [...anonItems];
                      next[i] = { ...next[i], amount: e.target.value };
                      setAnonItems(next);
                    }}
                    style={{ flex: 1, fontSize: "0.8rem" }}
                  />
                  {anonItems.length > 1 && (
                    <button
                      onClick={() => setAnonItems(anonItems.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "1.1rem", flexShrink: 0, padding: "0 0.25rem" }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              className="btn btn-ghost label"
              onClick={() => setAnonItems([...anonItems, { item: "", amount: "" }])}
              style={{ fontSize: "0.6rem", marginBottom: "1.25rem" }}
            >
              + Add item
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.7rem", color: "var(--muted)" }}>
                Staff: {profile.name}
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button className="btn label" onClick={closeAnonOverlay} style={{ fontSize: "0.6rem" }}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary label"
                  onClick={handleAnonSave}
                  disabled={anonSaving}
                  style={{ fontSize: "0.6rem" }}
                >
                  {anonSaving ? "Saving…" : "Save Sale"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo intake overlay */}
      {showPhoto && (
        <PhotoIntake
          defaultBranch={profile.branch as Branch}
          onImport={(imported) => {
            setClients((prev) => {
              const existingIds = new Set(prev.map((c) => c.id));
              return [...imported.filter((c) => !existingIds.has(c.id)), ...prev];
            });
            setShowPhoto(false);
            addToast(`${imported.length} client(s) imported.`);
          }}
          onClose={() => setShowPhoto(false)}
        />
      )}
    </div>
  );
}
