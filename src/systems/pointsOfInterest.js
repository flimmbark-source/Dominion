import { POINTS_OF_INTEREST } from '../data/pointsOfInterest.js';
import { state } from '../state/gameState.js';
import { addTemporaryStatEffect, getPlayerStats } from '../state/playerStats.js';
import { inventoryAdd } from './shop.js';
import { addThreat } from './threat.js';
import { toast } from '../ui/toast.js';
import { clamp, TAU } from '../utils/math.js';
import { ITEMS } from '../data/items.js';

function initPointsOfInterest(){
  state.pointsOfInterest = POINTS_OF_INTEREST.map(poi => ({
    ...poi,
    resolved: false,
    playerInside: false,
    visibleOnMap: !!poi.revealed
  }));
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

  if (poi.type === 'cursed-shrine'){
    const cost = 10;
    if (player.gold < cost){ toast('Offer 10 gold to tempt the spirits.'); return false; }
    player.gold -= cost;
    const blessing = Math.random() < 0.55;
    if (blessing){
      addTemporaryStatEffect(player, {
        id: 'cursed-shrine-blessing',
        mult: { stealthFactor: 0.6 },
        duration: 90
      }, state.time);
      getPlayerStats(player, state.time);
      player.detection = clamp(player.detection - 25, 0, 100);
      toast('A whispering wind cloaks you (-25 detection, stealth boost for 90s).', 3.4);
    } else {
      player.detection = clamp(player.detection + 30, 0, 100);
      player.health = Math.max(0, player.health - 12);
      addThreat(20);
      toast('The shrine curses you (+30 detection, -12 HP, threat +20).', 3.4);
    }
    poi.resolved = true;
    return true;
  }

  if (poi.type === 'bog-sprite'){
    const cost = 5;
    if (player.gold < cost){ toast('Toss 5 gold to feed the sprite.'); return false; }
    player.gold -= cost;
    player.detection = clamp(player.detection - 18, 0, 100);
    addThreat(10);
    toast(`${poi.hint ?? 'It chitters happily.'} (-18 detection, threat +10)`, 4);
    revealLinkedLocations(poi);
    poi.resolved = true;
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
      toast(poi.prompt, 1.8);
    }
    poi.playerInside = inside;
    if (inside && interactPressed && !consumed && !insideHouse){
      consumed = interactWithPointOfInterest(poi);
    }
  }
  return consumed;
}

export { initPointsOfInterest, handlePointOfInterestInteraction };
