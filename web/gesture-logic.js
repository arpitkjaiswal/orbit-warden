/** Landmark-only helpers: no camera, DOM or model downloads needed. */
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,(a.z??0)-(b.z??0));
export function classifyHand(points) {
  if(!points || points.length!==21 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return 'none';
  const scale=distance(points[0],points[9]);
  if(scale<.02)return 'none';
  const fingers=[[8,6],[12,10],[16,14],[20,18]].map(([tip,joint])=>distance(points[0],points[tip])>distance(points[0],points[joint])*1.16);
  if(distance(points[4],points[8])/scale<.28)return 'overdrive';
  if(fingers.every(Boolean))return 'recharge';
  if(fingers.every(v=>!v))return 'shield';
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
  reset(){this.pose='none';this.held=0;this.fired=false;}
  update(pose,dt){
    if(pose!==this.pose){this.pose=pose;this.held=0;this.fired=false;}
    if(!['nova','overdrive'].includes(pose))return null;
    this.held+=Math.max(0,Math.min(dt,.1));
    if(!this.fired && this.held + 1e-9 >= (pose==='nova'?.8:.45)){this.fired=true;return pose;}
    return null;
  }
  get progress(){return ['nova','overdrive'].includes(this.pose)?Math.min(1,this.held/(this.pose==='nova'?.8:.45)):0;}
}
