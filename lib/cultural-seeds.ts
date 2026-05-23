import type { CulturalEvent, Branch } from "./types";

export function getSeedEvents(): CulturalEvent[] {
  const year = new Date().getFullYear();
  return [
    {
      id: "diwali",
      name: "Diwali",
      date: `${year}-10-20`,
      branches: ["Surrey - Guildford", "Surrey - Central City"] as Branch[],
      description: "Festival of Lights — peak season for occasion wear in Surrey locations",
    },
    {
      id: "lunar-new-year",
      name: "Lunar New Year",
      date: `${year}-01-29`,
      branches: ["Burnaby", "Surrey - Guildford", "Surrey - Central City"] as Branch[],
      description: "Major gifting and formal wear occasion across Metro Vancouver",
    },
    {
      id: "vaisakhi",
      name: "Vaisakhi",
      date: `${year}-04-13`,
      branches: ["Surrey - Guildford", "Surrey - Central City"] as Branch[],
      description: "Sikh New Year — high demand for formal and traditional menswear in Surrey",
    },
    {
      id: "stampede",
      name: "Calgary Stampede",
      date: `${year}-07-04`,
      branches: ["Calgary"] as Branch[],
      description: "World-famous rodeo — western-influenced formal wear demand spike",
    },
    {
      id: "fathers-day",
      name: "Father's Day",
      date: `${year}-06-15`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Top gifting day across all branches — suits, accessories",
    },
    {
      id: "thanksgiving",
      name: "Thanksgiving",
      date: `${year}-10-13`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Family occasion — moderate occasion wear demand",
    },
    {
      id: "christmas",
      name: "Christmas",
      date: `${year}-12-25`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Peak gifting and holiday formal wear season",
    },
    {
      id: "new-years-eve",
      name: "New Year's Eve",
      date: `${year}-12-31`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Black tie and formal occasion demand",
    },
    {
      id: "victoria-day",
      name: "Victoria Day",
      date: `${year}-05-19`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills"] as Branch[],
      description: "BC long weekend — casual uptick in walk-ins",
    },
    {
      id: "india-independence",
      name: "India Independence Day",
      date: `${year}-08-15`,
      branches: ["Surrey - Guildford", "Surrey - Central City"] as Branch[],
      description: "Cultural celebration — formal and traditional wear demand in Surrey",
    },
    {
      id: "prom-season",
      name: "Prom Season",
      date: `${year}-05-01`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Grad/prom suit fittings peak — book alterations early",
    },
    {
      id: "wedding-peak",
      name: "Wedding Season Peak",
      date: `${year}-06-01`,
      branches: ["Victoria", "Surrey - Guildford", "Surrey - Central City", "Burnaby", "Tsawwassen Mills", "Calgary"] as Branch[],
      description: "Summer wedding rush — full suit purchases and alterations",
    },
  ];
}
