"""Two kinds of aerial fireworks, modelled in projected stage units.

blender -b -t 2 --python-exit-code 1 -P studies/prism/firework_garden.py -- blooms 3
Pass one-based frame numbers after the level to render individual proofs.
"""

import random
import sys
from functools import lru_cache
from math import cos, exp, pi, sin, sqrt, tau
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
FRAMES = (48, 56, 64)
TITLES = {
    "blooms": ("Silk Poppy", "Dahlia and Gold Poppy", "Five-Flower Bouquet"),
    "paint": ("Apricot Splash", "Peacock and Rose", "Collision Crown"),
}
V = Vector


def clamp(x):
    return max(0.0, min(1.0, x))


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


@lru_cache(None)
def rgb(code):
    return tuple(((int(code[i:i+2], 16) / 255 + .055) / 1.055) ** 2.4 for i in (0, 2, 4))


def blend(a, b, t):
    return tuple(lerp(p, q, t) for p, q in zip(a, b))


def bezier(controls, t):
    a, b, c, d = controls
    s = 1 - t
    return a * s**3 + b * (3*s*s*t) + c * (3*s*t*t) + d * t**3


class Clay:
    """One smooth, vertex-painted mesh per exposure, including disconnected droplets."""

    def __init__(self):
        self.points = []
        self.faces = []
        self.colours = []

    def point(self, xyz, col, opacity=1):
        self.points.append(tuple(xyz))
        self.colours.extend((*col, opacity))

    def rows(self, start, height, width, wrap):
        for j in range(height - 1):
            lower = start + j * width
            for i in range(width if wrap else width - 1):
                k = (i + 1) % width
                self.faces.append((lower+i, lower+k, lower+width+k, lower+width+i))

    def bead(self, centre, rx, ry, rz, colour, angle=0, longitudes=12):
        if min(rx, ry) < .14:
            return
        start = len(self.points)
        ca, sa = cos(angle), sin(angle)
        for j in range(8):
            h = -pi/2 + pi*(.001 + .998*j/7)
            for i in range(longitudes):
                a = tau*i/longitudes
                x, y = rx*cos(h)*cos(a), ry*cos(h)*sin(a)
                self.point((centre[0]+ca*x-sa*y, centre[1]+sa*x+ca*y, centre[2]+rz*sin(h)), colour)
        self.rows(start, 8, longitudes, True)

    def strand(self, path, radius, colour, samples=32, sides=10):
        """A tapered, shaded strand. The cross section can be a flattened wet ribbon."""
        start = len(self.points)
        line = [path(i/samples) for i in range(samples+1)]
        for j, p in enumerate(line):
            t = j/samples
            tangent = line[min(samples, j+1)] - line[max(0, j-1)]
            perp = V((-tangent.y, tangent.x, 0)).normalized()
            wide, high = radius(t)
            for i in range(sides):
                a = tau*i/sides
                pos = p + perp * (cos(a)*wide)
                pos.z += sin(a)*high
                self.point(pos, colour(t, a))
        self.rows(start, samples+1, sides, True)

    def expose(self):
        mesh = bpy.data.meshes.new("Sculpted exposure")
        mesh.from_pydata(self.points, [], self.faces)
        mesh.update()
        mesh.polygons.foreach_set("use_smooth", [True]*len(self.faces))
        attr = mesh.color_attributes.new(name="Pigment", type="FLOAT_COLOR", domain="POINT")
        attr.data.foreach_set("color", self.colours)
        mesh.color_attributes.active_color = attr
        mesh.materials.append(bpy.data.materials["Stage colour"])
        obj = bpy.data.objects.new("Petals and sparks" if FAMILY == "blooms" else "Wet pigment", mesh)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def paint_surface():
    mat = bpy.data.materials.new("Stage colour")
    mat.use_nodes = True
    tree = mat.node_tree
    bsdf = tree.nodes.get("Principled BSDF")
    pigment = tree.nodes.new("ShaderNodeVertexColor")
    pigment.layer_name = "Pigment"
    surface = pigment.outputs["Color"]
    if FAMILY == "paint":
        # The stain is embedded in the moving membrane; the rounded meniscus
        # catches the same softboxes as the surrounding drops.
        geo = tree.nodes.new("ShaderNodeNewGeometry")
        grain = tree.nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = .24
        grain.inputs["Detail"].default_value = 3.2
        grain.inputs["Distortion"].default_value = .5
        tree.links.new(geo.outputs["Position"],grain.inputs["Vector"])
        ramp = tree.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = .26
        ramp.color_ramp.elements[0].color = (.30,.38,.56,1)
        ramp.color_ramp.elements[1].position = .70
        tree.links.new(grain.outputs["Fac"],ramp.inputs[0])
        stain = tree.nodes.new("ShaderNodeMixRGB")
        stain.blend_type = "MULTIPLY"
        stain.inputs[0].default_value = .46
        tree.links.new(surface,stain.inputs[1])
        tree.links.new(ramp.outputs[0],stain.inputs[2])
        surface = stain.outputs[0]
        tree.links.new(pigment.outputs["Alpha"],bsdf.inputs["Alpha"])
    tree.links.new(surface,bsdf.inputs["Base Color"])
    tree.links.new(surface,bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = .19 if FAMILY=="paint" else .30
    bsdf.inputs["Roughness"].default_value = .25 if FAMILY=="paint" else .37
    bsdf.inputs["Coat Weight"].default_value = .40 if FAMILY=="paint" else .16
    bsdf.inputs["Coat Roughness"].default_value = .21


def softbox(scene,name,position,size,power,colour):
    lamp = bpy.data.lights.new(name,"AREA")
    lamp.energy = power
    lamp.shape = "DISK"
    lamp.size = size
    lamp.color = colour
    obj = bpy.data.objects.new(name,lamp)
    scene.collection.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (V((0,0,35))-obj.location).to_track_quat("-Z","Y").to_euler()


def setup(count):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    camera = bpy.data.cameras.new("Rostrum")
    camera.type = "ORTHO"
    camera.ortho_scale = 384
    camera.clip_end = 1200
    obj = bpy.data.objects.new("Fixed front camera", camera)
    scene.collection.objects.link(obj)
    obj.location.z = 600
    scene.camera = obj
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 8
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 2
    scene.cycles.transparent_max_bounces = 4
    scene.render.use_persistent_data = True
    scene.world = bpy.data.worlds.new("Diffuse studio fill")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value = (.68,.77,1,1)
    bg.inputs[1].default_value = .40
    softbox(scene,"Warm silk",(-260,240,400),170,1270000,(1,.90,.80))
    softbox(scene,"Long cool reflection",(240,92,340),78,740000,(.73,.90,1))
    paint_surface()
    scene.view_settings.view_transform = "Standard"
    scene.render.film_transparent = True
    scene.render.resolution_x = 384
    scene.render.resolution_y = 288
    scene.render.resolution_percentage = 100
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 25
    scene.render.fps = 20
    scene.frame_start, scene.frame_end = 1, count
    return scene


# Petal backs, luminous body, folded margin, reflected light.
FLOWERS = {
    "silk": ("9C1858", "FF4A79", "FFA383", "FFE9AB"),
    "iris": ("4D309B", "7353FF", "AB89FF", "FFC9FB"),
    "lapis": ("173AA0", "288CFF", "61E9F3", "D3FFF2"),
    "honey": ("B64120", "FF982D", "FFE45A", "FFF4BA"),
    "orchid": ("722481", "EF399C", "FF94C6", "FFE3D6"),
    "jade": ("076A77", "0DD1B5", "89F3C0", "EEFFC0"),
}
PALE_GOLD, GOLD, AMBER = map(rgb, ("FFF5C0", "FFD044", "E97627"))


def chrysanthemum_specs(level):
    # x, y, radius, launch, burst, shedding, variety, colour, seed, depth
    if level == 1:
        return [(0, 21, 76, 1, 14, 33, "poppy", "silk", 21, 0)]
    if level == 2:
        return [(-36, 32, 70, 1, 15, 40, "dahlia", "iris", 25, 0),
                (59, -9, 54, 9, 24, 43, "poppy", "honey", 53, 60)]
    return [(1, 60, 59, 1, 15, 43, "aster", "orchid", 21, 0),
            (-83, 22, 50, 6, 23, 48, "lily", "lapis", 83, 60),
            (83, 32, 51, 10, 27, 50, "poppy", "honey", 55, 120),
            (-39, -28, 43, 13, 32, 51, "poppy", "silk", 64, 180),
            (47, -28, 43, 16, 36, 54, "dahlia", "jade", 85, 240)]


def spark(g, x, y, z, r, colour, tilt=0):
    # A tiny four-sided cut crystal emitting two crossed rays.
    if r < .55:
        return
    start = len(g.points)
    g.point((x,y,z+.23*r), PALE_GOLD)
    for i in range(8):
        a = i*pi/4 + tilt
        dist = r * (.23 if i%2 else (1 if i%4 == 2 else .69))
        g.point((x+cos(a)*dist,y+sin(a)*dist,z),colour)
    for i in range(8):
        g.faces.append((start,start+1+i,start+1+(i+1)%8))


def flower_comet(g, f, spec, cols):
    x,y,r,start,burst,shed,kind,tone,seed,depth = spec
    if not start <= f < min(shed+2, burst+21):
        return
    # Cold dust peels off behind a moving gold-tipped ember.
    q = clamp((f-start)/(burst-start))
    tail = clamp((f-burst)/18)
    base = V((x*.10-5,-121,depth-14))
    target = V((x,y,depth-12))
    path = (base, base+V((x*.22+14,55,0)), target+V((-x*.23-8,-39,0)), target)
    def curve(t):
        return bezier(path,t)
    if q > tail+.001:
        g.strand(lambda t:curve(lerp(tail,q,t)), lambda t: (.13+(1.15+.6*t)*sin(pi*t)**.6*(1-tail),
                 .12+.8*sin(pi*t)*(1-tail)), lambda t,a: blend(cols[2],PALE_GOLD,t), 24)
    rng = random.Random(seed)
    for i in range(20):
        lag = rng.uniform(.04,.72)
        k = q-lag
        offset, scale = rng.uniform(-1,1), rng.uniform(.7,1.75)
        if k < tail or k < 0:
            continue
        pt = curve(k)
        pt.x += offset*(2+lag*8)
        g.bead(pt,scale*(1-tail),scale*(1-tail)*1.28,.6, cols[2] if i%3 else GOLD)
    if f < burst+3:
        pt = curve(q)
        flame = 1-ease((f-burst)/3)
        g.bead(pt,3.2*flame,5*flame,2,cols[2],-.3)
        spark(g,pt.x,pt.y,pt.z+4,4.3*flame,PALE_GOLD,.17)


def petal(g, centre, angle, length, width, open_amt, twist, cols, variety, lean, inner):
    # Rolled petal margins, a raised midrib and a cupped, pleated blade.
    ca, sa = cos(angle), sin(angle)
    start = len(g.points)
    for j in range(17):
        t = j/16
        bulb = max(.001,sin(pi*t**(1.42 if variety == "poppy" else 1.13)))
        if variety == "poppy":
            bulb = bulb**.46
        elif variety == "lily":
            bulb = bulb**1.22
        for i in range(11):
            v = (i-5)/5
            edge = abs(v)
            flap = v*width*bulb*(.62+.38*open_amt)
            flap += twist*length*t*t*(.4+.6*open_amt)
            along = length * ((.28+.72*open_amt)*t + .035*bulb*cos(v*pi))
            if variety == "poppy":
                along -= length*.055*t**3*cos(v*2.7*pi)
            ripple = .5+.5*cos(v*3*pi+t*1.2)
            cup = length*(.24*sin(pi*t) + t*.37*(1-open_amt))
            cup += width*bulb*(.4*edge**2+.15*ripple+.15*exp(-v*v*27))
            xx, yy = ca*along-sa*flap, sa*along+ca*flap
            pos = (centre.x+xx, centre.y+yy*lean+cup*.24, centre.z+cup+yy*.12)
            base = blend(cols[0],cols[1],clamp(.12+.94*t-.19*edge+.13*ripple))
            base = blend(base,cols[2],clamp(.07+(.50 if inner else .36)*t+.28*edge**4+.15*ripple*t))
            bright = .42*t**6+.31*edge**7*bulb+.19*exp(-v*v*85)*sin(pi*t)
            g.point(pos,blend(base,cols[3],bright))
    g.rows(start,17,11,False)


def flower(g,f,spec,level):
    x,y,r,start,burst,shedding,variety,tone,seed,z = spec
    cols = tuple(map(rgb,FLOWERS[tone]))
    flower_comet(g,f,spec,cols)
    age = f-burst
    if age < 0:
        return
    rng = random.Random(seed)
    rings = {"poppy": [(6,1,.45),(5,.67,.43)],
             "dahlia": [(13,1,.17),(11,.77,.23),(8,.53,.26)],
             "aster": [(18,1,.122),(15,.83,.16),(12,.61,.19),(9,.40,.22)],
             "lily": [(6,1,.22),(6,.68,.25)]}[variety]
    shed_total = FRAMES[level-1]-shedding
    for ring,(n,reach,waist) in enumerate(rings):
        for i in range(n):
            a = tau*(i+.44*ring)/n + seed*.17 + rng.uniform(-.075,.075)
            variation = rng.uniform(.91,1.08)
            twist = rng.uniform(-.13,.16)
            lag = rng.uniform(0,1.8)
            opened = ease((age-ring*2.3-lag+.8)/(11 if variety=="poppy" else 13))
            if opened < .004:
                continue
            gone = clamp((f-shedding+lag*.8-ring*.68)/(shed_total*.94))
            if gone >= 1:
                continue
            ang = a + .15*(1-opened) + twist*gone*3
            drift = r*(.05+.21*gone)*opened + r*.33*gone
            p = V((x+cos(a)*drift, y+sin(a)*drift*.84-21*gone**2,z+ring*11))
            scale = (.20+.80*opened)*(1-ease(gone))**.8
            petal(g,p,ang,r*reach*variation*scale,r*reach*waist*scale,opened,
                  twist,cols,variety,.87 if variety!="lily" else .78,ring>0)
    core = (.12+.88*ease((age+.5)/9))*(1-ease((f-shedding-1)/max(3,shed_total*.82)))
    if core > .012:
        p = (x,y+1,z+55)
        g.bead(p,r*.155*core,r*.142*core,4*core,AMBER, longitudes=20)
        for i in range(24):
            a = i*2.39996 + seed
            rr = sqrt((i+.5)/24)*r*.207*core
            size = (1.2+.019*r)*core*(.79+.21*sin(i))
            g.bead((x+cos(a)*rr, y+sin(a)*rr*.85+1,z+61+cos(rr)*.6),size,size*1.08,size,
                   PALE_GOLD if i%4==0 else GOLD)
    for i in range(26 if variety=="aster" else 19):
        a = tau*i/19+rng.uniform(-.13,.13)
        flight = clamp((age-rng.uniform(0,5))/(FRAMES[level-1]-burst-1))
        dist = r*(.20+(.90+rng.uniform(.04,.36))*(1-(1-flight)**2.7))
        xx, yy = x+cos(a)*dist, y+sin(a)*dist*.83-19*flight**2
        size = rng.uniform(1.0,2.35)*sin(pi*flight)**.65
        if i%6==0:
            spark(g,xx,yy,z+42,size*2.1,cols[2],a*.11)
        else:
            g.bead((xx,yy,z+42),size,size*(1.2+.4*cos(a)),size,cols[2] if i%3 else PALE_GOLD,a)
    # Incandescent pollen scribes short parabolas beyond the velvety corolla.
    # The rear trails lift first; later arcs peel down around the bouquet.
    for i in range(12 if level!=3 else 9):
        a = tau*i/(12 if level!=3 else 9)+.6+seed*.2+rng.uniform(-.13,.13)
        delay = rng.uniform(.2,5)
        time = clamp((age-delay)/(FRAMES[level-1]-burst-delay))
        if not 0 < time < 1:
            continue
        length = r*rng.uniform(1.22,1.67)
        def flight(u):
            s = 1-(1-u)**2.85
            return V((x+length*(cos(a)*s+.14*sin(a)*u*u),
                      y+length*(sin(a)*s*.83-.29*u*u),z-3))
        first = clamp(time-.29*(1-time))
        thick = (1.1 if i%2 else 1.5)*sin(pi*time)**.65
        g.strand(lambda t:flight(lerp(first,time,t)),
                 lambda t:(thick*(.04+.64*t),.5*thick*(.04+.64*t)),
                 lambda t,a:blend(cols[2],PALE_GOLD,t),12,6)
        tip = flight(time)
        g.bead(tip,1.14*thick,thick,thick,PALE_GOLD)
        if i%3==0:
            spark(g,tip.x,tip.y,tip.z+2,thick*3.4,cols[2],a*.07)


# The liquid effects use a different vocabulary: a stretching ligament, a lamella
# with pooled edges, threads pulled out of its rim, and the open wall of a crown.
INKS = {
    "apricot": ("A22242","FF573F","FF9246","FFDE82","FFEFC2"),
    "blue": ("123983","117AD5","14C6D6","91F3D0","E2FFD8"),
    "berry": ("801059","D93294","FF6184","FFA069","FFD8BA"),
    "cobalt": ("2B257C","4548C9","399AF6","69DAF2","D4F9FF"),
    "mango": ("CB3F30","FF742E","FFB329","FFE255","FFF1B6"),
}


def colours(ink):
    return tuple(map(rgb,INKS[ink]))


def inkjet(g,f,launch,arrival,xy,ink,width,depth):
    if f < launch or f >= arrival+13:
        return
    cols = colours(ink)
    controls = list(map(lambda xy: V((*xy,depth)),xy))
    head = clamp((f-launch)/(arrival-launch))
    trail = clamp((f-launch-4)/(arrival+12-launch-4))
    def path(t):
        return bezier(controls,lerp(trail,head,t))
    end = path(1)
    fade = 1-ease((f-arrival)/12)
    def section(t):
        w = width*(.05+.71*t**1.7+.28*sin(pi*t)**2) * fade
        return (w,w*.7)
    if head > trail+.001:
        g.strand(path,section,lambda t,a:blend(cols[1],cols[3],.23+.25*sin(a*2+t*5)+.18*t),32,16)
    g.bead(end,width*fade,width*.87*fade,width*.75*fade,cols[2],longitudes=20)
    for i in range(1,8):
        t = head-.067*i
        if t < 0 or t < trail-.2:
            continue
        pt = bezier(controls,t)
        pt.x += sin(i*8.2)*i*1.7
        pt.y -= i*1.4
        s = (1.8+1.5*cos(i*1.7))*fade
        g.bead(pt,s,s*1.6,s,cols[2 if i%3 else 3],-.3)


def rim_distance(a,b):
    return (a-b+pi)%tau-pi


def splat(g,f,start,end,centre,footprint,angle,ink,seed,depth,spikes=12):
    if not start <= f < end:
        return
    rng = random.Random(seed)
    cols = colours(ink)
    age = f-start
    opening = 1-(1-clamp((age+1)/15))**2.6
    drain = ease((f-(end-12))/12)
    impulse = sin(pi*clamp((age-5)/21))
    scale = opening*(1+.12*impulse-.83*drain)
    cx,cy = centre
    cy -= 23*drain+4*ease((age-15)/17)
    rx,ry = footprint
    ca,sa = cos(angle),sin(angle)
    fingers = [(tau*(j+rng.uniform(-.42,.42))/spikes,rng.uniform(.09,.63),rng.uniform(.043,.15))
               for j in range(spikes)]
    shape = []
    sectors = 144
    for i in range(sectors):
        a = tau*i/sectors
        jag = 1+.09*sin(a*3+.5*seed)+.075*sin(a*5+seed)+.05*cos(a*8)
        for az,reach,thick in fingers:
            jag += reach*exp(-(rim_distance(a,az)/thick)**2)*ease(age/8)
        shape.append((a,jag))
    def warp(a,jag,r):
        # Edge shears while the underside sags and the upper lip recoils.
        swipe = .20*r**1.5*sin(a*3+seed)+.16*sin(age*.091)*r
        swipe += .075*impulse*sin(a*2)
        x = rx*(cos(a+swipe)*jag*r+.15*sin(a)**2*r*r)
        y = ry*(sin(a+swipe)*jag*r-.09*r*r*cos(3*a))
        return (cx+scale*(ca*x-sa*y),cy+scale*(sa*x+ca*y))
    # As the liquid stretches, thin spots open and pigment gathers around the
    # holes. They remain registered to the deformed sheet throughout the shot.
    pinholes = [(.62,.25,.13,.105),(-.34,-.60,.086,.13),(.25,.72,.073,.068)]
    hole_size = .05+.95*ease((age-5)/12)
    base = len(g.points)
    for j in range(33):
        r = .001+j*.999/32
        for a,jag in shape:
            x,y = warp(a,jag,r)
            u,v = cos(a)*r,sin(a)*r
            flow = 3.5*v-2*u+1.2*sin(3.1*u+4*v+seed)+.86*cos(4*v-2*u)
            vein = .5+.5*sin(flow*2.8+1.9*u)
            thin = .5+.5*sin(flow*6+u*4+.65*sin(v*8))
            pool = exp(-((r-.91)/.075)**2)
            hole = min(((u-hx)/hw)**2+((v-hy)/hh)**2 for hx,hy,hw,hh in pinholes)/hole_size**2
            meniscus = exp(-((min(hole,5)-1.5)/.55)**2)
            h = 5*(1-r*r)+2.7*pool + 2*r*vein+1.2*meniscus
            col = blend(cols[1],cols[2],.19+.70*vein)
            col = blend(col,cols[3],.07+.31*vein**3+.35*thin**8)
            col = blend(col,cols[0],clamp(.75*r**9+.18*pool*(1-vein)+.22*(1-vein)**3))
            col = blend(col,cols[4],.28*pool*thin**2)
            col = blend(col,cols[3],.5*meniscus)
            wet = min(1,.73+.24*pool+.13*(1-vein))
            g.point((x,y,depth+h*scale),col,wet*ease((hole-.65)/.65))
    g.rows(base,33,sectors,True)
    # Detach ballistic beads from individual wet fingers.
    for i,(a,reach,thick) in enumerate(fingers):
        travel = clamp((age-3-(i%4))/(end-start-4))
        if not travel:
            continue
        tip = round(a/tau*sectors)%sectors
        ang,jag = shape[tip]
        x,y = warp(ang,jag,1)
        dist = (9+26*(.5+.5*sin(i*3.4)))*sin(travel*pi*.84)
        x += cos(a+angle)*dist
        y += sin(a+angle)*dist-22*travel*travel
        size = (1.6+2.3*(.5+.5*cos(i*2.4)))*sin(pi*travel)**.5
        g.bead((x,y,depth+7),size*1.32,size,size*.75,cols[2 if i%2 else 3],a+angle)
        if i%3==1:
            # Viscous necks break well after the leading bead begins moving.
            px,py = warp(ang,jag,.91)
            bend = V(((x-px)*.44+3, (y-py)*.31-3,0))
            controls = [V((px,py,depth+2)),V((px,py,depth+2))+bend,
                        V((x,y,depth+7))-bend*.38,V((x,y,depth+7))]
            neck = 2.3*(1-ease((travel-.32)/.37))*opening
            if neck > .12:
                g.strand(lambda u:bezier(controls,u),
                         lambda u:(neck*(.28+.69*(1-u)**2),neck*(.18+.58*(1-u)**2)),
                         lambda u,b:blend(cols[1],cols[3],.30+.26*sin(b)),10,8)


def wave(g,f,start,end,points,width,ink,seed,depth):
    if not start <= f < end:
        return
    cols = colours(ink)
    t = clamp((f-start+1)/14)
    fall = ease((f-end+15)/15)
    controls = [V((x,y-18*fall,depth)) for x,y in points]
    front = 1-(1-t)**1.55
    # The crest curls in after full extension. The sheet below continues to
    # travel outward while the tip overturns and drops under gravity.
    roll = ease((f-start-10)/(end-start-10))
    side = 1 if controls[2].x > controls[0].x else -1
    def path(u):
        p = bezier(controls,u*front)
        p.x += side*roll*(8*sin(pi*u)-22*u**3)
        p.y += 4*sin((f-start)*.1+u*4+seed)*u-25*roll*u**2
        return p
    def profile(u):
        body = (.035+ .97*(sin(pi*u)**.8))*(.64+.46*u+.18*cos(u*9+seed))
        w = width*body*(.22+.78*t)*(1-fall)**.72*(1+.15*sin(u*5-roll*5))
        return (w,.38*w)
    def marble(u,a):
        v = cos(a)
        band = .5+.5*sin(5*v+u*9+.9*sin(u*9+seed))
        inkcol = blend(cols[0],cols[2],.27+.69*band)
        return blend(inkcol,cols[3],.04+.47*(.5+.5*cos(u*11+8*v+seed))**6+.15*band)
    g.strand(path,profile,marble,48,28)
    tip = path(1)
    s = width*.20*(1-fall)
    g.bead(tip,s,s*.89,s*.72,cols[3])


def crown(g,f):
    if f < 25 or f > 61:
        return
    age = f-25
    up = 1-(1-clamp((age+1)/16))**2
    collapse = ease((f-47)/15)
    cs = [colours(name) for name in ("blue","cobalt","berry","mango")]
    n = 168
    x0, y0 = 1,-25-20*collapse
    base = len(g.points)
    def lip(i):
        a = tau*i/n
        # Vary spacing, height and tip roundness around the annular sheet.
        peak = (.5+.5*cos(8*a+.88*sin(3*a)+.55*sin(5*a)))**2.8
        tall = 16+peak*(20+10*cos(3*a+.4))
        r = 48+peak*12+3*sin(5*a)
        return a,peak,tall,r
    for j in range(19):
        t = j/18
        for i in range(n):
            a,peak,tall,r = lip(i)
            spread = .34+.66*up
            rim = (18*(1-t)+r*t**.86)*spread*(1-.51*collapse)
            x = x0+rim*cos(a)+4*sin(2*a)*t*t+peak*5*sin(a+1)*t*t
            y = y0+rim*sin(a)*.27+t*tall*up*(1-collapse)
            z = 84-rim*sin(a)*.27
            # Interleaved streams run through a continuous surface at the seam.
            phase = (a/tau*4+.43*sin(2*a+2*t)+.22*t) % 4
            k = int(phase)
            mix = ease((phase%1-.29)/.39)
            tone = [blend(cs[k][p],cs[(k+1)%4][p],mix) for p in (1,2,3,4)]
            col = blend(tone[0],tone[1],.26+.6*t)
            col = blend(col,tone[2],.48*t**4+.22*(.5+.5*sin(11*a-4*t))**5)
            g.point((x,y,z),blend(col,tone[3],.48*t**12),.82+.16*t)
    g.rows(base,19,n,True)
    for i in range(n):
        a,p,h,r = lip(i)
        if p < lip((i+1)%n)[1] or p <= lip((i-1)%n)[1]:
            continue
        rim = r*(.34+.66*up)*(1-.51*collapse)
        lip_x = x0+rim*cos(a)+4*sin(2*a)+p*5*sin(a+1)
        lip_y = y0+rim*sin(a)*.27+h*up*(1-collapse)
        bulb = (1.3+.6*sin(a)**2)*up*(1-collapse)
        g.bead((lip_x,lip_y,84-rim*sin(a)*.27),bulb,bulb*1.21,bulb,cs[int(a/tau*4)%4][2])
        tick = clamp((age-8)/24)
        if not tick:
            continue
        rr = r*(.34+.66*up)*(1-.51*collapse)+tick*13
        x = x0+rr*cos(a)+4*sin(2*a)
        y = y0+rr*sin(a)*.27+h*up*(1-collapse)+21*sin(pi*tick)-14*tick*tick
        size = (1.8+1.3*cos(a)**2)*sin(pi*tick)
        g.bead((x,y,94),size,size*1.32,size,cs[int(a/tau*4)%4][3],a*.25)


def paint(g,f,level):
    if level == 1:
        inkjet(g,f,1,16,[(-52,-112),(-59,-43),(30,-2),(15,17)],"apricot",10,0)
        splat(g,f,14,47,(14,19),(53,32),.53,"apricot",82,12,9)
        wave(g,f,17,43,[(-44,-10),(-28,24),(13,31),(45,57)],6.2,"apricot",2,22)
        wave(g,f,19,42,[(-2,4),(35,-9),(54,25),(68,45)],3.3,"mango",1,23)
    elif level == 2:
        inkjet(g,f,1,15,[(-85,-110),(-49,-83),(-20,6),(-30,11)],"blue",10,0)
        splat(g,f,14,54,(-26,15),(57,38),.71,"blue",14,10,12)
        wave(g,f,13,49,[(-60,-13),(-69,39),(-46,102),(5,78)],13,"blue",4,24)
        wave(g,f,18,50,[(-33,23),(-12,58),(44,62),(40,39)],11,"cobalt",8,28)
        inkjet(g,f,11,27,[(44,-108),(73,-48),(60,-11),(35,-10)],"berry",9,38)
        splat(g,f,25,56,(35,-10),(38,29),-.38,"berry",51,46,10)
        wave(g,f,24,52,[(57,-17),(42,20),(8,29),(-12,8)],9,"berry",9,55)
    else:
        inkjet(g,f,1,19,[(-133,-92),(-148,-19),(-60,11),(-6,-18)],"blue",12,1)
        inkjet(g,f,5,22,[(135,-86),(137,-9),(62,17),(5,-14)],"berry",12,2)
        wave(g,f,17,59,[(-2,-19),(-57,-40),(-157,58),(-93,72)],19,"blue",4,15)
        wave(g,f,21,58,[(-105,33),(-108,94),(-36,107),(-49,58)],13,"cobalt",6,16)
        wave(g,f,25,58,[(-122,55),(-153,82),(-113,105),(-98,92)],4.8,"blue",2,17)
        wave(g,f,21,58,[(-103,33),(-73,50),(-70,68),(-82,72)],5.7,"blue",7,18)
        wave(g,f,19,61,[(3,-14),(72,-41),(155,46),(102,58)],20,"berry",7,20)
        wave(g,f,23,60,[(102,29),(119,70),(70,96),(46,62)],12,"mango",8,21)
        wave(g,f,23,59,[(115,26),(146,48),(155,77),(130,75)],5.2,"berry",5,22)
        wave(g,f,23,60,[(84,32),(71,72),(49,65),(45,49)],4.2,"berry",5,23)
        splat(g,f,18,60,(-47,-7),(48,28),-.29,"blue",37,28,12)
        splat(g,f,21,61,(47,-9),(49,29),.31,"berry",51,32,12)
        wave(g,f,23,61,[(-74,-20),(-58,-63),(54,-42),(70,14)],11,"cobalt",6,48)
        wave(g,f,23,60,[(87,0),(53,-34),(-13,-47),(-50,-27)],9,"mango",3,55)
        wave(g,f,28,56,[(-41,-17),(-10,-15),(-5,67),(27,48)],5.6,"cobalt",1,59)
        wave(g,f,29,58,[(49,4),(20,-3),(26,48),(-2,33)],4.1,"berry",5,61)
        crown(g,f)
    # Fine secondary spatter follows the broad throws under gravity. Keep a few
    # lingering droplets after the sheets have retracted, with a soft final exit.
    start = (16,20,22)[level-1]
    if f < start:
        return
    rng = random.Random(470+level)
    for i in range((14,24,39)[level-1]):
        delay = rng.uniform(0,8)
        t = clamp((f-start-delay)/(FRAMES[level-1]-start-delay))
        a = rng.uniform(0,tau)
        vel = rng.uniform(.48,1)
        span = (95,124,163)[level-1]
        origin = ((14,19),(-17,17),(0,-16))[level-1]
        x = origin[0]+cos(a)*span*vel*(1-(1-t)**2)
        y = origin[1]+(sin(a)*.56+.40)*span*vel*(1-(1-t)**2.3)-58*t*t
        radius = rng.uniform(.9,3.2)*sin(pi*t)**.62
        tone = ("apricot",) if level==1 else (("blue","berry","cobalt") if level==2 else ("blue","berry","mango","cobalt"))
        g.bead((x,y,105),radius,radius*(1+.6*t),radius*.8,colours(tone[i%len(tone)])[2+i%2],a-.8)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--")+1:]
    FAMILY, level = args[0], int(args[1])
    assert FAMILY in ("blooms","paint") and level in (1,2,3)
    count = FRAMES[level-1]
    scene = setup(count)
    scene.name = TITLES[FAMILY][level-1]
    folder = ROOT / "assets/videos/prism" / f"{FAMILY}-{level}"
    folder.mkdir(parents=True, exist_ok=True)
    frames = list(map(int,args[2:])) if len(args)>2 else range(1,count+1)
    for frame in frames:
        assert 1 <= frame <= count
        scene.frame_set(frame)
        g = Clay()
        if FAMILY == "blooms":
            for spec in chrysanthemum_specs(level):
                flower(g,frame,spec,level)
        else:
            paint(g,frame,level)
        obj = g.expose() if g.points else None
        scene.render.filepath = str(folder / f"{frame:03}.png")
        bpy.ops.render.render(write_still=True)
        if obj:
            mesh = obj.data
            bpy.data.objects.remove(obj,do_unlink=True)
            bpy.data.meshes.remove(mesh)
