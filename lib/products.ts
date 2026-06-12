// Product-category bucketing from free-text item descriptions.
// Shared by the Insights page and the Revenue Intelligence aggregations.
export function parseProductGroup(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("calvin klein")) return "Calvin Klein";
  if (t.includes("carlo lusso")) return "Carlo Lusso";
  if (t.includes("giorgio") || t.includes("fiorelli")) return "Giorgio Fiorelli";
  if (t.includes("mantoni")) return "Mantoni";
  if (t.includes("tommy")) return "Tommy Hilfiger";
  if (t.includes("bertolini")) return "Bertolini";
  if (t.includes("renoir")) return "Renoir";
  if (t.includes("shirt")) return "Dress Shirt";
  if (t.includes("tie")) return "Ties & Accessories";
  if (t.includes("shoe") || t.includes("boot")) return "Footwear";
  if (t.includes("sport") || t.includes("blazer")) return "Sports Coat";
  if (t.includes("tux")) return "Tuxedo";
  return "Other";
}

/** Catalog category (Suit/Tuxedo/…) from free-text purchase descriptions —
    matches the category values used by the products/deals tables. */
export function parseCategory(text: string): string {
  const t = text.toLowerCase();
  if (t.includes("tux")) return "Tuxedo";
  if (t.includes("shirt")) return "Dress Shirt";
  if (t.includes("sport") || t.includes("blazer") || t.includes("coat")) return "Sports Coat";
  if (t.includes("shoe") || t.includes("boot")) return "Footwear";
  if (t.includes("tie") || t.includes("belt") || t.includes("accessor")) return "Accessories";
  if (t.includes("suit")) return "Suit";
  return "Other";
}
