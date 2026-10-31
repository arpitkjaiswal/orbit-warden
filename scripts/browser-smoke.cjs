const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const {createServer}=require('node:http');const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'../web');
 const server=createServer((request,response)=>{
  const pathname=new URL(request.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':decodeURIComponent(pathname)));
  if(!file.startsWith(root+path.sep)){response.writeHead(403);response.end();return;}
  fs.readFile(file,(error,data)=>{if(error){response.writeHead(404);response.end();return;}
   response.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream');response.end(data);
  });
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const baseURL=`http://127.0.0.1:${server.address().port}`;let browser;
 try{
 browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:fs.existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{requestAnimationFrame=()=>0;});await page.goto(baseURL);await page.evaluate(async()=>{window.game=(await import('/main.js')).game;});await page.locator('.mission-options>summary').click();await page.selectOption('#ship-choice','bastion');await page.click('#start-button');
 await page.evaluate(()=>{
 const g=game;g.running=false;g.paused=false;g.beginPractice();
 document.getElementById('touch-fire').dispatchEvent(new PointerEvent('pointerdown',{pointerId:100}));
 if(g.running||!g.practicing)throw Error('practice started combat');
 g.endPractice();g.start();
 const canvas=document.getElementById('game'),touch=document.getElementById('touch-fire');
 canvas.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));touch.dispatchEvent(new PointerEvent('pointerdown',{pointerId:101}));touch.dispatchEvent(new PointerEvent('pointerup',{pointerId:101}));
 if(!g.input.has('Space'))throw Error('touch released keyboard fire');canvas.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',bubbles:true}));
 let toggled=0;const toggle=g.gestures.toggle;g.gestures.toggle=()=>toggled++;
 document.getElementById('gesture-toggle').dispatchEvent(new KeyboardEvent('keydown',{code:'KeyG',bubbles:true}));g.gestures.toggle=toggle;
 if(toggled!==1)throw Error('camera shortcut from button');g.start();
 });
 await page.evaluate(async()=>{
 const g=game;g.start();const media=navigator.mediaDevices,original=media.getUserMedia,loader=g.gestures.createDetector;
 try{
  const source=document.createElement('canvas');source.width=480;source.height=640;source.getContext('2d').fillRect(0,0,480,640);
  const stream=source.captureStream(10);media.getUserMedia=async()=>stream;g.gestures.createDetector=async()=>({close(){},detectForVideo:()=>({landmarks:[]})});
  await g.gestures.enable();
  if(document.getElementById('hand-overlay').width!==480||document.getElementById('hand-overlay').height!==640)throw Error('camera aspect mismatch');
  stream.getVideoTracks()[0].dispatchEvent(new Event('ended'));
  if(!g.paused||g.gestures.stream!==null||!document.getElementById('gesture-status').textContent.includes('stream ended'))throw Error('camera disconnect recovery');
  g.resume();media.getUserMedia=async()=>{throw new DOMException('Permission denied','NotAllowedError');};await g.gestures.enable();
  if(!g.paused||g.gestures.enabled||!document.getElementById('gesture-status').textContent.includes('Permission denied'))throw Error('camera denied recovery');
 }finally{media.getUserMedia=original;g.gestures.createDetector=loader;g.gestures.disable();g.start();}
 });
 await page.evaluate(()=>{
 const g=game,check=(ok,m)=>{if(!ok)throw Error(m)};
 check(g.state.hp===6&&g.weapon==='spread','bastion loadout');g.action('KeyC');check(g.missiles.length===3&&g.mods.missiles===2,'missile launch');g.action('KeyC');check(g.mods.missiles===2,'cooldown guard');
 const e={kind:'asteroid',x:g.player.x,y:g.player.y-160,radius:22,hp:1};g.enemies=[e];for(let i=0;i<80&&g.enemies.length;i++)g.updateMissiles(.025);check(g.kills===1&&g.missileKills===1,'homing damage');
 check(g.badges.includes('first'),'achievement');
 g.beginPractice();const snapshot=JSON.stringify({state:g.state,mods:g.mods,missileCooldown:g.missileCooldown});g.input.add('ArrowLeft');g.update(.05,100);check(g.practicePlayer.x<480,'practice movement');check(JSON.stringify({state:g.state,mods:g.mods,missileCooldown:g.missileCooldown})===snapshot,'practice safe');g.endPractice();
 g.start();g.gestures.tick=()=>{};Object.assign(g.gestures,{enabled:true,tracking:true,label:'missiles',x:.5,y:.5});for(let i=0;i<12;i++)g.update(.05,200+i*50);check(g.mods.missiles===2&&g.missiles.length===3,'camera missile pose');
 g.gestures.tracking=false;for(let i=0;i<17;i++)g.update(.05,1000+i*50);check(g.paused,'camera loss pause');g.gestures.enabled=false;g.resume();
 g.start();g.enemies=[{kind:'interceptor',x:480,y:200,baseX:480,radius:19,hp:3,level:1,time:0,phase:0,spin:0,rotation:0,attackTimer:.4}];g.update(.01,2000);check(Number.isFinite(g.enemies[0].aim),'interceptor warning');for(let i=0;i<45;i++)g.update(.01,2010+i*10);check(g.bullets.length>0,'interceptor shot');
 g.start();g.sectorTime=30;g.update(.01,3000);let boss=g.enemies.find(e=>e.boss);boss.hp=boss.maxHp*.4;boss.shotTimer=.5;g.update(.01,3010);check(boss.phase===2&&boss.volley.length===7,'phase two pattern');
 boss.hp=1;g.lasers=[{x:boss.x,y:boss.y,radius:9,vx:0,vy:0,damage:20},{x:50,y:50,radius:5,vx:0,vy:0,damage:1}];g.update(.001,3020);check(g.refitting&&g.paused&&g.sector===0,'refit freeze');
 const frozen=g.state.elapsed;g.update(.05,3030);check(g.state.elapsed===frozen,'refit timers');g.resume();g.beginPractice();check(g.paused&&!g.practicing,'cannot bypass refit');g.chooseUpgrade('wing');check(g.refitting,'reject unavailable upgrade');g.updateHud();g.render(3040);
 });
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const b=[...document.querySelectorAll('[data-upgrade]')];b.at(-1).focus();});await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.upgrade),'reactor');
 await page.click('[data-upgrade="armor"]');
 await page.evaluate(()=>{
 const g=game,check=(ok,m)=>{if(!ok)throw Error(m)};check(g.sector===1&&!g.paused&&g.mods.maxHp===8,'armor chosen');
 g.sectorTime=30;g.update(.01,4000);const b=g.enemies.find(e=>e.boss);b.hp=b.maxHp*.4;b.cycle=1;b.shotTimer=.4;g.update(.01,4010);check(b.volley.length===14,'ravager radial phase');b.hp=1;g.lasers=[{x:b.x,y:b.y,radius:9,vx:0,vy:0,damage:10}];g.update(.001,4020);check(g.refitting,'second refit');
 });await page.click('[data-upgrade="wing"]');
 await page.evaluate(()=>{
 const g=game,check=(ok,m)=>{if(!ok)throw Error(m)};check(g.sector===2&&g.mods.wings===2,'wing upgrade');
 g.enemies=[{kind:'tank',x:480,y:200,baseX:480,radius:30,hp:5,time:0,phase:0,level:1,spin:0,rotation:0}];g.update(.01,5000);check(g.lasers.filter(l=>l.color==='#91ffc9').length===2,'support fire');
 g.enemies=[];g.sectorTime=30;g.update(.01,5010);const b=g.enemies.find(e=>e.boss);b.hp=b.maxHp*.4;b.cycle=1;b.shotTimer=.4;g.update(.01,5020);check(b.volley.length===12,'overlord spiral');
 b.hp=1;g.lasers=[{x:b.x,y:b.y,radius:9,vx:0,vy:0,damage:30}];g.update(.001,5030);check(!g.running&&g.badges.includes('clear'),'victory and badge');check(document.getElementById('overlay-title').textContent==='GALAXY SAVED','victory UI');
 g.start();check(g.sector===0&&!g.refitting&&!g.selectedUpgrades.length&&g.mods.wings===0&&g.state.maxHp===6,'restart');
 const badges=JSON.parse(localStorage.getItem('orbit-warden-badges'));check(badges.includes('clear'),'badge persistence');g.updateHud();g.render(6000);
 });
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile fit');
 await page.dispatchEvent('#touch-up','pointerdown',{pointerId:1});await page.evaluate(()=>{const y=game.player.y;game.update(.05,6100);if(game.player.y>=y)throw Error('touch movement');});await page.dispatchEvent('#touch-up','pointerup',{pointerId:1});
 assert.deepEqual(errors,[]);console.log('PASS: ships, homing missiles, camera missiles, tracking safety, armed enemies, phased bosses, refit guards and focus, all sectors, wing drones, victory, achievements, restart, touch and mobile layout.');
 const layout=await browser.newPage();const layoutErrors=[];layout.on('pageerror',e=>layoutErrors.push(e.message));
 for(const [width,height] of [[1440,900],[1280,720],[768,1024],[390,844],[360,740],[844,390]]){
  await layout.setViewportSize({width,height});await layout.goto(baseURL);
  const result=await layout.evaluate(()=>{
   const game=document.getElementById('game').getBoundingClientRect(),camera=document.querySelector('.camera-preview').getBoundingClientRect(),button=document.getElementById('gesture-toggle').getBoundingClientRect();
   const ids=[...document.querySelectorAll('[id]')].map(node=>node.id);
   return {together:game.bottom<=innerHeight&&camera.bottom<=innerHeight&&button.bottom<=innerHeight,overflow:document.documentElement.scrollWidth>innerWidth,unique:ids.length===new Set(ids).size};
  });assert.ok(result.together,`shared viewport ${width}x${height}`);assert.equal(result.overflow,false);assert.ok(result.unique);
  await layout.click('#start-button');
 }
 assert.deepEqual(layoutErrors,[]);console.log('PASS: six cockpit viewports, unique controls and launch buttons');
 const welcome=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const welcomeErrors=[];welcome.on('pageerror',e=>welcomeErrors.push(e.message));await welcome.goto(baseURL);
 assert.equal(await welcome.locator('.mission-options').evaluate(node=>node.open),false,'advanced options start collapsed');
 assert.ok((await welcome.locator('#start-button').innerText()).includes('Play now'));
 await welcome.click('#practice-start-button');assert.equal(await welcome.evaluate(async()=>{const {game}=await import('/main.js');return game.practicing&&!game.running;}),true,'safe practice before combat');
 await welcome.click('#practice-control');assert.equal(await welcome.locator('#overlay').isVisible(),true,'return to start');
 await welcome.click('#start-button');await welcome.click('#pause-button');assert.equal(await welcome.evaluate(async()=>(await import('/main.js')).game.paused),true,'visible pause');
 await welcome.click('#pause-button');assert.equal(await welcome.evaluate(async()=>(await import('/main.js')).game.paused),false,'visible resume');
 await welcome.click('#restart-button');assert.equal(await welcome.evaluate(async()=>(await import('/main.js')).game.state.score),0,'visible restart');
 const touchOnScreen=await welcome.locator('#touch-fire').evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});assert.ok(touchOnScreen,'touch fire visible alongside game');
 assert.deepEqual(welcomeErrors,[]);console.log('PASS: first-time play, optional setup, safe camera practice, visible pause/resume/restart and on-screen touch');
 const live=await browser.newPage();const liveErrors=[];live.on('pageerror',e=>liveErrors.push(e.message));await live.goto(baseURL);await live.click('#start-button');await live.waitForTimeout(1200);assert.deepEqual(liveErrors,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exit(1)});
