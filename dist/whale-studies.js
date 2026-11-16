const studies=[
  {id:'woodcut',name:'The woodcut giant',description:'A humpback climbs through a curling ink wave, its long ivory flipper trailing behind.',sky:['#f2d8aa','#f7ecce'],far:'#bab7a0',sea:'#537e76',water:'#254f53',foam:'#f8e9c9',body:['#4c625c','#223f43','#182e32'],duration:3450},
  {id:'star',name:'The star swimmer',description:'A blue whale rises through moonlit mist. A constellation lights along its back as it levels out.',sky:['#111b42','#475578'],far:'#424b70',sea:'#354766',water:'#1d304f',foam:'#a9d3dd',body:['#6e91ae','#40527f','#222f55'],duration:3800},
  {id:'ice',name:'The glacier bowhead',description:'A bowhead shoulders through the ice. Floes tip apart as its white chin catches the polar light.',sky:['#c0d4d5','#f4dfc0'],far:'#a4baba',sea:'#87aaa9',water:'#517d81',foam:'#eff2df',body:['#717a82','#495267','#293c55'],duration:3950},
  {id:'orca',name:'The ember orca',description:'An orca cuts across the setting sun, rolling to flash its white flank above a copper wake.',sky:['#e78f73','#f4c58b'],far:'#ac7f75',sea:'#9c7973',water:'#574f59',foam:'#ffe3b4',body:['#484454','#262d3a','#151d29'],duration:3050}
];
const tau=Math.PI*2;
const clamp=p=>Math.max(0,Math.min(1,p));
const smooth=p=>{p=clamp(p);return p*p*(3-2*p)};
const lerp=(a,b,p)=>a+(b-a)*p;
const outlines={
 woodcut:'M-138 3 C-107 -3 -90 -14 -60 -28 Q-48 -37 -54 -47 Q-41 -42 -34 -34 C4 -51 66 -48 102 -34 Q131 -23 141 -7 Q146 2 133 12 C102 29 61 47 12 43 C-31 38 -74 14 -136 10 Z',
 star:'M-155 4 Q-118 -4 -105 -14 Q-96 -20 -99 -25 Q-90 -23 -87 -17 C-28 -39 49 -42 116 -21 Q147 -13 154 -5 Q158 2 146 7 C103 28 25 34 -27 23 Q-99 6 -155 10Z',
 ice:'M-136 5 C-103 -2 -77 -24 -45 -32 C-11 -42 20 -41 38 -37 C69 -63 115 -55 136 -25 Q151 -4 141 13 C111 44 67 59 18 53 C-32 52 -71 19 -136 12Z',
 orca:'M-133 6 Q-98 0 -69 -15 Q-48 -24 -38 -26 Q-39 -56 -48 -82 Q-31 -83 -7 -31 C24 -41 67 -36 96 -20 Q123 -9 129 5 Q132 16 113 23 C73 45 19 46 -19 31 Q-71 11 -133 14Z'
};
const bodies=Object.fromEntries(Object.entries(outlines).map(([id,d])=>[id,new Path2D(d)]));
const paths=new Map();
function mark(c,d,fill,stroke,width=1){
  if(!paths.has(d))paths.set(d,new Path2D(d));
  const p=paths.get(d);
  if(fill){c.fillStyle=fill;c.fill(p)}if(stroke){c.lineWidth=width;c.strokeStyle=stroke;c.stroke(p)}
}
function line(c,points,col,w=1){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=col;c.lineWidth=w;c.stroke();
}
function oval(c,x,y,rx,ry,col,angle=0){
  if(rx<=0||ry<=0)return;c.beginPath();c.ellipse(x,y,rx,ry,angle,0,tau);c.fillStyle=col;c.fill();
}
function gradient(c,y1,y2,cols){
  const g=c.createLinearGradient(0,y1,0,y2);cols.forEach((col,i)=>g.addColorStop(i/(cols.length-1),col));return g;
}
function spark(c,x,y,r,col){
 c.save();c.translate(x,y);c.scale(r,r);mark(c,'M0 -1 Q.08 -.12 .75 0 Q.1 .12 0 1 Q-.1 .1 -.75 0 Q-.08 -.12 0 -1Z',col);c.restore()
}
function land(c,points,col){line(c,points,col,.5);c.lineTo(660,345);c.lineTo(-20,345);c.closePath();c.fillStyle=col;c.fill()}
function vista(c,s,p){
 c.fillStyle=gradient(c,0,336,s.sky);c.fillRect(0,0,640,336);
 if(s.id==='woodcut'){
   oval(c,458,82,48,48,'#c58561');
   for(let i=0;i<6;i++)line(c,[[414,63+i*8],[480,64+i*8],[514,63+i*8]],'#eccea2',1.3);
   land(c,[[-4,227],[94,186],[127,192],[192,168],[250,193],[333,200],[455,165],[505,178],[647,160]],s.far);
 }else if(s.id==='star'){
   for(let i=0;i<92;i++){const x=(i*157.3+19)%640,y=(i*79.31+9)%206;oval(c,x,y,i%7?.85:1.45,i%7?.85:1.45,'#e6e7ce');if(i%17===0)spark(c,x,y,4,'#e6e1c8')}
   oval(c,527,60,27,27,'#f1e9c7');oval(c,537,51,27,27,'#253357');
   for(let i=0;i<5;i++){const x=(i*131+37)%641,y=155-i*6;c.fillStyle='#acbec010';c.beginPath();c.ellipse(x,y,140,6,-.06,0,tau);c.fill()}
 }else if(s.id==='ice'){
   oval(c,480,64,30,30,'#f5e8cb');
   const peaks=[[-10,181],[54,142],[83,158],[148,108],[187,146],[208,131],[261,172],[351,165],[400,129],[430,145],[473,112],[534,163],[578,133],[653,177]];
   land(c,peaks,'#93a8ac');
   for(const [x,y] of [[54,142],[148,108],[208,131],[400,129],[473,112],[578,133]]){
     c.save();c.translate(x,y);
     mark(c,'M-30 28L0 0L26 28L4 14L10 32L-3 17L-13 24L-12 17Z','#dce2d4');
     c.restore();
   }
 }else{
   oval(c,409,109,78,78,'#f9d59b');
   land(c,[[-2,211],[100,199],[211,219],[324,196],[499,177],[575,193],[643,169]],'#b98578');
   for(let i=0;i<5;i++)line(c,[[68+i*27,85+(i%3)*7],[73+i*27,83+(i%3)*7],[78+i*27,86+(i%3)*7],[84+i*27,81+(i%3)*7]],'#885e59',1.4);
 }
 const swell=[];for(let x=-4;x<=648;x+=4)swell.push([x,220+5*Math.sin(x*.019+p*.6)+2*Math.cos(x*.061)]);
 land(c,swell,s.sea);
 for(let i=0;i<34;i++){const x=(i*79)%635,y=229+(i*17)%67;line(c,[[x,y],[x+7,y-1],[x+19+i%12,y]],s.foam+'77',.85)}
}
const flukes='M0 1 C-12 -6 -18 -27 -41 -30 Q-41 -17 -32 -7 Q-26 1 -20 4 Q-34 7 -45 22 Q-22 29 -5 15L2 9Z';
function whale(c,s,t,at){
 const id=s.id, body=bodies[id];const tail=id==='star'?-151:id==='woodcut'?-135:-132;
 c.save();c.translate(...at.pos);c.rotate(at.tilt);c.scale(at.scale,at.scale*at.profile);
 c.save();c.translate(tail,7);c.rotate(at.fluke);mark(c,flukes,s.body[1],s.body[2],1.5);mark(c,'M-3 7Q-24 8 -40 21 M-3 6Q-18 -8 -32 -20',null,s.body[0],1);c.restore();
 c.fillStyle=gradient(c,-42,54,s.body);c.fill(body);c.lineWidth=1.6;c.strokeStyle=s.body[2];c.stroke(body);
 c.save();c.clip(body);
 if(id==='woodcut'){
   mark(c,'M-130 10C-55 9 -5 56 66 27Q116 11 143 -4L158 58H-145Z','#eee1bc');
   for(let i=0;i<11;i++){c.beginPath();c.moveTo(-39+i*7,32+i*.7);c.quadraticCurveTo(72+i*2,49-i*.9,139+i*.3,3-i*.9);c.strokeStyle='#557375';c.lineWidth=1;c.stroke()}
   for(let i=0;i<81;i++){const x=-93+(i*43)%214,y=-36+(i*19)%42;line(c,[[x,y],[x+8,y-2.2]],'#d7d1ae42',.8)}
 }else if(id==='star'){
   mark(c,'M-133 10Q-67 4 -15 18C52 33 104 13 161 -2L166 44H-141Z','#889dae');
   const stars=[[-111,2],[-83,-8],[-51,-5],[-26,-22],[5,-10],[31,-22],[53,-15],[86,-19],[108,-10]];
   line(c,stars,'#dddfb776',.9);
   stars.forEach(([x,y],i)=>{const r=1.7+1.3*smooth((t-i*.048-.18)*4);oval(c,x,y,r*2.3,r*2.3,'#aed4d32f');spark(c,x,y,r*1.5,'#fff1c4')});
   for(let i=0;i<50;i++)oval(c,((i*89)%234)-110,-28+(i*37)%46,.75,.75,'#b5cedc');
 }else if(id==='ice'){
   mark(c,'M91 -3Q125 -19 149 -22L155 17Q117 56 56 55Q90 36 98 22Q83 29 61 30Q101 16 91 -3Z','#e1dfcb');
   for(let i=0;i<55;i++){const x=35+(i*37)%119,y=19+(i*17)%33;oval(c,x,y,1.7+i%3,1.1,'#65747399',-.27)}
   mark(c,'M55 16Q103 1 144 -17',null,'#313d4c',2.1);
 }else{
   mark(c,'M-119 11Q-66 10 -29 22Q11 30 48 15Q78 9 99 17Q113 20 134 10L129 50H-122Z','#f6e6c7');
   mark(c,'M26 -12Q49 -32 77 -18Q66 -7 47 -4Q32 -2 26 -12Z','#f5ead7');
   mark(c,'M-62 -16Q-49 -40 -17 -32Q-33 -26 -36 -18Q-45 -20 -62 -16Z','#a49ea0');
 }
 c.restore();
 c.save();c.translate(id==='ice'?19:20,id==='ice'?31:18);c.rotate(at.fin);
 if(id==='woodcut'){
   mark(c,'M-4 -3C15 -10 23 2 17 18C11 39 -12 85 -46 96Q-35 73 -26 49Q-11 6 -4 -3Z','#e5ddba','#384f51',1.8);
   for(let i=0;i<5;i++){
     line(c,[[i+1,12+i],[-9+i,44],[-34+i,80]],'#93a08c',.65);
   }
 }else if(id==='orca')mark(c,'M0 -2Q19 -10 24 7Q19 40 -10 54Q-21 53 -14 32Z','#242c36','#56454c',1.4);
 else mark(c,'M-3 -2Q17 -12 21 3Q12 31 -24 51Q-14 26 -3 -2Z',s.body[1],s.body[0],1.5);
 c.restore();
 const eye=id==='ice'?[69,16]:id==='orca'?[74,0]:[85,0];oval(c,eye[0],eye[1],2.5,2,'#182c36');oval(c,eye[0]+.6,eye[1]-.6,.7,.7,'#eddfbf');
 if(id==='woodcut')for(let i=0;i<7;i++)oval(c,96+i*5,-30+i*2.7,2.8,1.9,'#677d77',.37);
 if(id==='star'||id==='woodcut')mark(c,'M89 10Q121 5 139 -3',null,s.body[2],1.2);
 c.restore();
}
function movement(id,t){
 // Smoothly slow the ascent before the flipper and flukes settle at the crest.
 const q=smooth(t),rise=1-(1-q)**1.55,lag=smooth((t-.20)/.8);
 const routes={
 woodcut:[271,339,377,163,-.78,-.51,1.28],
 star:[176,319,353,130,-.43,-.13,1.34],
 ice:[296,372,339,169,-.44,-.39,1.54],
 orca:[161,345,385,131,-.92,-.35,1.19]
 };
 const [x0,y0,x1,y1,a0,a1,scale]=routes[id];
 const roll=Math.sin(Math.PI*q);
 return {pos:[lerp(x0,x1,q),lerp(y0,y1,rise)],tilt:lerp(a0,a1,lag)-.09*roll,scale,
 profile:id==='orca'?.68+.32*lag:id==='ice'?1-.07*roll:1-.12*roll,
 fin:lerp(-.42,.18,lag)+.17*Math.sin(Math.PI*2*q),fluke:.37*Math.sin(2.1*Math.PI*q-.7)*(1-.55*q)};
}
function waterline(x,t,id){
 const wind=id==='woodcut'?10:id==='orca'?6:3;
 return 260+wind*Math.sin(x*.023-t*1.1)+2.7*Math.sin(x*.059+t*.8)-12*Math.sin(Math.PI*t)*Math.exp(-((x-286)**2)/10000);
}
function water(c,s,t){
 const pts=[];for(let x=-6;x<=646;x+=4)pts.push([x,waterline(x,t,s.id)]);
 land(c,pts,s.water);line(c,pts,s.foam,2.1);
 for(let i=0;i<43;i++){
  const x=((i*107+t*8)%670)-18,y=waterline(x,t,s.id)+4+(i*19)%66;
  c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+9,y-2.4,x+18+(i%17),y-.5);c.strokeStyle=s.foam+(i%4?'66':'ad');c.lineWidth=i%4?.9:1.7;c.stroke()
 }
 if(s.id==='woodcut'){
  c.save();c.translate(14,267+2*Math.sin(t*4));mark(c,'M-26 31Q9 29 40 13Q71 -2 84 -31Q91 -49 106 -49Q118 -48 115 -41Q104 -45 103 -33Q112 -38 117 -32Q108 -31 107 -23Q118 -25 123 -18Q109 -23 102 -11Q79 34 35 41Z','#567f76','#213f42',1.4);
  mark(c,'M54 13Q84 -5 89 -34Q94 -53 108 -50Q120 -48 115 -40Q107 -45 102 -34Q111 -39 117 -32Q109 -32 107 -23Q115 -26 123 -18Q109 -23 100 -11Q103 -23 94 -19Q91 -26 93 -34Q84 -4 54 13Z',s.foam);c.restore()
 }
 if(s.id==='ice'){
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=308+side*(74+i*60+t*(21-i*3)),y=waterline(x,t,s.id)+3+i*4;
    c.save();c.translate(x,y);c.rotate(side*(.06+.10*Math.sin(t*3.7+i)));mark(c,'M-27 0L-16 -7L12 -9L28 -2L16 3L-10 5Z','#dbe5db');mark(c,'M-27 0L-10 5L16 3L28 -2L24 5L-8 10L-23 6Z','#8ab2b7');c.restore();
  }
 }
}
function spray(c,s,t){
 for(let i=0;i<62;i++){
  const start=.18+(i*37%50)/100, age=(t-start)/.37;if(age<=0||age>=1)continue;
  const side=i%2?1:-1,x=284+side*(22+(i*19%40)+age*(38+i%59)),y=254-4*age*(1-age)*(20+(i*17)%59);
  oval(c,x,y,1+(i%3)*.55,2.4+(1-age)*2,s.foam,side*age*.8);
 }
}
function draw(c,s,t){
 vista(c,s,t);whale(c,s,t,movement(s.id,t));spray(c,s,t);water(c,s,t);
}
let active=null;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const list=document.getElementById('whales');
for(const s of studies){
 const item=document.createElement('article');
 item.innerHTML=`<button type="button" class="frame" aria-label="Play ${s.name}" aria-pressed="false"><canvas width="640" height="336" aria-hidden="true"></canvas><span class="control"><i></i><b>Play</b></span></button><div class="caption"><h2>${s.name}</h2><p>${s.description}</p></div>`;
 list.append(item);
 const button=item.querySelector('button'),canvas=item.querySelector('canvas'),c=canvas.getContext('2d'),label=item.querySelector('b');
 let frame=0,phase=1;
 function render(t){phase=t;c.setTransform(canvas.width/640,0,0,canvas.height/336,0,0);draw(c,s,t)}
 function size(){const w=Math.round(canvas.clientWidth*Math.min(2,devicePixelRatio||1));if(!w)return;canvas.width=w;canvas.height=Math.round(w*336/640);render(phase)}
 new ResizeObserver(size).observe(canvas);size();
 function stop(){cancelAnimationFrame(frame);active=null;button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Play '+s.name);label.textContent='Play';render(1)}
 button.addEventListener('click',()=>{
   const same=active===stop;active?.();if(same)return;
   active=stop;button.setAttribute('aria-pressed','true');button.setAttribute('aria-label','Stop '+s.name);label.textContent='Stop';
   const start=performance.now();
   function tick(now){const t=clamp((now-start)/s.duration);if(t>=1){stop();return}render(reduce.matches?Math.min(1,Math.floor(t*3)/2):t);frame=requestAnimationFrame(tick)}
   tick(start);
 });
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)active?.()});
window.addEventListener('pagehide',()=>active?.());
