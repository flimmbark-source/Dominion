import { state } from '../state/gameState.js';
import { TAVERN_INTERIOR } from '../state/tavern.js';
import { toast } from '../ui/toast.js';
import { closeShop } from './shop.js';

function enterTavernInterior(){
  if (state.tavernInteriorState.active) return;
  const p = state.player;
  state.tavernInteriorState.active = true;
  state.tavernInteriorState.returnPoint = { x: p.x, y: p.y };
  state.tavernPlayerInside = true;
  p.x = TAVERN_INTERIOR.spawn.x;
  p.y = TAVERN_INTERIOR.spawn.y;
  p.vx = 0;
  p.vy = 0;
  p.facing = -Math.PI/2;
  toast('You slip into the hidden goblin tavern.', 2.6);
}

function leaveTavernInterior(){
  if (!state.tavernInteriorState.active) return;
  const p = state.player;
  const returnPoint = state.tavernInteriorState.returnPoint;
  if (state.pausedForShop) closeShop();
  state.tavernInteriorState.active = false;
  state.tavernInteriorState.returnPoint = null;
  state.tavernPlayerInside = false;
  if (returnPoint){
    p.x = returnPoint.x;
    p.y = returnPoint.y;
  }
  p.vx = 0;
  p.vy = 0;
  state.tavernReentryBlockUntil = state.time + 0.75;
  toast('You step back into the moonlit glade.', 2.0);
}

export { enterTavernInterior, leaveTavernInterior };
