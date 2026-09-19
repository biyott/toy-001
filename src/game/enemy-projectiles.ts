import type { Player, Projectile } from '../types';

export type EnemyProjectileImpact =
  | { type: 'direct'; damage: number; x: number; y: number }
  | { type: 'splash'; damage: number; x: number; y: number; radius: number; kind: 'spore-burst' };

/** First contact along a segment, including a projectile already touching. */
function contactFraction(x: number, y: number, dx: number, dy: number, radius: number): number | null {
  const length = Math.hypot(dx, dy);
  if (Math.hypot(x, y) <= radius) return 0;
  if (length === 0) return null;
  const ux = dx / length, uy = dy / length;
  const along = -(x * ux + y * uy);
  const perpendicular = Math.abs(x * uy - y * ux);
  if (along < 0 || perpendicular > radius) return null;
  const halfChord = Math.sqrt(Math.max(0, (radius - perpendicular) * (radius + perpendicular)));
  const entry = along - halfChord;
  return Number.isFinite(entry) && entry >= 0 && entry <= length ? entry / length : null;
}

/** Owns enemy flight only. Engine applies returned damage through its usual rules. */
export function stepEnemyProjectile(projectile: Projectile, dt: number, player: Player): EnemyProjectileImpact | null {
  if (projectile.owner !== 'enemy' || !Number.isFinite(dt) || dt <= 0) return null;
  if (![projectile.x, projectile.y, projectile.vx, projectile.vy, projectile.radius,
    projectile.damage, projectile.life, player.x, player.y, player.radius].every(Number.isFinite)
    || projectile.life <= 0 || projectile.radius < 0 || player.radius < 0 || projectile.damage < 0) {
    projectile.life = 0;
    return null;
  }
  const royal = projectile.kind === 'royal-spore';
  if (royal && (!Number.isFinite(projectile.targetX) || !Number.isFinite(projectile.targetY)
    || !Number.isFinite(projectile.splashRadius) || projectile.splashRadius! <= 0)) {
    projectile.life = 0;
    return null;
  }

  // Never sweep beyond the part of this frame for which the projectile is alive.
  const flightTime = Math.min(dt, projectile.life);
  let dx = projectile.vx * flightTime, dy = projectile.vy * flightTime;
  let arrived = false;
  if (royal) {
    const targetDx = projectile.targetX! - projectile.x;
    const targetDy = projectile.targetY! - projectile.y;
    const distance = Math.hypot(targetDx, targetDy);
    const travel = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || !Number.isFinite(travel)) { projectile.life = 0; return null; }
    arrived = distance <= travel;
    // Aim at the saved target, never at the player's current position.
    const fraction = distance > 0 ? Math.min(1, travel / distance) : 0;
    dx = targetDx * fraction;
    dy = targetDy * fraction;
  }
  const endX = projectile.x + dx, endY = projectile.y + dy;
  const relativeX = projectile.x - player.x, relativeY = projectile.y - player.y;
  const radius = projectile.radius + player.radius;
  if (![dx, dy, endX, endY, relativeX, relativeY, radius, Math.hypot(dx, dy)].every(Number.isFinite)) {
    projectile.life = 0;
    return null;
  }
  const contact = contactFraction(relativeX, relativeY, dx, dy, radius);
  projectile.x += dx * (contact ?? 1);
  projectile.y += dy * (contact ?? 1);
  projectile.life = Math.max(0, projectile.life - dt);
  if (contact === null && !arrived) return null;

  // Consumption before returning makes repeated calls idempotent, including
  // contacts against invulnerable players. Invulnerability belongs to engine.
  projectile.life = 0;
  if (royal) return { type: 'splash', damage: projectile.damage, x: projectile.x, y: projectile.y,
    radius: projectile.splashRadius!, kind: 'spore-burst' };
  return { type: 'direct', damage: projectile.damage, x: projectile.x, y: projectile.y };
}
