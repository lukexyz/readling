import {loadSpriteShot} from './sprite-shot.js';

function garden(key, familyName, intro, palette, entries) {
  const folder = new URL('./assets/flower-studies/', import.meta.url);
  // Keep the original album ID for the poppy that replaces the first Flowers reward.
  const ids=entries.map((_,i)=>key==='poppy' && i===0 ? 'flowers' : key+'-'+(i+1));
  return {key, title:familyName, intro, palette, shots:entries.map(([title, description, frames, poster], index) => {
    const level=index+1, take=key+'-'+level;
    return {id:ids[index], level, after:ids[index-1], family:key, name:familyName+' · Level '+level, title, description, frames, poster, crop:[0,0,480,360], fps:24,
      still:new URL(take+'-poster.'+(key==='oak'?'webp':'png'), folder).href,
      load:() => loadSpriteShot(new URL(take+'.json', folder))};
  })};
}

export const gardens = [
  garden('poppy','Scarlet poppies','Watch the nodding buds lift and shed their green jackets.',
    ['#edddba','#a8c6ac'],[
      ['The lifted bud','A seed splits. Two little leaves lead the way up to a single crinkled flower.',72,65],
      ['Counterpoint','The stem forks and the flowers open in succession.',84,77],
      ['The scarlet wave','Six poppies rise through fine grasses and let loose a few petals.',96,83]]),
  garden('moonflower','Moonflowers','Follow the twist of each vine as the pale trumpets unwind.',
    ['#435b70','#1c2d44'],[
      ['Pearl trumpet','A tightly folded bud opens its pale, spiralling throat.',68,65],
      ['Twining arch','The vine climbs an arch and opens its flowers along the curve.',80,77],
      ['Crescent garden','Twin vines trace a crescent of blooms with drifting pollen.',92,89]]),
  garden('sunflower','Sunflowers','A striped seed cracks, and a golden flower turns toward the light.',
    ['#e8e4b9','#9fbbb5'],[
      ['First sun','The first flower unfolds around a dark spiral of seeds.',66,57],
      ['Sunward turn','A bowed stalk lifts a golden head toward the light. A green bud cups the stem.',78,68],
      ['Solar court','Two smaller blooms flank the golden crown as pollen tumbles above it.',92,81]]),
  garden('oak','Oak tree','Follow one acorn from its first split to a spreading canopy.',
    ['#efe0af','#abc6b4'],[
      ['First leaves','A cracked acorn sends up a shoot and opens its first lobed leaves.',66,53],
      ['Branch by branch','The stem thickens and young branches spread into a sapling.',78,60],
      ['The acorn drop','A broad oak fills out its crown, then drops a new generation of acorns.',94,85]])
];

export const flowerFamilies=gardens.filter(g=>g.key!=='oak');
export const flowerShots=flowerFamilies.flatMap(g=>g.shots);
