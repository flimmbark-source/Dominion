export const WORLD = { W: 8000, H: 8000 };

export const VILLAGES = [
  { name: 'Moonfen', x: 3600, y: 3400, w: 960, h: 600 },
  { name: 'Brackenreach', x: 900, y: 1200, w: 960, h: 600 },
  { name: 'Duskhaven', x: 5900, y: 1200, w: 960, h: 600 },
  { name: 'Miregate', x: 980, y: 5900, w: 960, h: 600 },
  { name: 'Thornfall', x: 5840, y: 5840, w: 960, h: 600 }
];

export const PATH_WIDTH_MAIN = 48;
export const PATH_WIDTH_RING = 38;
export const PATH_CLEAR_RADIUS = 44;

export const TREE_MIN_SPACING = 56;
export const TREE_MAX_SPACING = 118;
export const TREE_CLEARING_CHANCE = 0.18;
export const TREE_CANOPY_MIN = 26;
export const TREE_CANOPY_MAX = 42;

export const WALL = 8;

export const treePathNoise = (x, y) =>
  Math.sin(x * 0.0026) + Math.sin(y * 0.0031) - Math.cos((x + y) * 0.0017);
