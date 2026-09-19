import type { Enemy, GameEvent, GameState, Player, Projectile, Prop, Renderer, Settings, Vec2, Zone } from '../types';
import { ellipse, eye, line, polygon, rounded, star, type Ctx } from './art';
import { actorSprite, clearSpriteCache, drawSprite, propSprite } from './sprites';
import { Ground, titleProps, worldEdge } from './world';
import { Effects } from './effects';

const TAU = Math.PI * 2;
const tallProps = new Set<Prop['kind']>(['tree', 'wall', 'gate', 'house', 'well', 'banner']);

function actorScale(kind: string): number {
  if (kind === 'mushroomKing') return 1.8;
  if (kind === 'golem') return 1.95;
  if (kind === 'slime') return .6;
  if (kind === 'bat') return .53;
  if (kind === 'beetle') return .67;
  return .68;
}

function propScale(prop: Prop): number { return prop.scale * (prop.kind === 'tree' ? .91 : prop.kind === 'gate' ? 1 : .85); }

function shadow(ctx: Ctx, x: number, y: number, radius: number, alpha = .16): void {
  ellipse(ctx, x + 3, y + 2, radius * 1.12, radius * .44, `rgba(58,79,65,${alpha * .42})`);
  ellipse(ctx, x + 1, y + 1, radius * .82, radius * .3, `rgba(58,79,65,${alpha})`);
}

function zonePath(ctx: Ctx, zone: Zone): void {
  ctx.beginPath();
  if (zone.shape === 'line') {
    const length = zone.length ?? zone.radius * 2, width = zone.width ?? 18;
    const nx = -Math.sin(zone.angle) * width / 2, ny = Math.cos(zone.angle) * width / 2;
    const endX = zone.x + Math.cos(zone.angle) * length, endY = zone.y + Math.sin(zone.angle) * length;
    ctx.moveTo(zone.x + nx, zone.y + ny); ctx.lineTo(endX + nx, endY + ny); ctx.lineTo(endX - nx, endY - ny); ctx.lineTo(zone.x - nx, zone.y - ny); ctx.closePath();
  } else if (zone.shape === 'cone') {
    const width = zone.width ?? 2.5; ctx.moveTo(zone.x, zone.y); ctx.arc(zone.x, zone.y, zone.radius, zone.angle - width / 2, zone.angle + width / 2); ctx.closePath();
  } else {
    ctx.arc(zone.x, zone.y, zone.radius, 0, TAU);
    if (zone.shape === 'ring' && zone.innerRadius) { ctx.moveTo(zone.x + zone.innerRadius, zone.y); ctx.arc(zone.x, zone.y, zone.innerRadius, 0, TAU, true); }
  }
}

function drawZone(ctx: Ctx, zone: Zone, time: number, top = false): void {
  const enemy = zone.owner === 'enemy', waiting = zone.telegraph > 0;
  const pulse = .5 + Math.sin(time * 12) * .5;
  ctx.save(); zonePath(ctx, zone);
  if (enemy) {
    if (!top) {
      ctx.fillStyle = waiting ? `rgba(204,112,90,${.10 + pulse * .06})` : 'rgba(220,123,103,.27)'; ctx.fill('evenodd');
      ctx.save(); ctx.clip('evenodd');
      const r = Math.max(zone.radius, zone.length ?? 0) + 30;
      ctx.beginPath(); for (let x = zone.x - r * 2; x < zone.x + r * 2; x += 17) { ctx.moveTo(x, zone.y - r); ctx.lineTo(x + r, zone.y + r); }
      ctx.strokeStyle = 'rgba(183,91,73,.14)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      zonePath(ctx, zone);
    }
    ctx.strokeStyle = waiting ? '#c98168' : '#f3d1a1'; ctx.lineWidth = waiting ? 2 : 3;
    if (waiting) ctx.setLineDash([8, 5]); ctx.globalAlpha = top ? .7 : 1; ctx.stroke(); ctx.setLineDash([]);
    if (!top && waiting && zone.shape !== 'line') {
      const y = zone.y - 4; polygon(ctx, [zone.x, y - 11, zone.x + 11, y + 8, zone.x - 11, y + 8], '#ebc999', '#bc7b61', 1.5);
      line(ctx, [zone.x, y - 4, zone.x, y + 1], '#a26955', 2); ellipse(ctx, zone.x, y + 4, 1, 1, '#a26955');
    }
    if (!top && waiting && zone.shape === 'line') {
      const length = zone.length ?? zone.radius * 2;
      for (let t = 24; t < length; t += 37) {
        ctx.save(); ctx.translate(zone.x + Math.cos(zone.angle) * t, zone.y + Math.sin(zone.angle) * t); ctx.rotate(zone.angle);
        line(ctx, [-4, -5, 3, 0, -4, 5], '#b8785f', 2); ctx.restore();
      }
    }
  } else if (!top) {
    const frost = zone.kind.includes('frost'), sword = zone.kind.includes('sword');
    ctx.fillStyle = frost ? 'rgba(166,213,225,.25)' : sword ? 'rgba(255,231,161,.15)' : 'rgba(190,168,218,.15)'; ctx.fill('evenodd');
    ctx.strokeStyle = frost ? '#b9e0e3' : sword ? '#f9e5b0' : '#ccb5df'; ctx.lineWidth = sword ? 3 : 2; ctx.stroke();
    if (frost) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + time * .15; star(ctx, zone.x + Math.cos(a) * zone.radius * .66, zone.y + Math.sin(a) * zone.radius * .66, 5, '#e4f1e5', 6, a); }
  }
  ctx.restore();
}

function drawProjectile(ctx: Ctx, projectile: Projectile, time: number): void {
  const angle = Math.atan2(projectile.vy, projectile.vx);
  if (projectile.weapon === 'spirit' && projectile.owner === 'player') {
    const y = projectile.y - 15 - Math.sin(time * 5 + projectile.id) * 3;
    shadow(ctx, projectile.x, projectile.y, 9, .08);
    ctx.save(); ctx.translate(projectile.x, y);
    ellipse(ctx, 0, 2, 12, 9, 'rgba(175,143,205,.11)');
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.bezierCurveTo(-10, -16, 11, -17, 11, -3); ctx.bezierCurveTo(13, 6, 5, 8, 1, 5); ctx.quadraticCurveTo(-7, 14, -8, 0); ctx.fillStyle = '#d2c1e3'; ctx.fill(); ctx.strokeStyle = '#897498'; ctx.lineWidth = 1.5; ctx.stroke();
    ellipse(ctx, -3, -7, 3, 2, '#f5ebef'); eye(ctx, -2, -2, 1.5); eye(ctx, 5, -2, 1.5);
    star(ctx, 7, -16, 3, '#f7df9b', 4, time); ctx.restore(); return;
  }
  ctx.save(); ctx.translate(projectile.x, projectile.y - 9); ctx.rotate(angle);
  if (projectile.owner === 'enemy') {
    ellipse(ctx, 0, 0, projectile.radius + 3, projectile.radius + 3, 'rgba(181,124,145,.16)');
    ellipse(ctx, 0, 0, Math.max(4, projectile.radius), Math.max(4, projectile.radius) * .9, '#bb94a8', '#836c82', 1.5);
    ellipse(ctx, -1, -2, 2.5, 1.6, '#ead3d8');
  } else if (projectile.weapon === 'arrow') {
    line(ctx, [-20, 0, 3, 0], 'rgba(242,222,161,.25)', 5);
    line(ctx, [-14, 0, 8, 0], '#98734d', 2.5); polygon(ctx, [14, 0, 5, -4, 6, 4], '#e5e6c9', '#839382', 1);
    polygon(ctx, [-9, -1, -16, -5, -14, 0, -17, 4, -9, 1], '#c9dcc5');
  } else if (projectile.weapon === 'fireball') {
    polygon(ctx, [-22, -2, -6, -6, -13, -12, 3, -5, 10, 0, -3, 8, -19, 10, -10, 4], '#e8ad76');
    ellipse(ctx, 1, 0, 8, 8, '#f5d792', '#d29965', 1.5); ellipse(ctx, 2, -2, 4, 4, '#fff0bf');
  } else if (projectile.weapon === 'frost') {
    polygon(ctx, [11, 0, -1, -8, -9, 0, 0, 8], '#c5e3e3', '#8fbcc7', 1.5); line(ctx, [-5, 0, 6, 0], '#f3f3da', 1.5);
  } else { star(ctx, 0, 0, 7, '#c8b0df', 4, time); }
  ctx.restore();
}

function drawPickup(ctx: Ctx, x: number, y: number, kind: 'xp' | 'heal', value: number, time: number, id: number): void {
  const bob = Math.sin(time * 3 + id) * 1.5;
  if (kind === 'heal') {
    shadow(ctx, x, y, 7, .08); ctx.save(); ctx.translate(x, y - 7 - bob);
    ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-13, 0, -10, -10, -3, -7); ctx.quadraticCurveTo(0, -6, 0, -3); ctx.bezierCurveTo(3, -13, 14, -6, 8, 1); ctx.closePath(); ctx.fillStyle = '#dca49c'; ctx.fill(); ctx.strokeStyle = '#ab7c77'; ctx.lineWidth = 1.5; ctx.stroke(); ellipse(ctx, -5, -4, 2, 1, '#f5d5be'); ctx.restore(); return;
  }
  const r = value >= 5 ? 6.5 : 4.5;
  ellipse(ctx, x, y + 1, r * 1.1, r * .5, 'rgba(62,112,101,.10)');
  polygon(ctx, [x, y - r * 2 - bob, x + r, y - r - bob, x, y + 1 - bob, x - r, y - r - bob], value >= 5 ? '#a692c1' : '#72a99b', '#538d83', 1);
  polygon(ctx, [x, y - r * 2 - bob, x + r, y - r - bob, x, y - r * .65 - bob], value >= 5 ? '#d3bfe2' : '#b8dfb9');
}

function drawEnemy(ctx: Ctx, enemy: Enemy, time: number): void {
  const scale = actorScale(enemy.kind), moving = enemy.state === 'chase' || enemy.state === 'attack';
  const frame = moving ? Math.floor(time * (enemy.kind === 'bat' ? 10 : 7) + enemy.id) % 4 : 0;
  const bob = enemy.kind === 'bat' ? 16 + Math.sin(time * 6 + enemy.id) * 3 : moving ? Math.abs(Math.sin(time * 8 + enemy.id)) * 2 : Math.sin(time * 2 + enemy.id) * .8;
  const windup = enemy.state === 'windup';
  const squash = windup ? .94 : enemy.kind === 'slime' ? 1 + Math.sin(time * 5 + enemy.id) * .04 : 1;
  ctx.save();
  if (enemy.hitFlash > 0) ctx.globalAlpha = .65 + .25 * Math.sin(time * 90);
  drawSprite(ctx, actorSprite(enemy.kind, frame), enemy.x, enemy.y - bob, scale, Math.cos(enemy.facing) < -.2, windup ? Math.sin(time * 22) * .025 : 0, squash);
  if (enemy.hitFlash > 0) {
    star(ctx, enemy.x + 11 * scale, enemy.y - 38 * scale, 8, '#fff6cf', 4, time * 4);
  }
  ctx.restore();
  if (enemy.hp < enemy.maxHp && !enemy.boss) {
    const w = 25; rounded(ctx, enemy.x - w / 2, enemy.y - 67 * scale - 9, w, 3.5, 2, 'rgba(61,79,66,.32)');
    rounded(ctx, enemy.x - w / 2, enemy.y - 67 * scale - 9, w * Math.max(0, enemy.hp / enemy.maxHp), 3.5, 2, '#c6937b');
  }
  if (windup) {
    const y = enemy.y - (enemy.boss ? 157 : 75) * scale;
    ellipse(ctx, enemy.x, y, 7, 9, '#f0d2a4', '#bf8a70', 1.4); line(ctx, [enemy.x, y - 4, enemy.x, y], '#a86f5e', 2); ellipse(ctx, enemy.x, y + 4, 1, 1, '#a86f5e');
  }
}

function drawPlayer(ctx: Ctx, player: Player, time: number, silhouette = false, swing = 0): void {
  const frame = player.moving ? Math.floor(time * (player.dashTime > 0 ? 19 : 9)) % 4 : 0;
  const bob = player.moving ? Math.abs(Math.sin(time * 10)) * 2.3 : Math.sin(time * 2) * .7;
  const scale = .76;
  if (silhouette) {
    ctx.save(); ctx.globalAlpha = .65; ctx.strokeStyle = '#fff2b2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(player.x, player.y - 33, 24, 36, 0, 0, TAU); ctx.stroke();
    star(ctx, player.x, player.y - 78, 7, '#fce7ac'); ctx.restore(); return;
  }
  ctx.save();
  if (player.invulnerable > 0 && player.dashTime <= 0) ctx.globalAlpha = .72 + Math.sin(time * 30) * .18;
  if (player.dashTime > 0) {
    for (let i = 3; i >= 1; i--) {
      ctx.globalAlpha = .10 + (3 - i) * .035;
      drawSprite(ctx, actorSprite(player.character, frame), player.x - Math.cos(player.facing) * i * 12, player.y - Math.sin(player.facing) * i * 12 - 5, scale, Math.cos(player.facing) < -.1, Math.cos(player.facing) * .08);
    }
    ctx.globalAlpha = 1;
  }
  drawSprite(ctx, actorSprite(player.character, frame), player.x, player.y - bob - (player.dashTime > 0 ? 4 : 0), scale, Math.cos(player.facing) < -.1, (player.moving ? Math.sin(time * 10) * .015 : 0) + swing);
  if (player.hitFlash > 0) { star(ctx, player.x - 14, player.y - 40, 10, '#ffdfbd', 4, time * 6); }
  ctx.restore();
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas2D를 시작할 수 없습니다.');
  const ctx = context, ground = new Ground(), effects = new Effects();
  let width = 1280, height = 720, dpr = 1, zoom = 1, time = 0, lastElapsed = 0;
  let swordPose = 0, swordAngle = 0;
  let previousPhase: GameState['phase'] = 'title';
  let camera: Vec2 = { x: 0, y: 0 };
  let disposed = false;
  const isVisible = (x: number, y: number, margin = 160): boolean => Math.abs(x - camera.x) < width / zoom / 2 + margin && Math.abs(y - camera.y) < height / zoom / 2 + margin;

  function drawProp(prop: Prop, player?: Player): boolean {
    const scale = propScale(prop), tall = tallProps.has(prop.kind);
    const behind = !!player && tall && player.y < prop.y + 8 && player.y > prop.y - 185 * scale && Math.abs(player.x - prop.x) < (prop.kind === 'tree' ? 66 : 90) * scale;
    ctx.save(); if (behind) ctx.globalAlpha = .42;
    drawSprite(ctx, propSprite(prop.kind, prop.variant), prop.x, prop.y, scale); ctx.restore(); return behind;
  }

  function ambient(): void {
    for (let i = 0; i < 17; i++) {
      const x = camera.x - width / zoom / 2 + ((i * 173 + time * (5 + i % 3)) % (width / zoom + 60));
      const y = camera.y - height / zoom / 2 + ((i * 103 + Math.sin(time * .3 + i) * 16) % (height / zoom + 40));
      const alpha = .12 + Math.sin(time * 1.8 + i) * .1;
      ellipse(ctx, x, y, i % 4 ? 1.3 : 2.3, i % 4 ? 1.3 : 1.2, `rgba(255,245,196,${alpha})`);
    }
  }

  function titleScene(): void {
    const entries: { y: number; id: number; draw: () => void }[] = [];
    for (const prop of titleProps) {
      if (prop.kind !== 'flower' && prop.kind !== 'mushroom') shadow(ctx, prop.x, prop.y, prop.kind === 'tree' ? 48 * prop.scale : prop.radius * .8, .13);
      entries.push({ y: prop.y, id: prop.id, draw: () => { drawProp(prop); } });
    }
    const friend = (kind: 'knight' | 'slime' | 'mushroom', x: number, y: number, scale: number, id: number) => {
      shadow(ctx, x, y, kind === 'knight' ? 29 : 25, .15);
      entries.push({ y, id, draw: () => { const bob = Math.sin(time * 2.3 + id) * 2; drawSprite(ctx, actorSprite(kind, Math.floor(time * 2 + id) % 4), x, y - bob, scale, kind === 'mushroom'); } });
    };
    friend('knight', 231, 153, 1.25, 2001); friend('slime', 110, 192, .93, 2002); friend('mushroom', 371, 140, 1.02, 2003);
    entries.sort((a, b) => a.y - b.y || a.id - b.id); for (const entry of entries) entry.draw();
    for (let i = 0; i < 5; i++) { const a = time * .15 + i * 1.25; star(ctx, 231 + Math.cos(a) * 79, 107 + Math.sin(a) * 32, 2 + Math.sin(time * 2 + i), '#f6e8b7', 4, a); }
  }

  function render(state: Readonly<GameState>, dt: number, settings: Settings): void {
    if (disposed) return;
    dt = Math.max(0, Math.min(dt || 0, .05));
    const title = state.phase === 'title';
    if (state.elapsed < lastElapsed || (previousPhase !== 'title' && title)) { effects.clear(); swordPose = 0; }
    if (title || state.phase === 'playing' || state.phase === 'victory' || state.phase === 'defeat') { time += dt; effects.step(dt); swordPose = Math.max(0, swordPose - dt); }
    if (title) camera = { x: 0, y: -5 };
    else if (previousPhase === 'title' || state.elapsed < lastElapsed) camera = { x: state.player.x, y: state.player.y };
    else { const follow = 1 - Math.exp(-dt * 11); camera.x += (state.player.x - camera.x) * follow; camera.y += (state.player.y - camera.y) * follow; }
    previousPhase = state.phase; lastElapsed = state.elapsed;
    const shake = state.phase === 'playing' ? effects.shakeOffset(settings) : { x: 0, y: 0 };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#b5c9a4'; ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.translate(width / 2 + shake.x, height / 2 + shake.y); ctx.scale(zoom, zoom); ctx.translate(-camera.x, -camera.y);
    ground.draw(ctx, camera, width, height, zoom, title ? 73281 : state.seed, title);
    if (title) titleScene();
    else {
      worldEdge(ctx, state.world.halfWidth, state.world.halfHeight);
      const visibleProps = state.props.filter(prop => isVisible(prop.x, prop.y, 240));
      const visibleEnemies = state.enemies.filter(enemy => isVisible(enemy.x, enemy.y));
      for (const prop of visibleProps) if (prop.kind !== 'flower' && prop.kind !== 'mushroom') shadow(ctx, prop.x, prop.y, Math.max(12, prop.radius * .85), .12);
      for (const enemy of visibleEnemies) shadow(ctx, enemy.x, enemy.y, enemy.radius * (enemy.boss ? 1.1 : .95), enemy.kind === 'bat' ? .07 : .13);
      shadow(ctx, state.player.x, state.player.y, 21, .19);
      ctx.save(); ctx.strokeStyle = '#f0d797'; ctx.lineWidth = 1.6; ctx.globalAlpha = .75;
      ctx.beginPath(); ctx.ellipse(state.player.x, state.player.y + 1, 25, 12, 0, 0, TAU); ctx.stroke(); ctx.restore();
      for (const zone of state.zones) if (isVisible(zone.x, zone.y, zone.radius + (zone.length ?? 0))) drawZone(ctx, zone, time);
      for (const pickup of state.pickups) if (isVisible(pickup.x, pickup.y, 30)) drawPickup(ctx, pickup.x, pickup.y, pickup.kind, pickup.value, time, pickup.id);
      const entries: { y: number; id: number; draw: () => void }[] = [];
      let occluded = false;
      for (const prop of visibleProps) entries.push({ y: prop.y, id: prop.id, draw: () => { occluded = drawProp(prop, state.player) || occluded; } });
      for (const enemy of visibleEnemies) entries.push({ y: enemy.y, id: enemy.id, draw: () => drawEnemy(ctx, enemy, time) });
      const sword = state.weapons.find(weapon => weapon.id === 'sword');
      const preparation = sword && sword.cooldown > 0 && sword.cooldown < .12 ? -(1 - sword.cooldown / .12) * .055 * Math.cos(state.player.facing) : 0;
      const swing = swordPose > 0 ? Math.sin((1 - swordPose / .28) * Math.PI) * .105 * Math.cos(swordAngle) : preparation;
      entries.push({ y: state.player.y, id: state.player.id, draw: () => drawPlayer(ctx, state.player, time, false, swing) });
      entries.sort((a, b) => a.y - b.y || a.id - b.id); for (const entry of entries) entry.draw();
      for (const projectile of state.projectiles) if (isVisible(projectile.x, projectile.y, 40)) drawProjectile(ctx, projectile, time);
      for (const zone of state.zones) if (zone.owner === 'enemy' && isVisible(zone.x, zone.y, zone.radius)) drawZone(ctx, zone, time, true);
      effects.draw(ctx, time);
      if (occluded) drawPlayer(ctx, state.player, time, true);
      // Small directional hint keeps a wandering boss discoverable.
      for (const enemy of state.enemies) if (enemy.boss && !isVisible(enemy.x, enemy.y, -90)) {
        const dx = enemy.x - camera.x, dy = enemy.y - camera.y, a = Math.atan2(dy, dx);
        const safeX = width / zoom / 2 - 75, safeY = height / zoom / 2 - 145;
        const distance = Math.min(safeX / Math.max(.01, Math.abs(Math.cos(a))), Math.max(70, safeY) / Math.max(.01, Math.abs(Math.sin(a))));
        const x = camera.x + Math.cos(a) * distance, y = camera.y + Math.sin(a) * distance;
        ctx.save(); ctx.translate(x, y); ctx.rotate(a); polygon(ctx, [11, 0, -6, -8, -3, 0, -6, 8], '#c695a9', '#856d83', 1.5); ctx.restore();
      }
    }
    ambient(); ctx.restore();
    // A gentle cream vignette creates a sunlit tabletop rather than a flat green field.
    const vignette = ctx.createRadialGradient(width * .52, height * .43, height * .2, width * .5, height * .5, width * .72);
    vignette.addColorStop(0, 'rgba(255,247,212,0)'); vignette.addColorStop(1, 'rgba(237,228,185,.19)'); ctx.fillStyle = vignette; ctx.fillRect(0, 0, width, height);
    if (title) {
      const veil = ctx.createLinearGradient(0, 0, width * .57, 0); veil.addColorStop(0, 'rgba(238,234,207,.24)'); veil.addColorStop(.7, 'rgba(238,234,207,.06)'); veil.addColorStop(1, 'rgba(238,234,207,0)'); ctx.fillStyle = veil; ctx.fillRect(0, 0, width * .57, height);
    }
  }

  return {
    resize(w, h, pixelRatio) {
      width = Math.max(1, w); height = Math.max(1, h); dpr = Math.min(2, Math.max(1, pixelRatio));
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
      zoom = Math.max(.55, Math.min(width / 1280, height / 720));
    },
    consumeEvents(events: readonly GameEvent[]) {
      if (!disposed) {
        effects.consume(events);
        for (const event of events) if (event.type === 'attack' && event.weapon === 'sword') { swordPose = .28; swordAngle = event.angle ?? 0; }
      }
    },
    render,
    dispose() { disposed = true; ground.dispose(); effects.clear(); clearSpriteCache(); },
  };
}
