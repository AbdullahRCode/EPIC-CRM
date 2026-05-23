export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/anthropic";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { clientId, statusType, sentBy } = await req.json();

    // Fetch client
    const { data: client, error } = await getSupabaseAdmin()
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .eq("tenant_id", DEFAULT_TENANT)
      .single();

    if (error || !client?.email) {
      return NextResponse.json({ error: "Client not found or no email" }, { status: 400 });
    }

    // Generate email with Claude
    const isAlteration = statusType === "alteration_ready";
    const subject = isAlteration
      ? `Your alterations are ready â€” EPIC Menswear ${client.branch}`
      : `Your special order has arrived â€” EPIC Menswear ${client.branch}`;

    const promptContext = isAlteration
      ? `The client's alterations (${(client.alterations ?? []).join(", ")}) are ready for pickup at our ${client.branch} location.`
      : `The client's special order "${client.special_order}" has arrived at our ${client.branch} location.`;

    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Write a brief, elegant email for EPIC Menswear, a luxury menswear brand.

Client name: ${client.name}
Context: ${promptContext}
Branch: ${client.branch}

Write ONLY the email body (no subject line). Tone: warm, professional, luxury. 3-4 sentences max. Do not use exclamation marks. End with: "We look forward to seeing you." â€” EPIC Menswear`,
        },
      ],
    });

    const body = message.content[0].type === "text" ? message.content[0].text : "";

    await getResend().emails.send({
      from: "EPIC Menswear <noreply@epicmenswear.com>",
      to: client.email,
      subject,
      text: body,
    });

    // Log communication
    await getSupabaseAdmin().from("comms").insert({
      tenant_id: DEFAULT_TENANT,
      client_id: clientId,
      channel: "email",
      direction: "outbound",
      summary: subject,
      sent_by: sentBy ?? "system",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Send email error:", err);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }
}

