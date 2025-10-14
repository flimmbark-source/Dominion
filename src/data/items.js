export const ITEMS = [
  {
    id: 'boots',
    key: '1',
    name: 'Boots of the Whipwind',
    price: 100,
    type: 'passive',
    icon: 'boots',
    desc: '+40 MS.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'boots'),
    effects: {
      add: { movementSpeed: 40 }
    }
  },
  {
    id: 'cloak',
    key: '2',
    name: 'Cloak of Nightwhisper',
    price: 150,
    type: 'passive',
    icon: 'cloak',
    desc: '-40% detection buildup.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'cloak'),
    effects: {
      mult: { stealthFactor: 0.6 }
    }
  },
  {
    id: 'dagger',
    key: '3',
    name: 'Venom-Barbed Shiv',
    price: 120,
    type: 'passive',
    icon: 'dagger',
    desc: '+10 Damage.',
    canBuy: p => !p.inventory.some(it => it && it.id === 'dagger'),
    effects: {
      add: { attackDamage: 10 }
    }
  },
  {
    id: 'invis',
    key: '4',
    name: 'Invisibility Potion',
    price: 80,
    type: 'consumable',
    icon: 'invisibilityPotion',
    desc: 'Grants invisibility for 6s.'
  },
  {
    id: 'moonleaf',
    key: '5',
    name: 'Moonleaf Draught',
    price: 90,
    type: 'consumable',
    icon: 'moonleaf',
    desc: 'Restores 30 HP.'
  }
];
