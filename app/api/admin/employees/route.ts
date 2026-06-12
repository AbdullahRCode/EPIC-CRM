import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionProfile } from "@/lib/auth";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY_EPIC!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireAdmin(): Promise<NextResponse | null> {
  const profile = await getSessionProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { data, error } = await getAdmin().auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const employees = data.users
      .filter((u) => u.app_metadata?.role !== "admin")
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name ?? u.email,
        role: u.app_metadata?.role ?? "employee",
        branch: u.app_metadata?.branch ?? "—",
        created_at: u.created_at,
      }));

    return NextResponse.json({ employees });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { name, email, password, branch, role } = await req.json() as {
      name: string;
      email: string;
      password: string;
      branch: string;
      role: string;
    };

    if (!["owner", "employee"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const { data, error } = await getAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role, branch },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
