"""Builds the map of the Festival Archipelago (event region) in the style of the modern region maps
(alola-*.png, galar-*.png): organic islands with thin cliffs, foamy beaches, sand paths with a light
grass fringe, stone plazas, three water depths and wooden boardwalks between the islands.

Ground textures and buildings, palms, trees and boats come from the Alola maps (alola_assets.py),
the festival decoration is drawn in the same pixel style (festival_props.py).

Usage: python3 tools/event/festival_map.py out.png [labels.png]
"""
import os
import random
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import alola_assets as aa  # noqa: E402
import festival_props as fp  # noqa: E402

T = 16
W, H = 100, 60
PW, PH = W * T, H * T
random.seed(7)

WATER, GRASS, SAND, PATH, STONE, FEST = range(6)
kind = np.zeros((H, W), np.uint8)

# ---------------------------------------------------------------------------------------------
# Islands: rectangles with jagged, chamfered outlines (stepped at 16px like the Alola coasts)
# ---------------------------------------------------------------------------------------------
ISLANDS = {
    'plaza': (32, 15, 68, 44),
    's1': (2, 19, 22, 40),     # Kanto: party
    's2': (2, 1, 22, 14),      # Johto: lantern festival
    's3': (26, 1, 47, 14),     # Hoenn: Millennium festival (Jirachi, circus tent)
    's4': (52, 1, 73, 14),     # Sinnoh: contest stage
    's5': (77, 1, 98, 19),     # Unova: amusement park
    's6': (77, 23, 98, 40),    # Kalos: Halloween
    's7': (74, 45, 98, 59),    # Alola: beach
    's8': (48, 47, 71, 59),    # Galar: party
    's9': (21, 47, 43, 59),    # Paldea: crowns
    'secret': (5, 47, 13, 57), # secret cave (Armored Mewtwo)
}


def frange(a, b, step):
    out = []
    x = a
    while (step > 0 and x < b) or (step < 0 and x > b):
        out.append(x)
        x += step
    return out


def blob(x0, y0, x1, y1, seed, jag=2.4, cut=2.0):
    r = random.Random(seed)

    def j():
        return r.uniform(0, jag)
    pts = []
    for x in frange(x0 + cut, x1 - cut, 2.5):
        pts.append((x, y0 + j()))
    for y in frange(y0 + cut, y1 - cut, 2.5):
        pts.append((x1 - j(), y))
    for x in frange(x1 - cut, x0 + cut, -2.5):
        pts.append((x, y1 - j()))
    for y in frange(y1 - cut, y0 + cut, -2.5):
        pts.append((x0 + j(), y))
    m = Image.new('L', (W, H), 0)
    ImageDraw.Draw(m).polygon(pts, fill=1)
    return np.array(m, bool)


def smooth_noise(seed, cell=5):
    """Value noise in [0, 1] on the tile grid (bilinear between random values every `cell` tiles)."""
    r = np.random.default_rng(seed)
    g = r.random((H // cell + 2, W // cell + 2))
    ys, xs = np.mgrid[0:H, 0:W] / cell
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = ys - y0, xs - x0
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a = g[y0, x0] * (1 - fx) + g[y0, x0 + 1] * fx
    b = g[y0 + 1, x0] * (1 - fx) + g[y0 + 1, x0 + 1] * fx
    return a * (1 - fy) + b * fy


def organic(x0, y0, x1, y1, seed, amp=2.6, radius=3.5):
    """Rounded rectangle whose outline is pushed outwards and inwards by smooth noise."""
    ys, xs = np.mgrid[0:H, 0:W] + 0.5
    cx, cy, hw, hh = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2 - radius, (y1 - y0) / 2 - radius
    qx, qy = np.abs(xs - cx) - hw, np.abs(ys - cy) - hh
    sd = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - radius
    n = smooth_noise(seed, 6) * 0.6 + smooth_noise(seed + 1, 3) * 0.4
    core = sd < -1.2
    return (sd < (n - 0.42) * amp) | core


# lobes and peninsulas so that the islands are not plain rectangles
LOBES = {
    's1': [(1, 34, 9, 41), (15, 18, 21, 23)],
    's2': [(14, 10, 20, 15), (1, 3, 6, 9)],
    's3': [(32, 10, 40, 14)],
    's4': [(64, 10, 71, 14), (52, 9, 57, 13), (64, 1, 72, 5)],
    's5': [(76, 12, 81, 20)],
    's6': [(94, 27, 99, 35), (79, 36, 85, 41)],
    's7': [(74, 46, 80, 51), (90, 43, 96, 47)],
    's8': [(64, 56, 70, 60)],
    's9': [(36, 45, 41, 48), (22, 56, 29, 60)],
    'plaza': [(31, 36, 37, 42), (63, 16, 69, 22)],
    'secret': [],
}
masks = {}
for i, (k, b) in enumerate(ISLANDS.items()):
    m = organic(*b, seed=i * 13 + 5, amp=2.2 if k in ('secret', 'plaza') else 5, radius=3 if k == 'plaza' else 5.5)
    for j, lb in enumerate(LOBES[k]):
        m |= organic(*lb, seed=500 + i * 7 + j, amp=3, radius=2.5)
    masks[k] = m


def grow(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


# islands keep at least 3 tiles of sea between each other (the core of an island always stays)
land = np.zeros((H, W), bool)
for k, m in masks.items():
    others = np.zeros((H, W), bool)
    for k2, m2 in masks.items():
        if k2 != k:
            others |= m2
    x0, y0, x1, y1 = ISLANDS[k]
    core = np.zeros((H, W), bool)
    core[y0 + 1:y1 - 1, x0 + 1:x1 - 1] = True
    land |= m & (core | ~grow(others, 3))
# keep a strip of open sea along the map border
land[:1, :] = land[-1:, :] = False
land[:, :1] = land[:, -1:] = False
# no single-tile spikes or holes
for _ in range(4):
    n = np.zeros((H, W), int)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        n += np.roll(np.roll(land, dy, 0), dx, 1)
    land = (land & (n >= 2)) | (~land & (n >= 3))
kind[land] = GRASS


def area(x0, y0, x1, y1, k, only=(GRASS,)):
    for y in range(max(0, y0), min(H, y1)):
        for x in range(max(0, x0), min(W, x1)):
            if land[y, x] and kind[y, x] in only:
                kind[y, x] = k


# ---------------------------------------------------------------------------------------------
# Paths, plazas and beaches. Paths link the boardwalk landings with every door, stall and cave.
# ---------------------------------------------------------------------------------------------
PATHS = [
    # plaza island: west entrance and the pier in the south
    (30, 29, 38, 31), (34, 40, 40, 42), (38, 37, 40, 42),
    # s1
    (2, 29, 22, 31), (11, 18, 13, 31), (13, 31, 15, 34),
    # s2
    (4, 6, 22, 8), (11, 6, 13, 15),
    # s3
    (25, 6, 47, 8),
    # s4
    (51, 6, 73, 8),
    # s5
    (76, 6, 89, 8), (87, 6, 89, 19), (89, 11, 92, 13), (79, 16, 87, 18),
    # s6
    (87, 22, 89, 40), (82, 30, 87, 32), (89, 28, 94, 30),
    # s7
    (87, 44, 89, 54), (74, 52, 95, 54),
    # s8
    (48, 52, 71, 54), (59, 54, 61, 55),
    # s9
    (21, 52, 43, 54), (31, 54, 33, 55),
    # secret islet
    (8, 52, 14, 54),
]
for p in PATHS:
    area(*p, PATH)

STONES = [
    (35, 16, 65, 20),     # forecourt of the buildings on the plaza island
    (6, 33, 20, 37),      # s1 party square
    (55, 2, 64, 6),       # s4 contest stage square
    (57, 8, 62, 11),      # s4 fountain square
    (54, 55, 66, 57),     # s8 square
    (26, 55, 38, 57),     # s9 square
]
for s in STONES:
    area(*s, STONE, (GRASS, PATH))
FESTIVAL = (37, 20, 63, 37)
area(*FESTIVAL, FEST, (GRASS, PATH, STONE))


# ---------------------------------------------------------------------------------------------
# Boardwalks between the islands (2 tiles wide, only over water)
# ---------------------------------------------------------------------------------------------
BRIDGES = [
    ('h', 29, 18, 36), ('v', 11, 10, 24), ('h', 6, 18, 30), ('h', 6, 42, 56), ('h', 6, 68, 80),
    ('v', 87, 14, 26), ('v', 87, 36, 48), ('h', 52, 66, 78), ('h', 52, 39, 52), ('h', 52, 10, 25),
    ('h', 40, 22, 34, 'pier'),    # ferry pier of the plaza island
]
bridge = np.zeros((H, W), bool)
landing = np.zeros((H, W), bool)
bridge_cells = []
for d, a, b0, b1, *pier in BRIDGES:
    def cells_at(t):
        return [(t, a), (t, a + 1)] if d == 'h' else [(a, t), (a + 1, t)]
    wet = [t for t in range(b0, b1) if any(not land[y, x] for x, y in cells_at(t))]
    t0, t1 = min(wet), max(wet)
    cells = [c for t in range(t0, t1 + 1) for c in cells_at(t)]
    for x, y in cells:
        bridge[y, x] = True
        land[y, x] = False
        kind[y, x] = WATER
    bridge_cells.append((d, cells, bool(pier)))
    # landings: the path continues straight from the boardwalk until it meets the island's path
    for start, step in ((t0 - 1, -1), (t1 + 1, 1)):
        if pier and step == -1:
            continue
        t = start
        for _ in range(10):
            cs = cells_at(t)
            if not all(0 <= x < W and 0 <= y < H and land[y, x] for x, y in cs):
                break
            hit = all(kind[y, x] in (PATH, STONE, FEST) for x, y in cs)
            for x, y in cs:
                if kind[y, x] in (GRASS, SAND):
                    kind[y, x] = PATH
                if t in (start, start + step):
                    landing[y, x] = True
            if hit and t != start:
                break
            t += step

# ---------------------------------------------------------------------------------------------
# Water depth (tile distance to land)
# ---------------------------------------------------------------------------------------------
dist = np.full((H, W), 99)
q = deque()
for y, x in zip(*np.nonzero(land)):
    dist[y, x] = 0
    q.append((x, y))
while q:
    x, y = q.popleft()
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            nx, ny = x + dx, y + dy
            if 0 <= nx < W and 0 <= ny < H and dist[ny, nx] > dist[y, x] + 1:
                dist[ny, nx] = dist[y, x] + 1
                q.append((nx, ny))

# Beaches: the coastal strip (2 tiles) inside these areas
BEACHES = [(74, 54, 98, 60), (1, 34, 10, 41), (89, 12, 99, 20), (20, 55, 28, 60)]
coast = np.zeros((H, W), int)
for y in range(H):
    for x in range(W):
        if land[y, x]:
            coast[y, x] = min((abs(dx) + abs(dy) for dx in range(-3, 4) for dy in range(-3, 4)
                               if not (0 <= x + dx < W and 0 <= y + dy < H) or not land[y + dy, x + dx]), default=9)
for x0, y0, x1, y1 in BEACHES:
    for y in range(y0, min(H, y1)):
        for x in range(x0, min(W, x1)):
            if land[y, x] and kind[y, x] == GRASS and coast[y, x] <= 2:
                kind[y, x] = SAND

# Plateaus (higher ground with a rock face to the south); dungeons are caves in their faces
PLATEAUS = [(76, 9, 85, 16), (61, 46, 72, 52), (3, 45, 14, 52), (91, 33, 99, 41), (2, 9, 8, 15)]
high = np.zeros((H, W), bool)
for i, (x0, y0, x1, y1) in enumerate(PLATEAUS):
    high |= organic(x0, y0, x1, y1, seed=900 + i, amp=1.6, radius=1.5)
high &= land & (coast >= 2) & (kind == GRASS)
for _ in range(2):    # no thin spikes
    n = sum(np.roll(np.roll(high, dy, 0), dx, 1) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
    high &= n >= 2

# Water depth: light along the coast, mid, and deep water only far from land (smoothed)
depth = np.where(dist <= 2, 0, np.where(dist <= 6, 1, 2))
for _ in range(2):
    pad = np.pad(depth, 1, mode='edge')
    nb = np.stack([pad[1 + dy:H + 1 + dy, 1 + dx:W + 1 + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    depth = np.where(land, depth, np.round(np.median(nb, axis=0)).astype(int))
depth = np.where(dist <= 1, 0, depth)

# ---------------------------------------------------------------------------------------------
# Pixel rendering
# ---------------------------------------------------------------------------------------------


def arr(img):
    return np.array(img.convert('RGB'), np.int16)


TEX = {
    'grass': [arr(t) for t in aa.pure_tiles(aa.GRASS, None, 3)],
    'path': arr(aa.pure_tiles(aa.PATH, None, 1)[0]),
    'sand': arr(aa.pure_tiles(aa.SAND, None, 1)[0]),
    'stone': arr(aa.pure_tiles(aa.STONE, None, 3)[2]),
    'wl': arr(aa.pure_tiles(aa.WATER_LIGHT, None, 1)[0]),
    'wm': arr(aa.pure_tiles(aa.WATER_MID, None, 1)[0]),
    'wd': arr(aa.pure_tiles(aa.WATER_DEEP, None, 1)[0]),
    'fest': arr(fp.pink_paving(T)),
}


def tiled(t):
    return np.tile(t, (H, W, 1))


def up(m):
    return np.kron(m.astype(np.uint8), np.ones((T, T), np.uint8)).astype(bool)


def rounded(m, r=3):
    im = Image.fromarray((up(m) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
    return np.array(im) > 127


def shift(m, dx, dy, fill=False):
    out = np.full_like(m, fill)
    h, w = m.shape
    ys, yd = (slice(0, h - dy), slice(dy, h)) if dy >= 0 else (slice(-dy, h), slice(0, h + dy))
    xs, xd = (slice(0, w - dx), slice(dx, w)) if dx >= 0 else (slice(-dx, w), slice(0, w + dx))
    out[yd, xd] = m[ys, xs]
    return out


def near(m, r):
    out = m.copy()
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            if abs(dx) + abs(dy) <= r:
                out |= shift(m, dx, dy)
    return out


rng = np.random.default_rng(3)
hashv = rng.integers(0, 3, (PH, PW))

land_px = up(land)
img = np.zeros((PH, PW, 3), np.int16)
# water by depth
for d, name in enumerate(('wl', 'wm', 'wd')):
    m = up(depth == d) & ~land_px
    img[m] = tiled(TEX[name])[m]
# grass: mostly the plain tile, some tufts
gsel = rng.choice(len(TEX['grass']), (H, W), p=[0.7, 0.15, 0.15][:len(TEX['grass'])] if len(TEX['grass']) == 3 else None)
gsel_px = np.kron(gsel, np.ones((T, T), int))
for i, t in enumerate(TEX['grass']):
    m = land_px & (gsel_px == i)
    img[m] = tiled(t)[m]

sand_px = rounded(kind == SAND, 3) & land_px
path_px = (rounded(kind == PATH, 3) | up(landing & (kind == PATH))) & land_px
stone_px = up(kind == STONE)
fest_px = up(kind == FEST)
path_px &= ~stone_px & ~fest_px
sand_px &= ~path_px & ~stone_px & ~fest_px
img[sand_px] = tiled(TEX['sand'])[sand_px]
img[path_px] = tiled(TEX['path'])[path_px]
img[stone_px] = tiled(TEX['stone'])[stone_px]
img[fest_px] = tiled(TEX['fest'])[fest_px]

grass_px = land_px & ~sand_px & ~path_px & ~stone_px & ~fest_px
# light fringe where grass meets sand and paths (Alola style)
soft = path_px | sand_px
img[grass_px & near(soft, 2)] = (168, 216, 160)
img[path_px & near(grass_px, 1)] = (192, 168, 104)
# plaza frames: white stone edging with a grey outline
for m, inner in ((stone_px, (236, 238, 244)), (fest_px, (244, 236, 232))):
    edge1 = m & near(~m, 1)
    edge3 = m & near(~m, 3) & ~edge1
    img[edge3] = inner
    img[edge1] = (150, 156, 176)

# plateau faces: 12px rock wall on the south side, light rims on the sides, stairs where paths cross
high_px = up(high)
FACE = 20
dd = np.full((PH, PW), 99)
for k in range(1, FACE + 2):
    dd[(dd == 99) & high_px & shift(~high_px, 0, -k)] = k
xs = np.arange(PW)[None, :].repeat(PH, 0)
crack = np.random.default_rng(8).random(PW // 2 + 1)
for k in range(1, FACE + 1):
    m = (dd == k) & ~path_px
    # rock wall: light top edge, mid tone with irregular vertical cracks, dark foot
    colx = crack[xs // 2]
    col = np.where((colx < 0.22)[..., None], np.array((117, 68, 72)), np.array((150, 112, 106)))
    col = np.where(((colx > 0.86) & (k > FACE // 2))[..., None], np.array((184, 144, 136)), col)
    if k >= FACE - 2:
        col = np.broadcast_to(np.array((196, 160, 148)), col.shape)
    elif k <= 3:
        col = np.where((colx < 0.5)[..., None], np.array((117, 68, 72)), np.array((100, 60, 66)))
    img[m] = col[m]
    if k == 1 or k == FACE:
        img[m] = (85, 53, 64)
    sm = (dd == k) & path_px                       # stairs
    img[sm] = (150, 120, 70) if k % 3 == 0 else (224, 208, 150)
img[(dd == FACE + 1) & ~path_px] = (65, 178, 140)    # grass lip above the wall
below = ~high_px & shift(high_px, 0, 1) & land_px
shade = ~high_px & (shift(high_px, 0, 2) | shift(high_px, 0, 3)) & land_px & ~below
img[below & ~path_px] = (85, 53, 64)
img[shade] = (img[shade] * 0.85).astype(np.int16)
for k in range(1, 4):
    m = high_px & (dd > FACE) & (shift(~high_px, k, 0) | shift(~high_px, -k, 0)) & ~path_px
    img[m] = (85, 53, 64) if k == 1 else (184, 144, 136) if k == 2 else (216, 192, 160)
top = high_px & shift(~high_px, 0, 1) & ~path_px
img[top] = (85, 53, 64)
img[high_px & shift(~high_px, 0, 2) & ~top & ~path_px] = (144, 108, 104)
face_tiles = high & ~np.roll(high, -1, 0)

# coast
water_px = ~land_px
cliff_land = land_px & ~sand_px
mott_dark = np.array([(117, 68, 72), (85, 53, 64), (144, 108, 104)])
mott_light = np.array([(184, 144, 136), (216, 192, 160), (144, 108, 104)])
done = np.zeros((PH, PW), bool)
for k in range(1, 5):   # bottom edge: 4px cliff
    m = cliff_land & shift(water_px, 0, -k) & ~done
    img[m] = (85, 53, 64) if k in (1, 4) else mott_dark[hashv[m]]
    done |= m
for k in range(1, 4):   # side edges
    m = cliff_land & (shift(water_px, k, 0) | shift(water_px, -k, 0)) & ~done
    img[m] = (85, 53, 64) if k == 1 else mott_light[hashv[m]]
    done |= m
for k in range(1, 3):   # top edge
    m = cliff_land & shift(water_px, 0, k) & ~done
    img[m] = (85, 53, 64) if k == 1 else (144, 108, 104)
    done |= m
# shadow in the water below and beside cliffs
cl = up(land) & ~sand_px
shadow = np.zeros((PH, PW), bool)
for k in range(1, 5):
    shadow |= shift(cl, 0, k) | shift(cl, k, 0) | shift(cl, -k, 0)
shadow &= water_px
img[shadow] = (48, 96, 176)
# foam along beaches
foam1 = water_px & near(sand_px, 1)
foam2 = water_px & near(sand_px, 2) & ~foam1
img[foam2] = (184, 216, 249)
img[foam1] = (224, 240, 248)
img[sand_px & near(water_px, 1)] = (224, 209, 136)

out = Image.fromarray(img.clip(0, 255).astype(np.uint8), 'RGB').convert('RGBA')

# ---------------------------------------------------------------------------------------------
# Boardwalks
# ---------------------------------------------------------------------------------------------
dr = ImageDraw.Draw(out)
PLANK = [(232, 208, 144), (216, 188, 120), (200, 172, 108)]
RAIL, SEAM, POST = (120, 80, 48), (150, 112, 70), (96, 60, 40)


def boardwalk(d, cells, pier=False):
    if not cells:
        return
    xs = [x for x, _ in cells]
    ys = [y for _, y in cells]
    x0, y0, x1, y1 = min(xs) * T, min(ys) * T, (max(xs) + 1) * T, (max(ys) + 1) * T
    if d == 'h':
        x0, x1 = x0 - (0 if pier else 6), x1 + 6
        dr.rectangle((x0, y1, x1, y1 + 3), fill=(48, 96, 176))           # shadow
        for x in range(x0, x1, 4):
            c = PLANK[(x // 4) % 3]
            dr.rectangle((x, y0 + 3, x + 3, y1 - 4), fill=c)
            dr.line((x + 3, y0 + 3, x + 3, y1 - 4), fill=SEAM)
        for y in (y0 + 1, y1 - 3):
            dr.rectangle((x0, y, x1, y + 2), fill=RAIL)
            dr.line((x0, y, x1, y), fill=(168, 120, 72))
        for x in range(x0 + 6, x1, 16):
            dr.rectangle((x, y0, x + 2, y0 + 4), fill=POST)
            dr.rectangle((x, y1 - 4, x + 2, y1 + 1), fill=POST)
    else:
        y0, y1 = y0 - 6, y1 + 6
        dr.rectangle((x0 + 2, y1, x1 + 2, y1 + 3), fill=(48, 96, 176))
        dr.rectangle((x1, y0 + 4, x1 + 3, y1), fill=(48, 96, 176))
        for y in range(y0, y1, 4):
            c = PLANK[(y // 4) % 3]
            dr.rectangle((x0 + 3, y, x1 - 4, y + 3), fill=c)
            dr.line((x0 + 3, y + 3, x1 - 4, y + 3), fill=SEAM)
        for x in (x0 + 1, x1 - 3):
            dr.rectangle((x, y0, x + 2, y1), fill=RAIL)
            dr.line((x, y0, x, y1), fill=(168, 120, 72))
        for y in range(y0 + 6, y1, 16):
            dr.rectangle((x0, y, x0 + 4, y + 2), fill=POST)
            dr.rectangle((x1 - 4, y, x1 + 1, y + 2), fill=POST)


for d, cells, pier in bridge_cells:
    boardwalk(d, cells, pier)

# ---------------------------------------------------------------------------------------------
# Objects (painted in y order) and occupancy for the vegetation
# ---------------------------------------------------------------------------------------------
SP = aa.sprites()
kanto = Image.open('src/assets/images/kanto-kanto.png').convert('RGBA')


def kanto_cut(x0, y0, x1, y1):
    im = kanto.crop((x0, y0, x1, y1))
    p = im.load()
    q = deque([(x, y) for x in range(im.width) for y in (0, im.height - 1)] +
              [(x, y) for y in range(im.height) for x in (0, im.width - 1)])
    seen = set()
    ground = {(112, 200, 160), (65, 178, 139), (159, 224, 193), (101, 180, 144), (59, 161, 125), (144, 202, 174),
              (92, 165, 132), (56, 145, 112), (133, 185, 154), (79, 141, 113), (42, 121, 91), (112, 161, 138)}
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        seen.add((x, y))
        if p[x, y][:3] in ground:
            p[x, y] = (0, 0, 0, 0)
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im.crop(im.getbbox())


CAVE = kanto_cut(27 * T, 14 * T, 30 * T, 17 * T)
C = fp
objs = []
occ = np.zeros((H, W), bool)
occ |= kind != GRASS
occ |= bridge


def put(im, cx, by, reserve=True, layer=0):
    """Object centred on tile x `cx` with its bottom on tile y `by`."""
    x, y = int(cx * T - im.width / 2), int(by * T - im.height)
    objs.append((by * T + layer, x, y, im))
    if reserve:
        occ[max(0, y // T):min(H, (y + im.height - 1) // T + 1), max(0, x // T):min(W, (x + im.width - 1) // T + 1)] = True


def try_put(im, cx, by):
    x, y = int(cx * T - im.width / 2), int(by * T - im.height)
    tx0, ty0, tx1, ty1 = x // T, max(0, (y + im.height // 2) // T), (x + im.width - 1) // T, (y + im.height - 1) // T
    if tx0 < 1 or tx1 >= W - 1 or ty1 >= H - 1:
        return False
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            if occ[ty, tx] or dist[ty, tx] != 0:
                return False
            if any(not land[ty + dy, tx + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                return False
    put(im, cx, by)
    return True


stall_rng = random.Random(4)


def stall(c, cx, by):
    put(fp.canopy_stall(c) if stall_rng.random() < 0.35 else fp.stall(c), cx, by)


def line_obj(kind_, P, colors=None, layer=8):
    """Bunting or lantern string as an object, painted in y order just above its lowest point."""
    layer_im = Image.new('RGBA', (PW, PH), (0, 0, 0, 0))
    if kind_ == 'lantern':
        fp.lantern_string(layer_im, P)
    else:
        fp.bunting(layer_im, P, colors or (C.PINK, C.BLUE, C.YELLOW, C.GREEN))
    bb = layer_im.getbbox()
    objs.append((bb[3] + layer, bb[0], bb[1], layer_im.crop(bb)))


def string_line(kind_, pts, colors=None):
    """Bunting / lanterns hung between poles."""
    P = [(x * T, y * T) for x, y in pts]
    line_obj(kind_, P, colors)
    for x, y in pts:
        put(fp.pole(16), x, y + 0.75, reserve=False, layer=-1)

ROW = [C.RED, C.BLUE, C.YELLOW, C.GREEN, C.PINK, C.ORANGE, C.PURPLE, C.TEAL, C.SKY]

# --- Plaza island ------------------------------------------------------------------------------
put(SP['house_orange'], 38.6, 20)
put(SP['pc'], 46, 20)
put(SP['mart'], 52.2, 20)
put(SP['house_blue'], 59.6, 20)
put(SP['planter_tall'], 42.2, 20)
put(SP['planter_tall'], 63.4, 20)
put(SP['planter'], 49.4, 20)
put(SP['planter'], 55.2, 20)
ring = fp.stage_ring(120, 70)
put(ring, 50, 30.4 + 2.2, reserve=False, layer=-2000)
put(fp.screen(), 50, 25.6)
put(fp.stage(84, 46), 50, 31.4)
stars = []
for i, cx in enumerate((40, 42.6, 45.2, 54.8, 57.4, 60)):
    stall(ROW[i], cx, 22.8)
for i, cx in enumerate((40, 42.6, 45.2, 47.8, 52.2, 54.8, 57.4, 60)):
    stall(ROW[(i + 3) % 9], cx, 36.4)
for i, by in enumerate((27, 30.6, 34)):
    stall(ROW[(i + 5) % 9], 39.4, by)
    stall(ROW[(i + 1) % 9], 60.6, by)
for cx, by in ((44, 27), (56, 27), (44, 34), (56, 34)):
    put(fp.lamp_post(), cx, by)
for cx, by in ((46.4, 27.6), (53.6, 27.6), (46.4, 34.6), (53.6, 34.6)):
    put(fp.balloon_bunch(), cx, by)
put(fp.flag_pole(C.PINK), 36.6, 28.6)
put(fp.flag_pole(C.SKY), 36.6, 31.6)
# garlands run along the stall rows (in front of the upper row, behind the lower row)
string_line('bunting', [(38.7, 23.3), (42.6, 23.5), (46.5, 23.3)])
string_line('bunting', [(53.5, 23.3), (57.4, 23.5), (61.3, 23.3)])
for seg in (((38.7, 34.2), (42.6, 34.4), (46.5, 34.2)), ((53.5, 34.2), (57.4, 34.4), (61.3, 34.2))):
    P = [(x * T, y * T) for x, y in seg]
    line_obj('bunting', P, (C.YELLOW, C.RED, C.SKY, C.PURPLE), -60)
    for x, y in seg:
        put(fp.pole(16), x, y + 0.75, reserve=False, layer=-61)
# a string of festival lights around the stage
lights = fp.lights_ring(128, 76)
put(lights, 50, 30.4 + 2.4, reserve=False, layer=-1500)
# the ferry lies alongside the pier, a gangway leads aboard
put(SP['ship'], 27.6, 42 + SP['ship'].height / T - 0.3, reserve=False)
put(fp.gangway(), 26.2, 42.55, reserve=False, layer=5)
for cx, by in ((35, 20), (65, 20), (35.4, 41), (64.6, 41), (34.8, 26)):
    try_put(SP['palm'], cx, by)

# --- s1 Kanto party ------------------------------------------------------------------------------
put(SP['pc'], 6.6, 29)
put(SP['house_blue'], 17.5, 29)
stall(C.RED, 14.2, 29)
put(SP['planter_tall'], 9.6, 29)
for i, cx in enumerate((8, 10.6, 16.6, 19.2)):
    stall((C.YELLOW, C.SKY, C.GREEN, C.PINK)[i], cx, 34.6)
put(fp.balloon_bunch(), 13.9, 36.4)
string_line('bunting', [(6.6, 33.4), (13, 33.0), (19.4, 33.4)], (C.RED, C.WHITE, C.BLUE))

# --- s2 Johto lantern festival --------------------------------------------------------------------
put(SP['house_thatch'], 7, 6)
stall(C.RED, 15.4, 6)
stall(C.ORANGE, 18, 6)
put(fp.torii(), 20.2, 8.2, reserve=False, layer=40)
string_line('lantern', [(4.6, 9.2), (8.6, 9.2), (10.4, 9.2)])
string_line('lantern', [(13.6, 9.2), (17, 9.2), (20.4, 9.2)])
put(SP['house_brown'], 17, 12.6)

# --- s3 Hoenn Millennium festival ----------------------------------------------------------------
put(fp.big_tent(C.RED, 80, 70), 36, 6.1)
stall(C.YELLOW, 29.6, 6)
stall(C.BLUE, 42, 6)
stall(C.PURPLE, 44.6, 6)
for cx, by in ((30, 9.8), (33, 10.4), (39.4, 10.4), (42.6, 9.8)):
    put(fp.star_balloon(), cx, by)
string_line('bunting', [(27.6, 8.8), (34.4, 8.8)], (C.YELLOW, C.SKY))
string_line('bunting', [(37.6, 8.8), (44.4, 8.8)], (C.YELLOW, C.SKY))

# --- s4 Sinnoh contest ---------------------------------------------------------------------------
put(fp.stage(), 59.5, 5.6)
put(SP['pc'], 68, 6)
stall(C.SKY, 54, 6)
stall(C.PINK, 65, 6)
string_line('bunting', [(55.2, 2.6), (59.5, 2.4), (63.8, 2.6)], (C.BLUE, C.WHITE, C.PINK))
put(fp.fountain(), 59.5, 10.4)
for cx in (56.4, 62.6):
    put(SP['planter_tall'], cx, 10.8)

# --- s5 Unova amusement park ---------------------------------------------------------------------
put(fp.roller_coaster(), 82, 6)
put(fp.ferris_wheel(), 93.6, 12.4)
put(fp.cave_mouth(), 80.5, 16.05)
put(fp.balloon_bunch(), 91, 6.4)
for cx, by in ((90.2, 10.8), (85.8, 10.6), (94.4, 15.8)):
    put(fp.balloon_bunch(), cx, by)

# --- s6 Kalos Halloween --------------------------------------------------------------------------
put(fp.big_tent(C.PURPLE, 60, 54), 83.6, 30.2)
put(SP['house_green'], 93.4, 28.2)
stall(C.ORANGE, 85.7, 36)
stall(C.PURPLE, 90.3, 36)
stall(C.TEAL, 90.3, 25.6)
for cx, by in ((80.6, 32.6), (81.8, 34.2), (84, 33.2), (90.6, 32.4), (95, 32.6), (91.4, 37.4), (80.6, 37.4)):
    put(fp.pumpkin(), cx, by)
for cx, by in ((86.4, 25), (86.4, 33), (89.6, 37)):
    put(fp.lamp_post(), cx, by)

# --- s7 Alola beach ------------------------------------------------------------------------------
put(SP['pc'], 93, 52)
stall(C.TEAL, 80, 52)
stall(C.ORANGE, 82.6, 52)
for i, (cx, by) in enumerate(((78.4, 57.2), (82.6, 57.8), (86.8, 57.2), (91, 57.8), (95, 57.2))):
    put(SP['umbrella_blue' if i % 2 else 'umbrella_red'], cx, by)
put(SP['sailboat'], 72.5, 58.4, reserve=False)
put(SP['sailboat'], 98.2, 44.4, reserve=False)

# --- s8 Galar party ------------------------------------------------------------------------------
put(SP['house_brown'], 53.4, 52)
stall(C.RED, 58.2, 52)
stall(C.WHITE, 60.8, 52)
put(fp.cave_mouth(), 66.5, 52.05)
for i, cx in enumerate((56, 58.6, 61.4, 64)):
    stall((C.BLUE, C.YELLOW, C.RED, C.WHITE)[i], cx, 56.6)
string_line('bunting', [(54.4, 54.6), (60, 54.4), (65.6, 54.6)], (C.RED, C.WHITE, C.BLUE))

# --- s9 Paldea crowns ----------------------------------------------------------------------------
put(SP['pc'], 26.4, 52)
for i, cx in enumerate((31.6, 34.2, 36.8, 39.4)):
    stall((C.PURPLE, C.YELLOW, C.TEAL, C.ORANGE)[i], cx, 52)
for i, cx in enumerate((28, 30.6, 33.4, 36)):
    stall((C.PINK, C.ORANGE, C.YELLOW, C.PURPLE)[i], cx, 56.6)
put(fp.balloon_bunch(), 39.6, 56.6)

# --- secret islet --------------------------------------------------------------------------------
put(fp.cave_mouth(26, 22), 9.5, 52.05)

# --- sea decoration ------------------------------------------------------------------------------
for cx, by in ((1.5, 16), (2.5, 18), (98, 21), (97.5, 40.5), (47.5, 44.5), (71.5, 15), (73, 30.5), (30.5, 14.5), (20.5, 46.5)):
    if dist[int(by) - 1, int(cx)] >= 2:
        put(SP['rock'], cx, by, reserve=False)
put(SP['sailboat'], 24.5, 17.5, reserve=False)
put(SP['sailboat'], 73.5, 20.5, reserve=False)
put(fp.blimp(), 49, 14.2, reserve=False, layer=5000)
for cx, by, c in ((24.5, 2.6, C.PINK), (49, 2.6, C.YELLOW), (74.4, 2.8, C.SKY), (17, 44.2, C.PURPLE), (72.4, 42, C.ORANGE), (2, 44, C.GREEN)):
    put(fp.firework(c), cx, by, reserve=False, layer=5000)

# ---------------------------------------------------------------------------------------------
# Vegetation per island
# ---------------------------------------------------------------------------------------------
FLORA = {
    'plaza': ['palm', 'palm', 'tree_round'],
    's1': ['tree_round', 'tree_round', 'palm'],
    's2': ['tree_conifer', 'tree_round', 'tree_conifer_big'],
    's3': ['palm', 'tree_round'],
    's4': ['tree_conifer', 'tree_conifer_big'],
    's5': ['tree_round', 'palm'],
    's6': ['tree_conifer_big', 'tree_conifer'],
    's7': ['palm'],
    's8': ['tree_round', 'tree_conifer'],
    's9': ['palm', 'tree_round'],
    'secret': ['tree_conifer_big', 'tree_conifer'],
}
veg = np.zeros((H, W), bool)       # tiles covered by tree crowns or plants


def try_tree(im, cx, by):
    """Trees may overlap each other like in dense forests, but never paths, plazas or objects."""
    x, y = int(cx * T - im.width / 2), int(by * T - im.height)
    tx0, tx1 = x // T, (x + im.width - 1) // T
    ty0, ty1 = max(0, y // T), (y + im.height - 1) // T
    if tx0 < 1 or tx1 >= W - 1 or ty1 >= H - 1:
        return False
    split = ty0 + (ty1 - ty0 + 1) // 2
    # the trunk half needs free land, the crown may reach over the cliff into the sea but not over paths or objects
    if occ[split:ty1 + 1, tx0:tx1 + 1].any() or (occ[ty0:split, tx0:tx1 + 1] & land[ty0:split, tx0:tx1 + 1]).any():
        return False
    base = [(int(cx - 0.5), ty1), (int(cx), ty1)]
    for bx, byy in base:
        if veg[byy, bx] or face_tiles[byy, bx]:
            return False
        if dist[byy, bx] != 0 or any(not land[byy + dy, bx + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            return False
    put(im, cx, by, reserve=False)
    veg[ty0:ty1 + 1, tx0:tx1 + 1] = True
    for bx, byy in base:
        occ[byy, bx] = True
    return True


def try_plant(im, cx, by):
    tx, ty = int(cx), int(by) - 1
    if occ[ty, tx] or veg[ty, tx] or dist[ty, tx] != 0 or face_tiles[ty, tx]:
        return False
    if any(not land[ty + dy, tx + dx] for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
        return False
    put(im, cx, by, reserve=False)
    veg[ty, tx] = True
    return True


forest_noise = smooth_noise(91, 6)
grass_noise = smooth_noise(92, 4)
for key, (x0, y0, x1, y1) in ISLANDS.items():
    # dense groves where the noise is high, single trees elsewhere
    for row, by in enumerate(frange(y0 + 2, y1 + 0.5, 1.25)):
        off = 0.75 if row % 2 else 0.0
        for cx in frange(x0 + 1 + off, x1 - 1, 1.5):
            tx, ty = int(cx), min(H - 1, int(by))
            dens = 0.95 if forest_noise[ty, tx] > 0.5 else 0.15
            if random.random() < dens:
                try_tree(SP[random.choice(FLORA[key])], cx, by)
GROVES = [  # explicit groves in otherwise empty corners (palms on the plaza island)
    ('plaza', (41, 38, 66, 44), ['palm', 'tree_round', 'palm']),
    ('s7', (75, 45, 86, 50), ['palm']),
    ('s1', (2, 19, 10, 25), ['tree_round', 'tree_conifer']),
    ('s3', (26, 9, 47, 14), ['palm', 'tree_round']),
    ('s9', (35, 46, 43, 51), ['palm']),
]
for key, (x0, y0, x1, y1), kinds in GROVES:
    for row, by in enumerate(frange(y0 + 2, y1 + 0.5, 1.25)):
        for cx in frange(x0 + 1 + (0.75 if row % 2 else 0), x1 - 1, 1.5):
            if random.random() < 0.8:
                try_tree(SP[random.choice(kinds)], cx, by)
for key, (x0, y0, x1, y1) in ISLANDS.items():
    # patches of tall grass on the route islands (where wild Pokémon live)
    if key not in ('plaza', 'secret'):
        for ty in range(y0, y1):
            for tx in range(x0, x1):
                if grass_noise[ty, tx] > 0.6:
                    try_plant(SP['fern'], tx + 0.5, ty + 1)
# flower beds and a few shrubs
for key, (x0, y0, x1, y1) in ISLANDS.items():
    for _ in range(14):
        cx, by = random.randint(x0 + 1, x1 - 2), random.randint(y0 + 2, y1)
        f = SP[random.choice(['flowers_red', 'flowers_blue'])]
        for dx, dy in ((0, 0), (1, 0), (0, 1), (1, 1)):
            if random.random() < 0.8:
                try_plant(f, cx + dx + 0.5, by + dy)
    for _ in range(25):
        try_plant(SP['shrub'], random.randint(x0 + 1, x1 - 2) + 0.5, random.randint(y0 + 2, y1))

# sparkles on the open sea
dr2 = ImageDraw.Draw(out)
for _ in range(90):
    tx, ty = random.randrange(1, W - 1), random.randrange(1, H - 1)
    if dist[ty, tx] >= 2 and not bridge[ty, tx] and not occ[ty, tx]:
        x, y = tx * T + random.randrange(2, 14), ty * T + random.randrange(2, 14)
        dr2.point([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], fill=(200, 224, 248))
        dr2.point((x, y), fill=(255, 255, 255))

for by, x, y, im in objs:
    if im.width >= 14 and im.height >= 14 and im.height < 300 and im.width != 128:
        tx0, tx1, ty = x // T, (x + im.width - 1) // T, (y + im.height - 1) // T
        if not all(land[ty, t] or bridge[ty, t] for t in range(tx0, tx1 + 1)):
            print('object over water at', tx0, ty, im.size)
for by, x, y, im in sorted(objs, key=lambda o: o[0]):
    out.paste(im, (x, y), im)

out.convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else 'festival-archipelago.png', optimize=True)
