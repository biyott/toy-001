import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame } from '../src/game/engine.ts';
import type { Enemy, GameController, GameOptions, GameState, Prop } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, stepFor } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x1234abcd, character: 'knight', contentTier: 0 };
const FIXTURE_ID_BASE = 9_100_000;

function started(): GameController {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

/**
 * Bounded-unit fixture: disables unrelated spawning, attacks, and props while
 * retaining the production enemy update path through GameController.step().
 */
function boundedEnemyState(game: GameController): GameState {
  const state = mutableStateFixture(game);
  state.elapsed = state.duration;
  state.bossSpawned = true;
  state.player.invulnerable = 999;
  state.enemies = [];
  state.weapons = [];
  state.zones = [];
  state.props = [];
  return state;
}

function enemyFixture(state: GameState, id: number, overrides: Partial<Enemy>): Enemy {
  return {
    id,
    kind: 'slime',
    x: state.player.x + 300,
    y: state.player.y,
    radius: 17,
    facing: 0,
    hp: 100,
    maxHp: 100,
    speed: 45,
    damage: 9,
    xp: 2,
    state: 'chase',
    stateTime: 0,
    hitFlash: 0,
    boss: false,
    attackCooldown: 999,
    vx: 0,
    vy: 0,
    ...overrides,
  };
}

describe('P0 일반 적 차별 행동 계약', () => {
  test('슬라임은 플레이어를 추적하며 홉 구간이 눌림 구간보다 빠르다 [bounded-unit fixture]', () => {
    const game = started();
    const state = boundedEnemyState(game);
    const hopping = enemyFixture(state, FIXTURE_ID_BASE + 1, { x: 300, stateTime: 0.4 });
    const squashed = enemyFixture(state, FIXTURE_ID_BASE + 2, { x: 300, stateTime: 1 });
    state.enemies.push(hopping, squashed);

    game.step(0.05, NO_INPUT);

    const hopDistance = 300 - hopping.x;
    const squashDistance = 300 - squashed.x;
    assert.ok(hopDistance > 0, `홉 구간 접근 거리: ${hopDistance}`);
    assert.ok(squashDistance > 0, `눌림 구간 접근 거리: ${squashDistance}`);
    assert.ok(hopDistance > squashDistance * 4, `홉 ${hopDistance}, 눌림 ${squashDistance}`);
    assert.ok(Math.abs(Math.abs(hopping.facing) - Math.PI) < 1e-9, `플레이어를 향한 각도: ${hopping.facing}`);
  });

  test('버섯은 근거리 후퇴·중거리 정지·원거리 접근을 하고 450 미만에서만 포자를 발사한다 [bounded-unit fixture]', () => {
    const movementGame = started();
    const movementState = boundedEnemyState(movementGame);
    const near = enemyFixture(movementState, FIXTURE_ID_BASE + 10, { kind: 'mushroom', x: 100, radius: 18, speed: 37 });
    const hold = enemyFixture(movementState, FIXTURE_ID_BASE + 11, { kind: 'mushroom', x: 180, radius: 18, speed: 37 });
    const far = enemyFixture(movementState, FIXTURE_ID_BASE + 12, { kind: 'mushroom', x: 300, radius: 18, speed: 37 });
    movementState.enemies.push(near, hold, far);

    movementGame.step(0.05, NO_INPUT);

    assert.ok(near.x > 100, `145 미만에서는 후퇴해야 함: x=${near.x}`);
    assert.equal(hold.x, 180, '145 이상 230 미만에서는 거리를 유지해야 함');
    assert.ok(far.x < 300, `230 이상에서는 접근해야 함: x=${far.x}`);

    const attackGame = started();
    const attackState = boundedEnemyState(attackGame);
    const inRange = enemyFixture(attackState, FIXTURE_ID_BASE + 13, {
      kind: 'mushroom', x: 449, radius: 18, speed: 37, damage: 13, attackCooldown: 0,
    });
    const boundary = enemyFixture(attackState, FIXTURE_ID_BASE + 14, {
      kind: 'mushroom', x: 450, radius: 18, speed: 37, attackCooldown: 0,
    });
    attackState.enemies.push(inRange, boundary);

    attackGame.step(0.01, NO_INPUT);

    const spores = attackState.zones.filter(({ kind }) => kind === 'spore-aim');
    assert.equal(spores.length, 1, '사거리 안의 버섯만 포자 공격을 만들어야 함');
    assert.equal(inRange.state, 'windup');
    assert.equal(boundary.state, 'chase', '정확히 450인 경계는 발사 범위 밖이어야 함');
    assert.deepEqual(
      { x: spores[0]!.x, y: spores[0]!.y, shape: spores[0]!.shape, telegraph: spores[0]!.telegraph, damage: spores[0]!.damage },
      { x: 449, y: attackState.player.y, shape: 'line', telegraph: 0.54, damage: 0 },
    );
    assert.equal(attackState.projectiles.length, 0, '예고 시작 프레임에는 발사하지 않는다');
  });

  test('고블린은 선형 예고 뒤 돌진하고 회복 중에는 추적 속도가 낮다 [bounded-unit fixture]', () => {
    const game = started();
    const state = boundedEnemyState(game);
    const goblin = enemyFixture(state, FIXTURE_ID_BASE + 20, {
      kind: 'goblin', x: 200, radius: 15, speed: 66, damage: 12, attackCooldown: 0,
    });
    state.enemies.push(goblin);

    game.step(0.01, NO_INPUT);
    const windupX = goblin.x;
    const warning = state.zones.find(({ kind }) => kind === 'goblin-charge');
    assert.equal(goblin.state, 'windup');
    assert.deepEqual(
      warning && { shape: warning.shape, length: warning.length, width: warning.width, telegraph: warning.telegraph, damage: warning.damage },
      { shape: 'line', length: 138, width: 27, telegraph: 0.64, damage: 0 },
    );

    stepFor(game, 0.6, NO_INPUT, 1 / 60);
    assert.equal(goblin.state, 'windup');
    assert.equal(goblin.x, windupX, '예고 중에는 움직이지 않아야 함');

    stepFor(game, 0.08, NO_INPUT, 1 / 60);
    assert.equal(goblin.state, 'attack');
    const chargeStartX = goblin.x;
    game.step(0.05, NO_INPUT);
    const chargeDistance = chargeStartX - goblin.x;
    assert.ok(chargeDistance > 12, `돌진 50ms 이동 거리: ${chargeDistance}`);

    stepFor(game, 0.5, NO_INPUT, 1 / 60);
    assert.equal(goblin.state, 'recover');
    const recoverStartX = goblin.x;
    game.step(0.05, NO_INPUT);
    const recoverDistance = recoverStartX - goblin.x;
    assert.ok(recoverDistance > 0 && recoverDistance < 1, `회복 50ms 이동 거리: ${recoverDistance}`);

    stepFor(game, 0.6, NO_INPUT, 1 / 60);
    assert.equal(goblin.state, 'chase');
  });
});

type SpawnSample = {
  enemies: Enemy[];
  spawnMoments: number[];
};

function sampleSpawnWindow(startElapsed: number, seconds = 8): SpawnSample {
  const game = started();
  const state = mutableStateFixture(game);
  state.elapsed = startElapsed;
  state.bossSpawned = true;
  state.player.invulnerable = 999;
  state.weapons = [];
  state.props = [];
  const spawnMoments: number[] = [];
  let count = state.enemies.length;

  for (let frame = 0; frame < seconds * 60; frame += 1) {
    game.step(1 / 60, NO_INPUT);
    if (state.enemies.length > count) {
      spawnMoments.push(state.elapsed - startElapsed);
      count = state.enemies.length;
    }
  }
  return { enemies: [...state.enemies], spawnMoments };
}

describe('P0 진행도별 일반 적 생성 계약', () => {
  test('초반은 슬라임 전용이고 후반은 세 종류가 섞이며 체력·속도가 상승한다 [bounded 8s simulation fixture]', () => {
    const early = sampleSpawnWindow(0);
    const late = sampleSpawnWindow(450);

    assert.ok(early.enemies.length >= 7, `초반 8초 생성 수: ${early.enemies.length}`);
    assert.deepEqual(new Set(early.enemies.map(({ kind }) => kind)), new Set(['slime']));
    assert.deepEqual(new Set(late.enemies.map(({ kind }) => kind)), new Set(['slime', 'mushroom', 'goblin']));

    const earlySlime = early.enemies.find(({ kind }) => kind === 'slime')!;
    const lateSlime = late.enemies.find(({ kind }) => kind === 'slime')!;
    assert.ok(lateSlime.maxHp > earlySlime.maxHp, `초반/후반 슬라임 HP: ${earlySlime.maxHp}/${lateSlime.maxHp}`);
    assert.ok(lateSlime.speed > earlySlime.speed, `초반/후반 슬라임 속도: ${earlySlime.speed}/${lateSlime.speed}`);
  });

  test('진행도가 높으면 기본 생성 간격이 줄고 추가 생성으로 8초 생성량이 증가한다 [bounded 8s simulation fixture]', () => {
    const early = sampleSpawnWindow(0);
    const late = sampleSpawnWindow(450);
    const earlyInterval = early.spawnMoments[1]! - early.spawnMoments[0]!;
    const lateInterval = late.spawnMoments[1]! - late.spawnMoments[0]!;

    assert.ok(earlyInterval >= 1.05 && earlyInterval <= 1.12, `초반 관찰 간격: ${earlyInterval}`);
    assert.ok(lateInterval >= 0.53 && lateInterval <= 0.58, `후반 관찰 간격: ${lateInterval}`);
    assert.ok(lateInterval < earlyInterval, `초반/후반 간격: ${earlyInterval}/${lateInterval}`);
    assert.ok(late.enemies.length >= early.enemies.length * 2, `초반/후반 생성 수: ${early.enemies.length}/${late.enemies.length}`);
  });
});

describe('적 이동과 solid prop 충돌 안정성', () => {
  const wall: Prop = { id: FIXTURE_ID_BASE + 90, kind: 'wall', x: 0, y: 0, radius: 50, scale: 1, solid: true, variant: 0 };

  test('벽을 향한 정상 고블린 이동은 벽을 관통하지 않고 좌표가 유한하다 [bounded-unit fixture]', () => {
    const game = started();
    const state = boundedEnemyState(game);
    state.player.x = 0;
    state.player.y = -200;
    state.props = [wall];
    const goblin = enemyFixture(state, FIXTURE_ID_BASE + 91, {
      kind: 'goblin', x: 0, y: 100, radius: 15, speed: 66, attackCooldown: 999,
    });
    state.enemies.push(goblin);

    stepFor(game, 1, NO_INPUT, 1 / 60);

    assert.ok(Number.isFinite(goblin.x) && Number.isFinite(goblin.y), `적 좌표: (${goblin.x}, ${goblin.y})`);
    assert.ok(goblin.y >= wall.radius + goblin.radius - 1e-9, `벽 위 최소 y=65, 실제 y=${goblin.y}`);
    assert.ok(Math.abs(goblin.x) <= state.world.halfWidth - goblin.radius);
    assert.ok(Math.abs(goblin.y) <= state.world.halfHeight - goblin.radius);
  });

  test('소품 정중앙 겹침도 유한한 방향으로 한 번 밀어내 NaN을 만들지 않는다 [bounded-unit fixture]', () => {
    const game = started();
    const state = boundedEnemyState(game);
    state.player.x = 0;
    state.player.y = -200;
    state.props = [wall];
    const slime = enemyFixture(state, FIXTURE_ID_BASE + 92, {
      x: wall.x, y: wall.y, radius: 17, speed: 0,
    });
    state.enemies.push(slime);

    game.step(0.01, NO_INPUT);

    assert.ok(Number.isFinite(slime.x) && Number.isFinite(slime.y), `적 좌표: (${slime.x}, ${slime.y})`);
    assert.equal(slime.x, wall.x + wall.radius + slime.radius);
    assert.equal(slime.y, wall.y);
  });
});
