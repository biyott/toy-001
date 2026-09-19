import type { Enemy } from '../types';
import type { P1Context } from './p1-context';

const SHOCKWAVE = { windup: 1.25, active: .32 };
const FISSURE = { windup: 1.1, active: .28 };
const RECOVERY = .7;

/**
 * The engine advances common timers and handles contact/zone damage once.
 * For golems only, vx holds the next pattern (0 = ring, 1 = fissure), and vy
 * holds the locked facing angle. No per-run state survives outside the enemy.
 */
export function updateP1Boss(enemy: Enemy, dt: number, ctx: P1Context): boolean {
  if (enemy.kind !== 'golem') return false;
  if (enemy.hp <= 0) return true;

  if (enemy.state === 'windup' || enemy.state === 'attack' || enemy.state === 'recover') {
    enemy.facing = enemy.vy;
    const timing = enemy.vx === 1 ? SHOCKWAVE : FISSURE;
    if (enemy.state === 'windup' && enemy.stateTime >= timing.windup) {
      enemy.state = 'attack';
      enemy.stateTime = 0;
    } else if (enemy.state === 'attack' && enemy.stateTime >= timing.active) {
      enemy.state = 'recover';
      enemy.stateTime = 0;
    } else if (enemy.state === 'recover' && enemy.stateTime >= RECOVERY) {
      enemy.state = 'chase';
      enemy.stateTime = 0;
    }
    return true;
  }

  const player = ctx.state.player;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const distance = Math.hypot(dx, dy);
  enemy.facing = Math.atan2(dy, dx);

  if (enemy.attackCooldown <= 0) {
    const fissure = enemy.vx === 1;
    enemy.vx = fissure ? 0 : 1;
    enemy.vy = enemy.facing;
    enemy.state = 'windup';
    enemy.stateTime = 0;
    enemy.attackCooldown = enemy.hp < enemy.maxHp * .4 ? 3.6 : 4.6;
    if (fissure) {
      ctx.addZone({ x: enemy.x, y: enemy.y, shape: 'line', radius: 390,
        length: 390, width: 60, angle: enemy.vy, telegraph: FISSURE.windup,
        duration: FISSURE.active, damage: 29, owner: 'enemy', kind: 'golem-fissure' });
    } else {
      ctx.addZone({ x: enemy.x, y: enemy.y, shape: 'ring', radius: 220,
        innerRadius: 100, angle: 0, telegraph: SHOCKWAVE.windup,
        duration: SHOCKWAVE.active, damage: 26, owner: 'enemy', kind: 'golem-shockwave' });
    }
    return true;
  }

  enemy.state = 'chase';
  // Leave a small inner pocket reachable without overlapping the boss body.
  if (distance > Math.max(90, enemy.radius + player.radius + 8)) {
    const step = Math.min(distance - 90, ctx.effectiveSpeed(enemy) * dt);
    ctx.moveBody(enemy, dx / distance * step, dy / distance * step);
  }
  return true;
}
