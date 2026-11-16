import {ink,water,tau,clamp01,bump,paint,oval} from './show-kit.js';

// The creatures she can add to her show. Each is a paper cut-out drawn from a few moving parts, facing right
// with its middle at the origin. Each asks for a hat where its head is, and gets one once she has added hats.
const fur='#f5ecd7', foam='#eef8f8';
const few=(e,n)=>Math.round(n*(e.w<650?.7:1));

function ear(ctx,x,y,angle,inner) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);oval(ctx,0,-17,5.5,18,0,fur,2);
  if(inner){ctx.beginPath();ctx.ellipse(0,-16,2.3,12,0,0,tau);ctx.fillStyle='#f1b8ae';ctx.fill();}
  ctx.restore();
}
// About 80 across. `air` is 0 on the ground and 1 at full stretch.
function bunny(ctx,air,e) {
  ear(ctx,18,-24,-.5-air*.45,false);
  oval(ctx,-15,19+air*3,15,5.5,-.15-air*.8,fur,2);
  oval(ctx,-2,2,30,20,-.1,fur,2);
  oval(ctx,-31,-3,7.5,7.5,0,'#fffdf5',2);
  oval(ctx,17,16+air*2,5,10,.5+air*.7,fur,2);
  oval(ctx,25,-13,14.5,12.5,0,fur,2);
  ear(ctx,24,-23,-.2-air*.45,true);
  ctx.beginPath();ctx.arc(31,-16,2,0,tau);ctx.fillStyle=ink;ctx.fill();
  ctx.beginPath();ctx.arc(39.5,-11,1.7,0,tau);ctx.fillStyle='#e58f86';ctx.fill();
  e.hat(23,-24,-.25,38);
}
function block(ctx,x,y,w,h,r) {
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);
}
function leg(ctx,x,y,angle,fill) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);block(ctx,-11,-6,22,54,9);paint(ctx,fill,2.6);ctx.restore();
}
// About 200 from tail to trunk. Its legs swing with `phase`. `toot` lifts the trunk to trumpet,
// and an elephant that `holds` reaches its trunk forward for the tail in front.
function elephant(ctx,phase,toot,holds,e) {
  const skin='#b9c4c9', shade='#9eabb2', swing=Math.sin(phase)*.4;
  leg(ctx,-34,22,-swing,shade);leg(ctx,36,22,swing,shade);
  ctx.beginPath();ctx.moveTo(-62,-12);ctx.quadraticCurveTo(-82,-4+Math.sin(phase*2)*5,-80,18);ctx.strokeStyle=ink;ctx.lineWidth=3.2;ctx.stroke();
  oval(ctx,-80,22,3.4,6,0,ink,1);
  oval(ctx,0,0,66,45,0,skin,2.6);
  leg(ctx,-46,24,swing,skin);leg(ctx,24,24,-swing,skin);
  const rest=holds?[[108,2],[126,8],[148,-4]]:[[104,8],[98,38],[112,46]], up=[[112,-22],[96,-58],[120,-76]];
  const [c1,c2,tip]=rest.map((p,i)=>[p[0]+(up[i][0]-p[0])*toot,p[1]+(up[i][1]-p[1])*toot]);
  ctx.beginPath();ctx.moveTo(86,-8);ctx.bezierCurveTo(c1[0],c1[1],c2[0],c2[1],tip[0],tip[1]);
  ctx.strokeStyle=ink;ctx.lineWidth=20;ctx.stroke();ctx.strokeStyle=skin;ctx.lineWidth=15;ctx.stroke();
  ctx.beginPath();ctx.arc(60,-16,33,0,tau);paint(ctx,skin,2.6);
  ctx.beginPath();ctx.moveTo(80,4);ctx.quadraticCurveTo(92,12,101,2);ctx.strokeStyle=ink;ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='#fffdf5';ctx.lineWidth=4.6;ctx.stroke();
  ctx.save();ctx.translate(56,-18);ctx.scale(1-.28*Math.abs(Math.sin(phase*.5))-toot*.2,1);
  oval(ctx,-12,2,22,28,.15,skin,2.6);
  ctx.beginPath();ctx.ellipse(-12,3,13,19,.15,0,tau);ctx.fillStyle='#e6c6be';ctx.fill();ctx.restore();
  ctx.beginPath();ctx.arc(76,-24,3,0,tau);ctx.fillStyle=ink;ctx.fill();
  if(toot>.6) {
    ctx.strokeStyle=ink;ctx.lineWidth=2.8;
    for(const r of [13,22,31]){ctx.beginPath();ctx.arc(tip[0],tip[1],r*(.6+toot*.5),-1.9,-.5);ctx.stroke();}
  }
  e.hat(58,-46,-.05,50);
}
// Water thrown up from the bottom of the screen. `reach` is how far up the screen the highest drops get.
function spray(e,x,width,n,reach) {
  const top=Math.sqrt(2000*e.u*reach*e.h);
  for(let i=0;i<n;i++) e.spark({x:x+(e.rand()-.5)*width,y:e.h+4,vx:(e.rand()-.5)*300*e.u,vy:-(.35+e.rand()*.65)*top,kind:'drop',
    size:(3+e.rand()*5)*e.u,colour:e.rand()<.3?foam:water,life:1.3+e.rand()*.9,g:5,drag:.2,spin:0});
}
const whalePlace=e=>e.w*(e.w>e.h?.68:.5);

const CREATURES={
  // Three bunnies pop up from below, one after another, and hop across.
  bunnies:{len:2.1,z:6,
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u*1.25;
      [.16,.44,.72].forEach((at,i)=>{
        const p=(t-i*.28)/1.3;
        if(p<=0 || p>=1) return;
        const air=Math.sin(p*Math.PI);
        ctx.save();ctx.translate(at*e.w+p*e.w*.14,e.h+34*u-air*(e.h*.3+34*u));ctx.rotate(-.6*Math.cos(p*Math.PI));ctx.scale(u,u);
        bunny(ctx,air,e);ctx.restore();
      });
    }},
  // The orca's splash soaks the whole show. Rain falls, the flowers shoot up and the bunnies shake themselves dry.
  splash:{len:1.9,z:6,
    cues:[[0,e=>{e.soak=e.time;spray(e,e.w/2,e.w,few(e,70),.95);}]],
    step(e,s,t,dt) {
      if(t<.2 || t>1.25) return;
      s.next=(s.next || 0)-dt;
      while(s.next<=0) {
        s.next+=.017;
        e.spark({x:e.rand()*e.w,y:-8,vx:-30*e.u,vy:(520+e.rand()*300)*e.u,kind:'drop',size:(2.5+e.rand()*3)*e.u,colour:water,life:1.5,g:1.5,drag:0,spin:0});
      }
    },
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u, place=whalePlace(e), p=clamp01(t/1.3);
      for(const side of [-1,1]) {
        const x=place+side*e.w*.62*p, tall=54*u*(1-p)*clamp01(t/.1);
        ctx.beginPath();ctx.moveTo(x-56*u,e.h+4);ctx.quadraticCurveTo(x+side*14*u,e.h-tall*2,x+56*u,e.h+4);ctx.closePath();paint(ctx,foam,2.2*u);
      }
      if(e.has('bunnies')) [.14,.4,.9].forEach((at,i)=>{
        const up=bump((t-.45-i*.12)/1.2);
        if(up<=0) return;
        ctx.save();ctx.translate(at*e.w,e.h+36*u-up*52*u);ctx.rotate(Math.sin(t*40+i)*.16*up);ctx.scale(u*1.3,u*1.3);bunny(ctx,0,e);ctx.restore();
      });
    }},
  // Four elephants march across trunk to tail, the baby last, and trumpet one after another.
  elephants:{len:3.4,z:6,
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u*1.12, sizes=[1,.92,.84,.56];
      let x=-130*u+(e.w+820*u)*t/3.4;
      sizes.forEach((size,j)=>{
        if(j) x-=(148*size+78*sizes[j-1])*u;
        if(x<-150*u || x>e.w+150*u) return;
        const phase=t*9.5+j*1.1, toot=Math.max(...[.6,1.3,2].map(beat=>bump((t-beat-j*.13)/.42)));
        ctx.save();ctx.translate(x,e.h-72*size*u-Math.abs(Math.sin(phase))*3.5*u);ctx.scale(u*size,u*size);
        elephant(ctx,phase,toot,j>0,e);ctx.restore();
      });
    }},

};
export {CREATURES};
