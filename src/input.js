const keys = new Set();
let initialized = false;

export const setupInput = () => {
  if (initialized) return;
  initialized = true;
  window.addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
  });
  window.addEventListener('keyup', e => {
    keys.delete(e.key.toLowerCase());
  });
};

export { keys };
