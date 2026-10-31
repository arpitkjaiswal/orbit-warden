/** Run progression and attack patterns, shared by the game and deterministic tests. */
export const SHIPS=Object.freeze({
  vanguard:{name:'Vanguard',hp:5,weapon:'twin',color:'#49e7ff',description:'Balanced hull · twin lasers'},
  bastion:{name:'Bastion',hp:6,weapon:'spread',color:'#91ffc9',description:'Heavy hull · faster shield recovery'},
  spectre:{name:'Spectre',hp:4,weapon:'lance',color:'#c0a1ff',description:'Light hull · plasma damage +1'},
});
export const UPGRADES=Object.freeze({
  reactor:{name:'Quantum reactor',description:'Weapon energy costs −25%; passive recharge +8/s.'},
  armor:{name:'Titanium hull',description:'Maximum hull +2. Repair two hull points now.'},
  missiles:{name:'Warhead array',description:'Missile damage +4; refill the missile magazine.'},
  rapid:{name:'Accelerator',description:'All guns fire 20% faster.'},
  wing:{name:'Wing drones',description:'Two orbiting drones fire free support shots.'},
  shield:{name:'Aegis matrix',description:'Shield recovery +14/s; refill the shield.'},
});
export const upgradeChoices=sector=>sector===0?['reactor','armor','missiles']:['rapid','wing','shield'];
export function newLoadout(ship='vanguard'){
  const spec=SHIPS[ship]||SHIPS.vanguard;
  return {cost:1,recharge:0,fireRate:1,missileDamage:8,missiles:3,wings:0,shieldRegen:ship==='bastion'?8:0,damage:ship==='spectre'?1:0,maxHp:spec.hp};
}
export function applyUpgrade(mods,state,key){
  if(!UPGRADES[key])return false;
  if(key==='reactor'){mods.cost*=.75;mods.recharge+=8;}
  if(key==='armor'){mods.maxHp+=2;state.maxHp=mods.maxHp;state.hp=Math.min(state.maxHp,state.hp+2);}
  if(key==='missiles'){mods.missileDamage+=4;mods.missiles=5;}
  if(key==='rapid')mods.fireRate*=.8;
  if(key==='wing')mods.wings=2;
  if(key==='shield'){mods.shieldRegen+=14;state.shield=100;}
  return true;
}
export function bossVolley(sector,phase,cycle,aim){
  const count=phase===2?7:5;
  if(sector===1 && cycle%2===1){
    const total=phase===2?14:10;
    return Array.from({length:total},(_,i)=>Math.PI*2*i/total+cycle*.12);
  }
  if(sector===2 && phase===2 && cycle%2===1){
    return Array.from({length:12},(_,i)=>Math.PI*2*i/12+cycle*.26);
  }
  return Array.from({length:count},(_,i)=>aim+(i-(count-1)/2)*(sector===0?.16:.21));
}
export const BADGES=Object.freeze({
  first:'First intercept',chain:'Chain master · 20 kills',commander:'Commander hunter',
  clear:'Galaxy guardian',untouched:'Flawless sector',missile:'Missile ace · 10 kills',
});
export function readBadges(raw){
  try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?[...new Set(parsed.filter(k=>Object.hasOwn(BADGES,k)))]:[];}catch{return [];}
}
