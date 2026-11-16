"""The three Word Woods oaks. No external models, textures, or compositor plates.

blender -b -t 5 --python-exit-code 1 -P oak.py -- 3 proof
blender -b -t 5 --python-exit-code 1 -P oak.py -- 3 render
python oak.py pack 3

Blender renders the moving poses; the opening and closing rests are exact holds.
The packer interns identical poses so a held tree costs no extra texture space.
"""
import hashlib
import json
import math
import random
import runpy
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/flower-studies"
DIST = ROOT / "dist/assets/flower-studies"
COUNTS = {1: 66, 2: 78, 3: 94}
LAST = {1: 53, 2: 66, 3: 85}
KEYS = {1: (1, 14, 23, 34, 45, 66), 2: (1, 15, 26, 38, 50, 78),
        3: (1, 16, 28, 40, 52, 66, 72, 78, 94)}


def pack(lvl):
    from PIL import Image, ImageChops, ImageDraw
    take = f"oak-{lvl}"
    folder = RAW / take
    scratch = tempfile.TemporaryDirectory(prefix="oak-pack-", dir=folder)
    poses = Path(scratch.name)
    DIST.mkdir(parents=True, exist_ok=True)
    known, timeline, bounds = {}, [], []
    for i in range(1, COUNTS[lvl] + 1):
        fn = folder / f"{i:03}.png"
        with Image.open(fn) as im:
            assert im.size == (480, 360) and im.mode == "RGBA"
            alpha = im.getchannel("A")
            b = alpha.getbbox()
            assert b and min(b[0], b[1], 480-b[2], 360-b[3]) >= 3, (i, b)
            bounds.append(b)
            sig = hashlib.sha256(im.tobytes()).digest()
        if sig not in known:
            known[sig] = len(known)
            shutil.copyfile(fn, poses / f"{len(known):03}.png")
        timeline.append(known[sig])
    runpy.run_path(str(ROOT / "studies/ember-orca/pack-progression.py"))["pack_shot"](
        poses, DIST, take, len(known))
    scratch.cleanup()
    manifest = DIST / f"{take}.json"
    meta = json.loads(manifest.read_text())
    meta["frames"] = [meta["frames"][j] for j in timeline]
    manifest.write_text(json.dumps(meta, separators=(",", ":"))+"\n", encoding="utf-8")
    # Compare the decoded alpha in every packed sprite against the actual render.
    pages = [Image.open(DIST / name).convert("RGBA") for name in meta["sheets"]]
    for i, (p, x, y, w, h, dx, dy) in enumerate(meta["frames"]):
        assert (dx, dy, dx+w, dy+h) == bounds[i]
        a = pages[p].getchannel("A").crop((x, y, x+w, y+h))
        with Image.open(folder / f"{i+1:03}.png") as src:
            assert not ImageChops.difference(src.getchannel("A").crop(bounds[i]), a).getbbox()
    with Image.open(folder / f"{COUNTS[lvl]:03}.png") as im:
        im.resize((320, 240), Image.Resampling.LANCZOS).save(
            DIST / f"{take}-poster.webp", quality=90, method=6, alpha_quality=100)
    board = Image.new("RGB", (3*240, math.ceil(len(KEYS[lvl])/3)*205), "#eee8da")
    draw = ImageDraw.Draw(board)
    for j, frame in enumerate(KEYS[lvl]):
        with Image.open(folder / f"{frame:03}.png") as im:
            im = im.resize((240, 180), Image.Resampling.LANCZOS)
            x, y = j%3*240, j//3*205
            board.paste(im, (x,y), im)
            draw.text((x+12,y+182), f"OAK  {lvl}    /    {frame:02}f", fill="#414c43")
    board.save(folder / "oak-key-poses.jpg", quality=94)
    playback(lvl, meta, pages)
    print(take, "frames", len(timeline), "unique", len(known), "sheets", [s.size for s in pages],
          "union", (min(b[0] for b in bounds),min(b[1] for b in bounds),
                    max(b[2] for b in bounds),max(b[3] for b in bounds)), "final", bounds[-1])


def playback(lvl, meta=None, pages=None):
    from PIL import Image
    if meta is None: meta=json.loads((DIST/f"oak-{lvl}.json").read_text())
    if pages is None: pages=[Image.open(DIST/name).convert("RGBA") for name in meta["sheets"]]
    # Playback proof from the decoded sheets, using the same offsets as the
    # game's drawImage call. Keep this animation out of the shipped assets.
    restored=[]
    for p,x,y,w,h,dx,dy in meta["frames"]:
        im=Image.new("RGBA",(480,360))
        im.paste(pages[p].crop((x,y,x+w,y+h)),(dx,dy))
        restored.append(im)
    restored[0].save(RAW / f"oak-{lvl}" / "oak-playback.webp",save_all=True,append_images=restored[1:],
                     duration=[round((i+1)*1000/24)-round(i*1000/24) for i in range(len(restored))],
                     loop=0,quality=88,method=4,alpha_quality=100)


if __name__ == "__main__" and "--" not in sys.argv:
    if len(sys.argv) < 2 or sys.argv[1] not in ("pack","playback"):
        raise SystemExit(__doc__)
    for level in map(int, sys.argv[2:] or (1,2,3)):
        (pack if sys.argv[1]=="pack" else playback)(level)
    raise SystemExit

import bpy
from mathutils import Vector, Quaternion

V = Vector
Z = V((0,0,1))
TAU = math.tau
sin, cos, pi = math.sin, math.cos, math.pi
R = random.Random(7791)
lev, action, *extra = sys.argv[sys.argv.index("--")+1:]
lev = int(lev)
folder = RAW / f"oak-{lev}"
folder.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def linear(h):
    def channel(i):
        s = int(h[i:i+2],16)/255
        return s/12.92 if s <= .04045 else ((s+.055)/1.055)**2.4
    return tuple(channel(i) for i in (0,2,4))


def tint(c, k):
    return tuple(min(1, v*k) for v in c)


def blend(a,b,t):
    return tuple(x*(1-t)+y*t for x,y in zip(a,b))


def pigment(name, rough):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    shader = nt.nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Specular IOR Level"].default_value = .26
    ink = nt.nodes.new("ShaderNodeVertexColor")
    ink.layer_name = "Pigment"
    nt.links.new(ink.outputs["Color"], shader.inputs["Base Color"])
    return m


WOOD = pigment("Weathered heartwood and cork", .80)
LEAF = pigment("Oak blades / satin cuticle", .58)
NUT = pigment("Amber kernel and tiled cupule", .48)


def surface_grain(mat, oak=False):
    nt=mat.node_tree; nodes=nt.nodes; link=nt.links.new
    uv=nodes.new("ShaderNodeTexCoord")
    stretch=nodes.new("ShaderNodeVectorMath");stretch.operation="MULTIPLY"
    link(uv.outputs["UV" if oak else "Generated"],stretch.inputs[0])
    stretch.inputs[1].default_value=(16,2.9,1) if oak else (4,4,1.3)
    n=nodes.new("ShaderNodeTexNoise");n.inputs["Scale"].default_value=2.4 if oak else 2.0
    n.inputs["Detail"].default_value=2.8;n.inputs["Distortion"].default_value=.36
    link(stretch.outputs[0],n.inputs["Vector"])
    ramp=nodes.new("ShaderNodeValToRGB");link(n.outputs["Fac"],ramp.inputs[0])
    curve=ramp.color_ramp;curve.elements.remove(curve.elements[1])
    stops=((.22,.35),(.38,.55),(.47,.86),(.54,1.10),(.65,1.36),(.80,1.46)) if oak else ((.18,.75),(.8,1.19))
    for i,(t,v) in enumerate(stops):
        e=curve.elements[0] if i==0 else curve.elements.new(t)
        e.position=t;e.color=(v,v*.992,v*.973,1)
    mix=nodes.new("ShaderNodeVectorMath");mix.operation="MULTIPLY"
    ink=next(nd for nd in nodes if nd.bl_idname=="ShaderNodeVertexColor")
    link(ink.outputs["Color"],mix.inputs[0]);link(ramp.outputs[0],mix.inputs[1])
    shader=nodes.get("Principled BSDF");link(mix.outputs[0],shader.inputs["Base Color"])
    if oak:
        bump=nodes.new("ShaderNodeBump");bump.inputs["Distance"].default_value=.029;bump.inputs["Strength"].default_value=.27
        link(n.outputs["Fac"],bump.inputs["Height"]);link(bump.outputs[0],shader.inputs["Normal"])


CORK=WOOD.copy();CORK.name="Silvered and fissured oak bark"
surface_grain(CORK,True)
surface_grain(LEAF)
surface_grain(NUT)

class Mesh:
    def __init__(self):
        self.v, self.f, self.c, self.s = [], [], [], []
        self.uv={}
    def point(self,v):
        self.v.append(tuple(v))
        return len(self.v)-1
    def face(self,ids,color,smooth=False):
        self.f.append(tuple(ids)); self.c.append((*color,1)); self.s.append(smooth)
    def finish(self,name,mat,parent=None,origin=(0,0,0)):
        data = bpy.data.meshes.new(name)
        data.from_pydata(self.v,[],self.f)
        data.materials.append(mat)
        colors = data.color_attributes.new(name="Pigment", type="BYTE_COLOR", domain="CORNER")
        # BYTE_COLOR stores sRGB internally; foreach_set('color') takes linear values.
        from array import array
        buf = array("f", (v for col, face in zip(self.c,self.f) for _ in face for v in col))
        colors.data.foreach_set("color", buf)
        data.polygons.foreach_set("use_smooth", self.s)
        if mat==CORK:
            layer=data.uv_layers.new(name="Bark direction")
            pairs=array("f",(v for i,f in enumerate(self.f)
                             for pair in self.uv.get(i,[(.357,.45)]*len(f)) for v in pair))
            layer.uv.foreach_set("vector",pairs)
        obj = bpy.data.objects.new(name,data); scene.collection.objects.link(obj)
        obj.parent = parent; obj.location = origin
        return obj


def pivot(name, parent=None, loc=(0,0,0)):
    ob = bpy.data.objects.new(name,None); scene.collection.objects.link(ob)
    ob.parent = parent; ob.location = loc
    return ob


def key(o,prop,frame,value):
    setattr(o,prop,value); o.keyframe_insert(data_path=prop,frame=frame)


def grow(o,start,end, overshoot=.025):
    for t,x in ((start,.0001),(start+(end-start)*.79,1+overshoot),(end,1)):
        key(o,"scale",t,(x,)*3)


def spline(points, steps):
    out = []
    for i in range(len(points)-1):
        a,b,c,d = [points[max(0,min(len(points)-1,j))] for j in (i-1,i,i+1,i+2)]
        for n in range(steps):
            t = n/steps
            out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return out+[points[-1]]


def tube(mesh, points, radii, color, sides=9, steps=3, bark=0):
    pts = spline(list(map(V,points)),steps)
    rings = []
    phase = R.uniform(-1,1)
    dist=0
    for i,p in enumerate(pts):
        q = i/(len(pts)-1); a=min(i//steps,len(radii)-2); f = (i-a*steps)/steps
        radius = radii[a]*(1-f)+radii[a+1]*f
        direction = (pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]).normalized()
        if not i:
            ref = V((0,1,0)) if abs(direction.y)<.9 else V((1,0,0))
            axis = direction.cross(ref).normalized()
        else:
            axis = (axis-direction*axis.dot(direction)).normalized()
        other = direction.cross(axis)
        ring = []
        for k in range(sides):
            angle=TAU*k/sides
            th = angle + bark*.071*sin(q*5+phase) + bark*.12*q
            ridge = .078*cos(5*angle+sin(q*7))+.055*sin(3*angle+q*2)+.038*cos(8*angle-q*5)
            ring.append(mesh.point(p+radius*(1+bark*ridge)*(cos(th)*axis+sin(th)*other)))
        if rings:
            newdist=dist+(p-pts[i-1]).length
            for k in range(sides):
                kk=(k+1)%sides
                val = 1 + bark*(.14*sin(k*7.03+.9*sin(q*8+phase))+.11*cos(k*2.1-q*3))
                mesh.face((rings[-1][k],rings[-1][kk],ring[kk],ring[k]),tint(color,val),True)
                if bark>=.9:
                    u=k/sides*radii[0]*TAU;uu=(k+1)/sides*radii[0]*TAU
                    mesh.uv[len(mesh.f)-1]=[(u,dist),(uu,dist),(uu,newdist),(u,newdist)]
            dist=newdist
        rings.append(ring)
    mesh.face(reversed(rings[0]),color); mesh.face(rings[-1],color)


# Each side has four broad rounded lobes and recessed sinuses, then a rounded tip.
# The two blade halves have separate camber; the midrib and lateral veins sit
# on the surface, following its fold. The lobes point gently toward the apex.
OUTLINE = [(0,.04),(.05,.29),(.085,.48),(.13,.46),(.17,.27),
           (.205,.42),(.235,.71),(.285,.81),(.32,.73),(.355,.43),
           (.40,.51),(.445,.91),(.50,1),(.54,.93),(.575,.52),
           (.62,.63),(.67,.91),(.72,.91),(.755,.80),(.78,.46),
           (.82,.48),(.86,.62),(.90,.54),(.925,.31),(.95,.32),(.981,.21),(1,.012)]
OUTLINE = [(s.x,s.y) for s in spline([V(p) for p in OUTLINE],2)]
def blade(m, pos, vec, broad, color, facing, veins=True, detailed=False):
    p,d=V(pos),V(vec)
    length=d.length
    axis=d.normalized()
    w=V(facing).cross(axis).normalized()
    normal=axis.cross(w).normalized()
    bend=R.uniform(-.10,.12); asym=R.uniform(-.085,.085); twist=R.uniform(-.48,.48)
    def shape(t, offset):
        ww=Quaternion(axis,twist*(t-.3)) @ w
        nn=axis.cross(ww)
        return (p + d*(t + .085*abs(offset)*sin(t*pi))
                + length*(ww*(offset*broad*(1+asym*(1 if offset>0 else -1))+.026*sin(2*pi*t))
                + nn*(.09*sin(pi*t)+bend*t*t-.071*abs(offset))))
    # Use fewer stations at crown scale, where each lobe is only a pixel or two.
    profile=OUTLINE if detailed else OUTLINE[::2]
    rings=[]
    for t, wid in profile:
        line=[m.point(shape(t,-wid)),m.point(shape(t,0)),m.point(shape(t,wid))]
        if rings:
            old=rings[-1]
            m.face((old[0],line[0],line[1],old[1]),tint(color,.91+.06*t),True)
            m.face((old[1],line[1],line[2],old[2]),tint(color,1.035+.05*t),True)
        rings.append(line)
    if veins:
        vc=blend(color,linear("d3bb63"),.34 if detailed else .20)
        def ribbon(points, width):
            pairs=[]
            for j,(t,s) in enumerate(points):
                ct=shape(t,s)+normal*length*(.009 if detailed else .003)
                sw=w if not s else (w-axis*.58)
                half=length*width*(1-.93*j/(len(points)-1))
                pair=[m.point(ct-half*sw),m.point(ct+half*sw)]
                if pairs: m.face((pairs[-1][0],pair[0],pair[1],pairs[-1][1]),vc)
                pairs.append(pair)
        ribbon([(j/8,0) for j in range(9)],.011 if detailed else .014)
        if detailed:
            for t,span in ((.13,.47),(.29,.78),(.49,.96),(.69,.86),(.86,.54)):
                for sign in (-1,1):
                    ribbon([(t-.107,0),(t-.058,sign*span*.32),(t+.022,sign*span*.82)],.007)


def lathe(m, profile, col, lo=0, hi=TAU, count=40, cut=False):
    rows=[]
    for i,(z,r) in enumerate(profile):
        row=[]
        for j in range(count+1):
            a=lo+(hi-lo)*j/count
            rr=r*(1+.014*cos(7*a+z*3))
            row.append(m.point((rr*cos(a),rr*sin(a),z)))
        if rows:
            for j in range(count):
                shade=.96+.045*cos(5*(lo+(hi-lo)*(j+.5)/count)+z)
                m.face((rows[-1][j],rows[-1][j+1],row[j+1],row[j]),tint(col,shade),True)
        rows.append(row)
    if cut:
        cutcol=linear("e6ad61")
        for i in range(1,len(rows)):
            m.face((rows[i-1][0],rows[i][0],rows[i][-1],rows[i-1][-1]),cutcol)


KERNEL=[(-.58,.006),(-.54,.088),(-.45,.18),(-.32,.28),(-.12,.355),(.10,.366),(.25,.343),(.31,.28),(.32,.008)]
CAP=[(.14,.265),(.13,.344),(.17,.39),(.23,.402),(.31,.388),(.39,.33),(.445,.235),(.485,.12),(.495,.014)]
def cup(m, ornate):
    lathe(m,CAP,linear("885729"),count=32 if ornate else 16)
    if ornate:
        lathe(m,[(.265,.003),(.253,.11),(.222,.22),(.144,.307),(.13,.344)],
              linear("a87e4d"),count=32)
    # Overlapping pentagonal scales with recessed lower rims.
    for row,(z,rr,n,sz) in enumerate(((.20,.397,19,.061),(.272,.404,18,.061),
                                            (.341,.368,16,.057),(.406,.297,14,.049),(.458,.202,10,.038))):
        if not ornate and row%2: continue
        for j in range(n):
            a=(j+(row%2)*.5)*TAU/n
            normal=V((cos(a),sin(a),0)); lateral=V((-sin(a),cos(a),0))
            ct=normal*rr+Z*z; width=rr*pi/n*1.1
            edge=[m.point(ct+lateral*width*x+Z*sz*y+normal*sz*k)
                  for x,y,k in ((0,-1,.05),(1,-.28,-.02),(.82,.56,-.08),(0,.85,-.15),(-.9,.50,-.08),(-1,-.28,-.02))]
            mid=m.point(ct+normal*.022)
            c=linear(R.choice(("b38a4e","9d723c","bc9156","a77d47","927044")))
            for k in range(6): m.face((edge[k],edge[(k+1)%6],mid),tint(c,.85+.03*k),True)
    tube(m,[(0,0,.46),(.016,.01,.53),(.061,.018,.60),(.065,.02,.661)],
         [.077,.06,.042,.027],linear("654528"),8,3)


def seed(sc, finish):
    group=pivot("First acorn / seam faces the lens",loc=(0,-.12,.565*sc))
    group.scale=(sc,)*3; group.rotation_euler=(.04,-.18,-.18)
    for j in range(2):
        m=Mesh(); lathe(m,KERNEL,linear("bd702b" if j==0 else "cc8234"),
                        -pi*.5+j*pi,pi*.5+j*pi,count=24,cut=True)
        ob=m.finish("Split cotyledon",NUT,group)
        side=(1,-1)[j]
        for fr,x,z,rot in ((5,0,0,0),(10,.032,-.005,.042),(17,.27,-.155,.56),(23,.35,-.23,.85)):
            key(ob,"location",fr,(x*side,0,z));key(ob,"rotation_euler",fr,(rot*.17,side*rot,side*rot*.52))
    m=Mesh(); cup(m,True)
    cap=m.finish("Cupule lifts and rolls beside the seed",NUT,group)
    for fr,x,y,z,a in ((4,0,0,0,0),(10,-.04,.01,.095,-.12),(15,-.34,.02,.27,-.61),
                         (21,-.78,.075,-.30,-1.06),(24,-.82,.085,-.26,-1.14),(28,-.84,.10,-.31,-1.18)):
        key(cap,"location",fr,(x,y,z));key(cap,"rotation_euler",fr,(0,a,-.12*abs(a)))
    for f,s in ((23,sc),(finish,sc*(.17 if lev>1 else .74))):
        key(group,"scale",f,(s,)*3)
        key(group,"location",f,(0,-.12 if f==23 or lev==1 else -.03,.565*s))


GREEN = [linear(h) for h in ("45843e","79a641","bad05c","448e4d","337b49","689f45","99b74a")]
def seedling(scale,adult=False):
    unit=pivot("Vernal shoot");unit.scale=(scale,)*3
    stem=pivot("Uncurling stem",unit)
    grow(stem,11,39 if not adult else 31,.045)
    wood=Mesh()
    nodes=[(0,0,.08),(.058,.02,.41),(-.145,.06,.88),(-.04,.055,1.30),(.14,.08,1.66),(.105,.07,1.91)]
    if adult: nodes[0]=(0,0,0)
    tube(wood,nodes,[.060,.052,.041,.033,.024,.013],linear("799246"),12,6,bark=.30)
    for side in (() if adult else (-1,1)):
        tube(wood,[(0,0,.23),(.08*side,-.015,.11),(.22*side,-.07,.052),(.38*side,-.054,.029)],
             [.055,.045,.022,.004],linear("b99354"),9,3)
    wood.finish("Green cambium",WOOD,stem)
    specs=[((-.11,.05,.82),(-.99,-.14,.18),.23,0,19),
           ((-.10,.06,.97),(.86,-.34,.30),.26,1,21),
           ((-.02,.05,1.32),(-.61,.25,.51),.242,4,24),
           ((.02,.07,1.43),(.92,.08,.40),.24,3,27),
           ((.12,.07,1.68),(-.64,-.18,.44),.245,2,30),
           ((.12,.07,1.82),(.42,-.08,.44),.25,5,34),
           ((.105,.07,1.9),(-.16,.14,.41),.19,6,37)]
    for i,(origin,delta,width,ci,start) in enumerate(specs):
        v=V(delta); b=Mesh(); tip=v*.13
        tube(b,[(0,0,0),tip*.5,tip],[.022,.018,.009],linear("83984c"),7,2)
        blade(b,tip,v*.87,width,GREEN[ci],(.12,-.93,.66+R.random()*.4),True,True)
        obj=b.finish("Unfurling lobed blade %s"%i,LEAF,stem,origin)
        start = start if not adult else 13+(start-19)*.47
        end=start+(16 if not adult else 8)
        grow(obj,start,end,.045)
        for t,ang in ((start,-.58),(end-4,.052),(end,0)):
            key(obj,"rotation_euler",t,(ang,-ang*(.40 if v.x>0 else -.40),ang*.16))
    if adult:
        for f,s in ((26,scale),(39,scale*.44),(47,scale*.29),(55,.0001)):
            key(unit,"scale",f,(s,)*3)
        # The original terminal shoot rides the elongating leader. Its early
        # leaves are gradually overtaken by the permanent branches.
        top=V((.45,.14,3.25) if lev==2 else (.28,.15,3.50))
        b=22 if lev==2 else 23
        for f,xy,zz in ((b,0,0),(b+6,.115,.225),(b+17,.96,1.016),(b+23,1,1)):
            key(unit,"location",f,(top.x*xy,top.y*xy,top.z*zz))


HEART = linear("826d54")
OLD = linear("8b7356")
TIP = linear("917348")
CROWN = [linear(h) for h in ("145943","246d46","337e42","529146","799e43",
                             "97ae47","adbb51","d0bf5d")]
def fruit(parent, loc, size, fall=None):
    unit=pivot("Suspended mast" if not fall else "Released acorn",parent,loc)
    m=Mesh()
    lathe(m,KERNEL,linear(R.choice(("c68234","d69541","bc7938"))),count=20)
    cup(m,False)
    obj=m.finish("Russet acorn",NUT,unit);obj.scale=(size,)*3
    tilt=R.uniform(-.23,.23)
    unit.rotation_euler=(.06,tilt,-.16)
    if fall:
        start,ground,dx=fall
        # Analytic free fall and two diminishing ballistic rebounds. Preserve the
        # pivot near the centre of mass; final support height follows the tilt.
        x,y,z=loc
        for j in range(22):
            if j<=8:
                u=j/8; zz=z+(ground-z)*u*u; advance=.36*u; a=tilt+.37*u*u
            elif j<=15:
                u=(j-8)/7; zz=ground+.63*4*u*(1-u); advance=.36+.42*u; a=tilt+.37+.68*u
            elif j<=19:
                u=(j-15)/4; zz=ground+.16*4*u*(1-u); advance=.78+.18*u; a=tilt+1.05+.25*u
            else:
                u=(j-19)/2; zz=ground; advance=.96+.04*u; a=tilt+1.3+.075*u
            key(unit,"location",start+j,(x+dx*advance,y,zz))
            key(unit,"rotation_euler",start+j,(.06,a,-.16))
    return unit


def woodgrain(m,points,radii,old):
    """Broken ribbons of cork follow the flutes instead of a painted tube."""
    pts=spline(list(map(V,points)),7)
    def surface(q,angle):
        n=min(len(pts)-2,int(q*(len(pts)-1))); f=q*(len(pts)-1)-n
        p=pts[n].lerp(pts[n+1],f)
        d=(pts[n+1]-pts[n]).normalized()
        u=d.cross(V((0,1,0))).normalized(); w=d.cross(u)
        a=min(len(radii)-2,int(q*(len(radii)-1))); frac=q*(len(radii)-1)-a
        rad=radii[a]*(1-frac)+radii[a+1]*frac
        ridge = .078*cos(5*angle+sin(q*7))+.055*sin(3*angle+q*2)+.038*cos(8*angle-q*5)
        th=angle+.071*sin(q*5)+.12*q
        return p+rad*(1+ridge+.024)*(u*cos(th)+w*sin(th))
    for j in range(40 if old else 16):
        q0=R.uniform(.015,.82); q1=min(.987,q0+R.uniform(.10,.43))
        a=R.uniform(0,TAU); width=R.uniform(.022,.079); drift=R.uniform(-.38,.38)
        c=linear(R.choice(("513f34","a17b57","9b7756","604737","957152","665142")))
        prev=None
        for k in range(10):
            t=k/9; q=q0+(q1-q0)*t
            th=a+drift*t+.075*sin(t*pi*2+a)
            ww=width*(.035+.965*sin(t*pi)**.67)
            pair=[m.point(surface(q,th-ww)),m.point(surface(q,th+ww))]
            if prev: m.face((prev[0],pair[0],pair[1],prev[1]),c,True)
            prev=pair


def knot(m,center,width,height,lean):
    center=V(center)
    # Raised callus curling round a dark, offset heart.
    col=[linear(c) for c in ("493b32","5e4534","ad835b","805f47")]
    rings=[]
    for k,(sz,relief) in enumerate(((.04,.008),(.57,.022),(.73,.048),(1,.008))):
        ring=[]
        for i in range(31):
            a=TAU*i/30
            z=sin(a)*height*sz; x=cos(a)*width*sz*(.84+.16*cos(2*a)) + z*lean
            ring.append(m.point(center+V((x,-relief+.34*x*x/width,z))))
        if rings:
            for i in range(30):
                m.face((rings[-1][i],ring[i],ring[i+1],rings[-1][i+1]),col[k],True)
        else:m.face(ring,col[0])
        rings.append(ring)


def bough(parent,points,radii,color,birth,full,old=True):
    base=V(points[0]); path=[V(p)-base for p in points]
    m=Mesh(); tube(m,path,radii,color,18 if old else 12,5,bark=1 if old else .47)
    if old and radii[0]>.18: woodgrain(m,path,radii,False)
    obj=m.finish("Crooked scaffold limb",CORK if old else WOOD,parent,base)
    grow(obj,birth,full,.014)
    return obj


def spray(parent, origin, dims, birth, full, young=False, sunny=0):
    """A shell of small radial leaf sprays. All stalks terminate in real blades;
    empty space between neighbouring fans lets the branch structure show through."""
    m=Mesh(); tw=Mesh(); a,b,h=dims
    centers=[]
    if young:
        for j in range(5):
            phi=(j+.18*R.random())*TAU/5
            centers.append(V((a*.68*cos(phi), b*.67*sin(phi), h*R.uniform(.12,.72))))
        centers.append(V((a*.09,b*.06,h*.92)))
    else:
        # Stagger the tufts; avoid a repeating spherical topiary silhouette.
        for j in range(11):
            phi=(j+R.uniform(-.26,.26))*TAU/11
            centers.append(V((a*cos(phi)*R.uniform(.7,1),b*sin(phi)*R.uniform(.74,1),
                              h*R.uniform(-.10,.37))))
        for j in range(8):
            phi=(j+R.uniform(-.22,.22))*TAU/8+.21
            centers.append(V((a*.59*cos(phi),b*.62*sin(phi),h*R.uniform(.48,.9))))
        centers.extend((V((0,.03,h)),V((a*.15,-b*.18,h*.76))))
    for n,ct in enumerate(centers):
        toward=V((ct.x,ct.y,0)); toward.normalize()
        if toward.length_squared==0: toward=V((1,0,0))
        bend=ct*.53 + V((0,0,.05))
        tube(tw,[(0,0,-h*.19),bend,ct],[.028 if young else .041,.020,.009],TIP,6,2)
        count=5 if young else R.randint(8,11)
        offset=R.uniform(-.32,.32)
        base=R.uniform(.37,.54) if young else R.uniform(.36,.55)
        which=(1.5 if young else .4)+sunny+.89*ct.z/h + R.uniform(-1.0,1.5)
        for i in range(count):
            ang=TAU*i/count+offset+R.uniform(-.18,.18)
            lateral=V((cos(ang),sin(ang),0))
            axis=lateral*.90 + toward*.30 + Z*R.uniform(-.48,.78)
            axis.normalize()
            length=base*R.uniform(.72,1.2)
            idx=max(0,min(7,round(which+R.uniform(-1.4,1.4))))
            color=tint(CROWN[idx],R.uniform(.91,1.08))
            start=ct + axis*(length*.08) + Z*(i/count*.054)
            blade(m,start,axis*length,R.uniform(.208,.276),color,
                  (R.uniform(-.4,.4),R.uniform(-1.0,-.45),R.uniform(.5,1.2)),young or i%4==0)
    unit=pivot("Terminal fan of oak foliage",parent,origin)
    tw.finish("Leaf bearing twigs",WOOD,unit);m.finish("Lobed leaf sprays",LEAF,unit)
    grow(unit,birth,full,.048)
    sign=1 if origin[0]>=0 else -1
    for t,angle in ((birth,.35*sign),(full-3,-.055*sign),(full,0)):
        key(unit,"rotation_euler",t,(angle*.17,angle,0))
    return unit


def tree(young):
    root=pivot("Heart of the oak / rooted pivot")
    b=22 if young else 23
    for f,xy,zz in ((b,.0001,.0001),(b+6,.115,.225),(b+17,.96,1.016),(b+23,1,1)):
        key(root,"scale",f,(xy,xy,zz))
    m=Mesh()
    if young:
        path=[(0,0,.01),(.05,.03,.34),(-.14,.06,1.02),(-.08,.10,1.46),
              (.19,.09,1.96),(.18,.06,2.42),(.37,.10,2.78),(.45,.14,3.32)]
        radii=[.29,.193,.135,.125,.107,.083,.063,.032]
    else:
        path=[(0,0,.035),(.04,.025,.38),(-.095,.08,.92),(-.16,.06,1.42),
              (.02,.08,1.95),(.24,.12,2.32),(.14,.15,2.75),(.31,.14,3.15),(.28,.15,3.57)]
        radii=[.80,.565,.48,.478,.375,.31,.24,.185,.095]
    tube(m,path,radii,HEART if not young else OLD,32,8,bark=1)
    woodgrain(m,path,radii,not young)
    for j in range(8 if not young else 6):
        a=j*TAU/(8 if not young else 6)+.20+R.uniform(-.15,.15)
        u=V((cos(a),sin(a),0)); w=V((-u.y,u.x,0)); size=1 if not young else .50
        reach=R.uniform(1.07,1.57); curve=R.uniform(-.31,.33)
        pts=[u*(.03 if young else .10)+Z*.88, u*.35+Z*.45, u*.60+w*curve*.6+Z*.20,
             u*(reach*.73)+w*curve+Z*.10, u*reach+w*curve*.70+Z*.048]
        pts=[p*size for p in pts]
        tube(m,pts,[size*r for r in (.18 if young else .297,.265,.172,.083,.009)],OLD,14,5,bark=1)
        p=pts[2]
        tube(m,[p,pts[3]+w*.14*size,(u*(reach+.03)+w*(curve+.37)+Z*.035)*size],
             [.107*size,.047*size,.008*size],HEART,9,4,bark=.6)
    if not young:
        knot(m,(-.169,-.402,1.38),.135,.253,.27)
        knot(m,(.096,-.293,1.94),.069,.137,.44)
    m.finish("Root flare, fissured bark and old pruning eye",WOOD if young else CORK,root)
    if not young:
        # A short broken spur carries two surviving leaves and a pair of fruit
        # below the west bough, readable in the opening between trunk and crown.
        spur=bough(root,[(-1.23,-.08,2.33),(-1.50,-.35,2.47),(-1.44,-.55,2.73),
                         (-1.64,-.66,2.90)],[.092,.064,.038,.012],HEART,34,49)
        ss=Mesh();orig=V((-.41,-.58,.57))
        blade(ss,(0,0,0),(-.35,-.10,.16),.23,linear("619546"),(.1,-1,.6))
        blade(ss,(0,0,0),(.26,-.05,.29),.27,linear("899f47"),(.1,-1,.6))
        leaf=ss.finish("Two leaves in the west fork",LEAF,spur,orig);grow(leaf,43,54)
        for j in range(2):
            offset=V((.08*j,.02,-.18-.12*j));st=Mesh()
            tube(st,[orig,orig+offset*.45,orig+offset],[.012,.010,.008],TIP,6,2)
            st.finish("Mast peduncle",WOOD,spur)
            ac=fruit(spur,orig+offset-Z*.083,.170-j*.024);grow(ac,49,60)
    if young:
        # Each entry is a continuous limb from a real junction, with one or more offshoots.
        branches=[
        ([(-.11,.07,1.1),(-.58,.07,1.41),(-.99,-.06,1.54),(-1.31,-.11,1.91)],[.113,.082,.057,.031],[
            ((-.88,.01,1.52),(-1.39,.08,1.57),(-1.68,.12,1.76)),]),
        ([(.03,.09,1.7),(.45,-.10,1.79),(.91,-.13,2.12),(1.35,-.06,2.22)],[.112,.087,.055,.029],[
            ((.89,-.12,2.10),(.95,.01,2.37),(1.08,.06,2.52)),]),
        ([(.16,.07,2.15),(-.14,.11,2.44),(-.48,.23,2.61),(-.80,.19,2.94)],[.091,.076,.055,.026],[
            ((-.44,.22,2.6),(-.81,.40,2.67),(-1.07,.44,2.70)),]),
        ([(.27,.09,2.63),(.58,.13,2.8),(.76,.28,3.13)],[.068,.052,.028],[]),
        ([(.38,.10,2.8),(.24,.02,3.20),(.38,-.06,3.56)],[.057,.041,.024],[])]
    else:
        branches=[
        ([(-.14,.07,1.39),(-.59,-.04,1.83),(-1.03,-.05,2.26),(-1.55,-.10,2.37),(-2.01,-.13,2.56),(-2.37,-.12,3.02),(-2.82,-.10,3.20)],
         [.344,.298,.234,.190,.154,.094,.046],[
         ((-1.49,-.1,2.37),(-1.66,.16,2.92),(-2.05,.26,3.38)),
         ((-2.0,-.13,2.56),(-2.67,-.24,2.69),(-3.25,-.31,2.94))]),
        ([(.00,.08,1.92),(.55,-.05,2.03),(1.04,-.18,2.42),(1.43,-.18,2.78),(1.99,-.24,2.76),(2.42,-.18,3.13),(2.82,-.14,3.24)],
         [.342,.29,.236,.192,.145,.093,.044],[
         ((1.40,-.18,2.76),(1.45,-.46,3.14),(1.68,-.59,3.48)),
         ((1.98,-.22,2.78),(2.16,.23,3.41),(2.45,.30,3.70)),
         ((1.08,-.18,2.47),(1.50,-.82,2.52),(1.88,-.97,2.78))]),
        ([(.20,.14,2.48),(-.21,.19,2.86),(-.65,.26,3.28),(-.85,.29,3.74),(-1.24,.23,4.00),(-1.57,.14,4.33)],
         [.24,.195,.155,.132,.084,.041],[
         ((-.64,.26,3.26),(-1.16,.39,3.39),(-1.59,.49,3.77)),
         ((-1.20,.23,3.98),(-1.78,.20,4.00),(-2.10,.19,4.14))]),
        ([(.26,.14,3.03),(.64,.31,3.39),(.83,.39,3.85),(1.29,.45,4.04),(1.59,.45,4.30)],
         [.189,.164,.118,.075,.037],[
         ((.81,.39,3.83),(.68,.48,4.29),(.87,.46,4.54))]),
        ([(.28,.15,3.48),(.05,.16,3.84),(.02,.05,4.37),(-.38,-.02,4.83)],
         [.147,.118,.079,.038],[
         ((.07,.12,3.91),(-.34,-.11,4.08),(-.58,-.22,4.36))]),
        ([(-.13,.18,1.66),(.19,.61,2.17),(.47,1.04,2.75),(.37,1.17,3.28)],
         [.235,.184,.12,.062],[
         ((.46,1.0,2.68),(-.06,1.16,2.93),(-.47,1.23,3.28))])]
    for i,(pts,rs,subs) in enumerate(branches):
        start=(30+.9*i) if young else (28+1.18*i)
        finish=start+(15 if young else 16)
        branch=bough(root,pts,rs,OLD if i%3 else HEART,start,finish,not young)
        if not young and i<3:
            # A small shiver precedes the release, strongest near the leafy tips.
            for fr,ry in ((53,0),(56,-.024),(59,.023),(62,-.009),(66,0)):
                key(branch,"rotation_euler",fr,(ry*.31,ry*(1 if i%2 else -1),0))
        base=V(pts[0]);end=V(pts[-1])
        def foliage(parent,at,z,small=False):
            dims=(.32,.29,.30) if young else (.72,.55,.62)
            dims=tuple(v*(.91 if small else 1.07)*R.uniform(.88,1.12) for v in dims)
            f=start+9+R.uniform(0,3)
            spray(parent,at,dims,f, min(65 if young else 61,f+15),young,(z-2.5)*1.30)
        foliage(branch,end-base,end.z)
        for sub in subs:
            local=[V(p)-base for p in sub]
            rad=(.061 if young else .118)
            twig=bough(branch,local,[rad,rad*.61,rad*.23],OLD,start+5,finish+4,not young)
            tip=V(sub[-1])
            foliage(twig,tip-V(sub[0]),tip.z,True)
        if not young and i in (0,1,2,4):
            # Nuts hang below the terminal fans on woody peduncles.
            for j in range(2 if i<2 else 1):
                anchor=end-base + V(((-.28,.18)[j],-.23,j*.06))
                drop=.42 if i<2 else .34
                m=Mesh(); tube(m,[end-base,anchor,anchor-Z*(drop-.075)],
                               [.027,.018,.012],TIP,7,3);m.finish("Pendant oak stalk",WOOD,branch)
                nut=fruit(branch,anchor-Z*drop,.18 if i<2 else .16)
                grow(nut,48+i,59+i,.04)
        if young and i==0:
            # One folded terminal bud at a bare junction.
            m=Mesh(); tube(m,[V(pts[2])-base,V(pts[2])-base+V((.03,-.02,.15))],
                           [.043,.002],linear("b68b54"),9,3);m.finish("Axillary bud",WOOD,branch)
    if not young:
        # Foreground fruit is a little larger for legibility over the dark wood.
        for i,(x,y,z,s,frame,dx) in enumerate(((-2.33,-.57,2.84,.245,60,-.77),
                     (1.97,-.63,2.97,.255,64,.94),(-1.30,-.35,3.45,.197,62,.60))):
            unit=fruit(root,V((x,y,z)),s,(frame,s*.42,dx))
            grow(unit,49+i,58+i,.026)


def stage():
    sc={1:.60,2:.65,3:.77}[lev]
    seed(sc,43)
    seedling({1:1,2:.62,3:.76}[lev],lev>1)
    if lev>1: tree(lev==2)
    width={1:3.82,2:6.66,3:9.45}[lev]
    target=V((-.04 if lev==3 else 0,.0,{1:1.14,2:2.00,3:2.68}[lev]))
    camera=bpy.data.cameras.new("Orthographic portrait"); ob=bpy.data.objects.new("Fixed camera",camera)
    scene.collection.objects.link(ob);ob.location=target+V((.13,-14,3))
    ob.rotation_euler=(target-ob.location).to_track_quat("-Z","Y").to_euler()
    camera.type="ORTHO";camera.ortho_scale=width;scene.camera=ob
    def light(name,where,power,size,c):
        data=bpy.data.lights.new(name,"AREA");data.energy=power;data.shape="DISK";data.size=size;data.color=c
        o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.location=where
        o.rotation_euler=(V((0,0,2))-o.location).to_track_quat("-Z","Y").to_euler()
    light("Afternoon sun / warm upper left",(-4.5,-4.6,9),570,5,(1,.89,.71))
    light("Sky fill",(4,-3,5.5),260,5,(.77,.90,1))
    light("Leaf edge / skylight",(-1,3.4,7.8),570,4,(1,.94,.70))
    world=bpy.data.worlds.new("Open shade"); scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.62,.74,.82,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.48
    scene.render.engine="CYCLES"; scene.cycles.device="CPU"; scene.cycles.samples=9
    scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
    scene.render.threads_mode="FIXED";scene.render.threads=5
    scene.render.film_transparent=True
    scene.render.resolution_x=480;scene.render.resolution_y=360;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="8";scene.render.image_settings.compression=20
    scene.render.fps=24;scene.frame_start=1;scene.frame_end=COUNTS[lev]
    scene.view_settings.view_transform="AgX"
    scene.render.use_persistent_data=True


stage()
if action=="proof":
    for frame in map(int,extra or [LAST[lev]]):
        scene.frame_set(frame);scene.render.filepath=str(folder/f"oak-proof-{frame:03}.png")
        bpy.ops.render.render(write_still=True)
elif action=="render":
    first,last=map(int,extra) if extra else (1,COUNTS[lev])
    for frame in range(first,last+1):
        filename=folder/f"{frame:03}.png"
        source=folder/f"{1 if frame<5 else LAST[lev]:03}.png"
        if 1<frame<5 or frame>LAST[lev]:
            shutil.copyfile(source,filename)
        else:
            scene.frame_set(frame);scene.render.filepath=str(filename)
            bpy.ops.render.render(write_still=True)
else: raise ValueError(action)

