import { VILLAGES, WALL, WORLD } from '../data/world.js';
import { TAVERN_INTERIOR } from './tavern.js';
import { createPlayerStats } from './playerStats.js';
import { W, H } from '../game/canvas.js';

const mainVillage = VILLAGES[0];

const playerStats = createPlayerStats();
const playerSpawn = {
  x: mainVillage.x + 180,
  y: mainVillage.y + 460
};

const state = {
  time: 0,
  pausedForShop: false,
  debugCones: true,
  messages: [],
  camera: { x: mainVillage.x + mainVillage.w/2 - W/2, y: mainVillage.y + mainVillage.h/2 - H/2 },
  playerSpawn: { ...playerSpawn },
  player: {
    x: playerSpawn.x, y: playerSpawn.y, r: 10, facing: 0,
    vx: 0, vy: 0, sprinting: false,
    gold: 0, health: playerStats.base.maxHealth,
    detection: 0,
    invisUntil: 0,
    attackSwing: null,
    nextAttackReady: 0,
    stats: playerStats,
    inventory: Array(6).fill(null),
    nextSprintNoiseTime: 0,
    nextThrowNoiseTime: 0,
    dead: false
  },
  houses: [],
  doors: [],
  houseSolids: [],
  chests: [],
  tavern: {
    x: 5120,
    y: 4760,
    w: 220,
    h: 200,
    clearRadius: 56,
    glowRadius: 56,
    stump: { cx: 5230, cy: 4860, radius: 46 }
  },
  tavernInteriorState: { active: false, returnPoint: null, dialog: null },
  tavernReentryBlockUntil: 0,
  npcs: [],
  villageInstances: [],
  castle: { x: WORLD.W - 320, y: 360 },
  threat: 0,
  threatSpawns: [50, 100, 160],
  threatGainBlockedUntil: 0,
  spawnCount: 0,
  interior: null,
  stairs: [],
  lastSeen: false,
  lastSeenAt: { x: mainVillage.x + mainVillage.w / 2, y: mainVillage.y + mainVillage.h / 2 },
  lastSeenTime: -Infinity,
  timeSinceSeen: 0,
  huntHeat: 0,
  nextSweeperSpawn: 0,
  tavernPlayerInside: false,
  shopOwned: new Set(),
  mapMode: 'minimal',
  questLogOpen: false,
  villageTasks: [],
  pointsOfInterest: [],
  worldEventProps: [],
  worldEvents: [],
  proceduralQuests: [],
  quests: [],
  tavernMissionSites: null,
  noiseEvents: [],
  alarmLevel: 0,
  alarmUntil: 0,
  activeTrapDisarm: null,
  villageDefense: [],
  darkStrategy: null,
  warLastMessageAt: 0,
  damageNumbers: [],
  deathSequence: null,
  questCues: [],
  questCueMemory: new Map(),
  villageSuspicion: 12,
  guardStrength: 40,
  guardAlertness: 28,
  mapVisibility: 0.38,
  darklordReinforcementDelay: 0,
  villagePopulationHealth: 0.9,
  outpostStates: {},
  rumorFlags: {}
};

export { state, mainVillage };
