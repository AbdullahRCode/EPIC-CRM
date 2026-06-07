"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    setError("");
    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <svg viewBox="0 0 180 36" height="36" width="180" xmlns="http://www.w3.org/2000/svg" style={{ display: "inline-block" }}>
            <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
            <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
            <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
            <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
          </svg>
          <p style={{
            fontFamily: "var(--font-outfit), system-ui",
            fontSize: "0.55rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "var(--muted)",
            marginTop: "0.5rem",
          }}>
            Staff Portal
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{
              fontFamily: "var(--font-outfit), system-ui",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}>
              Email
            </label>
            <input
              type="email"
              className="input-line"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="your@email.com"
              autoComplete="email"
              style={{ fontSize: "0.95rem" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{
              fontFamily: "var(--font-outfit), system-ui",
              fontSize: "0.55rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--muted)",
            }}>
              Password
            </label>
            <input
              type="password"
              className="input-line"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{ fontSize: "0.95rem" }}
            />
          </div>

          {error && (
            <p style={{
              fontSize: "0.78rem",
              color: "var(--danger)",
              fontFamily: "var(--font-outfit), system-ui",
            }}>
              {error}
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={handleLogin}
            disabled={loading}
            style={{ marginTop: "0.5rem", width: "100%", justifyContent: "center" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </div>

        <p style={{
          marginTop: "2rem",
          textAlign: "center",
          fontSize: "0.7rem",
          color: "var(--muted)",
          fontFamily: "var(--font-outfit), system-ui",
        }}>
          Contact your manager to reset your password.
        </p>
      </div>
    </div>
  );
}
