# 인터페이스와 파일 소유권
공유 디렉터리, 브랜치 전환 없음。한 파일 한 작성자。

| 범위 | 담당 |
|---|---|
| 루트 문서, 설정, 의존성, 공용 타입, 최상위 통합 | 메인 |
| .agent-monitor/** (coordinator.json 제외) | monitor |
| .agent-monitor/reports/coordinator.json | 메인 |
| .agent-monitor/reports/architecture-design.md | architecture |

브라우저 조작은 메인만 수행. 런타임 API는 A01 판단 후 메인이 확정.

## 게임 공용 계약 v1 (메인 작성, 구현 배정 전 고정)
- 기술: TypeScript strict + Vite, Canvas2D 절차적 2.5D 디오라마. 외부 게임 엔진/아트 의존 없음.
- 모듈: src/types.ts 공용타입, src/main.ts 통합, src/input.ts / src/audio.ts / src/storage.ts 메인 소유.
- src/game/** 전투 담당: createGame(options): GameController, content.ts 정적 콘텐츠.
- src/render/** 렌더링 담당: createRenderer(canvas): Renderer.
- src/ui/** UI 담당: createUI(root, handlers): UI. UI 이벤트는 main으로만 전달.
- 모든 게임시간은 step(dt)에서만 갱신. main에서 dt<=0.05, 비활성탭과 pause에서 동결.
- world 좌표 x/y는 화면 이동 방향과 같음. feet 기준으로 y정렬, height는 시각표현만 위로 이동. 월드 중심 (0,0), 경계 halfWidth=1000/halfHeight=680. 카메라 player 추적.
- phase: title/playing/paused/levelup/victory/defeat. mode: normal(600s)/demo(180s)/challenge(600s).
- character: knight/mage/ranger. weapons: sword/arrow/spirit/lightning/frost/fireball.
- enemyKind: slime/mushroom/goblin/skeleton/bat/beetle/mushroomKing/golem.
- state 읽기는 renderer/UI만, 상태 변경은 GameController.step/dispatch에서만.
- InputFrame: moveX,moveY(-1~1),dashPressed,pausePressed. 키 입력/게임패드/터치는 main이 통합하며 대시 press edge 소비.
- GameCommand: start(options)/pause/resume/selectUpgrade(id)/restart. 설정은 메인 profile 처리.
- GameEvent: id,type,x,y,value?,text?,weapon?,kind? (타격·처치·대시·레벨업·사격·결과·보스), drainEvents()가 큐를 비움. 오디오와 렌더러가 같은 배열을 각각 한번 소비.
- Profile: version=1,bestScore,bestTime,wins,settings:{muted,reducedMotion}. 저장은 스키마검사 및 try/catch, 손상시 기본값.
- 공용타입 변경은 메인에게 요청. 작업자 간 상대 파일 수정 금지.
- 브라우저와 실제플레이: main 단독. qa는 테스트 코드/보고만 작성, 자체 브라우저 실행은 별도 승인 이후.

## 실제 배정
- src/game/**: /root/combat
- src/render/**: /root/architecture
- src/ui/**: /root/ui
- tests/**: /root/qa
- 나머지 src/** 및 scripts/**: /root
공용타입은 src/types.ts가 상세 규약이다. 단일 RAF 고정1/60step, hidden/blur시 pause.
