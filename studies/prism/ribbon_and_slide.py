"""Rainbow slide and Rainbow ribbon. Run with Blender from any directory.

blender -b -t 2 --python-exit-code 1 -P studies/prism/ribbon_and_slide.py -- slide 3 render
Use proof in place of render for evenly spaced stills, or supply frame numbers.
Coordinates are in camera space: X across the stage, Y away from camera, Z up.
"""
import sys
from math import cos, pi, sin, tau
from pathlib import Path

import bpy
import numpy as np


ROOT = Path(__file__).resolve().parents[2]
family, level_arg, mode, *rest = sys.argv[sys.argv.index("--") + 1:]
level = int(level_arg)
count = (48, 56, 64)[level - 1]
output = ROOT / "assets/videos/prism" / f"{family}-{level}"
output.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
scene.display.render_aa = "8"
shade = scene.display.shading
shade.light = "STUDIO"
shade.studio_light = "outdoor.sl"
shade.color_type = "MATERIAL"
shade.show_specular_highlight = True
shade.show_shadows = False
shade.show_cavity = False
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = .48
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = 384, 288
scene.render.resolution_percentage = 100
scene.render.fps = 20
scene.frame_start, scene.frame_end = 1, count
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.color_depth = "8"
scene.render.image_settings.compression = 24


def object_data(name, data=None, parent=None):
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.parent = parent
    return obj


camera = bpy.data.cameras.new("Tablet stage")
camera.type = "ORTHO"
camera.ortho_scale = 10
scene.camera = object_data("Locked rostrum", camera)
scene.camera.location = (0, -18, 0)
scene.camera.rotation_euler = (pi / 2, 0, 0)


def pigment(name, hexcode, gloss=.36, metallic=.08):
    rgb = np.array([int(hexcode[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    color = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.roughness = gloss
    m.metallic = metallic
    return m


silks = [pigment(name, code, .31, .13) for name, code in [
    ("Flamingo selvedge", "FBA5B1"), ("Carmine", "E83D64"),
    ("Tangerine", "FF8543"), ("Marigold", "FFD65B"), ("Spring jade", "67D7A1"),
    ("Lagoon", "3ABCCF"), ("Iris", "6678E6"), ("Mulberry", "A963CC"),
    ("Orchid selvedge", "E4A8EA"),
]]
hem = pigment("Mulberry binding", "854380")
gold = pigment("Butterscotch piping", "F4A033", .33)
cream = pigment("Champagne enamel", "FFF0A0", .28)
star_gold = pigment("Lemon drop", "FFD24A", .32)
amber = pigment("Candied orange seam", "ED8535", .36)
ink = pigment("Blueberry glass eyes", "342239", .27)
rouge = pigment("Peach blush", "FF8A68", .49)
white = pigment("Milk glass", "FFF5DA", .28)


def mesh_object(name, verts, faces, materials, indices, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for material in materials:
        mesh.materials.append(material)
    mesh.polygons.foreach_set("material_index", np.asarray(indices, dtype=np.int32))
    mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))
    return object_data(name, mesh, parent)


def normalize(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-8)


def easing(u):
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def spline(anchors, detail=18):
    """Interpolating cardinal spline with length-weighted tangents."""
    p = np.array(anchors, dtype=float)
    delta = np.diff(p, axis=0)
    lengths = np.linalg.norm(delta, axis=1)
    along = normalize(delta)
    slopes = np.vstack([along[0], (along[:-1] + along[1:]) / 2, along[-1]])
    u = np.arange(detail)[None, :, None] / detail
    d = lengths[:, None, None]
    knots = ((1 - 3*u**2 + 2*u**3) * p[:-1, None]
             + (3*u**2 - 2*u**3) * p[1:, None]
             + (u - 2*u**2 + u**3) * d * slopes[:-1, None]
             + (u**3 - u**2) * d * slopes[1:, None])
    return np.vstack([knots.reshape(-1, 3), p[-1]])


class Course:
    def __init__(self, points):
        self.p = points
        self.dist = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
        self.length = self.dist[-1]

    def at(self, s):
        return np.stack([np.interp(s, self.dist, axis) for axis in self.p.T], axis=-1)


def cross_axes(points, style, bank):
    tangent = normalize(np.gradient(points, axis=0))
    if style == "silk":
        across = normalize(np.cross(tangent, [0., 1., 0.]))
    elif style == "loop":
        across = normalize(np.array([0., 1., 0.]) - tangent[:, 1:2] * tangent)
    else:
        across = normalize(np.cross([0., -.55, .84], tangent))
    top = normalize(np.cross(tangent, across))
    a = np.asarray(bank).reshape(-1, 1)
    return tangent, across*np.cos(a) + top*np.sin(a), top*np.cos(a) - across*np.sin(a)


class Band:
    """A closed cross section with individual warp colours and rolled selvedges."""
    stops = np.array([-1., -.955, -.67, -.38, -.10, .19, .46, .73, .955, 1.])

    def __init__(self, name, rows, cloth):
        self.rows = rows
        self.cloth = cloth
        stops = np.sort(np.r_[self.stops, (self.stops[1:]+self.stops[:-1])/2])
        width = np.r_[stops, stops[::-1]]
        self.width = width
        crown = (.062 if cloth else -.095) * (1 - stops**2)
        if cloth:
            crown += .033 * np.cos(1.65*pi*stops-.32)
        else:
            crown += .042 * np.abs(stops)**10
        self.height = np.r_[crown, crown[::-1] - (.023 if cloth else .073)]
        n = len(width)
        faces, indices = [], []
        colours = np.repeat(np.arange(9),2)
        section = [*colours, 9, *colours[::-1], 9]
        for i in range(rows-1):
            for j, material in enumerate(section):
                k = (j+1) % n
                faces.append((i*n+j, (i+1)*n+j, (i+1)*n+k, i*n+k))
                indices.append(material)
        # Each end has a separate quad per stripe, including the two fishtail ends.
        for i in (0, rows-1):
            for j, colour in enumerate(colours):
                face = tuple(i*n + k for k in (j, j+1, n-2-j, n-1-j))
                faces.append(face if i == 0 else face[::-1])
                indices.append(colour)
        self.obj = mesh_object(name, np.zeros((rows*n, 3)), faces, silks + [hem], indices)

    def set(self, points, tangent, across, top, width):
        width = np.asarray(width).reshape(-1, 1, 1)
        vs = (points[:, None] + across[:, None] * width * self.width[None, :, None]
              + top[:, None] * self.height[None, :, None])
        if self.cloth:
            # Withdraw the middle warp threads at each end to cut a neat V.
            ds = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
            cut = np.maximum(0, .32-ds) - np.maximum(0, .32-(ds[-1]-ds))
            vs += (tangent*cut[:, None])[:, None] * (1-np.abs(self.width))[None, :, None]
        self.obj.data.vertices.foreach_set("co", vs.astype(np.float32).ravel())
        self.obj.data.update()


def bead(name, parent, position, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=18)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = position
    obj.scale = scale
    obj.data.materials.append(material)
    for f in obj.data.polygons:
        f.use_smooth = True
    return obj


def piping(name, coords, radius, material, parent=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.bevel_depth = radius
    data.bevel_resolution = 3
    data.use_fill_caps = True
    s = data.splines.new("POLY")
    s.points.add(len(coords)-1)
    s.points.foreach_set("co", np.c_[coords, np.ones(len(coords))].astype("f").ravel())
    data.materials.append(material)
    return object_data(name, data, parent)


def star():
    rider = object_data("Sugar-star rider")
    ang = pi/2 + np.arange(10)*pi/5
    radius = np.tile([1., .47], 5)
    corners = radius[:, None]*np.c_[np.cos(ang), np.sin(ang)]
    contour = []
    for j, pt in enumerate(corners):
        entry = pt + .145*(corners[j-1]-pt)
        leave = pt + .145*(corners[(j+1) % 10]-pt)
        for t in np.linspace(0, 1, 7):
            contour.append((1-t)**2*entry + 2*t*(1-t)*pt + t*t*leave)
        contour.append((leave + corners[(j+1) % 10]*.855 + pt*.145)/2)
    contour = np.array(contour)
    rings = [(.003,.22),(.42,.205),(.81,.15),(.96,.10),(1.,.014),
             (.993,-.049),(.966,-.096),(.89,-.148),(.70,-.213),(.45,-.257),
             (.22,-.279),(.003,-.285)]
    n = len(contour)
    verts = [(r*x,y,r*z) for r,y in rings for x,z in contour]
    faces = [(i*n+j, i*n+(j+1)%n, (i+1)*n+(j+1)%n, (i+1)*n+j)
             for i in range(len(rings)-1) for j in range(n)]
    mesh_object("Five rolled points", verts, faces, [amber, gold, star_gold],
                np.repeat([0,0,0,0,0,1,1,2,2,2,2],n), rider)
    for sign in (-1,1):
        bead("Polished eye", rider, (sign*.202,-.272,.043), (.062,.046,.084), ink)
        bead("Eye glint", rider, (sign*.202-.019,-.311,.073), (.019,.013,.019), white)
        bead("Peach cheek", rider, (sign*.31,-.244,-.060), (.087,.022,.044), rouge)
    bead("Glazed highlight", rider, (-.115,-.243,.333), (.042,.024,.080), cream).rotation_euler.y = .29
    t = np.linspace(-1, 1, 17)
    piping("Embroidered smile", np.c_[t*.090, -.289+.009*t*t, -.117+.05*t*t],
           .017, ink, rider)
    return rider


def build_slide():
    if level == 1:
        courses = [Course(spline([(-3.86,.60,1.38),(-3.15,.52,.83),(-2.60,.11,-.44),
                                  (-1.53,-.37,-1.47),(-.08,-.52,-1.79),(1.40,-.20,-1.57),
                                  (2.69,.27,-.91),(3.98,.65,-.73)]))]
    elif level == 2:
        courses = [Course(spline([(-3.68,1.22,1.98),(-2.56,1.44,1.53),(-.43,1.60,1.37),
                                  (1.94,1.42,1.38),(3.52,.76,.94),(3.71,-.06,.39),
                                  (2.94,-.48,-.19),(1.35,-.42,-.57),(-.81,-.15,-.78),
                                  (-2.65,-.22,-1.00),(-3.19,-.78,-1.57),(-2.56,-1.36,-2.08),
                                  (-.25,-1.66,-2.34),(2.10,-1.16,-2.03),(3.87,-.66,-1.57)]))]
    else:
        angle = np.linspace(0, tau, 190)
        # One full pitched helix. The exit passes in front of the entry at a
        # different elevation, followed by an actual break in the rail.
        helix = np.c_[-2.14+1.24*np.sin(angle)+.92*angle/tau,
                      .93-1.90*angle/tau,
                      -1.46+1.49*(1-np.cos(angle))-.27*angle/tau]
        entry = spline([(-4.24,1.38,1.52),(-4.03,1.35,.46),(-3.55,1.27,-.78),
                        (-2.85,1.13,-1.36),helix[0]])
        run = spline([helix[-1],(-.53,-1.18,-1.80),(.38,-1.12,-1.64),
                      (1.08,-.89,-1.28),(1.51,-.71,-.88)])
        land = spline([(2.79,-.73,-1.16),(3.18,-.76,-1.57),(3.56,-.60,-1.83),(4.07,-.37,-1.78)])
        courses = [Course(np.vstack([entry[:-1], helix[:-1], run])), Course(land)]
        roll_in, roll_out = courses[0].dist[[len(entry)-1, len(entry)+len(helix)-2]] / courses[0].length
    geometry = []
    for section, c in enumerate(courses):
        s = np.linspace(0, c.length, int(15*c.length)+1)
        p = c.at(s)
        if level == 3:
            bank = .43 + .24*np.sin(.81*s) + .12*np.sin(1.37*s)
            axes = cross_axes(p, "loop", bank)
        else:
            bank = .12 + (.25 if level == 1 else .39)*np.sin(s*.80-.6)
            axes = cross_axes(p, "slide", bank)
        tangent, across, top = axes
        radius = (.57, .48, .48)[level-1]
        track = Band(f"Rainbow slide section {section+1}", len(s), False)
        track.set(p, *axes, radius)
        for sign in (-1,1):
            edge = p+sign*radius*across+.054*top
            piping("Rolled safety edge", edge, .052, silks[0 if sign == -1 else -1])
            for j in (0,-1):
                bead("Gilt rail button", None, edge[j], (.071,.064,.068), gold)
        for j in (0,-1):
            stops = Band.stops
            lip = p[j]+radius*stops[:,None]*across[j]-.093*(1-stops**2)[:,None]*top[j]
            piping("Turned brass nosing", lip,.029,gold)
        geometry.append((s, top))
    rider = star()

    def ride(cidx, f):
        c = courses[cidx]
        distance = c.length * f
        s, tops = geometry[cidx]
        normal = normalize(np.array([np.interp(distance,s,v) for v in tops.T]))
        pos = c.at(distance)
        # The rounded feet sit on the front lane of the banked track.
        pos += normal*.53
        pos[1] -= .27
        return pos

    def pose(t):
        if level == 1:
            f = np.interp(t, [0,.13,.32,.58,.80,1], [.02,.045,.25,.62,.86,.98])
            pos = ride(0, f)
            tilt = -.17 + .32*sin(tau*(t-.12)) + .10*sin(3*pi*t)
        elif level == 2:
            f = .015+.968*(.34*t+.66*easing(t))
            pos = ride(0, f)
            tilt = .36*sin(3.15*pi*t-.31) - .12*sin(6*pi*t)
        else:
            if t < .71:
                f = np.interp(t, [0,.09,.24,.55,.71], [.012,.07,.31,.79,1.])
                pos = ride(0, f)
                tilt = -.19+.43*sin(tau*f-.36) - tau*easing((f-roll_in)/(roll_out-roll_in))
            elif t < .90:
                u = (t-.71)/.19
                pos = (1-u)*ride(0,1.) + u*ride(1,0.)
                pos += np.array([.24*sin(pi*u),-.71*sin(pi*u),1.94*4*u*(1-u)])
                tilt = -.34 + .60*sin(pi*u)
            else:
                u = (t-.90)/.10
                pos = ride(1,.92*easing(u))
                tilt = -.31+.35*easing(u)
        rider.location = pos
        rider.rotation_euler = (.025*cos(t*tau), tilt, .13*sin(2*tau*t-.20))
        r = (.89,.84,.80)[level-1]
        rider.scale = (r,r,r)
    return pose


def petal(center, reach, breadth, depth, sign):
    """A folded teardrop returning to the pinched throat on another depth plane."""
    ray = np.asarray(reach)
    perp = normalize(np.array([-ray[1], ray[0]]))*breadth*sign
    shape = [(0,0,0),(.42,.61,-.12),(.83,.95,-.22),(1.,.72,-.06),
             (1.055,.04,.28),(.95,-.75,.47),(.69,-.76,.42),(.36,-.41,.23),(0,0,0)]
    knots = []
    for a,b,y in shape:
        x,z = a*ray+b*perp
        knots.append(center + [x,depth*y,z])
    return spline(knots)


def make_knot():
    # A cuff wound across the gathered base. Bullnose rims turn under the silk.
    root = object_data("Cinched throat")
    stops = Band.stops
    rings = [(-1., .88), *[(v,1+.05*cos(v*pi*2)-.08*cos(v*pi)) for v in stops],(1.,.88)]
    verts = []
    sides = 52
    for x,r in rings:
        for a in np.arange(sides)*tau/sides:
            verts.append((.37*x + .057*sin(a+.39), .31*r*cos(a), .414*r*sin(a)))
    faces = [(i*sides+j,i*sides+(j+1)%sides,(i+1)*sides+(j+1)%sides,(i+1)*sides+j)
             for i in range(len(rings)-1) for j in range(sides)]
    mesh_object("Wrapped satin knot", verts, faces, [amber,gold,cream,star_gold],
                np.repeat([0,1,2,1,3,3,3,1,2,1,0], sides), root)
    return root


def build_ribbon():
    if level == 1:
        center = np.array([.05,0,1.55])
        tips = [(-2.58,-.12,-1.41),(-1.63,-.09,-.98),(-1.26,.18,-.41),(-.72,.03,.52)]
        petals = [((-2.61,.56),.72,1,-1),((2.48,.80),.82,1.1,1)]
        tail = [(.70,-.17,.48),(1.28,-.16,-.48),(1.87,.09,-1.22),(2.54,-.20,-1.56)]
        lead = [(-3.60,.25,.12),(-2.60,-.19,.83),(-1.20,-.42,.88),(.45,.34,.13),
                (1.46,.63,-.85),(.97,.10,-1.63),(-.52,-.22,-1.92),(-1.72,-.29,-1.64)]
    elif level == 2:
        center = np.array([-.12,0,1.19])
        tips = [(-3.29,-.02,-1.74),(-2.65,-.41,-1.33),(-1.93,-.38,-1.11),(-1.27,.02,-.01)]
        petals = [((-2.84,.68),.82,1.15,-1),((2.68,1.21),.85,1.35,1)]
        tail = [(.85,-.13,.32),(1.45,-.31,-.81),(2.33,-.15,-1.24),
                (2.85,.25,-1.81),(3.46,.04,-1.93)]
        lead = np.empty((0,3))
    else:
        center = np.array([-1.92,0,.92])
        tips = [(-3.79,-.02,-2.18),(-3.21,-.27,-2.13),(-2.60,-.13,-1.63),
                (-2.34,.31,-1.10),(-1.83,.12,-.60)]
        petals = [((-2.03,-.30),.61,1.1,-1),((-1.48,1.58),.68,1.3,-1),
                  ((.45,2.03),.62,1.1,-1),((2.08,1.16),.68,1.25,-1),
                  ((2.22,-.15),.61,1.15,-1)]
        tail = [(-.42,-.36,-.30),(.26,-.24,-1.07),(1.15,.10,-1.68),
                (2.18,.31,-1.77),(3.08,-.04,-1.34),(3.98,-.12,-1.58)]
        lead = [(3.97,-.15,-.44),(3.07,.13,.84),(2.02,.49,1.65),(.91,.66,1.65),
                (.34,-.04,.82),(1.02,-.42,-.05),(2.04,-.33,.18),(2.04,.18,.94),
                (1.27,.64,1.36),(-.22,.71,.92),(-1.46,.32,-.35),(-2.95,-.16,-1.80)]
    if level != 2:
        lead = spline([*lead, tips[0]])[:-1]
    first = spline([*tips,center])
    parts = [first]
    for reach,breadth,depth,sign in petals:
        parts.append(petal(center,reach,breadth,depth,sign)[1:])
    parts.append(spline([center,*tail])[1:])
    bow = np.vstack(parts)
    curve = Course(np.vstack([lead,bow]))
    join = curve.dist[len(lead)]
    knot_at = (curve.dist[len(lead)+len(first)-1] - join)/(curve.length-join)
    end_loops = (curve.dist[len(lead)+len(bow)-len(parts[-1])-1]-join)/(curve.length-join)
    grid = np.linspace(0,1,320)
    cloth = Band("Shot silk with bound edges",len(grid),True)
    cuff = make_knot()

    def knot(tighten):
        cuff.children[0].hide_render = bool(tighten < .025)
        cuff.location = center + np.array([0,-.31,-.012])
        cuff.scale = (.08+1.02*tighten,.09+1.03*tighten,.10+1.00*tighten)
        cuff.rotation_euler = (.10, -.18+.085*tighten, .18)

    if level == 2:
        # Follow the same two bights all the way from the figure eight to the
        # bow. The centre crossing lifts while the two loose ends pull down.
        mid = curve.dist[len(parts[0])+len(parts[1])-1]/curve.length
        def figure_eight(t):
            intro = easing(t/.39)
            end = .44 + .56*intro
            start = .085*(1-intro)
            along = start+(end-start)*grid
            angle = np.interp(along,[0,knot_at,mid,end_loops,1],[.54,0,pi,tau,tau-.55])
            eight = np.c_[-3.22*np.sin(angle),.70*np.cos(angle)+.13*angle,
                          .14+1.33*np.sin(2*angle)]
            free_end = np.clip(1-along/knot_at,0,1)+np.clip((along-end_loops)/(1-end_loops),0,1)
            eight[:,1] -= .62*free_end
            eight[:,2] -= .46*free_end
            settled = curve.at(along*curve.length)
            # Tails follow the flip in the upper loops with a small delay.
            tips = np.maximum(1-easing(along/knot_at),easing((along-end_loops)/(1-end_loops)))
            pull = easing((t-.45-.07*tips)/.42)
            slack = np.sin(pi*pull)
            p = eight*(1-pull[:,None]) + settled*pull[:,None]
            p[:,1] += (.55*np.sin(angle-.35)+.25)*slack
            p[:,2] += (.37*np.sin(angle+.78)-.28*tips)*slack
            p[:,2] += tips*.13*np.sin(along*21-7*t)
            p[:,1] += tips*.22*np.cos(along*17-6*t)
            near = np.linalg.norm((p-center)[:,[0,2]],axis=1)
            width = .36*(1-.39*(1-easing(near/.88))*pull)
            twist = .47+.56*np.sin(2.4*angle-.82*t)+.45*np.cos(4.2*angle-t)
            twist += .59*slack*np.cos(angle)
            calm = tips*pull
            twist = (1-.83*calm)*twist + .83*calm*(.30+.26*np.sin(along*28-t*2))
            cloth.set(p,*cross_axes(p,"silk",twist),width)
            knot(easing((t-.71)/.17))
        return figure_eight

    def pose(t):
        # Fabric enters from a loose flourish. Its head and tail traverse the
        # path independently as the two bights fold and the standing end catches.
        transition = (.28,.34,.27)[level-1]
        if t <= transition:
            u = t/transition
            head = join*((.50,.37,.43)[level-1]+(1-(.50,.37,.43)[level-1])*easing(u))
            foot = join*(.32 if level != 2 else .025)*easing(u)
            sew = 0.
        else:
            u = np.clip((t-transition)/(.94-transition),0,1)
            sew = .30*u+.70*easing(u)
            head = join + sew*(curve.length-join)
            initial = .32 if level != 2 else .025
            foot = join*(initial+(1-initial)*easing((t-transition)/(.86-transition)))
        d = foot + grid*(head-foot)
        p = curve.at(d)
        along = (d-join)/(curve.length-join)
        loose = 1-easing((t-.48)/.46)
        grab = easing((d-join+1.5)/2.6)
        # Before cinching, successive crossings float apart in height and depth.
        phase = along*tau*(2.9 if level<3 else 5.6)
        p[:,0] += loose*grab*(.28*np.sin(phase+.42)+.16*np.sin(2*phase))
        p[:,1] += loose*.38*np.sin(d*.81-t*5.2)
        p[:,2] += loose*(.20*np.cos(d*.88-t*6.3)+grab*.20*np.sin(phase))
        tails = np.maximum(1-easing(along/knot_at),easing((along-end_loops)/(1-end_loops)))
        p[:,2] += tails*(.15*np.sin(d*2.1-t*8)+.08*np.cos(d*1.2+t*7))*(1-.62*t)
        p[:,1] += tails*.19*np.cos(d*1.42-t*6)
        center_dist = np.linalg.norm((p-center)[:,[0,2]],axis=1)
        gather = easing(center_dist/.93)
        half_width = (.322,.330,.296)[level-1]*(.65+.35*gather)
        twist = .48 + .55*np.sin(d*.97-t*1.3) + .40*np.sin(d*1.77+t*.85)
        twist += tails*.32*np.sin(d*1.43-t*4.7)
        axes = cross_axes(p,"silk",twist)
        cloth.set(p,*axes,half_width)
        knot(easing((sew-end_loops+.14)/.22))
    return pose


pose = {"slide": build_slide, "ribbon": build_ribbon}[family]()
if mode == "render":
    frames = range(1,count+1)
elif mode == "proof":
    frames = sorted(set(int(round(v)) for v in np.linspace(1,count,8)))
else:
    frames = [int(v) for v in [mode,*rest]]
for frame in frames:
    scene.frame_set(frame)
    pose((frame-1)/(count-1))
    scene.render.filepath = str(output / f"{frame:03}.png")
    bpy.ops.render.render(write_still=True)
