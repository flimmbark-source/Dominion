import { state } from '../state/gameState.js';

const DEFAULT_DURATION = 10;
const DEFAULT_FADE = 2;

function normalizeDuration(value, fallback){
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
}

function ensureFadeDuration(duration, fade){
  const safeDuration = Math.max(duration, 0.5);
  const requested = normalizeDuration(fade, DEFAULT_FADE);
  return Math.min(requested, safeDuration);
}

function showNpcSpeech(npc, text, options = {}){
  if (!npc || !text) return;
  const duration = normalizeDuration(options.duration, DEFAULT_DURATION);
  const fadeDuration = ensureFadeDuration(duration, options.fade ?? options.fadeDuration);
  const now = state.time ?? 0;
  npc.speechBubble = {
    text: String(text),
    startedAt: now,
    duration,
    fadeDuration,
    expiresAt: now + duration,
    fadeStart: now + duration - fadeDuration
  };
}

function clearNpcSpeech(npc){
  if (!npc) return;
  if (npc.speechBubble) npc.speechBubble = null;
}

export { showNpcSpeech, clearNpcSpeech };
