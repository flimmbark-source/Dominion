import { state } from '../state/gameState.js';
import { ITEMS } from '../data/items.js';
import { canvas, canvasPointFromEvent } from '../game/canvas.js';
import { clamp } from '../utils/math.js';
import { toast } from '../ui/toast.js';
import { resetPressOnce } from '../input/pressOnce.js';
import { getPlayerStats, markPlayerStatsDirty, addTemporaryStatEffect } from '../state/playerStats.js';
import { applyHasteEffect, applyStrengthEffect } from './statusEffects.js';
import { getMerchantInventory, getMerchantName, MERCHANT_TYPE } from './merchants.js';

const shopState = {
  hitRegions: [],
  hover: null,
  currentMerchant: null,
  currentVillageIndex: null,
  mouseX: 0,
  mouseY: 0
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
    effects: item.effects ? {
      add: item.effects.add ? { ...item.effects.add } : undefined,
      mult: item.effects.mult ? { ...item.effects.mult } : undefined
    } : null,
    charges: item.charges ?? 1
  };
  markPlayerStatsDirty(state.player);
  getPlayerStats(state.player, state.time);
  return true;
}

function useInventorySlot(slotIdx){
  const it = state.player.inventory[slotIdx];
  if (!it) return;
  if (it.type === 'passive'){ toast('Already equipped.'); return; }

  const now = state.time;
  const stats = getPlayerStats(state.player, now);

  // Handle each consumable type
  switch (it.id) {
    case 'invis':
      if (now < state.player.invisUntil) return;
      state.player.invisUntil = now + 6;
      addTemporaryStatEffect(state.player, {
        id: 'invisibility-potion',
        mult: { stealthFactor: 0 },
        duration: 6
      }, now);
      toast('You fade from sight...');
      break;

    case 'moonleaf':
      state.player.health = clamp(state.player.health + 30, 0, stats.maxHealth);
      toast('You feel restored (+30 HP).');
      break;

    case 'greaterHealing':
      state.player.health = clamp(state.player.health + 60, 0, stats.maxHealth);
      toast('Life flows back into your veins (+60 HP).');
      break;

    case 'shadowEssence':
      if (now < state.player.invisUntil) return;
      state.player.invisUntil = now + 10;
      addTemporaryStatEffect(state.player, {
        id: 'shadow-essence',
        mult: { stealthFactor: 0 },
        duration: 10
      }, now);
      toast('You become one with darkness...');
      break;

    case 'wrathPotion':
      applyStrengthEffect(state.player, 15, 1);
      toast('Rage courses through you! (+50% Damage, 15s)');
      break;

    case 'hastePotion':
      applyHasteEffect(state.player, 8, 2);
      toast('You move like the wind! (+100% Speed, 8s)');
      break;

    case 'phoenixTear':
      state.player.health = stats.maxHealth;
      state.player.invulnerableUntil = now + 3;
      toast("The Phoenix's gift! (Full HP + Invulnerable 3s)");
      break;

    default:
      toast('Nothing happens.');
      return; // Don't consume if unknown
  }

  // Consume the item
  state.player.inventory[slotIdx] = null;
  markPlayerStatsDirty(state.player);
  getPlayerStats(state.player, state.time);
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
  if (item.type === 'passive') state.shopOwned.add(item.id);
  toast(`Purchased ${item.name}.`);
}

function openShop(merchantType = MERCHANT_TYPE.GOBLIN_TAVERN, villageIndex = null){
  state.pausedForShop = true; // Still set this flag to show the shop UI
  shopState.hover = null;
  shopState.hitRegions = [];
  shopState.currentMerchant = merchantType;
  shopState.currentVillageIndex = villageIndex;
  canvas.style.cursor = 'default';

  const merchantName = getMerchantName(merchantType, villageIndex);
  const greeting = merchantType === MERCHANT_TYPE.GOBLIN_TAVERN
    ? "What are ya buyin'?"
    : merchantType === MERCHANT_TYPE.TRAVELING
    ? "Rare treasures from distant lands!"
    : "Welcome! See anything you like?";

  toast(`${merchantName}: ${greeting}`, 2.2);
}

function closeShop(){
  state.pausedForShop = false;
  shopState.hover = null;
  shopState.hitRegions = [];
  canvas.style.cursor = 'default';
  resetPressOnce();
}

function getCurrentShopItems() {
  if (!shopState.currentMerchant) return [];
  return getMerchantInventory(shopState.currentMerchant, shopState.currentVillageIndex);
}

function getCurrentMerchantType() {
  return shopState.currentMerchant;
}

function getCurrentVillageIndex() {
  return shopState.currentVillageIndex;
}

function handleShopKeyDown(e){
  if (!state.pausedForShop) return;
  const k = e.key.toLowerCase();
  if (k === '0' || k === 'escape'){ closeShop(); return; }

  const shopItems = getCurrentShopItems();
  const item = shopItems.find(it => it.key === k);
  if (!item) return;
  attemptPurchase(item);
}

function handleShopMouseMove(evt){
  if (!state.pausedForShop) return;
  const pt = canvasPointFromEvent(evt);
  shopState.mouseX = pt.x;
  shopState.mouseY = pt.y;
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

function getShopMousePos(){
  return { x: shopState.mouseX, y: shopState.mouseY };
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
  setShopHover,
  getShopMousePos,
  getCurrentShopItems,
  getCurrentMerchantType,
  getCurrentVillageIndex
};
