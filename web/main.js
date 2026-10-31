import {InputState} from './input.js';
import {SHIPS, UPGRADES, newLoadout, applyUpgrade, upgradeChoices, bossVolley, BADGES, readBadges} from './adventure.js';
import {Feedback} from './feedback.js';
import {WIDTH, HEIGHT, ENEMY_TYPES, clamp, collision, difficultyAt, damage, freshState, chooseEnemy, moveEnemy, SECTORS, WEAPONS, collectSalvage, canActivate, FLIGHT_MODES, sweptCollision, firstCollision, assistedTarget} from './logic.js';
import {GesturePower} from './gesture-logic.js';
import {GestureTracker} from './gestures.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const COLORS = { cyan: '#49e7ff', purple: '#aa8eff', red: '#ff698b', gold: '#ffca72', white: '#edf6ff' };
const random = (min, max) => min + Math.random() * (max - min);
const lerp = (a,b,t) => a+(b-a)*t;
const prettifyTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;

export class OrbitWarden {
  constructor() {
    this.canvas = $('game');
    this.ctx = this.canvas.getContext('2d');
    this.controls=new InputState();this.input=this.controls.held;
    this.stars = Array.from({length: 180}, () => ({ x: Math.random()*WIDTH, y: Math.random()*HEIGHT, r: random(.5,2), speed: random(.15, 1.0), light: random(.15,.8) }));
    this.gestures = new GestureTracker({video:$('camera'), overlay:$('hand-overlay'), placeholder:$('camera-placeholder'), button:$('gesture-toggle'), label:$('gesture-name'), confidence:$('gesture-confidence'), status:$('gesture-status'), feedLabel:$('camera-label'),onFailure:message=>{
      if(this.running&&!this.refitting&&!this.practicing){this.pause();this.showOverlay('CAMERA DISCONNECTED',message+' Use keyboard/touch, or enable the camera again.','RESUME MISSION','PILOT SAFETY','CAMERA INPUT HAS BEEN RELEASED');}
    }});
    this.gesturePower=new GesturePower();
    this.feedback=new Feedback();
    try{this.badges=readBadges(localStorage.getItem('orbit-warden-badges'));}catch{this.badges=[];}
    this.best = this.readBest();
    this.running = false;
    this.paused = false;
    this.lastFrame = performance.now();
    this.reset();
    this.attachControls();
    document.querySelectorAll('[data-weapon]').forEach(button=>button.addEventListener('click',()=>this.activate(`Digit${button.dataset.slot}`)));
    $('dash-action').addEventListener('click',()=>this.activate('KeyQ'));
    $('overdrive-action').addEventListener('click',()=>this.activate('KeyZ'));
    $('missile-action').addEventListener('click',()=>this.activate('KeyC'));
    $('refit-choices').addEventListener('click',event=>{const button=event.target.closest('[data-upgrade]');if(button)this.chooseUpgrade(button.dataset.upgrade);});
    $('nova-action').addEventListener('click',()=>this.activate('KeyX'));
    $('center-hand').addEventListener('click',()=>{this.pause();this.gestures.calibrate();});
    $('hand-reach').addEventListener('input',()=>{this.gestures.steering.sensitivity=Number($('hand-reach').value);$('reach-value').textContent=`${$('hand-reach').value}×`;});
    $('hand-smoothing').addEventListener('input',()=>{this.gestures.steering.smoothing=Number($('hand-smoothing').value);});
    $('sound-enabled').addEventListener('change',async()=>{await this.feedback.enable($('sound-enabled').checked);$('sound-enabled').checked=this.feedback.enabled;});
    $('practice-control').addEventListener('click',()=>this.practicing?this.endPractice():this.beginPractice());
    this.renderBadges();
    this.updateHud();
    requestAnimationFrame(t => this.frame(t));
  }

  readBest() {try {const value=Number(localStorage.getItem('orbit-warden-best'));return Number.isFinite(value)?Math.max(0,value):0;} catch {return 0;}}
  writeBest(score) {this.best = Math.max(this.best, score); try {localStorage.setItem('orbit-warden-best',String(this.best));} catch { /* private mode */ }}

  reset() {
    this.state = freshState();
    this.ship=$('ship-choice')?.value||'vanguard';this.mods=newLoadout(this.ship);
    this.state.maxHp=this.mods.maxHp;this.state.hp=this.mods.maxHp;
    this.refitting=false;this.selectedUpgrades=[];this.missiles=[];this.missileCooldown=0;this.wingCooldown=0;
    this.sectorHits=0;this.missileKills=0;this.wave=1;this.waveTimer=10;this.runHits=0;
    $('refit-overlay')?.classList.add('hidden');
    this.flightMode=$('flight-difficulty')?.value||'rookie';this.tuning=FLIGHT_MODES[this.flightMode];
    this.player = {x: WIDTH/2, y: HEIGHT-90, radius: this.tuning.hitbox};
    this.practicing=false;this.practicePower=new GesturePower();this.handLostTime=0;this.lastSteering=.5;
    this.combo=0;this.comboTime=0;this.notice='READY FOR LAUNCH';this.noticeTime=3;
    this.enemies = []; this.lasers = []; this.particles = []; this.floatingTexts = [];
    this.sector = 0; this.sectorTime = 0; this.bossSpawned = false;
    this.bullets = []; this.pickups = []; this.weapon = SHIPS[this.ship].weapon; this.upgrade = 0;
    this.dashCooldown = 0; this.novaCooldown = 0; this.novaRing = 0; this.kills = 0;
    this.overdrive=0;this.overdriveCooldown=0;this.target=null;this.bank=0;
    this.gesturePower.reset();
    this.spawnTimer = .7;
    this.fireCooldown = 0;
    this.hitCooldown = 0;this.contactCooldown=0;
    this.beaming = false;
    this.shielding = false;
    this.shake = 0;
    this.flash = 0;
    this.controls.clear();
  }

  attachControls() {
    const relevant = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','KeyC','KeyZ','KeyW','KeyS','KeyQ','KeyX','Digit1','Digit2','Digit3','KeyA','KeyD','KeyE','KeyP','KeyR','Escape','KeyG']);
    window.addEventListener('keydown', (event) => {
      if(this.refitting){
        if(event.code==='Tab'){
          const choices=[...$('refit-choices').querySelectorAll('button')],index=choices.indexOf(document.activeElement);
          event.preventDefault();choices[(index+(event.shiftKey?-1:1)+choices.length)%choices.length].focus();
        }
        if(['Digit1','Digit2','Digit3'].includes(event.code))this.chooseUpgrade(upgradeChoices(this.sector)[Number(event.code.at(-1))-1]);
        return;
      }
      if(event.target?.closest('input,select,textarea,[contenteditable="true"]') && !['Escape','KeyP'].includes(event.code))return;
      if(event.target?.closest('button,summary,a') && ['Space','Enter'].includes(event.code))return;
      if(!relevant.has(event.code))return;
      if (relevant.has(event.code)) event.preventDefault();
      if (event.repeat && ['KeyP','KeyR','KeyG'].includes(event.code)) return;
      if(event.code==='Space'&&!this.running&&!this.state.over&&!this.paused&&!this.practicing)this.start();
      this.controls.press(event.code,`key:${event.code}`);
      if (!event.repeat) this.action(event.code);
      if (event.code === 'KeyP') this.togglePause();
      if (event.code === 'KeyR') this.start();
      if (event.code === 'KeyG' && !event.repeat) this.gestures.toggle();
      if (event.code === 'Escape' && this.running && !this.paused) this.togglePause();
    });
    window.addEventListener('keyup', (e) => this.controls.release(`key:${e.code}`));
    for(const type of ['pointerup','pointercancel'])window.addEventListener(type,event=>this.controls.release(`pointer:${event.pointerId}`));
    window.addEventListener('blur', () => {this.controls.clear();this.pause();});
    $('start-button').addEventListener('click', () => { if (this.paused) this.resume(); else this.start(); });
    for (const [id,key] of [['touch-left','ArrowLeft'],['touch-right','ArrowRight'],['touch-fire','Space'],['touch-recharge','KeyE'],['touch-shield','ShiftLeft'],['touch-up','ArrowUp'],['touch-down','ArrowDown'],['touch-dash','KeyQ'],['touch-nova','KeyX']]) {
      const node=$(id);
      const down=(event)=>{
        event.preventDefault();if(!this.running&&!this.paused&&!this.practicing&&!this.refitting)this.start();
        this.controls.press(key,`pointer:${event.pointerId}`);this.action(key);
        try{node.setPointerCapture?.(event.pointerId);}catch{ /* Synthetic events and released pointers need no capture. */ }
      };
      const up=(event)=>{event.preventDefault();this.controls.release(`pointer:${event.pointerId}`);};
      node.addEventListener('pointerdown',down);
      node.addEventListener('pointerup',up);
      node.addEventListener('pointercancel',up);
      node.addEventListener('lostpointercapture',up);
    }
  }

  activate(key){
    this.action(key);
    if(this.running&&!this.paused&&!this.practicing)this.canvas.focus({preventScroll:true});
  }

  action(key) {
    if (!this.running || this.paused || this.practicing) return;
    if (['Digit1','Digit2','Digit3'].includes(key)) this.weapon = ['twin','spread','lance'][Number(key.at(-1))-1];
    if(key==='KeyC' && this.missileCooldown<=0 && this.mods.missiles>0){
      this.mods.missiles--;this.missileCooldown=3;this.feedback.play('power');
      for(const offset of [-1,0,1])this.missiles.push({x:this.player.x+offset*17,y:this.player.y-20,radius:7,vx:offset*100,vy:-280,life:4,target:null});
    }
    if(key === 'KeyQ' && canActivate(this.running,this.paused,this.dashCooldown)) {
      const direction = this.input.has('ArrowLeft') || this.input.has('KeyA') || (this.gestures.tracking && this.gestures.x<this.lastSteering-.005) ? -1 : 1;
      this.particlesAt(this.player.x,this.player.y,COLORS.purple,30,230);
      this.player.x=clamp(this.player.x+direction*190,35,WIDTH-35);
      this.hitCooldown= .65; this.dashCooldown=4;this.feedback.play('power');
    }
    if(key==='KeyZ' && canActivate(this.running,this.paused,this.overdriveCooldown)){
      this.feedback.play('power');this.announce('OVERDRIVE · WEAPONS AMPLIFIED');
      this.overdrive=6;this.overdriveCooldown=16;this.state.energy=100;
      this.particlesAt(this.player.x,this.player.y,COLORS.gold,45,240);
    }
    if(key === 'KeyX' && canActivate(this.running,this.paused,this.novaCooldown)) {
      this.feedback.play('power');this.announce('NOVA · THREAT FIELD CLEARED');
      this.novaCooldown=18; this.novaRing=1; this.bullets=[]; this.shake=.35;
      for(const enemy of [...this.enemies]) {
        enemy.hp-=30;
        if(enemy.hp<=0) this.destroyEnemy(enemy);
        if(!this.running||this.refitting)break;
      }
    }
  }

  destroyEnemy(enemy,source='weapon') {
    if(!this.running||this.paused||this.practicing||this.state.over)return;
    const index=this.enemies.indexOf(enemy); if(index<0)return;
    this.enemies.splice(index,1); this.kills++;
    this.unlockBadge('first');if(source==='missile'){this.missileKills++;if(this.missileKills>=10)this.unlockBadge('missile');}
    this.combo=this.comboTime>0?this.combo+1:1;this.comboTime=3;
    const multiplier=Math.min(5,1+Math.floor(this.combo/5));
    if(this.combo>=20)this.unlockBadge('chain');
    const points=enemy.boss?1000*(this.sector+1):ENEMY_TYPES[enemy.kind].points*multiplier;
    this.state.score+=points;this.feedback.play('kill');
    this.particlesAt(enemy.x,enemy.y,SECTORS[this.sector].color,enemy.boss?65:24,230);
    this.floatingTexts.push({x:enemy.x,y:enemy.y,text:enemy.boss?'SECTOR CLEARED':`+${points}${multiplier>1?' ×'+multiplier:''}`,life:.8});
    if(enemy.boss) {
      this.unlockBadge('commander');if(this.sectorHits===0)this.unlockBadge('untouched');
      this.upgrade++;this.state.hp=Math.min(this.mods.maxHp,this.state.hp+2);
      this.state.energy=100;this.novaCooldown=0;this.bullets=[];this.missiles=[];
      if(this.sector===SECTORS.length-1){
        this.running=false;this.writeBest(this.state.score);this.unlockBadge('clear');
        this.showOverlay('GALAXY SAVED',`${SHIPS[this.ship].name} completed the campaign! ${this.state.score.toLocaleString()} points · ${this.kills} kills · ${this.missileKills} missile kills · ${this.runHits} hull hits.`, 'NEW ADVENTURE','CAMPAIGN COMPLETE','R TO PLAY AGAIN');
      }else this.beginRefit();
    } else if(this.kills%5===0) {
      const kind=['repair','energy','shield'][Math.floor(Math.random()*3)];
      this.pickups.push({x:enemy.x,y:enemy.y,radius:16,kind});
    }
  }

  unlockBadge(key){
    if(this.badges.includes(key))return;
    this.badges.push(key);try{localStorage.setItem('orbit-warden-badges',JSON.stringify(this.badges));}catch{}
    this.renderBadges();
  }
  renderBadges(){
    const holder=$('pilot-badges');holder.replaceChildren();
    for(const key of Object.keys(BADGES)){const tag=document.createElement('span');tag.className=this.badges.includes(key)?'badge unlocked':'badge';tag.textContent=(this.badges.includes(key)?'✦ ':'◇ ')+BADGES[key];holder.append(tag);}
  }
  beginRefit(){
    this.refitting=true;this.paused=true;this.controls.clear();this.gesturePower.reset();
    $('overlay').classList.add('hidden');$('refit-overlay').classList.remove('hidden');
    $('refit-label').textContent=`${SECTORS[this.sector].name} cleared · choose your next upgrade`;
    $('refit-choices').replaceChildren();
    for(const key of upgradeChoices(this.sector)){
      const button=document.createElement('button');button.type='button';button.dataset.upgrade=key;
      const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=UPGRADES[key].name;detail.textContent=UPGRADES[key].description;button.append(title,detail);$('refit-choices').append(button);
    }
    $('refit-choices').querySelector('button').focus({preventScroll:true});
  }
  chooseUpgrade(key){
    if(!this.refitting||!upgradeChoices(this.sector).includes(key))return;
    applyUpgrade(this.mods,this.state,key);this.selectedUpgrades.push(key);
    this.sector++;this.sectorTime=0;this.sectorHits=0;this.wave=1;this.waveTimer=10;this.bossSpawned=false;
    this.enemies=[];this.pickups=[];this.lasers=[];this.bullets=[];this.missiles=[];
    this.mods.missiles=Math.min(5,this.mods.missiles+1);this.hitCooldown=2;
    this.refitting=false;this.paused=false;$('refit-overlay').classList.add('hidden');
    this.announce(`${SECTORS[this.sector].name.toUpperCase()} · ${UPGRADES[key].name.toUpperCase()} ONLINE`);this.canvas.focus({preventScroll:true});
  }
  updateMissiles(dt){
    for(let i=this.missiles.length-1;i>=0;i--){
      const m=this.missiles[i];m.life-=dt;
      if(!this.enemies.includes(m.target))m.target=assistedTarget(this.enemies,m)||this.enemies.find(e=>e.y<HEIGHT);
      if(m.target){const a=Math.atan2(m.target.y-m.y,m.target.x-m.x);m.vx=lerp(m.vx,Math.cos(a)*440,1-Math.exp(-dt*8));m.vy=lerp(m.vy,Math.sin(a)*440,1-Math.exp(-dt*8));}
      const from={x:m.x,y:m.y};m.x+=m.vx*dt;m.y+=m.vy*dt;
      const hit=firstCollision(from,m,this.enemies);
      if(hit){
        this.particlesAt(m.x,m.y,COLORS.gold,20,180);
        for(const e of [...this.enemies])if(Math.hypot(e.x-hit.x,e.y-hit.y)<75){e.hp-=this.mods.missileDamage;if(e.hp<=0)this.destroyEnemy(e,'missile');if(this.refitting||!this.running)break;}
        this.missiles.splice(i,1);if(this.refitting||!this.running)return;
      }else if(m.life<=0||m.y< -70||m.y>HEIGHT+70||m.x< -70||m.x>WIDTH+70)this.missiles.splice(i,1);
    }
  }
  start() {
    this.reset();this.announce(`${this.tuning.name.toUpperCase()} FLIGHT · SURVIVE, COLLECT, CONQUER`); this.running = true; this.paused = false;
    $('overlay').classList.add('hidden');
    this.canvas.focus({preventScroll:true});
  }
  beginPractice(){
    if(this.refitting)return;
    this.pause();this.controls.clear();this.practicing=true;this.practicePlayer={x:WIDTH/2,y:HEIGHT-90,radius:12};this.practicePower.reset();
    $('overlay').classList.add('hidden');this.canvas.focus({preventScroll:true});
  }
  endPractice(){
    this.practicing=false;
    if(this.running)this.resume();
    else this.showOverlay('DEFEND THE ORBIT.','Your controls are tuned. Start a mission when ready.','INITIATE DEFENSE','PILOT READY','ARROWS / WASD TO MOVE · SPACE TO FIRE');
  }
  steerPlayer(player,dt,camera){
    const dx=Number(this.input.has('ArrowRight')||this.input.has('KeyD'))-Number(this.input.has('ArrowLeft')||this.input.has('KeyA'));
    const dy=Number(this.input.has('ArrowDown')||this.input.has('KeyS'))-Number(this.input.has('ArrowUp')||this.input.has('KeyW'));
    const length=Math.max(1,Math.hypot(dx,dy));
    if(dx)player.x+=dx/length*390*dt;
    else if(camera)player.x=lerp(player.x,45+this.gestures.x*(WIDTH-90),1-Math.exp(-dt*18));
    if(dy)player.y+=dy/length*390*dt;
    else if(camera){const targetY=$('steer-mode').value==='relaxed'?HEIGHT-90:140+this.gestures.y*(HEIGHT-190);player.y=lerp(player.y,targetY,1-Math.exp(-dt*18));}
    player.x=clamp(player.x,35,WIDTH-35);player.y=clamp(player.y,100,HEIGHT-45);
  }
  announce(text){this.notice=text;this.noticeTime=3;}
  takeHit(){
    if(this.hitCooldown>0||this.state.over)return;
    this.runHits++;this.sectorHits++;
    damage(this.state);this.hitCooldown=.95;this.flash=.2;this.combo=0;this.comboTime=0;
    this.feedback.play('hit');this.announce(this.state.hp===1?'HULL CRITICAL · COLLECT REPAIR SALVAGE':'HULL HIT · SHIELD OR DASH TO EVADE');
    if(this.state.over)this.gameOver();
  }
  pause() {if (!this.running || this.paused || this.refitting) return;this.paused=true;this.controls.clear();this.gesturePower.reset();this.showOverlay('PAUSED', 'Take a moment. Your sector is secure for now.', 'RESUME MISSION', 'MISSION SUSPENDED', 'P TO RESUME · R TO RESTART');}
  resume() {if(!this.paused||this.refitting)return;this.paused=false;$('overlay').classList.add('hidden');this.canvas.focus({preventScroll:true});}
  togglePause() {if(this.practicing)return;if (this.paused) this.resume(); else this.pause();}
  gameOver() {
    if (!this.running) return;
    this.running=false;
    this.writeBest(this.state.score);
    this.showOverlay('GAME OVER', `You survived ${prettifyTime(this.state.elapsed)} and scored ${this.state.score.toLocaleString()} points. Your personal best: ${this.best.toLocaleString()}.`, 'TRY AGAIN', 'SECTOR LOST · SIGNAL TERMINATED', 'PRESS R TO RESTART');
  }
  showOverlay(title,detail,button,eyebrow,hint) {
    $('overlay-title').innerHTML = title.includes(' ') ? title.replace(' ', ' <span>') + '</span>' : title;
    $('overlay-detail').textContent=detail;
    $('start-button').innerHTML = `${button} <span>→</span>`;
    $('overlay-eyebrow').textContent=eyebrow;
    $('overlay-hint').textContent=hint;
    $('overlay').classList.remove('hidden');
    $('start-button').focus({preventScroll:true});
  }

  spawnEnemy(forcedKind=null) {
    const roll=Math.random();const kind=forcedKind||(this.sector>0&&roll<.12?'carrier':roll<.3?'interceptor':chooseEnemy());
    const spec = ENEMY_TYPES[kind];
    const baseX=random(spec.radius+50,WIDTH-spec.radius-50);
    this.enemies.push({kind, baseX, x:baseX, y:-55, radius:spec.radius, hp:spec.hp, maxHp:spec.hp, level:difficultyAt(this.state.elapsed), time:0, phase:random(0,TAU), rotation:random(0,TAU), spin:random(-1.5,1.5),attackTimer:2});
  }

  particlesAt(x,y,color,count=12,power=150) {
    for(let i=0;i<count;i++) {
      const a=random(0,TAU), v=random(30,power), life=random(.23,.64);
      this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,maxLife:life,color,radius:random(1.1,3.4)});
    }
    if(this.particles.length>650)this.particles.splice(0,this.particles.length-650);
  }

  fire() {
    const weapon=WEAPONS[this.weapon];
    const cost=weapon.cost*this.mods.cost*(this.overdrive>0?.4:1);
    if(this.fireCooldown>0 || this.state.energy<cost || this.state.over)return;
    this.fireCooldown=weapon.cooldown*this.mods.fireRate*(this.overdrive>0?.5:1);
    const target=$('aim-assist').checked?assistedTarget(this.enemies,this.player,this.target):null;
    this.target=target;
    const aim=target?clamp(Math.atan2(target.x-this.player.x,this.player.y-target.y),-.65,.65):0;
    this.state.energy-=cost;
    weapon.angles.forEach((offset,i)=>{const angle=offset+aim;this.lasers.push({
      x:this.player.x+(this.weapon==='twin'?(i===0?-9:9):0),y:this.player.y-25,radius:this.weapon==='lance'?9:5,
      vx:Math.sin(angle)*690,vy:-Math.cos(angle)*690,damage:weapon.damage+this.upgrade+this.mods.damage+(this.overdrive>0?1:0),color:this.overdrive>0?COLORS.gold:this.weapon==='lance'?COLORS.purple:COLORS.cyan,
    });});
    this.particlesAt(this.player.x,this.player.y-28,COLORS.cyan,4,40);this.feedback.play('shot');
  }

  handleEnemyCollision(enemy) {
    if (!collision(enemy,this.player))return false;
    if(enemy.boss && (this.hitCooldown>0||this.contactCooldown>0))return false;
    this.contactCooldown=.25;
    this.particlesAt(enemy.x,enemy.y,COLORS.red,18,200);
    this.shake=Math.max(this.shake,.22);
    if(this.shielding && this.state.shield>0){this.state.shield=clamp(this.state.shield-16,0,100);this.particlesAt(this.player.x,this.player.y,COLORS.cyan,17,90);}
    else if(this.hitCooldown<=0) {
      this.takeHit();
    }
    return !enemy.boss;
  }

  update(dt,now) {
    this.gestures.tick(now);
    const camera=this.gestures.enabled && this.gestures.tracking;
    if(this.practicing){this.steerPlayer(this.practicePlayer,dt,camera);this.practicePower.update(camera?this.gestures.label:'none',dt);return;}
    if (!this.running || this.paused) return;
    const s=this.state;
    if(camera){this.handLostTime=0;}
    else if(this.gestures.enabled){
      this.handLostTime+=dt;
      if(this.handLostTime>=.8 && $('pause-hand-loss').checked){
        this.pause();this.showOverlay('HAND SIGNAL LOST','Your mission is paused. Show your hand in the camera, or disable the camera to use keys or touch. Resume when ready.','RESUME MISSION','PILOT SAFETY','CAMERA POWERS ARE RELEASED');return;
      }
    }
    const pose=camera?this.gestures.label:'none';
    const power=this.gesturePower.update(pose,dt);
    if(power)this.action(power==='nova'?'KeyX':power==='missiles'?'KeyC':'KeyZ');
    if(!this.running||this.paused)return;
    for(const key of ['missileCooldown','wingCooldown','fireCooldown','contactCooldown','hitCooldown','dashCooldown','novaCooldown','novaRing','overdrive','overdriveCooldown','shake','flash','noticeTime','comboTime'])this[key]=Math.max(0,this[key]-dt);
    if(this.comboTime===0)this.combo=0;
    s.elapsed+=dt;this.sectorTime+=dt;
    const previousX=this.player.x;
    this.steerPlayer(this.player,dt,camera);
    this.lastSteering=camera?this.gestures.x:.5;
    this.bank=lerp(this.bank,clamp((this.player.x-previousX)*.025,-.25,.25),1-Math.exp(-dt*10));
    this.shielding=(this.input.has('ShiftLeft')||this.input.has('ShiftRight')||(camera && pose==='shield')) && s.shield>0;
    this.beaming=(this.input.has('KeyE')||(camera && pose==='recharge')) && !this.shielding;
    s.shield=clamp(s.shield+(this.shielding?-30:14+this.mods.shieldRegen)*dt,0,100);
    s.energy=clamp(s.energy+(this.beaming?75:this.overdrive>0?45:26+this.mods.recharge)*dt,0,100);
    if(this.input.has('Space')||(camera && (pose==='fire'||($('camera-autofire').checked && ['move','nova','overdrive','missiles'].includes(pose)))))this.fire();
    if(this.mods.wings && this.wingCooldown<=0 && this.enemies.length){
      this.wingCooldown=.65;for(const side of [-1,1])this.lasers.push({x:this.player.x+side*55,y:this.player.y-20,radius:5,vx:0,vy:-620,damage:2,color:'#91ffc9'});
    }
    this.waveTimer-=dt;
    if(this.waveTimer<=0&&!this.bossSpawned&&this.wave<3){
      this.wave++;this.waveTimer=10;this.announce(`WAVE ${this.wave} · INTERCEPTOR SQUADRON`);
      for(let n=0;n<3&&this.enemies.length<28;n++){this.spawnEnemy(n===1&&this.sector>0?'carrier':'interceptor');const enemy=this.enemies.at(-1);enemy.baseX=WIDTH/2+(n-1)*110;enemy.x=enemy.baseX;enemy.y=-50-n*45;enemy.level*=this.tuning.speed;}
    }
    if(this.sectorTime>=30 && !this.bossSpawned) {
      this.bossSpawned=true;const spec=SECTORS[this.sector];this.announce(`${spec.boss.toUpperCase()} INBOUND · DODGE THE RED WARNING LINES`);
      this.enemies.push({kind:'tank',boss:true,x:WIDTH/2,y:90,radius:55,hp:spec.hp,maxHp:spec.hp,time:0,shotTimer:1.5,rotation:0,spin:0,phase:1,cycle:0});
    }
    for(let i=this.pickups.length-1;i>=0;i--){
      const p=this.pickups[i];p.y+=85*dt;
      if(Math.hypot(p.x-this.player.x,p.y-this.player.y)<140){p.x=lerp(p.x,this.player.x,Math.min(1,dt*5));p.y=lerp(p.y,this.player.y,Math.min(1,dt*5));}
      if(collision(p,{...this.player,radius:24})){collectSalvage(s,p.kind);this.feedback.play('pickup');this.pickups.splice(i,1);this.floatingTexts.push({x:p.x,y:p.y,text:p.kind.toUpperCase(),life:.8});}
      else if(p.y>HEIGHT+20)this.pickups.splice(i,1);
    }
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i],from={x:b.x,y:b.y};b.x+=b.vx*dt;b.y+=b.vy*dt;
      if(sweptCollision(from,b,this.player)){
        if(this.shielding && s.shield>0)s.shield=clamp(s.shield-12,0,100);else this.takeHit();
        this.bullets.splice(i,1);if(s.over)return;
      }else if(b.y>HEIGHT+30 || b.y< -30 || b.x< -30 || b.x>WIDTH+30)this.bullets.splice(i,1);
    }
    if(s.over)return;
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0 && !this.bossSpawned && this.enemies.length<28){this.spawnEnemy();this.enemies.at(-1).level*=this.tuning.speed;this.spawnTimer=random(.4,.85)/difficultyAt(s.elapsed)/this.tuning.speed;}
    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i];
      if(e.boss){
        e.time+=dt;e.x=WIDTH/2+Math.sin(e.time*.8)*300;e.shotTimer-=dt;
        const phase=e.hp<=e.maxHp*.5?2:1;
        if(phase!==e.phase){e.phase=phase;this.announce(`${SECTORS[this.sector].boss.toUpperCase()} · PHASE TWO`);}
        if(e.shotTimer<=.55 && !e.volley){e.aim=Math.atan2(this.player.y-e.y,this.player.x-e.x);e.volley=bossVolley(this.sector,e.phase,e.cycle,e.aim);}
        if(e.shotTimer<=0){
          for(const angle of e.volley)this.bullets.push({x:e.x,y:e.y+30,radius:7,vx:Math.cos(angle)*210*this.tuning.projectileSpeed,vy:Math.sin(angle)*210*this.tuning.projectileSpeed});
          e.cycle++;e.shotTimer=Math.max(.85,1.8-this.sector*.2-(phase===2?.2:0));delete e.aim;delete e.volley;
        }
      }else{
        moveEnemy(e,dt);
        if(['interceptor','carrier'].includes(e.kind)&&e.y>70&&e.y<380){
          e.attackTimer-=dt;
          if(e.attackTimer<=.45&&e.aim===undefined)e.aim=Math.atan2(this.player.y-e.y,this.player.x-e.x);
          if(e.attackTimer<=0){const count=e.kind==='carrier'?3:1;for(let n=0;n<count;n++){const a=e.aim+(n-(count-1)/2)*.2;this.bullets.push({x:e.x,y:e.y,radius:6,vx:Math.cos(a)*155*this.tuning.projectileSpeed,vy:Math.sin(a)*155*this.tuning.projectileSpeed});}e.attackTimer=2.6;delete e.aim;}
        }
      }
      e.rotation+=e.spin*dt;
      if(e.y>HEIGHT+50){this.enemies.splice(i,1);continue;}
      if(this.handleEnemyCollision(e))this.enemies.splice(i,1);
      if(s.over)return;
    }
    if(s.over)return;
    this.updateMissiles(dt);if(this.refitting||!this.running)return;
    const shotSector=this.sector;
    for(let i=this.lasers.length-1;i>=0;i--){
      const laser=this.lasers[i],from={x:laser.x,y:laser.y};laser.y+=laser.vy*dt;laser.x+=laser.vx*dt;
      const enemy=firstCollision(from,laser,this.enemies);
      if(enemy){enemy.hp-=laser.damage;this.particlesAt(laser.x,laser.y,laser.color||COLORS.cyan,5,65);if(enemy.hp<=0)this.destroyEnemy(enemy);}
      if(enemy||laser.y< -25||laser.x< -30||laser.x>WIDTH+30)this.lasers.splice(i,1);
      if(!this.running || this.refitting || this.sector!==shotSector)return;
    }
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.99;p.vy*=.99;p.life-=dt;if(p.life<=0)this.particles.splice(i,1);}
    for(let i=this.floatingTexts.length-1;i>=0;i--){const v=this.floatingTexts[i];v.y-=35*dt;v.life-=dt;if(v.life<=0)this.floatingTexts.splice(i,1);}
  }

  background(ctx,time){
    const g=ctx.createLinearGradient(0,0,0,HEIGHT);g.addColorStop(0,'#09152f');g.addColorStop(.55,'#070f23');g.addColorStop(1,'#050d1a');ctx.fillStyle=g;ctx.fillRect(0,0,WIDTH,HEIGHT);
    const glow=ctx.createRadialGradient(WIDTH*.63,HEIGHT*.24,5,WIDTH*.63,HEIGHT*.24,420);glow.addColorStop(0,SECTORS[this.sector].color+'30');glow.addColorStop(.45,'#16296326');glow.addColorStop(1,'#00111b00');ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(const s of this.stars){const y=(s.y+time*14*s.speed)%HEIGHT;ctx.fillStyle=`rgba(155,209,242,${s.light})`;ctx.beginPath();ctx.arc(s.x,y,s.r,0,TAU);ctx.fill();}
    ctx.strokeStyle='#375e8a13';ctx.lineWidth=1;
    for(let x=0;x<WIDTH;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
    for(let y=0;y<HEIGHT;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.strokeStyle='#237ac51e';ctx.beginPath();ctx.arc(WIDTH*.68,-130,255,0,Math.PI*2);ctx.stroke();
    ctx.font='11px monospace';ctx.fillStyle='#6488a050';ctx.fillText(`SECTOR ${this.sector+1} / ${SECTORS[this.sector].name.toUpperCase()}`,WIDTH-230,HEIGHT-27);
  }

  drawAsteroid(ctx,e){
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation);
    ctx.shadowColor='#adbad34d';ctx.shadowBlur=11;ctx.fillStyle='#5f6c87';ctx.strokeStyle='#a9b6ca';ctx.lineWidth=2;
    ctx.beginPath();const points=10;for(let i=0;i<points;i++){const a=i/points*TAU, r=e.radius*(i%3===0?.82:i%4===0?1.12:1);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#36445e';for(const [x,y,r] of [[-7,-5,6],[8,5,5],[-4,11,3]]){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}ctx.restore();
  }
  drawDrone(ctx,e){
    ctx.save();ctx.translate(e.x,e.y);ctx.shadowBlur=14;
    const col=e.kind==='interceptor'?'#91ffc9':e.kind==='carrier'?'#ff9c61':e.kind==='drone'?COLORS.red:e.kind==='zigzag'?COLORS.purple:COLORS.gold;
    ctx.shadowColor=col;ctx.strokeStyle=col;ctx.fillStyle=e.kind==='tank'?'#25263b':'#181c35';ctx.lineWidth=e.kind==='tank'?4:2.6;
    ctx.beginPath();ctx.moveTo(0,-e.radius);ctx.lineTo(e.radius,0);ctx.lineTo(0,e.radius);ctx.lineTo(-e.radius,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-e.radius-13,0);ctx.lineTo(e.radius+13,0);ctx.moveTo(-e.radius+2,-9);ctx.lineTo(-e.radius-12,7);ctx.moveTo(e.radius-2,-9);ctx.lineTo(e.radius+12,7);ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();ctx.shadowBlur=0;
    if(e.hp<e.maxHp){ctx.strokeStyle='#f7f1f1a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.radius,-e.radius-8);ctx.lineTo(-e.radius+2*e.radius*(e.hp/e.maxHp),-e.radius-8);ctx.stroke();}
    ctx.restore();
    if(e.aim!==undefined){ctx.save();ctx.strokeStyle='#ff698b80';ctx.lineWidth=2;ctx.setLineDash([8,12]);for(const a of (e.volley||[e.aim])){ctx.beginPath();ctx.moveTo(e.x,e.y+30);ctx.lineTo(e.x+Math.cos(a)*800,e.y+30+Math.sin(a)*800);ctx.stroke();}ctx.restore();}
  }
  drawShip(ctx,time,player=this.player){
    const {x,y}=player;
    if(this.beaming){const g=ctx.createLinearGradient(x,0,x,y);g.addColorStop(0,'#49d9f700');g.addColorStop(1,'#49d9f73e');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-95,0);ctx.lineTo(x+95,0);ctx.lineTo(x+18,y-25);ctx.lineTo(x-18,y-25);ctx.closePath();ctx.fill();ctx.strokeStyle='#4ce5ff70';ctx.lineWidth=2;ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,y-25);ctx.stroke();ctx.setLineDash([]);}
    ctx.save();ctx.translate(x,y);ctx.rotate(this.bank);
    if(this.hitCooldown>0&&Math.floor(time*16)%2===0)ctx.globalAlpha=.5;
    const accent=this.overdrive>0?COLORS.gold:SHIPS[this.ship].color;
    // Twin engine plumes, armor wings, recessed canopy and independent cannons.
    ctx.shadowColor=accent;ctx.shadowBlur=this.overdrive>0?35:18;
    for(const side of [-1,1]){
      const ex=side*19,flame=22+Math.sin(time*35)*7+(this.overdrive>0?25:0);
      const exhaust=ctx.createLinearGradient(0,20,0,20+flame);
      exhaust.addColorStop(0,'#f5faff');exhaust.addColorStop(.3,accent);exhaust.addColorStop(1,'#49e7ff00');
      ctx.fillStyle=exhaust;ctx.beginPath();ctx.moveTo(ex-7,22);ctx.lineTo(ex+7,22);ctx.lineTo(ex+3,22+flame);ctx.lineTo(ex-3,22+flame);ctx.closePath();ctx.fill();
      ctx.fillStyle='#142a49';ctx.strokeStyle=accent;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(side*10,-8);ctx.lineTo(side*41,22);ctx.lineTo(side*37,32);ctx.lineTo(side*12,19);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle='#a9c8e1';ctx.fillRect(side*29-3,-8,6,29);ctx.fillStyle=accent;ctx.fillRect(side*29-2,-12,4,9);
    }
    const armor=ctx.createLinearGradient(-16,0,16,0);armor.addColorStop(0,'#3c5b7b');armor.addColorStop(.5,'#edf7ff');armor.addColorStop(1,'#6488a7');
    ctx.fillStyle=armor;ctx.strokeStyle=accent;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(0,-39);ctx.lineTo(16,6);ctx.lineTo(13,28);ctx.lineTo(-13,28);ctx.lineTo(-16,6);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.shadowBlur=8;ctx.fillStyle='#081c38';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(8,1);ctx.lineTo(0,9);ctx.lineTo(-8,1);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=accent;ctx.fillRect(-3,13,6,9);ctx.restore();
    if(this.mods.wings && !this.practicing){for(const side of [-1,1]){ctx.save();ctx.translate(x+side*(55+Math.sin(time*3)*5),y-10);ctx.fillStyle='#91ffc9';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(9,9);ctx.lineTo(-9,9);ctx.closePath();ctx.fill();ctx.restore();}}
    if(this.overdrive>0){ctx.save();ctx.translate(x,y);ctx.rotate(-time*2);ctx.strokeStyle=COLORS.gold;ctx.lineWidth=2;ctx.setLineDash([13,9]);ctx.beginPath();ctx.arc(0,0,54,0,TAU);ctx.stroke();ctx.restore();}
    if(this.target && this.enemies.includes(this.target)){
      const t=this.target;ctx.save();ctx.strokeStyle=accent;ctx.globalAlpha=.6;ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.arc(t.x,t.y,t.radius+9,0,TAU);ctx.stroke();ctx.restore();
    }

    ctx.save();ctx.strokeStyle='#ffffff65';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,player.radius,0,TAU);ctx.stroke();ctx.fillStyle=accent;ctx.beginPath();ctx.arc(x,y,3,0,TAU);ctx.fill();ctx.restore();
    if(this.shielding){ctx.save();ctx.strokeStyle=COLORS.cyan;ctx.shadowColor=COLORS.cyan;ctx.shadowBlur=24;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,43,0,TAU);ctx.stroke();ctx.globalAlpha=.14;ctx.fillStyle=COLORS.cyan;ctx.fill();ctx.restore();}
  }
  render(time){
    const ctx=this.ctx;
    if(this.practicing){
      this.background(ctx,time*.001);this.drawShip(ctx,time*.001,this.practicePlayer);
      ctx.save();ctx.fillStyle=COLORS.cyan;ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillText('CONTROL LAB · NO DAMAGE · NO TIMERS',WIDTH/2,100);
      ctx.font='16px monospace';ctx.fillStyle=COLORS.white;ctx.fillText('Center your hand · test reach and smoothing · try each pose',WIDTH/2,135);
      const pose=this.gestures.tracking?this.gestures.label.toUpperCase():'SHOW YOUR HAND OR USE ARROW KEYS';
      ctx.fillText(pose,WIDTH/2,195);ctx.strokeStyle=COLORS.purple;ctx.lineWidth=4;ctx.beginPath();ctx.arc(this.practicePlayer.x,this.practicePlayer.y,48,-Math.PI/2,-Math.PI/2+this.practicePower.progress*TAU);ctx.stroke();ctx.restore();return;
    }
    ctx.save();if(this.shake>0 && !$('reduced-motion').checked){ctx.translate(random(-7,7)*this.shake*4,random(-7,7)*this.shake*4);}
    this.background(ctx,this.state.elapsed + time*.00007);
    for(const e of this.enemies){if(e.kind==='asteroid')this.drawAsteroid(ctx,e);else this.drawDrone(ctx,e);}
    for(const l of this.lasers){ctx.save();ctx.strokeStyle=l.color||COLORS.cyan;ctx.shadowBlur=19;ctx.shadowColor=ctx.strokeStyle;ctx.lineWidth=l.radius>5?7:4;const angle=Math.atan2(l.vx,-l.vy);ctx.beginPath();ctx.moveTo(l.x-Math.sin(angle)*18,l.y+Math.cos(angle)*18);ctx.lineTo(l.x+Math.sin(angle)*20,l.y-Math.cos(angle)*20);ctx.stroke();ctx.restore();}
    for(const m of this.missiles){ctx.save();ctx.translate(m.x,m.y);ctx.rotate(Math.atan2(m.vy,m.vx)+Math.PI/2);ctx.fillStyle=COLORS.gold;ctx.shadowColor=COLORS.gold;ctx.shadowBlur=16;ctx.fillRect(-4,-12,8,23);ctx.fillStyle='#fff1c5';ctx.fillRect(-2,10,4,15);ctx.restore();}
    for(const b of this.bullets){ctx.fillStyle=COLORS.red;ctx.beginPath();ctx.arc(b.x,b.y,b.radius,0,TAU);ctx.fill();}
    for(const p of this.pickups){ctx.fillStyle=p.kind==='repair'?'#65ffb0':p.kind==='energy'?COLORS.cyan:COLORS.purple;ctx.strokeStyle=ctx.fillStyle;ctx.strokeRect(p.x-14,p.y-14,28,28);ctx.font='bold 20px monospace';ctx.textAlign='center';ctx.fillText(p.kind==='repair'?'+':p.kind==='energy'?'E':'S',p.x,p.y+7);ctx.textAlign='start';}
    if(this.novaRing>0){ctx.strokeStyle=COLORS.purple;ctx.lineWidth=6;ctx.beginPath();ctx.arc(this.player.x,this.player.y,(1-this.novaRing)*1100,0,TAU);ctx.stroke();}
    const boss=this.enemies.find(e=>e.boss);
    if(boss){ctx.fillStyle='#251b35';ctx.fillRect(240,38,480,10);ctx.fillStyle=COLORS.red;ctx.fillRect(240,38,480*boss.hp/boss.maxHp,10);ctx.textAlign='center';ctx.font='bold 14px monospace';ctx.fillText(`${SECTORS[this.sector].boss.toUpperCase()} · PHASE ${boss.phase||1}`,WIDTH/2,30);ctx.textAlign='start';}
    this.drawShip(ctx,time*.001);
    for(const p of this.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.shadowBlur=9;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();}
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    for(const f of this.floatingTexts){ctx.save();ctx.globalAlpha=f.life/.8;ctx.fillStyle=COLORS.cyan;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.restore();}
    if(this.noticeTime>0){ctx.save();ctx.fillStyle='#081526d9';ctx.fillRect(80,70,800,42);ctx.fillStyle=COLORS.cyan;ctx.textAlign='center';ctx.font='bold 15px monospace';ctx.fillText(this.notice,WIDTH/2,96);ctx.restore();}
    if(this.flash>0 && !$('reduced-motion').checked){ctx.fillStyle=`rgba(255,60,97,${this.flash*.65})`;ctx.fillRect(0,0,WIDTH,HEIGHT);}
    ctx.restore();
  }

  updateHud(){
    const s=this.state;
    $('flight-difficulty').disabled=this.running;$('ship-choice').disabled=this.running;$('practice-control').disabled=this.refitting;
    $('missile-action').disabled=!this.running||this.paused||this.mods.missiles===0||this.missileCooldown>0;
    $('missile-action').textContent=`C · MISSILES ${this.mods.missiles}${this.missileCooldown>0?' · '+Math.ceil(this.missileCooldown)+'s':''}`;
    $('run-build').textContent=`${SHIPS[this.ship].name} · WAVE ${this.wave}/3 · ${this.selectedUpgrades.length?this.selectedUpgrades.map(k=>UPGRADES[k].name).join(' + '):'Choose upgrades after each commander'}`;
    $('combo-readout').textContent=this.combo>0?`${this.combo} CHAIN · ×${Math.min(5,1+Math.floor(this.combo/5))}`:'BUILD A KILL CHAIN';
    $('combo-fill').style.width=`${this.comboTime/3*100}%`;
    $('hold-fill').style.width=`${(this.practicing?this.practicePower:this.gesturePower).progress*100}%`;
    $('practice-control').textContent=this.practicing?'EXIT CONTROL LAB ↗':'CONTROL LAB ↗';
    $('sector-name').textContent=`${this.sector+1} / 3 · ${SECTORS[this.sector].name}`;
    $('mission-objective').textContent=this.refitting?'SECTOR SECURED · CHOOSE A REFIT':this.practicing?'CONTROL LAB · YOUR MISSION IS SAFE':this.bossSpawned?`Defeat ${SECTORS[this.sector].boss}`:`Survive to commander arrival · ${Math.max(0,Math.ceil(30-this.sectorTime))}s`;
    $('loadout').textContent=`${WEAPONS[this.weapon].name} MK ${this.upgrade+1} · ${this.kills} kills`;
    $('dash-action').textContent=`Q · DASH ${this.dashCooldown>0?Math.ceil(this.dashCooldown)+'s':'READY'}`;
    $('nova-action').textContent=`X · NOVA ${this.novaCooldown>0?Math.ceil(this.novaCooldown)+'s':'READY'}`;
    for(const button of document.querySelectorAll('[data-weapon]'))button.setAttribute('aria-pressed',String(button.dataset.weapon===this.weapon));
    $('overdrive-action').textContent=this.overdrive>0?`Z · OVERDRIVE ${Math.ceil(this.overdrive)}s`:`Z · OVERDRIVE ${this.overdriveCooldown>0?Math.ceil(this.overdriveCooldown)+'s':'READY'}`;
    const displayedPower=this.practicing?this.practicePower:this.gesturePower;
    $('power-status').textContent=this.gestures.enabled?(this.gestures.tracking?`HAND LINKED · ${this.gestures.label.toUpperCase()}${displayedPower.progress>0?' · '+Math.round(displayedPower.progress*100)+'%':''}`:'SHOW YOUR HAND · POWERS SAFE'):'CAMERA OFF · KEYBOARD READY';
    $('score').textContent=String(s.score).padStart(6,'0');
    $('timer').textContent=prettifyTime(s.elapsed);
    $('difficulty').textContent=`${(difficultyAt(s.elapsed)*this.tuning.speed).toFixed(1)}×`;
    $('hp').textContent=Array.from({length:this.mods.maxHp},(_,i)=>i<s.hp?'♥':'♡').join(' ');
    $('hp').setAttribute('aria-label',`${s.hp} of ${this.mods.maxHp} health`);
    $('energy-fill').style.width=`${s.energy}%`;
    $('shield-fill').style.width=`${s.shield}%`;
    $('energy-label').textContent=`${Math.round(s.energy)}%`;
    $('shield-label').textContent=`${Math.round(s.shield)}%`;
    $('best-score').textContent=`PERSONAL BEST ${String(this.best).padStart(6,'0')}`;
    $('game-status').textContent=this.refitting?'REFIT STATION · COMBAT SUSPENDED':this.practicing?'CONTROL LAB · PRACTICE WITHOUT DAMAGE':s.over?'GAME OVER · SIGNAL LOST':this.paused?'PAUSED · AWAITING ORDERS':this.running?'DEFENSE ACTIVE · HOSTILES INBOUND':'STANDBY · AWAITING PILOT';
  }

  frame(now){
    const dt=Math.min(.05,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;
    this.update(dt,now);this.render(now);this.updateHud();requestAnimationFrame(t=>this.frame(t));
  }
}

export let game=null;
if(typeof document!=='undefined')game=new OrbitWarden();
