import {icon} from './drawings.js';
import {BADGES_PER_STAGE} from './game.js';

const FOLDS_PER_MAP=5;
export const badgeArt=(stage,rank)=>`./assets/badges/${stage.badges.id}-${rank}.webp`;

function stageFold({stage,open,badgeRank}) {
  const name=`Stage ${stage.number}, ${stage.badges.name}`;
  const token=open
    ? `<img src="${badgeArt(stage,badgeRank)}" alt="" width="88" height="88">`
    : `<span class="trail-locked" aria-hidden="true">${icon('lock',18)}</span>`;
  const status=open?`${badgeRank} of ${BADGES_PER_STAGE} badges earned`:'locked';
  return `<button type="button" class="trail-stage" data-trail-stage="${stage.number}" aria-label="${name}, ${status}"
    ${open?'aria-pressed="false" aria-controls="trail-collection"':'disabled'}>
    <span>Stage ${stage.number}</span>${token}<span class="trail-count">${badgeRank} / ${BADGES_PER_STAGE}</span></button>`;
}

function rankCards({stage,badgeRank}) {
  return Array.from({length:BADGES_PER_STAGE},(_,i)=>{
    const rank=i+1, earned=rank<=badgeRank;
    const face=earned?`<img src="${badgeArt(stage,rank)}" alt="" width="58" height="66">`:`<span class="trail-placeholder">${rank}</span>`;
    const label=`${stage.badges.name}, badge ${rank}${earned?' of '+BADGES_PER_STAGE:', not yet earned'}`;
    return `<button type="button" class="trail-choice" data-trail-rank="${rank}" style="--lean:${i-(BADGES_PER_STAGE-1)/2}"
      ${earned?'aria-pressed="false"':'disabled'} aria-label="${label}"><span class="trail-card">${face}</span></button>`;
  }).join('');
}

export function mountPocketTrail(root,progress,initial,initialRank) {
  const maps=[];
  for(let start=0;start<progress.length && progress[start].open;start+=FOLDS_PER_MAP) {
    maps.push(progress.slice(start,start+FOLDS_PER_MAP));
  }
  const lastStage=maps.map(folds=>folds.findLast(entry=>entry.open));
  const ranks=new Map([[initial.stage.number,initialRank]]);
  const ranges=maps.map((folds,i)=>{
    const first=folds[0].stage.number, last=folds.at(-1).stage.number;
    const range=first===last?String(first):`${first}–${last}`;
    return `<button type="button" data-trail-map="${i}" aria-pressed="false" aria-label="Stages ${range}">${range}</button>`;
  });
  root.innerHTML=`${ranges.length>1?`<div class="trail-ranges" role="group" aria-label="Stage ranges"><span aria-hidden="true">Stages</span>${ranges.join('')}</div>`:''}
    <div class="trail-mat"><div class="trail-map">
      <div class="trail-paper" aria-hidden="true"></div>
      <svg class="trail-route" viewBox="0 0 500 144" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path d="M-2 89 Q25 77 50 73 T103 70 Q124 67 150 72 T205 80 Q230 78 250 71 T301 71 Q328 69 350 73 T402 83 Q426 76 450 72 T502 70" fill="none" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="trail-stops" role="group" aria-label="Reading stages"></div>
    </div></div>
    <section class="trail-collection" id="trail-collection" aria-labelledby="trail-family">
      <h3 id="trail-family"></h3><div class="trail-ranks" role="group" aria-labelledby="trail-family"></div>
      <p class="trail-caption" aria-live="polite" aria-atomic="true"></p><p class="trail-lesson"></p>
    </section>`;
  const mat=root.querySelector('.trail-mat'), stops=root.querySelector('.trail-stops'), cards=root.querySelector('.trail-ranks');
  const family=root.querySelector('#trail-family'), lesson=root.querySelector('.trail-lesson'), caption=root.querySelector('.trail-caption');
  let mapIndex=-1, selected;

  function show(entry,rank=ranks.get(entry.stage.number) ?? entry.badgeRank) {
    const {stage}=entry, nextMap=maps.findIndex(folds=>folds.includes(entry));
    if(nextMap!==mapIndex) {
      mapIndex=nextMap;
      const folds=maps[mapIndex];
      mat.style.setProperty('--folds',folds.length);
      root.querySelector('.trail-paper').innerHTML='<i></i>'.repeat(folds.length);
      stops.innerHTML=folds.map(stageFold).join('');
      for(const button of root.querySelectorAll('[data-trail-map]')) button.setAttribute('aria-pressed',Number(button.dataset.trailMap)===mapIndex);
    }
    if(selected!==entry) {
      cards.innerHTML=rankCards(entry);
      family.textContent=stage.badges.name;
      lesson.textContent=stage.name;
    }
    selected=entry;
    lastStage[mapIndex]=entry;
    ranks.set(stage.number,rank);
    for(const [i,fold] of maps[mapIndex].entries()) {
      if(!fold.open) continue;
      const button=stops.children[i], active=fold===entry;
      button.setAttribute('aria-pressed',active);
      const img=button.querySelector('img'), src=badgeArt(fold.stage,active?rank:fold.badgeRank);
      if(img.getAttribute('src')!==src) img.src=src;
    }
    for(const button of cards.querySelectorAll('button:enabled')) {
      button.setAttribute('aria-pressed',Number(button.dataset.trailRank)===rank);
    }
    caption.textContent=`Stage ${stage.number} · Badge ${rank} of ${BADGES_PER_STAGE}`;
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');
    if(!button || button.disabled) return;
    if(button.hasAttribute('data-trail-map')) show(lastStage[Number(button.dataset.trailMap)]);
    if(button.hasAttribute('data-trail-stage')) show(maps[mapIndex].find(entry=>entry.stage.number===Number(button.dataset.trailStage)));
    if(button.hasAttribute('data-trail-rank')) show(selected,Number(button.dataset.trailRank));
  });
  root.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
    const group=event.target.closest('[role="group"]');
    if(!group) return;
    const buttons=Array.from(group.querySelectorAll('button:enabled')), i=buttons.indexOf(event.target);
    if(i<0) return;
    const to={ArrowLeft:Math.max(0,i-1),ArrowRight:Math.min(buttons.length-1,i+1),Home:0,End:buttons.length-1}[event.key];
    event.preventDefault();
    buttons[to].focus();
    buttons[to].click();
  });
  show(initial);
}
