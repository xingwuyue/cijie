import { addDays } from "./dates";
import { nextInterval } from "./srs";
import {
  ACCURACY_DAYS,
  LEFTOVER_PER_DAY,
  MAX_DUE,
  UNLOCK_ACCURACY,
  UNLOCK_MIN_REVIEWS,
  UNLOCK_PERCENT,
  type BandId,
  type CardKind,
  type DayPlan,
  type Grade,
  type IndexWord,
  type PersistedState,
  type PlanItem,
  type Quota,
  type ReviewEvent,
  type WordProgress,
  isBand,
  isGrade,
  isQuota,
} from "./types";

export function defaultState(): PersistedState {
  return {
    version: 1,
    quota: 15,
    currentBand: 1,
    pendingBand: null,
    advanceOn: null,
    streak: 0,
    lastGoalDate: null,
    speechOn: true,
    pwaDismissed: false,
    dayOffset: 0,
    words: {},
    reviews: [],
    plan: null,
  };
}

function isProgress(value: unknown): value is WordProgress {
  if (!value || typeof value !== "object") return false;
  const row = value as WordProgress;
  return (
    typeof row.introducedOn === "string" &&
    typeof row.nextReviewOn === "string" &&
    typeof row.intervalDays === "number" &&
    (row.lastGrade === null || isGrade(row.lastGrade)) &&
    (row.lastReviewedOn === null || typeof row.lastReviewedOn === "string") &&
    typeof row.reviewCount === "number"
  );
}

function isPlan(value: unknown): value is DayPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as DayPlan;
  return (
    typeof plan.date === "string" &&
    isQuota(plan.quota) &&
    Array.isArray(plan.yesterdayIds) &&
    Array.isArray(plan.dueIds) &&
    Array.isArray(plan.newIds) &&
    Array.isArray(plan.done)
  );
}

export function sanitize(input: unknown): PersistedState {
  const base = defaultState();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<PersistedState>;
  if (raw.version !== 1) return base;
  const words: Record<string, WordProgress> = {};
  if (raw.words && typeof raw.words === "object") {
    for (const [key, value] of Object.entries(raw.words)) {
      if (/^\d+$/.test(key) && isProgress(value)) words[key] = value;
    }
  }
  const reviews: ReviewEvent[] = [];
  if (Array.isArray(raw.reviews)) {
    for (const event of raw.reviews) {
      if (
        event &&
        typeof event.date === "string" &&
        isGrade(event.grade)
      ) {
        reviews.push({ date: event.date, grade: event.grade });
      }
    }
  }
  const pending =
    raw.pendingBand == null ? null : isBand(raw.pendingBand) ? raw.pendingBand : null;
  return {
    ...base,
    quota: isQuota(raw.quota) ? raw.quota : base.quota,
    currentBand: isBand(raw.currentBand) ? raw.currentBand : base.currentBand,
    pendingBand: pending,
    advanceOn: typeof raw.advanceOn === "string" ? raw.advanceOn : null,
    streak: typeof raw.streak === "number" && raw.streak >= 0 ? Math.floor(raw.streak) : 0,
    lastGoalDate: typeof raw.lastGoalDate === "string" ? raw.lastGoalDate : null,
    speechOn: raw.speechOn !== false,
    pwaDismissed: raw.pwaDismissed === true,
    dayOffset:
      typeof raw.dayOffset === "number"
        ? Math.max(0, Math.min(30, Math.floor(raw.dayOffset)))
        : 0,
    words,
    reviews: reviews.slice(-300),
    plan: isPlan(raw.plan) ? raw.plan : null,
  };
}

export function bandCoverage(state: PersistedState, index: IndexWord[], band: BandId) {
  let total = 0;
  let introduced = 0;
  for (const word of index) {
    if (word.band !== band) continue;
    total += 1;
    if (state.words[String(word.id)]) introduced += 1;
  }
  return {
    introduced,
    total,
    target: Math.ceil((total * UNLOCK_PERCENT) / 100),
  };
}

export function reviewAccuracy(state: PersistedState, today: string) {
  const start = addDays(today, -(ACCURACY_DAYS - 1));
  let sample = 0;
  let correct = 0;
  for (const event of state.reviews) {
    if (event.date >= start && event.date <= today) {
      sample += 1;
      if (event.grade === "known") correct += 1;
    }
  }
  return { correct, sample, rate: sample ? correct / sample : 0 };
}

export function displayStreak(state: PersistedState, today: string): number {
  if (!state.lastGoalDate || state.streak <= 0) return 0;
  if (state.lastGoalDate === today || state.lastGoalDate === addDays(today, -1)) {
    return state.streak;
  }
  return 0;
}

export function takeNewWords(
  state: PersistedState,
  index: IndexWord[],
  limit: number,
  exclude: Set<number>,
): number[] {
  if (limit <= 0) return [];
  const old: number[] = [];
  const current: number[] = [];
  for (const word of index) {
    if (state.words[String(word.id)] || exclude.has(word.id)) continue;
    if (word.band < state.currentBand) old.push(word.id);
    else if (word.band === state.currentBand) current.push(word.id);
  }
  const picked: number[] = [];
  if (state.currentBand > 1) {
    for (const id of old) {
      if (picked.length >= Math.min(LEFTOVER_PER_DAY, limit)) break;
      picked.push(id);
    }
  }
  for (const id of current) {
    if (picked.length >= limit) break;
    picked.push(id);
  }
  if (picked.length < limit) {
    const used = new Set(picked);
    for (const id of old) {
      if (used.has(id)) continue;
      if (picked.length >= limit) break;
      picked.push(id);
    }
  }
  return picked;
}

export function createPlan(state: PersistedState, today: string, index: IndexWord[]): DayPlan {
  const yesterday = addDays(today, -1);
  const yesterdayIds: number[] = [];
  const introducedToday: number[] = [];
  for (const word of index) {
    const progress = state.words[String(word.id)];
    if (!progress) continue;
    if (progress.introducedOn === yesterday) yesterdayIds.push(word.id);
    if (progress.introducedOn === today) introducedToday.push(word.id);
  }
  const done: PlanItem[] = [];
  for (const id of yesterdayIds) {
    if (state.words[String(id)]?.lastReviewedOn === today) {
      done.push({ id, kind: "yesterday" });
    }
  }
  const yset = new Set(yesterdayIds);
  const dueAll: { id: number; next: string; rank: number }[] = [];
  for (const word of index) {
    const progress = state.words[String(word.id)];
    if (!progress || yset.has(word.id)) continue;
    if (progress.introducedOn >= yesterday) continue;
    if (progress.lastReviewedOn === today) continue;
    if (progress.nextReviewOn <= today) {
      dueAll.push({ id: word.id, next: progress.nextReviewOn, rank: word.rank });
    }
  }
  dueAll.sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : a.rank - b.rank));
  const dueIds = dueAll.slice(0, MAX_DUE).map((item) => item.id);
  const exclude = new Set<number>([...yesterdayIds, ...dueIds, ...introducedToday]);
  const fresh = takeNewWords(
    state,
    index,
    Math.max(state.quota - introducedToday.length, 0),
    exclude,
  );
  const newIds = [...introducedToday, ...fresh].slice(
    0,
    Math.max(state.quota, introducedToday.length),
  );
  for (const id of introducedToday) {
    if (newIds.includes(id)) done.push({ id, kind: "new" });
  }
  return {
    date: today,
    quota: state.quota,
    yesterdayIds,
    dueIds,
    newIds,
    done,
  };
}

export function commitAdvance(state: PersistedState, today: string): PersistedState {
  if (!state.pendingBand || !state.advanceOn || today < state.advanceOn) return state;
  return {
    ...state,
    currentBand: state.pendingBand,
    pendingBand: null,
    advanceOn: null,
  };
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function reconcileQuota(state: PersistedState, index: IndexWord[]): PersistedState {
  const plan = state.plan;
  if (!plan || plan.quota === state.quota) return state;
  if (plan.done.some((item) => item.kind === "new")) return state;
  const exclude = new Set<number>([...plan.yesterdayIds, ...plan.dueIds]);
  const newIds = takeNewWords(state, index, state.quota, exclude);
  if (sameIds(newIds, plan.newIds)) {
    return { ...state, plan: { ...plan, quota: state.quota } };
  }
  return { ...state, plan: { ...plan, newIds, quota: state.quota } };
}

export function ensurePlan(
  state: PersistedState,
  today: string,
  index: IndexWord[],
): PersistedState {
  const advanced = commitAdvance(state, today);
  let next = advanced;
  if (!next.plan || next.plan.date !== today) {
    next = { ...next, plan: createPlan(next, today, index) };
  } else if (next.plan.quota !== next.quota) {
    next = reconcileQuota(next, index);
  }
  return next === state ? state : next;
}

function requiredComplete(plan: DayPlan): boolean {
  const done = new Set(
    plan.done.filter((item) => item.kind !== "due").map((item) => `${item.kind}:${item.id}`),
  );
  const required = [
    ...plan.yesterdayIds.map((id) => `yesterday:${id}`),
    ...plan.newIds.map((id) => `new:${id}`),
  ];
  if (required.length === 0) return false;
  return required.every((key) => done.has(key));
}

export function markGoal(state: PersistedState, today: string): PersistedState {
  if (!state.plan || !requiredComplete(state.plan) || state.lastGoalDate === today) return state;
  const streak = state.lastGoalDate === addDays(today, -1) ? state.streak + 1 : 1;
  return { ...state, streak, lastGoalDate: today };
}

export function scheduleUnlock(
  state: PersistedState,
  index: IndexWord[],
  today: string,
): PersistedState {
  if (state.pendingBand || state.currentBand >= 5) return state;
  const coverage = bandCoverage(state, index, state.currentBand);
  if (coverage.total === 0 || coverage.introduced < coverage.target) return state;
  const accuracy = reviewAccuracy(state, today);
  if (accuracy.sample < UNLOCK_MIN_REVIEWS || accuracy.rate < UNLOCK_ACCURACY - 1e-9) {
    return state;
  }
  return {
    ...state,
    pendingBand: (state.currentBand + 1) as BandId,
    advanceOn: addDays(today, 1),
  };
}

export function applyGrade(
  state: PersistedState,
  today: string,
  index: IndexWord[],
  id: number,
  kind: CardKind,
  grade: Grade,
): PersistedState {
  if (!state.plan || state.plan.date !== today) return state;
  if (state.plan.done.some((item) => item.id === id && item.kind === kind)) return state;
  const list =
    kind === "new" ? state.plan.newIds : kind === "yesterday" ? state.plan.yesterdayIds : state.plan.dueIds;
  if (!list.includes(id)) return state;
  const key = String(id);
  let words = state.words;
  let reviews = state.reviews;
  if (kind === "new") {
    words = {
      ...words,
      [key]: {
        introducedOn: today,
        nextReviewOn: addDays(today, 1),
        intervalDays: 1,
        lastGrade: grade,
        lastReviewedOn: null,
        reviewCount: 0,
      },
    };
  } else {
    const prev = words[key];
    if (!prev) return state;
    const interval = nextInterval(prev.intervalDays, grade);
    words = {
      ...words,
      [key]: {
        ...prev,
        nextReviewOn: addDays(today, interval),
        intervalDays: interval,
        lastGrade: grade,
        lastReviewedOn: today,
        reviewCount: prev.reviewCount + 1,
      },
    };
    reviews = [...reviews, { date: today, grade }];
    if (reviews.length > 300) reviews = reviews.slice(reviews.length - 300);
  }
  let next: PersistedState = {
    ...state,
    words,
    reviews,
    plan: { ...state.plan, done: [...state.plan.done, { id, kind }] },
  };
  next = markGoal(next, today);
  next = scheduleUnlock(next, index, today);
  return next;
}

export function appendDue(
  state: PersistedState,
  today: string,
  index: IndexWord[],
): PersistedState {
  if (!state.plan || state.plan.date !== today) return state;
  const used = new Set<number>([
    ...state.plan.yesterdayIds,
    ...state.plan.dueIds,
    ...state.plan.newIds,
  ]);
  const yesterday = addDays(today, -1);
  const dueAll: { id: number; next: string; rank: number }[] = [];
  for (const word of index) {
    const progress = state.words[String(word.id)];
    if (!progress || used.has(word.id)) continue;
    if (progress.introducedOn >= yesterday) continue;
    if (progress.lastReviewedOn === today) continue;
    if (progress.nextReviewOn <= today) {
      dueAll.push({ id: word.id, next: progress.nextReviewOn, rank: word.rank });
    }
  }
  dueAll.sort((a, b) => (a.next < b.next ? -1 : a.next > b.next ? 1 : a.rank - b.rank));
  const more = dueAll.slice(0, MAX_DUE).map((item) => item.id);
  if (more.length === 0) return state;
  return { ...state, plan: { ...state.plan, dueIds: [...state.plan.dueIds, ...more] } };
}

export function setQuota(state: PersistedState, quota: Quota, index: IndexWord[]): PersistedState {
  if (state.quota === quota) return state;
  return reconcileQuota({ ...state, quota }, index);
}

export function sessionQueue(plan: DayPlan): PlanItem[] {
  const done = new Set(plan.done.map((item) => `${item.kind}:${item.id}`));
  const queue: PlanItem[] = [];
  for (const id of plan.yesterdayIds) {
    if (!done.has(`yesterday:${id}`)) queue.push({ id, kind: "yesterday" });
  }
  for (const id of plan.dueIds) {
    if (!done.has(`due:${id}`)) queue.push({ id, kind: "due" });
  }
  for (const id of plan.newIds) {
    if (!done.has(`new:${id}`)) queue.push({ id, kind: "new" });
  }
  return queue;
}

export function remainingCounts(plan: DayPlan) {
  const done = new Set(plan.done.map((item) => `${item.kind}:${item.id}`));
  const count = (ids: number[], kind: CardKind) =>
    ids.filter((id) => !done.has(`${kind}:${id}`)).length;
  return {
    yesterday: count(plan.yesterdayIds, "yesterday"),
    due: count(plan.dueIds, "due"),
    fresh: count(plan.newIds, "new"),
    yesterdayTotal: plan.yesterdayIds.length,
    dueTotal: plan.dueIds.length,
    freshTotal: plan.newIds.length,
  };
}

export function countExtraDue(state: PersistedState, today: string, index: IndexWord[]): number {
  if (!state.plan) return 0;
  const used = new Set<number>([
    ...state.plan.yesterdayIds,
    ...state.plan.dueIds,
    ...state.plan.newIds,
  ]);
  const yesterday = addDays(today, -1);
  let count = 0;
  for (const word of index) {
    const progress = state.words[String(word.id)];
    if (!progress || used.has(word.id)) continue;
    if (progress.introducedOn >= yesterday) continue;
    if (progress.lastReviewedOn === today) continue;
    if (progress.nextReviewOn <= today) count += 1;
  }
  return count;
}

export function resetProgress(state: PersistedState): PersistedState {
  return {
    ...defaultState(),
    speechOn: state.speechOn,
    pwaDismissed: state.pwaDismissed,
  };
}

export function shiftDay(state: PersistedState, delta: number): PersistedState {
  return {
    ...state,
    dayOffset: Math.max(0, Math.min(30, state.dayOffset + delta)),
    plan: null,
  };
}
