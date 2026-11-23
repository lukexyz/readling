import {loadSpriteShot} from './sprite-shot.js';

const directory=new URL('./assets/woodland/',import.meta.url);
const lengths=[72,80,88];

function family(key,title,intro,palette,levels) {
  const ids=[key,key+'-2',key+'-3'];
  const shots=levels.map(([caption,description,meadowDescription],index)=>{
    const level=index+1, take=key+'-'+level;
    return {
      id:ids[index],after:ids[index-1],finds:key==='parade'?2:0,
      family:key,level,name:title+' · Level '+level,title:caption,description,meadowDescription,
      frames:lengths[index],fps:24,crop:[0,0,480,360],
      still:new URL(take+'-poster.webp',directory).href,
      load:()=>loadSpriteShot(new URL(take+'.json',directory))
    };
  });
  return {key,title,intro,palette,shots};
}

export const woodlandFamilies=[
  family('vines','Vines','Follow the growing tips as they coil and meet overhead.',['#e9ddaf','#9abaaa'],[
    ['The first curl','One green runner climbs, opening leaves as it goes.'],
    ['The weaver’s arch','Paired vines reach up and lace together.'],
    ['The wisteria gate','Purple wisteria clusters hang from a canopy of curling vines.']]),
  family('mushrooms','Mushrooms','Watch a little woodland patch rise from the ground.',['#e0d3b1','#93ada3'],[
    ['Scarlet button','A spotted cap lifts and opens.'],
    ['Fern chorus','A cluster of caps rises at different heights among ferns.'],
    ['The fairy ring','A ring of mushrooms grows in sequence with a final shimmer.']]),
  family('bunnies','Bunnies','Watch the ears and hind feet through each leap.',['#ebd9ba','#9ebda6'],[
    ['Hedgerow peek','One rabbit rises to listen, folds its hind legs, then springs.',
      'A rabbit hops out of sight. Two ears peek back over the grass.'],
    ['Follow my feet','A kit chases its parent, leaping a beat behind.',
      'A little rabbit hops into its parent’s pawprints. Its last hop lands just short.'],
    ['Blackberry binkies','Three rabbits twist and kick in midair as they cross the meadow.',
      'Three rabbits leap across the meadow. After they leave, two silver ears peek back.']]),
  family('elephants','Elephants','Follow the marching feet and the curl of each trunk.',['#efdcc2','#a1b8bd'],[
    ['Little stomper','One young elephant steps forward and raises its trunk.'],
    ['Call and answer','A calf walks alongside an adult and answers its trunk call.'],
    ['Family salute','The herd answers its leader with a wave of raised trunks.']]),
  family('parade','Parade','A woodland band rolls past with picture wagons for her word finds.',['#e9debe','#9eb9ad'],[
    ['Pip’s Acorn Express','A wind-up mouse tows a little mail cart with a word picture on its side.'],
    ['The Thimblebeat Two','A hare drums and a hedgehog clashes cymbals as two pictures roll by.'],
    ['The Copperbell Jubilee','A fox conducts the brass band under flying pennants. Three pictures ride on the float.']])
];
export const woodlandShots=woodlandFamilies.flatMap(f=>f.shots);
export const woodlandByKey=Object.fromEntries(woodlandFamilies.map(f=>[f.key,f]));

export function highestWoodland(key,have) {
  return woodlandByKey[key].shots.findLast(shot=>have(shot.id))?.id;
}
