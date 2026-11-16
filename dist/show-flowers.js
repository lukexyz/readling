import {flowerShots} from './gardens.js';
import {pop} from './show-kit.js';

function flowerPart(shot) {
  // A stopped preview releases its decoded sheets. Concurrent shows can share an in-flight load.
  const artwork=new WeakMap();
  let pending;
  return {
    len:shot.frames/shot.fps, poster:(shot.poster-1)/shot.fps, stays:true, z:1.5,
    async prepare(e) {
      try {
        pending ||= shot.load().finally(()=>{pending=null;});
        artwork.set(e,await pending);
      } catch(error) { console.warn('Could not load '+shot.name,error); }
    },
    draw(e,state,time) {
      const asset=artwork.get(e);
      if (!asset) return;
      const {w,h,ctx,flowerBed}=e;
      const slot=flowerBed.ids.indexOf(shot.id);
      const count=flowerBed.ids.length;
      const margin=flowerBed.solo ? 0 : w*.035;
      const width=(w-2*margin)/count;
      const scale=flowerBed.solo ? Math.min(width/480,h/360) :
        Math.min(width/480,w*.54/480,h*.52/360);
      const centre=count===1 && flowerBed.oak ? w*.72 : margin+(slot+.5)*width;
      const water=e.soak ? 1+.12*pop((e.time-e.soak)/.6) : 1;
      ctx.save();
      ctx.translate(centre,h);
      ctx.scale(scale,scale*water);
      ctx.translate(-240,-360);
      asset.paint(ctx,Math.min(asset.length-1,Math.floor(time*shot.fps)));
      ctx.restore();
    }
  };
}

export const flowers=Object.fromEntries(flowerShots.map(shot=>[shot.id,flowerPart(shot)]));
