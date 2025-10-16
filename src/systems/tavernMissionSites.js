import { state } from '../state/gameState.js';
import { VILLAGES, WALL } from '../data/world.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { addThreat } from './threat.js';

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

let cachedHeistTarget = null;

function describeHeistHouse(house, index){
  if (!house) return 'Moonfen house';
  const lane = house.side === 'north' ? 'north lane' : 'south quay';
  return `House ${index + 1} on the ${lane}`;
}

function makeHeistAnchors(chest, house, label){
  if (!house){
    return {
      entryAnchor: null,
      chestAnchor: null,
      escapeAnchor: null,
      location: null
    };
  }
  const door = house.door || { x: house.x + house.w / 2 - 10, y: house.y, w: 20, h: WALL };
  const doorCenterX = door.x + door.w / 2;
  const outsideOffset = house.side === 'north' ? door.h + 44 : -44;
  const entryY = door.y + outsideOffset;
  const parity = (chest.houseId ?? 0) % 2 === 0 ? -1 : 1;
  const escapeX = doorCenterX + parity * 96;
  const escapeY = entryY + (house.side === 'north' ? 28 : -28);
  const location = {
    x: house.x + house.w / 2,
    y: house.y + house.h / 2,
    radius: Math.max(150, house.w, house.h),
    label
  };
  return {
    entryAnchor: {
      x: doorCenterX,
      y: entryY,
      radius: 92,
      label: `Doorway to ${label}`
    },
    chestAnchor: {
      x: chest.x,
      y: chest.y,
      radius: 64,
      label: `Lockbox inside ${label}`
    },
    escapeAnchor: {
      x: clamp(escapeX, location.x - 220, location.x + 220),
      y: escapeY,
      radius: 110,
      label: `Alley near ${label}`
    },
    location
  };
}

function isHeistTargetValid(target){
  if (!target) return false;
  const chest = state.chests?.[target.chestIndex];
  if (!chest || chest.looted) return false;
  if (chest.level != null && chest.level !== 0) return false;
  const house = state.houses?.[target.houseId];
  if (!house) return false;
  return true;
}

function selectHeistTarget(){
  if (!Array.isArray(state.chests) || !Array.isArray(state.houses)) return null;
  const candidates = [];
  state.chests.forEach((chest, index) => {
    if (!chest || chest.looted) return;
    if (chest.level != null && chest.level !== 0) return;
    if (!Number.isInteger(chest.houseId)) return;
    const house = state.houses[chest.houseId];
    if (!house || (house.villageId != null && house.villageId !== 0)) return;
    const label = describeHeistHouse(house, chest.houseId);
    const anchors = makeHeistAnchors(chest, house, label);
    if (!anchors.location) return;
    candidates.push({
      chestIndex: index,
      houseId: chest.houseId,
      houseLabel: label,
      baseAmount: chest.amount ?? 0,
      ...anchors
    });
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.baseAmount ?? 0) - (a.baseAmount ?? 0));
  return candidates[0];
}

function ensureHeistTarget(){
  if (isHeistTargetValid(cachedHeistTarget)) return cachedHeistTarget;
  cachedHeistTarget = selectHeistTarget();
  return cachedHeistTarget;
}

function getHeistChest(mission){
  if (!mission?.data) return null;
  const index = mission.data.targetChestIndex;
  if (!Number.isInteger(index)) return null;
  return state.chests?.[index] || null;
}

function computeHeistExposure(mission){
  const playerDetection = clamp(state.player?.detection ?? 0, 0, 100);
  const base = playerDetection / 100;
  const anchor = mission?.data?.heistLocation || mission?.location || { x: state.player.x, y: state.player.y, radius: 160 };
  const radius = anchor.radius ?? 160;
  const noiseEvents = Array.isArray(state.noiseEvents) ? state.noiseEvents : [];
  const now = state.time;
  let weight = 0;
  for (const ev of noiseEvents){
    if (!ev) continue;
    const dx = (ev.x ?? anchor.x) - anchor.x;
    const dy = (ev.y ?? anchor.y) - anchor.y;
    const dist = Math.hypot(dx, dy);
    const reach = (ev.radius ?? 0) + radius;
    if (dist > reach) continue;
    const span = Math.max(0.1, ev.duration ?? (ev.expiresAt != null && ev.createdAt != null ? ev.expiresAt - ev.createdAt : 6));
    const remaining = ev.expiresAt != null ? Math.max(0, ev.expiresAt - now) : 0;
    const progress = span > 0 ? clamp(1 - remaining / span, 0, 1) : 1;
    weight += clamp(progress, 0.2, 1);
  }
  const noiseFactor = clamp(weight * 0.25, 0, 1);
  const exposure = clamp(base * 0.7 + noiseFactor * 0.3, 0, 1);
  return Math.round(exposure * 100);
}

const HEIST_STEPS = [
  {
    id: 'breach-entry',
    label: 'Slip through the lamplit door',
    anchor(mission){
      return mission.data?.entryAnchor || mission.location;
    },
    radius: 92,
    duration: 2.6,
    maxDetection: 50,
    startText: 'You time your breath with the patrol and reach for the latch.',
    hintText: 'Press E at the doorway with detection under 50 to melt inside.',
    cancelText: 'Footsteps scrape nearby—you freeze against the wall.',
    completeText: 'You ghost through the doorway before lantern light swings back.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.entered = true;
      mission.data.lastExposure = computeHeistExposure(mission);
      state.player.detection = clamp((state.player?.detection ?? 0) - 6, 0, 100);
    }
  },
  {
    id: 'lift-lockbox',
    label: 'Lift the lockbox lid',
    anchor(mission){
      if (mission.data?.chestAnchor) return mission.data.chestAnchor;
      const chest = getHeistChest(mission);
      if (chest){
        return { x: chest.x, y: chest.y, radius: 64, label: 'Lockbox cache' };
      }
      return mission.location;
    },
    radius: 70,
    duration: 3.3,
    maxDetection: 54,
    startText: 'You kneel by the lockbox, picks whispering at the tumblers.',
    hintText: 'Press E beside the lockbox to pick it quietly.',
    cancelText: 'Boards creak overhead—you pause until the noise fades.',
    completeText: 'The lockbox yields; coin spills into your satchel.',
    onComplete(mission){
      mission.data = mission.data || {};
      const chest = getHeistChest(mission);
      let haul = 0;
      if (chest && !chest.looted){
        chest.looted = true;
        haul = chest.amount ?? 0;
        chest.amount = 0;
      }
      mission.data.lootAmount = (mission.data.lootAmount ?? 0) + haul;
      mission.data.chestOpened = true;
      mission.data.lastExposure = computeHeistExposure(mission);
      if (haul > 0){
        state.player.gold += haul;
        toast(`Lifted ${haul} gold from the lockbox.`, 2.6);
      } else {
        toast('The lockbox was already picked clean.', 2.4);
      }
      state.player.detection = clamp((state.player?.detection ?? 0) + 12, 0, 100);
      addThreat(8);
    }
  },
  {
    id: 'slip-away',
    label: 'Vanish into the moonlit lane',
    anchor(mission){
      return mission.data?.escapeAnchor || mission.location;
    },
    radius: 104,
    duration: 2.4,
    maxDetection: 58,
    startText: 'You edge toward the alley, ears tuned for distant patrols.',
    hintText: 'Press E in the alley to disappear into the night.',
    cancelText: 'A window snaps open—you duck back into shadow.',
    completeText: 'You fade into the alley, clutching the heavy purse.',
    onComplete(mission){
      mission.data = mission.data || {};
      mission.data.escaped = true;
      mission.data.lastExposure = computeHeistExposure(mission);
      mission.data.escapeTime = state.time;
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
  'mission_steal_gold': {
    id: 'mission_steal_gold',
    label: 'Moonfen Ledger Heist',
    getLocation(){
      const target = ensureHeistTarget();
      if (target?.location){
        return { ...target.location };
      }
      const moonfen = VILLAGES[0];
      return {
        x: moonfen.x + moonfen.w / 2,
        y: moonfen.y + moonfen.h / 2,
        radius: 200,
        label: 'Moonfen Lanes'
      };
    },
    steps: HEIST_STEPS,
    createData(){
      const target = ensureHeistTarget();
      if (!target){
        return { unavailable: true };
      }
      return {
        targetChestIndex: target.chestIndex,
        houseId: target.houseId,
        entryAnchor: target.entryAnchor ? { ...target.entryAnchor } : null,
        chestAnchor: target.chestAnchor ? { ...target.chestAnchor } : null,
        escapeAnchor: target.escapeAnchor ? { ...target.escapeAnchor } : null,
        heistLocation: target.location ? { ...target.location } : null,
        houseLabel: target.houseLabel,
        estimatedTake: target.baseAmount ?? 0,
        lootAmount: 0,
        chestOpened: false,
        escaped: false,
        lastExposure: 0
      };
    },
    onActivate(mission){
      mission.data = mission.data || {};
      if (mission.data.unavailable){
        mission.active = false;
        mission.ready = false;
        mission.completed = false;
        mission.stageIndex = 0;
        mission.stepsState = HEIST_STEPS.map(step => ({ id: step.id, completed: false }));
        cachedHeistTarget = null;
        toast('No ripe ledgers tonight—the street already lies quiet.', 2.6);
        return;
      }
      if (mission.data.heistLocation){
        mission.location = { ...mission.data.heistLocation };
      }
    },
    onReady(mission){
      if (mission.rewardApplied) return;
      mission.rewardApplied = true;
      mission.data = mission.data || {};
      mission.data.finishedAt = state.time;
      mission.data.lastExposure = computeHeistExposure(mission);
      cachedHeistTarget = null;
      toast('Gold secured. Return to the barkeep before suspicion spikes.', 2.6);
    },
    progress(mission){
      const data = mission.data || {};
      if (data.unavailable){
        return 'No stocked houses tonight—give the lanes time to fatten up again.';
      }
      const total = HEIST_STEPS.length;
      const completed = mission.stepsState.filter(step => step.completed).length;
      const exposure = computeHeistExposure(mission);
      if (mission.completed){
        return `Heist wrapped. Exposure Index ${exposure}.`;
      }
      if (mission.ready){
        return `Spoils bagged—report back. Exposure Index ${exposure}.`;
      }
      const step = HEIST_STEPS[mission.stageIndex];
      if (!step){
        return `${completed}/${total} steps complete · Exposure ${exposure}`;
      }
      const next = step.label;
      const suffix = data.houseLabel ? ` @ ${data.houseLabel}` : '';
      return `${completed}/${total} steps complete · Exposure ${exposure} · Next: ${next}${suffix}`;
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
      continue;
    }
    if (mission.id === 'mission_steal_gold'){
      const label = mission.data?.houseLabel || 'the marked house';
      if (step.id === 'lift-lockbox'){
        lines.push(`You\'re inside ${label}—lift the lockbox without spiking exposure.`);
      } else if (step.id === 'slip-away'){
        lines.push(`Lockbox cracked. Fade from ${label} before the watch loops back.`);
      } else {
        lines.push(`Case ${label}\'s doorway and slip inside when the patrol turns.`);
      }
      continue;
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
