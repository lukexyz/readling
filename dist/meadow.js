import {flowerFamilies} from './gardens.js';
import {highestPrism,prismByFamily} from './prism.js';

// Seven bands of printed colour. Both feet dip behind the hills, and the second arch sits inside the first.
function meadowRainbow(shot) {
  const echo=shot.family==='rainbow2', width=echo?3.4:5.3;
  const rx=echo?243:309, ry=echo?159:209;
  const arc=inset=>echo ? `M${410+rx-inset} 244a${rx-inset} ${ry-inset} 0 0 0 ${-2*(rx-inset)} 0` :
    `M${410-rx+inset} 244a${rx-inset} ${ry-inset} 0 0 1 ${2*(rx-inset)} 0`;
  const inks=echo?['#91849f','#8c99b1','#82acbc','#9dbb9b','#e7c77f','#dbac86','#ca9393']:
    ['#bd625a','#dd8c59','#e7bd62','#92aa77','#66a5a4','#7698b4','#9484a5'];
  const bands=inks.map((ink,i)=>`<path pathLength="1" d="${arc(i*width)}" stroke="${ink}" stroke-width="${width+.18}" style="--lag:${i*.045}s"/>`).join('');
  const feet=inks.map((ink,i)=>`<path d="M${410-rx+i*width} 243.5v300m${2*(rx-i*width)}-300v300" stroke="${ink}" stroke-width="${width+.18}"/>`).join('');
  const edging=`<path pathLength="1" d="${arc(-4.8)}" stroke="#bc9855" stroke-width="1.2"/>`;
  const glint='<path d="M0-9Q1-2 7 0Q1 2 0 9Q-1 2-7 0Q-1-2 0-9Z" fill="#fff2aa" stroke="#906c32"/>';
  const planet='<g transform="rotate(-23)"><circle r="7" fill="#c8856b" stroke="#805d52"/><ellipse rx="12" ry="3" fill="none" stroke="#e7bd77" stroke-width="2"/><circle cx="12" cy="-8" r="2" fill="#fff2ba"/></g>';
  const crest='<path d="m-14 3-3-13 10 6 6-12 6 12 11-6-3 13Z" fill="#ecc778" stroke="#906d3c" stroke-width="1.6"/><path d="m0-9 3 4-3 4-3-4Z" fill="#578c86"/>';
  const dial='<g stroke="#936b38" fill="#f2d591"><circle r="9"/><path d="m-5 5 4-12 3 9Z" fill="#bb864b"/><path d="M0 9v9"/><path d="m0 14 2 4 4 1-4 2-2 4-2-4-4-2 4-1Z"/></g>';
  const ornament=(fraction,art,from)=>{
    const a=Math.PI*fraction, x=410-(rx+12)*Math.cos(a), y=244-(ry+12)*Math.sin(a);
    const at=echo?.405:.32, shoulder=Math.PI*(fraction<.5?at:1-at);
    const sx=410-320*Math.cos(shoulder), sy=244-(echo?209:225)*Math.sin(shoulder);
    return `<g class="arch-setting" style="--x:${x}px;--y:${y}px;--shoulder-x:${sx}px;--shoulder-y:${sy}px"><g transform="scale(1.32)"><g class="arch-jewel" style="--from-x:${from}px;--from-y:${Math.abs(from)*.65}px">${art}</g></g></g>`;
  };
  let jewels='';
  if(shot.level===2) jewels=ornament(.23,echo?planet:glint,-28)+ornament(.77,echo?planet:glint,28);
  if(shot.level===3) jewels=ornament(echo?.76:.24,echo?dial:crest,0)+ornament(echo?.25:.75,glint,16);
  return `<g data-meadow-rainbow="${shot.id}"><g class="meadow-feet" fill="none">${feet}</g><g class="meadow-bands" fill="none">${edging}${bands}</g><g class="meadow-gilding">${jewels}</g></g>`;
}

// A printed theatre stays on the page after the show and in reduced motion. The rainbows appear once she has added them.
export function finaleScenery(picks=[],alone='') {
  const plants=flowerFamilies.map(family=>family.shots.find(shot=>shot.id===alone) ||
    family.shots.findLast(shot=>picks.includes(shot.id))).filter(Boolean);
  const garden=plants.map(shot=>`<div class="meadow-flower" data-family="${shot.family}" data-meadow-flower="${shot.id}"><img src="${shot.still}" alt="" width="480" height="360"></div>`).join('');
  const arches=['rainbow','rainbow2'].map(key=>
    prismByFamily[key].find(shot=>shot.id===alone) || highestPrism(key,id=>picks.includes(id))).filter(Boolean);
  return `<div class="meadow-scenery" aria-hidden="true"><i class="meadow-sun"></i>
    ${arches.length?`<svg class="meadow-arches" viewBox="0 0 820 270">${arches.map(meadowRainbow).join('')}</svg>`:''}
    <svg class="rainbow-theatre" viewBox="0 0 820 270" preserveAspectRatio="none">
    <path d="M59 81q15-5 30-3 12-10 29-6 11-3 20 2 18 0 27 5-57 4-106 2Z M664 60q15-5 28-4 12-8 24-5 12-1 21 4l20 3q-46 4-93 2Z" fill="#fff9e9"/>
    <path d="M0 178Q82 150 149 175T308 210Q376 216 449 202T605 184Q695 172 820 133V270H0Z" fill="#d4ddc6"/>
    <path d="M0 203Q95 164 203 198T405 232Q504 229 618 199T820 184V270H0Z" fill="#b9cbb0"/>
    <path d="M0 212Q82 210 169 233T387 260Q511 263 643 233T820 211V270H0Z" fill="#96b19a"/>
    <g fill="none" stroke="#627e6d" stroke-width="1.5" stroke-linecap="round">
      <path d="M24 238q23-2 43 3m-14 4 12 1m63 3 28 6m525-9 26-5m59-13 24-4"/>
      <path d="M79 237q-2-12-8-18m8 18q0-17 6-26m-6 26q4-9 9-12m648 10q-2-13-7-19m7 19q1-15 6-22"/>
    </g>
  </svg>${garden?`<div class="meadow-garden" data-count="${plants.length}" style="--native-flower-width:${480/(globalThis.devicePixelRatio || 1)}px">${garden}</div>`:''}</div>`;
}

// All positions here are CSS pixels inside the meadow. Read the paper after layout:
// a four-card memory round needs a different path from a single discovery.
export function meadowLayout(meadow,word) {
  const frame=meadow.getBoundingClientRect(), w=meadow.clientWidth, h=meadow.clientHeight;
  const ox=frame.left+meadow.clientLeft, oy=frame.top+meadow.clientTop;
  const cards=[...meadow.querySelectorAll('.reveal-art .stamp')];
  const bounds=cards.map(el=>el.getBoundingClientRect());
  const left=Math.min(...bounds.map(b=>b.left))-ox, right=Math.max(...bounds.map(b=>b.right))-ox;
  const top=Math.min(...bounds.map(b=>b.top))-oy, bottom=Math.max(...bounds.map(b=>b.bottom))-oy;
  const card=cards.find(el=>el.querySelector('img')?.getAttribute('src')?.endsWith('/'+word+'.webp')) || cards.at(-1);
  const face=card.querySelector('.word-art') || card, box=face.getBoundingClientRect();
  const transform=getComputedStyle(card).transform;
  const rotation=new DOMMatrix(transform==='none'?undefined:transform);
  const target={x:box.left+box.width/2-ox,y:box.top+box.height/2-oy,size:face.clientWidth,angle:Math.atan2(rotation.b,rotation.a)};
  return {w,h,left,right,top,bottom,target};
}

export function visitorLane(field,side,paired=false) {
  const {w,h,left,right,bottom}=field;
  if(side==='path') {
    const top=Math.min(h-1,Math.max(h*.56,bottom+2));
    return {x:0,y:top,w,h:h-top};
  }
  const space=side==='left'?left:w-right, foot=h*.96;
  // Prefer the shoulder when a high leap fits. A wide row leaves a continuous
  // foreground path. In a splash duet the rabbit keeps the opposite bank.
  if(space>=w*.24 || space>=(foot-bottom)*1.55) {
    const width=Math.max(1,space-w*.015);
    return {x:side==='left'?w*.009:w-width-w*.009,y:h*.055,w:width,h:foot-h*.055};
  }
  const width=w*(paired?.44:.78), top=Math.min(foot-1,bottom+h*.012);
  return {x:side==='left'?w*.035:w-width-w*.035,y:top,w:width,h:foot-top};
}

// A shallow ellipse puts the woodland poses on the grass and the sea poses on water.
export function contactShadow(ctx,x,y,w,h,alpha=.18) {
  ctx.save();ctx.fillStyle=`rgba(55,79,61,${alpha})`;
  ctx.beginPath();ctx.ellipse(x,y,w,h,0,0,Math.PI*2);ctx.fill();ctx.restore();
}

export function drawShore(e,t,duration,landings=[]) {
  if(!e.field) return;
  const {ctx,w,h}=e, line=h*.90, depth=Math.min(h*.1,w*.09);
  ctx.save();
  ctx.globalAlpha=Math.min(1,t/.22,Math.max(0,(duration-t)/.32));
  const wash=ctx.createLinearGradient(0,line-depth*.36,0,line+depth);
  wash.addColorStop(0,'#80aaa2');wash.addColorStop(.52,'#afd1c2');wash.addColorStop(1,'#91b5ab');
  ctx.fillStyle=wash;ctx.beginPath();ctx.moveTo(w*.02,line+depth*.18);
  ctx.bezierCurveTo(w*.23,line-depth*.68,w*.54,line+depth*.24,w*.97,line-depth*.33);
  ctx.bezierCurveTo(w*.83,line+depth*.63,w*.28,line+depth*1.12,w*.02,line+depth*.18);ctx.fill();
  ctx.strokeStyle='#eef4da';ctx.lineWidth=Math.max(1,depth*.085);
  for(const [at,x] of landings) {
    const age=t-at;
    if(age<0 || age>.76) continue;
    ctx.save();ctx.globalAlpha*=1-age/.76;
    ctx.beginPath();ctx.ellipse(w*x,line+depth*.10,Math.max(1,w*(.015+.13*age)),depth*(.09+.19*age),0,0,Math.PI*2);
    ctx.stroke();ctx.restore();
  }
  ctx.restore();
}
