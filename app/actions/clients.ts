"use server";

import { supabase } from "@/lib/supabase";
import { DEFAULT_TENANT, type Client, type Branch } from "@/lib/types";
import { randomUUID } from "crypto";

export async function getClients(branch?: Branch | "All"): Promise<Client[]> {
  let query = supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .order("updated_at", { ascending: false });

  if (branch && branch !== "All") {
    query = query.eq("branch", branch);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT)
    .single();

  if (error) return null;
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

  const { data, error } = await supabase.from("clients").insert(client).select().single();
  if (error) throw new Error(error.message);
  return data as Client;
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as Client;
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .eq("tenant_id", DEFAULT_TENANT);

  if (error) throw new Error(error.message);
}

export async function searchClients(ids: string[]): Promise<Client[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("tenant_id", DEFAULT_TENANT)
    .in("id", ids);

  if (error) throw new Error(error.message);
  return (data ?? []) as Client[];
}
