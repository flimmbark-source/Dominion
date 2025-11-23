import { ctx } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { clamp, TAU } from '../utils/math.js';
import { getWeaponSwingConfig } from '../utils/weaponSwing.js';
import { getThreatFraction, getThreatStage } from '../systems/threat.js';
import { drawTerrain, drawGoblinTavern } from '../world/terrain.js';
import { drawGoblin } from './goblin.js';
import { getRenderableStairs, fillHouseInterior, interiorFloorColor } from '../world/houses.js';
import {
  getNearbyTrapPrompt,
  getVillageTraps,
  getVillagerPromptData,
  VILLAGER_PICKPOCKET_DISTANCE
} from '../systems/villageInteractions.js';
import { getActiveDamageNumbers } from '../systems/damageNumbers.js';
import { getCameraOffset } from '../systems/cameraEffects.js';

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

function adjustHexColor(hex, factor){
  const normalized = clamp(factor, -1, 1);
  const base = hex.startsWith('#') ? hex.slice(1) : hex;
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  const target = normalized < 0 ? 0 : 255;
  const mixAmount = Math.abs(normalized);
  const mixChannel = channel => Math.round(channel + (target - channel) * mixAmount);
  const nr = mixChannel(r);
  const ng = mixChannel(g);
  const nb = mixChannel(b);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function drawPolygon(points){
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++){
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.fill();
}

function drawExtrudedRect({
  x,
  y,
  width,
  depth,
  height,
  skew,
  baseColor,
  roofColor,
  shadowStrength = 0.2
}){
  const slope = Math.min(depth * 0.75, height * 0.9);
  const topColor = roofColor ?? adjustHexColor(baseColor, 0.25);
  const frontColor = adjustHexColor(baseColor, -0.12);
  const leftColor = adjustHexColor(baseColor, -0.28);
  const rightColor = adjustHexColor(baseColor, -0.4);
  const highlightColor = adjustHexColor(topColor, 0.25);
  const dropStrength = 0.18 + shadowStrength * 0.65;

  const top = [
    { x: x - skew, y: y - height },
    { x: x + width - skew, y: y - height },
    { x: x + width, y },
    { x: x, y }
  ];

  const left = [
    { x: x - skew, y: y - height },
    { x, y },
    { x, y: y + depth },
    { x: x - skew, y: y + depth - slope }
  ];

  const right = [
    { x: x + width - skew, y: y - height },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x: x + width - skew, y: y + depth - slope }
  ];

  const front = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + depth },
    { x, y: y + depth }
  ];

  const drop = [
    { x: x + width, y: y + depth },
    { x: x + width + skew * 0.85, y: y + depth + height * 0.65 },
    { x: x - skew * 0.35, y: y + depth + height * 0.65 }
  ];

  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${dropStrength.toFixed(3)})`;
  drawPolygon(drop);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = leftColor;
  drawPolygon(left);
  ctx.fillStyle = rightColor;
  drawPolygon(right);
  ctx.fillStyle = frontColor;
  drawPolygon(front);
  ctx.fillStyle = topColor;
  drawPolygon(top);

  ctx.strokeStyle = highlightColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(top[0].x, top[0].y);
  ctx.lineTo(top[1].x, top[1].y);
  ctx.lineTo(top[2].x, top[2].y);
  ctx.stroke();

  ctx.restore();

  return { top, front, left, right, drop };
}

function drawChest3D(chest){
  const width = chest.w;
  const depth = chest.h;
  const x = chest.x - 9;
  const y = chest.y - 6;
  const geometry = drawExtrudedRect({
    x,
    y,
    width,
    depth,
    height: 12,
    skew: 6,
    baseColor: '#8b5a2b',
    roofColor: '#c58a3b',
    shadowStrength: 0.28
  });

  const top = geometry.top;
  const front = geometry.front;
  const lidMidX = (top[0].x + top[1].x) / 2;
  const lidMidY = (top[0].y + top[1].y) / 2;

  ctx.save();
  ctx.strokeStyle = adjustHexColor('#8b5a2b', -0.35);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(lidMidX, lidMidY);
  ctx.lineTo((top[2].x + top[3].x) / 2, (top[2].y + top[3].y) / 2);
  ctx.stroke();

  const lockWidth = Math.min(10, width * 0.4);
  const frontTop = front[0].y;
  const frontBottom = front[2].y;
  const lockHeight = (frontBottom - frontTop) * 0.35;
  const lockX = (front[0].x + front[1].x) / 2 - lockWidth / 2;
  const lockY = frontTop + (frontBottom - frontTop) * 0.45;
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(lockX, lockY, lockWidth, lockHeight);
  ctx.fillStyle = adjustHexColor('#d9a441', -0.35);
  ctx.fillRect(lockX + lockWidth * 0.4, lockY + lockHeight * 0.35, lockWidth * 0.2, lockHeight * 0.45);
  ctx.restore();
}

function withAlpha(rgb, alpha){
  return `rgba(${rgb}, ${clamp(alpha, 0, 1).toFixed(3)})`;
}

function easeOutBack(t){
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const clamped = clamp(t, 0, 1);
  return 1 + c3 * Math.pow(clamped - 1, 3) + c1 * Math.pow(clamped - 1, 2);
}

function drawNpcBladeSwing(facing, config, progress, ease){
  const relativeStart = config.arcStart ?? -1.2;
  const relativeEnd = config.arcEnd ?? 1.2;
  const arcStart = facing + relativeStart;
  const arcEnd = facing + relativeStart + (relativeEnd - relativeStart) * progress;
  const radius = (config.radius ?? 18) + ease * (config.radiusBonus ?? 0);
  const width = (config.strokeWidth ?? 3) + ease * (config.strokeWidthBonus ?? 0);
  const glowWidth = width * 1.6;
  const glowColor = withAlpha(config.glowColor ?? '255, 232, 168', 0.35 + ease * 0.3);
  const trailColor = withAlpha(config.color ?? '255, 255, 214', 0.65 + ease * 0.25);

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = glowWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.92, arcStart, arcEnd, false);
  ctx.stroke();

  ctx.strokeStyle = trailColor;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(0, 0, radius, arcStart, arcEnd, false);
  ctx.stroke();

  ctx.globalCompositeOperation = 'source-over';
}

function drawNpcThrustSwing(facing, config, progress, ease){
  const retract = config.retractDistance ?? -6;
  const thrust = config.thrustDistance ?? 28;
  const travel = retract + (thrust - retract) * (0.3 + ease * 0.7);
  const startX = Math.cos(facing) * retract * (0.6 + progress * 0.4);
  const startY = Math.sin(facing) * retract * (0.6 + progress * 0.4);
  const endX = Math.cos(facing) * travel;
  const endY = Math.sin(facing) * travel;
  const width = (config.width ?? 3.2) + ease * (config.widthBonus ?? 0);
  const glowWidth = width * 1.8;
  const glowColor = withAlpha(config.glowColor ?? '110, 190, 255', 0.28 + ease * 0.32);
  const shaftColor = withAlpha(config.color ?? '200, 235, 255', 0.45 + ease * 0.35);

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = glowWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.strokeStyle = shaftColor;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  const tipLength = config.tipLength ?? 10;
  const tipWidth = config.tipWidth ?? 6;
  const tipColor = withAlpha(config.tipColor ?? '255, 255, 255', 0.35 + ease * 0.45);
  ctx.fillStyle = tipColor;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - Math.cos(facing - 0.55) * tipLength,
    endY - Math.sin(facing - 0.55) * tipLength
  );
  ctx.lineTo(
    endX - Math.cos(facing + 0.55) * tipLength,
    endY - Math.sin(facing + 0.55) * tipLength
  );
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
}

function drawNpcBiteSwing(facing, config, progress, ease){
  const radius = (config.radius ?? 12) + ease * (config.radiusBonus ?? 0);
  const open = (config.openBase ?? 0.6) + ease * (config.openBonus ?? 0.7);
  const thickness = (config.thickness ?? 2.4) + ease * (config.thicknessBonus ?? 1.2);
  const glowColor = withAlpha(config.glowColor ?? '255, 120, 70', 0.3 + ease * 0.35);
  const biteColor = withAlpha(config.color ?? '255, 215, 190', 0.55 + ease * 0.25);

  const topStart = facing - open;
  const topEnd = facing - open * 0.1;
  const bottomStart = facing + open * 0.1;
  const bottomEnd = facing + open;

  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = thickness * 1.7;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.92, topStart, topEnd, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.92, bottomStart, bottomEnd, false);
  ctx.stroke();

  ctx.strokeStyle = biteColor;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.arc(0, 0, radius, topStart, topEnd, false);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, radius, bottomStart, bottomEnd, false);
  ctx.stroke();

  const biteFill = withAlpha(config.color ?? '255, 215, 190', 0.25 + ease * 0.2);
  ctx.fillStyle = biteFill;
  ctx.beginPath();
  ctx.moveTo(Math.cos(topEnd) * radius, Math.sin(topEnd) * radius);
  ctx.lineTo(Math.cos(facing) * radius * 1.05, Math.sin(facing) * radius * 1.05);
  ctx.lineTo(Math.cos(bottomStart) * radius, Math.sin(bottomStart) * radius);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'source-over';
}

function drawNpcWeaponSwing(npc){
  const swing = npc.attackSwing;
  if (!swing) return;
  const start = typeof swing.start === 'number' ? swing.start : 0;
  const duration = typeof swing.duration === 'number' ? swing.duration : 0;
  if (duration <= 0) return;
  const elapsed = state.time - start;
  if (elapsed < 0 || elapsed > duration) return;

  const progress = clamp(elapsed / duration, 0, 1);
  const ease = Math.sin(progress * Math.PI);
  const config = getWeaponSwingConfig(swing.weaponType);
  const facing = swing.facing ?? npc.facing ?? 0;

  ctx.save();
  ctx.translate(npc.x, npc.y);
  ctx.globalAlpha = clamp(0.55 + ease * 0.35, 0, 1);

  switch (config.style){
    case 'thrust':
      drawNpcThrustSwing(facing, config, progress, ease);
      break;
    case 'bite':
      drawNpcBiteSwing(facing, config, progress, ease);
      break;
    default:
      drawNpcBladeSwing(facing, config, progress, ease);
      break;
  }

  ctx.restore();
}

const FACTION_BODY_COLORS = {
  village: '#6d9f5b',
  darkLord: '#a13b52',
  monster: '#6d5cc2'
};

function drawVillagerSilhouette({ bodyColor, highlight, shadow }){
  const grad = ctx.createRadialGradient(-3, -6, 2, 0, 0, 11);
  grad.addColorStop(0, highlight);
  grad.addColorStop(0.55, bodyColor);
  grad.addColorStop(1, shadow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 11, 0, 0, TAU);
  ctx.fill();
}

function drawVillagerDetails({ bodyColor, facing }){
  const eyeOffsetX = Math.cos(facing) * 4;
  const eyeOffsetY = Math.sin(facing) * 4 - 1.2;
  ctx.fillStyle = adjustHexColor(bodyColor, -0.55);
  ctx.beginPath();
  ctx.ellipse(eyeOffsetX, eyeOffsetY, 3.2, 3.8, facing, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = adjustHexColor(bodyColor, -0.5);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(Math.cos(facing) * 14, Math.sin(facing) * 14 - 4);
  ctx.stroke();
}

function drawDarkLordSilhouette({ bodyColor, highlight, shadow }){
  ctx.save();
  const capeColor = adjustHexColor(bodyColor, -0.3);
  ctx.fillStyle = capeColor;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.quadraticCurveTo(12, 4, 7, 16);
  ctx.lineTo(-7, 16);
  ctx.quadraticCurveTo(-12, 4, 0, -10);
  ctx.fill();

  const grad = ctx.createLinearGradient(0, -14, 0, 16);
  grad.addColorStop(0, highlight);
  grad.addColorStop(0.45, bodyColor);
  grad.addColorStop(1, shadow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(9, 4);
  ctx.lineTo(4, 16);
  ctx.lineTo(-4, 16);
  ctx.lineTo(-9, 4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = adjustHexColor(bodyColor, -0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -2);
  ctx.lineTo(-2, 14);
  ctx.moveTo(6, -2);
  ctx.lineTo(2, 14);
  ctx.stroke();
  ctx.restore();
}

function drawDarkLordDetails({ bodyColor }){
  const visorBase = adjustHexColor(bodyColor, 0.45);
  const visorGlow = adjustHexColor(bodyColor, 0.65);
  ctx.fillStyle = visorBase;
  ctx.fillRect(-6, -4, 12, 4.5);
  ctx.fillStyle = visorGlow;
  ctx.fillRect(-4.5, -3, 9, 2.4);

  ctx.fillStyle = adjustHexColor(bodyColor, -0.55);
  ctx.beginPath();
  ctx.moveTo(-6, -5);
  ctx.lineTo(-2, -9);
  ctx.lineTo(2, -9);
  ctx.lineTo(6, -5);
  ctx.closePath();
  ctx.fill();
}

function drawMonsterSilhouette({ bodyColor, highlight, shadow }){
  ctx.save();
  const grad = ctx.createRadialGradient(0, -4, 2, 0, 2, 14);
  grad.addColorStop(0, highlight);
  grad.addColorStop(0.5, bodyColor);
  grad.addColorStop(1, shadow);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.bezierCurveTo(7, -15, 11, -6, 10, 0);
  ctx.quadraticCurveTo(11, 10, 0, 14);
  ctx.quadraticCurveTo(-11, 10, -10, 0);
  ctx.bezierCurveTo(-11, -6, -7, -15, 0, -12);
  ctx.closePath();
  ctx.fill();

  const bellyColor = adjustHexColor(bodyColor, 0.2);
  ctx.fillStyle = bellyColor;
  ctx.beginPath();
  ctx.ellipse(0, 4, 6, 8, 0, 0, TAU);
  ctx.fill();

  const hornColor = adjustHexColor(bodyColor, -0.25);
  ctx.fillStyle = hornColor;
  ctx.beginPath();
  ctx.moveTo(-4, -11);
  ctx.lineTo(-8, -18);
  ctx.lineTo(-5, -11);
  ctx.closePath();
  ctx.moveTo(4, -11);
  ctx.lineTo(8, -18);
  ctx.lineTo(5, -11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMonsterDetails({ bodyColor }){
  const eyeWhite = '#f7f7f7';
  const pupil = adjustHexColor(bodyColor, -0.55);
  ctx.fillStyle = eyeWhite;
  ctx.beginPath();
  ctx.ellipse(-3.5, -2, 2.2, 3, 0, 0, TAU);
  ctx.ellipse(3.5, -2, 2.2, 3, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = pupil;
  ctx.beginPath();
  ctx.ellipse(-3.5, -1.2, 1.1, 1.5, 0, 0, TAU);
  ctx.ellipse(3.5, -1.2, 1.1, 1.5, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = adjustHexColor(bodyColor, -0.4);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 3.5, 4.5, 0.2, Math.PI - 0.2, false);
  ctx.stroke();
}

const NPC_SILHOUETTES = {
  village: drawVillagerSilhouette,
  darkLord: drawDarkLordSilhouette,
  monster: drawMonsterSilhouette
};

const NPC_DETAILS = {
  village: drawVillagerDetails,
  darkLord: drawDarkLordDetails,
  monster: drawMonsterDetails
};

function drawNpc3D(npc){
  ctx.save();
  ctx.translate(npc.x, npc.y);

  const factionBase = FACTION_BODY_COLORS[npc.faction] || '#9aa5b1';
  let bodyColor;
  if (npc.type === 'scout') {
    bodyColor = adjustHexColor(factionBase, 0.2);
  } else if (npc.type === 'merchant') {
    bodyColor = '#8b7355'; // Brown/tan color for merchants
  } else {
    bodyColor = factionBase;
  }
  const highlight = adjustHexColor(bodyColor, 0.35);
  const shadow = adjustHexColor(bodyColor, -0.4);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 7, 7.5, 4, 0, 0, TAU);
  ctx.fill();

  const renderSilhouette = NPC_SILHOUETTES[npc.faction] || drawVillagerSilhouette;
  renderSilhouette({ bodyColor, highlight, shadow });

  const detailRenderer = NPC_DETAILS[npc.faction] || drawVillagerDetails;
  detailRenderer({ bodyColor, highlight, shadow, facing: npc.facing ?? 0 });

  ctx.restore();
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

  // Apply camera shake offset
  const cameraShake = getCameraOffset();

  ctx.save();
  ctx.translate(-state.camera.x + cameraShake.x, -state.camera.y + cameraShake.y);

  drawTerrain({ includeTrees: false });
  drawTerrain({ treeFilter: treeBehindPlayer });
  drawCastle();

  for (const h of state.houses){
    // Stores have distinct colors to stand out
    const isStore = h.id === 'store';
    drawExtrudedRect({
      x: h.x,
      y: h.y,
      width: h.w,
      depth: h.h,
      height: 18,
      skew: 9,
      baseColor: isStore ? '#3d2a1f' : '#1b2638',
      roofColor: isStore ? '#8b4513' : '#2f3f5b',
      shadowStrength: 0.3
    });
  }
  for (const d of state.doors){
    drawExtrudedRect({
      x: d.x,
      y: d.y,
      width: d.w,
      depth: d.h,
      height: 8,
      skew: 4,
      baseColor: '#0b0f17',
      roofColor: '#223047',
      shadowStrength: 0.22
    });
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
  drawVillageTrapMarkers();
  drawPointsOfInterest();

  for (const c of state.chests){
    if (c.looted) continue;
    if (!state.interior) continue;
    if (c.houseId !== state.interior.houseId || c.level !== state.interior.level) continue;
    drawChest3D(c);
  }

  for (const npc of state.npcs){
    // Don't draw FOV cones for peaceful NPCs (villagers/merchants)
    if (state.debugCones && npc.type !== 'villager' && npc.type !== 'merchant') drawFOV(npc);
    drawNpc3D(npc);
    drawNpcWeaponSwing(npc);
  }

  drawInteractionPrompts();

  if (!p.dead){
    const invisible = state.time < p.invisUntil;
    drawGoblin(ctx, p, { time: state.time, invisible });
  }

  drawTerrain({ treeFilter: treeInFrontOfPlayer });

  drawTorchlight();

  drawTrapDisarmProgress(p);

  drawDamageNumbers();

  ctx.restore();
}

function drawDamageNumbers(){
  const numbers = getActiveDamageNumbers();
  if (!numbers.length) return;

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const entry of numbers){
    const lifetime = entry.lifetime ?? 1.15;
    const elapsed = state.time - entry.createdAt;
    if (elapsed < 0 || elapsed > lifetime) continue;

    const progress = clamp(elapsed / lifetime, 0, 1);
    const rise = 18 + progress * 22;
    const popT = Math.min(1, elapsed / 0.18);
    const scale = 0.75 + easeOutBack(popT) * 0.35;
    const fadeStart = 0.55;
    const fade = progress < fadeStart
      ? 1
      : clamp(1 - (progress - fadeStart) / (1 - fadeStart), 0, 1);

    const fontSize = entry.crit ? 20 : 16;
    ctx.save();
    ctx.translate(entry.x, entry.y - rise);
    ctx.scale(scale, scale);
    ctx.globalAlpha = fade;
    ctx.font = `bold ${fontSize}px "Trebuchet MS", system-ui`;
    ctx.strokeStyle = 'rgba(5, 8, 14, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(String(entry.amount), 0, 0);
    ctx.fillStyle = entry.color || '#f9d776';
    ctx.fillText(String(entry.amount), 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

function drawInteractionLabel(x, y, text, style='default'){
  ctx.save();
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const paddingX = 8;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 20;
  const left = x - width / 2;
  const top = y - height / 2;
  ctx.fillStyle = style === 'warning' ? 'rgba(36, 14, 14, 0.88)' : 'rgba(12, 18, 28, 0.88)';
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = style === 'warning' ? '#f68a6f' : '#4da3ff';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(left + 0.5, top + 0.5, width - 1, height - 1);
  ctx.fillStyle = '#d9e7ff';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function drawVillageTrapMarkers(){
  const traps = getVillageTraps();
  if (!traps) return;
  for (const trap of traps){
    const pulse = Math.sin(state.time * 3.2 + trap.x * 0.015);
    if (!trap.completed){
      ctx.fillStyle = `rgba(240, 124, 74, ${0.25 + Math.max(0, pulse) * 0.25})`;
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 18 + pulse * 2.4, 0, TAU);
      ctx.fill();
    } else {
      const fade = clamp(1 - (state.time - trap.completedAt) / 4, 0, 1);
      if (fade > 0){
        ctx.fillStyle = `rgba(88, 170, 120, ${0.22 * fade})`;
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, 18, 0, TAU);
        ctx.fill();
      }
    }

    ctx.strokeStyle = trap.completed ? '#58aa78' : '#f07c4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(trap.x, trap.y, 12, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(trap.x - 8, trap.y);
    ctx.lineTo(trap.x + 8, trap.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(trap.x, trap.y - 8);
    ctx.lineTo(trap.x, trap.y + 8);
    ctx.stroke();

    if (!trap.completed){
      ctx.font = '10px "Trebuchet MS", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(255, 213, 140, 0.85)';
      ctx.fillText(trap.label, trap.x, trap.y + 16);
    }
  }
}

function drawInteractionPrompts(){
  const villagerPrompt = getVillagerPromptData();
  if (villagerPrompt){
    const { npc, canTalk, canPickpocket, pickpocketOnCooldown, dist } = villagerPrompt;
    let offset = -30;
    if (canTalk){
      drawInteractionLabel(npc.x, npc.y + offset, 'E: Talk');
      offset -= 24;
    }
    if (dist <= VILLAGER_PICKPOCKET_DISTANCE + 12){
      if (canPickpocket){
        drawInteractionLabel(npc.x, npc.y + offset, 'R: Pickpocket');
      } else if (pickpocketOnCooldown){
        drawInteractionLabel(npc.x, npc.y + offset, 'R: Watched', 'warning');
      } else if (npc.pickpocketed){
        drawInteractionLabel(npc.x, npc.y + offset, 'Pocket picked', 'warning');
      }
    }
  }

  const trapPrompt = getNearbyTrapPrompt();
  if (trapPrompt){
    const { trap, disarming } = trapPrompt;
    const cooling = state.time < trap.cooldownUntil;
    let text = 'E: Disable trap';
    let style = 'default';
    if (disarming){
      text = 'Disarming trap';
    } else if (cooling){
      text = 'Trap settling';
      style = 'warning';
    }
    drawInteractionLabel(trap.x, trap.y - 30, text, style);
  }
}

function drawTrapDisarmProgress(p){
  const active = state.activeTrapDisarm;
  if (!active || !active.trap || active.trap.completed) return;

  const trap = active.trap;
  if (!trap.disarming) return;

  const total = active.duration || 0;
  if (total <= 0) return;

  const remaining = clamp((active.endsAt - state.time) / total, 0, 1);
  const barWidth = 48;
  const barHeight = 6;
  const left = p.x - barWidth / 2;
  const top = p.y - p.r - 24;
  const innerLeft = left + 1;
  const innerWidth = barWidth - 2;
  const fillWidth = innerWidth * remaining;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 16, 24, 0.85)';
  ctx.fillRect(left, top, barWidth, barHeight);
  ctx.strokeStyle = '#f2d16b';
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, top + 0.5, barWidth - 1, barHeight - 1);
  if (fillWidth > 0){
    ctx.fillStyle = '#f7d66b';
    ctx.fillRect(innerLeft, top + 1, fillWidth, barHeight - 2);
  }
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
