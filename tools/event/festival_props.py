"""Pixel-art festival props for the Festival Archipelago map, drawn in the style of the GBA town maps:
1px dark outline, flat colours with a light and a dark shade, light from the top left.
Every function returns an RGBA image; sizes are multiples of the 16px map tiles where it matters."""
import math

from PIL import Image, ImageDraw

OUT = (40, 32, 48, 255)


def shades(rgb):
    """(dark, base, light) of a colour."""
    r, g, b = rgb
    dark = (int(r * 0.68), int(g * 0.68), int(b * 0.72), 255)
    light = (min(255, int(r + (255 - r) * 0.45)), min(255, int(g + (255 - g) * 0.45)), min(255, int(b + (255 - b) * 0.45)), 255)
    return dark, (r, g, b, 255), light


RED = (220, 56, 64)
PINK = (240, 120, 168)
BLUE = (64, 112, 216)
SKY = (96, 176, 232)
GREEN = (72, 176, 88)
YELLOW = (248, 200, 56)
ORANGE = (240, 136, 48)
PURPLE = (144, 88, 200)
WHITE = (244, 244, 236)
TEAL = (56, 176, 168)
BROWN = (152, 96, 56)
GREY = (168, 168, 176)


def outline(im, color=OUT):
    """1px outline around all opaque pixels (outside)."""
    w, h = im.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(im, (1, 1))
    src = out.copy().load()
    px = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = color
    return out


def shadow(im, offset=3):
    """Soft drop shadow on the ground (the town maps use dark green/grey shadows below objects)."""
    w, h = im.size
    out = Image.new('RGBA', (w + offset, h + offset), (0, 0, 0, 0))
    a = im.getchannel('A').point(lambda v: 70 if v else 0)
    sh = Image.new('RGBA', im.size, (20, 40, 30, 255))
    sh.putalpha(a)
    out.alpha_composite(sh, (offset, offset))
    out.alpha_composite(im, (0, 0))
    return out


def stall(color, w=30, h=28):
    """Market stall with a striped awning, counter and goods (like the stalls in the anime festival)."""
    dark, base, light = shades(color)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # posts
    d.rectangle((2, 10, 3, h - 2), fill=(120, 80, 48, 255))
    d.rectangle((w - 4, 10, w - 3, h - 2), fill=(120, 80, 48, 255))
    # counter with goods
    d.rectangle((1, h - 11, w - 2, h - 2), fill=(232, 216, 176, 255))
    d.rectangle((1, h - 4, w - 2, h - 2), fill=(200, 176, 128, 255))
    for i, c in enumerate((RED, YELLOW, GREEN, BLUE, ORANGE, PINK)):
        x = 4 + i * ((w - 8) // 6)
        d.rectangle((x, h - 14, x + 2, h - 11), fill=shades(c)[1])
    # striped awning with scalloped edge
    for x in range(w):
        col = base if (x // 4) % 2 == 0 else (WHITE + (255,))
        d.line((x, 2, x, 10), fill=col)
    d.line((0, 2, w - 1, 2), fill=light)
    for x in range(0, w, 4):
        d.pieslice((x - 1, 7, x + 3, 13), 0, 180, fill=base if (x // 4) % 2 == 0 else (WHITE + (255,)))
    d.line((0, 10, w - 1, 10), fill=dark)
    return shadow(outline(im))


def big_tent(color, w=52, h=46):
    """Circus big top with stripes, a flag on the pole and an open entrance (Jirachi festival)."""
    dark, base, light = shades(color)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    cx = w // 2
    wall_top = h // 2
    # cone roof with stripes
    for y in range(8, wall_top + 1):
        half = min(w // 2 - 1, int((y - 8) / (wall_top - 8) * (w // 2 - 2)) + 1)
        for x in range(cx - half, cx + half + 1):
            stripe = int(math.atan2(x - cx, y - 4) * 7) % 2 == 0
            col = base if stripe else (WHITE + (255,))
            if x > cx + half * 0.4:
                col = dark if stripe else (210, 210, 205, 255)
            im.putpixel((x, y), col)
    # walls
    d.rectangle((3, wall_top, w - 4, h - 2), fill=WHITE + (255,))
    for x in range(3, w - 3, 6):
        d.rectangle((x, wall_top, x + 2, h - 2), fill=base)
    d.rectangle((w - 12, wall_top, w - 4, h - 2), fill=(0, 0, 0, 0))
    d.rectangle((w - 12, wall_top, w - 4, h - 2), fill=dark)
    # scalloped trim
    for x in range(2, w - 3, 5):
        d.pieslice((x, wall_top - 3, x + 5, wall_top + 3), 0, 180, fill=YELLOW + (255,))
    # entrance
    d.polygon([(cx - 6, h - 2), (cx, wall_top + 6), (cx + 6, h - 2)], fill=(64, 40, 56, 255))
    # pole and flag
    d.line((cx, 0, cx, 9), fill=(90, 80, 70, 255))
    d.polygon([(cx + 1, 0), (cx + 8, 2), (cx + 1, 4)], fill=YELLOW + (255,))
    d.line((cx - half_safe(w), wall_top, cx, 8), fill=light)
    return shadow(outline(im), 4)


def half_safe(w):
    return w // 2 - 2


def ferris_wheel(size=96):
    """Ferris wheel with coloured gondolas on an A-frame (Nimbasa City / festival)."""
    im = Image.new('RGBA', (size, size + 14), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size // 2
    r = size // 2 - 6
    # supports
    d.polygon([(c - 3, c), (c - 22, size + 12), (c - 16, size + 12)], fill=(120, 128, 144, 255))
    d.polygon([(c + 3, c), (c + 22, size + 12), (c + 16, size + 12)], fill=(96, 104, 120, 255))
    d.rectangle((c - 26, size + 10, c + 26, size + 13), fill=(110, 110, 120, 255))
    # rim and spokes
    for k in range(16):
        a = k * math.pi / 8
        d.line((c, c, c + r * math.cos(a), c + r * math.sin(a)), fill=(200, 208, 224, 255))
    d.ellipse((c - r, c - r, c + r, c + r), outline=(232, 72, 96, 255), width=3)
    d.ellipse((c - r + 8, c - r + 8, c + r - 8, c + r - 8), outline=(248, 200, 56, 255), width=1)
    d.ellipse((c - 5, c - 5, c + 5, c + 5), fill=(248, 200, 56, 255))
    # gondolas
    cols = (RED, BLUE, YELLOW, GREEN, PINK, SKY, ORANGE, PURPLE)
    for k in range(8):
        a = k * math.pi / 4 + 0.2
        x, y = c + r * math.cos(a), c + r * math.sin(a)
        dark, base, light = shades(cols[k])
        d.rectangle((x - 5, y - 1, x + 5, y + 8), fill=base)
        d.rectangle((x - 5, y - 1, x + 5, y + 1), fill=light)
        d.rectangle((x - 3, y + 2, x + 3, y + 4), fill=(200, 232, 248, 255))
    return shadow(outline(im), 4)


def stage(w=72, h=40):
    """Round white stage with steps (festival plaza in the anime)."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 8, w - 1, h - 1), fill=(176, 176, 192, 255))
    d.ellipse((0, 4, w - 1, h - 6), fill=(212, 212, 224, 255))
    d.ellipse((0, 0, w - 1, h - 10), fill=(248, 248, 252, 255))
    d.ellipse((8, 4, w - 9, h - 14), outline=(224, 224, 236, 255))
    # steps at the front
    d.rectangle((w // 2 - 9, h - 10, w // 2 + 9, h - 7), fill=(232, 232, 240, 255))
    d.rectangle((w // 2 - 11, h - 6, w // 2 + 11, h - 2), fill=(200, 200, 216, 255))
    return shadow(outline(im), 3)


def screen(w=34, h=34):
    """Big video screen on a stand."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((w // 2 - 2, h - 12, w // 2 + 2, h - 1), fill=(96, 96, 112, 255))
    d.rectangle((0, 0, w - 1, h - 12), fill=(48, 48, 64, 255))
    d.rectangle((2, 2, w - 3, h - 14), fill=(96, 168, 232, 255))
    d.ellipse((w // 2 - 7, 5, w // 2 + 7, h - 17), fill=(248, 216, 64, 255))  # a yellow star-ish shine (Jirachi)
    d.line((3, 3, 10, 3), fill=(200, 232, 255, 255))
    return shadow(outline(im), 3)


def balloon_bunch():
    im = Image.new('RGBA', (16, 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for (x, y, c) in ((2, 2, RED), (8, 0, YELLOW), (6, 7, BLUE), (0, 9, PINK), (10, 8, GREEN)):
        dark, base, light = shades(c)
        d.ellipse((x, y, x + 5, y + 6), fill=base)
        d.point((x + 1, y + 1), fill=light)
    d.line((5, 14, 7, 25), fill=(80, 80, 80, 255))
    d.line((9, 14, 7, 25), fill=(80, 80, 80, 255))
    return outline(im)


def bunting(img, points, colors=(PINK, BLUE, YELLOW, GREEN)):
    """Line of small triangle flags between points (drawn directly onto the map)."""
    d = ImageDraw.Draw(img)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) // 7))
        prev = (x0, y0)
        for i in range(1, n + 1):
            t = i / n
            sag = math.sin(t * math.pi) * 6
            p = (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + sag)
            d.line((prev, p), fill=(70, 60, 70, 255))
            if i < n:
                c = shades(colors[i % len(colors)])[1]
                d.polygon([(p[0] - 2, p[1]), (p[0] + 3, p[1]), (p[0] + 0.5, p[1] + 5)], fill=c, outline=(70, 50, 60, 255))
            prev = p


def lantern_string(img, points):
    """Johto style red paper lanterns on a string."""
    d = ImageDraw.Draw(img)
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) // 10))
        prev = (x0, y0)
        for i in range(1, n + 1):
            t = i / n
            p = (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + math.sin(t * math.pi) * 5)
            d.line((prev, p), fill=(70, 50, 40, 255))
            if i < n:
                d.ellipse((p[0] - 2, p[1], p[0] + 3, p[1] + 6), fill=(232, 64, 48, 255), outline=(110, 30, 30, 255))
                d.point((p[0], p[1] + 2), fill=(255, 200, 120, 255))
            prev = p


def parasol(color):
    dark, base, light = shades(color)
    im = Image.new('RGBA', (22, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line((11, 6, 11, 21), fill=(230, 230, 230, 255))
    d.pieslice((0, 0, 21, 14), 180, 360, fill=base)
    for k in (4, 11, 17):
        d.line((11, 0, k, 7), fill=WHITE + (255,))
    d.arc((0, 0, 21, 14), 180, 260, fill=light)
    d.rectangle((15, 17, 21, 19), fill=(248, 248, 240, 255))  # towel
    return outline(im)


def pumpkin(size=14):
    im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 3, size - 1, size - 1), fill=(240, 128, 32, 255))
    d.ellipse((size // 2 - 2, 3, size // 2 + 2, size - 1), fill=(208, 96, 24, 255))
    d.rectangle((size // 2 - 1, 0, size // 2, 3), fill=(80, 120, 40, 255))
    d.polygon([(3, 7), (5, 7), (4, 9)], fill=(250, 220, 90, 255))
    d.polygon([(size - 6, 7), (size - 4, 7), (size - 5, 9)], fill=(250, 220, 90, 255))
    d.line((4, size - 4, size - 5, size - 4), fill=(250, 220, 90, 255))
    return outline(im)


def roller_coaster(w=120, h=56):
    """Red coaster track with white supports and a little train."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    pts = [(x, int(h * 0.55 - math.sin(x / w * math.pi * 2.2) * h * 0.38 - (x / w) * 4)) for x in range(0, w, 2)]
    for x, y in pts[::5]:
        d.line((x, y + 2, x, h - 2), fill=(232, 232, 240, 255), width=1)
    d.line(pts, fill=(216, 48, 56, 255), width=3)
    d.line([(x, y - 1) for x, y in pts], fill=(255, 128, 128, 255), width=1)
    for i, c in enumerate((YELLOW, BLUE, YELLOW)):
        x, y = pts[8 + i * 3]
        d.rectangle((x - 2, y - 6, x + 3, y - 2), fill=shades(c)[1])
    return shadow(outline(im), 3)


def blimp():
    """Festival blimp with a star (Jirachi) - floats over the sea."""
    im = Image.new('RGBA', (60, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, 52, 20), fill=(232, 208, 176, 255))
    d.ellipse((4, 2, 40, 10), fill=(248, 236, 216, 255))
    d.polygon([(48, 8), (59, 1), (59, 19), (48, 12)], fill=(200, 80, 72, 255))
    d.rectangle((18, 20, 32, 25), fill=(120, 96, 80, 255))
    d.polygon([(24, 6), (26, 10), (30, 10), (27, 13), (28, 17), (24, 14), (20, 17), (21, 13), (18, 10), (22, 10)], fill=(248, 216, 64, 255))
    return outline(im)


def star_balloon():
    im = Image.new('RGBA', (16, 28), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(8, 0), (10, 5), (15, 5), (11, 9), (13, 14), (8, 11), (3, 14), (5, 9), (1, 5), (6, 5)], fill=(248, 216, 64, 255))
    d.line((8, 13, 8, 27), fill=(90, 90, 90, 255))
    return outline(im)


def lamp_post():
    im = Image.new('RGBA', (8, 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((3, 6, 4, 25), fill=(72, 80, 96, 255))
    d.ellipse((0, 0, 7, 7), fill=(255, 236, 160, 255))
    d.point((2, 2), fill=(255, 255, 240, 255))
    return outline(im)


def pink_paving(size=16, seed=0):
    """Pinkish cobblestone of the festival plaza (anime, second reference image)."""
    im = Image.new('RGBA', (size, size), (222, 158, 158, 255))
    px = im.load()
    for y in range(size):
        for x in range(size):
            row = y // 4
            off = 4 if row % 2 else 0
            if y % 4 == 3 or (x + off) % 8 == 7:
                px[x, y] = (194, 124, 130, 255)
            elif y % 4 == 0 and (x + off) % 8 < 3:
                px[x, y] = (238, 186, 180, 255)
    return im


def stage_ring(w=104, h=60):
    """Light circle of paving under the stage."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 0, w - 1, h - 1), fill=(240, 212, 196, 255), outline=(194, 124, 130, 255), width=2)
    d.ellipse((6, 4, w - 7, h - 5), outline=(226, 176, 170, 255), width=1)
    return im


def stage_emblem(img, cx, cy):
    """Yellow wish star (Jirachi) painted on the stage."""
    d = ImageDraw.Draw(img)
    pts = []
    for k in range(10):
        r = 9 if k % 2 == 0 else 4
        a = -math.pi / 2 + k * math.pi / 5
        pts.append((cx + r * math.cos(a) * 1.3, cy + r * math.sin(a) * 0.75))
    d.polygon(pts, fill=(248, 208, 72, 255), outline=(200, 144, 40, 255))


def firework(color, r=12):
    """Small firework burst for the night sky over the sea."""
    im = Image.new('RGBA', (2 * r + 3, 2 * r + 3), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = r + 1
    dark, base, light = shades(color)
    for k in range(12):
        a = k * math.pi / 6
        d.line((c + math.cos(a) * 3, c + math.sin(a) * 3, c + math.cos(a) * r, c + math.sin(a) * r), fill=base)
        d.point((c + math.cos(a) * (r + 1), c + math.sin(a) * (r + 1)), fill=light)
    d.ellipse((c - 1, c - 1, c + 1, c + 1), fill=(255, 255, 255, 255))
    return im


def pole(h=14, color=(120, 88, 56)):
    """Thin wooden pole that holds bunting or lantern strings."""
    im = Image.new('RGBA', (4, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((1, 2, 2, h - 1), fill=color + (255,))
    d.rectangle((0, 0, 3, 2), fill=(248, 200, 56, 255))
    return outline(im)


def torii(w=44, h=40):
    """Red shrine gate for the Johto lantern festival."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    red, dark = (220, 56, 48, 255), (160, 32, 32, 255)
    d.rectangle((0, 3, w - 1, 7), fill=(56, 48, 56, 255))
    d.polygon([(0, 3), (4, 0), (w - 5, 0), (w - 1, 3)], fill=(56, 48, 56, 255))
    d.rectangle((3, 8, w - 4, 11), fill=red)
    d.rectangle((3, 15, w - 4, 17), fill=red)
    d.rectangle((8, 8, 12, h - 1), fill=red)
    d.rectangle((w - 13, 8, w - 9, h - 1), fill=red)
    d.rectangle((11, 8, 12, h - 1), fill=dark)
    d.rectangle((w - 10, 8, w - 9, h - 1), fill=dark)
    d.rectangle((w // 2 - 3, 11, w // 2 + 2, 15), fill=(248, 216, 120, 255))
    return shadow(outline(im), 3)


def flag_pole(color):
    """Tall pennant flag at a plaza entrance."""
    im = Image.new('RGBA', (16, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((2, 2, 3, 33), fill=(200, 200, 210, 255))
    dark, base, light = shades(color)
    d.polygon([(4, 3), (15, 7), (4, 12)], fill=base)
    d.line((4, 4, 12, 7), fill=light)
    return outline(im)


def fountain(w=40, h=30):
    """Round festival fountain."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((0, 6, w - 1, h - 1), fill=(200, 200, 216, 255))
    d.ellipse((3, 8, w - 4, h - 5), fill=(96, 176, 232, 255))
    d.ellipse((7, 11, w - 8, h - 8), fill=(136, 200, 240, 255))
    d.rectangle((w // 2 - 2, 2, w // 2 + 1, 16), fill=(220, 220, 232, 255))
    d.ellipse((w // 2 - 6, 0, w // 2 + 5, 6), fill=(200, 232, 248, 255))
    for k in (-8, 8):
        d.point((w // 2 + k, 12), fill=(255, 255, 255, 255))
    return shadow(outline(im), 2)


def lights_ring(w=128, h=76):
    """Elliptic string of coloured festival lights (for the ground around the stage)."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((2, 2, w - 3, h - 3), outline=(90, 70, 80, 255))
    cols = [YELLOW, PINK, SKY, GREEN, ORANGE, PURPLE]
    n = 28
    for k in range(n):
        a = k / n * 2 * math.pi
        x, y = w / 2 + (w / 2 - 3) * math.cos(a), h / 2 + (h / 2 - 3) * math.sin(a)
        dark, base, light = shades(cols[k % len(cols)])
        d.ellipse((x - 2, y - 1, x + 2, y + 3), fill=base, outline=(70, 50, 60, 255))
        d.point((x - 1, y), fill=(255, 255, 255, 255))
    return im


def gangway(w=10, h=14):
    """Short boarding ramp between a pier and a ship."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, w - 1, h - 1), fill=(200, 172, 108, 255))
    for y in range(1, h, 3):
        d.line((1, y, w - 2, y), fill=(150, 112, 70, 255))
    d.line((0, 0, 0, h - 1), fill=(240, 240, 248, 255))
    d.line((w - 1, 0, w - 1, h - 1), fill=(240, 240, 248, 255))
    return outline(im)


def cave_mouth(w=24, h=20):
    """Dark cave entrance for a rock face, with a rocky frame and a lighter threshold."""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.pieslice((0, 0, w - 1, 2 * h - 4), 180, 360, fill=(150, 112, 104, 255))
    d.rectangle((0, h - 3, w - 1, h - 1), fill=(150, 112, 104, 255))
    d.pieslice((4, 4, w - 5, 2 * h - 2), 180, 360, fill=(40, 28, 36, 255))
    d.rectangle((4, h - 3, w - 5, h - 1), fill=(40, 28, 36, 255))
    for x, y in ((2, h // 2), (w - 4, h // 2 - 2), (w // 2, 1), (5, 4), (w - 7, 4)):
        d.point((x, y), fill=(200, 168, 152, 255))
    d.line((6, h - 2, w - 7, h - 2), fill=(90, 70, 70, 255))
    return outline(im)


def canopy_stall(color, w=30, h=30):
    """Round-topped food stall with a scalloped canopy (variation of stall())."""
    dark, base, light = shades(color)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle((3, 14, w - 4, h - 2), fill=(236, 220, 184, 255))
    d.rectangle((3, h - 7, w - 4, h - 2), fill=(200, 160, 112, 255))
    for x in range(5, w - 6, 5):
        d.rectangle((x, 16, x + 2, 19), fill=(248, 176, 64, 255))
    d.chord((0, 0, w - 1, 22), 180, 360, fill=base)
    d.rectangle((0, 10, w - 1, 13), fill=base)
    for x in range(0, w, 6):
        d.pieslice((x, 10, x + 6, 16), 0, 180, fill=light)
    d.line((w // 2, 0, w // 2, 10), fill=light)
    d.line((w // 4, 3, w // 4, 10), fill=dark)
    d.line((3 * w // 4, 3, 3 * w // 4, 10), fill=dark)
    return shadow(outline(im))
