import {
  DEFAULT_HOUSE_JITTER,
  HOUSE_MIN_SPACING,
  VILLAGE_MARGIN,
  VILLAGE_ROAD_BUFFER
} from '../data/houses.js';
import { VILLAGES, WALL } from '../data/world.js';
import { clamp, lerp, randRange } from '../utils/math.js';
import { state } from '../state/gameState.js';
import { gatherForestSolidsAround } from './terrain.js';
import { TAVERN_SOLIDS } from '../state/tavern.js';
import { ctx } from '../game/canvas.js';
import { getVillageInstance } from './villageTemplates.js';

function addHouseWithDoor(x, y, w, h, side, doorOffset=0.5, doorW=22, villageId=0){
  const doorX = x + Math.round((w - doorW) * clamp(doorOffset, 0.05, 0.95));
  const doorY = side === 'north' ? (y + h - WALL) : y;
  const house = { x, y, w, h, side, villageId, door: { x: doorX, y: doorY, w: doorW, h: WALL }, hasUpstairs: false };
  state.houses.push(house);
}

function rebuildHouseSolids(){
  state.houseSolids = [];
  for (const h of state.houses){
    state.houseSolids.push({ x: h.x, y: h.y, w: WALL, h: h.h });
    state.houseSolids.push({ x: h.x + h.w - WALL, y: h.y, w: WALL, h: h.h });
    if (h.side === 'south'){
      const leftW = Math.max(0, (h.door.x - h.x));
      const rightX = h.door.x + h.door.w;
      const rightW = Math.max(0, (h.x + h.w - rightX));
      if (leftW > 0) state.houseSolids.push({ x: h.x, y: h.y, w: leftW, h: WALL });
      if (rightW > 0) state.houseSolids.push({ x: rightX, y: h.y, w: rightW, h: WALL });
      state.houseSolids.push({ x: h.x, y: h.y + h.h - WALL, w: h.w, h: WALL });
    } else {
      state.houseSolids.push({ x: h.x, y: h.y, w: h.w, h: WALL });
      const leftW = Math.max(0, (h.door.x - h.x));
      const rightX = h.door.x + h.door.w;
      const rightW = Math.max(0, (h.x + h.w - rightX));
      if (leftW > 0) state.houseSolids.push({ x: h.x, y: h.y + h.h - WALL, w: leftW, h: WALL });
      if (rightW > 0) state.houseSolids.push({ x: rightX, y: h.y + h.h - WALL, w: rightW, h: WALL });
    }
  }
}

function isInsideHouseInterior(h, px, py){
  return px > h.x + WALL && px < h.x + h.w - WALL && py > h.y + WALL && py < h.y + h.h - WALL;
}

function randomInHouseInterior(h, margin=14){
  const minX = h.x + WALL + margin;
  const maxX = h.x + h.w - WALL - margin;
  const minY = h.y + WALL + margin;
  const maxY = h.y + h.h - WALL - margin;
  const x = Math.round(lerp(minX, maxX, Math.random()));
  const y = Math.round(lerp(minY, maxY, Math.random()));
  return {x,y};
}

function makeEdgeStairRects(h, edge, steps=5){
  const treads = [];
  const treadW = 18, treadH = 8, gap = 2;
  const innerLeft = h.x + WALL, innerRight = h.x + h.w - WALL;
  const innerTop = h.y + WALL, innerBot = h.y + h.h - WALL;
  let x, y0;
  if (edge === 'left'){
    x = innerLeft + 6;
    const totalH = steps*(treadH+gap) - gap;
    y0 = Math.round((innerTop+innerBot - totalH)/2);
    for (let i=0;i<steps;i++) treads.push({x, y:y0 + i*(treadH+gap), w:treadW, h:treadH});
  } else if (edge === 'right'){
    x = innerRight - 6 - treadW;
    const totalH = steps*(treadH+gap) - gap;
    y0 = Math.round((innerTop+innerBot - totalH)/2);
    for (let i=0;i<steps;i++) treads.push({x, y:y0 + i*(treadH+gap), w:treadW, h:treadH});
  } else if (edge === 'top'){
    const totalW = steps*(treadW+gap) - gap;
    const x0 = Math.round((innerLeft+innerRight - totalW)/2);
    const y = innerTop + 6;
    for (let i=0;i<steps;i++) treads.push({x:x0 + i*(treadW+gap), y, w:treadW, h:treadH});
  } else {
    const totalW = steps*(treadW+gap) - gap;
    const x0 = Math.round((innerLeft+innerRight - totalW)/2);
    const y = innerBot - 6 - treadH;
    for (let i=0;i<steps;i++) treads.push({x:x0 + i*(treadW+gap), y, w:treadW, h:treadH});
  }
  const minX = Math.min(...treads.map(r=>r.x)), minY = Math.min(...treads.map(r=>r.y));
  const maxX = Math.max(...treads.map(r=>r.x+r.w)), maxY = Math.max(...treads.map(r=>r.y+r.h));
  return { treads, bbox:{ x:minX, y:minY, w:maxX-minX, h:maxY-minY } };
}

function createEdgeStairs(h, houseId){
  const candidates = ['left','right'];
  const edge = candidates[Math.floor(Math.random()*candidates.length)];
  const {treads, bbox} = makeEdgeStairRects(h, edge, 6);
  const up =   { houseId, level:0, x:bbox.x, y:bbox.y, w:bbox.w, h:bbox.h, targetLevel:1, treads };
  const down = { houseId, level:1, x:bbox.x, y:bbox.y, w:bbox.w, h:bbox.h, targetLevel:0, treads };
  return {up, down};
}

function getActiveSolids(anchor = state.player){
  if (state.tavernInteriorState.active){
    return TAVERN_SOLIDS.slice();
  }
  const solids = state.houseSolids.slice();
  if (state.interior && state.interior.level === 1){
    const h = state.houses[state.interior.houseId];
    const doorBlock = { x: h.door.x, y: h.side === 'north' ? (h.y + h.h - WALL) : h.y, w: h.door.w, h: WALL };
    solids.push(doorBlock);
  }
  if (!state.interior && anchor){
    solids.push(...gatherForestSolidsAround(anchor.x, anchor.y, 360));
  }
  return solids;
}

function getRenderableStairs(){
  if (!state.interior) return [];
  return state.stairs.filter(s => s.houseId === state.interior.houseId && s.level === state.interior.level);
}

const SECOND_FLOOR_BROWN = '#6b4a2f';
function interiorFloorColor(level){ return level===1 ? SECOND_FLOOR_BROWN : null; }
function fillHouseInterior(h, color){
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(h.x + WALL, h.y + WALL, h.w - 2*WALL, h.h - 2*WALL);
}

function clampToVillageBounds(village, spec, position){
  const { side } = spec;
  const roadCenterY = village.y + village.h / 2;
  const minX = village.x + VILLAGE_MARGIN;
  const maxX = village.x + village.w - spec.w - VILLAGE_MARGIN;
  let x = clamp(position.x, minX, maxX);

  let minY, maxY;
  if (side === 'north'){
    minY = village.y + VILLAGE_MARGIN;
    maxY = roadCenterY - VILLAGE_ROAD_BUFFER - spec.h;
  } else {
    minY = roadCenterY + VILLAGE_ROAD_BUFFER;
    maxY = village.y + village.h - spec.h - VILLAGE_MARGIN;
  }
  if (maxY < minY){
    const mid = (minY + maxY) / 2;
    minY = maxY = mid;
  }
  let y = clamp(position.y, minY, maxY);

  return { x, y };
}

function placeVillageHouse(village, spec){
  const jitter = spec.jitter || DEFAULT_HOUSE_JITTER[spec.side] || { x: 0, y: 0, door: 0 };
  const jittered = {
    x: village.x + spec.x + (jitter.x ? randRange(-jitter.x, jitter.x) : 0),
    y: village.y + spec.y + (jitter.y ? randRange(-jitter.y, jitter.y) : 0)
  };
  const { x, y } = clampToVillageBounds(village, spec, jittered);
  const doorOffset = clamp(
    spec.doorOffset + (jitter.door ? randRange(-jitter.door, jitter.door) : 0),
    0.1,
    0.9
  );
  return { x, y, doorOffset };
}

function resolveSideHouseCollisions(village, entries){
  if (entries.length <= 1) return;

  entries.sort((a, b) => a.placement.x - b.placement.x);
  const leftBound = village.x + VILLAGE_MARGIN;
  const rightBound = village.x + village.w - VILLAGE_MARGIN;

  const clampEntry = (entry) => {
    const maxLeft = rightBound - entry.spec.w;
    entry.placement.x = clamp(entry.placement.x, leftBound, maxLeft);
  };

  for (let iter = 0; iter < 8; iter++){
    let changed = false;

    for (const entry of entries){
      const before = entry.placement.x;
      clampEntry(entry);
      if (entry.placement.x !== before) changed = true;
    }

    for (let i = 1; i < entries.length; i++){
      const prev = entries[i - 1];
      const curr = entries[i];
      const minX = prev.placement.x + prev.spec.w + HOUSE_MIN_SPACING;
      if (curr.placement.x < minX){
        const maxLeft = rightBound - curr.spec.w;
        const nextX = Math.min(minX, maxLeft);
        if (nextX !== curr.placement.x){
          curr.placement.x = nextX;
          changed = true;
        }
      }
    }

    for (let i = entries.length - 2; i >= 0; i--){
      const next = entries[i + 1];
      const curr = entries[i];
      const maxX = next.placement.x - curr.spec.w - HOUSE_MIN_SPACING;
      if (curr.placement.x > maxX){
        const nextX = Math.max(maxX, leftBound);
        if (nextX !== curr.placement.x){
          curr.placement.x = nextX;
          changed = true;
        }
      }
    }

    if (!changed) break;
  }

  let collision = false;
  for (let i = 1; i < entries.length; i++){
    const prev = entries[i - 1];
    const curr = entries[i];
    if (curr.placement.x < prev.placement.x + prev.spec.w + HOUSE_MIN_SPACING - 0.5){
      collision = true;
      break;
    }
  }

  if (collision){
    const available = rightBound - leftBound;
    const widths = entries.reduce((sum, entry) => sum + entry.spec.w, 0);
    const totalSpacing = HOUSE_MIN_SPACING * (entries.length - 1);
    const slack = Math.max(0, available - (widths + totalSpacing));
    let x = leftBound + slack / 2;
    for (const entry of entries){
      entry.placement.x = x;
      x += entry.spec.w + HOUSE_MIN_SPACING;
    }
  }

  entries.sort((a, b) => a.placement.x - b.placement.x);
}

function initHouses(){
  state.houses = [];
  state.doors = [];
  state.houseSolids = [];
  state.chests = [];
  state.stairs = [];
  VILLAGES.forEach((village, vIndex) => {
    const instance = getVillageInstance(vIndex);
    const housesBySide = { north: [], south: [] };
    const layout = instance?.houses?.length ? instance.houses : [];

    for (const spec of layout){
      if (!housesBySide[spec.side]) continue;
      const placement = placeVillageHouse(village, spec);
      housesBySide[spec.side].push({ spec, placement });
    }

    const placed = [];
    for (const side of ['north', 'south']){
      if (!housesBySide[side].length) continue;
      resolveSideHouseCollisions(village, housesBySide[side]);
      housesBySide[side].forEach(({ spec, placement }) => {
        addHouseWithDoor(
          placement.x,
          placement.y,
          spec.w,
          spec.h,
          spec.side,
          placement.doorOffset,
          22,
          vIndex
        );
        placed.push({ spec, placement });
      });
    }

    instance.placedHouses = placed;
  });

  rebuildHouseSolids();
  state.doors = state.houses.map(h => ({ x: h.door.x, y: h.door.y, w: h.door.w, h: h.door.h, side: h.side }));

  state.houses.forEach((h, i) => {
    const p = randomInHouseInterior(h, 16);
    state.chests.push({ x:p.x, y:p.y, w:18, h:12, amount: 40 + Math.floor(Math.random()*60), looted:false, houseId:i, level:0 });

    h.hasUpstairs = true;
    const {up, down} = createEdgeStairs(h, i);
    state.stairs.push(up, down);
  });
}

export {
  addHouseWithDoor,
  rebuildHouseSolids,
  isInsideHouseInterior,
  randomInHouseInterior,
  makeEdgeStairRects,
  createEdgeStairs,
  getActiveSolids,
  getRenderableStairs,
  interiorFloorColor,
  fillHouseInterior,
  clampToVillageBounds,
  placeVillageHouse,
  resolveSideHouseCollisions,
  initHouses,
  SECOND_FLOOR_BROWN
};
