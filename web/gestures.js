import {classifyHand, HandSteering, PoseFilter} from './gesture-logic.js';
/** Webcam-only, opt-in gesture tracking via MediaPipe Tasks Vision.
 * No images are uploaded by this application. MediaPipe may make its own telemetry requests.
 * User-provided trained classifiers have not been bundled.
 */
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0';
const DEFAULT_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const SEGMENTS = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];

export class GestureTracker {
  constructor({ video, overlay, placeholder, button, label, confidence, status, feedLabel }) {
    this.video = video;
    this.overlay = overlay;
    this.ctx = overlay.getContext('2d');
    this.placeholder = placeholder;
    this.button = button;
    this.labelEl = label;
    this.confidenceEl = confidence;
    this.statusEl = status;
    this.feedLabelEl = feedLabel;
    this.enabled = false;
    this.loading = false;
    this.landmarker = null;
    this.stream = null;
    this.label = 'none';
    this.confidence = 0;
    this.x = 0.5;
    this.y = .65;
    this.tracking = false;
    this.history = [];
    this.poseFilter=new PoseFilter();
    this.steering=new HandSteering();
    this.lastVideoTime = -1;
    this.lastInference = 0;
    this.lastHandsSeen = 0;
    this.generation = 0;
    this.labelEl.textContent = 'NONE';
    this.button.addEventListener('click', () => this.toggle());
  }

  async toggle() { if (this.enabled || this.loading) this.disable(); else await this.enable(); }

  async enable() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.statusEl.textContent = 'Camera permission requires HTTPS or localhost, and a supported browser.';
      return;
    }
    this.loading = true;
    const generation = ++this.generation;
    this.statusEl.textContent = 'Requesting webcam permission and loading MediaPipe…';
    this.button.textContent='CANCEL CAMERA STARTUP';
    this.button.disabled = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({video: {width: 640, height: 360, facingMode: 'user'}, audio: false});
      if (generation !== this.generation) {stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;
      stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(this.stream===stream)this.disable();});
      this.video.srcObject = stream;
      await this.video.play();
      if (generation !== this.generation) return;
      const {FilesetResolver, HandLandmarker} = await import(`${CDN}/+esm`);
      const vision = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {modelAssetPath: DEFAULT_MODEL, delegate: 'CPU'},
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      if (generation !== this.generation) {landmarker.close();return;}
      this.landmarker=landmarker;
      this.lastVideoTime=-1;this.lastInference=0;this.lastHandsSeen=0;
      this.enabled = true;
      this.placeholder.classList.add('hidden');
      this.feedLabelEl.textContent = 'LIVE · ON DEVICE';
      this.button.innerHTML = 'DISABLE CAMERA CONTROL <span>×</span>';
      this.statusEl.textContent = 'Hand moves ship in 2D. Auto-fire assists steering. Fist: shield; palm: recharge; pinch: overdrive; hold peace sign: nova.';
    } catch (err) {
      if(generation!==this.generation)return;
      this.disable();
      this.statusEl.textContent = `Camera unavailable: ${err?.message || 'permission denied or model unavailable'}`;
    } finally {
      if(generation===this.generation || !this.loading){this.loading = false;this.button.disabled = false;}
    }
  }

  disable() {
    this.generation++;
    this.enabled = false;
    this.loading=false;this.button.disabled=false;
    this.releaseHand();
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
    this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
    this.placeholder.classList.remove('hidden');
    this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
    this.history = [];
    this.label = 'none';
    this.confidence = 0;
    this.labelEl.textContent = 'NONE';
    this.confidenceEl.textContent = '—';
    this.feedLabelEl.textContent = 'NO FEED';
    this.button.innerHTML = 'ENABLE CAMERA CONTROL <span>↗</span>';
    this.statusEl.textContent = 'Camera is off. Keyboard controls are always available.';
  }

  inferGesture(points) { return classifyHand(points); }

  releaseHand() {
    this.tracking=false;this.label='none';this.history=[];this.confidence=0;
    this.poseFilter.reset();
    this.labelEl.textContent='NO HAND';this.confidenceEl.textContent='—';
    this.ctx.clearRect(0,0,this.overlay.width,this.overlay.height);
  }

  push(label,dt=.04) {
    this.label=this.poseFilter.update(label,dt);
    this.confidence=this.poseFilter.confidence;
    this.labelEl.textContent=this.label==='none'?'READING…':this.label.toUpperCase();
    this.confidenceEl.textContent=`${Math.round(this.confidence*100)}%`;
  }

  calibrate() {
    if(!this.tracking || !this.steering.calibrate()){
      this.statusEl.textContent='Show a hand in the camera, then tap Center my hand.';return false;
    }
    this.x=.5;this.y=.5;
    this.statusEl.textContent='Centered! Move comfortably from this position. Adjust reach and smoothing below.';
    return true;
  }

  tick(now) {
    if(this.enabled && now-this.lastHandsSeen>300)this.releaseHand();
    if (!this.enabled || !this.landmarker || this.video.readyState < 2 || now - this.lastInference < 40) return;
    if (this.video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = this.video.currentTime;
    const dt=Math.min(.1,Math.max(.001,(now-this.lastInference)/1000));
    this.lastInference = now;
    let hands;
    try { hands = this.landmarker.detectForVideo(this.video, now).landmarks; }
    catch (err) {this.disable();this.statusEl.textContent = `Tracking error: ${err.message}. Use keyboard or retry camera.`; return;}
    const points = hands?.[0];
    if (!points) {
      this.releaseHand();
      this.feedLabelEl.textContent='NO HAND · POWERS SAFE';
      this.ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      return;
    }
    // Mirrored video matches a mirror-style gesture interface; both x and overlay use the same reflection.
    this.lastHandsSeen=now;this.tracking=true;
    this.feedLabelEl.textContent='LIVE · ON DEVICE';
    const position=this.steering.update({x:1-points[9].x,y:points[9].y},dt);
    this.x=position.x;this.y=position.y;
    this.push(this.inferGesture(points),dt);
    this.drawSkeleton(points);
  }

  drawSkeleton(points) {
    const {ctx, overlay} = this;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const W = overlay.width, H = overlay.height;
    ctx.strokeStyle='#ffffff35';ctx.setLineDash?.([4,4]);ctx.strokeRect?.(W*.15,H*.2,W*.7,H*.6);ctx.setLineDash?.([]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(77,237,250,.95)';
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#4deafa';
    const coord = (p) => [W*(1-p.x), H*p.y];
    for (const [a,b] of SEGMENTS) {
      const [ax, ay] = coord(points[a]);
      const [bx, by] = coord(points[b]);
      ctx.beginPath(); ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    }
    ctx.fillStyle = '#d6f7ff';
    for (const p of points) {const [x,y] = coord(p);ctx.beginPath();ctx.arc(x,y,2.7,0,Math.PI*2);ctx.fill();}
    ctx.shadowBlur = 0;
  }
}
