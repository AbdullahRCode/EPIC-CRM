"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { requireSession, requireRole } from "@/lib/auth";
import { DEFAULT_TENANT, type Client, type Branch } from "@/lib/types";
import { randomUUID } from "crypto";

export async function getClients(branch?: Branch | "All"): Promise<Client[]> {
  const profile = await requireSession();
  const db = getSupabaseAdmin();
  let query = db
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("updated_at", { ascending: false });

  if (profile.role === "employee") {
    // Branch scoping happens in the query itself — employees never receive
    // rows outside their assigned branch, regardless of what they request.
    if (!profile.branch) return [];
    query = query.eq("branch", profile.branch);
  } else if (branch && branch !== "All") {
    query = query.eq("branch", branch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getClients] Supabase error:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const profile = await requireSession();
  let query = getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);

  if (profile.role === "employee") {
    if (!profile.branch) return null;
    query = query.eq("branch", profile.branch);
  }

  const { data, error } = await query.single();
  if (error) {
    console.error("[getClient] Supabase error:", error.message);
    return null;
  }
  return data as Client;
}

export async function createClient(
  input: Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at">
): Promise<Client> {
  const profile = await requireSession();
  const now = new Date().toISOString();
  const client: Client = {
    ...input,
    // Employees can only create clients in their own branch
    branch: profile.role === "employee" ? (profile.branch as Branch) : input.branch,
    id: randomUUID(),
    tenant_id: DEFAULT_TENANT,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .insert(client)
    .select()
    .single();

  if (error) {
    console.error("[createClient] Supabase error:", error.message);
    throw new Error(`Failed to save client: ${error.message} (code: ${error.code})`);
  }
  return data as Client;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const profile = await requireSession();
  const safeUpdates = { ...updates };

  if (profile.role === "employee") {
    // Employees can't move clients out of their branch
    safeUpdates.branch = profile.branch as Branch;
  }

  let query = getSupabaseAdmin()
    .from("clients")
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);

  if (profile.role === "employee") {
    // ...and can only touch rows already in their branch
    query = query.eq("branch", profile.branch);
  }

  const { data, error } = await query.select().single();
  if (error) {
    console.error("[updateClient] Supabase error:", error.message);
    throw new Error(`Failed to update client: ${error.message} (code: ${error.code})`);
  }
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  await requireRole("admin", "owner");
  const { error } = await getSupabaseAdmin()
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);

  if (error) {
    console.error("[deleteClient] Supabase error:", error.message);
    throw new Error(`Failed to delete client: ${error.message}`);
  }
}

export async function searchClients(ids: string[]): Promise<Client[]> {
  const profile = await requireSession();
  if (ids.length === 0) return [];

  let query = getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .in("id", ids);

  if (profile.role === "employee") {
    if (!profile.branch) return [];
    query = query.eq("branch", profile.branch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[searchClients] Supabase error:", error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as Client[];
}
