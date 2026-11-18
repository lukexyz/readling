import {flowerShots} from './gardens.js';
import {bump} from './show-kit.js';
import {fitShot} from './sprite-shot.js';

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
      const frame=Math.min(asset.length-1,Math.floor(time*shot.fps));
      const squash=e.soak?.12*bump((e.time-e.soak)/.6):0;
      const {w,h,ctx,flowerBed}=e;
      const slot=flowerBed.ids.indexOf(shot.id);
      const count=flowerBed.ids.length;
      const margin=flowerBed.solo ? 0 : w*.035;
      const width=(w-2*margin)/count;
      const centre=count===1 && flowerBed.oak ? w*.72 : margin+(slot+.5)*width;
      ctx.save();
      fitShot(ctx,shot.crop,width,h,centre,h);
      ctx.translate(0,shot.crop[3]*squash);ctx.scale(1,1-squash);
      asset.paint(ctx,frame);
      ctx.restore();
    }
  };
}

export const flowers=Object.fromEntries(flowerShots.map(shot=>[shot.id,flowerPart(shot)]));
