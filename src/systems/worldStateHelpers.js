import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { queueNoiseEvent } from '../npc/npcManager.js';
import { incrementVillageSuspicion, setRumorFlag, updateWorldIntel, getWorldIntel } from './worldState.js';

function raiseVillageSuspicion(amount = 0){
  if (!Number.isFinite(amount) || amount === 0) return state.villageSuspicion;
  return incrementVillageSuspicion(amount);
}

function queueGuardInvestigationNoise({
  x,
  y,
  radius = 200,
  duration = 8,
  investigateFor = 4,
  maxResponders = 2,
  cooldown = 6,
  source = 'world-helper'
} = {}){
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return queueNoiseEvent({
    x,
    y,
    radius,
    duration,
    investigateFor,
    maxResponders,
    cooldown,
    source,
    type: 'guard-investigation'
  });
}

function grantTradeRouteIntel({ amount = 1, note, toastText = 'Intel gained: trade routes updated.', silent = false } = {}){
  const existing = getWorldIntel('tradeRoutes') || {};
  const leads = clamp((existing.leads ?? 0) + amount, 0, 999);
  const record = {
    leads,
    note: note || existing.note || 'Merchants whisper about a fattened caravan bound for the marsh road.',
    lastUpdated: state.time
  };
  updateWorldIntel('tradeRoutes', record);
  if (!silent && toastText){
    toast(toastText, 2.6);
  }
  return record;
}

function flagTradeCaravanSeedRumor(value = { discoveredAt: state.time, source: 'world-helper' }){
  setRumorFlag('trade_caravan_seed', value === true ? { discoveredAt: state.time } : value);
  return state.rumorFlags?.trade_caravan_seed || null;
}

export {
  raiseVillageSuspicion,
  queueGuardInvestigationNoise,
  grantTradeRouteIntel,
  flagTradeCaravanSeedRumor
};
