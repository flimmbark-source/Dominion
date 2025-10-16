import { state } from '../state/gameState.js';
import { pressOnce } from '../input/pressOnce.js';
import { clamp } from '../utils/math.js';
import { toast } from './toast.js';
import {
  QUEST_LIST_ITEM_HEIGHT,
  QUEST_LIST_ITEM_SPACING,
  computeQuestLogLayout,
  getOrderedQuestDescriptors
} from './questLogViewModel.js';

function ensureTrackedQuestIsValid(quests){
  if (!state.trackedQuestId) return;
  const exists = quests.some(quest => quest.id === state.trackedQuestId);
  if (!exists){
    state.trackedQuestId = null;
  }
}

function syncScrollToSelection(quests){
  if (!quests.length) return;
  const layout = computeQuestLogLayout();
  const listHeight = layout.contentHeight;
  const totalHeight = quests.length * QUEST_LIST_ITEM_HEIGHT + Math.max(0, quests.length - 1) * QUEST_LIST_ITEM_SPACING;
  const maxScroll = Math.max(0, totalHeight - listHeight);
  const selectedIndex = clamp(state.questLogSelectedIndex ?? 0, 0, quests.length - 1);
  const selectedTop = selectedIndex * (QUEST_LIST_ITEM_HEIGHT + QUEST_LIST_ITEM_SPACING);
  const selectedBottom = selectedTop + QUEST_LIST_ITEM_HEIGHT;
  let scroll = clamp(state.questLogScroll ?? 0, 0, maxScroll);
  if (selectedTop < scroll){
    scroll = Math.max(0, selectedTop - QUEST_LIST_ITEM_SPACING);
  } else if (selectedBottom > scroll + listHeight){
    scroll = Math.min(maxScroll, selectedBottom - listHeight + QUEST_LIST_ITEM_SPACING);
  }
  state.questLogScroll = scroll;
}

function openQuestLog(){
  const quests = getOrderedQuestDescriptors();
  ensureTrackedQuestIsValid(quests);
  if (!quests.length){
    state.questLogSelectedIndex = 0;
    state.questLogScroll = 0;
    return;
  }

  const trackedId = state.trackedQuestId;
  let selectedIndex = state.questLogSelectedIndex ?? 0;
  if (trackedId){
    const trackedIndex = quests.findIndex(quest => quest.id === trackedId);
    if (trackedIndex >= 0){
      selectedIndex = trackedIndex;
    }
  }
  selectedIndex = clamp(selectedIndex, 0, quests.length - 1);
  state.questLogSelectedIndex = selectedIndex;

  const layout = computeQuestLogLayout();
  const listHeight = layout.contentHeight;
  const totalHeight = quests.length * QUEST_LIST_ITEM_HEIGHT + Math.max(0, quests.length - 1) * QUEST_LIST_ITEM_SPACING;
  const maxScroll = Math.max(0, totalHeight - listHeight);
  const anchor = selectedIndex * (QUEST_LIST_ITEM_HEIGHT + QUEST_LIST_ITEM_SPACING);
  state.questLogScroll = clamp(anchor - listHeight * 0.25, 0, maxScroll);
}

function handleQuestLogInput(){
  const quests = getOrderedQuestDescriptors();
  ensureTrackedQuestIsValid(quests);

  if (!quests.length){
    state.questLogSelectedIndex = 0;
    state.questLogScroll = 0;
    return;
  }

  let selectedIndex = clamp(state.questLogSelectedIndex ?? 0, 0, quests.length - 1);
  const moveDown = pressOnce('arrowdown') || pressOnce('s');
  const moveUp = pressOnce('arrowup') || pressOnce('w');
  const movePageDown = pressOnce('pagedown');
  const movePageUp = pressOnce('pageup');

  if (moveDown) selectedIndex = Math.min(selectedIndex + 1, quests.length - 1);
  if (moveUp) selectedIndex = Math.max(selectedIndex - 1, 0);
  if (movePageDown) selectedIndex = Math.min(selectedIndex + 5, quests.length - 1);
  if (movePageUp) selectedIndex = Math.max(selectedIndex - 5, 0);

  state.questLogSelectedIndex = selectedIndex;
  syncScrollToSelection(quests);

  const trackPressed = pressOnce('enter') || pressOnce('t');
  if (trackPressed){
    const quest = quests[selectedIndex];
    if (quest){
      const isTracking = state.trackedQuestId === quest.id;
      state.trackedQuestId = isTracking ? null : quest.id;
      toast(isTracking ? `Stopped tracking: ${quest.title}` : `Tracking quest: ${quest.title}`);
    }
  }
}

export { handleQuestLogInput, openQuestLog };
