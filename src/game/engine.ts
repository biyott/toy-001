import type { Enemy, EnemyKind, GameController, GameEvent, GameOptions, GameState, InputFrame, Projectile, Prop, UpgradeDefinition, Vec2, WeaponId, Zone } from '../types';
import { CHARACTERS, SYNERGIES, UPGRADES } from './content';

const TAU = Math.PI * 2;
const MAX_ENEMIES = 180;
const MAX_PROJECTILES = 300;
const MAX_PICKUPS = 260;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const dist2 = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const angleDifference = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

/** Fixed seeded random stream. Combat has no wall-clock or browser dependencies. */
function randomStream(seed: number) {
  let current = seed >>> 0;
  return () => {
    current += 0x6d2b79f5;
    let value = current;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Broad phase shared by all player attacks; rebuilt after enemies move. */
class EnemyGrid {
  private buckets = new Map<string, Enemy[]>();
  private size = 120;
  rebuild(enemies: Enemy[]) {
    this.buckets.clear();
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const key = `${Math.floor(enemy.x / this.size)},${Math.floor(enemy.y / this.size)}`;
      const bucket = this.buckets.get(key);
      if (bucket) bucket.push(enemy);
      else this.buckets.set(key, [enemy]);
    }
  }
  around(x: number, y: number, radius: number): Enemy[] {
    const found: Enemy[] = [];
    for (let gx = Math.floor((x - radius) / this.size); gx <= Math.floor((x + radius) / this.size); gx++) {
      for (let gy = Math.floor((y - radius) / this.size); gy <= Math.floor((y + radius) / this.size); gy++) {
        const bucket = this.buckets.get(`${gx},${gy}`);
        if (bucket) found.push(...bucket);
      }
    }
    return found;
  }
}

/** Rendering and collision read exactly the same attack geometry. */
export function zoneContains(zone: Zone, point: Vec2, radius = 0): boolean {
  const dx = point.x - zone.x;
  const dy = point.y - zone.y;
  const distance = Math.hypot(dx, dy);
  if (zone.shape === 'circle') return distance <= zone.radius + radius;
  if (zone.shape === 'ring') return distance <= zone.radius + radius && distance + radius >= (zone.innerRadius ?? 0);
  if (zone.shape === 'cone') {
    return distance <= zone.radius + radius && Math.abs(angleDifference(Math.atan2(dy, dx), zone.angle)) <= (zone.width ?? 1.6) / 2 + Math.asin(Math.min(1, radius / Math.max(1, distance)));
  }
  const along = dx * Math.cos(zone.angle) + dy * Math.sin(zone.angle);
  const across = -dx * Math.sin(zone.angle) + dy * Math.cos(zone.angle);
  return along >= -radius && along <= (zone.length ?? zone.radius) + radius && Math.abs(across) <= (zone.width ?? 24) / 2 + radius;
}

export function createGame(initialOptions: GameOptions): GameController {
  let options = { ...initialOptions };
  let rng = randomStream(options.seed);
  let nextId = 1;
  let eventId = 1;
  let events: GameEvent[] = [];
  let spawnClock = 0;
  let healClock = 0;
  let bossPattern = 0;
  let dashDirection = { x: 1, y: 0 };
  const grid = new EnemyGrid();
  let state: GameState;

  function emit(type: GameEvent['type'], position: Vec2, detail: Partial<GameEvent> = {}) {
    // main drains each frame; bounding protects headless consumers that forget to drain.
    if (events.length >= 1000) events.shift();
    events.push({ id: eventId++, type, x: position.x, y: position.y, ...detail });
  }
  function props(): Prop[] {
    let propId = -1;
    const result: Prop[] = [];
    const add = (kind: Prop['kind'], x: number, y: number, radius: number, scale: number, solid: boolean, variant = 0) => result.push({ id: propId--, kind, x, y, radius, scale, solid, variant });
    // A traversable clearing surrounded by a little settlement and forest.
    add('gate', 0, -470, 38, 1.2, false);
    for (const x of [-600, -450, -300, -150, 150, 300, 450, 600]) add('wall', x, -485, 50, 1, true);
    add('house', -510, -280, 65, 1.15, true);
    add('house', 540, -285, 61, 1, true, 1);
    add('well', 320, 100, 31, 1, true);
    add('banner', -108, -400, 10, 1, false);
    add('banner', 108, -400, 10, 1, false, 1);
    const trees = [[-790, -380], [-700, -180], [-860, 70], [-750, 290], [-550, 490], [-300, 555], [150, 565], [620, 455], [850, 210], [795, -80], [830, -430], [480, -565], [-470, -575]];
    for (let i = 0; i < trees.length; i++) add('tree', trees[i][0], trees[i][1], 27, 0.9 + i % 3 * .13, true, i % 3);
    for (let i = 0; i < 46; i++) {
      const x = (rng() * 2 - 1) * 920;
      const y = (rng() * 2 - 1) * 610;
      if (Math.hypot(x, y) < 150) continue;
      const kind = i % 9 === 0 ? 'rock' : i % 3 === 0 ? 'mushroom' : 'flower';
      add(kind, x, y, kind === 'rock' ? 19 : 9, .65 + rng() * .55, kind === 'rock', i % 3);
    }
    return result;
  }
  function reset(phase: GameState['phase']) {
    rng = randomStream(options.seed);
    nextId = 1;
    events = [];
    spawnClock = .15;
    healClock = 12;
    bossPattern = 0;
    dashDirection = { x: 1, y: 0 };
    const character = options.contentTier === 1 ? options.character : 'knight';
    const starter = CHARACTERS[character].weapon;
    state = {
      phase, mode: options.mode, seed: options.seed, contentTier: options.contentTier ?? 0,
      elapsed: 0, duration: options.mode === 'demo' ? 180 : 600,
      player: { id: nextId++, x: 0, y: 30, radius: 15, facing: 0, character, hp: character === 'knight' ? 120 : 100, maxHp: character === 'knight' ? 120 : 100, xp: 0, xpToNext: 6, level: 1, speed: character === 'ranger' ? 190 : 170, invulnerable: 0, dashCooldown: 0, dashTime: 0, hitFlash: 0, moving: false, upgrades: { [starter]: 1 } },
      enemies: [], projectiles: [], pickups: [], zones: [], props: props(),
      weapons: [{ id: starter, level: 1, cooldown: .1, angle: 0 }], upgradeChoices: [],
      stats: { kills: 0, damageDealt: 0, damageTaken: 0, score: 0, gems: 0, bossesDefeated: 0, maxEnemies: 0 },
      world: { halfWidth: 1000, halfHeight: 680 }, bossSpawned: false, bossDefeated: false,
      message: '마법 숲의 새벽을 지켜 주세요!', synergies: [],
    };
    grid.rebuild([]);
  }
  reset('title');
  const upgrade = (id: string) => state.player.upgrades[id] ?? 0;
  const power = () => (1 + .18 * upgrade('power')) * (state.player.character === 'mage' ? 1.12 : 1);
  const haste = () => Math.pow(.9, upgrade('haste'));

  function moveBody(body: Vec2 & { radius: number }, dx: number, dy: number, ignoreProps = false) {
    // Small movement slices prevent a fast dash crossing a solid prop in one frame.
    const slices = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 10));
    for (let n = 0; n < slices; n++) {
      body.x = clamp(body.x + dx / slices, -state.world.halfWidth + body.radius, state.world.halfWidth - body.radius);
      body.y = clamp(body.y + dy / slices, -state.world.halfHeight + body.radius, state.world.halfHeight - body.radius);
      if (ignoreProps) continue;
      for (const prop of state.props) {
        if (!prop.solid) continue;
        const min = prop.radius + body.radius;
        const px = body.x - prop.x;
        const py = body.y - prop.y;
        const distance = Math.hypot(px, py);
        if (distance < min) {
          const nx = distance > .001 ? px / distance : 1;
          const ny = distance > .001 ? py / distance : 0;
          body.x = prop.x + nx * min;
          body.y = prop.y + ny * min;
        }
      }
    }
  }
  function addZone(partial: Omit<Zone, 'id' | 'hitIds'>) {
    const zone = { ...partial, id: nextId++, hitIds: [] };
    state.zones.push(zone);
    return zone;
  }
  function addProjectile(weapon: WeaponId, owner: Projectile['owner'], position: Vec2, angle: number, speed: number, damage: number, partial: Partial<Projectile> = {}) {
    if (state.projectiles.length >= MAX_PROJECTILES) return;
    state.projectiles.push({ id: nextId++, x: position.x, y: position.y, radius: owner === 'enemy' ? 8 : 6, facing: angle, weapon, owner, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, life: 2.2, pierce: 0, hitIds: [], generation: 0, ...partial });
  }
  function nearest(position: Vec2, range = 700, excluded: number[] = []): Enemy | undefined {
    let best: Enemy | undefined;
    let distance = range ** 2;
    for (const enemy of grid.around(position.x, position.y, range)) {
      if (enemy.hp <= 0 || excluded.includes(enemy.id)) continue;
      const d = dist2(position, enemy);
      if (d < distance) { distance = d; best = enemy; }
    }
    return best;
  }
  function damageEnemy(enemy: Enemy, damage: number, weapon: WeaponId, source: Vec2) {
    if (enemy.hp <= 0) return;
    const dealt = Math.min(enemy.hp, damage);
    enemy.hp -= damage;
    enemy.hitFlash = .13;
    state.stats.damageDealt += dealt;
    emit('hit', enemy, { value: Math.round(damage), weapon, kind: enemy.kind, targetX: source.x, targetY: source.y });
  }
  function damagePlayer(amount: number, source: Vec2) {
    const player = state.player;
    if (player.invulnerable > 0 || state.phase !== 'playing') return;
    const damage = Math.max(1, amount * (1 - .12 * upgrade('armor')));
    const dealt = Math.min(player.hp, damage);
    player.hp = Math.max(0, player.hp - damage);
    player.invulnerable = .8;
    player.hitFlash = .22;
    state.stats.damageTaken += dealt;
    emit('hit', player, { value: Math.round(damage), kind: 'player', targetX: source.x, targetY: source.y });
    if (player.hp <= 0) finish(false);
  }
  function finish(victory: boolean) {
    if (state.phase === 'victory' || state.phase === 'defeat') return;
    state.phase = victory ? 'victory' : 'defeat';
    state.upgradeChoices = [];
    state.stats.score = Math.floor(state.stats.kills * 10 + state.elapsed * 2 + state.player.level * 25 + state.stats.bossesDefeated * 1000 + (victory ? 2000 : 0));
    state.message = victory ? '새벽이 돌아왔어요. 숲을 지켜냈습니다!' : '괜찮아요. 다음 새벽에 다시 만나요.';
    emit(victory ? 'victory' : 'defeat', state.player);
  }
  function spawnEnemy(kind?: EnemyKind) {
    if (state.enemies.length >= MAX_ENEMIES) return;
    const progress = state.elapsed / state.duration;
    const r = rng();
    kind ??= state.elapsed < 12 ? 'slime' : r < .45 ? 'slime' : r < .72 ? 'mushroom' : 'goblin';
    const boss = kind === 'mushroomKing' || kind === 'golem';
    const angle = rng() * TAU;
    const range = boss ? 390 : 460 + rng() * 180;
    const radius = boss ? 43 : kind === 'slime' ? 17 : kind === 'mushroom' ? 18 : 15;
    let x = clamp(state.player.x + Math.cos(angle) * range, -945, 945);
    let y = clamp(state.player.y + Math.sin(angle) * range, -625, 625);
    // Avoid edge-camping spawning an enemy directly on the guardian.
    if (Math.hypot(x - state.player.x, y - state.player.y) < 230) {
      x = clamp(state.player.x - Math.cos(angle) * range, -945, 945);
      y = clamp(state.player.y - Math.sin(angle) * range, -625, 625);
    }
    const hp = boss ? (state.mode === 'demo' ? 1700 : 4200) : (kind === 'slime' ? 22 : kind === 'mushroom' ? 34 : 28) * (1 + progress * 2.5);
    const enemy: Enemy = { id: nextId++, kind, x, y, radius, facing: 0, hp, maxHp: hp, speed: boss ? 31 : (kind === 'slime' ? 45 : kind === 'mushroom' ? 37 : 66) * (1 + progress * .45), damage: boss ? 19 : (kind === 'goblin' ? 12 : 9) + progress * 7, xp: boss ? 55 : kind === 'slime' ? 2 : 3, state: 'chase', stateTime: rng() * TAU, hitFlash: 0, boss, attackCooldown: boss ? 2.5 : 1.5 + rng() * 2, vx: 0, vy: 0 };
    moveBody(enemy, 0, 0);
    state.enemies.push(enemy);
    if (boss) { state.bossSpawned = true; state.message = '버섯 왕이 깨어났어요! 바닥의 공격 예고를 피하세요.'; emit('boss', enemy, { kind }); }
  }
  function updateEnemies(dt: number) {
    const player = state.player;
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackCooldown -= dt;
      enemy.stateTime += dt;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      enemy.facing = Math.atan2(dy, dx);
      let speed = enemy.speed;
      if (enemy.boss) {
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = enemy.hp < enemy.maxHp * .4 ? 2.7 : 3.6;
          enemy.state = 'windup';
          enemy.stateTime = 0;
          if (bossPattern++ % 2 === 0) {
            addZone({ x: player.x, y: player.y, shape: 'circle', radius: 88, angle: 0, telegraph: 1.15, duration: .35, damage: 24, owner: 'enemy', kind: 'spore-burst' });
            if (enemy.hp < enemy.maxHp * .5) {
              for (const offset of [-110, 110]) addZone({ x: clamp(player.x + offset, -940, 940), y: player.y + 70, shape: 'circle', radius: 64, angle: 0, telegraph: 1.55, duration: .3, damage: 20, owner: 'enemy', kind: 'spore-burst' });
            }
          } else {
            addZone({ x: enemy.x, y: enemy.y, shape: 'ring', radius: 205, innerRadius: 82, angle: 0, telegraph: 1.35, duration: .4, damage: 27, owner: 'enemy', kind: 'royal-stomp' });
          }
        }
        if (enemy.state === 'windup') {
          speed = 0;
          if (enemy.stateTime > 1.4) { enemy.state = 'recover'; enemy.stateTime = 0; }
        } else if (enemy.state === 'recover') {
          speed *= .4;
          if (enemy.stateTime > .5) enemy.state = 'chase';
        }
      } else if (enemy.kind === 'slime') {
        // Alternating squash and hop changes both movement rhythm and silhouette.
        speed *= Math.sin(enemy.stateTime * 3.6) > 0 ? 1.65 : .25;
      } else if (enemy.kind === 'mushroom') {
        speed *= distance < 230 ? (distance < 145 ? -.45 : 0) : 1;
        if (enemy.attackCooldown <= 0 && distance < 450) {
          enemy.attackCooldown = 3.8;
          enemy.state = 'windup'; enemy.stateTime = 0;
          addZone({ x: player.x, y: player.y, shape: 'circle', radius: 45, angle: 0, telegraph: 1.05, duration: .22, damage: enemy.damage, owner: 'enemy', kind: 'spore' });
        }
        if (enemy.state === 'windup') {
          speed = 0;
          if (enemy.stateTime > 1.05) enemy.state = 'chase';
        }
      } else if (enemy.kind === 'goblin') {
        if (enemy.state === 'windup') {
          speed = 0;
          if (enemy.stateTime > .65) { enemy.state = 'attack'; enemy.stateTime = 0; }
        } else if (enemy.state === 'attack') {
          moveBody(enemy, enemy.vx * dt, enemy.vy * dt);
          speed = 0;
          if (enemy.stateTime > .52) { enemy.state = 'recover'; enemy.stateTime = 0; }
        } else if (enemy.state === 'recover') {
          speed *= .25;
          if (enemy.stateTime > .6) enemy.state = 'chase';
        } else if (enemy.attackCooldown <= 0 && distance < 275) {
          enemy.state = 'windup'; enemy.stateTime = 0; enemy.attackCooldown = 4.4;
          enemy.vx = dx / distance * 265; enemy.vy = dy / distance * 265;
          addZone({ x: enemy.x, y: enemy.y, shape: 'line', radius: 138, length: 138, width: 27, angle: enemy.facing, telegraph: .65, duration: .5, damage: 0, owner: 'enemy', kind: 'goblin-charge' });
          speed = 0;
        }
      }
      if (distance > enemy.radius + player.radius - 2) moveBody(enemy, dx / distance * speed * dt, dy / distance * speed * dt);
      if (dist2(enemy, player) < (enemy.radius + player.radius) ** 2) damagePlayer(enemy.damage, enemy);
    }
    grid.rebuild(state.enemies);
  }
  function chainLightning(first: Enemy, damage: number) {
    const visited = [first.id];
    let source: Enemy = first;
    for (let i = 0; i < 1 + upgrade('chain'); i++) {
      const target = nearest(source, 155, visited);
      if (!target) break;
      visited.push(target.id);
      damageEnemy(target, damage, 'lightning', source);
      emit('attack', source, { weapon: 'lightning', targetX: target.x, targetY: target.y });
      source = target;
    }
  }
  function updateWeapons(dt: number) {
    const player = state.player;
    for (const weapon of state.weapons) {
      weapon.cooldown -= dt;
      weapon.angle += dt * (1.8 + weapon.level * .12);
      if (weapon.id === 'spirit') {
        const count = 2 + Math.floor(weapon.level / 2);
        const existing = state.projectiles.filter(p => p.weapon === 'spirit' && p.owner === 'player');
        for (let i = existing.length; i < count; i++) addProjectile('spirit', 'player', player, 0, 0, 12, { generation: -i - 1, radius: 12, life: 1, pierce: 999 });
        if (weapon.cooldown <= 0) {
          weapon.cooldown = .62 * haste();
          for (const spirit of existing) spirit.hitIds = [];
        }
        continue;
      }
      if (weapon.cooldown > 0) continue;
      const target = nearest(player, weapon.id === 'sword' ? 160 : 680);
      if (!target) { weapon.cooldown = .1; continue; }
      const angle = Math.atan2(target.y - player.y, target.x - player.x);
      if (weapon.id === 'sword') {
        const radius = 99 + weapon.level * 9;
        weapon.cooldown = Math.max(.34, .94 - weapon.level * .07) * haste();
        addZone({ x: player.x, y: player.y, shape: 'cone', radius, angle, width: 2.3 + weapon.level * .08, telegraph: 0, duration: .16, damage: (22 + weapon.level * 10) * power(), owner: 'player', kind: 'sword' });
        emit('attack', player, { weapon: 'sword', angle, radius });
      } else if (weapon.id === 'arrow') {
        weapon.cooldown = Math.max(.3, .9 - weapon.level * .09) * haste();
        const shots = weapon.level >= 4 ? 2 : 1;
        for (let i = 0; i < shots; i++) addProjectile('arrow', 'player', player, angle + (shots > 1 ? (i - .5) * .12 : 0), 460, (16 + weapon.level * 9) * power(), { pierce: upgrade('pierce') * 2 });
        emit('attack', player, { weapon: 'arrow', angle });
      }
    }
  }
  function updateProjectiles(dt: number) {
    // Snapshot length: split children start moving next frame, keeping fan-out bounded.
    const count = state.projectiles.length;
    const spiritWeapon = state.weapons.find(w => w.id === 'spirit');
    for (let i = 0; i < count; i++) {
      const projectile = state.projectiles[i];
      if (projectile.life <= 0) continue;
      const spirit = projectile.weapon === 'spirit' && projectile.owner === 'player';
      if (spirit && spiritWeapon) {
        const count = 2 + Math.floor(spiritWeapon.level / 2);
        const angle = spiritWeapon.angle + (-projectile.generation - 1) / count * TAU;
        const radius = 65 + spiritWeapon.level * 6;
        projectile.x = state.player.x + Math.cos(angle) * radius;
        projectile.y = state.player.y + Math.sin(angle) * radius;
        projectile.facing = angle;
        projectile.damage = (11 + spiritWeapon.level * 6) * power();
      } else {
        projectile.life -= dt;
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
      }
      if (projectile.owner === 'enemy') {
        if (dist2(projectile, state.player) <= (projectile.radius + state.player.radius) ** 2) { damagePlayer(projectile.damage, projectile); projectile.life = 0; }
        continue;
      }
      for (const enemy of grid.around(projectile.x, projectile.y, projectile.radius + 48)) {
        if (enemy.hp <= 0 || projectile.hitIds.includes(enemy.id) || dist2(projectile, enemy) > (projectile.radius + enemy.radius) ** 2) continue;
        projectile.hitIds.push(enemy.id);
        damageEnemy(enemy, projectile.damage, projectile.weapon, projectile);
        if (spirit && upgrade('chain')) chainLightning(enemy, projectile.damage * .55);
        if (projectile.weapon === 'arrow' && projectile.generation === 0 && upgrade('split')) {
          for (const offset of [-.52, .52]) addProjectile('arrow', 'player', projectile, projectile.facing + offset, 360, projectile.damage * (.4 + upgrade('split') * .1), { generation: 1, life: .7, pierce: upgrade('pierce') ? 1 : 0, hitIds: [...projectile.hitIds], radius: 4 });
        }
        if (!spirit) {
          projectile.pierce--;
          if (projectile.pierce < 0) { projectile.life = 0; break; }
        }
      }
    }
    state.projectiles = state.projectiles.filter(p => p.life > 0 && Math.abs(p.x) < 1250 && Math.abs(p.y) < 950);
  }
  function updateZones(dt: number) {
    for (const zone of state.zones) {
      if (zone.telegraph > 0) {
        zone.telegraph = Math.max(0, zone.telegraph - dt);
        if (zone.telegraph > 0) continue;
        emit('attack', zone, { kind: zone.kind, radius: zone.radius, angle: zone.angle });
      }
      zone.duration -= dt;
      if (zone.owner === 'enemy') {
        if (zone.damage > 0 && !zone.hitIds.includes(state.player.id) && zoneContains(zone, state.player, state.player.radius)) {
          // Invulnerability can evade a whole strike; one zone cannot repeatedly hurt.
          zone.hitIds.push(state.player.id);
          damagePlayer(zone.damage, zone);
        }
      } else {
        const range = zone.shape === 'line' ? (zone.length ?? zone.radius) : zone.radius;
        for (const enemy of grid.around(zone.x, zone.y, range + 48)) {
          if (enemy.hp <= 0 || zone.hitIds.includes(enemy.id) || !zoneContains(zone, enemy, enemy.radius)) continue;
          zone.hitIds.push(enemy.id);
          damageEnemy(enemy, zone.damage, zone.kind as WeaponId, zone);
        }
      }
    }
    state.zones = state.zones.filter(zone => zone.telegraph > 0 || zone.duration > 0);
  }
  function addPickup(kind: 'xp' | 'heal', position: Vec2, value: number) {
    if (state.pickups.length >= MAX_PICKUPS) {
      // Coalesce into existing gems instead of allowing permanent entity growth.
      const existing = state.pickups.find(p => p.kind === kind);
      if (existing) { existing.value += value; existing.life = 90; return; }
      state.pickups.shift();
    }
    state.pickups.push({ id: nextId++, x: position.x, y: position.y, radius: kind === 'xp' ? 6 : 11, facing: 0, kind, value, life: kind === 'xp' ? 90 : 45 });
  }
  function collectDead() {
    for (const enemy of state.enemies) {
      if (enemy.hp > 0) continue;
      state.stats.kills++;
      addPickup('xp', enemy, enemy.xp);
      if (rng() < .085) addPickup('heal', enemy, 12);
      emit('kill', enemy, { kind: enemy.kind });
      if (enemy.boss) {
        state.bossDefeated = true;
        state.stats.bossesDefeated++;
        state.message = '버섯 왕을 물리쳤어요! 새벽까지 숲을 지켜 주세요.';
        addPickup('heal', enemy, 50);
        emit('boss', enemy, { kind: enemy.kind, text: 'defeated' });
      }
    }
    state.enemies = state.enemies.filter(enemy => enemy.hp > 0);
  }
  function eligibleUpgrades(): UpgradeDefinition[] {
    return UPGRADES.filter(u => u.tier <= state.contentTier && upgrade(u.id) < u.maxLevel &&
      (!['pierce', 'split'].includes(u.id) || upgrade('arrow') > 0) && (u.id !== 'chain' || upgrade('spirit') > 0));
  }
  function showUpgrades() {
    if (state.phase !== 'playing' || state.player.xp < state.player.xpToNext) return;
    state.player.xp -= state.player.xpToNext;
    state.player.level++;
    state.player.xpToNext = Math.round(9 + state.player.level * 4.4);
    const available = eligibleUpgrades();
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }
    // Early choices introduce the two build paths without hidden stat cheats.
    const priority = state.player.level === 2 ? ['arrow', 'spirit'] : state.player.level === 3 ? ['spirit', 'arrow'] : state.player.level <= 7 ? ['pierce', 'split', 'chain'].filter(id => !upgrade(id)) : [];
    const ordered: UpgradeDefinition[] = [];
    for (const id of priority) {
      const item = available.find(u => u.id === id);
      if (item && !ordered.includes(item)) ordered.push(item);
    }
    for (const item of available) if (!ordered.includes(item)) ordered.push(item);
    // Finite upgrade trees still offer three useful, repeatable late-run boons.
    const fallback: UpgradeDefinition[] = [
      { id: 'restoration', name: '따뜻한 휴식', description: '체력을 45 회복합니다.', icon: '♥', category: 'defense', maxLevel: 999, tier: 0 },
      { id: 'resolve', name: '작은 결의', description: '모든 무기의 피해가 18% 증가합니다.', icon: '◆', category: 'power', maxLevel: 999, tier: 0 },
      { id: 'heartwood', name: '오래된 나무의 선물', description: '최대 체력이 10 증가하고 체력을 10 회복합니다.', icon: '❀', category: 'defense', maxLevel: 999, tier: 0 },
    ];
    while (ordered.length < 3) ordered.push(fallback[ordered.length]);
    state.upgradeChoices = ordered.slice(0, 3);
    state.phase = 'levelup';
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 7);
    state.message = '새로운 룬을 골라 주세요';
    emit('levelup', state.player, { value: state.player.level });
  }
  function updatePickups(dt: number) {
    const player = state.player;
    const magnetRadius = 88 + upgrade('magnet') * 45;
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      const radius = pickup.kind === 'heal' ? 65 : magnetRadius;
      if (distance < radius) {
        const amount = Math.min(distance, (180 + 600 * (1 - distance / radius)) * dt);
        pickup.x += dx / Math.max(1, distance) * amount;
        pickup.y += dy / Math.max(1, distance) * amount;
      }
      if (dist2(player, pickup) > (player.radius + pickup.radius + 5) ** 2) continue;
      pickup.life = 0;
      if (pickup.kind === 'xp') { player.xp += pickup.value; state.stats.gems += pickup.value; emit('pickup', pickup, { value: pickup.value }); }
      else { const value = Math.min(player.maxHp - player.hp, pickup.value); player.hp += value; emit('heal', player, { value }); }
    }
    state.pickups = state.pickups.filter(pickup => pickup.life > 0);
    showUpgrades();
  }
  function selectUpgrade(id: string) {
    if (state.phase !== 'levelup') return;
    const selected = state.upgradeChoices.find(choice => choice.id === id);
    if (!selected) return;
    const player = state.player;
    player.upgrades[id] = upgrade(id) + 1;
    if (selected.weapon) {
      const weapon = state.weapons.find(item => item.id === selected.weapon);
      if (weapon) weapon.level++;
      else state.weapons.push({ id: selected.weapon, level: 1, cooldown: .1, angle: 0 });
    } else if (id === 'vitality') { player.maxHp += 25; player.hp = Math.min(player.maxHp, player.hp + 40); }
    else if (id === 'speed') player.speed = (player.character === 'ranger' ? 190 : 170) * (1 + .1 * upgrade('speed'));
    else if (id === 'restoration') player.hp = Math.min(player.maxHp, player.hp + 45);
    else if (id === 'resolve') player.upgrades.power = upgrade('power') + 1;
    else if (id === 'heartwood') { player.maxHp += 10; player.hp = Math.min(player.maxHp, player.hp + 10); }
    state.synergies = SYNERGIES.filter(synergy => synergy.requires.every(requirement => upgrade(requirement) > 0)).map(synergy => synergy.id);
    state.upgradeChoices = [];
    state.phase = 'playing';
    player.invulnerable = Math.max(player.invulnerable, .75);
    state.message = `${selected.name} 획득!`;
    emit('upgrade', player, { text: selected.name, kind: id });
    showUpgrades();
  }
  function tick(dt: number, input: InputFrame) {
    const player = state.player;
    state.elapsed += dt;
    player.invulnerable = Math.max(0, player.invulnerable - dt);
    player.hitFlash = Math.max(0, player.hitFlash - dt);
    player.dashCooldown = Math.max(0, player.dashCooldown - dt);
    player.dashTime = Math.max(0, player.dashTime - dt);
    player.hp = Math.min(player.maxHp, player.hp + upgrade('regen') * .6 * dt);
    let mx = Number.isFinite(input.moveX) ? clamp(input.moveX, -1, 1) : 0;
    let my = Number.isFinite(input.moveY) ? clamp(input.moveY, -1, 1) : 0;
    const magnitude = Math.hypot(mx, my);
    if (magnitude > 1) { mx /= magnitude; my /= magnitude; }
    player.moving = magnitude > .05 || player.dashTime > 0;
    if (magnitude > .05) player.facing = Math.atan2(my, mx);
    if (input.dashPressed && player.dashCooldown <= 0) {
      dashDirection = magnitude > .05 ? { x: mx / Math.hypot(mx, my), y: my / Math.hypot(mx, my) } : { x: Math.cos(player.facing), y: Math.sin(player.facing) };
      player.dashTime = .2;
      player.dashCooldown = 2.2 * (1 - .08 * upgrade('speed'));
      player.invulnerable = Math.max(player.invulnerable, .32);
      emit('dash', player, { angle: player.facing });
    }
    if (player.dashTime > 0) moveBody(player, dashDirection.x * player.speed * 3.6 * dt, dashDirection.y * player.speed * 3.6 * dt);
    else moveBody(player, mx * player.speed * dt, my * player.speed * dt);
    spawnClock -= dt;
    const progress = state.elapsed / state.duration;
    if (spawnClock <= 0 && state.elapsed < state.duration) {
      spawnClock += Math.max(.24, 1.1 - progress * .72) * (state.mode === 'demo' ? .82 : 1);
      spawnEnemy();
      if (progress > .35 && rng() < progress * .55) spawnEnemy();
    }
    healClock -= dt;
    if (healClock <= 0) {
      healClock = 18;
      const angle = rng() * TAU;
      addPickup('heal', { x: clamp(player.x + Math.cos(angle) * 90, -940, 940), y: clamp(player.y + Math.sin(angle) * 90, -620, 620) }, 18);
    }
    const bossAt = state.mode === 'demo' ? 120 : 480;
    if (!state.bossSpawned && state.elapsed >= bossAt) {
      if (state.enemies.length >= MAX_ENEMIES) state.enemies.pop();
      spawnEnemy('mushroomKing');
    }
    updateEnemies(dt);
    if (state.phase !== 'playing') return;
    updateWeapons(dt);
    updateProjectiles(dt);
    updateZones(dt);
    collectDead();
    if (state.phase !== 'playing') return;
    updatePickups(dt);
    state.stats.maxEnemies = Math.max(state.stats.maxEnemies, state.enemies.length);
    state.stats.score = Math.floor(state.stats.kills * 10 + state.elapsed * 2 + player.level * 25 + state.stats.bossesDefeated * 1000);
    if (state.elapsed >= state.duration && state.bossDefeated) finish(true);
    else if (state.elapsed >= state.duration) state.message = '마지막 시련! 버섯 왕을 물리치면 숲에 새벽이 돌아옵니다.';
  }
  return {
    getState: () => state,
    drainEvents() { const drained = events; events = []; return drained; },
    dispatch(command) {
      if (command.type === 'start') { options = { ...command.options }; reset('playing'); }
      else if (command.type === 'restart') reset('playing');
      else if (command.type === 'returnTitle') reset('title');
      else if (command.type === 'pause' && state.phase === 'playing') state.phase = 'paused';
      else if (command.type === 'resume' && state.phase === 'paused') state.phase = 'playing';
      else if (command.type === 'selectUpgrade') selectUpgrade(command.id);
    },
    step(dt, input) {
      if (input.pausePressed) {
        if (state.phase === 'playing') state.phase = 'paused';
        else if (state.phase === 'paused') state.phase = 'playing';
        return;
      }
      if (state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
      // Main caps dt as well. Local substeps ensure consistent geometry at low fps.
      let remaining = Math.min(dt, .05);
      let first = true;
      while (remaining > .000001 && state.phase === 'playing') {
        const slice = Math.min(remaining, 1 / 60);
        tick(slice, { ...input, dashPressed: first && input.dashPressed });
        remaining -= slice;
        first = false;
      }
    },
  };
}
