import type {
  CharacterId,
  EnemyKind,
  GameMode,
  GameOptions,
  GameState,
  GameUI,
  Phase,
  Profile,
  Settings,
  UIHandlers,
  UpgradeDefinition,
} from '../types';
import { CHARACTERS, WEAPONS } from '../game/content';
import { createChallengeControls } from './challenge';
import { createCodex } from './codex';
import './styles.css';

const CATEGORY_NAMES: Record<UpgradeDefinition['category'], string> = {
  weapon: '무기',
  power: '공격',
  defense: '방어',
  utility: '지원',
  synergy: '룬 조합',
};

const BOSS_NAMES: Partial<Record<EnemyKind, string>> = {
  mushroomKing: '버섯 왕',
  golem: '돌 골렘',
};

const formatSeconds = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds + 0.000_001));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const formatCountdown = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds - 0.000_001));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const setText = (element: HTMLElement, value: string | number): void => {
  const next = String(value);
  if (element.textContent !== next) element.textContent = next;
};

const setHidden = (element: HTMLElement, hidden: boolean): void => {
  if (element.hidden !== hidden) element.hidden = hidden;
};

const button = (className: string, label: string, onClick: () => void): HTMLButtonElement => {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
};

const meter = (label: string, className: string): { root: HTMLDivElement; fill: HTMLDivElement; value: HTMLSpanElement } => {
  const root = document.createElement('div');
  root.className = `hud-meter ${className}`;
  const caption = document.createElement('div');
  caption.className = 'hud-meter__caption';
  const name = document.createElement('span');
  name.textContent = label;
  const value = document.createElement('span');
  caption.append(name, value);
  const track = document.createElement('div');
  track.className = 'hud-meter__track';
  track.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('div');
  fill.className = 'hud-meter__fill';
  track.append(fill);
  root.append(caption, track);
  return { root, fill, value };
};

export function createUI(root: HTMLElement, handlers: UIHandlers): GameUI {
  root.classList.add('game-ui');
  root.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'ui-shell';
  root.append(shell);

  // Title screen: intentionally left-weighted so the renderer remains visible on the right.
  const title = document.createElement('section');
  title.className = 'screen title-screen';
  title.setAttribute('aria-labelledby', 'game-title');

  const titlePanel = document.createElement('div');
  titlePanel.className = 'title-panel parchment-panel';
  const eyebrow = document.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = '작은 수호자의 위대한 밤';
  const heading = document.createElement('h1');
  heading.id = 'game-title';
  heading.innerHTML = '<span>리틀 룬</span><strong>가디언즈</strong>';
  const subtitle = document.createElement('p');
  subtitle.className = 'title-subtitle';
  subtitle.textContent = '새벽이 오기 전, 흩어진 룬의 힘을 깨워 마을을 지키세요.';

  const characterPicker = document.createElement('div');
  characterPicker.className = 'character-picker';
  const characterLabel = document.createElement('p');
  characterLabel.className = 'character-picker__label';
  characterLabel.textContent = '수호자 선택';
  const characterOptions = document.createElement('div');
  characterOptions.className = 'character-picker__options';
  characterOptions.setAttribute('role', 'group');
  characterOptions.setAttribute('aria-label', '수호자 선택');
  const characterDescription = document.createElement('p');
  characterDescription.className = 'character-picker__description';
  const characterButtons = new Map<CharacterId, HTMLButtonElement>();
  (Object.keys(CHARACTERS) as CharacterId[]).forEach((id) => {
    const character = CHARACTERS[id];
    const choice = button('character-choice', '', () => selectCharacter(id));
    choice.dataset.testid = `character-${id}`;
    choice.style.setProperty('--character-color', character.color);
    const portrait = document.createElement('span');
    portrait.className = 'character-choice__portrait';
    portrait.setAttribute('aria-hidden', 'true');
    portrait.textContent = character.name.slice(0, 1);
    const copy = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = character.name;
    const role = document.createElement('small');
    role.textContent = character.title;
    copy.append(name, role);
    choice.append(portrait, copy);
    characterButtons.set(id, choice);
    characterOptions.append(choice);
  });
  characterPicker.append(characterLabel, characterOptions, characterDescription);

  const startNormal = button('primary-button', '수호 임무 시작 · 10분', () => start('normal'));
  startNormal.dataset.focus = 'title';
  startNormal.dataset.testid = 'start-normal';
  const startDemo = button('secondary-button', '빠른 시연 · 3분', () => start('demo'));
  startDemo.dataset.testid = 'start-demo';
  const startActions = document.createElement('div');
  startActions.className = 'title-actions';
  startActions.append(startNormal, startDemo);

  const challengeControls = createChallengeControls(handlers.getOptions(), (patch) => startChallenge(patch));

  const openCodexButton = button('text-button codex-open-button', '룬 조합 도감', () => openCodex());
  openCodexButton.dataset.testid = 'open-codex';

  const controls = document.createElement('div');
  controls.className = 'controls-card';
  controls.innerHTML = `
    <p class="controls-card__title">조작법</p>
    <div><kbd>WASD</kbd><span>또는</span><kbd>방향키</kbd><b>이동</b></div>
    <div><kbd>Space</kbd><b>대시</b><kbd>ESC</kbd><b>일시정지</b></div>
    <p>공격은 자동입니다. 제한시간을 버티고 우두머리 2명을 모두 처치하면 승리합니다.</p>
    <p class="controls-card__alternate">게임패드와 터치 조작도 지원됩니다.</p>
  `;

  const titleFoot = document.createElement('p');
  titleFoot.className = 'title-foot';
  titleFoot.textContent = '한 번의 선택이 새로운 룬 조합을 엽니다';
  titlePanel.append(eyebrow, heading, subtitle, characterPicker, startActions, challengeControls, openCodexButton, controls, titleFoot);
  title.append(titlePanel);

  // HUD never captures combat pointer input.
  const hud = document.createElement('section');
  hud.className = 'hud';
  hud.setAttribute('aria-label', '게임 상태');
  const hudTop = document.createElement('div');
  hudTop.className = 'hud-top';
  const vitality = document.createElement('div');
  vitality.className = 'hud-vitality wood-panel';
  const levelBadge = document.createElement('div');
  levelBadge.className = 'level-badge';
  levelBadge.innerHTML = '<small>레벨</small><strong>1</strong>';
  const hpMeter = meter('생명력', 'hp-meter');
  const xpMeter = meter('룬 경험', 'xp-meter');
  const meterStack = document.createElement('div');
  meterStack.className = 'meter-stack';
  meterStack.append(hpMeter.root, xpMeter.root);
  vitality.append(levelBadge, meterStack);

  const timePanel = document.createElement('div');
  timePanel.className = 'time-panel wood-panel';
  const timeLabel = document.createElement('span');
  timeLabel.textContent = '남은 시간';
  const timeValue = document.createElement('strong');
  timeValue.textContent = '10:00';
  const timeHint = document.createElement('small');
  timeHint.textContent = '밤이 끝날 때까지 버티세요';
  const bossProgress = document.createElement('small');
  bossProgress.className = 'boss-progress';
  bossProgress.textContent = '우두머리 0 / 2';
  timePanel.append(timeLabel, timeValue, timeHint, bossProgress);

  const runStats = document.createElement('div');
  runStats.className = 'run-stats wood-panel';
  runStats.innerHTML = '<div><span>처치</span><strong data-stat="kills">0</strong></div><div><span>점수</span><strong data-stat="score">0</strong></div>';
  const killsValue = runStats.querySelector('[data-stat="kills"]') as HTMLElement;
  const scoreValue = runStats.querySelector('[data-stat="score"]') as HTMLElement;
  hudTop.append(vitality, timePanel, runStats);

  const hudBottom = document.createElement('div');
  hudBottom.className = 'hud-bottom';
  const weaponBar = document.createElement('div');
  weaponBar.className = 'weapon-bar';
  weaponBar.setAttribute('aria-label', '보유 무기');
  const dash = document.createElement('div');
  dash.className = 'dash-indicator';
  dash.dataset.testid = 'dash-status';
  const dashKey = document.createElement('span');
  dashKey.className = 'dash-indicator__key';
  dashKey.textContent = 'Space';
  const dashInfo = document.createElement('div');
  dashInfo.className = 'dash-indicator__info';
  const dashHeading = document.createElement('div');
  dashHeading.className = 'dash-indicator__heading';
  const dashName = document.createElement('b');
  dashName.textContent = '대시';
  const dashCharges = document.createElement('strong');
  dashCharges.dataset.testid = 'dash-charges';
  dashCharges.textContent = '0 / 0';
  dashHeading.append(dashName, dashCharges);
  const dashSlots = document.createElement('div');
  dashSlots.className = 'dash-indicator__slots';
  dashSlots.setAttribute('aria-hidden', 'true');
  const dashRecharge = document.createElement('div');
  dashRecharge.className = 'dash-indicator__recharge';
  dashRecharge.dataset.testid = 'dash-recharge';
  dashRecharge.setAttribute('role', 'progressbar');
  dashRecharge.setAttribute('aria-label', '다음 대시 충전');
  dashRecharge.setAttribute('aria-valuemin', '0');
  dashRecharge.setAttribute('aria-valuemax', '100');
  const dashRechargeFill = document.createElement('span');
  dashRecharge.append(dashRechargeFill);
  const dashState = document.createElement('small');
  dashState.className = 'dash-indicator__state';
  dashState.textContent = '모두 충전';
  const dashReuse = document.createElement('small');
  dashReuse.className = 'dash-indicator__reuse';
  dashInfo.append(dashHeading, dashSlots, dashRecharge, dashState, dashReuse);
  dash.append(dashKey, dashInfo);
  hudBottom.append(weaponBar, dash);
  hud.append(hudTop, hudBottom);

  const pause = document.createElement('section');
  pause.className = 'screen modal-screen pause-screen';
  pause.setAttribute('role', 'dialog');
  pause.setAttribute('aria-modal', 'true');
  pause.setAttribute('aria-labelledby', 'pause-title');
  const pausePanel = document.createElement('div');
  pausePanel.className = 'modal-panel parchment-panel';
  pausePanel.innerHTML = '<p class="rune-mark" aria-hidden="true"></p><p class="eyebrow">모험 기록을 펼쳤습니다</p><h2 id="pause-title">잠시 쉬어가기</h2>';
  const resume = button('primary-button', '계속하기', () => handlers.command({ type: 'resume' }));
  resume.dataset.focus = 'paused';
  const settingsGroup = document.createElement('div');
  settingsGroup.className = 'settings-group';
  settingsGroup.setAttribute('aria-label', '설정');
  const mute = button('setting-button', '', () => toggleSetting('muted'));
  const motion = button('setting-button', '', () => toggleSetting('reducedMotion'));
  settingsGroup.append(mute, motion);
  const pauseHelp = document.createElement('div');
  pauseHelp.className = 'pause-help';
  pauseHelp.innerHTML = '<b>조작법</b><p><kbd>WASD</kbd> / <kbd>방향키</kbd> 이동 · <kbd>Space</kbd> 대시</p><p>공격은 자동 · <kbd>ESC</kbd> 계속하기</p>';
  const toTitleFromPause = button('text-button', '임무 포기하고 첫 화면으로', () => handlers.command({ type: 'returnTitle' }));
  toTitleFromPause.dataset.testid = 'return-title-pause';
  pausePanel.append(resume, settingsGroup, pauseHelp, toTitleFromPause);
  pause.append(pausePanel);

  const levelup = document.createElement('section');
  levelup.className = 'screen modal-screen levelup-screen';
  levelup.setAttribute('role', 'dialog');
  levelup.setAttribute('aria-modal', 'true');
  levelup.setAttribute('aria-labelledby', 'levelup-title');
  const levelupPanel = document.createElement('div');
  levelupPanel.className = 'levelup-panel';
  levelupPanel.innerHTML = '<p class="eyebrow">새로운 힘이 깨어납니다</p><h2 id="levelup-title">룬 축복 선택</h2><p class="levelup-help"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> 키로도 선택할 수 있습니다</p>';
  const levelMilestone = document.createElement('p');
  levelMilestone.className = 'levelup-milestone';
  levelMilestone.textContent = '레벨 8 보너스 · 대시 최대 충전 +1';
  levelMilestone.hidden = true;
  const upgradeCards = document.createElement('div');
  upgradeCards.className = 'upgrade-cards';
  levelupPanel.append(levelMilestone, upgradeCards);
  levelup.append(levelupPanel);

  const result = document.createElement('section');
  result.className = 'screen modal-screen result-screen';
  result.setAttribute('role', 'dialog');
  result.setAttribute('aria-modal', 'true');
  result.setAttribute('aria-labelledby', 'result-title');
  const resultPanel = document.createElement('div');
  resultPanel.className = 'modal-panel result-panel parchment-panel';
  const resultRune = document.createElement('p');
  resultRune.className = 'result-rune';
  resultRune.setAttribute('aria-hidden', 'true');
  const resultEyebrow = document.createElement('p');
  resultEyebrow.className = 'eyebrow';
  const resultTitle = document.createElement('h2');
  resultTitle.id = 'result-title';
  const resultMessage = document.createElement('p');
  resultMessage.className = 'result-message';
  const resultSeed = document.createElement('p');
  resultSeed.className = 'result-seed';
  const resultStats = document.createElement('div');
  resultStats.className = 'result-stats';
  const retry = button('primary-button', '다시 도전', () => handlers.command({ type: 'restart' }));
  retry.dataset.focus = 'result';
  retry.dataset.testid = 'restart';
  const toTitle = button('secondary-button', '첫 화면으로', () => handlers.command({ type: 'returnTitle' }));
  toTitle.dataset.testid = 'return-title';
  const resultActions = document.createElement('div');
  resultActions.className = 'result-actions';
  resultActions.append(retry, toTitle);
  resultPanel.append(resultRune, resultEyebrow, resultTitle, resultMessage, resultSeed, resultStats, resultActions);
  result.append(resultPanel);

  let codexOpen = false;
  const codexScreen = document.createElement('section');
  codexScreen.className = 'screen modal-screen codex-screen';
  codexScreen.hidden = true;
  codexScreen.append(createCodex(closeCodex));

  const announcement = document.createElement('div');
  announcement.className = 'sr-only';
  announcement.setAttribute('aria-live', 'polite');
  shell.append(title, hud, pause, levelup, result, codexScreen, announcement);

  let currentProfile: Profile | undefined;
  let lastPhase: Phase | undefined;
  let lastChoiceSignature = '';

  function selectCharacter(character: CharacterId): void {
    handlers.setOptions({ character });
    renderCharacterSelection(character);
  }

  function renderCharacterSelection(selected: CharacterId): void {
    characterButtons.forEach((choice, id) => {
      const active = id === selected;
      choice.classList.toggle('character-choice--selected', active);
      choice.setAttribute('aria-pressed', String(active));
    });
    const character = CHARACTERS[selected];
    characterDescription.textContent = `${character.description} 시작 무기: ${WEAPONS[character.weapon].name}`;
  }

  function start(mode: GameMode): void {
    const options = { ...handlers.getOptions(), mode };
    handlers.setOptions({ mode });
    handlers.command({ type: 'start', options });
  }

  function startChallenge(patch: Partial<GameOptions>): void {
    const options = { ...handlers.getOptions(), ...patch, mode: 'challenge' as const };
    handlers.setOptions(options);
    handlers.command({ type: 'start', options });
  }

  function openCodex(): void {
    codexOpen = true;
    codexScreen.hidden = false;
    title.hidden = true;
    title.setAttribute('aria-hidden', 'true');
    requestAnimationFrame(() => codexScreen.querySelector<HTMLElement>('button, [href], [tabindex="0"]')?.focus({ preventScroll: true }));
  }

  function closeCodex(): void {
    codexOpen = false;
    codexScreen.hidden = true;
    title.hidden = false;
    title.removeAttribute('aria-hidden');
    openCodexButton.focus({ preventScroll: true });
  }

  renderCharacterSelection(handlers.getOptions().character);

  function toggleSetting(key: keyof Settings): void {
    if (!currentProfile) return;
    handlers.settings({ [key]: !currentProfile.settings[key] });
  }

  function renderSettings(profile: Profile): void {
    const muted = profile.settings.muted;
    mute.textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    mute.setAttribute('aria-pressed', String(muted));
    mute.dataset.state = muted ? 'off' : 'on';
    const reduced = profile.settings.reducedMotion;
    motion.textContent = reduced ? '화면 흔들림 줄임' : '화면 흔들림 켬';
    motion.setAttribute('aria-pressed', String(reduced));
    motion.dataset.state = reduced ? 'off' : 'on';
  }

  function renderWeapons(state: Readonly<GameState>): void {
    const signature = state.weapons.map((weapon) => `${weapon.id}:${weapon.level}`).join('|');
    if (weaponBar.dataset.signature === signature) return;
    weaponBar.dataset.signature = signature;
    weaponBar.replaceChildren();
    state.weapons.forEach((weapon) => {
      const chip = document.createElement('div');
      chip.className = 'weapon-chip';
      chip.innerHTML = '<span aria-hidden="true"></span><div><b></b><small></small></div>';
      (chip.querySelector('span') as HTMLElement).textContent = WEAPONS[weapon.id].name.slice(0, 1);
      (chip.querySelector('b') as HTMLElement).textContent = WEAPONS[weapon.id].name;
      (chip.querySelector('small') as HTMLElement).textContent = `Lv.${weapon.level}`;
      weaponBar.append(chip);
    });
  }

  function renderUpgradeChoices(state: Readonly<GameState>): void {
    const choices = state.upgradeChoices;
    const signature = `${state.player.level}|${choices.map((choice) => choice.id).join('|')}`;
    if (signature === lastChoiceSignature) return;
    lastChoiceSignature = signature;
    upgradeCards.replaceChildren();
    choices.slice(0, 3).forEach((choice, index) => {
      const card = button('upgrade-card', '', () => handlers.command({ type: 'selectUpgrade', id: choice.id }));
      card.dataset.focus = index === 0 ? 'levelup' : '';
      const key = document.createElement('span');
      key.className = 'upgrade-card__key';
      key.textContent = String(index + 1);
      const icon = document.createElement('span');
      icon.className = 'upgrade-card__icon';
      icon.textContent = choice.name.slice(0, 1);
      icon.setAttribute('aria-hidden', 'true');
      const category = document.createElement('span');
      category.className = 'upgrade-card__category';
      category.textContent = CATEGORY_NAMES[choice.category];
      const name = document.createElement('strong');
      name.textContent = choice.name;
      const description = document.createElement('span');
      description.className = 'upgrade-card__description';
      description.textContent = choice.description;
      const current = document.createElement('span');
      current.className = 'upgrade-card__level';
      const ownedLevel = choice.weapon
        ? state.weapons.find((weapon) => weapon.id === choice.weapon)?.level ?? 0
        : state.player.upgrades[choice.id] ?? 0;
      current.textContent = ownedLevel > 0 ? `현재 Lv.${ownedLevel}` : `최대 Lv.${choice.maxLevel}`;
      card.append(key, icon, category, name, description, current);
      upgradeCards.append(card);
    });
  }

  function renderResult(state: Readonly<GameState>, profile: Profile): void {
    const won = state.phase === 'victory';
    result.classList.toggle('result-screen--victory', won);
    result.classList.toggle('result-screen--defeat', !won);
    setText(resultEyebrow, won ? '마을에 새벽이 밝았습니다' : '룬 불빛이 희미해졌습니다');
    setText(resultTitle, won ? '임무 성공' : '다시 일어설 시간');
    setText(resultMessage, state.message || (won ? '작은 수호자가 긴 밤을 지켜냈습니다.' : '다음 도전에는 더 강한 룬이 함께할 거예요.'));
    resultSeed.hidden = state.mode !== 'challenge';
    setText(resultSeed, state.mode === 'challenge' ? `도전 시드 ${state.seed}` : '');
    resultStats.replaceChildren();
    const recordLabel = state.mode === 'demo' ? '시연 최고' : '일반 최고';
    const recordScore = state.mode === 'demo' ? profile.demoRecord?.bestScore ?? 0 : profile.bestScore;
    const stats: Array<[string, string]> = [
      ['생존 시간', formatSeconds(state.elapsed)],
      ['처치한 적', state.stats.kills.toLocaleString('ko-KR')],
      ['최종 점수', state.stats.score.toLocaleString('ko-KR')],
      [recordLabel, recordScore.toLocaleString('ko-KR')],
    ];
    stats.forEach(([label, value]) => {
      const item = document.createElement('div');
      const name = document.createElement('span');
      const number = document.createElement('strong');
      name.textContent = label;
      number.textContent = value;
      item.append(name, number);
      resultStats.append(item);
    });
  }

  function focusPhase(phase: Phase): void {
    const key = phase === 'victory' || phase === 'defeat' ? 'result' : phase;
    const target = shell.querySelector<HTMLElement>(`[data-focus="${key}"]`);
    requestAnimationFrame(() => target?.focus({ preventScroll: true }));
  }

  function trapModalFocus(event: KeyboardEvent): void {
    if (event.key === 'Escape' && codexOpen) {
      event.preventDefault();
      closeCodex();
      return;
    }
    if (event.key !== 'Tab') return;
    const modal = !codexScreen.hidden ? codexScreen : !pause.hidden ? pause : !levelup.hidden ? levelup : !result.hidden ? result : undefined;
    if (!modal) return;
    const focusable = [...modal.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  root.addEventListener('keydown', trapModalFocus);

  function render(state: Readonly<GameState>, profile: Profile): void {
    currentProfile = profile;
    root.classList.toggle('reduced-motion', profile.settings.reducedMotion);
    const isResult = state.phase === 'victory' || state.phase === 'defeat';
    if (state.phase !== 'title' && codexOpen) {
      codexOpen = false;
      codexScreen.hidden = true;
      title.removeAttribute('aria-hidden');
    }
    setHidden(title, state.phase !== 'title' || codexOpen);
    setHidden(hud, state.phase === 'title' || isResult);
    setHidden(pause, state.phase !== 'paused');
    setHidden(levelup, state.phase !== 'levelup');
    setHidden(result, !isResult);
    root.dataset.phase = state.phase;

    const hpPercent = state.player.maxHp > 0 ? Math.max(0, Math.min(100, state.player.hp / state.player.maxHp * 100)) : 0;
    const xpPercent = state.player.xpToNext > 0 ? Math.max(0, Math.min(100, state.player.xp / state.player.xpToNext * 100)) : 0;
    hpMeter.fill.style.width = `${hpPercent}%`;
    xpMeter.fill.style.width = `${xpPercent}%`;
    setText(hpMeter.value, `${Math.ceil(Math.max(0, state.player.hp))} / ${Math.ceil(state.player.maxHp)}`);
    setText(xpMeter.value, `${Math.floor(state.player.xp)} / ${Math.ceil(state.player.xpToNext)}`);
    setText(levelBadge.querySelector('strong') as HTMLElement, state.player.level);
    setText(timeValue, formatCountdown(state.duration - state.elapsed));
    const remaining = state.duration - state.elapsed;
    const requiredBosses = state.contentTier === 1 ? 2 : 1;
    const defeatedBosses = Math.min(requiredBosses, state.stats.bossesDefeated);
    const activeBosses = [...new Set(state.enemies.filter((enemy) => enemy.boss).map((enemy) => BOSS_NAMES[enemy.kind] ?? '우두머리'))];
    setText(bossProgress, `우두머리 ${defeatedBosses} / ${requiredBosses}`);
    bossProgress.classList.toggle('boss-progress--complete', defeatedBosses >= requiredBosses);
    const activeBossLabel = activeBosses.join(' · ');
    const timerHint = activeBosses.length > 0
      ? remaining <= 0
        ? `마지막 보스전 · ${activeBossLabel} 처치`
        : `${activeBossLabel}을 물리치세요`
      : state.bossSpawned && defeatedBosses < requiredBosses
        ? '다음 우두머리를 준비하세요'
      : state.mode === 'demo'
        ? `3분 생존 + 우두머리 ${requiredBosses}명`
        : `10분 생존 + 우두머리 ${requiredBosses}명`;
    setText(timeHint, timerHint);
    timePanel.classList.toggle('time-panel--urgent', state.duration - state.elapsed <= 30);
    setText(killsValue, state.stats.kills.toLocaleString('ko-KR'));
    setText(scoreValue, state.stats.score.toLocaleString('ko-KR'));
    const dashMax = Math.max(0, Math.min(4, Math.floor(state.player.dashMaxCharges)));
    const availableDashes = Math.max(0, Math.min(dashMax, Math.floor(state.player.dashCharges)));
    const rechargeDuration = Math.max(0, state.player.dashRechargeDuration);
    const rechargeRemaining = availableDashes >= dashMax ? 0 : Math.max(0, state.player.dashRechargeRemaining);
    const rechargeProgress = availableDashes >= dashMax || rechargeDuration <= 0
      ? 1
      : Math.max(0, Math.min(1, 1 - rechargeRemaining / rechargeDuration));
    setText(dashCharges, `${availableDashes} / ${dashMax}`);
    dashSlots.replaceChildren();
    for (let index = 0; index < dashMax; index++) {
      const slot = document.createElement('span');
      slot.className = 'dash-indicator__slot';
      if (index < availableDashes) slot.classList.add('dash-indicator__slot--filled');
      else if (index === availableDashes) {
        slot.classList.add('dash-indicator__slot--charging');
        slot.style.setProperty('--dash-charge-progress', `${rechargeProgress * 100}%`);
      }
      dashSlots.append(slot);
    }
    dashRechargeFill.style.width = `${rechargeProgress * 100}%`;
    dashRecharge.setAttribute('aria-valuenow', String(Math.round(rechargeProgress * 100)));
    const rechargeText = availableDashes >= dashMax ? '모두 충전' : `다음 충전 ${rechargeRemaining.toFixed(1)}초`;
    dashRecharge.setAttribute('aria-valuetext', rechargeText);
    setText(dashState, rechargeText);
    const cooldown = Math.max(0, state.player.dashCooldown);
    const reuseDelay = Math.max(0, state.player.dashReuseDelay);
    const reuseText = `${(Math.ceil(reuseDelay * 10) / 10).toFixed(1)}초`;
    dashReuse.hidden = reuseDelay <= 0;
    setText(dashReuse, reuseDelay > 0 ? `연속 사용 대기 ${reuseText}` : '');
    dash.classList.toggle('dash-indicator--ready', availableDashes > 0 && cooldown <= 0);
    dash.classList.toggle('dash-indicator--empty', availableDashes === 0);
    dash.setAttribute('aria-label', `대시 ${availableDashes} / ${dashMax}. ${rechargeText}${reuseDelay > 0 ? `. 연속 사용 대기 ${reuseText}` : ''}`);
    renderWeapons(state);
    renderSettings(profile);
    if (state.phase === 'title') renderCharacterSelection(handlers.getOptions().character);
    if (state.phase === 'levelup') {
      levelMilestone.hidden = state.player.level !== 8;
      renderUpgradeChoices(state);
    }
    if (isResult) renderResult(state, profile);

    if (state.phase !== lastPhase) {
      if (state.phase === 'levelup') announcement.textContent = `레벨 ${state.player.level}. 룬 축복을 선택하세요.`;
      else if (state.phase === 'paused') announcement.textContent = '게임이 일시정지되었습니다.';
      else if (isResult) announcement.textContent = state.phase === 'victory' ? '임무에 성공했습니다.' : '임무가 끝났습니다.';
      focusPhase(state.phase);
      lastPhase = state.phase;
    }
  }

  return {
    render,
    dispose(): void {
      root.removeEventListener('keydown', trapModalFocus);
      root.replaceChildren();
      root.classList.remove('game-ui', 'reduced-motion');
      delete root.dataset.phase;
    },
  };
}
