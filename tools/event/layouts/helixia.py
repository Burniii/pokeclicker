"""Layout of the Fusion region Helixia (Fusion world) for festival_map.py (each section runs inside the renderer).

Map areas of FusionData (in tiles): Fusion lab t1 (14,26,6,5), Fusion paths f1 (16,36,20,3), f2 (36,36,10,3),
f3 (48,36,13,3), f4 (61,17,3,19), Helix City t2 (55,13,13,4), Mysterious Cave f5 (82,12,4,4)."""
# flake8: noqa
# @section islands
ISLANDS = {
    'lab': (4, 18, 36, 49),       # Bill's Fusion lab and Fusion path 1
    'main': (46, 5, 76, 51),      # Fusion paths 3 and 4, Helix City
    'cave': (77, 3, 95, 22),      # Mysterious Cave
}
SHAPES = {'cave': (2.6, 4)}
NO_TALL_GRASS = ()
# @section lobes
LOBES = {
    'lab': [(10, 15, 20, 20), (4, 40, 14, 50)],
    'main': [(66, 40, 78, 49), (44, 20, 50, 30)],
    'cave': [],
}
# @section paths
PATHS = [
    (16, 31, 19, 36), (16, 36, 36, 39),       # lab door and Fusion path 1
    (46, 36, 64, 39), (61, 17, 64, 39),       # Fusion paths 3 and 4
    (64, 16, 72, 18), (77, 16, 88, 18),       # Helix City to the cave islet
    (53, 30, 55, 36), (68, 31, 70, 36), (64, 34, 70, 36),       # houses south of Helix City
]
for p in PATHS:
    area(*p, PATH)
STONES = [
    (52, 13, 72, 17),     # Helix City square
    (6, 31, 23, 33),      # forecourt of the lab and the research station
    (54, 18, 61, 24),     # fountain square next to Fusion path 4
]
for s in STONES:
    area(*s, STONE, (GRASS, PATH))
FESTIVAL = (0, 0, 0, 0)
# @section bridges
BRIDGES = [
    ('h', 37, 34, 48),    # Fusion path 2 (boardwalk over the sea)
    ('h', 16, 70, 79),    # Helix City to the Mysterious Cave
]
# @section beaches
BEACHES = [(3, 40, 15, 51), (52, 46, 68, 52), (88, 3, 96, 10)]
# @section objects
# --- Fusion lab island -------------------------------------------------------------------------
put(SP['fusion_lab'], 17.5, 31)
put(SP['station'], 9, 30.6)
put(SP['planter_tall'], 12, 31)
put(SP['planter_tall'], 23, 31)
for cx, by in ((14.6, 35), (20.4, 35), (24, 38.4), (32, 38.4)):
    put(fp.lamp_post(), cx, by)
put(SP['house_blue'], 27.5, 35.6)

# --- Helix City ----------------------------------------------------------------------------------
put(SP['pc'], 55.5, 13)
put(SP['mart'], 60.2, 13)
put(SP['helix_gym'], 67.6, 13)
put(SP['planter_tall'], 63.4, 13)
for cx, by in ((52.6, 16.8), (71.4, 16.8)):
    put(fp.lamp_post(), cx, by)
put(SP['fountain0'], 57.5, 23.4)
put(SP['house_green'], 54, 30)
put(SP['house_orange'], 69, 30.6)

# --- raised plateaus (Magiscarf's hill piece as a 9-slice); the Mysterious Cave is in the islet's face
CLIFFS = [
    ((79, 9, 90, 16), 84.0),      # Mysterious Cave
    ((47, 41, 55, 46), None),     # hill south of Fusion path 3
    ((5, 21, 11, 25), None),      # hill above the lab
]
for (x0, y0, x1, y1), cave in CLIFFS:
    pl = ma.plateau((x1 - x0) * T, (y1 - y0) * T)
    if cave is not None:
        ce = ma.cave_entrance()
        pl.alpha_composite(ce, (int((cave - x0) * T - ce.width / 2), pl.height - ce.height - 1))
    put(pl, (x0 + x1) / 2, y1)
for name, cx, by in (('tree_pine', 80.8, 13.6), ('tree_pine3', 88.4, 13.4), ('fern', 83.5, 11.6), ('fern', 85.5, 11.6),
                     ('rock', 86.5, 11.8), ('tree_teal0', 49.4, 44.2), ('fern', 52.5, 43.6), ('round_teal0', 7.8, 23.8)):
    put(SP[name], cx, by, reserve=False, layer=6 * T)

# --- sea decoration ------------------------------------------------------------------------------
for cx, by in ((40, 20), (42.5, 22), (97, 30), (96, 46), (24, 12), (88, 52), (2, 10), (38, 54)):
    if dist[int(by) - 1, int(cx)] >= 2:
        put(SP['rock'], cx, by, reserve=False)
put(SP['sailboat'], 40, 46, reserve=False)
put(SP['sailboat'], 84, 30, reserve=False)
# @section flora
FLORA = {
    'lab': ['tree_teal0', 'tree_teal1', 'round_teal0', 'tree_pine'],
    'main': ['tree_green0', 'tree_pine', 'tree_pine2', 'round_green0', 'tree_teal1'],
    'cave': ['tree_pine', 'tree_pine3', 'tree_conifer_big'],
}
# @section groves
GROVES = [
    ('lab', (24, 19, 35, 28), ['tree_pine', 'tree_teal0', 'tree_pine2']),
    ('main', (65, 19, 75, 28), ['tree_pine', 'tree_pine3']),
    ('main', (47, 6, 52, 12), ['tree_teal0', 'round_teal0']),
]
