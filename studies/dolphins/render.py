"""Render original dolphin studies. Blender -b -P render.py -- [skip|vault|relay] [1|2|3] [frames...]

Reference: USA TODAY, clf_54guaNI. Skip follows 7–11 s, vault 17–24 s,
and relay 36–43 s. Coordinates are metres. The sea surface is z=0.
"""
from dataclasses import dataclass
from math import atan2, cos, exp, pi, radians, sin, sqrt
from pathlib import Path
import random
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from model import build_dolphin


@dataclass
class Leap:
    animal: int
    start: int
    duration: int
    x: float
    dx: float
    y: float
    dy: float
    height: float
    size: float = 1.0
    roll: float = 0.0

    def at(self, p):
        return Vector((self.x+self.dx*p, self.y+self.dy*p, 4*self.height*p*(1-p)))

    def rotation(self, p):
        pitch = atan2(4*self.height*(1-2*p), sqrt(self.dx**2+self.dy**2))
        yaw = atan2(self.dy, self.dx)
        # The vault presents the shoulder on takeoff, then turns in toward the viewer.
        in_air = max(0, min(1, p))
        if family == "vault":
            yaw += radians(35*cos(pi*in_air)-5)
        bank = radians(self.roll)*sin(pi*in_air)**1.3
        return (bank, -pitch, yaw)


def choreography(family, level):
    if family == "skip":
        if level == 1:
            return [Leap(0,10,28,-2.3,4.5,.3,-.6,1.25,1,8)], 66, 9.3
        leaps = [Leap(0,10,25,-4.1,3.9,.25,-.4,1.18,.89,10),
                 Leap(0,49,31,.1,4.25,-.15,-.55,1.95,.89,19)]
        if level == 3:
            leaps += [Leap(1,26,24,-5.15,3.8,1.85,-.2,1.05,.67,-9),
                      Leap(1,62,31,-1.28,4.2,1.65,-.55,1.57,.67,-15)]
        return leaps, (120 if level == 3 else 107), 13.8
    if family == "vault":
        if level == 1:
            return [Leap(0,9,35,-.9,2.25,.55,-1.9,2.8,1,17)], 76, 9.2
        lead = Leap(0,11,49,-.35,1.5,.8,-3.4,5.25,1,68)
        if level == 2:
            return [lead], 102, 12.4
        return [lead,Leap(1,23,41,-3.1,2,2.05,-2.4,3.45,.79,-47)], 99, 12.8
    if level == 1:
        return [Leap(0,10,33,2.7,-5.4,.5,-1.05,1.9,1,8)], 73, 10.9
    lead = Leap(0,11,46,3.7,-7.4,.5,-1.05,3.18,1.04,27)
    if level == 2:
        return [lead], 89, 13.8
    return [lead,Leap(1,26,43,4.4,-7.35,2,-.55,2.85,.84,18),
            Leap(2,41,40,4.85,-7.05,3.4,-.9,2.4,.72,-11)], 112, 14.7


def material(name, rgb, roughness, metal=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metal
    return mat


def clip_submerged(mat):
    # Film alpha follows the actual posed surface, even during a near-vertical entry.
    nodes, link = mat.node_tree.nodes, mat.node_tree.links.new
    outlet = next(n for n in nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
    surface = outlet.inputs["Surface"]
    shader = surface.links[0].from_socket
    xyz = nodes.new("ShaderNodeSeparateXYZ")
    link(nodes.new("ShaderNodeNewGeometry").outputs["Position"], xyz.inputs[0])
    above = nodes.new("ShaderNodeMath")
    above.operation = "GREATER_THAN"
    above.inputs[1].default_value = 0
    link(xyz.outputs["Z"], above.inputs[0])
    mix = nodes.new("ShaderNodeMixShader")
    link(above.outputs[0], mix.inputs[0])
    link(nodes.new("ShaderNodeBsdfTransparent").outputs[0], mix.inputs[1])
    link(shader, mix.inputs[2])
    link(mix.outputs[0], surface)


def aerated_water():
    mat = material("Breaking sheet water",(.24,.63,.67),.17,.13)
    nodes,link=mat.node_tree.nodes,mat.node_tree.links.new
    noise=nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value=6
    noise.inputs["Detail"].default_value=2.4
    noise.inputs["Distortion"].default_value=.38
    coord=nodes.new("ShaderNodeVectorMath")
    coord.operation="MULTIPLY"
    coord.inputs[1].default_value=(1,1,.65)
    link(nodes.new("ShaderNodeNewGeometry").outputs["Position"],coord.inputs[0])
    link(coord.outputs[0],noise.inputs["Vector"])
    tint=nodes.new("ShaderNodeValToRGB")
    ramp=tint.color_ramp
    ramp.elements[0].position=.30
    ramp.elements[0].color=(.09,.39,.47,1)
    ramp.elements[1].position=.71
    ramp.elements[1].color=(.90,.99,.97,1)
    ramp.elements.new(.53).color=(.43,.77,.78,1)
    link(noise.outputs["Fac"],tint.inputs[0])
    bsdf=nodes.get("Principled BSDF")
    link(tint.outputs[0],bsdf.inputs["Base Color"])
    holes=nodes.new("ShaderNodeValToRGB")
    holes.color_ramp.elements[0].position=.39
    holes.color_ramp.elements[1].position=.60
    holes.color_ramp.elements[1].color=(.93,.93,.93,1)
    link(noise.outputs["Fac"],holes.inputs[0])
    link(holes.outputs[0],bsdf.inputs["Alpha"])
    return mat


def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()


def softbox(name, pos, target, size, power, color):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = power, "DISK", size, color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = pos
    aim(obj,target)


def setup_camera(width, target):
    data = bpy.data.cameras.new("Game camera")
    cam = bpy.data.objects.new("Game camera",data)
    scene.collection.objects.link(cam)
    cam.location = Vector(target)+Vector((1.4,-22,4.4))
    aim(cam,target)
    data.type, data.ortho_scale = "ORTHO", width
    scene.camera = cam


def water_events(leaps):
    events, drops = [], []
    rng = random.Random(527+level)
    for jump in leaps:
        for landing in (False,True):
            speed_z = 4*jump.height/jump.duration
            p = 1-min(.20,1.38*jump.size/(speed_z*jump.duration)) if landing else 0
            pos = jump.at(p)
            pos.z = .014
            # The rostrum enters in front of the centre of mass.
            pos.x += jump.dx/jump.duration*(2 if landing else -1)
            power = (.58+.23*jump.height)*jump.size*(1 if landing else .61)
            birth = jump.start+jump.duration*p
            events.append((birth,pos,power,landing,rng.random()*6))
            for k in range(round(24+38*power)):
                angle = rng.uniform(0,2*pi)
                speed = rng.uniform(.65,2.5)*sqrt(power)
                vz = rng.uniform(1.7,5.4)*sqrt(power)
                velocity = Vector((cos(angle)*speed+.10*jump.dx,sin(angle)*speed,vz))
                offset = Vector((.13*cos(angle),.13*sin(angle),.03))
                drops.append((birth+rng.uniform(0,4),pos+offset,velocity,rng.uniform(.017,.060),k%4))
        # A narrow trail peels off the flukes while the body is climbing.
        for k in range(38 if family != "skip" else 17):
            p = rng.uniform(.08,.45)
            point = jump.at(p)
            roll,pitch,yaw = jump.rotation(p)
            tail = 1.62*jump.size
            point -= Vector((cos(yaw)*cos(pitch),sin(yaw)*cos(pitch),-sin(pitch)))*tail
            point.y += rng.uniform(-.43,.43)*jump.size
            if point.z < .1:
                continue
            velocity = Vector((jump.dx*.29+rng.uniform(-.33,.33),jump.dy*.19,rng.uniform(-.8,.25)))
            drops.append((jump.start+p*jump.duration,point,velocity,rng.uniform(.016,.038),k%4))
    return events, drops


def water_frame(frame):
    verts, faces, slots = [],[],[]

    def strip(a,b,mat):
        start = len(verts)
        for pair in zip(a,b):
            verts.extend(pair)
        for i in range(len(a)-1):
            j = start+2*i
            faces.append((j,j+1,j+3,j+2))
            slots.append(mat)

    for birth,pos,power,landing,seed in events:
        age = (frame-birth)/30
        if not 0 < age < .92:
            continue
        # Broken capillary rings settle after the spray. Never draw a solid waterline.
        for row in range(2):
            t = (age-row*.10)/(.89-row*.10)
            if not 0 < t < 1:
                continue
            radius = (.20+1.84*(1-(1-t)**1.7))*power*(1-.19*row)
            for arc in range(4):
                edges = [[],[]]
                for n in range(15):
                    u=n/14
                    a=seed+arc*pi/2+u*1.08+row*.76
                    for side,edge in enumerate(edges):
                        r=radius*(1+.035*sin(4*a+seed)) + side*.072*power*sin(pi*u)*sin(pi*t)**.65
                        edge.append((pos.x+1.3*r*cos(a),pos.y+r*sin(a),.019+.012*row))
                strip(*edges,2 if row else 1)
        # Short, uneven curtains of sheet water. Tips break into the independent drops.
        t=age/(.70 if landing else .57)
        if t>=1:
            continue
        for lobe in range(7):
            a0=seed+lobe*2*pi/7
            base,mid,lip,foam=[],[],[],[]
            for n in range(21):
                u=n/20
                a=a0+(u-.5)*(.69+.14*sin(seed+lobe))
                env=sin(pi*u)**.6
                spread=power*(.24+1.8*t)
                z=power*(.25+.66*(.5+.5*sin(5*lobe+seed)))*4*t*(1-t)*env*(1+.19*sin((4+lobe%3)*u*pi+lobe))
                x,y=cos(a),sin(a)
                base.append((pos.x+x*spread*.67,pos.y+y*spread*.67,.023))
                mid.append((pos.x+x*spread*.79,pos.y+y*spread*.79,.023+z*.72))
                lip.append((pos.x+x*spread,pos.y+y*spread,.025+z))
                foam.append((pos.x+x*(spread+.017*env),pos.y+y*(spread+.017*env),.025+z+.018*env*sin(pi*t)))
            strip(base,mid,0)
            strip(mid,lip,0)
            strip(lip,foam,2)
    for birth,pos,velocity,radius,shade in drops:
        t=(frame-birth)/30
        if not 0<t<1.9:
            continue
        centre = pos + velocity*t + Vector((0,0,-5.8*t*t))
        if centre.z<.03:
            continue
        r=radius*min(1,t*22,centre.z*8)
        start=len(verts)
        verts.append(tuple(centre+Vector((0,0,r*1.65))))
        for i in range(5):
            angle=i*2*pi/5
            verts.append((centre.x+r*cos(angle),centre.y+r*sin(angle),centre.z))
        verts.append(tuple(centre-Vector((0,0,r*1.4))))
        for i in range(5):
            a,b = start+1+i, start+1+(i+1)%5
            faces.extend([(start,a,b),(start+6,b,a)])
            slots.extend([1 if shade==0 else 2]*2)
    mesh=bpy.data.meshes.new("Surface detail")
    mesh.from_pydata(verts,[],faces)
    for mat in water_materials:
        mesh.materials.append(mat)
    if slots:
        mesh.polygons.foreach_set("material_index",slots)
    return mesh


def place(frame):
    for index,(root,pose) in animals.items():
        jump=min((j for j in leaps if j.animal==index),
                 key=lambda j:abs((frame-j.start)/j.duration-.50))
        p=(frame-jump.start)/jump.duration
        if not -.32 < p < 1.32:
            root.location=(0,0,-20)
            continue
        root.location = jump.at(p)
        root.rotation_euler = jump.rotation(p)
        root.scale = (jump.size,)*3
        # Thrust comes from the peduncle, peaks before launch, and then relaxes.
        kick = sin(12*p+.65)*exp(-((p+.02)/.30)**2)
        arch = sin(pi*max(0,min(1,p)))
        pose(radians(12*arch+17*kick),radians(23*kick-9*arch+8*sin(2*pi*p)),
             radians(9+13*arch+8*sin(2*pi*p)))
    previous=water.data
    water.data=water_frame(frame)
    bpy.data.meshes.remove(previous)


def setup_shot(shot_family, shot_level):
    global family, level, scene, leaps, animals, water, water_materials, events, drops
    family, level = shot_family, shot_level
    assert family in ("skip","vault","relay") and level in (1,2,3)
    leaps,count,width=choreography(family,level)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.samples=10
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=3
    scene.cycles.transparent_max_bounces=32
    scene.render.threads_mode="FIXED"
    scene.render.threads=12
    scene.render.film_transparent=True
    scene.render.resolution_x=560
    scene.render.resolution_y=400 if family=="vault" and level>=2 else 350
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGBA"
    scene.render.fps=30
    scene.world=bpy.data.worlds.new("Sea light")
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value=(.62,.78,.90,1)
    bg.inputs[1].default_value=.46
    aim_height=.235
    if family=="skip":
        aim_height=.186
    elif family=="vault" and level>=2:
        # The nose-first entry sends a wake toward the lens at the bottom of the plate.
        aim_height=.208
    setup_camera(width,(0,0,width*aim_height))
    softbox("Broad sky",(-3,-5,9),(0,0,2),7,1450,(.87,.95,1))
    softbox("Sun edge",(0,5,8),(0,0,2),5,2200,(1,.83,.59))
    softbox("Sea bounce",(4,-4,2),(0,0,2),4,285,(.55,.88,1))
    animals={i:build_dolphin("Dolphin "+str(i+1)) for i in sorted({j.animal for j in leaps})}
    for mat in {m for obj in scene.objects if obj.type in {"MESH","CURVE"} for m in obj.data.materials if m}:
        clip_submerged(mat)
    water_materials=[aerated_water(),
                     material("Sunlit spray",(.41,.80,.83),.21,.18),
                     material("Pearl foam",(.88,.96,.95),.26,.08)]
    water=bpy.data.objects.new("Wake and flying spray",bpy.data.meshes.new("Empty water"))
    scene.collection.objects.link(water)
    events,drops=water_events(leaps)
    return count


if __name__ == "__main__":
    args=sys.argv[sys.argv.index("--")+1:]
    family,level=args[0],int(args[1])
    count=setup_shot(family,level)
    out=HERE.parents[1]/"assets"/"videos"/"dolphin-renders"/f"{family}-{level}"
    out.mkdir(parents=True,exist_ok=True)
    for frame in (list(map(int,args[2:])) or range(1,count+1)):
        place(frame)
        scene.render.filepath=str(out/f"{frame:03}.png")
        bpy.ops.render.render(write_still=True)
