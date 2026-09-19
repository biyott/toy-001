# 검증 결과 · Little Rune Guardians

제출 게임 소스는 `c68e8fb`입니다. 대시 충전과 적 실제 비행을 추가한 RC3(`5d30cce`), HUD 재사용 안내를 보정한 RC4(`4c34191`) 이후, 최종 변경은 **화면 렌더링 비용을 줄이는 한 파일**뿐입니다. 전투·입력·성장·저장·UI 규칙은 RC4와 동일합니다. 파일별 SHA-256은 [제출 빌드](evidence/release-build-manifest.json), [계측·미리보기 빌드](evidence/release-verification-manifest.json)에 기록합니다. 아래 실제 플레이의 버전을 구분해 적었으며, 이전 기록을 새 버전에서 다시 실행한 것처럼 표현하지 않습니다.

정상 완주·시연·재시작·입력 검증을 완료했습니다. 최대 부하에서는 개선 후에도 **60FPS 목표 미달**입니다. 정상 플레이 결과와 분리해 제한과 원시 측정을 공개합니다.

## 설치·자동 검사

| 항목 | 결과와 근거 |
|---|---|
| 게임 자동 검사 | **162/162, 43 suites 통과**. [RC3 원시 결과](evidence/rc3-unit-tests.txt). 피해·성장·모드·저장·대시·적 투사체·보스·상한·패드·터치·시드 포함 |
| 타입·프로덕션 빌드 | RC4 및 c68e8fb의 strict TypeScript와 Vite 성공. [RC4 로그](evidence/final-build.txt), [제출 재현 로그](evidence/release-clean-build.txt) |
| 깨끗한 설치 | RC2 독립 임시 디렉터리에서 `npm ci` 성공. [최초 로그](evidence/clean-install.txt). npm의 esbuild postinstall 안내가 있었으나 설치와 빌드 모두 종료0 |
| RC4 소스 재현 빌드 | RC2와 package/lockfile 불변 확인, 깨끗한 설치를 보존한 독립 폴더에 RC4 소스만 갱신해 빌드. 작업 폴더 dist와 **7/7 파일 SHA-256 일치**. [로그](evidence/final-clean-build.txt), [방법](.agent-monitor/reports/clean-install-final.md) |
| 제출 c68e8fb 재현 빌드 | RC2 깨끗한 의존성 설치 재사용, src 전체를 새 추출해 이전 파일 혼입 방지. **7/7 파일 SHA-256 일치**, 타입·프로덕션 빌드 성공. [원시 로그](evidence/release-clean-build.txt), [방법](.agent-monitor/reports/clean-install-release.md) |
| 대시보드 | 12/12 수집기 검사, HTTP·한글·필터·스크롤·새로고침·연결 중단·HTML 텍스트 안전성 확인. 상세 [.agent-monitor/README.md](.agent-monitor/README.md) |

전체 게임 검사는 RC3에서 수행했고 UI 문구 수정 뒤에는 관련 타입 검사와 실제 HUD 경로를 검사했습니다. 최종 renderer 변경은 타입·빌드·최대 부하·화면 비교·실제 입력/resize로 확인했습니다. 변경하지 않은 엔진 검사를 반복해 검증 수를 늘리지 않았습니다.

## 실제 브라우저 플레이

Linux/WSL2, Node24.14.0, npm11.18.0, Chrome151.0.7922.169. Playwright가 실제 키보드와 UI만 조작했다. `__LRG__`는 상태 복사본을 읽는 관찰용이며 게임 상태 변경, 무적, 시간 가속을 사용하지 않았다. 시뮬레이션 단위검사·고정 시각 장면·고부하 fixture와 구별한다.

| 버전·경로 | 결과 | 근거 |
|---|---|---|
| RC3 1280×720 / 기사 일반 10분 | **600.017초 승리**, 실제611.444초, 두 보스·두 조합·비행3종, 최소체력84.31, 오류0 | [결과](evidence/rc3-normal-result.json), [승리 화면](evidence/rc3-normal-result.png) |
| RC3 1280×720 / 궁수 시연 | **180초 승리**, 실제183.640초, 보스2종 처치, 포자·뼈·왕포자 모두 관측, 오류0. 조합은 분열 화살1종 | [결과](evidence/rc3-demo-result.json), [승리 화면](evidence/rc3-demo-result.png) |
| RC4 1920×1080 / 기사 시연 안내 선택 | **91.067초 패배**, 실제95.023초, 두 조합 활성, 오류0. 새로운 투사체를 예상하지 않는 기존 자동 조작 경로가 피격 누적. 승리로 집계하지 않음 | [보존 결과](evidence/final-demo1080-result.json), [패배 화면](evidence/final-demo1080-result.png) |
| RC4 1920×1080 / 투사체 회피를 포함한 조작 | **180초 승리**, 실제186.504초, 두 보스·두 조합, 최소체력62.50, 오류0 | [결과](evidence/final-demo1080-flight-aware-result.json), [승리 화면](evidence/final-demo1080-flight-aware-result.png) |
| RC4 실제 패배 후 재시작3회 | **3회 통과**. 같은 시드의 실제49.883초 패배3회, 각각 재시작0.1초/적0/투사체0/처치0/Lv1/입력listener3/RAF1. 이후 정상 진행·손상 저장 복구·설정 저장, 오류0 | [결과](evidence/final-browser-functional.json), [패배 화면](evidence/final-defeat.png) |

추가 이력: P0 실제600초·180초 완주, RC1 일반600.016초/벽시계602.907초·시연180초/182.224초 완주, RC2 시연180초/181.609초 완주를 보존한다. **이전 전투 버전 결과를 새 적 비행 규칙의 검증으로 대체하지 않았다.** RC1·RC2에는 두 조합 활성과2보스 처치가 기록돼 있다.

### 대시·입력·저장

- [최종 대시 브라우저](evidence/final-dash-browser.json): **20개 통과**, 세 캐릭터2/1/3회 및5/4/6초, Space 소비, 빠른 재사용 차단, 진행률, 추가 사용 시 충전 유지, 정지 중 동결, 한 칸 회복, 충전 대기와0.85초 재사용 문구 분리 확인. [마법사0/1 화면](evidence/final-dash-mage.png).
- [RC3 확장 브라우저](evidence/rc3-extended-browser.json): **20개 통과**, 720/1080 제목·도감, 세 캐릭터, 잘못된/0 시드, 동일 시드 출발, 패드 메뉴·이동·대시·정지·뒤로, 다중 터치 이동+대시·해제·정지.
- [Lv8 실제 성장 화면](evidence/rc3-demo-growth-level8.png): 최대칸+1 알림과 궁수0/4. 단위검사는 새 칸이 비고 이후 레벨에서 반복 증가하지 않는 경계를 검증한다.
- [모드별 저장 브라우저](evidence/rc2-save-browser.json): 일반 패배 기록 저장, 도전 패배가 일반/시연 기록에 영향을 주지 않음. RC2 시연 fixture의 일반 기록7점/12초/2승을 보존하면서 demoRecord만 저장한 [결과](evidence/rc2-demo-result.json). 이후 저장 소스는 변경하지 않았다.
- 물리 게임패드/실제 터치 기기는 미검증. 게임패드는 브라우저 standard snapshot, 터치는 Chrome 다중 pointer 에뮬레이션이다. 실제 장치 성능·진동·플랫폼별 동작을 확인했다고 주장하지 않는다.

### 화면·보스·투사체

- 적 비행 실제 플레이: [버섯 포자](evidence/rc3-demo-enemy-spore.png), [해골 뼈](evidence/rc3-demo-enemy-bone.png), [왕 포자](evidence/rc3-demo-enemy-royal-spore.png). 결과 JSON은 실제 projectile 위치·시간·종류도 보존한다.
- 왕포자는 무해한 목표 예고 뒤 날아가 접촉/착탄에서 폭발한다. 일반 버섯과 해골은 저장된 방향으로 이동한다. 단위 및 엔진 통합검사에서 발사 전 무피해, 이동 경로 충돌, 회피, 재시작·정지, 보스 예약 격리 확인.
- [캐릭터 비교](evidence/final-character-preview.png): 실제 renderer의3캐릭터×7포즈, 실제 배율0.76와 확대1.52. [두 보스4패턴](evidence/final-boss-pattern-preview.png)은 엔진 FSM이 만든 상태를 정지시킨 **시각 fixture**이며 정상 플레이나 피해 회피 성공의 증거가 아니다.
- 실제 720p 성장·플레이·보스·결과, 1080p 제목·도감·성장·결과 캡처를 확인했다. 작은 터치 가로 화면의 HUD 겹침은 RC2에서 수정했다. 대시 HUD는 화면 오른쪽 아래의 수량·슬롯·진행 막대로 표시된다.
- 독립 Astra xhigh 요청 리뷰: [.agent-monitor/reports/final-review.md](.agent-monitor/reports/final-review.md). 실제 모델 메타는 확인 불가. HUD 오표기는 재현 후 수정했고 최종20개 대시 브라우저 검사로 닫았다.

최종 렌더링 비교: [원시 결과](evidence/vignette-render-comparison.json)는 보스4장 × DPR1/1.25/2 × resize 전후, 총24개 Canvas에서 채널 최대차2/255, 평균차 최대0.437, 차이4 초과 픽셀0을 확인했습니다. 원래 그라디언트와 이미지 합성 사이의 작은 반올림 차이만 있으며 불투명도와 도형이 유지됩니다. 실제 게임의 시작·이동·대시·정지·세 해상도 resize·재개·첫 화면 복귀도 오류0으로 통과했습니다. [최종 플레이 화면](evidence/vignette-playing.png), [보스 비교 화면](evidence/vignette-boss-pattern-preview.png).

## 성능 측정

다른 플레이·설치·빌드가 끝난 뒤 720p/1080p를 각각 **60초씩 순차 실행**했습니다. 주 측정은 `getImageData`를 호출하지 않으며 각 실행은 새로운 페이지와 Canvas에서 시작합니다. [기준 결과](evidence/primary-baseline-performance.json), [제출 버전 결과](evidence/vignette-performance.json), [측정 방법](.agent-monitor/reports/performance-instrumentation.md).

호스트는 Intel Core i7-14700KF, WSL2 논리 CPU8/메모리23.47GiB, headless Chrome151, DPR1입니다. CDP `SystemInfo.getInfo`가 **Canvas2D 소프트웨어, 소프트웨어 raster/compositing, ANGLE SwiftShader**를 보고했습니다. 이 환경의 결과를 다른 장치의 GPU 성능으로 일반화하지 않습니다.

| 주 측정 버전 | 화면 | 평균 FPS | 평균 프레임 | p95 프레임 | renderer JS 평균 | 전체 JS 평균 |
|---|---|---:|---:|---:|---:|---:|
| RC4 기준 | 1280×720 | 28.209 | 35.450ms | 50.0ms | 3.009ms | 4.280ms |
| RC4 기준 | 1920×1080 | 17.224 | 58.057ms | 66.7ms | 3.117ms | 5.119ms |
| 제출 c68e8fb | 1280×720 | **28.909** | 34.592ms | 50.0ms | 3.042ms | 4.312ms |
| 제출 c68e8fb | 1920×1080 | **18.167** | 55.044ms | 66.7ms | 3.074ms | 4.967ms |

동일한 fixture에서 관측 평균 FPS는 약2.5%/5.5% 증가했지만 **단일 순차 비교이며 통계적 개선율이나 모든 환경의 향상을 보장하지 않습니다. 60FPS 목표는 달성하지 못했습니다.** 제출 버전은 불투명 Canvas에서 중복 지우기를 제거하고, 변하지 않는 비네트를 같은 해상도로 재사용합니다. 위험 표시·판정·콘텐츠·DPR·적 상한을 줄여 얻은 수치가 아닙니다. 추가 화면 캐시는 1080p DPR1 약7.91MiB, DPR2 약31.64MiB이며 브라우저 전체 메모리는 별도입니다.

매 실행에서 적180/투사체300(플레이어220+적80)/픽업260을 유지했습니다. 기본 공격 영역10개 외에 실제 적 FSM이 만든 영역이 추가되므로, 기준은720p18–91/1080p21–86개, 제출 버전은720p20–91/1080p22–84개였습니다. **영역 수가10개로 고정된 부하가 아닙니다.** 모든 주 측정은 runtime/page 오류0입니다. 5초 구간별 통계와 실제 개체 범위를 JSON에 보존했습니다.

이 시험은 실제 엔진·renderer·HUD를 사용하되 개체와 높은 체력을 명시적으로 유지하는 **합성 최대 부하**입니다. 저속 적 탄을 플레이어 주변으로 되돌려 비행·충돌 경로를 반복합니다. 일반 플레이 증거가 아니며 정상 난이도에 이 상태를 사용하지 않습니다. 엔진과 렌더러의 JS 시간은 화면의 실제 그리기·합성 대기 시간을 포함한 FPS와 구분합니다.

정상 RC3 10분 플레이의 마지막3600프레임은 평균60.002FPS/p95 16.7ms, RC4 1080p 시연은55.344FPS/p95 33.3ms였습니다. 이 표본은 적 수가 적고 캡처·관찰이 있는 실제 플레이이므로 위 단독 최대 부하 수치와 합쳐 집계하지 않습니다.

### 제외한 후보와 진단 기록

- 공격 영역 캐시 후보 `b122106`은 주 측정에서720p27.491/1080p15.509FPS로 기준보다 느렸습니다. 특히1080p renderer JS가40.516ms로 증가했습니다. **최종 소스에서 완전히 제거**했고 원시 결과와 비교 빌드는 보존했습니다. [결과](evidence/primary-optimized-performance.json), [분석](.agent-monitor/reports/performance-analysis.md).
- 초기 readback 포함 진단은 RC4 26.968/16.301FPS, 영역 캐시28.117/15.438FPS였습니다. [기준 진단](evidence/final-performance.json), [캐시 진단](evidence/optimized-performance.json). 픽셀 읽기는 그리기 큐 동기화나 백엔드 선택에 영향을 줄 수 있어 기본 측정에서 분리했습니다. 진단 수치를 주 FPS와 합치거나 순수 GPU 시간으로 해석하지 않습니다.
- readback을 제거한 주 측정에서도 지연이 지속됐고 CDP는 소프트웨어 경로를 보고했습니다. 따라서 **픽셀 읽기만이 낮은 FPS의 원인이라고 결론 내리지 않습니다.**

남은 성능 개선 우선순위는 실제 GPU가 활성화된 사용 환경에서 같은 fixture를 재측정하고, Canvas raster/compositor 프로파일로 가장 큰 비용을 확인하는 것입니다. 이 목표 미달을 기능 검사 통과나 완료 작업 비율로 감추지 않습니다.

## 실패 이력과 수정

- 최초 P0 정상 자동 플레이는 벽에 몰리는 조작으로145초에 패배했다. 소스 규칙을 낮추지 않고 장애물 회피 조작으로600초 재검증했다. `p0-normal-*` 및 `p0-normal-retry-*` 보존.
- 최초 재시작 검증 스크립트가 요구사항3회보다 한 번 많은 네 번째 패배를 요구한 오류를 수정했다. 기존 실패와 수정 후3회 결과를 구분했다.
- RC1 확장 터치 pause 첫 시도는 다음 프레임 처리 전에 확인해 실패했다. 실제 phase 전환을 기다리도록 검사만 수정했고 통과했다. [첫 시도](evidence/rc1-extended-browser-attempt1.json) 보존.
- 초기 성능 호출은 완료값이 Promise인 것을 잘못 기다려30초 timeout했다. 최종 스크립트는 Promise 존재를 확인하고 실제 완료값을 await한다. 측정값이 없었던 시도를 성능 통과로 표시하지 않는다.
- RC3 재시작 첫 시도는 적을 쫓는 조작이 사수를 처치하고 조준된 탄을 피하면서100초 안에 패배하지 않아 `defeat-1` 검사 실패. [진행 기록](evidence/rc3browser-functional-progress.json) 보존. 정지한 플레이어를 실제 적 공격에 노출하는 조작으로 바꿔3패배/3재시작을 검증한다. 게임 상태는 변경하지 않는다.
- 1080p 첫 안내 시연의 실제 패배는 삭제하지 않았다. 추가 검증은 자동 조작에 실제 적 비행의 예상 경로를 피하는 방향 선택을 추가했다. 게임 밸런스/플레이 속도/피해를 변경하지 않았다.

- M05 첫 임시 대시보드 검사에서 검사 코드가 존재하지 않는 reportConflicts 필드를 읽어 실패했다. 실제 API의 conflicts와 DOM의 .agent를 확인해 검사 코드를 수정했고 집계·충돌출처·필터 유지 검증을 통과했다. [시도 기록](evidence/dashboard-m05-attempt1.json), [재검증](evidence/dashboard-m05-browser.json).

## 한계·재현·운영 기록

- 검증 브라우저는 이 환경의 데스크톱 Chrome. Safari/Firefox, 실물 모바일과 물리 패드는 미검증이다. 효과음 생성·음소거·설정 상태는 확인했으나 실제 스피커의 음질 평가는 수행하지 않았다.
- 정상 플레이의 관찰 기반 자동 조작은 사용자 조작 전체를 대표하지 않는다. 모든 무작위 시드에서 무조건 승리함을 보장하지 않는다.
- 대시보드는 메인과 생성한20하위 에이전트를 관찰한다. 20은 누적 생성 성공 수. 현재 실행, 오래된 실행 관측, 역할별 실행, 작업 준비/검토/통합은 별도 집계한다. 사용자1000·설정1000·도구 고지 총1001을 구분하고 실제 최대 동시 한도는 스트레스 테스트하지 않았다.
- 실제 모델/추론 메타, 열린/닫힌 스레드 수, 프로젝트 비용·토큰은 미확인이다. 계정 전체 사용량을 프로젝트 비용처럼 표시하지 않는다.
- [RUNBOOK.md](RUNBOOK.md)에 재현 명령, 서버·고정 버전, 종료/재실행 방법이 있다. 최종 대시보드 전환 후 상태와 이벤트를 보존한다.

## 최종 저장과 인계

2026-09-19 13:21:16 UTC(한국시간22:21:16)에 직접 상태를 관측해 최종 대시보드를 저장했습니다. 시작부터 약1시간39분이며3시간 마감 이전입니다. 하위 에이전트 누적생성20개·실행0개·완료20개, ready/running/blocked/review 작업0개·통합66개를 보존했습니다. **통합 작업66개는 성능을 포함한 모든 품질 목표 PASS를 뜻하지 않습니다.** 메인은 저장 당시 실행 중으로 관측했으며 종료·스레드 개폐를 추정하지 않았습니다.

대시보드는 `--view-final` 읽기 전용 서버로 다시 열었습니다. [최종 브라우저 검사](evidence/dashboard-final-browser.json)는 통합 집계·관측 구분·필터 유지·시간 동결·새로고침을 통과했고 오류0입니다. [최종 상태](.agent-monitor/data/final-state.json), [이벤트](.agent-monitor/data/events.json), [종료 기록](evidence/finalization.json), [운영 서버](evidence/server-processes.json)를 보존합니다. 게임과 대시보드 HTTP 응답도 확인했습니다.

재개할 때는 과거 저장본을 현재 실행 수로 사용하지 않고 새 관측을 수집합니다. 알려진 성능 한계의 다음 조사는 실제 GPU가 활성화된 환경의 동일 부하 측정이며, 실물 입력 장치·다른 브라우저 검증도 별도입니다. 재실행 명령은 RUNBOOK.md에 있습니다.
