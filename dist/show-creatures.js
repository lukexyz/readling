import {water,clamp01,paint} from './show-kit.js';
import {splashBunnies} from './show-woodland.js';

const foam='#eef8f8';
const few=(e,n)=>Math.round(n*(e.w<650?.7:1));
// Water thrown up from the bottom of the screen. `reach` is how far up the screen the highest drops get.
function spray(e,x,width,n,reach) {
  const top=Math.sqrt(2000*e.u*reach*e.h);
  for(let i=0;i<n;i++) e.spark({x:x+(e.rand()-.5)*width,y:e.h+4,vx:(e.rand()-.5)*300*e.u,vy:-(.35+e.rand()*.65)*top,kind:'drop',
    size:(3+e.rand()*5)*e.u,colour:e.rand()<.3?foam:water,life:1.3+e.rand()*.9,g:5,drag:.2,spin:0});
}
const whalePlace=e=>e.w*(e.w>e.h?.68:.5);

const CREATURES={
  // The orca's splash soaks the whole show. Rain falls, the flowers shoot up and the bunnies shake themselves dry.
  splash:{len:1.9,poster:.77,z:6,
    prepare(e) { return splashBunnies(e)?.prepare(e.rabbitView || e); },
    cues:[[0,e=>{e.soak=e.time;spray(e,e.w*.53,e.w*.36,few(e,28),.56);}]],
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
      const ear=splashBunnies(e)?.shakeDry(e.rabbitView || e,t);
      if(ear && t<.85) {
        const crossing=e.crossing, view=crossing?.view || e, pen=view.ctx;
        const from=crossing?.from ?? e.w*.70, start=crossing?.y ?? e.h*.90;
        const to=crossing?crossing.destX+ear.x*crossing.scaleX:ear.x, land=crossing?crossing.destY+ear.y*crossing.scaleY:ear.y;
        const impact=.57, flight=clamp01(t/impact), radius=3.9*view.u;
        const x=from+(to-from)*flight;
        let y=start+(land-start)*flight-Math.sin(flight*Math.PI)*view.h*.19;
        if(crossing) {
          const margin=radius*1.6, field=view.field, clearance=field.bottom+margin;
          const approach=Math.max(margin*2,view.w*.075);
          // Skim the foreground while crossing paper, then curve up to the ear on its bank.
          const left=clamp01((x-field.left+margin+approach)/approach);
          const right=clamp01((field.right+margin+approach-x)/approach);
          const cover=Math.min(left,right);
          y+=(Math.max(y,clearance)-y)*cover*cover*(3-2*cover);
        }
        pen.save();
        if(t<=impact) {
          pen.beginPath();pen.ellipse(x,y,radius*.8,radius*1.18,flight*.9-.45,0,Math.PI*2);paint(pen,'#ade4e8',view.u);
          pen.beginPath();pen.arc(x-radius*.2,y-radius*.4,radius*.25,0,Math.PI*2);pen.fillStyle='white';pen.fill();
        } else {
          const spread=(t-impact)/(.85-impact);
          pen.globalAlpha=1-spread;pen.strokeStyle=foam;pen.lineWidth=1.8*view.u;pen.beginPath();
          pen.arc(to,land,radius*(.64+spread*1.9),0,Math.PI*2);pen.stroke();
        }
        pen.restore();
      }
    }}
};
export {CREATURES};
