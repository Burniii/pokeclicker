type ActivityLoot =
    | { kind: 'item', name: string, amount: number, weight: number }
    | { kind: 'money' | 'tokens' | 'questPoints' | 'farmPoints' | 'diamonds', factor: number, weight: number }
    | { kind: 'berry', amount: number, weight: number }
    | { kind: 'mint', weight: number }
    | { kind: 'shards', amount: number, weight: number };

type ExpeditionDestination = {
    id: string,
    region: GameConstants.Region,
    name: string,
    types: PokemonType[],
    loot: ActivityLoot[],
};

class ActivityData {
    // Route health of a middle route of the region, used to scale difficulty and currency rewards
    public static regionScale(region: GameConstants.Region): number {
        const routes = Routes.getRoutesByRegion(region);
        if (!routes.length) {
            return 100;
        }
        const route = routes[Math.floor(routes.length / 2)];
        return PokemonFactory.routeHealth(route.number, region);
    }

    private static common(): ActivityLoot[] {
        return [
            { kind: 'money', factor: 2, weight: 20 },
            { kind: 'berry', amount: 3, weight: 14 },
            { kind: 'item', name: 'Protein', amount: 1, weight: 4 },
            { kind: 'item', name: 'Calcium', amount: 1, weight: 4 },
            { kind: 'item', name: 'Carbos', amount: 1, weight: 4 },
            { kind: 'item', name: 'Rare_Candy', amount: 1, weight: 3 },
            { kind: 'mint', weight: 2 },
        ];
    }

    private static items(names: string[], weight = 6): ActivityLoot[] {
        return names.map((name) => ({ kind: 'item', name, amount: 1, weight }));
    }

    public static readonly destinations: ExpeditionDestination[] = [
        { id: 'kanto-forest', region: GameConstants.Region.kanto, name: 'Viridian Forest survey', types: [PokemonType.Bug, PokemonType.Grass], loot: ActivityData.items(['Leaf_stone', 'Moon_stone']) },
        { id: 'kanto-sea', region: GameConstants.Region.kanto, name: 'Seafoam Islands dive', types: [PokemonType.Water, PokemonType.Ice], loot: ActivityData.items(['Water_stone', 'Thunder_stone', 'Fire_stone']) },
        { id: 'johto-ruins', region: GameConstants.Region.johto, name: 'Ruins of Alph excavation', types: [PokemonType.Psychic, PokemonType.Rock], loot: ActivityData.items(['Sun_stone', 'Kings_rock', 'Metal_coat']) },
        { id: 'johto-lake', region: GameConstants.Region.johto, name: 'Lake of Rage patrol', types: [PokemonType.Water, PokemonType.Dragon], loot: ActivityData.items(['Dragon_scale', 'Upgrade', 'Water_stone']) },
        { id: 'hoenn-volcano', region: GameConstants.Region.hoenn, name: 'Mt. Chimney ash trail', types: [PokemonType.Fire, PokemonType.Ground], loot: [...ActivityData.items(['Fire_stone']), { kind: 'diamonds', factor: 0, weight: 8 }] },
        { id: 'hoenn-reef', region: GameConstants.Region.hoenn, name: 'Coral reef exploration', types: [PokemonType.Water, PokemonType.Flying], loot: [...ActivityData.items(['Prism_scale', 'Water_stone']), { kind: 'item', name: 'Heart_scale', amount: 1, weight: 6 }] },
        { id: 'sinnoh-mountain', region: GameConstants.Region.sinnoh, name: 'Mt. Coronet climb', types: [PokemonType.Rock, PokemonType.Steel], loot: ActivityData.items(['Dusk_stone', 'Shiny_stone', 'Dawn_stone', 'Protector']) },
        { id: 'sinnoh-snow', region: GameConstants.Region.sinnoh, name: 'Snowpoint blizzard run', types: [PokemonType.Ice, PokemonType.Ghost], loot: ActivityData.items(['Razor_claw', 'Razor_fang', 'Reaper_cloth']) },
        { id: 'unova-desert', region: GameConstants.Region.unova, name: 'Desert Resort dig', types: [PokemonType.Ground, PokemonType.Dark], loot: [...ActivityData.items(['Electirizer', 'Magmarizer']), { kind: 'tokens', factor: 0.5, weight: 10 }] },
        { id: 'unova-city', region: GameConstants.Region.unova, name: 'Castelia City errands', types: [PokemonType.Normal, PokemonType.Electric], loot: [...ActivityData.items(['Dubious_disc', 'Thunder_stone']), { kind: 'questPoints', factor: 0, weight: 10 }] },
        { id: 'kalos-garden', region: GameConstants.Region.kalos, name: 'Parfum Palace garden', types: [PokemonType.Fairy, PokemonType.Grass], loot: ActivityData.items(['Sachet', 'Whipped_dream', 'Leaf_stone']) },
        { id: 'kalos-cave', region: GameConstants.Region.kalos, name: 'Terminus Cave mining', types: [PokemonType.Steel, PokemonType.Dragon], loot: [...ActivityData.items(['Ice_stone', 'Metal_coat']), { kind: 'diamonds', factor: 0, weight: 8 }] },
        { id: 'alola-island', region: GameConstants.Region.alola, name: 'Island Scan trip', types: [PokemonType.Fire, PokemonType.Water], loot: [...ActivityData.items(['Fire_stone', 'Water_stone', 'Ice_stone']), { kind: 'farmPoints', factor: 0, weight: 8 }] },
        { id: 'alola-ultra', region: GameConstants.Region.alola, name: 'Ultra Space Wilds', types: [PokemonType.Psychic, PokemonType.Poison], loot: [...ActivityData.items(['Dawn_stone', 'Dusk_stone']), { kind: 'mint', weight: 4 }] },
        { id: 'galar-wild', region: GameConstants.Region.galar, name: 'Wild Area camping', types: [PokemonType.Normal, PokemonType.Fighting], loot: [...ActivityData.items(['Galarica_cuff', 'Galarica_wreath', 'Sweet_apple', 'Tart_apple']), { kind: 'item', name: 'Linking_cord', amount: 1, weight: 2 }] },
        { id: 'galar-tundra', region: GameConstants.Region.galar, name: 'Crown Tundra expedition', types: [PokemonType.Ice, PokemonType.Ghost], loot: [...ActivityData.items(['Cracked_pot', 'Ice_stone']), { kind: 'tokens', factor: 0.5, weight: 10 }] },
        { id: 'hisui-fieldlands', region: GameConstants.Region.hisui, name: 'Obsidian Fieldlands research', types: [PokemonType.Grass, PokemonType.Bug], loot: ActivityData.items(['Black_augurite', 'Peat_block', 'Linking_cord']) },
        { id: 'hisui-icelands', region: GameConstants.Region.hisui, name: 'Alabaster Icelands survey', types: [PokemonType.Ice, PokemonType.Fighting], loot: [...ActivityData.items(['Auspicious_armor', 'Malicious_armor', 'Razor_claw']), { kind: 'mint', weight: 4 }] },
        { id: 'paldea-crater', region: GameConstants.Region.paldea, name: 'Great Crater descent', types: [PokemonType.Dragon, PokemonType.Psychic], loot: [...ActivityData.items(['Syrupy_apple', 'Unremarkable_teacup']), { kind: 'shards', amount: 4, weight: 24 }] },
        { id: 'paldea-coast', region: GameConstants.Region.paldea, name: 'Casseroya Lake fishing trip', types: [PokemonType.Water, PokemonType.Steel], loot: [...ActivityData.items(['Water_stone', 'Metal_coat']), { kind: 'shards', amount: 4, weight: 24 }] },
    ];

    public static lootFor(destination: ExpeditionDestination): ActivityLoot[] {
        return [...ActivityData.common(), ...destination.loot];
    }

    // Ranch production per resident per hour, by type
    public static ranchProduct(type: PokemonType): ActivityLoot {
        switch (type) {
            case PokemonType.Grass:
            case PokemonType.Bug:
                return { kind: 'berry', amount: 2, weight: 1 };
            case PokemonType.Water:
            case PokemonType.Ice:
                return { kind: 'item', name: 'Heart_scale', amount: 0.25, weight: 1 };
            case PokemonType.Rock:
            case PokemonType.Ground:
            case PokemonType.Steel:
                return { kind: 'diamonds', factor: 0, weight: 1 };
            case PokemonType.Fire:
            case PokemonType.Electric:
            case PokemonType.Dragon:
                return { kind: 'tokens', factor: 0.04, weight: 1 };
            case PokemonType.Psychic:
            case PokemonType.Ghost:
            case PokemonType.Dark:
                return { kind: 'questPoints', factor: 0, weight: 1 };
            case PokemonType.Fighting:
            case PokemonType.Poison:
                return { kind: 'farmPoints', factor: 0, weight: 1 };
            default:
                return { kind: 'money', factor: 0.3, weight: 1 };
        }
    }

    public static productName(loot: ActivityLoot): string {
        switch (loot.kind) {
            case 'item': return ItemList[loot.name]?.displayName ?? GameConstants.humanifyString(loot.name);
            case 'money': return 'Pokédollars';
            case 'tokens': return 'Dungeon Tokens';
            case 'questPoints': return 'Quest Points';
            case 'farmPoints': return 'Farm Points';
            case 'diamonds': return 'Diamonds';
            case 'berry': return 'Berries';
            case 'mint': return 'Mint';
            case 'shards': return 'Tera Shards';
        }
    }

    // Grants loot "amount" times (fractions are allowed for currencies), returns a short description
    public static give(loot: ActivityLoot, multiplier: number, region: GameConstants.Region, shardType: PokemonType = PokemonType.None): string {
        const scale = ActivityData.regionScale(region);
        const level = region + 1;
        switch (loot.kind) {
            case 'item': {
                const amount = Math.max(1, Math.round(loot.amount * multiplier));
                player.gainItem(loot.name, amount);
                return `${amount}× ${ActivityData.productName(loot)}`;
            }
            case 'money': {
                const amount = Math.ceil(scale * loot.factor * multiplier);
                App.game.wallet.gainMoney(amount, true);
                return `${amount.toLocaleString('en-US')} Pokédollars`;
            }
            case 'tokens': {
                const amount = Math.ceil(scale * loot.factor * multiplier);
                App.game.wallet.gainDungeonTokens(amount, true);
                return `${amount.toLocaleString('en-US')} Dungeon Tokens`;
            }
            case 'questPoints': {
                const amount = Math.ceil(5 * level * multiplier);
                App.game.wallet.gainQuestPoints(amount, true);
                return `${amount.toLocaleString('en-US')} Quest Points`;
            }
            case 'farmPoints': {
                const amount = Math.ceil(10 * level * multiplier);
                App.game.wallet.gainFarmPoints(amount, true);
                return `${amount.toLocaleString('en-US')} Farm Points`;
            }
            case 'diamonds': {
                const amount = Math.ceil(0.5 * level * multiplier);
                App.game.wallet.gainDiamonds(amount, true);
                return `${amount.toLocaleString('en-US')} Diamonds`;
            }
            case 'berry': {
                const unlocked = App.game.farming.unlockedBerries.map((b, i) => (b() ? i : -1)).filter((i) => i >= 0);
                const berry = (unlocked.length ? Rand.fromArray(unlocked) : BerryType.Cheri) as BerryType;
                const amount = Math.max(1, Math.round(loot.amount * multiplier));
                App.game.farming.gainBerry(berry, amount, false);
                return `${amount}× ${BerryType[berry]} Berry`;
            }
            case 'mint': {
                App.game.pokemonTraits.gainMints(1);
                return '1 Mint';
            }
            case 'shards': {
                const type = shardType !== PokemonType.None ? shardType : Rand.intBetween(0, 17) as PokemonType;
                const amount = Math.max(1, Math.round(loot.amount * multiplier));
                App.game.pokemonTraits.gainShards(type, amount);
                return `${amount}× ${PokemonType[type]} Tera Shards`;
            }
        }
    }

    public static pick(loot: ActivityLoot[]): ActivityLoot {
        const total = loot.reduce((sum, l) => sum + l.weight, 0);
        let roll = Math.random() * total;
        for (const l of loot) {
            roll -= l.weight;
            if (roll <= 0) {
                return l;
            }
        }
        return loot[loot.length - 1];
    }
}
