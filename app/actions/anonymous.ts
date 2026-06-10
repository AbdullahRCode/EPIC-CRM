"use server";

import { createSupabaseServerClient } from "@/lib/supabase-server";
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
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("anonymous_sales")
    .select("*")
    .eq("tenant_id", "epic-menswear")
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (branch && branch !== "All") query = query.eq("branch", branch);
  if (date) query = query.eq("sale_date", date);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AnonymousSale[];
}

export async function addAnonymousSale(sale: {
  branch: string;
  items: { item: string; amount: number }[];
  staff?: string;
  notes?: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const total = sale.items.reduce((s, i) => s + (i.amount ?? 0), 0);

  const { error } = await supabase.from("anonymous_sales").insert({
    tenant_id: "epic-menswear",
    branch: sale.branch,
    sale_date: new Date().toISOString().split("T")[0],
    items: sale.items,
    total_amount: total,
    staff: sale.staff ?? null,
    notes: sale.notes ?? null,
  });

  if (error) throw error;
  revalidatePath("/");
  revalidatePath("/insights");
}

export async function deleteAnonymousSale(id: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("anonymous_sales")
    .delete()
    .eq("id", id)
    .eq("tenant_id", "epic-menswear");
  if (error) throw error;
  revalidatePath("/");
}
