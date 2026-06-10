import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { Client } from "@/lib/types";
import { deriveTags } from "@/lib/types";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#fafaf7", padding: 40 },
  header: { marginBottom: 24, borderBottom: "1pt solid #e6e4dd", paddingBottom: 12 },
  logo: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 2, color: "#0a0a0a" },
  logoSub: { fontSize: 8, letterSpacing: 4, color: "#6b6b66", marginTop: 2 },
  date: { fontSize: 8, color: "#6b6b66", marginTop: 4, letterSpacing: 1 },
  sectionTitle: { fontSize: 7, letterSpacing: 3, color: "#6b6b66", textTransform: "uppercase", marginBottom: 8, marginTop: 16 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statBox: { flex: 1, border: "0.5pt solid #e6e4dd", padding: 10 },
  statNum: { fontSize: 22, fontFamily: "Helvetica", color: "#0a0a0a", marginBottom: 2 },
  statLabel: { fontSize: 7, letterSpacing: 2, color: "#6b6b66", textTransform: "uppercase" },
  branchRow: { flexDirection: "row", justifyContent: "space-between", borderBottom: "0.5pt solid #e6e4dd", paddingVertical: 6 },
  branchName: { fontSize: 9, color: "#0a0a0a", fontFamily: "Helvetica-Bold" },
  branchVal: { fontSize: 9, color: "#6b6b66" },
  altRow: { borderBottom: "0.5pt solid #e6e4dd", paddingVertical: 6 },
  clientName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0a0a0a" },
  clientSub: { fontSize: 8, color: "#6b6b66", marginTop: 1 },
  noteBox: { backgroundColor: "#0a0a0a", padding: 12, marginTop: 16 },
  noteLabel: { fontSize: 7, letterSpacing: 3, color: "#d4ad53", marginBottom: 6, textTransform: "uppercase" },
  noteText: { fontSize: 9, color: "#fafaf7", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTop: "0.5pt solid #e6e4dd", paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: "#6b6b66", letterSpacing: 1 },
});

const BRANCHES = ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"];

interface DailyReportProps {
  clients: Client[];
  date: string;
  aiSummary?: string;
  branch?: string;
}

export function DailyPDFReport({ clients, date, aiSummary, branch }: DailyReportProps) {
  const totalRevenue = clients.reduce((s, c) => s + c.visits.reduce((vs, v) => vs + (v.spend ?? 0), 0), 0);
  const vipCount = clients.filter((c) => deriveTags(c).includes("VIP")).length;
  const alterationsReady = clients.filter((c) => c.alteration_status === "Ready").length;
  const followUpCount = clients.filter((c) => c.follow_up?.needed).length;

  const todayStr = new Date(date).toLocaleDateString("en-CA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const branchStats = BRANCHES.map((b) => {
    const bc = clients.filter((c) => c.branch === b);
    const rev = bc.reduce((s, c) => s + c.visits.reduce((vs, v) => vs + (v.spend ?? 0), 0), 0);
    return { name: b, count: bc.length, revenue: rev };
  }).filter((b) => b.count > 0);

  const activeAlterations = clients.filter((c) => c.alteration_status && c.alteration_status !== "Picked up");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>EPIC Menswear</Text>
          <Text style={styles.logoSub}>CRM DAILY BRIEFING</Text>
          <Text style={styles.date}>{todayStr.toUpperCase()}{branch && branch !== "All" ? ` · ${branch.toUpperCase()}` : " · ALL BRANCHES"}</Text>
        </View>

        {/* Stats */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{clients.length}</Text>
            <Text style={styles.statLabel}>Active clients</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>${totalRevenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total revenue</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{vipCount}</Text>
            <Text style={styles.statLabel}>VIP clients</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{alterationsReady}</Text>
            <Text style={styles.statLabel}>Alt. ready</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{followUpCount}</Text>
            <Text style={styles.statLabel}>Follow-ups</Text>
          </View>
        </View>

        {/* Branch breakdown */}
        {branchStats.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Branch Performance</Text>
            {branchStats.map((b) => (
              <View key={b.name} style={styles.branchRow}>
                <Text style={styles.branchName}>{b.name}</Text>
                <Text style={styles.branchVal}>{b.count} clients · ${b.revenue.toLocaleString()}</Text>
              </View>
            ))}
          </>
        )}

        {/* Active alterations */}
        {activeAlterations.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Alterations ({activeAlterations.length})</Text>
            {activeAlterations.slice(0, 8).map((c) => (
              <View key={c.id} style={styles.altRow}>
                <Text style={styles.clientName}>{c.name}</Text>
                <Text style={styles.clientSub}>{c.branch} · {c.alteration_status} · {c.phone}</Text>
                {c.alteration_note && <Text style={styles.clientSub}>{c.alteration_note}</Text>}
              </View>
            ))}
          </>
        )}

        {/* AI Summary */}
        {aiSummary && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>✦ AI Daily Summary</Text>
            <Text style={styles.noteText}>{aiSummary}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>EPIC MENSWEAR CRM</Text>
          <Text style={styles.footerText}>{todayStr.toUpperCase()}</Text>
          <Text style={styles.footerText}>CONFIDENTIAL</Text>
        </View>
      </Page>
    </Document>
  );
}
