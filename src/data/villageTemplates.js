export const TEMPLATE_DIMENSIONS = { width: 960, height: 600 };

const fortifiedOutpost = {
  id: 'fortified-outpost',
  label: 'Fortified Outpost',
  description: 'Layered palisades with a central keep and drilled patrol rotations.',
  houses: [
    { id: 'barracks', x: 110, y: 110, w: 150, h: 100, side: 'north', doorOffset: 0.42, jitter: { x: 32, y: 18, door: 0.14 } },
    { id: 'armory', x: 300, y: 120, w: 150, h: 110, side: 'north', doorOffset: 0.58, jitter: { x: 26, y: 16, door: 0.12 } },
    { id: 'tower', x: 520, y: 130, w: 150, h: 120, side: 'north', doorOffset: 0.37, jitter: { x: 24, y: 20, door: 0.1 } },
    { id: 'mess', x: 160, y: 340, w: 150, h: 110, side: 'south', doorOffset: 0.44, jitter: { x: 32, y: 20, door: 0.14 } },
    { id: 'bunks', x: 380, y: 360, w: 160, h: 110, side: 'south', doorOffset: 0.63, jitter: { x: 34, y: 20, door: 0.12 } },
    { id: 'stables', x: 620, y: 330, w: 170, h: 120, side: 'south', doorOffset: 0.5, jitter: { x: 30, y: 22, door: 0.16 } },
    { id: 'store', x: 720, y: 240, w: 140, h: 100, side: 'north', doorOffset: 0.5, jitter: { x: 28, y: 18, door: 0.12 } }
  ],
  roads: [
    {
      id: 'main-avenue',
      rects: [{ x: 80, y: 270, w: 800, h: 60 }],
      tags: ['main', 'guarded', 'broad'],
      connectors: ['west-gate', 'east-gate']
    },
    {
      id: 'inner-ring',
      rects: [{ x: 160, y: 420, w: 640, h: 40 }],
      tags: ['alley', 'stealth'],
      connectors: ['west-alley', 'east-alley']
    },
    {
      id: 'tunnel-run',
      rects: [{ x: 160, y: 520, w: 640, h: 28 }],
      tags: ['underground', 'stealth'],
      connectors: ['west-cellar', 'east-cellar']
    },
    {
      id: 'tower-ramp',
      rects: [{ x: 680, y: 180, w: 120, h: 32 }],
      tags: ['rooftop', 'vantage'],
      connectors: ['north-tower']
    }
  ],
  connectors: {
    west: [
      {
        id: 'west-gate',
        position: { x: 96, y: 300 },
        outside: { x: 36, y: 300 },
        width: 62,
        pathWidth: 56,
        kind: 'gate',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['wall-shadow', 'tunnel-run'],
        priority: 1
      },
      {
        id: 'west-alley',
        position: { x: 110, y: 440 },
        outside: { x: 40, y: 470 },
        width: 34,
        pathWidth: 34,
        kind: 'alley',
        tags: ['secondary', 'alternate', 'stealth'],
        bypassRoutes: ['wall-shadow'],
        priority: 2
      },
      {
        id: 'west-cellar',
        position: { x: 170, y: 546 },
        outside: { x: 170, y: 620 },
        width: 28,
        pathWidth: 30,
        kind: 'tunnel',
        tags: ['alternate', 'stealth', 'underground'],
        bypassRoutes: ['tunnel-run'],
        priority: 3
      }
    ],
    east: [
      {
        id: 'east-gate',
        position: { x: 864, y: 300 },
        outside: { x: 924, y: 300 },
        width: 62,
        pathWidth: 56,
        kind: 'gate',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['wall-shadow', 'tunnel-run'],
        priority: 1
      },
      {
        id: 'east-alley',
        position: { x: 852, y: 440 },
        outside: { x: 916, y: 470 },
        width: 34,
        pathWidth: 34,
        kind: 'alley',
        tags: ['secondary', 'alternate', 'stealth'],
        bypassRoutes: ['wall-shadow'],
        priority: 2
      },
      {
        id: 'east-cellar',
        position: { x: 790, y: 546 },
        outside: { x: 790, y: 620 },
        width: 28,
        pathWidth: 30,
        kind: 'tunnel',
        tags: ['alternate', 'stealth', 'underground'],
        bypassRoutes: ['tunnel-run'],
        priority: 3
      }
    ],
    north: [
      {
        id: 'north-postern',
        position: { x: 480, y: 140 },
        outside: { x: 480, y: 80 },
        width: 42,
        pathWidth: 40,
        kind: 'postern',
        tags: ['secondary', 'main'],
        bypassRoutes: ['main-avenue', 'wall-shadow'],
        priority: 2
      },
      {
        id: 'north-tower',
        position: { x: 720, y: 190 },
        outside: { x: 720, y: 140 },
        width: 30,
        pathWidth: 30,
        kind: 'ladder',
        tags: ['alternate', 'rooftop'],
        bypassRoutes: ['tower-skip'],
        priority: 3
      }
    ],
    south: [
      {
        id: 'south-palisade',
        position: { x: 480, y: 510 },
        outside: { x: 480, y: 560 },
        width: 48,
        pathWidth: 44,
        kind: 'breach',
        tags: ['secondary', 'main'],
        bypassRoutes: ['tunnel-run', 'wall-shadow'],
        priority: 2
      },
      {
        id: 'south-ramp',
        position: { x: 320, y: 520 },
        outside: { x: 320, y: 580 },
        width: 32,
        pathWidth: 32,
        kind: 'ramp',
        tags: ['alternate', 'stealth'],
        bypassRoutes: ['tunnel-run'],
        priority: 3
      }
    ]
  },
  traversalRoutes: [
    {
      id: 'main-avenue',
      label: 'Main Gate-to-Gate Avenue',
      type: 'primary',
      risk: 'high',
      connectors: ['west-gate', 'east-gate'],
      tags: ['guarded', 'direct'],
      nodes: [
        { x: 96, y: 300 },
        { x: 320, y: 296 },
        { x: 520, y: 296 },
        { x: 864, y: 300 }
      ]
    },
    {
      id: 'wall-shadow',
      label: 'Shadowed Inner Alley',
      type: 'alternate',
      risk: 'medium',
      connectors: ['west-alley', 'east-alley'],
      tags: ['stealth', 'alley'],
      nodes: [
        { x: 110, y: 440 },
        { x: 280, y: 452 },
        { x: 520, y: 440 },
        { x: 852, y: 440 }
      ]
    },
    {
      id: 'tunnel-run',
      label: 'Supply Tunnel Crawl',
      type: 'alternate',
      risk: 'low',
      connectors: ['west-cellar', 'east-cellar'],
      tags: ['underground', 'stealth'],
      nodes: [
        { x: 170, y: 546 },
        { x: 360, y: 566 },
        { x: 620, y: 556 },
        { x: 790, y: 546 }
      ]
    },
    {
      id: 'tower-skip',
      label: 'Tower Catwalk',
      type: 'alternate',
      risk: 'medium',
      connectors: ['north-postern', 'north-tower'],
      tags: ['rooftop', 'vantage'],
      nodes: [
        { x: 480, y: 140 },
        { x: 620, y: 170 },
        { x: 720, y: 190 }
      ]
    }
  ],
  safeZones: [
    { id: 'market', label: 'Canvas Market', rect: { x: 320, y: 400, w: 220, h: 120 }, tags: ['cover', 'crowd'] },
    { id: 'chapel', label: 'Chapel Garden', rect: { x: 140, y: 180, w: 170, h: 120 }, tags: ['quiet', 'safe'] }
  ],
  tensionZones: [
    { id: 'gatehouse', label: 'Gatehouse Kill Zone', rect: { x: 60, y: 260, w: 160, h: 120 }, tags: ['chokepoint', 'guarded'] },
    { id: 'keep-overlook', label: 'Keep Overlook', rect: { x: 700, y: 180, w: 180, h: 140 }, tags: ['snipers', 'vantage'] }
  ],
  coverPoints: [
    { id: 'crate-stack', x: 340, y: 448, label: 'Crate Stack', tags: ['cover'] },
    { id: 'supply-wagon', x: 560, y: 452, label: 'Supply Wagon', tags: ['cover'] }
  ],
  vantagePoints: [
    { id: 'watchtower', x: 720, y: 190, label: 'Watchtower Parapet', tags: ['overwatch'] },
    { id: 'gate-tower', x: 120, y: 220, label: 'Gate Tower', tags: ['overwatch'] }
  ],
  chokepoints: [
    { id: 'west-gate', position: { x: 96, y: 300 }, width: 62, bypassRoutes: ['wall-shadow', 'tunnel-run'] },
    { id: 'east-gate', position: { x: 864, y: 300 }, width: 62, bypassRoutes: ['wall-shadow', 'tunnel-run'] }
  ],
  patrols: [
    {
      id: 'gatehouse-round',
      type: 'scout',
      route: [
        { x: 140, y: 280 },
        { x: 220, y: 260 },
        { x: 220, y: 330 },
        { x: 140, y: 320 }
      ],
      spawn: { x: 140, y: 280 },
      tags: ['chokepoint']
    },
    {
      id: 'keep-wall',
      type: 'scout',
      route: [
        { x: 700, y: 200 },
        { x: 780, y: 220 },
        { x: 820, y: 180 },
        { x: 760, y: 160 }
      ],
      spawn: { x: 700, y: 200 },
      tags: ['vantage']
    },
    {
      id: 'market-stroll',
      type: 'villager',
      route: [
        { x: 360, y: 440 },
        { x: 420, y: 468 },
        { x: 520, y: 440 },
        { x: 440, y: 412 }
      ],
      spawn: { x: 420, y: 468 },
      tags: ['civilian']
    }
  ]
};

const crossroadsMarket = {
  id: 'crossroads-market',
  label: 'Crossroads Market',
  description: 'Open bazaar clustered around intersecting trade routes and tight alleys.',
  houses: [
    { id: 'inn', x: 120, y: 120, w: 150, h: 110, side: 'north', doorOffset: 0.5, jitter: { x: 40, y: 24, door: 0.16 } },
    { id: 'smithy', x: 320, y: 140, w: 160, h: 110, side: 'north', doorOffset: 0.32, jitter: { x: 42, y: 20, door: 0.12 } },
    { id: 'guild', x: 560, y: 130, w: 150, h: 110, side: 'north', doorOffset: 0.66, jitter: { x: 38, y: 22, door: 0.12 } },
    { id: 'barracks', x: 740, y: 118, w: 150, h: 120, side: 'north', doorOffset: 0.48, jitter: { x: 36, y: 20, door: 0.12 } },
    { id: 'baker', x: 140, y: 320, w: 150, h: 110, side: 'south', doorOffset: 0.42, jitter: { x: 38, y: 26, door: 0.14 } },
    { id: 'apothecary', x: 360, y: 340, w: 160, h: 110, side: 'south', doorOffset: 0.5, jitter: { x: 36, y: 24, door: 0.16 } },
    { id: 'fletcher', x: 600, y: 330, w: 170, h: 120, side: 'south', doorOffset: 0.58, jitter: { x: 36, y: 22, door: 0.14 } },
    { id: 'store', x: 220, y: 240, w: 140, h: 100, side: 'north', doorOffset: 0.5, jitter: { x: 28, y: 18, door: 0.12 } }
  ],
  roads: [
    {
      id: 'north-south',
      rects: [
        { x: 450, y: 80, w: 60, h: 440 }
      ],
      tags: ['main', 'guarded'],
      connectors: ['north-gate', 'south-gate']
    },
    {
      id: 'east-west',
      rects: [
        { x: 160, y: 260, w: 640, h: 60 }
      ],
      tags: ['main', 'guarded'],
      connectors: ['west-arch', 'east-arch']
    },
    {
      id: 'rooftop-string',
      rects: [
        { x: 360, y: 180, w: 260, h: 28 }
      ],
      tags: ['rooftop', 'alternate'],
      connectors: ['north-balcony', 'east-balcony']
    },
    {
      id: 'cellar-cut',
      rects: [
        { x: 200, y: 480, w: 560, h: 32 }
      ],
      tags: ['underground', 'stealth'],
      connectors: ['south-cellar', 'west-cellar']
    }
  ],
  connectors: {
    north: [
      {
        id: 'north-gate',
        position: { x: 480, y: 84 },
        outside: { x: 480, y: 24 },
        width: 56,
        pathWidth: 52,
        kind: 'gate',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['lakeside-sneak', 'market-crawl'],
        priority: 1
      },
      {
        id: 'north-balcony',
        position: { x: 420, y: 180 },
        outside: { x: 420, y: 120 },
        width: 30,
        pathWidth: 30,
        kind: 'balcony',
        tags: ['alternate', 'rooftop'],
        bypassRoutes: ['sky-thread'],
        priority: 3
      }
    ],
    south: [
      {
        id: 'south-gate',
        position: { x: 480, y: 516 },
        outside: { x: 480, y: 576 },
        width: 56,
        pathWidth: 52,
        kind: 'gate',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['market-crawl'],
        priority: 1
      },
      {
        id: 'south-cellar',
        position: { x: 520, y: 492 },
        outside: { x: 520, y: 560 },
        width: 28,
        pathWidth: 30,
        kind: 'cellar',
        tags: ['alternate', 'stealth'],
        bypassRoutes: ['market-crawl'],
        priority: 3
      }
    ],
    east: [
      {
        id: 'east-arch',
        position: { x: 796, y: 290 },
        outside: { x: 860, y: 290 },
        width: 58,
        pathWidth: 52,
        kind: 'archway',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['lakeside-sneak', 'sky-thread'],
        priority: 1
      },
      {
        id: 'east-balcony',
        position: { x: 620, y: 190 },
        outside: { x: 680, y: 150 },
        width: 30,
        pathWidth: 30,
        kind: 'balcony',
        tags: ['alternate', 'rooftop'],
        bypassRoutes: ['sky-thread'],
        priority: 3
      }
    ],
    west: [
      {
        id: 'west-arch',
        position: { x: 164, y: 290 },
        outside: { x: 104, y: 290 },
        width: 58,
        pathWidth: 52,
        kind: 'archway',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['backlot-run', 'cellar-circuit'],
        priority: 1
      },
      {
        id: 'west-cellar',
        position: { x: 220, y: 492 },
        outside: { x: 160, y: 520 },
        width: 30,
        pathWidth: 30,
        kind: 'cellar',
        tags: ['alternate', 'stealth'],
        bypassRoutes: ['cellar-circuit'],
        priority: 2
      }
    ]
  },
  traversalRoutes: [
    {
      id: 'trade-cross',
      label: 'Trade Road Crossing',
      type: 'primary',
      risk: 'high',
      connectors: ['west-arch', 'east-arch'],
      tags: ['guarded', 'open'],
      nodes: [
        { x: 164, y: 290 },
        { x: 360, y: 290 },
        { x: 620, y: 290 },
        { x: 796, y: 290 }
      ]
    },
    {
      id: 'north-south-run',
      label: 'Merchant Spine',
      type: 'primary',
      risk: 'high',
      connectors: ['north-gate', 'south-gate'],
      tags: ['guarded', 'direct'],
      nodes: [
        { x: 480, y: 84 },
        { x: 480, y: 210 },
        { x: 480, y: 360 },
        { x: 480, y: 516 }
      ]
    },
    {
      id: 'backlot-run',
      label: 'Backlot Service Alley',
      type: 'alternate',
      risk: 'medium',
      connectors: ['west-arch', 'south-gate'],
      tags: ['alley', 'stealth'],
      nodes: [
        { x: 164, y: 290 },
        { x: 260, y: 360 },
        { x: 360, y: 420 },
        { x: 480, y: 516 }
      ]
    },
    {
      id: 'cellar-circuit',
      label: 'Cellar Circuit',
      type: 'alternate',
      risk: 'low',
      connectors: ['west-cellar', 'south-cellar'],
      tags: ['underground', 'stealth'],
      nodes: [
        { x: 220, y: 492 },
        { x: 320, y: 500 },
        { x: 520, y: 492 }
      ]
    },
    {
      id: 'sky-thread',
      label: 'Skyline Rope Run',
      type: 'alternate',
      risk: 'medium',
      connectors: ['north-balcony', 'east-balcony'],
      tags: ['rooftop', 'parkour'],
      nodes: [
        { x: 420, y: 180 },
        { x: 500, y: 170 },
        { x: 620, y: 190 }
      ]
    },
    {
      id: 'lakeside-sneak',
      label: 'Lakeside Sneak',
      type: 'alternate',
      risk: 'medium',
      connectors: ['north-gate', 'east-arch'],
      tags: ['stealth', 'water'],
      nodes: [
        { x: 480, y: 84 },
        { x: 560, y: 140 },
        { x: 796, y: 290 }
      ]
    },
    {
      id: 'market-crawl',
      label: 'Crowded Market Crawl',
      type: 'alternate',
      risk: 'low',
      connectors: ['north-gate', 'south-cellar'],
      tags: ['crowd', 'stealth'],
      nodes: [
        { x: 480, y: 84 },
        { x: 420, y: 240 },
        { x: 360, y: 360 },
        { x: 520, y: 492 }
      ]
    }
  ],
  safeZones: [
    { id: 'bazaar', label: 'Bazaar Crowd', rect: { x: 320, y: 360, w: 220, h: 140 }, tags: ['crowd', 'cover'] },
    { id: 'well-plaza', label: 'Well Plaza', rect: { x: 520, y: 220, w: 160, h: 120 }, tags: ['gathering', 'safe'] }
  ],
  tensionZones: [
    { id: 'customs', label: 'Customs Post', rect: { x: 440, y: 80, w: 120, h: 160 }, tags: ['inspection', 'chokepoint'] },
    { id: 'archer-nest', label: 'Archer Nest', rect: { x: 720, y: 160, w: 140, h: 120 }, tags: ['vantage', 'threat'] }
  ],
  coverPoints: [
    { id: 'stall-row', x: 360, y: 380, label: 'Stall Row', tags: ['cover'] },
    { id: 'wagon-ring', x: 520, y: 420, label: 'Wagon Ring', tags: ['cover'] }
  ],
  vantagePoints: [
    { id: 'guild-balcony', x: 620, y: 190, label: 'Guild Balcony', tags: ['vantage'] },
    { id: 'inn-roof', x: 220, y: 200, label: 'Inn Rooftop', tags: ['lookout'] }
  ],
  chokepoints: [
    { id: 'north-gate', position: { x: 480, y: 84 }, width: 56, bypassRoutes: ['market-crawl', 'lakeside-sneak'] },
    { id: 'east-arch', position: { x: 796, y: 290 }, width: 58, bypassRoutes: ['sky-thread', 'backlot-run'] }
  ],
  patrols: [
    {
      id: 'gate-wardens',
      type: 'scout',
      route: [
        { x: 440, y: 140 },
        { x: 520, y: 140 },
        { x: 520, y: 220 },
        { x: 440, y: 220 }
      ],
      spawn: { x: 440, y: 140 },
      tags: ['gate']
    },
    {
      id: 'archer-overwatch',
      type: 'scout',
      route: [
        { x: 680, y: 180 },
        { x: 740, y: 220 },
        { x: 700, y: 260 },
        { x: 640, y: 220 }
      ],
      spawn: { x: 680, y: 180 },
      tags: ['vantage']
    },
    {
      id: 'bazaar-keepers',
      type: 'villager',
      route: [
        { x: 360, y: 400 },
        { x: 420, y: 440 },
        { x: 520, y: 420 },
        { x: 440, y: 360 }
      ],
      spawn: { x: 420, y: 440 },
      tags: ['civilian']
    }
  ]
};

const riversideSanctum = {
  id: 'riverside-sanctum',
  label: 'Riverside Sanctum',
  description: 'Pilgrim sanctum straddling a river ford with hidden boardwalks.',
  houses: [
    { id: 'abbot-hall', x: 140, y: 120, w: 150, h: 110, side: 'north', doorOffset: 0.48, jitter: { x: 36, y: 20, door: 0.12 } },
    { id: 'scribe-hut', x: 320, y: 110, w: 150, h: 100, side: 'north', doorOffset: 0.62, jitter: { x: 34, y: 18, door: 0.12 } },
    { id: 'watch', x: 560, y: 130, w: 150, h: 110, side: 'north', doorOffset: 0.42, jitter: { x: 30, y: 18, door: 0.12 } },
    { id: 'barracks', x: 740, y: 126, w: 150, h: 118, side: 'north', doorOffset: 0.5, jitter: { x: 32, y: 20, door: 0.12 } },
    { id: 'boat-house', x: 160, y: 340, w: 150, h: 110, side: 'south', doorOffset: 0.36, jitter: { x: 32, y: 24, door: 0.14 } },
    { id: 'pilgrim-dorm', x: 380, y: 360, w: 160, h: 110, side: 'south', doorOffset: 0.52, jitter: { x: 34, y: 24, door: 0.16 } },
    { id: 'fisher-row', x: 620, y: 340, w: 170, h: 120, side: 'south', doorOffset: 0.58, jitter: { x: 34, y: 22, door: 0.16 } },
    { id: 'store', x: 460, y: 220, w: 140, h: 100, side: 'north', doorOffset: 0.5, jitter: { x: 28, y: 18, door: 0.12 } }
  ],
  roads: [
    {
      id: 'ford-road',
      rects: [{ x: 80, y: 260, w: 800, h: 52 }],
      tags: ['main', 'guarded'],
      connectors: ['west-ford', 'east-ford']
    },
    {
      id: 'boardwalk',
      rects: [{ x: 120, y: 420, w: 720, h: 32 }],
      tags: ['stealth', 'water'],
      connectors: ['west-dock', 'east-dock']
    },
    {
      id: 'cliff-path',
      rects: [{ x: 240, y: 160, w: 520, h: 28 }],
      tags: ['rooftop', 'vantage'],
      connectors: ['north-cliff', 'east-cliff']
    },
    {
      id: 'catacomb-trail',
      rects: [{ x: 320, y: 520, w: 360, h: 28 }],
      tags: ['underground', 'stealth'],
      connectors: ['south-crypt', 'west-crypt']
    }
  ],
  connectors: {
    west: [
      {
        id: 'west-ford',
        position: { x: 96, y: 286 },
        outside: { x: 36, y: 286 },
        width: 58,
        pathWidth: 52,
        kind: 'bridge',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['boardwalk-sneak', 'catacomb-slope'],
        priority: 1
      },
      {
        id: 'west-dock',
        position: { x: 120, y: 432 },
        outside: { x: 40, y: 452 },
        width: 36,
        pathWidth: 34,
        kind: 'dock',
        tags: ['alternate', 'water'],
        bypassRoutes: ['boardwalk-sneak'],
        priority: 2
      },
      {
        id: 'west-crypt',
        position: { x: 340, y: 534 },
        outside: { x: 280, y: 560 },
        width: 28,
        pathWidth: 30,
        kind: 'tunnel',
        tags: ['alternate', 'underground'],
        bypassRoutes: ['catacomb-slope'],
        priority: 3
      }
    ],
    east: [
      {
        id: 'east-ford',
        position: { x: 864, y: 286 },
        outside: { x: 924, y: 286 },
        width: 58,
        pathWidth: 52,
        kind: 'bridge',
        tags: ['primary', 'main', 'chokepoint'],
        bypassRoutes: ['boardwalk-sneak', 'cliff-glide'],
        priority: 1
      },
      {
        id: 'east-dock',
        position: { x: 840, y: 432 },
        outside: { x: 920, y: 452 },
        width: 36,
        pathWidth: 34,
        kind: 'dock',
        tags: ['alternate', 'water'],
        bypassRoutes: ['boardwalk-sneak'],
        priority: 2
      },
      {
        id: 'east-cliff',
        position: { x: 740, y: 170 },
        outside: { x: 800, y: 140 },
        width: 30,
        pathWidth: 30,
        kind: 'trail',
        tags: ['alternate', 'rooftop'],
        bypassRoutes: ['cliff-glide'],
        priority: 3
      }
    ],
    north: [
      {
        id: 'north-cliff',
        position: { x: 320, y: 170 },
        outside: { x: 320, y: 120 },
        width: 32,
        pathWidth: 32,
        kind: 'trail',
        tags: ['alternate', 'vantage'],
        bypassRoutes: ['cliff-glide'],
        priority: 2
      },
      {
        id: 'north-steps',
        position: { x: 520, y: 140 },
        outside: { x: 520, y: 80 },
        width: 44,
        pathWidth: 40,
        kind: 'steps',
        tags: ['secondary', 'main'],
        bypassRoutes: ['ford-charge', 'cliff-glide'],
        priority: 2
      }
    ],
    south: [
      {
        id: 'south-quay',
        position: { x: 520, y: 480 },
        outside: { x: 520, y: 540 },
        width: 44,
        pathWidth: 40,
        kind: 'dock',
        tags: ['secondary', 'main'],
        bypassRoutes: ['boardwalk-sneak'],
        priority: 2
      },
      {
        id: 'south-crypt',
        position: { x: 520, y: 532 },
        outside: { x: 520, y: 600 },
        width: 30,
        pathWidth: 30,
        kind: 'crypt',
        tags: ['alternate', 'underground'],
        bypassRoutes: ['catacomb-slope'],
        priority: 3
      }
    ]
  },
  traversalRoutes: [
    {
      id: 'ford-charge',
      label: 'Ford Charge',
      type: 'primary',
      risk: 'high',
      connectors: ['west-ford', 'east-ford'],
      tags: ['guarded', 'direct'],
      nodes: [
        { x: 96, y: 286 },
        { x: 360, y: 280 },
        { x: 620, y: 280 },
        { x: 864, y: 286 }
      ]
    },
    {
      id: 'boardwalk-sneak',
      label: 'Boardwalk Sneak',
      type: 'alternate',
      risk: 'low',
      connectors: ['west-dock', 'east-dock'],
      tags: ['water', 'stealth'],
      nodes: [
        { x: 120, y: 432 },
        { x: 320, y: 432 },
        { x: 620, y: 432 },
        { x: 840, y: 432 }
      ]
    },
    {
      id: 'cliff-glide',
      label: 'Cliff Glide',
      type: 'alternate',
      risk: 'medium',
      connectors: ['north-cliff', 'east-cliff'],
      tags: ['rooftop', 'vantage'],
      nodes: [
        { x: 320, y: 170 },
        { x: 480, y: 150 },
        { x: 740, y: 170 }
      ]
    },
    {
      id: 'catacomb-slope',
      label: 'Catacomb Slope',
      type: 'alternate',
      risk: 'medium',
      connectors: ['west-crypt', 'south-crypt'],
      tags: ['underground', 'stealth'],
      nodes: [
        { x: 340, y: 534 },
        { x: 440, y: 540 },
        { x: 520, y: 532 }
      ]
    },
    {
      id: 'ford-to-quay',
      label: 'Ford to Quay Loop',
      type: 'alternate',
      risk: 'medium',
      connectors: ['west-ford', 'south-quay'],
      tags: ['mixed', 'alternate'],
      nodes: [
        { x: 96, y: 286 },
        { x: 320, y: 340 },
        { x: 520, y: 480 }
      ]
    }
  ],
  safeZones: [
    { id: 'sanctum-courtyard', label: 'Sanctum Courtyard', rect: { x: 360, y: 360, w: 220, h: 140 }, tags: ['quiet', 'cover'] },
    { id: 'dockside-shelter', label: 'Dockside Shelter', rect: { x: 200, y: 420, w: 160, h: 100 }, tags: ['cover', 'concealment'] }
  ],
  tensionZones: [
    { id: 'ford-watch', label: 'Ford Watch', rect: { x: 80, y: 240, w: 200, h: 120 }, tags: ['chokepoint', 'guards'] },
    { id: 'cliff-lookout', label: 'Cliff Lookout', rect: { x: 600, y: 140, w: 180, h: 120 }, tags: ['sniper', 'vantage'] }
  ],
  coverPoints: [
    { id: 'boat-stack', x: 200, y: 420, label: 'Boats & Tarps', tags: ['cover'] },
    { id: 'storage-crates', x: 540, y: 460, label: 'Storage Crates', tags: ['cover'] }
  ],
  vantagePoints: [
    { id: 'bell-tower', x: 520, y: 140, label: 'Bell Tower', tags: ['vantage'] },
    { id: 'cliff-perch', x: 740, y: 170, label: 'Cliff Perch', tags: ['overwatch'] }
  ],
  chokepoints: [
    { id: 'west-ford', position: { x: 96, y: 286 }, width: 58, bypassRoutes: ['boardwalk-sneak', 'catacomb-slope'] },
    { id: 'east-ford', position: { x: 864, y: 286 }, width: 58, bypassRoutes: ['boardwalk-sneak', 'cliff-glide'] }
  ],
  patrols: [
    {
      id: 'ford-guard',
      type: 'scout',
      route: [
        { x: 140, y: 260 },
        { x: 220, y: 240 },
        { x: 220, y: 300 },
        { x: 140, y: 300 }
      ],
      spawn: { x: 140, y: 260 },
      tags: ['chokepoint']
    },
    {
      id: 'dock-watch',
      type: 'scout',
      route: [
        { x: 640, y: 420 },
        { x: 720, y: 420 },
        { x: 720, y: 460 },
        { x: 640, y: 460 }
      ],
      spawn: { x: 640, y: 420 },
      tags: ['water']
    },
    {
      id: 'pilgrim-walk',
      type: 'villager',
      route: [
        { x: 360, y: 380 },
        { x: 420, y: 420 },
        { x: 520, y: 360 },
        { x: 440, y: 340 }
      ],
      spawn: { x: 420, y: 420 },
      tags: ['civilian']
    }
  ]
};

export const VILLAGE_TEMPLATES = [
  fortifiedOutpost,
  crossroadsMarket,
  riversideSanctum
];
