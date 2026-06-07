"use client";

import { useState } from "react";
import type { Client, ClientTag, AlterationStatus, SpecialOrderStatus } from "@/lib/types";
import { updateClient } from "@/app/actions/clients";

interface AISearchPanelProps {
  branch: string;
  clients: Client[];
  onResults: (ids: string[], interpretation: string) => void;
  onClear: () => void;
  onFilterChange?: (filter: ClientTag | null) => void;
}


export default function AISearchPanel({
  branch,
  clients,
  onResults,
  onClear,
  onFilterChange,
}: AISearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [active, setActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setActive(true);
    setStatusMsg("");
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, branch }),
      });
      const data = await res.json();

      if (data.type === "action") {
        await handleAction(data);
        setActive(false);
      } else {
        setInterpretation(data.interpretation ?? "");
        onResults(data.ids ?? [], data.interpretation ?? "");
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleAction(data: {
    action: string;
    query?: string;
    status?: string;
    filter?: string;
  }) {
    if (data.action === "filter" && data.filter) {
      onFilterChange?.(data.filter as ClientTag);
      setStatusMsg(`✓ Showing ${data.filter}`);
      setActive(false);
      return;
    }

    if (
      (data.action === "mark_alteration" || data.action === "mark_order") &&
      data.query
    ) {
      const searchKey = data.query.toLowerCase().trim();
      const match = clients.find(
        (c) =>
          c.name.toLowerCase().includes(searchKey) ||
          c.phone.includes(searchKey)
      );

      if (!match) {
        setStatusMsg(`⚠ No client found matching "${data.query}"`);
        return;
      }

      try {
        if (data.action === "mark_alteration" && data.status) {
          await updateClient(match.id, {
            ...match,
            alteration_status: data.status as AlterationStatus,
          });
          setStatusMsg(`✓ ${match.name} marked as ${data.status}`);
        } else if (data.action === "mark_order" && data.status) {
          await updateClient(match.id, {
            ...match,
            special_order_status: data.status as SpecialOrderStatus,
          });
          setStatusMsg(`✓ ${match.name} order marked as ${data.status}`);
        }
      } catch {
        setStatusMsg("⚠ Update failed — try again");
      }
      return;
    }

    setStatusMsg("⚠ Action not recognised");
  }

  function handleClear() {
    setQuery("");
    setInterpretation("");
    setStatusMsg("");
    setActive(false);
    onClear();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div
        className="flex items-center gap-3"
        style={{ borderBottom: "1px solid var(--ink)", paddingBottom: 4 }}
      >
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>✦</span>
        <input
          className="flex-1"
          placeholder={`Ask anything — "find cold VIPs" or type "show alterations"`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
          style={{
            background: "none",
            border: "none",
            outline: "none",
            fontSize: "0.88rem",
            color: "var(--ink)",
            fontFamily: "Outfit, sans-serif",
            minHeight: 44,
          }}
        />
        {active ? (
          <button
            onClick={handleClear}
            className="label"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
          >
            Clear
          </button>
        ) : (
          <button
            onClick={() => runSearch(query)}
            className="label"
            disabled={searching || !query.trim()}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: searching ? "var(--muted)" : "var(--ink)",
            }}
          >
            {searching ? "Searching..." : "Search"}
          </button>
        )}
      </div>

      {/* Interpretation */}
      {interpretation && (
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic" }}>
          {interpretation}
        </p>
      )}

      {/* Action status */}
      {statusMsg && (
        <p
          className="label"
          style={{
            color: statusMsg.startsWith("✓") ? "var(--good)" : "var(--warn)",
            fontSize: "0.65rem",
          }}
        >
          {statusMsg}
        </p>
      )}
    </div>
  );
}
