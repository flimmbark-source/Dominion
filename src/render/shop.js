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

  // Item grid area (3-column layout)
  const gridStartY = py + 90;
  const gridPadding = 20;
  const gridWidth = pw - gridPadding * 2;
  const itemCardWidth = 250; // 1/3 of original width
  const itemCardHeight = 85; // Vertical layout needs more height
  const columnGap = 15;
  const rowGap = 10;
  const columns = 3;
  const gridHeight = ph - 90 - 55; // Space for header and footer

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

  // Draw each item card in a grid layout
  shopItems.forEach((item, idx) => {
    const col = idx % columns;
    const row = Math.floor(idx / columns);

    const cardX = px + gridPadding + col * (itemCardWidth + columnGap);
    const cardY = gridStartY + row * (itemCardHeight + rowGap);

    // Skip if outside visible area
    if (cardY + itemCardHeight > gridStartY + gridHeight) return;

    const rect = {
      x: cardX,
      y: cardY,
      w: itemCardWidth,
      h: itemCardHeight
    };

    const hovered = getShopHover() === item.id;
    const affordable = state.player.gold >= item.price;
    const owned = item.canBuy ? !item.canBuy(state.player) : false;
    const quantity = state.player.inventory.filter(it => it && it.id === item.id).length;

    // Card background
    ctx.fillStyle = hovered ? 'rgba(60,45,28,0.9)' : 'rgba(28,20,14,0.85)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

    // Rarity border
    const rarityColor = RARITY_COLORS[item.rarity] || '#8a6d3a';
    ctx.strokeStyle = hovered ? '#f4d76a' : rarityColor;
    ctx.lineWidth = hovered ? 3 : 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    ctx.lineWidth = 1;

    // Vertical stacked layout
    const contentPadding = 8;
    const contentWidth = rect.w - contentPadding * 2;
    let cursorY = rect.y + contentPadding + 10;

    // Item name with truncation
    ctx.fillStyle = '#f6e9c8';
    ctx.font = 'bold 12px ui-sans-serif';
    let displayName = item.name;
    if (ctx.measureText(displayName).width > contentWidth) {
      while (ctx.measureText(displayName + '...').width > contentWidth && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    ctx.fillText(displayName, rect.x + contentPadding, cursorY);
    cursorY += 13;

    // Hotkey
    if (item.key) {
      ctx.fillStyle = '#a08860';
      ctx.font = '9px ui-sans-serif';
      ctx.fillText(`[${item.key.toUpperCase()}]`, rect.x + contentPadding, cursorY);
      cursorY += 11;
    }

    // Description (single line)
    ctx.fillStyle = '#d4c4a0';
    ctx.font = '10px ui-sans-serif';
    let desc = item.desc;
    if (ctx.measureText(desc).width > contentWidth) {
      while (ctx.measureText(desc + '...').width > contentWidth && desc.length > 0) {
        desc = desc.slice(0, -1);
      }
      desc += '...';
    }
    ctx.fillText(desc, rect.x + contentPadding, cursorY);
    cursorY += 14;

    // Price
    ctx.fillStyle = affordable ? '#ffd700' : '#8a6040';
    ctx.font = 'bold 13px ui-sans-serif';
    ctx.fillText(`${item.price}g`, rect.x + contentPadding, cursorY);
    cursorY += 12;

    // Status indicators (single line, icons)
    ctx.font = '8px ui-sans-serif';
    if (owned) {
      ctx.fillStyle = '#7a9fb8';
      ctx.fillText('✓ Owned', rect.x + contentPadding, cursorY);
    } else if (quantity > 0) {
      ctx.fillStyle = '#9ab8c8';
      ctx.fillText(`${quantity}x`, rect.x + contentPadding, cursorY);
    } else if (!affordable) {
      ctx.fillStyle = '#c85a48';
      ctx.fillText('No gold', rect.x + contentPadding, cursorY);
    } else if (!owned && usedSlots >= state.player.inventory.length) {
      ctx.fillStyle = '#d8923c';
      ctx.fillText('Bag full', rect.x + contentPadding, cursorY);
    }

    if (item.type === 'passive' && state.shopOwned.has(item.id)) {
      ctx.fillStyle = '#68a88c';
      ctx.fillText('★', rect.x + rect.w - contentPadding - 10, cursorY);
    }

    newHitRegions.push({ type: 'item', item, rect });
  });

  // Hover tooltip for flavor text
  const hoveredItem = shopItems.find(item => getShopHover() === item.id);
  if (hoveredItem && hoveredItem.flavor) {
    const tooltip = {
      text: hoveredItem.flavor,
      maxWidth: 320,
      padding: 12
    };

    // Measure text to calculate tooltip size
    ctx.font = 'italic 13px ui-sans-serif';
    const words = tooltip.text.split(' ');
    let lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > tooltip.maxWidth - tooltip.padding * 2) {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineHeight = 16;
    const tooltipWidth = tooltip.maxWidth;
    const tooltipHeight = tooltip.padding * 2 + lines.length * lineHeight;

    // Position tooltip to the right of the panel, centered vertically
    const tooltipX = px + pw + 20;
    const tooltipY = py + ph / 2 - tooltipHeight / 2;

    // Tooltip background
    ctx.fillStyle = 'rgba(20,15,10,0.95)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Tooltip border
    ctx.strokeStyle = '#8a7355';
    ctx.lineWidth = 2;
    ctx.strokeRect(tooltipX + 1, tooltipY + 1, tooltipWidth - 2, tooltipHeight - 2);
    ctx.lineWidth = 1;

    // Render flavor text
    ctx.fillStyle = '#d4c4a0';
    ctx.font = 'italic 13px ui-sans-serif';
    lines.forEach((line, idx) => {
      ctx.fillText(line, tooltipX + tooltip.padding, tooltipY + tooltip.padding + 12 + idx * lineHeight);
    });
  }

  // Footer with exit button
  const exitRect = { x: px + pw - 145, y: py + ph - 45, w: 120, h: 32 };
  ctx.fillStyle = getShopHover() === 'exit' ? 'rgba(140,90,50,0.8)' : 'rgba(52,38,24,0.9)';
  ctx.fillRect(exitRect.x, exitRect.y, exitRect.w, exitRect.h);
  ctx.strokeStyle = '#b98a52';
  ctx.lineWidth = 2;
  ctx.strokeRect(exitRect.x + 0.5, exitRect.y + 0.5, exitRect.w - 1, exitRect.h - 1);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f4e2c0';
  ctx.font = 'bold 15px ui-sans-serif';
  ctx.fillText('Leave [ESC]', exitRect.x + 16, exitRect.y + 21);
  newHitRegions.push({ type: 'exit', rect: exitRect });

  setShopHitRegions(newHitRegions);

  ctx.restore();
}

export { drawShop };
