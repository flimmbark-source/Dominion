import { state } from '../state/gameState.js';
import { npcSeesPlayer, removeNPC } from '../npc/npcManager.js';
import { addThreat } from './threat.js';
import { getWeaponSwingConfig, resolveWeaponType } from '../utils/weaponSwing.js';
import { addDamageNumber } from './damageNumbers.js';
import { addScreenShake, addHitStop } from './cameraEffects.js';

const BASE_PLAYER_ATTACK_RANGE = 52;
const MELEE_RANGE_BONUS = 8;
const MIN_PLAYER_COOLDOWN = 0.3;
const BACKSTAB_ALIGNMENT_THRESHOLD = -0.25;
const COMBO_TIMEOUT = 2.0;  // Seconds before combo resets
const COMBO_DAMAGE_BONUS = 0.1;  // 10% damage bonus per combo hit

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
  let wasCrit = false;
  let damage = playerStats.attackDamage;

  // Initialize combo system if needed
  if (!player.combo) {
    player.combo = { count: 0, lastHitTime: 0 };
  }

  // Check if combo expired
  if (state.time - player.combo.lastHitTime > COMBO_TIMEOUT) {
    player.combo.count = 0;
  }

  // Apply combo damage bonus
  if (player.combo.count > 0) {
    const comboBonus = 1 + (player.combo.count * COMBO_DAMAGE_BONUS);
    damage *= comboBonus;
  }

  // Check for critical hit
  const critChance = playerStats.critChance || 0;
  if (Math.random() < critChance) {
    wasCrit = true;
    damage *= playerStats.critDamage || 1.75;
  }

  if (npc.backstabOnly){
    if (seesPlayer || alignment > BACKSTAB_ALIGNMENT_THRESHOLD){
      return false;
    }
    wasBackstab = true;
    damage *= npc.backstabMultiplier || 3;
  } else if (!seesPlayer && npc.backstabMultiplier && npc.backstabMultiplier > 1){
    wasBackstab = true;
    damage *= npc.backstabMultiplier;
  }

  npc.health = Math.max(0, npc.health - damage);

  // Update combo counter
  player.combo.count++;
  player.combo.lastHitTime = state.time;

  // Determine damage number appearance based on hit type
  let damageColor = '#f9d776';  // Normal hit
  let isCritDisplay = false;
  let lifetime = undefined;

  if (wasBackstab && wasCrit) {
    // Both backstab and crit - ultimate hit
    damageColor = '#ff6b35';
    isCritDisplay = true;
    lifetime = 1.5;
  } else if (wasBackstab) {
    // Backstab only
    damageColor = '#ffe18a';
    isCritDisplay = true;
    lifetime = 1.35;
  } else if (wasCrit) {
    // Crit only
    damageColor = '#ff9f1c';
    isCritDisplay = true;
    lifetime = 1.3;
  }

  addDamageNumber({
    x: npc.x,
    y: npc.y,
    amount: damage,
    color: damageColor,
    crit: isCritDisplay,
    lifetime
  });

  // Add screen shake and hit stop for combat feedback
  if (wasBackstab && wasCrit) {
    // Extra strong feedback for double bonus
    addScreenShake({ intensity: 16, duration: 0.3 });
    addHitStop(0.1);
  } else if (wasBackstab || wasCrit) {
    // Strong feedback for either bonus
    addScreenShake({ intensity: 10, duration: 0.22 });
    addHitStop(0.06);
  } else {
    // Normal feedback
    addScreenShake({ intensity: 6, duration: 0.15 });
    addHitStop(0.04);
  }

  if (npc.health <= 0){
    handleNpcDefeated(npc, wasBackstab);
  }

  return true;
}

export { attemptAttack };
