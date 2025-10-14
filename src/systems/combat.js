import { state } from '../state/gameState.js';
import { npcSeesPlayer, removeNPC } from '../npc/npcManager.js';
import { toast } from '../ui/toast.js';
import { clamp } from '../utils/math.js';
import { addThreat } from './threat.js';

const ATTACK_RANGE = 52;
const BACKSTAB_ALIGNMENT_THRESHOLD = -0.25;

function findAttackTarget(player){
  let best = null;
  let bestDist = ATTACK_RANGE;
  for (const npc of state.npcs){
    if (!npc.attackable) continue;
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > ATTACK_RANGE) continue;
    if (!best || dist < bestDist){
      best = npc;
      bestDist = dist;
    }
  }
  return best;
}

function computeFacingAlignment(npc, player){
  const dirX = Math.cos(npc.facing);
  const dirY = Math.sin(npc.facing);
  const toPlayerX = player.x - npc.x;
  const toPlayerY = player.y - npc.y;
  const len = Math.hypot(toPlayerX, toPlayerY);
  if (!len) return 1;
  return (dirX * (toPlayerX / len)) + (dirY * (toPlayerY / len));
}

function punishFailedBackstab(npc, playerStats){
  const damage = npc.counterDamage ?? 0;
  if (damage > 0){
    state.player.health = clamp(state.player.health - damage, 0, playerStats.maxHealth);
  }
  if (npc.counterDetection){
    state.player.detection = clamp(state.player.detection + npc.counterDetection, 0, 100);
  }
  if (npc.counterThreat){
    addThreat(npc.counterThreat);
  }
  const message = npc.counterMessage || 'Your strike is deflected and you take a nasty hit!';
  toast(message, 3.3);
}

function handleNpcDefeated(npc, wasBackstab){
  if (npc.threatOnDefeat){
    addThreat(npc.threatOnDefeat);
  }
  const label = npc.displayName || npc.type;
  let message;
  if (npc.rewardGold){
    state.player.gold += npc.rewardGold;
    message = wasBackstab
      ? `Backstab! You drop the ${label} and pocket ${npc.rewardGold} gold.`
      : `You defeat the ${label} and pocket ${npc.rewardGold} gold.`;
  } else {
    message = wasBackstab
      ? `Backstab! The ${label} never saw it coming.`
      : `You defeat the ${label}.`;
  }
  toast(message, 2.6);
  removeNPC(npc, { silent: true });
}

function attemptAttack(player, playerStats){
  const npc = findAttackTarget(player);
  if (!npc){
    toast('No target in reach.', 1.5);
    return false;
  }

  const seesPlayer = npcSeesPlayer(npc, player);
  const alignment = computeFacingAlignment(npc, player);
  let wasBackstab = false;
  let damage = playerStats.attackDamage;

  if (npc.backstabOnly){
    if (seesPlayer || alignment > BACKSTAB_ALIGNMENT_THRESHOLD){
      punishFailedBackstab(npc, playerStats);
      return false;
    }
    wasBackstab = true;
    damage *= npc.backstabMultiplier || 3;
  } else if (!seesPlayer && npc.backstabMultiplier && npc.backstabMultiplier > 1){
    wasBackstab = true;
    damage *= npc.backstabMultiplier;
  }

  npc.health = Math.max(0, npc.health - damage);
  if (npc.health <= 0){
    handleNpcDefeated(npc, wasBackstab);
  } else {
    const label = npc.displayName || npc.type;
    toast(`You wound the ${label}.`, 1.6);
  }

  return true;
}

export { attemptAttack };
