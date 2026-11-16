import {fps,loadShot,shots} from './ember-orca.js';

let hats, loadingHats;
function prepareHats() {
  if (hats) return;
  return loadingHats ||= fetch(new URL('./assets/ember-orca/hats.json',import.meta.url))
    .then(response => {
      if (!response.ok) throw new Error('Missing orca hat positions');
      return response.json();
    })
    .then(data => { hats=data; })
    .catch(error => console.warn(error))
    .finally(() => { loadingHats=null; });
}

function orca(shot) {
  let asset, loading;
  return {
    len:shot.frames/fps, contact:shot.contact/fps, z:4,
    prepare(e) {
      if (!asset && !loading) {
        loading=loadShot(shot.level)
          .then(data => { asset=data; })
          .catch(error => console.warn('Could not load Ember Orca level '+shot.level,error))
          .finally(() => { loading=null; });
      }
      const head=e.has('hats') && prepareHats();
      if (loading || head) return Promise.all([loading,head]);
    },
    draw(e,state,t) {
      if (!asset) return;
      const frame=Math.floor(t*fps);
      const [x,y,w,h]=shot.crop;
      const widthFraction=e.virtual ? .89 : [.47,.62,.74][shot.level-1];
      const heightFraction=e.virtual ? .89 : [.40,.57,.67][shot.level-1];
      const scale=Math.min(e.w*widthFraction/w,e.h*heightFraction/h);
      const centre=Math.min(e.w*(e.virtual || e.w<=e.h?.50:.68),e.w*.98-w*scale/2);
      const ctx=e.ctx;
      ctx.save();
      ctx.translate(centre-(x+w/2)*scale,e.h-2*e.u-(y+h)*scale);
      ctx.scale(scale,scale);
      asset.paint(ctx,frame);
      const head=hats?.[shot.level]?.[frame];
      if (head && e.has('hats')) e.hat(...head);
      ctx.restore();
    }
  };
}

// The album IDs are stable across the original Whale and its upgrades.
export const orcas={whale:orca(shots[0]), whale2:orca(shots[1]), whale3:orca(shots[2])};
