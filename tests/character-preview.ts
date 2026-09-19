import '../src/fonts.css';
import { drawSprite, actorSprite } from '../src/render/sprites.ts';
import type { CharacterPose } from '../src/render/characters/shared.ts';
import type { CharacterId } from '../src/types.ts';

type CharacterPreviewResult = {
  ready: true;
  frame: 1;
  characters: 3;
  poses: 7;
  playScale: 0.76;
  detailScale: 1.52;
  normalPlayEvidence: false;
};

declare global {
  interface Window { __CHARACTER_PREVIEW__: Promise<CharacterPreviewResult>; }
}

const FRAME = 1;
const PLAY_SCALE = 0.76;
const DETAIL_SCALE = 1.52;
const characters: ReadonlyArray<{ id: CharacterId; name: string; role: string }> = [
  { id: 'knight', name: '로완', role: '기사' },
  { id: 'mage', name: '루미', role: '마법사' },
  { id: 'ranger', name: '페른', role: '궁수' },
];
const poses: ReadonlyArray<{ id: CharacterPose; name: string }> = [
  { id: 'idle', name: '대기' },
  { id: 'walk', name: '걷기' },
  { id: 'windup', name: '준비' },
  { id: 'attack', name: '공격' },
  { id: 'recover', name: '회복' },
  { id: 'hit', name: '피격' },
  { id: 'dash', name: '대시' },
];

function previewCanvas(character: CharacterId, pose: CharacterPose, scale: number, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${character} ${pose} 포즈, ${scale.toFixed(2)}배`);

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캐릭터 미리보기 Canvas2D를 시작할 수 없습니다.');
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = true;

  const centerX = width / 2;
  const baseline = height - 8;
  const ratio = scale / PLAY_SCALE;
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#d7e5c5');
  gradient.addColorStop(1, '#b8cda5');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(58, 79, 65, .10)';
  ctx.beginPath();
  ctx.ellipse(centerX + 2 * ratio, baseline + 1, 23 * ratio, 8.5 * ratio, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 245, 201, .24)';
  ctx.lineWidth = Math.max(1, ratio);
  ctx.beginPath();
  ctx.moveTo(0, baseline + 3);
  ctx.lineTo(width, baseline + 3);
  ctx.stroke();

  drawSprite(ctx, actorSprite(character, FRAME, pose), centerX, baseline, scale);
  return canvas;
}

function buildMatrix(): void {
  const matrix = document.querySelector<HTMLElement>('#pose-matrix');
  if (!matrix) throw new Error('포즈 비교표 컨테이너가 없습니다.');

  const corner = document.createElement('div');
  corner.className = 'matrix-head matrix-corner';
  corner.textContent = '캐릭터 / 포즈';
  matrix.append(corner);
  for (const pose of poses) {
    const heading = document.createElement('div');
    heading.className = 'matrix-head';
    heading.textContent = `${pose.name} · ${pose.id}`;
    matrix.append(heading);
  }

  for (const character of characters) {
    const label = document.createElement('div');
    label.className = 'character-label';
    const name = document.createElement('strong');
    name.textContent = character.name;
    const role = document.createElement('span');
    role.textContent = `${character.role} · ${character.id}`;
    label.append(name, role);
    matrix.append(label);

    for (const pose of poses) {
      const cell = document.createElement('div');
      cell.className = 'preview-cell';
      cell.append(previewCanvas(character.id, pose.id, PLAY_SCALE, 134, 136));
      matrix.append(cell);
    }
  }
}

function buildDetails(): void {
  const grid = document.querySelector<HTMLElement>('#detail-grid');
  if (!grid) throw new Error('확대 비교 컨테이너가 없습니다.');

  for (const pose of poses) {
    for (const character of characters) {
      const card = document.createElement('article');
      card.className = 'detail-card';
      card.dataset.pose = pose.id;
      const heading = document.createElement('header');
      const name = document.createElement('strong');
      name.textContent = `${character.name} · ${pose.name}`;
      const code = document.createElement('span');
      code.textContent = `${character.id} / ${pose.id}`;
      heading.append(name, code);
      card.append(heading, previewCanvas(character.id, pose.id, DETAIL_SCALE, 250, 238));
      grid.append(card);
    }
  }
}

buildMatrix();
buildDetails();

window.__CHARACTER_PREVIEW__ = document.fonts.ready.then(() => {
  document.body.dataset.ready = 'true';
  const result: CharacterPreviewResult = {
    ready: true,
    frame: FRAME,
    characters: 3,
    poses: 7,
    playScale: PLAY_SCALE,
    detailScale: DETAIL_SCALE,
    normalPlayEvidence: false,
  };
  return result;
});

export {};
