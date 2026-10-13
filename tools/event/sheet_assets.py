"""Generic object extraction from sprite / tile sheets with a flat, black, white or checkerboard background.

Each sheet in SOURCES is cleaned (background flood-filled from the border, plus enclosed background
regions) and split into connected objects. `python3 tools/event/sheet_assets.py <key> out.png` writes a
numbered index; `obj(key, i)` returns object i as an RGBA image.
"""
import os
import sys
from collections import Counter, deque

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
RES = os.path.join(HERE, 'resources')

# key: (file, colour tolerance, gap that joins nearby parts)
SOURCES = {
    'cherry': ('chaoticcherrycake-public-tiles.png', 4, 1),
    'frlg1': ('frlg-buildings-1.png', 4, 1),
    'frlg2': ('frlg-buildings-2.png', 4, 1),
    'zeo': ('zeo254-resurgent.png', 6, 1),
    'saurav_b': ('saurav-buildings.png', 10, 1),
    'saurav_n': ('saurav-nature.png', 10, 1),
    'erma': ('erma96-buildings.jpg', 40, 2),
    'zerudez': ('zerudez-public-tileset.png', 4, 1),
    'bacon': ('bacon-objects.jpg', 40, 2),
    'houses': ('houses-mixed.jpg', 40, 2),
    'phyro': ('phyromatical-mountains.png', 4, 1),
    'nature': ('nature-black.jpg', 40, 2),
}


def clean(path, tol):
    im = Image.open(path)
    if im.mode == 'RGBA':
        a = np.array(im)
        if (a[..., 3] == 0).mean() > 0.05:      # real transparency
            return im
    a = np.array(im.convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    common = [np.array(c) for c, n in Counter(map(tuple, border)).most_common(3) if n > len(border) * 0.08]
    keys = common[:2]
    near = np.zeros((h, w), bool)
    for c in keys:
        near |= np.abs(a - c).sum(axis=2) <= tol
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        if bg[y, x] or not near[y, x]:
            continue
        bg[y, x] = True
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny, nx] and near[ny, nx]:
                q.append((nx, ny))
    if len(keys) == 2:   # enclosed checkerboard: regions holding both checker colours
        k1 = np.abs(a - keys[1]).sum(axis=2) <= tol
        seen = bg.copy()
        for y0, x0 in zip(*np.nonzero(near & ~bg)):
            if seen[y0, x0]:
                continue
            comp, c1, c0 = [], False, False
            seen[y0, x0] = True
            q.append((x0, y0))
            while q:
                x, y = q.popleft()
                comp.append((y, x))
                c1 |= bool(k1[y, x])
                c0 |= not k1[y, x]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and near[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        q.append((nx, ny))
            if c0 and c1 and len(comp) >= 40:
                ys, xs = zip(*comp)
                bg[list(ys), list(xs)] = True
    if tol >= 30:    # JPEG sheets: strip the light halo of compression noise around every object
        for _ in range(3):
            edge = ~bg & (np.roll(bg, 1, 0) | np.roll(bg, -1, 0) | np.roll(bg, 1, 1) | np.roll(bg, -1, 1))
            bg |= edge & (a.min(axis=2) > 150) & (np.abs(a - a.mean(axis=2, keepdims=True)).max(axis=2) < 30)
        n = sum((~np.roll(np.roll(bg, dy, 0), dx, 1)).astype(int) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        bg |= n <= 1
    return Image.fromarray(np.dstack([a.astype(np.uint8), np.where(bg, 0, 255).astype(np.uint8)]), 'RGBA')


def components(alpha, gap):
    fg = alpha > 0
    h, w = fg.shape
    d = fg.copy()
    for _ in range(gap):
        d = d | np.roll(d, 1, 0) | np.roll(d, -1, 0) | np.roll(d, 1, 1) | np.roll(d, -1, 1)
    lab = np.zeros((h, w), bool)
    boxes = []
    for y0, x0 in zip(*np.nonzero(d)):
        if lab[y0, x0]:
            continue
        lab[y0, x0] = True
        q = deque([(x0, y0)])
        bx0, by0, bx1, by1 = x0, y0, x0, y0
        while q:
            x, y = q.popleft()
            bx0, by0, bx1, by1 = min(bx0, x), min(by0, y), max(bx1, x), max(by1, y)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and d[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = True
                    q.append((nx, ny))
        b = (max(0, bx0 - gap + 1), max(0, by0 - gap + 1), min(w, bx1 - gap + 2), min(h, by1 - gap + 2))
        if (b[2] - b[0]) * (b[3] - b[1]) >= 30:
            boxes.append(b)
    return boxes


_cache = {}


def sheet(key):
    if key not in _cache:
        f, tol, gap = SOURCES[key]
        img = clean(os.path.join(RES, f), tol)
        _cache[key] = (img, components(np.array(img)[..., 3], gap))
    return _cache[key]


def obj(key, i):
    img, boxes = sheet(key)
    o = img.crop(boxes[i])
    return o.crop(o.getbbox())


def region(key, box):
    img, _ = sheet(key)
    o = img.crop(box)
    return o.crop(o.getbbox())


if __name__ == '__main__':
    key, out = sys.argv[1], sys.argv[2]
    img, boxes = sheet(key)
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 9)
    canvas = Image.new('RGBA', img.size, (60, 70, 90, 255))
    canvas.alpha_composite(img)
    d = ImageDraw.Draw(canvas)
    for i, (x0, y0, x1, y1) in enumerate(boxes):
        d.rectangle((x0, y0, x1 - 1, y1 - 1), outline=(255, 0, 255))
        d.text((x0 + 1, y0), str(i), font=f, fill=(255, 255, 0))
    z = 2 if img.width < 700 else 1
    canvas.resize((img.width * z, img.height * z), Image.NEAREST).convert('RGB').save(out)
    print(key, len(boxes), 'objects')


# Named landmarks for the Festival Archipelago (sheet, pixel box or object index, optional sub-split)
def landmark(name):
    if name == 'bell_tower':
        # the sheet's drop shadow is a semi-transparent box; keep only opaque pixels
        o = region('cherry', (124, 760, 172, 847))
        a = np.array(o)
        a[..., 3] = np.where(a[..., 3] == 255, 255, 0)
        o = Image.fromarray(a, 'RGBA')
        return o.crop(o.getbbox())
    if name == 'contest_hall':
        return region('saurav_b', (12, 11, 99, 80))
    if name == 'stadium':
        return region('erma', (97, 268, 265, 376))
    if name == 'hut':
        return obj('erma', 32)
    if name == 'restaurant':
        return obj('zeo', 9)
    if name == 'lodge':
        return obj('zeo', 7)
    if name == 'lighthouse':
        return obj('cherry', 166)
    if name.startswith('kalos_house'):
        k = int(name[-1])
        o = obj('zerudez', 41)
        w = o.width // 6
        return o.crop((k * w, 0, (k + 1) * w, o.height)).crop(o.crop((k * w, 0, (k + 1) * w, o.height)).getbbox())
    if name.startswith('tree_'):
        sheet_obj, k = {'tree_gold': (95, 0), 'tree_gold2': (95, 1), 'tree_pine': (63, 0), 'tree_pine2': (63, 1), 'tree_pine3': (63, 2)}[name]
        o = obj('zerudez', sheet_obj)
        n = o.width // 48
        part = o.crop((k * o.width // n, 0, (k + 1) * o.width // n, o.height))
        return part.crop(part.getbbox())
    raise KeyError(name)
