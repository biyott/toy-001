import type { InputFrame, Player } from '../types';

type DashDisplayState = Pick<Player,
  | 'dashCharges'
  | 'dashMaxCharges'
  | 'dashRechargeRemaining'
  | 'dashRechargeDuration'
  | 'dashReuseDelay'
  | 'dashCooldown'
>;

export interface TouchControls {
  read(): InputFrame;
  clear(): void;
  setEnabled(enabled: boolean): void;
  setDashState(player: Pick<Player,
    | 'dashCharges'
    | 'dashMaxCharges'
    | 'dashRechargeRemaining'
    | 'dashRechargeDuration'
    | 'dashReuseDelay'
    | 'dashCooldown'
  >): void;
  dispose(): void;
}

const DEAD_ZONE = 0.12;
const HOST_ENABLED_CLASS = 'touch-controls-host--enabled';

type PointerSlot = number | null;

export function createTouchControls(root: HTMLElement): TouchControls {
  const document = root.ownerDocument;
  const view = document.defaultView;
  if (!view) throw new Error('Touch controls require a document with a window.');

  const controls = document.createElement('section');
  controls.className = 'touch-controls';
  controls.setAttribute('aria-label', '터치 조작');
  controls.setAttribute('aria-hidden', 'true');
  controls.hidden = true;
  controls.dataset.testid = 'touch-controls';

  const joystick = document.createElement('div');
  joystick.className = 'touch-controls__joystick';
  joystick.setAttribute('role', 'group');
  joystick.setAttribute('aria-label', '이동 조이스틱');
  joystick.dataset.testid = 'touch-joystick';

  const stick = document.createElement('span');
  stick.className = 'touch-controls__stick';
  stick.setAttribute('aria-hidden', 'true');
  joystick.append(stick);

  const actions = document.createElement('div');
  actions.className = 'touch-controls__actions';

  const pauseButton = document.createElement('button');
  pauseButton.type = 'button';
  pauseButton.className = 'touch-controls__pause';
  pauseButton.setAttribute('aria-label', '일시정지');
  pauseButton.dataset.testid = 'touch-pause';
  pauseButton.textContent = 'Ⅱ';
  pauseButton.disabled = true;

  const dashButton = document.createElement('button');
  dashButton.type = 'button';
  dashButton.className = 'touch-controls__dash';
  dashButton.setAttribute('aria-label', '대시');
  dashButton.dataset.testid = 'touch-dash';
  dashButton.disabled = true;

  const dashLabel = document.createElement('span');
  dashLabel.className = 'touch-controls__dash-label';
  dashLabel.textContent = '대시';
  const dashCount = document.createElement('strong');
  dashCount.className = 'touch-controls__dash-count';
  dashCount.textContent = '—';
  const dashProgress = document.createElement('span');
  dashProgress.className = 'touch-controls__dash-progress';
  dashProgress.setAttribute('aria-hidden', 'true');
  const dashProgressFill = document.createElement('span');
  dashProgressFill.className = 'touch-controls__dash-progress-fill';
  dashProgress.append(dashProgressFill);
  const dashStatus = document.createElement('span');
  dashStatus.className = 'touch-controls__dash-status';
  dashStatus.textContent = '준비';
  dashButton.append(dashLabel, dashCount, dashProgress, dashStatus);

  actions.append(pauseButton, dashButton);
  controls.append(joystick, actions);
  root.append(controls);

  let enabled = false;
  let disposed = false;
  let moveX = 0;
  let moveY = 0;
  let dashPressed = false;
  let pausePressed = false;
  let joystickPointer: PointerSlot = null;
  let dashPointer: PointerSlot = null;
  let pausePointer: PointerSlot = null;

  const removers: Array<() => void> = [];
  const listen = (
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
  ): void => {
    target.addEventListener(type, listener, options);
    removers.push(() => target.removeEventListener(type, listener, options));
  };

  const accepts = (event: PointerEvent): boolean =>
    enabled && (event.pointerType !== 'mouse' || event.button === 0);

  const capture = (element: HTMLElement, pointerId: number): void => {
    try { element.setPointerCapture(pointerId); } catch { /* Pointer may already be gone. */ }
  };

  const release = (element: HTMLElement, pointerId: PointerSlot): void => {
    if (pointerId === null) return;
    try {
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    } catch { /* A cancel/lost capture may have released it first. */ }
  };

  const setPressed = (element: HTMLElement, pressed: boolean): void => {
    element.classList.toggle('is-active', pressed);
  };

  const resetJoystick = (releaseCapture = true): void => {
    const pointerId = joystickPointer;
    joystickPointer = null;
    moveX = 0;
    moveY = 0;
    stick.style.transform = '';
    setPressed(joystick, false);
    if (releaseCapture) release(joystick, pointerId);
  };

  const resetButton = (
    element: HTMLButtonElement,
    current: PointerSlot,
    assign: (pointer: PointerSlot) => void,
    releaseCapture = true,
  ): void => {
    assign(null);
    setPressed(element, false);
    if (releaseCapture) release(element, current);
  };

  const updateJoystick = (event: PointerEvent): void => {
    const rect = joystick.getBoundingClientRect();
    const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
    const rawX = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const rawY = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const rawLength = Math.hypot(rawX, rawY);

    if (rawLength <= DEAD_ZONE) {
      moveX = 0;
      moveY = 0;
    } else {
      const clampedLength = Math.min(1, rawLength);
      const remappedLength = (clampedLength - DEAD_ZONE) / (1 - DEAD_ZONE);
      const scale = remappedLength / rawLength;
      moveX = rawX * scale;
      moveY = rawY * scale;
    }

    const travel = Math.min(rect.width, rect.height) * 0.28;
    stick.style.transform = `translate(${(moveX * travel).toFixed(2)}px, ${(moveY * travel).toFixed(2)}px)`;
  };

  const onJoystickDown = (rawEvent: Event): void => {
    const event = rawEvent as PointerEvent;
    if (!accepts(event) || joystickPointer !== null) return;
    event.preventDefault();
    joystickPointer = event.pointerId;
    capture(joystick, event.pointerId);
    setPressed(joystick, true);
    updateJoystick(event);
  };

  const onJoystickMove = (rawEvent: Event): void => {
    const event = rawEvent as PointerEvent;
    if (event.pointerId !== joystickPointer) return;
    event.preventDefault();
    updateJoystick(event);
  };

  const onJoystickEnd = (rawEvent: Event): void => {
    const event = rawEvent as PointerEvent;
    if (event.pointerId !== joystickPointer) return;
    event.preventDefault();
    resetJoystick(event.type !== 'lostpointercapture');
  };

  const bindEdgeButton = (
    element: HTMLButtonElement,
    getPointer: () => PointerSlot,
    setPointer: (pointer: PointerSlot) => void,
    setEdge: () => void,
  ): void => {
    const down = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      if (!accepts(event) || getPointer() !== null) return;
      event.preventDefault();
      setPointer(event.pointerId);
      capture(element, event.pointerId);
      setPressed(element, true);
      setEdge();
    };
    const end = (rawEvent: Event): void => {
      const event = rawEvent as PointerEvent;
      const pointer = getPointer();
      if (event.pointerId !== pointer) return;
      event.preventDefault();
      resetButton(element, pointer, setPointer, event.type !== 'lostpointercapture');
    };
    listen(element, 'pointerdown', down, { passive: false });
    listen(element, 'pointerup', end, { passive: false });
    listen(element, 'pointercancel', end, { passive: false });
    listen(element, 'lostpointercapture', end, { passive: false });
  };

  listen(joystick, 'pointerdown', onJoystickDown, { passive: false });
  listen(joystick, 'pointermove', onJoystickMove, { passive: false });
  listen(joystick, 'pointerup', onJoystickEnd, { passive: false });
  listen(joystick, 'pointercancel', onJoystickEnd, { passive: false });
  listen(joystick, 'lostpointercapture', onJoystickEnd, { passive: false });

  bindEdgeButton(
    dashButton,
    () => dashPointer,
    (pointer) => { dashPointer = pointer; },
    () => { dashPressed = true; },
  );
  bindEdgeButton(
    pauseButton,
    () => pausePointer,
    (pointer) => { pausePointer = pointer; },
    () => { pausePressed = true; },
  );

  const clear = (): void => {
    resetJoystick();
    resetButton(dashButton, dashPointer, (pointer) => { dashPointer = pointer; });
    resetButton(pauseButton, pausePointer, (pointer) => { pausePointer = pointer; });
    dashPressed = false;
    pausePressed = false;
  };

  const syncVisualViewport = (): void => {
    const viewport = view.visualViewport;
    if (!viewport) return;
    controls.style.setProperty('--touch-vv-left', `${viewport.offsetLeft}px`);
    controls.style.setProperty('--touch-vv-top', `${viewport.offsetTop}px`);
    controls.style.setProperty('--touch-vv-width', `${viewport.width}px`);
    controls.style.setProperty('--touch-vv-height', `${viewport.height}px`);
  };

  const onBlur = (): void => clear();
  const onVisibilityChange = (): void => { if (document.hidden) clear(); };
  listen(view, 'blur', onBlur);
  listen(document, 'visibilitychange', onVisibilityChange);
  listen(view, 'resize', syncVisualViewport);
  if (view.visualViewport) {
    listen(view.visualViewport, 'resize', syncVisualViewport);
    listen(view.visualViewport, 'scroll', syncVisualViewport);
  }
  syncVisualViewport();

  return {
    read(): InputFrame {
      const frame = { moveX, moveY, dashPressed, pausePressed };
      dashPressed = false;
      pausePressed = false;
      return frame;
    },
    clear,
    setEnabled(nextEnabled: boolean): void {
      if (disposed) return;
      if (enabled === nextEnabled) {
        if (!enabled) clear();
        return;
      }
      if (!nextEnabled) clear();
      enabled = nextEnabled;
      controls.hidden = !enabled;
      controls.setAttribute('aria-hidden', String(!enabled));
      dashButton.disabled = !enabled;
      pauseButton.disabled = !enabled;
      root.classList.toggle(HOST_ENABLED_CLASS, enabled);
      if (!enabled && controls.contains(document.activeElement)) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
      if (enabled) syncVisualViewport();
    },
    setDashState(player: DashDisplayState): void {
      if (disposed) return;
      const maximum = Number.isFinite(player.dashMaxCharges)
        ? Math.max(0, Math.floor(player.dashMaxCharges)) : 0;
      const charges = Number.isFinite(player.dashCharges)
        ? Math.max(0, Math.min(maximum, Math.floor(player.dashCharges))) : 0;
      const duration = Number.isFinite(player.dashRechargeDuration)
        ? Math.max(0, player.dashRechargeDuration) : 0;
      const remaining = charges < maximum && Number.isFinite(player.dashRechargeRemaining)
        ? Math.max(0, player.dashRechargeRemaining) : 0;
      const reuse = Number.isFinite(player.dashReuseDelay)
        ? Math.max(0, player.dashReuseDelay) : 0;
      const fallbackCooldown = Number.isFinite(player.dashCooldown)
        ? Math.max(0, player.dashCooldown) : 0;
      const nextCharge = remaining > 0 ? remaining : charges < maximum ? fallbackCooldown : 0;
      const progress = charges >= maximum
        ? 1
        : duration > 0
          ? Math.max(0, Math.min(1, 1 - nextCharge / duration))
          : 0;

      dashCount.textContent = `${charges}/${maximum}`;
      dashButton.style.setProperty('--dash-charge-progress', `${(progress * 100).toFixed(1)}%`);

      if (charges <= 0) {
        dashButton.dataset.state = 'empty';
        dashStatus.textContent = nextCharge > 0 ? `${nextCharge.toFixed(1)}초` : '충전 중';
        dashButton.setAttribute('aria-label', nextCharge > 0
          ? `대시0회남음, 다음충전${nextCharge.toFixed(1)}초`
          : '대시0회남음, 충전중');
      } else if (reuse > 0) {
        dashButton.dataset.state = 'reuse';
        dashStatus.textContent = `대기 ${reuse.toFixed(1)}`;
        dashButton.setAttribute('aria-label', `대시${charges}회남음, 재사용대기${reuse.toFixed(1)}초`);
      } else if (charges < maximum) {
        dashButton.dataset.state = 'recharging';
        dashStatus.textContent = nextCharge > 0 ? `${nextCharge.toFixed(1)}초` : '충전 중';
        dashButton.setAttribute('aria-label', nextCharge > 0
          ? `대시${charges}회남음, 다음충전${nextCharge.toFixed(1)}초`
          : `대시${charges}회남음, 충전중`);
      } else {
        dashButton.dataset.state = 'ready';
        dashStatus.textContent = '준비';
        dashButton.setAttribute('aria-label', `대시${charges}회남음, 충전완료`);
      }
    },
    dispose(): void {
      if (disposed) return;
      clear();
      enabled = false;
      disposed = true;
      for (const remove of removers.splice(0)) remove();
      root.classList.remove(HOST_ENABLED_CLASS);
      controls.remove();
    },
  };
}
