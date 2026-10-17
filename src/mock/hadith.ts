export type HadithTheme = "Community" | "Neighbours" | "Love" | "Kindness" | "Peace" | "Tolerance";
export type Hadith = { id: number; theme: HadithTheme; text: string };

export const HADITH_ATTRIBUTION = "Prophet Muhammad ﷺ · Sahih al-Bukhari & Muslim";

export const hadith: Hadith[] = [
  { id: 1, theme: "Love", text: "None of you truly believes until you love for others what you love for yourself." },
  { id: 2, theme: "Neighbours", text: "Whoever believes in Allah and the Last Day should do good to their neighbour." },
  { id: 3, theme: "Community", text: "The believers, in their mutual love and mercy, are like one body — when a single part aches, the whole body stays awake with fever." },
  { id: 4, theme: "Neighbours", text: "Jibril kept urging kindness to neighbours, until I thought they might even be given a share of inheritance." },
  { id: 5, theme: "Kindness", text: "A good word is charity." },
  { id: 6, theme: "Community", text: "A believer is to another believer like a building: each part supports the other." },
  { id: 7, theme: "Peace", text: "The strong person is not the one who defeats others in wrestling; the strong person is the one who controls himself when angry." },
  { id: 8, theme: "Tolerance", text: "Make things easy and do not make them difficult; give good news and do not drive people away." },
];

export const FILTERS = ["All", "Community", "Neighbours", "Love", "Living together", "Tolerance", "Peace"] as const;
export type Filter = (typeof FILTERS)[number];

export function matchesFilter(h: Hadith, f: Filter) {
  if (f === "All") return true;
  if (f === "Love") return h.theme === "Love" || h.theme === "Kindness";
  return h.theme === f;
}

export function dailyHadith(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  return hadith[day % hadith.length];
}
