import { state } from '../state/gameState.js';
import { VILLAGES } from '../data/world.js';
import { getVillageInstance } from '../world/villageTemplates.js';
import { spawnVillageDefender, spawnDarkRaid } from '../npc/npcManager.js';
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
  const spawned = spawnDarkRaid(targetIndex, waveSize, { announce: false });
  if (spawned > 0){
    strategy.muster = Math.max(0, strategy.muster - spawned * 0.7);
    strategy.raidTarget = targetIndex;
    strategy.raidCooldown = 24 + Math.random() * 10;
    strategy.musterGoal = Math.min(14, strategy.musterGoal + 1);
    toast(`The Dark Lord masses ${spawned} raiders to assault ${VILLAGES[targetIndex].name}!`, 3.4);
  } else {
    strategy.raidCooldown = 10;
  }
}

function updateWar(dt){
  ensureWarState();
  updateVillageDefense();
  updateDarkStrategy(dt);
}

export { initWarState, updateWar };
