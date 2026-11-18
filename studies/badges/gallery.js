(() => {
  "use strict";
  const art = JSON.parse(document.getElementById("badge-art").textContent);
  const families = {
    oak: {name:"Oak keepsake", material:"Carved wood & acorns", steps:[
      "A single oak shoot rests on a slice of heartwood.", "A second leaf unfolds across the bark.",
      "A polished acorn hangs beside the new branch.", "The second branch opens into a spray of leaves.",
      "Two little acorns sit beneath a full crown of oak leaves."]},
    poppy: {name:"Poppy ribbon", material:"Folded petals & silk", steps:[
      "Five folded petals frame an ivory seed case.", "A sixth petal opens above longer ribbon tails.",
      "A second layer of deep red petals peeks through.", "Eight curled petals gather around a ring of dark seeds.",
      "The full double poppy sits on a long pair of forked ribbons."]},
    moth: {name:"Moon moth", material:"Jade enamel & gold wire", steps:[
      "Two jade wings carry a single pair of eyespots.", "A second pair of eyespots appears on the lower wings.",
      "The outer wings gain a pair of tiny guide stars.", "Fine gold eyespots reach into both swallowtails.",
      "Five pairs of markings span the moth's widest wings."]},
    book: {name:"Pocket field guide", material:"Bookcloth & gilt paper", steps:[
      "One foil-stamped tree on a blue cloth cover.", "Two trees grow on a moss-green cover.",
      "A red binding gains brass corners and a second bookmark.", "Four trees fill the cover of a deep teal volume.",
      "The midnight-blue volume holds a little forest and three bookmarks."]},
    compass: {name:"Star compass", material:"Brass & midnight enamel", steps:[
      "A four-point brass rose sits in an octagonal pocket case.", "Jade rivets mark the rim of the dial.",
      "Four shorter needles complete an eight-point rose.", "Gold leaves unfurl at the two lower corners.",
      "A double laurel spray frames the full instrument."]}
  };
  const styles = {
    notes:{name:"Field notes",description:"A ruled pocket notebook",title:"My field notes",icon:"book",badge:"book",tint:"#eae3cb",ink:"#5c6b54"},
    trail:{name:"Acorn trail",description:"A path of growing shoots",title:"My woodland trail",icon:"leaf",badge:"oak",tint:"#dce8d2",ink:"#416246"},
    night:{name:"Night atlas",description:"A little constellation",title:"My star chart",icon:"spark",badge:"moth",tint:"#dce2e4",ink:"#354c60"},
    stamps:{name:"Stamp book",description:"A page of inked stamps",title:"My stamp book",icon:"stamp",badge:"poppy",tint:"#f2decd",ink:"#965e49"},
    shelf:{name:"Prize shelf",description:"A row of brass keepsakes",title:"My prize shelf",icon:"cup",badge:"compass",tint:"#f1e5c5",ink:"#856833"}
  };
  const paths = {
    star:'<path d="m12 2.6 2.8 5.7 6.3.9-4.5 4.4 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.5-4.4 6.3-.9z"/>',
    spark:'<path d="m12 2 2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    leaf:'<path d="M12 21v-9m0 5C5 18 3 13 3 9c5 0 9 2 9 8Zm0-5c0-5 3-8 9-9 0 5-3 9-9 9Z"/>',
    book:'<path d="M3 5q5-2 9 1 4-3 9-1v14q-5-1.6-9 1-4-2.6-9-1Zm9 1v14"/>',
    sound:'<path d="M3 9h4l5-4v14l-5-4H3Zm13-1q4 4 0 8m2-11q7 7 0 14"/>',
    memory:'<path d="M5 5H3v15h11v-2"/><rect x="7" y="2.5" width="13" height="15" rx="2"/><path d="m13.5 6 1 2.6 2.5 1-2.5 1-1 2.6-1-2.6-2.5-1 2.5-1z"/>',
    stamp:'<path d="M4 5q2 0 2-2h12q0 2 2 2v14q-2 0-2 2H6q0-2-2-2z"/><path d="m8 15 3-5 2 3 2-4 2 6z"/>',
    cup:'<path d="M7 4h10v5q0 5-5 6-5-1-5-6Zm0 2H3q0 6 5 6m9-6h4q0 6-5 6m-4 3v4m-4 1h8"/>',
    down:'<path d="m7 10 5 5 5-5"/>'
  };
  const icon = key => '<svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">'+paths[key]+'</svg>';
  const byId = id => document.getElementById(id);
  const image = (key,level) => art[key+"-"+level];
  const thresholds = ["Start","3 words","6 words","9 words","12 words"];
  const choiceKey = "readling.badge-study.picks.v1";
  const picks = {badges:{}, panel:""};
  try {
    const saved = JSON.parse(localStorage.getItem(choiceKey));
    for(let n=1;n<=5;n++) if (Object.hasOwn(families,saved?.badges?.[n])) picks.badges[n]=saved.badges[n];
    if (Object.hasOwn(styles,saved?.panel)) picks.panel=saved.panel;
  } catch { /* The gallery also works as a local file with storage disabled. */ }
  let style = picks.panel || "notes";
  let specimen = null;
  const board = byId("badge-board"), detail=byId("detail");
  const panel = byId("star-panel"), counter = byId("star-counter");
  function savePicks(message) {
    try {localStorage.setItem(choiceKey,JSON.stringify(picks));} catch {}
    updateSummary();
    byId("announce").textContent=message;
  }

  function drawBoard() {
    const filter=byId("level-filter").value;
    const levels=filter==="all" ? [1,2,3,4,5] : [Number(filter)];
    board.classList.toggle("filtered",filter!=="all");
    const header = filter==="all" ? '<div class="board-head" aria-hidden="true"><span></span>'+
      levels.map(n=>'<span>Level '+n+'<small>'+thresholds[n-1]+'</small></span>').join("")+'</div>' : '';
    board.innerHTML=header+Object.entries(families).map(([key,f])=>'<article class="badge-row '+key+'">'+
      '<div class="badge-name"><h3>'+f.name+'</h3><p>'+f.material+'</p></div>'+
      levels.map(n=>{
        const picked=picks.badges[n]===key;
        return '<button type="button" class="badge-cell" data-family="'+key+'" data-level="'+n+'" data-picked="'+picked+
          '" aria-haspopup="dialog" aria-label="'+f.name+', level '+n+(picked?', picked':'')+'"><img width="128" height="128" src="'+
          image(key,n)+'" alt=""><span aria-hidden="true" class="cell-word">Level '+n+'</span></button>';
      }).join("")+'</article>').join("");
  }
  function openBadge(key,n) {
    specimen={key,n};
    const family=families[key];
    byId("detail-img").src=image(key,n);
    byId("detail-img").alt=family.name+" badge, level "+n;
    byId("detail-img").parentElement.className="detail-art "+key;
    byId("detail-level").textContent="Level "+n+" · "+thresholds[n-1];
    byId("detail-title").textContent=family.name;
    byId("detail-note").textContent=family.steps[n-1];
    byId("choose-one").textContent=picks.badges[n]===key?"Picked for level "+n:"Pick for level "+n;
    detail.showModal();
    byId("choose-one").focus({preventScroll:true});
  }
  function closeBadge(restore=false) {
    detail.close();
    if(restore && specimen) board.querySelector('[data-family="'+specimen.key+'"][data-level="'+specimen.n+'"]')?.focus({preventScroll:true});
  }
  function pickBadge(whole) {
    const {key,n}=specimen;
    for(const level of whole?[1,2,3,4,5]:[n]) picks.badges[level]=key;
    savePicks(families[key].name+(whole?" picked for all levels.":" picked for level "+n+"."));
    drawBoard();
    if(!panel.hidden) drawPanel();
    closeBadge(true);
  }
  byId("level-filter").addEventListener("change",drawBoard);
  board.addEventListener("click",e=>{
    const cell=e.target.closest("[data-family]");
    if(cell) openBadge(cell.dataset.family,Number(cell.dataset.level));
  });
  byId("detail-close").addEventListener("click",()=>closeBadge());
  detail.addEventListener("click",e=>{
    if(e.target!==detail) return;
    const r=detail.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeBadge();
  });
  byId("choose-one").addEventListener("click",()=>pickBadge(false));
  byId("choose-set").addEventListener("click",()=>pickBadge(true));

  // The published album has 12 words. It counts a new word as five stars and
  // each first picture choice as one memory read earning one further star.
  const words="cat hat mat dog log pot sun bug cup hen pen pig".split(" ");
  const exampleReads = {0:0,3:2,8:7,12:15};
  function sampleAlbum() {
    const found=Number(byId("sample").value), reads=exampleReads[found];
    return {found,reads,stars:found*5+reads,sounds:new Set(words.slice(0,found).join("")).size,
      level:1+Math.floor(found/3), within:found===words.length?3:found%3, complete:found===words.length};
  }
  function drawStyles() {
    byId("styles").innerHTML=Object.entries(styles).map(([key,s])=>
      '<button type="button" class="style-choice" data-style="'+key+'" aria-pressed="'+(style===key)+'">'+
      '<span class="style-mark" style="--symbol:'+s.ink+';--tint:'+s.tint+'">'+icon(s.icon)+'</span><span><b>'+
      s.name+'</b><small>'+s.description+'</small></span></button>').join("");
  }
  function updateStyleState() {
    byId("styles").querySelectorAll("[data-style]").forEach(button=>button.setAttribute("aria-pressed",button.dataset.style===style));
    byId("choose-pop").textContent=picks.panel===style ? "✓ "+styles[style].name+" picked" : "Pick "+styles[style].name;
  }
  function stats(album) {
    return '<dl class="stats">'+[["book","Words found",album.found],["sound","Sounds met",album.sounds],["memory","Memory reads",album.reads]]
      .map(([key,label,n])=>'<div class="stat"><dt>'+label+'</dt><dd>'+icon(key)+'<span>'+n+'</span></dd></div>').join("")+'</dl>';
  }
  function drawCounter() {
    const a=sampleAlbum();
    counter.innerHTML=icon("star")+'<span>'+a.stars+' stars</span>';
    counter.setAttribute("aria-label",a.stars+" stars, reading progress");
  }
  function drawPanel() {
    const s=styles[style], a=sampleAlbum(), badge=picks.badges[a.level] || s.badge;
    const progressLabel=a.complete?"Word album complete":"Towards level "+(a.level+1);
    const remaining=3-a.within;
    const next=a.complete?"You found every word in the woods.":remaining===1?"One more word to your next badge.":remaining+" more words to your next badge.";
    const marker={trail:"leaf",night:"star",stamps:"stamp",shelf:"cup"}[style];
    const marks=marker ? '<span class="markers" aria-hidden="true">'+[1,2,3].map(n=>'<span class="marker'+(n<=a.within?' filled':'')+'">'+icon(marker)+'</span>').join("")+'</span>' : '';
    panel.className=style;
    panel.style.setProperty("--fill",(a.within/3*100)+"%");
    panel.innerHTML='<div class="panel-inner"><div class="panel-title"><img src="'+image(badge,a.level)+'" alt="">'+
      '<div><h3 id="star-title">'+s.title+'</h3><p>Level '+a.level+' · '+a.stars+' stars</p></div></div>'+
      '<div class="progress-text"><span>'+progressLabel+'</span><small>'+a.within+' of 3 words</small></div>'+
      '<div class="level-track" role="progressbar" aria-label="'+progressLabel+'" aria-valuemin="0" aria-valuemax="3" aria-valuenow="'+a.within+
      '" aria-valuetext="'+(a.complete?"Album complete":a.within+" of 3 new words")+'"><i></i>'+marks+'</div>'+
      '<p class="panel-note">'+next+'</p>'+stats(a)+'</div><button type="button" class="close" aria-label="Close reading progress">×</button>';
  }
  function openPanel(focus=false) {
    drawPanel();
    panel.hidden=false;
    counter.setAttribute("aria-expanded","true");
    if(focus) panel.querySelector(".close").focus({preventScroll:true});
  }
  function closePanel(restore=false) {
    panel.hidden=true;
    counter.setAttribute("aria-expanded","false");
    if(restore) counter.focus({preventScroll:true});
  }
  byId("styles").addEventListener("click",e=>{
    const button=e.target.closest("[data-style]");
    if(!button) return;
    style=button.dataset.style;
    updateStyleState();
    openPanel();
  });
  counter.addEventListener("click",()=>panel.hidden?openPanel(true):closePanel(true));
  panel.addEventListener("click",e=>{if(e.target.closest(".close")) closePanel(true);});
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape" && !panel.hidden && !detail.open){
      e.preventDefault();
      closePanel(true);
    }
  });
  document.addEventListener("pointerdown",e=>{
    if(!panel.hidden && !e.target.closest(".counter-anchor,#styles,.try-toolbar,.pick-pop")) closePanel();
  });
  byId("sample").addEventListener("change",()=>{drawCounter();openPanel();});
  byId("choose-pop").addEventListener("click",()=>{
    picks.panel=style;
    savePicks(styles[style].name+" picked for the star popover.");
    updateStyleState();
  });

  function summaryParts() {
    const badges=Object.entries(picks.badges);
    const parts = badges.length===5 && badges.every(([,key])=>key===badges[0][1]) ?
      ["Levels 1–5: "+families[badges[0][1]].name] :
      badges.map(([level,key])=>"Level "+level+": "+families[key].name);
    if(picks.panel) parts.push("Star popover: "+styles[picks.panel].name);
    return parts;
  }
  function updateSummary() {
    const parts=summaryParts();
    byId("selection-summary").textContent=parts.length?parts.join(" · "):"Choose a badge or a star popover to start your list.";
    byId("copy").disabled=!parts.length;
    byId("copy-fallback").hidden=true;
  }
  byId("copy").addEventListener("click",async()=>{
    const text=summaryParts().join("\n");
    try {
      await navigator.clipboard.writeText(text);
      byId("copy").textContent="Copied";
      byId("announce").textContent="Picks copied.";
      setTimeout(()=>{byId("copy").textContent="Copy picks";},1400);
    } catch {
      const out=byId("copy-fallback");out.textContent=text;out.hidden=false;
      const range=document.createRange();range.selectNodeContents(out);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
      byId("announce").textContent="Your picks are selected for copying.";
    }
  });
  document.querySelectorAll("[data-art]").forEach(img=>{img.src=art[img.dataset.art];});
  drawBoard();drawStyles();drawCounter();updateStyleState();updateSummary();
})();
