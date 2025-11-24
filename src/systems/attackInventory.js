/**
 * Attack Inventory Manager
 * Manages player's attack items and auto-firing
 */

import { state } from '../state/gameState.js';
import { AttackItem } from './attackItems.js';
import { getStartingWeapon } from '../data/attackItems.js';

/**
 * Initialize player's inventory with starting weapon
 */
export function initializePlayerAttackInventory(heroType) {
  const startingWeaponData = getStartingWeapon(heroType);
  const startingWeapon = new AttackItem(startingWeaponData);

  // Place in first slot
  state.player.inventory[0] = startingWeapon;

  // Fill rest with null
  for (let i = 1; i < state.player.inventory.length; i++) {
    state.player.inventory[i] = null;
  }
}

/**
 * Update all attack items in inventory
 */
export function updateAttackInventory(deltaTime) {
  const player = state.player;

  // Filter to only hostile NPCs (darkLord and monster factions)
  const enemies = state.npcs.filter(npc =>
    npc.faction === 'darkLord' || npc.faction === 'monster'
  );

  // Update each equipped attack item
  for (let i = 0; i < player.inventory.length; i++) {
    const item = player.inventory[i];
    if (!item || !(item instanceof AttackItem)) continue;

    const result = item.update(deltaTime, player, enemies);

    // Remove if expired (temporary items)
    if (result === 'expired') {
      player.inventory[i] = null;
      // TODO: Show notification
      console.log(`${item.name} expired!`);
    }
  }
}

/**
 * Add an attack item to inventory
 * Returns true if successfully added, false if inventory full
 */
export function addAttackItemToInventory(itemData) {
  const player = state.player;

  // Find first empty slot
  for (let i = 0; i < player.inventory.length; i++) {
    if (player.inventory[i] === null) {
      player.inventory[i] = new AttackItem(itemData);
      console.log(`Acquired: ${itemData.name}`);
      return true;
    }
  }

  // Inventory full
  console.log('Inventory full!');
  return false;
}

/**
 * Remove item from inventory slot
 */
export function removeAttackItem(slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.player.inventory.length) return null;

  const item = state.player.inventory[slotIndex];
  state.player.inventory[slotIndex] = null;
  return item;
}

/**
 * Get item in slot
 */
export function getAttackItem(slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.player.inventory.length) return null;
  return state.player.inventory[slotIndex];
}

/**
 * Check if inventory has empty slots
 */
export function hasEmptySlot() {
  return state.player.inventory.some(slot => slot === null);
}

/**
 * Get number of filled slots
 */
export function getFilledSlotCount() {
  return state.player.inventory.filter(slot => slot !== null).length;
}
