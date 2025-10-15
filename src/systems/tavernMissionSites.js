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
  grantSafehouseAccess
} from './worldState.js';

const DARK_OUTPOST_PRESETS = [
  { id: 'moonfen-stockade', label: 'Moonfen Stockade Yard', villageIndex: 0, offset: { x: 420, y: 260 }, radius: 220 },
  { id: 'brackenreach-holding', label: 'Brackenreach Holding Pens', villageIndex: 1, offset: { x: -280, y: 280 }, radius: 210 },
  { id: 'duskhaven-pens', label: 'Duskhaven Cage Grounds', villageIndex: 2, offset: { x: 320, y: -200 }, radius: 214 }
];

let lastCaptiveOutpost = null;

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
