// Her finds as paper cut-outs. The cream paper that touches the edge of each picture is cut away,
// and the inked lines are kept as points for the fireworks that take the picture's shape.
const cutouts=new Map();
function cutout(word) {
  let c=cutouts.get(word);
  if(c) return c;
  c={ready:false,canvas:null,points:[]};cutouts.set(word,c);
  const img=new Image();
  img.onload=()=>{
    const n=168, cv=document.createElement('canvas');cv.width=cv.height=n;
    const x=cv.getContext('2d',{willReadFrequently:true});
    try {
      x.drawImage(img,0,0,n,n);
      const data=x.getImageData(0,0,n,n), px=data.data;
      const lum=i=>(px[i*4]*.3+px[i*4+1]*.59+px[i*4+2]*.11)/255;
      // Paper next to an inked line stays, so a small gap in an outline does not let the cut leak inside.
      const paper=new Uint8Array(n*n);
      for(let i=0;i<n*n;i++){
        if(lum(i)<.8) continue;
        const col=i%n;let clear=true;
        for(const d of [-n-1,-n,-n+1,-1,1,n-1,n,n+1]){
          const j=i+d;
          if(j>=0 && j<n*n && Math.abs(j%n-col)<=1 && lum(j)<.6){clear=false;break;}
        }
        paper[i]=clear?1:0;
      }
      const out=new Uint8Array(n*n), stack=[];
      for(let i=0;i<n;i++) stack.push(i,(n-1)*n+i,i*n,i*n+n-1);
      while(stack.length){
        const i=stack.pop();
        if(out[i] || !paper[i]) continue;
        out[i]=1;const col=i%n;
        if(col>0)stack.push(i-1);if(col<n-1)stack.push(i+1);if(i>=n)stack.push(i-n);if(i<n*n-n)stack.push(i+n);
      }
      const dark=[];
      for(let i=0;i<n*n;i++){
        if(out[i]) px[i*4+3]=0;
        else if(lum(i)<.42) dark.push(i);
      }
      x.putImageData(data,0,0);
      const every=Math.max(1,Math.floor(dark.length/170));
      c.points=dark.filter((_,k)=>k%every===0).slice(0,180).map(i=>[(i%n)/n-.5,Math.floor(i/n)/n-.5]);
      c.canvas=cv;c.ready=true;
    } catch { /* A picture that cannot be read is left out of the show. */ }
  };
  // The gallery draws a single frame, so wait until the onload handler has made the cut-out.
  c.loaded=new Promise(resolve=>{
    img.addEventListener('load',()=>resolve(),{once:true});
    img.addEventListener('error',()=>resolve(),{once:true});
  });
  img.src='./assets/words/'+word+'.webp';
  return c;
}
function prepareShow(words) {return Promise.all(words.map(w=>cutout(w).loaded));}

export {cutout,prepareShow};
