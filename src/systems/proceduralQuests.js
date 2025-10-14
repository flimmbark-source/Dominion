import { state, mainVillage } from '../state/gameState.js';
import { VILLAGES, WORLD } from '../data/world.js';
import { registerQuestDefinition } from './questLog.js';
import { addThreat } from './threat.js';

const DEFAULT_PRONOUNS = { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' };

const NPC_POOL = [
  { id: 'fae-herald', name: 'Tulin', role: 'Moonfen fairy herald', demeanor: 'anxious', pronouns: { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself' } },
  { id: 'bog-hermit', name: 'Old Jorren', role: 'bog hermit', demeanor: 'muttering', pronouns: { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' } },
  { id: 'fen-scout', name: 'Scout Mara', role: 'scarred Moonfen scout', demeanor: 'wary', pronouns: { subject: 'she', object: 'her', possessive: 'her', reflexive: 'herself' } },
  { id: 'veil-scribe', name: 'Ellin', role: 'veil scribe', demeanor: 'urgent', pronouns: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' } },
  { id: 'gloom-sprite', name: 'Lark', role: 'gloom-sprite courier', demeanor: 'impish', pronouns: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' } }
];

const POWER_OBJECTS = [
  { id: 'runestone-cluster', name: 'whispering runestone cluster', shortName: 'runestones', reward: { type: 'ward-strength' } },
  { id: 'mooncap-spore', name: 'luminous mooncap mushroom', shortName: 'mooncap', reward: { type: 'threat-reduction' } },
  { id: 'oakbound-totem', name: 'oakbound totem', shortName: 'totem', reward: { type: 'threat-reduction' } }
];

const INTEL_ITEMS = [
  { id: 'war-ledger', name: 'enemy war ledger', shortName: 'war ledger' },
  { id: 'scouting-map', name: 'detailed scouting map', shortName: 'scouting map' },
  { id: 'ciphered-orders', name: 'ciphered orders', shortName: 'orders' }
];

const SABOTAGE_TARGETS = [
  { id: 'supply-wagon', label: 'supply wagon', effect: 'threat-reduction' },
  { id: 'signal-brazier', label: 'signal brazier tower', effect: 'alarm-suppression' },
  { id: 'blackpowder-cache', label: 'blackpowder cache', effect: 'siege-delay' }
];

const ENEMY_TYPES = [
  { id: 'orc-patrol', label: 'orcish patrol', description: 'orc outriders guarding the site' },
  { id: 'raider-scouts', label: 'raider scouts', description: 'burnt-cloak scouts circling the target' },
  { id: 'witch-circle', label: 'witch circle', description: 'whispering hags shielding the ritual' }
];

const ESCORT_POOL = [
  { id: 'smuggler-nix', name: 'Smuggler Nix', role: 'tavern smuggler', hook: 'needs cover to lay blastpowder charges', pronouns: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' } },
  { id: 'adept-silen', name: 'Adept Silen', role: 'moon priest adept', hook: 'carries wards that must reach the target intact', pronouns: { subject: 'they', object: 'them', possessive: 'their', reflexive: 'themselves' } },
  { id: 'scout-bran', name: 'Scout Bran', role: 'wounded scout', hook: 'knows the hidden backtrail but cannot fight alone', pronouns: { subject: 'he', object: 'him', possessive: 'his', reflexive: 'himself' } }
];

const QUEST_BLUEPRINTS = [
  {
    id: 'hidden-power-cache',
    modules: [
      { stage: 'setup', type: 'clue', args: { npcKey: 'contact', itemKey: 'powerObject', locationKey: 'powerSite' } },
      { stage: 'objective', type: 'fetch-item', args: { itemKey: 'powerObject', locationKey: 'powerSite' } },
      { stage: 'challenge', type: 'eliminate-enemy', args: { enemyKey: 'guardian', locationKey: 'powerSite' } }
    ],
    reward: { type: 'threat-reduction', amount: 14 },
    prepare(resources){
      const contact = pickUnique(NPC_POOL, resources.usedNpcIds);
      const powerObject = pickUnique(POWER_OBJECTS, resources.usedItemIds);
      const powerSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { preferTag: 'poi' });
      const guardian = pickUnique(ENEMY_TYPES, resources.usedEnemyIds);
      return { contact, powerObject, powerSite, guardian };
    },
    buildTitle(ctx){
      return `Power Stirs at ${ctx.powerSite?.title || 'a hidden grove'}`;
    },
    buildDescription(ctx){
      if (!ctx.contact || !ctx.powerObject || !ctx.powerSite){
        return 'A whisper claims a relic is humming somewhere beyond Moonfen.';
      }
      return `${ctx.contact.name}, the ${ctx.contact.role}, whispers about ${ctx.powerObject.name} resonating at ${ctx.powerSite.label}.`;
    },
    buildIntel(ctx){
      if (!ctx.powerObject || !ctx.powerSite) return 'Follow the shimmer beyond the village.';
      return `Glints of ${ctx.powerObject.shortName || ctx.powerObject.name} were sighted ${describeDirection(ctx.powerSite)}.`;
    },
    buildRumor(ctx){
      if (!ctx.contact || !ctx.powerSite) return 'Someone swears the grove hums tonight.';
      return `${ctx.contact.role} mutters that ${ctx.powerSite.label} hums with a hidden relic.`;
    }
  },
  {
    id: 'supply-line-sabotage',
    modules: [
      { stage: 'setup', type: 'clue', args: { npcKey: 'contact', itemKey: 'intelItem', locationKey: 'targetSite' } },
      { stage: 'objective', type: 'sabotage-target', args: { targetKey: 'target', enemyKey: 'guardians', locationKey: 'targetSite' } },
      { stage: 'followup', type: 'fetch-item', args: { itemKey: 'intelItem', locationKey: 'cacheSite' } }
    ],
    reward: { type: 'threat-reduction', amount: 12, gold: 14 },
    prepare(resources){
      const contact = pickUnique(NPC_POOL, resources.usedNpcIds);
      const target = pickUnique(SABOTAGE_TARGETS, resources.usedTargetIds);
      const targetSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { preferTag: 'route' });
      const cacheSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { preferTag: 'village', avoidIds: [targetSite?.id].filter(Boolean) });
      const guardians = pickUnique(ENEMY_TYPES, resources.usedEnemyIds);
      const intelItem = pickUnique(INTEL_ITEMS, resources.usedItemIds);
      return { contact, target, targetSite, cacheSite, guardians, intelItem };
    },
    buildTitle(ctx){
      return `Sever the ${ctx.target ? capitalize(ctx.target.label) : 'supply line'}`;
    },
    buildDescription(ctx){
      if (!ctx.contact || !ctx.target) return 'Sabotage a vital supply line and stash proof for the rebels.';
      return `${ctx.contact.name} needs the ${ctx.target.label} ruined and evidence recovered before the enemy reroutes supplies.`;
    },
    buildIntel(ctx){
      if (!ctx.target || !ctx.targetSite) return 'Follow the trade ruts leading away from Moonfen.';
      const cacheDir = ctx.cacheSite ? describeDirection(ctx.cacheSite) : 'back toward friendly ground';
      return `The ${ctx.target.label} travels ${describeDirection(ctx.targetSite)}; the proof can be cached ${cacheDir}.`;
    },
    buildRumor(ctx){
      if (!ctx.target || !ctx.targetSite) return 'Merchants complain that wagons vanish in the mist.';
      return `Scouts whisper that a ${ctx.target.label} rumbles along ${ctx.targetSite.label}.`;
    }
  },
  {
    id: 'escort-strike',
    modules: [
      { stage: 'setup', type: 'escort-npc', args: { escortKey: 'escort', destinationKey: 'targetSite', locationKey: 'stagingSite' } },
      { stage: 'objective', type: 'sabotage-target', args: { targetKey: 'target', locationKey: 'targetSite', enemyKey: 'guardians' } },
      { stage: 'challenge', type: 'eliminate-enemy', args: { enemyKey: 'pursuers', locationKey: 'exfilSite' } }
    ],
    reward: { type: 'threat-reduction', amount: 16 },
    prepare(resources){
      const escort = pickUnique(ESCORT_POOL, resources.usedEscortIds);
      const target = pickUnique(SABOTAGE_TARGETS, resources.usedTargetIds);
      const stagingSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { preferTag: 'village' });
      const targetSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { avoidIds: [stagingSite?.id].filter(Boolean) });
      const exfilSite = chooseLocation(resources.locationPool, resources.usedLocationIds, { avoidIds: [stagingSite?.id, targetSite?.id].filter(Boolean) });
      const guardians = pickUnique(ENEMY_TYPES, resources.usedEnemyIds);
      const pursuers = pickUnique(ENEMY_TYPES, resources.usedEnemyIds);
      return { escort, target, stagingSite, targetSite, exfilSite, guardians, pursuers };
    },
    buildTitle(ctx){
      const escortName = ctx.escort?.name || 'the saboteur';
      const targetLabel = ctx.target?.label || 'target';
      return `Escort ${escortName} to Strike the ${targetLabel}`;
    },
    buildDescription(ctx){
      if (!ctx.escort || !ctx.targetSite || !ctx.target){
        return 'Guide a specialist through hostile ground, complete the sabotage, and escape together.';
      }
      return `${ctx.escort.name} the ${ctx.escort.role} must reach ${ctx.targetSite.label} under guard, sabotage the ${ctx.target.label}, then slip away.`;
    },
    buildIntel(ctx){
      const staging = ctx.stagingSite ? describeDirection(ctx.stagingSite) : 'near the tavern';
      const exfil = ctx.exfilSite ? describeDirection(ctx.exfilSite) : 'back toward Moonfen';
      if (!ctx.escort) return `An ally waits ${staging}; plan an exit ${exfil}.`;
      return `${ctx.escort.role} waits ${staging}; extraction runs ${exfil}.`;
    },
    buildRumor(ctx){
      if (!ctx.escort || !ctx.target) return 'Someone seeks a partner for a dangerous escort raid.';
      return `Rumor says ${ctx.escort.name} needs escort to rig a ${ctx.target.label}.`;
    }
  }
];

const QUEST_MODULES = {
  'clue': ({ ctx, stage, npcKey = 'contact', itemKey = 'item', locationKey = 'location' }) => {
    const npc = ctx[npcKey];
    const item = ctx[itemKey];
    const location = ctx[locationKey];
    const pronouns = npc?.pronouns || DEFAULT_PRONOUNS;
    const label = npc ? `Hear ${npc.name}'s lead` : 'Follow the rumor';
    const description = npc && item && location
      ? `${npc.name}, the ${npc.role}, hints that ${item.name} lingers near ${location.label}.`
      : 'Follow the whispered lead toward the target.';
    return {
      type: 'clue',
      stage,
      label,
      description,
      descriptor: {
        type: 'clue',
        giverId: npc?.id ?? null,
        giverName: npc?.name ?? null,
        locationId: location?.id ?? null,
        locationLabel: location?.label ?? null,
        subject: item?.id ?? null,
        subjectLabel: item?.name ?? null,
        demeanor: npc?.demeanor ?? null,
        pronouns
      }
    };
  },
  'fetch-item': ({ ctx, stage, itemKey = 'item', locationKey = 'location' }) => {
    const item = ctx[itemKey];
    const location = ctx[locationKey];
    const label = item ? `Recover the ${item.shortName || item.name}` : 'Recover the item';
    const description = item && location
      ? `Recover the ${item.name} hidden at ${location.label}.`
      : 'Retrieve the objective item.';
    return {
      type: 'fetch-item',
      stage,
      label,
      description,
      descriptor: {
        type: 'fetch',
        itemId: item?.id ?? null,
        itemName: item?.name ?? null,
        locationId: location?.id ?? null,
        locationLabel: location?.label ?? null,
        summary: item?.name ?? 'mysterious item'
      }
    };
  },
  'sabotage-target': ({ ctx, stage, targetKey = 'target', locationKey = 'location', enemyKey = 'enemy' }) => {
    const target = ctx[targetKey];
    const location = ctx[locationKey];
    const enemy = ctx[enemyKey];
    const label = target ? `Sabotage the ${target.label}` : 'Sabotage the target';
    const description = target && location
      ? `Sabotage the ${target.label} operating at ${location.label}.`
      : 'Sabotage the designated objective.';
    return {
      type: 'sabotage-target',
      stage,
      label,
      description: enemy ? `${description} Expect ${enemy.description}.` : description,
      descriptor: {
        type: 'sabotage',
        targetId: target?.id ?? null,
        targetLabel: target?.label ?? null,
        locationId: location?.id ?? null,
        locationLabel: location?.label ?? null,
        enemyId: enemy?.id ?? null,
        enemyLabel: enemy?.label ?? null,
        effect: target?.effect ?? null
      }
    };
  },
  'escort-npc': ({ ctx, stage, escortKey = 'escort', destinationKey = 'destination', locationKey = 'location' }) => {
    const escort = ctx[escortKey];
    const destination = ctx[destinationKey] || ctx[locationKey];
    const staging = ctx[locationKey];
    const pronouns = escort?.pronouns || DEFAULT_PRONOUNS;
    const label = escort ? `Escort ${escort.name}` : 'Escort the ally';
    const descriptionParts = [];
    if (escort && staging){
      descriptionParts.push(`${escort.name} waits at ${staging.label}.`);
    }
    if (destination){
      descriptionParts.push(`Guide ${pronouns.object} to ${destination.label}.`);
    }
    if (escort?.hook){
      descriptionParts.push(`They ${escort.hook}.`);
    }
    return {
      type: 'escort-npc',
      stage,
      label,
      description: descriptionParts.join(' '),
      descriptor: {
        type: 'escort',
        npcId: escort?.id ?? null,
        npcName: escort?.name ?? null,
        startLocationId: staging?.id ?? null,
        startLocationLabel: staging?.label ?? null,
        destinationId: destination?.id ?? null,
        destinationLabel: destination?.label ?? null,
        hook: escort?.hook ?? null
      }
    };
  },
  'eliminate-enemy': ({ ctx, stage, enemyKey = 'enemy', locationKey = 'location' }) => {
    const enemy = ctx[enemyKey];
    const location = ctx[locationKey];
    const label = enemy ? `Neutralize the ${enemy.label}` : 'Neutralize the guards';
    const description = enemy && location
      ? `Neutralize the ${enemy.label} prowling ${location.label}.`
      : 'Neutralize the resistance near the objective.';
    return {
      type: 'eliminate-enemy',
      stage,
      label,
      description,
      descriptor: {
        type: 'eliminate',
        enemyId: enemy?.id ?? null,
        enemyLabel: enemy?.label ?? null,
        locationId: location?.id ?? null,
        locationLabel: location?.label ?? null
      }
    };
  }
};

function buildLocationPool(){
  const pool = [];
  const points = Array.isArray(state.pointsOfInterest) ? state.pointsOfInterest : [];
  for (const poi of points){
    if (!poi) continue;
    pool.push({
      id: poi.id,
      label: poi.label,
      title: poi.label,
      shortLabel: poi.label,
      x: poi.x,
      y: poi.y,
      tags: ['poi', poi.type].filter(Boolean)
    });
  }

  const villageCenters = VILLAGES.map(village => ({
    id: `village-${village.name.toLowerCase()}`,
    label: `${village.name} outskirts`,
    title: `${village.name} outskirts`,
    shortLabel: `${village.name}`,
    x: village.x + village.w / 2,
    y: village.y + village.h / 2,
    tags: ['village']
  }));
  pool.push(...villageCenters);

  if (VILLAGES.length > 1){
    const connectors = [];
    for (let i = 0; i < VILLAGES.length; i++){
      for (let j = i + 1; j < VILLAGES.length; j++){
        const a = VILLAGES[i];
        const b = VILLAGES[j];
        const ax = a.x + a.w / 2;
        const ay = a.y + a.h / 2;
        const bx = b.x + b.w / 2;
        const by = b.y + b.h / 2;
        const id = `route-${a.name.toLowerCase()}-${b.name.toLowerCase()}`;
        connectors.push({
          id,
          label: `road between ${a.name} and ${b.name}`,
          title: `road between ${a.name} and ${b.name}`,
          shortLabel: `road ${a.name}-${b.name}`,
          x: (ax + bx) / 2,
          y: (ay + by) / 2,
          tags: ['route']
        });
      }
    }
    pool.push(...connectors);
  }

  return pool.filter(loc => Number.isFinite(loc.x) && Number.isFinite(loc.y));
}

function chooseLocation(pool, usedIds, options = {}){
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const avoidIds = new Set(options.avoidIds || []);
  const preferTag = options.preferTag || null;
  const origin = state.playerSpawn || {
    x: mainVillage.x + mainVillage.w / 2,
    y: mainVillage.y + mainVillage.h / 2
  };
  const diag = Math.hypot(WORLD.W, WORLD.H) || 1;

  const candidates = pool.filter(loc => {
    if (!loc) return false;
    if (avoidIds.has(loc.id)) return false;
    return true;
  });
  if (candidates.length === 0) return null;

  let best = null;
  let bestScore = -Infinity;
  for (const loc of candidates){
    const dist = Math.hypot(loc.x - origin.x, loc.y - origin.y);
    const normalizedDist = dist / diag;
    const unusedBonus = usedIds.has(loc.id) ? 0 : 0.35;
    const tagBonus = preferTag && loc.tags?.includes(preferTag) ? 0.25 : 0;
    const randomJitter = Math.random() * 0.2;
    const score = normalizedDist + unusedBonus + tagBonus + randomJitter;
    if (score > bestScore){
      bestScore = score;
      best = loc;
    }
  }
  if (best && options.mark !== false){
    usedIds.add(best.id);
  }
  return best;
}

function pickUnique(pool, usedIds){
  if (!Array.isArray(pool) || pool.length === 0) return null;
  const available = pool.filter(item => item && !usedIds.has(item.id));
  const source = available.length > 0 ? available : pool;
  const choice = source[Math.floor(Math.random() * source.length)];
  if (choice) usedIds.add(choice.id);
  return choice || null;
}

function instantiateModule(spec, ctx){
  if (!spec) return null;
  const generator = QUEST_MODULES[spec.type];
  if (!generator) return null;
  return generator({ ctx, stage: spec.stage, ...spec.args });
}

function composeDetail(modules){
  return modules.map(mod => `• ${mod.description}`).join('\n');
}

function describeDirection(location){
  if (!location) return 'somewhere in the wilds';
  const center = {
    x: mainVillage.x + mainVillage.w / 2,
    y: mainVillage.y + mainVillage.h / 2
  };
  const dx = location.x - center.x;
  const dy = location.y - center.y;
  const angle = Math.atan2(dy, dx);
  const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
  const index = Math.round(((angle + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
  const direction = names[index] || 'afar';
  const dist = Math.hypot(dx, dy);
  if (dist > 3200) return `deep ${direction} of Moonfen`;
  if (dist > 2000) return `far ${direction} of Moonfen`;
  if (dist > 1200) return `out toward the ${direction} of Moonfen`;
  return `just ${direction} of Moonfen`;
}

function capitalize(text){
  if (!text || typeof text !== 'string') return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function buildQuestDefinition(blueprint, ctx, modules, index){
  const stages = [...new Set(modules.map(mod => mod.stage))];
  if (!stages.includes('resolution')) stages.push('resolution');
  const stageLookup = new Map(modules.map(mod => [mod.stage, mod.label]));
  const descriptor = {
    template: blueprint.id,
    reward: blueprint.reward,
    modules: modules.map(mod => ({
      type: mod.type,
      stage: mod.stage,
      descriptor: mod.descriptor,
      label: mod.label
    }))
  };
  const questId = `world-procedural-${blueprint.id}-${index + 1}`;
  const title = blueprint.buildTitle(ctx) || capitalize(blueprint.id.replace(/-/g, ' '));
  const description = blueprint.buildDescription(ctx) || 'A procedurally generated contract awaits.';
  const intel = blueprint.buildIntel(ctx) || '';
  const rumor = blueprint.buildRumor(ctx) || '';
  const detail = composeDetail(modules);

  return registerQuestDefinition({
    id: questId,
    source: 'world',
    title,
    description,
    detail,
    intelHint: intel,
    rumor,
    stages,
    initialStatus: 'hidden',
    initialStage: stages[0] || 'setup',
    initialData: {
      stage: stages[0] || 'setup',
      templateId: blueprint.id,
      descriptor
    },
    getProgressText(quest){
      const stage = quest.data?.stage || stages[0] || 'setup';
      if (stage === 'resolution') return 'Report back to your contact.';
      return stageLookup.get(stage) || 'Follow the thread.';
    },
    onComplete(){
      const rewards = [];
      if (blueprint.reward?.type === 'threat-reduction'){
        const amount = Math.abs(Math.round(blueprint.reward.amount ?? 10));
        if (amount > 0){
          addThreat(-amount);
          rewards.push(`threat ${amount}↓`);
        }
      }
      if (blueprint.reward?.gold){
        const gold = Math.round(blueprint.reward.gold);
        if (gold !== 0){
          state.player.gold += gold;
          rewards.push(`${gold > 0 ? '+' : ''}${gold} gold`);
        }
      }
      if (!rewards.length) return 'Quest complete.';
      return `Quest complete: ${rewards.join(', ')}.`;
    }
  });
}

function initProceduralQuests(options = {}){
  const { force = false } = options;
  if (!force && Array.isArray(state.proceduralQuests) && state.proceduralQuests.length){
    return state.proceduralQuests;
  }
  state.proceduralQuests = [];
  const locationPool = buildLocationPool();
  const resources = {
    locationPool,
    usedLocationIds: new Set(),
    usedNpcIds: new Set(),
    usedItemIds: new Set(),
    usedEnemyIds: new Set(),
    usedTargetIds: new Set(),
    usedEscortIds: new Set()
  };

  QUEST_BLUEPRINTS.forEach((blueprint, index) => {
    const ctx = blueprint.prepare(resources) || {};
    const modules = blueprint.modules
      .map(spec => instantiateModule(spec, ctx))
      .filter(Boolean);
    const def = buildQuestDefinition(blueprint, ctx, modules, index);
    state.proceduralQuests.push({
      id: def.id,
      templateId: blueprint.id,
      context: serializeContext(ctx),
      descriptor: def.initialData?.descriptor || null,
      reward: blueprint.reward
    });
  });

  return state.proceduralQuests;
}

function serializeContext(ctx){
  if (!ctx) return null;
  const clone = {};
  for (const key of Object.keys(ctx)){
    const value = ctx[key];
    if (!value || typeof value !== 'object'){
      clone[key] = value;
      continue;
    }
    const shallow = {};
    for (const entry of Object.keys(value)){
      const val = value[entry];
      if (typeof val === 'function') continue;
      shallow[entry] = val;
    }
    clone[key] = shallow;
  }
  return clone;
}

function getProceduralQuestDescriptors(){
  return Array.isArray(state.proceduralQuests)
    ? state.proceduralQuests.map(entry => ({
        questId: entry.id,
        templateId: entry.templateId,
        descriptor: entry.descriptor
      }))
    : [];
}

export { initProceduralQuests, getProceduralQuestDescriptors, QUEST_BLUEPRINTS };
