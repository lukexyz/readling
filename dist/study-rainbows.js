// These canvas studies have a transparent sky. The gallery draws the hills and
// word card afterwards, exactly where the effect would sit in a celebration.
window.ReadlingRainbowStudies=(()=>{
  'use strict';
  const PI=Math.PI, tau=2*PI;
  const clamp=t=>Math.max(0,Math.min(1,t));
  const fade=(a,b,t)=>{const u=clamp((t-a)/(b-a));return u*u*(3-2*u);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const stops=[[236,62,95],[255,135,43],[249,200,51],[120,197,56],[22,188,150],[46,150,227],[97,98,213],[180,86,206]];
  function colour(t,light=0,alpha=1) {
    const n=clamp(t)*(stops.length-1), i=Math.min(stops.length-2,Math.floor(n));
    const rgb=stops[i].map((c,k)=>mix(mix(c,stops[i+1][k],n-i),light<0?0:255,Math.abs(light)));
    return 'rgba('+rgb.map(Math.round).join(',')+','+alpha+')';
  }
  function seeds(count,seed) {
    let s=seed;
    function rand(){s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;}
    return Array.from({length:count},(_,i)=>({i,a:rand(),b:rand(),c:rand(),d:rand(),p:rand()*tau}));
  }
  const rain=seeds(44,1392), glass=seeds(24,542), flock=seeds(26,5167);
  function arch(u,thickness=0) {
    return {x:410-(354+thickness)*Math.cos(PI*u),y:268-(239+thickness)*Math.sin(PI*u)};
  }
  function sparkle(ctx,x,y,r,ink) {
    ctx.fillStyle=ink;ctx.beginPath();ctx.moveTo(x,y-r);
    ctx.quadraticCurveTo(x+.15*r,y-.15*r,x+.72*r,y);
    ctx.quadraticCurveTo(x+.15*r,y+.15*r,x,y+r);
    ctx.quadraticCurveTo(x-.15*r,y+.15*r,x-.72*r,y);
    ctx.quadraticCurveTo(x-.15*r,y-.15*r,x,y-r);ctx.fill();
  }
  function polygon(ctx,points,fill,edge='') {
    ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
    for(const p of points.slice(1)) ctx.lineTo(p.x,p.y);
    ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    if(edge){ctx.strokeStyle=edge;ctx.lineWidth=.8;ctx.stroke();}
  }
  function sunshower(ctx,time) {
    const reveal=fade(.13,2.22,time);
    if(reveal>0) {
      ctx.save();ctx.translate(410,270);ctx.scale(356,239);
      ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,1.19,PI,PI+PI*reveal);ctx.closePath();ctx.clip();
      const light=ctx.createRadialGradient(0,0,.712,0,0,1.108);
      for(const [at,c] of [
        [0,'rgba(137,118,248,0)'],[.11,'rgba(173,99,237,.10)'],[.18,'rgba(163,84,217,.67)'],
        [.27,'rgba(111,105,222,.94)'],[.35,'rgba(67,157,232,.96)'],[.43,'rgba(29,203,197,.96)'],
        [.52,'rgba(90,211,113,.98)'],[.60,'rgba(210,229,75,.98)'],[.67,'rgba(255,220,72,.99)'],
        [.75,'rgba(255,165,61,.97)'],[.83,'rgba(249,97,85,.96)'],[.89,'rgba(243,99,137,.71)'],
        [.95,'rgba(255,158,185,.29)'],[1,'rgba(255,197,190,0)']
      ]) light.addColorStop(at,c);
      ctx.fillStyle=light;ctx.fillRect(-1.15,-1.15,2.3,1.16);
      ctx.restore();
      if(reveal<.998) {
        const tip=arch(reveal,-5), glow=ctx.createRadialGradient(tip.x,tip.y,2,tip.x,tip.y,38);
        glow.addColorStop(0,'rgba(255,252,205,.88)');glow.addColorStop(1,'rgba(255,239,174,0)');
        ctx.fillStyle=glow;ctx.fillRect(tip.x-38,tip.y-38,76,76);
      }
    }
    for(const d of rain) {
      const u=(d.i+d.a*.62)/rain.length;
      if(u>reveal+.06) continue;
      const bead=arch(u,(d.b-.52)*76);
      const drift=time*12+d.p;
      const x=bead.x+Math.sin(drift*.11+d.p)*2, y=bead.y+(d.c-.5)*15+3*Math.sin(drift*.18);
      const r=(1.1+d.a*2.55)*(d.i%7===0?1.85:1), a=fade(u-.02,u+.12,reveal)*(.46+.38*d.d);
      ctx.save();ctx.translate(x,y);ctx.rotate(.22);ctx.globalAlpha=a;
      ctx.beginPath();ctx.moveTo(0,-r*1.9);ctx.bezierCurveTo(r*1.55,-.1*r,r,r,0,r*1.1);
      ctx.bezierCurveTo(-1.35*r,r,-r,-.24*r,0,-r*1.9);
      ctx.fillStyle=colour(.46+d.d*.29,.22,.87);ctx.fill();
      ctx.fillStyle='#fffce2';ctx.beginPath();ctx.ellipse(-.22*r,-.16*r,.26*r,.44*r,0,0,tau);ctx.fill();
      ctx.restore();
      if(d.i%8===3) sparkle(ctx,x-2,y-4,(3.6+3.2*Math.sin(time*2+d.p)**2)*a,'#fffcea');
    }
  }
  function prism(ctx,time) {
    for(const tile of glass) {
      const u=(tile.i+.5)/glass.length, weight=1-2*Math.abs(u-.5);
      const progress=fade(.03+.70*weight+tile.c*.24,1.30+weight*.96+tile.c*.36,time);
      if(!progress) continue;
      const gap=.006+tile.c*.004, u0=(tile.i+.02)/glass.length+gap/2,u1=(tile.i+.98)/glass.length-gap/2;
      const left=5+10*tile.a, right=6+13*tile.b, width=13+14*tile.d;
      const corners=[arch(u0,left),arch(u1,right),arch(u1,-width+5*tile.a),arch(u0,-width-2*tile.b)];
      const crown=arch(mix(u0,u1,.20+.52*tile.b),18+16*tile.a+(tile.i%4===1?10:0));
      const centre=arch(u+.003*(tile.d-.5),-2+tile.c*8);
      const lift=1-progress, rock=(tile.d-.5)*1.55*lift;
      ctx.save();ctx.translate(centre.x+(u-.5)*60*lift,centre.y+lift*(145+tile.a*75)-7*Math.sin(PI*progress));
      ctx.rotate(rock);ctx.scale(.45+.55*progress,.3+.7*progress);ctx.translate(-centre.x,-centre.y);
      ctx.globalAlpha=clamp(progress*2.6);
      const t=clamp((u-.13)/.72), sheen=Math.max(0,1-Math.abs((time-1.0)*.42-u)/.13);
      polygon(ctx,[corners[0],crown,centre],colour(t,.48+sheen*.34),'rgba(255,255,232,.72)');
      polygon(ctx,[crown,corners[1],centre],colour(t+.02,.13+sheen*.43));
      polygon(ctx,[corners[1],corners[2],centre],colour(t+.034,-.17+sheen*.17));
      polygon(ctx,[corners[2],corners[3],centre],colour(t+.019,.03+tile.a*.13));
      polygon(ctx,[corners[3],corners[0],centre],colour(t-.025,.16+sheen*.4));
      ctx.strokeStyle=colour(t,-.24,.53);ctx.lineWidth=1.2;ctx.beginPath();
      ctx.moveTo(corners[3].x,corners[3].y);ctx.lineTo(corners[2].x,corners[2].y);ctx.stroke();
      if(tile.i%3===1) {
        const p=arch(u+(tile.a-.5)*.024,-width-10-12*tile.c);
        const r=2.1+tile.b*2.7;
        polygon(ctx,[{x:p.x-r,y:p.y},{x:p.x,y:p.y-1.6*r},{x:p.x+r,y:p.y},{x:p.x,y:p.y+r}],colour(t,.06,.85));
      }
      if(tile.i%5===1) sparkle(ctx,crown.x,crown.y,4+3*sheen,'#fff9ce');
      ctx.restore();
    }
  }
  function butterfly(ctx,x,y,size,tilt,hue,wing,variant) {
    ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(size,size);
    for(const side of [-1,1]) {
      ctx.save();ctx.scale(side*(.52+.48*wing),1);
      const light=ctx.createLinearGradient(0,0,11,-8);
      light.addColorStop(0,colour(hue,-.25));light.addColorStop(.35,colour(hue,.025));
      light.addColorStop(.78,colour(hue-.025,.15));light.addColorStop(1,colour(hue,-.12));
      ctx.fillStyle=light;ctx.strokeStyle=colour(hue,-.36,.87);ctx.lineWidth=.7;
      ctx.beginPath();ctx.moveTo(.1,1);ctx.bezierCurveTo(1,-2,6,-10.3,12,-10.9);
      ctx.bezierCurveTo(15.1,-8.6,12.5,-.3,6.4,2.1);ctx.bezierCurveTo(10.4,3.1,9.5,7.4,7.1,8);
      if(variant) ctx.quadraticCurveTo(7.2,11.3,5.1,12);
      ctx.bezierCurveTo(5.8,8,2.5,9.3,.1,1);ctx.fill();ctx.stroke();
      ctx.strokeStyle=colour(hue,-.31,.65);ctx.lineWidth=.53;
      ctx.beginPath();ctx.moveTo(.7,1);ctx.quadraticCurveTo(5,-2.4,10.9,-8.9);ctx.moveTo(1.1,1.8);ctx.lineTo(6.8,5.8);ctx.stroke();
      ctx.fillStyle='#fff3ba';
      for(const [dx,dy,r] of [[10.2,-7,.91],[10.8,-4.8,.69],[6.5,5,.78]]) {
        ctx.beginPath();ctx.ellipse(dx,dy,r*.8,r,0,0,tau);ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle='#514839';ctx.beginPath();ctx.ellipse(0,.8,.85,4.1,0,0,tau);ctx.fill();
    ctx.strokeStyle='#5b513a';ctx.lineWidth=.56;ctx.beginPath();ctx.moveTo(0,-2.4);
    ctx.quadraticCurveTo(-.3,-5,-2.1,-5.5);ctx.moveTo(0,-2.4);ctx.quadraticCurveTo(.4,-5.4,2.4,-5.6);ctx.stroke();ctx.restore();
  }
  function butterflies(ctx,time) {
    for(const f of flock) {
      const u=(f.i+.14+.71*f.c)/flock.length, distance=1-Math.abs(u*2-1);
      const flight=fade(.04+distance*.71+f.c*.15,1.58+distance*.88+f.c*.45,time);
      if(flight<=0) continue;
      const left=u<.5,spread=f.i%3===1?-16:12;
      const goal=arch(u,spread+(f.a-.5)*17);
      const x=mix(left?65+f.b*148:755-f.b*148,goal.x,flight)+Math.sin(flight*tau*.88+f.p)*17*Math.sin(PI*flight)+2.4*Math.sin(time*1.8+f.p);
      const y=mix(259+f.a*12,goal.y,flight)-26*Math.sin(PI*flight)+4.2*Math.sin(time*2.1+f.p);
      const tilt=(left?.55:-.55)*(1-flight)+(.5-u)*.84+.30*Math.sin(f.p+time*1.35);
      const hue=clamp((u-.13)/.72+(f.a-.5)*.045);
      const lead=[5,11,17,21].includes(f.i),size=(.72+.62*f.b)*(lead?1.58:1);
      if(f.i%4===2) {
        ctx.save();ctx.strokeStyle=colour(hue,.04,.47);ctx.lineWidth=1.2;ctx.setLineDash([1.6,4]);
        const dx=(left?-1:1)*17;ctx.beginPath();ctx.moveTo(x-.8*dx,y+6);
        ctx.bezierCurveTo(x-dx,y+21,x+dx,y+7,x+1.8*dx,y+22);ctx.stroke();ctx.restore();
      }
      butterfly(ctx,x,y,size*fade(0,.28,flight),tilt,hue,.5+.5*Math.cos(time*6.7+f.p),f.i%3===0);
      if(f.i%4===0) {
        const p=arch(u+.013,-21-f.a*7);
        sparkle(ctx,p.x,p.y,2.0*flight,colour(hue,.18,.8));
      }
    }
  }
  return {sunshower,prism,butterflies};
})();
