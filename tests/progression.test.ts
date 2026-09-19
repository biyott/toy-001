import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { UPGRADES } from '../src/game/content.ts';
import { createGame } from '../src/game/engine.ts';
import type { GameController, GameOptions, GameState, UpgradeDefinition } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT, snapshot } from './fixtures.ts';

const OPTIONS: GameOptions = { mode: 'normal', seed: 0x47524f57, character: 'knight', contentTier: 0 };
let fixtureId = 9_100_000;

function started(options: GameOptions = OPTIONS): GameController {
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

/** Unit-fixture setup only. This is not evidence for a normal browser playthrough. */
function grantXpAtPlayer(game: GameController, value: number): void {
  const state = mutableStateFixture(game);
  state.pickups.push({
    id: fixtureId++, kind: 'xp', value, life: 10,
    x: state.player.x, y: state.player.y, radius: 12, facing: 0,
  });
  game.step(0.001, NO_INPUT);
}

function publishedUpgrades(state: GameState): UpgradeDefinition[] {
  return UPGRADES.filter(({ tier }) => tier <= state.contentTier);
}

/** Unit-fixture setup only. It isolates eligibility boundaries from combat RNG. */
function setPublishedUpgradesToMax(state: GameState): void {
  for (const upgrade of publishedUpgrades(state)) state.player.upgrades[upgrade.id] = upgrade.maxLevel;
}

describe('XP 누적과 성장 선택 경계', () => {
  test('한 번에 얻은 초과 XP는 선택을 사이에 두고 여러 레벨을 빠짐없이 처리한다 (unit fixture)', () => {
    const game = started();
    grantXpAtPlayer(game, 100);

    assert.equal(game.getState().phase, 'levelup');
    assert.equal(game.getState().player.level, 2);
    assert.equal(game.getState().player.xp, 94);
    const frozenElapsed = game.getState().elapsed;
    let selections = 0;

    while (game.getState().phase === 'levelup') {
      const choice = game.getState().upgradeChoices[0];
      assert.ok(choice, '각 누적 레벨마다 선택할 카드가 있어야 한다');
      game.dispatch({ type: 'selectUpgrade', id: choice.id });
      selections += 1;
      assert.equal(game.getState().elapsed, frozenElapsed, '연속 성장 선택 사이에 전투 시간이 흐르면 안 된다');
      assert.ok(selections < 10, '누적 레벨 처리가 끝나야 한다');
    }

    assert.equal(selections, 4);
    assert.equal(game.getState().player.level, 5);
    assert.equal(game.getState().player.xp, 27);
    assert.equal(game.getState().player.xpToNext, 31);
  });

  test('선택 화면은 완전히 동결되고 유효하지 않거나 이미 소비한 선택은 무시한다 (unit fixture)', () => {
    const game = started();
    grantXpAtPlayer(game, game.getState().player.xpToNext);
    game.drainEvents();
    const selecting = snapshot(game.getState());

    game.step(30, { moveX: 1, moveY: 1, dashPressed: true, pausePressed: false });
    assert.deepEqual(game.getState(), selecting);
    assert.deepEqual(game.drainEvents(), []);

    game.dispatch({ type: 'selectUpgrade', id: 'not-an-offered-upgrade' });
    assert.deepEqual(game.getState(), selecting, '목록에 없는 id가 선택 상태를 바꾸면 안 된다');
    assert.deepEqual(game.drainEvents(), []);

    const selected = selecting.upgradeChoices[0]!;
    game.dispatch({ type: 'selectUpgrade', id: selected.id });
    assert.equal(game.getState().phase, 'playing');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'upgrade').length, 1);
    const consumed = snapshot(game.getState());

    game.dispatch({ type: 'selectUpgrade', id: selected.id });
    assert.deepEqual(game.getState(), consumed, '같은 카드를 다시 보내도 두 번 적용되면 안 된다');
    assert.deepEqual(game.drainEvents(), []);
  });

  test('레벨업의 7 회복은 최대 체력을 넘지 않는다 (unit fixture)', () => {
    const game = started();
    const state = mutableStateFixture(game);
    state.player.hp = state.player.maxHp - 2;

    grantXpAtPlayer(game, state.player.xpToNext);

    assert.equal(game.getState().phase, 'levelup');
    assert.equal(game.getState().player.hp, game.getState().player.maxHp);
    assert.equal(game.drainEvents().filter(({ type }) => type === 'levelup').length, 1);
  });
});

describe('업그레이드 최대 레벨과 수치 효과', () => {
  test('업그레이드별 최대 레벨 계약을 고정한다', () => {
    assert.deepEqual(
      Object.fromEntries(UPGRADES.map(({ id, maxLevel }) => [id, maxLevel])),
      {
        sword: 5, arrow: 5, spirit: 5,
        power: 5, haste: 4, vitality: 4, speed: 3, magnet: 3,
        pierce: 2, split: 2, chain: 3, regen: 3,
        lightning: 5, frost: 5, fireball: 5, armor: 3,
      },
    );
  });

  test('각 공개 업그레이드는 마지막 단계가 정확히 한 번 적용된 뒤 선택지에서 빠진다 (unit fixture)', () => {
    for (const definition of UPGRADES) {
      const game = started({ ...OPTIONS, contentTier: 1 });
      const state = mutableStateFixture(game);
      setPublishedUpgradesToMax(state);
      state.player.upgrades[definition.id] = definition.maxLevel - 1;

      if (definition.weapon) {
        const weapon = state.weapons.find(({ id }) => id === definition.weapon);
        if (weapon) weapon.level = definition.maxLevel - 1;
        else state.weapons.push({ id: definition.weapon, level: definition.maxLevel - 1, cooldown: 0.1, angle: 0 });
      }

      grantXpAtPlayer(game, state.player.xpToNext);
      const choice = game.getState().upgradeChoices.find(({ id }) => id === definition.id);
      assert.ok(choice, `${definition.id}의 마지막 단계가 선택 가능해야 한다`);
      const before = snapshot(game.getState().player);

      game.dispatch({ type: 'selectUpgrade', id: definition.id });
      const after = game.getState().player;
      assert.equal(after.upgrades[definition.id], definition.maxLevel, `${definition.id} 최대 레벨`);
      if (definition.weapon) {
        assert.equal(game.getState().weapons.find(({ id }) => id === definition.weapon)?.level, definition.maxLevel);
      } else if (definition.id === 'vitality') {
        assert.equal(after.maxHp, before.maxHp + 25);
        assert.equal(after.hp, Math.min(before.maxHp + 25, before.hp + 40));
      } else if (definition.id === 'speed') {
        assert.equal(after.speed, 170 * (1 + 0.1 * definition.maxLevel));
      }

      grantXpAtPlayer(game, game.getState().player.xpToNext);
      assert.equal(
        game.getState().upgradeChoices.some(({ id }) => id === definition.id),
        false,
        `${definition.id}는 최대 레벨 뒤 다시 제시되면 안 된다`,
      );
    }
  });

  test('모든 공개 업그레이드가 최대면 서로 다른 반복 보상 3개만 제시하고 각각 명시 수치를 적용한다 (unit fixture)', () => {
    const cases = [
      { id: 'restoration', hp: 20, hpDelta: 45, maxHpDelta: 0, powerDelta: 0 },
      { id: 'resolve', hp: 20, hpDelta: 0, maxHpDelta: 0, powerDelta: 1 },
      { id: 'heartwood', hp: 20, hpDelta: 10, maxHpDelta: 10, powerDelta: 0 },
    ] as const;

    for (const expected of cases) {
      const game = started();
      const state = mutableStateFixture(game);
      setPublishedUpgradesToMax(state);
      state.player.hp = expected.hp;
      const powerBefore = state.player.upgrades.power ?? 0;
      const maxHpBefore = state.player.maxHp;

      grantXpAtPlayer(game, state.player.xpToNext);
      const choices = game.getState().upgradeChoices.map(({ id }) => id);
      assert.deepEqual(choices, ['restoration', 'resolve', 'heartwood']);
      assert.equal(new Set(choices).size, 3);
      const hpBeforeSelection = game.getState().player.hp;

      game.dispatch({ type: 'selectUpgrade', id: expected.id });
      const player = game.getState().player;
      assert.equal(player.upgrades[expected.id], 1);
      assert.equal(player.maxHp, maxHpBefore + expected.maxHpDelta);
      assert.equal(player.hp, Math.min(player.maxHp, hpBeforeSelection + expected.hpDelta));
      assert.equal(player.upgrades.power, powerBefore + expected.powerDelta);
    }
  });
});
