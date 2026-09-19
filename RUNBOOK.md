# 실행·검증·복구

현재 정책은 [PARALLEL_POLICY.md](PARALLEL_POLICY.md)입니다. 사용자 하위 상한1000 안에서 독립 ready 작업을 즉시 배정하며, 역할별·단계별 인원 제한은 없습니다. 최초 시작11:42:37 UTC, 마감14:42:37 UTC(한국시간23:42:37)입니다.

## 게임 실행

검증 환경: Linux, Node24.14.0, npm11.18.0, Python3.12.3, Chrome151.0.7922.169.

```sh
npm ci
npm run dev
```

개발 기본 주소 `http://127.0.0.1:4173/`. 제출용 실행:

```sh
npm run build
npm run preview -- --strictPort
```

프로덕션 주소 `http://127.0.0.1:4174/`. 포트가 점유되어 있으면 기존 프로세스를 임의로 종료하지 말고, 해당 게임 서버가 맞는지 확인하거나 `npm run preview -- --port 4180 --strictPort`처럼 다른 포트를 선택합니다. 외부 공개 없이127.0.0.1에만 바인딩합니다.

## 검증 재현

```sh
npm test
npm run typecheck
npm run build
GAME_URL=http://127.0.0.1:4174 node scripts/play-session.mjs normal local-normal
GAME_URL=http://127.0.0.1:4174 CHARACTER=ranger node scripts/play-session.mjs demo local-demo
GAME_URL=http://127.0.0.1:4174 EVIDENCE_LABEL=local node scripts/extended-browser.mjs
GAME_URL=http://127.0.0.1:4174 EVIDENCE_PREFIX=local- node scripts/smoke-browser.mjs
GAME_URL=http://127.0.0.1:4174 node scripts/save-browser.mjs
GAME_URL=http://127.0.0.1:4174 EVIDENCE_LABEL=local node scripts/dash-browser.mjs
GAME_URL=http://127.0.0.1:4174 VIEWPORT=1080 DEMO_GUIDE=1 node scripts/play-session.mjs demo local-demo1080
```

스크립트는 시스템 Chrome(`/usr/bin/google-chrome`)을 사용합니다. 다른 환경은 스크립트의 실행파일 경로를 설치된 Chrome에 맞춥니다. `play-session`은 실제 시간에 맞춰 UI와 키보드만 조작하고 읽기 전용 관찰 API로 상태를 읽습니다. 일반 모드는 약10분, 시연은 약3분과 성장 선택 시간이 필요합니다. 무적·시간 가속·게임 상태 변경은 하지 않습니다. `smoke-browser`는 움직이지 않는 플레이어를 실제 적 공격에 노출해 패배와 재시작을 3회 확인합니다.

보스/캐릭터 고정 시각 장면과 고부하 계측은 정상 플레이 증거와 별도입니다.

```sh
npx vite build --config scripts/verification-vite.config.ts
python3 -m http.server 4175 --bind 127.0.0.1 --directory artifacts/verification-build
```

- `/tests/character-preview.html`: 실제 배율과 확대 포즈.
- `/tests/boss-preview.html`: 실제 엔진 FSM의 두 보스4패턴 고정장면.
- `/tests/performance.html?seconds=60&tier=1`: 상한 수준 합성 부하. `window.__BENCH_RESULT__` Promise로 결과를 읽습니다.

성능 검증은 다른 브라우저 플레이·설치·전체 빌드가 끝난 후 `VERIFICATION_URL=http://127.0.0.1:4175 EVIDENCE_LABEL=local node scripts/performance-browser.mjs`로 단독 실행합니다. 720p와1080p 각각60초를 순서대로 측정합니다. 주 성능 측정은 픽셀 readback을 하지 않습니다. `READBACK_PROBE=1`은 별도 진단 실행에서만 지정하며, 이 진단값을 주 FPS와 합치지 않습니다. 5초 구간별 통계와 CDP 그래픽 백엔드를 함께 기록합니다. renderer JS 시간과 픽셀 동기화 근사치를 실제 GPU 실행 시간처럼 해석하지 않습니다.

## 버전과 파일 소유권

검증 빌드는 `artifacts/p0-build`, `artifacts/rc1-build`, `artifacts/rc2-build`, `artifacts/rc3-build`, `artifacts/rc4-build`에 각각 고정했습니다. manifest의 SHA256과 sourceCommit을 근거로 결과를 연결합니다. RC3(`5d30cce`)는 대시 충전과 적 실제 비행을 추가한 버전입니다. RC4(`4c34191`)는 HUD 재사용 대기 문구·aria를 수정했고, 대시 브라우저·1080p 시연·재시작 검증을 완료했습니다. 제출 `dist/`와 `artifacts/release-build`는 `c68e8fb`입니다. RC4 대비 renderer 한 파일만 변경해 고정 비네트를 재사용하고 중복 지우기를 줄였으며 전투·입력·저장·UI 규칙은 같습니다. `evidence/release-build-manifest.json`이 제출 산출물 해시 기준입니다. 새 렌더링은 동일 최대 부하 계측과 DPR1/1.25/2·resize 화면 비교, 실제 입력 경로로 검증했습니다. 60FPS 최대 부하 목표는 미달이며 VALIDATION.md에 결과를 명시했습니다.

최대 부하 비교의 기준 빌드는 `artifacts/performance-baseline`, 제외한 영역 캐시 후보는 `artifacts/zone-cache-verification`, 제출 계측 빌드는 `artifacts/verification-build`에 보존합니다. 각각 별도 정적 서버에서 열 수 있습니다. `scripts/render-comparison.mjs`는 `BASELINE_URL`, `CANDIDATE_URL`, `GAME_URL`, `EVIDENCE_LABEL`을 받아 고정 장면의 화면 비교와 실제 입력·resize를 확인합니다.

브라우저 조작은 메인이 맡습니다. 독립 작업자는 자기 파일만 수정하고, 공용 타입·최상위 연결·최종 통합은 메인이 맡습니다. 구현 완료/검토/통합은 구분합니다. 최종 결과는 [VALIDATION.md](VALIDATION.md)에 기록합니다.

## 대시보드와 서버 중지

`http://127.0.0.1:4310/`의 운영법, 최종 저장본 재열람, 범위 및 한계는 [.agent-monitor/README.md](.agent-monitor/README.md)를 따릅니다. 원본 도구 조회는 메인이 수행하고 수집기에 전달합니다. 화면2초 갱신은 런타임 관측이 아닙니다.180초 넘은 실행 관측은 현재 확인 실행 수에서 제외됩니다.

자신이 실행한 터미널의 서버는 Ctrl-C로 중지합니다. 이번 실행이 유지한 서버의 PID와 용도는 `evidence/server-processes.json`에 기록합니다. PID는 재사용될 수 있으므로 중지 전 명령줄·작업 디렉터리가 기록과 일치하는지 확인합니다. 포트만 보고 다른 프로세스를 종료하지 않습니다.

재개 시 STATUS,PLAN,VALIDATION과 Git 변경을 읽고 실제 에이전트·프로세스를 다시 관측합니다. 과거 dashboard snapshot을 현재 실행 수로 재사용하지 않습니다. 저장 손상은 기본값으로 복구되고, 기존 v1 기록·설정은 유지하며 시연 기록만 별도 추가됩니다.
