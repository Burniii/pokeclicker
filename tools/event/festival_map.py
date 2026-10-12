"""Builds the map of the Festival Archipelago (event region) in the style of the Kanto town map.

The map is assembled from real 16px tiles of src/assets/images/kanto-kanto.png:
- buildings, the cave islet and the sea route markings are copied as whole tile blocks,
- water, grass, paths and every coast or path edge are synthesised tile by tile: for each
  target tile the Kanto tile with the same terrain and the most similar 8 neighbours is copied,
  so coastlines, beaches and path borders look exactly like the Kanto ones,
- trees, bushes and flowers are cut out of Kanto tiles and placed on the grass.

Usage: python3 tools/event/festival_map.py src/assets/images/festival-archipelago.png
Copied from tools/fusion/island_map.py with a different layout.
"""
import os
import random
import sys
from collections import Counter, defaultdict, deque

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import festival_props as fp  # noqa: E402

T = 16
W, H = 100, 60
KANTO = 'src/assets/images/kanto-kanto.png'

random.seed(11)
K = Image.open(KANTO).convert('RGB')
KW, KH = K.width // T, K.height // T

GRASS_A = [(112, 200, 160), (65, 178, 139), (159, 224, 193)]
GRASS_B = [(101, 180, 144), (59, 161, 125), (144, 202, 174)]
GRASS_C = [(92, 165, 132), (56, 145, 112), (133, 185, 154)]
GRASS_D = [(79, 141, 113), (42, 121, 91), (112, 161, 138)]
GRASS = set(GRASS_A + GRASS_B + GRASS_C + GRASS_D)
SAND = {(232, 224, 136), (219, 193, 137), (209, 184, 104), (216, 192, 136)}
EDGE = {(184, 224, 160)}
DIRT = {(122, 72, 73), (88, 55, 65), (150, 104, 103), (184, 144, 136), (215, 192, 156), (199, 163, 148), (65, 47, 65), (132, 88, 89)}
W1 = {(72, 120, 216), (72, 144, 217)}
W2 = {(49, 98, 175), (64, 122, 186)}
W3 = {(40, 79, 145), (52, 99, 153)}


def is_water(p):
    return p[2] > 140 and p[2] > p[0] + 50 and p[2] > p[1] + 20


def label_of(tile):
    """Terrain label of a 16x16 tile: W1/W2/W3 water, S sand path, G grass, X anything else."""
    px = list(tile.get_flattened_data()) if hasattr(tile, 'get_flattened_data') else list(tile.getdata())
    n = len(px)
    water = [p for p in px if is_water(p)]
    if len(water) * 2 >= n:
        # Water tiles must not carry route markings, rocks or buildings
        if any(not is_water(p) and p not in DIRT and p not in GRASS and p not in SAND and p not in EDGE for p in px):
            return 'X'
        c = Counter('1' if p in W1 else '2' if p in W2 else '3' if p in W3 else '?' for p in water)
        return f'W{max("123", key=lambda k: c[k])}'
    if sum(p in SAND for p in px) * 2 >= n:
        return 'S'
    grass = sum(p in GRASS for p in px)
    if grass * 2 >= n and grass + sum(p in EDGE or p in DIRT or is_water(p) for p in px) >= n * 0.92:
        # Cliff dirt only belongs to grass tiles at the coast (checked once all labels are known)
        return 'Gd' if any(p in DIRT for p in px) else 'G'
    return 'X'


# Labels of all Kanto tiles and how often each tile picture occurs
klabel = {}
kfreq = {}
pictures = Counter()
for ty in range(KH):
    for tx in range(KW):
        tile = K.crop((tx * T, ty * T, tx * T + T, ty * T + T))
        klabel[tx, ty] = label_of(tile)
        pictures[tile.tobytes()] += 1
        kfreq[tx, ty] = tile.tobytes()
kfreq = {k: pictures[v] for k, v in kfreq.items()}
for (tx, ty), lbl in list(klabel.items()):
    if lbl == 'Gd':
        coast = any(klabel.get((tx + dx, ty + dy), 'X').startswith('W') for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        klabel[tx, ty] = 'G' if coast else 'X'

NEIGH = [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
WEIGHT = [1, 3, 1, 3, 3, 1, 3, 1]


def kl(x, y):
    return klabel.get((x, y), 'X')


def coarse(lbl):
    return 'W' if lbl.startswith('W') else lbl


# Index Kanto tiles by label and 4-neighbourhood (coarse) for quick lookup
index = defaultdict(list)
by_label = defaultdict(list)
for (tx, ty), lbl in klabel.items():
    if lbl == 'X':
        continue
    key = (lbl,) + tuple(coarse(kl(tx + dx, ty + dy)) for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)))
    index[key].append((tx, ty))
    by_label[lbl].append((tx, ty))

# ---------------------------------------------------------------------------------------------
# Target layout (tile coordinates)
# ---------------------------------------------------------------------------------------------
target = [['W2'] * W for _ in range(H)]
fixed = {}  # (x, y) -> Kanto tile copied unchanged (blocks)
land = [[False] * W for _ in range(H)]


def fill_land(x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            land[y][x] = True


def cut_water(x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            land[y][x] = False


def island(x0, y0, x1, y1):
    """Rectangular island with stepped corners like the Kanto coasts."""
    fill_land(x0, y0, x1, y1)
    cut_water(x0, y0, x0 + 2, y0 + 2)
    cut_water(x1 - 3, y0, x1, y0 + 1)
    cut_water(x0, y1 - 1, x0 + 3, y1)
    cut_water(x1 - 2, y1 - 2, x1, y1)


# Festival plaza in the middle and nine stage islands around it (clockwise from the west)
ISLANDS = {
    'plaza': (35, 15, 65, 41),
    's1': (4, 22, 22, 38),     # Kanto: party
    's2': (4, 2, 22, 14),      # Johto: lantern festival
    's3': (27, 1, 46, 12),     # Hoenn: Jirachi's Millennium festival (circus tent)
    's4': (52, 1, 71, 12),     # Sinnoh: contest stage and stalls
    's5': (77, 1, 96, 17),     # Unova: amusement park (Nimbasa)
    's6': (79, 24, 96, 38),    # Kalos: Halloween
    's7': (76, 45, 96, 58),    # Alola: summer beach
    's8': (50, 46, 69, 58),    # Galar: party
    's9': (22, 46, 41, 58),    # Paldea: crowns
}
for box in ISLANDS.values():
    island(*box)

for y in range(H):
    for x in range(W):
        if land[y][x]:
            target[y][x] = 'G'


def path(x0, y0, x1, y1):
    for y in range(y0, y1):
        for x in range(x0, x1):
            if land[y][x]:
                target[y][x] = 'S'


def block(kx, ky, w, h, x, y):
    """Copy a w x h tile block from Kanto (kx, ky) to (x, y)."""
    for dy in range(h):
        for dx in range(w):
            fixed[x + dx, y + dy] = (kx + dx, ky + dy)
            target[y + dy][x + dx] = kl(kx + dx, ky + dy)


# Routes on the islands (sand paths, 3 tiles wide like the Kanto routes); they meet the sea routes
PATHS = [
    (8, 28, 22, 31), (11, 22, 14, 28),            # s1
    (11, 6, 22, 9), (11, 9, 14, 14),              # s2
    (27, 6, 46, 9),                               # s3
    (52, 6, 71, 9),                               # s4
    (77, 6, 89, 9), (86, 9, 89, 17),              # s5
    (86, 24, 89, 38),                             # s6
    (86, 45, 89, 51), (76, 50, 89, 53),           # s7
    (50, 50, 69, 53),                             # s8
    (22, 50, 37, 53),                             # s9
    (35, 28, 38, 31),                             # plaza entrance
]
for p in PATHS:
    path(*p)
# The festival plaza itself (sand ring, paved inside after the synthesis)
PLAZA = (37, 20, 63, 39)
path(*PLAZA)
# Beaches
for bx0, by0, bx1, by1 in ((4, 34, 10, 38), (76, 54, 96, 58), (88, 13, 96, 17), (22, 55, 28, 58)):
    for y in range(by0, by1):
        for x in range(bx0, bx1):
            if land[y][x] and target[y][x] == 'G':
                target[y][x] = 'S'

# Water depth like on the Kanto map: light water along the coast, darker water far out
dist = [[99] * W for _ in range(H)]
q = deque()
for y in range(H):
    for x in range(W):
        if land[y][x]:
            dist[y][x] = 0
            q.append((x, y))
while q:
    x, y = q.popleft()
    for dx, dy in NEIGH:
        nx, ny = x + dx, y + dy
        if 0 <= nx < W and 0 <= ny < H and dist[ny][nx] > dist[y][x] + 1:
            dist[ny][nx] = dist[y][x] + 1
            q.append((nx, ny))
for y in range(H):
    for x in range(W):
        if not land[y][x]:
            target[y][x] = 'W1' if dist[y][x] <= 1 else 'W2'

# Blocks copied from Kanto
HOUSE, PC, CAVE = (22, 36, 5, 5), (22, 10, 6, 4), (27, 14, 3, 3)
BLOCKS = [
    (HOUSE, 39, 15), (PC, 47, 16), (HOUSE, 57, 15),       # houses and Pokémon Center at the top of the plaza
    (PC, 5, 23),                                           # s1
    (HOUSE, 15, 9),                                        # s2
    (PC, 64, 2),                                           # s4
    (HOUSE, 91, 26),                                       # s6
    (PC, 89, 46),                                          # s7
    (CAVE, 64, 47),                                        # s8 (dungeon)
    (PC, 25, 46),                                          # s9
    (CAVE, 78, 12),                                        # s5 (dungeon below the coaster)
]
for (kx, ky, w, h), x, y in BLOCKS:
    block(kx, ky, w, h, x, y)
block(34, 51, 7, 7, 8, 45)   # Seafoam rocks -> secret cave of stage 9 (Armored Mewtwo)
# plain water tiles of the copied block are synthesised so they match the surrounding sea
for y in range(45, 52):
    for x in range(8, 15):
        if target[y][x].startswith('W'):
            del fixed[x, y]
            target[y][x] = 'W1' if dist[y][x] <= 1 else 'W2'


# Sea routes with the white Kanto markings: horizontal = 1x3 column repeated, vertical = 3x1 row repeated
def sea_h(x0, x1, y):
    for x in range(x0, x1):
        if not any(land[y + k][x] for k in range(3)):
            block(32, 54, 1, 3, x, y)


def sea_v(x, y0, y1):
    for y in range(y0, y1):
        if not any(land[y][x + k] for k in range(3)):
            block(23, 45, 3, 1, x, y)


sea_h(22, 35, 28)     # plaza -> s1
sea_v(11, 14, 22)     # s1 -> s2
sea_h(22, 27, 6)      # s2 -> s3
sea_h(46, 52, 6)      # s3 -> s4
sea_h(71, 77, 6)      # s4 -> s5
sea_v(86, 17, 24)     # s5 -> s6
sea_v(86, 38, 45)     # s6 -> s7
sea_h(69, 76, 50)     # s7 -> s8
sea_h(41, 50, 50)     # s8 -> s9
sea_h(15, 22, 48)     # s9 -> secret cave

# ---------------------------------------------------------------------------------------------
# Tile synthesis
# ---------------------------------------------------------------------------------------------


def tl(x, y):
    if 0 <= x < W and 0 <= y < H:
        return target[y][x]
    return 'W3'


def choose(x, y):
    lbl = tl(x, y)
    want = [tl(x + dx, y + dy) for dx, dy in NEIGH]
    key = (lbl,) + tuple(coarse(tl(x + dx, y + dy)) for dx, dy in ((0, -1), (-1, 0), (1, 0), (0, 1)))
    cands = index.get(key) or by_label.get(lbl) or by_label['G']
    best, best_score = [], -1
    for tx, ty in cands:
        score = 0
        for (dx, dy), w, wl in zip(NEIGH, WEIGHT, want):
            got = kl(tx + dx, ty + dy)
            if got == wl:
                score += w * 2
            elif coarse(got) == coarse(wl):
                score += w
        if score > best_score:
            best, best_score = [(tx, ty)], score
        elif score == best_score:
            best.append((tx, ty))
    # Water keeps its wave pattern because every tile repeats it every 16px.
    # Among equally good tiles, common pictures are preferred: calm water and plain grass like on the Kanto map
    return random.choices(best, weights=[kfreq[b] ** 2 for b in best])[0]


out = Image.new('RGB', (W * T, H * T))
for y in range(H):
    for x in range(W):
        src = fixed.get((x, y)) or choose(x, y)
        out.paste(K.crop((src[0] * T, src[1] * T, src[0] * T + T, src[1] * T + T)), (x * T, y * T))

# One grass shade everywhere (Kanto uses darker shades for plateaus)
remap = {b: a for b, a in zip(GRASS_B + GRASS_C + GRASS_D, GRASS_A * 3)}
px = out.load()
for y in range(out.height):
    for x in range(out.width):
        p = px[x, y]
        if p in remap:
            px[x, y] = remap[p]

# ---------------------------------------------------------------------------------------------
# Vegetation sprites (cut out of Kanto tiles, grass made transparent)
# ---------------------------------------------------------------------------------------------


def sprite(x0, y0, x1, y1):
    """Cut an object out of Kanto: ground (grass, water, coast) around it becomes transparent."""
    im = K.crop((x0, y0, x1, y1)).convert('RGBA')
    p = im.load()
    seen = set()
    q = deque([(x, y) for x in range(im.width) for y in (0, im.height - 1)] +
              [(x, y) for y in range(im.height) for x in (0, im.width - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        seen.add((x, y))
        c = p[x, y][:3]
        if c in GRASS or c in DIRT or is_water(c):
            p[x, y] = (0, 0, 0, 0)
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im


# Isolated tree on Route 21's north shore (its crown reaches 5px into the tile row above)
TREE = sprite(56 * T, 41 * T + 10, 58 * T, 44 * T)
BUSH = sprite(58 * T, 43 * T, 59 * T, 44 * T)
FLOWER = sprite(58 * T, 42 * T, 59 * T, 43 * T)
FLOWERS = sprite(47 * T, 1 * T, 48 * T, 2 * T)


def free(x, y, w, h):
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            if not (0 <= xx < W and 0 <= yy < H) or target[yy][xx] != 'G' or (xx, yy) in fixed:
                return False
            # keep one tile of grass to the coast
            if any(tl(xx + dx, yy + dy).startswith('W') for dx, dy in NEIGH):
                return False
    return True


used = set()


def place(img, x, y, w, h):
    if free(x, y, w, h) and not any((xx, yy) in used for xx in range(x, x + w) for yy in range(y, y + h)):
        out.paste(img, (x * T, (y + h) * T - img.height), img)
        used.update((xx, yy) for xx in range(x, x + w) for yy in range(y, y + h))
        return True
    return False


def forest(x0, y0, x1, y1, density=0.8):
    """Loose groups of trees like on the Kanto routes, with bushes in the gaps."""
    for y in range(y0, y1, 2):
        for x in range(x0 + random.randint(0, 1), x1, 2):
            if random.random() < density:
                place(TREE, x, y, 2, 2)
            elif random.random() < 0.5:
                place(BUSH, x + random.randint(0, 1), y + random.randint(0, 1), 1, 1)


# ---------------------------------------------------------------------------------------------
# Festival decoration (tools/event/festival_props.py)
# ---------------------------------------------------------------------------------------------

# The plaza is paved with pink festival tiles inside its sand border
paving = [fp.pink_paving(T, seed=k) for k in range(4)]
for y in range(PLAZA[1] + 1, PLAZA[3] - 1):
    for x in range(PLAZA[0] + 1, PLAZA[2] - 1):
        out.paste(paving[(x * 7 + y * 3) % 4], (x * T, y * T))
out_rgba = out.convert('RGBA')
out = out_rgba


def prop(img, cx, by, reserve=True):
    """Paste a prop centred on map pixel cx with its bottom on map pixel by and reserve its tiles."""
    x, y = int(cx - img.width / 2), int(by - img.height)
    out.paste(img, (x, y), img)
    if reserve:
        for ty in range(y // T, (y + img.height - 1) // T + 1):
            for tx in range(x // T, (x + img.width - 1) // T + 1):
                used.add((tx, ty))


def at(tx, ty):
    """Map pixel of tile coordinates (fractions allowed)."""
    return tx * T, ty * T


def stalls(row, ty, colors):
    for tx, c in zip(row, colors):
        prop(fp.stall(c), *at(tx, ty))


ROW_COLS = [fp.RED, fp.BLUE, fp.YELLOW, fp.GREEN, fp.PINK, fp.ORANGE, fp.PURPLE, fp.TEAL, fp.SKY]

# --- Festival plaza: round stage in the middle, screen behind it, a ring of stalls, bunting and lamps
ring = fp.stage_ring()
out.paste(ring, (50 * T - ring.width // 2, int(29.6 * T) - ring.height // 2), ring)
fp.bunting(out, [at(38, 21.6), at(44, 24.4), at(50, 24.6), at(56, 24.4), at(62, 21.6)])
fp.bunting(out, [at(38, 37.2), at(44, 35.0), at(50, 35.3), at(56, 35.0), at(62, 37.2)], (fp.YELLOW, fp.RED, fp.SKY, fp.PURPLE))
prop(fp.screen(), *at(50, 25.2))
prop(fp.stage(), *at(50, 30.6))
fp.stage_emblem(out, 50 * T, int(28.9 * T))
stalls([40, 42.5, 45, 55, 57.5, 60], 23.2, ROW_COLS)
stalls([40, 42.5, 45, 47.5, 52.5, 55, 57.5, 60], 38, ROW_COLS[3:] + ROW_COLS)
for ty, c in ((27.5, fp.ORANGE), (31.5, fp.SKY), (35, fp.PINK)):
    prop(fp.stall(c), *at(39.8, ty))
for ty, c in ((27.5, fp.TEAL), (31.5, fp.RED), (35, fp.YELLOW)):
    prop(fp.stall(c), *at(60.2, ty))
for tx, ty in ((44, 27), (56, 27), (44, 33.5), (56, 33.5), (38.6, 24.5), (61.4, 24.5)):
    prop(fp.lamp_post(), *at(tx, ty))
for tx, ty in ((46, 27.4), (54, 27.4), (47, 34.5), (53, 34.5)):
    prop(fp.balloon_bunch(), *at(tx, ty))

# --- s1 Kanto party: stalls along the route, balloons
stalls([15.5, 19], 27.6, [fp.RED, fp.BLUE])
stalls([7, 9.5], 34, [fp.YELLOW, fp.SKY])
stalls([15.5, 19], 34, [fp.GREEN, fp.PINK])
for tx, ty in ((11.5, 35), (12.5, 27.5), (18, 36.5)):
    prop(fp.balloon_bunch(), *at(tx, ty))
fp.bunting(out, [at(14, 28.2), at(17, 27.9), at(21.5, 28.2)], (fp.RED, fp.WHITE, fp.BLUE))

# --- s2 Johto lantern festival
stalls([17, 20], 5.6, [fp.RED, fp.ORANGE])
stalls([6.5, 9], 13, [fp.RED, fp.YELLOW])
fp.lantern_string(out, [at(5, 5.2), at(10, 5.8), at(14, 5.4)])
fp.lantern_string(out, [at(4.5, 9.6), at(8, 10.0), at(10.8, 9.6)])

# --- s3 Hoenn: Millennium festival of the Wishmaker movie with the big circus tent
prop(fp.big_tent(fp.RED, 76, 66), *at(36.5, 6.2))
stalls([29.5, 44], 5.8, [fp.YELLOW, fp.BLUE])
stalls([31, 41.5, 44], 11.5, [fp.PURPLE, fp.PINK, fp.TEAL])
for tx, ty in ((29, 10.5), (33, 11.2), (40, 11.0)):
    prop(fp.star_balloon(), *at(tx, ty))
prop(fp.blimp(), *at(48.6, 14.2), reserve=False)
# fireworks over the sea (Millennium night of the Wishmaker movie)
for tx, ty, c in ((24.5, 2.5, fp.PINK), (48.5, 2.2, fp.YELLOW), (74, 2.6, fp.SKY), (31, 43.5, fp.PURPLE), (73, 41.5, fp.ORANGE), (2, 42, fp.GREEN)):
    prop(fp.firework(c), *at(tx, ty), reserve=False)
fp.bunting(out, [at(27.5, 6.1), at(32, 5.6)], (fp.YELLOW, fp.SKY))

# --- s4 Sinnoh: contest hall stage and stalls
prop(fp.stage(), *at(58, 5.8))
stalls([53.5, 62], 5.6, [fp.BLUE, fp.PINK])
stalls([54, 57, 60, 63], 11.6, [fp.SKY, fp.WHITE, fp.PURPLE, fp.YELLOW])
fp.bunting(out, [at(52.5, 9.2), at(60, 9.6), at(70.5, 9.2)], (fp.BLUE, fp.WHITE, fp.PINK))

# --- s5 Unova: Nimbasa-like amusement park, ferris wheel and roller coaster
prop(fp.ferris_wheel(), *at(91.8, 9.4))
prop(fp.roller_coaster(), *at(81.8, 5.8))
stalls([79.5, 82.5], 12.2, [fp.YELLOW, fp.RED])
for tx, ty in ((84, 11), (90, 16), (94.5, 16)):
    prop(fp.balloon_bunch(), *at(tx, ty))

# --- s6 Kalos Halloween: purple tent, pumpkins, lamps
prop(fp.big_tent(fp.PURPLE), *at(83, 31))
stalls([92, 94.5], 37.4, [fp.ORANGE, fp.PURPLE])
for tx, ty in ((81, 33), (82.5, 34), (84.5, 33), (90.5, 33), (92, 34.2), (94.5, 33.6), (82, 36.5)):
    prop(fp.pumpkin(), *at(tx, ty))
for tx, ty in ((85.4, 27), (85.4, 35), (89.6, 31)):
    prop(fp.lamp_post(), *at(tx, ty))

# --- s7 Alola beach: parasols and a snack stall
for k, (tx, ty) in enumerate(((78, 56.4), (81.5, 57.4), (85, 56.2), (89, 57.6), (92.5, 56.4), (95, 57.6))):
    prop(fp.parasol([fp.RED, fp.YELLOW, fp.SKY, fp.PINK, fp.GREEN, fp.ORANGE][k]), *at(tx, ty))
stalls([80, 83], 49.6, [fp.TEAL, fp.ORANGE])

# --- s8 Galar: party with stalls and bunting
stalls([52, 55, 58, 61], 49.6, [fp.RED, fp.WHITE, fp.BLUE, fp.YELLOW])
stalls([54, 58], 56.4, [fp.PINK, fp.GREEN])
fp.bunting(out, [at(50.5, 53.4), at(56, 53.9), at(62, 53.4)], (fp.RED, fp.WHITE, fp.BLUE))

# --- s9 Paldea: crown festival
stalls([32, 35, 38], 49.6, [fp.PURPLE, fp.YELLOW, fp.TEAL])
stalls([31, 35], 56.4, [fp.ORANGE, fp.PINK])
prop(fp.balloon_bunch(), *at(39.5, 56.5))
fp.bunting(out, [at(30, 53.4), at(37, 53.8)], (fp.PURPLE, fp.YELLOW, fp.ORANGE))

# ---------------------------------------------------------------------------------------------
# Vegetation around the festival
# ---------------------------------------------------------------------------------------------
for key, (x0, y0, x1, y1) in ISLANDS.items():
    if key != 'plaza':
        forest(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.3)
forest(35, 15, 38, 41, 0.6)
forest(62, 15, 65, 41, 0.6)
for _ in range(900):
    x, y = random.randrange(W), random.randrange(H)
    r = random.random()
    if r < 0.3:
        place(BUSH, x, y, 1, 1)
    elif r < 0.45:
        place(random.choice([FLOWER, FLOWERS]), x, y, 1, 1)

out.convert('RGB').save(sys.argv[1] if len(sys.argv) > 1 else 'festival-archipelago.png', optimize=True)
