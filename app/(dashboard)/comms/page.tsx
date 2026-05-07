"use client";

import { useEffect, useState } from "react";
import type { Comm } from "@/lib/types";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_TENANT } from "@/lib/types";
import { useBranchOwner } from "@/lib/branch-context";

export default function CommsPage() {
  const { ownerMode } = useBranchOwner();
  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await getSupabase()
          .from("comms")
          .select("*")
          .eq("tenant_id", DEFAULT_TENANT)
          .order("created_at", { ascending: false })
          .limit(200);
        setComms((data ?? []) as Comm[]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (!ownerMode) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ height: "calc(100vh - 97px)" }}>
        <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1.1rem", color: "var(--muted)" }}>
          Owner mode required
        </p>
        <p className="label" style={{ color: "var(--muted)" }}>
          Enable owner mode in the header to view communications
        </p>
      </div>
    );
  }

  const channelIcon = (ch: Comm["channel"]) => {
    if (ch === "whatsapp") return "↗ WhatsApp";
    if (ch === "email") return "✉ Email";
    if (ch === "sms") return "✉ SMS";
    return "◎ In-person";
  };

  const directionColor = (d: Comm["direction"]) =>
    d === "outbound" ? "var(--ink)" : "var(--muted)";

  return (
    <div className="overflow-y-auto" style={{ height: "calc(100vh - 97px)" }}>
      <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <h1 className="font-serif" style={{ fontSize: "1.6rem", fontWeight: 400 }}>
          <em>Communications</em>
        </h1>
        <p className="label mt-1" style={{ color: "var(--muted)" }}>
          All inbound & outbound messages — owner view
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <span className="label" style={{ color: "var(--muted)" }}>Loading...</span>
        </div>
      ) : comms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <p className="font-serif" style={{ fontStyle: "italic", color: "var(--muted)" }}>
            No communications logged yet
          </p>
          <p className="label" style={{ color: "var(--muted)" }}>
            Messages sent via the client modal will appear here
          </p>
        </div>
      ) : (
        <div>
          {comms.map((comm) => (
            <div
              key={comm.id}
              className="flex items-start gap-4 px-6 py-4"
              style={{ borderBottom: "1px solid var(--line)" }}
            >
              {/* Direction indicator */}
              <div
                style={{
                  width: 3,
                  alignSelf: "stretch",
                  background: comm.direction === "outbound" ? "var(--ink)" : "var(--line)",
                  flexShrink: 0,
                }}
              />

              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="label" style={{ color: directionColor(comm.direction) }}>
                      {channelIcon(comm.channel)}
                    </span>
                    <span className="label" style={{ color: "var(--muted)" }}>
                      {comm.direction}
                    </span>
                  </div>
                  <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                    {new Date(comm.created_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem" }}>{comm.summary}</p>
                {comm.sent_by && (
                  <span className="label" style={{ color: "var(--muted)", fontSize: "0.55rem" }}>
                    By {comm.sent_by}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
