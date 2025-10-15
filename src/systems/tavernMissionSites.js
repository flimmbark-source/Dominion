import { state } from '../state/gameState.js';
import { VILLAGES } from '../data/world.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { addThreat } from './threat.js';
import { adjustMapVisibility, setGuardNodeOffline, unlockFastTravelBenefit } from './worldState.js';

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

function feedRiskThroughExposureIndex(delta){
  const player = state.player;
  if (!player) return 0;
  const current = player.detection ?? 0;
  const next = clamp(current + delta, 0, 100);
  player.detection = next;
  return next;
}

function generatePatrolSeed(length = 6){
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let seed = '';
  for (let i = 0; i < length; i += 1){
    const index = Math.floor(Math.random() * alphabet.length);
    seed += alphabet[index];
  }
  return seed;
}

const WATCHTOWER_STEPS = [
  {
    id: 'cross-terrace',
    label: 'Cross the lit terrace',
    anchorOffset: { x: 82, y: 164 },
    radius: 112,
    duration: 3.1,
    maxDetection: 54,
    startText: 'You slip from shadow to shadow across the torchlit terrace.',
    hintText: 'Press E to dash across the light-washed stones.',
    cancelText: 'Torchlight sweeps close—you freeze against the parapet.',
    completeText: 'You reach the tower base, cloak still smolder-dark.',
    onComplete(){
      feedRiskThroughExposureIndex(6);
      addThreat(-4);
    }
  },
  {
    id: 'scale-tower',
    label: 'Climb the tower spine',
    anchorOffset: { x: -28, y: 18 },
    radius: 96,
    duration: 3.6,
    maxDetection: 52,
    startText: 'You find handholds between barnacled stones and begin to climb.',
    hintText: 'Press E to climb, slipping past the spinning cone of light.',
    cancelText: 'Lantern rays sweep your path—you cling and wait.',
    completeText: 'You crest the parapet and throw the cone disruptor across the lenses.',
    onComplete(mission){
      const offlineFor = 60;
      mission.data = mission.data || {};
      mission.data.visionSuppressedUntil = state.time + offlineFor;
      setGuardNodeOffline('northwatch-tower', offlineFor, { reason: 'watchtower-climb' });
      feedRiskThroughExposureIndex(-3);
    }
  },
  {
    id: 'download-seed',
    label: 'Download the patrol seed',
    anchorOffset: { x: -12, y: -84 },
    radius: 90,
    duration: 3.2,
    maxDetection: 50,
    startText: 'You jack the crystal relay into your wrist reader.',
    hintText: 'Press E to siphon the next patrol seed.',
    cancelText: 'A glyph pulses too bright—you sever the link and reset.',
    completeText: 'The patrol seed pulses inside your reader—time to exfil.',
    onComplete(mission){
      mission.data = mission.data || {};
      const seed = generatePatrolSeed();
      mission.data.patrolSeed = seed;
      mission.data.seedCapturedAt = state.time;
      feedRiskThroughExposureIndex(-6);
      addThreat(-10);
      state.darkStrategy = state.darkStrategy || {};
      state.darkStrategy.nextPatrolSeed = { seed, capturedAt: state.time };
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
  'mission_scout_watchtower': {
    id: 'mission_scout_watchtower',
    label: 'Northwatch Relay Tower',
    getLocation(){
      const castle = state.castle || { x: 7600, y: 360 };
      return {
        x: castle.x - 420,
        y: castle.y - 160,
        radius: 210,
        label: 'Northwatch Relay Tower'
      };
    },
    steps: WATCHTOWER_STEPS,
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      const visibilityGain = (state.mapVisibility ?? 0.38) < 0.75 ? 0.06 : 0.03;
      adjustMapVisibility(visibilityGain);
      setGuardNodeOffline('northwatch-tower', 180, { reason: 'relay-suppressed' });
      unlockFastTravelBenefit('northwatch-beacon', { label: 'Northwatch Beacon', type: 'relay' });
      toast('Watchtower compromised. Map brightens and the Northwatch beacon attunes to you.', 3.6);
    },
    progress(mission){
      const total = WATCHTOWER_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      if (mission.completed) return 'Relay seed delivered. Beacon keyed.';
      if (mission.ready) return 'Seed secured—return to the barkeep with the intel.';
      const step = WATCHTOWER_STEPS[mission.stageIndex];
      if (!step) return `${completed}/${total} steps complete.`;
      if (step.id === 'scale-tower' && mission.data?.visionSuppressedUntil){
        const remaining = Math.max(0, mission.data.visionSuppressedUntil - state.time);
        const seconds = Math.ceil(remaining);
        return `${completed}/${total} steps complete · Cone suppressed ${seconds}s more.`;
      }
      if (step.id === 'download-seed'){
        return `${completed}/${total} steps complete · Next: Download the patrol seed.`;
      }
      return `${completed}/${total} steps complete · Next: ${step.label}`;
    }
  },
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
    if (mission.id === 'mission_scout_watchtower'){
      if (step.id === 'scale-tower'){
        lines.push('Northwatch’s cone is dimming—finish the climb and keep the vision offline.');
      } else if (step.id === 'download-seed'){
        lines.push('The relay core awaits. Siphon the patrol seed and ghost back.');
      } else {
        lines.push('Slip across the light-soaked terrace and breach the watchtower relay.');
      }
      continue;
    }
    if (mission.id === 'snuff-out-signal'){
      lines.push('The warfront beacon still burns—finish dousing it and raids will falter.');
      continue;
    }
    if (mission.id === 'poison-supply-lines'){
      lines.push('Caravan guards brew supper soon—spike stew and water before they march.');
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
