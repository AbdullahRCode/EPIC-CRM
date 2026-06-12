"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Client,
  Branch,
  Visit,
  VisitReason,
  AlterationStatus,
  SpecialOrderStatus,
  EventType,
  Measurements,
} from "@/lib/types";
import {
  BRANCHES,
  VISIT_REASONS,
  EVENT_TYPES,
  ALTERATION_STATUSES,
  SPECIAL_ORDER_STATUSES,
  deriveTags,
} from "@/lib/types";
import { updateClient, deleteClient } from "@/app/actions/clients";
import { getUserProfile, type UserProfile } from "@/lib/user-role";
import { todayStr } from "@/lib/dates";
import StatusPipeline from "./StatusPipeline";

/* ─────────────────────────────────────────────────────────────────────────
   Tabbed, click-to-edit client detail view (slide-over).
   Every save goes through updateClient — the allowlisted, validated server
   action — one field at a time, so a typo fix can't clobber other fields.
   ───────────────────────────────────────────────────────────────────────── */

type Tab = "profile" | "visits" | "measurements" | "notes";

const TABS: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "visits", label: "Visits" },
  { id: "measurements", label: "Measurements" },
  { id: "notes", label: "Notes & Status" },
];

interface ClientDetailProps {
  client: Client;
  onClose: () => void;
  /** Called after each successful field save — sync parent lists, keep open. */
  onUpdated?: (client: Client) => void;
  onDelete?: (id: string) => void;
}

/* ── Click-to-edit field ─────────────────────────────────────────────── */

interface EditableFieldProps {
  label: string;
  value: string;
  type?: "text" | "number" | "date" | "textarea" | "select";
  options?: readonly string[];
  placeholder?: string;
  readOnly?: boolean;
  readOnlyHint?: string;
  onSave: (v: string) => Promise<void>;
}

function EditableField({
  label,
  value,
  type = "text",
  options,
  placeholder = "—",
  readOnly = false,
  readOnlyHint,
  onSave,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function begin() {
    if (readOnly) return;
    setDraft(value);
    setError("");
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError("");
  }

  async function save() {
    if (draft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && type !== "textarea") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape") cancel();
  }

  const inputStyle = { minHeight: 38, fontSize: "0.88rem" };

  return (
    <div className="ef">
      <p className="label" style={{ fontSize: "0.55rem", marginBottom: "0.25rem" }}>
        {label}
        {readOnly && readOnlyHint && (
          <span style={{ marginLeft: "0.5rem", letterSpacing: "0.1em", opacity: 0.7 }}>
            · {readOnlyHint}
          </span>
        )}
      </p>

      {!editing ? (
        <button
          type="button"
          className={`ef-value ${readOnly ? "ef-readonly" : ""}`}
          onClick={begin}
          title={readOnly ? readOnlyHint : "Click to edit"}
        >
          <span style={{ color: value ? "var(--ink)" : "var(--muted)", whiteSpace: "pre-wrap" }}>
            {value || placeholder}
          </span>
          {!readOnly && <span className="ef-pencil">✎</span>}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {type === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              className="input-line"
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              style={{ resize: "vertical" }}
            />
          ) : type === "select" ? (
            <select
              ref={inputRef as React.RefObject<HTMLSelectElement>}
              className="input-line"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              style={inputStyle}
            >
              {(options ?? []).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              className="input-line"
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              style={inputStyle}
            />
          )}
          {error && (
            <p className="label" style={{ color: "var(--danger)", fontSize: "0.55rem" }}>{error}</p>
          )}
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={saving} style={{ fontSize: "0.6rem", padding: "0.35rem 0.8rem" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost" onClick={cancel} disabled={saving} style={{ fontSize: "0.6rem", padding: "0.35rem 0.8rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────── */

export default function ClientDetail({ client: initial, onClose, onUpdated, onDelete }: ClientDetailProps) {
  const [client, setClient] = useState<Client>(initial);
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    getUserProfile().then(setProfile);
  }, []);

  const isStaffManager = profile?.role === "owner" || profile?.role === "admin";
  const tags = deriveTags(client);

  /** Single-field save through the validated server action. */
  async function saveFields(updates: Partial<Client>) {
    const saved = await updateClient(client.id, updates);
    setClient(saved);
    onUpdated?.(saved);
  }

  async function saveMeasurement(key: keyof Measurements, v: string) {
    await saveFields({ measurements: { ...(client.measurements ?? {}), [key]: v } });
  }

  async function toggleEvent(ev: EventType) {
    const events = client.events.includes(ev)
      ? client.events.filter((e) => e !== ev)
      : [...client.events, ev];
    await saveFields({ events });
  }

  async function saveStatus(updates: Partial<Client>) {
    setStatusError("");
    try {
      await saveFields(updates);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this client? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteClient(client.id);
      onDelete?.(client.id);
      onClose();
    } catch {
      setStatusError("Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const lastVisit = [...(client.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

  return (
    <div className="modal-overlay" style={{ overflowY: "auto" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="slide-right h-full overflow-y-auto flex flex-col"
        style={{
          width: "min(520px, 100vw)",
          maxHeight: "100vh",
          background: "var(--paper)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 pt-4 pb-0"
          style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-serif" style={{ fontSize: "1.35rem", fontStyle: "italic", lineHeight: 1.2 }}>
                {client.name}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {tags.map((t) => (
                  <span key={t} className={`tag tag-${t.toLowerCase().replace(/ /g, "-")}`}>{t}</span>
                ))}
                {lastVisit && (
                  <span className="label" style={{ fontSize: "0.5rem" }}>
                    Last visit {lastVisit.date}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="label flex-shrink-0"
              style={{ fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", minHeight: 44, paddingTop: 4 }}
            >
              Close
            </button>
          </div>

          {/* Tab rail */}
          <div className="flex gap-1 mt-3" role="tablist">
            {TABS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className="label"
                  style={{
                    padding: "0.6rem 0.75rem",
                    fontSize: "0.58rem",
                    letterSpacing: "0.18em",
                    background: "none",
                    border: "none",
                    borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                    color: active ? "var(--ink)" : "var(--muted)",
                    cursor: "pointer",
                    transition: "color 0.15s, border-color 0.15s",
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div key={tab} className="flex-1 px-6 py-5 flex flex-col gap-5 tab-fade">

          {/* ── PROFILE ── */}
          {tab === "profile" && (
            <>
              <EditableField label="Name" value={client.name} onSave={(v) => saveFields({ name: v })} />
              <EditableField label="Phone" value={client.phone} onSave={(v) => saveFields({ phone: v })} />
              <EditableField label="Email" value={client.email ?? ""} placeholder="No email" onSave={(v) => saveFields({ email: v })} />
              <EditableField
                label="Branch"
                value={client.branch}
                type="select"
                options={BRANCHES}
                readOnly={!isStaffManager}
                readOnlyHint="owner/admin only"
                onSave={(v) => saveFields({ branch: v as Branch })}
              />

              <div>
                <p className="label" style={{ fontSize: "0.55rem", marginBottom: "0.4rem" }}>Occasions</p>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_TYPES.map((ev) => {
                    const on = client.events.includes(ev);
                    return (
                      <button
                        key={ev}
                        onClick={() => toggleEvent(ev)}
                        className="label"
                        style={{
                          padding: "0.4rem 0.7rem",
                          fontSize: "0.55rem",
                          border: "1px solid",
                          borderColor: on ? "var(--ink)" : "var(--line)",
                          background: on ? "var(--ink)" : "transparent",
                          color: on ? "var(--paper)" : "var(--muted)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {ev}
                      </button>
                    );
                  })}
                </div>
              </div>

              <EditableField label="Event date" value={client.event_date ?? ""} type="date" placeholder="No date" onSave={(v) => saveFields({ event_date: v || undefined })} />
              <EditableField label="Event note" value={client.event_note ?? ""} type="textarea" placeholder="—" onSave={(v) => saveFields({ event_note: v })} />
            </>
          )}

          {/* ── VISITS ── */}
          {tab === "visits" && (
            <VisitsTab client={client} canDeleteVisits={isStaffManager} onSave={saveFields} />
          )}

          {/* ── MEASUREMENTS ── */}
          {tab === "measurements" && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.1rem 1.5rem" }}>
                {(["chest", "waist", "sleeve", "inseam", "neck", "shoulder"] as const).map((m) => (
                  <EditableField
                    key={m}
                    label={m[0].toUpperCase() + m.slice(1)}
                    value={client.measurements?.[m] ?? ""}
                    placeholder="—"
                    onSave={(v) => saveMeasurement(m, v)}
                  />
                ))}
              </div>
              <EditableField
                label="Fit notes"
                value={client.measurements?.notes ?? ""}
                type="textarea"
                placeholder="e.g. Mantoni 42R fits well"
                onSave={(v) => saveMeasurement("notes", v)}
              />
            </>
          )}

          {/* ── NOTES & STATUS ── */}
          {tab === "notes" && (
            <>
              <div>
                <p className="label" style={{ fontSize: "0.55rem", marginBottom: "0.5rem" }}>Alteration status</p>
                <StatusPipeline
                  stages={ALTERATION_STATUSES}
                  current={client.alteration_status ?? "Received"}
                  onChange={(s) => saveStatus({ alteration_status: s as AlterationStatus })}
                  colorScheme="good"
                />
              </div>
              {client.alteration_status === "Ready" && (
                <NotifyButton clientId={client.id} hasEmail={Boolean(client.email?.trim())} />
              )}
              <EditableField
                label="Alteration note"
                value={client.alteration_note ?? ""}
                type="textarea"
                placeholder="Specific alteration instructions…"
                onSave={(v) => saveFields({ alteration_note: v })}
              />

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.1rem" }}>
                <EditableField
                  label="Special order"
                  value={client.special_order ?? ""}
                  placeholder="No special order"
                  onSave={(v) => saveFields({ special_order: v })}
                />
                {client.special_order?.trim() && (
                  <div style={{ marginTop: "0.9rem" }}>
                    <p className="label" style={{ fontSize: "0.55rem", marginBottom: "0.5rem" }}>Order status</p>
                    <StatusPipeline
                      stages={SPECIAL_ORDER_STATUSES}
                      current={client.special_order_status ?? "Received"}
                      onChange={(s) => saveStatus({ special_order_status: s as SpecialOrderStatus })}
                      colorScheme="good"
                    />
                  </div>
                )}
              </div>

              <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.1rem" }} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="cd-followup"
                    checked={client.follow_up?.needed ?? false}
                    onChange={(e) =>
                      saveStatus({ follow_up: { needed: e.target.checked, reason: client.follow_up?.reason ?? "" } })
                    }
                    style={{ accentColor: "var(--ink)", width: 18, height: 18 }}
                  />
                  <label htmlFor="cd-followup" className="label" style={{ cursor: "pointer", color: "var(--ink)" }}>
                    Follow-up needed
                  </label>
                </div>
                {client.follow_up?.needed && (
                  <EditableField
                    label="Follow-up reason"
                    value={client.follow_up?.reason ?? ""}
                    placeholder="Why follow up?"
                    onSave={(v) => saveFields({ follow_up: { needed: true, reason: v } })}
                  />
                )}
              </div>

              {statusError && (
                <p className="label" style={{ color: "var(--danger)", fontSize: "0.6rem" }}>{statusError}</p>
              )}

              <ClientAINote client={client} />
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 px-6 py-3 flex items-center justify-between"
          style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}
        >
          {isStaffManager ? (
            <button onClick={handleDelete} className="btn btn-danger" disabled={deleting} style={{ fontSize: "0.6rem" }}>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          ) : (
            <span className="label" style={{ fontSize: "0.5rem" }}>Edits save instantly per field</span>
          )}
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: "0.6rem" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Notify client (alterations ready) ───────────────────────────────── */

function NotifyButton({ clientId, hasEmail }: { clientId: string; hasEmail: boolean }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  if (!hasEmail) {
    return (
      <p className="label" style={{ color: "var(--muted)", fontSize: "0.6rem" }}>
        Add an email address to notify this client their alterations are ready.
      </p>
    );
  }

  async function send() {
    setState("sending");
    try {
      const res = await fetch("/api/comms/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, statusType: "alteration_ready" }),
      });
      setState(res.ok ? "sent" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="btn label"
        onClick={send}
        disabled={state === "sending" || state === "sent"}
        style={{ fontSize: "0.6rem", letterSpacing: "0.12em", borderColor: "var(--good)", color: "var(--good)" }}
      >
        {state === "sending" ? "Sending…" : state === "sent" ? "✓ Email sent" : "✉ Email client — ready for pickup"}
      </button>
      {state === "failed" && (
        <span className="label" style={{ color: "var(--danger)", fontSize: "0.6rem" }}>
          Send failed — try again
        </span>
      )}
    </div>
  );
}

/* ── AI note ─────────────────────────────────────────────────────────── */

function ClientAINote({ client }: { client: Client }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const visits = client.visits ?? [];
      const totalSpend = visits.reduce((s, v) => s + (v.spend ?? 0), 0);
      const lastVisit = visits.length
        ? [...visits].sort((a, b) => b.date.localeCompare(a.date))[0].date
        : null;

      const prompt = `You are the EPIC Menswear CRM assistant. Write a 1-2 sentence smart note about this client for the store staff. Be specific and actionable. Mention their history, what they bought, any alterations, and suggest a follow-up action if relevant.

Client: ${client.name}
Branch: ${client.branch}
Total spend: $${totalSpend}
Visits: ${visits.length}
Last visit: ${lastVisit ?? "unknown"}
Alteration status: ${client.alteration_status ?? "none"}
Alteration note: ${client.alteration_note ?? "none"}
Follow-up needed: ${client.follow_up?.needed ? "yes — " + (client.follow_up.reason ?? "") : "no"}

Write only the note, no preamble.`;

      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: prompt, mode: "note" }),
      });
      const data = await res.json();
      setNote(data.result ?? "");
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
      <div className="flex items-center justify-between mb-2">
        <p className="label" style={{ fontSize: "0.55rem" }}>✦ AI Note</p>
        {!generated && (
          <button
            onClick={generate}
            disabled={loading}
            className="label"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.15em", textTransform: "uppercase" }}
          >
            {loading ? "Thinking..." : "Generate"}
          </button>
        )}
      </div>
      {generated && note && (
        <p className="font-serif" style={{ fontSize: "0.88rem", fontStyle: "italic", lineHeight: 1.6 }}>
          {note}
        </p>
      )}
      {!generated && !loading && (
        <p style={{ fontSize: "0.75rem", color: "var(--muted)", fontStyle: "italic" }}>
          Tap generate for an AI summary of this client.
        </p>
      )}
    </div>
  );
}

/* ── Visits tab ──────────────────────────────────────────────────────── */

function VisitsTab({
  client,
  canDeleteVisits,
  onSave,
}: {
  client: Client;
  canDeleteVisits: boolean;
  onSave: (u: Partial<Client>) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<Visit>>({ date: todayStr(), reason: "Walk-in (purchased)" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const visits = [...(client.visits ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  const totalSpend = visits.reduce((s, v) => s + (v.spend ?? 0), 0);

  async function saveVisits(next: Visit[]) {
    setSaving(true);
    setError("");
    try {
      await onSave({ visits: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      throw err;
    } finally {
      setSaving(false);
    }
  }

  async function addVisit() {
    if (!draft.date || !draft.reason) return;
    const visit: Visit = {
      id: crypto.randomUUID(),
      date: draft.date,
      reason: draft.reason as VisitReason,
      items: draft.items ?? "",
      spend: draft.spend != null && !Number.isNaN(Number(draft.spend)) ? Number(draft.spend) : undefined,
      staff: draft.staff ?? "",
      notes: draft.notes ?? "",
    };
    try {
      await saveVisits([...(client.visits ?? []), visit]);
      setDraft({ date: todayStr(), reason: "Walk-in (purchased)" });
      setAdding(false);
    } catch {
      /* error already shown */
    }
  }

  async function patchVisit(id: string, patch: Partial<Visit>) {
    await saveVisits((client.visits ?? []).map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  async function removeVisit(id: string) {
    if (!window.confirm("Remove this visit? Spend history changes too.")) return;
    await saveVisits((client.visits ?? []).filter((v) => v.id !== id));
  }

  return (
    <>
      <div className="flex items-baseline justify-between">
        <p className="label" style={{ fontSize: "0.55rem" }}>
          {visits.length} visit{visits.length !== 1 ? "s" : ""} · lifetime ${totalSpend.toLocaleString()}
        </p>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn btn-ghost" style={{ fontSize: "0.6rem" }}>
            + Log visit
          </button>
        )}
      </div>

      {error && <p className="label" style={{ color: "var(--danger)", fontSize: "0.55rem" }}>{error}</p>}

      {adding && (
        <div className="flex flex-col gap-3 p-4" style={{ background: "var(--paper-2)", border: "1px solid var(--line)" }}>
          <p className="section-title">New visit</p>
          <input type="date" className="input-line" value={draft.date ?? ""} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} />
          <select className="input-line" value={draft.reason ?? ""} onChange={(e) => setDraft((d) => ({ ...d, reason: e.target.value as VisitReason }))}>
            {VISIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="input-line" placeholder="Items (e.g. Navy suit, white shirt)" value={draft.items ?? ""} onChange={(e) => setDraft((d) => ({ ...d, items: e.target.value }))} />
          <input className="input-line" type="number" placeholder="Spend ($)" value={draft.spend ?? ""} onChange={(e) => setDraft((d) => ({ ...d, spend: e.target.value === "" ? undefined : Number(e.target.value) }))} />
          <input className="input-line" placeholder="Staff" value={draft.staff ?? ""} onChange={(e) => setDraft((d) => ({ ...d, staff: e.target.value }))} />
          <textarea className="input-line" rows={2} placeholder="Notes" value={draft.notes ?? ""} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} style={{ resize: "vertical" }} />
          <div className="flex gap-2">
            <button onClick={addVisit} className="btn btn-primary" disabled={saving} style={{ fontSize: "0.6rem" }}>
              {saving ? "Saving…" : "Add visit"}
            </button>
            <button onClick={() => setAdding(false)} className="btn btn-ghost" disabled={saving} style={{ fontSize: "0.6rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col">
        {visits.length === 0 && !adding && (
          <p style={{ fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>No visits recorded yet.</p>
        )}
        {visits.map((v) => (
          <div key={v.id} className="flex flex-col gap-2 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="label" style={{ color: "var(--ink)" }}>{v.date}</span>
              <div className="flex items-center gap-3">
                <span className="label" style={{ fontSize: "0.55rem" }}>{v.reason}</span>
                {canDeleteVisits && (
                  <button
                    onClick={() => removeVisit(v.id)}
                    className="label"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: "0.5rem" }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.25rem" }}>
              <EditableField label="Items" value={v.items ?? ""} onSave={(val) => patchVisit(v.id, { items: val })} />
              <EditableField
                label="Spend ($)"
                value={v.spend != null ? String(v.spend) : ""}
                type="number"
                onSave={(val) => patchVisit(v.id, { spend: val === "" ? undefined : Number(val) })}
              />
              <EditableField label="Staff" value={v.staff ?? ""} onSave={(val) => patchVisit(v.id, { staff: val })} />
              <EditableField label="Date" value={v.date} type="date" onSave={(val) => patchVisit(v.id, { date: val })} />
            </div>
            <EditableField label="Notes" value={v.notes ?? ""} type="textarea" onSave={(val) => patchVisit(v.id, { notes: val })} />
          </div>
        ))}
      </div>
    </>
  );
}
