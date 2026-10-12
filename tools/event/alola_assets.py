"""Ground textures and object sprites cut out of the Alola town maps (src/assets/images/alola-*.png).

The Alola maps use the modern fan tileset of the later PokéClicker regions: grass, sand paths, beaches
with foam, light stone plazas and three water depths. Objects (buildings, palms, trees, umbrellas, boats)
are cut out with a flood fill that turns the surrounding ground transparent."""
from collections import Counter, deque

from PIL import Image

T = 16
MAPS = {n: Image.open(f'src/assets/images/alola-{n}.png').convert('RGB') for n in ('melemele', 'akala', 'ulaula', 'poni')}

GRASS = {(112, 199, 159), (65, 178, 140), (144, 216, 200), (112, 200, 160), (65, 178, 139), (159, 224, 193)}
PATH = {(208, 192, 128), (192, 168, 104), (224, 216, 160), (168, 144, 74)}
FRINGE = {(168, 216, 160)}
SAND = {(232, 224, 136), (224, 209, 136), (220, 194, 138), (210, 181, 104), (216, 192, 136), (219, 193, 137), (209, 184, 104)}
STONE = {(217, 224, 224), (194, 200, 210), (168, 184, 197), (216, 224, 224), (165, 178, 198), (222, 227, 239), (199, 199, 207)}
GRAVEL = {(144, 136, 136), (120, 112, 112), (168, 160, 152), (105, 96, 103), (184, 174, 158), (128, 169, 145)}
CLIFF = {(117, 68, 72), (85, 53, 64), (144, 108, 104), (184, 144, 136), (216, 192, 160)}
WATER_LIGHT = {(72, 120, 216), (72, 144, 217)}
WATER_MID = {(48, 96, 176), (64, 120, 184)}
WATER_DEEP = {(51, 85, 152), (51, 102, 153)}
FOAM = {(224, 240, 248), (184, 216, 249)}
GROUND = GRASS | PATH | FRINGE | SAND | STONE | GRAVEL | CLIFF | WATER_LIGHT | WATER_MID | WATER_DEEP | FOAM


def tile(m, tx, ty):
    return MAPS[m].crop((tx * T, ty * T, tx * T + T, ty * T + T))


def pure_tiles(colors, need=None, limit=12):
    """Tiles of all maps that only use the given colours (and contain every colour of `need`)."""
    found, seen = [], set()
    for m, im in MAPS.items():
        for ty in range(im.height // T):
            for tx in range(im.width // T):
                t = tile(m, tx, ty)
                data = t.get_flattened_data()
                cs = set(data)
                if cs <= colors and (need is None or need <= cs):
                    key = bytes(t.tobytes())
                    if key not in seen:
                        seen.add(key)
                        found.append((Counter(data).most_common(1)[0][1], t))
    found.sort(key=lambda f: -f[0])
    return [t for _, t in found[:limit]]


def cut(m, box, keep=()):
    """Cut a sprite (pixel box) and make the ground around it transparent."""
    im = MAPS[m].crop(box).convert('RGBA')
    p = im.load()
    ground = GROUND - set(keep)
    seen = set()
    q = deque([(x, y) for x in range(im.width) for y in (0, im.height - 1)] +
              [(x, y) for y in range(im.height) for x in (0, im.width - 1)])
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < im.width and 0 <= y < im.height):
            continue
        seen.add((x, y))
        if p[x, y][:3] in ground:
            p[x, y] = (0, 0, 0, 0)
            q.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return im.crop(im.getbbox())


def px(tx, ty):
    return int(tx * T), int(ty * T)


def box(x0, y0, x1, y1):
    return (*px(x0, y0), *px(x1, y1))


SPRITES = {
    'pc': ('melemele', box(13, 29.6, 18, 34)),
    'mart': ('melemele', box(26, 29.6, 30, 34)),
    'house_brown': ('melemele', box(20, 29.6, 25, 33)),
    'house_blue': ('melemele', box(14, 34.5, 19, 38)),
    'house_thatch': ('melemele', box(22, 34.9, 27, 39)),
    'house_orange': ('melemele', box(28, 35.4, 32, 39)),
    'house_green': ('melemele', box(5, 34.2, 10, 38)),
    'planter_tall': ('melemele', box(13, 36, 14, 38)),
    'planter': ('melemele', box(16, 41, 17, 42)),
    'shrub': ('melemele', box(16, 9, 17, 10)),
    'fern': ('melemele', box(26, 6, 27, 7)),
    'flowers_red': ('melemele', box(18, 9, 19, 10)),
    'flowers_blue': ('melemele', box(15, 10, 16, 11)),
    'palm': ('melemele', box(23, 5, 26, 7.95)),
    'gym_sign': ('melemele', box(29, 9, 30, 11)),
    'umbrella_blue': ('melemele', box(33, 36, 36, 39.6)),
    'umbrella_red': ('melemele', box(38, 39, 41, 42.6)),
    'sailboat': ('melemele', (16, 8, 64, 48)),
    'ship': ('melemele', box(21, 51.9, 29.2, 55.2)),
    'rock': ('melemele', box(29.8, 1, 31.6, 2.7)),
    'tree_round': ('akala', box(62, 0.4, 64.8, 4)),
    'tree_conifer': ('akala', box(76.1, 0, 77.95, 3.1)),
    'tree_conifer_big': ('akala', box(82, 3, 84, 6.2)),
}


KEEP = {'sailboat': FOAM | STONE}


def sprites():
    return {k: cut(m, b, KEEP.get(k, ())) for k, (m, b) in SPRITES.items()}


if __name__ == '__main__':
    import sys
    sp = sprites()
    sheet = Image.new('RGBA', (900, 420), (255, 0, 255, 255))
    x = y = 4
    rowh = 0
    for k, s in sp.items():
        if x + s.width > 896:
            x, y = 4, y + rowh + 6
            rowh = 0
        sheet.paste(s, (x, y), s)
        x += s.width + 6
        rowh = max(rowh, s.height)
    for name, cols, need in (('grass', GRASS, None), ('path', PATH, None), ('sand', SAND, None), ('stone', STONE, None),
                             ('wl', WATER_LIGHT, None), ('wm', WATER_MID, None), ('wd', WATER_DEEP, None)):
        ts = pure_tiles(cols, need, 6)
        print(name, len(ts))
        for i, t in enumerate(ts):
            sheet.paste(t, (4 + i * 18 + 120 * ['grass', 'path', 'sand', 'stone', 'wl', 'wm', 'wd'].index(name), 390))
    sheet.save(sys.argv[1])
