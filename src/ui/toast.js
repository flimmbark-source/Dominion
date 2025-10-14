import { state } from '../state/gameState.js';

const MAX_VISIBLE_MESSAGES = 5;

function toast(msg, dur = 4){
  const now = state.time;

  for (let i = state.messages.length - 1; i >= 0; i--){
    if (now >= state.messages[i].expiresAt){
      state.messages.splice(i, 1);
    }
  }

  state.messages.unshift({ text: msg, expiresAt: now + dur });

  if (state.messages.length > MAX_VISIBLE_MESSAGES){
    state.messages.length = MAX_VISIBLE_MESSAGES;
  }

  console.log(msg);
}

export { toast };
