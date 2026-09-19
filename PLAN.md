# 작업 계획

최초 시작부터 최대 3시간. 마감 2026-09-19T14:42:37Z (한국시간23:42).
정의된 작업 수 기반 집계이며 난이도·시간 진행률을 뜻하지 않습니다.

| ID | 작업 | 담당 | 상태 | 선행 | 구현 | 검증 | 통합 |
|---|---|---|---|---|---|---|---|
| E01 | 환경·실행 조건 | /root | integrated | 없음 | done | passed | done |
| M01 | 대시보드 MVP | /root/monitor | integrated | E01 | done | passed | done |
| A01 | 아트·구조 결정 | /root/architecture | integrated | E01 | done | passed | done |
| A02 | 시각 프로토타입 | /root | integrated | M01,A01 | done | passed | done |
| G01 | P0 전투·성장 | /root/combat | integrated | A02 | done | passed | done |
| G02 | P0 UI·사운드·저장 | /root/ui | integrated | A02 | done | passed | done |
| G03 | P0 렌더링·연출 | /root/architecture | integrated | A02 | done | passed | done |
| V01 | P0 실제 플레이 | /root | integrated | G01,G02,G03 | done | passed | done |
| G04 | P1 확장 | /root | integrated | 없음 | done | passed | done |
| G05 | P2 입력·시드 | /root | integrated | 없음 | done | passed | done |
| V02 | 최종 QA·성능 | /root | integrated | G05 | done | 기능·시각·실제플레이·재현빌드검증 수용. 최대부하60FPS목표미달·물리기기미검증을별도보존. | done |
| D01 | 제출물 보존 | /root | integrated | V02 | done | 소스·프로덕션빌드·가이드·검증원본·관측이력 보존. 최종저장본 생성 후HTTP·화면검사. | done |
| PP01 | 병렬계획 | /root/parallel_planner | integrated | A02 | done | passed | done |
| T-WPN | 무기동작 | /root/weapon_tests | integrated | A02 | done | passed | done |
| T-SYN | 조합효과 | /root/synergy_tests | integrated | A02 | done | passed | done |
| T-BOSS | 보스패턴 | /root/boss_tests | integrated | A02 | done | passed | done |
| T-XP | 성장경계 | /root/growth_tests | integrated | A02 | done | passed | done |
| T-AI | 적행동·스폰 | /root/enemy_tests | integrated | A02 | done | passed | done |
| T-MOVE | 물리이동 | /root/movement_tests | integrated | A02 | done | passed | done |
| T-CAP | 개체상한·이벤트 | /root/resource_tests | integrated | A02 | done | passed | done |
| P2-PAD-D | 게임패드계약 | /root/gamepad | integrated | A02 | done | passed | done |
| P2-TOUCH-D | 터치계약 | /root/touch | integrated | A02 | done | passed | done |
| M02 | 병렬 정책·정확한계수 대시보드확장 | /root/monitor | integrated | M01 | done | passed | done |
| M03 | 대시보드 최신 병렬정책 | /root/monitor | integrated | 없음 | done | passed | done |
| P1-ART | 공용 아트 경계·확장 효과 | /root/architecture | integrated | 없음 | done | passed | done |
| P1-CORE | 확장 엔진 연결·승리 조건 | /root/combat | integrated | 없음 | done | passed | done |
| P1-WEAPONS | 번개·서리·화염 구현 | /root/p1_weapons | integrated | 없음 | done | passed | done |
| P1-ENEMIES | 해골·박쥐·딱정벌레 행동 | /root/enemy_tests | integrated | 없음 | done | passed | done |
| P1-GOLEM | 골렘 예고 패턴 | /root/boss_tests | integrated | 없음 | done | passed | done |
| P1-UI | 캐릭터 선택·확장 HUD·화면 통합 | /root/ui | integrated | 없음 | done | passed | done |
| P1-CODEX | 무기·캐릭터·조합 도감 | /root/synergy_tests | integrated | 없음 | done | passed | done |
| P2-CHALLENGE | 시드 도전 설정 | /root/parallel_planner | integrated | 없음 | done | passed | done |
| P2-PAD | 게임패드 입력 | /root/gamepad | integrated | 없음 | done | passed | done |
| P2-TOUCH | 터치 입력 | /root/touch | integrated | 없음 | done | passed | done |
| P1-CONTENT-TEST | 확장 콘텐츠·2보스 종료 경계 검증 | /root/growth_tests | integrated | 없음 | done | passed | done |
| V-PERF-HARNESS | 확장 부하·병목 측정 준비 | /root/qa | integrated | 없음 | done | passed | done |
| ART-KNIGHT | 기사 검·방패 고유 공격 포즈 | /root/knight_design | integrated | 없음 | done | passed | done |
| ART-MAGE | 견습 마법사 시전 포즈 | /root/mage_design | integrated | 없음 | done | passed | done |
| ART-RANGER | 숲 궁수 활 당김·발사 포즈 | /root/ranger_design | integrated | 없음 | done | passed | done |
| ART-PREVIEW | 세 캐릭터 실제 크기·포즈 비교 | /root/weapon_tests | integrated | 없음 | done | passed | done |
| D01-README | 실행 문서와 3분 시연 가이드 | /root/resource_tests | integrated | 없음 | done | passed | done |
| V-INTEGRATION | 입력·전투 연결 독립 검토 | /root/quality | integrated | 없음 | done | passed | done |
| M04 | 오래된 실행·현재 확인 실행 분리 | /root/monitor | integrated | 없음 | done | passed | done |
| DELIVERY-AUDIT | 제출 사양·재현 절차 감사 | /root/movement_tests | integrated | 없음 | done | passed | done |
| V-VISUAL | 캐릭터·UI 실제 캡처 검토 | /root/quality | integrated | 없음 | done | passed | done |
| V-BOSS-VIS | 2보스 4패턴 실제 렌더 고정 장면 | /root/boss_tests | integrated | 없음 | done | passed | done |
| SAVE-MODES | 일반·시연 최고 기록 분리 | /root/qa | integrated | 없음 | done | passed | done |
| UI-FIX-TOUCH | 낮은 가로 화면 HUD 및 시연 기록 표시 | /root/ui | integrated | 없음 | done | passed | done |
| DASH-CORE | 캐릭터별 대시 충전·레벨 성장 | /root/combat | integrated | 없음 | done | passed | done |
| DASH-HUD | 충전칸·숫자·다음 충전 HUD | /root/ui | integrated | 없음 | done | passed | done |
| DASH-TOUCH | 터치 대시 숫자·충전링 | /root/touch | integrated | 없음 | done | passed | done |
| DASH-TEST | 대시 회복·성장·정지·재시작 검증 | /root/movement_tests | integrated | 없음 | done | passed | done |
| ENEMY-FLIGHT | 적 투사체 비행·연속 충돌 판정 | /root/p1_weapons | integrated | 없음 | done | passed | done |
| ENEMY-RANGED-CORE | 버섯·보스 실제 포자 발사 연결 | /root/combat | integrated | 없음 | done | passed | done |
| ENEMY-SKELETON | 해골 3연발 뼈 투사체 | /root/enemy_tests | integrated | 없음 | done | passed | done |
| ENEMY-PROJECTILE-VIS | 적 포자·뼈 궤적·발사·착탄 표현 | /root/architecture | integrated | 없음 | done | passed | done |
| ENEMY-RANGED-TEST | 원거리 공격 실제 비행 통합 회귀 | /root/boss_tests | integrated | 없음 | done | passed | done |
| V-PERF-FINAL | 적 투사체 포함 상한부하 준비 | /root/qa | integrated | 없음 | done | passed | done |
| FINAL-PLAY | RC3 실제 10분·3분·재시작 검증 | /root | integrated | 없음 | done | passed | done |
| FINAL-REVIEW | 최종 소스·화면·근거 독립 리뷰 | /root/quality | integrated | 없음 | done | 기능·시각 출시 수용.60FPS성능목표미달·물리장치미검증 별도 명시. | done |
| DASH-REUSE-LABEL | 짧은 재사용 대기와 충전 대기 문구 분리 | /root/ui | integrated | 없음 | done | passed | done |
| FINAL-DOCS | 최종 실행 안내·시연 설명 반영 | /root/resource_tests | integrated | 없음 | done | passed | done |
| M05 | 최종 대시보드 통합 판정·제한 오류·시각 정확성 | /root/monitor | integrated | M04 | done | passed | done |
| DELIVERY-FINAL | 최종 제출 문서의 이전 지적 해결 확인 | /root/movement_tests | integrated | FINAL-DOCS,FINAL-PLAY | done | 기존6지적 근거확인 및 삭제된zone-cache 문서오기수정. 최종저장본은메인이검사. | done |
| PERF-RENDER | 고부하 화면 그리기 비용 분석·최적화 | /root/architecture | integrated | V-PERF-FINAL | done | 측정 완료:28.909/18.167FPS,60목표미달. 24캔버스비교·실제입력·resize통과. | done |
| PERF-INSTRUMENT | 반복 픽셀 읽기의 성능 계측 간섭 분리 | /root/qa | integrated | V-PERF-FINAL | in_progress | readback 기본 OFF 및 5초 구간 측정 적용. 실제60초 기준720/1080 모두 오류0; CDP software canvas 확인. | pending |

## 소유권과 연결 계약

| ID | 파일·산출물 | 인터페이스 | 요청 모델·추론 | 검증 방법 | 통합 담당 |
|---|---|---|---|---|---|
| E01 | STATUS.md, RUNBOOK.md | 도구 메타·설정·실제 런타임 조회 | gpt-6-astra (권장) xhigh (권장) | 설치 런타임·설정과 도구 차이 확인 | /root |
| M01 | .agent-monitor/collector.py, .agent-monitor/index.html, .agent-monitor/assets | coordinator report → normalized state/events | gpt-5.6-sol high | HTTP·한국어·필터·새로고침·연결·11 자동검사 | /root |
| A01 | ART_DIRECTION.md, .agent-monitor/reports/architecture-design.md | Canvas2D feet anchor / sprite frame | gpt-6-astra xhigh | 초기 아트 및 성능 경계 검토 | /root |
| A02 | src/types.ts, src/main.ts, src/input.ts, src/audio.ts, src/storage.ts | GameController / Renderer / GameUI | gpt-6-astra (권장) xhigh (권장) | 실제 프로토타입 화면·입력·오디오 상태 | /root |
| G01 | src/game/engine.ts, src/game/content.ts | createGame, step, dispatch, drainEvents | gpt-6-astra high | 엔진 단위 및 P0 실제 플레이 | /root |
| G02 | src/ui/ui.ts, src/ui/styles.css | createUI state read + commands | gpt-5.6-sol high | 한국어 화면·저장·성장·결과 브라우저 | /root |
| G03 | src/render | createRenderer render/events/resize/dispose | gpt-6-astra xhigh | 캐릭터·가림·그림자·실제 화면 검토 | /root |
| V01 | evidence/p0-normal-retry-result.json, evidence/p0-demo-result.json | 키보드 실제 시간 / 읽기 전용 관찰 | gpt-6-astra (권장) xhigh (권장) | P0 600초·180초·재시작3회 | /root |
| G04 | src/game/p1-*.ts, src/render/characters, src/ui/codex.ts | P1Context / 3개 캐릭터 renderer contract | gpt-6-astra (권장) xhigh (권장) | 개별 P1 작업과 RC1 실제 통합 플레이 | /root |
| G05 | src/controls, src/ui/challenge.ts | InputFrame / neutral gate / uint32 seed | gpt-6-astra (권장) xhigh (권장) | 독립 P2 단위 및 확장 브라우저 검증 | /root |
| V02 | VALIDATION.md, evidence/final-performance.json | 고정 빌드·증거·독립 리뷰 | gpt-6-astra (권장) xhigh (권장) | 정상 완주·시연·재시작·해상도·고부하 | /root |
| D01 | VALIDATION.md, RUNBOOK.md, STATUS.md, AGENT_LOG.md, .agent-monitor/data/final-state.json | 실측 근거 + 최종 저장본 | gpt-6-astra (권장) xhigh (권장) | 제출 링크·재실행·관측 한계·해시 확인 | /root |
| PP01 | .agent-monitor/reports/parallel-plan.md | src/types.ts + GameController; source read-only | gpt-6-astra xhigh | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-WPN | tests/weapons.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-SYN | tests/synergies.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-BOSS | tests/boss-patterns.test.ts | src/types.ts + GameController; source read-only | gpt-6-astra high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-XP | tests/progression.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-AI | tests/enemies.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-MOVE | tests/movement.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| T-CAP | tests/resource-limits.test.ts | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| P2-PAD-D | .agent-monitor/reports/gamepad-design.md | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| P2-TOUCH-D | .agent-monitor/reports/touch-design.md | src/types.ts + GameController; source read-only | gpt-5.6-sol high | 전용 Node 검사/독립 보고; 브라우저는메인 | /root |
| M02 | .agent-monitor/** except coordinator.json | 새 limits 및task.status | gpt-5.6-sol high | Python단위+Chrome화면 | /root |
| M03 | .agent-monitor/** (coordinator.json 제외) | 새 limits/task schema | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-ART | src/render/** (분리 후 characters 개별 파일 제외) | 기존 renderer + character pose contract | gpt-6-astra xhigh | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-CORE | src/game/engine.ts, src/game/content.ts | src/game/p1-context.ts | gpt-6-astra high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-WEAPONS | src/game/p1-weapons.ts, tests/p1-weapons.test.ts | updateP1Weapon/onP1ProjectileHit + P1Context | gpt-6-astra high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-ENEMIES | src/game/p1-enemies.ts, tests/p1-enemies.test.ts | updateP1Enemy + P1Context | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-GOLEM | src/game/p1-boss.ts, tests/p1-boss.test.ts | updateP1Boss + P1Context | gpt-6-astra high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-UI | src/ui/ui.ts, src/ui/styles.css | UIHandlers + createCodex/createChallengeControls | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-CODEX | src/ui/codex.ts, src/ui/codex.css | createCodex(onClose):HTMLElement | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P2-CHALLENGE | src/ui/challenge.ts, tests/challenge.test.ts | createChallengeControls(options,onChange):HTMLElement | gpt-6-astra xhigh | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P2-PAD | src/controls/gamepad.ts, tests/gamepad.test.ts | createGamepadReader + mergeInputFrames | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P2-TOUCH | src/controls/touch.ts, src/controls/touch.css, tests/touch.test.ts | createTouchControls(root): read/clear/setEnabled/dispose | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| P1-CONTENT-TEST | tests/p1-content.test.ts | GameController/contentTier=1 | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| V-PERF-HARNESS | tests/performance.ts, tests/performance.html | __BENCH_RESULT__ Promise | gpt-5.6-sol high | 모듈 전용 검사 후 메인 고정 빌드 통합 검증 | /root |
| ART-KNIGHT | src/render/characters/knight.ts | paintKnight(ctx,frame,pose) | gpt-5.6-sol high | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| ART-MAGE | src/render/characters/mage.ts | paintMage(ctx,frame,pose) | gpt-5.6-sol high | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| ART-RANGER | src/render/characters/ranger.ts | paintRanger(ctx,frame,pose) | gpt-5.6-sol high | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| ART-PREVIEW | tests/character-preview.html, tests/character-preview.ts | actorSprite(kind,frame,pose) | gpt-5.6-sol high | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| D01-README | README.md, DEMO.md | 현재 구현과 검증 자료 | gpt-5.6-sol high | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| V-INTEGRATION | .agent-monitor/reports/integration-review.md | 소스 읽기 전용 | gpt-6-astra xhigh | 개별 검증 및 통합 후 메인 브라우저 확인 | /root |
| M04 | .agent-monitor/collector.py, .agent-monitor/assets/app.js | freshness <180s counts | gpt-5.6-sol high | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| DELIVERY-AUDIT | .agent-monitor/reports/delivery-audit.md | 원문 사양과 실제 증거 대조 | gpt-5.6-sol high | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| V-VISUAL | .agent-monitor/reports/visual-rc1-review.md | 3캐릭터 및720/1080/터치 화면 | gpt-6-astra xhigh | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| V-BOSS-VIS | tests/boss-preview.html, tests/boss-preview.ts | __BOSS_PREVIEW__ | gpt-6-astra high | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| SAVE-MODES | src/storage.ts, tests/storage-modes.test.ts | Profile.demoRecord + recordRunResult | gpt-5.6-sol high | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| UI-FIX-TOUCH | src/ui/styles.css, src/ui/ui.ts | Profile.demoRecord | gpt-5.6-sol high | 관련 단위검사 및 메인 통합 브라우저 검증 | /root |
| DASH-CORE | src/game/dash.ts, src/game/engine.ts, src/game/content.ts | Player dash charges + sequential recharge | gpt-6-astra high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| DASH-HUD | src/ui/ui.ts, src/ui/styles.css | Player dash state | gpt-5.6-sol high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| DASH-TOUCH | src/controls/touch.ts, src/controls/touch.css | setDashState(Player subset) | gpt-5.6-sol high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| DASH-TEST | tests/dash-charges.test.ts, tests/resource-limits.test.ts | GameController + dash helpers | gpt-5.6-sol high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| ENEMY-FLIGHT | src/game/enemy-projectiles.ts, tests/enemy-flight.test.ts | stepEnemyProjectile: direct/splash/null | gpt-6-astra high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| ENEMY-RANGED-CORE | src/game/engine.ts | enemy-flight impact pipeline | gpt-6-astra high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| ENEMY-SKELETON | src/game/p1-enemies.ts, tests/p1-enemies.test.ts | P1Context.addProjectile | gpt-5.6-sol high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| ENEMY-PROJECTILE-VIS | src/render/renderer.ts, src/render/effects.ts | Projectile.kind and enemy launch events | gpt-6-astra xhigh | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| ENEMY-RANGED-TEST | tests/enemies.test.ts, tests/boss-patterns.test.ts, tests/boss-preview.ts, tests/ranged-enemies.test.ts | engine and preview | gpt-6-astra high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| V-PERF-FINAL | tests/performance.ts | __BENCH_RESULT__ Promise | gpt-5.6-sol high | 관련 단위·실제 Chrome UI·정상 플레이 검증 | /root |
| FINAL-PLAY | evidence/rc3-normal-result.json, evidence/rc3-demo-result.json, evidence/final-browser-functional.json | Read-only __LRG__ + real keyboard | gpt-6-astra (권장) xhigh (권장) | 600초 일반 및 180초 시연·3회 재시작 | /root |
| FINAL-REVIEW | .agent-monitor/reports/final-review.md | RC3 source + final UI correction + evidence | gpt-6-astra xhigh | 릴리스 차단 결함과 검증 누락 판단 | /root |
| DASH-REUSE-LABEL | src/ui/ui.ts | dashReuseDelay for reuse, dashCooldown for readiness | gpt-5.6-sol high | 세 캐릭터 실제 Chrome HUD/aria 검증 | /root |
| FINAL-DOCS | README.md, DEMO.md | 확정 게임 규칙과 검증 링크 | gpt-5.6-sol high | 최종 소스 및 브라우저 결과와 문서 비교 | /root |
| M05 | .agent-monitor/collector.py, .agent-monitor/assets/app.js, .agent-monitor/tests/test_monitor.py | coordinator task decisions / historical reports / final time | gpt-5.6-sol high | 병합 충돌 회귀 및 최종 브라우저 | /root |
| DELIVERY-FINAL | .agent-monitor/reports/delivery-audit-final.md | 최종 후보 소스·실측 증거·문서 | gpt-5.6-sol high | 기존 감사6항목과 최종 설명 대조 | /root |
| PERF-RENDER | src/render/renderer.ts, .agent-monitor/reports/performance-analysis.md | 동일 엔진·콘텐츠·부하, 시각 기능 보존 | gpt-6-astra xhigh | 수정전후 같은60초 상한부하·화면비교·브라우저회귀 | /root |
| PERF-INSTRUMENT | tests/performance.ts, .agent-monitor/reports/performance-instrumentation.md | readback=0 기본 FPS / readback=1 별도진단 | gpt-5.6-sol high | 동일부하·새Canvas·단독순차 A/B와5초시간구간 | /root |
