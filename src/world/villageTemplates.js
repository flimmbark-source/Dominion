import { VILLAGES } from '../data/world.js';
import { VILLAGE_TEMPLATES } from '../data/villageTemplates.js';
import { state } from '../state/gameState.js';

const OPPOSITE_DIRECTION = { north: 'south', south: 'north', east: 'west', west: 'east' };

function offsetPoint(village, point){
  return { x: village.x + point.x, y: village.y + point.y };
}

function offsetRect(village, rect){
  return { x: village.x + rect.x, y: village.y + rect.y, w: rect.w, h: rect.h };
}

function clonePoint(point){
  return { x: point.x, y: point.y };
}

function pickTemplateForVillage(village, index){
  if (village.templateId){
    const explicit = VILLAGE_TEMPLATES.find(t => t.id === village.templateId);
    if (explicit) return explicit;
  }
  return VILLAGE_TEMPLATES[index % VILLAGE_TEMPLATES.length];
}

function instantiateVillageInstance(index){
  const village = VILLAGES[index];
  const template = pickTemplateForVillage(village, index);

  const roads = (template.roads || []).map(road => ({
    id: road.id,
    tags: road.tags ? road.tags.slice() : [],
    connectors: road.connectors ? road.connectors.slice() : [],
    rects: road.rects ? road.rects.map(rect => offsetRect(village, rect)) : [],
    localRects: road.rects ? road.rects.map(rect => ({ ...rect })) : []
  }));

  const connectors = { north: [], south: [], east: [], west: [] };
  if (template.connectors){
    for (const dir of Object.keys(connectors)){
      const entries = template.connectors[dir] || [];
      connectors[dir] = entries.map(entry => ({
        ...entry,
        localPosition: entry.position ? clonePoint(entry.position) : null,
        position: entry.position ? offsetPoint(village, entry.position) : null,
        localOutside: entry.outside ? clonePoint(entry.outside) : null,
        outside: entry.outside ? offsetPoint(village, entry.outside) : null,
        localApproach: entry.approach ? entry.approach.map(clonePoint) : [],
        approach: entry.approach ? entry.approach.map(pt => offsetPoint(village, pt)) : []
      }));
    }
  }

  const traversalRoutes = (template.traversalRoutes || []).map(route => ({
    ...route,
    localNodes: route.nodes ? route.nodes.map(clonePoint) : [],
    nodes: route.nodes ? route.nodes.map(pt => offsetPoint(village, pt)) : []
  }));

  const routeMap = new Map(traversalRoutes.map(route => [route.id, route]));

  const safeZones = (template.safeZones || []).map(zone => {
    const localRect = zone.rect ? { ...zone.rect } : null;
    const rect = localRect ? offsetRect(village, localRect) : null;
    const localCenter = zone.center ? clonePoint(zone.center) : (localRect ? {
      x: localRect.x + localRect.w / 2,
      y: localRect.y + localRect.h / 2
    } : null);
    const center = localCenter ? offsetPoint(village, localCenter) : null;
    return {
      ...zone,
      localRect,
      rect,
      localCenter,
      center
    };
  });

  const tensionZones = (template.tensionZones || []).map(zone => {
    const localRect = zone.rect ? { ...zone.rect } : null;
    const rect = localRect ? offsetRect(village, localRect) : null;
    const localCenter = zone.center ? clonePoint(zone.center) : (localRect ? {
      x: localRect.x + localRect.w / 2,
      y: localRect.y + localRect.h / 2
    } : null);
    const center = localCenter ? offsetPoint(village, localCenter) : null;
    return {
      ...zone,
      localRect,
      rect,
      localCenter,
      center
    };
  });

  const coverPoints = (template.coverPoints || []).map(point => ({
    ...point,
    local: clonePoint(point),
    position: offsetPoint(village, point)
  }));

  const vantagePoints = (template.vantagePoints || []).map(point => ({
    ...point,
    local: clonePoint(point),
    position: offsetPoint(village, point)
  }));

  const chokepoints = (template.chokepoints || []).map(entry => {
    const localPosition = entry.position ? clonePoint(entry.position) : null;
    const position = localPosition ? offsetPoint(village, localPosition) : null;
    const localRect = entry.rect ? { ...entry.rect } : null;
    const rect = localRect ? offsetRect(village, localRect) : null;
    return {
      ...entry,
      localPosition,
      position,
      localRect,
      rect
    };
  });

  const patrols = (template.patrols || []).map(patrol => {
    const localRoute = patrol.route ? patrol.route.map(clonePoint) : [];
    const worldRoute = patrol.route ? patrol.route.map(pt => offsetPoint(village, pt)) : [];
    const localSpawn = patrol.spawn ? clonePoint(patrol.spawn) : (localRoute[0] ? clonePoint(localRoute[0]) : { x: village.w / 2, y: village.h / 2 });
    const spawn = offsetPoint(village, localSpawn);
    return {
      ...patrol,
      localRoute,
      worldRoute,
      localSpawn,
      spawn
    };
  });

  const instance = {
    index,
    village,
    template,
    houses: template.houses ? template.houses.map(spec => ({ ...spec })) : [],
    roads,
    connectors,
    traversalRoutes,
    routeMap,
    safeZones,
    tensionZones,
    coverPoints,
    vantagePoints,
    chokepoints,
    patrols
  };

  state.villageInstances[index] = instance;
  return instance;
}

function prepareVillageInstances(options = {}){
  const { force = false } = options;
  if (!force && state.villageInstances && state.villageInstances.length === VILLAGES.length){
    return state.villageInstances;
  }
  state.villageInstances = [];
  for (let i = 0; i < VILLAGES.length; i++){
    instantiateVillageInstance(i);
  }
  return state.villageInstances;
}

function getVillageInstance(index){
  if (!state.villageInstances || !state.villageInstances[index]){
    instantiateVillageInstance(index);
  }
  return state.villageInstances[index];
}

function forEachVillageInstance(cb){
  prepareVillageInstances();
  state.villageInstances.forEach((instance, index) => cb(instance, index));
}

function getConnector(instance, direction, matcher){
  const list = instance.connectors?.[direction] || [];
  if (typeof matcher === 'function'){
    return list.find(matcher) || null;
  }
  if (!matcher || !matcher.tags){
    return list.length ? list[0] : null;
  }
  const tags = matcher.tags;
  const prioritized = list
    .slice()
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  return prioritized.find(conn => tags.every(tag => conn.tags?.includes(tag))) || prioritized[0] || null;
}

function getRoute(instance, id){
  return instance.routeMap?.get(id) || null;
}

export {
  prepareVillageInstances,
  getVillageInstance,
  forEachVillageInstance,
  getConnector,
  getRoute,
  OPPOSITE_DIRECTION
};
