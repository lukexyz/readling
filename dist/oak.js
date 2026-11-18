import {fitShot,loadSpriteShot} from './sprite-shot.js';

const manifest = new URL('./assets/flower-studies/oak-3.json', import.meta.url);
let canopy, pending;

export const oakScene = {
  len:94/24, poster:85/24, stays:true, z:1,
  prepare() {
    if (canopy) return;
    return pending ||= loadSpriteShot(manifest)
      .then(shot => { canopy = shot; })
      .catch(error => console.warn('Could not load the oak', error))
      .finally(() => { pending = null; });
  },
  draw(e, state, time) {
    if (!canopy) return;
    const width=e.w*(e.preview?1:.54);
    e.ctx.save();
    fitShot(e.ctx,[0,0,480,360],width,e.h,e.preview?e.w/2:width/2,e.h);
    canopy.paint(e.ctx, Math.min(canopy.length-1, Math.max(0, Math.floor(time*24))));
    e.ctx.restore();
  }
};
