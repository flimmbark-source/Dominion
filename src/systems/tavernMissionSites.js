import { state } from '../state/gameState.js';
import { VILLAGES } from '../data/world.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { addThreat } from './threat.js';
import {
  adjustVillageMorale,
  adjustVillagerTrust,
  delayDarklordReinforcements,
  setOutpostState,
  grantSafehouseAccess,
  adjustGuardAlertness,
  adjustPopulationHealth,
  setRumorFlag,
  markVillageEconomyDamaged,
  pauseProductionNode,
  scheduleGuardStrengthReduction,
  enqueueRevengeMissionSeed
} from './worldState.js';
import { getVillageInstance } from '../world/villageTemplates.js';

const DARK_OUTPOST_PRESETS = [
  { id: 'moonfen-stockade', label: 'Moonfen Stockade Yard', villageIndex: 0, offset: { x: 420, y: 260 }, radius: 220 },
  { id: 'brackenreach-holding', label: 'Brackenreach Holding Pens', villageIndex: 1, offset: { x: -280, y: 280 }, radius: 210 },
  { id: 'duskhaven-pens', label: 'Duskhaven Cage Grounds', villageIndex: 2, offset: { x: 320, y: -200 }, radius: 214 }
];

let lastCaptiveOutpost = null;

function getWellPlazaAnchor(){
  const instance = getVillageInstance(1);
  const zone = instance?.safeZones?.find(entry => entry.id === 'well-plaza');
  if (zone?.center){
    const rect = zone.rect || {};
    const baseRadius = Math.max(rect.w ?? 0, rect.h ?? 0, zone.radius ?? 0, 140);
    const cx = zone.center.x;
    const cy = zone.center.y;
    return {
      x: cx,
      y: cy,
      center: { x: cx, y: cy },
      radius: Math.max(110, baseRadius * 0.6),
      label: zone.label || 'Well Plaza',
      rect
    };
  }
  const fallback = VILLAGES[1] || { x: 0, y: 0, w: 260, h: 260 };
  return {
    x: fallback.x + fallback.w / 2,
    y: fallback.y + fallback.h / 2,
    center: {
      x: fallback.x + fallback.w / 2,
      y: fallback.y + fallback.h / 2
    },
    radius: Math.max(fallback.w, fallback.h) * 0.28,
    label: 'Well Plaza',
    rect: null
  };
}

function applyWellPoisoningStatus(zone){
  if (!zone) return;
  const effectRadius = (zone.radius ?? 140) + 220;
  for (const npc of state.npcs){
    if (!npc) continue;
    const type = npc.type;
    const guardLike = type === 'scout' || type === 'militia';
    const villager = type === 'villager';
    if (!guardLike && !villager) continue;
    const dx = (npc.x ?? 0) - zone.x;
    const dy = (npc.y ?? 0) - zone.y;
    const dist = Math.hypot(dx, dy);
    if (dist > effectRadius) continue;
    npc.statusFlags = npc.statusFlags || {};
    if (npc.statusFlags.wellPoisoned) continue;
    npc.statusFlags.wellPoisoned = { appliedAt: state.time, zoneId: 'well-plaza' };
    if (typeof npc.baseSpeed === 'number'){
      npc.baseSpeed *= guardLike ? 0.84 : 0.88;
      npc.speed = npc.baseSpeed;
    }
    if (guardLike){
      if (typeof npc.baseFovRange === 'number'){
        npc.baseFovRange *= 0.88;
        npc.fovRange = npc.baseFovRange;
      }
      if (typeof npc.hearingRadius === 'number'){
        npc.hearingRadius = Math.max(80, npc.hearingRadius * 0.82);
      }
    }
  }
}

function getForgeAnchor(){
  const instance = getVillageInstance(0);
  const placed = instance?.placedHouses || [];
  const target = placed.find(entry => entry?.spec?.id === 'armory')
    || placed.find(entry => entry?.spec?.id === 'smithy')
    || null;
  if (target){
    const { spec, placement } = target;
    const rect = { x: placement.x, y: placement.y, w: spec.w, h: spec.h };
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const doorW = 22;
    const offset = clamp(placement.doorOffset ?? spec.doorOffset ?? 0.5, 0.05, 0.95);
    const doorX = rect.x + Math.round((rect.w - doorW) * offset);
    const doorY = spec.side === 'north' ? rect.y + rect.h : rect.y;
    const doorCenter = doorX + doorW / 2;
    const outward = spec.side === 'north' ? 26 : -26;
    const yard = { x: doorCenter, y: doorY + outward };
    return {
      x: cx,
      y: cy,
      radius: Math.max(120, Math.max(rect.w, rect.h) * 0.72),
      label: spec.id === 'smithy' ? 'Moonfen Forge' : 'Moonfen Armory Forge',
      rect,
      door: { x: doorX, y: doorY, w: doorW, facing: spec.side, center: { x: doorCenter, y: doorY } },
      yard
    };
  }
  const fallback = VILLAGES[0] || { x: 0, y: 0, w: 260, h: 260 };
  return {
    x: fallback.x + fallback.w * 0.58,
    y: fallback.y + fallback.h * 0.36,
    radius: Math.max(110, Math.max(fallback.w, fallback.h) * 0.22),
    label: 'Moonfen Forge',
    rect: null,
    door: null,
    yard: null
  };
}

function sampleAmbientLight(x, y){
  const time = state.time ?? 0;
  const guardFactor = clamp((state.guardAlertness ?? 28) / 100, 0, 1);
  const cycle = Math.sin(time * 0.06 + (x + y) * 0.0013);
  const mist = Math.cos(time * 0.03 + x * 0.0021);
  const base = 0.55 + 0.22 * cycle + 0.1 * mist;
  return clamp(base + guardFactor * 0.18, 0.05, 1);
}

function getLocalLightLevel(anchor, mission){
  if (!anchor) return 1;
  const base = sampleAmbientLight(anchor.x, anchor.y);
  const modifier = mission?.data?.lightModifier ?? 0;
  return clamp(base + modifier, 0, 1);
}

function formatLightPercent(value){
  if (value == null) return null;
  return `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function resolveOutpostPreset(preset){
  const village = VILLAGES[preset.villageIndex] || { x: 0, y: 0, w: 0, h: 0 };
  return {
    id: preset.id,
    label: preset.label,
    x: village.x + (preset.offset?.x ?? 0),
    y: village.y + (preset.offset?.y ?? 0),
    radius: preset.radius ?? 200
  };
}

function listKnownOutposts(){
  const outposts = [];
  if (state.outpostStates && typeof state.outpostStates === 'object'){
    for (const [id, data] of Object.entries(state.outpostStates)){
      if (!data) continue;
      const location = data.location || {};
      const x = Number.isFinite(data.x) ? data.x : Number.isFinite(location.x) ? location.x : null;
      const y = Number.isFinite(data.y) ? data.y : Number.isFinite(location.y) ? location.y : null;
      if (x == null || y == null) continue;
      outposts.push({
        id,
        label: data.label || data.name || 'Dark Outpost',
        x,
        y,
        radius: data.radius ?? location.radius ?? 200,
        weakened: data.weakened || data.status === 'panic'
      });
    }
  }
  if (outposts.length === 0){
    DARK_OUTPOST_PRESETS.forEach(preset => outposts.push(resolveOutpostPreset(preset)));
  }
  return outposts;
}

function selectCaptiveOutpost(){
  if (lastCaptiveOutpost) return lastCaptiveOutpost;
  const outposts = listKnownOutposts();
  if (outposts.length === 0){
    lastCaptiveOutpost = {
      id: 'shadow-stockade',
      label: 'Shadow Stockade',
      x: 6200,
      y: 2800,
      radius: 220
    };
    return lastCaptiveOutpost;
  }
  const candidates = outposts.filter(outpost => !outpost.weakened);
  lastCaptiveOutpost = (candidates[0] || outposts[0]);
  return lastCaptiveOutpost;
}

function buildCaptiveCages(outpost){
  const offsets = [
    { id: 'north-cage', label: 'Northern Cage Row', dx: -84, dy: -62 },
    { id: 'center-cage', label: 'Center Cage Cluster', dx: 16, dy: 18 },
    { id: 'south-cage', label: 'Southern Cage Row', dx: 94, dy: 92 }
  ];
  return offsets.map((offset, index) => ({
    id: offset.id,
    label: offset.label,
    x: outpost.x + offset.dx,
    y: outpost.y + offset.dy,
    radius: Math.max(76, (outpost.radius ?? 200) * 0.34),
    freed: false,
    index
  }));
}

function getNoiseLevelAtPoint(x, y, radius){
  let level = state.alarmLevel > 0 ? 0.6 + state.alarmLevel * 0.4 : 0;
  for (const event of state.noiseEvents){
    const dist = Math.hypot((event.x ?? 0) - x, (event.y ?? 0) - y);
    const reach = (event.radius ?? 0) + radius;
    if (reach <= 0) continue;
    if (dist > reach) continue;
    const weight = 1 - Math.min(1, dist / Math.max(reach, 1));
    level += weight;
  }
  return level;
}

function getOutpostNoiseLevel(outpost){
  const radius = (outpost?.radius ?? 200) + 120;
  return getNoiseLevelAtPoint(outpost?.x ?? 0, outpost?.y ?? 0, radius);
}

function getCaptiveMissionNoiseLevel(mission, anchor, step){
  const outpost = mission.data?.targetOutpost;
  if (outpost){
    return getOutpostNoiseLevel(outpost);
  }
  const radius = step?.noiseRadius ?? step?.radius ?? mission.location?.radius ?? 140;
  return getNoiseLevelAtPoint(anchor?.x ?? 0, anchor?.y ?? 0, radius);
}

const SIGNAL_STEPS = [
  {
    id: 'ground-sentry',
    label: 'Drop the ground sentry',
    anchorOffset: { x: -56, y: 132 },
    radius: 88,
    duration: 2.6,
    maxDetection: 60,
    startText: 'You ghost along the tower base, knife ready.',
    hintText: 'Press E to silently remove the ground sentry.',
    cancelText: 'You lose your angle on the ground sentry.',
    completeText: 'The ground sentry collapses without a sound.',
    onComplete(){
      state.player.detection = clamp((state.player?.detection ?? 0) - 12, 0, 100);
      addThreat(-6);
    }
  },
  {
    id: 'mid-sentry',
    label: 'Slip past the mid landing',
    anchorOffset: { x: 12, y: 54 },
    radius: 82,
    duration: 2.8,
    maxDetection: 58,
    startText: 'You climb the slick ladder, stalking the next lookout.',
    hintText: 'Press E to choke out the mid-landing lookout.',
    cancelText: 'The lookout shifts—your moment passes.',
    completeText: 'The lookout slumps and you ease them to the planks.',
    onComplete(){
      state.player.detection = clamp((state.player?.detection ?? 0) - 10, 0, 100);
      addThreat(-6);
    }
  },
  {
    id: 'top-sentry',
    label: 'Neutralize the torch warden',
    anchorOffset: { x: 34, y: -18 },
    radius: 78,
    duration: 2.8,
    maxDetection: 56,
    startText: 'You peek above the final railing, breath held.',
    hintText: 'Press E to silence the torch warden.',
    cancelText: 'The warden glances back—wait for another lull.',
    completeText: 'The warden wheezes once, then stills.',
    onComplete(){
      state.player.detection = clamp((state.player?.detection ?? 0) - 10, 0, 100);
      addThreat(-6);
    }
  },
  {
    id: 'douse-beacon',
    label: 'Douse the beacon fire',
    anchorOffset: { x: -6, y: -96 },
    radius: 92,
    duration: 3.4,
    maxDetection: 55,
    startText: 'You scatter moon-damp sand across the coals.',
    hintText: 'Press E to smother the beacon.',
    cancelText: 'A gust blows sparks—wait for cover.',
    completeText: 'The beacon sputters out, smoke mingling with the fog.',
    onComplete(){
      addThreat(-12);
    }
  }
];

const SUPPLY_STEPS = [
  {
    id: 'slip-in',
    label: 'Slip into the camp',
    anchorOffset: { x: -148, y: 92 },
    radius: 104,
    duration: 2.8,
    maxDetection: 65,
    startText: 'You hug the supply wagon shadows, easing past the sentry.',
    hintText: 'Press E to infiltrate the supply camp.',
    cancelText: 'Bootsteps crunch too close—you duck back out.',
    completeText: 'You disappear among the canvas and crates.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.infiltrated = true;
      state.player.detection = clamp((state.player?.detection ?? 0) - 8, 0, 100);
    }
  },
  {
    id: 'poison-stew',
    label: 'Poison the stew cauldron',
    anchorOffset: { x: 28, y: 36 },
    radius: 96,
    duration: 3.2,
    maxDetection: 55,
    startText: 'You uncork a vial and drizzle it into the bubbling stew.',
    hintText: 'Press E to lace the stew.',
    cancelText: 'A guard coughs nearby—you pocket the vial for now.',
    completeText: 'The stew darkens—no soldier will stomach it.',
    onComplete(){
      addThreat(-8);
    }
  },
  {
    id: 'poison-water',
    label: 'Taint the water barrels',
    anchorOffset: { x: 126, y: -26 },
    radius: 98,
    duration: 3.1,
    maxDetection: 55,
    startText: 'You pry a lid and pour moonrot into the water.',
    hintText: 'Press E to poison the barrels.',
    cancelText: 'Too much lantern light—hold the toxin for a breath.',
    completeText: 'The water reeks of swamp rot and bile.',
    onComplete(){
      addThreat(-6);
    }
  }
];

const POISON_WELL_STEPS = [
  {
    id: 'survey-plaza',
    label: 'Shadow the well plaza',
    anchor(mission){
      const zone = mission.data?.plazaZone;
      if (!zone) return null;
      return {
        x: zone.x,
        y: zone.y - (zone.radius ?? 120) * 0.18,
        radius: Math.max(100, (zone.radius ?? 120) * 0.8),
        label: 'Well Plaza Overwatch'
      };
    },
    radius: 118,
    duration: 2.6,
    maxDetection: 60,
    requireLoad: 'light',
    setLoad: 'heavy',
    startText: 'You melt into the plaza bustle, counting militia sips at the well.',
    hintText: 'Press E to map rotations around the well.',
    cancelText: 'A glance lingers—wait until the crowd shields you.',
    completeText: 'The patrol pattern is etched in your mind; toxins ready in your pack.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.plazaScouted = true;
      state.player.detection = clamp((state.player?.detection ?? 0) - 6, 0, 100);
    }
  },
  {
    id: 'dose-guard-casks',
    label: 'Spike the guard casks',
    anchor(mission){
      const zone = mission.data?.plazaZone;
      if (!zone) return null;
      const shiftX = (zone.radius ?? 120) * -0.32;
      const shiftY = (zone.radius ?? 120) * -0.18;
      return {
        x: zone.x + shiftX,
        y: zone.y + shiftY,
        radius: Math.max(86, (zone.radius ?? 120) * 0.55),
        label: 'Militia Water Casks'
      };
    },
    radius: 94,
    duration: 3.1,
    maxDetection: 52,
    requireLoad: 'heavy',
    setLoad: 'light',
    startText: 'You heft the toxin satchel, slipping it over the militia casks.',
    hintText: 'Press E to tip the venom into their reserve.',
    cancelText: 'Bootsteps grow too close—you ease the satchel back down.',
    completeText: 'The guard casks froth quietly—first sip will sour their guts.',
    onComplete(){
      addThreat(-6);
    }
  },
  {
    id: 'taint-buckets',
    label: 'Taint the villagers’ buckets',
    anchor(mission){
      const zone = mission.data?.plazaZone;
      if (!zone) return null;
      const shiftX = (zone.radius ?? 120) * 0.34;
      const shiftY = (zone.radius ?? 120) * 0.16;
      return {
        x: zone.x + shiftX,
        y: zone.y + shiftY,
        radius: Math.max(88, (zone.radius ?? 120) * 0.52),
        label: 'Bucket Queue'
      };
    },
    radius: 96,
    duration: 3,
    maxDetection: 50,
    requireLoad: 'light',
    setLoad: 'heavy',
    startText: 'You trade smiles with villagers while drizzling rot into their pails.',
    hintText: 'Press E to lace the waiting buckets.',
    cancelText: 'A child watches too closely—you pause, feigning patience.',
    completeText: 'A sheen spreads across the water as the toxin blooms.',
    onComplete(){
      state.player.detection = clamp((state.player?.detection ?? 0) - 4, 0, 100);
    }
  },
  {
    id: 'seed-ladle',
    label: 'Seed the communal ladle',
    anchor(mission){
      const zone = mission.data?.plazaZone;
      if (!zone) return null;
      return {
        x: zone.x,
        y: zone.y,
        radius: Math.max(82, (zone.radius ?? 120) * 0.48),
        label: 'Well Rim'
      };
    },
    radius: 90,
    duration: 3.3,
    maxDetection: 48,
    requireLoad: 'heavy',
    setLoad: 'light',
    startText: 'You steady the dripping ladle, coating its handle in blackrot.',
    hintText: 'Press E to finish seeding the ladle.',
    cancelText: 'A militiaman clears his throat beside you—you hide the vial.',
    completeText: 'The ladle gleams slick with toxin—the plaza is doomed to drink.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.ladleSeeded = true;
    }
  }
];

const FREE_CAPTIVES_STEPS = [
  {
    id: 'survey-yard',
    label: 'Survey the cage yard',
    anchor(mission){
      const outpost = mission.data?.targetOutpost;
      if (!outpost) return null;
      return {
        x: outpost.x - (outpost.radius ?? 200) * 0.38,
        y: outpost.y - (outpost.radius ?? 200) * 0.22,
        radius: Math.max(120, (outpost.radius ?? 200) * 0.62),
        label: 'Cage yard overlook'
      };
    },
    radius: 150,
    duration: 3.2,
    maxDetection: 52,
    maxNoise: 1.4,
    startText: 'You melt into the shadows above the cage yard, mapping patrol rotations.',
    hintText: 'Press E to study the yard and mark guard routes.',
    cancelText: 'A torchlight sweep forces you to duck out of sight.',
    completeText: 'You memorize guard paths and signal the captives to be ready.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.cagesMarked = true;
      mission.data.cagesFreed = mission.data.cagesFreed || 0;
    }
  },
  {
    id: 'unlock-north-cage',
    label: 'Free the northern cage',
    anchor(mission){
      return mission.data?.cages?.[0] || null;
    },
    radius: 90,
    duration: 2.8,
    maxDetection: 48,
    maxNoise: 1.1,
    startText: 'You slide toward the northern cage, tools ready.',
    hintText: 'Press E to pick the northern cage lock.',
    cancelText: 'Bootsteps drum nearby—you fade back into the dark.',
    completeText: 'The northern cage clicks open and the prisoners slip free.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.cages = mission.data.cages || [];
      if (mission.data.cages[0]) mission.data.cages[0].freed = true;
      mission.data.cagesFreed = (mission.data.cagesFreed || 0) + 1;
      state.player.detection = clamp((state.player?.detection ?? 0) - 8, 0, 100);
    }
  },
  {
    id: 'unlock-center-cage',
    label: 'Free the center cage',
    anchor(mission){
      return mission.data?.cages?.[1] || null;
    },
    radius: 92,
    duration: 3,
    maxDetection: 46,
    maxNoise: 1,
    startText: 'You ghost through the cage row, eyeing the center lock.',
    hintText: 'Press E to lift the center cage bar.',
    cancelText: 'A guard lingers too close—you wait out the pass.',
    completeText: 'The center cage swings ajar and you usher families into the dark.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.cages = mission.data.cages || [];
      if (mission.data.cages[1]) mission.data.cages[1].freed = true;
      mission.data.cagesFreed = (mission.data.cagesFreed || 0) + 1;
      addThreat(-6);
    }
  },
  {
    id: 'unlock-south-cage',
    label: 'Free the southern cage',
    anchor(mission){
      return mission.data?.cages?.[2] || null;
    },
    radius: 94,
    duration: 3.1,
    maxDetection: 45,
    maxNoise: 0.9,
    startText: 'Only the southern cage remains—guards mutter nearby.',
    hintText: 'Press E to slip the last lock without a sound.',
    cancelText: 'Lantern light flares—you flatten against the cage wall.',
    completeText: 'The last cage opens—captives vanish into the treeline.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.cages = mission.data.cages || [];
      if (mission.data.cages[2]) mission.data.cages[2].freed = true;
      mission.data.cagesFreed = (mission.data.cagesFreed || 0) + 1;
      addThreat(-10);
    }
  }
];

function makeScoutData(){
  const moonfen = VILLAGES[0];
  const bracken = VILLAGES[1];
  const duskhaven = VILLAGES[2];
  const trailNodes = [
    {
      id: 'footprints',
      x: moonfen.x + moonfen.w / 2 + 220,
      y: moonfen.y + moonfen.h + 180,
      radius: 88,
      label: 'Footprints in the Moonfen mud',
      prompt: 'Fresh prints cut south along the marsh berm.'
    },
    {
      id: 'branch',
      x: duskhaven.x - 200,
      y: duskhaven.y + duskhaven.h / 2 + 120,
      radius: 84,
      label: 'Snapped branch along the ridge',
      prompt: 'A snapped branch points toward the eastern ridge.'
    }
  ];
  const path = [
    { x: moonfen.x + moonfen.w + 220, y: moonfen.y + 60, label: 'Moonfen Ridge', dwell: 3.6 },
    { x: duskhaven.x - 120, y: duskhaven.y + duskhaven.h / 2, label: 'Duskhaven Foothills', dwell: 4.4 },
    { x: bracken.x + bracken.w + 240, y: bracken.y + 160, label: 'Brackenreach Overlook', dwell: 3.8 },
    { x: moonfen.x + 120, y: moonfen.y + moonfen.h + 260, label: 'Southern Marsh Track', dwell: 3.4 }
  ];
  const first = path[0];
  return {
    trailNodes,
    scout: {
      path,
      segmentIndex: 1,
      x: first.x,
      y: first.y,
      label: first.label,
      dwell: first.dwell ?? 3,
      speed: 42
    }
  };
}

const SCOUT_STEPS = [
  {
    id: 'inspect-prints',
    label: 'Inspect the muddy prints',
    anchor(mission){
      return mission.data?.trailNodes?.[0] || null;
    },
    radius: 90,
    duration: 2.4,
    startText: 'You match strides in the mud, reading the scout\'s gait.',
    hintText: 'Press E to inspect the fresh footprints.',
    cancelText: 'Lantern light forces you to back away from the trail.',
    completeText: 'The prints angle toward a ridge path—follow them.',
    onComplete(mission){
      if (mission.data?.trailNodes?.[0]){
        mission.data.trailNodes[0].found = true;
      }
    }
  },
  {
    id: 'trace-branch',
    label: 'Follow the ridge clue',
    anchor(mission){
      return mission.data?.trailNodes?.[1] || null;
    },
    radius: 86,
    duration: 2.6,
    startText: 'You brush aside moss, spotting the scout\'s boot scrape.',
    hintText: 'Press E to read the ridge sign.',
    cancelText: 'Voices echo on the ridge—you fade back into the brush.',
    completeText: 'You map the scout\'s route toward the roaming patrols.',
    onComplete(mission){
      if (mission.data?.trailNodes?.[1]){
        mission.data.trailNodes[1].found = true;
      }
    }
  },
  {
    id: 'ambush',
    label: 'Silence the scout captain',
    anchor(mission){
      return mission.data?.scout || null;
    },
    radius: 104,
    duration: 2.8,
    maxDetection: 58,
    startText: 'You slip up behind the scout as he studies his map.',
    hintText: 'Press E when the scout lingers to strike.',
    cancelText: 'The scout stiffens—you melt back into the dark.',
    completeText: 'The scout collapses; you pocket his sketches.',
    onComplete(){
      addThreat(-14);
    }
  }
];

const missionSpecs = {
  'snuff-out-signal': {
    id: 'snuff-out-signal',
    label: 'Signal Watchtower',
    getLocation(){
      const castle = state.castle || { x: 7600, y: 360 };
      return {
        x: castle.x - 220,
        y: castle.y + 320,
        radius: 200,
        label: 'Signal Beacon Tower'
      };
    },
    steps: SIGNAL_STEPS,
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      if (state.darkStrategy){
        const suppression = Math.max(state.time + 90, state.darkStrategy.signalSuppressedUntil || 0);
        state.darkStrategy.signalSuppressedUntil = suppression;
        state.darkStrategy.muster = Math.max(0, (state.darkStrategy.muster ?? 0) - 4);
      }
      toast('Beacon darkened. The Dark Lord\'s raids will muster slower for a spell.', 3.2);
    },
    progress(mission){
      const total = SIGNAL_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      if (mission.completed) return 'Beacon silenced. Ledger signed.';
      if (mission.ready) return 'Beacon dark—return to the barkeep.';
      const step = SIGNAL_STEPS[mission.stageIndex];
      if (!step) return `${completed}/${total} steps complete.`;
      return `${completed}/${total} steps complete · Next: ${step.label}`;
    }
  },
  'mission_free_captives': {
    id: 'mission_free_captives',
    label: 'Dark Outpost Pens',
    getLocation(){
      const target = selectCaptiveOutpost();
      return {
        x: target.x,
        y: target.y,
        radius: target.radius ?? 210,
        label: target.label || 'Dark Outpost Pens'
      };
    },
    createData(){
      const target = selectCaptiveOutpost();
      return {
        targetOutpost: { ...target },
        cages: buildCaptiveCages(target),
        cagesFreed: 0,
        cagesMarked: false,
        noiseThreshold: 1.4,
        noiseLevel: 0,
        noiseCooldownUntil: 0,
        alerted: false,
        lastNoiseToast: -Infinity
      };
    },
    steps: FREE_CAPTIVES_STEPS,
    onActivate(mission){
      const target = selectCaptiveOutpost();
      mission.location = {
        x: target.x,
        y: target.y,
        radius: target.radius ?? mission.location?.radius ?? 210,
        label: target.label || 'Dark Outpost Pens'
      };
      mission.data = {
        targetOutpost: { ...target },
        cages: buildCaptiveCages(target),
        cagesFreed: 0,
        cagesMarked: false,
        noiseThreshold: 1.4,
        noiseLevel: 0,
        noiseCooldownUntil: 0,
        alerted: false,
        lastNoiseToast: -Infinity
      };
    },
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      const freed = mission.data?.cagesFreed ?? 3;
      const target = mission.data?.targetOutpost || selectCaptiveOutpost();
      adjustVillageMorale(6);
      adjustVillagerTrust(12);
      delayDarklordReinforcements(28);
      if (target?.id){
        setOutpostState(target.id, {
          id: target.id,
          label: target.label || 'Dark Outpost',
          x: target.x,
          y: target.y,
          radius: target.radius,
          status: 'panic',
          weakened: true,
          cagesFreed: freed,
          lastStrikeAt: state.time
        });
      }
      grantSafehouseAccess('moonfen-hideaway', {
        reason: 'freed-captives',
        outpostId: target?.id || 'unknown',
        trustedAt: state.time
      });
      toast('Captives freed. Morale surges while reinforcements stumble.', 3.6);
    },
    progress(mission){
      const total = mission.data?.cages?.length || 3;
      const freed = mission.data?.cagesFreed || 0;
      if (mission.completed) return 'Captives liberated and reward collected.';
      if (mission.ready) return `Captives freed (${freed}/${total}). Return to the barkeep.`;
      if (!mission.active) return `${freed}/${total} cages freed.`;
      const step = FREE_CAPTIVES_STEPS[mission.stageIndex];
      if (!step) return `${freed}/${total} cages freed.`;
      if (step.id !== 'survey-yard' && !mission.data?.cagesMarked){
        return 'Scout the cage yard before attempting rescues.';
      }
      return `${freed}/${total} cages freed · Next: ${step.label}`;
    }
  },
  'poison-supply-lines': {
    id: 'poison-supply-lines',
    label: 'Supply Caravan Camp',
    getLocation(){
      const castle = state.castle || { x: 7600, y: 360 };
      return {
        x: castle.x - 1180,
        y: castle.y + 1180,
        radius: 210,
        label: 'Supply Caravan Camp'
      };
    },
    steps: SUPPLY_STEPS,
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      if (state.darkStrategy){
        const penalty = state.darkStrategy.nextRaidPenalty || {};
        const sizeMultiplier = Math.min(penalty.sizeMultiplier ?? 1, 0.6);
        const morale = (penalty.morale ?? 0) + 8;
        state.darkStrategy.nextRaidPenalty = {
          sizeMultiplier,
          morale,
          appliedAt: state.time,
          expiresAt: state.time + 120
        };
      }
      toast('Supplies ruined. The next Dark raid will stagger in sickly.', 3.4);
    },
    progress(mission){
      const total = SUPPLY_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      if (mission.completed) return 'Stores ruined and payment collected.';
      if (mission.ready) return 'Camp fouled—collect your reward.';
      const step = SUPPLY_STEPS[mission.stageIndex];
      if (!step) return `${completed}/${total} steps complete.`;
      if (step.id === 'poison-stew' && !mission.data?.infiltrated){
        return 'Slip inside the camp before poisoning their stores.';
      }
      return `${completed}/${total} steps complete · Next: ${step.label}`;
    }
  },
  'mission_poison_well': {
    id: 'mission_poison_well',
    label: 'Brackenreach Well Plaza',
    getLocation(){
      const zone = getWellPlazaAnchor();
      return {
        x: zone.x,
        y: zone.y,
        radius: zone.radius,
        label: zone.label
      };
    },
    createData(){
      const zone = getWellPlazaAnchor();
      return {
        plazaZone: zone,
        stealthLoad: 'light',
        plazaScouted: false,
        ladleSeeded: false
      };
    },
    steps: POISON_WELL_STEPS,
    onActivate(mission){
      const zone = getWellPlazaAnchor();
      mission.location = {
        x: zone.x,
        y: zone.y,
        radius: zone.radius,
        label: zone.label
      };
      mission.data = {
        plazaZone: zone,
        stealthLoad: 'light',
        plazaScouted: false,
        ladleSeeded: false
      };
    },
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      const zone = mission.data?.plazaZone || getWellPlazaAnchor();
      applyWellPoisoningStatus(zone);
      adjustGuardAlertness(-12);
      adjustPopulationHealth(-0.22);
      setRumorFlag('plague_origin', {
        lines: [
          'Villagers gag that the well tastes of rusted coins and fever.',
          'Militia cough between rotations—the well water has gone wrong.'
        ],
        weight: 1.4,
        questId: 'mission_poison_well',
        status: 'completed'
      });
      toast('Well fouled. Guards grow sluggish and villagers whisper of plague.', 3.6);
    },
    progress(mission){
      const total = POISON_WELL_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      const load = mission.data?.stealthLoad === 'heavy' ? 'hauling toxins' : 'keeping light';
      if (mission.completed) return 'Well plaza poisoned and gold collected.';
      if (mission.ready) return 'The plaza drinks poison. Return for your reward.';
      const step = POISON_WELL_STEPS[mission.stageIndex];
      if (!step) return `${completed}/${total} steps complete.`;
      return `${completed}/${total} steps complete · Load: ${load} · Next: ${step.label}`;
    }
  },
  'mission_sabotage_forge': {
    id: 'mission_sabotage_forge',
    label: 'Moonfen Forge',
    getLocation(){
      const forge = getForgeAnchor();
      return {
        x: forge.x,
        y: forge.y,
        radius: forge.radius,
        label: forge.label
      };
    },
    createData(){
      const forge = getForgeAnchor();
      return {
        forgeAnchor: forge,
        stealthLoad: 'light',
        lightModifier: 0,
        lastLightSample: null,
        bellowsJammed: false,
        quenchSalted: false,
        productionSapped: false
      };
    },
    steps: FORGE_SABOTAGE_STEPS,
    onActivate(mission){
      const forge = getForgeAnchor();
      mission.location = {
        x: forge.x,
        y: forge.y,
        radius: forge.radius,
        label: forge.label
      };
      mission.data = {
        forgeAnchor: forge,
        stealthLoad: 'light',
        lightModifier: 0,
        lastLightSample: null,
        bellowsJammed: false,
        quenchSalted: false,
        productionSapped: false
      };
    },
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      const pauseDuration = 150;
      scheduleGuardStrengthReduction({ total: 14, duration: 140, initialDelay: 12, source: 'forge-sabotage' });
      markVillageEconomyDamaged({
        duration: 150,
        repairWindow: 210,
        hostileDuration: 180,
        productionNodeId: 'moonfen-forge',
        pauseDuration,
        reason: 'sabotaged-forge',
        cause: 'mission_sabotage_forge'
      });
      pauseProductionNode('moonfen-forge', {
        duration: pauseDuration,
        reason: 'sabotaged-forge',
        cause: 'mission_sabotage_forge'
      });
      enqueueRevengeMissionSeed('revenge_moonfen_forge', {
        templateId: 'revenge-strike',
        context: {
          target: 'moonfen-forge',
          triggeredAt: state.time,
          owner: 'blacksmith',
          sourceQuest: 'mission_sabotage_forge'
        },
        reward: { type: 'threat', amount: 10 }
      });
      addThreat(-12);
      toast('Forge silenced. Guard arms dwindle while the smith vows revenge.', 3.6);
    },
    progress(mission){
      const total = FORGE_SABOTAGE_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      const lightPercent = formatLightPercent(mission.data?.lastLightSample);
      if (mission.completed) return 'Forge crippled and payment collected.';
      if (mission.ready) return 'Forge production halted—collect your cut.';
      const step = FORGE_SABOTAGE_STEPS[mission.stageIndex];
      const lightInfo = lightPercent ? ` · Light ${lightPercent}` : '';
      if (!step) return `${completed}/${total} steps complete${lightInfo}.`;
      return `${completed}/${total} steps complete${lightInfo} · Next: ${step.label}`;
    }
  },
  'silence-the-scout': {
    id: 'silence-the-scout',
    label: 'Roaming Scout Captain',
    getLocation(){
      const moonfen = VILLAGES[0];
      return {
        x: moonfen.x + moonfen.w + 160,
        y: moonfen.y + moonfen.h + 200,
        radius: 220,
        label: 'Moonfen Trailhead'
      };
    },
    steps: SCOUT_STEPS,
    createData: makeScoutData,
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      if (state.darkStrategy){
        state.darkStrategy.musterGoal = Math.max(4, (state.darkStrategy.musterGoal ?? 4) - 1);
        state.darkStrategy.raidCooldown = Math.max(state.darkStrategy.raidCooldown ?? 12, 18);
        const intelUntil = Math.max(state.darkStrategy.scoutIntelUntil || 0, state.time + 120);
        state.darkStrategy.scoutIntelUntil = intelUntil;
      }
      addThreat(-18);
      toast('Scout silenced. Village defenses breathe easier.', 3.2);
    },
    onActivate(mission){
      mission.data = makeScoutData();
    },
    progress(mission){
      const total = SCOUT_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      if (mission.completed) return 'Scout eliminated. Intel delivered.';
      if (mission.ready) return 'The scout is down—turn in the maps.';
      const step = SCOUT_STEPS[mission.stageIndex];
      if (!step) return `${completed}/${total} steps complete.`;
      if (step.id === 'ambush'){
        const label = mission.data?.scout?.label || 'the ridge';
        return `Scout roaming near ${label}. Wait for your moment.`;
      }
      const node = step.anchor?.(mission);
      if (node?.label && !node.found){
        return `${completed}/${total} steps complete · Next clue: ${node.label}`;
      }
      return `${completed}/${total} steps complete.`;
    }
  }
};

const FORGE_SABOTAGE_STEPS = [
  {
    id: 'trace-torches',
    label: 'Trace the torch cadence',
    anchor(mission){
      const forge = mission.data?.forgeAnchor;
      if (forge?.yard){
        return {
          x: forge.yard.x,
          y: forge.yard.y,
          radius: Math.max(96, (forge.radius ?? 120) * 0.5),
          label: 'Forge Yard Shadow'
        };
      }
      if (forge){
        return {
          x: forge.x,
          y: forge.y + (forge.radius ?? 100) * 0.4,
          radius: forge.radius ?? 120,
          label: 'Forge Yard Shadow'
        };
      }
      return null;
    },
    radius: 110,
    duration: 2.6,
    maxDetection: 60,
    maxLight: 0.82,
    lightFailText: 'Torchlight floods the yard—wait for the glow to ebb.',
    startText: 'You hug the forge wall, breathing with the torch sweeps.',
    hintText: 'Press E once the torch cadence slows.',
    cancelText: 'The forge blaze flares—you slip back into shadow.',
    completeText: 'You memorize the torch rhythm and mark the safe angles.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.lightModifier = mission.data.lightModifier ?? 0;
      mission.data.lastLightSample = getLocalLightLevel(mission.data?.forgeAnchor || mission.location, mission);
      state.player.detection = clamp((state.player?.detection ?? 0) - 6, 0, 100);
    }
  },
  {
    id: 'jam-bellows',
    label: 'Jam the bellows catch',
    anchor(mission){
      const forge = mission.data?.forgeAnchor;
      if (forge?.rect){
        return {
          x: forge.rect.x + forge.rect.w * 0.32,
          y: forge.rect.y + forge.rect.h * 0.44,
          radius: Math.max(88, Math.max(forge.rect.w, forge.rect.h) * 0.32),
          label: 'Forge Bellows'
        };
      }
      return null;
    },
    radius: 96,
    duration: 3.1,
    maxDetection: 58,
    maxLight: 0.68,
    lightFailText: 'The blaze roars too bright—wait for the shadows before wedging the bellows.',
    startText: 'You slide a wooden wedge toward the bellows latch.',
    hintText: 'Press E when the light dips and the smith turns away.',
    cancelText: 'A spill of sparks forces you to withdraw your hand.',
    completeText: 'The bellows seize up, starving the coals of air.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.lightModifier = (mission.data.lightModifier ?? 0) - 0.18;
      mission.data.bellowsJammed = true;
    }
  },
  {
    id: 'salt-quench',
    label: 'Salt the quench trough',
    anchor(mission){
      const forge = mission.data?.forgeAnchor;
      if (forge?.rect){
        return {
          x: forge.rect.x + forge.rect.w * 0.74,
          y: forge.rect.y + forge.rect.h * 0.62,
          radius: Math.max(90, Math.max(forge.rect.w, forge.rect.h) * 0.34),
          label: 'Quench Trough'
        };
      }
      return null;
    },
    radius: 100,
    duration: 3.2,
    maxDetection: 56,
    maxLight: 0.58,
    lightFailText: 'The forge glare would catch the glittering salt—wait for dimmer light.',
    startText: 'You uncork a pouch of salt and ash over the quench water.',
    hintText: 'Press E as the forge light dips under half-strength.',
    cancelText: 'Lantern light sweeps the trough—you palm the salt for now.',
    completeText: 'Salt clouds the trough—any tempered steel will shatter brittle.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.lightModifier = (mission.data.lightModifier ?? 0) - 0.22;
      mission.data.quenchSalted = true;
    }
  },
  {
    id: 'fracture-chain',
    label: 'Fracture the temper chain',
    anchor(mission){
      const forge = mission.data?.forgeAnchor;
      if (forge?.rect){
        return {
          x: forge.rect.x + forge.rect.w * 0.52,
          y: forge.rect.y + forge.rect.h * 0.28,
          radius: Math.max(92, Math.max(forge.rect.w, forge.rect.h) * 0.3),
          label: 'Temper Chain'
        };
      }
      return null;
    },
    radius: 104,
    duration: 3.4,
    maxDetection: 54,
    maxLight: 0.5,
    lightFailText: 'Too bright—the snap would shine across the yard. Wait it out.',
    startText: 'You raise a cold chisel toward the temper chain linkage.',
    hintText: 'Press E once the coals settle into dull red.',
    cancelText: 'A flare races across the coals—you ease the chisel back.',
    completeText: 'The temper chain snaps; the forge clatters into silence.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.productionSapped = true;
    }
  }
];

function ensureMissions(){
  if (!state.tavernMissionSites){
    initTavernMissionSites();
  }
}

function initTavernMissionSites(){
  state.tavernMissionSites = {};
  Object.values(missionSpecs).forEach(spec => {
    const base = typeof spec.getLocation === 'function' ? spec.getLocation() : (spec.location || { x: 0, y: 0, radius: 160 });
    state.tavernMissionSites[spec.id] = {
      id: spec.id,
      location: base,
      active: false,
      ready: false,
      completed: false,
      rewardApplied: false,
      stageIndex: 0,
      stepsState: spec.steps.map(step => ({ id: step.id, completed: false })),
      activeAction: null,
      data: typeof spec.createData === 'function' ? spec.createData(base) : {},
      nextHintAt: 0,
      lastHintStep: null,
      lastFailAt: 0
    };
  });
}

function resetMissionProgress(missionState, spec){
  missionState.stageIndex = 0;
  missionState.stepsState = spec.steps.map(step => ({ id: step.id, completed: false }));
  missionState.activeAction = null;
  missionState.ready = false;
  missionState.rewardApplied = false;
  missionState.nextHintAt = 0;
  missionState.lastHintStep = null;
  missionState.lastFailAt = 0;
  missionState.data = typeof spec.createData === 'function' ? spec.createData(missionState.location) : {};
}

function activateTavernMissionSite(id){
  ensureMissions();
  const mission = state.tavernMissionSites[id];
  const spec = missionSpecs[id];
  if (!mission || !spec) return false;
  if (id === 'mission_free_captives'){
    lastCaptiveOutpost = null;
  }
  mission.location = typeof spec.getLocation === 'function' ? spec.getLocation() : mission.location;
  resetMissionProgress(mission, spec);
  mission.active = true;
  mission.completed = false;
  if (typeof spec.onActivate === 'function'){
    spec.onActivate(mission);
  }
  return true;
}

function completeTavernMissionSite(id){
  ensureMissions();
  const mission = state.tavernMissionSites[id];
  if (!mission) return;
  mission.completed = true;
  mission.active = false;
  mission.ready = false;
  mission.activeAction = null;
}

function isTavernMissionReady(id){
  ensureMissions();
  const mission = state.tavernMissionSites[id];
  return !!mission?.ready;
}

function getTavernMissionProgressText(id){
  ensureMissions();
  const mission = state.tavernMissionSites[id];
  const spec = missionSpecs[id];
  if (!mission || !spec) return '';
  if (!mission.active && !mission.ready && !mission.completed){
    return 'No active objectives. Accept the mission to begin.';
  }
  if (typeof spec.progress === 'function'){
    return spec.progress(mission, spec);
  }
  const total = spec.steps.length;
  const completed = mission.stepsState.filter(step => step.completed).length;
  if (mission.completed) return 'Mission completed.';
  if (mission.ready) return 'Objectives finished—report back.';
  const step = spec.steps[mission.stageIndex];
  if (!step) return `${completed}/${total} steps complete.`;
  return `${completed}/${total} steps complete · Next: ${step.label}`;
}

function resolveAnchor(spec, mission, step){
  if (!step) return mission.location;
  if (typeof step.anchor === 'function'){
    const result = step.anchor(mission, spec) || {};
    if (result.x != null && result.y != null){
      return { x: result.x, y: result.y, radius: result.radius ?? mission.location.radius ?? 140, label: result.label };
    }
  }
  const base = mission.location || { x: 0, y: 0, radius: 140 };
  if (step.anchorOffset){
    return {
      x: base.x + (step.anchorOffset.x ?? 0),
      y: base.y + (step.anchorOffset.y ?? 0),
      radius: step.radius ?? base.radius ?? 140,
      label: step.label
    };
  }
  if (step.anchor){
    return {
      x: step.anchor.x,
      y: step.anchor.y,
      radius: step.radius ?? base.radius ?? 140,
      label: step.label
    };
  }
  return { x: base.x, y: base.y, radius: step.radius ?? base.radius ?? 140, label: step.label };
}

function tryStartStepAction(mission, spec, step){
  if (!step) return false;
  if (mission.activeAction) return true;
  mission.data = mission.data || {};
  if (step.requireLoad && mission.data.stealthLoad && step.requireLoad !== mission.data.stealthLoad){
    const now = state.time;
    if (now >= (mission.lastFailAt ?? 0) + 2){
      const message = step.requireLoad === 'heavy'
        ? 'You need the heavier kit before attempting this.'
        : 'Shed the heavy kit before you try this move.';
      toast(message, 2.4);
      mission.lastFailAt = now;
    }
    return true;
  }
  const anchor = resolveAnchor(spec, mission, step);
  if (!anchor) return false;
  const player = state.player;
  const radius = step.radius ?? anchor.radius ?? 100;
  const dist = Math.hypot(player.x - anchor.x, player.y - anchor.y);
  if (dist > radius) return false;
  const detection = player.detection ?? 0;
  if (step.maxDetection != null && detection > step.maxDetection){
    const now = state.time;
    if (now >= (mission.lastFailAt ?? 0) + 2){
      toast('Too exposed—lower your detection before you move.', 2.4);
      mission.lastFailAt = now;
    }
    return true;
  }
  if (step.maxLight != null){
    const lightLevel = getLocalLightLevel(anchor, mission);
    mission.data.lastLightSample = lightLevel;
    if (lightLevel > step.maxLight){
      const now = state.time;
      if (now >= (mission.lastFailAt ?? 0) + 2){
        const message = step.lightFailText || 'Too bright—wait for the shadows to lengthen.';
        toast(message, 2.4);
        mission.lastFailAt = now;
      }
      return true;
    }
  }
  if (mission.data.alerted && state.time < (mission.data.noiseCooldownUntil ?? 0)){
    if (state.time >= (mission.data.lastNoiseToast ?? 0) + 2.2){
      toast('The outpost is on edge—wait for the noise to fade.', 2.3);
      mission.data.lastNoiseToast = state.time;
    }
    return true;
  }
  if (step.maxNoise != null){
    const noiseLevel = getCaptiveMissionNoiseLevel(mission, anchor, step);
    mission.data.noiseLevel = noiseLevel;
    const threshold = mission.data.noiseThreshold ?? step.maxNoise;
    if (noiseLevel > step.maxNoise){
      if (state.time >= (mission.data.lastNoiseToast ?? 0) + 2){
        toast('Too noisy—the guards twitch at every creak.', 2.2);
        mission.data.lastNoiseToast = state.time;
      }
      mission.data.alerted = true;
      mission.data.noiseCooldownUntil = Math.max(mission.data.noiseCooldownUntil ?? 0, state.time + 5.5);
      return true;
    }
    if (noiseLevel > threshold && state.time >= (mission.data.lastNoiseToast ?? 0) + 2.6){
      toast('Noise creeps high—move carefully.', 2.1);
      mission.data.lastNoiseToast = state.time;
    }
  }
  mission.activeAction = {
    stepId: step.id,
    startedAt: state.time,
    endsAt: state.time + (step.duration ?? 2.2),
    anchor,
    step
  };
  if (step.startText){
    toast(step.startText, 2.4);
  }
  return true;
}

function completeStep(mission, spec, step){
  const index = mission.stepsState.findIndex(entry => entry.id === step.id);
  if (index >= 0){
    mission.stepsState[index].completed = true;
  }
  if (mission.data && step.setLoad){
    mission.data.stealthLoad = step.setLoad;
  }
  if (typeof step.onComplete === 'function'){
    step.onComplete(mission, spec);
  }
  mission.stageIndex = Math.min(mission.stageIndex + 1, spec.steps.length);
  if (step.completeText){
    toast(step.completeText, 2.6);
  }
  mission.activeAction = null;
  if (mission.stageIndex >= spec.steps.length){
    mission.ready = true;
    mission.active = false;
    if (typeof spec.onReady === 'function'){
      spec.onReady(mission, spec);
    }
  }
}

function handleActiveAction(mission, spec){
  const action = mission.activeAction;
  if (!action) return;
  const player = state.player;
  const step = action.step;
  const anchor = resolveAnchor(spec, mission, step);
  if (!anchor){
    mission.activeAction = null;
    return;
  }
  const radius = step.radius ?? anchor.radius ?? 100;
  const dist = Math.hypot(player.x - anchor.x, player.y - anchor.y);
  if (dist > radius + 6){
    mission.activeAction = null;
    if (step.cancelText){
      toast(step.cancelText, 2.2);
    }
    return;
  }
  const detection = player.detection ?? 0;
  if (step.maxDetection != null && detection > step.maxDetection + 6){
    mission.activeAction = null;
    if (step.cancelText){
      toast(step.cancelText, 2.2);
    }
    return;
  }
  if (step.maxLight != null){
    const lightLevel = getLocalLightLevel(anchor, mission);
    mission.data = mission.data || {};
    mission.data.lastLightSample = lightLevel;
    if (lightLevel > step.maxLight + 0.05){
      mission.activeAction = null;
      if (step.cancelText){
        toast(step.cancelText, 2.2);
      } else {
        toast('The light flares—you break off the move.', 2.2);
      }
      return;
    }
  }
  if (state.time >= action.endsAt){
    completeStep(mission, spec, step);
  }
}

function updateScoutMovement(mission, dt){
  const spec = missionSpecs['silence-the-scout'];
  if (!spec) return;
  if (mission.stageIndex < 2 || mission.ready || mission.completed) return;
  const scout = mission.data?.scout;
  if (!scout || !Array.isArray(scout.path) || scout.path.length === 0) return;
  if (mission.activeAction && mission.activeAction.stepId === 'ambush') return;
  if (scout.dwell > 0){
    scout.dwell = Math.max(0, scout.dwell - dt);
    return;
  }
  const target = scout.path[scout.segmentIndex % scout.path.length];
  if (!target){
    scout.segmentIndex = 0;
    return;
  }
  const dx = target.x - scout.x;
  const dy = target.y - scout.y;
  const dist = Math.hypot(dx, dy);
  const speed = scout.speed ?? 40;
  if (dist <= Math.max(6, speed * dt)){
    scout.x = target.x;
    scout.y = target.y;
    scout.label = target.label || scout.label;
    scout.segmentIndex = (scout.segmentIndex + 1) % scout.path.length;
    scout.dwell = target.dwell ?? 3 + Math.random();
    return;
  }
  const step = speed * dt;
  scout.x += (dx / dist) * step;
  scout.y += (dy / dist) * step;
}

function updateFreeCaptivesMission(mission){
  if (!mission.active || mission.ready || mission.completed) return;
  mission.data = mission.data || {};
  const target = mission.data.targetOutpost;
  if (!target) return;
  const noiseLevel = getOutpostNoiseLevel(target);
  mission.data.noiseLevel = noiseLevel;
  const threshold = mission.data.noiseThreshold ?? 1.4;
  if (noiseLevel >= threshold){
    const firstAlert = !mission.data.alerted;
    mission.data.alerted = true;
    mission.data.noiseCooldownUntil = Math.max(mission.data.noiseCooldownUntil ?? 0, state.time + 6.5);
    if (firstAlert){
      state.player.detection = clamp((state.player?.detection ?? 0) + 6, 0, 100);
    }
    if (state.time >= (mission.data.lastNoiseToast ?? 0) + 4){
      toast('Noise ripples through the pens—guards stiffen and watch.', 2.4);
      mission.data.lastNoiseToast = state.time;
    }
  } else if (mission.data.alerted && state.time >= (mission.data.noiseCooldownUntil ?? 0)){
    mission.data.alerted = false;
    if (state.time >= (mission.data.lastNoiseToast ?? 0) + 4){
      toast('The outpost settles back into uneasy quiet.', 2.2);
      mission.data.lastNoiseToast = state.time;
    }
  }
}

function updateMissionHints(mission, spec){
  if (!mission.active || mission.ready || mission.activeAction) return;
  const step = spec.steps[mission.stageIndex];
  if (!step) return;
  const anchor = resolveAnchor(spec, mission, step);
  if (!anchor) return;
  const player = state.player;
  const radius = Math.max(step.radius ?? anchor.radius ?? 100, 80);
  const dist = Math.hypot(player.x - anchor.x, player.y - anchor.y);
  if (dist > radius) return;
  if (state.time < (mission.nextHintAt ?? 0)) return;
  const detection = player.detection ?? 0;
  if (step.maxDetection != null && detection > step.maxDetection + 6) return;
  mission.nextHintAt = state.time + 6;
  mission.lastHintStep = step.id;
  if (step.hintText){
    toast(step.hintText, 2.1);
  } else {
    toast(`Press E to ${step.label.toLowerCase()}.`, 2);
  }
}

function updateTavernMissionSites(dt){
  ensureMissions();
  Object.values(state.tavernMissionSites).forEach(mission => {
    const spec = missionSpecs[mission.id];
    if (!spec) return;
    if (mission.id === 'silence-the-scout'){
      updateScoutMovement(mission, dt);
    }
    if (mission.id === 'mission_free_captives'){
      updateFreeCaptivesMission(mission);
    }
    if (mission.activeAction){
      handleActiveAction(mission, spec);
    }
    updateMissionHints(mission, spec);
    if (mission.ready && typeof spec.onReady === 'function' && !mission.rewardApplied){
      spec.onReady(mission, spec);
    }
  });
}

function handleTavernMissionInteraction({ interactPressed = false } = {}){
  if (!interactPressed) return false;
  ensureMissions();
  let consumed = false;
  for (const mission of Object.values(state.tavernMissionSites)){
    if (consumed) break;
    if (!mission.active || mission.ready || mission.completed) continue;
    const spec = missionSpecs[mission.id];
    if (!spec) continue;
    const step = spec.steps[mission.stageIndex];
    if (!step) continue;
    const started = tryStartStepAction(mission, spec, step);
    consumed = consumed || started;
  }
  return consumed;
}

function getTavernMissionCues(){
  ensureMissions();
  const cues = [];
  for (const mission of Object.values(state.tavernMissionSites)){
    if (!mission.active || mission.ready || mission.completed) continue;
    const spec = missionSpecs[mission.id];
    if (!spec) continue;
    const step = spec.steps[mission.stageIndex];
    if (!step) continue;
    const anchor = resolveAnchor(spec, mission, step);
    if (!anchor) continue;
    const radius = step.cueRadius ?? step.radius ?? anchor.radius ?? (mission.location?.radius ?? 160);
    cues.push({
      questId: mission.id,
      stage: step.id,
      kind: 'tavern-mission',
      x: anchor.x,
      y: anchor.y,
      radius,
      innerRadius: Math.max(60, radius * 0.6),
      baseIntensity: step.cueIntensity ?? 0.18,
      escalateAfter: step.escalateAfter ?? 26,
      label: anchor.label || spec.label
    });
  }
  return cues;
}

function gatherTavernIntelLines(){
  ensureMissions();
  const lines = [];
  for (const mission of Object.values(state.tavernMissionSites)){
    const spec = missionSpecs[mission.id];
    if (!spec) continue;
    if (mission.ready){
      lines.push(`${spec.label} is taken care of—collect your reward.`);
      continue;
    }
    if (!mission.active) continue;
    const step = spec.steps[mission.stageIndex];
    if (!step) continue;
    if (mission.id === 'snuff-out-signal'){
      lines.push('The warfront beacon still burns—finish dousing it and raids will falter.');
      continue;
    }
    if (mission.id === 'poison-supply-lines'){
      lines.push('Caravan guards brew supper soon—spike stew and water before they march.');
      continue;
    }
    if (mission.id === 'mission_poison_well'){
      const total = POISON_WELL_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      const loadHeavy = mission.data?.stealthLoad === 'heavy';
      if (!mission.data?.plazaScouted){
        lines.push('Case the well plaza first—track patrol sips before you start pouring.');
      } else {
        const loadPrompt = loadHeavy
          ? 'You’re hauling the toxin—hit the guarded casks next.'
          : 'Travel light through the crowd before the next pour.';
        lines.push(`Well plaza poisoning ${completed}/${total}. ${loadPrompt}`);
      }
      continue;
    }
    if (mission.id === 'mission_free_captives'){
      const freed = mission.data?.cagesFreed || 0;
      const total = mission.data?.cages?.length || 3;
      if (!mission.data?.cagesMarked){
        lines.push('Watch the cage yard first—mark patrols before working the locks.');
      } else {
        const label = mission.data?.targetOutpost?.label || 'outpost pens';
        lines.push(`Keep quiet at ${label}. ${freed}/${total} cages opened—two shouts and the alarm will blare.`);
      }
      continue;
    }
    if (mission.id === 'mission_sabotage_forge'){
      const total = FORGE_SABOTAGE_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      const nextStep = FORGE_SABOTAGE_STEPS[mission.stageIndex];
      const lightPercent = formatLightPercent(mission.data?.lastLightSample);
      if (!mission.data?.bellowsJammed){
        const tail = lightPercent ? ` Light hovers near ${lightPercent}.` : '';
        lines.push(`Trace the torch cadence at the forge—wait for the glow to dip before you jam the bellows.${tail}`.trim());
      } else if (!mission.data?.quenchSalted){
        const threshold = nextStep?.maxLight != null ? `${Math.round(nextStep.maxLight * 100)}% light` : 'the dimmest moment';
        const tail = lightPercent ? ` Current light ${lightPercent}.` : '';
        lines.push(`Forge sabotage ${completed}/${total}. Salt the quench when light drops under ${threshold}.${tail}`.trim());
      } else {
        const threshold = nextStep?.maxLight != null ? `${Math.round(nextStep.maxLight * 100)}% light` : 'deep shadow';
        const tail = lightPercent ? ` Current light ${lightPercent}.` : '';
        lines.push(`Bellows wedged and trough fouled—snap the temper chain once light slips below ${threshold}.${tail}`.trim());
      }
      continue;
    }
    if (mission.id === 'silence-the-scout'){
      if (step.id === 'ambush'){
        const label = mission.data?.scout?.label || 'the ridge trail';
        lines.push(`The scout captain circles ${label}. Wait for his pause, then strike.`);
      } else {
        lines.push('Follow the subtle trail markers to intercept the scout captain.');
      }
    }
  }
  return lines;
}

export {
  initTavernMissionSites,
  updateTavernMissionSites,
  handleTavernMissionInteraction,
  activateTavernMissionSite,
  completeTavernMissionSite,
  isTavernMissionReady,
  getTavernMissionProgressText,
  getTavernMissionCues,
  gatherTavernIntelLines
};
