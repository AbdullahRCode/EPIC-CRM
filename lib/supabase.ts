import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;
let _adminClient: SupabaseClient | null = null;

function getUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL not set");
  return url;
}

// Anon key — for reads where RLS allows it
export function getSupabase(): SupabaseClient {
  if (!_client) {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
    _client = createClient(getUrl(), key);
  }
  return _client;
}

// Service role key — bypasses RLS, used in server actions and API routes.
// SUPABASE_SERVICE_ROLE_KEY_EPIC is the canonical name (the _EPIC suffix
// distinguishes this business's keys from the owner's other projects); the
// unsuffixed name is accepted as a fallback. Never falls back to the anon key
// (a silent downgrade that breaks invisibly once RLS is enabled).
export function getSupabaseAdmin(): SupabaseClient {
  if (!_adminClient) {
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY_EPIC ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY_EPIC not set");
    _adminClient = createClient(getUrl(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _adminClient;
}
