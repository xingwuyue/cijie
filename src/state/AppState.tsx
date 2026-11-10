import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WORDS, ensureExamples } from "../data/lexicon";
import { addDays, shanghaiDate } from "../logic/dates";
import {
  appendDue,
  applyGrade,
  defaultState,
  ensurePlan,
  resetProgress,
  setQuota as applyQuota,
  shiftDay as applyShift,
} from "../logic/plan";
import { loadState, saveState } from "../logic/storage";
import type { CardKind, Grade, PersistedState, Quota } from "../logic/types";

type AppContextValue = {
  ready: boolean;
  error: string | null;
  state: PersistedState | null;
  today: string;
  retry: () => void;
  grade: (id: number, kind: CardKind, grade: Grade) => void;
  changeQuota: (quota: Quota) => void;
  reset: () => void;
  dismissPwa: () => void;
  setSpeech: (on: boolean) => void;
  moreDue: () => void;
  shiftDay: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<PersistedState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(0);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);
    loadState()
      .then((loaded) => {
        if (cancelled) return;
        setStored(loaded);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setError("进度没有读出来。");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    const timer = setInterval(() => setClock((value) => value + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const today = useMemo(() => {
    const offset = __DEV__ && stored ? stored.dayOffset : 0;
    return addDays(shanghaiDate(), offset);
  }, [stored, clock]);

  const state = stored ? ensurePlan(stored, today, WORDS) : null;

  useEffect(() => {
    if (!stored || !state || state === stored) return;
    setStored(state);
  }, [state, stored]);

  useEffect(() => {
    if (!ready || !state) return;
    const snapshot = state;
    saveQueue.current = saveQueue.current
      .then(() => saveState(snapshot))
      .catch(() => {
        setError("进度暂时没能保存。");
      });
  }, [ready, state]);

  useEffect(() => {
    if (!state) return;
    const bands = new Set(WORDS.filter((word) => word.band <= state.currentBand).map((word) => word.band));
    void ensureExamples([...bands]);
  }, [state?.currentBand]);

  const todayRef = useRef(today);
  todayRef.current = today;

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      error,
      state,
      today,
      retry: () => setAttempt((value) => value + 1),
      grade: (id, kind, grade) => {
        setStored((prev) => {
          if (!prev) return prev;
          const base = ensurePlan(prev, todayRef.current, WORDS);
          return applyGrade(base, todayRef.current, WORDS, id, kind, grade);
        });
      },
      changeQuota: (quota) => {
        setStored((prev) => (prev ? applyQuota(ensurePlan(prev, todayRef.current, WORDS), quota, WORDS) : prev));
      },
      reset: () => setStored((prev) => resetProgress(prev ?? defaultState())),
      dismissPwa: () => setStored((prev) => (prev ? { ...prev, pwaDismissed: true } : prev)),
      setSpeech: (on) => setStored((prev) => (prev ? { ...prev, speechOn: on } : prev)),
      moreDue: () => {
        setStored((prev) => (prev ? appendDue(ensurePlan(prev, todayRef.current, WORDS), todayRef.current, WORDS) : prev));
      },
      shiftDay: () => setStored((prev) => (prev ? applyShift(prev, 1) : prev)),
    }),
    [ready, error, state, today],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("AppStateProvider 缺失");
  return value;
}
