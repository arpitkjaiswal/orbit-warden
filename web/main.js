import {WIDTH, HEIGHT, STARTING_HP, ENEMY_TYPES, clamp, collision, difficultyAt, damage, award, freshState, chooseEnemy, moveEnemy} from './logic.js';
import {GestureTracker} from './gestures.js';

const $ = (id) => document.getElementById(id);
const TAU = Math.PI * 2;
const COLORS = { cyan: '#49e7ff', purple: '#aa8eff', red: '#ff698b', gold: '#ffca72', white: '#edf6ff' };
const random = (min, max) => min + Math.random() * (max - min);
const lerp = (a,b,t) => a+(b-a)*t;
const prettifyTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(Math.floor(seconds % 60)).padStart(2,'0')}`;

class OrbitWarden {
  constructor() {
    this.canvas = $('game');
    this.ctx = this.canvas.getContext('2d');
    this.input = new Set();
    this.stars = Array.from({length: 180}, () => ({ x: Math.random()*WIDTH, y: Math.random()*HEIGHT, r: random(.5,2), speed: random(.15, 1.0), light: random(.15,.8) }));
    this.gestures = new GestureTracker({video:$('camera'), overlay:$('hand-overlay'), placeholder:$('camera-placeholder'), button:$('gesture-toggle'), label:$('gesture-name'), confidence:$('gesture-confidence'), status:$('gesture-status'), feedLabel:$('camera-label')});
    this.best = this.readBest();
    this.running = false;
    this.paused = false;
    this.lastFrame = performance.now();
    this.reset();
    this.attachControls();
    this.updateHud();
    requestAnimationFrame(t => this.frame(t));
  }

  readBest() {try {return Math.max(0, Number(localStorage.getItem('orbit-warden-best')||0));} catch {return 0;}}
  writeBest(score) {this.best = Math.max(this.best, score); try {localStorage.setItem('orbit-warden-best',String(this.best));} catch { /* private mode */ }}

  reset() {
    this.state = freshState();
    this.player = {x: WIDTH/2, y: HEIGHT-90, radius: 20};
    this.enemies = []; this.lasers = []; this.particles = []; this.floatingTexts = [];
    this.spawnTimer = .7;
    this.fireCooldown = 0;
    this.hitCooldown = 0;
    this.beaming = false;
    this.shielding = false;
    this.shake = 0;
    this.flash = 0;
    this.input.clear();
  }

  attachControls() {
    const relevant = new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','ShiftLeft','ShiftRight','KeyA','KeyD','KeyE','KeyP','KeyR','Escape','KeyG']);
    window.addEventListener('keydown', (event) => {
      if (relevant.has(event.code)) event.preventDefault();
      if (event.repeat && ['KeyP','KeyR','KeyG'].includes(event.code)) return;
      this.input.add(event.code);
      if (event.code === 'KeyP') this.togglePause();
      if (event.code === 'KeyR') this.start();
      if (event.code === 'KeyG' && !event.repeat) this.gestures.toggle();
      if (event.code === 'Escape' && this.running && !this.paused) this.togglePause();
      if (event.code === 'Space' && !this.running && !this.state.over && !this.paused) this.start();
    });
    window.addEventListener('keyup', (e) => this.input.delete(e.code));
    window.addEventListener('blur', () => this.input.clear());
    $('start-button').addEventListener('click', () => { if (this.paused) this.resume(); else this.start(); });
    for (const [id,key] of [['touch-left','ArrowLeft'],['touch-right','ArrowRight'],['touch-fire','Space'],['touch-recharge','KeyE'],['touch-shield','ShiftLeft']]) {
      const node=$(id);
      const down=(event)=>{event.preventDefault();if(!this.running && !this.paused)this.start();this.input.add(key);node.setPointerCapture?.(event.pointerId);};
      const up=(event)=>{event.preventDefault();this.input.delete(key);};
      node.addEventListener('pointerdown',down);
      node.addEventListener('pointerup',up);
      node.addEventListener('pointercancel',up);
      node.addEventListener('lostpointercapture',up);
    }
  }

  start() {
    this.reset(); this.running = true; this.paused = false;
    $('overlay').classList.add('hidden');
    this.canvas.focus({preventScroll:true});
  }
  pause() {if (!this.running || this.paused) return;this.paused=true;this.showOverlay('PAUSED', 'Take a moment. Your sector is secure for now.', 'RESUME MISSION', 'MISSION SUSPENDED', 'P TO RESUME · R TO RESTART');}
  resume() {if(!this.paused)return;this.paused=false;$('overlay').classList.add('hidden');this.canvas.focus({preventScroll:true});}
  togglePause() {if (this.paused) this.resume(); else this.pause();}
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
  }

  spawnEnemy() {
    const kind = chooseEnemy();
    const spec = ENEMY_TYPES[kind];
    const baseX=random(spec.radius+50,WIDTH-spec.radius-50);
    this.enemies.push({kind, baseX, x:baseX, y:-55, radius:spec.radius, hp:spec.hp, maxHp:spec.hp, level:difficultyAt(this.state.elapsed), time:0, phase:random(0,TAU), rotation:random(0,TAU), spin:random(-1.5,1.5)});
  }

  particlesAt(x,y,color,count=12,power=150) {
    for(let i=0;i<count;i++) {
      const a=random(0,TAU), v=random(30,power), life=random(.23,.64);
      this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life,maxLife:life,color,radius:random(1.1,3.4)});
    }
    if(this.particles.length>650)this.particles.splice(0,this.particles.length-650);
  }

  fire() {
    if(this.fireCooldown>0 || this.state.energy<8 || this.state.over)return;
    this.fireCooldown=.16;
    this.state.energy=clamp(this.state.energy-8,0,100);
    this.lasers.push({x:this.player.x-7,y:this.player.y-20,radius:5},{x:this.player.x+7,y:this.player.y-20,radius:5});
    this.particlesAt(this.player.x,this.player.y-28,COLORS.cyan,4,40);
  }

  handleEnemyCollision(enemy) {
    if (!collision(enemy,this.player))return false;
    this.particlesAt(enemy.x,enemy.y,COLORS.red,18,200);
    this.shake=Math.max(this.shake,.22);
    if(this.shielding && this.state.shield>0){this.state.shield=clamp(this.state.shield-16,0,100);this.particlesAt(this.player.x,this.player.y,COLORS.cyan,17,90);}
    else if(this.hitCooldown<=0) {
      damage(this.state);
      this.hitCooldown=.9;
      this.flash=.2;
      if(this.state.over){this.particlesAt(this.player.x,this.player.y,COLORS.red,65,270);this.gameOver();}
    }
    return true;
  }

  update(dt,now) {
    this.gestures.tick(now);
    if (!this.running || this.paused) return;
    const s=this.state;
    s.elapsed += dt;
    this.fireCooldown=Math.max(0,this.fireCooldown-dt);
    this.hitCooldown=Math.max(0,this.hitCooldown-dt);
    this.shake=Math.max(0,this.shake-dt);
    this.flash=Math.max(0,this.flash-dt);
    const dx=Number(this.input.has('ArrowRight')||this.input.has('KeyD'))-Number(this.input.has('ArrowLeft')||this.input.has('KeyA'));
    if(dx)this.player.x+=dx*390*dt;
    else if(this.gestures.enabled && this.gestures.label!=='none')this.player.x=lerp(this.player.x,45+this.gestures.x*(WIDTH-90),Math.min(1,dt*7));
    this.player.x=clamp(this.player.x,35,WIDTH-35);
    this.shielding=(this.input.has('ShiftLeft')||this.input.has('ShiftRight')||(this.gestures.enabled && this.gestures.label==='shield')) && s.shield>0;
    this.beaming=(this.input.has('KeyE')||(this.gestures.enabled && this.gestures.label==='recharge')) && !this.shielding;
    if(this.shielding)s.shield=clamp(s.shield-38*dt,0,100);
    else s.shield=clamp(s.shield+10*dt,0,100);
    s.energy=clamp(s.energy+(this.beaming?32:5)*dt,0,100);
    if(this.input.has('Space')||(this.gestures.enabled&&this.gestures.label==='fire'))this.fire();
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0){this.spawnEnemy();const level=difficultyAt(s.elapsed);this.spawnTimer=random(.4,.85)/level;}
    for(let i=this.enemies.length-1;i>=0;i--){
      const e=this.enemies[i];moveEnemy(e,dt);e.rotation+=e.spin*dt;
      if(e.y>HEIGHT+50){this.enemies.splice(i,1);continue;}
      if(this.handleEnemyCollision(e)){this.enemies.splice(i,1);if(s.over)break;}
    }
    if (s.over)return;
    for(let i=this.lasers.length-1;i>=0;i--){
      const laser=this.lasers[i];laser.y-=690*dt;
      if(laser.y<-25){this.lasers.splice(i,1);continue;}
      let struck=false;
      for(let j=this.enemies.length-1;j>=0;j--){
        const e=this.enemies[j];
        if(collision(laser,e)) {
          e.hp--;
          struck=true;
          this.particlesAt(laser.x,laser.y,COLORS.cyan,5,65);
          if(e.hp<=0){this.enemies.splice(j,1);award(s,e.kind);this.particlesAt(e.x,e.y,e.kind==='asteroid'?COLORS.gold:COLORS.purple,26,210);this.floatingTexts.push({x:e.x,y:e.y,text:`+${ENEMY_TYPES[e.kind].points}`,life:.8});}
          break;
        }
      }
      if(struck)this.lasers.splice(i,1);
    }
    for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.99;p.vy*=.99;p.life-=dt;if(p.life<=0)this.particles.splice(i,1);}
    for(let i=this.floatingTexts.length-1;i>=0;i--){const v=this.floatingTexts[i];v.y-=35*dt;v.life-=dt;if(v.life<=0)this.floatingTexts.splice(i,1);}
  }

  background(ctx,time){
    const g=ctx.createLinearGradient(0,0,0,HEIGHT);g.addColorStop(0,'#09152f');g.addColorStop(.55,'#070f23');g.addColorStop(1,'#050d1a');ctx.fillStyle=g;ctx.fillRect(0,0,WIDTH,HEIGHT);
    const glow=ctx.createRadialGradient(WIDTH*.63,HEIGHT*.24,5,WIDTH*.63,HEIGHT*.24,420);glow.addColorStop(0,'#214c6b30');glow.addColorStop(.45,'#16296326');glow.addColorStop(1,'#00111b00');ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,HEIGHT);
    for(const s of this.stars){const y=(s.y+time*14*s.speed)%HEIGHT;ctx.fillStyle=`rgba(155,209,242,${s.light})`;ctx.beginPath();ctx.arc(s.x,y,s.r,0,TAU);ctx.fill();}
    ctx.strokeStyle='#375e8a13';ctx.lineWidth=1;
    for(let x=0;x<WIDTH;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,HEIGHT);ctx.stroke();}
    for(let y=0;y<HEIGHT;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.strokeStyle='#237ac51e';ctx.beginPath();ctx.arc(WIDTH*.68,-130,255,0,Math.PI*2);ctx.stroke();
    ctx.font='11px monospace';ctx.fillStyle='#6488a050';ctx.fillText('SECTOR 07 / OUTER RIM',WIDTH-230,HEIGHT-27);
  }

  drawAsteroid(ctx,e){
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.rotation);
    ctx.shadowColor='#adbad34d';ctx.shadowBlur=11;ctx.fillStyle='#5f6c87';ctx.strokeStyle='#a9b6ca';ctx.lineWidth=2;
    ctx.beginPath();const points=10;for(let i=0;i<points;i++){const a=i/points*TAU, r=e.radius*(i%3===0?.82:i%4===0?1.12:1);const x=Math.cos(a)*r,y=Math.sin(a)*r;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#36445e';for(const [x,y,r] of [[-7,-5,6],[8,5,5],[-4,11,3]]){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fill();}ctx.restore();
  }
  drawDrone(ctx,e){
    ctx.save();ctx.translate(e.x,e.y);ctx.shadowBlur=14;
    const col=e.kind==='drone'?COLORS.red:e.kind==='zigzag'?COLORS.purple:COLORS.gold;
    ctx.shadowColor=col;ctx.strokeStyle=col;ctx.fillStyle=e.kind==='tank'?'#25263b':'#181c35';ctx.lineWidth=e.kind==='tank'?4:2.6;
    ctx.beginPath();ctx.moveTo(0,-e.radius);ctx.lineTo(e.radius,0);ctx.lineTo(0,e.radius);ctx.lineTo(-e.radius,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-e.radius-13,0);ctx.lineTo(e.radius+13,0);ctx.moveTo(-e.radius+2,-9);ctx.lineTo(-e.radius-12,7);ctx.moveTo(e.radius-2,-9);ctx.lineTo(e.radius+12,7);ctx.stroke();
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,6,0,TAU);ctx.fill();ctx.shadowBlur=0;
    if(e.hp<e.maxHp){ctx.strokeStyle='#f7f1f1a1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-e.radius,-e.radius-8);ctx.lineTo(-e.radius+2*e.radius*(e.hp/e.maxHp),-e.radius-8);ctx.stroke();}
    ctx.restore();
  }
  drawShip(ctx,time){
    const {x,y}=this.player;
    if(this.beaming){const g=ctx.createLinearGradient(x,0,x,y);g.addColorStop(0,'#49d9f700');g.addColorStop(1,'#49d9f73e');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-95,0);ctx.lineTo(x+95,0);ctx.lineTo(x+18,y-25);ctx.lineTo(x-18,y-25);ctx.closePath();ctx.fill();ctx.strokeStyle='#4ce5ff70';ctx.lineWidth=2;ctx.setLineDash([12,10]);ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,y-25);ctx.stroke();ctx.setLineDash([]);}
    ctx.save();ctx.translate(x,y);if(this.hitCooldown>0&&Math.floor(time*16)%2===0)ctx.globalAlpha=.45;
    ctx.shadowColor='#36c6ff';ctx.shadowBlur=27;
    ctx.fillStyle='#dbeeff';ctx.strokeStyle=COLORS.cyan;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(0,-31);ctx.lineTo(-31,26);ctx.lineTo(-10,17);ctx.lineTo(0,8);ctx.lineTo(10,17);ctx.lineTo(31,26);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle='#21466d';ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(-9,8);ctx.lineTo(9,8);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f1a7ff';const flame=12+Math.sin(time*28)*5;ctx.beginPath();ctx.moveTo(-9,22);ctx.lineTo(0,22+flame+random(0,5));ctx.lineTo(9,22);ctx.closePath();ctx.fill();ctx.restore();
    if(this.shielding){ctx.save();ctx.strokeStyle=COLORS.cyan;ctx.shadowColor=COLORS.cyan;ctx.shadowBlur=24;ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,43,0,TAU);ctx.stroke();ctx.globalAlpha=.14;ctx.fillStyle=COLORS.cyan;ctx.fill();ctx.restore();}
  }
  render(time){
    const ctx=this.ctx;
    ctx.save();if(this.shake>0){ctx.translate(random(-7,7)*this.shake*4,random(-7,7)*this.shake*4);}
    this.background(ctx,this.state.elapsed + time*.00007);
    for(const e of this.enemies){if(e.kind==='asteroid')this.drawAsteroid(ctx,e);else this.drawDrone(ctx,e);}
    for(const l of this.lasers){ctx.save();ctx.strokeStyle=COLORS.cyan;ctx.shadowBlur=19;ctx.shadowColor=COLORS.cyan;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(l.x,l.y+18);ctx.lineTo(l.x,l.y-20);ctx.stroke();ctx.restore();}
    this.drawShip(ctx,time*.001);
    for(const p of this.particles){ctx.globalAlpha=Math.max(0,p.life/p.maxLife);ctx.fillStyle=p.color;ctx.shadowBlur=9;ctx.shadowColor=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,TAU);ctx.fill();}
    ctx.globalAlpha=1;ctx.shadowBlur=0;
    for(const f of this.floatingTexts){ctx.save();ctx.globalAlpha=f.life/.8;ctx.fillStyle=COLORS.cyan;ctx.font='bold 18px sans-serif';ctx.textAlign='center';ctx.fillText(f.text,f.x,f.y);ctx.restore();}
    if(this.flash>0){ctx.fillStyle=`rgba(255,60,97,${this.flash*.65})`;ctx.fillRect(0,0,WIDTH,HEIGHT);}
    ctx.restore();
  }

  updateHud(){
    const s=this.state;
    $('score').textContent=String(s.score).padStart(6,'0');
    $('timer').textContent=prettifyTime(s.elapsed);
    $('difficulty').textContent=`${difficultyAt(s.elapsed).toFixed(1)}×`;
    $('hp').textContent=Array.from({length:STARTING_HP},(_,i)=>i<s.hp?'♥':'♡').join(' ');
    $('hp').setAttribute('aria-label',`${s.hp} of ${STARTING_HP} health`);
    $('energy-fill').style.width=`${s.energy}%`;
    $('shield-fill').style.width=`${s.shield}%`;
    $('energy-label').textContent=`${Math.round(s.energy)}%`;
    $('shield-label').textContent=`${Math.round(s.shield)}%`;
    $('best-score').textContent=`PERSONAL BEST ${String(this.best).padStart(6,'0')}`;
    $('game-status').textContent=s.over?'GAME OVER · SIGNAL LOST':this.paused?'PAUSED · AWAITING ORDERS':this.running?'DEFENSE ACTIVE · HOSTILES INBOUND':'STANDBY · AWAITING PILOT';
  }

  frame(now){
    const dt=Math.min(.05,Math.max(0,(now-this.lastFrame)/1000));this.lastFrame=now;
    this.update(dt,now);this.render(now);this.updateHud();requestAnimationFrame(t=>this.frame(t));
  }
}

new OrbitWarden();
