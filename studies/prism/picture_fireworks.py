"""Picture fireworks. Coordinates are stage pixels, with +Y towards the crown.

blender -b -t 2 --python-exit-code 1 -P studies/prism/picture_fireworks.py -- 1
Pass individual one-based frame numbers after the level to render proofs.
Use 'spark' in place of a level to render the standalone portrait jewel.
"""

import sys
from math import atan2, cos, hypot, pi, sin, tau
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/prism"
COUNTS = (48, 56, 64)


def clamp(x):
    return min(1.0, max(0.0, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def mix(a, b, u):
    return a + (b - a) * u


def bezier(points, t):
    points = list(points)
    while len(points) > 1:
        points = [(mix(a[0], b[0], t), mix(a[1], b[1], t))
                  for a, b in zip(points, points[1:])]
    return points[0]


def segment(path, start, end, steps):
    return [path(mix(start, end, i / steps)) for i in range(steps + 1)]


class Sculpture:
    """One mesh for the current exposure, including all rounded trails and stones."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colors = []
        self.smoothing = []

    def face(self, indices, color, smooth=False):
        self.faces.append(indices)
        self.colors.append(color)
        self.smoothing.append(smooth)

    def publish(self, obj, palette):
        mesh = bpy.data.meshes.new("Cut stones and spun filaments")
        mesh.from_pydata(self.vertices, [], self.faces)
        for material in palette:
            mesh.materials.append(material)
        mesh.polygons.foreach_set("material_index", self.colors)
        mesh.polygons.foreach_set("use_smooth", self.smoothing)
        mesh.update()
        old = obj.data
        obj.data = mesh
        bpy.data.meshes.remove(old)

    def pearl(self, x, y, z, radius, color, stretch=1.0):
        if radius < .23:
            return
        base = len(self.vertices)
        sides = 10
        for rr, depth in ((.12, -.43), (.91, -.18), (1, .05), (.81, .46), (.44, .69)):
            for i in range(sides):
                a = tau * i / sides
                self.vertices.append((x + radius * rr * cos(a), y + radius * rr * sin(a) * stretch,
                                      z + radius * depth))
        for row in range(4):
            for i in range(sides):
                a = base + row * sides + i
                b = base + row * sides + (i + 1) % sides
                self.face((a, b, b + sides, a + sides), color, True)
        self.face(tuple(base + 4 * sides + i for i in range(sides)), color, True)

    def star(self, x, y, z, radius, scheme, angle=0, points=4, aspect=1, heart=.36):
        if radius < .38:
            return
        # A low girdle, bevelled crown, alternating kite facets and a small flat table.
        rim, body, light, table = scheme
        n = 2 * points
        base = len(self.vertices)
        for scale, valley, depth in ((.94, heart, -.14), (1, heart, 0),
                                    (.89, heart * 1.06, .11), (.18, .86, .43)):
            for i in range(n):
                a = pi / 2 + pi * i / points
                r = radius * scale * (valley if i % 2 else 1)
                dx, dy = aspect * r * cos(a), r * sin(a)
                self.vertices.append((x + dx * cos(angle) - dy * sin(angle),
                                      y + dx * sin(angle) + dy * cos(angle), z + radius * depth))
        for k in range(3):
            for i in range(n):
                a = base + k * n + i
                b = base + k * n + (i + 1) % n
                color = rim if k == 0 else (body if k == 1 or i % 2 else light)
                self.face((a, b, b + n, a + n), color)
        self.face(tuple(base + 3 * n + i for i in range(n)), table)

    def thread(self, pts, z, width, colors, tail=.13, tip=.52):
        if width < .12 or len(pts) < 2:
            return
        base = len(self.vertices)
        sides = 8
        last = len(pts) - 1
        for j, (x, y) in enumerate(pts):
            x0, y0 = pts[max(0, j - 1)]
            x1, y1 = pts[min(last, j + 1)]
            dx, dy = x1 - x0, y1 - y0
            length = hypot(dx, dy)
            if length < 1e-6:
                dx, dy, length = 1, 0, 1
            u = j / last
            r = width * min(mix(tail, 1, min(1, u * 2.6)), mix(tip, 1, min(1, (1-u)*3)))
            for i in range(sides):
                a = tau * i / sides
                self.vertices.append((x - dy / length * r * cos(a), y + dx / length * r * cos(a),
                                      z + .85 * r * sin(a)))
        for j in range(last):
            color = colors[min(len(colors)-1, int(j / last * len(colors)))]
            for i in range(sides):
                a = base + j * sides + i
                b = base + j * sides + (i + 1) % sides
                self.face((a, b, b + sides, a + sides), color, True)


COPPER, AMBER, GOLD, LEMON, PEARL, ROSE, PINK, INK, SEA, MINT, ICE = range(11)
HONEY = (COPPER, AMBER, LEMON, PEARL)
OPAL = (AMBER, GOLD, PEARL, PEARL)
JADE = (INK, SEA, MINT, ICE)
BLUSH = (COPPER, ROSE, PINK, PEARL)


def studio(sprite):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.display.render_aa = "16"
    shade = scene.display.shading
    shade.light = "STUDIO"
    shade.studio_light = "paint.sl"
    shade.color_type = "MATERIAL"
    shade.show_shadows = False
    shade.show_cavity = False
    shade.show_specular_highlight = True
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = True
    scene.render.resolution_x = 32 if sprite else 384
    scene.render.resolution_y = 32 if sprite else 288
    scene.render.resolution_percentage = 100
    scene.render.fps = 20
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    cam_data = bpy.data.cameras.new("Fixed rostrum")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = scene.render.resolution_x
    cam_data.clip_end = 1000
    cam = bpy.data.objects.new("Camera", cam_data)
    scene.collection.objects.link(cam)
    cam.location.z = 450
    scene.camera = cam
    obj = bpy.data.objects.new("Firework", bpy.data.meshes.new("Empty exposure"))
    scene.collection.objects.link(obj)
    palette = []
    for name, rgb in (("Copper", "B65837"), ("Apricot", "FF9F3C"), ("Old gold", "FFCA56"),
                      ("Lemon", "FFE593"), ("Opal", "FFF8DC"), ("Coral", "F07763"),
                      ("Rose quartz", "FFBAA1"), ("Petrol", "176B7D"), ("Tourmaline", "39C4BC"),
                      ("Celadon", "A0F3DC"), ("Ice", "E9FFF2")):
        mat = bpy.data.materials.new(name)
        channels = [int(rgb[i:i+2], 16) / 255 for i in (0, 2, 4)]
        mat.diffuse_color = (*[((s+.055)/1.055)**2.4 if s > .04045 else s/12.92 for s in channels], 1)
        mat.roughness = .31
        mat.metallic = .14
        palette.append(mat)
    return scene, obj, palette


def comet(s, path, head, length, radius, scheme, spin=0, points=4):
    start = max(0, head-length)
    if head-start > .002:
        s.thread(segment(path, start, head, 18), 1, radius*.23,
                 (scheme[0], scheme[1], scheme[2]), .04, .72)
        # Detached embers in the slipstream. Their size decays with distance.
        for j in range(6):
            u = start - (j+1)*length*.09
            if u < 0:
                break
            x, y = path(u)
            s.pearl(x+sin(j*2.2)*radius*.23, y, 1.1, radius*(.14-j*.015), scheme[1+j%2])
    x, y = path(head)
    s.star(x, y, 4, radius, scheme, spin, points, heart=.40)


def climbing_star(s, f):
    top = 103
    launch = lambda u: bezier(((-45,-110), (-19,-71), (-52,66), (0,top)), u)
    if f <= 16:
        u = ease((f-1)/14)
        size = (5.2+5.6*sin(pi*u)**.65) * (1-.55*ease((f-13)/3))
        comet(s, launch, u, .26*(1-ease((f-10)/6)), size, HONEY, .12+u*.94, 5)
    if f < 13:
        return
    open_ring = ease((f-13)/11)
    radius = 2 + 19*open_ring + 1.4*ease((f-25)/18)
    glow = 1 - .63*ease((f-30)/18)
    turn = .28*ease((f-13)/22) + .09*(f-13)/35
    for i in range(12):
        a = pi/2 + tau*i/12 + turn
        arc = lambda u: (radius*cos(a+u), top+radius*sin(a+u))
        s.thread(segment(arc, -.36*open_ring, -.085*open_ring, 8), 1,
                 1.08*glow*open_ring, (AMBER, GOLD), .28, .70)
        x, y = arc(0)
        if i % 3 == 0:
            s.star(x, y, 3, (3.1+2.1*open_ring)*glow, OPAL, a-pi/2, aspect=.8)
        else:
            s.pearl(x, y, 2, 1.94*open_ring*glow, LEMON if i%2 else AMBER)
    s.star(0, top, 2, (5.2-2.5*open_ring)*glow, HONEY, turn, 5)
    # Two shallow arcs carry a few embers outwards, clear of the picture.
    sweep = ease((f-19)/22)
    for side in (-1, 1):
        path = lambda t: bezier(((side*17,top), (side*64,113), (side*110,78), (side*106,35)), t)
        if sweep > .002:
            comet(s, path, sweep, min(.38, sweep)*(1-.66*ease((f-37)/11)),
                  (4.8-.6*sweep)*glow, OPAL, side*(.2+sweep))
            for j in range(1, 6):
                t = j*.145
                if t < sweep:
                    x, y = path(t)
                    s.pearl(x, y, .6, (1.2 if j%2 else .8)*glow, GOLD)


def facet_wheel(s, f):
    for side in (-1, 1):
        launch = lambda t: bezier(((side*26,-112), (side*94,-126), (side*147,-71), (side*132,0)), t)
        if f <= 17:
            u = ease((f-1)/15)
            comet(s, launch, u, .34, 6.7+3.6*sin(pi*u), JADE, side*(.18+u*.86))
        if 15 <= f < 39:
            u = ease((f-15)/20)
            path = lambda t: (side*132*cos(t*pi/2), 120*sin(t*pi/2))
            comet(s, path, u, .28*(1-ease((f-29)/9)), 7.5*(1-.86*ease((f-28)/10)),
                  HONEY, -side*u*.9)
    if f < 13:
        return
    materialize = ease((f-13)/15)
    angle = -.17 + .81*ease((f-13)/33) + .08*ease((f-46)/10)
    after = 1-.53*ease((f-41)/15)
    vertices = [(131*cos(angle+tau*i/8), 116*sin(angle+tau*i/8)) for i in range(8)]
    for i, (x, y) in enumerate(vertices):
        growth = ease((f-13-(i%4)*1.3)/11)
        if growth <= .001:
            continue
        x2, y2 = vertices[(i+1)%8]
        path = lambda t: (mix(x,x2,t),mix(y,y2,t))
        s.thread(segment(path, .06, .06+.88*growth, 12), 0, 1.52*after,
                 (INK, SEA, MINT, SEA) if i%2 else (COPPER, AMBER, GOLD, LEMON), .40, .53)
        # A shorter second bevel catches the light on alternate edges.
        p = segment(lambda u: (path(u)[0]*1.037, path(u)[1]*1.037), .19, .19+.49*growth, 8)
        s.thread(p, .2, .62*after, (AMBER, GOLD) if i%2 else (SEA, MINT))
        a = atan2(y, x)
        s.star(x, y, 3, (9.4 if i%2 == 0 else 7.8)*growth*after,
               JADE if i%2 else HONEY, a-pi/2, aspect=.76, heart=.48)
        s.pearl(x*1.10, y*1.10, 1.3, 1.42*materialize*after, LEMON if i%2 else MINT)
    # Two beads travel around the cut perimeter, riding the edges as the wheel turns.
    phase = .5 + 3.0*ease((f-23)/29)
    for j in (0, 4):
        spot = phase+j
        k = int(spot)%8
        u = spot-int(spot)
        x, y = vertices[k]
        x2, y2 = vertices[(k+1)%8]
        s.star(mix(x,x2,u), mix(y,y2,u), 5, 4.2*materialize*after, OPAL, angle, aspect=.75)

    # Four pinwheel jets cast sparks tangentially beyond the facet edges.
    spin = ease((f-18)/29)
    flare = ease((f-16)/12)*(1-.85*ease((f-36)/18))
    if flare > .008:
        for i in range(4):
            a = tau*i/4 - .35 + 1.35*spin
            scheme = JADE if i%2 else OPAL
            for j in range(3):
                def jet(t):
                    angle = a-(.40-.074*j)*t
                    return ((132+(6+8*j)*sin(t*pi/2))*cos(angle),
                            (116+(4+3.6*j)*sin(t*pi/2))*sin(angle))
                s.thread(segment(jet, .08, .94, 14), 1, (1.22-.16*j)*flare,
                         (scheme[1],scheme[2]), .78, .12)
                for k in range(2):
                    x,y = jet(1.04+k*.11)
                    s.pearl(x,y,2,(1.65-.35*k)*flare,scheme[2])
            s.star(132*cos(a),116*sin(a),3,5.5*flare,scheme,a,aspect=.78)


def chrysanthemum(s, side, age):
    if age <= 0:
        return
    # Two layers with different launch angles, flight lengths and times of flight.
    for layer, rays in ((0, 23), (1, 15)):
        for i in range(rays):
            a = tau*(i + .27*layer)/rays + .09*sin(i*4.1+side) + .13*side
            speed = .94+.11*sin(i*2.35+layer+side)
            u = clamp(age*speed/(45 if layer == 0 else 37))
            reach = (44 if layer == 0 else 29) * (1+.10*sin(i*1.83+side*.6))
            fall = (37 if layer == 0 else 28) + 6*cos(i*2.19)
            def path(t):
                distance = reach*(1-(1-t)**2.8)
                bend = .18*sin(i*9.5)*t
                return (side*(132+distance*cos(a+bend)), 22 + distance*sin(a+bend) - fall*t**2.2)
            live = 1-.86*ease((age-(24 if layer==0 else 18))/(26 if layer==0 else 23))
            start = max(0, u-(.39 if layer==0 else .32))
            width = (1.48 if layer==0 else 1.08)*live*ease(age/4)
            colors = (COPPER, AMBER, GOLD) if layer==0 else (ROSE, AMBER, LEMON)
            s.thread(segment(path, start, u, 12), 1+layer, width, colors, .06, .72)
            x, y = path(u)
            head = (2.38 if layer==0 else 1.55)*live
            if i%5==0 and layer==0:
                s.star(x,y,3,head*2.05,OPAL,a,aspect=.65)
            else:
                s.pearl(x,y,3,head,LEMON if i%3 else GOLD)
            if age > 14 and i%2==0:
                x, y = path(max(0, u-.15))
                s.pearl(x+2.3*cos(a+pi/2),y+2.3*sin(a+pi/2),3,1.21*live, LEMON)
    s.star(side*132,22,4,7.5*(1-ease(age/23)),OPAL,.17,points=6)


def willow(s, side, age):
    if age <= 0:
        return
    for i in range(7):
        u = clamp(age/(27+2*i))
        span = (i-3)*11.9
        def path(t):
            return (side*(132 + span*(1-(1-t)**2) + 3*sin(pi*t+i)*t),
                    18 + (16+8*sin(i*1.98))*sin(pi*t) - (81+19*sin(i*1.61))*t**1.8)
        live = ease(age/7)*(1-.66*ease((age-26)/20))
        start = max(0,u-.36)
        s.thread(segment(path,start,u,15),.5,1.25*live,(COPPER, AMBER, GOLD))
        x,y=path(u)
        if i%3==0:
            s.star(x,y,2.8,3.75*live,OPAL,side*.12,aspect=.67)
        else:
            s.pearl(x,y,2.8,1.85*live,LEMON,1.27)
        for k in range(4):
            t=u-(.075+.012*i)*(k+1)
            if t>0:
                x,y=path(t)
                s.pearl(x+1.6*sin(i+k),y-2.5,2,(1.52-.17*k)*live,GOLD)


def satellite(s, side, age):
    """Smaller, later rosettes fill the shoulders between the two shell heights."""
    if age <= 0:
        return
    live = ease(age/4)*(1-.88*ease((age-10)/21))
    for i in range(12):
        u = clamp(age/(21+2.5*sin(i*2.19)))
        a = tau*i/12+.16*side
        length = 18+4*cos(2.51*i)
        def path(t):
            r=length*(1-(1-t)**2.3)
            return (side*(101+r*cos(a+.15*t)), 87+r*sin(a+.15*t)-14*t*t)
        s.thread(segment(path,max(0,u-.44),u,10),.7,1.02*live,(ROSE,GOLD,LEMON))
        x,y=path(u)
        s.pearl(x,y,2,1.5*live,PEARL)
    s.star(side*101,87,2,3.9*live,BLUSH,.14)


def crown(s, f):
    for side in (-1, 1):
        delay = 0 if side < 0 else 3
        age = f-1-delay
        launch = lambda t: bezier(((side*24,-107), (side*74,-114), (side*137,-80), (side*132,22)), t)
        if 0 <= age <= 17:
            u = ease(age/16)
            comet(s, launch, u, .32*(1-.45*ease((age-12)/5)), 5.7+3.6*sin(pi*u),
                  BLUSH, side*(.20+u*.8), 5)
        chrysanthemum(s, side, f-16-delay)
        willow(s, side, f-24-delay)
        satellite(s, side, f-25-delay*1.6)

    if f < 15:
        return
    for side in (-1,1):
        for i, (span, drop) in enumerate(((18,1),(35,2),(54,4),(76,8),(99,21),
                                           (117,54),(138,87),(157,123))):
            age = f-15-i*.50
            if age <= 0:
                continue
            u = clamp(age/(22+2.9*i))
            height = 42 - 1.7*i
            def plume(t):
                return (side*(span*(1-(1-t)**1.55)), 89 + height*sin(pi*t) - drop*t**3.7)
            live = 1-.70*ease((age-27-i*.9)/20)
            tail = max(0, u-(.74 if i%2 else .63))
            width = (1.46 if i%2 else 1.10)*live*ease(age/5)
            s.thread(segment(plume,tail,u,23), 2+i*.16, width, (COPPER, AMBER, GOLD, LEMON))
            x, y = plume(u)
            if i%3==0:
                s.star(x,y,5,3.65*live,OPAL,side*.08,aspect=.63)
            else:
                s.pearl(x,y,5,1.9*live,PEARL,1.25)
            for j in range(1,4):
                t = u - .05*j
                if t > .12:
                    x, y = plume(t)
                    s.pearl(x+side*j*.69, y-1.55*j, 1, (1.36-.17*j)*live, GOLD)
        # Lower shell opens like the foot of a diadem. All its branches stay below the word.
        for j in range(4):
            age=f-18-j*1.35
            if age <= 0:
                continue
            u=clamp(age/(15+j*3))
            live=1-.76*ease((age-20)/25)
            span=34+j*25
            path=lambda t: (side*(4+span*t), -104+(9+j*4.1)*sin(pi*t)+(j*6-10)*t)
            s.thread(segment(path,max(0,u-.78),u,16), 1, 1.23*live, (COPPER, ROSE, GOLD), .03, .7)
            x,y=path(u)
            s.pearl(x,y,2,1.66*live,LEMON)
            for k in range(3):
                t = u-.08*(k+1)
                if t>0:
                    x,y=path(t)
                    s.pearl(x,y-3.7,1,live*(1.30-.15*k),GOLD)
    strength = ease((f-15)/6)*(1-.61*ease((f-40)/24))
    s.star(0,89,5,7.4*strength,OPAL,aspect=.68)
    s.star(0,-104,3,5.4*strength,BLUSH,aspect=.78)


def main():
    args = sys.argv[sys.argv.index("--")+1:]
    sprite = args[0] == "spark"
    scene, obj, palette = studio(sprite)
    if sprite:
        s = Sculpture()
        s.star(0,0,0,14.6,OPAL,aspect=.92,heart=.49)
        s.publish(obj, palette)
        folder = RAW / "picture-spark"
        folder.mkdir(parents=True, exist_ok=True)
        scene.render.filepath = str(folder / "picture-spark.png")
        bpy.ops.render.render(write_still=True)
        return
    level = int(args[0])
    count = COUNTS[level-1]
    scene.frame_end = count
    folder = RAW / f"picture-{level}"
    folder.mkdir(parents=True, exist_ok=True)
    take = (climbing_star, facet_wheel, crown)[level-1]
    for frame in (map(int,args[1:]) if len(args)>1 else range(1,count+1)):
        if not 1 <= frame <= count:
            raise ValueError(f"Frame {frame} is outside take {level}")
        scene.frame_set(frame)
        s = Sculpture()
        take(s,frame)
        s.publish(obj,palette)
        scene.render.filepath = str(folder / f"{frame:03}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    main()
