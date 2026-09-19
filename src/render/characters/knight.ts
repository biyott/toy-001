import { ellipse, eye, INK, line, polygon, rounded, star, type Ctx } from '../art';
import { boots, type CharacterPose } from './shared';

type Face = 'normal' | 'braced' | 'hit' | 'dash';

interface PosePlan {
  cape: number[];
  leftArm: readonly [number, number, number, number];
  rightArm: readonly [number, number, number, number];
  shield: readonly [number, number, number];
  sword: readonly [number, number, number];
  face: Face;
}

const BASE_CAPE = [40, 88, 80, 88, 92, 126, 65, 121, 38, 128];
const ACTION_TWITCH = [-0.06, 0, 0.05, 0.1] as const;

function posePlan(pose: CharacterPose, frame: number): PosePlan {
  const twitch = ACTION_TWITCH[frame];
  switch (pose) {
    case 'windup':
      return {
        cape: BASE_CAPE,
        leftArm: [37, 95, 11, 13],
        rightArm: [84, 94, 10, 12],
        shield: [1, -5, -0.08],
        sword: [88, 96, -0.82 + twitch],
        face: 'braced',
      };
    case 'attack':
      return {
        cape: [40, 88, 80, 88, 91, 125, 64, 120, 34, 126],
        leftArm: [34, 102, 11, 13],
        rightArm: [79, 96, 11, 10],
        shield: [-3, 3, -0.12],
        sword: [80, 94, 1.25 + twitch * 0.45],
        face: 'braced',
      };
    case 'recover':
      return {
        cape: [40, 88, 80, 88, 92, 126, 65, 121, 36, 127],
        leftArm: [39, 99, 11, 13],
        rightArm: [83, 98, 10, 11],
        shield: [4, -2, 0.08],
        sword: [84, 95, 2.22 - twitch * 0.35],
        face: 'normal',
      };
    case 'hit':
      return {
        cape: [40, 88, 80, 88, 88, 125, 62, 120, 36, 126],
        leftArm: [41, 94, 11, 13],
        rightArm: [91, 103, 10, 12],
        shield: [6, -8, 0.12],
        sword: [98, 109, -0.18],
        face: 'hit',
      };
    case 'dash': {
      const tail = [0, -2, 1, -1][frame];
      return {
        cape: [42, 88, 79, 88, 88, 123, 60, 119, 22, 123 + tail, 34, 112, 18, 116 + tail],
        leftArm: [33, 101, 10, 12],
        rightArm: [91, 99, 10, 11],
        shield: [-5, 0, -0.08],
        sword: [99, 105, -0.24 + twitch * 0.3],
        face: 'dash',
      };
    }
    case 'idle':
    case 'walk':
    default:
      return {
        cape: BASE_CAPE,
        leftArm: [36, 99, 11, 13],
        rightArm: [89, 101, 10, 12],
        shield: [0, 0, 0],
        sword: [98, 107, -0.35],
        face: 'normal',
      };
  }
}

function paintFace(ctx: Ctx, face: Face): void {
  ellipse(ctx, 63, 77, 25, 21, '#f5d9ad', '#5e6760', 2.2);
  ellipse(ctx, 48, 83, 6, 3, '#e5ac95');
  ellipse(ctx, 80, 83, 6, 3, '#e5ac95');

  if (face === 'hit') {
    line(ctx, [49, 73, 56, 78, 50, 80], '#354245', 2.8);
    line(ctx, [78, 73, 71, 78, 77, 80], '#354245', 2.8);
    line(ctx, [59, 89, 64, 86, 69, 89], '#8e725e', 1.8);
  } else if (face === 'braced') {
    line(ctx, [49, 74, 57, 76], '#354245', 3.2);
    line(ctx, [70, 76, 78, 74], '#354245', 3.2);
    line(ctx, [60, 89, 68, 89], '#8e725e', 1.8);
  } else if (face === 'dash') {
    line(ctx, [49, 74, 57, 75], '#354245', 3.4);
    line(ctx, [70, 75, 78, 74], '#354245', 3.4);
    line(ctx, [61, 88, 68, 87], '#8e725e', 1.8);
  } else {
    eye(ctx, 53, 75, 5.5);
    eye(ctx, 74, 75, 5.5);
    line(ctx, [60, 88, 64, 90, 68, 88], '#8e725e', 1.8);
  }
}

function paintShield(ctx: Ctx, dx: number, dy: number, rotation: number): void {
  ctx.save();
  ctx.translate(35 + dx, 107 + dy);
  ctx.rotate(rotation);
  polygon(ctx, [-14, -8, 0, -16, 14, -8, 11, 9, 0, 18, -11, 9], '#769ba8', INK, 2.5);
  polygon(ctx, [-9, -6, 0, -10, 9, -6, 7, 6, 0, 12, -7, 6], '#a6c6cd', '#d5cc8d', 2);
  star(ctx, 0, 0, 6, '#f9e4a2');
  ctx.restore();
}

function paintSword(ctx: Ctx, x: number, y: number, rotation: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  polygon(ctx, [-4, -10, -5, -35, 0, -46, 5, -35, 4, -10], '#d8e8e3', INK, 2);
  polygon(ctx, [0, -42, 4, -34, 3, -12, 0, -12], '#a3c2cc');
  line(ctx, [-10, -8, 10, -8], '#e2bc66', 5);
  line(ctx, [0, -5, 0, 5], '#6f604f', 5);
  ellipse(ctx, 0, 6, 3.5, 3.5, '#e0b662', INK, 1.3);
  ctx.restore();
}

export function paintKnight(ctx: Ctx, frame: number, pose: CharacterPose = 'idle'): void {
  const f = ((Math.trunc(frame) % 4) + 4) % 4;
  const plan = posePlan(pose, f);
  const [leftX, leftY, leftRx, leftRy] = plan.leftArm;
  const [rightX, rightY, rightRx, rightRy] = plan.rightArm;

  ctx.save();
  polygon(ctx, plan.cape, '#517d94', INK, 2.5);
  polygon(ctx, [47, 90, 64, 94, 65, 121, 38, 128], '#78aebb');
  boots(ctx, f);
  rounded(ctx, 43, 92, 42, 33, 13, '#bfcccb', INK, 2.8);
  rounded(ctx, 49, 94, 29, 19, 8, '#e3e8d9');
  line(ctx, [45, 115, 83, 115], '#827b64', 6);
  rounded(ctx, 59, 111, 10, 9, 2, '#e7be62', '#7a705a', 1.5);
  ellipse(ctx, leftX, leftY, leftRx, leftRy, '#c2cfce', INK, 2.5);
  ellipse(ctx, rightX, rightY, rightRx, rightRy, '#b0c1c4', INK, 2.5);

  // Friendly open-face helmet, with a large face and visible expression.
  ellipse(ctx, 63, 71, 33, 30, '#9eb7be', INK, 3);
  ellipse(ctx, 61, 66, 28, 23, '#d6e2df');
  paintFace(ctx, plan.face);
  polygon(ctx, [34, 66, 36, 48, 55, 40, 74, 41, 92, 52, 94, 69, 81, 58, 49, 59], '#cbdcdb', INK, 2.7);
  polygon(ctx, [44, 47, 59, 42, 77, 47, 70, 52, 48, 54], '#eff0d9');
  rounded(ctx, 59, 37, 10, 26, 4, '#e4bb60', '#777158', 2);
  polygon(ctx, [64, 39, 66, 23, 81, 15, 96, 20, 88, 27, 74, 29, 72, 40], '#dba46e', INK, 2.2);
  polygon(ctx, [70, 27, 81, 20, 91, 20, 85, 24], '#f2ca87');
  ellipse(ctx, 34, 71, 7, 16, '#a1bac1', INK, 2.3);
  ellipse(ctx, 93, 71, 6, 16, '#a1bac1', INK, 2.3);
  ellipse(ctx, 34, 67, 2, 6, '#dbe8e3');

  // The shield and sword carry the pose while the knight's proportions stay fixed.
  paintShield(ctx, ...plan.shield);
  paintSword(ctx, ...plan.sword);
  ctx.restore();
}
