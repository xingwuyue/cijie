import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultState, sanitize } from "./plan";
import type { PersistedState } from "./types";

const KEY = "cijie.state.v1";

export async function loadState(): Promise<PersistedState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return defaultState();
  return sanitize(JSON.parse(raw) as unknown);
}

export async function saveState(state: PersistedState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}
