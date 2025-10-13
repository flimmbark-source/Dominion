import { keys } from '../input.js';

const justPressed = new Set();

function pressOnce(k){
  if (keys.has(k)){
    if (justPressed.has(k)) return false;
    justPressed.add(k);
    return true;
  } else {
    justPressed.delete(k);
    return false;
  }
}

function resetPressOnce(){
  justPressed.clear();
}

export { pressOnce, resetPressOnce };
