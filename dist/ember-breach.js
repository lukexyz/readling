import {fps,loadShot,shots} from './ember-orca.js';
import {fitShot,poseTime} from './sprite-shot.js';
import {drawShore} from './meadow.js';
import {swing} from './show-kit.js';

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
  const closeCrops=[[143,69,277,244],[80,74,369,289],[91,20,379,377]];
  const pose=shot.beats.find(([name])=>['Exhale','Bank','Invert'].includes(name))[1];
  return {
    len:shot.frames/fps, contact:shot.contact/fps, poster:(pose-1)/fps, z:4,
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
      const frame=Math.min(shot.frames-1,Math.floor(poseTime(t,this.poster)*fps));
      const width=e.w*(e.field?.94:e.preview?.89:[.47,.62,.74][shot.level-1]);
      const centre=e.preview || e.field?e.w/2:Math.min(e.w*.66,e.w-width/2);
      const ctx=e.ctx;
      ctx.save();
      drawShore(e,t,shot.frames/fps,[[.06,.40],[shot.contact/fps,.55],[shot.contact/fps+.21,.57]]);
      // Hold a closer view of the animal. Ease back to the full camera before
      // impact, so the banking fan and the taller tower of foam both fit.
      const pullBack=swing((frame-pose)/(shot.contact-pose));
      const crop=e.field?closeCrops[shot.level-1].map((value,i)=>value+(shot.crop[i]-value)*pullBack):shot.crop;
      fitShot(ctx,crop,width,e.h*(e.field?.88:e.preview?.89:1),centre,e.h*(e.field?.94:1));
      asset.paint(ctx,frame);
      const head=hats?.[shot.level]?.[frame];
      if (head && e.has('hats')) e.hat(...head);
      ctx.restore();
    }
  };
}

// The album IDs are stable across the original Whale and its upgrades.
export const orcas={whale:orca(shots[0]), whale2:orca(shots[1]), whale3:orca(shots[2])};
