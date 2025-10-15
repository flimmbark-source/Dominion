import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';
import { getQuestDefinition, getQuestState } from './questLog.js';
import { getTavernMissionCues } from './tavernMissionSites.js';
import { getSuspicionFactor, getPopulationHealthFactor, getMapVisibility } from './worldState.js';

function ensureCueMemory(){
  if (!(state.questCueMemory instanceof Map)){
    state.questCueMemory = new Map();
  }
}

function hashString(text){
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i++){
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function findContextLocation(context, locationId){
  if (!context || !locationId) return null;
  const values = Object.values(context);
  for (const value of values){
    if (!value || typeof value !== 'object') continue;
    if (value.id === locationId && Number.isFinite(value.x) && Number.isFinite(value.y)){
      return value;
    }
  }
  return null;
}

function resolveModuleLocationId(module, stage, descriptor){
  if (!module || !descriptor) return null;
  if (module.type === 'escort-npc'){
    if (stage === module.stage && descriptor.startLocationId) return descriptor.startLocationId;
    return descriptor.destinationId || descriptor.startLocationId || descriptor.locationId || null;
  }
  if (descriptor.locationId) return descriptor.locationId;
  if (descriptor.locationTargetId) return descriptor.locationTargetId;
  return null;
}

function gatherProceduralQuestCues(){
  const cues = [];
  if (!Array.isArray(state.proceduralQuests)) return cues;
  for (const entry of state.proceduralQuests){
    if (!entry) continue;
    const quest = getQuestState(entry.id);
    const def = getQuestDefinition(entry.id);
    if (!quest || !def) continue;
    if (quest.status === 'hidden' || quest.status === 'completed') continue;
    const stage = quest.data?.stage || quest.stage || def.initialStage;
    if (!stage || stage === 'resolution') continue;
    const module = def.modules?.find(mod => mod.stage === stage) || null;
    if (!module) continue;
    const descriptor = module.descriptor || {};
    const locationId = resolveModuleLocationId(module, stage, descriptor);
    const context = entry.context || {};
    let location = null;
    if (locationId){
      location = findContextLocation(context, locationId);
    }
    if (!location && descriptor.locationId){
      location = findContextLocation(context, descriptor.locationId);
    }
    if (!location && descriptor.destinationId){
      location = findContextLocation(context, descriptor.destinationId);
    }
    if (!location) continue;
    if (!Number.isFinite(location.x) || !Number.isFinite(location.y)) continue;
    const radius = descriptor.radius ?? location.radius ?? 200;
    const baseIntensity = descriptor.baseIntensity ?? (module.type === 'eliminate-enemy' ? 0.2 : 0.16);
    const seed = ((hashString(`${quest.id}:${stage}:${module.type}`) % 1000) / 1000);
    cues.push({
      questId: quest.id,
      stage,
      kind: module.type,
      x: location.x,
      y: location.y,
      radius,
      innerRadius: Math.min(radius * 0.6, radius - 8),
      baseIntensity,
      escalateAfter: descriptor.escalateAfter ?? 28,
      seed,
      label: location.label || location.title || descriptor.locationLabel || module.label || ''
    });
  }
  return cues;
}

function updateQuestCues(dt){
  ensureCueMemory();
  const cues = [
    ...gatherProceduralQuestCues(),
    ...getTavernMissionCues()
  ];
  const memory = state.questCueMemory;
  const nextMemory = new Map();
  const player = state.player;
  const suspicionFactor = getSuspicionFactor();
  const populationHealthFactor = getPopulationHealthFactor();
  const visibilityFactor = getMapVisibility();
  const worldTension = clamp(1 + suspicionFactor * 0.5 + (1 - populationHealthFactor) * 0.4, 0.7, 1.8);
  const mapFogFactor = clamp(1 + (1 - visibilityFactor) * 0.4, 0.8, 1.5);

  for (const cue of cues){
    const key = `${cue.questId}:${cue.stage}:${cue.kind}`;
    let memo = memory.get(key);
    if (!memo || memo.stage !== cue.stage){
      memo = {
        intensity: cue.baseIntensity ?? 0.18,
        linger: 0,
        age: 0,
        stage: cue.stage
      };
    } else {
      memo.age += dt;
    }
    const radius = cue.radius ?? 180;
    const innerRadius = cue.innerRadius ?? Math.min(radius * 0.6, radius - 8);
    const dist = Math.hypot(player.x - cue.x, player.y - cue.y);
    if (dist <= radius){
      memo.linger = clamp((memo.linger ?? 0) + dt, 0, 8);
    } else {
      memo.linger = clamp((memo.linger ?? 0) - dt * 0.4, 0, 8);
    }
    const hintDelay = cue.escalateAfter ?? 28;
    const lostBoost = memo.age > hintDelay ? clamp((memo.age - hintDelay) / hintDelay, 0, 1) : 0;
    const nearBoost = dist <= innerRadius ? 0.22 : dist <= radius ? 0.1 : 0;
    const patience = (memo.linger ?? 0) / 8;
    const baseIntensity = cue.baseIntensity ?? 0.16;
    const targetBase = baseIntensity + patience * 0.45 + lostBoost * 0.35 + nearBoost;
    const target = clamp(targetBase * worldTension * mapFogFactor, baseIntensity, 1);
    const smoothing = clamp(dt * 2.2, 0, 1);
    memo.intensity = memo.intensity == null ? target : memo.intensity + (target - memo.intensity) * smoothing;
    memo.stage = cue.stage;
    cue.intensity = clamp(memo.intensity, cue.baseIntensity ?? 0.16, 1);
    cue.memory = { age: memo.age, linger: memo.linger, lostBoost };
    nextMemory.set(key, memo);
  }

  state.questCueMemory = nextMemory;
  state.questCues = cues;
}

export { updateQuestCues };
