"""Pack the Blender concept frames as transparent WebP sheets for the preview."""
import json
from pathlib import Path
import sys

from PIL import Image

root = Path(__file__).resolve().parents[2]
out = root/"dist/assets/ember-orca"
size = 1536
gutter = 2


def pack_shot(folder, out, stem, count):
    frames = [None]*count
    sprites = []
    for index in range(count):
        with Image.open(folder/f"{index+1:03}.png") as source:
            bounds = source.getchannel("A").getbbox()
            if bounds:
                if 0 in bounds[:2] or bounds[2] == source.width or bounds[3] == source.height:
                    raise ValueError(f"{stem}, frame {index+1} touches the camera edge")
                sprites.append((index, bounds, source.crop(bounds)))
    # Tallest first. Leave transparent gutters for bilinear filtering on tablets.
    sprites.sort(key=lambda item: item[2].height, reverse=True)
    sheets = []
    shelves = []
    for index, bounds, image in sprites:
        w,h = image.size
        shelf = next((row for row in shelves if row[3]>=h and row[1]+w+gutter<=size), None)
        if shelf is None:
            page = len(sheets)-1
            y = shelves[-1][2]+shelves[-1][3]+2*gutter if shelves else gutter
            if page<0 or y+h+gutter>size:
                sheets.append(Image.new("RGBA",(size,size)))
                page += 1
                y = gutter
            shelf = [page,gutter,y,h]
            shelves.append(shelf)
        page,x,y,_ = shelf
        sheets[page].paste(image,(x,y))
        frames[index] = [page,x,y,w,h,*bounds[:2]]
        shelf[1] += w+2*gutter
    files = []
    for index,sheet in enumerate(sheets):
        right,bottom = sheet.getchannel("A").getbbox()[2:]
        name = f"{stem}-{index+1}.webp"
        sheet.crop((0,0,right+gutter,bottom+gutter)).save(out/name,quality=91,method=6,alpha_quality=100,exact=True)
        files.append(name)
    manifest = {"sheets":files,"frames":frames}
    (out/f"{stem}.json").write_text(json.dumps(manifest,separators=(",",":"))+"\n",encoding="utf-8")


if __name__ == "__main__":
    counts = {1:72, 2:86, 3:126}
    for level in map(int,sys.argv[1:]) if sys.argv[1:] else counts:
        pack_shot(root/"assets/videos"/f"orca-level-{level}",out,f"concept-{level}",counts[level])
