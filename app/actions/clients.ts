"use server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { requireSession, requireRole } from "@/lib/auth";
import { DEFAULT_TENANT, BRANCHES, type Client, type Branch } from "@/lib/types";
import { randomUUID } from "crypto";

// ── Server-side validation ───────────────────────────────────────────────────
// The UI validates too, but server actions are network-callable by any
// authenticated user; never trust the payload (mass assignment, bogus
// branches, NaN spends, unbounded notes).

const UPDATABLE_FIELDS = new Set<keyof Client>([
  "name",
  "phone",
  "email",
  "branch",
  "events",
  "event_date",
  "event_note",
  "alterations",
  "alteration_note",
  "alteration_status",
  "special_order",
  "special_order_status",
  "follow_up",
  "measurements",
  "visits",
]);

const MAX_TEXT = 5000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validationError(msg: string): never {
  throw new Error(`Invalid client data: ${msg}`);
}

function validateClientFields(input: Partial<Client>, isCreate: boolean): void {
  if (isCreate || input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim()) validationError("name is required");
    if (input.name.length > 200) validationError("name too long");
  }
  if (input.phone !== undefined && input.phone !== "") {
    if (typeof input.phone !== "string" || !/^[\d\s()+.\-]{7,25}$/.test(input.phone.trim()))
      validationError("phone must be 7-25 digits/symbols");
  }
  if (input.email !== undefined && input.email !== "") {
    if (typeof input.email !== "string" || !input.email.includes("@") || input.email.length > 254)
      validationError("email looks wrong");
  }
  if (input.branch !== undefined && !BRANCHES.includes(input.branch as Branch))
    validationError("unknown branch");
  if (input.event_date !== undefined && input.event_date && !DATE_RE.test(input.event_date))
    validationError("event_date must be YYYY-MM-DD");
  for (const key of ["event_note", "alteration_note", "special_order"] as const) {
    const v = input[key];
    if (v !== undefined && typeof v === "string" && v.length > MAX_TEXT)
      validationError(`${key} too long`);
  }
  if (input.visits !== undefined) {
    if (!Array.isArray(input.visits)) validationError("visits must be an array");
    for (const v of input.visits) {
      if (!v?.date || !DATE_RE.test(v.date)) validationError("visit date must be YYYY-MM-DD");
      if (v.spend !== undefined && v.spend !== null) {
        if (typeof v.spend !== "number" || Number.isNaN(v.spend) || v.spend < 0 || v.spend > 1_000_000)
          validationError("visit spend must be a number between 0 and 1,000,000");
      }
      if (typeof v.notes === "string" && v.notes.length > MAX_TEXT) validationError("visit notes too long");
    }
  }
}

/** Strip non-updatable/unknown keys (id, tenant_id, created_at, …). */
function pickUpdatableFields(updates: Partial<Client>): Partial<Client> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (UPDATABLE_FIELDS.has(key as keyof Client)) safe[key] = value;
  }
  return safe as Partial<Client>;
}

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
  // Employees can only create clients in their own branch — validate the
  // branch that will actually be written, not whatever the client sent.
  const effectiveBranch =
    profile.role === "employee" ? (profile.branch as Branch) : input.branch;
  validateClientFields({ ...input, branch: effectiveBranch }, true);
  const now = new Date().toISOString();
  const client: Client = {
    ...(pickUpdatableFields(input) as typeof input),
    branch: effectiveBranch,
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
  const safeUpdates = pickUpdatableFields(updates);

  if (profile.role === "employee") {
    // Employees can't move clients out of their branch
    safeUpdates.branch = profile.branch as Branch;
  }
  validateClientFields(safeUpdates, false);

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
