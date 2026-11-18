"""Render the five Readling badge families with Blender.

blender -b -t 8 --python-exit-code 1 -P studies/badges/render.py
Add -- proof to render a small sample of each family without saving the master.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/badge-studies"
RAW.mkdir(parents=True, exist_ok=True)
PROOF = "--" in sys.argv and "proof" in sys.argv[sys.argv.index("--") + 1:]
TAU = math.tau
sin, cos = math.sin, math.cos
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 10 if PROOF else 24
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
font = bpy.data.fonts.load(str(ROOT / "dist/assets/fonts/young-serif.ttf"))
font.pack()
materials = {}
ball_meshes = {}
collection = scene.collection


def linear(x):
    return x / 12.92 if x < .04045 else ((x + .055) / 1.055) ** 2.4


def mat(name, color, metal=0, rough=.41):
    material = bpy.data.materials.new(name)
    rgb = tuple(linear(int(color[i:i+2], 16) / 255) for i in (0, 2, 4)) + (1,)
    material.diffuse_color = rgb
    material.use_nodes = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    for key, value in (("Base Color", rgb), ("Metallic", metal), ("Roughness", rough)):
        shader.inputs[key].default_value = value
    materials[name] = material


for spec in [
    ("gilt","D6A647",.70,.26), ("light gold","FFE093",.61,.25), ("bronze","805023",.64,.35),
    ("ivory","FFF0BC",.12,.35), ("ink","173B39",.12,.44), ("bark","644128",.02,.65),
    ("oak","BB8152",.03,.49), ("heartwood","E7B97D",.03,.48), ("grain","9C633B",.03,.54),
    ("moss","407957",.08,.41), ("shoot","9CB96C",.07,.4), ("nut","AC642F",.12,.36),
    ("poppy","D74637",.04,.38), ("cherry","942E3D",.07,.4), ("apricot","FF7852",.05,.36),
    ("ribbon","367B6E",.12,.4), ("ribbon back","285758",.13,.43), ("seed","533B38",.18,.42),
    ("moth edge","315B64",.30,.32), ("jade","60B3A0",.24,.28), ("seafoam","A6D7AC",.15,.35),
    ("midnight","273959",.30,.28), ("azure","42617E",.25,.29), ("coral","EC8D68",.2,.31),
    ("linen","486675",.08,.53), ("cloth","31535F",.06,.53), ("leather","784047",.11,.47),
    ("pages","F2DDA9",.04,.62), ("paper edge","BB935F",.14,.51), ("teal","347E7E",.28,.31)
]:
    mat(*spec)


def obj(name, data, material=None):
    ob = bpy.data.objects.new(name, data)
    collection.objects.link(ob)
    if material:
        data.materials.append(materials[material])
    return ob


def mesh(name, vertices, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    return obj(name, data, material)


def plate(name, outline, z, height, material, edge=.025):
    # Counter-clockwise top face, bevelled all the way around like a cut die.
    pts = list(outline)
    if sum(x * pts[(i+1) % len(pts)][1] - y * pts[(i+1) % len(pts)][0] for i,(x,y) in enumerate(pts)) < 0:
        pts.reverse()
    n = len(pts)
    verts = [(x,y,h) for h in (z,z+height) for x,y in pts]
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    ob = mesh(name, verts, faces, material)
    if edge:
        bev = ob.modifiers.new("Soft cut edge","BEVEL")
        bev.width = edge
        bev.segments = 3
        normal = ob.modifiers.new("Face normals","WEIGHTED_NORMAL")
        normal.keep_sharp = True
    return ob


def disc(name, x, y, rx, ry, z, h, material, n=80, edge=.02):
    return plate(name, [(x+rx*cos(i*TAU/n),y+ry*sin(i*TAU/n)) for i in range(n)], z,h,material,edge)


def wire(name, points, radius, material, closed=False):
    data = bpy.data.curves.new(name,"CURVE")
    data.dimensions = "3D"
    data.resolution_u = 6
    data.bevel_depth = radius
    data.bevel_resolution = 2
    data.use_fill_caps = True
    spl = data.splines.new("POLY")
    spl.points.add(len(points)-1)
    for p, co in zip(spl.points, points):
        p.co = (*co,1)
    spl.use_cyclic_u = closed
    return obj(name,data,material)


def ring(name,x,y,rx,ry,z,radius,material,start=0,end=TAU):
    n = max(10,round(84*(end-start)/TAU))
    points = [(x+rx*cos(start+(end-start)*i/n), y+ry*sin(start+(end-start)*i/n),z) for i in range(n+1)]
    return wire(name,points,radius,material)


def bead(name,x,y,z,sx,sy,sz,material):
    if material not in ball_meshes:
        vertices = [(cos(a*TAU/24)*sin(j*math.pi/12), sin(a*TAU/24)*sin(j*math.pi/12), cos(j*math.pi/12))
                    for j in range(13) for a in range(24)]
        faces = [(24*j+a,24*(j+1)+a,24*(j+1)+(a+1)%24,24*j+(a+1)%24) for j in range(12) for a in range(24)]
        ob = mesh(name,vertices,faces,material)
        for face in ob.data.polygons:
            face.use_smooth = True
        ball_meshes[material] = ob.data
    else:
        ob = obj(name,ball_meshes[material])
    ob.location = (x,y,z)
    ob.scale = (sx,sy,sz)
    return ob


def star(name,x,y,z,r,material,points=4,inner=.33,rotation=math.pi/2):
    outline = []
    for i in range(points*2):
        angle = rotation+math.pi*i/points
        rad = r if i%2==0 else inner*r
        outline.append((x+rad*cos(angle),y+rad*sin(angle)))
    plate(name,outline,z,.035,material,.009)


def number(level,x,y,z,size,material):
    text = bpy.data.curves.new("Editable badge number","FONT")
    text.body = str(level)
    text.font = font
    text.size = size / max(1,(len(str(level))-.4))
    text.align_x = "CENTER"
    text.align_y = "CENTER"
    text.extrude = .022
    text.bevel_depth = .008
    text.bevel_resolution = 3
    ob = obj("Level "+str(level),text,material)
    bpy.context.view_layer.update()
    bounds = list(ob.bound_box)
    mid = lambda axis: (min(p[axis] for p in bounds)+max(p[axis] for p in bounds))/2
    ob.location = (x-mid(0),y-mid(1),z)


def leaf(x,y,z,angle,length,width,material,lobed=False):
    def place(t,w,h):
        return (x+t*length*cos(angle)-w*sin(angle),y+t*length*sin(angle)+w*cos(angle),z+h)
    vertices, faces = [], []
    for i in range(19):
        t=i/18
        side = max(.002,sin(math.pi*t)**.75)*width
        if lobed:
            side *= .80-.20*cos(7*math.pi*t)
        h=.08*sin(math.pi*t)+.09*t*t
        vertices.extend([place(t,-side,h),place(t,0,h+.064*sin(math.pi*t)),place(t,side,h)])
        if i:
            j=(i-1)*3
            faces.extend([(j,j+3,j+4,j+1),(j+1,j+4,j+5,j+2)])
    ob=mesh("Folded leaf",vertices,faces,material)
    solid=ob.modifiers.new("Leaf edge","SOLIDIFY")
    solid.thickness=.017
    wire("Raised midrib",[vertices[i*3+1] for i in range(1,17)],.009,"light gold" if not lobed else "shoot")


def oak(level):
    n=128
    def rim(r):
        return [((r+.026*sin(7*a)+.018*cos(11*a))*cos(a),(r+.026*sin(7*a)+.018*cos(11*a))*sin(a)) for a in [i*TAU/n for i in range(n)]]
    plate("Rough bark",rim(.97),-.08,.24,"bark",.041)
    plate("Cut wood",rim(.89),.145,.08,"oak",.024)
    plate("Heartwood",rim(.82),.217,.04,"heartwood",.017)
    for k in range(4):
        rad=.71+k*.048
        pts=[((rad+.022*sin(3*a)+.009*cos(7*a))*cos(a),.01+(rad-.015+.016*cos(4*a))*sin(a),.256) for a in [i*TAU/n for i in range(n)]]
        wire("Growth ring",pts,.006 if k%2 else .010,"grain",True)
    for a in [i*.41 for i in range(15)]:
        wire("Bark fissure",[(.895*cos(a),.895*sin(a),.221),(.94*cos(a+.014),.94*sin(a+.014),.18),(.968*cos(a),.968*sin(a),.115)],.010,"bark")
    for k in range(3):
        ring("Knot in the grain",-.49,-.29,.044+k*.026,.015+k*.016,.260,.0045,"grain",.3,5.6)
    wire("Split in the timber",[(.48,-.64,.261),(.42,-.54,.261),(.40,-.55,.261),(.35,-.44,.261)],.008,"grain")
    # A shoot, a pair of leaves, an acorn, then a second branch and a full crown.
    sprays=[(.50,.70,1.19,.60,.19,"moss"),(.60,.72,.37,.59,.20,"shoot"),
            (-.54,.68,2.30,.63,.19,"moss"),(-.60,.67,3.04,.56,.16,"shoot"),(-.40,.82,1.82,.47,.16,"moss")]
    for x,y,a,l,w,c in sprays[:min(5,level)]:
        leaf(x,y,.26,a,l,w,c,True)
    if level>=3:
        for i in range(1+(level>=5)):
            x=.77-.18*i; y=.46-.17*i
            ring("Acorn stalk",x-.01,y+.12,.10,.19,.28,.025,"bark",.60,2.3)
            nut=bead("Polished acorn",x,y,.32,.14,.195,.095,"nut")
            nut.rotation_euler.z=-.36
            bead("Acorn cup",x+.027,y+.103,.36,.154,.077,.077,"bronze")
    number(level,-.075,-.05,.264,1.42,"bark")


def ribbon(side,level):
    tail=1.06+.042*level
    corners=[(.09,.10),(.52,.12),(.71,-tail),(.47,-tail+.16),(.30,-tail-.025)]
    plate("Forked silk ribbon",[(side*x,y) for x,y in corners],-.13,.08,"ribbon" if side<0 else "ribbon back",.022)
    for x in (.16,.43):
        wire("Gold woven stripe",[(side*x,-.15,-.044),(side*(x+.19),-tail+.14,-.044)],.011,"light gold")


def petal(angle,reach,span,z,material):
    vertices,faces=[],[]
    for i in range(13):
        t=i/12
        width=span*(.17+.83*sin(t*math.pi*.84)**.70)
        for j in range(9):
            s=(j-4)/4
            rad=.22+t*(reach-.22) - abs(s)**2*.19*t**2
            h=z+.11*sin(math.pi*t)+.12*s*s*t+.10*t*t+.030*cos(3*math.pi*s)*t*t
            vertices.append((rad*cos(angle)-s*width*sin(angle),rad*sin(angle)+s*width*cos(angle),h))
        if i:
            for j in range(8):
                k=(i-1)*9+j
                faces.append((k,k+9,k+10,k+1))
    ob=mesh("Cupped crêpe petal",vertices,faces,material)
    for f in ob.data.polygons: f.use_smooth=True
    sol=ob.modifiers.new("Petal thickness","SOLIDIFY")
    sol.thickness=.025
    for j in (2,6):
        wire("Petal pleat",[tuple(Vector(vertices[i*9+j])+Vector((0,0,.008))) for i in range(5,12)],.007,material)


def poppy(level):
    for side in (-1,1): ribbon(side,level)
    n=4+level
    if level>=3:
        for j in range(n):
            petal(TAU*(j+.5)/n,1.00,.37,.00,"cherry")
    for j in range(n):
        petal(TAU*j/n+.19,.83+.025*level,.36 if n<8 else .29,.13,["poppy","apricot","poppy","cherry"][j%4])
    for j in range(13+level):
        a=TAU*j/(13+level)
        bead("Anther",.46*cos(a),.46*sin(a),.34,.036,.035,.043,"seed")
    disc("Seed case",0,0,.42,.42,.22,.17,"bronze")
    disc("Enamel centre",0,0,.38,.38,.37,.055,"ivory")
    ring("Fine gold setting",0,0,.39,.39,.427,.018,"light gold")
    number(level,0,0,.428,.92,"ink")


def smooth(points, steps=8):
    # Closed Catmull-Rom outline sampled for the enamel dies.
    out=[]
    for i,p in enumerate(points):
        a=Vector(points[i-1]); b=Vector(p); c=Vector(points[(i+1)%len(points)]); d=Vector(points[(i+2)%len(points)])
        for j in range(steps):
            t=j/steps
            out.append(tuple(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3)))
    return out


def moth(level):
    fore=[(.07,.09),(.29,.56),(.76,.85),(1.19,.94),(1.24,.70),(1.12,.39),(.89,.20),(.68,.10),(.38,-.06)]
    hind=[(.09,.09),(.61,.19),(.98,.12),(.98,-.15),(.78,-.38),(.64,-.40),(.47,-.69),(.28,-.85),(.30,-.46),(.12,-.22)]
    for side in (-1,1):
        for outline,z,material in [(hind,.04,"seafoam"),(fore,.14,"jade")]:
            outline=smooth(outline)
            mirror=lambda x,y:(side*x*(.88+.026*level),y)
            edge=[mirror(x,y) for x,y in outline]
            plate("Wing setting",edge,z,.10,"moth edge",.025)
            pts=[mirror(.54+(x-.54)*.936,.20+(y-.20)*.92) for x,y in outline]
            plate("Champlevé enamel",pts,z+.095,.045,material,.016)
            wire("Rolled cloisonné",[(x,y,z+.139) for x,y in pts],.012,"gilt",True)
        for j,tip in enumerate([(.97,.67),(.96,.38),(.68,.31),(.63,-.32),(.42,-.52)][:2+min(level,3)]):
            x,y=tip
            z=.296 if y>=0 else .186
            wire("Wing vein",[(side*.15,0,z),(side*x*.50,y*.44,z),(side*x*.79,y*.71+.024,z),(side*x,y,z)],.011,"moth edge")
        for i,(x,y,r) in enumerate([(.83,.54,.106),(.69,-.18,.083),(.99,.74,.051),(.50,-.40,.048),(.62,.35,.043)][:level]):
            z=.294 if y>0 else .188
            disc("Eye spot · setting",side*x,y,r,r*.88,z,.021,"gilt",48,.009)
            disc("Eye spot · enamel",side*x,y,r*.73,r*.63,z+.02,.018,"midnight",40,.007)
            bead("Eye spot light",side*x-.012,y+.014,z+.042,r*.27,r*.20,.013,"ivory")
        wire("Antenna",[(side*.05,.27,.29),(side*.10,.63,.29),(side*.24,.84,.26),(side*.30,.87,.25)],.018,"bronze")
        bead("Antenna tip",side*.30,.87,.25,.039,.053,.032,"gilt")
    disc("Locket bezel",0,.02,.30,.47,.17,.16,"gilt")
    disc("Locket enamel",0,.02,.262,.42,.32,.065,"midnight")
    bead("Tail stone",0,-.46,.22,.075,.17,.065,"jade")
    number(level,0,.035,.395,.82,"ivory")


def book(level):
    def cover(name,w,h,z,d,material):
        return plate(name,[(-w,-h),(w-.07,-h),(w,-h+.07),(w,h-.07),(w-.07,h),(-w,h)],z,d,material,.035)
    cover("Cloth back cover",.725,.93,-.13,.09,"cloth")
    cover("Gilt page block",.67,.885,-.052,.19,"pages")
    for j in range(4):
        wire("Deckled fore edge",[(.671,-.76,-.025+j*.040),(.671,.77,-.025+j*.040)],.008,"paper edge")
    for j in range(min(3,1+(level-1)//2)):
        x=.37-j*.22; end=-1.13-.05*(j%2)
        plate("Woven bookmark",[(x-.064,-.69),(x+.064,-.69),(x+.064,end),(x,end+.063),(x-.064,end)],.037,.027,["poppy","gilt","ribbon"][j],.01)
    cover("Cloth front cover",.72,.915,.126,.105,["linen","moss","leather","cloth","midnight"][min(level,5)-1])
    plate("Rounded binding",[(-.73,-.92),(-.52,-.92),(-.52,.92),(-.73,.92)],.165,.084,"leather",.035)
    wire("Foil border",[(-.435,-.79,.24),(.58,-.79,.24),(.58,.79,.24),(-.435,.79,.24)],.013,"gilt",True)
    for sy in (-1,1):
        for j in range(min(3,level)):
            y=sy*(.72-j*.12)
            wire("Raised spine band",[(-.70,y,.251),(-.55,y,.251)],.014,"gilt")
        if level>=3:
            plate("Brass corner",[(.47,.90*sy),(.70,.90*sy),(.70,.66*sy)],.228,.026,"gilt",.011)
    # Gilt botanical block on the cover, from a sprout to a little stand of trees.
    for j in range(level):
        x=.072+(j-(level-1)/2)*.150
        h=.20+.082*(1-abs(j-(level-1)/2)/3)
        plate("Cover engraving",[(x,-.49+h),(x-.095,-.49),(x-.033,-.49),(x-.033,-.55),(x+.033,-.55),(x+.033,-.49),(x+.095,-.49)],.231,.018,"light gold",.004)
    star("Printer's star",.075,.59,.236,.092,"light gold")
    number(level,.07,.08,.237,1.20,"ivory")


def compass(level):
    big=.89+.027*level
    disc("Octagonal brass case",0,0,big,big,-.09,.22,"bronze",8,.065)
    disc("Polished lip",0,0,big*.97,big*.97,.10,.075,"gilt",8,.035)
    disc("Midnight enamel dial",0,0,big*.88,big*.88,.168,.050,"midnight",80,.022)
    ring("Dial bead",0,0,big*.86,big*.86,.219,.014,"light gold")
    ring("Suspension bow",0,big+.087,.17,.205,.022,.041,"gilt")
    disc("Crown foot",0,big-.025,.11,.09,.020,.095,"bronze",40,.014)
    for j in range(12+4*level):
        a=TAU*j/(12+4*level)
        outer=big*.79; inner=outer-(.074 if j%2==0 else .040)
        wire("Engraved scale",[(inner*cos(a),inner*sin(a),.225),(outer*cos(a),outer*sin(a),.225)],.008,"ivory")
    rays=4 if level<3 else 8
    for j in range(rays):
        a=math.pi/2+j*TAU/rays
        r=big*(.69 if rays==4 or j%2==0 else .55)
        dx,dy=cos(a),sin(a); px,py=-dy,dx
        top=(r*dx,r*dy,.24); ridge=(.20*dx,.20*dy,.34)
        left=(.20*dx+.101*px,.20*dy+.101*py,.23); right=(.20*dx-.101*px,.20*dy-.101*py,.23)
        mesh("Compass needle · bright",[top,left,ridge],[(0,1,2)],"light gold" if j%2==0 else "jade")
        mesh("Compass needle · shadow",[top,ridge,right],[(0,1,2)],"gilt" if j%2==0 else "teal")
    if level>=2:
        for j in range(level):
            a=(j-(level-1)/2)*.36-math.pi/2
            bead("Setting",big*.93*cos(a),big*.93*sin(a),.18,.034,.034,.030,"jade")
    if level>=4:
        for side in (-1,1):
            leaf(side*.67,-.56,.18,(-.58 if side==1 else math.pi+.58),.42,.088,"gilt")
            if level==5:
                leaf(side*.78,-.49,.18,.38 if side==1 else math.pi-.38,.31,.075,"light gold")
    disc("Hub",0,0,.34,.34,.245,.115,"gilt")
    disc("Ivory face",0,0,.298,.298,.35,.056,"ivory")
    number(level,0,.004,.409,.77,"ink")


world=bpy.data.worlds.new("Studio linen")
scene.world=world
world.use_nodes=True
world.node_tree.nodes["Background"].inputs[0].default_value=(.76,.82,.87,1)
world.node_tree.nodes["Background"].inputs[1].default_value=.45
camera_data=bpy.data.cameras.new("Product lens")
camera=obj("Camera",camera_data)
scene.camera=camera
camera_data.type="ORTHO"
def look(ob,point):
    ob.rotation_euler=(Vector(point)-ob.location).to_track_quat("-Z","Y").to_euler()


def light(name,location,power,size,color):
    data=bpy.data.lights.new(name,"AREA")
    data.energy=power; data.shape="DISK"; data.size=size; data.color=color
    lamp=obj(name,data)
    lamp.location=location
    look(lamp,(0,0,0))
    return lamp


lights=[light("Large linen softbox",(-3.3,4.7,6.2),490,4.2,(1,.90,.77)),
        light("Cool fill",(3.9,.6,4.8),230,3.4,(.78,.88,1)),
        light("Edge strip",(-.7,-3.3,2.4),120,2.0,(1,.82,.68))]
families={"oak":oak,"poppy":poppy,"moth":moth,"book":book,"compass":compass}
offsets=[]
for row,(key,construct) in enumerate(families.items()):
    for level in ([4] if PROOF else range(1,6)):
        collection=bpy.data.collections.new(f"{key.title()} · {level}")
        scene.collection.children.link(collection)
        construct(level)
        if key=="book":
            parent=obj("Bound at an angle",None)
            for child in list(collection.objects):
                if child!=parent: child.parent=parent
            parent.rotation_euler[2]=.11
        for ob in collection.objects:
            ob.hide_render=True
        offsets.append((collection,key,level,row))

camera.location=(.65,-3.4,16)
look(camera,(0,0,.1))
camera_data.ortho_scale=2.95
scene.render.resolution_x=scene.render.resolution_y=224 if PROOF else 384
for group,key,level,_ in offsets:
    for ob in group.objects: ob.hide_render=False
    scene.render.filepath=str(RAW/f"{key}-{level}{'-proof' if PROOF else ''}.png")
    bpy.ops.render.render(write_still=True)
    for ob in group.objects: ob.hide_render=True

if not PROOF:
    # Keep every editable mesh in a named collection on a single contact sheet.
    for group,key,level,row in offsets:
        for ob in group.objects:
            ob.hide_render=False
            if not ob.parent:
                ob.location.x+=(level-3)*3
                ob.location.y+=(2-row)*3
    for lamp in lights:
        lamp.location*=5
        lamp.data.energy*=25
        lamp.data.size*=5
    camera.location=(0,-2.4,33)
    look(camera,(0,0,0))
    camera_data.ortho_scale=15.3
    scene.render.resolution_x=scene.render.resolution_y=1600
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=="VIEW_3D":
                area.spaces.active.region_3d.view_perspective="CAMERA"
                area.spaces.active.overlay.show_overlays=False
                area.spaces.active.shading.color_type="MATERIAL"
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(Path(__file__).with_name("readling-badges.blend")),compress=True)
