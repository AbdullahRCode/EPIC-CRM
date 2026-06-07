"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { BRANCHES, type Branch } from "@/lib/types";
import { BranchOwnerContext } from "@/lib/branch-context";

const NAV = [
  { label: "Logbook", href: "/" },
  { label: "Insights", href: "/insights" },
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
        className="sticky top-0 z-40"
        style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 py-3 flex-wrap">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0" style={{ height: 36 }}>
            <svg viewBox="0 0 180 36" height="36" width="180" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
              <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
              <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
              <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
              <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
            </svg>
            <span style={{
              fontFamily: "var(--font-outfit), system-ui, sans-serif",
              fontSize: "0.55rem",
              fontWeight: 500,
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--muted)",
              marginLeft: "0.75rem",
            }}>CRM</span>
          </div>

          {/* Center nav — desktop only */}
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
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Branch picker */}
            <div className="flex items-center gap-1 sm:gap-2">
              <span className="label hidden sm:block">Branch</span>
              <select
                className="input-line"
                style={{ fontSize: "0.7rem", minWidth: "7.5rem", maxWidth: "10rem", paddingRight: "1.5rem" }}
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
              className="label flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 transition-colors"
              style={{
                border: "1px solid",
                borderColor: ownerMode ? "var(--ink)" : "var(--line)",
                background: ownerMode ? "var(--ink)" : "transparent",
                color: ownerMode ? "var(--paper)" : "var(--muted)",
                letterSpacing: "0.18em",
                cursor: "pointer",
                minHeight: 44,
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
        </div>
      </header>

      {/* Mobile nav — scrollable tabs */}
      <nav
        className="md:hidden flex items-center gap-0 px-2 overflow-x-auto scrollbar-none"
        style={{ borderBottom: "1px solid var(--line)", background: "var(--paper)" }}
      >
        {visibleNav.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className="label px-4 whitespace-nowrap flex-shrink-0 flex items-center"
              style={{
                color: active ? "var(--ink)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                letterSpacing: "0.18em",
                minHeight: 44,
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
