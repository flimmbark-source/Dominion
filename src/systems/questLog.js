import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';

const DEFAULT_STAGES = ['trigger', 'objective', 'resolution'];
const questDefinitions = new Map();

function ensureQuestArray(){
  if (!Array.isArray(state.quests)){
    state.quests = [];
  }
}

function getStageForStatus(status, stages = DEFAULT_STAGES){
  if (!Array.isArray(stages) || stages.length === 0) stages = DEFAULT_STAGES;
  switch (status){
    case 'active':
      return stages[1] ?? stages[0];
    case 'ready':
    case 'completed':
      return stages[2] ?? stages[stages.length - 1] ?? stages[0];
    case 'available':
    case 'hidden':
    default:
      return stages[0];
  }
}

function registerQuestDefinition(definition){
  if (!definition || !definition.id){
    throw new Error('Quest definition requires an id');
  }
  const normalized = {
    source: 'world',
    stages: DEFAULT_STAGES,
    initialStatus: 'hidden',
    initialStage: null,
    initialData: {},
    ...definition
  };
  if (!Array.isArray(normalized.stages) || normalized.stages.length === 0){
    normalized.stages = DEFAULT_STAGES;
  }
  questDefinitions.set(normalized.id, normalized);
  ensureQuestEntry(normalized);
  return normalized;
}

function ensureQuestEntry(def){
  ensureQuestArray();
  let quest = state.quests.find(item => item && item.id === def.id);
  if (!quest){
    const status = def.initialStatus ?? (def.source === 'tavern' ? 'available' : 'hidden');
    quest = {
      id: def.id,
      status,
      stage: def.initialStage ?? getStageForStatus(status, def.stages),
      source: def.source,
      data: { ...(def.initialData || {}) },
      discoveredAt: status !== 'hidden' ? state.time : -Infinity,
      acceptedAt: -Infinity,
      readyAt: -Infinity,
      completedAt: -Infinity,
      lastUpdatedAt: state.time
    };
    state.quests.push(quest);
  }
  return quest;
}

function getQuestDefinition(id){
  return questDefinitions.get(id) ?? null;
}

function getQuestState(id){
  ensureQuestArray();
  const quest = state.quests.find(item => item && item.id === id) || null;
  if (quest && !questDefinitions.has(id)){
    return null;
  }
  return quest;
}

function updateQuestRecord(quest, status, time){
  if (!quest) return;
  const def = getQuestDefinition(quest.id);
  quest.status = status;
  quest.stage = getStageForStatus(status, def?.stages);
  quest.lastUpdatedAt = time;
  if (status === 'available' && quest.discoveredAt < 0){
    quest.discoveredAt = time;
  }
  if (status === 'active'){
    quest.acceptedAt = time;
  }
  if (status === 'ready'){
    quest.readyAt = time;
  }
  if (status === 'completed'){
    quest.completedAt = time;
  }
}

function mergeQuestData(quest, patch){
  if (!quest) return;
  quest.data = quest.data || {};
  if (!patch) return;
  quest.data = { ...quest.data, ...patch };
}

function unlockQuest(id, options = {}){
  const def = getQuestDefinition(id);
  if (!def) return { changed: false, quest: null, def: null, message: null };
  const quest = ensureQuestEntry(def);
  if (quest.status !== 'hidden'){
    if (options.merge){
      mergeQuestData(quest, options.merge);
    }
    return { changed: false, quest, def, message: null };
  }
  mergeQuestData(quest, options.merge);
  const time = options.time ?? state.time;
  updateQuestRecord(quest, 'available', time);
  let message = null;
  if (typeof def.onDiscover === 'function'){
    message = def.onDiscover(quest, def, options) ?? null;
  }
  return { changed: true, quest, def, message };
}

function hideQuest(id, options = {}){
  const def = getQuestDefinition(id);
  if (!def) return { changed: false, quest: null, def: null, message: null };
  const quest = ensureQuestEntry(def);
  if (quest.status === 'hidden'){
    if (options.merge){
      mergeQuestData(quest, options.merge);
    }
    return { changed: false, quest, def, message: null };
  }
  mergeQuestData(quest, options.merge);
  const time = options.time ?? state.time;
  updateQuestRecord(quest, 'hidden', time);
  return { changed: true, quest, def, message: null };
}

function activateQuest(id, options = {}){
  const def = getQuestDefinition(id);
  if (!def) return { changed: false, quest: null, def: null, message: null };
  const quest = ensureQuestEntry(def);
  const time = options.time ?? state.time;
  const wasActive = quest.status === 'active';
  if (!wasActive){
    mergeQuestData(quest, options.merge);
    updateQuestRecord(quest, 'active', time);
  } else if (options.merge){
    mergeQuestData(quest, options.merge);
  }
  let message = null;
  if ((typeof def.onAccept === 'function') && (!wasActive || options.force)){ 
    message = def.onAccept(quest, def, options) ?? null;
  }
  return { changed: !wasActive, quest, def, message };
}

function markQuestReady(id, options = {}){
  const def = getQuestDefinition(id);
  if (!def) return { changed: false, quest: null, def: null, message: null };
  const quest = ensureQuestEntry(def);
  const time = options.time ?? state.time;
  if (quest.status === 'ready' || quest.status === 'completed'){
    if (options.merge){
      mergeQuestData(quest, options.merge);
    }
    return { changed: false, quest, def, message: null };
  }
  mergeQuestData(quest, options.merge);
  updateQuestRecord(quest, 'ready', time);
  let message = null;
  if (typeof def.onReady === 'function'){
    message = def.onReady(quest, def, options) ?? null;
  }
  return { changed: true, quest, def, message };
}

function completeQuest(id, options = {}){
  const def = getQuestDefinition(id);
  if (!def) return { changed: false, quest: null, def: null, message: null };
  const quest = ensureQuestEntry(def);
  const time = options.time ?? state.time;
  if (quest.status === 'completed'){
    if (options.merge){
      mergeQuestData(quest, options.merge);
    }
    return { changed: false, quest, def, message: null };
  }
  mergeQuestData(quest, options.merge);
  updateQuestRecord(quest, 'completed', time);
  let message = null;
  if (typeof def.onComplete === 'function'){
    message = def.onComplete(quest, def, options) ?? null;
  }
  return { changed: true, quest, def, message };
}

function updateQuestData(id, patch){
  const quest = getQuestState(id);
  if (!quest) return null;
  mergeQuestData(quest, patch);
  return quest;
}

function getQuestStatusLabel(status){
  switch (status){
    case 'available': return 'Available';
    case 'active': return 'In progress';
    case 'ready': return 'Ready to turn in';
    case 'completed': return 'Completed';
    case 'hidden':
    default:
      return 'Hidden';
  }
}

function getQuestEntries({ source, includeHidden = false } = {}){
  ensureQuestArray();
  return state.quests
    .map(quest => {
      if (!quest) return null;
      const def = getQuestDefinition(quest.id);
      if (!def) return null;
      if (source && def.source !== source) return null;
      if (!includeHidden && quest.status === 'hidden') return null;
      return { quest, def };
    })
    .filter(Boolean);
}

function getQuestDescriptors(options = {}){
  const entries = getQuestEntries(options);
  return entries.map(({ quest, def }) => ({
    id: quest.id,
    title: def.title,
    description: def.description,
    detail: def.detail,
    narrative: def.narrative || null,
    status: quest.status,
    statusLabel: getQuestStatusLabel(quest.status),
    progress: typeof def.getProgressText === 'function' ? def.getProgressText(quest, def) : ''
  }));
}

function getQuestIntelHints({ source, includeCompleted = false } = {}){
  const hints = [];
  const entries = getQuestEntries({ source, includeHidden: true });
  for (const { quest, def } of entries){
    if (!def.intelHint) continue;
    if (!includeCompleted && quest.status === 'completed') continue;
    if (quest.status === 'completed' && !includeCompleted) continue;
    hints.push({ questId: quest.id, text: def.intelHint, status: quest.status });
  }
  return hints;
}

function getQuestRumors(){
  const rumors = [];
  const entries = getQuestEntries({ includeHidden: true });
  for (const { quest, def } of entries){
    if (!def.rumor) continue;
    if (quest.status === 'completed') continue;
    rumors.push({ questId: quest.id, text: def.rumor, status: quest.status });
  }
  return rumors;
}

function adjustDarkMuster(amount){
  if (!state.darkStrategy) return;
  state.darkStrategy.muster = clamp((state.darkStrategy.muster ?? 0) + amount, 0, 999);
}

export {
  registerQuestDefinition,
  getQuestDefinition,
  getQuestState,
  getQuestEntries,
  getQuestDescriptors,
  getQuestStatusLabel,
  getQuestIntelHints,
  getQuestRumors,
  unlockQuest,
  hideQuest,
  activateQuest,
  markQuestReady,
  completeQuest,
  updateQuestData,
  adjustDarkMuster
};
