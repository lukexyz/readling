import {flowerShots} from './gardens.js';
import {bump,clamp01} from './show-kit.js';
import {fitShot,poseTime} from './sprite-shot.js';

// A single petal or a few pollen lights can drift past the small planting bed.
function flowerAccent(bed,family,t) {
  if(!bed || t<0 || t>=1) return;
  const {pen,x,y,w,h}=bed;
  pen.save();pen.globalAlpha=Math.sin(t*Math.PI)*.92;
  if(family==='poppy') {
    pen.translate(x+w*(.08+.53*t),y-h*(.55+.13*Math.sin(t*Math.PI)-.45*t*t));
    pen.rotate(-.65+t*3.2);pen.fillStyle='#c86850';
    pen.beginPath();pen.ellipse(0,0,w*.022,w*.011,0,0,Math.PI*2);pen.fill();
  } else {
    for(let n=0;n<3;n++){
      const rise=clamp01(t*1.3-n*.15);
      pen.beginPath();pen.arc(x+w*(.09*n+.075*Math.sin(rise*5+n)),y-h*(.57+.39*rise),w*.009,0,Math.PI*2);
      pen.fillStyle='#fff1bf';pen.fill();pen.strokeStyle='#a79568';pen.lineWidth=w*.003;pen.stroke();
    }
  }
  pen.restore();
}

function flowerPart(shot) {
  // A stopped preview releases its decoded sheets. Concurrent shows can share an in-flight load.
  const artwork=new WeakMap();
  let pending;
  return {
    family:shot.family, len:shot.frames/shot.fps, poster:(shot.poster-1)/shot.fps, stays:true, z:1.5,
    async prepare(e) {
      try {
        pending ||= shot.load().finally(()=>{pending=null;});
        artwork.set(e,await pending);
        e.flowerReady=true;
      } catch(error) { console.warn('Could not load '+shot.name,error); }
    },
    draw(e,state,time) {
      const asset=artwork.get(e);
      if (!asset) return;
      const frame=Math.min(asset.length-1,Math.floor(poseTime(time,(shot.poster-1)/shot.fps)*shot.fps));
      const squash=e.soak?.12*bump((e.time-e.soak)/.6):0;
      const {w,h,ctx,flowerBed}=e;
      const slot=flowerBed.ids.indexOf(shot.id);
      const count=flowerBed.ids.length;
      const margin=flowerBed.solo ? 0 : w*.035;
      const width=(w-2*margin)/count;
      const centre=count===1 && flowerBed.oak ? w*.72 : margin+(slot+.5)*width;
      ctx.save();
      fitShot(ctx,shot.crop,width,h,centre,h);
      if(shot.family==='sunflower' && shot.level===2) {
        ctx.translate(240,350);ctx.rotate(.027*bump((time-2.38)/.60));ctx.translate(-240,-350);
      }
      ctx.translate(0,shot.crop[3]*squash);ctx.scale(1,1-squash);
      asset.paint(ctx,frame);
      ctx.restore();
      if(shot.level===3 && (shot.family==='poppy' || shot.family==='moonflower'))
        flowerAccent(e.bed,shot.family,(time-2.22)/1.34);
    }
  };
}

export const flowers=Object.fromEntries(flowerShots.map(shot=>[shot.id,flowerPart(shot)]));
