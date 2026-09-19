import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGame } from '../src/game/engine.ts';
import type { GameController, GameOptions, InputFrame, Prop } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x4d_4f_56_45, character: 'knight', contentTier: 0 };
const EPSILON = 1e-9;

function started(): GameController {
  const game = createGame(OPTIONS);
  game.dispatch({ type: 'start', options: OPTIONS });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

function isolateMovement(game: GameController): ReturnType<typeof mutableStateFixture> {
  const state = mutableStateFixture(game);
  state.props = [];
  state.enemies = [];
  state.projectiles = [];
  state.pickups = [];
  state.zones = [];
  return state;
}

function solidRock(x: number, y: number, radius: number): Prop {
  return { id: -9_900_001, kind: 'rock', x, y, radius, scale: 1, solid: true, variant: 0 };
}

describe('입력에서 플레이어 물리 이동까지', () => {
  test('플레이어 중심은 실제 월드 네 경계에서 반지름만큼 안쪽에 제한된다', () => {
    const cases = [
      { x: 984, y: 0, input: { moveX: 1, moveY: 0 }, expectedX: 985, expectedY: 0 },
      { x: -984, y: 0, input: { moveX: -1, moveY: 0 }, expectedX: -985, expectedY: 0 },
      { x: 0, y: 664, input: { moveX: 0, moveY: 1 }, expectedX: 0, expectedY: 665 },
      { x: 0, y: -664, input: { moveX: 0, moveY: -1 }, expectedX: 0, expectedY: -665 },
    ] as const;

    for (const expected of cases) {
      const game = started();
      const state = isolateMovement(game);
      state.player.x = expected.x;
      state.player.y = expected.y;

      game.step(0.05, { ...NO_INPUT, ...expected.input });

      assert.equal(state.world.halfWidth, 1_000);
      assert.equal(state.world.halfHeight, 680);
      assert.equal(state.player.radius, 15);
      assert.equal(state.player.x, expected.expectedX);
      assert.equal(state.player.y, expected.expectedY);
    }
  });

  test('대각선 입력은 축 입력과 같은 속도로 정규화된다', () => {
    const axialGame = started();
    const diagonalGame = started();
    const axial = isolateMovement(axialGame);
    const diagonal = isolateMovement(diagonalGame);
    axial.player.x = diagonal.player.x = 0;
    axial.player.y = diagonal.player.y = 0;

    axialGame.step(0.05, { ...NO_INPUT, moveX: 1 });
    diagonalGame.step(0.05, { ...NO_INPUT, moveX: 1, moveY: 1 });

    const axialDistance = Math.hypot(axial.player.x, axial.player.y);
    const diagonalDistance = Math.hypot(diagonal.player.x, diagonal.player.y);
    assert.ok(Math.abs(axialDistance - axial.player.speed * 0.05) < EPSILON);
    assert.ok(Math.abs(diagonalDistance - axialDistance) < EPSILON,
      `대각선 ${diagonalDistance}, 축 ${axialDistance}`);
    assert.ok(Math.abs(diagonal.player.x - diagonal.player.y) < EPSILON);
  });

  test('solid 소품만 이동을 막고 장식 소품은 통과시킨다', () => {
    const solidGame = started();
    const solidState = mutableStateFixture(solidGame);
    const wall = solidState.props.find(({ kind, solid }) => kind === 'wall' && solid);
    assert.ok(wall, '월드에는 solid 벽이 있어야 한다');
    solidState.props = [wall];
    solidState.player.x = wall.x - wall.radius - solidState.player.radius - 1;
    solidState.player.y = wall.y;

    solidGame.step(0.05, { ...NO_INPUT, moveX: 1 });

    const solidDistance = Math.hypot(solidState.player.x - wall.x, solidState.player.y - wall.y);
    assert.ok(solidDistance + EPSILON >= wall.radius + solidState.player.radius);
    assert.ok(solidState.player.x <= wall.x - wall.radius - solidState.player.radius + EPSILON);

    const decorativeGame = started();
    const decorativeState = mutableStateFixture(decorativeGame);
    const gate = decorativeState.props.find(({ kind, solid }) => kind === 'gate' && !solid);
    assert.ok(gate, '월드에는 통과 가능한 장식 문이 있어야 한다');
    decorativeState.props = [gate];
    decorativeState.player.x = gate.x - gate.radius - decorativeState.player.radius - 1;
    decorativeState.player.y = gate.y;
    const beforeX = decorativeState.player.x;

    decorativeGame.step(0.05, { ...NO_INPUT, moveX: 1 });

    assert.ok(Math.abs(decorativeState.player.x - beforeX - decorativeState.player.speed * 0.05) < EPSILON);
    const decorativeDistance = Math.hypot(decorativeState.player.x - gate.x, decorativeState.player.y - gate.y);
    assert.ok(decorativeDistance < gate.radius + decorativeState.player.radius,
      '장식 소품의 반경은 플레이어 충돌을 만들면 안 된다');
  });

  test('빠른 대시도 10단위 이동 분할로 좁은 solid 소품을 터널링하지 않는다 (unit fixture)', () => {
    const game = started();
    const state = isolateMovement(game);
    state.player.x = 0;
    state.player.y = 0;
    state.player.facing = 0;
    state.player.speed = 1_000;
    const rock = solidRock(40, 0, 5);
    state.props = [rock];

    game.step(0.05, { ...NO_INPUT, moveX: 1, dashPressed: true });

    const contactX = rock.x - rock.radius - state.player.radius;
    assert.ok(state.player.x <= contactX + EPSILON,
      `플레이어가 좁은 소품을 통과함: x=${state.player.x}, 접촉면=${contactX}`);
    assert.ok(Math.hypot(state.player.x - rock.x, state.player.y - rock.y) + EPSILON >= rock.radius + state.player.radius);
  });

  test('월드 모서리 소품의 반발 뒤에도 플레이어는 경계 안에 남는다 (unit fixture)', () => {
    const game = started();
    const state = isolateMovement(game);
    const maxX = state.world.halfWidth - state.player.radius;
    const maxY = state.world.halfHeight - state.player.radius;
    state.player.x = maxX;
    state.player.y = maxY;
    const rock = solidRock(maxX - 1, maxY - 1, 20);
    state.props = [rock];

    game.step(0.01, NO_INPUT);

    assert.ok(Number.isFinite(state.player.x) && state.player.x >= -maxX && state.player.x <= maxX,
      `소품 반발 뒤 x=${state.player.x}, 허용 범위=${-maxX}..${maxX}`);
    assert.ok(Number.isFinite(state.player.y) && state.player.y >= -maxY && state.player.y <= maxY,
      `소품 반발 뒤 y=${state.player.y}, 허용 범위=${-maxY}..${maxY}`);
    const distanceFromRock = Math.hypot(state.player.x - rock.x, state.player.y - rock.y);
    assert.ok(distanceFromRock + EPSILON >= rock.radius + state.player.radius,
      `경계 제한 뒤 소품 내부에 끼임: 거리=${distanceFromRock}, 최소=${rock.radius + state.player.radius}`);
  });

  test('월드 모서리에서 겹친 두 solid 소품과 경계를 동시에 해소한다 (unit fixture)', () => {
    const game = started();
    const state = isolateMovement(game);
    const maxX = state.world.halfWidth - state.player.radius;
    const maxY = state.world.halfHeight - state.player.radius;
    state.player.x = maxX;
    state.player.y = maxY;
    const rocks = [
      solidRock(maxX - 10, maxY - 10, 20),
      { ...solidRock(maxX - 30, maxY - 10, 20), id: -9_900_002 },
    ];
    state.props = rocks;

    game.step(0.01, NO_INPUT);

    assert.ok(Number.isFinite(state.player.x) && state.player.x >= -maxX && state.player.x <= maxX,
      `두 소품 반발 뒤 x=${state.player.x}, 허용 범위=${-maxX}..${maxX}`);
    assert.ok(Number.isFinite(state.player.y) && state.player.y >= -maxY && state.player.y <= maxY,
      `두 소품 반발 뒤 y=${state.player.y}, 허용 범위=${-maxY}..${maxY}`);
    for (const rock of rocks) {
      const distance = Math.hypot(state.player.x - rock.x, state.player.y - rock.y);
      assert.ok(distance + EPSILON >= rock.radius + state.player.radius,
        `경계 해소 뒤 소품 ${rock.id} 내부에 끼임: 거리=${distance}, 최소=${rock.radius + state.player.radius}`);
    }
  });

  test('NaN과 Infinity 이동축은 좌표와 방향을 오염시키지 않는다', () => {
    const cases: InputFrame[] = [
      { ...NO_INPUT, moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY },
      { ...NO_INPUT, moveX: Number.NEGATIVE_INFINITY, moveY: 1 },
      { ...NO_INPUT, moveX: 1, moveY: Number.NaN },
      { ...NO_INPUT, moveX: Number.POSITIVE_INFINITY, moveY: Number.NEGATIVE_INFINITY, dashPressed: true },
    ];

    for (const input of cases) {
      const game = started();
      const state = isolateMovement(game);
      state.player.x = 0;
      state.player.y = 0;

      game.step(0.05, input);

      assert.ok(Number.isFinite(state.player.x), `moveX=${input.moveX}, moveY=${input.moveY}: x=${state.player.x}`);
      assert.ok(Number.isFinite(state.player.y), `moveX=${input.moveX}, moveY=${input.moveY}: y=${state.player.y}`);
      assert.ok(Number.isFinite(state.player.facing), `moveX=${input.moveX}, moveY=${input.moveY}: facing=${state.player.facing}`);
      assert.ok(state.player.x >= -state.world.halfWidth + state.player.radius);
      assert.ok(state.player.x <= state.world.halfWidth - state.player.radius);
      assert.ok(state.player.y >= -state.world.halfHeight + state.player.radius);
      assert.ok(state.player.y <= state.world.halfHeight - state.player.radius);
    }
  });
});
