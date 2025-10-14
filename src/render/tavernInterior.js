import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { TAVERN_INTERIOR } from '../state/tavern.js';
import { TAU } from '../utils/math.js';
import { drawGoblin } from './goblin.js';
import { getBarkeepDialogueState } from '../systems/barkeepMissions.js';

const toneStyles = {
  body: { font: '14px "Trebuchet MS", ui-sans-serif', fill: '#f4ffdf', lineHeight: 20 },
  muted: { font: '13px "Trebuchet MS", ui-sans-serif', fill: '#9fb3cc', lineHeight: 18 },
  highlight: { font: '14px "Trebuchet MS", ui-sans-serif', fill: '#ffde7b', lineHeight: 20 },
  note: { font: '13px "Trebuchet MS", ui-sans-serif', fill: '#9fd6c9', lineHeight: 18 },
  title: { font: '16px "Trebuchet MS", ui-sans-serif', fill: '#ffefb3', lineHeight: 22 }
};

function wrapTextLines(text, font, maxWidth){
  if (!text || !text.trim()) return [];
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words){
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current){
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawBarkeepConversationCard(barkeep, conversation){
  if (!conversation) return;

  const promptW = 340;
  const paddingX = 16;
  const paddingY = 14;
  const maxWidth = promptW - paddingX * 2;
  const header = { text: conversation.title || 'Moonlit Barkeep', font: '15px "Trebuchet MS", ui-sans-serif', fill: '#8bd66e', lineHeight: 22 };

  const lineEntries = [header];

  const addGap = (height = 8) => {
    lineEntries.push({ text: '', font: header.font, fill: 'transparent', lineHeight: height, skip: true });
  };

  if (Array.isArray(conversation.body)){
    for (const segment of conversation.body){
      if (!segment) continue;
      const style = toneStyles[segment.tone] || toneStyles.body;
      if (!segment.text || !segment.text.trim()){ addGap(style.lineHeight / 2); continue; }
      const lines = wrapTextLines(segment.text, style.font, maxWidth);
      if (!lines.length){ addGap(style.lineHeight / 2); continue; }
      for (const line of lines){
        lineEntries.push({ text: line, font: style.font, fill: style.fill, lineHeight: style.lineHeight });
      }
    }
  }

  if (Array.isArray(conversation.options) && conversation.options.length){
    addGap(10);
    for (const option of conversation.options){
      const style = toneStyles[option.tone] || toneStyles.body;
      const label = option.label || '';
      const lineText = `[${option.key}] ${label}`;
      const lines = wrapTextLines(lineText, style.font, maxWidth);
      const fill = option.disabled ? 'rgba(120,136,160,0.6)' : style.fill;
      if (!lines.length){ lineEntries.push({ text: lineText, font: style.font, fill, lineHeight: style.lineHeight }); continue; }
      for (const line of lines){
        lineEntries.push({ text: line, font: style.font, fill, lineHeight: style.lineHeight });
      }
    }
  }

  if (conversation.footer){
    addGap(8);
    const footerFont = '12px "Trebuchet MS", ui-sans-serif';
    const footerLines = wrapTextLines(conversation.footer, footerFont, maxWidth);
    if (!footerLines.length){ footerLines.push(conversation.footer); }
    for (const line of footerLines){
      lineEntries.push({ text: line, font: footerFont, fill: '#9fd6ff', lineHeight: 16 });
    }
  }

  const totalHeight = lineEntries.reduce((sum, entry)=> sum + (entry.lineHeight || 0), 0);
  const promptH = paddingY * 2 + totalHeight;
  const promptX = Math.round(barkeep.x - promptW / 2);
  const desiredY = barkeep.y - barkeep.radius - promptH - 24;
  const promptY = Math.max(12, Math.round(desiredY));

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(14, 20, 32, 0.92)';
  ctx.fillRect(promptX, promptY, promptW, promptH);
  ctx.strokeStyle = '#5cc16d';
  ctx.strokeRect(promptX + 0.5, promptY + 0.5, promptW - 1, promptH - 1);

  let cursorY = promptY + paddingY;
  const textX = promptX + paddingX;
  for (const entry of lineEntries){
    if (!entry) continue;
    if (entry.skip){
      cursorY += entry.lineHeight || 0;
      continue;
    }
    ctx.font = entry.font;
    ctx.fillStyle = entry.fill;
    ctx.fillText(entry.text, textX, cursorY);
    cursorY += entry.lineHeight || 0;
  }

  ctx.restore();
}

function drawTavernInteriorScene(){
  const p = state.player;
  const config = TAVERN_INTERIOR;
  const offsetX = (W - config.width) / 2;
  const offsetY = (H - config.height) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  const floorGrad = ctx.createLinearGradient(0, 0, 0, config.height);
  floorGrad.addColorStop(0, '#17101f');
  floorGrad.addColorStop(1, '#100913');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, config.width, config.height);

  ctx.fillStyle = '#2c1f2e';
  ctx.fillRect(0, 0, config.width, config.wallThickness);
  ctx.fillRect(0, 0, config.wallThickness, config.height);
  ctx.fillRect(config.width - config.wallThickness, 0, config.wallThickness, config.height);
  const exit = config.exit;
  const gap = config.exitBuffer;
  const leftWallW = Math.max(0, exit.x - gap);
  if (leftWallW > 0){
    ctx.fillRect(0, config.height - config.wallThickness, leftWallW, config.wallThickness);
  }
  const rightWallX = exit.x + exit.w + gap;
  const rightWallW = Math.max(0, config.width - rightWallX);
  if (rightWallW > 0){
    ctx.fillRect(rightWallX, config.height - config.wallThickness, rightWallW, config.wallThickness);
  }

  const exitCx = exit.x + exit.w / 2;
  const exitCy = exit.y + exit.h / 2;
  const exitGlow = ctx.createRadialGradient(exitCx, exitCy, 8, exitCx, exitCy, 96);
  exitGlow.addColorStop(0, 'rgba(120, 200, 255, 0.3)');
  exitGlow.addColorStop(1, 'rgba(12, 20, 32, 0)');
  ctx.fillStyle = exitGlow;
  ctx.beginPath();
  ctx.arc(exitCx, exitCy, 96, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#1f1a29';
  ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fd6ff';
  ctx.font = '14px "Trebuchet MS", ui-sans-serif';
  ctx.fillText('To the glade', exitCx, exit.y + exit.h + 26);
  ctx.restore();

  const shelves = config.shelves;
  ctx.fillStyle = '#251724';
  ctx.fillRect(shelves.x - 12, shelves.y - 16, shelves.w + 24, shelves.h + 32);
  ctx.fillStyle = '#2f1c2d';
  ctx.fillRect(shelves.x, shelves.y, shelves.w, shelves.h);
  const bottlePalette = ['#71f0ad', '#9ec9ff', '#f7a6ff'];
  for (let i = 0; i < 12; i++){
    const t = i / 11;
    const bx = shelves.x + 12 + t * (shelves.w - 24);
    const bh = 14 + Math.sin(state.time * 1.4 + i) * 2;
    ctx.fillStyle = bottlePalette[i % bottlePalette.length];
    ctx.fillRect(bx, shelves.y + shelves.h - bh - 4, 6, bh);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx + 2, shelves.y + shelves.h - bh - 2, 2, bh - 4);
  }

  const bar = config.barRect;
  ctx.fillStyle = '#3f271b';
  ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
  ctx.strokeStyle = '#724d2e';
  ctx.strokeRect(bar.x + 0.5, bar.y + 0.5, bar.w - 1, bar.h - 1);
  ctx.fillStyle = 'rgba(120, 78, 45, 0.4)';
  ctx.fillRect(bar.x, bar.y - 12, bar.w, 12);

  for (let i = -2; i <= 2; i++){
    const stoolX = bar.x + bar.w/2 + i * 58;
    const stoolY = bar.y + bar.h + 20;
    ctx.fillStyle = '#2b1d26';
    ctx.beginPath();
    ctx.ellipse(stoolX, stoolY, 22, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#5f3c2b';
    ctx.beginPath();
    ctx.ellipse(stoolX, stoolY - 6, 18, 8, 0, 0, TAU);
    ctx.fill();
  }

  config.tables.forEach((tbl, idx)=>{
    const wobble = Math.sin(state.time * 1.2 + idx) * 2;
    ctx.save();
    ctx.translate(tbl.x, tbl.y + wobble);
    ctx.fillStyle = '#2d1d26';
    ctx.beginPath();
    ctx.ellipse(0, 0, 52, 30, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#6b4240';
    ctx.stroke();
    for (let m = 0; m < 3; m++){
      const ang = (m / 3) * TAU;
      const mx = Math.cos(ang) * 20;
      const my = Math.sin(ang) * 12;
      ctx.fillStyle = '#d7c69a';
      ctx.beginPath();
      ctx.ellipse(mx, my - 4, 8, 5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.ellipse(mx + 2, my - 6, 3, 3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });

  config.patrons.forEach((patron)=>{
    const bob = Math.sin(state.time * 1.8 + patron.sway) * 4;
    if (patron.type === 'fairy'){
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = patron.color;
      ctx.beginPath();
      ctx.arc(patron.x, patron.y + bob - 18, 28, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = patron.color;
      ctx.beginPath();
      ctx.arc(patron.x, patron.y + bob - 18, 10, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#f4f0ff';
      ctx.beginPath();
      ctx.arc(patron.x, patron.y + bob - 2, 6, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = patron.color;
      ctx.beginPath();
      ctx.arc(patron.x, patron.y + bob, 14, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#2f1e1c';
      ctx.beginPath();
      ctx.arc(patron.x, patron.y + bob + 14, 12, 0, TAU);
      ctx.fill();
    }
  });

  const barkeep = config.barkeep;
  const barkeepBob = Math.sin(state.time * 1.5) * 2;
  ctx.fillStyle = '#47b96f';
  ctx.beginPath();
  ctx.arc(barkeep.x, barkeep.y + barkeepBob, barkeep.radius + 2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2b753f';
  ctx.beginPath();
  ctx.arc(barkeep.x, barkeep.y + barkeepBob + barkeep.radius * 0.6, barkeep.radius * 0.9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0d140f';
  ctx.beginPath();
  ctx.arc(barkeep.x - 6, barkeep.y + barkeepBob - 4, 3, 0, TAU);
  ctx.arc(barkeep.x + 6, barkeep.y + barkeepBob - 4, 3, 0, TAU);
  ctx.fill();

  if (!p.dead){
    const invisible = state.time < p.invisUntil;
    drawGoblin(ctx, p, { time: state.time, invisible });
  }

  const conversation = getBarkeepDialogueState();
  if (conversation && !state.pausedForShop){
    drawBarkeepConversationCard(barkeep, conversation);
  } else {
    const distToBarkeep = Math.hypot(p.x - barkeep.x, p.y - barkeep.y);
    if (distToBarkeep <= barkeep.interactRadius && !state.pausedForShop){
      const promptW = 260;
      const promptH = 34;
      const promptX = barkeep.x - promptW/2;
      const promptY = barkeep.y - barkeep.radius - 48;
      ctx.fillStyle = 'rgba(18, 26, 38, 0.86)';
      ctx.fillRect(promptX, promptY, promptW, promptH);
      ctx.strokeStyle = '#5cc16d';
      ctx.strokeRect(promptX + 0.5, promptY + 0.5, promptW - 1, promptH - 1);
      ctx.fillStyle = '#f4ffdf';
      ctx.font = '15px "Trebuchet MS", ui-sans-serif';
      ctx.fillText('Press E to speak with the barkeep', promptX + 12, promptY + 22);
    }
  }

  ctx.restore();
}

export { drawTavernInteriorScene };
