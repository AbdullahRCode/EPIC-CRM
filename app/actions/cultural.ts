"use server";

import { perplexitySearch } from "@/lib/perplexity";
import { getSeedEvents } from "@/lib/cultural-seeds";
import { type CulturalEvent, type Branch } from "@/lib/types";
import { randomUUID } from "crypto";

export async function refreshCulturalEvents(): Promise<CulturalEvent[]> {
  try {
    const currentYear = new Date().getFullYear();
    const query = `What are the exact dates for major cultural events in British Columbia and Calgary, Canada for ${currentYear}? Include: Diwali, Lunar New Year, Vaisakhi, Calgary Stampede, Eid al-Fitr, Holi. Return dates in YYYY-MM-DD format.`;

    const response = await perplexitySearch(query);

    const baseEvents = getSeedEvents();

    const { getAnthropic, CLAUDE_MODEL } = await import("@/lib/anthropic");
    const message = await getAnthropic().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Extract event dates from this text and return JSON array:

${response}

Return ONLY a JSON array of objects with keys: name (string), date (YYYY-MM-DD), branches (array of branch names from: Victoria, Surrey - Guildford, Surrey - Central City, Burnaby, Tsawwassen Mills, Calgary).

Only include events with confirmed dates.`,
        },
      ],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return baseEvents;

    const updated: Array<{ name: string; date: string; branches: Branch[] }> = JSON.parse(jsonMatch[0]);

    const mergedMap = new Map(baseEvents.map((e) => [e.name.toLowerCase(), e]));
    updated.forEach((u) => {
      const key = u.name.toLowerCase();
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key)!;
        mergedMap.set(key, { ...existing, date: u.date, branches: u.branches ?? existing.branches });
      } else {
        mergedMap.set(key, {
          id: randomUUID(),
          name: u.name,
          date: u.date,
          branches: u.branches ?? [],
          source: "perplexity",
        });
      }
    });

    return Array.from(mergedMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  } catch (err) {
    console.error("Cultural events refresh error:", err);
    return getSeedEvents();
  }
}
