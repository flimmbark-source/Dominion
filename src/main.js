import './style.css';

import { WORLD } from './data/world.js';
import { setupInput, keys } from './input.js';
import { canvas, ctx, W, H } from './game/canvas.js';
import { state } from './state/gameState.js';
import { getPlayerStats } from './state/playerStats.js';
import { TAVERN_INTERIOR, getTavernDoorRect } from './state/tavern.js';
import { initHouses, isInsideHouseInterior, getActiveSolids } from './world/houses.js';
import { generateWorld } from './world/terrain.js';
import { drawWorldScene } from './render/world.js';
import { drawTavernInteriorScene } from './render/tavernInterior.js';
import { drawHUD } from './render/hud.js';
import { drawShop } from './render/shop.js';
import { drawWorldMapOverlay } from './render/map.js';
import { npcSeesPlayer, setupInitialNPCs, spawnReinforcement, updateNPCBehaviors } from './npc/npcManager.js';
import {
  useInventorySlot,
  openShop,
  handleShopKeyDown,
  handleShopMouseMove,
  handleShopMouseLeave,
  handleShopClick
} from './systems/shop.js';
import { enterTavernInterior, leaveTavernInterior } from './systems/tavern.js';
import { addThreat } from './systems/threat.js';
import { initPointsOfInterest, handlePointOfInterestInteraction } from './systems/pointsOfInterest.js';
import { toast } from './ui/toast.js';
import { pressOnce } from './input/pressOnce.js';
import { circleRectCollideResolve, pointInRect, segBlockedByAnyRect } from './utils/geometry.js';
import { clamp } from './utils/math.js';
import { runTests } from './tests/lightweight.js';

setupInput();
initHouses();
generateWorld();
setupInitialNPCs();
initPointsOfInterest();

window.addEventListener('keydown', handleShopKeyDown);
canvas.addEventListener('mousemove', handleShopMouseMove);
canvas.addEventListener('mouseleave', handleShopMouseLeave);
canvas.addEventListener('click', handleShopClick);

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
  const toggleMap = pressOnce('m');
  const escapePressed = pressOnce('escape');
  if (toggleMap) state.mapVisible = !state.mapVisible;
  if (state.mapVisible && escapePressed) state.mapVisible = false;
  if (state.mapVisible) return;

  state.time += dt;

  const interactPressed = pressOnce('e');
  let interactAvailable = interactPressed;
  const inTavernInterior = state.tavernInteriorState.active;

  const p = state.player;
  const playerStats = getPlayerStats(p, state.time);
  let ix = 0, iy = 0;
  if (keys.has('w')) iy -= 1;
  if (keys.has('s')) iy += 1;
  if (keys.has('a')) ix -= 1;
  if (keys.has('d')) ix += 1;
  const m = Math.hypot(ix,iy) || 1;
  const wantSpeed = playerStats.movementSpeed * (keys.has('shift') ? 1.7 : 1.0);
  p.sprinting = keys.has('shift') && (ix||iy);
  p.vx = (ix/m) * wantSpeed;
  p.vy = (iy/m) * wantSpeed;
  if (ix||iy) p.facing = Math.atan2(p.vy, p.vx);

  let nx = p.x + p.vx*dt, ny = p.y + p.vy*dt;
  const boundsW = inTavernInterior ? TAVERN_INTERIOR.width : WORLD.W;
  const boundsH = inTavernInterior ? TAVERN_INTERIOR.height : WORLD.H;
  nx = clamp(nx, p.r+2, boundsW - p.r - 2);
  ny = clamp(ny, p.r+2, boundsH - p.r - 2);
  const solids = getActiveSolids(p);
  for (const h of solids){
    const fixed = circleRectCollideResolve(nx,ny,p.r, h);
    nx = fixed.x; ny = fixed.y;
  }
  p.x = nx; p.y = ny;

  if (inTavernInterior){
    state.interior = null;
    state.camera.x = 0;
    state.camera.y = 0;
    state.lastSeen = false;

    const exitRect = TAVERN_INTERIOR.exit;
    if (pointInRect(p.x, p.y, exitRect)){
      leaveTavernInterior();
      return;
    }

    if (interactPressed && !state.pausedForShop){
      const barkeep = TAVERN_INTERIOR.barkeep;
      const dist = Math.hypot(p.x - barkeep.x, p.y - barkeep.y);
      if (dist <= barkeep.interactRadius){
        openShop();
      }
    }

    p.detection = clamp(p.detection - 16*dt, 0, 100);
  }

  let insideId = -1;
  for (let i=0;i<state.houses.length;i++){
    if (isInsideHouseInterior(state.houses[i], p.x, p.y)) { insideId = i; break; }
  }
  if (insideId === -1){
    state.interior = null;
  } else if (!state.interior || state.interior.houseId !== insideId){
    state.interior = { houseId: insideId, level: 0 };
  }

  state.camera.x = clamp(p.x - W/2, 0, Math.max(0, WORLD.W - W));
  state.camera.y = clamp(p.y - H/2, 0, Math.max(0, WORLD.H - H));

  const tavern = state.tavern;
  let touchingDoor = false;
  if (tavern){
    const doorRect = getTavernDoorRect(tavern);
    if (doorRect){
      const doorRight = doorRect.x + doorRect.w;
      const doorBottom = doorRect.y + doorRect.h;
      const nearestX = clamp(p.x, doorRect.x, doorRight);
      const nearestY = clamp(p.y, doorRect.y, doorBottom);
      const dx = p.x - nearestX;
      const dy = p.y - nearestY;
      const contactR = p.r + 2;
      touchingDoor = (dx*dx + dy*dy) <= contactR * contactR;
    }
  }

  if (touchingDoor){
    if (!state.tavernPlayerInside && state.time >= state.tavernReentryBlockUntil){
      enterTavernInterior();
      return;
    }
    state.tavernPlayerInside = true;
  } else {
    state.tavernPlayerInside = false;
  }

  updateNPCBehaviors(dt);
  for (const npc of state.npcs){
    const wp = npc.activeTarget || npc.waypoints[npc.wpIndex];
    const dx = wp.x - npc.x, dy = wp.y - npc.y;
    const d = Math.hypot(dx,dy);
    if (d < 4) {
      npc.wpIndex = (npc.wpIndex + 1) % npc.waypoints.length;
    } else {
      const vx = dx/d * npc.speed, vy = dy/d * npc.speed;
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

  let seenBy = 0;
  for (const npc of state.npcs) if (npcSeesPlayer(npc, p)) seenBy++;
  const seen = seenBy > 0;
  state.lastSeen = seen;
  if (seen){
    state.lastSeenAt.x = p.x;
    state.lastSeenAt.y = p.y;
    state.lastSeenTime = state.time;
  }

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
  if (p.sprinting){
    for (const npc of state.npcs){
      const hearR = (npc.type === 'scout') ? 180 : 120;
      const dd = Math.hypot(npc.x-p.x, npc.y-p.y);
      if (dd < hearR && !segBlockedByAnyRect(npc.x,npc.y,p.x,p.y,state.houseSolids)) {
        inc += (npc.type==='scout'? 10: 6) * (1 - dd/hearR);
      }
    }
  }

  if (state.time < p.invisUntil) inc = 0;
  inc *= playerStats.stealthFactor;
  if (inc > 0) p.detection = clamp(p.detection + inc*dt, 0, 100);
  else p.detection = clamp(p.detection - 10*dt, 0, 100);

  if (p.detection >= 100){
    toast('Spotted! The village is on alert.', 2.5);
    p.detection = 60;
    addThreat(30);
  }

  if (seen && p.detection > 70) addThreat(5*dt);
  if (!seen) addThreat(-4*dt);

  if (!inTavernInterior){
    if (handlePointOfInterestInteraction(interactAvailable && !state.interior)){
      interactAvailable = false;
    }
  }

  while (state.spawnCount < state.threatSpawns.length && state.threat >= state.threatSpawns[state.spawnCount]){
    spawnReinforcement();
    state.spawnCount++;
  }

  if (interactAvailable && state.interior){
    const hid = state.interior.houseId;
    const lvl = state.interior.level;
    const st = state.stairs.find(s => s.houseId===hid && s.level===lvl && p.x >= s.x-6 && p.x <= s.x+s.w+6 && p.y >= s.y-6 && p.y <= s.y+s.h+6);
    if (st){
      const px = p.x, py = p.y;
      state.interior.level = st.targetLevel;
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

  for (let i=0;i<6;i++){
    if (pressOnce(String(i+1))) useInventorySlot(i);
  }

  if (pressOnce('f')) state.debugCones = !state.debugCones;
}

function draw(){
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#05080e';
  ctx.fillRect(0,0,W,H);

  if (state.tavernInteriorState.active){
    drawTavernInteriorScene();
  } else {
    drawWorldScene();
  }

  drawHUD();

  if (state.pausedForShop) drawShop();

  if (state.mapVisible) drawWorldMapOverlay();

  if (state.time < state.messageUntil){
    ctx.fillStyle = '#d1e7ff';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(state.message, 16, 24);
  }
}

runTests();
requestAnimationFrame((t)=>{ lastT = t; loop(t); });

// Credits: You're the dark lord now.
