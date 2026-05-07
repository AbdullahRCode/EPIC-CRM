"use client";

import { useState, useRef } from "react";
import type { Branch, PhotoExtractEntry } from "@/lib/types";
import { BRANCHES } from "@/lib/types";
import { createClient } from "@/app/actions/clients";
import type { Client } from "@/lib/types";

interface PhotoIntakeProps {
  onImport: (clients: Client[]) => void;
  onClose: () => void;
  defaultBranch?: Branch;
}

interface EntryEdit extends PhotoExtractEntry {
  include: boolean;
  branch: Branch;
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

      const editable: EntryEdit[] = (data.entries ?? []).map((e: PhotoExtractEntry) => ({
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
        const client = await createClient({
          name: entry.name,
          phone: entry.phone ?? "",
          email: entry.email ?? "",
          branch: entry.branch,
          events: [],
          alterations: [],
          follow_up: { needed: entry.uncertain ?? false, reason: entry.uncertain ? "Flagged from photo intake — verify details" : "" },
          measurements: {},
          visits: entry.notes
            ? [
                {
                  id: crypto.randomUUID(),
                  date: new Date().toISOString().split("T")[0],
                  reason: "Walk-in (purchased)",
                  notes: entry.notes,
                },
              ]
            : [],
        });
        created.push(client);
      }
      onImport(created);
    } finally {
      setImporting(false);
    }
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
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
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
                className="hidden"
                onChange={handleFileInput}
                style={{ display: "none" }}
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
                Extracted entries <span style={{ fontStyle: "normal", fontSize: "0.75rem" }}>({entries.filter((e) => e.include).length} selected)</span>
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
                        style={{ accentColor: "var(--ink)", width: 16, height: 16, flexShrink: 0 }}
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

                    {entry.notes && (
                      <p style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{entry.notes}</p>
                    )}

                    {entry.raw_text && (
                      <p className="label" style={{ color: "var(--muted)", fontStyle: "italic" }}>
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
                  disabled={importing || !entries.some((e) => e.include)}
                >
                  {importing
                    ? "Importing..."
                    : `Import ${entries.filter((e) => e.include).length} client${entries.filter((e) => e.include).length !== 1 ? "s" : ""}`}
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
