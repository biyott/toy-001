import type { GameState, Profile, RunRecord } from './types';

export const STORAGE_KEY = 'little-rune-guardians.v1';
export function defaultProfile(): Profile {
  return { version: 1, bestScore: 0, bestTime: 0, wins: 0, settings: { muted: false, reducedMotion: false } };
}
function safeNumber(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : 0;
}
function sanitizeRecord(value: unknown): RunRecord | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Partial<RunRecord>;
  return {
    bestScore: Math.floor(safeNumber(record.bestScore, 1e12)),
    bestTime: safeNumber(record.bestTime, 86400),
    wins: Math.floor(safeNumber(record.wins, 1e9)),
  };
}
export function loadProfile(storage?: Storage): Profile {
  const fallback = defaultProfile();
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1) return fallback;
    const p = data as Partial<Profile>;
    const demoRecord = sanitizeRecord(p.demoRecord);
    return {
      version: 1, bestScore: Math.floor(safeNumber(p.bestScore, 1e12)), bestTime: safeNumber(p.bestTime, 86400),
      wins: Math.floor(safeNumber(p.wins, 1e9)),
      settings: { muted: p.settings?.muted === true, reducedMotion: p.settings?.reducedMotion === true },
      ...(demoRecord ? { demoRecord } : {}),
    };
  } catch { return fallback; }
}
export function saveProfile(profile: Profile, storage?: Storage): boolean {
  try { (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(profile)); return true; }
  catch { return false; }
}

type RunResultState = Pick<GameState, 'phase' | 'mode' | 'elapsed' | 'stats'>;

export function recordRunResult(profile: Profile, state: RunResultState): Profile {
  if ((state.phase !== 'victory' && state.phase !== 'defeat') || state.mode === 'challenge') return profile;
  const previous: RunRecord = state.mode === 'demo'
    ? profile.demoRecord ?? { bestScore: 0, bestTime: 0, wins: 0 }
    : { bestScore: profile.bestScore, bestTime: profile.bestTime, wins: profile.wins };
  const next: RunRecord = {
    bestScore: Math.max(previous.bestScore, Math.floor(safeNumber(state.stats.score, 1e12))),
    bestTime: Math.max(previous.bestTime, safeNumber(state.elapsed, 86400)),
    wins: Math.min(1e9, previous.wins + (state.phase === 'victory' ? 1 : 0)),
  };
  return state.mode === 'demo'
    ? { ...profile, demoRecord: next }
    : { ...profile, ...next };
}
