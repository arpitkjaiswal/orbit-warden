import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyHand,handPosition,GesturePower} from '../gesture-logic.js';
import {GestureTracker} from '../gestures.js';
function hand(extended=[true,true,true,true]){
 const p=Array.from({length:21},()=>({x:.5,y:.7,z:0}));p[0]={x:.5,y:.95};p[9]={x:.5,y:.65};p[4]={x:.1,y:.6};
 [[8,6],[12,10],[16,14],[20,18]].forEach(([tip,joint],i)=>{p[joint]={x:.4+i*.07,y:.5};p[tip]={x:.4+i*.07,y:extended[i]?.25:.72};});return p;
}
test('recognizes combat poses and rejects missing or invalid landmarks',()=>{
 assert.equal(classifyHand(hand()),'recharge');assert.equal(classifyHand(hand([false,false,false,false])),'shield');
 assert.equal(classifyHand(hand([true,false,false,false])),'fire');assert.equal(classifyHand(hand([true,true,false,false])),'nova');
 const pinch=hand();pinch[4]={...pinch[8]};assert.equal(classifyHand(pinch),'overdrive');
 assert.equal(classifyHand(null),'none');assert.equal(classifyHand([]),'none');const bad=hand();bad[0].x=NaN;assert.equal(classifyHand(bad),'none');
});
test('pose geometry survives rotation and uniform scale',()=>{
 const p=hand([true,true,false,false]);const rotated=p.map(v=>({x:.5+(v.y-.5)*.6,y:.5-(v.x-.5)*.6,z:0}));
 assert.equal(classifyHand(rotated),'nova');
 assert.deepEqual(handPosition(Array.from({length:21},()=>({x:0,y:1}))),{x:1,y:1});
});
test('powers require holds and release; hand loss clears accumulated hold',()=>{
 const power=new GesturePower();
 for(let i=0;i<7;i++)assert.equal(power.update('nova',.1),null);
 assert.equal(power.update('nova',.1),'nova');
 for(let i=0;i<30;i++)assert.equal(power.update('nova',.1),null);
 power.update('none',.1);assert.equal(power.progress,0);
 for(let i=0;i<4;i++)assert.equal(power.update('overdrive',.1),null);
 assert.equal(power.update('overdrive',.1),'overdrive');power.reset();assert.equal(power.progress,0);
});
function tracker(){
 const element=()=>({textContent:'',innerHTML:'',disabled:false,classList:{add(){},remove(){}},addEventListener(){}});
 const ctx={clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){}};
 return new GestureTracker({video:{readyState:2,currentTime:1},overlay:{width:320,height:180,getContext:()=>ctx},placeholder:element(),button:element(),label:element(),confidence:element(),status:element(),feedLabel:element()});
}
test('missing hand releases immediately and frozen video expires tracking',()=>{
 const t=tracker();t.enabled=true;t.landmarker={detectForVideo:()=>({landmarks:[]})};t.tracking=true;t.label='fire';t.lastHandsSeen=990;
 t.tick(1000);assert.equal(t.tracking,false);assert.equal(t.label,'none');
 t.tracking=true;t.label='nova';t.lastHandsSeen=1000;t.tick(1400);assert.equal(t.tracking,false);assert.equal(t.label,'none');
});
test('disable releases tracks, detector and gameplay intent',()=>{
 const t=tracker();let stopped=0,closed=0;t.stream={getTracks:()=>[{stop:()=>stopped++}]};t.landmarker={close:()=>closed++};t.tracking=true;t.label='shield';t.disable();
 assert.equal(stopped,1);assert.equal(closed,1);assert.equal(t.tracking,false);assert.equal(t.label,'none');assert.equal(t.stream,null);
});
test('cancelling while camera permission is pending stops the late stream',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');let resolve,stopped=0;
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>resolve=r)}}});
 try {
  const t=tracker();const pending=t.enable();t.disable();resolve({getTracks:()=>[{stop:()=>stopped++}]});await pending;
  assert.equal(stopped,1);assert.equal(t.enabled,false);assert.equal(t.stream,null);assert.equal(t.loading,false);
 } finally {if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;}
});

test('fast poses confirm in 80ms and switching intent clears the old action immediately',async()=>{
 const {PoseFilter}=await import('../gesture-logic.js');const filter=new PoseFilter();
 assert.equal(filter.update('fire',.04),'none');assert.equal(filter.update('fire',.04),'fire');
 assert.equal(filter.update('shield',.04),'none');assert.equal(filter.update('shield',.04),'shield');
 assert.equal(filter.update('none',.04),'none');assert.equal(filter.confidence,0);
 for(let i=0;i<3;i++)assert.equal(filter.update('nova',.04),'none');assert.equal(filter.update('nova',.04),'nova');
});
test('calibration centers an off-axis hand, rejects jitter and supports reduced reach',async()=>{
 const {HandSteering}=await import('../gesture-logic.js');const steering=new HandSteering();assert.equal(steering.calibrate(),false);
 steering.update({x:.7,y:.4},.1);assert.equal(steering.calibrate(),true);
 assert.deepEqual(steering.update({x:.703,y:.398},.04),{x:.5,y:.5});
 steering.sensitivity=1.8;for(let i=0;i<30;i++)steering.update({x:.9,y:.4},.04);
 assert.ok(steering.position.x>.98);assert.equal(steering.position.y,.5);
});
test('steering smoothing remains consistent across camera frame rates',async()=>{
 const {HandSteering}=await import('../gesture-logic.js');const a=new HandSteering(),b=new HandSteering();
 for(let i=0;i<100;i++)a.update({x:.7,y:.8},.01);
 for(let i=0;i<20;i++)b.update({x:.7,y:.8},.05);
 assert.ok(Math.abs(a.position.x-b.position.x)<.012);assert.ok(Math.abs(a.position.y-b.position.y)<.012);
});
test('a brief ambiguous pose cannot rearm an already fired power',()=>{
 const power=new GesturePower();for(let i=0;i<10;i++)power.update('nova',.1);
 power.update('none',.04);for(let i=0;i<20;i++)assert.equal(power.update('nova',.05),null);
 for(let i=0;i<5;i++)power.update('move',.05);let actions=0;
 for(let i=0;i<20;i++)if(power.update('nova',.05))actions++;
 assert.equal(actions,1);
});
test('three-finger missile pose confirms and requires a held, released action',()=>{
 assert.equal(classifyHand(hand([true,true,true,false])),'missiles');
 const power=new GesturePower();for(let i=0;i<10;i++)assert.equal(power.update('missiles',.05),null);
 assert.equal(power.update('missiles',.05),'missiles');for(let i=0;i<30;i++)assert.equal(power.update('missiles',.05),null);
});
