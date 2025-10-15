import { ctx, W, H } from '../game/canvas.js';
import { getQuestDescriptors } from '../systems/questLog.js';

const STATUS_COLORS = {
  active: '#f5c76b',
  ready: '#7dd28c',
  available: '#7ec6ff',
  completed: '#9fb3c8'
};

const STATUS_ORDER = {
  active: 0,
  ready: 1,
  available: 2,
  completed: 3,
  hidden: 4
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

function drawQuestLog(){
  const quests = getQuestDescriptors({ includeHidden: false });
  const sortedQuests = quests.slice().sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });

  ctx.save();

  ctx.fillStyle = 'rgba(4, 10, 18, 0.88)';
  ctx.fillRect(0, 0, W, H);

  const panelPadding = 48;
  const panelWidth = Math.min(720, W - panelPadding * 2);
  const contentWidth = panelWidth - 48;

  const layoutEntries = sortedQuests.map(quest => {
    const detailText = quest.detail || quest.description || '';
    const detailLines = wrapText(detailText, contentWidth - 32, '14px system-ui');
    const progressLines = quest.progress ? wrapText(quest.progress, contentWidth - 32, '14px system-ui') : [];

    const padding = 16;
    const titleHeight = 24;
    const statusHeight = 18;
    const bodyLineHeight = 18;

    let height = padding * 2 + titleHeight + statusHeight;
    if (detailLines.length){
      height += 8 + detailLines.length * bodyLineHeight;
    }
    if (progressLines.length){
      height += 10 + progressLines.length * bodyLineHeight;
    }

    return { quest, detailLines, progressLines, height, padding };
  });

  const spacing = 12;
  const totalContentHeight = layoutEntries.reduce((sum, entry) => sum + entry.height, 0) + Math.max(0, layoutEntries.length - 1) * spacing;
  const minimumPanelHeight = 360;
  const desiredPanelHeight = Math.max(minimumPanelHeight, totalContentHeight + 120);
  const panelHeight = Math.min(desiredPanelHeight, H - panelPadding * 2);
  const panelX = (W - panelWidth) / 2;
  const panelY = (H - panelHeight) / 2;

  ctx.fillStyle = 'rgba(18, 28, 44, 0.96)';
  ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
  ctx.strokeStyle = '#3b5876';
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelWidth - 1, panelHeight - 1);

  ctx.fillStyle = '#d7e1f0';
  ctx.font = '24px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Quest Log', panelX + 24, panelY + 24);

  const contentX = panelX + 24;
  const contentYStart = panelY + 72;
  const contentBottom = panelY + panelHeight - 32;
  let cursorY = contentYStart;

  if (!layoutEntries.length){
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '16px system-ui';
    ctx.fillText('No quests tracked yet.', panelX + panelWidth / 2, panelY + panelHeight / 2 - 12);
    ctx.font = '14px system-ui';
    ctx.fillText('Explore the world or complete tavern contracts to uncover new quests.', panelX + panelWidth / 2, panelY + panelHeight / 2 + 16);
  } else {
    for (const entry of layoutEntries){
      if (cursorY + entry.height > contentBottom){
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9fb3c8';
        ctx.font = '14px system-ui';
        ctx.fillText('Additional quests are hidden—complete some to clear space.', panelX + panelWidth / 2, contentBottom - 12);
        break;
      }

      const boxX = contentX;
      const boxY = cursorY;
      const boxW = contentWidth;
      const boxH = entry.height;

      ctx.fillStyle = 'rgba(12, 22, 34, 0.92)';
      ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = 'rgba(80, 110, 140, 0.35)';
      ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

      let textY = boxY + entry.padding;
      const textX = boxX + entry.padding;

      ctx.fillStyle = '#f2f6ff';
      ctx.font = 'bold 20px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(entry.quest.title, textX, textY);
      textY += 24;

      const statusColor = STATUS_COLORS[entry.quest.status] || '#b0c4d8';
      ctx.fillStyle = statusColor;
      ctx.font = '14px system-ui';
      ctx.fillText(entry.quest.statusLabel, textX, textY);
      textY += 18;

      if (entry.detailLines.length){
        ctx.fillStyle = '#c4d2e4';
        ctx.font = '14px system-ui';
        for (const line of entry.detailLines){
          ctx.fillText(line, textX, textY);
          textY += 18;
        }
        textY += 2;
      }

      if (entry.progressLines.length){
        ctx.fillStyle = '#7ec6ff';
        ctx.font = '14px system-ui';
        textY += 8;
        for (const line of entry.progressLines){
          ctx.fillText(line, textX, textY);
          textY += 18;
        }
      }

      cursorY += entry.height + spacing;
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '14px system-ui';
  ctx.fillText('Press Q or Esc to return', W / 2, panelY + panelHeight + 32);

  ctx.restore();
}

export { drawQuestLog };
