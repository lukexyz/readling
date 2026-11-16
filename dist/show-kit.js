// Colours, shapes and timing curves shared by every part of the celebration show.
const colours=['#ff635d','#ffa448','#ffdb55','#78d28b','#61d4e7','#9288ef','#f495d0'];
const gold='#ffce50', ink='#354435', cream='#fbf3dc', green='#78c486', water='#8fd0e2';
const tau=Math.PI*2;
const clamp01=v=>Math.max(0,Math.min(1,v));
const ease=p=>1-(1-clamp01(p))**3;
const easeIn=p=>clamp01(p)**2;
const swing=p=>{p=clamp01(p);return p*p*(3-2*p);};
// Goes a little past its place before settling, for things that pop up.
const pop=p=>{p=clamp01(p);return 1+2.4*(p-1)**3+1.4*(p-1)**2;};
// Rises and falls once between 0 and 1.
const bump=p=>p<=0 || p>=1?0:Math.sin(p*Math.PI);

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
function drawStar(ctx,x,y,r,angle,points,colour) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(r,r);
  ctx.beginPath();points.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();
  ctx.fillStyle=colour;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=Math.min(.15,1.6/r);ctx.stroke();
  if(r>10){ctx.beginPath();ctx.moveTo(-.03,-.76);ctx.lineTo(-.16,-.28);ctx.lineTo(-.53,-.19);ctx.strokeStyle='#fff9cd';ctx.lineWidth=.085;ctx.stroke();}
  ctx.restore();
}
// Fills the path just drawn and gives it the ink outline that every cut-out in the show has.
function paint(ctx,fill,width=2.2) {
  ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=width;ctx.stroke();
}
function oval(ctx,x,y,rx,ry,angle,fill,width) {
  ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,tau);paint(ctx,fill,width);
}
function flower(ctx,x,y,r,angle,colour,petals=5) {
  const line=Math.min(1.8,r*.13);
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  for(let i=0;i<petals;i++){ctx.rotate(tau/petals);oval(ctx,0,-r*.58,r*.34,r*.48,0,colour,line);}
  ctx.beginPath();ctx.arc(0,0,r*.3,0,tau);paint(ctx,gold,line);ctx.restore();
}
// A leaf with its stalk at the origin, pointing along the angle.
function leafShape(ctx,x,y,length,angle,fill=green) {
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(length*.5,-length*.42,length,0);ctx.quadraticCurveTo(length*.5,length*.42,0,0);
  paint(ctx,fill,Math.min(1.8,length*.09));
  ctx.beginPath();ctx.moveTo(length*.12,0);ctx.lineTo(length*.8,0);ctx.lineWidth=Math.min(1.2,length*.05);ctx.stroke();ctx.restore();
}
// The same run of numbers every time, so a show looks the same on each viewing and can be checked frame by frame.
function random(seed) {
  return ()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}
// Where band i of the rainbow sits on the screen. The second rainbow is the smaller one inside the first.
function band(th,i,second=false) {
  const rx=second?188-i*7:278-i*10, ry=second?166-i*7:251-i*10;
  return {x:th.x+th.w/2,y:th.y+th.h*265/270,rx:rx*th.w/820,ry:ry*th.h/270,width:(second?7.4:10.8)*th.h/270};
}
export {colours,gold,ink,cream,green,water,tau,clamp01,ease,easeIn,swing,pop,bump,five,four,starSvg,drawStar,paint,oval,flower,leafShape,random,band};
