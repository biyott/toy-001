> 과거 제안 보존: 이 보고서의 16개 목표·단계적 확대·P0/P1 전체 완료 착수 조건은 최신 사용자 지시로 폐지되었습니다. 실제 운영에는 [현재 병렬 정책](../../PARALLEL_POLICY.md)을 적용했고, 독립 P1/P2 제작을 병행했습니다. 아래 후보 분해는 당시 이력입니다.

# PP01 — 실익 기준 병렬 계획

작성: /root/parallel_planner, researcher / 병렬 계획, Astra xhigh. 2026-09-19. 게임·설정·공유문서 수정 없음. 담당 파일은 이 보고서뿐이다. 읽은 근거: PROJECT_REQUEST.md, SPEC.md, PLAN.md, CONTRACTS.md, STATUS.md, src/types.ts, src/main.ts, src/input.ts, src/game/{engine,content}.ts, src/ui/ui.ts, 렌더 함수 목록, 기존 테스트와 QA/품질 보고서. 실제 브라우저 및 무거운 검증은 수행하지 않았다.

## 결론과 현재 인원 해석

P0 정상 승리 전에는 P1 구현을 계속 막아 둔다. 이 대기 중에 **독립 P0 검증 2개와 P2 입력 설계 2개**를 바로 배정할 수 있다. 메인 전달 기준 기존 하위 6 + PP01 + 생성 예정 테스트 5 = 12이므로 이 네 작업은 첫 목표 16에 도달하는 유효한 후보이다. 이는 실제 동시 실행 관측값이나 관리 상한이 아니다. 최신 실행 수는 메인의 런타임 조회가 정한다.

사용자가 폐지한 하위6/역할2·3·2 제한이 PROJECT_REQUEST.md, STATUS.md, 기존 운영문서에 남아 있다. 메인은 최신 지시를 우선하여 문서/대시보드에 첫 목표16, 독립 ready 작업에 따라24/32 이상 확대 가능, 고정 사용자 상한 없음으로 수정해야 한다. 설정1000하위 및 도구메타1001(메인 포함)은 확인 가능한 서로 다른 출처이며, 실제 최대 동시 실행 실측 완료라는 뜻은 아니다.

16은 숫자를 유지할 목표가 아니다. 설계가 먼저 끝나거나 기존 검토가 종료되면 실제 실행 수가 감소할 수 있다. P0 브라우저 완료와 API 고정 전에는 의미 있는 구현 대기가 생기므로 무조건24/32개를 동시에 유지할 근거는 아직 없다.

## 바로 추가 배정 가능한 네 작업

아래 모든 작업은 추가 에이전트 생성 금지, 게임 소스 수정 금지, 브라우저·전체 테스트 실행 금지, 메인이 결과 통합이다. 테스트 작성자는 자신의 테스트만 경량 실행할 수 있으나 공유 fixtures.ts를 수정하지 않는다. 실패를 발견하면 원본 엔진 수정 대신 재현과 기대 동작을 보고한다.

| ID / 예상 | 역할·모델·이유 | 독점 소유 파일 | 목표·완료/검증 | 선행·API·통합 |
|---|---|---|---|---|
| Q-MOVE / 20–30분 | reviewer / Sol high. 충돌 경계를 작은 결정적 사례로 검증 | tests/movement.test.ts, reports/movement-review.md | 걷기/대시의 고체 소품 관통 방지, 장식 통과, 대각선 속도, 네 월드 가장자리, 서로 겹친 소품 근처 탈출/유한좌표. 기존 dash cooldown 테스트 반복 제외. 단일파일 pass 또는 구체 재현 | 지금 ready. createGame/dispatch/step/getState와 기존 mutableStateFixture만. weapon/enemy 전투 판정 범위 제외. 메인 종합 검사 후 combat에 결함 전달 |
| Q-LIMIT / 20–30분 | reviewer / Sol high. 대량개체 수명주기와 중복처리 회귀 | tests/resource-limits.test.ts, reports/resource-limits-review.md | 이벤트 drain 중복 방지·큐상한, 적/투사체/픽업 상한과 만료, 죽은 개체가 중복 XP/처치로 집계되지 않음, 픽업 상한 시 XP 값 보존. 180/300/260 경계를 통제 fixture로 재현. 장시간 성능/FPS 측정 제외 | 지금 ready. 공개 controller와 fixture 사용, private 상수 export 요구 금지. 보스패턴/무기피해/성장선택 기존 담당과 중복하지 않음. 단일파일 검증을 통합 |
| D-PAD / 15–25분 | researcher / Sol high. 작은 입력상태 계약·연결해제 경계 설계 | reports/gamepad-design.md | axes deadzone·정규화, 버튼 edge, 연결/해제, blur/pause, UI 선택/확인/뒤로 매핑과 장치 없는 검증법. 현 InputFrame과 통합 지점에 맞춘 정확한 모듈 API·테스트 항목 제시 | 지금 read-only ready. P2 구현은 P1 통과까지 blocked. src/main.ts/src/input.ts 소유권 없음. seed/touch 설계 영역 제외 |
| D-TOUCH / 15–25분 | researcher / Sol high. 다중 포인터 취소와 UI 충돌 방지 설계 | reports/touch-design.md | 가상 스틱·대시·정지, pointer capture/cancel/lostcapture, 회전/resize/blur, 모달 표시 시 입력제거, 작은 화면 HUD/버튼 간섭을 해결하는 모듈 API와 검증계획 | 지금 read-only ready. P2 구현은 P1 통과까지 blocked. src/main.ts/src/ui/** 수정 없음. 게임패드 설계 영역 제외 |

보고 파일 경로에서 reports/는 .agent-monitor/reports/를 뜻한다. monitor의 포괄 소유권에서 각 배정 보고 파일만 명시적으로 제외해야 한다.

Q-LIMIT는 개체 상한이 숫자대로 존재하는지만 재검사하지 말고 경계에서 XP/처치/큐 수명주기가 손상되는지 검증한다. Q-MOVE는 게임 동작과 직결된 미검증 영역이므로 기존 기하 판정 테스트를 다시 쓰는 작업이 아니다.

## 그 다음 추가 가능한 독립 작업 — 필요에 따라 배정

- **D-CHALLENGE / 15–25분, researcher Sol high**, reports/challenge-design.md 독점. P2 고정 시드 도전의 사용자 입력/공유 문자열/숫자범위/동일 시드+동일입력 결정성/다른 시드 차이/캐릭터 선택 정책을 현 options 계약과 연결한다. challenge mode는 현재 duration만 normal과 동일하고 난이도/시드 UI가 없다. 새 온라인 순위·백엔드·일일 보상은 범위 밖이다. 구현은 P1 통과 뒤이다.
- **D-EVIDENCE / 20–30분, reviewer Sol high**, reports/evidence-index.md 독점. 이미 생성된 evidence JSON/캡처와 Q-P0-01…21을 대응시킨다. 성공·실패·아직 진행 중 파일을 구분하고 SHA/빌드/시간/viewport 없는 항목을 구체적으로 표시한다. 실제 검증 새 실행 또는 같은 화면의 중복 미술 평가는 하지 않는다. 결과는 최종 VALIDATION.md 작성자가 사용한다. 이미 QA가 이 집계까지 맡고 있으면 신규 생성하지 않고 기존 QA에 배정한다.
- **D-DEMO / 15–20분, researcher Sol high**, reports/demo-route.md 독점. 현재 일반 UI와 실제 demo 로그에 근거한 3분 시연 조작 순서, 두 조합의 선택 우선순위, 관찰 포인트를 완성한다. 임의 시드/XP/자동성장 치트 없이 동작해야 하며 미완료 demo 결과를 통과라 쓰지 않는다. 현재 README 조작 설명과 중복되지 않는 실제 발표 대본/분 단위 동선이 산출물이다. demo 종료 로그를 기다리는 부분은 pending 표시한다.

따라서 16에서 추가로 2–3개의 설계·제출 준비 작업은 존재한다. 같은 계획을 여러 사람이 재검토하거나 이미 있는 audio/storage 기본 테스트를 반복하는 방식으로24/32를 채우지는 않는다. 아래 구현 단계에서 API가 고정되면 더 많은 진짜 ready가 생긴다.

## 코드 기준 P1 공백과 모놀리스 판단

P1 메타와 그림은 상당 부분 준비되어 있다. WEAPONS 6, UPGRADES 16, CHARACTERS 3 정의가 있고 mage/ranger/추가 적/golem 스프라이트도 있다. armor 피해감소와 캐릭터 시작 능력은 엔진에 존재한다. 그러나 이름/그림을 구현 완료로 세면 안 된다.

- updateWeapons는 sword/arrow/spirit만 발동한다. lightning/frost/fireball 획득이 가능해져도 현재는 공격하지 않는다.
- 일반 스폰은 slime/mushroom/goblin만 선택한다. skeleton/bat/beetle AI와 종별 스탯·등장곡선이 없다.
- golem은 boss 플래그를 받지만 별도 AI가 없고 실제로 스폰하지 않는다. mushroomKing의 전역 bossPattern과 단일 bossSpawned/bossDefeated는 두 보스 조건에 그대로 쓸 수 없다.
- UI start()가 knight로 다시 고정한다. main.ts도 contentTier:0을 유지한다. 캐릭터 선택/조합도감이 없다.
- 렌더링에는 추가 무기·캐릭터·적의 기초 분기가 있으므로 독립 에셋 제작을 새로 배정할 근거는 없다. 실제 P1 효과 데이터로 가독성 확인은 필요하다.

**engine.ts 전체 분해는 권고하지 않는다.** 이미 검증 중인 P0 공격·XP·사망·충돌·step 순서를 바꾸면 재검증 범위가 커진다. P1 새 동작에 한해 아래 새 파일을 만들고 combat이 엔진에 짧은 호출점을 연결하는 방식이 실익 있다. 단, hooks 설계+호출 변경이 한 작업자25–35분 구현보다 오래 걸린다면 combat 한 명이 P1 전투를 묶어 처리하고 다른 인력을 UI·P2 설계·QA로 돌리는 편이 낫다.

## P1 구현 파도 — P0 실제 승리 및 필수 안정성 게이트 뒤

각 신규 모듈 API는 **combat 제안 → 메인 확정 → 작업자 전달** 순서로 한 번 고정한다. 호출점과 공용타입은 동시에 여러 작성자가 고치지 않는다. 모델은 어려운 상태/종료 경계에 Astra high, 범위가 명확한 독립 UI/무기에 Sol high를 권고한다.

| ID / 예상 | 담당·파일 | 인터페이스 초안과 완료 기준 | 선행/통합 |
|---|---|---|---|
| P1-HOOK / 15–25분 | 기존 combat / Astra high, engine.ts 독점; 메인 types/공용 계약 | P0 경로를 보존한 확장 모듈 호출점, 두 보스 spawn/kill 추적과 승리 필요조건. 모든 새 상태는 restart/start/returnTitle에서 초기화 | P0 gate. 이것이 전투모듈 구현의 짧은 공통 선행. 메인이 API 동결 |
| P1-W / 25–40분 | implementer Sol high, src/game/p1-weapons.ts | lightning 즉발 다중대상, frost 범위피해+유한시간 둔화, fireball 착탄 폭발. 제안 tryAttack(weapon,ctx):boolean / onProjectileHit(projectile,target,ctx)와 reset/slowMultiplier. cooldown 감소는 기존 엔진 단독. power/haste는 기존 계산 재사용. 폭발 동일 대상 중복피해와 split 재귀 없음 | P1-HOOK 계약 후 ready. 엔진 수정 금지. combat이3개 호출부 연결, 기존 weapon test 담당을 P1 확인에 재사용 |
| P1-E / 25–40분 | implementer Sol high, src/game/p1-enemies.ts | skeleton의 거리 유지/투사체, bat의 장애물 넘는 이동, beetle의 예고 있는 별도 이동으로 기존3과 행동 구별. 제안 chooseKind(progress,rng)/definition(kind,progress)/stepEnemy(enemy,ctx). rng는 기존 결정적 스트림만 주입 | P1-HOOK 계약 후 ready. P0 분포는 tier0에서 완전 보존. 게임 장르/새 파밍 기능 추가 없음. enemytest 담당 재사용 |
| P1-B / 25–40분 | implementer Astra high, src/game/p1-boss.ts | golem 고유 2패턴과 예고, 개체별 패턴상태, 소환·사망 이벤트. 공격은 기존 Zone 형식. 원/고리 복제보다 방향성 선·부채꼴 등 기존 표현 가능 형태 활용 | P1-HOOK에서 정확한 스폰/승리 정책 고정 후. P0 패턴 변경 금지. boss test 담당 재사용 |
| P1-CHAR / 15–25분 | implementer Sol high, src/ui/character-select.ts + character-select.css | createCharacterSelect({selected,onSelect})의 element/render/dispose. 세 캐릭터 이름·능력·선택상태·키보드 접근성. CHARACTERS를 유일한 메타로 사용 | P0 gate 뒤 API고정 시 ready. ui.ts/styles.css는 기존UI 담당만 연결. 시작옵션 knight 고정 해제·재시작 유지 함께 검증 |
| P1-CODEX / 20–30분 | implementer Sol high, src/ui/synergy-codex.ts + synergy-codex.css | SYNERGIES/UPGRADES/WEAPONS 참조 도감. 필요조건·실제효과·진행중 활성 상태 설명, 열기/닫기·포커스복귀. 새 조합 발명 안 함 | P0 gate 뒤. 최소 인터페이스 element/render(state)/open/close/dispose. UI 담당이 title/pause 진입과 전투정지 소유. character 모듈과 CSS 클래스 접두사 분리 |
| P1-INTEGRATE / 15–25분 | 기존 combat/UI + 메인, 각 기존 파일 단일소유 | contentTier 활성화,3캐릭터·6무기·6일반적·16업글·2보스·도감 도달가능성, 결과/승리 안내 반영 | 전투 훅+UI 모듈을 기능 단위로 연결. 연결 확인 전 main의 tier를1로 바꾸지 않는다 |

전투 ctx에 필요한 것은 기존 state, seeded rng, addProjectile/addZone, nearest/damageEnemy, emit, power/haste/upgrade, moveBody 중 각 모듈이 실제 쓰는 최소 집합이다. 공유 state 직접 수정 여부·cooldown/stateTime의 소유자를 계약에 명시한다. module마다 stateTime을 다시 증가시키거나 무기 cooldown을 이중 감소시키지 않는다. renderer/UI의 읽기전용 계약은 유지한다.

두 보스 정책의 권고 기본값은 **P1에서 앞선 골렘 한 번 + 기존 버섯왕 시점 유지, 둘 모두 처치하고 제한시간 도달해야 승리**이다. 정확한 시점/체력은 combat이 고정한다. demo도 실제6무기·2보스를 보여줄 수 있도록 시간에 맞게 조정하되 P0 demo 기준120초/normal480초 버섯왕은 tier0에서 유지한다. 선행 보스가 살아 있을 때 후속이 등장해도 개별 패턴상태와 사망 횟수가 섞이지 않아야 한다. 이는 권고안이지 확정 사양이나 구현 완료 보고가 아니다.

## P2 구현 파도 — P1 통합·검증 뒤

- **P2-PAD / 25–40분, implementer Sol high**: src/controls/gamepad.ts, tests/gamepad.test.ts. D-PAD 계약에 따라 read/clear/dispose. navigator.getGamepads는 주입 가능한 접근함수로 두어 연결/해제와 버튼 edge를 장치 없이 검사. 실제 물리 패드가 없으면 그 사실을 남기고 native 브라우저 모의입력 검증과 구분한다.
- **P2-TOUCH / 25–40분, implementer Sol high**: src/controls/touch.ts, touch.css, tests/touch.test.ts. read/clear/dispose와 화면 root 소유. pointer ID별 스틱/대시 소유권, 취소 뒤 유령 입력 없음. 실제 브라우저 모바일 viewport/pointer 검증은 메인.
- **P2-SEED / 20–30분, implementer Sol high**: src/ui/challenge-panel.ts, challenge-panel.css, tests/challenge.test.ts. D-CHALLENGE의 시드 파서/형식/옵션생성. 기존 createGame RNG를 복제하지 않는다. UI와 main 연결은 각각 기존 소유자.
- **P2-MERGE / 15–25분, 메인**: src/input.ts/main.ts에서 키보드·패드·터치 이동 합성 정책과 dash/pause edge 한 번 소비 고정. 최대 이동 크기1, 취소/모달에서 clear, 키보드 회귀. 게임패드의 메뉴 선택은 GameCommand와 UI 포커스 중 정한 하나의 경로만 사용한다.

입력 세 작업은 파일이 독립해도 합성 계약 없이 추측 구현하면 충돌한다. 설계보고서에 read()가 소비형인지, clear()가 물리적으로 계속 눌린 버튼의 다음 프레임을 새 edge로 볼지, 숨겨진 UI에서 터치 리스너를 유지할지를 반드시 적는다.

## 메인 통합 순서와 완료 판단

1. 현재 동결 P0 실제 normal 승리·demo 및 기능검증을 끝낸다. 기존 불합격 시도와 새 성공 시도를 함께 보존한다.
2. 추가 P0 테스트 결과를 받아 결함만 triage한다. 한꺼번에 엔진을 여러 사람이 수정하지 않는다. 이미 해결된 다른 코드 버전에서 난 실패는 빌드 식별자를 대조한다.
3. P1 호출 계약을 고정하고 독립 모듈을 배정한다. 문서/설계만 완료한 작업자는 해당 구현으로 재사용할 수 있다.
4. P1 무기 → 일반적 → 보스 종료조건 → UI 선택/도감 순으로 작은 통합을 한다. 단위 검증을 모으되 타입/전체tests/build는 메인이 한 묶음으로 실행한다.
5. P1 빌드를 고정해 실제 UI 도달·캐릭터3종·전투 차이·두 보스와 정상 승패를 확인한다. 기존 P0 실제승리를 P1의 정상승리로 오인하지 않는다.
6. P2 입력3개를 독립 구현하고 메인 한 명이 합성·연결, 관련 검증과 실제 브라우저 검사를 진행한다.
7. 최종 동결 이후 해상도·고부하·저장·재시작 증거와 제출문서/대시보드 최종상태를 묶는다. 검사나 보고 완료를 에이전트 종료 상태로 대신하지 않는다.

## 남은 P0 증거 공백 — 새 중복 작업으로 만들지 않을 것

현재 메인에게 맡겨진 정상승리·demo·브라우저 기능 및 기존 QA/품질검토가 해소할 영역이다. 추가 독립 에이전트는 증거 정리만 맡는다.

- 두 조합은 내부 synergies 문자열뿐 아니라 분열/연쇄의 실제 공격 차이와 캡처가 필요하다.
- 브라우저 smoke의 현재 해상도 검사는 타이틀 중심이다. 성장/일시정지/보스/결과720p·1080p 잘림은 해당 화면이 나온 기록과 대조해야 한다.
- 현재 pause 검사1100ms와 restart후100ms 관찰은 기능 존재를 보지만 QA계획의10초 정지·20초 재시작 관찰을 충족하는지는 별도로 표시해야 한다. 원 요구는 시간을 구체적으로 강제하지 않으므로 임의 실패 판정 대신 실제 증거의 범위를 정직하게 적는다.
- diagnostics.rafLoopCount:1은 고정 표기이며 실제 재시작 타이머속도 관측을 대신하지 않는다. source에서 RAF 등록이 한 번인 사실과 실제 경과시간을 함께 사용한다.
- 성능은 이미 QA가 준비한 별도 고부하 fixture와 정상 플레이의 대표구간을 구분한다. 아직 프레임 수치 없이60fps 달성이라 쓰지 않는다.
- 최신 UI/렌더 수정 파일과 고정 검증 빌드가 다르므로 최종 검증대상 버전/변경 영향을 명시한다.

## 작업 배정 제외

이미 별도로 생성 예정인 weapon/synergy/boss-pattern/progression/enemy 테스트는 이 계획에서 다시 배정하지 않는다. 기존 audio/storage/input 기본검사를 동일 목적 새 파일로 복제하지 않는다. 완성된 스프라이트를 이름 수만 늘리기 위해 다시 제작하지 않는다. P0 승리 대기 중 engine.ts를 구조개편하지 않는다. 신규 기능으로 온라인 순위·멀티플레이·추가 맵·캐릭터·조합을 발명하지 않는다.
