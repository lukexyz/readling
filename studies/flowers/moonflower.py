"""Moonflower • three botanical studies, modeled in Blender; no external assets.

blender -b -t 5 -P studies/flowers/moonflower.py -- render 1 2 3
blender -b -t 5 -P studies/flowers/moonflower.py -- proof 1 2 3
python studies/flowers/moonflower.py pack 1 2 3

Frame numbers in this script and filenames are one-based. Proof images are never
used as atlas inputs. The pack command also decodes and checks the final sheets.
"""
from pathlib import Path
import argparse
import math
import runpy
import sys
from math import sin, cos, pi, exp, sqrt

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "assets/videos/flower-studies"
DEST = ROOT / "dist/assets/flower-studies"
COUNTS = {1: 68, 2: 80, 3: 92}
BEATS = {1: (1, 45, 65), 2: (1, 49, 77), 3: (1, 52, 89)}
T = 2*pi
W, H = 480, 360


def ease(v):
    v = min(1, max(0, v))
    return v*v*(3-2*v)


def ramp(f, a, b):
    return ease((f-a)/(b-a))


def mix(a,b,x):
    return tuple(i+(j-i)*x for i,j in zip(a,b))


def blender_init():
    global bpy, V, Q
    import bpy
    from mathutils import Vector as V, Quaternion as Q


def mat(name, color, metal=0, rough=.35, shine=0, painted=False):
    m = bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes = True
    tree=m.node_tree
    b=tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value=(*color,1)
    b.inputs["Metallic"].default_value=metal
    b.inputs["Roughness"].default_value=rough
    b.inputs["Coat Weight"].default_value=.24
    b.inputs["Coat Roughness"].default_value=.26
    b.inputs["Emission Strength"].default_value=shine
    b.inputs["Emission Color"].default_value=(*color,1)
    if painted:
        n=tree.nodes.new("ShaderNodeVertexColor")
        n.layer_name="Pigment"
        tree.links.new(n.outputs["Color"],b.inputs["Base Color"])
        tree.links.new(n.outputs["Color"],b.inputs["Emission Color"])
    return m


def mesh(name,vs,fs,material,colors=None):
    me=bpy.data.meshes.new(name)
    me.from_pydata(vs,[],fs)
    me.materials.append(material)
    for p in me.polygons: p.use_smooth=True
    if colors:
        attr=me.color_attributes.new(name="Pigment",type="FLOAT_COLOR",domain="POINT")
        attr.data.foreach_set("color",[c for rgb in colors for c in (*rgb,1)])
    me.update()
    ob=bpy.data.objects.new(name,me)
    bpy.context.collection.objects.link(ob)
    return ob


def rings(n,m):
    return [(i*n+j,i*n+(j+1)%n,(i+1)*n+(j+1)%n,(i+1)*n+j)
            for i in range(m-1) for j in range(n)]


def empty(name,loc,parent=None):
    ob=bpy.data.objects.new(name,None)
    bpy.context.collection.objects.link(ob)
    ob.parent=parent
    ob.location=loc
    return ob


def ball(name,loc,scale,material,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10)
    ob=bpy.context.object
    ob.name=name; ob.parent=parent; ob.location=loc; ob.scale=scale
    ob.data.materials.append(material)
    for p in ob.data.polygons: p.use_smooth=True
    return ob


def cord(name,pts,rad,material,widths=None,parent=None):
    c=bpy.data.curves.new(name,"CURVE")
    c.dimensions="3D"; c.resolution_u=1; c.bevel_depth=rad
    c.bevel_resolution=2; c.use_fill_caps=True
    c.bevel_factor_mapping_end="RESOLUTION"
    spline=c.splines.new("POLY"); spline.points.add(len(pts)-1)
    for i,(p,co) in enumerate(zip(spline.points,pts)):
        p.co=(*co,1)
        if widths is not None: p.radius=widths[i]
    c.materials.append(material)
    ob=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(ob)
    ob.parent=parent
    return ob


def smoothpath(points,each=12):
    P=list(map(V,points)); out=[]
    for i in range(len(P)-1):
        a,b,c,d=P[max(0,i-1)],P[i],P[i+1],P[min(i+2,len(P)-1)]
        for k in range(each):
            t=k/each
            out.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3))
    return out+[P[-1]]


def point(P,t):
    f=min(1,max(0,t))*(len(P)-1); i=min(len(P)-2,int(f))
    return P[i].lerp(P[i+1],f-i)


def grow_scale(ob,factor,full=1):
    ob.hide_render=factor<.001
    ob.scale=(max(.0001,factor)*full,)*3


def materials():
    global stem,wire,leafmat,porcelain,lip,brass,pistil,seedskin,lining,starM
    stem=mat("Vine | petrol celadon",(.029,.19,.15),.24)
    wire=mat("Young growth | silver sage",(.22,.51,.35),.25)
    leafmat=mat("Leaf | inlaid malachite",(1,1,1),.16,.34,.025,True)
    porcelain=mat("Corolla | spiralled nacre",(1,1,1),.10,.29,.095,True)
    lip=mat("Corolla | opaline rolled hem",(1,1,1),.24,.24,.30,True)
    brass=mat("Anther | pollen gold",(.94,.47,.061),.38,.25,.28)
    pistil=mat("Stamen | champagne",(.96,.72,.34),.21,.30,.12)
    seedskin=mat("Testa | glazed umber",(.16,.056,.035),.30,.27)
    lining=mat("Testa | burnished seam",(.48,.24,.095),.46,.3)
    starM=[mat("Pollen | honey",(1,.55,.12),.2,.25,.75),
           mat("Pollen | ice",(.28,.8,.9),.22,.25,.53),
           mat("Pollen | lilac",(.64,.42,.92),.22,.25,.48)]


def seed():
    # Two complementary shell valves around the embryo; the narrow top
    # splits during germination, with the radicle visible in the aperture.
    root=empty("Seed | rocking axis",(0,-.10,.12))
    core=ball("Seed | luminous hilum",(0,0,.12),(.091,.072,.14),wire,root)
    for side in [-1,1]:
        group=empty("Testa valve",(0,0,0),root)
        vs=[]; fs=[]; N=20; M=22
        def shell(t,a):
            r=(sin(pi*t)**.67)*(.263-.095*t)
            return (side*(r*cos(a)+.007*sin(pi*t)), r*.74*sin(a),
                    .53*t+.018*cos(a)*sin(pi*t))
        for i in range(M+1):
            t=.0001+.9998*i/M
            for j in range(N+1):
                vs.append(shell(t,-pi/2+pi*j/N))
        for i in range(M):
            for j in range(N):
                k=i*(N+1)+j; fs.append((k,k+1,k+N+2,k+N+1))
        ob=mesh("Chestnut seed coat",vs,fs,seedskin); ob.parent=group
        for a in [-pi/2,-.97,.10]:
            ts=[.04+.93*i/32 for i in range(33)]
            cord("Raised seed suture",[shell(t,a+.16*sin(pi*t)) for t in ts],
                 .014 if a< -1 else .006,lining,[sin(pi*t)**.5 for t in ts],group)
        def update(f,g=group,s=side):
            g.rotation_euler.y=s*(.05+.70*ramp(f,6,21))
        ticks.append(update)
    def rocking(f):
        root.rotation_euler.y=-.18+.14*ramp(f,3,13)+.085*sin(f*.66)*sin(pi*ramp(f,2,14))
    ticks.append(rocking)


def vine(points,a,b,r=.073,twist=0):
    P=smoothpath(points)
    def curl(t):
        ang=t*T*twist
        return V((.085*sin(ang),.13*cos(ang),.025*sin(ang+.9)))*sin(pi*t)**.6
    if twist: P=[p+curl(i/(len(P)-1)) for i,p in enumerate(P)]
    widths=[1-.72*(i/(len(P)-1))**.88 for i in range(len(P))]
    ob=cord("Climbing vine",P,r,stem,widths)
    strand=[]
    for i,p in enumerate(P):
        t=i/(len(P)-1); d=(P[min(i+1,len(P)-1)]-P[max(0,i-1)]).normalized()
        u=d.cross(V((0,-1,0))).normalized(); v=d.cross(u)
        strand.append(p+(u*cos(t*T*2)+v*sin(t*T*2))*r*.90*widths[i])
    hi=cord("Vine | tracer",strand,r*.19,wire,widths)
    def grow(f):
        t=ramp(f,a,b)
        for o in (ob,hi):
            o.hide_render=t<.001; o.data.bevel_factor_end=max(.00001,t)
        # Taper the actual growing shoot, including the unobtrusive tracer.
        # RESOLUTION maps uniformly over the sampled polyline, like point().
        N=len(P)-1
        for o in (ob,hi):
            ps=o.data.splines[0].points
            for i,p in enumerate(ps):
                p.radius=widths[i]*(.09+.91*ease((t-i/N)/.072))
    ticks.append(grow)
    return P


def leaf(loc,dx,dz,length,start,roll=0):
    # A cordate blade, with two rounded basal lobes and a long drip tip.
    g=empty("Leaf | pulvinus",loc); N=28; M=12
    vs=[]; cs=[]; fs=[]
    def surf(t,s):
        # Two cubic arcs trace the basal sinus, rounded shoulder and drip tip.
        u=t/.36 if t<.36 else (t-.36)/.64
        pts=((0,0),(.20,-.31),(.51,-.24),(.45,.13)) if t<.36 else (
            (.45,.13),(.42,.39),(.17,.60),(0,1))
        weights=((1-u)**3,3*u*(1-u)**2,3*u*u*(1-u),u**3)
        w,z=(sum(p[k]*q for p,q in zip(pts,weights)) for k in (0,1))
        return V((s*w+.09*t*t,-.095*sin(pi*t)+.13*abs(s)**1.4*sin(pi*t)
                  +.027*s*sin(t*T),t+(z-t)*abs(s)**1.4+.035*s*sin(pi*t)))
    for i in range(N+1):
        t=.0001+.9998*i/N
        for j in range(M+1):
            s=-1+2*j/M; vs.append(surf(t,s))
            c=mix((.026,.15,.125),(.079,.39,.257),.33+.32*cos(s*pi)+.21*s)
            c=mix(c,(.31,.52,.36),.56*exp(-(s/.10)**2)+.28*abs(s)**8)
            cs.append(c)
    for i in range(N):
        for j in range(M):
            k=i*(M+1)+j; fs.append((k,k+1,k+M+2,k+M+1))
    ob=mesh("Heart-shaped blade",vs,fs,leafmat,cs); ob.parent=g
    def line(t,s): return surf(t,s)+V((0,-.007,0))
    ts=[.03+.93*i/25 for i in range(26)]
    cord("Leaf | midrib",[line(t,0) for t in ts],.011,wire,[1.1-.95*t for t in ts],g)
    for j in range(3):
        for side in (-1,1):
            ts=[i/11 for i in range(12)]
            cord("Leaf | secondary vein",[line(.17+j*.17+.20*t,side*.82*t**.78) for t in ts],
                 .005,wire,[1-.89*t for t in ts],g)
    def update(f):
        v=ramp(f,start,start+15); grow_scale(g,v,length)
        g.rotation_euler=(roll+.13*(1-v),math.atan2(dx,dz)-.30*(1-v),.11*sin(start))
    ticks.append(update)


def arrival(t, a, b):
    # Invert the smooth growth clock to attach leaves at the growing tip.
    lo,hi=0.,1.
    for _ in range(20):
        u=(lo+hi)*.5
        if ease(u)<t: lo=u
        else: hi=u
    return a+(b-a)*(lo+hi)*.5


def branch(P,t,offset,start,axis,size,duration,phase):
    p=point(P,t); end=p+V(offset)
    direction=V(axis).normalized()
    mid=p+V(offset)*.68-direction*.14
    vine([p,mid,end],start,start+7,.042*size)
    bloom(end,axis,size,start+4,duration,phase)
    return end


def pollen(level,origin):
    # Tiny double pyramids and four-point stars physically travel out of the
    # last corolla. The spiral has no alpha halo or camera-space geometry.
    num={1:4,2:8,3:33}[level]
    finish=COUNTS[level]-8
    def spiral(s):
        # Flight starts at the outer end, curls toward its heart, then settles.
        a=s*T*1.36-.62; rad=.11+s*1.23
        return V((.55+rad*cos(a),-.67+.14*sin(2*a),3.02+rad*.93*sin(a)+.17*s))
    for i in range(num):
        u=i/max(1,num-1)
        if level==3:
            dest=spiral(u)
        elif level==1:
            a=u*1.95-.5
            dest=V(origin)+V((1.13+.62*cos(a),-.45-.22*u,.25+.68*sin(a)))
        else:
            a=u*2.6+.14; dest=V(origin)+V((.49+.85*cos(a),-.25-.15*u,.32+.73*sin(a)))
        large=i%(5 if level==3 else 4)==0 or (level==1 and i==3)
        r=(.091 if large else (.043 if level==3 else .033))*(1+.15*sin(i))
        vs=[(0,-r*.44,0),(0,r*.44,0)]; fs=[]
        for j in range(8):
            ang=T*j/8; rr=r*(1 if j%2==0 else .26)
            vs.append((rr*cos(ang),0,rr*sin(ang)*(1.30 if large else 1)))
        for j in range(8):
            a=2+j; b=2+(j+1)%8; fs.extend([(0,a,b),(1,b,a)])
        ob=mesh("Released pollen star",vs,fs,starM[(i%3 if i%4 else 0)])
        for poly in ob.data.polygons: poly.use_smooth=False
        if level==3:
            ob.data.materials.append(lining)
            for j,poly in enumerate(ob.data.polygons):
                if (j//2)%8 in (4,5): poly.material_index=1
        launch=finish-26+12*u if level==3 else finish-20+6*(1-u)
        def update(f,o=ob,p=V(origin),d=dest,k=i,a=launch,s=u):
            v=ramp(f,a,finish); o.hide_render=v<=.001
            if level==3:
                # Follow a rising arc from the lip into a shared inward spiral.
                if v<.27:
                    z=v/.27
                    o.location=p.lerp(spiral(1),z)+V((0,-.12,.36))*sin(pi*z)
                else: o.location=spiral(1-(1-s)*(v-.27)/.73)
            else:
                o.location=p.lerp(d,v)+V((.18*sin(pi*v)*cos(k),-.16*sin(pi*v),.31*sin(pi*v)))
            o.rotation_euler.y=(1-v)*1.5+.17*sin(k*1.6)
            o.scale=(max(.00001,v)*(1+.15*sin(2*pi*v+k)*sin(pi*v)),)*3
        ticks.append(update)


def arrange(level):
    seed()
    foot=(0,-.01,.28)
    if level==1:
        a,b=9,37
        P=vine([foot,(-.30,.06,.78),(-.55,.12,1.44),(-.30,-.08,2.15),
                (.29,.04,2.69),(.43,.23,3.37),(.11,.14,3.99)],a,b,.081,1.15)
        leaves=[(.19,.85,.40,1.02,-.32),(.37,-1,.42,1.23,-.20),
                (.61,.96,.60,1.08,.21),(.79,-.8,.63,.85,-.17)]
        angle=(-.64,-.68,.76); size=1.43; bloom(P[-1],angle,size,33,26,.16)
        tendril(point(P,.54),-1,1.06,arrival(.54,a,b))
        tendril(point(P,.81),1,.74,arrival(.81,a,b))
        pollen(1,P[-1]+V(angle).normalized()*size)
    elif level==2:
        a,b=9,54
        P=vine([foot,(-.59,.03,.72),(-1.07,.15,1.42),(-1.16,.12,2.37),
                (-.89,.08,3.35),(-.29,.07,4.09),(.60,.15,4.38),
                (1.39,.16,4.11),(1.82,.08,3.55),(1.86,-.06,3.04)],a,b,.084,.92)
        leaves=[(.15,1,.30,1.02,-.28),(.27,-1,.62,1.07,.21),
                (.40,.95,.54,.88,.18),(.56,-.50,.83,.74,-.28),
                (.74,-.14,1,.59,.25),(.83,1,.36,.75,-.16)]
        # The terminal blossom hangs lower on the outside of the arch.
        branch(P,.415,(-.42,-.04,.28),arrival(.415,a,b),(-.79,-.88,.50),1.06,22,.22)
        branch(P,.65,(.12,-.12,.24),arrival(.65,a,b),(.22,-.91,.70),1.15,23,-.37)
        angle=(.49,-.89,-.28); size=1.13; bloom(P[-1],angle,size,50,23,.61)
        tendril(point(P,.36),1,1.02,arrival(.36,a,b))
        tendril(point(P,.89),1,.77,arrival(.89,a,b))
        pollen(2,P[-1]+V(angle).normalized()*size)
    else:
        a,b=8,55
        P=vine([foot,(-.32,.12,.69),(-.48,-.02,1.13),(-1.17,.08,1.57),
                (-1.89,.10,2.26),(-2.13,.20,3.22),(-1.80,.10,4.07),
                (-1.06,.15,4.68),(-.08,.06,4.98),(.77,.12,4.89),
                (1.28,.08,4.65)],a,b,.080,2.1)
        P2=vine([(.03,.075,.29),(-.13,-.10,.63),(-.61,.15,.86),
                 (-.52,.06,1.21),(.06,.12,1.35),(.80,.20,1.26),
                 (1.48,.13,1.36),(2.21,.08,1.86),(2.47,.07,2.39)],11,59,.075,1.3)
        leaves=[(.11,.64,.35,.75,.16),(.26,-1,.32,.92,-.22),
                (.45,.88,.61,.79,.19),(.59,-.8,.51,.66,-.14),
                (.76,-.5,.82,.56,.18),(.91,.65,.51,.49,.20)]
        branch(P,.39,(-.28,-.11,.05),arrival(.39,a,b),(-.66,-.85,.48),.99,24,-.18)
        branch(P,.585,(-.29,-.04,.13),arrival(.585,a,b),(-.54,-.72,.65),1.01,25,.28)
        branch(P,.76,(-.02,-.10,.12),arrival(.76,a,b),(-.04,-.98,.63),.97,26,-.13)
        bloom(P[-1],(.67,-.81,.32),.91,51,25,.30)
        branch(P2,.47,(-.12,-.16,.20),arrival(.47,11,59),(-.36,-.79,.55),.94,24,.72)
        branch(P2,.734,(.01,-.17,.10),arrival(.734,11,59),(.04,-.93,.56),.92,25,-.28)
        angle=(.59,-.85,.42); size=.87; bloom(P2[-1],angle,size,55,25,.63)
        for t,x,z,l in [(.40,-.94,.39,.69),(.62,1,-.25,.71),(.86,.89,-.15,.58)]:
            leaf(point(P2,t),x,z,l,arrival(t,11,59),-.25)
        tendril(point(P,.52),1,.88,arrival(.52,a,b))
        tendril(point(P2,.83),-1,.75,arrival(.83,11,59))
        pollen(3,P2[-1]+V(angle).normalized()*size)
    for t,x,z,l,r in leaves: leaf(point(P,t),x,z,l,arrival(t,a,b),r)


def studio():
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.device="CPU"; scene.cycles.samples=12
    scene.cycles.use_denoising=True; scene.cycles.use_adaptive_sampling=False
    scene.cycles.max_bounces=4; scene.cycles.diffuse_bounces=2; scene.cycles.glossy_bounces=2
    scene.render.threads_mode="FIXED"; scene.render.threads=5
    scene.render.film_transparent=True; scene.render.resolution_x=W; scene.render.resolution_y=H
    scene.render.resolution_percentage=100; scene.render.fps=24
    scene.render.image_settings.file_format="PNG"; scene.render.image_settings.color_mode="RGBA"
    scene.render.image_settings.color_depth="8"; scene.render.image_settings.compression=18
    scene.render.use_persistent_data=True
    scene.view_settings.view_transform="AgX"
    world=bpy.data.worlds.new("Neutral reflected studio light"); scene.world=world
    world.use_nodes=True; bg=world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value=(.68,.76,.94,1); bg.inputs[1].default_value=.38
    target=V((0,0,3.12))
    bpy.ops.object.camera_add(location=target+V((0,-13,1.32)))
    cam=bpy.context.object; cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO"; cam.data.ortho_scale=9.08; scene.camera=cam
    def light(name,p,power,size,col):
        bpy.ops.object.light_add(type="AREA",location=p)
        o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape="DISK"
        o.data.size=size;o.data.color=col
        o.rotation_euler=(target-o.location).to_track_quat("-Z","Y").to_euler()
    light("Silk | warm key",(-3.8,-5.2,8.5),550,5,(1,.89,.78))
    light("Blue hour | fill",(4,-3,4.5),260,4,(.63,.84,1))
    light("Moon | edge",(-1,2.2,7.5),780,3.15,(.77,.82,1))
    return scene


def render(level,proof=False,frames=None):
    global ticks
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ticks=[]; scene=studio(); materials(); arrange(level)
    folder=RAW/f"moonflower-{level}"; folder.mkdir(parents=True,exist_ok=True)
    scene.frame_start=1; scene.frame_end=COUNTS[level]
    for f in (frames or (BEATS[level] if proof else range(1,COUNTS[level]+1))):
        scene.frame_set(f)
        for update in ticks: update(f)
        scene.render.filepath=str(folder/(("proof-" if proof else "")+f"{f:03d}.png"))
        bpy.ops.render.render(write_still=True)


def pack(level):
    import json
    from PIL import Image, ImageChops, ImageDraw, ImageStat
    stem=f"moonflower-{level}"; folder=RAW/stem; DEST.mkdir(parents=True,exist_ok=True)
    packer=runpy.run_path(str(ROOT/"studies/ember-orca/pack-progression.py"))["pack_shot"]
    packer(folder,DEST,stem,COUNTS[level])
    data=json.loads((DEST/f"{stem}.json").read_text())
    assert set(data)=={"sheets","frames"}
    pages=[Image.open(DEST/name).convert("RGBA") for name in data["sheets"]]
    margins=[W,H,W,H]; held=None; playback=[]
    assert len(data["frames"])==COUNTS[level]
    for i,frame in enumerate(data["frames"],1):
        assert frame, (stem,i,"empty frame")
        page,x,y,w,h,u,v=frame
        with Image.open(folder/f"{i:03d}.png") as original:
            assert original.size==(W,H) and original.mode=="RGBA"
            alpha=original.getchannel("A")
            tile=pages[page].crop((x,y,x+w,y+h))
            sprite=tile.getchannel("A")
            assert not ImageChops.difference(sprite,alpha.crop((u,v,u+w,v+h))).getbbox(),(stem,i)
            assert alpha.getbbox()==(u,v,u+w,v+h)
            if i==COUNTS[level]-7:
                held=original.copy()
            elif held is not None:
                assert not ImageChops.difference(held,original).getbbox(alpha_only=False),(stem,i,"unstable hold")
            margins=[min(a,b) for a,b in zip(margins,(u,v,W-u-w,H-v-h))]
            canvas=Image.new("RGBA",(W,H))
            canvas.paste(tile,(u,v))
            # WebP RGB is lossy. Test its visible color over cream as well as
            # the exact alpha, so a different picture with the same mask fails.
            if i in BEATS[level]:
                ground=Image.new("RGBA",(W,H),"#f3eddf")
                src=Image.alpha_composite(ground,original).convert("RGB")
                dst=Image.alpha_composite(ground,canvas).convert("RGB")
                delta=ImageChops.difference(src,dst).crop((u,v,u+w,v+h))
                assert max(ImageStat.Stat(delta).rms)<8,(stem,i,"visible color mismatch")
            playback.append(canvas)
    assert min(margins)>=6, (stem,margins)
    with Image.open(folder/f"{BEATS[level][-1]:03d}.png") as poster:
        poster_path=DEST/f"{stem}-poster.png"
        poster.save(poster_path,optimize=True)
        with Image.open(poster_path) as saved:
            assert saved.mode=="RGBA" and saved.size==(W,H)
            assert not ImageChops.difference(poster,saved).getbbox(alpha_only=False)
    # A transparent, play-once proof of exactly what a manifest consumer sees.
    dt=[round((i+1)*1000/24)-round(i*1000/24) for i in range(len(playback))]
    playback[0].save(folder/"atlas-playback.webp",save_all=True,append_images=playback[1:],
                     lossless=True,method=3,duration=dt,loop=1,allow_mixed=False)
    # Also prove the decoded assets on the two opposite review grounds.
    # They are contact-print colors only, never part of a delivery frame.
    board=Image.new("RGB",(3*W,2*(H+26)),"#292d41")
    draw=ImageDraw.Draw(board)
    for j,(f,title) in enumerate(zip(BEATS[level],("Seed","Unfurl","Bloom"))):
        for k,ground in enumerate(("#171a32","#f3eddf")):
            ox,oy=W*j,(H+26)*k
            base=Image.new("RGBA",(W,H),ground)
            base.alpha_composite(playback[f-1]); board.paste(base,(ox,oy))
            draw.text((ox+10,oy+H+6),f"{title}  /  {f:03d}",fill="#eee9dd")
    board.save(folder/"atlas-beats.jpg",quality=95)
    print(f"{stem}: {len(data['frames'])} frames, {len(pages)} sheets, margins L/T/R/B = {margins}")


def tendril(loc,side,length,start):
    ts=[i/66 for i in range(67)]
    pts=[]
    for t in ts:
        a=t*8.8; rr=.33*(1-.91*t)
        pts.append(V(loc)+V((side*(.48*t+rr*sin(a)),.15*sin(a),
                              .49*t+.33-rr*cos(a)))*length)
    o=cord("Seeking coil",pts,.021,wire,[1-.90*t for t in ts])
    def update(f):
        t=ramp(f,start,start+19); o.hide_render=t<.001; o.data.bevel_factor_end=max(.00001,t)
    ticks.append(update)


def corolla(t,a,q):
    # Five plicate sectors. Each opening phase untwists the angular coordinate,
    # spreads the lip, and bends its tips backwards, even halfway through bloom.
    ridge=cos(5*a)
    fold=(1+ridge)*.5
    theta=a+(1-q)*(2.14*t**.85)+(.84*t**.88)+.12*q*sin(5*a)*t*t
    closed=.067+.188*sin(pi*t)**.80*(.63+.37*t)-.045*t
    opened=.072+.17*t+.59*t**2.63
    r=(closed*(1-q)+opened*q)*(1+(.15*(1-q)+.105*q)*ridge*t)
    z=(1.27-.17*q)*t+(.095*q*(1-fold)-.18*q*fold**4)*t**4
    z+=.050*sin(5*a+.65)*q*t**3
    return V((r*cos(theta),r*sin(theta),z))


def pigment(t,a):
    fold=(1+cos(5*a))*.5
    base=mix((.020,.012,.10),(.97,.84,.67),ease((t-.13)/.65))
    base=mix(base,(.95,.93,.81),.53*ease((t-.54)/.39))
    # Ink in each spiral pleat broadens in the throat, thins to a pencil vein.
    ink=exp(-((1-fold)/(.085+.125*(1-t)))**1.38)
    base=mix(base,(.035+.09*t,.018+.049*t,.24+.21*t),ink*(.99-.11*t))
    vein=exp(-((sin(5*a+.75))/.16)**2)
    base=mix(base,(.29,.24,.51),vein*.29*sin(pi*t)**.65)
    base=mix(base,(.49,.66,.71),.22*(1-fold)*sin(t*pi)**2)
    return base


def bloom(loc,axis,sz,start,duration,phase):
    carrier=empty("Pedicel | bloom axis",loc)
    carrier.rotation_mode="QUATERNION"
    g=empty("Corolla | rolling axis",(0,0,0),carrier)
    n=100; m=25; l=8
    def skin(q):
        return [corolla(i/(m-1),T*j/n,q) for i in range(m) for j in range(n)]
    colors=[pigment(i/(m-1),T*j/n) for i in range(m) for j in range(n)]
    base=mesh("Single continuous pleated trumpet",skin(0),rings(n,m),porcelain,colors)
    base.parent=g
    def edging(q):
        vs=[]
        for j in range(n):
            a=T*j/n; p=corolla(1,a,q)
            d=(corolla(1,a+.001,q)-corolla(1,a-.001,q)).normalized()
            u=V((0,0,1)).cross(d).normalized(); v=d.cross(u)
            for k in range(l):
                e=T*k/l; vs.append(p+(.012+.010*q)*(u*cos(e)+v*sin(e)))
        return vs
    faces=[(j*l+k,((j+1)%n)*l+k,((j+1)%n)*l+(k+1)%l,j*l+(k+1)%l)
           for j in range(n) for k in range(l)]
    cols=[mix((.028,.65,.80),(.49,.19,.82),.5+.5*sin(3*T*j/n+.35)) for j in range(n) for k in range(l)]
    hem=mesh("Corolla | rolled iridescent lip",edging(0),faces,lip,cols); hem.parent=g
    keys=[]
    for ob,func in [(base,skin),(hem,edging)]:
        basis=ob.shape_key_add(name="Furled")
        mid=ob.shape_key_add(name="Turning"); mid.data.foreach_set("co",[x for p in func(.5) for x in p])
        end=ob.shape_key_add(name="Flared"); end.data.foreach_set("co",[x for p in func(1) for x in p])
        keys.append((mid,end))
    tassel=empty("Five stamens",(0,0,0),g)
    for i in range(5):
        a=phase+i*T/5; h=.76+.086*sin(2*a)
        ts=[k/16 for k in range(17)]
        pts=[((.018+.19*t**1.7)*cos(a+.34*t),(.018+.19*t**1.7)*sin(a+.34*t),.20+h*t) for t in ts]
        cord("Champagne filament",pts,.014,pistil,[1-.35*t for t in ts],tassel)
        ob=ball("Golden pollen sac",pts[-1],(.042,.028,.059),brass,tassel)
        ob.rotation_euler=(.37*sin(a),.37*cos(a),a)
    # Short tapered sepals clasp the outside of the unopened corolla.
    for k in range(5):
        a=T*k/5; vs=[]; fs=[]
        for i in range(15):
            t=i/14
            for j in [-1,0,1]:
                ang=a+j*.39*(sin(pi*t)**.60)+.34*t
                r=.079+.10*t+.027*cos(j*pi/2)*sin(pi*t)
                vs.append((r*cos(ang),r*sin(ang),.37*t-.038))
        for i in range(14):
            for j in [0,1]:
                u=3*i+j; fs.append((u,u+1,u+4,u+3))
        ob=mesh("Lanceolate sepal",vs,fs,stem); ob.parent=g
    direction=V(axis).normalized()
    def update(f):
        grow=ramp(f,start,start+duration*.41)
        q=ramp(f,start+duration*.28,start+duration)
        grow_scale(carrier,grow,sz)
        d=direction.lerp(V((0,-.16,.99)),.31*(1-q)).normalized()
        carrier.rotation_quaternion=d.to_track_quat("Z","Y")
        g.rotation_euler.z=phase+.90*(1-q)
        for mid,end in keys:
            mid.value=1-abs(2*q-1); end.value=max(0,2*q-1)
        grow_scale(tassel,.15+.85*q)
    ticks.append(update)

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action",choices=["render","proof","pack"])
    parser.add_argument("levels",nargs="*",type=int,default=[1,2,3])
    parser.add_argument("--frames",nargs="+",type=int,help="render a specific subset (one-based)")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else sys.argv[1:])
    if args.action!="pack": blender_init()
    for lv in args.levels:
        if args.action=="pack": pack(lv)
        else: render(lv,args.action=="proof",args.frames)
