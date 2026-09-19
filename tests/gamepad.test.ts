import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createGamepadReader, mergeInputFrames } from '../src/controls/gamepad.ts';
import type { InputFrame } from '../src/types.ts';

type PadOptions = {
  index?: number;
  axes?: readonly number[];
  pressed?: readonly number[];
  values?: Readonly<Record<number, number>>;
  mapping?: GamepadMappingType;
  connected?: boolean;
};

function gamepad(options: PadOptions = {}): Gamepad {
  const pressed = new Set(options.pressed ?? []);
  const buttons = Array.from({ length: 17 }, (_, index): GamepadButton => ({
    pressed: pressed.has(index),
    touched: pressed.has(index),
    value: options.values?.[index] ?? (pressed.has(index) ? 1 : 0),
  }));
  return {
    axes: [...(options.axes ?? [0, 0, 0, 0])],
    buttons,
    connected: options.connected ?? true,
    id: `test-pad-${options.index ?? 0}`,
    index: options.index ?? 0,
    mapping: options.mapping ?? 'standard',
    timestamp: 0,
    vibrationActuator: undefined,
  } as unknown as Gamepad;
}

const neutral: InputFrame = {
  moveX: 0,
  moveY: 0,
  dashPressed: false,
  pausePressed: false,
};

describe('표준 게임패드 입력', () => {
  test('radial deadzone을 재조정하고 비정상 축 값을 중립으로 만든다', () => {
    const reader = createGamepadReader();
    let readout = reader.readGamepad([gamepad({ axes: [0.19, 0], pressed: [0] })]);
    assert.equal(readout.frame.moveX, 0);

    readout = reader.readGamepad([gamepad({ axes: [0.6, 0] })]);
    assert.ok(Math.abs(readout.frame.moveX - 0.5) < 1e-12);
    assert.equal(readout.frame.moveY, 0);

    readout = reader.readGamepad([gamepad({ axes: [0.8, 0.8] })]);
    assert.ok(Math.abs(Math.hypot(readout.frame.moveX, readout.frame.moveY) - 1) < 1e-12);

    readout = reader.readGamepad([gamepad({ axes: [Number.NaN, Number.POSITIVE_INFINITY] })]);
    assert.equal(readout.frame.moveX, 0);
    assert.equal(readout.frame.moveY, 0);
  });

  test('D-pad는 스틱보다 우선하고 대각선 8방향을 정규화한다', () => {
    const reader = createGamepadReader();
    const diagonal = reader.readGamepad([gamepad({ axes: [-1, 1], pressed: [12, 15] })]);
    assert.ok(Math.abs(diagonal.frame.moveX - Math.SQRT1_2) < 1e-12);
    assert.ok(Math.abs(diagonal.frame.moveY + Math.SQRT1_2) < 1e-12);
    assert.deepEqual(diagonal.menuPressed, ['up', 'right']);

    const held = reader.readGamepad([gamepad({ axes: [-1, 1], pressed: [12, 15] })]);
    assert.ok(Math.abs(held.frame.moveX - Math.SQRT1_2) < 1e-12);
    assert.deepEqual(held.menuPressed, []);
  });

  test('A와 트리거 대시, Start pause, confirm/back을 press edge로 한 번만 낸다', () => {
    const reader = createGamepadReader();
    const first = reader.readGamepad([gamepad({ pressed: [0, 1, 9] })]);
    assert.equal(first.frame.dashPressed, true);
    assert.equal(first.frame.pausePressed, true);
    assert.deepEqual(first.menuPressed, ['confirm', 'back']);

    const held = reader.readGamepad([gamepad({ pressed: [0, 1, 9] })]);
    assert.equal(held.frame.dashPressed, false);
    assert.equal(held.frame.pausePressed, false);
    assert.deepEqual(held.menuPressed, []);

    reader.readGamepad([gamepad()]);
    assert.equal(reader.readGamepad([gamepad({ values: { 6: 0.6 } })]).frame.dashPressed, true);
    assert.equal(reader.readGamepad([gamepad({ values: { 6: 0.7 } })]).frame.dashPressed, false);
    reader.readGamepad([gamepad()]);
    assert.equal(reader.readGamepad([gamepad({ pressed: [7] })]).frame.dashPressed, true);
  });

  test('메뉴 stick은 0.65 진입과 0.45 해제 hysteresis를 적용한다', () => {
    const reader = createGamepadReader();
    assert.deepEqual(reader.readGamepad([gamepad({ axes: [0.66, 0] })]).menuPressed, ['right']);
    assert.deepEqual(reader.readGamepad([gamepad({ axes: [0.6, 0] })]).menuPressed, []);
    assert.deepEqual(reader.readGamepad([gamepad({ axes: [0.46, 0] })]).menuPressed, []);
    assert.deepEqual(reader.readGamepad([gamepad({ axes: [0.44, 0] })]).menuPressed, []);
    assert.deepEqual(reader.readGamepad([gamepad({ axes: [0.66, 0] })]).menuPressed, ['right']);
  });

  test('clear는 모든 관련 control이 중립이 될 때까지 held 입력을 차단한다', () => {
    const reader = createGamepadReader();
    reader.readGamepad([gamepad({ axes: [1, 0], pressed: [0, 9] })]);
    reader.clear();

    let readout = reader.readGamepad([gamepad({ axes: [1, 0], pressed: [0, 9] })]);
    assert.deepEqual(readout.frame, neutral);
    assert.deepEqual(readout.menuPressed, []);
    assert.equal(reader.diagnostics().waitingForNeutral, true);

    readout = reader.readGamepad([gamepad()]);
    assert.deepEqual(readout.frame, neutral);
    assert.equal(reader.diagnostics().waitingForNeutral, false);

    readout = reader.readGamepad([gamepad({ pressed: [0] })]);
    assert.equal(readout.frame.dashPressed, true);
    assert.deepEqual(readout.menuPressed, ['confirm']);
  });

  test('서로 반대인 D-pad 두 버튼도 neutral gate를 해제하지 않는다', () => {
    const reader = createGamepadReader();
    reader.readGamepad([gamepad({ pressed: [12] })]);
    reader.clear();

    reader.readGamepad([gamepad({ pressed: [12, 13] })]);
    assert.equal(reader.diagnostics().waitingForNeutral, true);
    reader.readGamepad([gamepad()]);
    assert.equal(reader.diagnostics().waitingForNeutral, false);
  });

  test('disconnect read는 중립이며 held 보조 패드는 release 뒤 새로 점유한다', () => {
    const reader = createGamepadReader();
    assert.equal(reader.readGamepad([gamepad({ index: 2, pressed: [0] })]).activeIndex, 2);

    let readout = reader.readGamepad([gamepad({ index: 1, pressed: [9] })]);
    assert.equal(readout.activeIndex, null);
    assert.deepEqual(readout.frame, neutral);

    readout = reader.readGamepad([gamepad({ index: 1, pressed: [9] })]);
    assert.equal(readout.activeIndex, null);
    assert.deepEqual(readout.frame, neutral);

    reader.readGamepad([gamepad({ index: 1 })]);
    readout = reader.readGamepad([gamepad({ index: 1, pressed: [9] })]);
    assert.equal(readout.activeIndex, 1);
    assert.equal(readout.frame.pausePressed, true);
  });

  test('활성 패드는 첫 유효 입력 중 낮은 index를 선택하고 raw mapping은 무시한다', () => {
    const reader = createGamepadReader();
    const readout = reader.readGamepad([
      gamepad({ index: 5, pressed: [0] }),
      gamepad({ index: 9, pressed: [9], mapping: '' }),
      gamepad({ index: 2, pressed: [9] }),
      gamepad({ index: 1, pressed: [0], connected: false }),
    ]);
    assert.equal(readout.activeIndex, 2);
    assert.equal(readout.frame.pausePressed, true);
    assert.equal(readout.connectedStandardPads, 2);
    assert.equal(readout.unsupportedPads, 1);
  });
});

describe('키보드와 게임패드 병합', () => {
  test('이동은 합산 후 정규화하고 반대 방향은 상쇄하며 edge는 OR한다', () => {
    const diagonal = mergeInputFrames(
      { moveX: 1, moveY: 0, dashPressed: true, pausePressed: false },
      { moveX: 0, moveY: 1, dashPressed: false, pausePressed: true },
    );
    assert.ok(Math.abs(diagonal.moveX - Math.SQRT1_2) < 1e-12);
    assert.ok(Math.abs(diagonal.moveY - Math.SQRT1_2) < 1e-12);
    assert.equal(diagonal.dashPressed, true);
    assert.equal(diagonal.pausePressed, true);

    assert.deepEqual(mergeInputFrames(
      { moveX: 1, moveY: 0, dashPressed: false, pausePressed: false },
      { moveX: -1, moveY: 0, dashPressed: false, pausePressed: false },
    ), neutral);
  });

  test('NaN과 Infinity 성분은 0으로 처리한다', () => {
    assert.deepEqual(mergeInputFrames(
      { moveX: Number.NaN, moveY: Number.POSITIVE_INFINITY, dashPressed: false, pausePressed: false },
      { moveX: 0.25, moveY: -0.5, dashPressed: false, pausePressed: false },
    ), { ...neutral, moveX: 0.25, moveY: -0.5 });
  });
});
