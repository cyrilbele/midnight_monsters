"""Index the 16 drawings in a single 4 × 4 transparent PNG for Canvas drawImage."""

import argparse
import json
from pathlib import Path
from tempfile import TemporaryDirectory

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install Pillow in your art environment to cut a sheet (see AGENTS.md).")


def cut_sheet(path):
    with Image.open(path) as image:
        width, height = image.size
        if image.format != "PNG" or width != height or width % 4:
            raise ValueError("Use a square PNG whose width is divisible by 4.")
        if "A" not in image.getbands() and "transparency" not in image.info:
            raise ValueError("Export the sheet with a transparent background.")
        # Near-invisible matte pixels from an editor must not shift the tyre anchor.
        alpha = image.convert("RGBA").getchannel("A").point(lambda a: 255 if a >= 16 else 0)

    cell = width // 4
    frames = []
    for i in range(16):
        x, y = i % 4 * cell, i // 4 * cell
        bounds = alpha.crop((x, y, x + cell, y + cell)).getbbox()
        if bounds is None:
            raise ValueError(f"Cell {i:02} is empty.")
        left, top, right, bottom = bounds
        if left == 0 or top == 0 or right == cell or bottom == cell:
            raise ValueError(f"Cell {i:02} touches the grid. Leave a transparent margin on all four sides.")
        frames.append([x + left, y + top, right - left, bottom - top])
    return {"size": width, "frames": frames}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sheet", type=Path, help="PNG file. The adjacent .json stores the cut rectangles.")
    parser.add_argument("--check", action="store_true", help="Check the existing index without writing it.")
    args = parser.parse_args()
    path = args.sheet
    try:
        data = cut_sheet(path)
        output = path.with_suffix(".json")
        if args.check:
            if json.loads(output.read_text(encoding="utf-8")) != data:
                raise ValueError(f"{output} is out of date. Run the command without --check.")
        else:
            with TemporaryDirectory(dir=output.parent) as directory:
                temp = Path(directory) / output.name
                temp.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
                temp.replace(output)
    except (OSError, ValueError) as error:
        parser.exit(1, f"{path}: {error}\n")
    print(f"{output} · 16 views · {data['size'] // 4} px per cell")


if __name__ == "__main__":
    main()
