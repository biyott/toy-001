import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame } from '../src/game/engine.ts';
import { updateP1Enemy } from '../src/game/p1-enemies.ts';
import type { P1Context } from '../src/game/p1-context.ts';
import type { Enemy, GameOptions, GameState, Projectile, Vec2, WeaponId, Zone } from '../src/types.ts';
import { mutableStateFixture } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x503145, character: 'knight', contentTier: 1 };

type MoveCall = { dx: number; dy: number; ignoreProps: boolean };
type ProjectileCall = {
  weapon: WeaponId;
  owner: Projectile['owner'];
  position: Vec2;
  angle: number;
  speed: number;
  damage: number;
  partial: Partial<Projectile>;
};
type EmitCall = { type: string; kind?: string; angle?: number };
type Fixture = {
  state: GameState;
  ctx: P1Context;
  moves: MoveCall[];
  zones: Zone[];
  projectiles: ProjectileCall[];
  emits: EmitCall[];
  damageCalls: Enemy[];
  setSlowFactor(value: number): void;
};

function fixture(): Fixture {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  const state = mutableStateFixture(game);
  state.player.x = 0;
  state.player.y = 0;
  state.enemies = [];
  state.zones = [];
  const moves: MoveCall[] = [];
  const zones: Zone[] = [];
  const projectiles: ProjectileCall[] = [];
  const emits: EmitCall[] = [];
  const damageCalls: Enemy[] = [];
  let nextId = 9_200_000;
  let slowFactor = 1;
  const ctx: P1Context = {
    state,
    random: () => 0.5,
    upgrade: () => 0,
    power: () => 1,
    haste: () => 1,
    nearest: () => undefined,
    nearby: () => [],
    damageEnemy: (target) => { damageCalls.push(target); },
    emit: (type, _position, detail = {}) => { emits.push({ type, kind: detail.kind, angle: detail.angle }); },
    addZone: (partial) => {
      const zone: Zone = { ...partial, id: nextId++, hitIds: [] };
      zones.push(zone);
      state.zones.push(zone);
      return zone;
    },
    addProjectile: (weapon, owner, position, angle, speed, damage, partial = {}) => {
      projectiles.push({ weapon, owner, position: { x: position.x, y: position.y }, angle, speed, damage, partial });
    },
    moveBody: (body, dx, dy, ignoreProps = false) => {
      moves.push({ dx, dy, ignoreProps });
      body.x += dx;
      body.y += dy;
    },
    slowEnemy: () => undefined,
    effectiveSpeed: (enemy) => enemy.speed * slowFactor,
  };
  return { state, ctx, moves, zones, projectiles, emits, damageCalls, setSlowFactor: value => { slowFactor = value; } };
}

function enemy(kind: Enemy['kind'], overrides: Partial<Enemy> = {}): Enemy {
  return {
    id: 101,
    kind,
    x: 300,
    y: 0,
    radius: 18,
    facing: 0,
    hp: 100,
    maxHp: 100,
    speed: 80,
    damage: 14,
    xp: 4,
    state: 'chase',
    stateTime: 0.25,
    hitFlash: 0.12,
    boss: false,
    attackCooldown: 2,
    vx: 0,
    vy: 0,
    ...overrides,
  };
}

function magnitude(call: MoveCall): number {
  return Math.hypot(call.dx, call.dy);
}

describe('P1 일반 적 훅 경계', () => {
  test('skeleton, bat, beetle만 처리하고 P0 적과 보스는 손대지 않는다', () => {
    for (const kind of ['slime', 'mushroom', 'goblin', 'mushroomKing', 'golem'] as const) {
      const { ctx, moves, zones } = fixture();
      const candidate = enemy(kind);
      const before = structuredClone(candidate);

      assert.equal(updateP1Enemy(candidate, 0.1, ctx), false, kind);
      assert.deepEqual(candidate, before, kind);
      assert.equal(moves.length, 0, kind);
      assert.equal(zones.length, 0, kind);
    }
  });

  test('공통 stateTime, attackCooldown, hitFlash는 훅에서 중복 갱신하지 않는다', () => {
    for (const kind of ['skeleton', 'bat', 'beetle'] as const) {
      const { ctx } = fixture();
      const candidate = enemy(kind, { x: 500, stateTime: 0.25, attackCooldown: 1.75, hitFlash: 0.12 });

      assert.equal(updateP1Enemy(candidate, 0.1, ctx), true);
      assert.equal(candidate.stateTime, 0.25, kind);
      assert.equal(candidate.attackCooldown, 1.75, kind);
      assert.equal(candidate.hitFlash, 0.12, kind);
    }
  });
});

describe('해골 거리 유지와 원거리 뼈 투사체', () => {
  test('근거리에서는 후퇴하고 유지 거리에서는 멈추며 원거리에서는 감속된 속도로 접근한다', () => {
    const nearFixture = fixture();
    const near = enemy('skeleton', { x: 150, speed: 80 });
    updateP1Enemy(near, 0.1, nearFixture.ctx);
    assert.ok(near.x > 150, `근거리 후퇴 x=${near.x}`);

    const holdFixture = fixture();
    const hold = enemy('skeleton', { x: 230, speed: 80 });
    updateP1Enemy(hold, 0.1, holdFixture.ctx);
    assert.equal(hold.x, 230);
    assert.equal(holdFixture.moves.length, 0);

    const farFixture = fixture();
    farFixture.setSlowFactor(0.5);
    const far = enemy('skeleton', { x: 360, speed: 80 });
    updateP1Enemy(far, 0.1, farFixture.ctx);
    assert.equal(magnitude(farFixture.moves[0]!), 4);
    assert.ok(far.x < 360);
  });

  test('피해 없는 조준 예고 뒤 고정 방향으로 뼈 볼트 3발을 한 번만 발사한다', () => {
    const { state, ctx, zones, projectiles, emits, damageCalls } = fixture();
    const skeleton = enemy('skeleton', { x: 350, attackCooldown: 0, damage: 17 });

    updateP1Enemy(skeleton, 0.1, ctx);
    assert.equal(skeleton.state, 'windup');
    assert.equal(skeleton.stateTime, 0);
    assert.equal(skeleton.attackCooldown, 3.25);
    const lockedAngle = Math.atan2(skeleton.vy, skeleton.vx);
    assert.deepEqual(
      zones.map(({ shape, radius, width, telegraph, duration, damage, owner, kind }) => ({ shape, radius, width, telegraph, duration, damage, owner, kind })),
      [{ shape: 'cone', radius: 420, width: 0.5, telegraph: 0.72, duration: 0.2, damage: 0, owner: 'enemy', kind: 'skeleton-aim' }],
    );
    assert.equal(projectiles.length, 0, '예고 시작과 동시에 투사체를 만들면 안 된다');
    assert.equal(damageCalls.length, 0, '예고 zone은 즉시 피해를 주면 안 된다');

    state.player.y = 200;
    skeleton.stateTime = 0.71;
    updateP1Enemy(skeleton, 0.1, ctx);
    assert.equal(projectiles.length, 0);
    skeleton.stateTime = 0.72;
    updateP1Enemy(skeleton, 0.1, ctx);
    assert.equal(skeleton.state, 'recover');
    assert.deepEqual(
      projectiles.map(({ weapon, owner, speed, damage, partial }) => ({ weapon, owner, speed, damage, partial })),
      [
        { weapon: 'arrow', owner: 'enemy', speed: 240, damage: 17, partial: { kind: 'bone', radius: 6, life: 2.5 } },
        { weapon: 'arrow', owner: 'enemy', speed: 240, damage: 17, partial: { kind: 'bone', radius: 6, life: 2.5 } },
        { weapon: 'arrow', owner: 'enemy', speed: 240, damage: 17, partial: { kind: 'bone', radius: 6, life: 2.5 } },
      ],
    );
    assert.deepEqual(projectiles.map(({ angle }) => angle), [lockedAngle - 0.1, lockedAngle, lockedAngle + 0.1]);
    assert.notEqual(skeleton.facing, lockedAngle, '플레이어 이동으로 현재 facing은 바뀌어야 함');
    assert.deepEqual(emits, [{ type: 'attack', kind: 'enemy-bone-launch', angle: lockedAngle }]);

    updateP1Enemy(skeleton, 0.1, ctx);
    assert.equal(projectiles.length, 3, '회복 상태에서 같은 발사를 반복하면 안 된다');
    assert.equal(emits.length, 1);
    skeleton.stateTime = 0.38;
    updateP1Enemy(skeleton, 0.1, ctx);
    assert.equal(skeleton.state, 'chase');
  });
});

describe('박쥐 곡선 추적과 물체 통과 급강하', () => {
  test('추적 이동은 곡선을 만들고 effectiveSpeed를 사용하며 solid prop을 무시한다', () => {
    const { ctx, moves, setSlowFactor } = fixture();
    setSlowFactor(0.5);
    const bat = enemy('bat', { x: 300, y: 0, speed: 90, attackCooldown: 2, stateTime: 0.2 });

    updateP1Enemy(bat, 0.2, ctx);

    assert.equal(moves.length, 1);
    assert.equal(moves[0]!.ignoreProps, true);
    assert.ok(Math.abs(moves[0]!.dy) > 0.01, `곡선 횡이동 dy=${moves[0]!.dy}`);
    assert.ok(Math.abs(magnitude(moves[0]!) - 9) < 1e-9, `감속 이동량=${magnitude(moves[0]!)}`);
  });

  test('선형 예고 뒤 급강하하고 회복 후 추적으로 돌아온다', () => {
    const { ctx, moves, zones, setSlowFactor } = fixture();
    setSlowFactor(0.5);
    const bat = enemy('bat', { x: 260, speed: 80, attackCooldown: 0 });

    updateP1Enemy(bat, 0.1, ctx);
    assert.equal(bat.state, 'windup');
    assert.deepEqual(
      zones.map(({ shape, length, width, telegraph, duration, damage, kind }) => ({ shape, length, width, telegraph, duration, damage, kind })),
      [{ shape: 'line', length: 235, width: 24, telegraph: 0.38, duration: 0.42, damage: 0, kind: 'bat-swoop' }],
    );

    bat.stateTime = 0.38;
    updateP1Enemy(bat, 0.1, ctx);
    assert.equal(bat.state, 'attack');
    bat.stateTime = 0.2;
    updateP1Enemy(bat, 0.1, ctx);
    assert.equal(moves.at(-1)!.ignoreProps, true);
    assert.ok(Math.abs(magnitude(moves.at(-1)!) - 10.6) < 1e-9);

    bat.stateTime = 0.42;
    updateP1Enemy(bat, 0.1, ctx);
    assert.equal(bat.state, 'recover');
    bat.stateTime = 0.5;
    updateP1Enemy(bat, 0.1, ctx);
    assert.equal(bat.state, 'chase');
  });

  test('동일한 개체 상태는 별도 실행에서도 같은 곡선 이동을 만든다', () => {
    const left = fixture();
    const right = fixture();
    const leftBat = enemy('bat', { id: 77, stateTime: 1.25 });
    const rightBat = enemy('bat', { id: 77, stateTime: 1.25 });

    updateP1Enemy(leftBat, 0.1, left.ctx);
    updateP1Enemy(rightBat, 0.1, right.ctx);

    assert.deepEqual(left.moves, right.moves);
    assert.deepEqual(leftBat, rightBat);
  });
});

describe('딱정벌레의 묵직한 예고 돌진', () => {
  test('넓고 긴 예고 뒤 effectiveSpeed 기반 돌진을 하며 solid prop 충돌을 유지한다', () => {
    const { ctx, moves, zones, setSlowFactor } = fixture();
    setSlowFactor(0.4);
    const beetle = enemy('beetle', { x: 280, speed: 70, attackCooldown: 0 });

    updateP1Enemy(beetle, 0.1, ctx);
    assert.equal(beetle.state, 'windup');
    assert.equal(beetle.attackCooldown, 4.6);
    assert.deepEqual(
      zones.map(({ shape, length, width, telegraph, duration, damage, kind }) => ({ shape, length, width, telegraph, duration, damage, kind })),
      [{ shape: 'line', length: 215, width: 48, telegraph: 1.05, duration: 0.68, damage: 0, kind: 'beetle-charge' }],
    );

    beetle.stateTime = 1.05;
    updateP1Enemy(beetle, 0.1, ctx);
    assert.equal(beetle.state, 'attack');
    beetle.stateTime = 0.2;
    updateP1Enemy(beetle, 0.1, ctx);
    assert.equal(moves.at(-1)!.ignoreProps, false);
    assert.ok(Math.abs(magnitude(moves.at(-1)!) - 8.82) < 1e-9, `돌진 이동량=${magnitude(moves.at(-1)!)}`);

    beetle.stateTime = 0.68;
    updateP1Enemy(beetle, 0.1, ctx);
    assert.equal(beetle.state, 'recover');
    beetle.stateTime = 0.78;
    updateP1Enemy(beetle, 0.1, ctx);
    assert.equal(beetle.state, 'chase');
  });
});
