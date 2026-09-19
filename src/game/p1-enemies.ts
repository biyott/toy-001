import type { Enemy } from '../types';
import type { P1Context } from './p1-context';

type TargetVector = {
  distance: number;
  nx: number;
  ny: number;
};

function targetVector(enemy: Enemy, ctx: P1Context): TargetVector {
  const dx = ctx.state.player.x - enemy.x;
  const dy = ctx.state.player.y - enemy.y;
  const rawDistance = Math.hypot(dx, dy);
  const distance = Math.max(1, rawDistance);
  enemy.facing = rawDistance > 0 ? Math.atan2(dy, dx) : enemy.facing;
  return { distance, nx: dx / distance, ny: dy / distance };
}

function speedFor(enemy: Enemy, ctx: P1Context): number {
  const speed = ctx.effectiveSpeed(enemy);
  return Number.isFinite(speed) ? Math.max(0, speed) : 0;
}

function move(
  enemy: Enemy,
  dt: number,
  ctx: P1Context,
  x: number,
  y: number,
  speed: number,
  ignoreProps = false,
): void {
  const duration = Number.isFinite(dt) && dt > 0 ? dt : 0;
  ctx.moveBody(enemy, x * speed * duration, y * speed * duration, ignoreProps);
}

function updateSkeleton(enemy: Enemy, dt: number, ctx: P1Context): void {
  const target = targetVector(enemy, ctx);
  const speed = speedFor(enemy, ctx);

  if (enemy.state === 'windup') {
    if (enemy.stateTime >= 0.72) {
      enemy.state = 'recover';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'recover') {
    if (target.distance < 235) move(enemy, dt, ctx, -target.nx, -target.ny, speed * 0.32);
    if (enemy.stateTime >= 0.38) {
      enemy.state = 'chase';
      enemy.stateTime = 0;
    }
    return;
  }

  if (enemy.attackCooldown <= 0 && target.distance < 460) {
    enemy.attackCooldown = 3.25;
    enemy.state = 'windup';
    enemy.stateTime = 0;
    ctx.addZone({
      x: enemy.x,
      y: enemy.y,
      shape: 'cone',
      radius: 420,
      angle: enemy.facing,
      width: 0.5,
      telegraph: 0.72,
      duration: 0.2,
      damage: enemy.damage,
      owner: 'enemy',
      kind: 'skeleton-volley',
    });
    return;
  }

  enemy.state = 'chase';
  if (target.distance < 185) move(enemy, dt, ctx, -target.nx, -target.ny, speed * 0.72);
  else if (target.distance > 285) move(enemy, dt, ctx, target.nx, target.ny, speed);
}

function curvedBatMove(enemy: Enemy, dt: number, ctx: P1Context, scale: number): void {
  const target = targetVector(enemy, ctx);
  const wave = Math.sin(enemy.stateTime * 4.2 + enemy.id * 0.73);
  const curve = 0.52 * wave;
  const x = target.nx - target.ny * curve;
  const y = target.ny + target.nx * curve;
  const magnitude = Math.hypot(x, y) || 1;
  move(enemy, dt, ctx, x / magnitude, y / magnitude, speedFor(enemy, ctx) * scale, true);
}

function updateBat(enemy: Enemy, dt: number, ctx: P1Context): void {
  const target = targetVector(enemy, ctx);

  if (enemy.state === 'windup') {
    if (enemy.stateTime >= 0.38) {
      enemy.state = 'attack';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'attack') {
    move(enemy, dt, ctx, enemy.vx, enemy.vy, speedFor(enemy, ctx) * 2.65, true);
    if (enemy.stateTime >= 0.42) {
      enemy.state = 'recover';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'recover') {
    curvedBatMove(enemy, dt, ctx, 0.42);
    if (enemy.stateTime >= 0.5) {
      enemy.state = 'chase';
      enemy.stateTime = 0;
    }
    return;
  }

  if (enemy.attackCooldown <= 0 && target.distance < 340) {
    enemy.attackCooldown = 2.7;
    enemy.state = 'windup';
    enemy.stateTime = 0;
    enemy.vx = target.nx;
    enemy.vy = target.ny;
    ctx.addZone({
      x: enemy.x,
      y: enemy.y,
      shape: 'line',
      radius: 235,
      length: 235,
      width: 24,
      angle: enemy.facing,
      telegraph: 0.38,
      duration: 0.42,
      damage: 0,
      owner: 'enemy',
      kind: 'bat-swoop',
    });
    return;
  }

  enemy.state = 'chase';
  curvedBatMove(enemy, dt, ctx, 1);
}

function updateBeetle(enemy: Enemy, dt: number, ctx: P1Context): void {
  const target = targetVector(enemy, ctx);
  const speed = speedFor(enemy, ctx);

  if (enemy.state === 'windup') {
    if (enemy.stateTime >= 1.05) {
      enemy.state = 'attack';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'attack') {
    move(enemy, dt, ctx, enemy.vx, enemy.vy, speed * 3.15);
    if (enemy.stateTime >= 0.68) {
      enemy.state = 'recover';
      enemy.stateTime = 0;
    }
    return;
  }
  if (enemy.state === 'recover') {
    if (target.distance > 80) move(enemy, dt, ctx, target.nx, target.ny, speed * 0.18);
    if (enemy.stateTime >= 0.78) {
      enemy.state = 'chase';
      enemy.stateTime = 0;
    }
    return;
  }

  if (enemy.attackCooldown <= 0 && target.distance < 325) {
    enemy.attackCooldown = 4.6;
    enemy.state = 'windup';
    enemy.stateTime = 0;
    enemy.vx = target.nx;
    enemy.vy = target.ny;
    ctx.addZone({
      x: enemy.x,
      y: enemy.y,
      shape: 'line',
      radius: 215,
      length: 215,
      width: 48,
      angle: enemy.facing,
      telegraph: 1.05,
      duration: 0.68,
      damage: 0,
      owner: 'enemy',
      kind: 'beetle-charge',
    });
    return;
  }

  enemy.state = 'chase';
  move(enemy, dt, ctx, target.nx, target.ny, speed * 0.62);
}

/**
 * Handles P1-only regular enemies. The engine owns shared timer updates,
 * contact damage, spawning, stats, and lifecycle; this hook owns only each
 * enemy's movement, state transitions, and telegraph zones.
 */
export function updateP1Enemy(enemy: Enemy, dt: number, ctx: P1Context): boolean {
  if (enemy.kind === 'skeleton') updateSkeleton(enemy, dt, ctx);
  else if (enemy.kind === 'bat') updateBat(enemy, dt, ctx);
  else if (enemy.kind === 'beetle') updateBeetle(enemy, dt, ctx);
  else return false;
  return true;
}
