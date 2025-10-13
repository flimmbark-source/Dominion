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
import { TAU, clamp, lerp, randRange } from '../utils/math.js';
import { state } from '../state/gameState.js';
import { ctx, W, H } from '../game/canvas.js';

const roads = [];
let forestSolids = [];
const pathSegments = [];

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
    const r2 = clearR * clearR;
    forestSolids = forestSolids.filter(tile => {
      const dx = tile.cx - cx;
      const dy = tile.cy - cy;
      return (dx*dx + dy*dy) > r2;
    });
  }
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

function drawTerrain(){
  const view = { x: state.camera.x - 120, y: state.camera.y - 120, w: W + 240, h: H + 240 };

  for (const tree of forestSolids){
    const bounds = {
      x: tree.cx - tree.canopyRadius - 14,
      y: tree.cy - tree.canopyRadius - 14,
      w: tree.canopyRadius * 2 + 28,
      h: tree.canopyRadius * 2 + 28
    };
    if (!rectsOverlap(bounds, view)) continue;
    drawTree(tree);
  }

  ctx.strokeStyle = '#3a2a1c';
  ctx.lineCap = 'round';
  for (const seg of pathSegments){
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

  const doorW = radius * 0.55;
  const doorH = radius * 0.9;
  const doorX = cx - doorW / 2;
  const doorY = cy - doorH / 2 + 8;
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
