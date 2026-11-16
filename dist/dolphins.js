import {loadSpriteShot} from './sprite-shot.js';

const directory=new URL('./assets/dolphins/',import.meta.url);

// Album IDs and displayed levels belong to the game. A take identifies its original Blender render.
export const dolphinFamilies=[
  {
    id:'skip', title:'Porpoise skip', reference:7, timing:'0:07–0:11',
    motion:'A quick, low arc with a nose-first entry.',
    levels:[
      {id:'dolphins', take:'skip-1', frames:66, title:'First skim',
       description:'One dolphin slips out of the water with a flick of its flukes.', poster:23, beats:[['Lift',15],['Crest',23],['Entry',34]]},
      {id:'dolphins-skip-2', take:'skip-2', frames:107, title:'Double skip',
       description:'A little hop leads into a longer second jump.', poster:63, beats:[['First hop',22],['Lift again',54],['Crest',63]]},
      {id:'dolphins-skip-3', take:'skip-3', frames:120, title:'Follow my lead',
       description:'A calf follows half a beat behind, then catches the adult on the second arc.', poster:68, beats:[['First pair',27],['Together',68],['Last splash',89]]}
    ]
  },
  {
    id:'vault', title:'Skyward vault', reference:17, timing:'0:17–0:24',
    motion:'An upright launch turns toward the viewer at the top.',
    levels:[
      {id:'dolphins-vault-1', take:'vault-1', frames:76, title:'Standing leap',
       description:'The dolphin rises nose-up and folds into a compact dive.', poster:21, beats:[['Rise',17],['Turn',27],['Dive',39]]},
      {id:'dolphins-vault-2', take:'vault-2', frames:102, title:'Silver shoulder',
       description:'A steep tail thrust lifts the dolphin high enough to bank and show its pale flank.', poster:32, beats:[['Launch',20],['Bank',32],['Descent',49]]},
      {id:'dolphins-vault-3', take:'vault-3', frames:99, title:'Twin spires',
       description:'Two launches at different heights hang together for an instant before the dolphins drop.', poster:34, beats:[['Lead',20],['Together',34],['Whitewater',64]]}
    ]
  },
  {
    id:'relay', title:'Silver relay', reference:36, timing:'0:36–0:43',
    motion:'A long sideways flight stretches out over the pod.',
    levels:[
      {id:'dolphins-relay-1', take:'relay-1', frames:73, title:'Long glide',
       description:'A dolphin travels from right to left, straightening its back at the top.', poster:27, beats:[['Rise',18],['Glide',27],['Entry',40]]},
      {id:'dolphins-relay-2', take:'relay-3', frames:112, title:'Pod in flight',
       description:'Three dolphins leave in succession. For a moment all three are airborne.', poster:46, beats:[['Leader',28],['All three',46],['Final entry',78]]}
    ]
  }
].map(family=>({
  ...family,
  levels:family.levels.map((shot,i)=>({
    ...shot, level:i+1, name:family.title+' · Level '+(i+1),
    after:family.levels[i-1]?.id,
    crop:[0,0,560,family.id==='vault' && i>0 ? 400 : 350]
  }))
}));

export const dolphinShots=dolphinFamilies.flatMap(family=>family.levels);
export function loadDolphin(shot) {
  return loadSpriteShot(new URL(shot.take+'.json',directory));
}
export function dolphinPoster(shot) {
  return new URL(shot.take+'-poster.webp',directory).href;
}
