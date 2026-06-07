"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { getUserProfile, type UserProfile } from "@/lib/user-role";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import ClientModal from "@/components/ClientModal";
import type { Branch } from "@/lib/types";

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
      // Owner or admin → redirect to full dashboard
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

  function handleSave() {
    setShowForm(false);
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--paper)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p className="label" style={{ color: "var(--muted)" }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      {/* Minimal header */}
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "0.75rem 1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <svg viewBox="0 0 180 36" height="32" width="160" xmlns="http://www.w3.org/2000/svg">
          <rect x="0.5" y="0.5" width="179" height="35" fill="none" stroke="#0a0a0a" strokeWidth="1"/>
          <rect x="1" y="1" width="68" height="34" fill="#0a0a0a"/>
          <text x="34" y="24" textAnchor="middle" fontFamily="'Outfit', system-ui, sans-serif" fontWeight="700" fontSize="16" fill="#fafaf7" letterSpacing="2">EPIC</text>
          <text x="124" y="24" textAnchor="middle" fontFamily="'Cormorant Garamond', Georgia, serif" fontStyle="italic" fontWeight="400" fontSize="15" fill="#0a0a0a" letterSpacing="0.5">Menswear</text>
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: "var(--font-outfit), system-ui", fontSize: "0.7rem", color: "var(--ink)" }}>
              {profile?.name}
            </p>
            <p className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
              {profile?.branch}
            </p>
          </div>
          <button
            onClick={handleSignOut}
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
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
            <em>Good {getTimeOfDay()}, {profile?.name?.split(" ")[0]}.</em>
          </h1>
          <p className="label" style={{ color: "var(--muted)", marginTop: "0.25rem" }}>
            {profile?.branch} &middot;{" "}
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        {!showForm && (
          <button
            className="btn btn-primary"
            onClick={() => setShowForm(true)}
            style={{ width: "100%", justifyContent: "center", fontSize: "0.75rem", padding: "1rem" }}
          >
            + New Client Entry
          </button>
        )}

        <p
          style={{
            marginTop: "3rem",
            textAlign: "center",
            fontSize: "0.7rem",
            color: "var(--muted)",
            fontFamily: "var(--font-outfit), system-ui",
            fontStyle: "italic",
          }}
        >
          All entries are saved to {profile?.branch} automatically.
        </p>
      </div>

      {/* Modal renders as a full-screen overlay */}
      {showForm && profile && (
        <ClientModal
          defaultBranch={profile.branch as Branch}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
