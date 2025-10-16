import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { clamp } from '../utils/math.js';
import {
  STATUS_COLORS,
  QUEST_LIST_ITEM_HEIGHT,
  QUEST_LIST_ITEM_SPACING,
  computeQuestLogLayout,
  getOrderedQuestDescriptors
} from '../ui/questLogViewModel.js';
import { getQuestDefinition, getQuestState } from '../systems/questLog.js';

const TARGET_STATUS_COLORS = {
  pending: '#9fb3c8',
  active: '#f5c76b',
  completed: '#7dd28c'
};

const TARGET_STATUS_LABELS = {
  pending: 'Pending',
  active: 'In progress',
  completed: 'Completed'
};

function wrapText(text, maxWidth, font){
  if (!text) return [];
  ctx.save();
  ctx.font = font;

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words){
    const next = current ? `${current} ${word}` : word;
    if (!current){
      current = next;
      continue;
    }

    const width = ctx.measureText(next).width;
    if (width <= maxWidth){
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  ctx.restore();
  return lines;
}

function formatStage(stageId, questDef){
  if (!stageId) return '';
  if (questDef?.phases){
    const phase = questDef.phases.find(entry => entry?.id === stageId);
    if (phase?.name) return phase.name;
  }
  return stageId
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function drawQuestList({ quests, layout, selectedIndex, maxScroll }){
  const listX = layout.contentX;
  const listY = layout.contentY;
  const listWidth = layout.listWidth;
  const listHeight = layout.contentHeight;
  const scroll = clamp(state.questLogScroll ?? 0, 0, maxScroll);

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX, listY, listWidth, listHeight);
  ctx.clip();

  ctx.fillStyle = 'rgba(10, 18, 30, 0.78)';
  ctx.fillRect(listX, listY, listWidth, listHeight);

  for (let i = 0; i < quests.length; i++){
    const quest = quests[i];
    const isSelected = i === selectedIndex;
    const isTracked = state.trackedQuestId === quest.id;
    const statusColor = STATUS_COLORS[quest.status] || '#b0c4d8';

    const itemTop = listY + i * (QUEST_LIST_ITEM_HEIGHT + QUEST_LIST_ITEM_SPACING) - scroll;
    const itemBottom = itemTop + QUEST_LIST_ITEM_HEIGHT;
    if (itemBottom < listY) continue;
    if (itemTop > listY + listHeight) break;

    const itemX = listX;
    const itemY = itemTop;
    const itemHeight = QUEST_LIST_ITEM_HEIGHT;

    ctx.fillStyle = isSelected ? 'rgba(50, 86, 128, 0.82)' : 'rgba(18, 28, 42, 0.72)';
    ctx.fillRect(itemX, itemY, listWidth, itemHeight);

    ctx.fillStyle = statusColor;
    ctx.fillRect(itemX, itemY, 4, itemHeight);

    if (isTracked){
      ctx.fillStyle = 'rgba(110, 200, 255, 0.18)';
      ctx.fillRect(itemX, itemY, listWidth, itemHeight);
    }

    const textPadding = 14;
    const textX = itemX + textPadding + 4;
    let textY = itemY + 16;

    ctx.fillStyle = '#f2f6ff';
    ctx.font = '600 16px system-ui';
    ctx.textAlign = 'left';
    const titleLines = wrapText(quest.title, listWidth - (textPadding + 10), '600 16px system-ui').slice(0, 2);
    for (const line of titleLines){
      ctx.fillText(line, textX, textY);
      textY += 18;
    }

    ctx.font = '12px system-ui';
    ctx.fillStyle = statusColor;
    ctx.fillText(quest.statusLabel, textX, itemY + itemHeight - 18);

    if (isTracked){
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7ec6ff';
      ctx.fillText('Tracking', itemX + listWidth - textPadding, itemY + itemHeight - 18);
      ctx.textAlign = 'left';
    }

    if (isSelected){
      ctx.strokeStyle = 'rgba(146, 208, 255, 0.9)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(itemX + 0.5, itemY + 0.5, listWidth - 1, itemHeight - 1);
    }
  }

  if (scroll > 0){
    const gradient = ctx.createLinearGradient(listX, listY, listX, listY + 24);
    gradient.addColorStop(0, 'rgba(12, 20, 32, 0.9)');
    gradient.addColorStop(1, 'rgba(12, 20, 32, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(listX, listY, listWidth, 24);
  }

  if (scroll < maxScroll){
    const gradient = ctx.createLinearGradient(listX, listY + listHeight - 24, listX, listY + listHeight);
    gradient.addColorStop(0, 'rgba(12, 20, 32, 0)');
    gradient.addColorStop(1, 'rgba(12, 20, 32, 0.9)');
    ctx.fillStyle = gradient;
    ctx.fillRect(listX, listY + listHeight - 24, listWidth, 24);
  }

  ctx.restore();
}

function drawObjectives({ ctx, baseX, baseY, width, targets }){
  const padding = 0;
  let cursorY = baseY;

  for (const target of targets){
    const status = target?.status || 'pending';
    const statusColor = TARGET_STATUS_COLORS[status] || '#9fb3c8';
    const statusLabel = TARGET_STATUS_LABELS[status] || 'Pending';

    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(baseX + 8, cursorY + 9, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f1f5ff';
    ctx.font = '14px system-ui';
    const textX = baseX + 22;
    const maxWidth = width - 26;
    const objectiveLines = wrapText(target?.objective || 'Objective unavailable', maxWidth, '14px system-ui');
    let lineCursorY = cursorY;
    for (const line of objectiveLines){
      ctx.fillText(line, textX, lineCursorY);
      lineCursorY += 18;
    }

    ctx.font = '11px system-ui';
    ctx.fillStyle = '#8aa0bc';
    const stageLabel = target?.phaseName ? `${target.phaseName}` : '';
    const metaLine = stageLabel ? `${statusLabel} • ${stageLabel}` : statusLabel;
    ctx.fillText(metaLine, textX, lineCursorY + 2);

    cursorY = lineCursorY + 20;
  }

  return cursorY - baseY;
}

function drawQuestDetail({ quest, layout }){
  const detailX = layout.contentX + layout.listWidth + 32;
  const detailY = layout.contentY;
  const detailWidth = layout.detailWidth;
  const detailHeight = layout.contentHeight;
  const padding = 22;

  ctx.fillStyle = 'rgba(14, 22, 34, 0.78)';
  ctx.fillRect(detailX, detailY, detailWidth, detailHeight);

  if (!quest){
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '16px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('No quests tracked yet.', detailX + padding, detailY + padding);
    ctx.font = '14px system-ui';
    ctx.fillText('Explore the frontier or visit the tavern to discover new missions.', detailX + padding, detailY + padding + 24);
    return;
  }

  const questState = getQuestState(quest.id);
  const questDef = getQuestDefinition(quest.id);
  const statusColor = STATUS_COLORS[quest.status] || '#b0c4d8';
  const stageId = questState?.data?.stage || questState?.stage || questDef?.initialStage || '';
  const stageLabel = formatStage(stageId, questDef);
  const targets = Array.isArray(questState?.data?.targets) ? questState.data.targets : [];
  const detailText = quest.detail || quest.description || '';
  const progressText = quest.progress || '';

  ctx.save();
  ctx.beginPath();
  ctx.rect(detailX, detailY, detailWidth, detailHeight);
  ctx.clip();

  let cursorY = detailY + padding;
  const textX = detailX + padding;

  ctx.fillStyle = '#f2f6ff';
  ctx.font = '600 24px system-ui';
  ctx.fillText(quest.title, textX, cursorY);
  cursorY += 34;

  ctx.font = '14px system-ui';
  ctx.fillStyle = statusColor;
  ctx.fillText(quest.statusLabel, textX, cursorY);
  const statusWidth = ctx.measureText(quest.statusLabel).width;

  if (state.trackedQuestId === quest.id){
    ctx.font = '12px system-ui';
    ctx.fillStyle = '#7ec6ff';
    ctx.fillText('Currently tracking', textX + statusWidth + 24, cursorY);
  }

  cursorY += 24;

  if (stageLabel){
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '13px system-ui';
    ctx.fillText(`Stage: ${stageLabel}`, textX, cursorY);
    cursorY += 22;
  }

  if (detailText){
    ctx.fillStyle = '#c8d4e8';
    ctx.font = '15px system-ui';
    const detailLines = wrapText(detailText, detailWidth - padding * 2, '15px system-ui');
    for (const line of detailLines){
      ctx.fillText(line, textX, cursorY);
      cursorY += 20;
    }
    cursorY += 6;
  }

  if (progressText){
    ctx.fillStyle = '#7ec6ff';
    ctx.font = '14px system-ui';
    const progressLines = wrapText(progressText, detailWidth - padding * 2, '14px system-ui');
    for (const line of progressLines){
      ctx.fillText(line, textX, cursorY);
      cursorY += 20;
    }
    cursorY += 12;
  }

  if (targets.length){
    ctx.fillStyle = '#d7e1f0';
    ctx.font = '600 16px system-ui';
    ctx.fillText('Objectives', textX, cursorY);
    cursorY += 26;

    cursorY += drawObjectives({ ctx, baseX: textX, baseY: cursorY, width: detailWidth - padding * 2, targets });
  }

  ctx.restore();
}

function drawQuestLog(){
  const quests = getOrderedQuestDescriptors();
  const layout = computeQuestLogLayout();

  let selectedIndex = quests.length ? clamp(state.questLogSelectedIndex ?? 0, 0, quests.length - 1) : 0;
  if (quests.length){
    state.questLogSelectedIndex = selectedIndex;
  } else {
    state.questLogSelectedIndex = 0;
  }

  const totalListHeight = quests.length * QUEST_LIST_ITEM_HEIGHT + Math.max(0, quests.length - 1) * QUEST_LIST_ITEM_SPACING;
  const maxScroll = Math.max(0, totalListHeight - layout.contentHeight);
  state.questLogScroll = clamp(state.questLogScroll ?? 0, 0, maxScroll);

  const selectedTop = selectedIndex * (QUEST_LIST_ITEM_HEIGHT + QUEST_LIST_ITEM_SPACING);
  const selectedBottom = selectedTop + QUEST_LIST_ITEM_HEIGHT;
  const viewTop = state.questLogScroll;
  const viewBottom = viewTop + layout.contentHeight;
  if (selectedTop < viewTop){
    state.questLogScroll = Math.max(0, selectedTop - QUEST_LIST_ITEM_SPACING);
  } else if (selectedBottom > viewBottom){
    state.questLogScroll = Math.min(maxScroll, selectedBottom - layout.contentHeight + QUEST_LIST_ITEM_SPACING);
  }

  ctx.save();

  ctx.fillStyle = 'rgba(4, 10, 18, 0.88)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(18, 28, 44, 0.96)';
  ctx.fillRect(layout.panelX, layout.panelY, layout.panelWidth, layout.panelHeight);
  ctx.strokeStyle = '#3b5876';
  ctx.strokeRect(layout.panelX + 0.5, layout.panelY + 0.5, layout.panelWidth - 1, layout.panelHeight - 1);

  ctx.fillStyle = '#d7e1f0';
  ctx.font = '28px system-ui';
  ctx.textAlign = 'left';
  ctx.fillText('Quest Log', layout.panelX + layout.panelPadding, layout.panelY + layout.panelPadding + 4);

  drawQuestList({ quests, layout, selectedIndex, maxScroll });
  drawQuestDetail({ quest: quests[selectedIndex], layout });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '13px system-ui';
  ctx.fillText(
    'Navigate: W/S or ↑/↓    Track: Enter or T    Close: Q or Esc',
    layout.panelX + layout.panelWidth / 2,
    layout.panelY + layout.panelHeight - 18
  );

  ctx.restore();
}

export { drawQuestLog };
