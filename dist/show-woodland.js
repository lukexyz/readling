import {woodlandShots, highestWoodland} from './woodland.js';
import {cutout,prepareShow} from './show-cutouts.js';
import {bump,clamp01,swing} from './show-kit.js';
import {fitShot,poseTime} from './sprite-shot.js';
import {contactShadow} from './meadow.js';

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
  const panelCrop=shot.family==='elephants' ? [0,64,480,242] : parade ? [4,51,468,292] : [42,16,403,331];
  const artwork=new WeakMap();
  let pending,poster=(shot.frames-1)/shot.fps;
  // Bound the whole camera, including the jump. The tallest rabbit in level
  // one then occupies at most 72 CSS pixels on a desktop or tablet.
  function cameraHeight(e) {
    if(shot.family==='elephants' && e.panelSide) return Math.min(e.h,130*e.pixelsPerCssPixel);
    return shot.family==='bunnies' && !e.preview ? Math.min(e.h,104*e.pixelsPerCssPixel) : e.h;
  }
  function place(e,width,centre,t=0) {
    if(e.field && !ground) {
      const travel=swing(poseTime(t,poster)/(shot.frames/shot.fps));
      const size=e.w*(parade?.84:.75), height=e.h*(shot.family==='elephants'?.74:.86);
      const drawnWidth=Math.min(size,height*panelCrop[2]/panelCrop[3],panelCrop[2]);
      const margin=drawnWidth*.5+e.w*(parade?.035:.09);
      const distance=Math.max(0,e.w-2*margin), y=e.h*.94;
      const x=e.w/2+(e.panelSide==='right'?.5-travel:travel-.5)*distance;
      contactShadow(e.ctx,x,y-2,Math.min(size*.29,height*.40),Math.min(height*.023,5));
      if(shot.family==='bunnies' && e.panelSide==='right') {
        e.ctx.translate(2*x,0);e.ctx.scale(-1,1);
      }
      fitShot(e.ctx,panelCrop,size,height,x,y);return;
    }
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
      const frame=Math.min(shot.frames-1,Math.floor(poseTime(time,poster)*shot.fps));
      if(e.field && ground) {
        const {ctx,w,h}=e, foot=h*.94;
        if(shot.family==='vines') {
          const sides=shot.level===1 ? [[20,186,0]] : [[20,220,0],[240,212,1]];
          if(shot.level>1) {
            const reach=swing((time-.6)/1.65)*(shot.level===2?.50:.29);
            ctx.save();ctx.strokeStyle='#7c9477';ctx.lineWidth=Math.max(1,h*.006);
            for(const direction of [-1,1]) {
              ctx.save();ctx.translate(direction===1?0:w,0);ctx.scale(direction,1);
              ctx.beginPath();ctx.moveTo(-w*.01,h*.20);
              ctx.quadraticCurveTo(w*.04,h*.017,w*reach,h*.034);ctx.stroke();
              // Buds follow the same quadratic as the runner, alternating along its tip.
              for(const u of [.55,.72,.88,.98]) {
                const v=1-u, x=w*(-.01*v*v+.08*v*u+reach*u*u), y=h*(.20*v*v+.034*v*u+.034*u*u);
                const size=Math.min(w*.013,h*.034)*reach*2.6*(1.6-u);
                ctx.fillStyle=u===.72 || u===.98?'#87a08a':'#a5b79a';
                ctx.beginPath();ctx.ellipse(x,y,size,size*.32,u===.72 || u===.98?-.50:.51,0,Math.PI*2);ctx.fill();
              }
              ctx.restore();
            }
            ctx.restore();
          }
          for(const [start,width,side] of sides) {
            const room=w*(shot.level===1?.23:.26), height=h*(shot.level===1?.84:.97);
            const scale=Math.min(1,room/width,height/324);
            const y=shot.level===1 ? foot : h*.015+324*scale;
            ctx.save();
            fitShot(ctx,[start,12,width,324],room,height,side?w-width*scale*.52:width*scale*.52,y);
            ctx.beginPath();ctx.rect(start,0,width,360);ctx.clip();paint(e,frame);ctx.restore();
          }
        } else {
          const width=Math.max(w*.17,Math.min(w*.4,w-e.field.right)), x=w-width*.52;
          const height=Math.min(h*.63,width*.83);
          contactShadow(ctx,x,foot-h*.02,width*.29,Math.max(1,h*.018),.21);
          ctx.save();fitShot(ctx,[27,26,422,309],width,height,x,foot);paint(e,frame);ctx.restore();
          const light=clamp01((time-2.5)/.8);
          if(shot.level===3 && light>0 && light<1) {
            const angle=light*Math.PI*2;
            ctx.fillStyle='#fff2b6';ctx.beginPath();ctx.arc(x+Math.cos(angle)*width*.26,foot-height*.08+Math.sin(angle)*height*.07,2.5*e.u,0,Math.PI*2);ctx.fill();
          }
        }
        return;
      }
      let width=1, centre=.5;
      if (!e.isolatedWoodland) {
        if (shot.family==='mushrooms') {
          width=.43;centre=.77;
        } else if (shot.family==='vines') { width=.96; }
        else { width=.86; }
      }
      const ctx=e.ctx;
      ctx.save();
      place(e,width,centre,time);
      if(shot.family==='mushrooms' && e.soak) {
        const squash=.10*bump((e.time-e.soak)/.6);
        ctx.translate(0,shot.crop[3]*squash);ctx.scale(1,1-squash);
      }
      paint(e,frame);
      ctx.restore();
      if(e.field && shot.family==='elephants') {
        const dust=bump((time-shot.frames/shot.fps+.57)/.54);
        if(dust) contactShadow(ctx,e.w*.40,e.h*(.94-.045*dust),e.w*.035*dust,e.h*.018*dust,.13*dust);
      }
    },
    shakeDry(e,t) {
      const up=bump((t-.32)/1.52);
      if (up<=0) return;
      e.ctx.save();
      const width=e.panelSide ? .86 : .5, centre=e.panelSide ? .5 : .25;
      place(e,width,centre,poster);
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
