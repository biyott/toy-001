import type { Enemy, Projectile, Vec2, WeaponState } from '../types';
import type { P1Context } from './p1-context';

/** Returns true for a P1 weapon, including while it is waiting to attack. */
export function updateP1Weapon(weapon: WeaponState, _dt: number, ctx: P1Context): boolean {
  if (weapon.id !== 'lightning' && weapon.id !== 'frost' && weapon.id !== 'fireball') return false;
  // The engine already advances cooldowns. Do not advance them a second time here.
  if (weapon.cooldown > 0) return true;
  const level = Math.max(1, Math.min(5, weapon.level));
  const player = ctx.state.player;

  if (weapon.id === 'frost') {
    const radius = 100 + level * 14;
    // Nearby is a broad-phase query; use the same body overlap as circle damage.
    const targets = ctx.nearby(player, radius + 64).filter(enemy => enemy.hp > 0
      && Math.hypot(enemy.x - player.x, enemy.y - player.y) <= radius + enemy.radius);
    if (!targets.length) { weapon.cooldown = .1; return true; }
    weapon.cooldown = (2.8 - level * .18) * ctx.haste();
    ctx.addZone({ x: player.x, y: player.y, shape: 'circle', radius, angle: 0,
      telegraph: 0, duration: .45, damage: (12 + level * 7) * ctx.power(), owner: 'player', kind: 'frost' });
    for (const enemy of targets) ctx.slowEnemy(enemy, 1.2 + level * .2, .62 - level * .025);
    ctx.emit('attack', player, { weapon: 'frost', kind: 'ice', radius });
    return true;
  }

  const target = ctx.nearest(player, 680);
  if (!target) { weapon.cooldown = .1; return true; }
  if (weapon.id === 'lightning') {
    weapon.cooldown = (1.65 - level * .1) * ctx.haste();
    const visited: number[] = [];
    let source: Vec2 = player;
    let next: Enemy | undefined = target;
    const count = 2 + Math.floor(level / 2);
    for (let i = 0; i < count && next; i++) {
      visited.push(next.id);
      ctx.damageEnemy(next, (24 + level * 10) * ctx.power() * .85 ** i, 'lightning', source);
      ctx.emit('attack', source, { weapon: 'lightning', targetX: next.x, targetY: next.y });
      source = next;
      next = ctx.nearest(source, 170 + level * 10, visited);
    }
    return true;
  }

  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  weapon.cooldown = (1.6 - level * .12) * ctx.haste();
  ctx.addProjectile('fireball', 'player', player, angle, 320 + level * 10,
    (24 + level * 12) * ctx.power(), { radius: 7 + level, life: 2.2, pierce: 0, generation: 0 });
  ctx.emit('attack', player, { weapon: 'fireball', angle });
  return true;
}

/** Called after the engine applies a projectile's direct hit, before retiring it. */
export function onP1ProjectileHit(projectile: Projectile, enemy: Enemy, ctx: P1Context): void {
  if (projectile.weapon !== 'fireball' || projectile.owner !== 'player'
    || projectile.generation !== 0 || projectile.life <= 0) return;
  // Mark consumed before producing effects, even if several enemies overlap.
  projectile.generation = 1;
  projectile.life = 0;
  projectile.pierce = 0;
  // Radius and damage were captured at launch, so mid-flight upgrades cannot
  // retroactively change the blast. Clamp the radius to the supported levels.
  const radius = Math.max(64, Math.min(96, projectile.radius * 8));
  const zone = ctx.addZone({ x: projectile.x, y: projectile.y, shape: 'circle', radius,
    angle: 0, telegraph: 0, duration: .24, damage: projectile.damage * .8, owner: 'player', kind: 'fireball' });
  // The first victim has already taken the stronger direct hit.
  zone.hitIds.push(enemy.id);
  ctx.emit('attack', projectile, { weapon: 'fireball', kind: 'explosion', radius });
}
