"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { BRANCHES, type Branch } from "@/lib/types";
import { BranchOwnerContext } from "@/lib/branch-context";

const NAV = [
  { label: "Logbook", href: "/" },
  { label: "Insights", href: "/insights" },
  { label: "Calendar", href: "/calendar" },
  { label: "Comms", href: "/comms", ownerOnly: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [ownerMode, setOwnerMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("epic-owner-mode");
    if (stored === "true") setOwnerMode(true);
    const storedBranch = localStorage.getItem("epic-branch");
    if (storedBranch) setBranch(storedBranch as Branch | "All");
  }, []);

  function toggleOwner() {
    const next = !ownerMode;
    setOwnerMode(next);
    localStorage.setItem("epic-owner-mode", String(next));
  }

  function handleBranchChange(b: Branch | "All") {
    setBranch(b);
    localStorage.setItem("epic-branch", b);
    // Notify same-tab listeners
    window.dispatchEvent(new StorageEvent("storage", { key: "epic-branch", newValue: b }));
  }

  const visibleNav = NAV.filter((n) => !n.ownerOnly || ownerMode);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-3"
        style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
      >
        {/* Wordmark */}
        <div className="flex items-baseline gap-3">
          <span
            className="font-serif"
            style={{ fontSize: "1.3rem", fontWeight: 500, letterSpacing: "0.08em" }}
          >
            EPIC
          </span>
          <span className="label" style={{ letterSpacing: "0.25em" }}>
            Menswear&nbsp;CRM
          </span>
        </div>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-1">
          {visibleNav.map((n) => {
            const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className="label px-4 py-2 transition-colors"
                style={{
                  color: active ? "var(--ink)" : "var(--muted)",
                  borderBottom: active ? "1px solid var(--ink)" : "1px solid transparent",
                  letterSpacing: "0.2em",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-4">
          {/* Branch picker */}
          <div className="flex items-center gap-2">
            <span className="label hidden sm:block">Branch</span>
            <select
              className="input-line"
              style={{ fontSize: "0.7rem", minWidth: "9rem", paddingRight: "1.5rem" }}
              value={branch}
              onChange={(e) => handleBranchChange(e.target.value as Branch | "All")}
            >
              <option value="All">All Branches</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Owner toggle */}
          <button
            onClick={toggleOwner}
            className="label flex items-center gap-2 px-3 py-1.5 transition-colors"
            style={{
              border: "1px solid",
              borderColor: ownerMode ? "var(--ink)" : "var(--line)",
              background: ownerMode ? "var(--ink)" : "transparent",
              color: ownerMode ? "var(--paper)" : "var(--muted)",
              letterSpacing: "0.18em",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: ownerMode ? "var(--vip)" : "var(--line)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Owner
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      <nav
        className="md:hidden flex items-center gap-1 px-4 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--line)", background: "var(--paper)" }}
      >
        {visibleNav.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className="label px-3 py-2.5 whitespace-nowrap flex-shrink-0"
              style={{
                color: active ? "var(--ink)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                letterSpacing: "0.18em",
              }}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Page content with branch/owner context */}
      <BranchOwnerContext.Provider value={{ branch, ownerMode }}>
        <main className="flex-1 overflow-hidden">{children}</main>
      </BranchOwnerContext.Provider>
    </div>
  );
}
