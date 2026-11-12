import {icon, forms, letterForm} from './drawings.js';
import {finaleScenery, launchFinale, cancelFinale} from './finale.js';
import {PROMPTS} from './voice-lines.js';
import {voiceFiles} from './assets/audio/narrator/catalogue.js';
import {WORDS, TALES, ALPHABET, CLASS_SOUNDS, KEY, DAY, clamp, newProfile, normalise, availableWords, findNext, getLevel, startLesson, collect, dueWords, reviewQueue, pictureChoices, recordRead, swapPairs, pathData} from './game.js';
const $ = (selector, root=document)=>root.querySelector(selector);
const main=$('#main');
const dialog=$('#dialog');
const sound = new Audio();
sound.preload='auto';
let blendCues={};
fetch('./assets/audio/blends/cues.json').then(r=>r.json()).then(cues=>{blendCues=cues;}).catch(()=>{});
let profile=readSaved();
let shelfOpen=matchMedia('(min-width: 720px)').matches;
let view='';
let lastFound=null;
let round=null;
let warm=false;
let swap=null;
let chosenSticker=null;
let lastRoute='';
let lastFocus=null;
let toastTimer=0;
let playbackId=0;
let audioTarget='';
let lastRevealRoute='';
let saveTrouble=false;
let guideTimer=0;

function readSaved() {
  try {return normalise(JSON.parse(localStorage.getItem(KEY)));} catch {return newProfile();}
}
function save() {
  try {localStorage.setItem(KEY,JSON.stringify(profile));}
  catch {if(!saveTrouble) notice('This browser could not save your album. You can download a copy in Grown-ups.'); saveTrouble=true;}
}
function notice(message) {
  const el=$('#toast'); el.textContent=message; el.hidden=false;
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.hidden=true,4200);
}
function announce(message) {$('#announcement').textContent=message;}
function stopSound() {
  playbackId++;
  sound.pause();
  sound.onended=null; sound.onerror=null; sound.onplaying=null;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  audioTarget='';
  document.querySelectorAll('.sounding').forEach(el=>el.classList.remove('sounding'));
}
function deviceVoice(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    const utterance=new SpeechSynthesisUtterance(text);
    utterance.lang='en-GB'; utterance.rate=.88;
    const voices=speechSynthesis.getVoices();
    utterance.voice=voices.find(v=>v.lang==='en-GB') || voices.find(v=>v.lang.startsWith('en')) || null;
    speechSynthesis.speak(utterance);
  } catch { /* Recorded letter and word buttons also work without a system voice. */ }
}
function narrate(id) {
  if(profile.settings.voice) playClip('prompts',id);
}
function playClip(type, name, options={}) {
  stopSound();
  const id=playbackId;
  audioTarget=type+':'+name;
  const els=type==='letters' ? document.querySelectorAll(`[data-letter="${name}"]`) : [];
  els.forEach(el=>el.classList.add('sounding'));
  const finish=()=>{
    if(id!==playbackId) return;
    els.forEach(el=>el.classList.remove('sounding')); audioTarget=''; options.end?.();
  };
  const local='./assets/audio/'+type+'/'+name+'.mp3';
  const sources=type==='words'?[voiceFiles['word-'+name],local]:
    type==='prompts' || type==='tales'?[voiceFiles[type==='tales'?'tale-'+name:name]]:[local];
  function trySource(index) {
    let handled=false;
    const failed=()=>{
      if(id!==playbackId || handled) return;
      handled=true;
      if(index+1<sources.length){trySource(index+1);return;}
      audioTarget='';els.forEach(el=>el.classList.remove('sounding'));
      if(type==='words') deviceVoice(name);
      else if(type==='prompts') deviceVoice(PROMPTS[name]);
      else if(type==='tales') deviceVoice(TALES[name]);
      else notice('That sound could not play. Tap the speaker to try again.');
    };
    sound.onended=finish;sound.onerror=failed;
    sound.src=sources[index];sound.playbackRate=options.rate || 1;
    sound.onplaying=()=>{if(id===playbackId) options.playing?.();};
    sound.play()?.catch(failed);
  }
  trySource(0);
}
function count() {return Object.keys(profile.cards).length;}
function eligibleLesson() {
  const l=profile.lesson;
  return l && (profile.cards[l.word] || availableWords(profile).includes(l.word));
}
function primaryAction() {
  // Cards that are due come before a new word. One finished round is enough until her next find.
  if(profile.settings.memoryFirst && !warm && dueWords(profile).length) return 'start-round';
  if(eligibleLesson() || findNext(profile)) return 'discover';
  return count()>1 ? 'review' : 'parents';
}
function startOrResume(word) {
  const next=word || (eligibleLesson()?profile.lesson.word:findNext(profile));
  if(!next) {go(count()?'review':'home'); return;}
  if (word || profile.lesson?.word!==next) startLesson(profile,next);
  save(); go('learn'); 
  narrate(profile.lesson.i===next.length?'blend-word':'sound-write');
}
function afterNavigate() {
  window.scrollTo({top:0,behavior:'instant'}); main.focus({preventScroll:true});
}
function go(route) {
  if(dialog.open) dialog.close();
  stopSound();
  if(location.hash.slice(1)!==route) {
    history.pushState(null,'','#'+route);
  }
  render(); afterNavigate();
}
function render() {
  cancelFinale();
  const raw=location.hash.slice(1);
  const [route,arg]=raw.split('/');
  view=route || 'home';
  if (view==='learn' && !profile.lesson) view='home';
  if (view==='found' && (!WORDS.includes(arg) || !profile.cards[arg])) view='album';
  if ((view==='scene' && count()<3) || (view==='swap' && !swapPairs(profile).length)) view='album';
  if (view==='round' && !round) view='review';
  if(!['home','learn','found','album','review','round','scene','swap'].includes(view)) view='home';
  if (view==='learn' && lastRoute!=='learn') shelfOpen=true;
  lastRoute=view;
  drawHeader(); drawShelf();
  const pages={home:homePage,learn:lessonPage,found:()=>foundPage(arg),album:albumPage,
    review:reviewPage,round:roundPage,scene:scenePage,swap:swapPage};
  main.innerHTML=pages[view]();
  if(view==='found' && profile.settings.sparkles && raw!==lastRevealRoute) launchFinale($('.found'));
  lastRevealRoute=view==='found'?raw:'';
  if(view==='learn') bindLesson();
  if(view==='scene') bindScene();
  document.title=({learn:'Sound & write',found:'Word found',album:'My word album',review:'Memory game',
    round:'Memory game',scene:'Story clearing',swap:'Sound swap'}[view] || 'The Word Woods')+' · Readling';
}
function drawHeader() {
  const tabs=[['home','compass','Play'],['album','album','Album'],['review','memory','Memory']];
  const active=['round','review','swap'].includes(view)?'review':['album','scene'].includes(view)?'album':'home';
  $('#masthead').innerHTML=`<div class="wrap mast-row">
    <button class="brand" data-act="home" aria-label="Readling home"><img src="./assets/readling.svg" alt="" width="40" height="40"><span>Readling</span></button>
    <nav class="tabs" aria-label="Game pages">${tabs.map(([route,sym,text])=>`<button class="tab ${active===route?'selected':''}" ${active===route?'aria-current="page"':''} data-act="${route}">${icon(sym,18)}<span>${text}</span></button>`).join('')}</nav>
    <div class="mast-end"><span class="stars" aria-label="${profile.stars} stars">${icon('star',21)} <b>${profile.stars}</b><span class="star-label"> stars</span></span>
    <span class="mast-rule"></span><button class="parents-link" data-act="parents" aria-label="Grown-ups and settings">${icon('gear',20)}<span>Grown-ups</span></button></div>
  </div>`;
}
function drawShelf() {
  $('#shelf').innerHTML=`<section class="wrap shelf ${shelfOpen?'open':''}" aria-label="Talking alphabet">
    <button class="shelf-toggle" data-act="shelf" aria-expanded="${shelfOpen}" aria-controls="letter-rack">${icon('sound',19)}
    <span>Sound shelf</span>${icon('down',14)}</button>
    <div id="letter-rack" class="letter-rack" ${shelfOpen?'':'hidden'}>${[...ALPHABET].map(c=>`<button class="key ${audioTarget==='letters:'+c?'sounding':''}" data-letter="${c}" aria-label="Hear ${c==='q'?'qu as in quit':c==='x'?'x as in box':c+' sound'}">${c==='q'?'q<small>u</small>':c}</button>`).join('')}</div>
    ${shelfOpen?'':'<span class="shelf-closed">a b c … z</span>'}
  </section>`;
}
function action(label,act,sym='arrow',style='primary') {
  return `<button type="button" class="btn ${style}" data-act="${act}">${sym==='play'?icon(sym,18):''}<span>${label}</span>${sym&&sym!=='play'?icon(sym,19):''}</button>`;
}
function back(act='home',label='Back to the woods') {
  return `<button class="back" data-act="${act}">${icon('back',16)} ${label}</button>`;
}
function wordImage(word,cls='') {
  return `<img class="word-art ${cls}" src="./assets/words/${word}.webp" alt="${word}" draggable="false">`;
}
function stamp(inside, kind='') {return `<span class="stamp ${kind}"><span class="stamp-face">${inside}</span></span>`;}
function homePage() {
  const n=count(), next=primaryAction(), shown=eligibleLesson()?profile.lesson.word:findNext(profile);
  const ready=dueWords(profile).length;
  const cta=next==='start-round'?'Play memory first':eligibleLesson()?'Continue my word':next==='parents'?'Choose sounds':next==='review'?'Play memory':n?'Find another word':'Start exploring';
  const heroMeta=next==='start-round'?ready+(ready===1?' card':' cards')+' ready to revisit':shown?'Discovery '+String(WORDS.indexOf(shown)+1).padStart(2,'0')+' / 12':n===12?'All 12 words discovered':'Woodland word collection';
  return `<section class="hero">
    <img class="hero-art" src="./assets/hero.webp" alt="A rabbit reading under an oak tree in the moonlit woods" fetchpriority="high">
    <div class="hero-content"><div class="hero-kicker">${icon('compass',17)}<span>${heroMeta}</span></div>
    <h1>The Word<br>Woods<span class="title-spark" aria-hidden="true">✦</span></h1>
    <p>Sound out a word, write its letters and discover what’s hiding in the woods.</p>
    ${action(cta,next,'play','gold')}</div>
  </section>
  <div class="section-heading"><h2>Your field kit</h2><span class="level">${icon('sprout',17)} Level ${getLevel(profile)}</span></div>
  <section class="kit-grid" aria-label="More ways to play">
    <button class="kit album-kit" data-act="album"><img src="./assets/album.webp" alt=""><span class="kit-copy"><strong>My word album</strong><span>Your book of woodland finds.</span><small>${n} of 12 collected</small></span><span class="circle-arrow">${icon('arrow',19)}</span></button>
    <button class="kit memory-kit" data-act="review"><img src="./assets/memory.webp" alt=""><span class="kit-copy"><strong>Memory game</strong><span>Turn a card and read it again.</span><small>${ready?ready+' ready to revisit':n>1?'Play with your words':n?'Find one more word to play':'Uses your collected words'}</small></span><span class="circle-arrow">${icon('arrow',19)}</span></button>
  </section>`;
}
function wordPrint(word,active=-1,options={}) {
  return `<div class="word-print ${options.cls || ''}" aria-label="${word}">${[...word].map((c,i)=>`<span class="grapheme ${i===active?'current':''} ${active>=0&&i<active?'finished':''}" data-pos="${i}">${letterForm(c)}<span class="letter-rule"></span></span>`).join('')}</div>`;
}
function inkPaths(lines) {
  return lines.map(line=>`<path d="${pathData(line)}"/>`).join('');
}
function lessonPage() {
  const l=profile.lesson, total=l.word.length;
  const isBlend=l.i===total;
  const top=`<div class="page-top">${back()}<span class="level">${icon('compass',16)} Word ${WORDS.indexOf(l.word)+1} of 12</span></div>`;
  if(isBlend) return top+`<section class="activity blend-activity">
    <div class="activity-heading"><div class="kicker">${icon('book',16)} Blend the sounds</div><h1>Say the whole word</h1>
    <p>Slide under the letters and read them together.</p></div>
    <div class="blend-work">${wordPrint(l.word,-1,{cls:'blend-print'})}
    <div class="blend-track" id="blend-track" role="slider" tabindex="0" aria-label="Blend from left to right" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="0"><span class="track-dots"></span><span class="track-thumb">${icon('arrow',21)}</span></div></div>
    <div class="actions centre">${action('Blend with me','blend-help','sound','secondary')}${action('Reveal my word','reveal','spark')}</div>
    </section>`;
  const c=l.word[l.i];
  const paths=forms[c];
  const dot=paths[0].match(/^M(\d+) (\d+)/);
  return top+`<section class="activity lesson-activity">
    <div class="activity-heading"><div class="kicker">${icon('pen',16)} Sound ${l.i+1} of ${total}</div><h1>Sound &amp; write</h1></div>
    <div class="lesson-grid"><div class="task-label"><div class="instruction-title"><span class="step-token">1</span><h2>Say the sound</h2></div>
      <button class="btn secondary" data-act="letter-help">${icon('sound',19)} Hear sound</button></div>
      ${wordPrint(l.word,l.i,{cls:'copy-word'})}
    <div class="task-label"><div class="instruction-title"><span class="step-token">2</span><h2>Write <span class="inline-letter">${c}</span></h2></div>
      <div class="ink-tools"><button data-act="show-stroke">${icon('pen',16)} Show stroke</button><button data-act="clear-ink">${icon('repeat',16)} Clear</button></div></div>
    <div class="pad-row">${[...l.word].map((ch,j)=>j!==l.i?`<div class="rest-pad" aria-hidden="true"><svg viewBox="0 0 180 138"><path class="rest-line" d="M0 95H180"/><g class="ink-lines">${inkPaths(l.ink[j])}</g></svg></div>`:
      `<div class="ink-box"><svg id="inkpad" viewBox="0 0 180 138" role="img" aria-label="Write a lowercase ${c} here with your stylus or finger">
        <path class="midline" d="M0 48H180"/><path class="baseline" d="M0 95H180"/>
        <g transform="translate(42 0)" class="guide-lines">${paths.map(d=>`<path d="${d}"/>`).join('')}</g>
        <g transform="translate(42 0)" class="stroke-demo" aria-hidden="true">${paths.map((d,i)=>`<path pathLength="1" style="--delay:${i*.75}s" d="${d}"/>`).join('')}</g>
        <circle class="start-dot" cx="${42+Number(dot[1])}" cy="${dot[2]}" r="4.4"/>
        <g class="ink-lines">${inkPaths(l.ink[l.i])}</g>
      </svg></div>`).join('')}
    </div></div>
    <div class="activity-bottom"><span class="progress-dots" aria-label="Sound ${l.i+1} of ${total}">${[...l.word].map((_,i)=>`<i class="${i<=l.i?'filled':''}"></i>`).join('')}</span>
    ${action(l.i===total-1?'Blend my word':'Next sound','next-sound')}</div></section>`;
}
function foundPage(word) {
  const fresh=lastFound?.word===word && lastFound.fresh;
  const lvl=fresh && lastFound.levelUp;
  const next=primaryAction();
  return `<div class="page-top">${back()}<span class="level">${icon('sprout',17)} Level ${getLevel(profile)}</span></div>
    <section class="found activity ${profile.settings.sparkles?'victory':''}"><div class="kicker">${icon('spark',17)} ${fresh?'New discovery':'In your album'}</div>
      <h1>${fresh?'Look what you found!':'A woodland find'}</h1>
      <div class="show-stage">${profile.settings.sparkles?finaleScenery():''}<div class="reveal-art">${stamp(wordImage(word))}</div></div>
      <div class="found-word"><strong>${word}</strong><button class="round-button" data-act="read-word" data-word="${word}" aria-label="Hear ${word}">${icon('sound',20)}</button></div>
      <p>${TALES[word]}</p>${inkLabel(word)}
      ${fresh?`<div class="reward">${icon('star',17)} +5 stars ${lvl?`<span>· Level ${getLevel(profile)}!</span>`:''}</div>`:''}
      ${lvl&&count()===3?'<p class="unlock-note">Your story clearing is open. Play with your finds in the album.</p>':''}
      <div class="actions centre">${action('My album','album','album','secondary')}${profile.settings.sparkles?action('Encore!','encore','spark','gold'):''}${next==='start-round'?action('Play memory first',next):next==='discover'?action('Find another word',next):action('Play memory','review')}</div></section>`;
}
function inkLabel(word) {
  const ink=profile.cards[word]?.ink;
  if(!ink?.some(lines=>lines.length)) return '';
  return `<div class="handwritten" role="img" aria-label="Your handwriting for ${word}">${[...word].map((c,i)=>ink[i].length?
    `<svg viewBox="0 0 180 138" aria-hidden="true"><g class="ink-lines">${inkPaths(ink[i])}</g></svg>`:letterForm(c)).join('')}</div>`;
}
function albumPage() {
  const n=count(), next=primaryAction();
  return `<div class="page-top">${back()}<span class="level">${icon('album',17)} ${n} / 12 collected</span></div>
    <div class="album-head"><div><h1>My word album</h1><p>${n?'Tap a find to hear its word and see your writing.':'Each word you discover earns a place on these pages.'}</p></div>
    ${next==='start-round'?action('Play memory first',next,'play'):n<12 && next==='discover'?action(n?'Find a word':'Find my first word','discover','play'):''}</div>
    <div class="album-grid">${WORDS.map((word,i)=>{
      const found=!!profile.cards[word];
      return found?`<button class="album-card" data-act="card" data-word="${word}">${stamp(wordImage(word))}<strong>${word}</strong></button>`:
        `<div class="album-card missing" aria-label="Undiscovered word ${i+1}">${stamp(icon('leaf',35),'hidden-stamp')}<small>Word ${String(i+1).padStart(2,'0')}</small></div>`;
    }).join('')}</div>
    <div class="album-extra"><div>${icon('sprout',28)}<span><strong>Story clearing</strong><small>${n>=3?'Make a scene with your collected words.':'Opens when you collect 3 words.'}</small></span></div>
    ${n>=3?action('Make a scene','scene','arrow','secondary'):icon('lock',21)}</div>`;
}
function reviewPage() {
  const n=count(), due=dueWords(profile).length, deal=Math.min(4,due||n), next=primaryAction();
  const pairs=swapPairs(profile);
  return `<div class="page-top">${back()}<span class="level">${icon('memory',17)} ${n} ${n===1?'card':'cards'}</span></div>
    <section class="review-intro activity"><img class="mode-art" src="./assets/memory.webp" alt="">
      <h1>Memory game</h1><p>${n>1?'Say the word on a card, turn it over, then tap its picture.':n?'Memory needs two words. Find one more to play.':'Find a word in the woods to make your first memory card.'}</p>
      ${n>1?`<div class="round-meta">${icon('repeat',16)} ${due?due+' ready to revisit':'A practice round'} · Up to ${deal} ${deal===1?'card':'cards'}</div>`:''}
      ${n>1?action('Play a round','start-round','play'):action(next==='parents'?'Choose class sounds':n?'Find another word':'Find my first word',next,'play')}
    </section>
    ${pairs.length?`<button class="mode-row" data-act="start-swap">${icon('pen',26)}<span><strong>Sound swap</strong><small>Change one sound to make a new word.</small></span>${icon('arrow',21)}</button>`:''}`;
}
function dealCard() {
  Object.assign(round,{turned:false,solved:false,heard:false,asked:'',first:null,unaided:false,tried:[],
    options:pictureChoices(profile,round.words[round.i])});
  // Fetch the pictures while she reads, so they are ready the moment the card turns.
  for(const o of round.options) new Image().src='./assets/words/'+o+'.webp';
}
function roundPage() {
  if(round.i>=round.words.length) {
    const onward=primaryAction()==='discover';
    return `<div class="page-top">${back('review','Back to memory')}</div><section class="activity round-done">
    ${icon('star',56)}<h1>Round complete!</h1><p>You revisited ${round.words.length} ${round.words.length===1?'word':'words'} and earned ${round.words.length} ${round.words.length===1?'star':'stars'}.</p>
    <div class="mini-cards">${round.words.map(w=>wordImage(w)).join('')}</div>
    <div class="actions centre">${action('Back to the woods','home','home','secondary')}${action('Play again','start-round','repeat',onward?'secondary':'primary')}
    ${onward?action(eligibleLesson()?'Continue my word':'Find another word','discover'):''}</div></section>`;
  }
  const w=round.words[round.i];
  const top=`<div class="page-top">${back('review','Back to memory')}<span class="level">${icon('memory',16)} Card ${round.i+1} of ${round.words.length}</span></div>
    <section class="activity round-card"><div class="kicker">${icon('memory',16)} Memory game</div>`;
  if(round.solved) return top+`<h1>${round.unaided?'You read it!':'You found it!'}</h1>
    <div class="turned">${stamp(wordImage(w))}<strong>${w}</strong></div>
    <div class="actions centre">${action(round.i+1<round.words.length?'Next card':'Finish round','next-card')}</div></section>`;
  // The pictures stay hidden until she has tried the print, so they cannot do the reading for her.
  if(round.turned) return top+`<h1>Which one is it?</h1>
    <div class="read-card">${wordPrint(w)}</div>
    <div class="swap-prompt"><p>Tap the picture for your word.</p></div>
    <div class="picture-picks">${round.options.map(o=>{
      const tried=round.tried.includes(o);
      return `<button class="picture-pick ${tried?'try-again':''}" data-act="pick" data-word="${o}" ${tried?'disabled':''}>${stamp(wordImage(o))}</button>`;
    }).join('')}</div>
    <div class="actions centre">${action('Read with me','review-help','sound','secondary')}</div></section>`;
  return top+`<h1>Can you read it?</h1>
    <button class="face-down" data-act="flip" aria-label="Read ${w} and turn the card">${wordPrint(w)}<span>${icon('flip',18)} Tap to turn</span></button>
    <div class="actions centre">${action('Read with me','review-help','sound','secondary')}${action('Turn my card','flip','flip')}</div></section>`;
}
function scenePage() {
  return `<div class="page-top">${back('album','Back to my album')}</div><div class="album-head"><div><h1>Story clearing</h1><p>Choose a find, then tap the clearing to place it. Drag it to move it.</p></div></div>
    <div id="clearing" class="clearing" role="group" aria-label="Place a word here" tabindex="0">
    <div class="horizon" aria-hidden="true"></div>${profile.scene.map((s,i)=>`<button class="scene-piece" aria-label="Move ${s.word}" data-piece="${i}" style="left:${s.x}%;top:${s.y}%">${wordImage(s.word)}</button>`).join('')}</div>
    <div class="scene-tools">${WORDS.filter(w=>profile.cards[w]).map(w=>`<button class="piece-pick ${chosenSticker===w?'chosen':''}" data-act="choose-piece" data-word="${w}" aria-pressed="${chosenSticker===w}">${wordImage(w)}${w}</button>`).join('')}
    <button class="undo-piece" data-act="undo-piece" ${profile.scene.length?'':'disabled'}>${icon('repeat',18)} Undo last find</button></div>`;
}
function swapPage() {
  if(!swap) newSwap();
  const {a,b,i,options,solved}=swap;
  return `<div class="page-top">${back('review','Back to memory')}</div><section class="activity swap-page"><div class="kicker">${icon('pen',16)} Sound swap</div>
    <h1>${solved?'A new word!':'Change one sound'}</h1>
    ${solved?`<div class="swap-pair">${wordImage(a)}${icon('arrow',25)}${wordImage(b)}</div>${wordPrint(b,i)}<div class="actions centre">${action('Hear it','swap-read','sound','secondary')}${action('Swap again','start-swap','repeat')}</div>`:
    `${wordPrint(a,i)}<div class="swap-prompt"><p>Which letter makes this sound?</p><button class="round-button" data-act="swap-sound" aria-label="Play the new sound">${icon('sound',22)}</button></div>
    <div class="swap-tiles">${options.map(c=>`<button class="swap-tile" data-act="swap-letter" data-choice="${c}">${letterForm(c)}<span class="sr-only">${c}</span></button>`).join('')}</div>`}</section>`;
}
function newSwap() {
  const pairs=swapPairs(profile); if(!pairs.length) return;
  const pair=pairs[Math.floor(Math.random()*pairs.length)];
  const [a,b]=Math.random()<.5?pair:[pair[1],pair[0]];
  const i=[...a].findIndex((c,j)=>c!==b[j]);
  const distractors=[...new Set(Object.keys(profile.cards).join('')+CLASS_SOUNDS)].filter(c=>c!==b[i] && c!==a[i]);
  const options=[b[i],...distractors.slice(0,2)];
  for(let j=options.length-1;j>0;j--){const k=Math.floor(Math.random()*(j+1));[options[j],options[k]]=[options[k],options[j]];}
  swap={a,b,i,options,solved:false};
}
function bindLesson() {
  const pad=$('#inkpad'), track=$('#blend-track');
  if(track) {bindBlend(track);return;}
  if(!pad) return;
  let pointer=null, points=null, path=null;
  const l=profile.lesson, i=l.i;
  const addPoint=e=>{
    const m=pad.getScreenCTM(); if(!m) return;
    const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());
    const x=clamp(Math.round(point.x*10)/10,0,180), y=clamp(Math.round(point.y*10)/10,0,138);
    const prev=points.at(-1);
    if(prev && Math.hypot(x-prev[0],y-prev[1])<.65) return;
    if(points.length<900) points.push([x,y]);
  };
  pad.addEventListener('pointerdown', e=>{
    if(e.button!==0 || pointer!==null || l.ink[i].length>=40) return;
    e.preventDefault(); pad.classList.remove('demonstrate'); pointer=e.pointerId; pad.setPointerCapture(pointer);
    points=[]; addPoint(e); path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',pathData(points)); $('.ink-lines',pad).append(path); l.ink[i].push(points);
  });
  pad.addEventListener('pointermove', e=>{
    if(e.pointerId!==pointer) return;
    const events=e.getCoalescedEvents?.();
    for(const p of (events?.length?events:[e])) addPoint(p);
    path.setAttribute('d',pathData(points));
  });
  function endStroke(e) {
    if(e.pointerId!==pointer) return;
    if(e.type==='pointerup') addPoint(e);
    path.setAttribute('d',pathData(points)); pointer=null; save();
  }
  pad.addEventListener('pointerup',endStroke); pad.addEventListener('pointercancel',endStroke);
  pad.addEventListener('lostpointercapture',endStroke);
}
function slideTo(frac) {
  const track=$('#blend-track'); if(!track) return;
  const amount=clamp(frac,0,1), steps=profile.lesson.word.length;
  track.style.setProperty('--slide',amount);
  const reached=amount===0?0:Math.min(steps,Math.ceil(amount*steps));
  track.setAttribute('aria-valuenow',String(reached));
  $('.blend-print').querySelectorAll('.grapheme').forEach((el,i)=>el.classList.toggle('blended',i<reached));
}
function bindBlend(track) {
  let pointer=null;
  const move=e=>{const r=track.getBoundingClientRect();slideTo((e.clientX-r.left-20)/Math.max(1,r.width-40));};
  track.addEventListener('pointerdown',e=>{if(e.button!==0 || pointer!==null)return;
    stopSound();pointer=e.pointerId;track.setPointerCapture(pointer);move(e);});
  track.addEventListener('pointermove',e=>{if(pointer===e.pointerId) move(e);});
  const end=e=>{if(pointer===e.pointerId)pointer=null;};
  track.addEventListener('pointerup',end);track.addEventListener('pointercancel',end);
  track.addEventListener('keydown',e=>{
    const delta=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;
    if(!delta && !['Home','End',' '].includes(e.key)) return;
    e.preventDefault();const n=profile.lesson.word.length;
    slideTo(delta?(Number(track.getAttribute('aria-valuenow'))+delta)/n:e.key==='Home'?0:1);
  });
}
function guideBlend() {
  const l=profile.lesson;if(!l || l.i!==l.word.length) return;
  l.help=true;save();slideTo(0);
  playClip('blends',l.word,{end:()=>slideTo(1),playing:()=>{
    const id=playbackId, end=sound.duration;
    if(!Number.isFinite(end) || end<=0) return;
    const [second,third]=blendCues[l.word] || [end/3,end*2/3];
    const boundaries=[0,second,third,end];
    const frame=()=>{
      if(playbackId!==id || view!=='learn' || sound.ended) return;
      const t=sound.currentTime, i=t<second?0:t<third?1:2;
      const within=clamp((t-boundaries[i])/(boundaries[i+1]-boundaries[i]),0,1);
      slideTo((i+within)/3);
      requestAnimationFrame(frame);
    };requestAnimationFrame(frame);
  }});
}
function traceDemo() {
  const pad=$('#inkpad'); if(!pad) return;
  pad.classList.remove('demonstrate');
  void pad.getBoundingClientRect();
  pad.classList.add('demonstrate'); clearTimeout(guideTimer);
  guideTimer=setTimeout(()=>pad.classList.remove('demonstrate'),2500);
}
function useSound(c) {
  if(!ALPHABET.includes(c) || c.length!==1) return;
  if(view==='learn' && profile.lesson && profile.lesson.word.includes(c)) {profile.lesson.help=true;save();}
  if(view==='round' && round && !round.first && round.words[round.i]?.includes(c) && !round.asked.includes(c)) round.asked+=c;
  playClip('letters',c);
}
function openDialog(html, label) {
  if(!dialog.open) lastFocus=document.activeElement;
  $('#dialog-content').innerHTML=`<div class="dialog-top"><h2 id="dialog-title">${label}</h2><button class="round-button" data-act="dismiss" aria-label="Close">${icon('close',19)}</button></div>${html}`;
  dialog.setAttribute('aria-labelledby','dialog-title');
  if(!dialog.open) dialog.showModal();
}
function soundProgress() {
  const now=Date.now(), sounds=Object.keys(profile.sounds).sort();
  return `<details class="parent-details"><summary>Sound progress (${sounds.length} of ${CLASS_SOUNDS.length})</summary>
    ${sounds.length?`<ul>${sounds.map(c=>{
      const s=profile.sounds[c], wait=s.due-now, days=Math.round(wait/DAY);
      return `<li><strong>${c}</strong><span>${s.right} unaided · ${s.wrong} ${s.wrong===1?'slip':'slips'} · ${wait<=0?'ready now':wait<DAY/2?'back soon':'back in '+days+(days===1?' day':' days')}</span></li>`;
    }).join('')}</ul>`:'<p>The sounds in her first word will appear here.</p>'}
    <p>Memory needs two words. A new word comes back after two minutes. She reads the card, turns it, then taps its picture among look-alikes from her album. Only her first tap counts. When it is right with no hints, each sound in the word that was due rests for one day, then three, seven, fourteen and thirty. A wrong picture or a tap on the sound shelf is a slip. Those sounds return in two minutes, in the missed word and in another word that uses them when she has one.</p></details>`;
}
function parents() {
  stopSound();cancelFinale();
  openDialog(`<p class="dialog-intro">Progress is saved in this browser. You can take a copy to her other tablet below.</p>
    <fieldset><legend>Play settings</legend><label class="setting-line"><span>Spoken instructions</span><input type="checkbox" data-setting="voice" ${profile.settings.voice?'checked':''}></label>
    <label class="setting-line"><span>Rainbow celebration</span><input type="checkbox" data-setting="sparkles" ${profile.settings.sparkles?'checked':''}></label>
    <label class="setting-line"><span>Victory fanfare</span><input type="checkbox" data-setting="fanfare" ${profile.settings.fanfare?'checked':''}></label>
    <label class="setting-line"><span>Memory cards before a new word</span><input type="checkbox" data-setting="memoryFirst" ${profile.settings.memoryFirst?'checked':''}></label></fieldset>
    <fieldset><legend>Sounds covered in class</legend><p>Choose the sounds she has met. New words use only these sounds.</p>
    <div class="sound-checks">${[...CLASS_SOUNDS].map(c=>`<label><input type="checkbox" data-class-sound="${c}" ${profile.settings.sounds.includes(c)?'checked':''}><span>${c}</span></label>`).join('')}</div>
    <small id="available-count">${availableWords(profile).length} of 12 words available</small></fieldset>
    <details class="parent-details"><summary>Word progress (${count()} of 12)</summary>
    ${count()?`<ul>${WORDS.filter(w=>profile.cards[w]).map(w=>{const c=profile.cards[w];return `<li><strong>${w}</strong><span>${c.reviews} ${c.reviews===1?'review':'reviews'} · ${c.assisted?'Practised with help':'No hint recorded'}</span></li>`;}).join('')}</ul>`:
    '<p>Her first discovery will appear here.</p>'}</details>
    ${soundProgress()}
    <fieldset><legend>Move an album</legend><p>Download a copy here, open this Site on the other tablet and import it there. Importing combines the two collections.</p>
    <div class="actions">${action('Download album','export','','secondary')}${action('Import album','import','','secondary')}</div><input type="file" id="file-picker" accept="application/json,.json" hidden></fieldset>
    <p class="credits"><a href="./assets/audio/CREDITS.txt" target="_blank" rel="noopener">Audio credits</a></p>`, 'Grown-ups');
}
function showCard(w) {
  if(!profile.cards[w]) return;
  openDialog(`<div class="card-dialog">${stamp(wordImage(w))}${inkLabel(w)}<p>${TALES[w]}</p>
    <div class="actions centre"><button class="btn secondary" data-act="read-word" data-word="${w}">${icon('sound',18)} Hear word</button>
    <button class="btn secondary" data-act="read-tale" data-word="${w}">${icon('book',17)} Read the story</button>
    <button class="btn primary" data-act="rewrite" data-word="${w}">${icon('pen',17)} Write again</button>
    ${profile.settings.sparkles?`<button class="btn gold" data-act="album-encore" data-word="${w}">${icon('spark',17)} Encore!</button>`:''}</div></div>`,w);
  playClip('words',w);
}
function exportAlbum() {
  const blob=new Blob([JSON.stringify({format:'readling-album',profile},null,0)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='readling-word-album.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function importAlbum(file) {
  if(!file) return;
  try {
    if(file.size>12e6) throw Error();
    const backup=JSON.parse(await file.text());
    if(backup?.format!=='readling-album' || backup.profile?.version!==1 || !backup.profile.cards) throw Error();
    const other=normalise(backup.profile), wasEmpty=!count();
    for (const w of WORDS) {
      const theirs=other.cards[w], ours=profile.cards[w];
      if(theirs && (!ours || Math.max(theirs.found,theirs.reviewed)>Math.max(ours.found,ours.reviewed))) profile.cards[w]=theirs;
    }
    for (const c of CLASS_SOUNDS) {
      const theirs=other.sounds[c], ours=profile.sounds[c];
      if(theirs && (!ours || theirs.seen>ours.seen)) profile.sounds[c]=theirs;
    }
    profile.stars=Math.max(profile.stars,other.stars,count()*5);
    if(wasEmpty) {profile.settings=other.settings;profile.lesson=other.lesson;profile.scene=other.scene;}
    save();render();parents();notice('Album imported. Your finds are ready.');
  } catch {notice('Choose a Readling album file downloaded from Grown-ups.');}
}
function bindScene() {
  const board=$('#clearing');
  let drag=null;
  function coords(ex,ey) {
    const r=board.getBoundingClientRect();
    return {x:clamp((ex-r.left)*100/r.width,8,92),y:clamp((ey-r.top)*100/r.height,12,88)};
  }
  function place(pos) {
    if(!chosenSticker) {announce('Choose a find below the clearing.');return;}
    if(profile.scene.length>=16) {notice('The clearing is full. Undo a find to make room.');return;}
    profile.scene.push({word:chosenSticker,...pos});playClip('words',chosenSticker);chosenSticker=null;save();render();
  }
  board.addEventListener('pointerdown',e=>{
    if(e.button!==0 || drag) return;
    const el=e.target.closest('[data-piece]');
    if(!el) {place(coords(e.clientX,e.clientY));return;}
    e.preventDefault();
    drag={el,i:Number(el.dataset.piece),pid:e.pointerId};
    el.setPointerCapture(e.pointerId);
  });
  board.addEventListener('pointermove',e=>{
    if(!drag || drag.pid!==e.pointerId) return;
    const pos=coords(e.clientX,e.clientY);Object.assign(profile.scene[drag.i],pos);
    drag.el.style.left=pos.x+'%';drag.el.style.top=pos.y+'%';
  });
  board.addEventListener('pointerup',e=>{if(drag?.pid===e.pointerId){drag=null;save();}});
  board.addEventListener('pointercancel',()=>{drag=null;save();});
  board.addEventListener('keydown',e=>{
    if(e.target===board && ['Enter',' '].includes(e.key)){e.preventDefault();place({x:50,y:55});return;}
    const el=e.target.closest('[data-piece]'), delta={ArrowRight:[4,0],ArrowLeft:[-4,0],ArrowDown:[0,4],ArrowUp:[0,-4]}[e.key];
    if(el && delta) {
      e.preventDefault();const s=profile.scene[Number(el.dataset.piece)];
      s.x=clamp(s.x+delta[0],8,92);s.y=clamp(s.y+delta[1],12,88);
      el.style.left=s.x+'%';el.style.top=s.y+'%'; save();
    }
  });
}
function dispatch(act,el) {
  switch(act) {
    case 'home':case 'album':case 'review':case 'scene':go(act);break;
    case 'shelf':shelfOpen=!shelfOpen;drawShelf();$('.shelf-toggle').focus({preventScroll:true});break;
    case 'parents':parents();break;
    case 'dismiss':dialog.close();break;
    case 'discover':startOrResume();break;
    case 'letter-help':useSound(profile.lesson.word[profile.lesson.i]);break;
    case 'show-stroke':traceDemo();break;
    case 'clear-ink':profile.lesson.ink[profile.lesson.i]=[];$('.ink-lines',$('#inkpad')).replaceChildren();save();break;
    case 'next-sound': {
      stopSound();const l=profile.lesson;
      if(!l || l.i>=l.word.length) break;
      l.i++;save();render();main.focus({preventScroll:true});
      if(l.i===l.word.length) {afterNavigate();narrate('blend-word');}
      else {announce(`Sound ${l.i+1}. Say the sound, then write.`);}
      break;
    }
    case 'blend-help':guideBlend();break;
    case 'reveal':{
      const found=collect(profile); if(!found) break;
      if(found.fresh) warm=false;
      lastFound=found;save();go('found/'+found.word);playClip('words',found.word,{end:playFanfare});break;
    }
    case 'encore':launchFinale($('.found'));playFanfare();break;
    case 'album-encore':if(profile.cards[el.dataset.word]){lastFound=null;go('found/'+el.dataset.word);playFanfare();}break;
    case 'read-tale':if(profile.cards[el.dataset.word])playClip('tales',el.dataset.word);break;
    case 'read-word':if(WORDS.includes(el.dataset.word)) playClip('words',el.dataset.word);break;
    case 'card':showCard(el.dataset.word);break;
    case 'rewrite':if(profile.cards[el.dataset.word])startOrResume(el.dataset.word);break;
    case 'start-round':{
      const words=reviewQueue(profile);if(!words.length){startOrResume();break;}
      round={words,i:0};dealCard();go('round');narrate('memory-start');break;
    }
    case 'review-help':{
      const w=round?.words[round.i];if(!w)break;
      if(!round.first)round.heard=true;
      playClip('words',w);break;
    }
    case 'flip':if(!round || round.turned)break;stopSound();round.turned=true;render();main.focus({preventScroll:true});break;
    case 'pick':{
      const w=round?.words[round.i], choice=el.dataset.word;
      if(!w || !round.turned || round.solved || !round.options.includes(choice) || round.tried.includes(choice)) break;
      // Only her first tap is recorded. After a slip she hears the slow blend and tries again.
      if(!round.first) {
        round.first=choice;
        round.unaided=recordRead(profile,w,{picked:choice,asked:round.asked,heard:round.heard});save();
      }
      if(choice===w) {round.solved=true;render();main.focus({preventScroll:true});playClip('words',w);}
      else {
        round.tried.push(choice);el.classList.add('try-again');el.disabled=true;drawHeader();
        announce('Listen, then try another picture.');playClip('blends',w);
      }
      break;
    }
    case 'next-card':{
      if(!round?.solved) break;
      stopSound();round.i++;
      if(round.i<round.words.length) dealCard(); else warm=true;
      render();main.focus({preventScroll:true});if(round.i===round.words.length)narrate('round-done');break;
    }
    case 'start-swap':if(swapPairs(profile).length){newSwap();go('swap');playClip('letters',swap.b[swap.i]);}break;
    case 'swap-sound':playClip('letters',swap.b[swap.i]);break;
    case 'swap-read':playClip('words',swap.b);break;
    case 'swap-letter':{
      if(el.dataset.choice===swap.b[swap.i]){swap.solved=true;render();playClip('words',swap.b);}
      else {playClip('letters',el.dataset.choice);announce('Listen again and try another letter.');el.classList.add('try-again');}
      break;
    }
    case 'choose-piece':chosenSticker=el.dataset.word;render();playClip('words',chosenSticker);break;
    case 'undo-piece':profile.scene.pop();save();render();break;
    case 'export':exportAlbum();break;
    case 'import':$('#file-picker').click();break;
  }
}
document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.dataset.letter) useSound(el.dataset.letter);
  else if(el.dataset.act) dispatch(el.dataset.act,el);
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.setting){profile.settings[el.dataset.setting]=el.checked;save();if(!profile.settings.voice)stopSound();}
  if(el.dataset.setting==='sparkles' && view==='found') render();
  if(el.dataset.classSound) {
    const allowed=new Set(profile.settings.sounds);
    if(el.checked) allowed.add(el.dataset.classSound);else allowed.delete(el.dataset.classSound);
    profile.settings.sounds=[...CLASS_SOUNDS].filter(c=>allowed.has(c)).join('');save();
    $('#available-count').textContent=availableWords(profile).length+' of 12 words available';
  }
  if(el.id==='file-picker') void importAlbum(el.files[0]);
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();}});
function playFanfare() {
  if(view==='found' && profile.settings.sparkles && profile.settings.fanfare && !dialog.open && !document.hidden) playClip('music','fanfare');
}
dialog.addEventListener('close',()=>{if(view==='home'||view==='album'||(view==='found' && $('.found').classList.contains('victory')!==profile.settings.sparkles))render();lastFocus?.isConnected&&lastFocus.focus({preventScroll:true});});
window.addEventListener('popstate',()=>{stopSound();if(dialog.open)dialog.close();render();afterNavigate();});
window.addEventListener('storage',e=>{if(e.key===KEY && !dialog.open){try{profile=normalise(JSON.parse(e.newValue));render();}catch{/* Keep the current album. */}}});
render();
