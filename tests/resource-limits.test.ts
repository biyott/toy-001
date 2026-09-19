import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame } from '../src/game/engine.ts';
import type { Enemy, GameController, GameOptions, Pickup, Projectile } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x6a09e667, character: 'knight', contentTier: 0 };

function started(): GameController {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  return game;
}

function enemyFixture(id: number, partial: Partial<Enemy> = {}): Enemy {
  return {
    id,
    kind: 'slime',
    x: 850,
    y: 560,
    radius: 17,
    facing: 0,
    hp: 22,
    maxHp: 22,
    speed: 0,
    damage: 0,
    xp: 2,
    state: 'chase',
    stateTime: 0,
    hitFlash: 0,
    boss: false,
    attackCooldown: 999,
    vx: 0,
    vy: 0,
    ...partial,
  };
}

function projectileFixture(id: number): Projectile {
  return {
    id,
    x: 850,
    y: 560,
    radius: 8,
    facing: 0,
    weapon: 'arrow',
    owner: 'enemy',
    vx: 0,
    vy: 0,
    damage: 0,
    life: 30,
    pierce: 0,
    hitIds: [],
    generation: 0,
  };
}

function pickupFixture(id: number, value = 1): Pickup {
  return {
    id,
    x: 850,
    y: 560,
    radius: 6,
    facing: 0,
    kind: 'xp',
    value,
    life: 90,
  };
}

function passInitialSpawnClock(game: GameController): void {
  for (let index = 0; index < 5; index += 1) game.step(0.05, NO_INPUT);
}

describe('자원 개체 상한', () => {
  test('적 생성은 179개에서 정확히 180개까지 허용하고 180개에서는 더 늘지 않는다 (unit fixture)', () => {
    const belowCap = started();
    mutableStateFixture(belowCap).enemies = Array.from({ length: 179 }, (_, index) => enemyFixture(10_000 + index));
    passInitialSpawnClock(belowCap);
    assert.equal(belowCap.getState().enemies.length, 180);
    assert.equal(belowCap.getState().stats.maxEnemies, 180);

    const atCap = started();
    mutableStateFixture(atCap).enemies = Array.from({ length: 180 }, (_, index) => enemyFixture(20_000 + index));
    passInitialSpawnClock(atCap);
    assert.equal(atCap.getState().enemies.length, 180);
    assert.equal(atCap.getState().stats.maxEnemies, 180);
  });

  test('투사체 생성은 299개에서 정확히 300개까지 허용하고 300개에서는 거부한다 (unit fixture)', () => {
    const fireAt = (initialCount: number) => {
      const game = started();
      const state = mutableStateFixture(game);
      state.weapons = [{ id: 'arrow', level: 1, cooldown: 0, angle: 0 }];
      state.enemies = [enemyFixture(30_000, { x: 140, y: state.player.y })];
      state.projectiles = Array.from({ length: initialCount }, (_, index) => projectileFixture(31_000 + index));
      game.step(0.01, NO_INPUT);
      return game;
    };

    const belowCap = fireAt(299);
    assert.equal(belowCap.getState().projectiles.length, 300);
    assert.equal(belowCap.getState().projectiles.filter(({ owner }) => owner === 'player').length, 1);

    const atCap = fireAt(300);
    assert.equal(atCap.getState().projectiles.length, 300);
    assert.equal(atCap.getState().projectiles.filter(({ owner }) => owner === 'player').length, 0);
  });

  test('픽업 260개 상한에서는 새 XP를 기존 보석에 합쳐 총 XP를 보존한다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.weapons = [];
    state.pickups = Array.from({ length: 260 }, (_, index) => pickupFixture(40_000 + index, index + 1));
    state.enemies = [enemyFixture(41_000, { hp: 0, maxHp: 37, xp: 37 })];
    const beforeXp = state.pickups.reduce((sum, pickup) => sum + pickup.value, 0);

    game.step(0.01, NO_INPUT);

    const after = game.getState();
    assert.equal(after.pickups.length, 260);
    assert.equal(after.pickups.filter(({ kind }) => kind === 'xp').reduce((sum, pickup) => sum + pickup.value, 0), beforeXp + 37);
    assert.equal(after.stats.kills, 1);
  });
});

describe('처치와 이벤트 수명', () => {
  test('dead 수집은 같은 일반 적과 보스를 다음 step에서 다시 처치하거나 XP 지급하지 않는다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.weapons = [];
    state.bossSpawned = true;
    state.enemies = [
      enemyFixture(50_000, { hp: 0, xp: 2 }),
      enemyFixture(50_001, {
        kind: 'mushroomKing', hp: 0, maxHp: 1_700, xp: 55, boss: true, radius: 43,
      }),
    ];

    game.step(0.01, NO_INPUT);
    const firstEvents = game.drainEvents();
    const firstXp = game.getState().pickups.filter(({ kind }) => kind === 'xp').reduce((sum, pickup) => sum + pickup.value, 0);
    assert.equal(game.getState().stats.kills, 2);
    assert.equal(game.getState().stats.bossesDefeated, 1);
    assert.equal(firstXp, 57);
    assert.equal(firstEvents.filter(({ type }) => type === 'kill').length, 2);
    assert.equal(firstEvents.filter(({ type, text }) => type === 'boss' && text === 'defeated').length, 1);

    game.step(0.01, NO_INPUT);
    assert.equal(game.getState().stats.kills, 2);
    assert.equal(game.getState().stats.bossesDefeated, 1);
    assert.equal(game.getState().pickups.filter(({ kind }) => kind === 'xp').reduce((sum, pickup) => sum + pickup.value, 0), 57);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'kill' || type === 'boss').length, 0);
  });

  test('이벤트 큐는 1,000개 최신 이벤트만 보존하고 drain은 한 번만 전달한다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.weapons = [];
    state.enemies = Array.from({ length: 1_105 }, (_, index) => enemyFixture(60_000 + index, { hp: 0, xp: 1 }));

    game.step(0.01, NO_INPUT);
    const drained = game.drainEvents();

    assert.equal(drained.length, 1_000);
    assert.equal(drained[0]?.id, 106, '가장 오래된 105개 이벤트가 제거되어야 한다');
    assert.equal(drained.at(-1)?.id, 1_105);
    assert.ok(drained.every(({ type }) => type === 'kill'));
    assert.deepEqual(game.drainEvents(), []);
  });

  test('drain한 배열과 restart 전 상태 참조는 새 이벤트 및 새 판과 격리된다 (unit fixture)', () => {
    const game = started();
    const oldState = mutableStateFixture(game);
    game.step(0.01, { ...NO_INPUT, dashPressed: true });
    const drained = game.drainEvents();
    assert.equal(drained.filter(({ type }) => type === 'dash').length, 1);

    // This fixture intentionally permits another dash to verify event-array isolation.
    // The charge model requires all legacy/readiness fields to agree.
    oldState.player.dashCharges = Math.max(1, oldState.player.dashCharges);
    oldState.player.dashReuseDelay = 0;
    oldState.player.dashCooldown = 0;
    game.step(0.01, { ...NO_INPUT, dashPressed: true });
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 1);
    assert.equal(drained.length, 1, '나중 이벤트가 이미 drain한 배열에 추가되면 안 된다');

    game.step(0.01, { ...NO_INPUT, dashPressed: false });
    game.dispatch({ type: 'restart' });
    const restarted = game.getState();
    assert.notStrictEqual(restarted, oldState);
    assert.notStrictEqual(restarted.player, oldState.player);
    assert.notStrictEqual(restarted.enemies, oldState.enemies);
    assert.deepEqual(game.drainEvents(), [], '이전 판의 대기 이벤트가 restart 뒤 전달되면 안 된다');

    oldState.player.hp = 1;
    oldState.enemies.push(enemyFixture(70_000));
    assert.equal(restarted.player.hp, restarted.player.maxHp);
    assert.equal(restarted.enemies.length, 0);
  });
});
