import { state } from '../state/gameState.js';
import { addDamageNumber } from './damageNumbers.js';
import { markPlayerStatsDirty } from '../state/playerStats.js';

/**
 * Status Effects System - Manages buffs, debuffs, and DoTs
 */

// Status effect types
export const STATUS_TYPE = {
  STUN: 'stun',
  SLOW: 'slow',
  POISON: 'poison',
  BURN: 'burn',
  BLEED: 'bleed',
  HASTE: 'haste',
  STRENGTH: 'strength',
  SHIELD: 'shield',
  REGEN: 'regen',
  VULNERABILITY: 'vulnerability'
};

// Visual config for each status type
const STATUS_VISUALS = {
  [STATUS_TYPE.STUN]: { color: '#ffeb3b', icon: '⚡', name: 'Stunned' },
  [STATUS_TYPE.SLOW]: { color: '#90caf9', icon: '❄', name: 'Slowed' },
  [STATUS_TYPE.POISON]: { color: '#66bb6a', icon: '☠', name: 'Poisoned' },
  [STATUS_TYPE.BURN]: { color: '#ff5722', icon: '🔥', name: 'Burning' },
  [STATUS_TYPE.BLEED]: { color: '#e57373', icon: '💔', name: 'Bleeding' },
  [STATUS_TYPE.HASTE]: { color: '#ffd54f', icon: '⚡', name: 'Hasted' },
  [STATUS_TYPE.STRENGTH]: { color: '#ff6f00', icon: '💪', name: 'Empowered' },
  [STATUS_TYPE.SHIELD]: { color: '#42a5f5', icon: '🛡', name: 'Shielded' },
  [STATUS_TYPE.REGEN]: { color: '#4caf50', icon: '💚', name: 'Regenerating' },
  [STATUS_TYPE.VULNERABILITY]: { color: '#9c27b0', icon: '💀', name: 'Vulnerable' }
};

/**
 * Initialize status effects for an entity
 */
export function initStatusEffects(entity) {
  if (!entity.statusEffects) {
    entity.statusEffects = [];
  }
}

/**
 * Apply a status effect to an entity
 */
export function applyStatusEffect(entity, effect) {
  initStatusEffects(entity);

  const newEffect = {
    type: effect.type,
    duration: effect.duration || 0,
    startTime: state.time,
    expiresAt: state.time + (effect.duration || 0),
    strength: effect.strength || 1,
    tickInterval: effect.tickInterval || 1.0,
    lastTickTime: state.time,
    source: effect.source || 'unknown',
    stackable: effect.stackable !== false
  };

  // Check if effect already exists
  const existing = entity.statusEffects.find(e => e.type === effect.type);

  if (existing) {
    if (newEffect.stackable) {
      // Stack the effect (refresh duration and increase strength)
      existing.expiresAt = Math.max(existing.expiresAt, newEffect.expiresAt);
      existing.strength += newEffect.strength;
    } else {
      // Refresh duration
      existing.expiresAt = Math.max(existing.expiresAt, newEffect.expiresAt);
      existing.strength = Math.max(existing.strength, newEffect.strength);
    }
  } else {
    entity.statusEffects.push(newEffect);
  }

  // Mark player stats as dirty if it's the player
  if (entity === state.player) {
    markPlayerStatsDirty(entity);
  }

  return newEffect;
}

/**
 * Remove a status effect from an entity
 */
export function removeStatusEffect(entity, type) {
  if (!entity.statusEffects) return;

  const index = entity.statusEffects.findIndex(e => e.type === type);
  if (index !== -1) {
    entity.statusEffects.splice(index, 1);

    if (entity === state.player) {
      markPlayerStatsDirty(entity);
    }
  }
}

/**
 * Check if entity has a status effect
 */
export function hasStatusEffect(entity, type) {
  return entity.statusEffects?.some(e => e.type === type) || false;
}

/**
 * Get status effect by type
 */
export function getStatusEffect(entity, type) {
  return entity.statusEffects?.find(e => e.type === type);
}

/**
 * Update status effects for an entity
 */
export function updateStatusEffects(entity, dt) {
  if (!entity.statusEffects || entity.statusEffects.length === 0) return;

  const currentTime = state.time;
  const maxHealth = entity === state.player ? 100 : (entity.maxHealth || 100);

  // Process each status effect
  for (let i = entity.statusEffects.length - 1; i >= 0; i--) {
    const effect = entity.statusEffects[i];

    // Remove expired effects
    if (currentTime >= effect.expiresAt) {
      entity.statusEffects.splice(i, 1);

      if (entity === state.player) {
        markPlayerStatsDirty(entity);
      }
      continue;
    }

    // Process ticking effects (DoTs, HoTs)
    if (effect.tickInterval > 0) {
      const timeSinceLastTick = currentTime - effect.lastTickTime;

      if (timeSinceLastTick >= effect.tickInterval) {
        effect.lastTickTime = currentTime;

        switch (effect.type) {
          case STATUS_TYPE.POISON:
            applyPoisonTick(entity, effect);
            break;

          case STATUS_TYPE.BURN:
            applyBurnTick(entity, effect);
            break;

          case STATUS_TYPE.BLEED:
            applyBleedTick(entity, effect);
            break;

          case STATUS_TYPE.REGEN:
            applyRegenTick(entity, effect, maxHealth);
            break;
        }
      }
    }

    // Process continuous effects
    switch (effect.type) {
      case STATUS_TYPE.STUN:
        applyStun(entity, effect);
        break;

      case STATUS_TYPE.SLOW:
        applySpeedModifier(entity, effect);
        break;
    }
  }
}

/**
 * Apply poison damage tick
 */
function applyPoisonTick(entity, effect) {
  const damage = 3 * effect.strength;
  entity.health = Math.max(0, entity.health - damage);

  addDamageNumber({
    x: entity.x,
    y: entity.y,
    amount: damage,
    color: '#66bb6a',
    crit: false
  });

  if (entity.health <= 0 && entity === state.player) {
    // Player died from poison
  }
}

/**
 * Apply burn damage tick
 */
function applyBurnTick(entity, effect) {
  const damage = 5 * effect.strength;
  entity.health = Math.max(0, entity.health - damage);

  addDamageNumber({
    x: entity.x,
    y: entity.y,
    amount: damage,
    color: '#ff5722',
    crit: false
  });
}

/**
 * Apply bleed damage tick (only when moving)
 */
function applyBleedTick(entity, effect) {
  // Check if entity is moving
  const isMoving = Math.abs(entity.vx || 0) > 0.1 || Math.abs(entity.vy || 0) > 0.1;

  if (isMoving) {
    const damage = 4 * effect.strength;
    entity.health = Math.max(0, entity.health - damage);

    addDamageNumber({
      x: entity.x,
      y: entity.y,
      amount: damage,
      color: '#e57373',
      crit: false
    });
  }
}

/**
 * Apply regeneration tick
 */
function applyRegenTick(entity, effect, maxHealth) {
  const healing = 5 * effect.strength;
  const oldHealth = entity.health;
  entity.health = Math.min(maxHealth, entity.health + healing);

  if (entity.health > oldHealth) {
    addDamageNumber({
      x: entity.x,
      y: entity.y,
      amount: healing,
      color: '#4caf50',
      crit: false
    });
  }
}

/**
 * Apply stun effect
 */
function applyStun(entity, effect) {
  // Stop movement
  entity.vx = 0;
  entity.vy = 0;

  // Pause AI if it's an NPC
  if (entity.pauseTimer !== undefined) {
    const remaining = effect.expiresAt - state.time;
    entity.pauseTimer = Math.max(entity.pauseTimer || 0, remaining);
  }
}

/**
 * Apply slow effect (handled in movement calculations)
 */
function applySpeedModifier(entity, effect) {
  // This is applied in the stat calculation
  // Slow reduces speed by 50% * strength
}

/**
 * Get speed multiplier from status effects
 */
export function getSpeedMultiplier(entity) {
  if (!entity.statusEffects) return 1.0;

  let multiplier = 1.0;

  for (const effect of entity.statusEffects) {
    switch (effect.type) {
      case STATUS_TYPE.SLOW:
        multiplier *= Math.max(0.1, 1 - (0.5 * effect.strength));
        break;

      case STATUS_TYPE.HASTE:
        multiplier *= (1 + (0.5 * effect.strength));
        break;

      case STATUS_TYPE.STUN:
        multiplier = 0;
        break;
    }
  }

  return multiplier;
}

/**
 * Get damage multiplier from status effects
 */
export function getDamageMultiplier(entity) {
  if (!entity.statusEffects) return 1.0;

  let multiplier = 1.0;

  for (const effect of entity.statusEffects) {
    switch (effect.type) {
      case STATUS_TYPE.STRENGTH:
        multiplier *= (1 + (0.3 * effect.strength));
        break;

      case STATUS_TYPE.VULNERABILITY:
        multiplier *= (1 + (0.5 * effect.strength));
        break;
    }
  }

  return multiplier;
}

/**
 * Get all active status effects for an entity
 */
export function getActiveStatusEffects(entity) {
  if (!entity.statusEffects) return [];

  return entity.statusEffects.map(effect => ({
    ...effect,
    visual: STATUS_VISUALS[effect.type],
    remaining: Math.max(0, effect.expiresAt - state.time)
  }));
}

/**
 * Clear all status effects from an entity
 */
export function clearStatusEffects(entity) {
  if (entity.statusEffects) {
    entity.statusEffects = [];

    if (entity === state.player) {
      markPlayerStatsDirty(entity);
    }
  }
}

/**
 * Helper functions to apply common status effects
 */

export function applyStunEffect(entity, duration = 1.5, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.STUN,
    duration,
    strength,
    stackable: false
  });
}

export function applySlowEffect(entity, duration = 3, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.SLOW,
    duration,
    strength,
    stackable: false
  });
}

export function applyPoisonEffect(entity, duration = 6, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.POISON,
    duration,
    strength,
    tickInterval: 1.0,
    stackable: true
  });
}

export function applyBurnEffect(entity, duration = 4, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.BURN,
    duration,
    strength,
    tickInterval: 0.5,
    stackable: true
  });
}

export function applyBleedEffect(entity, duration = 5, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.BLEED,
    duration,
    strength,
    tickInterval: 0.5,
    stackable: true
  });
}

export function applyHasteEffect(entity, duration = 4, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.HASTE,
    duration,
    strength,
    stackable: false
  });
}

export function applyStrengthEffect(entity, duration = 6, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.STRENGTH,
    duration,
    strength,
    stackable: false
  });
}

export function applyShieldEffect(entity, duration = 5, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.SHIELD,
    duration,
    strength,
    stackable: false
  });
}

export function applyRegenEffect(entity, duration = 8, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.REGEN,
    duration,
    strength,
    tickInterval: 1.0,
    stackable: false
  });
}

export function applyVulnerabilityEffect(entity, duration = 4, strength = 1) {
  return applyStatusEffect(entity, {
    type: STATUS_TYPE.VULNERABILITY,
    duration,
    strength,
    stackable: false
  });
}
