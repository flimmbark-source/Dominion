import { state, mainVillage } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { segBlockedByAnyRect } from '../utils/geometry.js';
import { TAU, clamp } from '../utils/math.js';
import { gatherForestSolidsAround } from '../world/terrain.js';
import { toast } from '../ui/toast.js';

function makeNPC(type, x, y, waypoints=null){
  const isScout = type === 'scout';
  return {
    type,
    x,
    y,
    facing: 0,
    speed: isScout ? 62 : 36,
    baseSpeed: isScout ? 62 : 36,
    fovAngle: isScout ? (Math.PI/3) : (Math.PI/2),
    baseFovAngle: isScout ? (Math.PI/3) : (Math.PI/2),
    fovRange: isScout ? 220 : 120,
    baseFovRange: isScout ? 220 : 120,
    waypoints: waypoints || [{ x, y }],
    wpIndex: 0,
    dynamicTarget: null,
    dynamicTargetExpire: 0,
    searchCooldown: 0,
    activeTarget: null,
    dialogCooldown: 0,
    lastDialogueLine: null,
    pickpocketCooldown: 0,
    pickpocketed: false
  };
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
    if (npc.type !== 'scout') continue;
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
    if (npc.type !== 'scout'){
      npc.activeTarget = npc.waypoints[npc.wpIndex];
      continue;
    }

    npc.speed = npc.baseSpeed * (1 + 0.45 * threatFactor);
    npc.fovRange = npc.baseFovRange + 120 * threatFactor;
    npc.fovAngle = npc.baseFovAngle * (1.05 + 0.15 * threatFactor);

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
          const radius = 60 + 220 * threatFactor;
          const angle = Math.random() * TAU;
          chosen = clampTargetToWorld({
            x: state.lastSeenAt.x + Math.cos(angle) * radius,
            y: state.lastSeenAt.y + Math.sin(angle) * radius
          });
          expire = state.time + 6 + 6 * threatFactor;
        } else if (threatFactor > 0.45){
          const anchor = threatFactor > 0.75 ? state.player : {
            x: mainVillage.x + mainVillage.w / 2,
            y: mainVillage.y + mainVillage.h / 2
          };
          const radius = 140 + 320 * threatFactor;
          const angle = Math.random() * TAU;
          chosen = clampTargetToWorld({
            x: anchor.x + Math.cos(angle) * radius,
            y: anchor.y + Math.sin(angle) * radius
          });
          expire = state.time + 5 + 4 * threatFactor;
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

export {
  makeNPC,
  addVillageNPC,
  patchPatrolRoutes,
  setupInitialNPCs,
  npcSeesPlayer,
  spawnReinforcement,
  updateNPCBehaviors
};
