import {clamp01,swing} from './show-kit.js';
import {contactShadow} from './meadow.js';
import {fitShot,poseTime} from './sprite-shot.js';

const camera=[42,16,403,331];
// These crops contain only the ears of Hazel and of the little silver rabbit, respectively.
const earPoses={1:{frame:15,crop:[123,102,94,75]},3:{frame:5,crop:[78,213,59,44]}};

function doubleTake(e,shot,asset,u) {
  const {ctx,w,h}=e, path=e.panelSide==='path', d=e.pixelsPerCssPixel || 1;
  const height=path?Math.min(h*.91,104*d):h*.83, ground=h*(path?.97:.89);
  const xScale=Math.hypot(ctx.getTransform().a,ctx.getTransform().b);
  if(u<.62) {
    const progress=u/.62, travel=progress*.68+swing(progress)*.32;
    const width=Math.min(w*.68,height*camera[2]/camera[3],camera[2]/xScale);
    const margin=width*.56, x=w+margin-(w+margin*2)*travel;
    const hop=Math.abs(Math.sin(progress*Math.PI*4))*height*.10;
    const duration=shot.frames/shot.fps, poster=(asset.poster-1)/shot.fps;
    const frame=Math.min(shot.frames-1,Math.floor(poseTime(progress*duration,poster)*shot.fps));
    contactShadow(ctx,x,ground-2,width*.25,Math.min(height*.027,5*d),.15);
    ctx.save();ctx.translate(2*x,0);ctx.scale(-1,1);
    fitShot(ctx,camera,w*.68,height,x,ground-hop);
    asset.paint(ctx,frame);
    if(e.has('hats')) for(const head of asset.anchors[frame]) e.hat(...head);
    ctx.restore();
    return;
  }
  const lift=swing((u-.65)/.11)*(1-swing((u-.875)/.11));
  if(!lift) return;
  const {frame,crop:[left,top,cw,ch]}=earPoses[shot.level];
  const scale=Math.min(1/xScale,h*.37/ch,w*.105/cw,(path?32*d:62)/ch);
  // The front edge of the meadow masks the face as the ears rise and dip.
  ctx.save();ctx.translate(w*.135,h+(1-lift)*ch*scale);
  ctx.rotate(.105*Math.sin(Math.PI*2*clamp01((u-.765)/.10)));
  ctx.scale(-scale,scale);ctx.translate(-left-cw/2,-top-ch);
  ctx.beginPath();ctx.rect(left,top,cw,ch);ctx.clip();asset.paint(ctx,frame);
  ctx.restore();
}

// In these consecutive frames of the original two-rabbit shot, there's daylight
// between their silhouettes. The split and the foot heights are in camera pixels.
const strides=[
  [191,253,305],[196,257,293],[201,262,285],[205,269,279],[209,279,275],
  [213,289,273],[217,299,277],[221,308,283],[225,318,285],[229,328,289],[233,340,295]
];
const landings=[.82,.64,.46,.28,.10];
const beat=.103, follow=.185, wait=.10;

function pawprint(ctx,x,y,size,preview) {
  ctx.save();ctx.translate(x,y);ctx.rotate(-.65);ctx.scale(size,size);
  ctx.fillStyle=preview?'#dbc59a':'#736c4e';
  ctx.strokeStyle=preview?'#5d5744':'#e3dcba';ctx.lineWidth=.15;
  ctx.beginPath();
  for(const [px,py,rx,ry] of [[0,.27,.59,.44],[-.64,-.26,.22,.29],[-.15,-.54,.24,.35],[.40,-.43,.23,.32]]) {
    ctx.moveTo(px+rx,py);ctx.ellipse(px,py,rx,ry,0,0,Math.PI*2);
  }
  ctx.fill();ctx.stroke();ctx.restore();
}

function borrowingFeet(e,asset,u) {
  const {ctx,w,h}=e, path=e.panelSide==='path', d=e.pixelsPerCssPixel || 1;
  const native=1/Math.hypot(ctx.getTransform().a,ctx.getTransform().b);
  const scale=Math.min(native,w*.19/175,h*.68/195,path?88*d/195:1);
  const ground=h*(path?.91:.86), radius=Math.min(h*.10,w*.026,Math.max(19*scale,4*d));
  const last=landings.length, shortBy=Math.min(w*.055,scale*76);
  const margin=Math.max(w*.065,175*scale);
  const marks=landings.map(fraction=>fraction*w);
  for(let i=0;i<last;i++) {
    const touch=(i+1)*beat;
    const pressed=swing((u-touch)/.021), matched=i===last-1?0:swing((u-touch-follow)/.067);
    const alpha=pressed*(1-.64*matched)*(1-swing((u-.89)/.10));
    if(!alpha) continue;
    ctx.save();ctx.globalAlpha*=alpha;
    pawprint(ctx,marks[i],ground+radius*.28,radius,!!e.preview);
    ctx.restore();
  }
  for(const rabbit of [0,1]) {
    let clock=u-rabbit*follow;
    if(clock<0) continue;
    // Pip stops one paw short, noses towards the last print, then follows Bracken home.
    const pause=rabbit?clamp01((clock-last*beat)/wait):0;
    clock-=pause*wait;
    if(clock>=(last+1)*beat) continue;
    const step=Math.min(last,Math.floor(clock/beat)), f=clamp01(clock/beat-step);
    const points=[w+margin,...marks,-margin];
    if(rabbit) points[last]+=shortBy;
    const reach=rabbit?Math.sin(Math.PI*pause)*shortBy*.17:0;
    const x=points[step]+(points[step+1]-points[step])*swing(f)-reach;
    const lift=Math.sin(Math.PI*f), feet=ground-lift*Math.min(h*.21,65*scale);
    const pose=10-Math.round(lift*10), frame=37+pose;
    const [split,adultFoot,kitFoot]=strides[pose], head=asset.anchors[frame][rabbit];
    contactShadow(ctx,x,ground,scale*(rabbit?36:46)*(1-.30*lift),Math.max(.6,scale*5),.17-.07*lift);
    ctx.save();ctx.translate(x,feet);ctx.scale(-scale,scale);
    ctx.translate(-head[0],-(rabbit?kitFoot:adultFoot));
    ctx.save();ctx.beginPath();ctx.rect(rabbit?0:split,0,rabbit?split:480-split,360);ctx.clip();
    asset.paint(ctx,frame);ctx.restore();
    if(e.has('hats')) e.hat(...head);
    ctx.restore();
  }
}

export function drawRabbitVisit(e,shot,asset,time) {
  if(!asset) return;
  const u=clamp01(time*shot.fps/shot.frames);
  if(shot.level===2) borrowingFeet(e,asset,u);
  else doubleTake(e,shot,asset,u);
}
