import {dolphinShots,loadDolphin} from './dolphins.js';
import {fitShot} from './sprite-shot.js';

let hats,loadingHats;
function prepareHats() {
  if (hats) return;
  return loadingHats ||= fetch(new URL('./assets/dolphins/hats.json',import.meta.url))
    .then(response=>{
      if (!response.ok) throw new Error('Missing dolphin hat positions');
      return response.json();
    })
    .then(data=>{hats=data;})
    .catch(error=>console.warn(error))
    .finally(()=>{loadingHats=null;});
}

function dolphinPart(shot) {
  let asset,loading;
  return {
    len:shot.frames/30, poster:(shot.poster-1)/30, z:6,
    prepare(e) {
      if (!asset && !loading) {
        loading=loadDolphin(shot).then(data=>{asset=data;})
          .catch(error=>console.warn('Could not load '+shot.title,error))
          .finally(()=>{loading=null;});
      }
      const hatLoad=e.has('hats') && prepareHats();
      if (loading || hatLoad) return Promise.all([loading,hatLoad]);
    },
    draw(e,state,time) {
      if (!asset) return;
      const frame=Math.floor(time*30);
      const centre=e.w*(e.preview ? .5 : .43);
      const ctx=e.ctx;
      ctx.save();
      fitShot(ctx,shot.crop,e.w*(e.preview?1:.84),e.h,centre,e.h);
      asset.paint(ctx,frame);
      if (e.has('hats')) {
        for (const anchor of hats?.[shot.take]?.[frame] || []) e.hat(...anchor);
      }
      ctx.restore();
    }
  };
}

export const dolphins=Object.fromEntries(dolphinShots.map(shot=>[shot.id,dolphinPart(shot)]));
