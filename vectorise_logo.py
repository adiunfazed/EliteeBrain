"""
Turn a logo image into SVG paths for the splash animation.

Uses potrace, the same tracing engine the paid sites run — the charge is for
their hosting, not the algorithm.

    python3 vectorise_logo.py logo.png

Writes the E and L paths ready to paste into SplashScreen.tsx.
"""
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image


def trace(image_path: Path, threshold: int = 50) -> str:
    """Trace one image and return its combined path data."""
    pbm = image_path.with_suffix('.pbm')
    svg = image_path.with_suffix('.traced.svg')

    # Flatten onto white first: a transparent PNG otherwise traces its
    # transparency as black and produces one solid rectangle.
    img = Image.open(image_path).convert('RGBA')
    flat = Image.new('RGBA', img.size, (255, 255, 255, 255))
    flat.paste(img, mask=img.split()[3])
    flat.convert('L').save(pbm.with_suffix('.png'))

    subprocess.run(
        ['convert', str(pbm.with_suffix('.png')), '-threshold', f'{threshold}%', str(pbm)],
        check=True, capture_output=True,
    )
    subprocess.run(
        ['potrace', str(pbm), '-s', '-o', str(svg), '--flat'],
        check=True, capture_output=True,
    )

    content = svg.read_text()
    paths = re.findall(r'd="([^"]*)"', content)

    # potrace emits a flipped coordinate system, so the transform matters.
    transform = re.search(r'transform="([^"]*)"', content)
    viewbox = re.search(r'viewBox="([^"]*)"', content)

    return {
        'paths': paths,
        'transform': transform.group(1) if transform else '',
        'viewBox': viewbox.group(1) if viewbox else '',
    }


def main() -> None:
    if len(sys.argv) < 2:
        print(__doc__)
        return

    src = Path(sys.argv[1])
    if not src.exists():
        print(f'Not found: {src}')
        return

    result = trace(src)

    print(f'viewBox: {result["viewBox"]}')
    print(f'transform: {result["transform"]}')
    print(f'shapes found: {len(result["paths"])}')
    print()

    for i, d in enumerate(result['paths']):
        print(f'--- shape {i + 1} ({len(d)} chars) ---')
        print(d[:300] + ('…' if len(d) > 300 else ''))
        print()


if __name__ == '__main__':
    main()
