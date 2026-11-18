// Fit the original camera crop inside the available space without enlarging any source pixel.
// The game strip uses device pixels. Thumbnails use their own logical coordinates.
export function fitShot(ctx, crop, availableWidth, availableHeight, centre, bottom) {
  const [x,y,w,h]=crop;
  const transform=ctx.getTransform();
  const pixelsPerUnit=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
  const scale=Math.min(1/pixelsPerUnit,availableWidth/w,availableHeight/h);
  ctx.translate(Math.round(centre-(x+w/2)*scale),Math.round(bottom-(y+h)*scale));
  ctx.scale(scale,scale);
}

// Fixed-camera Blender frames are trimmed independently. Restore their original
// offsets on a transparent canvas so droplets and the animal share one trajectory.
export async function loadSpriteShot(manifest) {
  const response = await fetch(manifest);
  if (!response.ok) throw new Error('Missing animation '+manifest.pathname);
  const {frames, sheets:files, anchors, hats, poster} = await response.json();
  const sheets = await Promise.all(files.map(async file => {
    const image = new Image();
    image.src = new URL(file, manifest).href;
    await image.decode();
    return image;
  }));
  return {
    length:frames.length, anchors, hats, poster,
    paint(ctx,index) {
      const frame = frames[index];
      if (!frame) return;
      const [sheet,sx,sy,w,h,x,y] = frame;
      ctx.drawImage(sheets[sheet],sx,sy,w,h,x,y,w,h);
    }
  };
}
