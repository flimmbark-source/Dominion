export const ITEMS = [
  {
    id: 'boots',
    key: '1',
    name: 'Boots of the Whipwind',
    price: 100,
    type: 'passive',
    desc: 'Wyvern-sinew laces grant +40 movement speed.',
    canBuy: p => !p.stats.hasBoots,
    apply: p => {
      p.stats.hasBoots = true;
      p.stats.speed += 40;
    }
  },
  {
    id: 'cloak',
    key: '2',
    name: 'Cloak of Nightwhisper',
    price: 150,
    type: 'passive',
    desc: 'Mycelium threads slow detection buildup by 40%.',
    canBuy: p => !p.stats.hasCloak,
    apply: p => {
      p.stats.hasCloak = true;
      p.stats.stealthMult *= 0.6;
    }
  },
  {
    id: 'dagger',
    key: '3',
    name: 'Venom-Barbed Shiv',
    price: 120,
    type: 'passive',
    desc: 'Coated blade boosts attack damage by +10.',
    canBuy: p => !p.stats.hasDagger,
    apply: p => {
      p.stats.hasDagger = true;
      p.stats.attack += 10;
    }
  },
  {
    id: 'invis',
    key: '4',
    name: 'Invisibility Potion',
    price: 80,
    type: 'consumable',
    desc: 'One draught renders you unseen for 6 seconds.',
    apply: () => {}
  },
  {
    id: 'moonleaf',
    key: '5',
    name: 'Moonleaf Draught',
    price: 90,
    type: 'consumable',
    desc: 'Herbal brew that restores 30 health.',
    apply: () => {}
  }
];
