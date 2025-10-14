import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { WORLD, VILLAGES } from '../data/world.js';
import { roads, pathSegments } from '../world/terrain.js';
import { TAU } from '../utils/math.js';

const MAP_POI_COLORS = {
  'shady-trader': '#d0a74e',
  'wandering-merchant': '#7ec6ff',
  'cursed-shrine': '#b57bf8',
  'bog-sprite': '#66e0a0'
};

function drawWorldMapOverlay(){
  ctx.save();

  ctx.fillStyle = 'rgba(4, 10, 18, 0.88)';
  ctx.fillRect(0, 0, W, H);

  const padding = 48;
  const availableW = W - padding * 2;
  const availableH = H - padding * 2;
  const scale = Math.min(availableW / WORLD.W, availableH / WORLD.H);
  const mapW = WORLD.W * scale;
  const mapH = WORLD.H * scale;
  const mapX = (W - mapW) / 2;
  const mapY = (H - mapH) / 2;

  ctx.fillStyle = 'rgba(18, 30, 46, 0.95)';
  ctx.fillRect(mapX - 16, mapY - 16, mapW + 32, mapH + 32);
  ctx.strokeStyle = '#3b5876';
  ctx.strokeRect(mapX - 16 + 0.5, mapY - 16 + 0.5, mapW + 32 - 1, mapH + 32 - 1);

  ctx.fillStyle = '#0b1623';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const toMap = (x, y) => ({
    x: mapX + x * scale,
    y: mapY + y * scale
  });

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapW, mapH);
  ctx.clip();

  ctx.fillStyle = '#1b2738';
  for (const road of roads){
    ctx.fillRect(mapX + road.x * scale, mapY + road.y * scale, road.w * scale, road.h * scale);
  }

  ctx.strokeStyle = '#433327';
  ctx.lineCap = 'round';
  for (const seg of pathSegments){
    ctx.lineWidth = Math.max(1.2, seg.width * scale);
    const a = toMap(seg.a.x, seg.a.y);
    const b = toMap(seg.b.x, seg.b.y);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.lineCap = 'butt';

  ctx.fillStyle = '#1f3550';
  for (const village of VILLAGES){
    ctx.fillRect(mapX + village.x * scale, mapY + village.y * scale, village.w * scale, village.h * scale);
  }

  ctx.fillStyle = '#253f5f';
  for (const house of state.houses){
    ctx.fillRect(mapX + house.x * scale, mapY + house.y * scale, house.w * scale, house.h * scale);
  }

  ctx.fillStyle = '#9fb3c8';
  const castlePt = toMap(state.castle.x, state.castle.y);
  ctx.beginPath();
  ctx.arc(castlePt.x, castlePt.y, Math.max(3.5, 12 * scale), 0, TAU);
  ctx.fill();

  if (state.tavern){
    const tavernPt = toMap(state.tavern.x + state.tavern.w/2, state.tavern.y + state.tavern.h/2);
    ctx.fillStyle = '#d6ab5c';
    ctx.beginPath();
    ctx.arc(tavernPt.x, tavernPt.y, Math.max(3, 10 * scale), 0, TAU);
    ctx.fill();

    ctx.save();
    const labelFont = '12px system-ui';
    ctx.font = labelFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = 'Goblin Tavern';
    const labelMetrics = ctx.measureText(label);
    const labelPaddingX = 6;
    const labelPaddingY = 4;
    const labelWidth = labelMetrics.width + labelPaddingX * 2;
    const labelHeight = 16;
    const labelX = tavernPt.x;
    const labelY = tavernPt.y + Math.max(10 * scale, 12) + 6;

    ctx.fillStyle = 'rgba(12, 20, 30, 0.82)';
    ctx.fillRect(labelX - labelWidth / 2, labelY - labelPaddingY, labelWidth, labelHeight);
    ctx.strokeStyle = '#56442c';
    ctx.strokeRect(labelX - labelWidth / 2 + 0.5, labelY - labelPaddingY + 0.5, labelWidth - 1, labelHeight - 1);

    ctx.fillStyle = '#f2d9a6';
    ctx.fillText(label, labelX, labelY);

    ctx.strokeStyle = '#d6ab5c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(labelX, labelY - labelPaddingY);
    ctx.lineTo(tavernPt.x, tavernPt.y + Math.max(3, 10 * scale));
    ctx.stroke();
    ctx.restore();
  }

  if (state.pointsOfInterest && state.pointsOfInterest.length){
    for (const poi of state.pointsOfInterest){
      if (!poi.visibleOnMap) continue;
      const poiPt = toMap(poi.x, poi.y);
      const color = MAP_POI_COLORS[poi.type] || '#9fb3c8';
      ctx.globalAlpha = poi.resolved ? 0.55 : 0.9;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(poiPt.x, poiPt.y, Math.max(3, 9 * scale), 0, TAU);
      ctx.fill();
      if (!poi.resolved){
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 1;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(poiPt.x, poiPt.y, Math.max(6, 16 * scale), 0, TAU);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  const playerPt = toMap(state.player.x, state.player.y);
  ctx.fillStyle = '#5cc16d';
  ctx.beginPath();
  ctx.arc(playerPt.x, playerPt.y, Math.max(4, state.player.r * scale * 1.6), 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#cfe8d4';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();

  ctx.fillStyle = '#cfd9e6';
  ctx.font = '20px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('World Map', mapX, mapY - 24);

  ctx.fillStyle = '#9fb3c8';
  ctx.font = '14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Press M or Esc to return', W / 2, mapY + mapH + 36);

  ctx.restore();
}

export { drawWorldMapOverlay };
