import { state, mainVillage } from '../state/gameState.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { addThreat } from './threat.js';
import { BASE_WHISPERS, HIGH_THREAT_WHISPERS, TASK_HINT_WHISPERS } from '../data/villagerDialog.js';
import { setNPCState, NPC_STATE } from '../npc/npcManager.js';

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
    disarming: false
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
  const pool = [...BASE_WHISPERS];
  if (state.threat >= 60) pool.push(...HIGH_THREAT_WHISPERS);
  if (state.villageTasks.some(task => !task.completed)) pool.push(...TASK_HINT_WHISPERS);
  if (pool.length === 0) return '';

  let chosen = pool[Math.floor(Math.random() * pool.length)];
  let attempts = 0;
  while (chosen === npc.lastDialogueLine && attempts < 4){
    chosen = pool[Math.floor(Math.random() * pool.length)];
    attempts++;
  }
  npc.lastDialogueLine = chosen;
  return chosen;
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
  toast(line, 3.6);
  const p = state.player;
  p.detection = clamp(p.detection - 6, 0, 100);
  addThreat(-4);
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
  } else {
    player.detection = clamp(player.detection + 28, 0, 100);
    npc.pickpocketCooldown = state.time + 20;
    npc.dialogCooldown = state.time + 8;
    toast('The villager snaps around. "Thief!"', 2.6);
    addThreat(18);
    // Villagers don't chase - they just yell and remember you
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
    state.activeTrapDisarm = null;
    toast('You snip the tripwire. The village grows a shade calmer.', 3);
    player.detection = clamp(player.detection - 12, 0, 100);
    addThreat(-14);
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
  VILLAGER_TALK_DISTANCE,
  VILLAGER_PICKPOCKET_DISTANCE,
  TRAP_INTERACT_DISTANCE
};
