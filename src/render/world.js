import { ctx } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { TAU } from '../utils/math.js';
import { getThreatFraction, getThreatStage } from '../systems/threat.js';
import { drawTerrain, drawGoblinTavern } from '../world/terrain.js';
import { getRenderableStairs, fillHouseInterior, interiorFloorColor } from '../world/houses.js';

function drawWorldScene(){
  const p = state.player;

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  drawTerrain();
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
  drawPlayerGoblin(p, invisible);

  drawTorchlight();

  ctx.restore();
}

function drawPlayerGoblin(p, invisible){
  const moveSpeed = Math.hypot(p.vx, p.vy);
  const moveIntensity = Math.min(moveSpeed / 130, 1);
  const sprintBonus = p.sprinting ? 1.25 : 1;
  const cycle = state.time * (3.6 + moveIntensity * 6.2 * sprintBonus);
  const strideA = Math.sin(cycle) * moveIntensity;
  const strideB = Math.sin(cycle + Math.PI) * moveIntensity;
  const bob = Math.sin(cycle * 2) * (1.6 + moveIntensity * 1.8) * moveIntensity;
  const hipSway = Math.cos(cycle) * 2.4 * moveIntensity;
  const torsoSideSway = hipSway * 0.35;
  const forwardLean = moveIntensity * (p.sprinting ? 7.5 : 3.8);
  const bodyColor = invisible ? 'rgba(92,193,109,0.45)' : '#5cc16d';
  const bodyShade = invisible ? 'rgba(52,131,74,0.45)' : '#3a8247';

  ctx.save();

  // Ground shadow stays anchored to the world to sell the motion.
  ctx.save();
  ctx.translate(p.x, p.y + 10);
  ctx.scale(1, 0.36);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.24 + moveIntensity * 0.18})`;
  ctx.beginPath();
  ctx.ellipse(0, 0, 12 + moveIntensity * 6, 8 + moveIntensity * 4, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  const forwardDir = { x: Math.cos(p.facing), y: Math.sin(p.facing) };
  const sideDir = { x: -forwardDir.y, y: forwardDir.x };

  const projectPoint = (lateral, vertical, forward = 0, bobWeight = 1) => ({
    x: p.x + lateral * sideDir.x + forward * forwardDir.x,
    y: p.y + vertical + lateral * sideDir.y + forward * forwardDir.y + bob * bobWeight
  });

  const drawFilledEllipse = (lateral, vertical, forward, rx, ry, color, bobWeight = 1) => {
    const center = projectPoint(lateral, vertical, forward, bobWeight);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, TAU);
    ctx.fill();
  };

  const drawStrokedEllipse = (lateral, vertical, forward, rx, ry, style, bobWeight = 1) => {
    const center = projectPoint(lateral, vertical, forward, bobWeight);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    if (style.dash){
      ctx.setLineDash(style.dash);
    }
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, rx, ry, 0, 0, TAU);
    ctx.stroke();
    if (style.dash){
      ctx.setLineDash([]);
    }
  };


  const alpha = invisible ? 0.55 : 1;
  ctx.globalAlpha = alpha;

  const hipForward = forwardLean * 0.28;
  const torsoForward = forwardLean;
  const shoulderForward = forwardLean * 0.82;
  const legs = [
    { offset: -4 + hipSway, swing: strideA, color: '#204b2a' },
    { offset: 4 + hipSway, swing: strideB, color: '#2f7a3c' }
  ];
  legs.sort((a, b) => a.swing - b.swing);
  for (const leg of legs){
    drawGoblinLimb(projectPoint, leg.offset, 6, 16, leg.swing, 4, leg.color, 0.85, hipForward, undefined, true);
  }

  const arms = [
    { offset: -6 + torsoSideSway, swing: strideB, color: '#173625' },
    { offset: 6 + torsoSideSway, swing: strideA, color: '#275739' }
  ];
  arms.sort((a, b) => a.swing - b.swing);
  for (const arm of arms){
    drawGoblinLimb(projectPoint, arm.offset, -2, 12, arm.swing * 0.9, 3, arm.color, 0.65, shoulderForward, { start: 1, mid: 0.8, end: 0.7 });
  }

  drawFilledEllipse(torsoSideSway, 0, torsoForward, 9, 12, bodyColor);
  drawFilledEllipse(torsoSideSway * 0.82, -6.2, torsoForward * 0.9, 8, 6.6, bodyShade);

  const eyeColor = invisible ? 'rgba(43,102,61,0.55)' : '#2b663d';
  drawFilledEllipse(torsoSideSway + 3.4, -7.1, torsoForward * 0.95, 2.6, 2.6, eyeColor);
  drawFilledEllipse(torsoSideSway - 3.4, -7.1, torsoForward * 0.88, 2.2, 2.2, eyeColor);


  ctx.globalAlpha = 1;

  if (invisible){
    drawStrokedEllipse(torsoSideSway, -2, torsoForward * 0.8, 14, 18, {
      color: 'rgba(120, 220, 180, 0.7)',
      lineWidth: 2,
      dash: [6, 6]
    });
  }

  ctx.restore();
}

function drawGoblinLimb(projectPoint, sideOffset, startY, length, swing, thickness, color, follow, baseForward = 0, bobWeights = { start: 1, mid: 0.4, end: 0 }, anchorEnd = false){
  const swingRange = swing * (length * 0.55 + 6 * follow);
  const kneeForward = swingRange * 0.45;
  const footForward = swingRange;
  const kneeSide = sideOffset + swingRange * 0.18;
  const footSide = sideOffset + swingRange * 0.05;
  const hip = projectPoint(sideOffset, startY, baseForward, bobWeights.start);
  const knee = projectPoint(kneeSide, startY + length * 0.45, baseForward + kneeForward, bobWeights.mid);
  const footBaseForward = (anchorEnd ? 0 : baseForward) + footForward;
  const foot = projectPoint(footSide, startY + length, footBaseForward, bobWeights.end);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hip.x, hip.y);
  ctx.quadraticCurveTo(knee.x, knee.y, foot.x, foot.y);
  ctx.stroke();
}

function drawCastle(){
  const c = state.castle;
  const x = c.x, y = c.y;
  const threatFrac = getThreatFraction();
  const stage = getThreatStage();
  ctx.save();
  ctx.translate(x, y);

  if (threatFrac > 0){
    const auraRadius = 140 + 260 * threatFrac;
    const aura = ctx.createRadialGradient(0, 24, 24, 0, 24, auraRadius);
    aura.addColorStop(0, `rgba(170, 60, 120, ${0.18 + 0.45 * threatFrac})`);
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

  const windowGlow = `rgba(255, 130, 120, ${0.25 + 0.5 * threatFrac})`;
  ctx.fillStyle = windowGlow;
  ctx.fillRect(-24, -8, 10, 18);
  ctx.fillRect(14, -8, 10, 18);
  ctx.fillRect(-6, -18, 12, 16);
  ctx.fillRect(-6, 4, 12, 16);

  ctx.fillStyle = `rgba(120, 28, 88, ${0.3 + 0.4 * threatFrac})`;
  ctx.fillRect(-32, -32, 6, 42);
  ctx.fillRect(26, -32, 6, 42);

  drawCastleEye(stage, threatFrac);

  ctx.restore();

  ctx.fillStyle = 'rgba(198, 214, 255, 0.7)';
  ctx.font = '11px system-ui';
  ctx.fillText("Dark Lord's Keep", x - 58, y - 62);
}

function drawCastleEye(stage, threatFrac){
  const eyelidHeights = [8, 12, 16, 19, 24];
  const irisRadii = [6, 7, 9, 11, 13];
  const irisColors = ['#1f2d45', '#2f4d70', '#d55a66', '#f34632', '#120102'];
  const glowColors = [
    'rgba(60, 84, 124, 0.45)',
    'rgba(88, 120, 160, 0.55)',
    'rgba(220, 110, 120, 0.65)',
    'rgba(255, 80, 90, 0.75)',
    'rgba(255, 40, 100, 0.85)'
  ];

  ctx.save();
  ctx.translate(0, -66);

  ctx.fillStyle = 'rgba(8, 12, 20, 0.96)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 18, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = glowColors[stage];
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
    ctx.fillStyle = irisColors[stage];
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
