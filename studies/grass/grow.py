"""Four transparent Blender studies for the base of a Word Woods flower.

blender -b --factory-startup -t 6 --python-exit-code 1 -P studies/grass/grow.py -- render
python studies/grass/grow.py pack
Use 'poster' in place of 'render' to check all four mature poses first.
"""
import math
import random
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / 'assets/videos/meadow-grass'
PUBLIC = ROOT / 'dist/assets/grass-studies'
KINDS = ('dew', 'honey', 'clover', 'bells')
W, H, COUNT, FPS, COLS = 500, 180, 48, 20, 8
PI = math.pi
TAU = PI * 2


def pack(kinds):
    from PIL import Image
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for kind in kinds:
        sheet = Image.new('RGBA', (W * COLS, H * (COUNT // COLS)))
        for frame in range(COUNT):
            with Image.open(RAW / kind / ('%03d.png' % frame)) as image:
                assert image.mode == 'RGBA' and image.size == (W, H)
                sheet.paste(image, ((frame % COLS) * W, (frame // COLS) * H))
                if frame == COUNT-1:
                    image.save(PUBLIC / (kind + '-still.webp'), quality=92, method=6)
        sheet.save(PUBLIC / (kind + '-frames.webp'), quality=86, method=6)
        print(kind, COUNT, 'frames', (PUBLIC / (kind + '-frames.webp')).stat().st_size, 'bytes')


if '--' not in sys.argv:
    if sys.argv[1:2] != ['pack']:
        raise SystemExit(__doc__)
    pack(sys.argv[2:] or KINDS)
    raise SystemExit

import bpy
from mathutils import Vector


def V(x, y, z):
    return Vector((x, y, z))


def ease(start, end, t):
    v = min(1., max(0., (t-start)/(end-start)))
    return v*v*(3-2*v)


def pigment(hexcode):
    def linear(v):
        return v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4
    return tuple(linear(int(hexcode[i:i+2], 16)/255.) for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(x+(y-x)*t for x,y in zip(a,b))


PALETTES = {
    'dew': ('115d4f', '16965d', '3ac778', 'b1ed50'),
    'honey': ('206553', '368847', '79bb39', 'd6df47'),
    'clover': ('056c60', '149b69', '55ce70', 'b2ef83'),
    'bells': ('115a62', '008e80', '32bc97', '8fe6a0')
}
GREEN = {k: tuple(map(pigment, p)) for k,p in PALETTES.items()}
GOLD = tuple(map(pigment, ('93602c','efa73a','ffcd54','fff0a0')))
BLUE = tuple(map(pigment, ('533090','7752d3','a380ff','dad0ff')))
PERIWINKLE = tuple(map(pigment, ('334995','506edc','86a4ff','e0dcff')))
PINK = tuple(map(pigment, ('aa3d6c','f57696','ffc2a4')))
AQUA = tuple(map(pigment, ('177777','43d7ba','c0ffeb','fffcce')))


class Geometry:
    def __init__(self):
        self.vertices, self.colors, self.faces = [], [], []

    def point(self, p, color):
        self.vertices.append(tuple(p))
        self.colors.append((*color,1))
        return len(self.vertices)-1

    def surface(self, rows):
        for a,b in zip(rows,rows[1:]):
            for i in range(len(a)-1):
                self.faces.append((a[i],a[i+1],b[i+1],b[i]))

    def mesh(self):
        mesh = bpy.data.meshes.new('Growing foliage')
        mesh.from_pydata(self.vertices, [], self.faces)
        mesh.update()
        if not self.vertices:
            return mesh
        if hasattr(mesh, 'color_attributes'):
            layer = mesh.color_attributes.new('Pigment','FLOAT_COLOR','POINT')
            layer.data.foreach_set('color',[v for c in self.colors for v in c])
        else:
            # Legacy Blender stores vertex paint in display space; the shader reads it as linear.
            def display(v): return 12.92*v if v<.0031308 else 1.055*v**(1/2.4)-.055
            colors=[(*[display(v) for v in c[:3]],1) for c in self.colors]
            layer = mesh.vertex_colors.new(name='Pigment')
            layer.data.foreach_set('color',[v for loop in mesh.loops for v in colors[loop.vertex_index]])
        return mesh


def tube(g, points, radius, color):
    rows = []
    for k,p in enumerate(points):
        t = k / (len(points)-1)
        tangent = (points[min(k+1,len(points)-1)] - points[max(0,k-1)]).normalized()
        side = tangent.cross(V(0,1,0))
        if side.length < .001: side = V(1,0,0)
        side.normalize()
        other = tangent.cross(side).normalized()
        row = []
        for i in range(6):
            a = TAU*i/5
            row.append(g.point(p + (side*math.cos(a)+other*math.sin(a))*radius(t),color(t)))
        rows.append(row)
    g.surface(rows)


def oval(g, centre, scale, colors):
    rows=[]
    for j in range(7):
        v=PI*j/6
        row=[]
        for i in range(11):
            a=TAU*i/10
            nx,ny,nz=math.sin(v)*math.cos(a),math.sin(v)*math.sin(a),math.cos(v)
            light=max(0.,-.42*nx-.64*ny+.58*nz)
            c=mix(colors[0], colors[1], .22+.78*light)
            if len(colors)>2: c=mix(c,colors[2],light**9)
            row.append(g.point(centre+V(nx*scale[0],ny*scale[1],nz*scale[2]),c))
        rows.append(row)
    g.surface(rows)


def blade(g, root, height, lean, depth, width, age, wind, pal, phase):
    if age < .012: return root
    rows=[]
    twist=.42*math.sin(phase)
    tip=root
    for j in range(10):
        u=j/9
        t=u*age
        tip=root+V(lean*t**1.58+wind*t*t,depth*t*t,
                   height*(1.27*t-.27*t*t) - abs(lean)*.25*t**3)
        r=width*(.22+.78*math.sin(PI*(.09+.91*u))**.73)*(1-u**4)*math.sqrt(age)
        axis=V(math.cos(twist+t*.65),math.sin(twist+t*.65),0)*r
        color=mix(pal[1],pal[2],.18+.78*t)
        rows.append([g.point(tip-axis,mix(pal[0],color,.13+.40*t)),
                     g.point(tip-V(0,r*.55,0),mix(color,pal[3],.42+.25*t)),
                     g.point(tip+axis,mix(color,pal[3],.04+.14*t))])
    g.surface(rows)
    return tip


def stalk(g, root, vector, curl, age, width, pal):
    def position(u):
        t=u*age
        return root+V(vector.x*t+curl*t*t,vector.y*t,vector.z*(t+.17*math.sin(PI*t)))
    points=[position(i/9) for i in range(10)]
    tube(g,points,lambda t:width*(1-.5*t),lambda t:mix(pal[0],pal[2],t*.85))
    return points[-1]


def foxtail(g, root, height, drift, age, sway, rng):
    stem=stalk(g,root,V(drift*.43,0,height*.69),drift*.14+sway,age,.019,GREEN['honey'])
    reveal=ease(.37,.96,age)
    if reveal<.02: return
    tip=V(drift*.72+sway*.45,0,height*.47)*reveal
    points=[stem+tip*t+V(0,0,.09*math.sin(PI*t)*reveal) for t in [i/12 for i in range(13)]]
    tube(g,points,lambda t:(.018+.036*math.sin(PI*t))*reveal,lambda t:mix(GOLD[0],GOLD[2],t))
    for i in range(25):
        t=(i+.4)/26
        a=i*2.4
        s=(.045+.14*math.sin(PI*t)**.72)*reveal
        base=stem+tip*t+V(0,0,.09*math.sin(PI*t)*reveal)
        off=V(math.cos(a)*s,math.sin(a)*s*.66,s*.54)
        centre=base+off*.51
        size=(.042+.011*rng.random())*reveal
        oval(g,centre,(size,size*.64,size*1.25),[GOLD[0],GOLD[1+i%2],GOLD[3]])
        tube(g,[centre,base+off,base+off*1.45+V(.036*drift,0,.105)*reveal],
             lambda u:.009*reveal*(1-.87*u),lambda u:mix(GOLD[1],GOLD[3],u))


def shamrock(g, root, size, age, wind, angle):
    end=stalk(g,root,V(.10*math.cos(angle)+wind,.08*math.sin(angle),size*2.45),wind,age,.016,GREEN['clover'])
    unfurl=ease(.3,.99,age)
    if unfurl<.02: return
    pal=GREEN['clover']
    for leaf in range(3):
        theta=angle+leaf*TAU/3
        # A sloped rosette presents three distinct heart-shaped leaflets to the camera.
        along=V(math.cos(theta),.43*math.sin(theta),.78*math.sin(theta)+.24)
        cross=V(-math.sin(theta),.43*math.cos(theta),.78*math.cos(theta))
        rows=[]
        for j in range(10):
            t=j/9
            breadth=.49*math.sin(PI*t*.77)**.72*size
            row=[]
            for k in range(9):
                u=(k-4)/4
                notch=.24*(1-abs(u))**3+.11*abs(u)**6
                travel=size*t*(1-notch*t**3)
                pos=end+along*travel*unfurl+cross*(u*breadth*unfurl)
                pos+=V(0,-size*.12*(1-u*u)*t,size*(1-unfurl)*t*.65)
                c=mix(pal[1],pal[2],.1+t*.66+u*.10)
                stripe=max(0,1-abs(t-(.54+.22*abs(u)))/.14)
                c=mix(c,pal[3],.54*stripe+.18*(1-abs(u))**9)
                row.append(g.point(pos,c))
            rows.append(row)
        g.surface(rows)


def bell(g, top, radius, age, angle, palette):
    if age<.03: return
    rows=[]
    for j in range(9):
        t=j/8
        row=[]
        for i in range(23):
            a=TAU*i/22
            flute=.5+.5*math.cos(5*a)
            r=radius*age*(.15+1.0*math.sin(t*PI*.86)**.62+.29*t**5+.12*flute*t*t)
            h=radius*age*(1.9*t+.35*t**4*flute)
            p=top+V(r*math.cos(a)+angle*h*.27,r*.83*math.sin(a),-h)
            c=mix(palette[0],palette[2],.18+.39*flute+.25*t)
            c=mix(c,palette[3],t**6*.76)
            row.append(g.point(p,c))
        rows.append(row)
    g.surface(rows)
    oval(g,top-V(-angle*.5,.12,2.02)*(radius*age),
         (radius*.22*age,radius*.22*age,radius*.34*age),GOLD[1:])


def geometry(kind, frame):
    g=Geometry()
    rng=random.Random(703+KINDS.index(kind)*46)
    time=frame/(COUNT-1)
    pal=GREEN[kind]
    root_groups=[(-1.93,.16),(-1.32,-.03),(-.77,.09),(-.21,-.06),(.43,.13),(1.02,-.03),(1.66,.13)]
    for k,(x,y) in enumerate(root_groups):
        for n in range({'dew':14,'honey':8,'clover':6,'bells':7}[kind]):
            root=V(x+rng.uniform(-.25,.25),y+rng.uniform(-.22,.22),rng.uniform(-.017,.027))
            lean=rng.uniform(-.72,.72)+x*.08
            depth=rng.uniform(-.24,.27)
            h=rng.uniform(.30,1.07) * {'dew':1.02,'honey':.76,'clover':.65,'bells':.87}[kind]
            h*=.82+.18*math.cos(1.57*x/2.4)
            phase=rng.random()*TAU
            width=rng.uniform(.028,.058)*{'dew':1.,'honey':.83,'clover':.9,'bells':1.35}[kind]
            delay=.02+abs(x)*.076+rng.uniform(0,.21)
            age=ease(delay,delay+.46+rng.uniform(0,.09),time)
            wind=.055*math.sin(time*TAU*1.22+phase*.34)*age
            tip=blade(g,root,h,lean,depth,width,age,wind,pal,phase)
            if kind=='dew' and n in (2,8):
                drop=ease(delay+.40,delay+.65,time)
                r=(.05+.015*(k%3))*drop
                if r>.006:
                    bead=tip+V(-.012,-.022,r*.42)
                    oval(g,bead,(r,r*.88,r*1.09),AQUA)
                    oval(g,bead+V(-r*.33,-r*.68,r*.51),(r*.24,r*.17,r*.22),AQUA[2:])
    if kind=='honey':
        for i in range(11):
            x=-2.07+4.1*i/10+rng.uniform(-.13,.13)
            root=V(x,rng.uniform(-.18,.18),0)
            height=rng.uniform(.8,1.38)*(1-.21*math.exp(-x*x/.22))
            lean=(.11+.30*rng.random())*(1 if i%4 else -1)+x*.10
            delay=.10+abs(x+.3)*.065+rng.uniform(0,.15)
            age=ease(delay,delay+.53,time)
            if age>.01: foxtail(g,root,height,lean,age,.065*math.sin(TAU*time+i*.24),random.Random(80+i))
    elif kind=='clover':
        for i in range(39):
            x=rng.uniform(-2.3,2.23); y=rng.uniform(-.42,.35)
            size=rng.uniform(.21,.36); angle=rng.uniform(.5,2.1)
            if i>23: size*=.58; y-=.25
            delay=.08+abs(x)*.075+rng.uniform(0,.2)
            age=ease(delay,delay+.45,time)
            if age>.02: shamrock(g,V(x,y,0),size,age,.045*math.sin(time*TAU+i),angle)
        for i,x in enumerate((-1.59,-.95,.58,1.7)):
            age=ease(.34+i*.045,.85+i*.025,time)
            if age<.02: continue
            top=stalk(g,V(x,-.03,0),V(.08,0,.72+.14*(i%2)),.07,age,.015,pal)
            for n in range(11):
                a=n*2.40
                p=top+V(math.cos(a)*.071,math.sin(a)*.05,(n%3)*.036)*age
                oval(g,p,(.047*age,.05*age,.077*age),PINK)
    elif kind=='bells':
        for i,x in enumerate((-1.98,-1.42,-.84,.37,1.17,1.9)):
            d=-1 if i%3==0 else 1
            root=V(x,rng.uniform(-.15,.22),0)
            h=rng.uniform(.82,1.35); delay=.09+abs(x)*.055+rng.uniform(0,.16)
            age=ease(delay,delay+.51,time)
            if age<.02: continue
            wind=.055*math.sin(time*6+i*.51)
            end=stalk(g,root,V(d*.10,0,h),d*.24+wind,age,.022,pal)
            for k in range(3):
                flip=d if k!=1 else -d
                bend=ease(.26+k*.09,.87+k*.03,age)
                if bend<.02: continue
                start=end-V(0,0,(2-k)*.13*age)
                branch=[start+V(flip*.20*u,.055*u,(.18*math.sin(PI*u)-.008*u))*bend for u in [j/7 for j in range(8)]]
                tube(g,branch,lambda t:.014*(1-.42*t)*bend,lambda t:mix(pal[1],pal[3],t*.7))
                bell(g,branch[-1],.126 if k!=2 else .097,bend,flip,BLUE if i%3 else PERIWINKLE)
    # Short, forward-leaning shoots cover the feet of the taller growth.
    for i in range(39):
        x=rng.uniform(-2.23,2.08); delay=rng.uniform(.03,.36)
        age=ease(delay,delay+.38,time)
        h=rng.uniform(.17,.36); reach=rng.uniform(-.35,.35)
        blade(g,V(x,rng.uniform(-.52,-.19),.018),h,reach,-.23,.038,age,
              .02*math.sin(time*TAU+x),pal,x)
    return g


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc=bpy.context.scene
    sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=12
    sc.render.threads_mode='FIXED';sc.render.threads=6
    sc.render.resolution_x=W;sc.render.resolution_y=H;sc.render.resolution_percentage=100
    sc.render.film_transparent=True
    sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA'
    sc.render.image_settings.compression=18; sc.view_settings.view_transform='Standard'
    ca=bpy.data.cameras.new('Meadow lens');ca.type='ORTHO';ca.ortho_scale=7.2
    camera=bpy.data.objects.new('Meadow lens',ca);sc.collection.objects.link(camera)
    camera.location=(0,-12,4.2);focus=V(0,0,1.02)
    camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler();sc.camera=camera
    world=bpy.data.worlds.new('Skylight');world.use_nodes=True;sc.world=world
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.36
    sun=bpy.data.lights.new('Afternoon light','AREA');sun.energy=310;sun.size=4.5
    softbox=bpy.data.objects.new('Afternoon light',sun);sc.collection.objects.link(softbox)
    softbox.location=(-3.5,-4,6);softbox.rotation_euler=(V(0,0,.5)-softbox.location).to_track_quat('-Z','Y').to_euler()
    mat=bpy.data.materials.new('Botanical pigment');mat.use_nodes=True
    tree=mat.node_tree;tree.nodes.clear()
    color=tree.nodes.new('ShaderNodeAttribute');color.attribute_name='Pigment'
    glow=tree.nodes.new('ShaderNodeEmission');tree.links.new(color.outputs['Color'],glow.inputs['Color'])
    diffuse=tree.nodes.new('ShaderNodeBsdfDiffuse');tree.links.new(color.outputs['Color'],diffuse.inputs['Color'])
    shade=tree.nodes.new('ShaderNodeMixShader');shade.inputs[0].default_value=.32
    tree.links.new(glow.outputs[0],shade.inputs[1]);tree.links.new(diffuse.outputs[0],shade.inputs[2])
    out=tree.nodes.new('ShaderNodeOutputMaterial');tree.links.new(shade.outputs[0],out.inputs['Surface'])
    return sc,mat


if __name__=='__main__':
    action,*kinds=sys.argv[sys.argv.index('--')+1:]
    if action not in ('poster','render'): raise SystemExit(__doc__)
    sc,mat=setup()
    ob=None
    for kind in kinds or KINDS:
        directory=RAW/kind;directory.mkdir(parents=True,exist_ok=True)
        for frame in ([COUNT-1] if action=='poster' else range(COUNT)):
            mesh=geometry(kind,frame).mesh();mesh.materials.append(mat)
            if ob is None:
                ob=bpy.data.objects.new('Meadow grass',mesh);sc.collection.objects.link(ob)
            else:
                previous=ob.data;ob.data=mesh;bpy.data.meshes.remove(previous)
            sc.render.filepath=str(directory/('%03d.png'%frame))
            bpy.ops.render.render(write_still=True)
        print(kind,action,'complete',flush=True)
