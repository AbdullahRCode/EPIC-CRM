import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_TENANT } from "@/lib/types";

/* Builds the "EPIC Menswear product knowledge" block embedded in AI prompts
   (search price verification, photo-extract amount sanity checks).
   Single source of truth: the products table (migration 0003). Falls back to
   the legacy hardcoded list until that migration runs. */

const LEGACY_PRICE_LIST = `- Carlo Lusso suits: ~$250 full suit
- Calvin Klein: Jacket $350, Pants $175, Full Suit $450
- Tommy Hilfiger: ~$475
- Giorgio Fiorelli, Mantoni, Bertolini, Renoir: $250-$475
- Sports Coats: $150-$350, Shirts: $60-$120, Accessories: $20-$80`;

export async function getPriceListPrompt(): Promise<string> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("name, brand, category, price, sale_price")
      .eq("tenant_id", DEFAULT_TENANT)
      .eq("active", true)
      .order("category")
      .order("price", { ascending: false })
      .limit(200);

    if (error || !data?.length) return LEGACY_PRICE_LIST;

    return data
      .map((p) => {
        const sale = p.sale_price != null ? ` (on sale $${p.sale_price})` : "";
        return `- ${p.name}${p.brand ? ` [${p.brand}]` : ""} · ${p.category}: $${p.price}${sale}`;
      })
      .join("\n");
  } catch {
    return LEGACY_PRICE_LIST;
  }
}
