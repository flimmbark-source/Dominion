/**
 * Two-Stage Projectile System
 * LAUNCH: How the attack travels
 * IMPACT: What happens when it stops
 */

import { state } from '../state/gameState.js';
import { addDamageNumber } from './damageNumbers.js';
import { addScreenShake } from './cameraEffects.js';
import { removeNPC } from '../npc/npcManager.js';

// Performance tuning
const MAX_PROJECTILES = 150;
const COLLISION_CHECK_RADIUS = 400;
const PROJECTILE_SPEED_MULTIPLIER = 3;

// Projectile stages
const STAGE = {
  LAUNCH: 'LAUNCH',
  IMPACT: 'IMPACT',
  DEAD: 'DEAD'
};

/**
 * Two-Stage Projectile
 * Flies to target (LAUNCH), then triggers effect (IMPACT)
 */
class TwoStageProjectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.angle = config.angle;
    this.target = config.target;
    this.attackData = config.attackData;
    this.owner = config.owner;
    this.modifiers = config.modifiers || [];

    // Current stage
    this.stage = STAGE.LAUNCH;
    this.isAlive = true;

    // Apply modifiers to attack data
    this.effectiveData = this.applyModifiers(this.attackData, this.modifiers);

    // LAUNCH stage properties
    const launchSpeed = (this.effectiveData.launch.speed || 15) * PROJECTILE_SPEED_MULTIPLIER;
    this.vx = Math.cos(this.angle) * launchSpeed;
    this.vy = Math.sin(this.angle) * launchSpeed;
    this.speed = launchSpeed;

    this.distanceTraveled = 0;
    this.pierceCount = 0;
    this.maxPierce = this.effectiveData.launch.pierce || 0;
    this.hitEnemies = new Set();

    // Homing properties
    this.homingStrength = this.effectiveData.launch.homingStrength || 0;

    // Arc properties
    this.gravity = this.effectiveData.launch.behavior === 'arc' ? 15 : 0;

    // IMPACT stage properties (initialized when entering IMPACT stage)
    this.impactTimer = 0;
    this.impactSubEntities = []; // For swipes, fragments, etc.
  }

  applyModifiers(baseData, modifiers) {
    let data = JSON.parse(JSON.stringify(baseData)); // Deep clone

    for (const modifier of modifiers) {
      if (!modifier.modification) continue;

      const mod = modifier.modification;

      // Check if modifier applies to this attack
      if (modifier.affectsTags && baseData.tags) {
        const hasMatchingTag = modifier.affectsTags.some(tag => baseData.tags.includes(tag));
        if (!hasMatchingTag && !modifier.affectsAll) continue;
      }

      // Apply different modifier types
      switch (modifier.modifierType) {
        case 'launch_speed':
          data.launch.speed *= (mod.speedMultiplier || 1);
          break;

        case 'launch_pierce':
          data.launch.pierce = (data.launch.pierce || 0) + (mod.addPierce || 0);
          data.launch.damage *= (mod.launchDamageMultiplier || 1);
          break;

        case 'launch_range':
          data.launch.range *= (mod.rangeMultiplier || 1);
          break;

        case 'impact_size':
          if (data.impact.explosionRadius) data.impact.explosionRadius *= mod.radiusMultiplier;
          if (data.impact.swipeRadius) data.impact.swipeRadius *= mod.radiusMultiplier;
          if (data.impact.cloudRadius) data.impact.cloudRadius *= mod.radiusMultiplier;
          if (data.impact.stormRadius) data.impact.stormRadius *= mod.radiusMultiplier;
          break;

        case 'impact_duration':
          if (data.impact.totalDuration) data.impact.totalDuration *= mod.durationMultiplier;
          if (data.impact.cloudDuration) data.impact.cloudDuration *= mod.durationMultiplier;
          if (data.impact.stormDuration) data.impact.stormDuration *= mod.durationMultiplier;
          break;

        case 'damage_boost':
          if (!mod.affectsDamageType || data.damageType === mod.affectsDamageType) {
            if (data.launch.damage) data.launch.damage *= mod.damageMultiplier;
            if (data.impact.swipeDamage) data.impact.swipeDamage *= mod.damageMultiplier;
            if (data.impact.explosionDamage) data.impact.explosionDamage *= mod.damageMultiplier;
          }
          break;

        case 'fire_rate':
          // Applied at attack item level, not here
          break;
      }
    }

    return data;
  }

  update(deltaTime) {
    if (!this.isAlive) return;

    if (this.stage === STAGE.LAUNCH) {
      this.updateLaunch(deltaTime);
    } else if (this.stage === STAGE.IMPACT) {
      this.updateImpact(deltaTime);
    }
  }

  updateLaunch(deltaTime) {
    // Update position based on launch behavior
    const behavior = this.effectiveData.launch.behavior;

    if (behavior === 'homing' && this.target && (this.target.health || this.target.hp) > 0) {
      this.updateHoming(deltaTime);
    } else if (behavior === 'arc') {
      this.updateArc(deltaTime);
    } else if (behavior === 'wave') {
      this.updateWave(deltaTime);
    } else {
      this.updateStraight(deltaTime);
    }

    // Check if out of range - transition to IMPACT
    const maxRange = this.effectiveData.launch.range * 16;
    if (this.distanceTraveled >= maxRange) {
      this.transitionToImpact();
      return;
    }

    // Check collisions during LAUNCH
    this.checkLaunchCollisions();
  }

  updateStraight(deltaTime) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  updateHoming(deltaTime) {
    const toTargetX = this.target.x - this.x;
    const toTargetY = this.target.y - this.y;
    const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

    if (distance > 0) {
      const normalizedX = toTargetX / distance;
      const normalizedY = toTargetY / distance;

      this.vx = this.vx * (1 - this.homingStrength) + normalizedX * this.speed * this.homingStrength;
      this.vy = this.vy * (1 - this.homingStrength) + normalizedY * this.speed * this.homingStrength;

      const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      if (currentSpeed > 0) {
        this.vx = (this.vx / currentSpeed) * this.speed;
        this.vy = (this.vy / currentSpeed) * this.speed;
      }

      this.angle = Math.atan2(this.vy, this.vx);
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  updateArc(deltaTime) {
    this.vy += this.gravity * deltaTime;
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  updateWave(deltaTime) {
    const waveFreq = this.effectiveData.launch.waveFrequency || 2;
    const waveAmp = this.effectiveData.launch.waveAmplitude || 1;

    // Sinusoidal wave perpendicular to direction
    const waveOffset = Math.sin(this.distanceTraveled * waveFreq * 0.05) * waveAmp * 16;
    const perpX = -Math.sin(this.angle);
    const perpY = Math.cos(this.angle);

    this.x += (this.vx + perpX * waveOffset) * deltaTime;
    this.y += (this.vy + perpY * waveOffset) * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  checkLaunchCollisions() {
    const launchDamage = this.effectiveData.launch.damage || 0;
    if (launchDamage === 0) return;

    const enemies = this.owner === state.player ?
      state.npcs.filter(npc => npc.faction === 'darkLord' || npc.faction === 'monster') :
      [state.player];

    const collisionRadius = (this.effectiveData.launch.size || 0.5) * 16;
    const checkRadiusSq = COLLISION_CHECK_RADIUS * COLLISION_CHECK_RADIUS;

    for (const enemy of enemies) {
      if (enemy === state.player && enemy.dead) continue;
      if (enemy !== state.player && (!enemy.attackable || (enemy.health || enemy.hp) <= 0)) continue;
      if (this.hitEnemies.has(enemy.id || 'player')) continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq > checkRadiusSq) continue;

      const enemyRadius = enemy.r || 16;
      const totalRadiusSq = (collisionRadius + enemyRadius) ** 2;

      if (distSq < totalRadiusSq) {
        this.applyDamage(enemy, launchDamage);
        this.hitEnemies.add(enemy.id || 'player');
        this.pierceCount++;

        if (this.pierceCount > this.maxPierce) {
          this.transitionToImpact();
          return;
        }
      }
    }
  }

  transitionToImpact() {
    this.stage = STAGE.IMPACT;
    this.impactTimer = 0;

    // Initialize IMPACT behavior
    const impactBehavior = this.effectiveData.impact?.behavior;

    switch (impactBehavior) {
      case 'swipe':
        this.initSwipe();
        break;
      case 'explosion':
        this.initExplosion();
        break;
      case 'gas_cloud':
      case 'acid_puddle':
      case 'shadow_zone':
      case 'curse_field':
        this.initZone();
        break;
      case 'storm':
      case 'lightning_storm':
        this.initStorm();
        break;
      case 'scatter_traps':
        this.initScatterTraps();
        break;
      default:
        // No impact effect, just die
        this.destroy();
    }
  }

  updateImpact(deltaTime) {
    this.impactTimer += deltaTime;

    const impact = this.effectiveData.impact;
    const totalDuration = impact.totalDuration || impact.cloudDuration || impact.stormDuration || 1;

    if (this.impactTimer >= totalDuration) {
      this.destroy();
      return;
    }

    // Update active impact behavior
    const behavior = impact.behavior;

    if (behavior === 'swipe') {
      this.updateSwipe(deltaTime);
    } else if (behavior === 'gas_cloud' || behavior === 'acid_puddle' || behavior === 'shadow_zone' || behavior === 'curse_field') {
      this.updateZone(deltaTime);
    } else if (behavior === 'storm' || behavior === 'lightning_storm') {
      this.updateStorm(deltaTime);
    }
  }

  // ===== IMPACT BEHAVIORS =====

  initSwipe() {
    const impact = this.effectiveData.impact;
    this.impactSubEntities = [];

    for (let i = 0; i < impact.swipeCount; i++) {
      this.impactSubEntities.push({
        triggered: false,
        triggerTime: i * (impact.swipeDelay || 0.1)
      });
    }
  }

  updateSwipe(deltaTime) {
    const impact = this.effectiveData.impact;
    const swipeRadius = (impact.swipeRadius || 2) * 16;
    const swipeRadiusSq = swipeRadius * swipeRadius;

    for (const swipe of this.impactSubEntities) {
      if (swipe.triggered) continue;
      if (this.impactTimer < swipe.triggerTime) continue;

      swipe.triggered = true;

      // Deal damage in radius
      const enemies = this.owner === state.player ?
        state.npcs.filter(npc => npc.faction === 'darkLord' || npc.faction === 'monster') :
        [state.player];

      for (const enemy of enemies) {
        if (enemy === state.player && enemy.dead) continue;
        if (enemy !== state.player && (!enemy.attackable || (enemy.health || enemy.hp) <= 0)) continue;

        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= swipeRadiusSq) {
          this.applyDamage(enemy, impact.swipeDamage || 0);
        }
      }

      addScreenShake(2);
    }
  }

  initExplosion() {
    const impact = this.effectiveData.impact;
    const explosionRadius = (impact.explosionRadius || 3) * 16;
    const explosionRadiusSq = explosionRadius * explosionRadius;

    const enemies = this.owner === state.player ?
      state.npcs.filter(npc => npc.faction === 'darkLord' || npc.faction === 'monster') :
      [state.player];

    for (const enemy of enemies) {
      if (enemy === state.player && enemy.dead) continue;
      if (enemy !== state.player && (!enemy.attackable || (enemy.health || enemy.hp) <= 0)) continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= explosionRadiusSq) {
        this.applyDamage(enemy, impact.explosionDamage || 0);

        // Apply knockback
        if (impact.knockback) {
          const dist = Math.sqrt(distSq);
          if (dist > 0) {
            const knockX = (dx / dist) * impact.knockback;
            const knockY = (dy / dist) * impact.knockback;
            enemy.vx = (enemy.vx || 0) + knockX;
            enemy.vy = (enemy.vy || 0) + knockY;
          }
        }
      }
    }

    addScreenShake(5);
    this.effectiveData.impact.totalDuration = 0.1; // Explosion is instant
  }

  initZone() {
    this.zoneTickTimer = 0;
  }

  updateZone(deltaTime) {
    const impact = this.effectiveData.impact;
    const tickRate = impact.tickRate || 0.5;

    this.zoneTickTimer += deltaTime;

    if (this.zoneTickTimer >= tickRate) {
      this.zoneTickTimer -= tickRate;

      const zoneRadius = (impact.cloudRadius || impact.puddleRadius || impact.zoneRadius || 3) * 16;
      const zoneRadiusSq = zoneRadius * zoneRadius;

      const enemies = this.owner === state.player ?
        state.npcs.filter(npc => npc.faction === 'darkLord' || npc.faction === 'monster') :
        [state.player];

      for (const enemy of enemies) {
        if (enemy === state.player && enemy.dead) continue;
        if (enemy !== state.player && (!enemy.attackable || (enemy.health || enemy.hp) <= 0)) continue;

        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= zoneRadiusSq) {
          this.applyDamage(enemy, impact.tickDamage || 0);
        }
      }
    }
  }

  initStorm() {
    this.stormBoltTimer = 0;
    this.stormBoltsFired = 0;
  }

  updateStorm(deltaTime) {
    const impact = this.effectiveData.impact;
    const boltRate = impact.boltRate || 0.6;
    const maxBolts = impact.boltCount || 5;

    this.stormBoltTimer += deltaTime;

    if (this.stormBoltTimer >= boltRate && this.stormBoltsFired < maxBolts) {
      this.stormBoltTimer -= boltRate;
      this.stormBoltsFired++;

      // Fire lightning bolt at random enemy in radius
      const stormRadius = (impact.stormRadius || 4) * 16;
      const stormRadiusSq = stormRadius * stormRadius;

      const enemies = this.owner === state.player ?
        state.npcs.filter(npc => npc.faction === 'darkLord' || npc.faction === 'monster') :
        [state.player];

      const enemiesInRange = enemies.filter(enemy => {
        if (enemy === state.player && enemy.dead) return false;
        if (enemy !== state.player && (!enemy.attackable || (enemy.health || enemy.hp) <= 0)) return false;

        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        return (dx * dx + dy * dy) <= stormRadiusSq;
      });

      if (enemiesInRange.length > 0) {
        const target = enemiesInRange[Math.floor(Math.random() * enemiesInRange.length)];
        this.applyDamage(target, impact.boltDamage || 0);
        addScreenShake(3);
      }
    }
  }

  initScatterTraps() {
    // Traps are handled as separate entities in the game world
    // For now, just create a simple scatter explosion
    this.initExplosion();
  }

  applyDamage(enemy, damage) {
    if (enemy === state.player) {
      enemy.health -= damage;
      addDamageNumber(enemy.x, enemy.y - 20, Math.floor(damage));
    } else {
      if (enemy.health !== undefined) {
        enemy.health -= damage;
      } else if (enemy.hp !== undefined) {
        enemy.hp -= damage;
      }
      addDamageNumber(enemy.x, enemy.y, Math.floor(damage));

      const currentHealth = enemy.health !== undefined ? enemy.health : enemy.hp;
      if (currentHealth <= 0) {
        if (enemy.rewardGold) {
          state.player.gold += enemy.rewardGold;
        }
        removeNPC(enemy, { silent: true });
      }
    }
  }

  destroy() {
    this.isAlive = false;
    this.stage = STAGE.DEAD;
  }

  // Rendering helper - returns stage for color coding
  getStage() {
    return this.stage;
  }
}

// Two-Stage Projectile Manager
class TwoStageProjectileManager {
  constructor() {
    this.projectiles = [];
  }

  update(deltaTime) {
    for (const projectile of this.projectiles) {
      projectile.update(deltaTime);
    }

    this.projectiles = this.projectiles.filter(p => p.isAlive);
  }

  add(projectile) {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      const oldest = this.projectiles[0];
      if (oldest) oldest.destroy();
    }
    this.projectiles.push(projectile);
  }

  clear() {
    this.projectiles = [];
  }

  getProjectiles() {
    return this.projectiles;
  }
}

export const twoStageProjectileManager = new TwoStageProjectileManager();

export function createTwoStageProjectile(config) {
  const projectile = new TwoStageProjectile(config);
  twoStageProjectileManager.add(projectile);
  return projectile;
}

export { STAGE, TwoStageProjectile };
