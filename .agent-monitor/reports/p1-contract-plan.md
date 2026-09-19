# P1 엔진 확장 훅 계약안 — 구현 미승인

기존 P0 엔진 전체를 분해하지 않는다. `contentTier === 1`에서만 세 확장 모듈을 호출하고 P0 흐름·상한·이벤트·충돌 도우미는 그대로 재사용한다. 이 문서는 계획이며 세 모듈은 아직 생성하지 않았다.

## 파일과 소유권

- `src/game/p1-weapons.ts`: lightning/frost/fireball 무기의 공격 및 fireball 착탄 효과. 별도 작성자 1명.
- `src/game/p1-enemies.ts`: skeleton/bat/beetle의 각기 다른 이동·공격 상태기계. 별도 작성자 1명.
- `src/game/p1-boss.ts`: golem의 예고 zone 기반 2패턴 이상. 별도 작성자 1명.
- `src/game/engine.ts`: G01만 편집. 훅 연결, 생성 스케줄, 종료 조건, 내부 helper 제공, P0/P1 gating.
- `src/game/content.ts`: 현재 6무기·16업글·3캐릭터 정의가 이미 있어 내용 검토 외 병렬 수정 불필요.

## 최소 공용 context

새 공용 루트 타입은 필요 없다. `engine.ts`가 `export interface P1Context`를 정의하고 세 모듈은 `import type`으로만 참조한다. 엔진의 런타임 함수는 직접 import하지 않는다. 타입 전용 역참조는 실행 시 순환을 만들지 않는다. 메인이 원한다면 작은 `p1-context.ts`로 타입만 분리할 수 있으나 필수 파일은 아니다.

context 제공 후보:

- `state: GameState`: 현재 tick에서 공유하는 읽기/정해진 mutation 대상. 모듈이 배열을 교체하거나 phase/elapsed/stats를 직접 수정하지 않는다.
- `random(): number`, `upgrade(id): number`, `power(): number`, `haste(): number`.
- `nearest(position,range,excluded?)`, `nearby(position,range)`: 엔진 공간그리드 재사용.
- `damageEnemy(enemy,damage,weapon,source)`: 통계·피격·이벤트 단일 경로.
- `emit(type,position,detail?)`, `addZone(zoneWithoutIdAndHitIds)`, `addProjectile(...)`: ID와 개체상한은 엔진 소유.
- `moveBody(body,dx,dy,ignoreProps?)`: 동일 경계/충돌 사용. 박쥐만 solid 통과 허용.
- `slowEnemy(enemy,seconds,factor)`: 서리 효과가 필요하면 엔진의 private Map으로 만료시간 관리. reset/처치 시 map 정리. enemy.speed를 누적 곱하여 영구감속하지 않는다.

모듈은 비공개 rng, nextId, event queue에 접근하지 않는다. module-global 변동 상태를 금지해 start/restart 격리를 보존한다. 별도 상태가 필요하면 create 함수가 반환하는 hook instance로 만들고 reset에서 새로 생성한다.

## 훅 형태

1. `updateP1Weapon(weapon,dt,ctx): boolean` — 해당 무기이면 공격 처리 후 true. 기본 cooldown 감소는 엔진에서 한 번만 수행한다. 번개는 bounded target 집합, 서리는 동일 zone 피해와 감속, 불꽃은 bounded projectile.
2. `onP1ProjectileHit(projectile,enemy,ctx): void` — fireball만 폭발 circle zone을 생성하고 projectile.life=0. 같은 projectile이 여러 적에 중복 폭발하지 않도록 generation 또는 hitIds와 종료를 사용한다.
3. `updateP1Enemy(enemy,dt,ctx): boolean` — 세 일반 적의 이동을 직접 처리했으면 true. 공통 hitFlash/cooldown/stateTime 갱신과 플레이어 접촉 피해는 엔진에서만 처리한다.
4. `updateP1Boss(enemy,dt,ctx): boolean` — golem을 처리했으면 true. 공격 예고와 판정은 addZone 한 데이터로 통일하며 별도 타이머 피해를 만들지 않는다.

engine은 tier0에서 어떤 P1 hook도 호출하지 않는다. P1 적 선택과 생성 수치도 엔진 소유다. 공용 kind/weapon union은 이미 충분하다.

## 연결 시 반드시 확정할 사항

- 두 번째 보스 예시 시각: normal 540초 / demo 150초. 기존 mushroomKing의 480초 / 120초 유지. 시간은 메인 확정 후 상수화.
- P1 승리: 제한시간 도달과 **두 보스 처치** 모두 필요. 기존 boolean을 첫 보스 처치만으로 true로 만들지 않는다. private spawn schedule + `stats.bossesDefeated`를 사용하고 공개 `bossDefeated`는 필수 보스 전체 처치 의미로 계산한다.
- 동시 보스가 존재할 때 HUD 표시와 이벤트 텍스트는 메인이 UI 담당과 연결한다.
- 180적/300투사체 상한과 finite movement guard를 P1에도 동일하게 적용한다.
- 생성/무기/캐릭터의 tier gating, 세 번 재시작, 2보스 승리 경계, 무기/적 각 동작 단위검증 후 실제 P1 플레이로 검증한다. P0 테스트는 기존 동작 회귀 판정에 유지한다.
