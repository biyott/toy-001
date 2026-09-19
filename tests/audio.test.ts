import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';

import { createAudio } from '../src/audio.ts';

class FakeAudioParam {
  value = 1;
  lastTarget: number | undefined;
  setValueAtTime(value: number): void { this.value = value; }
  exponentialRampToValueAtTime(value: number): void { this.value = value; }
  setTargetAtTime(value: number): void { this.lastTarget = value; this.value = value; }
}

class FakeGain {
  gain = new FakeAudioParam();
  connect(): void {}
  disconnect(): void {}
}

class FakeOscillator {
  type: OscillatorType = 'sine';
  frequency = new FakeAudioParam();
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  connect(): void {}
  disconnect(): void {}
  start(): void { this.started = true; }
  stop(): void { this.stopped = true; }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state: AudioContextState = 'suspended';
  currentTime = 10;
  destination = {};
  gains: FakeGain[] = [];
  oscillators: FakeOscillator[] = [];
  resumeCalls = 0;
  closed = false;

  constructor() { FakeAudioContext.instances.push(this); }
  createGain(): FakeGain { const gain = new FakeGain(); this.gains.push(gain); return gain; }
  createOscillator(): FakeOscillator { const oscillator = new FakeOscillator(); this.oscillators.push(oscillator); return oscillator; }
  resume(): Promise<void> { this.resumeCalls += 1; this.state = 'running'; return Promise.resolve(); }
  close(): Promise<void> { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
}

describe('오디오 잠금 해제와 음소거', () => {
  let previousAudioContext: typeof globalThis.AudioContext | undefined;

  beforeEach(() => {
    previousAudioContext = globalThis.AudioContext;
    FakeAudioContext.instances = [];
    Object.assign(globalThis, { AudioContext: FakeAudioContext });
  });

  afterEach(() => {
    if (previousAudioContext === undefined) delete (globalThis as { AudioContext?: unknown }).AudioContext;
    else Object.assign(globalThis, { AudioContext: previousAudioContext });
  });

  test('저장된 음소거를 첫 사용자 unlock 전에 적용하고 context를 중복 생성하지 않는다', () => {
    const audio = createAudio();
    audio.setMuted(true);
    audio.unlock();
    audio.unlock();

    assert.equal(FakeAudioContext.instances.length, 1);
    const context = FakeAudioContext.instances[0]!;
    assert.equal(context.resumeCalls, 1);
    assert.equal(context.gains[0]!.gain.value, 0);
    assert.deepEqual(audio.diagnostics(), { state: 'running', muted: true, voices: 0 });
    audio.dispose();
    assert.equal(context.closed, true);
  });

  test('음소거 중 이벤트는 voice를 만들지 않고 해제 뒤 이벤트는 재생한다', () => {
    const audio = createAudio();
    audio.unlock();
    const context = FakeAudioContext.instances[0]!;
    audio.consume([{ id: 1, type: 'dash', x: 0, y: 0 }], { muted: true, reducedMotion: false });
    assert.equal(context.oscillators.length, 0);

    audio.consume([{ id: 2, type: 'dash', x: 0, y: 0 }], { muted: false, reducedMotion: false });
    assert.equal(context.oscillators.length, 1);
    assert.equal(context.oscillators[0]!.started, true);
    audio.dispose();
    assert.equal(context.oscillators[0]!.stopped, true);
  });
});
