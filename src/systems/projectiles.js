/**
 * Projectile System (Optimized)
 * Handles all auto-attack projectiles with performance optimizations
 */

import { state } from '../state/gameState.js';
import { addDamageNumber } from './damageNumbers.js';
import { addScreenShake } from './cameraEffects.js';
import { removeNPC } from '../npc/npcManager.js';

// Performance tuning
const MAX_PROJECTILES = 100; // Hard limit to prevent lag
const COLLISION_CHECK_RADIUS = 400; // Only check collisions within this radius
const PROJECTILE_SPEED_MULTIPLIER = 3; // Make projectiles 3x faster

class Projectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.angle = config.angle;
    this.target = config.target;
    this.attackData = config.attackData;
    this.owner = config.owner;

    // Calculate velocity with speed multiplier for performance
    const speed = this.attackData.projectileSpeed * PROJECTILE_SPEED_MULTIPLIER;
    this.vx = Math.cos(this.angle) * speed;
    this.vy = Math.sin(this.angle) * speed;
    this.speed = speed;

    // State
    this.distanceTraveled = 0;
    this.pierceCount = 0;
    this.maxPierce = this.attackData.pierce || 0;
    this.hitEnemies = new Set(); // Track what we've hit for pierce
    this.isAlive = true;

    // For chain attacks
    this.chainCount = 0;
    this.maxChain = this.attackData.chainCount || 0;

    // For homing
    this.homingStrength = this.attackData.homingStrength || 0;

    // For arc (gravity)
    this.gravity = this.attackData.projectileBehavior === 'arc' ? 15 : 0;
  }

  update(deltaTime) {
    if (!this.isAlive) return;

    // Update position based on behavior
    if (this.attackData.projectileBehavior === 'homing' && this.target && this.target.hp > 0) {
      this.updateHoming(deltaTime);
    } else if (this.attackData.projectileBehavior === 'arc') {
      this.updateArc(deltaTime);
    } else {
      // Straight movement
      this.updateStraight(deltaTime);
    }

    // Check if out of range (range is in tiles, distanceTraveled is in pixels)
    if (this.distanceTraveled > this.attackData.range * 16) {
      this.destroy();
      return;
    }

    // Check collision with enemies
    this.checkCollisions();
  }

  updateStraight(deltaTime) {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  updateHoming(deltaTime) {
    if (this.target && this.target.hp > 0) {
      // Steer toward target
      const toTargetX = this.target.x - this.x;
      const toTargetY = this.target.y - this.y;

      const distance = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);
      if (distance > 0) {
        const normalizedX = toTargetX / distance;
        const normalizedY = toTargetY / distance;

        // Blend current velocity with target direction
        this.vx = this.vx * (1 - this.homingStrength) + normalizedX * this.speed * this.homingStrength;
        this.vy = this.vy * (1 - this.homingStrength) + normalizedY * this.speed * this.homingStrength;

        // Normalize velocity
        const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (currentSpeed > 0) {
          this.vx = (this.vx / currentSpeed) * this.speed;
          this.vy = (this.vy / currentSpeed) * this.speed;
        }

        // Update angle for sprite rotation
        this.angle = Math.atan2(this.vy, this.vx);
      }
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  updateArc(deltaTime) {
    // Parabolic arc (like thrown object)
    this.vy += this.gravity * deltaTime;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.speed * deltaTime;
  }

  checkCollisions() {
    // If projectile is from an NPC, check if it hits the player
    if (this.owner !== state.player) {
      const player = state.player;
      if (!player.dead) {
        // Use squared distance to avoid expensive sqrt
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distSq = dx * dx + dy * dy;
        const collisionRadius = (this.attackData.projectileSize || 0.5) * 16 + (player.r || 10);
        const collisionRadiusSq = collisionRadius * collisionRadius;

        if (distSq < collisionRadiusSq) {
          this.onHitPlayer(player);
          this.destroy();
          return;
        }
      }
    }

    // If projectile is from player, check if it hits NPCs
    if (this.owner === state.player) {
      const collisionRadius = (this.attackData.projectileSize || 0.5) * 16;
      const checkRadius = COLLISION_CHECK_RADIUS;
      const checkRadiusSq = checkRadius * checkRadius;

      for (let enemy of state.npcs) {
        if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;
        if (this.hitEnemies.has(enemy.id)) continue; // Already hit with pierce

        // Quick distance check using squared distance (no sqrt)
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distSq = dx * dx + dy * dy;

        // Early exit if too far away
        if (distSq > checkRadiusSq) continue;

        // Precise collision check
        const enemyRadius = (enemy.r || 16);
        const totalRadius = collisionRadius + enemyRadius;
        const totalRadiusSq = totalRadius * totalRadius;

        if (distSq < totalRadiusSq) {
          this.onHit(enemy);
          this.hitEnemies.add(enemy.id);
          this.pierceCount++;

          // Check if we should destroy
          if (this.pierceCount > this.maxPierce) {
            this.destroy();
            return;
          }
        }
      }
    }
  }

  onHitPlayer(player) {
    // Deal damage to player
    const damage = this.attackData.damage || 0;

    // Apply damage
    player.health -= damage;
    addDamageNumber(player.x, player.y - 20, Math.floor(damage));

    // Camera effects
    addScreenShake(4);

    // TODO: Visual/audio feedback for player hit
  }

  onHit(enemy) {
    // Deal damage
    let damage = this.attackData.damage;

    // Apply damage type modifiers
    if (this.attackData.damageType === 'holy' && enemy.type === 'undead') {
      damage *= (this.attackData.bonusVsUndead || 1.5);
    }

    // Apply damage (NPCs use .health, not .hp)
    if (enemy.health !== undefined) {
      enemy.health -= damage;
    } else if (enemy.hp !== undefined) {
      enemy.hp -= damage;
    }
    addDamageNumber(enemy.x, enemy.y, Math.floor(damage));

    // Camera effects
    addScreenShake(2);

    // Apply knockback
    if (this.attackData.knockback) {
      const knockbackDir = {
        x: enemy.x - this.x,
        y: enemy.y - this.y
      };
      const dist = Math.sqrt(knockbackDir.x * knockbackDir.x + knockbackDir.y * knockbackDir.y);
      if (dist > 0) {
        enemy.vx = (enemy.vx || 0) + (knockbackDir.x / dist) * this.attackData.knockback;
        enemy.vy = (enemy.vy || 0) + (knockbackDir.y / dist) * this.attackData.knockback;
      }
    }

    // Lifesteal
    if (this.attackData.lifesteal && this.owner === state.player) {
      state.player.health = Math.min(
        state.player.maxHealth,
        state.player.health + damage * this.attackData.lifesteal
      );
    }

    // Check if enemy defeated
    const currentHealth = enemy.health !== undefined ? enemy.health : enemy.hp;
    if (currentHealth <= 0) {
      if (enemy.rewardGold) {
        state.player.gold += enemy.rewardGold;
      }
      removeNPC(enemy, { silent: true });
    }

    // AoE damage
    if (this.attackData.aoeRadius) {
      this.dealAoEDamage(enemy);
    }

    // Chain attack
    if (this.chainCount < this.maxChain) {
      this.chainToNearby(enemy);
    }

    // TODO: Visual/audio feedback
    // game.vfxManager.createImpact(this.x, this.y, this.attackData.visualEffect);
  }

  dealAoEDamage(epicenter) {
    const aoeDamage = this.attackData.damage * (this.attackData.aoeDamage || 0.5);
    const aoeRadius = this.attackData.aoeRadius * 16;
    const aoeRadiusSq = aoeRadius * aoeRadius;

    for (let enemy of state.npcs) {
      if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;

      // Use squared distance to avoid sqrt
      const dx = enemy.x - epicenter.x;
      const dy = enemy.y - epicenter.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= aoeRadiusSq) {
        // Apply damage
        if (enemy.health !== undefined) {
          enemy.health -= aoeDamage;
        } else if (enemy.hp !== undefined) {
          enemy.hp -= aoeDamage;
        }
        addDamageNumber(enemy.x, enemy.y, Math.floor(aoeDamage));

        // Check if defeated
        const currentHealth = enemy.health !== undefined ? enemy.health : enemy.hp;
        if (currentHealth <= 0) {
          if (enemy.rewardGold) {
            state.player.gold += enemy.rewardGold;
          }
          removeNPC(enemy, { silent: true });
        }
      }
    }
  }

  chainToNearby(hitEnemy) {
    const chainRange = (this.attackData.chainRange || 5) * 16;
    const chainRangeSq = chainRange * chainRange;
    let nearest = null;
    let nearestDistSq = Infinity;

    for (let enemy of state.npcs) {
      if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;
      if (enemy === hitEnemy) continue;
      if (this.hitEnemies.has(enemy.id)) continue;

      // Use squared distance to avoid sqrt
      const dx = enemy.x - hitEnemy.x;
      const dy = enemy.y - hitEnemy.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < chainRangeSq && distSq < nearestDistSq) {
        nearest = enemy;
        nearestDistSq = distSq;
      }
    }

    if (nearest) {
      // Create new projectile for chain
      const chainProjectile = new Projectile({
        x: hitEnemy.x,
        y: hitEnemy.y,
        angle: Math.atan2(nearest.y - hitEnemy.y, nearest.x - hitEnemy.x),
        target: nearest,
        attackData: this.attackData,
        owner: this.owner
      });
      chainProjectile.chainCount = this.chainCount + 1;
      chainProjectile.hitEnemies = new Set(this.hitEnemies); // Copy hit list

      projectileManager.projectiles.push(chainProjectile);
    }
  }

  destroy() {
    this.isAlive = false;
  }
}

// Projectile Manager
class ProjectileManager {
  constructor() {
    this.projectiles = [];
  }

  update(deltaTime) {
    // Update all projectiles
    for (let projectile of this.projectiles) {
      projectile.update(deltaTime);
    }

    // Remove dead projectiles
    this.projectiles = this.projectiles.filter(p => p.isAlive);
  }

  add(projectile) {
    // Enforce projectile limit to prevent lag
    if (this.projectiles.length >= MAX_PROJECTILES) {
      // Remove oldest projectile to make room
      const oldest = this.projectiles[0];
      if (oldest) oldest.destroy();
    }
    this.projectiles.push(projectile);
  }

  clear() {
    this.projectiles = [];
  }
}

// Singleton instance
export const projectileManager = new ProjectileManager();

// Helper function to create projectiles
export function createProjectile(config) {
  const projectile = new Projectile(config);
  projectileManager.add(projectile);
  return projectile;
}

// Helper function to get all projectiles
export function getProjectiles() {
  return projectileManager.projectiles;
}
