"use client";

import { useState, useRef } from "react";
import type { Client } from "@/lib/types";
import { updateClient } from "@/app/actions/clients";

interface VoiceCommandProps {
  clients: Client[];
  onApply: (action: { type: string; clientId: string; params: Record<string, string> }) => void;
  onClose: () => void;
}

interface Interpretation {
  action: string;
  client_id: string | null;
  client_name: string | null;
  params: Record<string, string>;
  description: string;
  confidence: number;
}

type UndoEntry = { clientId: string; before: Partial<Client> };

export default function VoiceCommand({ clients, onApply, onClose }: VoiceCommandProps) {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interpretation, setInterpretation] = useState<Interpretation | null>(null);
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError("");
    setTranscript("");
    setInterpretation(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied. Please allow microphone access.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setProcessing(true);
  }

  async function processAudio(blob: Blob) {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice.webm");
      fd.append(
        "clients",
        JSON.stringify(clients.map((c) => ({ id: c.id, name: c.name })))
      );

      const res = await fetch("/api/ai/voice-interpret", { method: "POST", body: fd });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      setTranscript(data.transcript ?? "");
      setInterpretation(data.interpretation ?? null);
    } catch {
      setError("Processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function applyAction() {
    if (!interpretation?.client_id || interpretation.action === "unknown") return;
    setApplying(true);
    try {
      const client = clients.find((c) => c.id === interpretation.client_id);
      if (!client) return;

      // Save undo state
      const before: Partial<Client> = {
        alteration_status: client.alteration_status,
        special_order_status: client.special_order_status,
        follow_up: client.follow_up,
      };

      // Apply to DB
      const updates: Partial<Client> = {};
      if (interpretation.action === "update_alteration_status") {
        updates.alteration_status = interpretation.params.status as Client["alteration_status"];
      } else if (interpretation.action === "update_order_status") {
        updates.special_order_status = interpretation.params.status as Client["special_order_status"];
      } else if (interpretation.action === "add_follow_up") {
        updates.follow_up = { needed: true, reason: interpretation.params.reason ?? "" };
      } else if (interpretation.action === "remove_follow_up") {
        updates.follow_up = { needed: false };
      }

      await updateClient(client.id, updates);

      setUndoStack((s) => [{ clientId: client.id, before }, ...s].slice(0, 20));
      onApply({ type: interpretation.action, clientId: client.id, params: interpretation.params });

      setInterpretation(null);
      setTranscript("");
    } finally {
      setApplying(false);
    }
  }

  async function undo() {
    const entry = undoStack[0];
    if (!entry) return;
    await updateClient(entry.clientId, entry.before);
    setUndoStack((s) => s.slice(1));
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="slide-right h-full overflow-y-auto flex flex-col"
        style={{
          width: "min(400px, 100vw)",
          background: "var(--paper)",
          borderLeft: "1px solid var(--line)",
        }}
      >
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--line)" }}
        >
          <p className="font-serif" style={{ fontStyle: "italic", fontSize: "1.1rem" }}>
            Voice command
          </p>
          <button
            onClick={onClose}
            className="label"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}
          >
            Close
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
          {/* Record button */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={processing || applying}
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                border: `2px solid ${recording ? "var(--danger)" : "var(--ink)"}`,
                background: recording ? "var(--danger)" : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: "1.5rem" }}>{recording ? "■" : "◎"}</span>
            </button>
            <p className="label" style={{ color: "var(--muted)" }}>
              {recording
                ? "Recording... tap to stop"
                : processing
                ? "Processing..."
                : "Tap to record"}
            </p>
          </div>

          {/* Error */}
          {error && (
            <p className="label" style={{ color: "var(--danger)", textAlign: "center" }}>
              {error}
            </p>
          )}

          {/* Transcript */}
          {transcript && (
            <div className="w-full" style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
              <p className="label mb-2">Heard</p>
              <p style={{ fontSize: "0.85rem", fontStyle: "italic", color: "var(--muted)" }}>
                &ldquo;{transcript}&rdquo;
              </p>
            </div>
          )}

          {/* Interpretation */}
          {interpretation && (
            <div className="w-full flex flex-col gap-4" style={{ borderTop: "1px solid var(--line)", paddingTop: "1rem" }}>
              <div>
                <p className="label mb-2">Understood as</p>
                <p style={{ fontSize: "0.9rem" }}>{interpretation.description}</p>
                {interpretation.confidence < 0.7 && (
                  <p className="label mt-1" style={{ color: "var(--warn)" }}>
                    Low confidence — please verify
                  </p>
                )}
              </div>

              {interpretation.action !== "unknown" && interpretation.client_id ? (
                <div className="flex gap-2">
                  <button
                    onClick={applyAction}
                    className="btn btn-primary flex-1"
                    disabled={applying}
                  >
                    {applying ? "Applying..." : "Confirm & apply"}
                  </button>
                  <button
                    onClick={() => setInterpretation(null)}
                    className="btn btn-ghost"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <p className="label" style={{ color: "var(--danger)" }}>
                  Could not match a client or action. Try again.
                </p>
              )}
            </div>
          )}

          {/* Undo */}
          {undoStack.length > 0 && (
            <button
              onClick={undo}
              className="btn btn-ghost"
              style={{ alignSelf: "stretch" }}
            >
              ↩ Undo last action ({undoStack.length} in stack)
            </button>
          )}
        </div>

        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--line)" }}>
          <p className="label" style={{ color: "var(--muted)" }}>
            Try: &ldquo;Mark John&apos;s alterations as ready&rdquo; or &ldquo;Add follow-up for Sarah&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}
