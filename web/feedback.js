/** Tiny opt-in synthesizer: no asset downloads or sound before a user action. */
export class Feedback {
  constructor(){this.enabled=false;this.context=null;this.lastShot=0;}
  async enable(enabled){
    this.enabled=enabled;
    if(!enabled)return;
    try{const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;this.context??=new Audio();await this.context.resume();}
    catch{this.enabled=false;}
  }
  play(kind){
    if(!this.enabled||!this.context||this.context.state!=='running')return;
    const now=this.context.currentTime;
    if(kind==='shot' && now-this.lastShot<.12)return;
    if(kind==='shot')this.lastShot=now;
    const tones={shot:[700,400,.06],hit:[150,55,.12],kill:[300,650,.1],power:[250,1000,.3],pickup:[600,1200,.16]};
    const [from,to,duration]=tones[kind]||tones.kill;
    const oscillator=this.context.createOscillator(),gain=this.context.createGain();
    oscillator.type=kind==='hit'?'triangle':'sine';oscillator.frequency.setValueAtTime(from,now);oscillator.frequency.exponentialRampToValueAtTime(to,now+duration);
    gain.gain.setValueAtTime(.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
    oscillator.connect(gain);gain.connect(this.context.destination);oscillator.start(now);oscillator.stop(now+duration);
  }
}
