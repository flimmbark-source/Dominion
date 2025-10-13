import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { getPlayerStats } from '../state/playerStats.js';
import { clamp, TAU } from '../utils/math.js';
import { drawItemIcon } from './itemIcons.js';
import { getThreatFraction, getThreatStage } from '../systems/threat.js';

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

function drawHUD(){
  drawThreatIndicator();
  drawWorldEventCallout();
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

  const statsPanelWidth = 168;
  const statsPanelX = barPanelX + barPanelWidth + 12;
  drawPanel(statsPanelX, baseY, statsPanelWidth, panelHeight);

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

  const goldIconX = barPanelX + barPanelWidth - 78;
  ctx.fillStyle = '#ffd25a';
  ctx.font = '15px "Trebuchet MS", system-ui';
  drawCoinIcon(goldIconX, baseY + 102);
  ctx.textAlign = 'left';
  ctx.fillText(`${p.gold}`, goldIconX + 28, baseY + 116);

  const statTextY = baseY + 34;
  const statTextX = statsPanelX + 52;
  ctx.fillStyle = '#cfe1ff';
  ctx.font = '12px "Trebuchet MS", system-ui';
  const previousBaseline = ctx.textBaseline;
  ctx.textBaseline = 'middle';

  const statRows = [
    {
      label: `${Math.round(stats.movementSpeed)}`,
      icon: drawBootIcon
    },
    {
      label: `${Math.round(stats.attackDamage)}`,
      icon: drawSwordIcon
    },
    {
      label: `x${stats.stealthFactor.toFixed(2)}`,
      icon: drawCloakIcon
    }
  ];

  statRows.forEach((row, i) => {
    const lineY = statTextY + i * 30;
    row.icon(statsPanelX + 18, lineY - 20);
    ctx.fillText(row.label, statTextX, lineY - 10);
  });

  ctx.textBaseline = previousBaseline;

  const slotSize = 52;
  const slotCount = 6;
  const slotsWidth = slotCount * slotSize;
  const inventoryPaddingX = 18;
  const inventoryPaddingY = 14;
  const inventoryPanelWidth = slotsWidth + inventoryPaddingX * 2;
  const inventoryPanelHeight = slotSize + inventoryPaddingY * 2;
  const inventoryPanelX = W - inventoryPanelWidth - 16;
  const inventoryPanelY = baseY + (panelHeight - inventoryPanelHeight) / 2;
  drawPanel(inventoryPanelX, inventoryPanelY, inventoryPanelWidth, inventoryPanelHeight);

  const slotsX = inventoryPanelX + inventoryPaddingX;
  const slotY = inventoryPanelY + inventoryPaddingY;
  for (let i=0;i<slotCount;i++){
    const x = slotsX + i*slotSize;
    ctx.fillStyle = '#6e8bb6';
    ctx.font = '11px "Trebuchet MS", system-ui';
    ctx.fillText(String(i+1), x+6, slotY+14);
    const it = state.player.inventory[i];
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

  ctx.restore();
}

function drawWorldEventCallout(){
  const evt = state.activeWorldEvent;
  if (!evt) return;

  const width = 340;
  const height = 76;
  const x = (W - width) / 2;
  const y = 16;
  const remaining = Math.max(0, evt.expiresAt - state.time);

  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = 'rgba(12,18,28,0.92)';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#2a3d58';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.strokeStyle = '#425b7f';
  ctx.lineWidth = 1;
  ctx.strokeRect(4, 4, width - 8, height - 8);

  ctx.fillStyle = '#ffe7a6';
  ctx.font = 'bold 16px "Trebuchet MS", system-ui';
  ctx.textAlign = 'left';
  ctx.fillText(evt.title, 16, 26);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffb27c';
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillText(`${Math.ceil(remaining)}s`, width - 16, 26);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#cfe1ff';
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillText(evt.description, 16, 46);

  ctx.fillStyle = '#8ce4ff';
  ctx.font = '12px "Trebuchet MS", system-ui';
  ctx.fillText(evt.objective, 16, 64);

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
