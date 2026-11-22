import {dolphinShots,loadDolphin} from './dolphins.js';
import {fitShot,poseTime} from './sprite-shot.js';
import {drawShore} from './meadow.js';

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
  const vault=shot.take.startsWith('vault'), relay=shot.take.startsWith('relay');
  const crop=vault?[36,0,500,373]:[12,108,534,219];
  const landings=shot.take==='skip-2' || shot.take==='skip-3'?[[.1,.19],[1.15,.43],[2.68,.78]]:
    relay?[[.13,.82],[shot.frames/30-.64,.23]]:vault && shot.level===3?[[.12,.27],[1.80,.48],[2.08,.69]]:
    [[.08,.25],[shot.frames/30-.69,.66]];
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
      const frame=Math.min(shot.frames-1,Math.floor(poseTime(time,(shot.poster-1)/30)*30));
      const travel=Math.min(1,time/(shot.frames/30));
      const centre=e.w*(e.field ? .5+(relay?-.13:.11)*(travel-.5) : e.preview ? .5 : .43);
      const ctx=e.ctx;
      ctx.save();
      drawShore(e,time,shot.frames/30,landings);
      fitShot(ctx,e.field?crop:shot.crop,e.w*(e.field?.89:e.preview?1:.84),e.h*(e.field?.86:1),centre,e.h*(e.field?.93:1));
      asset.paint(ctx,frame);
      if (e.has('hats')) {
        for (const anchor of hats?.[shot.take]?.[frame] || []) e.hat(...anchor);
      }
      ctx.restore();
    }
  };
}

export const dolphins=Object.fromEntries(dolphinShots.map(shot=>[shot.id,dolphinPart(shot)]));
