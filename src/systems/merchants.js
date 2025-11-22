import { state } from '../state/gameState.js';
import { ITEMS, RARITY } from '../data/items.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { makeNPC, addVillageNPC } from '../npc/npcManager.js';
import { toast } from '../ui/toast.js';
import { openShop } from './shop.js';

/**
 * Merchant System
 * Manages different types of merchants and their inventories
 */

// Merchant type definitions
export const MERCHANT_TYPE = {
  GOBLIN_TAVERN: 'goblin_tavern',
  TOWN: 'town',
  TRAVELING: 'traveling'
};

/**
 * Item pools for different merchant types
 */
const ITEM_POOLS = {
  // Goblin tavern: goblin/dark/monster themed items and consumables
  goblin: [
    'dagger',         // Venom-Barbed Shiv
    'cursedBlade',    // Widow's Fang (spider themed)
    'twistedRing',    // Ring of Twisted Thorns
    'moonleaf',       // Moonleaf Draught
    'invis',          // Potion of Vanishing
    'wrathPotion',    // Draught of Berserker Wrath
    'greaterHealing', // Elixir of Life Eternal
    'shadowEssence'   // Essence of Shadow
  ],

  // Town merchants: basic equipment and common items
  town: [
    'boots',           // Boots of the Whipwind
    'swiftShadowBoots',// Boots of Swift Shadow
    'cloak',           // Cloak of Nightwhisper
    'shroudOfLies',    // Shroud of a Thousand Lies
    'ravenFeather',    // Raven's Omen
    'moonleaf',        // Moonleaf Draught
    'invis',           // Potion of Vanishing
    'greaterHealing',  // Elixir of Life Eternal
    'hastePotion',     // Flask of Quicksilver
    'dagger',          // Venom-Barbed Shiv
    'twistedRing',     // Ring of Twisted Thorns
    'wrathPotion'      // Draught of Berserker Wrath
  ],

  // Traveling merchant: all items with bias toward rare/legendary
  traveling: ITEMS.map(item => item.id)
};

/**
 * Initialize merchant system
 */
export function initMerchants() {
  if (!state.merchants) {
    state.merchants = {
      goblin: createGoblinInventory(),
      towns: createTownMerchantInventories(),
      traveling: null, // Created when merchant spawns
      travelingMerchant: null, // NPC reference
      nextTravelingSpawn: state.time + 60 + Math.random() * 40,
      townMerchants: [] // NPC references for town merchants
    };

    // Spawn town merchants in each village
    spawnTownMerchants();
  }
}

/**
 * Spawn a merchant in each village near the store building
 */
function spawnTownMerchants() {
  const { forEachVillageInstance } = require('../world/villageTemplates.js');

  forEachVillageInstance((instance, villageIndex) => {
    // Find the store building
    const storeHouse = instance.localHouses.find(h => h.id === 'store');
    if (!storeHouse) {
      console.warn(`No store found in village ${villageIndex}`);
      return;
    }

    // Position merchant near the store door
    const merchantX = storeHouse.localDoorX;
    const merchantY = storeHouse.localDoorY;
    const stationaryRoute = [{ x: merchantX, y: merchantY }];

    const merchant = addVillageNPC('merchant', villageIndex, merchantX, merchantY, stationaryRoute, {
      displayName: 'merchant',
      role: 'merchant',
      merchantType: MERCHANT_TYPE.TOWN,
      villageIndex: villageIndex,
      holdPosition: true
    });

    if (merchant) {
      merchant.isMerchant = true;
      merchant.merchantType = MERCHANT_TYPE.TOWN;
      merchant.villageIndex = villageIndex;
      state.merchants.townMerchants.push(merchant);
    }
  });
}

/**
 * Create randomized goblin tavern inventory (6 items)
 */
function createGoblinInventory() {
  const pool = [...ITEM_POOLS.goblin];
  const count = 6;
  const inventory = [];

  // Shuffle and pick
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    inventory.push(pool.splice(idx, 1)[0]);
  }

  return inventory;
}

/**
 * Create town merchant inventories (distribute items across villages)
 */
function createTownMerchantInventories() {
  const pool = [...ITEM_POOLS.town];
  const villageCount = VILLAGES.length;
  const inventories = [];

  // Shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Distribute items across villages (3-4 items per village)
  for (let v = 0; v < villageCount; v++) {
    const itemsPerMerchant = 3 + Math.floor(Math.random() * 2); // 3-4 items
    const inventory = [];

    for (let i = 0; i < itemsPerMerchant && pool.length > 0; i++) {
      inventory.push(pool.shift());
    }

    inventories[v] = inventory;
  }

  return inventories;
}

/**
 * Create traveling merchant inventory (8 random items, bias toward rare/legendary)
 */
function createTravelingInventory() {
  const inventory = [];
  const itemCount = 8;

  // Separate items by rarity
  const legendaryItems = ITEMS.filter(it => it.rarity === RARITY.LEGENDARY);
  const rareItems = ITEMS.filter(it => it.rarity === RARITY.RARE);
  const commonItems = ITEMS.filter(it => it.rarity === RARITY.COMMON);

  // Guarantee at least 2 legendary, 3 rare
  const guaranteedLegendary = 2;
  const guaranteedRare = 3;

  // Add guaranteed legendaries
  const selectedLegendary = [];
  for (let i = 0; i < guaranteedLegendary && legendaryItems.length > 0; i++) {
    const idx = Math.floor(Math.random() * legendaryItems.length);
    selectedLegendary.push(legendaryItems.splice(idx, 1)[0].id);
  }

  // Add guaranteed rares
  const selectedRare = [];
  for (let i = 0; i < guaranteedRare && rareItems.length > 0; i++) {
    const idx = Math.floor(Math.random() * rareItems.length);
    selectedRare.push(rareItems.splice(idx, 1)[0].id);
  }

  // Fill remaining slots randomly
  const allRemaining = [
    ...legendaryItems.map(it => it.id),
    ...rareItems.map(it => it.id),
    ...commonItems.map(it => it.id)
  ];

  const remaining = itemCount - guaranteedLegendary - guaranteedRare;
  const selectedRemaining = [];
  for (let i = 0; i < remaining && allRemaining.length > 0; i++) {
    const idx = Math.floor(Math.random() * allRemaining.length);
    selectedRemaining.push(allRemaining.splice(idx, 1)[0]);
  }

  return [...selectedLegendary, ...selectedRare, ...selectedRemaining];
}

/**
 * Spawn traveling merchant
 */
export function spawnTravelingMerchant() {
  if (state.merchants.travelingMerchant) return; // Already exists

  // Random spawn location on edge of map
  const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
  let startX, startY, endX, endY;

  switch (edge) {
    case 0: // Top edge, travel to bottom
      startX = WORLD.W * (0.3 + Math.random() * 0.4);
      startY = 100;
      endX = WORLD.W * (0.3 + Math.random() * 0.4);
      endY = WORLD.H - 100;
      break;
    case 1: // Right edge, travel to left
      startX = WORLD.W - 100;
      startY = WORLD.H * (0.3 + Math.random() * 0.4);
      endX = 100;
      endY = WORLD.H * (0.3 + Math.random() * 0.4);
      break;
    case 2: // Bottom edge, travel to top
      startX = WORLD.W * (0.3 + Math.random() * 0.4);
      startY = WORLD.H - 100;
      endX = WORLD.W * (0.3 + Math.random() * 0.4);
      endY = 100;
      break;
    case 3: // Left edge, travel to right
      startX = 100;
      startY = WORLD.H * (0.3 + Math.random() * 0.4);
      endX = WORLD.W - 100;
      endY = WORLD.H * (0.3 + Math.random() * 0.4);
      break;
  }

  // Create waypoints for travel path
  const waypoints = [
    { x: startX, y: startY },
    { x: (startX + endX) / 2, y: (startY + endY) / 2 },
    { x: endX, y: endY }
  ];

  // Create traveling merchant NPC
  const merchant = makeNPC('villager', startX, startY, waypoints, {
    displayName: 'traveling merchant',
    faction: 'neutral',
    role: 'merchant',
    merchantType: MERCHANT_TYPE.TRAVELING
  });

  merchant.isMerchant = true;
  merchant.merchantType = MERCHANT_TYPE.TRAVELING;
  merchant.travelComplete = false;

  state.npcs.push(merchant);
  state.merchants.travelingMerchant = merchant;
  state.merchants.traveling = createTravelingInventory();

  toast('A traveling merchant has arrived carrying rare wares!', 3.0);
}

/**
 * Update traveling merchant system
 */
export function updateTravelingMerchant(dt) {
  if (!state.merchants) return;

  const now = state.time;

  // Check if it's time to spawn
  if (!state.merchants.travelingMerchant && now >= state.merchants.nextTravelingSpawn) {
    spawnTravelingMerchant();
  }

  // Check if traveling merchant has reached destination
  const merchant = state.merchants.travelingMerchant;
  if (merchant && merchant.waypoints && merchant.wpIndex >= merchant.waypoints.length - 1) {
    const lastWaypoint = merchant.waypoints[merchant.waypoints.length - 1];
    const dist = Math.hypot(merchant.x - lastWaypoint.x, merchant.y - lastWaypoint.y);

    if (dist < 20 && !merchant.travelComplete) {
      merchant.travelComplete = true;
      // Remove merchant after short delay
      setTimeout(() => {
        const idx = state.npcs.indexOf(merchant);
        if (idx !== -1) {
          state.npcs.splice(idx, 1);
          state.merchants.travelingMerchant = null;
          state.merchants.traveling = null;
          state.merchants.nextTravelingSpawn = now + 120 + Math.random() * 80; // Respawn in 2-3 minutes
          toast('The traveling merchant departs into the wilderness...', 2.5);
        }
      }, 3000);
    }
  }
}

/**
 * Get inventory for a specific merchant
 */
export function getMerchantInventory(merchantType, villageIndex = null) {
  if (!state.merchants) initMerchants();

  switch (merchantType) {
    case MERCHANT_TYPE.GOBLIN_TAVERN:
      return state.merchants.goblin.map(id => ITEMS.find(it => it.id === id)).filter(Boolean);

    case MERCHANT_TYPE.TOWN:
      if (villageIndex === null) return [];
      const inventory = state.merchants.towns[villageIndex] || [];
      return inventory.map(id => ITEMS.find(it => it.id === id)).filter(Boolean);

    case MERCHANT_TYPE.TRAVELING:
      if (!state.merchants.traveling) return [];
      return state.merchants.traveling.map(id => ITEMS.find(it => it.id === id)).filter(Boolean);

    default:
      return [];
  }
}

/**
 * Get merchant name for UI
 */
export function getMerchantName(merchantType, villageIndex = null) {
  switch (merchantType) {
    case MERCHANT_TYPE.GOBLIN_TAVERN:
      return 'Goblin Merchant';
    case MERCHANT_TYPE.TOWN:
      if (villageIndex !== null && VILLAGES[villageIndex]) {
        return `${VILLAGES[villageIndex].name} Merchant`;
      }
      return 'Town Merchant';
    case MERCHANT_TYPE.TRAVELING:
      return 'Traveling Merchant';
    default:
      return 'Merchant';
  }
}

/**
 * Try to interact with a merchant
 * Returns true if a merchant was found and shop opened
 */
export function tryInteractWithMerchant() {
  const MERCHANT_INTERACT_DISTANCE = 80;
  const player = state.player;

  // Find nearest merchant NPC
  let nearest = null;
  let nearestDist = Infinity;

  for (const npc of state.npcs) {
    if (!npc.isMerchant) continue;

    const dist = Math.hypot(npc.x - player.x, npc.y - player.y);
    if (dist > MERCHANT_INTERACT_DISTANCE) continue;

    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = npc;
    }
  }

  if (!nearest) return false;

  // Open shop with the appropriate merchant type
  openShop(nearest.merchantType, nearest.villageIndex);
  return true;
}
