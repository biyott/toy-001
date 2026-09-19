import { ellipse, line, polygon, seeded, type Ctx } from './art';
import type { Prop, Vec2 } from '../types';

const SIZE = 512;
export class Ground {
  private chunks = new Map<string, HTMLCanvasElement>();
  private seed = -1;
  private title = false;

  draw(ctx: Ctx, camera: Vec2, width: number, height: number, zoom: number, seed: number, title = false): void {
    if (this.seed !== seed || this.title !== title) { this.seed = seed; this.title = title; this.chunks.clear(); }
    const minX = Math.floor((camera.x - width / zoom / 2 - 5) / SIZE);
    const maxX = Math.floor((camera.x + width / zoom / 2 + 5) / SIZE);
    const minY = Math.floor((camera.y - height / zoom / 2 - 5) / SIZE);
    const maxY = Math.floor((camera.y + height / zoom / 2 + 5) / SIZE);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const key = `${x}:${y}`;
      let canvas = this.chunks.get(key);
      if (!canvas) { canvas = this.create(x, y, seed, title); this.chunks.set(key, canvas); }
      ctx.drawImage(canvas, x * SIZE, y * SIZE, SIZE + .3, SIZE + .3);
    }
    if (this.chunks.size > 180) {
      for (const key of this.chunks.keys()) {
        const [x, y] = key.split(':').map(Number);
        if (x < minX - 2 || x > maxX + 2 || y < minY - 2 || y > maxY + 2) this.chunks.delete(key);
      }
    }
  }

  private create(cx: number, cy: number, seed: number, title: boolean): HTMLCanvasElement {
    const canvas = document.createElement('canvas'); canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const rng = seeded((seed ^ Math.imul(cx, 374761393) ^ Math.imul(cy, 668265263)) | 0);
    ctx.fillStyle = '#b5c9a4'; ctx.fillRect(0, 0, SIZE, SIZE);
    // Every broad patch belongs to a world-space cell. Neighbouring chunks paint
    // the same cells in the same order, including patches crossing their edge.
    // The small per-chunk texture below has no large shapes that expose seams.
    const patchCell = SIZE / 2;
    for (let py = cy * 2 - 1; py <= cy * 2 + 2; py++) {
      for (let px = cx * 2 - 1; px <= cx * 2 + 2; px++) {
        const patchRng = seeded((seed ^ Math.imul(px, 1597334677) ^ Math.imul(py, 3812015801)) | 0);
        for (let i = 0; i < 7; i++) {
          const x = px * patchCell + patchRng() * patchCell - cx * SIZE;
          const y = py * patchCell + patchRng() * patchCell - cy * SIZE;
          const r = 25 + patchRng() * 70;
          ellipse(ctx, x, y, r, r * .55, i % 3 ? 'rgba(139,171,127,.10)' : 'rgba(233,230,175,.16)');
        }
      }
    }
    for (let i = 0; i < 320; i++) {
      const x = rng() * SIZE, y = rng() * SIZE;
      ellipse(ctx, x, y, .6 + rng() * 1.2, .4 + rng() * .6, i % 2 ? 'rgba(95,129,89,.11)' : 'rgba(251,243,202,.22)');
    }
    for (let i = 0; i < 50; i++) {
      const x = rng() * SIZE, y = rng() * SIZE, s = 2 + rng() * 3;
      line(ctx, [x - s, y, x - s * .7, y - s, x, y + 1, x + s * .3, y - s * 1.1, x + s, y], '#96b188', 1.2);
      if (i % 8 === 0) { ellipse(ctx, x + 3, y - 4, 1.5, 1.5, '#ede1b5'); ellipse(ctx, x + 6, y - 2, 1.4, 1.4, '#e4d3b6'); }
    }
    const roadOffset = title ? 0 : -270;
    ctx.save(); ctx.translate(-cx * SIZE + roadOffset, -cy * SIZE);
    const path = () => { ctx.beginPath(); ctx.moveTo(255, -1600); ctx.bezierCurveTo(280, -650, 375, -230, 195, 50); ctx.bezierCurveTo(80, 245, -155, 280, -190, 650); ctx.bezierCurveTo(-235, 1060, -25, 1330, -110, 1800); };
    path(); ctx.strokeStyle = '#a9bc92'; ctx.lineWidth = 109; ctx.stroke();
    path(); ctx.strokeStyle = '#c6c8a1'; ctx.lineWidth = 96; ctx.stroke();
    path(); ctx.strokeStyle = '#d4cfaa'; ctx.lineWidth = 76; ctx.stroke();
    const stones = seeded(7331);
    for (let i = 0; i < 280; i++) {
      const y = -1500 + i * 12;
      let center: number;
      if (y < -230) center = 275 + Math.sin((y + 1500) / 1270 * Math.PI / 2) * 20;
      else if (y < 70) center = 290 - (y + 230) * .35;
      else if (y < 650) center = 195 - Math.sin((y - 70) / 580 * Math.PI / 2) * 385;
      else center = -190 + Math.sin((y - 650) / 850 * Math.PI) * 58;
      const x = center + (stones() - .5) * 53;
      if (Math.abs(x + roadOffset - (cx + .5) * SIZE) > 300 || Math.abs(y - (cy + .5) * SIZE) > 300) continue;
      const sx = 9 + stones() * 13, sy = 4 + stones() * 5;
      polygon(ctx, [x - sx, y, x - sx * .7, y - sy, x + sx * .65, y - sy * .6, x + sx, y + sy * .6, x, y + sy], '#dce0bf', '#bcc2a0', 1);
      line(ctx, [x - sx * .65, y - sy + 1, x + sx * .4, y - sy * .6], '#ecedcf', 1);
    }
    ctx.restore(); return canvas;
  }

  dispose(): void { this.chunks.clear(); }
}

export const titleProps: Prop[] = [
  { id: -1, kind: 'gate', x: 274, y: -68, radius: 80, scale: 1.12, variant: 0, solid: false },
  { id: -2, kind: 'wall', x: 97, y: -52, radius: 65, scale: .86, variant: 0, solid: false },
  { id: -3, kind: 'wall', x: 453, y: -47, radius: 65, scale: .86, variant: 0, solid: false },
  { id: -4, kind: 'house', x: 490, y: 82, radius: 65, scale: .84, variant: 0, solid: false },
  { id: -5, kind: 'well', x: 36, y: 90, radius: 35, scale: .68, variant: 0, solid: false },
  { id: -6, kind: 'tree', x: 79, y: -144, radius: 45, scale: 1.03, variant: 0, solid: false },
  { id: -7, kind: 'tree', x: 493, y: -152, radius: 45, scale: 1.16, variant: 1, solid: false },
  { id: -8, kind: 'tree', x: 576, y: 198, radius: 45, scale: 1.18, variant: 0, solid: false },
  { id: -9, kind: 'tree', x: -121, y: 245, radius: 45, scale: .94, variant: 1, solid: false },
  { id: -10, kind: 'tree', x: -100, y: -181, radius: 45, scale: .96, variant: 1, solid: false },
  { id: -11, kind: 'banner', x: 168, y: -26, radius: 15, scale: .75, variant: 0, solid: false },
  { id: -12, kind: 'mushroom', x: 78, y: 220, radius: 15, scale: .7, variant: 0, solid: false },
  { id: -13, kind: 'mushroom', x: 61, y: 222, radius: 15, scale: .4, variant: 1, solid: false },
  { id: -14, kind: 'rock', x: 454, y: 213, radius: 30, scale: .65, variant: 0, solid: false },
  { id: -15, kind: 'flower', x: 352, y: 154, radius: 8, scale: .9, variant: 1, solid: false },
  { id: -16, kind: 'flower', x: 96, y: 26, radius: 8, scale: .85, variant: 0, solid: false },
];

export function worldEdge(ctx: Ctx, halfWidth: number, halfHeight: number): void {
  ctx.save(); ctx.strokeStyle = 'rgba(105,137,104,.5)'; ctx.lineWidth = 5; ctx.setLineDash([6, 14]);
  ctx.strokeRect(-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2); ctx.restore();
}
