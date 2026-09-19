import '../src/fonts.css';
import { createGame } from '../src/game/engine.ts';
import { createRenderer } from '../src/render/renderer.ts';
import type { Enemy, GameOptions, GameState, Projectile, Renderer, Zone } from '../src/types.ts';

interface PreviewSceneInfo {
  id: string;
  bossKind: 'mushroomKing' | 'golem';
  patternKind: string;
  boss: { x: number; y: number; radius: number; state: Enemy['state']; hp: number; maxHp: number };
  player: { x: number; y: number; radius: number };
  bossPlayerDistance: number;
  zone: Zone;
  projectiles: Projectile[];
  capturePhase: 'flight' | 'telegraph';
  canvas: { width: number; height: number; dpr: number };
  engineSteps: number;
}

interface BossPreviewStatus {
  ready: boolean;
  fixture: true;
  normalPlayEvidence: false;
  description: string;
  scenes: PreviewSceneInfo[];
  errors: string[];
}

declare global {
  interface Window { __BOSS_PREVIEW__: BossPreviewStatus; }
}

const status: BossPreviewStatus = {
  ready: false, fixture: true, normalPlayEvidence: false,
  description: '시각 검토용 고정 fixture, 정상 플레이 증거 아님. 실제 엔진 FSM·Zone·Renderer 사용.',
  scenes: [], errors: [],
};
window.__BOSS_PREVIEW__ = status;
const statusLabel = document.querySelector<HTMLElement>('#status')!;
const DT = 1 / 120;
const NO_INPUT = { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false };
const OPTIONS: GameOptions = { mode: 'normal', seed: 0xb055, character: 'knight', contentTier: 1 };
const DEFINITIONS = [
  { id: 'mushroom-spores', bossKind: 'mushroomKing', patternKind: 'royal-spore-target' },
  { id: 'mushroom-stomp', bossKind: 'mushroomKing', patternKind: 'royal-stomp' },
  { id: 'golem-shockwave', bossKind: 'golem', patternKind: 'golem-shockwave' },
  { id: 'golem-fissure', bossKind: 'golem', patternKind: 'golem-fissure' },
] as const;
const renderers: Renderer[] = [];
const observers: ResizeObserver[] = [];

function recordError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  status.errors.push(message);
  status.ready = false;
  statusLabel.textContent = `생성 실패: ${message}`;
}
window.addEventListener('error', event => recordError(event.error ?? event.message));
window.addEventListener('unhandledrejection', event => recordError(event.reason));

function buildScene(definition: typeof DEFINITIONS[number]) {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  // Deliberate visual-fixture setup. The real engine creates both boss objects;
  // no hand-authored zone or alternative drawing implementation is used here.
  const state = game.getState() as GameState;
  state.elapsed = state.duration;
  state.weapons = [];
  state.props = [];
  game.step(DT, NO_INPUT);
  const boss = state.enemies.find(enemy => enemy.kind === definition.bossKind);
  if (!boss) throw new Error(`${definition.bossKind}: 엔진 보스 생성 실패`);
  state.enemies = [boss];
  state.pickups = [];
  state.projectiles = [];
  let selected: Zone | undefined;
  let steps = 1;
  for (; steps < 1800; steps++) {
    // Keep composition fixed while attack timers/pattern selection progress
    // naturally. Neither boss FSM state nor attack cooldown is overwritten.
    boss.x = -110;
    boss.y = 0;
    state.player.x = 110;
    state.player.y = 0;
    game.step(DT, NO_INPUT);
    const royalFlight = definition.id === 'mushroom-spores';
    const hasVisibleRoyalSpore = state.projectiles.some(projectile => projectile.kind === 'royal-spore'
      && Math.hypot(projectile.x - boss.x, projectile.y - boss.y) > 70);
    selected = state.zones.find(zone => zone.owner === 'enemy' && zone.kind === definition.patternKind
      && zone.telegraph > 0 && zone.telegraph <= (royalFlight ? .45 : .75)
      && (!royalFlight || hasVisibleRoyalSpore));
    if (selected) break;
    if (state.phase !== 'playing') throw new Error(`${definition.id}: 예고 생성 전에 ${state.phase}`);
  }
  if (!selected) throw new Error(`${definition.id}: 제한된 프레임 안에 예고를 찾지 못함`);
  // Freeze the exact engine-produced snapshot. The final positions are already
  // stationary in windup, so the warning and the attacking body stay aligned.
  const frozen = structuredClone(state);
  frozen.phase = 'paused';
  const frozenBoss = frozen.enemies.find(enemy => enemy.id === boss.id)!;
  const frozenZone = frozen.zones.find(zone => zone.id === selected!.id)!;
  if (frozen.zones.length !== 1) throw new Error(`${definition.id}: 예고 격리 실패 (${frozen.zones.length})`);
  const info: PreviewSceneInfo = {
    ...definition,
    boss: { x: frozenBoss.x, y: frozenBoss.y, radius: frozenBoss.radius, state: frozenBoss.state, hp: frozenBoss.hp, maxHp: frozenBoss.maxHp },
    player: { x: frozen.player.x, y: frozen.player.y, radius: frozen.player.radius },
    bossPlayerDistance: Math.hypot(frozenBoss.x - frozen.player.x, frozenBoss.y - frozen.player.y),
    zone: structuredClone(frozenZone), projectiles: structuredClone(frozen.projectiles),
    capturePhase: definition.id === 'mushroom-spores' ? 'flight' : 'telegraph', canvas: { width: 0, height: 0, dpr: 1 }, engineSteps: steps + 1,
  };
  return { state: frozen, info };
}

function drawScene(definition: typeof DEFINITIONS[number]) {
  const { state, info } = buildScene(definition);
  const article = document.getElementById(definition.id)!;
  const canvas = article.querySelector<HTMLCanvasElement>('canvas')!;
  const renderer = createRenderer(canvas);
  renderers.push(renderer);
  status.scenes.push(info);
  const zone = info.zone;
  if (info.capturePhase === 'flight') {
    article.querySelector<HTMLElement>('h2')!.textContent = '버섯 왕 · 왕 포자 비행과 착탄 예고';
    article.querySelector<HTMLElement>('.caption')!.textContent = '실제 날아가는 왕 포자 + 무해한 바닥 경고 · 접촉 또는 목표 도착에서만 폭발';
  }
  const shapeName = { circle: '원', ring: '고리', line: '선', cone: '부채꼴' }[zone.shape];
  const dimensions = zone.shape === 'line'
    ? `길이 ${zone.length} · 폭 ${zone.width} · 각도 ${zone.angle.toFixed(3)}`
    : `반지름 ${zone.radius}${zone.innerRadius === undefined ? '' : ` · 내부 반지름 ${zone.innerRadius}`}`;
  const damageLabel = info.capturePhase === 'flight'
    ? `경고 피해 ${zone.damage} · 비행체 ${info.projectiles.length}개 · 착탄 피해 ${info.projectiles[0]?.damage ?? 0}`
    : `발동 피해 ${zone.damage}`;
  article.querySelector<HTMLElement>('.metrics')!.textContent =
    `형태 ${shapeName} (${zone.shape}) · 예고 ${zone.telegraph.toFixed(3)}초 · ${dimensions} · ${damageLabel} · 보스 ${info.boss.state} · 중심 거리 ${info.bossPlayerDistance.toFixed(1)}`;
  const draw = () => {
    const width = Math.max(1, Math.floor(article.clientWidth));
    const height = 400;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.resize(width, height, dpr);
    renderer.render(state, 0, { muted: true, reducedMotion: true });
    info.canvas = { width, height, dpr };
  };
  draw();
  const observer = new ResizeObserver(draw);
  observer.observe(article);
  observers.push(observer);
}

async function prepare() {
  const description = document.querySelector<HTMLElement>('.description');
  if (description?.firstChild) description.firstChild.textContent = '보스와 기사의 중심 거리는 약 220 월드 단위입니다. 왕 포자는 실제 비행 중, 나머지 장면은 예고 약 0.75초에서 정지합니다. 피해·회피 성공을 보여 주는 화면이 아닙니다. ';
  await document.fonts.ready;
  for (const definition of DEFINITIONS) drawScene(definition);
  // Two paints make `ready` useful for a screenshot without an animated loop.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  if (status.errors.length) return;
  status.ready = true;
  statusLabel.textContent = '4개 장면 준비 완료 · 시간 정지';
}

window.addEventListener('pagehide', () => {
  for (const observer of observers) observer.disconnect();
  for (const renderer of renderers) renderer.dispose();
});
void prepare().catch(recordError);
