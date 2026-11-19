(()=>{
  'use strict';
  const grassPage=document.body.dataset.study==='grass';
  const concepts=grassPage ? [
    ['dew','Dewdrop lawn','Fine emerald blades rise in a ripple. Clear mint beads gather at their tips.'],
    ['honey','Honey foxtails','Slim green stems lift golden, bristly plumes that nod in a breeze.'],
    ['clover','Clover confetti','Heart-shaped leaflets unfold in threes around little coral-pink flower heads.'],
    ['bells','Bluebell dance','Turquoise leaves fan out as violet and periwinkle bells dip from curved stems.']
  ] : [
    ['sunshower','Sunshower','A wash of spectral light sweeps through the rain and catches on individual drops.'],
    ['prism','Prism mosaic','Pieces of coloured glass lift from both hills and click into a sunlit arch.'],
    ['butterflies','Butterfly waltz','Butterflies rise from the grass and flutter into a rainbow, wingtip to wingtip.']
  ];
  const duration=grassPage ? 2.4 : 3.6;
  const studies=concepts.map(([id,name,description])=>({id,name,description,time:duration,playing:false,
    played:false,waiting:false,revision:0,views:new Set(),error:''}));
  const byId=new Map(studies.map(s=>[s.id,s]));
  const get=id=>document.getElementById(id);
  const images=new Map(), garden=get('designs'), dialog=get('details'), together=get('together');
  const closeButton=get('close'), flower=get('flower'), wordToggle=get('with-word'), meadowToggle=get('in-meadow');
  const TAU=2*Math.PI;
  const grassDir='./assets/grass-studies/';
  let raf=0,previousTick=0,detail=null;

  function loadImage(src) {
    if(images.has(src)) return images.get(src).promise;
    const img=new Image(), asset={img,ready:false};
    images.set(src,asset);
    asset.promise=new Promise((resolve,reject)=>{
      img.onload=()=>{asset.ready=true;resolve(img);paintAll();};
      img.onerror=()=>{images.delete(src);reject(new Error('The artwork could not load.'));};
      img.src=src;
    });
    return asset.promise;
  }
  function bitmap(src){const entry=images.get(src);return entry?.ready?entry.img:null;}
  const flowerFile=()=> './assets/flower-studies/'+flower.value+'-1-poster.png';

  const shapes=[
    [new Path2D('M0 178Q82 150 149 175T308 210Q376 216 449 202T605 184Q695 172 820 133V650H0Z'),'#d3dfc4'],
    [new Path2D('M0 203Q95 164 203 198T405 232Q504 229 618 199T820 184V650H0Z'),'#b7cbb0'],
    [new Path2D('M0 212Q82 210 169 233T387 260Q511 263 643 233T820 211V650H0Z'),'#98b69d']
  ];
  const clouds=new Path2D('M59 81q15-5 30-3 12-10 29-6 11-3 20 2 18 0 27 5-57 4-106 2Z M664 60q15-5 28-4 12-8 24-5 12-1 21 4l20 3q-46 4-93 2Z');
  const tufts=new Path2D('M24 238q23-2 43 3m-14 4 12 1m63 3 28 6m525-9 26-5m59-13 24-4M79 237q-2-12-8-18m8 18q0-17 6-26m-6 26q4-9 9-12m648 10q-2-13-7-19m7 19q1-15 6-22');
  function sky(ctx,h,close) {
    const g=ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,close?'#d7e9e3':'#d5e8e3');g.addColorStop(.57,'#eef1df');g.addColorStop(1,'#fff0ce');
    ctx.fillStyle=g;ctx.fillRect(0,0,820,h);
  }
  function flowerAndGrass(ctx,s,centre,ground,scale) {
    // Align the Blender camera's grass roots with the original flower poster's soil line.
    const x=centre-239*scale, y=ground-337*scale;
    ctx.save();ctx.translate(centre,ground+1);
    ctx.scale(scale,scale);
    const shadow=ctx.createRadialGradient(0,0,5,0,0,173);
    shadow.addColorStop(0,'rgba(46,93,52,.20)');shadow.addColorStop(.70,'rgba(58,105,59,.09)');shadow.addColorStop(1,'rgba(72,110,60,0)');
    ctx.scale(1,.065);ctx.fillStyle=shadow;ctx.fillRect(-175,-175,350,350);ctx.restore();
    const plant=flower.value==='none'?null:bitmap(flowerFile());
    if(plant) ctx.drawImage(plant,x,y,480*scale,360*scale);
    const still=bitmap(grassDir+s.id+'-still.webp'), sheet=bitmap(grassDir+s.id+'-frames.webp');
    const top=y+183*scale,w=480*scale,h=172.8*scale;
    if(s.time>=duration && still) ctx.drawImage(still,x,top,w,h);
    else if(sheet) {
      const f=Math.min(47,Math.floor(s.time*20));
      const cellW=sheet.naturalWidth/8,cellH=sheet.naturalHeight/6;
      ctx.drawImage(sheet,(f%8)*cellW,Math.floor(f/8)*cellH,cellW,cellH,x,top,w,h);
    } else if(still) ctx.drawImage(still,x,top,w,h);
  }
  function wordCard(ctx,x,y,size) {
    ctx.save();ctx.translate(x,y);ctx.rotate(-.05);
    const d=size/2;
    ctx.shadowColor='#3f5d433d';ctx.shadowBlur=8;ctx.shadowOffsetY=4;
    ctx.fillStyle='#fcf3da';ctx.beginPath();ctx.roundRect(-d,-d,size,size,5);ctx.fill();
    ctx.shadowColor='transparent';ctx.strokeStyle='#9c9e82';ctx.lineWidth=1.1;ctx.setLineDash([2,2.4]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#f4ecd0';ctx.fillRect(-d+8,-d+8,size-16,size-16);
    ctx.strokeStyle='#b5ad90';ctx.strokeRect(-d+8,-d+8,size-16,size-16);
    const hat=bitmap('./assets/words/hat.webp');
    if(hat){ctx.globalCompositeOperation='multiply';ctx.drawImage(hat,-d+9,-d+9,size-18,size-18);}
    ctx.restore();
  }
  function meadow(ctx,h,s) {
    sky(ctx,h,false);
    const rise=(h-270)*.30, stretch=(h-rise-12)/270;
    ctx.save();ctx.translate(0,rise);ctx.scale(1,stretch);
    ctx.fillStyle='#f4dba0';ctx.beginPath();ctx.ellipse(112,62,22,22/stretch,0,0,TAU);ctx.fill();
    ctx.fillStyle='#fffaec';ctx.fill(clouds);
    if(!grassPage) window.ReadlingRainbowStudies[s.id](ctx,s.time);
    for(const [path,fill] of shapes){ctx.fillStyle=fill;ctx.fill(path);}
    ctx.strokeStyle='#688a73';ctx.lineCap='round';ctx.lineWidth=1.25;ctx.stroke(tufts);ctx.restore();
    if(grassPage) flowerAndGrass(ctx,s,127,rise+253*stretch,.52);
    if(grassPage || wordToggle.checked) wordCard(ctx,410,rise+137*stretch,183);
  }
  function closeGarden(ctx,h,s) {
    sky(ctx,h,true);
    const rim=h*.68;
    ctx.beginPath();ctx.moveTo(0,rim+22);ctx.bezierCurveTo(95,rim-27,182,rim-32,292,rim+8);
    ctx.bezierCurveTo(505,rim+85,655,rim+1,820,rim-19);ctx.lineTo(820,h);ctx.lineTo(0,h);ctx.fillStyle='#cdddc0';ctx.fill();
    ctx.beginPath();ctx.moveTo(0,rim+32);ctx.bezierCurveTo(151,rim+18,242,rim+62,419,rim+55);
    ctx.bezierCurveTo(572,rim+48,688,rim+18,820,rim+24);ctx.lineTo(820,h);ctx.lineTo(0,h);ctx.fillStyle='#b9d0b1';ctx.fill();
    ctx.beginPath();ctx.moveTo(0,h-31);ctx.bezierCurveTo(216,h-65,380,h-33,538,h-41);
    ctx.bezierCurveTo(682,h-54,756,h-37,820,h-42);ctx.lineTo(820,h);ctx.lineTo(0,h);ctx.fillStyle='#a4c29e';ctx.fill();
    ctx.strokeStyle='#779e815c';ctx.lineWidth=1.1;ctx.lineCap='round';
    for(const [x,y,k] of [[39,h-16,.8],[77,h-30,.52],[731,h-26,.65],[784,h-31,1]]) {
      ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.beginPath();ctx.moveTo(-5,0);ctx.quadraticCurveTo(-10,-6,-16,-7);
      ctx.moveTo(-5,0);ctx.quadraticCurveTo(-6,-10,-2,-14);ctx.moveTo(-5,0);ctx.quadraticCurveTo(0,-6,5,-7);ctx.stroke();ctx.restore();
    }
    flowerAndGrass(ctx,s,409,h-30,Math.min(1.24,(h-42)/320));
  }
  function draw(view) {
    const {canvas,study:s}=view, rect=canvas.getBoundingClientRect();
    if(!rect.width || !rect.height) return;
    const dpr=Math.min(2,devicePixelRatio||1), w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
    if(canvas.width!==w) canvas.width=w;if(canvas.height!==h) canvas.height=h;
    const ctx=view.ctx, logicalHeight=grassPage?376:352;
    ctx.resetTransform();ctx.clearRect(0,0,w,h);
    // Fit an unwarped illustration, including when the enlarged player is in landscape.
    const fit=Math.min(w/820,h/logicalHeight);
    ctx.fillStyle='#dce9df';ctx.fillRect(0,0,w,h);
    ctx.translate((w-820*fit)/2,(h-logicalHeight*fit)/2);ctx.scale(fit,fit);
    if(grassPage && !meadowToggle.checked) closeGarden(ctx,logicalHeight,s);
    else meadow(ctx,logicalHeight,s);
    view.range.value=s.time;
    view.out.textContent=s.time.toFixed(1)+' s';
    view.range.setAttribute('aria-valuetext',s.time.toFixed(1)+' of '+duration+' seconds');
    const label=s.playing || s.waiting?'Pause':s.played && s.time>=duration?'Replay':'Play';
    view.play.classList.toggle('playing',s.playing || s.waiting);
    view.play.querySelector('span').textContent=label;view.play.setAttribute('aria-label',label+' '+s.name);
    view.status.textContent=s.error || (s.waiting?'Loading grass…':'');
  }
  function syncButton() {
    const active=studies.every(s=>s.playing || s.waiting);
    together.classList.toggle('playing',active);
    together.querySelector('span').textContent=active?'Pause all':'Play together';
  }
  function paintAll(){for(const s of studies) for(const v of s.views) draw(v);syncButton();}
  function repaintStudy(s){for(const view of s.views) draw(view);syncButton();}
  function tick(now) {
    raf=0;
    if(now-previousTick>=1000/32) {
      previousTick=now;
      for(const s of studies) if(s.playing) {
        s.time=Math.min(duration,Math.max(0,(now-s.start)/1000));
        if(s.time>=duration) s.playing=false;
        repaintStudy(s);
      }
    }
    if(studies.some(s=>s.playing)) raf=requestAnimationFrame(tick);
  }
  async function begin(list,restart) {
    const requests=list.map(s=>{
      s.waiting=true;s.playing=false;s.error='';repaintStudy(s);
      return {s,revision:++s.revision,from:restart || s.time>=duration ? 0 : s.time};
    });
    await Promise.all(requests.map(async r=>{
      if(!grassPage) return;
      try {await loadImage(grassDir+r.s.id+'-frames.webp');}
      catch {if(r.revision===r.s.revision){r.s.error='Could not load the grass. Press Play to retry.';r.s.waiting=false;}r.failed=true;}
    }));
    const now=performance.now();
    for(const {s,revision,from,failed} of requests) {
      if(revision!==s.revision) continue;
      if(!failed){s.time=from;s.start=now-from*1000;s.playing=true;s.played=true;s.waiting=false;}
      repaintStudy(s);
    }
    if(!raf && studies.some(s=>s.playing)) raf=requestAnimationFrame(tick);
  }
  function pause(s){s.revision++;s.playing=s.waiting=false;repaintStudy(s);}
  function seek(s,time) {
    pause(s);s.time=Math.max(0,Math.min(duration,time));s.played=true;s.error='';repaintStudy(s);
    if(grassPage && s.time<duration) {
      const version=s.revision;
      loadImage(grassDir+s.id+'-frames.webp').catch(()=>{
        if(s.revision===version){s.error='Could not load this frame. Press Play to retry.';repaintStudy(s);}
      });
    }
  }
  function makeView(s,parent,enlarged=false) {
    const stage=document.createElement('div');stage.className='stage';
    if(grassPage) stage.dataset.flower='';
    const canvas=document.createElement('canvas');canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',s.name+' animation. '+s.description);
    stage.append(canvas);
    const status=document.createElement('span');status.className='load';status.setAttribute('role','status');stage.append(status);
    if(!enlarged) {
      const enlarge=document.createElement('button');enlarge.type='button';enlarge.className='enlarge';
      enlarge.title='Enlarge '+s.name;enlarge.setAttribute('aria-label',enlarge.title);
      enlarge.innerHTML='<i class="corners" aria-hidden="true"></i>';enlarge.onclick=()=>openDetail(s,true);stage.append(enlarge);
    }
    const notes=document.createElement('div');notes.className='notes';
    if(!enlarged){const title=document.createElement('h2');title.textContent=s.name;notes.append(title);}
    const desc=document.createElement('p');desc.textContent=s.description;notes.append(desc);
    const controls=document.createElement('div');controls.className='transport';
    const play=document.createElement('button');play.type='button';play.className='play';
    play.innerHTML='<i class="symbol" aria-hidden="true"></i><span>Play</span>';
    const range=document.createElement('input');range.type='range';range.className='position';range.min=0;range.max=duration;range.step=.01;
    range.setAttribute('aria-label',s.name+' animation time');
    const out=document.createElement('output');out.className='time';out.setAttribute('aria-live','off');
    controls.append(play,range,out);notes.append(controls);parent.append(stage,notes);
    const view={canvas,ctx:canvas.getContext('2d'),study:s,play,range,out,status};
    s.views.add(view);observer.observe(canvas);
    play.onclick=()=>{if(s.playing || s.waiting) pause(s);else begin([s],false);};
    range.oninput=()=>seek(s,Number(range.value));
    draw(view);return view;
  }
  const observer=new ResizeObserver(entries=>{
    const changed=new Set(entries.map(e=>e.target));
    for(const s of studies) for(const v of s.views) if(changed.has(v.canvas)) draw(v);
  });
  function releaseDetail(){
    if(!detail) return;
    observer.unobserve(detail.canvas);detail.study.views.delete(detail);detail=null;
    dialog.querySelector('.detail-body').replaceChildren();
  }
  function openDetail(s,updateHash) {
    releaseDetail();get('detail-name').textContent=s.name;
    if(!dialog.open) dialog.showModal();
    detail=makeView(s,dialog.querySelector('.detail-body'),true);
    if(updateHash) history.replaceState(null,'','#'+s.id);
  }
  function fromHash() {
    const s=byId.get(location.hash.slice(1));if(s) openDetail(s,false);else if(dialog.open) dialog.close();
  }
  closeButton.onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{
    if(dialog.open) return;
    releaseDetail();
    if(byId.has(location.hash.slice(1))) history.replaceState(null,'',location.href.split('#')[0]);
  });
  together.onclick=()=>{if(studies.every(s=>s.playing || s.waiting)) studies.forEach(pause);else begin(studies,true);};
  document.addEventListener('visibilitychange',()=>{if(document.hidden) studies.forEach(pause);});
  window.addEventListener('hashchange',fromHash);
  for(const s of studies){
    const item=document.createElement('article');item.className='study';garden.append(item);makeView(s,item);
  }
  function loadFlower() {
    if(flower.value!=='none') loadImage(flowerFile()).catch(()=>{for(const s of studies) s.error='The flower could not load.';paintAll();});
    for(const s of studies) s.error='';paintAll();
  }
  loadImage('./assets/words/hat.webp').catch(()=>{});
  if(grassPage) {
    for(const s of studies) loadImage(grassDir+s.id+'-still.webp').catch(()=>{s.error='Could not load the still. Press Play for the animation.';repaintStudy(s);});
    flower.addEventListener('change',loadFlower);loadFlower();meadowToggle.addEventListener('change',paintAll);
  } else wordToggle.addEventListener('change',paintAll);
  fromHash();
})();
