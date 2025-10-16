import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { WORLD, VILLAGES } from '../data/world.js';
import { roads, pathSegments } from '../world/terrain.js';
import { TAU, clamp } from '../utils/math.js';
import { getQuestDefinition, getQuestState } from '../systems/questLog.js';

const MAP_POI_COLORS = {
  'shady-trader': '#d0a74e',
  'wandering-merchant': '#7ec6ff',
  'cursed-shrine': '#b57bf8',
  'bog-sprite': '#66e0a0'
};

const QUEST_MARKER_COLORS = {
  active: {
    fill: 'rgba(255, 232, 140, 0.24)',
    stroke: '#ffe06d',
    core: '#fff1b6'
  },
  pending: {
    fill: 'rgba(255, 211, 117, 0.16)',
    stroke: '#e8c56d',
    core: '#ffe5a6'
  }
};

function getFontSize(font){
  const match = typeof font === 'string' ? font.match(/(\d+(?:\.\d+)?)px/) : null;
  return match ? parseFloat(match[1]) : 12;
}

function prettifyStageId(id){
  if (!id || typeof id !== 'string') return '';
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function drawTrackedQuestTargets({ toMap, scale, mapX, mapY, mapW, mapH }){
  const trackedId = state.trackedQuestId;
  if (!trackedId) return null;

  const quest = getQuestState(trackedId);
  if (!quest) return null;

  const def = getQuestDefinition(trackedId);
  const targets = Array.isArray(quest.data?.targets) ? quest.data.targets : [];
  const positionedTargets = targets.filter(target => {
    if (!target) return false;
    if (!Array.isArray(target.position)) return false;
    const [x, y] = target.position;
    return Number.isFinite(x) && Number.isFinite(y);
  });

  const visibleTargets = positionedTargets.filter(target => {
    const status = typeof target.status === 'string' ? target.status.toLowerCase() : 'pending';
    return status !== 'completed';
  });

  const questTitle = def?.title || quest.id || 'Tracked quest';
  const progressText = typeof def?.getProgressText === 'function'
    ? def.getProgressText(quest, def) || ''
    : '';

  const primaryTarget = visibleTargets.find(target => (target.status || '').toLowerCase() === 'active')
    || visibleTargets[0]
    || positionedTargets[0]
    || null;

  const objectiveText = primaryTarget?.objective
    || primaryTarget?.phaseName
    || prettifyStageId(quest.data?.stage || quest.stage)
    || '';

  if (!visibleTargets.length){
    return {
      questTitle,
      progressText,
      objectiveText,
      hasMarkers: false
    };
  }

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (const target of visibleTargets){
    const [tx, ty] = target.position;
    const status = typeof target.status === 'string' ? target.status.toLowerCase() : 'pending';
    const palette = status === 'active' ? QUEST_MARKER_COLORS.active : QUEST_MARKER_COLORS.pending;
    const center = toMap(tx, ty);
    const radiusWorld = clamp(Number.isFinite(target.radius) ? target.radius : 140, 60, Math.max(WORLD.W, WORLD.H));
    const radiusPx = clamp(radiusWorld * scale, 18, Math.min(mapW, mapH));
    const coreRadius = clamp(radiusPx * 0.22, 4, 14 * Math.max(1, scale));

    ctx.beginPath();
    ctx.fillStyle = palette.fill;
    ctx.arc(center.x, center.y, radiusPx, 0, TAU);
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = Math.max(1.2, 2.1 * Math.sqrt(scale));
    ctx.arc(center.x, center.y, radiusPx, 0, TAU);
    ctx.stroke();

    ctx.shadowColor = 'rgba(255, 225, 150, 0.45)';
    ctx.shadowBlur = Math.max(8, 18 * scale);
    ctx.beginPath();
    ctx.fillStyle = palette.core;
    ctx.arc(center.x, center.y, coreRadius, 0, TAU);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.lineWidth = Math.max(1, 1.4 * Math.sqrt(scale));
    ctx.strokeStyle = 'rgba(38, 26, 10, 0.6)';
    ctx.arc(center.x, center.y, coreRadius, 0, TAU);
    ctx.stroke();
  }

  ctx.restore();

  return {
    questTitle,
    progressText,
    objectiveText,
    hasMarkers: true
  };
}

function drawTrackedQuestSummary(summary, mapX, mapY, mapW, mapH){
  if (!summary) return;

  const lines = [];
  lines.push({
    text: summary.questTitle,
    font: '600 15px system-ui',
    color: '#ffe7a4'
  });

  if (summary.progressText){
    lines.push({
      text: summary.progressText,
      font: '12px system-ui',
      color: '#c1d4ee'
    });
  }

  if (summary.hasMarkers && summary.objectiveText){
    lines.push({
      text: summary.objectiveText,
      font: '12px system-ui',
      color: '#ffe8bc'
    });
  } else if (!summary.hasMarkers){
    lines.push({
      text: 'No known objectives marked on the map yet.',
      font: '12px system-ui',
      color: '#d0d8e6'
    });
  }

  const paddingX = 14;
  const paddingY = 10;
  const lineSpacing = 4;

  let panelWidth = 160;
  let panelHeight = paddingY * 2;

  for (const line of lines){
    ctx.font = line.font;
    const metrics = ctx.measureText(line.text);
    const lineWidth = metrics.width;
    const fontSize = getFontSize(line.font);
    panelWidth = Math.max(panelWidth, Math.ceil(lineWidth) + paddingX * 2);
    panelHeight += fontSize;
    line.height = fontSize;
  }

  panelHeight += lineSpacing * (lines.length - 1);
  panelWidth = Math.min(panelWidth, mapW - 24);
  panelWidth = Math.max(panelWidth, 160);

  const panelX = clamp(mapX + 18, mapX + 18, mapX + mapW - panelWidth - 18);
  const panelY = clamp(mapY + mapH - panelHeight - 18, mapY + 18, mapY + mapH - panelHeight - 18);

  ctx.save();
  ctx.fillStyle = 'rgba(12, 18, 28, 0.88)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#435570';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);

  let cursorY = panelY + paddingY;
  for (const line of lines){
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(line.text, panelX + paddingX, cursorY);
    cursorY += line.height + lineSpacing;
  }

  ctx.restore();
}

function drawWorldMapOverlay(){
  ctx.save();

  const visibility = clamp(state.mapVisibility ?? 0.38, 0, 1);
  const fogOpacity = clamp(0.92 - visibility * 0.52, 0.35, 0.92);
  ctx.fillStyle = `rgba(4, 10, 18, ${fogOpacity.toFixed(2)})`;
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

  const detailAlpha = clamp(0.35 + visibility * 0.65, 0.3, 1);
  ctx.globalAlpha = detailAlpha;

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

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const village of VILLAGES){
    const center = toMap(village.x + village.w / 2, village.y + village.h / 2);
    const label = village.name;
    const labelFontSize = Math.max(12, Math.round(14 * scale));
    const labelFont = `${labelFontSize}px system-ui`;
    ctx.font = labelFont;

    const metrics = ctx.measureText(label);
    const paddingX = 6;
    const paddingY = 4;
    const labelWidth = metrics.width + paddingX * 2;
    const labelHeight = labelFontSize + paddingY * 2;
    const labelOffset = Math.max(labelFontSize + 4, 18 * scale);
    const labelX = center.x;
    const labelY = center.y + labelOffset;

    ctx.fillStyle = 'rgba(12, 20, 30, 0.82)';
    ctx.fillRect(labelX - labelWidth / 2, labelY - paddingY, labelWidth, labelHeight);
    ctx.strokeStyle = '#2d4258';
    ctx.strokeRect(labelX - labelWidth / 2 + 0.5, labelY - paddingY + 0.5, labelWidth - 1, labelHeight - 1);

    ctx.fillStyle = '#d7e1f0';
    ctx.fillText(label, labelX, labelY);

    ctx.strokeStyle = '#4a617b';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(labelX, labelY - paddingY);
    ctx.lineTo(center.x, center.y + Math.max(3, 8 * scale));
    ctx.stroke();
  }
  ctx.restore();

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

  const questSummary = drawTrackedQuestTargets({ toMap, scale, mapX, mapY, mapW, mapH });

  if (!state.player.dead){
    const playerPt = toMap(state.player.x, state.player.y);
    ctx.fillStyle = '#5cc16d';
    ctx.beginPath();
    ctx.arc(playerPt.x, playerPt.y, Math.max(4, state.player.r * scale * 1.6), 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#cfe8d4';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.restore();

  drawTrackedQuestSummary(questSummary, mapX, mapY, mapW, mapH);

  const fogStrength = clamp(1 - visibility, 0, 1);
  if (fogStrength > 0.05){
    const fogGradient = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * clamp(visibility, 0.25, 0.6), W / 2, H / 2, Math.max(W, H));
    fogGradient.addColorStop(0, `rgba(18, 28, 40, ${0.08 * fogStrength})`);
    fogGradient.addColorStop(1, `rgba(4, 8, 14, ${0.55 * fogStrength})`);
    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, 0, W, H);
  }

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
