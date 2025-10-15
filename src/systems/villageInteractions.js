import { state, mainVillage } from '../state/gameState.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { addThreat } from './threat.js';
import { BASE_WHISPERS, HIGH_THREAT_WHISPERS, TASK_HINT_WHISPERS } from '../data/villagerDialog.js';
import { getQuestRumors, unlockQuest } from './questLog.js';
import {
  getSuspicionFactor,
  getPopulationHealthFactor,
  adjustPopulationHealth,
  adjustMapVisibility,
  incrementVillageSuspicion
} from './worldState.js';

const VILLAGER_TALK_DISTANCE = 72;
const VILLAGER_PICKPOCKET_DISTANCE = 58;
const TRAP_INTERACT_DISTANCE = 78;

const TRAP_DISARM_DURATION = 3.2;

const trapSpecs = [
  { id: 'grain-cart-snare', x: 220, y: 412, label: 'Alarm snare beside the grain cart.' },
  { id: 'well-tripwire', x: 520, y: 368, label: 'Tripwire strung near the village well.' },
  { id: 'watch-post-chimes', x: 736, y: 508, label: 'Hanging chimes that alert the scouts.' }
];

function initVillageInteractions(){
  state.activeTrapDisarm = null;
  state.villageTasks = trapSpecs.map(spec => ({
    id: spec.id,
    type: 'trap',
    x: mainVillage.x + spec.x,
    y: mainVillage.y + spec.y,
    radius: 60,
    label: spec.label,
    completed: false,
    completedAt: -Infinity,
    cooldownUntil: 0,
    disarming: false,
    hintAge: 0
  }));
}

function getVillageTraps(){
  return state.villageTasks;
}

function findNearestVillager(maxRange){
  let best = null;
  let bestDist = Infinity;
  const player = state.player;
  for (const npc of state.npcs){
    if (npc.type !== 'villager') continue;
    const dist = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (dist > maxRange) continue;
    if (dist < bestDist){
      bestDist = dist;
      best = npc;
    }
  }
  return best ? { npc: best, dist: bestDist } : null;
}

function chooseVillagerLine(npc){
  const suspicionFactor = getSuspicionFactor();
  const populationHealthFactor = getPopulationHealthFactor();
  const rumorSuppression = clamp(suspicionFactor * 1.1, 0, 0.95);
  const baseWeight = clamp(0.85 + (1 - populationHealthFactor) * 0.4, 0.5, 1.8);
  const pool = [
    ...BASE_WHISPERS.map(text => ({ text, weight: baseWeight }))
  ];

  if (state.threat >= 60){
    const highThreatWeight = clamp(0.6 + suspicionFactor * 1.2, 0.4, 2.5);
    pool.push(...HIGH_THREAT_WHISPERS.map(text => ({ text, weight: highThreatWeight })));
  }

  if (state.villageTasks.some(task => !task.completed)){
    const taskWeight = clamp(0.7 + (1 - suspicionFactor) * 0.9 + (1 - populationHealthFactor) * 0.6, 0.4, 2.8);
    pool.push(...TASK_HINT_WHISPERS.map(text => ({ text, weight: taskWeight })));
  }

  const rumorWeightBase = clamp((1 - rumorSuppression) * (0.7 + (1 - populationHealthFactor) * 0.5), 0.08, 2.6);
  const pushRumor = (entry, extraWeight = 1) => {
    if (!entry || !entry.text) return;
    const weight = Math.max(0.05, (entry.weight ?? 1) * extraWeight * rumorWeightBase);
    pool.push({ ...entry, weight });
  };

  const questRumors = getQuestRumors();
  questRumors.forEach(rumor => {
    if (!rumor || !rumor.text) return;
    pushRumor({ text: rumor.text, questId: rumor.questId, questStatus: rumor.status });
  });

  const rumorFlags = state.rumorFlags || {};
  const applyFlagValue = (value) => {
    if (!value) return;
    if (typeof value === 'string'){
      pushRumor({ text: value });
      return;
    }
    if (Array.isArray(value)){
      value.forEach(applyFlagValue);
      return;
    }
    if (typeof value === 'object'){
      if (Array.isArray(value.lines)){
        value.lines.forEach(item => {
          if (typeof item === 'string'){
            pushRumor({ text: item }, value.weight ?? 1);
          } else if (item && typeof item === 'object'){
            pushRumor(item, value.weight ?? 1);
          }
        });
        return;
      }
      if (value.text){
        pushRumor(value);
      }
    }
  };

  Object.values(rumorFlags).forEach(applyFlagValue);

  if (pool.length === 0) return null;

  const totalWeight = pool.reduce((sum, entry) => sum + Math.max(entry.weight ?? 1, 0), 0);
  if (totalWeight <= 0) return null;

  let attempts = 0;
  let chosen = null;
  while (attempts < 4){
    const target = Math.random() * totalWeight;
    let accum = 0;
    for (const entry of pool){
      const weight = Math.max(entry.weight ?? 1, 0);
      accum += weight;
      if (target <= accum){
        chosen = entry;
        break;
      }
    }
    if (!chosen) chosen = pool[pool.length - 1];
    if (!chosen || chosen.text !== npc.lastDialogueLine || attempts >= 3) break;
    attempts++;
    chosen = null;
  }

  npc.lastDialogueLine = chosen ? chosen.text : null;
  return chosen || null;
}

function tryTalkToVillager(){
  if (state.interior) return false;
  const info = findNearestVillager(VILLAGER_TALK_DISTANCE);
  if (!info) return false;
  const npc = info.npc;
  if (state.time < npc.dialogCooldown){
    toast('The villager averts their eyes—too many ears nearby.', 1.8);
    return true;
  }

  const line = chooseVillagerLine(npc);
  if (!line) return false;
  npc.dialogCooldown = state.time + 5.5;
  toast(line.text, 3.6);
  if (line.questId){
    const result = unlockQuest(line.questId, { merge: { discoveredBy: 'rumor' } });
    if (result && result.changed && result.message){
      toast(result.message, 2.6);
    }
  }
  const p = state.player;
  p.detection = clamp(p.detection - 6, 0, 100);
  addThreat(-4);
  adjustMapVisibility(line.questId ? 0.035 : 0.02);
  adjustPopulationHealth(0.01);
  incrementVillageSuspicion(line.questId ? -3 : -2);
  return true;
}

function tryPickpocketVillager(){
  if (state.interior) return false;
  const info = findNearestVillager(VILLAGER_PICKPOCKET_DISTANCE);
  if (!info) return false;
  const npc = info.npc;

  if (npc.pickpocketed){
    toast('Already lifted their coin purse—try another mark.', 2.2);
    return true;
  }

  if (state.time < npc.pickpocketCooldown){
    toast('Too many eyes right now. Wait for the crowd to thin.', 2.2);
    return true;
  }

  const player = state.player;
  const stealth = clamp(1 - player.detection / 110, 0, 1);
  const threatPenalty = clamp(state.threat / 220, 0, 0.5);
  const successChance = clamp(0.45 + stealth * 0.4 - threatPenalty, 0.12, 0.88);
  const roll = Math.random();

  if (roll < successChance){
    const gold = 3 + Math.floor(Math.random() * 5) + Math.round(stealth * 4);
    player.gold += gold;
    player.detection = clamp(player.detection - 8, 0, 100);
    npc.pickpocketed = true;
    npc.pickpocketCooldown = state.time + 18;
    npc.dialogCooldown = Math.max(npc.dialogCooldown, state.time + 3);
    toast(`You lift ${gold} gold without a whisper.`, 2.8);
    addThreat(-6);
    incrementVillageSuspicion(-4);
    adjustPopulationHealth(0.006);
  } else {
    player.detection = clamp(player.detection + 28, 0, 100);
    npc.pickpocketCooldown = state.time + 20;
    npc.dialogCooldown = state.time + 8;
    toast('The villager snaps around. "Thief!"', 2.6);
    addThreat(18);
    incrementVillageSuspicion(12);
    adjustPopulationHealth(-0.02);
    adjustMapVisibility(-0.015);
  }

  return true;
}

function tryDisarmNearbyTrap(){
  if (state.interior) return false;
  const player = state.player;
  let target = null;
  for (const task of state.villageTasks){
    if (task.type !== 'trap' || task.completed) continue;
    const dist = Math.hypot(task.x - player.x, task.y - player.y);
    if (dist > TRAP_INTERACT_DISTANCE) continue;
    target = task;
    break;
  }

  if (!target) return false;
  if (target.disarming) return true;

  if (state.activeTrapDisarm){
    if (state.activeTrapDisarm.trap === target) return true;
    toast('Focus—finish the trap you\'re already working on.', 1.8);
    return true;
  }

  target.disarming = true;
  target.hintAge = 0;
  state.activeTrapDisarm = {
    trap: target,
    trapId: target.id,
    startedAt: state.time,
    duration: TRAP_DISARM_DURATION,
    endsAt: state.time + TRAP_DISARM_DURATION
  };
  toast('You steady your tools and begin working through the mechanism.', 2.2);
  return true;
}

function updateTrapDisarm(){
  const active = state.activeTrapDisarm;
  if (!active) return;

  const trap = active.trap;
  if (!trap || trap.completed){
    state.activeTrapDisarm = null;
    if (trap) trap.disarming = false;
    return;
  }

  const player = state.player;
  const dist = Math.hypot(trap.x - player.x, trap.y - player.y);
  if (dist > TRAP_INTERACT_DISTANCE + 12){
    trap.disarming = false;
    state.activeTrapDisarm = null;
    return;
  }

  if (state.time >= active.endsAt){
    trap.completed = true;
    trap.completedAt = state.time;
    trap.disarming = false;
    trap.hintAge = 0;
    state.activeTrapDisarm = null;
    toast('You snip the tripwire. The village grows a shade calmer.', 3);
    player.detection = clamp(player.detection - 12, 0, 100);
    addThreat(-14);
    adjustPopulationHealth(0.05);
    incrementVillageSuspicion(-5);
    adjustMapVisibility(0.015);
  }
}

function updateVillageTaskHints(dt){
  if (!Array.isArray(state.villageTasks)) return;
  for (const task of state.villageTasks){
    if (!task) continue;
    if (task.completed){
      task.hintAge = 0;
      continue;
    }
    if (state.activeTrapDisarm && state.activeTrapDisarm.trapId === task.id){
      task.hintAge = 0;
      continue;
    }
    const age = Math.min((task.hintAge ?? 0) + dt, 120);
    task.hintAge = age;
  }
}

function getVillagerPromptData(){
  const info = findNearestVillager(Math.max(VILLAGER_TALK_DISTANCE, VILLAGER_PICKPOCKET_DISTANCE));
  if (!info) return null;
  const npc = info.npc;
  return {
    npc,
    dist: info.dist,
    canTalk: info.dist <= VILLAGER_TALK_DISTANCE,
    canPickpocket: info.dist <= VILLAGER_PICKPOCKET_DISTANCE && !npc.pickpocketed,
    pickpocketOnCooldown: state.time < npc.pickpocketCooldown
  };
}

function getNearbyTrapPrompt(){
  const player = state.player;
  let prompt = null;
  for (const task of state.villageTasks){
    if (task.type !== 'trap' || task.completed) continue;
    const dist = Math.hypot(task.x - player.x, task.y - player.y);
    if (dist <= TRAP_INTERACT_DISTANCE){
      const disarming = !!(state.activeTrapDisarm && state.activeTrapDisarm.trap === task);
      prompt = { trap: task, dist, disarming };
      break;
    }
  }
  return prompt;
}

export {
  initVillageInteractions,
  tryTalkToVillager,
  tryPickpocketVillager,
  tryDisarmNearbyTrap,
  getVillageTraps,
  getVillagerPromptData,
  getNearbyTrapPrompt,
  updateTrapDisarm,
  updateVillageTaskHints,
  VILLAGER_TALK_DISTANCE,
  VILLAGER_PICKPOCKET_DISTANCE,
  TRAP_INTERACT_DISTANCE
};
