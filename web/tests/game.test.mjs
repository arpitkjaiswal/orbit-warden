import test from 'node:test';
import assert from 'node:assert/strict';
import {OrbitWarden} from '../main.js';
import {freshState} from '../logic.js';
import {newLoadout} from '../adventure.js';
function fixture(sector){
 const game=Object.create(OrbitWarden.prototype);
 Object.assign(game,{running:true,paused:false,practicing:false,refitting:false,state:freshState(),sector,mods:newLoadout(),player:{x:400,y:500},kills:0,missileKills:0,combo:0,comboTime:0,sectorHits:0,upgrade:0,runHits:0,ship:'vanguard',bullets:[],missiles:[],floatingTexts:[],feedback:{play(){}},enemies:[],novaCooldown:0});
 for(const key of ['unlockBadge','particlesAt','writeBest','showOverlay','announce'])game[key]=()=>{};
 game.beginRefit=()=>{game.paused=true;game.refitting=true;};return game;
}
test('nova stops damaging and scoring when the final commander ends the run',()=>{
 const game=fixture(2),boss={kind:'tank',boss:true,hp:1,x:400,y:100},other={kind:'asteroid',hp:1,x:500,y:100};game.enemies=[boss,other];game.action('KeyX');
 assert.equal(game.running,false);assert.equal(game.kills,1);assert.equal(game.state.score,3000);assert.equal(other.hp,1);
});
test('missile splash stops at a refit boundary and cannot mutate paused combat',()=>{
 const game=fixture(0),boss={kind:'tank',boss:true,hp:1,x:400,y:100,radius:55},other={kind:'asteroid',hp:1,x:420,y:100,radius:22};game.enemies=[boss,other];
 game.missiles=[{x:400,y:120,radius:7,vx:0,vy:-280,life:4,target:boss}];game.updateMissiles(.01);
 assert.equal(game.refitting,true);assert.equal(game.kills,1);assert.equal(other.hp,1);const score=game.state.score;game.destroyEnemy(other);assert.equal(game.state.score,score);
});
test('destroying enemies after game over cannot change scores or badges',()=>{
 const game=fixture(0),enemy={kind:'asteroid',hp:1};game.enemies=[enemy];game.state.over=true;game.destroyEnemy(enemy);assert.equal(game.kills,0);assert.equal(game.state.score,0);assert.equal(game.enemies.length,1);
});
