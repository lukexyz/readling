"""Original Word Woods elephant march. All distances are in adult model units.

blender -b -t 4 --python-exit-code 1 -P studies/woodland/elephants.py -- 2 proof
blender -b -t 4 --python-exit-code 1 -P studies/woodland/elephants.py -- 2 render
python studies/woodland/pack.py elephants 2 73
python studies/woodland/elephants.py 2 audit
"""
import json
import math
import shutil
import sys
from bisect import bisect_right
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COUNTS = (72, 80, 88)
POSTERS = (66, 73, 81)
PROOFS = ((1, 18, 37, 66), (1, 23, 43, 73), (1, 26, 51, 81))
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
level, mode, *requested = args
level = int(level)
count = COUNTS[level-1]
poster = POSTERS[level-1]
folder = ROOT / "assets/videos/woodland" / f"elephants-{level}"
folder.mkdir(parents=True, exist_ok=True)
def audit():
    """Inspect the shipped sprites, project their hat axes on key poses and
    report per-shot byte counts. The contact sheet is proof art only."""
    from PIL import Image, ImageChops, ImageDraw
    target=ROOT/"dist/assets/woodland"
    stem=f"elephants-{level}"
    manifest=target/f"{stem}.json"
    data=json.loads(manifest.read_text())
    track=json.loads((folder/"anchors.json").read_text())
    assert data["anchors"]==track and len(track)==len(data["frames"])==count
    assert data["poster"]==poster
    assert all(row==data["frames"][poster-1] for row in data["frames"][poster-1:])
    pages=[Image.open(target/name).convert("RGBA") for name in data["sheets"]]
    margins=[]
    board=Image.new("RGB",(720,580),"#f1ebdf")
    draw=ImageDraw.Draw(board)
    poses=(1,round(count*.20),round(count*.35),round(count*.53),round(count*.72),poster)
    for i,rect in enumerate(data["frames"],1):
        sheet,x,y,w,h,dx,dy=rect
        sprite=pages[sheet].crop((x,y,x+w,y+h))
        with Image.open(folder/f"{i:03}.png") as original:
            assert original.mode=="RGBA" and original.size==(480,360)
            alpha=original.getchannel("A")
            assert alpha.getextrema()==(0,255)
            assert alpha.getbbox()==(dx,dy,dx+w,dy+h)
            assert not ImageChops.difference(alpha.crop(alpha.getbbox()),sprite.getchannel("A")).getbbox()
            margins.append(min(dx,dy,480-dx-w,360-dy-h))
            assert margins[-1]>=3,(level,i,margins[-1])
            assert len(track[i-1])==level
            for ax,ay,a,s in track[i-1]:
                cx,cy=round(ax),round(ay)
                assert 0<s<140 and abs(a)<.6 and 3<cx<477 and 3<cy<357
                assert alpha.crop((cx-2,cy-2,cx+3,cy+6)).getextrema()[1]>100,(i,cx,cy)
        if i in poses:
            j=poses.index(i);col=j%2;row=j//2
            proof=Image.new("RGBA",(480,360),"#f1ebdf" if (col+row)%2==0 else "#2a3946")
            proof.alpha_composite(sprite,(dx,dy))
            marks=ImageDraw.Draw(proof)
            for ax,ay,a,s in track[i-1]:
                direction=(math.cos(a)*s*.19,math.sin(a)*s*.19)
                marks.line((ax-direction[0],ay-direction[1],ax+direction[0],ay+direction[1]),fill="#f29b31",width=2)
                marks.ellipse((ax-2,ay-2,ax+2,ay+2),fill="#ffffff")
            # Proofs are deliberately smaller than the game canvas to check
            # the silhouettes, eye, tusks, and textile motifs at tablet scale.
            img=proof.resize((248,186),Image.Resampling.LANCZOS)
            board.paste(img,(col*360+57,row*193))
            draw.text((col*360+9,row*193+8),f"{i:02}f",fill="#524737")
    poster_file=target/f"{stem}-poster.webp"
    with Image.open(poster_file) as still, Image.open(folder/f"{poster:03}.png") as original:
        assert still.size==(480,360) and still.mode=="RGBA"
        assert not ImageChops.difference(still.getchannel("A"),original.getchannel("A")).getbbox()
    board.save(folder/"contact-and-hat-positions.jpg",quality=94)
    files=[target/name for name in data["sheets"]]+[manifest,poster_file]
    print(stem,count,"frames;",len(pages),"sheets;",sum(f.stat().st_size for f in files),
          "packed bytes;",poster_file.stat().st_size,"poster bytes;",min(margins),"px minimum margin")


if mode=="audit":
    audit()
    raise SystemExit


import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
V = Vector
sin, cos, pi = math.sin, math.cos, math.pi
TAU = math.tau


def ease(x):
    t = max(0, min(1, x))
    return t*t*(3-2*t)


def lerp(a, b, t):
    return a+(b-a)*t


def color(code):
    channels = [int(code[i:i+2], 16)/255 for i in (0, 2, 4)]
    return tuple(s / 12.92 if s < .04045 else ((s+.055)/1.055)**2.4 for s in channels)


def material(name, code, rough=.62, grain=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    tree = mat.node_tree
    shader = tree.nodes.get("Principled BSDF")
    tint = color(code)
    shader.inputs["Base Color"].default_value = (*tint, 1)
    shader.inputs["Roughness"].default_value = rough
    shader.inputs["Specular IOR Level"].default_value = .29
    if grain:
        noise = tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 9
        noise.inputs["Detail"].default_value = 2
        ramp = tree.nodes.new("ShaderNodeValToRGB")
        for stop, scale in zip(ramp.color_ramp.elements, (.79, 1.15)):
            stop.color = (*[min(1, c*scale) for c in tint], 1)
        tree.links.new(noise.outputs["Fac"], ramp.inputs[0])
        tree.links.new(ramp.outputs[0], shader.inputs["Base Color"])
        bump = tree.nodes.new("ShaderNodeBump")
        bump.inputs["Distance"].default_value = .009
        bump.inputs["Strength"].default_value = .12
        tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        tree.links.new(bump.outputs[0], shader.inputs["Normal"])
    return mat


class Palette:
    def __init__(self, colors):
        self.hide, self.light, self.fold, self.ear, self.fabric, self.binding = [
            material(code, code, grain=i in (0,1,3,4)) for i,code in enumerate(colors)]


SLATE = Palette(("7488a0","91a2b4","576a84","b58d96","254e62","e49a51"))
PERIWINKLE = Palette(("8a92b3","a5aac6","697494","c09ba8","ad5449","e9aa61"))
TEAL = Palette(("779a9c","96afb0","537c80","b797a1","47746c","e8ac60"))
IVORY = material("Warm ivory", "e8d4af", .43)
NAIL = material("Horn nails", "beb3a7", .49)
IRIS = material("Ochre iris", "a57543", .28)
EYE = material("Ink brown", "29252c", .20)
GLINT = material("Cream catchlight", "fff3d6", .30)
TUFT = material("Tail brush", "474252")
GOLD = material("Golden thread", "f3c76d")
THREAD = material("Unbleached thread", "f8dfae")


def empty(name, parent=None):
    ob = bpy.data.objects.new(name, None)
    scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


def mesh(name, vertices, faces, mats, parent, indices=None, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    for mat in mats:
        data.materials.append(mat)
    if indices is not None:
        data.polygons.foreach_set("material_index", indices)
    data.polygons.foreach_set("use_smooth", [smooth]*len(faces))
    ob = bpy.data.objects.new(name, data)
    scene.collection.objects.link(ob)
    ob.parent = parent
    return ob


def oval(name, pos, scale, mat, parent, rot=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=14)
    ob = bpy.context.object
    ob.name = name
    ob.parent = parent
    ob.location, ob.scale, ob.rotation_euler = pos, scale, rot
    ob.data.materials.append(mat)
    for face in ob.data.polygons:
        face.use_smooth = True
    return ob


def strip_faces(rows, sides, caps=True):
    faces = [(j*sides+k, j*sides+(k+1)%sides, (j+1)*sides+(k+1)%sides, (j+1)*sides+k)
             for j in range(rows-1) for k in range(sides)]
    if caps:
        faces.extend([tuple(reversed(range(sides))), tuple(range((rows-1)*sides, rows*sides))])
    return faces


def smooth_path(points, subdivisions=3):
    pts = list(map(V,points))
    out = []
    for i in range(len(pts)-1):
        a,b,c,d = [pts[min(len(pts)-1,max(0,i+k))] for k in (-1,0,1,2)]
        for k in range(subdivisions):
            t=k/subdivisions
            out.append(.5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
    return out+[pts[-1]]


def sweep_geometry(points, widths, sides, flatten=1):
    verts, normals = [], []
    for i,p in enumerate(points):
        tangent=(points[min(len(points)-1,i+1)]-points[max(0,i-1)]).normalized()
        if i == 0:
            ref=V((0,1,0)) if abs(tangent.y)<.88 else V((0,0,1))
            across=(ref-tangent*ref.dot(tangent)).normalized()
        else:
            across=(across-tangent*across.dot(tangent)).normalized()
        high=tangent.cross(across)
        normals.append((tangent,across,high))
        for j in range(sides):
            a=TAU*j/sides
            verts.append(p+widths[i]*(across*cos(a)+high*sin(a)*flatten))
    return verts,normals


def stroke(name, points, radii, mat, parent, sides=10):
    path=smooth_path(points)
    widths=[lerp(radii[min(i//3,len(radii)-2)],radii[min(i//3+1,len(radii)-1)],i%3/3)
            for i in range(len(path)-1)]+[radii[-1]]
    verts,_=sweep_geometry(path,widths,sides)
    return mesh(name,verts,strip_faces(len(path),sides),[mat],parent)


# Section centres, transverse radius and vertical radius define the sloped
# hindquarters, soft belly, small saddle hollow and tall shoulder.
SECTIONS=[(-1.36,1.51,.02,.03),(-1.27,1.54,.35,.43),(-1.06,1.56,.53,.66),
          (-.74,1.58,.65,.81),(-.39,1.57,.70,.85),(-.05,1.55,.71,.83),
          (.28,1.58,.67,.87),(.56,1.61,.56,.85),(.78,1.66,.43,.68),
          (.90,1.73,.28,.44),(.98,1.77,.02,.03)]
PROFILE=smooth_path(SECTIONS,5)
XS=[p.x for p in PROFILE]


def back(x):
    i=max(0,min(len(XS)-2,bisect_right(XS,x)-1))
    return PROFILE[i].lerp(PROFILE[i+1],(x-XS[i])/(XS[i+1]-XS[i]))


def blanket(body, palette, pattern):
    # The woven panel follows the actual hide around the spine on both sides.
    def surface(u,t,off=.017):
        x=-1.02+u*1.20
        _,z,ry,rz=back(x)
        angle=t*(1.43+.065*cos(pi*(u-.5))-.09*abs(2*u-1)**3)
        return V((x,(ry+off)*sin(angle),z+(rz+off)*cos(angle)))
    us=[0,.042]+[.09+j*.82/12 for j in range(13)]+[.958,1]
    ts=[-1,-.97,-.91,-.87,-.83,-.77,-.58,-.32,0,.32,.58,.77,.83,.87,.91,.97,1]
    verts=[surface(u,t) for u in us for t in ts]
    faces,indices=[],[]
    for i in range(len(us)-1):
        for j in range(len(ts)-1):
            k=i*len(ts)+j
            faces.append((k,k+1,k+len(ts)+1,k+len(ts)))
            t=abs((ts[j]+ts[j+1])*.5)
            indices.append(1 if i in (0,len(us)-2) or t>.91 else 2 if .83<t<.87 else 0)
    mesh("Handwoven wool panel",verts,faces,[palette.fabric,palette.binding,GOLD],body,indices)
    for side in (-1,1):
        def patch(name, outline, mat):
            coords=[surface(u,t*side,.030) for u,t in outline]
            uc=sum(u for u,t in outline)/len(outline)
            tc=sum(t for u,t in outline)/len(outline)
            coords.append(surface(uc,tc*side,.034))
            mesh(name,coords,[(len(outline),i,(i+1)%len(outline)) for i in range(len(outline))],
                 [mat],body)
        if pattern=="sun":
            def disk(rad):
                return [(.5+rad*cos(TAU*j/32),.56+rad*sin(TAU*j/32)) for j in range(32)]
            patch("Wheel of sunlight",disk(.107),GOLD)
            for i in range(12):
                a=TAU*i/12
                patch("Sunbeam",[(.5+r*cos(a+da),.56+r*sin(a+da)) for r,da in
                                 ((.13,-.12),(.20,0),(.13,.12))],THREAD)
        else:
            # A botanical sprig in three broad embroidered stitches.
            def leaf(u,t,dx,dy,wide,mat):
                patch("Embroidered leaf",[(u,t),(u+dx*.38-dy*wide,t+dy*.38+dx*wide),
                      (u+dx*.75-dy*wide*.7,t+dy*.75+dx*wide*.7),(u+dx,t+dy),
                      (u+dx*.55+dy*wide,t+dy*.55-dx*wide)],mat)
            leaf(.50,.73,-.19,-.20,.28,THREAD)
            leaf(.50,.72,.21,-.24,.26,GOLD)
            leaf(.50,.67,.01,-.27,.31,THREAD)
        for u in (.10,.23,.36,.49,.62,.75,.88):
            patch("Running stitch",[(u,.897),(u+.025,.89),(u+.042,.901),(u+.018,.907)],THREAD)


EAR = [( .09,.27),(-.06,.43),(-.32,.48),(-.53,.42),(-.68,.27),(-.71,.09),
       (-.65,-.08),(-.56,-.26),(-.41,-.43),(-.31,-.50),(-.21,-.47),
       (-.13,-.32),(-.08,-.24),(.025,-.17),(.12,.015),(.14,.16)]


def pinna(head,pal,side):
    hinge=empty("Mobile ear hinge",head)
    hinge.location=(-.02,side*.382,.06)
    smooth=smooth_path(EAR[-1:]+EAR+EAR[:2],3)[3:-4]
    verts=[];faces=[];indices=[]
    rings=[(.013,.055),(.71,.11),(.89,.148),(1,.145),(.975,.085),(.75,.022),(.01,.015)]
    for r,d in rings:
        for p in smooth:
            x=-.235+(p.x+.235)*r
            z=(p.y+.015)*r-.015
            flare=(-x)*.38+.052*cos(z*5)+d
            verts.append((x,side*flare,z))
    n=len(smooth)
    for j in range(len(rings)-1):
        for k in range(n):
            faces.append((j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k))
            indices.append(0 if j in (1,2) else 1 if j==0 else 2)
    mesh("Folded fan ear",verts,faces,[pal.light,pal.ear,pal.hide],hinge,indices)
    def fold(x,z,d=.11):
        return (x,side*((-x)*.38+.052*cos(z*5)+d),z)
    for path in [[(.03,.17),(-.15,.29),(-.32,.31),(-.47,.24)],
                 [(.045,.09),(-.12,.08),(-.28,-.03),(-.38,-.18)]]:
        stroke("Auricular fold",[fold(x,z,.135) for x,z in path],[.002,.011,.008,.002],pal.light,hinge,8)
    return hinge


class Leg:
    """Four independent stance/swing cycles. In stance the toe stays at a fixed
    world point while the shoulder or hip travels over it."""
    rings=[(0,.19),(.10,.254),(.23,.245),(.40,.203),(.51,.184),
           (.64,.162),(.77,.146),(.86,.152),(.91,.177),(.97,.187),(1,.167)]
    sides=20
    def __init__(self,rig,pal,fore,side):
        self.fore=fore
        self.side=side
        self.hip=V((.52 if fore else -.79,side*(.371 if fore else .354),1.49))
        self.phase=(.20 if fore else .0)+(.50 if side>0 else .0)
        self.skin=mesh("Foreleg" if fore else "Hind leg",[(0,0,0)]*(len(self.rings)*self.sides),
                       strip_faces(len(self.rings),self.sides),[pal.hide],rig)
        self.foot=empty("Nails follow toe contact",rig)
        for angle in (-1.03,-.34,.36,1.03):
            nail=oval("Horn toenail",(.173*cos(angle),.154*sin(angle),.054),
                      (.029,.050,.052),NAIL,self.foot,(0,-.10,angle))
    def update(self,travel,stride,bob,rock,settle):
        p=(travel/stride+self.phase)%1
        duty=.63
        swing=max(0,(p-duty)/(1-duty))
        forward=stride*(duty/2-p+ease(swing))
        lift=.226*sin(pi*swing)**2*(1-settle)
        hip=self.hip+V((.012*rock,0,bob))
        toe=V((self.hip.x+forward+(.025 if self.fore else -.025),self.hip.y,lift+.016))
        self.foot.location=toe
        verts=[]
        for t,r in self.rings:
            center=hip.lerp(toe,t)
            center.x+=sin(pi*t)*(.04 if self.fore else .14)-sin(pi*t*2)*(.065 if self.fore else .092)
            center.x+=lift*sin(pi*t)*(-.46 if self.fore else .71)
            center.y+=self.side*.023*sin(pi*t)
            for j in range(self.sides):
                a=TAU*j/self.sides
                verts.append((center.x+r*cos(a),center.y+r*.92*sin(a),center.z))
        write_vertices(self.skin,verts)


def write_vertices(ob,verts):
    ob.data.vertices.foreach_set("co",[v for point in verts for v in point])
    ob.data.update()


class Trunk:
    sides=24
    segments=32
    def __init__(self,head,pal,calf):
        self.length=1.40 if calf else 1.67
        self.width=.212 if calf else .225
        self.ob=mesh("Articulated proboscis",[(0,0,0)]*((self.segments+1)*self.sides),
                     strip_faces(self.segments+1,self.sides),[pal.hide],head)
        self.ridges=[]
        for i in (5,8,11,14,18,22,25,28):
            ob=mesh("Partial trunk crease",[(0,0,0)]*22,[(2*k,2*k+1,2*k+3,2*k+2) for k in range(10)],
                    [pal.fold],head)
            self.ridges.append((i,ob))
        self.tip=empty("Prehensile tip",head)
        oval("Trunk lip",(0,0,0),(.095,.073,.035),pal.light,self.tip)
        for side in (-1,1):
            oval("Nostril",(side*.043,0,.027),(.024,.037,.009),EYE,self.tip)
    def update(self,salute,beat,phase):
        path=[V((.355,-.016,.16))]
        widths=[]
        for i in range(self.segments+1):
            t=i/self.segments
            widths.append(self.width*(1-t)**1.35+.080*t+.016*ease((t-.88)/.12))
            if i==self.segments: break
            low=-65-19*sin(pi*t)+148*ease((t-.50)/.50)
            high=-42+143*ease(t/.86)-14*ease((t-.85)/.15)
            angle=math.radians(lerp(low,high,salute)+8*beat*sin(pi*t)+6*sin(phase+3*t)*(1-salute))
            direction=V((cos(angle),-.085-.070*sin(pi*t),sin(angle))).normalized()
            path.append(path[-1]+direction*self.length/self.segments)
        verts,normals=sweep_geometry(path,widths,self.sides,.93)
        write_vertices(self.ob,verts)
        for i,ob in self.ridges:
            tangent,across,high=normals[i]
            fold=[]
            for j in range(11):
                a=pi+(j/10-.5)*2.45
                pos=path[i]+(widths[i]+.0015)*(across*cos(a)+.93*high*sin(a))
                thick=.0080*(.1+.9*sin(pi*j/10))
                fold.extend((pos-tangent*thick,pos+tangent*thick))
            write_vertices(ob,fold)
        direction=normals[-1][0]
        self.tip.location=path[-1]
        self.tip.rotation_euler=direction.to_track_quat("Z","Y").to_euler()


class Elephant:
    def __init__(self,name,pal,calf,scale,base,yaw,offset,pattern):
        self.pal,self.calf=pal,calf
        self.scale,self.base,self.yaw,self.offset=scale,V(base),math.radians(yaw),offset
        self.rig=empty(name)
        self.rig.scale=(scale,)*3
        self.rig.rotation_euler.z=self.yaw
        self.body=empty("Breathing body",self.rig)
        verts=[(p.x,p[2]*cos(TAU*j/40),p[1]+p[3]*sin(TAU*j/40)) for p in PROFILE for j in range(40)]
        mesh("High withers and rounded haunches",verts,strip_faces(len(PROFILE),40),[pal.hide],self.body)
        blanket(self.body,pal,pattern)
        self.legs=[Leg(self.rig,pal,fore,side) for side in (-1,1) for fore in (False,True)]
        self.head=empty("Head and brow",self.body)
        self.head.location=(.80,0,1.99 if calf else 2.02)
        self.head.scale=((1.11,)*3 if calf else (1,)*3)
        # Broad forehead tapering to the chin. The crown point used for hats
        # belongs to this surface and shares its animated parent.
        sections=[(-.49,.015,.02,-.04),(-.42,.274,.37,.02),(-.25,.435,.51,.032),
                  (-.04,.494,.573,.045),(.13,.482,.566,.054),(.29,.402,.49,.044),
                  (.415,.306,.39,.016),(.495,.20,.272,-.025),(.52,.012,.018,-.09)]
        verts=[];rings=smooth_path(sections,4)
        for x,ry,rz,cz in rings:
            for j in range(36):
                a=TAU*j/36
                verts.append((x,ry*cos(a),cz+rz*sin(a)))
        mesh("Domed forehead and cheek",verts,strip_faces(len(rings),36),[pal.hide],self.head)
        self.crown=V((.073,0,.625))
        self.forehead=[V(pt) for pt in verts if -.12<pt[0]<.25 and pt[2]>.48]
        self.ears=[pinna(self.head,pal,side) for side in (-1,1)]
        self.eyes=[]
        for side in (-1,1):
            eye=empty("Blink",self.head)
            eye.location=(.263,side*.397,.14)
            eye.rotation_euler.z=side*-.49
            self.eyes.append(eye)
            oval("Soft eye socket",(0,side*.011,0),(.119,.030,.089),pal.fold,eye)
            oval("Amber iris",(.013,side*.029,.003),(.093,.034,.071),IRIS,eye)
            oval("Pupil",(.028,side*.051,.005),(.060,.018,.060),EYE,eye)
            oval("Catchlight",(.046,side*.069,.032),(.022,.008,.020),GLINT,eye)
            stroke("Brow ridge",[(.159,side*.439,.244),(.235,side*.428,.273),(.330,side*.373,.251)],
                   [.006,.026,.007],pal.light,self.head)
            stroke("Line of the cheek",[(.21,side*.421,-.11),(.31,side*.352,-.17),(.393,side*.30,-.18)],
                   [.003,.012,.003],pal.fold,self.head,8)
            if not calf:
                stroke("Small sweeping ivory tusk",[(.30,side*.287,-.154),(.50,side*.32,-.26),
                       (.69,side*.345,-.277),(.845,side*.347,-.232),(.944,side*.339,-.145)],
                       [.102,.086,.061,.036,.004],IVORY,self.head,14)
        self.trunk=Trunk(self.head,pal,calf)
        self.tail=empty("Swinging tail",self.body)
        self.tail.location=(-1.24,-.17,1.74)
        stroke("Tail",[(0,0,0),(-.125,.022,-.22),(-.145,.056,-.48),(-.19,.095,-.71),
                       (-.247,.11,-.84)],[.07,.046,.035,.026,.023],pal.hide,self.tail)
        for j in range(3):
            stroke("Tail-tip bristles",[(-.22,.10,-.77),(-.266-j*.018,.11+j*.018,-.86),
                   (-.301-j*.032,.11+j*.016,-.96+j*.011)],[.026,.038,.004],TUFT,self.tail)

    def pose(self,frame):
        t=(frame-1)/(poster-1)
        march=ease((t-.025)/.82)
        stride=.82
        steps=(1.58 if level==1 else 1.70 if level==2 else 1.85)+(.14 if self.calf else 0)
        distance=stride*steps*march
        gait=distance/stride+self.offset
        phase=TAU*gait
        settle=ease((t-.79)/.20)
        bob=(.040*cos(phase*2+.36)+.013*sin(phase))*(1-settle)
        rock=sin(phase)*.9*(1-settle)
        forward=V((cos(self.yaw),sin(self.yaw),0))
        self.rig.location=self.base+forward*self.scale*(distance-stride*steps*.5)
        self.body.location=(0,.028*rock,bob)
        self.body.rotation_euler=(.017*rock,.014*cos(phase)*(1-settle),0)
        for leg in self.legs:
            leg.update(distance+self.offset*stride,stride,bob,rock,settle)
        # The first voice calls, the younger elephant answers. All finish with
        # the trunk aloft after the last stride.
        delay=self.offset*.52
        call=ease((t-.12-delay)/.19)*(1-ease((t-.40-delay)/.14))
        final=ease((t-.64-delay*.17)/.23)
        salute=min(1,.83*call+final)
        beat=sin(phase)*(1-settle)
        self.head.rotation_euler=(.027*beat,-.119*salute+.043*beat,.042*beat)
        self.trunk.update(salute,beat,phase)
        for side,ear in zip((-1,1),self.ears):
            ear.rotation_euler=(side*(.064*beat+.079*salute),-.045*beat,
                                -side*(.14*beat+.24*call+.09*final))
        blink=max(0,1-abs(frame-(18+round(12*self.offset)))/2.4)
        for eye in self.eyes: eye.scale.z=1-.88*blink
        self.tail.rotation_euler=(.15*beat,-.27*beat+.31*salute+.21,.095*beat)

    def anchor(self):
        def project(p):
            co=world_to_camera_view(scene,scene.camera,self.head.matrix_world@p)
            return V((co.x*480,(1-co.y)*360))
        center=min((project(p) for p in self.forehead),key=lambda p:p.y)
        across=project(self.crown+V((.465,0,0)))-project(self.crown-V((.465,0,0)))
        return [round(center.x,2),round(center.y,2),round(math.atan2(across.y,across.x),4),
                round(across.length,2)]


def setup():
    if level==1:
        specs=[("Little Stomper",PERIWINKLE,True,1,(0,0,0),-24,.05,"leaf")]
        width,target=5.63,V((.42,0,1.43))
    elif level==2:
        specs=[("Trumpeting adult",SLATE,False,1,(.93,.80,0),-23,.0,"sun"),
               ("Answering calf",PERIWINKLE,True,.65,(-1.48,-.94,0),-26,.45,"leaf")]
        width,target=7.20,V((.20,0,1.52))
    else:
        specs=[("Aunt in green",TEAL,False,.83,(-2.72,1.65,0),-25,.25,"leaf"),
               ("Lead matriarch",SLATE,False,1.12,(1.04,.85,0),-20,.0,"sun"),
               ("Little marcher",PERIWINKLE,True,.65,(-.94,-1.88,0),-28,.66,"leaf")]
        width,target=9.20,V((-.20,0,1.46))
    herd=[Elephant(*spec) for spec in specs]
    cam=bpy.data.cameras.new("Fixed orthographic stage")
    ob=bpy.data.objects.new(cam.name,cam)
    scene.collection.objects.link(ob)
    ob.location=target+V((0,-15,3.6 if level==1 else 5.6))
    ob.rotation_euler=(target-ob.location).to_track_quat("-Z","Y").to_euler()
    cam.type="ORTHO";cam.ortho_scale=width;scene.camera=ob
    def softbox(name,position,energy,size,rgb):
        light=bpy.data.lights.new(name,"AREA")
        light.energy=energy;light.size=size;light.shape="DISK";light.color=rgb
        o=bpy.data.objects.new(name,light);scene.collection.objects.link(o)
        o.location=position;o.rotation_euler=(V((0,0,1.5))-o.location).to_track_quat("-Z","Y").to_euler()
    softbox("Warm broad key",(-3.8,-5,8),660,5.0,(1,.87,.75))
    softbox("Open sky fill",(4,-3,5),360,4.2,(.77,.87,1))
    softbox("Sunny rim",(-2,4,7),830,3.5,(1,.89,.76))
    world=bpy.data.worlds.new("Soft sky");scene.world=world;world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.65,.72,.85,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.42
    scene.render.engine="CYCLES";scene.cycles.device="CPU";scene.cycles.samples=7
    scene.cycles.use_denoising=True;scene.cycles.max_bounces=3
    scene.render.threads_mode="FIXED";scene.render.threads=4
    scene.render.use_persistent_data=True;scene.render.film_transparent=True
    scene.render.resolution_x=480;scene.render.resolution_y=360;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.compression=20
    scene.render.fps=24;scene.frame_end=count;scene.view_settings.view_transform="AgX"
    return herd


herd=setup()
if mode not in ("proof","render"): raise ValueError(mode)
frames=(list(map(int,requested)) or PROOFS[level-1]) if mode=="proof" else range(1,count+1)
anchors=[]
for f in frames:
    dst=folder/(f"proof-{f:03}.png" if mode=="proof" else f"{f:03}.png")
    if mode=="render" and f>poster:
        shutil.copyfile(folder/f"{poster:03}.png",dst)
        anchors.append(anchors[-1])
        continue
    scene.frame_set(f)
    for elephant in herd: elephant.pose(min(f,poster))
    bpy.context.view_layer.update()
    anchors.append([elephant.anchor() for elephant in herd])
    scene.render.filepath=str(dst)
    bpy.ops.render.render(write_still=True)
(folder/("proof-anchors.json" if mode=="proof" else "anchors.json")).write_text(
    json.dumps(anchors,separators=(",",":"))+"\n",encoding="utf-8")
