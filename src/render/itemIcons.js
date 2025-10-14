const ICON_DRAWERS = {
  boots(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y + size * 0.08);
    const bootWidth = size * 0.34;
    const bootHeight = size * 0.54;
    const spacing = size * 0.22;
    const toeRadius = size * 0.2;

    for (const dir of [-1, 1]){
      ctx.save();
      ctx.translate(dir * spacing, 0);
      ctx.fillStyle = '#c78945';
      ctx.strokeStyle = '#4a2c16';
      ctx.lineWidth = size * 0.07;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(-bootWidth / 2, -bootHeight / 2);
      ctx.lineTo(bootWidth / 2, -bootHeight / 2);
      ctx.lineTo(bootWidth / 2, bootHeight / 2 - toeRadius);
      ctx.quadraticCurveTo(bootWidth / 2 + toeRadius * 0.7, bootHeight / 2 - toeRadius * 0.2, bootWidth / 2 - toeRadius * 0.1, bootHeight / 2);
      ctx.lineTo(-bootWidth / 2, bootHeight / 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 240, 210, 0.18)';
      ctx.fillRect(-bootWidth / 2 + size * 0.04, -bootHeight / 2 + size * 0.08, bootWidth * 0.36, size * 0.08);
      ctx.restore();
    }

    ctx.restore();
  },

  cloak(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y);
    const width = size * 0.72;
    const height = size * 0.88;
    const gradient = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
    gradient.addColorStop(0, '#3c2156');
    gradient.addColorStop(0.5, '#2b1842');
    gradient.addColorStop(1, '#1a0f2c');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#150b20';
    ctx.lineWidth = size * 0.06;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -height / 2);
    ctx.bezierCurveTo(width / 2, -height / 3, width / 2, height / 3, 0, height / 2);
    ctx.bezierCurveTo(-width / 2, height / 3, -width / 2, -height / 3, 0, -height / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(200, 180, 255, 0.28)';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.moveTo(0, -height * 0.42);
    ctx.bezierCurveTo(width * 0.26, -height * 0.1, width * 0.12, height * 0.34, 0, height * 0.42);
    ctx.stroke();
    ctx.restore();
  },

  dagger(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y);
    const bladeLength = size * 0.62;
    const bladeWidth = size * 0.26;

    ctx.fillStyle = '#cde7f6';
    ctx.strokeStyle = '#455b73';
    ctx.lineWidth = size * 0.05;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -bladeLength / 2);
    ctx.lineTo(bladeWidth / 2, bladeLength * 0.05);
    ctx.lineTo(0, bladeLength / 2);
    ctx.lineTo(-bladeWidth / 2, bladeLength * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const guardWidth = size * 0.58;
    const guardHeight = size * 0.12;
    ctx.fillStyle = '#8b623d';
    ctx.fillRect(-guardWidth / 2, bladeLength * 0.05 - guardHeight / 2, guardWidth, guardHeight);
    ctx.strokeStyle = '#4e3623';
    ctx.strokeRect(-guardWidth / 2, bladeLength * 0.05 - guardHeight / 2, guardWidth, guardHeight);

    const handleWidth = size * 0.2;
    const handleHeight = size * 0.34;
    ctx.fillStyle = '#3b2a1a';
    ctx.fillRect(-handleWidth / 2, bladeLength * 0.05 + guardHeight / 2, handleWidth, handleHeight);

    ctx.fillStyle = '#c1a264';
    ctx.beginPath();
    ctx.arc(0, bladeLength * 0.05 + guardHeight / 2 + handleHeight, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  invisibilityPotion(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y);
    const bottleWidth = size * 0.48;
    const bottleHeight = size * 0.6;

    ctx.fillStyle = '#d1d7ff';
    ctx.beginPath();
    ctx.moveTo(-bottleWidth / 3, -bottleHeight / 2);
    ctx.lineTo(bottleWidth / 3, -bottleHeight / 2);
    ctx.lineTo(bottleWidth / 2, -bottleHeight / 3);
    ctx.lineTo(bottleWidth / 2, bottleHeight / 4);
    ctx.quadraticCurveTo(0, bottleHeight / 2 + size * 0.1, -bottleWidth / 2, bottleHeight / 4);
    ctx.lineTo(-bottleWidth / 2, -bottleHeight / 3);
    ctx.closePath();
    ctx.fill();

    const liquidGradient = ctx.createLinearGradient(0, -bottleHeight * 0.1, 0, bottleHeight * 0.46);
    liquidGradient.addColorStop(0, 'rgba(140, 210, 255, 0.7)');
    liquidGradient.addColorStop(1, 'rgba(60, 140, 200, 0.85)');
    ctx.fillStyle = liquidGradient;
    ctx.beginPath();
    ctx.moveTo(-bottleWidth / 2 + size * 0.06, bottleHeight * 0.05);
    ctx.lineTo(bottleWidth / 2 - size * 0.06, bottleHeight * 0.05);
    ctx.quadraticCurveTo(bottleWidth / 2 - size * 0.04, bottleHeight * 0.35, 0, bottleHeight * 0.42);
    ctx.quadraticCurveTo(-bottleWidth / 2 + size * 0.04, bottleHeight * 0.35, -bottleWidth / 2 + size * 0.06, bottleHeight * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(40, 70, 110, 0.9)';
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.moveTo(-bottleWidth / 3, -bottleHeight / 2);
    ctx.lineTo(bottleWidth / 3, -bottleHeight / 2);
    ctx.lineTo(bottleWidth / 2, -bottleHeight / 3);
    ctx.lineTo(bottleWidth / 2, bottleHeight / 4);
    ctx.quadraticCurveTo(0, bottleHeight / 2 + size * 0.1, -bottleWidth / 2, bottleHeight / 4);
    ctx.lineTo(-bottleWidth / 2, -bottleHeight / 3);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#6d7aff';
    ctx.fillRect(-size * 0.12, -bottleHeight / 2 - size * 0.08, size * 0.24, size * 0.16);
    ctx.strokeStyle = '#2f3976';
    ctx.strokeRect(-size * 0.12, -bottleHeight / 2 - size * 0.08, size * 0.24, size * 0.16);
    ctx.restore();
  },

  moonleaf(ctx, x, y, size){
    ctx.save();
    ctx.translate(x, y + size * 0.05);
    const leafWidth = size * 0.62;
    const leafHeight = size * 0.82;
    const gradient = ctx.createLinearGradient(0, -leafHeight / 2, 0, leafHeight / 2);
    gradient.addColorStop(0, '#7ce496');
    gradient.addColorStop(0.5, '#4cb978');
    gradient.addColorStop(1, '#2f7d49');
    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#1c4f2d';
    ctx.lineWidth = size * 0.05;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -leafHeight / 2);
    ctx.bezierCurveTo(leafWidth / 2, -leafHeight * 0.15, leafWidth / 2, leafHeight * 0.45, 0, leafHeight / 2);
    ctx.bezierCurveTo(-leafWidth / 2, leafHeight * 0.45, -leafWidth / 2, -leafHeight * 0.15, 0, -leafHeight / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(230, 255, 240, 0.55)';
    ctx.lineWidth = size * 0.035;
    ctx.beginPath();
    ctx.moveTo(0, -leafHeight / 2);
    ctx.bezierCurveTo(leafWidth * 0.18, -leafHeight * 0.1, leafWidth * 0.22, leafHeight * 0.3, 0, leafHeight / 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(20, 80, 40, 0.6)';
    ctx.lineWidth = size * 0.025;
    ctx.beginPath();
    ctx.moveTo(0, -leafHeight * 0.15);
    ctx.lineTo(leafWidth * 0.18, leafHeight * 0.12);
    ctx.moveTo(0, -leafHeight * 0.05);
    ctx.lineTo(-leafWidth * 0.2, leafHeight * 0.18);
    ctx.stroke();
    ctx.restore();
  }
};

function drawItemIcon(ctx, iconId, x, y, size = 32){
  const drawer = ICON_DRAWERS[iconId];
  if (drawer){
    drawer(ctx, x, y, size);
  } else {
    ctx.save();
    ctx.fillStyle = '#d7e6ff';
    ctx.font = `${Math.floor(size * 0.75)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', x, y);
    ctx.restore();
  }
}

export { drawItemIcon };
