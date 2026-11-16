"""Render the three concepts with the rig and lens from ember-orca-level-2.blend.

blender -b ember-orca-level-2.blend -P progression.py -- 1 [frame ...]
Use 2 or 3 for the breaches. Without frame numbers, render the entire shot.
"""
from pathlib import Path
from math import cos, pi, radians, sin
import random
import sys

import bpy
from mathutils import Matrix, Quaternion, Vector

args = sys.argv[sys.argv.index("--") + 1:]
level = int(args[0])
if level not in (1, 2, 3):
    raise ValueError("Choose an orca level from 1 to 3.")
scene = bpy.context.scene
rig = next(o for o in scene.objects if o.type == "ARMATURE")
camera = next(o for o in scene.objects if o.type == "CAMERA" and o.name.startswith("01"))
scene.camera = camera
water_objects = next(c for c in bpy.data.collections if c.name.startswith("Water"))
if level != 2:
    rig.animation_data_clear()
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    for obj in list(water_objects.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
scene.timeline_markers.clear()
scene.render.resolution_percentage = 80
scene.cycles.samples = 5 if level == 1 else 16
scene.render.threads_mode = "FIXED"
scene.render.threads = 12
scene.frame_end = {1:72, 2:86, 3:126}[level]
foam = bpy.data.materials["Foam • ivory"]
water = bpy.data.materials["Spray • sea glass"]
rng = random.Random(527 + level)


def key(obj, prop, frame, value):
    setattr(obj, prop, value)
    obj.keyframe_insert(data_path=prop, frame=frame)


def root_pose(frame, x, z, pitch, roll, yaw):
    key(rig, "location", frame, (x, -0.11*x, z))
    # Continuous Euler pitch also records the winding of the full somersault.
    key(rig, "rotation_euler", frame, tuple(map(radians, (roll, -pitch, yaw))))


def bend(name, frame, x=0, y=0, z=0):
    pb = rig.pose.bones[name]
    basis = pb.bone.matrix_local.to_quaternion()
    q = Quaternion()
    for axis, angle in zip(((1,0,0), (0,1,0), (0,0,1)), (x,y,z)):
        q = Quaternion(axis, radians(angle)) @ q
    pb.rotation_mode = "QUATERNION"
    key(pb, "rotation_quaternion", frame, basis.inverted() @ q @ basis)


def posture(frame, head, back, fluke, fins):
    bend("Head", frame, y=head)
    for name, amount in zip(("Spine1", "Spine2", "Spine3", "Spine4", "Tail"), (*back, fluke)):
        bend(name, frame, y=amount)
    for side, sign in (("R", -1), ("L", 1)):
        lift, sweep = fins
        for name, fraction in (("TopFlipper", 1), ("MidFlipper", .32), ("BottomFlipper", .2)):
            bend(name + "." + side, frame, x=sign*lift*fraction, z=sign*sweep*fraction)


def trace(name, points, radii, thickness, material):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 2
    data.bevel_resolution = 2
    data.bevel_depth = thickness
    spline = data.splines.new("POLY")
    spline.points.add(len(points)-1)
    for point, pos, radius in zip(spline.points, points, radii):
        point.co = (*pos, 1)
        point.radius = radius
    obj = bpy.data.objects.new(name, data)
    water_objects.objects.link(obj)
    data.materials.append(material)
    return obj


def wake(centre, birth, radius, life):
    for i in range(5):
        points, radii = [], []
        for j in range(23):
            t = j/22
            a = (i + t*.76)*2*pi/5
            r = radius*(1 + .035*sin(3*a+i))
            points.append((1.22*r*cos(a), r*sin(a), .012))
            radii.append(sin(pi*t)**.6)
        line = trace("Broken wake", points, radii, .028, water if i%2 else foam)
        line.location = centre
        for t, spread, width in ((0,.25,0),(.2,.50,1),(.67,.94,.62),(1,1.18,0)):
            key(line, "scale", birth+life*t, (spread,spread,1))
            key(line.data, "bevel_depth", birth+life*t, width*.028)


drop_meshes = {}


def droplet(origin, birth, speed, gravity, size, material):
    vx,vy,vz = speed
    life = (vz + (vz*vz+2*gravity*origin.z)**.5)/gravity
    if material not in drop_meshes:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1)
        drop = bpy.context.object
        drop.data.materials.append(material)
        drop_meshes[material] = drop.data
    else:
        drop = bpy.data.objects.new("Airborne bead",drop_meshes[material])
        water_objects.objects.link(drop)
    drop.name = "Airborne bead"
    for t in (0,.10,.33,.57,.81,1):
        sec = t*life
        frame = birth + 30*sec
        pos = origin + Vector((vx*sec,vy*sec,vz*sec-gravity*sec*sec/2))
        key(drop, "location", frame, pos)
        key(drop, "rotation_euler", frame, Vector((vx,vy,vz-gravity*sec)).to_track_quat("Z","Y").to_euler())
        r = 0 if t in (0,1) else size*(1-.38*t)
        key(drop, "scale", frame, (r,r,r*(1.25+.21*abs(vz-gravity*sec))))


def mist_material(fade=False):
    # Soft-edged, mottled puffs give the breath volume against any background.
    mat = bpy.data.materials.new("Sunlit vapour")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    link = mat.node_tree.links.new
    uv = nodes.new("ShaderNodeTexCoord").outputs["UV"]
    distance = nodes.new("ShaderNodeVectorMath")
    distance.operation = "DISTANCE"
    distance.inputs[1].default_value = (.5,.5,0)
    link(uv, distance.inputs[0])
    fade = nodes.new("ShaderNodeValToRGB")
    ramp = fade.color_ramp
    ramp.interpolation = "EASE"
    ramp.elements[0].color = (.59,.59,.59,1)
    ramp.elements[1].position = .49
    ramp.elements[1].color = (0,0,0,1)
    link(distance.outputs["Value"], fade.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 5
    link(uv,noise.inputs[0])
    strength = nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    link(fade.outputs[0],strength.inputs[0])
    link(noise.outputs["Fac"],strength.inputs[1])
    mix = nodes.new("ShaderNodeMixShader")
    opacity = strength.outputs[0]
    if fade:
        dissolve = nodes.new("ShaderNodeMath")
        dissolve.operation = "MULTIPLY"
        link(opacity,dissolve.inputs[0])
        link(nodes.new("ShaderNodeObjectInfo").outputs["Alpha"],dissolve.inputs[1])
        opacity = dissolve.outputs[0]
    link(opacity,mix.inputs[0])
    link(nodes.new("ShaderNodeBsdfTransparent").outputs[0],mix.inputs[1])
    scatter = nodes.new("ShaderNodeEmission")
    scatter.inputs["Color"].default_value = (.73,.90,.95,1)
    scatter.inputs["Strength"].default_value = 1.6
    link(scatter.outputs[0],mix.inputs[2])
    link(mix.outputs[0],nodes.get("Material Output").inputs[0])
    return mat


def exhale():
    vapour = mist_material()
    head = rig.pose.bones["Head"]

    def blowhole(frame):
        scene.frame_set(int(frame), subframe=frame%1)
        return rig.matrix_world @ head.matrix @ head.bone.matrix_local.inverted() @ Vector((1.73,0,.69))

    # The first narrow jets stay attached to the crown while the wider cloud
    # above them drifts independently after the breath ends.
    for side in (-1,1):
        points, widths = [], []
        for k in range(17):
            t = k/16
            points.append((.12*t+.28*t*t+side*.10*t*t,side*.12*t,.93*t))
            widths.append(.12+.88*sin(pi*t)**.8)
        jet = trace("Breath core",points,widths,.033,foam)
        for f, spread in ((19,0),(23,.54),(27,1),(31,.9),(34,.75),(38,.16),(40,0)):
            key(jet,"location",f,blowhole(f))
            key(jet,"scale",f,(spread,spread,spread))

    for j in range(58):
        birth = rng.uniform(19,37)
        origin = blowhole(birth)
        side = rng.uniform(-1,1)
        if j < 28:
            bpy.ops.mesh.primitive_plane_add(size=2)
            puff = bpy.context.object
            puff.name = "Breath vapour"
            puff.visible_shadow = False
            puff.rotation_euler = camera.rotation_euler
            puff.data.materials.append(vapour)
            height, drift = rng.uniform(1.10,2.00), rng.uniform(.1,.92)
            life, radius = rng.uniform(12,23), rng.uniform(.29,.52)
            for t, grow in ((0,0),(.12,.24),(.52,.87),(.77,1),(1,0)):
                key(puff, "location", birth+t*life, origin+Vector((drift*t+side*.83*t*t,side*.69*t, height*(1-(1-t)**1.8))))
                key(puff, "scale", birth+t*life, (grow*radius,grow*radius*(1.18+.30*(1-t)),1))
        else:
            droplet(origin,birth,(rng.uniform(-1.7,2.9),side*2.1,rng.uniform(3.4,6.4)),16,
                    rng.uniform(.018,.033),foam if j%3 else water)


def broken_water():
    """Striations whiten towards the lip, where turbulence tears holes in the film."""
    mat = water.copy()
    mat.name = "Aerated water • torn foam"
    nodes = mat.node_tree.nodes
    link = mat.node_tree.links.new
    uv = nodes.new("ShaderNodeTexCoord").outputs["UV"]
    xyz = nodes.new("ShaderNodeSeparateXYZ")
    link(uv,xyz.inputs[0])
    stretch = nodes.new("ShaderNodeVectorMath")
    stretch.operation = "MULTIPLY"
    stretch.inputs[1].default_value = (3.6,1.1,1)
    link(uv,stretch.inputs[0])
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.4
    noise.inputs["Distortion"].default_value = .55
    link(stretch.outputs[0],noise.inputs[0])

    def multiply_add(a,b,c):
        node = nodes.new("ShaderNodeMath")
        node.operation = "MULTIPLY_ADD"
        for socket,value in zip(node.inputs,(a,b,c)):
            if isinstance(value,(int,float)):
                socket.default_value = value
            else:
                link(value,socket)
        return node.outputs[0]

    def ramp(source, stops):
        node = nodes.new("ShaderNodeValToRGB")
        link(source,node.inputs[0])
        colours = node.color_ramp.elements
        colours.remove(colours[1])
        for i,(at,value) in enumerate(stops):
            stop = colours.new(at) if i else colours[0]
            stop.position = at
            stop.color = (*value,1)
        return node.outputs[0]

    v = xyz.outputs["Y"]
    marbling = multiply_add(v,.36,noise.outputs["Fac"])
    colour = ramp(marbling,[(.23,(.014,.10,.16)),(.49,(.042,.24,.33)),(.68,(.16,.51,.60)),
                            (.84,(.59,.82,.84)),(.96,(.96,.98,.90))])
    body = nodes.get("Principled BSDF")
    link(colour,body.inputs["Base Color"])
    body.inputs["Coat Weight"].default_value = .20
    body.inputs["Roughness"].default_value = .30
    ragged = multiply_add(v,-.23,noise.outputs["Fac"])
    density = ramp(ragged,[(.14,(0,0,0)),(.28,(.14,.14,.14)),(.40,(.78,.78,.78)),(.58,(.98,.98,.98))])
    opacity = multiply_add(density,nodes.new("ShaderNodeObjectInfo").outputs["Alpha"],0)
    mix = nodes.new("ShaderNodeMixShader")
    link(opacity,mix.inputs[0])
    link(nodes.new("ShaderNodeBsdfTransparent").outputs[0],mix.inputs[1])
    link(body.outputs[0],mix.inputs[2])
    link(mix.outputs[0],nodes.get("Material Output").inputs[0])
    return mat


def breaker(centre, birth, angle, spread, reach, height, life, colour, bead_count):
    """An open sheet of water. Its lip overtakes the foot, rolls over and sheds spray."""
    across = 48
    rows = 12
    phase = rng.uniform(0,2*pi)
    foot = .50 if level == 2 else .69

    def point(u, v, age):
        # The crumpled rim stretches sideways on the way down. Thickness and
        # scallops vary along it, even when two adjacent sheets overlap.
        stretch = .14 + .96*(1-(1-age)**1.6)
        lift = sin(pi*age)**.92
        bell = sin(pi*u)**.58
        teeth = .74 + .20*sin(15*u+phase) + .11*cos(33*u-phase) + .045*sin(59*u)
        curl = age*age*v**3
        theta = angle + spread*(u-.5) + .21*v*sin(phase+5*u)
        r = foot + reach*stretch*(.11+.47*v+.48*v*v+.21*curl)*(1+.11*sin(11*u+phase))
        z = height*lift*bell*teeth*(v+.35*sin(pi*v)-.47*age*v**5)
        return Vector((r*cos(theta),r*sin(theta),max(0,z)))

    def coordinates(age):
        return [point(i/across,j/rows,age) for i in range(across+1) for j in range(rows+1)]

    faces = []
    for i in range(across):
        for j in range(rows):
            n = i*(rows+1)+j
            faces.append((n,n+rows+1,n+rows+2,n+1))

    mesh = bpy.data.meshes.new("Folding water sheet")
    mesh.from_pydata(coordinates(0),[],faces)
    mesh.update()
    sheet = bpy.data.objects.new("Breaking fan",mesh)
    water_objects.objects.link(sheet)
    sheet.location = centre
    sheet.visible_shadow = False
    mesh.materials.append(colour)
    uv = mesh.uv_layers.new()
    for loop in mesh.loops:
        i,j = divmod(loop.vertex_index,rows+1)
        uv.data[loop.index].uv = (i/across+phase,j/rows)
    for poly in mesh.polygons:
        poly.use_smooth = True

    sheet.shape_key_add(name="Contact")
    morph = mesh.shape_keys
    morph.use_relative = False
    for age in (0,.19,.41,.58,.78,1):
        if age:
            pose = sheet.shape_key_add(name=f"Break {age:.2f}", from_mix=False)
            pose.interpolation = "KEY_LINEAR"
            for vertex,pos in zip(pose.data,coordinates(age)):
                vertex.co = pos
        key(morph,"eval_time",birth+age*life,morph.key_blocks[-1].frame)
    for offset,size in ((0,0),(1,1),(life-3,1),(life,0)):
        key(sheet,"scale",birth+offset,(size,)*3)
    for age,alpha in ((0,0),(.12,.90),(.47,1),(.67,.65),(.84,.2),(1,0)):
        key(sheet,"color",birth+life*age,(1,1,1,alpha))

    # The heavy beads leave the moving lip, so the spray is connected to the
    # sheet at separation and continues ballistically after the sheet falls.
    for j in range(bead_count):
        u = rng.uniform(.07,.93)
        age = rng.uniform(.23,.53)
        pos = point(u,1,age)
        radial = Vector((pos.x,pos.y,0)).normalized()
        velocity = radial*rng.uniform(.45,1.1)*reach/life*30
        velocity.z = rng.uniform(2.2,6.5) if level==3 else rng.uniform(1.6,4.6)
        droplet(centre+pos,birth+age*life,velocity,24,
                rng.uniform(.033,.095)*(1.18 if level==3 else 1),foam if j%3 else water)


def impact_mist(centre, birth, big):
    # Air entrained at the lip hangs briefly after the heavier sheets collapse.
    material = mist_material(fade=True)
    bpy.ops.mesh.primitive_plane_add(size=2)
    first = bpy.context.object
    first.data.materials.append(material)
    for i in range(64 if big else 25):
        puff = first if i==0 else bpy.data.objects.new("Spindrift",first.data)
        if i:
            water_objects.objects.link(puff)
        puff.visible_shadow = False
        puff.rotation_euler = camera.rotation_euler
        angle = rng.uniform(0,2*pi)
        direction = Vector((cos(angle),sin(angle),0))
        central = big and i%2==0
        height = rng.uniform(3.2,6.3) if central else rng.uniform(1.1,2.7)*(1 if big else .70)
        drift = rng.uniform(.5,1.6) if central else rng.uniform(1.2,3.6)*(1 if big else .77)
        start = birth + rng.uniform(7,13) if central else birth + rng.uniform(1,6)
        life = rng.uniform(20,34)
        r = rng.uniform(.32,.85)*(1.3 if big else .76)
        for t,alpha in ((0,0),(.20,.64),(.46,1),(.68,.69),(1,0)):
            pos = centre + direction*(.35+drift*t)
            pos.z += height*(1-(1-t)**2) - height*.52*t**3
            size = r*(.20+1.24*t)
            key(puff,"location",start+t*life,pos)
            key(puff,"scale",start+t*life,(size,size*(1.31-.43*t),1))
            key(puff,"color",start+t*life,(1,1,1,alpha))
        # Keep the fully dissolved plane out of the BVH on later frames.
        key(puff,"scale",start+life+1,(0,0,0))


def impact(centre, birth):
    deep = broken_water()
    scene.cycles.transparent_max_bounces = 48
    # Outer fans turn across the camera. A flank slap throws low and wide;
    # the heavier flip displaces water in a wider ring before it rebounds.
    big = level == 3
    count = 9 if big else 7
    for i in range(count):
        angle = 2*pi*(i+.19)/count
        reach = rng.uniform(3.6,5.0) if big else rng.uniform(2.25,3.2)
        height = rng.uniform(2.4,4.2) if big else rng.uniform(1.35,2.25)
        breaker(centre,birth+rng.uniform(0,3),angle,rng.uniform(.72,1.12),
                reach,height,26 if big else 23,deep,27 if big else 16)

    if big:
        # Water rushes back into the cavity left by the body. Three overlapping
        # tongues rise from that small footprint and break at different times.
        for delay,angle,reach,height in ((5,2.98,2.18,4.8),(7,.75,2.39,7.5),(9,4.54,1.47,5.7)):
            breaker(centre,birth+delay,angle,1.75,reach,height,28,deep,42)
        # Bursts of foam travel together at first, then split as their speeds
        # diverge. These tops keep the rebound from reading as solid spikes.
        for group in range(19):
            angle = 2*pi*group/19
            launch = birth+rng.uniform(4,10)
            speed = rng.uniform(1.2,3)
            lift = rng.uniform(12,18.4)
            for bead in range(7):
                a = angle+rng.uniform(-.3,.3)
                origin = centre+Vector((.49*cos(a),.49*sin(a),.02))
                velocity = (speed*cos(a)+rng.uniform(-.45,.45),speed*sin(a)+rng.uniform(-.45,.45),
                            lift+rng.uniform(-1.2,1.2))
                droplet(origin,launch+rng.uniform(-1,1),velocity,27,rng.uniform(.040,.106),
                        foam if bead%3 else water)

    count = 100 if big else 48
    for i in range(count):
        angle = 2*pi*(i+rng.random())/count
        origin = centre+Vector((.48*cos(angle),.48*sin(angle),.02))
        rebound = big and i%3!=0
        if rebound:
            rise = rng.uniform(10,17)
            speed = rng.uniform(.7,2.4)
            delay = rng.uniform(6,10)
        else:
            rise = rng.uniform(6,10) if big else rng.uniform(4.5,8.1)
            speed = rng.uniform(2,4.5) if big else rng.uniform(1.4,3.6)
            delay = rng.uniform(0,4)
        droplet(origin,birth+delay,(speed*cos(angle),speed*sin(angle),rise),26,
                rng.uniform(.03,.09),foam if i%4 else water)
    wake(centre,birth+2,3.9 if big else 2.55,36 if big else 30)
    wake(centre,birth+11,3.0 if big else 1.92,34 if big else 28)
    impact_mist(centre,birth,big)


if level == 1:
    # Brief spyhop. The tail stays under and the crown clears the surface well
    # before the breath. Drift carries the exhaled air past the sinking head.
    camera.location += Vector((.56,0,-.88))
    camera.data.ortho_scale = 8.4
    scene.cycles.transparent_max_bounces = 80
    flight = [(1,-.70,-2.55,21,3,-9),(9,-.58,-1.37,30,4,-9),
              (17,-.44,-.63,34,5,-8),(24,-.32,-.33,31,6,-8),
              (32,-.18,-.28,28,4,-7),(42,.04,-.53,22,1,-7),
              (54,.36,-1.28,13,-2,-8),(64,.59,-2.4,7,-3,-9)]
    for beat in flight: root_pose(*beat)
    for f,h,b,tail,fins in [(1,1,(2,3,6,8),4,(8,-9)),(19,-3,(-1,-3,-5,-7),-7,(18,4)),
                              (35,-1,(0,-1,-3,-5),-3,(14,7)),(59,4,(3,5,6,4),8,(4,-12))]:
        posture(f,h,b,tail,fins)
    wake(Vector((.73,0,.01)),6,.99,35)
    wake(Vector((.60,0,.01)),22,1.4,40)
    wake(Vector((1.45,-.1,.01)),46,.91,24)
    exhale()
elif level == 2:
    # Keep the original action and launch water from the approved .blend.
    # Overscan and a horizontal lens shift leave room beside the flank slap.
    scene.render.resolution_x,scene.render.resolution_y = 752,512
    camera.data.ortho_scale *= 752/656
    camera.data.shift_x = .065
    impact(Vector((1.57,-.12,.015)),44)
else:
    camera.location += Vector((0,0,1.70))
    scene.render.resolution_x,scene.render.resolution_y = 784,576
    camera.data.ortho_scale = 14.3*784/656
    camera.data.shift_x = .084
    rig.scale = (1.23,1.23,1.23)
    flight = [(1,-3.5,-4.2,57,18,-5),(8,-3.0,-1.1,60,14,-3),
              (16,-2.34,1.68,67,10,3),(23,-1.76,3.40,93,6,13),
              (31,-1.08,4.69,137,-7,23),(38,-.48,5.06,192,-18,28),
              (45,.12,4.99,249,-22,26),(52,.72,4.54,310,-17,21),
              (59,1.32,3.56,374,-8,14),(65,1.84,2.05,419,-15,8),
              (70,2.27,.34,428,-39,1),(76,2.79,-2.60,409,-63,-7),
              (83,3.21,-4.82,389,-70,-12)]
    for beat in flight: root_pose(*beat)
    for f,h,b,tail,fins in [(1,4,(-5,-10,-12,-13),-9,(3,-15)),(13,-4,(1,4,8,9),15,(24,12)),
                            (25,-8,(-4,-8,-11,-14),-12,(35,14)),(38,-11,(-7,-11,-15,-17),-14,(12,-24)),
                            (49,-9,(-7,-12,-16,-15),-8,(6,-29)),(60,-4,(-2,-4,-7,-9),-5,(22,-9)),
                            (69,3,(4,7,9,12),11,(36,19)),(80,5,(2,5,8,6),8,(6,-18))]:
        posture(f,h,b,tail,fins)
    wake(Vector((-2.35,0,.01)),4,1.32,33)
    for j in range(22):
        a = j*2*pi/22
        droplet(Vector((-2.5+.48*cos(a),.48*sin(a),.02)),rng.uniform(6,12),
                (1.55*cos(a),1.55*sin(a),rng.uniform(2.8,4.2)),13,.039,foam if j%3 else water)
    impact(Vector((2.22,-.20,.01)),68)

folder = Path(__file__).resolve().parents[2]/"assets/videos"/f"orca-level-{level}"
folder.mkdir(parents=True,exist_ok=True)
frames = list(map(int,args[1:])) or range(1,scene.frame_end+1)
for frame in frames:
    filepath = folder/f"{frame:03}.png"
    scene.frame_set(frame)
    scene.render.filepath = str(filepath)
    bpy.ops.render.render(write_still=True)
