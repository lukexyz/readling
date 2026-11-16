import {loadSpriteShot} from './sprite-shot.js';

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
    const scale = e.virtual ? Math.min(e.w/480, e.h/360) : Math.min(e.w*.54/480, e.h*.66/360);
    const left = e.virtual ? (e.w-480*scale)/2 : -12*scale;
    e.ctx.save();
    e.ctx.translate(left, e.h-360*scale);
    e.ctx.scale(scale, scale);
    canopy.paint(e.ctx, Math.min(canopy.length-1, Math.max(0, Math.floor(time*24))));
    e.ctx.restore();
  }
};
