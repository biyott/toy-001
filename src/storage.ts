import type { Profile } from './types';

export const STORAGE_KEY = 'little-rune-guardians.v1';
export function defaultProfile(): Profile {
  return { version: 1, bestScore: 0, bestTime: 0, wins: 0, settings: { muted: false, reducedMotion: false } };
}
function safeNumber(value: unknown, max: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : 0;
}
export function loadProfile(storage?: Storage): Profile {
  const fallback = defaultProfile();
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1) return fallback;
    const p = data as Partial<Profile>;
    return {
      version: 1, bestScore: Math.floor(safeNumber(p.bestScore, 1e12)), bestTime: safeNumber(p.bestTime, 86400),
      wins: Math.floor(safeNumber(p.wins, 1e9)),
      settings: { muted: p.settings?.muted === true, reducedMotion: p.settings?.reducedMotion === true },
    };
  } catch { return fallback; }
}
export function saveProfile(profile: Profile, storage?: Storage): boolean {
  try { (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(profile)); return true; }
  catch { return false; }
}
