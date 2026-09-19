import type { Zone } from '../types';

type Ctx = CanvasRenderingContext2D;
type CanvasFactory = () => HTMLCanvasElement;
interface Geometry {
  shape: Zone['shape']; radius: number; innerRadius: number; length: number; width: number;
}
interface Bounds { left: number; top: number; width: number; height: number; }
interface CachedZone extends Bounds {
  fill: HTMLCanvasElement; hatch: HTMLCanvasElement; pixels: number;
}

const TAU = Math.PI * 2;
const MAX_ENTRIES = 96;
const MAX_PIXELS = 8_388_608; // Both RGBA layers combined: at most 32 MiB.
const MAX_ENTRY_PIXELS = 2_097_152;
const MAX_EDGE = 2048;
const PAD = 2;

function geometryOf(zone: Zone): Geometry | undefined {
  const shape = zone.shape;
  if (shape !== 'circle' && shape !== 'ring' && shape !== 'line' && shape !== 'cone') return;
  const radius = shape === 'line' ? 0 : zone.radius;
  const innerRadius = shape === 'ring' ? zone.innerRadius ?? 0 : 0;
  const length = shape === 'line' ? zone.length ?? zone.radius : 0;
  const width = shape === 'line' ? zone.width ?? 24 : shape === 'cone' ? zone.width ?? 1.6 : 0;
  if (![radius, innerRadius, length, width].every(Number.isFinite)) return;
  if (radius < 0 || innerRadius < 0 || innerRadius > radius || length < 0 || width < 0) return;
  if (shape !== 'line' && radius === 0 || shape === 'line' && (length === 0 || width === 0) || shape === 'cone' && width === 0) return;
  // Canvas and collision both cover the entire disc above a full revolution.
  return { shape, radius, innerRadius, length, width: shape === 'cone' ? Math.min(TAU, width) : width };
}

function boundsOf(g: Geometry): Bounds {
  let left: number, right: number, top: number, bottom: number;
  if (g.shape === 'line') {
    left = 0; right = g.length; top = -g.width / 2; bottom = g.width / 2;
  } else if (g.shape === 'cone') {
    const half = g.width / 2;
    const xs = [0, g.radius * Math.cos(-half), g.radius * Math.cos(half)];
    const ys = [0, g.radius * Math.sin(-half), g.radius * Math.sin(half)];
    for (const a of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
      if (a >= -half && a <= half) { xs.push(Math.cos(a) * g.radius); ys.push(Math.sin(a) * g.radius); }
    }
    left = Math.min(...xs); right = Math.max(...xs); top = Math.min(...ys); bottom = Math.max(...ys);
  } else { left = -g.radius; right = g.radius; top = -g.radius; bottom = g.radius; }
  return { left: left - PAD, top: top - PAD, width: right - left + PAD * 2, height: bottom - top + PAD * 2 };
}

function localPath(ctx: Ctx, g: Geometry): void {
  ctx.beginPath();
  if (g.shape === 'line') {
    ctx.rect(0, -g.width / 2, g.length, g.width);
  } else if (g.shape === 'cone') {
    ctx.moveTo(0, 0); ctx.arc(0, 0, g.radius, -g.width / 2, g.width / 2); ctx.closePath();
  } else {
    ctx.arc(0, 0, g.radius, 0, TAU);
    if (g.shape === 'ring' && g.innerRadius > 0) { ctx.moveTo(g.innerRadius, 0); ctx.arc(0, 0, g.innerRadius, 0, TAU, true); }
  }
}

/** Static coverage only. The caller retains all live warning/progress signals. */
export class ZoneCache {
  private entries = new Map<string, CachedZone>();
  private pixels = 0;
  private hits = 0;
  private misses = 0;

  constructor(private readonly makeCanvas: CanvasFactory = () => document.createElement('canvas')) {}

  draw(ctx: Ctx, zone: Zone, fillAlpha: number, requestedScale: number): boolean {
    if (![zone.x, zone.y, zone.angle, fillAlpha, requestedScale].every(Number.isFinite) || requestedScale <= 0 || requestedScale > 4) return false;
    const g = geometryOf(zone); if (!g) return false;
    // Never reduce resolution below the actual world-to-backing-store scale.
    const scale = Math.max(1, requestedScale);
    const waiting = zone.telegraph > 0;
    const key = [g.shape, g.radius, g.innerRadius, g.length, g.width, waiting ? 'warning' : 'active', scale].join(':');
    let cached = this.entries.get(key);
    if (cached) {
      this.hits++; this.entries.delete(key); this.entries.set(key, cached);
    } else {
      const bounds = boundsOf(g);
      const width = Math.ceil(bounds.width * scale), height = Math.ceil(bounds.height * scale);
      const pixels = width * height * 2;
      if (![width, height, pixels].every(Number.isFinite) || width < 1 || height < 1 || width > MAX_EDGE || height > MAX_EDGE || pixels > MAX_ENTRY_PIXELS) return false;
      while (this.entries.size >= MAX_ENTRIES || this.pixels + pixels > MAX_PIXELS) {
        const oldest = this.entries.keys().next().value;
        if (oldest === undefined) break;
        this.pixels -= this.entries.get(oldest)!.pixels; this.entries.delete(oldest);
      }
      const fill = this.makeCanvas(), hatch = this.makeCanvas();
      fill.width = hatch.width = width; fill.height = hatch.height = height;
      const fillCtx = fill.getContext('2d'), hatchCtx = hatch.getContext('2d');
      if (!fillCtx || !hatchCtx) return false;
      for (const target of [fillCtx, hatchCtx]) target.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);
      localPath(fillCtx, g); fillCtx.fillStyle = waiting ? '#cc705a' : '#dc7b67'; fillCtx.fill('evenodd');
      // This clip is done only on a cache miss, within the shape's tight bounds.
      hatchCtx.save(); localPath(hatchCtx, g); hatchCtx.clip('evenodd');
      hatchCtx.beginPath();
      const y1 = bounds.top - PAD, y2 = bounds.top + bounds.height + PAD;
      const dx = (y2 - y1) / 2;
      const start = Math.floor((bounds.left - dx - 17) / 17) * 17;
      for (let x = start; x <= bounds.left + bounds.width + 17; x += 17) { hatchCtx.moveTo(x, y1); hatchCtx.lineTo(x + dx, y2); }
      hatchCtx.strokeStyle = 'rgba(183,91,73,.14)'; hatchCtx.lineWidth = 3; hatchCtx.lineCap = 'round'; hatchCtx.stroke(); hatchCtx.restore();
      cached = { ...bounds, width: width / scale, height: height / scale, fill, hatch, pixels };
      this.entries.set(key, cached); this.pixels += pixels; this.misses++;
    }
    ctx.save(); ctx.translate(zone.x, zone.y);
    if (g.shape === 'line' || g.shape === 'cone') ctx.rotate(zone.angle);
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * Math.max(0, Math.min(1, fillAlpha));
    ctx.drawImage(cached.fill, cached.left, cached.top, cached.width, cached.height);
    ctx.globalAlpha = alpha;
    ctx.drawImage(cached.hatch, cached.left, cached.top, cached.width, cached.height);
    ctx.restore(); return true;
  }

  getStats(): Readonly<{ entries: number; pixels: number; hits: number; misses: number }> {
    return { entries: this.entries.size, pixels: this.pixels, hits: this.hits, misses: this.misses };
  }

  clear(): void { this.entries.clear(); this.pixels = 0; this.hits = 0; this.misses = 0; }
}
