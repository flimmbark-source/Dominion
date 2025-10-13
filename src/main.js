import './style.css';

// Single-file canvas game. ASCII-only strings/comments to avoid parser surprises in injected environments.

/** ---------- Math/Utils ---------- */
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp  = (a,b,t) => a + (b-a)*t;
const dist2 = (a,b) => (a.x-b.x)**2+(a.y-b.y)**2;
const lineIntersectsRect = (x1,y1,x2,y2, rx,ry,rw,rh) => {
  // Liang-Barsky segment vs AABB
  let p = [-(x2-x1), (x2-x1), -(y2-y1), (y2-y1)];
  let q = [x1 - rx, rx+rw - x1, y1 - ry, ry+rh - y1];
  let u1 = 0, u2 = 1;
  for (let i=0;i<4;i++){
    if (p[i] === 0) { if (q[i] < 0) return false; }
    else {
      let t = q[i] / p[i];
      if (p[i] < 0) { if (t > u2) return false; if (t > u1) u1 = t; }
      else { if (t < u1) return false; if (t < u2) u2 = t; }
    }
  }
  return true;
};
const segBlockedByAnyRect = (x1,y1,x2,y2, rects) => rects.some(r => lineIntersectsRect(x1,y1,x2,y2, r.x, r.y, r.w, r.h));

/** ---------- Input ---------- */
const keys = new Set();
window.addEventListener('keydown', e => { keys.add(e.key.toLowerCase()); });
window.addEventListener('keyup',   e => { keys.delete(e.key.toLowerCase()); });

/** ---------- Game State ---------- */
const ctx = document.getElementById('game').getContext('2d');
const W = ctx.canvas.width, H = ctx.canvas.height;

const WORLD = { W: 8000, H: 8000 };
const VILLAGES = [
  { name:'Moonfen',   x: 3600, y: 3400, w: 960, h: 600 },
  { name:'Brackenreach', x: 900,  y: 1200, w: 960, h: 600 },
  { name:'Duskhaven', x: 5900, y: 1200, w: 960, h: 600 },
  { name:'Miregate',  x: 980,  y: 5900, w: 960, h: 600 },
  { name:'Thornfall', x: 5840, y: 5840, w: 960, h: 600 }
];
const mainVillage = VILLAGES[0];
const pathSegments = [];
const PATH_WIDTH_MAIN = 48;
const PATH_WIDTH_RING = 38;
const PATH_CLEAR_RADIUS = 44;

const TREE_MIN_SPACING = 56;
const TREE_MAX_SPACING = 118;
const TREE_CLEARING_CHANCE = 0.18;
const TREE_CANOPY_MIN = 26;
const TREE_CANOPY_MAX = 42;

function randRange(min, max){ return min + Math.random() * (max - min); }
function treePathNoise(x, y){
  return Math.sin(x * 0.0026) + Math.sin(y * 0.0031) - Math.cos((x + y) * 0.0017);
}

const state = {
  time: 0,
  pausedForShop: false,
  debugCones: true, // show sight cones by default (toggle with F)
  message: '',
  messageUntil: 0,
  camera: { x: mainVillage.x + mainVillage.w/2 - W/2, y: mainVillage.y + mainVillage.h/2 - H/2 },
  player: {
    x: mainVillage.x + 180, y: mainVillage.y + 460, r: 10, facing: 0,
    vx: 0, vy: 0, sprinting: false,
    gold: 0, health: 100,
    detection: 0,
    invisUntil: 0,
    stats: { speed: 120, attack: 10, stealthMult: 1.0 },
    inventory: Array(6).fill(null)
  },
  houses: [],
  doors: [],
  houseSolids: [],
  chests: [],
  tavern: { x: mainVillage.x + 60, y: mainVillage.y + mainVillage.h - 160, w: 170, h: 120 },
  npcs: [],
  castle: { x: WORLD.W - 320, y: 360 },
  threat: 0, // meter still used to spawn scouts but no HUD text
  threatSpawns: [50, 100],
  spawnCount: 0,
  interior: null, // { houseId, level } or null when outside
  stairs: [], // {houseId, level, x,y,w,h, targetLevel, treads?}
  lastSeen: false
};

/** ---------- World Setup ---------- */
const WALL = 8;

// ----- Large world + terrain (forests and roads) -----
const roads = [];
let forestSolids = [];

function addRoad(x,y,w,h){ roads.push({x,y,w,h}); }
function pointInRect(px,py, r){ return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }
function rectsOverlap(a,b){ return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y); }
function distToSegment(px,py, ax,ay,bx,by){
  const vx = bx-ax, vy = by-ay; const wx = px-ax, wy = py-ay;
  const c1 = vx*wx + vy*wy; const c2 = vx*vx + vy*vy; const t = c2 ? clamp(c1/c2,0,1):0;
  const dx = ax + t*vx - px, dy = ay + t*vy - py; return Math.hypot(dx,dy);
}
function centerOf(rect){ return { x: rect.x + rect.w/2, y: rect.y + rect.h/2 }; }

function generateWorld(){
  roads.length = 0; forestSolids = []; pathSegments.length = 0;

  // Lay out village main roads
  for (const village of VILLAGES){
    addRoad(village.x, village.y + village.h - 180, village.w, 180);
    addRoad(village.x + 160, village.y + village.h/2 - 20, village.w - 320, 40);
  }

  // Build dirt paths between the major settlements
  const heart = centerOf(mainVillage);
  for (let i=1;i<VILLAGES.length;i++){
    const other = centerOf(VILLAGES[i]);
    const dir = { x: other.x - heart.x, y: other.y - heart.y };
    const dist = Math.hypot(dir.x, dir.y) || 1;
    const nx = -dir.y / dist;
    const ny = dir.x / dist;
    const bend = (i % 2 === 0) ? 1 : -1;
    const first = {
      x: heart.x + dir.x * 0.33 + nx * 220 * bend,
      y: heart.y + dir.y * 0.33 + ny * 220 * bend
    };
    const second = {
      x: heart.x + dir.x * 0.66 - nx * 180 * bend,
      y: heart.y + dir.y * 0.66 - ny * 180 * bend
    };
    const segments = [heart, first, second, other];
    for (let s=0;s<segments.length-1;s++){
      const a = segments[s], b = segments[s+1];
      pathSegments.push({ a, b, width: PATH_WIDTH_MAIN });
    }
  }

  // Add a ring path linking the frontier villages
  const frontier = VILLAGES.slice(1);
  for (let i=0;i<frontier.length;i++){
    const a = centerOf(frontier[i]);
    const b = centerOf(frontier[(i+1)%frontier.length]);
    pathSegments.push({ a, b, width: PATH_WIDTH_RING });
  }

  // Populate forests everywhere that is not a road, village, or path corridor
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
}
function addHouseWithDoor(x, y, w, h, side /* 'north' | 'south' */, doorOffset=0.5, doorW=22, villageId=0){
  const doorX = x + Math.round((w - doorW) * clamp(doorOffset, 0.05, 0.95));
  const doorY = side === 'north' ? (y + h - WALL) : y;
  const house = { x, y, w, h, side, villageId, door: { x: doorX, y: doorY, w: doorW, h: WALL }, hasUpstairs: false };
  state.houses.push(house);
}

function rebuildHouseSolids(){
  state.houseSolids = [];
  for (const h of state.houses){
    // Side walls
    state.houseSolids.push({ x: h.x, y: h.y, w: WALL, h: h.h });
    state.houseSolids.push({ x: h.x + h.w - WALL, y: h.y, w: WALL, h: h.h });
    // Top/bottom walls with doorway gap on street-facing side
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

// Build a set of small rectangles hugging one interior edge to depict stairs.
function makeEdgeStairRects(h, edge, steps=5){
  const treads = [];
  const treadW = 18, treadH = 8, gap = 2;
  const innerLeft = h.x + WALL, innerRight = h.x + h.w - WALL;
  const innerTop = h.y + WALL, innerBot = h.y + h.h - WALL;
  let x, y0;
  if (edge === 'left'){
    x = innerLeft + 6; // hug left wall
    const totalH = steps*(treadH+gap) - gap;
    y0 = Math.round((innerTop+innerBot - totalH)/2);
    for (let i=0;i<steps;i++) treads.push({x, y:y0 + i*(treadH+gap), w:treadW, h:treadH});
  } else if (edge === 'right'){
    x = innerRight - 6 - treadW; // hug right wall
    const totalH = steps*(treadH+gap) - gap;
    y0 = Math.round((innerTop+innerBot - totalH)/2);
    for (let i=0;i<steps;i++) treads.push({x, y:y0 + i*(treadH+gap), w:treadW, h:treadH});
  } else if (edge === 'top'){
    // horizontal run along top wall
    const totalW = steps*(treadW+gap) - gap;
    const x0 = Math.round((innerLeft+innerRight - totalW)/2);
    const y = innerTop + 6;
    for (let i=0;i<steps;i++) treads.push({x:x0 + i*(treadW+gap), y, w:treadW, h:treadH});
  } else { // 'bottom'
    const totalW = steps*(treadW+gap) - gap;
    const x0 = Math.round((innerLeft+innerRight - totalW)/2);
    const y = innerBot - 6 - treadH;
    for (let i=0;i<steps;i++) treads.push({x:x0 + i*(treadW+gap), y, w:treadW, h:treadH});
  }
  // Bounding box for interaction
  const minX = Math.min(...treads.map(r=>r.x)), minY = Math.min(...treads.map(r=>r.y));
  const maxX = Math.max(...treads.map(r=>r.x+r.w)), maxY = Math.max(...treads.map(r=>r.y+r.h));
  return { treads, bbox:{ x:minX, y:minY, w:maxX-minX, h:maxY-minY } };
}

function createEdgeStairs(h, houseId){
  // Prefer left/right edges to avoid door lines; fallback to top/bottom.
  const candidates = ['left','right'];
  const edge = candidates[Math.floor(Math.random()*candidates.length)];
  const {treads, bbox} = makeEdgeStairRects(h, edge, 6);
  const up =   { houseId, level:0, x:bbox.x, y:bbox.y, w:bbox.w, h:bbox.h, targetLevel:1, treads };
  const down = { houseId, level:1, x:bbox.x, y:bbox.y, w:bbox.w, h:bbox.h, targetLevel:0, treads };
  return {up, down};
}
function gatherForestSolidsAround(x,y,radius=280){
  const results = [];
  const r2 = radius*radius;
  for (const tile of forestSolids){
    const cx = tile.x + tile.w/2, cy = tile.y + tile.h/2;
    const dx = cx - x, dy = cy - y;
    if (dx*dx + dy*dy <= r2) results.push(tile);
  }
  return results;
}

function getActiveSolids(anchor = state.player){
  const solids = state.houseSolids.slice();
  // When upstairs, block the doorway so you can't exit to street
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

// Which stairs should be visible in the current frame
function getRenderableStairs(){
  if (!state.interior) return [];
  return state.stairs.filter(s => s.houseId === state.interior.houseId && s.level === state.interior.level);
}

// Interior floor coloring
const SECOND_FLOOR_BROWN = '#6b4a2f';
function interiorFloorColor(level){ return level===1 ? SECOND_FLOOR_BROWN : null; }
function fillHouseInterior(h, color){
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(h.x + WALL, h.y + WALL, h.w - 2*WALL, h.h - 2*WALL);
}

const BASE_HOUSE_LAYOUT = [
  { x:120, y:120, w:140, h:90, side:'north', doorOffset:0.50 },
  { x:320, y:100, w:160, h:110, side:'north', doorOffset:0.30 },
  { x:540, y:110, w:150, h:100, side:'north', doorOffset:0.70 },
  { x:160, y:320, w:150, h:110, side:'south', doorOffset:0.40 },
  { x:380, y:340, w:160, h:110, side:'south', doorOffset:0.60 },
  { x:620, y:330, w:170, h:120, side:'south', doorOffset:0.50 }
];

function initHouses(){
  state.houses = []; state.doors = []; state.houseSolids = []; state.chests = []; state.stairs = [];
  VILLAGES.forEach((village, vIndex) => {
    for (const spec of BASE_HOUSE_LAYOUT){
      addHouseWithDoor(village.x + spec.x, village.y + spec.y, spec.w, spec.h, spec.side, spec.doorOffset, 22, vIndex);
    }
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

  generateWorld();
}
initHouses();

// NPCs
function makeNPC(type, x,y, waypoints=null){
  const isScout = type === 'scout';
  return {
    type, x, y, facing: 0,
    speed: isScout? 62: 36,
    fovAngle: isScout? (Math.PI/3): (Math.PI/2),
    fovRange: isScout? 220: 120,
    waypoints: waypoints || [{x,y}], wpIndex: 0
  };
}
function offsetPoint(villageIndex, x, y){ const v = VILLAGES[villageIndex]; return { x: v.x + x, y: v.y + y }; }
function offsetWaypoints(villageIndex, pts){ return pts.map(pt => offsetPoint(villageIndex, pt.x, pt.y)); }
function addVillageNPC(type, villageIndex, x, y, localWaypoints){
  const origin = offsetPoint(villageIndex, x, y);
  const worldWaypoints = localWaypoints ? offsetWaypoints(villageIndex, localWaypoints) : null;
  state.npcs.push(makeNPC(type, origin.x, origin.y, worldWaypoints));
}

state.npcs = [];
// Central village population
addVillageNPC('villager', 0, 220, 520, [{x:220,y:520},{x:180,y:520},{x:220,y:520},{x:240,y:500}]);
addVillageNPC('villager', 0, 560, 450, [{x:560,y:450},{x:540,y:470},{x:560,y:450},{x:580,y:430}]);
addVillageNPC('scout',    0, 780, 480, [{x:780,y:480},{x:720,y:420},{x:660,y:480},{x:720,y:540}]);
addVillageNPC('scout',    0, 500, 200, [{x:500,y:200},{x:420,y:220},{x:360,y:240},{x:420,y:260},{x:500,y:240}]);

// Outlying villages: sleepy villagers and scouts keeping watch on forest paths
addVillageNPC('villager', 1, 300, 520, [{x:300,y:520},{x:340,y:560},{x:320,y:520}]);
addVillageNPC('villager', 2, 640, 520, [{x:640,y:520},{x:600,y:560},{x:660,y:540}]);
addVillageNPC('villager', 3, 420, 500, [{x:420,y:500},{x:460,y:540},{x:400,y:520}]);
addVillageNPC('villager', 4, 540, 520, [{x:540,y:520},{x:580,y:500},{x:520,y:500}]);

addVillageNPC('scout', 1, 700, 420, [{x:700,y:420},{x:620,y:420},{x:620,y:500},{x:700,y:500}]);
addVillageNPC('scout', 2, 760, 420, [{x:760,y:420},{x:680,y:420},{x:680,y:500},{x:760,y:500}]);
addVillageNPC('scout', 3, 760, 460, [{x:760,y:460},{x:700,y:420},{x:640,y:500},{x:700,y:540}]);
addVillageNPC('scout', 4, 720, 420, [{x:720,y:420},{x:640,y:420},{x:640,y:500},{x:720,y:500}]);
// Patrol pathing patcher
function patchPatrolRoutes(){
  for (const npc of state.npcs){
    if (npc.type !== 'scout') continue;
    if (!npc.waypoints || npc.waypoints.length < 3){
      const b = {x: npc.x, y: npc.y};
      npc.waypoints = [
        {x: b.x-40, y: b.y-20},
        {x: b.x+40, y: b.y-20},
        {x: b.x+40, y: b.y+20},
        {x: b.x-40, y: b.y+20}
      ];
      npc.wpIndex = 0;
    }
  }
}
patchPatrolRoutes();

/** ---------- Items / Shop ---------- */
const ITEMS = [
  { key:'1', name:'Boots of Speed',   price:100, type:'passive', apply:(p)=>{ p.stats.speed += 40; } },
  { key:'2', name:'Cloak of Shadows', price:150, type:'passive', apply:(p)=>{ p.stats.stealthMult *= 0.6; } },
  { key:'3', name:'Poison Dagger',    price:120, type:'passive', apply:(p)=>{ p.stats.attack += 10; } },
  { key:'4', name:'Invisibility Potion', price:80, type:'consumable', apply:(p)=>{} },
  { key:'5', name:'Moonleaf Draught', price:90, type:'consumable', apply:(p)=>{} }
];
function inventoryAdd(item){
  const idx = state.player.inventory.findIndex(x=>x===null);
  if (idx === -1) return false;
  state.player.inventory[idx] = {...item, stacks:1};
  return true;
}
function useInventorySlot(slotIdx){
  const it = state.player.inventory[slotIdx];
  if (!it) return;
  if (it.name === 'Invisibility Potion'){
    const now = state.time;
    if (now < state.player.invisUntil) return;
    state.player.invisUntil = now + 6; // strong but limited
    state.player.inventory[slotIdx] = null;
    toast('You fade from sight...');
  } else if (it.name === 'Moonleaf Draught'){
    state.player.health = clamp(state.player.health + 30, 0, 100);
    state.player.inventory[slotIdx] = null;
    toast('You feel restored (+30 HP).');
  }
}

/** ---------- Helpers ---------- */
function toast(msg, dur=2){ state.message = msg; state.messageUntil = state.time + dur; console.log(msg); }
function inRect(px,py, r){ return px>=r.x && px<=r.x+r.w && py>=r.y && py<=r.y+r.h; }
function circleRectCollideResolve(cx,cy,cr, r){
  const nx = clamp(cx, r.x, r.x+r.w), ny = clamp(cy, r.y, r.y+r.h);
  const dx = cx - nx, dy = cy - ny; const d2 = dx*dx + dy*dy;
  if (d2 > cr*cr) return {x:cx, y:cy};
  const d = Math.max(0.0001, Math.sqrt(d2));
  const ux = dx/d, uy = dy/d;
  const overlap = cr - d + 0.1;
  return { x: cx + ux*overlap, y: cy + uy*overlap };
}

/** ---------- FOV / Detection ---------- */
function npcSeesPlayer(npc, player){
  const dx = player.x - npc.x, dy = player.y - npc.y;
  const d = Math.hypot(dx,dy);
  if (d > npc.fovRange) return false;
  const ang = Math.atan2(dy,dx);
  let delta = ang - npc.facing; while (delta > Math.PI) delta -= TAU; while (delta < -Math.PI) delta += TAU;
  if (Math.abs(delta) > npc.fovAngle/2) return false;
  // LOS blocked by terrain?
  const midx = (npc.x + player.x) / 2, midy = (npc.y + player.y) / 2;
  const losRadius = Math.hypot(player.x - npc.x, player.y - npc.y) / 2 + 200;
  const blockers = state.interior ? state.houseSolids : state.houseSolids.concat(gatherForestSolidsAround(midx, midy, losRadius));
  if (segBlockedByAnyRect(npc.x, npc.y, player.x, player.y, blockers)) return false;
  // Invisible?
  if (state.time < player.invisUntil) return false;
  return true;
}

/** ---------- Update ---------- */
let lastT = performance.now();
function loop(nowMs){
  const now = nowMs/1000;
  const dt = Math.min(0.033, now - lastT/1000);
  lastT = nowMs;

  if (!state.pausedForShop) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  state.time += dt;

  // Player movement
  const p = state.player;
  let ix = 0, iy = 0;
  if (keys.has('w')) iy -= 1;
  if (keys.has('s')) iy += 1;
  if (keys.has('a')) ix -= 1;
  if (keys.has('d')) ix += 1;
  const m = Math.hypot(ix,iy) || 1;
  const wantSpeed = p.stats.speed * (keys.has('shift') ? 1.7 : 1.0);
  p.sprinting = keys.has('shift') && (ix||iy);
  p.vx = (ix/m) * wantSpeed;
  p.vy = (iy/m) * wantSpeed;
  if (ix||iy) p.facing = Math.atan2(p.vy, p.vx);

  // Integrate
  let nx = p.x + p.vx*dt, ny = p.y + p.vy*dt;
  // World bounds
  nx = clamp(nx, p.r+2, WORLD.W - p.r - 2);
  ny = clamp(ny, p.r+2, WORLD.H - p.r - 2);
  // Collide with active solids (outside walls + upstairs door block)
  const solids = getActiveSolids(p);
  for (const h of solids){
    const fixed = circleRectCollideResolve(nx,ny,p.r, h);
    nx = fixed.x; ny = fixed.y;
  }
  p.x = nx; p.y = ny;

  // Determine if player is inside a house interior and track level
  let insideId = -1;
  for (let i=0;i<state.houses.length;i++){
    if (isInsideHouseInterior(state.houses[i], p.x, p.y)) { insideId = i; break; }
  }
  if (insideId === -1){
    state.interior = null;
  } else if (!state.interior || state.interior.houseId !== insideId){
    state.interior = { houseId: insideId, level: 0 };
  }

  // Camera follow
  state.camera.x = clamp(p.x - W/2, 0, Math.max(0, WORLD.W - W));
  state.camera.y = clamp(p.y - H/2, 0, Math.max(0, WORLD.H - H));

  // Tavern trigger -> open shop
  if (inRect(p.x, p.y, state.tavern) && !state.pausedForShop){
    openShop();
  }

  // NPCs update: simple patrol/wander
  for (const npc of state.npcs){
    const wp = npc.waypoints[npc.wpIndex];
    const dx = wp.x - npc.x, dy = wp.y - npc.y;
    const d = Math.hypot(dx,dy);
    if (d < 4) {
      npc.wpIndex = (npc.wpIndex + 1) % npc.waypoints.length;
    } else {
      const vx = dx/d * npc.speed, vy = dy/d * npc.speed;
      // Move + collide with houses
      let nnx = npc.x + vx*dt, nny = npc.y + vy*dt;
      const ns = getActiveSolids(npc);
      for (const h of ns){
        const fixed = circleRectCollideResolve(nnx,nny,8, h);
        nnx = fixed.x; nny = fixed.y;
      }
      npc.x = nnx; npc.y = nny;
      npc.facing = Math.atan2(vy, vx);
    }
  }

  // Detection logic
  let seenBy = 0;
  for (const npc of state.npcs) if (npcSeesPlayer(npc, p)) seenBy++;
  const seen = seenBy > 0;
  state.lastSeen = seen;

  let inc = seen ? (18 * seenBy) : 0;
  if (seen){
    let minD = Infinity;
    for (const npc of state.npcs) if (npcSeesPlayer(npc,p)) {
      const dd = Math.hypot(npc.x-p.x, npc.y-p.y);
      if (dd < minD) minD = dd;
    }
    const distFactor = clamp(1.6 - (minD / 260), 0.3, 1.6);
    inc *= distFactor;
  }
  // Sprint noise (hearing) even when unseen
  if (p.sprinting){
    for (const npc of state.npcs){
      const hearR = (npc.type === 'scout') ? 180 : 120;
      const dd = Math.hypot(npc.x-p.x, npc.y-p.y);
      if (dd < hearR && !segBlockedByAnyRect(npc.x,npc.y,p.x,p.y,state.houseSolids)) {
        inc += (npc.type==='scout'? 10: 6) * (1 - dd/hearR);
      }
    }
  }
  // Invisibility nullifies gains
  if (state.time < p.invisUntil) inc = 0;
  // Apply stealth multiplier (lower is better)
  inc *= p.stats.stealthMult;
  // Update meter
  if (inc > 0) p.detection = clamp(p.detection + inc*dt, 0, 100);
  else p.detection = clamp(p.detection - 10*dt, 0, 100);

  if (p.detection >= 100){
    toast('Spotted! The village is on alert.', 2.5);
    p.detection = 60; // back off a bit to continue play
    addThreat(30);
  }

  // Threat escalation optional ambient gain on near-miss
  if (seen && p.detection > 70) addThreat(5*dt);

  // Threat spawns
  while (state.spawnCount < state.threatSpawns.length && state.threat >= state.threatSpawns[state.spawnCount]){
    spawnReinforcement();
    state.spawnCount++;
  }

  // Interact (E): stairs first, then chest
  if (pressOnce('e')){
    if (state.interior){
      const hid = state.interior.houseId;
      const lvl = state.interior.level;
      const st = state.stairs.find(s => s.houseId===hid && s.level===lvl && p.x >= s.x-6 && p.x <= s.x+s.w+6 && p.y >= s.y-6 && p.y <= s.y+s.h+6);
      if (st){
        // Preserve exact player position when changing levels
        const px = p.x, py = p.y;
        state.interior.level = st.targetLevel;
        // keep position exactly the same
        p.x = px; p.y = py;
        toast(st.targetLevel===1 ? 'You climb upstairs.' : 'You head downstairs.');
      } else {
        let target = null, best = 26;
        for (const c of state.chests){
          if (c.looted) continue;
          if (c.houseId!==hid || c.level!==lvl) continue;
          const dd = Math.hypot(c.x - p.x, c.y - p.y);
          if (dd < best){ best = dd; target = c; }
        }
        if (target){
          target.looted = true;
          p.gold += target.amount;
          toast(`Looted ${target.amount} gold.`);
          p.detection = clamp(p.detection + 25, 0, 100);
          addThreat(12);
        }
      }
    }
  }

  // Item use (1-6)
  for (let i=0;i<6;i++){
    if (pressOnce(String(i+1))) useInventorySlot(i);
  }

  // Debug toggle cones
  if (pressOnce('f')) state.debugCones = !state.debugCones;
}

/** ---------- Threat & Spawns ---------- */
function addThreat(v){ state.threat = Math.max(0, Math.min(999, state.threat + v)); }
function spawnReinforcement(){
  // Spawn a tougher scout at the castle, push into a village route
  const c = state.castle;
  const entry = { x:c.x - 20, y:c.y + 80 };
  const patrol = [
    entry,
    {x: mainVillage.x + mainVillage.w - 140, y: mainVillage.y + 160},
    {x: mainVillage.x + mainVillage.w - 200, y: mainVillage.y + 320},
    {x: mainVillage.x + mainVillage.w - 260, y: mainVillage.y + 480},
    {x: mainVillage.x + mainVillage.w - 200, y: mainVillage.y + 320}
  ];
  const npc = makeNPC('scout', entry.x, entry.y, patrol);
  npc.speed += 10;
  npc.fovRange += 30;
  state.npcs.push(npc);
  toast('Reinforcement scout arrives from the castle!');
}

/** ---------- Shop Overlay ---------- */
let justPressed = new Set();
function pressOnce(k){
  if (keys.has(k)){
    if (justPressed.has(k)) return false;
    justPressed.add(k);
    return true;
  } else {
    justPressed.delete(k);
    return false;
  }
}

function openShop(){
  state.pausedForShop = true;
  toast("Goblin Merchant: What are ya buyin'?", 2);
}

window.addEventListener('keydown', (e)=>{
  if (!state.pausedForShop) return;
  const k = e.key.toLowerCase();
  if (k === '0' || k === 'escape'){ state.pausedForShop = false; return; }
  // Purchase by number keys matching ITEMS key
  const item = ITEMS.find(it => it.key === k);
  if (!item) return;
  const p = state.player;
  if (p.gold < item.price){ toast('Not enough gold!'); return; }
  if (!inventoryAdd(item)){ toast('Inventory full!'); return; }
  p.gold -= item.price;
  // Apply passives immediately
  if (item.type === 'passive') item.apply(p);
  toast(`Purchased ${item.name}.`);
});

/** ---------- Rendering ---------- */
function drawTerrain(){
  const view = { x: state.camera.x - 120, y: state.camera.y - 120, w: W + 240, h: H + 240 };

  // Forest canopy
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

  // Dirt paths connecting villages
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

  // Village plazas / roads
  ctx.fillStyle = '#1a2536';
  for (const road of roads){
    if (!rectsOverlap(road, view)) continue;
    ctx.fillRect(road.x, road.y, road.w, road.h);
  }

  // Village boundaries for atmosphere
  ctx.fillStyle = 'rgba(18,24,36,0.4)';
  for (const village of VILLAGES){
    if (!rectsOverlap(village, view)) continue;
    ctx.fillRect(village.x-18, village.y-18, village.w+36, village.h+36);
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

function draw(){
  const p = state.player;

  // Night sky + moon haze
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#05080e';
  ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  drawTerrain();
  drawCastle();

  // Houses (draw)
  for (const h of state.houses){
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeStyle = '#2a3b57';
    ctx.strokeRect(h.x+0.5, h.y+0.5, h.w-1, h.h-1);
  }
  // Doors
  for (const d of state.doors){
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#3b4d6a';
    ctx.strokeRect(d.x+0.5, d.y+0.5, d.w-1, d.h-1);
  }
  // Upstairs floor interior fill (brown)
  if (state.interior && state.interior.level === 1) {
    const h = state.houses[state.interior.houseId];
    const col = interiorFloorColor(1);
    if (h && col) fillHouseInterior(h, col);
  }

  // Stairs (only relevant ones) - draw treads hugging edges
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

  // Tavern area
  ctx.fillStyle = 'rgba(30,80,40,.25)';
  ctx.fillRect(state.tavern.x, state.tavern.y, state.tavern.w, state.tavern.h);
  ctx.strokeStyle = '#3a7a4a';
  ctx.strokeRect(state.tavern.x+0.5, state.tavern.y+0.5, state.tavern.w-1, state.tavern.h-1);

  // Chests (only when interior and on same level)
  for (const c of state.chests){
    if (c.looted) continue;
    if (state.interior){
      if (c.houseId !== state.interior.houseId || c.level !== state.interior.level) continue;
    } else {
      continue;
    }
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(c.x-9, c.y-6, c.w, c.h);
    ctx.fillStyle = '#d9a441'; ctx.fillRect(c.x-9, c.y-1, c.w, 2);
  }

  // NPCs + vision cones
  for (const npc of state.npcs){
    if (state.debugCones) drawFOV(npc);
    ctx.beginPath();
    ctx.arc(npc.x, npc.y, 8, 0, TAU);
    ctx.fillStyle = npc.type==='scout' ? '#6fa8dc' : '#9aa5b1';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(npc.x, npc.y);
    ctx.lineTo(npc.x + Math.cos(npc.facing)*12, npc.y + Math.sin(npc.facing)*12);
    ctx.strokeStyle = '#a3b9d6'; ctx.stroke();
  }

  // Player (goblin)
  const invisible = state.time < p.invisUntil;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.fillStyle = invisible ? 'rgba(120,220,180,0.35)' : '#5cc16d';
  ctx.fill();
  // Torch light from scouts (atmosphere)
  drawTorchlight();

  ctx.restore();

  // HUD + UI
  drawHUD();

  // Shop overlay
  if (state.pausedForShop) drawShop();

  // Top message
  if (state.time < state.messageUntil){
    ctx.fillStyle = '#d1e7ff';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(state.message, 16, 24);
  }
}

function drawCastle(){
  const c = state.castle;
  const x = c.x, y = c.y;
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle = '#151b2b';
  ctx.fillRect(-26,-22, 52, 44);
  ctx.fillRect(-16,-38, 32, 16);
  for (let i=-24;i<=24;i+=12){ ctx.fillRect(i,-38, 6, 8); }
  ctx.restore();
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '12px system-ui';
  ctx.fillText("Dark Lord's Castle", x-48, y-46);
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

function bar(x,y,w,h, frac, fg, bg, border='#1a2636'){
  ctx.fillStyle = bg; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fg; ctx.fillRect(x,y, w*clamp(frac,0,1), h);
  ctx.strokeStyle = border; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
}

function drawHUD(){
  // Bottom panel
  ctx.fillStyle = 'rgba(10,14,22,0.9)';
  ctx.fillRect(0, H-100, W, 100);
  ctx.strokeStyle = '#1f2b3e';
  ctx.strokeRect(0.5, H-100.5, W-1, 100);

  const p = state.player;
  // Health
  bar(16, H-84, 220, 18, p.health/100, '#35c46a', '#233645');
  ctx.fillStyle = '#d4ffe6'; ctx.font = '12px system-ui'; ctx.fillText('Health', 20, H-70);

  // Detection (Stealth)
  bar(16, H-52, 220, 14, p.detection/100, '#f0c94c', '#233645');
  ctx.fillStyle = '#fff2c7'; ctx.font = '12px system-ui'; ctx.fillText('Detection', 20, H-38);

  // Gold
  ctx.fillStyle = '#ffd25a';
  ctx.font = '14px system-ui';
  ctx.fillText(`Gold: ${p.gold}`, 260, H-68);

  // Stats
  ctx.fillStyle = '#cfe1ff';
  ctx.font = '12px system-ui';
  ctx.fillText(`Speed: ${Math.round(p.stats.speed)}  Damage: ${p.stats.attack}  Stealth x${p.stats.stealthMult.toFixed(2)}`, 260, H-44);

  ctx.fillStyle = '#ffb347';
  ctx.font = '12px system-ui';
  ctx.fillText(`Threat: ${Math.round(state.threat)}`, 260, H-20);

  // Inventory slots
  const slotsX = W - 16 - (6*48);
  for (let i=0;i<6;i++){
    const x = slotsX + i*48, y = H - 84;
    ctx.fillStyle = 'rgba(24,34,52,0.9)';
    ctx.fillRect(x, y, 44, 44);
    ctx.strokeStyle = '#2a3a56'; ctx.strokeRect(x+.5,y+.5,44-1,44-1);
    ctx.fillStyle = '#6e8bb6'; ctx.font = '10px system-ui'; ctx.fillText(String(i+1), x+2, y+12);
    const it = state.player.inventory[i];
    if (it){
      ctx.fillStyle = '#d7e6ff';
      ctx.font = '11px system-ui';
      const label = it.name.split(' ').map(w=>w[0]).join('').slice(0,3);
      ctx.fillText(label, x+16, y+26);
    }
  }
}

function drawShop(){
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,16,.8)'; ctx.fillRect(0,0,W,H);
  // Parchment panel
  const pw=560, ph=280, px=(W-pw)/2, py=(H-ph)/2;
  ctx.fillStyle = '#2b2a24'; ctx.fillRect(px,py,pw,ph);
  ctx.strokeStyle = '#4a3d2b'; ctx.strokeRect(px+.5,py+.5,pw-1,ph-1);
  ctx.fillStyle = '#f4e1b5'; ctx.font = '20px ui-sans-serif';
  ctx.fillText('Goblin Tavern - Wares', px+20, py+34);
  ctx.fillStyle = '#ead6a0'; ctx.font = '14px ui-sans-serif';
  const lines = [
    'Press number to purchase. 0/Esc to leave.',
    `Your Gold: ${state.player.gold}`,
    '',
    '1) Boots of Speed (100) - Move faster.',
    '2) Cloak of Shadows (150) - Detect slower.',
    '3) Poison Dagger (120) - +Damage.',
    '4) Invisibility Potion (80) - 6s invisible (consumable).',
    '5) Moonleaf Draught (90) - Heal 30 HP (consumable).'
  ];
  lines.forEach((t,i)=> ctx.fillText(t, px+20, py+64 + i*24));
  ctx.restore();
}

/** ---------- Lightweight Tests (run once on load) ---------- */
function assert(cond, name){ if (!cond) { console.error('Test failed:', name); toast(`Test failed: ${name}`, 3); } else { console.log('OK', name); } }
function runTests(){
  // Build a small fake house to test solids/door gap
  const h = { x:100, y:100, w:100, h:80, side:'south', door:{x:130,y:100,w:20,h:WALL} };
  const prev = state.houseSolids.slice();
  state.houses.push(h); rebuildHouseSolids();
  const solidsAdded = state.houseSolids.slice(prev.length);
  assert(solidsAdded.length >= 4, 'rebuildHouseSolids adds walls');
  const gapLeft = solidsAdded.find(s => s.y===100 && s.x===100 && s.w===30);
  const gapRight = solidsAdded.find(s => s.y===100 && s.x===150 && s.w===50);
  assert(!!gapLeft && !!gapRight, 'doorway gap created along street wall');
  state.houses.pop(); rebuildHouseSolids();

  // randomInHouseInterior stays within inner bounds
  const hx = state.houses[0];
  const pt = randomInHouseInterior(hx, 16);
  assert(isInsideHouseInterior(hx, pt.x, pt.y), 'randomInHouseInterior inside bounds');

  // Each house: exactly ONE chest total (any level) -> we now place only on level 0
  state.houses.forEach((house, i)=>{
    const count = state.chests.filter(c=>c.houseId===i).length;
    assert(count === 1, `house ${i} has exactly one chest`);
  });

  // Each house has stairs: both up (level 0 -> 1) and down (level 1 -> 0)
  state.houses.forEach((house, i)=>{
    const hasUp = !!state.stairs.find(s=>s.houseId===i && s.level===0 && s.targetLevel===1);
    const hasDown = !!state.stairs.find(s=>s.houseId===i && s.level===1 && s.targetLevel===0);
    assert(hasUp && hasDown, `house ${i} has stairs up & down`);
  });

  // getActiveSolids adds door block when upstairs (check all houses)
  state.houses.forEach((house, i)=>{
    state.interior = { houseId: i, level: 1 };
    const solidsUpAll = getActiveSolids();
    const block = solidsUpAll.find(s => s.w === house.door.w && s.h === WALL && s.x === house.door.x);
    assert(!!block, `upstairs blocks doorway for house ${i}`);
  });
  state.interior = null;

  // stairs placed near edges (sample first house if exists)
  const groundStairs = state.stairs.filter(s=>s.level===0);
  if (groundStairs.length){
    const s0 = groundStairs[0];
    const h0 = state.houses[s0.houseId];
    const innerLeft = h0.x + WALL, innerRight = h0.x + h0.w - WALL;
    const innerTop = h0.y + WALL, innerBot = h0.y + h0.h - WALL;
    const distLeft = Math.abs(s0.x - innerLeft);
    const distRight = Math.abs((innerRight) - (s0.x + s0.w));
    const distTop = Math.abs(s0.y - innerTop);
    const distBot = Math.abs((innerBot) - (s0.y + s0.h));
    const edgeDist = Math.min(distLeft, distRight, distTop, distBot);
    assert(edgeDist <= 18, 'stairs hug an interior edge');

    // Player position should remain identical when changing levels via stairs
    state.interior = { houseId: s0.houseId, level: 0 };
    state.player.x = s0.x + s0.w/2;
    state.player.y = s0.y + s0.h/2;
    const px = state.player.x, py = state.player.y;
    const onStairs = (px >= s0.x-6 && px <= s0.x+s0.w+6 && py >= s0.y-6 && py <= s0.y+s0.h+6);
    assert(onStairs, 'stair interaction uses bbox, not center distance');
    state.interior.level = 1; // simulate going up
    assert(Math.abs(state.player.x - px) < 1e-6 && Math.abs(state.player.y - py) < 1e-6, 'stairs keep player position when going up');
    const solidsWhenUp = getActiveSolids();
    const hDoor = state.houses[s0.houseId].door;
    const doorBlocked = !!solidsWhenUp.find(s=>s.x===hDoor.x && s.w===hDoor.w && s.h===WALL);
    assert(doorBlocked, 'door is blocked upstairs');
    state.interior.level = 0; // simulate coming down
    assert(Math.abs(state.player.x - px) < 1e-6 && Math.abs(state.player.y - py) < 1e-6, 'stairs keep player position when going down');
    state.interior = null;
  } else {
    console.log('Note: no ground stairs found; edge-stairs test skipped.');
  }
  // Additional tests
  // Stairs visibility helper
  state.interior = null;
  assert(getRenderableStairs().length === 0, 'outside: no stairs rendered');
  state.interior = { houseId: 0, level: 0 };
  const vis0 = getRenderableStairs().length;
  assert(vis0 >= 1, 'inside level 0: stairs visible for current house');
  state.interior = { houseId: 0, level: 1 };
  const vis1 = getRenderableStairs().length;
  assert(vis1 >= 1, 'inside level 1: stairs visible for current house');
  state.interior = null;

  // Additional tests
  assert(interiorFloorColor(1) === SECOND_FLOOR_BROWN, 'second floor uses brown floor');
  assert(interiorFloorColor(0) === null, 'ground floor has no special floor color');
  const tcase = makeEdgeStairRects(state.houses[0], 'left', 6);
  assert(tcase.treads.length === 6, 'edge-stairs produce 6 treads');
  const pair = createEdgeStairs(state.houses[0], 0);
  assert(pair.up.w === pair.down.w && pair.up.h === pair.down.h, 'up/down stair bbox identical');

  // Extra: verify door is NOT blocked on ground level
  state.houses.forEach((house, i)=>{
    state.interior = { houseId: i, level: 0 };
    const solidsDown = getActiveSolids();
    const blocked = !!solidsDown.find(s => s.w === house.door.w && s.h === WALL && s.x === house.door.x);
    assert(!blocked, `ground level door unblocked for house ${i}`);
  });
  state.interior = null;
}

/** ---------- Start ---------- */
runTests();
requestAnimationFrame((t)=>{ lastT = t; loop(t); });

// Credits: You're the dark lord now.
