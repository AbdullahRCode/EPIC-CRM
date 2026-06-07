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

  const meta = user.user_metadata ?? {};
  const role: UserRole = meta.role ?? "employee";
  const name: string = meta.name ?? user.email ?? "Staff";
  const branch: string = meta.branch ?? "All";

  return { role, name, branch, email: user.email ?? "" };
}
