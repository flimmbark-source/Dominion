import { state } from '../state/gameState.js';
import { VILLAGES } from '../data/world.js';
import { getVillageInstance } from '../world/villageTemplates.js';
import { spawnVillageDefender, spawnDarkRaid } from '../npc/npcManager.js';
import { toast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';
import {
  registerWorldStateListener,
  getNormalizedGuardStrength,
  getNormalizedGuardAlertness,
  getSuspicionFactor,
  getPopulationHealthFactor,
  getReinforcementDelayFactor
} from './worldState.js';

function tuneVillageDefensePosture(){
  if (!Array.isArray(state.villageDefense)) return;
  const strength = getNormalizedGuardStrength();
  const alertness = getNormalizedGuardAlertness();
  for (const defense of state.villageDefense){
    if (!defense) continue;
    const baseMax = defense.hasBarracks ? 6 : 4;
    const baseInterval = defense.hasBarracks ? 18 : 28;
    const bonusSlots = Math.round(strength * (defense.hasBarracks ? 3 : 2));
    defense.maxDefenders = Math.max(2, baseMax + bonusSlots);
    defense.activeDefenders = Math.min(defense.activeDefenders || 0, defense.maxDefenders);
    const strengthSpeed = clamp(1 - strength * 0.35, 0.55, 1);
    const alertnessSpeed = 1 / clamp(1 + alertness * 0.6, 1, 1.6);
    defense.spawnInterval = Math.max(8, baseInterval * strengthSpeed * alertnessSpeed);
    if (typeof defense.nextSpawnAt === 'number'){
      const urgencyWindow = defense.spawnInterval * clamp(0.4 + alertness * 0.35, 0.4, 0.9);
      defense.nextSpawnAt = Math.min(defense.nextSpawnAt, state.time + urgencyWindow);
    }
  }
}

registerWorldStateListener((key) => {
  if (key === 'guardStrength' || key === 'guardAlertness' || key === 'outpostStates' || key === 'reset'){
    tuneVillageDefensePosture();
  }
});

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
    raidCooldown: 12,
    signalSuppressedUntil: 0,
    nextRaidPenalty: null,
    scoutIntelUntil: 0
  };

  tuneVillageDefensePosture();

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

  if (strategy.nextRaidPenalty && strategy.nextRaidPenalty.expiresAt && state.time >= strategy.nextRaidPenalty.expiresAt){
    strategy.nextRaidPenalty = null;
  }

  const pressure = clamp(((state.threat ?? 0) / 160) + (state.huntHeat ?? 0), 0, 1.5);
  const guardStrength = getNormalizedGuardStrength();
  const guardAlertness = getNormalizedGuardAlertness();
  const suspicion = getSuspicionFactor();
  const populationHealth = getPopulationHealthFactor();
  const reinforcementDrag = getReinforcementDelayFactor();

  const suppressionActive = strategy.signalSuppressedUntil && state.time < strategy.signalSuppressedUntil;
  const intelActive = strategy.scoutIntelUntil && state.time < strategy.scoutIntelUntil;
  const gainBase = strategy.musterRate + 0.25 * pressure;
  const suppressionFactor = suppressionActive ? 0.35 : 1;
  const intelFactor = intelActive ? 0.8 : 1;
  const guardPenalty = clamp(1 - (guardStrength * 0.38 + guardAlertness * 0.28), 0.35, 1);
  const unrestBoost = clamp(1 + suspicion * 0.45 + (1 - populationHealth) * 0.35, 0.7, 1.6);
  const reinforcementFactor = clamp(1 - reinforcementDrag * 0.6, 0.25, 1);
  strategy.muster = clamp(
    strategy.muster + gainBase * suppressionFactor * intelFactor * guardPenalty * unrestBoost * reinforcementFactor * dt,
    0,
    22
  );

  if (reinforcementDrag > 0){
    strategy.raidCooldown = Math.max(strategy.raidCooldown, 6 + reinforcementDrag * 18);
  }

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
  let waveSize = Math.max(strategy.musterGoal, Math.round(strategy.muster * 0.8));
  const penaltyInfo = strategy.nextRaidPenalty || null;
  if (penaltyInfo){
    const multiplier = clamp(penaltyInfo.sizeMultiplier ?? 0.7, 0.2, 1);
    waveSize = Math.max(2, Math.round(waveSize * multiplier));
  }

  const spawned = spawnDarkRaid(targetIndex, waveSize, { announce: false });
  if (spawned > 0){
    strategy.muster = Math.max(0, strategy.muster - spawned * 0.7);
    strategy.raidTarget = targetIndex;
    strategy.raidCooldown = 24 + Math.random() * 10;
    strategy.musterGoal = Math.min(14, strategy.musterGoal + 1);
    if (penaltyInfo){
      const name = VILLAGES[targetIndex].name;
      toast(`Poisoned stores cripple the raid on ${name}! Only ${spawned} weakened raiders march.`, 3.6);
      strategy.nextRaidPenalty = null;
    } else {
      toast(`The Dark Lord masses ${spawned} raiders to assault ${VILLAGES[targetIndex].name}!`, 3.4);
    }
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
