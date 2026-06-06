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

const uid = () => crypto.randomUUID();

interface ClientModalProps {
  client?: Client;
  defaultBranch?: Branch;
  onClose: () => void;
  onSave: (client: Client) => void;
  onDelete?: (id: string) => void;
}

// Simplified quick-entry form state for NEW clients
interface QuickForm {
  visit_date: string;
  name: string;
  phone: string;
  email: string;
  branch: Branch;
  employee: string;
  purchase: string;
  amount: string;
  alteration_needed: boolean;
  alteration_date: string;
  alteration_details: string;
  fit_notes: string;
  remarks: string;
  follow_up_needed: boolean;
  follow_up_reason: string;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function initQuickForm(defaultBranch?: Branch): QuickForm {
  return {
    visit_date: todayStr(),
    name: "",
    phone: "",
    email: "",
    branch: defaultBranch ?? "Surrey - Guildford",
    employee: "",
    purchase: "",
    amount: "",
    alteration_needed: false,
    alteration_date: "",
    alteration_details: "",
    fit_notes: "",
    remarks: "",
    follow_up_needed: false,
    follow_up_reason: "",
  };
}

function initEditForm(c: Client): Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at"> {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    branch: c.branch,
    events: c.events ?? [],
    event_date: c.event_date,
    event_note: c.event_note ?? "",
    alterations: c.alterations ?? [],
    alteration_note: c.alteration_note ?? "",
    alteration_status: c.alteration_status,
    special_order: c.special_order ?? "",
    special_order_status: c.special_order_status,
    follow_up: c.follow_up ?? { needed: false },
    measurements: c.measurements ?? {},
    visits: c.visits ?? [],
  };
}

type AccordionSection = "identity" | "visit" | "events" | "alterations" | "order" | "followup" | "measurements";

export default function ClientModal({
  client: initialClient,
  defaultBranch,
  onClose,
  onSave,
  onDelete,
}: ClientModalProps) {
  const isNew = !initialClient;

  // New entry: quick form state
  const [quick, setQuick] = useState<QuickForm>(() => initQuickForm(defaultBranch));

  // Edit mode: full form state with accordion
  const [form, setForm] = useState<Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at">>(
    () => initialClient ? initEditForm(initialClient) : initEditForm({
      id: "", tenant_id: "", created_at: "", updated_at: "",
      name: "", phone: "", branch: defaultBranch ?? "Surrey - Guildford",
      events: [], alterations: [], follow_up: { needed: false }, visits: [],
    })
  );

  const [openSections, setOpenSections] = useState<Set<AccordionSection>>(() => {
    const init = new Set<AccordionSection>(["visit"]);
    if (
      initialClient?.alterations?.length &&
      initialClient?.alteration_status !== "Picked up"
    ) {
      init.add("alterations");
    }
    return init;
  });

  const [addingVisit, setAddingVisit] = useState(false);
  const [newVisit, setNewVisit] = useState<Partial<Visit>>({
    date: todayStr(),
    reason: "Walk-in (purchased)",
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [cleaningNote, setCleaningNote] = useState(false);
  const [notifying, setNotifying] = useState(false);

  const tags = initialClient ? deriveTags({ ...initialClient, ...form } as Client) : [];

  function toggleSection(s: AccordionSection) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function cleanNote(note: string, context: string): Promise<string> {
    const res = await fetch("/api/ai/clean-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note, context }),
    });
    const data = await res.json();
    return data.uncertain ? note : (data.cleaned ?? note);
  }

  async function handleCleanNote() {
    if (!form.alteration_note?.trim()) return;
    setCleaningNote(true);
    try {
      const cleaned = await cleanNote(form.alteration_note, "alteration note");
      setForm((f) => ({ ...f, alteration_note: cleaned }));
    } finally {
      setCleaningNote(false);
    }
  }

  async function handleCleanVisitNote(idx: number) {
    const visit = form.visits[idx];
    if (!visit?.notes?.trim()) return;
    setCleaningNote(true);
    try {
      const cleaned = await cleanNote(visit.notes, `visit on ${visit.date}`);
      const updated = [...form.visits];
      updated[idx] = { ...visit, notes: cleaned };
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
    setNewVisit({ date: todayStr(), reason: "Walk-in (purchased)" });
    setAddingVisit(false);
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

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function handleQuickSave() {
    if (!quick.name.trim() || !quick.phone.trim()) return;
    setSaving(true);
    setSaveError("");

    try {
      let alterationNote = quick.alteration_details;

      // Auto-clean alteration note
      if (alterationNote.trim()) {
        try {
          alterationNote = await cleanNote(alterationNote, "alteration note");
        } catch {
          // non-fatal
        }
      }

      const visit: Visit = {
        id: uid(),
        date: quick.visit_date || todayStr(),
        reason: "Walk-in (purchased)",
        items: quick.purchase,
        spend: quick.amount ? Number(quick.amount) : undefined,
        staff: quick.employee,
        notes: quick.remarks,
      };

      const clientData: Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at"> = {
        name: quick.name.trim(),
        phone: quick.phone.trim(),
        email: quick.email.trim(),
        branch: quick.branch,
        events: [],
        event_date: undefined,
        event_note: quick.alteration_date
          ? `Alt ready: ${quick.alteration_date}`
          : "",
        alterations: quick.alteration_needed ? (["Other"] as AlterationItem[]) : [],
        alteration_note: alterationNote,
        alteration_status: quick.alteration_needed ? "Received" : undefined,
        special_order: "",
        special_order_status: undefined,
        follow_up: {
          needed: quick.follow_up_needed,
          reason: quick.follow_up_reason,
        },
        measurements: quick.fit_notes ? { notes: quick.fit_notes } : {},
        visits: [visit],
      };

      const saved = await createClient(clientData);
      onSave(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave() {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    setSaveError("");

    try {
      let finalForm = { ...form };

      if (addingVisit && newVisit.date && newVisit.reason) {
        const pending: Visit = {
          id: uid(),
          date: newVisit.date,
          reason: newVisit.reason as VisitReason,
          items: newVisit.items ?? "",
          spend: newVisit.spend ? Number(newVisit.spend) : undefined,
          staff: newVisit.staff ?? "",
          notes: newVisit.notes ?? "",
        };
        finalForm = { ...finalForm, visits: [...finalForm.visits, pending] };
      }

      if (finalForm.alteration_note?.trim()) {
        try {
          const cleaned = await cleanNote(finalForm.alteration_note, "alteration note");
          finalForm = { ...finalForm, alteration_note: cleaned };
        } catch {
          // non-fatal
        }
      }

      const saved = await updateClient(initialClient!.id, finalForm);
      onSave(saved);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
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

  // ── Accordion section header ──────────────────────────────────────────────

  function SectionHeader({
    id,
    label,
    badge,
  }: {
    id: AccordionSection;
    label: string;
    badge?: string;
  }) {
    const open = openSections.has(id);
    return (
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full py-3"
        style={{
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--line)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-serif" style={{ fontSize: "1rem", fontStyle: "italic" }}>
            {label}
          </span>
          {badge && (
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              {badge}
            </span>
          )}
        </div>
        <span className="label" style={{ color: "var(--muted)", fontSize: "0.7rem" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-start justify-between px-6 py-4 gap-3"
          style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
        >
          <div className="flex-1 min-w-0">
            <p className="font-serif" style={{ fontSize: "1.2rem", fontStyle: "italic" }}>
              {isNew ? "New entry" : form.name}
            </p>
            {!isNew && tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className={`tag tag-${tag.toLowerCase().replace(/ /g, "-")}`}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="label flex-shrink-0"
            style={{
              fontSize: "0.75rem",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              minHeight: 44,
              paddingTop: 4,
            }}
          >
            Close
          </button>
        </div>

        {/* ── NEW ENTRY: Single scrollable form ── */}
        {isNew && (
          <div className="flex-1 px-6 py-6 flex flex-col gap-5">
            {/* 1. Date of visit */}
            <div>
              <p className="label mb-1">Date of visit</p>
              <input
                type="date"
                className="input-line"
                value={quick.visit_date}
                onChange={(e) => setQuick((q) => ({ ...q, visit_date: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 2. Customer name */}
            <div>
              <p className="label mb-1">Customer name *</p>
              <input
                className="input-line"
                placeholder="Full name"
                value={quick.name}
                onChange={(e) => setQuick((q) => ({ ...q, name: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 3. Phone */}
            <div>
              <p className="label mb-1">Phone *</p>
              <input
                className="input-line"
                placeholder="+1 604 000 0000"
                value={quick.phone}
                onChange={(e) => setQuick((q) => ({ ...q, phone: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 4. Email */}
            <div>
              <p className="label mb-1">Email</p>
              <input
                className="input-line"
                placeholder="email@example.com"
                value={quick.email}
                onChange={(e) => setQuick((q) => ({ ...q, email: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 5. Branch */}
            <div>
              <p className="label mb-1">Branch</p>
              <select
                className="input-line"
                value={quick.branch}
                onChange={(e) => setQuick((q) => ({ ...q, branch: e.target.value as Branch }))}
                style={{ minHeight: 44 }}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* 6. Employee name */}
            <div>
              <p className="label mb-1">Employee name</p>
              <input
                className="input-line"
                placeholder="Staff who logged this entry"
                value={quick.employee}
                onChange={(e) => setQuick((q) => ({ ...q, employee: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 7. Purchase */}
            <div>
              <p className="label mb-1">Purchase</p>
              <input
                className="input-line"
                placeholder="e.g. Calvin Klein Black Slim Fit Full Suit"
                value={quick.purchase}
                onChange={(e) => setQuick((q) => ({ ...q, purchase: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 8. Amount paid */}
            <div>
              <p className="label mb-1">Amount paid ($)</p>
              <input
                type="number"
                className="input-line"
                placeholder="0"
                value={quick.amount}
                onChange={(e) => setQuick((q) => ({ ...q, amount: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 9. Alteration needed? */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
                <input
                  type="checkbox"
                  id="quick-alt"
                  checked={quick.alteration_needed}
                  onChange={(e) =>
                    setQuick((q) => ({ ...q, alteration_needed: e.target.checked }))
                  }
                  style={{ accentColor: "var(--ink)", width: 18, height: 18, flexShrink: 0 }}
                />
                <label
                  htmlFor="quick-alt"
                  className="label"
                  style={{ cursor: "pointer", color: "var(--ink)" }}
                >
                  Alteration needed?
                </label>
              </div>

              {quick.alteration_needed && (
                <div className="flex flex-col gap-4 pl-2" style={{ borderLeft: "2px solid var(--line)" }}>
                  <div>
                    <p className="label mb-1">Alteration date promised</p>
                    <input
                      type="date"
                      className="input-line"
                      value={quick.alteration_date}
                      onChange={(e) =>
                        setQuick((q) => ({ ...q, alteration_date: e.target.value }))
                      }
                      style={{ minHeight: 44 }}
                    />
                  </div>
                  <div>
                    <p className="label mb-1">Alteration details / remarks</p>
                    <textarea
                      className="input-line"
                      rows={3}
                      placeholder="e.g. Hem pants 1 inch, take in sleeves"
                      value={quick.alteration_details}
                      onChange={(e) =>
                        setQuick((q) => ({ ...q, alteration_details: e.target.value }))
                      }
                      style={{ resize: "vertical" }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 10. Size / fit notes */}
            <div>
              <p className="label mb-1">Size / fit notes</p>
              <input
                className="input-line"
                placeholder="e.g. Mantoni 42R fits well"
                value={quick.fit_notes}
                onChange={(e) => setQuick((q) => ({ ...q, fit_notes: e.target.value }))}
                style={{ minHeight: 44 }}
              />
            </div>

            {/* 11. Additional remarks */}
            <div>
              <p className="label mb-1">Additional remarks</p>
              <textarea
                className="input-line"
                rows={3}
                placeholder="Any other notes..."
                value={quick.remarks}
                onChange={(e) => setQuick((q) => ({ ...q, remarks: e.target.value }))}
                style={{ resize: "vertical" }}
              />
            </div>

            {/* 12. Follow-up needed? */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
                <input
                  type="checkbox"
                  id="quick-fu"
                  checked={quick.follow_up_needed}
                  onChange={(e) =>
                    setQuick((q) => ({ ...q, follow_up_needed: e.target.checked }))
                  }
                  style={{ accentColor: "var(--ink)", width: 18, height: 18, flexShrink: 0 }}
                />
                <label
                  htmlFor="quick-fu"
                  className="label"
                  style={{ cursor: "pointer", color: "var(--ink)" }}
                >
                  Follow-up needed?
                </label>
              </div>

              {quick.follow_up_needed && (
                <div>
                  <p className="label mb-1">Follow-up reason</p>
                  <input
                    className="input-line"
                    placeholder="Why follow up?"
                    value={quick.follow_up_reason}
                    onChange={(e) =>
                      setQuick((q) => ({ ...q, follow_up_reason: e.target.value }))
                    }
                    style={{ minHeight: 44 }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EDIT MODE: Accordion sections ── */}
        {!isNew && (
          <div className="flex-1 px-6 py-4 flex flex-col gap-0">

            {/* Identity */}
            <SectionHeader id="identity" label="Identity" />
            {openSections.has("identity") && (
              <div className="flex flex-col gap-5 py-5">
                <div>
                  <p className="label mb-1">Name *</p>
                  <input
                    className="input-line"
                    placeholder="Full name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    style={{ minHeight: 44 }}
                  />
                </div>
                <div>
                  <p className="label mb-1">Phone *</p>
                  <input
                    className="input-line"
                    placeholder="+1 604 000 0000"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    style={{ minHeight: 44 }}
                  />
                </div>
                <div>
                  <p className="label mb-1">Email</p>
                  <input
                    className="input-line"
                    placeholder="email@example.com"
                    value={form.email ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    style={{ minHeight: 44 }}
                  />
                </div>
                <div>
                  <p className="label mb-1">Branch</p>
                  <select
                    className="input-line"
                    value={form.branch}
                    onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}
                    style={{ minHeight: 44 }}
                  >
                    {BRANCHES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Visit history */}
            <SectionHeader
              id="visit"
              label="Visit history"
              badge={form.visits.length > 0 ? `${form.visits.length} visits` : undefined}
            />
            {openSections.has("visit") && (
              <div className="flex flex-col gap-5 py-5">
                {form.visits.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {[...form.visits]
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((v) => (
                        <div
                          key={v.id}
                          className="flex flex-col gap-1 py-3"
                          style={{ borderBottom: "1px solid var(--line)" }}
                        >
                          <div className="flex items-center justify-between flex-wrap gap-1">
                            <span className="label" style={{ color: "var(--ink)" }}>{v.date}</span>
                            <span className="label" style={{ color: "var(--muted)" }}>{v.reason}</span>
                          </div>
                          {v.items && <p style={{ fontSize: "0.82rem" }}>{v.items}</p>}
                          {v.spend != null && v.spend > 0 && (
                            <span className="label" style={{ color: "var(--good)" }}>
                              ${v.spend.toLocaleString()}
                            </span>
                          )}
                          {v.notes && (
                            <div className="flex items-start gap-2">
                              <p style={{ fontSize: "0.8rem", color: "var(--muted)", flex: 1 }}>
                                {v.notes}
                              </p>
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
                )}

                {!addingVisit ? (
                  <button
                    onClick={() => setAddingVisit(true)}
                    className="btn btn-ghost"
                    style={{ alignSelf: "flex-start" }}
                  >
                    + Log visit
                  </button>
                ) : (
                  <div
                    className="flex flex-col gap-4"
                    style={{ padding: "1rem", background: "var(--paper-2)" }}
                  >
                    <p className="section-title">New visit</p>
                    <div>
                      <p className="label mb-1">Date</p>
                      <input
                        type="date"
                        className="input-line"
                        value={newVisit.date ?? ""}
                        onChange={(e) => setNewVisit((v) => ({ ...v, date: e.target.value }))}
                        style={{ minHeight: 44 }}
                      />
                    </div>
                    <div>
                      <p className="label mb-1">Reason</p>
                      <select
                        className="input-line"
                        value={newVisit.reason ?? ""}
                        onChange={(e) =>
                          setNewVisit((v) => ({ ...v, reason: e.target.value as VisitReason }))
                        }
                        style={{ minHeight: 44 }}
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
                        style={{ minHeight: 44 }}
                      />
                    </div>
                    <div>
                      <p className="label mb-1">Spend ($)</p>
                      <input
                        type="number"
                        className="input-line"
                        placeholder="0"
                        value={newVisit.spend ?? ""}
                        onChange={(e) =>
                          setNewVisit((v) => ({ ...v, spend: Number(e.target.value) }))
                        }
                        style={{ minHeight: 44 }}
                      />
                    </div>
                    <div>
                      <p className="label mb-1">Staff</p>
                      <input
                        className="input-line"
                        placeholder="Staff name"
                        value={newVisit.staff ?? ""}
                        onChange={(e) => setNewVisit((v) => ({ ...v, staff: e.target.value }))}
                        style={{ minHeight: 44 }}
                      />
                    </div>
                    <div>
                      <p className="label mb-1">Notes</p>
                      <textarea
                        className="input-line"
                        rows={3}
                        placeholder="Any relevant notes..."
                        value={newVisit.notes ?? ""}
                        onChange={(e) => setNewVisit((v) => ({ ...v, notes: e.target.value }))}
                        style={{ resize: "vertical" }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addVisit} className="btn btn-primary">Add</button>
                      <button onClick={() => setAddingVisit(false)} className="btn btn-ghost">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Events */}
            <SectionHeader
              id="events"
              label="Events"
              badge={form.events.length > 0 ? form.events.join(", ") : undefined}
            />
            {openSections.has("events") && (
              <div className="flex flex-col gap-5 py-5">
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
                        style={{ minHeight: 44 }}
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

            {/* Alterations */}
            <SectionHeader
              id="alterations"
              label="Alterations"
              badge={
                form.alterations.length > 0 && form.alteration_status
                  ? form.alteration_status
                  : undefined
              }
            />
            {openSections.has("alterations") && (
              <div className="flex flex-col gap-5 py-5">
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
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--muted)",
                            fontSize: "0.55rem",
                          }}
                        >
                          {cleaningNote ? "Cleaning..." : "Clean with AI"}
                        </button>
                      </div>
                      <textarea
                        className="input-line"
                        rows={3}
                        placeholder="Specific alteration instructions..."
                        value={form.alteration_note ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, alteration_note: e.target.value }))
                        }
                        style={{ resize: "vertical" }}
                      />
                    </div>
                    <div>
                      <p className="label mb-2">Status</p>
                      <StatusPipeline
                        stages={ALTERATION_STATUSES}
                        current={form.alteration_status ?? "Received"}
                        onChange={(s) =>
                          setForm((f) => ({ ...f, alteration_status: s as AlterationStatus }))
                        }
                        colorScheme="good"
                      />
                    </div>

                    {form.alteration_status === "Ready" && !isNew && (
                      <div
                        className="flex flex-col gap-2 p-4"
                        style={{ background: "#1f5a3208", border: "1px solid var(--good)" }}
                      >
                        <p className="label" style={{ color: "var(--good)" }}>
                          Alterations ready — notify client
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <a
                            href={`https://wa.me/${form.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Hi ${form.name}, your alterations at EPIC Menswear ${form.branch} are ready for pickup. We look forward to seeing you.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn"
                            style={{
                              borderColor: "#25d366",
                              color: "#25d366",
                              textDecoration: "none",
                            }}
                          >
                            WhatsApp
                          </a>
                          <a
                            href={`sms:${form.phone}?body=${encodeURIComponent(
                              `Hi ${form.name}, your alterations at EPIC Menswear ${form.branch} are ready for pickup.`
                            )}`}
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

            {/* Special Order */}
            <SectionHeader
              id="order"
              label="Special Order"
              badge={
                form.special_order?.trim() && form.special_order_status
                  ? form.special_order_status
                  : undefined
              }
            />
            {openSections.has("order") && (
              <div className="flex flex-col gap-5 py-5">
                <div>
                  <p className="label mb-1">Item ordered</p>
                  <input
                    className="input-line"
                    placeholder="e.g. Custom navy blazer, size 42R"
                    value={form.special_order ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, special_order: e.target.value }))}
                    style={{ minHeight: 44 }}
                  />
                </div>
                {form.special_order?.trim() && (
                  <>
                    <div>
                      <p className="label mb-2">Status</p>
                      <StatusPipeline
                        stages={SPECIAL_ORDER_STATUSES}
                        current={form.special_order_status ?? "Received"}
                        onChange={(s) =>
                          setForm((f) => ({
                            ...f,
                            special_order_status: s as SpecialOrderStatus,
                          }))
                        }
                        colorScheme="good"
                      />
                    </div>

                    {form.special_order_status === "Arrived" && !isNew && (
                      <div
                        className="flex flex-col gap-2 p-4"
                        style={{ background: "#1f5a3208", border: "1px solid var(--good)" }}
                      >
                        <p className="label" style={{ color: "var(--good)" }}>
                          Order arrived — notify client
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <a
                            href={`https://wa.me/${form.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                              `Hi ${form.name}, your special order has arrived at EPIC Menswear ${form.branch}. We look forward to seeing you.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn"
                            style={{
                              borderColor: "#25d366",
                              color: "#25d366",
                              textDecoration: "none",
                            }}
                          >
                            WhatsApp
                          </a>
                          <a
                            href={`sms:${form.phone}?body=${encodeURIComponent(
                              `Hi ${form.name}, your special order has arrived at EPIC Menswear ${form.branch}.`
                            )}`}
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

            {/* Follow-up */}
            <SectionHeader
              id="followup"
              label="Follow-up"
              badge={form.follow_up?.needed ? "needed" : undefined}
            />
            {openSections.has("followup") && (
              <div className="flex flex-col gap-5 py-5">
                <div className="flex items-center gap-3" style={{ minHeight: 44 }}>
                  <input
                    type="checkbox"
                    id="edit-followup"
                    checked={form.follow_up?.needed ?? false}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        follow_up: { ...f.follow_up, needed: e.target.checked },
                      }))
                    }
                    style={{ accentColor: "var(--ink)", width: 16, height: 16 }}
                  />
                  <label
                    htmlFor="edit-followup"
                    className="label"
                    style={{ cursor: "pointer", color: "var(--ink)" }}
                  >
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
                        setForm((f) => ({
                          ...f,
                          follow_up: { ...f.follow_up, needed: true, reason: e.target.value },
                        }))
                      }
                      style={{ minHeight: 44 }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Measurements */}
            <SectionHeader id="measurements" label="Measurements" />
            {openSections.has("measurements") && (
              <div className="flex flex-col gap-5 py-5">
                <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
                  Measurements are optional and stored securely.
                </p>
                {(["chest", "waist", "sleeve", "inseam", "neck", "shoulder"] as const).map(
                  (key) => (
                    <div key={key}>
                      <p className="label mb-1">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </p>
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
                        style={{ minHeight: 44 }}
                      />
                    </div>
                  )
                )}
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
        )}

        {/* Footer */}
        <div
          className="sticky bottom-0 px-6 py-4"
          style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}
        >
          {saveError && (
            <p className="label mb-2" style={{ color: "var(--danger)", fontSize: "0.6rem" }}>
              {saveError}
            </p>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {!isNew && (
              <button
                onClick={handleDelete}
                className="btn btn-danger"
                style={{ minHeight: 44 }}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <button
                onClick={onClose}
                className="btn btn-ghost flex-1 sm:flex-none"
                style={{ minHeight: 44 }}
              >
                Cancel
              </button>
              <button
                onClick={isNew ? handleQuickSave : handleEditSave}
                className="btn btn-primary flex-1 sm:flex-none"
                style={{ minHeight: 44 }}
                disabled={
                  saving ||
                  (isNew
                    ? !quick.name.trim() || !quick.phone.trim()
                    : !form.name.trim() || !form.phone.trim())
                }
              >
                {saving
                  ? "Saving..."
                  : isNew
                  ? "Create client"
                  : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
