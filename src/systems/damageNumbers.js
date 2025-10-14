import { state } from '../state/gameState.js';

const DEFAULT_LIFETIME = 1.15;

function ensureStore(){
  if (!Array.isArray(state.damageNumbers)){
    state.damageNumbers = [];
  }
  return state.damageNumbers;
}

function normalizeAmount(amount){
  if (typeof amount !== 'number' || !isFinite(amount)) return 0;
  return Math.max(0, Math.round(amount));
}

function addDamageNumber({ x, y, amount, color, crit = false, lifetime }){
  const value = normalizeAmount(amount);
  if (value <= 0) return;
  const store = ensureStore();
  store.push({
    x,
    y,
    amount: value,
    color: color || (crit ? '#ffe18a' : '#f9d776'),
    crit,
    createdAt: state.time,
    lifetime: typeof lifetime === 'number' && lifetime > 0 ? lifetime : DEFAULT_LIFETIME
  });
}

function updateDamageNumbers(){
  const store = ensureStore();
  if (!store.length) return;
  const now = state.time;
  for (let i = store.length - 1; i >= 0; i--){
    const entry = store[i];
    const duration = entry.lifetime ?? DEFAULT_LIFETIME;
    if (now - entry.createdAt > duration){
      store.splice(i, 1);
    }
  }
}

function getActiveDamageNumbers(){
  return ensureStore();
}

export { addDamageNumber, updateDamageNumbers, getActiveDamageNumbers };
