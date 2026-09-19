import type { CharacterDefinition, CharacterId, SynergyDefinition, UpgradeDefinition, WeaponDefinition, WeaponId } from '../types';

export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  sword: { id: 'sword', name: '새벽의 검', description: '가까운 적을 넓은 부채꼴로 베어냅니다.', icon: '⚔', color: '#f6ce73', tier: 0 },
  arrow: { id: 'arrow', name: '숲지기 활', description: '가장 가까운 적에게 빠른 화살을 발사합니다.', icon: '➶', color: '#97d6a0', tier: 0 },
  spirit: { id: 'spirit', name: '수호 정령', description: '주변을 공전하며 닿은 적을 공격합니다.', icon: '✦', color: '#bca0f6', tier: 0 },
  lightning: { id: 'lightning', name: '천둥 룬', description: '가까운 적들에게 순간적인 번개를 내립니다.', icon: 'ϟ', color: '#ffe49b', tier: 1 },
  frost: { id: 'frost', name: '서리 마법서', description: '주변에 얼음 고리를 펼쳐 적을 늦춥니다.', icon: '❄', color: '#94e5ee', tier: 1 },
  fireball: { id: 'fireball', name: '불씨 지팡이', description: '착탄 지점에서 폭발하는 불꽃을 발사합니다.', icon: '♨', color: '#ffaf75', tier: 1 },
};
export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  knight: { id: 'knight', name: '로완', title: '작은 새벽 기사', description: '튼튼한 갑옷과 넓은 검격. 최대 체력 120.', weapon: 'sword', color: '#8bbbc8' },
  mage: { id: 'mage', name: '루미', title: '별빛 견습 마법사', description: '수호 정령과 함께 출발. 공격력 12% 증가.', weapon: 'spirit', color: '#b69bd8' },
  ranger: { id: 'ranger', name: '페른', title: '숲길의 작은 궁수', description: '활과 함께 출발. 이동 속도 12% 증가.', weapon: 'arrow', color: '#8eba91' },
};
export const UPGRADES: UpgradeDefinition[] = [
  { id: 'sword', name: '새벽의 검', description: '검을 획득하거나 강화합니다. 넓은 검격과 피해가 증가합니다.', icon: '⚔', category: 'weapon', maxLevel: 5, tier: 0, weapon: 'sword' },
  { id: 'arrow', name: '숲지기 활', description: '활을 획득하거나 강화합니다. 화살 피해와 발사 속도가 증가합니다.', icon: '➶', category: 'weapon', maxLevel: 5, tier: 0, weapon: 'arrow' },
  { id: 'spirit', name: '수호 정령', description: '정령을 획득하거나 강화합니다. 정령 수와 공전 피해가 증가합니다.', icon: '✦', category: 'weapon', maxLevel: 5, tier: 0, weapon: 'spirit' },
  { id: 'power', name: '용기의 문장', description: '모든 무기의 피해량이 18% 증가합니다.', icon: '◆', category: 'power', maxLevel: 5, tier: 0 },
  { id: 'haste', name: '재빠른 손', description: '모든 무기의 공격 간격이 10% 짧아집니다.', icon: '»', category: 'power', maxLevel: 4, tier: 0 },
  { id: 'vitality', name: '생명의 새싹', description: '최대 체력이 25 증가하고 체력을 40 회복합니다.', icon: '♥', category: 'defense', maxLevel: 4, tier: 0 },
  { id: 'speed', name: '바람 장화', description: '이동 속도 10% 증가, 대시 대기시간 8% 감소.', icon: '➤', category: 'utility', maxLevel: 3, tier: 0 },
  { id: 'magnet', name: '별빛 주머니', description: '경험치 수집 반경이 45 증가합니다.', icon: '✧', category: 'utility', maxLevel: 3, tier: 0 },
  { id: 'pierce', name: '바람 관통', description: '화살이 적 2명을 추가로 관통합니다. 분열 씨앗과 조합 가능.', icon: '↠', category: 'synergy', maxLevel: 2, tier: 0 },
  { id: 'split', name: '분열 씨앗', description: '화살 명중 시 작은 화살 2개로 분열합니다. 바람 관통과 만나 폭풍이 됩니다.', icon: '⋔', category: 'synergy', maxLevel: 2, tier: 0 },
  { id: 'chain', name: '연쇄 전격', description: '정령 명중 시 주변 적에게 번개가 이어집니다.', icon: 'ϟ', category: 'synergy', maxLevel: 3, tier: 0 },
  { id: 'regen', name: '숲의 축복', description: '매초 체력을 0.6 회복합니다.', icon: '❀', category: 'defense', maxLevel: 3, tier: 0 },
  { id: 'lightning', name: '천둥 룬', description: '천둥 룬을 획득하거나 강화합니다. 여러 적에게 번개를 내립니다.', icon: 'ϟ', category: 'weapon', maxLevel: 5, tier: 1, weapon: 'lightning' },
  { id: 'frost', name: '서리 마법서', description: '서리 마법서를 획득하거나 강화합니다. 얼음 고리가 적을 늦춥니다.', icon: '❄', category: 'weapon', maxLevel: 5, tier: 1, weapon: 'frost' },
  { id: 'fireball', name: '불씨 지팡이', description: '불씨 지팡이를 획득하거나 강화합니다. 화염 폭발이 커집니다.', icon: '♨', category: 'weapon', maxLevel: 5, tier: 1, weapon: 'fireball' },
  { id: 'armor', name: '수호의 망토', description: '받는 피해가 12% 감소합니다.', icon: '▣', category: 'defense', maxLevel: 3, tier: 1 },
];
export const SYNERGIES: SynergyDefinition[] = [
  { id: 'splinterstorm', name: '숲의 화살비', description: '관통 화살이 적을 뚫으며 분열합니다. 갈라진 화살도 한 번 관통합니다.', requires: ['arrow', 'pierce', 'split'] },
  { id: 'stormguard', name: '천둥 수호대', description: '공전 정령이 명중할 때 주변 적을 따라 번개가 이어집니다.', requires: ['spirit', 'chain'] },
];
