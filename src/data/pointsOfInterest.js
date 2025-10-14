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
    id: 'poi-cursed-shrine-core',
    type: 'cursed-shrine-core',
    label: 'Cursed Shrine',
    x: 3200,
    y: 6200,
    radius: 80,
    prompt: 'Press E to channel the swamp offering.',
    revealed: false,
    eventId: 'mire-whispers',
    requiredPhase: 'challenge',
    diegetic: true
  },
  {
    id: 'poi-runestone-cache',
    type: 'runestone-cache',
    label: 'Ancient Runestones',
    x: 6080,
    y: 5480,
    radius: 74,
    prompt: 'Press E to pry the humming runestones loose.',
    revealed: false,
    eventId: 'fae-witness',
    requiredPhase: 'challenge',
    diegetic: true
  },
  {
    id: 'poi-ember-ambush',
    type: 'ember-ambush',
    label: 'Raider Supply Cache',
    x: 4300,
    y: 3120,
    radius: 86,
    prompt: 'Press E to sabotage the raider ambush.',
    revealed: false,
    eventId: 'ember-watch',
    requiredPhase: 'challenge',
    diegetic: true
  }
];

export { POINTS_OF_INTEREST };
