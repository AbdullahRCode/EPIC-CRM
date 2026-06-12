import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export type UserRole = "admin" | "owner" | "employee";

export interface UserProfile {
  role: UserRole;
  name: string;
  branch: string; // "All" for admin/owner, specific branch for employee
  email: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // role/branch live in app_metadata (service-role writable only);
  // name is display-only and stays in user_metadata.
  const appMeta = user.app_metadata ?? {};
  const role: UserRole = appMeta.role ?? "employee";
  const name: string = user.user_metadata?.name ?? user.email ?? "Staff";
  const branch: string = appMeta.branch ?? "All";

  return { role, name, branch, email: user.email ?? "" };
}
