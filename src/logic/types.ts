export const QUOTAS = [10, 15, 20] as const;
export type Quota = (typeof QUOTAS)[number];
export type BandId = 1 | 2 | 3 | 4 | 5;
export type Grade = "known" | "fuzzy" | "unknown";
export type CardKind = "yesterday" | "due" | "new";

export const UNLOCK_PERCENT = 80;
export const UNLOCK_ACCURACY = 0.75;
export const UNLOCK_MIN_REVIEWS = 20;
export const ACCURACY_DAYS = 7;
export const MAX_DUE = 12;
export const LEFTOVER_PER_DAY = 3;
export const LADDER = [1, 3, 7, 14, 30, 60] as const;

export const BANDS: Record<
  BandId,
  { name: string; detail: string; from: number; to: number }
> = {
  1: { name: "第一阶", detail: "最常用 1000 个实词", from: 1, to: 1000 },
  2: { name: "第二阶", detail: "第 1001–3000 词", from: 1001, to: 3000 },
  3: { name: "第三阶", detail: "第 3001–5000 词", from: 3001, to: 5000 },
  4: { name: "第四阶", detail: "第 5001–10000 词", from: 5001, to: 10000 },
  5: { name: "第五阶", detail: "第 10001–20000 词", from: 10001, to: 20000 },
};

export type IndexWord = {
  id: number;
  word: string;
  rank: number;
  band: BandId;
};

export type WordProgress = {
  introducedOn: string;
  nextReviewOn: string;
  intervalDays: number;
  lastGrade: Grade | null;
  lastReviewedOn: string | null;
  reviewCount: number;
  /** Already known before study. Kept out of the review queue. */
  mastered?: boolean;
};

export type ReviewEvent = {
  date: string;
  grade: Grade;
};

export type PlanItem = {
  id: number;
  kind: CardKind;
};

export type DayPlan = {
  date: string;
  quota: Quota;
  yesterdayIds: number[];
  dueIds: number[];
  newIds: number[];
  done: PlanItem[];
};

export type PersistedState = {
  version: 1;
  quota: Quota;
  currentBand: BandId;
  pendingBand: BandId | null;
  advanceOn: string | null;
  streak: number;
  lastGoalDate: string | null;
  speechOn: boolean;
  pwaDismissed: boolean;
  dayOffset: number;
  words: Record<string, WordProgress>;
  reviews: ReviewEvent[];
  plan: DayPlan | null;
};

export function bandOfRank(rank: number): BandId {
  if (rank <= 1000) return 1;
  if (rank <= 3000) return 2;
  if (rank <= 5000) return 3;
  if (rank <= 10000) return 4;
  return 5;
}

export function isBand(value: unknown): value is BandId {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isQuota(value: unknown): value is Quota {
  return value === 10 || value === 15 || value === 20;
}

export function isGrade(value: unknown): value is Grade {
  return value === "known" || value === "fuzzy" || value === "unknown";
}
