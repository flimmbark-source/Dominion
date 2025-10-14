import { ctx, W } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { VILLAGES } from '../data/world.js';
import { TAU } from '../utils/math.js';

const MINIMAP_SIZE = 200;
const MINIMAP_MARGIN = 20;
const VIEW_RADIUS = 650;
const ENTITY_RADIUS = 600;
const MINIMAP_POI_COLORS = {
  'shady-trader': '#d0a74e',
  'wandering-merchant': '#7ec6ff',
  'cursed-shrine': '#b57bf8',
  'bog-sprite': '#66e0a0'
};

function drawStructureRect(rect, scale, center, origin){
  const half = MINIMAP_SIZE / 2;
  const padding = 10;
  const drawW = rect.w * scale;
  const drawH = rect.h * scale;
  const centerX = rect.x + rect.w / 2;
  const centerY = rect.y + rect.h / 2;
  const drawX = origin.x + half + (centerX - center.x) * scale - drawW / 2;
  const drawY = origin.y + half + (centerY - center.y) * scale - drawH / 2;
  if (
    drawX + drawW < origin.x + padding ||
    drawY + drawH < origin.y + padding ||
    drawX > origin.x + MINIMAP_SIZE - padding ||
    drawY > origin.y + MINIMAP_SIZE - padding
  ) return;
  ctx.fillRect(drawX, drawY, drawW, drawH);
}

function drawMiniMap(){
  const minimapX = W - MINIMAP_SIZE - MINIMAP_MARGIN;
  const minimapY = MINIMAP_MARGIN;
  const player = state.player;
  const scale = MINIMAP_SIZE / (VIEW_RADIUS * 2);

  ctx.save();

  ctx.fillStyle = 'rgba(7, 12, 18, 0.85)';
  ctx.fillRect(minimapX - 10, minimapY - 10, MINIMAP_SIZE + 20, MINIMAP_SIZE + 40);
  ctx.strokeStyle = 'rgba(63, 87, 118, 0.8)';
  ctx.strokeRect(minimapX - 10.5, minimapY - 10.5, MINIMAP_SIZE + 21, MINIMAP_SIZE + 41);

  ctx.save();
  ctx.beginPath();
  ctx.arc(minimapX + MINIMAP_SIZE / 2, minimapY + MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, TAU);
  ctx.clip();

  ctx.fillStyle = '#0b1623';
  ctx.fillRect(minimapX, minimapY, MINIMAP_SIZE, MINIMAP_SIZE);

  const drawOrigin = { x: minimapX, y: minimapY };
  const playerCenter = { x: player.x, y: player.y };

  ctx.fillStyle = '#1a2739';
  for (const village of VILLAGES){
    drawStructureRect(village, scale, playerCenter, drawOrigin);
  }

  ctx.fillStyle = '#253f5f';
  for (const house of state.houses){
    drawStructureRect(house, scale, playerCenter, drawOrigin);
  }

  if (state.tavern){
    ctx.fillStyle = '#d6ab5c';
    drawStructureRect(state.tavern, scale, playerCenter, drawOrigin);
  }

  ctx.fillStyle = '#9fb3c8';
  const castleRadius = Math.max(6, 18 * scale);
  const castleX = minimapX + MINIMAP_SIZE / 2 + (state.castle.x - player.x) * scale;
  const castleY = minimapY + MINIMAP_SIZE / 2 + (state.castle.y - player.y) * scale;
  if (
    castleX + castleRadius > minimapX &&
    castleY + castleRadius > minimapY &&
    castleX - castleRadius < minimapX + MINIMAP_SIZE &&
    castleY - castleRadius < minimapY + MINIMAP_SIZE
  ){
    ctx.beginPath();
    ctx.arc(castleX, castleY, castleRadius, 0, TAU);
    ctx.fill();
  }

  if (state.pointsOfInterest && state.pointsOfInterest.length){
    for (const poi of state.pointsOfInterest){
      if (!poi.visibleOnMap) continue;
      const dx = poi.x - player.x;
      const dy = poi.y - player.y;
      const distSq = dx * dx + dy * dy;
      if (distSq > VIEW_RADIUS * VIEW_RADIUS * 1.44) continue;
      const poiX = minimapX + MINIMAP_SIZE / 2 + dx * scale;
      const poiY = minimapY + MINIMAP_SIZE / 2 + dy * scale;
      const color = MINIMAP_POI_COLORS[poi.type] || '#9fb3c8';
      ctx.globalAlpha = poi.resolved ? 0.6 : 0.95;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(poiX, poiY, Math.max(3, 8 * scale), 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const nearbyNpcs = state.npcs.filter((npc) => {
    const dx = npc.x - player.x;
    const dy = npc.y - player.y;
    return dx * dx + dy * dy <= ENTITY_RADIUS * ENTITY_RADIUS;
  });

  ctx.fillStyle = '#f4ae5d';
  for (const npc of nearbyNpcs){
    const npcX = minimapX + MINIMAP_SIZE / 2 + (npc.x - player.x) * scale;
    const npcY = minimapY + MINIMAP_SIZE / 2 + (npc.y - player.y) * scale;
    ctx.beginPath();
    ctx.arc(npcX, npcY, Math.max(2.5, 6 * scale), 0, TAU);
    ctx.fill();
  }

  const playerRadius = Math.max(4, player.r * scale * 1.4);
  ctx.fillStyle = '#5cc16d';
  ctx.beginPath();
  ctx.arc(minimapX + MINIMAP_SIZE / 2, minimapY + MINIMAP_SIZE / 2, playerRadius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#cfe8d4';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  ctx.strokeStyle = '#2b425f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(minimapX + MINIMAP_SIZE / 2, minimapY + MINIMAP_SIZE / 2, MINIMAP_SIZE / 2, 0, TAU);
  ctx.stroke();

  ctx.fillStyle = '#cfd9e6';
  ctx.font = '13px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Minimap (M)', minimapX + MINIMAP_SIZE / 2, minimapY + MINIMAP_SIZE + 12);

  ctx.restore();
}

export { drawMiniMap };
