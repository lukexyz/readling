import {fitShot,loadSpriteShot} from './sprite-shot.js';
import {contactShadow} from './meadow.js';

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
    const width=e.field?Math.max(e.w*.19,Math.min(e.w*.37,e.field.left)):e.w*(e.preview?1:.54);
    e.ctx.save();
    const x=e.preview?e.w/2:width*.51, foot=e.h*(e.field?.94:1);
    if(e.field) contactShadow(e.ctx,x,foot-2,width*.27,e.h*.017,.19*Math.min(1,time));
    fitShot(e.ctx,e.field?[8,12,450,324]:[0,0,480,360],width,e.h*(e.field?.79:1),x,foot);
    canopy.paint(e.ctx, Math.min(canopy.length-1, Math.max(0, Math.floor(time*24))));
    e.ctx.restore();
  }
};
