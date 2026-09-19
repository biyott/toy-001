import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  DASH_REUSE_SECONDS,
  advanceDash,
  configureDash,
  consumeDash,
  initialDashState,
} from '../src/game/dash.ts';
import { createGame } from '../src/game/engine.ts';
import type { CharacterId, GameController, GameOptions, Player } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot, stepFor } from './fixtures.ts';

const EPSILON = 1e-9;
const DASH = { ...NO_INPUT, moveX: 1, dashPressed: true } as const;

function started(character: CharacterId = 'knight'): GameController {
  const options: GameOptions = { mode: 'normal', seed: 0x44_41_53_48, character, contentTier: 1 };
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

function dashSnapshot(player: Readonly<Player>) {
  return {
    charges: player.dashCharges,
    maximum: player.dashMaxCharges,
    rechargeRemaining: player.dashRechargeRemaining,
    rechargeDuration: player.dashRechargeDuration,
    reuseDelay: player.dashReuseDelay,
    cooldown: player.dashCooldown,
  };
}

function close(actual: number, expected: number, message?: string): void {
  assert.ok(Math.abs(actual - expected) < EPSILON, message ?? `${actual} !== ${expected}`);
}

describe('대시 충전 프로필과 초기화', () => {
  test('기사는 2/5초, 마법사는 1/4초, 궁수는 3/6초로 가득 찬 상태에서 시작한다', () => {
    const cases = [
      { character: 'knight', charges: 2, duration: 5 },
      { character: 'mage', charges: 1, duration: 4 },
      { character: 'ranger', charges: 3, duration: 6 },
    ] as const;

    for (const expected of cases) {
      const player = started(expected.character).getState().player;
      assert.deepEqual(dashSnapshot(player), {
        charges: expected.charges,
        maximum: expected.charges,
        rechargeRemaining: 0,
        rechargeDuration: expected.duration,
        reuseDelay: 0,
        cooldown: 0,
      });
    }
  });

  test('재시작은 사용 중인 충전과 레벨 확장을 캐릭터 기본값으로 되돌린다 (unit fixture)', () => {
    for (const character of ['knight', 'mage', 'ranger'] as const) {
      const game = started(character);
      const state = mutableStateFixture(game);
      game.step(0.01, DASH);
      state.player.level = 8;
      Object.assign(state.player, configureDash(state.player, character, 8, 3));
      assert.notDeepEqual(dashSnapshot(state.player), dashSnapshot({
        ...state.player,
        ...initialDashState(character),
      }));

      game.dispatch({ type: 'restart' });

      assert.deepEqual(dashSnapshot(game.getState().player), dashSnapshot({
        ...game.getState().player,
        ...initialDashState(character),
      }));
      assert.equal(game.getState().player.level, 1);
    }
  });
});

describe('사용 간격과 순차 한 칸 충전', () => {
  test('한 입력 프레임은 한 칸만 쓰고 0.85초 전 연타를 거부하며 추가 사용은 충전 진행을 초기화하지 않는다', () => {
    const game = started('knight');

    game.step(0.05, DASH);
    assert.equal(game.getState().player.dashCharges, 1);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 1);
    close(game.getState().player.dashCooldown, game.getState().player.dashReuseDelay);

    game.step(0.05, DASH);
    assert.equal(game.getState().player.dashCharges, 1, '같은 키를 빠르게 다시 눌러도 남은 충전을 쓰면 안 된다');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 0);

    const beforeBlockedPress = game.getState().player.dashReuseDelay;
    stepFor(game, beforeBlockedPress - 0.02, NO_INPUT, 0.05);
    game.step(0.001, DASH);
    assert.equal(game.getState().player.dashCharges, 1);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 0);

    stepFor(game, 0.03, NO_INPUT, 0.01);
    const rechargeBeforeSecondUse = game.getState().player.dashRechargeRemaining;
    game.step(0.001, DASH);

    assert.equal(game.getState().player.dashCharges, 0);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 1);
    assert.ok(game.getState().player.dashRechargeRemaining < rechargeBeforeSecondUse,
      '두 번째 사용이 이미 진행 중인 첫 충전 타이머를 다시 시작하면 안 된다');
    close(game.getState().player.dashCooldown, game.getState().player.dashRechargeRemaining,
      '충전이 0개면 cooldown은 충전/재사용 간격 중 더 긴 값이어야 한다');
  });

  test('충전이 없으면 입력을 무시하고 같은 tick에서 한 칸이 차는 순간에는 사용할 수 있다 (unit fixture)', () => {
    const game = started('mage');
    const state = mutableStateFixture(game);
    game.step(0.01, DASH);
    game.drainEvents();
    assert.equal(state.player.dashCharges, 0);

    state.player.dashReuseDelay = 0;
    state.player.dashRechargeRemaining = 0.02;
    state.player.dashCooldown = 0.02;
    game.step(0.01, DASH);
    assert.equal(state.player.dashCharges, 0);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 0);

    state.player.dashRechargeRemaining = 0.005;
    state.player.dashCooldown = 0.005;
    game.step(0.01, DASH);
    assert.equal(state.player.dashCharges, 0, '새로 찬 한 칸을 같은 tick의 입력이 즉시 사용해야 한다');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'dash').length, 1);
    close(state.player.dashRechargeRemaining, state.player.dashRechargeDuration);
  });

  test('큰 dt의 남은 시간은 다음 빈 칸으로 이월되고 가득 차면 타이머가 0이 된다', () => {
    const initial = initialDashState('knight');
    const firstUse = consumeDash(initial);
    assert.ok(firstUse);
    const oneSecondLater = advanceDash(firstUse, 1);
    close(oneSecondLater.dashRechargeRemaining, 4);
    assert.equal(oneSecondLater.dashReuseDelay, 0);

    const secondUse = consumeDash(oneSecondLater);
    assert.ok(secondUse);
    close(secondUse.dashRechargeRemaining, 4, '추가 사용이 진행 중인 타이머를 5초로 되돌리면 안 된다');
    assert.equal(secondUse.dashCharges, 0);
    close(secondUse.dashCooldown, 4);

    const carried = advanceDash(secondUse, 4.25);
    assert.equal(carried.dashCharges, 1);
    close(carried.dashRechargeRemaining, 4.75, '첫 칸을 채우고 남은 0.25초를 다음 칸에서 빼야 한다');
    close(carried.dashCooldown, 0, '사용 가능한 충전이 있으면 충전 타이머가 cooldown을 막으면 안 된다');

    const full = advanceDash(carried, 4.75);
    assert.equal(full.dashCharges, 2);
    assert.equal(full.dashRechargeRemaining, 0);
    assert.equal(full.dashCooldown, 0);
  });
});

describe('성장과 정지 phase', () => {
  test('8레벨은 빈 최대 충전 한 칸을 정확히 한 번 추가하고 진행 중인 비율을 보존한다', () => {
    const fullAtSeven = initialDashState('knight');
    const expanded = configureDash(fullAtSeven, 'knight', 8, 0);
    assert.equal(expanded.dashMaxCharges, 3);
    assert.equal(expanded.dashCharges, 2, '새 최대 충전은 즉시 채워지면 안 된다');
    assert.equal(expanded.dashRechargeRemaining, 5);
    assert.equal(configureDash(expanded, 'knight', 9, 0).dashMaxCharges, 3, '9레벨부터 반복 증가하면 안 된다');

    const halfProgress = {
      ...initialDashState('knight'),
      dashCharges: 1,
      dashRechargeRemaining: 2.5,
      dashCooldown: 0,
    };
    const preserved = configureDash(halfProgress, 'knight', 8, 3);
    close(preserved.dashRechargeDuration, 3.8);
    close(preserved.dashRechargeRemaining, 1.9,
      '5초 중 2.5초 남은 50% 진행이 새 3.8초 중 1.9초로 보존되어야 한다');
    assert.equal(preserved.dashCharges, 1);
    assert.equal(preserved.dashMaxCharges, 3);
  });

  test('실제 레벨 8 진입은 최대치만 늘리고 새 칸을 빈 상태로 충전하기 시작한다 (unit fixture)', () => {
    const game = started('knight');
    const state = mutableStateFixture(game);
    state.player.level = 7;
    state.player.xp = state.player.xpToNext;
    assert.equal(state.player.dashCharges, 2);

    game.step(0.001, NO_INPUT);

    assert.equal(state.phase, 'levelup');
    assert.equal(state.player.level, 8);
    assert.equal(state.player.dashMaxCharges, 3);
    assert.equal(state.player.dashCharges, 2);
    close(state.player.dashRechargeRemaining, state.player.dashRechargeDuration);

    const selected = state.upgradeChoices.find(({ id }) => id !== 'speed');
    assert.ok(selected);
    game.dispatch({ type: 'selectUpgrade', id: selected.id });
    state.player.xp = state.player.xpToNext;
    game.step(0.001, NO_INPUT);
    assert.equal(state.player.level, 9);
    assert.equal(state.player.dashMaxCharges, 3);
  });

  test('바람 장화는 최대 24%만 줄이고 최소 3초를 지키며 진행 비율을 보존한다', () => {
    const expectations = [
      { character: 'knight', duration: 3.8 },
      { character: 'mage', duration: 3.04 },
      { character: 'ranger', duration: 4.56 },
    ] as const;

    for (const expected of expectations) {
      const initial = initialDashState(expected.character);
      const running = {
        ...initial,
        dashCharges: 0,
        dashRechargeRemaining: initial.dashRechargeDuration * 0.25,
        dashCooldown: initial.dashRechargeDuration * 0.25,
      };
      const configured = configureDash(running, expected.character, 1, 99);
      close(configured.dashRechargeDuration, expected.duration);
      close(configured.dashRechargeRemaining, expected.duration * 0.25);
      assert.ok(configured.dashRechargeDuration >= 3);
    }
  });

  test('pause와 levelup 동안 충전·사용 간격·cooldown이 모두 동결된다 (unit fixture)', () => {
    const game = started('knight');
    const state = mutableStateFixture(game);
    game.step(0.01, DASH);
    game.drainEvents();

    game.dispatch({ type: 'pause' });
    const paused = snapshot(dashSnapshot(state.player));
    game.step(30, DASH);
    assert.deepEqual(dashSnapshot(state.player), paused);
    assert.deepEqual(game.drainEvents(), []);

    game.dispatch({ type: 'resume' });
    state.player.xp = state.player.xpToNext;
    game.step(0.001, NO_INPUT);
    assert.equal(state.phase, 'levelup');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'levelup').length, 1);
    const selecting = snapshot(dashSnapshot(state.player));
    game.step(30, DASH);
    assert.deepEqual(dashSnapshot(state.player), selecting);
    assert.deepEqual(game.drainEvents(), []);
  });
});
