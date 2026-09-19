import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame } from '../src/game/engine.ts';
import type { Enemy, GameController, GameOptions, GameState } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, stepFor } from './fixtures.ts';

const SEED = 0x57_50_4e;

function started(character: GameOptions['character']): GameController {
  const options: GameOptions = { mode: 'normal', seed: SEED, character, contentTier: 1 };
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

function stationaryEnemy(id: number, x: number, y: number, radius = 10): Enemy {
  return {
    id, kind: 'slime', x, y, radius, facing: Math.PI, hp: 1_000, maxHp: 1_000,
    speed: 0, damage: 0, xp: 0, state: 'chase', stateTime: 0, hitFlash: 0,
    boss: false, attackCooldown: 999, vx: 0, vy: 0,
  };
}

function weaponState(state: GameState) {
  const weapon = state.weapons[0];
  assert.ok(weapon);
  return weapon;
}

describe('P0 무기 실제 전투 규칙', () => {
  test('검은 조준 방향과 사거리 안의 적만 베고 한 검격으로 한 번씩만 피해를 준다', () => {
    const game = started('knight');
    const state = mutableStateFixture(game);
    const { x, y } = state.player;
    const aimed = stationaryEnemy(9_100_001, x + 60, y);
    const inCone = stationaryEnemy(9_100_002, x + 95, y);
    const outsideAngle = stationaryEnemy(9_100_003, x, y + 95);
    const outsideRange = stationaryEnemy(9_100_004, x + 140, y);
    state.enemies.push(aimed, inCone, outsideAngle, outsideRange);
    weaponState(state).cooldown = 0;

    game.step(0.01, NO_INPUT);

    const slash = game.getState().zones.find(({ kind }) => kind === 'sword');
    assert.ok(slash, '검 공격은 실제 충돌용 영역을 만들어야 한다');
    assert.equal(slash.shape, 'cone');
    assert.ok(Math.abs(slash.angle) < 1e-12, `가장 가까운 적을 향해야 함: ${slash.angle}`);
    assert.equal(aimed.hp, 968);
    assert.equal(inCone.hp, 968);
    assert.equal(outsideAngle.hp, 1_000, '부채꼴 밖의 적은 맞지 않아야 한다');
    assert.equal(outsideRange.hp, 1_000, '사거리 밖의 적은 맞지 않아야 한다');
    assert.deepEqual(new Set(slash.hitIds), new Set([aimed.id, inCone.id]));

    game.step(0.05, NO_INPUT);
    assert.equal(aimed.hp, 968);
    assert.equal(inCone.hp, 968);
    const swordHits = game.drainEvents().filter(({ type, weapon }) => type === 'hit' && weapon === 'sword');
    assert.equal(swordHits.length, 2, '같은 검격 영역이 여러 프레임 겹쳐도 적마다 한 번만 피해를 줘야 한다');
  });

  test('관통 화살은 서로 다른 적을 통과하되 hitIds로 같은 적의 중복 피해를 막는다', () => {
    const game = started('ranger');
    const state = mutableStateFixture(game);
    const { x, y } = state.player;
    const wideTarget = stationaryEnemy(9_200_001, x + 55, y, 34);
    const nextTarget = stationaryEnemy(9_200_002, x + 125, y, 20);
    state.enemies.push(wideTarget, nextTarget);
    state.player.upgrades.pierce = 1;
    weaponState(state).cooldown = 0;

    game.step(0.01, NO_INPUT);
    stepFor(game, 0.32);

    const arrow = game.getState().projectiles.find(({ weapon, owner }) => weapon === 'arrow' && owner === 'player');
    assert.ok(arrow, '두 적을 관통한 화살은 계속 존재해야 한다');
    assert.deepEqual(arrow.hitIds, [wideTarget.id, nextTarget.id]);
    assert.equal(arrow.pierce, 0);
    assert.equal(wideTarget.hp, 975, '여러 프레임 겹치는 첫 적도 한 번만 맞아야 한다');
    assert.equal(nextTarget.hp, 975, '화살은 다음 적까지 관통해야 한다');
    assert.equal(game.getState().stats.damageDealt, 50);
    const arrowHits = game.drainEvents().filter(({ type, weapon }) => type === 'hit' && weapon === 'arrow');
    assert.equal(arrowHits.length, 2);
  });

  test('정령 수와 공전 반경은 무기 레벨에 따라 실제 투사체에 반영된다', () => {
    for (const [level, expectedCount] of [[1, 2], [2, 3], [4, 4], [5, 4]] as const) {
      const game = started('mage');
      const state = mutableStateFixture(game);
      const weapon = weaponState(state);
      weapon.level = level;
      state.player.upgrades.spirit = level;

      game.step(0.01, NO_INPUT);

      const spirits = game.getState().projectiles.filter(({ weapon: id, owner }) => id === 'spirit' && owner === 'player');
      assert.equal(spirits.length, expectedCount, `정령 ${level}레벨 개수`);
      assert.equal(new Set(spirits.map(({ generation }) => generation)).size, expectedCount);
      for (const spirit of spirits) {
        const distance = Math.hypot(spirit.x - state.player.x, spirit.y - state.player.y);
        assert.ok(Math.abs(distance - (65 + level * 6)) < 1e-9, `정령 ${level}레벨 공전 반경: ${distance}`);
      }
    }
  });

  test('정령은 계속 접촉해도 재사용 대기시간마다 같은 적에게 한 번만 피해를 준다', () => {
    const game = started('mage');
    const state = mutableStateFixture(game);
    const weapon = weaponState(state);
    weapon.cooldown = 0.62;
    state.player.invulnerable = 10;
    const target = stationaryEnemy(9_300_001, state.player.x + 71, state.player.y, 75);
    state.enemies.push(target);

    game.step(0.01, NO_INPUT);
    stepFor(game, 0.58);

    const spiritDamage = 19.04; // level 1 base 17 * mage power 1.12
    assert.ok(Math.abs(target.hp - (1_000 - spiritDamage)) < 1e-9);
    assert.ok(Math.abs(game.getState().stats.damageDealt - spiritDamage) < 1e-9);
    assert.equal(game.drainEvents().filter(({ type, weapon: id }) => type === 'hit' && id === 'spirit').length, 1);

    game.step(0.04, NO_INPUT);

    assert.ok(Math.abs(target.hp - (1_000 - spiritDamage * 2)) < 1e-9, '대기시간이 끝난 뒤에는 같은 적을 다시 공격해야 한다');
    assert.ok(Math.abs(game.getState().stats.damageDealt - spiritDamage * 2) < 1e-9);
    assert.equal(game.drainEvents().filter(({ type, weapon: id }) => type === 'hit' && id === 'spirit').length, 1);
  });
});
