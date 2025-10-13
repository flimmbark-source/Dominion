import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { TAVERN_INTERIOR } from '../state/tavern.js';
import { TAU } from '../utils/math.js';
import { drawGoblin } from './goblin.js';

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

  const invisible = state.time < p.invisUntil;
  drawGoblin(ctx, p, { time: state.time, invisible });

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

  ctx.restore();
}

export { drawTavernInteriorScene };
