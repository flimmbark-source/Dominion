const GLOBAL_DAMAGE_MULTIPLIER = 0.8;

function applyGlobalDamageModifier(damage){
  const numericDamage = typeof damage === 'number' ? damage : 0;
  if (numericDamage <= 0) return 0;
  return numericDamage * GLOBAL_DAMAGE_MULTIPLIER;
}

export { GLOBAL_DAMAGE_MULTIPLIER, applyGlobalDamageModifier };
