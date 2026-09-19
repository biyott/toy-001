import type {
  GameMode,
  GameState,
  GameUI,
  Phase,
  Profile,
  Settings,
  UIHandlers,
  UpgradeDefinition,
} from '../types';
import { CHARACTERS, WEAPONS } from '../game/content';
import './styles.css';

const CATEGORY_NAMES: Record<UpgradeDefinition['category'], string> = {
  weapon: '무기',
  power: '공격',
  defense: '방어',
  utility: '지원',
  synergy: '룬 조합',
};

const formatTime = (seconds: number): string => {
  const safe = Math.max(0, Math.ceil(seconds));
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

  const heroCard = document.createElement('div');
  heroCard.className = 'hero-card';
  const crest = document.createElement('div');
  crest.className = 'hero-crest';
  crest.setAttribute('aria-hidden', 'true');
  const heroCopy = document.createElement('div');
  const heroName = document.createElement('b');
  heroName.textContent = `${CHARACTERS.knight.name} · ${CHARACTERS.knight.title}`;
  const heroDescription = document.createElement('span');
  heroDescription.textContent = CHARACTERS.knight.description;
  heroCopy.append(heroName, heroDescription);
  heroCard.append(crest, heroCopy);

  const startNormal = button('primary-button', '수호 임무 시작 · 10분', () => start('normal'));
  startNormal.dataset.focus = 'title';
  startNormal.dataset.testid = 'start-normal';
  const startDemo = button('secondary-button', '빠른 시연 · 3분', () => start('demo'));
  startDemo.dataset.testid = 'start-demo';
  const startActions = document.createElement('div');
  startActions.className = 'title-actions';
  startActions.append(startNormal, startDemo);

  const controls = document.createElement('div');
  controls.className = 'controls-card';
  controls.innerHTML = `
    <p class="controls-card__title">조작법</p>
    <div><kbd>WASD</kbd><span>또는</span><kbd>방향키</kbd><b>이동</b></div>
    <div><kbd>Space</kbd><b>대시</b><kbd>ESC</kbd><b>일시정지</b></div>
    <p>공격은 가장 가까운 적에게 자동으로 발동됩니다.</p>
  `;

  const titleFoot = document.createElement('p');
  titleFoot.className = 'title-foot';
  titleFoot.textContent = '한 번의 선택이 새로운 룬 조합을 엽니다';
  titlePanel.append(eyebrow, heading, subtitle, heroCard, startActions, controls, titleFoot);
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
  timePanel.innerHTML = '<span>남은 시간</span><strong>10:00</strong><small>밤이 끝날 때까지 버티세요</small>';
  const timeValue = timePanel.querySelector('strong') as HTMLElement;
  const timeHint = timePanel.querySelector('small') as HTMLElement;

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
  dash.innerHTML = '<span class="dash-indicator__key">Space</span><div><b>대시</b><small>준비 완료</small></div>';
  const dashState = dash.querySelector('small') as HTMLElement;
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
  const upgradeCards = document.createElement('div');
  upgradeCards.className = 'upgrade-cards';
  levelupPanel.append(upgradeCards);
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
  resultPanel.append(resultRune, resultEyebrow, resultTitle, resultMessage, resultStats, resultActions);
  result.append(resultPanel);

  const announcement = document.createElement('div');
  announcement.className = 'sr-only';
  announcement.setAttribute('aria-live', 'polite');
  shell.append(title, hud, pause, levelup, result, announcement);

  let currentProfile: Profile | undefined;
  let lastPhase: Phase | undefined;
  let lastChoiceSignature = '';

  function start(mode: GameMode): void {
    const options = { ...handlers.getOptions(), mode, character: 'knight' as const };
    handlers.setOptions({ mode, character: 'knight' });
    handlers.command({ type: 'start', options });
  }

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
    resultStats.replaceChildren();
    const stats: Array<[string, string]> = [
      ['생존 시간', formatTime(state.elapsed)],
      ['처치한 적', state.stats.kills.toLocaleString('ko-KR')],
      ['최종 점수', state.stats.score.toLocaleString('ko-KR')],
      ['최고 점수', Math.max(profile.bestScore, state.stats.score).toLocaleString('ko-KR')],
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
    if (event.key !== 'Tab') return;
    const modal = !pause.hidden ? pause : !levelup.hidden ? levelup : !result.hidden ? result : undefined;
    if (!modal) return;
    const focusable = [...modal.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
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
    setHidden(title, state.phase !== 'title');
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
    setText(timeValue, formatTime(state.duration - state.elapsed));
    setText(timeHint, state.bossSpawned && !state.bossDefeated ? '우두머리가 나타났습니다!' : state.mode === 'demo' ? '빠른 시연 임무' : '밤이 끝날 때까지 버티세요');
    timePanel.classList.toggle('time-panel--urgent', state.duration - state.elapsed <= 30);
    setText(killsValue, state.stats.kills.toLocaleString('ko-KR'));
    setText(scoreValue, state.stats.score.toLocaleString('ko-KR'));
    const cooldown = Math.max(0, state.player.dashCooldown);
    setText(dashState, cooldown > 0 ? `${cooldown.toFixed(1)}초` : '준비 완료');
    dash.classList.toggle('dash-indicator--ready', cooldown <= 0);
    renderWeapons(state);
    renderSettings(profile);
    if (state.phase === 'levelup') renderUpgradeChoices(state);
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
