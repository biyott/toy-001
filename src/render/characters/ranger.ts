import { ellipse, eye, INK, line, polygon, rounded, star, type Ctx } from '../art';
import { boots, type CharacterPose } from './shared';

const SKIN = '#f4d3aa';
const CLOAK = '#618c71';
const CLOAK_LIGHT = '#95ad80';
const BOW = '#a87e4b';
const BOW_LIGHT = '#d1a268';
const STRING = '#f6e0b8';
const ARROW = '#835f47';

function arm(ctx: Ctx, points: number[]): void {
  line(ctx, points, INK, 11);
  line(ctx, points, CLOAK_LIGHT, 7);
}

function hand(ctx: Ctx, x: number, y: number): void {
  ellipse(ctx, x, y, 6, 6, SKIN, INK, 2);
}

function bow(
  ctx: Ctx,
  topX: number,
  topY: number,
  gripX: number,
  gripY: number,
  bottomX: number,
  bottomY: number,
  stringX = gripX,
  stringY = gripY,
): void {
  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.quadraticCurveTo(topX + 20, (topY + gripY) / 2, gripX, gripY);
  ctx.quadraticCurveTo(bottomX + 20, (bottomY + gripY) / 2, bottomX, bottomY);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(topX, topY);
  ctx.quadraticCurveTo(topX + 20, (topY + gripY) / 2, gripX, gripY);
  ctx.quadraticCurveTo(bottomX + 20, (bottomY + gripY) / 2, bottomX, bottomY);
  ctx.strokeStyle = BOW;
  ctx.lineWidth = 4;
  ctx.stroke();
  line(ctx, [topX + 2, topY + 3, topX + 11, topY + 13], BOW_LIGHT, 1.5);
  line(ctx, [topX, topY, stringX, stringY, bottomX, bottomY], STRING, 1.5);
}

function arrow(ctx: Ctx, tailX: number, y: number, tipX: number): void {
  line(ctx, [tailX, y, tipX - 4, y], ARROW, 2);
  polygon(ctx, [tipX, y, tipX - 8, y - 5, tipX - 8, y + 5], '#dce2d4', INK, 1.2);
  line(ctx, [tailX + 1, y, tailX - 4, y - 4], '#cf755c', 1.5);
  line(ctx, [tailX + 1, y, tailX - 4, y + 4], '#cf755c', 1.5);
}

function paintWeaponAndArms(ctx: Ctx, frame: number, pose: CharacterPose): void {
  if (pose === 'windup') {
    const drawX = [89, 83, 77, 72][frame];
    const drawY = [102, 100, 98, 97][frame];
    arm(ctx, [43, 98, 57, 105, drawX, drawY]);
    arm(ctx, [80, 97, 91, 98, 103, 99]);
    bow(ctx, 100, 72, 104, 99, 100, 127, drawX, drawY);
    arrow(ctx, drawX - 1, drawY, 125);
    hand(ctx, drawX, drawY);
    hand(ctx, 103, 99);
    return;
  }

  if (pose === 'attack') {
    const recoilX = [64, 59, 63, 68][frame];
    const recoilY = [94, 92, 96, 99][frame];
    const wobble = [0, 2, -1, 0][frame];
    arm(ctx, [43, 98, 53, 103, recoilX, recoilY]);
    arm(ctx, [80, 97, 92, 98, 103, 99]);
    bow(ctx, 100 + wobble, 72, 104, 99, 100 - wobble, 127);

    if (frame < 2) {
      const tailX = 105 + frame * 10;
      arrow(ctx, tailX, 98 - frame, 127);
      line(ctx, [tailX - 12, 104, tailX - 3, 104], '#f1d29b', 2);
    } else {
      line(ctx, [108, 92, 121, 90], '#f1d29b', 2);
      line(ctx, [111, 105, 125, 105], '#f1d29b', 2);
    }
    if (frame === 0) star(ctx, 106, 98, 5, '#f5d494');
    hand(ctx, recoilX, recoilY);
    hand(ctx, 103, 99);
    return;
  }

  if (pose === 'recover') {
    const settle = [0, 2, 1, 0][frame];
    arm(ctx, [43, 98, 58, 103, 76, 104 - settle]);
    arm(ctx, [80, 97, 89, 103, 99, 106]);
    bow(ctx, 94, 87 + settle, 100, 106, 111, 127, 100, 106);
    hand(ctx, 76, 104 - settle);
    hand(ctx, 99, 106);
    return;
  }

  if (pose === 'hit') {
    const shake = [-2, 2, -1, 1][frame];
    arm(ctx, [43, 98, 35 + shake, 91, 29 + shake, 85]);
    arm(ctx, [80, 98, 91 + shake, 91, 101 + shake, 86]);
    bow(ctx, 101 + shake, 78, 107 + shake, 103, 112 + shake, 126);
    hand(ctx, 29 + shake, 85);
    hand(ctx, 101 + shake, 86);
    return;
  }

  if (pose === 'dash') {
    const flutter = [0, -2, 1, -1][frame];
    arm(ctx, [44, 99, 57, 103, 72, 104]);
    arm(ctx, [80, 97, 91, 101, 101, 106]);
    bow(ctx, 94, 79 + flutter, 101, 105, 96, 128);
    hand(ctx, 72, 104);
    hand(ctx, 101, 105);
    return;
  }

  const walkSwing = pose === 'walk' ? [0, 2, 0, -2][frame] : 0;
  arm(ctx, [43, 98, 39, 101 + walkSwing, 37, 103 + walkSwing]);
  arm(ctx, [80, 97, 88, 99 - walkSwing, 101, 101]);
  bow(ctx, 101, 76, 104, 101, 101, 127);
  arrow(ctx, 87, 101, 125);
  hand(ctx, 37, 103 + walkSwing);
  hand(ctx, 101, 101);
}

export function paintRanger(ctx: Ctx, frame: number, pose: CharacterPose = 'idle'): void {
  const f = ((frame % 4) + 4) % 4;
  const strideFrame = pose === 'walk' || pose === 'dash' ? f : 0;
  const hitLean = pose === 'hit' ? [-2, 2, -1, 1][f] : 0;
  const dashLean = pose === 'dash' ? 3 : 0;
  const lean = hitLean + dashLean;
  const cloth = pose === 'dash'
    ? [-7, -3, -9, -5][f]
    : pose === 'walk'
      ? [0, -2, 1, 3][f]
      : pose === 'hit'
        ? [3, -3, 2, -2][f]
        : [0, 1, 0, -1][f];

  ctx.save();
  boots(ctx, strideFrame);
  polygon(ctx, [43 + lean, 90, 80 + lean, 90, 90 + lean + cloth, 125, 64 + lean, 131, 38 + lean + cloth, 127], CLOAK, INK, 2.5);
  polygon(ctx, [43 + lean, 95, 51 + lean, 99, 49 + lean + cloth, 125, 39 + lean + cloth, 126], '#769a79');
  rounded(ctx, 48 + lean, 94, 29, 28, 9, CLOAK_LIGHT, INK, 2);
  line(ctx, [44 + lean, 114, 80 + lean, 114], '#866448', 5);
  rounded(ctx, 60 + lean, 110, 8, 8, 2, '#e2b763', '#765e48', 1.2);

  ellipse(ctx, 63 + lean, 72, 31, 28, '#648c70', INK, 2.8);
  ellipse(ctx, 63 + lean, 78, 25, 22, SKIN, INK, 2);
  polygon(ctx, [38 + lean, 75, 41 + lean, 54, 61 + lean, 46, 87 + lean, 57, 92 + lean, 75, 78 + lean, 67, 69 + lean, 67, 51 + lean, 74, 48 + lean, 65], '#aa7048', INK, 2);
  polygon(ctx, [31 + lean, 62, 38 + lean, 45, 78 + lean, 34, 95 + lean, 60, 75 + lean, 54, 50 + lean, 57], '#6f9877', INK, 2.5);
  line(ctx, [43 + lean, 52, 77 + lean, 43], '#a6be88', 3);

  const featherSway = pose === 'dash' ? [-4, -7, -5, -8][f] : [0, 1, 0, -1][f];
  polygon(ctx, [83 + lean, 45, 88 + lean + featherSway, 27, 102 + lean + featherSway, 17, 104 + lean + featherSway, 29, 88 + lean, 48], '#f1d29b', INK, 1.7);
  line(ctx, [89 + lean, 43, 99 + lean + featherSway, 23], '#fff0c7', 1.3);

  const eyeY = pose === 'hit' ? 80 : 79;
  if (pose === 'hit') {
    line(ctx, [49 + lean, eyeY - 2, 56 + lean, eyeY + 2], '#354245', 2.5);
    line(ctx, [70 + lean, eyeY + 2, 77 + lean, eyeY - 2], '#354245', 2.5);
  } else {
    eye(ctx, 53 + lean, eyeY, 5);
    eye(ctx, 74 + lean, eyeY, 5, pose === 'windup' || pose === 'attack' ? 1 : 0);
  }
  ellipse(ctx, 44 + lean, 86, 5, 3, '#e4a88c');
  ellipse(ctx, 83 + lean, 86, 5, 3, '#e4a88c');
  if (pose === 'hit') {
    line(ctx, [59 + lean, 93, 64 + lean, 90, 69 + lean, 93], '#8b705d', 2);
  } else {
    line(ctx, [59 + lean, 91, 64 + lean, 93, 68 + lean, 91], '#8b705d', 2);
  }

  ctx.save();
  ctx.translate(lean, 0);
  paintWeaponAndArms(ctx, f, pose);
  ctx.restore();
  ctx.restore();
}
