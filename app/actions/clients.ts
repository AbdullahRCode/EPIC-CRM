"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT, type Client, type Branch } from "@/lib/types";
import { randomUUID } from "crypto";

export async function getClients(branch?: Branch | "All"): Promise<Client[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("updated_at", { ascending: false });

  if (branch && branch !== "All") {
    query = query.eq("branch", branch);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[getClients] Supabase error:", error);
    throw new Error(error.message);
  }
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT)
    .single();

  if (error) {
    console.error("[getClient] Supabase error:", error);
    return null;
  }
  return data as Client;
}

export async function createClient(
  input: Omit<Client, "id" | "tenant_id" | "created_at" | "updated_at">
): Promise<Client> {
  const now = new Date().toISOString();
  const client: Client = {
    ...input,
    id: randomUUID(),
    tenant_id: DEFAULT_TENANT,
    created_at: now,
    updated_at: now,
  };

  console.log("[createClient] Inserting:", { id: client.id, name: client.name, branch: client.branch });

  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .insert(client)
    .select()
    .single();

  if (error) {
    console.error("[createClient] Supabase error:", JSON.stringify(error));
    throw new Error(`Failed to save client: ${error.message} (code: ${error.code})`);
  }

  console.log("[createClient] Saved successfully:", data?.id);
  return data as Client;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT)
    .select()
    .single();

  if (error) {
    console.error("[updateClient] Supabase error:", JSON.stringify(error));
    throw new Error(`Failed to update client: ${error.message} (code: ${error.code})`);
  }
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);

  if (error) {
    console.error("[deleteClient] Supabase error:", JSON.stringify(error));
    throw new Error(`Failed to delete client: ${error.message}`);
  }
}

export async function searchClients(ids: string[]): Promise<Client[]> {
  if (ids.length === 0) return [];
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .in("id", ids);

  if (error) {
    console.error("[searchClients] Supabase error:", JSON.stringify(error));
    throw new Error(error.message);
  }
  return (data ?? []) as Client[];
}
