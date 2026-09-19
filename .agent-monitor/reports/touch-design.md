# P2-TOUCH — 터치 입력 구현 계약안

- 범위: P2 터치 입력의 설계와 구현 준비. 현재 `SPEC.md` 순서상 **P0 검증 및 P1 통과 전 구현 금지** 상태다.
- 조사 기준: `src/types.ts`, `src/input.ts`, `src/main.ts`, `src/ui/ui.ts`, `src/ui/styles.css`, `index.html`, 입력 테스트와 브라우저 검증 스크립트를 읽었다.
- 이번 변경: 이 문서만 작성했다. `src` 코드는 수정하지 않았다.
- 이후 소유 파일: 승인 뒤 `src/controls/touch.ts`, `src/controls/touch.css`. `src/main.ts` 통합은 메인 담당과 작은 패치로 조율한다.
- 제외: 새 게임 규칙, 공격 버튼, 조준, 자동 이동, 시드/게임패드, 기존 UI 재설계. 터치는 기존 `InputFrame`의 이동·대시·일시정지만 만든다.

## 1. 현재 구조에서 확정할 경계

현재 공용 입력 계약은 이미 충분하다.

```ts
interface InputFrame {
  moveX: number;
  moveY: number;
  dashPressed: boolean;
  pausePressed: boolean;
}
```

터치는 전투나 phase를 직접 바꾸지 않고 이 값만 반환한다. 이동은 화면 축과 같은 단위 벡터이고, 대시와 일시정지는 `pointerdown`에서 한 번만 발생하는 edge다. 유지 중 반복 발동하지 않는다.

`#ui-root`는 `createUI()`가 시작 시 `replaceChildren()`하고 `dispose()`에서도 비우므로 터치 DOM의 마운트 지점으로 쓰지 않는다. 다음처럼 `body`에 독립 오버레이를 붙인다.

```ts
const touch = createTouchControls(document.body);
```

터치 오버레이는 UI보다 높은 고정 레이어지만 컨테이너 자체는 `pointer-events: none`이다. 조이스틱과 두 버튼만 `pointer-events: auto`를 사용한다. 따라서 전투 화면의 나머지 영역과 HUD를 가로채지 않는다. title/paused/levelup/victory/defeat에서는 `setEnabled(false)`로 오버레이를 숨기고 상태를 지워 기존 카드와 메뉴가 터치 이벤트를 온전히 받게 한다.

## 2. 최소 공용 API

`src/controls/touch.ts`가 아래 타입과 팩토리를 export한다.

```ts
import type { InputFrame } from '../types';

export interface TouchControls {
  read(): InputFrame;
  clear(): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createTouchControls(root: HTMLElement): TouchControls;
```

계약 세부:

- 생성 직후 disabled다. DOM과 리스너는 한 번만 만들고 phase마다 다시 만들지 않는다.
- `read()`는 현재 이동 벡터를 그대로 반환하고 `dashPressed`, `pausePressed`를 반환 직후 `false`로 소비한다.
- `clear()`는 모든 pointer ID, 이동 벡터, 두 edge, 눌림 시각 상태를 함께 지운다. 캡처 중인 포인터는 가능한 경우 안전하게 release한다.
- `setEnabled(false)`는 반드시 `clear()`를 호출하고 root를 `hidden`/`aria-hidden` 처리하며 버튼을 disabled로 만든다. 포커스가 터치 컨트롤 안에 있으면 blur한다. 같은 값을 반복 호출해도 부작용이 없어야 한다.
- `dispose()`는 `clear()`, 모든 element/window/document/visualViewport 리스너 제거, 만든 DOM 제거, root에 붙인 상태 class/속성 제거 순서로 수행한다. 여러 번 호출해도 안전하게 한다.
- 진단 API를 공용 계약에 추가하지 않는다. 필요하면 `data-*` 상태는 테스트 선택자에만 쓰고 게임 로직이 의존하지 않는다.

## 3. DOM과 포인터 상태 머신

권장 DOM은 한 개의 고정 overlay, 좌측 조이스틱, 우측 버튼 묶음이다.

```html
<section class="touch-controls" aria-label="터치 조작" hidden>
  <div class="touch-controls__joystick" role="group" aria-label="이동 조이스틱">
    <span class="touch-controls__stick"></span>
  </div>
  <div class="touch-controls__actions">
    <button class="touch-controls__pause" aria-label="일시정지">Ⅱ</button>
    <button class="touch-controls__dash" aria-label="대시">대시</button>
  </div>
</section>
```

세 조작 요소는 각자 활성 `pointerId`를 하나씩 가진다. 조이스틱 포인터와 대시 포인터가 서로 달라야 하므로 왼손 이동을 유지한 채 오른손 대시가 가능하다. 한 요소에 두 번째 포인터가 들어오면 무시한다. 전역 `activePointerId` 하나를 공유하면 멀티터치가 깨지므로 금지한다.

### 조이스틱

1. enabled 상태의 `pointerdown`에서 주 포인터를 저장하고 `setPointerCapture(pointerId)`를 호출한다. 이벤트 리스너는 passive가 아니며 해당 조작에 한해 `preventDefault()`한다.
2. 고정형 base의 `getBoundingClientRect()` 중심을 원점으로 삼는다. `dx`, `dy`를 base의 유효 반경으로 나누고 길이가 1보다 크면 정규화한다. deadzone 약 `0.12` 이하는 `(0,0)`으로 만든다.
3. deadzone 밖 값은 갑작스러운 출발을 줄이도록 `(length - deadzone) / (1 - deadzone)`로 다시 매핑한다. stick 시각 이동량은 별도 최대 반경으로 clamp한다.
4. 캡처된 `pointermove`는 요소 경계 밖에서도 계속 갱신한다.
5. 같은 ID의 `pointerup`, `pointercancel`, `lostpointercapture`에서 즉시 `(0,0)`과 ID를 지운다. 다른 ID 이벤트는 건드리지 않는다.

고정형을 권한다. 화면 왼쪽 아무 곳에서 시작하는 floating joystick은 HUD/메뉴 및 브라우저 제스처와 충돌 범위가 커지고 테스트 기준점도 불안정하다.

### 대시와 일시정지

- `pointerdown`에서 각 element가 자체 pointer를 capture하고, edge를 `true`로 설정한다. `pointermove`로 재발동하지 않는다.
- `pointerup`/`pointercancel`/`lostpointercapture`는 눌림 모양과 해당 ID만 지운다. 이미 만들어진 edge는 다음 `read()`까지 유지한다. 단, `clear()`/disable은 edge까지 폐기한다.
- `button`을 사용해 이름과 최소 44 CSS px 터치 목표를 제공한다. 터치용 동작은 `click`이 아니라 `pointerdown`을 기준으로 하여 반응 지연과 합성 click 중복을 피한다.
- 요소마다 `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`을 적용한다. 문서 전체의 스크롤/확대를 무조건 막는 전역 리스너는 추가하지 않는다.

### 강제 리셋

`window.blur`, `document.visibilitychange`에서 hidden, 각 요소의 `pointercancel`과 `lostpointercapture`가 `clear()` 또는 해당 포인터 reset으로 이어져야 한다. OS 알림, 앱 전환, 브라우저 제스처, 회전 중 취소 뒤 캐릭터가 계속 이동하는 고착 입력이 없어야 한다. main의 기존 blur pause와 중복 호출되어도 안전해야 한다.

## 4. CSS 범위와 화면 배치

신규 규칙의 기본 scope는 `.touch-controls` 아래로 제한한다. 전역 `button`, `canvas`, `body` 규칙은 추가하지 않는다. 기존 HUD를 조정해야 할 때만 활성 class와 coarse-pointer 조건을 함께 사용한다.

```css
.touch-controls { /* fixed visual-viewport overlay; pointer-events:none */ }
.touch-controls__joystick,
.touch-controls__actions button { pointer-events:auto; touch-action:none; }

@media (any-pointer: coarse) { /* 실제 컨트롤 표시 */ }
@media (orientation: landscape) and (max-height: 500px) { /* 축소 배치 */ }
@media (prefers-reduced-motion: reduce) { /* 눌림/복귀 transition 제거 */ }
```

배치 권고:

- 좌측 아래 고정 조이스틱: 기본 지름 112–128px, landscape 저높이에서는 96–108px. 왼쪽/아래 간격은 각각 `max(12px, env(safe-area-inset-left))`, `max(12px, env(safe-area-inset-bottom))`.
- 우측 아래 대시: 68–80px 원형 또는 둥근 사각형. 일시정지는 그 위/옆 48px 이상. 오른쪽 간격은 `max(12px, env(safe-area-inset-right))`.
- opacity는 전투를 가리지 않게 약 0.72–0.85, 눌림/활성은 색뿐 아니라 scale/테두리 변화로 구분한다.
- 기존 `.hud-bottom`은 양쪽 컨트롤과 겹친다. coarse pointer이며 touch enabled일 때 `.dash-indicator`는 숨기고(대시 버튼이 동일 정보를 제공), `.weapon-bar`는 조이스틱 위로 약 120–140px 올린다. 이 예외는 `body.touch-controls-enabled .hud-bottom`처럼 활성 class로 한정한다. 667×375 및 844×390 landscape 캡처에서 실제 값을 조절한다.
- portrait도 깨지지 않게 하되 게임의 우선 검증은 landscape로 한다. orientation lock API는 fullscreen/권한과 브라우저 차이가 있어 사용하지 않고, 시작 화면 안내에서 landscape 권장을 할 필요가 생기면 P2 통합 때 기존 안내에 짧게 반영한다.

`visualViewport`가 있으면 overlay를 layout viewport 전체가 아닌 현재 보이는 영역에 맞춘다. 생성 시와 `visualViewport.resize`/`scroll`, `window.resize`에서 `offsetLeft`, `offsetTop`, `width`, `height`를 CSS 변수로 갱신하고 overlay의 left/top/width/height에 쓴다. 주소창 축소, 확대, 회전 때 컨트롤이 보이는 화면 밖으로 밀리는 것을 줄인다. API가 없으면 `inset: 0`/`100vw`/`100vh`로 폴백한다. safe-area는 별도로 계속 적용한다.

## 5. `main.ts` 합성 계약

키보드와 터치를 각각 한 번 읽고 이동을 더한 뒤 다시 단위 길이로 clamp한다. edge는 OR한다. 한 입력원을 우선하여 다른 입력원을 버리지 않는다.

```ts
import { createTouchControls } from './controls/touch';

const input = createInput();
const touch = createTouchControls(document.body);

function mergeInputFrames(a: InputFrame, b: InputFrame): InputFrame {
  let moveX = a.moveX + b.moveX;
  let moveY = a.moveY + b.moveY;
  const length = Math.hypot(moveX, moveY);
  if (length > 1) { moveX /= length; moveY /= length; }
  return {
    moveX,
    moveY,
    dashPressed: a.dashPressed || b.dashPressed,
    pausePressed: a.pausePressed || b.pausePressed,
  };
}

function clearInputs(): void {
  input.clear();
  touch.clear();
}
```

프레임 처음의 phase로 `touch.setEnabled(phase === 'playing')`를 호출한 뒤 두 입력을 읽는다. pause edge를 dispatch한 직후에는 touch를 disable/clear하여 다음 RAF 전에도 버튼이 사라지도록 한다. 기존 `command()`와 `loseFocus()`의 `input.clear()`는 `clearInputs()`로 바꾼다. restart/title/성장 선택/blur 경계에서 이전 touch edge가 새 phase로 새지 않게 하는 핵심 변경이다.

```ts
const phase = game.getState().phase;
touch.setEnabled(phase === 'playing');
const controls = mergeInputFrames(input.read(), touch.read());
```

`levelup`은 main 루프상 전투 step이 멈추므로 touch controls를 숨기고 카드 터치를 허용한다. pause 버튼으로 paused가 된 뒤 재개는 기존 modal의 `계속하기` 버튼을 터치한다. 결과·타이틀 버튼도 기존 UI click 경로를 그대로 쓴다. 터치 모듈이 `game.dispatch()`나 UI handler를 직접 호출하면 입력 경계가 둘로 갈라지므로 금지한다.

`dispose()` 통합은 앱 수명 종료/HMR 정리 지점이 생길 때 `touch.dispose()`를 기존 input/audio/renderer/UI와 함께 호출한다. 현 main에는 통합 dispose 경로가 없으므로 터치만 별도 unload listener를 만들 필요는 없다.

## 6. Playwright 터치 검증 제안

별도 P2 브라우저 시나리오를 Chromium mobile context에서 실행한다.

```ts
const context = await browser.newContext({
  viewport: { width: 844, height: 390 },
  screen: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});
```

권장 자동 검증:

1. title에서 touch overlay가 hidden이고 시작/시연 버튼을 `touchscreen.tap()`으로 누를 수 있다.
2. playing 진입 뒤 overlay가 보이며 조이스틱 중심→상/우/대각선 drag가 읽기 전용 `window.__LRG__.getState()`의 플레이어 위치를 해당 화면 방향으로 바꾼다. 대각선 속도가 직선보다 커지지 않는다.
3. CDP `Input.dispatchTouchEvent`의 서로 다른 touch ID로 조이스틱 hold와 대시 tap을 동시에 보낸다. 이동이 유지되는 동안 대시 cooldown/이벤트가 한 번만 생기며 길게 눌러도 반복되지 않는다.
4. 조이스틱 포인터를 base 밖으로 이동한 뒤 release하여 pointer capture가 유지되는지 확인하고, release 후 위치 변화가 정지하는지 확인한다.
5. `touchCancel` 또는 테스트용 `pointercancel`, blur/visibility hidden 뒤 이동과 edge가 0으로 돌아온다. 이 항목은 브라우저 이벤트 계약 검사로 표시한다.
6. 일시정지 버튼 tap 한 번으로 paused, 기존 `계속하기` 버튼 tap으로 playing이 된다. pause 메뉴 버튼/설정/첫 화면 버튼이 control overlay에 막히지 않는다.
7. 자연 레벨업 경로에서 controls가 숨고 세 upgrade card를 touch로 선택할 수 있으며 선택 직후 controls가 다시 나타난다.
8. 844×390, 667×375 landscape와 390×844 portrait 캡처에서 safe-area 쪽 여백, HUD/컨트롤/카드 겹침, 44px 목표 크기, 가로·세로 overflow를 확인한다. `visualViewport` 값과 컨트롤 rect가 보이는 영역 안인지 기록한다.
9. 연속 start→pause→resume→returnTitle/restart를 반복하고 listener/DOM이 누적되지 않는지 확인한다. 콘솔 오류와 pageerror는 0이어야 한다.

Playwright의 synthetic `dispatchEvent(new PointerEvent(...))`만으로 전체 터치 지원을 통과시키지 않는다. 버튼 tap은 `page.touchscreen`, 멀티터치/drag는 Chromium CDP의 raw touch 이벤트를 우선 사용한다. DOM 이벤트 직접 발생은 `pointercancel` 같은 좁은 상태 머신 단위 검사로만 쓴다.

## 7. 물리 기기와 브라우저 에뮬레이션 판정 분리

브라우저 에뮬레이션으로 판정 가능한 것:

- InputFrame 합성, 방향/정규화/deadzone, one-shot edge, phase별 show/hide.
- pointer capture 코드 경로, cancel/blur reset, 두 pointer ID의 독립 상태.
- 메뉴/카드 버튼과의 DOM hit-test 충돌, 대표 viewport 레이아웃, 누적 listener와 런타임 오류.

물리 터치 기기에서 추가로 확인해야 하는 것:

- Android Chrome과 iOS Safari에서 실제 두 엄지 동시 이동+대시, 손가락이 요소 밖으로 벗어날 때 capture, 빠른 연타/미끄러짐/세 손가락 오입력.
- 앱 전환, 알림, 화면 잠금, Safari 시스템 제스처로 생긴 실제 `pointercancel` 뒤 고착 이동 없음.
- 주소창 보이기/숨기기, 회전, notch/home indicator의 실제 safe-area, browser zoom/visual viewport 변화.
- 길게 누르기 선택 메뉴·더블탭 확대·페이지 스크롤이 조작 요소에서 발생하지 않음, 동시에 기존 UI 버튼은 정상 tap 가능.
- 터치 최초 입력으로 Web Audio unlock이 실제 기기 정책에서 성공하고, 10분 플레이 동안 발열/프레임 저하가 조작 지연을 만들지 않음.

에뮬레이션 통과는 물리 터치 통과로 표기하지 않는다. 최종 P2 보고에는 기기명, OS/브라우저 버전, 방향, viewport/safe-area 관찰, 두 엄지 동시 조작과 cancel 시나리오를 별도 표로 남긴다. 물리 기기가 없으면 해당 항목은 **미검증**이다.

## 8. 구현 승인 뒤 완료 기준

- `src/controls/touch.ts`와 `touch.css`만으로 독립 동작하고, main의 통합 변경은 import/생성/합성/clear/phase enable에 한정된다.
- 왼쪽 이동과 오른쪽 대시가 동시 동작하며, pause를 포함한 모든 edge가 한 번만 발생한다.
- pointerup/cancel/lost capture/blur/hidden/disable 어느 경로에서도 고착 입력이 없다.
- title, levelup, pause, result 카드와 버튼을 터치할 수 있고 컨트롤은 playing 외 phase에서 hit-test되지 않는다.
- typecheck/build/기존 입력 테스트가 통과하고 P2 Playwright 터치 시나리오에 새 오류가 없다.
- 브라우저 에뮬레이션 결과와 물리 기기 결과를 구분해 보고한다.

현재 단계에서는 구현과 지원 안내 노출을 시작하지 않는다. P0 검증과 P1 통과 뒤 메인이 P2 구현을 승인하면 이 계약으로 바로 구현할 수 있다.
