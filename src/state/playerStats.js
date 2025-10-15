const BASE_PLAYER_STATS = Object.freeze({
  maxHealth: 50,
  movementSpeed: 120,
  attackDamage: 10,
  stealthFactor: 1
});

function createPlayerStats(){
  return {
    base: { ...BASE_PLAYER_STATS },
    current: null,
    dirty: true,
    temporaryEffects: []
  };
}

function markPlayerStatsDirty(player){
  if (!player || !player.stats) return;
  player.stats.dirty = true;
}

function applyAdditive(totals, add){
  if (!add) return;
  if (typeof add.maxHealth === 'number') totals.maxHealth += add.maxHealth;
  if (typeof add.movementSpeed === 'number') totals.movementSpeed += add.movementSpeed;
  if (typeof add.attackDamage === 'number') totals.attackDamage += add.attackDamage;
  if (typeof add.stealthFactor === 'number') totals.stealthFactor += add.stealthFactor;
}

function applyMultiplicative(multipliers, mult){
  if (!mult) return;
  if (typeof mult.stealthFactor === 'number') multipliers.stealthFactor *= mult.stealthFactor;
}

function computeTotals(stats, inventory){
  const totals = {
    maxHealth: stats.base.maxHealth,
    movementSpeed: stats.base.movementSpeed,
    attackDamage: stats.base.attackDamage,
    stealthFactor: stats.base.stealthFactor
  };
  const multipliers = { stealthFactor: 1 };

  for (const item of inventory){
    if (!item) continue;
    applyAdditive(totals, item.effects?.add);
    applyMultiplicative(multipliers, item.effects?.mult);
  }

  for (const effect of stats.temporaryEffects){
    applyAdditive(totals, effect.add);
    applyMultiplicative(multipliers, effect.mult);
  }

  totals.stealthFactor *= multipliers.stealthFactor;
  return totals;
}

function pruneExpiredEffects(stats, now){
  if (!stats.temporaryEffects.length) return false;
  let removed = false;
  stats.temporaryEffects = stats.temporaryEffects.filter(effect => {
    if (typeof effect.expiresAt === 'number' && now >= effect.expiresAt){
      removed = true;
      return false;
    }
    return true;
  });
  return removed;
}

function statsChanged(prev, next){
  if (!prev) return true;
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const key of keys){
    const a = prev[key] ?? 0;
    const b = next[key] ?? 0;
    if (Math.abs(a - b) > 1e-6) return true;
  }
  return false;
}

function recalcPlayerStats(player){
  const totals = computeTotals(player.stats, player.inventory);
  const prev = player.stats.current;
  player.stats.current = totals;
  player.stats.dirty = false;
  if (statsChanged(prev, totals)){
    const summary = `HP ${totals.maxHealth.toFixed(0)} | Speed ${totals.movementSpeed.toFixed(0)} | Attack ${totals.attackDamage.toFixed(0)} | Stealth x${totals.stealthFactor.toFixed(2)}`;
    console.log(`[Stats] ${summary}`);
  }
  if (typeof player.health === 'number' && player.health > totals.maxHealth){
    player.health = totals.maxHealth;
  }
  return totals;
}

function getPlayerStats(player, now){
  if (!player || !player.stats) return { ...BASE_PLAYER_STATS };
  const stats = player.stats;
  if (typeof now === 'number'){
    if (pruneExpiredEffects(stats, now)) stats.dirty = true;
  }
  if (stats.dirty || !stats.current){
    return recalcPlayerStats(player);
  }
  return stats.current;
}

function addTemporaryStatEffect(player, effect, now){
  if (!player || !player.stats) return null;
  const stats = player.stats;
  const start = typeof now === 'number' ? now : 0;
  const expiresAt = typeof effect.expiresAt === 'number'
    ? effect.expiresAt
    : (typeof effect.duration === 'number' ? start + effect.duration : undefined);

  if (effect.id){
    const existing = stats.temporaryEffects.find(e => e.id === effect.id);
    if (existing){
      existing.add = effect.add ? { ...effect.add } : undefined;
      existing.mult = effect.mult ? { ...effect.mult } : undefined;
      existing.expiresAt = expiresAt;
      stats.dirty = true;
      return existing;
    }
  }

  const stored = {
    id: effect.id ?? null,
    add: effect.add ? { ...effect.add } : undefined,
    mult: effect.mult ? { ...effect.mult } : undefined,
    expiresAt
  };
  stats.temporaryEffects.push(stored);
  stats.dirty = true;
  return stored;
}

export {
  BASE_PLAYER_STATS,
  createPlayerStats,
  getPlayerStats,
  markPlayerStatsDirty,
  addTemporaryStatEffect
};
