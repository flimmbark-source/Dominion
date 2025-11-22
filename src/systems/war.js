import { state } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { getVillageInstance } from '../world/villageTemplates.js';
import { spawnVillageDefender, spawnDarkRaid, makeNPC } from '../npc/npcManager.js';
import { toast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';

function initWarState(options = {}){
  state.villageDefense = VILLAGES.map((village, index) => {
    const instance = getVillageInstance(index);
    const hasBarracks = !!instance?.template?.houses?.some(h => h.id === 'barracks');
    return {
      hasBarracks,
      activeDefenders: 0,
      maxDefenders: hasBarracks ? 6 : 4,
      spawnInterval: hasBarracks ? 18 : 28,
      nextSpawnAt: state.time + 18 + Math.random() * 10,
      announced: false
    };
  });

  state.npcs.forEach(npc => {
    if (npc.role === 'defender' && typeof npc.homeVillage === 'number'){
      const garrison = state.villageDefense[npc.homeVillage];
      if (garrison){
        garrison.activeDefenders = Math.min(garrison.maxDefenders, garrison.activeDefenders + 1);
      }
    }
  });

  state.darkStrategy = {
    muster: 0,
    musterGoal: 4,
    musterRate: 0.35,
    raidTarget: null,
    raidCooldown: 12
  };

  if (options.announceBarracks){
    state.villageDefense.forEach((defense, index) => {
      if (defense.hasBarracks){
        toast(`${VILLAGES[index].name} raises a Barracks to train defenders.`, 2.8);
      }
    });
  }
}

function ensureWarState(){
  if (!Array.isArray(state.villageDefense) || state.villageDefense.length !== VILLAGES.length || !state.darkStrategy){
    initWarState();
  }
}

function pickRaidTarget(){
  let bestIndex = 0;
  let bestScore = Infinity;
  state.villageDefense.forEach((defense, index) => {
    const defenderWeight = defense.activeDefenders / Math.max(1, defense.maxDefenders);
    const barracksTax = defense.hasBarracks ? 0.6 : 0;
    const score = defenderWeight + barracksTax + Math.random() * 0.15;
    if (score < bestScore){
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function updateVillageDefense(){
  state.villageDefense.forEach((defense, index) => {
    if (defense.activeDefenders >= defense.maxDefenders) return;
    if (state.time < defense.nextSpawnAt) return;
    const npc = spawnVillageDefender(index);
    if (npc){
      defense.activeDefenders = Math.min(defense.maxDefenders, defense.activeDefenders + 1);
      const cooldown = defense.spawnInterval * (defense.hasBarracks ? 0.82 : 1.0);
      defense.nextSpawnAt = state.time + cooldown;
      if (!defense.announced){
        if (defense.hasBarracks){
          toast(`${VILLAGES[index].name}'s Barracks drills new defenders.`, 2.8);
        } else {
          toast(`${VILLAGES[index].name} raises a village militia.`, 2.6);
        }
        defense.announced = true;
      }
    } else {
      defense.nextSpawnAt = state.time + 12;
    }
  });
}

function updateDarkStrategy(dt){
  const strategy = state.darkStrategy;
  if (!strategy) return;

  if (strategy.raidCooldown > 0){
    strategy.raidCooldown = Math.max(0, strategy.raidCooldown - dt);
  }

  const pressure = clamp(((state.threat ?? 0) / 160) + (state.huntHeat ?? 0), 0, 1.5);
  strategy.muster = clamp(strategy.muster + (strategy.musterRate + 0.25 * pressure) * dt, 0, 22);

  if (strategy.raidTarget !== null){
    const stillActive = state.npcs.some(npc => npc.role === 'raider' && npc.targetVillage === strategy.raidTarget);
    if (!stillActive){
      strategy.raidTarget = null;
    } else {
      return;
    }
  }

  if (strategy.muster < strategy.musterGoal) return;
  if (strategy.raidCooldown > 0) return;

  const targetIndex = pickRaidTarget();
  const waveSize = Math.max(strategy.musterGoal, Math.round(strategy.muster * 0.8));

  // Use enhanced raid with tanks and priests for larger waves
  const spawned = waveSize >= 6
    ? spawnEnhancedRaid(targetIndex, waveSize)
    : spawnDarkRaid(targetIndex, waveSize, { announce: false });

  if (spawned > 0){
    strategy.muster = Math.max(0, strategy.muster - spawned * 0.7);
    strategy.raidTarget = targetIndex;
    strategy.raidCooldown = 24 + Math.random() * 10;
    strategy.musterGoal = Math.min(14, strategy.musterGoal + 1);
    const raidType = waveSize >= 6 ? 'a massive force' : `${spawned} raiders`;
    toast(`The Dark Lord masses ${raidType} to assault ${VILLAGES[targetIndex].name}!`, 3.4);
  } else {
    strategy.raidCooldown = 10;
  }
}

/**
 * Spawn neutral creatures in the world
 */
function spawnNeutralCreatures() {
  if (!state.neutralCreaturesSpawned) {
    state.neutralCreaturesSpawned = true;

    // Spawn wolf packs in forest areas
    const wolfPacks = [
      { x: WORLD.W * 0.2, y: WORLD.H * 0.3 },
      { x: WORLD.W * 0.7, y: WORLD.H * 0.2 },
      { x: WORLD.W * 0.4, y: WORLD.H * 0.7 }
    ];

    for (const pack of wolfPacks) {
      const packSize = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < packSize; i++) {
        const offsetX = (Math.random() - 0.5) * 100;
        const offsetY = (Math.random() - 0.5) * 100;
        const patrol = [
          { x: pack.x + offsetX, y: pack.y + offsetY },
          { x: pack.x + offsetX + 80, y: pack.y + offsetY + 60 },
          { x: pack.x + offsetX - 80, y: pack.y + offsetY + 60 }
        ];
        const wolf = makeNPC('wolf', pack.x + offsetX, pack.y + offsetY, patrol);
        state.npcs.push(wolf);
      }
    }

    // Spawn spiders in dark corners
    const spiderNests = [
      { x: WORLD.W * 0.15, y: WORLD.H * 0.8 },
      { x: WORLD.W * 0.85, y: WORLD.H * 0.4 },
      { x: WORLD.W * 0.5, y: WORLD.H * 0.15 }
    ];

    for (const nest of spiderNests) {
      const nestSize = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < nestSize; i++) {
        const offsetX = (Math.random() - 0.5) * 60;
        const offsetY = (Math.random() - 0.5) * 60;
        const patrol = [
          { x: nest.x + offsetX, y: nest.y + offsetY }
        ];
        const spider = makeNPC('spider', nest.x + offsetX, nest.y + offsetY, patrol);
        state.npcs.push(spider);
      }
    }

    // Spawn bears in territorial zones
    const bearTerritories = [
      { x: WORLD.W * 0.3, y: WORLD.H * 0.5 },
      { x: WORLD.W * 0.65, y: WORLD.H * 0.65 }
    ];

    for (const territory of bearTerritories) {
      const patrol = [
        { x: territory.x, y: territory.y },
        { x: territory.x + 100, y: territory.y },
        { x: territory.x + 50, y: territory.y + 100 }
      ];
      const bear = makeNPC('bear', territory.x, territory.y, patrol);
      state.npcs.push(bear);
    }
  }
}

/**
 * Enhanced dark strategy with tanks and priests
 */
function spawnEnhancedRaid(targetVillageIndex, waveSize) {
  const baseRaiders = Math.floor(waveSize * 0.6);
  const tanks = Math.floor(waveSize * 0.25);
  const priests = Math.floor(waveSize * 0.15);

  const targetVillage = VILLAGES[targetVillageIndex];
  const muster = {
    x: state.castle.x - 140,
    y: state.castle.y + 20
  };
  const targetCenter = {
    x: targetVillage.x + targetVillage.w / 2,
    y: targetVillage.y + targetVillage.h / 2
  };

  let spawned = 0;

  // Spawn raiders
  for (let i = 0; i < baseRaiders; i++) {
    const spread = (i - (baseRaiders - 1) / 2) * 18;
    const spawnX = state.castle.x - 60 - Math.random() * 60;
    const spawnY = state.castle.y + spread;
    const rally = { x: muster.x + Math.random() * 80 - 40, y: muster.y + Math.random() * 80 - 40 };
    const strike = { x: targetCenter.x + Math.random() * 160 - 80, y: targetCenter.y + Math.random() * 160 - 80 };
    const waypoints = [rally, strike];
    const npc = makeNPC('raider', spawnX, spawnY, waypoints, {
      faction: 'darkLord',
      role: 'raider',
      targetVillage: targetVillageIndex,
      initialPause: 2 + Math.random(),
      behaviorState: 'PATROL'
    });
    state.npcs.push(npc);
    spawned++;
  }

  // Spawn tanks
  for (let i = 0; i < tanks; i++) {
    const spread = (i - (tanks - 1) / 2) * 30;
    const spawnX = state.castle.x - 80 - Math.random() * 40;
    const spawnY = state.castle.y + spread;
    const rally = { x: muster.x + Math.random() * 80 - 40, y: muster.y + Math.random() * 80 - 40 };
    const strike = { x: targetCenter.x + Math.random() * 160 - 80, y: targetCenter.y + Math.random() * 160 - 80 };
    const waypoints = [rally, strike];
    const npc = makeNPC('tank', spawnX, spawnY, waypoints, {
      faction: 'darkLord',
      role: 'raider',
      targetVillage: targetVillageIndex,
      initialPause: 2 + Math.random(),
      behaviorState: 'PATROL'
    });
    state.npcs.push(npc);
    spawned++;
  }

  // Spawn priests
  for (let i = 0; i < priests; i++) {
    const spread = (i - (priests - 1) / 2) * 25;
    const spawnX = state.castle.x - 70 - Math.random() * 50;
    const spawnY = state.castle.y + spread;
    const rally = { x: muster.x + Math.random() * 80 - 40, y: muster.y + Math.random() * 80 - 40 };
    const strike = { x: targetCenter.x + Math.random() * 160 - 80, y: targetCenter.y + Math.random() * 160 - 80 };
    const waypoints = [rally, strike];
    const npc = makeNPC('priest', spawnX, spawnY, waypoints, {
      faction: 'darkLord',
      role: 'raider',
      targetVillage: targetVillageIndex,
      initialPause: 2 + Math.random(),
      behaviorState: 'PATROL'
    });
    state.npcs.push(npc);
    spawned++;
  }

  return spawned;
}

function updateWar(dt){
  ensureWarState();
  updateVillageDefense();
  updateDarkStrategy(dt);
  spawnNeutralCreatures();
}

export { initWarState, updateWar };
