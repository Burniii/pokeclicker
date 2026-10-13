"""Adds the costume Pokémon of the Festival Archipelago to the game.

For every (pokemondb species slug, GO costume slug) of resources/festival-selection.json it
- reuses an existing form when the game already has that costume (EXISTING),
- otherwise adds a decimal form after the species' last form in PokemonList.ts with the base
  species' stats (and level evolutions inside a costume line), its name to PokemonNameType.ts,
  the German name to bundledPokemonDe and the original GO sprites (normal + shiny, 96x96).
Writes resources/festival-pokemon.json (stage -> game names) for FestivalData.

Usage: python3 tools/event/festival_pokemon.py [sprite_cache_dir]
"""
import io
import json
import os
import re
import subprocess
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
LIST = os.path.join(ROOT, 'src/modules/pokemons/PokemonList.ts')
NAMES = os.path.join(ROOT, 'src/modules/pokemons/PokemonNameType.ts')
DE = os.path.join(ROOT, 'src/modules/translation/bundled/de.ts')
DE_POKEMON = json.load(open(os.path.join(ROOT, 'src/translations/locales/de/pokemon.json')))
CACHE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '.sprite-cache')

COSTUMES = {  # GO costume slug: (English, German)
    'red-party-hat': ('Party Hat', 'Partyhut'), 'party-hat': ('Party Hat', 'Partyhut'),
    'sunglasses': ('Sunglasses', 'Sonnenbrille'), 'ribbon': ('Ribbon', 'Schleife'), 'bowler-hat': ('Bowler Hat', 'Melone'),
    'concierge': ('Concierge', 'Concierge'), 'scarf': ('Scarf', 'Schal'), 'studded-jacket': ('Studded Jacket', 'Nietenjacke'),
    'fashion': ('Fashion', 'Mode'), 'new-year-hat': ('New Year Hat', 'Neujahrshut'), 'beanie': ('Beanie', 'Mütze'),
    'holiday': ('Holiday', 'Festtag'), 'holiday-2025': ('Holiday', 'Festtag'), 'bells': ('Bells', 'Glöckchen'),
    'bow': ('Bow', 'Schleife'), 'day-scarf': ('Day Scarf', 'Tagesschal'), 'night-scarf': ('Night Scarf', 'Nachtschal'),
    'apex': ('Apex', 'Apex'), 'meloetta-hat': ('Meloetta Hat', 'Meloetta-Hut'), 'visor': ('Visor', 'Schirmmütze'),
    'litwick': ('Litwick Hat', 'Lichtel-Hut'), 'cempasuchil-crown': ('Cempasuchil Crown', 'Cempasúchil-Krone'),
    'lucas-hat': ('Lucas Hat', 'Lucius-Mütze'), 'halloween-mischief': ('Halloween', 'Halloween'), 'halloween': ('Halloween', 'Halloween'),
    'flower': ('Flower Crown', 'Blumenkranz'), 'cap': ('Cap', 'Kappe'), 'spark-bracelet': ('Spark Bracelet', 'Funkenarmband'),
    'explorer-hat': ('Explorer Hat', 'Entdeckerhut'), 'cape': ('Cape', 'Umhang'), 'summer': ('Summer', 'Sommer'),
    'kariyushi': ('Kariyushi', 'Kariyushi'), 'straw-hat': ('Straw Hat', 'Strohhut'), 'train': ('Train', 'Zug'),
    'world-champs-2022': ('Worlds 2022', 'WM 2022'), 'world-champs-2024': ('Worlds 2024', 'WM 2024'),
    'world-cap': ('World Cap', 'Weltkappe'), 'calem-hat': ('Calem Hat', 'Kalem-Hut'), 'likos-hat': ('Liko Hat', 'Liko-Hut'),
    'sun-crown': ('Sun Crown', 'Sonnenkrone'), 'moon-crown': ('Moon Crown', 'Mondkrone'),
    'amethyst-crown': ('Amethyst Crown', 'Amethyst-Krone'), 'aquamarine-crown': ('Aquamarine Crown', 'Aquamarin-Krone'),
    'malachite-crown': ('Malachite Crown', 'Malachit-Krone'), 'pyrite-crown': ('Pyrite Crown', 'Pyrit-Krone'),
    'quartz-crown': ('Quartz Crown', 'Quarz-Krone'), 'tcg': ('TCG', 'Sammelkarten'), 'witch': ('Witch', 'Hexe'),
    'spooky-festival': ('Spooky Festival', 'Gruselfest'), 'average-spooky-festival': ('Spooky Festival', 'Gruselfest'),
}
EXISTING = {('pikachu', 'detective'): 'Detective Pikachu', ('togepi', 'flower'): 'Togepi (Flowering Crown)',
            ('mewtwo', 'armored'): 'Armored Mewtwo'}
RENAME = {('pumpkaboo', 'average-spooky-festival'): 'Pumpkaboo (Spooky Festival)',
          ('gourgeist', 'average-spooky-festival'): 'Gourgeist (Spooky Festival)',
          ('togetic', 'flower'): 'Togetic (Flowering Crown)'}
BASE_NAME = {'ho-oh': 'Ho-Oh', 'pumpkaboo': 'Pumpkaboo (Average)', 'gourgeist': 'Gourgeist (Average)'}


def base_name(slug):
    return BASE_NAME.get(slug, slug.capitalize())


def german(name):
    t = DE_POKEMON.get(name, '')
    t = re.sub(r'\[\[([^\]]+)\]\]', lambda m: DE_POKEMON.get(m.group(1)) or m.group(1), t)
    return t or name


def sprite(slug, costume, shiny):
    path = os.path.join(CACHE, f"{'shiny' if shiny else 'normal'}-{slug}-{costume}.png")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        url = f"https://img.pokemondb.net/sprites/go/{'shiny' if shiny else 'normal'}/1x/{slug}-{costume}.png"
        data = subprocess.run(['curl', '-sSf', url], capture_output=True, check=True).stdout
        open(path, 'wb').write(data)
    im = Image.open(path).convert('RGBA')
    return im.resize((96, 96), Image.LANCZOS)


def main():
    sel = json.load(open(os.path.join(HERE, 'resources', 'festival-selection.json')))
    src = open(LIST).read()
    blocks = list(re.finditer(r"    \{\n        'id': ([\d.]+),\n        'name': '((?:[^'\\]|\\.)*)',.*?\n    \},\n", src, re.S))
    by_name = {m.group(2): m for m in blocks}
    names = open(NAMES).read()
    de = open(DE).read()
    plan = []          # (stage, slug, costume, new name or existing)
    for stage, (_, entries) in enumerate(sel, start=1):
        for slug, costume in entries:
            plan.append((stage, slug, costume))
    new_name = {}
    for stage, slug, costume in plan:
        if (slug, costume) in EXISTING:
            new_name[(slug, costume)] = EXISTING[(slug, costume)]
        else:
            new_name[(slug, costume)] = RENAME.get((slug, costume)) or f'{base_name(slug)} ({COSTUMES[costume][0]})'
    # costume lines: base evolutions whose target has the same costume in the selection
    by_base = {base_name(s): (s, c) for _, s, c in plan}
    inserts = {}       # index of base block end -> list of entry texts
    added = []
    next_id = {}
    for m in blocks:
        base = int(float(m.group(1)))
        next_id[base] = max(next_id.get(base, 0), round((float(m.group(1)) - base) * 100))
    for stage, slug, costume in plan:
        name = new_name[(slug, costume)]
        if (slug, costume) in EXISTING or name in by_name:
            continue
        bm = by_name[base_name(slug)]
        base = int(float(bm.group(1)))
        next_id[base] += 1
        new_id = f'{base}.{next_id[base]:02d}'
        text = bm.group(0)
        text = text.replace(f"'id': {bm.group(1)},", f"'id': {new_id},", 1)
        text = text.replace(f"'name': '{bm.group(2)}',", f"'name': '{name}',", 1)
        # evolutions: keep only level evolutions to a costume form of the same costume line
        evo = re.search(r"        'evolutions': \[(.*?)\],\n", text, re.S)
        if evo:
            keep = []
            for lv in re.finditer(r"LevelEvolution\('((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', (\d+)\)", evo.group(1)):
                tgt = lv.group(2)
                if tgt in by_base and by_base[tgt][1] == costume:
                    keep.append(f"LevelEvolution('{name}', '{new_name[by_base[tgt]]}', {lv.group(3)})")
            text = text.replace(evo.group(0), f"        'evolutions': [{', '.join(keep)}],\n" if keep else '')
        text = re.sub(r"        'heldItem': .*?\n", '', text)
        text = re.sub(r"        'gender': \{.*?\n        \},\n", '', text, flags=re.S)
        # last block of this species
        last = max((b for b in blocks if int(float(b.group(1))) == base), key=lambda b: b.end())
        inserts.setdefault(last.end(), []).append(text)
        added.append((new_id, name, slug, costume, base_name(slug)))
    out, pos = [], 0
    for end in sorted(inserts):
        out.append(src[pos:end])
        out.extend(inserts[end])
        pos = end
    out.append(src[pos:])
    open(LIST, 'w').write(''.join(out))
    # name type: after the base name's last form line
    for new_id, name, slug, costume, bname in added:
        lines = names.split('\n')
        idx = max(i for i, l in enumerate(lines) if re.match(rf"\s*\| '{re.escape(bname)}'$", l) or
                  re.match(rf"\s*\| '.*{re.escape(bname.split(' (')[0])}.*'$", l))
        lines.insert(idx + 1, f"    | '{name}'")
        names = '\n'.join(lines)
    open(NAMES, 'w').write(names)
    # German names
    entries = ''.join(f"    '{n}': '{german(b)} ({COSTUMES[c][1]})',\n" for _, n, s, c, b in added)
    de = de.replace("    'Dragonite (Postman)': 'Postbote-Dragoran',\n", "    'Dragonite (Postman)': 'Postbote-Dragoran',\n" + entries, 1)
    open(DE, 'w').write(de)
    # sprites
    for new_id, name, slug, costume, bname in added:
        sprite(slug, costume, False).save(os.path.join(ROOT, f'src/assets/images/pokemon/{new_id}.png'), optimize=True)
        sprite(slug, costume, True).save(os.path.join(ROOT, f'src/assets/images/shinypokemon/{new_id}.png'), optimize=True)
    stages = [[new_name[(s, c)] for s, c in entries] for _, entries in sel]
    json.dump(stages, open(os.path.join(HERE, 'resources', 'festival-pokemon.json'), 'w'), indent=1)
    print(len(added), 'added,', sum(len(s) for s in stages), 'in total')


if __name__ == '__main__':
    main()
