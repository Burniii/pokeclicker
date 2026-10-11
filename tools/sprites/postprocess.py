"""Turns AI drafts into PokéClicker-style sprites: background removal, pixelation, palette, outline, compositing."""
from collections import deque

from PIL import Image

OUTLINE = (16, 16, 16, 255)


def remove_background(img: Image.Image, tolerance=40) -> Image.Image:
    """Flood fills from the borders and makes every pixel close to the border colour transparent."""
    img = img.convert('RGBA')
    w, h = img.size
    px = img.load()
    seen = [[False] * w for _ in range(h)]
    queue = deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    ref = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]

    def close(c):
        return any(sum(abs(c[i] - r[i]) for i in range(3)) <= tolerance for r in ref)

    while queue:
        x, y = queue.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y][x]:
            continue
        seen[y][x] = True
        if not close(px[x, y]):
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return img


def pixelate(img: Image.Image, width: int, colors=12) -> Image.Image:
    """Shrinks a (large, background-free) drawing to sprite size with hard pixels and a small palette."""
    img = img.crop(img.getbbox())
    height = max(1, round(img.height * width / img.width))
    small = img.resize((width, height), Image.BOX)
    alpha = small.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    rgb = small.convert('RGB').quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    out = rgb.convert('RGBA')
    out.putalpha(alpha)
    return out


def add_outline(img: Image.Image, color=OUTLINE) -> Image.Image:
    """Adds a 1px dark outline around opaque pixels (the sprite style of the game)."""
    w, h = img.size
    out = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0))
    out.paste(img, (1, 1))
    src = out.copy().load()
    px = out.load()
    for y in range(h + 2):
        for x in range(w + 2):
            if src[x, y][3]:
                continue
            if any(0 <= x + dx < w + 2 and 0 <= y + dy < h + 2 and src[x + dx, y + dy][3]
                   for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = color
    return out


def compose(base: Image.Image, accessory: Image.Image, x: int, y: int, rotate=0, flip=False) -> Image.Image:
    """Places an accessory (top-left at x, y) onto the base sprite; result keeps the base size."""
    acc = accessory.transpose(Image.FLIP_LEFT_RIGHT) if flip else accessory
    if rotate:
        acc = acc.rotate(rotate, resample=Image.NEAREST, expand=True)
    out = base.convert('RGBA').copy()
    layer = Image.new('RGBA', out.size, (0, 0, 0, 0))
    layer.paste(acc, (x, y), acc)
    out.alpha_composite(layer)
    return out


def shiny_from(normal_base: Image.Image, shiny_base: Image.Image, variant: Image.Image) -> Image.Image:
    """Recolours a variant with the base's shiny palette: every colour that maps normal -> shiny is swapped."""
    mapping = {}
    nb, sb = normal_base.convert('RGBA').load(), shiny_base.convert('RGBA').load()
    w, h = normal_base.size
    for yy in range(h):
        for xx in range(w):
            a, b = nb[xx, yy], sb[xx, yy]
            if a[3] and a != b:
                mapping.setdefault(a, b)
    out = variant.convert('RGBA').copy()
    px = out.load()
    for yy in range(out.height):
        for xx in range(out.width):
            if px[xx, yy] in mapping:
                px[xx, yy] = mapping[px[xx, yy]]
    return out


def sheet(images, scale=3, bg=(255, 255, 255, 255)) -> Image.Image:
    """Side-by-side preview, pixel-perfect upscaled."""
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    out = Image.new('RGBA', (w * scale * len(images) + 8 * (len(images) - 1), h * scale), bg)
    for n, img in enumerate(images):
        big = img.convert('RGBA').resize((img.width * scale, img.height * scale), Image.NEAREST)
        out.alpha_composite(big, (n * (w * scale + 8), 0))
    return out


def palette_of(img: Image.Image):
    return sorted({c for c in img.convert('RGBA').getdata() if c[3]})


def match_palette(img: Image.Image, palette) -> Image.Image:
    """Maps every opaque pixel to the nearest colour of the given palette (keeps the original look)."""
    out = img.convert('RGBA').copy()
    px = out.load()
    cache = {}
    for y in range(out.height):
        for x in range(out.width):
            c = px[x, y]
            if not c[3]:
                continue
            if c not in cache:
                cache[c] = min(palette, key=lambda p: sum((p[i] - c[i]) ** 2 for i in range(3)))
            px[x, y] = cache[c]
    return out


def redraw_like(base: Image.Image, draft: Image.Image) -> Image.Image:
    """Turns an AI redraw of the base sprite back into a sprite: same size, position and palette as the base."""
    box = base.getbbox()
    fig = remove_background(draft)
    fig = fig.crop(fig.getbbox())
    w, h = box[2] - box[0], box[3] - box[1]
    scale = min(w / fig.width, h / fig.height)
    size = (max(1, round(fig.width * scale)), max(1, round(fig.height * scale)))
    small = fig.resize(size, Image.BOX)
    small.putalpha(small.getchannel('A').point(lambda a: 255 if a >= 128 else 0))
    small = match_palette(small, palette_of(base))
    out = Image.new('RGBA', base.size, (0, 0, 0, 0))
    out.alpha_composite(small, (box[0] + (w - size[0]) // 2, box[3] - size[1]))
    return out
