"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/auth";
import { DEFAULT_TENANT, type Comm } from "@/lib/types";

// Owner/admin only — runs through the service-role client so it keeps working
// once RLS locks the comms table away from the public anon key.
export async function getComms(): Promise<Comm[]> {
  await requireRole("admin", "owner");
  const { data, error } = await getSupabaseAdmin()
    .from("comms")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("[getComms] Supabase error:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as Comm[];
}
