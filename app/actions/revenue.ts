"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireRole } from "@/lib/auth";
import { DEFAULT_TENANT, BRANCHES, type Client, type Branch } from "@/lib/types";
import { parseProductGroup } from "@/lib/products";
import { daysAgoStr, todayStr } from "@/lib/dates";

/* Revenue Intelligence — admin/owner only (enforced here, server-side).
   Aggregates the two revenue sources the CRM already has:
   - client visit spend (visits JSONB on clients)
   - anonymous walk-in sales (anonymous_sales, items JSONB)               */

export interface RevenueIntelligence {
  byBranch: { branch: Branch; revenue: number; sales: number }[];
  byCategory: { category: string; revenue: number; sales: number }[];
  topProducts: { name: string; revenue: number; sales: number }[];
  topStaff: { name: string; revenue: number; sales: number }[];
  weekly: { weekStart: string; revenue: number }[]; // last 8 weeks, oldest first
  thisMonth: number;
  lastMonth: number;
  thisWeek: number;
  lastWeek: number;
  totalRevenue: number;
  totalSales: number;
}

interface SaleRecord {
  date: string; // YYYY-MM-DD
  branch: string;
  staff: string;
  item: string;
  amount: number;
}

export async function getRevenueIntelligence(): Promise<RevenueIntelligence> {
  await requireRole("admin", "owner");

  const db = getSupabaseAdmin();
  const [clientsRes, anonRes] = await Promise.all([
    db.from("clients").select("branch, visits").eq("tenant_id", DEFAULT_TENANT),
    createSupabaseServerClient()
      .from("anonymous_sales")
      .select("branch, sale_date, items, staff")
      .eq("tenant_id", DEFAULT_TENANT),
  ]);

  if (clientsRes.error) throw new Error(clientsRes.error.message);
  if (anonRes.error) throw new Error(anonRes.error.message);

  // Flatten both sources into one sale-record stream
  const sales: SaleRecord[] = [];
  for (const c of (clientsRes.data ?? []) as Pick<Client, "branch" | "visits">[]) {
    for (const v of c.visits ?? []) {
      if (!v.spend || v.spend <= 0) continue;
      sales.push({
        date: v.date,
        branch: c.branch,
        staff: v.staff?.trim() ?? "",
        item: v.items?.trim() ?? "",
        amount: v.spend,
      });
    }
  }
  for (const s of (anonRes.data ?? []) as {
    branch: string;
    sale_date: string;
    items: { item: string; amount: number }[] | null;
    staff: string | null;
  }[]) {
    for (const i of s.items ?? []) {
      if (!i?.amount || i.amount <= 0) continue;
      sales.push({
        date: s.sale_date,
        branch: s.branch,
        staff: s.staff?.trim() ?? "",
        item: i.item?.trim() ?? "",
        amount: i.amount,
      });
    }
  }

  const sum = (list: SaleRecord[]) => list.reduce((t, s) => t + s.amount, 0);

  // Group helpers
  function rank(keyOf: (s: SaleRecord) => string, cap: number) {
    const map: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const s of sales) {
      const raw = keyOf(s);
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (!map[key]) map[key] = { name: raw, revenue: 0, sales: 0 };
      map[key].revenue += s.amount;
      map[key].sales += 1;
    }
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue || b.sales - a.sales)
      .slice(0, cap);
  }

  const byBranch = BRANCHES.map((branch) => {
    const b = sales.filter((s) => s.branch === branch);
    return { branch, revenue: sum(b), sales: b.length };
  }).sort((a, b) => b.revenue - a.revenue);

  const byCategory = rank((s) => (s.item ? parseProductGroup(s.item) : ""), 20).map((c) => ({
    category: c.name,
    revenue: c.revenue,
    sales: c.sales,
  }));

  const topProducts = rank((s) => s.item, 15);
  const topStaff = rank((s) => s.staff, 15);

  // Trends — store-clock weeks (Mon-agnostic: rolling 7-day buckets)
  const weekly: { weekStart: string; revenue: number }[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = daysAgoStr((w + 1) * 7 - 1);
    const end = daysAgoStr(w * 7);
    weekly.push({
      weekStart: start,
      revenue: sum(sales.filter((s) => s.date >= start && s.date <= end)),
    });
  }

  const today = todayStr();
  const thisMonthStart = today.slice(0, 8) + "01";
  const lastMonthEnd = daysAgoStr(Number(today.slice(8, 10))); // last day of prev month
  const lastMonthStart = lastMonthEnd.slice(0, 8) + "01";

  return {
    byBranch,
    byCategory,
    topProducts,
    topStaff,
    weekly,
    thisMonth: sum(sales.filter((s) => s.date >= thisMonthStart && s.date <= today)),
    lastMonth: sum(sales.filter((s) => s.date >= lastMonthStart && s.date <= lastMonthEnd)),
    thisWeek: sum(sales.filter((s) => s.date >= daysAgoStr(6) && s.date <= today)),
    lastWeek: sum(sales.filter((s) => s.date >= daysAgoStr(13) && s.date <= daysAgoStr(7))),
    totalRevenue: sum(sales),
    totalSales: sales.length,
  };
}
