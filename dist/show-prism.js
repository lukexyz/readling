import {prismShots} from './prism.js';
import {fitShot} from './sprite-shot.js';
import {clamp01} from './show-kit.js';
import {cutout,prepareShow} from './show-cutouts.js';

let sparkImage;
const portraits=new WeakMap();
const sparkUrl=new URL('./assets/prism/picture-spark.webp',import.meta.url);

// Keep the fine lines (whiskers, handles, feathers) legible between the individual sparks.
async function loadPortrait(word) {
  if (!sparkImage) {
    const image=new Image();
    image.src=sparkUrl.href;
    sparkImage=image.decode().then(()=>image).catch(error=>{sparkImage=null;throw error;});
  }
  const [jewel]=await Promise.all([sparkImage,prepareShow([word])]);
  const art=cutout(word);
  if (!art.ready) return null;
  if (!portraits.has(art.canvas)) {
    const ink=document.createElement('canvas');
    ink.width=art.canvas.width;ink.height=art.canvas.height;
    const ctx=ink.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(art.canvas,0,0);
    const pixels=ctx.getImageData(0,0,ink.width,ink.height), data=pixels.data;
    for (let i=0;i<data.length;i+=4) {
      const light=(data[i]*.30+data[i+1]*.59+data[i+2]*.11)/255;
      data[i+3]*=clamp01((.82-light)/.48);
      data[i]=255;data[i+1]=217;data[i+2]=135;
    }
    ctx.putImageData(pixels,0,0);
    portraits.set(art.canvas,{ink,points:art.points,jewel});
  }
  return portraits.get(art.canvas);
}

function drawPortrait(ctx,portrait,phase,level) {
  const cue=[16/47,19/55,22/63][level-1];
  if (!portrait || phase<cue) return;
  const reveal=clamp01((phase-cue)/.25), fade=1-clamp01((phase-.83)/.16);
  if (!fade) return;
  const {ink,points,jewel}=portrait;
  ctx.save();ctx.translate(192,144);
  ctx.globalAlpha*=fade;
  const alpha=ctx.globalAlpha, size=144;
  ctx.globalAlpha=alpha*reveal*reveal*.96;
  ctx.drawImage(ink,-size/2,-size/2,size,size);
  for (let i=0;i<points.length;i++) {
    const u=clamp01((phase-cue-(i*.618%1)*.08)/.18);
    if (!u) continue;
    const ease=u*(2-u), [px,py]=points[i], scatter=1-ease;
    const angle=i*2.4, x=px*size*ease+Math.cos(angle)*82*scatter;
    const y=py*size*ease+Math.sin(angle)*82*scatter+Math.pow(1-fade,2)*20;
    const glint=.5+.5*Math.cos(i*2.1+phase*19);
    const radius=1.25+level*.24+glint*1.15+(i%21===0?1.5:0);
    ctx.globalAlpha=alpha*u*(.62+.38*glint);
    ctx.drawImage(jewel,x-radius,y-radius,radius*2,radius*2);
  }
  ctx.restore();
}

// The same decorated shot plays in the gallery and game. Only the portrait is specific to the word.
export async function loadPrism(shot,word='cat') {
  if (shot.family!=='picture') return shot.load();
  const [asset,portrait]=await Promise.all([shot.load(),loadPortrait(word)]);
  return {...asset,paint(ctx,index) {
    asset.paint(ctx,index);
    drawPortrait(ctx,portrait,index/(asset.length-1),shot.level);
  }};
}

export function decoratePicturePoster(img,shot) {
  if (shot.family!=='picture') return;
  async function decorate() {
    try {
      const portrait=await loadPortrait('cat');
      if (!portrait) return;
      const canvas=document.createElement('canvas');
      canvas.width=384;canvas.height=288;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,384,288);drawPortrait(ctx,portrait,.68,shot.level);
      img.src=canvas.toDataURL();
    } catch { /* The original Blender poster remains visible if its sample portrait cannot load. */ }
  }
  if (img.complete && img.naturalWidth) decorate();
  else img.addEventListener('load',decorate,{once:true});
}

function prismPart(shot) {
  const {family,frames,fps}=shot;
  const arch=family==='rainbow' || family==='rainbow2';
  const playback=new WeakMap(), loading=new Map();
  let poster=(frames-1)/fps;
  return {
    len:frames/fps,stays:arch,z:arch?3:family==='picture'?7:5,
    get poster() { return poster; },
    async prepare(e) {
      if(arch && !e.virtual) return;
      const word=family==='picture' ? e.word || e.finds[0] || 'cat' : '';
      if (!loading.has(word)) loading.set(word,loadPrism(shot,word).finally(()=>loading.delete(word)));
      try {
        const asset=await loading.get(word);
        playback.set(e,asset);poster=(asset.poster-1)/fps;
      } catch(error) {console.warn('Could not load '+shot.name,error);}
    },
    draw(e,s,t) {
      const asset=playback.get(e);
      if (!asset) return;
      const ctx=e.ctx;
      const centre=e.soloPrism || arch ? .5 : family==='blooms'?.34:family==='paint'?.67:.5;
      const width=e.w*Math.min(centre,1-centre)*2;
      ctx.save();
      fitShot(ctx,shot.crop,width,e.h,e.w*centre,e.h);
      asset.paint(ctx,Math.min(frames-1,Math.floor(t*fps)));
      ctx.restore();
    }
  };
}
export const prismParts=Object.fromEntries(prismShots.map(shot=>[shot.id,prismPart(shot)]));
