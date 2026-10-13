# Sprite tools (development only)

Helpers to draft event sprite variants with a free AI service and turn them into game sprites.
Nothing in this folder is part of the game build.

- `horde.py` – client for the free AI Horde API (anonymous by default, set `AI_HORDE_KEY` for a registered key).
  `generate(prompt, source=None, models=[...], n=4, strength=0.55)` returns PIL images; with `source` it runs img2img.
- `postprocess.py` – background removal, pixelation to sprite size, 1px outline, compositing accessories onto a
  base sprite, shiny recolouring from the official shiny sprite, palette matching of AI redraws, preview sheets.

- `hfspace.py` – plain-HTTP client for Gradio apps on Hugging Face Spaces (free ZeroGPU quota of the account in `HF_TOKEN`).
  Best results so far: `black-forest-labs/FLUX.1-Kontext-Dev`, endpoint `/infer` with `input_image` + an edit instruction.

Recommended workflow (instruction editing, keeps the Pokémon identical):
1. Upscale the sprite with nearest neighbour onto white (e.g. 768 px) and send it to FLUX Kontext with an instruction
   like "add a blue mail carrier cap ... keep the Pokémon exactly the same, same pixel art style".
2. `from_edit(base, edited)` → back to 96×96; unchanged pixels get the exact original colours.
3. `shiny_for_edit(base, shiny_base, sprite)` → shiny version (only original pixels are recoloured).

Older workflow:
1. Accessories (hats, scarves, …): generate only the accessory (`horde.generate` without `source`), then
   `remove_background` → `pixelate` → `add_outline` → `compose` onto the original sprite and `shiny_from` for the shiny.
2. Expression or pose tweaks: img2img of the cropped base sprite with an SDXL model, then `redraw_like(base, draft)`.
