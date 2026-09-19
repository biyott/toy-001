# 인터페이스와 파일 소유권

공유 디렉터리에서 브랜치를 바꾸지 않습니다. 같은 파일의 작성자는 한 명입니다. 현재 병렬 정책은 [PARALLEL_POLICY.md](PARALLEL_POLICY.md), 작업별 상세는 [PLAN.md](PLAN.md)입니다.

| 범위 | 작성·통합 담당 |
|---|---|
| 공용 타입·설정·의존성·main/input/audio·루트 운영문서 | 메인 |
| engine.ts/content.ts/dash.ts | combat |
| p1-context.ts | 메인 |
| p1-weapons.ts/enemy-projectiles.ts | p1_weapons |
| p1-enemies.ts | enemy_tests |
| p1-boss.ts | boss_tests |
| 공용 renderer/sprites/world/effects/art·characters/shared | architecture |
| characters/knight.ts · mage.ts · ranger.ts | 각각 knight_design · mage_design · ranger_design |
| ui.ts/styles.css | ui |
| ui/codex.ts/css | synergy_tests |
| ui/challenge.ts | parallel_planner(설계 후 구현 재배정) |
| controls/gamepad.ts | gamepad |
| controls/touch.ts/css | touch |
| storage.ts 최종 모드 분리 | qa (메인 승인된 좁은 범위) |
| 전용 테스트 | 해당 작업 담당, 개별 파일; PLAN 참조 |
| README/DEMO 초안 | resource_tests; 최종 확정 메인 |
| .agent-monitor 코드·서버 | monitor |
| .agent-monitor/reports/coordinator.json | 메인 단독 |

## 게임 계약

- TypeScript strict + Vite, Canvas2D 절차적2.5D. 공용 데이터 정의는 `src/types.ts`.
- `createGame(options): GameController`, `createRenderer(canvas): Renderer`, `createUI(root,handlers): GameUI`.
- 단일 RAF, 고정1/60초 step, 누적 프레임 지연은0.1초까지. 게임시간은step에서만 증가하고 pause/levelup/hidden/blur에서 동결.
- x/y는 화면 이동 방향과 같고, feet 기준 y정렬·카메라 추적. 월드 halfWidth1000/halfHeight680.
- phase는 title/playing/paused/levelup/victory/defeat. mode는 normal600/demo180/challenge600.
- tier0 회귀는3무기·3적·1보스; 제출판 tier1은6무기·6일반적·2보스·16성장·3캐릭터.
- 버섯왕 normal480/demo120, 골렘 normal540/demo150. 시간도달과 서로 다른 필수 보스2종 처치가 모두 필요. 미처치 보스가 있으면 연장.
- 상태 변경은 엔진step/dispatch. renderer/UI는 상태를 읽고 command를 전달. 검증 fixture는 명시적으로 분리.
- InputFrame: moveX/moveY,dashPressed,pausePressed. main이 keyboard/gamepad/touch를 정규화하여 병합. 버튼 edge는 한step만 소비, 화면전환·포커스상실 때 clear.
- GameEvent 배열은drainEvents로 한 번 비우고 renderer/audio가 같은 배열을 각각 소비.
- `window.__LRG__`는 복사 상태와 진단만 반환. 실행 중 게임 상태를 바꾸는 디버그 API는 제공하지 않음.

## 독립 확장 경계

`src/game/p1-context.ts`는 IDs·랜덤·피해 통계·개체 상한·zone·projectile·이동·감속을 엔진 한 경로로 제공한다. `updateP1Weapon`, `onP1ProjectileHit`, `updateP1Enemy`, `updateP1Boss`는 자기 콘텐츠만 처리하고 나머지는 false/no-op. 공통 cooldown/stateTime/hitFlash는 엔진에서 한 번 갱신. 감속은 reset/처치/만료 때 정리.

캐릭터는 `paintKnight/paintMage/paintRanger(ctx,frame,pose)`이며128×144 논리캔버스, 발점(64,132), frame0..3. idle/walk/windup/attack/recover/hit/dash를 불연속 캐시. 공용등록·렌더러 연결은architecture 한 명이 담당. 상세는 `src/render/characters/README.md`.

UI 독립 함수는 `createCodex(onClose)`와 `createChallengeControls(options,onChange)`. 도전 시드는ASCII uint32만 허용하며0도 유효. 게임패드는 standard 매핑과 neutral gate, 터치는 pointer별 소유권과 capture/cancel 정리.

## 저장

Profile v1 루트 bestScore/bestTime/wins는 일반 임무 기록. optional demoRecord는 시연 전용으로 독립 저장. challenge는 두 기록을 바꾸지 않음. 공통settings는 muted/reducedMotion. `recordRunResult`가 모드별 결과를 분리하며 main의runSaved로 한 번만 저장. 기존 v1 형식·정상 기록·설정을 보존하고 잘못된 demoRecord만 별도 복구. 접근 실패도 게임 시작을 막지 않음.

## 대시 충전과 적 비행 계약

Player는 dashCharges/dashMaxCharges/dashRechargeRemaining/dashRechargeDuration/dashReuseDelay를 보유한다. dashCooldown은 다음 사용 가능 시간의 호환 파생값이다. 짧은 연속 사용 대기 표시는 dashReuseDelay만 사용한다. initialDashState/configureDash/advanceDash/consumeDash는 src/game/dash.ts의 단일 규칙이며 UI와 터치는 이를 변경하지 않는다. 기사2회·5초, 마법사1회·4초, 궁수3회·6초; Lv8에 빈 최대칸+1을 한 번만 추가. 최소 사용 간격0.85초, 빈 칸 순차 충전, 장화는 최대24% 감소·3초 하한. pause/levelup에서 충전도 정지한다.

Projectile.kind는 spore/bone/royal-spore를 구별하며 왕 포자에는 targetX/targetY/splashRadius가 붙는다. stepEnemyProjectile은 수명 내 선분 충돌과 실제 이동을 한 번 처리해 direct/splash/null을 반환한다. engine만 실제 피해나 폭발 Zone을 생성한다. 조준 예고 피해는0이며 현재 플레이어 위치로 탄을 순간 이동시키지 않는다. 버섯/해골은 저장된 방향으로 비행, 왕은 저장한 목표 도달 또는 접촉 시 한 번 폭발한다. 장애물은 기존 플레이어 화살과 동일하게 투사체를 막지 않는다.

controls/touch.setDashState는 Player의 대시 상태 부분집합을 받아 숫자·진행률·aria를 갱신한다. 충전0을 이유로 버튼 자체를 disabled 처리하지 않아 포인터 capture/cancel 수명과 일치시킨다.

## 고정 화면 효과와 렌더링 수명

게임 Canvas는 매 프레임 불투명 바닥색으로 전체를 덮으므로 alpha:false로 생성하며 중복 clearRect는 하지 않는다. 화면 크기에만 의존하는 비네트는 canvas의 실제 backing 크기와 같은 해상도로 준비하고 identity transform에서 1:1 합성한다. 카메라 이동·흔들림과 독립된 화면 좌표 효과다. 생성/resize에만 다시 만들며 dispose에서 backing을0×0으로 만들고 참조를 비운다. DPR 상한2와 기존 색상·위험 표시·개체 수는 유지한다.

추가 캐시는 화면 크기의 RGBA 이미지1개(1080p DPR1 약7.91MiB, DPR2 약31.64MiB)다. 이 값은 브라우저 전체 메모리 상한이 아니다. 적 공격 영역 캐시 후보는 같은 조건에서 성능이 나빠져 제거했다. 공격 도형·사선·경계는 기존 직접 그리기를 유지한다. 비교 근거와 제한은 VALIDATION.md를 따른다.
