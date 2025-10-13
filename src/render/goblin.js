import { TAU } from '../utils/math.js';

function drawGoblin(ctx, p, options = {}){
  const {
    time = 0,
    invisible: invisibleOverride,
    sprintingOverride,
    moveSpeedOverride,
    leanOverride
  } = options;

  const vx = p.vx ?? 0;
  const vy = p.vy ?? 0;
  const facing = p.facing ?? 0;
  const sprinting = typeof sprintingOverride === 'boolean' ? sprintingOverride : (p.sprinting ?? false);
  const moveSpeed = typeof moveSpeedOverride === 'number' ? moveSpeedOverride : Math.hypot(vx, vy);
  const moveIntensity = Math.min(moveSpeed / 130, 1);
  const sprintBonus = sprinting ? 1.25 : 1;
  const cycle = time * (3.6 + moveIntensity * 6.2 * sprintBonus);

  function gait(phase){
    const stride = Math.sin(phase) * moveIntensity;
    const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * moveIntensity;
    return { stride, lift };
  }

  const bob = Math.sin(cycle * 2) * (1.6 + moveIntensity * 1.8) * moveIntensity;
  const lean = typeof leanOverride === 'number'
    ? leanOverride
    : Math.max(-0.35, Math.min(0.4, Math.cos(cycle) * 0.18 * moveIntensity + (sprinting ? 0.12 : 0)));

  const invisible = typeof invisibleOverride === 'boolean'
    ? invisibleOverride
    : (time < (p.invisUntil ?? 0));

  const bodyColor = invisible ? 'rgba(92,193,109,0.45)' : '#5cc16d';
  const bodyShade = invisible ? 'rgba(52,131,74,0.45)' : '#3a8247';

  const dirX = Math.cos(facing);
  const dirY = Math.sin(facing);
  const rightX = -dirY;
  const rightY = dirX;
  const isoScaleY = 0.62;
  const isoScaleX = 1;

  function projectPoint(localRight, localUp, localForward){
    const groundX = (rightX * localRight + dirX * localForward) * isoScaleX;
    const groundY = (rightY * localRight + dirY * localForward) * isoScaleY;
    return {
      x: p.x + groundX,
      y: p.y + groundY - localUp
    };
  }

  ctx.save();

  ctx.save();
  ctx.translate(p.x, p.y + 8);
  const shadowWidth = 12 + moveIntensity * 6;
  const shadowHeight = 7 + moveIntensity * 3.5;
  const shadowSkew = 1 + Math.abs(dirX) * 0.25;
  ctx.scale(shadowSkew, 0.34);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.24 + moveIntensity * 0.18})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, shadowWidth, shadowHeight, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  const alpha = invisible ? 0.55 : 1;
  ctx.globalAlpha = alpha;

  const sideDot = dirX;
  const forwardDot = dirY;

  const hipHeight = 12 + bob * 0.7;
  const hipForward = -1.8 + forwardDot * 2.2 - lean * 5.4;
  const hipSpacing = 4.6 + sideDot * 0.8;

  const shoulderHeight = hipHeight + 7 + moveIntensity * 1.1;
  const shoulderForward = hipForward - 1.6;
  const shoulderSpacing = 6.8 + sideDot * 0.6;

  const headHeight = shoulderHeight + 6.4 + moveIntensity * 0.4;
  const headForward = shoulderForward - 1.2 - lean * 6;

  const limbs = [];

  function enqueueLimb({
    baseRight,
    baseUp,
    baseForward,
    stride,
    lift,
    length,
    swingRight,
    swingForward,
    liftControl,
    liftFoot,
    thickness,
    color,
    depthBias
  }){
    const start = projectPoint(baseRight, baseUp, baseForward);
    const control = projectPoint(
      baseRight + stride * swingRight * 0.52,
      baseUp - length * 0.45 + lift * liftControl,
      baseForward + stride * swingForward * 0.52
    );
    const end = projectPoint(
      baseRight + stride * swingRight,
      Math.max(0, lift * liftFoot),
      baseForward + stride * swingForward
    );

    limbs.push({ start, control, end, thickness, color, depth: end.y + depthBias });
  }

  const legPhaseLeft = gait(cycle);
  const legPhaseRight = gait(cycle + Math.PI);

  enqueueLimb({
    baseRight: -hipSpacing + sideDot * -0.6,
    baseUp: hipHeight,
    baseForward: hipForward,
    stride: legPhaseLeft.stride,
    lift: legPhaseLeft.lift,
    length: 18,
    swingRight: 3.4,
    swingForward: 5.8,
    liftControl: 6.4,
    liftFoot: 3.6,
    thickness: 4.2,
    color: '#204b2a',
    depthBias: -forwardDot * 6 - sideDot * 2
  });

  enqueueLimb({
    baseRight: hipSpacing + sideDot * 0.6,
    baseUp: hipHeight,
    baseForward: hipForward,
    stride: legPhaseRight.stride,
    lift: legPhaseRight.lift,
    length: 18,
    swingRight: 3.4,
    swingForward: 5.8,
    liftControl: 6.4,
    liftFoot: 3.6,
    thickness: 4.2,
    color: '#2f7a3c',
    depthBias: forwardDot * 6 + sideDot * 2
  });

  const armPhaseLeft = gait(cycle + Math.PI);
  const armPhaseRight = gait(cycle);

  enqueueLimb({
    baseRight: -shoulderSpacing + sideDot * -0.8,
    baseUp: shoulderHeight,
    baseForward: shoulderForward,
    stride: armPhaseLeft.stride * 0.9,
    lift: armPhaseLeft.lift * 0.6,
    length: 14,
    swingRight: 2.1,
    swingForward: 3.8,
    liftControl: 3.8,
    liftFoot: 2.6,
    thickness: 3.2,
    color: '#173625',
    depthBias: -forwardDot * 8 - 12
  });

  enqueueLimb({
    baseRight: shoulderSpacing + sideDot * 0.8,
    baseUp: shoulderHeight,
    baseForward: shoulderForward,
    stride: armPhaseRight.stride * 0.9,
    lift: armPhaseRight.lift * 0.6,
    length: 14,
    swingRight: 2.1,
    swingForward: 3.8,
    liftControl: 3.8,
    liftFoot: 2.6,
    thickness: 3.2,
    color: '#275739',
    depthBias: forwardDot * 8 + 12
  });

  limbs.sort((a, b) => a.depth - b.depth);

  for (const limb of limbs){
    ctx.strokeStyle = limb.color;
    ctx.lineWidth = limb.thickness;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(limb.start.x, limb.start.y);
    ctx.quadraticCurveTo(limb.control.x, limb.control.y, limb.end.x, limb.end.y);
    ctx.stroke();
  }

  const torsoCenter = projectPoint(sideDot * 1.1, hipHeight + 4.6 + bob * 0.4, hipForward - 2.6 + lean * -8);
  const torsoWidth = 9.4 + Math.abs(sideDot) * 2 + moveIntensity * 0.8;
  const torsoHeight = 12 + moveIntensity * 0.5;

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.ellipse(torsoCenter.x, torsoCenter.y, torsoWidth, torsoHeight, 0, 0, TAU);
  ctx.fill();

  const bellyShade = projectPoint(sideDot * 2.6 + 1.2, hipHeight + 2.2 + bob * 0.3, hipForward - 0.6);
  ctx.fillStyle = bodyShade;
  ctx.beginPath();
  ctx.ellipse(bellyShade.x, bellyShade.y, 3.6 + moveIntensity * 0.5, 6.4, 0, 0, TAU);
  ctx.fill();

  const shoulderShade = projectPoint(-sideDot * 2.4 + 0.4, shoulderHeight - 1.2, shoulderForward - 0.4);
  ctx.beginPath();
  ctx.ellipse(shoulderShade.x, shoulderShade.y, 5.6, 4.4, 0, 0, TAU);
  ctx.fill();

  const headCenter = projectPoint(sideDot * 1.4, headHeight, headForward);
  ctx.fillStyle = invisible ? 'rgba(92,193,109,0.4)' : '#6bd377';
  ctx.beginPath();
  ctx.ellipse(headCenter.x, headCenter.y, 6.2 + Math.abs(sideDot) * 0.8, 7.6, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = invisible ? 'rgba(43,102,61,0.55)' : '#2b663d';
  const eyeOffset = 2.6 + sideDot * 0.6;
  const eyeForward = headForward + 0.6;
  const rightEye = projectPoint(eyeOffset, headHeight - 2.6, eyeForward);
  const leftEye = projectPoint(-eyeOffset * 0.9, headHeight - 2.4, eyeForward - 0.4);

  ctx.beginPath();
  ctx.ellipse(rightEye.x, rightEye.y, 2.4, 2.6, 0, 0, TAU);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(leftEye.x, leftEye.y, 2, 2.2, 0, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 1;

  if (invisible){
    const shroudCenter = projectPoint(0, headHeight - 1, hipForward - 1.6);
    ctx.strokeStyle = 'rgba(120, 220, 180, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.ellipse(shroudCenter.x, shroudCenter.y, torsoWidth + 4, torsoHeight + 6, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export { drawGoblin };
