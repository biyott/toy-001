import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHARACTERS, SYNERGIES, UPGRADES, WEAPONS } from '../src/game/content.ts';

describe('P0 콘텐츠 계약', () => {
  test('P0에는 서로 다른 무기 3종과 업그레이드 8종 이상이 있다', () => {
    const p0Weapons = Object.values(WEAPONS).filter((weapon) => weapon.tier === 0);
    const p0Upgrades = UPGRADES.filter((upgrade) => upgrade.tier === 0);

    assert.ok(p0Weapons.length >= 3, `P0 무기 ${p0Weapons.length}종`);
    assert.ok(p0Upgrades.length >= 8, `P0 업그레이드 ${p0Upgrades.length}종`);
    assert.equal(new Set(p0Weapons.map(({ id }) => id)).size, p0Weapons.length);
    assert.equal(new Set(p0Upgrades.map(({ id }) => id)).size, p0Upgrades.length);
  });

  test('콘텐츠 참조와 레벨 제한이 유효하다', () => {
    const weaponIds = new Set(Object.keys(WEAPONS));
    const upgradeIds = new Set(UPGRADES.map(({ id }) => id));

    for (const character of Object.values(CHARACTERS)) {
      assert.ok(weaponIds.has(character.weapon), `${character.id}의 시작 무기`);
    }
    for (const upgrade of UPGRADES) {
      assert.ok(upgrade.maxLevel > 0, `${upgrade.id}의 maxLevel`);
      if (upgrade.weapon) assert.ok(weaponIds.has(upgrade.weapon), `${upgrade.id}의 무기 참조`);
    }
    for (const synergy of SYNERGIES) {
      assert.ok(synergy.requires.length >= 2, `${synergy.id}의 조합 조건`);
      for (const requirement of synergy.requires) {
        assert.ok(weaponIds.has(requirement) || upgradeIds.has(requirement), `${synergy.id}의 ${requirement} 참조`);
      }
    }
  });

  test('P0 조합은 최소 2개이며 화면에 설명할 메타데이터가 있다', () => {
    assert.ok(SYNERGIES.length >= 2);
    for (const synergy of SYNERGIES.slice(0, 2)) {
      assert.ok(synergy.name.trim().length > 0);
      assert.ok(synergy.description.trim().length > 0);
    }
  });
});
