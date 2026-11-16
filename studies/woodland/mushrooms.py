"""Scarlet Button, Fern Chorus and Fairy Ring. Procedural Blender production.

blender -b -t 4 --python-exit-code 1 -P studies/woodland/mushrooms.py -- proof 1 2 3
blender -b -t 4 --python-exit-code 1 -P studies/woodland/mushrooms.py -- render 1 2 3
python studies/woodland/pack.py mushrooms LEVEL POSTER

Numbered production PNGs are one-based, including the fully held final frames.
"""
import argparse
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/woodland"
FRAMES = {1: 72, 2: 80, 3: 88}
POSTERS = {1: 68, 2: 76, 3: 84}
TAU = math.tau
sin, cos = math.sin, math.cos


def step(x):
    x = min(1, max(0, x))
    return x * x * (3 - 2*x)


def rise(frame, start, span):
    return step((frame-start)/span)


def blend(a, b, t):
    return tuple(x+(y-x)*t for x,y in zip(a,b))


def material(name, rough, coat=0, emission=0):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    shader=nodes.get("Principled BSDF")
    pigment=nodes.new("ShaderNodeVertexColor")
    pigment.layer_name="Colors"
    for field in ["Base Color", "Emission Color"]:
        mat.node_tree.links.new(pigment.outputs["Color"], shader.inputs[field])
    shader.inputs["Roughness"].default_value=rough
    shader.inputs["Coat Weight"].default_value=coat
    shader.inputs["Coat Roughness"].default_value=.27
    shader.inputs["Emission Strength"].default_value=emission
    return mat


class Sculpture:
    """A colored mesh assembled in local coordinates. Islands can share a rig."""
    def __init__(self):
        self.vertices=[]
        self.colors=[]
        self.faces=[]

    def vertex(self, position, color):
        self.vertices.append(tuple(position))
        self.colors.append(color)
        return len(self.vertices)-1

    def ring_faces(self, first, rows, sides):
        for i in range(rows-1):
            for j in range(sides):
                k=first+i*sides+j
                nxt=first+i*sides+(j+1)%sides
                self.faces.append((k,nxt,nxt+sides,k+sides))

    def oval(self, center, axes, rgb, rows=7, sides=12, wobble=0):
        first=len(self.vertices)
        center=Vector(center)
        u,v,w=map(Vector,axes)
        for i in range(rows+1):
            lat=-math.pi/2 + .001 + (math.pi-.002)*i/rows
            for j in range(sides):
                a=TAU*j/sides
                uneven=1+wobble*(.6*sin(3*a+.5)+.4*cos(5*a))*cos(lat)
                co=center+(u*cos(a)+v*sin(a))*cos(lat)*uneven+w*sin(lat)
                self.vertex(co,rgb)
        self.ring_faces(first,rows+1,sides)

    def tube(self, points, radii, rgb, sides=8):
        first=len(self.vertices)
        pts=list(map(Vector,points))
        for i,p in enumerate(pts):
            d=(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)]).normalized()
            ref=Vector((1,0,0)) if abs(d.z)>.86 else Vector((0,0,1))
            u=d.cross(ref).normalized()
            v=d.cross(u)
            for j in range(sides):
                a=TAU*j/sides
                self.vertex(p+radii[i]*(u*cos(a)+v*sin(a)),rgb)
        self.ring_faces(first,len(pts),sides)

    def object(self,name,mat,parent=None):
        me=bpy.data.meshes.new(name)
        me.from_pydata(self.vertices,[],self.faces)
        me.materials.append(mat)
        colors=me.color_attributes.new(name="Colors",type="FLOAT_COLOR",domain="POINT")
        colors.data.foreach_set("color",[v for rgb in self.colors for v in (*rgb,1)])
        for f in me.polygons:
            f.use_smooth=True
        me.update()
        ob=bpy.data.objects.new(name,me)
        bpy.context.collection.objects.link(ob)
        ob.parent=parent
        return ob


def axis(name,loc,parent=None):
    ob=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(ob)
    ob.parent=parent
    ob.location=loc
    return ob


# Linear-light pigments, from the dark rim to the sunlit crown.
PALETTES={
    "scarlet": ((.17,.003,.011),(.65,.014,.014),(.91,.077,.028)),
    "wine":    ((.17,.009,.042),(.47,.027,.086),(.74,.093,.16)),
    "honey":   ((.35,.081,.012),(.82,.30,.036),(.97,.60,.17)),
    "apricot": ((.38,.055,.033),(.90,.23,.093),(.98,.46,.20)),
}


def cap_surface(t,a,opened,style):
    # A young cap curls underneath its crown, then the rolled edge extends.
    phase=style["phase"]
    bell=style["bell"]
    theta=t*(2.32+(1.48-2.32)*opened)
    r=(.51+.49*opened)*sin(theta)
    r*=1+.018*sin(5*a+phase)*t+.026*cos(3*a-.7)*t*t
    z=(.76 + (.55+bell-.76)*opened)*cos(theta)
    z+=opened*t**3*(.065*sin(3*a+phase)+.028*cos(7*a+phase))
    z+=.035*cos(a+phase)*sin(theta)
    return Vector((r*cos(a),r*sin(a),z))


def cap_mesh(q,style):
    cap=Sculpture()
    dark,mid,light=PALETTES[style["color"]]
    phase=style["phase"]
    N=88
    rows=27
    for i in range(rows):
        t=.0005+.9995*i/(rows-1)
        for j in range(N):
            a=TAU*j/N
            mottling=.5+.5*sin(4*a+11*t+phase)*cos(7*a-5*t)
            rgb=blend(mid,light,.22+.52*(1-t)+.19*mottling)
            rgb=blend(rgb,dark,.66*t**5+.13*(1-mottling))
            striae=(.5+.5*cos(38*a+2*sin(3*a)+2*t))**5
            rgb=blend(rgb,light,.34*striae*t**3)
            cap.vertex(cap_surface(t,a,q,style),rgb)
    cap.ring_faces(0,rows,N)
    # Warm lamellae in a continuous underside; the repeating troughs and
    # blades cast true shadows. Rotate the spoke slightly as it widens.
    first=len(cap.vertices)
    spokes=style["gills"]
    around=spokes*6
    for i in range(15):
        t=i/14
        for j in range(around):
            a=j*TAU/around
            rim=cap_surface(1,a,q,style)
            center=Vector((.125*cos(a),.125*sin(a),-.30+.42*q))
            p=center.lerp(rim,t)
            blade=(.5+.5*cos(spokes*(a+.057*sin(math.pi*t))))**1.65
            p.z-=(.049+.16*blade)*sin(math.pi*t)**.72
            col=blend((.36,.122,.048),(.98,.68,.35),.14+.77*blade)
            col=blend(col,(.98,.81,.52),.35*t)
            cap.vertex(p,col)
    cap.ring_faces(first,15,around)
    # A small rolled golden hem gives the red edge thickness on both grounds.
    first=len(cap.vertices)
    for i in range(5):
        t=i/4
        for j in range(N):
            a=j*TAU/N
            rim=cap_surface(1,a,q,style)
            rim+=Vector((cos(a),sin(a),0))*.010*sin(math.pi*t)
            rim.z+=.015-.034*t
            cap.vertex(rim,blend(mid,(.92,.61,.33),t*.86))
    cap.ring_faces(first,5,N)
    # Raised, imperfect veil remnants align to the moving cap surface.
    for t,a,rad,squash,color in style["warts"]:
        p=cap_surface(t,a,q,style)
        tang=(cap_surface(t,a+.002,q,style)-cap_surface(t,a-.002,q,style)).normalized()
        mer=(cap_surface(t+.001,a,q,style)-cap_surface(t-.001,a,q,style)).normalized()
        norm=mer.cross(tang).normalized()
        mer=tang.cross(norm).normalized()
        rr=rad*(.62+.38*q)
        cap.oval(p+norm*.003,(mer*rr,tang*rr*squash,norm*rr*.36),color,5,10,.16)
    return cap


def ornaments(rng,kind):
    marks=[]
    # The gold and apricot varieties have finely striated, mostly bare caps.
    rows=[(.12,1),(.31,5),(.56,9),(.80,13),(.91,8)]
    if kind in ("honey","apricot"):
        rows=[(.20,1),(.52,3),(.81,6)]
    for t,count in rows:
        phase=rng.random()*TAU
        for j in range(count):
            a=phase+(j+rng.uniform(-.24,.24))*TAU/count
            rad=rng.uniform(.040,.078)*(1.2-.25*t)
            if kind in ("honey","apricot"):
                rad*=.66
            marks.append((max(.025,t+rng.uniform(-.052,.052)),a,rad,rng.uniform(.75,1.28),
                          blend((.83,.62,.36),(.99,.93,.72),rng.uniform(.28,.92))))
    return marks


def stem_mesh(height,radius,lean,phase):
    mesh=Sculpture()
    n,m=40,23
    for i in range(m):
        t=i/(m-1)
        width=radius*(.155+.10*(1-t)**2+.065*math.exp(-((t-.16)/.13)**2)+.035*t**6)
        for j in range(n):
            a=j*TAU/n
            flute=.5+.5*cos(13*a+2.1*t+phase)
            r=width*(1+.042*flute+.032*cos(5*a+t))
            co=(lean*t*t+r*cos(a),r*.91*sin(a)+.065*radius*sin(math.pi*t),height*t)
            c=blend((.49,.255,.117),(.92,.795,.55),.42+.36*t+.20*flute)
            mesh.vertex(co,c)
    mesh.ring_faces(0,m,n)
    # Hanging partial veil, with a scalloped skirt and a thin pale edge.
    first=len(mesh.vertices)
    for i in range(10):
        t=i/9
        for j in range(n):
            a=TAU*j/n
            wave=.5+.5*cos(10*a+phase)
            r=radius*(.155+.152*t+.025*t*wave)
            z=.72*height-radius*(.043+.09*t+.106*t*t+.04*wave*t)
            col=blend((.73,.44,.22),(.99,.84,.61),.34+.43*t+.18*wave)
            mesh.vertex((lean*.50+r*cos(a),r*sin(a),z),col)
    mesh.ring_faces(first,10,n)
    return mesh


def mushroom(position,height,radius,kind,start,span,tilt,lean,seed,first=False,bell=0):
    rng=random.Random(seed)
    phase=rng.random()*TAU
    style={"color":kind,"phase":phase,"gills":rng.choice([32,34,36]),
           "bell":bell,"warts":ornaments(rng,kind)}
    root=axis("Emergence",position)
    stem=stem_mesh(height,radius,lean,phase).object("Fibrous stipe and skirt",MAT["stem"],root)
    cap_mount=axis("Pileus hinge",(0,0,0),root)
    cap=cap_mesh(0,style).object("Spotted crown, rolled lip and lamellae",MAT["cap"],cap_mount)
    cap.shape_key_add(name="Button")
    keys=[]
    for q,name in [(.47,"Breaking the veil"),(1,"Spread")]:
        k=cap.shape_key_add(name=name)
        k.data.foreach_set("co",[x for co in cap_mesh(q,style).vertices for x in co])
        keys.append(k)
    def pose(f):
        emerged=rise(f,start,span*.70)
        spread=rise(f,start+span*.36,span*.64)
        seedling=.28 if first else .065
        head_scale=seedling+(1-seedling)*rise(f,start,span*.80)
        stipe_h=(.058 if first else .006)+(.942 if first else .994)*emerged
        stipe_w=.26+.74*emerged
        stem.scale=(stipe_w,stipe_w,stipe_h)
        cap_mount.location=(lean*stipe_w,0,height*stipe_h)
        cap_mount.scale=(radius*head_scale,)*3
        settle=sin(math.pi*spread)
        cap_mount.rotation_euler=(tilt*(.22+.78*spread)+.09*settle,
                                   .075*sin(phase)*spread+.13*settle,
                                   -.20*(1-spread))
        keys[0].value=min(spread/.47,(1-spread)/.53)
        keys[1].value=max(0,(spread-.47)/.53)
    ANIMATE.append(pose)


def frond(pos,direction,length,start,seed,curled=False):
    rng=random.Random(seed)
    mesh=Sculpture()
    forward=Vector((cos(direction),sin(direction),0))
    lateral=Vector((-sin(direction),cos(direction),0))
    up=Vector((0,0,1))
    def center(t):
        return length*(forward*(.72*t+.18*t*t)+up*(1.26*t-.73*t*t)
                       +lateral*.066*sin(math.pi*t))
    ts=[j/30 for j in range(31)]
    mesh.tube([center(t) for t in ts],[length*(.018-.014*t) for t in ts],(.30,.46,.087))
    color=blend((.012,.094,.049),(.045,.28,.096),rng.random())
    for i in range(10):
        t=.10+.085*i
        for side in [-1,1]:
            st=t+.018*(side>0)
            base=center(st)
            reach=length*(.07+.182*sin(math.pi*t)**.62)*(1-.54*t)
            d=side*(lateral+.60*up)+.48*forward+.25*up
            # Corrugated blade with a raised midrib, tapered tip and teeth.
            first=len(mesh.vertices)
            for j in range(11):
                s=j/10
                w=length*.050*sin(math.pi*s)**.64*(1-.60*t)
                if j%2: w*=.80
                p=base+reach*(d*s+forward*.41*s*s)+up*.019*length*sin(math.pi*s)
                for k in [-1,0,1]:
                    col=blend(color,(.18,.50,.16),.18+.36*t+.28*(k==0))
                    mesh.vertex(p+forward*(k*w)+up*(abs(k)*-.38*w),col)
            for j in range(10):
                for k in [0,1]:
                    v=first+3*j+k
                    mesh.faces.append((v,v+3,v+4,v+1))
    if curled:
        pts=[]
        tip=center(1)
        for i in range(30):
            t=i/29
            a=t*TAU*1.02
            rr=length*.087*(1-.81*t)
            pts.append(tip+forward*rr*sin(a)+up*(length*.087-rr*cos(a)))
        mesh.tube(pts,[length*.017*(1-.68*i/29) for i in range(30)],(.24,.44,.13))
    obj=mesh.object("Pinnate fern with folded leaflets",MAT["leaf"])
    obj.location=pos
    def pose(f):
        t=rise(f,start,25)
        v=.64+.36*t
        obj.scale=(v,v,.57+.43*t)
        obj.rotation_euler=(.049*sin(direction)*sin(math.pi*t),-.09*cos(direction)*sin(math.pi*t),.057*(1-t))
    ANIMATE.append(pose)


def ellipsoid_axes(x,y,z):
    return ((x,0,0),(0,y,0),(0,0,z))


def cushion(mesh,p,r,seed):
    """Moss cushions, scattered coarse tufts and a few grains of exposed peat."""
    rng=random.Random(seed)
    x,y=p
    mesh.oval((x,y,.004),ellipsoid_axes(r,r*.65,r*.102),(.075,.057,.026),6,18,.16)
    moss=((.057,.16,.056),(.115,.235,.051),(.058,.18,.072),(.195,.26,.069))
    for i in range(19):
        a=rng.random()*TAU
        rr=r*math.sqrt(rng.random())*.80
        w=r*rng.uniform(.09,.27)
        xx=x+rr*cos(a); yy=y+.62*rr*sin(a)
        mesh.oval((xx,yy,.048+r*.022),ellipsoid_axes(w,w*.79,w*.47),
                  rng.choice(moss),5,10,.15)
    for i in range(15):
        a=rng.random()*TAU; rr=r*math.sqrt(rng.random())*.95
        tip=Vector((x+rr*cos(a),y+rr*sin(a)*.64,.065))
        for k in range(3):
            b=TAU*k/3+rng.uniform(-.4,.4)
            d=Vector((cos(b),sin(b),1.5))
            mesh.tube([tip,tip+d*r*.047,tip+d*r*.088],
                      [r*.010,r*.014,r*.001],rng.choice(moss),5)
    # Irregular clumps of fine moss leaves break the edge of the soil and the
    # broad cushion shapes. Each clump is a little overlapping rosette.
    for i in range(36):
        a=rng.random()*TAU; rr=r*math.sqrt(rng.random())*.93
        z=.045+.10*r*math.sqrt(max(0,1-(rr/r)**2))
        c=Vector((x+rr*cos(a),y+.64*rr*sin(a),z))
        for j in range(4):
            b=rng.random()*TAU
            u=Vector((cos(b),sin(b),1.36)).normalized()
            v=Vector((-sin(b),cos(b),0))
            h=r*rng.uniform(.034,.084)
            mesh.oval(c+u*h*.60,(v*h*.28,u.cross(v)*h*.22,u*h),rng.choice(moss),3,6)


def litter(mesh,p,r,seed):
    rng=random.Random(seed)
    x,y=p
    for i in range(3):
        a=rng.random()*TAU
        xx=x+r*cos(a)*.78; yy=y+r*sin(a)*.63
        w=r*rng.uniform(.095,.155)
        rgb=rng.choice([(.24,.26,.218),(.34,.25,.169),(.37,.34,.23)])
        mesh.oval((xx,yy,.04),ellipsoid_axes(w,1.20*w,w*.62),rgb,5,9,.19)


def spores():
    # The spore flight winds once around the ring and then up toward its heart.
    for i in range(33):
        s=i/32
        start=42+17*s
        a=.30+TAU*(.95*s)
        p=Vector((2.39*cos(a),1.41*sin(a),1.40+.24*sin(a)))
        travel=.45+1.67*s
        radius=2.38-1.10*s
        rr=.031+.015*sin(i*7.2)**2
        mesh=Sculpture()
        tint=(.99,.62,.13) if i%4 else (.38,.89,.66)
        mesh.oval((0,0,0),ellipsoid_axes(rr,rr*.9,rr*1.16),tint,5,8)
        if i%5==0:
            for vec in [Vector((1,0,0)),Vector((0,0,1))]:
                mesh.oval((0,0,0),(vec*rr*2.0,Vector((0,1,0))*rr*.28,
                          vec.cross(Vector((0,1,0)))*rr*.27),tint,5,8)
        obj=mesh.object("Suspended luminous spore",MAT["spore"])
        def pose(f,obj=obj,st=start,ang=a,tr=travel,rad=radius,s=s,origin=p):
            v=rise(f,st,80-st)
            b=ang+tr*v
            dest=Vector((rad*cos(b),rad*.64*sin(b),1.42+s*1.58+.19*sin(b)))
            obj.location=origin.lerp(dest,v)+Vector((0,0,.30*sin(math.pi*v)))
            obj.hide_render=v<.006
            obj.scale=(max(v,.001),)*3
        ANIMATE.append(pose)


def mycelium(ground):
    # A loose ring of forking, leaf-gold hyphae stitches the moss cushions
    # together. Individual gaps are intentional and the center stays open.
    for j in range(8):
        base=j*TAU/8
        for k in range(2):
            points=[]
            for i in range(23):
                t=i/22
                a=base+TAU/8*(.10+.86*t)
                wave=.052*sin(7*t+j)+.052*k*sin(math.pi*t)
                points.append(((2.44+wave)*cos(a),(1.52+wave)*sin(a),.025+.019*sin(math.pi*t+j)))
            ground.tube(points,[.010+.010*sin(math.pi*i/22) for i in range(23)],
                        (.45,.32,.136) if k==0 else (.28,.24,.104),6)


def garden(lv):
    # x, y, stem height, cap radius, color, emergence frame, time to maturity,
    # forward tilt, sideways lean, crown profile.
    if lv==1:
        specs=[(0,.10,2.46,1.39,"scarlet",4,53,-.41,-.13,.11)]
        patches=[((-.15,.10),1.22),((.68,.16),.54),((-.82,.16),.43)]
        ferns=[(-.58,.15,2.93,1.03),(.54,.26,.22,1.15),(.64,.29,1.01,.80)]
    elif lv==2:
        specs=[(-1.26,-.16,1.72,.93,"honey",3,40,-.35,-.14,.18),
               (.12,.56,2.73,1.11,"scarlet",13,45,-.27,.05,.12),
               (1.41,.01,1.52,.84,"wine",25,39,-.48,.14,.14),
               (-.32,-.72,.86,.62,"apricot",33,35,-.20,-.10,.32)]
        patches=[((-.02,.10),1.32),((-1.29,-.12),.93),((1.31,.06),1.02),((-.34,-.63),.68)]
        ferns=[(-1.72,-.07,2.84,1.16),(-1.46,.09,2.05,.95),(-.80,-.43,4.1,.79),
               (.71,.12,.77,1.17),(1.62,.12,.27,1.25),(.82,-.46,5.75,.75)]
    else:
        specs=[(2.43,.06,1.51,.73,"honey",2,37,-.34,.16,.19),
               (1.69,1.22,1.93,.77,"wine",8,38,-.22,.16,.19),
               (-.05,1.67,2.58,.97,"scarlet",13,42,-.30,-.13,.22),
               (-1.73,1.10,1.81,.76,"apricot",19,40,-.31,-.15,.22),
               (-2.50,-.03,1.36,.74,"wine",25,40,-.45,-.18,.19),
               (-1.72,-1.16,.99,.69,"scarlet",32,40,-.37,-.14,.17),
               (-.03,-1.65,.72,.58,"honey",40,36,-.17,.04,.29),
               (1.63,-1.15,.99,.63,"scarlet",44,34,-.32,.12,.21)]
        patches=[((x,y),r*1.03) for x,y,h,r,*_ in specs]
        ferns=[(-2.44,.16,2.72,.98),(-1.42,1.08,1.86,.92),
               (1.21,1.14,.81,1.04),(2.41,.15,.46,1.03),
               (1.72,-1.09,5.77,.75),(-1.57,-1.09,3.98,.68),(.45,-1.54,5.66,.57)]
    ground=Sculpture()
    for j,(p,r) in enumerate(patches):
        cushion(ground,p,r,772+j*29)
        litter(ground,p,r,35+j)
    if lv==3:
        mycelium(ground)
    ground.object("Velvet moss, peat and river pebbles",MAT["moss"])
    for j,(x,y,h,r,col,start,span,tilt,lean,bell) in enumerate(specs):
        mushroom((x,y,.075),h,r,col,start,span,tilt,lean,187+lv*23+j*19,j==0,bell)
    for j,(x,y,a,length) in enumerate(ferns):
        frond((x,y,.09),a,length,5+j*4,201+j,j%3==0)
    if lv==3:
        spores()


def studio(level):
    global MAT
    MAT={"cap":material("Pigmented satin cap and apricot gills",.39,.19),
         "stem":material("Fibrous parchment",.57,.07),
         "leaf":material("Fern leaf wax",.47,.15),
         "moss":material("Moss and forest litter",.72),
         "spore":material("Sunlit spores",.29,.13,.72)}
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"
    scene.cycles.samples=8
    scene.cycles.use_adaptive_sampling=False
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=3
    scene.render.threads_mode="FIXED"; scene.render.threads=4
    scene.render.use_persistent_data=True
    scene.render.film_transparent=True
    scene.render.resolution_x=480; scene.render.resolution_y=360
    scene.render.resolution_percentage=100; scene.render.fps=24
    scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="8"; scene.render.image_settings.compression=24
    scene.view_settings.view_transform="AgX"
    world=bpy.data.worlds.new("Forest skylight"); scene.world=world; world.use_nodes=True
    sky=world.node_tree.nodes.get("Background")
    sky.inputs[0].default_value=(.72,.80,.95,1); sky.inputs[1].default_value=.40
    target=Vector((0,0,{1:1.55,2:1.64,3:1.64}[level]))
    angle=math.radians({1:14,2:19,3:27}[level])
    bpy.ops.object.camera_add(location=target+Vector((0,-13*cos(angle),13*sin(angle))))
    cam=bpy.context.object
    cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO"; cam.data.ortho_scale={1:5.80,2:6.48,3:7.98}[level]
    scene.camera=cam
    for name,location,power,size,rgb in [
        ("Morning softbox",(-4,-5,7),610,4.5,(1,.85,.68)),
        ("Open sky",(4,-3,4),260,4,(.70,.82,1)),
        ("Warm rim",(2,3.8,6),800,3.7,(1,.81,.62))]:
        bpy.ops.object.light_add(type="AREA",location=location)
        obj=bpy.context.object; obj.name=name
        obj.data.shape="DISK"; obj.data.size=size
        obj.data.energy=power; obj.data.color=rgb
        obj.rotation_euler=(target-obj.location).to_track_quat("-Z","Y").to_euler()
    return scene


def render(lv,mode):
    global ANIMATE
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ANIMATE=[]
    scene=studio(lv)
    garden(lv)
    scene.frame_start=1; scene.frame_end=FRAMES[lv]
    folder=RAW/f"mushrooms-{lv}"
    folder.mkdir(parents=True,exist_ok=True)
    sequence=range(1,FRAMES[lv]+1) if mode=="render" else (1,FRAMES[lv]//2,POSTERS[lv])
    for f in sequence:
        scene.frame_set(f)
        for pose in ANIMATE:
            pose(f)
        name=f"{f:03}.png" if mode=="render" else f"proof-{f:03}.png"
        scene.render.filepath=str(folder/name)
        bpy.ops.render.render(write_still=True)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode",choices=["proof","render"])
    parser.add_argument("levels",nargs="+",type=int,choices=FRAMES)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:])
    for level in args.levels:
        render(level,args.mode)
