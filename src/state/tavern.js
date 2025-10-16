const DEFAULT_STUMP_RADIUS = 46;

const TAVERN_INTERIOR = {
  width: 640,
  height: 360,
  wallThickness: 28,
  exitBuffer: 24,
  // Seat the player at the south side of the center table instead of the corner.
  spawn: { x: 304, y: 308 },
  exit: { x: 292, y: 326, w: 56, h: 28 },
  barkeep: { x: 320, y: 124, radius: 18, interactRadius: 72 },
  barRect: { x: 160, y: 140, w: 320, h: 24 },
  shelves: { x: 140, y: 52, w: 360, h: 36 },
  tables: [
    { x: 180, y: 226 },
    { x: 460, y: 232 },
    { x: 304, y: 268 }
  ],
  patrons: [
    { x: 150, y: 228, color: '#5cc16d', sway: 0.4, type: 'goblin' },
    { x: 214, y: 214, color: '#8bd66e', sway: 1.2, type: 'goblin' },
    { x: 458, y: 236, color: '#b88cff', sway: 2.1, type: 'fairy' },
    { x: 512, y: 248, color: '#ff94d6', sway: 2.8, type: 'fairy' },
    { x: 340, y: 186, color: '#67c48d', sway: 1.7, type: 'goblin' }
  ]
};

const TAVERN_SOLIDS = (()=>{
  const solids = [];
  const t = TAVERN_INTERIOR.wallThickness;
  const exit = TAVERN_INTERIOR.exit;
  const gap = TAVERN_INTERIOR.exitBuffer;
  solids.push({ x: 0, y: 0, w: TAVERN_INTERIOR.width, h: t });
  solids.push({ x: 0, y: 0, w: t, h: TAVERN_INTERIOR.height });
  solids.push({ x: TAVERN_INTERIOR.width - t, y: 0, w: t, h: TAVERN_INTERIOR.height });
  solids.push({ x: 0, y: TAVERN_INTERIOR.height - t, w: Math.max(0, exit.x - gap), h: t });
  const rightWallX = exit.x + exit.w + gap;
  const rightWallW = TAVERN_INTERIOR.width - rightWallX;
  if (rightWallW > 0){
    solids.push({ x: rightWallX, y: TAVERN_INTERIOR.height - t, w: rightWallW, h: t });
  }
  solids.push({
    x: TAVERN_INTERIOR.barRect.x,
    y: TAVERN_INTERIOR.barRect.y,
    w: TAVERN_INTERIOR.barRect.w,
    h: TAVERN_INTERIOR.barRect.h
  });
  for (const tbl of TAVERN_INTERIOR.tables){
    solids.push({ x: tbl.x - 40, y: tbl.y - 22, w: 80, h: 44 });
  }
  return solids;
})();

const getTavernDoorRect = (tavern) => {
  if (!tavern) return null;
  const stumpRadius = tavern.stump?.radius ?? DEFAULT_STUMP_RADIUS;
  const cx = tavern.stump?.cx ?? (tavern.x + tavern.w/2);
  const cy = tavern.stump?.cy ?? (tavern.y + tavern.h/2);
  const doorW = stumpRadius * 0.55;
  const doorH = stumpRadius * 0.9;
  const doorX = cx - doorW / 2;
  const doorY = cy - doorH / 2 + 8;
  return { x: doorX, y: doorY, w: doorW, h: doorH };
};

export { TAVERN_INTERIOR, TAVERN_SOLIDS, getTavernDoorRect };
