export type Branch =
  | "Victoria"
  | "Surrey - Guildford"
  | "Surrey - Central City"
  | "Burnaby"
  | "Tsawwassen Mills"
  | "Calgary";

export const BRANCHES: Branch[] = [
  "Victoria",
  "Surrey - Guildford",
  "Surrey - Central City",
  "Burnaby",
  "Tsawwassen Mills",
  "Calgary",
];

export const DEFAULT_TENANT = "epic-menswear";

export type VisitReason =
  | "Walk-in (purchased)"
  | "Walk-in (no purchase)"
  | "Inquiry general"
  | "Inquiry colour"
  | "Inquiry style"
  | "Fitting"
  | "Alteration drop-off"
  | "Alteration pickup"
  | "Special order"
  | "Pickup"
  | "Other";

export const VISIT_REASONS: VisitReason[] = [
  "Walk-in (purchased)",
  "Walk-in (no purchase)",
  "Inquiry general",
  "Inquiry colour",
  "Inquiry style",
  "Fitting",
  "Alteration drop-off",
  "Alteration pickup",
  "Special order",
  "Pickup",
  "Other",
];

export type EventType = "Wedding" | "Prom" | "Grad" | "Funeral" | "Work" | "Other";
export const EVENT_TYPES: EventType[] = ["Wedding", "Prom", "Grad", "Funeral", "Work", "Other"];

export type AlterationItem = "Sleeves" | "Hem" | "Jacket" | "Waist" | "Shoulders" | "Other";
export const ALTERATION_ITEMS: AlterationItem[] = [
  "Sleeves",
  "Hem",
  "Jacket",
  "Waist",
  "Shoulders",
  "Other",
];

export type AlterationStatus = "Received" | "In progress" | "Ready" | "Picked up";
export const ALTERATION_STATUSES: AlterationStatus[] = [
  "Received",
  "In progress",
  "Ready",
  "Picked up",
];

export type SpecialOrderStatus = "Received" | "Ordered" | "Arrived" | "Picked up";
export const SPECIAL_ORDER_STATUSES: SpecialOrderStatus[] = [
  "Received",
  "Ordered",
  "Arrived",
  "Picked up",
];

export interface Visit {
  id: string;
  date: string;
  reason: VisitReason;
  items?: string;
  spend?: number;
  staff?: string;
  notes?: string;
}

export interface Measurements {
  chest?: string;
  waist?: string;
  sleeve?: string;
  inseam?: string;
  neck?: string;
  shoulder?: string;
  notes?: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  email?: string;
  branch: Branch;
  events: EventType[];
  event_date?: string;
  event_note?: string;
  alterations: AlterationItem[];
  alteration_note?: string;
  alteration_status?: AlterationStatus;
  special_order?: string;
  special_order_status?: SpecialOrderStatus;
  follow_up: { needed: boolean; reason?: string };
  measurements?: Measurements;
  visits: Visit[];
  created_at: string;
  updated_at: string;
}

export interface Comm {
  id: string;
  tenant_id: string;
  client_id: string;
  channel: "whatsapp" | "email" | "sms" | "in-person";
  direction: "inbound" | "outbound";
  summary: string;
  sent_by?: string;
  created_at: string;
}

export type ClientTag =
  | "VIP"
  | "Returning"
  | "Cold"
  | "Events"
  | "Alterations"
  | "Special Order"
  | "Follow-up";

export function deriveTags(client: Client): ClientTag[] {
  const tags: ClientTag[] = [];
  const totalSpend = client.visits.reduce((s, v) => s + (v.spend ?? 0), 0);
  if (totalSpend >= 1000) tags.push("VIP");
  if (client.visits.length >= 2) tags.push("Returning");

  const lastVisit = client.visits
    .map((v) => new Date(v.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lastVisit) {
    const daysSince = (Date.now() - lastVisit.getTime()) / 86400000;
    if (daysSince >= 90) tags.push("Cold");
  }

  if (client.events.length > 0) tags.push("Events");
  if (client.alterations.length > 0 && client.alteration_status !== "Picked up")
    tags.push("Alterations");
  if (client.special_order && client.special_order_status !== "Picked up")
    tags.push("Special Order");
  if (client.follow_up?.needed) tags.push("Follow-up");

  return tags;
}

export interface DailySummaryData {
  today_summary: string;
  branch_reads: { branch: Branch; summary: string; highlight?: string }[];
  action_items: { label: string; urgency: "high" | "medium" | "low" }[];
  tomorrow_outlook: string;
  weekly_target: { goal: string; rationale: string };
  trend_observation: string;
}

export interface CulturalEvent {
  id: string;
  name: string;
  date: string;
  branches: Branch[];
  description?: string;
  source?: string;
}

export interface PhotoExtractEntry {
  name: string;
  phone?: string;
  email?: string;
  branch?: Branch;
  notes?: string;
  uncertain?: boolean;
  raw_text?: string;
}
