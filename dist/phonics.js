// A spelling can have more than one reading (book / moon). A sound button plays
// the phoneme, never the name of the letters. "phones" also guides media alignment.
const recordings = {
  a:['æ','AE','cat'], b:['b','B','bug'], c:['k','K','cat'], d:['d','D','dog'],
  e:['ɛ','EH','hen'], f:['f','F','fan'], g:['ɡ','G','log'], h:['h','HH','hat'],
  i:['ɪ','IH','pig'], j:['dʒ','JH','jam'], k:['k','K','kit'], l:['l','L','log'],
  m:['m','M','mat'], n:['n','N','hen'], o:['ɒ','AA','pot'], p:['p','P','pen'],
  q:['kw','K W','quit'], r:['ɹ','R','red'], s:['s','S','sun'], t:['t','T','cat'],
  u:['ʌ','AH','cup'], v:['v','V','van'], w:['w','W','wet'], x:['ks','K S','box'],
  y:['j','Y','yes'], z:['z','Z','zip'],
  sh:['ʃ','SH','ship'], ch:['tʃ','CH','chick'], th:['θ','TH','thick'], ng:['ŋ','NG','wing'],
  nk:['ŋk','NG K','sink'], ai:['eɪ','EY','rain'], ee:['iː','IY','bee'], igh:['aɪ','AY','light'],
  oa:['əʊ','OW','boat'], oo:['uː','UW','moon'], 'oo-short':['ʊ','UH','book'],
  ar:['ɑː','AA R','car'], or:['ɔː','AO R','fork'], er:['ɜː','ER','fur'],
  air:['eə','EH R','hair'], ear:['ɪə','IH R','ear'], oi:['ɔɪ','OY','coin'], ow:['aʊ','AW','cow'],
  aw:['ɔː','AO','claw'], yoo:['juː','Y UW','cube'], uh:['ə','AH','lemon'],
};
// Alternate spellings reuse the same isolated recording. Class choices remain distinct.
const aliases = {
  ck:'k', tch:'ch', dge:'j', wh:'w', wr:'r', kn:'n', gn:'n', mb:'m', ph:'f', qu:'q',
  ay:'ai', ea:'ee', ey:'ee', owlong:'oa', ou:'ow', oy:'oi', au:'aw', ir:'er', ur:'er',
  'a_e':'ai', 'e_e':'ee', 'i_e':'igh', 'o_e':'oa', 'u_e':'yoo',
  ll:'l', ss:'s', ff:'f', zz:'z', bb:'b', pp:'p', tt:'t', dd:'d', gg:'g', mm:'m', nn:'n', rr:'r',
};
export const SOUNDS = Object.fromEntries(Object.entries({...Object.fromEntries(Object.keys(recordings).map(k=>[k,k])),...aliases})
  .map(([id,audio])=>{const [ipa,phones,example]=recordings[audio];return [id,{id,audio,ipa,phones,example}];}));
export const AUDIO_SOUNDS = Object.keys(recordings);
const groups = 'tch dge igh air ear sh ch th ng nk ck wh wr kn mb ph qu ai ay ee ea oa oo oi oy ou ow aw au ar or er ir ur ll ss ff zz bb pp tt dd gg mm nn rr'.split(' ');
const ordinary = text => text.match(new RegExp(groups.join('|')+'|[a-z]','g')) || [];

// A reading normally follows the spelling. An editor can give an explicit
// space-separated reading, e.g. "b oo:oo-short k" or "c a_e k" (cake).
export function readSpelling(word, reading) {
  let tokens;
  if (reading !== undefined) {
    if (typeof reading !== 'string' || !reading.trim()) throw Error('Empty reading for '+word);
    tokens=reading.trim().split(/\s+/);
  } else {
    const split=/^(.*?)([aeiou])([bcdfgjklmnpqrstvwxyz])e$/.exec(word);
    tokens=split ? [...ordinary(split[1]),split[2]+'_e',split[3]] : ordinary(word);
  }
  const used=new Set(), units=[];
  for (const token of tokens) {
    if(!/^[a-z]+(?:_[a-z])?(?::[a-z]+(?:[-_][a-z]+)*)?$/.test(token)) throw Error('Invalid reading in '+word+': '+token);
    const [letters,id=letters]=token.split(':');
    if(!Object.hasOwn(SOUNDS,id)) throw Error('Unknown sound '+id+' in '+word);
    const [head,tail]=letters.split('_'), positions=[];
    let pos=0; while(used.has(pos)) pos++;
    for(const c of head) {
      if(word[pos]!==c || used.has(pos)) throw Error('Reading does not spell '+word+': '+token);
      positions.push(pos); used.add(pos++);
    }
    if(tail) {
      const end=word.indexOf(tail,pos+1);
      if(tail.length!==1 || end<0 || used.has(end)) throw Error('Invalid split spelling in '+word);
      positions.push(end); used.add(end);
    }
    units.push({id,letters,positions});
  }
  if(used.size!==word.length) throw Error('Incomplete reading for '+word);
  return units;
}
export const displaySound=id=>id==='oo-short'?'oo (book)':id==='owlong'?'ow (snow)':id.replace('_','…');
