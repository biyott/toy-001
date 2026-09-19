import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { CHARACTERS, UPGRADES, WEAPONS } from '../src/game/content.ts';
import { createGame } from '../src/game/engine.ts';
import type { CharacterId, EnemyKind, GameController, GameMode, GameOptions, UpgradeDefinition } from '../src/types.ts';
import { mutableStateFixture, NO_INPUT } from './fixtures.ts';

const SEED = 0x5031_c07e;

function started(character: CharacterId = 'knight', mode: GameMode = 'normal', contentTier: 0 | 1 = 1): GameController {
  const options: GameOptions = { mode, seed: SEED, character, contentTier };
  const game = createGame(options);
  game.dispatch({ type: 'start', options });
  assert.equal(game.getState().phase, 'playing');
  return game;
}

/** Unit-fixture setup only; this does not replace a normal browser playthrough. */
function offerUpgrade(game: GameController, id: string): UpgradeDefinition {
  const definition = UPGRADES.find(upgrade => upgrade.id === id);
  assert.ok(definition, `missing upgrade metadata: ${id}`);
  const state = mutableStateFixture(game);
  state.phase = 'levelup';
  state.upgradeChoices = [definition];
  game.dispatch({ type: 'selectUpgrade', id });
  assert.equal(game.getState().phase, 'playing');
  return definition;
}

function crossBossSchedule(game: GameController, at: number, kind: Extract<EnemyKind, 'mushroomKing' | 'golem'>): void {
  const state = mutableStateFixture(game);
  state.player.invulnerable = 1_000;
  state.elapsed = at - 0.051;
  game.step(0.05, NO_INPUT);
  assert.equal(state.enemies.some(enemy => enemy.kind === kind), false, `${kind}가 ${at}초 전에 등장하면 안 된다`);

  game.step(0.002, NO_INPUT);
  assert.equal(state.enemies.filter(enemy => enemy.kind === kind).length, 1, `${kind}가 ${at}초에 한 번 등장해야 한다`);
  assert.equal(
    game.drainEvents().filter(event => event.type === 'boss' && event.kind === kind && event.text !== 'defeated').length,
    1,
  );
}

describe('P1 콘텐츠 메타데이터 계약', () => {
  test('무기 6종, 업그레이드 16종, 캐릭터 3종과 참조를 정확히 제공한다', () => {
    assert.deepEqual(new Set(Object.keys(WEAPONS)), new Set(['sword', 'arrow', 'spirit', 'lightning', 'frost', 'fireball']));
    assert.deepEqual(new Set(Object.keys(CHARACTERS)), new Set(['knight', 'mage', 'ranger']));
    assert.deepEqual(
      new Set(UPGRADES.map(({ id }) => id)),
      new Set([
        'sword', 'arrow', 'spirit', 'power', 'haste', 'vitality', 'speed', 'magnet',
        'pierce', 'split', 'chain', 'regen', 'lightning', 'frost', 'fireball', 'armor',
      ]),
    );
    assert.equal(Object.keys(WEAPONS).length, 6);
    assert.equal(UPGRADES.length, 16);
    assert.equal(Object.keys(CHARACTERS).length, 3);
    assert.equal(new Set(UPGRADES.map(({ id }) => id)).size, UPGRADES.length);

    const weaponUpgradeIds = new Set(UPGRADES.filter(({ category }) => category === 'weapon').map(({ weapon }) => weapon));
    assert.deepEqual(weaponUpgradeIds, new Set(Object.keys(WEAPONS)));
    for (const character of Object.values(CHARACTERS)) assert.ok(WEAPONS[character.weapon]);
  });

  test('P1 추가 메타데이터는 무기 3종과 방어 업그레이드 1종이다', () => {
    assert.deepEqual(
      UPGRADES.filter(({ tier }) => tier === 1).map(({ id, category, maxLevel, weapon }) => ({ id, category, maxLevel, weapon })),
      [
        { id: 'lightning', category: 'weapon', maxLevel: 5, weapon: 'lightning' },
        { id: 'frost', category: 'weapon', maxLevel: 5, weapon: 'frost' },
        { id: 'fireball', category: 'weapon', maxLevel: 5, weapon: 'fireball' },
        { id: 'armor', category: 'defense', maxLevel: 3, weapon: undefined },
      ],
    );
  });
});

describe('콘텐츠 tier와 캐릭터 선택', () => {
  test('tier 0은 전달된 확장 캐릭터를 무시하고 기존 기사 시작 상태를 유지한다 (unit fixture)', () => {
    for (const requested of ['mage', 'ranger'] as const) {
      const game = started(requested, 'normal', 0);
      const state = mutableStateFixture(game);
      assert.equal(state.contentTier, 0);
      assert.equal(state.player.character, 'knight');
      assert.deepEqual(state.weapons.map(({ id, level }) => ({ id, level })), [{ id: 'sword', level: 1 }]);
      assert.deepEqual(state.player.upgrades, { sword: 1 });
      assert.equal(state.player.hp, 120);
      assert.equal(state.player.maxHp, 120);
      assert.equal(state.player.speed, 170);

      state.player.xp = state.player.xpToNext;
      game.step(0.001, NO_INPUT);
      assert.equal(state.phase, 'levelup');
      assert.ok(state.upgradeChoices.every(({ tier }) => tier === 0));
    }
  });

  test('tier 1의 세 캐릭터는 고유 시작 무기, 체력, 속도를 실제 초기 상태에 반영한다', () => {
    const expected = {
      knight: { weapon: 'sword', hp: 120, speed: 170 },
      mage: { weapon: 'spirit', hp: 100, speed: 170 },
      ranger: { weapon: 'arrow', hp: 100, speed: 190 },
    } as const;

    for (const character of Object.keys(expected) as CharacterId[]) {
      const state = started(character).getState();
      const contract = expected[character];
      assert.equal(state.player.character, character);
      assert.equal(state.player.hp, contract.hp);
      assert.equal(state.player.maxHp, contract.hp);
      assert.equal(state.player.speed, contract.speed);
      assert.deepEqual(state.weapons.map(({ id, level }) => ({ id, level })), [{ id: contract.weapon, level: 1 }]);
      assert.equal(state.player.upgrades[contract.weapon], 1);
    }
  });

  test('마법사의 12% 공격력 보정은 시작 정령의 실제 피해 수치에 반영된다 (unit fixture)', () => {
    const game = started('mage');
    game.step(0.01, NO_INPUT);

    const spirits = game.getState().projectiles.filter(({ owner, weapon }) => owner === 'player' && weapon === 'spirit');
    assert.equal(spirits.length, 2);
    for (const spirit of spirits) assert.ok(Math.abs(spirit.damage - 17 * 1.12) < 1e-12);
  });
});

describe('P1 업그레이드의 실제 상태 반영', () => {
  test('추가 무기 3종은 카드 선택으로 획득되고 재선택으로 같은 무기 레벨이 오른다 (unit fixture)', () => {
    for (const id of ['lightning', 'frost', 'fireball'] as const) {
      const game = started('knight');
      offerUpgrade(game, id);
      assert.equal(game.getState().player.upgrades[id], 1);
      assert.deepEqual(game.getState().weapons.filter(weapon => weapon.id === id).map(({ level }) => level), [1]);

      offerUpgrade(game, id);
      assert.equal(game.getState().player.upgrades[id], 2);
      assert.deepEqual(game.getState().weapons.filter(weapon => weapon.id === id).map(({ level }) => level), [2]);
    }
  });

  test('방어 업그레이드 1단계는 실제 받은 피해와 통계를 정확히 12% 줄인다 (unit fixture)', () => {
    const game = started('knight');
    offerUpgrade(game, 'armor');
    const state = mutableStateFixture(game);
    state.player.invulnerable = 0;
    state.zones.push({
      id: 9_300_001, x: state.player.x, y: state.player.y, shape: 'circle', radius: 30,
      angle: 0, telegraph: 0, duration: 0.2, damage: 25, owner: 'enemy', kind: 'p1-armor-fixture', hitIds: [],
    });

    game.step(0.001, NO_INPUT);

    assert.equal(state.player.upgrades.armor, 1);
    assert.equal(state.player.hp, 120 - 25 * 0.88);
    assert.equal(state.stats.damageTaken, 25 * 0.88);
  });
});

describe('두 보스 일정과 승리 경계', () => {
  test('두 보스는 normal 480/540초, demo 120/150초 경계를 넘을 때 각각 한 번 등장한다 (unit fixture)', () => {
    for (const schedule of [
      { mode: 'normal' as const, mushroomKing: 480, golem: 540 },
      { mode: 'demo' as const, mushroomKing: 120, golem: 150 },
    ]) {
      const game = started('knight', schedule.mode);
      crossBossSchedule(game, schedule.mushroomKing, 'mushroomKing');
      crossBossSchedule(game, schedule.golem, 'golem');
      assert.equal(game.getState().enemies.filter(({ boss }) => boss).length, 2);
    }
  });

  test('P1 승리는 서로 다른 두 보스 처치와 제한시간을 모두 요구한다 (unit fixture)', () => {
    const game = started('knight', 'demo');
    crossBossSchedule(game, 120, 'mushroomKing');
    crossBossSchedule(game, 150, 'golem');
    const state = mutableStateFixture(game);
    state.elapsed = 160;
    const mushroomKing = state.enemies.find(({ kind }) => kind === 'mushroomKing');
    const golem = state.enemies.find(({ kind }) => kind === 'golem');
    assert.ok(mushroomKing && golem);

    mushroomKing.hp = 0;
    game.step(0.001, NO_INPUT);
    assert.equal(state.stats.bossesDefeated, 1);
    assert.equal(state.bossDefeated, false, '첫 보스 하나만으로 P1 보스 조건을 충족하면 안 된다');
    assert.equal(state.phase, 'playing');

    golem.hp = 0;
    game.step(0.001, NO_INPUT);
    assert.equal(state.stats.bossesDefeated, 2);
    assert.equal(state.bossDefeated, true);
    assert.equal(state.phase, 'playing', '두 보스를 일찍 처치해도 제한시간 전에는 승리하면 안 된다');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'victory').length, 0);

    state.elapsed = state.duration - 0.001;
    game.step(0.002, NO_INPUT);
    assert.equal(state.phase, 'victory');
    assert.equal(game.drainEvents().filter(({ type }) => type === 'victory').length, 1);
  });
});
