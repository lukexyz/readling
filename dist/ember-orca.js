const TAU = Math.PI * 2;
const stage = {width:640,height:344,surface:318};
const levels = [
  {name:'Quick breach', air:1.02, rise:178, travel:148, scale:.67, spray:.48, drain:.62},
  {name:'Banking leap', air:1.30, rise:218, travel:208, scale:.76, spray:.72, drain:.76},
  {name:'Full flip', air:1.57, rise:266, travel:255, scale:.83, spray:1, drain:1.06}
];
const clamp = x=>Math.max(0,Math.min(1,x));
function ease(x){x=clamp(x);return x*x*(3-2*x)}
// The same long dorsal, saddle patch and ivory eye patch as the original Ember study.
const paths = {
  body:'M-133 6Q-98 0 -69 -15Q-48 -24 -38 -26Q-39 -56 -48 -82Q-31 -83 -7 -31C24 -41 67 -36 96 -20Q123 -9 129 5Q132 16 113 23C73 45 19 46 -19 31Q-71 11 -133 14Z',
  flukes:'M4 1C-11 -5 -22 -24 -41 -30Q-40 -12 -22 3Q-36 9 -44 23Q-20 25 -4 14L6 9Z',
  belly:'M-119 11Q-66 10 -29 22Q11 30 48 15Q78 9 99 17Q113 20 134 10L129 50H-122Z',
  patch:'M26 -12Q49 -32 77 -18Q66 -7 47 -4Q32 -2 26 -12Z',
  saddle:'M-62 -16Q-49 -40 -17 -32Q-33 -26 -36 -18Q-45 -20 -62 -16Z',
  fin:'M0 -2Q18 -9 24 7Q20 32 1 49Q-14 60 -17 48Q-18 32 -9 14Z',
  rim:'M-129 6Q-90 -2 -69 -15Q-47 -24 -38 -26Q-39 -54 -47 -80M-7 -31Q50 -42 93 -22Q113 -12 123 -3'
};
for (const key of Object.keys(paths)) paths[key]=new Path2D(paths[key]);
function fill(c,path,col){c.fillStyle=col;c.fill(path)}
function stroke(c,path,col,w){c.lineWidth=w;c.strokeStyle=col;c.stroke(path)}
function ellipse(c,x,y,rx,ry,angle,col){
  c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.fillStyle=col;c.fill();
}
function body(c,n,q,s){
  const arc=Math.sin(Math.PI*q);
  const bank=n===1?.18*arc:Math.sin(Math.PI*ease((q-.12)/.76))*(n===2?1:.62);
  const angle=Math.atan2(4*s.rise*(2*q-1),s.travel);
  const flip=n===3?TAU*ease((q-.14)/.70):0;
  const x=320+s.travel*(q-.5), y=stage.surface+(132+66*q)*s.scale-4*s.rise*q*(1-q);
  c.save();
  c.translate(x,y);c.rotate(angle*.79+flip);c.scale(s.scale,s.scale*(1-bank*.32));
  const sweep=Math.sin(q*TAU-.5);
  // Far fin, flexing flukes, trunk, then near fin establish the bank in silhouette.
  c.save();c.translate(38,18);c.rotate(-.65-bank*.84);c.scale(.72,.68);
  fill(c,paths.fin,'#504453');c.restore();
  c.save();c.translate(-131,8);c.rotate(.33*sweep-.18*bank);
  fill(c,paths.flukes,'#343441');stroke(c,paths.flukes,'#202432',1.6);
  c.beginPath();c.moveTo(-4,4);c.quadraticCurveTo(-21,-5,-36,-23);c.strokeStyle='#b28670';c.lineWidth=1.1;c.stroke();c.restore();
  const coat=c.createLinearGradient(0,-74,12,48);
  coat.addColorStop(0,'#976e64');coat.addColorStop(.29,'#524452');coat.addColorStop(.64,'#252e3a');coat.addColorStop(1,'#171f2c');
  fill(c,paths.body,coat);stroke(c,paths.body,'#252b34',1.7);
  c.save();c.clip(paths.body);c.translate(0,-7*bank);
  fill(c,paths.belly,'#f7e2bd');fill(c,paths.patch,'#fff0d9');fill(c,paths.saddle,'#aaa2a2');c.restore();
  stroke(c,paths.rim,'#da9e77',1.6);
  c.save();c.translate(20,17-bank*8);c.rotate(.06+.3*sweep+bank*1.2);
  c.scale(1,.9+.12*arc);fill(c,paths.fin,'#29313e');stroke(c,paths.fin,'#625665',1.2);c.restore();
  ellipse(c,74,-bank*5,2.4,2,0,'#161c26');ellipse(c,74.6,-.8-bank*5,.78,.78,0,'#f5dfc2');
  c.restore();
}
function noise(i){const x=Math.sin(i*78.233+2.24)*43758.5453;return x-Math.floor(x)}
function splash(c,x,age,strength,landing){
  // Each event is anchored to one contact point; even the largest crown spans under half the stage.
  if(age<0||age>=1)return;
  const y=stage.surface;
  c.save();c.translate(x,y);c.globalAlpha*=clamp((1-age)/.26);
  const expand=1-(1-age)**2;
  for(let i=0;i<2;i++){
    const a=clamp((age-i*.13)/.87);if(!a)continue;
    c.beginPath();c.ellipse(0,2+i*2,(9+85*a)*strength,(2+8*a)*strength,0,0,TAU);
    c.strokeStyle=i?'#f9e2c3':'#789d9e';c.lineWidth=(1-a)*2+.5;c.stroke();
  }
  const crown=Math.sin(Math.PI*clamp(age/.73))*(1-age);
  if(crown>.015){
    for(const side of [-1,1]){
      c.save();c.scale(side*strength,strength);
      const reach=18+75*expand, high=crown*(landing?96:62)*(side===1?1:.81);
      c.beginPath();c.moveTo(1,2);
      c.bezierCurveTo(reach*.34,-4,reach*.45,-high*.39,reach,-high*.67);
      c.quadraticCurveTo(reach*.85,-high*.72,reach*.65,-high*.49);
      c.quadraticCurveTo(reach*.51,-high*.97,reach*.22,-high);
      c.quadraticCurveTo(reach*.38,-high*.51,reach*.31,-high*.40);
      c.quadraticCurveTo(reach*.18,-high*.61,reach*.09,-high*.65);
      c.quadraticCurveTo(reach*.17,-high*.18,1,2);
      c.fillStyle='#83b3b6';c.fill();c.lineWidth=1.5;c.strokeStyle='#517e85';c.stroke();
      c.beginPath();c.moveTo(reach*.04,-3);c.quadraticCurveTo(reach*.37,-high*.27,reach*.24,-high*.86);
      c.quadraticCurveTo(reach*.49,-high*.45,reach*.31,-high*.21);
      c.quadraticCurveTo(reach*.55,-high*.37,reach*.72,-high*.48);
      c.quadraticCurveTo(reach*.33,-high*.10,reach*.04,-3);c.fillStyle='#fff3db';c.fill();c.restore();
    }
  }
  const count=Math.ceil(15+strength*37);
  for(let i=0;i<count;i++){
    const p=(age-noise(i+5)*.17)/(.55+noise(i+88)*.37);if(p<=0||p>=1)continue;
    const side=i%2?1:-1,dx=side*(3+p*(28+noise(i+12)*109))*strength;
    const height=(28+noise(i+40)*83)*strength;
    const dy=-4*height*p*(1-p),r=(1.5+noise(i+63)*2.6)*(1-p*.6)*strength;
    ellipse(c,dx,dy,r,r*(1.25+Math.abs(1-2*p)),side*(p-.35)*1.2,i%4===0?'#e4ac79':i%3?'#8ab7b7':'#fff3d7');
    if(i%4===1)ellipse(c,dx-r*.2,dy-r*.3,r*.45,r*.65,0,'#fff7e1');
  }
  c.restore();
}
function duration(n){return levels[n-1].air+levels[n-1].drain}
function drawOrca(c,n,seconds){
 const s=levels[n-1],q=clamp(seconds/s.air);
 if(seconds<=0||seconds>=duration(n))return;
 c.save();c.lineCap='round';c.lineJoin='round';
 // Clip only the animal at its local entry line. The surrounding scene is untouched.
 if(q<1){
   c.save();c.beginPath();c.rect(0,0,stage.width,stage.surface);c.clip();
   body(c,n,q,s);c.restore();
 }
 splash(c,320-s.travel*.48,(seconds-.025)/.62,s.spray*.48,false);
 const contact=s.air*.85;
 splash(c,320+s.travel*.51,(seconds-contact)/(duration(n)-contact),s.spray,true);
 c.restore();
}
export {stage,levels,duration,drawOrca};
