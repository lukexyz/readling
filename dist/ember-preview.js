import {loadShot,shots} from './ember-orca.js';
import {mountStudy} from './study-player.js';

mountStudy({
  gallery:document.querySelector('#shots'), together:document.querySelector('#together'),
  stars:document.querySelector('#stars'), surface:document.querySelector('#surface'), shots, loadShot
});
