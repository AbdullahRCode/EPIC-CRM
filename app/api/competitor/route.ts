import { NextResponse } from "next/server";

const PERPLEXITY_KEY = process.env.PERPLEXITY_API_KEY ?? process.env.PERPLEXITY_API_KEY_EPIC;
console.log("Perplexity key present:", !!PERPLEXITY_KEY);

const BRANCH_COMPETITORS: Record<string, {
  mall: string;
  city: string;
  competitors: { name: string; type: string; searchHint: string }[];
}> = {
  "Surrey - Guildford": {
    mall: "Guildford Town Centre, Surrey BC",
    city: "Surrey BC",
    competitors: [
      { name: "Tip Top Tailors", type: "In-mall direct competitor", searchHint: "Tip Top Tailors Guildford Town Centre Surrey BC men suits" },
      { name: "Moores Clothing", type: "Regional direct competitor", searchHint: "Moores Clothing for Men Surrey BC suits pricing promotions" },
      { name: "Black & Lee Tuxedos", type: "Formalwear competitor", searchHint: "Black Lee Tuxedos Guildford Surrey BC rental pricing" },
      { name: "Jack & Jones", type: "Casual menswear", searchHint: "Jack Jones Surrey BC Guildford men clothing" },
      { name: "RW&CO", type: "Smart casual menswear", searchHint: "RW CO men suits blazers Surrey BC pricing" },
    ],
  },
  "Surrey - Central City": {
    mall: "Central City Shopping Centre, Surrey BC",
    city: "Surrey BC",
    competitors: [
      { name: "Tip Top Tailors", type: "In-mall direct competitor", searchHint: "Tip Top Tailors Central City Surrey BC men suits" },
      { name: "Moores Clothing", type: "Regional direct competitor", searchHint: "Moores Clothing Surrey BC suits" },
      { name: "RW&CO", type: "Smart casual menswear", searchHint: "RW CO Central City Surrey suits blazers" },
      { name: "Indochino", type: "Custom suit competitor", searchHint: "Indochino Vancouver custom suits price 2026" },
      { name: "Jack & Jones", type: "Casual menswear", searchHint: "Jack Jones Central City Surrey BC" },
    ],
  },
  "Tsawwassen Mills": {
    mall: "Tsawwassen Mills, Tsawwassen BC",
    city: "Tsawwassen BC",
    competitors: [
      { name: "Tip Top Tailors", type: "In-mall direct competitor", searchHint: "Tip Top Tailors Tsawwassen Mills BC" },
      { name: "RW&CO", type: "Smart casual menswear", searchHint: "RW CO Tsawwassen Mills BC men suits" },
      { name: "Banana Republic", type: "Premium casual menswear", searchHint: "Banana Republic Tsawwassen Mills men suits blazers price" },
      { name: "Moores Clothing", type: "Regional competitor", searchHint: "Moores Clothing Delta BC suits" },
      { name: "Indochino", type: "Custom suit competitor", searchHint: "Indochino Vancouver custom suits price 2026" },
    ],
  },
  "Burnaby": {
    mall: "City of Lougheed, Burnaby BC",
    city: "Burnaby BC",
    competitors: [
      { name: "Tip Top Tailors", type: "Direct competitor", searchHint: "Tip Top Tailors Burnaby BC Lougheed men suits" },
      { name: "Moores Clothing", type: "Direct competitor", searchHint: "Moores Clothing Burnaby BC suits pricing" },
      { name: "Grafton & Co", type: "In-mall menswear", searchHint: "Grafton Co Lougheed Burnaby men clothing" },
      { name: "RW&CO", type: "Smart casual menswear", searchHint: "RW CO Burnaby BC men suits blazers" },
      { name: "Indochino", type: "Custom suit competitor", searchHint: "Indochino Vancouver custom suits price 2026" },
    ],
  },
  "Victoria": {
    mall: "Hillside Shopping Centre, Victoria BC",
    city: "Victoria BC",
    competitors: [
      { name: "Tip Top Tailors", type: "In-mall direct competitor", searchHint: "Tip Top Tailors Hillside Victoria BC men suits pricing" },
      { name: "Moores Clothing", type: "Direct competitor", searchHint: "Moores Clothing Victoria BC suits pricing promotions" },
      { name: "Outlooks for Men", type: "Local premium competitor", searchHint: "Outlooks for Men Victoria BC suits pricing promotions 2026" },
      { name: "W&J Wilson Clothiers", type: "Heritage menswear", searchHint: "WJ Wilson Clothiers Government Street Victoria BC men suits" },
      { name: "DGBremner & Co", type: "Local menswear boutique", searchHint: "DGBremner Menswear Victoria BC suits pricing" },
    ],
  },
  "Calgary": {
    mall: "Sunridge Mall, Calgary AB",
    city: "Calgary AB",
    competitors: [
      { name: "Tip Top Tailors", type: "Direct competitor", searchHint: "Tip Top Tailors Market Mall Calgary AB men suits pricing promotions 2026" },
      { name: "Moores Clothing", type: "Direct competitor", searchHint: "Moores Clothing Calgary AB 14th Ave suits pricing promotions 2026" },
      { name: "O'Connors Menswear", type: "Local premium competitor", searchHint: "OConnors Menswear Calgary suits pricing 2026" },
      { name: "Indochino", type: "Custom suit competitor", searchHint: "Indochino Calgary custom suits starting price 2026" },
      { name: "Formans Menswear", type: "Local menswear", searchHint: "Formans Menswear Calgary suits pricing 2026" },
    ],
  },
};

let lastGenerated: string | null = null;
let generationCount = 0;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PER_WEEK = 2;

async function queryPerplexity(systemPrompt: string, userQuery: string): Promise<string> {
  if (!PERPLEXITY_KEY) return "";
  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${PERPLEXITY_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userQuery },
        ],
      }),
    });
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? "";
    // Strip citation numbers like [1] [2] [3]
    return raw.replace(/\[\d+\]/g, "").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

async function getCompetitorData(name: string, hint: string): Promise<{
  price_range: string;
  promotions: string;
  strengths: string;
  weaknesses: string;
  threat_level: "High" | "Medium" | "Low";
}> {
  const system = `You are a retail business intelligence analyst specializing in Canadian menswear.
Be specific, factual, and direct. Use real pricing when available.
Never say "Unknown" — estimate based on brand positioning if exact data unavailable.
Never include citation numbers like [1] or [2] in your response.`;

  const query = `Research this competitor for a menswear store competitive analysis: ${name}. Search hint: ${hint}.

Return a JSON object with exactly these fields:
{
  "price_range": "specific suit price range like '$299-$599' — estimate from brand positioning if exact price not found, never say Unknown",
  "promotions": "any current promotions, sales events, or discount programs running now — be specific with percentages if available, or 'No active promotions found'",
  "strengths": "2-3 key competitive strengths of this store that EPIC Menswear should be aware of — be specific",
  "weaknesses": "2-3 competitive weaknesses or vulnerabilities that EPIC Menswear could exploit — be specific",
  "threat_level": "High, Medium, or Low — based on how directly they compete with EPIC Menswear's $250-$475 suit range and their proximity"
}

Return ONLY valid JSON. No markdown, no citations, no extra text.`;

  const raw = await queryPerplexity(system, query);
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return {
      price_range: parsed.price_range ?? "$250-$600 (estimated)",
      promotions: parsed.promotions ?? "No active promotions found",
      strengths: parsed.strengths ?? "Established brand presence",
      weaknesses: parsed.weaknesses ?? "Corporate, less personalized service",
      threat_level: (parsed.threat_level as "High" | "Medium" | "Low") ?? "Medium",
    };
  } catch {
    return {
      price_range: "$250-$600 (estimated)",
      promotions: "Could not fetch — check API key",
      strengths: "Established brand",
      weaknesses: "Corporate service model",
      threat_level: "Medium",
    };
  }
}

async function generateOwnerNote(
  branchName: string,
  city: string,
  competitorData: { name: string; threat_level: string; promotions: string; weaknesses: string }[]
): Promise<string> {
  const system = `You are a sharp retail business strategist advising the owner of EPIC Menswear,
an independent menswear chain with 6 locations in BC and Calgary selling suits from $250-$475.
Write like a trusted advisor — direct, confident, actionable. No fluff. No bullet points in the response.
Never include citation numbers.`;

  const competitorSummary = competitorData
    .map((c) => `${c.name} (threat: ${c.threat_level}): promotions: ${c.promotions}. weaknesses: ${c.weaknesses}`)
    .join("\n");

  const query = `Based on this competitive landscape for EPIC Menswear's ${branchName} location in ${city}, write a sharp 3-4 sentence owner's strategic note.

Competitors:
${competitorSummary}

The note should:
1. Identify the #1 immediate threat and why
2. Point out the biggest opportunity EPIC can exploit RIGHT NOW based on competitor weaknesses
3. Give one specific action the branch manager should take this week
4. Be written directly to the owner — confident, specific, no corporate speak

Write only the note text, no label or title needed.`;

  return await queryPerplexity(system, query);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const branch = searchParams.get("branch") ?? "all";

  // Rate limit
  const now = Date.now();
  if (lastGenerated) {
    const elapsed = now - new Date(lastGenerated).getTime();
    if (elapsed < WEEK_MS && generationCount >= MAX_PER_WEEK) {
      const nextAvailable = new Date(new Date(lastGenerated).getTime() + WEEK_MS);
      return NextResponse.json({
        error: `Rate limit reached. Next scan available ${nextAvailable.toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" })}`,
        rate_limited: true,
      }, { status: 429 });
    }
    if (elapsed >= WEEK_MS) generationCount = 0;
  }

  const branchKeys = branch === "all"
    ? Object.keys(BRANCH_COMPETITORS)
    : [branch];

  const results = [];

  for (const branchName of branchKeys) {
    const branchData = BRANCH_COMPETITORS[branchName];
    if (!branchData) continue;

    const competitorResults = await Promise.all(
      branchData.competitors.map(async (comp) => {
        const data = await getCompetitorData(comp.name, comp.searchHint);
        return { name: comp.name, type: comp.type, ...data };
      })
    );

    const ownerNote = await generateOwnerNote(
      branchName,
      branchData.city,
      competitorResults.map((c) => ({
        name: c.name,
        threat_level: c.threat_level,
        promotions: c.promotions,
        weaknesses: c.weaknesses,
      }))
    );

    results.push({
      branch: branchName,
      mall: branchData.mall,
      competitors: competitorResults,
      owner_note: ownerNote,
      generated_at: new Date().toISOString(),
    });
  }

  lastGenerated = new Date().toISOString();
  generationCount += 1;

  return NextResponse.json({
    results,
    generated_at: new Date().toISOString(),
    generations_remaining: Math.max(0, MAX_PER_WEEK - generationCount),
  });
}
