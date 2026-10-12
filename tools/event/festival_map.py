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
import random
import sys
from collections import Counter, defaultdict, deque

from PIL import Image

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
    'plaza': (39, 17, 61, 37),
    's1': (6, 23, 22, 37),    # after the Kanto Champion
    's2': (6, 3, 23, 14),     # Johto
    's3': (31, 2, 47, 12),    # Hoenn
    's4': (55, 2, 71, 12),    # Sinnoh
    's5': (79, 4, 95, 16),    # Unova
    's6': (80, 25, 95, 37),   # Kalos
    's7': (78, 45, 94, 57),   # Alola
    's8': (52, 45, 68, 57),   # Galar
    's9': (24, 45, 40, 57),   # Paldea
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


# Routes on the islands (sand paths, 3 tiles wide like the Kanto routes); they end at the sea routes
path(22 - 13, 28, 22, 31)     # s1: west-east
path(9, 14 - 8, 12, 14)       # s2: down to s1
path(9, 6, 23, 9)             # s2: east-west
path(31, 6, 47, 9)            # s3
path(55, 6, 71, 9)            # s4
path(79, 6, 85, 9)            # s5 west
path(86, 9, 89, 16)           # s5 down
path(86, 25, 89, 37)          # s6
path(84, 45, 87, 52)          # s7 down
path(78, 50, 87, 53)          # s7 west
path(52, 50, 68, 53)          # s8
path(28, 50, 40, 53)          # s9
path(39, 28, 46, 31)          # plaza: west exit
# Beaches
for bx0, by0, bx1, by1 in ((6, 33, 12, 37), (35, 2, 41, 4), (90, 4, 95, 8), (88, 53, 94, 57), (24, 54, 31, 57), (56, 33, 61, 37)):
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
block(2, 0, 13, 12, 43, 19)   # Indigo Plateau with statues -> Festival plaza
TOWNS = {
    's1': ('pc', 9, 24), 's2': ('house', 15, 3), 's3': ('house', 41, 2), 's4': ('pc', 64, 2),
    's5': ('cave', 89, 10), 's6': ('house', 89, 27), 's7': ('pc', 88, 46), 's8': ('cave', 63, 47), 's9': ('pc', 24, 46),
}
for key, (kind, x, y) in TOWNS.items():
    if kind == 'pc':
        block(22, 10, 6, 4, x, y)     # Pokémon Center with plaza (Viridian City)
    elif kind == 'house':
        block(22, 36, 5, 5, x, y)     # House with red roof (Pallet Town)
    else:
        block(27, 14, 3, 3, x, y)     # Rock mound with a cave entrance
block(34, 51, 7, 7, 30, 37)   # Seafoam rocks -> secret cave of stage 9 (Armored Mewtwo)


# Sea routes with the white Kanto markings: horizontal = 1x3 column repeated, vertical = 3x1 row repeated
def sea_h(x0, x1, y):
    for x in range(x0, x1):
        if not land[y + 1][x]:
            block(32, 54, 1, 3, x, y)


def sea_v(x, y0, y1):
    for y in range(y0, y1):
        if not land[y][x + 1]:
            block(23, 45, 3, 1, x, y)


sea_h(23, 38, 28)     # plaza -> s1
sea_v(9, 15, 22)      # s1 -> s2
sea_h(24, 30, 6)      # s2 -> s3
sea_h(48, 54, 6)      # s3 -> s4
sea_h(72, 78, 6)      # s4 -> s5
sea_v(86, 17, 24)     # s5 -> s6
sea_v(84, 38, 44)     # s6 -> s7
sea_h(69, 77, 50)     # s7 -> s8
sea_h(41, 51, 50)     # s8 -> s9
sea_v(33, 44, 44)     # s9 -> secret cave (no line, short hop)

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


for key, (x0, y0, x1, y1) in ISLANDS.items():
    if key != 'plaza':
        forest(x0 + 1, y0 + 1, x1 - 1, y1 - 1, 0.35)
forest(39, 17, 43, 37, 0.5)
forest(57, 17, 61, 37, 0.5)
for _ in range(900):
    x, y = random.randrange(W), random.randrange(H)
    r = random.random()
    if r < 0.3:
        place(BUSH, x, y, 1, 1)
    elif r < 0.4:
        place(random.choice([FLOWER, FLOWERS]), x, y, 1, 1)

out.save(sys.argv[1] if len(sys.argv) > 1 else 'festival-archipelago.png', optimize=True)
