import { createSupabaseServerClient } from "@/lib/supabase-server";

export type UserRole = "admin" | "owner" | "employee";

export interface SessionProfile {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  branch: string; // "All" for admin/owner; the assigned branch (or "") for employee
}

// Verifies the JWT against the Supabase Auth server (getUser, not getSession),
// then reads role/branch from app_metadata — which only the service role can write.
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const appMeta = user.app_metadata ?? {};
  const role: UserRole =
    appMeta.role === "admin" || appMeta.role === "owner" || appMeta.role === "employee"
      ? appMeta.role
      : "employee";
  const branch =
    typeof appMeta.branch === "string" && appMeta.branch.trim() ? appMeta.branch : "";

  return {
    userId: user.id,
    email: user.email ?? "",
    name: user.user_metadata?.name ?? user.email ?? "Staff",
    role,
    branch: role === "employee" ? branch : "All",
  };
}

export async function requireSession(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (!profile) throw new Error("Unauthorized: sign in required");
  return profile;
}

export async function requireRole(...roles: UserRole[]): Promise<SessionProfile> {
  const profile = await requireSession();
  if (!roles.includes(profile.role)) throw new Error("Forbidden: insufficient role");
  return profile;
}
