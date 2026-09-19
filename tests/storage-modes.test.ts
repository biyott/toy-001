import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { defaultProfile, loadProfile, recordRunResult, STORAGE_KEY } from '../src/storage.ts';
import type { GameState, Profile } from '../src/types.ts';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(String(key), String(value)); }
}

function result(
  mode: GameState['mode'],
  phase: GameState['phase'],
  score: number,
  elapsed: number,
): Pick<GameState, 'phase' | 'mode' | 'elapsed' | 'stats'> {
  return {
    mode,
    phase,
    elapsed,
    stats: { kills: 0, damageDealt: 0, damageTaken: 0, score, gems: 0, bossesDefeated: 0, maxEnemies: 0 },
  };
}

describe('모드별 기록 분리', () => {
  test('normal 결과는 루트 기록만 갱신하고 demo 기록과 설정을 보존한다', () => {
    const profile: Profile = {
      ...defaultProfile(),
      bestScore: 100,
      bestTime: 40,
      wins: 2,
      settings: { muted: true, reducedMotion: true },
      demoRecord: { bestScore: 900, bestTime: 170, wins: 5 },
    };
    const original = structuredClone(profile);

    const won = recordRunResult(profile, result('normal', 'victory', 500, 600));
    assert.deepEqual(won, {
      ...profile,
      bestScore: 500,
      bestTime: 600,
      wins: 3,
    });
    assert.deepEqual(won.demoRecord, profile.demoRecord);
    assert.deepEqual(profile, original, '입력 프로필을 직접 변경하면 안 된다');

    const lost = recordRunResult(won, result('normal', 'defeat', 200, 70));
    assert.equal(lost.bestScore, 500);
    assert.equal(lost.bestTime, 600);
    assert.equal(lost.wins, 3);
  });

  test('demo 결과는 demoRecord만 갱신하고 normal 기록과 설정에 간섭하지 않는다', () => {
    const profile: Profile = { ...defaultProfile(), bestScore: 8_000, bestTime: 600, wins: 4, settings: { muted: true, reducedMotion: false } };
    const lost = recordRunResult(profile, result('demo', 'defeat', 300, 120));
    assert.deepEqual(lost.demoRecord, { bestScore: 300, bestTime: 120, wins: 0 });
    assert.deepEqual({ bestScore: lost.bestScore, bestTime: lost.bestTime, wins: lost.wins }, { bestScore: 8_000, bestTime: 600, wins: 4 });
    assert.deepEqual(lost.settings, profile.settings);

    const won = recordRunResult(lost, result('demo', 'victory', 250, 180));
    assert.deepEqual(won.demoRecord, { bestScore: 300, bestTime: 180, wins: 1 });
    assert.deepEqual({ bestScore: won.bestScore, bestTime: won.bestTime, wins: won.wins }, { bestScore: 8_000, bestTime: 600, wins: 4 });
  });

  test('challenge와 결과가 아닌 phase는 같은 프로필 객체를 그대로 반환한다', () => {
    const profile = defaultProfile();
    assert.strictEqual(recordRunResult(profile, result('challenge', 'victory', 999, 600)), profile);
    assert.strictEqual(recordRunResult(profile, result('normal', 'playing', 999, 300)), profile);
    assert.strictEqual(recordRunResult(profile, result('demo', 'paused', 999, 100)), profile);
  });

  test('demoRecord가 없는 기존 v1 저장은 키를 추가하지 않고 그대로 마이그레이션한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      bestScore: 321,
      bestTime: 456,
      wins: 7,
      settings: { muted: true, reducedMotion: false },
    }));

    const loaded = loadProfile(storage);
    assert.deepEqual(loaded, {
      version: 1,
      bestScore: 321,
      bestTime: 456,
      wins: 7,
      settings: { muted: true, reducedMotion: false },
    });
    assert.equal(Object.hasOwn(loaded, 'demoRecord'), false);
  });

  test('손상된 demoRecord만 복구하고 normal 기록과 설정은 유지한다', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      bestScore: 700,
      bestTime: 590,
      wins: 8,
      settings: { muted: true, reducedMotion: true },
      demoRecord: { bestScore: -4, bestTime: 'broken', wins: 1.9 },
    }));

    assert.deepEqual(loadProfile(storage), {
      version: 1,
      bestScore: 700,
      bestTime: 590,
      wins: 8,
      settings: { muted: true, reducedMotion: true },
      demoRecord: { bestScore: 0, bestTime: 0, wins: 1 },
    });

    storage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      bestScore: 700,
      bestTime: 590,
      wins: 8,
      settings: { muted: true, reducedMotion: true },
      demoRecord: 'broken',
    }));
    const loaded = loadProfile(storage);
    assert.equal(Object.hasOwn(loaded, 'demoRecord'), false);
    assert.deepEqual(loaded.settings, { muted: true, reducedMotion: true });
    assert.deepEqual({ bestScore: loaded.bestScore, bestTime: loaded.bestTime, wins: loaded.wins }, { bestScore: 700, bestTime: 590, wins: 8 });
  });
});
