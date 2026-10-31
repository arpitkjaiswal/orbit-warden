import test from 'node:test';
import assert from 'node:assert/strict';
import { collision, damage, award, freshState, moveEnemy, difficultyAt, chooseEnemy, scoreOf, ENEMY_TYPES } from '../logic.js';
test('circles touching count as a collision', () => { assert.equal(collision({x:0,y:0,radius:10},{x:20,y:0,radius:10}), true); assert.equal(collision({x:0,y:0,radius:10},{x:20.1,y:0,radius:10}),false); });
test('hp reaches zero, ends game, and cannot go negative', () => {let s = freshState(); damage(s, 100); assert.equal(s.hp,0); assert.equal(s.over,true); damage(s); assert.equal(s.hp,0);});
test('game over rejects further scoring', () => { const s=freshState(); award(s,'drone'); assert.equal(s.score,25); damage(s,5); award(s,'tank'); assert.equal(s.score,25); });
test('difficulty clamps', () => {assert.equal(difficultyAt(0),1); assert.equal(difficultyAt(-30),1); assert.equal(difficultyAt(10000),3.5);});
test('enemy motion types are distinct', () => {const source={x:400,baseX:400,y:0,phase:0,time:0,level:1}; const a=moveEnemy({...source,kind:'asteroid'},1); const d=moveEnemy({...source,kind:'drone'},1); assert.equal(a.x,400); assert.notEqual(d.x,400);assert.notEqual(a.y,d.y);});
test('every opponent scores and has health',()=>{for(const k of Object.keys(ENEMY_TYPES)){assert.ok(scoreOf(k)>0);assert.ok(ENEMY_TYPES[k].hp>0)}});
test('spawns valid kinds',()=>{ assert.equal(chooseEnemy(()=>0),'asteroid');assert.equal(chooseEnemy(()=>0.999),'tank') });

test('campaign repair and resources respect caps and game-over state', async () => {
  const {collectSalvage}=await import('../logic.js');
  const s=freshState();s.hp=2;s.energy=0;s.shield=0;
  collectSalvage(s,'repair');assert.equal(s.hp,3);
  collectSalvage(s,'energy');collectSalvage(s,'shield');assert.equal(s.energy,100);assert.equal(s.shield,100);
  s.hp=5;collectSalvage(s,'repair');assert.equal(s.hp,5);
  damage(s,5);collectSalvage(s,'repair');assert.equal(s.hp,0);
});
test('special actions require active unpaused play and an expired cooldown', async () => {
  const {canActivate}=await import('../logic.js');
  assert.equal(canActivate(true,false,0),true);
  assert.equal(canActivate(true,true,0),false);
  assert.equal(canActivate(false,false,0),false);
  assert.equal(canActivate(true,false,.1),false);
});
test('campaign scales commander health and offers distinct weapon tradeoffs', async () => {
  const {SECTORS,WEAPONS}=await import('../logic.js');
  assert.equal(SECTORS.length,3);
  assert.ok(SECTORS[0].hp<SECTORS[1].hp && SECTORS[1].hp<SECTORS[2].hp);
  assert.equal(WEAPONS.spread.angles.length,3);
  assert.ok(WEAPONS.lance.damage>WEAPONS.twin.damage);
  assert.ok(WEAPONS.lance.cost>WEAPONS.twin.cost);
});
