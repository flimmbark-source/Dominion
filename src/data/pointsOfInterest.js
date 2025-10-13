const POINTS_OF_INTEREST = [
  {
    id: 'poi-shady-trader',
    type: 'shady-trader',
    label: 'Shady Trader',
    x: 4380,
    y: 3080,
    radius: 70,
    prompt: 'Press E to deal with the shady trader (8 gold).',
    revealed: true
  },
  {
    id: 'poi-wandering-merchant',
    type: 'wandering-merchant',
    label: 'Wandering Merchant',
    x: 2100,
    y: 1800,
    radius: 70,
    prompt: 'Press E to browse contraband (12 gold).',
    revealed: true
  },
  {
    id: 'poi-cursed-shrine',
    type: 'cursed-shrine',
    label: 'Cursed Shrine',
    x: 3200,
    y: 6200,
    radius: 80,
    prompt: 'Press E to offer 10 gold at the shrine.',
    revealed: false
  },
  {
    id: 'poi-bog-sprite',
    type: 'bog-sprite',
    label: 'Bog Sprite',
    x: 6200,
    y: 5400,
    radius: 70,
    prompt: 'Press E to feed the bog sprite (5 gold).',
    revealed: true,
    reveals: ['poi-cursed-shrine'],
    hint: 'The sprite rasps: "Seek rune-stones buried southwest of Moonfen."'
  }
];

export { POINTS_OF_INTEREST };
