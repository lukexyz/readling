import {loadSpriteShot} from './sprite-shot.js';

const directory=new URL('./assets/prism/',import.meta.url);
const counts=[48,56,64];

function family(key,title,intro,palette,levels,firstRequires) {
  const ids=[key,key+'-2',key+'-3'];
  const shots=levels.map(([caption,description],i)=>{
    const level=i+1, take=key+'-'+level;
    return {id:ids[i],after:i ? ids[i-1] : firstRequires,family:key,level,name:title+' · Level '+level,
      title:caption,description,frames:counts[i],fps:20,crop:[0,0,384,288],
      still:new URL(take+'-poster.webp',directory).href,load:()=>loadSpriteShot(new URL(take+'.json',directory))};
  });
  return {key,title,intro,palette,shots};
}
export const prismFamilies=[
  family('rainbow','Rainbow','Follow the colours from one foot of the arch to the other.',['#657c89','#27374d'],[
    ['First light','A little arc of polished colour unfurls.'],
    ['Prism bridge','Seven opal bands sweep in opposing directions between gold feet.'],
    ['Aurora crown','A jewelled crest rises over the completed arch.']]),
  family('rainbow2','Double rainbow','Watch the two arches answer one another.',['#697387','#2c3451'],[
    ['Echo arches','Gold and silver arches light up along two separate paths.'],
    ['Twin orbits','Two ringed planets travel the arches with their little moons.'],
    ['Celestial halo','A sun dial crowns the arches as moons and hanging stars appear.']],'rainbow'),
  family('slide','Rainbow slide','Follow the gold star along the track and into the air.',['#5b788d','#293756'],[
    ['Star rider','A gold star takes its first ride down the rainbow.'],
    ['Switchback','The star banks through three tiers of rainbow track.'],
    ['Corkscrew comet','The star loops the corkscrew and jumps a gap to its landing ramp.']],'rainbow'),
  family('ribbon','Rainbow ribbon','Watch a length of coloured silk tie itself into a bow.',['#6c758c','#2c344f'],[
    ['Silk bow','A single ribbon loops into a bow.'],
    ['Figure eight','The silk crosses itself as a second loop opens.'],
    ['Festival rosette','Five silk loops cinch into a rosette with trailing tails.']],'rainbow'),
  family('blooms','Flower fireworks','Watch for the moment each spark becomes a petal.',['#5b526b','#28223e'],[
    ['Silk poppy','One climbing spark opens into a pink poppy.'],
    ['Dahlia and gold poppy','A dahlia opens in layers beside a golden poppy.'],
    ['Midnight bouquet','Five fireworks bloom in succession, with lilies, poppies and dahlias.']]),
  family('paint','Paint fireworks','Follow the paint from the rising drop to the splash.',['#59677c','#262e46'],[
    ['Apricot splash','A drop of apricot pigment opens into a splat.'],
    ['Peacock and rose','Two colours meet and break into smaller beads.'],
    ['Collision crown','Colliding colours throw a crown of droplets into the air.']]),
  family('picture','Picture fireworks','The sparks trace the picture from her word card.',['#524d68','#201d35'],[
    ['Star portrait','A little ring opens and pinpoints of light draw the picture.'],
    ['Mirror comets','Twin comets frame the picture as it lights up.'],
    ['Crown of sparks','A golden firework crowns the picture before its sparks fall away.']])
];
export const prismShots=prismFamilies.flatMap(f=>f.shots);
export const prismByFamily=Object.fromEntries(prismFamilies.map(f=>[f.key,f.shots]));
export function highestPrism(key,have) {
  return prismByFamily[key]?.findLast(s=>have(s.id));
}
// Both families share the same Blender camera. Their feet line up when the two frames are registered.
export const archBox=[.04,.018,.92,1.25];
