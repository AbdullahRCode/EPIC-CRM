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
  // Branch semantics must mirror lib/auth.ts: employees with no assigned
  // branch get "" (never "All"), so the UI can detect and surface it.
  const appMeta = user.app_metadata ?? {};
  const role: UserRole =
    appMeta.role === "admin" || appMeta.role === "owner" || appMeta.role === "employee"
      ? appMeta.role
      : "employee";
  const name: string = user.user_metadata?.name ?? user.email ?? "Staff";
  const branch: string =
    role === "employee"
      ? typeof appMeta.branch === "string" && appMeta.branch.trim() ? appMeta.branch : ""
      : "All";

  return { role, name, branch, email: user.email ?? "" };
}
