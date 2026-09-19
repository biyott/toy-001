import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { defaultProfile, loadProfile, saveProfile } from '../src/storage.ts';

class MemoryStorage implements Storage {
  readonly values = new Map<string, string>();

  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(String(key), String(value)); }
}

function profileStorageKey(storage: MemoryStorage): string {
  saveProfile(defaultProfile(), storage);
  assert.equal(storage.length, 1, '프로필은 단일 저장 키를 사용해야 한다');
  return storage.key(0)!;
}

describe('프로필 저장과 손상 복구', () => {
  test('저장값이 없으면 공유 참조가 아닌 안전한 기본값을 반환한다', () => {
    const storage = new MemoryStorage();
    const first = loadProfile(storage);
    first.settings.muted = true;
    const second = loadProfile(storage);

    assert.deepEqual(second, defaultProfile());
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.settings, second.settings);
  });

  test('유효한 최고 기록과 설정을 왕복 저장한다', () => {
    const storage = new MemoryStorage();
    const profile = {
      ...defaultProfile(),
      bestScore: 12_345,
      bestTime: 599.5,
      wins: 3,
      settings: { muted: true, reducedMotion: true },
    };

    saveProfile(profile, storage);
    assert.deepEqual(loadProfile(storage), profile);
  });

  test('문법 오류, 무한대 수치, 잘못된 스키마를 안전한 값으로 복구한다', () => {
    const fallback = defaultProfile();
    const invalidPayloads: Array<[string, ReturnType<typeof defaultProfile>]> = [
      ['{not-json', fallback],
      ['{"version":1,"bestScore":1e309,"bestTime":0,"wins":0,"settings":{"muted":false,"reducedMotion":false}}', fallback],
      [JSON.stringify({ version: 1, bestScore: -1, bestTime: 0, wins: 0, settings: { muted: false, reducedMotion: false } }), fallback],
      [JSON.stringify({ version: 1, bestScore: 0, bestTime: 0, wins: 1.5, settings: { muted: false, reducedMotion: false } }), { ...fallback, wins: 1 }],
      [JSON.stringify({ version: 2, bestScore: 1, bestTime: 1, wins: 1, settings: { muted: false, reducedMotion: false } }), fallback],
      [JSON.stringify({ version: 1, bestScore: 1, bestTime: 1, wins: 1, settings: { muted: 'yes', reducedMotion: false } }), { ...fallback, bestScore: 1, bestTime: 1, wins: 1 }],
      ['null', fallback],
    ];

    for (const [raw, expected] of invalidPayloads) {
      const storage = new MemoryStorage();
      const key = profileStorageKey(storage);
      storage.setItem(key, raw);
      assert.deepEqual(loadProfile(storage), expected, `손상값 복구 실패: ${raw}`);
    }
  });

  test('프로토타입 오염 속성을 데이터로 받아들이지 않는다', () => {
    const storage = new MemoryStorage();
    const key = profileStorageKey(storage);
    storage.setItem(key, '{"version":1,"bestScore":1,"bestTime":2,"wins":3,"settings":{"muted":false,"reducedMotion":false},"__proto__":{"polluted":true}}');

    const loaded = loadProfile(storage);
    assert.equal((Object.prototype as { polluted?: boolean }).polluted, undefined);
    assert.deepEqual(loaded, {
      version: 1,
      bestScore: 1,
      bestTime: 2,
      wins: 3,
      settings: { muted: false, reducedMotion: false },
    });
    assert.equal(Object.hasOwn(loaded, '__proto__'), false);
  });

  test('스토리지 읽기·쓰기가 예외를 던져도 게임 시작을 막지 않는다', () => {
    const broken = new MemoryStorage();
    broken.getItem = () => { throw new Error('blocked'); };
    broken.setItem = () => { throw new Error('quota'); };

    assert.equal(saveProfile(defaultProfile(), broken), false);
    assert.deepEqual(loadProfile(broken), defaultProfile());
  });

  test('NaN과 과도한 수치는 저장 후 유한한 허용 범위로 복구한다', () => {
    const storage = new MemoryStorage();
    saveProfile({
      ...defaultProfile(),
      bestScore: Number.NaN,
      bestTime: Number.POSITIVE_INFINITY,
      wins: Number.MAX_VALUE,
    }, storage);

    const loaded = loadProfile(storage);
    assert.equal(loaded.bestScore, 0);
    assert.equal(loaded.bestTime, 0);
    assert.equal(loaded.wins, 1_000_000_000);
    assert.ok([loaded.bestScore, loaded.bestTime, loaded.wins].every(Number.isFinite));
  });
});
