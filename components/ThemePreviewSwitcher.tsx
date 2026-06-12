"use client";

import { useEffect, useState } from "react";

/**
 * PREVIEW-ONLY control for the Phase 3 visual refresh: switches between the
 * three proposed contrast+motion directions on the Logbook page. Remove (or
 * keep the chosen direction's CSS and delete the rest) once a direction is
 * selected.
 */
const DIRECTIONS = [
  { id: "", label: "Current" },
  { id: "gallery", label: "A · Gallery" },
  { id: "ledger", label: "B · Ledger" },
  { id: "atelier", label: "C · Atelier" },
];

const STORAGE_KEY = "epic-theme-preview";

export default function ThemePreviewSwitcher() {
  const [active, setActive] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setActive(stored);
    if (stored) document.documentElement.dataset.theme = stored;
  }, []);

  function apply(id: string) {
    setActive(id);
    if (id) {
      document.documentElement.dataset.theme = id;
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      delete document.documentElement.dataset.theme;
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1rem",
        right: "1rem",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 2,
        background: "var(--paper)",
        border: "1px solid var(--ink)",
        boxShadow: "0 4px 16px #0a0a0a1a",
        padding: "0.25rem",
      }}
    >
      <span className="label" style={{ fontSize: "0.5rem", padding: "0 0.5rem" }}>
        Preview
      </span>
      {DIRECTIONS.map((d) => (
        <button
          key={d.id}
          onClick={() => apply(d.id)}
          className="label"
          style={{
            fontSize: "0.55rem",
            letterSpacing: "0.12em",
            padding: "0.45rem 0.6rem",
            border: "none",
            cursor: "pointer",
            background: active === d.id ? "var(--ink)" : "transparent",
            color: active === d.id ? "var(--paper)" : "var(--muted)",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
