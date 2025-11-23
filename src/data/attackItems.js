/**
 * Attack Items Database
 * Auto-firing projectile weapons
 */

export const ATTACK_ITEMS = {
  // ===== STARTING WEAPONS =====

  THROWING_DAGGER: {
    id: 'throwing_dagger',
    name: "Throwing Dagger",
    description: "A simple throwing blade. Quick and reliable, if not particularly deadly.",
    icon: "dagger",

    damage: 10,
    fireRate: 0.5,
    range: 8,
    projectileSpeed: 15,
    projectileSize: 0.3,

    damageType: "physical",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "straight",

    visualEffect: "spinning_dagger",
    soundEffect: "knife_throw",
    hitSound: "knife_hit",

    rarity: "common",
    goldCost: 0, // Starting item, not sold
    sellValue: 0
  },

  IRON_SWORD_BEAM: {
    id: 'iron_sword_beam',
    name: "Iron Sword Beam",
    description: "Channels the knight's valor into a blade of light. Short range but powerful.",
    icon: "sword",

    damage: 25,
    fireRate: 1.0,
    range: 5,
    projectileSpeed: 20,
    projectileSize: 0.5,

    damageType: "physical",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "straight",

    visualEffect: "sword_beam",
    soundEffect: "sword_slash",
    hitSound: "sword_impact",

    rarity: "common",
    goldCost: 0,
    sellValue: 0
  },

  ACID_VIAL: {
    id: 'acid_vial',
    name: "Acid Vial",
    description: "A corrosive concoction that eats away at flesh and armor alike.",
    icon: "potion",

    damage: 8,
    fireRate: 0.8,
    range: 10,
    projectileSpeed: 12,
    projectileSize: 0.4,

    damageType: "poison",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "arc",

    statusEffect: "poison",
    statusDuration: 4,
    statusPower: 3,

    visualEffect: "acid_vial",
    soundEffect: "glass_throw",
    hitSound: "acid_splash",

    rarity: "common",
    goldCost: 0,
    sellValue: 0
  },

  SHADOW_BOLT: {
    id: 'shadow_bolt',
    name: "Shadow Bolt",
    description: "A bolt of pure darkness. Slow but devastating from afar.",
    icon: "magic",

    damage: 20,
    fireRate: 1.2,
    range: 15,
    projectileSpeed: 10,
    projectileSize: 0.4,

    damageType: "shadow",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "straight",

    visualEffect: "shadow_bolt",
    soundEffect: "dark_magic",
    hitSound: "shadow_impact",

    rarity: "common",
    goldCost: 0,
    sellValue: 0
  },

  // ===== GOBLIN TAVERN ITEMS =====

  POISONED_KNIVES: {
    id: 'poisoned_knives',
    name: "Poisoned Knives",
    description: "Coated in a nasty toxin. Hurts now, hurts later.",
    icon: "dagger",

    damage: 8,
    fireRate: 0.7,
    range: 8,
    projectileSpeed: 15,
    projectileSize: 0.3,

    damageType: "poison",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "straight",

    statusEffect: "poison",
    statusDuration: 5,
    statusPower: 3,

    visualEffect: "green_dagger",
    soundEffect: "knife_throw",
    hitSound: "poison_splash",

    rarity: "uncommon",
    goldCost: 100,
    sellValue: 50
  },

  EXPLOSIVE_BOMBS: {
    id: 'explosive_bombs',
    name: "Explosive Bombs",
    description: "Sometimes the best solution is to blow things up.",
    icon: "bomb",

    damage: 30,
    fireRate: 2.0,
    range: 10,
    projectileSpeed: 8,
    projectileSize: 0.5,

    damageType: "fire",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "arc",

    aoeRadius: 3,
    aoeDamage: 0.8,
    statusEffect: "burn",
    statusDuration: 3,
    statusPower: 5,

    visualEffect: "bomb",
    soundEffect: "fuse_light",
    hitSound: "explosion",

    rarity: "rare",
    goldCost: 250,
    sellValue: 125
  },

  SHADOW_SHURIKEN: {
    id: 'shadow_shuriken',
    name: "Shadow Shuriken",
    description: "Blades that hunger for their target, never missing their mark.",
    icon: "dagger",

    damage: 15,
    fireRate: 0.3,
    range: 12,
    projectileSpeed: 18,
    projectileSize: 0.3,

    damageType: "shadow",
    pierce: 2,
    targetingMode: "nearest",
    projectileBehavior: "homing",
    homingStrength: 0.8,

    visualEffect: "dark_shuriken",
    soundEffect: "shuriken_throw",
    hitSound: "metal_hit",

    rarity: "epic",
    goldCost: 500,
    sellValue: 250
  },

  RAPID_FIRE_CROSSBOW: {
    id: 'rapid_fire_crossbow',
    name: "Rapid-Fire Crossbow",
    description: "An ingenious goblin contraption. Fires faster than you can blink.",
    icon: "bow",

    damage: 6,
    fireRate: 0.2,
    range: 12,
    projectileSpeed: 25,
    projectileSize: 0.2,

    damageType: "physical",
    pierce: 0,
    targetingMode: "nearest",
    projectileBehavior: "straight",

    visualEffect: "crossbow_bolt",
    soundEffect: "crossbow_fire",
    hitSound: "arrow_hit",

    rarity: "uncommon",
    goldCost: 150,
    sellValue: 75
  }
};

// Helper function to get starting weapon for hero type
export function getStartingWeapon(heroType) {
  switch(heroType) {
    case 'goblin':
      return ATTACK_ITEMS.THROWING_DAGGER;
    case 'knight':
      return ATTACK_ITEMS.IRON_SWORD_BEAM;
    case 'alchemist':
      return ATTACK_ITEMS.ACID_VIAL;
    case 'witch':
      return ATTACK_ITEMS.SHADOW_BOLT;
    default:
      return ATTACK_ITEMS.THROWING_DAGGER;
  }
}

// Get all shop items (for goblin tavern)
export function getGoblinTavernAttackItems() {
  return [
    ATTACK_ITEMS.POISONED_KNIVES,
    ATTACK_ITEMS.RAPID_FIRE_CROSSBOW,
    ATTACK_ITEMS.EXPLOSIVE_BOMBS,
    ATTACK_ITEMS.SHADOW_SHURIKEN
  ];
}
