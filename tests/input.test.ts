import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { createInput } from '../src/input.ts';

type Listener = (event: FakeKeyboardEvent) => void;

class FakeElement {
  constructor(readonly tagName: string, readonly isContentEditable = false) {}
}

class FakeWindow {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: FakeKeyboardEvent): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  count(type: string): number { return this.listeners.get(type)?.size ?? 0; }
}

class FakeKeyboardEvent {
  defaultPrevented = false;
  constructor(
    readonly code: string,
    readonly target: FakeElement,
    readonly repeat = false,
  ) {}
  preventDefault(): void { this.defaultPrevented = true; }
}

describe('키보드 입력 수명주기', () => {
  let fakeWindow: FakeWindow;
  let previousWindow: typeof globalThis.window | undefined;
  let previousElement: typeof globalThis.HTMLElement | undefined;

  beforeEach(() => {
    fakeWindow = new FakeWindow();
    previousWindow = globalThis.window;
    previousElement = globalThis.HTMLElement;
    Object.assign(globalThis, { window: fakeWindow, HTMLElement: FakeElement });
  });

  afterEach(() => {
    if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else Object.assign(globalThis, { window: previousWindow });
    if (previousElement === undefined) delete (globalThis as { HTMLElement?: unknown }).HTMLElement;
    else Object.assign(globalThis, { HTMLElement: previousElement });
  });

  test('포커스된 버튼의 Space는 네이티브 클릭을 취소하고 대시 edge를 한 번만 만든다', () => {
    const input = createInput();
    const event = new FakeKeyboardEvent('Space', new FakeElement('BUTTON'));
    fakeWindow.emit('keydown', event);

    assert.equal(event.defaultPrevented, true);
    assert.equal(input.read().dashPressed, true);
    assert.equal(input.read().dashPressed, false);

    const repeated = new FakeKeyboardEvent('Space', event.target, true);
    fakeWindow.emit('keydown', repeated);
    assert.equal(repeated.defaultPrevented, true);
    assert.equal(input.read().dashPressed, false);
    input.dispose();
  });

  test('이동키는 keyup과 blur에서 해제되고 대각선은 정규화된다', () => {
    const input = createInput();
    const body = new FakeElement('BODY');
    fakeWindow.emit('keydown', new FakeKeyboardEvent('KeyW', body));
    fakeWindow.emit('keydown', new FakeKeyboardEvent('KeyD', body));

    const diagonal = input.read();
    assert.ok(Math.abs(Math.hypot(diagonal.moveX, diagonal.moveY) - 1) < 1e-12);
    fakeWindow.emit('keyup', new FakeKeyboardEvent('KeyW', body));
    assert.deepEqual(input.read(), { moveX: 1, moveY: 0, dashPressed: false, pausePressed: false });
    fakeWindow.emit('blur', new FakeKeyboardEvent('', body));
    assert.deepEqual(input.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });
    input.dispose();
  });

  test('텍스트 입력의 게임 키는 가로채지 않고 dispose가 리스너를 제거한다', () => {
    const input = createInput();
    const event = new FakeKeyboardEvent('Space', new FakeElement('INPUT'));
    fakeWindow.emit('keydown', event);
    assert.equal(event.defaultPrevented, false);
    assert.equal(input.read().dashPressed, false);
    assert.equal(fakeWindow.count('keydown'), 1);

    input.dispose();
    assert.equal(fakeWindow.count('keydown'), 0);
    assert.equal(fakeWindow.count('keyup'), 0);
    assert.equal(fakeWindow.count('blur'), 0);
  });

  test('clear는 재시작 전에 held key와 dash/pause edge를 모두 제거한다', () => {
    const input = createInput();
    const body = new FakeElement('BODY');
    fakeWindow.emit('keydown', new FakeKeyboardEvent('KeyA', body));
    fakeWindow.emit('keydown', new FakeKeyboardEvent('Space', body));
    fakeWindow.emit('keydown', new FakeKeyboardEvent('Escape', body));
    input.clear();

    assert.deepEqual(input.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });
    input.dispose();
  });
});
