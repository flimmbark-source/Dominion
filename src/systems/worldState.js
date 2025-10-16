import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';

const WORLD_STATE_RANGES = {
  villageSuspicion: { min: 0, max: 100, default: 12 },
  guardStrength: { min: 0, max: 100, default: 40 },
  guardAlertness: { min: 0, max: 100, default: 28 },
  mapVisibility: { min: 0, max: 1, default: 0.38 },
  darklordReinforcementDelay: { min: 0, max: 180, default: 0 },
  villagePopulationHealth: { min: 0, max: 1, default: 0.9 }
};

const worldStateListeners = new Set();

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
  state.worldIntel = {};
  notifyWorldStateChange('outpostStates', state.outpostStates, null);
  notifyWorldStateChange('rumorFlags', state.rumorFlags, null);
  notifyWorldStateChange('worldIntel', state.worldIntel, null);
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
    outpostStates: JSON.parse(JSON.stringify(state.outpostStates || {})),
    rumorFlags: JSON.parse(JSON.stringify(state.rumorFlags || {})),
    worldIntel: JSON.parse(JSON.stringify(state.worldIntel || {}))
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
  state.outpostStates = cloneCleanObject(snapshot.outpostStates);
  state.rumorFlags = cloneCleanObject(snapshot.rumorFlags);
  state.worldIntel = cloneCleanObject(snapshot.worldIntel);
  notifyWorldStateChange('outpostStates', state.outpostStates, null);
  notifyWorldStateChange('rumorFlags', state.rumorFlags, null);
  notifyWorldStateChange('worldIntel', state.worldIntel, null);
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

function updateWorldIntel(key, value){
  if (!key) return null;
  if (!state.worldIntel || typeof state.worldIntel !== 'object'){
    state.worldIntel = {};
  }
  const previous = state.worldIntel[key];
  if (value == null){
    delete state.worldIntel[key];
  } else if (typeof value === 'object'){
    state.worldIntel[key] = cloneCleanObject(value);
  } else {
    state.worldIntel[key] = value;
  }
  notifyWorldStateChange('worldIntel', state.worldIntel, previous);
  return state.worldIntel[key];
}

function getWorldIntel(key){
  if (!key || !state.worldIntel || typeof state.worldIntel !== 'object') return null;
  const value = state.worldIntel[key];
  if (!value || typeof value !== 'object') return value ?? null;
  return cloneCleanObject(value);
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
  delayDarklordReinforcements,
  getNormalizedGuardStrength,
  getNormalizedGuardAlertness,
  getGuardStrengthMultiplier,
  getGuardAlertnessMultiplier,
  getSuspicionFactor,
  getPopulationHealthFactor,
  getMapVisibility,
  getReinforcementDelayFactor,
  setOutpostState,
  clearOutpostState,
  getOutpostState,
  setRumorFlag,
  clearRumorFlag,
  updateWorldIntel,
  getWorldIntel
};
