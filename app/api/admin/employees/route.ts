import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const { data, error } = await getAdmin().auth.admin.listUsers();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const employees = data.users
      .filter((u) => u.user_metadata?.role !== "admin")
      .map((u) => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name ?? u.email,
        role: u.user_metadata?.role ?? "employee",
        branch: u.user_metadata?.branch ?? "—",
        created_at: u.created_at,
      }));

    return NextResponse.json({ employees });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, email, password, branch, role } = await req.json() as {
      name: string;
      email: string;
      password: string;
      branch: string;
      role: string;
    };

    const { data, error } = await getAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, branch, role },
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ user: data.user });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
