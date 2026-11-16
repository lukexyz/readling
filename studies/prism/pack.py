"""Pack a rainbow or firework from numbered transparent Blender renders."""
import argparse
from pathlib import Path
import runpy

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("family", choices=("rainbow", "rainbow2", "slide", "ribbon", "blooms", "paint", "picture"))
    parser.add_argument("level", type=int, choices=(1, 2, 3))
    parser.add_argument("poster", type=int)
    args = parser.parse_args()
    pack = runpy.run_path(str(Path(__file__).resolve().parents[1] / "woodland/pack.py"))["pack"]
    pack(args.family, args.level, args.poster, group="prism", counts=(48, 56, 64), size=(384, 288))
