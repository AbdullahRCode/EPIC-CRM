"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/user-role";
import { useRouter } from "next/navigation";
import { BRANCHES, type Branch } from "@/lib/types";

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
      const data = await res.json() as { employees?: Employee[] };
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
      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to create employee.");
        return;
      }
      setMessage(`✓ ${form.name} added successfully.`);
      setForm({ name: "", email: "", password: "", branch: "Surrey - Guildford", role: "employee" });
      await loadEmployees();
    } finally {
      setAdding(false);
    }
  }

  if (!allowed) return null;

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3 page-band">
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Settings</em>
        </h1>
        <p className="label mt-1">
          Admin only · Manage staff access
        </p>
      </div>

      <div className="px-6 py-6" style={{ maxWidth: 640 }}>
        {/* Add employee form */}
        <p className="label mb-4" style={{ color: "var(--ink)" }}>Add Employee</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>
                Full Name
              </label>
              <input
                className="input-line"
                placeholder="John Smith"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>
                Email
              </label>
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
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>
                Password
              </label>
              <input
                className="input-line"
                type="password"
                autoComplete="new-password"
                placeholder="Temporary password (8+ chars)"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>
                Branch
              </label>
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
              <label className="label" style={{ display: "block", marginBottom: "0.4rem", color: "var(--muted)" }}>
                Role
              </label>
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

          {error && (
            <p style={{ fontSize: "0.78rem", color: "var(--danger)" }}>{error}</p>
          )}
          {message && (
            <p style={{ fontSize: "0.78rem", color: "var(--good)" }}>{message}</p>
          )}

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
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", fontStyle: "italic" }}>
              No employees added yet.
            </p>
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
                  <span
                    className="label"
                    style={{
                      fontSize: "0.5rem",
                      color: emp.role === "owner" ? "var(--vip)" : "var(--muted)",
                      letterSpacing: "0.2em",
                    }}
                  >
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
