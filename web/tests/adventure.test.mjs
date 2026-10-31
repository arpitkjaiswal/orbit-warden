import test from 'node:test';
import assert from 'node:assert/strict';
import {SHIPS,newLoadout,applyUpgrade,upgradeChoices,bossVolley,readBadges} from '../adventure.js';
import {collectSalvage} from '../logic.js';
test('ship loadouts provide distinct strengths without sharing mutable state',()=>{
 const heavy=newLoadout('bastion'),light=newLoadout('spectre');
 assert.ok(heavy.maxHp>light.maxHp);assert.ok(heavy.shieldRegen>light.shieldRegen);assert.ok(light.damage>heavy.damage);
 heavy.missiles=0;assert.equal(newLoadout('bastion').missiles,3);assert.equal(SHIPS.spectre.weapon,'lance');
});
test('all six refits apply a real combat improvement and reject unknown upgrades',()=>{
 const mods=newLoadout(),state={hp:2,maxHp:5,shield:0};
 for(const key of [...upgradeChoices(0),...upgradeChoices(1)])assert.equal(applyUpgrade(mods,state,key),true);
 assert.equal(mods.maxHp,7);assert.equal(state.hp,4);assert.equal(mods.missileDamage,12);assert.equal(mods.missiles,5);
 assert.equal(mods.wings,2);assert.equal(mods.cost,.75);assert.equal(mods.fireRate,.8);assert.equal(state.shield,100);
 const before=JSON.stringify({mods,state});assert.equal(applyUpgrade(mods,state,'unknown'),false);assert.equal(JSON.stringify({mods,state}),before);
});
test('repair pickups respect ship and upgraded hull caps',()=>{
 const light={hp:4,maxHp:4};collectSalvage(light,'repair');assert.equal(light.hp,4);
 const heavy={hp:6,maxHp:8};collectSalvage(heavy,'repair');assert.equal(heavy.hp,7);
});
test('commanders change patterns with sector, phase and volley cycle',()=>{
 assert.equal(bossVolley(0,1,0,Math.PI/2).length,5);assert.equal(bossVolley(0,2,0,Math.PI/2).length,7);
 assert.equal(bossVolley(1,1,1,0).length,10);assert.equal(bossVolley(1,2,1,0).length,14);
 assert.equal(bossVolley(2,2,1,0).length,12);
 assert.notDeepEqual(bossVolley(2,2,1,0),bossVolley(2,2,3,0));
 for(let sector=0;sector<3;sector++)for(let phase=1;phase<=2;phase++)assert.ok(bossVolley(sector,phase,1,0).every(Number.isFinite));
});
test('persisted pilot records tolerate invalid data and contain only known badges',()=>{
 assert.deepEqual(readBadges('bad json'),[]);assert.deepEqual(readBadges('{}'),[]);
 assert.deepEqual(readBadges('["first","not-real","first","clear"]'),['first','clear']);
});
