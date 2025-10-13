import { state } from '../state/gameState.js';

function toast(msg, dur=2){
  state.message = msg;
  state.messageUntil = state.time + dur;
  console.log(msg);
}

export { toast };
