import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseChallengeSeed } from '../src/ui/challenge.ts';

describe('도전 시드 입력', () => {
  test('0과 uint32 최댓값을 포함한 10진수 시드를 그대로 보존한다', () => {
    for (const seed of [0, 1, 42, 2_147_483_648, 4_294_967_295]) {
      assert.deepEqual(parseChallengeSeed(String(seed)), {
        ok: true, seed, canonical: String(seed),
      });
    }
  });

  test('앞뒤 공백과 선행 0은 같은 공유 시드 문자열로 정규화한다', () => {
    assert.deepEqual(parseChallengeSeed(' \t0042\n '), { ok: true, seed: 42, canonical: '42' });
    assert.deepEqual(parseChallengeSeed('0000000000'), { ok: true, seed: 0, canonical: '0' });
    assert.deepEqual(parseChallengeSeed('0000000001'), { ok: true, seed: 1, canonical: '1' });
  });

  test('빈 입력은 0으로 바뀌지 않고 uint32 범위 밖 입력은 접히지 않는다', () => {
    for (const raw of ['', ' \t\n ', '-1', '4294967296', '9999999999', '00000000000']) {
      const result = parseChallengeSeed(raw);
      assert.equal(result.ok, false, JSON.stringify(raw));
      if (!result.ok) assert.ok(result.message.includes('4294967295'));
    }
  });

  test('부호·소수·지수·16진수·내부 공백·비ASCII 숫자를 허용하지 않는다', () => {
    for (const raw of ['+1', '1.0', '1.5', '1e3', '0x10', '1 2', '1\n2', 'Infinity', 'NaN', '１２', '١٢', '룬']) {
      assert.equal(parseChallengeSeed(raw).ok, false, JSON.stringify(raw));
    }
  });

  test('정규화된 결과를 다시 읽어도 시드가 변하지 않는다', () => {
    for (const raw of ['0', ' 00042 ', '2147483648', '4294967295']) {
      const parsed = parseChallengeSeed(raw);
      assert.equal(parsed.ok, true);
      if (parsed.ok) assert.deepEqual(parseChallengeSeed(parsed.canonical), parsed);
    }
  });
});
