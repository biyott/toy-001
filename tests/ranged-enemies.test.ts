import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createGame } from '../src/game/engine.ts';
import type { Enemy, GameOptions, Projectile } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot } from './fixtures.ts';

const DT = 1 / 120;
const OPTIONS: GameOptions = { mode: 'normal', seed: 0x51a7, character: 'knight', contentTier: 0 };

/** Node integration fixture, not normal-play evidence. Isolate a ranged enemy at
 * 390 units and disable weapons/props/spawns. Engine owns windup, aim, launch,
 * projectile flight, collision, splash, damage accounting and lifecycle. */
function rangedFixture(kind: 'mushroom' | 'mushroomKing') {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  const state = mutableStateFixture(game);
  state.elapsed = state.duration;
  state.weapons = [];
  state.props = [];
  Object.assign(state.player, { x: 390, y: 0 });
  let enemy: Enemy;
  if (kind === 'mushroomKing') {
    game.step(DT, NO_INPUT);
    enemy = state.enemies.find(candidate => candidate.kind === kind)!;
    assert.ok(enemy);
  } else {
    state.bossSpawned = true;
    enemy = { id: 9_800_001, kind, x: 0, y: 0, radius: 18, facing: 0, hp: 100,
      maxHp: 100, speed: 0, damage: 13, xp: 3, state: 'chase', stateTime: 0,
      hitFlash: 0, boss: false, attackCooldown: 0, vx: 0, vy: 0 };
  }
  Object.assign(enemy, { x: 0, y: 0, speed: 0, attackCooldown: 0, state: 'chase', stateTime: 0 });
  state.enemies = [enemy];
  state.pickups = [];
  game.drainEvents();
  return { game, state, enemy, projectileKind: kind === 'mushroom' ? 'spore' as const : 'royal-spore' as const };
}

type RangedFixture = ReturnType<typeof rangedFixture>;
function launch(fixture: RangedFixture): Projectile {
  const { game, state, projectileKind } = fixture;
  const hp = state.player.hp;
  for (let frame = 0; frame < 180; frame++) {
    game.step(DT, NO_INPUT);
    assert.equal(state.player.hp, hp, 'windup and distant launch cannot deal immediate damage');
    assert.equal(state.stats.damageTaken, 0);
    const projectile = state.projectiles.find(candidate => candidate.kind === projectileKind);
    if (projectile) return projectile;
  }
  assert.fail(`${projectileKind}: the real FSM must launch within 1.5 seconds`);
}

for (const kind of ['mushroom', 'mushroomKing'] as const) {
  describe(`${kind} 실제 원거리 통합 (Node fixture)`, () => {
    test('무해한 예고 뒤 발사하고 비행 중에는 피해 없이 이동한 후 접촉에서 한 번 적중한다', () => {
      const fixture = rangedFixture(kind);
      const { game, state, enemy, projectileKind } = fixture;
      const hp = state.player.hp;
      const startElapsed = state.elapsed;
      game.step(DT, NO_INPUT);
      const warning = state.zones.find(zone => zone.owner === 'enemy');
      assert.ok(warning);
      assert.equal(warning.damage, 0);
      assert.equal(warning.kind, kind === 'mushroom' ? 'spore-aim' : 'royal-spore-target');
      assert.equal(state.projectiles.length, 0);
      const projectile = launch(fixture);
      const windup = kind === 'mushroom' ? .55 : .65;
      assert.ok(state.elapsed - startElapsed >= windup && state.elapsed - startElapsed <= windup + DT * 2 + 1e-8, 'launch must follow the specified preparation interval');
      const speed = kind === 'mushroom' ? 210 : 240;
      assert.ok(Math.abs(Math.hypot(projectile.vx, projectile.vy) - speed) < 1e-9);
      const x = projectile.x;
      for (let frame = 0; frame < 36; frame++) game.step(DT, NO_INPUT);
      assert.ok(Math.abs(projectile.x - x - speed * .3) < 1e-8);
      assert.equal(state.player.hp, hp);
      assert.equal(state.stats.damageTaken, 0);
      assert.ok(Math.hypot(state.player.x - enemy.x, state.player.y - enemy.y) > 350, 'exclude body contact damage');
      for (let frame = 0; state.stats.damageTaken === 0 && frame < 360; frame++) game.step(DT, NO_INPUT);
      const damage = kind === 'mushroom' ? 13 : 24;
      assert.equal(state.player.hp, hp - damage);
      assert.equal(state.stats.damageTaken, damage);
      assert.ok(!state.projectiles.some(candidate => candidate.id === projectile.id));
      assert.equal(game.drainEvents().filter(event => event.type === 'hit' && event.kind === 'player').length, 1);
      for (let frame = 0; frame < 35; frame++) {
        state.player.invulnerable = 0;
        game.step(DT, NO_INPUT);
      }
      assert.equal(state.stats.damageTaken, damage, 'consumed projectile and splash cannot hit twice');
      assert.ok(!state.projectiles.some(candidate => candidate.kind === projectileKind));
    });

    test('발사 후 정상 이동으로 고정된 비행 경로와 착탄 범위를 피할 수 있다', () => {
      const fixture = rangedFixture(kind);
      const { game, state } = fixture;
      const projectile = launch(fixture);
      const velocity = { vx: projectile.vx, vy: projectile.vy };
      const hp = state.player.hp;
      for (let frame = 0; frame < 160; frame++) game.step(DT, { ...NO_INPUT, moveY: 1 });
      assert.deepEqual({ vx: projectile.vx, vy: projectile.vy }, velocity, 'projectiles do not retarget the moving player');
      for (let frame = 0; frame < 110; frame++) game.step(DT, NO_INPUT);
      assert.equal(state.player.invulnerable, 0, 'no immunity masks evasion');
      assert.equal(state.player.hp, hp);
      assert.equal(state.stats.damageTaken, 0);
    });

    test('일시정지 동안 비행·타이머가 멈추고 재시작은 비행체와 이전 발사 예약을 버린다', () => {
      const fixture = rangedFixture(kind);
      const { game, state } = fixture;
      const projectile = launch(fixture);
      game.dispatch({ type: 'pause' });
      const paused = snapshot(state);
      game.step(10, { ...NO_INPUT, moveY: 1 });
      assert.deepEqual(state, paused);
      const before = projectile.x;
      game.dispatch({ type: 'resume' });
      game.step(DT, NO_INPUT);
      assert.ok(projectile.x > before);
      game.dispatch({ type: 'restart' });
      assert.equal(game.getState().projectiles.length, 0);
      assert.equal(game.getState().zones.length, 0);
      for (let frame = 0; frame < 120; frame++) game.step(DT, NO_INPUT);
      assert.equal(game.getState().projectiles.filter(candidate => candidate.owner === 'enemy').length, 0);
      assert.equal(game.getState().zones.filter(zone => zone.owner === 'enemy').length, 0);
    });
  });
}

describe('왕 포자 착탄·독립 게임 상태 (Node fixture)', () => {
  test('왕 포자는 저장된 목표에 도착하여 같은 반지름의 splash를 한 번 생성한다', () => {
    const fixture = rangedFixture('mushroomKing');
    const { game, state } = fixture;
    const projectile = launch(fixture);
    assert.equal(projectile.targetX, 390);
    assert.equal(projectile.targetY, 0);
    assert.equal(projectile.splashRadius, 88);
    const warning = state.zones.find(zone => zone.kind === 'royal-spore-target')!;
    assert.ok(warning.telegraph > 0);
    assert.equal(warning.damage, 0);
    // Inside the future splash, outside the projectile body's travel corridor.
    state.player.y = 50;
    for (let frame = 0; !state.zones.some(zone => zone.kind === 'spore-burst') && frame < 300; frame++) {
      assert.equal(state.stats.damageTaken, 0);
      game.step(DT, NO_INPUT);
    }
    const impacts = state.zones.filter(zone => zone.kind === 'spore-burst');
    assert.equal(impacts.length, 1);
    const impact = impacts[0]!;
    assert.equal(impact.x, 390);
    assert.equal(impact.y, 0);
    assert.equal(impact.radius, warning.radius);
    assert.equal(impact.radius, 88);
    assert.equal(impact.telegraph, 0);
    assert.equal(impact.damage, 24);
    assert.equal(state.stats.damageTaken, 24);
    assert.equal(projectile.life, 0);
    for (let frame = 0; frame < 40; frame++) {
      state.player.invulnerable = 0;
      game.step(DT, NO_INPUT);
    }
    assert.equal(state.stats.damageTaken, 24);
    assert.equal(state.zones.filter(zone => zone.kind === 'spore-burst').length, 0);
  });

  test('저체력 추가 포자도 독립 투사체로 날아가며 무해한 경고와 착탄만 생성한다', () => {
    const fixture = rangedFixture('mushroomKing');
    const { game, state, enemy } = fixture;
    enemy.hp = enemy.maxHp * .49;
    game.step(DT, NO_INPUT);
    const warnings = state.zones.filter(zone => zone.kind === 'royal-spore-target');
    assert.equal(warnings.length, 3);
    assert.ok(warnings.every(zone => zone.damage === 0 && zone.telegraph > 0));
    assert.deepEqual(warnings.map(zone => zone.radius).sort((a, b) => a - b), [64, 64, 88]);
    const primary = launch(fixture);
    const projectiles = state.projectiles.filter(projectile => projectile.kind === 'royal-spore');
    assert.equal(projectiles.length, 3);
    assert.deepEqual(projectiles.map(projectile => projectile.splashRadius).sort((a, b) => a! - b!), [64, 64, 88]);
    assert.ok(projectiles.includes(primary));
    assert.equal(state.stats.damageTaken, 0);
    state.player.x = 800;
    const seen = new Set<number>();
    for (let frame = 0; frame < 290; frame++) {
      game.step(DT, NO_INPUT);
      for (const zone of state.zones) if (zone.kind === 'spore-burst') seen.add(zone.id);
    }
    assert.equal(seen.size, 3);
    assert.equal(state.stats.damageTaken, 0);
  });

  test('같은 적 ID를 가진 두 게임의 동시 발사 예약은 서로의 목표를 바꾸지 않는다', () => {
    const left = rangedFixture('mushroomKing');
    const right = rangedFixture('mushroomKing');
    assert.equal(left.enemy.id, right.enemy.id, 'reset IDs deliberately collide across independent games');
    right.state.player.x = -390;
    left.game.step(DT, NO_INPUT);
    right.game.step(DT, NO_INPUT);
    const leftShot = launch(left);
    const rightShot = launch(right);
    assert.equal(leftShot.targetX, 390);
    assert.equal(rightShot.targetX, -390);
    assert.ok(leftShot.vx > 0 && rightShot.vx < 0);
    assert.equal(left.state.stats.damageTaken, 0);
    assert.equal(right.state.stats.damageTaken, 0);
  });

  test('발사 예약은 게임 인스턴스와 재시작 사이에 공유되지 않는다', () => {
    const first = rangedFixture('mushroomKing');
    const second = rangedFixture('mushroomKing');
    first.game.step(DT, NO_INPUT);
    first.game.dispatch({ type: 'restart' });
    const expected = launch(second);
    assert.equal(first.game.getState().projectiles.length, 0);
    for (let frame = 0; frame < 100; frame++) first.game.step(DT, NO_INPUT);
    assert.equal(first.game.getState().projectiles.filter(projectile => projectile.owner === 'enemy').length, 0);
    assert.equal(expected.kind, 'royal-spore');
    assert.equal(second.state.projectiles.filter(projectile => projectile.kind === 'royal-spore').length, 1);
  });
});
