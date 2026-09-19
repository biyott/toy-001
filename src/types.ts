export type Vec2 = { x: number; y: number };
export type Phase = 'title' | 'playing' | 'paused' | 'levelup' | 'victory' | 'defeat';
export type GameMode = 'normal' | 'demo' | 'challenge';
export type CharacterId = 'knight' | 'mage' | 'ranger';
export type WeaponId = 'sword' | 'arrow' | 'spirit' | 'lightning' | 'frost' | 'fireball';
export type EnemyKind = 'slime' | 'mushroom' | 'goblin' | 'skeleton' | 'bat' | 'beetle' | 'mushroomKing' | 'golem';
export interface GameOptions { mode: GameMode; seed: number; character: CharacterId; contentTier?: 0 | 1; }
export interface InputFrame { moveX: number; moveY: number; dashPressed: boolean; pausePressed: boolean; }
export interface Body extends Vec2 { id: number; radius: number; facing: number; }
export interface Player extends Body {
  character: CharacterId; hp: number; maxHp: number; xp: number; xpToNext: number; level: number;
  speed: number; invulnerable: number; dashCooldown: number; dashTime: number; hitFlash: number;
  moving: boolean; upgrades: Record<string, number>;
}
export interface Enemy extends Body {
  kind: EnemyKind; hp: number; maxHp: number; speed: number; damage: number; xp: number;
  state: 'idle' | 'chase' | 'windup' | 'attack' | 'recover'; stateTime: number;
  hitFlash: number; boss: boolean; attackCooldown: number; vx: number; vy: number;
}
export interface Projectile extends Body {
  weapon: WeaponId; owner: 'player' | 'enemy'; vx: number; vy: number; damage: number;
  life: number; pierce: number; hitIds: number[]; generation: number;
}
export interface Pickup extends Body { kind: 'xp' | 'heal'; value: number; life: number; }
export interface Zone extends Vec2 {
  id: number; shape: 'circle' | 'ring' | 'line' | 'cone'; radius: number; innerRadius?: number;
  angle: number; length?: number; width?: number; telegraph: number; duration: number;
  damage: number; owner: 'player' | 'enemy'; kind: string; hitIds: number[];
}
export interface Prop extends Vec2 {
  id: number; kind: 'tree' | 'wall' | 'gate' | 'house' | 'well' | 'mushroom' | 'rock' | 'flower' | 'banner';
  radius: number; scale: number; variant: number; solid: boolean;
}
export interface WeaponState { id: WeaponId; level: number; cooldown: number; angle: number; }
export interface WeaponDefinition { id: WeaponId; name: string; description: string; icon: string; color: string; tier: 0 | 1; }
export interface CharacterDefinition { id: CharacterId; name: string; title: string; description: string; weapon: WeaponId; color: string; }
export interface UpgradeDefinition {
  id: string; name: string; description: string; icon: string;
  category: 'weapon' | 'power' | 'defense' | 'utility' | 'synergy';
  maxLevel: number; tier: 0 | 1; weapon?: WeaponId;
}
export interface SynergyDefinition { id: string; name: string; description: string; requires: string[]; }
export interface RunStats { kills: number; damageDealt: number; damageTaken: number; score: number; gems: number; bossesDefeated: number; maxEnemies: number; }
export interface GameState {
  phase: Phase; mode: GameMode; seed: number; contentTier: 0 | 1; elapsed: number; duration: number;
  player: Player; enemies: Enemy[]; projectiles: Projectile[]; pickups: Pickup[]; zones: Zone[]; props: Prop[];
  weapons: WeaponState[]; upgradeChoices: UpgradeDefinition[]; stats: RunStats;
  world: { halfWidth: number; halfHeight: number }; bossSpawned: boolean; bossDefeated: boolean;
  message: string; synergies: string[];
}
export type GameCommand =
  | { type: 'start'; options: GameOptions }
  | { type: 'pause' | 'resume' | 'restart' | 'returnTitle' }
  | { type: 'selectUpgrade'; id: string };
export interface GameEvent extends Vec2 {
  id: number; type: 'attack' | 'hit' | 'kill' | 'pickup' | 'dash' | 'levelup' | 'boss' | 'victory' | 'defeat' | 'upgrade' | 'heal';
  value?: number; text?: string; weapon?: WeaponId; kind?: string; angle?: number; radius?: number; targetX?: number; targetY?: number;
}
export interface GameController { getState(): Readonly<GameState>; step(dt: number, input: InputFrame): void; dispatch(command: GameCommand): void; drainEvents(): GameEvent[]; }
export interface Settings { muted: boolean; reducedMotion: boolean; }
export interface RunRecord { bestScore: number; bestTime: number; wins: number; }
export interface Profile extends RunRecord { version: 1; settings: Settings; demoRecord?: RunRecord; }
export interface Renderer {
  resize(width: number, height: number, dpr: number): void;
  consumeEvents(events: readonly GameEvent[]): void;
  render(state: Readonly<GameState>, dt: number, settings: Settings): void;
  dispose(): void;
}
export interface UIHandlers {
  command(command: GameCommand): void;
  settings(patch: Partial<Settings>): void;
  getOptions(): GameOptions;
  setOptions(patch: Partial<GameOptions>): void;
}
export interface GameUI { render(state: Readonly<GameState>, profile: Profile): void; dispose(): void; }
