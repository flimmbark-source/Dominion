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

const HOUSE_PALETTES = [
  { id: 'deep-slate', base: '#1b2638', roof: '#2f3f5b', trim: '#d1d8e2', window: '#e9f0ff' },
  { id: 'warm-clay', base: '#3a2a1b', roof: '#5a4030', trim: '#f0d2a4', window: '#fbe7c3' },
  { id: 'sage-stone', base: '#2f3a32', roof: '#4c5d51', trim: '#d6e3d4', window: '#f1f7ed' },
  { id: 'ember-brick', base: '#452a2a', roof: '#613b3a', trim: '#f3c6b3', window: '#fee6dc' },
  { id: 'storm-plaster', base: '#2f2f3a', roof: '#4d4b5f', trim: '#e3e0f1', window: '#f0f3ff' }
];

const ROOF_TRIM_OPTIONS = [
  { id: 'none', type: 'none' },
  { id: 'ridge-gold', type: 'ridge', color: '#f3d9a2', width: 3 },
  { id: 'ridge-silver', type: 'ridge', color: '#c8d6ef', width: 2.2 },
  { id: 'chevron', type: 'chevron', color: '#e6c98b', spacing: 18, width: 1.2 },
  { id: 'edge-band', type: 'edge', color: '#f2e2c6', width: 1.6 }
];

const DEFAULT_HOUSE_THEME = { faction: 'villager', accent: '#d6c3a4', signSymbol: null, questHook: false };
const HOUSE_THEME_RULES = [
  { match: /(smith|forge|armory|fletcher)/i, faction: 'crafters', accent: '#df7a45', signSymbol: '⚒' },
  { match: /(guild|abbot|scribe|council)/i, faction: 'council', accent: '#b58ce0', signSymbol: '✶', questHook: true },
  { match: /(inn|mess|tavern|baker|market)/i, faction: 'civilians', accent: '#d9b173', signSymbol: '☕' },
  { match: /(barracks|watch|guard|tower)/i, faction: 'militia', accent: '#7db0e8', signSymbol: '⛨' },
  { match: /(apothecary|herb|alchemist|pilgrim)/i, faction: 'herbalist', accent: '#85d9bb', signSymbol: '✿', questHook: true },
  { match: /(stables|bunks|boat|fisher)/i, faction: 'trades', accent: '#d7c686', signSymbol: '♞' }
];

function hashHouseKey(text){
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeSeededRandom(seed){
  let stateValue = seed >>> 0;
  return () => {
    stateValue = (stateValue + 0x6d2b79f5) | 0;
    let t = Math.imul(stateValue ^ (stateValue >>> 15), 1 | stateValue);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ensureHouseFacadeCache(){
  if (!(state.houseFacadeCache instanceof Map)){
    state.houseFacadeCache = new Map();
  }
  return state.houseFacadeCache;
}

function getHouseSpec(house){
  if (!house || !Number.isInteger(house.villageId)) return null;
  const instance = state.villageInstances?.[house.villageId];
  const placed = instance?.placedHouses;
  if (!placed || !placed.length) return null;
  let best = null;
  let bestScore = Infinity;
  for (const entry of placed){
    const dx = Math.abs(entry.placement.x - house.x);
    const dy = Math.abs(entry.placement.y - house.y);
    const score = dx + dy;
    if (score < bestScore){
      best = entry;
      bestScore = score;
    }
  }
  return best?.spec || null;
}

function resolveHouseTheme(spec){
  if (!spec || !spec.id){
    return { ...DEFAULT_HOUSE_THEME };
  }
  for (const rule of HOUSE_THEME_RULES){
    if (rule.match.test(spec.id)){
      return {
        faction: rule.faction,
        accent: rule.accent,
        signSymbol: rule.signSymbol || null,
        questHook: !!rule.questHook
      };
    }
  }
  return { ...DEFAULT_HOUSE_THEME };
}

function getHouseVisualDescriptor(house){
  const cache = ensureHouseFacadeCache();
  const keyParts = [
    house.villageId ?? 'v',
    house.side || 'side',
    Math.round(house.x),
    Math.round(house.y),
    Math.round(house.w),
    Math.round(house.h),
    Math.round(house.door?.x ?? 0),
    Math.round(house.door?.y ?? 0)
  ];
  const cacheKey = keyParts.join(':');
  let descriptor = cache.get(cacheKey);
  if (descriptor) return descriptor;

  const spec = getHouseSpec(house);
  const seed = hashHouseKey(`${cacheKey}:${spec?.id ?? 'generic'}`);
  const rand = makeSeededRandom(seed);
  const palette = HOUSE_PALETTES[Math.floor(rand() * HOUSE_PALETTES.length)] || HOUSE_PALETTES[0];
  const roofTrim = ROOF_TRIM_OPTIONS[Math.floor(rand() * ROOF_TRIM_OPTIONS.length)] || ROOF_TRIM_OPTIONS[0];
  const height = 16 + Math.round(rand() * 6);
  const skew = 7 + Math.round(rand() * 4);
  const shadowStrength = 0.24 + rand() * 0.12;
  const theme = resolveHouseTheme(spec);
  const accentColor = theme.accent || palette.trim;
  const windowRows = 1 + Math.floor(rand() * 2);
  const windowCols = 2 + Math.floor(rand() * 3);
  const tallWindows = rand() > 0.55;
  const shutters = rand() > 0.4;
  const windowColor = mixHexColor(palette.window, '#ffffff', 0.2);
  const frameColor = palette.trim;
  const baseColor = mixHexColor(palette.base, accentColor, 0.08);
  const roofColor = mixHexColor(palette.roof, accentColor, 0.18);

  descriptor = {
    key: cacheKey,
    palette,
    roofTrim,
    baseColor,
    roofColor,
    height,
    skew,
    shadowStrength,
    specId: spec?.id ?? null,
    theme,
    accentColor,
    windowLayout: {
      rows: windowRows,
      cols: windowCols,
      tall: tallWindows,
      shutters,
      color: windowColor,
      frame: frameColor,
      shutterColor: mixHexColor(accentColor, '#000000', 0.35),
      glow: mixHexColor(windowColor, '#ffffff', 0.35)
    },
    doorStyle: {
      color: mixHexColor(palette.base, accentColor, 0.45),
      frameColor: mixHexColor(frameColor, accentColor, 0.15),
      awning: rand() > 0.65
        ? {
            color: mixHexColor(accentColor, '#000000', 0.4),
            stripe: mixHexColor(accentColor, '#ffffff', 0.4)
          }
        : null
    },
    sign: null
  };

  if (theme.signSymbol){
    descriptor.sign = {
      color: accentColor,
      symbol: theme.signSymbol,
      background: mixHexColor(accentColor, '#000000', 0.65)
    };
  }

  cache.set(cacheKey, descriptor);
  return descriptor;
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

function drawHouseRoofTrim(geometry, visuals){
  if (!geometry || !visuals) return;
  const trim = visuals.roofTrim;
  if (!trim || trim.type === 'none') return;
  const top = geometry.top;
  if (!top || top.length < 4) return;

  ctx.save();
  ctx.strokeStyle = trim.color || visuals.accentColor || '#f0e2c6';
  ctx.lineWidth = trim.width ?? 1.6;

  if (trim.type === 'ridge'){
    const startX = (top[0].x + top[3].x) / 2;
    const startY = (top[0].y + top[3].y) / 2;
    const endX = (top[1].x + top[2].x) / 2;
    const endY = (top[1].y + top[2].y) / 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  } else if (trim.type === 'edge'){
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    ctx.lineTo(top[1].x, top[1].y);
    ctx.lineTo(top[2].x, top[2].y);
    ctx.stroke();
  } else if (trim.type === 'chevron'){
    const frontStart = top[2];
    const frontEnd = top[3];
    const frontLength = Math.hypot(frontEnd.x - frontStart.x, frontEnd.y - frontStart.y);
    const steps = Math.max(2, Math.floor(frontLength / (trim.spacing ?? 18)));
    const stepX = (frontEnd.x - frontStart.x) / steps;
    const stepY = (frontEnd.y - frontStart.y) / steps;
    const diagX = (top[1].x - top[2].x) / steps;
    const diagY = (top[1].y - top[2].y) / steps;
    ctx.strokeStyle = trim.color || ctx.strokeStyle;
    ctx.lineWidth = trim.width ?? 1.2;
    for (let i = 0; i < steps; i++){
      const sx = frontStart.x + stepX * i;
      const sy = frontStart.y + stepY * i;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + diagX, sy + diagY);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawHouseFactionDecor(front, width, height, visuals){
  const faction = visuals?.theme?.faction;
  if (!faction) return;

  if (faction === 'militia'){
    const bandWidth = Math.max(6, width * 0.08);
    const bandColor = mixHexColor(visuals.accentColor, '#000000', 0.3);
    ctx.fillStyle = bandColor;
    ctx.fillRect(front[0].x + 2, front[0].y + 6, bandWidth, height * 0.7);
    ctx.fillRect(front[1].x - bandWidth - 2, front[0].y + 6, bandWidth, height * 0.7);
  } else if (faction === 'crafters'){
    const trimColor = mixHexColor(visuals.accentColor, '#ffffff', 0.25);
    ctx.fillStyle = trimColor;
    ctx.fillRect(front[0].x + 4, front[0].y + height * 0.55, width - 8, 3.5);
  } else if (faction === 'herbalist'){
    const radius = Math.min(width, height) * 0.1;
    ctx.fillStyle = mixHexColor(visuals.accentColor, '#ffffff', 0.35);
    ctx.beginPath();
    ctx.ellipse(front[0].x + width * 0.26, front[0].y + height * 0.32, radius, radius * 0.8, 0, 0, TAU);
    ctx.fill();
  } else if (faction === 'council'){
    const bannerWidth = Math.max(5, width * 0.06);
    ctx.fillStyle = mixHexColor(visuals.accentColor, '#000000', 0.25);
    ctx.fillRect(front[0].x + width / 2 - bannerWidth / 2, front[0].y + 6, bannerWidth, height * 0.65);
  } else if (faction === 'trades'){
    const stripeHeight = Math.max(4, height * 0.08);
    ctx.fillStyle = mixHexColor(visuals.accentColor, '#ffffff', 0.2);
    ctx.fillRect(front[0].x + 6, front[2].y - stripeHeight - 4, width - 12, stripeHeight);
  }
}

function drawHouseFacadeOverlays(house, geometry, visuals){
  if (!geometry || !visuals) return;
  const front = geometry.front;
  if (!front || front.length < 4) return;
  const frontWidth = front[1].x - front[0].x;
  const frontHeight = front[2].y - front[0].y;
  if (frontWidth <= 6 || frontHeight <= 6) return;

  const layout = visuals.windowLayout;
  if (layout && layout.rows > 0 && layout.cols > 0){
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(front[0].x, front[0].y);
    ctx.lineTo(front[1].x, front[1].y);
    ctx.lineTo(front[2].x, front[2].y);
    ctx.lineTo(front[3].x, front[3].y);
    ctx.closePath();
    ctx.clip();

    drawHouseFactionDecor(front, frontWidth, frontHeight, visuals);

    const marginX = frontWidth * 0.09;
    const marginY = frontHeight * 0.16;
    const cellWidth = (frontWidth - marginX * 2) / layout.cols;
    const cellHeight = (frontHeight - marginY * 2) / Math.max(1, layout.rows);
    const windowWidth = cellWidth * (layout.tall ? 0.52 : 0.46);
    const windowHeight = cellHeight * (layout.tall ? 0.78 : 0.58);

    for (let row = 0; row < layout.rows; row++){
      for (let col = 0; col < layout.cols; col++){
        const centerX = front[0].x + marginX + cellWidth * col + cellWidth / 2;
        const centerY = front[0].y + marginY + cellHeight * row + cellHeight / 2;
        const wx = centerX - windowWidth / 2;
        const wy = centerY - windowHeight / 2;

        if (layout.glow){
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = layout.glow;
          ctx.fillRect(wx - 1.5, wy - 1.5, windowWidth + 3, windowHeight + 3);
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = layout.color;
        ctx.fillRect(wx, wy, windowWidth, windowHeight);

        if (layout.frame){
          ctx.strokeStyle = layout.frame;
          ctx.lineWidth = 1;
          ctx.strokeRect(wx + 0.5, wy + 0.5, windowWidth - 1, windowHeight - 1);
        }

        if (layout.shutters){
          const shutterWidth = Math.min(windowWidth * 0.26, 9);
          ctx.fillStyle = layout.shutterColor;
          ctx.fillRect(wx - shutterWidth - 1, wy, shutterWidth, windowHeight);
          ctx.fillRect(wx + windowWidth + 1, wy, shutterWidth, windowHeight);
        }
      }
    }

    ctx.restore();
  } else {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(front[0].x, front[0].y);
    ctx.lineTo(front[1].x, front[1].y);
    ctx.lineTo(front[2].x, front[2].y);
    ctx.lineTo(front[3].x, front[3].y);
    ctx.closePath();
    ctx.clip();
    drawHouseFactionDecor(front, frontWidth, frontHeight, visuals);
    ctx.restore();
  }

  if (house.side === 'south' && house.door && visuals.doorStyle){
    ctx.save();
    const minDoorWidth = Math.max(14, frontWidth * 0.22);
    const maxDoorWidth = Math.max(minDoorWidth, frontWidth * 0.55);
    const targetDoorWidth = house.door.w * 0.9;
    const doorWidth = clamp(targetDoorWidth, minDoorWidth, maxDoorWidth);
    const doorHeight = clamp(frontHeight * 0.62, 16, frontHeight - 6);
    const rawDoorLeft = house.door.x + (house.door.w - doorWidth) / 2;
    const doorLeft = clamp(rawDoorLeft, front[0].x + 4, front[1].x - doorWidth - 4);
    const doorBottom = front[2].y - 2;
    const doorTop = doorBottom - doorHeight;

    ctx.fillStyle = visuals.doorStyle.color;
    ctx.fillRect(doorLeft, doorTop, doorWidth, doorHeight);

    ctx.strokeStyle = visuals.doorStyle.frameColor;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(doorLeft + 0.5, doorTop + 0.5, doorWidth - 1, doorHeight - 1);

    const knobY = doorTop + doorHeight * 0.55;
    const knobX = doorLeft + doorWidth * 0.78;
    ctx.beginPath();
    ctx.fillStyle = mixHexColor(visuals.doorStyle.color, '#000000', 0.6);
    ctx.arc(knobX, knobY, 1.8, 0, TAU);
    ctx.fill();

    if (visuals.doorStyle.awning){
      const awningHeight = Math.min(doorHeight * 0.32, 14);
      const awningWidth = doorWidth + 16;
      const awningLeft = doorLeft - 8;
      const awningTop = doorTop - awningHeight + 1;
      ctx.fillStyle = visuals.doorStyle.awning.color;
      ctx.fillRect(awningLeft, awningTop, awningWidth, awningHeight);
      ctx.fillStyle = visuals.doorStyle.awning.stripe;
      ctx.fillRect(awningLeft, awningTop + awningHeight * 0.55, awningWidth, awningHeight * 0.45);
    }

    if (visuals.sign){
      ctx.save();
      const signWidth = Math.min(Math.max(doorWidth * 0.6, 14), 28);
      const signHeight = Math.min(Math.max(doorHeight * 0.32, 10), 22);
      const rawSignLeft = doorLeft + doorWidth + 6;
      const signLeft = clamp(rawSignLeft, front[0].x + 6, front[1].x - signWidth - 4);
      const rawSignTop = doorTop + doorHeight * 0.2;
      const signTop = clamp(rawSignTop, front[0].y + 6, front[2].y - signHeight - 6);
      ctx.fillStyle = visuals.sign.background;
      ctx.fillRect(signLeft, signTop, signWidth, signHeight);
      ctx.strokeStyle = visuals.sign.color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(signLeft + 0.5, signTop + 0.5, signWidth - 1, signHeight - 1);
      if (visuals.sign.symbol){
        ctx.fillStyle = visuals.sign.color;
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(visuals.sign.symbol, signLeft + signWidth / 2, signTop + signHeight / 2 + 0.5);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  if (visuals.theme?.questHook){
    const centerX = front[0].x + frontWidth / 2;
    const centerY = front[0].y + frontHeight * 0.28;
    const radiusX = frontWidth * 0.45;
    const radiusY = frontHeight * 0.32;
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = visuals.accentColor;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = visuals.accentColor;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX * 0.55, radiusY * 0.38, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
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
  const bodyColor = npc.type === 'scout'
    ? adjustHexColor(factionBase, 0.2)
    : factionBase;
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
  'cursed-shrine-core': { outer: '#10251b', inner: '#8be6c2' },
  'runestone-cache': { outer: '#1a1832', inner: '#b57bf8' },
  'fae-fairy': { outer: '#123239', inner: '#6be5f2' },
  'mire-moonblossom': { outer: '#0f2a1e', inner: '#8fffe6' },
  'mire-bog-idol': { outer: '#1c2548', inner: '#9cb4ff' },
  'ember-trail': { outer: '#301b0a', inner: '#ffae62' },
  'ember-ambush': { outer: '#2a1408', inner: '#ffae62' }
};

const WORLD_EVENT_PROP_RENDERERS = {
  'fae-bargain-circle': drawPropFaeBargainCircle,
  'fae-runestone-cluster': drawPropFaeRunestoneCluster,
  'moonblossom-patch': drawPropMoonblossomPatch,
  'bog-idol-cache': drawPropBogIdolCache,
  'cursed-shrine-core': drawPropCursedShrineCore,
  'overturned-cart': drawPropOverturnedCart,
  'raider-supply-cache': drawPropRaiderSupplyCache
};

function drawWorldScene(){
  const p = state.player;
  const playerGroundY = p.y + 8;
  const treeBaseY = tree => tree.cy + ((tree.h ?? tree.canopyRadius ?? 0) / 2);
  const treeBehindPlayer = tree => playerGroundY >= treeBaseY(tree);
  const treeInFrontOfPlayer = tree => playerGroundY < treeBaseY(tree);

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  drawTerrain({ includeTrees: false });
  drawTerrain({ treeFilter: treeBehindPlayer });
  drawCastle();

  for (let i = 0; i < state.houses.length; i++){
    const h = state.houses[i];
    const visuals = getHouseVisualDescriptor(h);
    const geometry = drawExtrudedRect({
      x: h.x,
      y: h.y,
      width: h.w,
      depth: h.h,
      height: visuals.height,
      skew: visuals.skew,
      baseColor: visuals.baseColor || visuals.palette.base,
      roofColor: visuals.roofColor || visuals.palette.roof,
      shadowStrength: visuals.shadowStrength
    });
    drawHouseRoofTrim(geometry, visuals);
    drawHouseFacadeOverlays(h, geometry, visuals);
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
  drawQuestCues();
  drawDiegeticWorldEvents();
  drawWorldEventProps();
  drawPointsOfInterest();

  for (const c of state.chests){
    if (c.looted) continue;
    if (!state.interior) continue;
    if (c.houseId !== state.interior.houseId || c.level !== state.interior.level) continue;
    drawChest3D(c);
  }

  for (const npc of state.npcs){
    if (state.debugCones) drawFOV(npc);
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
  const cycle = state.time;
  const player = state.player;
  for (const trap of traps){
    ctx.save();
    const dist = Math.hypot(trap.x - player.x, trap.y - player.y);
    const missionFocus = trap.missionFocus === 'disarm-traps';
    const patience = clamp(((trap.hintAge ?? 0) / 25), 0, 1);
    const proximity = clamp(1 - dist / 280, 0, 1);
    const base = missionFocus ? 0.28 : 0.16;
    const intensity = clamp(base + patience * 0.55 + proximity * 0.45, 0, 1);

    if (!trap.completed){
      drawTrapAmbientCue(trap, intensity, cycle);
      ctx.globalAlpha = 0.35 + 0.35 * intensity;
      ctx.strokeStyle = '#e5b76c';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 12 + intensity * 2.5, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(trap.x - 7, trap.y);
      ctx.lineTo(trap.x + 7, trap.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(trap.x, trap.y - 7);
      ctx.lineTo(trap.x, trap.y + 7);
      ctx.stroke();
      ctx.globalAlpha = 0.55 + 0.35 * intensity;
      ctx.font = '10px "Trebuchet MS", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(247, 214, 156, 0.85)';
      ctx.fillText(trap.label, trap.x, trap.y + 16);
    } else {
      const fade = clamp(1 - (state.time - trap.completedAt) / 4, 0, 1);
      if (fade > 0){
        ctx.globalAlpha = 0.2 * fade;
        ctx.fillStyle = '#58aa78';
        ctx.beginPath();
        ctx.arc(trap.x, trap.y, 18, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.6 * fade;
      ctx.strokeStyle = '#58aa78';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, 12, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawTrapAmbientCue(trap, intensity, cycle){
  const radius = 26 + intensity * 18;
  const alpha = 0.16 + intensity * 0.32;
  drawRadialGlow(trap.x, trap.y, radius, '#f4c67b', alpha);
  const orbitRadius = radius * (0.65 + intensity * 0.15);
  drawOrbitingDots({ x: trap.x, y: trap.y - 6 }, {
    count: Math.round(6 + intensity * 8),
    orbitRadius,
    color: 'rgba(255, 214, 160, 0.75)',
    drift: 10 + intensity * 8,
    size: 2.8
  }, cycle * 0.9);
  drawTrapTripwireGleam(trap, intensity, cycle);
  if (intensity > 0.6){
    const loudness = clamp((intensity - 0.6) / 0.4, 0, 1);
    drawRipples({ x: trap.x, y: trap.y }, radius * (1.2 + loudness * 0.4), cycle * 0.6, `rgba(255, 200, 150, ${0.08 + loudness * 0.18})`);
  }
}

function drawTrapTripwireGleam(trap, intensity, cycle){
  if (!cueWithinView(trap.x, trap.y, 80)) return;
  ctx.save();
  ctx.translate(trap.x, trap.y - 4);
  ctx.rotate(Math.sin(cycle * 0.8 + trap.x * 0.012 + trap.y * 0.008) * 0.22);
  ctx.globalAlpha = 0.25 + intensity * 0.4;
  ctx.strokeStyle = 'rgba(255, 226, 170, 0.9)';
  ctx.lineWidth = 1.2 + intensity;
  const span = 20 + intensity * 14;
  ctx.beginPath();
  ctx.moveTo(-span, 0);
  ctx.lineTo(span, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-span * 0.65, -3 - intensity * 2);
  ctx.lineTo(span * 0.65, 3 + intensity * 2);
  ctx.stroke();
  ctx.restore();
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

function cueWithinView(x, y, radius = 200){
  const margin = 140;
  const left = state.camera.x - margin;
  const top = state.camera.y - margin;
  const right = left + ctx.canvas.width + margin * 2;
  const bottom = top + ctx.canvas.height + margin * 2;
  return (x + radius) > left && (x - radius) < right && (y + radius) > top && (y - radius) < bottom;
}

function drawRadialGlow(x, y, radius, color, alpha = 0.6){
  if (!cueWithinView(x, y, radius + 20)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.max(0, alpha);
  const gradient = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawOrbitingDots(center, config, cycle){
  const count = Math.max(3, config.count ?? 12);
  const radius = config.orbitRadius ?? 140;
  if (!cueWithinView(center.x, center.y, radius + 40)) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++){
    const baseAngle = (i / count) * TAU + cycle * 0.6;
    const drift = Math.sin(cycle * 0.9 + i) * (config.drift ?? 18);
    const r = radius + drift;
    const x = center.x + Math.cos(baseAngle) * r;
    const y = center.y + Math.sin(baseAngle) * r;
    const size = (config.size ?? 3) + Math.sin(cycle * 1.3 + i) * 0.8;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(cycle * 1.2 + i * 0.8);
    ctx.fillStyle = config.color || 'rgba(190,255,220,0.9)';
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.6, size), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawFootprints(center, config, cycle){
  const count = Math.max(2, config.count ?? 6);
  const radius = config.radius ?? 110;
  if (!cueWithinView(center.x, center.y, radius + 40)) return;
  ctx.save();
  ctx.fillStyle = 'rgba(156, 214, 180, 0.45)';
  for (let i = 0; i < count; i++){
    const t = count > 1 ? i / (count - 1) : 0;
    const angle = -Math.PI * 0.35 + t * Math.PI * 0.9;
    const wobble = (config.wobble ?? 24) * Math.sin(cycle * 1.1 + i);
    const dist = radius * t + wobble * 0.3;
    const x = center.x + Math.cos(angle) * dist;
    const y = center.y + Math.sin(angle) * dist;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.sin(cycle + i) * 0.18);
    ctx.globalAlpha = 0.25 + 0.35 * (1 - t);
    ctx.beginPath();
    ctx.ellipse(0, 0, 4.5, 8.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBarkMarks(center, config, cycle){
  const count = config.count ?? 6;
  const arcRadius = config.arcRadius ?? 120;
  if (!cueWithinView(center.x, center.y, arcRadius + 40)) return;
  ctx.save();
  ctx.strokeStyle = config.color || 'rgba(164, 235, 196, 0.85)';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.45 + 0.25 * Math.sin(cycle * 0.9);
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU + cycle * 0.2;
    const start = angle - 0.2;
    const end = angle + 0.2;
    ctx.beginPath();
    ctx.arc(center.x, center.y, arcRadius, start, end);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWitheredTrail(center, config, cycle){
  const segments = config.segments ?? 5;
  const spread = config.spread ?? 100;
  if (!cueWithinView(center.x, center.y, spread + 60)) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(146, 176, 140, 0.55)';
  ctx.lineWidth = 2.4;
  ctx.setLineDash([8, 12]);
  for (let i = 0; i < segments; i++){
    const angle = (i / segments) * Math.PI - Math.PI / 2 + Math.sin(cycle + i) * 0.15;
    const len = spread * (0.6 + 0.4 * Math.sin(cycle * 0.7 + i));
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(center.x + Math.cos(angle) * len, center.y + Math.sin(angle) * len);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawGhostSilhouettes(center, config, cycle){
  const count = config.count ?? 4;
  const radius = config.radius ?? 140;
  if (!cueWithinView(center.x, center.y, radius + 40)) return;
  ctx.save();
  ctx.fillStyle = 'rgba(188, 255, 233, 0.32)';
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU + Math.sin(cycle + i) * 0.1;
    const dist = radius * (0.6 + 0.3 * Math.sin(cycle * 0.8 + i));
    const x = center.x + Math.cos(angle) * dist;
    const y = center.y + Math.sin(angle) * dist;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 1.3);
    ctx.globalAlpha = 0.18 + 0.12 * Math.sin(cycle * 1.4 + i);
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawPollen(center, config, cycle){
  const count = config.count ?? 12;
  const radius = config.radius ?? 80;
  if (!cueWithinView(center.x, center.y, radius + 30)) return;
  const color = config.color || 'rgba(200,255,214,0.5)';
  const size = config.size ?? 3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU + cycle * 0.8;
    const offset = Math.sin(cycle * 1.2 + i) * (radius * 0.3);
    const r = radius * 0.4 + offset;
    const x = center.x + Math.cos(angle) * r;
    const y = center.y + Math.sin(angle) * r;
    ctx.globalAlpha = 0.3 + 0.2 * Math.sin(cycle * 1.3 + i);
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.5, size), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawClawMarks(center, config, cycle){
  const count = config.count ?? 4;
  const radius = config.arcRadius ?? 90;
  if (!cueWithinView(center.x, center.y, radius + 40)) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(158, 182, 198, 0.6)';
  ctx.lineWidth = 3;
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU + cycle * 0.4;
    const x1 = center.x + Math.cos(angle) * radius;
    const y1 = center.y + Math.sin(angle) * radius;
    const x2 = center.x + Math.cos(angle + 0.08) * (radius - 24);
    const y2 = center.y + Math.sin(angle + 0.08) * (radius - 24);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawChains(center, config, cycle){
  const count = config.count ?? 3;
  const radius = config.radius ?? 110;
  if (!cueWithinView(center.x, center.y, radius + 30)) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(139, 230, 194, 0.6)';
  ctx.lineWidth = 3.2;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++){
    const rotation = cycle * 0.6 + (i / count) * TAU;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius - i * 16, rotation, rotation + Math.PI / 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawReeds(center, config, cycle){
  const radius = config.radius ?? 150;
  if (!cueWithinView(center.x, center.y, radius + 30)) return;
  const sway = config.sway ?? 0.4;
  ctx.save();
  ctx.strokeStyle = 'rgba(108, 158, 132, 0.5)';
  ctx.lineWidth = 2;
  const blades = 12;
  for (let i = 0; i < blades; i++){
    const angle = (i / blades) * TAU;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    const lean = Math.sin(cycle * 1.4 + i) * sway * 24;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + lean, y - 34);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWagonRuts(center, config){
  const length = config.length ?? 180;
  const width = config.width ?? 32;
  if (!cueWithinView(center.x, center.y, Math.max(length, width))) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 130, 90, 0.65)';
  ctx.lineWidth = width * 0.35;
  ctx.beginPath();
  ctx.moveTo(center.x - length / 2, center.y - width / 2);
  ctx.lineTo(center.x + length / 2, center.y - width / 2);
  ctx.moveTo(center.x - length / 2, center.y + width / 2);
  ctx.lineTo(center.x + length / 2, center.y + width / 2);
  ctx.stroke();
  ctx.restore();
}

function drawCrateShards(center, config, cycle){
  const count = config.count ?? 6;
  const radius = config.radius ?? 120;
  if (!cueWithinView(center.x, center.y, radius + 20)) return;
  ctx.save();
  ctx.fillStyle = 'rgba(205, 152, 102, 0.7)';
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU;
    const dist = radius * (0.4 + 0.5 * Math.sin(cycle + i));
    const x = center.x + Math.cos(angle) * dist;
    const y = center.y + Math.sin(angle) * dist;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.sin(cycle * 0.9 + i) * 0.2);
    ctx.globalAlpha = 0.4 + 0.3 * Math.sin(cycle * 1.2 + i);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawAshPlume(center, config, cycle){
  const spread = config.spread ?? 160;
  if (!cueWithinView(center.x, center.y, spread + 60)) return;
  const drift = config.drift ?? 60;
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 108, 94, 0.5)';
  ctx.lineWidth = 2;
  const ribbons = 5;
  for (let i = 0; i < ribbons; i++){
    ctx.beginPath();
    for (let t = 0; t <= 1; t += 0.2){
      const angle = Math.sin(cycle * 0.6 + i + t * 2) * 0.4 + (i - 2) * 0.1;
      const radius = spread * t;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y - drift * t + Math.sin(angle) * 24;
      if (t === 0){
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawBannerWind(center, config, cycle){
  const strength = config.strength ?? 0.6;
  const height = 80;
  if (!cueWithinView(center.x, center.y - height, 120)) return;
  ctx.save();
  ctx.fillStyle = 'rgba(174, 204, 236, 0.55)';
  for (let i = -1; i <= 1; i++){
    const x = center.x + i * 32;
    const sway = Math.sin(cycle * 1.3 + i) * 20 * strength;
    ctx.beginPath();
    ctx.moveTo(x, center.y - height);
    ctx.lineTo(x + sway, center.y - height + 24);
    ctx.lineTo(x, center.y - height + 48);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRipples(center, radius, cycle, color = 'rgba(255, 200, 120, 0.3)'){ 
  if (!cueWithinView(center.x, center.y, radius + 40)) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++){
    const progress = (cycle * 0.5 + i / 3) % 1;
    const r = radius * progress;
    ctx.globalAlpha = 0.4 * (1 - progress);
    ctx.beginPath();
    ctx.arc(center.x, center.y, r, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHawks(center, config, cycle){
  const count = config.count ?? 2;
  const radius = config.radius ?? 130;
  if (!cueWithinView(center.x, center.y, radius + 60)) return;
  ctx.save();
  ctx.strokeStyle = config.color || 'rgba(220, 210, 180, 0.7)';
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++){
    const angle = (i / count) * TAU + cycle * 0.6;
    const dist = radius * (0.7 + 0.25 * Math.sin(cycle + i));
    const x = center.x + Math.cos(angle) * dist;
    const y = center.y + Math.sin(angle) * dist - 40;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x, y - 6);
    ctx.lineTo(x + 10, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawQuestCues(){
  const cues = state.questCues;
  if (!Array.isArray(cues) || !cues.length) return;
  const cycleBase = state.time;
  for (const cue of cues){
    if (!cue) continue;
    const radius = cue.radius ?? 180;
    if (!cueWithinView(cue.x, cue.y, radius + 80)) continue;
    const intensity = clamp(cue.intensity ?? cue.baseIntensity ?? 0.18, 0, 1);
    const center = { x: cue.x, y: cue.y };
    const cycle = cycleBase * 0.6 + (cue.seed || 0) * Math.PI * 6;
    switch (cue.kind){
      case 'fetch-item': {
        const glowRadius = radius * (0.42 + intensity * 0.25);
        drawRadialGlow(cue.x, cue.y, glowRadius, '#8fffe6', 0.14 + intensity * 0.42);
        drawPollen(center, {
          count: Math.round(10 + intensity * 8),
          radius: radius * (0.34 + intensity * 0.18),
          color: 'rgba(180, 255, 220, 0.6)',
          size: 2.6
        }, cycle);
        break;
      }
      case 'sabotage-target': {
        const glowRadius = radius * (0.5 + intensity * 0.2);
        drawRadialGlow(cue.x, cue.y, glowRadius, '#ffb565', 0.16 + intensity * 0.44);
        drawOrbitingDots(center, {
          count: Math.round(6 + intensity * 8),
          orbitRadius: radius * (0.4 + intensity * 0.22),
          color: 'rgba(255, 174, 96, 0.75)',
          drift: 12 + intensity * 10,
          size: 3.2
        }, cycle);
        drawRipples(center, radius * (0.6 + intensity * 0.3), cycle * 0.9, `rgba(255, 180, 110, ${0.14 + intensity * 0.2})`);
        break;
      }
      case 'escort-npc': {
        const glowRadius = radius * (0.45 + intensity * 0.18);
        drawRadialGlow(cue.x, cue.y, glowRadius, '#9ed4ff', 0.12 + intensity * 0.34);
        drawOrbitingDots(center, {
          count: Math.round(5 + intensity * 7),
          orbitRadius: radius * (0.32 + intensity * 0.18),
          color: 'rgba(170, 220, 255, 0.75)',
          drift: 10 + intensity * 6,
          size: 3
        }, cycle);
        drawFootprints(center, { count: 5, radius: radius * 0.28, wobble: 18 }, cycle * 0.8);
        break;
      }
      case 'eliminate-enemy': {
        const glowRadius = radius * (0.38 + intensity * 0.22);
        drawRadialGlow(cue.x, cue.y, glowRadius, '#ff7676', 0.14 + intensity * 0.36);
        drawRipples(center, radius * (0.5 + intensity * 0.22), cycle, `rgba(255, 90, 90, ${0.12 + intensity * 0.22})`);
        drawHawks(center, { count: Math.round(2 + intensity * 2), radius: radius * 0.4, color: 'rgba(70, 70, 70, 0.7)' }, cycle * 0.7);
        break;
      }
      case 'clue':
      default: {
        const glowRadius = radius * (0.4 + intensity * 0.2);
        drawRadialGlow(cue.x, cue.y, glowRadius, '#7fc9ff', 0.12 + intensity * 0.36);
        drawOrbitingDots(center, {
          count: Math.round(6 + intensity * 6),
          orbitRadius: radius * (0.3 + intensity * 0.2),
          color: 'rgba(160, 220, 255, 0.8)',
          drift: 14 + intensity * 6,
          size: 2.4
        }, cycle);
        drawRipples(center, radius * (0.45 + intensity * 0.2), cycle * 1.1, `rgba(140, 210, 255, ${0.1 + intensity * 0.16})`);
        break;
      }
    }
  }
}

function drawDiegeticWorldEvents(){
  if (!state.worldEvents || !state.worldEvents.length) return;
  for (const eventState of state.worldEvents){
    if (!eventState || eventState.completed) continue;
    const phase = eventState.def.phases[eventState.phaseIndex];
    if (!phase) continue;
    const center = phase.focus || eventState.def.anchor || { x: 0, y: 0 };
    const cycle = eventState.cycle || 0;
    const cues = phase.cues || {};

    if (cues.hush){
      drawRadialGlow(center.x, center.y, (phase.radius ?? 220) * 0.9, 'rgba(40,70,60,0.4)', 0.2 + (cues.hush.intensity ?? 0.4) * 0.2);
    }
    if (cues.canopyGlow){
      drawRadialGlow(center.x, center.y - 80, cues.canopyGlow.radius ?? 200, cues.canopyGlow.color || '#6be5f2', 0.35 + 0.2 * Math.sin(cycle * 0.8));
    }
    if (cues.swampGlow){
      drawRadialGlow(center.x, center.y, cues.swampGlow.radius ?? 220, cues.swampGlow.color || '#4ee37d', 0.3 + 0.25 * Math.sin(cycle * 0.6));
    }
    if (cues.runeGlow){
      drawRadialGlow(center.x, center.y, cues.runeGlow.radius ?? 140, cues.runeGlow.color || '#b57bf8', 0.45 + 0.2 * Math.sin(cycle * 1.1));
    }
    if (cues.torchGlow){
      drawRadialGlow(center.x, center.y, cues.torchGlow.radius ?? 150, cues.torchGlow.color || '#ffae62', 0.4 + 0.2 * Math.sin(cycle));
    }
    if (cues.motes){
      drawOrbitingDots(center, cues.motes, cycle);
    }
    if (cues.patrolSmoke){
      drawOrbitingDots(center, { ...cues.patrolSmoke, color: 'rgba(130,130,130,0.5)', count: cues.patrolSmoke.count ?? 10, orbitRadius: cues.patrolSmoke.radius ?? 140, drift: 16 }, cycle);
    }
    if (cues.pollen){
      drawPollen(center, cues.pollen, cycle);
    }
    if (cues.footprints){
      drawFootprints(center, cues.footprints, cycle);
    }
    if (cues.barkMarks){
      drawBarkMarks(center, cues.barkMarks, cycle);
    }
    if (cues.witheredTrail){
      drawWitheredTrail(center, cues.witheredTrail, cycle);
    }
    if (cues.ghostSilhouettes){
      drawGhostSilhouettes(center, cues.ghostSilhouettes, cycle);
    }
    if (cues.clawMarks){
      drawClawMarks(center, cues.clawMarks, cycle);
    }
    if (cues.shrineChains){
      drawChains(center, cues.shrineChains, cycle);
    }
    if (cues.patrolReeds){
      drawReeds(center, cues.patrolReeds, cycle);
    }
    if (cues.hum){
      drawRipples(center, cues.hum.radius ?? (phase.radius ?? 200) * 0.7, cycle, 'rgba(150, 180, 255, 0.35)');
    }
    if (cues.bannerWind){
      drawBannerWind(center, cues.bannerWind, cycle);
    }
    if (cues.ashPlume){
      drawAshPlume(center, cues.ashPlume, cycle);
    }
    if (cues.drums){
      drawRipples(center, (phase.radius ?? 200) * 0.9, cycle, 'rgba(255, 190, 140, 0.28)');
    }
    if (cues.hawks){
      drawHawks(center, cues.hawks, cycle);
    }

    if (Array.isArray(phase.tasks) && phase.tasks.length){
      const phaseState = eventState.phaseStates?.get(phase.id);
      for (const task of phase.tasks){
        const tracker = phaseState?.subtasks?.find(item => item.id === task.id);
        if (tracker?.completed) continue;
        const taskCenter = task.position || center;
        const taskCues = task.cues || {};
        if (taskCues.herbGlow){
          drawRadialGlow(taskCenter.x, taskCenter.y, taskCues.herbGlow.radius ?? 90, taskCues.herbGlow.color || '#8fffe6', 0.38 + 0.2 * Math.sin(cycle * 1.1));
        }
        if (taskCues.pollen){
          drawPollen(taskCenter, taskCues.pollen, cycle);
        }
        if (taskCues.idolLight){
          drawRadialGlow(taskCenter.x, taskCenter.y, taskCues.idolLight.radius ?? 80, taskCues.idolLight.color || '#9cb4ff', 0.4 + 0.2 * Math.sin(cycle * 0.8));
        }
        if (taskCues.clawMarks){
          drawClawMarks(taskCenter, taskCues.clawMarks, cycle);
        }
      }
    }
  }
}

function drawGenericWorldEventProp(prop, cycle){
  const scale = prop.scale ?? 1;
  const radius = 18 * scale;
  ctx.fillStyle = '#253648';
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 2 * scale;
  ctx.strokeStyle = '#4c5d70';
  ctx.stroke();
  ctx.lineWidth = 1.4 * scale;
  ctx.strokeStyle = '#6c8098';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.55, 0, TAU);
  ctx.stroke();
}

function drawPropFaeBargainCircle(prop, cycle){
  const scale = (prop.scale ?? 1) * (prop.resolved ? 0.94 : 1);
  const shimmer = 0.75 + Math.sin(cycle * 2.4 + (prop.x + prop.y) * 0.004) * 0.25;
  const ring = 24 * scale;
  ctx.fillStyle = `rgba(107, 229, 242, ${(0.14 + shimmer * 0.1).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(0, 0, ring, 0, TAU);
  ctx.fill();
  ctx.lineWidth = 3.2 * scale;
  ctx.strokeStyle = '#6be5f2';
  ctx.stroke();

  ctx.strokeStyle = 'rgba(198, 255, 245, 0.9)';
  ctx.lineWidth = 1.4 * scale;
  for (let i = 0; i < 5; i++){
    const angle = (i / 5) * TAU + cycle * 0.4;
    const inner = 9 * scale;
    const outer = ring - 2 * scale;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
    ctx.quadraticCurveTo(Math.cos(angle) * (outer - 4 * scale), Math.sin(angle) * (outer - 4 * scale), Math.cos(angle) * outer, Math.sin(angle) * outer);
    ctx.stroke();
  }

  ctx.fillStyle = '#1a2d3c';
  ctx.beginPath();
  ctx.arc(0, 0, 6 * scale, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.rotate(Math.sin(cycle * 1.4) * 0.25);
  ctx.fillStyle = `rgba(173, 255, 227, ${0.35 + shimmer * 0.15})`;
  ctx.beginPath();
  ctx.ellipse(0, -8 * scale, 6 * scale, 12 * scale, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawPropFaeRunestoneCluster(prop, cycle){
  const scale = prop.scale ?? 1;
  const offsets = [-20, 0, 22];
  const heights = [44, 56, 48];
  const colors = ['#2c2646', '#332a59', '#292440'];
  for (let i = 0; i < offsets.length; i++){
    const width = (8 + i * 2) * scale;
    const height = heights[i] * scale;
    ctx.save();
    ctx.translate(offsets[i] * scale, 0);
    ctx.rotate((i - 1) * 0.18);
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.moveTo(-width, 12 * scale);
    ctx.lineTo(-width * 0.6, -height + 8 * scale);
    ctx.lineTo(width * 0.6, -height + 2 * scale);
    ctx.lineTo(width, 12 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2.4 * scale;
    ctx.strokeStyle = adjustHexColor(colors[i], 0.25);
    ctx.stroke();

    const runePulse = 0.6 + Math.sin(cycle * 1.2 + i) * 0.3;
    ctx.strokeStyle = `rgba(197, 168, 255, ${0.55 + runePulse * 0.35})`;
    ctx.lineWidth = 1.6 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -height + 12 * scale);
    ctx.lineTo(0, -12 * scale);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-width * 0.4, -height * 0.4);
    ctx.lineTo(width * 0.4, -height * 0.2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawPropMoonblossomPatch(prop, cycle){
  const scale = prop.scale ?? 1;
  ctx.fillStyle = 'rgba(18, 50, 36, 0.9)';
  ctx.beginPath();
  ctx.ellipse(0, 8 * scale, 28 * scale, 14 * scale, 0, 0, TAU);
  ctx.fill();

  const petals = 6;
  const baseRadius = 16 * scale;
  for (let i = 0; i < petals; i++){
    const angle = (i / petals) * TAU + Math.sin(cycle * 0.6 + i) * 0.05;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = `rgba(143, 255, 230, ${0.55 + Math.sin(cycle * 1.1 + i) * 0.15})`;
    ctx.beginPath();
    ctx.ellipse(baseRadius, 0, 8 * scale, 14 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = '#1e4c38';
  ctx.beginPath();
  ctx.arc(0, 0, 6 * scale, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210, 255, 240, 0.8)';
  ctx.lineWidth = 1.2 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, baseRadius * 0.6, 0, TAU);
  ctx.stroke();
}

function drawPropBogIdolCache(prop, cycle){
  const scale = prop.scale ?? 1;
  ctx.fillStyle = 'rgba(20, 30, 48, 0.85)';
  ctx.beginPath();
  ctx.ellipse(0, 10 * scale, 26 * scale, 14 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#2a345a';
  ctx.fillRect(-12 * scale, 2 * scale, 24 * scale, 12 * scale);

  const pulse = 0.55 + Math.sin(cycle * 1.3) * 0.25;
  ctx.fillStyle = `rgba(156, 180, 255, ${0.6 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.moveTo(-8 * scale, 2 * scale);
  ctx.lineTo(0, -22 * scale);
  ctx.lineTo(8 * scale, 2 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(220, 235, 255, 0.9)';
  ctx.lineWidth = 1.4 * scale;
  ctx.beginPath();
  ctx.moveTo(0, -18 * scale);
  ctx.lineTo(0, -4 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-4 * scale, -12 * scale);
  ctx.lineTo(4 * scale, -8 * scale);
  ctx.stroke();

  ctx.fillStyle = '#1a223c';
  ctx.beginPath();
  ctx.arc(0, -6 * scale, 2.8 * scale, 0, TAU);
  ctx.fill();
}

function drawPropCursedShrineCore(prop, cycle){
  const scale = prop.scale ?? 1;
  const ring = 26 * scale;
  ctx.strokeStyle = 'rgba(17, 50, 38, 0.85)';
  ctx.lineWidth = 6 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, ring * 0.8, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = '#8be6c2';
  ctx.lineWidth = 3.2 * scale;
  ctx.beginPath();
  ctx.arc(0, 0, ring, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(139, 230, 194, 0.8)';
  ctx.lineWidth = 2 * scale;
  for (let i = 0; i < 3; i++){
    const angle = (i / 3) * TAU + Math.sin(cycle * 0.6 + i) * 0.1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * ring, Math.sin(angle) * ring);
    ctx.lineTo(Math.cos(angle) * ring * 1.25, Math.sin(angle) * ring * 1.25 + 6 * scale);
    ctx.stroke();
  }

  ctx.fillStyle = '#123024';
  ctx.beginPath();
  ctx.arc(0, 0, 8 * scale, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#8be6c2';
  ctx.fillRect(-3 * scale, -10 * scale, 6 * scale, 14 * scale);
}

function drawPropOverturnedCart(prop, cycle){
  const scale = prop.scale ?? 1;
  const bodyW = 58 * scale;
  const bodyH = 22 * scale;
  ctx.fillStyle = '#4b2f1a';
  ctx.beginPath();
  ctx.moveTo(-bodyW / 2, -bodyH / 2);
  ctx.lineTo(bodyW / 2, -bodyH / 2);
  ctx.lineTo(bodyW / 2 - 6 * scale, bodyH / 2);
  ctx.lineTo(-bodyW / 2 - 6 * scale, bodyH / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#2f1d10';
  for (let i = -2; i <= 2; i++){
    ctx.fillRect(i * 12 * scale - 2 * scale, -bodyH / 2, 4 * scale, bodyH + 6 * scale);
  }

  const wheelY = bodyH / 2 + 6 * scale;
  ctx.strokeStyle = '#3c2614';
  ctx.lineWidth = 4.2 * scale;
  ctx.beginPath();
  ctx.arc(-bodyW * 0.35, wheelY, 11 * scale, 0, TAU);
  ctx.arc(bodyW * 0.35, wheelY * 0.8, 13 * scale, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = 'rgba(197, 138, 59, 0.8)';
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 4 * scale, bodyH / 2);
  ctx.quadraticCurveTo(bodyW / 2 + 10 * scale, bodyH / 2 + 4 * scale, bodyW / 2 - 10 * scale, bodyH / 2 + 10 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#c58a3b';
  ctx.lineWidth = 1.6 * scale;
  ctx.beginPath();
  ctx.moveTo(bodyW / 2 - 6 * scale, bodyH / 2 - 2 * scale);
  ctx.lineTo(bodyW / 2 + 12 * scale, bodyH / 2 + 8 * scale);
  ctx.lineTo(bodyW / 2 - 12 * scale, bodyH / 2 + 10 * scale);
  ctx.closePath();
  ctx.stroke();

  if (prop.resolved){
    ctx.strokeStyle = 'rgba(255, 180, 90, 0.6)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2 - 4 * scale, -bodyH / 2);
    ctx.lineTo(-bodyW / 2 - 12 * scale, -bodyH / 2 - 12 * scale);
    ctx.stroke();
  }
}

function drawPropRaiderSupplyCache(prop, cycle){
  const scale = prop.scale ?? 1;
  const crateW = 24 * scale;
  const crateH = 20 * scale;
  ctx.fillStyle = '#5a3922';
  ctx.fillRect(-crateW - 4 * scale, -crateH / 2, crateW, crateH);
  ctx.strokeStyle = '#c9863a';
  ctx.lineWidth = 2 * scale;
  ctx.strokeRect(-crateW - 4 * scale, -crateH / 2, crateW, crateH);
  ctx.beginPath();
  ctx.moveTo(-crateW - 4 * scale, -crateH / 2);
  ctx.lineTo(-4 * scale, crateH / 2);
  ctx.moveTo(-crateW - 4 * scale, crateH / 2);
  ctx.lineTo(-4 * scale, -crateH / 2);
  ctx.stroke();

  const barrelRadius = 10 * scale;
  ctx.fillStyle = '#723c19';
  ctx.beginPath();
  ctx.ellipse(16 * scale, -4 * scale, barrelRadius, barrelRadius * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b56a2f';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.ellipse(16 * scale, -4 * scale, barrelRadius, barrelRadius * 0.8, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(16 * scale - barrelRadius, -4 * scale);
  ctx.lineTo(16 * scale + barrelRadius, -4 * scale);
  ctx.stroke();

  ctx.fillStyle = '#6b2f1a';
  ctx.beginPath();
  ctx.ellipse(2 * scale, 10 * scale, barrelRadius * 0.9, barrelRadius * 0.7, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#b56a2f';
  ctx.beginPath();
  ctx.ellipse(2 * scale, 10 * scale, barrelRadius * 0.9, barrelRadius * 0.7, 0, 0, TAU);
  ctx.stroke();

  if (!prop.resolved){
    const fusePulse = 0.4 + Math.sin(cycle * 6) * 0.25;
    ctx.strokeStyle = `rgba(255, 200, 110, ${0.6 + fusePulse * 0.3})`;
    ctx.lineWidth = 1.5 * scale;
    ctx.beginPath();
    ctx.moveTo(16 * scale, -4 * scale - barrelRadius * 0.8);
    ctx.lineTo(16 * scale + 6 * scale, -16 * scale);
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(90, 100, 120, 0.6)';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.moveTo(-crateW - 8 * scale, crateH / 2 + 2 * scale);
    ctx.lineTo(24 * scale, -crateH / 2 - 8 * scale);
    ctx.stroke();
  }
}

function drawWorldEventProps(){
  const props = state.worldEventProps;
  if (!Array.isArray(props) || !props.length) return;
  const cycle = state.time;
  for (const prop of props){
    const radius = prop.radius ?? 80;
    if (!cueWithinView(prop.x, prop.y, radius + 80)) continue;
    ctx.save();
    ctx.translate(prop.x, prop.y);
    if (typeof prop.orientation === 'number' && prop.orientation !== 0){
      ctx.rotate(prop.orientation);
    }
    ctx.globalAlpha = prop.resolved ? 0.6 : 0.95;
    const renderer = WORLD_EVENT_PROP_RENDERERS[prop.type] || drawGenericWorldEventProp;
    renderer(prop, cycle);
    ctx.restore();

    switch (prop.type){
      case 'fae-bargain-circle':
        drawRadialGlow(prop.x, prop.y, radius * 0.55, 'rgba(107, 229, 242, 0.35)', prop.resolved ? 0.2 : 0.38);
        break;
      case 'fae-runestone-cluster':
        drawRadialGlow(prop.x, prop.y, radius * 0.9, 'rgba(181, 123, 248, 0.45)', prop.resolved ? 0.28 : 0.5);
        break;
      case 'moonblossom-patch':
        drawRadialGlow(prop.x, prop.y, radius * 0.6, 'rgba(143, 255, 230, 0.35)', prop.resolved ? 0.2 : 0.42);
        break;
      case 'bog-idol-cache':
        drawRadialGlow(prop.x, prop.y, radius * 0.6, 'rgba(156, 180, 255, 0.35)', prop.resolved ? 0.22 : 0.4);
        break;
      case 'cursed-shrine-core':
        drawRadialGlow(prop.x, prop.y, radius * 0.75, 'rgba(139, 230, 194, 0.38)', prop.resolved ? 0.26 : 0.46);
        break;
      case 'overturned-cart':
        drawRadialGlow(prop.x, prop.y, radius * 0.5, 'rgba(255, 174, 98, 0.2)', prop.resolved ? 0.14 : 0.28);
        break;
      case 'raider-supply-cache':
        drawRadialGlow(prop.x, prop.y, radius * 0.55, 'rgba(255, 174, 98, 0.25)', prop.resolved ? 0.18 : 0.33);
        break;
      default:
        drawRadialGlow(prop.x, prop.y, radius * 0.5, 'rgba(150, 180, 210, 0.2)', prop.resolved ? 0.16 : 0.26);
        break;
    }
  }
}

function drawPointsOfInterest(){
  if (!state.pointsOfInterest || !state.pointsOfInterest.length) return;
  for (const poi of state.pointsOfInterest){
    const style = POI_STYLES[poi.type] || { outer: '#1b2738', inner: '#9fb3c8' };
    ctx.save();
    ctx.translate(poi.x, poi.y);
    if (poi.diegetic){
      const pulse = 1 + Math.sin(state.time * 2.2 + poi.x * 0.01 + poi.y * 0.01) * 0.35;
      ctx.globalAlpha = poi.resolved ? 0.35 : 0.78;
      if (poi.type === 'runestone-cache'){
        const size = 7 * pulse;
        ctx.fillStyle = style.inner;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.7, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.7, 0);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.outer;
        ctx.stroke();
      } else if (poi.type === 'fae-fairy'){
        const wing = 6 + pulse * 2;
        ctx.fillStyle = style.inner;
        ctx.beginPath();
        ctx.moveTo(0, -wing * 0.6);
        ctx.quadraticCurveTo(wing, -wing, wing * 0.8, 0);
        ctx.quadraticCurveTo(wing, wing, 0, wing * 0.6);
        ctx.quadraticCurveTo(-wing, wing, -wing * 0.8, 0);
        ctx.quadraticCurveTo(-wing, -wing, 0, -wing * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha *= 0.65;
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = style.outer;
        ctx.stroke();
      } else if (poi.type === 'cursed-shrine-core'){
        const ring = 8 + pulse * 3;
        ctx.lineWidth = 3;
        ctx.strokeStyle = style.inner;
        ctx.beginPath();
        ctx.arc(0, 0, ring, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha *= 0.6;
        ctx.strokeStyle = style.outer;
        ctx.beginPath();
        ctx.arc(0, 0, ring * 0.55, 0, TAU);
        ctx.stroke();
      } else if (poi.type === 'mire-moonblossom'){
        const petals = 5;
        const radius = 5 + pulse * 1.6;
        ctx.fillStyle = style.inner;
        for (let i = 0; i < petals; i++){
          const angle = (i / petals) * TAU;
          ctx.beginPath();
          ctx.ellipse(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6, radius, radius * 0.6, angle, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle = style.outer;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 0.7, 0, TAU);
        ctx.fill();
      } else if (poi.type === 'mire-bog-idol'){
        const base = 6 + pulse;
        ctx.fillStyle = style.inner;
        ctx.beginPath();
        ctx.moveTo(-base * 0.6, base);
        ctx.lineTo(-base * 0.2, -base);
        ctx.lineTo(base * 0.2, -base);
        ctx.lineTo(base * 0.6, base);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.outer;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -base * 0.2, base * 0.35, 0, TAU);
        ctx.stroke();
      } else if (poi.type === 'ember-ambush'){
        const arc = 10 + pulse * 2;
        ctx.fillStyle = style.inner;
        ctx.beginPath();
        ctx.moveTo(-arc, arc * 0.4);
        ctx.lineTo(arc, arc * 0.4);
        ctx.lineTo(0, -arc);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.lineWidth = 2;
        ctx.strokeStyle = style.outer;
        ctx.stroke();
      } else if (poi.type === 'ember-trail'){
        const spoke = 8 + pulse * 1.4;
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = style.inner;
        ctx.beginPath();
        ctx.arc(0, 0, spoke, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha *= 0.6;
        ctx.strokeStyle = style.outer;
        for (let i = 0; i < 4; i++){
          const angle = (i / 4) * TAU;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(angle) * spoke, Math.sin(angle) * spoke);
          ctx.stroke();
        }
      }
    } else {
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
