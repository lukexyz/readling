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
