import {ink,water,tau,clamp01,ease,easeIn,bump,paint,oval} from './show-kit.js';

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
// About 190 from beak to tail.
function dolphin(ctx,e) {
  const skin='#7fb9cb';
  ctx.beginPath();ctx.moveTo(-64,5);ctx.quadraticCurveTo(-88,-22,-104,-20);ctx.quadraticCurveTo(-93,-2,-100,22);ctx.quadraticCurveTo(-82,17,-64,5);ctx.closePath();paint(ctx,skin,2.2);
  ctx.beginPath();ctx.moveTo(-6,-25);ctx.quadraticCurveTo(-14,-52,-34,-50);ctx.quadraticCurveTo(-24,-38,-27,-21);ctx.closePath();paint(ctx,skin,2.2);
  ctx.beginPath();ctx.moveTo(-70,6);ctx.bezierCurveTo(-40,-22,10,-34,52,-14);ctx.quadraticCurveTo(70,-6,86,-3);ctx.quadraticCurveTo(70,3,60,7);ctx.bezierCurveTo(30,24,-30,18,-70,6);ctx.closePath();paint(ctx,skin,2.4);
  ctx.beginPath();ctx.moveTo(62,6);ctx.bezierCurveTo(30,23,-28,17,-62,6);ctx.bezierCurveTo(-28,10,26,12,62,6);ctx.closePath();ctx.fillStyle='#eaf5f1';ctx.fill();
  ctx.beginPath();ctx.moveTo(22,8);ctx.quadraticCurveTo(14,32,-4,36);ctx.quadraticCurveTo(8,20,6,10);ctx.closePath();paint(ctx,skin,2.2);
  ctx.beginPath();ctx.arc(54,-8,2.3,0,tau);ctx.fillStyle=ink;ctx.fill();
  ctx.beginPath();ctx.moveTo(84,-2);ctx.quadraticCurveTo(72,1,63,-1);ctx.strokeStyle=ink;ctx.lineWidth=1.6;ctx.stroke();
  e.hat(46,-17,-.1,42);
}
// About 570 from snout to tail.
function whale(ctx,e) {
  const skin='#5f8ea6';
  ctx.beginPath();ctx.moveTo(-224,-4);ctx.bezierCurveTo(-260,-58,-300,-66,-322,-52);ctx.bezierCurveTo(-300,-34,-292,-12,-284,0);
  ctx.bezierCurveTo(-292,16,-298,40,-318,58);ctx.bezierCurveTo(-296,68,-258,54,-224,8);ctx.closePath();paint(ctx,skin,3.4);
  ctx.beginPath();ctx.moveTo(250,-10);ctx.bezierCurveTo(240,-70,150,-105,40,-95);ctx.bezierCurveTo(-80,-85,-170,-50,-230,-12);ctx.lineTo(-236,10);
  ctx.bezierCurveTo(-170,40,-60,95,60,95);ctx.bezierCurveTo(170,95,245,50,250,-10);ctx.closePath();paint(ctx,skin,3.6);
  ctx.beginPath();ctx.moveTo(247,6);ctx.bezierCurveTo(200,42,80,62,-40,54);ctx.bezierCurveTo(-120,48,-190,26,-232,9);
  ctx.bezierCurveTo(-170,40,-60,93,60,93);ctx.bezierCurveTo(168,93,240,52,247,6);ctx.closePath();ctx.fillStyle='#eaf2ec';ctx.fill();
  ctx.strokeStyle='#9fb9c0';ctx.lineWidth=2.4;
  for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(226-i*15,28+i*9);ctx.quadraticCurveTo(120-i*10,60+i*7,8-i*12,64+i*5);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(92,58);ctx.bezierCurveTo(62,108,22,148,-40,158);ctx.bezierCurveTo(-8,118,22,90,42,54);ctx.closePath();paint(ctx,skin,3.4);
  ctx.beginPath();ctx.moveTo(249,-4);ctx.bezierCurveTo(222,12,184,10,150,-6);ctx.strokeStyle=ink;ctx.lineWidth=3;ctx.stroke();
  oval(ctx,170,-28,9,9,0,'#fff',2.6);
  ctx.beginPath();ctx.arc(172,-27,4.4,0,tau);ctx.fillStyle=ink;ctx.fill();
  e.hat(118,-96,.08,150);
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
const leaps=[[.2,.62,0],[.8,.38,.32]];

const SNAIL=`<svg viewBox="0 -26 124 106"><g stroke="#354435" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
  <path d="M7 71Q3 62 14 60L72 60Q86 60 91 46Q95 35 104 36Q113 38 110 49Q107 63 96 68Q89 72 80 72L14 72Q8 72 7 71Z" fill="#ecdcae"/>
  <path d="M101 37L104 21M107 39L115 26" fill="none"/><circle cx="104" cy="19" r="3" fill="#354435"/><circle cx="116" cy="24" r="3" fill="#354435"/>
  <path d="M100 52Q104 56 108 52" fill="none" stroke-width="2"/>
  <circle cx="48" cy="40" r="27" fill="#e39a62"/>
  <path d="M49 42a6 6 0 1 1-7-5a12 12 0 1 1 14 15a19 19 0 1 1-25-24" fill="none"/>
  <path d="M56 15L56-22" fill="none"/><path d="M56-22L80-14L56-6Z" fill="#ff635d"/>
</g></svg>`;
let snailPicture=null;

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
  // Two dolphins leap from the bottom of the screen and cross over each other.
  dolphins:{len:2.2,z:6,
    cues:leaps.flatMap(([from,to,wait])=>[[wait+.06,e=>spray(e,from*e.w,70*e.u,few(e,12),.2)],[wait+1.42,e=>spray(e,to*e.w,90*e.u,few(e,18),.28)]]).sort((a,b)=>a[0]-b[0]),
    draw(e,s,t) {
      const ctx=e.ctx, u=e.u*1.2;
      for(const [from,to,wait] of leaps) {
        const p=(t-wait)/1.5;
        if(p<=0 || p>=1) continue;
        const at=q=>({x:(from+(to-from)*q)*e.w,y:e.h+46*u-Math.sin(q*Math.PI)*(e.h*.42+46*u)}), a=at(p), b=at(p+.01);
        ctx.save();ctx.translate(a.x,a.y);ctx.scale(to>from?1:-1,1);ctx.rotate(Math.atan2(b.y-a.y,Math.abs(b.x-a.x)));ctx.scale(u,u);
        dolphin(ctx,e);ctx.restore();
      }
    }},
  // A whale breaches, hangs for a moment and crashes back, throwing water to the top of the screen.
  whale:{len:3.2,z:4,
    cues:[[.84,e=>spray(e,whalePlace(e),40*e.u,few(e,14),.5)],[1.8,e=>{spray(e,whalePlace(e)+e.w*.03,e.w*.5,few(e,90),.88);e.ring(whalePlace(e),e.h,e.w*.3);}]],
    draw(e,s,t) {
      const ctx=e.ctx, long=Math.min(e.h*.78,e.w*.56), place=whalePlace(e);
      let x=place, y, angle;
      if(t<.8){const g=ease(t/.8);y=e.h+long*.62-long*.76*g;angle=-1.48+.26*g;}
      else if(t<1.25){const g=(t-.8)/.45;y=e.h-long*.14-Math.sin(g*Math.PI)*long*.03;angle=-1.22+.5*g;}
      else {const g=easeIn((t-1.25)/.6);y=e.h-long*.14+long*.78*g;angle=-.72+.55*g;x=place+e.w*.05*g;}
      if(t<1.9){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(long/570,long/570);whale(ctx,e);ctx.restore();}
      const f=t-1.8;
      if(f>0 && f<1.3) {
        const wide=e.w*.34*ease(f/.45), tall=66*e.u*bump(f/1.3), lumps=7;
        ctx.beginPath();ctx.moveTo(place-wide,e.h+4);
        for(let i=0;i<lumps;i++) {
          const x0=place-wide+2*wide*i/lumps, x1=place-wide+2*wide*(i+1)/lumps;
          ctx.quadraticCurveTo((x0+x1)/2,e.h-tall*(.5+.9*Math.sin((i+.5)/lumps*Math.PI)),x1,i===lumps-1?e.h+4:e.h-tall*.3*Math.sin((i+1)/lumps*Math.PI));
        }
        ctx.closePath();paint(ctx,foam,2.4*e.u);
      }
    }},
  // The whale's splash soaks the whole show. Rain falls, the flowers shoot up and the bunnies shake themselves dry.
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
  // The snail in a small preview. In the show it crosses the page itself, after everything else has finished.
  snail:{len:4,z:6,
    draw(e,s,t) {
      if(!snailPicture){snailPicture=new Image();snailPicture.src='data:image/svg+xml,'+encodeURIComponent(SNAIL.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="248" height="212" '));}
      if(!snailPicture.complete || !snailPicture.naturalWidth) return;
      const wide=170*e.u;
      e.ctx.save();e.ctx.translate(e.w*.1+e.w*.5*t/4,e.h-wide*.86);e.ctx.scale(1+.05*Math.sin(t*6),1);
      e.ctx.drawImage(snailPicture,0,0,wide,wide*106/124);e.ctx.restore();
    }}
};
export {CREATURES,SNAIL};
