"""Three articulated cottontail takes. No external models, textures or rig required.

blender -b -t 4 --python-exit-code 1 -P studies/woodland/bunnies.py -- LEVEL [FRAME ...]
python studies/woodland/pack.py bunnies LEVEL POSTER

With no frame list, write the complete take. Always export the entire crown track.
Local X points towards the rabbit's nose, Z upwards. Joint paths are in body units.
"""
import json
import math
import sys
from dataclasses import dataclass
from math import atan2, cos, exp, hypot, pi, radians, sin
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Quaternion, Vector

ROOT = Path(__file__).resolve().parents[2]
COUNTS = (72,80,88)
WIDTHS = (5.25,6.12,7.14)
TAU = 2*pi
X,Y,Z = (Vector(v) for v in ((1,0,0),(0,1,0),(0,0,1)))
IDENTITY = Quaternion()

def smooth(t):
    t=min(1,max(0,t))
    return t*t*(3-2*t)

def ramp(t,start,end):
    return smooth((t-start)/(end-start))

def blend(a,b,t):
    return a*(1-t)+b*t

def color(hexcode):
    s=[int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in s)

def dye(a,b,t):
    return tuple(blend(v,w,t) for v,w in zip(a,b))

def rotations(yaw=0,pitch=0,roll=0):
    return Quaternion(Z,radians(yaw)) @ Quaternion(Y,radians(-pitch)) @ Quaternion(X,radians(roll))

def basis(x,y,z):
    return Matrix((x,y,z)).transposed().to_quaternion()

def interp(keys,t):
    for (t0,a),(t1,b) in zip(keys,keys[1:]):
        if t<=t1:
            k=ramp(t,t0,t1)
            return tuple(blend(v,w,k) for v,w in zip(a,b))
    return keys[-1][1]

def link(name,data):
    ob=bpy.data.objects.new(name,data)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_mode='QUATERNION'
    return ob

def material(name,roughness,fur=False):
    mat=bpy.data.materials.new(name)
    mat.use_nodes=True
    nodes=mat.node_tree.nodes
    wire=mat.node_tree.links.new
    bsdf=nodes.get('Principled BSDF')
    bsdf.inputs['Roughness'].default_value=roughness
    bsdf.inputs['Specular IOR Level'].default_value=.30 if fur else .42
    pigment=nodes.new('ShaderNodeVertexColor')
    pigment.layer_name='Coat'
    tint=pigment.outputs['Color']
    if fur:
        tex=nodes.new('ShaderNodeTexCoord')
        stretch=nodes.new('ShaderNodeVectorMath')
        stretch.operation='MULTIPLY'
        stretch.inputs[1].default_value=(.54,1.20,1.14)
        wire(tex.outputs['Generated'],stretch.inputs[0])
        noise=nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value=54
        noise.inputs['Detail'].default_value=2
        wire(stretch.outputs['Vector'],noise.inputs['Vector'])
        grain=nodes.new('ShaderNodeMixRGB')
        grain.blend_type='MULTIPLY'
        grain.inputs[0].default_value=.27
        wire(tint,grain.inputs[1])
        wire(noise.outputs['Fac'],grain.inputs[2])
        tint=grain.outputs[0]
        bump=nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.15
        bump.inputs['Distance'].default_value=.008
        wire(noise.outputs['Fac'],bump.inputs['Height'])
        wire(bump.outputs[0],bsdf.inputs['Normal'])
        bsdf.inputs['Sheen Weight'].default_value=.13
    wire(tint,bsdf.inputs['Base Color'])
    return mat

class Surface:
    def __init__(self):
        self.points=[]; self.faces=[]; self.colors=[]
    def vertex(self,p,c):
        index=len(self.points)
        self.points.append(p); self.colors.extend((*c,1.))
        return index
    def rings(self,rows):
        for prev,cur in zip(rows,rows[1:]):
            for j in range(len(cur)):
                k=(j+1)%len(cur)
                self.faces.append((prev[j],prev[k],cur[k],cur[j]))
        self.faces.append(tuple(reversed(rows[0])))
        self.faces.append(tuple(rows[-1]))
    def mesh(self,name,material):
        data=bpy.data.meshes.new(name)
        data.from_pydata(self.points,[],self.faces); data.update()
        data.polygons.foreach_set('use_smooth',[True]*len(data.polygons))
        attr=data.color_attributes.new(name='Coat',type='FLOAT_COLOR',domain='POINT')
        attr.data.foreach_set('color',self.colors)
        data.materials.append(material)
        return data


def loft(name,profile,tint,material,segments=48):
    """Elliptic lathe along X. Rings carry center height, width and depth."""
    g=Surface(); rows=[]
    for i,(x,zc,w,h) in enumerate(profile):
        row=[]
        for j in range(segments):
            a=TAU*j/segments
            y,z=cos(a),sin(a)
            row.append(g.vertex((x,y*w,zc+z*h),tint(i/(len(profile)-1),y,z)))
        rows.append(row)
    g.rings(rows)
    return g.mesh(name,material)

def ellipsoid(name,c,d=None,mat=None):
    profile=[]
    for i in range(23):
        a=pi*i/22
        profile.append((-cos(a),0,max(.003,sin(a)),max(.003,sin(a))))
    return loft(name,profile,lambda t,y,z:dye(c,d or c,ramp(z,-.8,.85)),mat or FUR,32)

def rod_mesh(name,c):
    return loft(name,[(0,0,.83,.83),(.14,0,1,1),(.83,0,.50,.50),(1,0,.03,.03)],
                lambda t,y,z:c,MATTE,8)

def stage(level):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s=bpy.context.scene
    s.render.engine='CYCLES'; s.cycles.device='CPU'; s.cycles.samples=8
    s.cycles.use_adaptive_sampling=False; s.cycles.use_denoising=True
    s.cycles.max_bounces=3; s.cycles.diffuse_bounces=2; s.cycles.glossy_bounces=1
    s.render.use_persistent_data=True
    s.render.threads_mode='FIXED'; s.render.threads=4
    s.render.film_transparent=True; s.render.resolution_x=480; s.render.resolution_y=360
    s.render.resolution_percentage=100; s.render.fps=24
    s.render.image_settings.file_format='PNG'; s.render.image_settings.color_mode='RGBA'
    s.render.image_settings.color_depth='8'; s.render.image_settings.compression=26
    s.view_settings.view_transform='AgX'; s.view_settings.look='AgX - Medium High Contrast'
    s.world=bpy.data.worlds.new('Blue daylight'); s.world.use_nodes=True
    sky=s.world.node_tree.nodes.get('Background')
    sky.inputs[0].default_value=(.72,.81,1,1); sky.inputs[1].default_value=.33
    cam=link('Fixed orthographic stage',bpy.data.cameras.new('Woodland lens'))
    width=WIDTHS[level-1]; aim=Vector((0,0,width*3/8-.25))
    cam.location=aim+Vector((0,-14,1.58))
    cam.rotation_quaternion=(aim-cam.location).to_track_quat('-Z','Y')
    cam.data.type='ORTHO'; cam.data.ortho_scale=width; s.camera=cam
    for name,pos,power,spread,col in [
        ('Large honey key',(-3.4,-4.3,6.1),590,4.2,(1,.85,.68)),
        ('Cool bounce',(3.4,-3.6,3.6),255,4.0,(.76,.86,1)),
        ('Soft ear rim',(1.3,2.4,4.9),700,3.2,(1,.78,.59))]:
        d=bpy.data.lights.new(name,'AREA'); d.energy=power
        d.shape='DISK'; d.size=spread; d.color=col
        o=link(name,d); o.location=pos
        o.rotation_quaternion=(Vector((0,0,1.12))-o.location).to_track_quat('-Z','Y')
    s.frame_end=COUNTS[level-1]
    return s

# Warm guard hairs, darkest back, belly, ear lining, ear tip.
COATS={
    'hazel':('b77844','634134','f5dfb7','d99a87','513b36'),
    'fallow':('a48a70','625649','f4e3ca','d79b91','4c433b'),
    'honey':('cf9a5d','96673c','ffebc8','e9ad91','79553d'),
    'silver':('97a3aa','596670','f2eadc','d8a8a4','474b50'),
    'chestnut':('b97550','784639','f3d7b9','e49a91','563c36')}

def ear_mesh(coat,kit):
    outer,back,cream,pink,tip=coat
    g=Surface(); rows=[]
    for i in range(43):
        t=i/42
        # Narrow cuff, broad middle and black-tipped pinna. Local -Y faces the viewer.
        width=.115*(1-t)+(.147 if kit else .135)*max(.002,sin(pi*t**1.23))**.64
        depth=.085*(1-t)+.038*sin(pi*t)
        row=[]
        for j in range(72):
            a=TAU*j/72; lateral=cos(a); front=-sin(a)
            x=width*lateral-.065*t*t
            y=-depth*front+.086*t*t
            # A recessed inner surface, bounded by a rolled light helix.
            cavity=ramp(t,.08,.25)*(1-ramp(t,.80,.968))*ramp(front,.59,.88)
            y+=.049*cavity
            base=dye(outer,back,.18+.36*(1-front)/2)
            base=dye(base,cream,.57*ramp(front,.35,.70))
            lining=dye(pink,color('b97671'),.32+.22*sin(pi*t)+.16*lateral)
            base=dye(base,lining,cavity)
            base=dye(base,tip,.90*ramp(t,.80+.06*front,.99))
            row.append(g.vertex((x,y,t),base))
        rows.append(row)
    g.rings(rows)
    return g.mesh('Hollow pinna with agouti tip',FUR)

BODY=[(-.91,.06,.018,.045),(-.86,.08,.22,.25),(-.73,.08,.365,.405),
      (-.51,.08,.435,.49),(-.22,.055,.445,.485),(.04,.025,.401,.426),
      (.23,.03,.344,.378),(.40,.085,.286,.326),(.53,.15,.235,.265),(.61,.20,.16,.18),(.66,.20,.02,.03)]
HEAD=[(-.43,.025,.018,.04),(-.395,.05,.17,.22),(-.30,.065,.27,.32),
      (-.16,.07,.339,.365),(.00,.059,.368,.367),(.13,.036,.349,.33),
      (.255,.000,.291,.269),(.36,-.046,.229,.191),(.442,-.065,.148,.124),(.485,-.063,.033,.044)]

def coat_meshes(name,kit):
    coat=tuple(map(color,COATS[name])); wool,back,cream,lining,tip=coat
    def body_tint(t,y,z):
        warm=dye(wool,back,.51*ramp(z,-.05,.82)+.13*(1-t))
        bib=(1-ramp(z,-.69+.22*t,-.30+.15*t))*(.82+.18*t)
        return dye(warm,cream,bib)
    def face_tint(t,y,z):
        base=dye(wool,back,.31*ramp(z,.33,1))
        jaw=1-ramp(z,-.66,-.21)
        return dye(base,cream,max(.75*jaw,.53*ramp(t,.59,.96)))
    return dict(body=loft('Single haunched torso',BODY,body_tint,FUR),
                head=loft('Sculpted forehead, cheeks and tapering snout',HEAD,face_tint,FUR),
                ear=ear_mesh(coat,kit),
                haunch=ellipsoid('Velvet haunch',dye(wool,cream,.15),dye(wool,back,.26)),
                tail=ellipsoid('Cotton scut',cream,dye(cream,wool,.38)),
                pad=ellipsoid('Cream whisker pad',dye(cream,wool,.08),cream),
                brow=ellipsoid('Warm orbital ring',dye(wool,cream,.65)),
                iris=ellipsoid('Smoky amber iris',color('46352b'),color('573c25'),GLOSS),
                pupil=ellipsoid('Espresso eye',color('211b1a'),color('171518'),GLOSS),
                light=ellipsoid('Eye glint',color('fff4df'),mat=MATTE),
                nose=loft('Soft nose leather',[(-1,.14,.16,.33),(-.64,.12,.78,.83),(-.18,0,.99,.94),
                          (.47,-.07,.85,.72),(.89,-.16,.42,.47),(1,-.19,.14,.16)],
                          lambda t,y,z:dye(color('754b49'),color('a36a61'),(z+1)*.47),MATTE,24),
                whisker=rod_mesh('Tapered whisker',dye(tip,cream,.48)),
                lip=rod_mesh('Philtrum',dye(tip,lining,.2)),
                freckle=ellipsoid('Whisker follicle',dye(tip,lining,.27)))


def child(name,parent,mesh=None,loc=(0,0,0),rot=IDENTITY,scale=(1,1,1)):
    o=link(name,mesh); o.parent=parent
    o.location=loc; o.rotation_quaternion=rot; o.scale=scale
    return o

def between(o,start,end,width,depth,foot=False):
    vector=end-start; length=vector.length
    x=vector.normalized(); y=Y-x*x.dot(Y); y.normalize(); z=x.cross(y)
    o.location=start if foot else (start+end)*.5
    o.rotation_quaternion=basis(x,y,z)
    o.scale=(length if foot else length*.57,width,depth)

@dataclass
class Cast:
    name:str
    coat:str
    size:float
    kit:bool
    x:float
    depth:float
    yaw:float
    beats:tuple   # lift frame, touch frame, horizontal travel, apex height, binky strength
    phase:float=0

CASTS={
  1:[Cast('Hazel','hazel',1.06,False,-.76,-.04,-23,((30,56,1.55,1.05,.14),))],
  2:[Cast('Bracken','fallow',1.02,False,-.05,.22,-19,((22,48,1.05,1.15,.12),(52,69,.57,.43,.07))),
     Cast('Pip','honey',.76,True,-1.73,-.18,-32,((30,54,.95,.82,.26),(58,75,.67,.52,.23)),2)],
  3:[Cast('Rowan','hazel',1.06,False,-.47,.55,-28,((24,53,.64,1.69,1.),(60,78,-.22,.45,.36)),2),
     Cast('Thistle','silver',.82,True,-2.04,-.02,-36,((12,37,.25,.80,.61),(44,69,-.25,1.06,.80)),1),
     Cast('Clover','chestnut',.83,True,2.12,-.28,-149,((28,55,-.44,1.01,-.83),(62,80,.32,.55,-.54)),4)]}

# Foot positions relative to a neutral pelvis. Negative X is a backward kick.
HIND=[
    (0,(-.68,.14,-6)),(.09,(-.77,.22,-48)),(.21,(-.92,.22,-128)),
    (.36,(-.94,.38,-152)),(.47,(-.88,.48,-139)),(.60,(-.75,.46,-82)),
    (.72,(-.55,.37,-24)),(.86,(-.44,.33,-17)),(1,(-.68,.14,-6))]
FORE=[
    (0,(.28,.36,.48,.12,.67,.083)),(.20,(.40,.60,.65,.59,.87,.55)),
    (.45,(.39,.52,.60,.40,.86,.40)),(.64,(.39,.49,.64,.31,.81,.30)),
    (.86,(.42,.41,.66,.15,.86,.11)),(1,(.28,.36,.48,.12,.67,.083))]

class Limb:
    """An uninterrupted skin tube with a rounded elbow, ankle and divided toe."""
    SIDES=20
    def __init__(self,name,parent,coat):
        g=Surface(); rows=[]
        wool,back,cream,*_=map(color,COATS[coat])
        for i in range(15):
            row=[]
            for j in range(self.SIDES):
                theta=TAU*j/self.SIDES
                progress=i/14
                hue=dye(wool,cream,.07+.83*ramp(progress,.24,.99))
                toe_line=exp(-((abs(cos(theta))-.33)/.14)**2)*ramp(sin(theta),.15,.72)
                hue=dye(hue,back,.19*toe_line*ramp(progress,.76,.94))
                row.append(g.vertex((i*.1,.1*cos(theta),.1*sin(theta)),hue))
            rows.append(row)
        g.rings(rows)
        self.ob=child(name,parent,g.mesh(name,FUR))
    def pose(self,a,b,c,d,thickness):
        # Sections on either side of each joint give it a round bend and keep
        # the foot broad as the tibia rotates back through the silhouette.
        points=[a,blend(a,b,.18),blend(a,b,.53),blend(a,b,.83),
                .10*a+.80*b+.10*c,blend(b,c,.18),blend(b,c,.50),blend(b,c,.83),
                .075*b+.85*c+.075*d,blend(c,d,.16),blend(c,d,.38),
                blend(c,d,.65),blend(c,d,.82),blend(c,d,.94),d]
        widths=(.38,.93,1.04,.84,.78,.73,.66,.59,.66,.71,.79,.82,.74,.54,.055)
        depths=(.40,1.15,1.17,.91,.79,.67,.62,.57,.62,.61,.58,.55,.49,.33,.055)
        coords=[]
        for i,p in enumerate(points):
            along=(points[min(14,i+1)]-points[max(0,i-1)]).normalized()
            across=(Y-along*Y.dot(along)).normalized(); up=along.cross(across)
            for j in range(self.SIDES):
                angle=TAU*j/self.SIDES
                coords.extend(p+thickness*(across*(widths[i]*cos(angle))+up*(depths[i]*sin(angle))))
        self.ob.data.vertices.foreach_set('co',coords)
        self.ob.data.update()

class Rabbit:
    def __init__(self,cast):
        self.c=cast
        meshes=coat_meshes(cast.coat,cast.kit)
        self.r=child(cast.name,None)
        def part(label,key,parent=None):
            return child(label,parent or self.r,meshes[key])
        self.body=part('Chest to rump','body')
        self.tail=part('Cotton tail','tail')
        self.head=child('Skull and hat space',self.r)
        part('Face','head',self.head)
        self.ears=[]
        self.limbs=[]
        self.eyes=[]
        # Dark, almond-shaped eyes have two small physical highlights. The sculpted
        # rim and bilateral cheek pads give the face a clear expression in profile.
        for side in (-1,1):
            ear=part('Mobile pinna','ear',self.head); self.ears.append(ear)
            eyebase=Vector((.134,side*.294,.151))
            normal=Vector((.39,side*.87,.31)).normalized()
            along=Vector((1,0,-.07))
            along=(along-normal*along.dot(normal)).normalized()
            up=along.cross(normal)*side
            sideways=up.cross(along)
            orientation=basis(along,sideways,up)
            blink=child('Blink',self.head,loc=eyebase,rot=orientation)
            self.eyes.append(blink)
            for name,key,dist,size in [('Eye rim','brow',0,(.147,.050,.128)),('Iris','iris',.028,(.12,.055,.110)),
                                       ('Eye','pupil',.045,(.105,.051,.097))]:
                child(name,blink,meshes[key],(0,side*dist,0),scale=size)
            child('Catchlight',blink,meshes['light'],(.030,side*.089,.044),scale=(.026,.011,.023))
            child('Small catchlight',blink,meshes['light'],(-.038,side*.089,-.033),scale=(.010,.007,.009))
            child('Soft muzzle',self.head,meshes['pad'],(.369,side*.109,-.094),scale=(.135,.112,.103))
            for j in range(3):
                base=Vector((.39+(j%2)*.028,side*(.203+.009*(j%2)),-.075-.023*j))
                child('Follicle',self.head,meshes['freckle'],base,scale=(.012,.009,.010))
                whisk=child('Whisker',self.head,meshes['whisker'])
                tip=base+Vector((-.075-.042*j,side*(.25-.018*j),.067-.056*j))
                between(whisk,base,tip,.0055,.0055,True)
            self.limbs.append((part('Outer thigh','haunch'),Limb('Tucked hock and long paw',self.r,cast.coat),
                               Limb('Foreleg and paw',self.r,cast.coat)))
        self.nose=child('Nose twitch',self.head,meshes['nose'],(.476,0,-.058),scale=(.058,.089,.045))
        philtrum=child('Short split lip',self.head,meshes['lip'])
        between(philtrum,Vector((.474,-.003,-.080)),Vector((.464,-.003,-.142)),.011,.011,True)

    def pose(self,f,level):
        c=self.c; x=c.x; flight=0.; arc=0.; spring=0.; twist=0.; squash=0.; lag=0.; pitch=0.
        self.contact_corrected=False
        for start,end,travel,height,turn in c.beats:
            u=(f-start)/(end-start)
            x+=travel*ramp(f,start-1,end+1)
            squash+=ramp(f,start-8,start-3)*(1-ramp(f,start-3,start+2))
            squash+=ramp(f,end-2,end+2)*(1-ramp(f,end+2,end+9))
            if 0<u<1:
                flight=u; arc=sin(pi*u)**1.02
                spring=height*4*u*(1-u)
                twist=turn*sin(pi*u)**1.28
                pitch=11*sin(TAU*u)+6*abs(turn)*arc
                lag=-34*sin(pi*u)**.8-13*sin(TAU*u)
            lag+=13*ramp(f,end-2,end+3)*(1-ramp(f,end+3,end+11))
        peek=ramp(f,3,17)*(1-ramp(f,21,30)) if level==1 else 0
        crouch=(1-ramp(f,2,16))*.79 if level==1 else 0
        relax=ramp(f,COUNTS[level-1]-13,COUNTS[level-1]-4)*.16
        squeeze=squash+crouch+relax
        heat=sin(f*.16+c.phase)
        self.r.location=(x,c.depth,spring)
        self.r.scale=(c.size,)*3
        self.r.rotation_quaternion=rotations(c.yaw-34*peek-32*twist)
        rot=rotations(0,pitch,twist*24)
        pivot=Vector((0,0,.70))
        def joint(x,y,z):
            return pivot+rot@(Vector((x,y,z))-pivot)
        length=1+.155*arc-.065*squeeze
        core=joint(-.04,0,.71-.165*squeeze+.045*peek+.013*heat)
        self.body.location=core
        self.body.rotation_quaternion=rot @ rotations(0,5+6*peek-4*squeeze)
        self.body.scale=(length,1+.09*squeeze,1-.11*arc-.07*squeeze)
        self.tail.location=core+rot@Vector((-.89*length,.012,.19+.10*arc))
        self.tail.rotation_quaternion=rot @ rotations(0,-34+11*arc)
        self.tail.scale=(.22,.156,.168)
        headsize=1.15 if c.kit else 1.0
        self.head.location=joint(.42+.10*arc-.06*squeeze,0,1.13-.26*squeeze+.13*peek+.018*heat)
        self.head.rotation_quaternion=rot @ rotations(-7-13*peek-7*arc,4+12*peek-7*squash-5*arc,4*peek-10*twist)
        self.head.scale=(headsize,)*3
        self.nose.location.x=.476+.009*sin(.83*f+c.phase)
        blinking=min(1, sum(exp(-((f-t-c.phase)/1.08)**2) for t in (9,28,65)))
        for eye in self.eyes: eye.scale.z=1-.92*blinking
        for index,side in enumerate((-1,1)):
            ear=self.ears[index]
            ear.location=(-.15+.015*side,side*.168,.327)
            listening=(8*side*sin(f*.18+c.phase)+3*sin(f*.31+side))*(1-.55*arc)
            fold=18+crouch*(42 if side==-1 else 65)+3*squash-lag+(9 if side==-1 else -10)
            facing_left=c.yaw < -90
            if facing_left: fold+=17*side
            ear.rotation_quaternion=(rotations(20*side+9+14*peek)
                @ Quaternion(Y,radians(-fold+listening+side*11*twist))
                @ Quaternion(X,radians(-side*(16+14*abs(twist))))
                @ Quaternion(Z,radians(159 if facing_left else 0)))
            ear.scale=(.92 if c.kit else 1,1,.75 if c.kit else .98)
            phase=clamp01(flight+.058*side*arc)
            hx,hz,ankle=interp(HIND,phase)
            tx=hx+.56*cos(radians(ankle)); tz=hz+.56*sin(radians(ankle))
            ex,ez,wx,wz,fx,fz=interp(FORE,phase)
            step=side*(.041+.075*arc)
            y=side*.275
            hip=joint(-.41*length,y,.72-.13*squeeze)
            knee=joint(-.24*length+.08*arc,y*1.17,.39-.10*squeeze+.10*arc)
            hock=joint(hx+step,y*(1.05+.36*abs(twist)),hz+side*.105*twist)
            toe=joint(tx+step,y*(1.13+.54*abs(twist)),tz+side*.17*twist)
            # The hock stays close to the tip of the foot until push-off.
            # Upper thigh overlaps both the torso and folded shin at the knee.
            haunch,hind,fore=self.limbs[index]
            haunch.location=(hip+knee)*.5+Vector((-.125,0,0))
            haunch.rotation_quaternion=rot@rotations(0,-24-14*arc)
            haunch.scale=(.38+.035*arc,.242,.335-.035*squeeze)
            shoulder=joint(.275*length,side*.225,.83-.19*squeeze)
            elbow=joint(ex+.025*side,side*.25,ez-.07*squeeze)
            wrist=joint(wx+step,side*(.245+.10*abs(twist)),wz+side*.060*twist)
            foretoe=joint(fx+step,side*(.26+.15*abs(twist)),fz+side*.070*twist)
            # Small bounds use the same anatomical stride as the large jump.
            # Flex the ankle at contact so that the toe stays above its rest plane.
            deficit=max(0,.082-spring/c.size-toe.z)
            self.contact_corrected |= deficit>0
            toe.z+=deficit
            hock.z+=deficit*.55
            hind.pose(hip,knee,hock,toe,.158)
            deficit=max(0,.070-spring/c.size-foretoe.z)
            self.contact_corrected |= deficit>0
            foretoe.z+=deficit
            wrist.z+=deficit*.55
            fore.pose(shoulder,elbow,wrist,foretoe,.126)

    def anchor(self,scene):
        matrix=self.head.matrix_world
        # Frontal crown just ahead of the ear sockets. Project its tangent brim
        # and the skull's up axis into the same full camera stage as the PNG.
        crown=Vector((.015,0,.421))
        def pixel(local):
            point=world_to_camera_view(scene,scene.camera,matrix@local)
            return Vector((480*point.x,360*(1-point.y)))
        center=pixel(crown); up=pixel(crown+Z)-center
        brim=Vector((-up.y,up.x)).normalized()
        width=hypot((pixel(crown+.72*X)-center).dot(brim),(pixel(crown+.66*Y)-center).dot(brim))
        return [round(center.x,3),round(center.y,3),round(atan2(up.x,-up.y),6),round(width,3)]

def clamp01(t):
    return max(0,min(1,t))

def main():
    global FUR,MATTE,GLOSS
    args=sys.argv[sys.argv.index('--')+1:]; level=int(args[0]); count=COUNTS[level-1]
    contact_only='--contact-fixes' in args
    specified=[int(arg) for arg in args[1:] if arg!='--contact-fixes']
    selected=set(specified) if specified else set(range(1,count+1))
    if not selected.issubset(range(1,count+1)): raise ValueError('Frame out of range')
    folder=ROOT/'assets/videos/woodland'/f'bunnies-{level}'; folder.mkdir(parents=True,exist_ok=True)
    scene=stage(level)
    FUR=material('Fine agouti velvet',.72,True)
    MATTE=material('Fine facial details',.55)
    GLOSS=material('Cornea and iris',.17)
    rabbits=[Rabbit(cast) for cast in CASTS[level]]
    rows=[]
    for f in range(1,count+1):
        scene.frame_set(f)
        for rabbit in rabbits: rabbit.pose(f,level)
        bpy.context.view_layer.update()
        rows.append([rabbit.anchor(scene) for rabbit in rabbits])
        if f in selected and (not contact_only or any(rabbit.contact_corrected for rabbit in rabbits)):
            scene.render.filepath=str(folder/f'{f:03d}.png')
            bpy.ops.render.render(write_still=True)
            print(f'bunnies-{level} {f}/{count}',flush=True)
    (folder/'anchors.json').write_text(json.dumps(rows,separators=(',',':'),allow_nan=False)+'\n',encoding='utf-8')

if __name__=='__main__': main()
