# D-CHALLENGE — P2 시드 도전 ready 계약

작성: /root/parallel_planner / researcher / Astra xhigh. 2026-09-19. 담당 파일은 이 보고서뿐이며 게임 소스·공용타입·테스트를 수정하지 않았다. 추가 에이전트를 생성하지 않았다. 근거: 현재 src/types.ts, src/main.ts, src/input.ts, src/storage.ts, src/game/engine.ts, src/ui/ui.ts/styles.css, tests/engine.test.ts/storage.test.ts. 소스가 병렬 수정 중이므로 아래 함수명/의미를 계약 기준으로 삼고 줄번호는 고정하지 않는다.

## 배정과 게이트

메인 보고에 따르면 PP01 즉시 후보4개 생성으로 누적 하위16에 도달했다. 실제 실행16 동시 유지 미달 원인은 작은 테스트의 빠른 완료, P0 실제 정상승리 게이트, P1 hooks 계약 대기, 기능 중복 배정 회피다. 누적 생성16을 동시 실행16으로 표시하지 않는다.

**이 문서는 설계 완료이며 구현은 P1 통합·검증 뒤 메인 배정 전까지 blocked다.** 날짜 기반 일일도전·온라인 순위·공유 서버·추가 난이도·리플레이 저장을 추가하지 않는다. 기존 GameMode='challenge', duration=600초, seeded RNG와 P1 콘텐츠를 그대로 활용한다.

## 권고 결론

사용자가 입력하는 **0…4294967295의 10진수 시드**를 사용한다. 자유문자열 해시는 넣지 않는다. 숫자 시드는 입력·공유·결과 확인이 간단하며 Unicode 정규화/해시 버전/충돌 설명을 새로 만들 필요가 없다.

선택한 캐릭터와 현재 활성 contentTier를 유지한 채 mode='challenge', seed=입력값으로 시작한다. 일반 임무와 같은10분 규칙이며 시드 때문에 추가 보상이나 능력 보정이 생기지 않는다. 결과에서 시드와 캐릭터를 확인하고 같은 시드로 재시작할 수 있으면 P2 범위의 도전 모드는 충족된다.

## 시드 파서 확정 권고

순수 함수 `parseChallengeSeed(raw: string)`의 결과는 다음 중 하나다.

```ts
type SeedParseResult =
  | { ok: true; seed: number; canonical: string }
  | { ok: false; message: string };
```

처리 순서:

1. 입력 앞뒤 공백만 trim한다.
2. ASCII 숫자만1–10자리인 `/^[0-9]{1,10}$/`인지 확인한다.
3. Number로 변환하고 정수이며0 이상4294967295 이하인지 확인한다.
4. 성공 시 seed는 그 숫자, canonical은 String(seed)다. 검증 전에 `>>>0`으로 잘못된 입력을 접어 유효하게 만들지 않는다.

| 입력 | 결과 |
|---|---|
| `0`, `0000000000` | 성공, seed0, canonical `0` |
| ` 0042 ` | 성공, seed42, canonical `42` |
| `4294967295` | 성공, uint32 최댓값 |
| 빈 문자열/공백만 | 실패: `0부터 4294967295까지 숫자를 입력해 주세요.` |
| `4294967296`, 11자리 이상 | 실패, 범위 안내 |
| `-1`, `+1`, `1.5`, `1e3`, `0x10`, `1 2`, `Infinity`, 전각숫자, 한글 | 실패, 범위 안내 |

`seed || fallback`은 금지한다.0은 유효 시드다. UI에 입력 중인 원문은 보존하고 **성공적으로 시작할 때만** canonical로 바꾼다. 매75ms UI render마다 입력을 정규화하거나 덮어쓰지 않는다.

## 사용자 흐름과 UI 소유권

시작 화면의 기존 일반/3분시연 버튼 근처에 접을 수 있는 작은 `시드 도전 ·10분` 영역을 둔다. 숫자 필드, 짧은 설명, 시작 버튼만 필요하다. 별도 모달을 만들 필요는 없다.

- 설명: `같은 시드와 캐릭터로 같은 출발 조건에 도전하세요.`
- 명시적 label: `도전 시드`; input type=text, inputmode=numeric, autocomplete=off. number input의 지수/부호/소수 해석을 쓰지 않는다.
- 초기값은 생성 시 전달받은 유효한 현재 options.seed다. 닫기/열기와 캐릭터 변경으로 사용자의 작성 중 값을 지우지 않는다.
- 잘못된 값은 입력 아래 한 줄로 표시하고 aria-invalid/aria-describedby를 연결한다. 잘못된 상태에서 시작하지 않고 입력 포커스를 유지한다.
- Enter 또는 시작 버튼으로 같은 submit 경로를 사용한다. 연속 이벤트로 start가 두 번 dispatch되지 않게 form submit 한 곳만 처리한다.
- 시작 순간 getOptions()로 **최신** 캐릭터/contentTier를 읽는다. 컴포넌트 생성 당시 값으로 고정하지 않는다.
- 성공 콜백은 `onStart({ ...getOptions(), mode:'challenge', seed })`다. UI 소유자가 handlers.setOptions/command 연결을 한 곳에서 수행한다.
- 도전 중/일시정지/결과에는 mode가 도전임을 구별하고 시드를 읽을 수 있게 한다. 최소 결과에 `도전 시드`를 표시하고 재시작 버튼을 `같은 시드로 다시 도전`으로 표기한다.
- 결과에 캐릭터 이름도 함께 표시한다. 비교/버그 재현 자료에는 app version/contentTier를 포함하되 별도의 긴 기술문구를 게임 흐름에 붙이지 않는다.
- 시드 문자열은 label/value/textContent로만 취급한다. 공유 링크나 클립보드 기능은 필수가 아니며 자동 복사 실패 대처를 새 범위로 만들지 않는다.

현재 title-panel은 max-height만 있고 내부 넘침 처리가 없다. P1 캐릭터 선택·도감과 결합한720p 높이에서 검사해야 한다. 독립 challenge CSS에는 `.challenge-panel*` 클래스만 추가하고 공통 title-panel/style.css는 기존 UI 담당이 단독으로 조정한다. 필요하면 패널 내부 스크롤 또는 기존 간격 조정으로 해결하며 화면 밖으로 버튼을 밀어내지 않는다.

## 제안 모듈 API와 파일 배정

가장 작은 작업은 한 implementer가 다음 신규 파일을 맡는 것이다.

- `src/challenge.ts`: `parseChallengeSeed`와 결과 타입. 브라우저·엔진 의존성 없는 순수 파서.
- `src/ui/challenge-panel.ts`, `src/ui/challenge-panel.css`: 독립 DOM 컴포넌트.
- `tests/challenge.test.ts`: 숫자 경계/정규화와 challenge 옵션/결정성의 필요한 회귀.

```ts
interface ChallengePanelOptions {
  initialSeed: number; // 유효 uint32; 생성 때만 읽음
  getOptions(): GameOptions;
  onStart(options: GameOptions): void;
}
interface ChallengePanel {
  element: HTMLElement;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}
// createChallengePanel(options: ChallengePanelOptions): ChallengePanel
```

setEnabled는 구현의 편의를 위한 활성화만 맡으며 시드 초안을 변경하지 않는다. dispose는 폼 리스너와 DOM 소유 요소를 정리한다. 컴포넌트 내부가 localStorage/game.dispatch에 직접 접근하지 않는다.

기존 UI 소유자만 ui.ts의 삽입·결과 표시·시작경로를 연결한다. 메인만 main.ts의 기록 정책을 반영한다. engine.ts, types.ts, storage.ts 수정은 이 작업의 기본 범위가 아니다. src/challenge.ts 파일명을 메인이 다른 경로로 확정하면 모든 담당자가 그 한 경로만 사용한다.

현재 ui.ts의 start(mode)는 knight를 강제로 넣는다. P1 캐릭터 선택 구현에서 이 고정을 제거한 이후 도전도 동일한 현재 선택값을 사용한다. mode만 바꾸고 seed를 빠뜨리거나, main의 contentTier 보존 로직을 컴포넌트에서 우회하지 않는다.

일반/시연의 기존 시드 생성 정책은 바꾸지 않는다. 현재 앱은 최초 options의 임의 시드를 여러 start/restart에서 유지할 수 있으므로 이번 작업에서 `일반은 매번 새로운 시드`라고 새로 약속하지 않는다. 도전 입력 초안은 submit 전까지 전역options를 변경하지 않는다.

## 로컬 최고 기록 혼합 — 최소 범위 권고

현재 main은 모드 구분 없이 Profile.bestScore/bestTime/wins를 갱신한다. 이미 normal+demo 기록이 합쳐져 있으므로 기존 Profile을 **일반 모드 전용 최고 기록이라고 설명하면 틀리다.** UI는 현재 일반적인 `최고 점수`만 표시한다.

권고는 **challenge 결과를 기존 최고 기록 집계에서 제외**하는 것이다. 이번 P2 요구에는 시드별 최고 기록/랭킹이 없으며 저장 스키마를 확장할 필요가 없다.

- challenge 종료에서도 runSaved=true로 처리해 매frame 종료 처리를 반복하지 않는다.
- challenge면 Profile.bestScore/bestTime/wins를 변경하지 않는다. 기존 일반+시연 값은 보존한다.
- mute/reducedMotion 설정은 모드에 관계없이 기존 프로필로 즉시 저장한다. 도전 중 설정 저장을 막지 않는다.
- challenge 결과의 네 번째 통계칸은 `최고 점수` 대신 `도전 시드`다. 기존 `Math.max(profile.bestScore,state.stats.score)`를 도전 결과에 사용하지 않는다.
- 도전 결과에서 `이번 도전 점수`와 재도전은 제공하되, 저장되지 않은 시드별 최고를 꾸며내지 않는다. 짧은 안내 `도전 점수는 최고 기록에 합산하지 않아요.`를 도전 시작 설명 또는 결과 중 한 곳에 둔다.
- non-challenge의 기록 저장 동작을 유지한다. 기존 숫자에 모드 정보가 없으므로 정상/시연 기록을 추측 분리하거나 마이그레이션하지 않는다.

대안으로 모든 모드 합산을 유지하고 `전체 모드 최고`라고 정확하게 표기할 수도 있다. 그러나 미리 아는 시드의 반복 도전으로 기존 기록이 바뀌므로 **분리 집계 없이 혼합을 피하는 위 기본안**을 권고한다. 별도 저장을 추가한다면 (seed,character,contentTier,rulesVersion) 조합별 저장과 용량상한·손상복구까지 필요하므로 별도 승인된 작업으로 다뤄야 한다. 현재 ready 범위에는 포함하지 않는다.

## 결정성의 실제 보장 범위

기존 engine.randomStream은 seed를 uint32로 사용하고 reset에서 같은 RNG를 다시 만든다. 새 RNG·브라우저시간·Math.random을 challenge 엔진에 추가할 이유가 없다.

같은 **빌드/룰, contentTier, 캐릭터, 시드, 고정 step 크기, 입력 이력, 성장 선택**이면 같은 gameplay 상태가 나와야 한다. 다른 이동·처치·선택은 RNG 소비와 적 위치에 영향을 주므로 시드만 같다고 모든 플레이에서 적/성장 선택 순서가 항상 같다는 약속은 하지 않는다. 시작 지형과 초기 조건 재현 + 같은 입력에 대한 결정성이 기준이다.

현재 eventId는 같은 controller의 restart에서 초기화되지 않는다. 이는 이벤트 스트림의 단조증가 식별자이며 게임 내용 차이가 아니다. 새 controller 둘의 결정성 검사는 전체 이벤트를 비교할 수 있지만, **동일 controller 재시작 전후 재현은 GameState 또는 id를 제외한 이벤트 내용으로 비교**한다. 이 테스트를 통과시키려고 P0 이벤트 식별자 정책을 바꾸지 않는다.

도전600초·P1 두 보스 스폰/승리 기준은 normal과 같아야 한다. mode를 challenge로 바꾼 것만으로 demo 시간·체력·스폰 보정이 들어가면 결함이다. P1 새 모듈도 기존 주입 RNG만 쓰는지 최종 통합 때 확인한다.

## 검증 기준과 작은 구현 배정

**P2-SEED / implementer Sol high /25–35분**: 새 파서/패널/자체CSS/자체test. 단일파일 테스트만 경량 실행하고 공용파일은 건드리지 않는다. 최종 통합은 메인과 기존UI 담당.

필수 확인:

1. 파서 표의 정상/오류 입력,0과uint32최대,선행0 정규화,빈값이0으로 변환되지 않음.
2. 같은 seed/character/tier의 challenge 두 controller가 같은 고정step과 입력/선택에서 동일 상태, 다른 seed는 props 또는 실제 생성 결과가 다름. 기존 전체 결정성 테스트를 복사하지 말고 mode/seed 전달 누락을 잡는 짧은 사례만 추가.
3. duration600, modechallenge,선택캐릭터 유지,승패·pause·restart 경로 사용 가능. restart는 같은 seed와 캐릭터를 유지하고 시작상태로 돌아옴.
4. 일반·시연 최고 기록이 있는 프로필에서 challenge 승패 후 숫자가 그대로이며 설정 저장은 작동. 통합 UI에서는 최고점수 대신시드가 표시됨. main 기록 정책은 메인이 짧은 통합검사로 확인.
5. 실제 브라우저에서 title→숫자 입력→Enter/클릭→도전 표시→pause→재시작,입력 중WASD/Space가 게임키로 소비되지 않음. 기존 input은 INPUT을 무시하므로 재구현하지 않는다.
6. 720p/1080p와 터치에서 패널 열림/오류 한 줄/캐릭터 선택을 합쳐도 시작 버튼과 입력이 잘리지 않음. 브라우저는 메인 단독 실행.

본 설계 단계에서는 테스트·브라우저를 실행하지 않았으며 구현 완료나 도전모드 통과를 주장하지 않는다. 메인이 P1 통과를 기록한 뒤 이 계약으로 즉시 작업을 배정할 수 있다.
