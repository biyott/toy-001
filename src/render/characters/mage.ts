import { ellipse, eye, INK, line, polygon, star, type Ctx } from '../art';
import { boots, type CharacterPose } from './shared';

interface StaffPose {
  handX: number;
  handY: number;
  footX: number;
  footY: number;
  headX: number;
  headY: number;
  orbRadius: number;
}

function staffPose(pose: CharacterPose): StaffPose {
  switch (pose) {
    case 'windup':
      return { handX: 86, handY: 92, footX: 94, footY: 124, headX: 105, headY: 43, orbRadius: 10 };
    case 'attack':
      return { handX: 87, handY: 94, footX: 76, footY: 116, headX: 107, headY: 62, orbRadius: 10 };
    case 'recover':
      return { handX: 91, handY: 106, footX: 97, footY: 126, headX: 115, headY: 80, orbRadius: 9 };
    case 'dash':
      return { handX: 88, handY: 102, footX: 94, footY: 124, headX: 85, headY: 66, orbRadius: 9 };
    case 'hit':
      return { handX: 91, handY: 108, footX: 98, footY: 126, headX: 107, headY: 76, orbRadius: 9 };
    default:
      return { handX: 91, handY: 104, footX: 98, footY: 125, headX: 101, headY: 62, orbRadius: 10 };
  }
}

function paintFace(ctx: Ctx, pose: CharacterPose): void {
  if (pose === 'hit') {
    line(ctx, [48, 73, 55, 79], '#354245', 2.8);
    line(ctx, [55, 73, 48, 79], '#354245', 2.8);
    line(ctx, [70, 78, 77, 73], '#354245', 2.8);
    line(ctx, [70, 73, 77, 79], '#354245', 2.8);
    ellipse(ctx, 63, 89, 3.5, 2.5, '#876b61');
    return;
  }

  if (pose === 'dash') {
    eye(ctx, 53, 77, 4.8, 1);
    eye(ctx, 74, 77, 4.8, 1);
    line(ctx, [47, 69, 55, 70], '#6d5a62', 2);
    line(ctx, [70, 70, 78, 68], '#6d5a62', 2);
    line(ctx, [60, 89, 68, 89], '#876b61', 2);
    return;
  }

  if (pose === 'windup') {
    eye(ctx, 52, 76, 5.5, 1);
    eye(ctx, 73, 76, 5.5, 1);
    ellipse(ctx, 64, 89, 2.5, 3.2, '#876b61');
    return;
  }

  if (pose === 'attack') {
    line(ctx, [48, 76, 55, 78], '#354245', 3);
    eye(ctx, 73, 76, 5.5, 1.1);
    line(ctx, [59, 89, 67, 87], '#876b61', 2);
    return;
  }

  eye(ctx, 52, 76, 5.5);
  eye(ctx, 73, 76, 5.5);
  line(ctx, [58, 88, 63, 90, 67, 87], '#876b61', 2);
}

function paintStaff(ctx: Ctx, staff: StaffPose, frame: number, pose: CharacterPose): void {
  line(ctx, [staff.footX, staff.footY, staff.headX, staff.headY + staff.orbRadius - 2], '#866754', 6);
  line(ctx, [staff.handX + 1, staff.handY - 1, staff.headX, staff.headY + staff.orbRadius], '#c4a274', 2);

  const pulse = [0, 1.5, 3, 1.5][frame];
  if (pose === 'windup' || pose === 'attack') {
    ctx.save();
    ctx.globalAlpha = pose === 'attack' ? .24 : .14;
    ellipse(ctx, staff.headX, staff.headY, staff.orbRadius + 7 + pulse, staff.orbRadius + 7 + pulse, '#c6adff');
    ctx.restore();
  }

  ellipse(ctx, staff.headX, staff.headY, staff.orbRadius, staff.orbRadius + 2, '#a896d7', INK, 2);
  ellipse(ctx, staff.headX - 3, staff.headY - 4, staff.orbRadius * .35, staff.orbRadius * .42, '#d8caff');
  star(ctx, staff.headX - 2, staff.headY - 3, 5.5 + (pose === 'attack' ? pulse * .35 : 0), '#f9efd0');

  if (pose === 'windup') {
    const orbitX = [-12, -7, 5, 11][frame];
    const orbitY = [1, -11, -9, 3][frame];
    star(ctx, staff.headX + orbitX, staff.headY + orbitY, 3.5, '#e5c5ff');
  } else if (pose === 'attack') {
    const lift = [0, -2, 1, -1][frame];
    star(ctx, 121, 58 + lift, 4.5 + pulse * .25, '#ffe49b');
    star(ctx, 104, 48 - lift, 3.5, '#d9c2ff');
    line(ctx, [121, 69 + lift, 126, 72 + lift], '#d7b6ff', 2);
  }
}

export function paintMage(ctx: Ctx, frame: number, pose: CharacterPose = 'idle'): void {
  const currentFrame = ((frame % 4) + 4) % 4;
  const staff = staffPose(pose);

  ctx.save();
  try {
    boots(ctx, currentFrame, '#70617f');
    polygon(ctx, [47, 83, 79, 83, 91, 127, 65, 132, 37, 127], '#8c79b5', INK, 2.5);
    polygon(ctx, [49, 93, 58, 97, 54, 128, 40, 126], '#b59bd0');
    line(ctx, [47, 113, 81, 113], '#dfbd71', 4);
    star(ctx, 67, 116, 5, '#ffe1a0');

    if (pose === 'dash') {
      line(ctx, [34, 94, 23, 96], '#bda9db', 2.5);
      line(ctx, [37, 105, 19, 109], '#d5c9e5', 2);
    }

    ellipse(ctx, 62, 76, 27, 24, '#f2d9b5', INK, 2.5);
    ellipse(ctx, 45, 84, 5, 3, '#e4ae9c');
    ellipse(ctx, 80, 84, 5, 3, '#e4ae9c');
    paintFace(ctx, pose);

    polygon(ctx, [33, 68, 40, 39, 60, 43, 77, 64, 66, 62, 56, 56, 47, 62, 41, 71], '#ddd0bb', INK, 2);
    ellipse(ctx, 62, 57, 44, 12, '#8976b0', INK, 2.5);
    polygon(ctx, [30, 54, 51, 15, 67, 24, 80, 21, 76, 40, 95, 55], '#927bbb', INK, 2.8);
    polygon(ctx, [39, 49, 52, 20, 60, 28, 55, 47], '#b2a0d2');
    line(ctx, [37, 50, 88, 50], '#e4bd71', 5);
    star(ctx, 76, 39, 6, '#f5d494');

    paintStaff(ctx, staff, currentFrame, pose);

    if (pose === 'attack') {
      line(ctx, [49, 99, 75, 91, 91, 78], '#8c79b5', 8);
      ellipse(ctx, 93, 76, 8, 8, '#f2d9b5', INK, 2);
      ellipse(ctx, staff.handX, staff.handY, 8, 8, '#f2d9b5', INK, 2);
      star(ctx, 99, 72, 3.5 + currentFrame * .25, '#ffe6a7');
    } else if (pose === 'windup') {
      line(ctx, [38, 103, 61, 96, 78, 94], '#8c79b5', 8);
      ellipse(ctx, 78, 94, 8, 8, '#f2d9b5', INK, 2);
      ellipse(ctx, staff.handX, staff.handY, 8.5, 8.5, '#f2d9b5', INK, 2);
    } else if (pose === 'recover') {
      ellipse(ctx, 38, 104, 9, 9, '#f2d9b5', INK, 2);
      ellipse(ctx, staff.handX, staff.handY, 9, 9, '#f2d9b5', INK, 2);
    } else if (pose === 'hit') {
      ellipse(ctx, 32, 96, 9, 9, '#f2d9b5', INK, 2);
      ellipse(ctx, staff.handX, staff.handY, 9, 9, '#f2d9b5', INK, 2);
      line(ctx, [28, 82, 22, 76], '#dfbd71', 2.5);
      line(ctx, [31, 77, 28, 69], '#dfbd71', 2.5);
    } else {
      ellipse(ctx, pose === 'dash' ? 37 : 36, pose === 'dash' ? 100 : 104, 9, 9, '#f2d9b5', INK, 2);
      ellipse(ctx, staff.handX, staff.handY, 9, 9, '#f2d9b5', INK, 2);
    }
  } finally {
    ctx.restore();
  }
}
