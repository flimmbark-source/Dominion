import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';

const WORLD_STATE_RANGES = {
  villageSuspicion: { min: 0, max: 100, default: 12 },
  guardStrength: { min: 0, max: 100, default: 40 },
  guardAlertness: { min: 0, max: 100, default: 28 },
  mapVisibility: { min: 0, max: 1, default: 0.38 },
  darklordReinforcementDelay: { min: 0, max: 180, default: 0 },
  villagePopulationHealth: { min: 0, max: 1, default: 0.9 },
  villageMorale: { min: 0, max: 100, default: 42 },
  villagerTrust: { min: 0, max: 100, default: 8 }
};

const worldStateListeners = new Set();

const DEFAULT_ECONOMY_STATE = {
  status: 'stable',
  damagedAt: -Infinity,
  damageExpiresAt: 0,
  repairWindowEnds: 0,
  blacksmithHostileUntil: 0,
  productionNodes: {},
  guardStrengthDecay: null
};

function notifyWorldStateChange(key, value, previous){
  for (const listener of worldStateListeners){
    try {
      listener(key, value, previous);
    } catch (err){
      console.error('[worldState] listener error', err);
    }
  }
}

function clampMetric(key, value){
  const meta = WORLD_STATE_RANGES[key];
  if (!meta) return value;
  return clamp(value, meta.min, meta.max);
}

function getMetricDefault(key){
  const meta = WORLD_STATE_RANGES[key];
  return meta ? meta.default : undefined;
}

function setMetric(key, value){
  const previous = state[key];
  const next = clampMetric(key, value);
  if (previous === next) return next;
  state[key] = next;
  notifyWorldStateChange(key, next, previous);
  return next;
}

function resetWorldState(){
  for (const key of Object.keys(WORLD_STATE_RANGES)){
    setMetric(key, getMetricDefault(key));
  }
  state.outpostStates = {};
  state.rumorFlags = {};
  state.safehouseAccess = {};
  state.villageEconomy = cloneCleanObject(DEFAULT_ECONOMY_STATE);
  notifyWorldStateChange('outpostStates', state.outpostStates, null);
  notifyWorldStateChange('rumorFlags', state.rumorFlags, null);
  notifyWorldStateChange('safehouseAccess', state.safehouseAccess, null);
  notifyWorldStateChange('villageEconomy', state.villageEconomy, null);
  notifyWorldStateChange('reset', serializeWorldState(), null);
}

function serializeWorldState(){
  return {
    villageSuspicion: state.villageSuspicion,
    guardStrength: state.guardStrength,
    guardAlertness: state.guardAlertness,
    mapVisibility: state.mapVisibility,
    darklordReinforcementDelay: state.darklordReinforcementDelay,
    villagePopulationHealth: state.villagePopulationHealth,
    villageMorale: state.villageMorale,
    villagerTrust: state.villagerTrust,
    outpostStates: JSON.parse(JSON.stringify(state.outpostStates || {})),
    rumorFlags: JSON.parse(JSON.stringify(state.rumorFlags || {})),
    safehouseAccess: JSON.parse(JSON.stringify(state.safehouseAccess || {})),
    villageEconomy: JSON.parse(JSON.stringify(state.villageEconomy || DEFAULT_ECONOMY_STATE))
  };
}

function hydrateWorldState(snapshot = {}){
  if (!snapshot || typeof snapshot !== 'object'){
    resetWorldState();
    return;
  }
  setMetric('villageSuspicion', snapshot.villageSuspicion ?? getMetricDefault('villageSuspicion'));
  setMetric('guardStrength', snapshot.guardStrength ?? getMetricDefault('guardStrength'));
  setMetric('guardAlertness', snapshot.guardAlertness ?? getMetricDefault('guardAlertness'));
  setMetric('mapVisibility', snapshot.mapVisibility ?? getMetricDefault('mapVisibility'));
  setMetric('darklordReinforcementDelay', snapshot.darklordReinforcementDelay ?? getMetricDefault('darklordReinforcementDelay'));
  setMetric('villagePopulationHealth', snapshot.villagePopulationHealth ?? getMetricDefault('villagePopulationHealth'));
  setMetric('villageMorale', snapshot.villageMorale ?? getMetricDefault('villageMorale'));
  setMetric('villagerTrust', snapshot.villagerTrust ?? getMetricDefault('villagerTrust'));
  state.outpostStates = cloneCleanObject(snapshot.outpostStates);
  state.rumorFlags = cloneCleanObject(snapshot.rumorFlags);
  state.safehouseAccess = cloneCleanObject(snapshot.safehouseAccess);
  const economySnapshot = snapshot.villageEconomy;
  if (economySnapshot && typeof economySnapshot === 'object'){
    state.villageEconomy = cloneCleanObject(economySnapshot);
  } else {
    state.villageEconomy = cloneCleanObject(DEFAULT_ECONOMY_STATE);
  }
  if (!state.villageEconomy.productionNodes || typeof state.villageEconomy.productionNodes !== 'object'){
    state.villageEconomy.productionNodes = {};
  }
  notifyWorldStateChange('outpostStates', state.outpostStates, null);
  notifyWorldStateChange('rumorFlags', state.rumorFlags, null);
  notifyWorldStateChange('safehouseAccess', state.safehouseAccess, null);
  notifyWorldStateChange('villageEconomy', state.villageEconomy, null);
}

function cloneCleanObject(value){
  if (!value || typeof value !== 'object') return {};
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err){
    console.warn('[worldState] failed to clone object', err);
    return {};
  }
}

function ensureVillageEconomy(){
  if (!state.villageEconomy || typeof state.villageEconomy !== 'object'){
    state.villageEconomy = cloneCleanObject(DEFAULT_ECONOMY_STATE);
  }
  if (!state.villageEconomy.productionNodes || typeof state.villageEconomy.productionNodes !== 'object'){
    state.villageEconomy.productionNodes = {};
  }
  return state.villageEconomy;
}

function withEconomyUpdate(mutator){
  const economy = ensureVillageEconomy();
  const previous = cloneCleanObject(economy);
  mutator(economy);
  notifyWorldStateChange('villageEconomy', economy, previous);
  return economy;
}

function pauseProductionNode(id, options = {}){
  if (!id) return null;
  let node = null;
  withEconomyUpdate(economy => {
    const nodes = economy.productionNodes;
    node = nodes[id] || { id, status: 'active', pausedUntil: 0, lastPausedAt: -Infinity };
    node.status = 'paused';
    node.lastPausedAt = state.time;
    const duration = Math.max(0, options.duration ?? 90);
    if (duration > 0){
      node.pausedUntil = Math.max(node.pausedUntil ?? 0, state.time + duration);
    }
    if (options.reason){
      node.reason = options.reason;
    }
    if (options.cause){
      node.lastCause = options.cause;
    }
    if (options.resumeHintAt != null){
      node.resumeHintAt = options.resumeHintAt;
    }
    nodes[id] = node;
  });
  return node;
}

function markVillageEconomyDamaged(options = {}){
  return withEconomyUpdate(economy => {
    economy.status = 'damaged';
    economy.damagedAt = state.time;
    const duration = Math.max(0, options.duration ?? 150);
    const repairWindow = Math.max(0, options.repairWindow ?? (duration + 60));
    economy.damageExpiresAt = state.time + duration;
    economy.repairWindowEnds = state.time + repairWindow;
    if (options.hostileDuration != null){
      const hostileUntil = state.time + Math.max(0, options.hostileDuration);
      economy.blacksmithHostileUntil = Math.max(economy.blacksmithHostileUntil ?? 0, hostileUntil);
    }
    if (options.productionNodeId){
      const nodes = economy.productionNodes;
      const nodeId = options.productionNodeId;
      const node = nodes[nodeId] || { id: nodeId, status: 'active', pausedUntil: 0, lastPausedAt: -Infinity };
      node.status = 'paused';
      node.lastPausedAt = state.time;
      const pauseDuration = Math.max(0, options.pauseDuration ?? duration);
      if (pauseDuration > 0){
        node.pausedUntil = Math.max(node.pausedUntil ?? 0, state.time + pauseDuration);
      }
      node.reason = options.reason || 'sabotaged';
      node.lastCause = options.cause || 'sabotage';
      nodes[nodeId] = node;
    }
  });
}

function buildGuardStrengthDecay(options = {}){
  const total = options.total ?? 12;
  const duration = Math.max(0, options.duration ?? 120);
  const baseInterval = Math.max(6, options.interval ?? 20);
  const suggestedTicks = baseInterval > 0 ? Math.max(1, Math.round(duration / baseInterval)) : 1;
  const ticks = Math.max(1, options.ticks ?? suggestedTicks);
  const interval = Math.max(6, options.interval ?? (ticks > 0 ? Math.max(6, duration / ticks) : 20));
  const perTick = total / ticks;
  return {
    source: options.source || 'economy-damage',
    total,
    remaining: total,
    perTick,
    ticks,
    interval,
    nextTickAt: state.time + (options.initialDelay ?? interval),
    lastAppliedAt: null
  };
}

function scheduleGuardStrengthReduction(options = {}){
  let decay = null;
  withEconomyUpdate(economy => {
    decay = buildGuardStrengthDecay(options);
    economy.guardStrengthDecay = decay;
  });
  return decay;
}

function enqueueRevengeMissionSeed(id, options = {}){
  if (!id) return false;
  if (!Array.isArray(state.proceduralQuests)){
    state.proceduralQuests = [];
  }
  const exists = state.proceduralQuests.some(entry => entry && entry.id === id);
  if (exists) return false;
  const entry = {
    id,
    templateId: options.templateId || 'revenge-strike',
    context: cloneCleanObject(options.context),
    descriptor: options.descriptor ?? null,
    reward: options.reward ?? null,
    queuedAt: state.time
  };
  state.proceduralQuests.push(entry);
  notifyWorldStateChange('proceduralQuestSeed', entry, null);
  return true;
}

function registerWorldStateListener(listener){
  if (typeof listener !== 'function') return () => {};
  worldStateListeners.add(listener);
  return () => unregisterWorldStateListener(listener);
}

function unregisterWorldStateListener(listener){
  if (listener) worldStateListeners.delete(listener);
}

function setVillageSuspicion(value){
  return setMetric('villageSuspicion', value);
}

function incrementVillageSuspicion(delta){
  const current = state.villageSuspicion ?? getMetricDefault('villageSuspicion') ?? 0;
  return setVillageSuspicion(current + delta);
}

function setGuardStrength(value){
  return setMetric('guardStrength', value);
}

function adjustGuardStrength(delta){
  const current = state.guardStrength ?? getMetricDefault('guardStrength') ?? 0;
  return setGuardStrength(current + delta);
}

function setGuardAlertness(value){
  return setMetric('guardAlertness', value);
}

function adjustGuardAlertness(delta){
  const current = state.guardAlertness ?? getMetricDefault('guardAlertness') ?? 0;
  return setGuardAlertness(current + delta);
}

function setMapVisibility(value){
  return setMetric('mapVisibility', value);
}

function adjustMapVisibility(delta){
  const current = state.mapVisibility ?? getMetricDefault('mapVisibility') ?? 0;
  return setMapVisibility(current + delta);
}

function setPopulationHealth(value){
  return setMetric('villagePopulationHealth', value);
}

function adjustPopulationHealth(delta){
  const current = state.villagePopulationHealth ?? getMetricDefault('villagePopulationHealth') ?? 0;
  return setPopulationHealth(current + delta);
}

function setVillageMorale(value){
  return setMetric('villageMorale', value);
}

function adjustVillageMorale(delta){
  const current = state.villageMorale ?? getMetricDefault('villageMorale') ?? 0;
  return setVillageMorale(current + delta);
}

function setVillagerTrust(value){
  return setMetric('villagerTrust', value);
}

function adjustVillagerTrust(delta){
  const current = state.villagerTrust ?? getMetricDefault('villagerTrust') ?? 0;
  return setVillagerTrust(current + delta);
}

function delayDarklordReinforcements(amount){
  if (!Number.isFinite(amount) || amount <= 0) return state.darklordReinforcementDelay;
  const current = state.darklordReinforcementDelay ?? 0;
  return setMetric('darklordReinforcementDelay', current + amount);
}

function getNormalizedGuardStrength(){
  const meta = WORLD_STATE_RANGES.guardStrength;
  const span = meta.max - meta.min || 1;
  return clamp((state.guardStrength - meta.min) / span, 0, 1);
}

function getNormalizedGuardAlertness(){
  const meta = WORLD_STATE_RANGES.guardAlertness;
  const span = meta.max - meta.min || 1;
  return clamp((state.guardAlertness - meta.min) / span, 0, 1);
}

function getGuardStrengthMultiplier(){
  return 0.85 + getNormalizedGuardStrength() * 0.75;
}

function getGuardAlertnessMultiplier(){
  return 0.9 + getNormalizedGuardAlertness() * 0.55;
}

function getSuspicionFactor(){
  const meta = WORLD_STATE_RANGES.villageSuspicion;
  const span = meta.max - meta.min || 1;
  return clamp((state.villageSuspicion - meta.min) / span, 0, 1);
}

function getPopulationHealthFactor(){
  return clamp(state.villagePopulationHealth ?? getMetricDefault('villagePopulationHealth') ?? 0, 0, 1);
}

function getVillageMorale(){
  return clamp(state.villageMorale ?? getMetricDefault('villageMorale') ?? 0, 0, 100);
}

function getVillagerTrust(){
  return clamp(state.villagerTrust ?? getMetricDefault('villagerTrust') ?? 0, 0, 100);
}

function getMapVisibility(){
  return clamp(state.mapVisibility ?? getMetricDefault('mapVisibility') ?? 0, 0, 1);
}

function getReinforcementDelayFactor(){
  const meta = WORLD_STATE_RANGES.darklordReinforcementDelay;
  const span = meta.max - meta.min || 1;
  return clamp((state.darklordReinforcementDelay - meta.min) / span, 0, 1);
}

function updateWorldState(dt){
  if (!Number.isFinite(dt) || dt <= 0) return;
  if (state.darklordReinforcementDelay > 0){
    const next = Math.max(0, state.darklordReinforcementDelay - dt);
    if (next !== state.darklordReinforcementDelay){
      setMetric('darklordReinforcementDelay', next);
    }
  }
  const economy = state.villageEconomy;
  if (economy && economy.guardStrengthDecay && economy.guardStrengthDecay.ticks > 0){
    const decay = economy.guardStrengthDecay;
    if (decay.nextTickAt == null){
      decay.nextTickAt = state.time + decay.interval;
    }
    if (state.time >= decay.nextTickAt){
      const previous = cloneCleanObject(economy);
      adjustGuardStrength(-decay.perTick);
      decay.remaining = Math.max(0, decay.remaining - decay.perTick);
      decay.ticks -= 1;
      decay.lastAppliedAt = state.time;
      decay.nextTickAt = decay.ticks > 0 ? state.time + decay.interval : null;
      if (decay.ticks <= 0){
        decay.remaining = 0;
      }
      notifyWorldStateChange('villageEconomy', economy, previous);
    }
  }
}

function setOutpostState(id, data){
  if (!id) return;
  if (!state.outpostStates || typeof state.outpostStates !== 'object'){
    state.outpostStates = {};
  }
  const previous = state.outpostStates[id];
  state.outpostStates[id] = cloneCleanObject(data);
  notifyWorldStateChange('outpostStates', state.outpostStates, previous);
}

function clearOutpostState(id){
  if (!id || !state.outpostStates) return;
  if (Object.prototype.hasOwnProperty.call(state.outpostStates, id)){
    const previous = state.outpostStates[id];
    delete state.outpostStates[id];
    notifyWorldStateChange('outpostStates', state.outpostStates, previous);
  }
}

function getOutpostState(id){
  if (!id || !state.outpostStates) return null;
  const value = state.outpostStates[id];
  if (!value || typeof value !== 'object') return value ?? null;
  return cloneCleanObject(value);
}

function grantSafehouseAccess(id, details = {}){
  if (!id) return;
  if (!state.safehouseAccess || typeof state.safehouseAccess !== 'object'){
    state.safehouseAccess = {};
  }
  const previous = state.safehouseAccess[id];
  state.safehouseAccess[id] = {
    unlockedAt: state.time,
    ...cloneCleanObject(details)
  };
  notifyWorldStateChange('safehouseAccess', state.safehouseAccess, previous);
}

function revokeSafehouseAccess(id){
  if (!id || !state.safehouseAccess) return;
  if (Object.prototype.hasOwnProperty.call(state.safehouseAccess, id)){
    const previous = state.safehouseAccess[id];
    delete state.safehouseAccess[id];
    notifyWorldStateChange('safehouseAccess', state.safehouseAccess, previous);
  }
}

function hasSafehouseAccess(id){
  if (!id || !state.safehouseAccess) return false;
  return Object.prototype.hasOwnProperty.call(state.safehouseAccess, id);
}

function getSafehouseAccess(id){
  if (!id || !state.safehouseAccess) return null;
  const value = state.safehouseAccess[id];
  if (!value || typeof value !== 'object') return value ?? null;
  return cloneCleanObject(value);
}

function setRumorFlag(flag, value = true){
  if (!flag) return;
  if (!state.rumorFlags || typeof state.rumorFlags !== 'object'){
    state.rumorFlags = {};
  }
  const previous = state.rumorFlags[flag];
  if (value === false || value == null){
    delete state.rumorFlags[flag];
  } else {
    state.rumorFlags[flag] = cloneCleanObject(value);
  }
  notifyWorldStateChange('rumorFlags', state.rumorFlags, previous);
}

function clearRumorFlag(flag){
  setRumorFlag(flag, false);
}

export {
  WORLD_STATE_RANGES,
  resetWorldState,
  serializeWorldState,
  hydrateWorldState,
  updateWorldState,
  registerWorldStateListener,
  unregisterWorldStateListener,
  setVillageSuspicion,
  incrementVillageSuspicion,
  setGuardStrength,
  adjustGuardStrength,
  setGuardAlertness,
  adjustGuardAlertness,
  setMapVisibility,
  adjustMapVisibility,
  setPopulationHealth,
  adjustPopulationHealth,
  setVillageMorale,
  adjustVillageMorale,
  setVillagerTrust,
  adjustVillagerTrust,
  delayDarklordReinforcements,
  getNormalizedGuardStrength,
  getNormalizedGuardAlertness,
  getGuardStrengthMultiplier,
  getGuardAlertnessMultiplier,
  getSuspicionFactor,
  getPopulationHealthFactor,
  getVillageMorale,
  getVillagerTrust,
  getMapVisibility,
  getReinforcementDelayFactor,
  setOutpostState,
  clearOutpostState,
  getOutpostState,
  grantSafehouseAccess,
  revokeSafehouseAccess,
  hasSafehouseAccess,
  getSafehouseAccess,
  setRumorFlag,
  clearRumorFlag,
  ensureVillageEconomy,
  pauseProductionNode,
  markVillageEconomyDamaged,
  scheduleGuardStrengthReduction,
  enqueueRevengeMissionSeed
};
