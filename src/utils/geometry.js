import { clamp } from './math.js';

export const lineIntersectsRect = (x1, y1, x2, y2, rx, ry, rw, rh) => {
  // Liang-Barsky segment vs AABB
  const p = [-(x2 - x1), (x2 - x1), -(y2 - y1), (y2 - y1)];
  const q = [x1 - rx, rx + rw - x1, y1 - ry, ry + rh - y1];
  let u1 = 0;
  let u2 = 1;
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u2) return false;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return false;
        if (t < u2) u2 = t;
      }
    }
  }
  return true;
};

export const segBlockedByAnyRect = (x1, y1, x2, y2, rects) =>
  rects.some(r => lineIntersectsRect(x1, y1, x2, y2, r.x, r.y, r.w, r.h));

export const pointInRect = (px, py, rect) =>
  px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;

export const rectsOverlap = (a, b) =>
  !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);

export const distToSegment = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  const c2 = vx * vx + vy * vy;
  const t = c2 ? clamp(c1 / c2, 0, 1) : 0;
  const dx = ax + t * vx - px;
  const dy = ay + t * vy - py;
  return Math.hypot(dx, dy);
};

export const centerOf = rect => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });

export const circleRectCollideResolve = (cx, cy, cr, rect) => {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nx;
  const dy = cy - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 > cr * cr) return { x: cx, y: cy };
  const d = Math.max(0.0001, Math.sqrt(d2));
  const ux = dx / d;
  const uy = dy / d;
  const overlap = cr - d + 0.1;
  return { x: cx + ux * overlap, y: cy + uy * overlap };
};
