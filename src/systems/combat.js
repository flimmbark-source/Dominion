import { state } from '../state/gameState.js';
import { npcSeesPlayer, removeNPC } from '../npc/npcManager.js';
import { clamp } from '../utils/math.js';
import { addThreat } from './threat.js';
import { getWeaponSwingConfig, resolveWeaponType } from '../utils/weaponSwing.js';
import { addDamageNumber } from './damageNumbers.js';

const BASE_PLAYER_ATTACK_RANGE = 52;
const MELEE_RANGE_BONUS = 8;
const MIN_PLAYER_COOLDOWN = 0.3;
const BACKSTAB_ALIGNMENT_THRESHOLD = -0.25;

function findAttackTarget(player, attackRange = BASE_PLAYER_ATTACK_RANGE + MELEE_RANGE_BONUS){
  let best = null;
  let bestDist = attackRange;
  for (const npc of state.npcs){
    if (!npc.attackable) continue;
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > attackRange) continue;
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
    addDamageNumber({
      x: state.player.x,
      y: state.player.y,
      amount: damage,
      color: '#ff6b6b'
    });
  }
  if (npc.counterDetection){
    state.player.detection = clamp(state.player.detection + npc.counterDetection, 0, 100);
  }
  if (npc.counterThreat){
    addThreat(npc.counterThreat);
  }
}

function handleNpcDefeated(npc, wasBackstab){
  if (npc.threatOnDefeat){
    addThreat(npc.threatOnDefeat);
  }
  if (npc.rewardGold){
    state.player.gold += npc.rewardGold;
  }
  removeNPC(npc, { silent: true });
}

function attemptAttack(player, playerStats, weaponType){
  const nextReady = player.nextAttackReady ?? 0;
  if (state.time < nextReady) return false;

  const resolvedWeaponType = resolveWeaponType(weaponType);
  const swingConfig = getWeaponSwingConfig(resolvedWeaponType);
  const attackRange = swingConfig.playerRange ?? (BASE_PLAYER_ATTACK_RANGE + MELEE_RANGE_BONUS);
  const npc = findAttackTarget(player, attackRange);

  const swingDuration = swingConfig.playerDuration ?? swingConfig.duration ?? 0.32;
  const cooldown = Math.max(swingConfig.playerCooldown ?? swingConfig.duration ?? 0.32, MIN_PLAYER_COOLDOWN);
  const facing = npc ? Math.atan2(npc.y - player.y, npc.x - player.x) : (player.facing ?? 0);

  player.nextAttackReady = state.time + cooldown;
  player.attackSwing = {
    start: state.time,
    duration: swingDuration,
    facing,
    weaponType: resolvedWeaponType
  };

  if (!npc) return true;

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
  addDamageNumber({
    x: npc.x,
    y: npc.y,
    amount: damage,
    color: wasBackstab ? '#ffe18a' : '#f9d776',
    crit: wasBackstab,
    lifetime: wasBackstab ? 1.35 : undefined
  });
  if (npc.health <= 0){
    handleNpcDefeated(npc, wasBackstab);
  }

  return true;
}

export { attemptAttack };
