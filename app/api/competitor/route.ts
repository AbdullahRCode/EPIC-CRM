import { NextResponse } from "next/server";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

// Full branch + local competitor map for EPIC Menswear
const BRANCH_COMPETITORS = {
  "Surrey - Guildford": {
    mall: "Guildford Town Centre, Surrey BC",
    competitors: [
      { name: "Tip Top Tailors", location: "Guildford Town Centre Surrey BC", type: "In-mall direct competitor" },
      { name: "Moores Clothing", location: "Surrey BC", type: "Regional competitor" },
      { name: "Black & Lee Tuxedos", location: "Guildford Town Centre Surrey BC", type: "Formalwear competitor" },
      { name: "Jack & Jones", location: "Surrey BC", type: "Casual menswear" },
      { name: "RW&CO", location: "Surrey BC", type: "Smart casual menswear" },
    ],
  },
  "Surrey - Central City": {
    mall: "Central City Shopping Centre, King George Blvd Surrey BC",
    competitors: [
      { name: "Tip Top Tailors", location: "Central City Surrey BC", type: "In-mall direct competitor" },
      { name: "Moores Clothing", location: "Surrey BC", type: "Regional competitor" },
      { name: "RW&CO", location: "Central City Surrey BC", type: "Smart casual menswear" },
      { name: "Indochino", location: "Vancouver BC", type: "Custom suit competitor" },
      { name: "Jack & Jones", location: "Surrey BC", type: "Casual menswear" },
    ],
  },
  "Tsawwassen Mills": {
    mall: "Tsawwassen Mills, Tsawwassen BC",
    competitors: [
      { name: "Tip Top Tailors", location: "Tsawwassen Mills BC", type: "In-mall direct competitor" },
      { name: "RW&CO", location: "Tsawwassen Mills BC", type: "Smart casual menswear" },
      { name: "Moores Clothing", location: "Delta BC", type: "Regional competitor" },
      { name: "Indochino", location: "Vancouver BC", type: "Custom suit competitor" },
      { name: "Banana Republic", location: "Tsawwassen Mills BC", type: "Premium casual menswear" },
    ],
  },
  "Burnaby": {
    mall: "City of Lougheed Shopping Centre, Burnaby BC",
    competitors: [
      { name: "Tip Top Tailors", location: "Burnaby BC", type: "Direct competitor" },
      { name: "Moores Clothing", location: "Burnaby BC", type: "Direct competitor" },
      { name: "Grafton & Co", location: "Lougheed Town Centre Burnaby BC", type: "In-mall menswear" },
      { name: "RW&CO", location: "Burnaby BC", type: "Smart casual menswear" },
      { name: "Indochino", location: "Vancouver BC", type: "Custom suit competitor" },
    ],
  },
  "Victoria": {
    mall: "Hillside Shopping Centre, Victoria BC",
    competitors: [
      { name: "Tip Top Tailors", location: "Hillside Centre Victoria BC", type: "In-mall direct competitor" },
      { name: "Moores Clothing", location: "Victoria BC", type: "Direct competitor" },
      { name: "Outlooks for Men", location: "Victoria BC", type: "Local premium menswear - 2 locations" },
      { name: "W&J Wilson Clothiers", location: "Government Street Victoria BC", type: "Local heritage menswear" },
      { name: "DGBremner & Co", location: "Victoria BC", type: "Local menswear boutique" },
    ],
  },
  "Calgary": {
    mall: "Sunridge Mall, 2525 36 St NE Calgary AB",
    competitors: [
      { name: "Tip Top Tailors", location: "Market Mall Calgary AB", type: "Direct competitor" },
      { name: "Moores Clothing", location: "1632 14th Ave NW Calgary AB", type: "Direct competitor" },
      { name: "O'Connors Menswear", location: "Calgary AB", type: "Local premium menswear - 50 years" },
      { name: "Indochino", location: "Calgary AB", type: "Custom suit competitor" },
      { name: "Formans Menswear", location: "Calgary AB", type: "Local menswear" },
    ],
  },
};

// Rate limiting — max 2 generations per week
// In-memory cache (resets on deploy); for persistence, store in Supabase
let lastGenerated: string | null = null;
let generationCount = 0;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_WEEK = 2;

async function queryPerplexity(query: string): Promise<string> {
  if (!PERPLEXITY_API_KEY) return "PERPLEXITY_API_KEY not configured in environment variables.";

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${PERPLEXITY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: query }],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No data returned.";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch") ?? "all";

  // Rate limit check
  const now = Date.now();
  if (lastGenerated) {
    const elapsed = now - new Date(lastGenerated).getTime();
    if (elapsed < WEEK_MS && generationCount >= MAX_PER_WEEK) {
      const nextAvailable = new Date(new Date(lastGenerated).getTime() + WEEK_MS);
      return NextResponse.json({
        error: `Rate limit reached. Maximum ${MAX_PER_WEEK} reports per week. Next available: ${nextAvailable.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}`,
        rate_limited: true,
        next_available: nextAvailable.toISOString(),
      }, { status: 429 });
    }
    // Reset counter if a week has passed
    if (elapsed >= WEEK_MS) generationCount = 0;
  }

  // Determine which branches to scan
  const branchKeys = branch === "all"
    ? Object.keys(BRANCH_COMPETITORS)
    : [branch];

  const results: Record<string, unknown>[] = [];

  for (const branchName of branchKeys) {
    const branchData = BRANCH_COMPETITORS[branchName as keyof typeof BRANCH_COMPETITORS];
    if (!branchData) continue;

    const branchResult: Record<string, unknown> = {
      branch: branchName,
      mall: branchData.mall,
      competitors: [],
      generated_at: new Date().toISOString(),
    };

    const competitorResults = [];

    for (const comp of branchData.competitors) {
      try {
        const query = `Search for current information about "${comp.name}" menswear store in ${comp.location} Canada in 2026.
Return a JSON object with exactly these fields:
{
  "promotions": "any current sales, promotions or discounts running right now, or 'None found'",
  "price_range": "suit/clothing price range e.g. $299-$599, or 'Unknown'",
  "social_activity": "recent social media or marketing activity in one sentence, or 'No recent activity found'",
  "notable": "any notable news, changes, or competitive intel in one sentence, or 'Nothing notable'"
}
Return only valid JSON, no other text or markdown.`;

        const raw = await queryPerplexity(query);
        let parsed: Record<string, string> = {};
        try {
          const clean = raw.replace(/```json|```/g, "").trim();
          parsed = JSON.parse(clean);
        } catch {
          parsed = {
            promotions: raw.slice(0, 150),
            price_range: "Unknown",
            social_activity: "Could not parse response",
            notable: "—",
          };
        }

        competitorResults.push({
          name: comp.name,
          type: comp.type,
          location: comp.location,
          ...parsed,
        });
      } catch {
        competitorResults.push({
          name: comp.name,
          type: comp.type,
          promotions: "Failed to fetch",
          price_range: "Unknown",
          social_activity: "—",
          notable: "—",
          error: true,
        });
      }
    }

    branchResult.competitors = competitorResults;
    results.push(branchResult);
  }

  // Update rate limit tracker
  lastGenerated = new Date().toISOString();
  generationCount += 1;

  return NextResponse.json({
    results,
    generated_at: new Date().toISOString(),
    generations_this_week: generationCount,
    generations_remaining: Math.max(0, MAX_PER_WEEK - generationCount),
  });
}
