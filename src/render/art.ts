export type Ctx = CanvasRenderingContext2D;
export const INK = '#3f4e48';

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, width = 2): void {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function line(ctx: Ctx, points: number[], color: string, width = 2): void {
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

export function polygon(ctx: Ctx, points: number[], fill: string, stroke?: string, width = 2): void {
  ctx.beginPath(); ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.stroke(); }
}

export function rounded(ctx: Ctx, x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string, width = 2): void {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}

export function star(ctx: Ctx, x: number, y: number, radius: number, color: string, points = 4, rotation = 0): void {
  const coords: number[] = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = i * Math.PI / points + rotation - Math.PI / 2;
    const r = i % 2 ? radius * .36 : radius;
    coords.push(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
  }
  polygon(ctx, coords, color);
}

export function eye(ctx: Ctx, x: number, y: number, radius = 5, look = 0): void {
  ellipse(ctx, x, y, radius, radius * 1.15, '#354245');
  ellipse(ctx, x - radius * .28 + look, y - radius * .34, radius * .3, radius * .34, '#fffdf0');
  ellipse(ctx, x + radius * .3, y + radius * .35, radius * .13, radius * .14, '#d6eeef');
}

export function seeded(seed: number): () => number {
  let value = seed | 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ value >>> 15, 1 | value);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
