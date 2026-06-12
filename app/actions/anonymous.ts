"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireSession, requireRole } from "@/lib/auth";
import { todayStr } from "@/lib/dates";
import { BRANCHES, type Branch } from "@/lib/types";
import { revalidatePath } from "next/cache";

export interface AnonymousSale {
  id: string;
  branch: string;
  sale_date: string;
  items: { item: string; amount: number }[];
  total_amount: number;
  staff?: string;
  notes?: string;
  created_at: string;
}

export async function getAnonymousSales(branch?: string, date?: string): Promise<AnonymousSale[]> {
  const profile = await requireSession();
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("anonymous_sales")
    .select("*")
    .eq("tenant_id", "epic-menswear")
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (profile.role === "employee") {
    if (!profile.branch) return [];
    query = query.eq("branch", profile.branch);
  } else if (branch && branch !== "All") {
    query = query.eq("branch", branch);
  }
  if (date) query = query.eq("sale_date", date);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as AnonymousSale[];
}

export async function addAnonymousSale(sale: {
  branch: string;
  items: { item: string; amount: number }[];
  staff?: string;
  notes?: string;
}): Promise<void> {
  const profile = await requireSession();
  // Employees always log against their own branch
  const branch = profile.role === "employee" ? profile.branch : sale.branch;
  if (!branch) throw new Error("No branch assigned");
  if (!BRANCHES.includes(branch as Branch)) throw new Error(`Unknown branch: ${branch}`);

  const supabase = createSupabaseServerClient();
  const today = todayStr();
  const newTotal = sale.items.reduce((s, i) => s + (i.amount ?? 0), 0);

  // Atomic INSERT ... ON CONFLICT in the database — concurrent saves
  // accumulate instead of racing (see add_anonymous_sale SQL function).
  const { error } = await supabase.rpc("add_anonymous_sale", {
    p_tenant_id: "epic-menswear",
    p_branch: branch,
    p_sale_date: today,
    p_items: sale.items,
    p_total: newTotal,
    p_staff: sale.staff ?? null,
    p_notes: sale.notes ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/insights");
}

export async function deleteAnonymousSale(id: string): Promise<void> {
  await requireRole("admin", "owner");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("anonymous_sales")
    .delete()
    .eq("id", id)
    .eq("tenant_id", "epic-menswear");
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
