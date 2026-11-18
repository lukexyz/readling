import {icon, forms, letterForm} from './drawings.js';
import {finaleScenery, launchFinale, cancelFinale, planShow} from './finale.js';
import {mountCelebrationCards} from './celebration-cards.js';
import {PROMPTS} from './voice-lines.js';
import {voiceFiles} from './assets/audio/narrator/catalogue.js';
import {SOUNDS,displaySound} from './phonics.js';
import {WORDS, TALES, STAGES, ENTRIES, unitsOf, soundsOf, ALPHABET, CLASS_SOUNDS, KEY, DAY, SHOW, SHOW_GROUPS, BADGES_PER_STAGE, clamp, newProfile, normalise, stageProgress, availableWords, findNext, getLevel, startLesson, collect, dueWords, reviewQueue, pictureChoices, recordRead, finishTask, showChoices, showDue, addToShow, mergeAlbum, packAlbum, swapPairs, pathData} from './game.js';
import {cloud} from './cloud.js';
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
let classChanged=false;
let guideTimer=0;
let account=null;
let watching=false;
let syncing=false;
let syncAgain=false;
let syncTimer=0;
let syncTrouble=false;
let playing=null;
let starsHeld=0;
let encores=0;
let previewTimer=0;
let stickerCards=null;
let showPicks=null;
let trial=null;
let trialRosette=false;
let trialTimeline=true;

function readSaved() {
  try {return normalise(JSON.parse(localStorage.getItem(KEY)));} catch {return newProfile();}
}
function store() {
  try {localStorage.setItem(KEY,JSON.stringify(profile));}
  catch {
    try {localStorage.setItem(KEY,packAlbum(profile,1500000));}
    catch {if(!saveTrouble) notice('This browser could not save your album. You can download a copy in Grown-ups.'); saveTrouble=true;}
  }
}
function save() {
  store();
  if(account) {clearTimeout(syncTimer);syncTimer=setTimeout(sync,2000);}
}
// Saving to Google reads the saved copy first and combines it with this tablet's album,
// so two tablets that have both been played on never overwrite each other.
async function sync() {
  clearTimeout(syncTimer);
  if(!account) return;
  if(syncing) {syncAgain=true;return;}
  syncing=true;
  let trouble=false;
  try {
    const theirs=await cloud.load(), was=JSON.stringify(profile);
    if(theirs) mergeAlbum(profile,normalise(JSON.parse(theirs)));
    if(JSON.stringify(profile)!==was) {
      store();
      // A page she may be in the middle of is left alone and shows the new finds on her next move.
      if(!dialog.open && ['home','album','review','stickers'].includes(view)) render(); else drawHeader();
    }
    const ours=packAlbum(profile);
    if(ours!==theirs) await cloud.save(ours);
  } catch {trouble=!!account;}
  syncing=false;
  if(trouble!==syncTrouble) {syncTrouble=trouble;drawAccount();}
  if(syncAgain) {syncAgain=false;sync();}
}
function watchAccount() {
  if(!cloud.on || watching) return;
  watching=true;
  cloud.watch(user=>{
    account=user;syncTrouble=false;drawAccount();
    if(user) {$('#save-invite')?.remove();sync();}
  }).catch(()=>{watching=false;syncTrouble=cloud.remembered();drawAccount();});
}
// When the tablet wakes or comes back online, fetch what her other tablet saved and send what this one could not.
function wake() {
  if(cloud.remembered()) {watchAccount();sync();}
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
function narrate(id,options) {
  if(profile.settings.voice) playClip('prompts',id,options);
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
  const local='./assets/audio/'+type+'/'+(type==='letters'?SOUNDS[name].audio:name)+'.mp3';
  const sources=(type==='words'?[voiceFiles['word-'+name],local]:
    type==='tales'?[voiceFiles['tale-'+name] || local]:type==='prompts'?[voiceFiles[name]]:[local]).filter(Boolean);
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
function latestFind() {
  return Object.keys(profile.cards).sort((a,b)=>profile.cards[b].found-profile.cards[a].found)[0] || '';
}
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
  if ((word || profile.lesson?.word!==next) && !startLesson(profile,next)) return;
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
  stickerCards?.destroy();stickerCards=null;
  cancelFinale();clearTimeout(previewTimer);playing=null;
  const raw=location.hash.slice(1);
  const [route,arg]=raw.split('/');
  view=route || 'home';
  if (view==='learn' && !profile.lesson) view='home';
  if (view==='learn' && !eligibleLesson()) view='home';
  if (view==='found' && (!WORDS.includes(arg) || !profile.cards[arg])) view='album';
  if ((view==='scene' && count()<3) || (view==='swap' && !swapPairs(profile).length)) view='album';
  if (view==='round' && !round) view='review';
  if(!['home','learn','found','album','stickers','review','round','scene','swap'].includes(view)) view='home';
  if (view==='learn' && lastRoute!=='learn') shelfOpen=true;
  lastRoute=view;
  drawHeader(); drawShelf();
  const pages={home:homePage,learn:lessonPage,found:()=>foundPage(arg),album:albumPage,stickers:stickersPage,
    review:reviewPage,round:roundPage,scene:scenePage,swap:swapPage};
  main.innerHTML=pages[view]();
  if(view==='found' && raw!==lastRevealRoute) {
    const fresh=lastFound?.word===arg && lastFound.fresh;
    const rank=fresh?revealBadge(lastFound):0;
    celebrate({word:arg,stars:fresh?5:0,held:fresh,tier:rank,badgeSrc:rank?badgeArt(stageOf(arg),rank):''});
  }
  lastRevealRoute=view==='found'?raw:'';
  if(view==='learn') bindLesson();
  if(view==='scene') bindScene();
  if(view==='stickers' && profile.show.picks.length) {
    const picks=profile.show.picks, earned=SHOW.filter(s=>picks.includes(s.id));
    stickerCards=mountCelebrationCards($('#sticker-cards'),earned,{
      picks, finds:Object.keys(profile.cards), word:latestFind() || 'cat', musicEnabled:()=>profile.settings.fanfare
    });
  }
  // Fetch the Google libraries while the button is on screen, so its window opens the moment it is tapped.
  if($('#save-invite')) watchAccount();
  document.title=({learn:'Sound & write',found:'Word found',album:'My word album',stickers:'My Stickers',review:'Memory game',
    round:'Memory game',scene:'Story clearing',swap:'Sound swap'}[view] || 'The Word Woods')+' · Readling';
}
function drawHeader() {
  const tabs=[['home','compass','Play'],['album','album','Album'],['review','memory','Memory']];
  const active=['round','review','swap'].includes(view)?'review':['album','scene','stickers'].includes(view)?'album':'home';
  $('#masthead').innerHTML=`<div class="wrap mast-row">
    <button class="brand" data-act="home" aria-label="Readling home"><img src="./assets/readling.svg" alt="" width="40" height="40"><span>Readling</span></button>
    <nav class="tabs" aria-label="Game pages">${tabs.map(([route,sym,text])=>`<button class="tab ${active===route?'selected':''}" ${active===route?'aria-current="page"':''} data-act="${route}">${icon(sym,18)}<span>${text}</span></button>`).join('')}</nav>
    <div class="mast-end"><details class="badge-menu"><summary class="stars" aria-label="${profile.stars} stars, my badges">${icon('star',21)} <b>${profile.stars-starsHeld}</b><span class="star-label"> stars</span><span class="badge-caret" aria-hidden="true"></span></summary>
    ${badgePocket()}</details>
    <span class="mast-rule"></span><button class="parents-link" data-act="parents" aria-label="Grown-ups and settings">${icon('gear',20)}<span>Grown-ups</span></button></div>
  </div>`;
}
function drawShelf() {
  const shelf=$('#shelf');
  const reading=view==='learn' || (view==='round' && round.i<round.words.length && !round.solved)
    || (view==='swap' && !swap?.solved);
  shelf.hidden=!reading;
  if(!reading) {shelf.replaceChildren();return;}
  const current=view==='learn'?profile.lesson.word:view==='round'?round.words[round.i]:swap?.b;
  const teams=[...new Set(soundsOf(current))].filter(id=>!ALPHABET.includes(id) || id.length!==1);
  shelf.innerHTML=`<section class="wrap shelf ${shelfOpen?'open':''}" aria-label="Sound shelf">
    <button class="shelf-toggle" data-act="shelf" aria-expanded="${shelfOpen}" aria-controls="letter-rack">${icon('sound',19)}
    <span>Sound shelf</span>${icon('down',14)}</button>
    <div id="letter-rack" class="rack-wrap" ${shelfOpen?'':'hidden'}><div class="letter-rack">${[...ALPHABET].map(c=>`<button class="key ${audioTarget==='letters:'+c?'sounding':''}" data-letter="${c}" aria-label="Hear ${c==='q'?'qu as in quit':c==='x'?'x as in box':c+' sound'}">${c==='q'?'q<small>u</small>':c}</button>`).join('')}</div>
    ${teams.length?`<div class="word-teams"><small>In this word</small>${teams.map(id=>`<button class="key" data-letter="${id}" aria-label="Hear ${displaySound(id)} sound">${displaySound(id)}</button>`).join('')}</div>`:''}</div>
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
  return `<img class="word-art ${cls}" src="./assets/words/${word}.webp" alt="${word}" loading="lazy" draggable="false">`;
}
// Google's own markup and logo for this button, from its Sign in with Google branding guidelines.
function googleButton() {
  return `<button type="button" class="gsi-material-button" data-act="sign-in"><span class="gsi-material-button-state"></span><span class="gsi-material-button-content-wrapper"><span class="gsi-material-button-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
    <path fill="none" d="M0 0h48v48H0z"></path></svg></span><span class="gsi-material-button-contents">Sign in with Google</span></span></button>`;
}
function stamp(inside, kind='') {return `<span class="stamp ${kind}"><span class="stamp-face">${inside}</span></span>`;}
function homePage() {
  const n=count(), next=primaryAction(), shown=eligibleLesson()?profile.lesson.word:findNext(profile);
  const ready=dueWords(profile).length;
  const cta=next==='start-round'?'Play memory first':eligibleLesson()?'Continue my word':next==='parents'?'Choose sounds':next==='review'?'Play memory':n?'Find another word':'Start exploring';
  const heroMeta=next==='start-round'?ready+(ready===1?' card':' cards')+' ready to revisit':shown?stageLabel(shown):n===WORDS.length?'Every word discovered':'Woodland word collection';
  return `<section class="hero">
    <img class="hero-art" src="./assets/hero.webp" alt="A rabbit reading under an oak tree in the moonlit woods" fetchpriority="high">
    <div class="hero-content"><div class="hero-kicker">${icon('compass',17)}<span>${heroMeta}</span></div>
    <h1>The Word<br>Woods<span class="title-spark" aria-hidden="true">✦</span></h1>
    <p>Sound out a word, write its letters and discover what’s hiding in the woods.</p>
    ${action(cta,next,'play','gold')}</div>
  </section>
  ${!shown && n<WORDS.length && next!=='parents'?`<div class="album-extra"><span>The open stages have no more words using her selected sounds.</span>${action('Choose class sounds','parents','','secondary')}</div>`:''}
  <div class="section-heading"><h2>Your field kit</h2>${currentBadgeButton()}</div>
  <section class="kit-grid" aria-label="More ways to play">
    <button class="kit album-kit" data-act="album"><img src="./assets/album.webp" alt=""><span class="kit-copy"><strong>My word album</strong><span>Your book of woodland finds.</span><small>${n} of ${WORDS.length} collected</small></span><span class="circle-arrow">${icon('arrow',19)}</span></button>
    <button class="kit memory-kit" data-act="review"><img src="./assets/memory.webp" alt=""><span class="kit-copy"><strong>Memory game</strong><span>Turn a card and read it again.</span><small>${ready?ready+' ready to revisit':n>1?'Play with your words':n?'Find one more word to play':'Uses your collected words'}</small></span><span class="circle-arrow">${icon('arrow',19)}</span></button>
  </section>`;
}
const escapeText=s=>s.replace(/[&<>"']/g,c=>'&#'+c.charCodeAt(0)+';');
const stageOf=word=>STAGES.find(s=>s.number===ENTRIES.get(word).stage);
const stageLabel=word=>{const s=stageOf(word);return 'Stage '+s.number+' · '+escapeText(s.name);};
const badgeArt=(stage,rank)=>`./assets/badges/${stage.badges.id}-${rank}.webp`;

function currentBadgeButton() {
  const {stage,badgeRank}=stageProgress(profile).findLast(s=>s.open);
  return `<button type="button" class="level current-badge" data-act="inspect-badge" data-stage="${stage.number}" data-rank="${badgeRank}" aria-label="Level ${getLevel(profile)}, view ${stage.badges.name} badge ${badgeRank}"><img width="36" height="36" src="${badgeArt(stage,badgeRank)}" alt=""> Level ${getLevel(profile)}</button>`;
}

function badgeButton(stage,rank) {
  return `<button type="button" class="badge-pin" data-act="inspect-badge" data-stage="${stage.number}" data-rank="${rank}"
    aria-label="${stage.badges.name}, badge ${rank} of ${BADGES_PER_STAGE}"><img src="${badgeArt(stage,rank)}" alt="" width="64" height="64" loading="lazy"></button>`;
}
function badgeStrip({stage,badgeRank}) {
  return `<ol class="badge-strip" aria-label="${stage.badges.name}, ${badgeRank} of ${BADGES_PER_STAGE} badges">${Array.from({length:BADGES_PER_STAGE},(_,i)=>{
    const rank=i+1;
    return `<li>${rank<=badgeRank?badgeButton(stage,rank):`<span class="badge-space">${icon('lock',15)}<span class="sr-only">Badge ${rank} locked</span></span>`}</li>`;
  }).join('')}</ol>`;
}
function badgePocket() {
  const current=stageProgress(profile).findLast(s=>s.open);
  const {stage,found,nextBadgeAt,badgeRank}=current;
  const wordType=stage.core.length<stage.entries.length?'core word':'word';
  const left=nextBadgeAt===null?0:nextBadgeAt-found;
  const hint=left?`Find ${left} more ${wordType}${left===1?'':'s'} for badge ${badgeRank+1}.`:'You collected all five badges!';
  const previous=left?Math.ceil((badgeRank-1)*stage.goal/(BADGES_PER_STAGE-1)):0;
  const target=(nextBadgeAt ?? stage.goal)-previous;
  const earned=Math.min(found-previous,target);
  const reads=Object.values(profile.cards).reduce((sum,card)=>sum+card.reviews,0);
  return `<section class="badge-pocket badge-theme-${stage.badges.family}" aria-label="Reading progress">
    <div class="badge-caption">Stage ${stage.number} · ${escapeText(stage.name)}</div><h2>${stage.badges.name}</h2>
    ${badgeStrip(current)}
    <progress class="badge-progress" value="${earned}" max="${target}" aria-label="${left?'Progress to badge '+(badgeRank+1):'Stage badges complete'}" aria-describedby="badge-next">${earned} of ${target}</progress>
    <p id="badge-next">${hint}</p>
    <dl class="badge-counts"><div><dt>Words</dt><dd>${count()}</dd></div><div><dt>Sounds</dt><dd>${Object.keys(profile.sounds).length}</dd></div><div><dt>Memory reads</dt><dd>${reads}</dd></div></dl>
    <button type="button" class="back" data-act="album">My word album ${icon('arrow',16)}</button></section>`;
}
function inspectBadge(number,rank) {
  const progress=stageProgress(profile).find(s=>s.stage.number===number);
  if(!progress || !Number.isInteger(rank) || rank<1 || rank>progress.badgeRank) return;
  const {stage}=progress;
  openDialog(`<div class="badge-inspect badge-theme-${stage.badges.family}">
    <img src="${badgeArt(stage,rank)}" alt="${stage.badges.name}, badge ${rank}" width="192" height="192">
    <strong>Badge ${rank} of ${BADGES_PER_STAGE}</strong><p>Stage ${stage.number} · ${escapeText(stage.name)}</p></div>`,stage.badges.name);
}
// The first badge is already in the album at the start. Give it its own reveal on the first find.
function revealBadge(found) {
  return found.badgeEarned || (found.fresh && count()===1 ? 1 : 0);
}
function badgeAward(word,found) {
  const badgeEarned=revealBadge(found), unlocked=found.unlocked;
  if(!badgeEarned) return '';
  const stage=stageOf(word), next=STAGES.find(s=>s.number===unlocked);
  const complete=badgeEarned===BADGES_PER_STAGE;
  return `<div class="badge-award badge-theme-${stage.badges.family}">${badgeButton(stage,badgeEarned)}
    <div><strong>${stage.badges.name}</strong><p>${complete?'You collected all five!':`You earned badge ${badgeEarned} of ${BADGES_PER_STAGE}!`}</p></div>
    ${next?`<div class="badge-handoff">${icon('arrow',20)}${badgeButton(next,1)}<div><strong>Stage ${next.number} is open!</strong><p>Your next set is ${next.badges.name}.</p></div></div>`:''}</div>`;
}
const unitAt=(word,pos)=>unitsOf(word).findIndex(u=>u.positions.includes(pos));
function wordPrint(word,active=-1,options={}) {
  return `<div class="word-print ${options.cls || ''}" aria-label="${word}" style="--letters:${word.length}">${[...word].map((c,i)=>{
    const u=unitAt(word,i);
    return `<span class="grapheme ${u===active?'current':''} ${active>=0&&u<active?'finished':''}" data-pos="${i}" data-unit="${u}">${letterForm(c)}<span class="letter-rule"></span></span>`;
  }).join('')}</div>`;
}
function inkPaths(lines) {
  return lines.map(line=>`<path d="${pathData(line)}"/>`).join('');
}
function lessonPage() {
  const l=profile.lesson, total=l.word.length;
  const units=unitsOf(l.word), current=unitAt(l.word,l.i), u=units[current];
  const isBlend=l.i===total;
  const top=`<div class="page-top">${back()}<span class="level">${icon('compass',16)} ${stageLabel(l.word)}</span></div>`;
  if(isBlend) return top+`<section class="activity blend-activity">
    <div class="activity-heading"><div class="kicker">${icon('book',16)} Blend the sounds</div><h1>Say the whole word</h1>
    <p>Slide under the letters and read them together.</p></div>
    <div class="blend-work">${wordPrint(l.word,-1,{cls:'blend-print'})}
    <div class="blend-track" id="blend-track" role="slider" tabindex="0" aria-label="Blend from left to right" aria-valuemin="0" aria-valuemax="${units.length}" aria-valuenow="0"><span class="track-dots"></span><span class="track-thumb">${icon('arrow',21)}</span></div></div>
    <div class="actions centre">${action('Blend with me','blend-help','sound','secondary')}${action('Reveal my word','reveal','spark')}</div>
    </section>`;
  const c=l.word[l.i];
  const paths=forms[c];
  const dot=paths[0].match(/^M(\d+) (\d+)/);
  return top+`<section class="activity lesson-activity">
    <div class="activity-heading"><div class="kicker">${icon('pen',16)} Sound ${current+1} of ${units.length}</div><h1>Sound &amp; write</h1>${u.positions.length>1?`<p><b>${u.letters.replace('_','…')}</b> makes one sound. Trace the <b>${c}</b>.</p>`:''}</div>
    <div class="lesson-grid ${total>3?'long-word':''}" style="--letters:${total}"><div class="task-label"><div class="instruction-title"><span class="step-token">1</span><h2>Say the sound</h2></div>
      <button class="btn secondary" data-act="letter-help">${icon('sound',19)} Hear sound</button></div>
      ${wordPrint(l.word,current,{cls:'copy-word'})}
    <div class="task-label"><div class="instruction-title"><span class="step-token">2</span><h2>Write <span class="inline-letter">${c}</span></h2></div>
      <div class="ink-tools"><button data-act="show-stroke">${icon('pen',16)} Show stroke</button><button data-act="clear-ink">${icon('repeat',16)} Clear</button></div></div>
    <div class="pad-row">${[...l.word].map((ch,j)=>j!==l.i?total>3?'':`<div class="rest-pad">
        <svg viewBox="0 0 180 138" aria-hidden="true"><path class="rest-line" d="M0 95H180"/><g class="ink-lines">${inkPaths(l.ink[j])}</g></svg>
        ${j===l.i+1?action('Next','next-sound'):''}</div>`:
      `<div class="ink-box"><svg id="inkpad" viewBox="0 0 180 138" role="img" tabindex="-1" aria-label="Write a lowercase ${c} here with your stylus or finger">
        <path class="midline" d="M0 48H180"/><path class="baseline" d="M0 95H180"/>
        <g transform="translate(42 0)" class="guide-lines">${paths.map(d=>`<path d="${d}"/>`).join('')}</g>
        <g transform="translate(42 0)" class="stroke-demo" aria-hidden="true">${paths.map((d,i)=>`<path pathLength="1" style="--delay:${i*.75}s" d="${d}"/>`).join('')}</g>
        <circle class="start-dot" cx="${42+Number(dot[1])}" cy="${dot[2]}" r="4.4"/>
        <g class="ink-lines">${inkPaths(l.ink[l.i])}</g>
      </svg></div>`).join('')}
    </div></div>
    <div class="activity-bottom"><span class="progress-dots" aria-label="Letter ${l.i+1} of ${total}">${[...l.word].map((_,i)=>`<i class="${i<=l.i?'filled':''}"></i>`).join('')}</span>
    ${l.i===total-1?action('Blend my word','next-sound'):total>3?action('Next','next-sound'):''}</div></section>`;
}
function foundPage(word) {
  const fresh=lastFound?.word===word && lastFound.fresh;
  const lvl=fresh && lastFound.levelUp;
  const next=primaryAction();
  return `<div class="page-top">${back()}${currentBadgeButton()}</div>
    <section class="found activity ${profile.settings.sparkles?'victory':''}"><div class="kicker">${icon('spark',17)} ${fresh?(ENTRIES.get(word).bonus?'Bonus find':'New discovery'):'In your album'}</div>
      <h1>${fresh?'Look what you found!':'A woodland find'}</h1>
      <div class="show-stage">${profile.settings.sparkles?finaleScenery(profile.show.picks):''}<div class="reveal-art">${stamp(wordImage(word))}</div></div>
      <div class="found-word"><strong>${word}</strong><button class="round-button" data-act="read-word" data-word="${word}" aria-label="Hear ${word}">${icon('sound',20)}</button></div>
      <p>${TALES[word]?escapeText(TALES[word]):'What do you notice in your picture?'}</p>${inkLabel(word)}
      ${fresh?`<div class="reward">${icon('star',17)} +5 stars ${lvl?`<span>· Level ${getLevel(profile)}!</span>`:''}</div>`:''}
      ${lvl&&count()===3?'<p class="unlock-note">Your story clearing is open. Play with your finds in the album.</p>':''}
      ${fresh?badgeAward(word,lastFound):''}
      <div class="actions centre">${action('My album','album','album','secondary')}${profile.settings.sparkles?action('Encore!','encore','spark','gold'):''}${next==='start-round'?action('Play memory first',next):next==='discover'?action('Find another word',next):action('Play memory','review')}</div>
      ${showPanel()}${lvl && cloud.on && !cloud.remembered()?`<div class="save-invite" id="save-invite"><p>Save your album and open it on any tablet.</p>${googleButton()}</div>`:''}</section>`;
}
function inkLabel(word) {
  const ink=profile.cards[word]?.ink;
  if(!ink?.some(lines=>lines.length)) return '';
  return `<div class="handwritten" role="img" aria-label="Your handwriting for ${word}">${[...word].map((c,i)=>ink[i].length?
    `<svg viewBox="0 0 180 138" aria-hidden="true"><g class="ink-lines">${inkPaths(ink[i])}</g></svg>`:letterForm(c)).join('')}</div>`;
}
function albumPage() {
  const n=count(), next=primaryAction();
  const stages=stageProgress(profile), latest=stages.filter(s=>s.open).at(-1).stage;
  return `<div class="page-top">${back()}<span class="level">${icon('album',17)} ${n} / ${WORDS.length} collected</span></div>
    <div class="album-head"><div><h1>My word album</h1><p>${n?'Tap a find to hear its word and see your writing.':'Each word you discover earns a place on these pages.'}</p></div>
    <div class="actions">${action('My Stickers','stickers','spark','secondary')}${next==='start-round'?action('Play memory first',next,'play'):next==='discover'?action(n?'Find a word':'Find my first word','discover','play'):''}</div></div>
    ${stages.map((progress,i)=>{
      const {stage,open,found}=progress;
      const got=stage.entries.filter(e=>profile.cards[e.word]).length, previous=STAGES[i-1];
      const heading=`Stage ${stage.number} · ${escapeText(stage.name)}`;
      if(!open && !got) return `<div class="locked-stage">${icon('lock',17)} <span>${heading}</span><small>Find ${previous.goal} core words in Stage ${previous.number} to open.</small></div>`;
      const nextWord=open && findNext(profile,stage.number), bonusWord=open && findNext(profile,stage.number,true);
      return `<details class="album-stage" ${stage===latest?'open':''}><summary>${heading} <small>${got} / ${stage.entries.length}</small></summary>
      ${open?`<section class="album-badges badge-theme-${stage.badges.family}"><div><h3>${stage.badges.name}</h3><small>${progress.badgeRank} of ${BADGES_PER_STAGE} badges</small></div>${badgeStrip(progress)}</section>`:''}
      ${open && STAGES[i+1] && !stages[i+1].open?`<p>${Math.max(0,stage.goal-found)} more core finds open Stage ${STAGES[i+1].number}.</p>`:''}
      ${nextWord && nextWord!==bonusWord?`<button class="btn secondary" data-act="stage-discover" data-stage="${stage.number}">Find a word in this stage</button>`:''}
      ${bonusWord?`<button class="btn secondary" data-act="stage-bonus" data-stage="${stage.number}">Find a bonus word</button>`:''}
      ${!nextWord && open && got<stage.entries.length?`<p>More words are here when their class sounds are on.</p>`:''}
      <div class="album-grid">${stage.entries.map(({word,bonus},i)=>{
      const found=!!profile.cards[word];
      return found?`<button class="album-card" data-act="card" data-word="${word}">${stamp(wordImage(word))}<strong>${word}</strong></button>`:
        `<div class="album-card missing" aria-label="Undiscovered word ${i+1}">${stamp(icon('leaf',35),'hidden-stamp')}<small>${bonus?'Bonus':'Word'} ${String(i+1).padStart(2,'0')}</small></div>`;
      }).join('')}</div></details>`;
    }).join('')}
    <div class="album-extra"><div>${icon('sprout',28)}<span><strong>Story clearing</strong><small>${n>=3?'Make a scene with your collected words.':'Opens when you collect 3 words.'}</small></span></div>
    ${n>=3?action('Make a scene','scene','arrow','secondary'):icon('lock',21)}</div>`;
}
function stickersPage() {
  const n=profile.show.picks.length;
  const emptyHint=profile.settings.sparkles?'Pick a sticker after you find a word or finish a memory round.':'Turn on the celebration show in Grown-ups to start picking stickers.';
  return `<div class="page-top">${back('album','Back to my word album')}${n?`<span class="level">${icon('spark',16)} ${n} ${n===1?'sticker':'stickers'}</span>`:''}</div>
    <div class="album-head"><div><h1>My Stickers</h1>${n?'<p>Tap a sticker to watch it move.</p>':''}</div></div>
    ${n?'<ul id="sticker-cards" class="gallery-grid" aria-label="Earned stickers"></ul>':
      `<section class="sticker-empty"><img src="./assets/album.webp" width="128" height="128" alt=""><h2>Your first sticker goes here</h2><p>${emptyHint}</p></section>`}`;
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
  Object.assign(round,{turned:false,solved:false,heard:false,asked:[],first:null,unaided:false,tried:[],
    options:pictureChoices(profile,round.words[round.i])});
  // Fetch the pictures while she reads, so they are ready the moment the card turns.
  for(const o of round.options) new Image().src='./assets/words/'+o+'.webp';
}
function roundPage() {
  if(round.i>=round.words.length) {
    const onward=primaryAction()==='discover';
    const show=profile.settings.sparkles;
    return `<div class="page-top">${back('review','Back to memory')}</div><section class="activity round-done ${show?'victory':''}">
    ${show?'':icon('star',56)}<h1>Round complete!</h1><p>You revisited ${round.words.length} ${round.words.length===1?'word':'words'} and earned ${round.words.length} ${round.words.length===1?'star':'stars'}.</p>
    ${show?`<div class="show-stage">${finaleScenery(profile.show.picks)}<div class="reveal-art">${round.words.map(w=>stamp(wordImage(w))).join('')}</div></div>`:
      `<div class="mini-cards">${round.words.map(w=>wordImage(w)).join('')}</div>`}
    <div class="actions centre">${action('Back to the woods','home','home','secondary')}${action('Play again','start-round','repeat',onward?'secondary':'primary')}
    ${onward?action(eligibleLesson()?'Continue my word':'Find another word','discover'):''}</div>${showPanel()}</section>`;
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
    `${wordPrint(a,i)}<div class="swap-prompt"><p>Which spelling makes this sound?</p><button class="round-button" data-act="swap-sound" aria-label="Play the new sound">${icon('sound',22)}</button></div>
    <div class="swap-tiles">${options.map(u=>`<button class="swap-tile" data-act="swap-letter" data-choice="${u.id}">${u.letters.length===1?letterForm(u.letters):u.letters.replace('_','…')}<span class="sr-only">${u.letters}</span></button>`).join('')}</div>`}</section>`;
}
function newSwap() {
  const pairs=swapPairs(profile); if(!pairs.length) return;
  const pair=pairs[Math.floor(Math.random()*pairs.length)];
  const [a,b]=Math.random()<.5?pair:[pair[1],pair[0]];
  const i=soundsOf(a).findIndex((id,j)=>id!==soundsOf(b)[j]);
  const target=unitsOf(b)[i], options=[target];
  for(const u of [...Object.keys(profile.cards).flatMap(unitsOf),...STAGES[0].entries.flatMap(e=>e.units)]) {
    if(options.length===3) break;
    if(u.id!==soundsOf(a)[i] && !options.some(o=>o.letters===u.letters || SOUNDS[o.id].ipa===SOUNDS[u.id].ipa)) options.push(u);
  }
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
  const amount=clamp(frac,0,1), steps=unitsOf(profile.lesson.word).length;
  track.style.setProperty('--slide',amount);
  const reached=amount===0?0:Math.min(steps,Math.ceil(amount*steps));
  track.setAttribute('aria-valuenow',String(reached));
  $('.blend-print').querySelectorAll('.grapheme').forEach(el=>el.classList.toggle('blended',Number(el.dataset.unit)<reached));
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
    e.preventDefault();const n=unitsOf(profile.lesson.word).length;
    slideTo(delta?(Number(track.getAttribute('aria-valuenow'))+delta)/n:e.key==='Home'?0:1);
  });
}
function guideBlend() {
  const l=profile.lesson;if(!l || l.i!==l.word.length) return;
  l.help=true;save();slideTo(0);
  playClip('blends',l.word,{end:()=>slideTo(1),playing:()=>{
    const id=playbackId, end=sound.duration;
    if(!Number.isFinite(end) || end<=0) return;
    const n=unitsOf(l.word).length, cues=blendCues[l.word];
    const boundaries=[0,...(cues?.length===n-1?cues:Array.from({length:n-1},(_,i)=>end*(i+1)/n)),end];
    const frame=()=>{
      if(playbackId!==id || view!=='learn' || sound.ended) return;
      const t=sound.currentTime, i=Math.min(n-1,boundaries.findLastIndex(point=>point<=t));
      const within=clamp((t-boundaries[i])/(boundaries[i+1]-boundaries[i]),0,1);
      slideTo((i+within)/n);
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
  if(!Object.hasOwn(SOUNDS,c)) return;
  if(view==='learn' && profile.lesson && soundsOf(profile.lesson.word).includes(c)) {profile.lesson.help=true;save();}
  if(view==='round' && round && !round.first && soundsOf(round.words[round.i]).includes(c) && !round.asked.includes(c)) round.asked.push(c);
  playClip('letters',c);
}
function openDialog(html, label) {
  stickerCards?.stop();
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
function accountRow() {
  if(!cloud.on) return '<p class="dialog-intro">Progress is saved in this browser. You can take a copy to her other tablet below.</p>';
  if(!cloud.remembered()) return `<p class="dialog-intro">Progress is saved in this browser. Sign in to keep a copy in your Google account and open the same album on her other tablet.</p>${googleButton()}`;
  const email=account?.email.replace(/[&<>"]/g,c=>'&#'+c.charCodeAt(0)+';');
  return `<p class="dialog-intro">${syncTrouble?'Your Google account could not be reached just now. Progress is still saved in this browser and will be sent when the connection is back.':
    `Progress is saved to your Google account${email?', '+email:''}. Sign in on her other tablet to open the same album there.`}</p>
    <div class="actions">${action('Sign out','sign-out','','secondary')}</div>`;
}
function drawAccount() {
  const el=$('#account');if(el) el.innerHTML=accountRow();
}
function parents() {
  stopSound();cancelFinale();
  openDialog(`<div id="account">${accountRow()}</div>
    <fieldset><legend>Play settings</legend><label class="setting-line"><span>Spoken instructions</span><input type="checkbox" data-setting="voice" ${profile.settings.voice?'checked':''}></label>
    <label class="setting-line"><span>Celebration show</span><input type="checkbox" data-setting="sparkles" ${profile.settings.sparkles?'checked':''}></label>
    <label class="setting-line"><span>Music in her show</span><input type="checkbox" data-setting="fanfare" ${profile.settings.fanfare?'checked':''}></label>
    <label class="setting-line"><span>Memory cards before a new word</span><input type="checkbox" data-setting="memoryFirst" ${profile.settings.memoryFirst?'checked':''}></label></fieldset>
    <fieldset><legend>Her celebration show</legend><p>She has added ${profile.show.picks.length} of ${SHOW.length} things, and her show runs for about ${Math.round(showTimes(profile.show.picks).total)} seconds. Her first find or memory round earns a choice of two things to add, and every second one after that earns another. The music plays once she has added it.</p>
    <div class="actions">${action('Play her show','play-show','','secondary')}${action('Try out the show','trial','','secondary')}<a class="btn secondary" href="./celebrations.html">Celebration gallery</a></div></fieldset>
    <fieldset><legend>Sounds covered in class</legend><p>Choose the sounds she has met. New words use only these sounds.</p>
    <div class="sound-checks">${CLASS_SOUNDS.map(c=>`<label title="As in ${SOUNDS[c].example}"><input type="checkbox" data-class-sound="${c}" ${profile.settings.sounds.includes(c)?'checked':''}><span>${displaySound(c)}</span></label>`).join('')}</div>
    <small id="available-count">${availableWords(profile).length} words match in open stages</small></fieldset>
    <details class="parent-details"><summary>Word progress (${count()} of ${WORDS.length})</summary>
    ${count()?`<ul>${WORDS.filter(w=>profile.cards[w]).map(w=>{const c=profile.cards[w];return `<li><strong>${w}</strong><span>${c.reviews} ${c.reviews===1?'review':'reviews'} · ${c.assisted?'Practised with help':'No hint recorded'}</span></li>`;}).join('')}</ul>`:
    '<p>Her first discovery will appear here.</p>'}</details>
    ${soundProgress()}
    <fieldset><legend>Move an album</legend><p>Download a copy here, open this Site on the other tablet and import it there. Importing combines the two collections.</p>
    <div class="actions">${action('Download album','export','','secondary')}${action('Import album','import','','secondary')}</div><input type="file" id="file-picker" accept="application/json,.json" hidden></fieldset>
    <p class="credits"><a href="./audio-studio.html">Audio studio</a> · <a href="./assets/audio/CREDITS.txt" target="_blank" rel="noopener">Audio credits</a></p>`, 'Grown-ups');
  watchAccount();
}
function showCard(w) {
  if(!profile.cards[w]) return;
  openDialog(`<div class="card-dialog">${stamp(wordImage(w))}${inkLabel(w)}<p>${TALES[w]?escapeText(TALES[w]):'What do you notice in your picture?'}</p>
    <div class="actions centre"><button class="btn secondary" data-act="read-word" data-word="${w}">${icon('sound',18)} Hear word</button>
    ${TALES[w]?`<button class="btn secondary" data-act="read-tale" data-word="${w}">${icon('book',17)} Read the story</button>`:''}
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
    mergeAlbum(profile,normalise(backup.profile));
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
    case 'home':case 'album':case 'review':case 'scene':case 'stickers':go(act);break;
    case 'shelf':shelfOpen=!shelfOpen;drawShelf();$('.shelf-toggle').focus({preventScroll:true});break;
    case 'parents':parents();break;
    case 'inspect-badge':inspectBadge(Number(el.dataset.stage),Number(el.dataset.rank));break;
    case 'dismiss':dialog.close();break;
    case 'discover':startOrResume();break;
    case 'stage-discover':case 'stage-bonus':{const w=findNext(profile,Number(el.dataset.stage),act==='stage-bonus'); if(w)startOrResume(w);break;}
    case 'letter-help':{const {word,i}=profile.lesson;useSound(soundsOf(word)[unitAt(word,i)]);break;}
    case 'show-stroke':traceDemo();break;
    case 'clear-ink':profile.lesson.ink[profile.lesson.i]=[];$('.ink-lines',$('#inkpad')).replaceChildren();save();break;
    case 'next-sound': {
      stopSound();const l=profile.lesson;
      if(!l || l.i>=l.word.length) break;
      l.i++;save();render();
      if(l.i===l.word.length) {afterNavigate();narrate('blend-word');}
      else {$('#inkpad').focus({preventScroll:true});announce(`Write ${l.word[l.i]}. Sound ${unitAt(l.word,l.i)+1}.`);}
      break;
    }
    case 'blend-help':guideBlend();break;
    case 'reveal':{
      const found=collect(profile); if(!found) break;
      if(found.fresh) warm=false;
      lastFound=found;save();go('found/'+found.word);
      // Her show says the word when the picture appears. Without the show she hears it straight away.
      if(!playing) playClip('words',found.word,{end:playFanfare});
      break;
    }
    case 'encore':encores++;if(!celebrate({word:location.hash.split('/')[1]})) playFanfare();break;
    case 'album-encore':if(profile.cards[el.dataset.word]){lastFound=null;go('found/'+el.dataset.word);if(!playing)playFanfare();}break;
    case 'add-to-show':{
      const id=el.dataset.pick;
      if(!addToShow(profile,id)) break;
      save();encores++;
      const theatre=$('.meadow-scenery'), panel=$('#show-add');
      if(theatre) theatre.outerHTML=finaleScenery(profile.show.picks);
      if(panel) {
        panel.outerHTML=showPanel(SHOW.find(s=>s.id===id).name);
        $('#sticker-receipt').focus({preventScroll:true});
      }
      celebrate({word:pageWord(),alone:id});
      if(id==='music') playFanfare();
      break;
    }
    case 'play-show':previewShow({});break;
    case 'trial':trial ||= new Set(profile.show.picks);trialDialog();break;
    case 'trial-all':trial=new Set(SHOW.map(s=>s.id));trialDialog();break;
    case 'trial-none':trial=new Set();trialDialog();break;
    case 'trial-hers':trial=new Set(profile.show.picks);trialDialog();break;
    case 'trial-play':{
      const {stage,badgeRank}=stageProgress(profile).findLast(s=>s.open);
      previewShow({picks:[...trial],all:true,stars:5,tier:trialRosette?badgeRank:0,badgeSrc:trialRosette?badgeArt(stage,badgeRank):''},trialDialog);break;
    }
    case 'trial-one':{
      // One thing by itself, with whatever it builds on and the rest of what is ticked.
      const id=el.dataset.pick, base=SHOW.find(s=>s.id===id).after;
      previewShow({picks:[...new Set([...trial,id,...(base?[base]:[])])],alone:id},trialDialog);break;
    }
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
      if(round.i<round.words.length) dealCard(); else {warm=true;finishTask(profile);save();}
      render();main.focus({preventScroll:true});
      if(round.i===round.words.length) {
        celebrate({word:round.words.at(-1),spell:false,stars:round.words.length,narrated:profile.settings.voice});
        narrate('round-done',{end:playFanfare});
      }
      break;
    }
    case 'start-swap':if(swapPairs(profile).length){newSwap();go('swap');playClip('letters',soundsOf(swap.b)[swap.i]);}break;
    case 'swap-sound':playClip('letters',soundsOf(swap.b)[swap.i]);break;
    case 'swap-read':playClip('words',swap.b);break;
    case 'swap-letter':{
      if(el.dataset.choice===soundsOf(swap.b)[swap.i]){swap.solved=true;render();playClip('words',swap.b);}
      else {playClip('letters',el.dataset.choice);announce('Listen again and try another letter.');el.classList.add('try-again');}
      break;
    }
    case 'choose-piece':chosenSticker=el.dataset.word;render();playClip('words',chosenSticker);break;
    case 'undo-piece':profile.scene.pop();save();render();break;
    case 'export':exportAlbum();break;
    case 'import':$('#file-picker').click();break;
    case 'sign-in':
      watchAccount();
      cloud.signIn().then(()=>notice('Signed in. This album now saves to your Google account.'),e=>{
        // Closing the Google window is a grown-up's choice, so it needs no message.
        if(!/popup-closed|cancelled-popup/.test(e?.code)) notice(e?.code==='auth/popup-blocked'?'Allow pop-ups for this Site, then try again.':'Could not sign in. Check the connection and try again.');
      });break;
    case 'sign-out':cloud.signOut().catch(()=>notice('Could not sign out. Check the connection and try again.'));break;
  }
}
document.addEventListener('click',e=>{
  const el=e.target.closest('button');if(!el)return;
  if(el.dataset.letter) useSound(el.dataset.letter);
  else if(el.dataset.act) dispatch(el.dataset.act,el);
});
document.addEventListener('pointerdown',e=>{
  const menu=$('.badge-menu[open]');
  if(menu && !dialog.open && !menu.contains(e.target)) menu.open=false;
});
document.addEventListener('keydown',e=>{
  const menu=$('.badge-menu[open]');
  if(e.key==='Escape' && menu && !dialog.open) {
    menu.open=false;menu.querySelector('summary').focus();e.preventDefault();
  }
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.dataset.setting){profile.settings[el.dataset.setting]=el.checked;save();if(!profile.settings.voice)stopSound();}
  if(el.dataset.setting==='sparkles' && view==='found') render();
  if(el.dataset.classSound) {
    classChanged=true;
    const allowed=new Set(profile.settings.sounds);
    if(el.checked) allowed.add(el.dataset.classSound);else allowed.delete(el.dataset.classSound);
    profile.settings.sounds=CLASS_SOUNDS.filter(c=>allowed.has(c));save();
    $('#available-count').textContent=availableWords(profile).length+' words match in open stages';
  }
  if(el.dataset.trial) {
    if(el.checked) trial.add(el.dataset.trial);else trial.delete(el.dataset.trial);
    // Anything that needed what was just unticked goes with it.
    for(let again=true;again;){again=false;for(const s of SHOW) if(trial.has(s.id) && !trialOpen(s)){trial.delete(s.id);again=true;}}
    const top=dialog.scrollTop;
    trialDialog();dialog.scrollTop=top;$(`[data-trial="${el.dataset.trial}"]`)?.focus({preventScroll:true});
  }
  if(el.id==='trial-rosette'){trialRosette=el.checked;const top=dialog.scrollTop;trialDialog();dialog.scrollTop=top;$('#trial-rosette')?.focus({preventScroll:true});}
  if(el.id==='file-picker') void importAlbum(el.files[0]);
});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)dialog.close();}});
// The music is one of the things she adds to her show, so it stays quiet until she has chosen it.
function playFanfare() {
  if($('.victory') && profile.settings.fanfare && (showPicks || profile.show.picks).includes('music') && !dialog.open && !document.hidden) playClip('music','fanfare');
}
// The word her show is about: the find on this page, or the last card of a finished round.
function pageWord() {
  return view==='found'?location.hash.split('/')[1]:view==='round' && round?round.words.at(-1):WORDS.find(w=>profile.cards[w]) || '';
}
function drawStars() {
  const el=$('#masthead .stars b');if(el) el.textContent=profile.stars-starsHeld;
}
// Starts her show on a page that has the stage. Her letters sound as they land and her word is said when the picture appears.
// The stars she has just earned wait out of her total until the show counts them in.
function celebrate({word='',stars=0,held=false,tier=0,badgeSrc='',alone='',all=false,spell=true,picks=profile.show.picks,narrated=false,ended=null}={}) {
  const stage=$('.victory');
  if(!stage) return null;
  showPicks=picks;
  const finds=WORDS.filter(w=>profile.cards[w]);
  const sounds=soundsOf(word);
  const show=launchFinale(stage,{picks,finds,word,soundCount:sounds.length,stars,tier,badgeSrc,alone,all,spell,turn:profile.show.tasks+encores,
    onLetter:i=>playClip('letters',sounds[i]),
    onHit:()=>{if(spell && word) playClip('words',word,{end:playFanfare});else if(!narrated) playFanfare();},
    onStar:()=>{if(starsHeld){starsHeld--;drawStars();}},
    onEnd:finished=>{if(starsHeld){starsHeld=0;drawStars();}ended?.(finished);}});
  if(!alone) playing=show;
  if(show && held){starsHeld=stars;drawStars();}
  // The choices wake up as the show ends, so their small previews do not run underneath it.
  clearTimeout(previewTimer);
  previewTimer=setTimeout(startPreviews,show?Math.max(0,show.total*1000-500):0);
  return show;
}
// A grown-up's preview plays on the page of her latest find, so her letter sounds and her picture are all in it.
// `then` runs when the show has played to its end.
function previewShow(options,then) {
  const latest=latestFind();
  dialog.close();
  // The dialog redraws the page as it closes, so the show starts just after.
  setTimeout(()=>{
    const word=view==='found'?pageWord():latest;
    if(word && view!=='found'){lastFound=null;lastRevealRoute='found/'+word;go('found/'+word);}
    encores++;
    // A first-time visitor to Grown-ups can try the same meadow before collecting a word.
    const dress=(picks,alone)=>{const theatre=$('.meadow-scenery');if(theatre) theatre.outerHTML=finaleScenery(picks,alone);};
    cancelFinale();
    let sample;
    if(!$('.victory .meadow-scenery')) {
      sample=document.createElement('section');sample.className='found activity victory sample-show';
      sample.innerHTML=`<h1>Celebration preview</h1><div class="show-stage">${finaleScenery(options.picks || profile.show.picks,options.alone)}<div class="reveal-art">${stamp(wordImage(word || WORDS[0]))}</div></div>`;
      main.prepend(sample);sample.scrollIntoView({block:'nearest'});
    } else if(options.picks) dress(options.picks,options.alone);
    const restore=()=>{if(sample) sample.remove();else if(options.picks) dress(profile.show.picks);};
    const show=celebrate({word,...options,ended:finished=>{restore();if(finished) then?.();}});
    if(!show){restore();notice('The show cannot play while this device asks for less motion.');then?.();return;}
    if(options.alone==='music'){if(profile.settings.fanfare) playClip('music','fanfare');}
    else if(then && !options.alone) notice('This show runs for about '+Math.round(show.total)+' seconds.');
  },80);
}
// Preview the current find (or the first word if nothing has been collected).
function showTimes(picks,options={}) {
  const staged=profile.settings.sparkles;
  return planShow({picks,letters:staged?soundsOf(pageWord() || WORDS[0]).length:0,staged,stars:5,...options});
}
// The figures for the show being tried: its length, when her picture appears, how busy it gets, and when each part plays.
function trialStats() {
  const picks=[...trial], tier=trialRosette?2:0, plan=showTimes(picks,{all:true,tier}), secs=n=>(Math.round(n*10)/10).toFixed(1);
  const turns=Array.from({length:12},(_,turn)=>showTimes(picks,{turn,tier}).total), low=Math.min(...turns), high=Math.max(...turns);
  const base={letters:'Her letters',comet:'The star',tally:'Her stars',rosette:'Her stage badge'};
  const rows=plan.acts.map(([id,at,len,stays])=>({name:base[id] || SHOW.find(s=>s.id===id)?.name || id,at,end:stays?plan.total:Math.min(plan.total,at+len),stays}));
  // The fanfare starts once her word has been said, a little after the picture appears.
  if(trial.has('music')) rows.push({name:'Music',at:plan.hit+.65,end:Math.min(plan.total,plan.hit+.65+3.7)});
  rows.sort((a,b)=>a.at-b.at);
  let busiest=0;
  for(let t=0;t<plan.total;t+=.1) busiest=Math.max(busiest,plan.acts.filter(([,at,len])=>t>=at && t<=at+len).length);
  return `<div class="trial-stats"><p><strong>${secs(plan.total)} seconds</strong> for this show, with ${trial.size} of ${SHOW.length} things ticked.</p>
    <p>Her picture appears at ${secs(plan.hit)} seconds. At its busiest, ${busiest} ${busiest===1?'thing plays':'things play'} at once.</p>
    ${high-low>.05 || Math.abs(high-plan.total)>.05?`<p>In her own show the visitors and the big finishes take turns, two of each, so this would run for ${secs(low)} to ${secs(high)} seconds.</p>`:''}
    <details id="trial-timeline" ${trialTimeline?'open':''}><summary>When each part plays</summary><div class="trial-times">${rows.map(r=>
      `<div class="trial-time"><span>${r.name}</span><i style="--from:${(r.at/plan.total*100).toFixed(1)}%;--wide:${Math.max(1.5,(r.end-r.at)/plan.total*100).toFixed(1)}%"></i><span>${secs(r.at)} to ${secs(r.end)}</span></div>`).join('')}</div></details></div>`;
}
function trialOpen(s) {
  return (!s.after || trial.has(s.after)) && (!s.any || s.any.some(id=>trial.has(id)));
}
function trialDialog() {
  const named=id=>SHOW.find(s=>s.id===id);
  openDialog(`<p class="dialog-intro">Tick anything to see it in a show, in any mix. This is only for looking. It does not change her show.</p>
    <div class="actions">${action('Play this show','trial-play','play')}${action('Tick everything','trial-all','','secondary')}${action('Clear','trial-none','','secondary')}${action('Her show','trial-hers','','secondary')}</div>
    ${trialStats()}
    <p class="dialog-intro trial-count">The round button beside each one plays it by itself.</p>
    ${SHOW_GROUPS.map(([title,ids])=>`<fieldset class="trial-group"><legend>${title}</legend>${ids.map(id=>{
      const s=named(id), open=trialOpen(s), needs=s.after?'needs '+named(s.after).name:s.any?'needs a visitor or the orca':'';
      return `<div class="trial-line ${needs?'child':''}"><label><input type="checkbox" data-trial="${id}" ${trial.has(id)?'checked':''} ${open?'':'disabled'}><span>${s.name}</span>${needs && !open?`<small>${needs}</small>`:''}</label>
        <button type="button" class="round-button" data-act="trial-one" data-pick="${id}" aria-label="Play ${s.name} by itself">${icon('play',15)}</button></div>`;
    }).join('')}</fieldset>`).join('')}
    <fieldset><legend>Ending</legend><label class="setting-line"><span>Pin her stage badge in the meadow</span><input type="checkbox" id="trial-rosette" ${trialRosette?'checked':''}></label></fieldset>
    <div class="actions">${action('Play this show','trial-play','play')}${action('Back to Grown-ups','parents','','secondary')}</div>`,'Try out the show');
  $('#trial-timeline').addEventListener('toggle',e=>{trialTimeline=e.target.open;});
}
function showPanel(picked='') {
  if(!profile.settings.sparkles) return '';
  const choices=showDue(profile)?showChoices(profile):[];
  if(!picked && !choices.length) return '';
  return `<div id="show-add">${picked?`<p id="sticker-receipt" tabindex="-1">You picked ${escapeText(picked)}!</p>`:''}
    ${choices.length?`<section class="show-add"><h2>Pick a sticker</h2><div class="show-picks">${choices.map(id=>
      `<button type="button" class="show-pick" data-act="add-to-show" data-pick="${id}"><canvas data-preview="${id}" aria-hidden="true"></canvas><span>${SHOW.find(s=>s.id===id).name}</span></button>`).join('')}</div></section>`:''}</div>`;
}
function startPreviews() {
  const finds=WORDS.filter(w=>profile.cards[w]), word=pageWord();
  const fresh=[...document.querySelectorAll('canvas[data-preview]:not([data-on])')];
  for(const c of fresh){c.dataset.on='1';launchFinale(null,{into:c,alone:c.dataset.preview,picks:profile.show.picks,finds,word});}
  // Bring the choices into view as they arrive, in case they are below the bottom of the screen.
  if(fresh.length) setTimeout(()=>$('#show-add')?.scrollIntoView({block:'nearest',behavior:'smooth'}),550);
}
dialog.addEventListener('close',()=>{
  if(classChanged || ['home','album','stickers'].includes(view) || (view==='found' && $('.found').classList.contains('victory')!==profile.settings.sparkles)) render();
  classChanged=false;
  if(lastFocus?.isConnected) {lastFocus.focus({preventScroll:true});return;}
  if(lastFocus?.dataset.act==='inspect-badge') {
    const {stage,rank}=lastFocus.dataset;
    const owner=lastFocus.closest('.badge-menu')?$('.badge-menu'):main;
    const button=$(`[data-act="inspect-badge"][data-stage="${stage}"][data-rank="${rank}"]`,owner);
    const shelf=button?.closest('details');
    if(shelf) shelf.open=true;
    button?.focus({preventScroll:true});
  }
});
window.addEventListener('popstate',()=>{stopSound();if(dialog.open)dialog.close();render();afterNavigate();});
window.addEventListener('storage',e=>{if(e.key===KEY && !dialog.open){try{profile=normalise(JSON.parse(e.newValue));render();}catch{/* Keep the current album. */}}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden) wake();});
window.addEventListener('online',wake);
render();
wake();
