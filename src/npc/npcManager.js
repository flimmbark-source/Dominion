import { state, mainVillage } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { segBlockedByAnyRect } from '../utils/geometry.js';
import { TAU, clamp } from '../utils/math.js';
import { gatherForestSolidsAround } from '../world/terrain.js';
import { toast } from '../ui/toast.js';

const NPC_ARCHETYPES = {
  villager: {
    speed: 36,
    fovAngle: Math.PI / 2,
    fovRange: 120,
    maxHealth: 30,
    attackable: false,
    faction: 'village',
    displayName: 'villager'
  },
  scout: {
    speed: 62,
    fovAngle: Math.PI / 3,
    fovRange: 220,
    maxHealth: 60,
    attackable: true,
    backstabOnly: true,
    backstabMultiplier: 3.2,
    rewardGold: 30,
    threatOnDefeat: 25,
    counterDamage: 28,
    counterDetection: 40,
    counterThreat: 25,
    faction: 'village',
    displayName: 'scout',
    counterMessage: 'The scout whirls and cuts you down! Approach from behind while unseen.'
  },
  bogling: {
    speed: 44,
    fovAngle: Math.PI / 2,
    fovRange: 70,
    maxHealth: 10,
    attackable: true,
    backstabMultiplier: 1.8,
    rewardGold: 8,
    faction: 'monster',
    displayName: 'bogling'
  }
};

function makeNPC(type, x, y, waypoints=null){
  const config = NPC_ARCHETYPES[type] || NPC_ARCHETYPES.villager;
  return {
    type,
    x,
    y,
    facing: 0,
    speed: config.speed,
    baseSpeed: config.speed,
    fovAngle: config.fovAngle,
    baseFovAngle: config.fovAngle,
    fovRange: config.fovRange,
    baseFovRange: config.fovRange,
    waypoints: waypoints || [{ x, y }],
    wpIndex: 0,
    dynamicTarget: null,
    dynamicTargetExpire: 0,
    searchCooldown: 0,
    activeTarget: null,
    maxHealth: config.maxHealth,
    health: config.maxHealth,
    attackable: !!config.attackable,
    backstabOnly: !!config.backstabOnly,
    backstabMultiplier: config.backstabMultiplier ?? 1,
    rewardGold: config.rewardGold ?? 0,
    threatOnDefeat: config.threatOnDefeat ?? 0,
    counterDamage: config.counterDamage ?? 0,
    counterDetection: config.counterDetection ?? 0,
    counterThreat: config.counterThreat ?? 0,
    counterMessage: config.counterMessage || null,
    faction: config.faction || 'village',
    displayName: config.displayName || type
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

  const boglingLoops = [
    [
      { x: mainVillage.x - 120, y: mainVillage.y + 460 },
      { x: mainVillage.x - 80, y: mainVillage.y + 520 },
      { x: mainVillage.x - 140, y: mainVillage.y + 560 }
    ],
    [
      { x: mainVillage.x + mainVillage.w + 80, y: mainVillage.y + 420 },
      { x: mainVillage.x + mainVillage.w + 120, y: mainVillage.y + 470 },
      { x: mainVillage.x + mainVillage.w + 60, y: mainVillage.y + 520 }
    ],
    [
      { x: mainVillage.x + 180, y: mainVillage.y + mainVillage.h + 60 },
      { x: mainVillage.x + 260, y: mainVillage.y + mainVillage.h + 40 },
      { x: mainVillage.x + 220, y: mainVillage.y + mainVillage.h + 120 }
    ]
  ];
  for (const loop of boglingLoops){
    state.npcs.push(makeNPC('bogling', loop[0].x, loop[0].y, loop));
  }

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

function randomPointAround(anchor, radius){
  const angle = Math.random() * TAU;
  return clampTargetToWorld({
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius
  });
}

function makeAggressivePatrol(entry){
  const focus = state.lastSeen ? state.lastSeenAt : state.player;
  const huntFactor = clamp(state.huntHeat || 0, 0, 1);
  const radius = 120 + 260 * huntFactor;
  return [
    entry,
    randomPointAround(focus, radius),
    randomPointAround(focus, Math.max(80, radius * 0.7)),
    randomPointAround(focus, radius * 1.2),
    entry
  ];
}

function makeSweeperPatrol(entry){
  const huntFactor = clamp(state.huntHeat || 0, 0, 1);
  const base = {
    x: mainVillage.x + mainVillage.w / 2 + (Math.random() * 520 - 260),
    y: mainVillage.y + mainVillage.h / 2 + (Math.random() * 420 - 210)
  };
  const radius = 180 + 180 * (1 - huntFactor);
  const loop = [entry];
  for (let i = 0; i < 3; i++){
    loop.push(randomPointAround(base, radius + Math.random() * 120));
  }
  loop.push(entry);
  return loop;
}

function spawnReinforcement(options = {}){
  const { mode = 'standard', announce = true } = options;
  const c = state.castle;
  const entry = { x:c.x - 20, y:c.y + 80 };
  let patrol;

  if (mode === 'aggressive'){
    patrol = makeAggressivePatrol(entry);
  } else if (mode === 'sweeper'){
    patrol = makeSweeperPatrol(entry);
  } else {
    patrol = [
      entry,
      {x: mainVillage.x + mainVillage.w - 140, y: mainVillage.y + 160},
      {x: mainVillage.x + mainVillage.w - 200, y: mainVillage.y + 320},
      {x: mainVillage.x + mainVillage.w - 260, y: mainVillage.y + 480},
      {x: mainVillage.x + mainVillage.w - 200, y: mainVillage.y + 320}
    ];
  }

  const npc = makeNPC('scout', entry.x, entry.y, patrol);
  if (mode === 'aggressive'){
    npc.baseSpeed += 16;
    npc.baseFovRange += 60;
  } else if (mode === 'sweeper'){
    npc.baseSpeed += 6;
    npc.baseFovRange += 40;
  } else {
    npc.baseSpeed += 10;
    npc.baseFovRange += 30;
  }
  npc.speed = npc.baseSpeed;
  npc.fovRange = npc.baseFovRange;
  state.npcs.push(npc);

  if (announce){
    if (mode === 'aggressive'){
      toast('A hunting party surges from the castle!');
    } else if (mode === 'sweeper'){
      toast('The Dark Lord dispatches a sweeper scout.');
    } else {
      toast('Reinforcement scout arrives from the castle!');
    }
  }
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
  const huntFactor = clamp(state.huntHeat || 0, 0, 1);
  const seenRecently = state.lastSeen && (state.time - state.lastSeenTime < 0.1) || (state.time - state.lastSeenTime < 12);
  for (const npc of state.npcs){
    if (npc.type !== 'scout'){
      npc.activeTarget = npc.waypoints[npc.wpIndex];
      continue;
    }

    const aggression = Math.max(threatFactor, huntFactor);
    npc.speed = npc.baseSpeed * (1 + 0.45 * threatFactor + 0.25 * huntFactor);
    npc.fovRange = npc.baseFovRange + 120 * threatFactor + 90 * huntFactor;
    npc.fovAngle = npc.baseFovAngle * (1.05 + 0.15 * threatFactor + 0.12 * huntFactor);

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

        if ((seenRecently && aggression > 0.2) || huntFactor > 0.55){
          const radius = 80 + 240 * aggression;
          chosen = randomPointAround(state.lastSeenAt, radius);
          expire = state.time + 6 + 6 * aggression;
        } else if (threatFactor > 0.45 || huntFactor > 0.35){
          const anchor = threatFactor > 0.75 ? state.player : {
            x: mainVillage.x + mainVillage.w / 2,
            y: mainVillage.y + mainVillage.h / 2
          };
          const radius = 140 + 320 * (0.6 * threatFactor + 0.4 * huntFactor);
          chosen = randomPointAround(anchor, radius);
          expire = state.time + 5 + 4 * (0.6 * threatFactor + 0.4 * huntFactor);
        } else if (state.timeSinceSeen > 20){
          const roamAnchor = {
            x: mainVillage.x + mainVillage.w / 2,
            y: mainVillage.y + mainVillage.h / 2
          };
          const radius = 120 + 200 * (1 - huntFactor);
          chosen = randomPointAround(roamAnchor, radius + Math.random() * 80);
          expire = state.time + 4 + 2 * (1 - huntFactor);
        }

        if (chosen){
          npc.dynamicTarget = chosen;
          npc.dynamicTargetExpire = expire;
          npc.searchCooldown = 2.5 + Math.random() * (2 - huntFactor);
        } else {
          npc.searchCooldown = 1.5 + Math.random() * (2.5 - huntFactor);
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
