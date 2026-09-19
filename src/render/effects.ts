import type { GameEvent, Settings, Vec2 } from '../types';
import { ellipse, line, star, type Ctx } from './art';

interface Particle extends Vec2 { vx: number; vy: number; life: number; total: number; size: number; color: string; shape: 'star' | 'dot' | 'leaf'; }
interface FloatText extends Vec2 { life: number; total: number; text: string; color: string; size: number; }
interface Flash extends Vec2 { life: number; total: number; radius: number; type: string; angle: number; targetX?: number; targetY?: number; }

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
      if (event.type === 'attack') {
        const type = event.weapon === 'lightning' ? 'lightning' : event.weapon === 'sword' ? 'sword' : 'spark';
        if (type !== 'spark') this.flashes.push({ x: event.x, y: event.y - 12, life: .23, total: .23, radius: event.radius ?? 56, type, angle: event.angle ?? 0, targetX: event.targetX, targetY: event.targetY });
        if (event.kind && event.kind !== 'goblin-charge') {
          this.flashes.push({ x: event.x, y: event.y, life: .4, total: .4, radius: event.radius ?? 60, type: 'impact', angle: event.angle ?? 0 });
          for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            this.particles.push({ x: event.x + Math.cos(a) * (event.radius ?? 60) * .6, y: event.y + Math.sin(a) * (event.radius ?? 60) * .6, vx: Math.cos(a) * 28, vy: Math.sin(a) * 20 - 18, life: .45, total: .45, size: 3 + this.rng() * 3, color: i % 2 ? '#ecd3a8' : '#c9afc2', shape: 'star' });
          }
        }
      }
      if (hit || kill) {
        const amount = kill ? 7 : 3;
        for (let i = 0; i < amount; i++) {
          const a = this.rng() * Math.PI * 2, speed = 22 + this.rng() * 65;
          this.particles.push({ x: event.x, y: event.y - 15, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 24, life: .3 + this.rng() * .22, total: .52, size: 2 + this.rng() * 3, color: kill ? ['#fff1bd', '#e8c477', '#d8e6ad'][i % 3] : '#fff3cf', shape: 'star' });
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
      if (event.type === 'boss') { this.shake = 4; this.flashes.push({ x: event.x, y: event.y, radius: 100, life: 1, total: 1, type: 'boss', angle: 0 }); }
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
      if (f.type === 'sword') {
        ctx.translate(f.x, f.y); ctx.rotate(f.angle);
        ctx.beginPath(); ctx.arc(0, 0, f.radius * (.75 + p * .35), -.95 + p * .7, 1.05 + p * .3); ctx.strokeStyle = '#fff0c1'; ctx.lineWidth = 9 * (1 - p) + 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, f.radius * (.78 + p * .35), -.7 + p * .6, .7 + p * .3); ctx.strokeStyle = '#e2b266'; ctx.lineWidth = 2; ctx.stroke();
      } else if (f.type === 'lightning' && f.targetX !== undefined && f.targetY !== undefined) {
        const dx = f.targetX - f.x, dy = f.targetY - f.y; const points = [f.x, f.y];
        for (let i = 1; i < 5; i++) points.push(f.x + dx * i / 5 + Math.sin(i * 7 + time * 40) * 8, f.y + dy * i / 5 + Math.cos(i * 4 + time * 30) * 8);
        points.push(f.targetX, f.targetY - 10); line(ctx, points, '#ae91d0', 6); line(ctx, points, '#fbefd7', 2.5);
      } else if (f.type === 'level' || f.type === 'boss') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.25 + p), f.radius * (.25 + p) * .6, 0, 0, Math.PI * 2); ctx.strokeStyle = f.type === 'boss' ? '#c594af' : '#f0d28c'; ctx.lineWidth = 4 * (1 - p) + 1; ctx.stroke();
      } else if (f.type === 'impact') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.55 + p * .45), f.radius * (.55 + p * .45), 0, 0, Math.PI * 2); ctx.strokeStyle = '#f7dab1'; ctx.lineWidth = 4 * (1 - p) + 1; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.35 + p * .6), f.radius * (.35 + p * .6), 0, 0, Math.PI * 2); ctx.strokeStyle = '#b88d9e'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (f.type === 'dash') {
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.radius * (.5 + p), f.radius * .4, f.angle, 0, Math.PI * 2); ctx.strokeStyle = '#e9ebd0'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.min(1, p.life / p.total * 2);
      if (p.shape === 'star') star(ctx, p.x, p.y, p.size * (.7 + p.life / p.total * .3), p.color, 4, time * 2);
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
