import './style.css';

import { WORLD } from './data/world.js';
import { setupInput, keys } from './input.js';
import { canvas, ctx, W, H, resizeCanvas } from './game/canvas.js';
import { state } from './state/gameState.js';
import { getPlayerStats } from './state/playerStats.js';
import { TAVERN_INTERIOR, getTavernDoorRect } from './state/tavern.js';
import { initHouses, isInsideHouseInterior, getActiveSolids } from './world/houses.js';
import { generateWorld } from './world/terrain.js';
import { prepareVillageInstances } from './world/villageTemplates.js';
import { drawWorldScene } from './render/world.js';
import { drawTavernInteriorScene } from './render/tavernInterior.js';
import { drawHUD } from './render/hud.js';
import { drawShop } from './render/shop.js';
import { drawWorldMapOverlay } from './render/map.js';
import { drawMiniMap } from './render/minimap.js';
import {
  npcSeesPlayer,
  setupInitialNPCs,
  spawnReinforcement,
  updateNPCBehaviors,
  queueNoiseEvent,
  notifyNPCPlayerSpotted,
  removeNPC,
  NPC_STATE
} from './npc/npcManager.js';
import {
  useInventorySlot,
  openShop,
  handleShopKeyDown,
  handleShopMouseMove,
  handleShopMouseLeave,
  handleShopClick
} from './systems/shop.js';
import {
  handleInventoryMouseMove,
  handleInventoryMouseLeave
} from './systems/inventoryHover.js';
import { enterTavernInterior, leaveTavernInterior } from './systems/tavern.js';
import { addThreat } from './systems/threat.js';
import { attemptAttack } from './systems/combat.js';
import { addDamageNumber, updateDamageNumbers } from './systems/damageNumbers.js';
import { initPointsOfInterest, handlePointOfInterestInteraction } from './systems/pointsOfInterest.js';
import { toast } from './ui/toast.js';
import { pressOnce } from './input/pressOnce.js';
import { circleRectCollideResolve, pointInRect, segBlockedByAnyRect } from './utils/geometry.js';
import { clamp } from './utils/math.js';
import { getWeaponSwingConfig, resolveWeaponType } from './utils/weaponSwing.js';
import { runTests } from './tests/lightweight.js';
import {
  initVillageInteractions,
  tryDisarmNearbyTrap,
  tryPickpocketVillager,
  tryTalkToVillager,
  updateTrapDisarm
} from './systems/villageInteractions.js';
import { initWarState, updateWar } from './systems/war.js';

setupInput();
prepareVillageInstances();
initHouses();
generateWorld();
setupInitialNPCs();
initWarState();
initVillageInteractions();
initPointsOfInterest();

window.addEventListener('keydown', handleShopKeyDown);
canvas.addEventListener('mousemove', handleCanvasMouseMove);
canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
canvas.addEventListener('click', handleShopClick);

function handleCanvasMouseMove(evt){
  handleInventoryMouseMove(evt);
  handleShopMouseMove(evt);
}

function handleCanvasMouseLeave(){
  handleInventoryMouseLeave();
  handleShopMouseLeave();
}

let lastT = performance.now();
let lastKnownPixelRatio = window.devicePixelRatio || 1;

function emitNoiseEvent(type, origin, options = {}){
  return queueNoiseEvent({
    x: origin.x,
    y: origin.y,
    radius: options.radius ?? 180,
    type,
    source: options.source || type,
    investigateFor: options.investigateFor ?? 3,
    maxResponders: options.maxResponders ?? 1,
    cooldown: options.cooldown ?? 5,
    duration: options.duration ?? 6,
    debug: options.debug
  });
}

const DEATH_MESSAGE_DURATION = 1.6;
const DEATH_FADE_OUT_DURATION = 1.2;
const DEATH_FADE_IN_DURATION = 1.2;
const DEATH_TEXT_FADE_IN_DURATION = 0.35;

function startDeathSequence(){
  if (state.deathSequence) return;

  const player = state.player;
  player.health = 0;
  player.dead = true;
  player.vx = 0;
  player.vy = 0;
  player.sprinting = false;
  player.attackSwing = null;
  player.nextAttackReady = state.time;
  state.pausedForShop = false;

  state.deathSequence = {
    step: 'message',
    stepStart: state.time,
    fade: 0,
    textAlpha: 0,
    respawned: false
  };
}

function respawnPlayer(){
  const spawn = state.playerSpawn || { x: state.player.x, y: state.player.y };
  const player = state.player;
  const stats = getPlayerStats(player, state.time);

  player.x = spawn.x;
  player.y = spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.facing = 0;
  player.attackSwing = null;
  player.nextAttackReady = state.time + 0.3;
  player.sprinting = false;
  player.invisUntil = state.time;
  player.health = stats.maxHealth ?? player.health;
  player.detection = 0;
  player.nextSprintNoiseTime = state.time + 0.6;
  player.nextThrowNoiseTime = state.time + 0.6;
  player.dead = false;

  state.interior = null;
  state.tavernInteriorState.active = false;
  state.tavernPlayerInside = false;
  state.pausedForShop = false;

  state.camera.x = clamp(player.x - W/2, 0, Math.max(0, WORLD.W - W));
  state.camera.y = clamp(player.y - H/2, 0, Math.max(0, WORLD.H - H));
}

function advanceDeathSequence(dt){
  const seq = state.deathSequence;
  if (!seq) return false;

  const elapsed = state.time - (seq.stepStart ?? state.time);

  if (seq.step === 'message'){
    seq.textAlpha = clamp(elapsed / DEATH_TEXT_FADE_IN_DURATION, 0, 1);
    seq.fade = 0;
    if (elapsed >= DEATH_MESSAGE_DURATION){
      seq.step = 'fadeOut';
      seq.stepStart = state.time;
    }
    return true;
  }

  if (seq.step === 'fadeOut'){
    const fadeProgress = clamp(elapsed / DEATH_FADE_OUT_DURATION, 0, 1);
    seq.fade = fadeProgress;
    seq.textAlpha = clamp(1 - fadeProgress, 0, 1);
    if (!seq.respawned && elapsed >= DEATH_FADE_OUT_DURATION){
      respawnPlayer();
      seq.respawned = true;
      seq.step = 'fadeIn';
      seq.stepStart = state.time;
      seq.fade = 1;
      seq.textAlpha = 0;
    }
    return true;
  }

  if (seq.step === 'fadeIn'){
    const fadeProgress = clamp(elapsed / DEATH_FADE_IN_DURATION, 0, 1);
    seq.fade = clamp(1 - fadeProgress, 0, 1);
    if (elapsed >= DEATH_FADE_IN_DURATION){
      state.deathSequence = null;
      return false;
    }
    return true;
  }

  state.deathSequence = null;
  return false;
}

function getEquippedWeaponType(player){
  if (!player || !Array.isArray(player.inventory)){
    return resolveWeaponType('dagger');
  }

  for (const item of player.inventory){
    if (!item) continue;
    if (item.weaponType) return resolveWeaponType(item.weaponType);
    if (item.id === 'dagger') return resolveWeaponType('dagger');
  }

  return resolveWeaponType('dagger');
}

function loop(nowMs){
  const now = nowMs/1000;
  const dt = Math.min(0.033, now - lastT/1000);
  lastT = nowMs;

  const currentPixelRatio = window.devicePixelRatio || 1;
  if (Math.abs(currentPixelRatio - lastKnownPixelRatio) > 0.001){
    resizeCanvas();
    lastKnownPixelRatio = currentPixelRatio;
  }

  if (!state.pausedForShop) update(dt);
  draw();
  requestAnimationFrame(loop);
}

function update(dt){
  const toggleMap = pressOnce('m');
  const escapePressed = pressOnce('escape');
  if (toggleMap){
    state.mapMode = state.mapMode === 'large' ? 'minimal' : 'large';
  }
  if (state.mapMode === 'large' && escapePressed){
    state.mapMode = 'minimal';
  }
  if (state.mapMode === 'large') return;

  state.time += dt;
  updateDamageNumbers();

  if (state.player.health <= 0 && !state.deathSequence){
    startDeathSequence();
  }

  if (state.deathSequence){
    const blocking = advanceDeathSequence(dt);
    if (blocking) return;
  }

  const interactPressed = pressOnce('e');
  const pickpocketPressed = pressOnce('r');
  const attackPressed = pressOnce('space');
  const throwPressed = pressOnce('q');
  let interactAvailable = interactPressed;
  const inTavernInterior = state.tavernInteriorState.active;

  const p = state.player;
  const playerStats = getPlayerStats(p, state.time);

  if (p.attackSwing){
    const start = typeof p.attackSwing.start === 'number' ? p.attackSwing.start : 0;
    const duration = typeof p.attackSwing.duration === 'number' ? p.attackSwing.duration : 0;
    if (state.time >= start + duration){
      p.attackSwing = null;
    }
  }

  for (const npc of state.npcs){
    if (!npc.attackSwing) continue;
    const swingStart = typeof npc.attackSwing.start === 'number' ? npc.attackSwing.start : 0;
    const swingDuration = typeof npc.attackSwing.duration === 'number' ? npc.attackSwing.duration : 0;
    if (state.time >= swingStart + swingDuration){
      npc.attackSwing = null;
    }
  }
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

  updateTrapDisarm();

  if (p.sprinting){
    if (state.time >= p.nextSprintNoiseTime){
      emitNoiseEvent('sprint', { x: p.x, y: p.y }, {
        radius: 220,
        investigateFor: 2.5,
        maxResponders: 1,
        cooldown: 3.2,
        debug: false,
        source: 'player_sprint'
      });
      p.nextSprintNoiseTime = state.time + 1.5;
    }
  } else {
    p.nextSprintNoiseTime = Math.min(p.nextSprintNoiseTime, state.time + 0.6);
  }

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

  if (!inTavernInterior && !state.interior){
    if (interactPressed){
      const spoke = tryTalkToVillager();
      if (!spoke){
        tryDisarmNearbyTrap();
      }
    }
    if (pickpocketPressed){
      tryPickpocketVillager();
    }
  }

  if (throwPressed && !inTavernInterior && !state.interior){
    if (state.time >= p.nextThrowNoiseTime){
      const throwDist = 200;
      const target = {
        x: clamp(p.x + Math.cos(p.facing || 0) * throwDist, 0, WORLD.W),
        y: clamp(p.y + Math.sin(p.facing || 0) * throwDist, 0, WORLD.H)
      };
      emitNoiseEvent('distraction', target, {
        radius: 240,
        investigateFor: 4,
        maxResponders: 1,
        cooldown: 6,
        source: 'player_throw'
      });
      toast('You toss a distraction into the dark.', 1.6);
      p.nextThrowNoiseTime = state.time + 6;
    } else {
      toast('Your last throw still echoes—wait a moment.', 1.2);
    }
  }

  updateWar(dt);
  updateNPCBehaviors(dt);
  for (const npc of state.npcs){
    if (npc.pauseTimer > 0) continue;
    const chaseTarget = npc.chasingTarget && state.npcs.includes(npc.chasingTarget) ? npc.chasingTarget : null;
    if (!chaseTarget && npc.chasingTarget){
      npc.chasingTarget = null;
    }
    const target = chaseTarget || npc.activeTarget || npc.waypoints[npc.wpIndex];
    if (!target) continue;
    const dx = target.x - npc.x;
    const dy = target.y - npc.y;
    const d = Math.hypot(dx, dy);
    if (d < 4){
      if (chaseTarget){
        continue;
      }
      if (npc.behaviorState === NPC_STATE.PATROL){
        if (!npc.holdPosition){
          const [minPause, maxPause] = npc.patrolPauseRange || [0, 0];
          const pause = maxPause > 0 ? minPause + Math.random() * Math.max(0, maxPause - minPause) : 0;
          if (pause > 0){
            npc.pauseTimer = pause;
            npc.holdPosition = true;
          } else {
            npc.wpIndex = (npc.wpIndex + 1) % npc.waypoints.length;
          }
        }
      } else if (npc.behaviorState === NPC_STATE.SUSPICIOUS){
        if (!npc.arrivedAtInvestigation){
          npc.arrivedAtInvestigation = true;
          const linger = npc.investigationTimer || npc.investigateDuration || 2;
          npc.investigationTimer = linger;
          if (linger > 0) npc.pauseTimer = Math.max(npc.pauseTimer, linger);
        }
      } else if (npc.behaviorState === NPC_STATE.SEARCH){
        if (npc.searchRoute && npc.searchIndex < npc.searchRoute.length){
          npc.searchIndex++;
        }
        const hold = npc.searchIndex >= (npc.searchRoute?.length || 0) ? 0.75 : 0.4;
        npc.pauseTimer = Math.max(npc.pauseTimer, hold);
      }
      continue;
    }

    const vx = dx / d * npc.speed;
    const vy = dy / d * npc.speed;
    let nnx = npc.x + vx * dt;
    let nny = npc.y + vy * dt;
    const ns = getActiveSolids(npc);
    for (const h of ns){
      const fixed = circleRectCollideResolve(nnx, nny, 8, h);
      nnx = fixed.x; nny = fixed.y;
    }
    npc.x = nnx; npc.y = nny;
    npc.facing = Math.atan2(vy, vx);
  }

  const battleCasualties = [];
  const defeated = new Set();
  for (const npc of state.npcs){
    const attack = npc.attack;
    if (!attack) continue;
    const targetNpc = npc.chasingTarget;
    if (!targetNpc) continue;
    if (!state.npcs.includes(targetNpc)) continue;
    const dx = targetNpc.x - npc.x;
    const dy = targetNpc.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist > attack.range) continue;
    if (state.time < (attack.nextReady ?? 0)) continue;

    const damage = Math.max(0, attack.damage ?? 0);
    if (damage <= 0) continue;

    const cooldown = Math.max(attack.cooldown ?? 1.2, 0.2);
    attack.nextReady = state.time + cooldown;
    const weaponType = resolveWeaponType(attack.weaponType);
    const swingConfig = getWeaponSwingConfig(weaponType);
    npc.attackSwing = {
      start: state.time,
      duration: swingConfig?.duration ?? cooldown,
      facing: Math.atan2(dy, dx),
      weaponType
    };
    targetNpc.health = Math.max(0, targetNpc.health - damage);
    addDamageNumber({
      x: targetNpc.x,
      y: targetNpc.y,
      amount: damage,
      color: targetNpc.faction === 'village' ? '#ff6b6b' : '#f9d776'
    });

    if (targetNpc.health <= 0 && !defeated.has(targetNpc)){
      defeated.add(targetNpc);
      battleCasualties.push(targetNpc);
    }
  }

  if (battleCasualties.length){
    for (const victim of battleCasualties){
      removeNPC(victim);
    }
  }

  for (const npc of state.npcs){
    const attack = npc.attack;
    if (!attack) continue;
    const engaged = npc.faction === 'monster' || npc.faction === 'darkLord' || npc.behaviorState === NPC_STATE.ALERT;
    if (!engaged) continue;
    const dx = p.x - npc.x;
    const dy = p.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist > attack.range) continue;
    if (state.time < p.invisUntil) continue;
    if (state.time < (attack.nextReady ?? 0)) continue;

    const damage = Math.max(0, attack.damage ?? 0);
    if (damage <= 0) continue;

    const cooldown = Math.max(attack.cooldown ?? 1.2, 0.2);
    state.player.health = clamp(state.player.health - damage, 0, playerStats.maxHealth);
    addDamageNumber({
      x: p.x,
      y: p.y,
      amount: damage,
      color: '#ff6b6b'
    });
    attack.nextReady = state.time + cooldown;
    const weaponType = resolveWeaponType(attack.weaponType);
    const swingConfig = getWeaponSwingConfig(weaponType);
    npc.attackSwing = {
      start: state.time,
      duration: swingConfig?.duration ?? cooldown,
      facing: Math.atan2(dy, dx),
      weaponType
    };
  }

  if (attackPressed){
    attemptAttack(p, playerStats, getEquippedWeaponType(p));
  }

  let seenBy = 0;
  for (const npc of state.npcs){
    if (npc.faction === 'monster' || npc.faction === 'darkLord') continue;
    if (npcSeesPlayer(npc, p)){
      seenBy++;
      notifyNPCPlayerSpotted(npc, p);
    }
  }
  const seen = seenBy > 0;
  state.lastSeen = seen;
  if (seen){
    state.lastSeenAt.x = p.x;
    state.lastSeenAt.y = p.y;
    state.lastSeenTime = state.time;
    state.timeSinceSeen = 0;
    state.nextSweeperSpawn = Math.max(state.nextSweeperSpawn, state.time + 12);
  }
  else {
    state.timeSinceSeen += dt;
  }

  const detectionFrac = clamp(p.detection / 100, 0, 1);
  if (seen){
    state.huntHeat = clamp(state.huntHeat + dt * (0.7 + detectionFrac * 0.9), 0, 1);
  } else {
    const decay = 0.05 + (1 - detectionFrac) * 0.22 + (state.timeSinceSeen > 30 ? 0.06 : 0);
    state.huntHeat = clamp(state.huntHeat - dt * decay, 0, 1);
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
      if (npc.faction === 'monster' || npc.faction === 'darkLord') continue;
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
    let mode = 'standard';
    if (state.huntHeat > 0.6 || p.detection > 80){
      mode = 'aggressive';
    } else if (state.timeSinceSeen > 35){
      mode = 'sweeper';
    }
    spawnReinforcement({ mode });
    state.spawnCount++;
  }


  if (state.timeSinceSeen > 24 && state.time >= state.nextSweeperSpawn){
    spawnReinforcement({ mode: 'sweeper' });
    state.nextSweeperSpawn = state.time + 22 + Math.random() * 16;
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

  if (state.mapMode === 'minimal'){
    drawMiniMap();
  } else if (state.mapMode === 'large'){
    drawWorldMapOverlay();
  }

  for (let i = state.messages.length - 1; i >= 0; i--){
    if (state.time >= state.messages[i].expiresAt){
      state.messages.splice(i, 1);
    }
  }

  if (state.messages.length){
    ctx.fillStyle = '#d1e7ff';
    ctx.font = 'bold 16px system-ui';
    const lineHeight = 20;
    const threatIndicatorWidth = 72;
    const threatIndicatorPadding = 12;
    const messageX = 16 + threatIndicatorWidth + threatIndicatorPadding;

    state.messages.forEach((message, index) => {
      const y = 24 + index * lineHeight;
      ctx.fillText(message.text, messageX, y);
    });
  }

  drawDeathOverlay();
}

function drawDeathOverlay(){
  const seq = state.deathSequence;
  if (!seq) return;

  const fadeAmount = clamp(seq.fade ?? 0, 0, 1);
  if (fadeAmount > 0){
    ctx.fillStyle = `rgba(0, 0, 0, ${fadeAmount})`;
    ctx.fillRect(0, 0, W, H);
  }

  const showText = seq.step === 'message' || seq.step === 'fadeOut';
  const textAlpha = showText ? clamp(seq.textAlpha ?? 0, 0, 1) : 0;
  if (showText && textAlpha > 0){
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = '#d94040';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 76px "Trebuchet MS", system-ui';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 24;
    ctx.fillText('You Died', W / 2, H / 2);
    ctx.restore();
  }
}

runTests();
requestAnimationFrame((t)=>{ lastT = t; loop(t); });

// Credits: You're the dark lord now.
