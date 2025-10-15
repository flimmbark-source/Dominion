import { WORLD_EVENTS } from '../data/worldEvents.js';
import { POINTS_OF_INTEREST } from '../data/pointsOfInterest.js';
import { state } from '../state/gameState.js';
import { toast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';
import {
  registerQuestDefinition,
  unlockQuest,
  activateQuest,
  updateQuestData,
  completeQuest,
  adjustDarkMuster,
  getQuestState
} from './questLog.js';
import { addThreat } from './threat.js';
import { makeNPC, NPC_STATE, removeNPC } from '../npc/npcManager.js';

const PHASE_DWELL_TIME = 1.1;

const QUEST_TARGET_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

const POI_LOOKUP = new Map(POINTS_OF_INTEREST.map(poi => [poi.id, poi]));

function resolveTaskTargetId(def, phase, task){
  if (!def || !task) return null;
  if (task.propId) return task.propId;
  if (task.poiId) return task.poiId;
  return `${def.id}-${phase?.id || 'phase'}-${task.id}`;
}

function buildSpawnTargetId(def, phase){
  if (!def || !phase?.spawn) return null;
  return `${def.id}-${phase.id}-guards`;
}

function sanitizeObjective(text, fallback){
  if (typeof text === 'string' && text.trim().length){
    return text.trim();
  }
  return fallback;
}

function derivePoiObjective(poi){
  if (!poi) return 'Resolve the site.';
  if (poi.prompt){
    return poi.prompt
      .replace(/^Press E to\s*/i, '')
      .replace(/\.$/, '')
      .trim();
  }
  return `Resolve ${poi.label}`;
}

function createQuestTargetsForWorldEvent(def){
  if (!def || !Array.isArray(def.phases)) return [];
  const targets = [];
  const seen = new Set();
  const propLookup = new Map();

  for (const phase of def.phases){
    if (!Array.isArray(phase?.props)) continue;
    for (const prop of phase.props){
      if (!prop?.id) continue;
      const center = prop.position || phase.focus || def.anchor || { x: 0, y: 0 };
      propLookup.set(prop.id, {
        x: center.x,
        y: center.y,
        radius: prop.radius ?? phase.radius ?? 100,
        type: prop.type || 'structure'
      });
    }
  }

  def.phases.forEach(phase => {
    if (!phase) return;
    const phaseId = phase.id;
    const phaseName = phase.name;

    if (Array.isArray(phase.tasks)){
      phase.tasks.forEach(task => {
        if (!task) return;
        const targetId = resolveTaskTargetId(def, phase, task);
        if (!targetId || seen.has(targetId)) return;
        const propInfo = task.propId ? propLookup.get(task.propId) : null;
        const poiInfo = task.poiId ? POI_LOOKUP.get(task.poiId) : null;
        const center = {
          x: task.position?.x ?? propInfo?.x ?? poiInfo?.x ?? phase.focus?.x ?? def.anchor?.x ?? 0,
          y: task.position?.y ?? propInfo?.y ?? poiInfo?.y ?? phase.focus?.y ?? def.anchor?.y ?? 0
        };
        const radius = task.radius ?? propInfo?.radius ?? poiInfo?.radius ?? phase.radius ?? 120;
        const type = task.encounter ? 'enemy' : (task.poiId ? 'poi' : 'interactable');
        const objective = sanitizeObjective(
          task.description,
          task.encounter ? `Disrupt the ${task.encounter.spawn?.type || 'guards'}.` : 'Resolve the task.'
        );
        const entry = {
          id: targetId,
          type,
          phaseId,
          phaseName,
          objective,
          position: [center.x, center.y],
          radius,
          status: QUEST_TARGET_STATUS.PENDING,
          taskId: task.id ?? null,
          poiId: task.poiId ?? null,
          propId: task.propId ?? null
        };
        if (task.encounter?.spawn){
          entry.spawnType = task.encounter.spawn.type || 'enemy';
          entry.spawnCount = clamp(Math.floor(task.encounter.spawn.count ?? 1), 1, 8);
        }
        targets.push(entry);
        seen.add(targetId);
      });
    }

    if (phase.poiId && !seen.has(phase.poiId)){
      const poi = POI_LOOKUP.get(phase.poiId);
      if (poi){
        targets.push({
          id: phase.poiId,
          type: 'poi',
          phaseId,
          phaseName,
          objective: derivePoiObjective(poi),
          position: [poi.x, poi.y],
          radius: poi.radius ?? phase.radius ?? 140,
          status: QUEST_TARGET_STATUS.PENDING,
          poiId: phase.poiId
        });
        seen.add(phase.poiId);
      }
    }

    if (Array.isArray(phase.props)){
      phase.props.forEach(prop => {
        if (!prop?.id || seen.has(prop.id)) return;
        const descriptor = propLookup.get(prop.id);
        const center = descriptor ? { x: descriptor.x, y: descriptor.y } : (prop.position || phase.focus || def.anchor || { x: 0, y: 0 });
        const label = (prop.type || 'structure').replace(/-/g, ' ');
        targets.push({
          id: prop.id,
          type: 'structure',
          phaseId,
          phaseName,
          objective: `Inspect the ${label}`,
          position: [center.x, center.y],
          radius: descriptor?.radius ?? prop.radius ?? phase.radius ?? 100,
          status: QUEST_TARGET_STATUS.PENDING,
          propId: prop.id
        });
        seen.add(prop.id);
      });
    }

    if (phase.spawn){
      const spawnId = buildSpawnTargetId(def, phase);
      if (spawnId && !seen.has(spawnId)){
        const center = phase.focus || def.anchor || { x: 0, y: 0 };
        targets.push({
          id: spawnId,
          type: 'enemy',
          phaseId,
          phaseName,
          objective: `Disrupt the ${phase.spawn.type || 'guards'}`,
          position: [center.x, center.y],
          radius: phase.spawn.patrolRadius ?? phase.radius ?? 140,
          status: QUEST_TARGET_STATUS.PENDING,
          spawnType: phase.spawn.type || 'enemy',
          spawnCount: clamp(Math.floor(phase.spawn.count ?? 1), 1, 8)
        });
        seen.add(spawnId);
      }
    }
  });

  return targets.map(target => {
    const clone = { ...target };
    if (Array.isArray(target.position)){
      clone.position = [...target.position];
    }
    return clone;
  });
}

function cloneQuestTarget(target){
  if (!target) return target;
  const clone = { ...target };
  if (Array.isArray(target.position)){
    clone.position = [...target.position];
  }
  return clone;
}

function shallowEqualTarget(a, b){
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys){
    const va = a[key];
    const vb = b[key];
    if (Array.isArray(va) || Array.isArray(vb)){
      if (!Array.isArray(va) || !Array.isArray(vb)) return false;
      if (va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++){
        if (va[i] !== vb[i]) return false;
      }
      continue;
    }
    if (typeof va === 'object' || typeof vb === 'object'){
      if (va === vb) continue;
      return false;
    }
    if (va !== vb) return false;
  }
  return true;
}

function targetsChanged(prev, next){
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++){
    if (!shallowEqualTarget(prev[i], next[i])) return true;
  }
  return false;
}

function mutateQuestTargets(questId, mutator){
  if (!questId || typeof mutator !== 'function') return;
  const quest = getQuestState(questId);
  if (!quest) return;
  const prevTargets = Array.isArray(quest.data?.targets) ? quest.data.targets : [];
  const working = prevTargets.map(cloneQuestTarget);
  const nextTargets = mutator(working) || working;
  if (!Array.isArray(nextTargets)) return;
  if (!targetsChanged(prevTargets, nextTargets)) return;
  updateQuestData(questId, { targets: nextTargets });
}

function applyStatusTransition(target, status){
  if (!target) return target;
  const finalStatus = target.status === QUEST_TARGET_STATUS.COMPLETED
    ? QUEST_TARGET_STATUS.COMPLETED
    : status;
  if (finalStatus === target.status) return target;
  return { ...target, status: finalStatus };
}

function markQuestTargetStatus(questId, predicate, status){
  if (!questId || typeof predicate !== 'function' || !status) return;
  mutateQuestTargets(questId, targets => {
    let changed = false;
    const next = targets.map(target => {
      if (!predicate(target)) return target;
      const updated = applyStatusTransition(target, status);
      if (updated !== target) changed = true;
      return updated;
    });
    return changed ? next : targets;
  });
}

function markQuestTargetStatusById(questId, targetId, status){
  if (!questId || !targetId) return;
  markQuestTargetStatus(questId, target => target.id === targetId, status);
}

function markQuestTargetsByPhase(eventState, phase, status){
  if (!eventState?.questId || !phase?.id) return;
  markQuestTargetStatus(eventState.questId, target => target.phaseId === phase.id, status);
}

function syncQuestTargetsWithQuestStage(eventState){
  if (!eventState?.questId) return;
  const quest = getQuestState(eventState.questId);
  if (!quest) return;
  const phases = eventState.def?.phases || [];
  const currentStage = quest.data?.stage || quest.stage;
  const currentIndex = phases.findIndex(phase => phase.id === currentStage);
  const questCompleted = quest.status === 'completed' || eventState.completed;
  mutateQuestTargets(eventState.questId, targets => {
    let changed = false;
    const next = targets.map(target => {
      const phaseIndex = phases.findIndex(phase => phase.id === target.phaseId);
      let desiredStatus = target.status;
      if (questCompleted){
        desiredStatus = QUEST_TARGET_STATUS.COMPLETED;
      } else if (phaseIndex < 0){
        desiredStatus = target.status;
      } else if (currentIndex < 0){
        desiredStatus = target.status === QUEST_TARGET_STATUS.COMPLETED
          ? QUEST_TARGET_STATUS.COMPLETED
          : QUEST_TARGET_STATUS.PENDING;
      } else if (phaseIndex < currentIndex){
        desiredStatus = QUEST_TARGET_STATUS.COMPLETED;
      } else if (phaseIndex === currentIndex){
        desiredStatus = target.status === QUEST_TARGET_STATUS.COMPLETED
          ? QUEST_TARGET_STATUS.COMPLETED
          : QUEST_TARGET_STATUS.ACTIVE;
      } else if (target.status === QUEST_TARGET_STATUS.COMPLETED){
        desiredStatus = QUEST_TARGET_STATUS.COMPLETED;
      } else {
        desiredStatus = QUEST_TARGET_STATUS.PENDING;
      }
      const updated = applyStatusTransition(target, desiredStatus);
      if (updated !== target){
        changed = true;
        return updated;
      }
      return target;
    });
    return changed ? next : targets;
  });
}

function markTaskTargetComplete(eventState, phase, task){
  if (!eventState?.questId || !task) return;
  const targetId = resolveTaskTargetId(eventState.def, phase, task);
  if (!targetId) return;
  markQuestTargetStatusById(eventState.questId, targetId, QUEST_TARGET_STATUS.COMPLETED);
}

function updateSpawnTargetStatus(eventState, phase){
  if (!eventState?.questId || !phase?.spawn) return;
  const spawnId = buildSpawnTargetId(eventState.def, phase);
  if (!spawnId) return;
  const spawned = eventState.spawnedPhaseIds instanceof Set && eventState.spawnedPhaseIds.has(phase.id);
  if (!spawned) return;
  const guards = Array.isArray(eventState.guards) ? eventState.guards : [];
  const alive = guards.some(guard => guard && state.npcs.includes(guard) && guard.health > 0);
  markQuestTargetStatusById(
    eventState.questId,
    spawnId,
    alive ? QUEST_TARGET_STATUS.ACTIVE : QUEST_TARGET_STATUS.COMPLETED
  );
}

function ensurePhaseState(eventState, phase){
  if (!eventState.phaseStates) eventState.phaseStates = new Map();
  if (!phase) return null;
  let phaseState = eventState.phaseStates.get(phase.id);
  if (!phaseState){
    phaseState = {
      dwellTimer: 0,
      playerInside: false,
      subtasks: Array.isArray(phase.tasks)
        ? phase.tasks.map(task => ({
          id: task.id,
          completed: false,
          triggered: false,
          encounterActive: false,
          encounterObjective: null,
          encounterRefs: [],
          completionToastShown: false
        }))
        : [],
      spawned: false
    };
    eventState.phaseStates.set(phase.id, phaseState);
  }
  return phaseState;
}

function registerWorldEventQuests(){
  for (const def of WORLD_EVENTS){
    const phaseLabels = def.phases.reduce((acc, phase) => {
      acc[phase.id] = phase.name;
      return acc;
    }, {});
    const questTargets = createQuestTargetsForWorldEvent(def);
    const narrativeHint = {
      'fae-witness': 'A fairy\'s trail flickers beyond Moonfen—follow the shimmer to its source.',
      'mire-whispers': 'The swamp has gone silent near an old shrine; something is strangling it.',
      'ember-watch': 'Ash on the wind means raiders testing the road. Track their embers to the ambush.'
    }[def.id] || {
      'fae-witness': 'Villagers mentioned turquoise motes drifting above the eastern grove at dusk.',
      'mire-whispers': 'Someone swore the swamp went silent near an old shrine—worth checking after nightfall.',
      'ember-watch': 'Ash is blowing from the northern track; raiders don\'t hide their drums forever.'
    }[def.id] || '';

    registerQuestDefinition({
      id: def.questId,
      source: 'world',
      title: def.title,
      description: {
        'fae-witness': 'Turquoise motes ripple above the Moonfen treeline; something fae is watching.',
        'mire-whispers': 'An eerie hush spreads through the bog as a shrine struggles beneath a curse.',
        'ember-watch': 'Ash rides the wind near the supply road—raiders are testing Moonfen\'s patrols.'
      }[def.id] || def.title,
      detail: {
        'fae-witness': 'Follow shimmering signs, bribe a fairy, then outsmart the scouts circling ancient runestones.',
        'mire-whispers': 'Trace withered reeds, gather the reagents the spirits request, and cleanse the shrine.',
        'ember-watch': 'Read the battlefield with your senses and break the raider ambush along the supply road.'
      }[def.id] || '',
      intelHint: {
        'fae-witness': 'Villagers mentioned turquoise motes drifting above the eastern grove at dusk.',
        'mire-whispers': 'Someone swore the swamp went silent near an old shrine—worth checking after nightfall.',
        'ember-watch': 'Ash is blowing from the northern track; raiders don\'t hide their drums forever.'
      }[def.id] || '',
      rumor: {
        'fae-witness': 'Fireflies swirling in formation? Sounds like the fae gossiping again.',
        'mire-whispers': 'Lantern bearers mutter that the swamp breathes wrong east of Moonfen.',
        'ember-watch': 'Merchants talk about ash drifting across the northern road—keep your blade ready.'
      }[def.id] || '',
      narrativeHint,
      stages: ['investigation', 'exploration', 'challenge', 'resolution'],
      initialStatus: 'hidden',
      initialStage: 'investigation',
      initialData: { stage: 'investigation', targets: questTargets.map(cloneQuestTarget) },
      getProgressText(quest){
        const stage = quest.data?.stage || 'investigation';
        if (stage === 'completed') return 'The event has been resolved.';
        const label = phaseLabels[stage] || 'Follow the signs.';
        return label;
      },
      onDiscover(){
        return `Quest added: ${def.title}`;
      },
      onComplete(quest, definition, options){
        if (def.id === 'fae-witness'){
          adjustDarkMuster(-2);
          addThreat(-14);
          return 'With the runestones secured, Moonfen\'s wards strengthen and the Dark muster wavers.';
        }
        if (def.id === 'mire-whispers'){
          adjustDarkMuster(-3);
          addThreat(-18);
          return 'The swamp exhales—Moonfen feels the curse lift as the shrine stills.';
        }
        if (def.id === 'ember-watch'){
          addThreat(-20);
          state.player.gold += 18;
          toast('Spoils recovered: +18 gold.', 2.4);
          return 'The raider ambush is shattered; Moonfen enjoys a brief respite.';
        }
        return null;
      }
    });
    const quest = getQuestState(def.questId);
    if (quest && (!Array.isArray(quest.data?.targets) || !quest.data.targets.length)){
      updateQuestData(def.questId, { targets: questTargets.map(cloneQuestTarget) });
    }
  }
}

function initWorldEvents(){
  registerWorldEventQuests();
  state.worldEventProps = [];
  state.worldEvents = WORLD_EVENTS.map(def => ({
    id: def.id,
    questId: def.questId,
    def,
    phaseIndex: 0,
    discovered: false,
    phaseStates: new Map(),
    spawnedPhaseIds: new Set(),
    encounterRefs: new Map(),
    cycle: Math.random() * Math.PI * 2,
    completed: false
  }));
  state.worldEvents.forEach(eventState => syncQuestTargetsWithQuestStage(eventState));
}

function getWorldEventState(eventId){
  return state.worldEvents?.find(event => event.id === eventId) || null;
}

function getCurrentPhase(eventState){
  if (!eventState) return null;
  if (eventState.completed) return null;
  return eventState.def.phases[eventState.phaseIndex] || null;
}

function findPhaseForTask(eventState, taskId){
  if (!eventState || !taskId) return null;
  return eventState.def.phases.find(phase => Array.isArray(phase.tasks) && phase.tasks.some(task => task.id === taskId)) || null;
}

function discoverEvent(eventState, reason = 'sight'){
  if (!eventState || eventState.discovered) return;
  eventState.discovered = true;
  const questId = eventState.questId;
  if (questId){
    const result = unlockQuest(questId, { merge: { discoveredBy: reason } });
    if (result?.changed && result.message){
      toast(result.message, 2.6);
    }
    activateQuest(questId, { merge: { stage: eventState.def.phases[0]?.id || 'investigation' } });
    updateQuestData(questId, { stage: eventState.def.phases[0]?.id || 'investigation' });
    syncQuestTargetsWithQuestStage(eventState);
  }
}

function advanceEventPhase(eventState, options = {}){
  if (!eventState || eventState.completed) return;
  const currentPhase = getCurrentPhase(eventState);
  if (!currentPhase) return;
  const phaseState = ensurePhaseState(eventState, currentPhase);
  if (phaseState){
    phaseState.playerInside = false;
  }
  markQuestTargetsByPhase(eventState, currentPhase, QUEST_TARGET_STATUS.COMPLETED);
  eventState.phaseIndex = Math.min(eventState.phaseIndex + 1, eventState.def.phases.length);
  const nextPhase = eventState.def.phases[eventState.phaseIndex];
  const questId = eventState.questId;
  if (!nextPhase){
    eventState.completed = true;
    if (questId){
      updateQuestData(questId, { stage: 'resolution' });
      syncQuestTargetsWithQuestStage(eventState);
    }
    return;
  }
  const phaseId = nextPhase.id;
  if (questId){
    updateQuestData(questId, { stage: phaseId });
    syncQuestTargetsWithQuestStage(eventState);
  }
}

function completeWorldEvent(eventId, options = {}){
  const eventState = getWorldEventState(eventId);
  if (!eventState || eventState.completed) return { changed: false };
  eventState.completed = true;
  eventState.phaseIndex = eventState.def.phases.length;
  if (eventState.guards && eventState.guards.length){
    for (const guard of eventState.guards){
      if (guard && state.npcs.includes(guard)){
        removeNPC(guard);
      }
    }
    eventState.guards.length = 0;
  }
  if (eventState.encounterRefs){
    for (const refs of eventState.encounterRefs.values()){
      for (const npc of refs){
        if (npc && state.npcs.includes(npc)){
          removeNPC(npc);
        }
      }
    }
    eventState.encounterRefs.clear();
  }
  if (Array.isArray(state.worldEventProps)){
    for (const prop of state.worldEventProps){
      if (prop.eventId === eventState.id){
        prop.resolved = true;
      }
    }
  }
  const questId = eventState.questId;
  if (questId){
    const result = completeQuest(questId, { merge: { stage: 'completed', completedAt: state.time } });
    if (result?.changed && result.message){
      toast(result.message, 2.8);
    }
    syncQuestTargetsWithQuestStage(eventState);
  }
  return { changed: true };
}

function phaseCenter(phase, eventState){
  if (!phase) return { x: eventState?.def?.anchor?.x || 0, y: eventState?.def?.anchor?.y || 0 };
  return phase.focus || eventState?.def?.anchor || { x: 0, y: 0 };
}

function ensurePhaseSpawn(eventState, phase){
  if (!phase || !phase.spawn) return;
  if (eventState.spawnedPhaseIds?.has(phase.id)) return;
  eventState.spawnedPhaseIds.add(phase.id);
  const center = phaseCenter(phase, eventState);
  const guards = [];
  const count = clamp(Math.floor(phase.spawn.count ?? 1), 1, 6);
  const radius = phase.spawn.patrolRadius ?? 120;
  for (let i = 0; i < count; i++){
    const angle = (i / count) * Math.PI * 2;
    const px = center.x + Math.cos(angle) * radius;
    const py = center.y + Math.sin(angle) * radius;
    const npc = makeNPC(phase.spawn.type || 'raider', px, py, null, {
      behaviorState: NPC_STATE.PATROL,
      role: 'event-guard',
      holdPosition: false,
      eventId: eventState.id
    });
    npc.patrolPauseRange = [0.6, 1.6];
    npc.waypoints = [
      { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
      { x: center.x + Math.cos(angle + Math.PI / 2) * radius * 0.6, y: center.y + Math.sin(angle + Math.PI / 2) * radius * 0.6 }
    ];
    npc.wpIndex = 0;
    state.npcs.push(npc);
    guards.push(npc);
  }
  if (!eventState.guards){
    eventState.guards = [];
  }
  eventState.guards.push(...guards);
}

function ensurePhaseProps(eventState, phase){
  if (!phase || !Array.isArray(phase.props) || !phase.props.length) return;
  if (!Array.isArray(state.worldEventProps)) state.worldEventProps = [];
  for (const prop of phase.props){
    if (!prop?.id) continue;
    let entry = state.worldEventProps.find(item => item.id === prop.id);
    const position = prop.position || phase.focus || eventState?.def?.anchor || { x: 0, y: 0 };
    if (!entry){
      entry = {
        id: prop.id,
        type: prop.type || 'structure',
        x: position.x,
        y: position.y,
        radius: prop.radius ?? phase.radius ?? 80,
        eventId: eventState.id,
        phaseId: phase.id,
        taskId: prop.taskId || null,
        orientation: prop.orientation ?? 0,
        scale: prop.scale ?? 1,
        resolved: false,
        meta: prop.meta ? { ...prop.meta } : {}
      };
      state.worldEventProps.push(entry);
    } else {
      entry.eventId = eventState.id;
      entry.phaseId = phase.id;
      entry.taskId = entry.taskId || prop.taskId || null;
      entry.meta = prop.meta ? { ...prop.meta } : entry.meta;
      if (typeof prop.orientation === 'number') entry.orientation = prop.orientation;
      if (typeof prop.scale === 'number') entry.scale = prop.scale;
      entry.x = position.x;
      entry.y = position.y;
      entry.radius = prop.radius ?? entry.radius;
    }
  }
}

function resolveEncounterBehavior(behavior){
  if (behavior === 'ambush' || behavior === 'aggressive') return NPC_STATE.ALERT;
  if (behavior === 'suspicious') return NPC_STATE.SUSPICIOUS;
  return NPC_STATE.PATROL;
}

function spawnTaskEncounter(eventState, phase, task){
  if (!task?.encounter?.spawn) return [];
  const spawn = task.encounter.spawn;
  const center = task.encounter.center || task.position || phaseCenter(phase, eventState);
  const count = clamp(Math.floor(spawn.count ?? 1), 1, 6);
  const radius = spawn.radius ?? 120;
  const behavior = resolveEncounterBehavior(spawn.behavior);
  const refs = [];
  for (let i = 0; i < count; i++){
    const angle = (i / count) * Math.PI * 2;
    const px = center.x + Math.cos(angle) * radius;
    const py = center.y + Math.sin(angle) * radius;
    const npc = makeNPC(spawn.type || 'raider', px, py, null, {
      behaviorState: behavior,
      role: 'event-encounter',
      holdPosition: spawn.behavior === 'stationary',
      eventId: eventState.id
    });
    if (behavior === NPC_STATE.ALERT){
      npc.holdPosition = false;
    }
    npc.assignedTaskId = task.id;
    state.npcs.push(npc);
    refs.push(npc);
  }
  if (!eventState.encounterRefs){
    eventState.encounterRefs = new Map();
  }
  eventState.encounterRefs.set(task.id, refs);
  return refs;
}

function getPhaseTask(eventState, phase, taskId){
  if (!phase || !Array.isArray(phase.tasks)) return null;
  return phase.tasks.find(task => task.id === taskId) || null;
}

function startTaskEncounter(eventState, phase, task, tracker){
  if (!task?.encounter || !tracker || tracker.triggered) return false;
  tracker.triggered = true;
  tracker.encounterObjective = task.encounter.objective || 'defeat-all';
  if (task.encounter.toast){
    toast(task.encounter.toast, 2.6);
  }
  tracker.encounterRefs = spawnTaskEncounter(eventState, phase, task);
  tracker.encounterActive = tracker.encounterRefs.length > 0;
  return tracker.encounterActive;
}

function isWorldEventPhaseActive(eventId, phaseId){
  const eventState = getWorldEventState(eventId);
  if (!eventState) return false;
  const index = eventState.def.phases.findIndex(phase => phase.id === phaseId);
  if (index < 0) return false;
  if (eventState.completed) return false;
  return eventState.phaseIndex === index;
}

function hasWorldEventCompletedPhase(eventId, phaseId){
  const eventState = getWorldEventState(eventId);
  if (!eventState) return false;
  const index = eventState.def.phases.findIndex(phase => phase.id === phaseId);
  if (index < 0) return false;
  return eventState.phaseIndex > index || eventState.completed;
}

function updatePhaseTasks(eventState, phase, phaseState){
  if (!phase || !Array.isArray(phase.tasks) || !phaseState) return;
  const player = state.player;
  for (const task of phase.tasks){
    const tracker = phaseState.subtasks?.find(item => item.id === task.id);
    if (!tracker) continue;
    if (tracker.encounterActive){
      tracker.encounterRefs = tracker.encounterRefs.filter(npc => npc && state.npcs.includes(npc) && npc.health > 0);
      if (!tracker.encounterRefs.length){
        tracker.encounterActive = false;
        tracker.completed = true;
        markTaskTargetComplete(eventState, phase, task);
        if (task.propId){
          resolveWorldEventProp(task.propId);
        }
        if (task.encounter?.completionToast && !tracker.completionToastShown){
          toast(task.encounter.completionToast, 2.6);
          tracker.completionToastShown = true;
        }
        if (eventState.encounterRefs){
          eventState.encounterRefs.delete(task.id);
        }
      }
    }
    if (tracker.completed) continue;
    if (task.poiId){
      const poi = state.pointsOfInterest?.find(item => item.id === task.poiId);
      if (poi?.resolved){
        if (task.encounter){
          startTaskEncounter(eventState, phase, task, tracker);
        } else {
          tracker.completed = true;
          markTaskTargetComplete(eventState, phase, task);
          if (task.propId){
            resolveWorldEventProp(task.propId);
          }
        }
      }
      continue;
    }
    if (task.autoComplete === false) continue;
    if (task.position){
      const dist = Math.hypot(player.x - task.position.x, player.y - task.position.y);
      if (dist <= (task.radius ?? 80)){
        tracker.completed = true;
        markTaskTargetComplete(eventState, phase, task);
        if (task.propId){
          resolveWorldEventProp(task.propId);
        }
        toast(task.description, 2.4);
      }
    }
  }
  if (phaseState.subtasks && phaseState.subtasks.length){
    const allDone = phaseState.subtasks.every(item => item.completed);
    const current = getCurrentPhase(eventState);
    if (allDone && current && current.id === phase.id){
      advanceEventPhase(eventState, { reason: 'tasks-complete' });
    }
  }
}

function completeEventTask(eventId, taskId){
  if (!eventId || !taskId) return false;
  const eventState = getWorldEventState(eventId);
  if (!eventState) return false;
  const phase = findPhaseForTask(eventState, taskId);
  if (!phase) return false;
  const phaseState = ensurePhaseState(eventState, phase);
  if (!phaseState?.subtasks?.length) return false;
  const tracker = phaseState.subtasks.find(item => item.id === taskId);
  if (!tracker || tracker.completed) return false;
  if (tracker.encounterActive) return false;
  const task = getPhaseTask(eventState, phase, taskId);
  tracker.completed = true;
  if (task?.propId){
    resolveWorldEventProp(task.propId);
  }
  markTaskTargetComplete(eventState, phase, task);
  const allDone = phaseState.subtasks.every(item => item.completed);
  if (allDone){
    const current = getCurrentPhase(eventState);
    if (current && current.id === phase.id){
      advanceEventPhase(eventState, { reason: 'task-complete' });
    }
  }
  return true;
}

function triggerEventTaskEncounter(eventId, taskId){
  if (!eventId || !taskId) return false;
  const eventState = getWorldEventState(eventId);
  if (!eventState) return false;
  const phase = findPhaseForTask(eventState, taskId);
  if (!phase) return false;
  const current = getCurrentPhase(eventState);
  if (!current || current.id !== phase.id) return false;
  const phaseState = ensurePhaseState(eventState, phase);
  if (!phaseState?.subtasks?.length) return false;
  const tracker = phaseState.subtasks.find(item => item.id === taskId);
  if (!tracker || tracker.completed) return false;
  const task = getPhaseTask(eventState, phase, taskId);
  return startTaskEncounter(eventState, phase, task, tracker);
}

function resolveWorldEventProp(propId){
  if (!propId) return false;
  if (!Array.isArray(state.worldEventProps)) return false;
  const prop = state.worldEventProps.find(item => item.id === propId);
  if (!prop) return false;
  if (prop.resolved) return false;
  prop.resolved = true;
  const eventState = getWorldEventState(prop.eventId);
  if (eventState?.questId){
    markQuestTargetStatusById(eventState.questId, prop.id, QUEST_TARGET_STATUS.COMPLETED);
  }
  return true;
}

function updateWorldEvents(dt){
  if (!Array.isArray(state.worldEvents)) return;
  const player = state.player;
  for (const eventState of state.worldEvents){
    if (!eventState) continue;
    eventState.cycle = (eventState.cycle || 0) + dt;
    const phase = getCurrentPhase(eventState);
    if (!phase){
      continue;
    }
    const phaseState = ensurePhaseState(eventState, phase);
    const center = phaseCenter(phase, eventState);
    const dist = Math.hypot(player.x - center.x, player.y - center.y);
    const inside = dist <= (phase.radius ?? 220);
    if (inside){
      discoverEvent(eventState);
      if (phase.autoAdvance === 'proximity' && !phase.interaction && !Array.isArray(phase.tasks)){
        phaseState.dwellTimer += dt;
        if (phaseState.dwellTimer >= PHASE_DWELL_TIME){
          advanceEventPhase(eventState, { reason: 'proximity' });
        }
      }
    } else {
      phaseState.dwellTimer = Math.max(0, phaseState.dwellTimer - dt * 0.5);
    }
    updatePhaseTasks(eventState, phase, phaseState);
    ensurePhaseSpawn(eventState, phase);
    updateSpawnTargetStatus(eventState, phase);
    ensurePhaseProps(eventState, phase);
  }
}

function handleWorldEventInteraction(interactPressed){
  if (!Array.isArray(state.worldEvents)) return false;
  let consumed = false;
  const player = state.player;
  for (const eventState of state.worldEvents){
    if (!eventState || eventState.completed) continue;
    const phase = getCurrentPhase(eventState);
    if (!phase) continue;
    const phaseState = ensurePhaseState(eventState, phase);
    const center = phaseCenter(phase, eventState);
    const dist = Math.hypot(player.x - center.x, player.y - center.y);
    const inside = dist <= (phase.radius ?? 220);
    if (!phaseState) continue;
    if (inside && !phaseState.playerInside && phase.prompt){
      toast(phase.prompt, 2.4);
    }
    phaseState.playerInside = inside;
    if (!inside) continue;
    if (consumed) continue;
    if (!interactPressed) continue;
    if (!phase.interaction){
      continue;
    }
    const interaction = phase.interaction;
    if (typeof interaction.costGold === 'number' && player.gold < interaction.costGold){
      toast(`You need ${interaction.costGold} gold.`, 1.8);
      consumed = true;
      continue;
    }
    if (interaction.costGold){
      player.gold -= interaction.costGold;
    }
    if (interaction.clue){
      toast(interaction.clue, 3.6);
    }
    if (interaction.successToast){
      toast(interaction.successToast, 2.6);
    }
    advanceEventPhase(eventState, { reason: 'interaction' });
    consumed = true;
  }
  return consumed;
}

function canResolveEventPoi(poi){
  if (!poi || !poi.eventId || !poi.requiredPhase) return true;
  return isWorldEventPhaseActive(poi.eventId, poi.requiredPhase);
}

export {
  initWorldEvents,
  updateWorldEvents,
  handleWorldEventInteraction,
  getWorldEventState,
  isWorldEventPhaseActive,
  hasWorldEventCompletedPhase,
  completeWorldEvent,
  canResolveEventPoi,
  completeEventTask,
  triggerEventTaskEncounter,
  resolveWorldEventProp
};
