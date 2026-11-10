import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, shanghaiDate } from "./dates";
import {
  appendDue,
  applyGrade,
  bandCoverage,
  createPlan,
  displayStreak,
  ensurePlan,
  markSkipKnown,
  masterCurrentBand,
  nextUnintroduced,
  remainingCounts,
  reviewAccuracy,
  sanitize,
  sessionQueue,
  setQuota,
  takeNewWords,
  defaultState,
} from "./plan";
import { nextInterval } from "./srs";
import type { BandId, IndexWord, PersistedState } from "./types";

function words(count: number, band: BandId = 1, start = 1): IndexWord[] {
  return Array.from({ length: count }, (_, index) => {
    const id = start + index;
    return { id, word: `w${id}`, rank: id, band };
  });
}

function withPlan(state: PersistedState, today: string, index: IndexWord[]): PersistedState {
  return ensurePlan(state, today, index);
}

describe("shanghai day boundary", () => {
  it("rolls the date at 16:00 UTC", () => {
    assert.equal(shanghaiDate(new Date("2026-11-09T15:59:59Z")), "2026-11-09");
    assert.equal(shanghaiDate(new Date("2026-11-09T16:00:00Z")), "2026-11-10");
  });

  it("adds days across month ends", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });
});

describe("intervals", () => {
  it("walks the ladder and shortens on fuzzy or unknown", () => {
    assert.equal(nextInterval(1, "known"), 3);
    assert.equal(nextInterval(3, "known"), 7);
    assert.equal(nextInterval(7, "known"), 14);
    assert.equal(nextInterval(14, "known"), 30);
    assert.equal(nextInterval(30, "known"), 60);
    assert.equal(nextInterval(60, "known"), 60);
    assert.equal(nextInterval(1, "fuzzy"), 1);
    assert.equal(nextInterval(3, "fuzzy"), 1);
    assert.equal(nextInterval(7, "fuzzy"), 3);
    assert.equal(nextInterval(14, "unknown"), 1);
  });
});

describe("daily plan", () => {
  const today = "2026-11-10";
  const index = words(30);

  it("starts with only new words", () => {
    const state = withPlan(defaultState(), today, index);
    assert.ok(state.plan);
    assert.equal(state.plan.yesterdayIds.length, 0);
    assert.equal(state.plan.dueIds.length, 0);
    assert.deepEqual(state.plan.newIds, index.slice(0, 15).map((word) => word.id));
    assert.equal(sessionQueue(state.plan)[0]?.kind, "new");
  });

  it("keeps the same plan when called again", () => {
    const once = withPlan(defaultState(), today, index);
    const twice = ensurePlan(once, today, index);
    assert.equal(twice, once);
  });

  it("puts yesterday's words first the next day", () => {
    let state = withPlan(defaultState(), today, index);
    for (const id of state.plan!.newIds.slice(0, 3)) {
      state = applyGrade(state, today, index, id, "new", "unknown");
    }
    const tomorrow = addDays(today, 1);
    state = ensurePlan(state, tomorrow, index);
    assert.deepEqual(state.plan?.yesterdayIds, [1, 2, 3]);
    assert.equal(sessionQueue(state.plan!)[0]?.kind, "yesterday");
    assert.equal(state.words["1"].nextReviewOn, tomorrow);
    assert.equal(reviewAccuracy(state, tomorrow).sample, 0);
  });

  it("schedules the next interval only after the required review", () => {
    let state = withPlan(defaultState(), today, index);
    state = applyGrade(state, today, index, 1, "new", "known");
    const tomorrow = addDays(today, 1);
    state = ensurePlan(state, tomorrow, index);
    state = applyGrade(state, tomorrow, index, 1, "yesterday", "known");
    assert.equal(state.words["1"].intervalDays, 3);
    assert.equal(state.words["1"].nextReviewOn, addDays(tomorrow, 3));
    assert.equal(reviewAccuracy(state, tomorrow).sample, 1);
    assert.equal(reviewAccuracy(state, tomorrow).rate, 1);
  });

  it("caps older reviews and orders the most overdue first", () => {
    const state = defaultState();
    const introduced = "2026-11-01";
    for (let id = 1; id <= 20; id += 1) {
      state.words[String(id)] = {
        introducedOn: introduced,
        nextReviewOn: id <= 15 ? "2026-11-08" : "2026-11-10",
        intervalDays: 3,
        lastGrade: "known",
        lastReviewedOn: introduced,
        reviewCount: 1,
      };
    }
    const plan = createPlan(state, today, index);
    assert.equal(plan.dueIds.length, 12);
    assert.equal(plan.dueIds[0], 1);
    assert.ok(plan.dueIds.every((id) => id <= 15));
    const more = appendDue({ ...state, plan }, today, index);
    assert.ok(more.plan);
    assert.equal(more.plan.dueIds.length, 20);
  });

  it("does not pull the next band early", () => {
    const mixed = [...words(5, 1), ...words(10, 2, 6)];
    const state = { ...defaultState(), currentBand: 1 as const };
    const picked = takeNewWords(state, mixed, 15, new Set());
    assert.deepEqual(picked, [1, 2, 3, 4, 5]);
  });

  it("after unlock, keeps up to three leftovers from the previous band", () => {
    const mixed = [...words(5, 1), ...words(10, 2, 6)];
    const state = { ...defaultState(), currentBand: 2 as const };
    for (const id of [1, 2, 3, 4]) {
      state.words[String(id)] = {
        introducedOn: "2026-11-01",
        nextReviewOn: "2026-12-01",
        intervalDays: 7,
        lastGrade: "known",
        lastReviewedOn: "2026-11-02",
        reviewCount: 1,
      };
    }
    assert.deepEqual(takeNewWords(state, mixed, 6, new Set()), [5, 6, 7, 8, 9, 10]);
  });
});

describe("unlock and streak", () => {
  const today = "2026-11-10";

  it("unlocks at 80 percent coverage and solid recent accuracy, effective tomorrow", () => {
    const index = words(10);
    let state = withPlan({ ...defaultState(), quota: 10 }, today, index);
    for (const id of state.plan!.newIds) {
      state = applyGrade(state, today, index, id, "new", "known");
    }
    assert.equal(state.pendingBand, null);
    assert.equal(state.streak, 1);
    assert.equal(displayStreak(state, today), 1);
    const reviews = Array.from({ length: 20 }, () => ({ date: today, grade: "known" as const }));
    state = { ...state, reviews };
    state = ensurePlan(state, today, index);
    const graded = applyGrade(
      {
        ...state,
        words: {
          ...state.words,
          "1": { ...state.words["1"], nextReviewOn: today, intervalDays: 1 },
        },
        plan: {
          ...state.plan!,
          dueIds: [1],
          done: state.plan!.done.filter((item) => item.id !== 1),
        },
      },
      today,
      index,
      1,
      "due",
      "known",
    );
    assert.equal(bandCoverage(graded, index, 1).introduced, 10);
    assert.equal(graded.pendingBand, 2);
    assert.equal(graded.advanceOn, addDays(today, 1));
    assert.equal(graded.currentBand, 1);
    const next = ensurePlan(graded, addDays(today, 1), index);
    assert.equal(next.currentBand, 2);
    assert.equal(next.pendingBand, null);
  });

  it("holds the next band when accuracy or sample size is short", () => {
    const index = words(10);
    const state = withPlan(defaultState(), today, index);
    for (let id = 1; id <= 8; id += 1) {
      state.words[String(id)] = {
        introducedOn: today,
        nextReviewOn: addDays(today, 1),
        intervalDays: 1,
        lastGrade: "known",
        lastReviewedOn: null,
        reviewCount: 0,
      };
    }
    state.reviews = Array.from({ length: 19 }, () => ({ date: today, grade: "known" as const }));
    const early = ensurePlan(applyGrade({ ...state, plan: { ...state.plan!, dueIds: [] } }, today, index, 1, "new", "known"), today, index);
    assert.equal(early.pendingBand, null);
    const weak = {
      ...state,
      reviews: Array.from({ length: 20 }, (_, index) => ({
        date: today,
        grade: index < 14 ? ("known" as const) : ("unknown" as const),
      })),
    };
    assert.ok(reviewAccuracy(weak, today).rate < 0.75);
    assert.equal(ensurePlan(weak, today, index).pendingBand, null);
  });

  it("breaks the displayed streak after a missed day and restarts at 1", () => {
    const index = words(10);
    let state = withPlan({ ...defaultState(), quota: 10 }, "2026-11-01", index);
    for (const id of state.plan!.newIds) state = applyGrade(state, "2026-11-01", index, id, "new", "known");
    assert.equal(displayStreak(state, "2026-11-02"), 1);
    assert.equal(displayStreak(state, "2026-11-03"), 0);
    state = withPlan(state, "2026-11-03", index);
    for (const id of state.plan!.newIds) state = applyGrade(state, "2026-11-03", index, id, "new", "known");
    for (const id of state.plan!.yesterdayIds) {
      state = applyGrade(state, "2026-11-03", index, id, "yesterday", "fuzzy");
    }
    assert.equal(state.streak, 1);
    assert.equal(remainingCounts(state.plan!).fresh, 0);
  });
});

describe("quota and storage", () => {
  it("reshapes today's new words only before any new word is graded", () => {
    const index = words(30);
    const today = "2026-11-10";
    let state = withPlan(defaultState(), today, index);
    state = setQuota(state, 10, index);
    assert.equal(state.plan?.newIds.length, 10);
    state = applyGrade(state, today, index, state.plan!.newIds[0], "new", "fuzzy");
    const locked = setQuota(state, 20, index);
    assert.equal(locked.plan?.newIds.length, 10);
    assert.equal(locked.quota, 20);
  });

  it("drops corrupt progress instead of crashing", () => {
    const clean = sanitize({
      version: 1,
      quota: 15,
      words: { "3": { introducedOn: "2026-11-01" }, nope: { introducedOn: "x" } },
      plan: { date: "2026-11-10", quota: 15, yesterdayIds: [], dueIds: [], newIds: [1], done: [] },
    });
    assert.deepEqual(clean.words, {});
    assert.equal(clean.plan?.newIds[0], 1);
    assert.equal(sanitize({ version: 2 }).quota, 15);
    const kept = sanitize({
      version: 1,
      quota: 15,
      words: {
        "4": {
          introducedOn: "2026-11-10",
          nextReviewOn: "9999-12-31",
          intervalDays: 36500,
          lastGrade: "known",
          lastReviewedOn: "2026-11-10",
          reviewCount: 0,
          mastered: true,
        },
      },
    });
    assert.equal(kept.words["4"]?.mastered, true);
  });
});

describe("skip ahead", () => {
  const today = "2026-11-10";
  const index = [...words(4, 1), ...words(4, 2, 5)];

  it("marks known words as mastered and does not queue them for tomorrow", () => {
    let state = withPlan(defaultState(), today, index);
    state = markSkipKnown(state, today, index, 1);
    state = markSkipKnown(state, today, index, 2);
    assert.equal(state.words["1"]?.mastered, true);
    assert.equal(nextUnintroduced(state, index)?.id, 3);
    const tomorrow = ensurePlan(state, addDays(today, 1), index);
    assert.deepEqual(tomorrow.plan?.yesterdayIds, []);
    assert.deepEqual(tomorrow.plan?.dueIds, []);
    assert.equal(tomorrow.plan?.newIds[0], 3);
  });

  it("stops before an unfamiliar word and resumes the normal quota there", () => {
    let state = withPlan({ ...defaultState(), quota: 10 }, today, index);
    state = markSkipKnown(state, today, index, 1);
    state = ensurePlan(state, today, index);
    assert.equal(state.plan?.newIds[0], 2);
    assert.ok(state.plan && state.plan.newIds.length <= 10);
    assert.equal(state.words["2"], undefined);
  });

  it("marks the rest of the band known and unlocks the next band today", () => {
    let state = withPlan(defaultState(), today, index);
    state = masterCurrentBand(state, today, index);
    assert.equal(state.currentBand, 2);
    assert.equal(state.pendingBand, null);
    assert.equal(state.words["1"]?.mastered, true);
    assert.equal(state.words["4"]?.mastered, true);
    assert.equal(state.words["5"], undefined);
    const planned = ensurePlan(state, today, index);
    assert.equal(planned.plan?.newIds.includes(1), false);
    assert.equal(nextUnintroduced(planned, index)?.id, 5);
    const tomorrow = ensurePlan(state, addDays(today, 1), index);
    assert.equal(tomorrow.plan?.yesterdayIds.length, 0);
  });

  it("advances when the last word of a band is marked known one by one", () => {
    let state = defaultState();
    for (const id of [1, 2, 3, 4]) state = markSkipKnown(state, today, index, id);
    assert.equal(state.currentBand, 2);
  });
});
