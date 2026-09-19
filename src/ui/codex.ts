import { CHARACTERS, SYNERGIES, UPGRADES, WEAPONS } from '../game/content';
import './codex.css';

let codexInstance = 0;

const text = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, value: string): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = value;
  return element;
};

const requirementNames = new Map([
  ...Object.values(WEAPONS).map((weapon) => [weapon.id, weapon.name] as const),
  ...UPGRADES.map((upgrade) => [upgrade.id, upgrade.name] as const),
]);

function sectionHeading(title: string, count: number): HTMLDivElement {
  const heading = document.createElement('div');
  heading.className = 'codex__section-heading';
  heading.append(
    text('h3', 'codex__section-title', title),
    text('span', 'codex__count', `${count}종`),
  );
  return heading;
}

/** Creates the read-only title-screen codex. Its owner controls mounting and visibility. */
export function createCodex(onClose: () => void): HTMLElement {
  const instance = ++codexInstance;
  const titleId = `codex-title-${instance}`;
  const descriptionId = `codex-description-${instance}`;

  const root = document.createElement('section');
  root.className = 'codex';
  root.dataset.testid = 'codex';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', titleId);
  root.setAttribute('aria-describedby', descriptionId);
  root.tabIndex = -1;

  const header = document.createElement('header');
  header.className = 'codex__header';
  const headingCopy = document.createElement('div');
  headingCopy.className = 'codex__heading-copy';
  headingCopy.append(text('p', 'codex__eyebrow', '룬 숲의 기록'));
  const heading = text('h2', 'codex__title', '수호자 도감');
  heading.id = titleId;
  const description = text('p', 'codex__description', '수호자와 무기, 함께 모으면 깨어나는 룬 조합을 살펴보세요.');
  description.id = descriptionId;
  headingCopy.append(heading, description);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'codex__close';
  close.dataset.testid = 'codex-close';
  close.setAttribute('aria-label', '도감 닫기');
  close.append(text('span', 'codex__close-mark', '×'), text('span', 'codex__close-label', '닫기'));
  close.addEventListener('click', onClose);
  header.append(headingCopy, close);

  const scroll = document.createElement('div');
  scroll.className = 'codex__scroll';
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', '도감 목록');

  const characterSection = document.createElement('section');
  characterSection.className = 'codex__section';
  const characters = Object.values(CHARACTERS);
  characterSection.append(sectionHeading('수호자', characters.length));
  const characterList = document.createElement('ul');
  characterList.className = 'codex__grid codex__grid--characters';
  for (const character of characters) {
    const startingWeapon = WEAPONS[character.weapon];
    const item = document.createElement('li');
    item.className = 'codex-card codex-card--character';
    item.dataset.codexId = character.id;
    item.style.setProperty('--codex-accent', character.color);
    const portrait = text('span', 'codex-card__portrait', character.name.slice(0, 1));
    portrait.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'codex-card__copy';
    copy.append(
      text('span', 'codex-card__kicker', character.title),
      text('h4', 'codex-card__name', character.name),
      text('p', 'codex-card__description', character.description),
      text('span', 'codex-card__detail', `시작 무기 · ${startingWeapon.name}`),
    );
    item.append(portrait, copy);
    characterList.append(item);
  }
  characterSection.append(characterList);

  const weaponSection = document.createElement('section');
  weaponSection.className = 'codex__section';
  const weapons = Object.values(WEAPONS);
  weaponSection.append(sectionHeading('무기', weapons.length));
  const weaponList = document.createElement('ul');
  weaponList.className = 'codex__grid codex__grid--weapons';
  for (const weapon of weapons) {
    const item = document.createElement('li');
    item.className = 'codex-card codex-card--weapon';
    item.dataset.codexId = weapon.id;
    item.style.setProperty('--codex-accent', weapon.color);
    // The bundled Korean font reliably covers these initials; some symbolic weapon glyphs do not.
    const icon = text('span', 'codex-card__icon', weapon.name.slice(0, 1));
    icon.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('div');
    copy.className = 'codex-card__copy';
    copy.append(
      text('span', 'codex-card__kicker', weapon.tier === 0 ? '기본 무기' : '심화 무기'),
      text('h4', 'codex-card__name', weapon.name),
      text('p', 'codex-card__description', weapon.description),
    );
    item.append(icon, copy);
    weaponList.append(item);
  }
  weaponSection.append(weaponList);

  const synergySection = document.createElement('section');
  synergySection.className = 'codex__section';
  synergySection.append(sectionHeading('룬 조합', SYNERGIES.length));
  const synergyList = document.createElement('ul');
  synergyList.className = 'codex__grid codex__grid--synergies';
  for (const synergy of SYNERGIES) {
    const item = document.createElement('li');
    item.className = 'codex-card codex-card--synergy';
    item.dataset.codexId = synergy.id;
    const name = text('h4', 'codex-card__name', synergy.name);
    const description = text('p', 'codex-card__description', synergy.description);
    const recipe = document.createElement('div');
    recipe.className = 'codex-card__recipe';
    recipe.append(text('span', 'codex-card__recipe-label', '필요한 힘'));
    for (const requirement of synergy.requires) {
      recipe.append(text('span', 'codex-card__requirement', requirementNames.get(requirement) ?? requirement));
    }
    item.append(name, description, recipe);
    synergyList.append(item);
  }
  synergySection.append(synergyList);

  scroll.append(characterSection, weaponSection, synergySection);
  root.append(header, scroll);
  return root;
}
