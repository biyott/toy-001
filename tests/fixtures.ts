import type { GameController, GameState, InputFrame } from '../src/types.ts';

export const NO_INPUT: InputFrame = { moveX: 0, moveY: 0, dashPressed: false, pausePressed: false };

/**
 * Unit-fixture-only escape hatch for otherwise expensive boundary setup.
 * This must never be used as evidence for the real browser playthrough: that
 * run may observe state but must reach every outcome through ordinary input.
 */
export function mutableStateFixture(game: GameController): GameState {
  return game.getState() as GameState;
}

export function stepFor(
  game: GameController,
  seconds: number,
  input: InputFrame | ((state: Readonly<GameState>) => InputFrame) = NO_INPUT,
  dt = 1 / 30,
): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) {
    game.step(Math.min(dt, seconds - elapsed), typeof input === 'function' ? input(game.getState()) : input);
  }
}

export function snapshot<T>(value: T): T {
  return structuredClone(value);
}
