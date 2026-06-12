import { getSupabaseAdmin } from "@/lib/supabase";
import { todayStr } from "@/lib/dates";
import { DEFAULT_TENANT } from "@/lib/types";

/* Daily per-user caps on paid AI calls. Primary store: the ai_usage table via
   the atomic increment_ai_usage RPC (migration 0002). Until that migration
   runs, falls back to a per-instance in-memory counter — weaker (resets on
   cold start) but better than uncapped. */

export type AiFeature = "search" | "summary" | "photo" | "note" | "email";

const DAILY_LIMITS: Record<AiFeature, number> = {
  search: 100,
  summary: 20,
  photo: 60,
  note: 100,
  email: 60,
};

const memCounts = new Map<string, number>();
let memDay = "";

function capMessage(feature: AiFeature, limit: number): string {
  const names: Record<AiFeature, string> = {
    search: "AI search",
    summary: "daily summary",
    photo: "photo intake",
    note: "AI notes",
    email: "client emails",
  };
  return `Daily limit reached for ${names[feature]} (${limit}/day). Resets at midnight — contact your admin if you need more.`;
}

export async function checkAiCap(
  feature: AiFeature,
  userId: string
): Promise<{ allowed: true } | { allowed: false; message: string }> {
  const limit = DAILY_LIMITS[feature];
  const day = todayStr();

  try {
    const { data, error } = await getSupabaseAdmin().rpc("increment_ai_usage", {
      p_tenant_id: DEFAULT_TENANT,
      p_user_id: userId,
      p_feature: feature,
      p_usage_date: day,
    });
    if (!error && typeof data === "number") {
      return data > limit ? { allowed: false, message: capMessage(feature, limit) } : { allowed: true };
    }
  } catch {
    /* table/RPC missing until migration 0002 — fall through */
  }

  if (memDay !== day) {
    memCounts.clear();
    memDay = day;
  }
  const key = `${userId}:${feature}`;
  const n = (memCounts.get(key) ?? 0) + 1;
  memCounts.set(key, n);
  return n > limit ? { allowed: false, message: capMessage(feature, limit) } : { allowed: true };
}
