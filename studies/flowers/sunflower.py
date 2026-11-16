"""The Solar Court: a deterministic, self-contained Blender sunflower triptych.

Blender: blender -b -t 5 -P studies/flowers/sunflower.py -- 3 [1 28 54 81 ...]
Without frame numbers render the whole level. Safe to resume with --missing.
System Python with Pillow: python studies/flowers/sunflower.py pack [1 2 3]
All animation is sampled analytically, so rendering frames out of order is safe.
Frame numbers in this file and the proof posters are one-based.
"""
import math
import random
import runpy
import sys
from math import sin, cos, pi, sqrt, radians
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'assets/videos/flower-studies'
OUT = ROOT / 'dist/assets/flower-studies'
COUNTS = {1: 66, 2: 78, 3: 92}
STILLS = {1: 57, 2: 68, 3: 81}


def pack(level):
    import json
    from PIL import Image, ImageDraw
    folder, stem = RAW/f'sunflower-{level}', f'sunflower-{level}'
    n = COUNTS[level]
    out = OUT
    out.mkdir(parents=True, exist_ok=True)
    packer = runpy.run_path(str(ROOT/'studies/ember-orca/pack-progression.py'))
    packer['pack_shot'](folder, out, stem, n)
    manifest = json.loads((out/f'{stem}.json').read_text())
    assert len(manifest['frames']) == n
    pages = [Image.open(out/name).convert('RGBA') for name in manifest['sheets']]
    margins = [480, 360, 480, 360]
    checks = [1, round(n*.18), round(n*.31), round(n*.46), round(n*.59),
              round(n*.71), STILLS[level], n]
    proof = Image.new('RGB',(4*320,2*240))
    frame_signatures = []
    for i, rect in enumerate(manifest['frames'], 1):
        assert rect, f'Empty frame: {stem} {i}'
        page, x, y, w, h, left, top = rect
        with Image.open(folder/f'{i:03}.png') as source:
            assert source.size == (480, 360) and source.mode == 'RGBA'
            alpha = source.getchannel('A')
            assert alpha.getextrema() == (0, 255)
            tile = pages[page].crop((x,y,x+w,y+h))
            assert tile.getchannel('A').tobytes() == alpha.crop((left,top,left+w,top+h)).tobytes()
            # Reconstruct selected poses from the actual atlas, in stage coordinates.
            if i in checks:
                stage=Image.new('RGB',source.size,('#2a2933' if checks.index(i)%2==0 else '#e1d4be'))
                stage.paste(tile,(left,top),tile)
                ImageDraw.Draw(stage).text((12,12),f'L{level}   {i:03d}',fill=('#eddcaa' if checks.index(i)%2==0 else '#4b392a'))
                slot=checks.index(i)
                proof.paste(stage.resize((320,240),Image.Resampling.LANCZOS),(320*(slot%4),240*(slot//4)))
            import hashlib
            frame_signatures.append(hashlib.sha256(source.tobytes()).digest())
        margins = list(map(min, margins, [left,top,480-left-w,360-top-h]))
    assert min(margins) >= 8, (stem, margins)
    assert len(set(frame_signatures)) > .76*n, 'Too few distinct poses'
    assert len(set(frame_signatures[-5:])) == 1, 'Last five frames must hold the tableau'
    proof.save(folder/'poses.jpg',quality=95)
    with Image.open(folder/f'{STILLS[level]:03}.png') as still:
        still.save(out/f'{stem}-poster.png')
    print(stem, n, 'frames;', len(pages), 'sheets; minimum L/T/R/B margins:', margins)


if __name__ == '__main__' and 'pack' in sys.argv:
    for lev in list(map(int,sys.argv[sys.argv.index('pack')+1:])) or COUNTS:
        pack(lev)
    sys.exit()

import bpy
from mathutils import Vector as V, Matrix

TAU = 2*pi
PHI = pi*(3-sqrt(5))
def clamp(x): return min(1., max(0.,x))
def ease(a,b,x):
    q=clamp((x-a)/(b-a))
    return q*q*(3-2*q)
def lrp(a,b,t): return a*(1-t)+b*t
def rgb(code):
    s = [int(code[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in s)
def mix(a,b,t): return tuple(lrp(x,y,t) for x,y in zip(a,b))
def tint(a,v): return tuple(max(0,x*v) for x in a)
def norm(v): return V(v).normalized()
def axes(x,y,z):
    return Matrix((x,y,z)).transposed().to_quaternion()
def unit_axes(): return V((1,0,0)),V((0,1,0)),V((0,0,1))
def aim(o,target): o.rotation_euler=(V(target)-o.location).to_track_quat('-Z','Y').to_euler()


class Geo:
    """One coloured surface. Data may be shared by many posed instances."""
    def __init__(self):
        self.v=[]; self.f=[]; self.c=[]
    def pt(self,p,col):
        self.v.append(tuple(p)); self.c.extend((*col,1.)); return len(self.v)-1
    def grid(self,rows,wrap=False):
        for lo,hi in zip(rows,rows[1:]):
            for j in range(len(lo) if wrap else len(lo)-1):
                k=(j+1)%len(lo)
                self.f.append((lo[j],lo[k],hi[k],hi[j]))
    def mesh(self,name,mat):
        m=bpy.data.meshes.new(name)
        m.from_pydata(self.v,[],self.f); m.update()
        m.polygons.foreach_set('use_smooth',[True]*len(m.polygons))
        attr=m.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
        attr.data.foreach_set('color',self.c)
        m.materials.append(mat)
        return m

def obj(name,data):
    o=bpy.data.objects.new(name,data); bpy.context.scene.collection.objects.link(o)
    o.rotation_mode='QUATERNION'
    return o

def place(o,loc,rot,sc):
    o.location=loc; o.rotation_quaternion=rot
    if isinstance(sc,(float,int)): sc=(sc,)*3
    o.scale=sc
    o.hide_render=max(abs(v) for v in sc)<.001

def shader(name,rough,grain,metal=0,emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    nd=m.node_tree.nodes; link=m.node_tree.links.new
    b=nd.get('Principled BSDF'); b.inputs['Roughness'].default_value=rough
    b.inputs['Metallic'].default_value=metal
    b.inputs['Specular IOR Level'].default_value={'silk':.21,'disk':.13,'leaf':.29}.get(name,.38)
    col=nd.new('ShaderNodeVertexColor'); col.layer_name='Pigment'
    link(col.outputs['Color'],b.inputs['Base Color'])
    if emission:
        link(col.outputs['Color'],b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value=emission
    noise=nd.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=grain
    noise.inputs['Detail'].default_value=2
    bump=nd.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.13
    bump.inputs['Distance'].default_value=.008
    link(noise.outputs['Fac'],bump.inputs['Height']); link(bump.outputs[0],b.inputs['Normal'])
    return m

def stage():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene; s.render.engine='CYCLES'
    s.cycles.device='CPU'; s.cycles.samples=12
    s.cycles.use_denoising=True; s.cycles.max_bounces=3; s.cycles.diffuse_bounces=2
    s.cycles.glossy_bounces=1; s.cycles.use_adaptive_sampling=False
    s.render.threads_mode='FIXED'; s.render.threads=5; s.render.use_persistent_data=True
    s.render.film_transparent=True; s.render.resolution_x=480; s.render.resolution_y=360
    s.render.resolution_percentage=100; s.render.fps=24; s.render.image_settings.file_format='PNG'
    s.render.image_settings.color_mode='RGBA'; s.render.image_settings.color_depth='8'
    s.render.image_settings.compression=28
    s.world=bpy.data.worlds.new('Warm open shade'); s.world.use_nodes=True
    sky=s.world.node_tree.nodes.get('Background'); sky.inputs[0].default_value=(.64,.76,1,1)
    sky.inputs[1].default_value=.29
    s.view_settings.view_transform='AgX'; s.view_settings.look='AgX - Medium High Contrast'
    cam=obj('Herbarium | fixed lens',bpy.data.cameras.new('Portrait box'))
    cam.rotation_mode='XYZ'; cam.location=(0,-12,3.38); aim(cam,(0,0,2.12))
    cam.data.type='ORTHO'; cam.data.ortho_scale=6.64; s.camera=cam
    for name,p,power,size,color in [
        ('Low honey sun',(-3.6,-4.8,6.7),520,3.6,(1,.86,.58)),
        ('Skylight',(3.2,-3.8,4.4),235,4.3,(.73,.85,1)),
        ('Gilt edge',(1.8,2.2,5.9),590,3.0,(1,.77,.38)),
        ('Bounce on shell',(-2,-2,.9),50,2.7,(1,.89,.68))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power; d.shape='DISK'; d.size=size; d.color=color
        o=obj(name,d); o.rotation_mode='XYZ'; o.location=p; aim(o,(0,0,2))
    return s


def hull(side):
    g=Geo(); rows=[]; inner=[]
    black,brown,ivory,heart=map(rgb,['252532','534137','ebd4ac','9e764c'])
    for i in range(29):
        u=i/28
        profile=max(.006,sin(pi*u))**.68*(1.32-.69*u)
        row=[]; inside=[]
        for j in range(73):
            a=-pi/2+pi*j/72+(0 if side==1 else pi)
            d=a+.068*sin(4*u+.5)+.035*sin(7*u-2*a)
            stripe=(.5+.5*cos(15*d+1.8*sin(3*d)))**4.4
            stripe*=.62+.38*(.5+.5*cos(7*d))
            col=mix(mix(black,brown,.4+.25*cos(9*a)),ivory,stripe)
            x=.255*profile*cos(a); y=.157*profile*sin(a); z=.65*u
            row.append(g.pt((x,y,z),col))
            inside.append(g.pt((x*.92,y*.90,z),mix(heart,ivory,.4+.2*sin(a))))
        rows.append(row); inner.append(inside)
    g.grid(rows); g.grid([r[::-1] for r in inner])
    for j in (0,72): g.grid([[r[j],s[j]] for r,s in zip(rows,inner)])
    return g.mesh('Longitudinally striped pericarp',M['husk'])


def blade(variant):
    """Broad cordate leaf with serration, a puckered surface and raised venation."""
    g=Geo(); rows=[]; rng=random.Random(211+variant)
    dark,light,rib=map(rgb,[('246343','508b46','bed078'),('376e34','75973c','cad878'),
                             ('1c5840','49854d','b4c478')][variant%3])
    def surf(t,q):
        # The shoulders project back from the petiole (heart-shaped leaf base).
        w=(max(.002,sin(pi*(t**.64))))**.84*(.356+.024*variant)
        edge=(1-.069*(.5+.5*cos(2*pi*t*13))**2*abs(q)**4)
        a=t-.26*sin(pi*t)**.62*(1-t)**2*abs(q)**1.2
        b=q*w*edge+.026*sin(pi*t)*sin(t*5+variant)
        c=.18*sin(pi*t)-.25*t**3+.078*(1-abs(q)) * sin(pi*t)**.5
        c+=(.030*sin(9*pi*t-2.5*abs(q)+variant)*abs(q)**1.3+.10*q*(t-.3))*sin(pi*t)
        return V((a,b,c))
    for i in range(53):
        t=i/52; row=[]
        for j in range(13):
            q=(j-6)/6; p=surf(t,q)
            col=mix(dark,light,clamp(.23+.42*t+.14*q+.10*cos(9*pi*t-2.5*abs(q))))
            row.append(g.pt(p,tint(col,.90+.10*rng.random())))
        rows.append(row)
    g.grid(rows)
    g.f=[tuple(reversed(f)) for f in g.f]
    def vein(fn,rad,col):
        rows=[]
        for i in range(15):
            t=i/14; p=fn(t); w=rad*(1-.89*t)
            rows.append([g.pt(p+V((0,w*cos(j*TAU/6),.003+w*sin(j*TAU/6))),col) for j in range(6)])
        g.grid(rows,True)
    vein(lambda t:surf(.01+.96*t,0),.012,rib)
    for t0 in (.12,.235,.37,.52,.67,.79):
        for side in (-1,1):
            def line(t): return surf(t0+.22*(1-t0)*t+.036*t*t,side*.88*t)
            vein(line,.0057,mix(light,rib,.62))
    return g.mesh('Cordate, penninerved blade',M['leaf'])


def ray(variant,bract=False):
    g=Geo(); rows=[]
    palette=[('a84d06','fbaa05','ffdb39'),('873707','eb8d07','ffc323'),
             ('bb5207','ffbf0b','ffe454'),('9a4106','f09d0a','ffcb26')]
    a,b,c=map(rgb,('245925','5e8b30','a6ad4a') if bract else palette[variant%4])
    for i in range(21):
        t=i/20; row=[]
        for j in range(9):
            q=(j-4)/4
            w=(.037*(1-t)+.133*max(.001,sin(pi*t**1.22))**.82)
            w*=1.38 if bract else 1
            # Cupped throat, long parallel pleats, slight ligulate twist, pointed tip.
            x=t-.018*abs(q)*t**7
            y=q*w+(.018+.010*variant)*sin(pi*t)*sin(pi*t+variant)
            z=.094*sin(pi*t)-(.072+.010*variant)*t**3+.068*q*q*sin(pi*t)
            z+=.019*q*sin(t*4+variant)+.018*cos(pi*q*3)*sin(pi*t)**.7
            base=mix(a,b,ease(0,.52,t)); base=mix(base,c,ease(.41,1,t)*.88)
            col=tint(base,.89+.09*cos(3*pi*q)+.065*q+.035*sin(t*4+variant))
            row.append(g.pt((x,y,z),col))
        rows.append(row)
    g.grid(rows)
    # Open sheet, normal toward head normal.
    g.f=[tuple(reversed(f)) for f in g.f]
    return g.mesh('Ribbed ligule' if not bract else 'Keeled phyllary',M['leaf' if bract else 'silk'])


def dome(radius,r):
    return radius*(.08+.34*max(0,1-r*r)**.72)

def disk_model(n,seed):
    """A woven capitulum. Individual grains stand normal to a shallow convex disk."""
    g=Geo(); rng=random.Random(seed)
    soil,heart,bronze,honey=map(rgb,['1d151c','2a191e','79411b','efab29'])
    rows=[]
    for j in range(19):
        r=max(.001,j/18)
        rows.append([g.pt((r*cos(a*TAU/72),r*sin(a*TAU/72),dome(1,r)),mix(soil,bronze,.30*r**3))
                     for a in range(72)])
    g.grid(rows,True)
    g.f=[tuple(reversed(f)) for f in g.f]
    # Dark red-brown seeds shift to little ochre, five-lobed florets at the rim.
    for i in range(n):
        r=sqrt((i+.4)/n)*.98; a=i*PHI+.13
        p=V((r*cos(a),r*sin(a),dome(1,r)))
        ax=V((cos(a+.61),sin(a+.61),0)); ay=V((-ax.y,ax.x,0)); az=V((0,0,1))
        w=(.83+r*.22)/sqrt(n); outer=r>.82
        h=w*((1.72+.41*rng.random()) if outer else (.74+.47*r))
        base=mix(heart,bronze,.04+.27*r*r+.19*rng.random())
        tip=mix(bronze,honey,.62+.36*rng.random()) if outer else mix(base,rgb('af7950'),.05+.16*rng.random())
        rs=[]
        for z,breadth,k in ((-.23,.79,0),(.29,1,.38),(.85,.63,1),(1,.16,.52)):
            row=[]
            for j in range(10):
                ang=TAU*j/10
                crown=.43*(j%2) if outer and k==1 else 0
                row.append(g.pt(p+ax*(w*1.13*breadth*cos(ang))+ay*(w*.78*breadth*sin(ang))+
                                az*(h*(z+crown)),mix(base,tip,k)))
            rs.append(row)
        g.grid(rs,True); g.f.append(tuple(rs[-1]))
    return g.mesh('Fibonacci capitulum | '+str(n)+' florets',M['disk'])

def involucre():
    """A fleshy green receptacle; imbricated keeled bracts continue around its rim."""
    g=Geo(); rows=[]; a,b=map(rgb,['32532d','83a53f'])
    for i in range(17):
        t=i/16; r=.05+.32*sin(.57*pi*t)**.86
        row=[]
        for j in range(54):
            ang=j*TAU/54; keel=(.5+.5*cos(9*ang-t))**3
            w=r*(.94+.06*keel)
            row.append(g.pt((w*cos(ang),w*sin(ang),-.33+.40*t),
                            mix(a,b,.14+.43*keel+.20*t)))
        rows.append(row)
    g.grid(rows,True)
    return g.mesh('Fluted green receptacle',M['leaf'])


def tube_geo(pts,radii):
    g=Geo(); rows=[]; a,b=map(rgb,['38703b','9ab059'])
    for i,(p,r) in enumerate(zip(pts,radii)):
        u=norm(pts[min(i+1,len(pts)-1)]-pts[max(0,i-1)])
        x=norm(V((0,1,0)).cross(u)); y=u.cross(x)
        row=[]
        for j in range(14):
            th=j*TAU/14
            row.append(g.pt(p+(x*cos(th)+y*sin(th))*r,
                             mix(a,b,.23+.18*cos(3*th)+.12*cos(th))))
        rows.append(row)
    g.grid(rows,True); g.f.extend((tuple(rows[0][::-1]),tuple(rows[-1])))
    return g

def pollen_geo():
    g=Geo(); rows=[]; c,d=map(rgb,['de8824','ffdf67'])
    for i in range(7):
        a=pi*i/6; row=[]
        for j in range(10):
            t=j*TAU/10; w=max(.02,sin(a))*(1+.13*cos(5*t))
            row.append(g.pt((w*cos(t),w*sin(t),1.24*cos(a)),mix(c,d,.5+.38*cos(a)+.1*cos(t))))
        rows.append(row)
    g.grid(rows,True); return g.mesh('Faceted pollen grain',M['pollen'])

def build_stalk(name):
    pts=[V((0,0,i/24)) for i in range(25)]
    return obj(name,tube_geo(pts,[.05]*25).mesh(name,M['leaf']))

def pose_stalk(o,fn,frac,width):
    o.hide_render=frac<.009
    if o.hide_render: return
    us=[frac*i/24 for i in range(25)]; pts=[fn(u) for u in us]
    rs=[width*(1-.57*u)*ease(-.16,.12,frac)**.6 for u in us]
    # Vertices only: the topology and the longitudinal pigments stay the same.
    vals=[]
    for i,(p,r) in enumerate(zip(pts,rs)):
        u=norm(pts[min(i+1,24)]-pts[max(0,i-1)])
        x=norm(V((0,1,0)).cross(u)); y=u.cross(x)
        for j in range(14):
            a=j*TAU/14; vals.extend(p+(x*cos(a)+y*sin(a))*r)
    o.data.vertices.foreach_set('co',vals); o.data.update()


class Head:
    def __init__(self,name,R,kind,seed):
        rng=random.Random(seed); self.R=R; self.kind=kind
        self.r0={'crown':.455,'young':.355,'lady':.355,'bud':.33}[kind]
        n={'crown':513,'young':220,'lady':162,'bud':80}[kind]
        self.disk=obj(name+' | velvet and amber',disk_model(n,seed))
        self.cup=obj(name+' | fluted involucre',CUP); self.pet=[]
        # Back phyllaries, long outer rays, middle rays and a short bright inner collar.
        counts=([12,26,24,20] if kind=='crown' else [10,19,16,0] if kind=='young'
                else [10,18,14,0] if kind=='lady' else [12,16,0,0])
        for layer,count in enumerate(counts):
            for j in range(count):
                a=TAU*(j+.45*(layer%2))/count+rng.uniform(-.025,.025)
                variant=rng.randrange(4)
                o=obj(name+(' | phyllary' if layer==0 else ' | ray'),(BRACTS if layer==0 else RAYS)[variant])
                self.pet.append((o,layer,a,rng.uniform(.93,1.07),rng.uniform(-.07,.07),rng.uniform(.90,1.16)))
    def pose(self,p,yaw,elev,roll,growth,t,opening):
        n=V((sin(yaw)*cos(elev),-cos(yaw)*cos(elev),sin(elev)))
        h=V((cos(yaw),sin(yaw),0)); v=n.cross(h)
        h,v=h*cos(roll)+v*sin(roll),v*cos(roll)-h*sin(roll)
        R=self.R*growth; rs=self.r0
        # Receptacle and disk expand as the encircling rays break bud.
        dc=R*(.47+.53*ease(.04,.91,opening))*rs
        place(self.disk,p+n*(.06*R),axes(h,v,n),dc)
        place(self.cup,p,axes(h,v,n),R*(.93+.07*opening))
        for o,k,a,var,bias,wide in self.pet:
            delay=(.044*(1+sin(a+1))+.028*(1+cos(3*a+.55))+max(0,k-1)*.10)
            op=ease(delay,.79+delay,opening)
            if self.kind=='bud': op*=.72
            tilt=lrp([1.79,1.47,1.49,1.50][k],[-.48,-.10,.09,.33][k]+bias,op)
            tilt+=.12*sin(pi*op*2)*sin(a*2+.6)
            radial=h*cos(a)+v*sin(a); side=-h*sin(a)+v*cos(a)
            x=radial*cos(tilt)+n*sin(tilt); z=x.cross(side)
            reach=[.69,1.0,.89,.71][k]*var
            length=(reach-(.17 if k==0 else rs*.74))*R*((1.04-.04*op) if k==0 else (.47+.53*op))
            off=R*(lrp(.345,.27,op) if k==0 else rs*.75*(.74+.26*op))
            position=p+radial*off+n*R*[-.039,.006,.045,.085][k]
            place(o,position,axes(x,side,z),(length,length*wide*(1.87 if k==0 else 1.0),length))


def base_path(level,u,t):
    # An arc-length-like growth coordinate traces a hook, then the mature stalk
    # recoils from the left-hand bow to present the disk to the afternoon light.
    ht={1:2.43,2:3.00,3:3.11}[level]
    bow=(ease(.17,.43,t)*(1-ease(.42,.72,t)))
    shape={1:.35,2:1.84,3:1.98}[level]
    x=(.08*u+.15*sin(TAU*u-.4)*u + {1:-.13,2:.24,3:.05}[level]*u*u
       -shape*bow*u**1.65)
    x+=.13*sin(pi*u)*ease(.28,.72,t)+.08*sin(pi*ease(.51,.86,t))*u**3
    z=.029+ht*(u-(.08+.31*bow)*u**4)+(.08*ht)*u**3*ease(.43,.74,t)
    z-=.15*bow*sin(pi*u)*u
    return V((x,.11*sin(pi*u)+.035*u,z))

def local_branch(fn,u,side,span,rise,depth,hook=0):
    root=fn(u)
    def path(q):
        return root+V((side*span*(q*(1.42-.42*q)),depth*sin(q*pi/2),
                       rise*(.36*q+.64*q*q)+hook*sin(pi*q)))
    return path

class Leaf:
    def __init__(self,u,sign,length,slope,angle,variant):
        self.u,self.sign,self.length,self.slope,self.angle,self.var=u,sign,length,slope,angle,variant
        self.o=obj('Broad blade',LEAVES[variant%len(LEAVES)])
        self.petiole=build_stalk('Petiole')
    def pose(self,path,grow,t,wind=0):
        u,sign=self.u,self.sign
        s=ease(u-.008,u+.19,grow)
        anchor=path(u)
        rise=lrp(1.40,self.slope,s)+.11*sin(pi*s*2)+wind
        x=norm((sign*cos(rise),-.10-.075*self.var,sin(rise)))
        y=norm(V((0,-1,.31)).cross(x)); z=x.cross(y)
        th=self.angle+.1*sin(pi*s)
        y,z=y*cos(th)+z*sin(th),z*cos(th)-y*sin(th)
        tip=anchor+V((sign*.20,-.056,.10))*s*self.length
        def stalk(q): return anchor+(tip-anchor)*q+V((0,0,.034))*sin(pi*q)*s
        pose_stalk(self.petiole,stalk,s,.028*self.length)
        place(self.o,stalk(s),axes(x,y,z),(s*self.length,s*self.length*(.48+.52*s),s*self.length))


def construct(lev):
    rng=random.Random(633+lev)
    stem=build_stalk('Helianthe | central stalk')
    shells=[obj('Hull | '+str(s),hull(s)) for s in (-1,1)]
    hero=Head('Sol', {1:.91,2:.99,3:1.15}[lev], 'crown' if lev==3 else 'young',310+lev)
    designs={
      1:[(.13,-1,.69,.42,.30,0),(.22,1,.82,.26,-.57,2),(.42,-1,.99,.29,-.18,1),(.62,1,.81,.64,.59,0)],
      2:[(.10,-1,.64,.27,-.40,1),(.19,1,.98,.29,-.67,2),(.37,-1,1.26,.24,.31,0),
         (.53,1,1.05,.45,-.42,1),(.73,-1,.74,.52,-.53,1)],
      3:[(.07,-1,.72,.27,.48,1),(.14,1,.88,.21,-.35,2),(.26,-1,1.26,.30,-.57,0),
         (.33,1,1.34,.34,.42,1),(.51,-1,.94,.64,.33,1),(.67,1,.78,.69,-.53,2)]}
    leaves=[Leaf(*args) for args in designs[lev]]; branches=[]
    # u, direction, span, rise, depth, departure, duration, radius, type, yaw
    layout={1:[],2:[(.45,-1,1.18,.88,.17,.37,.35,.70,'bud',-46)],
            3:[(.24,-1,1.77,1.51,.23,.24,.33,.70,'lady',-29),
               (.32,1,1.48,.88,-.04,.34,.34,.76,'lady',31)]}[lev]
    for i,spec in enumerate(layout):
        branches.append((spec,build_stalk('Lateral flowering stalk'),Head('Attendant '+str(i+1),spec[7],spec[8],420+i),
                         Leaf(.53,spec[1],.65 if lev==2 else .77,.55,-.42+.73*i,i)))
    grains=[]
    for i in range({1:7,2:14,3:52}[lev]):
        o=obj('Carried pollen',POLLEN)
        grains.append((o,rng.random(),rng.random(),rng.random(),rng.random(),rng.random()))
    def pose(frame):
        t=(frame-1)/(COUNTS[lev]-1)
        # Freeze the last tableau for a clean landing. Pollen lands with the plant.
        t=min(t,.91)
        split=ease(.055,.28,t); settle=ease(.23,.53,t)
        for i,(side,o) in enumerate(zip((-1,1),shells)):
            q=Matrix.Rotation(radians(-14+side*(48*split+12*settle)),3,'Y').to_quaternion()
            p=V((.044*(1-split)+side*.009*split,-.055+.04*i,.023))
            place(o,p,q,1-.36*settle)
        growth=ease(.096,{1:.61,2:.66,3:.67}[lev],t)
        def path(u): return base_path(lev,u,t)
        pose_stalk(stem,path,growth,{1:.059,2:.069,3:.085}[lev])
        for leaf in leaves: leaf.pose(path,growth,t,-.15*sin(pi*ease(.32,.67,t)))
        g=.25*ease(.11,.31,t)+.75*ease(.31,.66,t)
        opening=ease({1:.39,2:.48,3:.54}[lev],{1:.80,2:.83,3:.87}[lev],t)
        turn=ease(.39,.79,t)
        yaw=radians(lrp(-57,{1:-9,2:20,3:4}[lev],turn))
        elev=radians(lrp(58,13,turn)-27*sin(pi*ease(.22,.64,t)))
        hero.pose(path(growth),yaw,elev,radians(lrp(-32,4,turn)),g,t,opening)
        centers=[(path(growth),hero.R)]
        for spec,o,head,leaf in branches:
            u,sgn,span,rise,dep,start,dur,R,kind,y=spec
            bg=ease(start,start+dur,t)*ease(u,u+.12,growth)
            bow=sin(pi*bg)*(.34 if lev==3 else .16)
            branch=local_branch(path,u,sgn,span*(1+.15*bow),rise*(1-bow),dep,-.16-bow*.28)
            p=branch(bg)
            pose_stalk(o,branch,bg,.045 if lev==2 else .061)
            leaf.pose(branch,bg,t)
            hg=.23*ease(.04,.33,bg)+.77*ease(.26,.95,bg)
            bo=ease(start+.12,start+dur+.09,t)*(1 if kind!='bud' else .38)
            head.pose(p,radians(y-18*(1-bg)),radians(lrp(63,22 if lev==3 else 43,bg)),
                      radians(sgn*13),hg,t,bo)
            centers.append((p,R))
        for i,(o,a,b,c,d,e) in enumerate(grains):
            k=(i%len(centers)) if lev==3 else 0
            center,R=centers[k]
            born=(.69 if k==0 else .60)+.12*a
            life=.13+.09*b; f=(t-born)/life
            vis=ease(0,.17,f)*(1-ease(.68,1,f)); f=clamp(f)
            angle=.31+2.49*c if k==0 else -.24+3.6*c
            drift=R*(.43+.78*f+.16*d+.13*sin(f*pi*2+a*6))
            lift=sin(angle)*drift+.31*f-.23*f*f
            # Roll the high stream sideways around the disk: loose grains never
            # escape the crown into the top of frame, even between hero poses.
            excess=max(0,lift-.90*R)
            lift=lift-excess+.18*R*(1-math.exp(-excess/(.18*R)))
            p=center+V((cos(angle)*drift+.24*f+excess*(.62+.20*b),-.28-.15*b,lift))
            place(o,p,Matrix.Rotation(4*a+f*6,3,'Y').to_quaternion(),(.010+.017*e)*vis)
    return pose


def main():
    global M,BRACTS,RAYS,LEAVES,POLLEN,CUP
    args=sys.argv[sys.argv.index('--')+1:]; lev=int(args[0]); n=COUNTS[lev]
    folder=RAW/f'sunflower-{lev}'; folder.mkdir(exist_ok=True,parents=True)
    selected=[int(a) for a in args[1:] if a!='--missing'] or list(range(1,n+1))
    if '--missing' in args: selected=[i for i in selected if not (folder/f'{i:03}.png').exists()]
    if not selected: return
    assert all(1<=i<=n for i in selected)
    scene=stage(); scene.frame_start=1; scene.frame_end=n
    M={k:shader(k,r,g,m,e) for k,r,g,m,e in [
        ('husk',.35,95,.08,0),('leaf',.50,72,0,0),('silk',.41,98,.03,.025),
        ('disk',.58,85,0,0),('pollen',.38,120,.08,.28)]}
    LEAVES=[blade(i) for i in range(3)]; RAYS=[ray(i) for i in range(4)]
    BRACTS=[ray(i,True) for i in range(4)]; POLLEN=pollen_geo(); CUP=involucre()
    pose=construct(lev)
    for f in selected:
        scene.frame_set(f); pose(f)
        scene.render.filepath=str(folder/f'{f:03}.png')
        bpy.ops.render.render(write_still=True)
        print(f'Solar Court {lev}: {f}/{n}',flush=True)

if __name__=='__main__': main()
