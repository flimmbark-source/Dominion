import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { RARITY_COLORS } from '../data/items.js';
import { setShopHitRegions, getShopHover, getCurrentShopItems } from '../systems/shop.js';
import { drawItemIcon } from './itemIcons.js';
import { getMerchantName, MERCHANT_TYPE } from '../systems/merchants.js';

function drawShop(){
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,12,0.85)';
  ctx.fillRect(0,0,W,H);

  // Larger shop panel for better readability
  const pw = 820, ph = 560;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const panelGrad = ctx.createLinearGradient(px, py, px, py + ph);
  panelGrad.addColorStop(0, '#2a1f15');
  panelGrad.addColorStop(1, '#1f1610');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#8a6d3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
  ctx.lineWidth = 1;

  const shopItems = getCurrentShopItems();

  // Header section
  ctx.fillStyle = '#f6e9c8';
  ctx.font = 'bold 28px "Trebuchet MS", ui-sans-serif';
  const merchantName = getMerchantName(
    state.pausedForShop && shopItems.length > 0 ?
      (state.merchants?.travelingMerchant ? MERCHANT_TYPE.TRAVELING : MERCHANT_TYPE.GOBLIN_TAVERN) :
      'Merchant'
  );
  ctx.fillText(merchantName, px + 32, py + 44);

  ctx.fillStyle = '#c9a876';
  ctx.font = '15px ui-sans-serif';
  ctx.fillText('Click or press hotkey to purchase', px + 32, py + 74);

  // Gold display
  ctx.font = 'bold 18px ui-sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`💰 ${state.player.gold} gold`, px + pw - 180, py + 44);

  // Item list area
  const listStartY = py + 96;
  const listPadding = 24;
  const listWidth = pw - listPadding * 2;
  const itemCardHeight = 110; // Fixed height per item card
  const itemGap = 12;
  const maxVisibleItems = 4;
  const listHeight = ph - 96 - 60; // Space for header and footer

  const newHitRegions = [];
  const usedSlots = state.player.inventory.filter(Boolean).length;

  // Helper function for constrained text wrapping
  const wrapTextConstrained = (text, x, y, maxWidth, lineHeight, maxLines) => {
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    let lineCount = 0;

    for (const word of words) {
      if (lineCount >= maxLines) break;

      const testLine = line ? `${line} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && line) {
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
        lineCount++;
      } else {
        line = testLine;
      }
    }

    if (line && lineCount < maxLines) {
      // Truncate if last line is too long
      if (ctx.measureText(line).width > maxWidth) {
        while (ctx.measureText(line + '...').width > maxWidth && line.length > 0) {
          line = line.slice(0, -1);
        }
        line += '...';
      }
      ctx.fillText(line, x, cursorY);
      cursorY += lineHeight;
    }

    return cursorY;
  };

  // Draw each item card
  shopItems.forEach((item, idx) => {
    const cardY = listStartY + idx * (itemCardHeight + itemGap);

    // Skip if outside visible area (simple scrolling could be added here)
    if (cardY + itemCardHeight > listStartY + listHeight) return;

    const rect = {
      x: px + listPadding,
      y: cardY,
      w: listWidth,
      h: itemCardHeight
    };

    const hovered = getShopHover() === item.id;
    const affordable = state.player.gold >= item.price;
    const owned = item.canBuy ? !item.canBuy(state.player) : false;
    const quantity = state.player.inventory.filter(it => it && it.id === item.id).length;

    // Card background with rarity glow
    ctx.fillStyle = hovered ? 'rgba(60,45,28,0.9)' : 'rgba(28,20,14,0.85)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Rarity border (thicker, more prominent)
    const rarityColor = RARITY_COLORS[item.rarity] || '#8a6d3a';
    ctx.strokeStyle = hovered ? '#f4d76a' : rarityColor;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    ctx.lineWidth = 1;

    // Left section: Icon
    const iconSize = 64;
    const iconX = rect.x + 20;
    const iconY = rect.y + itemCardHeight / 2;

    if (item.icon) {
      drawItemIcon(ctx, item.icon, iconX + iconSize/2, iconY, iconSize);
    }

    // Middle section: Item info
    const contentX = iconX + iconSize + 24;
    const contentWidth = rect.w - (contentX - rect.x) - 140; // Reserve space for price
    const contentY = rect.y + 24;

    // Item name
    ctx.fillStyle = '#f6e9c8';
    ctx.font = 'bold 18px ui-sans-serif';
    ctx.fillText(item.name, contentX, contentY);

    // Hotkey
    if (item.key) {
      ctx.fillStyle = '#a08860';
      ctx.font = '13px ui-sans-serif';
      ctx.fillText(`[${item.key.toUpperCase()}]`, contentX, contentY + 18);
    }

    // Description (stats)
    ctx.fillStyle = '#d4c4a0';
    ctx.font = '14px ui-sans-serif';
    wrapTextConstrained(item.desc, contentX, contentY + 38, contentWidth, 17, 2);

    // Flavor text (max 2 lines, smaller, italicized)
    if (item.flavor) {
      ctx.fillStyle = '#8a7355';
      ctx.font = 'italic 12px ui-sans-serif';
      wrapTextConstrained(item.flavor, contentX, contentY + 74, contentWidth, 15, 2);
    }

    // Right section: Price and status
    const priceX = rect.x + rect.w - 120;
    const priceY = rect.y + 28;

    // Price
    ctx.textAlign = 'right';
    ctx.fillStyle = affordable ? '#ffd700' : '#8a6040';
    ctx.font = 'bold 20px ui-sans-serif';
    ctx.fillText(`${item.price}g`, priceX + 110, priceY);
    ctx.textAlign = 'left';

    // Status indicators
    ctx.font = '12px ui-sans-serif';
    let statusY = priceY + 24;

    if (owned) {
      ctx.fillStyle = '#7a9fb8';
      ctx.textAlign = 'right';
      ctx.fillText('✓ Owned', priceX + 110, statusY);
      ctx.textAlign = 'left';
      statusY += 16;
    } else if (quantity > 0) {
      ctx.fillStyle = '#9ab8c8';
      ctx.textAlign = 'right';
      ctx.fillText(`${quantity} in bag`, priceX + 110, statusY);
      ctx.textAlign = 'left';
      statusY += 16;
    }

    if (!affordable) {
      ctx.fillStyle = '#c85a48';
      ctx.textAlign = 'right';
      ctx.fillText('Not enough gold', priceX + 110, statusY);
      ctx.textAlign = 'left';
      statusY += 16;
    } else if (!owned && usedSlots >= state.player.inventory.length) {
      ctx.fillStyle = '#d8923c';
      ctx.textAlign = 'right';
      ctx.fillText('Inventory full', priceX + 110, statusY);
      ctx.textAlign = 'left';
    }

    if (item.type === 'passive' && state.shopOwned.has(item.id)) {
      ctx.fillStyle = '#68a88c';
      ctx.textAlign = 'right';
      ctx.fillText('★ Active', priceX + 110, statusY);
      ctx.textAlign = 'left';
    }

    newHitRegions.push({ type: 'item', item, rect });
  });

  // Footer with exit button
  const exitRect = { x: px + pw - 160, y: py + ph - 50, w: 130, h: 36 };
  ctx.fillStyle = getShopHover() === 'exit' ? 'rgba(140,90,50,0.8)' : 'rgba(52,38,24,0.9)';
  ctx.fillRect(exitRect.x, exitRect.y, exitRect.w, exitRect.h);
  ctx.strokeStyle = '#b98a52';
  ctx.lineWidth = 2;
  ctx.strokeRect(exitRect.x + 0.5, exitRect.y + 0.5, exitRect.w - 1, exitRect.h - 1);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f4e2c0';
  ctx.font = 'bold 16px ui-sans-serif';
  ctx.fillText('Leave [ESC]', exitRect.x + 18, exitRect.y + 24);
  newHitRegions.push({ type: 'exit', rect: exitRect });

  setShopHitRegions(newHitRegions);

  ctx.restore();
}

export { drawShop };
