"""Build the local overlay from the reviewed Environment Agency WMS image."""
import argparse
import hashlib
from pathlib import Path

from PIL import Image

SOURCE_SHA256 = "658587ae099738f8ed6e3ef066ab425bb4df84cfa441ec498eef8dea22a9c157"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--png", type=Path, default=Path("raw/surface-water/present-day.png"))
    parser.add_argument("--output", type=Path, default=Path("public/data/surface-water.v1.webp"))
    args = parser.parse_args()
    if hashlib.sha256(args.png.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError("PNG differs from the reviewed WMS response")
    with Image.open(args.png) as source:
        if source.format != "PNG" or source.size != (2048, 1506) or source.mode != "RGBA":
            raise ValueError("Unexpected WMS image type, dimensions or transparency")
        source.save(args.output, format="WEBP", lossless=True, method=6, exact=True)
        with Image.open(args.output) as output:
            if output.convert("RGBA").tobytes() != source.tobytes():
                raise ValueError("WebP pixels differ from the WMS response")


if __name__ == "__main__":
    main()
