import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame, zoneContains } from '../src/game/engine.ts';
import type { Enemy, GameController, GameOptions, GameState, Zone } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0xb055, character: 'knight', contentTier: 0 };
const DT = 1 / 120;

/**
 * Node unit fixture: jump the clock, isolate a real engine-spawned mushroom king,
 * remove weapons/props and position actors. These are not browser playthroughs.
 * Patterns, damage, movement states, death collection and victory still execute
 * through GameController.step; no boss zone or defeat flag is fabricated.
 */
function bossFixture() {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  const state = mutableStateFixture(game);
  state.elapsed = state.duration;
  state.weapons = [];
  state.props = [];
  game.step(DT, NO_INPUT);
  const boss = state.enemies.find(enemy => enemy.boss);
  assert.ok(boss, 'the engine must spawn the actual boss');
  assert.equal(boss.kind, 'mushroomKing');
  state.enemies = [boss];
  state.pickups = [];
  Object.assign(boss, { x: 0, y: 0, state: 'chase', stateTime: 0, attackCooldown: 0 });
  Object.assign(state.player, { x: 390, y: 0, invulnerable: 0 });
  game.drainEvents();
  return { game, state, boss };
}

type BossFixture = ReturnType<typeof bossFixture>;

function attackFixture(shape: 'ring'): BossFixture & { zone: Zone } {
  const fixture = bossFixture();
  const { game, state, boss } = fixture;
  // Complete the first (now projectile-based) pattern before requesting the
  // alternating ring. Its pending launch must not contaminate ring damage tests.
  game.step(DT, NO_INPUT);
  state.player.x = 800;
  for (let frame = 0; frame < 350; frame++) game.step(DT, NO_INPUT);
  assert.equal(state.projectiles.length, 0);
  assert.equal(state.zones.length, 0);
  Object.assign(boss, { x: 0, y: 0, attackCooldown: 0 });
  state.player.x = 130;
  game.step(DT, NO_INPUT);
  const zone = state.zones.find(candidate => candidate.shape === shape && candidate.owner === 'enemy');
  assert.ok(zone, `real boss must create a ${shape} zone`);
  game.drainEvents();
  return { ...fixture, zone };
}

function geometry(zone: Zone) {
  const { x, y, shape, radius, innerRadius, angle, length, width } = zone;
  return { x, y, shape, radius, innerRadius, angle, length, width };
}

function activate(game: GameController, zone: Zone) {
  let frames = 0;
  while (zone.telegraph > 0 && frames++ < 300) game.step(DT, NO_INPUT);
  assert.equal(zone.telegraph, 0, 'the attack must activate within its advertised delay');
}

/** A test-only player strike; the normal zone damage/death pipeline processes it. */
function playerStrike(state: GameState, boss: Enemy, damage: number) {
  state.zones.push({ id: 9_100_001, x: boss.x, y: boss.y, shape: 'circle', radius: 12,
    angle: 0, telegraph: 0, duration: .04, damage, owner: 'player', kind: 'sword', hitIds: [] });
}

describe('버섯 왕 예고·피해 경계 (Node unit fixtures)', () => {
  for (const shape of ['ring'] as const) {
    test(`${shape}: 예고 중 피해가 없고 같은 고정 기하에서 한 번만 발동한다`, () => {
      const { game, state, zone } = attackFixture(shape);
      const original = snapshot(geometry(zone));
      const originalDuration = zone.duration;
      const hp = state.player.hp;
      const expectedDamage = 27;
      assert.equal(zone.damage, expectedDamage);
      // Change the target's position after the warning appears, within the zone.
      state.player.y += 20;
      let frames = 0;
      while (zone.telegraph > DT && frames++ < 300) {
        game.step(DT, NO_INPUT);
        assert.equal(state.player.hp, hp);
        assert.equal(state.stats.damageTaken, 0);
        assert.deepEqual(zone.hitIds, []);
        assert.deepEqual(geometry(zone), original, 'the warning must not track the player');
        assert.equal(zone.duration, originalDuration, 'warning time must not consume active time');
        assert.equal(game.drainEvents().filter(event => event.type === 'attack' && event.kind === zone.kind).length, 0);
      }
      activate(game, zone);
      assert.deepEqual(geometry(zone), original);
      assert.equal(state.player.hp, hp - expectedDamage);
      assert.equal(state.stats.damageTaken, expectedDamage);
      assert.deepEqual(zone.hitIds, [state.player.id]);
      const events = game.drainEvents();
      assert.equal(events.filter(event => event.type === 'attack' && event.kind === zone.kind).length, 1);
      assert.equal(events.filter(event => event.type === 'hit' && event.kind === 'player').length, 1);
      // Explicitly remove damage immunity: hitIds, not immunity, prevents repeats.
      for (let frame = 0; frame < 60; frame++) {
        state.player.invulnerable = 0;
        game.step(DT, NO_INPUT);
      }
      assert.equal(state.player.hp, hp - expectedDamage);
      assert.equal(state.stats.damageTaken, expectedDamage);
      assert.ok(!state.zones.includes(zone), 'the strike must expire');
      assert.equal(game.drainEvents().filter(event => event.type === 'attack' && event.kind === zone.kind).length, 0);
    });
  }

  test('고리 안쪽·바깥쪽 경계는 플레이어 몸 반지름까지 포함한다', () => {
    const { zone, state } = attackFixture('ring');
    for (const [distance, expected] of [[66.99, false], [67, true], [82, true], [205, true], [220, true], [220.01, false]] as const) {
      assert.equal(zoneContains(zone, { x: zone.x + distance, y: zone.y }, state.player.radius), expected, `distance=${distance}`);
    }
    assert.equal(zoneContains(zone, zone, state.player.radius), false, 'the ring center is safe from the zone, independent of boss contact damage');
  });

  for (const distance of [66, 221]) {
    test(`고리 발동 때 거리 ${distance}의 안전 영역에는 피해가 없다`, () => {
      const { game, state, zone } = attackFixture('ring');
      state.player.x = zone.x + distance;
      state.player.y = zone.y;
      const hp = state.player.hp;
      activate(game, zone);
      assert.equal(state.player.invulnerable, 0, 'no immunity must mask the collision check');
      assert.equal(state.player.hp, hp);
      assert.deepEqual(zone.hitIds, []);
    });
  }

  for (const shape of ['ring'] as const) {
    test(`${shape}: 발동 순간의 대시 무적은 해당 공격 전체를 회피한다`, () => {
      const { game, state, zone } = attackFixture(shape);
      for (let frame = 0; zone.telegraph > DT && frame < 300; frame++) game.step(DT, NO_INPUT);
      assert.ok(zone.telegraph > 0 && zone.telegraph <= DT);
      const hp = state.player.hp;
      game.step(DT, { ...NO_INPUT, moveX: 1, dashPressed: true });
      assert.equal(zone.telegraph, 0);
      assert.ok(zoneContains(zone, state.player, state.player.radius), 'the body must still overlap: this verifies immunity, not merely movement');
      assert.ok(state.player.invulnerable > 0);
      assert.deepEqual(zone.hitIds, [state.player.id]);
      assert.equal(state.player.hp, hp);
      assert.equal(game.drainEvents().filter(event => event.type === 'dash').length, 1);
      // Return into the active zone and clear immunity to test whole-strike evasion.
      state.player.dashTime = 0;
      state.player.invulnerable = 0;
      state.player.x = zone.x + 130;
      state.player.y = zone.y;
      game.step(DT, NO_INPUT);
      assert.equal(state.player.hp, hp);
      assert.equal(state.stats.damageTaken, 0);
    });
  }

  test('보스는 예고 중 정지하고 회복 중 감속한 뒤 추적을 재개한다', () => {
    const { game, state, boss } = attackFixture('ring');
    state.player.x = 700;
    const origin = { x: boss.x, y: boss.y };
    for (let frame = 0; boss.state === 'windup' && frame < 300; frame++) {
      game.step(DT, NO_INPUT);
      assert.deepEqual({ x: boss.x, y: boss.y }, origin);
    }
    assert.equal(boss.state, 'recover');
    assert.equal(boss.stateTime, 0);
    const attackCooldown = boss.attackCooldown;
    game.step(DT, NO_INPUT);
    assert.ok(Math.abs(boss.x - origin.x - boss.speed * .4 * DT) < 1e-9);
    let frames = 1;
    while (boss.state === 'recover' && frames++ < 100) game.step(DT, NO_INPUT);
    assert.equal(boss.state, 'chase');
    assert.ok(boss.stateTime > .5 && boss.stateTime <= .5 + DT + 1e-9);
    assert.ok(boss.attackCooldown < attackCooldown);
    const before = boss.x;
    game.step(DT, NO_INPUT);
    assert.ok(Math.abs(boss.x - before - boss.speed * DT) < 1e-9);
  });


});

describe('버섯 왕 피격·처치·연장전 (Node unit fixtures)', () => {
  test('실제 피해가 보스 체력·피격 플래시·통계·이벤트에 반영된다', () => {
    const { game, state, boss } = bossFixture();
    const hp = boss.hp;
    playerStrike(state, boss, 37);
    game.step(DT, NO_INPUT);
    assert.equal(boss.hp, hp - 37);
    assert.ok(boss.hitFlash > 0);
    assert.equal(state.stats.damageDealt, 37);
    assert.equal(state.bossDefeated, false);
    assert.equal(state.stats.bossesDefeated, 0);
    const hit = game.drainEvents().find(event => event.type === 'hit' && event.kind === 'mushroomKing');
    assert.ok(hit);
    assert.equal(hit.value, 37);
    assert.equal(hit.weapon, 'sword');
  });

  test('시간 0에서 살아 있는 보스와 계속 싸우며 실제 처치 프레임에 한 번만 승리한다', () => {
    const { game, state, boss } = bossFixture();
    state.elapsed = state.duration - DT;
    boss.attackCooldown = 100;
    game.step(DT, NO_INPUT);
    assert.equal(state.phase, 'playing');
    assert.ok(state.elapsed >= state.duration);
    assert.equal(state.bossDefeated, false);
    assert.match(state.message, /마지막 시련/);
    for (let frame = 0; frame < 30; frame++) game.step(DT, NO_INPUT);
    assert.equal(state.phase, 'playing');
    assert.ok(state.elapsed > state.duration);
    assert.equal(game.drainEvents().filter(event => event.type === 'victory').length, 0);
    const remainingHp = boss.hp;
    playerStrike(state, boss, remainingHp + 100);
    game.step(DT, NO_INPUT);
    assert.equal(state.phase, 'victory');
    assert.equal(state.bossDefeated, true);
    assert.equal(state.stats.bossesDefeated, 1);
    assert.equal(state.stats.kills, 1);
    assert.equal(state.stats.damageDealt, remainingHp, 'overkill must not inflate damage statistics');
    assert.ok(!state.enemies.some(enemy => enemy.id === boss.id));
    assert.ok(state.pickups.some(pickup => pickup.kind === 'xp' && pickup.value === boss.xp));
    assert.ok(state.pickups.some(pickup => pickup.kind === 'heal' && pickup.value === 50));
    const events = game.drainEvents();
    assert.equal(events.filter(event => event.type === 'kill' && event.kind === 'mushroomKing').length, 1);
    assert.equal(events.filter(event => event.type === 'boss' && event.text === 'defeated').length, 1);
    assert.equal(events.filter(event => event.type === 'victory').length, 1);
    const result = snapshot(state);
    game.step(.05, NO_INPUT);
    assert.deepEqual(state, result);
    assert.deepEqual(game.drainEvents(), []);
  });

  test('시간 전에 실제 보스를 처치해도 제한시간까지 살아남아야 승리한다', () => {
    const { game, state, boss } = bossFixture();
    state.elapsed = state.duration - 1;
    playerStrike(state, boss, boss.hp);
    game.step(DT, NO_INPUT);
    assert.equal(state.bossDefeated, true);
    assert.equal(state.phase, 'playing');
    assert.equal(state.stats.bossesDefeated, 1);
    assert.equal(game.drainEvents().filter(event => event.type === 'victory').length, 0);
    // Jump only the clock, retaining the defeat flag produced by real damage.
    state.elapsed = state.duration - DT;
    game.step(DT, NO_INPUT);
    assert.equal(state.phase, 'victory');
    assert.equal(game.drainEvents().filter(event => event.type === 'victory').length, 1);
  });
});
