"""Build the movement study from the two CC0 GLBs in assets/videos, in Blender 5."""
from pathlib import Path
from math import radians, cos, sin, pi
import random

import bpy
from mathutils import Matrix, Quaternion, Vector

HERE = Path(__file__).resolve().parent
REF = HERE.parents[1] / "assets/videos"
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 12
scene.cycles.max_bounces = 4
scene.render.resolution_x, scene.render.resolution_y = 656, 480
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.render.image_settings.color_mode = "RGBA"
scene.render.image_settings.file_format = "PNG"
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 72
scene.world = bpy.data.worlds.new("Soft studio fill")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.45,.53,.58,1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .43
bpy.context.preferences.filepaths.save_version = 0
scene.view_settings.view_transform = "AgX"

def import_glb(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(REF / name))
    return set(bpy.data.objects)-before

donor = import_glb("whale-rig-source.glb")
rig = next(o for o in donor if o.type == "ARMATURE")
rig.animation_data_clear()
rig.parent = None
rig.matrix_world = Matrix.Identity(4)
rig.name = "Breach • Quaternius whale armature"
rig.data.name = "Whale armature • fitted to orca"
for o in donor - {rig}:
    bpy.data.objects.remove(o, do_unlink=True)
for p in rig.pose.bones:
    p.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bones = rig.data.edit_bones
for b in bones: b.use_connect = False
rest = {
    "Root": ((.93,0,.04),(1.22,0,.04)),
    "Head": ((1.04,0,.04),(3.42,0,.02)),
    "Spine1": ((1.04,0,.04),(.17,0,.04)),
    "Spine2": ((.17,0,.04),(-.98,0,.045)),
    "Spine3": ((-.98,0,.045),(-2.02,0,.035)),
    "Spine4": ((-2.02,0,.035),(-2.88,0,.005)),
    "Tail": ((-2.88,0,.005),(-3.58,0,.0)),
}
for side, s in (("L",1),("R",-1)):
    points=[(1.9,s*.56,-.39),(1.65,s*.85,-.64),(1.39,s*1.14,-.80),(1.07,s*1.42,-.91)]
    for i, part in enumerate(("TopFlipper","MidFlipper","BottomFlipper")):
        rest[part+"."+side] = (points[i], points[i+1])
for k,(a,b) in rest.items():
    bones[k].head=a
    bones[k].tail=b
    bones[k].roll=0
bpy.ops.object.mode_set(mode="OBJECT")

animal=import_glb("orca-study-source.glb")
skin=next(o for o in animal if o.name.startswith("Continuous anatomical"))
def smooth(lo,hi,x):
    t=min(1,max(0,(x-lo)/(hi-lo)))
    return t*t*(3-2*t)

# Chain centres overlap across adjacent joints. Each flipper attaches only inside its
# own lower shoulder; the nearby eye patches and upper flank stay on the body.
centres=[(-3.22,"Tail"),(-2.46,"Spine4"),(-1.48,"Spine3"),(-.42,"Spine2"),(.64,"Spine1"),(1.99,"Head")]
def skin_weights(x,y,z):
    weights={centres[0][1]:1} if x<=centres[0][0] else {centres[-1][1]:1}
    for (a,prev),(b,nxt) in zip(centres,centres[1:]):
        if a<=x<=b:
            t=smooth(a,b,x)
            weights={prev:1-t,nxt:t}
            break
    wing=smooth(.48,.83,abs(y))*smooth(.30,.58,-z)*smooth(.87,1.07,x)*(1-smooth(2.18,2.38,x))
    if wing:
        side="L" if y>0 else "R"
        span=min(2,max(0,(abs(y)-.77)/.33))
        weights={k:v*(1-wing) for k,v in weights.items()}
        names=["TopFlipper","MidFlipper","BottomFlipper"]
        for i,n in enumerate(names):
            weights[n+"."+side]=wing*max(0,1-abs(span-i))
    return weights
bpy.context.view_layer.update()
for o in list(animal):
    if o.type!="MESH": continue
    m=o.matrix_world.copy()
    m.translation.z-=.94289756
    o.data.transform(m)
    o.parent=rig
    o.matrix_parent_inverse=Matrix.Identity(4)
    o.matrix_basis=Matrix.Identity(4)
    groups={k:o.vertex_groups.new(name=k) for k in rest}
    for v in o.data.vertices:
        weights=skin_weights(*v.co) if o==skin else {"Head":1}
        for k,w in weights.items():
            if w>1e-6: groups[k].add([v.index],w,"REPLACE")
    mod=o.modifiers.new("Spine, flukes and pectoral fins","ARMATURE")
    mod.object=rig
    mod.use_deform_preserve_volume=True
for o in animal:
    if o.type=="EMPTY": bpy.data.objects.remove(o,do_unlink=True)

# Clip the submerged portion in world coordinates, for either camera and a true alpha plate.
def waterline(m):
    nodes=m.node_tree.nodes; link=m.node_tree.links.new
    out=next(n for n in nodes if n.type=="OUTPUT_MATERIAL")
    old=out.inputs["Surface"].links[0].from_socket
    geo=nodes.new("ShaderNodeNewGeometry")
    xyz=nodes.new("ShaderNodeSeparateXYZ"); link(geo.outputs["Position"],xyz.inputs[0])
    comp=nodes.new("ShaderNodeMath"); comp.operation="LESS_THAN"; link(xyz.outputs["Z"],comp.inputs[0]); comp.inputs[1].default_value=0
    cut=nodes.new("ShaderNodeMixShader"); link(comp.outputs[0],cut.inputs[0])
    link(old,cut.inputs[1]); link(nodes.new("ShaderNodeBsdfTransparent").outputs[0],cut.inputs[2])
    link(cut.outputs[0],out.inputs["Surface"])

coat=skin.active_material
nodes=coat.node_tree.nodes; link=coat.node_tree.links.new
shader=next(n for n in nodes if n.type=="BSDF_PRINCIPLED")
original=shader.inputs["Base Color"].links[0].from_socket
ramp=nodes.new("ShaderNodeValToRGB"); ramp.label="Ember charcoal and warm ivory"
def palette(ramp, stops):
    a=ramp.color_ramp.elements
    a.remove(a[1])
    for i,(value,color) in enumerate(stops):
        stop=a.new(value) if i else a[0]
        stop.position=value; stop.color=(*color,1)
palette(ramp,[(0,(.014,.020,.027)),(.12,(.027,.036,.045)),(.28,(.19,.20,.195)),(.68,(.86,.81,.68)),(1,(1,.95,.83))])
link(original,ramp.inputs[0]);link(ramp.outputs["Color"],shader.inputs["Base Color"])
shader.inputs["Roughness"].default_value=.38
shader.inputs["Coat Weight"].default_value=.16
shader.inputs["Coat Roughness"].default_value=.28
for m in {m for o in rig.children if o.type=="MESH" for m in o.data.materials if m}: waterline(m)

def pose_bone(name, rotation, frame):
    pb=rig.pose.bones[name]
    basis=pb.bone.matrix_local.to_quaternion()
    q=Quaternion()
    for axis,amount in zip(((1,0,0),(0,1,0),(0,0,1)),rotation):
        q=Quaternion(axis,radians(amount)) @ q
    pb.rotation_mode="QUATERNION"
    pb.rotation_quaternion=basis.inverted() @ q @ basis
    pb.keyframe_insert(data_path="rotation_quaternion",frame=frame,group=name)

# Position of the centre of mass and orientation of the trunk, in metres/degrees.
# Roll is longitudinal. The modest pitch-over is distinct from a level-three flip.
flight=[
 (1,-2.55,-3.67,68,34),(5,-2.30,-2.20,66,30),(10,-1.95,-.64,64,26),
 (16,-1.50,.88,57,14),(22,-1.01,1.94,46,-3),(27,-.57,2.32,34,-20),
 (31,-.20,2.34,21,-41),(36,.31,1.99,8,-65),(41,.84,1.24,-3,-82),
 (46,1.39,.12,-12,-97),(50,1.82,-1.12,-16,-98),(57,2.42,-3.19,-14,-91),
 (72,2.95,-4.30,-9,-85)]
rig.rotation_mode="XYZ"
for frame,x,z,pitch,roll in flight:
    rig.location=(x,-.11*x,z)
    rig.rotation_euler=(radians(roll),radians(-pitch),radians(-8))
    rig.keyframe_insert(data_path="location",frame=frame,group="Breach arc")
    rig.keyframe_insert(data_path="rotation_euler",frame=frame,group="Breach arc")
# A travelling bend from the shoulders to the flukes, then a late release as the flank hits.
# Pectoral sweeps are asymmetric. Their tips soften on the upstroke and fold towards the body on impact.
beats=[
# frame head  four posterior bends, flukes      near: lift,sweep   far: lift,sweep
 (1,   3, -7,-12,-17,-15,-11,  -10,-19,  8,15),
 (7,   0,  4,  5, -3, -9,-12,   -6,-12, 10,16),
 (13, -2,  -5,-10,-12, -7,  3,    5, -6,  4,10),
 (20, -4,  -4, -8,-12,-10, -6,   19, 14,-10,-1),
 (27, -6, -1, -6, -9, -7,-10,   37, 27,-26,-12),
 (34, -5,  3,  4,  1, -3, -6,   48, 33,-34,-19),
 (42, -2,  5,  8,  9,  6,  2,   34, 21,-22,-18),
 (48,  5,  3,  7, 10, 13, 11,    7, -8, -4, 0),
 (56,  4,  3,  6,  1, -8,-15,   -8,-29,  8,10),
 (72,  1,  0,  0,  0,  0,  0,   -9,-15,  8,12)]
for f,h,s1,s2,s3,s4,fluke,lift,sweep,far,far_sweep in beats:
    pose_bone("Head",(0,h,0),f)
    for i,(name,angle) in enumerate(zip(("Spine1","Spine2","Spine3","Spine4","Tail"),(s1,s2,s3,s4,fluke))):
        pose_bone(name,(-.09*lift if i<3 else 0,angle,(sweep/17 if i>0 else 0)),f)
    for side,sign,up,back in (("R",-1,lift,sweep),("L",1,-far,-far_sweep)):
        for name,share in (("TopFlipper",1),("MidFlipper",.30),("BottomFlipper",.19)):
            pose_bone(name+"."+side,(sign*up*share,0,sign*back*share),f)

def light(name,point,target,power,color,size):
    data=bpy.data.lights.new(name,"AREA"); data.energy=power; data.shape="DISK";data.size=size; data.color=color
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
    obj.location=point; obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
light("Softbox • pearl",(3,-7,10),(0,0,2),1400,(1,.90,.76),8)
light("Ember • warm grazing rim",(-4,4,7),(0,0,2),2400,(1,.35,.12),5)
light("Sky • cool fill",(2,5,9),(0,0,2),1000,(.64,.81,1),6)
light("Eye light",(8,-4,4),(0,0,2),390,(1,.84,.64),3)

def camera(name,at,target,scale):
    data=bpy.data.cameras.new(name); obj=bpy.data.objects.new(name,data); scene.collection.objects.link(obj)
    obj.location=at;obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
    data.type="ORTHO";data.ortho_scale=scale
    return obj
hero=camera("01 • Three-quarter",(10.7,-13,4.95),(-.12,0,2.37),9.65)
side=camera("02 • Side",(-.06,18,5.45),(-.06,0,2.37),10.1)
scene.camera=hero

# A sparse fan of droplets marks entry and impact. The open space between
# the two is intentional so the movement is legible before the splash.
def material(name,colour,roughness):
    m=bpy.data.materials.new(name); m.use_nodes=True; bs=m.node_tree.nodes.get("Principled BSDF")
    bs.inputs["Base Color"].default_value=(*colour,1);bs.inputs["Roughness"].default_value=roughness
    return m
foam=material("Foam • ivory",(.82,.87,.79),.36)
water=material("Spray • sea glass",(.27,.51,.53),.29)
spray_collection=bpy.data.collections.new("Water • breach footprint only")
scene.collection.children.link(spray_collection)
def to_spray(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    spray_collection.objects.link(o)
rng=random.Random(56)
def spray(centre,frame,count,force,reach):
    for j in range(count):
        a=2*pi*(j+rng.random())/count
        launch=frame+rng.randint(0,5)
        r=rng.uniform(.12,.43); horizontal=reach*rng.uniform(.38,1.15)
        velocity=force*rng.uniform(.48,1.12)
        life=2*velocity/12
        width=rng.uniform(.021,.051)*(1.2 if count>20 else 1)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1)
        o=bpy.context.object; o.name="Spray drop";to_spray(o)
        o.data.materials.append(foam if j%3 else water)
        for dt in (0,.16,.40,.63,.85,1):
            t=dt*life;rad=r+horizontal*t
            o.location=(centre+1.35*cos(a)*rad,sin(a)*rad,max(0,velocity*t-6*t*t))
            o.rotation_euler=Vector((1.35*cos(a)*horizontal,sin(a)*horizontal,velocity-12*t)).to_track_quat("Z","Y").to_euler()
            size=0 if dt in (0,1) else width*(1-.45*dt)
            o.scale=(size,size,size*(1.6+.26*abs(velocity-12*t)))
            for path in ("location","rotation_euler","scale"): o.keyframe_insert(data_path=path,frame=launch+t*30)
def sheets(cx,cy,frame,radius,height):
    for j in range(5):
        a=2*pi*j/5+rng.uniform(-.15,.15)
        verts=[];faces=[]
        for i in range(13):
            u=i/12; ang=a+(u-.5)*.78
            edge=sin(pi*u)**.7
            lip=edge*(.68+.32*(.5+.5*sin(u*8+j*1.9)))
            for row in range(4):
                v=row/3
                rr=radius*(.39+.64*v-.18*v*v)*(1+.055*sin(u*6+j))
                verts.append((1.23*rr*cos(ang),rr*sin(ang),.025+height*lip*v))
            if i:
                for k in range(3):
                    n=4*i+k;faces.append((n-4,n,n+1,n-3))
        mesh=bpy.data.meshes.new("Broken spray sheet");mesh.from_pydata(verts,[],faces);mesh.update()
        obj=bpy.data.objects.new("Breaking lip",mesh);spray_collection.objects.link(obj);obj.location=(cx,cy,0)
        mesh.materials.append(water);mesh.materials.append(foam)
        for poly in mesh.polygons:poly.use_smooth=True;poly.material_index=int(poly.index%3==2)
        for delta,xy,z in [(0,.15,0),(3,.50,.55),(8,.79,1),(14,1,.55),(21,1.14,.09),(24,1.17,0)]:
            obj.scale=(xy,xy,z) if z else (0,0,0)
            obj.keyframe_insert(data_path="scale",frame=frame+delta)
def ripple(cx, cy, frame, radius):
    for i in range(4):
        curve=bpy.data.curves.new("Foam trace","CURVE")
        curve.dimensions="3D"; curve.bevel_depth=.015; curve.bevel_resolution=2
        line=curve.splines.new("POLY"); line.points.add(24)
        for j,point in enumerate(line.points):
            t=j/24; a=2*pi*i/4+t*1.22
            rr=radius*(1+.045*sin(3*a+i))
            point.co=(1.3*rr*cos(a),rr*sin(a),0,1)
            point.radius=sin(pi*t)**.58*(.8+.2*cos(3*a))
        obj=bpy.data.objects.new("Surface eddy",curve);spray_collection.objects.link(obj)
        obj.location=(cx,cy,.025);curve.materials.append(water)
        for delta,xy,width in ((0,.15,0),(4,.46,.024),(12,.76,.022),(21,1,.014),(29,1.12,0)):
            obj.scale=(xy,xy,1); obj.keyframe_insert(data_path="scale",frame=frame+delta)
            curve.bevel_depth=width;curve.keyframe_insert(data_path="bevel_depth",frame=frame+delta)
ripple(-1.82,0,5,1.22)
ripple(-1.73,0,14,.96)
ripple(1.48,-.12,42,2.18)
spray(-1.9,7,18,3.25,1.6)
sheets(-1.9,0,6,1.10,.36)
spray(1.57,42,34,4.5,3.35)
sheets(1.58,-.12,42,2.02,.74)
for frame,name in [(4,"Surface"),(13,"Thrust"),(25,"Flipper opens"),(31,"Crest"),(39,"Roll"),(45,"Flank contact"),(53,"Splash")]:
    scene.timeline_markers.new(name,frame=frame)
scene.frame_set(29)
scene.render.filepath="//frames/game-"
credits=bpy.data.texts.new("Credits and shot notes")
credits.write("Ember Orca / Level 2. 30 fps. Both cameras see one animated armature.\nMesh adapted from Innerscene, Killer whale (orca), CC0. https://www.innerscene.com/tools/library/3d-parts/killer-whale-orca-d98788fe\nWhale skeleton adapted from Quaternius, Whale, CC0. https://poly.pizza/m/JGFwp6xWgk\nMotion reference: Ka6EMpoDr64 at 1:02; yKal5nKhBVI. Original breach action, materials, light and splash.\n")
for area in bpy.context.screen.areas:
    if area.type=="VIEW_3D":
        area.spaces.active.region_3d.view_perspective="CAMERA"
        area.spaces.active.overlay.show_overlays=False
bpy.ops.object.select_all(action="DESELECT")
rig.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/"ember-orca-level-2.blend"),compress=True)
