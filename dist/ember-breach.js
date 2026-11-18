import {fps,loadShot,shots} from './ember-orca.js';
import {fitShot} from './sprite-shot.js';

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
      const width=e.w*(e.preview?.89:[.47,.62,.74][shot.level-1]);
      const centre=e.preview?e.w/2:Math.min(e.w*.66,e.w-width/2);
      const ctx=e.ctx;
      ctx.save();
      fitShot(ctx,shot.crop,width,e.h*(e.preview?.89:1),centre,e.h);
      asset.paint(ctx,frame);
      const head=hats?.[shot.level]?.[frame];
      if (head && e.has('hats')) e.hat(...head);
      ctx.restore();
    }
  };
}

// The album IDs are stable across the original Whale and its upgrades.
export const orcas={whale:orca(shots[0]), whale2:orca(shots[1]), whale3:orca(shots[2])};
