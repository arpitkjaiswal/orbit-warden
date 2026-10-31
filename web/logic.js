/** Pure, deterministic logic used by the browser and Node tests. */
export const WIDTH = 960;
export const HEIGHT = 640;
export const STARTING_HP = 5;
export const MAX_RESOURCE = 100;
export const ENEMY_TYPES = Object.freeze({
  asteroid: { radius: 22, speed: 100, hp: 1, points: 10, wave: 0, amplitude: 0 },
  drone: { radius: 18, speed: 125, hp: 2, points: 25, wave: 2.7, amplitude: 70 },
  zigzag: { radius: 17, speed: 155, hp: 2, points: 35, wave: 5.0, amplitude: 105 },
  tank: { radius: 30, speed: 75, hp: 5, points: 50, wave: 1.2, amplitude: 35 },
});
export const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
export const collision = (a, b) => (a.x-b.x)**2 + (a.y-b.y)**2 <= (a.radius+b.radius)**2;
export const difficultyAt = (seconds) => clamp(1 + Math.max(0, seconds)/45, 1, 3.5);
export const scoreOf = (kind) => ENEMY_TYPES[kind]?.points ?? 0;
export function freshState() { return { hp: STARTING_HP, score: 0, elapsed: 0, energy: 100, shield: 100, over: false }; }
export function damage(state, amount = 1) {
  if (state.over || amount <= 0) return state;
  state.hp = Math.max(0, state.hp - amount);
  if (state.hp === 0) state.over = true;
  return state;
}
export function award(state, kind) { if (!state.over) state.score += scoreOf(kind); return state; }
export function moveEnemy(enemy, dt) {
  const spec = ENEMY_TYPES[enemy.kind];
  enemy.time += dt;
  enemy.y += spec.speed * enemy.level * dt;
  enemy.x = clamp(enemy.baseX + Math.sin(enemy.time * spec.wave + enemy.phase) * spec.amplitude, spec.radius, WIDTH - spec.radius);
  return enemy;
}
export function chooseEnemy(random = Math.random) {
  const options = ['asteroid','asteroid','asteroid','asteroid','asteroid','drone','drone','drone','zigzag','zigzag','tank'];
  return options[Math.floor(random() * options.length)];
}

export const SECTORS = Object.freeze([
  {name: 'Outer Rim', color: '#49e7ff', boss: 'Sentinel', hp: 65},
  {name: 'Crimson Nebula', color: '#ff698b', boss: 'Ravager', hp: 95},
  {name: 'Void Citadel', color: '#aa8eff', boss: 'Overlord', hp: 135},
]);
export const WEAPONS = Object.freeze({
  twin: {name: 'Twin laser', cost: 6, cooldown: .16, angles: [0, 0], damage: 1},
  spread: {name: 'Starburst', cost: 11, cooldown: .25, angles: [-.28, 0, .28], damage: 1},
  lance: {name: 'Plasma lance', cost: 14, cooldown: .38, angles: [0], damage: 5},
});
export function collectSalvage(state, kind) {
  if(state.over) return state;
  if(kind === 'repair') state.hp = Math.min(STARTING_HP, state.hp + 1);
  else if(kind === 'energy') state.energy = MAX_RESOURCE;
  else if(kind === 'shield') state.shield = MAX_RESOURCE;
  return state;
}
export function canActivate(running, paused, cooldown) { return running && !paused && cooldown <= 0; }
