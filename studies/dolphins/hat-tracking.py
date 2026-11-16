"""Export the earned hat's brim pivot for the approved transparent dolphin shots.

    blender -b --python-exit-code 1 -P studies/dolphins/hat-tracking.py

tracks[take][png_number - 1] contains [x, y, canvas_radians, image_width_px]
for each surfaced crown, in rear-to-front pod order. Pixels are relative to the
full uncropped render, with the origin at the top left.
"""
import json
from math import atan2, hypot, remainder, tau
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

STUDY = Path(__file__).resolve().parent
sys.path.insert(0, str(STUDY))
sys.dont_write_bytecode = True
import render
from model import _BODY

OUTPUT = STUDY.parents[1] / "dist/assets/dolphins/hats.json"
TAKES = ("skip-1", "skip-2", "skip-3", "vault-1", "vault-2", "vault-3", "relay-1", "relay-3")

# The middle of the blowhole is at x=1 on the dorsal midline. This part
# of the modeled head is fully weighted to Chest. Sample its forehead slope
# to form an orthogonal rest-space frame for the hat.
HEAD_X = 1.0
CROWN = Vector((HEAD_X, 0, _BODY.at(HEAD_X)[2]))
SLOPE = (_BODY.at(HEAD_X + .01)[2] - _BODY.at(HEAD_X - .01)[2]) / .02
FORE = Vector((1, 0, SLOPE)).normalized()
SIDE = Vector((0, 1, 0))
UP = FORE.cross(SIDE)

# Physical brim diameters along and across the head, in model units. The
# illustrated brim fills about 90% of the square passed to e.hat().
BRIM_LENGTH, BRIM_BREADTH = 1.10, .86
INK_FRACTION = .90


def hat_anchor(scene, root, last_angle):
    chest = root.pose.bones["Chest"]
    head = root.matrix_world @ chest.matrix @ chest.bone.matrix_local.inverted()
    crown = head @ CROWN
    if crown.z <= 0:  # same world-space clip plane as the skin material
        return None

    def pixel(point):
        view = world_to_camera_view(scene, scene.camera, point)
        return Vector((view.x * scene.render.resolution_x, (1 - view.y) * scene.render.resolution_y))

    pivot = pixel(crown)
    up = pixel(head @ (CROWN + UP)) - pivot
    angle = atan2(up.x, -up.y)  # rotate canvas -Y toward the projected outward normal
    if last_angle is not None:
        angle = last_angle + remainder(angle - last_angle, tau)

    # Project the two diameters of an elliptical brim onto its screen axis.
    # A camera-facing dolphin presents the narrower, cross-head diameter.
    brim = Vector((-up.y, up.x)).normalized()
    fore = pixel(head @ (CROWN + FORE * BRIM_LENGTH)) - pivot
    side = pixel(head @ (CROWN + SIDE * BRIM_BREADTH)) - pivot
    width = hypot(fore.dot(brim), side.dot(brim)) / INK_FRACTION
    return round(pivot.x, 3), round(pivot.y, 3), round(angle, 6), round(width, 3)


def track_take(take):
    family, level = take.split("-")
    count = render.setup_shot(family, int(level))
    # In these takes the follower(s) travel behind the lead. Keep a stable
    # paint order even when animals emerge or re-enter on different frames.
    pod = list(reversed(render.animals.items()))
    previous = {}
    frames = []
    for frame in range(1, count + 1):
        render.place(frame)
        bpy.context.view_layer.update()
        anchors = []
        for index, (root, _) in pod:
            anchor = hat_anchor(render.scene, root, previous.get(index))
            previous[index] = anchor[2] if anchor else None
            if anchor:
                anchors.append(anchor)
        frames.append(anchors)
    return frames


if __name__ == "__main__":
    tracks = {take: track_take(take) for take in TAKES}
    OUTPUT.write_text(json.dumps(tracks, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
