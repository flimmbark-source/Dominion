import { state, mainVillage } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { segBlockedByAnyRect } from '../utils/geometry.js';
import { TAU, clamp } from '../utils/math.js';
import { gatherForestSolidsAround } from '../world/terrain.js';
import { toast } from '../ui/toast.js';
import { forEachVillageInstance, prepareVillageInstances, getVillageInstance } from '../world/villageTemplates.js';

const MELEE_RANGE_BONUS = 8;

const NPC_STATE = Object.freeze({
  PATROL: 'PATROL',
  SUSPICIOUS: 'SUSPICIOUS',
  ALERT: 'ALERT',
  SEARCH: 'SEARCH'
});

const NPC_ARCHETYPES = {
  villager: {
    speed: 36,
    fovAngle: Math.PI / 2,
    fovRange: 120,
    maxHealth: 45,
    attackable: false,
    faction: 'village',
    displayName: 'villager',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [2.2, 3.6],
    investigateDuration: 2.4,
    hearingRadius: 110
  },
  merchant: {
    speed: 0,
    fovAngle: Math.PI,
    fovRange: 100,
    maxHealth: 50,
    attackable: false,
    faction: 'village',
    displayName: 'merchant',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [999, 999], // Never moves
    investigateDuration: 0,
    hearingRadius: 0,
    stationary: true
  },
  scout: {
    speed: 62,
    fovAngle: Math.PI / 3,
    fovRange: 220,
    maxHealth: 90,
    attackable: true,
    backstabOnly: true,
    backstabMultiplier: 3.2,
    rewardGold: 30,
    threatOnDefeat: 25,
    attack: {
      range: 48,
      damage: 18,
      cooldown: 1.6,
      message: 'The scout slashes you with a sabre!',
      weaponType: 'sabre'
    },
    faction: 'village',
    displayName: 'scout',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [1.4, 4.2],
    investigateDuration: 3.6,
    hearingRadius: 240
  },
  bogling: {
    speed: 44,
    fovAngle: Math.PI / 2,
    fovRange: 70,
    maxHealth: 15,
    attackable: true,
    backstabMultiplier: 1.8,
    rewardGold: 8,
    attack: {
      range: 42,
      damage: 7,
      cooldown: 1.25,
      message: 'The bogling gnashes at you!',
      weaponType: 'bite'
    },
    faction: 'monster',
    displayName: 'bogling',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [1.2, 2.2],
    investigateDuration: 2,
    hearingRadius: 100
  },
  militia: {
    speed: 52,
    fovAngle: Math.PI / 2,
    fovRange: 200,
    maxHealth: 120,
    attackable: true,
    backstabMultiplier: 2.2,
    rewardGold: 18,
    attack: {
      range: 58,
      damage: 16,
      cooldown: 1.4,
      message: 'The militia guard lashes out with a spear!',
      weaponType: 'spear'
    },
    faction: 'village',
    displayName: 'militia guard',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [0.6, 1.4],
    investigateDuration: 3.2,
    hearingRadius: 220
  },
  raider: {
    speed: 50,
    fovAngle: Math.PI / 2,
    fovRange: 180,
    maxHealth: 90,
    attackable: true,
    rewardGold: 22,
    attack: {
      range: 54,
      damage: 14,
      cooldown: 1.5,
      message: 'A dark raider strikes you down!',
      weaponType: 'axe'
    },
    faction: 'darkLord',
    displayName: 'dark raider',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [0.4, 1.1],
    investigateDuration: 2.4,
    hearingRadius: 200
  },
  tank: {
    speed: 32,
    fovAngle: Math.PI / 1.8,
    fovRange: 160,
    maxHealth: 250,
    attackable: true,
    backstabMultiplier: 1.5,
    rewardGold: 40,
    attack: {
      range: 75,
      damage: 22,
      cooldown: 2.2,
      message: 'The armored brute slams you with devastating force!',
      weaponType: 'smash',
      aoe: true,
      aoeRadius: 75
    },
    faction: 'darkLord',
    displayName: 'armored brute',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [1.0, 2.0],
    investigateDuration: 4.5,
    hearingRadius: 180,
    relentless: true
  },
  priest: {
    speed: 40,
    fovAngle: Math.PI / 2.2,
    fovRange: 200,
    maxHealth: 70,
    attackable: true,
    backstabMultiplier: 2.0,
    rewardGold: 35,
    attack: {
      range: 120,
      damage: 10,
      cooldown: 3.0,
      message: 'The dark priest curses you with shadowy magic!',
      weaponType: 'magic'
    },
    faction: 'darkLord',
    displayName: 'dark priest',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [1.5, 3.0],
    investigateDuration: 3.0,
    hearingRadius: 220,
    healer: true,
    healCooldown: 8.0,
    healAmount: 40,
    healRange: 150,
    revealRadius: 180,
    revealCooldown: 12.0
  },
  wolf: {
    speed: 70,
    fovAngle: Math.PI / 1.5,
    fovRange: 200,
    maxHealth: 50,
    attackable: true,
    backstabMultiplier: 1.6,
    rewardGold: 15,
    attack: {
      range: 45,
      damage: 12,
      cooldown: 1.1,
      message: 'A wolf lunges and bites you!',
      weaponType: 'bite'
    },
    faction: 'neutral',
    displayName: 'wolf',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [0.5, 1.5],
    investigateDuration: 1.8,
    hearingRadius: 250,
    packBehavior: true,
    packRadius: 300
  },
  spider: {
    speed: 38,
    fovAngle: Math.PI * 1.2,
    fovRange: 140,
    maxHealth: 35,
    attackable: true,
    backstabMultiplier: 1.4,
    rewardGold: 12,
    attack: {
      range: 42,
      damage: 8,
      cooldown: 1.3,
      message: 'A spider strikes with venomous fangs!',
      weaponType: 'bite'
    },
    faction: 'neutral',
    displayName: 'spider',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [2.0, 4.0],
    investigateDuration: 2.5,
    hearingRadius: 100,
    ambush: true,
    webCooldown: 15.0,
    webDuration: 3.0
  },
  bear: {
    speed: 48,
    fovAngle: Math.PI / 2,
    fovRange: 180,
    maxHealth: 180,
    attackable: true,
    backstabMultiplier: 1.8,
    rewardGold: 30,
    attack: {
      range: 60,
      damage: 20,
      cooldown: 1.8,
      message: 'A massive bear mauls you with savage claws!',
      weaponType: 'claw'
    },
    faction: 'neutral',
    displayName: 'bear',
    defaultState: NPC_STATE.PATROL,
    patrolPauseRange: [1.0, 2.5],
    investigateDuration: 3.5,
    hearingRadius: 200,
    territorial: true,
    territoryRadius: 250,
    enrageThreshold: 0.5
  }
};

function makeNPC(type, x, y, waypoints=null, options = {}){
  const config = NPC_ARCHETYPES[type] || NPC_ARCHETYPES.villager;
  const defaultState = config.defaultState || NPC_STATE.PATROL;
  const npc = {
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
    activeTarget: null,
    dialogCooldown: 0,
    lastDialogueLine: null,
    pickpocketCooldown: 0,
    pickpocketed: false,
    maxHealth: config.maxHealth,
    health: config.maxHealth,
    attackable: !!config.attackable,
    backstabOnly: !!config.backstabOnly,
    backstabMultiplier: config.backstabMultiplier ?? 1,
    rewardGold: config.rewardGold ?? 0,
    threatOnDefeat: config.threatOnDefeat ?? 0,
    attack: config.attack
      ? {
        range: (config.attack.range ?? 48) + MELEE_RANGE_BONUS,
        damage: config.attack.damage ?? 0,
        cooldown: Math.max(config.attack.cooldown ?? 1.2, 0.2),
        message: config.attack.message || null,
        weaponType: config.attack.weaponType || 'slash',
        aoe: config.attack.aoe ?? false,
        aoeRadius: config.attack.aoeRadius ?? 0,
        nextReady: 0,
        nextMessage: 0
      }
      : null,
    faction: options.faction || config.faction || 'village',
    displayName: options.displayName || config.displayName || type,
    behaviorState: options.behaviorState || defaultState,
    stateSince: state.time,
    pauseTimer: 0,
    holdPosition: false,
    investigationTimer: 0,
    investigateTarget: null,
    arrivedAtInvestigation: false,
    searchRoute: null,
    searchIndex: 0,
    noiseResponseCooldown: 0,
    assistanceCooldown: 0,
    assignedNoiseId: null,
    lastHeardNoiseAt: null,
    lastKnownPlayer: { x, y, time: -Infinity },
    sawPlayerAt: -Infinity,
    patrolPauseRange: config.patrolPauseRange || [1.2, 2.8],
    investigateDuration: config.investigateDuration || 2.8,
    hearingRadius: config.hearingRadius || 120,
    role: options.role ?? null,
    homeVillage: options.homeVillage ?? null,
    targetVillage: options.targetVillage ?? null,
    raidGoal: options.raidGoal ?? null,
    chasingTarget: null,
    activeTargetIsChase: false,
    activeTargetBeforeChase: null,
    attackSwing: null,
    // Special behavior flags
    relentless: config.relentless ?? false,
    healer: config.healer ?? false,
    healCooldown: config.healCooldown ?? 0,
    healAmount: config.healAmount ?? 0,
    healRange: config.healRange ?? 0,
    nextHealReady: 0,
    revealRadius: config.revealRadius ?? 0,
    revealCooldown: config.revealCooldown ?? 0,
    nextRevealReady: 0,
    packBehavior: config.packBehavior ?? false,
    packRadius: config.packRadius ?? 0,
    ambush: config.ambush ?? false,
    webCooldown: config.webCooldown ?? 0,
    webDuration: config.webDuration ?? 0,
    nextWebReady: 0,
    territorial: config.territorial ?? false,
    territoryRadius: config.territoryRadius ?? 0,
    territoryCenter: { x, y },
    enrageThreshold: config.enrageThreshold ?? 0,
    enraged: false
  };

  if (typeof options.initialPause === 'number' && options.initialPause > 0){
    npc.pauseTimer = Math.max(npc.pauseTimer, options.initialPause);
    npc.holdPosition = true;
  }

  if (options.holdPosition === false){
    npc.holdPosition = false;
  }

  return npc;
}

let nextNoiseId = 1;

function offsetPoint(villageIndex, x, y){
  const v = VILLAGES[villageIndex];
  return { x: v.x + x, y: v.y + y };
}

function offsetWaypoints(villageIndex, pts){
  return pts.map(pt => offsetPoint(villageIndex, pt.x, pt.y));
}

function addVillageNPC(type, villageIndex, x, y, localWaypoints, options = {}){
  const origin = offsetPoint(villageIndex, x, y);
  const worldWaypoints = localWaypoints ? offsetWaypoints(villageIndex, localWaypoints) : null;
  const spawnOptions = { homeVillage: villageIndex, ...options };
  const npc = makeNPC(type, origin.x, origin.y, worldWaypoints, spawnOptions);
  state.npcs.push(npc);
  return npc;
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
  prepareVillageInstances();

  forEachVillageInstance((instance, villageIndex) => {
    for (const patrol of instance.patrols){
      const spawn = patrol.localSpawn || (patrol.localRoute?.[0]);
      if (!spawn) continue;
      const route = patrol.localRoute?.length ? patrol.localRoute : [{ x: spawn.x, y: spawn.y }];
      const type = patrol.type || 'villager';
      addVillageNPC(type, villageIndex, spawn.x, spawn.y, route);
    }
  });

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

function buildSearchRoute(anchor, radius = 140, steps = 3){
  const base = anchor || state.lastSeenAt || {
    x: mainVillage.x + mainVillage.w / 2,
    y: mainVillage.y + mainVillage.h / 2
  };
  const route = [{ x: base.x, y: base.y }];
  for (let i = 0; i < steps; i++){
    const swing = radius * (0.6 + Math.random() * 0.6);
    route.push(randomPointAround(base, swing));
  }
  route.push({ x: base.x, y: base.y });
  return route;
}

function setNPCState(npc, newState, options = {}){
  // Villagers and merchants should NEVER enter ALERT state - they are peaceful NPCs
  if ((npc.type === 'villager' || npc.type === 'merchant') && newState === NPC_STATE.ALERT){
    return false; // Block ALL ALERT state transitions for villagers/merchants
  }

  const previous = npc.behaviorState;
  const forced = !!options.force;
  const changed = forced || previous !== newState;
  if (!changed){
    if (newState === NPC_STATE.SUSPICIOUS && options.target){
      npc.investigateTarget = { x: options.target.x, y: options.target.y, noiseId: options.target.noiseId ?? null };
      npc.assignedNoiseId = options.target.noiseId ?? npc.assignedNoiseId;
      npc.investigationTimer = options.investigationTimer ?? npc.investigateDuration;
      npc.arrivedAtInvestigation = false;
    }
    if (newState === NPC_STATE.SEARCH && options.route){
      npc.searchRoute = options.route;
      npc.searchIndex = 0;
    }
    return false;
  }

  npc.behaviorState = newState;
  npc.stateSince = state.time;
  npc.activeTarget = null;
  npc.pauseTimer = 0;
  npc.holdPosition = false;
  npc.arrivedAtInvestigation = false;

  if (newState === NPC_STATE.SUSPICIOUS){
    npc.investigateTarget = options.target ? { x: options.target.x, y: options.target.y, noiseId: options.target.noiseId ?? null } : null;
    npc.assignedNoiseId = options.target?.noiseId ?? null;
    npc.investigationTimer = options.investigationTimer ?? npc.investigateDuration;
  } else {
    npc.investigateTarget = null;
    npc.investigationTimer = 0;
    npc.assignedNoiseId = null;
  }

  if (newState === NPC_STATE.SEARCH){
    npc.searchRoute = options.route || null;
    npc.searchIndex = 0;
  } else {
    npc.searchRoute = null;
    npc.searchIndex = 0;
  }

  if (newState === NPC_STATE.ALERT){
    npc.pauseTimer = 0;
  }

  if (npc.type === 'scout'){
    const reason = options.reason ? ` (${options.reason})` : '';
    console.debug(`[AI] ${npc.displayName || npc.type} -> ${newState}${reason} @${state.time.toFixed(2)}`);
  }

  return true;
}

function assignNoise(npc, event){
  const changed = setNPCState(npc, NPC_STATE.SUSPICIOUS, {
    target: { x: event.x, y: event.y, noiseId: event.id },
    investigationTimer: event.investigateFor ?? npc.investigateDuration,
    reason: `noise:${event.type || 'unknown'}`,
    force: true
  });
  npc.noiseResponseCooldown = Math.max(npc.noiseResponseCooldown, event.cooldown ?? 5);
  npc.lastHeardNoiseAt = { x: event.x, y: event.y, time: state.time };
  return changed;
}

function broadcastAlarm(sourceNpc, anchor){
  const now = state.time;
  const focus = anchor || state.lastSeenAt || { x: sourceNpc.x, y: sourceNpc.y };
  state.alarmLevel = Math.min((state.alarmLevel || 0) + 1, 3);
  state.alarmUntil = now + 16;

  for (const npc of state.npcs){
    if (npc === sourceNpc) continue;
    if (npc.type !== 'scout') continue;
    if (npc.behaviorState === NPC_STATE.ALERT) continue;
    const dist = Math.hypot(npc.x - focus.x, npc.y - focus.y);
    if (dist > 520 && state.alarmLevel < 3) continue;
    const route = buildSearchRoute(focus, 180, 4);
    setNPCState(npc, NPC_STATE.SEARCH, { route, reason: 'alarm_broadcast', force: true });
  }
}

function queueNoiseEvent(options){
  const now = state.time;
  const event = {
    id: nextNoiseId++,
    x: options.x,
    y: options.y,
    radius: options.radius ?? 180,
    source: options.source || 'unknown',
    type: options.type || 'noise',
    createdAt: now,
    expiresAt: now + (options.duration ?? 6),
    investigateFor: options.investigateFor ?? 3,
    maxResponders: options.maxResponders ?? 1,
    cooldown: options.cooldown ?? 5,
    assigned: []
  };
  state.noiseEvents.push(event);
  if (options.debug !== false){
    console.debug(`[AI] Noise '${event.type}' at (${event.x.toFixed(1)}, ${event.y.toFixed(1)}) r=${event.radius}`);
  }
  return event.id;
}

function notifyNPCPlayerSpotted(npc, location){
  npc.sawPlayerAt = state.time;
  npc.lastKnownPlayer = { x: location.x, y: location.y, time: state.time };
  const changed = setNPCState(npc, NPC_STATE.ALERT, { reason: 'player_spotted' });
  if (!npc.activeTarget) npc.activeTarget = { x: location.x, y: location.y };
  npc.activeTarget.x = location.x;
  npc.activeTarget.y = location.y;
  if ((changed || npc.assistanceCooldown <= 0) && npc.type === 'scout'){
    broadcastAlarm(npc, location);
    npc.assistanceCooldown = 4.5;
  }
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

  // Castle spawns should be Dark Lord faction, not village
  const npc = makeNPC('scout', entry.x, entry.y, patrol, { faction: 'darkLord' });
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

function findBarracksAnchor(instance){
  if (!instance) return null;
  const barracks = instance.template?.houses?.find(h => h.id === 'barracks');
  if (barracks){
    return {
      x: barracks.x + barracks.w / 2,
      y: barracks.y + barracks.h / 2
    };
  }
  return {
    x: instance.village.w / 2,
    y: instance.village.h / 2 + 60
  };
}

function spawnVillageDefender(villageIndex, options = {}){
  const instance = getVillageInstance(villageIndex);
  if (!instance) return null;
  const anchor = options.localPosition || findBarracksAnchor(instance);
  if (!anchor) return null;
  const patrolRadius = options.patrolRadius ?? 90;
  const route = options.localRoute || [
    { x: anchor.x + patrolRadius, y: anchor.y },
    { x: anchor.x, y: anchor.y + patrolRadius * 0.6 },
    { x: anchor.x - patrolRadius, y: anchor.y },
    { x: anchor.x, y: anchor.y - patrolRadius * 0.6 }
  ];
  const npc = addVillageNPC('militia', villageIndex, anchor.x, anchor.y, route, {
    role: 'defender',
    faction: 'village'
  });
  if (npc){
    npc.patrolPauseRange = [0.45, 1.1];
  }
  return npc;
}

function spawnDarkRaid(targetVillageIndex, count, options = {}){
  const targetVillage = VILLAGES[targetVillageIndex];
  if (!targetVillage || count <= 0) return 0;
  const muster = {
    x: state.castle.x - 140,
    y: state.castle.y + (options.musterOffset ?? 20)
  };
  const targetCenter = {
    x: targetVillage.x + targetVillage.w / 2,
    y: targetVillage.y + targetVillage.h / 2
  };
  let spawned = 0;
  for (let i = 0; i < count; i++){
    const spread = (i - (count - 1) / 2) * 18;
    const spawnX = state.castle.x - 60 - Math.random() * 60;
    const spawnY = state.castle.y + spread;
    const rally = {
      x: muster.x + Math.random() * 80 - 40,
      y: muster.y + Math.random() * 80 - 40
    };
    const strike = {
      x: targetCenter.x + Math.random() * 160 - 80,
      y: targetCenter.y + Math.random() * 160 - 80
    };
    const approach = {
      x: targetCenter.x + Math.random() * 60 - 30,
      y: targetCenter.y + Math.random() * 60 - 30
    };
    const waypoints = [rally, strike, approach];
    const npc = makeNPC('raider', spawnX, spawnY, waypoints, {
      faction: 'darkLord',
      role: 'raider',
      targetVillage: targetVillageIndex,
      raidGoal: approach,
      initialPause: 2 + Math.random(),
      behaviorState: NPC_STATE.PATROL
    });
    npc.patrolPauseRange = [0.3, 0.8];
    state.npcs.push(npc);
    spawned++;
  }
  if (spawned > 0 && options.announce !== false){
    toast(`The Dark Lord musters ${spawned} raiders against ${targetVillage.name}!`, 3);
  }
  return spawned;
}

function onNpcRemoved(npc, options = {}){
  if (npc.role === 'defender' && typeof npc.homeVillage === 'number'){
    const garrison = state.villageDefense?.[npc.homeVillage];
    if (garrison){
      garrison.activeDefenders = Math.max(0, garrison.activeDefenders - 1);
    }
  }
  if (npc.role === 'raider' && typeof npc.targetVillage === 'number' && state.darkStrategy){
    const remaining = state.npcs.some(other => other !== npc && other.role === 'raider' && other.targetVillage === npc.targetVillage);
    if (!remaining && state.darkStrategy.raidTarget === npc.targetVillage){
      state.darkStrategy.raidTarget = null;
      state.darkStrategy.raidCooldown = Math.max(state.darkStrategy.raidCooldown || 0, 8);
      state.darkStrategy.musterGoal = Math.min(14, (state.darkStrategy.musterGoal || 4) + 1);
      if (options.silent !== true){
        toast(`${VILLAGES[npc.targetVillage].name} drives off the raiders!`, 2.6);
      }
    }
  }
}

function removeNPC(npc, options = {}){
  const idx = state.npcs.indexOf(npc);
  if (idx === -1) return false;
  state.npcs.splice(idx, 1);
  onNpcRemoved(npc, options);
  return true;
}

function updateNPCBehaviors(dt){
  const now = state.time;
  const threatFactor = clamp(state.threat / 200, 0, 1);
  const huntFactor = clamp(state.huntHeat || 0, 0, 1);

  if (state.alarmLevel > 0 && now >= state.alarmUntil){
    state.alarmLevel = 0;
  }

  state.noiseEvents = state.noiseEvents.filter(ev => now <= ev.expiresAt);
  const scouts = [];
  const villageFighters = [];
  const darkFighters = [];

  const applyChase = (npc, target) => {
    if (target){
      if (!npc.activeTargetIsChase){
        npc.activeTargetBeforeChase = npc.activeTarget;
      }
      npc.chasingTarget = target;
      npc.activeTarget = target;
      npc.activeTargetIsChase = true;
    } else {
      npc.chasingTarget = null;
      if (npc.activeTargetIsChase){
        npc.activeTargetIsChase = false;
        npc.activeTarget = npc.activeTargetBeforeChase || npc.waypoints?.[npc.wpIndex] || npc.activeTarget;
        npc.activeTargetBeforeChase = null;
      }
    }
  };

  for (const npc of state.npcs){
    npc.pauseTimer = Math.max(0, npc.pauseTimer - dt);
    if (npc.assistanceCooldown > 0) npc.assistanceCooldown = Math.max(0, npc.assistanceCooldown - dt);
    if (npc.noiseResponseCooldown > 0) npc.noiseResponseCooldown = Math.max(0, npc.noiseResponseCooldown - dt);

    if (npc.attack){
      // Never add villagers or merchants to combat groups - they are peaceful
      if (npc.type === 'villager' || npc.type === 'merchant') continue;

      if (npc.faction === 'village'){
        villageFighters.push(npc);
      } else if (npc.faction === 'darkLord' || npc.faction === 'monster'){
        darkFighters.push(npc);
      }
    }

    if (npc.behaviorState === NPC_STATE.SUSPICIOUS && npc.arrivedAtInvestigation){
      npc.investigationTimer = Math.max(0, npc.investigationTimer - dt);
    }

    if (npc.behaviorState === NPC_STATE.PATROL && npc.holdPosition && npc.pauseTimer <= 0){
      npc.holdPosition = false;
      npc.wpIndex = (npc.wpIndex + 1) % npc.waypoints.length;
    }

    if (npc.type === 'scout'){
      scouts.push(npc);
      const aggression = Math.max(threatFactor, huntFactor);
      npc.speed = npc.baseSpeed * (1 + 0.45 * threatFactor + 0.25 * huntFactor);
      npc.fovRange = npc.baseFovRange + 120 * threatFactor + 90 * huntFactor;
      npc.fovAngle = npc.baseFovAngle * (1.05 + 0.15 * threatFactor + 0.12 * huntFactor);

      if (npc.behaviorState === NPC_STATE.ALERT){
        if (!npc.activeTarget) npc.activeTarget = { x: state.player.x, y: state.player.y };
        npc.activeTarget.x = state.player.x;
        npc.activeTarget.y = state.player.y;
        npc.pauseTimer = 0;
        if (now - npc.sawPlayerAt > 1.75){
          const anchor = npc.lastKnownPlayer?.time ? npc.lastKnownPlayer : state.lastSeenAt;
          const route = buildSearchRoute(anchor, 160, 4);
          setNPCState(npc, NPC_STATE.SEARCH, { route, reason: 'lost_visual', force: true });
        }
      } else if (npc.behaviorState === NPC_STATE.SUSPICIOUS){
        if (!npc.investigateTarget){
          setNPCState(npc, NPC_STATE.PATROL, { reason: 'no_noise' });
        } else if (npc.arrivedAtInvestigation && npc.investigationTimer <= 0){
          const anchor = npc.investigateTarget || npc.lastKnownPlayer || state.lastSeenAt;
          const route = buildSearchRoute(anchor, 120, 3);
          setNPCState(npc, NPC_STATE.SEARCH, { route, reason: 'investigation_clear', force: true });
        }
      } else if (npc.behaviorState === NPC_STATE.SEARCH){
        if (!npc.searchRoute){
          npc.searchRoute = buildSearchRoute(npc.lastKnownPlayer || state.lastSeenAt, 160, 4);
          npc.searchIndex = 0;
        } else if (npc.searchIndex >= npc.searchRoute.length){
          if (state.alarmLevel > 0){
            npc.searchRoute = buildSearchRoute(state.lastSeenAt, 180, 4);
            npc.searchIndex = 0;
          } else if (npc.pauseTimer <= 0){
            setNPCState(npc, NPC_STATE.PATROL, { reason: 'search_done' });
          }
        }
      }

      switch (npc.behaviorState){
        case NPC_STATE.PATROL:
          npc.activeTarget = npc.waypoints[npc.wpIndex];
          break;
        case NPC_STATE.SUSPICIOUS:
          npc.activeTarget = (npc.arrivedAtInvestigation && npc.pauseTimer > 0)
            ? { x: npc.x, y: npc.y }
            : (npc.investigateTarget || npc.waypoints[npc.wpIndex]);
          break;
        case NPC_STATE.SEARCH:
          if (npc.searchRoute && npc.searchIndex < npc.searchRoute.length){
            npc.activeTarget = npc.searchRoute[npc.searchIndex];
          } else {
            npc.activeTarget = npc.waypoints[npc.wpIndex];
          }
          break;
        case NPC_STATE.ALERT:
          break;
        default:
          npc.activeTarget = npc.waypoints[npc.wpIndex];
          break;
      }
    } else {
      // Non-scout NPCs (villagers, merchants, etc.) just follow their patrol routes
      // FORCE villagers/merchants to NEVER chase the player - nuclear option
      if (npc.type === 'villager' || npc.type === 'merchant') {
        // Force state to PATROL if not already
        if (npc.behaviorState !== NPC_STATE.PATROL) {
          npc.behaviorState = NPC_STATE.PATROL;
          npc.stateSince = now;
        }
        // Force target to waypoint, never to player
        npc.activeTarget = npc.waypoints[npc.wpIndex];
        // Clear any chase-related flags
        npc.chasingTarget = null;
        npc.activeTargetIsChase = false;
      } else {
        npc.activeTarget = npc.waypoints[npc.wpIndex];
      }
    }
  }

  const assignHostileTargets = (attackers, opponents) => {
    for (const actor of attackers){
      if (!actor.attackable && !actor.attack) continue;
      if (actor.chasingTarget && !state.npcs.includes(actor.chasingTarget)){
        applyChase(actor, null);
      }
      let chosen = null;
      let bestDist = Infinity;
      const detectionRange = (actor.fovRange || 140) + 90;
      for (const foe of opponents){
        if (!state.npcs.includes(foe)) continue;
        const dist = Math.hypot(foe.x - actor.x, foe.y - actor.y);
        if (dist < bestDist && dist <= detectionRange){
          bestDist = dist;
          chosen = foe;
        }
      }
      if (chosen){
        if (actor.chasingTarget !== chosen){
          applyChase(actor, chosen);
          if (actor.behaviorState !== NPC_STATE.ALERT){
            setNPCState(actor, NPC_STATE.ALERT, { reason: 'hostile_detected', force: true });
          }
        }
      } else if (actor.chasingTarget){
        applyChase(actor, null);
        if (actor.role === 'raider'){
          setNPCState(actor, NPC_STATE.PATROL, { reason: 'hostile_lost', force: true });
        }
      }
    }
  };

  if (villageFighters.length && darkFighters.length){
    assignHostileTargets(villageFighters, darkFighters);
    assignHostileTargets(darkFighters, villageFighters);
  } else {
    for (const actor of villageFighters.concat(darkFighters)){
      if (actor.chasingTarget){
        applyChase(actor, null);
      }
    }
  }

  for (const event of state.noiseEvents){
    const maxResponders = event.maxResponders ?? 1;
    event.assigned = event.assigned?.filter(Boolean) || [];
    if (event.assigned.length >= maxResponders) continue;

    const candidates = [];
    for (const npc of scouts){
      if (event.assigned.includes(npc)) continue;
      if (npc.behaviorState === NPC_STATE.ALERT) continue;
      if (npc.noiseResponseCooldown > 0) continue;
      const radius = event.radius ?? npc.hearingRadius;
      const dist = Math.hypot(npc.x - event.x, npc.y - event.y);
      if (dist > radius) continue;
      if (segBlockedByAnyRect(npc.x, npc.y, event.x, event.y, state.houseSolids)) continue;
      candidates.push({ npc, dist });
    }

    candidates.sort((a, b) => a.dist - b.dist);

    while (event.assigned.length < maxResponders && candidates.length){
      const { npc } = candidates.shift();
      assignNoise(npc, event);
      event.assigned.push(npc);
    }
  }
}

export {
  NPC_STATE,
  makeNPC,
  addVillageNPC,
  patchPatrolRoutes,
  setupInitialNPCs,
  npcSeesPlayer,
  spawnReinforcement,
  spawnVillageDefender,
  spawnDarkRaid,
  removeNPC,
  updateNPCBehaviors,
  queueNoiseEvent,
  notifyNPCPlayerSpotted,
  setNPCState
};
