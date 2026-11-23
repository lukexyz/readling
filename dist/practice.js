const storageKey='readling.quiet-practice';
const perMinute=60000;
const wordWindow=2*perMinute;
const maxFinalWords=3;
const clamp=n=>Math.max(0,Math.min(1,n));
const practiceHint='Watch the seeds fall. The last one sprouts.';

function hourglassArt(id) {
  const glass='M44 20C44 29 53 34 61 40Q63 41.5 61 43C52 49 44 56 44 65Q64 71 84 65C84 56 76 49 67 43Q65 41.5 67 40C75 34 84 29 84 20Z';
  return `<svg class="hourglass-art" viewBox="36 4 56 75" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="${id}-glass"><path d="${glass}"/></clipPath>
      <pattern id="${id}-seeds" width="8" height="6" patternUnits="userSpaceOnUse">
        <rect width="8" height="6" fill="#e9b957"/><path d="M1 4q1.5-2 2.5-1.6Q3.1 4.2 1 4Z" fill="#b98236"/><path d="M5 1l1 .7" stroke="#ffe5a1" stroke-linecap="round"/>
      </pattern>
    </defs>
    <ellipse cx="64" cy="75" rx="22" ry="2.4" fill="#b4c2a8" opacity=".7"/>
    <g stroke-linecap="round" stroke-linejoin="round">
      <path d="${glass}" fill="#e6efe5"/>
      <g clip-path="url(#${id}-glass)">
        <path class="hourglass-seed" d="M64 42q-2.6 2.2-.4 4 2.5-1.9.4-4Z" fill="#be8738"/>
        <g fill="url(#${id}-seeds)">
          <path class="hourglass-upper"/><path class="hourglass-lower"/>
        </g>
        <path d="M48 24q2 5 7 8m-6 26-1 3" fill="none" stroke="#fffdf1" stroke-width="2" opacity=".85"/>
      </g>
      <path d="${glass}" fill="none" stroke="#526353" stroke-width="1.6"/>
      <path d="M41 19Q45 12 54 11Q60 9 63 10Q64 6 68 6L69 9Q66 10 66 12Q80 11 86 18Q88 21 82 22Q64 25 44 22Q40 22 41 19Z" fill="#ac875c" stroke="#634e39" stroke-width="1.6"/>
      <path d="M47 17q2 3 5 1m1-4q3 3 5 1m2 3q3 3 5 0m3-4q2 3 5 1m1 3q3 2 5 0" fill="none" stroke="#725735" stroke-width="1.4"/>
      <path d="M42 64Q64 70 86 64Q85 72 68 75Q64 77 60 75Q44 72 42 64Z" fill="#ac875c" stroke="#634e39" stroke-width="1.6"/>
      <path d="M48 68q14 5 29 1" fill="none" stroke="#d3b286" stroke-width="1.3"/>
      <g class="hourglass-sprout">
        <path d="M64 57Q62 52 66 47" fill="none" stroke="#42634a" stroke-width="1.8"/>
        <path d="M64 53Q57 54 55 48.5Q62 47 64 53Z" fill="#91aa70" stroke="#4f724f"/>
        <path d="M64 50Q66 44 71 46Q71 51 64 50Z" fill="#759861" stroke="#4f724f"/>
        <path d="M60 58Q61 54 64 55Q68 52 70 55Q66 59 60 58Z" fill="#b8833c" stroke="#956937" stroke-width=".8"/>
      </g>
    </g>
  </svg>`;
}

function fillHourglass(svg,progress,running) {
  const surface=42-18*Math.sqrt(1-progress);
  const pile=Math.sqrt(progress), left=64-26*pile, right=64+26*pile, peak=68-12*pile;
  svg.querySelector('.hourglass-upper').setAttribute('d',progress<1?`M40 ${surface}Q64 ${surface+2} 88 ${surface}V42H40Z`:'');
  svg.querySelector('.hourglass-lower').setAttribute('d',progress>0?`M${left} 68C${left+8*pile} 68 ${64-4*pile} ${peak} 64 ${peak}S${right-8*pile} 68 ${right} 68V71H${left}Z`:'');
  svg.classList.toggle('seeds-falling',running);
  svg.classList.toggle('seed-sprouted',progress>=1);
}

export function practiceControls() {
  return `<fieldset class="practice-settings" id="practice-settings"><legend>Quiet practice</legend>
    <div class="practice-options"><div><p id="practice-summary">${practiceHint}</p>
      <div class="practice-buttons"><button type="button" data-act="practice-add" data-minutes="15">+15 min</button>
      <button type="button" data-act="practice-add" data-minutes="10">+10 min</button>
      <button type="button" data-act="practice-end" hidden>End session</button></div></div>
      ${hourglassArt('settings-hourglass')}</div></fieldset>`;
}

function readSession() {
  try {
    const s=JSON.parse(sessionStorage.getItem(storageKey));
    if(s && Number.isSafeInteger(s.start) && Number.isSafeInteger(s.end) && s.end>s.start &&
       Number.isFinite(s.filled) && s.filled>=0 && s.filled<1) {
      return {...s,began:Number.isSafeInteger(s.began) && s.began<=s.start?s.began:s.start,
        reads:Number.isSafeInteger(s.reads) && s.reads>=0?s.reads:0,
        wordsLeft:Number.isInteger(s.wordsLeft) && s.wordsLeft>=1 && s.wordsLeft<=maxFinalWords?s.wordsLeft:null};
    }
  } catch { /* The current page also works without browser storage. */ }
  return null;
}

function progressAt(session,now) {
  return session.filled+(1-session.filled)*clamp((now-session.start)/(session.end-session.start));
}

export function createPracticeTimer(announce,isReadingWord) {
  const button=document.createElement('button');
  button.type='button';button.className='practice-hourglass';button.hidden=true;
  button.setAttribute('aria-controls','practice-remaining');
  button.innerHTML=hourglassArt('corner-hourglass')+'<span id="practice-remaining" role="timer" aria-live="off" hidden></span>';
  const art=button.querySelector('svg'), digits=button.lastElementChild;
  let session=readSession(), finished=false, timeout;

  function save() {
    try {
      if(session && !finished) sessionStorage.setItem(storageKey,JSON.stringify(session));
      else sessionStorage.removeItem(storageKey);
    } catch { /* Keep the live session in memory. */ }
  }
  function updateWordGoal(now,remaining,read) {
    const previous=session.wordsLeft;
    if(!remaining) {
      // The word already on screen can finish even after the sand runs out.
      session.wordsLeft=(read || isReadingWord())?1:0;
    } else if(remaining<=wordWindow && previous===null) {
      const pace=session.reads?(now-session.began)/session.reads:wordWindow/maxFinalWords;
      session.wordsLeft=Math.max(1,Math.min(maxFinalWords,Math.round(remaining/Math.max(1,pace))));
    }
    if(read) {
      session.reads++;
      if(session.wordsLeft!==null) session.wordsLeft=Math.max(0,session.wordsLeft-1);
    }
    finished=session.wordsLeft===0;
    if(previous!==session.wordsLeft) {
      session.hideWordCount=false;
      announce(finished?'Quiet practice complete. Your seed has sprouted.':wordPrompt());
    }
    if(read || previous!==session.wordsLeft) save();
  }
  function wordPrompt() {
    return session.wordsLeft===1?'One last word!':session.wordsLeft+' more words!';
  }
  function update(read) {
    clearTimeout(timeout);
    const now=Date.now(), remaining=session?Math.max(0,session.end-now):0;
    if(session && !finished) updateWordGoal(now,remaining,read);
    const seconds=Math.ceil(remaining/1000), time=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
    const progress=finished?1:session?Math.min(.99,progressAt(session,now)):0;
    const running=remaining>0 && !finished, words=session?.wordsLeft;
    button.hidden=!session;
    if(session) {
      const showLabel=words?!session.hideWordCount:session.exact===true;
      const label=words?'word count':'time remaining';
      button.setAttribute('aria-label',finished?'Your seed has sprouted. Put the hourglass away.':
        'Acorn hourglass. '+(showLabel?'Hide ':'Show ')+label+'.');
      if(finished) button.removeAttribute('aria-expanded');
      else button.setAttribute('aria-expanded',String(showLabel));
      if(showLabel && !finished) button.setAttribute('aria-describedby',digits.id);
      else button.removeAttribute('aria-describedby');
      digits.hidden=!finished && !showLabel;
      digits.textContent=finished?'Done!':words?words+(words===1?' word':' words'):time;
      fillHourglass(art,progress,running);
    }
    const panel=document.getElementById('practice-settings');
    if(panel?.closest('dialog[open]')) {
      fillHourglass(panel.querySelector('svg'),progress,running);
      let summary=session?time+' remaining':practiceHint;
      if(words) summary=running?wordPrompt()+' · '+summary:'Finish this word and your seed will sprout.';
      if(finished) summary='Your seed has sprouted.';
      panel.querySelector('#practice-summary').textContent=summary;
      panel.querySelector('[data-act="practice-end"]').hidden=!session || finished;
    }
    if(running && !document.hidden) timeout=setTimeout(refresh,remaining%1000 || 1000);
  }
  function refresh() {update(false);}
  function wordRead() {if(session && !finished) update(true);}
  function end() {
    session=null;finished=false;save();refresh();
  }
  function add(minutes) {
    const now=Date.now(), running=session && !finished && session.end>now;
    // Seeds that have fallen stay in the lower chamber when a grown-up adds time.
    session={start:now,end:(running?session.end:now)+minutes*perMinute,
      began:running?session.began:now,reads:running?session.reads:0,wordsLeft:null,
      filled:running?progressAt(session,now):0,exact:!!(running && session.exact)};
    finished=false;save();refresh();
    announce(running?minutes+' minutes added to quiet practice.':'Quiet practice started for '+minutes+' minutes.');
  }
  button.addEventListener('click',()=>{
    if(!session) return;
    refresh();
    if(finished) {end();document.querySelector('.parents-link')?.focus({preventScroll:true});return;}
    if(session.wordsLeft) session.hideWordCount=!session.hideWordCount;
    else session.exact=!session.exact;
    save();refresh();
    if(!digits.hidden) announce(session.wordsLeft?wordPrompt():digits.textContent+' remaining.');
  });
  document.addEventListener('visibilitychange',refresh);
  window.addEventListener('pageshow',refresh);
  return {button,add,end,refresh,wordRead};
}
