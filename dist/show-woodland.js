import {woodlandShots, highestWoodland} from './woodland.js';
import {cutout,prepareShow} from './show-cutouts.js';
import {bump} from './show-kit.js';
import {fitShot} from './sprite-shot.js';

export function paradeWords(finds,word,turn=0) {
  if (!finds.length) return [];
  const offset=turn%finds.length;
  const rotated=[...finds.slice(offset),...finds.slice(0,offset)];
  return finds.includes(word) ? [word,...rotated.filter(w=>w!==word)] : rotated;
}

function paintPictures(ctx,anchors,words) {
  for (const [i,anchor] of (anchors || []).entries()) {
    if (!anchor || !words[i]) continue;
    const picture=cutout(words[i]);
    if (!picture.ready) continue;
    const [x,y,angle,width]=anchor;
    ctx.save();
    ctx.translate(x,y);ctx.rotate(angle);
    ctx.drawImage(picture.canvas,-width/2,-width/2,width,width);
    ctx.restore();
  }
}

// The gallery has no album. Give its band the same example finds used on the game preview cards.
export async function loadParadeExample(shot) {
  const words=['cat','dog','hen'];
  const [asset]=await Promise.all([shot.load(),prepareShow(words)]);
  return {...asset,paint(ctx,index) {
    asset.paint(ctx,index);
    paintPictures(ctx,asset.anchors?.[index],words);
  }};
}

function woodlandPart(shot) {
  const ground=shot.family==='vines' || shot.family==='mushrooms';
  const parade=shot.family==='parade';
  // Use the herd's common ground line. The original Blender camera includes
  // empty pixels below the feet and above the highest raised trunk.
  const panelCrop=shot.family==='elephants' ? [0,48,480,282] : shot.crop;
  const artwork=new WeakMap();
  let pending,poster=(shot.frames-1)/shot.fps;
  // Bound the whole camera, including the jump. The tallest rabbit in level
  // one then occupies at most 72 CSS pixels on a desktop or tablet.
  function cameraHeight(e) {
    if(shot.family==='elephants' && e.panelSide) return Math.min(e.h,130*e.pixelsPerCssPixel);
    return shot.family==='bunnies' && !e.preview ? Math.min(e.h,104*e.pixelsPerCssPixel) : e.h;
  }
  function place(e,width,centre) {
    // Both animals face in towards the word, including any hat tracked to their head.
    if(shot.family==='bunnies' && e.panelSide==='right') {
      e.ctx.translate(e.w,0);e.ctx.scale(-1,1);
    }
    fitShot(e.ctx,e.panelSide ? panelCrop : shot.crop,e.w*width,cameraHeight(e),e.w*centre,e.h);
  }
  function paint(e,index) {
    const asset=artwork.get(e);
    if (!asset) return;
    asset.paint(e.ctx,index);
    if (parade) paintPictures(e.ctx,asset.anchors?.[index],e.paradeWords);
    if (e.has('hats') && !ground) {
      const track=parade ? asset.hats : asset.anchors;
      for (const anchor of track?.[index] || []) if (anchor) e.hat(...anchor);
    }
  }
  return {
    family:shot.family,len:shot.frames/shot.fps,stays:ground,z:ground ? 1 : 6,
    get poster() { return poster; },
    async prepare(e) {
      try {
        pending ||= shot.load().finally(()=>{pending=null;});
        const [asset]=await Promise.all([pending,parade && prepareShow(e.paradeWords.slice(0,shot.level))]);
        artwork.set(e,asset);poster=(asset.poster-1)/shot.fps;
      } catch(error) {console.warn('Could not load '+shot.name,error);}
    },
    draw(e,state,time) {
      let width=1, centre=.5;
      if (!e.isolatedWoodland) {
        if (shot.family==='mushrooms') {
          width=.43;centre=.77;
        } else if (shot.family==='vines') { width=.96; }
        else { width=.86; }
      }
      const ctx=e.ctx;
      ctx.save();
      place(e,width,centre);
      if(shot.family==='mushrooms' && e.soak) {
        const squash=.10*bump((e.time-e.soak)/.6);
        ctx.translate(0,shot.crop[3]*squash);ctx.scale(1,1-squash);
      }
      paint(e,Math.min(shot.frames-1,Math.floor(time*shot.fps)));
      ctx.restore();
    },
    shakeDry(e,t) {
      const up=bump((t-.20)/1.5);
      if (up<=0) return;
      e.ctx.save();
      const width=e.panelSide ? .86 : .5, centre=e.panelSide ? .5 : .25;
      place(e,width,centre);
      e.ctx.translate(240,360+(1-up)*340);
      e.ctx.rotate(.08*up*Math.sin(t*36));e.ctx.translate(-240,-360);
      paint(e,Math.round(poster*shot.fps));
      e.ctx.restore();
    }
  };
}
export const woodlandParts=Object.fromEntries(woodlandShots.map(shot=>[shot.id,woodlandPart(shot)]));
export function splashBunnies(e) {
  return woodlandParts[highestWoodland('bunnies',e.has)];
}
