import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { onP1ProjectileHit, updateP1Weapon } from '../src/game/p1-weapons.ts';
import type { P1Context } from '../src/game/p1-context.ts';
import type { Enemy, GameEvent, GameState, Projectile, Vec2, WeaponId, WeaponState } from '../src/types.ts';

function enemy(id: number, x: number, y = 0): Enemy {
  return { id, x, y, radius: 10, facing: 0, kind: 'slime', hp: 1_000, maxHp: 1_000,
    speed: 40, damage: 1, xp: 1, state: 'chase', stateTime: 0, hitFlash: 0,
    boss: false, attackCooldown: 0, vx: 0, vy: 0 };
}

// Isolated contract fixture, not an engine or normal-play validation.
function fixture(enemies: Enemy[] = [], power = 1, haste = 1) {
  const state: GameState = {
    phase: 'playing', mode: 'normal', seed: 1, contentTier: 1, elapsed: 0, duration: 600,
    player: { id: 1, x: 0, y: 0, radius: 16, facing: 0, character: 'knight', hp: 120, maxHp: 120,
      xp: 0, xpToNext: 10, level: 1, speed: 100, invulnerable: 0, dashCooldown: 0,
      dashTime: 0, hitFlash: 0, moving: false, upgrades: {} },
    enemies, projectiles: [], pickups: [], zones: [], props: [], weapons: [], upgradeChoices: [],
    stats: { kills: 0, damageDealt: 0, damageTaken: 0, score: 0, gems: 0, bossesDefeated: 0, maxEnemies: 0 },
    world: { halfWidth: 1000, halfHeight: 750 }, bossSpawned: false, bossDefeated: false, message: '', synergies: [],
  };
  let nextId = 10_000;
  const hits: { id: number; damage: number; weapon: WeaponId; source: Vec2 }[] = [];
  const slows: { id: number; seconds: number; factor: number }[] = [];
  const events: GameEvent[] = [];
  const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
  const ctx: P1Context = {
    state, random: () => .5, upgrade: id => state.player.upgrades[id] ?? 0,
    power: () => power, haste: () => haste,
    nearest(position, range = 700, excluded = []) {
      return state.enemies.filter(target => target.hp > 0 && !excluded.includes(target.id)
        && distance(position, target) < range).sort((a, b) => distance(position, a) - distance(position, b))[0];
    },
    nearby: (position, range) => state.enemies.filter(target => distance(position, target) <= range),
    damageEnemy(target, damage, weapon, source) {
      hits.push({ id: target.id, damage, weapon, source: { ...source } });
      state.stats.damageDealt += Math.min(target.hp, damage);
      target.hp -= damage;
    },
    emit(type, position, detail = {}) { events.push({ id: nextId++, x: position.x, y: position.y, type, ...detail }); },
    addZone(partial) { const zone = { ...partial, id: nextId++, hitIds: [] }; state.zones.push(zone); return zone; },
    addProjectile(weapon, owner, position, angle, speed, damage, partial = {}) {
      state.projectiles.push({ id: nextId++, x: position.x, y: position.y, radius: 6, facing: angle,
        weapon, owner, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        damage, life: 2.2, pierce: 0, hitIds: [], generation: 0, ...partial });
    },
    moveBody(body, dx, dy) { body.x += dx; body.y += dy; },
    slowEnemy(target, seconds, factor) { slows.push({ id: target.id, seconds, factor }); },
    effectiveSpeed: target => target.speed,
  };
  return { state, ctx, hits, slows, events };
}

function weapon(id: WeaponId, level = 1): WeaponState { return { id, level, cooldown: 0, angle: 0 }; }

describe('P1 weapon extension contract', () => {
  test('P0 is untouched and cooldown is advanced only by the engine', () => {
    const f = fixture([enemy(2, 40)]);
    for (const id of ['sword', 'arrow', 'spirit'] as const) {
      const original = weapon(id);
      assert.equal(updateP1Weapon(original, 10, f.ctx), false);
      assert.deepEqual(original, weapon(id));
    }
    for (const id of ['lightning', 'frost', 'fireball'] as const) {
      const waiting = { ...weapon(id), cooldown: .01 };
      assert.equal(updateP1Weapon(waiting, 10, f.ctx), true);
      assert.equal(waiting.cooldown, .01);
    }
    assert.equal(f.hits.length + f.state.zones.length + f.state.projectiles.length + f.events.length, 0);
  });

  test('lightning chains from each previous target without repeats and is bounded at level five', () => {
    const f = fixture(Array.from({ length: 20 }, (_, i) => enemy(i + 2, 60 + i * 170)));
    updateP1Weapon(weapon('lightning', 5), .01, f.ctx);
    assert.deepEqual(f.hits.map(hit => hit.id), [2, 3, 4, 5]);
    assert.deepEqual(f.hits.map(hit => hit.source.x), [0, 60, 230, 400]);
    assert.equal(f.hits[0].damage, 74);
    assert.ok(f.hits[3].damage < f.hits[0].damage);
    assert.equal(f.events.filter(event => event.weapon === 'lightning' && event.targetX !== undefined).length, 4);
    assert.equal(f.state.projectiles.length + f.state.zones.length, 0);

    const disconnected = fixture([enemy(2, 60), enemy(3, 400), enemy(4, 1_000)]);
    updateP1Weapon(weapon('lightning'), .01, disconnected.ctx);
    assert.deepEqual(disconnected.hits.map(hit => hit.id), [2], 'A gap larger than chain range ends the chain');
  });

  test('frost creates visible damage geometry and slows living overlapping bodies only', () => {
    const dead = { ...enemy(4, 40), hp: 0 };
    const f = fixture([enemy(2, 50), enemy(3, 123), dead, enemy(5, 125)]);
    updateP1Weapon(weapon('frost'), .01, f.ctx);
    assert.equal(f.state.zones.length, 1);
    const zone = f.state.zones[0];
    assert.equal(zone.kind, 'frost');
    assert.equal(zone.shape, 'circle');
    assert.equal(zone.radius, 114);
    assert.equal(zone.damage, 19);
    assert.equal(zone.telegraph, 0);
    assert.ok(zone.duration > 0);
    assert.deepEqual(f.slows.map(slow => slow.id), [2, 3]);
    assert.ok(f.slows.every(slow => slow.seconds > 1 && slow.factor > 0 && slow.factor < 1));
    assert.ok(f.events.some(event => event.kind === 'ice' && event.weapon === 'frost' && event.radius === zone.radius));
    assert.equal(f.hits.length, 0, 'Circle damage is left to the engine, avoiding a duplicate direct hit');
  });

  test('fireball aims at a target and creates just one bounded explosion after its direct hit', () => {
    const primary = enemy(2, 0, 60);
    const f = fixture([primary, enemy(3, 10, 60)]);
    updateP1Weapon(weapon('fireball', 5), .01, f.ctx);
    assert.equal(f.state.projectiles.length, 1);
    const projectile = f.state.projectiles[0];
    assert.ok(Math.abs(projectile.vx) < 1e-9);
    assert.equal(projectile.vy, 370);
    assert.equal(projectile.damage, 84);
    projectile.x = primary.x; projectile.y = primary.y;
    projectile.hitIds.push(primary.id);
    onP1ProjectileHit(projectile, primary, f.ctx);
    onP1ProjectileHit(projectile, f.state.enemies[1], f.ctx);
    assert.equal(projectile.life, 0);
    assert.equal(projectile.generation, 1);
    assert.equal(f.state.zones.length, 1);
    assert.equal(f.state.zones[0].kind, 'fireball');
    assert.equal(f.state.zones[0].radius, 96);
    assert.equal(f.state.zones[0].damage, 84 * .8);
    assert.deepEqual(f.state.zones[0].hitIds, [primary.id]);
    assert.equal(f.events.filter(event => event.kind === 'explosion').length, 1);
    assert.equal(f.hits.length, 0, 'Engine owns direct and area damage accounting');
  });

  test('expired, enemy-owned, subsequent-generation and other projectiles cannot explode', () => {
    const target = enemy(2, 50);
    const f = fixture([target]);
    updateP1Weapon(weapon('fireball'), .01, f.ctx);
    const projectile = f.state.projectiles[0];
    for (const partial of [{ life: 0 }, { owner: 'enemy' }, { generation: 1 }, { weapon: 'arrow' }] as Partial<Projectile>[]) {
      onP1ProjectileHit({ ...projectile, ...partial }, target, f.ctx);
    }
    assert.equal(f.state.zones.length, 0);
    assert.equal(f.events.filter(event => event.kind === 'explosion').length, 0);
  });

  test('all three weapons gain damage with levels and obey shared power and haste', () => {
    for (const id of ['lightning', 'frost', 'fireball'] as const) {
      const base = fixture([enemy(2, 60)]);
      const high = fixture([enemy(2, 60)]);
      const buffed = fixture([enemy(2, 60)], 1.36, .7);
      const weapons = [weapon(id), weapon(id, 5), weapon(id)];
      [base, high, buffed].forEach((f, index) => updateP1Weapon(weapons[index], .01, f.ctx));
      const output = (f: ReturnType<typeof fixture>) => id === 'lightning' ? f.hits[0].damage
        : id === 'frost' ? f.state.zones[0].damage : f.state.projectiles[0].damage;
      assert.ok(output(high) > output(base), `${id} level damage`);
      assert.equal(output(buffed), output(base) * 1.36, `${id} power`);
      assert.ok(weapons[1].cooldown < weapons[0].cooldown, `${id} level cadence`);
      assert.equal(weapons[2].cooldown, weapons[0].cooldown * .7, `${id} haste`);
      if (id === 'frost') {
        assert.ok(high.state.zones[0].radius > base.state.zones[0].radius);
        assert.ok(high.slows[0].seconds > base.slows[0].seconds);
        assert.ok(high.slows[0].factor < base.slows[0].factor);
      }
      if (id === 'fireball') assert.ok(high.state.projectiles[0].radius > base.state.projectiles[0].radius);
    }
  });

  test('an empty field schedules a short retry without producing attacks or leaking state', () => {
    const empty = fixture();
    for (const id of ['lightning', 'frost', 'fireball'] as const) {
      const idle = weapon(id);
      updateP1Weapon(idle, .01, empty.ctx);
      assert.equal(idle.cooldown, .1);
    }
    assert.equal(empty.hits.length + empty.state.projectiles.length + empty.state.zones.length + empty.events.length, 0);
    const first = fixture([enemy(2, 50)]);
    const second = fixture([enemy(2, 50)]);
    updateP1Weapon(weapon('lightning'), .01, first.ctx);
    updateP1Weapon(weapon('lightning'), .01, second.ctx);
    assert.deepEqual(first.hits, second.hits, 'Separate runs do not share visited enemies or attack state');
  });
});
