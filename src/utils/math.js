export const TAU = Math.PI * 2;

export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export const lerp = (a, b, t) => a + (b - a) * t;

export const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

export const randRange = (min, max) => min + Math.random() * (max - min);
