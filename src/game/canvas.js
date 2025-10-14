const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const logicalWidth = Number(canvas.getAttribute('width')) || canvas.width;
const logicalHeight = Number(canvas.getAttribute('height')) || canvas.height;

const W = logicalWidth;
const H = logicalHeight;

let pixelRatio = window.devicePixelRatio || 1;

function applyResolutionScaling(){
  const displayWidth = Math.round(W * pixelRatio);
  const displayHeight = Math.round(H * pixelRatio);

  if (canvas.width !== displayWidth || canvas.height !== displayHeight){
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

function resizeCanvas(){
  pixelRatio = window.devicePixelRatio || 1;
  applyResolutionScaling();
}

function canvasPointFromEvent(evt){
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  return {
    x: (evt.clientX - rect.left) * scaleX,
    y: (evt.clientY - rect.top) * scaleY
  };
}

resizeCanvas();

window.addEventListener('resize', resizeCanvas);

export { canvas, ctx, W, H, resizeCanvas, canvasPointFromEvent };
