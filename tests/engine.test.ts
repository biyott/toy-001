import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame, zoneContains } from '../src/game/engine.ts';
import type { GameController, GameOptions, InputFrame } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot, stepFor } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x1234abcd, character: 'knight', contentTier: 0 };
const MOVE_RIGHT: InputFrame = { ...NO_INPUT, moveX: 1 };

function started(options: GameOptions = OPTIONS): GameController {
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

describe('게임 수명주기와 결정성', () => {
  test('같은 시드와 입력은 같은 상태와 이벤트를 만든다', () => {
    const left = started();
    const right = started();

    for (let frame = 0; frame < 600; frame += 1) {
      const input = { moveX: Math.cos(frame / 90), moveY: Math.sin(frame / 90), dashPressed: frame % 150 === 0, pausePressed: false };
      left.step(1 / 60, input);
      right.step(1 / 60, input);
      assert.deepEqual(left.drainEvents(), right.drainEvents());
    }
    assert.deepEqual(left.getState(), right.getState());
  });

  test('다른 시드는 실제 생성 결과를 바꾼다', () => {
    const left = started({ ...OPTIONS, seed: 1 });
    const right = started({ ...OPTIONS, seed: 2 });
    stepFor(left, 8, MOVE_RIGHT);
    stepFor(right, 8, MOVE_RIGHT);

    const summarize = (game: GameController) => ({
      props: game.getState().props.map(({ kind, x, y, variant }) => [kind, x, y, variant]),
      enemies: game.getState().enemies.map(({ kind, x, y }) => [kind, x, y]),
    });
    assert.notDeepEqual(summarize(left), summarize(right));
  });

  test('일시정지 중 게임 상태와 시간이 완전히 동결된다', () => {
    const game = started();
    stepFor(game, 1, MOVE_RIGHT);
    game.drainEvents();
    game.dispatch({ type: 'pause' });
    assert.equal(game.getState().phase, 'paused');
    const paused = snapshot(game.getState());

    stepFor(game, 10, { moveX: -1, moveY: 1, dashPressed: true, pausePressed: false });
    assert.deepEqual(game.getState(), paused);
    assert.deepEqual(game.drainEvents(), []);

    game.dispatch({ type: 'resume' });
    game.step(0.05, NO_INPUT);
    assert.equal(game.getState().phase, 'playing');
    assert.ok(game.getState().elapsed > paused.elapsed);
  });

  test('재시작은 이전 판 상태와 대기 이벤트를 남기지 않는다', () => {
    const game = started();
    game.step(0.05, { ...MOVE_RIGHT, dashPressed: true });
    stepFor(game, 5, MOVE_RIGHT);
    assert.ok(game.getState().elapsed > 0);
    assert.ok(game.drainEvents().length > 0, '첫 판에서 검증할 이벤트가 발생해야 한다');
    game.step(0.05, { ...MOVE_RIGHT, dashPressed: true });

    game.dispatch({ type: 'restart' });
    const reset = game.getState();
    assert.equal(reset.phase, 'playing');
    assert.equal(reset.elapsed, 0);
    assert.equal(reset.player.hp, reset.player.maxHp);
    assert.equal(reset.player.xp, 0);
    assert.equal(reset.player.level, 1);
    assert.deepEqual(reset.stats, { kills: 0, damageDealt: 0, damageTaken: 0, score: 0, gems: 0, bossesDefeated: 0, maxEnemies: 0 });
    assert.equal(reset.bossSpawned, false);
    assert.equal(reset.bossDefeated, false);
    assert.deepEqual(game.drainEvents(), [], '이전 판의 오디오/렌더 이벤트가 재시작 뒤 재생되면 안 된다');
  });

  test('비정상적으로 큰 dt는 한 프레임에서 50ms를 넘겨 진행하지 않는다', () => {
    const game = started();
    game.step(30, NO_INPUT);
    assert.ok(game.getState().elapsed > 0);
    assert.ok(game.getState().elapsed <= 0.05 + Number.EPSILON);
  });
});

describe('이동, 대시, 전투 이벤트', () => {
  test('대시는 한 입력에서 한 번만 시작되고 재사용 대기시간을 적용한다', () => {
    const game = started();
    const before = snapshot(game.getState().player);

    game.step(0.05, { ...MOVE_RIGHT, dashPressed: true });
    const afterDash = snapshot(game.getState().player);
    const firstEvents = game.drainEvents().filter(({ type }) => type === 'dash');
    assert.equal(firstEvents.length, 1);
    assert.ok(afterDash.x > before.x);
    assert.ok(afterDash.dashCooldown > 0);
    assert.ok(afterDash.invulnerable > 0);

    game.step(0.05, MOVE_RIGHT);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 0);
    game.step(0.05, { ...MOVE_RIGHT, dashPressed: true });
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 0, '대기시간 중 두 번째 대시는 금지된다');
  });

  test('적 공격 판정은 체력과 피해 통계를 같은 값만큼 줄인다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    const hp = state.player.hp;
    state.zones.push({
      id: 9_000_001, x: state.player.x, y: state.player.y, shape: 'circle', radius: 80,
      angle: 0, telegraph: 0, duration: 0.2, damage: 17, owner: 'enemy', kind: 'qa-fixture', hitIds: [],
    });

    game.step(0.01, NO_INPUT);
    assert.equal(game.getState().player.hp, hp - 17);
    assert.equal(game.getState().stats.damageTaken, 17);
    assert.equal(game.drainEvents().filter(({ type, kind }) => type === 'hit' && kind === 'player').length, 1);
  });

  test('화면 예고와 충돌은 같은 원·고리·선·부채꼴 기하를 사용한다', () => {
    const base = { id: 1, x: 0, y: 0, radius: 100, angle: 0, telegraph: 1, duration: 1, damage: 1, owner: 'enemy' as const, kind: 'fixture', hitIds: [] };
    assert.equal(zoneContains({ ...base, shape: 'circle' }, { x: 99, y: 0 }), true);
    assert.equal(zoneContains({ ...base, shape: 'circle' }, { x: 101, y: 0 }), false);
    assert.equal(zoneContains({ ...base, shape: 'ring', innerRadius: 50 }, { x: 30, y: 0 }), false);
    assert.equal(zoneContains({ ...base, shape: 'ring', innerRadius: 50 }, { x: 70, y: 0 }), true);
    assert.equal(zoneContains({ ...base, shape: 'line', length: 120, width: 20 }, { x: 80, y: 9 }), true);
    assert.equal(zoneContains({ ...base, shape: 'line', length: 120, width: 20 }, { x: 80, y: 11 }), false);
    assert.equal(zoneContains({ ...base, shape: 'cone', width: Math.PI / 2 }, { x: 70, y: 0 }), true);
    assert.equal(zoneContains({ ...base, shape: 'cone', width: Math.PI / 2 }, { x: -70, y: 0 }), false);
  });
});

describe('성장, 보스, 종료 경계', () => {
  test('정상 step/dispatch 경로만으로 전투, XP, 3개 성장 선택을 진행한다', () => {
    const game = started();
    const seenChoices: string[][] = [];

    for (let frame = 0; frame < 45 * 30; frame += 1) {
      let state = game.getState();
      if (state.phase === 'levelup') {
        seenChoices.push(state.upgradeChoices.map(({ id }) => id));
        game.dispatch({ type: 'selectUpgrade', id: state.upgradeChoices[0]!.id });
        state = game.getState();
      }
      if (state.phase !== 'playing') break;

      const player = state.player;
      const targets = state.pickups.length > 0 ? state.pickups : state.enemies;
      const target = targets.reduce<(typeof targets)[number] | undefined>((nearest, candidate) => {
        const distance = (candidate.x - player.x) ** 2 + (candidate.y - player.y) ** 2;
        if (!nearest) return candidate;
        const nearestDistance = (nearest.x - player.x) ** 2 + (nearest.y - player.y) ** 2;
        return distance < nearestDistance ? candidate : nearest;
      }, undefined);
      let moveX = 0;
      let moveY = 0;
      if (target) {
        moveX = target.x - player.x;
        moveY = target.y - player.y;
        const distance = Math.hypot(moveX, moveY) || 1;
        if (targets === state.enemies && distance < 55) { moveX *= -1; moveY *= -1; }
        const magnitude = Math.hypot(moveX, moveY) || 1;
        moveX /= magnitude;
        moveY /= magnitude;
      }
      game.step(1 / 30, { moveX, moveY, dashPressed: frame % 90 === 0, pausePressed: false });
      game.drainEvents();
    }

    assert.ok(game.getState().stats.kills > 0);
    assert.ok(game.getState().stats.damageDealt > 0);
    assert.ok(game.getState().player.level > 1);
    assert.ok(seenChoices.length > 0);
    for (const choices of seenChoices) {
      assert.equal(choices.length, 3);
      assert.equal(new Set(choices).size, 3);
    }
  });

  test('XP 수집으로 서로 다른 성장 선택지 3개를 제시하고 선택을 적용한다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.pickups.push({
      id: 9_000_002, kind: 'xp', value: state.player.xpToNext, life: 10,
      x: state.player.x, y: state.player.y, radius: 12, facing: 0,
    });

    game.step(0.01, NO_INPUT);
    const choices = game.getState().upgradeChoices;
    assert.equal(game.getState().phase, 'levelup');
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(({ id }) => id)).size, 3);

    const selected = choices[0]!;
    game.dispatch({ type: 'selectUpgrade', id: selected.id });
    assert.equal(game.getState().phase, 'playing');
    assert.equal(game.getState().upgradeChoices.length, 0);
    assert.ok(game.getState().player.upgrades[selected.id] >= 1 || game.getState().weapons.some(({ id }) => id === selected.weapon));
  });

  test('보스 등장 뒤 공격 예고와 둘 이상의 패턴을 만든다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.elapsed = state.duration - 61;
    state.player.invulnerable = 120;
    const telegraphs = new Set<string>();

    for (let frame = 0; frame < 1_800; frame += 1) {
      game.step(1 / 30, NO_INPUT);
      for (const zone of game.getState().zones) {
        if (zone.owner === 'enemy' && zone.telegraph > 0) telegraphs.add(`${zone.kind}:${zone.shape}`);
      }
      if (telegraphs.size >= 2) break;
    }

    assert.equal(game.getState().bossSpawned, true);
    assert.ok(game.getState().enemies.some(({ boss }) => boss));
    assert.ok(telegraphs.size >= 2, `관찰한 보스 예고 패턴: ${[...telegraphs].join(', ') || '없음'}`);
  });

  test('HP 0은 패배로 한 번만 종료한다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.player.hp = 1;
    state.zones.push({
      id: 9_000_003, x: state.player.x, y: state.player.y, shape: 'circle', radius: 80,
      angle: 0, telegraph: 0, duration: 0.2, damage: 5, owner: 'enemy', kind: 'qa-defeat', hitIds: [],
    });

    game.step(0.01, NO_INPUT);
    assert.equal(game.getState().phase, 'defeat');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'defeat').length, 1);
    game.step(1, NO_INPUT);
    assert.equal(game.getState().phase, 'defeat');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'defeat').length, 0);
  });

  test('보스 처치 후 제한시간 도달은 승리로 한 번만 종료한다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.bossSpawned = true;
    state.bossDefeated = true;
    state.elapsed = state.duration - 0.01;

    game.step(0.02, NO_INPUT);
    assert.equal(game.getState().phase, 'victory');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'victory').length, 1);
    game.step(1, NO_INPUT);
    assert.equal(game.getState().phase, 'victory');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'victory').length, 0);
  });
});
