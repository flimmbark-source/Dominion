import { state } from '../state/gameState.js';
import { addThreat } from './threat.js';
import { toast } from '../ui/toast.js';
import { pressOnce } from '../input/pressOnce.js';

const missionDefinitions = [
  {
    id: 'disarm-traps',
    title: 'Cut Their Tripwires',
    description: 'Disarm the three alarm snares strung around the village square. Each one keeps the villagers jumpy.',
    detail: 'Slip between patrols and disable the traps hidden near the grain cart, the well, and the watch post.',
    getProgressText(missionState){
      const traps = Array.isArray(state.villageTasks) ? state.villageTasks.filter(task => task.type === 'trap') : [];
      const total = traps.length;
      const completed = traps.filter(task => task.completed).length;
      return total > 0 ? `${completed}/${total} traps quieted.` : 'No traps spotted—check the square again soon.';
    },
    checkReady(){
      const traps = Array.isArray(state.villageTasks) ? state.villageTasks.filter(task => task.type === 'trap') : [];
      return traps.length > 0 && traps.every(task => task.completed);
    },
    onAccept(missionState){
      const traps = Array.isArray(state.villageTasks) ? state.villageTasks.filter(task => task.type === 'trap') : [];
      missionState.data = { ...(missionState.data || {}), trackedTrapIds: traps.map(task => task.id), notifiedReady: false };
      for (const trap of traps){
        trap.missionFocus = missionState.id;
      }
      return 'He slides a crude map across the bar, marking each tripwire with a green X.';
    },
    onTurnIn(missionState){
      const traps = Array.isArray(state.villageTasks) ? state.villageTasks.filter(task => task.type === 'trap') : [];
      for (const trap of traps){
        if (trap.missionFocus === missionState.id) delete trap.missionFocus;
      }
      addThreat(-22);
      return '"The village sleeps easier," the barkeep whispers, passing you a weighty pouch. Threat eases.';
    }
  },
  {
    id: 'cool-threat',
    title: 'Let the Heat Die Down',
    description: 'Lay low until the village threat drops to a simmer. No dramatic moves—just patience.',
    detail: 'Stay unseen until the threat falls below 20 and the villagers stop searching. The barkeep listens for calm streets.',
    getProgressText(){
      const threat = Math.round(state.threat);
      const unseen = Math.floor(state.timeSinceSeen ?? 0);
      return `Threat ${threat}/20 · unseen ${unseen}s`;
    },
    checkReady(missionState){
      const calmEnough = state.threat <= 20;
      const unseenLongEnough = (state.timeSinceSeen ?? 0) >= 20;
      if (calmEnough && unseenLongEnough){
        missionState.data = { ...(missionState.data || {}), calmMetAt: missionState.data?.calmMetAt ?? state.time };
        return true;
      }
      missionState.data = { ...(missionState.data || {}), calmMetAt: null };
      return false;
    },
    onAccept(missionState){
      missionState.data = { ...(missionState.data || {}), calmMetAt: null, notifiedReady: false };
      return '"Fade for a while," he murmurs. "Let their torches gutter out."';
    },
    onTurnIn(){
      addThreat(-12);
      return 'The barkeep grins. "They\'ve relaxed. Use that breathing room." Threat slips downward.';
    }
  }
];

const missionById = new Map(missionDefinitions.map(def => [def.id, def]));

function initBarkeepMissions(){
  if (!Array.isArray(state.barkeepMissions)){
    state.barkeepMissions = missionDefinitions.map(def => ({
      id: def.id,
      status: 'available',
      acceptedAt: -Infinity,
      completedAt: -Infinity,
      readyAt: -Infinity,
      data: {}
    }));
  }
}

function isBarkeepDialogueActive(){
  return !!state.tavernInteriorState.dialog;
}

function startBarkeepConversation(){
  initBarkeepMissions();
  state.tavernInteriorState.dialog = {
    view: 'root',
    response: null,
    lastIntel: null,
    focusMissionId: null
  };
}

function closeBarkeepConversation(){
  state.tavernInteriorState.dialog = null;
}

function goToRoot(){
  if (!state.tavernInteriorState.dialog) return;
  state.tavernInteriorState.dialog.view = 'root';
  state.tavernInteriorState.dialog.focusMissionId = null;
}

function openIntel(refresh = false){
  const dialog = state.tavernInteriorState.dialog;
  if (!dialog) return;
  dialog.view = 'intel';
  if (refresh || !dialog.lastIntel){
    dialog.lastIntel = pickIntelLine();
  }
  dialog.response = null;
}

function openMissionList(){
  const dialog = state.tavernInteriorState.dialog;
  if (!dialog) return;
  dialog.view = 'mission-list';
  dialog.focusMissionId = null;
}

function openMissionDetail(id){
  const dialog = state.tavernInteriorState.dialog;
  if (!dialog) return;
  dialog.view = 'mission-detail';
  dialog.focusMissionId = id;
}

function getMissionState(id){
  return Array.isArray(state.barkeepMissions)
    ? state.barkeepMissions.find(mission => mission.id === id)
    : null;
}

function formatMissionStatus(status){
  switch (status){
    case 'available': return 'Available';
    case 'active': return 'In progress';
    case 'ready': return 'Ready to turn in';
    case 'completed': return 'Completed';
    default: return status || 'Unknown';
  }
}

function getMissionDescriptors(){
  if (!Array.isArray(state.barkeepMissions)) return [];
  return state.barkeepMissions
    .map(mission => {
      const def = missionById.get(mission.id);
      if (!def) return null;
      const progress = def.getProgressText ? def.getProgressText(mission) : '';
      return {
        id: mission.id,
        title: def.title,
        description: def.description,
        detail: def.detail,
        status: mission.status,
        statusLabel: formatMissionStatus(mission.status),
        progress
      };
    })
    .filter(Boolean);
}

function pickIntelLine(){
  const lines = [];
  const traps = Array.isArray(state.villageTasks) ? state.villageTasks.filter(task => task.type === 'trap') : [];
  const completed = traps.filter(task => task.completed).length;
  const remaining = Math.max(0, traps.length - completed);
  if (traps.length){
    if (remaining > 0){
      lines.push(`Tripwires still glint in the village—${remaining} more to cut before the sentries relax.`);
    } else {
      lines.push('Every tripwire in the square hangs limp. Folks are already whispering thanks.');
    }
  }

  const threat = Math.round(state.threat);
  if (threat >= 80){
    lines.push('Watchfires burn bright tonight. Scouts swarm the lanes—move like smoke.');
  } else if (threat >= 40){
    lines.push('The guards mutter about prowlers. Threat sits around ' + threat + '. Keep your hood low.');
  } else {
    lines.push('The village yawns. Keep it that way and the Dark Lord will have a clean path.');
  }

  const missionReady = getMissionDescriptors().find(mission => mission.status === 'ready');
  if (missionReady){
    lines.push(`${missionReady.title} is ready to cash in. He\'ll be pleased to hear it.`);
  }

  if (!lines.length){
    lines.push('Nothing new from the street. Calm nights mean opportunity.');
  }

  const index = Math.floor(Math.random() * lines.length);
  return lines[index];
}

function acceptMission(missionState, def){
  if (!missionState || !def) return null;
  if (missionState.status === 'completed' || missionState.status === 'ready') return null;
  missionState.status = 'active';
  missionState.acceptedAt = state.time;
  missionState.data = missionState.data || {};
  missionState.data.notifiedReady = false;
  if (typeof def.onAccept === 'function'){
    return def.onAccept(missionState);
  }
  return 'The barkeep nods and scribbles your mark beside the ledger.';
}

function turnInMission(missionState, def){
  if (!missionState || !def) return null;
  missionState.status = 'completed';
  missionState.completedAt = state.time;
  if (typeof def.onTurnIn === 'function'){
    return def.onTurnIn(missionState);
  }
  return 'He seals the deal with a quiet clink of coin.';
}

function handleBarkeepDialogueInput({ interactPressed = false, escapePressed = false } = {}){
  const dialog = state.tavernInteriorState.dialog;
  if (!dialog) return null;

  const result = { openShop: false };

  if (escapePressed){
    if (dialog.view === 'root'){
      closeBarkeepConversation();
      result.closed = true;
      return result;
    }
    if (dialog.view === 'mission-detail'){
      openMissionList();
      return result;
    }
    goToRoot();
    return result;
  }

  switch (dialog.view){
    case 'root': {
      if (pressOnce('1')){
        openIntel(true);
        return result;
      }
      if (pressOnce('2')){
        dialog.response = null;
        openMissionList();
        return result;
      }
      if (pressOnce('3')){
        closeBarkeepConversation();
        result.openShop = true;
        return result;
      }
      if (pressOnce('0') || interactPressed){
        closeBarkeepConversation();
        result.closed = true;
      }
      return result;
    }
    case 'intel': {
      if (pressOnce('1')){
        dialog.lastIntel = pickIntelLine();
        return result;
      }
      if (pressOnce('0') || interactPressed){
        goToRoot();
      }
      return result;
    }
    case 'mission-list': {
      const missions = getMissionDescriptors();
      let handled = false;
      missions.forEach((mission, index) => {
        if (handled) return;
        const key = String(index + 1);
        if (pressOnce(key)){
          openMissionDetail(mission.id);
          handled = true;
        }
      });
      if (handled) return result;
      if (pressOnce('0') || interactPressed){
        goToRoot();
      }
      return result;
    }
    case 'mission-detail': {
      const mission = getMissionState(dialog.focusMissionId);
      const def = missionById.get(dialog.focusMissionId);
      if (!mission || !def){
        openMissionList();
        return result;
      }
      if (pressOnce('1')){
        if (mission.status === 'available'){
          const message = acceptMission(mission, def);
          if (message) dialog.response = message;
          return result;
        }
        if (mission.status === 'ready'){
          const message = turnInMission(mission, def);
          if (message) dialog.response = message;
          mission.readyAt = state.time;
          if (def.id === 'disarm-traps' || def.id === 'cool-threat'){
            mission.data = mission.data || {};
            mission.data.notifiedReady = true;
          }
          return result;
        }
      }
      if (pressOnce('0') || interactPressed){
        openMissionList();
        return result;
      }
      return result;
    }
    default:
      return result;
  }
}

function updateBarkeepMissions(){
  if (!Array.isArray(state.barkeepMissions)) return;
  for (const missionState of state.barkeepMissions){
    if (!missionState) continue;
    const def = missionById.get(missionState.id);
    if (!def) continue;
    missionState.data = missionState.data || {};

    if (missionState.status === 'active' && typeof def.checkReady === 'function'){
      if (def.checkReady(missionState)){
        if (missionState.status !== 'ready'){
          missionState.status = 'ready';
          missionState.readyAt = state.time;
        }
        if (!missionState.data.notifiedReady){
          missionState.data.notifiedReady = true;
          toast(`${def.title} is ready to turn in.`, 2.4);
        }
      }
    }
  }
}

function getBarkeepDialogueState(){
  const dialog = state.tavernInteriorState.dialog;
  if (!dialog) return null;

  const missions = getMissionDescriptors();
  const response = dialog.response;

  const applyResponse = (body) => {
    if (response){
      return [{ text: response, tone: 'highlight' }, ...body];
    }
    return body;
  };

  const base = {
    title: 'Moonlit Barkeep',
    view: dialog.view
  };

  if (dialog.view === 'root'){
    return {
      ...base,
      body: applyResponse([
        { text: 'The barkeep polishes a glass beneath mossy lantern light.', tone: 'body' },
        { text: '"What\'ll it be, shadow?"', tone: 'muted' }
      ]),
      options: [
        { key: '1', label: 'Hear the latest whispers', tone: 'body' },
        { key: '2', label: 'Ask about work', tone: 'body' },
        { key: '3', label: 'Browse the contraband stash', tone: 'body' },
        { key: '0', label: 'Step away', tone: 'muted' }
      ],
      footer: 'Esc: back to the glade'
    };
  }

  if (dialog.view === 'intel'){
    return {
      ...base,
      body: applyResponse([
        { text: dialog.lastIntel || pickIntelLine(), tone: 'body' }
      ]),
      options: [
        { key: '1', label: 'Another whisper', tone: 'body' },
        { key: '0', label: 'Back to the bar', tone: 'muted' }
      ],
      footer: 'Esc: back'
    };
  }

  if (dialog.view === 'mission-list'){
    const body = missions.length
      ? [
        { text: 'Coded ledgers line the shelves. Pick a job worth your venom.', tone: 'body' }
      ]
      : [
        { text: 'No jobs tonight—the barkeep shrugs apologetically.', tone: 'muted' }
      ];
    const options = missions.map((mission, index) => ({
      key: String(index + 1),
      label: `${mission.title} — ${mission.statusLabel}`,
      tone: mission.status === 'ready' ? 'highlight' : (mission.status === 'completed' ? 'muted' : 'body')
    }));
    options.push({ key: '0', label: 'Back to idle chatter', tone: 'muted' });
    return {
      ...base,
      body: applyResponse(body),
      options,
      footer: 'Esc: back'
    };
  }

  if (dialog.view === 'mission-detail'){
    const mission = missions.find(item => item.id === dialog.focusMissionId);
    if (!mission){
      openMissionList();
      return getBarkeepDialogueState();
    }
    const body = [
      { text: mission.title, tone: 'title' },
      { text: mission.detail, tone: 'body' }
    ];
    if (mission.progress){
      body.push({ text: mission.progress, tone: 'note' });
    }
    body.push({ text: `Status: ${mission.statusLabel}`, tone: mission.status === 'ready' ? 'highlight' : 'muted' });

    const options = [];
    if (mission.status === 'available'){
      options.push({ key: '1', label: 'Accept mission', tone: 'highlight' });
    } else if (mission.status === 'ready'){
      options.push({ key: '1', label: 'Turn in mission', tone: 'highlight' });
    } else if (mission.status === 'active'){
      options.push({ key: '1', label: 'Mission underway', tone: 'muted', disabled: true });
    } else if (mission.status === 'completed'){
      options.push({ key: '1', label: 'Mission already complete', tone: 'muted', disabled: true });
    }
    options.push({ key: '0', label: 'Back to job board', tone: 'muted' });

    return {
      ...base,
      body: applyResponse(body),
      options,
      footer: 'Esc: back'
    };
  }

  return {
    ...base,
    body: applyResponse([{ text: 'The barkeep watches silently.', tone: 'body' }]),
    options: [{ key: '0', label: 'Step away', tone: 'muted' }],
    footer: 'Esc: close'
  };
}

export {
  initBarkeepMissions,
  isBarkeepDialogueActive,
  startBarkeepConversation,
  closeBarkeepConversation,
  handleBarkeepDialogueInput,
  updateBarkeepMissions,
  getBarkeepDialogueState
};
