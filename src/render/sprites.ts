import { ellipse, eye, INK, line, polygon, rounded, star, type Ctx } from './art';
import type { CharacterId, EnemyKind, Prop } from '../types';

export interface Sprite { canvas: HTMLCanvasElement; width: number; height: number; anchorX: number; anchorY: number; }
const actors = new Map<string, Sprite>();
const props = new Map<string, Sprite>();

function sprite(width: number, height: number, anchorX: number, anchorY: number, paint: (ctx: Ctx) => void): Sprite {
  const canvas = document.createElement('canvas'); canvas.width = width * 2; canvas.height = height * 2;
  const ctx = canvas.getContext('2d')!; ctx.scale(2, 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  paint(ctx); return { canvas, width, height, anchorX, anchorY };
}

function boots(ctx: Ctx, frame: number, color = '#66564b'): void {
  const stride = [0, -3, 0, 3][frame % 4];
  rounded(ctx, 44, 119 + stride, 17, 13, 6, color, INK, 2.5);
  rounded(ctx, 67, 119 - stride, 17, 13, 6, color, INK, 2.5);
  line(ctx, [48, 122 + stride, 56, 122 + stride], '#b29370', 2);
  line(ctx, [71, 122 - stride, 79, 122 - stride], '#b29370', 2);
}

function knight(ctx: Ctx, frame: number): void {
  polygon(ctx, [40, 88, 80, 88, 92, 126, 65, 121, 38, 128], '#517d94', INK, 2.5);
  polygon(ctx, [47, 90, 64, 94, 65, 121, 38, 128], '#78aebb');
  boots(ctx, frame);
  rounded(ctx, 43, 92, 42, 33, 13, '#bfcccb', INK, 2.8);
  rounded(ctx, 49, 94, 29, 19, 8, '#e3e8d9');
  line(ctx, [45, 115, 83, 115], '#827b64', 6);
  rounded(ctx, 59, 111, 10, 9, 2, '#e7be62', '#7a705a', 1.5);
  ellipse(ctx, 36, 99, 11, 13, '#c2cfce', INK, 2.5);
  ellipse(ctx, 89, 101, 10, 12, '#b0c1c4', INK, 2.5);
  // Friendly open-face helmet, with a large face and visible expression.
  ellipse(ctx, 63, 71, 33, 30, '#9eb7be', INK, 3);
  ellipse(ctx, 61, 66, 28, 23, '#d6e2df');
  ellipse(ctx, 63, 77, 25, 21, '#f5d9ad', '#5e6760', 2.2);
  ellipse(ctx, 48, 83, 6, 3, '#e5ac95'); ellipse(ctx, 80, 83, 6, 3, '#e5ac95');
  eye(ctx, 53, 75, 5.5); eye(ctx, 74, 75, 5.5);
  line(ctx, [60, 88, 64, 90, 68, 88], '#8e725e', 1.8);
  polygon(ctx, [34, 66, 36, 48, 55, 40, 74, 41, 92, 52, 94, 69, 81, 58, 49, 59], '#cbdcdb', INK, 2.7);
  polygon(ctx, [44, 47, 59, 42, 77, 47, 70, 52, 48, 54], '#eff0d9');
  rounded(ctx, 59, 37, 10, 26, 4, '#e4bb60', '#777158', 2);
  polygon(ctx, [64, 39, 66, 23, 81, 15, 96, 20, 88, 27, 74, 29, 72, 40], '#dba46e', INK, 2.2);
  polygon(ctx, [70, 27, 81, 20, 91, 20, 85, 24], '#f2ca87');
  ellipse(ctx, 34, 71, 7, 16, '#a1bac1', INK, 2.3);
  ellipse(ctx, 93, 71, 6, 16, '#a1bac1', INK, 2.3);
  ellipse(ctx, 34, 67, 2, 6, '#dbe8e3');
  // Small toy shield and overlarge sword.
  polygon(ctx, [21, 99, 35, 91, 49, 99, 46, 116, 35, 125, 24, 116], '#769ba8', INK, 2.5);
  polygon(ctx, [26, 101, 35, 97, 44, 101, 42, 113, 35, 119, 28, 113], '#a6c6cd', '#d5cc8d', 2);
  star(ctx, 35, 107, 6, '#f9e4a2');
  ctx.save(); ctx.translate(98, 107); ctx.rotate(-.35);
  polygon(ctx, [-4, -10, -5, -35, 0, -46, 5, -35, 4, -10], '#d8e8e3', INK, 2);
  polygon(ctx, [0, -42, 4, -34, 3, -12, 0, -12], '#a3c2cc');
  line(ctx, [-10, -8, 10, -8], '#e2bc66', 5); line(ctx, [0, -5, 0, 5], '#6f604f', 5);
  ellipse(ctx, 0, 6, 3.5, 3.5, '#e0b662', INK, 1.3); ctx.restore();
}

function mage(ctx: Ctx, frame: number): void {
  boots(ctx, frame, '#70617f');
  polygon(ctx, [47, 83, 79, 83, 91, 127, 65, 132, 37, 127], '#8c79b5', INK, 2.5);
  polygon(ctx, [49, 93, 58, 97, 54, 128, 40, 126], '#b59bd0');
  line(ctx, [47, 113, 81, 113], '#dfbd71', 4); star(ctx, 67, 116, 5, '#ffe1a0');
  ellipse(ctx, 62, 76, 27, 24, '#f2d9b5', INK, 2.5);
  ellipse(ctx, 45, 84, 5, 3, '#e4ae9c'); ellipse(ctx, 80, 84, 5, 3, '#e4ae9c');
  eye(ctx, 52, 76, 5.5); eye(ctx, 73, 76, 5.5); line(ctx, [58, 88, 63, 90, 67, 87], '#876b61', 2);
  polygon(ctx, [33, 68, 40, 39, 60, 43, 77, 64, 66, 62, 56, 56, 47, 62, 41, 71], '#ddd0bb', INK, 2);
  ellipse(ctx, 62, 57, 44, 12, '#8976b0', INK, 2.5);
  polygon(ctx, [30, 54, 51, 15, 67, 24, 80, 21, 76, 40, 95, 55], '#927bbb', INK, 2.8);
  polygon(ctx, [39, 49, 52, 20, 60, 28, 55, 47], '#b2a0d2');
  line(ctx, [37, 50, 88, 50], '#e4bd71', 5); star(ctx, 76, 39, 6, '#f5d494');
  ellipse(ctx, 36, 104, 9, 9, '#f2d9b5', INK, 2);
  ellipse(ctx, 91, 104, 9, 9, '#f2d9b5', INK, 2);
  line(ctx, [98, 125, 101, 69], '#866754', 6); line(ctx, [99, 92, 100, 76], '#c4a274', 2);
  ellipse(ctx, 101, 62, 10, 12, '#a896d7', INK, 2); star(ctx, 99, 59, 6, '#f9efd0');
}

function ranger(ctx: Ctx, frame: number): void {
  boots(ctx, frame);
  polygon(ctx, [43, 90, 80, 90, 90, 125, 64, 131, 38, 127], '#618c71', INK, 2.5);
  rounded(ctx, 48, 94, 29, 28, 9, '#95ad80', INK, 2);
  line(ctx, [44, 114, 80, 114], '#866448', 5);
  ellipse(ctx, 63, 72, 31, 28, '#648c70', INK, 2.8);
  ellipse(ctx, 63, 78, 25, 22, '#f4d3aa', INK, 2);
  polygon(ctx, [38, 75, 41, 54, 61, 46, 87, 57, 92, 75, 78, 67, 69, 67, 51, 74, 48, 65], '#aa7048', INK, 2);
  polygon(ctx, [31, 62, 38, 45, 78, 34, 95, 60, 75, 54, 50, 57], '#6f9877', INK, 2.5);
  line(ctx, [43, 52, 77, 43], '#a6be88', 3);
  polygon(ctx, [83, 45, 88, 27, 102, 17, 104, 29, 88, 48], '#f1d29b', INK, 1.7);
  eye(ctx, 53, 79, 5); eye(ctx, 74, 79, 5); ellipse(ctx, 44, 86, 5, 3, '#e4a88c'); ellipse(ctx, 83, 86, 5, 3, '#e4a88c');
  line(ctx, [59, 91, 64, 93, 68, 91], '#8b705d', 2);
  ellipse(ctx, 37, 101, 9, 9, '#f4d3aa', INK, 2); ellipse(ctx, 89, 101, 9, 9, '#f4d3aa', INK, 2);
  ctx.beginPath(); ctx.moveTo(101, 76); ctx.quadraticCurveTo(125, 101, 101, 127); ctx.strokeStyle = '#a87e4b'; ctx.lineWidth = 5; ctx.stroke();
  line(ctx, [101, 77, 104, 125], '#f6e0b8', 1.5); line(ctx, [87, 101, 122, 101], '#835f47', 2);
  polygon(ctx, [125, 101, 117, 96, 117, 106], '#dce2d4', INK, 1.2);
}

function slime(ctx: Ctx, frame: number): void {
  const d = frame % 2 ? 3 : 0;
  ctx.beginPath(); ctx.moveTo(25, 125); ctx.bezierCurveTo(19, 112, 30, 100 - d, 33, 90 - d); ctx.bezierCurveTo(41, 64 - d, 84, 60 - d, 94, 91 - d); ctx.bezierCurveTo(98, 103, 113, 120, 100, 129); ctx.bezierCurveTo(80, 139, 44, 135, 25, 125);
  ctx.fillStyle = '#8abbaa'; ctx.fill(); ctx.strokeStyle = '#456b63'; ctx.lineWidth = 3; ctx.stroke();
  ellipse(ctx, 67, 101, 31, 23, '#b6d8b4'); ellipse(ctx, 50, 87 - d, 12, 5, '#e7edc9');
  ellipse(ctx, 37, 120, 9, 5, '#a9d1b0'); ellipse(ctx, 94, 123, 8, 4, '#78ae9b');
  eye(ctx, 52, 104, 5.5); eye(ctx, 80, 104, 5.5); ellipse(ctx, 40, 115, 6, 3, '#d6bca5'); ellipse(ctx, 92, 115, 6, 3, '#d6bca5');
  line(ctx, [62, 116, 67, 119, 73, 116], '#638776', 2);
  polygon(ctx, [65, 75, 60, 62, 68, 60, 78, 69], '#9fb881', '#638776', 1.5);
}

function mushroom(ctx: Ctx, frame: number, royal = false): void {
  const step = frame % 2 ? 3 : 0;
  rounded(ctx, 43, 124 - step, 17, 10, 5, '#aa8b65', INK, 2);
  rounded(ctx, 70, 124 + step, 17, 10, 5, '#aa8b65', INK, 2);
  ellipse(ctx, 33, 112, 9, 6, '#ecdbb2', INK, 2); ellipse(ctx, 96, 112, 9, 6, '#ecdbb2', INK, 2);
  rounded(ctx, 40, 85, 50, 46, 19, '#e8d2a4', INK, 2.6);
  rounded(ctx, 47, 89, 34, 34, 14, '#f6e8c4');
  eye(ctx, 54, 105, 5); eye(ctx, 76, 105, 5); ellipse(ctx, 44, 115, 5, 3, '#d9ac95'); ellipse(ctx, 85, 115, 5, 3, '#d9ac95');
  line(ctx, [60, 117, 65, 119, 69, 117], '#927962', 1.8);
  ellipse(ctx, 65, 86, 47, 15, '#b78570', INK, 2.5);
  ctx.beginPath(); ctx.moveTo(18, 86); ctx.bezierCurveTo(22, 43, 42, 36, 65, 37); ctx.bezierCurveTo(94, 36, 111, 54, 112, 86); ctx.quadraticCurveTo(65, 101, 18, 86);
  ctx.fillStyle = royal ? '#a78ab9' : '#d2987f'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(26, 73); ctx.bezierCurveTo(30, 49, 49, 39, 69, 44); ctx.quadraticCurveTo(38, 49, 36, 79); ctx.fillStyle = royal ? '#cab2ce' : '#e8bba0'; ctx.fill();
  ellipse(ctx, 42, 65, 10, 8, '#f6e4be'); ellipse(ctx, 77, 51, 9, 6, '#f8e8c5'); ellipse(ctx, 91, 77, 12, 9, '#f1d9b3'); ellipse(ctx, 60, 83, 6, 4, '#ecd2b3');
  if (royal) {
    polygon(ctx, [41, 44, 37, 20, 53, 30, 65, 11, 76, 30, 92, 19, 88, 43], '#edc36d', '#765f5e', 2.5);
    rounded(ctx, 42, 37, 45, 9, 3, '#d3a45b', '#765f5e', 2);
    ellipse(ctx, 64, 30, 5, 7, '#9c7bb9', '#fff1bc', 2);
    polygon(ctx, [32, 114, 24, 137, 48, 132, 43, 112], '#8f719e', INK, 2);
    polygon(ctx, [93, 114, 104, 137, 81, 132, 86, 111], '#8f719e', INK, 2);
  }
}

function goblin(ctx: Ctx, frame: number): void {
  boots(ctx, frame, '#7c6a53'); rounded(ctx, 43, 97, 42, 28, 10, '#ac8d63', INK, 2.5);
  polygon(ctx, [42, 99, 63, 105, 86, 96, 79, 112, 45, 113], '#8d7155', INK, 1.5);
  polygon(ctx, [34, 77, 15, 60, 18, 91, 39, 97], '#9db781', INK, 2.5);
  polygon(ctx, [92, 77, 113, 60, 109, 93, 87, 98], '#9db781', INK, 2.5);
  polygon(ctx, [22, 72, 30, 82, 23, 85], '#d0bd91'); polygon(ctx, [105, 73, 99, 83, 105, 85], '#d0bd91');
  ellipse(ctx, 64, 83, 32, 28, '#a9bd83', INK, 2.7); ellipse(ctx, 61, 78, 25, 21, '#baca92');
  polygon(ctx, [34, 70, 39, 54, 55, 46, 81, 49, 93, 65, 76, 63, 69, 57, 57, 63, 47, 61], '#7f8860', INK, 2);
  eye(ctx, 51, 83, 5); eye(ctx, 78, 83, 5); line(ctx, [46, 72, 56, 75], '#657550', 2.7); line(ctx, [73, 75, 82, 71], '#657550', 2.7);
  ellipse(ctx, 64, 93, 6, 4, '#88a172'); line(ctx, [55, 101, 70, 103], '#75815e', 2);
  polygon(ctx, [56, 101, 59, 106, 61, 101], '#fff0c8'); polygon(ctx, [68, 101, 71, 105, 73, 100], '#fff0c8');
  ellipse(ctx, 36, 107, 9, 10, '#a9bd83', INK, 2); ellipse(ctx, 94, 108, 8, 9, '#a9bd83', INK, 2);
  line(ctx, [100, 114, 106, 90], '#8c7150', 6); polygon(ctx, [102, 94, 101, 77, 111, 66, 112, 92], '#c6d5cc', INK, 2);
}

function skeleton(ctx: Ctx, frame: number): void {
  boots(ctx, frame, '#b7b5a0'); rounded(ctx, 47, 96, 34, 29, 11, '#d7d6bb', INK, 2.4);
  for (let y = 103; y < 122; y += 7) line(ctx, [51, y, 77, y], '#8c988d', 2);
  line(ctx, [64, 99, 64, 126], '#8c988d', 3);
  ellipse(ctx, 64, 77, 31, 29, '#ebe4c8', INK, 2.5);
  ellipse(ctx, 51, 79, 9, 11, '#68756d'); ellipse(ctx, 79, 79, 9, 11, '#68756d');
  ellipse(ctx, 52, 76, 3, 4, '#bbd7c4'); ellipse(ctx, 80, 76, 3, 4, '#bbd7c4');
  polygon(ctx, [63, 88, 59, 94, 67, 94], '#8f9b8c'); rounded(ctx, 48, 97, 31, 9, 4, '#d4d4bc', INK, 1.7);
  line(ctx, [57, 99, 57, 103], '#879388', 2); line(ctx, [68, 99, 68, 104], '#879388', 2);
  polygon(ctx, [30, 66, 35, 47, 55, 41, 82, 42, 96, 57, 96, 67, 82, 62, 42, 63], '#97a9a5', INK, 2.5);
  line(ctx, [44, 51, 80, 48], '#c0c9b4', 4); ellipse(ctx, 30, 104, 20, 26, '#ad9a72', INK, 3);
  ellipse(ctx, 30, 104, 14, 20, '#c8b185', '#d8c8a0', 2); ellipse(ctx, 30, 104, 5, 7, '#89958b', INK, 1.5);
  line(ctx, [95, 125, 96, 89], '#8e7757', 5); polygon(ctx, [92, 89, 97, 63, 102, 89], '#cbd7c9', INK, 2);
}

function bat(ctx: Ctx, frame: number): void {
  const dy = frame % 2 ? -12 : 4;
  polygon(ctx, [52, 97, 31, 76 + dy, 8, 82 + dy, 15, 100 + dy, 27, 94 + dy, 37, 110, 55, 111], '#9a83aa', INK, 2.5);
  polygon(ctx, [74, 97, 98, 74 + dy, 122, 82 + dy, 115, 101 + dy, 102, 95 + dy, 88, 111, 73, 111], '#9a83aa', INK, 2.5);
  line(ctx, [51, 103, 29, 87 + dy, 18, 87 + dy], '#c1a8c9', 2); line(ctx, [77, 103, 103, 86 + dy, 114, 88 + dy], '#c1a8c9', 2);
  ellipse(ctx, 64, 108, 20, 23, '#ae96b8', INK, 2.5);
  polygon(ctx, [47, 97, 45, 73, 60, 88], '#ae96b8', INK, 2); polygon(ctx, [69, 87, 85, 73, 82, 98], '#ae96b8', INK, 2);
  ellipse(ctx, 64, 113, 14, 14, '#c4abc8'); eye(ctx, 56, 104, 4.5); eye(ctx, 73, 104, 4.5);
  polygon(ctx, [60, 117, 63, 123, 65, 117], '#f3e6c5');
}

function beetle(ctx: Ctx, frame: number): void {
  const d = frame % 2 ? 3 : -3;
  for (const y of [98, 112, 126]) { line(ctx, [38, y, 24, y + d, 18, y + 7], '#7b7664', 5); line(ctx, [88, y, 102, y - d, 110, y + 7], '#7b7664', 5); }
  ellipse(ctx, 64, 109, 34, 24, '#819c87', INK, 2.7); ellipse(ctx, 64, 99, 32, 23, '#b2b982', INK, 2.7);
  line(ctx, [64, 81, 64, 121], '#7c916c', 2.5); ellipse(ctx, 47, 91, 8, 5, '#d1cf96'); ellipse(ctx, 82, 92, 6, 5, '#d1cf96');
  ellipse(ctx, 65, 120, 21, 14, '#a7b997', INK, 2.2); eye(ctx, 56, 120, 4); eye(ctx, 74, 120, 4);
  line(ctx, [52, 111, 44, 101, 38, 103], '#6f816c', 3); line(ctx, [77, 111, 85, 101, 91, 104], '#6f816c', 3);
}

function golem(ctx: Ctx, frame: number): void {
  const shift = frame % 2 ? 2 : -2;
  rounded(ctx, 37, 116 + shift, 23, 17, 7, '#8d9c91', INK, 2.5); rounded(ctx, 73, 116 - shift, 24, 17, 7, '#8d9c91', INK, 2.5);
  polygon(ctx, [40, 79, 82, 76, 99, 92, 90, 121, 68, 128, 39, 117, 29, 93], '#a7b3a0', INK, 3);
  polygon(ctx, [39, 84, 62, 80, 63, 117, 40, 112, 34, 94], '#c1c6ab');
  polygon(ctx, [16, 88, 34, 81, 41, 100, 31, 118, 16, 111, 10, 99], '#9aaa98', INK, 3);
  polygon(ctx, [92, 86, 111, 83, 119, 99, 111, 118, 92, 112, 86, 96], '#91a38f', INK, 3);
  polygon(ctx, [37, 51, 53, 35, 83, 38, 98, 57, 93, 82, 73, 93, 42, 82, 31, 67], '#bcc5af', INK, 3);
  polygon(ctx, [40, 54, 53, 41, 81, 44, 89, 54, 62, 59], '#d1d2b6');
  rounded(ctx, 43, 62, 16, 10, 4, '#6a8275'); rounded(ctx, 73, 62, 16, 10, 4, '#6a8275');
  rounded(ctx, 47, 64, 8, 5, 2, '#b5e3d1'); rounded(ctx, 77, 64, 8, 5, 2, '#b5e3d1');
  line(ctx, [59, 80, 74, 80], '#7d9280', 3);
  polygon(ctx, [65, 93, 75, 103, 65, 116, 54, 103], '#a18cb8', INK, 2); star(ctx, 64, 102, 7, '#ead8f0');
  ellipse(ctx, 42, 45, 16, 5, '#89a66e'); ellipse(ctx, 82, 37, 14, 5, '#91af76');
  line(ctx, [93, 45, 87, 55, 94, 58], '#8e9c89', 2); line(ctx, [45, 110, 53, 101, 48, 93], '#849985', 2);
}

export function actorSprite(kind: CharacterId | EnemyKind, frame: number): Sprite {
  frame = frame % 4; const key = `${kind}:${frame}`; const found = actors.get(key); if (found) return found;
  const result = sprite(128, 144, 64, 132, ctx => {
    if (kind === 'knight') knight(ctx, frame);
    else if (kind === 'mage') mage(ctx, frame);
    else if (kind === 'ranger') ranger(ctx, frame);
    else if (kind === 'slime') slime(ctx, frame);
    else if (kind === 'mushroom' || kind === 'mushroomKing') mushroom(ctx, frame, kind === 'mushroomKing');
    else if (kind === 'goblin') goblin(ctx, frame);
    else if (kind === 'skeleton') skeleton(ctx, frame);
    else if (kind === 'bat') bat(ctx, frame);
    else if (kind === 'beetle') beetle(ctx, frame);
    else golem(ctx, frame);
  }); actors.set(key, result); return result;
}

function tree(ctx: Ctx, variant: number): void {
  polygon(ctx, [112, 230, 116, 126, 132, 124, 147, 230], '#806d55', INK, 3);
  polygon(ctx, [120, 223, 124, 126, 131, 126, 133, 228], '#aa9270');
  line(ctx, [124, 174, 100, 143, 90, 124], '#806d55', 12); line(ctx, [135, 157, 161, 131], '#806d55', 9);
  line(ctx, [127, 209, 121, 197, 126, 185], '#705e4c', 2);
  const dark = variant % 3 === 1 ? '#769974' : '#628c74';
  const mid = variant % 3 === 1 ? '#a2b986' : '#8eac7e';
  const light = variant % 3 === 1 ? '#c1cb91' : '#aec48b';
  ellipse(ctx, 128, 117, 66, 49, dark, '#4c6e5b', 3);
  ellipse(ctx, 89, 107, 39, 39, mid, '#4c6e5b', 2.5); ellipse(ctx, 160, 102, 45, 39, mid, '#4c6e5b', 2.5);
  ellipse(ctx, 126, 72, 52, 48, mid, '#4c6e5b', 2.8);
  ellipse(ctx, 111, 60, 29, 23, light); ellipse(ctx, 81, 94, 22, 20, light); ellipse(ctx, 157, 82, 22, 20, light);
  ellipse(ctx, 173, 108, 22, 23, '#94ad80'); ellipse(ctx, 125, 104, 31, 28, mid);
  line(ctx, [92, 51, 101, 44, 114, 41], '#ced39d', 3); line(ctx, [65, 89, 70, 81, 77, 77], '#bdcd99', 3);
  ellipse(ctx, 112, 148, 10, 5, '#628f70'); ellipse(ctx, 153, 137, 11, 6, '#628f70');
  ellipse(ctx, 107, 231, 16, 5, '#7c9b70'); ellipse(ctx, 148, 231, 17, 5, '#819f75');
}

function wall(ctx: Ctx): void {
  polygon(ctx, [26, 174, 189, 174, 228, 157, 228, 216, 190, 234, 26, 234], '#9ca99a', INK, 2.8);
  polygon(ctx, [26, 174, 65, 156, 228, 156, 189, 174], '#cbd0b0', INK, 2.5);
  polygon(ctx, [189, 174, 228, 156, 228, 216, 190, 234], '#879789', INK, 2.5);
  for (let row = 0; row < 3; row++) {
    const y = 180 + row * 17; line(ctx, [29, y + 16, 186, y + 16], '#839782', 1.6);
    for (let x = 30 + (row % 2) * 24; x < 186; x += 48) line(ctx, [x, y, x, y + 16], '#839782', 1.5);
  }
  for (let x = 26; x < 190; x += 48) {
    rounded(ctx, x, 154, 28, 23, 2, '#b7c2a6', INK, 2); polygon(ctx, [x, 155, x + 12, 150, x + 39, 150, x + 28, 155], '#d5d7b6', INK, 1.7);
  }
  ellipse(ctx, 49, 235, 19, 6, '#84a079'); ellipse(ctx, 163, 177, 25, 4, '#94ab7b');
  ellipse(ctx, 154, 179, 12, 5, '#a8ba87');
}

function gate(ctx: Ctx): void {
  // Toy castle towers: warm stone fronts, visible top planes, slate roofs.
  for (const x of [34, 171]) {
    rounded(ctx, x, 94, 49, 139, 8, '#b7bda7', INK, 3);
    polygon(ctx, [x + 35, 95, x + 50, 92, x + 50, 229, x + 34, 232], '#95a591');
    line(ctx, [x + 3, 139, x + 44, 139], '#91a28c', 2); line(ctx, [x + 3, 181, x + 44, 181], '#91a28c', 2);
    line(ctx, [x + 24, 140, x + 24, 179], '#91a28c', 1.5); line(ctx, [x + 17, 184, x + 17, 229], '#91a28c', 1.5);
    rounded(ctx, x + 15, 108, 14, 24, 7, '#60736b', '#8c9f8a', 3); line(ctx, [x + 18, 112, x + 18, 125], '#cbd5b5', 2);
    polygon(ctx, [x - 8, 94, x + 25, 48, x + 60, 92, x + 25, 101], '#6e8b98', INK, 3);
    polygon(ctx, [x - 5, 92, x + 25, 53, x + 25, 96], '#8bafbc');
    line(ctx, [x + 24, 50, x + 24, 22], '#796b52', 3);
    polygon(ctx, [x + 25, 23, x + 51, 29, x + 25, 38], '#e6bd74', '#92774f', 1.5);
  }
  rounded(ctx, 79, 113, 94, 116, 3, '#b5bea8', INK, 3);
  polygon(ctx, [79, 113, 95, 104, 185, 104, 173, 114], '#d2d3b2', INK, 2.5);
  ctx.beginPath(); ctx.moveTo(95, 231); ctx.lineTo(95, 172); ctx.bezierCurveTo(95, 133, 158, 133, 158, 172); ctx.lineTo(158, 231); ctx.closePath(); ctx.fillStyle = '#5d7365'; ctx.fill(); ctx.strokeStyle = '#82917a'; ctx.lineWidth = 8; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(103, 228); ctx.lineTo(103, 174); ctx.bezierCurveTo(103, 145, 151, 145, 151, 174); ctx.lineTo(151, 228); ctx.fillStyle = '#ad9269'; ctx.fill();
  for (let x = 105; x < 152; x += 11) line(ctx, [x, 169, x, 227], '#826f53', 2);
  line(ctx, [104, 191, 149, 191], '#6c7765', 4); line(ctx, [104, 219, 149, 219], '#6c7765', 4);
  ellipse(ctx, 127, 198, 5, 6, '#d9c17c', '#73644e', 2);
  for (let x = 78; x < 174; x += 27) rounded(ctx, x, 99, 17, 19, 2, '#c5caae', INK, 1.8);
  rounded(ctx, 115, 119, 26, 13, 4, '#7e9b96', '#e2cf8c', 2); star(ctx, 128, 124, 5, '#f5e0a4');
  ellipse(ctx, 56, 232, 30, 7, '#829d73'); ellipse(ctx, 198, 231, 28, 7, '#829d73');
  line(ctx, [45, 180, 49, 159, 42, 145], '#799568', 4); ellipse(ctx, 44, 151, 7, 3, '#94ac79'); ellipse(ctx, 51, 164, 8, 4, '#94ac79');
}

function house(ctx: Ctx, variant: number): void {
  polygon(ctx, [48, 137, 151, 137, 196, 110, 196, 214, 151, 236, 48, 220], '#b99568', INK, 3);
  polygon(ctx, [49, 140, 151, 140, 151, 232, 49, 219], '#e3d4aa', INK, 2.5);
  polygon(ctx, [151, 139, 196, 113, 196, 214, 152, 232], '#b7ad86', INK, 2.5);
  line(ctx, [53, 153, 148, 166], '#937654', 7); line(ctx, [57, 216, 59, 146], '#937654', 6); line(ctx, [145, 231, 145, 152], '#937654', 6);
  polygon(ctx, [29, 148, 80, 76, 171, 89, 155, 165], variant % 2 ? '#b98773' : '#7d9aa0', INK, 3);
  polygon(ctx, [80, 76, 126, 52, 218, 113, 171, 147, 155, 165, 171, 89], variant % 2 ? '#d7aa89' : '#9bb7b8', INK, 3);
  for (let n = 1; n <= 4; n++) line(ctx, [42 + n * 9, 133 - n * 12, 158 + n * 2, 151 - n * 14], variant % 2 ? '#9c7566' : '#68878e', 2);
  polygon(ctx, [170, 63, 184, 55, 198, 63, 198, 103, 184, 111, 171, 102], '#a9b39c', INK, 2.5);
  ellipse(ctx, 184, 63, 14, 6, '#c8c8aa', INK, 2);
  rounded(ctx, 79, 177, 28, 49, 11, '#997958', INK, 2.5); line(ctx, [92, 179, 92, 222], '#786548', 2); ellipse(ctx, 102, 202, 2, 2, '#e7ce8e');
  rounded(ctx, 116, 177, 22, 24, 5, '#78999a', '#886e52', 3); line(ctx, [127, 178, 127, 198], '#e1d3a5', 2); line(ctx, [118, 188, 137, 188], '#e1d3a5', 2);
  rounded(ctx, 163, 157, 20, 24, 4, '#5f8588', '#7e7055', 3); line(ctx, [173, 158, 173, 178], '#c5c393', 2);
  rounded(ctx, 111, 201, 34, 7, 2, '#8b7453', INK, 1.5); ellipse(ctx, 117, 200, 7, 4, '#8fa271'); ellipse(ctx, 137, 200, 7, 4, '#8fa271');
  for (const [x, y] of [[118, 196], [128, 197], [138, 195]]) ellipse(ctx, x, y, 3, 3, '#e3bb9a');
}

function well(ctx: Ctx): void {
  ellipse(ctx, 127, 217, 54, 20, '#8e9d8e', INK, 2.5);
  rounded(ctx, 74, 181, 106, 35, 8, '#aeb99f', INK, 2.5);
  ellipse(ctx, 127, 183, 55, 20, '#c5cbaa', INK, 2.5); ellipse(ctx, 127, 183, 39, 12, '#769d9e', '#8e9f8b', 2);
  ellipse(ctx, 127, 182, 27, 7, '#96c5c0'); line(ctx, [103, 183, 120, 185, 144, 181], '#d0e5c9', 2);
  line(ctx, [78, 204, 175, 204], '#869b87', 2); line(ctx, [103, 192, 103, 219], '#869b87', 2); line(ctx, [143, 197, 143, 221], '#869b87', 2);
  rounded(ctx, 87, 107, 10, 83, 3, '#9c7f5d', INK, 2); rounded(ctx, 157, 107, 10, 83, 3, '#9c7f5d', INK, 2);
  polygon(ctx, [73, 119, 124, 79, 183, 113, 128, 136], '#95a9a6', INK, 2.5);
  polygon(ctx, [73, 119, 124, 79, 125, 120], '#c1c7a9'); line(ctx, [90, 116, 123, 91, 160, 113], '#7d9692', 2);
  line(ctx, [127, 124, 127, 169], '#ae9565', 2); rounded(ctx, 120, 162, 15, 15, 3, '#b3ab82', INK, 1.5);
  star(ctx, 136, 161, 6, '#e5d1f0'); star(ctx, 112, 168, 3, '#f5e5b1');
}

function rock(ctx: Ctx, variant: number): void {
  const d = variant % 3 * 6;
  polygon(ctx, [84, 225, 88, 201 - d, 107, 185 - d, 142, 189 - d, 163, 209, 157, 228, 123, 239], '#a8b09a', '#738678', 2.5);
  polygon(ctx, [89, 204 - d, 109, 189 - d, 141, 194 - d, 132, 211, 106, 216], '#c3c7aa');
  polygon(ctx, [132, 211, 160, 211, 154, 226, 122, 235], '#8e9d8b');
  ellipse(ctx, 101, 231, 15, 4, '#8ba474'); line(ctx, [140, 199, 136, 207, 144, 214], '#849683', 1.5);
}

function mushroomProp(ctx: Ctx, variant: number): void {
  const x = 127; rounded(ctx, x - 8, 211, 15, 22, 5, '#e1d3aa', '#8d9276', 1.5);
  ellipse(ctx, x, 211, 25, 8, '#c7a17d', '#7e846d', 1.5);
  ctx.beginPath(); ctx.moveTo(x - 25, 210); ctx.bezierCurveTo(x - 23, 180, x + 21, 180, x + 25, 210); ctx.quadraticCurveTo(x, 219, x - 25, 210); ctx.fillStyle = variant % 2 ? '#c39ab1' : '#dbac8f'; ctx.fill(); ctx.strokeStyle = '#7b846d'; ctx.lineWidth = 2; ctx.stroke();
  ellipse(ctx, x - 10, 199, 5, 4, '#f4e5bf'); ellipse(ctx, x + 10, 205, 6, 4, '#f4e5bf');
}

function flowers(ctx: Ctx, variant: number): void {
  for (let i = 0; i < 4; i++) {
    const x = 105 + i * 15; const y = 212 + (i % 2) * 9;
    line(ctx, [x, y + 16, x - 2, y], '#7e9b70', 2);
    const color = variant % 2 ? '#d4b7d3' : '#f4e3b7';
    for (let j = 0; j < 5; j++) ellipse(ctx, x + Math.cos(j * 1.26) * 4, y + Math.sin(j * 1.26) * 3, 3, 3, color);
    ellipse(ctx, x, y, 2, 2, '#d9b16d'); ellipse(ctx, x + 4, y + 8, 5, 2, '#94aa7e');
  }
}

function banner(ctx: Ctx, variant: number): void {
  line(ctx, [116, 232, 119, 112], '#8f7755', 6); line(ctx, [119, 115, 119, 98], '#b39a69', 3);
  ellipse(ctx, 119, 98, 5, 5, '#e7c675', INK, 1.5);
  polygon(ctx, [120, 113, 171, 122, 170, 176, 147, 166, 123, 174], variant % 2 ? '#a18eaf' : '#809ea7', INK, 2);
  line(ctx, [125, 119, 164, 127, 163, 165], '#e3cc91', 2); star(ctx, 146, 144, 11, '#ecd8a2');
  ellipse(ctx, 116, 232, 19, 5, '#849c75');
}

export function propSprite(kind: Prop['kind'], variant: number): Sprite {
  variant = Math.abs(variant) % 3; const key = `${kind}:${variant}`; const found = props.get(key); if (found) return found;
  const result = sprite(256, 256, 128, 230, ctx => {
    if (kind === 'tree') tree(ctx, variant);
    else if (kind === 'wall') wall(ctx);
    else if (kind === 'gate') gate(ctx);
    else if (kind === 'house') house(ctx, variant);
    else if (kind === 'well') well(ctx);
    else if (kind === 'rock') rock(ctx, variant);
    else if (kind === 'mushroom') mushroomProp(ctx, variant);
    else if (kind === 'flower') flowers(ctx, variant);
    else banner(ctx, variant);
  }); props.set(key, result); return result;
}

export function drawSprite(ctx: Ctx, source: Sprite, x: number, y: number, scale = 1, flip = false, rotation = 0, squash = 1): void {
  ctx.save(); ctx.translate(x, y); if (rotation) ctx.rotate(rotation); ctx.scale((flip ? -1 : 1) * scale / squash, scale * squash);
  ctx.drawImage(source.canvas, -source.anchorX, -source.anchorY, source.width, source.height); ctx.restore();
}

export function clearSpriteCache(): void { actors.clear(); props.clear(); }
