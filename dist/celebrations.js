import {SHOW, SHOW_GROUPS} from './game.js';
import {mountCelebrationCards} from './celebration-cards.js';

const cards = mountCelebrationCards(document.querySelector('#cards'), SHOW, {finds:['cat','dog','hen','bug'], word:'cat'});
const filters = document.querySelector('#filters');
const status = document.querySelector('#gallery-status');
const requestedGroup=new URLSearchParams(location.search).get('group');
for (const filter of ['All', ...SHOW_GROUPS.map(([name]) => name)]) {
  const control = document.createElement('button');
  control.type = 'button';
  control.textContent = filter;
  control.setAttribute('aria-pressed', String(filter === 'All'));
  control.addEventListener('click', () => {
    const visible = cards.filterGroup(filter);
    for (const other of filters.children) other.setAttribute('aria-pressed', String(other === control));
    status.textContent = visible + ' celebrations shown.';
  });
  filters.append(control);
  if (filter===requestedGroup) control.click();
}
