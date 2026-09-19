import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createTouchControls } from '../src/controls/touch.ts';

type Listener = EventListenerOrEventListenerObject;

class FakeEventTarget {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: Record<string, unknown> = {}): void {
    Object.defineProperty(event, 'type', { value: type, configurable: true });
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') listener(event as unknown as Event);
      else listener.handleEvent(event as unknown as Event);
    }
  }

  count(type: string): number { return this.listeners.get(type)?.size ?? 0; }
}

class FakeStyle {
  transform = '';
  readonly values = new Map<string, string>();
  setProperty(name: string, value: string): void { this.values.set(name, value); }
  getPropertyValue(name: string): string { return this.values.get(name) ?? ''; }
}

class FakeClassList {
  private values = new Set<string>();
  add(...names: string[]): void { names.forEach((name) => this.values.add(name)); }
  remove(...names: string[]): void { names.forEach((name) => this.values.delete(name)); }
  toggle(name: string, force?: boolean): boolean {
    const next = force ?? !this.values.has(name);
    if (next) this.values.add(name); else this.values.delete(name);
    return next;
  }
  contains(name: string): boolean { return this.values.has(name); }
  replaceFrom(value: string): void { this.values = new Set(value.split(/\s+/).filter(Boolean)); }
}

class FakeElement extends FakeEventTarget {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly classList = new FakeClassList();
  readonly captures = new Set<number>();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  hidden = false;
  disabled = false;
  type = '';
  textContent = '';
  blurred = false;
  private classValue = '';

  constructor(readonly ownerDocument: FakeDocument, readonly tagName: string) { super(); }

  set className(value: string) { this.classValue = value; this.classList.replaceFrom(value); }
  get className(): string { return this.classValue; }

  append(...children: FakeElement[]): void {
    for (const child of children) { child.parent = this; this.children.push(child); }
  }

  remove(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
  setPointerCapture(pointerId: number): void { this.captures.add(pointerId); }
  hasPointerCapture(pointerId: number): boolean { return this.captures.has(pointerId); }
  releasePointerCapture(pointerId: number): void { this.captures.delete(pointerId); }
  blur(): void { this.blurred = true; }

  contains(candidate: unknown): boolean {
    if (candidate === this) return true;
    return this.children.some((child) => child.contains(candidate));
  }

  getBoundingClientRect(): DOMRect {
    return { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120, x: 0, y: 0, toJSON: () => ({}) };
  }
}

class FakeVisualViewport extends FakeEventTarget {
  offsetLeft = 3;
  offsetTop = 5;
  width = 844;
  height = 390;
}

class FakeWindow extends FakeEventTarget {
  readonly visualViewport = new FakeVisualViewport();
}

class FakeDocument extends FakeEventTarget {
  readonly defaultView = new FakeWindow();
  hidden = false;
  activeElement: FakeElement | null = null;
  createElement(tagName: string): FakeElement { return new FakeElement(this, tagName.toUpperCase()); }
}

const setup = () => {
  const document = new FakeDocument();
  const root = new FakeElement(document, 'BODY');
  const controls = createTouchControls(root as unknown as HTMLElement);
  const find = (className: string): FakeElement => {
    const visit = (element: FakeElement): FakeElement | undefined => {
      if (element.classList.contains(className)) return element;
      for (const child of element.children) {
        const found = visit(child);
        if (found) return found;
      }
      return undefined;
    };
    const result = visit(root);
    assert.ok(result, `Missing .${className}`);
    return result;
  };
  return { document, root, controls, overlay: find('touch-controls'), joystick: find('touch-controls__joystick'), dash: find('touch-controls__dash'), pause: find('touch-controls__pause') };
};

const pointer = (pointerId: number, clientX = 60, clientY = 60, pointerType = 'touch') => {
  let prevented = false;
  return {
    pointerId,
    clientX,
    clientY,
    pointerType,
    button: 0,
    preventDefault: () => { prevented = true; },
    wasPrevented: () => prevented,
  };
};

describe('터치 입력', () => {
  test('disabled로 생성되고 playing 활성 상태만 입력을 받는다', () => {
    const { root, controls, overlay, dash } = setup();
    assert.equal(overlay.hidden, true);
    assert.equal(overlay.getAttribute('aria-hidden'), 'true');
    assert.equal(dash.disabled, true);
    dash.emit('pointerdown', pointer(1));
    assert.equal(controls.read().dashPressed, false);

    controls.setEnabled(true);
    assert.equal(overlay.hidden, false);
    assert.equal(overlay.getAttribute('aria-hidden'), 'false');
    assert.equal(dash.disabled, false);
    assert.equal(root.classList.contains('touch-controls-host--enabled'), true);
    dash.emit('pointerdown', pointer(1));
    assert.equal(controls.read().dashPressed, true);
    assert.equal(controls.read().dashPressed, false);

    controls.setEnabled(false);
    assert.equal(overlay.hidden, true);
    assert.deepEqual(controls.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });
  });

  test('조이스틱 이동과 다른 포인터의 대시를 동시에 유지한다', () => {
    const { controls, joystick, dash } = setup();
    controls.setEnabled(true);

    joystick.emit('pointerdown', pointer(11, 120, 60));
    assert.equal(joystick.captures.has(11), true);
    const moving = controls.read();
    assert.ok(moving.moveX > 0.99);
    assert.ok(Math.abs(moving.moveY) < 1e-12);

    joystick.emit('pointermove', pointer(11, 120, 120));
    const diagonal = controls.read();
    assert.ok(Math.abs(Math.hypot(diagonal.moveX, diagonal.moveY) - 1) < 1e-12);

    dash.emit('pointerdown', pointer(22));
    assert.equal(dash.captures.has(22), true);
    const dashed = controls.read();
    assert.ok(dashed.moveX > 0.7);
    assert.ok(dashed.moveY > 0.7);
    assert.equal(dashed.dashPressed, true);
    assert.equal(controls.read().dashPressed, false);

    dash.emit('pointerup', pointer(22));
    assert.equal(dash.captures.has(22), false);
    assert.ok(controls.read().moveX > 0.7);
    joystick.emit('pointerup', pointer(11, 120, 60));
    assert.deepEqual(controls.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });
  });

  test('각 조작은 첫 pointer를 소유하고 cancel과 lost capture에서 고착되지 않는다', () => {
    const { controls, joystick, pause } = setup();
    controls.setEnabled(true);
    joystick.emit('pointerdown', pointer(1, 60, 0));
    joystick.emit('pointerdown', pointer(2, 120, 60));
    joystick.emit('pointermove', pointer(2, 120, 60));
    assert.ok(controls.read().moveY < -0.99);

    joystick.emit('pointercancel', pointer(1, 60, 0));
    assert.equal(controls.read().moveY, 0);

    pause.emit('pointerdown', pointer(3));
    assert.equal(controls.read().pausePressed, true);
    pause.emit('lostpointercapture', pointer(3));
    pause.emit('pointerdown', pointer(4));
    assert.equal(controls.read().pausePressed, true);
  });

  test('blur와 visibility hidden은 이동과 소비 전 edge를 모두 지운다', () => {
    const { document, controls, joystick, dash } = setup();
    controls.setEnabled(true);
    joystick.emit('pointerdown', pointer(1, 120, 60));
    dash.emit('pointerdown', pointer(2));
    document.defaultView.emit('blur');
    assert.deepEqual(controls.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });

    joystick.emit('pointerdown', pointer(3, 120, 60));
    dash.emit('pointerdown', pointer(4));
    document.hidden = true;
    document.emit('visibilitychange');
    assert.deepEqual(controls.read(), { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false });
  });

  test('visualViewport를 반영하고 dispose가 DOM과 리스너를 정리한다', () => {
    const { document, root, controls, overlay } = setup();
    assert.equal(overlay.style.getPropertyValue('--touch-vv-left'), '3px');
    assert.equal(overlay.style.getPropertyValue('--touch-vv-height'), '390px');
    assert.equal(document.defaultView.count('blur'), 1);
    assert.equal(document.defaultView.visualViewport.count('resize'), 1);

    controls.setEnabled(true);
    controls.dispose();
    controls.dispose();
    assert.equal(root.children.length, 0);
    assert.equal(root.classList.contains('touch-controls-host--enabled'), false);
    assert.equal(document.defaultView.count('blur'), 0);
    assert.equal(document.defaultView.visualViewport.count('resize'), 0);
  });
});
