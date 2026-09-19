import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { stepEnemyProjectile } from '../src/game/enemy-projectiles.ts';
import type { Player, Projectile } from '../src/types.ts';

function player(partial: Partial<Player> = {}): Player {
  return { id: 1, x: 300, y: 0, radius: 10, facing: 0, character: 'knight', hp: 120, maxHp: 120,
    xp: 0, xpToNext: 10, level: 1, speed: 180, invulnerable: 0, dashCooldown: 0, dashTime: 0,
    hitFlash: 0, dashCharges: 2, dashMaxCharges: 2, dashRechargeRemaining: 0,
    dashRechargeDuration: 3, dashReuseDelay: 0, moving: false, upgrades: {}, ...partial };
}

function shot(partial: Partial<Projectile> = {}): Projectile {
  return { id: 2, x: 0, y: 0, radius: 8, facing: 0, weapon: 'arrow', owner: 'enemy',
    vx: 200, vy: 0, damage: 15, life: 3, pierce: 0, hitIds: [], generation: 0,
    kind: 'spore', ...partial };
}

function royal(partial: Partial<Projectile> = {}): Projectile {
  return shot({ kind: 'royal-spore', targetX: 100, targetY: 0, splashRadius: 88, ...partial });
}

describe('enemy projectile flight, isolated module fixtures', () => {
  test('spores and bones travel visibly without causing distant or launch-time damage', () => {
    for (const kind of ['spore', 'bone'] as const) {
      const target = player();
      const beforePlayer = structuredClone(target);
      const projectile = shot({ kind });
      for (let frame = 0; frame < 10; frame++) assert.equal(stepEnemyProjectile(projectile, .05, target), null);
      assert.equal(projectile.x, 100);
      assert.equal(projectile.y, 0);
      assert.ok(Math.abs(projectile.life - 2.5) < 1e-12);
      assert.deepEqual(target, beforePlayer, 'Flight never mutates player health or state');
    }
  });

  test('swept collision catches a fast shot that crosses a player within one normal frame', () => {
    const target = player({ x: 100 });
    const projectile = shot({ kind: 'bone', vx: 4_000 });
    const impact = stepEnemyProjectile(projectile, .05, target);
    assert.deepEqual(impact, { type: 'direct', damage: 15, x: 82, y: 0 });
    assert.equal(projectile.life, 0);
    assert.equal(target.hp, 120);
    assert.equal(stepEnemyProjectile(projectile, .05, target), null, 'A consumed shot cannot hit again');
  });

  test('near misses do not hit, while exact tangency and diagonal contact do', () => {
    const target = player({ x: 100 });
    const miss = shot({ y: 18.001, vx: 4_000 });
    assert.equal(stepEnemyProjectile(miss, .05, target), null);
    assert.equal(miss.x, 200);
    assert.ok(miss.life > 0);
    const tangent = shot({ y: 18, vx: 4_000 });
    assert.deepEqual(stepEnemyProjectile(tangent, .05, target), { type: 'direct', damage: 15, x: 100, y: 18 });
    const diagonal = shot({ vx: 4_000, vy: 4_000 });
    const impact = stepEnemyProjectile(diagonal, .05, player({ x: 100, y: 100 }));
    assert.equal(impact?.type, 'direct');
    assert.ok(Math.abs(Math.hypot(diagonal.x - 100, diagonal.y - 100) - 18) < 1e-10);
    assert.equal(diagonal.x, diagonal.y);
  });

  test('a player behind a departing shot is not hit', () => {
    const projectile = shot();
    assert.equal(stepEnemyProjectile(projectile, .05, player({ x: -40 })), null);
    assert.equal(projectile.x, 10);
  });

  test('royal spores fly toward a fixed target then explode exactly once despite overshoot', () => {
    const projectile = royal();
    const target = player({ x: 900, y: 300 });
    assert.equal(stepEnemyProjectile(projectile, .05, target), null);
    assert.equal(projectile.x, 10);
    target.x = -500;
    assert.equal(stepEnemyProjectile(projectile, .05, target), null);
    assert.equal(projectile.x, 20, 'Player movement does not redirect the saved target');
    assert.equal(projectile.y, 0);
    const impact = stepEnemyProjectile(projectile, 1, target);
    assert.deepEqual(impact, { type: 'splash', damage: 15, x: 100, y: 0, radius: 88, kind: 'spore-burst' });
    assert.equal(projectile.life, 0);
    assert.equal(stepEnemyProjectile(projectile, 1, target), null);
  });

  test('royal player contact takes precedence over later arrival and returns splash only', () => {
    const projectile = royal({ vx: 4_000 });
    const target = player({ x: 60 });
    const impact = stepEnemyProjectile(projectile, .05, target);
    assert.deepEqual(impact, { type: 'splash', damage: 15, x: 42, y: 0, radius: 88, kind: 'spore-burst' });
    assert.equal(projectile.life, 0);
    assert.equal(target.hp, 120, 'Explosion damage is left to engine zone processing');
    assert.equal(stepEnemyProjectile(projectile, .05, target), null);
  });

  test('royal arrival truncates the sweep, so players beyond the target cannot intercept it', () => {
    const projectile = royal({ vx: 4_000 });
    const impact = stepEnemyProjectile(projectile, .05, player({ x: 150 }));
    assert.equal(impact?.type, 'splash');
    assert.equal(impact?.x, 100);
  });

  test('TTL expiry retires both direct and royal projectiles without airburst or post-expiry collision', () => {
    for (const projectile of [shot({ life: .01 }), royal({ life: .01 })]) {
      assert.equal(stepEnemyProjectile(projectile, 1, player({ x: 50 })), null);
      assert.equal(projectile.x, 2, 'Movement stops at expiration time instead of using the whole frame');
      assert.equal(projectile.life, 0);
      assert.equal(stepEnemyProjectile(projectile, 1, player({ x: 2 })), null);
    }
    const contactBeforeExpiry = shot({ life: .02, vx: 4_000 });
    assert.equal(stepEnemyProjectile(contactBeforeExpiry, 1, player({ x: 60 }))?.type, 'direct');
  });

  test('engine owns invulnerability; contact still consumes the projectile without changing the player', () => {
    const target = player({ x: 30, invulnerable: 10, dashTime: .2 });
    const before = structuredClone(target);
    const projectile = shot();
    assert.equal(stepEnemyProjectile(projectile, .1, target)?.type, 'direct');
    assert.equal(projectile.life, 0);
    assert.deepEqual(target, before);
  });

  test('stationary and already-overlapping projectiles remain finite and deterministic', () => {
    const stationary = shot({ vx: 0, vy: 0 });
    assert.equal(stepEnemyProjectile(stationary, .05, player()), null);
    assert.equal(stationary.x, 0);
    assert.equal(stationary.life, 2.95);
    assert.equal(stepEnemyProjectile(shot(), .05, player({ x: 0 }))?.type, 'direct');
    const alreadyArrived = royal({ x: 100, vx: 0 });
    assert.equal(stepEnemyProjectile(alreadyArrived, .05, player())?.type, 'splash');
  });

  test('invalid numeric payloads retire safely without damage, and zero or invalid dt does nothing', () => {
    for (const partial of [{ x: NaN }, { vx: Infinity }, { life: NaN }, { damage: Infinity },
      { radius: -1 }, { vx: Number.MAX_VALUE, vy: Number.MAX_VALUE }] as Partial<Projectile>[]) {
      const projectile = shot(partial);
      assert.equal(stepEnemyProjectile(projectile, 2, player()), null);
      assert.equal(projectile.life, 0);
    }
    for (const partial of [{ targetX: undefined }, { targetY: Infinity }, { splashRadius: 0 }]) {
      const projectile = royal(partial);
      assert.equal(stepEnemyProjectile(projectile, .05, player()), null);
      assert.equal(projectile.life, 0);
    }
    for (const dt of [0, -1, Infinity, NaN]) {
      const projectile = shot();
      const before = structuredClone(projectile);
      assert.equal(stepEnemyProjectile(projectile, dt, player()), null);
      assert.deepEqual(projectile, before);
    }
  });

  test('player-owned projectiles are untouched and independent shots share no consumed state', () => {
    const own = shot({ owner: 'player' });
    const before = structuredClone(own);
    assert.equal(stepEnemyProjectile(own, .05, player({ x: 0 })), null);
    assert.deepEqual(own, before);
    const first = stepEnemyProjectile(shot(), .05, player({ x: 0 }));
    const second = stepEnemyProjectile(shot(), .05, player({ x: 0 }));
    assert.deepEqual(first, second);
  });
});
