# EPIC Menswear CRM — Round 4B: Role-Based Access + Stats Cleanup

Paste everything below into Claude Code.

---

## CHANGE 1 — SIMPLIFY STATUS STATS TO 3 CARDS ONLY

In `app/(dashboard)/insights/page.tsx`:

Remove `coldCount` and `ordersArrived` variables entirely.

Replace the entire STATS array with this:

```ts
const STATS = [
  {
    label: "Follow-ups",
    value: followUpCount,
    color: "var(--danger)",
  },
  {
    label: "Alt. Ready",
    value: alterationsReady,
    color: "var(--good)",
  },
  {
    label: "VIP",
    value: vipCount,
    color: "var(--vip)",
  },
];
```

The Performance group (Active clients + Revenue) stays exactly as is.
The Status group now shows only these 3 cards. Remove Cold and Orders Arrived completely.

---

## CHANGE 2 — FULL ROLE-BASED ACCESS SYSTEM

### 2A — Create `lib/user-role.ts`

This file reads the logged-in user's role and branch from Supabase session metadata:

```ts
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type UserRole = "admin" | "owner" | "employee";

export interface UserProfile {
  role: UserRole;
  name: string;
  branch: string; // "All" for admin/owner, specific branch for employee
  email: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowserClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const role: UserRole = meta.role ?? "employee";
  const name: string = meta.name ?? user.email ?? "Staff";
  const branch: string = meta.branch ?? "All";

  return { role, name, branch, email: user.email ?? "" };
}
```

### 2B — Create employee-only intake page at `app/intake/page.tsx`

This is a completely separate, stripped-down page. Employees land here after login. No nav, no header, no insights — just a clean new entry form.

```tsx
"use client";

import { useEffect, useState } from "react";
import { getUserProfile, type UserProfile } from "@/lib/user-role";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import ClientModal from "@/components/ClientModal";

export const dynamic = "force-dynamic";

export default function IntakePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

  useEffect(() => {
    getUserProfile().then((p) => {
      if (!p) {
        router.push("/login");
        return;
      }
      // If owner or admin, redirect to full dashboard
      if (p.role === "owner" || p.role === "admin") {
        router.push("/");
        return;
      }
      setProfile(p);
      setLoading(false);
    });
  }, [router]);

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <p className="label" style={{ color: "var(--muted)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      {/* Minimal header */}
      <header style={{
        borderBottom: "1px solid var(--line)",
        padding: "0.75rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        {/* Logo */}
        <svg viewBox="0 0 180 36" height="32" width="160" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
          <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
          <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
          <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "0.7rem",
              color: "var(--ink)",
            }}>{profile?.name}</p>
            <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              {profile?.branch}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              fontFamily: "var(--font-outfit)",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "0.5rem",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{
        maxWidth: 560,
        margin: "0 auto",
        padding: "2rem 1.5rem",
      }}>
        {/* Welcome */}
        <div style={{ marginBottom: "2rem" }}>
          <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
            <em>Good {getTimeOfDay()}, {profile?.name?.split(" ")[0]}.</em>
          </h1>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.25rem" }}>
            {profile?.branch} · {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* New entry button */}
        {!showForm && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
            style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem", padding: "1rem" }}
          >
            + New Client Entry
          </button>
        )}

        {/* Form */}
        {showForm && profile && (
          <ClientModal
            client={null}
            defaultBranch={profile.branch}
            onClose={() => setShowForm(false)}
            onSaved={() => {
              setShowForm(false);
            }}
          />
        )}

        {/* Today's note */}
        <p style={{
          marginTop: "3rem",
          textAlign: "center",
          fontSize: "0.7rem",
          color: "var(--muted)",
          fontFamily: "var(--font-outfit)",
          fontStyle: "italic",
        }}>
          All entries are saved to {profile?.branch} automatically.
        </p>
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
```

### 2C — Update `middleware.ts`

Replace the existing middleware with this role-aware version:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value, ...options } as never);
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options } as never);
        },
        remove(name: string, options: Record<string, unknown>) {
          request.cookies.set({ name, value: "", ...options } as never);
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options } as never);
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  const { pathname } = request.nextUrl;

  // Always allow: login page, API routes, static assets
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  ) {
    return response;
  }

  // Not logged in → go to login
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const role = session.user?.user_metadata?.role ?? "employee";

  // Employee trying to access dashboard → redirect to intake
  if (role === "employee" && !pathname.startsWith("/intake")) {
    return NextResponse.redirect(new URL("/intake", request.url));
  }

  // Owner/admin trying to access intake → redirect to dashboard
  if ((role === "owner" || role === "admin") && pathname.startsWith("/intake")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 2D — Update `app/(dashboard)/layout.tsx`

Replace the current Owner toggle button with a proper role-aware header. The layout needs to read the logged-in user's role from Supabase and set the UI accordingly.

Replace the entire layout file content with this:

```tsx
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
  { label: "Insights", href: "/insights", ownerOnly: true },
  { label: "Comms", href: "/comms", ownerOnly: true },
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
        fontFamily: "var(--font-outfit)",
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
    // Load user profile from Supabase
    getUserProfile().then((p) => {
      if (!p) return;
      setProfile(p);

      // Admin and owner always get owner mode
      if (p.role === "admin" || p.role === "owner") {
        setOwnerMode(true);
        // Restore branch preference or default to All
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

  // Only show nav items appropriate to role
  const isAdmin = profile?.role === "admin";
  const isOwner = profile?.role === "owner" || isAdmin;
  const visibleNav = NAV.filter((n) => !n.ownerOnly || isOwner);

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
          {/* Branch picker — only for owner/admin */}
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
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 1,
            }}>
              <p style={{
                fontFamily: "var(--font-outfit)",
                fontSize: "0.65rem",
                color: "var(--ink)",
              }}>{profile.name}</p>
              <p className="label" style={{
                fontSize: "0.5rem",
                color: profile.role === "admin" ? "var(--vip)" : "var(--muted)",
                letterSpacing: "0.2em",
              }}>
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
              className="label px-3 py-2.5 whitespace-nowrap flex-shrink-0"
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
      <BranchOwnerContext.Provider value={{ branch, ownerMode }}>
        <main className="flex-1 overflow-hidden">{children}</main>
      </BranchOwnerContext.Provider>
    </div>
  );
}
```

---

## CHANGE 3 — ADMIN EMPLOYEE MANAGEMENT PAGE

Create `app/(dashboard)/settings/page.tsx` — an admin-only page to add and manage employees without touching Supabase dashboard.

```tsx
"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/user-role";
import { useRouter } from "next/navigation";
import { BRANCHES, type Branch } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  branch: string;
  created_at: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    branch: "Surrey - Guildford" as Branch,
    role: "employee",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getUserProfile().then((p) => {
      if (!p || p.role !== "admin") {
        router.push("/");
        return;
      }
      setAllowed(true);
      loadEmployees();
    });
  }, [router]);

  async function loadEmployees() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/employees");
      const data = await res.json();
      setEmployees(data.employees ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function addEmployee() {
    if (!form.name || !form.email || !form.password) {
      setError("Name, email, and password are required.");
      return;
    }
    setAdding(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create employee.");
        return;
      }
      setMessage(`✓ ${form.name} added successfully.`);
      setForm({ name: "", email: "", password: "", branch: "Surrey - Guildford", role: "employee" });
      loadEmployees();
    } finally {
      setAdding(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Settings</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          Admin only · Manage staff access
        </p>
      </div>

      <div className="px-6 py-6" style={{ maxWidth: 640 }}>
        {/* Add employee form */}
        <p className="label mb-4" style={{ color: "var(--ink)" }}>Add Employee</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>Full Name</label>
              <input
                className="input-line"
                placeholder="John Smith"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>Email</label>
              <input
                className="input-line"
                type="email"
                placeholder="john@epicmenswear.ca"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>Password</label>
              <input
                className="input-line"
                type="text"
                placeholder="Temporary password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>Branch</label>
              <select
                className="input-line"
                value={form.branch}
                onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value as Branch }))}
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>Role</label>
              <select
                className="input-line"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="employee">Employee</option>
                <option value="owner">Owner</option>
              </select>
            </div>
          </div>

          {error && <p style={{ fontSize: "0.78rem", color: "var(--danger)" }}>{error}</p>}
          {message && <p style={{ fontSize: "0.78rem", color: "var(--good)" }}>{message}</p>}

          <button
            className="btn btn-primary"
            onClick={addEmployee}
            disabled={adding}
            style={{ alignSelf: "flex-start" }}
          >
            {adding ? "Adding..." : "Add Employee"}
          </button>
        </div>

        {/* Employee list */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: "1.5rem" }}>
          <p className="label mb-3" style={{ color: "var(--ink)" }}>Current Staff</p>
          {loading ? (
            <p className="label" style={{ color: "var(--muted)" }}>Loading...</p>
          ) : employees.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>No employees added yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {employees.map((emp, i) => (
                <div
                  key={emp.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.75rem 0",
                    borderBottom: i < employees.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <div>
                    <p style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{emp.name}</p>
                    <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                      {emp.email} · {emp.branch}
                    </p>
                  </div>
                  <span className="label" style={{
                    fontSize: "0.5rem",
                    color: emp.role === "owner" ? "var(--vip)" : "var(--muted)",
                    letterSpacing: "0.2em",
                  }}>
                    {emp.role.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 2E — Create API route `app/api/admin/employees/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Uses service role key to manage auth users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const employees = data.users
      .filter((u) => u.user_metadata?.role !== "admin")
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name ?? u.email,
        role: u.user_metadata?.role ?? "employee",
        branch: u.user_metadata?.branch ?? "—",
        created_at: u.created_at,
      }));

    return NextResponse.json({ employees });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, password, branch, role } = await req.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, branch, role },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

### 2F — Add Settings to nav in layout (admin only)

In the NAV array in `app/(dashboard)/layout.tsx`, add:
```ts
{ label: "Settings", href: "/settings", adminOnly: true },
```

Update the `visibleNav` filter to:
```ts
const visibleNav = NAV.filter((n) => {
  if (n.adminOnly) return isAdmin;
  if (n.ownerOnly) return isOwner;
  return true;
});
```

---

## CHANGE 4 — ADD SUPABASE SERVICE ROLE KEY TO ENV

In `.env.local` add:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

Get this from: Supabase → Project Settings → API → service_role key (secret).

Also add this to Vercel environment variables with the same name and value.

---

## CONSTRAINTS
- Do not touch lib/types.ts, lib/supabase.ts, app/actions/clients.ts
- Do not change any component files (ClientModal, ClientList, etc.)
- Keep all TypeScript strict mode, no any types
- Keep the existing EPIC SVG logo everywhere it appears
- The intake page must feel as premium as the main dashboard
