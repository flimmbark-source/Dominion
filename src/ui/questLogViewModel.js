import { W, H } from '../game/canvas.js';
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

const QUEST_LIST_ITEM_HEIGHT = 62;
const QUEST_LIST_ITEM_SPACING = 8;
const QUEST_LOG_PANEL_MARGIN = 48;
const QUEST_LOG_PANEL_PADDING = 24;
const QUEST_LOG_HEADER_HEIGHT = 56;
const QUEST_LOG_MIN_HEIGHT = 520;

function getOrderedQuestDescriptors(){
  const quests = getQuestDescriptors({ includeHidden: false, acceptedOnly: true });
  return quests.slice().sort((a, b) => {
    const orderA = STATUS_ORDER[a.status] ?? 99;
    const orderB = STATUS_ORDER[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.title.localeCompare(b.title);
  });
}

function computeQuestLogLayout(){
  const margin = QUEST_LOG_PANEL_MARGIN;
  const panelWidth = Math.min(960, W - margin * 2);
  const availableHeight = H - margin * 2;
  const desiredHeight = Math.max(QUEST_LOG_MIN_HEIGHT, availableHeight);
  const panelHeight = Math.min(desiredHeight, H - 72);
  const panelX = (W - panelWidth) / 2;
  const panelY = (H - panelHeight) / 2;
  const headerHeight = QUEST_LOG_HEADER_HEIGHT;
  const padding = QUEST_LOG_PANEL_PADDING;
  const contentX = panelX + padding;
  const contentY = panelY + padding + headerHeight;
  const contentWidth = panelWidth - padding * 2;
  const contentHeight = panelHeight - padding * 2 - headerHeight;
  const listWidth = Math.max(260, Math.min(320, contentWidth * 0.36));
  const detailWidth = contentWidth - listWidth - 32;

  return {
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    headerHeight,
    panelPadding: padding,
    contentX,
    contentY,
    contentWidth,
    contentHeight,
    listWidth,
    detailWidth
  };
}

export {
  STATUS_COLORS,
  STATUS_ORDER,
  QUEST_LIST_ITEM_HEIGHT,
  QUEST_LIST_ITEM_SPACING,
  computeQuestLogLayout,
  getOrderedQuestDescriptors
};
