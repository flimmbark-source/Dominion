import { TAU } from '../utils/math.js';
import { getWeaponSwingConfig } from '../utils/weaponSwing.js';

const DEFAULT_PLAYER_BLADE = getWeaponSwingConfig('dagger').playerBlade || {};

function drawGoblin(ctx, p, options = {}){
  const {
    time = 0,
    invisible: invisibleOverride,
    sprintingOverride,
    moveSpeedOverride,
    leanOverride
  } = options;

  const swing = p.attackSwing;
  const swingStart = swing?.start ?? 0;
  const swingDuration = swing?.duration ?? 0;
  const swingElapsed = time - swingStart;
  const swingActive = !!swing && swingDuration > 0 && swingElapsed >= 0 && swingElapsed <= swingDuration;
  const swingProgress = swingActive ? Math.min(Math.max(swingElapsed / swingDuration, 0), 1) : 0;
  const swingFacing = swing?.facing ?? (p.facing ?? 0);
  const swingEase = swingActive ? Math.sin(Math.min(Math.max(swingProgress, 0), 1) * Math.PI) : 0;

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
  let rightArmLimb = null;

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
    depthBias,
    tag
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

    const limb = { start, control, end, thickness, color, depth: end.y + depthBias, tag };
    limbs.push(limb);
    return limb;
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

  rightArmLimb = enqueueLimb({
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
    depthBias: forwardDot * 8 + 12,
    tag: 'rightArm'
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

  if (swingActive && rightArmLimb){
    const hand = rightArmLimb.end;
    const weaponType = swing?.weaponType;
    const swingConfig = getWeaponSwingConfig(weaponType);
    const bladeConfig = swingConfig.playerBlade || DEFAULT_PLAYER_BLADE;

    const angleOffset = (bladeConfig.baseAngleOffset ?? -1.05) + swingProgress * (bladeConfig.angleSweep ?? 1.9);
    const bladeAngle = swingFacing + angleOffset;
    const guardDistance = (bladeConfig.guardDistance ?? 3.4) + swingEase * (bladeConfig.guardDistanceBonus ?? 0);
    const bladeLength = (bladeConfig.bladeLength ?? 17) + swingEase * (bladeConfig.bladeLengthBonus ?? 0);
    const normalAngle = bladeAngle + Math.PI / 2;
    const bladeHalfWidth = (bladeConfig.bladeHalfWidth ?? 1.6) + swingEase * (bladeConfig.bladeHalfWidthBonus ?? 0);
    const guardX = hand.x + Math.cos(bladeAngle) * guardDistance;
    const guardY = hand.y + Math.sin(bladeAngle) * guardDistance;
    const tipX = guardX + Math.cos(bladeAngle) * bladeLength;
    const tipY = guardY + Math.sin(bladeAngle) * bladeLength;
    const baseLeftX = guardX + Math.cos(normalAngle) * bladeHalfWidth;
    const baseLeftY = guardY + Math.sin(normalAngle) * bladeHalfWidth;
    const baseRightX = guardX - Math.cos(normalAngle) * bladeHalfWidth;
    const baseRightY = guardY - Math.sin(normalAngle) * bladeHalfWidth;

    ctx.save();
    ctx.lineJoin = 'round';

    const bladeFill = invisible
      ? (bladeConfig.invisibleBladeFill || bladeConfig.bladeFill || '#f7f9f3')
      : (bladeConfig.bladeFill || '#f7f9f3');
    const bladeStroke = invisible
      ? (bladeConfig.invisibleBladeStroke || bladeConfig.bladeStroke || '#d6ddd1')
      : (bladeConfig.bladeStroke || '#d6ddd1');
    ctx.fillStyle = bladeFill;
    ctx.strokeStyle = bladeStroke;
    ctx.lineWidth = 1.2 + (bladeConfig.outlineBonus ?? 0) * swingEase;
    ctx.beginPath();
    ctx.moveTo(baseLeftX, baseLeftY);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(baseRightX, baseRightY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const handleLength = bladeConfig.handleLength ?? 3.2;
    const handleBackX = hand.x - Math.cos(bladeAngle) * handleLength;
    const handleBackY = hand.y - Math.sin(bladeAngle) * handleLength;
    const handleColor = invisible
      ? (bladeConfig.invisibleHandleColor || bladeConfig.handleColor || '#3a3228')
      : (bladeConfig.handleColor || '#3a3228');
    ctx.strokeStyle = handleColor;
    ctx.lineWidth = 2.4 + (bladeConfig.handleWidthBonus ?? 0) * swingEase;
    ctx.beginPath();
    ctx.moveTo(handleBackX, handleBackY);
    ctx.lineTo(hand.x + Math.cos(bladeAngle) * 0.6, hand.y + Math.sin(bladeAngle) * 0.6);
    ctx.stroke();

    const guardHalfWidth = (bladeConfig.guardWidth ?? 7.2) / 2;
    const guardColor = invisible
      ? (bladeConfig.invisibleGuardColor || bladeConfig.guardColor || '#caa86e')
      : (bladeConfig.guardColor || '#caa86e');
    ctx.strokeStyle = guardColor;
    ctx.lineWidth = 2.2 + (bladeConfig.guardWidthBonus ?? 0) * swingEase;
    ctx.beginPath();
    ctx.moveTo(guardX + Math.cos(normalAngle) * guardHalfWidth, guardY + Math.sin(normalAngle) * guardHalfWidth);
    ctx.lineTo(guardX - Math.cos(normalAngle) * guardHalfWidth, guardY - Math.sin(normalAngle) * guardHalfWidth);
    ctx.stroke();

    const trailRadius = (bladeConfig.trailRadius ?? 16) + swingEase * (bladeConfig.trailRadiusBonus ?? 0);
    const trailStart = swingFacing + (bladeConfig.trailStart ?? -1.25);
    const trailSweep = bladeConfig.trailSweep ?? 1.95;
    const trailEnd = trailStart + swingProgress * trailSweep;
    const trailAlphaBase = bladeConfig.trailAlphaBase ?? 0.55;
    const trailAlphaBonus = bladeConfig.trailAlphaBonus ?? 0.35;
    const trailAlpha = (trailAlphaBase + swingEase * trailAlphaBonus) * (1 - swingProgress * 0.65);
    const trailWidth = (bladeConfig.trailWidth ?? 2.8) + swingEase * (bladeConfig.trailWidthBonus ?? 0);
    const trailColorRgb = invisible
      ? (bladeConfig.invisibleTrailColor || bladeConfig.trailColor)
      : bladeConfig.trailColor;

    if (trailColorRgb && trailAlpha > 0){
      const clampedAlpha = Math.max(0, Math.min(1, trailAlpha));
      ctx.strokeStyle = `rgba(${trailColorRgb}, ${clampedAlpha.toFixed(3)})`;
      ctx.lineWidth = trailWidth;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hand.x, hand.y, trailRadius, trailStart, trailEnd, false);
      ctx.stroke();
    }

    ctx.restore();
  }

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
