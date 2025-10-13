import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { getPlayerStats } from '../state/playerStats.js';
import { clamp } from '../utils/math.js';
import { drawItemIcon } from './itemIcons.js';

function bar(x,y,w,h, frac, fg, bg, border='#1a2636'){
  ctx.fillStyle = bg; ctx.fillRect(x,y,w,h);
  ctx.fillStyle = fg; ctx.fillRect(x,y, w*clamp(frac,0,1), h);
  ctx.strokeStyle = border; ctx.strokeRect(x+.5,y+.5,w-1,h-1);
}

function drawHUD(){
  ctx.fillStyle = 'rgba(10,14,22,0.9)';
  ctx.fillRect(0, H-100, W, 100);
  ctx.strokeStyle = '#1f2b3e';
  ctx.strokeRect(0.5, H-100.5, W-1, 100);

  const p = state.player;
  const stats = getPlayerStats(p);
  const maxHealth = stats.maxHealth || 1;
  bar(16, H-84, 220, 18, p.health/maxHealth, '#35c46a', '#233645');
  ctx.fillStyle = '#d4ffe6'; ctx.font = '12px system-ui'; ctx.fillText('Health', 20, H-70);

  bar(16, H-52, 220, 14, p.detection/100, '#f0c94c', '#233645');
  ctx.fillStyle = '#fff2c7'; ctx.font = '12px system-ui'; ctx.fillText('Detection', 20, H-38);

  ctx.fillStyle = '#ffd25a';
  ctx.font = '14px system-ui';
  ctx.fillText(`Gold: ${p.gold}`, 260, H-68);

  ctx.fillStyle = '#cfe1ff';
  ctx.font = '12px system-ui';
  ctx.fillText(`Speed: ${Math.round(stats.movementSpeed)}  Damage: ${Math.round(stats.attackDamage)}  Stealth x${stats.stealthFactor.toFixed(2)}`, 260, H-44);

  ctx.fillStyle = '#ffb347';
  ctx.font = '12px system-ui';
  ctx.fillText(`Threat: ${Math.round(state.threat)}`, 260, H-20);

  const slotsX = W - 16 - (6*48);
  for (let i=0;i<6;i++){
    const x = slotsX + i*48, y = H - 84;
    ctx.fillStyle = 'rgba(24,34,52,0.9)';
    ctx.fillRect(x, y, 44, 44);
    ctx.strokeStyle = '#2a3a56'; ctx.strokeRect(x+.5,y+.5,44-1,44-1);
    ctx.fillStyle = '#6e8bb6'; ctx.font = '10px system-ui'; ctx.fillText(String(i+1), x+2, y+12);
    const it = state.player.inventory[i];
    if (it){
      if (it.icon){
        drawItemIcon(ctx, it.icon, x + 22, y + 22, 28);
      } else {
        ctx.fillStyle = '#d7e6ff';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const label = it.name.split(' ').map(w=>w[0]).join('').slice(0,3);
        ctx.fillText(label, x + 22, y + 24);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }
}

export { drawHUD };
