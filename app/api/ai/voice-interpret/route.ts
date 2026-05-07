export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const clientsJson = formData.get("clients") as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Transcribe with Whisper
    const transcription = await getOpenAI().audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
    });

    const transcript = transcription.text;

    // Interpret command with Claude
    const clients = clientsJson ? JSON.parse(clientsJson) : [];
    const clientNames = clients.slice(0, 50).map((c: { id: string; name: string }) => `${c.id}: ${c.name}`).join("\n");

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a voice command interpreter for EPIC Menswear CRM.

Transcript: "${transcript}"

Available clients (id: name):
${clientNames}

Interpret this as a CRM action and return ONLY valid JSON:
{
  "action": "update_alteration_status|update_order_status|add_follow_up|remove_follow_up|add_visit|add_note|unknown",
  "client_id": "matched client id or null",
  "client_name": "matched client name or null",
  "params": {
    "status": "...",
    "note": "...",
    "reason": "..."
  },
  "description": "Human readable description of what will happen",
  "confidence": 0.0-1.0
}

Common commands:
- "Mark [name]'s alterations as ready" â†’ update_alteration_status, status: "Ready"
- "Add follow-up for [name]" â†’ add_follow_up
- "Remove follow-up for [name]" â†’ remove_follow_up
- "[Name]'s order has arrived" â†’ update_order_status, status: "Arrived"`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const interpretation = jsonMatch ? JSON.parse(jsonMatch[0]) : { action: "unknown", description: raw };

    return NextResponse.json({ transcript, interpretation });
  } catch (err) {
    console.error("Voice interpret error:", err);
    return NextResponse.json({ error: "Voice processing failed" }, { status: 500 });
  }
}

