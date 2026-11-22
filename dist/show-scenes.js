import {colours,gold,ink,tau,clamp01,ease,five,drawStar,paint,oval} from './show-kit.js';
import {oakScene} from './oak.js';
import {forms} from './drawings.js';

// The star that reveals her picture, and everything she can add to the sky and the ground.
// Each part has a length in seconds and a drawing order. A part that stays keeps drawing until the show ends.

// The star bounds in off one peg and lands on her picture.
const beats=[[0,-.30,-.27],[.3,.33,-.22],[.72,0,0]];
const peg=(e,j)=>e.field ? (j===2?{x:e.cx,y:e.cy}:{x:e.w*(j?.76:.13),y:e.h*(j?.31:.44)}) :
  {x:e.cx+beats[j][1]*e.w,y:Math.max(48,e.cy+beats[j][2]*e.h)};
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
    cues:[[.3,e=>{const p=peg(e,1);e.burst(p.x,p.y,few(e,9),72);}],[.72,e=>{e.burst(e.cx,e.cy,few(e,20),116);e.on('onHit');}]],
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
  stars:{len:2.6,poster:1.88,z:5,
    cues:[[0,.16,.35,19,76],[.42,.81,.30,22,93],[.91,.25,.25,19,70],[1.55,.84,.34,27,95]]
      .map(([t,x,y,n,power])=>[t,e=>e.burst(x*e.w,y*e.h,few(e,n),power,{g:.38})]),
    draw(e,s,t){
      const p=clamp01((t-1.55)/.75);
      if(p>0 && p<1) drawStar(e.ctx,e.w*.84,e.h*.34,Math.sin(p*Math.PI)*15*e.u,.15+p*.33,five,'#ffe189');
    }},
  fountains:{len:2.5,poster:1.35,z:5,
    step(e,s,t,dt) {
      if(t<.25 || t>1.9) return;
      s.next=(s.next || 0)-dt;
      if(s.next>0) return;
      s.next=.055;
      for(const side of [-1,1]) e.spark({x:e.w*(side<0?.12:.88),y:e.h*.87,vx:-side*(.06+e.rand()*.14)*e.w,vy:-(.96+e.rand()*.55)*e.h,
        size:(2.8+e.rand()*3)*e.u,kind:e.rand()<.3?'star4':'star5',life:1.1+e.rand()*.4,colour:e.rand()<.4?gold:colours[Math.floor(e.rand()*7)],g:e.h/(91*e.u),spin:e.rand()*6-3});
    }},
  // Ground
  oak:oakScene,

  // Her own finds
  // Fireflies rise and settle into the letters of her word, one letter after another, then drift away.
  fireflies:{len:4,poster:2.32,z:7,
    make(e) {
      const word=e.word || e.finds[0] || 'cat', pts=letterPoints(word), wide=word.length*88+8;
      let cx=e.w*.5,cy=e.h*.28,width=e.w*.81,height=e.h*.34;
      if(e.field) {
        const shoulder=e.field.left;
        if(word.length<=5 && shoulder>e.w*.22) {cx=shoulder*.52;cy=e.h*.35;width=shoulder*.85;height=e.h*.42;}
        else {cy=e.field.top*.50;height=e.field.top*.88;}
      }
      const k=Math.min(height/138,width/wide), left=cx-wide*k/2, top=cy-69*k;
      const stagger=Math.min(.3,.9/Math.max(1,word.length-1));
      return {radius:Math.min(4*e.u,k*5),flies:pts.map(p=>({tx:left+p.x*k,ty:top+p.y*k,sx:left+p.x*k+(e.rand()-.5)*120*e.u,go:p.letter*stagger+e.rand()*.18,phase:e.rand()*tau}))};
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=Math.min(e.u,s.radius/3), leave=clamp01((t-3.35)/.65);
      for(const f of s.flies) {
        const fly=ease((t-f.go)/.8);
        if(fly<=0) continue;
        const x=f.sx+(f.tx-f.sx)*fly+Math.sin(t*5+f.phase)*.8*u*(1+leave*6), y=e.h+20+(f.ty-e.h-20)*fly+Math.cos(t*4+f.phase)*.8*u-leave*leave*55*u;
        const glow=.75+.25*Math.sin(t*9+f.phase);
        ctx.globalAlpha=(1-leave)*.3;ctx.beginPath();ctx.arc(x,y,10*u*glow,0,tau);ctx.fillStyle=gold;ctx.fill();
        ctx.globalAlpha=1-leave;ctx.beginPath();ctx.arc(x,y,s.radius,0,tau);paint(ctx,'#fff3a6',1.3*u);
      }
      ctx.globalAlpha=1;
    }},
  notes:{len:2.3,poster:.98,z:6,
    draw(e,s,t) {
      for(let i=0;i<6;i++) {
        const a=clamp01((t-i*.18)/1.28);
        if(a<=0 || a>=1) continue;
        e.ctx.globalAlpha=Math.min(1,(1-a)*3);
        const x=e.field?e.w*(i%2?.82:.17):e.cx+(i-2.5)*54*e.u;
        note(e.ctx,x+Math.sin(a*4+i)*e.w*.04,e.h*(.78-a*.48),(9+i%3*2.8)*e.u,Math.sin(a*5+i)*.22,colours[(i*2)%7]);
      }
      e.ctx.globalAlpha=1;
    }}
};
export {SCENES};
