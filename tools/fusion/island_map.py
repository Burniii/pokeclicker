# Pixel-art map of the Fusion island, drawn at 1/4 size (1 px = 4 map px, 1 tile = 4 px) and upscaled.
# Usage: python3 tools/fusion/island_map.py src/assets/images/fusion-island.png
import random, math, sys
from PIL import Image, ImageDraw
random.seed(7)
W, H = 400, 240
img = Image.new('RGB', (W, H), (52, 112, 186))
d = ImageDraw.Draw(img)
px = img.load()
# Ocean texture
for y in range(H):
    for x in range(W):
        if (x * 7 + y * 13) % 29 == 0 or random.random() < 0.02:
            px[x, y] = (78, 140, 210)
T = 4  # pixels per tile

def blob(cx, cy, rx, ry, jitter, n=48):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + random.uniform(-jitter, jitter)
        pts.append((cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r))
    return pts

# Island (several overlapping blobs), first as sand then grass slightly smaller
shapes = [(28, 40, 26, 12), (48, 30, 18, 18), (68, 28, 20, 16), (78, 42, 14, 10), (50, 45, 22, 8), (16, 40, 10, 9)]
for cx, cy, rx, ry in shapes:
    d.polygon(blob(cx * T, cy * T, (rx + 2) * T, (ry + 2) * T, 0.08), fill=(226, 206, 140))
for cx, cy, rx, ry in shapes:
    d.polygon(blob(cx * T, cy * T, rx * T, ry * T, 0.08), fill=(104, 176, 72))
# Grass texture
for y in range(H):
    for x in range(W):
        if px[x, y] == (104, 176, 72) and random.random() < 0.12:
            px[x, y] = random.choice([(92, 160, 62), (120, 190, 86)])

def trees(x0, y0, x1, y1, count, colors=((40, 110, 50), (54, 130, 60))):
    for _ in range(count):
        x = random.randint(x0 * T, x1 * T); y = random.randint(y0 * T, y1 * T)
        if px[x, y][1] < 150 or px[x, y][2] > 150:
            continue
        c = random.choice(colors)
        d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=c, outline=(24, 70, 30))
        px[x, y - 1] = (90, 170, 90)

# Forest along route 1
trees(17, 30, 33, 37, 70)
trees(17, 43, 33, 49, 60)
# River/lake along route 2
d.polygon(blob(41 * T, 30 * T, 4 * T, 10 * T, 0.12), fill=(70, 140, 214))
d.line([(41 * T, 20 * T), (41 * T, 40 * T)], fill=(96, 164, 228), width=3)
# Volcanic area around route 3
for cx in (44, 52, 58):
    d.polygon(blob(cx * T, 13 * T, 4 * T, 3 * T, 0.2), fill=(140, 92, 70))
d.polygon([(52 * T - 10, 13 * T + 6), (52 * T, 13 * T - 14), (52 * T + 10, 13 * T + 6)], fill=(110, 70, 56))
d.ellipse((52 * T - 3, 13 * T - 15, 52 * T + 3, 13 * T - 11), fill=(240, 110, 40))
# Desert around route 4
d.polygon(blob(72 * T, 28 * T, 6 * T, 9 * T, 0.15), fill=(222, 196, 120))
for _ in range(40):
    x = random.randint(66 * T, 78 * T); y = random.randint(20 * T, 37 * T)
    if px[x, y] == (222, 196, 120):
        px[x, y] = (200, 170, 96)
# Mountain with the cave
d.polygon(blob(84 * T, 38 * T, 8 * T, 7 * T, 0.12), fill=(128, 120, 116))
for i in range(3):
    bx = (79 + i * 4) * T
    d.polygon([(bx - 12, 36 * T), (bx, 30 * T + i * 3), (bx + 12, 36 * T)], fill=(150, 144, 140), outline=(90, 84, 80))
    d.polygon([(bx - 3, 31 * T + i * 3), (bx, 30 * T + i * 3), (bx + 3, 31 * T + i * 3)], fill=(240, 240, 250))
# Lab plaza: DNA helix decoration
for i in range(18):
    y = 28 * T + i * 2
    a = i / 3.0
    x1 = 13 * T + int(math.sin(a) * 6); x2 = 13 * T - int(math.sin(a) * 6)
    px[x1, y] = (220, 60, 160); px[x2, y] = (60, 200, 230)
    if i % 3 == 0:
        d.line([(x1, y), (x2, y)], fill=(240, 240, 240))
# Dirt paths below the routes
for rx, ry, rw, rh in ((16, 38.5, 18, 3), (34, 18, 3, 23.5), (37, 18, 26, 3), (63, 18, 3, 21), (67.5, 40.5, 12.5, 2)):
    d.rectangle((rx * T + 1, ry * T + 1, (rx + rw) * T - 2, (ry + rh) * T - 2), fill=(206, 180, 122))
    for _ in range(int(rw * rh)):
        x = random.randint(int(rx * T) + 1, int((rx + rw) * T) - 2); y = random.randint(int(ry * T) + 1, int((ry + rh) * T) - 2)
        px[x, y] = (184, 158, 104)
# Cave entrance
d.rectangle((80 * T, 37 * T, 85 * T - 1, 42 * T - 1), fill=(110, 102, 98))
d.ellipse((81 * T, 38 * T + 2, 84 * T - 1, 42 * T + 4), fill=(30, 26, 28))
# Town plazas
for tx, ty, tw, th in ((10, 37, 6, 6), (61.5, 39, 6, 6)):
    d.rectangle((tx * T - 3, ty * T - 3, (tx + tw) * T + 2, (ty + th) * T + 2), fill=(196, 190, 176), outline=(120, 110, 100))
# Small houses around towns
for hx, hy in ((8, 35), (17, 35), (8, 44), (60, 37), (68, 37), (60, 46), (68, 46)):
    x, y = hx * T, hy * T
    d.rectangle((x, y + 2, x + 6, y + 7), fill=(236, 230, 214), outline=(80, 70, 60))
    d.polygon([(x - 1, y + 3), (x + 3, y - 1), (x + 7, y + 3)], fill=(200, 70, 70), outline=(80, 40, 40))

out = img.resize((W * 4, H * 4), Image.NEAREST)
out.save(sys.argv[1])
