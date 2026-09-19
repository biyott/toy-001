import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame, zoneContains } from '../src/game/engine.ts';
import { updateP1Boss } from '../src/game/p1-boss.ts';
import type { P1Context } from '../src/game/p1-context.ts';
import type { Enemy, GameOptions, Zone } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot } from './fixtures.ts';

const DT = 1 / 120;
const OPTIONS: GameOptions = { mode: 'normal', seed: 712, character: 'knight', contentTier: 1 };

/**
 * Node unit fixture, not browser evidence. The isolated golem is advanced by
 * this module's explicit context contract. Generated zones run through the real
 * engine for telegraph expiry, collision, damage, hitIds, events and removal.
 * The boss is intentionally outside state.enemies to avoid a second FSM update.
 */
function fixture(nextPattern = 0) {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  const state = mutableStateFixture(game);
  state.weapons = [];
  state.props = [];
  state.bossSpawned = true;
  state.duration = 100;
  state.elapsed = state.duration; // Stop ambient waves before the automatic boss thresholds.
  Object.assign(state.player, { x: 150, y: 0 });
  const boss: Enemy = { id: 9_200_000, kind: 'golem', x: 0, y: 0, radius: 46,
    facing: 0, hp: 3000, maxHp: 3000, damage: 21, xp: 70, speed: 29,
    state: 'chase', stateTime: 0, hitFlash: 0, boss: true, attackCooldown: 0,
    vx: nextPattern, vy: 0 };
  let nextId = 9_300_000;
  let speedFactor = 1;
  const unexpected = () => { throw new Error('The boss module must not own damage, effects, projectiles, or random state'); };
  const ctx: P1Context = {
    state, random: unexpected, upgrade: () => 0, power: () => 1, haste: () => 1,
    nearest: () => undefined, nearby: () => [], damageEnemy: unexpected,
    emit: unexpected, addProjectile: unexpected, slowEnemy: unexpected,
    addZone(zone) { const created = { ...zone, id: nextId++, hitIds: [] }; state.zones.push(created); return created; },
    moveBody(body, dx, dy) { body.x += dx; body.y += dy; },
    effectiveSpeed: enemy => enemy.speed * speedFactor,
  };
  function advance() {
    // Same ownership contract as engine.updateEnemies: common timers once.
    boss.stateTime += DT;
    boss.attackCooldown -= DT;
    boss.hitFlash = Math.max(0, boss.hitFlash - DT);
    assert.equal(updateP1Boss(boss, DT, ctx), true);
    game.step(DT, NO_INPUT);
  }
  const setSpeedFactor = (factor: number) => { speedFactor = factor; };
  return { game, state, boss, ctx, advance, setSpeedFactor };
}

function geometry(zone: Zone) {
  const { x, y, shape, radius, innerRadius, length, width, angle } = zone;
  return { x, y, shape, radius, innerRadius, length, width, angle };
}

describe('골렘 두 패턴의 예고·피해·회복 (Node unit fixtures)', () => {
  for (const [nextPattern, kind, damage] of [[0, 'golem-shockwave', 26], [1, 'golem-fissure', 29]] as const) {
    test(`${kind}: 고정 예고, 실제 엔진 발동, 1회 피해, 장판 소멸 뒤 회복`, () => {
      const { game, state, boss, advance } = fixture(nextPattern);
      const hp = state.player.hp;
      advance();
      assert.equal(boss.state, 'windup');
      assert.equal(state.zones.length, 1);
      const zone = state.zones[0]!;
      assert.equal(zone.kind, kind);
      const original = snapshot(geometry(zone));
      const positions = { x: boss.x, y: boss.y };
      state.player.y = 10;
      for (let frame = 0; zone.telegraph > DT && frame < 300; frame++) {
        assert.equal(state.player.hp, hp);
        assert.equal(state.stats.damageTaken, 0);
        assert.deepEqual(zone.hitIds, []);
        assert.deepEqual(geometry(zone), original);
        advance();
      }
      assert.ok(zone.telegraph > 0 && zone.telegraph <= DT);
      assert.equal(game.drainEvents().filter(event => event.type === 'attack').length, 0);
      advance();
      assert.equal(zone.telegraph, 0);
      assert.deepEqual(geometry(zone), original);
      assert.equal(state.player.hp, hp - damage);
      assert.equal(state.stats.damageTaken, damage);
      assert.deepEqual(zone.hitIds, [state.player.id]);
      assert.equal(game.drainEvents().filter(event => event.type === 'attack' && event.kind === kind).length, 1);
      let sawAttack = boss.state === 'attack';
      for (let frame = 0; boss.state !== 'recover' && frame < 150; frame++) {
        state.player.invulnerable = 0;
        advance();
        sawAttack ||= boss.state === 'attack';
        assert.deepEqual({ x: boss.x, y: boss.y }, positions);
      }
      assert.equal(sawAttack, true);
      assert.equal(boss.state, 'recover');
      assert.equal(state.zones.length, 0, 'recovery must start after the damaging zone disappears');
      assert.equal(state.player.hp, hp - damage, 'one active zone cannot cause repeated damage');
      assert.equal(boss.stateTime, 0);
      for (let frame = 0; boss.state === 'recover' && frame < 100; frame++) {
        advance();
        assert.deepEqual({ x: boss.x, y: boss.y }, positions, 'recovery is stationary');
      }
      assert.equal(boss.state, 'chase');
      assert.ok(boss.attackCooldown > 0, 'a clear recovery gap precedes the next windup');
      assert.equal(game.drainEvents().filter(event => event.type === 'attack' && event.kind === kind).length, 0);
    });
  }

  test('고리는 접촉하지 않고 들어갈 수 있는 내부 안전영역과 외부 회피영역을 둔다', () => {
    const { state, boss, advance } = fixture();
    advance();
    const zone = state.zones[0]!;
    assert.equal(zone.shape, 'ring');
    assert.ok(80 > boss.radius + state.player.radius);
    for (const [x, expected] of [[80, false], [85, true], [150, true], [235, true], [236, false]] as const) {
      assert.equal(zoneContains(zone, { x, y: 0 }, state.player.radius), expected, `x=${x}`);
    }
    state.player.x = 80;
    for (let frame = 0; frame < 210; frame++) advance();
    assert.equal(state.player.hp, state.player.maxHp);
    assert.equal(state.stats.damageTaken, 0);
  });

  test('균열 방향은 예고 시 고정되고 옆으로 걸어 실제 피해를 회피할 수 있다', () => {
    const { game, state, boss, ctx, advance } = fixture(1);
    advance();
    const zone = state.zones[0]!;
    assert.equal(zone.shape, 'line');
    assert.equal(zone.length, 390);
    assert.equal(zone.width, 60);
    assert.equal(zone.angle, 0);
    // Use real movement in the engine. Advance module separately as contracted.
    for (let frame = 0; frame < 90; frame++) {
      boss.stateTime += DT;
      boss.attackCooldown -= DT;
      updateP1Boss(boss, DT, ctx);
      game.step(DT, { ...NO_INPUT, moveY: 1 });
    }
    assert.ok(!zoneContains(zone, state.player, state.player.radius));
    for (let frame = 0; frame < 100; frame++) advance();
    assert.equal(zone.angle, 0);
    assert.equal(boss.facing, 0);
    assert.equal(state.player.hp, state.player.maxHp);
    assert.equal(state.stats.damageTaken, 0);
  });

  test('균열 끝 모서리는 사각 패딩이 아닌 실제 몸 원의 접촉으로 판정한다', () => {
    const { state, advance } = fixture(1);
    advance();
    const zone = state.zones[0]!;
    const radius = state.player.radius;
    for (const [x, y, expected] of [[-14, 44, false], [-9, 42, true], [404, 44, false], [399, 42, true], [150, 45, true], [150, 45.01, false]] as const) {
      assert.equal(zoneContains(zone, { x, y }, radius), expected, `(${x}, ${y})`);
      const rotated = { ...zone, angle: Math.PI / 2 };
      assert.equal(zoneContains(rotated, { x: -y, y: x }, radius), expected, `rotated (${x}, ${y})`);
    }
  });

  test('패턴은 골렘마다 독립적으로 고리→균열→고리 순환한다', () => {
    const left = fixture();
    const right = fixture();
    left.advance();
    for (let frame = 0; left.state.zones.filter(zone => zone.kind === 'golem-fissure').length === 0 && frame < 800; frame++) left.advance();
    assert.ok(left.state.zones.some(zone => zone.kind === 'golem-fissure'));
    right.advance();
    assert.equal(right.state.zones[0]!.kind, 'golem-shockwave');
    left.state.player.x = 700;
    for (let frame = 0; !left.state.zones.some(zone => zone.kind === 'golem-shockwave') && frame < 800; frame++) left.advance();
    assert.ok(left.state.zones.some(zone => zone.kind === 'golem-shockwave'));
  });

  test('추적은 slow 효과를 따르고 공통 타이머를 직접 갱신하지 않는다', () => {
    const { boss, ctx, setSpeedFactor } = fixture();
    boss.attackCooldown = 3;
    boss.stateTime = .4;
    boss.hitFlash = .2;
    setSpeedFactor(.5);
    updateP1Boss(boss, DT, ctx);
    assert.equal(boss.attackCooldown, 3);
    assert.equal(boss.stateTime, .4);
    assert.equal(boss.hitFlash, .2);
    assert.ok(Math.abs(boss.x - boss.speed * .5 * DT) < 1e-9);
  });

  test('다른 적은 변경 없이 false를 반환하고 죽은 골렘은 새 공격을 만들지 않는다', () => {
    const { state, boss, ctx } = fixture();
    const mushroom = { ...boss, kind: 'mushroomKing' as const };
    const before = snapshot(mushroom);
    assert.equal(updateP1Boss(mushroom, DT, ctx), false);
    assert.deepEqual(mushroom, before);
    boss.hp = 0;
    assert.equal(updateP1Boss(boss, DT, ctx), true);
    assert.equal(state.zones.length, 0);
  });
});

describe('골렘 엔진 연결·두 보스 클리어 (Node unit fixtures)', () => {
  test('엔진이 골렘 패턴을 호출하며 두 종류의 실제 처치와 제한시간 후에만 승리한다', () => {
    const game = createGame(OPTIONS);
    game.dispatch({ type: 'start', options: OPTIONS });
    const state = mutableStateFixture(game);
    state.props = [];
    state.weapons = [];
    state.elapsed = 540;
    state.player.invulnerable = 30;
    game.step(DT, NO_INPUT);
    const mushroom = state.enemies.find(enemy => enemy.kind === 'mushroomKing');
    const golem = state.enemies.find(enemy => enemy.kind === 'golem');
    assert.ok(mushroom);
    assert.ok(golem);
    state.enemies = [mushroom, golem];
    Object.assign(mushroom, { x: -400, y: 0, attackCooldown: 100 });
    Object.assign(golem, { x: 0, y: 0, attackCooldown: 0 });
    Object.assign(state.player, { x: 400, y: 300 });
    game.step(DT, NO_INPUT);
    assert.equal(golem.state, 'windup');
    assert.equal(state.zones.filter(zone => zone.kind === 'golem-shockwave').length, 1);
    assert.equal(state.zones.filter(zone => zone.kind === 'spore-burst').length, 0, 'the golem must not also run the P0 boss FSM');

    function defeat(enemy: Enemy, id: number) {
      state.zones.push({ id, x: enemy.x, y: enemy.y, shape: 'circle', radius: 10,
        angle: 0, telegraph: 0, duration: .02, damage: enemy.hp + 1,
        owner: 'player', kind: 'sword', hitIds: [] });
      game.step(DT, NO_INPUT);
    }
    defeat(mushroom, 9_400_001);
    assert.equal(state.stats.bossesDefeated, 1);
    assert.equal(state.bossDefeated, false);
    state.elapsed = state.duration;
    game.step(DT, NO_INPUT);
    assert.equal(state.phase, 'playing', 'one defeated boss cannot clear the expanded tier');
    game.drainEvents();
    defeat(golem, 9_400_002);
    assert.equal(state.stats.bossesDefeated, 2);
    assert.equal(state.bossDefeated, true);
    assert.equal(state.phase, 'victory');
    const events = game.drainEvents();
    assert.equal(events.filter(event => event.type === 'kill' && event.kind === 'golem').length, 1);
    assert.equal(events.filter(event => event.type === 'victory').length, 1);
    game.step(.05, NO_INPUT);
    assert.deepEqual(game.drainEvents(), []);
  });
});
