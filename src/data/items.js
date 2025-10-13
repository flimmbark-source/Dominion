export const ITEMS = [
  {
    id: 'boots',
    key: '1',
    name: 'Boots of the Whipwind',
    price: 100,
    type: 'passive',
    icon: 'boots',
    desc: 'Wyvern-sinew laces grant +40 movement speed.',
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
    desc: 'Mycelium threads slow detection buildup by 40%.',
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
    desc: 'Coated blade boosts attack damage by +10.',
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
    desc: 'One draught renders you unseen for 6 seconds.'
  },
  {
    id: 'moonleaf',
    key: '5',
    name: 'Moonleaf Draught',
    price: 90,
    type: 'consumable',
    icon: 'moonleaf',
    desc: 'Herbal brew that restores 30 health.'
  }
];
