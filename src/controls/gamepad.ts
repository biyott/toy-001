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

const DEADZONE = 0.2;
const MENU_ENTER = 0.65;
const MENU_RELEASE = 0.45;
const BUTTON_THRESHOLD = 0.5;

const BUTTON = {
  confirm: 0,
  back: 1,
  leftTrigger: 6,
  rightTrigger: 7,
  start: 9,
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

const ACTION = {
  dash: 1 << 0,
  pause: 1 << 1,
  confirm: 1 << 2,
  back: 1 << 3,
} as const;

const MENU = {
  up: 1 << 0,
  down: 1 << 1,
  left: 1 << 2,
  right: 1 << 3,
} as const;

const NEUTRAL_FRAME: InputFrame = {
  moveX: 0,
  moveY: 0,
  dashPressed: false,
  pausePressed: false,
};

function finiteAxis(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(-1, Math.min(1, value!)) : 0;
}

function buttonPressed(pad: Gamepad, index: number): boolean {
  const button = pad.buttons[index];
  return button !== undefined && (button.pressed || button.value >= BUTTON_THRESHOLD);
}

function rawStick(pad: Gamepad): readonly [number, number] {
  return [finiteAxis(pad.axes[0]), finiteAxis(pad.axes[1])];
}

function radialStick(pad: Gamepad): readonly [number, number] {
  const [x, y] = rawStick(pad);
  const magnitude = Math.hypot(x, y);
  if (magnitude <= DEADZONE) return [0, 0];
  const scaled = Math.min(1, (magnitude - DEADZONE) / (1 - DEADZONE));
  return [x / magnitude * scaled, y / magnitude * scaled];
}

function dpadMask(pad: Gamepad): number {
  const up = buttonPressed(pad, BUTTON.up);
  const down = buttonPressed(pad, BUTTON.down);
  const left = buttonPressed(pad, BUTTON.left);
  const right = buttonPressed(pad, BUTTON.right);
  let mask = 0;
  if (up && !down) mask |= MENU.up;
  if (down && !up) mask |= MENU.down;
  if (left && !right) mask |= MENU.left;
  if (right && !left) mask |= MENU.right;
  return mask;
}

function dpadVector(mask: number): readonly [number, number] {
  let x = Number(Boolean(mask & MENU.right)) - Number(Boolean(mask & MENU.left));
  let y = Number(Boolean(mask & MENU.down)) - Number(Boolean(mask & MENU.up));
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  return [x, y];
}

function actionMask(pad: Gamepad): number {
  const confirm = buttonPressed(pad, BUTTON.confirm);
  const dash = confirm
    || buttonPressed(pad, BUTTON.leftTrigger)
    || buttonPressed(pad, BUTTON.rightTrigger);
  let mask = 0;
  if (dash) mask |= ACTION.dash;
  if (buttonPressed(pad, BUTTON.start)) mask |= ACTION.pause;
  if (confirm) mask |= ACTION.confirm;
  if (buttonPressed(pad, BUTTON.back)) mask |= ACTION.back;
  return mask;
}

function updateStickMenuMask(pad: Gamepad, previous: number): number {
  const [x, y] = rawStick(pad);
  let mask = 0;
  if (previous & MENU.up ? y < -MENU_RELEASE : y < -MENU_ENTER) mask |= MENU.up;
  if (previous & MENU.down ? y > MENU_RELEASE : y > MENU_ENTER) mask |= MENU.down;
  if (previous & MENU.left ? x < -MENU_RELEASE : x < -MENU_ENTER) mask |= MENU.left;
  if (previous & MENU.right ? x > MENU_RELEASE : x > MENU_ENTER) mask |= MENU.right;
  return mask;
}

function isNeutral(pad: Gamepad): boolean {
  const [x, y] = rawStick(pad);
  return Math.hypot(x, y) <= DEADZONE
    && actionMask(pad) === 0
    && !buttonPressed(pad, BUTTON.up)
    && !buttonPressed(pad, BUTTON.down)
    && !buttonPressed(pad, BUTTON.left)
    && !buttonPressed(pad, BUTTON.right);
}

function hasMeaningfulInput(pad: Gamepad): boolean {
  return !isNeutral(pad);
}

function neutralReadout(
  activeIndex: number | null,
  connectedStandardPads: number,
  unsupportedPads: number,
): GamepadReadout {
  return {
    frame: { ...NEUTRAL_FRAME },
    menuPressed: [],
    activeIndex,
    connectedStandardPads,
    unsupportedPads,
  };
}

export function createGamepadReader(): GamepadReader {
  let activeIndex: number | null = null;
  let previousActionMask = 0;
  let previousMenuMask = 0;
  let previousStickMenuMask = 0;
  let waitingForNeutral = false;
  let connectedStandardPads = 0;
  let unsupportedPads = 0;

  function resetEdges(): void {
    previousActionMask = 0;
    previousMenuMask = 0;
    previousStickMenuMask = 0;
  }

  return {
    readGamepad(pads): GamepadReadout {
      const connected = pads.filter((pad): pad is Gamepad => pad !== null && pad.connected);
      const standard = connected
        .filter((pad) => pad.mapping === 'standard')
        .sort((a, b) => a.index - b.index);
      connectedStandardPads = standard.length;
      unsupportedPads = connected.length - standard.length;

      let active = activeIndex === null
        ? undefined
        : standard.find((pad) => pad.index === activeIndex);

      if (activeIndex !== null && active === undefined) {
        activeIndex = null;
        waitingForNeutral = true;
        resetEdges();
        return neutralReadout(null, connectedStandardPads, unsupportedPads);
      }

      if (waitingForNeutral) {
        const candidates = active === undefined ? standard : [active];
        if (candidates.every(isNeutral)) {
          waitingForNeutral = false;
          resetEdges();
        }
        return neutralReadout(activeIndex, connectedStandardPads, unsupportedPads);
      }

      if (active === undefined) {
        active = standard.find(hasMeaningfulInput);
        if (active === undefined) {
          return neutralReadout(null, connectedStandardPads, unsupportedPads);
        }
        activeIndex = active.index;
        resetEdges();
      }

      const currentActionMask = actionMask(active);
      const padMenuMask = dpadMask(active);
      const currentStickMenuMask = updateStickMenuMask(active, previousStickMenuMask);
      const currentMenuMask = padMenuMask === 0 ? currentStickMenuMask : padMenuMask;
      const pressedActions = currentActionMask & ~previousActionMask;
      const pressedMenu = currentMenuMask & ~previousMenuMask;

      previousActionMask = currentActionMask;
      previousMenuMask = currentMenuMask;
      previousStickMenuMask = currentStickMenuMask;

      const movement = padMenuMask === 0 ? radialStick(active) : dpadVector(padMenuMask);
      const menuPressed: MenuAction[] = [];
      if (pressedMenu & MENU.up) menuPressed.push('up');
      if (pressedMenu & MENU.down) menuPressed.push('down');
      if (pressedMenu & MENU.left) menuPressed.push('left');
      if (pressedMenu & MENU.right) menuPressed.push('right');
      if (pressedActions & ACTION.confirm) menuPressed.push('confirm');
      if (pressedActions & ACTION.back) menuPressed.push('back');

      return {
        frame: {
          moveX: movement[0],
          moveY: movement[1],
          dashPressed: Boolean(pressedActions & ACTION.dash),
          pausePressed: Boolean(pressedActions & ACTION.pause),
        },
        menuPressed,
        activeIndex,
        connectedStandardPads,
        unsupportedPads,
      };
    },

    clear(): void {
      resetEdges();
      waitingForNeutral = true;
    },

    diagnostics() {
      return {
        activeIndex,
        connectedStandardPads,
        unsupportedPads,
        waitingForNeutral,
      };
    },
  };
}

function finiteComponent(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function mergeInputFrames(a: InputFrame, b: InputFrame): InputFrame {
  let moveX = finiteComponent(a.moveX) + finiteComponent(b.moveX);
  let moveY = finiteComponent(a.moveY) + finiteComponent(b.moveY);
  const magnitude = Math.hypot(moveX, moveY);
  if (magnitude > 1) {
    moveX /= magnitude;
    moveY /= magnitude;
  }
  return {
    moveX,
    moveY,
    dashPressed: a.dashPressed || b.dashPressed,
    pausePressed: a.pausePressed || b.pausePressed,
  };
}
