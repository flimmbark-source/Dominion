import { state } from '../state/gameState.js';

/**
 * Camera effects system for screen shake and other visual feedback
 */

const cameraEffects = {
  shakes: [],
  hitStop: {
    active: false,
    duration: 0,
    remaining: 0
  }
};

/**
 * Add a screen shake effect
 * @param {Object} options - Shake configuration
 * @param {number} options.intensity - Shake strength (pixels)
 * @param {number} options.duration - How long to shake (seconds)
 * @param {number} options.frequency - How fast to shake (default: 30 Hz)
 */
export function addScreenShake({ intensity = 8, duration = 0.2, frequency = 30 } = {}) {
  cameraEffects.shakes.push({
    intensity,
    duration,
    elapsed: 0,
    frequency,
    phase: Math.random() * Math.PI * 2
  });
}

/**
 * Add a hit stop (freeze frame) effect
 * @param {number} duration - How long to freeze (seconds)
 */
export function addHitStop(duration = 0.05) {
  if (cameraEffects.hitStop.active && cameraEffects.hitStop.remaining > duration) {
    // Keep the longer hit stop
    return;
  }

  cameraEffects.hitStop.active = true;
  cameraEffects.hitStop.duration = duration;
  cameraEffects.hitStop.remaining = duration;
}

/**
 * Update camera effects (call every frame)
 * @param {number} dt - Delta time in seconds
 * @returns {number} - Actual dt after hit stop
 */
export function updateCameraEffects(dt) {
  let actualDt = dt;

  // Update hit stop
  if (cameraEffects.hitStop.active) {
    cameraEffects.hitStop.remaining -= dt;
    if (cameraEffects.hitStop.remaining <= 0) {
      cameraEffects.hitStop.active = false;
      cameraEffects.hitStop.remaining = 0;
    } else {
      // During hit stop, slow down time
      actualDt = 0;
    }
  }

  // Update shakes
  for (let i = cameraEffects.shakes.length - 1; i >= 0; i--) {
    const shake = cameraEffects.shakes[i];
    shake.elapsed += dt;

    if (shake.elapsed >= shake.duration) {
      cameraEffects.shakes.splice(i, 1);
    }
  }

  return actualDt;
}

/**
 * Get current camera offset from all active effects
 * @returns {{x: number, y: number}}
 */
export function getCameraOffset() {
  let offsetX = 0;
  let offsetY = 0;

  // Combine all active shakes
  for (const shake of cameraEffects.shakes) {
    const progress = shake.elapsed / shake.duration;
    const decay = 1 - progress; // Linear decay
    const currentIntensity = shake.intensity * decay;

    // Use phase offset to make each shake unique
    const angle = (shake.elapsed * shake.frequency * Math.PI * 2) + shake.phase;

    offsetX += Math.cos(angle) * currentIntensity;
    offsetY += Math.sin(angle * 1.3) * currentIntensity; // Different frequency for Y
  }

  return { x: Math.round(offsetX), y: Math.round(offsetY) };
}

/**
 * Check if hit stop is currently active
 * @returns {boolean}
 */
export function isHitStopActive() {
  return cameraEffects.hitStop.active;
}

/**
 * Clear all camera effects (useful for scene transitions)
 */
export function clearCameraEffects() {
  cameraEffects.shakes = [];
  cameraEffects.hitStop.active = false;
  cameraEffects.hitStop.remaining = 0;
}

/**
 * Get camera effects state (for debugging)
 */
export function getCameraEffectsState() {
  return {
    shakeCount: cameraEffects.shakes.length,
    hitStopActive: cameraEffects.hitStop.active,
    hitStopRemaining: cameraEffects.hitStop.remaining
  };
}
