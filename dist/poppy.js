import {ease, pop} from './show-kit.js';

let artwork;
let loaded;

export function preparePoppy() {
  if (!loaded) {
    artwork = {};
    loaded = Promise.all(['stems', 'bloom', 'grass'].map(name => {
      const image = new Image();
      artwork[name] = image;
      image.src = './assets/poppy/' + name + '.svg';
      return image.decode().catch(() => {});
    }));
  }
  return loaded;
}

function layer(ctx, name, x, bottom, width, height) {
  const image = artwork[name];
  if (height > 0 && image.complete && image.naturalWidth) {
    ctx.drawImage(image, x, bottom - height, width, height);
  }
}

export const poppyScene = {
  len:2.2, stays:true, z:1,
  make() { preparePoppy(); return {}; },
  draw(e, state, t) {
    const {ctx,w,h,u} = e;
    const scale = Math.min(w / 420, h / 360, 1.3 * u);
    const width = 420 * scale;
    const bottom = h + 1;
    const left = (w - width) / 2;
    const wet = e.soak ? 1 + .18 * pop((e.time - e.soak) / .6) : 1;
    const growth = ease(t / .95) * wet;
    const height = 250 * scale * growth;
    layer(ctx, 'stems', left, bottom, width, height);

    const open = pop((t - .57) / .85);
    if (open > 0) {
      // The petals open at the tip of the growing stem, including after the whale waters it.
      const tipX = w / 2, tipY = bottom - 142 * scale * growth;
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(Math.sin(t * 1.7) * .028);
      ctx.scale(open, open);
      layer(ctx, 'bloom', -210 * scale, 142 * scale, width, 250 * scale);
      ctx.restore();
    }
    const patches = Math.max(1, Math.round(w / width));
    const grassHeight = 250 * scale * ease(t / .68) * wet;
    for (let i = 0; i < patches; i++) {
      layer(ctx, 'grass', w * i / patches, bottom, w / patches, grassHeight);
    }
  }
};
