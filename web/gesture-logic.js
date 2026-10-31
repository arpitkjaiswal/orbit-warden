/** Landmark-only helpers: no camera, DOM or model downloads needed. */
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
export function validLandmarks(points){
  return Array.isArray(points)&&points.length===21&&points.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z??0));
}
export function classifyHand(points) {
  if(!validLandmarks(points))return 'none';
  const scale=distance(points[0],points[9]);
  if(scale<.02)return 'none';
  const fingers=[[8,6],[12,10],[16,14],[20,18]].map(([tip,joint])=>distance(points[0],points[tip])>distance(points[0],points[joint])*1.16);
  if(fingers.slice(1).some(Boolean) && distance(points[4],points[8])/scale<.28)return 'overdrive';
  if(fingers.every(Boolean))return 'recharge';
  if(fingers.every(v=>!v))return 'shield';
  if(fingers[0] && fingers[1] && fingers[2] && !fingers[3])return 'missiles';
  if(fingers[0] && fingers[1] && !fingers[2] && !fingers[3])return 'nova';
  if(fingers[0] && !fingers[1] && !fingers[2] && !fingers[3])return 'fire';
  return 'move';
}
export function handPosition(points) {
  const clamp=value=>Math.max(0,Math.min(1,value));
  return {x:clamp((1-points[9].x-.15)/.7),y:clamp((points[9].y-.2)/.6)};
}
/** Hold once, then require release; a held pose cannot repeatedly trigger a power. */
export class GesturePower {
  constructor(){this.reset();}
  reset(){this.pose='none';this.held=0;this.fired=false;this.latched=null;this.released=0;}
  update(pose,dt){
    dt=Math.max(0,Math.min(dt,.1));
    if(this.latched){
      this.released=pose===this.latched?0:this.released+dt;
      if(this.released+.000001>=.2){this.latched=null;this.released=0;}
    }
    if(pose!==this.pose){this.pose=pose;this.held=0;this.fired=false;}
    if(!['nova','overdrive','missiles'].includes(pose)||this.latched===pose)return null;
    this.held+=dt;
    if(!this.fired && this.held + 1e-9 >= (pose==='nova'?.8:pose==='missiles'?.55:.45)){this.fired=true;this.latched=pose;return pose;}
    return null;
  }
  get progress(){return this.latched===this.pose?1:['nova','overdrive','missiles'].includes(this.pose)?Math.min(1,this.held/(this.pose==='nova'?.8:this.pose==='missiles'?.55:.45)):0;}
}

/** Time-based confirmation avoids a frame-rate-dependent seven-frame input delay. */
export class PoseFilter {
  constructor(){this.reset();}
  reset(){this.candidate='none';this.elapsed=0;this.label='none';this.confidence=0;}
  update(pose,dt){
    if(pose==='none'){this.reset();return this.label;}
    if(pose!==this.candidate){this.candidate=pose;this.elapsed=0;this.label='none';}
    this.elapsed+=Math.max(0,Math.min(dt,.1));
    const duration=['nova','overdrive','missiles'].includes(pose)?.16:.08;
    this.confidence=Math.min(1,this.elapsed/duration);
    if(this.confidence>=1)this.label=pose;
    return this.label;
  }
}

/** Calibrated absolute steering with small-jitter rejection and exponential smoothing. */
export class HandSteering {
  constructor(){this.center={x:.5,y:.6};this.position={x:.5,y:.5};this.raw=null;this.sensitivity=1;this.smoothing=.09;}
  calibrate(){
    if(!this.raw)return false;
    this.center={...this.raw};this.position={x:.5,y:.5};return true;
  }
  update(raw,dt){
    this.raw={...raw};
    for(const axis of ['x','y']){
      const span=axis==='x'?.32:.3;
      const target=Math.max(0,Math.min(1,.5+(raw[axis]-this.center[axis])*this.sensitivity/(span*2)));
      if(Math.abs(target-this.position[axis])<.012)continue;
      const alpha=1-Math.exp(-Math.max(0,dt)/this.smoothing);
      this.position[axis]+=(target-this.position[axis])*alpha;
    }
    return this.position;
  }
}
