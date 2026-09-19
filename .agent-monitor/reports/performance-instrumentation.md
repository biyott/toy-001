# Canvas readback 계측 검토

## 판단

기존 60초 결과의 `getImageData(0, 0, 1, 1)`는 실제 게임 부하에 포함되지 않는 동기식 Canvas 읽기이므로, FPS 합격 판정에서 제외하는 편이 타당하다. 1픽셀만 읽더라도 제출된 그리기 작업의 완료를 기다릴 수 있고, Chromium 구현에 따라 반복 읽기가 가속 Canvas를 소프트웨어 경로로 바꾸는 입력이 될 가능성도 있다. 따라서 기존 720p 약 27 FPS와 1080p 약 16 FPS를 읽기 없는 실제 렌더링 성능으로 확정할 수 없다.

다만 현재 자료만으로 `getImageData`가 저 FPS의 주원인이었다고 단정할 수는 없다. 사용 중인 Chrome 151의 콘솔 경고나 backend 전환 기록을 수집하지 않았고, 확인된 Chromium 코드는 동일 버전이라고 보장되지 않는다. 해상도 증가에 따라 하락 폭이 커지고 renderer의 JS 제출 시간이 약 3 ms였다는 사실은 raster, GPU, 합성 또는 Canvas backend 비용을 의심하게 하지만 어느 하나를 식별하지는 못한다.

## 왜 장기 측정이 왜곡될 수 있는가

이 하니스는 renderer가 만든 동일한 2D context에서 5초마다 픽셀을 읽었다. `getImageData`는 동기식 API라 해당 호출의 직접 대기 시간이 생긴다. 기존 코드는 이 호출을 `totalMeasuredJs` 구간 뒤에 실행했기 때문에 약 32/56 ms의 읽기 시간은 renderer/total JS 통계에는 잡히지 않고 다음 `requestAnimationFrame`의 `rawDeltaMs`에 들어갔다. 그러므로 renderer JS 약 3 ms와 긴 frame/FPS 결과는 서로 모순되지 않는다.

관측된 직접 비용만 단순 합산하면 60초 동안 약 12회의 읽기는 32 ms일 때 384 ms(전체 시간의 약 0.64%), 56 ms일 때 672 ms(약 1.12%)다. 이것만으로 27/16 FPS를 설명하기는 어렵다. 더 큰 위험은 지속 효과다. Chromium의 Canvas2D 구현은 `willReadFrequently`가 지정되지 않았고 context가 accelerated, non-desynchronized일 때 read 횟수를 누적하며, 조건이 맞으면 `DisableAcceleration()`을 호출하는 경로가 있다. 한번 backend가 바뀌면 읽기 프레임 하나를 통계에서 빼는 것만으로 이후 구간의 오염을 제거할 수 없다.

## 적용한 측정 분리

`tests/performance.ts`를 다음처럼 바꿨다.

- 기본 실행은 readback을 0회 수행하는 주 측정이다. `instrumentation.gpuReadbackEnabled=false`, `gpuReadbackIntervalMs=0`으로 결과 자체에 기록한다.
- `?readback=1`일 때만 기존 5초 간격 1픽셀 읽기를 수행한다. 이 결과는 진단용이며 합격 판정에 사용하지 않는다고 metadata에 명시한다.
- 실제 엔진, renderer, UI, entity fixture와 60초 측정 시간은 그대로 유지했다.
- 두 패스 모두 5초별 FPS, frame p95, 33 ms 초과 frame 수, entity 수를 `intervalWindows`에 저장한다. 진단 패스에서는 backend 전환 의심 시점을 찾고, 주 측정에서는 시간이 흐르며 부하가 달라졌는지 확인할 수 있다.

GPU readback은 별도 새 페이지에서 실행해야 한다. 같은 페이지에서 먼저 diagnostic을 돌리고 readback 없는 구간을 재면 backend 변경이 지속될 수 있어 대조군이 되지 않는다.

## 확인 방법

1. 같은 Chrome 빌드, 장치, viewport, DPR, foreground 조건에서 매번 새 페이지로 기본 패스를 720p와 1080p에서 실행한다. 이 결과만 FPS 기준값으로 쓴다.
2. 다시 새 페이지를 열어 `?readback=1` 진단 패스를 실행한다. Playwright의 `page.on('console')`로 Canvas readback 경고와 발생 시각을 보존한다. 기존 `runtimeErrors`는 `error`와 `unhandledrejection`만 수집하므로 콘솔 경고 증거가 아니다.
3. 두 실행의 `intervalWindows`를 비교한다. 진단 패스에서 특정 읽기 이후에만 FPS가 지속 하락하고, 동시에 backend 전환 경고 또는 trace 증거가 있으면 readback 영향이라는 설명이 강해진다. 한두 구간만 느린 경우에는 직접 flush나 외부 잡음도 함께 고려한다.
4. `getContextAttributes().willReadFrequently`의 전후 값은 설정 힌트 확인에 쓸 수 있지만, GPU/CPU backend의 직접 증거로 취급하지 않는다. 가능하면 Chrome trace/Canvas 이벤트와 CDP GPU 정보를 함께 수집한다.
5. 기본 패스도 느리면 readback 가설과 무관한 실제 병목이다. renderer JS 시간, 해상도별 픽셀 수, Canvas raster/compositor trace를 함께 비교한다.

## 근거

- [Chromium Canvas2D 구현](https://chromium.googlesource.com/chromium/src/+/fe487bfab3b23b7a107987b0a2f7b65222ae7ae0/third_party/blink/renderer/modules/canvas/canvas2d/base_rendering_context_2d.cc): 반복 readback을 집계하고 조건부로 acceleration을 비활성화하는 구현 경로가 있다. 이 revision과 Chrome 151의 일치 여부는 확인되지 않았다.
- [WHATWG HTML Canvas specification](https://html.spec.whatwg.org/multipage/canvas.html): 사용자 에이전트가 가속/소프트웨어 Canvas를 선택할 수 있으며, 잦은 readback은 `willReadFrequently` 선택에 영향을 준다.
- [Chrome Developers: Canvas2D willReadFrequently](https://developer.chrome.com/blog/canvas2d): `getImageData()` readback 비용과 `willReadFrequently` 힌트의 관계를 설명한다.
- [MDN: getContextAttributes](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getContextAttributes): `willReadFrequently`가 잦은 readback을 위한 software acceleration 사용 여부와 연관됨을 설명한다.

좁은 TypeScript 검사(`tests/performance.ts`와 직접 참조하는 `src/**/*.ts`)는 오류 없이 통과했다. 브라우저나 전체 빌드는 실행하지 않았다.
