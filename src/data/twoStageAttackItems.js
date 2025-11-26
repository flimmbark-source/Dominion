/**
 * Two-Stage Attack Items Database
 * Complete implementation of 40 items (20 base + 20 modifiers)
 */

// ==================== BASE ATTACK ITEMS ====================

export const BASE_ATTACKS = {
  // ===== GOBLIN ATTACKS =====

  THROWING_DAGGER: {
    id: "throwing_dagger",
    name: "Throwing Dagger",
    icon: "dagger_basic",
    description: "Quick blade that slashes where it lands.",
    rarity: "common",
    heroClass: "goblin",
    goldCost: 0,
    category: "base_attack",

    tags: ["projectile", "blade", "melee", "sharp", "fast"],

    fireRate: 0.7,
    damageType: "physical",

    launch: {
      speed: 15,
      behavior: "straight",
      damage: 5,
      pierce: 0,
      range: 10,
      size: 0.3,
      visual: "spinning_dagger"
    },

    impact: {
      behavior: "swipe",
      swipeCount: 3,
      swipeRadius: 2,
      swipeDelay: 0.08,
      swipeDamage: 8,
      totalDuration: 0.24,
      visual: "blade_slash"
    }
  },

  POISON_NEEDLES: {
    id: "poison_needles",
    name: "Poison Needles",
    icon: "needle_poison",
    description: "Tiny needles that release toxic gas on impact.",
    rarity: "uncommon",
    heroClass: "goblin",
    goldCost: 120,
    category: "base_attack",

    tags: ["projectile", "poison", "gas", "dot"],

    fireRate: 0.4,
    damageType: "poison",

    launch: {
      speed: 20,
      behavior: "straight",
      damage: 3,
      pierce: 0,
      range: 12,
      size: 0.2,
      visual: "green_needle"
    },

    impact: {
      behavior: "gas_cloud",
      cloudRadius: 3,
      cloudDuration: 4,
      tickRate: 0.3,
      tickDamage: 6,
      visual: "poison_gas"
    }
  },

  SHADOW_SHURIKEN: {
    id: "shadow_shuriken",
    name: "Shadow Shuriken",
    icon: "shuriken_shadow",
    description: "Dark throwing star that splits into shadows on impact.",
    rarity: "rare",
    heroClass: "goblin",
    goldCost: 280,
    category: "base_attack",

    tags: ["projectile", "shadow", "multi-hit", "sharp"],

    fireRate: 1.0,
    damageType: "shadow",

    launch: {
      speed: 18,
      behavior: "straight",
      damage: 10,
      pierce: 1,
      range: 15,
      size: 0.35,
      visual: "dark_star"
    },

    impact: {
      behavior: "swipe",
      swipeCount: 6,
      swipeRadius: 2.5,
      swipeDamage: 12,
      swipeDelay: 0.05,
      totalDuration: 0.3,
      visual: "shadow_burst"
    }
  },

  EXPLOSIVE_COIN: {
    id: "explosive_coin",
    name: "Explosive Coin",
    icon: "coin_boom",
    description: "Gold-plated bomb. Greed is explosive.",
    rarity: "epic",
    heroClass: "goblin",
    goldCost: 500,
    category: "base_attack",

    tags: ["projectile", "explosive", "aoe", "gold"],

    fireRate: 1.8,
    damageType: "fire",

    launch: {
      speed: 12,
      behavior: "arc",
      damage: 0,
      pierce: 0,
      range: 10,
      size: 0.4,
      visual: "spinning_coin"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 4.5,
      explosionDamage: 50,
      knockback: 4,
      visual: "gold_explosion"
    }
  },

  CALTROPS_BOMB: {
    id: "caltrops_bomb",
    name: "Caltrops Bomb",
    icon: "caltrops",
    description: "Scatters sharp traps across the ground.",
    rarity: "rare",
    heroClass: "goblin",
    goldCost: 250,
    category: "base_attack",

    tags: ["projectile", "trap", "area_denial", "sharp"],

    fireRate: 2.0,
    damageType: "physical",

    launch: {
      speed: 10,
      behavior: "arc",
      damage: 0,
      pierce: 0,
      range: 9,
      size: 0.4,
      visual: "tack_ball"
    },

    impact: {
      behavior: "scatter_traps",
      explosionRadius: 4,
      explosionDamage: 30,
      totalDuration: 0.1,
      visual: "caltrops"
    }
  },

  // ===== KNIGHT ATTACKS =====

  IRON_SLASH_BEAM: {
    id: "iron_slash_beam",
    name: "Iron Slash Beam",
    icon: "sword_beam_iron",
    description: "Channels valor into a blade of light.",
    rarity: "common",
    heroClass: "knight",
    goldCost: 0,
    category: "base_attack",

    tags: ["projectile", "blade", "beam", "melee"],

    fireRate: 1.0,
    damageType: "physical",

    launch: {
      speed: 18,
      behavior: "straight",
      damage: 15,
      pierce: 1,
      range: 6,
      size: 0.5,
      visual: "sword_beam"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 2.5,
      explosionDamage: 25,
      knockback: 2,
      visual: "ground_slam"
    }
  },

  HOLY_SPEAR: {
    id: "holy_spear",
    name: "Blessed Spear",
    icon: "spear_holy",
    description: "Divine lance that radiates holy light.",
    rarity: "rare",
    heroClass: "knight",
    goldCost: 350,
    category: "base_attack",

    tags: ["projectile", "holy", "pierce", "beam"],

    fireRate: 1.5,
    damageType: "holy",

    launch: {
      speed: 20,
      behavior: "straight",
      damage: 18,
      pierce: 3,
      range: 12,
      size: 0.4,
      bonusVsUndead: 1.5,
      visual: "golden_spear"
    },

    impact: {
      behavior: "swipe",
      swipeCount: 4,
      swipeRadius: 4,
      swipeDamage: 15,
      swipeDelay: 0.1,
      totalDuration: 0.4,
      visual: "holy_light_beam"
    }
  },

  SHIELD_BASH_WAVE: {
    id: "shield_bash_wave",
    name: "Shield Bash Wave",
    icon: "shield_wave",
    description: "Protective force that pushes enemies back.",
    rarity: "uncommon",
    heroClass: "knight",
    goldCost: 200,
    category: "base_attack",

    tags: ["projectile", "shield", "knockback", "defensive"],

    fireRate: 1.2,
    damageType: "physical",

    launch: {
      speed: 16,
      behavior: "straight",
      damage: 12,
      pierce: 0,
      range: 7,
      size: 1.2,
      visual: "shield_projectile"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 3.5,
      explosionDamage: 20,
      knockback: 6,
      visual: "shockwave"
    }
  },

  HAMMER_OF_JUSTICE: {
    id: "hammer_of_justice",
    name: "Hammer of Justice",
    icon: "hammer_holy",
    description: "Massive hammer that creates a shockwave crater.",
    rarity: "epic",
    heroClass: "knight",
    goldCost: 550,
    category: "base_attack",

    tags: ["projectile", "heavy", "aoe", "stun"],

    fireRate: 2.5,
    damageType: "physical",

    launch: {
      speed: 10,
      behavior: "arc",
      damage: 20,
      pierce: 0,
      range: 8,
      size: 0.8,
      visual: "flying_hammer"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 6,
      explosionDamage: 60,
      knockback: 5,
      visual: "holy_crater"
    }
  },

  // ===== ALCHEMIST ATTACKS =====

  ACID_VIAL: {
    id: "acid_vial",
    name: "Acid Vial",
    icon: "vial_acid",
    description: "Corrosive liquid that pools on the ground.",
    rarity: "common",
    heroClass: "alchemist",
    goldCost: 0,
    category: "base_attack",

    tags: ["projectile", "poison", "puddle", "dot"],

    fireRate: 0.9,
    damageType: "poison",

    launch: {
      speed: 12,
      behavior: "arc",
      damage: 5,
      pierce: 0,
      range: 10,
      size: 0.4,
      visual: "green_vial"
    },

    impact: {
      behavior: "acid_puddle",
      puddleRadius: 2.5,
      cloudDuration: 6,
      tickRate: 0.4,
      tickDamage: 5,
      visual: "acid_pool"
    }
  },

  FLAME_FLASK: {
    id: "flame_flask",
    name: "Flame Flask",
    icon: "flask_fire",
    description: "Volatile mixture that ignites everything.",
    rarity: "uncommon",
    heroClass: "alchemist",
    goldCost: 180,
    category: "base_attack",

    tags: ["projectile", "fire", "explosion", "burn"],

    fireRate: 1.3,
    damageType: "fire",

    launch: {
      speed: 11,
      behavior: "arc",
      damage: 8,
      pierce: 0,
      range: 10,
      size: 0.4,
      visual: "orange_flask"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 3.5,
      explosionDamage: 25,
      visual: "fire_burst"
    }
  },

  FROST_BOMB: {
    id: "frost_bomb",
    name: "Cryo Bomb",
    icon: "bomb_ice",
    description: "Freezes enemies in an icy explosion.",
    rarity: "rare",
    heroClass: "alchemist",
    goldCost: 300,
    category: "base_attack",

    tags: ["projectile", "ice", "slow", "aoe"],

    fireRate: 1.8,
    damageType: "ice",

    launch: {
      speed: 9,
      behavior: "arc",
      damage: 0,
      pierce: 0,
      range: 11,
      size: 0.5,
      visual: "ice_sphere"
    },

    impact: {
      behavior: "explosion",
      explosionRadius: 4,
      explosionDamage: 30,
      visual: "ice_explosion"
    }
  },

  STORM_BOTTLE: {
    id: "storm_bottle",
    name: "Bottled Storm",
    icon: "bottle_storm",
    description: "Unleashes a miniature tempest.",
    rarity: "epic",
    heroClass: "alchemist",
    goldCost: 480,
    category: "base_attack",

    tags: ["projectile", "lightning", "storm", "zone"],

    fireRate: 2.2,
    damageType: "lightning",

    launch: {
      speed: 13,
      behavior: "arc",
      damage: 10,
      pierce: 0,
      range: 12,
      size: 0.5,
      visual: "swirling_bottle"
    },

    impact: {
      behavior: "lightning_storm",
      stormRadius: 4,
      stormDuration: 5,
      boltCount: 8,
      boltRate: 0.6,
      boltDamage: 20,
      visual: "storm_cloud"
    }
  },

  // ===== WITCH ATTACKS =====

  SHADOW_BOLT: {
    id: "shadow_bolt",
    name: "Shadow Bolt",
    icon: "bolt_shadow",
    description: "Bolt of darkness that lingers as a damaging shade.",
    rarity: "common",
    heroClass: "witch",
    goldCost: 0,
    category: "base_attack",

    tags: ["projectile", "shadow", "magic", "zone"],

    fireRate: 1.1,
    damageType: "shadow",

    launch: {
      speed: 12,
      behavior: "straight",
      damage: 12,
      pierce: 0,
      range: 15,
      size: 0.4,
      visual: "dark_bolt"
    },

    impact: {
      behavior: "shadow_zone",
      zoneRadius: 2,
      cloudDuration: 3,
      tickRate: 0.3,
      tickDamage: 6,
      visual: "dark_mist"
    }
  },

  THORN_VOLLEY: {
    id: "thorn_volley",
    name: "Nature's Fury",
    icon: "thorns",
    description: "Summons thorns that strike in a pattern.",
    rarity: "rare",
    heroClass: "witch",
    goldCost: 320,
    category: "base_attack",

    tags: ["projectile", "nature", "multi-hit", "pierce"],

    fireRate: 0.8,
    damageType: "physical",

    launch: {
      speed: 16,
      behavior: "straight",
      damage: 6,
      pierce: 0,
      range: 12,
      size: 0.3,
      visual: "thorn_triple"
    },

    impact: {
      behavior: "swipe",
      swipeCount: 8,
      swipeRadius: 3,
      swipeDamage: 12,
      swipeDelay: 0.06,
      totalDuration: 0.48,
      visual: "thorn_explosion"
    }
  },

  CURSE_ORB: {
    id: "curse_orb",
    name: "Orb of Malice",
    icon: "curse",
    description: "Weakens all who touch its dark energy.",
    rarity: "rare",
    heroClass: "witch",
    goldCost: 320,
    category: "base_attack",

    tags: ["projectile", "curse", "debuff", "slow"],

    fireRate: 1.4,
    damageType: "shadow",

    launch: {
      speed: 11,
      behavior: "wave",
      waveFrequency: 2,
      waveAmplitude: 1.5,
      damage: 8,
      pierce: 2,
      range: 12,
      size: 0.5,
      visual: "purple_orb"
    },

    impact: {
      behavior: "curse_field",
      cloudRadius: 4,
      cloudDuration: 6,
      tickRate: 0.5,
      tickDamage: 5,
      visual: "curse_circle"
    }
  }
};

// ==================== MODIFIER ITEMS ====================

export const MODIFIERS = {
  // ===== LAUNCH MODIFIERS =====

  SWIFT_BOOTS: {
    id: "swift_boots",
    name: "Boots of Swiftness",
    icon: "boots_speed",
    description: "Projectiles fly 40% faster.",
    rarity: "common",
    category: "modifier",
    goldCost: 100,

    modifierType: "launch_speed",
    affectsAll: true,
    visual: "blue_glow",

    modification: {
      speedMultiplier: 1.4
    }
  },

  HOMING_CHARM: {
    id: "homing_charm",
    name: "Tracking Charm",
    icon: "charm_homing",
    description: "Projectiles curve toward targets.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 180,

    modifierType: "launch_behavior",
    affectsAll: true,
    visual: "blue_swirl",

    modification: {
      addBehavior: "homing",
      homingStrength: 0.7
    }
  },

  PIERCE_RUNE: {
    id: "pierce_rune",
    name: "Rune of Penetration",
    icon: "rune_pierce",
    description: "Projectiles pass through 2 additional enemies.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 160,

    modifierType: "launch_pierce",
    affectsAll: true,
    visual: "blue_rune",

    modification: {
      addPierce: 2,
      launchDamageMultiplier: 1.15
    }
  },

  RANGE_EXTENDER: {
    id: "range_extender",
    name: "Far-Sight Lens",
    icon: "lens_range",
    description: "Projectile range +50%.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 180,

    modifierType: "launch_range",
    affectsAll: true,
    visual: "blue_eye",

    modification: {
      rangeMultiplier: 1.5
    }
  },

  // ===== IMPACT MODIFIERS =====

  SHATTER_BRACERS: {
    id: "shatter_bracers",
    name: "Bracers of Shattering",
    icon: "bracers_shatter",
    description: "Impact effects explode into 5 sharp fragments.",
    rarity: "rare",
    category: "modifier",
    goldCost: 350,

    modifierType: "impact_shatter",
    affectsTags: ["blade", "sharp", "projectile"],
    visual: "red_shards",

    modification: {
      addEffect: "shatter",
      shatterCount: 5,
      impactDamageMultiplier: 1.5
    }
  },

  LINGERING_RING: {
    id: "lingering_ring",
    name: "Ring of Persistence",
    icon: "ring_duration",
    description: "Area effects last twice as long.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 200,

    modifierType: "impact_duration",
    affectsTags: ["storm", "puddle", "zone", "field"],
    visual: "red_pulse",

    modification: {
      durationMultiplier: 2.0
    }
  },

  EXPANSION_GEM: {
    id: "expansion_gem",
    name: "Gem of Expansion",
    icon: "gem_size",
    description: "Impact effects are 50% larger.",
    rarity: "rare",
    category: "modifier",
    goldCost: 320,

    modifierType: "impact_size",
    affectsAll: true,
    visual: "red_expand",

    modification: {
      radiusMultiplier: 1.5,
      sizeMultiplier: 1.5
    }
  },

  // ===== DAMAGE MODIFIERS =====

  FLAME_ENCHANTMENT: {
    id: "flame_enchantment",
    name: "Enchantment of Flame",
    icon: "enchant_fire",
    description: "Converts damage to fire type, +25% damage.",
    rarity: "rare",
    category: "modifier",
    goldCost: 300,

    modifierType: "damage_conversion",
    affectsAll: true,
    visual: "orange_flames",

    modification: {
      convertToType: "fire",
      damageMultiplier: 1.25,
      affectsStages: ["launch", "impact"]
    }
  },

  FROST_INFUSION: {
    id: "frost_infusion",
    name: "Infusion of Frost",
    icon: "infuse_ice",
    description: "Converts damage to ice type, +20% damage.",
    rarity: "rare",
    category: "modifier",
    goldCost: 280,

    modifierType: "damage_conversion",
    affectsAll: true,
    visual: "blue_frost",

    modification: {
      convertToType: "ice",
      damageMultiplier: 1.2,
      affectsStages: ["launch", "impact"]
    }
  },

  STRENGTH_GAUNTLETS: {
    id: "strength_gauntlets",
    name: "Gauntlets of Might",
    icon: "gauntlets_str",
    description: "All physical damage increased by 30%.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 200,

    modifierType: "damage_boost",
    affectsDamageType: "physical",
    visual: "red_fist",

    modification: {
      damageMultiplier: 1.3,
      affectsStages: ["launch", "impact"]
    }
  },

  SHADOW_AMPLIFIER: {
    id: "shadow_amplifier",
    name: "Amplifier of Darkness",
    icon: "amp_shadow",
    description: "Shadow damage +40%.",
    rarity: "rare",
    category: "modifier",
    goldCost: 340,

    modifierType: "damage_boost",
    affectsDamageType: "shadow",
    visual: "purple_aura",

    modification: {
      damageMultiplier: 1.4,
      affectsStages: ["launch", "impact"]
    }
  },

  // ===== GENERAL MODIFIERS =====

  RAPID_FIRE_SPRING: {
    id: "rapid_fire_spring",
    name: "Coiled Spring",
    icon: "spring",
    description: "Attack 35% faster.",
    rarity: "uncommon",
    category: "modifier",
    goldCost: 220,

    modifierType: "fire_rate",
    affectsAll: true,
    visual: "green_spiral",

    modification: {
      fireRateMultiplier: 0.65
    }
  },

  VAMPIRIC_AMULET: {
    id: "vampiric_amulet",
    name: "Amulet of Vampirism",
    icon: "amulet_vamp",
    description: "Heal for 20% of all damage dealt.",
    rarity: "rare",
    category: "modifier",
    goldCost: 380,

    modifierType: "lifesteal",
    affectsAll: true,
    visual: "red_heart",

    modification: {
      lifestealPercent: 0.2,
      affectsStages: ["launch", "impact"]
    }
  }
};

// Combined database
export const TWO_STAGE_ITEM_DATABASE = {
  ...BASE_ATTACKS,
  ...MODIFIERS
};

// Helper functions
export function getItem(id) {
  return TWO_STAGE_ITEM_DATABASE[id];
}

export function getStartingWeaponTwoStage(heroType) {
  switch(heroType) {
    case 'goblin': return BASE_ATTACKS.THROWING_DAGGER;
    case 'knight': return BASE_ATTACKS.IRON_SLASH_BEAM;
    case 'alchemist': return BASE_ATTACKS.ACID_VIAL;
    case 'witch': return BASE_ATTACKS.SHADOW_BOLT;
    default: return BASE_ATTACKS.THROWING_DAGGER;
  }
}

export function getAllBaseAttacks() {
  return Object.values(BASE_ATTACKS);
}

export function getAllModifiers() {
  return Object.values(MODIFIERS);
}

export function getAttacksByHeroClass(heroClass) {
  return Object.values(BASE_ATTACKS).filter(item => item.heroClass === heroClass);
}

export function getModifiersByType(modifierType) {
  return Object.values(MODIFIERS).filter(item => item.modifierType === modifierType);
}
