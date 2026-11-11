const colours=['#ff635d','#ffa448','#ffdb55','#78d28b','#61d4e7','#9288ef','#f495d0'];
const gold='#ffce50';
const ink='#354435';
const tau=Math.PI*2;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
let stopActive=null;

function starPoints(points,inner,outer=1) {
  return Array.from({length:points*2},(_,i)=>{
    const angle=i*Math.PI/points-Math.PI/2;
    const radius=i%2?inner:outer;
    return [Math.cos(angle)*radius,Math.sin(angle)*radius];
  });
}
const five=starPoints(5,.47);
const four=starPoints(4,.22);
const starSvg=five.map(p=>p.join(',')).join(' ');

// A printed rainbow theatre stays on the page after the fireworks and in reduced motion.
function finaleScenery() {
  const stars=[[41,41,9],[89,93,5],[132,32,4],[165,72,8],[214,27,11],[69,157,11],[136,145,5],[104,204,4],
    [614,31,11],[660,78,5],[705,33,4],[755,74,10],[786,135,6],[690,170,9],[741,210,5],[41,213,4]];
  const cloud='<path d="M-10 263v-36q10-12 25-8c-2-21 25-34 41-21 2-30 41-41 57-17 21-17 51-3 51 17 28-6 47 11 43 31 28-6 42 12 41 28v14z" fill="#f5e4b4" stroke="#4c584a" stroke-width="3"/><path d="M10 231q12-8 22-4m37-28q14-12 27-5m24 19q15-8 24 1m26 18q13-7 21 2" fill="none" stroke="#ac9767" stroke-width="2.5" stroke-linecap="round"/>';
  return `<svg class="rainbow-theatre" viewBox="0 0 820 270" preserveAspectRatio="none" aria-hidden="true">
    <defs><radialGradient id="show-sky"><stop stop-color="#3d6053"/><stop offset="1" stop-color="#203c3c"/></radialGradient></defs>
    <rect width="820" height="270" fill="url(#show-sky)"/>
    <g fill="#fbd579" opacity=".09">${Array.from({length:24},(_,i)=>`<path d="M410 214 L389 -390 L431 -390Z" transform="rotate(${i*15} 410 214)"/>`).join('')}</g>
    <g fill="#ffdc83">${stars.map(([x,y,r],i)=>`<polygon points="${starSvg}" transform="translate(${x} ${y}) rotate(${i*19}) scale(${r})"/>`).join('')}</g>
    <g fill="none" stroke-linecap="round" class="rainbow-bands">${colours.map((c,i)=>{
      const r=278-i*10;
      return `<path pathLength="1" style="--band-delay:${i*.045}s" d="M${410-r} 265 A${r} ${251-i*10} 0 0 1 ${410+r} 265" stroke="${c}" stroke-width="10.8"/>`;
    }).join('')}</g>
    <g fill="none" stroke="#fff5ca" stroke-width="2" stroke-dasharray="2 8"><path d="M122 265 A288 261 0 0 1 698 265"/></g>
    ${cloud}<g transform="translate(820 0) scale(-1 1)">${cloud}</g>
    <rect x="5" y="5" width="810" height="260" rx="13" fill="none" stroke="#dbc38a" stroke-opacity=".6" stroke-width="1.5"/>
  </svg>`;
}
function drawStar(ctx,x,y,r,angle,points,colour) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(r,r);
  ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
  ctx.fillStyle=colour;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=Math.min(.15,1.6/r);ctx.stroke();
  if(r>10){ctx.beginPath();ctx.moveTo(-.03,-.76);ctx.lineTo(-.16,-.28);ctx.lineTo(-.53,-.19);ctx.strokeStyle='#fff9cd';ctx.lineWidth=.085;ctx.stroke();}
  ctx.restore();
}
function cancelFinale() {stopActive?.();}
function launchFinale(stage) {
  cancelFinale();
  if(!stage || motion.matches || document.hidden) return;
  const canvas=document.createElement('canvas');
  canvas.className='fireworks-screen';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  if(!ctx) return;
  document.body.append(canvas);
  stage.classList.remove('show-playing');void stage.offsetWidth;stage.classList.add('show-playing');
  let w=0,h=0,scale=1,cx=0,cy=0,frame=0;
  function locate() {
    const r=stage.querySelector('.reveal-art').getBoundingClientRect();
    cx=r.left+r.width/2;cy=Math.max(0,Math.min(h,r.top+r.height*.45));
  }
  function resize() {
    w=window.innerWidth;h=window.innerHeight;
    const dpr=Math.min(devicePixelRatio||1,1.6,Math.sqrt(2000000/(w*h)));
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);ctx.lineJoin='round';ctx.lineCap='round';
    scale=Math.max(.67,Math.min(1.22,w/900));locate();
  }
  resize();
  const confetti=[],rings=[];
  const limit=w<650?210:320;
  const start=performance.now();
  function burst(x,y,n,energy,sky=false) {
    rings.push({x,y,age:0,r:energy*.28});
    for(let i=0;i<n;i++) {
      const angle=i*tau/n+Math.random()*.15;
      const speed=energy*(.35+Math.random()*.68)*scale;
      const kind=i%6;
      confetti.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed-(sky?energy*.52:35)*scale,
        age:0,life:1.45+Math.random()*1.65,size:(kind===0?10+Math.random()*10:3+Math.random()*6)*scale,
        rotation:Math.random()*tau,spin:Math.random()*5-2.5,kind,colour:i%4===0?gold:colours[i%colours.length]});
    }
    if(confetti.length>limit)confetti.splice(0,confetti.length-limit);
  }
  // A shooting star bounds from peg to peg before firing two banks of star fountains.
  const beats=[[0,-.13,.15],[.55,.26,-.12],[1.07,-.30,-.27],[1.62,.33,-.22],[2.24,0,0]];
  function peg(j) {return {x:cx+beats[j][1]*w,y:Math.max(48,cy+beats[j][2]*h)};}
  function ballAt(t) {
    let j=1;while(j<beats.length-1 && beats[j][0]<t)j++;
    const a=peg(j-1),b=peg(j),p=Math.max(0,Math.min(1,(t-beats[j-1][0])/(beats[j][0]-beats[j-1][0])));
    return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p-Math.sin(p*Math.PI)*Math.min(105,h*.12)};
  }
  function comet(t) {
    for(let j=1;j<beats.length-1;j++){
      const p=peg(j),delta=t-beats[j][0];
      if(delta>.35)continue;
      ctx.globalAlpha=delta<0?.85:Math.max(0,1-delta/.35);
      drawStar(ctx,p.x,p.y,(delta<=0?14:18+26*delta)*scale,j*.3,five,'#ffdb63');
    }
    ctx.globalAlpha=1;
    for(let j=0;j<colours.length;j++){
      ctx.beginPath();
      for(let k=0;k<=18;k++){
        const p=ballAt(Math.max(0,t-.19+.19*k/18));
        const y=p.y+(j-3)*3.3*scale;
        if(k===0)ctx.moveTo(p.x,y);else ctx.lineTo(p.x,y);
      }
      ctx.strokeStyle=colours[j];ctx.lineWidth=4.3*scale;ctx.stroke();
    }
    const p=ballAt(t);drawStar(ctx,p.x,p.y,22*scale,t*4,five,'#ffd752');
  }
  const events=beats.slice(1).map(([t],i)=>({t,fire:()=>{
    const p=peg(i+1);burst(p.x,p.y,i===3?85:26,i===3?460:225);
  }}));
  // Stagger the cannon salutes so the eye can follow one burst into the next.
  [[2.5,.04,.88,60,525],[2.72,.96,.88,60,525],[3.15,.18,.34,42,290],[3.56,.84,.23,45,320],
   [4.02,.08,.86,55,560],[4.18,.92,.87,55,560],[4.65,.30,.18,48,310],[4.90,.73,.24,45,310],
   [5.50,.13,.47,65,380],[5.55,.87,.46,65,380],[5.95,.50,.18,90,465]]
    .forEach(([t,x,y,n,e])=>events.push({t,fire:()=>burst(x*w,y*h,Math.round(n*(w<650?.7:1)),e,y>.7)}));
  let cursor=0, previous=start;
  function stop(){
    cancelAnimationFrame(frame);canvas.remove();stage.classList.remove('show-playing');
    window.removeEventListener('resize',resize);window.removeEventListener('scroll',locate);
    document.removeEventListener('visibilitychange',visibility);motion.removeEventListener('change',stop);
    stopActive=null;
  }
  function visibility(){if(document.hidden)stop();}
  function tick(now) {
    const t=(now-start)/1000,dt=Math.min((now-previous)/1000,.07);previous=now;
    if(t>=9 || !stage.isConnected){stop();return;}
    ctx.clearRect(0,0,w,h);
    while(cursor<events.length && events[cursor].t<=t)events[cursor++].fire();
    for(let i=rings.length-1;i>=0;i--){
      const r=rings[i];r.age+=dt;if(r.age>.48){rings.splice(i,1);continue;}
      ctx.globalAlpha=(1-r.age/.48)*.84;ctx.strokeStyle='#eab447';ctx.lineWidth=3*scale;
      ctx.beginPath();ctx.arc(r.x,r.y,5+r.r*scale*r.age/.48,0,tau);ctx.stroke();
    }
    for(let i=confetti.length-1;i>=0;i--){
      const p=confetti[i];p.age+=dt;if(p.age>=p.life || p.y>h+45){confetti.splice(i,1);continue;}
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-.55*dt);p.vy+=200*scale*dt;p.rotation+=p.spin*dt;
      ctx.globalAlpha=Math.min(1,(p.life-p.age)*2.5);
      if(p.kind===1 || p.kind===4){
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.colour;
        ctx.fillRect(-p.size*.32,-p.size,p.size*.65*Math.cos(p.age*3.3),p.size*2);ctx.restore();
      }else{drawStar(ctx,p.x,p.y,p.size,p.rotation,p.kind===3?four:five,p.colour);}
    }
    ctx.globalAlpha=1;if(t<=2.24)comet(t);
    frame=requestAnimationFrame(tick);
  }
  stopActive=stop;
  window.addEventListener('resize',resize);window.addEventListener('scroll',locate,{passive:true});
  document.addEventListener('visibilitychange',visibility);motion.addEventListener('change',stop);
  frame=requestAnimationFrame(tick);
}
export {finaleScenery, launchFinale, cancelFinale};
