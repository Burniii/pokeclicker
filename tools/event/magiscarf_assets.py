"""Object library cut out of "Tileset ver.3 [Free]" by Magiscarf (resources/magiscarf-tileset-v3.png).

The sheet was published with a baked-in grey/white checkerboard instead of transparency. The checkerboard
is flood-filled away from every pixel that touches it (sprites have a dark outline, so the fill stops there),
then the remaining pixels are split into connected objects.

Usage: python3 tools/event/magiscarf_assets.py index.png   (numbered contact sheet of all objects)
"""
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SHEET = os.path.join(HERE, 'resources', 'magiscarf-tileset-v3.png')
CHECKER = np.array([(255, 255, 255), (229, 236, 232)])


def load():
    a = np.array(Image.open(SHEET).convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    near = np.zeros((h, w), bool)
    for c in CHECKER:
        near |= (np.abs(a - c).sum(axis=2) <= 6)
    # flood fill the checkerboard from the border (4-neighbourhood)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if near[y, x]:
                bg[y, x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if near[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and near[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((nx, ny))
    # checkerboard enclosed by an object (arches, gates): regions that contain both checker colours
    light = np.abs(a - CHECKER[1]).sum(axis=2) <= 6
    seen = bg.copy()
    for y0, x0 in zip(*np.nonzero(near & ~bg)):
        if seen[y0, x0]:
            continue
        comp, has_light, has_white = [], False, False
        seen[y0, x0] = True
        q.append((x0, y0))
        while q:
            x, y = q.popleft()
            comp.append((y, x))
            has_light |= bool(light[y, x])
            has_white |= not light[y, x]
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and near[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((nx, ny))
        if has_light and has_white and len(comp) >= 40:
            ys, xs = zip(*comp)
            bg[list(ys), list(xs)] = True
    rgba = np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, 'RGBA'), ~bg


def components(fg, gap=2):
    """Bounding boxes of connected objects (pixels closer than `gap` belong together)."""
    h, w = fg.shape
    # dilate so that detached parts (shadows, highlights) stay with their object
    d = fg.copy()
    for _ in range(gap):
        d = d | np.roll(d, 1, 0) | np.roll(d, -1, 0) | np.roll(d, 1, 1) | np.roll(d, -1, 1)
    lab = np.zeros((h, w), np.int32)
    boxes = []
    for y0, x0 in zip(*np.nonzero(d)):
        if lab[y0, x0]:
            continue
        n = len(boxes) + 1
        lab[y0, x0] = n
        q = deque([(x0, y0)])
        bx0, by0, bx1, by1 = x0, y0, x0, y0
        while q:
            x, y = q.popleft()
            bx0, by0, bx1, by1 = min(bx0, x), min(by0, y), max(bx1, x), max(by1, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and d[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = n
                    q.append((nx, ny))
        boxes.append((max(0, bx0 - gap + 1), max(0, by0 - gap + 1), min(w, bx1 - gap + 2), min(h, by1 - gap + 2)))
    return boxes


_cache = {}


def objects():
    if 'objs' not in _cache:
        img, fg = load()
        _cache['img'] = img
        _cache['objs'] = [b for b in components(fg) if (b[2] - b[0]) * (b[3] - b[1]) >= 36]
    return _cache['img'], _cache['objs']


def sprite(i):
    img, objs = objects()
    return img.crop(objs[i])


def region(box):
    """A hand-picked region of the cleaned sheet (for multi-part objects such as houses)."""
    img, _ = objects()
    return img.crop(box)


if __name__ == '__main__':
    img, objs = objects()
    print(len(objs), 'objects')
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
    sheet = img.copy()
    bgc = Image.new('RGBA', sheet.size, (60, 70, 90, 255))
    bgc.alpha_composite(sheet)
    d = ImageDraw.Draw(bgc)
    for i, (x0, y0, x1, y1) in enumerate(objs):
        d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 0, 255))
        d.text((x0 + 1, y0), str(i), font=f, fill=(255, 255, 0))
    bgc.convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else 'magiscarf-index.png')


# Named objects (indices into objects(); sizes in px at map scale)
CATALOG = {
    # trees 46x65 (two variants each) and 44x57 small trees
    'tree_olive': [0, 1, 24], 'tree_teal': [4, 5, 26], 'tree_green': [8, 9, 28],
    'tree_autumn': [12, 13, 31], 'tree_red': [16, 17, 34], 'tree_sakura': [20, 21, 36],
    # round 60x68 trees
    'round_olive': [51, 52], 'round_teal': [55, 56], 'round_green': [59, 60],
    'round_autumn': [63, 64], 'round_red': [67, 68], 'round_sakura': [71, 72],
    # tall 58x111 landmark trees and birches
    'tall_green': [83, 84], 'tall_autumn': [87, 88, 89], 'tall_red': [92, 93, 94], 'tall_sakura': [97, 98],
    'birch': [114], 'birch_snow': [115],
    'fountain': [780, 781, 782], 'waterfall': [672], 'torii': [524], 'torii_wide': [506],
    'greenhouse': [498], 'greenhouse_dark': [499], 'statue': [281, 282], 'arch_white': [286], 'arch_wood': [294],
    'clock': [605], 'mosaic': [624], 'street_lamp': [336], 'pillar': [513], 'tower': [574],
    'gate_wood': [469, 470], 'gate_stone': [491, 492], 'stairs_stone': [245],
}


def pick(name, k=0):
    ids = CATALOG[name]
    return sprite(ids[k % len(ids)])
