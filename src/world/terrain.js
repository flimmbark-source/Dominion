import {
  PATH_CLEAR_RADIUS,
  PATH_WIDTH_MAIN,
  TREE_CANOPY_MAX,
  TREE_CANOPY_MIN,
  TREE_CLEARING_CHANCE,
  TREE_MAX_SPACING,
  TREE_MIN_SPACING,
  VILLAGES,
  WORLD,
  treePathNoise
} from '../data/world.js';
import { centerOf, pointInRect, distToSegment, rectsOverlap } from '../utils/geometry.js';
import { TAU, randRange } from '../utils/math.js';
import { state } from '../state/gameState.js';
import { getTavernDoorRect } from '../state/tavern.js';
import { ctx, W, H } from '../game/canvas.js';

const roads = [];
let forestSolids = [];
const pathSegments = [];
const terrainZones = [];
const terrainProps = [];
const zonePatternCache = new Map();

const ZONE_STYLES = {
  eerieForest: {
    base: '#121a26',
    overlay: ['rgba(46, 72, 102, 0.26)', 'rgba(8, 12, 18, 0.55)'],
    border: 'rgba(110, 160, 190, 0.16)',
    dash: [14, 12],
    tileSize: 160
  },
  hauntedRuins: {
    base: '#17141d',
    overlay: ['rgba(92, 78, 102, 0.3)', 'rgba(10, 8, 14, 0.55)'],
    border: 'rgba(178, 148, 198, 0.18)',
    dash: [8, 10],
    tileSize: 144
  },
  mireSwamp: {
    base: '#0f1814',
    overlay: ['rgba(78, 116, 94, 0.22)', 'rgba(6, 10, 8, 0.55)'],
    border: 'rgba(126, 182, 140, 0.18)',
    dash: [18, 14],
    tileSize: 176
  }
};

function ensureZonePattern(type){
  if (zonePatternCache.has(type)) return zonePatternCache.get(type);
  const style = ZONE_STYLES[type];
  if (!style){
    zonePatternCache.set(type, '#101820');
    return zonePatternCache.get(type);
  }
  if (typeof document === 'undefined' || !document.createElement){
    zonePatternCache.set(type, style.base);
    return zonePatternCache.get(type);
  }

  const size = style.tileSize ?? 160;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d');
  g.fillStyle = style.base;
  g.fillRect(0, 0, size, size);

  switch (type){
    case 'eerieForest': {
      g.strokeStyle = 'rgba(78, 118, 150, 0.24)';
      g.lineWidth = 3;
      for (let x = -24; x < size + 24; x += 36){
        g.beginPath();
        g.moveTo(x + 10, size + 4);
        g.quadraticCurveTo(x + 20, size * 0.62, x + 6, size * 0.18);
        g.stroke();
        g.beginPath();
        g.moveTo(x + 26, size + 4);
        g.quadraticCurveTo(x + 18, size * 0.72, x + 30, size * 0.26);
        g.stroke();
      }

      g.fillStyle = 'rgba(118, 182, 214, 0.08)';
      const glowR = size * 0.18;
      g.beginPath();
      g.arc(size * 0.32, size * 0.42, glowR, 0, TAU);
      g.arc(size * 0.68, size * 0.66, glowR * 1.2, 0, TAU);
      g.fill();

      g.strokeStyle = 'rgba(26, 34, 48, 0.34)';
      g.lineWidth = 1;
      for (let i = 0; i < 6; i++){
        const px = (i * 27) % size;
        const py = ((i * 41) % size) * 0.55 + size * 0.22;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + 8, py - 12);
        g.lineTo(px + 4, py - 4);
        g.stroke();
      }
      break;
    }
    case 'hauntedRuins': {
      const brickW = 36;
      const brickH = 20;
      for (let y = -brickH; y < size + brickH; y += brickH){
        const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
        for (let x = -brickW; x < size + brickW; x += brickW){
          const bx = x + offset;
          g.fillStyle = 'rgba(92, 78, 108, 0.32)';
          g.fillRect(bx + 4, y + 6, brickW - 8, brickH - 10);
          g.strokeStyle = 'rgba(28, 20, 36, 0.35)';
          g.lineWidth = 1.1;
          g.strokeRect(bx + 4, y + 6, brickW - 8, brickH - 10);
        }
      }

      g.strokeStyle = 'rgba(186, 156, 204, 0.18)';
      g.lineWidth = 2.2;
      g.beginPath();
      g.moveTo(size * 0.1, size * 0.82);
      g.lineTo(size * 0.38, size * 0.28);
      g.lineTo(size * 0.7, size * 0.46);
      g.stroke();

      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(size * 0.58, size * 0.18);
      g.lineTo(size * 0.88, size * 0.08);
      g.lineTo(size * 0.82, size * 0.28);
      g.stroke();

      g.fillStyle = 'rgba(210, 190, 220, 0.06)';
      g.beginPath();
      g.arc(size * 0.24, size * 0.24, size * 0.14, 0, TAU);
      g.arc(size * 0.78, size * 0.64, size * 0.1, 0, TAU);
      g.fill();
      break;
    }
    case 'mireSwamp': {
      g.fillStyle = 'rgba(34, 52, 40, 0.55)';
      for (let y = -24; y < size + 24; y += 34){
        g.beginPath();
        g.moveTo(-12, y);
        let wave = 0;
        for (let x = -12; x <= size + 12; x += 16){
          const offset = (wave % 2 === 0) ? 6 : -6;
          g.quadraticCurveTo(x + 8, y + offset, x + 16, y + 2);
          wave++;
        }
        g.lineTo(size + 12, y + 18);
        g.lineTo(-12, y + 18);
        g.closePath();
        g.fill();
      }

      g.fillStyle = 'rgba(10, 18, 12, 0.55)';
      for (let i = 0; i < 4; i++){
        const cx = (i * 41) % size;
        const cy = (i * 53) % size;
        g.beginPath();
        g.ellipse(cx, cy, 24, 12, 0, 0, TAU);
        g.fill();
      }

      g.strokeStyle = 'rgba(150, 210, 160, 0.18)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(size * 0.66, size * 0.34, size * 0.18, 0, TAU);
      g.stroke();

      g.fillStyle = 'rgba(126, 198, 148, 0.08)';
      g.beginPath();
      g.arc(size * 0.32, size * 0.62, size * 0.16, 0, TAU);
      g.fill();
      break;
    }
    default:
      break;
  }

  const pattern = ctx.createPattern(tile, 'repeat');
  zonePatternCache.set(type, pattern);
  return pattern;
}

function defaultPropRadius(type){
  switch (type){
    case 'graveyard': return 90;
    case 'signpost': return 42;
    case 'fungusCircle': return 70;
    case 'ruinedObelisk': return 60;
    default: return 48;
  }
}

function placeTerrainProp(type, x, y, options = {}){
  const scale = options.scale ?? 1;
  const baseRadius = options.radius ?? defaultPropRadius(type);
  const radius = baseRadius * scale;
  terrainProps.push({
    type,
    x,
    y,
    rotation: options.rotation ?? 0,
    scale,
    direction: options.direction ?? 1,
    radius,
    clearRadius: options.clearRadius ?? radius * 1.1
  });
}

function addRoad(x, y, w, h){
  roads.push({ x, y, w, h });
}

function projectToVillageEdge(point, toward){
  const result = { x: point.x, y: point.y };
  for (const village of VILLAGES){
    if (!pointInRect(result.x, result.y, village)) continue;

    const dx = toward.x - result.x;
    const dy = toward.y - result.y;
    const EPS = 1e-6;
    let bestT = null;

    if (Math.abs(dx) > EPS){
      const tx = dx > 0 ? (village.x + village.w - result.x) / dx : (village.x - result.x) / dx;
      if (tx >= 0 && tx <= 1){
        const y = result.y + dy * tx;
        if (y >= village.y - EPS && y <= village.y + village.h + EPS){
          bestT = bestT === null ? tx : Math.min(bestT, tx);
        }
      }
    }

    if (Math.abs(dy) > EPS){
      const ty = dy > 0 ? (village.y + village.h - result.y) / dy : (village.y - result.y) / dy;
      if (ty >= 0 && ty <= 1){
        const x = result.x + dx * ty;
        if (x >= village.x - EPS && x <= village.x + village.w + EPS){
          bestT = bestT === null ? ty : Math.min(bestT, ty);
        }
      }
    }

    if (bestT === null) continue;

    const exitX = result.x + dx * bestT;
    const exitY = result.y + dy * bestT;
    const len = Math.hypot(dx, dy);
    if (len > EPS){
      const remaining = Math.max(0, len - len * bestT);
      const push = Math.min(3, remaining * 0.5);
      return {
        x: exitX + (dx / len) * push,
        y: exitY + (dy / len) * push
      };
    }
    return { x: exitX, y: exitY };
  }
  return result;
}

function pushPathSegment(a, b, width){
  const start = projectToVillageEdge(a, b);
  const end = projectToVillageEdge(b, start);
  if (start.x === end.x && start.y === end.y) return;
  pathSegments.push({ a: start, b: end, width });
}

function generateWorld(){
  roads.length = 0;
  forestSolids = [];
  pathSegments.length = 0;
  terrainZones.length = 0;
  terrainProps.length = 0;

  for (const village of VILLAGES){
    addRoad(village.x + 160, village.y + village.h/2 - 20, village.w - 320, 40);
  }

  const centers = VILLAGES.map(centerOf);
  const nearest = centers.map(() => new Set());

  for (let i = 0; i < centers.length; i++){
    let best = Infinity;
    for (let j = 0; j < centers.length; j++){
      if (i === j) continue;
      const dx = centers[j].x - centers[i].x;
      const dy = centers[j].y - centers[i].y;
      const dist = Math.hypot(dx, dy);
      if (dist < best - 1e-6){
        best = dist;
        nearest[i].clear();
        nearest[i].add(j);
      } else if (Math.abs(dist - best) <= 1e-6){
        nearest[i].add(j);
      }
    }
  }

  function connectVillages(i, j){
    const a = centers[i];
    const b = centers[j];
    const dir = { x: b.x - a.x, y: b.y - a.y };
    const dist = Math.hypot(dir.x, dir.y);
    if (dist < 1){
      pushPathSegment(a, b, PATH_WIDTH_MAIN);
      return;
    }

    const nx = -dir.y / dist;
    const ny = dir.x / dist;
    const bend = ((i + j) % 2 === 0) ? 1 : -1;
    const firstOffset = Math.min(220, dist * 0.25);
    const secondOffset = Math.min(180, dist * 0.25);
    const first = {
      x: a.x + dir.x * 0.33 + nx * firstOffset * bend,
      y: a.y + dir.y * 0.33 + ny * firstOffset * bend
    };
    const second = {
      x: a.x + dir.x * 0.66 - nx * secondOffset * bend,
      y: a.y + dir.y * 0.66 - ny * secondOffset * bend
    };

    const segments = [a, first, second, b];
    for (let s = 0; s < segments.length - 1; s++){
      pushPathSegment(segments[s], segments[s + 1], PATH_WIDTH_MAIN);
    }
  }

  for (let i = 0; i < nearest.length; i++){
    for (const j of nearest[i]){
      if (i < j){
        connectVillages(i, j);
      }
    }
  }

  const corridor = PATH_CLEAR_RADIUS;
  let y = 0;
  while (y < WORLD.H){
    const spacingY = randRange(TREE_MIN_SPACING, TREE_MAX_SPACING);
    const cy = y + spacingY * (0.35 + Math.random() * 0.4);
    y += spacingY;
    if (cy > WORLD.H) continue;

    let x = 0;
    while (x < WORLD.W){
      const spacingX = randRange(TREE_MIN_SPACING, TREE_MAX_SPACING);
      const cx = x + spacingX * (0.35 + Math.random() * 0.4);
      x += spacingX;
      if (cx > WORLD.W) continue;

      if (Math.random() < TREE_CLEARING_CHANCE) continue;
      const noise = treePathNoise(cx, cy);
      if (Math.abs(noise) < 0.32) continue;

      let skip = false;
      for (const v of VILLAGES){ if (pointInRect(cx,cy,v)) { skip = true; break; } }
      if (skip) continue;
      for (const r of roads){ if (pointInRect(cx,cy,r)) { skip = true; break; } }
      if (skip) continue;

      const canopyRadius = randRange(TREE_CANOPY_MIN, TREE_CANOPY_MAX);
      let nearPath = false;
      for (const seg of pathSegments){
        const clearance = Math.max(corridor, seg.width/2 + canopyRadius + 18);
        if (distToSegment(cx,cy, seg.a.x,seg.a.y, seg.b.x,seg.b.y) < clearance) { nearPath = true; break; }
      }
      if (nearPath) continue;

      const trunkWidth = randRange(canopyRadius * 0.34, canopyRadius * 0.46);
      const trunkHeight = randRange(canopyRadius * 0.9, canopyRadius * 1.25);
      const collisionSize = trunkWidth * 1.3;
      forestSolids.push({
        x: cx - collisionSize/2,
        y: cy - collisionSize/2,
        w: collisionSize,
        h: collisionSize,
        cx,
        cy,
        canopyRadius,
        trunkWidth,
        trunkHeight,
        canopyOffset: randRange(-canopyRadius * 0.12, canopyRadius * 0.18),
        shadowRadius: canopyRadius * randRange(0.78, 0.94),
        shadowAlpha: 0.16 + Math.random() * 0.05
      });
    }
  }

  const tavern = state.tavern;
  if (tavern){
    const stumpRadius = tavern.stump?.radius ?? 46;
    const clearR = Math.max(stumpRadius, tavern.clearRadius ?? stumpRadius);
    const cx = tavern.stump?.cx ?? (tavern.x + tavern.w/2);
    const cy = tavern.stump?.cy ?? (tavern.y + tavern.h/2);
    const glowR = Math.max(clearR, tavern.glowRadius ?? clearR);
    forestSolids = forestSolids.filter(tile => {
      const dx = tile.cx - cx;
      const dy = tile.cy - cy;
      const radius = glowR + (tile.canopyRadius ?? 0);
      return (dx*dx + dy*dy) > radius * radius;
    });
  }

  const zoneDefs = [
    { type: 'eerieForest', x: 2680, y: 2520, w: 1960, h: 1560 },
    { type: 'hauntedRuins', x: 5080, y: 1680, w: 1500, h: 1200, clearTrees: true, treeBuffer: 120 },
    { type: 'mireSwamp', x: 1460, y: 5200, w: 1800, h: 1500, clearTrees: true, treeBuffer: 110 }
  ];

  for (const zone of zoneDefs){
    terrainZones.push(zone);
  }

  for (const zone of terrainZones){
    if (!zone.clearTrees) continue;
    const buffer = zone.treeBuffer ?? 60;
    forestSolids = forestSolids.filter(tree => {
      const px = tree.cx;
      const py = tree.cy;
      return !(
        px >= zone.x - buffer &&
        px <= zone.x + zone.w + buffer &&
        py >= zone.y - buffer &&
        py <= zone.y + zone.h + buffer
      );
    });
  }

  const eerie = terrainZones.find(z => z.type === 'eerieForest');
  if (eerie){
    placeTerrainProp('fungusCircle', eerie.x + eerie.w * 0.24, eerie.y + eerie.h * 0.36, { scale: 1.25, rotation: 0.18 });
    placeTerrainProp('signpost', eerie.x + eerie.w * 0.72, eerie.y + eerie.h * 0.18, { rotation: -0.22, direction: -1, scale: 1.05 });
    placeTerrainProp('graveyard', eerie.x + eerie.w * 0.52, eerie.y + eerie.h * 0.68, { rotation: -0.1, scale: 0.92 });
  }

  const ruins = terrainZones.find(z => z.type === 'hauntedRuins');
  if (ruins){
    placeTerrainProp('graveyard', ruins.x + ruins.w * 0.42, ruins.y + ruins.h * 0.6, { rotation: 0.08, scale: 1.1 });
    placeTerrainProp('ruinedObelisk', ruins.x + ruins.w * 0.68, ruins.y + ruins.h * 0.34, { rotation: 0.32, scale: 1.2 });
    placeTerrainProp('signpost', ruins.x + ruins.w * 0.18, ruins.y + ruins.h * 0.22, { rotation: 0.05, direction: 1, scale: 0.95 });
  }

  const swamp = terrainZones.find(z => z.type === 'mireSwamp');
  if (swamp){
    placeTerrainProp('fungusCircle', swamp.x + swamp.w * 0.68, swamp.y + swamp.h * 0.28, { scale: 1.1, rotation: -0.08 });
    placeTerrainProp('signpost', swamp.x + swamp.w * 0.32, swamp.y + swamp.h * 0.12, { rotation: 0.12, direction: -1, scale: 1.1 });
    placeTerrainProp('graveyard', swamp.x + swamp.w * 0.38, swamp.y + swamp.h * 0.72, { rotation: -0.18, scale: 0.88 });
  }

  if (terrainProps.length){
    forestSolids = forestSolids.filter(tree => {
      for (const prop of terrainProps){
        const clear = (prop.clearRadius ?? prop.radius) + tree.canopyRadius * 0.4;
        const dx = tree.cx - prop.x;
        const dy = tree.cy - prop.y;
        if (dx*dx + dy*dy <= clear * clear) return false;
      }
      return true;
    });
  }
}

function drawZone(zone){
  const style = ZONE_STYLES[zone.type];
  const fill = ensureZonePattern(zone.type);

  ctx.save();
  ctx.fillStyle = fill || style?.base || '#101820';
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  if (style?.overlay){
    const overlay = ctx.createLinearGradient(zone.x, zone.y, zone.x + zone.w, zone.y + zone.h);
    overlay.addColorStop(0, style.overlay[0]);
    overlay.addColorStop(1, style.overlay[1]);
    ctx.fillStyle = overlay;
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  }

  const centerX = zone.x + zone.w / 2;
  const centerY = zone.y + zone.h / 2;
  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(zone.w, zone.h) * 0.12,
    centerX,
    centerY,
    Math.max(zone.w, zone.h) * 0.78
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(4, 6, 8, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(zone.x, zone.y, zone.w, zone.h);

  if (style?.border){
    ctx.strokeStyle = style.border;
    ctx.lineWidth = 2;
    if (style.dash){
      ctx.setLineDash(style.dash);
    }
    ctx.strokeRect(zone.x + 0.5, zone.y + 0.5, zone.w - 1, zone.h - 1);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawTerrainProp(prop){
  switch (prop.type){
    case 'graveyard':
      drawGraveyardProp(prop);
      break;
    case 'signpost':
      drawSignpostProp(prop);
      break;
    case 'fungusCircle':
      drawFungusCircleProp(prop);
      break;
    case 'ruinedObelisk':
      drawRuinedObeliskProp(prop);
      break;
    default:
      break;
  }
}

function drawGraveyardProp(prop){
  const scale = prop.scale ?? 1;
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.rotation || 0);

  const baseX = 56 * scale;
  const baseY = 32 * scale;
  ctx.fillStyle = 'rgba(28, 18, 26, 0.72)';
  ctx.beginPath();
  ctx.ellipse(0, 0, baseX, baseY, 0, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = 'rgba(60, 38, 52, 0.45)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.ellipse(0, 0, baseX, baseY, 0, 0, TAU);
  ctx.stroke();

  const stones = [
    { x: -28, width: 16, height: 26, tilt: -0.18, color: '#6f7486' },
    { x: 0, width: 20, height: 34, tilt: 0.05, color: '#848a9c' },
    { x: 28, width: 15, height: 24, tilt: 0.14, color: '#6b7182' }
  ];

  for (const stone of stones){
    ctx.save();
    ctx.translate(stone.x * scale, -stone.height * 0.5 * scale - 6 * scale);
    ctx.rotate(stone.tilt);
    const w = stone.width * scale;
    const h = stone.height * scale;
    const radius = Math.min(w, h) * 0.4;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2, -h + radius);
    ctx.quadraticCurveTo(0, -h - radius * 0.15, w / 2, -h + radius);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = stone.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(26, 28, 40, 0.55)';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(22, 24, 34, 0.35)';
    ctx.lineWidth = 0.6 * scale;
    ctx.beginPath();
    ctx.moveTo(-w * 0.18, -h * 0.45);
    ctx.lineTo(w * 0.25, -h * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(-36 * scale, -12 * scale);
  ctx.rotate(-0.18);
  ctx.fillStyle = '#7b8190';
  ctx.fillRect(-2 * scale, -18 * scale, 4 * scale, 26 * scale);
  ctx.fillRect(-8 * scale, -10 * scale, 14 * scale, 4 * scale);
  ctx.restore();

  ctx.fillStyle = 'rgba(150, 120, 180, 0.12)';
  ctx.beginPath();
  ctx.arc(0, -32 * scale, 14 * scale, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawSignpostProp(prop){
  const scale = prop.scale ?? 1;
  const direction = Math.sign(prop.direction ?? 1) || 1;
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.rotation || 0);

  ctx.fillStyle = 'rgba(26, 18, 12, 0.68)';
  ctx.beginPath();
  ctx.ellipse(0, 16 * scale, 20 * scale, 11 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#3b2a18';
  ctx.fillRect(-3 * scale, -28 * scale, 6 * scale, 44 * scale);

  ctx.fillStyle = '#b48a4a';
  ctx.beginPath();
  ctx.moveTo(0, -16 * scale);
  ctx.lineTo(direction * 38 * scale, -22 * scale);
  ctx.lineTo(direction * 38 * scale, -6 * scale);
  ctx.lineTo(0, -2 * scale);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(40, 26, 12, 0.6)';
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(34, 22, 12, 0.55)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.moveTo(direction * 8 * scale, -13 * scale);
  ctx.lineTo(direction * 24 * scale, -11 * scale);
  ctx.moveTo(direction * 8 * scale, -8 * scale);
  ctx.lineTo(direction * 22 * scale, -6 * scale);
  ctx.stroke();

  ctx.fillStyle = '#c6a25a';
  ctx.fillRect(-4 * scale, -30 * scale, 8 * scale, 4 * scale);

  ctx.restore();
}

function drawFungusCircleProp(prop){
  const scale = prop.scale ?? 1;
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.rotation || 0);

  ctx.fillStyle = 'rgba(18, 28, 24, 0.75)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 56 * scale, 34 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(110, 200, 150, 0.12)';
  ctx.beginPath();
  ctx.arc(0, 0, 44 * scale, 0, TAU);
  ctx.fill();

  const mushrooms = [
    { x: -28, y: 6, size: 1.1, cap: '#d96b7f' },
    { x: -4, y: -4, size: 0.9, cap: '#f47c5e' },
    { x: 18, y: 2, size: 1.05, cap: '#d96bee' },
    { x: 34, y: -6, size: 0.82, cap: '#8ad4a5' },
    { x: -16, y: 14, size: 0.8, cap: '#d95f6b' }
  ];

  for (const mush of mushrooms){
    ctx.save();
    ctx.translate(mush.x * scale, mush.y * scale);
    const s = mush.size * scale;
    ctx.fillStyle = '#ddd2c0';
    ctx.beginPath();
    ctx.moveTo(-2 * s, 8 * s);
    ctx.lineTo(2 * s, 8 * s);
    ctx.lineTo(1.4 * s, -2 * s);
    ctx.quadraticCurveTo(0.4 * s, -6 * s, 0, -12 * s);
    ctx.quadraticCurveTo(-0.4 * s, -6 * s, -1.6 * s, -2 * s);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = mush.cap;
    ctx.beginPath();
    ctx.ellipse(0, -9 * s, 8 * s, 5.6 * s, 0, 0, TAU);
    ctx.fill();

    ctx.fillStyle = 'rgba(250, 240, 240, 0.7)';
    ctx.beginPath();
    ctx.arc(-3 * s, -10 * s, 1.3 * s, 0, TAU);
    ctx.arc(2.2 * s, -8.6 * s, 1 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(140, 220, 170, 0.16)';
  ctx.beginPath();
  ctx.arc(6 * scale, -6 * scale, 10 * scale, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(160, 240, 200, 0.14)';
  ctx.beginPath();
  ctx.arc(-14 * scale, 10 * scale, 8 * scale, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawRuinedObeliskProp(prop){
  const scale = prop.scale ?? 1;
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.rotate(prop.rotation || 0);

  ctx.fillStyle = 'rgba(22, 14, 22, 0.72)';
  ctx.beginPath();
  ctx.ellipse(0, 10 * scale, 38 * scale, 22 * scale, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#5e4e66';
  ctx.fillRect(-24 * scale, 6 * scale, 48 * scale, 10 * scale);

  ctx.save();
  ctx.translate(-4 * scale, -28 * scale);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#73627c';
  ctx.beginPath();
  ctx.moveTo(-8 * scale, 38 * scale);
  ctx.lineTo(8 * scale, 38 * scale);
  ctx.lineTo(14 * scale, -10 * scale);
  ctx.lineTo(2 * scale, -42 * scale);
  ctx.lineTo(-10 * scale, -12 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(24, 16, 28, 0.6)';
  ctx.lineWidth = 1.4 * scale;
  ctx.stroke();

  ctx.strokeStyle = 'rgba(14, 10, 18, 0.45)';
  ctx.lineWidth = 0.9 * scale;
  ctx.beginPath();
  ctx.moveTo(-2 * scale, -18 * scale);
  ctx.lineTo(4 * scale, 6 * scale);
  ctx.lineTo(-1 * scale, 18 * scale);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(22 * scale, -18 * scale);
  ctx.rotate(0.42);
  ctx.fillStyle = '#6a5b74';
  ctx.beginPath();
  ctx.moveTo(-10 * scale, 16 * scale);
  ctx.lineTo(10 * scale, 16 * scale);
  ctx.lineTo(8 * scale, -4 * scale);
  ctx.lineTo(-6 * scale, -10 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(22, 14, 22, 0.55)';
  ctx.lineWidth = 1.2 * scale;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = 'rgba(170, 140, 200, 0.14)';
  ctx.beginPath();
  ctx.arc(0, -18 * scale, 12 * scale, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function gatherForestSolidsAround(x, y, radius=280){
  const results = [];
  const r2 = radius*radius;
  for (const tile of forestSolids){
    const cx = tile.x + tile.w/2, cy = tile.y + tile.h/2;
    const dx = cx - x, dy = cy - y;
    if (dx*dx + dy*dy <= r2) results.push(tile);
  }
  return results;
}

function drawTerrain(options = {}){
  const { includeTrees = true, treeFilter = null } = options;
  const view = { x: state.camera.x - 120, y: state.camera.y - 120, w: W + 240, h: H + 240 };
  const drawingOnlyTrees = treeFilter !== null;

  if (!drawingOnlyTrees){
    ctx.fillStyle = '#0d131b';
    ctx.fillRect(view.x, view.y, view.w, view.h);

    for (const zone of terrainZones){
      const bounds = {
        x: zone.x - 48,
        y: zone.y - 48,
        w: zone.w + 96,
        h: zone.h + 96
      };
      if (!rectsOverlap(bounds, view)) continue;
      drawZone(zone);
    }
  }

  if (includeTrees || drawingOnlyTrees){
    for (const tree of forestSolids){
      const bounds = {
        x: tree.cx - tree.canopyRadius - 14,
        y: tree.cy - tree.canopyRadius - 14,
        w: tree.canopyRadius * 2 + 28,
        h: tree.canopyRadius * 2 + 28
      };
      if (!rectsOverlap(bounds, view)) continue;
      if (!drawingOnlyTrees && !includeTrees) continue;
      if (treeFilter && !treeFilter(tree)) continue;
      drawTree(tree);
    }
  }

  if (drawingOnlyTrees) return;

  ctx.strokeStyle = '#3a2a1c';
  ctx.lineCap = 'round';
  for (const seg of pathSegments){
    const minX = Math.min(seg.a.x, seg.b.x) - seg.width;
    const minY = Math.min(seg.a.y, seg.b.y) - seg.width;
    const bounds = {
      x: minX,
      y: minY,
      w: Math.abs(seg.a.x - seg.b.x) + seg.width * 2,
      h: Math.abs(seg.a.y - seg.b.y) + seg.width * 2
    };
    if (!rectsOverlap(bounds, view)) continue;
    ctx.lineWidth = seg.width;
    ctx.beginPath();
    ctx.moveTo(seg.a.x, seg.a.y);
    ctx.lineTo(seg.b.x, seg.b.y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';

  ctx.fillStyle = '#1a2536';
  for (const road of roads){
    if (!rectsOverlap(road, view)) continue;
    ctx.fillRect(road.x, road.y, road.w, road.h);
  }

  for (const prop of terrainProps){
    const r = prop.clearRadius ?? prop.radius ?? defaultPropRadius(prop.type);
    const bounds = { x: prop.x - r, y: prop.y - r, w: r * 2, h: r * 2 };
    if (!rectsOverlap(bounds, view)) continue;
    drawTerrainProp(prop);
  }
}

function drawTree(tree){
  const { cx, cy, canopyRadius, trunkWidth, trunkHeight } = tree;
  const canopyOffset = tree.canopyOffset || 0;
  const shadowRadius = tree.shadowRadius || canopyRadius * 0.8;
  const shadowAlpha = tree.shadowAlpha || 0.18;
  const baseY = cy + tree.h/2;

  ctx.save();

  if (shadowRadius > 0){
    ctx.fillStyle = `rgba(6, 12, 9, ${shadowAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(cx + canopyRadius * 0.16, baseY - tree.h * 0.18, shadowRadius, shadowRadius * 0.45, -0.25, 0, TAU);
    ctx.fill();
  }

  const trunkX = cx - trunkWidth/2;
  const trunkY = baseY - trunkHeight;
  ctx.fillStyle = '#4c2f1b';
  ctx.fillRect(trunkX, trunkY, trunkWidth, trunkHeight);
  ctx.strokeStyle = '#2e1a10';
  ctx.lineWidth = 1;
  ctx.strokeRect(trunkX + 0.5, trunkY + 0.5, trunkWidth - 1, trunkHeight - 1);

  const canopyY = trunkY - canopyRadius * 0.2 + canopyOffset;
  const gradient = ctx.createRadialGradient(cx, canopyY - canopyRadius * 0.45, canopyRadius * 0.25, cx, canopyY, canopyRadius);
  gradient.addColorStop(0, '#2e5a36');
  gradient.addColorStop(0.55, '#22402a');
  gradient.addColorStop(1, '#111d13');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, canopyY, canopyRadius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(12, 26, 16, 0.55)';
  ctx.stroke();

  ctx.fillStyle = 'rgba(120, 200, 150, 0.12)';
  ctx.beginPath();
  ctx.arc(cx - canopyRadius * 0.28, canopyY - canopyRadius * 0.38, canopyRadius * 0.55, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawGoblinTavern(){
  const tavern = state.tavern;
  if (!tavern) return;
  const stumpRadius = tavern.stump?.radius ?? 46;
  const cx = tavern.stump?.cx ?? (tavern.x + tavern.w/2);
  const cy = tavern.stump?.cy ?? (tavern.y + tavern.h/2);
  const glowR = Math.max(stumpRadius, tavern.glowRadius ?? stumpRadius);
  const view = { x: state.camera.x, y: state.camera.y, w: W, h: H };
  const area = { x: cx - glowR, y: cy - glowR, w: glowR * 2, h: glowR * 2 };
  if (!rectsOverlap(area, view)) return;

  const radius = stumpRadius;
  const flicker = 0.72 + Math.sin(state.time * 5.2) * 0.05 + Math.sin(state.time * 2.1) * 0.04;

  ctx.save();

  const halo = ctx.createRadialGradient(cx, cy + 12, 12, cx, cy + 12, glowR);
  halo.addColorStop(0, `rgba(120, 255, 180, ${(0.26 * flicker).toFixed(3)})`);
  halo.addColorStop(0.45, `rgba(70, 200, 140, ${(0.18 * flicker).toFixed(3)})`);
  halo.addColorStop(1, 'rgba(5, 12, 8, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy + 12, glowR, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(34, 52, 26, 0.6)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, glowR * 0.7, glowR * 0.5, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(72, 56, 30, 0.7)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + glowR * 0.42, glowR * 0.36, glowR * 0.18, 0, 0, TAU);
  ctx.fill();

  const doorBeam = ctx.createRadialGradient(cx, cy + 10, 2, cx, cy + 10, glowR * 0.85);
  doorBeam.addColorStop(0, `rgba(255, 214, 120, ${(0.68 * flicker).toFixed(3)})`);
  doorBeam.addColorStop(0.45, `rgba(210, 150, 90, ${(0.22 * flicker).toFixed(3)})`);
  doorBeam.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = doorBeam;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy + 6);
  ctx.quadraticCurveTo(cx, cy + glowR * 0.45, cx + 12, cy + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#3f2b19';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, radius * 1.08, radius * 0.82, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#21140c';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#5d3b22';
  ctx.beginPath();
  ctx.ellipse(cx, cy - radius * 0.28, radius * 0.9, radius * 0.54, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2f1b0f';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const doorRect = getTavernDoorRect(tavern);
  const doorW = doorRect?.w ?? radius * 0.55;
  const doorH = doorRect?.h ?? radius * 0.9;
  const doorX = doorRect?.x ?? (cx - doorW / 2);
  const doorY = doorRect?.y ?? (cy - doorH / 2 + 8);
  ctx.fillStyle = '#090d08';
  ctx.fillRect(doorX, doorY, doorW, doorH);
  ctx.fillStyle = `rgba(220, 190, 110, ${(0.58 * flicker).toFixed(3)})`;
  ctx.fillRect(doorX + 4, doorY + doorH - 10, doorW - 8, 6);

  for (let i = 0; i < 5; i++){
    const angle = state.time * 0.5 + i * (TAU / 5);
    const mx = cx + Math.cos(angle) * radius * 1.45;
    const my = cy + Math.sin(angle) * radius * 1.18;
    const shroom = ctx.createRadialGradient(mx, my, 2, mx, my, 14);
    shroom.addColorStop(0, 'rgba(160, 255, 200, 0.8)');
    shroom.addColorStop(1, 'rgba(10, 20, 12, 0)');
    ctx.fillStyle = shroom;
    ctx.beginPath();
    ctx.arc(mx, my, 14, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6be3a5';
    ctx.beginPath();
    ctx.arc(mx, my, 4, 0, TAU);
    ctx.fill();
  }

  ctx.lineWidth = 1;
  ctx.restore();
}

export {
  roads,
  forestSolids,
  pathSegments,
  addRoad,
  generateWorld,
  gatherForestSolidsAround,
  drawTerrain,
  drawTree,
  drawGoblinTavern
};
