import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { getPlayerStats } from '../state/playerStats.js';
import { clamp, TAU } from '../utils/math.js';
import {
  setInventorySlotRects,
  getHoveredInventorySlot,
  getHoveredInventoryItem,
  getHoveredInventorySlotRect
} from '../systems/inventoryHover.js';
import { drawItemIcon } from './itemIcons.js';
import { getThreatFraction, getThreatStage } from '../systems/threat.js';
import { getAbilities, getAbilityCooldown } from '../systems/abilities.js';
import { getActiveStatusEffects } from '../systems/statusEffects.js';

function bar(x,y,w,h, frac, fg, bg, border='#1a2636'){
  ctx.fillStyle = bg;
  ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fg;
  ctx.fillRect(x,y, w*clamp(frac,0,1), h);
  ctx.strokeStyle = border;
  ctx.strokeRect(x+.5,y+.5,w-1,h-1);
}

function drawHeartIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#35c46a';
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(0, -2, 12, -2, 12, 6);
  ctx.bezierCurveTo(12, 12, 6, 16, 6, 18);
  ctx.bezierCurveTo(6, 16, 0, 12, 0, 6);
  ctx.fill();
  ctx.restore();
}

function drawDetectionIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#f0c94c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(6, 10, 8, Math.PI*0.1, Math.PI*0.9, false);
  ctx.arc(6, 10, 3, Math.PI*0.9, Math.PI*0.1, true);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(6, 10, 2, 0, Math.PI*2);
  ctx.fillStyle = '#f0c94c';
  ctx.fill();
  ctx.restore();
}

function drawCoinIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#f4d35e';
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI*2);
  ctx.fill();
  ctx.strokeStyle = '#ad8628';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ad8628';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', 8, 8);
  ctx.restore();
}

function drawBootIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#8fb8ff';
  ctx.beginPath();
  ctx.moveTo(2, 4);
  ctx.lineTo(10, 4);
  ctx.lineTo(12, 10);
  ctx.lineTo(18, 12);
  ctx.lineTo(18, 16);
  ctx.lineTo(2, 16);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2c3e5f';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawSwordIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#f7f9ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(6, 18);
  ctx.stroke();
  ctx.strokeStyle = '#d08f36';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(3, 14);
  ctx.lineTo(13, 14);
  ctx.stroke();
  ctx.restore();
}

function drawCloakIcon(x, y){
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#5fd1b5';
  ctx.beginPath();
  ctx.moveTo(10, 2);
  ctx.quadraticCurveTo(16, 6, 18, 14);
  ctx.quadraticCurveTo(12, 18, 6, 14);
  ctx.quadraticCurveTo(4, 8, 10, 2);
  ctx.fill();
  ctx.strokeStyle = '#1f715d';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawPanel(x, y, w, h){
  ctx.fillStyle = 'rgba(12,18,28,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1f2b3e';
  ctx.lineWidth = 2;
  ctx.strokeRect(x+1, y+1, w-2, h-2);
  ctx.strokeStyle = '#3c5577';
  ctx.lineWidth = 1;
  ctx.strokeRect(x+4, y+4, w-8, h-8);
}

function drawComboCounter(){
  const p = state.player;
  if (!p.combo || p.combo.count < 2) return;  // Only show combo at 2+ hits

  const timeSinceHit = state.time - p.combo.lastHitTime;
  const comboTimeout = 2.0;  // Should match COMBO_TIMEOUT in combat.js
  if (timeSinceHit > comboTimeout) return;  // Combo expired

  // Calculate fade out near end of combo timeout
  const fadeStart = comboTimeout * 0.7;
  let alpha = 1.0;
  if (timeSinceHit > fadeStart) {
    alpha = 1.0 - ((timeSinceHit - fadeStart) / (comboTimeout - fadeStart));
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  // Position at top center of screen
  const centerX = W / 2;
  const y = 120;

  // Draw combo text
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Combo count - larger and flashier
  ctx.font = 'bold 48px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#ff9f1c';
  ctx.shadowColor = 'rgba(255, 159, 28, 0.8)';
  ctx.shadowBlur = 16;
  ctx.fillText(`${p.combo.count}x`, centerX, y);
  ctx.shadowBlur = 0;

  // "COMBO" text below
  ctx.font = 'bold 20px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#ffe0a0';
  ctx.fillText('COMBO', centerX, y + 35);

  // Damage bonus text
  const damageBonus = Math.round(p.combo.count * 10);
  ctx.font = 'bold 14px "Trebuchet MS", system-ui';
  ctx.fillStyle = '#ffd25a';
  ctx.fillText(`+${damageBonus}% Damage`, centerX, y + 55);

  ctx.restore();
}

function drawStatusEffects(){
  const p = state.player;
  const effects = getActiveStatusEffects(p);
  if (!effects || effects.length === 0) return;

  const iconSize = 32;
  const iconSpacing = 6;
  const startX = 100;
  const y = 20;

  ctx.save();

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];
    const x = startX + i * (iconSize + iconSpacing);

    // Draw background
    ctx.fillStyle = 'rgba(12, 18, 28, 0.85)';
    ctx.fillRect(x, y, iconSize, iconSize);

    // Draw border with effect color
    ctx.strokeStyle = effect.visual.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, iconSize - 2, iconSize - 2);

    // Draw icon/text
    ctx.fillStyle = effect.visual.color;
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(effect.visual.icon, x + iconSize / 2, y + iconSize / 2);

    // Draw timer
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(Math.ceil(effect.remaining), x + iconSize / 2, y + iconSize - 2);

    // Draw stacks if applicable
    if (effect.strength > 1) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`x${Math.floor(effect.strength)}`, x + iconSize - 3, y + 3);
    }
  }

  ctx.restore();
}

function drawAbilityBar(panelX, panelY, panelWidth, panelHeight){
  const p = state.player;
  const abilities = getAbilities(p);
  if (!abilities || abilities.length === 0) return;

  // Draw panel background
  drawPanel(panelX, panelY, panelWidth, panelHeight);

  const slotSize = 52;
  const slotSpacing = 6;
  const totalWidth = abilities.length * slotSize + (abilities.length - 1) * slotSpacing;
  const startX = panelX + (panelWidth - totalWidth) / 2;
  const y = panelY + (panelHeight - slotSize) / 2;

  ctx.save();

  for (let i = 0; i < abilities.length; i++) {
    const ability = abilities[i];
    const x = startX + i * (slotSize + slotSpacing);
    const cooldown = getAbilityCooldown(p, ability.id);

    // Draw slot background
    ctx.fillStyle = ability.isReady ? 'rgba(20, 30, 48, 0.92)' : 'rgba(12, 18, 28, 0.92)';
    ctx.fillRect(x, y, slotSize, slotSize);

    // Draw border
    ctx.strokeStyle = ability.isReady ? '#4a7ba7' : '#2a3a52';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, slotSize - 2, slotSize - 2);

    // Draw cooldown overlay
    if (!ability.isReady && cooldown.fraction > 0) {
      const overlayHeight = slotSize * cooldown.fraction;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y, slotSize, overlayHeight);

      // Cooldown text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px "Trebuchet MS", system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.ceil(cooldown.remaining), x + slotSize / 2, y + slotSize / 2);
    }

    // Draw keybind
    ctx.fillStyle = ability.isReady ? '#ffffff' : '#6a7a92';
    ctx.font = 'bold 12px "Trebuchet MS", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(ability.keybind.toUpperCase(), x + slotSize / 2, y + 6);

    // Draw ability name below slot
    ctx.fillStyle = ability.isReady ? '#d0e0ff' : '#6a7a92';
    ctx.font = '10px "Trebuchet MS", system-ui';
    ctx.textBaseline = 'top';
    ctx.fillText(ability.name.split(' ')[0], x + slotSize / 2, y + slotSize + 4);
  }

  ctx.restore();
}

function drawHUD(){
  drawThreatIndicator();
  drawComboCounter();
  drawStatusEffects();

  const panelHeight = 128;
  const baseY = H - panelHeight - 12;
  ctx.save();

  ctx.fillStyle = 'rgba(5,7,11,0.6)';
  ctx.fillRect(0, baseY - 6, W, panelHeight + 18);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const barPanelX = 16;
  const barPanelWidth = 304;
  drawPanel(barPanelX, baseY, barPanelWidth, panelHeight);

  const p = state.player;
  const stats = getPlayerStats(p);
  const maxHealth = stats.maxHealth || 1;
  const barWidth = 220;

  drawHeartIcon(32, baseY + 20);
  bar(52, baseY + 14, barWidth, 20, p.health/maxHealth, '#35c46a', '#1f2c3d');
  ctx.fillStyle = '#d4ffe6';
  ctx.font = '13px "Trebuchet MS", system-ui';
  ctx.fillText('Health', 52, baseY + 50);
  ctx.fillStyle = '#9ff3c3';
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillText(`${Math.round(p.health)} / ${Math.round(maxHealth)}`, 140, baseY + 50);

  drawDetectionIcon(32, baseY + 70);
  bar(52, baseY + 64, barWidth, 16, p.detection/100, '#f0c94c', '#1f2c3d');
  ctx.fillStyle = '#fff2c7';
  ctx.font = '13px "Trebuchet MS", system-ui';
  ctx.fillText('Stealth', 52, baseY + 96);
  ctx.fillStyle = '#ffe299';
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillText(`${Math.max(0, 100 - Math.round(p.detection))}% hidden`, 140, baseY + 96);

  // Gold and stats in same panel
  const goldIconX = 32;
  const goldY = baseY + 102;
  ctx.fillStyle = '#ffd25a';
  ctx.font = '15px "Trebuchet MS", system-ui';
  drawCoinIcon(goldIconX, goldY);
  ctx.textAlign = 'left';
  ctx.fillText(`${p.gold}`, goldIconX + 28, goldY + 14);

  // Stats next to gold - moved down for better spacing
  const statsStartX = 120;
  const statsY = baseY + 106; // Increased from 96 for more padding
  ctx.fillStyle = '#cfe1ff';
  ctx.font = '11px "Trebuchet MS", system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Speed
  drawBootIcon(statsStartX, statsY);
  ctx.fillText(`${Math.round(stats.movementSpeed)}`, statsStartX + 24, statsY + 8);

  // Attack
  drawSwordIcon(statsStartX + 68, statsY);
  ctx.fillText(`${Math.round(stats.attackDamage)}`, statsStartX + 92, statsY + 8);

  // Stealth
  drawCloakIcon(statsStartX + 136, statsY);
  ctx.fillText(`x${stats.stealthFactor.toFixed(2)}`, statsStartX + 160, statsY + 8);

  ctx.textBaseline = 'alphabetic';

  // Calculate inventory panel position first
  const slotSize = 52;
  const slotCount = 6;
  const slotsWidth = slotCount * slotSize;
  const inventoryPaddingX = 18;
  const inventoryPaddingY = 14;
  const inventoryPanelWidth = slotsWidth + inventoryPaddingX * 2;
  const inventoryPanelHeight = slotSize + inventoryPaddingY * 2;
  const inventoryPanelX = W - inventoryPanelWidth - 16;
  const inventoryPanelY = baseY + (panelHeight - inventoryPanelHeight) / 2;

  // Position abilities panel between HP panel and inventory
  const abilitiesPanelWidth = 168;
  const abilitiesPanelX = inventoryPanelX - abilitiesPanelWidth - 12;

  // Draw abilities panel
  drawAbilityBar(abilitiesPanelX, baseY, abilitiesPanelWidth, panelHeight);

  // Draw inventory panel
  drawPanel(inventoryPanelX, inventoryPanelY, inventoryPanelWidth, inventoryPanelHeight);

  const slotsX = inventoryPanelX + inventoryPaddingX;
  const slotY = inventoryPanelY + inventoryPaddingY;
  const slotRects = [];
  const hoveredSlot = state.pausedForShop ? null : getHoveredInventorySlot();
  for (let i=0;i<slotCount;i++){
    const x = slotsX + i*slotSize;
    ctx.fillStyle = '#6e8bb6';
    ctx.font = '11px "Trebuchet MS", system-ui';
    ctx.fillText(String(i+1), x+6, slotY+14);
    slotRects.push({ x, y: slotY, w: slotSize, h: slotSize });
    const it = state.player.inventory[i];
    if (hoveredSlot === i && it){
      ctx.strokeStyle = '#ffd25a';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 3.5, slotY + 3.5, slotSize - 7, slotSize - 7);
      ctx.lineWidth = 1;
    }
    if (it){
      if (it.icon){
        drawItemIcon(ctx, it.icon, x + 24, slotY + 24, 32);
      } else {
        ctx.fillStyle = '#d7e6ff';
        ctx.font = '12px "Trebuchet MS", system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = it.name.split(' ').map(w=>w[0]).join('').slice(0,3);
        ctx.fillText(label, x + 24, slotY + 26);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }
  setInventorySlotRects(slotRects);

  const hoveredItem = hoveredSlot === null ? null : getHoveredInventoryItem();
  const hoveredRect = hoveredSlot === null ? null : getHoveredInventorySlotRect();
  if (hoveredItem && hoveredRect){
    const paddingX = 12;
    const paddingY = 10;
    const lineHeight = 16;
    const titleLineHeight = 20;
    const titleFont = '13px "Trebuchet MS", system-ui';
    const bodyFont = '12px "Trebuchet MS", system-ui';
    const title = hoveredItem.name || 'Unknown Item';
    const descText = hoveredItem.desc || '';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = titleFont;
    const titleWidth = ctx.measureText(title).width;
    ctx.font = bodyFont;
    const words = descText ? descText.split(/\s+/g) : [];
    const lines = [];
    let current = '';
    const maxWidth = 220;
    for (const word of words){
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth){
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    const lineWidths = lines.map(line => ctx.measureText(line).width);
    const textWidth = Math.max(titleWidth, lineWidths.length ? Math.max(...lineWidths) : 0);
    const boxWidth = Math.min(Math.max(textWidth + paddingX * 2, 160), 280);
    let boxHeight = paddingY * 2 + titleLineHeight;
    if (lines.length){
      boxHeight += lines.length * lineHeight + 4;
    }
    const desiredX = hoveredRect.x + hoveredRect.w / 2 - boxWidth / 2;
    const tooltipX = clamp(desiredX, 12, W - boxWidth - 12);
    let tooltipY = hoveredRect.y - boxHeight - 12;
    if (tooltipY < 12){
      tooltipY = hoveredRect.y + hoveredRect.h + 12;
    }

    ctx.fillStyle = 'rgba(15, 20, 32, 0.92)';
    ctx.fillRect(tooltipX, tooltipY, boxWidth, boxHeight);
    ctx.strokeStyle = 'rgba(120, 164, 255, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tooltipX + 0.5, tooltipY + 0.5, boxWidth - 1, boxHeight - 1);
    let textY = tooltipY + paddingY;
    ctx.font = titleFont;
    ctx.fillStyle = '#ffe0a0';
    ctx.fillText(title, tooltipX + paddingX, textY);
    textY += titleLineHeight;
    if (lines.length){
      ctx.font = bodyFont;
      ctx.fillStyle = '#e6efff';
      lines.forEach((line, index) => {
        ctx.fillText(line, tooltipX + paddingX, textY + index * lineHeight);
      });
    }
    ctx.textBaseline = 'alphabetic';
  }

  ctx.restore();
}

function drawThreatIndicator(){
  const stage = getThreatStage();
  const fraction = getThreatFraction();
  const gaugeColors = ['#5f7fa6', '#7db3d8', '#ffc971', '#ff745c', '#ff2a44'];

  ctx.save();
  ctx.translate(16, 16);

  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  ctx.fillRect(0, 0, 72, 72);
  ctx.strokeStyle = 'rgba(48, 66, 96, 0.95)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 70, 70);

  ctx.save();
  ctx.translate(36, 36);

  ctx.strokeStyle = 'rgba(24, 36, 56, 0.7)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, TAU);
  ctx.stroke();

  ctx.strokeStyle = gaugeColors[stage];
  ctx.beginPath();
  ctx.arc(0, 0, 26, -Math.PI/2, -Math.PI/2 + TAU * fraction, false);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(140, 160, 200, 0.35)';
  ctx.lineWidth = 1.6;
  for (let i=0;i<5;i++){
    const ang = -Math.PI/2 + TAU * (i / 5);
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * 22, Math.sin(ang) * 22);
    ctx.lineTo(Math.cos(ang) * 26, Math.sin(ang) * 26);
    ctx.stroke();
  }

  drawThreatEyeIcon(stage);

  ctx.restore();

  ctx.restore();
}

function drawThreatEyeIcon(stage){
  const eyelidOpen = [4, 8, 14, 16, 18];
  const scleraColors = ['#1c2739', '#24344c', '#ffe7d0', '#ffdbc5', '#2a0101'];
  const irisColors = ['#2a3e5b', '#3d6188', '#ff806f', '#ff4b3f', '#1d0000'];
  const highlightColors = ['#87aed8', '#aed8ff', '#ffeedd', '#ffe2d7', '#ffd6ff'];

  if (stage === 0){
    ctx.strokeStyle = '#7b95bf';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(0, -10, 22, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.quadraticCurveTo(0, 8, 22, 0);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = scleraColors[stage];
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, eyelidOpen[stage], 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = irisColors[stage];
  ctx.beginPath();
  ctx.ellipse(0, 0, 11 + stage, Math.max(6, eyelidOpen[stage] - 2), 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = stage >= 3 ? '#0b0002' : '#061018';
  ctx.beginPath();
  ctx.ellipse(0, 0, Math.max(4, 8 + stage - 4), Math.max(4, eyelidOpen[stage] - 6), 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = highlightColors[stage];
  ctx.beginPath();
  ctx.arc(6 - stage, -4 - stage * 0.5, 3, 0, TAU);
  ctx.fill();

  if (stage >= 3){
    const flameColor = stage === 3 ? 'rgba(255, 112, 92, 0.6)' : 'rgba(190, 0, 30, 0.65)';
    ctx.strokeStyle = flameColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -eyelidOpen[stage] + 2);
    ctx.lineTo(-30, -eyelidOpen[stage] - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, -eyelidOpen[stage] + 2);
    ctx.lineTo(30, -eyelidOpen[stage] - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-18, eyelidOpen[stage] - 2);
    ctx.lineTo(-26, eyelidOpen[stage] + 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(18, eyelidOpen[stage] - 2);
    ctx.lineTo(26, eyelidOpen[stage] + 6);
    ctx.stroke();
  }
}

export { drawHUD };
