import { ctx } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { TAU } from '../utils/math.js';
import { drawTerrain, drawGoblinTavern } from '../world/terrain.js';
import { getRenderableStairs, fillHouseInterior, interiorFloorColor } from '../world/houses.js';

function drawWorldScene(){
  const p = state.player;

  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);

  drawTerrain();
  drawCastle();

  for (const h of state.houses){
    ctx.fillStyle = '#1b2638';
    ctx.fillRect(h.x, h.y, h.w, h.h);
    ctx.strokeStyle = '#2a3b57';
    ctx.strokeRect(h.x+0.5, h.y+0.5, h.w-1, h.h-1);
  }
  for (const d of state.doors){
    ctx.fillStyle = '#0b0f17';
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.strokeStyle = '#3b4d6a';
    ctx.strokeRect(d.x+0.5, d.y+0.5, d.w-1, d.h-1);
  }

  if (state.interior && state.interior.level === 1) {
    const h = state.houses[state.interior.houseId];
    const col = interiorFloorColor(1);
    if (h && col) fillHouseInterior(h, col);
  }

  const stairsToDraw = getRenderableStairs();
  for (const s of stairsToDraw){
    if (s.treads){
      for (const r of s.treads){
        ctx.fillStyle = '#6b5b3e';
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#a38755';
        ctx.strokeRect(r.x+.5, r.y+.5, r.w-1, r.h-1);
      }
    } else {
      ctx.fillStyle = '#6b5b3e';
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = '#a38755';
      ctx.strokeRect(s.x+.5, s.y+.5, s.w-1, s.h-1);
    }
  }

  drawGoblinTavern();

  for (const c of state.chests){
    if (c.looted) continue;
    if (!state.interior) continue;
    if (c.houseId !== state.interior.houseId || c.level !== state.interior.level) continue;
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(c.x-9, c.y-6, c.w, c.h);
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(c.x-9, c.y-1, c.w, 2);
  }

  for (const npc of state.npcs){
    if (state.debugCones) drawFOV(npc);
    ctx.beginPath();
    ctx.arc(npc.x, npc.y, 8, 0, TAU);
    ctx.fillStyle = npc.type==='scout' ? '#6fa8dc' : '#9aa5b1';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(npc.x, npc.y);
    ctx.lineTo(npc.x + Math.cos(npc.facing)*12, npc.y + Math.sin(npc.facing)*12);
    ctx.strokeStyle = '#a3b9d6';
    ctx.stroke();
  }

  const invisible = state.time < p.invisUntil;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.fillStyle = invisible ? 'rgba(120,220,180,0.35)' : '#5cc16d';
  ctx.fill();

  drawTorchlight();

  ctx.restore();
}

function drawCastle(){
  const c = state.castle;
  const x = c.x, y = c.y;
  ctx.save();
  ctx.translate(x,y);
  ctx.fillStyle = '#151b2b';
  ctx.fillRect(-26,-22, 52, 44);
  ctx.fillRect(-16,-38, 32, 16);
  for (let i=-24;i<=24;i+=12){ ctx.fillRect(i,-38, 6, 8); }
  ctx.restore();
  ctx.fillStyle = '#9fb3c8';
  ctx.font = '12px system-ui';
  ctx.fillText("Dark Lord's Castle", x-48, y-46);
}

function drawFOV(npc){
  ctx.save();
  ctx.translate(npc.x, npc.y);
  ctx.rotate(npc.facing);
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.arc(0,0, npc.fovRange, -npc.fovAngle/2, npc.fovAngle/2);
  ctx.closePath();
  ctx.fillStyle = npc.type==='scout' ? 'rgba(120,160,255,.10)' : 'rgba(200,200,200,.08)';
  ctx.fill();
  ctx.restore();
}

function drawTorchlight(){
  if (!state.debugCones){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const npc of state.npcs.filter(n=>n.type==='scout')){
      const grad = ctx.createRadialGradient(npc.x, npc.y, 10, npc.x, npc.y, 70);
      grad.addColorStop(0, 'rgba(255,220,120,0.12)');
      grad.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(npc.x, npc.y, 70, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

export { drawWorldScene, drawCastle, drawFOV, drawTorchlight };
