/**
 * Auto-Attack Item System
 * Each attack item auto-fires on its own cooldown
 */

import { state } from '../state/gameState.js';
import { createProjectile } from './projectiles.js';

export class AttackItem {
  constructor(config) {
    // Copy all properties from config
    Object.assign(this, config);

    // Runtime state
    this.cooldownTimer = 0;
    this.temporaryTimer = this.duration || 0; // For temporary items
  }

  update(deltaTime, player, enemies) {
    // Handle temporary item expiration
    if (this.temporary) {
      this.temporaryTimer -= deltaTime;
      if (this.temporaryTimer <= 0) {
        return 'expired'; // Signal to remove this item
      }
    }

    // Update cooldown
    this.cooldownTimer -= deltaTime;

    // Try to fire if ready
    if (this.cooldownTimer <= 0) {
      const target = this.findTarget(player, enemies);
      if (target) {
        this.fire(player, target);
        this.cooldownTimer = this.fireRate;
        return 'fired'; // Signal that we fired
      }
    }

    return 'waiting';
  }

  findTarget(player, enemies) {
    const enemiesInRange = enemies.filter(enemy => {
      const distance = this.getDistance(player, enemy);
      return distance <= this.range && enemy.hp > 0 && enemy.attackable;
    });

    if (enemiesInRange.length === 0) return null;

    // Different targeting modes
    switch(this.targetingMode) {
      case 'nearest':
        return this.findNearest(player, enemiesInRange);
      case 'lowestHP':
        return enemiesInRange.reduce((lowest, enemy) =>
          enemy.hp < lowest.hp ? enemy : lowest
        );
      case 'highestHP':
        return enemiesInRange.reduce((highest, enemy) =>
          enemy.hp > highest.hp ? enemy : highest
        );
      case 'random':
        return enemiesInRange[Math.floor(Math.random() * enemiesInRange.length)];
      default:
        return this.findNearest(player, enemiesInRange);
    }
  }

  findNearest(player, enemies) {
    let nearest = enemies[0];
    let nearestDist = this.getDistance(player, nearest);

    for (let enemy of enemies) {
      const dist = this.getDistance(player, enemy);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  fire(player, target) {
    // Handle multi-projectile attacks (shotgun pattern)
    const projectileCount = this.projectileCount || 1;
    const spreadAngle = this.spreadAngle || 0;

    for (let i = 0; i < projectileCount; i++) {
      // Calculate angle for this projectile
      const baseAngle = this.getAngle(player, target);
      let angle = baseAngle;

      if (projectileCount > 1) {
        const offsetAngle = spreadAngle * ((i / (projectileCount - 1)) - 0.5);
        angle = baseAngle + (offsetAngle * Math.PI / 180);
      }

      // Create projectile
      createProjectile({
        x: player.x,
        y: player.y,
        angle: angle,
        target: target,
        attackData: this,
        owner: player
      });
    }

    // TODO: Play sound effect
    // game.audioManager.play(this.soundEffect);
  }

  getDistance(entity1, entity2) {
    const dx = entity2.x - entity1.x;
    const dy = entity2.y - entity1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getAngle(from, to) {
    return Math.atan2(to.y - from.y, to.x - from.x);
  }

  getCooldownPercent() {
    return Math.max(0, Math.min(1, this.cooldownTimer / this.fireRate));
  }

  getTemporaryPercent() {
    if (!this.temporary) return 1;
    return Math.max(0, this.temporaryTimer / this.duration);
  }
}
