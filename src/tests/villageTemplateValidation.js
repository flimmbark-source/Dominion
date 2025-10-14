import { state } from '../state/gameState.js';
import { prepareVillageInstances, forEachVillageInstance, getRoute } from '../world/villageTemplates.js';

function runVillageTemplateValidation(assert){
  prepareVillageInstances();
  const instances = state.villageInstances || [];
  assert(instances.length === forEachCount(), 'village templates assigned for each settlement');

  forEachVillageInstance((instance, index) => {
    const label = instance.template?.label || instance.template?.id || `village-${index}`;
    const prefix = `${label} (village ${index})`;

    const routeCount = instance.traversalRoutes?.length || 0;
    assert(routeCount >= 2, `${prefix} exposes multiple traversal routes`);

    const alternateRoutes = (instance.traversalRoutes || []).filter(route => {
      if (!route) return false;
      if (route.type && route.type !== 'primary') return true;
      return route.tags?.some(tag => tag === 'stealth' || tag === 'underground' || tag === 'alternate');
    });
    assert(alternateRoutes.length >= 1, `${prefix} offers at least one alternate path`);

    const safeZones = (instance.safeZones || []).filter(zone => zone.rect);
    assert(safeZones.length >= 1, `${prefix} defines safe zones`);

    const tensionZones = (instance.tensionZones || []).filter(zone => zone.rect);
    assert(tensionZones.length >= 1, `${prefix} defines tension zones`);

    const patrols = (instance.patrols || []).filter(patrol => (patrol.worldRoute?.length || 0) >= 3);
    assert(patrols.length >= 1, `${prefix} exposes patrol loops`);

    for (const patrol of instance.patrols || []){
      assert(!!patrol.spawn, `${prefix} patrol ${patrol.id} has a spawn point`);
      assert((patrol.worldRoute?.length || 0) >= 3, `${prefix} patrol ${patrol.id} forms a loop`);
    }

    for (const choke of instance.chokepoints || []){
      const bypassIds = choke.bypassRoutes || [];
      const resolved = bypassIds.map(id => getRoute(instance, id)).filter(Boolean);
      assert(bypassIds.length === 0 || resolved.length === bypassIds.length, `${prefix} chokepoint ${choke.id} references valid bypass routes`);
      if (bypassIds.length){
        const stealthy = resolved.filter(route => route.tags?.some(tag => tag === 'stealth' || tag === 'underground') || route.type === 'alternate');
        assert(stealthy.length >= 1, `${prefix} chokepoint ${choke.id} has a sneaking alternative`);
      }
    }

    const hasStealthRoute = (instance.traversalRoutes || []).some(route => {
      if (!route) return false;
      if (route.type && route.type !== 'primary') return true;
      return route.tags?.some(tag => tag === 'stealth' || tag === 'underground');
    });
    assert(hasStealthRoute, `${prefix} supports stealth traversal`);
  });
}

function forEachCount(){
  let count = 0;
  forEachVillageInstance(() => { count += 1; });
  return count;
}

export { runVillageTemplateValidation };
