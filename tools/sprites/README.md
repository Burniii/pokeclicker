# Sprite tools (development only)

Helpers to draft event sprite variants with a free AI service and turn them into game sprites.
Nothing in this folder is part of the game build.

- `horde.py` – client for the free AI Horde API (anonymous by default, set `AI_HORDE_KEY` for a registered key).
  `generate(prompt, source=None, models=[...], n=4, strength=0.55)` returns PIL images; with `source` it runs img2img.
- `postprocess.py` – background removal, pixelation to sprite size, 1px outline, compositing accessories onto a
  base sprite, shiny recolouring from the official shiny sprite, palette matching of AI redraws, preview sheets.

Recommended workflow:
1. Accessories (hats, scarves, …): generate only the accessory (`horde.generate` without `source`), then
   `remove_background` → `pixelate` → `add_outline` → `compose` onto the original sprite and `shiny_from` for the shiny.
2. Expression or pose tweaks: img2img of the cropped base sprite with an SDXL model, then `redraw_like(base, draft)`.
