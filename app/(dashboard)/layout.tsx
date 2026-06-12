"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { BRANCHES, type Branch } from "@/lib/types";
import { BranchOwnerContext } from "@/lib/branch-context";
import { getUserProfile, type UserProfile } from "@/lib/user-role";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

const NAV = [
  { label: "Logbook", href: "/" },
  { label: "Intake", href: "/intake" },
  { label: "Insights", href: "/insights", ownerOnly: true },
  { label: "Revenue", href: "/revenue", ownerOnly: true },
  { label: "Calendar", href: "/calendar" },
  { label: "Comms", href: "/comms", ownerOnly: true },
  { label: "Settings", href: "/settings", adminOnly: true },
];

function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={signOut}
      style={{
        fontFamily: "var(--font-outfit), system-ui",
        fontSize: "0.55rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "var(--muted)",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "0.5rem",
        minHeight: 44,
      }}
    >
      Sign out
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [branch, setBranch] = useState<Branch | "All">("All");
  const [ownerMode, setOwnerMode] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    getUserProfile().then((p) => {
      if (!p) return;
      setProfile(p);

      if (p.role === "admin" || p.role === "owner") {
        setOwnerMode(true);
        const storedBranch = localStorage.getItem("epic-branch");
        if (storedBranch) setBranch(storedBranch as Branch | "All");
      }
    });
  }, []);

  function handleBranchChange(b: Branch | "All") {
    setBranch(b);
    localStorage.setItem("epic-branch", b);
    window.dispatchEvent(new StorageEvent("storage", { key: "epic-branch", newValue: b }));
  }

  const isAdmin = profile?.role === "admin";
  const isOwner = profile?.role === "owner" || isAdmin;

  const visibleNav = NAV.filter((n) => {
    if ("adminOnly" in n && n.adminOnly) return isAdmin;
    if ("ownerOnly" in n && n.ownerOnly) return isOwner;
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--paper)" }}>
      {/* Sticky header */}
      <header
        className="sticky top-0 z-40 flex flex-wrap items-center justify-between px-6 py-3 gap-3"
        style={{ background: "var(--paper)", borderBottom: "1px solid var(--line)" }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", height: 36 }}>
          <svg viewBox="0 0 180 36" height="36" width="180" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
            <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
            <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
            <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
            <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
          </svg>
          <span style={{
            fontFamily: "var(--font-outfit), system-ui",
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
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Branch picker — owner/admin only */}
          {isOwner && (
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
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Role badge */}
          {profile && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
              <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.65rem", color: "var(--ink)" }}>
                {profile.name}
              </p>
              <p
                className="label"
                style={{
                  fontSize: "0.5rem",
                  color: profile.role === "admin" ? "var(--vip)" : "var(--muted)",
                  letterSpacing: "0.2em",
                }}
              >
                {profile.role === "admin" ? "ADMIN" : profile.role === "owner" ? "OWNER" : profile.branch}
              </p>
            </div>
          )}

          <SignOutButton />
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
              className="label px-3 whitespace-nowrap flex-shrink-0"
              style={{
                color: active ? "var(--ink)" : "var(--muted)",
                borderBottom: active ? "2px solid var(--ink)" : "2px solid transparent",
                letterSpacing: "0.18em",
                minHeight: 44,
                display: "flex",
                alignItems: "center",
              }}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      {/* Page content */}
      <BranchOwnerContext.Provider value={{ branch, ownerMode, role: profile?.role ?? null }}>
        <main className="flex-1 overflow-hidden">{children}</main>
      </BranchOwnerContext.Provider>
    </div>
  );
}
