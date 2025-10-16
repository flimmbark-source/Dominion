import { VILLAGES, WALL, WORLD } from '../data/world.js';
import { TAVERN_INTERIOR, getTavernDoorRect } from './tavern.js';
import { createPlayerStats } from './playerStats.js';
import { W, H } from '../game/canvas.js';

const mainVillage = VILLAGES[0];

const playerStats = createPlayerStats();
const playerSpawn = {
  x: mainVillage.x + 180,
  y: mainVillage.y + 460
};

const tavern = {
  x: 5120,
  y: 4760,
  w: 220,
  h: 200,
  clearRadius: 56,
  glowRadius: 56,
  stump: { cx: 5230, cy: 4860, radius: 46 }
};

const tavernDoor = getTavernDoorRect(tavern);
const tavernReturnPoint = tavernDoor
  ? { x: tavernDoor.x + tavernDoor.w / 2, y: tavernDoor.y + tavernDoor.h / 2 }
  : { x: tavern.x + tavern.w / 2, y: tavern.y + tavern.h / 2 };

const initialTavernSpawn = { ...TAVERN_INTERIOR.spawn };

const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

function resolveDeveloperTools(){
  let toolsEnabled = false;
  let showFov = false;

  const search = (() => {
    if (!globalScope || !globalScope.location) return '';
    const value = globalScope.location.search;
    return typeof value === 'string' ? value : '';
  })();

  if (search){
    try {
      const params = new URLSearchParams(search);
      if (params.has('devtools')){
        const val = params.get('devtools');
        toolsEnabled = val === null || val === '' || val === '1' || val === 'true';
      } else if (params.has('developer')){
        const val = params.get('developer');
        toolsEnabled = val === null || val === '' || val === '1' || val === 'true';
      } else if (params.has('debug')){
        const val = params.get('debug');
        toolsEnabled = val === '1' || val === 'true' || val === 'fov';
      }
    } catch (err) {
      toolsEnabled = false;
    }
  }

  if (!toolsEnabled && globalScope && typeof globalScope.DOMINION_DEVTOOLS !== 'undefined'){
    toolsEnabled = !!globalScope.DOMINION_DEVTOOLS;
  }

  if (globalScope && globalScope.localStorage){
    try {
      if (!toolsEnabled){
        const stored = globalScope.localStorage.getItem('dominion-devtools');
        if (stored === '1' || stored === 'true' || stored === 'enabled'){
          toolsEnabled = true;
        }
      }
      if (toolsEnabled){
        const persistedFov = globalScope.localStorage.getItem('dominion-devtools:showFov');
        if (persistedFov === '1' || persistedFov === 'true'){
          showFov = true;
        }
      }
    } catch (err) {
      // Ignore storage access issues in non-browser contexts.
    }
  }

  return { toolsEnabled, showFov };
}

const developerSettings = resolveDeveloperTools();

const state = {
  time: 0,
  pausedForShop: false,
  messages: [
    { text: 'You savor a goblin-brew alongside the tavern regulars.', expiresAt: 6 }
  ],
  camera: { x: 0, y: 0 },
  playerSpawn: { ...playerSpawn },
  player: {
    x: initialTavernSpawn.x, y: initialTavernSpawn.y, r: 10, facing: -Math.PI / 2,
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
  tavern,
  tavernInteriorState: { active: true, returnPoint: { ...tavernReturnPoint }, dialog: null },
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
  tavernPlayerInside: true,
  shopOwned: new Set(),
  mapMode: 'minimal',
  questLogOpen: false,
  questLogSelectedIndex: 0,
  questLogScroll: 0,
  trackedQuestId: null,
  villageTasks: [],
  pointsOfInterest: [],
  worldEventProps: [],
  worldEvents: [],
  proceduralQuests: [],
  quests: [],
  tavernMissionSites: null,
  tavernMissionRoster: [],
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
  villageMorale: 42,
  villagerTrust: 8,
  outpostStates: {},
  rumorFlags: {},
  houseFacadeCache: new Map(),
  safehouseAccess: {},
  villageEconomy: null,
  worldIntel: {},
  developer: {
    toolsEnabled: developerSettings.toolsEnabled,
    showFov: developerSettings.toolsEnabled && developerSettings.showFov
  }
};

export { state, mainVillage };
