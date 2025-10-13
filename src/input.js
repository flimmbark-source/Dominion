const keys = new Set();
let initialized = false;

export const setupInput = () => {
  if (initialized) return;
  initialized = true;

  const normalizeKey = key => {
    const lowered = key.toLowerCase();
    return lowered === ' ' ? 'space' : lowered;
  };

  window.addEventListener('keydown', e => {
    keys.add(normalizeKey(e.key));
  });
  window.addEventListener('keyup', e => {
    keys.delete(normalizeKey(e.key));
  });
};

export { keys };
