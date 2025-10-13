import { state } from '../state/gameState.js';

function addThreat(amount){
  state.threat = Math.max(0, Math.min(999, state.threat + amount));
}

export { addThreat };
