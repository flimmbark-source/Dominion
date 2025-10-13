import { state } from '../state/gameState.js';
import { getThreatStage } from './threat.js';
import { toast } from '../ui/toast.js';
import { promoteScoutToTank, setVillagerCurfewActive } from '../npc/npcManager.js';

const STAGE_EVENT_OPTIONS = {
  1: ['promotion'],
  2: ['curfew'],
  3: ['promotion', 'curfew'],
  4: ['promotion', 'curfew'],
  default: ['promotion', 'curfew']
};

const EVENT_HANDLERS = {
  promotion: {
    title: 'Bell Toll',
    description: 'An iron bell tolls as the Dark Lord promotes a scout to a tank.',
    objective: 'Stay unseen until the armored patrol stands down.',
    duration: 40,
    banner: 'Bell toll! A scout has been promoted to a tank.',
    start(){
      const npc = promoteScoutToTank();
      if (!npc) return false;
      toast('Bell toll! A scout is promoted to a tank.');
      return { npcId: npc.id };
    },
    end(){
      toast('The armored patrol eases its watch.');
    }
  },
  curfew: {
    title: 'Village Curfew',
    description: 'Villagers scramble indoors as curfew is declared.',
    objective: 'Gather gold before the curfew lifts.',
    duration: 55,
    banner: 'Curfew! Villagers flee indoors.',
    start(){
      const affected = setVillagerCurfewActive(true);
      toast('Curfew horns blare! Villagers rush indoors.');
      return { affected };
    },
    end(){
      setVillagerCurfewActive(false);
      toast('The curfew lifts and the village stirs again.');
    }
  }
};

function updateWorldEvents(){
  const stage = getThreatStage();
  if (stage > state.threatStage){
    triggerStageEvent(stage);
  }
  state.threatStage = stage;

  const evt = state.activeWorldEvent;
  if (evt && state.time >= evt.expiresAt){
    endWorldEvent();
  }
}

function triggerStageEvent(stage){
  if (stage <= 0) return;
  if (state.activeWorldEvent){
    endWorldEvent();
  }
  const options = STAGE_EVENT_OPTIONS[stage] || STAGE_EVENT_OPTIONS.default;
  const pool = [...options];
  while (pool.length){
    const index = Math.floor(Math.random() * pool.length);
    const type = pool.splice(index, 1)[0];
    if (startWorldEvent(type)) return;
  }
}

function startWorldEvent(type){
  const handler = EVENT_HANDLERS[type];
  if (!handler) return false;

  const data = handler.start ? handler.start() : {};
  if (data === false) return false;

  const duration = handler.duration ?? 30;
  state.activeWorldEvent = {
    type,
    title: handler.title,
    description: handler.description,
    objective: handler.objective,
    startedAt: state.time,
    expiresAt: state.time + duration,
    data: data || {}
  };

  if (handler.banner){
    state.message = handler.banner;
    state.messageUntil = state.time + 6;
  }

  return true;
}

function endWorldEvent(){
  const evt = state.activeWorldEvent;
  if (!evt) return;
  const handler = EVENT_HANDLERS[evt.type];
  if (handler && handler.end){
    handler.end(evt.data);
  }
  state.activeWorldEvent = null;
}

export { updateWorldEvents };
