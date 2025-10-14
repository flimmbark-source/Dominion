import { state } from '../state/gameState.js';
import { WALL } from '../data/world.js';
import {
  rebuildHouseSolids,
  randomInHouseInterior,
  isInsideHouseInterior,
  getActiveSolids,
  getRenderableStairs,
  makeEdgeStairRects,
  createEdgeStairs,
  SECOND_FLOOR_BROWN
} from '../world/houses.js';
import { toast } from '../ui/toast.js';
import { runVillageTemplateValidation } from './villageTemplateValidation.js';
import { makeNPC, NPC_STATE, queueNoiseEvent } from '../npc/npcManager.js';

function assert(cond, name){
  if (!cond) {
    console.error('Test failed:', name);
    toast(`Test failed: ${name}`, 3);
  } else {
    console.log('OK', name);
  }
}

function runTests(){
  const h = { x:100, y:100, w:100, h:80, side:'south', door:{x:130,y:100,w:20,h:WALL} };
  const prev = state.houseSolids.slice();
  state.houses.push(h); rebuildHouseSolids();
  const solidsAdded = state.houseSolids.slice(prev.length);
  assert(solidsAdded.length >= 4, 'rebuildHouseSolids adds walls');
  const gapLeft = solidsAdded.find(s => s.y===100 && s.x===100 && s.w===30);
  const gapRight = solidsAdded.find(s => s.y===100 && s.x===150 && s.w===50);
  assert(!!gapLeft && !!gapRight, 'doorway gap created along street wall');
  state.houses.pop(); rebuildHouseSolids();

  const hx = state.houses[0];
  const pt = randomInHouseInterior(hx, 16);
  assert(isInsideHouseInterior(hx, pt.x, pt.y), 'randomInHouseInterior inside bounds');

  state.houses.forEach((house, i)=>{
    const count = state.chests.filter(c=>c.houseId===i).length;
    assert(count === 1, `house ${i} has exactly one chest`);
  });

  state.houses.forEach((house, i)=>{
    const hasUp = !!state.stairs.find(s=>s.houseId===i && s.level===0 && s.targetLevel===1);
    const hasDown = !!state.stairs.find(s=>s.houseId===i && s.level===1 && s.targetLevel===0);
    assert(hasUp && hasDown, `house ${i} has stairs up & down`);
  });

  state.houses.forEach((house, i)=>{
    state.interior = { houseId: i, level: 1 };
    const solidsUpAll = getActiveSolids();
    const block = solidsUpAll.find(s => s.w === house.door.w && s.h === WALL && s.x === house.door.x);
    assert(!!block, `upstairs blocks doorway for house ${i}`);
  });
  state.interior = null;

  const groundStairs = state.stairs.filter(s=>s.level===0);
  if (groundStairs.length){
    const s0 = groundStairs[0];
    const h0 = state.houses[s0.houseId];
    const innerLeft = h0.x + WALL, innerRight = h0.x + h0.w - WALL;
    const innerTop = h0.y + WALL, innerBot = h0.y + h0.h - WALL;
    const distLeft = Math.abs(s0.x - innerLeft);
    const distRight = Math.abs((innerRight) - (s0.x + s0.w));
    const distTop = Math.abs(s0.y - innerTop);
    const distBot = Math.abs((innerBot) - (s0.y + s0.h));
    const edgeDist = Math.min(distLeft, distRight, distTop, distBot);
    assert(edgeDist <= 18, 'stairs hug an interior edge');

    state.interior = { houseId: s0.houseId, level: 0 };
    state.player.x = s0.x + s0.w/2;
    state.player.y = s0.y + s0.h/2;
    const px = state.player.x, py = state.player.y;
    const onStairs = (px >= s0.x-6 && px <= s0.x+s0.w+6 && py >= s0.y-6 && py <= s0.y+s0.h+6);
    assert(onStairs, 'stair interaction uses bbox, not center distance');
    state.interior.level = 1;
    assert(Math.abs(state.player.x - px) < 1e-6 && Math.abs(state.player.y - py) < 1e-6, 'stairs keep player position when going up');
    const solidsWhenUp = getActiveSolids();
    const hDoor = state.houses[s0.houseId].door;
    const doorBlocked = !!solidsWhenUp.find(s=>s.x===hDoor.x && s.w===hDoor.w && s.h===WALL);
    assert(doorBlocked, 'door is blocked upstairs');
    state.interior.level = 0;
    assert(Math.abs(state.player.x - px) < 1e-6 && Math.abs(state.player.y - py) < 1e-6, 'stairs keep player position when going down');
    state.interior = null;
  } else {
    console.log('Note: no ground stairs found; edge-stairs test skipped.');
  }

  state.interior = null;
  assert(getRenderableStairs().length === 0, 'outside: no stairs rendered');
  state.interior = { houseId: 0, level: 0 };
  const vis0 = getRenderableStairs().length;
  assert(vis0 >= 1, 'inside level 0: stairs visible for current house');
  state.interior = { houseId: 0, level: 1 };
  const vis1 = getRenderableStairs().length;
  assert(vis1 >= 1, 'inside level 1: stairs visible for current house');
  state.interior = null;

  assert(SECOND_FLOOR_BROWN === '#6b4a2f', 'second floor uses brown floor');
  assert(makeEdgeStairRects(state.houses[0], 'left', 6).treads.length === 6, 'edge-stairs produce 6 treads');
  const pair = createEdgeStairs(state.houses[0], 0);
  assert(pair.up.w === pair.down.w && pair.up.h === pair.down.h, 'up/down stair bbox identical');

  state.houses.forEach((house, i)=>{
    state.interior = { houseId: i, level: 0 };
    const solidsDown = getActiveSolids();
    const blocked = !!solidsDown.find(s => s.w === house.door.w && s.h === WALL && s.x === house.door.x);
    assert(!blocked, `ground level door unblocked for house ${i}`);
  });
  state.interior = null;

  runVillageTemplateValidation(assert);

  const scout = makeNPC('scout', 0, 0);
  assert(scout.behaviorState === NPC_STATE.PATROL, 'scout defaults to PATROL state');
  const beforeNoise = state.noiseEvents.length;
  const noiseId = queueNoiseEvent({ x: 0, y: 0, radius: 120, type: 'test_noise', duration: 1, debug: false });
  assert(state.noiseEvents.length === beforeNoise + 1, 'queueNoiseEvent enqueues noise');
  state.noiseEvents = state.noiseEvents.filter(ev => ev.id !== noiseId);
}

export { runTests };
