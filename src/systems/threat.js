import { state } from '../state/gameState.js';
import { incrementVillageSuspicion, adjustPopulationHealth } from './worldState.js';

const MAX_THREAT = 200;

function getStageForThreatValue(value){
  if (value < 40) return 0;
  if (value < 80) return 1;
  if (value < 120) return 2;
  if (value < 160) return 3;
  return 4;
}

function addThreat(amount){
  if (amount > 0 && state.time < state.threatGainBlockedUntil) return;

  const previousStage = getStageForThreatValue(state.threat);
  state.threat = Math.max(0, Math.min(MAX_THREAT, state.threat + amount));
  const nextStage = getStageForThreatValue(state.threat);

  if (amount > 0){
    incrementVillageSuspicion(amount * 0.2);
    adjustPopulationHealth(-Math.abs(amount) / 320);
  } else if (amount < 0){
    incrementVillageSuspicion(amount * 0.1);
    adjustPopulationHealth(Math.abs(amount) / 360);
  }

  if (nextStage !== previousStage){
    state.threatGainBlockedUntil = state.time + 15;
  }
}

function getThreatFraction(){
  return Math.max(0, Math.min(1, state.threat / MAX_THREAT));
}

function getThreatStage(){
  return getStageForThreatValue(state.threat);
}

export { addThreat, getThreatFraction, getThreatStage, MAX_THREAT };
