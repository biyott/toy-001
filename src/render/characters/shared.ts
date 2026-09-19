import { rounded, line, INK, type Ctx } from '../art';
export type { Ctx } from '../art';

/** Four discrete frames per pose; painters must stay deterministic and side-effect free. */
export type CharacterPose = 'idle' | 'walk' | 'windup' | 'attack' | 'recover' | 'hit' | 'dash';
export type CharacterPainter = (ctx: Ctx, frame: number, pose: CharacterPose) => void;
export const CHARACTER_CANVAS = { width: 128, height: 144, anchorX: 64, anchorY: 132 } as const;

export function boots(ctx: Ctx, frame: number, color = '#66564b'): void {
  const stride = [0, -3, 0, 3][frame % 4];
  rounded(ctx, 44, 119 + stride, 17, 13, 6, color, INK, 2.5);
  rounded(ctx, 67, 119 - stride, 17, 13, 6, color, INK, 2.5);
  line(ctx, [48, 122 + stride, 56, 122 + stride], '#b29370', 2);
  line(ctx, [71, 122 - stride, 79, 122 - stride], '#b29370', 2);
}

