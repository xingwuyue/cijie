import indexJson from "./index.json";
import { bandOfRank, type BandId } from "../logic/types";

type RawWord = [number, string, string, string, string];
type RawExample = [string, string, string, string];

export type Example = {
  en: string;
  zh: string;
  form: string;
  src: "tatoeba" | "original";
};

export type WordEntry = {
  id: number;
  word: string;
  ipa: string;
  pos: string;
  gloss: string;
  rank: number;
  band: BandId;
};

export const WORDS: WordEntry[] = (indexJson as RawWord[]).map(
  ([id, word, ipa, pos, gloss]) => ({
    id,
    word,
    ipa,
    pos,
    gloss,
    rank: id,
    band: bandOfRank(id),
  }),
);

const byId = new Map(WORDS.map((word) => [word.id, word]));

export function getWord(id: number): WordEntry | undefined {
  return byId.get(id);
}

const loaders: Record<BandId, () => Promise<unknown>> = {
  1: () => import("./ex1.json"),
  2: () => import("./ex2.json"),
  3: () => import("./ex3.json"),
  4: () => import("./ex4.json"),
  5: () => import("./ex5.json"),
};

const exampleCache: Partial<Record<BandId, Record<string, RawExample[]>>> = {};

export async function ensureExamples(bands: BandId[]): Promise<void> {
  await Promise.all(
    bands.map(async (band) => {
      if (exampleCache[band]) return;
      const loaded = (await loaders[band]()) as { default?: Record<string, RawExample[]> };
      exampleCache[band] = loaded.default ?? (loaded as unknown as Record<string, RawExample[]>);
    }),
  );
}

export function examplesFor(id: number): Example[] {
  const band = bandOfRank(id);
  const rows = exampleCache[band]?.[String(id)] ?? [];
  return rows.map(([en, zh, form, src]) => ({
    en,
    zh,
    form,
    src: src === "o" ? "original" : "tatoeba",
  }));
}
