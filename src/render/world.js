import { ctx } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { TAU, clamp } from '../utils/math.js';
import { getThreatFraction, getThreatStage } from '../systems/threat.js';
import { drawTerrain, drawGoblinTavern } from '../world/terrain.js';
import { drawGoblin } from './goblin.js';
import { getRenderableStairs, fillHouseInterior, interiorFloorColor } from '../world/houses.js';

function lerp(a, b, t){
  return a + (b - a) * t;
}

function mixHexColor(base, target, t){
  const clampT = clamp(t, 0, 1);
  const br = parseInt(base.slice(1,3), 16);
  const bg = parseInt(base.slice(3,5), 16);
  const bb = parseInt(base.slice(5,7), 16);
  const tr = parseInt(target.slice(1,3), 16);
  const tg = parseInt(target.slice(3,5), 16);
  const tb = parseInt(target.slice(5,7), 16);
  const r = Math.round(lerp(br, tr, clampT));
  const g = Math.round(lerp(bg, tg, clampT));
  const b = Math.round(lerp(bb, tb, clampT));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
const POI_STYLES = {
  'shady-trader': { outer: '#3b2a16', inner: '#d0a74e' },
  'wandering-merchant': { outer: '#1d2e45', inner: '#7ec6ff' },
  'cursed-shrine': { outer: '#251134', inner: '#b57bf8' },
  'bog-sprite': { outer: '#0f3320', inner: '#66e0a0' }
};

function drawWorldScene(){
  const p = state.player;
  const playerGroundY = p.y + 8;
  const treeBaseY = tree => tree.cy + ((tree.h ?? tree.canopyRadius ?? 0) / 2);
  const treeBehindPlayer = tree => playerGroundY >= treeBaseY(tree);
  const treeInFrontOfPlayer = tree => playerGroundY < treeBaseY(tree);

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  drawTerrain({ treeFilter: treeBehindPlayer });
  drawTerrain({ includeTrees: false });
  drawCastle();

  for (const h of state.houses){
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeStyle = '#2a3b57';
    ctx.strokeRect(h.x+0.5, h.y+0.5, h.w-1, h.h-1);
  }
  for (const d of state.doors){
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#3b4d6a';
    ctx.strokeRect(d.x+0.5, d.y+0.5, d.w-1, d.h-1);
  }

  if (state.interior && state.interior.level === 1) {
    const h = state.houses[state.interior.houseId];
    const col = interiorFloorColor(1);
    if (h && col) fillHouseInterior(h, col);
  }

  const stairsToDraw = getRenderableStairs();
  for (const s of stairsToDraw){
    if (s.treads){
      for (const r of s.treads){
        ctx.fillStyle = '#6b5b3e';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#a38755';
        ctx.strokeRect(r.x+.5, r.y+.5, r.w-1, r.h-1);
      }
    } else {
      ctx.fillStyle = '#6b5b3e';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#a38755';
      ctx.strokeRect(s.x+.5, s.y+.5, s.w-1, s.h-1);
    }
  }

  drawGoblinTavern();
  drawPointsOfInterest();

  for (const c of state.chests){
    if (c.looted) continue;
    if (!state.interior) continue;
    if (c.houseId !== state.interior.houseId || c.level !== state.interior.level) continue;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(c.x-9, c.y-6, c.w, c.h);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(c.x-9, c.y-1, c.w, 2);
  }

  for (const npc of state.npcs){
    if (state.debugCones) drawFOV(npc);
    ctx.beginPath();
    ctx.arc(npc.x, npc.y, 8, 0, TAU);
    ctx.fillStyle = npc.type==='scout' ? '#6fa8dc' : '#9aa5b1';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(npc.x, npc.y);
    ctx.lineTo(npc.x + Math.cos(npc.facing)*12, npc.y + Math.sin(npc.facing)*12);
    ctx.strokeStyle = '#a3b9d6';
    ctx.stroke();
  }

  const invisible = state.time < p.invisUntil;
  drawGoblin(ctx, p, { time: state.time, invisible });

  drawTorchlight();

  ctx.restore();
}

function drawPointsOfInterest(){
  if (!state.pointsOfInterest || !state.pointsOfInterest.length) return;
  for (const poi of state.pointsOfInterest){
    const style = POI_STYLES[poi.type] || { outer: '#1b2738', inner: '#9fb3c8' };
    ctx.save();
    ctx.translate(poi.x, poi.y);
    const alpha = poi.resolved ? 0.55 : 0.9;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style.outer;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = style.inner;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fillStyle = style.inner;
    ctx.globalAlpha = poi.resolved ? 0.45 : 0.82;
    ctx.fill();

    if (!poi.resolved){
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(0, 0, (poi.radius ?? 60) * 0.45, 0, TAU);
      ctx.strokeStyle = style.inner;
      ctx.stroke();
    }

    ctx.restore();
  }
}

function drawPlayerGoblin(p, invisible){
  const moveSpeed = Math.hypot(p.vx, p.vy);
  const moveIntensity = Math.min(moveSpeed / 130, 1);
  const sprintBonus = p.sprinting ? 1.25 : 1;
  const cycle = state.time * (3.6 + moveIntensity * 6.2 * sprintBonus);

  function gait(phase){
    const stride = Math.sin(phase) * moveIntensity;
    const lift = Math.max(0, Math.sin(phase + Math.PI / 2)) * moveIntensity;
    return { stride, lift };
  }

  const bob = Math.sin(cycle * 2) * (1.6 + moveIntensity * 1.8) * moveIntensity;
  const lean = Math.max(-0.35, Math.min(0.4, Math.cos(cycle) * 0.18 * moveIntensity + (p.sprinting ? 0.12 : 0)));
  const bodyColor = invisible ? 'rgba(92,193,109,0.45)' : '#5cc16d';
  const bodyShade = invisible ? 'rgba(52,131,74,0.45)' : '#3a8247';

  const dirX = Math.cos(p.facing || 0);
  const dirY = Math.sin(p.facing || 0);
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

  // Draw the ground shadow anchored to the player's feet.
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
  drawTerrain({ treeFilter: treeInFrontOfPlayer });

  drawTorchlight();

  ctx.restore();
}


function drawCastle(){
  const c = state.castle;
  const x = c.x, y = c.y;
  const threatFrac = getThreatFraction();
  const stage = getThreatStage();
  const hunt = clamp(state.huntHeat || 0, 0, 1);
  ctx.save();
  ctx.translate(x, y);

  if (threatFrac > 0){
    const auraRadius = 140 + 260 * threatFrac;
    const aura = ctx.createRadialGradient(0, 24, 24, 0, 24, auraRadius);
    aura.addColorStop(0, `rgba(${170 + Math.round(60 * hunt)}, ${60 - Math.round(30 * hunt)}, ${120 - Math.round(40 * hunt)}, ${0.18 + 0.45 * threatFrac + 0.32 * hunt})`);
    aura.addColorStop(1, 'rgba(12, 8, 18, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 24, auraRadius, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = '#0f1521';
  ctx.fillRect(-36, -32, 72, 64);
  ctx.fillStyle = '#161f31';
  ctx.fillRect(-28, -54, 56, 26);
  ctx.fillStyle = '#0a101a';
  for (let i=-24;i<=24;i+=12){
    ctx.fillRect(i-3, -54, 6, 12);
  }

  const windowGlow = `rgba(255, ${Math.round(lerp(130, 80, hunt))}, ${Math.round(lerp(120, 60, hunt))}, ${0.25 + 0.5 * threatFrac + 0.28 * hunt})`;
  ctx.fillStyle = windowGlow;
  ctx.fillRect(-24, -8, 10, 18);
  ctx.fillRect(14, -8, 10, 18);
  ctx.fillRect(-6, -18, 12, 16);
  ctx.fillRect(-6, 4, 12, 16);

  ctx.fillStyle = `rgba(${Math.round(lerp(120, 200, hunt))}, ${Math.round(lerp(28, 22, hunt))}, ${Math.round(lerp(88, 44, hunt))}, ${0.3 + 0.4 * threatFrac + 0.25 * hunt})`;
  ctx.fillRect(-32, -32, 6, 42);
  ctx.fillRect(26, -32, 6, 42);

  drawCastleEye(stage, threatFrac, hunt);

  ctx.restore();

  ctx.fillStyle = 'rgba(198, 214, 255, 0.7)';
  ctx.font = '11px system-ui';
  ctx.fillText("Dark Lord's Keep", x - 58, y - 62);
}

function drawCastleEye(stage, threatFrac, hunt){
  const eyelidHeights = [8, 12, 16, 19, 24];
  const irisRadii = [6, 7, 9, 11, 13];
  const irisBases = ['#1f2d45', '#2f4d70', '#d55a66', '#f34632', '#120102'];
  const glowBases = [
    { r: 60, g: 84, b: 124, a: 0.45 },
    { r: 88, g: 120, b: 160, a: 0.55 },
    { r: 220, g: 110, b: 120, a: 0.65 },
    { r: 255, g: 80, b: 90, a: 0.75 },
    { r: 255, g: 40, b: 100, a: 0.85 }
  ];

  ctx.save();
  ctx.translate(0, -66);

  ctx.fillStyle = 'rgba(8, 12, 20, 0.96)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 18, 0, 0, TAU);
  ctx.fill();

  const glowBase = glowBases[stage];
  const glowR = Math.round(lerp(glowBase.r, 255, hunt));
  const glowG = Math.round(lerp(glowBase.g, 40, hunt));
  const glowB = Math.round(lerp(glowBase.b, 36, hunt));
  const glowA = glowBase.a + 0.25 * hunt + 0.2 * threatFrac;
  ctx.fillStyle = `rgba(${glowR}, ${glowG}, ${glowB}, ${Math.min(0.95, glowA)})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, eyelidHeights[stage], 0, 0, TAU);
  ctx.fill();

  if (stage === 0){
    ctx.strokeStyle = '#314765';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(0, -6, 18, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.quadraticCurveTo(0, 6, 18, 0);
    ctx.stroke();
  } else {
    const irisColor = mixHexColor(irisBases[stage], '#ff5b43', Math.max(hunt, threatFrac));
    ctx.fillStyle = irisColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, irisRadii[stage] + 5, eyelidHeights[stage] - 4, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = stage >= 4 ? '#060002' : '#040509';
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(3, irisRadii[stage] - 2), Math.max(3, (eyelidHeights[stage] - 6) * 0.6), 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = stage >= 4 ? '#ffe9ad' : '#f7f9ff';
    ctx.beginPath();
    ctx.arc(4 - stage, -2 - stage * 0.25, 2.4, 0, TAU);
    ctx.fill();
  }

  if (stage >= 3){
    const pulse = Math.sin(state.time * 3.4) * 6;
    ctx.strokeStyle = `rgba(255, 60, 90, ${0.35 + threatFrac * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(0, 118 + pulse);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 6);
    ctx.lineTo(-76, 128 + pulse * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(76, 128 - pulse * 0.6);
    ctx.stroke();
  }

  ctx.restore();
}

function drawFOV(npc){
  ctx.save();
  ctx.translate(npc.x, npc.y);
  ctx.rotate(npc.facing);
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, npc.fovRange, -npc.fovAngle/2, npc.fovAngle/2);
  ctx.closePath();
  ctx.fillStyle = npc.type==='scout' ? 'rgba(120,160,255,.10)' : 'rgba(200,200,200,.08)';
  ctx.fill();
  ctx.restore();
}

function drawTorchlight(){
  if (!state.debugCones){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const npc of state.npcs.filter(n=>n.type==='scout')){
      const grad = ctx.createRadialGradient(npc.x, npc.y, 10, npc.x, npc.y, 70);
      grad.addColorStop(0, 'rgba(255,220,120,0.12)');
      grad.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(npc.x, npc.y, 70, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

export { drawWorldScene, drawCastle, drawFOV, drawTorchlight };
