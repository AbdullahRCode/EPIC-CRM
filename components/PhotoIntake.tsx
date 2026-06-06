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
  const [pageNotes, setPageNotes] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function processImage(file: File) {
    setExtracting(true);
    setEntries([]);
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
      setPageNotes(data.page_notes ?? "");
    } catch (err) {
      console.error(err);
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
      }
      onImport(created);
    } finally {
      setImporting(false);
    }
  }

  const selectedCount = entries.filter((e) => e.include).length;

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

          {/* Extracted entries */}
          {entries.length > 0 && (
            <>
              {pageNotes && (
                <p className="label" style={{ color: "var(--muted)" }}>{pageNotes}</p>
              )}

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
                      <div className="flex flex-col gap-1 flex-1">
                        {entry.uncertain && (
                          <span className="label" style={{ color: "var(--danger)", fontSize: "0.55rem" }}>
                            Uncertain — please verify
                          </span>
                        )}
                        <input
                          className="input-line"
                          value={entry.name}
                          onChange={(e) => {
                            const next = [...entries];
                            next[i] = { ...entry, name: e.target.value };
                            setEntries(next);
                          }}
                          placeholder="Name"
                          style={{ fontWeight: 500 }}
                        />
                      </div>
                      <input
                        type="checkbox"
                        checked={entry.include}
                        onChange={(e) => {
                          const next = [...entries];
                          next[i] = { ...entry, include: e.target.checked };
                          setEntries(next);
                        }}
                        style={{ accentColor: "var(--ink)", width: 16, height: 16, flexShrink: 0, marginTop: 6 }}
                      />
                    </div>

                    <input
                      className="input-line"
                      value={entry.phone ?? ""}
                      onChange={(e) => {
                        const next = [...entries];
                        next[i] = { ...entry, phone: e.target.value };
                        setEntries(next);
                      }}
                      placeholder="Phone"
                    />

                    <select
                      className="input-line"
                      value={entry.branch}
                      onChange={(e) => {
                        const next = [...entries];
                        next[i] = { ...entry, branch: e.target.value as Branch };
                        setEntries(next);
                      }}
                    >
                      {BRANCHES.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    {/* Structured fields preview */}
                    <div className="flex flex-col gap-1.5">
                      {entry.visit_date && (
                        <p className="label" style={{ color: "var(--muted)", fontSize: "0.6rem" }}>
                          Date: {entry.visit_date}
                        </p>
                      )}
                      {entry.purchase_item && (
                        <p style={{ fontSize: "0.8rem" }}>{entry.purchase_item}</p>
                      )}
                      {entry.amount_paid != null && (
                        <p className="label" style={{ color: "var(--good)" }}>
                          ${entry.amount_paid.toLocaleString()}
                        </p>
                      )}
                      {entry.alteration_needed && (
                        <p className="label" style={{ color: "var(--warn)", fontSize: "0.58rem" }}>
                          Alteration: {entry.alteration_details ?? "needed"}
                          {entry.alteration_date_promised ? ` — ready ${entry.alteration_date_promised}` : ""}
                        </p>
                      )}
                      {entry.fit_notes && (
                        <p className="label" style={{ color: "var(--muted)", fontSize: "0.58rem" }}>
                          Fit: {entry.fit_notes}
                        </p>
                      )}
                    </div>

                    {entry.raw_text && (
                      <p className="label" style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.55rem" }}>
                        Raw: {entry.raw_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>

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
                  onClick={() => setEntries([])}
                  className="btn btn-ghost"
                >
                  Retry
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
