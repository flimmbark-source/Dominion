/**
 * Projectile System
 * Handles all auto-attack projectiles
 */

import { state } from '../state/gameState.js';
import { addDamageNumber } from './damageNumbers.js';
import { addScreenShake } from './cameraEffects.js';
import { removeNPC } from '../npc/npcManager.js';

class Projectile {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.angle = config.angle;
    this.target = config.target;
    this.attackData = config.attackData;
    this.owner = config.owner;

    // Calculate velocity
    this.vx = Math.cos(this.angle) * this.attackData.projectileSpeed;
    this.vy = Math.sin(this.angle) * this.attackData.projectileSpeed;

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
    this.distanceTraveled += this.attackData.projectileSpeed * deltaTime;
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
        this.vx = this.vx * (1 - this.homingStrength) + normalizedX * this.attackData.projectileSpeed * this.homingStrength;
        this.vy = this.vy * (1 - this.homingStrength) + normalizedY * this.attackData.projectileSpeed * this.homingStrength;

        // Normalize velocity
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 0) {
          this.vx = (this.vx / speed) * this.attackData.projectileSpeed;
          this.vy = (this.vy / speed) * this.attackData.projectileSpeed;
        }

        // Update angle for sprite rotation
        this.angle = Math.atan2(this.vy, this.vx);
      }
    }

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.attackData.projectileSpeed * deltaTime;
  }

  updateArc(deltaTime) {
    // Parabolic arc (like thrown object)
    this.vy += this.gravity * deltaTime;

    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    this.distanceTraveled += this.attackData.projectileSpeed * deltaTime;
  }

  checkCollisions() {
    // If projectile is from an NPC, check if it hits the player
    if (this.owner !== state.player) {
      const player = state.player;
      if (!player.dead) {
        const distance = Math.hypot(player.x - this.x, player.y - this.y);
        const collisionRadius = (this.attackData.projectileSize || 0.5) * 16 + (player.r || 10);

        if (distance < collisionRadius) {
          this.onHitPlayer(player);
          this.destroy();
          return;
        }
      }
    }

    // If projectile is from player, check if it hits NPCs
    if (this.owner === state.player) {
      for (let enemy of state.npcs) {
        if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;
        if (this.hitEnemies.has(enemy.id)) continue; // Already hit with pierce

        const distance = Math.hypot(enemy.x - this.x, enemy.y - this.y);
        const collisionRadius = (this.attackData.projectileSize || 0.5) * 16 + (enemy.r || 16);

        if (distance < collisionRadius) {
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

    for (let enemy of state.npcs) {
      if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;
      const distance = Math.hypot(enemy.x - epicenter.x, enemy.y - epicenter.y);

      if (distance <= this.attackData.aoeRadius * 16) {
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
    let nearest = null;
    let nearestDist = Infinity;

    for (let enemy of state.npcs) {
      if (!enemy.attackable || (enemy.health || enemy.hp) <= 0) continue;
      if (enemy === hitEnemy) continue;
      if (this.hitEnemies.has(enemy.id)) continue;

      const distance = Math.hypot(enemy.x - hitEnemy.x, enemy.y - hitEnemy.y);
      if (distance < chainRange && distance < nearestDist) {
        nearest = enemy;
        nearestDist = distance;
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
