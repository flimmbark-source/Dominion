import { state } from '../state/gameState.js';

const MAX_THREAT = 200;

function addThreat(amount){
  state.threat = Math.max(0, Math.min(MAX_THREAT, state.threat + amount));
}

function getThreatFraction(){
  return Math.max(0, Math.min(1, state.threat / MAX_THREAT));
}

function getThreatStage(){
  if (state.threat < 40) return 0;
  if (state.threat < 80) return 1;
  if (state.threat < 120) return 2;
  if (state.threat < 160) return 3;
  return 4;
}

export { addThreat, getThreatFraction, getThreatStage, MAX_THREAT };
