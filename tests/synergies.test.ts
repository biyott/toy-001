import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UPGRADES } from '../src/game/content.ts';
import { createGame } from '../src/game/engine.ts';
import type { Enemy, GameController, GameEvent, GameOptions, Projectile } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT } from './fixtures.ts';

const SEED = 0x51a7e5;

function started(character: GameOptions['character']): GameController {
  const options: GameOptions = { mode: 'normal', seed: SEED, character, contentTier: 1 };
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

/** Unit-fixture setup only. This is not evidence for an ordinary-input playthrough. */
function grant(game: GameController, id: string, levels = 1): void {
  const choice = UPGRADES.find((upgrade) => upgrade.id === id);
  assert.ok(choice, `missing upgrade fixture: ${id}`);
  for (let level = 0; level < levels; level += 1) {
    const state = mutableStateFixture(game);
    state.phase = 'levelup';
    state.upgradeChoices = [choice];
    game.dispatch({ type: 'selectUpgrade', id });
    assert.equal(game.getState().phase, 'playing');
  }
  game.drainEvents();
}

function enemy(id: number, x: number, y: number, hp = 1_000): Enemy {
  return {
    id, kind: 'slime', x, y, radius: 3, facing: 0,
    hp, maxHp: hp, speed: 0, damage: 0, xp: 0,
    state: 'chase', stateTime: 0, hitFlash: 0, boss: false,
    attackCooldown: 999, vx: 0, vy: 0,
  };
}

function assertFiniteNumbers(label: string, value: object): void {
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'number') assert.ok(Number.isFinite(item), `${label}.${key} must be finite; got ${item}`);
  }
}

interface ArrowResult {
  game: GameController;
  events: GameEvent[];
  targets: Enemy[];
  projectiles: Projectile[];
  damage: number;
}

/** Fires through the engine, then uses a fixture only to make the collision boundary deterministic. */
function runArrowCase(combined: boolean): ArrowResult {
  const game = started('ranger');
  if (combined) {
    grant(game, 'pierce');
    grant(game, 'split');
    assert.deepEqual(game.getState().synergies, ['splinterstorm']);
  }

  const state = mutableStateFixture(game);
  state.player.invulnerable = 10;
  state.props = [];
  state.enemies = [enemy(10_000, 220, state.player.y)];
  const arrowWeapon = state.weapons.find(({ id }) => id === 'arrow');
  assert.ok(arrowWeapon);
  arrowWeapon.cooldown = 0;

  game.step(0.01, NO_INPUT);
  game.drainEvents();
  const fired = mutableStateFixture(game).projectiles.find(({ weapon, generation }) => weapon === 'arrow' && generation === 0);
  assert.ok(fired, 'the real weapon update must fire an arrow');
  assert.equal(fired.pierce, combined ? 2 : 0, 'pierce level 1 must add exactly two extra targets');

  const beforeDamage = game.getState().stats.damageDealt;
  const targets = Array.from({ length: 4 }, (_, index) => enemy(10_100 + index, fired.x, fired.y));
  mutableStateFixture(game).enemies = targets;
  game.step(0.01, NO_INPUT);
  const events = game.drainEvents();

  return {
    game,
    events,
    targets,
    projectiles: [...game.getState().projectiles],
    damage: game.getState().stats.damageDealt - beforeDamage,
  };
}

describe('화살 + 관통 + 분열 조합 효과', () => {
  test('단독 화살보다 조합 화살이 3배의 대상을 맞히고 1세대 자식 6개를 만든다 (unit fixture)', () => {
    const solo = runArrowCase(false);
    const combo = runArrowCase(true);

    const soloHits = solo.targets.filter(({ hp, maxHp }) => hp < maxHp);
    const comboHits = combo.targets.filter(({ hp, maxHp }) => hp < maxHp);
    const splitChildren = combo.projectiles.filter(({ weapon, generation }) => weapon === 'arrow' && generation === 1);

    assert.equal(soloHits.length, 1);
    assert.equal(comboHits.length, 3, 'pierce=2 means the original arrow hits one target plus two extra targets');
    assert.equal(combo.targets[3]!.hp, combo.targets[3]!.maxHp, 'the fourth target is beyond the pierce allowance');
    assert.equal(combo.damage, solo.damage * 3);
    assert.equal(solo.projectiles.length, 0);
    assert.equal(splitChildren.length, 6, 'each of the three original-arrow hits creates two visible child arrows');
    assert.ok(splitChildren.every(({ pierce, life, radius }) => pierce === 1 && life > 0 && radius === 4));
    assert.equal(combo.events.filter(({ type, weapon }) => type === 'hit' && weapon === 'arrow').length, 3);
  });

  test('분열 자식이 적중해도 2세대 화살을 만들지 않는다 (unit fixture)', () => {
    const result = runArrowCase(true);
    const state = mutableStateFixture(result.game);
    const children = state.projectiles.filter(({ weapon, generation }) => weapon === 'arrow' && generation === 1);
    assert.equal(children.length, 6);

    state.projectiles = children;
    state.enemies = children.map((child, index) => {
      child.x = 180 + index * 25;
      child.y = 260;
      child.vx = 0;
      child.vy = 0;
      return enemy(11_000 + index, child.x, child.y);
    });
    result.game.drainEvents();

    result.game.step(0.01, NO_INPUT);
    const childHits = result.game.drainEvents().filter(({ type, weapon }) => type === 'hit' && weapon === 'arrow');
    assert.equal(childHits.length, 6);
    assert.equal(result.game.getState().projectiles.length, 6);
    assert.ok(result.game.getState().projectiles.every(({ generation }) => generation === 1));
    assert.equal(result.game.getState().projectiles.some(({ generation }) => generation > 1), false);
  });

  test('분열 시도 중에도 전체 투사체 수를 300으로 제한한다 (unit fixture)', () => {
    const game = started('ranger');
    grant(game, 'pierce');
    grant(game, 'split');

    const state = mutableStateFixture(game);
    state.props = [];
    state.player.invulnerable = 10;
    state.enemies = [enemy(12_000, 220, state.player.y)];
    const arrowWeapon = state.weapons.find(({ id }) => id === 'arrow');
    assert.ok(arrowWeapon);
    arrowWeapon.cooldown = 0;
    game.step(0.01, NO_INPUT);
    game.drainEvents();

    const source = mutableStateFixture(game).projectiles.find(({ weapon, generation }) => weapon === 'arrow' && generation === 0);
    assert.ok(source);
    assert.equal(source.pierce, 2);
    source.x = 300;
    source.y = 300;
    source.vx = 0;
    source.vy = 0;

    const fillers: Projectile[] = Array.from({ length: 298 }, (_, index) => ({
      id: 20_000 + index, weapon: 'fireball', owner: 'player',
      x: -800, y: -600, radius: 2, facing: 0, vx: 0, vy: 0,
      damage: 1, life: 10, pierce: 0, hitIds: [], generation: 9,
    }));
    const fixture = mutableStateFixture(game);
    fixture.projectiles = [...fillers, source];
    fixture.enemies = [enemy(12_001, source.x, source.y)];
    assert.equal(fixture.projectiles.length, 299);

    game.step(0.01, NO_INPUT);
    const after = game.getState().projectiles;
    assert.equal(after.length, 300, 'only one of the two split children fits at the global cap');
    assert.equal(after.filter(({ weapon, generation }) => weapon === 'arrow' && generation === 1).length, 1);
    assert.ok(after.length <= 300);
  });
});

describe('정령 + 연쇄 전격 조합 효과', () => {
  test('가장 가까운 적 순서로 중복 없이 최대 4회 연쇄하고 모든 수치를 유효하게 유지한다 (unit fixture)', () => {
    const game = started('mage');
    grant(game, 'chain', 3);
    assert.deepEqual(game.getState().synergies, ['stormguard']);

    const state = mutableStateFixture(game);
    state.props = [];
    state.player.invulnerable = 10;
    const firstX = state.player.x + 71;
    const enemies = Array.from({ length: 6 }, (_, index) => enemy(13_000 + index, firstX + index * 40, state.player.y));
    state.enemies = enemies;
    const spiritWeapon = state.weapons.find(({ id }) => id === 'spirit');
    assert.ok(spiritWeapon);
    spiritWeapon.angle = 0;
    spiritWeapon.cooldown = 0.1;

    game.step(0.01, NO_INPUT);
    const events = game.drainEvents();
    const primaryHits = events.filter(({ type, weapon }) => type === 'hit' && weapon === 'spirit');
    const chainHits = events.filter(({ type, weapon }) => type === 'hit' && weapon === 'lightning');
    const chainAttacks = events.filter(({ type, weapon }) => type === 'attack' && weapon === 'lightning');

    assert.equal(primaryHits.length, 1);
    assert.equal(chainHits.length, 4, 'chain level 3 allows 1 + level = 4 secondary strikes');
    assert.equal(chainAttacks.length, 4);
    assert.deepEqual(chainHits.map(({ x }) => x), enemies.slice(1, 5).map(({ x }) => x));
    assert.deepEqual(chainAttacks.map(({ x, targetX }) => [x, targetX]), [
      [enemies[0]!.x, enemies[1]!.x],
      [enemies[1]!.x, enemies[2]!.x],
      [enemies[2]!.x, enemies[3]!.x],
      [enemies[3]!.x, enemies[4]!.x],
    ]);
    assert.equal(new Set([...primaryHits, ...chainHits].map(({ x }) => x)).size, 5, 'one chain traversal cannot hit an enemy twice');
    assert.equal(enemies[5]!.hp, enemies[5]!.maxHp, 'the sixth enemy is beyond the maximum chain count');

    for (const [index, target] of enemies.entries()) assertFiniteNumbers(`enemy[${index}]`, target);
    for (const [index, event] of events.entries()) assertFiniteNumbers(`event[${index}]`, event);
    assertFiniteNumbers('stats', game.getState().stats);
    assert.ok(game.getState().stats.damageDealt > 0);

    game.step(0.01, NO_INPUT);
    assert.equal(
      game.drainEvents().filter(({ type, weapon }) => type === 'hit' && (weapon === 'spirit' || weapon === 'lightning')).length,
      0,
      'the same orbiting spirit keeps its hitIds between cooldown resets',
    );
  });
});
