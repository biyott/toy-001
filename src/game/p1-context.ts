import type { Enemy, GameEvent, GameState, Projectile, Vec2, WeaponId, Zone } from '../types';

/** Shared extension contract. Engine owns IDs, damage accounting and lifecycle. */
export interface P1Context {
  readonly state: GameState;
  random(): number;
  upgrade(id: string): number;
  power(): number;
  haste(): number;
  nearest(position: Vec2, range?: number, excluded?: number[]): Enemy | undefined;
  nearby(position: Vec2, range: number): Enemy[];
  damageEnemy(enemy: Enemy, damage: number, weapon: WeaponId, source: Vec2): void;
  emit(type: GameEvent['type'], position: Vec2, detail?: Partial<GameEvent>): void;
  addZone(zone: Omit<Zone, 'id' | 'hitIds'>): Zone;
  addProjectile(weapon: WeaponId, owner: Projectile['owner'], position: Vec2, angle: number, speed: number, damage: number, partial?: Partial<Projectile>): void;
  moveBody(body: Vec2 & { radius: number }, dx: number, dy: number, ignoreProps?: boolean): void;
  slowEnemy(enemy: Enemy, seconds: number, factor: number): void;
  effectiveSpeed(enemy: Enemy): number;
}
