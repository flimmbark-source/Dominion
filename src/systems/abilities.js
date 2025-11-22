import { state } from '../state/gameState.js';
import { addScreenShake, addHitStop } from './cameraEffects.js';
import { addDamageNumber } from './damageNumbers.js';
import { removeNPC } from '../npc/npcManager.js';
import { addThreat } from './threat.js';
import { addTemporaryStatEffect, getPlayerStats } from '../state/playerStats.js';
import { toast } from '../ui/toast.js';
import { applyStunEffect, applyHasteEffect, applyStrengthEffect } from './statusEffects.js';

/**
 * Ability System - Manages player abilities with cooldowns and effects
 */

// Ability Definitions
const ABILITIES = {
  dash: {
    id: 'dash',
    name: 'Shadow Dash',
    description: 'Quickly dash forward, becoming briefly untargetable',
    cooldown: 8,
    icon: 'dash',
    keybind: 'z',
    execute: executeDash
  },
  shadowStrike: {
    id: 'shadowStrike',
    name: 'Shadow Strike',
    description: 'Strike from the shadows, stunning the target',
    cooldown: 12,
    icon: 'strike',
    keybind: 'x',
    execute: executeShadowStrike
  },
  whirlwind: {
    id: 'whirlwind',
    name: 'Whirlwind',
    description: 'Spin and damage all nearby enemies',
    cooldown: 15,
    icon: 'whirlwind',
    keybind: 'c',
    execute: executeWhirlwind
  },
  smokeBomb: {
    id: 'smokeBomb',
    name: 'Smoke Bomb',
    description: 'Drop a smoke bomb, becoming invisible and escaping',
    cooldown: 20,
    icon: 'smoke',
    keybind: 'v',
    execute: executeSmokeBomb
  }
};

/**
 * Initialize ability state for player
 */
export function initAbilities(player) {
  if (!player.abilities) {
    player.abilities = {};

    // Initialize each ability with cooldown tracking
    for (const [key, ability] of Object.entries(ABILITIES)) {
      player.abilities[key] = {
        ...ability,
        lastUsed: -Infinity,
        isReady: true
      };
    }
  }
}

/**
 * Update ability cooldowns
 */
export function updateAbilities(player, currentTime) {
  if (!player.abilities) return;

  for (const ability of Object.values(player.abilities)) {
    const timeSinceUse = currentTime - ability.lastUsed;
    ability.isReady = timeSinceUse >= ability.cooldown;
  }
}

/**
 * Use an ability by ID
 */
export function useAbility(player, abilityId) {
  if (!player.abilities || !player.abilities[abilityId]) {
    console.warn(`Ability ${abilityId} not found`);
    return false;
  }

  const ability = player.abilities[abilityId];

  // Check if ability is ready
  if (!ability.isReady) {
    const timeRemaining = ability.cooldown - (state.time - ability.lastUsed);
    toast(`${ability.name} on cooldown (${Math.ceil(timeRemaining)}s)`, 0.8);
    return false;
  }

  // Execute the ability
  const success = ability.execute(player, ability);

  if (success) {
    ability.lastUsed = state.time;
    ability.isReady = false;
  }

  return success;
}

/**
 * Get remaining cooldown time for an ability
 */
export function getAbilityCooldown(player, abilityId) {
  if (!player.abilities || !player.abilities[abilityId]) return 0;

  const ability = player.abilities[abilityId];
  const elapsed = state.time - ability.lastUsed;
  const remaining = Math.max(0, ability.cooldown - elapsed);

  return {
    remaining,
    total: ability.cooldown,
    fraction: remaining / ability.cooldown
  };
}

/**
 * Get all abilities for UI display
 */
export function getAbilities(player) {
  if (!player.abilities) return [];
  return Object.values(player.abilities);
}

// ============================================================================
// ABILITY IMPLEMENTATIONS
// ============================================================================

/**
 * Dash - Quick forward movement with invulnerability
 */
function executeDash(player, ability) {
  const dashDistance = 120;
  const dashDuration = 0.3;
  const invulnDuration = 0.3;

  // Calculate dash direction based on player facing
  const facing = player.facing || 0;
  const targetX = player.x + Math.cos(facing) * dashDistance;
  const targetY = player.y + Math.sin(facing) * dashDistance;

  // Store dash state
  player.isDashing = true;
  player.dashStart = { x: player.x, y: player.y };
  player.dashTarget = { x: targetX, y: targetY };
  player.dashStartTime = state.time;
  player.dashEndTime = state.time + dashDuration;

  // Grant temporary invulnerability
  player.invulnerableUntil = state.time + invulnDuration;

  // Visual feedback
  addScreenShake({ intensity: 4, duration: 0.2 });
  toast('Dash!', 0.6);

  return true;
}

/**
 * Shadow Strike - Teleport to target and stun
 */
function executeShadowStrike(player, ability) {
  const maxRange = 150;
  const stunDuration = 1.5;
  const damage = 25;

  // Find nearest enemy
  let target = null;
  let minDist = maxRange;

  for (const npc of state.npcs) {
    if (!npc.attackable) continue;
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist < minDist) {
      target = npc;
      minDist = dist;
    }
  }

  if (!target) {
    toast('No target in range', 1.0);
    return false;
  }

  // Teleport to target
  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  player.x = target.x - Math.cos(angle) * 30;
  player.y = target.y - Math.sin(angle) * 30;
  player.facing = angle;

  // Deal damage
  target.health = Math.max(0, target.health - damage);
  addDamageNumber({
    x: target.x,
    y: target.y,
    amount: damage,
    color: '#9d4edd',
    crit: true,
    lifetime: 1.2
  });

  // Stun target using status effect system
  applyStunEffect(target, stunDuration, 1);

  // Visual feedback
  addScreenShake({ intensity: 8, duration: 0.2 });
  addHitStop(0.05);
  toast('Shadow Strike!', 0.8);

  if (target.health <= 0) {
    removeNPC(target, { silent: true });
  }

  return true;
}

/**
 * Whirlwind - AoE damage around player
 */
function executeWhirlwind(player, ability) {
  const radius = 80;
  const damage = 15;
  const playerStats = getPlayerStats(player, state.time);

  let hitCount = 0;

  for (const npc of state.npcs) {
    if (!npc.attackable) continue;

    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= radius) {
      // Calculate damage with player stats
      const finalDamage = damage + (playerStats.attackDamage * 0.5);

      npc.health = Math.max(0, npc.health - finalDamage);
      addDamageNumber({
        x: npc.x,
        y: npc.y,
        amount: finalDamage,
        color: '#06ffa5',
        crit: false
      });

      // Knockback
      const knockbackForce = 60;
      const angle = Math.atan2(dy, dx);
      npc.x += Math.cos(angle) * knockbackForce;
      npc.y += Math.sin(angle) * knockbackForce;

      if (npc.health <= 0) {
        removeNPC(npc, { silent: true });
      }

      hitCount++;
    }
  }

  // Spin animation
  player.whirlwindUntil = state.time + 0.6;

  // Visual feedback
  addScreenShake({ intensity: 6, duration: 0.25 });
  addHitStop(0.03);
  toast(`Whirlwind! (${hitCount} hit${hitCount !== 1 ? 's' : ''})`, 1.0);

  if (hitCount > 0) {
    addThreat(hitCount * 5);
  }

  return true;
}

/**
 * Smoke Bomb - Invisibility and escape
 */
function executeSmokeBomb(player, ability) {
  const invisDuration = 4.0;

  // Grant invisibility
  player.invisUntil = Math.max(player.invisUntil || 0, state.time + invisDuration);

  // Apply haste buff for increased movement speed
  applyHasteEffect(player, invisDuration, 1);

  // Apply strength buff for bonus damage
  applyStrengthEffect(player, invisDuration, 0.5);

  // Reset detection
  player.detection = Math.max(0, player.detection - 30);

  // Visual feedback
  toast('Smoke Bomb! Vanishing...', 1.5);

  return true;
}

/**
 * Update dash movement
 */
export function updateDashMovement(player, dt) {
  if (!player.isDashing) return;

  if (state.time >= player.dashEndTime) {
    player.isDashing = false;
    return;
  }

  // Interpolate position
  const progress = (state.time - player.dashStartTime) / (player.dashEndTime - player.dashStartTime);
  const easedProgress = easeOutCubic(progress);

  player.x = player.dashStart.x + (player.dashTarget.x - player.dashStart.x) * easedProgress;
  player.y = player.dashStart.y + (player.dashTarget.y - player.dashStart.y) * easedProgress;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}
