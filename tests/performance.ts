import '../src/fonts.css';
import { createGame } from '../src/game/engine.ts';
import { createRenderer } from '../src/render/renderer.ts';
import { defaultProfile } from '../src/storage.ts';
import type { Enemy, EnemyKind, GameOptions, GameState, Pickup, Projectile, WeaponId, Zone } from '../src/types.ts';
import { createUI } from '../src/ui/ui.ts';

type Range = { min: number; max: number };
type EntityRanges = { enemies: Range; projectiles: Range; pickups: Range; zones: Range };
type TimingSummary = { samples: number; meanMs: number; p95Ms: number; maxMs: number };

interface BenchResult {
  status: 'complete';
  fixture: {
    synthetic: true;
    normalPlayEvidence: false;
    description: string;
    targetCounts: { enemies: 180; projectiles: 300; pickups: 260; zones: 10 };
    hudIncluded: true;
    contentTier: 0 | 1;
    enemyKinds: EnemyKind[];
    weaponIds: WeaponId[];
  };
  environment: {
    viewport: { width: number; height: number; dpr: number };
    userAgent: string;
    durationSeconds: number;
  };
  timing: {
    frameCount: number;
    meanFps: number;
    meanFrameMs: number;
    p95FrameMs: number;
    maxFrameMs: number;
    longFramesOver33Ms: number;
    simulationSteps: number;
    engineElapsedSeconds: number;
  };
  entities: EntityRanges;
  segments: {
    engineJs: TimingSummary;
    fixtureMaintenanceJs: TimingSummary;
    rendererJs: TimingSummary;
    uiUpdateJs: TimingSummary;
    totalMeasuredJs: TimingSummary;
    gpuReadbackProbe: TimingSummary;
  };
  instrumentation: {
    collisionEstimateIntervalMs: 5000;
    gpuReadbackIntervalMs: 5000;
    explanation: string;
  };
  collisionCandidateEstimate: Range & { mean: number; samples: number };
  runtimeErrors: string[];
}

declare global {
  interface Window { __BENCH_RESULT__: Promise<BenchResult>; }
}

const TARGET = { enemies: 180, projectiles: 300, pickups: 260, zones: 10 } as const;
const FIXTURE_ID = 1_000_000;
const NO_INPUT = { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false } as const;
const query = new URLSearchParams(location.search);
const contentTier: 0 | 1 = query.get('tier') === '1' ? 1 : 0;
const enemyKinds: EnemyKind[] = contentTier === 1
  ? ['slime', 'mushroom', 'goblin', 'skeleton', 'bat', 'beetle']
  : ['slime', 'mushroom', 'goblin'];
const weaponIds: WeaponId[] = contentTier === 1
  ? ['sword', 'arrow', 'spirit', 'lightning', 'frost', 'fireball']
  : ['sword', 'arrow', 'spirit'];
const options: GameOptions = { mode: 'normal', seed: 0x51a7c0de, character: contentTier === 1 ? 'mage' : 'knight', contentTier };
const requestedSeconds = Number(query.get('seconds') ?? 60);
const durationSeconds = Number.isFinite(requestedSeconds) ? Math.max(1, Math.min(300, requestedSeconds)) : 60;
const warmupMs = 2_000;
const status = document.querySelector<HTMLElement>('#bench-status')!;
const tierLabel = document.querySelector<HTMLElement>('#bench-tier')!;
const canvas = document.querySelector<HTMLCanvasElement>('#bench-canvas')!;
const uiRoot = document.querySelector<HTMLElement>('#ui-root')!;
const runtimeErrors: string[] = [];
tierLabel.textContent = contentTier === 1 ? 'P1 6적·6무기' : 'P0 3적·3무기';

window.addEventListener('error', (event) => runtimeErrors.push(event.message || 'window error'));
window.addEventListener('unhandledrejection', (event) => runtimeErrors.push(String(event.reason)));

const game = createGame(options);
game.dispatch({ type: 'start', options });
const renderer = createRenderer(canvas);
const profile = defaultProfile();
let settings = profile.settings;
const ui = createUI(uiRoot, {
  command(command) { game.dispatch(command); },
  settings(patch) { settings = { ...settings, ...patch }; profile.settings = settings; },
  getOptions: () => ({ ...options }),
  setOptions: () => {},
});

function explicitHighLoadFixture(state: GameState): void {
  // Synthetic fixture only. This deliberately mutates the engine-owned state to
  // sustain a repeatable upper-bound workload; it is never normal-play evidence.
  state.player.hp = 1_000_000_000;
  state.player.maxHp = 1_000_000_000;
  state.player.invulnerable = 0;
  state.enemies = [];
  state.projectiles = [];
  state.pickups = [];
  state.zones = [];
  state.weapons = weaponIds.map((id, index) => ({ id, level: contentTier === 1 ? 3 : 2, cooldown: index * 0.04, angle: index }));
  for (const id of weaponIds) state.player.upgrades[id] = contentTier === 1 ? 3 : 2;
  maintainFixture(state, true);
}

function makeEnemy(index: number): Enemy {
  const angle = index / TARGET.enemies * Math.PI * 2;
  const ring = 105 + index % 9 * 55;
  const kind = enemyKinds[index % enemyKinds.length]!;
  const speed = kind === 'bat' ? 88 : kind === 'goblin' ? 66 : kind === 'beetle' ? 48 : kind === 'slime' ? 45 : kind === 'skeleton' ? 43 : 37;
  const radius = kind === 'beetle' ? 22 : kind === 'bat' ? 12 : kind === 'slime' ? 17 : kind === 'mushroom' ? 18 : 15;
  return {
    id: FIXTURE_ID + index,
    kind,
    x: Math.cos(angle) * ring,
    y: 30 + Math.sin(angle) * Math.min(ring, 580),
    radius,
    facing: angle + Math.PI,
    hp: 1_000_000_000,
    maxHp: 1_000_000_000,
    speed,
    damage: 9 + index % 4,
    xp: 3,
    state: 'chase',
    stateTime: index * 0.17,
    hitFlash: 0,
    boss: false,
    attackCooldown: 0.2 + index % 17 * 0.11,
    vx: 0,
    vy: 0,
  };
}

function makeProjectile(index: number): Projectile {
  const angle = index / TARGET.projectiles * Math.PI * 2;
  const ring = 130 + index % 13 * 38;
  const projectileWeapons: WeaponId[] = contentTier === 1 ? ['arrow', 'spirit', 'fireball'] : ['arrow', 'spirit'];
  const weapon = projectileWeapons[index % projectileWeapons.length]!;
  return {
    id: FIXTURE_ID + 10_000 + index,
    weapon,
    owner: 'player',
    x: Math.cos(angle) * ring,
    y: 30 + Math.sin(angle) * Math.min(ring, 590),
    radius: weapon === 'spirit' ? 12 : weapon === 'fireball' ? 9 : 5,
    facing: angle + Math.PI / 2,
    vx: weapon === 'spirit' ? 0 : -Math.sin(angle) * 5,
    vy: weapon === 'spirit' ? 0 : Math.cos(angle) * 5,
    damage: 0.05,
    life: 180,
    pierce: 999,
    hitIds: [],
    generation: weapon === 'spirit' ? -(index + 1) : 1,
  };
}

function makePickup(index: number): Pickup {
  const angle = index / TARGET.pickups * Math.PI * 2;
  const ring = 230 + index % 8 * 49;
  return {
    id: FIXTURE_ID + 20_000 + index,
    kind: 'xp',
    value: 1,
    life: 180,
    x: Math.cos(angle) * ring,
    y: 30 + Math.sin(angle) * Math.min(ring, 590),
    radius: 6,
    facing: 0,
  };
}

function makeZone(index: number): Zone {
  const angle = index / TARGET.zones * Math.PI * 2;
  const shape = (['circle', 'ring', 'line', 'cone'] as const)[index % 4];
  return {
    id: FIXTURE_ID + 30_000 + index,
    x: Math.cos(angle) * 170,
    y: 30 + Math.sin(angle) * 145,
    shape,
    radius: 150 + index % 3 * 35,
    innerRadius: shape === 'ring' ? 65 : undefined,
    angle,
    length: shape === 'line' ? 280 : undefined,
    width: shape === 'line' ? 42 : shape === 'cone' ? 1.8 : undefined,
    telegraph: 0,
    duration: 180,
    damage: 0.05,
    owner: index % 2 === 0 ? 'player' : 'enemy',
    kind: index % 2 === 0 ? 'fixture-sword' : 'fixture-danger',
    hitIds: [],
  };
}

function maintainFixture(state: GameState, resetHits = false): void {
  while (state.enemies.length < TARGET.enemies) state.enemies.push(makeEnemy(state.enemies.length));
  if (state.enemies.length > TARGET.enemies) state.enemies.length = TARGET.enemies;
  for (const enemy of state.enemies) {
    enemy.hp = Math.max(enemy.hp, 900_000_000);
    enemy.maxHp = 1_000_000_000;
  }

  while (state.projectiles.length < TARGET.projectiles) state.projectiles.push(makeProjectile(state.projectiles.length));
  if (state.projectiles.length > TARGET.projectiles) state.projectiles.length = TARGET.projectiles;
  for (const projectile of state.projectiles) {
    projectile.life = Math.max(projectile.life, 120);
    projectile.pierce = Math.max(projectile.pierce, 999);
    if (resetHits) projectile.hitIds = [];
  }

  while (state.pickups.length < TARGET.pickups) state.pickups.push(makePickup(state.pickups.length));
  if (state.pickups.length > TARGET.pickups) state.pickups.length = TARGET.pickups;
  for (let index = 0; index < state.pickups.length; index += 1) {
    const pickup = state.pickups[index]!;
    if (pickup.kind !== 'xp' || Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) < 180) state.pickups[index] = makePickup(index);
    else pickup.life = Math.max(pickup.life, 120);
  }

  const fixtureZones = new Map(state.zones.filter((zone) => zone.id >= FIXTURE_ID + 30_000).map((zone) => [zone.id, zone]));
  for (let index = 0; index < TARGET.zones; index += 1) {
    const id = FIXTURE_ID + 30_000 + index;
    if (!fixtureZones.has(id)) state.zones.push(makeZone(index));
  }
  if (resetHits) for (const zone of state.zones) zone.hitIds = [];
}

function estimateCollisionCandidates(state: Readonly<GameState>): number {
  let candidates = state.enemies.length; // Enemy/player contact checks in the FSM.
  for (const projectile of state.projectiles) {
    for (const enemy of state.enemies) {
      const reach = projectile.radius + enemy.radius + 48;
      if (Math.abs(projectile.x - enemy.x) <= reach && Math.abs(projectile.y - enemy.y) <= reach) candidates += 1;
    }
  }
  for (const zone of state.zones) {
    if (zone.owner !== 'player') { candidates += 1; continue; }
    const reach = (zone.length ?? zone.radius) + 48;
    for (const enemy of state.enemies) {
      if (Math.abs(zone.x - enemy.x) <= reach && Math.abs(zone.y - enemy.y) <= reach) candidates += 1;
    }
  }
  return candidates;
}

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))]!;
}

function finite(value: number): number { return Number(value.toFixed(3)); }
function summarizeTimings(values: number[]): TimingSummary {
  if (values.length === 0) return { samples: 0, meanMs: 0, p95Ms: 0, maxMs: 0 };
  return {
    samples: values.length,
    meanMs: finite(values.reduce((sum, value) => sum + value, 0) / values.length),
    p95Ms: finite(percentile(values, 0.95)),
    maxMs: finite(Math.max(...values)),
  };
}

const benchPromise = new Promise<BenchResult>((resolve, reject) => {
  try {
    const mutableState = game.getState() as GameState;
    explicitHighLoadFixture(mutableState);
    renderer.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2));
    ui.render(game.getState(), profile);
    addEventListener('resize', () => renderer.resize(innerWidth, innerHeight, Math.min(devicePixelRatio || 1, 2)));

    const frameIntervals: number[] = [];
    const entityRanges: EntityRanges = {
      enemies: { min: Infinity, max: 0 }, projectiles: { min: Infinity, max: 0 },
      pickups: { min: Infinity, max: 0 }, zones: { min: Infinity, max: 0 },
    };
    const collisionSamples: number[] = [];
    const engineJsSamples: number[] = [];
    const fixtureJsSamples: number[] = [];
    const rendererJsSamples: number[] = [];
    const uiJsSamples: number[] = [];
    const totalJsSamples: number[] = [];
    const gpuReadbackSamples: number[] = [];
    const readbackContext = canvas.getContext('2d');
    let previousFrame = performance.now();
    let sampleStart = 0;
    let accumulator = 0;
    let simulationSteps = 0;
    let sampleStartSimulationSteps = 0;
    let sampleStartEngineElapsed = 0;
    let lastUi = 0;
    let lastFixtureRefresh = 0;
    let lastSample = 0;
    let lastCollisionSample = 0;
    let lastGpuProbe = 0;
    let sampling = false;

    const observeEntities = (state: Readonly<GameState>) => {
      const counts = { enemies: state.enemies.length, projectiles: state.projectiles.length, pickups: state.pickups.length, zones: state.zones.length };
      for (const key of Object.keys(counts) as Array<keyof typeof counts>) {
        entityRanges[key].min = Math.min(entityRanges[key].min, counts[key]);
        entityRanges[key].max = Math.max(entityRanges[key].max, counts[key]);
      }
    };

    const observeCollisionCandidates = (state: Readonly<GameState>) => collisionSamples.push(estimateCollisionCandidates(state));

    const frame = (now: number) => {
      try {
        const rawDeltaMs = now - previousFrame;
        previousFrame = now;
        if (!sampling && now >= sampleStart) {
          sampling = true;
          frameIntervals.length = 0;
          previousFrame = now;
          lastSample = now;
          lastCollisionSample = now;
          lastGpuProbe = now;
          sampleStartSimulationSteps = simulationSteps;
          sampleStartEngineElapsed = game.getState().elapsed;
          observeEntities(game.getState());
          observeCollisionCandidates(game.getState());
          status.textContent = `측정 중 0 / ${durationSeconds}초`;
        } else if (sampling) frameIntervals.push(rawDeltaMs);

        const measureSegments = sampling;
        const totalJsStart = performance.now();
        const engineJsStart = performance.now();
        const delta = Math.min(rawDeltaMs / 1000, 0.1);
        accumulator = Math.min(accumulator + delta, 0.1);
        while (accumulator >= 1 / 60) {
          game.step(1 / 60, NO_INPUT);
          accumulator -= 1 / 60;
          simulationSteps += 1;
        }
        const engineJsEnd = performance.now();

        const fixtureJsStart = performance.now();
        if (now - lastFixtureRefresh >= 1_000) {
          maintainFixture(mutableState, true);
          lastFixtureRefresh = now;
        } else maintainFixture(mutableState);
        const fixtureJsEnd = performance.now();

        const rendererJsStart = performance.now();
        renderer.consumeEvents(game.drainEvents());
        renderer.render(game.getState(), delta, settings);
        const rendererJsEnd = performance.now();
        if (now - lastUi >= 75) {
          const uiJsStart = performance.now();
          ui.render(game.getState(), profile);
          const uiJsEnd = performance.now();
          if (measureSegments) uiJsSamples.push(uiJsEnd - uiJsStart);
          lastUi = now;
        }
        const totalJsEnd = performance.now();
        if (measureSegments) {
          engineJsSamples.push(engineJsEnd - engineJsStart);
          fixtureJsSamples.push(fixtureJsEnd - fixtureJsStart);
          rendererJsSamples.push(rendererJsEnd - rendererJsStart);
          totalJsSamples.push(totalJsEnd - totalJsStart);
        }

        if (sampling && now - lastSample >= 500) {
          observeEntities(game.getState());
          lastSample = now;
          const elapsed = Math.min(durationSeconds, (now - sampleStart) / 1000);
          status.textContent = `측정 중 ${elapsed.toFixed(1)} / ${durationSeconds}초`;
        }
        if (sampling && now - lastCollisionSample >= 5_000) {
          // Keep instrumentation out of the p95 population as much as possible:
          // this O(projectiles*enemies) estimate runs only every five seconds.
          observeCollisionCandidates(game.getState());
          lastCollisionSample = now;
        }
        if (sampling && readbackContext && now - lastGpuProbe >= 5_000) {
          // Canvas2D has no portable GPU timer. A one-pixel readback is a sparse
          // synchronization proxy; it can include driver/compositor queue time.
          const gpuProbeStart = performance.now();
          readbackContext.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1);
          gpuReadbackSamples.push(performance.now() - gpuProbeStart);
          lastGpuProbe = now;
        }

        if (!sampling || now - sampleStart < durationSeconds * 1000) {
          requestAnimationFrame(frame);
          return;
        }

        observeEntities(game.getState());
        observeCollisionCandidates(game.getState());
        const meanFrameMs = frameIntervals.reduce((sum, value) => sum + value, 0) / Math.max(1, frameIntervals.length);
        const collisionMin = Math.min(...collisionSamples);
        const collisionMax = Math.max(...collisionSamples);
        const result: BenchResult = {
          status: 'complete',
          fixture: {
            synthetic: true,
            normalPlayEvidence: false,
            description: '엔진 상태를 명시적으로 채우고 hit 등록을 주기적으로 초기화해 충돌 부하를 유지하는 합성 fixture. 정상 플레이·승패 증거가 아님.',
            targetCounts: TARGET,
            hudIncluded: true,
            contentTier,
            enemyKinds,
            weaponIds,
          },
          environment: {
            viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1 },
            userAgent: navigator.userAgent,
            durationSeconds,
          },
          timing: {
            frameCount: frameIntervals.length,
            meanFps: finite(1000 / meanFrameMs),
            meanFrameMs: finite(meanFrameMs),
            p95FrameMs: finite(percentile(frameIntervals, 0.95)),
            maxFrameMs: finite(Math.max(...frameIntervals)),
            longFramesOver33Ms: frameIntervals.filter((value) => value > 33).length,
            simulationSteps: simulationSteps - sampleStartSimulationSteps,
            engineElapsedSeconds: finite(game.getState().elapsed - sampleStartEngineElapsed),
          },
          entities: entityRanges,
          segments: {
            engineJs: summarizeTimings(engineJsSamples),
            fixtureMaintenanceJs: summarizeTimings(fixtureJsSamples),
            rendererJs: summarizeTimings(rendererJsSamples),
            uiUpdateJs: summarizeTimings(uiJsSamples),
            totalMeasuredJs: summarizeTimings(totalJsSamples),
            gpuReadbackProbe: summarizeTimings(gpuReadbackSamples),
          },
          instrumentation: {
            collisionEstimateIntervalMs: 5000,
            gpuReadbackIntervalMs: 5000,
            explanation: 'engine/render/UI는 performance.now 구간의 JS 실행시간이며 각 프레임의 시계 호출 오버헤드를 조금 포함한다. renderer는 Canvas2D 명령 생성·제출 시간이며 순수 GPU 시간은 아니다. GPU 값은 5초마다 1픽셀 getImageData로 강제 동기화한 근사치라 드라이버·합성 대기를 포함하고 해당 소수 프레임의 max/long-frame을 늘릴 수 있다. 충돌 후보 O(투사체×적) 추정도 5초마다만 실행해 p95 오염을 제한한다.',
          },
          collisionCandidateEstimate: {
            min: collisionMin,
            max: collisionMax,
            mean: finite(collisionSamples.reduce((sum, value) => sum + value, 0) / collisionSamples.length),
            samples: collisionSamples.length,
          },
          runtimeErrors,
        };
        status.textContent = `완료 · 평균 ${result.timing.meanFps.toFixed(1)} FPS · p95 ${result.timing.p95FrameMs.toFixed(1)}ms`;
        resolve(result);
      } catch (error) {
        status.textContent = `실패 · ${String(error)}`;
        reject(error);
      }
    };

    void document.fonts.ready.then(() => {
      previousFrame = performance.now();
      sampleStart = previousFrame + warmupMs;
      status.textContent = `워밍업 ${warmupMs / 1000}초`;
      requestAnimationFrame(frame);
    }, reject);
  } catch (error) {
    reject(error);
  }
});

Object.defineProperty(window, '__BENCH_RESULT__', {
  value: benchPromise,
  writable: false,
  configurable: false,
  enumerable: false,
});
