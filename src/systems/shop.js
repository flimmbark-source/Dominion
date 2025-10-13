import { state } from '../state/gameState.js';
import { ITEMS } from '../data/items.js';
import { canvas, canvasPointFromEvent } from '../game/canvas.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { resetPressOnce } from '../input/pressOnce.js';

const shopState = {
  hitRegions: [],
  hover: null
};

function inventoryAdd(item){
  const idx = state.player.inventory.findIndex(x=>x===null);
  if (idx === -1) return false;
  state.player.inventory[idx] = {
    id: item.id,
    name: item.name,
    type: item.type,
    desc: item.desc,
    icon: item.icon ?? null,
    stacks: 1
  };
  return true;
}

function useInventorySlot(slotIdx){
  const it = state.player.inventory[slotIdx];
  if (!it) return;
  if (it.type === 'passive'){ toast('Already equipped.'); return; }
  if (it.id === 'invis'){
    const now = state.time;
    if (now < state.player.invisUntil) return;
    state.player.invisUntil = now + 6;
    state.player.inventory[slotIdx] = null;
    toast('You fade from sight...');
  } else if (it.id === 'moonleaf'){
    state.player.health = clamp(state.player.health + 30, 0, 100);
    state.player.inventory[slotIdx] = null;
    toast('You feel restored (+30 HP).');
  }
}

function attemptPurchase(item){
  const p = state.player;
  const price = Number(item.price) || 0;
  const playerGold = Number.isFinite(p.gold) ? p.gold : 0;
  if (item.canBuy && !item.canBuy(p)){
    toast('Already owned.');
    return;
  }
  if (playerGold < price){ toast('Not enough gold!'); return; }
  if (!inventoryAdd(item)){ toast('Inventory full!'); return; }
  p.gold = playerGold - price;
  if (item.apply) item.apply(p);
  if (item.type === 'passive') state.shopOwned.add(item.id);
  toast(`Purchased ${item.name}.`);
}

function openShop(){
  state.pausedForShop = true;
  shopState.hover = null;
  shopState.hitRegions = [];
  canvas.style.cursor = 'default';
  toast("Goblin Merchant: What are ya buyin'?", 2.2);
}

function closeShop(){
  state.pausedForShop = false;
  shopState.hover = null;
  shopState.hitRegions = [];
  canvas.style.cursor = 'default';
  resetPressOnce();
}

function handleShopKeyDown(e){
  if (!state.pausedForShop) return;
  const k = e.key.toLowerCase();
  if (k === '0' || k === 'escape'){ closeShop(); return; }
  const item = ITEMS.find(it => it.key === k);
  if (!item) return;
  attemptPurchase(item);
}

function handleShopMouseMove(evt){
  if (!state.pausedForShop) return;
  const pt = canvasPointFromEvent(evt);
  let hovered = null;
  for (const hit of shopState.hitRegions){
    if (pt.x >= hit.rect.x && pt.x <= hit.rect.x + hit.rect.w && pt.y >= hit.rect.y && pt.y <= hit.rect.y + hit.rect.h){
      hovered = hit;
      break;
    }
  }
  shopState.hover = hovered ? (hovered.type === 'exit' ? 'exit' : hovered.item.id) : null;
  canvas.style.cursor = hovered ? 'pointer' : 'default';
}

function handleShopMouseLeave(){
  if (!state.pausedForShop) return;
  shopState.hover = null;
  canvas.style.cursor = 'default';
}

function handleShopClick(evt){
  if (!state.pausedForShop) return;
  const pt = canvasPointFromEvent(evt);
  for (const hit of shopState.hitRegions){
    const inside = pt.x >= hit.rect.x && pt.x <= hit.rect.x + hit.rect.w && pt.y >= hit.rect.y && pt.y <= hit.rect.y + hit.rect.h;
    if (!inside) continue;
    if (hit.type === 'exit'){ closeShop(); }
    else if (hit.type === 'item'){ attemptPurchase(hit.item); }
    break;
  }
}

function setShopHitRegions(regions){
  shopState.hitRegions = regions;
}

function addShopHitRegion(region){
  shopState.hitRegions.push(region);
}

function clearShopHitRegions(){
  shopState.hitRegions = [];
}

function getShopHitRegions(){
  return shopState.hitRegions;
}

function getShopHover(){
  return shopState.hover;
}

function setShopHover(value){
  shopState.hover = value;
}

export {
  inventoryAdd,
  useInventorySlot,
  attemptPurchase,
  openShop,
  closeShop,
  handleShopKeyDown,
  handleShopMouseMove,
  handleShopMouseLeave,
  handleShopClick,
  setShopHitRegions,
  addShopHitRegion,
  clearShopHitRegions,
  getShopHitRegions,
  getShopHover,
  setShopHover
};
