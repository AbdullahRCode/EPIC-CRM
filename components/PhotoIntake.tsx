"use client";

import { useState, useRef } from "react";
import type { Branch, AlterationItem, AlterationStatus } from "@/lib/types";
import { BRANCHES } from "@/lib/types";
import { createClient } from "@/app/actions/clients";
import type { Client, Visit } from "@/lib/types";

interface PhotoExtractResult {
  name: string;
  phone?: string | null;
  email?: string | null;
  branch?: string | null;
  visit_date?: string | null;
  employee?: string | null;
  purchase_item?: string | null;
  amount_paid?: number | null;
  alteration_needed?: boolean;
  alteration_details?: string | null;
  alteration_date_promised?: string | null;
  fit_notes?: string | null;
  remarks?: string | null;
  uncertain?: boolean;
  raw_text?: string;
}

interface EntryEdit extends PhotoExtractResult {
  include: boolean;
  branch: Branch;
  purchase_item?: string | null;
  amount_paid?: number | null;
  alteration_details?: string | null;
  alteration_date_promised?: string | null;
  fit_notes?: string | null;
  employee?: string | null;
  remarks?: string | null;
}

interface PhotoIntakeProps {
  onImport: (clients: Client[]) => void;
  onClose: () => void;
  defaultBranch?: Branch;
}

export default function PhotoIntake({ onImport, onClose, defaultBranch }: PhotoIntakeProps) {
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [entries, setEntries] = useState<EntryEdit[]>([]);
  const [importing, setImporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function processImage(file: File) {
    setExtracting(true);
    setEntries([]);
    setErrorMsg("");
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg("Photo is too large (max 4 MB). Try a smaller photo or a screenshot of it.");
      setExtracting(false);
      return;
    }
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/ai/photo-extract", { method: "POST", body: fd });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const editable: EntryEdit[] = (data.entries ?? []).map((e: PhotoExtractResult) => ({
        ...e,
        include: true,
        branch: (e.branch as Branch) ?? defaultBranch ?? "Surrey - Guildford",
      }));
      setEntries(editable);
      if (!editable.length) setErrorMsg("No entries could be read from that photo. Try a clearer shot.");
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not read the photo — check your connection and try again.");
    } finally {
      setExtracting(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) processImage(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  }

  async function handleImport() {
    const toImport = entries.filter((e) => e.include && e.name?.trim());
    if (!toImport.length) return;
    setImporting(true);
    setErrorMsg("");

    // Import row-by-row, collecting failures instead of dying silently on the
    // first error and losing the rest of the page.
    const failed: string[] = [];
    try {
      const created: Client[] = [];
      for (const entry of toImport) {
        const visit: Visit = {
          id: crypto.randomUUID(),
          date: entry.visit_date ?? new Date().toISOString().split("T")[0],
          reason: "Walk-in (purchased)",
          items: entry.purchase_item ?? "",
          spend: entry.amount_paid ?? undefined,
          staff: entry.employee ?? "",
          notes: entry.remarks ?? "",
        };

        try {
          const client = await createClient({
          name: entry.name,
          phone: entry.phone ?? "",
          email: entry.email ?? "",
          branch: entry.branch,
          events: [],
          event_date: undefined,
          event_note: entry.alteration_date_promised
            ? `Alt ready: ${entry.alteration_date_promised}`
            : "",
          alterations: entry.alteration_needed ? (["Other"] as AlterationItem[]) : [],
          alteration_note: entry.alteration_details ?? "",
          alteration_status: entry.alteration_needed
            ? ("Received" as AlterationStatus)
            : undefined,
          special_order: "",
          special_order_status: undefined,
          follow_up: {
            needed: entry.uncertain ?? false,
            reason: entry.uncertain ? "Flagged from photo intake — verify details" : "",
          },
          measurements: { notes: entry.fit_notes ?? "" },
          visits: visit.items || visit.notes || visit.spend
            ? [visit]
            : [],
          });
          created.push(client);
        } catch (err) {
          console.error(`Import failed for ${entry.name}:`, err);
          failed.push(entry.name);
        }
      }
      if (failed.length) {
        // onImport closes the overlay, which would destroy the retry UI —
        // keep the failed rows on screen instead. Saved rows show up on the
        // next list refresh.
        setErrorMsg(
          `Imported ${created.length} of ${toImport.length}. Failed: ${failed.join(", ")}. ` +
            "Those rows are still listed above — fix and retry."
        );
        setEntries((prev) => prev.filter((e) => failed.includes(e.name)));
      } else {
        onImport(created);
      }
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = entries.filter((e) => e.include).length;

  function updateEntry(index: number, field: string, value: unknown) {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as EntryEdit;
      return next;
    });
  }

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
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1.1rem" }}>
            Photo intake
          </p>
          <button
            onClick={onClose}
            className="label"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", minHeight: 44 }}
          >
            Close
          </button>
        </div>

        <div className="flex-1 px-6 py-6 flex flex-col gap-6">
          {/* Drop zone */}
          {!entries.length && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-4 cursor-pointer"
              style={{
                border: `1px dashed ${dragging ? "var(--ink)" : "var(--line)"}`,
                padding: "3rem 2rem",
                background: dragging ? "var(--paper-2)" : "transparent",
                transition: "all 0.15s",
                minHeight: 200,
              }}
            >
              <span style={{ fontSize: "2rem", opacity: 0.3 }}>↑</span>
              <div className="text-center">
                <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
                  {extracting ? "Reading handwritten entries..." : "Drop a photo of the logbook page"}
                </p>
                <p className="label mt-1" style={{ color: "var(--muted)" }}>
                  or tap to browse
                </p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileInput}
              />
            </div>
          )}
          {!entries.length && errorMsg && (
            <p className="label" style={{ color: "var(--danger)", fontSize: "0.65rem", lineHeight: 1.5 }}>
              {errorMsg}
            </p>
          )}

          {/* Extracted entries */}
          {entries.length > 0 && (
            <>
              <p className="section-title">
                Extracted entries{" "}
                <span style={{ fontStyle: "normal", fontSize: "0.75rem" }}>
                  ({selectedCount} selected)
                </span>
              </p>

              <div className="flex flex-col gap-4">
                {entries.map((entry, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-3 p-4"
                    style={{
                      background: entry.uncertain ? "#8a1f1f08" : "var(--paper-2)",
                      border: `1px solid ${entry.uncertain ? "var(--danger)" : "var(--line)"}`,
                      opacity: entry.include ? 1 : 0.4,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {entry.uncertain && (
                          <span className="label" style={{ color: "var(--danger)", fontSize: "0.55rem" }}>
                            Uncertain — please verify
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={entry.include}
                        onChange={(e) => updateEntry(i, "include", e.target.checked)}
                        style={{ accentColor: "var(--ink)", width: 16, height: 16, flexShrink: 0, marginTop: 6 }}
                      />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Name *</label>
                      <input className="input-line" value={entry.name} onChange={(e) => updateEntry(i, "name", e.target.value)} placeholder="Customer name" style={{ fontWeight: 500 }} />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Phone</label>
                      <input className="input-line" value={entry.phone ?? ""} onChange={(e) => updateEntry(i, "phone", e.target.value)} placeholder="Phone number" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Email</label>
                      <input className="input-line" type="email" value={entry.email ?? ""} onChange={(e) => updateEntry(i, "email", e.target.value)} placeholder="Email (optional)" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Branch</label>
                      <select className="input-line" value={entry.branch} onChange={(e) => updateEntry(i, "branch", e.target.value as Branch)}>
                        {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Purchase item</label>
                      <input className="input-line" value={entry.purchase_item ?? ""} onChange={(e) => updateEntry(i, "purchase_item", e.target.value)} placeholder="e.g. Calvin Klein Black Slim Fit Full Suit" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Amount paid ($)</label>
                      <input className="input-line" type="number" value={entry.amount_paid ?? ""} onChange={(e) => updateEntry(i, "amount_paid", parseFloat(e.target.value) || null)} placeholder="0.00" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Alteration details</label>
                      <textarea className="input-line" rows={2} value={entry.alteration_details ?? ""} onChange={(e) => updateEntry(i, "alteration_details", e.target.value)} placeholder="e.g. Hem pants 1 inch, take in sleeves" style={{ resize: "vertical" }} />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Ready by date</label>
                      <input className="input-line" type="date" value={entry.alteration_date_promised ?? ""} onChange={(e) => updateEntry(i, "alteration_date_promised", e.target.value)} />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Size / fit notes</label>
                      <input className="input-line" value={entry.fit_notes ?? ""} onChange={(e) => updateEntry(i, "fit_notes", e.target.value)} placeholder="e.g. 42R fits well" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Employee</label>
                      <input className="input-line" value={entry.employee ?? ""} onChange={(e) => updateEntry(i, "employee", e.target.value)} placeholder="Staff name" />
                    </div>

                    <div>
                      <label className="label" style={{ display: "block", marginBottom: "0.25rem", color: "var(--muted)", fontSize: "0.55rem" }}>Remarks</label>
                      <input className="input-line" value={entry.remarks ?? ""} onChange={(e) => updateEntry(i, "remarks", e.target.value)} placeholder="Any other notes" />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2">
              {errorMsg && (
                <p className="label" style={{ color: "var(--danger)", fontSize: "0.65rem", lineHeight: 1.5 }}>
                  {errorMsg}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="btn btn-primary flex-1"
                  disabled={importing || selectedCount === 0}
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selectedCount} client${selectedCount !== 1 ? "s" : ""}`}
                </button>
                <button
                  onClick={() => { setEntries([]); setErrorMsg(""); }}
                  className="btn btn-ghost"
                >
                  Retry
                </button>
              </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
