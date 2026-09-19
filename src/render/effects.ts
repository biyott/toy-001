import type { GameEvent, Settings, Vec2 } from '../types';
import { ellipse, line, polygon, star, type Ctx } from './art';

interface Particle extends Vec2 { vx: number; vy: number; life: number; total: number; size: number; color: string; shape: 'star' | 'dot' | 'stone'; }
interface FloatText extends Vec2 { life: number; total: number; text: string; color: string; size: number; }
type Element = 'fire' | 'frost' | 'lightning' | 'stone' | 'spore' | 'enemy-spore' | 'enemy-bone' | 'royal-spore';
interface Flash extends Vec2 { life: number; total: number; radius: number; type: string; angle: number; targetX?: number; targetY?: number; element?: Element; }
const ELEMENT_COLORS: Record<Element, { light: string; dark: string; particle: string }> = {
  fire: { light: '#ffe0a0', dark: '#d58b61', particle: '#edb071' },
  frost: { light: '#d8f3ee', dark: '#80bcc9', particle: '#a9dce3' },
  lightning: { light: '#fff1b1', dark: '#c5a24e', particle: '#efd476' },
  stone: { light: '#d8dbc5', dark: '#82998f', particle: '#a7b6ac' },
  spore: { light: '#f7dab1', dark: '#b88d9e', particle: '#c9afc2' },
  'enemy-spore': { light: '#f5f1bb', dark: '#aa3e69', particle: '#bbd993' },
  'enemy-bone': { light: '#fff1d0', dark: '#a43e64', particle: '#dfd6b5' },
  'royal-spore': { light: '#fbe6c3', dark: '#a33670', particle: '#d7a4d1' },
};
function eventElement(event: GameEvent): Element {
  const kind = event.kind ?? '';
  if (kind.startsWith('enemy-royal-spore') || kind === 'spore-burst') return 'royal-spore';
  if (kind.startsWith('enemy-bone')) return 'enemy-bone';
  if (kind.startsWith('enemy-spore')) return 'enemy-spore';
  if (event.weapon === 'fireball' || kind.includes('fire')) return 'fire';
  if (event.weapon === 'frost' || kind.includes('frost')) return 'frost';
  if (event.weapon === 'lightning' || kind.includes('lightning')) return 'lightning';
  return kind.includes('golem') ? 'stone' : 'spore';
}

export class Effects {
  private particles: Particle[] = [];
  private texts: FloatText[] = [];
  private flashes: Flash[] = [];
  private shake = 0;
  private random = 78349;

  private rng(): number { this.random = Math.imul(this.random, 1664525) + 1013904223 | 0; return (this.random >>> 0) / 4294967296; }

  consume(events: readonly GameEvent[]): void {
    for (const event of events) {
      const hit = event.type === 'hit', kill = event.type === 'kill';
      const element = eventElement(event), colors = ELEMENT_COLORS[element];
      if (event.type === 'attack') {
        const enemyLaunch = !!event.kind?.startsWith('enemy-') && event.kind.endsWith('-launch');
        const aimOnly = !!event.kind && (event.kind.endsWith('-aim') || event.kind.endsWith('-target'));
        if (enemyLaunch) {
          const angle = event.angle ?? 0, royal = element === 'royal-spore';
          const x = event.x + Math.cos(angle) * (royal ? 27 : 14);
          const y = event.y - (royal ? 32 : 17) + Math.sin(angle) * 8;
          this.flashes.push({ x, y, life: .19, total: .19, radius: royal ? 18 : 11, type: 'enemy-muzzle', angle, element });
          for (let i = 0; i < 4; i++) {
            const a = angle + (i - 1.5) * .27;
            this.particles.push({ x, y, vx: Math.cos(a) * (45 + i * 8), vy: Math.sin(a) * 35 - 8, life: .23, total: .23, size: 2.2 + i * .35, color: i % 2 ? colors.light : colors.particle, shape: element === 'enemy-bone' ? 'stone' : 'dot' });
          }
        }
        const type = event.weapon === 'lightning' ? 'lightning' : event.weapon === 'sword' ? 'sword' : 'spark';
        if (type !== 'spark') this.flashes.push({ x: event.x, y: event.y - 12, life: .23, total: .23, radius: event.radius ?? 56, type, angle: event.angle ?? 0, targetX: event.targetX, targetY: event.targetY, element });
        if (event.weapon === 'fireball' || event.weapon === 'frost') this.flashes.push({ x: event.x, y: event.y - 28, life: .24, total: .24, radius: 19, type: 'cast', angle: event.angle ?? 0, element });
        if (event.kind && event.kind !== 'goblin-charge' && !enemyLaunch && !aimOnly) {
          const fissure = event.kind === 'golem-fissure';
          this.flashes.push({ x: event.x, y: event.y, life: .4, total: .4, radius: event.radius ?? 60, type: fissure ? 'fissure' : 'impact', angle: event.angle ?? 0, element });
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            const direction = event.angle ?? 0, spread = (this.rng() - .5) * 30;
            const x = fissure ? event.x + Math.cos(direction) * (event.radius ?? 60) * (i + .5) / 8 - Math.sin(direction) * spread : event.x + Math.cos(a) * (event.radius ?? 60) * .6;
            const y = fissure ? event.y + Math.sin(direction) * (event.radius ?? 60) * (i + .5) / 8 + Math.cos(direction) * spread : event.y + Math.sin(a) * (event.radius ?? 60) * .6;
            this.particles.push({ x, y, vx: Math.cos(a) * 28, vy: Math.sin(a) * 20 - 18, life: .45, total: .45, size: 3 + this.rng() * 3, color: i % 2 ? colors.light : colors.particle, shape: element === 'stone' || element === 'enemy-bone' ? 'stone' : element === 'fire' || element === 'enemy-spore' || element === 'royal-spore' ? 'dot' : 'star' });
          }
        }
      }
      if (hit || kill) {
        const amount = kill ? 7 : 3;
        for (let i = 0; i < amount; i++) {
          const a = this.rng() * Math.PI * 2, speed = 22 + this.rng() * 65;
          this.particles.push({ x: event.x, y: event.y - 15, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 24, life: .3 + this.rng() * .22, total: .52, size: 2 + this.rng() * 3, color: kill ? ['#fff1bd', '#e8c477', '#d8e6ad'][i % 3] : element === 'spore' ? '#fff3cf' : i % 2 ? colors.light : colors.particle, shape: 'star' });
        }
        if (hit && event.value && this.texts.length < 48) this.texts.push({ x: event.x + (this.rng() - .5) * 14, y: event.y - 44, life: .65, total: .65, text: `${Math.round(event.value)}`, color: event.kind === 'player' ? '#bd695e' : '#fff2cb', size: event.value > 30 ? 17 : 13 });
        if (event.kind === 'player') this.shake = Math.max(this.shake, 4);
      }
      if (event.type === 'levelup' || event.type === 'upgrade' || event.type === 'victory') {
        this.flashes.push({ x: event.x, y: event.y, radius: event.type === 'victory' ? 180 : 84, life: .75, total: .75, type: 'level', angle: 0 });
        for (let i = 0; i < 24; i++) {
          const a = i / 24 * Math.PI * 2;
          this.particles.push({ x: event.x, y: event.y - 16, vx: Math.cos(a) * (55 + this.rng() * 60), vy: Math.sin(a) * 65 - 35, life: .65 + this.rng() * .4, total: 1.05, size: 3 + this.rng() * 3, color: i % 3 ? '#f8df94' : '#d8c7ec', shape: 'star' });
        }
      }
      if (event.type === 'dash') {
        this.flashes.push({ x: event.x, y: event.y, radius: 25, life: .3, total: .3, type: 'dash', angle: event.angle ?? 0 });
        for (let i = 0; i < 6; i++) this.particles.push({ x: event.x - Math.cos(event.angle ?? 0) * i * 7, y: event.y - 8 - Math.sin(event.angle ?? 0) * i * 7, vx: -Math.cos(event.angle ?? 0) * 18, vy: -8, life: .25 + i * .03, total: .45, size: 8 - i * .8, color: '#e6e3c3', shape: 'dot' });
      }
      if (event.type === 'boss') { this.shake = 4; this.flashes.push({ x: event.x, y: event.y, radius: 100, life: 1, total: 1, type: 'boss', angle: 0, element }); }
      if (event.type === 'heal') this.texts.push({ x: event.x, y: event.y - 45, life: .9, total: .9, text: `+${Math.round(event.value ?? 0)}`, color: '#c7e8b5', size: 17 });
    }
    if (this.particles.length > 450) this.particles.splice(0, this.particles.length - 450);
    if (this.flashes.length > 70) this.flashes.splice(0, this.flashes.length - 70);
  }

  step(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 15);
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; }
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 26; }
    for (const f of this.flashes) f.life -= dt;
    this.particles = this.particles.filter(p => p.life > 0); this.texts = this.texts.filter(t => t.life > 0); this.flashes = this.flashes.filter(f => f.life > 0);
  }

  shakeOffset(settings: Settings): Vec2 {
    if (settings.reducedMotion || this.shake < .1) return { x: 0, y: 0 };
    return { x: (this.rng() - .5) * this.shake, y: (this.rng() - .5) * this.shake };
  }

  draw(ctx: Ctx, time: number): void {
    for (const f of this.flashes) {
      const p = 1 - f.life / f.total; ctx.save(); ctx.globalAlpha = Math.min(1, f.life / f.total * 2);
      const colors = ELEMENT_COLORS[f.element ?? 'spore'];
      if (f.type === 'sword') {
        ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        ctx.beginPath(); ctx.arc(0, 0, f.radius * (.75 + p * .35), -.95 + p * .7, 1.05 + p * .3); ctx.strokeStyle = '#fff0c1'; ctx.lineWidth = 9 * (1 - p) + 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, f.radius * (.78 + p * .35), -.7 + p * .6, .7 + p * .3); ctx.strokeStyle = '#e2b266'; ctx.lineWidth = 2; ctx.stroke();
      } else if (f.type === 'lightning' && f.targetX !== undefined && f.targetY !== undefined) {
        const dx = f.targetX - f.x, dy = f.targetY - f.y; const points = [f.x, f.y];
        for (let i = 1; i < 5; i++) points.push(f.x + dx * i / 5 + Math.sin(i * 7 + time * 40) * 8, f.y + dy * i / 5 + Math.cos(i * 4 + time * 30) * 8);
        points.push(f.targetX, f.targetY - 10); line(ctx, points, '#d7b357', 6); line(ctx, points, '#fff2ba', 2.5);
      } else if (f.type === 'level' || f.type === 'boss') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.25 + p), f.radius * (.25 + p) * .6, 0, 0, Math.PI * 2); ctx.strokeStyle = f.type === 'boss' ? colors.dark : '#f0d28c'; ctx.lineWidth = 4 * (1 - p) + 1; ctx.stroke();
      } else if (f.type === 'impact') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.55 + p * .45), f.radius * (.55 + p * .45), 0, 0, Math.PI * 2); ctx.strokeStyle = colors.light; ctx.lineWidth = 4 * (1 - p) + 1; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.35 + p * .6), f.radius * (.35 + p * .6), 0, 0, Math.PI * 2); ctx.strokeStyle = colors.dark; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (f.type === 'cast') {
        star(ctx, f.x + Math.cos(f.angle) * 24, f.y + Math.sin(f.angle) * 13, f.radius * (1 - p * .65), colors.light, f.element === 'frost' ? 6 : 4, f.angle + p * .5);
      } else if (f.type === 'enemy-muzzle') {
        ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        polygon(ctx, [f.radius * (1 - p * .5), 0, 2, -f.radius * .38, -4, 0, 2, f.radius * .38], colors.light, colors.dark, 1.7);
        ctx.beginPath(); ctx.arc(0, 0, f.radius * (.4 + p * .5), -.8, .8); ctx.strokeStyle = colors.dark; ctx.lineWidth = 2 * (1 - p) + .5; ctx.stroke();
      } else if (f.type === 'fissure') {
        const points = [f.x, f.y];
        for (let i = 1; i <= 12; i++) {
          const forward = f.radius * i / 12, side = i === 12 ? 0 : (i % 2 ? -1 : 1) * (4 + i % 3 * 3);
          points.push(f.x + Math.cos(f.angle) * forward - Math.sin(f.angle) * side, f.y + Math.sin(f.angle) * forward + Math.cos(f.angle) * side);
        }
        line(ctx, points, colors.dark, 7 * (1 - p) + 1); line(ctx, points, colors.light, 2.2 * (1 - p) + .6);
      } else if (f.type === 'dash') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.5 + p), f.radius * .4, f.angle, 0, Math.PI * 2); ctx.strokeStyle = '#e9ebd0'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.total * 2);
      if (p.shape === 'star') star(ctx, p.x, p.y, p.size * (.7 + p.life / p.total * .3), p.color, 4, time * 2);
      else if (p.shape === 'stone') polygon(ctx, [p.x - p.size, p.y, p.x - p.size * .5, p.y - p.size, p.x + p.size * .6, p.y - p.size * .6, p.x + p.size, p.y + p.size * .6, p.x, p.y + p.size], p.color, '#87998b', .6);
      else ellipse(ctx, p.x, p.y, p.size, p.size * .6, p.color);
    }
    ctx.globalAlpha = 1;
    for (const t of this.texts) {
      ctx.save(); ctx.globalAlpha = Math.min(1, t.life / t.total * 2.5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `800 ${t.size}px "Noto Sans KR", sans-serif`; ctx.strokeStyle = '#536351'; ctx.lineWidth = 3; ctx.strokeText(t.text, t.x, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y); ctx.restore();
    }
  }

  clear(): void { this.particles = []; this.texts = []; this.flashes = []; this.shake = 0; }
}
