"""Layout of the Festival Archipelago for festival_map.py (each section runs inside the renderer)."""
# flake8: noqa
# @section islands
ISLANDS = {
    'plaza': (32, 15, 68, 42),
    's1': (2, 22, 22, 40),     # Kanto: party
    's2': (2, 1, 22, 19),      # Johto: lantern festival with the bell tower
    's3': (26, 1, 47, 14),     # Hoenn: Millennium festival (Jirachi, circus tent)
    's4': (52, 1, 73, 14),     # Sinnoh: contest stage
    's5': (77, 1, 98, 19),     # Unova: amusement park
    's6': (77, 23, 98, 42),    # Kalos: Halloween, timber-framed houses
    's7': (74, 45, 98, 59),    # Alola: beach
    's8': (48, 47, 71, 59),    # Galar: party
    's9': (21, 47, 43, 59),    # Paldea: crowns
    'secret': (5, 47, 13, 57), # secret cave (Armored Mewtwo)
}
SHAPES = {'plaza': (2.2, 3), 'secret': (2.2, 5.5)}
NO_TALL_GRASS = ('plaza', 'secret')
# @section lobes
# lobes and peninsulas so that the islands are not plain rectangles
LOBES = {
    's1': [(1, 34, 9, 41)],
    's2': [(14, 10, 21, 18), (1, 3, 6, 9)],
    's3': [(32, 10, 40, 14)],
    's4': [(64, 10, 71, 14), (52, 9, 57, 13), (64, 1, 72, 5)],
    's5': [(76, 12, 81, 20)],
    's6': [(94, 27, 99, 35), (78, 36, 86, 43)],
    's7': [(74, 46, 80, 51)],
    's8': [(64, 56, 70, 60)],
    's9': [(34, 44, 42, 48), (22, 56, 29, 60)],
    'plaza': [(31, 36, 37, 42), (63, 16, 69, 22)],
    'secret': [],
}
# @section paths
PATHS = [
    # plaza island: west entrance and the pier in the south
    (30, 29, 38, 31), (34, 40, 40, 42), (38, 37, 40, 42),
    # s1
    (2, 29, 22, 31), (11, 18, 13, 31), (13, 31, 15, 34),
    # s2
    (4, 6, 22, 8), (11, 6, 13, 19), (13, 16, 19, 18),
    # s3
    (25, 6, 47, 8),
    # s4
    (51, 6, 73, 8),
    # s5
    (76, 6, 89, 8), (87, 6, 89, 19), (89, 11, 92, 13), (79, 16, 87, 18),
    # s6
    (87, 22, 89, 41), (82, 30, 87, 32), (89, 33, 96, 35), (80, 39, 87, 41),
    # s7
    (87, 44, 89, 54), (74, 52, 95, 54),
    # s8
    (48, 52, 71, 54), (59, 54, 61, 55),
    # s9
    (21, 52, 43, 54), (31, 54, 33, 55),
    # secret islet
    (8, 52, 14, 54),
]
for p in PATHS:
    area(*p, PATH)

STONES = [
    (35, 16, 65, 20),     # forecourt of the buildings on the plaza island
    (6, 33, 20, 37),      # s1 party square
    (55, 2, 64, 6),       # s4 contest stage square
    (56, 8, 63, 13),      # s4 fountain square
    (54, 55, 66, 57),     # s8 square
    (26, 55, 38, 57),     # s9 square
]
for s in STONES:
    area(*s, STONE, (GRASS, PATH))
FESTIVAL = (37, 20, 63, 37)
area(*FESTIVAL, FEST, (GRASS, PATH, STONE))
# @section bridges
BRIDGES = [
    ('h', 29, 18, 36), ('v', 11, 10, 24), ('h', 6, 18, 30), ('h', 6, 42, 56), ('h', 6, 68, 80),
    ('v', 87, 14, 26), ('v', 87, 36, 48), ('h', 52, 66, 78), ('h', 52, 39, 52), ('h', 52, 10, 25),
    ('h', 40, 22, 34, 'pier'),    # ferry pier of the plaza island
]
# @section beaches
BEACHES = [(74, 54, 98, 60), (1, 34, 10, 41), (89, 12, 99, 20), (20, 55, 28, 60)]
# @section objects
ROW = [C.RED, C.BLUE, C.YELLOW, C.GREEN, C.PINK, C.ORANGE, C.PURPLE, C.TEAL, C.SKY]

# --- Plaza island ------------------------------------------------------------------------------
put(SP['house_orange'], 38.6, 20)
put(SP['pc'], 46, 20)
put(SP['mart'], 52.2, 20)
put(SP['house_blue'], 59.6, 20)
put(SP['planter_tall'], 42.2, 20)
put(SP['planter_tall'], 63.4, 20)
put(SP['planter'], 49.4, 20)
put(SP['planter'], 55.2, 20)
ring = fp.stage_ring(120, 70)
put(ring, 50, 30.4 + 2.2, reserve=False, layer=-2000)
put(fp.screen(), 50, 25.6)
put(fp.stage(84, 46), 50, 31.4)
stars = []
for i, cx in enumerate((40, 42.6, 45.2, 54.8, 57.4, 60)):
    stall(ROW[i], cx, 22.8)
for i, cx in enumerate((40, 42.6, 45.2, 47.8, 52.2, 54.8, 57.4, 60)):
    stall(ROW[(i + 3) % 9], cx, 36.4)
for i, by in enumerate((27, 30.6, 34)):
    stall(ROW[(i + 5) % 9], 39.4, by)
    stall(ROW[(i + 1) % 9], 60.6, by)
for cx, by in ((44, 27), (56, 27), (44, 34), (56, 34)):
    put(fp.lamp_post(), cx, by)
for cx, by in ((46.4, 27.6), (53.6, 27.6), (46.4, 34.6), (53.6, 34.6)):
    put(fp.balloon_bunch(), cx, by)
put(fp.flag_pole(C.PINK), 36.6, 28.6)
put(fp.flag_pole(C.SKY), 36.6, 31.6)
# garlands run along the stall rows (in front of the upper row, behind the lower row)
string_line('bunting', [(38.7, 23.3), (42.6, 23.5), (46.5, 23.3)])
string_line('bunting', [(53.5, 23.3), (57.4, 23.5), (61.3, 23.3)])
for seg in (((38.7, 34.2), (42.6, 34.4), (46.5, 34.2)), ((53.5, 34.2), (57.4, 34.4), (61.3, 34.2))):
    P = [(x * T, y * T) for x, y in seg]
    line_obj('bunting', P, (C.YELLOW, C.RED, C.SKY, C.PURPLE), -60)
    for x, y in seg:
        put(fp.pole(16), x, y + 0.75, reserve=False, layer=-61)
# a string of festival lights around the stage
lights = fp.lights_ring(128, 76)
put(lights, 50, 30.4 + 2.4, reserve=False, layer=-1500)
# the ferry lies alongside the pier, a gangway leads aboard
put(SP['ship'], 27.6, 42 + SP['ship'].height / T - 0.3, reserve=False)
put(fp.gangway(), 26.2, 42.55, reserve=False, layer=5)
for cx, by in ((35, 20), (65, 20), (35.4, 41), (64.6, 41), (34.8, 26)):
    try_put(SP['palm'], cx, by)

# --- s1 Kanto party ------------------------------------------------------------------------------
put(SP['pc'], 6.6, 29)
put(SP['house_blue'], 17.5, 29)
stall(C.RED, 14.2, 29)
put(SP['planter_tall'], 9.6, 29)
for i, cx in enumerate((8, 10.6, 16.6, 19.2)):
    stall((C.YELLOW, C.SKY, C.GREEN, C.PINK)[i], cx, 34.6)
put(fp.balloon_bunch(), 13.9, 36.4)
string_line('bunting', [(6.6, 33.4), (13, 33.0), (19.4, 33.4)], (C.RED, C.WHITE, C.BLUE))

# --- s2 Johto lantern festival --------------------------------------------------------------------
put(SP['house_thatch'], 7, 6)
stall(C.RED, 15.4, 6)
stall(C.ORANGE, 18, 6)
put(fp.torii(), 20.2, 8.2, reserve=False, layer=40)
string_line('lantern', [(4.6, 9.2), (8.6, 9.2), (10.4, 9.2)])
string_line('lantern', [(18.6, 9.2), (20.6, 9.2)])
put(SP['bell_tower'], 16.6, 16.1)

# --- s3 Hoenn Millennium festival ----------------------------------------------------------------
put(fp.big_tent(C.RED, 80, 70), 36, 6.1)
stall(C.YELLOW, 29.6, 6)
stall(C.BLUE, 42, 6)
stall(C.PURPLE, 44.6, 6)
for cx, by in ((30, 9.8), (33, 10.4), (39.4, 10.4), (42.6, 9.8)):
    put(fp.star_balloon(), cx, by)
string_line('bunting', [(27.6, 8.8), (34.4, 8.8)], (C.YELLOW, C.SKY))
string_line('bunting', [(37.6, 8.8), (44.4, 8.8)], (C.YELLOW, C.SKY))

# --- s4 Sinnoh contest ---------------------------------------------------------------------------
put(fp.stage(), 59.5, 5.6)
put(SP['contest_hall'], 68, 6)
stall(C.SKY, 54, 6)
stall(C.PINK, 65, 6)
string_line('bunting', [(55.2, 2.6), (59.5, 2.4), (63.8, 2.6)], (C.BLUE, C.WHITE, C.PINK))
put(SP['fountain0'], 59.5, 12.6)
for cx in (55.4, 63.6):
    put(SP['planter_tall'], cx, 12.6)

# --- s5 Unova amusement park ---------------------------------------------------------------------
put(fp.roller_coaster(), 82, 6)
put(fp.ferris_wheel(), 93.6, 12.4)
put(fp.balloon_bunch(), 91, 6.4)
for cx, by in ((90.2, 10.8), (85.8, 10.6), (94.4, 15.8)):
    put(fp.balloon_bunch(), cx, by)

# --- s6 Kalos Halloween --------------------------------------------------------------------------
put(fp.big_tent(C.PURPLE, 60, 54), 83.6, 30.2)
put(SP['kalos_house0'], 92.9, 33)
put(SP['kalos_house4'], 82.8, 39)
stall(C.PURPLE, 91.6, 37.8)
stall(C.TEAL, 90.3, 25.6)
for cx, by in ((79.4, 32.6), (86.2, 37.4), (94.6, 37.2), (96.2, 36.4), (95.4, 30.2)):
    put(fp.pumpkin(), cx, by)
for cx, by in ((86.4, 25), (86.4, 33), (89.6, 37)):
    put(fp.lamp_post(), cx, by)

# --- s7 Alola beach ------------------------------------------------------------------------------
put(SP['pc'], 93, 52)
put(SP['hut'], 81.3, 52)
for i, (cx, by) in enumerate(((78.4, 57.2), (82.6, 57.8), (86.8, 57.2), (91, 57.8), (95, 57.2))):
    put(SP['umbrella_blue' if i % 2 else 'umbrella_red'], cx, by)
put(SP['sailboat'], 72.5, 58.4, reserve=False)
put(SP['sailboat'], 98.2, 44.4, reserve=False)

# --- s8 Galar party ------------------------------------------------------------------------------
put(SP['stadium'], 55.6, 52)
for i, cx in enumerate((56, 58.6, 61.4, 64)):
    stall((C.BLUE, C.YELLOW, C.RED, C.WHITE)[i], cx, 56.6)
string_line('bunting', [(54.4, 54.6), (60, 54.4), (65.6, 54.6)], (C.RED, C.WHITE, C.BLUE))

# --- s9 Paldea crowns ----------------------------------------------------------------------------
put(SP['pc'], 26.4, 52)
put(SP['restaurant'], 38.2, 52)
for i, cx in enumerate((31.6, 34.2)):
    stall((C.PURPLE, C.YELLOW)[i], cx, 52)
for i, cx in enumerate((28, 30.6, 33.4, 36)):
    stall((C.PINK, C.ORANGE, C.YELLOW, C.PURPLE)[i], cx, 56.6)
put(fp.balloon_bunch(), 39.6, 56.6)

# --- secret islet --------------------------------------------------------------------------------

# --- raised plateaus with rock faces (Magiscarf's hill piece as a 9-slice); dungeons are caves in them
CLIFFS = [  # (x0, y0, x1, y1) in tiles, cave column or None
    ((77, 10, 85, 16), 80.5),      # s5: dungeon below the roller coaster
    ((62, 48, 70, 52), 66.0),      # s8: dungeon
    ((6, 49, 13, 52), 9.5),        # secret cave
    ((3, 13, 9, 17), None),        # s2: cherry hill
]
for (x0, y0, x1, y1), cave in CLIFFS:
    pl = ma.plateau((x1 - x0) * T, (y1 - y0) * T)
    if cave is not None:
        ce = ma.cave_entrance()
        pl.alpha_composite(ce, (int((cave - x0) * T - ce.width / 2), pl.height - ce.height - 1))
    put(pl, (x0 + x1) / 2, y1)
# vegetation on the plateau tops (sorted in front of the plateau they stand on)
for name, cx, by in (('tree_green0', 78.4, 13.6), ('round_green0', 83.4, 13.2), ('fern', 80.5, 11.6), ('fern', 81.5, 11.6),
                     ('shrub', 82.5, 13.6), ('fern', 63.5, 50.2), ('fern', 64.5, 50.2), ('shrub', 68.6, 50.2),
                     ('fern', 7.5, 51.0), ('flowers_red', 11.5, 51.0)):
    put(SP[name], cx, by, reserve=False, layer=6 * T)
put(SP['tree_sakura0'], 5, 15.2, reserve=False, layer=3 * T)
put(SP['round_sakura0'], 7.4, 15.6, reserve=False, layer=3 * T)

# --- sea decoration ------------------------------------------------------------------------------
for cx, by in ((1.5, 16), (2.5, 18), (98, 21), (97.5, 40.5), (47.5, 44.5), (71.5, 15), (73, 30.5), (30.5, 14.5), (20.5, 46.5)):
    if dist[int(by) - 1, int(cx)] >= 2:
        put(SP['rock'], cx, by, reserve=False)
put(SP['sailboat'], 24.5, 17.5, reserve=False)
put(SP['sailboat'], 73.5, 20.5, reserve=False)
put(fp.blimp(), 49, 14.2, reserve=False, layer=5000)
for cx, by, c in ((24.5, 2.6, C.PINK), (49, 2.6, C.YELLOW), (74.4, 2.8, C.SKY), (17, 44.2, C.PURPLE), (72.4, 42, C.ORANGE), (2, 44, C.GREEN)):
    put(fp.firework(c), cx, by, reserve=False, layer=5000)

# @section flora
FLORA = {
    'plaza': ['palm', 'palm', 'tree_green0', 'round_green0'],
    's1': ['tree_green0', 'tree_green1', 'round_green1', 'tree_round'],
    's2': ['tree_sakura0', 'tree_sakura1', 'round_sakura0', 'tree_sakura2'],      # Johto: cherry blossoms
    's3': ['palm', 'tree_teal0', 'tree_teal1'],
    's4': ['tree_pine', 'tree_pine2', 'tree_pine3', 'round_teal0'],
    's5': ['tree_green0', 'round_green0', 'palm'],
    's6': ['tree_red0', 'tree_autumn0', 'round_red0', 'tree_red1', 'tree_autumn1'],  # Kalos: autumn and Halloween
    's7': ['palm'],
    's8': ['tree_olive0', 'tree_olive1', 'round_olive0', 'tree_gold2'],
    's9': ['tree_gold', 'tree_gold2', 'tree_autumn0', 'round_autumn0'],
    'secret': ['tree_olive0', 'tree_conifer_big'],
}
# @section groves
GROVES = [  # explicit groves in otherwise empty corners (palms on the plaza island)
    ('plaza', (41, 38, 66, 44), ['palm', 'tree_round', 'palm']),
    ('s7', (75, 45, 86, 50), ['palm']),
    ('s1', (2, 22, 10, 27), ['tree_green0', 'tree_green1']),
    ('s2', (2, 9, 10, 19), ['tree_sakura0', 'tree_sakura1', 'round_sakura0']),
    ('s6', (91, 32, 99, 41), ['tree_red0', 'tree_autumn0', 'tree_red1']),
    ('s3', (26, 9, 47, 14), ['palm', 'tree_round']),
]
