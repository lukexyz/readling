"""Procedural dolphin for Blender 5.3. Importing this module leaves the scene alone.

    root, pose = build_dolphin("Pilot")
    root.location = (0, 0, 2)
    pose(flex=0.28, tail=-0.16, bank_fin=0.12)

The root is an armature in the current collection. Its origin is the animal's
centre, +X points towards the beak, +Z towards the back, +Y away from the
game camera. Rest length is about four Blender units. Move, rotate or scale
the root to place the whole animal. Call the builder in Object Mode.

The three pose arguments are absolute angles in radians. Positive flex raises
the tail through a distributed bend from the rib cage to the caudal peduncle.
Positive tail adds upward fluke pitch relative to the peduncle. Positive
bank_fin lowers the camera-side pectoral and raises its mate. A natural working
range is about ±0.6 radians per channel. pose(0, 0, 0) restores the rest shape.
Updates are immediate pose-bone assignments. Each call to build_dolphin owns
its rig, mesh, and materials, even when names repeat.
"""

from bisect import bisect_right
from math import asin, cos, exp, pi, sin, sqrt

import bpy
from mathutils import Quaternion, Vector


def _smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def _mix(a, b, t):
    return tuple(v + (w - v) * t for v, w in zip(a, b))


def _rgb(code):
    def linear(v):
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    return tuple(linear(int(code[i:i + 2], 16) / 255) for i in (0, 2, 4))


class _Sections:
    """Smoothly interpolate measured outlines without overshooting a thin tip."""

    def __init__(self, rows):
        self.u = [r[0] for r in rows]
        self.values = [r[1:] for r in rows]
        slopes = [tuple((b - a) / (v - u) for a, b in zip(left, right))
                  for u, v, left, right in zip(self.u, self.u[1:],
                                               self.values, self.values[1:])]
        self.tangents = [slopes[0]]
        for left, right in zip(slopes, slopes[1:]):
            self.tangents.append(tuple(2 * a * b / (a + b) if a * b > 0 else 0
                                       for a, b in zip(left, right)))
        self.tangents.append(slopes[-1])

    def at(self, u):
        i = min(len(self.u) - 2, max(0, bisect_right(self.u, u) - 1))
        step = self.u[i + 1] - self.u[i]
        t = min(1, max(0, (u - self.u[i]) / step))
        s = 1 - t
        return tuple(s*s*(1+2*t)*a + t*t*(3-2*t)*b
                     + step * t*s*(s*da - t*db)
                     for a, b, da, db in zip(self.values[i], self.values[i+1],
                                              self.tangents[i], self.tangents[i+1]))

    def stations(self, subdivisions):
        for a, b in zip(self.u, self.u[1:]):
            for j in range(subdivisions):
                yield a + (b - a) * j / subdivisions
        yield self.u[-1]


# x, half-breadth, keel, crown. The narrow vertical stock changes into a
# round thorax, then a distinct forehead and a flattened, slightly upturned bill.
_BODY = _Sections((
    (-1.87, .008, -.090, -.073), (-1.81, .075, -.125, -.035),
    (-1.64, .093, -.169, .005), (-1.47, .094, -.194, .060),
    (-1.24, .124, -.222, .145), (-.94, .175, -.263, .253),
    (-.62, .244, -.323, .354), (-.26, .316, -.387, .442),
    (.10, .365, -.424, .487), (.45, .386, -.414, .503),
    (.72, .378, -.384, .497), (.96, .350, -.332, .475),
    (1.13, .310, -.272, .437), (1.27, .262, -.208, .372),
    (1.39, .205, -.162, .263), (1.48, .154, -.131, .138),
    (1.54, .125, -.110, .071), (1.60, .116, -.098, .066),
    (1.77, .093, -.074, .070), (1.93, .067, -.045, .080),
    (2.015, .041, -.016, .074), (2.043, .018, .009, .057),
    (2.050, .003, .029, .037),
))

_MANTLE, _BACK, _PEWTER, _OCHRE, _BELLY = map(
    _rgb, ("354854", "536873", "99a6a5", "b9a585", "e8e2ce"))
_FIN, _FIN_LIGHT, _FIN_UNDER = map(_rgb, ("425865", "637986", "99a5a4"))
_CREASE, _LID, _IRIS, _PUPIL = map(_rgb, ("403e3b", "616461", "70533b", "151b1c"))


def _pigment(x, h):
    # The mantle descends below the dorsal and turns back up towards the face.
    saddle = exp(-((x + .15) / .55) ** 2)
    border = .26 - .64 * saddle + .08 * sin(2.4 * x)
    warm = .69 * exp(-((x - .68) / .77) ** 2)
    flank = _mix(_PEWTER, _OCHRE, warm)
    flank = _mix(flank, _BELLY, 1 - _smooth(-.77, -.27 - .13 * saddle, h))
    top = _mix(_BACK, _MANTLE, _smooth(.30, .92, h))
    colour = _mix(flank, top, _smooth(border - .13, border + .13, h))
    # Narrow bridle from the orbit along the upper rostrum.
    bridle = .55 * _smooth(.94, 1.30, x) * exp(-((h - .10) / .19) ** 2)
    return _mix(colour, _BACK, bridle)


def _body_point(x, section, angle):
    width, floor, roof = section
    h = sin(angle)
    return (x, width * cos(angle) * (1 + .07 * h),
            (roof + floor + (roof - floor) * h) * .5)


def _cheek(x, z, side, offset):
    section = _BODY.at(x)
    _, floor, roof = section
    h = min(1, max(-1, (2*z - roof - floor) / (roof - floor)))
    _, y, _ = _body_point(x, section, asin(h))
    return (x, side * (y + offset), z)


_SPINE = ("Chest", "Back", "Loin", "Lumbar", "Tail stock", "Peduncle", "Flukes")
_JOINTS = (.38, -.16, -.66, -1.09, -1.41, -1.66)
_BLENDS = (.25, .24, .21, .18, .14, .105)


def _weights(x):
    for i, (joint, width) in enumerate(zip(_JOINTS, _BLENDS)):
        if x >= joint + width:
            return ((_SPINE[i], 1.0),)
        if x > joint - width:
            t = _smooth(joint - width, joint + width, x)
            return ((_SPINE[i], t), (_SPINE[i + 1], 1 - t))
    return ((_SPINE[-1], 1.0),)


class _Surface:
    """Collect lofts and conformal facial details into one weighted mesh."""

    def __init__(self):
        self.vertices = []
        self.faces = []
        self.colours = []
        self.weights = []
        self.slots = []

    def vertex(self, xyz, colour, weights):
        i = len(self.vertices)
        self.vertices.append(xyz)
        self.colours.append((*colour, 1))
        self.weights.append(weights)
        return i

    def face(self, indices, flip=False, slot=0):
        self.faces.append(tuple(reversed(indices)) if flip else tuple(indices))
        self.slots.append(slot)

    def stitch(self, a, b, flip=False, slot=0, closed=True):
        for i in range(len(a) if closed else len(a) - 1):
            j = (i + 1) % len(a)
            self.face((a[i], a[j], b[j], b[i]), flip, slot)

    def loft(self, rings, flip=False):
        first = prev = next(rings)
        self.face(first, not flip)
        for ring in rings:
            self.stitch(prev, ring, flip)
            prev = ring
        self.face(prev, flip)


def _trunk(skin):
    def rings():
        for x in _BODY.stations(5):
            section = _BODY.at(x)
            weights = _weights(x)
            ring = []
            for i in range(80):
                a = 2 * pi * i / 80
                ring.append(skin.vertex(_body_point(x, section, a),
                                        _pigment(x, sin(a)), weights))
            yield ring
    skin.loft(rings())


# Stations across each foil give its leading and trailing edges, centreline
# height (or lateral position), and maximum half-thickness.
_DORSAL = _Sections((
    (.305, .46, -.68, 0, .140), (.405, .38, -.64, 0, .105),
    (.50, .246, -.56, 0, .071), (.61, .131, -.415, 0, .056),
    (.74, .024, -.350, 0, .044), (.86, -.100, -.337, 0, .035),
    (.955, -.235, -.366, 0, .022), (1.003, -.327, -.392, 0, .012),
    (1.020, -.391, -.402, 0, .003),
))
_PECTORAL = _Sections((
    (.195, .87, .36, -.136, .078), (.285, .86, .33, -.171, .081),
    (.370, .797, .312, -.204, .068), (.475, .716, .265, -.253, .055),
    (.588, .616, .185, -.328, .044), (.688, .487, .112, -.410, .034),
    (.775, .348, .055, -.483, .024), (.833, .219, .041, -.527, .015),
    (.862, .110, .055, -.548, .007), (.867, .075, .065, -.551, .002),
))
_FLUKE = _Sections((
    (0, -1.586, -1.866, -.079, .059), (.055, -1.579, -1.928, -.077, .061),
    (.15, -1.585, -1.980, -.080, .055), (.29, -1.62, -1.989, -.085, .047),
    (.44, -1.681, -1.976, -.091, .037), (.57, -1.767, -1.976, -.091, .027),
    (.675, -1.867, -1.996, -.077, .018), (.748, -1.958, -2.021, -.055, .009),
    (.778, -2.018, -2.032, -.047, .003),
))


def _foils(skin):
    def rings(profile, kind, side=1):
        stations = list(profile.stations(3))
        if kind == "fluke":
            stations = [-s for s in reversed(stations[1:])] + stations
        for span in stations:
            lead, trail, centre, thick = profile.at(abs(span))
            ring = []
            for i in range(36):
                a = 2 * pi * i / 36
                chord = (1 - cos(a)) * .5
                x = lead + (trail - lead) * chord
                # Rounded leading edge, greatest thickness ahead of mid-chord,
                # and a fine trailing edge. Both faces meet at each edge.
                foil = thick * sin(a) * (1.32 - .78 * chord)
                if kind == "dorsal":
                    xyz = (x, -foil, span)
                    anchor = x + (-.17 - x) * _smooth(.40, .85, span)
                    weights = _weights(anchor)
                    col = _mix(_MANTLE, _FIN, .43 * chord + .11 * sin(a)**2)
                elif kind == "fluke":
                    xyz = (x, span, centre + foil + .010 * sin(pi * chord))
                    weights = (("Flukes", 1),)
                    col = _mix(_FIN, _FIN_UNDER, .77 * _smooth(.05, .9, -sin(a)))
                else:
                    xyz = (x, side * span, centre + foil + .015 * sin(pi * chord))
                    t = _smooth(.25, .43, span)
                    weights = (("Chest", 1 - t), (_pec_name(side), t))
                    col = _mix(_FIN_LIGHT, _FIN, .35 + .52 * _smooth(.28, .85, span))
                    col = _mix(col, _FIN_UNDER, .62 * _smooth(.10, .95, -sin(a)))
                ring.append(skin.vertex(xyz, col, weights))
            yield ring
    skin.loft(rings(_DORSAL, "dorsal"), flip=True)
    skin.loft(rings(_FLUKE, "fluke"), flip=True)
    for side in (-1, 1):
        skin.loft(rings(_PECTORAL, "pectoral", side), flip=side > 0)


_GAPE = _Sections((
    (1.094, -.072, .001), (1.160, -.082, .010), (1.270, -.092, .010),
    (1.410, -.071, .009), (1.550, -.040, .008), (1.740, -.020, .006),
    (1.930, .014, .005), (2.017, .032, .004), (2.048, .035, .001),
))


def _face_details(skin, side):
    head = (("Chest", 1),)
    prev = None
    for x in _GAPE.stations(5):
        z, w = _GAPE.at(x)
        row = [skin.vertex(_cheek(x, z + d*w, side, .0014), colour, head)
               for d, colour in ((-1, _LID), (-.15, _CREASE), (.85, _CREASE))]
        if prev:
            skin.stitch(prev, row, flip=side < 0, closed=False)
        prev = row

    # Almond-shaped lid, limbus and domed cornea follow the angle of the cheek.
    # A small iris is visible around a broad dark pupil, without exposed sclera.
    prev = None
    for radius, lift, colour, slot in (
        (1.22, .0003, None, 0), (1.00, .007, _LID, 0),
        (.86, .009, _CREASE, 0), (.76, .011, _IRIS, 1),
        (.53, .016, _PUPIL, 1), (.08, .019, _PUPIL, 1),
    ):
        ring = []
        for i in range(48):
            a = 2*pi*i / 48
            x = 1.085 + .061 * radius * cos(a)
            z = .039 + .036 * radius * sin(a) * (.74 + .26 * abs(sin(a))) + .007 * radius * cos(a)
            _, floor, roof = _BODY.at(x)
            h = (2*z - roof - floor) / (roof - floor)
            ring.append(skin.vertex(_cheek(x, z, side, lift),
                                    colour or _pigment(x, h), head))
        if prev:
            skin.stitch(prev, ring, flip=side > 0, slot=slot)
        prev = ring
    skin.face(prev, flip=side > 0, slot=1)


def _blowhole(skin):
    prev = None
    for i in range(33):
        u = -1 + 2 * i / 32
        y = .082 * u
        x = 1.035 - .035 * (1 - u*u)
        taper = .05 + .95 * (1 - u*u)
        row = []
        for dx, lift, colour in ((-.016, .001, _MANTLE), (-.006, .005, _BACK),
                                 (.001, .002, _CREASE), (.009, .002, _CREASE),
                                 (.016, .002, _MANTLE)):
            xx = x + dx*taper
            w, floor, roof = _BODY.at(xx)
            h = sqrt(1 - (y / (w * 1.07))**2)
            z = .5 * (roof + floor + (roof - floor)*h)
            row.append(skin.vertex((xx, y, z + lift*taper), colour, (("Chest", 1),)))
        if prev:
            skin.stitch(prev, row, closed=False)
        prev = row


def _pec_name(side):
    return "Pectoral near" if side < 0 else "Pectoral far"


def _material(name, eye=False):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*(_PUPIL if eye else _BACK), 1)
    tree = mat.node_tree
    bsdf = tree.nodes.get("Principled BSDF")
    colour = tree.nodes.new("ShaderNodeVertexColor")
    colour.layer_name = "Pigment"
    tree.links.new(colour.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = .16 if eye else .33
    bsdf.inputs["Coat Weight"].default_value = .38 if eye else .19
    bsdf.inputs["Coat Roughness"].default_value = .12 if eye else .23
    if not eye:
        # Rest-space coordinates keep the slight skin grain stable as it swims.
        coord = tree.nodes.new("ShaderNodeTexCoord")
        grain = tree.nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 155
        grain.inputs["Detail"].default_value = 2
        bump = tree.nodes.new("ShaderNodeBump")
        bump.inputs["Distance"].default_value = .0008
        bump.inputs["Strength"].default_value = .12
        tree.links.new(coord.outputs["Generated"], grain.inputs["Vector"])
        tree.links.new(grain.outputs["Fac"], bump.inputs["Height"])
        tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def _skeleton(root):
    # Edit bones are the only part of construction requiring an active object.
    view = bpy.context.view_layer
    active = view.objects.active
    view.objects.active = root
    try:
        bpy.ops.object.mode_set(mode="EDIT")
        bones = root.data.edit_bones
        xs = (1.40, *_JOINTS, -2.01)
        for i, name in enumerate(_SPINE):
            bone = bones.new(name)
            for attr, x in (("head", xs[i]), ("tail", xs[i+1])):
                _, floor, roof = _BODY.at(x)
                setattr(bone, attr, (x, 0, .5 * (roof + floor)))
            if i:
                bone.parent = bones[_SPINE[i-1]]
                bone.use_connect = True
        for side in (-1, 1):
            bone = bones.new(_pec_name(side))
            bone.head = (.59, side * .28, -.17)
            bone.tail = (.15, side * .81, -.51)
            bone.parent = bones["Chest"]
    finally:
        if root.mode == "EDIT":
            bpy.ops.object.mode_set(mode="OBJECT")
        view.objects.active = active


def build_dolphin(name):
    """Build an independent dolphin and return its placement root and pose callable."""
    if bpy.context.mode != "OBJECT":
        raise RuntimeError("build_dolphin needs Blender Object Mode to create edit bones")
    skin = _Surface()
    _trunk(skin)
    _foils(skin)
    for side in (-1, 1):
        _face_details(skin, side)
    _blowhole(skin)

    rig = bpy.data.armatures.new(name + " skeleton")
    root = bpy.data.objects.new(name, rig)
    collection = bpy.context.collection
    collection.objects.link(root)
    _skeleton(root)
    rig.display_type = "STICK"

    mesh = bpy.data.meshes.new(name + " surface")
    mesh.from_pydata(skin.vertices, [], skin.faces, shade_flat=False)
    mesh.update()
    mesh.materials.append(_material(name + " • skin"))
    mesh.materials.append(_material(name + " • cornea", eye=True))
    mesh.polygons.foreach_set("material_index", skin.slots)
    pigment = mesh.color_attributes.new("Pigment", "FLOAT_COLOR", "POINT")
    pigment.data.foreach_set("color", [v for rgba in skin.colours for v in rgba])
    mesh.color_attributes.active_color = pigment
    animal = bpy.data.objects.new(name + " skin", mesh)
    collection.objects.link(animal)
    animal.parent = root
    groups = {b.name: animal.vertex_groups.new(name=b.name) for b in rig.bones}
    for index, influences in enumerate(skin.weights):
        for bone, weight in influences:
            if weight > 0:
                groups[bone].add([index], weight, "REPLACE")
    deform = animal.modifiers.new("Spine and fins", "ARMATURE")
    deform.object = root
    deform.use_deform_preserve_volume = True

    def channel(bone_name, axis):
        bone = root.pose.bones[bone_name]
        local_axis = bone.bone.matrix_local.to_quaternion().inverted() @ Vector(axis)
        return bone, local_axis

    spine = [channel(b, (0, 1, 0)) for b in _SPINE[1:-1]]
    flukes, pitch = channel("Flukes", (0, 1, 0))
    pectorals = [channel(_pec_name(s), (1, 0, 0)) for s in (-1, 1)]

    def pose(flex, tail, bank_fin):
        for (bone, axis), fraction in zip(spine, (.10, .18, .24, .26, .22)):
            bone.rotation_quaternion = Quaternion(axis, flex * fraction)
        flukes.rotation_quaternion = Quaternion(pitch, tail)
        for bone, axis in pectorals:
            bone.rotation_quaternion = Quaternion(axis, bank_fin)

    return root, pose
