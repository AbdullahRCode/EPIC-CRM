"use client";

import { useState } from "react";
import type {
  Client,
  Branch,
  VisitReason,
  AlterationItem,
  AlterationStatus,
  Visit,
} from "@/lib/types";
import {
  BRANCHES,
  VISIT_REASONS,
  ALTERATION_STATUSES,
  deriveTags,
} from "@/lib/types";
import { createClient, updateClient, deleteClient } from "@/app/actions/clients";
import StatusPipeline from "./StatusPipeline";

import { todayStr } from "@/lib/dates";

const uid = () => crypto.randomUUID();

interface ClientModalProps {
  client?: Client | null;
  defaultBranch?: string;
  onClose: () => void;
  onSave?: (client: Client) => void;
  onSaved?: () => void;
  onDelete?: (id: string) => void;
}

// Simplified quick-entry form state for NEW clients
interface QuickForm {
  visit_date: string;
  reason: VisitReason;
  name: string;
  phone: string;
  email: string;
  branch: Branch;
  employee: string;
  purchase: string;
  amount: string;
  event_date: string;
  event_note: string;
  alteration_needed: boolean;
  alteration_date: string;
  alteration_details: string;
  fit_notes: string;
  remarks: string;
}

function initQuickForm(defaultBranch?: Branch): QuickForm {
  return {
    visit_date: todayStr(),
    reason: "Walk-in (purchased)",
    name: "",
    phone: "",
    email: "",
    // Guard against non-branch values ("All", "") leaking in as defaults
    branch: defaultBranch && BRANCHES.includes(defaultBranch) ? defaultBranch : "Surrey - Guildford",
    employee: "",
    purchase: "",
    amount: "",
    event_date: "",
    event_note: "",
    alteration_needed: false,
    alteration_date: "",
    alteration_details: "",
    fit_notes: "",
    remarks: "",
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
    follow_up: c.follow_up ?? { needed: false },
    measurements: c.measurements ?? {},
    visits: c.visits ?? [],
  };
}

type AccordionSection = "identity" | "visit" | "alterations";

export default function ClientModal({
  client: initialClient,
  defaultBranch,
  onClose,
  onSave,
  onSaved,
  onDelete,
}: ClientModalProps) {
  const isNew = !initialClient;

  // New entry: quick form state
  const [quick, setQuick] = useState<QuickForm>(() => initQuickForm(defaultBranch as Branch | undefined));

  // Edit mode: full form state with accordion
  const [form, setForm] = useState<Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at">>(
    () => initialClient ? initEditForm(initialClient) : initEditForm({
      id: "", tenant_id: "", created_at: "", updated_at: "",
      name: "", phone: "", branch: (defaultBranch as Branch | undefined) ?? "Surrey - Guildford",
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
  const tags = initialClient ? deriveTags({ ...initialClient, ...form } as Client) : [];

  function toggleSection(s: AccordionSection) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
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

  // ── Save handlers ─────────────────────────────────────────────────────────

  async function handleQuickSave() {
    if (!quick.name.trim() || !quick.phone.trim()) return;
    setSaving(true);
    setSaveError("");

    try {
      const alterationNote = quick.alteration_details;

      const visit: Visit = {
        id: uid(),
        date: quick.visit_date || todayStr(),
        reason: quick.reason,
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
        event_date: quick.event_date || undefined,
        event_note: quick.event_note || (quick.alteration_date ? `Alt ready: ${quick.alteration_date}` : ""),
        alterations: quick.alteration_needed ? (["Other"] as AlterationItem[]) : [],
        alteration_note: alterationNote,
        alteration_status: quick.alteration_needed ? "Received" : undefined,
        follow_up: { needed: false },
        measurements: quick.fit_notes ? { notes: quick.fit_notes } : {},
        visits: [visit],
      };

      const saved = await createClient(clientData);
      onSave?.(saved);
      onSaved?.();
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

      const saved = await updateClient(initialClient!.id, finalForm);
      onSave?.(saved);
      onSaved?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!initialClient || !window.confirm("Delete this client? This cannot be undone.")) return;
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
        className="flex items-center justify-between w-full py-2"
        style={{
          background: "none",
          border: "none",
          borderBottom: "1px solid var(--line)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="font-serif" style={{ fontSize: "0.9rem", fontStyle: "italic" }}>
            {label}
          </span>
          {badge && (
            <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              {badge}
            </span>
          )}
        </div>
        <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem", letterSpacing: "0.12em" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" style={{ overflowY: "auto" }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="slide-right h-full overflow-y-auto flex flex-col"
        style={{
          width: "min(480px, 100vw)",
          maxHeight: "100vh",
          overflowY: "auto",
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

            {/* 2. Visit type */}
            <div>
              <p className="label" style={{ color: "var(--muted)", marginBottom: "0.5rem", fontSize: "0.55rem" }}>
                VISIT TYPE
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {(["Walk-in (purchased)", "Walk-in (inquiry)", "Walk-in (no purchase)"] as VisitReason[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setQuick((q) => ({ ...q, reason: r }))}
                    style={{
                      fontFamily: "var(--font-outfit)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      padding: "0.5rem 0.75rem",
                      border: "1px solid",
                      borderColor: quick.reason === r ? "var(--ink)" : "var(--line)",
                      background: quick.reason === r ? "var(--ink)" : "transparent",
                      color: quick.reason === r ? "var(--paper)" : "var(--muted)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      minHeight: 36,
                    }}
                  >
                    {r === "Walk-in (purchased)" ? "Purchase" : r === "Walk-in (inquiry)" ? "Inquiry" : "No Purchase"}
                  </button>
                ))}
              </div>
            </div>

            {/* Inquiry fields */}
            {quick.reason === "Walk-in (inquiry)" && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                padding: "0.875rem",
                background: "var(--paper-2)",
                border: "1px solid var(--line)",
              }}>
                <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                  INQUIRY DETAILS
                </p>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>
                    Event date
                  </label>
                  <input
                    className="input-line"
                    type="date"
                    value={quick.event_date}
                    onChange={(e) => setQuick((q) => ({ ...q, event_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>
                    What do they need?
                  </label>
                  <input
                    className="input-line"
                    placeholder="e.g. wedding suit for 2 guests, budget ~$800"
                    value={quick.event_note}
                    onChange={(e) => setQuick((q) => ({ ...q, event_note: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* 3. Customer name */}
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
                            <p style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                              {v.notes}
                            </p>
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
                <div>
                  <p className="label mb-1">Alteration note</p>
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
              </div>
            )}

          </div>
        )}

        {/* AI Note */}
        {!isNew && <ClientAINote client={form} />}

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
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
            <div className="flex gap-2" style={{ marginLeft: "auto" }}>
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

function ClientAINote({ client }: { client: Partial<Client> }) {
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const visits = client.visits ?? [];
      const totalSpend = visits.reduce((s, v) => s + (v.spend ?? 0), 0);
      const lastVisit = visits.length
        ? new Date(visits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
            .toLocaleDateString("en-CA", { month: "short", day: "numeric" })
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
      const text = data.result ?? data.summary ?? data.text ?? "";
      setNote(text);
      setGenerated(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      borderTop: "1px solid var(--line)",
      padding: "1rem 1.5rem",
      background: "var(--paper-2)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
        <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>✦ AI Note</p>
        {!generated && (
          <button
            onClick={generate}
            disabled={loading}
            className="label"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              fontSize: "0.55rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            {loading ? "Thinking..." : "Generate"}
          </button>
        )}
      </div>
      {generated && note && (
        <p style={{
          fontSize: "0.82rem",
          color: "var(--ink)",
          fontStyle: "italic",
          fontFamily: "var(--font-serif), Georgia, serif",
          lineHeight: 1.6,
        }}>
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
