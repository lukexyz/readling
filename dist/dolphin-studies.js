import {mountStudy} from './study-player.js';
import {dolphinFamilies, loadDolphin} from './dolphins.js';

const stars=document.querySelector('#stars'), surface=document.querySelector('#surface');
const container=document.querySelector('#studies');
for (const study of dolphinFamilies) {
  const section=document.createElement('section');
  section.className='pod';
  section.id=study.id;
  section.setAttribute('aria-labelledby',study.id+'-title');
  const playLabel=study.levels.length===2?'Play both':'Play all three';
  section.innerHTML=`<div class="pod-heading"><div><h2 id="${study.id}-title">${study.title}</h2>
    <p>${study.motion} <a href="https://www.youtube.com/watch?v=clf_54guaNI&amp;t=${study.reference}s" target="_blank" rel="noreferrer">Film ${study.timing} ↗</a></p></div>
    <button type="button" class="play-all" disabled aria-label="${playLabel} · ${study.title}">${playLabel}</button></div>
    <div class="shots"></div>`;
  container.append(section);
  const gallery=section.querySelector('.shots');
  gallery.dataset.surface=surface.value;
  mountStudy({gallery,together:section.querySelector('.play-all'),idPrefix:study.id,
    stars,surface,shots:study.levels,loadShot:level=>loadDolphin(study.levels[level-1])});
}
