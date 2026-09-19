# DELIVERY-AUDIT — 요청·사양·구현·제출물 대조

감사 시각: 2026-09-19T12:28:17Z. 읽기 전용으로 `PROJECT_REQUEST.md`, 최신 `PARALLEL_POLICY.md`/`SPEC.md`, `README.md`, `DEMO.md`, 게임 소스, 루트 운영 문서와 `evidence/`를 대조했다. 브라우저·전체 테스트·빌드는 새로 실행하지 않았다.

## 결론

P0/P1/P2의 요구 수량과 기능 모듈은 현재 소스에 모두 존재한다. P0 3무기·3일반적·8개 이상 성장·버섯 왕, P1 총 6무기·6일반적·16성장·2보스·3캐릭터·도감, P2 시드 도전·게임패드·터치가 구현되어 있고 RC1 단위 결과는 `128/128`이다. 제출 전 남은 핵심은 현재 통합 빌드의 완주/성능 근거, 실제 실행 URL 안내, 모드별 기록 정책 불일치, 운영 문서와 최종 대시보드의 최신화다.

## 제출 전 해결할 항목

### 1. [높음] 시연 문서의 고정 포트가 현재 RC1이 아닌 이전 서버를 열 수 있음

- `DEMO.md:15`는 `http://127.0.0.1:4174/`를 직접 열라고 한다.
- 현재 RC1 브라우저 근거인 `evidence/rc1-extended-browser.json`은 실제 URL이 `http://127.0.0.1:4177`이라고 기록한다. `4174`에는 앞서 검증한 동결 P0 서버가 사용됐으므로, 현재 환경에서 안내대로 하면 P1/P2가 없는 이전 빌드를 열 가능성이 크다.
- `README.md:14`는 개발 서버에 대해서만 “포트가 사용 중이면 터미널 주소 사용”을 명시하고, preview 단락과 DEMO에는 같은 주의가 없다. Vite는 충돌 시 다음 포트로 이동한다.
- 대시보드도 `4310` 충돌 시 `4311+`를 찾지만 `.agent-monitor/README.md`의 curl 예시는 계속 `4310`을 사용한다. 실제 URL은 `data/runtime.json`이 기준이다.

조치: preview와 DEMO 모두 `npm run preview`가 출력한 실제 URL을 열도록 쓰고, 대시보드는 `runtime.json`의 URL을 사용하도록 명시한다. 최종 대시보드 링크도 현재 coordinator의 `4173` 고정 링크 대신 최종 preview 실제 주소로 바꾼다.

### 2. [높음] 최종 통합 RC1 정상/시연 완주 근거가 감사 시점에는 미완료

- `artifacts/rc1-build`과 `evidence/rc1-build-manifest.json`은 commit `2a892bb...` 및 파일 해시를 보존했고, `rc1-build.txt`와 `rc1-unit-tests.txt`는 빌드와 128개 테스트 통과를 기록한다.
- 그러나 감사 시점의 `rc1-demo-progress.json`은 게임 150.7초, `rc1-normal-progress.json`은 150.48초까지만 기록되어 둘 다 `final`이 없다. demo는 두 조합과 골렘 등장까지 도달했지만 결과 화면은 아직 없다. normal은 보스 시점 전이다.
- P0 동결 빌드의 `p0-demo-result.json`과 `p0-normal-retry-result.json`은 각각 3분/10분 승리를 증명하지만, P1 두 번째 보스와 P2 입력이 통합된 RC1 완주의 근거로 전용할 수 없다.

조치: 진행 중인 RC1 demo와 normal을 결과까지 보존하고, 두 보스의 등장·처치, 제한시간, 최종 phase, 오류 0, 실제 벽시계 시간, 선택한 캐릭터/성장과 빌드 식별자를 결과 JSON과 캡처에 남긴다. 실패하면 실패 기록을 보존하고 알려진 문제로 분류한다.

### 3. [높음] 대표 고부하 성능의 최종 측정 산출물이 없음

- `artifacts/p0-performance`와 테스트 harness는 있으나 `evidence/`에는 환경·개체 수·측정 구간·평균 FPS/프레임 시간·p95 또는 1% low를 묶은 성능 결과가 없다.
- RC1 플레이 progress의 `frameTimes`는 원자료가 될 수 있지만 아직 진행 중이고 대표 고부하 구간과 개체 수를 연결한 요약이 없다. 따라서 사용자 기준의 “대표 고부하 전투에서 측정, 60fps 목표”를 판정할 수 없다.

조치: 최종 빌드에서 측정 환경, viewport, 측정 시간, 적/투사체/픽업 등 부하, 평균과 tail 지표를 한 결과 파일로 보존하고 목표 미달도 그대로 기록한다.

### 4. [중간] 채택된 모드별 기록 정책과 실제 저장이 다름

- 채택된 A01 설계 `.agent-monitor/reports/architecture-design.md:214`는 normal/demo/challenge 기록을 구분하고 demo 기록이 normal 최고 기록을 덮지 않게 한다.
- 실제 `src/main.ts:85-88`은 `challenge`만 저장에서 제외하고 normal과 demo를 같은 `Profile.bestScore/bestTime/wins`에 저장한다. `src/types.ts:61`에도 모드 구분 필드가 없다.
- `README.md:34`는 challenge만 일반 기록을 덮지 않는다고 설명하여 현재 코드와는 일치하지만, 채택 설계와는 불일치한다. 빠른 demo의 점수나 승리가 일반 기록을 올릴 수 있다.

조치: 남은 시간과 호환성 비용을 보고 모드별 저장으로 고치거나, 확정 사양에서 이 설계 결정을 철회하고 알려진 범위 변경으로 명시한다. 현재 상태를 세 모드 분리 완료로 주장하면 안 된다.

### 5. [중간] 운영·추적 문서가 통합 상태보다 뒤처짐

- `PLAN.md:12-43`은 G01/G02 통합 pending, P1/P2 대부분 in_progress 또는 미배정, V01/V02/D01 pending으로 남아 있다.
- `STATUS.md`는 “P1·P2 구현 중”, 단위 75/75, 게임 URL 4173을 기록하지만 현재 근거는 RC1 빌드, 128/128, 실제 preview 4177이다.
- `AGENT_LOG.md` 표에는 최초 2명만 있고 coordinator에는 누적 하위 20명이 있다. 사용자 최종 산출물인 에이전트별 작업·요청 모델/강도·통합 결과를 루트 기록에서 확인할 수 없다.
- `RUNBOOK.md`는 6줄 수준으로 대시보드 문서만 위임하며 게임 preview의 실제 포트 확인, 최종 빌드/근거 고정, 실패 후 복구·재검증 절차가 없다.

조치: 최종 판정 뒤 PLAN/STATUS/AGENT_LOG/RUNBOOK을 실제 상태와 coordinator 기준으로 동기화한다. 실제 모델/강도는 계속 미확인으로 두고 요청값과 섞지 않는다.

### 6. [중간] 최종 대시보드 스냅샷은 아직 중간 상태

- 현재 `.agent-monitor/data/state.json`은 phase가 “P1·P2 독립 구현 및 작은 단위 통합”, agent 상태 20개가 stale, task 11개 running이며 mode가 `live`다.
- `.agent-monitor/data/final-state.json`도 `mode: live`, `finalizedAt: null`인 중간 저장본이다. 최종 산출물로 제시할 상태가 아니다.

조치: 실제 에이전트 상태를 마지막으로 재관측하고 작업의 구현/검증/통합을 분리해 갱신한 뒤 coordinator를 final로 전환한다. 게임 실제 URL, 대시보드 실제 URL, 빌드·검증·캡처 링크와 알려진 문제를 보존한다. 종료를 관측하지 못한 스레드는 임의로 closed 처리하지 않는다.

## 시연·조작 안내 정확성

### 정확함

- DEMO의 로완 기준 레벨 2 활 → 3 정령 → 4 관통 → 5 분열 → 6 연쇄 경로는 랜덤 카드를 고정 카드처럼 잘못 쓴 것이 아니다. `engine.ts:564-576`은 전체 후보를 섞은 뒤에도 레벨 2에 `arrow, spirit`, 레벨 3에 `spirit, arrow`, 레벨 4~7에 미획득 `pierce, split, chain`을 앞에 다시 배치한다. 로완이 표의 카드를 선택하면 다음 단계 카드가 실제 3개 선택지에 보장된다. DEMO의 “우선 제시” 표현이 코드와 맞는다.
- 일반/시연 600/180초, 버섯 왕 480/120초, 골렘 540/150초, 두 보스+제한시간 승리, 시간 초과 후 연장전 설명이 엔진과 일치한다.
- 키보드 WASD/방향키, Space/Shift 대시, Esc/P 일시정지, 숫자 1~3 성장 선택은 입력 코드와 일치한다.
- 게임패드 스틱/D-pad, A/LT/RT 대시, Start pause, 메뉴 A/B와 터치 조이스틱/대시/Ⅱ 안내는 구현과 일치한다. `rc1-extended-browser.json` 최종 실행은 20개 브라우저 검사를 모두 통과했다.

### 반드시 함께 밝혀야 함

- `rc1-extended-browser-attempt1.json`에는 touch pause가 playing으로 남은 실패가 보존되어 있고, 재실행 `rc1-extended-browser.json`은 같은 항목을 포함해 통과했다. 최종 검증에는 최초 실패와 성공 재시도를 구분하고, 수정 또는 harness 안정화 이유를 기록해야 한다.
- 위 브라우저 검사는 synthetic touch와 `navigator.getGamepads` snapshot이다. 파일의 method도 물리 컨트롤러/기기 미검증을 명시한다. README가 이미 VALIDATION으로 확인을 미룬 만큼, 최종 문서에는 물리 게임패드와 실제 터치 기기는 “미검증”이라고 명시해야 한다.

## 범위별 최종 판정

| 범위 | 구현 대조 | 제출 전 남은 근거 |
|---|---|---|
| P0 | 필수 흐름·콘텐츠·HUD·사운드·저장·2조합·3분 모드 구현. 동결 P0 실플레이 승리 근거 존재 | RC1 변경 뒤 핵심 흐름 회귀를 demo/normal 최종 결과로 닫기 |
| P1 | 6무기·6일반적·16성장·2보스·3캐릭터·도감 구현 및 단위 통과, 캐릭터/도감 브라우저 확인 | RC1 실제 플레이에서 P1 적·무기·두 보스·승리 결과 보존 |
| P2 | 시드·게임패드·터치 구현, 단위 및 synthetic browser 최종 통과 | 물리 장치 미검증 공개; touch pause 최초 실패/재시도 이력 설명 |

## 최종 검증 문서에 필요한 근거

`VALIDATION.md` 작성 시 파일 부재만 적지 말고 다음을 연결하면 된다.

1. RC1 source commit과 `rc1-build-manifest.json`, build/test 로그.
2. RC1 demo/normal 최종 결과와 대표 title/growth/combat/boss/result 캡처.
3. `browser-functional.json`의 기본 기능·3회 재시작·저장 복구와 RC1 extended 검사의 P1/P2 결과 및 최초 실패 이력.
4. 대표 고부하 성능의 환경·부하·시간·평균/tail 수치.
5. 자동 검증과 물리 장치 미검증을 분리한 입력 장치 표.
6. 알려진 문제 또는 승인된 범위 변경: 모드별 기록 정책, 실제 포트 선택, 남은 미검증 항목.
