export const VILLAGE_MARGIN = 40;
export const VILLAGE_ROAD_BUFFER = 80;

export const DEFAULT_HOUSE_JITTER = {
  north: { x: 70, y: 30, door: 0.18 },
  south: { x: 70, y: 36, door: 0.18 }
};

export const HOUSE_MIN_SPACING = 22;

export const BASE_HOUSE_LAYOUT = [
  { x: 120, y: 120, w: 140, h: 90, side: 'north', doorOffset: 0.5 },
  { x: 320, y: 100, w: 160, h: 110, side: 'north', doorOffset: 0.3 },
  { x: 540, y: 110, w: 150, h: 100, side: 'north', doorOffset: 0.7 },
  { x: 160, y: 320, w: 150, h: 110, side: 'south', doorOffset: 0.4 },
  { x: 380, y: 340, w: 160, h: 110, side: 'south', doorOffset: 0.6 },
  { x: 620, y: 330, w: 170, h: 120, side: 'south', doorOffset: 0.5 }
];
