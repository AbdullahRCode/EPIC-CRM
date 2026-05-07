"use client";

import { useState } from "react";
import type {
  Client,
  Branch,
  VisitReason,
  EventType,
  AlterationItem,
  AlterationStatus,
  SpecialOrderStatus,
  Visit,
} from "@/lib/types";
import {
  BRANCHES,
  VISIT_REASONS,
  EVENT_TYPES,
  ALTERATION_ITEMS,
  ALTERATION_STATUSES,
  SPECIAL_ORDER_STATUSES,
  deriveTags,
} from "@/lib/types";
import { createClient, updateClient, deleteClient } from "@/app/actions/clients";
import StatusPipeline from "./StatusPipeline";
import MultiSelect from "./MultiSelect";
// Use the browser's built-in Web Crypto API — avoids Node polyfill issues in client components
const uid = () => crypto.randomUUID();

interface ClientModalProps {
  client?: Client;
  defaultBranch?: Branch;
  onClose: () => void;
  onSave: (client: Client) => void;
  onDelete?: (id: string) => void;
}

function initClient(defaultBranch?: Branch): Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at"> {
  return {
    name: "",
    phone: "",
    email: "",
    branch: defaultBranch ?? "Surrey - Guildford",
    events: [],
    event_date: undefined,
    event_note: "",
    alterations: [],
    alteration_note: "",
    alteration_status: undefined,
    special_order: "",
    special_order_status: undefined,
    follow_up: { needed: false, reason: "" },
    measurements: {},
    visits: [],
  };
}

export default function ClientModal({
  client: initialClient,
  defaultBranch,
  onClose,
  onSave,
  onDelete,
}: ClientModalProps) {
  const isNew = !initialClient;
  const [form, setForm] = useState<Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at">>(
    initialClient
      ? {
          name: initialClient.name,
          phone: initialClient.phone,
          email: initialClient.email ?? "",
          branch: initialClient.branch,
          events: initialClient.events ?? [],
          event_date: initialClient.event_date,
          event_note: initialClient.event_note ?? "",
          alterations: initialClient.alterations ?? [],
          alteration_note: initialClient.alteration_note ?? "",
          alteration_status: initialClient.alteration_status,
          special_order: initialClient.special_order ?? "",
          special_order_status: initialClient.special_order_status,
          follow_up: initialClient.follow_up ?? { needed: false },
          measurements: initialClient.measurements ?? {},
          visits: initialClient.visits ?? [],
        }
      : initClient(defaultBranch)
  );

  const [newVisit, setNewVisit] = useState<Partial<Visit>>({
    date: new Date().toISOString().split("T")[0],
    reason: "Walk-in (purchased)",
  });
  const [addingVisit, setAddingVisit] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cleaningNote, setCleaningNote] = useState(false);
  const [section, setSection] = useState<"identity" | "visit" | "events" | "alterations" | "order" | "followup" | "measurements">("identity");
  const [notifying, setNotifying] = useState(false);

  const tags = initialClient ? deriveTags({ ...initialClient, ...form } as Client) : [];

  async function handleCleanNote() {
    if (!form.alteration_note?.trim()) return;
    setCleaningNote(true);
    try {
      const res = await fetch("/api/ai/clean-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: form.alteration_note, context: "alteration note" }),
      });
      const data = await res.json();
      setForm((f) => ({ ...f, alteration_note: data.cleaned }));
    } finally {
      setCleaningNote(false);
    }
  }

  async function handleCleanVisitNote(idx: number) {
    const visit = form.visits[idx];
    if (!visit?.notes?.trim()) return;
    setCleaningNote(true);
    try {
      const res = await fetch("/api/ai/clean-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: visit.notes, context: `visit on ${visit.date}` }),
      });
      const data = await res.json();
      const updated = [...form.visits];
      updated[idx] = { ...visit, notes: data.cleaned };
      setForm((f) => ({ ...f, visits: updated }));
    } finally {
      setCleaningNote(false);
    }
  }

  function addVisit() {
    if (!newVisit.date || !newVisit.reason) return;
    const visit: Visit = {
      id: uid(),
      date: newVisit.date,
      reason: newVisit.reason as VisitReason,
      items: newVisit.items ?? "",
      spend: newVisit.spend ? Number(newVisit.spend) : undefined,
      staff: newVisit.staff ?? "",
      notes: newVisit.notes ?? "",
    };
    setForm((f) => ({ ...f, visits: [...f.visits, visit] }));
    setNewVisit({ date: new Date().toISOString().split("T")[0], reason: "Walk-in (purchased)" });
    setAddingVisit(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      // If the user left the visit form open with data, commit it before saving
      let finalForm = { ...form };
      if (addingVisit && newVisit.date && newVisit.reason) {
        const pendingVisit: Visit = {
          id: uid(),
          date: newVisit.date,
          reason: newVisit.reason as VisitReason,
          items: newVisit.items ?? "",
          spend: newVisit.spend ? Number(newVisit.spend) : undefined,
          staff: newVisit.staff ?? "",
          notes: newVisit.notes ?? "",
        };
        finalForm = { ...finalForm, visits: [...finalForm.visits, pendingVisit] };
      }

      // Auto-clean alteration note on save (silently, only when not uncertain)
      if (finalForm.alteration_note?.trim()) {
        try {
          const res = await fetch("/api/ai/clean-note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ note: finalForm.alteration_note, context: "alteration note" }),
          });
          const cleaned = await res.json();
          if (!cleaned.uncertain) finalForm = { ...finalForm, alteration_note: cleaned.cleaned };
        } catch {
          // non-fatal — proceed with original note
        }
      }

      let saved: Client;
      if (isNew) {
        saved = await createClient(finalForm);
      } else {
        saved = await updateClient(initialClient!.id, finalForm);
      }
      onSave(saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setSaveError(msg);
      console.error("[ClientModal] Save error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialClient || !confirm("Delete this client? This cannot be undone.")) return;
    setDeleting(true);
    try {
      await deleteClient(initialClient.id);
      onDelete?.(initialClient.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  async function handleSendEmail(statusType: string) {
    if (!initialClient) return;
    setNotifying(true);
    try {
      await fetch("/api/comms/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: initialClient.id, statusType }),
      });
    } finally {
      setNotifying(false);
    }
  }

  const SECTIONS = [
    { id: "identity", label: "Identity" },
    { id: "visit", label: "Visit" },
    { id: "events", label: "Events" },
    { id: "alterations", label: "Alterations" },
    { id: "order", label: "Special Order" },
    { id: "followup", label: "Follow-up" },
    { id: "measurements", label: "Measurements" },
  ] as const;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="slide-right h-full overflow-y-auto flex flex-col"
        style={{
          width: "min(520px, 100vw)",
          background: "var(--paper)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        {/* Modal header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
          style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
        >
          <div>
            <p className="font-serif" style={{ fontSize: "1.2rem", fontStyle: "italic" }}>
              {isNew ? "New entry" : form.name}
            </p>
            {!isNew && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <span key={tag} className={`tag tag-${tag.toLowerCase().replace(" ", "-").replace(" ", "-")}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="label"
            style={{ fontSize: "0.75rem", background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
          >
            Close
          </button>
        </div>

        {/* Section tabs */}
        <div
          className="flex overflow-x-auto px-6 gap-0"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="label px-3 py-2.5 whitespace-nowrap flex-shrink-0"
              style={{
                background: "none",
                border: "none",
                borderBottom: section === s.id ? "2px solid var(--ink)" : "2px solid transparent",
                color: section === s.id ? "var(--ink)" : "var(--muted)",
                cursor: "pointer",
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-6 flex flex-col gap-6">

          {/* IDENTITY */}
          {section === "identity" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="label mb-1">Name *</p>
                <input
                  className="input-line"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <p className="label mb-1">Phone *</p>
                <input
                  className="input-line"
                  placeholder="+1 604 000 0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div>
                <p className="label mb-1">Email</p>
                <input
                  className="input-line"
                  placeholder="email@example.com"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <p className="label mb-1">Branch</p>
                <select
                  className="input-line"
                  value={form.branch}
                  onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* VISIT */}
          {section === "visit" && (
            <div className="flex flex-col gap-5">
              {/* Visit history */}
              {form.visits.length > 0 && (
                <div>
                  <p className="section-title">Visit history</p>
                  <div className="flex flex-col gap-3">
                    {[...form.visits].sort((a, b) => b.date.localeCompare(a.date)).map((v) => (
                      <div
                        key={v.id}
                        className="flex flex-col gap-1 py-3"
                        style={{ borderBottom: "1px solid var(--line)" }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="label" style={{ color: "var(--ink)" }}>{v.date}</span>
                          <span className="label" style={{ color: "var(--muted)" }}>{v.reason}</span>
                        </div>
                        {v.items && <p style={{ fontSize: "0.82rem" }}>{v.items}</p>}
                        {v.spend && (
                          <span className="label" style={{ color: "var(--good)" }}>
                            ${v.spend.toLocaleString()}
                          </span>
                        )}
                        {v.notes && (
                          <div className="flex items-start gap-2">
                            <p style={{ fontSize: "0.8rem", color: "var(--muted)", flex: 1 }}>{v.notes}</p>
                            <button
                              onClick={() => {
                                const idx = form.visits.findIndex((fv) => fv.id === v.id);
                                handleCleanVisitNote(idx);
                              }}
                              className="label"
                              disabled={cleaningNote}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--muted)",
                                fontSize: "0.55rem",
                                flexShrink: 0,
                              }}
                            >
                              {cleaningNote ? "Cleaning..." : "Clean with AI"}
                            </button>
                          </div>
                        )}
                        {v.staff && (
                          <span className="label" style={{ color: "var(--muted)" }}>
                            Staff: {v.staff}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add visit */}
              {!addingVisit ? (
                <button
                  onClick={() => setAddingVisit(true)}
                  className="btn btn-ghost"
                  style={{ alignSelf: "flex-start" }}
                >
                  + Log Visit
                </button>
              ) : (
                <div className="flex flex-col gap-4" style={{ padding: "1rem", background: "var(--paper-2)" }}>
                  <p className="section-title">New visit</p>
                  <div>
                    <p className="label mb-1">Date</p>
                    <input
                      type="date"
                      className="input-line"
                      value={newVisit.date ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Reason</p>
                    <select
                      className="input-line"
                      value={newVisit.reason ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, reason: e.target.value as VisitReason }))}
                    >
                      {VISIT_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="label mb-1">Items</p>
                    <input
                      className="input-line"
                      placeholder="e.g. Navy suit, white shirt"
                      value={newVisit.items ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, items: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Spend ($)</p>
                    <input
                      type="number"
                      className="input-line"
                      placeholder="0"
                      value={newVisit.spend ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, spend: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Staff</p>
                    <input
                      className="input-line"
                      placeholder="Staff name"
                      value={newVisit.staff ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, staff: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Notes</p>
                    <textarea
                      className="input-line"
                      placeholder="Any relevant notes..."
                      rows={3}
                      value={newVisit.notes ?? ""}
                      onChange={(e) => setNewVisit((v) => ({ ...v, notes: e.target.value }))}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addVisit} className="btn btn-primary">Add</button>
                    <button onClick={() => setAddingVisit(false)} className="btn btn-ghost">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* EVENTS */}
          {section === "events" && (
            <div className="flex flex-col gap-5">
              <MultiSelect
                options={EVENT_TYPES}
                value={form.events}
                onChange={(v) => setForm((f) => ({ ...f, events: v as EventType[] }))}
                label="Event types"
              />
              {form.events.length > 0 && (
                <>
                  <div>
                    <p className="label mb-1">Event date</p>
                    <input
                      type="date"
                      className="input-line"
                      value={form.event_date ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Event note</p>
                    <textarea
                      className="input-line"
                      rows={3}
                      placeholder="Wedding venue, dress code, party size..."
                      value={form.event_note ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, event_note: e.target.value }))}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* ALTERATIONS */}
          {section === "alterations" && (
            <div className="flex flex-col gap-5">
              <MultiSelect
                options={ALTERATION_ITEMS}
                value={form.alterations}
                onChange={(v) => setForm((f) => ({ ...f, alterations: v as AlterationItem[] }))}
                label="Alteration items"
              />
              {form.alterations.length > 0 && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="label">Alteration note</p>
                      <button
                        type="button"
                        onClick={handleCleanNote}
                        disabled={cleaningNote || !form.alteration_note?.trim()}
                        className="label"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: "0.55rem" }}
                      >
                        {cleaningNote ? "Cleaning..." : "Clean with AI"}
                      </button>
                    </div>
                    <textarea
                      className="input-line"
                      rows={3}
                      placeholder="Specific alteration instructions..."
                      value={form.alteration_note ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, alteration_note: e.target.value }))}
                      style={{ resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <p className="label mb-2">Status</p>
                    <StatusPipeline
                      stages={ALTERATION_STATUSES}
                      current={form.alteration_status ?? "Received"}
                      onChange={(s) => setForm((f) => ({ ...f, alteration_status: s as AlterationStatus }))}
                      colorScheme="good"
                    />
                  </div>

                  {/* Ready notification actions */}
                  {form.alteration_status === "Ready" && !isNew && (
                    <div
                      className="flex flex-col gap-2 p-4"
                      style={{ background: "#1f5a3208", border: "1px solid var(--good)" }}
                    >
                      <p className="label" style={{ color: "var(--good)" }}>Alterations ready — notify client</p>
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={`https://wa.me/${form.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${form.name}, your alterations at EPIC Menswear ${form.branch} are ready for pickup. We look forward to seeing you.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn"
                          style={{ borderColor: "#25d366", color: "#25d366", textDecoration: "none" }}
                        >
                          WhatsApp
                        </a>
                        <a
                          href={`sms:${form.phone}?body=${encodeURIComponent(`Hi ${form.name}, your alterations at EPIC Menswear ${form.branch} are ready for pickup.`)}`}
                          className="btn btn-ghost"
                          style={{ textDecoration: "none" }}
                        >
                          SMS
                        </a>
                        {form.email && (
                          <button
                            onClick={() => handleSendEmail("alteration_ready")}
                            className="btn btn-ghost"
                            disabled={notifying}
                          >
                            {notifying ? "Sending..." : "Email"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* SPECIAL ORDER */}
          {section === "order" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="label mb-1">Item ordered</p>
                <input
                  className="input-line"
                  placeholder="e.g. Custom navy blazer, size 42R"
                  value={form.special_order ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, special_order: e.target.value }))}
                />
              </div>
              {form.special_order?.trim() && (
                <>
                  <div>
                    <p className="label mb-2">Status</p>
                    <StatusPipeline
                      stages={SPECIAL_ORDER_STATUSES}
                      current={form.special_order_status ?? "Received"}
                      onChange={(s) => setForm((f) => ({ ...f, special_order_status: s as SpecialOrderStatus }))}
                      colorScheme="good"
                    />
                  </div>

                  {/* Arrived notification actions */}
                  {form.special_order_status === "Arrived" && !isNew && (
                    <div
                      className="flex flex-col gap-2 p-4"
                      style={{ background: "#1f5a3208", border: "1px solid var(--good)" }}
                    >
                      <p className="label" style={{ color: "var(--good)" }}>Order arrived — notify client</p>
                      <div className="flex gap-2 flex-wrap">
                        <a
                          href={`https://wa.me/${form.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${form.name}, your special order has arrived at EPIC Menswear ${form.branch}. We look forward to seeing you.`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn"
                          style={{ borderColor: "#25d366", color: "#25d366", textDecoration: "none" }}
                        >
                          WhatsApp
                        </a>
                        <a
                          href={`sms:${form.phone}?body=${encodeURIComponent(`Hi ${form.name}, your special order has arrived at EPIC Menswear ${form.branch}.`)}`}
                          className="btn btn-ghost"
                          style={{ textDecoration: "none" }}
                        >
                          SMS
                        </a>
                        {form.email && (
                          <button
                            onClick={() => handleSendEmail("special_order_arrived")}
                            className="btn btn-ghost"
                            disabled={notifying}
                          >
                            {notifying ? "Sending..." : "Email"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* FOLLOW-UP */}
          {section === "followup" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="followup-needed"
                  checked={form.follow_up?.needed ?? false}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, follow_up: { ...f.follow_up, needed: e.target.checked } }))
                  }
                  style={{ accentColor: "var(--ink)", width: 16, height: 16 }}
                />
                <label htmlFor="followup-needed" className="label" style={{ cursor: "pointer", color: "var(--ink)" }}>
                  Follow-up needed
                </label>
              </div>
              {form.follow_up?.needed && (
                <div>
                  <p className="label mb-1">Reason</p>
                  <input
                    className="input-line"
                    placeholder="Why follow up?"
                    value={form.follow_up?.reason ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, follow_up: { ...f.follow_up, needed: true, reason: e.target.value } }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {/* MEASUREMENTS */}
          {section === "measurements" && (
            <div className="flex flex-col gap-5">
              <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
                Measurements are optional and stored securely.
              </p>
              {(["chest", "waist", "sleeve", "inseam", "neck", "shoulder"] as const).map((key) => (
                <div key={key}>
                  <p className="label mb-1">{key.charAt(0).toUpperCase() + key.slice(1)}</p>
                  <input
                    className="input-line"
                    placeholder='e.g. 40" or 101cm'
                    value={form.measurements?.[key] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        measurements: { ...f.measurements, [key]: e.target.value },
                      }))
                    }
                  />
                </div>
              ))}
              <div>
                <p className="label mb-1">Measurement notes</p>
                <textarea
                  className="input-line"
                  rows={3}
                  placeholder="Any fitting notes..."
                  value={form.measurements?.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      measurements: { ...f.measurements, notes: e.target.value },
                    }))
                  }
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 flex items-center justify-between px-6 py-4 gap-3"
          style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}
        >
          {!isNew && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
          <div className="flex flex-col items-end gap-2 ml-auto">
            {saveError && (
              <p className="label" style={{ color: "var(--danger)", fontSize: "0.6rem", maxWidth: "18rem", textAlign: "right" }}>
                {saveError}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={onClose} className="btn btn-ghost">Cancel</button>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving || !form.name.trim() || !form.phone.trim()}
              >
                {saving ? "Saving..." : isNew ? "Create client" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
