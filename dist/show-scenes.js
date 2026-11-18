import {colours,gold,ink,tau,clamp01,ease,five,drawStar,paint,oval} from './show-kit.js';
import {oakScene} from './oak.js';
import {forms} from './drawings.js';

// The star that reveals her picture, and everything she can add to the sky and the ground.
// Each part has a length in seconds and a drawing order. A part that stays keeps drawing until the show ends.

// The star bounds in off one peg and lands on her picture.
const beats=[[0,-.30,-.27],[.3,.33,-.22],[.72,0,0]];
const peg=(e,j)=>({x:e.cx+beats[j][1]*e.w,y:Math.max(48,e.cy+beats[j][2]*e.h)});
function ballAt(e,t) {
  let j=1;while(j<beats.length-1 && beats[j][0]<t)j++;
  const a=peg(e,j-1), b=peg(e,j), p=clamp01((t-beats[j-1][0])/(beats[j][0]-beats[j-1][0]));
  return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p-Math.sin(p*Math.PI)*Math.min(105,e.h*.12)};
}
const few=(e,n)=>Math.round(n*(e.w<650?.7:1));
// Points along the school-print strokes of each letter of a word, in a box 138 tall with 88 for each letter.
function letterPoints(word) {
  const out=[];
  try {
    [...word].forEach((c,i)=>{
      for(const d of forms[c] || []) {
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        const length=path.getTotalLength();
        for(let at=0;at<=length;at+=8){const p=path.getPointAtLength(at);out.push({x:p.x+i*88,y:p.y,letter:i});}
      }
    });
  } catch { /* Without the letter shapes the fireflies simply drift. */ }
  return out;
}
function note(ctx,x,y,size,tilt,colour) {
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);
  ctx.beginPath();ctx.moveTo(size*.42,0);ctx.lineTo(size*.42,-size*2.1);ctx.quadraticCurveTo(size*1.3,-size*1.9,size*1.25,-size*1.05);
  ctx.strokeStyle=ink;ctx.lineWidth=size*.34;ctx.stroke();
  oval(ctx,0,0,size*.6,size*.44,-.35,colour,size*.16);ctx.restore();
}

const SCENES={
  comet:{len:.74,z:8,
    cues:[[.3,e=>{const p=peg(e,1);e.burst(p.x,p.y,few(e,12),190);}],[.72,e=>{e.burst(e.cx,e.cy,few(e,46),400);e.on('onHit');}]],
    draw(e,s,t) {
      if(t>.72) return;
      const ctx=e.ctx, u=e.u, p1=peg(e,1), d=t-.3;
      if(d<=.35){ctx.globalAlpha=d<0?.85:Math.max(0,1-d/.35);drawStar(ctx,p1.x,p1.y,(d<=0?14:18+26*d)*u,.3,five,'#ffdb63');ctx.globalAlpha=1;}
      for(let j=0;j<colours.length;j++) {
        ctx.beginPath();
        for(let k=0;k<=18;k++){const p=ballAt(e,Math.max(0,t-.16+.16*k/18)), y=p.y+(j-3)*3.3*u;if(k===0)ctx.moveTo(p.x,y);else ctx.lineTo(p.x,y);}
        ctx.strokeStyle=colours[j];ctx.lineWidth=4.3*u;ctx.stroke();
      }
      const p=ballAt(e,t);drawStar(ctx,p.x,p.y,22*u,t*4,five,'#ffd752');
    }},

  // Sky
  stars:{len:2.5,z:5,
    cues:[[0,.18,.34,42,290],[.35,.84,.23,45,320],[.8,.30,.18,48,310],[1.1,.73,.24,45,310],[1.6,.5,.16,80,450]]
      .map(([t,x,y,n,power])=>[t,e=>e.burst(x*e.w,y*e.h,few(e,n),power)])},
  fountains:{len:2.5,z:5,
    cues:[[0,.04,60,525],[.2,.96,60,525],[1.0,.08,55,560],[1.15,.92,55,560]].map(([t,x,n,power])=>[t,e=>e.burst(x*e.w,e.h*.88,few(e,n),power,{sky:true})]),
    step(e,s,t,dt) {
      if(t<.25 || t>1.9) return;
      s.next=(s.next || 0)-dt;
      if(s.next>0) return;
      s.next=.055;
      const reach=Math.sqrt(e.h/800);
      for(const side of [-1,1]) e.spark({x:side<0?e.w*.03:e.w*.97,y:e.h+6,vx:-side*(110+e.rand()*210)*e.u,vy:-(640+e.rand()*250)*e.u*reach,
        size:(4+e.rand()*6)*e.u,kind:e.rand()<.3?'star4':'star5',life:1.5+e.rand()*.6,colour:e.rand()<.4?gold:colours[Math.floor(e.rand()*7)],g:3.2,spin:e.rand()*6-3});
    }},
  // Ground
  oak:oakScene,

  // Her own finds
  // Fireflies rise and settle into the letters of her word, one letter after another, then drift away.
  fireflies:{len:2.6,z:7,
    make(e) {
      const word=e.word || e.finds[0] || 'cat', pts=letterPoints(word), wide=word.length*88+8;
      const k=Math.min(e.h*.3/138,e.w*.84/wide), left=e.w/2-wide*k/2, top=Math.max(8,Math.min(e.th.y-138*k-6,e.h*.2));
      const stagger=Math.min(.3,.9/Math.max(1,word.length-1));
      return {flies:pts.map(p=>({tx:left+p.x*k,ty:top+p.y*k,sx:left+p.x*k+(e.rand()-.5)*220*e.u,go:p.letter*stagger+e.rand()*.25,phase:e.rand()*tau}))};
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, leave=clamp01((t-2)/.6);
      for(const f of s.flies) {
        const fly=ease((t-f.go)/.8);
        if(fly<=0) continue;
        const x=f.sx+(f.tx-f.sx)*fly+Math.sin(t*5+f.phase)*2.5*u*(1+leave*6), y=e.h+20+(f.ty-e.h-20)*fly+Math.cos(t*4+f.phase)*2.5*u-leave*leave*90*u;
        const glow=.75+.25*Math.sin(t*9+f.phase);
        ctx.globalAlpha=(1-leave)*.3;ctx.beginPath();ctx.arc(x,y,10*u*glow,0,tau);ctx.fillStyle=gold;ctx.fill();
        ctx.globalAlpha=1-leave;ctx.beginPath();ctx.arc(x,y,3.9*u,0,tau);paint(ctx,'#fff3a6',1.2*u);
      }
      ctx.globalAlpha=1;
    }},
  // Notes float up, to show music in the choices. The music itself is the fanfare.
  notes:{len:2.3,z:6,
    draw(e,s,t) {
      for(let i=0;i<6;i++) {
        const a=clamp01((t-(i*5%6)*.13)/1.5);
        if(a<=0 || a>=1) continue;
        e.ctx.globalAlpha=Math.min(1,(1-a)*3);
        note(e.ctx,e.cx+(i-2.5)*84*e.u+Math.sin(a*6+i)*16*e.u,e.cy+e.h*.3-a*e.h*.56,(24+i%3*6)*e.u,Math.sin(a*5+i)*.3,colours[(i*2)%7]);
      }
      e.ctx.globalAlpha=1;
    }}
};
export {SCENES};
