import {gardens} from './gardens.js';
import {dolphinFamilies, dolphinPoster, loadDolphin} from './dolphins.js';
import {shots as orcas, loadShot as loadOrca} from './ember-orca.js';

const families = [
  ...gardens,
  ...dolphinFamilies.map(family => ({key:family.id, title:family.title, intro:family.motion,
    palette:['#52989b','#253e52'], shots:family.levels.map(shot => ({...shot, fps:30,
      still:dolphinPoster(shot), load:() => loadDolphin(shot)}))})),
  {key:'orca', title:'Ember Orca', intro:'From the first breath to a somersault and a tower of whitewater.',
    palette:['#588e94','#2b3d51'], shots:orcas.map(shot => ({...shot, fps:30,
      still:new URL('./assets/ember-orca/concept-'+shot.level+'-poster.webp', import.meta.url).href,
      load:() => loadOrca(shot.level)}))}
];

const $ = selector => document.querySelector(selector);
const requested = new URLSearchParams(location.search).get('family');
const family = families.find(item => item.key === requested);
for (const item of [{key:'all',title:'All'},...families]) {
  const link = document.createElement('a');
  link.href = '?family='+item.key;
  link.textContent = item.title;
  if (item.key===(family?.key ?? 'all')) link.setAttribute('aria-current','page');
  $('#families').append(link);
}
function makeCard(shot,index,grid) {
  const card = $('#study-card').content.firstElementChild.cloneNode(true);
  const find = selector => card.querySelector(selector);
  const plate = find('.plate'), canvas = find('canvas'), scrub = find('input'), button = find('button');
  const time = find('output'), ctx = canvas.getContext('2d');
  const [x,y,w,h] = shot.crop;
  canvas.width=w; canvas.height=h;
  find('img').src=shot.still;
  find('img').loading='lazy';
  find('.level').textContent='Level '+(index+1);
  find('h3').textContent=shot.title;
  find('.caption').textContent=shot.description;
  scrub.setAttribute('aria-label','Scrub '+shot.title);
  scrub.max='1000';
  grid.append(card);
  let asset, pending, token=0, active=false, playing=false, frame=0, raf;
  function state(name) {
    button.textContent=name;
    button.setAttribute('aria-label',name+' '+shot.title);
  }
  state('Play');
  function stop() {
    token++;
    cancelAnimationFrame(raf);
    playing=false;
    state(active && asset && frame<asset.length-1 ? 'Resume' : 'Play');
  }
  function paint(n) {
    frame=Math.max(0,Math.min(asset.length-1,n));
    ctx.clearRect(0,0,w,h);
    ctx.save();ctx.translate(-x,-y);asset.paint(ctx,frame);ctx.restore();
    active=true;
    plate.classList.add('active');
    scrub.value=String(Math.round(frame*1000/(asset.length-1)));
    time.value=(frame/shot.fps).toFixed(1)+' s';
    scrub.setAttribute('aria-valuetext',time.value);
  }
  async function ready() {
    if (asset) return;
    try {
      pending ||= shot.load();
      asset=await pending;
    } finally { pending=null; }
  }
  function start(now,fromStart) {
    cancelAnimationFrame(raf);
    const first=fromStart || !active || frame===asset.length-1 ? 0 : frame;
    const stamp=++token;
    playing=true;state('Pause');paint(first);
    function tick(clock) {
      if (stamp!==token) return;
      const next=first+Math.floor((clock-now)*shot.fps/1000);
      if (next!==frame) paint(next);
      if (next>=asset.length-1) { stop(); updateTogether(); }
      else raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
  }
  function failed() {
    stop(); updateTogether();
    $('#message').textContent='This animation could not load. Tap Play to try again.';
  }
  button.onclick=async () => {
    groupToken++;
    if (playing) { stop();updateTogether();return; }
    const stamp=++token;
    $('#message').textContent='';
    state('Loading');
    try {await ready();if(stamp===token) { start(performance.now(),false);updateTogether(); }}
    catch {if(stamp===token) failed();}
  };
  scrub.oninput=async () => {
    groupToken++;stop();updateTogether();
    const fraction=Number(scrub.value)/1000, stamp=token;
    try {await ready();if(stamp===token) { paint(Math.round(fraction*(asset.length-1)));state('Play'); }}
    catch {if(stamp===token) failed();}
  };
  function release() {
    if (pending) return;
    stop(); asset=null;active=false;frame=0;
    plate.classList.remove('active');
    scrub.value='0';scrub.removeAttribute('aria-valuetext');time.value='';state('Play');
  }
  return {card,ready,start,stop,release,isPlaying:()=>playing};
}
let groupToken=0;
const players=[];
const container=$('#studies');
const together=$('#together');
if (!family) {
  $('.heading').hidden=true;
  container.classList.add('overview');
  container.parentElement.setAttribute('aria-label','All celebrations');
  container.parentElement.removeAttribute('aria-labelledby');
} else {
  $('#family').textContent=family.title;
  $('#intro').textContent=family.intro;
}
for (const entry of family ? [family] : families) {
  let grid=container;
  if (!family) {
    const section=document.createElement('section'), header=document.createElement('div');
    header.className='family-heading';
    const title=document.createElement('h2'), link=document.createElement('a');
    title.textContent=entry.title;
    link.href='?family='+entry.key;link.textContent='Compare levels →';
    link.setAttribute('aria-label','Compare '+entry.title+' levels');
    header.append(title,link);
    grid=document.createElement('div');grid.className='family-grid';
    section.append(header,grid);container.append(section);
  }
  grid.style.setProperty('--glow',entry.palette[0]);
  grid.style.setProperty('--sky',entry.palette[1]);
  players.push(...entry.shots.map((shot,i)=>makeCard(shot,i,grid)));
}
if (!family && 'IntersectionObserver' in window) {
  const byCard=new Map(players.map(p=>[p.card,p]));
  const observer=new IntersectionObserver(entries=>{
    for (const entry of entries) if (!entry.isIntersecting) byCard.get(entry.target).release();
  },{rootMargin:'300px'});
  for (const p of players) observer.observe(p.card);
}
function updateTogether() {
  together.textContent=players.some(p=>p.isPlaying()) ? 'Stop together' : 'Play together';
}
together.onclick=async () => {
  const wasPlaying=players.some(p=>p.isPlaying()), stamp=++groupToken;
  players.forEach(p=>p.stop());updateTogether();
  if (wasPlaying) return;
  together.textContent='Loading…';$('#message').textContent='';
  try {
    await Promise.all(players.map(p=>p.ready()));
    if (stamp!==groupToken) return;
    const now=performance.now();
    players.forEach(p=>p.start(now,true));updateTogether();
  } catch { if (stamp===groupToken) {$('#message').textContent='Could not load all the levels. Tap Play together to retry.';updateTogether();} }
};
document.addEventListener('visibilitychange',() => {
  if (document.hidden) {groupToken++;players.forEach(p=>p.stop());updateTogether();}
});
