import { state } from '../state/gameState.js';
import { toast } from '../ui/toast.js';
import { applySlowEffect } from '../systems/statusEffects.js';
import { addDamageNumber } from '../systems/damageNumbers.js';
import { queueNoiseEvent, NPC_STATE, setNPCState } from './npcManager.js';

/**
 * Special Behaviors for New Enemy Types
 * Handles unique AI patterns for Tanks, Priests, Wolves, Spiders, and Bears
 */

/**
 * Tank Relentless Pursuit
 * Tanks never give up chase and pursue until player escapes far enough
 */
export function updateTankBehavior(npc, dt) {
  if (!npc.relentless) return;

  const distToPlayer = Math.hypot(npc.x - state.player.x, npc.y - state.player.y);
  const giveUpDistance = 600;

  // Once a tank sees the player, it becomes relentlessly aggressive
  if (npc.behaviorState === 'ALERT' && distToPlayer > giveUpDistance) {
    // Only give up if player is very far away
    if (Math.random() < 0.02) { // 2% chance per update to give up when very far
      npc.relentless = false;
      setTimeout(() => { npc.relentless = true; }, 10000);
    }
  }

  // Tanks move faster when in pursuit
  if (npc.behaviorState === 'ALERT') {
    npc.speed = npc.baseSpeed * 1.3;
  } else {
    npc.speed = npc.baseSpeed;
  }
}

/**
 * Priest Healing and Reveal Magic
 * Priests heal nearby allies and can reveal invisible players
 */
export function updatePriestBehavior(npc, dt) {
  if (!npc.healer) return;

  const now = state.time;

  // Heal nearby allies
  if (now >= npc.nextHealReady) {
    const allies = state.npcs.filter(other => {
      if (other === npc) return false;
      if (other.faction !== npc.faction) return false;
      if (other.health >= other.maxHealth) return false;
      const dist = Math.hypot(other.x - npc.x, other.y - npc.y);
      return dist <= npc.healRange;
    });

    if (allies.length > 0) {
      // Sort by lowest health percentage
      allies.sort((a, b) => (a.health / a.maxHealth) - (b.health / b.maxHealth));
      const target = allies[0];

      target.health = Math.min(target.maxHealth, target.health + npc.healAmount);

      // Visual feedback
      addDamageNumber({
        x: target.x,
        y: target.y - 20,
        amount: npc.healAmount,
        color: '#4ade80',
        crit: false,
        lifetime: 1.2
      });

      npc.nextHealReady = now + npc.healCooldown;

      if (Math.hypot(npc.x - state.player.x, npc.y - state.player.y) < 250) {
        toast('The dark priest channels healing magic!', 1.5);
      }
    }
  }

  // Reveal invisible players
  if (now >= npc.nextRevealReady) {
    const distToPlayer = Math.hypot(npc.x - state.player.x, npc.y - state.player.y);

    if (distToPlayer <= npc.revealRadius && state.player.invisUntil > now) {
      // Reveal the player
      state.player.invisUntil = Math.min(state.player.invisUntil, now + 0.5);

      toast('The priest\'s magic disrupts your invisibility!', 2.0);

      // Create noise event at player location
      queueNoiseEvent({
        x: state.player.x,
        y: state.player.y,
        radius: 200,
        type: 'reveal',
        maxResponders: 3,
        investigateFor: 4
      });

      npc.nextRevealReady = now + npc.revealCooldown;
    }
  }
}

/**
 * Wolf Pack Behavior
 * Wolves coordinate attacks and gain bonuses when near pack members
 */
export function updateWolfPackBehavior(npc, dt) {
  if (!npc.packBehavior) return;

  const packMates = state.npcs.filter(other => {
    if (other === npc) return false;
    if (other.type !== 'wolf') return false;
    const dist = Math.hypot(other.x - npc.x, other.y - npc.y);
    return dist <= npc.packRadius;
  });

  const packSize = packMates.length + 1;

  // Pack bonus: +10% speed per pack member (max 40%)
  const speedBonus = Math.min(0.4, packSize * 0.1);
  npc.speed = npc.baseSpeed * (1 + speedBonus);

  // Pack bonus: +5% damage per pack member
  if (npc.attack) {
    if (!npc.attack.baseDamage) {
      npc.attack.baseDamage = npc.attack.damage;
    }
    const damageBonus = packSize * 0.05;
    npc.attack.damage = Math.floor(npc.attack.baseDamage * (1 + damageBonus));
  }

  // If one wolf is alerted, nearby pack members investigate
  if (npc.behaviorState === 'ALERT' && packMates.length > 0) {
    for (const mate of packMates) {
      if (mate.behaviorState === 'PATROL') {
        mate.behaviorState = 'SUSPICIOUS';
        mate.investigateTarget = { x: state.player.x, y: state.player.y };
        mate.investigationTimer = 3.0;
      }
    }
  }
}

/**
 * Spider Ambush and Web Attacks
 * Spiders wait in ambush and can web players to slow them
 */
export function updateSpiderBehavior(npc, dt) {
  if (!npc.ambush) return;

  const now = state.time;
  const distToPlayer = Math.hypot(npc.x - state.player.x, npc.y - state.player.y);

  // Ambush: spiders are harder to detect when stationary
  if (npc.behaviorState === 'PATROL' && npc.pauseTimer > 0) {
    npc.fovRange = npc.baseFovRange * 1.5; // Better vision when waiting
  } else {
    npc.fovRange = npc.baseFovRange;
  }

  // Web attack when player is in range
  if (now >= npc.nextWebReady && distToPlayer <= 150 && npc.behaviorState === 'ALERT') {
    // Apply slow effect to player
    applySlowEffect(state.player, npc.webDuration, 2); // 2 stacks = 100% slow

    toast('A spider web snares you!', 1.5);

    npc.nextWebReady = now + npc.webCooldown;
  }
}

/**
 * Bear Territorial and Enrage Mechanics
 * Bears defend territory and enrage when low on health
 */
export function updateBearBehavior(npc, dt) {
  if (!npc.territorial) return;

  const distFromTerritory = Math.hypot(
    npc.x - npc.territoryCenter.x,
    npc.y - npc.territoryCenter.y
  );

  // Return to territory if strayed too far
  if (npc.behaviorState === 'PATROL' && distFromTerritory > npc.territoryRadius) {
    npc.activeTarget = { x: npc.territoryCenter.x, y: npc.territoryCenter.y };
  }

  // Enrage mechanic when health drops below threshold
  const healthPercent = npc.health / npc.maxHealth;

  if (!npc.enraged && healthPercent <= npc.enrageThreshold) {
    npc.enraged = true;
    npc.speed = npc.baseSpeed * 1.5;
    if (npc.attack) {
      if (!npc.attack.baseDamage) {
        npc.attack.baseDamage = npc.attack.damage;
      }
      npc.attack.damage = Math.floor(npc.attack.baseDamage * 1.5);
      npc.attack.cooldown *= 0.7;
    }

    const distToPlayer = Math.hypot(npc.x - state.player.x, npc.y - state.player.y);
    if (distToPlayer < 300) {
      toast('The bear enters a frenzied rage!', 2.0);
    }
  }

  // Territorial aggression: attack anything in territory
  if (npc.territorial && npc.behaviorState === 'PATROL') {
    const distToPlayer = Math.hypot(npc.x - state.player.x, npc.y - state.player.y);
    const playerInTerritory = Math.hypot(
      state.player.x - npc.territoryCenter.x,
      state.player.y - npc.territoryCenter.y
    ) <= npc.territoryRadius;

    if (playerInTerritory && distToPlayer <= npc.fovRange) {
      // Become aggressive when player enters territory
      npc.behaviorState = 'SUSPICIOUS';
      npc.investigateTarget = { x: state.player.x, y: state.player.y };
      npc.investigationTimer = 2.0;
    }
  }
}

/**
 * Update all special behaviors
 */
export function updateSpecialBehaviors(dt) {
  for (const npc of state.npcs) {
    switch (npc.type) {
      case 'tank':
        updateTankBehavior(npc, dt);
        break;
      case 'priest':
        updatePriestBehavior(npc, dt);
        break;
      case 'wolf':
        updateWolfPackBehavior(npc, dt);
        break;
      case 'spider':
        updateSpiderBehavior(npc, dt);
        break;
      case 'bear':
        updateBearBehavior(npc, dt);
        break;
    }
  }
}
