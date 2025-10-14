import { state } from '../state/gameState.js';
import { canvasPointFromEvent } from '../game/canvas.js';

const inventoryHoverState = {
  slotRects: [],
  hoveredSlot: null
};

function setInventorySlotRects(rects){
  inventoryHoverState.slotRects = Array.isArray(rects) ? rects : [];
  const idx = inventoryHoverState.hoveredSlot;
  if (idx === null || typeof idx !== 'number') return;
  if (!inventoryHoverState.slotRects[idx]){
    inventoryHoverState.hoveredSlot = null;
  }
}

function clearInventoryHover(){
  inventoryHoverState.hoveredSlot = null;
}

function handleInventoryMouseMove(evt){
  const pt = canvasPointFromEvent(evt);
  let hoveredSlot = null;
  for (let i = 0; i < inventoryHoverState.slotRects.length; i++){
    const rect = inventoryHoverState.slotRects[i];
    if (!rect) continue;
    if (pt.x >= rect.x && pt.x <= rect.x + rect.w && pt.y >= rect.y && pt.y <= rect.y + rect.h){
      hoveredSlot = i;
      break;
    }
  }
  inventoryHoverState.hoveredSlot = hoveredSlot;
}

function handleInventoryMouseLeave(){
  clearInventoryHover();
}

function getHoveredInventorySlot(){
  return inventoryHoverState.hoveredSlot;
}

function getHoveredInventorySlotRect(){
  const idx = inventoryHoverState.hoveredSlot;
  if (idx === null || typeof idx !== 'number') return null;
  return inventoryHoverState.slotRects[idx] || null;
}

function getHoveredInventoryItem(){
  const idx = inventoryHoverState.hoveredSlot;
  if (idx === null || typeof idx !== 'number') return null;
  return state.player.inventory[idx] || null;
}

export {
  setInventorySlotRects,
  handleInventoryMouseMove,
  handleInventoryMouseLeave,
  clearInventoryHover,
  getHoveredInventorySlot,
  getHoveredInventorySlotRect,
  getHoveredInventoryItem
};
