"""Blender miniatures for Rainbow and Double rainbow.

blender -b -t 2 --python-exit-code 1 -P studies/prism/rainbow_vaults.py -- rainbow 3 render
Use "proof" for four sampled frames. Coordinates are in camera pixels.
"""
import argparse
from math import cos, pi, sin, tau
from pathlib import Path
import shutil
import sys

import bpy
import numpy as np


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("key", choices=("rainbow", "rainbow2"))
parser.add_argument("level", type=int, choices=(1, 2, 3))
parser.add_argument("mode", choices=("render", "proof"))
args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
level = args.level
frames = (48, 56, 64)[level - 1]
settled = (40, 48, 56)[level - 1]
root = Path(__file__).resolve().parents[2]
out = root / "assets/videos/prism" / f"{args.key}-{level}"
out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
scene.display.render_aa = "16"
shading = scene.display.shading
shading.light = "STUDIO"
shading.studio_light = "paint.sl"
shading.color_type = "MATERIAL"
shading.show_specular_highlight = True
shading.show_shadows = False
shading.show_cavity = False
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = .24
scene.render.film_transparent = True
scene.render.resolution_x = 384
scene.render.resolution_y = 288
scene.render.resolution_percentage = 100
scene.render.fps = 20
scene.frame_start, scene.frame_end = 1, frames
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.compression = 25


def put(name, mesh=None, parent=None):
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


cam = put("Fixed orthographic stage", bpy.data.cameras.new("384-pixel aperture"))
cam.data.type = "ORTHO"
cam.data.ortho_scale = 384
cam.data.clip_end = 1300
cam.location = (0, -650, 0)
cam.rotation_euler.x = pi / 2
scene.camera = cam


def material(name, rgb, metal=0.0, rough=.28):
    def linear(v):
        x = v / 255
        return x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4
    color = tuple(linear(int(rgb[i:i+2], 16)) for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.metallic, mat.roughness = metal, rough
    return mat


bronze = material("Oxidised gold", "9A5C39", .42)
gold = material("Spun champagne gold", "F4BE66", .45, .23)
silver = material("Moon silver", "C7DCED", .35)
ivory = material("Pearl lustre", "FFF0BC", .12)
midnight = material("Midnight blue steel", "33456F", .30)
enamel = [material(name, color, .08, .24) for name, color in (
    ("Carmine glass", "CD3D53"), ("Apricot enamel", "FF985B"),
    ("Citron", "FFE173"), ("Deep verdigris", "25866E"),
    ("Glacier opal", "87E4DF"), ("Midnight iolite", "4E59A8"),
    ("Orchid enamel", "D995DF"))]
opal = [material(name, color, .10, .28) for name, color in (
    ("Pink tourmaline", "EC6C89"), ("Peach", "FFC298"),
    ("Honey", "EFB443"), ("Chrysoprase", "58BE92"),
    ("Aquamarine", "B8F2EF"), ("Periwinkle", "839EE9"),
    ("Lilac opal", "E9B9EE"))]


def mesh_object(name, vertices, faces, materials, indices=None, smooth=False, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    for mat in materials:
        mesh.materials.append(mat)
    if indices is not None:
        mesh.polygons.foreach_set("material_index", np.asarray(indices, dtype=np.int32))
    if smooth:
        mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    mesh.update()
    return put(name, mesh, parent)


def ease(f, start, end):
    t = min(1, max(0, (f-start)/(end-start)))
    return t*t*(3-2*t)


# An ellipse normal is used for the band widths, so the shoulders are never pinched.
def track(t, rx, rz, offset=0):
    a = np.pi * t
    s, c = np.sin(a), np.cos(a)
    speed = np.hypot(rx*s, rz*c)
    dx, dz = rx*s/speed, rz*c/speed
    x, z = -rx*c - offset*dz, -63 + rz*s + offset*dx
    return x, z, dx, dz


updates = []


def band(name, rx, rz, offset, radius, depth, y, mats, finish, window=None,
         segments=112, sides=12, fluted=False, facets=False):
    # Lathed end domes and a rounded elliptical section give the unfurling leading
    # edge the same finish as the fixed end. Column offsets cut oblique facets.
    u = np.concatenate(([0, 0], np.linspace(0, 1, segments+1), [1, 1]))[:, None]
    dome = np.ones_like(u)
    dome[[0, -1]] = .015
    dome[[1, -2]] = .73
    cap = np.zeros_like(u)
    cap[[0, 1, -2, -1], 0] = np.array([-1, -.68, .68, 1])*radius*.74
    q = tau*np.arange(sides)/sides
    skew = (.34*np.cos(q)/segments if facets else 0)
    station = u + skew*np.minimum(1, np.minimum(u, 1-u)*segments)
    dr = radius*dome*np.cos(q)
    surf_y = y - depth*dome*np.sin(q)
    faces, indices = [], []
    for row in range(len(u)-1):
        section = min(segments-1, max(0, row-2))
        for j in range(sides):
            a, b = row*sides+j, row*sides+(j+1)%sides
            faces.append((a, b, b+sides, a+sides))
            indices.append(finish(section, j, segments, sides))
    faces.extend((tuple(reversed(range(sides))), tuple(range((len(u)-1)*sides, len(u)*sides))))
    indices.extend((0, 0))

    def vertices(start, end):
        t = start+(end-start)*station
        x, z, dx, dz = track(t, rx, rz, offset)
        relief = dr
        if fluted:
            relief = dr*(1+.036*np.cos(t*24*pi))
        return np.stack(np.broadcast_arrays(x-dz*relief+cap*dx, surf_y,
                                            z+dx*relief+cap*dz), axis=-1).reshape(-1, 3)
    obj = mesh_object(name, vertices(0, 1), faces, mats, indices, smooth=not facets)
    if window is None:
        return
    def update(frame):
        start, end = window(frame)
        obj.hide_render = end-start < .001
        if not obj.hide_render:
            obj.data.vertices.foreach_set("co", vertices(start, end).astype("f").ravel())
            obj.data.update()
    updates.append(update)


def sweep(start, end, reverse=False):
    def interval(f):
        p = ease(f, start, end)
        return (1-p, 1) if reverse else (0, p)
    return interval


def gem(parent, name, w, h, depth, mats, n=8, pointed=False):
    # A high table, a slanted bezel and alternating kite facets cut from one stone.
    vertices = []
    for scale, y in ((1, 0), (.91, -depth*.27), (.51, -depth*.88)):
        for i in range(n):
            a = tau*i/n
            x = sin(a)*(1-.26*abs(cos(a)) if pointed else 1)
            vertices.append((w*scale*x, y, h*scale*cos(a)))
    vertices.append((0, -depth, 0))
    faces, inds = [], []
    for j in range(n):
        k = (j+1) % n
        faces.extend(((j, k, n+k, n+j), (n+j, n+k, 2*n+k),
                      (n+j, 2*n+k, 2*n+j), (2*n+j, 2*n+k, 3*n)))
        inds.extend((0, 1 if j%4 in (0, 3) else 2, 2 if j%3==1 else 1, 1))
    return mesh_object(name, vertices, [f[::-1] for f in faces], mats, inds, parent=parent)


def wire(parent, name, points, radius, mat, closed=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    curve.resolution_u = 1
    curve.use_fill_caps = True
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for pt, coords in zip(spline.points, points):
        pt.co = (*coords, 1)
    spline.use_cyclic_u = closed
    curve.materials.append(mat)
    return put(name, curve, parent)


def sunburst(parent, name, tips, long, short, mats, aspect=1):
    vertices = [(0, -2.7, 0)]
    for j in range(2*tips):
        a = pi*j/tips
        r = short if j%2 else long*(.70 if tips%2==0 and j%4==2 else 1)
        vertices.append((r*sin(a)*aspect, 0, r*cos(a)))
    faces = [(0, (i+1)%(tips*2)+1, i+1) for i in range(tips*2)]
    return mesh_object(name, vertices, faces, mats, [i%len(mats) for i in range(tips*2)], parent=parent)


def place_on_arc(obj, t, rx, rz, off, y, radial=True):
    x, z, dx, dz = track(t, rx, rz, off)
    obj.location = (x, y, z)
    obj.rotation_euler.y = -np.arctan2(dz, dx) if radial else 0


def sprout(obj, start, end):
    def grow(f):
        p = ease(f, start, end)
        obj.hide_render = p < .002
        obj.scale = (p, p, p)
    updates.append(grow)


def wings(parent, span, height, mat):
    # Paired openwork wings, each formed from two bent gold wires.
    for sign in (-1, 1):
        for fraction in (.56, 1):
            path = []
            for u in np.linspace(0, 1, 26):
                path.append((sign*(2+span*sin(pi*u)), -.2,
                             height*(sin(pi*u)**2 - fraction*sin(tau*u)*.5)))
            wire(parent, "Pierced filigree wing", path, .88, mat)


def primary():
    rx, rz = 176, (171 if level==1 else 170)
    widths = ((5.8, 4.3, 5.7, 5.0, 5.8, 4.9, 5.5),
              (7.8, 3.2, 6.0, 4.3, 7.1, 3.6, 5.0),
              (7.6, 3.2, 5.4, 4.0, 6.5, 4.1, 6.2))[level-1]
    inset = 0
    for i, width in enumerate(widths):
        center = -inset
        if level==1:
            window = sweep(-1+1.55*i, 29+1.75*i)
        elif level==2:
            window = sweep(-1+2.25*i, 29+2.8*i, i%2 == 1)
        else:
            # From the centre of the crown the two wings fan down to the feet.
            def window(f, i=i):
                reach = .5*ease(f, -3+1.65*i, 24+1.5*i)
                return .5-reach, .5+reach
        def cut(k, j, n, sides, i=i):
            if level>=2 and (k<1 or k>=n-1):
                return 2
            if level>=2 and i in (0, 4, 6) and 1<=j<=5:
                return int((k//2 + j//2)%5 in (0, 1))
            return 0
        faceted = level>=2 and i in (0, 4, 6)
        band("Cabochon " + enamel[i].name, rx, rz, center, width*.52, width*.48,
             0, [enamel[i], opal[i], gold], cut, window, segments=64 if faceted else 104,
             facets=faceted)
        if i in (0, 6) or (i==3 and level>=2):
            offset = center + (width*.51 if i==0 else -width*.51)
            band("Rolled gold edge", rx, rz, offset, .82, 1.05, .4, [gold],
                 lambda *args: 0, window)
        if i < 6:
            inset += (width + widths[i+1])*.5
    if level>=2:
        for sign in (-1, 1):
            shoe = put("Scallop-shell terminal")
            shoe.location = (sign*(rx-inset/2), -1.3, -63.4)
            # Swept shell flutes gather the seven individual enamels into one foot.
            for j in range(-3, 4):
                w = 2.4 if j%2 else 2.8
                flute = gem(shoe, "Fluted gilt toe", w, 4.5, 2.6, [bronze, gold, ivory], 8)
                flute.location = (j*4.55, -.1, -1.5+abs(j)*.33)
                flute.rotation_euler.y = .19*j
            wire(shoe, "Lower lip of shell", [(x, -.9, -5.4+.014*x*x)
                 for x in np.linspace(-15.6, 15.6, 29)], .95, gold)
            sprout(shoe, 37 if level==2 else 27, 48 if level==2 else 38)
    if level==3:
        # The individual palmettes share a gilded scallop rail. Leaves lean away
        # from the keystone, and each jewel is set into a slightly larger gold cut.
        for j in range(11):
            t = .23+j*.054
            strength = sin(pi*j/10)
            height = 3.4+5.1*strength
            if j==5:
                height = 10.7
            base = put("Aurora palmette")
            place_on_arc(base, t, rx, rz, 4.1, -2.3)
            pivot = put("Inclined gold socket", parent=base)
            pivot.rotation_euler.y = (j-5)*.085
            stone = put("Marquise setting", parent=pivot)
            stone.location.z = height*.94
            w = 2.9+strength*1.3
            gem(stone, "Cut gilt mounting", w+1.1, height+1, 2.4, [bronze, gold, ivory], pointed=True)
            color = (4, 5, 0, 4, 6, 0, 6, 4, 0, 5, 4)[j]
            inner = gem(stone, "Aurora fire opal", w, height-.85, 3.5,
                        [opal[color], enamel[color], opal[color]], pointed=True)
            inner.location.y = -1.8
            if j==5:
                wings(stone, 13.5, 4.4, gold)
                glint = sunburst(stone, "Starlight caught in the keystone", 4, 4.9, .85,
                                 [ivory, gold], .65)
                glint.location.y = -5.2
            sprout(base, 29+j*1.6, 39+j*1.6)
            if j<10:
                link = put("Scalloped diadem chain")
                mid = t+.027
                place_on_arc(link, mid, rx, rz, 4.6, -.2)
                pts = [(x, 0, 1.0 + 3.3*(x/13)**2) for x in np.linspace(-13, 13, 19)]
                wire(link, "Gilt festoon", pts, .78, gold)
                pearl = gem(link, "Seed pearl", 1.65, 1.8, 1.4, [gold, ivory, silver])
                pearl.location.z = 1.2
                sprout(link, 31+j*1.6, 41+j*1.6)


def satellite(obj, start_t, final_t, rx, rz, offset, y, begin, end, lift=0, radial=False):
    def move(f):
        p = ease(f, begin, end)
        q = ease(f, begin, begin+7)
        t = start_t + (final_t-start_t)*p
        place_on_arc(obj, t, rx, rz, offset+lift*sin(tau*p), y, radial=radial)
        obj.scale = (q, q, q)
        if not radial:
            obj.rotation_euler.y = .55*(1-p)
    updates.append(move)


def planet(name, radius, palette, tilt):
    p = put(name)
    ball = gem(p, "Planetary cabochon", radius, radius, radius*.75, palette, n=14)
    ball.location.y = -.15
    orbit = put("Oblique orbit", parent=p)
    orbit.rotation_euler.y = tilt
    points = [(radius*1.67*cos(a), -2.5*sin(a), radius*.49*sin(a)) for a in np.linspace(0, tau, 65)[:-1]]
    wire(orbit, "Saturn ring", points, .95, gold, True)
    return p


def lunar_phase(p, radius, side):
    # Lit crescent cut as a strip between a semicircle and its terminator.
    vs = []
    for a in np.linspace(-pi/2, pi/2, 25):
        vs.extend(((side*radius*cos(a), -4.0, radius*sin(a)),
                   (side*radius*.08*cos(a), -4.15, radius*sin(a))))
    faces = [(j,j+1,j+3,j+2) for j in range(0, len(vs)-2, 2)]
    return mesh_object("Bright terminator", vs, faces, [ivory], parent=p)


def wound_wire(rx, rz, radius, h):
    # A real helix passes behind the front inlay twice per turn. Its two ends
    # revolve into position as the goldsmith's wire winds onto the complete hoop.
    u = np.linspace(0, 1, 390)
    def points(f):
        p = ease(f, 8+h*4, 45+h*3)
        t = u*p if h==0 else 1-u*p
        a = tau*(7.5*t + h*.5)
        x, z, _, _ = track(t, rx, rz, (radius+1.25)*np.sin(a))
        y = -.8 - (radius*.88+2.3)*np.cos(a)
        return np.column_stack((x, y, z, np.ones_like(x)))
    w = wire(None, "Spiral gold ribbon" if h==0 else "Spiral silver ribbon",
             points(56)[:, :3], 1.05 if h==0 else .9, gold if h==0 else silver)
    def wind(f):
        w.hide_render = f<=8+h*4
        w.data.splines[0].points.foreach_set("co", points(f).astype("f").ravel())
    updates.append(wind)


def plumb(rx, h, sign):
    p = put("Hanging astronomical finial")
    p.location = (sign*rx, -2, -63)
    length = 20 if h==0 else 12
    wire(p, "Chain of star weight", [(0, 0, 0), (0, 0, -length*.63)], .95, gold if h==0 else silver)
    cuff = gem(p, "Foot collar", 6 if h==0 else 4.7, 4.5, 2, [bronze, gold, ivory])
    cuff.location.z = -1
    socket = put("Pendant", parent=p)
    socket.location.z = -length*.65
    if h==0:
        sunburst(socket, "Eight-pointed plumb star", 8, 7.4, 2.6, [ivory, gold], .67)
        inset = gem(socket, "Blue centre", 1.9, 2.4, 1.6, [midnight, enamel[5], opal[4]])
        inset.location.y = -2.2
    else:
        gem(socket, "Moonstone drop", 2.9, 4.8, 2.6, [silver, opal[4], ivory], 8)
    def lower(f):
        q = ease(f, 32+h*4, 50+h*3)
        p.scale = (q, q, q)
        p.rotation_euler.y = sign*.34*sin(2*pi*q)*(1-q)
    updates.append(lower)


def double():
    ellipses = [(123, 120, 5.8), (101, 98, 4.8)]
    # Entire metal armatures are present from the first exposure. Each inlay
    # travels over its own hoop. The relief and metal lip remain visible at END.
    for h, (rx, rz, radius) in enumerate(ellipses):
        band("Complete outer armature" if h==0 else "Complete inner armature",
             rx, rz, 0, radius, radius*.67, 0, [bronze if h==0 else midnight, gold if h==0 else silver],
             lambda k, j, n, s: int(j < s//2))
        window = sweep(-5 if h==0 else -3, (35, 40, 37)[level-1]+h*3, reverse=h==1)
        colors = [enamel[i] for i in (0, 1, 2, 3, 4, 5, 6)]
        if h==1:
            colors = [opal[i] for i in (4, 5, 6, 0, 1, 2, 3)]
        mats = [*colors, gold if h==0 else silver]
        def panels(k, j, n, sides, h=h):
            sector, seam = divmod(k, 8)
            if seam==0 and level>=2:
                return 7
            return min(6, sector//2)
        band("Spectral cloisonné panels", rx, rz, .2, radius*.72, radius*.70, -2.2,
             mats, panels, window, segments=112, fluted=level>1)
        if level==1:
            continue
        if level==2:
            body = planet("Copper wanderer" if h==0 else "Silver wanderer",
                          7.7 if h==0 else 6.9, [gold, opal[0], enamel[0]] if h==0
                          else [silver, enamel[4], opal[4]], -.45 if h==0 else .55)
            satellite(body, .03 if h==0 else .97, .67 if h==0 else .30,
                      rx, rz, 2.8*h, -8, 5+h*2, 46+h, 3.4)
            # A smaller moon follows each ringed jewel through the same vault.
            moon = put("Trailing moon")
            gem(moon, "Small pearl moon", 2.4, 2.4, 2.1, [gold, ivory, silver])
            satellite(moon, .015 if h==0 else .985, .628 if h==0 else .352,
                      rx, rz, 1.8, -8, 10+h*2, 47+h, -2.6)
        else:
            wound_wire(rx, rz, radius, h)
            for sign in (-1, 1):
                plumb(rx, h, sign)
            if h==0:
                solar = put("Radiant sun dial")
                wings(solar, 17.5, 4.6, gold)
                sunburst(solar, "Chased sun rays", 12, 13.3, 7.7, [gold, ivory])
                heart = gem(solar, "Amber solar disk", 7.4, 7.4, 3.2, [bronze, opal[1], enamel[1]], 14)
                heart.location.y = -3.1
                flare = sunburst(solar, "Diamond of daylight", 4, 4.6, 1.35, [ivory, gold])
                flare.location.y = -6.4
                satellite(solar, .02, .5, rx, rz, .8, -8, 2, 46, radial=True)
                for j, t in enumerate((.16, .27, .38, .62, .73, .84)):
                    s = put("Fixed star of the ecliptic")
                    sunburst(s, "Compass rose", 4, 10 if j in (1, 4) else 7.5, 2.4, [ivory, gold], .8)
                    satellite(s, .03 if t<.5 else .97, t, rx, rz, 2, -8, 19+2*j, 43+2*j)
            else:
                for j, t in enumerate((.19, .34, .50, .66, .81)):
                    phase = put("Moon phase medallion")
                    r = 6.6 if j==2 else 5.3
                    gem(phase, "Silver bezel", r+1, r+1, 2.1, [silver, silver, ivory], 16)
                    disk = gem(phase, "Moon face", r, r, 1.3, [silver, ivory, silver] if j==2
                               else [midnight, midnight, enamel[5]], 16)
                    disk.location.y = -1.9
                    if j!=2:
                        crescent = lunar_phase(phase, r*.89, -1 if j<2 else 1)
                        if j in (0, 4):
                            crescent.scale.x = .72
                    satellite(phase, .975, t, rx, rz, 0, -8, 4+j*3, 43+2*j)


if args.key=="rainbow":
    primary()
else:
    double()

proof = {1, frames//3, settled-7, settled}
for frame in range(1, frames+1):
    if args.mode=="proof" and frame not in proof:
        continue
    target = out / f"{frame:03}.png"
    if frame>settled:
        shutil.copyfile(out/f"{settled:03}.png", target)
        continue
    scene.frame_set(frame)
    for update in updates:
        update(frame)
    scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
