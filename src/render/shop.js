import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { RARITY_COLORS } from '../data/items.js';
import { setShopHitRegions, getShopHover, getShopMousePos, getCurrentShopItems, getCurrentMerchantType, getCurrentVillageIndex } from '../systems/shop.js';
import { drawItemIcon } from './itemIcons.js';
import { getMerchantName, MERCHANT_TYPE } from '../systems/merchants.js';

function drawShop(){
  const shopItems = getCurrentShopItems();

  // Find the merchant NPC we're interacting with
  let merchantNPC = null;
  for (const npc of state.npcs) {
    if (npc.isMerchant) {
      merchantNPC = npc;
      break; // For now, just use the first merchant found
    }
  }

  if (!merchantNPC) return; // No merchant found

  // Calculate shop position relative to merchant (in world space)
  const shopWidth = 420;

  // Calculate dynamic height based on number of items
  const itemCardHeight = 70;
  const rowGap = 8;
  const headerHeight = 50;
  const footerHeight = 45;
  const verticalPadding = 20;
  const shopHeight = headerHeight + (shopItems.length * (itemCardHeight + rowGap)) + footerHeight + verticalPadding;

  // Position shop on the LEFT side of the screen
  const px = 10; // Left edge with small margin

  // Vertically center on merchant position
  const merchantScreenY = merchantNPC.y - state.camera.y;
  const py = Math.max(10, Math.min(H - shopHeight - 10, merchantScreenY - shopHeight / 2));

  ctx.save();

  // Shop panel background
  const panelGrad = ctx.createLinearGradient(px, py, px, py + shopHeight);
  panelGrad.addColorStop(0, '#2a1f15');
  panelGrad.addColorStop(1, '#1f1610');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(px, py, shopWidth, shopHeight);

  // Border
  ctx.strokeStyle = '#8a6d3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, shopWidth - 3, shopHeight - 3);
  ctx.lineWidth = 1;

  // Header section
  ctx.fillStyle = '#f6e9c8';
  ctx.font = 'bold 20px "Trebuchet MS", ui-sans-serif';
  const merchantName = getMerchantName(getCurrentMerchantType(), getCurrentVillageIndex());
  ctx.fillText(merchantName, px + 20, py + 32);

  // Gold display
  ctx.font = 'bold 16px ui-sans-serif';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`💰 ${state.player.gold}g`, px + shopWidth - 100, py + 32);

  // Item grid area - single column, compact layout
  const gridStartY = py + headerHeight;
  const gridPadding = 16;
  const gridWidth = shopWidth - gridPadding * 2;
  const itemCardWidth = gridWidth; // Full width for single column
  const columns = 1; // Single column for compact design
  const gridHeight = shopHeight - headerHeight - footerHeight; // Space for header and footer

  const newHitRegions = [];
  const usedSlots = state.player.inventory.filter(Boolean).length;

  // Draw each item card in a single column layout
  shopItems.forEach((item, idx) => {
    const row = idx; // Single column, so row = index

    const cardX = px + gridPadding;
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
    ctx.lineWidth = hovered ? 2 : 1.5;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    ctx.lineWidth = 1;

    // Compact layout with small icon
    const contentPadding = 10;
    const iconSize = 48;

    // Icon on the left
    const iconX = rect.x + contentPadding;
    const iconY = rect.y + rect.h / 2;

    if (item.icon) {
      drawItemIcon(ctx, item.icon, iconX + iconSize/2, iconY, iconSize);
    }

    // Text area to the right of icon
    const textStartX = iconX + iconSize + 10;
    const textAreaWidth = rect.w - iconSize - contentPadding * 2 - 10;

    // Item name
    ctx.fillStyle = '#f6e9c8';
    ctx.font = 'bold 14px ui-sans-serif';
    let displayName = item.name;
    if (ctx.measureText(displayName).width > textAreaWidth - 80) {
      while (ctx.measureText(displayName + '...').width > textAreaWidth - 80 && displayName.length > 0) {
        displayName = displayName.slice(0, -1);
      }
      displayName += '...';
    }
    ctx.fillText(displayName, textStartX, rect.y + 20);

    // Price (aligned to right)
    const priceX = rect.x + rect.w - contentPadding;
    ctx.textAlign = 'right';
    ctx.fillStyle = affordable ? '#ffd700' : '#8a6040';
    ctx.font = 'bold 14px ui-sans-serif';
    ctx.fillText(`${item.price}g`, priceX, rect.y + 20);
    ctx.textAlign = 'left';

    // Description/stats in one line
    ctx.fillStyle = '#d4c4a0';
    ctx.font = '11px ui-sans-serif';
    let shortDesc = item.desc;
    if (ctx.measureText(shortDesc).width > textAreaWidth) {
      while (ctx.measureText(shortDesc + '...').width > textAreaWidth && shortDesc.length > 0) {
        shortDesc = shortDesc.slice(0, -1);
      }
      shortDesc += '...';
    }
    ctx.fillText(shortDesc, textStartX, rect.y + 38);

    // Hotkey indicator
    if (item.key) {
      ctx.fillStyle = rarityColor;
      ctx.font = 'bold 11px ui-sans-serif';
      ctx.fillText(`[${item.key.toUpperCase()}]`, textStartX, rect.y + 54);
    }

    // Status indicator (right side)
    ctx.font = '11px ui-sans-serif';
    ctx.textAlign = 'right';
    if (owned) {
      ctx.fillStyle = '#7a9fb8';
      ctx.fillText('✓ Owned', priceX, rect.y + 54);
    } else if (quantity > 0) {
      ctx.fillStyle = '#9ab8c8';
      ctx.fillText(`${quantity}x`, priceX, rect.y + 54);
    } else if (!affordable) {
      ctx.fillStyle = '#c85a48';
      ctx.fillText('Not enough gold', priceX, rect.y + 54);
    }
    ctx.textAlign = 'left';

    // "Hover for lore" hint (only if item has flavor text)
    if (item.flavor && hovered) {
      ctx.fillStyle = 'rgba(169, 143, 107, 0.7)';
      ctx.font = '10px ui-sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Hover for lore', priceX, rect.y + rect.h - 6);
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
  const exitRect = { x: px + shopWidth - 125, y: py + shopHeight - 35, w: 110, h: 26 };
  ctx.fillStyle = getShopHover() === 'exit' ? 'rgba(140,90,50,0.8)' : 'rgba(52,38,24,0.9)';
  ctx.fillRect(exitRect.x, exitRect.y, exitRect.w, exitRect.h);
  ctx.strokeStyle = '#b98a52';
  ctx.lineWidth = 2;
  ctx.strokeRect(exitRect.x + 0.5, exitRect.y + 0.5, exitRect.w - 1, exitRect.h - 1);
  ctx.lineWidth = 1;
  ctx.fillStyle = '#f4e2c0';
  ctx.font = 'bold 12px ui-sans-serif';
  ctx.fillText('Leave [ESC]', exitRect.x + 14, exitRect.y + 17);
  newHitRegions.push({ type: 'exit', rect: exitRect });

  setShopHitRegions(newHitRegions);

  ctx.restore();
}

export { drawShop };
