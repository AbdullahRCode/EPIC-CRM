"use client";

import { useState } from "react";
import type { Client, Branch, VisitReason, AlterationItem, Visit } from "@/lib/types";
import { BRANCHES } from "@/lib/types";
import { createClient } from "@/app/actions/clients";
import { todayStr } from "@/lib/dates";
import ClientDetail from "./ClientDetail";

const uid = () => crypto.randomUUID();

interface ClientModalProps {
  client?: Client | null;
  defaultBranch?: string;
  onClose: () => void;
  /** New client created (closes the form). */
  onSave?: (client: Client) => void;
  onSaved?: () => void;
  /** Existing client edited inline in the detail view (stays open). */
  onUpdated?: (client: Client) => void;
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

export default function ClientModal({
  client: initialClient,
  defaultBranch,
  onClose,
  onSave,
  onSaved,
  onUpdated,
  onDelete,
}: ClientModalProps) {
  // Existing clients get the tabbed, click-to-edit detail view
  if (initialClient) {
    return (
      <ClientDetail
        client={initialClient}
        onClose={onClose}
        onUpdated={onUpdated ?? onSave}
        onDelete={onDelete}
      />
    );
  }

  return <QuickEntryForm defaultBranch={defaultBranch} onClose={onClose} onSave={onSave} onSaved={onSaved} />;
}

function QuickEntryForm({
  defaultBranch,
  onClose,
  onSave,
  onSaved,
}: Pick<ClientModalProps, "defaultBranch" | "onClose" | "onSave" | "onSaved">) {
  const [quick, setQuick] = useState<QuickForm>(() => initQuickForm(defaultBranch as Branch | undefined));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleQuickSave() {
    if (!quick.name.trim() || !quick.phone.trim()) return;
    setSaving(true);
    setSaveError("");

    try {
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
        alteration_note: quick.alteration_details,
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
          <p className="font-serif" style={{ fontSize: "1.2rem", fontStyle: "italic" }}>
            New entry
          </p>
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

          {/* 4. Phone */}
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

          {/* 5. Email */}
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

          {/* 6. Branch */}
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

          {/* 7. Employee name */}
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

          {/* 8. Purchase */}
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

          {/* 9. Amount paid */}
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

          {/* 10. Alteration needed? */}
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

          {/* 11. Size / fit notes */}
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

          {/* 12. Additional remarks */}
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
          <div className="flex gap-2 justify-end">
            <button onClick={onClose} className="btn btn-ghost" style={{ minHeight: 44 }}>
              Cancel
            </button>
            <button
              onClick={handleQuickSave}
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              disabled={saving || !quick.name.trim() || !quick.phone.trim()}
            >
              {saving ? "Saving..." : "Create client"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
