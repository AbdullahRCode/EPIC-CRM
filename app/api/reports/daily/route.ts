import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { renderToBuffer } from "@react-pdf/renderer";
import type { DocumentProps } from "@react-pdf/renderer";
import { DailyPDFReport } from "@/lib/reports/daily-pdf";
import React from "react";
import { Resend } from "resend";
import type { Client } from "@/lib/types";
import { getSessionProfile } from "@/lib/auth";
import { todayStr } from "@/lib/dates";

const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "abdullah@logorhythmx.com";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");
  const type = searchParams.get("type") ?? "daily";

  // Three ways in: Vercel cron (Authorization: Bearer CRON_SECRET — Vercel
  // attaches this automatically when the CRON_SECRET env var is set), a
  // REPORT_SECRET query param for manual/external callers, or a signed-in
  // owner/admin session. No hardcoded fallbacks — unset secrets mean
  // session-only access.
  const cronSecret = process.env.CRON_SECRET;
  const cronOk = Boolean(
    cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`
  );
  const envSecret = process.env.REPORT_SECRET;
  const secretOk = Boolean(envSecret && secret === envSecret);
  if (!cronOk && !secretOk) {
    const profile = await getSessionProfile();
    if (!profile || (profile.role !== "admin" && profile.role !== "owner")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: clients, error } = await supabase
      .from("clients")
      .select("*")
      .eq("tenant_id", "epic-menswear");

    if (error) throw error;

    const today = todayStr();
    const typedClients = (clients ?? []) as Client[];
    const resend = new Resend(process.env.RESEND_API_KEY);
    const altReadyCount = typedClients.filter((c) => c.alteration_status === "Ready").length;

    const aiSummary = type === "daily"
      ? `Daily briefing for ${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}. ${typedClients.length} active clients across all branches. Review active alterations and follow-ups for today.`
      : undefined;

    const reportEl = React.createElement(DailyPDFReport, {
      clients: typedClients,
      date: today,
      aiSummary,
      branch: "All",
    }) as React.ReactElement<DocumentProps>;

    const pdfBuffer = await renderToBuffer(reportEl);

    const subject = type === "weekly"
      ? `EPIC Menswear — Weekly Report · ${new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric" })}`
      : `EPIC Menswear — Daily Briefing · ${new Date().toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "EPIC Menswear CRM <reports@epicmenswear.ca>",
      to: [OWNER_EMAIL],
      subject,
      html: `
        <div style="font-family: system-ui; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #fafaf7;">
          <div style="border-bottom: 1px solid #e6e4dd; padding-bottom: 16px; margin-bottom: 24px;">
            <p style="font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #6b6b66; margin: 0;">EPIC Menswear CRM</p>
            <h1 style="font-size: 20px; font-weight: 400; color: #0a0a0a; margin: 4px 0 0;">${type === "weekly" ? "Weekly Report" : "Daily Briefing"}</h1>
            <p style="font-size: 12px; color: #6b6b66; margin: 4px 0 0;">${new Date().toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <p style="font-size: 14px; color: #0a0a0a; line-height: 1.6;">Your ${type === "weekly" ? "weekly" : "daily"} report is attached as a PDF.</p>
          <p style="font-size: 13px; color: #6b6b66; line-height: 1.6;">${typedClients.length} active clients · ${altReadyCount} alterations ready</p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e6e4dd;">
            <p style="font-size: 11px; color: #6b6b66; letter-spacing: 2px; text-transform: uppercase;">EPIC MENSWEAR CRM · CONFIDENTIAL</p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `epic-${type}-report-${today}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    return NextResponse.json({ success: true, sent_to: OWNER_EMAIL, type });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
