import { state, mainVillage } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { segBlockedByAnyRect } from '../utils/geometry.js';
import { TAU, clamp } from '../utils/math.js';
import { gatherForestSolidsAround } from '../world/terrain.js';
import { toast } from '../ui/toast.js';

const HUNTER_TYPES = new Set(['scout', 'tank']);

const NPC_TEMPLATES = {
  villager: { speed: 36, fovAngle: Math.PI / 2, fovRange: 120 },
  scout: { speed: 62, fovAngle: Math.PI / 3, fovRange: 220 },
  tank: { speed: 58, fovAngle: Math.PI / 1.65, fovRange: 260 }
};

function applyNpcTypeStats(npc, type){
  const template = NPC_TEMPLATES[type] || NPC_TEMPLATES.villager;
  npc.type = type;
  npc.baseSpeed = template.speed;
  npc.speed = template.speed;
  npc.baseFovAngle = template.fovAngle;
  npc.fovAngle = template.fovAngle;
  npc.baseFovRange = template.fovRange;
  npc.fovRange = template.fovRange;
}

function makeNPC(type, x, y, waypoints=null){
  const npc = {
    id: state.nextNpcId++,
    type,
    x,
    y,
    facing: 0,
    speed: 0,
    baseSpeed: 0,
    fovAngle: 0,
    baseFovAngle: 0,
    fovRange: 0,
    baseFovRange: 0,
    waypoints: waypoints || [{ x, y }],
    wpIndex: 0,
    dynamicTarget: null,
    dynamicTargetExpire: 0,
    searchCooldown: 0,
    activeTarget: null,
    hidden: false
  };
  applyNpcTypeStats(npc, type);
  return npc;
}

function offsetPoint(villageIndex, x, y){
  const v = VILLAGES[villageIndex];
  return { x: v.x + x, y: v.y + y };
}

function offsetWaypoints(villageIndex, pts){
  return pts.map(pt => offsetPoint(villageIndex, pt.x, pt.y));
}

function addVillageNPC(type, villageIndex, x, y, localWaypoints){
  const origin = offsetPoint(villageIndex, x, y);
  const worldWaypoints = localWaypoints ? offsetWaypoints(villageIndex, localWaypoints) : null;
  state.npcs.push(makeNPC(type, origin.x, origin.y, worldWaypoints));
}

function patchPatrolRoutes(){
  for (const npc of state.npcs){
    if (!HUNTER_TYPES.has(npc.type)) continue;
    if (!npc.waypoints || npc.waypoints.length < 3){
      const b = { x: npc.x, y: npc.y };
      npc.waypoints = [
        { x: b.x - 40, y: b.y - 20 },
        { x: b.x + 40, y: b.y - 20 },
        { x: b.x + 40, y: b.y + 20 },
        { x: b.x - 40, y: b.y + 20 }
      ];
      npc.wpIndex = 0;
    }
  }
}

function setupInitialNPCs(){
  state.npcs = [];
  addVillageNPC('villager', 0, 220, 520, [{x:220,y:520},{x:180,y:520},{x:220,y:520},{x:240,y:500}]);
  addVillageNPC('villager', 0, 560, 450, [{x:560,y:450},{x:540,y:470},{x:560,y:450},{x:580,y:430}]);
  addVillageNPC('scout',    0, 780, 480, [{x:780,y:480},{x:720,y:420},{x:660,y:480},{x:720,y:540}]);
  addVillageNPC('scout',    0, 500, 200, [{x:500,y:200},{x:420,y:220},{x:360,y:240},{x:420,y:260},{x:500,y:240}]);

  addVillageNPC('villager', 1, 300, 520, [{x:300,y:520},{x:340,y:560},{x:320,y:520}]);
  addVillageNPC('villager', 2, 640, 520, [{x:640,y:520},{x:600,y:560},{x:660,y:540}]);
  addVillageNPC('villager', 3, 420, 500, [{x:420,y:500},{x:460,y:540},{x:400,y:520}]);
  addVillageNPC('villager', 4, 540, 520, [{x:540,y:520},{x:580,y:500},{x:520,y:500}]);

  addVillageNPC('scout', 1, 700, 420, [{x:700,y:420},{x:620,y:420},{x:620,y:500},{x:700,y:500}]);
  addVillageNPC('scout', 2, 760, 420, [{x:760,y:420},{x:680,y:420},{x:680,y:500},{x:760,y:500}]);
  addVillageNPC('scout', 3, 760, 460, [{x:760,y:460},{x:700,y:420},{x:640,y:500},{x:700,y:540}]);
  addVillageNPC('scout', 4, 720, 420, [{x:720,y:420},{x:640,y:420},{x:640,y:500},{x:720,y:500}]);

  patchPatrolRoutes();
}

function npcSeesPlayer(npc, player){
  if (npc.hidden) return false;
  const dx = player.x - npc.x, dy = player.y - npc.y;
  const d = Math.hypot(dx,dy);
  if (d > npc.fovRange) return false;
  const ang = Math.atan2(dy,dx);
  let delta = ang - npc.facing;
  while (delta > Math.PI) delta -= TAU;
  while (delta < -Math.PI) delta += TAU;
  if (Math.abs(delta) > npc.fovAngle/2) return false;
  const midx = (npc.x + player.x) / 2, midy = (npc.y + player.y) / 2;
  const losRadius = Math.hypot(player.x - npc.x, player.y - npc.y) / 2 + 200;
  const blockers = state.interior ? state.houseSolids : state.houseSolids.concat(gatherForestSolidsAround(midx, midy, losRadius));
  if (segBlockedByAnyRect(npc.x, npc.y, player.x, player.y, blockers)) return false;
  if (state.time < player.invisUntil) return false;
  return true;
}

function spawnReinforcement(){
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
  npc.baseSpeed += 10;
  npc.speed = npc.baseSpeed;
  npc.baseFovRange += 30;
  npc.fovRange = npc.baseFovRange;
  state.npcs.push(npc);
  toast('Reinforcement scout arrives from the castle!');
}

function clampTargetToWorld(target){
  return {
    x: clamp(target.x, 32, WORLD.W - 32),
    y: clamp(target.y, 32, WORLD.H - 32)
  };
}

function updateNPCBehaviors(dt){
  const threat = state.threat;
  const threatFactor = clamp(threat / 200, 0, 1);
  const seenRecently = state.lastSeen && (state.time - state.lastSeenTime < 0.1) || (state.time - state.lastSeenTime < 12);
  for (const npc of state.npcs){
    if (npc.hidden){
      npc.activeTarget = npc.waypoints[npc.wpIndex];
      continue;
    }

    if (!HUNTER_TYPES.has(npc.type)){
      npc.activeTarget = npc.waypoints[npc.wpIndex];
      continue;
    }

    const speedBonus = npc.type === 'tank' ? 0.35 : 0.45;
    const rangeBonus = npc.type === 'tank' ? 150 : 120;
    const angleMultiplierBase = npc.type === 'tank' ? 1.12 : 1.05;
    const angleThreatBonus = npc.type === 'tank' ? 0.18 : 0.15;

    npc.speed = npc.baseSpeed * (1 + speedBonus * threatFactor);
    npc.fovRange = npc.baseFovRange + rangeBonus * threatFactor;
    npc.fovAngle = npc.baseFovAngle * (angleMultiplierBase + angleThreatBonus * threatFactor);

    if (npc.dynamicTarget){
      const dist = Math.hypot(npc.dynamicTarget.x - npc.x, npc.dynamicTarget.y - npc.y);
      if (dist < 10 || state.time >= npc.dynamicTargetExpire){
        npc.dynamicTarget = null;
        npc.dynamicTargetExpire = 0;
        npc.searchCooldown = Math.max(npc.searchCooldown, 1.4);
      }
    }

    if (!npc.dynamicTarget){
      npc.searchCooldown = Math.max(0, npc.searchCooldown - dt);
      if (npc.searchCooldown <= 0){
        let chosen = null;
        let expire = 0;

        if (seenRecently && threatFactor > 0.2){
          const huntScale = npc.type === 'tank' ? 1.2 : 1;
          const radius = (60 + 220 * threatFactor) * huntScale;
          const angle = Math.random() * TAU;
          chosen = clampTargetToWorld({
            x: state.lastSeenAt.x + Math.cos(angle) * radius,
            y: state.lastSeenAt.y + Math.sin(angle) * radius
          });
          expire = state.time + 6 + 6 * threatFactor * huntScale;
        } else if (threatFactor > 0.45){
          const anchor = threatFactor > 0.75 ? state.player : {
            x: mainVillage.x + mainVillage.w / 2,
            y: mainVillage.y + mainVillage.h / 2
          };
          const huntScale = npc.type === 'tank' ? 1.25 : 1;
          const radius = (140 + 320 * threatFactor) * huntScale;
          const angle = Math.random() * TAU;
          chosen = clampTargetToWorld({
            x: anchor.x + Math.cos(angle) * radius,
            y: anchor.y + Math.sin(angle) * radius
          });
          expire = state.time + 5 + 4 * threatFactor * huntScale;
        }

        if (chosen){
          npc.dynamicTarget = chosen;
          npc.dynamicTargetExpire = expire;
          npc.searchCooldown = 4 + Math.random() * 3;
        } else {
          npc.searchCooldown = 2 + Math.random() * 2;
        }
      }
    }

    npc.activeTarget = npc.dynamicTarget || npc.waypoints[npc.wpIndex];
  }
}

function promoteScoutToTank(){
  const candidates = state.npcs.filter(npc => npc.type === 'scout' && !npc.hidden);
  if (!candidates.length) return null;
  const npc = candidates[Math.floor(Math.random() * candidates.length)];
  applyNpcTypeStats(npc, 'tank');
  npc.dynamicTarget = null;
  npc.dynamicTargetExpire = 0;
  npc.searchCooldown = 2.5;
  return npc;
}

function setVillagerCurfewActive(active){
  let affected = 0;
  for (const npc of state.npcs){
    if (npc.type !== 'villager') continue;
    npc.hidden = active;
    if (active){
      npc.dynamicTarget = null;
      npc.dynamicTargetExpire = 0;
      npc.searchCooldown = 0;
    }
    affected++;
  }
  return affected;
}

function getNPCById(id){
  return state.npcs.find(npc => npc.id === id) || null;
}

export {
  makeNPC,
  addVillageNPC,
  patchPatrolRoutes,
  setupInitialNPCs,
  npcSeesPlayer,
  spawnReinforcement,
  updateNPCBehaviors,
  promoteScoutToTank,
  setVillagerCurfewActive,
  getNPCById
};
