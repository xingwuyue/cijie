const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + SHANGHAI_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatChineseDate(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  const [year] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const week = "日一二三四五六"[utc.getUTCDay()];
  return `${month}月${day}日 · 星期${week}`;
}

export function formatMonthDay(iso: string): string {
  const [, month, day] = iso.split("-").map(Number);
  return `${month}月${day}日`;
}
