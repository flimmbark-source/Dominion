import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { RARITY_COLORS } from '../data/items.js';
import { setShopHitRegions, getShopHover, getShopMousePos, getCurrentShopItems } from '../systems/shop.js';
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

  // Item grid area (2-column layout for comfortable viewing)
  const gridStartY = py + 90;
  const gridPadding = 24;
  const gridWidth = pw - gridPadding * 2;
  const itemCardWidth = 378; // Comfortable card width for readability
  const itemCardHeight = 150; // Enough space for icon and text
  const columnGap = 16;
  const rowGap = 14;
  const columns = 2; // 2 columns = larger cards, better readability
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

    // Proper gaming UI layout with icon
    const contentPadding = 16;
    const iconSize = 64;

    // Icon on the left
    const iconX = rect.x + contentPadding;
    const iconY = rect.y + rect.h / 2;

    if (item.icon) {
      drawItemIcon(ctx, item.icon, iconX + iconSize/2, iconY, iconSize);
    }

    // Text area to the right of icon
    const textStartX = iconX + iconSize + 14;
    const textAreaWidth = rect.w - iconSize - contentPadding * 2 - 14;

    // Item name (full, no truncation unless absolutely necessary)
    ctx.fillStyle = '#f6e9c8';
    ctx.font = 'bold 18px ui-sans-serif';
    let displayName = item.name;
    if (ctx.measureText(displayName).width > textAreaWidth) {
      // Only truncate if name is exceptionally long
      while (ctx.measureText(displayName + '...').width > textAreaWidth && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    ctx.fillText(displayName, textStartX, rect.y + contentPadding + 18);

    // Price (aligned to right)
    const priceX = rect.x + rect.w - contentPadding;
    ctx.textAlign = 'right';
    ctx.fillStyle = affordable ? '#ffd700' : '#8a6040';
    ctx.font = 'bold 17px ui-sans-serif';
    ctx.fillText(`${item.price}g`, priceX, rect.y + contentPadding + 18);
    ctx.textAlign = 'left';

    // Rarity and Hotkey
    ctx.fillStyle = rarityColor;
    ctx.font = '13px ui-sans-serif';
    let rarityText = item.rarity ? item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) : 'Common';
    if (item.key) {
      rarityText += ` [${item.key.toUpperCase()}]`;
    }
    ctx.fillText(rarityText, textStartX, rect.y + contentPadding + 40);

    // Item description (effects/stats) - 2 lines max
    ctx.fillStyle = '#d4c4a0';
    ctx.font = '12px ui-sans-serif';
    const descY = rect.y + contentPadding + 58;
    wrapTextConstrained(item.desc, textStartX, descY, textAreaWidth, 14, 2);

    // Status indicators at bottom left
    ctx.font = '13px ui-sans-serif';
    const statusY = rect.y + rect.h - contentPadding - 12;

    if (owned) {
      ctx.fillStyle = '#7a9fb8';
      ctx.fillText('✓ Owned', textStartX, statusY);
    } else if (quantity > 0) {
      ctx.fillStyle = '#9ab8c8';
      ctx.fillText(`${quantity}x in bag`, textStartX, statusY);
    } else if (!affordable) {
      ctx.fillStyle = '#c85a48';
      ctx.fillText('Not enough gold', textStartX, statusY);
    } else if (!owned && usedSlots >= state.player.inventory.length) {
      ctx.fillStyle = '#d8923c';
      ctx.fillText('Inventory full', textStartX, statusY);
    }

    // Active indicator
    if (item.type === 'passive' && state.shopOwned.has(item.id)) {
      ctx.fillStyle = '#68a88c';
      ctx.textAlign = 'right';
      ctx.fillText('★ Active', priceX, statusY);
      ctx.textAlign = 'left';
    }

    // "Hover for lore" hint at bottom (only if item has flavor text)
    if (item.flavor) {
      ctx.fillStyle = 'rgba(169, 143, 107, 0.7)';
      ctx.font = '11px ui-sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Hover for lore', priceX, rect.y + rect.h - contentPadding - 30);
      ctx.textAlign = 'left';
    }

    newHitRegions.push({ type: 'item', item, rect });
  });

  // Hover tooltip for flavor text only
  const hoveredItem = shopItems.find(item => getShopHover() === item.id);
  if (hoveredItem && hoveredItem.flavor) {
    const tooltip = {
      maxWidth: 360,
      padding: 16
    };

    // Build tooltip content sections
    const sections = [];

    // Flavor text section
    sections.push({ text: hoveredItem.flavor, font: 'italic 14px ui-sans-serif', color: '#b89968' });

    // Calculate all lines for all sections
    let allLines = [];
    sections.forEach((section, sectionIdx) => {
      ctx.font = section.font;
      const words = section.text.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > tooltip.maxWidth - tooltip.padding * 2) {
          if (currentLine) allLines.push({ text: currentLine, font: section.font, color: section.color });
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) allLines.push({ text: currentLine, font: section.font, color: section.color });

      // Add spacing between sections
      if (sectionIdx < sections.length - 1) {
        allLines.push({ text: '', font: section.font, color: section.color });
      }
    });

    const lineHeight = 18;
    const tooltipWidth = tooltip.maxWidth;
    const tooltipHeight = tooltip.padding * 2 + allLines.length * lineHeight;

    // Position tooltip at cursor with offset
    const mousePos = getShopMousePos();
    const offsetX = 15; // Offset from cursor
    const offsetY = 15;
    let tooltipX = mousePos.x + offsetX;
    let tooltipY = mousePos.y + offsetY;

    // Prevent tooltip from going off screen edges
    if (tooltipX + tooltipWidth > W) {
      tooltipX = mousePos.x - tooltipWidth - offsetX; // Position to left of cursor
    }
    if (tooltipY + tooltipHeight > H) {
      tooltipY = H - tooltipHeight - 10; // Clamp to bottom with margin
    }
    if (tooltipX < 0) {
      tooltipX = 10; // Minimum left margin
    }
    if (tooltipY < 0) {
      tooltipY = 10; // Minimum top margin
    }

    // Tooltip background
    ctx.fillStyle = 'rgba(20,15,10,0.95)';
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);

    // Tooltip border with rarity color
    const rarityColor = RARITY_COLORS[hoveredItem.rarity] || '#8a6d3a';
    ctx.strokeStyle = rarityColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(tooltipX + 1, tooltipY + 1, tooltipWidth - 2, tooltipHeight - 2);
    ctx.lineWidth = 1;

    // Render all lines
    allLines.forEach((line, idx) => {
      if (line.text) {
        ctx.fillStyle = line.color;
        ctx.font = line.font;
        ctx.fillText(line.text, tooltipX + tooltip.padding, tooltipY + tooltip.padding + 14 + idx * lineHeight);
      }
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
