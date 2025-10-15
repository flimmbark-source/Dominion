import { POINTS_OF_INTEREST } from '../data/pointsOfInterest.js';
import { state } from '../state/gameState.js';
import { addTemporaryStatEffect, getPlayerStats } from '../state/playerStats.js';
import { inventoryAdd } from './shop.js';
import { addThreat } from './threat.js';
import { toast } from '../ui/toast.js';
import { clamp, TAU } from '../utils/math.js';
import { ITEMS } from '../data/items.js';
import {
  unlockQuest,
  activateQuest,
  completeQuest,
  updateQuestData
} from './questLog.js';
import {
  canResolveEventPoi,
  completeEventTask,
  completeWorldEvent,
  getWorldEventState,
  hasWorldEventCompletedPhase,
  triggerEventTaskEncounter,
  resolveWorldEventProp
} from './worldEvents.js';

const POI_QUEST_BY_TYPE = {
  'cursed-shrine-core': 'world-mire-whispers',
  'fae-fairy': 'world-fae-witness',
  'runestone-cache': 'world-fae-witness',
  'mire-moonblossom': 'world-mire-whispers',
  'mire-bog-idol': 'world-mire-whispers',
  'ember-trail': 'world-ember-watch',
  'ember-ambush': 'world-ember-watch'
};

function initPointsOfInterest(){
  state.pointsOfInterest = POINTS_OF_INTEREST.map(poi => ({
    ...poi,
    resolved: false,
    playerInside: false,
    visibleOnMap: !!poi.revealed
  }));
  state.pointsOfInterest.forEach(poi => {
    const questId = POI_QUEST_BY_TYPE[poi.type];
    if (!questId) return;
    updateQuestData(questId, {
      poiId: poi.id,
      location: { x: poi.x, y: poi.y }
    });
  });
}

function directionToTavern(fromX, fromY){
  const tavern = state.tavern;
  if (!tavern) return 'The tavern is on the move tonight.';
  const targetX = tavern.x + tavern.w / 2;
  const targetY = tavern.y + tavern.h / 2;
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const angle = Math.atan2(-dy, dx);
  const normalized = (angle + TAU) % TAU;
  const slice = TAU / 8;
  const idx = Math.round(normalized / slice) % 8;
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  let descriptor;
  const dist = Math.hypot(dx, dy);
  if (dist > 3200) descriptor = 'deep in the wilds';
  else if (dist > 2000) descriptor = 'a long trek';
  else if (dist > 1200) descriptor = 'a short march';
  else descriptor = 'close by';
  const direction = names[idx];
  if (descriptor === 'close by') return `The tavern hides close by to the ${direction}.`;
  return `The tavern hides ${descriptor} to the ${direction}.`;
}

function revealLinkedLocations(poi){
  if (!poi.reveals) return;
  for (const id of poi.reveals){
    const target = state.pointsOfInterest.find(other => other.id === id);
    if (target) target.visibleOnMap = true;
  }
}

function revealQuestForPoi(poi, reason = 'exploration', { silent = false } = {}){
  const questId = POI_QUEST_BY_TYPE[poi.type];
  if (!questId) return null;
  if (poi.eventId && !canResolveEventPoi(poi)) return null;
  const result = unlockQuest(questId, {
    merge: {
      discoveredBy: reason,
      poiId: poi.id
    }
  });
  if (!silent && result && result.changed && result.message){
    toast(result.message, 2.6);
  }
  return result;
}

function resolveLinkedProp(poi){
  if (!poi?.propId) return;
  resolveWorldEventProp(poi.propId);
}

function giveRandomContraband(){
  const stock = ITEMS.filter(item => item.id === 'invis' || item.id === 'moonleaf');
  const choice = stock[Math.floor(Math.random() * stock.length)];
  if (!choice) return false;
  const added = inventoryAdd(choice);
  if (added){
    toast(`You acquire ${choice.name}. Detection +10, threat +6.`, 3.2);
    state.player.detection = clamp(state.player.detection + 10, 0, 100);
    addThreat(6);
    return true;
  }
  toast('Inventory full!');
  return false;
}

function interactWithPointOfInterest(poi){
  if (poi.resolved){
    toast('Nothing more to gain here.');
    return true;
  }

  const player = state.player;
  if (poi.type === 'shady-trader'){
    const cost = 8;
    if (player.gold < cost){ toast('You need 8 gold for his secret.'); return false; }
    player.gold -= cost;
    state.player.detection = clamp(state.player.detection + 12, 0, 100);
    addThreat(8);
    const clue = directionToTavern(player.x, player.y);
    toast(`Shady Trader: "${clue}" (Detection +12, threat +8)`, 4);
    poi.resolved = true;
    return true;
  }

  if (poi.type === 'wandering-merchant'){
    const cost = 12;
    if (player.gold < cost){ toast('You need 12 gold to browse his pack.'); return false; }
    player.gold -= cost;
    const success = giveRandomContraband();
    if (success) poi.resolved = true;
    return success;
  }

  if (poi.type === 'cursed-shrine-core'){
    if (!canResolveEventPoi(poi)){
      toast('The shrine rejects you—the swamp still withholds its offerings.', 2.6);
      return false;
    }
    if (!hasWorldEventCompletedPhase(poi.eventId, 'exploration')){
      toast('The spirits still demand the reagents whispered in the mire.', 2.6);
      return false;
    }
    const questId = POI_QUEST_BY_TYPE[poi.type];
    revealQuestForPoi(poi, 'interaction', { silent: true });
    if (questId){
      activateQuest(questId, { merge: { resolvedAt: state.time } });
    }
    const stats = getPlayerStats(player, state.time);
    player.detection = clamp(player.detection - 22, 0, 100);
    player.health = clamp(player.health + 18, 0, stats.maxHealth);
    addTemporaryStatEffect(player, {
      id: 'shrine-ward',
      mult: { stealthFactor: 0.7 },
      duration: 120
    }, state.time);
    toast('Moonblossom incense clears the ward (-22 detection, +18 HP, stealth boon).', 3.6);
    poi.resolved = true;
    poi.visibleOnMap = true;
    resolveLinkedProp(poi);
    completeWorldEvent(poi.eventId);
    return true;
  }

  if (poi.type === 'fae-fairy'){
    if (!canResolveEventPoi(poi)){
      toast('The shimmer has not settled—track the motes deeper first.', 2.4);
      return false;
    }
    const cost = 6;
    if (player.gold < cost){
      toast('You need 6 gold to bribe the anxious fairy.', 2.4);
      return false;
    }
    player.gold -= cost;
    toast('"Runestones hum by a twisted oak guarded by unseen eyes..."', 3.6);
    toast('The fairy accepts your bribe and sketches a path deeper in the grove.', 3);
    poi.resolved = true;
    poi.visibleOnMap = true;
    completeEventTask(poi.eventId, 'bribe-fairy');
    return true;
  }

  if (poi.type === 'mire-moonblossom'){
    if (!canResolveEventPoi(poi)){
      toast('The swamp still whispers for proof—follow the hush.', 2.4);
      return false;
    }
    toast('You gather luminous moonblossom petals for the rite.', 2.6);
    poi.resolved = true;
    poi.visibleOnMap = true;
    completeEventTask(poi.eventId, 'moonblossom');
    return true;
  }

  if (poi.type === 'mire-bog-idol'){
    if (!canResolveEventPoi(poi)){
      toast('The hag den remains hidden—trace the whispers first.', 2.4);
      return false;
    }
    toast('You pry the bog idol from the muck, its wards still pulsing.', 2.8);
    poi.resolved = true;
    poi.visibleOnMap = true;
    completeEventTask(poi.eventId, 'bog-idol');
    return true;
  }

  if (poi.type === 'runestone-cache'){
    if (!canResolveEventPoi(poi)){
      toast('The fae trail has not settled here yet.', 2.4);
      return false;
    }
    if (!hasWorldEventCompletedPhase(poi.eventId, 'exploration')){
      toast('Without the fairy\'s clue you cannot read the twisted oak.', 2.6);
      return false;
    }
    const eventState = getWorldEventState(poi.eventId);
    const guardsActive = eventState?.guards?.some(guard => state.npcs.includes(guard) && guard.health > 0);
    if (guardsActive && state.player.detection >= 45){
      toast('Unseen eyes circle the oak—thin the patrol or lower your detection.', 3);
      return false;
    }
    state.player.detection = clamp(state.player.detection + 14, 0, 100);
    addThreat(12);
    state.player.gold += 10;
    toast('You slip rune shards into your pouch (+10 gold, detection +14, threat +12).', 3.2);
    poi.resolved = true;
    poi.visibleOnMap = true;
    resolveLinkedProp(poi);
    completeWorldEvent(poi.eventId);
    return true;
  }

  if (poi.type === 'ember-trail'){
    if (!canResolveEventPoi(poi)){
      toast('You need clearer signs before studying the trail.', 2.2);
      return false;
    }
    toast('The ruts veer northwest toward hushed drums—an ambush is staged ahead.', 3.4);
    poi.resolved = true;
    poi.visibleOnMap = true;
    const activated = triggerEventTaskEncounter(poi.eventId, 'trail-ledger');
    if (!activated){
      completeEventTask(poi.eventId, 'trail-ledger');
    }
    return true;
  }

  if (poi.type === 'ember-ambush'){
    if (!canResolveEventPoi(poi)){
      toast('You need a clearer read on the ambush before acting.', 2.4);
      return false;
    }
    const eventState = getWorldEventState(poi.eventId);
    const guardsActive = eventState?.guards?.some(guard => state.npcs.includes(guard) && guard.health > 0);
    if (guardsActive && state.player.detection >= 50){
      toast('The raiders stay alert—disrupt them or drop your detection.', 2.8);
      return false;
    }
    if (guardsActive){
      toast('You sabotage the powder kegs while the patrol looks away.', 2.6);
      state.player.detection = clamp(state.player.detection + 20, 0, 100);
    } else {
      toast('With the raiders routed, you secure the supplies for Moonfen.', 2.8);
      state.player.detection = clamp(state.player.detection - 10, 0, 100);
    }
    addThreat(-6);
    poi.resolved = true;
    poi.visibleOnMap = true;
    resolveLinkedProp(poi);
    completeWorldEvent(poi.eventId);
    return true;
  }

  return false;
}

function handlePointOfInterestInteraction(interactPressed){
  if (!state.pointsOfInterest || !state.pointsOfInterest.length) return false;
  const player = state.player;
  const insideHouse = !!state.interior;
  let consumed = false;
  for (const poi of state.pointsOfInterest){
    const dist = Math.hypot(player.x - poi.x, player.y - poi.y);
    const radius = poi.radius ?? 60;
    const inside = dist <= radius;
    if (inside && !poi.playerInside && !poi.resolved && !insideHouse){
      if (!poi.eventId || canResolveEventPoi(poi)){
        toast(poi.prompt, 1.8);
      }
    }
    if (inside && !insideHouse){
      revealQuestForPoi(poi, 'exploration');
      const questId = POI_QUEST_BY_TYPE[poi.type];
      if (questId && (!poi.eventId || canResolveEventPoi(poi))){
        updateQuestData(questId, { lastSeenAt: state.time });
      }
    }
    poi.playerInside = inside;
    if (inside && interactPressed && !consumed && !insideHouse){
      consumed = interactWithPointOfInterest(poi);
    }
  }
  return consumed;
}

export { initPointsOfInterest, handlePointOfInterestInteraction };
