import {prismShots} from './prism.js';
import {fitShot,poseTime} from './sprite-shot.js';
import {clamp01,drawStar,four} from './show-kit.js';
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

export function decoratePicturePoster(img,shot,word='cat') {
  if (shot.family!=='picture') return;
  async function decorate() {
    try {
      const portrait=await loadPortrait(word);
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

// Follow the original illustration on its actual rotated stamp, including the
// matching word in a row of memory cards. Its printed lines show through the lights.
function traceStamp(e,portrait,phase,level) {
  if(!portrait) return;
  const {ctx,target}=e, {size}=target, progress=clamp01((phase-.08)/.68);
  const fade=Math.min(1,phase*8,(1-phase)*6);
  ctx.save();ctx.translate(target.x,target.y);ctx.rotate(target.angle);
  ctx.globalAlpha=fade;
  for(const [x,y] of portrait.points) {
    const age=progress-(.5-y)*.78;
    if(age<=0 || age>.27) continue;
    const radius=size*(.004+.007*Math.sin(age/.27*Math.PI));
    ctx.fillStyle='#fff2b2';ctx.strokeStyle='#9b723d';ctx.lineWidth=Math.max(.6,radius*.45);
    ctx.beginPath();ctx.arc(x*size,y*size,radius,0,Math.PI*2);ctx.fill();ctx.stroke();
  }
  const r=size*.54;
  for(const side of level>1?[-1,1]:[-1]) {
    const a=progress*Math.PI, x=side*r*Math.sin(a), y=r*Math.cos(a);
    drawStar(ctx,x,y,size*.034,phase*2,four,'#ffe181');
  }
  if(level===3 && phase>.54) {
    const lift=clamp01((phase-.54)/.18);
    ctx.globalAlpha*=lift;
    for(const side of [-1,0,1]) drawStar(ctx,side*r*.32,-r*(side?.99:1.12),size*(side?.028:.049),0,four,'#ebc166');
  }
  ctx.restore();
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
      if(family==='picture' && e.target) {
        poster=frames/fps*.65;
        try {playback.set(e,await loadPortrait(word));}
        catch(error) {console.warn('Could not load '+shot.name,error);}
        return;
      }
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
      if(e.target && family==='picture') {
        traceStamp(e,asset,clamp01(t*fps/(frames-1)),shot.level);return;
      }
      if(e.field && !arch) {
        const left=family==='blooms', gap=left?e.field.left:e.w-e.field.right;
        const width=Math.min(e.w*.45,Math.max(gap*.98,e.w*.22)), height=e.h*.81;
        const x=left?width*.51:e.w-width*.51, foot=e.h*.79;
        const rising=clamp01(t/.58);
        if(rising<1) {
          ctx.save();ctx.globalAlpha=Math.sin(rising*Math.PI);ctx.strokeStyle=left?'#ab6853':'#95704d';ctx.lineWidth=1.7*e.u;
          ctx.beginPath();ctx.moveTo(x+(left?-1:1)*width*.08,foot+e.h*.08);ctx.quadraticCurveTo(x,foot-e.h*.08,x,foot-rising*height*.38);ctx.stroke();ctx.restore();
        }
        ctx.save();
        if(family==='paint') {ctx.shadowColor='#926c49';ctx.shadowBlur=1.6*e.u;}
        fitShot(ctx,[20,16,344,258],width,height,x,foot);
        asset.paint(ctx,Math.min(frames-1,Math.floor(poseTime(t,poster)*fps)));
        ctx.restore();return;
      }
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
