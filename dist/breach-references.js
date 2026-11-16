/*
 * Hand-traced landmarks in the reference crops. For each pose: source time,
 * nose, left and right jaw, left and right shoulder, left and right contact
 * with the water, then the outer flipper tip. Y is relative to the moving
 * waterline. Occluded portions disappear at that line; nothing is painted below it.
 */
const lift = [
 [62.08,126,5,124,6,127,6,123,7,129,7,122,8,130,8,124,7],
 [62.16,126,-6,122,-4,130,-4,120,-2,133,-2,118,1,136,1,122,1],
 [62.48,116,-40,110,-35,123,-34,105,-18,128,-16,101,2,133,2,110,2],
 [62.80,109,-62,103,-55,117,-54,97,-32,122,-30,89,2,132,2,99,1],
 [63.12,116,-91,109,-84,124,-80,98,-46,132,-43,86,2,131,2,89,1],
 [63.28,125,-104,116,-93,133,-92,101,-52,139,-46,88,2,140,2,45,-32],
 [63.44,140,-96,127,-87,148,-80,111,-53,147,-42,91,2,146,2,61,-48],
 [63.60,149,-80,136,-76,155,-68,111,-44,153,-38,85,3,146,3,91,-61],
 [63.76,159,-67,145,-61,165,-53,119,-47,153,-29,88,3,143,3,126,-55],
 [63.92,172,-51,151,-52,173,-40,114,-45,159,-25,78,3,145,3,73,-31],
 [64.08,174,-22,158,-29,174,-14,125,-28,153,-6,83,3,147,3,24,-21],
 [64.24,155,-11,139,-17,158,-6,117,-18,144,-2,91,3,143,3,51,-45],
 [64.40,133,-6,120,-9,137,-4,112,-7,133,-2,98,3,128,3,74,-34],
 [64.64,119,5,115,5,123,5,112,5,125,5,106,6,126,6,109,-6],
 [64.76,119,6,115,6,123,6,112,6,125,6,106,7,126,7,112,5]
];
const roll = [
 [.65,111,4,109,5,113,5,107,5,116,5,105,6,117,6,108,5],
 [.90,114,-8,107,-7,121,-6,98,-4,125,-3,85,2,129,2,101,2],
 [1.70,116,-44,110,-40,123,-37,91,-24,127,-20,64,2,130,2,80,2],
 [2.60,114,-100,105,-93,122,-89,77,-53,127,-49,50,2,129,2,65,2],
 [3.50,110,-143,99,-136,121,-129,64,-79,122,-69,20,2,121,2,39,2],
 [4.40,115,-181,104,-172,125,-165,60,-97,122,-88,13,2,106,2,29,-9],
 [5.30,141,-214,122,-205,147,-194,67,-115,133,-110,3,2,104,2,7,-92],
 [6.20,158,-222,142,-219,173,-205,74,-139,149,-122,-12,2,101,2,3,-155],
 [6.90,188,-202,164,-196,197,-187,75,-133,159,-109,-19,2,99,2,-14,-184],
 [7.50,212,-163,181,-155,218,-146,78,-123,169,-92,-26,2,92,2,26,-176],
 [8.10,217,-115,188,-114,223,-96,80,-108,168,-65,-30,2,77,2,106,-130],
 [8.70,196,-75,174,-78,200,-61,75,-84,157,-43,-39,2,69,2,55,-85],
 [9.30,157,-31,135,-43,158,-23,62,-55,115,-18,-44,2,66,2,-9,-86],
 [9.75,115,-9,95,-19,121,-5,47,-32,92,-7,-37,2,56,2,-17,-66],
 [10.20,79,5,65,4,87,7,38,-7,66,4,-21,3,49,3,-4,-30],
 [10.57,58,7,51,7,63,7,34,7,57,7,4,7,43,7,17,5]
];

export const concepts = [
 {name:'The flipper sweep',id:'sweep',poses:lift,speed:1.23,poster:63.43,impact:63.99,finish:65.26,scale:1.91,origin:93,
  description:'The nose breaks through first. A flipper opens across the chest, then folds away as the whale lands on its side.',
  url:'https://www.youtube.com/watch?v=Ka6EMpoDr64&t=62s',source:'First film · 1:02'},
 {name:'The shoulder roll',id:'roll',poses:roll,speed:3.9,poster:6.2,impact:8.83,finish:12.10,scale:1.02,origin:77,
  description:'A long, steep rise exposes the far flipper. The shoulder rolls over and a low wall of foam catches the landing.',
  url:'https://www.youtube.com/watch?v=yKal5nKhBVI&t=1s',source:'Second film · 0:01'}
];
export function seconds(s){return (s.finish-s.poses[0][0])/s.speed}
const clamp=x=>Math.max(0,Math.min(1,x));
function smooth(x){x=clamp(x);return x*x*(3-2*x)}
const mix=(a,b,r)=>a+(b-a)*r;
const point=(a,b,r)=>[mix(a[0],b[0],r),mix(a[1],b[1],r)];
// Interpolate measured screen-space landmarks rather than rotating a rigid sprite.
function sample(rows,t){
 const last=rows.length-1;
 if(t<=rows[0][0])return rows[0];
 if(t>=rows[last][0])return rows[last];
 const k=rows.findIndex(r=>r[0]>t)-1,a=rows[k],b=rows[k+1],prev=rows[Math.max(0,k-1)],next=rows[Math.min(last,k+2)];
 const dt=b[0]-a[0],u=(t-a[0])/dt,u2=u*u,u3=u2*u;
 return a.map((v,j)=>(2*u3-3*u2+1)*v+(-2*u3+3*u2)*b[j]+(u3-2*u2+u)*dt*(b[j]-prev[j])/(b[0]-prev[0])+(u3-u2)*dt*(next[j]-v)/(next[0]-a[0]));
}
const tau=Math.PI*2;
function oval(c,x,y,a,b,angle,fill){
 c.beginPath();c.ellipse(x,y,Math.max(.01,a),Math.max(.01,b),angle,0,tau);c.fillStyle=fill;c.fill()
}
function shape(c,p,fill,line,width=1){
 c.fillStyle=fill;c.fill(p);
 if(line){c.strokeStyle=line;c.lineWidth=width;c.stroke(p)}
}
function flipper(c,root,tip,width,front){
 const dx=tip[0]-root[0],dy=tip[1]-root[1],len=Math.hypot(dx,dy);if(len<2)return;
 c.save();c.translate(...root);c.rotate(Math.atan2(dy,dx));const w=Math.min(len*.37,width);
 const p=new Path2D();p.moveTo(-2,-w*.48);
 p.bezierCurveTo(len*.27,-w*.91,len*.72,-w*.72,len,-w*.12);
 p.quadraticCurveTo(len+2,w*.28,len*.80,w*.50);
 p.bezierCurveTo(len*.55,w*1.02,len*.26,w*.78,1,w*.40);
 p.quadraticCurveTo(-w*.47,0,-2,-w*.48);p.closePath();
 const g=c.createLinearGradient(0,-w,0,w);g.addColorStop(0,front?'#b19c91':'#e9d7ba');g.addColorStop(.28,front?'#524752':'#aaa39e');g.addColorStop(1,front?'#202c38':'#524c57');shape(c,p,g,'#30343c',1);
 c.restore();
}
function figure(c,s,t){
 const v=sample(s.poses,t),pt=i=>[v[i],v[i+1]];
 const nose=pt(1),lj=pt(3),rj=pt(5),ls=pt(7),rs=pt(9),lb=pt(11),rb=pt(13),tip=pt(15);
 const height=-nose[1],wide=Math.hypot(rs[0]-ls[0],rs[1]-ls[1]);
 const front=s.id==='sweep';
 const root=point(ls,rs,front?.63:.20);
 const finVisible=smooth((t-(s.id==='sweep'?63.13:4.34))/(s.id==='sweep'?.18:1.1));
 const finTip=point(root,tip,finVisible);
 c.save();c.beginPath();c.rect(-450,-400,900,400);c.clip();
 if(!front)flipper(c,root,finTip,wide*.3,false);
 const p=new Path2D();
 // Connecting the traced left/right cheek and shoulder values keeps the jaw rounded
 // while the area of flank above the contact line changes from frame to frame.
 p.moveTo(...lb);p.quadraticCurveTo(...ls,...point(ls,lj,.57));
 p.quadraticCurveTo(...lj,...point(lj,nose,.62));p.quadraticCurveTo(...nose,...point(nose,rj,.53));
 p.quadraticCurveTo(...rj,...point(rj,rs,.49));p.quadraticCurveTo(...rs,...rb);p.closePath();
 const g=c.createLinearGradient(ls[0]-7,ls[1]-12,rs[0]+4,rs[1]+10);
 g.addColorStop(0,'#a77d75');g.addColorStop(.22,'#5b5060');g.addColorStop(.66,'#303243');g.addColorStop(1,'#192837');shape(c,p,g,'#29313b',1.3);
 c.save();c.clip(p);
 // Illustrate the white markings inside the moving silhouette in its own axial frame.
 const centre=point(lj,rj,.5),base=point(lb,rb,.5);
 const axis=Math.atan2(centre[1]-base[1],centre[0]-base[0]);
 const unit=s.id==='sweep'?1:1.85;
 c.translate(...nose);c.rotate(axis);c.scale(unit,unit);
 const flank=new Path2D('M-4 5Q-16 13 -31 12Q-43 9 -50 15Q-66 26 -79 25Q-100 23 -121 37L-175 45L-174 100L3 80L4 13Z');
 shape(c,flank,'#ecdbb9');
 const cheek=new Path2D('M-16 -3Q-22 -10 -34 -9Q-38 -8 -40 -5Q-26 1 -16 -3Z');shape(c,cheek,'#fff0d8');
 oval(c,-16,1,1.6,1.25,0,'#101c27');oval(c,-15.4,.6,.45,.45,0,'#fff4cf');
 c.beginPath();c.moveTo(-3,4);c.quadraticCurveTo(-10,9,-17,8);c.strokeStyle='#242936';c.lineWidth=1.05;c.stroke();
 c.restore();
 if(front && finVisible>.005)flipper(c,root,finTip,wide*.32,true);
 c.restore();
}
const rand=i=>{const x=Math.sin(i*81.27+17.79)*43758.545;return x-Math.floor(x)};
// Falling sheets of water cling to the rising shoulder, then break free along the sides.
function runoff(c,s,t){
 const v=sample(s.poses,t),h=-v[2];
 if(h<12)return;
 const amount=clamp(h/(s.id==='sweep'?72:153));
 c.save();c.lineCap='round';
 for(let i=0;i<25;i++){
   const side=i%2,top=side?5:3,mid=side?9:7,bottom=side?13:11;
   const r=(rand(i)*.8+.2),a=point([v[top],v[top+1]],[v[mid],v[mid+1]],r);
   const jitter=(side?1:-1)*(1+rand(i+17)*4),beat=(t*2.5+rand(i+4))%1;
   const y=a[1]*(1-beat*.78),x=mix(a[0],v[bottom],beat*.7)+jitter;
   const end=Math.min(0,y+(4+rand(i+58)*12)*amount);
   c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-jitter*.35,(end+y)*.5,x-jitter*.4,end);
   c.globalAlpha=(1-beat)*.65*amount;c.strokeStyle=i%4?'#d0e4dc':'#f8dfb7';c.lineWidth=.7+rand(i+29);c.stroke()
 }
 c.restore()
}
function plume(c,x,y,age,strength,side){
 if(age<=0||age>=1)return;
 c.save();c.translate(x,y);c.scale(strength,strength);c.globalAlpha=Math.min(1,(1-age)*3);
 const spread=1-(1-age)**2,height=Math.sin(Math.PI*clamp(age/.82))*(1-age);
 for(const dir of [-1,1]){
   c.save();c.scale(dir,1);
   const w=(18+99*spread)*(dir===side?1:.67),h=(dir===side?80:49)*height;
   const p=new Path2D();p.moveTo(0,1);p.quadraticCurveTo(w*.29,-8,w*.41,-h*.51);
   p.quadraticCurveTo(w*.35,-h*.81,w*.18,-h);p.quadraticCurveTo(w*.52,-h*.89,w*.61,-h*.40);
   p.quadraticCurveTo(w*.79,-h*.70,w,-h*.61);p.quadraticCurveTo(w*.84,-h*.50,w*.75,-h*.27);
   p.quadraticCurveTo(w*.51,-h*.06,w*.18,2);p.closePath();shape(c,p,'#9cc9c8','#658e97',1);
   c.beginPath();c.moveTo(w*.20,-2);c.quadraticCurveTo(w*.54,-h*.36,w*.37,-h*.77);c.strokeStyle='#fff1d9';c.lineWidth=2.1;c.stroke();c.restore()
 }
 for(let i=0;i<70;i++){
   const u=(age-rand(i)*.20)/(.53+rand(i+20)*.39);if(u<0||u>1)continue;
   const dir=i%2?side:-side,dx=dir*u*(16+rand(i+30)*108)*(i%2?1:.7),dy=-4*u*(1-u)*(10+rand(i+50)*91);
   const size=(1+rand(i+77)*2.9)*(1-u*.5);
   oval(c,dx,dy,size*.69,size*(1+.75*Math.abs(u-.5)),dir*u*.7,i%3?'#a7cfcf':'#fff3de')
 }
 c.restore()
}
export function paint(c,s,elapsed){
 const t=s.poses[0][0]+elapsed*s.speed;
 if(elapsed<=0||t>=s.finish-.00001)return;
 const floor=293;
 c.save();c.translate(300-s.origin*s.scale,floor);c.scale(s.scale,s.scale);
 if(t<=s.poses.at(-1)[0]){figure(c,s,t);runoff(c,s,t)}
 // A narrow collar of broken water moves with the contact points and softens the cut edge.
 const v=sample(s.poses,t),span=v[13]-v[11],fade=clamp(-v[2]/15);
 if(span>2 && fade>0){
   c.save();c.globalAlpha=.85*fade;
   for(let i=0;i<17;i++){
     const q=i/16,crest=1-Math.abs(q-.5)*1.4;
     const x=v[11]+q*span,y=-1.4+Math.sin(t*6+i*1.8)*1.1;
     oval(c,x,y,span/19+1,1.3+crest*(1+rand(i)*1.9),-.04,i%3?'#afd0d1':'#fff0d8');
   }
   c.restore();
 }
 c.restore();
 const start=s.poses[0][0],impact=(t-s.impact)/(s.finish-s.impact);
 plume(c,300+(s.poses[1][1]-s.origin)*s.scale,floor,(t-start)/((s.impact-start)*.60),.27,-1);
 plume(c,300+((s.id==='sweep'?122:95)-s.origin)*s.scale,floor,impact,s.id==='sweep'?.86:1.04,1)
}
