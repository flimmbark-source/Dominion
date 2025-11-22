/**
 * Item Rarity System
 */
export const RARITY = {
  COMMON: 'common',
  RARE: 'rare',
  LEGENDARY: 'legendary'
};

export const RARITY_COLORS = {
  [RARITY.COMMON]: '#9e9e9e',
  [RARITY.RARE]: '#5c6bc0',
  [RARITY.LEGENDARY]: '#ff6f00'
};

/**
 * Item Categories
 */
export const CATEGORY = {
  WEAPON: 'weapon',
  ARMOR: 'armor',
  CONSUMABLE: 'consumable',
  TRINKET: 'trinket'
};

/**
 * Expanded Item Database
 * Each item includes gothic fairytale flavor text
 */
export const ITEMS = [
  // ============================================================================
  // WEAPONS
  // ============================================================================
  {
    id: 'dagger',
    key: '1',
    name: 'Venom-Barbed Shiv',
    price: 120,
    rarity: RARITY.COMMON,
    category: CATEGORY.WEAPON,
    type: 'passive',
    icon: 'dagger',
    desc: '+10 Attack Damage',
    flavor: 'Forged in the shadows, its edge weeps a poison that whispers of eternal sleep.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'dagger'),
    effects: {
      add: { attackDamage: 10 }
    }
  },
  {
    id: 'cursedBlade',
    key: '2',
    name: "Widow's Fang",
    price: 280,
    rarity: RARITY.RARE,
    category: CATEGORY.WEAPON,
    type: 'passive',
    icon: 'dagger',
    desc: '+20 Attack Damage, +10% Crit Chance',
    flavor: 'A blade forged from the fang of a spider queen. Each strike carries the memory of her eight-legged embrace.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'cursedBlade'),
    effects: {
      add: { attackDamage: 20, critChance: 0.1 }
    }
  },
  {
    id: 'shadowReaper',
    key: '3',
    name: 'Shadow Reaper',
    price: 500,
    rarity: RARITY.LEGENDARY,
    category: CATEGORY.WEAPON,
    type: 'passive',
    icon: 'dagger',
    desc: '+35 Attack Damage, +20% Crit Damage',
    flavor: 'Stolen from the Dark Lord himself. It hungers for the light, and devours it with each swing.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'shadowReaper'),
    effects: {
      add: { attackDamage: 35, critDamage: 0.2 }
    }
  },

  // ============================================================================
  // ARMOR - BOOTS
  // ============================================================================
  {
    id: 'boots',
    key: '4',
    name: 'Boots of the Whipwind',
    price: 100,
    rarity: RARITY.COMMON,
    category: CATEGORY.ARMOR,
    type: 'passive',
    icon: 'boots',
    desc: '+40 Movement Speed',
    flavor: 'Woven from the hair of a banshee. They carry you swift as her wail through the night.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'boots'),
    effects: {
      add: { movementSpeed: 40 }
    }
  },
  {
    id: 'swiftShadowBoots',
    key: '5',
    name: 'Boots of Swift Shadow',
    price: 250,
    rarity: RARITY.RARE,
    category: CATEGORY.ARMOR,
    type: 'passive',
    icon: 'boots',
    desc: '+70 Movement Speed, -20% Detection',
    flavor: 'Blessed by a trickster spirit. Your footfalls become whispers in the dark.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'swiftShadowBoots'),
    effects: {
      add: { movementSpeed: 70 },
      mult: { stealthFactor: 0.8 }
    }
  },

  // ============================================================================
  // ARMOR - CLOAKS
  // ============================================================================
  {
    id: 'cloak',
    key: '6',
    name: 'Cloak of Nightwhisper',
    price: 150,
    rarity: RARITY.COMMON,
    category: CATEGORY.ARMOR,
    type: 'passive',
    icon: 'cloak',
    desc: '-40% Detection Buildup',
    flavor: 'Spun from midnight itself. Wear it, and become one with the darkness.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'cloak'),
    effects: {
      mult: { stealthFactor: 0.6 }
    }
  },
  {
    id: 'shroudOfLies',
    key: '7',
    name: 'Shroud of a Thousand Lies',
    price: 320,
    rarity: RARITY.RARE,
    category: CATEGORY.ARMOR,
    type: 'passive',
    icon: 'cloak',
    desc: '-60% Detection, +15 HP',
    flavor: 'Each thread is a broken promise. Drape yourself in deception.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'shroudOfLies'),
    effects: {
      add: { maxHealth: 15 },
      mult: { stealthFactor: 0.4 }
    }
  },
  {
    id: 'wraithMantle',
    key: '8',
    name: "Wraith's Mantle",
    price: 600,
    rarity: RARITY.LEGENDARY,
    category: CATEGORY.ARMOR,
    type: 'passive',
    icon: 'cloak',
    desc: '-75% Detection, +30 HP, +25 MS',
    flavor: 'The final garment of a forgotten ghost. You are but a memory in the eyes of the living.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'wraithMantle'),
    effects: {
      add: { maxHealth: 30, movementSpeed: 25 },
      mult: { stealthFactor: 0.25 }
    }
  },

  // ============================================================================
  // TRINKETS
  // ============================================================================
  {
    id: 'ravenFeather',
    key: '9',
    name: "Raven's Omen",
    price: 180,
    rarity: RARITY.RARE,
    category: CATEGORY.TRINKET,
    type: 'passive',
    icon: 'cloak',
    desc: '+15% Crit Chance',
    flavor: 'A black feather that fell from Death\'s messenger. It marks you as one who walks between worlds.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'ravenFeather'),
    effects: {
      add: { critChance: 0.15 }
    }
  },
  {
    id: 'twistedRing',
    key: 'q',
    name: 'Ring of Twisted Thorns',
    price: 200,
    rarity: RARITY.RARE,
    category: CATEGORY.TRINKET,
    type: 'passive',
    icon: 'dagger',
    desc: '+15 Damage, +20 HP',
    flavor: 'Torn from the hand of a sleeping prince. The thorns grow inward, feeding on pain.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'twistedRing'),
    effects: {
      add: { attackDamage: 15, maxHealth: 20 }
    }
  },
  {
    id: 'witchEye',
    key: 'w',
    name: "Witch's Third Eye",
    price: 350,
    rarity: RARITY.LEGENDARY,
    category: CATEGORY.TRINKET,
    type: 'passive',
    icon: 'cloak',
    desc: '+25% Crit Chance, +30% Crit Damage',
    flavor: 'Plucked from a crone who saw too much. Now you see what others cannot.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'witchEye'),
    effects: {
      add: { critChance: 0.25, critDamage: 0.3 }
    }
  },
  {
    id: 'bloodPact',
    key: 'e',
    name: 'Pact Written in Blood',
    price: 450,
    rarity: RARITY.LEGENDARY,
    category: CATEGORY.TRINKET,
    type: 'passive',
    icon: 'dagger',
    desc: '+40 Damage, -20 HP',
    flavor: 'Power demands sacrifice. You traded life for death, health for harm.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'bloodPact'),
    effects: {
      add: { attackDamage: 40, maxHealth: -20 }
    }
  },

  // ============================================================================
  // CONSUMABLES - POTIONS
  // ============================================================================
  {
    id: 'moonleaf',
    key: 'r',
    name: 'Moonleaf Draught',
    price: 90,
    rarity: RARITY.COMMON,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'moonleaf',
    desc: 'Restores 30 HP',
    flavor: 'Brewed from flowers that only bloom under a full moon. Sweet as honey, bright as hope.'
  },
  {
    id: 'invis',
    key: 't',
    name: 'Potion of Vanishing',
    price: 80,
    rarity: RARITY.COMMON,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'invisibilityPotion',
    desc: 'Grants invisibility for 6s',
    flavor: 'One sip and you fade like morning mist. But nothing stays hidden forever.'
  },
  {
    id: 'greaterHealing',
    key: 'y',
    name: 'Elixir of Life Eternal',
    price: 180,
    rarity: RARITY.RARE,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'moonleaf',
    desc: 'Restores 60 HP',
    flavor: 'A drop of the fountain that flows in the realm of dreams. Drink deep of renewal.'
  },
  {
    id: 'shadowEssence',
    key: 'u',
    name: 'Essence of Shadow',
    price: 150,
    rarity: RARITY.RARE,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'invisibilityPotion',
    desc: 'Invisibility for 10s',
    flavor: 'Distilled from the darkest corners of the world. Become nothing, become no one.'
  },
  {
    id: 'wrathPotion',
    key: 'i',
    name: 'Draught of Berserker Wrath',
    price: 120,
    rarity: RARITY.RARE,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'dagger',
    desc: '+50% Damage for 15s',
    flavor: 'Brewed from the rage of wolves. Feel the beast awakening within.'
  },
  {
    id: 'hastePotion',
    key: 'o',
    name: 'Flask of Quicksilver',
    price: 110,
    rarity: RARITY.RARE,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'boots',
    desc: '+100% Speed for 8s',
    flavor: 'Mercury and moonlight mixed as one. Run like the wind, flee like fear itself.'
  },
  {
    id: 'phoenixTear',
    key: 'p',
    name: "Phoenix's Last Tear",
    price: 400,
    rarity: RARITY.LEGENDARY,
    category: CATEGORY.CONSUMABLE,
    type: 'consumable',
    icon: 'moonleaf',
    desc: 'Full HP restore + invulnerability 3s',
    flavor: 'Shed when the last phoenix died. In death, there is rebirth. In despair, there is hope.'
  }
];

/**
 * Get items by category
 */
export function getItemsByCategory(category) {
  return ITEMS.filter(item => item.category === category);
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(rarity) {
  return ITEMS.filter(item => item.rarity === rarity);
}
