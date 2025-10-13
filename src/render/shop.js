import { ctx, W, H } from '../game/canvas.js';
import { state } from '../state/gameState.js';
import { ITEMS } from '../data/items.js';
import { setShopHitRegions, getShopHover } from '../systems/shop.js';

function drawShop(){
  ctx.save();
  ctx.fillStyle = 'rgba(6,8,12,0.82)';
  ctx.fillRect(0,0,W,H);

  const pw = 680, ph = 460;
  const px = (W - pw) / 2;
  const py = (H - ph) / 2;
  const panelGrad = ctx.createLinearGradient(px, py, px, py + ph);
  panelGrad.addColorStop(0, '#271c12');
  panelGrad.addColorStop(1, '#2f2318');
  ctx.fillStyle = panelGrad;
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = '#8a6d3a';
  ctx.lineWidth = 3;
  ctx.strokeRect(px + 1.5, py + 1.5, pw - 3, ph - 3);
  ctx.lineWidth = 1;

  ctx.fillStyle = '#f6e9c8';
  ctx.font = '26px "Trebuchet MS", ui-sans-serif';
  ctx.fillText('Hidden Goblin Tavern', px + 32, py + 44);
  ctx.fillStyle = '#d7c69a';
  ctx.font = '16px ui-sans-serif';
  ctx.fillText('Goblin Merchant: "What are ya buyin\'?"', px + 32, py + 72);
  ctx.fillText('Left click or press 1-5 to purchase · 0/Esc to slip back outside.', px + 32, py + 100);

  ctx.font = '16px ui-sans-serif';
  ctx.fillStyle = '#ffde7b';
  ctx.fillText(`Purse: ${state.player.gold} gold`, px + 32, py + 126);

  const columns = ITEMS.length > 3 ? 2 : 1;
  const colGap = columns > 1 ? 24 : 0;
  const headerHeight = 152;
  const footerReserve = 78;
  const availableHeight = ph - headerHeight - footerReserve;
  const rowGap = 14;
  const rows = Math.max(1, Math.ceil(ITEMS.length / columns));
  const cardH = Math.floor((availableHeight - (rows - 1) * rowGap) / rows);
  const listStartY = py + headerHeight;
  const availableWidth = pw - 48 - (columns - 1) * colGap;
  const cardW = availableWidth / columns;
  const usedSlots = state.player.inventory.filter(Boolean).length;

  const newHitRegions = [];

  const wrapText = (text, x, y, maxWidth, lineHeight)=>{
    const words = text.split(' ');
    let line = '';
    let cursorY = y;
    for (const word of words){
      const testLine = line ? `${line} ${word}` : word;
      if (ctx.measureText(testLine).width > maxWidth && line){
        ctx.fillText(line, x, cursorY);
        line = word;
        cursorY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line){
      ctx.fillText(line, x, cursorY);
    }
    return cursorY;
  };

  ITEMS.forEach((item, idx)=>{
    const col = idx % columns;
    const row = Math.floor(idx / columns);
    const rect = {
      x: px + 24 + col * (cardW + colGap),
      y: listStartY + row * (cardH + rowGap),
      w: cardW,
      h: cardH
    };
    const hovered = getShopHover() === item.id;
    const affordable = state.player.gold >= item.price;
    const owned = item.canBuy ? !item.canBuy(state.player) : false;
    const quantity = state.player.inventory.filter(it => it && it.id === item.id).length;

    ctx.fillStyle = hovered ? 'rgba(112,85,52,0.55)' : 'rgba(32,24,18,0.74)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = hovered ? '#d6b36a' : '#8a6d3a';
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);

    ctx.fillStyle = '#f6e9c8';
    ctx.font = '18px ui-sans-serif';
    ctx.fillText(`${item.key}) ${item.name}`, rect.x + 14, rect.y + 26);

    ctx.textAlign = 'right';
    ctx.font = '16px ui-sans-serif';
    ctx.fillStyle = affordable ? '#ffde7b' : '#856648';
    ctx.fillText(`${item.price}g`, rect.x + rect.w - 14, rect.y + 26);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#d7c69a';
    ctx.font = '14px ui-sans-serif';
    const descEndY = wrapText(item.desc, rect.x + 14, rect.y + 52, rect.w - 28, 18);

    ctx.fillStyle = '#b18f58';
    ctx.font = '13px ui-sans-serif';
    const limitLine = owned ? 'Already owned' : `${quantity} owned`;
    ctx.fillText(limitLine, rect.x + 14, descEndY + 26);

    if (item.type === 'passive' && state.shopOwned.has(item.id)){
      ctx.fillStyle = '#9aa5b1';
      ctx.font = '12px ui-sans-serif';
      ctx.fillText('Passive bonus active', rect.x + 14, descEndY + 46);
    } else if (!affordable){
      ctx.fillStyle = '#b35f56';
      ctx.font = '12px ui-sans-serif';
      ctx.fillText('Not enough gold', rect.x + 14, descEndY + 46);
    } else if (!owned && usedSlots >= state.player.inventory.length){
      ctx.fillStyle = '#c9813c';
      ctx.font = '12px ui-sans-serif';
      ctx.fillText('Inventory full', rect.x + 14, descEndY + 46);
    }

    newHitRegions.push({ type:'item', item, rect });
  });

  const exitRect = { x: px + pw - 160, y: py + ph - 56, w: 124, h: 32 };
  ctx.fillStyle = getShopHover() === 'exit' ? 'rgba(140,90,50,0.65)' : 'rgba(52,38,24,0.78)';
  ctx.fillRect(exitRect.x, exitRect.y, exitRect.w, exitRect.h);
  ctx.strokeStyle = '#b98a52';
  ctx.strokeRect(exitRect.x + 0.5, exitRect.y + 0.5, exitRect.w - 1, exitRect.h - 1);
  ctx.fillStyle = '#f4e2c0';
  ctx.font = '16px ui-sans-serif';
  ctx.fillText('Leave tavern', exitRect.x + 16, exitRect.y + 22);
  newHitRegions.push({ type:'exit', rect: exitRect });

  setShopHitRegions(newHitRegions);

  ctx.restore();
}

export { drawShop };
