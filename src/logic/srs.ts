import { LADDER, type Grade } from "./types";

export function nextInterval(current: number, grade: Grade): number {
  let index = 0;
  for (let i = 0; i < LADDER.length; i += 1) {
    if (LADDER[i] <= current) index = i;
  }
  if (grade === "known") return LADDER[Math.min(LADDER.length - 1, index + 1)];
  if (grade === "unknown") return 1;
  return current <= 3 ? 1 : 3;
}
