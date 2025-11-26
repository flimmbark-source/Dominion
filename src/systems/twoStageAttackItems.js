/**
 * Two-Stage Attack Item System
 * Items that fire LAUNCH/IMPACT projectiles
 */

import { state } from '../state/gameState.js';
import { createTwoStageProjectile } from './twoStageProjectiles.js';

export class TwoStageAttackItem {
  constructor(attackData, modifiers = []) {
    // Copy all properties from attack data
    Object.assign(this, attackData);

    // Store modifiers
    this.modifiers = modifiers;

    // Apply fire rate modifiers
    let effectiveFireRate = this.fireRate || 1.0;
    for (const modifier of modifiers) {
      if (modifier.modifierType === 'fire_rate' && (modifier.affectsAll || this.matchesTags(modifier))) {
        effectiveFireRate *= (modifier.modification.fireRateMultiplier || 1);
      }
    }
    this.effectiveFireRate = effectiveFireRate;

    // Runtime state
    this.cooldownTimer = 0;
    this.temporaryTimer = this.duration || 0;
  }

  matchesTags(modifier) {
    if (!modifier.affectsTags || !this.tags) return false;
    return modifier.affectsTags.some(tag => this.tags.includes(tag));
  }

  update(deltaTime, owner, enemies) {
    // Handle temporary item expiration
    if (this.temporary) {
      this.temporaryTimer -= deltaTime;
      if (this.temporaryTimer <= 0) {
        return 'expired';
      }
    }

    // Update cooldown
    this.cooldownTimer -= deltaTime;

    // Try to fire if ready
    if (this.cooldownTimer <= 0) {
      const target = this.findTarget(owner, enemies);
      if (target) {
        this.fire(owner, target);
        this.cooldownTimer = this.effectiveFireRate;
        return 'fired';
      }
    }

    return 'waiting';
  }

  findTarget(owner, enemies) {
    const rangeInPixels = this.launch.range * 16;
    const enemiesInRange = enemies.filter(enemy => {
      const distance = this.getDistance(owner, enemy);
      return distance <= rangeInPixels && (enemy.health || enemy.hp) > 0 && enemy.attackable;
    });

    if (enemiesInRange.length === 0) return null;

    // Default to nearest targeting
    return this.findNearest(owner, enemiesInRange);
  }

  findNearest(owner, enemies) {
    let nearest = enemies[0];
    let nearestDist = this.getDistance(owner, nearest);

    for (const enemy of enemies) {
      const dist = this.getDistance(owner, enemy);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  fire(owner, target) {
    const baseAngle = this.getAngle(owner, target);

    // Create two-stage projectile
    createTwoStageProjectile({
      x: owner.x,
      y: owner.y,
      angle: baseAngle,
      target: target,
      attackData: this,
      owner: owner,
      modifiers: this.modifiers
    });
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
    return Math.max(0, Math.min(1, this.cooldownTimer / this.effectiveFireRate));
  }

  getTemporaryPercent() {
    if (!this.temporary) return 1;
    return Math.max(0, this.temporaryTimer / this.duration);
  }
}
