import {woodlandShots, highestWoodland} from './woodland.js';
import {cutout,prepareShow} from './show-cutouts.js';
import {bump,clamp01,swing} from './show-kit.js';
import {fitShot,poseTime} from './sprite-shot.js';
import {contactShadow} from './meadow.js';
import {drawRabbitVisit} from './show-rabbits.js';

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

// These long curriculum words can fold at the seam between two whole words.
const ticketWords=new Map(['star fish','dish cloth','egg plant','black bird','jelly fish','dragon fly',
  'rain coat','book case','note book','arm chair','shoe lace','hedge hog','black berry',
  'humming bird','light house','grape fruit','straw berry'].map(parts=>[parts.replace(' ',''),parts.indexOf(' ')]));

// The paper is cached once per performance. Each cell keeps the marks from her writing pad.
function handwritingTicket(word,ink) {
  if(!ink?.some(lines=>lines?.some(line=>line.length))) return null;
  const paper=document.createElement('canvas'), cell=92, rowHeight=112;
  const wrap=ticketWords.get(word) ?? word.length, columns=Math.max(wrap,word.length-wrap), rows=wrap<word.length?2:1;
  paper.width=cell*columns+26;paper.height=rows*rowHeight+20;paper.columns=columns;
  let top=138,bottom=0;
  for(const lines of ink) for(const stroke of lines) for(const [,y] of stroke){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const ctx=paper.getContext('2d');
  ctx.fillStyle='#fff5d7';ctx.strokeStyle='#957548';ctx.lineWidth=4;
  ctx.beginPath();ctx.roundRect(3,3,paper.width-6,paper.height-6,12);ctx.fill();ctx.stroke();
  ctx.setLineDash([6,7]);ctx.lineWidth=2;ctx.strokeRect(9,9,paper.width-18,paper.height-18);ctx.setLineDash([]);
  ctx.strokeStyle='#52634a';ctx.fillStyle='#879176';ctx.lineCap='round';ctx.lineJoin='round';
  for(const [i,ch] of [...word].entries()) {
    const second=i>=wrap, rowLength=second?word.length-wrap:wrap;
    const lines=ink[i] || [], x=13+((columns-rowLength)/2+(second?i-wrap:i))*cell, row=10+(second?rowHeight:0);
    if(!lines.length) {
      ctx.font='67px Georgia, serif';ctx.textAlign='center';ctx.fillText(ch,x+cell*.5,row+rowHeight*.76);continue;
    }
    let left=180,right=0;
    for(const line of lines) for(const [px] of line) {left=Math.min(left,px);right=Math.max(right,px);}
    const scale=Math.min(1.5,(cell-12)/Math.max(1,right-left),(rowHeight-14)/Math.max(40,bottom-top));
    ctx.save();ctx.translate(x+cell/2,row+rowHeight*.5);ctx.scale(scale,scale);ctx.translate(-(left+right)/2,-(top+bottom)/2);
    ctx.lineWidth=5;
    for(const line of lines) {
      if(!line.length) continue;
      ctx.beginPath();ctx.moveTo(...line[0]);
      for(let j=1;j<line.length;j++) ctx.lineTo(...line[j]);
      if(line.length===1) ctx.lineTo(line[0][0]+.05,line[0][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  return paper;
}

function unfurlTicket(e,anchor,paper,turn) {
  const bed=e.ticketBed, view=bed?.view || e, ctx=view.ctx, d=view.pixelsPerCssPixel || 1;
  const hitch=bed?{x:anchor.x*bed.dx,y:bed.y+anchor.y*bed.dy}:anchor;
  const ratio=paper.width/paper.height, desired=Math.min(188,34+paper.columns*25)*d;
  const space=view.field, shallow=bed && (e.h/bed.view.pixelsPerCssPixel<62 || paper.columns>5);
  const side=shallow && space.left>desired*.65;
  const width=Math.min(desired,side?space.left*.86:view.w*(e.preview?.41:.44));
  const height=Math.min(width/ratio,side?view.h*.76:bed?Math.max(1,view.h-space.bottom-4*d):e.h*.55);
  const x=side?space.left*.50:Math.max(width*.52,Math.min(view.w-width*.52,hitch.x-width*.65));
  const y=side?view.h*.53:Math.min(view.h-height*.55,Math.max(bed?space.bottom+height*.51:height*.52,hitch.y-height*.15));
  ctx.save();
  if(Math.hypot(x-hitch.x,y-hitch.y)<width*1.15) {
    ctx.strokeStyle='#806a43';ctx.lineWidth=Math.max(1,width*.01);ctx.beginPath();
    ctx.moveTo(hitch.x,hitch.y);ctx.quadraticCurveTo(x+width*.34,y+height*.40,x,y);ctx.stroke();
  }
  ctx.translate(x,y);ctx.rotate(-.04*(1-turn));ctx.scale(turn,1);
  ctx.drawImage(paper,-width*.5,-height*.5,width,height);ctx.restore();
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
  const artwork=new WeakMap(), tickets=new WeakMap();
  let pending,poster=(shot.frames-1)/shot.fps;
  function place(e,width,centre,t=0) {
    if(e.panelSide==='path') {
      const progress=clamp01(t/(shot.frames/shot.fps));
      const size=e.w*.68, height=Math.min(e.h*.91,142*e.pixelsPerCssPixel);
      const drawnWidth=Math.min(size,height*panelCrop[2]/panelCrop[3],panelCrop[2]);
      const margin=drawnWidth*.56+(parade?e.w*.20:0), travel=progress*.68+swing(progress)*.32;
      const x=-margin+(e.w+2*margin)*travel, y=e.h*.97;
      contactShadow(e.ctx,x,y-2,drawnWidth*.25,Math.min(height*.027,5),.15);
      fitShot(e.ctx,panelCrop,size,height,x,y);return;
    }
    const height=shot.family==='elephants' && e.panelSide?Math.min(e.h,130*e.pixelsPerCssPixel):e.h;
    fitShot(e.ctx,e.panelSide ? panelCrop : shot.crop,e.w*width,height,e.w*centre,e.h);
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
    get poster() {
      if(shot.family==='bunnies') return shot.frames/shot.fps*(shot.level===2?.40:.32);
      return ground?poster:Math.min(poster,shot.frames/shot.fps*.60);
    },
    async prepare(e) {
      try {
        pending ||= shot.load().finally(()=>{pending=null;});
        const [asset]=await Promise.all([pending,parade && prepareShow(e.paradeWords.slice(0,shot.level))]);
        artwork.set(e,asset);poster=(asset.poster-1)/shot.fps;
        if(parade) {
          const word=e.paradeWords.find(w=>e.handwriting?.[w]?.ink?.some(lines=>lines.length));
          if(word) tickets.set(e,handwritingTicket(word,e.handwriting[word].ink));
        }
      } catch(error) {console.warn('Could not load '+shot.name,error);}
    },
    draw(e,state,time) {
      if(shot.family==='bunnies') {
        drawRabbitVisit(e,shot,artwork.get(e),time);return;
      }
      const frame=Math.min(shot.frames-1,Math.floor(poseTime(time,poster)*shot.fps));
      if(e.field && ground) {
        const {ctx,w,h}=e, foot=h*.76;
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
      const basis=ctx.getTransform();
      ctx.save();
      place(e,width,centre,time);
      if(shot.family==='mushrooms' && e.soak) {
        const squash=.10*bump((e.time-e.soak)/.6);
        ctx.translate(0,shot.crop[3]*squash);ctx.scale(1,1-squash);
      }
      paint(e,frame);
      const anchor=parade && artwork.get(e)?.anchors?.[frame]?.[0];
      const hitch=anchor && basis.inverse().multiply(ctx.getTransform()).transformPoint({x:anchor[0],y:anchor[1]});
      ctx.restore();
      const ticket=tickets.get(e);
      if(ticket && hitch) {
        const progress=time/(shot.frames/shot.fps), turn=swing((progress-.16)/.17)*(1-swing((progress-.69)/.15));
        if(turn>0) unfurlTicket(e,hitch,ticket,turn);
      }
      if(e.field && shot.family==='elephants') {
        const dust=bump((time-shot.frames/shot.fps+.57)/.54);
        if(dust) contactShadow(ctx,e.w*.40,e.h*(.94-.045*dust),e.w*.035*dust,e.h*.018*dust,.13*dust);
      }
    },
    shakeDry(e,t) {
      const asset=artwork.get(e), index=5, head=asset?.anchors?.[index]?.[0];
      if(!head) return null;
      const ctx=e.ctx, basis=ctx.getTransform(), [x,y,,brim]=head;
      const lift=swing(t/.17)*(1-swing((t-1.43)/.45)), shake=bump((t-.71)/.69);
      const width=e.w*(e.panelSide?.64:.28), height=e.h*(e.panelSide?.57:.35);
      const centre=e.w*(e.panelSide?.52:.21);
      ctx.save();ctx.translate(centre*2,0);ctx.scale(-1,1);
      fitShot(ctx,[65,140,211,206],width,height,centre,e.h*.97+(1-lift)*height);
      ctx.translate(x,y+brim);ctx.rotate(.095*shake*Math.sin((t-.71)*34));ctx.translate(-x,-y-brim);
      paint(e,index);
      const ear=basis.inverse().multiply(ctx.getTransform()).transformPoint({x:x-brim*.72,y:y-brim*.62});
      ctx.restore();return ear;
    }
  };
}
export const woodlandParts=Object.fromEntries(woodlandShots.map(shot=>[shot.id,woodlandPart(shot)]));
export function splashBunnies(e) {
  return highestWoodland('bunnies',e.has) ? woodlandParts.bunnies : null;
}
