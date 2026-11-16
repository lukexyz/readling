"""Export the three Ember Orca hat tracks from the approved rig.

From word-woods, run:
    blender -b --python-exit-code 1 -P studies/ember-orca/hat-tracking.py

hats[level][sprite_index] is null underwater, otherwise [x, y, radians, width].
Pixels use the full camera, origin at top left. The hat pivots at its brim.
"""
import json
from math import atan2, remainder, tau
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

STUDY = Path(__file__).resolve().parent
RIG_FILE = STUDY / "ember-orca-level-2.blend"
PROGRESSION = STUDY / "progression.py"
OUTPUT = STUDY.parents[1] / "dist/assets/ember-orca/hats.json"

# The original muzzle tracker places the brim at SKULL. Crossing the muzzle
# tangent with the lateral head axis gives the hat's outward (crown) direction.
SKULL = Vector((2.36, 0, .58))
NOSE = Vector((2.96, 0, .52))
CROWN_UP = (NOSE - SKULL).cross(Vector((0, 1, 0))).normalized()
ORIGINAL_MARKER_PX = 70


def progression_setup():
    # progression.py is a render script. Run its actual scene setup through
    # the level-specific poses and lens changes, stopping before PNG output.
    setup, boundary, _ = PROGRESSION.read_text(encoding="utf-8").partition("\nfolder = ")
    if not boundary:
        raise ValueError("Could not locate the frame output block in progression.py")
    return compile(setup, str(PROGRESSION), "exec")


def track_level(level, setup):
    bpy.ops.wm.open_mainfile(filepath=str(RIG_FILE))
    scene = bpy.context.scene
    # Convert the existing 70-pixel marker on the original 656-pixel camera
    # to a physical diameter before progression changes the camera and rig.
    diameter = ORIGINAL_MARKER_PX * scene.camera.data.ortho_scale / scene.render.resolution_x
    args = sys.argv
    try:
        sys.argv = [str(PROGRESSION), "--", str(level)]
        shot = {"__file__": str(PROGRESSION), "__name__": "__main__"}
        exec(setup, shot)
    finally:
        sys.argv = args

    rig, camera = shot["rig"], scene.camera
    head = rig.pose.bones["Head"]
    render = scene.render
    width = render.resolution_x * render.resolution_percentage // 100
    height = render.resolution_y * render.resolution_percentage // 100
    # Blender truncates the scaled dimensions to whole pixels for the PNG.
    # Use that same aspect ratio for the orthographic projection.
    render.resolution_x, render.resolution_y = width, height
    render.resolution_percentage = 100

    def pixel(point):
        view = world_to_camera_view(scene, camera, point)
        return Vector((width * view.x, height * (1 - view.y)))

    rest_inverse = head.bone.matrix_local.inverted()
    rows = []
    last_angle = None
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        pose = rig.matrix_world @ head.matrix @ rest_inverse
        skull = pose @ SKULL
        if skull.z <= 0:
            rows.append(None)
            last_angle = None
            continue
        anchor = pixel(skull)
        up = pixel(pose @ (SKULL + CROWN_UP)) - anchor
        angle = atan2(up.x, -up.y)  # canvas rotation of a hat pointing up
        if last_angle is not None:
            angle = last_angle + remainder(angle - last_angle, tau)
        last_angle = angle
        # A circular brim retains its major diameter in an orthographic shot.
        # These rigs scale uniformly, including the larger level-three orca.
        marker_width = diameter * pose.to_scale().x * width / camera.data.ortho_scale
        rows.append([round(anchor.x, 3), round(anchor.y, 3), round(angle, 6), round(marker_width, 3)])
    return rows


if __name__ == "__main__":
    setup = progression_setup()
    hats = {level: track_level(level, setup) for level in (1, 2, 3)}
    OUTPUT.write_text(json.dumps(hats, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
