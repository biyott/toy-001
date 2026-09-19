# P2-PAD — 게임패드 입력 설계 및 구현 계약

작성 시각: 2026-09-19 (KST)  
범위: P2 구현 전 설계만. `src/**`는 수정하지 않았다. P0 정상 실플레이와 P1 검증 뒤에만 구현한다.

## 결론

현재 앱에는 **표준 매핑 게임패드 한 대를 단일 RAF에서 폴링하는 작은 상태 보유 리더**가 가장 잘 맞는다. `src/controls/gamepad.ts`는 브라우저 전역, 게임 phase, DOM을 알지 않고 `Gamepad` 스냅샷을 `InputFrame + 메뉴 edge`로 바꾼다. `main.ts`가 `navigator.getGamepads()`를 호출하고 키보드 입력과 합치며, UI가 메뉴 포커스와 실행을 맡는다.

설치된 브라우저 실행 파일은 `Google Chrome 151.0.7922.169`이다. W3C 표준의 `navigator.getGamepads()`와 Standard Gamepad 매핑을 기준으로 설계한다. Chrome 149에서 추가된 `rawgamepadinputchange`는 공개 안내상 **origin trial**이므로 Chrome 151 설치만으로 일반 배포 사용 가능하다고 가정하지 않는다. 이 게임은 이미 단일 RAF를 사용하고 있고 W3C도 게임 입력을 RAF 직전에 같은 주기로 폴링하라고 권고하므로, 실험 API를 쓸 이점이 없다.

물리 게임패드는 현재 확인하지 못했다. 따라서 아래의 순수 입력 변환은 가짜 스냅샷으로 자동 검증할 수 있지만, Windows 드라이버 → Chrome 매핑, 첫 사용자 동작 뒤 장치 노출, Bluetooth/USB 재연결, Web Audio 잠금 해제는 물리 검증 항목으로 남긴다.

## 확인한 현재 계약

- `InputFrame`은 `moveX`, `moveY`, `dashPressed`, `pausePressed` 네 필드다. 이동은 held 상태, 대시와 일시정지는 한 번만 소비하는 edge다.
- `src/input.ts`는 키보드를 매 RAF에 읽고 edge를 읽은 직후 지운다. `clear()`는 blur와 모든 `GameCommand` 뒤에 눌림/edge를 비운다.
- `src/main.ts`는 모든 phase에서 입력을 읽는다. `pausePressed`를 먼저 처리하고, `playing`에서만 고정 1/60 step에 입력을 전달한다. 렌더 RAF 하나만 존재한다.
- `levelup`은 현재 숫자키 1–3 또는 UI 버튼으로 선택한다. title, pause, result의 버튼 포커스와 클릭은 `src/ui/ui.ts`가 소유한다.
- `command()`는 `audio.unlock()`을 시도한 뒤 게임 명령을 보내고 입력을 지운다. 게임패드 폴링에서 호출한 `AudioContext.resume()`가 Chrome의 일반 사용자 활성화로 인정되는지는 물리 검증이 필요하다.

## 표준 매핑

`gamepad.mapping === 'standard'`인 장치만 P2 v1에서 지원한다. raw/unmapped 장치를 같은 번호로 추측하면 제조사별 축과 버튼 차이 때문에 메뉴가 자동 실행될 수 있으므로, `mapping === ''` 장치는 입력에서 제외하고 진단에만 센다.

| 기능 | Standard Gamepad 값 | 처리 |
|---|---:|---|
| 왼쪽 스틱 | axes 0/1 | 화면 기준 X/Y 이동. 음수 Y는 위, 양수 Y는 아래라 현재 월드 축과 일치 |
| D-pad | buttons 12/13/14/15 | 위/아래/왼쪽/오른쪽 held. 두 방향 동시 입력은 정확한 8방향 대각선 |
| A / 아래쪽 face | button 0 | 플레이 중 대시 edge, 메뉴에서 확인 edge |
| LT / RT | buttons 6/7 | 플레이 중 대시 edge. `pressed || value >= 0.5` |
| B / 오른쪽 face | button 1 | 메뉴 뒤로 edge |
| Start / 오른쪽 center | button 9 | 플레이↔일시정지 edge |

D-pad가 하나라도 눌리면 같은 패드의 스틱보다 우선한다. D-pad 벡터는 대각선에서 길이 1로 정규화한다. D-pad를 놓은 다음 프레임부터 스틱을 다시 사용한다.

스틱은 축별 deadzone이 아니라 반지름 deadzone을 쓴다. `m = hypot(x, y)`에 대해 `m <= 0.20`이면 `(0,0)`, 그 밖에는 `scaled = min(1, (m - 0.20) / 0.80)`과 `(x/m, y/m)`를 곱한다. 입력 축은 먼저 유한값 확인과 `[-1,1]` clamp를 한다. 이 방식은 원형 이동 범위를 유지하고 deadzone 경계 뒤 속도 점프를 없앤다. 메뉴 방향에는 이동 deadzone을 재사용하지 않고 진입 0.65, 해제 0.45의 hysteresis를 둔다.

## 구현 API 초안

파일 하나로 완결하며 이벤트 리스너를 만들지 않는다. edge를 계산해야 하므로 단순한 무상태 함수보다는 한 개의 closure가 필요하다.

```ts
// src/controls/gamepad.ts
import type { InputFrame } from '../types';

export type MenuAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

export interface GamepadReadout {
  frame: InputFrame;
  menuPressed: readonly MenuAction[];
  activeIndex: number | null;
  connectedStandardPads: number;
  unsupportedPads: number;
}

export interface GamepadReader {
  readGamepad(pads: readonly (Gamepad | null)[]): GamepadReadout;
  clear(): void;
  diagnostics(): {
    activeIndex: number | null;
    connectedStandardPads: number;
    unsupportedPads: number;
    waitingForNeutral: boolean;
  };
}

export function createGamepadReader(): GamepadReader;

export function mergeInputFrames(a: InputFrame, b: InputFrame): InputFrame;
```

`readGamepad()` 내부 상태는 `activeIndex`, 이전 action button bitset, 이전 메뉴 방향 bitset, `waitingForNeutral`뿐이다. 장치 객체 자체를 보관하지 않는다. `navigator.getGamepads()` 결과는 매 RAF 새로 전달한다.

### held와 pressed 규칙

- held: 이동 스틱과 D-pad만 매 read에 현재 값을 낸다.
- pressed: `current && !previous`인 경우 한 번만 낸다. A/LT/RT 대시, Start 일시정지, A 확인, B 뒤로, D-pad/스틱 메뉴 방향이 여기에 해당한다.
- 메뉴 방향은 v1에서 자동 반복하지 않는다. 한 칸 이동하려면 방향을 놓았다가 다시 누른다. 선택지를 건너뛰는 프레임 속도 의존 동작을 피한다.
- A는 같은 readout에 `dashPressed`와 `confirm`을 모두 만들 수 있다. `main.ts`가 phase에 따라 하나만 사용한다. `playing`은 대시, 메뉴 phase는 확인이다.
- 입력은 `playing`에서만 읽으면 안 된다. 모든 RAF에서 읽어야 pause/levelup 동안 일어난 release가 이전 상태에 반영된다.

### 장치 선택과 disconnect 정리

이 게임은 1인용이다. 활성 패드가 없을 때 유효 입력이 처음 들어온 표준 패드가 게임을 점유한다. 같은 프레임에 둘 이상이면 낮은 `Gamepad.index`가 이긴다. 활성 패드가 연결되어 있는 동안 다른 패드 입력은 무시한다.

활성 인덱스가 `null`, `connected === false`, 또는 배열에서 사라지면 그 read는 완전한 중립값을 반환하고 active/이전 bitset을 모두 지운다. 다음 장치는 새 유효 입력으로 다시 점유한다. 이전 패드의 held 이동이나 Start edge가 새 패드로 이어지지 않는다.

`clear()`는 active 인덱스는 유지하되 이전 edge를 지우고 `waitingForNeutral = true`로 둔다. 관련 스틱·D-pad·action 버튼이 모두 중립이 된 read까지 출력은 중립이다. 이는 다음 누수를 막는다.

- A로 업그레이드를 고른 직후 같은 held A가 플레이 대시로 재발생
- Start로 pause/resume한 뒤 held Start가 다시 toggle
- blur 중 held 스틱이 복귀하자마자 이동 또는 메뉴 포커스를 변경

초기 생성 때는 `waitingForNeutral = false`로 둔다. Chrome이 첫 게임패드 동작 뒤 장치를 페이지에 노출했을 때 그 첫 A/Start도 사용할 수 있게 하기 위함이다. disconnect와 명령 전환 뒤에는 안전을 위해 neutral gate를 사용한다.

## 키보드와 게임패드 동시 merge

`mergeInputFrames(keyboard, pad)`는 두 이동 벡터를 성분별로 더한 뒤 길이가 1보다 크면 한 번만 정규화한다. 같은 방향은 최대 속도 1, 반대 방향은 서로 상쇄된다. `dashPressed`와 `pausePressed`는 OR한다. NaN/Infinity는 합치기 전에 0으로 바꾼다.

이 규칙은 마지막 입력 장치를 추적하지 않아도 되고, 키보드 한 축 + 패드 다른 축 조합도 자연스럽다. 같은 RAF에 키보드와 패드가 같은 edge를 내도 명령은 한 번만 처리한다. 메뉴 action은 `Set<MenuAction>`으로 중복 제거하며, 한 read에 방향과 확인이 함께 들어오면 **방향 한 번만 실행하고 확인은 버린다**. 새로 이동한 항목을 같은 프레임에 뜻하지 않게 실행하지 않도록 확인은 다시 눌러야 한다.

## phase별 메뉴 동작

게임패드 모듈은 phase나 버튼 목록을 알지 않는다. UI에 작은 `handleMenu(action: MenuAction): void`를 추가하고 `GameUI` 계약을 확장하는 것이 가장 단순하다. UI는 현재 보이는 screen의 활성 버튼 배열과 포커스를 이미 소유하므로, main에서 DOM을 검색하거나 설정 로직을 복제하지 않는다.

| phase | 방향 | A/confirm | B/back | Start |
|---|---|---|---|---|
| `title` | up/down으로 일반 임무·빠른 시연 순환 | 포커스 버튼 click | no-op | no-op |
| `playing` | 이동 입력 | 대시 | no-op | pause |
| `paused` | up/down으로 계속·음소거·흔들림·첫 화면 순환 | 포커스 버튼 click | resume | resume |
| `levelup` | left/right 우선, up/down도 이전/다음 카드로 허용 | 포커스 업그레이드 click | no-op | no-op |
| `victory/defeat` | left/right 우선, up/down도 이전/다음 허용 | 재도전 또는 첫 화면 click | 첫 화면 | no-op |

각 phase 진입 시 UI가 기존 `data-focus` 기본 버튼에 포커스를 둔다. 방향은 wrap한다. confirm은 `HTMLElement.click()`으로 기존 UI callback을 그대로 사용한다. 설정 토글, start option 구성, 업그레이드 id 선택을 main에 중복 구현하지 않는다.

## `main.ts` 통합 순서

```ts
const pad = createGamepadReader();

function safePads(): readonly (Gamepad | null)[] {
  try { return navigator.getGamepads?.() ?? []; }
  catch { return []; } // Permissions Policy/SecurityError도 게임을 막지 않음
}

// RAF마다, phase와 무관하게 한 번
const keyboard = input.read();
const gamepad = pad.readGamepad(safePads());
const controls = mergeInputFrames(keyboard, gamepad.frame);

// 1. 현재 phase 스냅샷에서 pause toggle을 최대 한 번 처리
// 2. playing이 아니면 gamepad.menuPressed 중 최대 한 action을 ui.handleMenu에 전달
// 3. playing이면 기존 pendingDash + fixed-step 경로에 merged controls 전달
```

`command()`과 `loseFocus()`에서 기존 `input.clear()`와 함께 `pad.clear()`를 부른다. diagnostics에는 active index, 표준/미지원 패드 수, neutral gate 상태만 넣고 `id` 전체 문자열은 저장하지 않는다. polling 방식에는 `gamepadconnected`/`gamepaddisconnected` listener가 필요 없으므로 dispose 작업도 없다.

Start 처리 시 현재 코드처럼 phase를 toggle한 다음 같은 프레임의 menu action을 실행하지 않는다. `command()`가 neutral gate를 세운 뒤 UI를 즉시 render한다. levelup이나 결과 phase로 step 도중 바뀐 프레임에서도 이미 읽은 A가 메뉴 confirm으로 재사용되지 않아야 한다.

## 입력 생명주기 불확실성과 결정

1. **첫 장치 노출:** 표준은 사용자가 게임패드를 조작하기 전 `getGamepads()`가 빈 배열을 반환할 수 있다. 따라서 연결 이벤트만 기다리지 않고 매 RAF polling하며, 첫 유효 입력으로 active pad를 정한다.
2. **스냅샷 수명:** `Gamepad`/button 객체 갱신 방식에 기대지 않는다. 매 RAF 배열과 숫자를 다시 읽고 원본 객체를 캐시하지 않는다.
3. **index 재사용:** disconnect 뒤 낮은 index가 재사용될 수 있으므로 index만 같다고 같은 장치로 간주하지 않는다. 사라진 read에서 반드시 상태를 지운다.
4. **blur/hidden:** 현재 앱은 blur/hidden에서 pause한다. 게임패드도 clear/neutral gate를 거쳐야 복귀 시 ghost 입력이 없다.
5. **고정 step이 0회인 RAF:** edge는 `pendingDash`에 보존되어 다음 simulation step에서 정확히 한 번 소비된다. pause/menu edge는 fixed step과 무관하게 즉시 처리한다.
6. **Web Audio:** Gamepad API의 “gamepad gesture”는 장치 노출 규칙이다. 그것이 `AudioContext`용 HTML 사용자 활성화와 같다고 가정하지 않는다. A로 title부터 시작한 물리 테스트에서 audio diagnostics가 `running`인지 확인하고, 실패하면 화면 click/키 입력 안내가 별도로 필요하다.
7. **실험 이벤트 API:** `rawgamepadinputchange`는 현재 설계에서 사용하지 않는다. origin token, 타입 보강, 이벤트/RAF 동기화라는 새 실패 지점만 만든다.

## 검증 매트릭스

### 자동/에뮬레이션 — 약 8분

여기서 “에뮬레이션”은 Chrome이 물리 장치를 흉내 냈다는 뜻이 아니다. `readGamepad()`에 구조적으로 맞는 가짜 `Gamepad` 스냅샷을 주는 단위 테스트와, 필요하면 페이지 시작 전에 `navigator.getGamepads`를 test double로 바꾸는 브라우저 통합 테스트다.

| 시간 | 검사 | 합격 기준 |
|---:|---|---|
| 1분 | deadzone/축 | 0.19는 0, 0.20 경계는 0, 1.0은 1, 대각선 길이 ≤ 1, NaN은 0 |
| 1분 | D-pad 8방향 | 단일 방향 부호 정확, 두 방향 대각선 정규화, D-pad가 stick 우선 |
| 1분 | edge | A/LT/RT/Start/confirm/back은 held 동안 1회, release 후 재발생 |
| 1분 | 메뉴 stick hysteresis | 0.64 no-op, 0.66 한 edge, held no repeat, 0.44 release 후 재입력 |
| 1분 | clear/phase 누수 | clear 후 held A/Start/stick은 중립, 전부 놓은 뒤 새 press만 통과 |
| 1분 | disconnect/reconnect | active pad 제거 즉시 중립, 이전 bitset 삭제, 새 입력으로 재점유 |
| 1분 | 두 입력 merge | 직교 입력 정규화, 반대 입력 상쇄, dash/pause OR, 중복 명령 1회 |
| 1분 | phase 통합 | title 시작, pause/resume, levelup 이동·선택, result 재시작을 기존 UI callback으로 실행 |

### 물리 패드 + 설치된 Chrome 151 — 별도 5~10분 필수

| 시나리오 | 합격 기준 |
|---|---|
| 페이지 로드 후 USB/Bluetooth 연결 및 첫 A | 첫 조작 뒤 패드가 노출되고 title 확인이 한 번만 실행 |
| 스틱 중앙 10초 | drift로 이동하거나 메뉴가 바뀌지 않음 |
| 스틱 원주 + D-pad 8방향 | 화면 방향과 일치하고 속도/대각선이 1을 넘지 않음 |
| A, LT, RT를 각각 길게 누름 | 각 press당 대시 한 번, release 후 다시 한 번 가능 |
| Start 길게 누름 | pause 한 번만, release 후 다음 press에서 resume |
| title/pause/levelup/result | 방향 이동, A 확인, B/Start의 phase별 동작이 표와 일치 |
| 이동 중 케이블 분리 | 같은 RAF 또는 다음 RAF부터 이동/edge 완전 중립, 콘솔 오류 없음 |
| 재연결/다른 패드 연결 | 이전 held 상태가 이어지지 않고 새 입력으로 정상 점유 |
| 키보드+패드 동시 | 합산/상쇄 규칙과 edge 1회가 동일 |
| 게임패드만으로 title 시작 | 소리가 실제로 나며 diagnostics audio state가 `running`; 실패 시 사용자 활성화 한계 기록 |

## 구현 완료 기준

- 기존 키보드 테스트와 게임 동작이 그대로 통과한다.
- 표준 매핑 패드로 title → play → pause/resume → levelup 선택 → result/restart를 마우스/키보드 없이 완료한다.
- held 버튼, phase 전환, blur, disconnect에서 중복 명령과 ghost 입력이 없다.
- 실제 장치가 없을 때와 raw/unmapped 장치만 있을 때 완전히 중립이며 게임은 정상 작동한다.
- `__LRG__.getDiagnostics()`로 active index와 neutral gate를 확인할 수 있지만 장치 식별 문자열은 장기 저장하지 않는다.

## 공개 근거

- [W3C Gamepad Working Draft](https://www.w3.org/TR/gamepad/): 축 범위, 버튼/축 Standard Gamepad 인덱스, 사용자 동작 전 노출 제한, disconnect/index 재사용, `getGamepads()` 스냅샷, RAF 주기 polling 권고.
- [Chrome 149 release notes — Gamepad event-driven input API](https://developer.chrome.com/release-notes/149): `rawgamepadinputchange`가 새 origin trial임을 명시한다.

