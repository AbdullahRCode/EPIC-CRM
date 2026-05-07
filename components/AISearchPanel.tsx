"use client";

import { useState } from "react";

interface AISearchPanelProps {
  branch: string;
  onResults: (ids: string[], interpretation: string) => void;
  onClear: () => void;
}

const CHIPS = [
  "Follow-up this week",
  "Cold revival",
  "Top VIPs",
  "Diwali outreach",
  "Weddings in 60 days",
  "Alterations ready",
  "Orders arrived",
];

export default function AISearchPanel({ branch, onResults, onClear }: AISearchPanelProps) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [interpretation, setInterpretation] = useState("");
  const [active, setActive] = useState(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setSearching(true);
    setActive(true);
    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, branch }),
      });
      const data = await res.json();
      setInterpretation(data.interpretation ?? "");
      onResults(data.ids ?? [], data.interpretation ?? "");
    } finally {
      setSearching(false);
    }
  }

  function handleClear() {
    setQuery("");
    setInterpretation("");
    setActive(false);
    onClear();
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="flex items-center gap-3" style={{ borderBottom: "1px solid var(--ink)", paddingBottom: 4 }}>
        <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>✦</span>
        <input
          className="flex-1"
          placeholder={`Ask anything — "find all cold VIPs in Surrey" or "who needs Diwali outreach"`}
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

      {/* Suggestion chips */}
      {!active && (
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setQuery(chip);
                runSearch(chip);
              }}
              className="label px-3 py-1.5"
              style={{
                background: "none",
                border: "1px solid var(--line)",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: "0.58rem",
                letterSpacing: "0.12em",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "var(--ink)";
                (e.target as HTMLButtonElement).style.color = "var(--ink)";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.borderColor = "var(--line)";
                (e.target as HTMLButtonElement).style.color = "var(--muted)";
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Interpretation */}
      {interpretation && (
        <p style={{ fontSize: "0.78rem", color: "var(--muted)", fontStyle: "italic" }}>
          {interpretation}
        </p>
      )}
    </div>
  );
}
